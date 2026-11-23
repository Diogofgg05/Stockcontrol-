"""Regression suite: private image storage, authorization and safe transformations."""
from io import BytesIO
from PIL import Image, PngImagePlugin
from test_phase2_api import e


def image_bytes(fmt="PNG", color=(82, 125, 170), size=(160, 120)):
    out=BytesIO()
    image=Image.new("RGB",size,color)
    image.save(out,format=fmt)
    return out.getvalue()


def test_real_photo_upload_private_read_delete_and_strip_metadata(e,tmp_path,monkeypatch):
    c,app,a,b,wa,wb,m,part,supplier,post,auth=e
    monkeypatch.setenv("STOCKCONTROL_MEDIA_ROOT",str(tmp_path/"private_photos"))
    img=Image.new("RGB",(230,120),"blue")
    meta=PngImagePlugin.PngInfo()
    meta.add_text("Comment","private test EXIF metadata")
    io=BytesIO();img.save(io,"PNG",pnginfo=meta)
    upload=c.post("/api/v2/materials/"+m["id"]+"/photo",headers=a,
                  files={"file":("real.png",io.getvalue(),"image/png")})
    assert upload.status_code==200,upload.text
    assert upload.json()["has_photo"] is True
    response=c.get("/api/v2/materials/"+m["id"]+"/photo",headers=a)
    assert response.status_code==200
    assert response.headers["content-type"].startswith("image/webp")
    assert b"private test EXIF metadata" not in response.content
    with Image.open(BytesIO(response.content)) as result:
        assert result.format=="WEBP" and result.size==(230,120)
        assert not result.getexif()
    assert c.get("/api/v2/materials/"+m["id"]+"/photo").status_code==401
    assert c.get("/api/v2/materials/"+m["id"]+"/photo",headers=b).status_code==404
    assert c.post("/api/v2/materials/"+m["id"]+"/photo",headers=b,
        files={"file":("real.png",image_bytes(),"image/png")}).status_code==404
    listed=c.get("/api/v2/materials",headers=a).json()
    assert next(x for x in listed if x["id"]==m["id"])["has_photo"] is True
    assert all(x["has_photo"] is False for x in c.get("/api/v2/materials",headers=b).json())
    assert c.delete("/api/v2/materials/"+m["id"]+"/photo",headers=a).status_code==200
    assert c.get("/api/v2/materials/"+m["id"]+"/photo",headers=a).status_code==404
    assert next(x for x in c.get("/api/v2/materials",headers=a).json()
        if x["id"]==m["id"])["has_photo"] is False
    audit=c.get("/api/v1/audit",headers=a).json()
    assert any(x["action"]=="material.photo_uploaded" for x in audit)
    assert any(x["action"]=="material.photo_deleted" for x in audit)


def test_photo_rejects_unsafe_formats_and_sizes(e,tmp_path,monkeypatch):
    c,app,a,b,wa,wb,m,part,supplier,post,auth=e
    monkeypatch.setenv("STOCKCONTROL_MEDIA_ROOT",str(tmp_path/"private"))
    url="/api/v2/materials/"+m["id"]+"/photo"
    assert c.post(url,headers=a,files={"file":("hack.svg",
        b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        "image/svg+xml")}).status_code==415
    assert c.post(url,headers=a,files={"file":("large.png",
        b"X"*(4*1024*1024+1),"image/png")}).status_code==413
    assert c.post(url,headers=a,files={"file":("broken.png",
        b"not a photo","image/png")}).status_code==415
    assert c.get(url,headers=a).status_code==404


def test_only_admin_and_manager_can_change_material_photos(e,tmp_path,monkeypatch):
    c,app,a,b,wa,wb,m,part,supplier,post,auth=e
    monkeypatch.setenv("STOCKCONTROL_MEDIA_ROOT",str(tmp_path/"private"))
    result=c.post("/api/v1/users",headers=a,json={
        "name":"Trabalhador","email":"worker@aect.example",
        "password":"StrongWorkerPassword123","role":"Operador"})
    assert result.status_code==201
    worker=auth(email="worker@aect.example",password="StrongWorkerPassword123")
    target="/api/v2/materials/"+m["id"]+"/photo"
    assert c.post(target,headers=worker,files={"file":(
        "photo.png",image_bytes(),"image/png")}).status_code==403
    assert c.delete(target,headers=worker).status_code==403
    assert c.post(target,headers=a,files={"file":(
        "photo.png",image_bytes(),"image/png")}).status_code==200
    assert c.get(target,headers=worker).status_code==200


def test_image_resolution_and_exif_transformation(e,tmp_path,monkeypatch):
    c,app,a,b,wa,wb,m,part,supplier,post,auth=e
    monkeypatch.setenv("STOCKCONTROL_MEDIA_ROOT",str(tmp_path/"private"))
    res=c.post("/api/v2/materials/"+m["id"]+"/photo",headers=a,files={
        "file":("long.png",image_bytes(size=(3200,1000)),"image/png")})
    assert res.status_code==200,res.text
    with Image.open(BytesIO(c.get("/api/v2/materials/"+m["id"]+"/photo",
        headers=a).content)) as pic:
        assert max(pic.size)<=1400
