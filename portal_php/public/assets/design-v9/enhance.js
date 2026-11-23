/* StockControl V9 — progressive visual layer. Preserves V5/V6 domain operations. */
(()=>{
  'use strict';
  const base='./assets/';
  const known=Object.freeze({
    'MAT-001':'metal','MAT-002':'fasteners','MAT-003':'metal','MAT-004':'resin',
    'MAT-005':'bearing','MAT-006':'cables','MAT-007':'electrical','MAT-008':'fasteners'
  });
  const categories=[
    {name:'Elétrico',label:'Elétrico e automação',asset:'electrical',subtitle:'Cabos, conectores e bornes'},
    {name:'Metais',label:'Metais e perfis',asset:'metal',subtitle:'Aço e alumínio'},
    {name:'Fixação',label:'Fixação industrial',asset:'fasteners',subtitle:'Parafusos e porcas'},
    {name:'Peças',label:'Peças mecânicas',asset:'bearing',subtitle:'Rolamentos e conjuntos'}
  ];
  const makeImage=(asset,alt='',eager=false)=>{
    const img=document.createElement('img');
    img.src=base+asset+'.svg';
    img.alt=alt;
    img.loading=eager?'eager':'lazy';
    img.decoding='async';
    return img;
  };
  const tag=(name,className,content)=>{
    const n=document.createElement(name);
    n.className=className;
    if(content!==undefined)n.textContent=content;
    return n;
  };
  const action=(text,destination,className)=>{
    const b=tag('button',className,text);
    b.type='button';
    b.dataset.nav=destination;
    return b;
  };
  function assetFromRow(row){
    const sku=row.querySelector('[data-sku]')?.getAttribute('data-sku');
    if(sku&&known[sku])return known[sku];
    const name=(row.querySelector('.product-cell b')?.textContent||'').toLocaleLowerCase('pt-PT');
    const category=(row.querySelector('td:nth-child(2)')?.textContent||'').toLocaleLowerCase('pt-PT');
    const s=name+' '+category;
    if(/cabo|conector|encoder/.test(s))return'cables';
    if(/elétrico|elétric|bornes|automação|quadro/.test(s))return'electrical';
    if(/aço|alumínio|metal/.test(s))return'metal';
    if(/parafuso|porca|fixação/.test(s))return'fasteners';
    if(/resina|químico/.test(s))return'resin';
    if(/rolamento|peças|peça/.test(s))return'bearing';
    return null;
  }
  function decorateRows(route){
    route.querySelectorAll('.product-cell .product-avatar').forEach(avatar=>{
      if(avatar.dataset.v9Done)return;
      const tr=avatar.closest('tr');
      const asset=tr?assetFromRow(tr):null;
      if(!asset)return;
      avatar.dataset.v9Done='true';
      avatar.classList.add('v9-material-thumbnail');
      avatar.textContent='';
      avatar.append(makeImage(asset,''));
    });
  }
  function dashboardBanner(route){
    const after=route.querySelector('.dashboard-title');
    if(!after||route.querySelector('.v9-visual-banner'))return;
    const section=tag('section','v9-visual-banner');
    section.setAttribute('aria-label','Produção e materiais');
    const info=tag('div','v9-visual-banner-copy');
    info.append(tag('span','v9-visual-kicker','INDÚSTRIA · INVENTÁRIO · PRODUÇÃO'));
    info.append(tag('h2','','Os materiais certos. No momento certo.'));
    info.append(tag('p','','Organiza materiais, acompanha reservas e mantém a produção preparada.'));
    const actions=tag('div','v9-banner-actions');
    actions.append(action('Explorar inventário','inventory','v9-visual-button primary'));
    actions.append(action('Ver movimentos','movements','v9-visual-button subtle'));
    info.append(actions);
    const imageFrame=tag('div','v9-visual-banner-image');
    imageFrame.append(makeImage('warehouse','Ilustração de armazém industrial com prateleiras de materiais',true));
    imageFrame.append(tag('span','v9-art-label','Imagem ilustrativa'));
    section.append(info,imageFrame);
    after.insertAdjacentElement('afterend',section);
  }
  function inventoryCategories(route){
    const stats=route.querySelector('.stats-grid.three');
    if(!stats||route.querySelector('.v9-category-strip'))return;
    const wrap=tag('section','v9-category-strip');
    wrap.setAttribute('aria-label','Filtrar materiais por tipo');
    categories.forEach(c=>{
      const b=tag('button','v9-category-card');
      b.type='button';
      b.dataset.category=c.name;
      b.setAttribute('aria-label','Mostrar categoria '+c.name);
      const copy=tag('span','v9-category-copy');
      copy.append(tag('strong','',c.label));
      copy.append(tag('small','',c.subtitle));
      b.append(copy);
      const thumb=tag('span','v9-category-image');
      thumb.append(makeImage(c.asset,''));
      b.append(thumb);
      wrap.append(b);
    });
    stats.before(wrap);
  }
  function websiteVisual(route){
    const panel=route.querySelector('.web-preview');
    if(panel&&!panel.querySelector('.v9-website-visual')){
      const figure=tag('div','v9-website-visual');
      figure.append(makeImage('warehouse','Ilustração de armazém com material organizado',true));
      figure.append(tag('span','v9-art-label','Ilustração industrial'));
      panel.prepend(figure);
    }
    const assets=['electrical','metal','bearing'];
    route.querySelectorAll('.feature-card').forEach((card,i)=>{
      if(card.querySelector('.v9-feature-visual')||!assets[i])return;
      const fig=tag('div','v9-feature-visual');
      fig.append(makeImage(assets[i],''));
      card.prepend(fig);
    });
  }
  function visualNumbers(route){
    // Compact illustrative imagery next to alerts. Do not change computed stock figures.
    if(!route.classList.contains('dashboard-page')&&!route.querySelector('.dashboard-page'))return;
    route.querySelectorAll('.dashboard-alert-table tbody tr').forEach(row=>{
      const sku=row.querySelector('td:nth-child(3)')?.textContent?.trim();
      const asset=known[sku];
      const cell=row.querySelector('td:nth-child(2)');
      if(!asset||!cell||cell.querySelector('.v9-alert-thumb'))return;
      const img=makeImage(asset,'');
      img.className='v9-alert-thumb';
      cell.prepend(img);
      cell.classList.add('v9-alert-name');
    });
  }
  function decorate(){
    const route=document.querySelector('#app .route-view');
    if(!route)return;
    decorateRows(route);
    const page=route.getAttribute('data-route');
    if(page==='dashboard'){dashboardBanner(route);visualNumbers(route)}
    if(page==='inventory')inventoryCategories(route);
    if(page==='website')websiteVisual(route);
  }
  let pending=false;
  function schedule(){
    if(pending)return;
    pending=true;
    queueMicrotask(()=>{pending=false;decorate()});
  }
  const host=document.getElementById('app');
  if(!host)return;
  const observer=new MutationObserver(schedule);
  observer.observe(host,{subtree:true,childList:true});
  schedule();
})();
