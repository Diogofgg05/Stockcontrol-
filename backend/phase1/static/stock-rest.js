/* StockControl · Phase 2.2 — unified operational and administration workspaces.
   Native DOM only. All data and mutations pass through the authenticated API.
   Production permission checks remain SERVER-side. */
'use strict';
(()=>{
const previous=window.StockOperationsUI;
const previousReset=window.StockControlUXReset;
let openDialogs=new Set();
window.StockControlUXReset=()=>{
  previousReset?.();
  for(const d of openDialogs){if(d.open)d.close();d.remove()}
  openDialogs.clear();
};
const node=(type,cls='',content)=>{
  const e=document.createElement(type);
  if(cls)e.className=cls;
  if(content!==undefined)e.textContent=String(content);
  return e;
};
const btn=(label,fn,variant='secondary')=>{
  const b=node('button',variant,label);b.type='button';b.addEventListener('click',fn);return b;
};
const safeDate=value=>{
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toLocaleString('pt-PT'):'—';
};
const amount=x=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:3}).format(Number(x||0));
const price=x=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(Number(x||0));
const pill=(text,negative=false)=>node('span','sr-pill'+(negative?' negative':''),text);
const reqid=()=>crypto.randomUUID();
const selectNode=(name,options,value)=>{
  const sel=node('select','sr-select');sel.name=name;sel.required=true;
  for(const opt of options){
    const item=node('option','',opt.label??opt.value);item.value=opt.value;
    if(String(item.value)===String(value??''))item.selected=true;
    sel.append(item);
  }
  return sel;
};
const field=(config)=>{
  const wrap=node('label','sr-field');wrap.append(node('span','',config.label));
  let input;
  if(config.options)input=selectNode(config.name,config.options,config.value);
  else {
    input=node('input','sr-input');input.type=config.type||'text';
    input.name=config.name;
    input.value=String(config.value??'');
    if(config.min!==undefined)input.min=String(config.min);
    if(config.step!==undefined)input.step=String(config.step);
    if(config.maxLength)input.maxLength=config.maxLength;
    if(config.autoComplete)input.autocomplete=config.autoComplete;
  }
  if(config.required!==false)input.required=true;
  if(config.required===false)input.required=false;
  if(config.readonly)input.readOnly=true;
  wrap.append(input);return wrap;
};
function dialog(title,description,bodyBuilder){
  // At most one dialog; keeps modal focus rules straightforward.
  for(const d of openDialogs){if(d.open)d.close();d.remove()}
  openDialogs.clear();
  const d=node('dialog','sr-dialog');
  d.setAttribute('aria-label',title);
  const header=node('div','sr-dialog-header');
  const titles=node('div');
  titles.append(node('h2','',title),node('p','',description));
  header.append(titles,btn('Fechar',()=>d.close(),'secondary sr-close'));
  d.append(header);
  bodyBuilder(d);
  d.addEventListener('close',()=>{openDialogs.delete(d);d.remove()},{once:true});
  document.body.append(d);openDialogs.add(d);d.showModal();
  d.querySelector('input,select,button')?.focus();
  return d;
}
function formDialog({title,description,fields=[],submit='Guardar',onSave,extend=null,notify,render}){
  return dialog(title,description,d=>{
    const form=node('form','sr-dialog-form');
    const grid=node('div','sr-field-grid');
    for(const cfg of fields)grid.append(field(cfg));
    form.append(grid);
    let getExtra=()=>({});
    if(extend)getExtra=extend(form)||getExtra;
    const controls=node('div','sr-dialog-actions');
    const cancel=btn('Cancelar',()=>d.close(),'secondary');
    const save=node('button','primary',submit);save.type='submit';
    controls.append(cancel,save);form.append(controls);
    form.addEventListener('submit',async ev=>{
      ev.preventDefault();save.disabled=true;
      try{
        const payload={...Object.fromEntries(new FormData(form)),...getExtra()};
        await onSave(payload);
        d.close();notify('Alterações guardadas.');
        await render();
      }catch(error){notify(error.message||'Erro ao guardar.',true)}
      finally{save.disabled=false}
    });
    d.append(form);
  });
}
function confirmDialog(title,message,action,{notify,render}){
  dialog(title,message,d=>{
    const controls=node('div','sr-dialog-actions sr-confirm-actions');
    const no=btn('Voltar',()=>d.close(),'secondary');
    const yes=btn('Confirmar',async()=>{
      yes.disabled=true;
      try{await action();d.close();notify('Operação concluída.');await render()}
      catch(e){notify(e.message,true);yes.disabled=false}
    },'primary');
    controls.append(no,yes);d.append(controls);
  });
}
function page(root,{eyebrow,title,description,action}){
  root.classList.add('sr-page');
  const heading=node('div','page-heading');
  const left=node('div');left.append(node('span','eyebrow',eyebrow),node('h1','',title),node('p','',description));
  heading.append(left);
  if(action){const area=node('div','page-actions');area.append(action);heading.append(area)}
  root.append(heading);
  return root;
}
function panel(root,title,desc=''){
  const section=node('section','panel sr-panel'),head=node('div','panel-title');
  const text=node('div');text.append(node('h2','',title),node('p','',desc));
  head.append(text);section.append(head);root.append(section);return section;
}
function metrics(root,items){
  const grid=node('div','sr-metrics');
  for(const [label,value,desc] of items){
    const card=node('div','sr-metric');
    card.append(node('small','',label),node('strong','',value),node('span','',desc));
    grid.append(card);
  }
  root.append(grid);
}
function renderTable(container,{columns,records,searchFields=[],filterField=null,filterOptions=null,
                             pageSize=12,empty='Não existem registos.'}){
  const toolbar=node('div','sr-toolbar');
  const input=node('input','sr-search');input.type='search';
  input.placeholder='Pesquisar…';input.setAttribute('aria-label','Pesquisar na tabela');
  toolbar.append(input);
  let filter=null;
  if(filterField && filterOptions){
    filter=selectNode('sr_filter',[{value:'',label:'Todos os estados'},...filterOptions],'');
    filter.classList.add('sr-table-filter');filter.required=false;toolbar.append(filter);
  }
  const info=node('span','sr-result');
  toolbar.append(info);container.append(toolbar);
  const scroll=node('div','table-scroll sr-table-scroll');
  const table=node('table','sr-table');
  const th=node('tr');
  columns.forEach(c=>th.append(node('th','',c.label)));
  const thead=node('thead');thead.append(th);
  const tbody=node('tbody');table.append(thead,tbody);scroll.append(table);container.append(scroll);
  const nav=node('div','sr-pagination'),previous=btn('Anterior',()=>{index=Math.max(index-1,0);draw()},'secondary');
  const status=node('small'),next=btn('Seguinte',()=>{index++;draw()},'secondary');
  nav.append(previous,status,next);container.append(nav);
  let index=0;
  function draw(reset=false){
    if(reset)index=0;
    const query=input.value.trim().toLocaleLowerCase('pt-PT');
    let filtered=records.filter(r=>{
      if(filter && filter.value && String(r[filterField])!==filter.value)return false;
      if(!query)return true;
      const haystack=(searchFields.length?searchFields.map(f=>r[f]):Object.values(r))
        .join(' ').toLocaleLowerCase('pt-PT');
      return haystack.includes(query);
    });
    const total=Math.max(1,Math.ceil(filtered.length/pageSize));
    index=Math.min(index,total-1);
    const visible=filtered.slice(index*pageSize,(index+1)*pageSize);
    tbody.replaceChildren();
    for(const record of visible){
      const tr=node('tr');
      for(const col of columns){
        const cell=node('td');
        const value=col.render?col.render(record):record[col.field]??'—';
        if(value instanceof Node)cell.append(value);
        else cell.textContent=String(value);
        tr.append(cell);
      }
      tbody.append(tr);
    }
    if(!visible.length){const tr=node('tr'),td=node('td','sr-empty',empty);td.colSpan=columns.length;tr.append(td);tbody.append(tr)}
    info.textContent=filtered.length+' de '+records.length+' registos';
    status.textContent='Página '+(index+1)+' de '+total;
    previous.disabled=index===0;next.disabled=index>=total-1;
  }
  input.addEventListener('input',()=>draw(true));
  filter?.addEventListener('change',()=>draw(true));
  draw();
}
const options=(rows,nameFn)=>rows.map(x=>({value:x.id,label:nameFn(x)}));
const summary=(r)=>node('strong','',r);
const cellGroup=(primary,secondary)=>{
  const n=node('div','sr-cell-info');n.append(node('strong','',primary));
  if(secondary)n.append(node('small','',secondary));
  return n;
};
const actions=(...items)=>{const wrap=node('div','sr-actions');wrap.append(...items);return wrap};
function numberField(label,name,value='1',whole=false){
  return {label,name,type:'number',value,step:whole?'1':'0.001',min:'0'};
}
const toolbarMessage=(root,label)=>{const s=node('p','sr-note',label);root.append(s)};
function operationalPages(h){
  const {call,canWrite,canManage,notify,render}=h;
  async function stockMovements(root){
    const [materials,warehouses,records]=await Promise.all([call('/materials'),call('/warehouses'),call('/movements?limit=100')]);
    const names=Object.fromEntries(materials.map(m=>[m.id,m]));
    const loc=Object.fromEntries(warehouses.map(w=>[w.id,w]));
    const create=()=>formDialog({
      title:'Registar movimento',description:'Entrada, saída, devolução ou perda. Uma saída não pode consumir stock reservado.',
      fields:[
        {label:'Armazém',name:'warehouse_id',options:options(warehouses,x=>x.name)},
        {label:'Material',name:'material_id',options:options(materials,x=>x.sku+' · '+x.name)},
        {label:'Tipo',name:'kind',options:['Entrada','Saída','Devolução','Perda'].map(v=>({value:v,label:v}))},
        {...numberField('Quantidade','quantity')},
        {label:'Observação',name:'note',required:false}
      ],submit:'Registar movimento',onSave:v=>call('/movements','POST',{...v,request_id:request}),notify,render
    });
    const request=reqid(); // stable across resubmits from the same modal
    const transfer=()=>{
      const request=reqid();
      return formDialog({
        title:'Transferir material',description:'Origem e destino atualizados numa só transação.',
        fields:[
          {label:'Armazém de origem',name:'from_warehouse_id',options:options(warehouses,x=>x.name)},
          {label:'Armazém de destino',name:'to_warehouse_id',options:options(warehouses,x=>x.name)},
          {label:'Material',name:'material_id',options:options(materials,x=>x.sku+' · '+x.name)},
          {...numberField('Quantidade','quantity')},{label:'Nota',name:'note',required:false}
        ],submit:'Confirmar transferência',
        onSave:v=>call('/transfers','POST',{...v,request_id:request}),notify,render
      });
    };
    const buttons=node('div','sr-actions');
    if(canWrite()&&materials.length&&warehouses.length)buttons.append(btn('Registar movimento',create,'primary'));
    if(canWrite()&&materials.length&&warehouses.filter(w=>w.active).length>1)buttons.append(btn('Transferir material',transfer));
    page(root,{eyebrow:'OPERAÇÕES',title:'Movimentos de stock',description:'Histórico e operações autenticadas, por armazém e material.',action:buttons});
    const enters=records.filter(x=>Number(x.delta)>0).length, exits=records.filter(x=>Number(x.delta)<0).length;
    metrics(root,[['Movimentos recentes',records.length,'Últimos 100 movimentos'],['Entradas',enters,'No histórico apresentado'],['Saídas',exits,'No histórico apresentado']]);
    const p=panel(root,'Histórico de movimentos','Transferências geram uma linha para saída e outra para entrada.');
    const rows=records.map(x=>({...x,material_name:names[x.material_id]?.name||'Material',warehouse_name:loc[x.warehouse_id]?.name||'Armazém'}));
    renderTable(p,{columns:[
      {label:'Movimento',render:x=>pill(x.kind)},
      {label:'Material',render:x=>cellGroup(x.material_name,names[x.material_id]?.sku)},
      {label:'Armazém',field:'warehouse_name'},
      {label:'Variação',render:x=>node('strong',Number(x.delta)<0?'sr-negative':'sr-positive',(Number(x.delta)>0?'+':'')+amount(x.delta))},
      {label:'Stock final',render:x=>amount(x.on_hand_after)},
      {label:'Data',render:x=>safeDate(x.created_at)}
    ],records:rows,searchFields:['kind','material_name','warehouse_name'],pageSize:12,
    empty:'Ainda não foram registados movimentos.'});
  }
  async function reservations(root){
    const [materials,warehouses,reservations]=await Promise.all([call('/materials'),call('/warehouses'),call('/reservations')]);
    const names=Object.fromEntries(materials.map(m=>[m.id,m]));
    const locations=Object.fromEntries(warehouses.map(w=>[w.id,w.name]));
    const create=()=>formDialog({title:'Criar reserva',description:'Reserva o stock para uma ordem de produção.',
      fields:[
        {label:'Armazém',name:'warehouse_id',options:options(warehouses,x=>x.name)},
        {label:'Material',name:'material_id',options:options(materials,x=>x.sku+' · '+x.name)},
        {label:'Ordem de produção',name:'order_ref',maxLength:50},
        numberField('Quantidade','quantity')],
      submit:'Criar reserva',onSave:v=>call('/reservations','POST',v),notify,render});
    page(root,{eyebrow:'PLANEAMENTO',title:'Reservas de produção',description:'Materiais reservados para ordens de fabrico e consumos controlados.',
      action:canWrite()&&materials.length&&warehouses.length?btn('Nova reserva',create,'primary'):null});
    const active=reservations.filter(r=>r.state==='Ativa');
    metrics(root,[['Total de reservas',reservations.length,'Todas as ordens'],['Ativas',active.length,'Aguardam consumo'],['Concluídas',reservations.filter(r=>r.state==='Concluída').length,'Consumo finalizado']]);
    const p=panel(root,'Reservas por ordem','As reservas impedem saídas indevidas de materiais.');
    const rows=reservations.map(r=>({...r,material_name:names[r.material_id]?.name||'Material',warehouse_name:locations[r.warehouse_id]||'Armazém'}));
    renderTable(p,{columns:[
      {label:'Ordem',render:r=>cellGroup(r.order_ref,r.warehouse_name)},
      {label:'Material',field:'material_name'},
      {label:'Reservado',render:r=>amount(r.quantity)},
      {label:'Consumido',render:r=>amount(r.consumed)},
      {label:'Pendente',render:r=>summary(amount(r.remaining))},
      {label:'Estado',render:r=>pill(r.state,r.state==='Cancelada')},
      {label:'Ações',render:r=>{
        if(!canWrite()||r.state!=='Ativa')return node('small','sr-muted','Apenas leitura');
        return actions(btn('Consumir',()=>{
          const request=reqid();
          formDialog({title:'Consumir da reserva '+r.order_ref,description:'O valor não pode ultrapassar o saldo reservado.',
            fields:[numberField('Quantidade a consumir','quantity',r.remaining)],
            submit:'Registar consumo',onSave:v=>call('/reservations/'+encodeURIComponent(r.id)+'/consume','POST',{...v,request_id:request}),
            notify,render});
        }),btn('Cancelar',()=>confirmDialog('Cancelar reserva','Apenas o saldo não consumido é libertado.',
          ()=>call('/reservations/'+encodeURIComponent(r.id)+'/cancel','POST',{}),{notify,render})));
      }}
    ],records:rows,searchFields:['order_ref','material_name','warehouse_name','state'],
    filterField:'state',filterOptions:['Ativa','Concluída','Cancelada'].map(v=>({value:v,label:v})),empty:'Ainda não existem reservas de produção.'});
  }
  async function suppliers(root){
    const rows=await call('/suppliers');
    const create=()=>formDialog({
      title:'Novo fornecedor',description:'Fornecedor privado desta empresa.',
      fields:[{label:'Código',name:'code',maxLength:30},{label:'Designação',name:'name',maxLength:100},
        {label:'Email (opcional)',name:'email',type:'email',required:false}],
      submit:'Adicionar fornecedor',
      onSave:v=>call('/suppliers','POST',{...v,email:v.email||null}),notify,render});
    page(root,{eyebrow:'CADEIA DE FORNECIMENTO',title:'Fornecedores',
      description:'Contactos, estado e relações com as encomendas de materiais.',
      action:canManage()?btn('Novo fornecedor',create,'primary'):null});
    metrics(root,[['Fornecedores',rows.length,'Registos da empresa'],['Ativos',rows.filter(x=>x.active).length,'Disponíveis para compras'],['Inativos',rows.filter(x=>!x.active).length,'Histórico preservado']]);
    const p=panel(root,'Diretório de fornecedores','Os códigos são únicos na empresa; fornecedores com compras pendentes não podem ser desativados.');
    renderTable(p,{records:rows,columns:[
      {label:'Fornecedor',render:r=>cellGroup(r.name,r.code)},
      {label:'Email',render:r=>r.email||'—'},
      {label:'Estado',render:r=>pill(r.active?'Ativo':'Inativo',!r.active)},
      {label:'Ações',render:r=>{
        if(!canManage())return node('small','sr-muted','Apenas leitura');
        return actions(btn('Editar',()=>formDialog({
          title:'Editar fornecedor',description:'Atualizar designação, contacto e estado.',
          fields:[{label:'Código',name:'code',value:r.code,readonly:true},
            {label:'Designação',name:'name',value:r.name,maxLength:100},
            {label:'Email',name:'email',type:'email',value:r.email||'',required:false},
            {label:'Estado',name:'active',options:[{value:'true',label:'Ativo'},{value:'false',label:'Inativo'}],
              value:String(r.active)}],
          submit:'Guardar alterações',
          onSave:v=>call('/suppliers/'+encodeURIComponent(r.id),'PATCH',{
            name:v.name,email:v.email||null,active:v.active==='true'}),notify,render
        })));
      }}
    ],searchFields:['name','code','email'],records:rows,filterField:'active',
      filterOptions:[{value:'true',label:'Ativos'},{value:'false',label:'Inativos'}],
      empty:'Adiciona o primeiro fornecedor para iniciar compras.'});
  }
  async function purchases(root){
    const [materials,warehouses,suppliers,orders]=await Promise.all([call('/materials'),call('/warehouses'),call('/suppliers'),call('/purchase-orders')]);
    const m=Object.fromEntries(materials.map(x=>[x.id,x])),w=Object.fromEntries(warehouses.map(x=>[x.id,x]));
    const su=Object.fromEntries(suppliers.map(x=>[x.id,x]));
    const create=()=>formDialog({
      title:'Nova encomenda',description:'Podes adicionar até 60 materiais distintos; a receção parcial é permitida.',
      fields:[
        {label:'Código de encomenda',name:'code',maxLength:40},
        {label:'Fornecedor',name:'supplier_id',options:options(suppliers.filter(x=>x.active),x=>x.name)},
        {label:'Armazém de destino',name:'warehouse_id',options:options(warehouses.filter(x=>x.active),x=>x.name)}],
      submit:'Criar encomenda',notify,render,
      extend:form=>{
        const section=node('div','sr-lines'),top=node('div','sr-lines-top');
        top.append(node('h3','','Linhas de material'));
        const add=btn('Adicionar linha',()=>appendLine());
        top.append(add);section.append(top);
        const holder=node('div','sr-line-holder');
        section.append(holder);form.append(section);
        function appendLine(){
          if(holder.children.length>=60)return;
          const row=node('div','sr-purchase-line');
          const selected=selectNode('line_material',options(materials.filter(x=>x.active),x=>x.sku+' · '+x.name));
          const quantity=node('input','sr-input');quantity.type='number';quantity.name='line_qty';quantity.min='0.001';quantity.step='0.001';quantity.value='1';quantity.required=true;
          row.append(selected,quantity,btn('Remover',()=>{if(holder.children.length>1)row.remove()}));
          holder.append(row);
        }
        appendLine();
        return ()=>{
          const lines=[...holder.children].map(row=>({
            material_id:row.querySelector('select').value,
            quantity:row.querySelector('input').value
          }));
          if(!lines.length||new Set(lines.map(x=>x.material_id)).size!==lines.length)
            throw Error('Escolhe materiais diferentes nas linhas da encomenda.');
          return {items:lines};
        };
      },
      onSave:v=>call('/purchase-orders','POST',{code:v.code,supplier_id:v.supplier_id,
        warehouse_id:v.warehouse_id,items:v.items})
    });
    page(root,{eyebrow:'COMPRAS',title:'Encomendas',description:'Compras industriais com várias linhas e receções parciais.',
      action:canManage()&&materials.length&&suppliers.some(s=>s.active)&&warehouses.some(w=>w.active)?
        btn('Nova encomenda',create,'primary'):null});
    metrics(root,[['Encomendas',orders.length,'Registadas na empresa'],
      ['Em aberto',orders.filter(x=>x.state==='Aberta').length,'Aguardam receção'],
      ['Parciais',orders.filter(x=>x.state==='Parcial').length,'Materiais ainda pendentes'],
      ['Concluídas',orders.filter(x=>x.state==='Concluída').length,'Totalmente recebidas']]);
    const p=panel(root,'Encomendas de compra','Abre uma encomenda para consultar linhas, quantidades e receções.');
    const rows=orders.map(o=>({...o,supplier_name:su[o.supplier_id]?.name||'Fornecedor',warehouse_name:w[o.warehouse_id]?.name||'Armazém'}));
    function inspect(o){
      dialog('Encomenda '+o.code,'Receções concluídas e materiais por receber.',d=>{
        const wrap=node('div','sr-order-lines');
        for(const line of o.lines){
          const pending=Number(line.ordered)-Number(line.received);
          const item=node('div','sr-order-line');
          item.append(cellGroup(m[line.material_id]?.name||'Material',m[line.material_id]?.sku));
          item.append(node('span','',amount(line.received)+' / '+amount(line.ordered)));
          if(pending>0&&canWrite())item.append(btn('Receber '+amount(pending),()=>{
            const request=reqid();
            formDialog({title:'Receção · '+o.code,description:'Registo de entrada de material no armazém '+o.warehouse_name,
              fields:[numberField('Quantidade recebida','quantity',String(pending))],
              submit:'Confirmar receção',
              onSave:v=>call('/purchase-orders/'+encodeURIComponent(o.id)+'/receive','POST',{
                line_id:line.id,quantity:v.quantity,request_id:request}),notify,render});
          }));
          wrap.append(item);
        }
        d.append(wrap);
      });
    }
    renderTable(p,{records:rows,columns:[
      {label:'Encomenda',render:o=>cellGroup(o.code,o.warehouse_name)},
      {label:'Fornecedor',field:'supplier_name'},
      {label:'Linhas',render:o=>o.lines.length},
      {label:'Estado',render:o=>pill(o.state)},
      {label:'Ação',render:o=>btn('Ver linhas / Receber',()=>inspect(o))}
    ],searchFields:['code','supplier_name','warehouse_name','state'],
    filterField:'state',filterOptions:['Aberta','Parcial','Concluída'].map(v=>({value:v,label:v})),
    empty:'Ainda não existem encomendas. Cria uma após registar um fornecedor.'});
    if(!suppliers.length)toolbarMessage(root,'Começa por criar um fornecedor na secção Fornecedores.');
  }
  async function counts(root){
    const [materials,warehouses,counts]=await Promise.all([call('/materials'),call('/warehouses'),call('/counts')]);
    const m=Object.fromEntries(materials.map(x=>[x.id,x.name])),
      w=Object.fromEntries(warehouses.map(x=>[x.id,x.name]));
    const create=()=>formDialog({title:'Nova contagem física',
      description:'O ajuste só é aplicado depois de um gestor aprovar.',
      fields:[{label:'Armazém',name:'warehouse_id',options:options(warehouses.filter(x=>x.active),x=>x.name)},
        {label:'Material',name:'material_id',options:options(materials.filter(x=>x.active),x=>x.sku+' · '+x.name)},
        numberField('Quantidade contada','counted','0')],
      submit:'Guardar contagem',onSave:v=>call('/counts','POST',v),notify,render});
    page(root,{eyebrow:'VERIFICAÇÃO',title:'Inventário físico',
      description:'Contagens verificadas com saldos e reservas, sem correções silenciosas.',
      action:canWrite()&&warehouses.length&&materials.length?btn('Nova contagem',create,'primary'):null});
    metrics(root,[['Contagens',counts.length,'Registadas'],
      ['Pendentes',counts.filter(x=>x.state==='Pendente').length,'Aguardam validação'],
      ['Aplicadas',counts.filter(x=>x.state==='Aplicada').length,'Ajustes confirmados'],
      ['Rejeitadas',counts.filter(x=>x.state==='Rejeitada').length,'Sem alterar stock']]);
    const p=panel(root,'Conferências do armazém','Se o saldo tiver mudado entretanto, é necessário recontar.');
    const rows=counts.map(x=>({...x,material_name:m[x.material_id]||'Material',
      warehouse_name:w[x.warehouse_id]||'Armazém',difference:Number(x.counted)-Number(x.expected)}));
    renderTable(p,{records:rows,columns:[
      {label:'Material',render:r=>cellGroup(r.material_name,r.warehouse_name)},
      {label:'Sistema',render:r=>amount(r.expected)},
      {label:'Contado',render:r=>amount(r.counted)},
      {label:'Diferença',render:r=>node('strong',r.difference<0?'sr-negative':'sr-positive',amount(r.difference))},
      {label:'Estado',render:r=>pill(r.state,r.state==='Rejeitada')},
      {label:'Ações',render:r=>{
        if(r.state!=='Pendente'||!canManage())return node('small','sr-muted','Sem ações');
        return actions(btn('Aprovar',()=>confirmDialog('Aprovar contagem',
          'O inventário será ajustado após revalidar o saldo atual.',
          ()=>call('/counts/'+encodeURIComponent(r.id)+'/approve','POST',{request_id:reqid()}),
          {notify,render})),btn('Rejeitar',()=>confirmDialog('Rejeitar contagem',
          'O stock não será alterado.',
          ()=>call('/counts/'+encodeURIComponent(r.id)+'/reject','POST',{}),{notify,render})));
      }}
    ],searchFields:['material_name','warehouse_name','state'],filterField:'state',
    filterOptions:['Pendente','Aplicada','Rejeitada'].map(x=>({value:x,label:x})),
    empty:'Ainda não existem contagens físicas.'});
  }
  return {stockMovements,reservations,suppliers,purchases,counts};
}
window.StockOperationsUI=function(h){
  const pages=previous(h);
  return {...pages,...operationalPages(h)};
};
window.StockAdminPages=function(h){
  const {call,stock,render,notify,canAdmin,canManage,canAudit,canUsers}=h;
  async function users(root){
    const users=await call('/users');
    const create=()=>formDialog({title:'Novo utilizador',
      description:'A palavra-passe inicial é definida aqui e nunca guardada na interface.',
      fields:[{label:'Nome completo',name:'name',maxLength:80},
        {label:'Email',name:'email',type:'email'},
        {label:'Perfil',name:'role',options:['Operador','Gestor','Auditor','Administrador'].map(v=>({value:v,label:v}))},
        {label:'Palavra-passe inicial',name:'password',type:'password',autoComplete:'new-password'}],
      submit:'Criar utilizador',onSave:v=>call('/users','POST',v),notify,render});
    page(root,{eyebrow:'EQUIPA',title:'Utilizadores',
      description:'Perfis, contas e permissões controladas pelo servidor.',
      action:canAdmin()?btn('Adicionar utilizador',create,'primary'):null});
    metrics(root,[['Utilizadores',users.length,'Registados'],['Ativos',users.filter(u=>u.active).length,'Com acesso permitido'],
      ['Administradores',users.filter(u=>u.role==='Administrador'&&u.active).length,'Pelo menos um obrigatório']]);
    const p=panel(root,'Gestão de equipa','Alterações de funções e estados ficam registadas na auditoria.');
    renderTable(p,{records:users.map(x=>({...x,status:x.active?'Ativo':'Inativo'})),columns:[
      {label:'Colaborador',render:u=>cellGroup(u.name,u.email)},
      {label:'Perfil',render:u=>pill(u.role)},
      {label:'Estado',render:u=>pill(u.status,!u.active)},
      {label:'Ações',render:u=>{
        if(!canAdmin())return node('small','sr-muted','Apenas leitura');
        return actions(btn('Editar',()=>formDialog({title:'Editar utilizador',
          description:'O último administrador ativo não pode ser desativado.',
          fields:[{label:'Nome',name:'name',value:u.name,maxLength:80},
            {label:'Perfil',name:'role',value:u.role,options:['Administrador','Gestor','Operador','Auditor'].map(x=>({value:x,label:x}))},
            {label:'Estado',name:'active',value:String(u.active),options:[
              {value:'true',label:'Ativo'},{value:'false',label:'Inativo'}]}],
          submit:'Guardar utilizador',
          onSave:v=>call('/users/'+encodeURIComponent(u.id),'PATCH',{name:v.name,role:v.role,active:v.active==='true'}),
          notify,render
        })),btn('Redefinir senha',()=>formDialog({title:'Redefinir palavra-passe',
          description:'Todas as sessões atuais deste utilizador serão revogadas.',
          fields:[{label:'Nova palavra-passe',name:'password',type:'password',autoComplete:'new-password'}],
          submit:'Redefinir',onSave:v=>call('/users/'+encodeURIComponent(u.id)+'/reset-password','POST',v),
          notify,render})));
      }}
    ],searchFields:['name','email','role','status'],filterField:'status',
      filterOptions:[{value:'Ativo',label:'Ativos'},{value:'Inativo',label:'Inativos'}],
      empty:'Não existem utilizadores para apresentar.'});
    const rules=panel(root,'Perfis e permissões','As permissões são verificadas em cada operação da API.');
    const perm=node('div','sr-permissions');
    [['Administrador','Gestão de empresa, acessos, armazéns e operações.'],
      ['Gestor','Materiais, fornecedores, compras, armazéns e aprovações.'],
      ['Operador','Movimentos, reservas, receções e contagens, sem aprovar.'],
      ['Auditor','Consulta de stock, documentos operacionais e auditoria.']]
      .forEach(([role,desc])=>{const item=node('div','sr-permission');item.append(pill(role),node('span','',desc));perm.append(item)});
    rules.append(perm);
  }
  async function warehouses(root){
    const rows=await call('/warehouses');
    const [balances,orders]=await Promise.all([stock('/balances'),stock('/purchase-orders')]);
    const totals=new Map();
    for(const b of balances){
      const entry=totals.get(b.warehouse_id)||{references:0,reserved:0,stock:0};
      entry.references++;entry.stock+=Number(b.on_hand);entry.reserved+=Number(b.reserved);
      totals.set(b.warehouse_id,entry);
    }
    const create=()=>formDialog({title:'Novo armazém',description:'Cria um armazém associado à empresa.',
      fields:[{label:'Código',name:'code',maxLength:24},{label:'Designação',name:'name',maxLength:80},
        {label:'Localização',name:'location',maxLength:120}],
      submit:'Criar armazém',onSave:v=>call('/warehouses','POST',v),notify,render});
    page(root,{eyebrow:'ESTRUTURA',title:'Armazéns',description:'Localizações, saldos e disponibilidade de cada armazém.',
      action:canManage()?btn('Novo armazém',create,'primary'):null});
    metrics(root,[['Armazéns',rows.length,'Total registado'],['Ativos',rows.filter(w=>w.active).length,'Disponíveis'],
      ['Referências por local',balances.length,'Saldos registados']]);
    const p=panel(root,'Armazéns da empresa','Não é possível desativar um armazém com stock ou encomendas pendentes.');
    renderTable(p,{records:rows.map(w=>({...w,status:w.active?'Ativo':'Inativo'})),columns:[
      {label:'Armazém',render:w=>cellGroup(w.name,w.code)},
      {label:'Localização',field:'location'},
      {label:'Referências',render:w=>totals.get(w.id)?.references||0},
      {label:'Compras pendentes',render:w=>orders.filter(o=>o.warehouse_id===w.id&&o.state!=='Concluída').length},
      {label:'Estado',render:w=>pill(w.status,!w.active)},
      {label:'Ações',render:w=>!canManage()?node('small','sr-muted','Apenas leitura'):
        btn('Editar',()=>formDialog({title:'Editar armazém',
          description:'Código permanente; nome, localização e estado podem ser alterados.',
          fields:[{label:'Código',name:'code',value:w.code,readonly:true},
            {label:'Nome',name:'name',value:w.name},{label:'Localização',name:'location',value:w.location},
            {label:'Estado',name:'active',value:String(w.active),options:[
              {value:'true',label:'Ativo'},{value:'false',label:'Inativo'}]}],
          submit:'Guardar armazém',
          onSave:v=>call('/warehouses/'+encodeURIComponent(w.id),'PATCH',{
            name:v.name,location:v.location,active:v.active==='true'}),notify,render}))}
    ],searchFields:['name','code','location','status'],filterField:'status',
    filterOptions:[{value:'Ativo',label:'Ativos'},{value:'Inativo',label:'Inativos'}],
    empty:'Não existem armazéns.'});
  }
  async function company(root){
    const company=await call('/company');
    const edit=()=>formDialog({title:'Editar empresa',description:'O código de empresa não pode ser alterado.',
      fields:[{label:'Nome da empresa',name:'name',value:company.name,maxLength:100},
        {label:'Setor de atividade',name:'sector',value:company.sector,maxLength:100}],
      submit:'Guardar empresa',onSave:async v=>{
        const updated=await call('/company','PATCH',v);
        document.getElementById('company-name').textContent=updated.name;
      },notify,render});
    page(root,{eyebrow:'ADMINISTRAÇÃO',title:'Definições da empresa',
      description:'Identificação e isolamento de dados empresariais.',
      action:canAdmin()?btn('Editar empresa',edit,'primary'):null});
    const p=panel(root,'Identificação','Os dados pertencem exclusivamente à empresa autenticada.');
    const info=node('div','sr-company-profile');
    const mark=node('div','sr-company-mark',company.name?.trim()?.[0]?.toUpperCase()||'S');
    const content=node('div','sr-company-details');
    content.append(node('h2','',company.name),node('p','',company.sector));
    info.append(mark,content,pill(company.active?'Ativa':'Inativa',!company.active));
    p.append(info);
    const detail=node('div','sr-detail-grid');
    for(const [k,v] of [['Código de empresa',company.code],['Setor',company.sector],
      ['Identificador',company.id],['Estado',company.active?'Ativa':'Inativa']]){
      const item=node('div');item.append(node('small','',k),node('strong','',v));detail.append(item);
    }
    p.append(detail);
    const security=panel(root,'Segurança e privacidade','Estas regras encontram-se aplicadas na API de administração.');
    const list=node('div','sr-permissions');
    for(const label of ['Os dados operacionais são filtrados pela empresa autenticada.',
      'As permissões são verificadas no servidor, não apenas no navegador.',
      'As alterações ficam associadas a um utilizador no histórico de auditoria.',
      'Para produção ainda são necessários MFA, TLS, backups e migrações.']){
      const r=node('div','sr-permission');r.append(node('span','sr-check','✓'),node('span','',label));list.append(r);
    }security.append(list);
  }
  async function audit(root){
    page(root,{eyebrow:'RASTREABILIDADE',title:'Auditoria',
      description:'Eventos de acesso e operações no servidor, apenas para consulta.'});
    const p=panel(root,'Histórico de atividades','Filtros no servidor por tipo de ação e entidade, com páginas de 40 eventos.');
    const toolbar=node('div','sr-audit-filters');
    const kind=selectNode('action',[
      {value:'',label:'Todas as ações'},
      ...['auth.login','auth.logout','user.created','user.updated','user.password_reset',
        'company.updated','warehouse.created','warehouse.updated','material.created',
        'stock.entrada','stock.saída','stock.devolução','stock.perda','stock.transferred',
        'reservation.created','reservation.consumed','reservation.cancelled',
        'purchase.created','purchase.received','count.created','count.approved','count.rejected',
        'supplier.created','supplier.updated','material.photo_uploaded','material.photo_deleted']
        .map(v=>({value:v,label:v}))], '');
    const entity=selectNode('target_type',[
      {value:'',label:'Todas as entidades'},...['user','company','warehouse','material','supplier','reservation','purchase','count']
        .map(v=>({value:v,label:v}))],'');
    const exportBtn=btn('Exportar esta página CSV',()=>exportCSV(), 'secondary');
    toolbar.append(kind,entity,exportBtn);p.append(toolbar);
    const holder=node('div','sr-audit-result');p.append(holder);
    const nav=node('div','sr-pagination');
    const prev=btn('Anterior',()=>{offset=Math.max(0,offset-40);void load()},'secondary');
    const status=node('small'),next=btn('Seguinte',()=>{offset+=40;void load()},'secondary');
    nav.append(prev,status,next);p.append(nav);
    let offset=0,records=[],queryVersion=0;
    async function load(){
      const request=++queryVersion;
      holder.replaceChildren(node('p','sr-note','A carregar histórico…'));
      const qs=new URLSearchParams({limit:'40',offset:String(offset)});
      if(kind.value)qs.set('action',kind.value);
      if(entity.value)qs.set('target_type',entity.value);
      try{
        const items=await call('/audit?'+qs);
        if(request!==queryVersion||!root.isConnected)return;
        records=items;
        holder.replaceChildren();
        const wrap=node('div','table-scroll'),table=node('table','sr-table'),head=node('tr');
        ['Data','Ação','Entidade','Utilizador','Registo'].forEach(x=>head.append(node('th','',x)));
        const thead=node('thead');thead.append(head);table.append(thead);
        const body=node('tbody');
        for(const e of records){const tr=node('tr');
          for(const value of [safeDate(e.created_at),e.action,e.target_type,e.actor_id||'—',e.target_id]){
            tr.append(node('td','',value))}
          body.append(tr);
        }
        if(!records.length){const tr=node('tr');const td=node('td','sr-empty','Não há eventos para este filtro.');td.colSpan=5;tr.append(td);body.append(tr)}
        table.append(body);wrap.append(table);holder.append(wrap);
        prev.disabled=offset===0;next.disabled=items.length<40;
        status.textContent='Registos '+(offset+1)+' a '+(offset+items.length);
      }catch(e){holder.replaceChildren(node('p','sr-empty',e.message));next.disabled=true;notify(e.message,true)}
    }
    const reset=()=>{offset=0;void load()};
    kind.addEventListener('change',reset);entity.addEventListener('change',reset);
    function exportCSV(){
      if(!records.length){notify('Não há eventos nesta página para exportar.',true);return}
      const csvVal=v=>{
        const raw=String(v??'');
        const escaped=/^[\s]*[=+\-@\t\r]/.test(raw)?"'"+raw:raw;
        return '"'+escaped.replace(/"/g,'""')+'"';
      };
      const lines=[['Data','Ação','Entidade','Utilizador','Identificador','Detalhe'],
        ...records.map(e=>[e.created_at,e.action,e.target_type,e.actor_id,e.target_id,e.detail])]
        .map(row=>row.map(csvVal).join(';'));
      const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='stockcontrol-auditoria.csv';
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    await load();
  }
  return {users,warehouses,company,audit};
};
})();