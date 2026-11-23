'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const project=path.resolve(__dirname,'..');
const out=path.join(__dirname,'v9-previews');
const prefix='portal_php/public/assets/';
const allowed=/^design-v(5|8|9)\/(?:assets\/)?[\w.-]+\.(?:html|css|js|svg)$/;
let server,browser,origin;
before(async()=>{
 server=http.createServer((req,res)=>{
  let name;
  try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '');}
  catch{res.writeHead(400);res.end();return;}
  if(!name.startsWith(prefix)||!allowed.test(name.slice(prefix.length))){res.writeHead(404);res.end('Not found');return;}
  const full=path.join(project,name);
  const ext=path.extname(full);
  const type={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'application/javascript;charset=utf-8','.svg':'image/svg+xml;charset=utf-8'}[ext];
  try{res.writeHead(200,{'Content-Type':type});res.end(fs.readFileSync(full));}
  catch{res.writeHead(404);res.end('Not found')}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 origin='http://127.0.0.1:'+server.address().port+'/'+prefix+'design-v9/index.html';
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 fs.mkdirSync(out,{recursive:true});
});
after(async()=>{
 if(browser)await browser.close();
 if(server)await new Promise(ok=>server.close(ok));
});
async function open(viewport,route='dashboard'){
 const ctx=await browser.newContext({viewport,deviceScaleFactor:1});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',resp=>{if(resp.status()>=400&&resp.url().includes('design-v9/'))errors.push(resp.status()+' '+resp.url())});
 await page.goto(origin+'#'+route,{waitUntil:'load'});
 await page.locator('.route-view[data-route="'+route+'"]').waitFor();
 await page.waitForFunction(route=>route==='inventory'?!!document.querySelector('.v9-category-strip'):route==='dashboard'?!!document.querySelector('.v9-visual-banner'):!!document.querySelector('.v9-website-visual'),route);
 return{ctx,page,errors};
}
for(const [name,width,height] of [['desktop',1440,900],['wide',1920,1080],['mobile',390,844]]){
 test('V9 real illustrated dashboard and inventory '+name,async()=>{
  const {page,ctx,errors}=await open({width,height});
  assert.equal(await page.locator('.v9-visual-banner img').count(),1);
  const heroOk=await page.locator('.v9-visual-banner img').evaluate(img=>img.complete&&img.naturalWidth>0);
  assert.equal(heroOk,true,'Imagem principal não carregou');
  await page.screenshot({path:path.join(out,name+'-dashboard.png')});
  await page.goto(origin+'#inventory',{waitUntil:'load'});
  await page.locator('.v9-category-strip').waitFor();
  assert.equal(await page.locator('.v9-category-card').count(),4);
  assert.ok(await page.locator('.product-avatar img').count()>=1,'Inventário sem fotografias ilustrativas');
  const loaded=await page.locator('.v9-category-card img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(loaded,true,'Imagem de categoria não carregou');
  const metrics=await page.locator('.stats-grid.three .stat-card').count();
  assert.equal(metrics,3);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
  assert.equal(overflow,false,'Overflow horizontal');
  await page.screenshot({path:path.join(out,name+'-inventory.png')});
  assert.deepEqual(errors,[]);
  await ctx.close();
 });
}
test('V9 categoria ilustrada filtra inventário sem alterar os dados',async()=>{
 const {page,ctx,errors}=await open({width:1440,height:900},'inventory');
 await page.locator('.v9-category-card[data-category="Elétrico"]').click();
 assert.match(await page.locator('.filters .filter-btn.active').innerText(),/Elétrico/);
 assert.ok((await page.locator('.product-cell').count())>=1);
 assert.deepEqual(errors,[]);
 await ctx.close();
});
test('V9 website contém ilustração principal e três módulos com imagens',async()=>{
 const {page,ctx,errors}=await open({width:1440,height:900},'website');
 assert.equal(await page.locator('.v9-website-visual img').count(),1);
 assert.equal(await page.locator('.v9-feature-visual img').count(),3);
 await page.screenshot({path:path.join(out,'desktop-website.png')});
 const broken=await page.locator('.v9-feature-visual img, .v9-website-visual img').evaluateAll(v=>v.some(i=>!i.complete||i.naturalWidth<=0));
 assert.equal(broken,false,'Alguma imagem da landing não carregou');
 assert.deepEqual(errors,[]);
 await ctx.close();
});
