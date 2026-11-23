'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const project=path.resolve(__dirname,'..');
const output=path.join(__dirname,'v8-previews');
let server,browser,url;

before(async()=>{
  server=http.createServer((req,res)=>{
    const urlObj=new URL(req.url,'http://localhost');
    const name=decodeURIComponent(urlObj.pathname).replace(/^\/+/, '');
    const approved=/^portal_php\/public\/assets\/design-v(5|8)\/[A-Za-z0-9._-]+\.(html|css|js)$/;
    if(!approved.test(name)){res.writeHead(404);res.end('Not found');return}
    const file=path.join(project,name);
    const ext=path.extname(name);
    const type=ext==='.css'?'text/css; charset=utf-8':ext==='.js'?'application/javascript; charset=utf-8':'text/html; charset=utf-8';
    try{const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':type});res.end(data)}
    catch{res.writeHead(404);res.end('Not found')}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  url='http://127.0.0.1:'+server.address().port+'/portal_php/public/assets/design-v8/index.html';
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  fs.mkdirSync(output,{recursive:true});
});
after(async()=>{
  if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
});
for(const [name,width,height] of [['desktop',1440,900],['wide',1920,1080],['mobile',390,844]]){
  test('Premium Light screenshot and navigation '+name,async()=>{
    const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,acceptDownloads:true});
    const page=await ctx.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'load'});
    await page.locator('.dashboard-page').waitFor({state:'visible'});
    assert.match(await page.locator('h1').first().innerText(),/Visão geral/);
    const appearance=await page.evaluate(()=>({
      bg:getComputedStyle(document.querySelector('.app-shell')).backgroundColor,
      docOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      line:getComputedStyle(document.documentElement).getPropertyValue('--sc-line').trim()
    }));
    assert.equal(appearance.bg,'rgb(247, 249, 253)');
    assert.equal(appearance.line,'#e4eaf2');
    assert.equal(appearance.docOverflow,false);
    await page.screenshot({path:path.join(output,name+'-dashboard.png')});
    await page.goto(url+'#inventory',{waitUntil:'load'});
    await page.locator('h1').first().waitFor();
    assert.match(await page.locator('h1').first().innerText(),/Inventário/);
    assert.equal(await page.locator('.stats-grid.three .stat-card').count(),3);
    await page.screenshot({path:path.join(output,name+'-inventory.png')});
    assert.deepEqual(errors,[]);
    await ctx.close();
  });
}
test('Light theme preserves stock interactions',async()=>{
  const ctx=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'#inventory');
  await page.locator('[data-action="add-material"]').click();
  await page.locator('#modal-form [name="sku"]').fill('V8-QA-01');
  await page.locator('#modal-form [name="name"]').fill('Componente visual de teste');
  await page.locator('#modal-form [name="category"]').fill('Teste');
  await page.locator('#modal-form [type="submit"]').click();
  await page.locator('#inventory-search').fill('V8-QA-01');
  assert.equal(await page.locator('[data-action="detail"][data-sku="V8-QA-01"]').count(),1);
  assert.deepEqual(errors,[]);
  await ctx.close();
});
