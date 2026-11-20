(function stockApp(){
  'use strict';
  const M=window.StockModel;
  const STORE='stockcontrol:v5:offline:v1';
  const OLD_STORE='stockcontrol:v4:demo:v1';
  const titles={dashboard:'Visão geral',inventory:'Inventário',movements:'Movimentos',reservations:'Reservas',counts:'Inventário físico',documents:'Documentos',reports:'Relatórios',team:'Equipa e permissões',settings:'Definições',billing:'Planos',website:'Website'};
  const menuGroups=[
    {label:'OPERAÇÕES',links:[['dashboard','layout-dashboard'],['inventory','package'],['movements','arrow-left-right'],['reservations','layers'],['counts','clipboard-check']]},
    {label:'GESTÃO',links:[['documents','file-text'],['reports','chart-no-axes-combined'],['team','users']]},
    {label:'CONTA',links:[['settings','settings'],['billing','credit-card'],['website','globe']]}
  ];
  const icons={
    'layout-dashboard':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    'package':'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10"/>',
    'arrow-left-right':'<path d="M8 3 4 7l4 4M4 7h16m-4 14 4-4-4-4m4 4H4"/>',
    'layers':'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    'clipboard-check':'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5V2h6v2.5M9 14l2 2 4-4"/>',
    'file-text':'<path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm9 0v6h5M9 13h8M9 17h8"/>',
    'chart-no-axes-combined':'<path d="m3 17 6-6 4 3 8-9M16 5h5v5M4 21V3"/>',
    'users':'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2c0-3 2-5 6-5s6 2 6 5v2M17 5a3 3 0 0 1 0 6m0 2c3 0 4 2 4 5v2"/>',
    'settings':'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    'credit-card':'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20m-15 5h5"/>',
    'globe':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c4 4 4 14 0 18M12 3c-4 4-4 14 0 18"/>',
    'plus':'<path d="M12 5v14M5 12h14"/>','search':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    'bell':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    'chevron-down':'<path d="m6 9 6 6 6-6"/>','chevron-right':'<path d="m9 6 6 6-6 6"/>',
    'download':'<path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/>',
    'menu':'<path d="M3 6h18M3 12h18M3 18h18"/>','x':'<path d="M5 5l14 14M19 5 5 19"/>',
    'shield-check':'<path d="m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6l8-4Z"/><path d="m8 12 3 3 5-6"/>',
    'check':'<path d="m5 12 4 4L19 6"/>','alert-triangle':'<path d="m12 3 10 18H2L12 3ZM12 9v5m0 3v.5"/>',
    'rotate-ccw':'<path d="M3 12a9 9 0 1 0 3-7M3 4v5h5"/>','arrow-up-right':'<path d="M6 18 18 6m-9 0h9v9"/>',
    'arrow-down-right':'<path d="m6 6 12 12m-9 0h9V9"/>','clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'filter':'<path d="M4 7h16M7 12h10m-7 5h4"/>',
    'info':'<circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-9v.5"/>',
    'more-horizontal':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    'hard-drive':'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 15h.01M11 15h.01"/>',
    'upload-cloud':'<path d="M7 18a5 5 0 0 1-.2-10A7 7 0 0 1 20 10a4 4 0 0 1-1 8M12 20V11m-4 4 4-4 4 4"/>',
    'box':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18m-9-5v5"/>'
  };
  const icon=(n,size=18)=>`<svg class="sc-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n]||icons.package}</svg>`;
  const E=M.escapeHTML;
  const num=n=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:3}).format(n);
  const money=n=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(n);
  const day=s=>{const d=new Date(s);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-PT',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})};
  const now=()=>new Date().toISOString();
  const uuid=prefix=>prefix+'-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
  // Modulos ordenados: gerar app.js com tools/build.cjs.
  let persistedRaw=null;
  function load(){
    try{
      const raw=localStorage.getItem(STORE);
      persistedRaw=raw;
      if(!raw){
        const legacy=localStorage.getItem(OLD_STORE);
        if(!legacy)return M.demo();
        const previous=JSON.parse(legacy);
        return M.validateWorkspace(previous)?{...M.demo(),...previous,users:M.demo().users}:M.demo();
      }
      const parsed=JSON.parse(raw);
      if(!M.validateWorkspace(parsed))return M.demo();
      return {...M.demo(),...parsed,users:M.demo().users};
    }catch{return M.demo()}
  }
  let workspace=load();
  let current='dashboard',role='Administrador',search='',category='Todos',movementFilter='Todos',mobileMenu=false;
  let inventorySort='sku',inventoryPage=1;
  const PAGE_SIZE=8;
  let modalReturnFocus=null;
  let stockView=M.inventoryView(workspace);
  const host=document.getElementById('app');
  function save(){
    if(!M.validateWorkspace(workspace))throw Error('Os dados não passaram na validação de integridade.');
    try{
      const existing=localStorage.getItem(STORE);
      if(existing!==persistedRaw){
        const error=Error('Os dados foram alterados noutra aba. O formulário foi cancelado e o inventário atualizado.');
        error.code='CONCURRENT_CHANGE';
        throw error;
      }
      const serialized=JSON.stringify(workspace);
      localStorage.setItem(STORE,serialized);
      persistedRaw=serialized;
      return true;
    }catch(error){
      if(error.code==='CONCURRENT_CHANGE')throw error;
      return false; // A aplicação continua utilizável, mas somente em memória desta aba.
    }
  }
  function saveFeedback(saved,success='Alteração de demonstração registada.'){
    toast(saved?success:'Alteração válida apenas nesta sessão: armazenamento local indisponível.',saved?'ok':'error');
  }
  function recover(error,before){
    workspace=before;
    if(error.code==='CONCURRENT_CHANGE'){
      workspace=load();closeModal();render();
    }
    toast(error.message||'Não foi possível validar os dados.','error');
  }
  function toast(message,type='ok'){
    const h=document.getElementById('toast');
    h.textContent=message;h.dataset.type=type;h.classList.add('visible');
    clearTimeout(toast.t);toast.t=setTimeout(()=>h.classList.remove('visible'),4000);
  }
  function downloadBackup(){
    try{
      const json=window.StockBackup.exportBackup(workspace,M);
      const blob=new Blob([json],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='stockcontrol-backup-'+new Date().toISOString().slice(0,10)+'.json';
      a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast('Backup JSON validado e exportado.');
    }catch(error){toast(error.message,'error')}
  }
  async function restoreBackup(file){
    if(!file||!checkRole('manage'))return;
    try{
      if(file.size>window.StockBackup.LIMIT)throw Error('Backup excede 8 MB.');
      const parsed=window.StockBackup.parseBackup(await file.text(),M);
      if(!confirm('Substituir todos os dados locais desta V5 pelo backup selecionado? Esta operação não pode ser desfeita sem um backup anterior.'))return;
      const before=JSON.parse(JSON.stringify(workspace));
      try{
        workspace=parsed;
        const saved=save();
        if(!saved)throw Error('Falha ao guardar o backup. Verifica o armazenamento local.');
        current='dashboard';search='';category='Todos';inventoryPage=1;
        render();toast('Backup restaurado e verificado.');
      }catch(error){recover(error,before)}
    }catch(error){toast(error.message||'Backup inválido.','error')}
  }
  const getMat=sku=>workspace.materials.find(m=>m.sku===sku);
  const can=action=>role==='Administrador'||(role==='Operador'&&['move','reserve','count','document'].includes(action));
  function checkRole(action){if(!can(action)){toast('Esta ação não é permitida no papel de demonstração '+role+'.','error');return false}return true}
  function eventLog(action){workspace.events.unshift({id:uuid('EV'),action,actor:role+' (demo)',createdAt:now()});workspace.events=workspace.events.slice(0,100)}
  function button(text,action,extra='',disabled=false){return `<button type="button" class="btn ${extra}" data-action="${action}" ${disabled?'disabled':''}>${text}</button>`}
  const pill=status=>`<span class="pill ${status==='Disponível'||status==='Aplicada'||status==='Ativa'||status==='Concluída'?'good':status==='Esgotado'||status==='Cancelada'||status==='Sem disponibilidade'?'bad':'warning'}">${E(status)}</span>`;
  function sidebar(){
    return `<aside class="sidebar ${mobileMenu?'open':''}" aria-label="Menu principal">
      <div class="brand"><div class="brand-logo">${icon('box',24)}</div><div><strong>stockcontrol<span>.</span></strong><small>WORKSPACE INDUSTRIAL</small></div><button class="sidebar-x" data-action="close-menu" aria-label="Fechar menu">${icon('x')}</button></div>
      <div class="workspace-switch"><div class="workspace-avatar">F</div><div><strong>Fábrica Demo</strong><small>Ambiente local · ficção</small></div>${icon('chevron-down',16)}</div>
      <div class="side-links">${menuGroups.map(group=>`<div class="side-group"><span class="side-label">${group.label}</span>${group.links.map(([key,ic])=>`<button data-nav="${key}" class="side-link ${current===key?'active':''}" ${current===key?'aria-current="page"':''}>${icon(ic)}<span>${E(titles[key])}</span>${key==='inventory'&&stockView.low+stockView.out+stockView.blocked>0?`<b class="side-count">${stockView.low+stockView.out+stockView.blocked}</b>`:''}</button>`).join('')}</div>`).join('')}</div>
      <div class="sidebar-bottom"><div class="side-note">${icon('shield-check',20)}<strong>Ambiente de demonstração</strong><span>Sem ligação à base de dados ou API real.</span></div><button class="side-account" data-nav="settings"><span class="avatar">DM</span><span><b>Equipa de demonstração</b><small>Papel: ${E(role)}</small></span>${icon('chevron-right',16)}</button></div>
    </aside>`;
  }
  function header(){
    const alerts=workspace.materials.filter(m=>stockView.statusBySku.get(m.sku)!=='Disponível');
    return `<header class="header"><div class="header-left"><button class="icon-btn hamburger" data-action="toggle-menu" aria-label="Abrir menu">${icon('menu')}</button><span class="crumb">Workspace</span>${icon('chevron-right',15)}<strong>${E(titles[current])}</strong></div><div class="header-actions"><div class="top-search">${icon('search',17)}<input id="global-search" placeholder="Pesquisar materiais...  ⌘K" aria-label="Pesquisa global" value="${E(search)}"></div><button type="button" class="icon-btn mobile-search" data-action="go-inventory-search" aria-label="Pesquisar inventário">${icon('search',19)}</button><button class="icon-btn notification" data-action="notifications" aria-label="Ver alertas">${icon('bell',19)}${alerts.length?'<i></i>':''}</button><div class="header-user"><span class="avatar">DM</span><span class="header-name">Demo</span></div></div></header>`;
  }
  function pageHeader(eyebrow,title,subtitle,actions=''){
    return `<div class="page-head"><div><span class="eyebrow">${E(eyebrow)}</span><h1>${E(title)}</h1><p>${E(subtitle)}</p></div>${actions?`<div class="page-actions">${actions}</div>`:''}</div>`;
  }
  function stat(title,value,detail,ic,accent='blue'){
    return `<article class="stat-card"><div class="stat-top"><span>${E(title)}</span><span class="stat-ico ${accent}">${icon(ic,20)}</span></div><strong>${value}</strong><small>${E(detail)}</small></article>`;
  }
  function empty(title,description,ic='package'){return `<div class="empty">${icon(ic,28)}<b>${E(title)}</b><span>${E(description)}</span></div>`}
  function table(head,body){return `<div class="table-wrap"><table><thead><tr>${head.map(h=>`<th>${E(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`}
  function matLabel(m){return `<div class="product-cell"><div class="product-avatar">${E(m.name.slice(0,2).toUpperCase())}</div><div><b>${E(m.name)}</b><small>${E(m.sku)} · ${E(m.location||'Sem localização')}</small></div></div>`}
  function inventoryRow(m){
    return `<tr><td>${matLabel(m)}</td><td>${E(m.category)}</td><td class="text-right"><b>${num(m.stock)} ${E(m.unit)}</b></td><td class="text-right">${num(stockView.availableBySku.get(m.sku))} ${E(m.unit)}</td><td>${pill(stockView.statusBySku.get(m.sku))}</td><td class="text-right"><button class="table-action" data-action="detail" data-sku="${E(m.sku)}" aria-label="Ver ${E(m.name)}">${icon('chevron-right',18)}</button></td></tr>`;
  }
  const lows=()=>workspace.materials.filter(m=>stockView.statusBySku.get(m.sku)!=='Disponível').sort((a,b)=>(stockView.availableBySku.get(a.sku)-stockView.availableBySku.get(b.sku)));
  function dashboard(){
    const s=stockView;
    const recent=workspace.movements.slice(0,5);
    const alerts=lows().slice(0,5);
    const attention=alerts.length?alerts.map(m=>`<div class="attention-item"><div class="attention-ico">${icon('alert-triangle',17)}</div><span><b>${E(m.name)}</b><small>${E(m.sku)} · disponíveis ${num(stockView.availableBySku.get(m.sku))} / mín. ${num(m.min)} ${E(m.unit)}</small></span>${pill(stockView.statusBySku.get(m.sku))}</div>`).join(''):empty('Sem alertas','Todos os materiais acima do mínimo.');
    return `${pageHeader('CENTRO DE OPERAÇÕES','Bom dia, equipa','Uma visão consolidada da operação — dados locais de demonstração.',button(`${icon('download')} Exportar inventário`,'export-inventory','secondary')+button(`${icon('plus')} Novo movimento`,'new-movement','primary'))}
      <div class="section-caption"><b>RESUMO DA OPERAÇÃO</b><span>Valores calculados a partir dos ${s.total} materiais desta demo</span></div>
      <div class="stats-grid">${stat('Referências registadas',num(s.total),'Materiais no catálogo','package')}${stat('Stock baixo',num(s.low),'Disponível abaixo do mínimo','alert-triangle','amber')}${stat('Sem disponibilidade',num(s.out+s.blocked),'Esgotados ou totalmente reservados','box','rose')}${stat('Reservas ativas',num(s.active),'Quantidade alocada a ordens','layers','violet')}</div>
      <div class="two-col"><section class="panel"><div class="panel-head"><div><h2>Materiais que precisam de atenção</h2><p>Prioridade de reposição</p></div>${button('Abrir inventário','go-inventory','plain')}</div><div class="attention-list">${attention}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Atividade recente</h2><p>Histórico local desta demonstração</p></div>${icon('clock')}</div><div class="activity-list">${recent.length?recent.map(m=>`<div class="activity-item"><span class="activity-ico ${m.type==='Saída'?'amber':'green'}">${icon(m.type==='Saída'?'arrow-down-right':'arrow-up-right',19)}</span><div><b>${E(m.type)} · ${E(getMat(m.sku)?.name||m.sku)}</b><small>${num(m.qty)} ${E(getMat(m.sku)?.unit||'')} · ${E(m.actor)}</small></div><time>${day(m.createdAt)}</time></div>`).join(''):empty('Sem movimentos','Regista a primeira entrada ou saída.','arrow-left-right')}</div></section></div>
      <section class="panel"><div class="panel-head"><div><h2>Catálogo de materiais</h2><p>Referências mais relevantes para acompanhar</p></div>${button('Ver todos','go-inventory','secondary small')}</div>${table(['Material','Categoria','Stock atual','Disponível','Estado',''],workspace.materials.slice(0,5).map(inventoryRow).join(''))}</section>`;
  }
  function inventory(){
    const s=stockView;
    const cats=['Todos',...new Set(workspace.materials.map(m=>m.category))];
    const rows=workspace.materials.filter(m=>(category==='Todos'||category===m.category)&&[m.name,m.sku,m.category,m.location].join(' ').toLowerCase().includes(search.toLowerCase()));
    rows.sort((a,b)=>{
      if(inventorySort==='name')return a.name.localeCompare(b.name,'pt');
      if(inventorySort==='stock')return a.stock-b.stock||a.sku.localeCompare(b.sku);
      if(inventorySort==='available')return stockView.availableBySku.get(a.sku)-stockView.availableBySku.get(b.sku)||a.sku.localeCompare(b.sku);
      return a.sku.localeCompare(b.sku);
    });
    const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    inventoryPage=Math.min(pages,Math.max(1,inventoryPage));
    const visible=rows.slice((inventoryPage-1)*PAGE_SIZE,inventoryPage*PAGE_SIZE);
    return `${pageHeader('MATERIAIS E ARMAZÉM','Inventário','Pesquisa, níveis mínimos, disponibilidade real após reservas e localização.',button(`${icon('download')} CSV`,'export-inventory','secondary')+button(`${icon('plus')} Adicionar material`,'add-material','primary'))}
      <div class="stats-grid three">${stat('Materiais',num(s.total),'Referências totais','package')}${stat('Em atenção',num(s.low+s.out+s.blocked),'Baixo, esgotado ou reservado','alert-triangle','amber')}${stat('Valor indicativo',money(s.worth),'Preços de exemplo','chart-no-axes-combined','violet')}</div>
      <section class="panel"><div class="panel-head"><div><h2>Lista de materiais <span class="count">${rows.length}</span></h2><p>Os dados desta versão permanecem apenas neste navegador.</p></div><div class="inline-search">${icon('search',17)}<input id="inventory-search" placeholder="Nome, SKU, localização..." aria-label="Filtrar inventário" value="${E(search)}"></div><select id="inventory-sort" aria-label="Ordenar inventário"><option value="sku">Código SKU</option><option value="name">Nome A–Z</option><option value="stock">Menor stock físico</option><option value="available">Menor stock livre</option></select></div>
      <div class="filters">${cats.map(c=>`<button data-category="${E(c)}" class="filter-btn ${category===c?'active':''}">${E(c)}</button>`).join('')}</div>
      ${rows.length?table(['Material','Categoria','Stock atual','Disponível','Estado',''],visible.map(inventoryRow).join('')):empty('Sem resultados','Altera o termo de pesquisa ou os filtros.','search')}
      <div class="pager"><span>A mostrar ${visible.length} de ${rows.length} referências filtradas</span><div class="pager-controls"><button type="button" data-action="prev-inventory" ${inventoryPage<=1?'disabled':''}>Anterior</button><span>Página ${inventoryPage} / ${pages}</span><button type="button" data-action="next-inventory" ${inventoryPage>=pages?'disabled':''}>Seguinte</button></div></div></section>`;
  }
  function movements(){
    const rows=workspace.movements.filter(m=>movementFilter==='Todos'||m.type===movementFilter);
    return `${pageHeader('RASTREABILIDADE','Movimentos','Entradas, saídas e devoluções com validação do stock disponível.',button(`${icon('download')} Exportar CSV`,'export-movements','secondary')+button(`${icon('plus')} Novo movimento`,'new-movement','primary'))}
      <section class="panel"><div class="panel-head"><div><h2>Histórico de movimentos</h2><p>Registos locais não sincronizados</p></div><div class="filters inline">${['Todos','Entrada','Saída','Devolução','Ajuste','Consumo'].map(c=>`<button data-movfilter="${c}" class="filter-btn ${movementFilter===c?'active':''}">${c}</button>`).join('')}</div></div>${rows.length?table(['Referência','Material','Tipo','Quantidade','Data','Responsável'],rows.map(r=>`<tr><td><b>${E(r.id)}</b></td><td>${E(getMat(r.sku)?.name||r.sku)}</td><td><span class="movement-type ${r.type==='Saída'||r.type==='Consumo'||r.type==='Ajuste'&&r.delta<0?'outflow':'inflow'}">${icon(r.type==='Saída'||r.type==='Consumo'||r.type==='Ajuste'&&r.delta<0?'arrow-down-right':'arrow-up-right',14)} ${E(r.type)}</span></td><td>${r.type==='Ajuste'&&r.delta>0?'+':''}${num(r.type==='Ajuste'||r.type==='Consumo'?r.delta:r.qty)} ${E(getMat(r.sku)?.unit||'')}</td><td>${day(r.createdAt)}</td><td>${E(r.actor)}</td></tr>`).join('')):empty('Sem movimentos','Começa por registar uma entrada ou saída.','arrow-left-right')}</section>`;
  }
  function reservations(){
    const rows=workspace.reservations;
    return `${pageHeader('PLANEAMENTO DE PRODUÇÃO','Reservas','Reserva materiais, regista consumos parciais e acompanha os saldos por ordem.',button(`${icon('plus')} Criar reserva`,'new-reservation','primary'))}
      <section class="panel"><div class="panel-head"><div><h2>Reservas registadas</h2><p>Consumos descontam stock físico e saldo reservado na mesma operação local.</p></div></div>
      ${rows.length?table(['Reserva','Ordem','Material','Reservado','Consumido','Por consumir','Estado','Ação'],rows.map(r=>`<tr><td><b>${E(r.id)}</b></td><td>${E(r.order)}</td><td>${E(getMat(r.sku)?.name||r.sku)}</td><td>${num(r.qty)} ${E(getMat(r.sku)?.unit||'')}</td><td>${num(r.consumed??0)}</td><td>${num(M.reservationRemaining(r))}</td><td>${pill(r.status)}</td><td>${r.status==='Ativa'?`<div class="row-actions"><button class="link-action" data-action="consume-reservation" data-id="${E(r.id)}">Consumir</button><button class="link-action danger" data-action="cancel-reservation" data-id="${E(r.id)}">Cancelar saldo</button></div>`:'—'}</td></tr>`).join('')):empty('Sem reservas','Cria uma reserva para uma ordem de produção.','layers')}</section>`;
  }
  function counts(){
    const rows=workspace.counts;
    return `${pageHeader('CONFERÊNCIA DE ARMAZÉM','Inventário físico','Regista contagens e aprova acertos com proteção contra alterações entretanto ocorridas.',button(`${icon('plus')} Nova contagem`,'new-count','primary'))}
      <div class="notice">${icon('info',18)} <span>A aprovação é uma simulação local. Numa aplicação real, as permissões e o bloqueio contra concorrência devem ser aplicados na API.</span></div>
      <section class="panel"><div class="panel-head"><div><h2>Contagens</h2><p>Fluxo: Registada → Aplicada ou Rejeitada</p></div></div>
      ${rows.length?table(['Registo','Material','Stock inicial','Contado','Diferença','Estado','Ações'],rows.map(r=>`<tr><td><b>${E(r.id)}</b><small class="small-block">${day(r.createdAt)}</small></td><td>${E(getMat(r.sku)?.name||r.sku)}</td><td>${num(r.expected)}</td><td>${num(r.counted)}</td><td>${num(r.counted-r.expected)}</td><td>${pill(r.status)}</td><td>${r.status==='Pendente'?`<div class="row-actions"><button class="link-action" data-action="approve-count" data-id="${E(r.id)}">Aprovar</button><button class="link-action danger" data-action="reject-count" data-id="${E(r.id)}">Rejeitar</button></div>`:'—'}</td></tr>`).join('')):empty('Sem contagens','Regista uma contagem para comparar com o stock teórico.','clipboard-check')}</section>`;
  }
  function documents(){
    const rows=workspace.documents;
    return `${pageHeader('FICHEIROS E COMPROVATIVOS','Documentos','Zona de demonstração para anexos, fichas técnicas e guias.',button(`${icon('upload-cloud')} Registar ficheiro`,'new-document','primary'))}
      <div class="notice">${icon('info',18)} <span>Nesta versão os ficheiros não são enviados nem guardados: apenas o nome e metadados são adicionados à lista local. Não é armazenamento de documentos.</span></div>
      <section class="panel"><div class="panel-head"><div><h2>Ficheiros associados</h2><p>Pré-visualização do fluxo de documentos</p></div></div>
      ${rows.length?table(['Ficheiro','Categoria','Dimensão','Material associado','Adicionado'],rows.map(r=>`<tr><td><b>${E(r.name)}</b></td><td>${E(r.category)}</td><td>${num(r.sizeKb)} KB</td><td>${E(getMat(r.sku)?.name||'Geral')}</td><td>${day(r.createdAt)}</td></tr>`).join('')):empty('Nenhum documento','Anexa um ficheiro para testar a interface.','file-text')}</section>`;
  }
  function reports(){
    const s=stockView;
    const counts=[...new Set(workspace.materials.map(m=>m.category))].map(c=>({category:c,total:workspace.materials.filter(m=>m.category===c).length,value:workspace.materials.filter(m=>m.category===c).reduce((n,m)=>n+m.stock*Number(m.cost||0),0)}));
    const max=Math.max(1,...counts.map(c=>c.value));
    return `${pageHeader('DADOS E ANÁLISE','Relatórios','Indicadores derivados dos materiais de demonstração, sem métricas inventadas.',button(`${icon('download')} Exportar stock`,'export-inventory','secondary')+button(`${icon('download')} Movimentos`,'export-movements','primary'))}
      <div class="stats-grid three">${stat('Valor de stock',money(s.worth),'Custos unitários fictícios','chart-no-axes-combined','violet')}${stat('Materiais disponíveis',num(s.total-s.low-s.out-s.blocked),'Disponibilidade acima do mínimo','check','green')}${stat('Movimentos registados',num(workspace.movements.length),'Histórico de demonstração','arrow-left-right')}</div>
      <div class="two-col"><section class="panel"><div class="panel-head"><div><h2>Valor por categoria</h2><p>Estimativa ilustrativa em euros</p></div></div><div class="chart-rows">${counts.map(c=>`<div class="bar-row"><div class="bar-label"><b>${E(c.category)}</b><span>${money(c.value)}</span></div><div class="bar-track"><span style="width:${(100*c.value/max).toFixed(1)}%"></span></div></div>`).join('')}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Auditoria de demonstração</h2><p>Últimas ações no navegador</p></div></div><div class="audit-list">${workspace.events.slice(0,8).map(e=>`<div class="audit-row"><span>${icon('clock',16)}</span><div><b>${E(e.action)}</b><small>${E(e.actor)}</small></div><time>${day(e.createdAt)}</time></div>`).join('')}</div></section></div>`;
  }
  function team(){
    return `${pageHeader('PESSOAS E ACESSOS','Equipa e permissões','Visualiza papéis antes de integrares autenticação e políticas reais.')}
      <div class="notice">${icon('shield-check',18)} <span>O seletor de papéis serve apenas para pré-visualização. Não fornece autenticação ou autorização de segurança.</span></div>
      <section class="panel"><div class="panel-head"><div><h2>Equipa de exemplo</h2><p>Contas fictícias — sem convites ou emails reais</p></div></div>
      ${table(['Utilizador','Papel','Estado'],workspace.users.map(u=>`<tr><td><b>${E(u.name)}</b></td><td>${E(u.role)}</td><td>${pill(u.state==='Ativo'?'Ativa':u.state)}</td></tr>`).join(''))}</section>
      <section class="panel permission-panel"><div class="panel-head"><div><h2>Matriz de permissões planeada</h2><p>Tem de ser validada no backend para cada empresa</p></div></div>
      ${table(['Operação','Administrador','Operador','Auditor'],[['Ver materiais','✓','✓','✓'],['Movimentos','✓','✓','—'],['Reservas','✓','✓','—'],['Contagens físicas','✓','✓','—'],['Aprovar acertos','✓','—','—'],['Gestão de utilizadores','✓','—','—'],['Configurações','✓','—','—']].map(r=>`<tr>${r.map((c,i)=>`<td class="${i===0?'weight-bold':''}">${E(c)}</td>`).join('')}</tr>`).join(''))}</section>`;
  }
  function settings(){
    return `${pageHeader('PERSONALIZAÇÃO','Definições','Controlo do ambiente local e do papel de pré-visualização.')}
      <div class="two-col"><section class="panel"><div class="panel-head"><div><h2>Papel de demonstração</h2><p>Experimenta diferentes vistas e limites na interface</p></div></div><div class="settings-section"><label for="demo-role">Papel ativo</label><select id="demo-role" class="field">${['Administrador','Operador','Auditor'].map(r=>`<option ${r===role?'selected':''}>${r}</option>`).join('')}</select><p>O controlo é apenas visual; nunca substitui validações do servidor.</p></div></section>
      <section class="panel"><div class="panel-head"><div><h2>Repor demonstração</h2><p>Reverter movimentos, reservas, contagens e materiais deste navegador</p></div></div><div class="settings-section"><p>Os dados de exemplo ficam em armazenamento local (localStorage). Não são sincronizados.</p>${button(`${icon('rotate-ccw')} Repor dados fictícios`,'reset-demo','danger-outline')}</div></section></div>
      <section class="panel"><div class="panel-head"><div><h2>Dados offline e backups</h2><p>Gestão autónoma no navegador sem API nem base de dados remota</p></div></div>
      <div class="settings-section"><div class="data-actions">${button('Exportar backup JSON','backup-export','primary')}${button('Restaurar JSON','backup-import','secondary',!can('manage'))}</div>
      <input id="backup-input" type="file" accept=".json,application/json" hidden><p class="backup-note">Backup sem encriptação: guarda o ficheiro num local seguro. O restauro substitui os dados atuais mediante confirmação.</p></div></section>`;
  }
  function billing(){
    return `${pageHeader('SUBSCRIÇÃO','Plano e faturação','Estrutura para futura integração Stripe, sem cobranças de demonstração.')}
      <div class="notice">${icon('info',18)} <span>Não existe checkout, trial ou faturação ativa neste protótipo. Liga o backend e os webhooks verificados antes de aceitar pagamentos.</span></div>
      <section class="panel subscription"><div class="plan-icon">${icon('credit-card',24)}</div><div><span class="eyebrow">ESTADO DA SUBSCRIÇÃO</span><h2>Sem plano associado</h2><p>O plano só poderá ser consultado na aplicação autenticada e ligado ao Stripe.</p></div><span class="tag">DEMO</span></section>
      <div class="two-col"><section class="panel plan-option"><span class="eyebrow">GESTÃO</span><h2>Mensal</h2><p>Flexibilidade para pequenas equipas e operações em crescimento.</p><strong>Preço por definir</strong>${button('Checkout indisponível','no-checkout','secondary')}</section><section class="panel plan-option"><span class="eyebrow">CONTINUIDADE</span><h2>Anual</h2><p>Planeamento de longo prazo com histórico e rastreabilidade.</p><strong>Preço por definir</strong>${button('Checkout indisponível','no-checkout','secondary')}</section></div>`;
  }
  function website(){
    return `<div class="web-hero"><div><span class="eyebrow">STOCKCONTROL · PLATAFORMA PARA EQUIPAS DE PRODUÇÃO</span><h1>O teu inventário.<br><em>Sob controlo.</em></h1><p>Materiais, reservas, movimentos, contagens e relatórios num único espaço organizado. Uma experiência moderna, pensada para a fábrica.</p><div class="web-buttons">${button('Explorar workspace','go-dashboard','primary')}${button('Ver inventário','go-inventory','secondary')}</div><span class="web-disclaimer">Pré-visualização local, sem autenticação nem operações reais</span></div><div class="web-preview"><div class="preview-kicker">Visão geral <span class="tag">DEMO</span></div><div class="web-card-grid"><div><span>Referências</span><strong>${M.summary(workspace).total}</strong></div><div><span>Reservas ativas</span><strong>${M.summary(workspace).active}</strong></div></div><div class="mock-chart"><span style="height:54%"></span><span style="height:76%"></span><span style="height:61%"></span><span style="height:92%"></span><span style="height:81%"></span><span style="height:100%"></span><span style="height:73%"></span></div></div></div><div class="feature-grid">${[['package','Inventário','Stock, mínimos, categorias e localizações.'],['layers','Planeamento','Reservas ligadas a ordens de produção.'],['clipboard-check','Rastreabilidade','Contagens, aprovações e histórico de operações.']].map(([i,t,d])=>`<article class="feature-card">${icon(i,24)}<h3>${t}</h3><p>${d}</p></article>`).join('')}</div>`;
  }
  const pages={dashboard,inventory,movements,reservations,counts,documents,reports,team,settings,billing,website};
  function render(){
    stockView=M.inventoryView(workspace);
    host.innerHTML=`<div class="app-shell">${sidebar()}<div class="app-body">${header()}<main id="main-content" tabindex="-1">${pages[current]() }<footer class="footer">${icon('shield-check',16)} StockControl V5 Offline · Dados locais no navegador · Sem API ou pagamentos reais</footer></main></div></div>${mobileMenu?'<button class="backdrop" data-action="close-menu" aria-label="Fechar menu"></button>':''}`;
    const sortControl=document.getElementById('inventory-sort');
    if(sortControl)sortControl.value=inventorySort;
  }
  function navigate(page){
    if(!pages[page])return;
    current=page;mobileMenu=false;search='';category='Todos';inventoryPage=1;
    if(location.hash.slice(1)!==page)history.replaceState(null,'','#'+page);
    render();
    window.scrollTo({top:0,behavior:'auto'});
  }
  function closeModal(){
    document.getElementById('modal-host').replaceChildren();
    host.inert=false;
    document.body.classList.remove('modal-open');
    if(modalReturnFocus?.isConnected)modalReturnFocus.focus();
    modalReturnFocus=null;
  }
  function openModal(title,subtitle,body,submitLabel,kind){
    modalReturnFocus=document.activeElement;
    host.inert=true;
    document.body.classList.add('modal-open');
    const dialog=document.getElementById('modal-host');
    dialog.innerHTML=`<div class="modal-backdrop" data-action="close-modal"></div><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-description"><div class="modal-header"><div><span class="eyebrow">STOCKCONTROL · DEMO</span><h2 id="modal-title">${E(title)}</h2><p id="modal-description">${E(subtitle)}</p></div><button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar diálogo">${icon('x')}</button></div><form id="modal-form" data-kind="${E(kind)}"><div class="modal-fields">${body}</div><div class="modal-footer">${button('Cancelar','close-modal','secondary')}<button type="submit" class="btn primary">${E(submitLabel)}</button></div></form></section>`;
    dialog.querySelector('input,select,button')?.focus();
  }
  const field=(label,name,type='text',value='',extra='')=>`<label class="field-label">${E(label)}<input class="field" name="${E(name)}" type="${E(type)}" value="${E(value)}" ${extra} required></label>`;
  const materialSelect=selected=>`<label class="field-label">Material<select class="field" name="sku" required>${workspace.materials.map(m=>`<option value="${E(m.sku)}" ${m.sku===selected?'selected':''}>${E(m.sku)} · ${E(m.name)} (${num(M.available(m,workspace.reservations))} ${E(m.unit)} disponíveis)</option>`).join('')}</select></label>`;
  function begin(kind,sku){
    if(kind==='material'){
      if(!checkRole('manage'))return;
      openModal('Adicionar material','Criar referência fictícia no catálogo local.',field('Código SKU','sku','text','','maxlength="36"')+field('Nome','name','text','','maxlength="100"')+
        `<div class="field-grid">${field('Categoria','category','text','','maxlength="40"')}${field('Unidade','unit','text','un','maxlength="10"')}</div><div class="field-grid">${field('Stock inicial','stock','number','0','min="0" step="0.001"')}${field('Stock mínimo','min','number','0','min="0" step="0.001"')}</div><div class="field-grid">${field('Localização','location','text','A1-01','maxlength="36"')}${field('Custo unitário (€)','cost','number','0','min="0" step="0.01"')}</div>`,'Adicionar material','material');
    }else if(kind==='movement'){
      if(!checkRole('move'))return;
      openModal('Novo movimento','Uma entrada, saída ou devolução altera apenas os dados fictícios locais.',
        `<label class="field-label">Tipo<select class="field" name="type"><option>Entrada</option><option>Saída</option><option>Devolução</option></select></label>`+materialSelect(sku)+field('Quantidade','qty','number','1','min="0.001" step="0.001"')+`<label class="field-label">Observação (opcional)<textarea name="note" class="field" maxlength="250" rows="2"></textarea></label>`,'Registar movimento','movement');
    }else if(kind==='reservation'){
      if(!checkRole('reserve'))return;
      openModal('Criar reserva','A quantidade fica alocada à ordem sem alterar o stock físico.',materialSelect(sku)+field('Ordem de produção','order','text','OP-106','maxlength="40"')+field('Quantidade','qty','number','1','min="0.001" step="0.001"'),'Criar reserva','reservation');
    }else if(kind==='consume'){
      if(!checkRole('move'))return;
      const r=workspace.reservations.find(x=>x.id===sku);
      if(!r||r.status!=='Ativa')return toast('A reserva não está ativa.','error');
      openModal('Consumir material reservado','Reserva '+r.id+' · '+r.order+' · saldo '+num(M.reservationRemaining(r))+' '+(getMat(r.sku)?.unit||''),
        `<div class="detail-grid"><div><small>Material</small><strong>${E(getMat(r.sku)?.name||r.sku)}</strong></div><div><small>Reservado restante</small><strong>${num(M.reservationRemaining(r))}</strong></div></div>`+
        `<input type="hidden" name="reservationId" value="${E(r.id)}">`+
        field('Quantidade a consumir','qty','number',String(M.reservationRemaining(r)),'min="0.001" step="0.001"')+
        `<label class="field-label">Observação (opcional)<textarea name="note" class="field" maxlength="250" rows="2"></textarea></label>`,
        'Registar consumo','consume');
    }else if(kind==='count'){
      if(!checkRole('count'))return;
      openModal('Nova contagem física','Regista a contagem; a aprovação será efetuada separadamente.',materialSelect(sku)+field('Quantidade contada','counted','number','0','min="0" step="0.001"'),'Guardar contagem','count');
    }else if(kind==='document'){
      if(!checkRole('document'))return;
      openModal('Registar metadados','Só o nome e dimensão serão registados; o conteúdo não é guardado.',`<label class="field-label">Ficheiro (PDF, PNG ou JPEG; até 5 MB)<input class="field" type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" required></label>`+
        `<label class="field-label">Categoria<select class="field" name="category"><option>Ficha técnica</option><option>Guia de remessa</option><option>Fotografia</option><option>Outro</option></select></label><label class="field-label">Material associado (opcional)<select class="field" name="sku"><option value="">Geral</option>${workspace.materials.map(m=>`<option value="${E(m.sku)}">${E(m.name)}</option>`).join('')}</select></label>`,'Registar metadados','document');
    }
  }
  function submitForm(form){
    const fd=new FormData(form),kind=form.dataset.kind;
    const before=JSON.parse(JSON.stringify(workspace));
    try{
      if(kind==='material'){
        if(!checkRole('manage'))return;
        const sku=M.normalizedSku(fd.get('sku'));
        if(!/^[A-Z0-9][A-Z0-9._-]{1,35}$/.test(sku))throw Error('SKU inválido: usa letras, números, pontos, traços ou sublinhados.');
        if(getMat(sku))throw Error('Já existe um material com esse SKU.');
        const name=String(fd.get('name')||'').trim(),categoryName=String(fd.get('category')||'').trim(),unit=String(fd.get('unit')||'').trim(),location=String(fd.get('location')||'').trim();
        const stock=M.assertCount({sku},fd.get('stock')),min=M.assertCount({sku},fd.get('min')),cost=Number(fd.get('cost'));
        if(!name||name.length>100||!categoryName||categoryName.length>40||!unit||unit.length>10||!location||location.length>36||!Number.isFinite(cost)||cost<0||cost>1000000000)throw Error('Preenche corretamente os dados do material.');
        workspace.materials.push({sku,name,category:categoryName,unit,stock,min,location,cost:Math.round(cost*100)/100});
        eventLog('Material criado: '+sku);
      }else if(kind==='movement'){
        if(!checkRole('move'))return;
        const sku=fd.get('sku'),m=getMat(sku),type=fd.get('type'),qty=Number(fd.get('qty'));
        m.stock=M.newStock(m,type,qty,workspace.reservations);
        workspace.movements.unshift({id:uuid('MV'),sku,type,qty,actor:role+' (demo)',note:String(fd.get('note')||'').trim(),createdAt:now()});
        eventLog('Movimento '+type+': '+sku);
      }else if(kind==='reservation'){
        if(!checkRole('reserve'))return;
        const sku=fd.get('sku'),qty=Number(fd.get('qty')),order=String(fd.get('order')||'').trim();
        if(!order||order.length>40)throw Error('Introduz uma ordem de produção válida (até 40 caracteres).');
        M.assertReservation(getMat(sku),qty,workspace.reservations);
        workspace.reservations.unshift({id:uuid('RS'),sku,qty,consumed:0,order,status:'Ativa',createdAt:now()});
        eventLog('Reserva criada: '+order);
      }else if(kind==='consume'){
        if(!checkRole('move'))return;
        const reservationId=String(fd.get('reservationId')||'');
        const reservation=workspace.reservations.find(r=>r.id===reservationId);
        const material=reservation?getMat(reservation.sku):null;
        const plan=M.planConsumption(material,reservation,fd.get('qty'),workspace.reservations);
        material.stock=plan.stock;
        reservation.consumed=plan.consumed;
        reservation.status=plan.status;
        workspace.movements.unshift({
          id:uuid('MV'),sku:material.sku,type:'Consumo',qty:plan.used,delta:-plan.used,
          reservationId:reservation.id,order:reservation.order,
          actor:role+' (demo)',note:String(fd.get('note')||'').trim(),createdAt:now()
        });
        eventLog('Consumo da reserva '+reservation.id+': '+num(plan.used)+' '+material.unit);
      }else if(kind==='count'){
        if(!checkRole('count'))return;
        const m=getMat(fd.get('sku')),counted=M.assertCount(m,fd.get('counted'));
        workspace.counts.unshift({id:uuid('CT'),sku:m.sku,counted,expected:m.stock,status:'Pendente',createdAt:now()});
        eventLog('Contagem pendente: '+m.sku);
      }else if(kind==='document'){
        if(!checkRole('document'))return;
        const file=fd.get('file');
        if(!(file instanceof File)||file.size===0)throw Error('Seleciona um ficheiro válido.');
        if(file.size>5*1024*1024)throw Error('Ficheiro superior a 5 MB.');
        const ext=(file.name.split('.').pop()||'').toLowerCase();
        if(!['pdf','png','jpg','jpeg'].includes(ext)||!['application/pdf','image/png','image/jpeg'].includes(file.type))throw Error('Formato inválido. Usa PDF, PNG ou JPEG.');
        workspace.documents.unshift({id:uuid('DOC'),name:file.name.slice(0,120),category:fd.get('category'),sku:fd.get('sku'),sizeKb:Math.ceil(file.size/1024),createdAt:now()});
        eventLog('Metadados locais adicionados: '+file.name.slice(0,80));
      }
      const saved=save();closeModal();render();saveFeedback(saved);
    }catch(err){recover(err,before)}
  }
  function detail(sku){
    const m=getMat(sku);if(!m)return;
    const rs=M.reserved(m.sku,workspace.reservations);
    openModal(m.name,'Detalhes de material em ambiente de demonstração.',
      `<div class="detail-grid"><div><small>SKU</small><strong>${E(m.sku)}</strong></div><div><small>Localização</small><strong>${E(m.location)}</strong></div><div><small>Stock físico</small><strong>${num(m.stock)} ${E(m.unit)}</strong></div><div><small>Reservado</small><strong>${num(rs)} ${E(m.unit)}</strong></div><div><small>Disponível</small><strong>${num(M.available(m,workspace.reservations))} ${E(m.unit)}</strong></div><div><small>Mínimo</small><strong>${num(m.min)} ${E(m.unit)}</strong></div></div><p class="modal-hint">As quantidades de demonstração não são sincronizadas com o stock real.</p>`,
      'Fechar','view');
    const f=document.getElementById('modal-form');
    f.querySelector('[type=submit]').textContent='Fechar';
  }
  function cancelReservation(id){
    if(!checkRole('reserve'))return;
    const r=workspace.reservations.find(x=>x.id===id);
    if(!r||r.status!=='Ativa')return toast('A reserva já não está ativa.','error');
    if(!confirm('Cancelar o saldo ainda reservado de '+r.id+'? Os consumos já efetuados serão mantidos.'))return;
    const before=JSON.parse(JSON.stringify(workspace));
    try{
      r.status='Cancelada';eventLog('Reserva cancelada: '+id);
      const saved=save();render();saveFeedback(saved,'Reserva cancelada na demonstração.');
    }catch(err){recover(err,before)}
  }
  function countDecision(id,approve){
    if(!checkRole('approve'))return;
    const c=workspace.counts.find(x=>x.id===id),m=c?getMat(c.sku):null;
    if(!c||c.status!=='Pendente'||!m)return toast('Contagem inválida ou já tratada.','error');
    if(approve){
      if(m.stock!==c.expected)return toast('Stock alterado após a contagem. Regista uma contagem nova.','error');
      const reserved=M.reserved(c.sku,workspace.reservations);
      if(c.counted<reserved)return toast('A contagem é inferior às reservas ativas. Resolve primeiro as reservas.','error');
    }
    if(!confirm(approve?'Aplicar o acerto de stock nesta demonstração?':'Rejeitar esta contagem?'))return;
    const before=JSON.parse(JSON.stringify(workspace));
    try{
      if(approve){
        const delta=Math.round((c.counted-c.expected)*1000)/1000;
        m.stock=c.counted;
        if(delta!==0)workspace.movements.unshift({
          id:uuid('MV'),sku:c.sku,type:'Ajuste',qty:Math.abs(delta),delta,
          actor:role+' (demo)',note:'Acerto de inventário físico '+c.id,createdAt:now()
        });
      }
      c.status=approve?'Aplicada':'Rejeitada';
      eventLog('Contagem '+c.status.toLowerCase()+': '+c.id);
      const saved=save();render();saveFeedback(saved,'Contagem '+c.status.toLowerCase()+'.');
    }catch(err){recover(err,before)}
  }
  function exportRows(kind){
    let headers,rows,name;
    if(kind==='export-inventory'){
      headers=['SKU','Material','Categoria','Unidade','Stock','Reservado','Disponível','Mínimo','Localização','Custo unitário EUR'];
      rows=workspace.materials.map(m=>[m.sku,m.name,m.category,m.unit,m.stock,M.reserved(m.sku,workspace.reservations),M.available(m,workspace.reservations),m.min,m.location,m.cost]);name='stockcontrol-demo-inventario.csv';
    }else{
      headers=['ID','Data','Material SKU','Tipo','Quantidade','Variação de stock','Responsável','Observação'];
      rows=workspace.movements.map(m=>[m.id,m.createdAt,m.sku,m.type,m.qty,
        m.type==='Ajuste'||m.type==='Consumo'?m.delta:(m.type==='Saída'?-m.qty:m.qty),m.actor,m.note||'']);name='stockcontrol-demo-movimentos.csv';
    }
    const blob=new Blob([M.toCsv(rows,headers)],{type:'text/csv;charset=utf-8'});
    const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);toast('CSV da demonstração exportado.');
  }
  function notifications(){
    const list=lows();
    const message=list.length?list.map(m=>m.name+' ('+stockView.statusBySku.get(m.sku)+')').join('\n'):'Não existem materiais em alerta.';
    openModal('Centro de notificações',list.length+' materiais precisam de atenção.',`<div class="notification-list">${E(message).replace(/\n/g,'<br>')}</div>`,'Fechar','view');
  }
  function handleAction(name,data={}){
    switch(name){
      case'toggle-menu':mobileMenu=!mobileMenu;render();break;
      case'close-menu':mobileMenu=false;render();break;
      case'close-modal':closeModal();break;
      case'new-movement':begin('movement');break;
      case'add-material':begin('material');break;
      case'new-reservation':begin('reservation');break;
      case'new-count':begin('count');break;
      case'new-document':begin('document');break;
      case'export-inventory':case'export-movements':exportRows(name);break;
      case'backup-export':downloadBackup();break;
      case'backup-import':if(checkRole('manage'))document.getElementById('backup-input')?.click();break;
      case'prev-inventory':inventoryPage--;render();break;
      case'next-inventory':inventoryPage++;render();break;
      case'go-inventory':navigate('inventory');break;
      case'go-inventory-search':navigate('inventory');document.getElementById('inventory-search')?.focus();break;
      case'go-dashboard':navigate('dashboard');break;
      case'detail':detail(data.sku);break;
      case'consume-reservation':begin('consume',data.id);break;
      case'cancel-reservation':cancelReservation(data.id);break;
      case'approve-count':countDecision(data.id,true);break;
      case'reject-count':countDecision(data.id,false);break;
      case'notifications':notifications();break;
      case'no-checkout':toast('Não existe checkout ativo nesta demonstração.','error');break;
      case'reset-demo':
        if(!checkRole('manage'))return;
        if(confirm('Apagar as alterações locais e repor os dados fictícios originais?')){
          const before=JSON.parse(JSON.stringify(workspace));
          try{workspace=M.demo();const saved=save();render();saveFeedback(saved,'Demonstração reposta.')}
          catch(err){recover(err,before)}
        }
        break;
    }
  }
  document.addEventListener('click',event=>{
    const nav=event.target.closest('[data-nav]');
    if(nav){navigate(nav.dataset.nav);return}
    const a=event.target.closest('[data-action]');
    if(a){event.preventDefault();handleAction(a.dataset.action,a.dataset)}
  });
  document.addEventListener('submit',event=>{
    if(event.target.id==='modal-form'){
      event.preventDefault();
      if(event.target.dataset.kind==='view')closeModal();
      else submitForm(event.target);
    }
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='inventory-search'||event.target.id==='global-search'){
      const newSearch=event.target.value;
      search=newSearch;inventoryPage=1;
      if(event.target.id==='inventory-search'){
        const pos=event.target.selectionStart;
        render();
        const input=document.getElementById('inventory-search');
        input?.focus();
        input?.setSelectionRange(pos,pos);
      }
    }
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='demo-role'){role=event.target.value;render();toast('A apresentar permissões de '+role+' (apenas demo).')}
    if(event.target.id==='inventory-sort'){inventorySort=event.target.value;inventoryPage=1;render();}
    if(event.target.id==='backup-input'){void restoreBackup(event.target.files?.[0]);event.target.value='';}
  });
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-category],[data-movfilter]');
    if(!b)return;
    if(b.dataset.category){category=b.dataset.category;inventoryPage=1;render()}
    if(b.dataset.movfilter){movementFilter=b.dataset.movfilter;render()}
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&event.target.id==='global-search'){
      event.preventDefault();const q=event.target.value;navigate('inventory');search=q;render();document.getElementById('inventory-search')?.focus();return;
    }
    if(event.key==='Escape'&&document.querySelector('.modal')){closeModal();return}
    if(event.key==='Tab'&&document.querySelector('.modal')){
      const inputs=[...document.querySelectorAll('.modal button,.modal input,.modal select,.modal textarea')].filter(e=>!e.disabled);
      const first=inputs[0],last=inputs[inputs.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&!document.querySelector('.modal')){
      event.preventDefault();if(current!=='inventory')navigate('inventory');
      document.getElementById('inventory-search')?.focus();
    }
  });
  window.addEventListener('storage',event=>{
    if(event.key!==STORE)return;
    workspace=load();
    if(document.querySelector('.modal'))closeModal();
    render();
    toast('Dados de demonstração atualizados a partir de outra aba.');
  });
  window.addEventListener('hashchange',()=>{const n=location.hash.slice(1);if(pages[n]&&n!==current)navigate(n)});
  const initial=location.hash.slice(1);if(pages[initial])current=initial;
  render();
})();
