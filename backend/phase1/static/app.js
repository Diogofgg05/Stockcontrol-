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
  async function users(root){
    if(!usersAccess()){root.append(el('p','','Sem permissão para consultar utilizadores.'));return}
    const records=await call('/users');
    root.append(heading('PESSOAS E PERMISSÕES','Utilizadores','Contas e permissões reais, aplicadas na API.'));
    const p=panel('Equipa ('+records.length+')','Um administrador deve permanecer ativo.');
    p.append(table(['Pessoa','Email','Perfil','Estado','Ações'],records,user=>{
      const tr=el('tr');tr.append(td(el('strong','',user.name)),td(user.email));
      const role=select(['Administrador','Gestor','Operador','Auditor'],user.role);
      const active=select(['Ativo','Inativo'],user.active?'Ativo':'Inativo');active.className='status-picker';
      role.disabled=!can('Administrador');active.disabled=!can('Administrador');
      tr.append(td(role),td(active));
      const actions=el('div','actions-inline');
      const save=button('Guardar',async()=>{
        save.disabled=true;
        try{await call('/users/'+encodeURIComponent(user.id),'PATCH',{role:role.value,active:active.value==='Ativo'});notify('Utilizador atualizado.');await render()}
        catch(err){notify(err.message,true);save.disabled=false}
      },'secondary');
      save.disabled=!can('Administrador');
      actions.append(save);
      if(can('Administrador')){
        actions.append(button('Redefinir senha',()=>{
          document.getElementById('password-reset')?.remove();
          const reset=formPanel('Palavra-passe · '+user.name,
            'A redefinição invalida as sessões existentes deste utilizador.',
            [field('Nova palavra-passe (12+ caracteres)','password','password')],
            'Redefinir palavra-passe',async values=>{
              await call('/users/'+encodeURIComponent(user.id)+'/reset-password','POST',values);
            });
          reset.id='password-reset';
          by('content').append(reset);
          reset.scrollIntoView({behavior:'smooth',block:'center'});
        },'subtle'));
      }
      tr.append(td(actions));
      return tr;
    }));root.append(p);
    if(can('Administrador')){
      const roleSelect=select(['Operador','Gestor','Auditor','Administrador'],'Operador');roleSelect.name='role';roleSelect.className='role-picker';
      const wrap=el('label');wrap.append(el('span','','Perfil do utilizador'),roleSelect);
      root.append(formPanel('Criar utilizador','A conta só funciona após criar a palavra-passe inicial.',[
        field('Nome','name'),field('Email','email','email'),wrap,field('Palavra-passe inicial (12+ caracteres)','password','password')
      ],'Adicionar utilizador',async data=>{await call('/users','POST',data)}));
    }
  }
  async function warehouses(root){
    const records=await call('/warehouses');
    root.append(heading('ESTRUTURA E LOCALIZAÇÕES','Armazéns','Localizações associadas exclusivamente à tua empresa.'));
    const p=panel('Armazéns ('+records.length+')','Mantém pelo menos um armazém ativo.');
    p.append(table(['Código','Armazém','Localização','Estado',''],records,w=>{
      const tr=el('tr');tr.append(td(el('strong','',w.code)),td(w.name),td(w.location),td(state(w.active)));
      const actions=el('div','actions-inline');
      if(warehouseEdit()){
        actions.append(button(w.active?'Desativar':'Ativar',async()=>{
          try{await call('/warehouses/'+encodeURIComponent(w.id),'PATCH',{active:!w.active});notify('Armazém atualizado.');await render()}
          catch(err){notify(err.message,true)}
        },'secondary'));
      }
      tr.append(td(actions));return tr;
    }));
    root.append(p);
    if(warehouseEdit())root.append(formPanel('Novo armazém','Regista uma localização sem afetar stocks existentes.',[
      field('Código','code'),field('Nome','name'),field('Localização','location')
    ],'Criar armazém',async data=>{await call('/warehouses','POST',data)}));
  }
  async function audit(root){
    if(!auditAccess()){root.append(el('p','','Sem acesso à auditoria.'));return}
    const records=await call('/audit?limit=100');
    root.append(heading('RASTREABILIDADE','Auditoria','Ações persistidas no servidor, associadas ao utilizador e empresa.'));
    const p=panel('Registos ('+records.length+')','Apenas leitura; sem palavras-passe ou tokens no histórico.');
    p.append(table(['Quando','Ação','Alvo','Identificador'],records,item=>{
      const tr=el('tr');tr.append(td(new Date(item.created_at).toLocaleString('pt-PT')),
        td(el('strong','',item.action)),td(item.target_type),td(item.target_id));
      return tr;
    }));root.append(p);
  }
  async function company(root){
    const c=await call('/company');
    root.append(heading('CONFIGURAÇÃO','Empresa','Informações e identificação da organização autenticada.'));
    const p=panel('Dados empresariais','Código imutável: '+c.code);
    const m=el('div','list');
    [['Nome',c.name],['Código',c.code],['Setor',c.sector],['Estado',c.active?'Ativa':'Inativa']].forEach(([k,v])=>{
      const item=el('div','list-row');item.append(el('strong','',k),el('span','',v));m.append(item);
    });
    p.append(m);root.append(p);
    if(can('Administrador'))root.append(formPanel('Editar empresa','Altera a designação e setor sem modificar o código.',[
      field('Nome da empresa','name','text',c.name),field('Setor','sector','text',c.sector)
    ],'Guardar empresa',async data=>{currentCompany=await call('/company','PATCH',data);by('company-name').textContent=currentCompany.name}));
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
  const pages={dashboard,...adminPages,...operationalPages};
  async function render(){
    const container=by('content');
    window.StockControlUXReset?.();
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
