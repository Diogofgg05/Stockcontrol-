'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.join(__dirname,'../portal_php/public/assets/design-v5');
const previews=path.join(__dirname,'v5-previews');
const allowed=new Set(['index.html','model.js','backup.js','app.js','styles.css','reference-theme.css']);
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'index.html';
  if(!allowed.has(name)){res.writeHead(404);res.end('Not found');return}
  const types={html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
  const full=path.join(root,name);
  res.writeHead(200,{'content-type':types[path.extname(name).slice(1)]||'text/plain'});
  res.end(fs.readFileSync(full));
});
let browser,url;
before(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  url='http://127.0.0.1:'+server.address().port+'/';
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  fs.mkdirSync(previews,{recursive:true});
});
after(async()=>{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
});
async function openPage(viewport={width:1440,height:900}){
  const context=await browser.newContext({viewport,acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(url,{waitUntil:'load'});
  await page.locator('h1').waitFor({state:'visible'});
  return{page,context,errors};
}
test('navegação dos 11 módulos sem exceções JavaScript',async()=>{
  const {page,context,errors}=await openPage();
  const pages=['dashboard','inventory','movements','reservations','counts','documents','reports','team','settings','billing','website','design'];
  for(const key of pages){
    await page.locator('.side-link[data-nav="'+key+'"]').click();
    assert.ok((await page.locator('h1').innerText()).length>3,'Sem heading em '+key);
    assert.equal(new URL(page.url()).hash,'#'+key);
  }
  await page.screenshot({path:path.join(previews,'desktop-website.png'),fullPage:true});
  await page.locator('.side-link[data-nav="dashboard"]').click();
  await page.screenshot({path:path.join(previews,'desktop-dashboard.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  await context.close();
});
test('criar material, pesquisar e persistir após refresh',async()=>{
  const {page,context,errors}=await openPage();
  await page.locator('[data-nav="inventory"]').click();
  await page.locator('[data-action="add-material"]').click();
  await page.locator('#modal-form [name="sku"]').fill('QA-001');
  await page.locator('#modal-form [name="name"]').fill('Peça QA <img src=x onerror=alert(1)>');
  await page.locator('#modal-form [name="category"]').fill('Teste');
  await page.locator('#modal-form [name="stock"]').fill('20');
  await page.locator('#modal-form [name="min"]').fill('5');
  await page.locator('#modal-form [type="submit"]').click();
  assert.equal(await page.locator('.modal').count(),0);
  await page.locator('#inventory-search').fill('QA-001');
  assert.equal(await page.locator('[data-action="detail"][data-sku="QA-001"]').count(),1);
  assert.equal(await page.locator('img[onerror]').count(),0,'HTML user-supplied foi interpretado');
  await page.reload();
  await page.locator('[data-nav="inventory"]').click();
  await page.locator('#inventory-search').fill('QA-001');
  assert.equal(await page.locator('[data-action="detail"][data-sku="QA-001"]').count(),1);
  assert.deepEqual(errors,[]);
  await context.close();
});
test('reserva impede saída excessiva, stock válido fica persistido',async()=>{
  const {page,context,errors}=await openPage();
  await page.locator('[data-action="new-movement"]').click();
  await page.locator('#modal-form [name="type"]').selectOption('Saída');
  await page.locator('#modal-form [name="sku"]').selectOption('MAT-001');
  await page.locator('#modal-form [name="qty"]').fill('316');
  await page.locator('#modal-form [type="submit"]').click();
  assert.match(await page.locator('#toast').textContent(),/stock disponível/i);
  assert.equal(await page.locator('#modal-form').count(),1);
  await page.locator('#modal-form [name="qty"]').fill('15');
  await page.locator('#modal-form [type="submit"]').click();
  assert.equal(await page.locator('#modal-form').count(),0);
  await page.reload();
  await page.locator('[data-nav="inventory"]').click();
  await page.locator('[data-action="detail"][data-sku="MAT-001"]').click();
  assert.match(await page.locator('.detail-grid').innerText(),/330/);
  assert.match(await page.locator('.detail-grid').innerText(),/300/);
  assert.deepEqual(errors,[]);
  await context.close();
});
test('acerto físico cria movimento assinado no histórico e CSV',async()=>{
  const {page,context,errors}=await openPage();
  page.on('dialog',d=>d.accept());
  await page.locator('[data-nav="counts"]').click();
  await page.locator('[data-action="new-count"]').click();
  await page.locator('#modal-form [name="sku"]').selectOption('MAT-005');
  await page.locator('#modal-form [name="counted"]').fill('195');
  await page.locator('#modal-form [type="submit"]').click();
  await page.locator('[data-action="approve-count"]').first().click();
  assert.match(await page.locator('tbody tr').first().innerText(),/Aplicada/);
  await page.locator('[data-nav="movements"]').click();
  await page.locator('[data-movfilter="Ajuste"]').click();
  assert.equal(await page.locator('tbody tr').count(),1);
  assert.match(await page.locator('tbody tr').first().innerText(),/-15/);
  const downloadPromise=page.waitForEvent('download');
  await page.locator('[data-action="export-movements"]').click();
  const download=await downloadPromise;
  const file=await download.path();
  const csv=fs.readFileSync(file,'utf8');
  assert.match(csv,/Variação de stock/);
  assert.match(csv,/-15/);
  assert.deepEqual(errors,[]);
  await context.close();
});
test('Auditor não pode criar material e não aparece um modal enganador',async()=>{
  const {page,context}=await openPage();
  await page.locator('.side-link[data-nav="settings"]').click();
  await page.locator('#demo-role').selectOption('Auditor');
  await page.locator('[data-nav="inventory"]').click();
  await page.locator('[data-action="add-material"]').click();
  assert.match(await page.locator('#toast').textContent(),/não é permitida/);
  assert.equal(await page.locator('.modal').count(),0);
  await context.close();
});
test('estado adulterado no navegador é recusado ao recarregar',async()=>{
  const {page,context,errors}=await openPage();
  await page.evaluate(()=>localStorage.setItem('stockcontrol:v5:offline:v1',JSON.stringify({id:'demo',materials:'wrong'})));
  await page.reload();
  assert.match(await page.locator('.risk-metrics').innerText(),/Total de materiais[\s\S]*8/);
  assert.deepEqual(errors,[]);
  await context.close();
});
test('mobile: menu, pesquisa e largura do viewport',async()=>{
  const {page,context,errors}=await openPage({width:390,height:844});
  await page.locator('[data-action="toggle-menu"]').click();
  assert.match(await page.locator('.sidebar').getAttribute('class'),/open/);
  await page.locator('.sidebar [data-nav="inventory"]').click();
  assert.doesNotMatch(await page.locator('.sidebar').getAttribute('class'),/open/);
  await page.locator('[data-action="go-inventory-search"]').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'inventory-search');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=2,'A página excede a largura móvel por '+overflow+'px');
  await page.screenshot({path:path.join(previews,'mobile-inventory.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  await context.close();
});

test('alteração noutra aba fecha formulário desatualizado e sincroniza inventário',async()=>{
  const {page,context,errors}=await openPage();
  await page.locator('[data-action="new-movement"]').click();
  assert.equal(await page.locator('.modal').count(),1);
  const second=await context.newPage();
  await second.goto(url);
  await second.locator('[data-nav="inventory"]').click();
  await second.locator('[data-action="add-material"]').click();
  await second.locator('#modal-form [name="sku"]').fill('MULTI-01');
  await second.locator('#modal-form [name="name"]').fill('Material outra aba');
  await second.locator('#modal-form [name="category"]').fill('Teste');
  await second.locator('#modal-form [type="submit"]').click();
  await page.waitForFunction(()=>!document.querySelector('.modal'));
  assert.match(await page.locator('#toast').innerText(),/outra aba/i);
  await page.locator('[data-nav="inventory"]').click();
  await page.locator('#inventory-search').fill('MULTI-01');
  assert.equal(await page.locator('[data-action="detail"][data-sku="MULTI-01"]').count(),1);
  assert.deepEqual(errors,[]);
  await context.close();
});
test('falha de localStorage não finge persistência definitiva',async()=>{
  const {page,context,errors}=await openPage();
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='stockcontrol:v5:offline:v1')throw new DOMException('Armazenamento bloqueado','QuotaExceededError');
      return original.call(this,key,value);
    };
  });
  await page.locator('[data-action="new-movement"]').click();
  await page.locator('#modal-form [name="qty"]').fill('2');
  await page.locator('#modal-form [type="submit"]').click();
  assert.equal(await page.locator('.modal').count(),0);
  assert.match(await page.locator('#toast').innerText(),/armazenamento local indisponível/i);
  assert.deepEqual(errors,[]);
  await context.close();
});

test('consumo parcial e total de reserva sem libertação incorreta de stock',async()=>{
  const {page,context,errors}=await openPage();
  await page.locator('[data-nav="reservations"]').click();
  await page.locator('[data-action="consume-reservation"][data-id="RS-001"]').click();
  await page.locator('#modal-form [name="qty"]').fill('12');
  await page.locator('#modal-form [type="submit"]').click();
  let row=page.locator('tbody tr').filter({hasText:'RS-001'});
  assert.match(await row.innerText(),/18/);
  assert.match(await row.innerText(),/Ativa/);
  await page.locator('[data-action="consume-reservation"][data-id="RS-001"]').click();
  await page.locator('#modal-form [name="qty"]').fill('19');
  await page.locator('#modal-form [type="submit"]').click();
  assert.match(await page.locator('#toast').innerText(),/saldo reservado/i);
  await page.locator('#modal-form [name="qty"]').fill('18');
  await page.locator('#modal-form [type="submit"]').click();
  row=page.locator('tbody tr').filter({hasText:'RS-001'});
  assert.match(await row.innerText(),/Concluída/);
  assert.equal(await row.locator('[data-action="consume-reservation"]').count(),0);
  await page.locator('[data-nav="inventory"]').click();
  await page.locator('[data-action="detail"][data-sku="MAT-001"]').click();
  assert.match(await page.locator('.detail-grid').innerText(),/315/);
  assert.deepEqual(errors,[]);
  await context.close();
});
test('cancelamento após consumo parcial preserva histórico e stock descontado',async()=>{
  const {page,context,errors}=await openPage();
  page.on('dialog',d=>d.accept());
  await page.locator('[data-nav="reservations"]').click();
  await page.locator('[data-action="consume-reservation"][data-id="RS-001"]').click();
  await page.locator('#modal-form [name="qty"]').fill('12');
  await page.locator('#modal-form [type="submit"]').click();
  await page.locator('[data-action="cancel-reservation"][data-id="RS-001"]').click();
  const row=page.locator('tbody tr').filter({hasText:'RS-001'});
  assert.match(await row.innerText(),/Cancelada/);
  assert.equal(await row.locator('[data-action="consume-reservation"]').count(),0);
  await page.locator('[data-nav="inventory"]').click();
  await page.locator('[data-action="detail"][data-sku="MAT-001"]').click();
  assert.match(await page.locator('.detail-grid').innerText(),/333/);
  assert.match(await page.locator('.detail-grid').innerText(),/0/);
  await page.locator('[data-action="close-modal"]').last().click();
  await page.locator('[data-nav="movements"]').click();
  await page.locator('[data-movfilter="Consumo"]').click();
  assert.match(await page.locator('tbody').innerText(),/12/);
  assert.deepEqual(errors,[]);
  await context.close();
});

test('inventário indica sem disponibilidade quando reserva absorve todo o stock físico',async()=>{
  const {page,context,errors}=await openPage();
  await page.locator('[data-nav="reservations"]').click();
  page.on('dialog',d=>d.accept());
  await page.locator('[data-action="cancel-reservation"][data-id="RS-001"]').click();
  await page.locator('[data-action="new-reservation"]').click();
  await page.locator('#modal-form [name="sku"]').selectOption('MAT-001');
  await page.locator('#modal-form [name="order"]').fill('OP-RESERVA-TOTAL');
  await page.locator('#modal-form [name="qty"]').fill('345');
  await page.locator('#modal-form [type="submit"]').click();
  await page.locator('[data-nav="inventory"]').click();
  const row=page.locator('tbody tr').filter({hasText:'MAT-001'});
  assert.match(await row.innerText(),/Sem disponibilidade/);
  assert.match(await row.innerText(),/345/);
  await page.locator('.side-link[data-nav="dashboard"]').click();
  assert.match(await page.locator('.dashboard-alerts').innerText(),/Sem disponibilidade/);
  await page.locator('[data-action="notifications"]').click();
  assert.match(await page.locator('.notification-list').innerText(),/Sem disponibilidade/);
  assert.deepEqual(errors,[]);
  await context.close();
});

test('V5: offline JSON backup can be exported and restored with no network API',async()=>{
  const {page,context,errors}=await openPage();
  await page.locator('.side-link[data-nav="settings"]').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('[data-action="backup-export"]').click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/stockcontrol-backup-\d{4}-\d{2}-\d{2}\.json/);
  const raw=fs.readFileSync(await download.path(),'utf8');
  const parsed=JSON.parse(raw);
  assert.equal(parsed.format,'stockcontrol-offline-backup');
  assert.equal(parsed.workspace.materials.length,8);
  await page.locator('[data-nav="inventory"]').click();
  await page.locator('[data-action="add-material"]').click();
  await page.locator('#modal-form [name="sku"]').fill('OFFLINE-99');
  await page.locator('#modal-form [name="name"]').fill('Offline Recovery Test');
  await page.locator('#modal-form [name="category"]').fill('QA');
  await page.locator('#modal-form [type="submit"]').click();
  await page.locator('.side-link[data-nav="settings"]').click();
  page.on('dialog',d=>d.accept());
  await page.locator('#backup-input').setInputFiles({
    name:'backup.json',mimeType:'application/json',buffer:Buffer.from(raw,'utf8')
  });
  await page.waitForFunction(()=>!localStorage.getItem('stockcontrol:v5:offline:v1')?.includes('OFFLINE-99'));
  await page.locator('[data-nav="inventory"]').click();
  assert.equal(await page.locator('[data-action="detail"][data-sku="OFFLINE-99"]').count(),0);
  assert.deepEqual(errors,[]);
  await context.close();
});
test('V5: inventory sorting and pagination display correct rows',async()=>{
  const {page,context,errors}=await openPage();
  await page.locator('.side-link[data-nav="inventory"]').click();
  for(let i=0;i<5;i++){
    await page.locator('[data-action="add-material"]').click();
    await page.locator('#modal-form [name="sku"]').fill('QATEST-'+i);
    await page.locator('#modal-form [name="name"]').fill('Test '+i);
    await page.locator('#modal-form [name="category"]').fill('QA');
    await page.locator('#modal-form [type="submit"]').click();
  }
  await page.locator('#inventory-sort').selectOption('stock');
  assert.equal(await page.locator('#inventory-sort').inputValue(),'stock');
  assert.equal(await page.locator('tbody tr').count(),8);
  await page.locator('[data-action="next-inventory"]').click();
  assert.equal(await page.locator('tbody tr').count(),5);
  assert.match(await page.locator('.pager').innerText(),/Página 2/);
  await page.locator('#inventory-search').fill('QATEST');
  assert.equal(await page.locator('tbody tr').count(),5);
  assert.match(await page.locator('.pager').innerText(),/Página 1/);
  assert.deepEqual(errors,[]);
  await context.close();
});

test('V6: reference dark style is inherited on every page',async()=>{
 const {page,context,errors}=await openPage({width:1440,height:900});
 const expected={base:'rgb(22, 21, 30)',lavender:'#C9BCFF',lime:'#D8F574'};
 const pages=['dashboard','inventory','movements','reservations','counts','documents','reports','team','settings','billing','website','design'];
 for(const key of pages){
   await page.locator('.side-link[data-nav="'+key+'"]').click();
   const appearance=await page.evaluate(()=>{
     const root=getComputedStyle(document.documentElement);
     const panel=document.querySelector('.panel');
     return {
       canvas:getComputedStyle(document.querySelector('.app-shell')).backgroundColor,
       page:getComputedStyle(document.body).backgroundColor,
       line:root.getPropertyValue('--sc-line').trim(),
       accent:root.getPropertyValue('--sc-lavender').trim(),
       lime:root.getPropertyValue('--sc-lime').trim(),
       hasRail:!!document.querySelector('aside.sidebar'),
       hasActivity:!!document.querySelector('aside.right-insights'),
       panelColor:panel?getComputedStyle(panel).backgroundColor:null
     };
   });
   assert.equal(appearance.canvas,expected.base,key+' background');
   assert.equal(appearance.accent,expected.lavender,key+' lavender');
   assert.equal(appearance.lime,expected.lime,key+' lime');
   assert.equal(appearance.line,'#383640',key+' divider');
   assert.ok(appearance.hasRail,key+' has shared rail');
   assert.ok(appearance.hasActivity,key+' has shared activity');
   if(appearance.panelColor)assert.equal(appearance.panelColor,expected.base,key+' panel');
 }
 await page.screenshot({path:path.join(previews,'v6-design-system-desktop.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 await context.close();
});
test('V6: dashboard chart uses real inventory data and lavender/lime series',async()=>{
 const {page,context,errors}=await openPage();
 await page.locator('.side-link[data-nav="dashboard"]').click();
 assert.equal(await page.locator('.stock-chart').count(),1);
 assert.ok((await page.locator('.chart-line').count())>=2);
 const before=await page.locator('.chart-line').count();
 await page.locator('[data-series="free"]').click();
 assert.equal(await page.locator('.chart-line').count(),1);
 assert.equal(await page.locator('[data-series="free"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-series="both"]').click();
 assert.equal(await page.locator('.chart-line').count(),before);
 await page.screenshot({path:path.join(previews,'v6-dashboard-desktop.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 await context.close();
});
test('V6: mobile rail, controls and modal share dark theme',async()=>{
 const {page,context,errors}=await openPage({width:390,height:844});
 await page.locator('[data-action="toggle-menu"]').click();
 assert.match(await page.locator('.sidebar').getAttribute('class'),/open/);
 await page.locator('.sidebar .side-link[data-nav="inventory"]').click();
 await page.locator('[data-action="add-material"]').click();
 const modal=page.locator('.modal');
 assert.equal(await modal.count(),1);
 const c=await modal.evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.equal(c,'rgb(22, 21, 30)');
 await page.screenshot({path:path.join(previews,'v6-mobile-modal.png'),fullPage:true});
 await page.keyboard.press('Escape');
 assert.equal(await modal.count(),0);
 assert.deepEqual(errors,[]);
 await context.close();
});

test('V7: a interface bloqueia frações de peças e aceita quantidades inteiras',async()=>{
  const {page,context,errors}=await openPage();
  await page.locator('[data-nav="inventory"]').click();
  await page.locator('[data-action="add-material"]').click();
  await page.locator('#modal-form [name="sku"]').fill('QA-UN-01');
  await page.locator('#modal-form [name="name"]').fill('Material contado');
  await page.locator('#modal-form [name="category"]').fill('Teste');
  await page.locator('#modal-form [name="unit"]').fill('un');
  await page.locator('#modal-form [name="stock"]').fill('0.5');
  await page.locator('#modal-form [name="min"]').fill('0');
  await page.locator('#modal-form [type="submit"]').click();
  assert.equal(await page.locator('.modal').count(),1);
  assert.match(await page.locator('#toast').textContent(),/inteiras/i);
  await page.locator('#modal-form [name="stock"]').fill('4');
  await page.locator('#modal-form [type="submit"]').click();
  assert.equal(await page.locator('.modal').count(),0);
  await page.locator('[data-nav="reservations"]').click();
  await page.locator('[data-action="new-reservation"]').click();
  await page.locator('#modal-form [name="sku"]').selectOption('QA-UN-01');
  await page.locator('#modal-form [name="qty"]').fill('0.5');
  await page.locator('#modal-form [type="submit"]').click();
  assert.equal(await page.locator('.modal').count(),1);
  assert.match(await page.locator('#toast').textContent(),/inteiras/i);
  await page.locator('#modal-form [name="qty"]').fill('2');
  await page.locator('#modal-form [type="submit"]').click();
  assert.equal(await page.locator('.modal').count(),0);
  assert.deepEqual(errors,[]);
  await context.close();
});
