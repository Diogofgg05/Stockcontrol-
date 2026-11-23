/* StockControl Fase 2 — operational UI against authenticated API, not demo localStorage. */
'use strict';
window.StockOperationsUI = function(h){
  const {call,el,heading,panel,table,td,button,field,select,formPanel,notify,render,canManage,canWrite,getToken}=h;
  const euro=n=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(Number(n||0));
  const num=n=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:3}).format(Number(n||0));
  const request=()=>crypto.randomUUID();
  const empty=(message)=>el('div','empty',message);
  const wrapLabel=(label,input)=>{const l=el('label');l.append(el('span','',label),input);return l};
  const choose=(label,name,items,selected)=>{
    const inp=select(items.map(x=>x.title),selected);
    inp.name=name;inp.required=true;inp.className='role-picker inventory-select';
    [...inp.options].forEach((option,i)=>option.value=items[i].id);
    return wrapLabel(label,inp);
  };
  const text=(t)=>el('strong','',t);
  const warn=(s)=>el('p','hint',s);
  const get=async paths=>Promise.all(paths.map(p=>call(p)));
  async function mutation(path,data,method='POST'){
    await call(path,method,data);
    notify('Operação guardada no servidor.');
    await render();
  }
  function actionPanel(root,title,fields,action){
    root.querySelector('#phase2-action')?.remove();
    const section=formPanel(title,'Operação validada no servidor e registada na auditoria.',fields,
      'Confirmar',async values=>action(values));
    section.id='phase2-action';root.append(section);
    section.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function quantityRow(label,name,initial='1'){
    const f=field(label,name,'number',initial);f.querySelector('input').step='0.001';f.querySelector('input').min='0';
    return f;
  }
  function metric(label,value,description){
    const node=el('div','metric');
    node.append(el('small','',label),el('strong','',value),el('span','',description));return node;
  }
  async function inventory(root){
    const [materials,warehouses,balances]=await get(['/materials','/warehouses','/balances']);
    const summary=el('div','grid-metrics');
    summary.append(metric('Referências',materials.length,'Materiais no catálogo'),
      metric('Localizações',balances.length,'Registos de stock'),
      metric('Stock baixo',materials.filter(m=>Number(m.minimum)>0&&
        balances.filter(b=>b.material_id===m.id).reduce((total,b)=>total+Number(b.available),0)
        <=Number(m.minimum)).length,'Após descontar reservas'),
      metric('Armazéns',warehouses.length,'Associados à empresa'));
    root.append(heading('CATÁLOGO INDUSTRIAL','Inventário real','Materiais e quantidades guardados na base de dados da empresa.'),summary);
    const p=panel('Materiais ('+materials.length+')','Os preços e unidades vêm da API; QR apenas identifica o material.');
    if(!materials.length)p.append(empty('Ainda não existem materiais. Cria uma referência abaixo.'));
    else p.append(table(['Referência','Categoria','Unidade','Mínimo','Custo unitário','Identificação'],materials,m=>{
      const tr=el('tr'),details=el('div');
      details.append(text(m.name),el('small','subtext',m.sku));
      tr.append(td(details),td(m.category),td(m.unit),td(num(m.minimum)),
        td(euro(m.unit_cost)));
      const tools=el('div','actions-inline');
      tools.append(button('QR SVG',async()=>{
        try{
          const response=await fetch('/api/v2/materials/'+encodeURIComponent(m.id)+'/qr.svg',{
            headers:{Authorization:'Bearer '+getToken()},cache:'no-store',credentials:'omit'});
          if(!response.ok)throw Error('Não foi possível transferir o QR ('+response.status+').');
          const file=await response.blob(),url=URL.createObjectURL(file),a=document.createElement('a');
          a.href=url;a.download='stockcontrol-'+m.sku+'-qr.svg';a.click();
          setTimeout(()=>URL.revokeObjectURL(url),1500);
        }catch(error){notify(error.message,true)}
      },'secondary'));
      tr.append(td(tools));return tr;
    }));
    root.append(p);
    const b=panel('Saldos por armazém','Disponível = físico − reservado.');
    const lookup=Object.fromEntries(materials.map(m=>[m.id,m.name+' · '+m.sku]));
    const whLookup=Object.fromEntries(warehouses.map(w=>[w.id,w.name]));
    b.append(balances.length?table(['Material','Armazém','Físico','Reservado','Disponível'],balances,bal=>{
      const tr=el('tr');
      tr.append(td(lookup[bal.material_id]||bal.material_id),td(whLookup[bal.warehouse_id]||bal.warehouse_id),
                td(num(bal.on_hand)),td(num(bal.reserved)),td(text(num(bal.available))));
      return tr;
    }):empty('Ainda não há stock físico. Usa Movimentos para registar a primeira entrada.'));
    root.append(b);
    if(canManage())root.append(formPanel('Novo material','O SKU é único dentro da empresa.',[
      field('Código SKU','sku'),field('Nome','name'),field('Categoria','category'),
      choose('Unidade','unit',[{id:'un',title:'Unidades (un)'},{id:'kg',title:'Quilogramas (kg)'},
        {id:'m',title:'Metros (m)'},{id:'L',title:'Litros (L)'}]),
      quantityRow('Stock mínimo','minimum','0'),quantityRow('Custo unitário (€)','unit_cost','0')
    ],'Adicionar material',async values=>{await call('/materials','POST',values)}));
  }
  async function stockMovements(root){
    const [materials,warehouses,entries]=await get(['/materials','/warehouses','/movements']);
    const mat=Object.fromEntries(materials.map(m=>[m.id,m]));
    const wh=Object.fromEntries(warehouses.map(w=>[w.id,w]));
    root.append(heading('RASTREABILIDADE','Movimentos de stock','Entradas, saídas, devoluções, perdas e transferências com histórico.'));
    const p=panel('Histórico de movimentos','Até 50 movimentos recentes da empresa.');
    p.append(entries.length?table(['Movimento','Material','Armazém','Quantidade','Saldo final'],entries,e=>{
      const tr=el('tr');
      tr.append(td(text(e.kind)),td(mat[e.material_id]?.name||'Material'),
        td(wh[e.warehouse_id]?.name||'Armazém'),
        td((Number(e.delta)>0?'+':'')+num(e.delta)),
        td(num(e.on_hand_after)));return tr;
    }):empty('Não há movimentos registados.'));
    root.append(p);
    if(canWrite()&&materials.length&&warehouses.length){
      root.append(formPanel('Novo movimento','A API impede saídas superiores ao disponível.',[
        choose('Armazém','warehouse_id',warehouses.map(w=>({id:w.id,title:w.name}))),
        choose('Material','material_id',materials.map(m=>({id:m.id,title:m.sku+' · '+m.name}))),
        choose('Operação','kind',['Entrada','Saída','Devolução','Perda'].map(x=>({id:x,title:x}))),
        quantityRow('Quantidade','quantity'),field('Observação','note','text','',false)
      ],'Registar movimento',async values=>{values.request_id=request();await call('/movements','POST',values)}));
      if(warehouses.length>1)root.append(formPanel('Transferir entre armazéns','A saída e a entrada são registadas na mesma transação.',[
        choose('Origem','from_warehouse_id',warehouses.map(w=>({id:w.id,title:w.name}))),
        choose('Destino','to_warehouse_id',warehouses.map(w=>({id:w.id,title:w.name}))),
        choose('Material','material_id',materials.map(m=>({id:m.id,title:m.sku+' · '+m.name}))),
        quantityRow('Quantidade','quantity'),field('Nota','note','text','',false)
      ],'Transferir material',async values=>{values.request_id=request();await call('/transfers','POST',values)}));
    }
  }
  async function reservations(root){
    const [materials,warehouses,rows]=await get(['/materials','/warehouses','/reservations']);
    root.append(heading('PLANEAMENTO','Reservas de produção','Quantidades reservadas não podem ser consumidas por saídas normais.'));
    const m=Object.fromEntries(materials.map(x=>[x.id,x]));
    const panelRows=panel('Reservas ('+rows.length+')','Consumos parciais mantêm a quantidade restante reservada.');
    panelRows.append(rows.length?table(['Ordem','Material','Quantidade','Consumido','Pendente','Estado e ações'],rows,r=>{
      const tr=el('tr');
      tr.append(td(text(r.order_ref)),td(m[r.material_id]?.name||'Material'),
        td(num(r.quantity)),td(num(r.consumed)),td(num(r.remaining)));
      const action=el('div','actions-inline');
      action.append(el('span',r.state==='Ativa'?'state':'state off',r.state));
      if(r.state==='Ativa'&&canWrite()){
        action.append(button('Consumir',()=>{
          actionPanel(root,'Consumir '+r.order_ref,[quantityRow('Quantidade a consumir','quantity',r.remaining)],
            async values=>{values.request_id=request();await call('/reservations/'+encodeURIComponent(r.id)+'/consume','POST',values)});
        },'secondary'));
        action.append(button('Cancelar',async()=>{
          if(!confirm('Cancelar saldo ainda reservado? O consumo anterior mantém-se.'))return;
          try{await mutation('/reservations/'+encodeURIComponent(r.id)+'/cancel',{})}
          catch(err){notify(err.message,true)}
        },'subtle'));
      }
      tr.append(td(action));return tr;
    }):empty('Ainda não existem reservas.'));
    root.append(panelRows);
    if(canWrite()&&materials.length&&warehouses.length)root.append(formPanel('Nova reserva','A referência é associada a uma ordem de produção.',[
      choose('Armazém','warehouse_id',warehouses.map(w=>({id:w.id,title:w.name}))),
      choose('Material','material_id',materials.map(m=>({id:m.id,title:m.sku+' · '+m.name}))),
      field('Ordem de produção','order_ref'),quantityRow('Quantidade','quantity')
    ],'Criar reserva',async values=>{await call('/reservations','POST',values)}));
  }
  async function suppliers(root){
    const suppliers=await call('/suppliers');
    const active=suppliers.filter(s=>s.active).length;
    root.append(heading('CADEIA DE FORNECIMENTO','Fornecedores',
      'Centraliza os contactos de compra, acompanha o estado de cada parceiro e mantém o histórico.'));
    const stats=el('div','stock-summary-inline');
    stats.append(metric('Fornecedores',suppliers.length,'Registados na empresa'),
      metric('Ativos',active,'Disponíveis para compras'),
      metric('Inativos',suppliers.length-active,'Sem novas encomendas'));
    root.append(stats);
    const p=panel('Diretório de fornecedores','A atualização é validada pelo servidor; não é possível desativar quem tenha encomendas em aberto.');
    p.append(suppliers.length?table(['Fornecedor','Contacto','Estado','Gestão'],suppliers,s=>{
      const tr=el('tr'),identity=el('div','stock-entity-identity');
      identity.append(el('strong','',s.name),el('small','subtext',s.code));
      tr.append(td(identity),td(s.email||'Sem email'));
      tr.append(td(el('span',s.active?'state':'state off',s.active?'Ativo':'Inativo')));
      const actions=el('div','actions-inline');
      if(canManage())actions.append(button('Editar',()=>{
        actionPanel(root,'Editar fornecedor · '+s.code,[
          field('Nome do fornecedor','name','text',s.name),
          field('Email de contacto (opcional)','email','email',s.email||'',false),
          choose('Estado','state',[
            {id:'Ativo',title:'Ativo'},{id:'Inativo',title:'Inativo'}],s.active?'Ativo':'Inativo')
        ],async data=>{
          await call('/suppliers/'+encodeURIComponent(s.id),'PATCH',{
            name:data.name,email:data.email||null,active:data.state==='Ativo'});
        });
      },'secondary'));
      tr.append(td(actions));return tr;
    }):empty('Ainda não há fornecedores. Regista o primeiro fornecedor.'));
    root.append(p);
    if(canManage())root.append(formPanel('Novo fornecedor',
      'Regista um fornecedor com um código único para esta empresa.',[
      field('Código','code'),field('Designação','name'),field('Email (opcional)','email','email','',false)
    ],'Adicionar fornecedor',async values=>{
      if(!values.email)values.email=null;
      await call('/suppliers','POST',values);
    }));
  }
  async function purchases(root){
    const [materials,warehouses,suppliers,orders]=await get(['/materials','/warehouses','/suppliers','/purchase-orders']);
    const materialNames=Object.fromEntries(materials.map(x=>[x.id,x.name]));
    const supplierNames=Object.fromEntries(suppliers.map(x=>[x.id,x.name]));
    const warehouseNames=Object.fromEntries(warehouses.map(x=>[x.id,x.name]));
    const pending=orders.filter(o=>o.state!=='Concluída');
    root.append(heading('COMPRAS INDUSTRIAIS','Encomendas',
      'Planeia as compras, regista receções parciais e atualiza o stock automaticamente.'));
    const stats=el('div','stock-summary-inline');
    stats.append(metric('Encomendas',orders.length,'Registadas'),
      metric('A receber',pending.length,'Em aberto ou parciais'),
      metric('Concluídas',orders.length-pending.length,'Recebidas integralmente'));
    root.append(stats);
    const p=panel('Encomendas e receções','Cada encomenda pode incluir até 60 materiais distintos; cada receção cria um movimento de stock.');
    const search=el('div','stock-compact-toolbar');
    const input=document.createElement('input');input.type='search';
    input.placeholder='Pesquisar código, fornecedor ou material…';
    input.setAttribute('aria-label','Pesquisar encomendas');
    const state=document.createElement('select');
    state.setAttribute('aria-label','Estado da encomenda');
    for(const [id,name] of [['','Todos os estados'],['Aberta','Em aberto'],['Parcial','Receção parcial'],['Concluída','Concluída']]){
      const opt=el('option','',name);opt.value=id;state.append(opt);
    }
    search.append(input,state);
    p.append(search);
    const list=el('div','stock-purchase-list');
    p.append(list);
    function draw(){
      list.replaceChildren();
      const query=input.value.trim().toLocaleLowerCase('pt-PT');
      const filtered=orders.filter(order=>{
        if(state.value&&order.state!==state.value)return false;
        const text=[order.code,supplierNames[order.supplier_id],...order.lines.map(l=>materialNames[l.material_id])]
          .join(' ').toLocaleLowerCase('pt-PT');
        return !query||text.includes(query);
      });
      if(!filtered.length){list.append(empty(orders.length?'Sem encomendas para estes filtros.':'Nenhuma encomenda registada.'));return}
      for(const order of filtered){
        const block=el('div','stock-purchase-block');
        const bar=el('div','stock-purchase-heading');
        const info=el('div','stock-purchase-meta');
        info.append(el('strong','',order.code),
          el('small','',String(supplierNames[order.supplier_id]||'Fornecedor')+
            ' · '+String(warehouseNames[order.warehouse_id]||'Armazém')));
        bar.append(info,el('span',order.state==='Concluída'?'state':'pill',order.state));
        block.append(bar);
        const rows=table(['Material','Encomendado','Recebido','Em falta','Ação'],order.lines,line=>{
          const tr=el('tr'),missing=Math.max(0,Number(line.ordered)-Number(line.received));
          tr.append(td(materialNames[line.material_id]||'Material'),
            td(num(line.ordered)),td(num(line.received)),td(num(missing)));
          const actions=el('div','actions-inline');
          if(missing>0&&canWrite())actions.append(button('Registar receção',()=>{
            actionPanel(root,'Receber · '+order.code,[
              quantityRow('Quantidade recebida','quantity',String(missing))
            ],async values=>{
              await call('/purchase-orders/'+encodeURIComponent(order.id)+'/receive','POST',{
                line_id:line.id,quantity:values.quantity,request_id:request()});
            });
          },'secondary'));
          tr.append(td(actions));return tr;
        });
        block.append(rows);list.append(block);
      }
    }
    input.addEventListener('input',draw);state.addEventListener('change',draw);draw();
    root.append(p);
    if(canManage()&&materials.length&&warehouses.length&&suppliers.some(s=>s.active)){
      const choices=materials.filter(m=>m.active);
      const rows=el('div','stock-purchase-line-editor');
      const addLine=button('+ Adicionar material',()=>appendLine(),'secondary');
      let counter=0;
      function appendLine(){
        const index=counter++;
        const line=el('div','stock-purchase-edit-row');
        const material=choose('Material','material_'+index,
          choices.map(m=>({id:m.id,title:m.sku+' · '+m.name})));
        const qty=quantityRow('Quantidade','quantity_'+index);
        const remove=button('Remover',()=>{
          if(rows.querySelectorAll('.stock-purchase-edit-row').length<=1)return;
          line.remove();
        },'subtle');
        remove.setAttribute('aria-label','Remover linha da encomenda');
        line.append(material,qty,remove);rows.append(line);
        addLine.disabled=rows.querySelectorAll('.stock-purchase-edit-row').length>=60;
      }
      appendLine();
      const footer=el('div','stock-purchase-add-line');
      footer.append(addLine,el('small','hint','Até 60 materiais diferentes na mesma encomenda.'));
      root.append(formPanel('Nova encomenda','Adiciona as linhas de compra e escolhe onde receber os materiais.',[
        field('Número da encomenda','code'),
        choose('Fornecedor','supplier_id',suppliers.filter(s=>s.active).map(s=>({id:s.id,title:s.name}))),
        choose('Armazém de receção','warehouse_id',warehouses.filter(w=>w.active).map(w=>({id:w.id,title:w.name}))),
        rows,footer
      ],'Criar encomenda',async data=>{
        const items=[];
        for(const [key,material_id] of Object.entries(data)){
          if(!/^material_\d+$/.test(key))continue;
          const id=key.split('_')[1],quantity=data['quantity_'+id];
          if(!material_id||!quantity||Number(quantity)<=0)
            throw Error('Indica material e quantidade positiva em todas as linhas.');
          items.push({material_id,quantity});
        }
        if(!items.length)throw Error('A encomenda necessita de pelo menos uma linha.');
        if(new Set(items.map(i=>i.material_id)).size!==items.length)
          throw Error('Não repitas o mesmo material na encomenda.');
        await call('/purchase-orders','POST',{
          code:data.code,supplier_id:data.supplier_id,
          warehouse_id:data.warehouse_id,items
        });
      }));
    }else if(!suppliers.some(s=>s.active))root.append(warn('Adiciona primeiro um fornecedor ativo.'));
  }
  async function counts(root){
    const [materials,warehouses,rows]=await get(['/materials','/warehouses','/counts']);
    const m=Object.fromEntries(materials.map(x=>[x.id,x.name]));
    root.append(heading('VERIFICAÇÃO','Inventário físico','Aprovação bloqueia se existirem reservas incompatíveis ou stock desatualizado.'));
    const p=panel('Contagens ('+rows.length+')','Registada → Aplicada ou Rejeitada.');
    p.append(rows.length?table(['Material','Stock teórico','Contado','Diferença','Estado e ações'],rows,r=>{
      const tr=el('tr'),difference=Number(r.counted)-Number(r.expected);
      tr.append(td(text(m[r.material_id]||'Material')),td(num(r.expected)),
        td(num(r.counted)),td(num(difference)));
      const actions=el('div','actions-inline');
      actions.append(el('span',r.state==='Pendente'?'state':'state off',r.state));
      if(r.state==='Pendente'&&canManage()){
        actions.append(button('Aprovar',async()=>{
          if(!confirm('Aplicar o acerto de inventário?'))return;
          try{await mutation('/counts/'+encodeURIComponent(r.id)+'/approve',{request_id:request()})}
          catch(err){notify(err.message,true)}
        },'secondary'));
        actions.append(button('Rejeitar',async()=>{
          try{await mutation('/counts/'+encodeURIComponent(r.id)+'/reject',{})}
          catch(err){notify(err.message,true)}
        },'subtle'));
      }
      tr.append(td(actions));return tr;
    }):empty('Ainda não existem contagens.'));
    root.append(p);
    if(canWrite()&&materials.length&&warehouses.length)root.append(formPanel('Nova contagem','Guarda a quantidade física e aguarda a aprovação do gestor.',[
      choose('Armazém','warehouse_id',warehouses.map(w=>({id:w.id,title:w.name}))),
      choose('Material','material_id',materials.map(m=>({id:m.id,title:m.sku+' · '+m.name}))),
      quantityRow('Quantidade contada','counted','0')
    ],'Guardar contagem',async values=>{await call('/counts','POST',values)}));
  }
  async function scanner(root){
    root.append(heading('IDENTIFICAÇÃO','Leitor de materiais','Os QR identificam materiais, mas não concedem acesso à empresa.'));
    const p=panel('Consultar código QR','O leitor recebe um código de material impresso ou copiado.');
    const form=el('form','edit-form'),input=field('Código de identificação','qr_code','text');
    form.append(input,el('p','hint','Formato: stockcontrol:material:... ou apenas o código. A leitura por câmara poderá ser acrescentada numa fase posterior.'));
    const submit=el('button','primary','Consultar material');submit.type='submit';form.append(submit);
    const result=el('div','scan-result');
    form.addEventListener('submit',async event=>{
      event.preventDefault();submit.disabled=true;result.replaceChildren();
      let code=input.querySelector('input').value.trim().replace(/^stockcontrol:material:/,'');
      try{
        const material=await call('/scan/'+encodeURIComponent(code));
        const box=el('div','scan-found');
        box.append(el('span','eyebrow','MATERIAL IDENTIFICADO'),
          el('h2','',material.name),el('p','',material.sku+' · '+material.category+' · '+material.unit));
        result.append(box);
      }catch(error){notify(error.message,true)}
      finally{submit.disabled=false}
    });
    p.append(form,result);root.append(p);
  }
  return {inventory,stockMovements,reservations,suppliers,purchases,counts,scanner};
};
