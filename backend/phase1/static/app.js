'use strict';
(() => {
  // Security: the bearer token lives only in JS memory; never localStorage.
  let token=null, currentUser=null, currentCompany=null, page='dashboard', menuOpen=false;
  let toastTimer;
  const el=(tag,cls,text)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  const by=id=>document.getElementById(id);
  function notify(message,err=false){
    const t=by('toast');t.textContent=message;t.className='toast show'+(err?' error':'');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.className='toast'},4500);
  }
  const navLinks=[
    ['dashboard','▦','Visão geral'],['inventory','◈','Inventário'],
    ['stockMovements','⇄','Movimentos'],['reservations','▣','Reservas'],
    ['purchases','▤','Compras'],['suppliers','♢','Fornecedores'],
    ['counts','☷','Contagens físicas'],['scanner','▧','QR Code'],
    ['users','♙','Utilizadores'],['warehouses','▤','Armazéns'],
    ['audit','◷','Auditoria'],
    ['company','⚙','Empresa']
  ];
  const can=(role)=>currentUser?.role===role;
  const auditAccess=()=>['Administrador','Gestor','Auditor'].includes(currentUser?.role);
  const usersAccess=auditAccess;
  const warehouseEdit=()=>['Administrador','Gestor'].includes(currentUser?.role);
  function errText(body,status){
    const d=body?.detail;
    if(typeof d==='string')return d;
    if(Array.isArray(d))return d.map(x=>x.msg||'Campo inválido').join('; ').slice(0,240);
    return 'Pedido falhou ('+status+').';
  }
  async function call(path,method='GET',body=null,apiVersion='v1'){
    const headers={'Accept':'application/json'};
    if(token)headers.Authorization='Bearer '+token;
    if(body!==null)headers['Content-Type']='application/json';
    let response;
    try{
      response=await fetch('/api/'+apiVersion+path,{method,headers,body:body===null?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store'});
    }catch{throw Error('Sem ligação ao servidor. Verifica a rede.')}
    let data;
    try{data=await response.json()}catch{data={}}
    if(!response.ok){
      if(response.status===401&&token){token=null;showLogin();notify('Sessão expirada. Entra novamente.','error')}
      throw Error(errText(data,response.status));
    }
    return data;
  }
  function showLogin(){
    by('login-screen').classList.remove('hidden');
    by('workspace').classList.add('hidden');
    by('login-form').reset();
    token=null;currentUser=null;currentCompany=null;
  }
  function showApp(){
    by('login-screen').classList.add('hidden');
    by('workspace').classList.remove('hidden');
    by('company-name').textContent=currentCompany.name;
    by('company-code').textContent=currentCompany.code;
    by('user-name').textContent=currentUser.name;
    by('user-role').textContent=currentUser.role;
    nav();
    void render();
  }
  function nav(){
    const root=by('navigation');root.replaceChildren();
    for(const [key,icon,text] of navLinks){
      if(key==='users'&&!usersAccess() || key==='audit'&&!auditAccess())continue;
      const b=el('button',page===key?'active':'');
      b.type='button';b.dataset.page=key;
      const glyph=el('span','nav-icon',icon);
      b.append(glyph,el('span','',text));
      b.addEventListener('click',()=>{page=key;menuOpen=false;by('workspace').querySelector('.sidebar').classList.remove('open');nav();void render()});
      root.append(b);
    }
  }
  function heading(kicker,title,description,action=null){
    const h=el('div','page-heading'),copy=el('div');
    copy.append(el('span','eyebrow',kicker),el('h1','',title),el('p','',description));
    h.append(copy);
    if(action){const box=el('div','page-actions');box.append(action);h.append(box)}
    return h;
  }
  function button(label,fn,cls='secondary'){
    const b=el('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;
  }
  function panel(title,description){
    const p=el('section','panel'),header=el('div','panel-title'),copy=el('div');
    copy.append(el('h2','',title),el('p','',description));header.append(copy);p.append(header);return p;
  }
  function state(active){
    return el('span',active?'state':'state off',active?'Ativo':'Inativo');
  }
  function metric(label,value,foot){
    const m=el('div','metric');m.append(el('small','',label),el('strong','',value),el('span','',foot));return m;
  }
  function table(columns,records,row){
    const wrap=el('div','table-scroll'),t=el('table'),head=el('thead'),headRow=el('tr');
    columns.forEach(c=>headRow.append(el('th','',c)));head.append(headRow);
    const body=el('tbody');records.forEach(r=>body.append(row(r)));
    t.append(head,body);wrap.append(t);
    return wrap;
  }
  function td(node){
    const cell=el('td');
    cell.append(node instanceof Node?node:document.createTextNode(String(node)));
    return cell;
  }
  function select(options,current){
    const s=el('select','role-picker');
    for(const option of options){
      const opt=el('option','',option);opt.value=option;if(option===current)opt.selected=true;s.append(opt);
    }
    return s;
  }
  function field(label,name,type='text',value='',required=true){
    const wrapper=el('label');
    const txt=el('span','',label);const input=el('input');input.type=type;input.name=name;input.value=value;input.required=required;
    if(type==='password')input.autocomplete='new-password';
    wrapper.append(txt,input);
    return wrapper;
  }
  function formPanel(title,description,fields,submitLabel,handler){
    const p=panel(title,description),form=el('form','edit-form');
    for(const f of fields)form.append(f);
    const actions=el('div','actions'),save=el('button','primary',submitLabel);
    save.type='submit';actions.append(save);form.append(actions);
    form.addEventListener('submit',async ev=>{
      ev.preventDefault();save.disabled=true;
      const values=Object.fromEntries(new FormData(form));
      try{await handler(values);notify('Alterações guardadas.');await render()}
      catch(error){notify(error.message,true)}finally{save.disabled=false}
    });
    p.append(form);return p;
  }
  async function dashboard(root){
    const [wh,events,users,inventory]=await Promise.all([
      call('/warehouses'),auditAccess()?call('/audit?limit=5'):Promise.resolve([]),
      usersAccess()?call('/users'):Promise.resolve([]),call('/stock/summary','GET',null,'v2')
    ]);
    const metrics=el('div','grid-metrics');
    metrics.append(metric('Armazéns',wh.length,'Localizações registadas'),
      metric('Armazéns ativos',wh.filter(w=>w.active).length,'Prontos a operar'),
      metric('Colaboradores',users.length,usersAccess()?'Contas na empresa':'Acesso restrito'),
      metric('Atividade recente',events.length,'Últimos registos disponíveis'),
      metric('Materiais no catálogo',inventory.materials,'Referências reais'),
      metric('Materiais com stock baixo',inventory.low_stock_materials,'Stock disponível face ao mínimo'),
      metric('Reservas ativas',inventory.active_reservations,'Alocadas à produção'),
      metric('Saldos por armazém',inventory.locations_with_stock,'Pontos com movimentos'));
    root.append(heading('CENTRO DE GESTÃO','Visão geral','Administração da empresa e operações de controlo.'),metrics);
    const sections=el('div','section-grid');
    const p=panel('Armazéns','Estado atual das localizações');
    const list=el('div','list');
    for(const w of wh.slice(0,5)){
      const r=el('div','list-row'),copy=el('div');
      copy.append(el('strong','',w.name),el('small','',w.code+' · '+w.location));
      r.append(copy,state(w.active));list.append(r);
    }
    if(!wh.length)list.append(el('div','empty','Sem armazéns'));
    p.append(list);sections.append(p);
    const a=panel('Atividade','Auditoria das últimas operações'),alist=el('div','list');
    events.forEach(ev=>{
      const r=el('div','list-row'),copy=el('div');
      copy.append(el('strong','',ev.action),el('small','',new Date(ev.created_at).toLocaleString('pt-PT')));
      r.append(copy,el('span','pill',ev.target_type));alist.append(r);
    });
    if(!events.length)alist.append(el('div','empty',auditAccess()?'Sem operações registadas.':'Sem permissão para consultar auditoria.'));
    a.append(alist);sections.append(a);root.append(sections);
    const lower=el('div','section-grid');
    const shortcuts=panel('Acessos rápidos','Abre diretamente as áreas mais utilizadas.');
    const quick=el('div','quick-links');
    const entries=[['inventory','◈','Consultar inventário'],['stockMovements','⇄','Registar movimentos'],
      ['reservations','▣','Reservas de produção'],['purchases','▤','Encomendas']];
    if(usersAccess())entries.unshift(['users','♙','Equipa e acessos']);
    if(auditAccess())entries.push(['audit','◷','Consultar auditoria']);
    entries.forEach(([key,glyph,label])=>{
      const b=button(glyph+'  '+label,()=>{page=key;nav();void render()},'quick-link');
      quick.append(b);
    });
    shortcuts.append(quick);lower.append(shortcuts);
    const policies=panel('Proteções de administração','Regras essenciais aplicadas pelo servidor.');
    const checks=el('div','admin-checks');
    const labels=['Último administrador protegido',
      'Operações restritas por perfil',
      'Sessões com expiração e revogação',
      'Dados separados por empresa'];
    labels.forEach(label=>{
      const item=el('div','admin-check');
      item.append(el('span','policy-check','✓'),el('span','',label));checks.append(item);
    });
    policies.append(checks);lower.append(policies);root.append(lower);
  }
  // Reusable administration dialog: same visual language as the operational modals.
  function adminDialog(title,description,fields,submitLabel,handler){
    const dialog=el('dialog','stock-admin-dialog');
    dialog.setAttribute('aria-label',title);
    const content=formPanel(title,description,fields,submitLabel,async values=>{
      await handler(values);dialog.close();
    });
    const top=content.querySelector('.panel-title');
    top?.append(button('Fechar',()=>dialog.close(),'secondary'));
    dialog.append(content);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    document.body.append(dialog);dialog.showModal();
    dialog.querySelector('input, select, button')?.focus();
    return dialog;
  }
  function controlGroup(label,name,values,current){
    const wrapper=el('label'),input=select(values,current);
    input.name=name;input.className='admin-filter-select';
    wrapper.append(el('span','',label),input);
    return wrapper;
  }
  function adminFiltering(panel,columns,records,renderer,options={}){
    const area=el('div','admin-table-toolbar');
    const query=document.createElement('input');
    query.type='search';query.placeholder=options.placeholder||'Pesquisar nome, código ou referência…';
    query.setAttribute('aria-label','Pesquisar registos');
    area.append(query);
    const filters=[];
    for(const f of options.filters||[]){
      const selectNode=document.createElement('select');
      selectNode.setAttribute('aria-label',f.label);
      for(const [id,title] of f.options){
        const opt=el('option','',title);opt.value=id;selectNode.append(opt);
      }
      selectNode.addEventListener('change',refresh);
      area.append(selectNode);filters.push({select:selectNode,field:f.field});
    }
    const label=el('span','admin-table-count');
    label.setAttribute('aria-live','polite');
    panel.append(area,label);
    const holder=el('div','admin-table-results');
    panel.append(holder);
    function refresh(){
      const q=query.value.trim().toLocaleLowerCase('pt-PT');
      const shown=records.filter(r=>{
        if(q&&!Object.values(r).join(' ').toLocaleLowerCase('pt-PT').includes(q))return false;
        return filters.every(f=>!f.select.value||String(r[f.field])===f.select.value);
      });
      label.textContent='A mostrar '+shown.length+' de '+records.length+' registos';
      holder.replaceChildren(shown.length?table(columns,shown,renderer):
        el('div','empty',records.length?'Nenhum resultado para os filtros.':'Ainda não existem registos.'));
    }
    query.addEventListener('input',refresh);refresh();
  }
  async function users(root){
    if(!usersAccess()){root.append(el('p','','Sem permissão para consultar utilizadores.'));return}
    const records=await call('/users');
    const active=records.filter(r=>r.active).length;
    const create=can('Administrador')?button('+ Novo utilizador',()=>{
      const roleField=controlGroup('Perfil','role',['Operador','Gestor','Auditor','Administrador'],'Operador');
      adminDialog('Novo utilizador','O colaborador recebe um perfil e uma palavra-passe inicial.',[
        field('Nome completo','name'),field('Email','email','email'),roleField,
        field('Palavra-passe inicial (12+ caracteres)','password','password')
      ],'Criar utilizador',async data=>{await call('/users','POST',data)});
    },'primary'):null;
    root.append(heading('PESSOAS E PERMISSÕES','Utilizadores',
      'Acessos por função, suspensão de contas e administração da equipa.',create));
    const stats=el('div','stock-summary-inline');
    stats.append(metric('Utilizadores',records.length,'Da empresa'),
      metric('Ativos',active,'Acessos permitidos'),
      metric('Administradores',records.filter(r=>r.role==='Administrador'&&r.active).length,'Gestores de acesso'));
    root.append(stats);
    const p=panel('Equipa ('+records.length+')','O sistema exige pelo menos um administrador ativo.');
    const renderer=user=>{
      const tr=el('tr'),name=el('div','stock-entity-identity');
      name.append(el('strong','',user.name),el('small','subtext',user.email));
      tr.append(td(name),td(el('span','pill',user.role)),
        td(state(user.active)));
      const actions=el('div','actions-inline');
      if(can('Administrador')){
        actions.append(button('Editar',()=>{
          const role=controlGroup('Perfil','role',
            ['Administrador','Gestor','Operador','Auditor'],user.role);
          const account=controlGroup('Estado','state',['Ativo','Inativo'],user.active?'Ativo':'Inativo');
          adminDialog('Editar colaborador · '+user.name,'Altera o acesso sem apagar o histórico de operações.',[
            field('Nome completo','name','text',user.name),role,account
          ],'Guardar alterações',async data=>{
            await call('/users/'+encodeURIComponent(user.id),'PATCH',{
              name:data.name,role:data.role,active:data.state==='Ativo'});
          });
        },'secondary'));
        actions.append(button('Redefinir senha',()=>{
          adminDialog('Redefinir senha · '+user.name,
            'Ao guardar, todas as sessões anteriores deste colaborador são revogadas.',[
              field('Nova palavra-passe (mínimo 12 caracteres)','password','password')
            ],'Redefinir palavra-passe',async data=>{
              await call('/users/'+encodeURIComponent(user.id)+'/reset-password','POST',data);
            });
        },'subtle'));
      }else actions.append(el('span','hint','Apenas consulta'));
      tr.append(td(actions));return tr;
    };
    adminFiltering(p,['Colaborador','Perfil','Estado','Ações'],records,renderer,{
      placeholder:'Pesquisar colaborador, email ou perfil…',
      filters:[{label:'Filtrar por perfil',field:'role',options:[
        ['','Todos os perfis'],...['Administrador','Gestor','Operador','Auditor'].map(x=>[x,x])]}]
    });
    root.append(p);
  }
  async function warehouses(root){
    const records=await call('/warehouses');
    const create=warehouseEdit()?button('+ Novo armazém',()=>{
      adminDialog('Novo armazém','Cria uma localização para a empresa sem alterar quantidades existentes.',[
        field('Código','code'),field('Nome','name'),field('Localização','location')
      ],'Criar armazém',async values=>{await call('/warehouses','POST',values)});
    },'primary'):null;
    root.append(heading('ESTRUTURA E LOCALIZAÇÕES','Armazéns',
      'Localizações, estado operacional e controlo de armazéns.',create));
    const stats=el('div','stock-summary-inline');
    stats.append(metric('Armazéns',records.length,'Registados'),
      metric('Ativos',records.filter(r=>r.active).length,'A receber material'),
      metric('Inativos',records.filter(r=>!r.active).length,'Bloqueados para movimentos'));
    root.append(stats);
    const p=panel('Armazéns ('+records.length+')',
      'Não é possível desativar um armazém com stock, reservas ou encomendas pendentes.');
    adminFiltering(p,['Código','Armazém','Localização','Estado','Ações'],records,w=>{
      const tr=el('tr');
      tr.append(td(el('strong','',w.code)),td(w.name),td(w.location),td(state(w.active)));
      const actions=el('div','actions-inline');
      if(warehouseEdit())actions.append(button('Editar',()=>{
        const status=controlGroup('Estado','state',['Ativo','Inativo'],w.active?'Ativo':'Inativo');
        adminDialog('Editar armazém · '+w.code,'Os saldos ficam associados ao mesmo identificador.',[
          field('Nome do armazém','name','text',w.name),
          field('Localização','location','text',w.location),status
        ],'Guardar alterações',async values=>{
          await call('/warehouses/'+encodeURIComponent(w.id),'PATCH',{
            name:values.name,location:values.location,active:values.state==='Ativo'});
        });
      },'secondary'));
      tr.append(td(actions));return tr;
    },{
      placeholder:'Pesquisar código, armazém ou localização…'
    });
    root.append(p);
  }
  async function audit(root){
    if(!auditAccess()){root.append(el('p','','Sem acesso à auditoria.'));return}
    const pageSize=50;
    let offset=0;
    root.append(heading('RASTREABILIDADE','Auditoria',
      'Eventos registados no servidor, por utilizador e empresa.'));
    const p=panel('Histórico de operações','Consulta paginada por data; os eventos anteriores permanecem na base de dados.');
    const tools=el('div','admin-audit-toolbar');
    const query=document.createElement('input');query.type='search';
    query.placeholder='Pesquisar nesta página…';query.setAttribute('aria-label','Pesquisar na auditoria');
    const action=document.createElement('select');action.setAttribute('aria-label','Filtrar por área');
    for(const [value,text] of [
      ['','Todas as ações'],['stock.','Stock'],['purchase.','Compras'],['reservation.','Reservas'],
      ['count.','Contagens'],['user.','Utilizadores'],['warehouse.','Armazéns'],['auth.','Sessões']]){
        const opt=el('option','',text);opt.value=value;action.append(opt);
    }
    tools.append(query,action);
    const pager=el('div','admin-audit-pager');
    const prev=button('Anterior',()=>{offset=Math.max(0,offset-pageSize);void load()},'secondary');
    const next=button('Seguinte',()=>{offset+=pageSize;void load()},'secondary');
    const info=el('span','admin-table-count');
    const download=button('Exportar página CSV',()=>exportCurrent(),'secondary');
    pager.append(prev,info,next,download);
    const output=el('div','admin-audit-results');
    p.append(tools,output,pager);root.append(p);
    let records=[];
    function exportCurrent(){
      const rows=filterRecords();
      const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
      const safe=value=>{
        const s=String(value??'');
        return /^[=+\-@\t\r]/.test(s)?("'"+s):s;
      };
      const cells=[['data','ação','tipo','identificador','utilizador']];
      rows.forEach(item=>cells.push([item.created_at,item.action,item.target_type,item.target_id,item.actor_id]));
      const csv='\uFEFF'+cells.map(r=>r.map(v=>quote(safe(v))).join(';')).join('\r\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download='stockcontrol-auditoria-'+(Math.floor(offset/pageSize)+1)+'.csv';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function filterRecords(){
      const needle=query.value.trim().toLocaleLowerCase('pt-PT');
      return records.filter(item=>(!action.value||item.action.startsWith(action.value))&&
        (!needle||[item.action,item.target_type,item.target_id,item.actor_id,item.detail]
          .join(' ').toLocaleLowerCase('pt-PT').includes(needle)));
    }
    function draw(){
      const found=filterRecords();
      output.replaceChildren(found.length?table(
        ['Data e hora','Ação','Tipo','Referência','Utilizador'],found,item=>{
          const tr=el('tr');
          tr.append(td(new Date(item.created_at).toLocaleString('pt-PT')),
            td(el('strong','',item.action)),td(item.target_type),td(item.target_id),td(item.actor_id||'Sistema'));
          return tr;
        }):el('div','empty','Nenhuma operação para os filtros desta página.'));
      info.textContent='Página '+(Math.floor(offset/pageSize)+1)+' · '+found.length+' de '+records.length+' eventos recebidos';
      prev.disabled=offset===0;
      next.disabled=records.length<pageSize;
      download.disabled=found.length===0;
    }
    async function load(){
      prev.disabled=true;next.disabled=true;
      try{
        records=await call('/audit?limit='+pageSize+'&offset='+offset);
        if(!root.isConnected)return;
        draw();
      }catch(err){notify(err.message,true)}
    }
    query.addEventListener('input',draw);action.addEventListener('change',draw);
    await load();
  }
  async function company(root){
    const c=await call('/company');
    const edit=can('Administrador')?button('Editar empresa',()=>{
      adminDialog('Editar empresa','O código da empresa mantém-se inalterado.',[
        field('Nome da empresa','name','text',c.name),
        field('Setor de atividade','sector','text',c.sector)
      ],'Guardar empresa',async data=>{
        currentCompany=await call('/company','PATCH',data);
        by('company-name').textContent=currentCompany.name;
      });
    },'primary'):null;
    root.append(heading('CONFIGURAÇÃO','Empresa',
      'Identificação e parâmetros da organização autenticada.',edit));
    const section=el('div','section-grid');
    const p=panel('Dados empresariais','Identificação ligada aos restantes módulos.');
    const info=el('div','list');
    [['Nome',c.name],['Código',c.code],['Atividade',c.sector],
      ['Estado',c.active?'Ativa':'Inativa']].forEach(([k,v])=>{
      const item=el('div','list-row');item.append(el('strong','',k),el('span','',v));info.append(item);
    });
    p.append(info);
    const security=panel('Segurança e dados','Regras atualmente disponíveis na Fase 2.');
    const checks=el('div','admin-checks');
    for(const label of ['Separação de dados por empresa na API',
      'Permissões por função verificadas no servidor',
      'Registo de ações e acessos','Revisão de segurança e migrações ainda necessárias']){
      const item=el('div','admin-check');
      item.append(el('span','policy-check',label.includes('necessárias')?'!':'✓'),el('span','',label));
      checks.append(item);
    }
    security.append(checks);
    section.append(p,security);root.append(section);
  }
  const operationalPages=window.StockOperationsUI({call:(path,method,body)=>call(path,method,body,path.startsWith('/warehouses')?'v1':'v2'),
    el,heading,panel,table,td,button,field,select,formPanel,
    notify,render,canManage:()=>['Administrador','Gestor'].includes(currentUser?.role),
    canWrite:()=>['Administrador','Gestor','Operador'].includes(currentUser?.role),getToken:()=>token});
  const adminPages=window.StockAdminPages({
    call:(path,method,body)=>call(path,method,body,'v1'),
    stock:(path,method,body)=>call(path,method,body,'v2'),
    render,notify,
    canAdmin:()=>currentUser?.role==='Administrador',
    canManage:()=>['Administrador','Gestor'].includes(currentUser?.role),
    canAudit:()=>['Administrador','Gestor','Auditor'].includes(currentUser?.role),
    canUsers:()=>['Administrador','Gestor','Auditor'].includes(currentUser?.role)
  });
  const pages={dashboard,users,warehouses,audit,company,...adminPages,...operationalPages};
  async function render(){
    const container=by('content');
    window.StockControlUXReset?.();
    document.querySelectorAll('dialog.stock-admin-dialog').forEach(d=>d.close());
    container.replaceChildren();
    by('breadcrumb-page').textContent=navLinks.find(x=>x[0]===page)?.[2]||'Visão geral';
    try{await (pages[page]||dashboard)(container)}
    catch(err){container.replaceChildren(el('div','panel empty',err.message));notify(err.message,true)}
  }
  by('login-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),data=Object.fromEntries(new FormData(form));
    button.disabled=true;
    try{
      const result=await call('/auth/login','POST',data);
      token=result.access_token;currentUser=result.user;currentCompany=result.company;page='dashboard';
      showApp();
      form.querySelector('input[name=password]').value='';
    }catch(err){notify(err.message,true)}
    finally{button.disabled=false}
  });
  by('logout').addEventListener('click',async()=>{
    try{await call('/auth/logout','POST',{})}catch{}finally{showLogin();notify('Sessão terminada.')}
  });
  by('menu-toggle').addEventListener('click',()=>{
    menuOpen=!menuOpen;
    by('workspace').querySelector('.sidebar').classList.toggle('open',menuOpen);
  });
})();
