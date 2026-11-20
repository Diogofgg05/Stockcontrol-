'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../portal_php/public/assets/design-v5');
const css=fs.readFileSync(path.join(root,'reference-theme.css'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const bundle=fs.readFileSync(path.join(root,'app.js'),'utf8');
const prompt=fs.readFileSync(path.join(root,'DESIGN_PROMPT_REFERENCE.md'),'utf8');
test('the screenshot palette is defined once in canonical tokens',()=>{
  const colors={
    '--sc-backdrop':'#B4C8F6',
    '--sc-bg':'#16151E',
    '--sc-bg-deep':'#13121A',
    '--sc-surface':'#201F29',
    '--sc-line':'#383640',
    '--sc-text':'#F7F5FB',
    '--sc-lavender':'#C9BCFF',
    '--sc-lime':'#D8F574'
  };
  for(const [token,hex] of Object.entries(colors)){
    const rx=new RegExp(token.replace(/[-]/g,'\\-')+'\\s*:\\s*'+hex,'i');
    assert.match(css,rx,token+' missing');
    assert.match(prompt,new RegExp(token+'\\s*:\\s*'+hex,'i'));
  }
});
test('theme sheet is always included after the base stylesheet',()=>{
  const a=index.indexOf('href="./styles.css"');
  const b=index.indexOf('href="./reference-theme.css"');
  assert.ok(a>=0&&b>a);
  assert.match(index,/StockControl V6 — Reference Dark/);
});
test('all common UI classes have one reference theme implementation',()=>{
  for(const selector of ['.app-shell','.sidebar','.header','.right-insights','.panel','.stat-card',
      '.table-wrap','.btn.primary','.btn.secondary','.modal','.pill.good','.filter-btn','.field',
      '.stock-chart','.risk-bars','.stock-donut','.swatch-grid']){
    assert.ok(css.includes(selector),'Missing shared primitive: '+selector);
  }
});
test('shared rail and activity panel are rendered once in layout',()=>{
  assert.ok(bundle.includes('class="body-columns"'));
  assert.ok(bundle.includes('activityAside()'));
  assert.ok(bundle.includes('function componentCatalog()'));
  assert.ok(bundle.includes('design:componentCatalog'));
});
test('all graph data derives from materials and not randomized placeholders',()=>{
  assert.ok(bundle.includes('function stockTrendChart()'));
  assert.ok(bundle.includes('stockView.availableBySku'));
  assert.ok(bundle.includes('function stockDonut()'));
  assert.ok(!bundle.includes('Math.random()*100'));
});
test('all dynamic charts use accessible text or title',()=>{
  assert.match(bundle,/class="stock-chart"[^>]+role="img"/);
  assert.match(bundle,/class="stock-donut"[^>]+role="img"/);
  assert.match(bundle,/data-series="both"/);
});
test('builder remains reproducible and includes visuals before pages',()=>{
 const builder=fs.readFileSync(path.join(root,'tools/build.cjs'),'utf8');
 assert.ok(builder.indexOf("'25-reference-visuals'")>builder.indexOf("'20-ui-shell'"));
 assert.ok(builder.indexOf("'25-reference-visuals'")<builder.indexOf("'30-inventory-operations'"));
});
