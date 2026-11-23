(function model(){
  'use strict';
  const seed = [
    {sku:'MAT-001',name:'Aço inoxidável 304',category:'Metais',unit:'kg',stock:345,min:80,location:'A1-01',cost:5.8},
    {sku:'MAT-002',name:'Parafusos M8',category:'Fixação',unit:'un',stock:24,min:100,location:'B2-04',cost:0.14},
    {sku:'MAT-003',name:'Alumínio 6061',category:'Metais',unit:'kg',stock:186,min:55,location:'A1-03',cost:4.9},
    {sku:'MAT-004',name:'Resina técnica',category:'Químicos',unit:'L',stock:0,min:25,location:'C3-01',cost:12.4},
    {sku:'MAT-005',name:'Rolamento 6204',category:'Peças',unit:'un',stock:210,min:35,location:'B1-02',cost:3.2},
    {sku:'MAT-006',name:'Cabo industrial',category:'Elétrico',unit:'m',stock:96,min:100,location:'D2-01',cost:1.15},
    {sku:'MAT-007',name:'Conector M12 4 pinos',category:'Elétrico',unit:'un',stock:72,min:30,location:'D2-02',cost:6.8},
    {sku:'MAT-008',name:'Porca M10',category:'Fixação',unit:'un',stock:520,min:150,location:'B2-05',cost:0.12}
  ];
  const demo = () => ({
    id:'demo',name:'Fábrica Demo',materials:seed.map(m=>({...m})),
    reservations:[{id:'RS-001',sku:'MAT-001',qty:30,consumed:0,order:'OP-104',status:'Ativa',createdAt:'2026-11-19T10:10:00.000Z'},{id:'RS-002',sku:'MAT-007',qty:15,consumed:0,order:'OP-105',status:'Ativa',createdAt:'2026-11-19T11:10:00.000Z'}],
    movements:[{id:'MV-001',sku:'MAT-001',type:'Entrada',qty:120,createdAt:'2026-11-19T09:42:00.000Z',actor:'Equipa demo'},{id:'MV-002',sku:'MAT-002',type:'Saída',qty:36,createdAt:'2026-11-19T09:18:00.000Z',actor:'Equipa demo'}],
    counts:[],events:[{id:'EV-001',action:'Ambiente de demonstração iniciado',actor:'Sistema',createdAt:'2026-11-19T09:00:00.000Z'}],
    documents:[],users:[{id:'USR-001',name:'Ana Silva',role:'Administrador',state:'Ativo'},{id:'USR-002',name:'Bruno Costa',role:'Operador',state:'Ativo'},{id:'USR-003',name:'Carla Reis',role:'Auditor',state:'Ativo'}],
    company:{id:'demo',name:'Fábrica Demo',sector:'Indústria e produção'},
    warehouses:[{id:'WH-001',name:'Armazém principal',code:'ARM-01',location:'Aveiro',state:'Ativo'}]
  });
  // Quando existe stock físico mas todas as unidades estão reservadas,
  // o estado não pode indicar disponibilidade para novas saídas.
  function status(m,reservations){
    const free=reservations?available(m,reservations):m.stock;
    if(m.stock===0)return 'Esgotado';
    if(free===0)return 'Sem disponibilidade';
    return free<=m.min?'Stock baixo':'Disponível';
  }
  const MAX_QTY = 1000000000;
  const preciseQty = (value,zeroAllowed=false) => {
    if(value===null||value===undefined||typeof value==='string'&&!value.trim())return false;
    const n=Number(value);
    return Number.isFinite(n) && n<=MAX_QTY && (zeroAllowed?n>=0:n>0) &&
      Number.isSafeInteger(Math.round(n*1000)) && Math.abs(n*1000-Math.round(n*1000))<1e-7;
  };
  const roundQty = n => Math.round(n*1000)/1000;
  function reservationRemaining(r){
    if(!r||r.status!=='Ativa')return 0;
    return Math.max(0,roundQty(Number(r.qty)-Number(r.consumed??0)));
  }
  function reserved(sku,reservations){
    return roundQty(reservations.filter(r=>r.sku===sku).reduce((sum,r)=>sum+reservationRemaining(r),0));
  }
  // Planeamento puro: o chamador só aplica as alterações após validação.
  // Consumir uma reserva reduz stock físico e saldo reservado na mesma quantidade.
  function planConsumption(m,r,amount,reservations){
    if(!m||!r||r.sku!==m.sku)throw Error('Reserva ou material inexistente.');
    if(r.status!=='Ativa')throw Error('A reserva já não está ativa.');
    if(!positiveQty(amount))throw Error('Indica uma quantidade positiva válida.');
    const remaining=reservationRemaining(r),qty=Number(amount);
    if(qty>remaining)throw Error('O consumo ultrapassa o saldo reservado.');
    if(qty>m.stock)throw Error('Stock físico insuficiente.');
    const stock=roundQty(m.stock-qty);
    const consumed=roundQty(Number(r.consumed??0)+qty);
    const status=consumed===r.qty?'Concluída':'Ativa';
    if(roundQty(stock-(reserved(m.sku,reservations)-qty))<0)
      throw Error('O consumo compromete outras reservas.');
    return {stock,consumed,status,used:qty,remaining:roundQty(r.qty-consumed)};
  }
  function available(m,reservations){return Math.max(0,roundQty(m.stock-reserved(m.sku,reservations)))}
  function positiveQty(value){return preciseQty(value)}
  function assertMovement(m,type,qty,reservations){
    if(!m)throw Error('Material inexistente.');
    if(!['Entrada','Saída','Devolução'].includes(type))throw Error('Tipo de movimento inválido.');
    if(!positiveQty(qty))throw Error('Introduz uma quantidade positiva (até 3 casas decimais).');
    if(type==='Saída'&&Number(qty)>available(m,reservations))throw Error('Quantidade superior ao stock disponível após reservas.');
    if(type!=='Saída'&&roundQty(m.stock+Number(qty))>MAX_QTY)throw Error('O stock máximo de demonstração foi excedido.');
    return true;
  }
  function newStock(m,type,qty,reservations){
    assertMovement(m,type,qty,reservations);
    const delta=type==='Saída'?-Number(qty):Number(qty);
    return roundQty(m.stock+delta);
  }
  function assertReservation(m,qty,reservations){
    if(!m)throw Error('Material inexistente.');
    if(!positiveQty(qty))throw Error('A quantidade tem de ser positiva.');
    if(Number(qty)>available(m,reservations))throw Error('Stock disponível insuficiente para esta reserva.');
    return true;
  }
  function assertCount(m,value){
    if(!m)throw Error('Material inexistente.');
    if(!preciseQty(value,true))throw Error('A contagem tem de ser zero ou superior (até 3 casas decimais).');
    return Number(value);
  }
  // Agregação O(materiais + reservas), em vez de recalcular todas as
  // reservas para cada linha e indicador do dashboard.
  function inventoryView(workspace){
    const reservedBySku=new Map(),statusBySku=new Map(),availableBySku=new Map();
    let active=0,low=0,out=0,blocked=0,worth=0;
    for(const r of workspace.reservations){
      if(r.status!=='Ativa')continue;
      active++;
      reservedBySku.set(r.sku,roundQty((reservedBySku.get(r.sku)||0)+reservationRemaining(r)));
    }
    for(const m of workspace.materials){
      const free=Math.max(0,roundQty(m.stock-(reservedBySku.get(m.sku)||0)));
      const state=m.stock===0?'Esgotado':free===0?'Sem disponibilidade':free<=m.min?'Stock baixo':'Disponível';
      availableBySku.set(m.sku,free);
      statusBySku.set(m.sku,state);
      if(state==='Stock baixo')low++;
      if(state==='Esgotado')out++;
      if(state==='Sem disponibilidade')blocked++;
      worth+=m.stock*Number(m.cost||0);
    }
    return {total:workspace.materials.length,low,out,blocked,active,worth,reservedBySku,statusBySku,availableBySku};
  }
  function summary(workspace){
    const {total,low,out,blocked,active,worth}=inventoryView(workspace);
    return {total,low,out,blocked,active,worth};
  }
  function validString(v,max){return typeof v==='string'&&v.length>0&&v.length<=max}
  function validId(v){return validString(v,80)}
  function validateWorkspace(w){
    if(!w||typeof w!=='object'||w.id!=='demo')return false;
    const lists={materials:5000,reservations:20000,movements:20000,counts:20000,events:200,documents:2000};
    if(!Object.entries(lists).every(([k,max])=>Array.isArray(w[k])&&w[k].length<=max))return false;
    if(!w.materials.length)return false;
    if(w.users!==undefined&&!validUsers(normalizeUsers(w.users)))return false;
    if(w.warehouses!==undefined&&!validWarehouses(normalizeWarehouses(w.warehouses)))return false;
    if(w.company!==undefined&&(!w.company||w.company.id!=='demo'||typeof w.company.name!=='string'||!w.company.name.trim()||w.company.name.length>100||typeof w.company.sector!=='string'||!w.company.sector.trim()||w.company.sector.length>100))return false;
    const skuSet=new Set();
    for(const m of w.materials){
      if(!m||typeof m!=='object'||!validString(m.sku,36)||!(/^[A-Z0-9][A-Z0-9._-]{1,35}$/.test(m.sku))||skuSet.has(m.sku)
        ||!validString(m.name,100)||!validString(m.category,40)||!validString(m.unit,10)
        ||!validString(m.location,36)||typeof m.stock!=='number'||typeof m.min!=='number'||!preciseQty(m.stock,true)||!preciseQty(m.min,true)
        ||!Number.isFinite(m.cost)||m.cost<0||m.cost>MAX_QTY)return false;
      skuSet.add(m.sku);
    }
    const refs = entries => entries.every(x=>x&&typeof x==='object'&&validId(x.id)&&skuSet.has(x.sku));
    if(!refs(w.reservations)||!refs(w.movements)||!refs(w.counts))return false;
    const unique = entries => new Set(entries.map(x=>x.id)).size===entries.length;
    if(![w.reservations,w.movements,w.counts,w.events,w.documents].every(unique))return false;
    if(!w.reservations.every(r=>{
      const consumed=r.consumed??0; // Compatibilidade com dados da primeira V4.
      return validString(r.order,40)&&typeof r.qty==='number'&&preciseQty(r.qty)
        &&typeof consumed==='number'&&preciseQty(consumed,true)&&consumed<=r.qty
        &&['Ativa','Cancelada','Concluída'].includes(r.status)
        &&(r.status==='Concluída'?consumed===r.qty:r.status!=='Ativa'||consumed<r.qty);
    }))return false;
    if(!w.movements.every(m=>typeof m.qty==='number'&&preciseQty(m.qty)&&['Entrada','Saída','Devolução','Ajuste','Consumo'].includes(m.type)
      &&validString(m.actor,100)&&(!m.note||typeof m.note==='string'&&m.note.length<=250)
      &&(m.type!=='Ajuste'||typeof m.delta==='number'&&Number.isFinite(m.delta)&&m.delta!==0
        &&preciseQty(Math.abs(m.delta))&&roundQty(Math.abs(m.delta))===m.qty)
      &&(m.type!=='Consumo'||validId(m.reservationId)&&m.delta===-m.qty
        &&w.reservations.some(r=>r.id===m.reservationId&&r.sku===m.sku))))return false;
    if(!w.counts.every(c=>typeof c.expected==='number'&&typeof c.counted==='number'&&preciseQty(c.expected,true)&&preciseQty(c.counted,true)
      &&['Pendente','Aplicada','Rejeitada'].includes(c.status)))return false;
    if(!w.documents.every(d=>d&&validId(d.id)&&validString(d.name,120)
      &&validString(d.category,40)&&Number.isFinite(d.sizeKb)&&d.sizeKb>=0&&d.sizeKb<=5120
      &&(d.sku===''||skuSet.has(d.sku))))return false;
    if(!w.events.every(e=>e&&validId(e.id)&&validString(e.action,300)&&validString(e.actor,100)))return false;
    // Não aceitar reservas ativas impossíveis, mesmo quando localStorage foi editado.
    for(const m of w.materials)if(reserved(m.sku,w.reservations)>m.stock)return false;
    return true;
  }

  // Fase 1: domínio local de administração. A autorização no browser é APENAS demonstração.
  const ADMIN_ROLES=['Administrador','Gestor','Operador','Auditor'];
  const USER_STATES=['Ativo','Inativo'];
  const activeAdmins=users=>users.filter(u=>u.role==='Administrador'&&u.state==='Ativo').length;
  function validUsers(users){
    if(!Array.isArray(users)||users.length<1||users.length>100)return false;
    const ids=new Set(),names=new Set();
    for(const user of users){
      if(!user||typeof user!=='object'||typeof user.id!=='string'||!/^[A-Z0-9-]{3,36}$/.test(user.id)
        ||typeof user.name!=='string'||!user.name.trim()||user.name.trim().length>80
        ||!ADMIN_ROLES.includes(user.role)||!USER_STATES.includes(user.state))return false;
      const folded=user.name.trim().toLocaleLowerCase('pt-PT');
      if(ids.has(user.id)||names.has(folded))return false;
      ids.add(user.id);names.add(folded);
    }
    return activeAdmins(users)>=1;
  }
  function normalizeUsers(users){
    const fallback=()=>demo().users.map(u=>({...u}));
    if(!Array.isArray(users)||!users.length)return fallback();
    const normalized=users.map((u,i)=>({
      id:typeof u?.id==='string'&&u.id?u.id:'USR-'+String(i+1).padStart(3,'0'),
      name:u?.name,role:u?.role,state:u?.state
    }));
    return validUsers(normalized)?normalized:fallback();
  }
  function createTeamUser(users,name,role){
    if(!validUsers(users))throw Error('A equipa contém dados inválidos.');
    const clean=String(name??'').trim().replace(/\s+/g,' ');
    if(!clean||clean.length>80)throw Error('Indica um nome entre 1 e 80 caracteres.');
    if(!ADMIN_ROLES.includes(role))throw Error('Papel inválido.');
    if(users.length>=100)throw Error('Limite de 100 utilizadores de demonstração.');
    if(users.some(u=>u.name.toLocaleLowerCase('pt-PT')===clean.toLocaleLowerCase('pt-PT')))throw Error('Já existe alguém com este nome.');
    let n=1,id;
    do{id='USR-'+String(n++).padStart(3,'0')}while(users.some(u=>u.id===id));
    return [...users,{id,name:clean,role,state:'Ativo'}];
  }
  function updateTeamUser(users,id,role,state){
    if(!validUsers(users))throw Error('A equipa contém dados inválidos.');
    if(!users.some(u=>u.id===id))throw Error('Utilizador inexistente.');
    if(!ADMIN_ROLES.includes(role)||!USER_STATES.includes(state))throw Error('Papel ou estado inválido.');
    const next=users.map(u=>u.id===id?{...u,role,state}:({...u}));
    if(!validUsers(next))throw Error('É obrigatório manter pelo menos um administrador ativo.');
    return next;
  }
  function updateMaterialSettings(materials,sku,patch){
    if(!Array.isArray(materials)||!materials.some(m=>m.sku===sku))throw Error('Material inexistente.');
    const location=String(patch?.location??'').trim();
    if(!location||location.length>36)throw Error('Localização inválida (1 a 36 caracteres).');
    const rawMin=patch?.min;
    if(rawMin===null||rawMin===undefined||String(rawMin).trim()===''||!preciseQty(rawMin,true))
      throw Error('Stock mínimo inválido.');
    const rawCost=patch?.cost;
    if(rawCost===null||rawCost===undefined||String(rawCost).trim()==='')
      throw Error('Custo unitário obrigatório.');
    const cost=Number(rawCost);
    if(!Number.isFinite(cost)||cost<0||cost>MAX_QTY||Math.abs(Math.round(cost*100)-cost*100)>1e-7)
      throw Error('Custo inválido (máximo 2 casas decimais).');
    return materials.map(m=>m.sku===sku?{...m,min:Number(rawMin),cost:Math.round(cost*100)/100,location}:({...m}));
  }
  function validWarehouses(warehouses){
    if(!Array.isArray(warehouses)||warehouses.length<1||warehouses.length>50)return false;
    const ids=new Set(),codes=new Set();
    for(const w of warehouses){
      if(!w||typeof w.id!=='string'||!/^[A-Z0-9-]{3,36}$/.test(w.id)
        ||typeof w.name!=='string'||!w.name.trim()||w.name.length>80
        ||typeof w.code!=='string'||!/^[A-Z0-9-]{2,24}$/.test(w.code)
        ||typeof w.location!=='string'||!w.location.trim()||w.location.length>120
        ||!USER_STATES.includes(w.state)||ids.has(w.id)||codes.has(w.code))return false;
      ids.add(w.id);codes.add(w.code);
    }
    return warehouses.some(w=>w.state==='Ativo');
  }
  function normalizeWarehouses(warehouses){
    return validWarehouses(warehouses)?warehouses.map(w=>({...w})):demo().warehouses.map(w=>({...w}));
  }
  function createWarehouse(warehouses,name,code,location){
    if(!validWarehouses(warehouses))throw Error('Armazéns inválidos.');
    const n=String(name??'').trim(),c=String(code??'').trim().toUpperCase(),loc=String(location??'').trim();
    if(!n||n.length>80||!loc||loc.length>120||!/^[A-Z0-9-]{2,24}$/.test(c))throw Error('Nome, código ou localização inválidos.');
    if(warehouses.length>=50)throw Error('Limite de armazéns de demonstração.');
    if(warehouses.some(w=>w.code===c))throw Error('Código de armazém duplicado.');
    let i=1,id;
    do{id='WH-'+String(i++).padStart(3,'0')}while(warehouses.some(w=>w.id===id));
    return [...warehouses,{id,name:n,code:c,location:loc,state:'Ativo'}];
  }
  function updateWarehouse(warehouses,id,patch){
    if(!validWarehouses(warehouses))throw Error('Armazéns inválidos.');
    if(!warehouses.some(w=>w.id===id))throw Error('Armazém inexistente.');
    const next=warehouses.map(w=>w.id===id?{...w,state:patch.state}:({...w}));
    if(!validWarehouses(next))throw Error('É obrigatório manter pelo menos um armazém ativo.');
    return next;
  }
  function updateCompany(company,patch){
    if(!company||company.id!=='demo')throw Error('Empresa inválida.');
    const name=String(patch?.name??'').trim(),sector=String(patch?.sector??'').trim();
    if(!name||name.length>100||!sector||sector.length>100)throw Error('Nome ou setor inválidos.');
    return {id:'demo',name,sector};
  }
  function reorderSuggestions(materials,reservations){
    return materials.map(m=>{
      const free=available(m,reservations),threshold=m.min;
      const needed=threshold>0&&free<=threshold?roundQty(Math.max(0,Math.min(MAX_QTY,threshold*2)-free)):0;
      return {...m,free,needed};
    }).filter(m=>m.needed>0).sort((a,b)=>(a.free/a.min)-(b.free/b.min)||a.sku.localeCompare(b.sku));
  }
  function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function csvCell(v){
    let s=String(v??'');
    // Ignorar marcas invisíveis usadas para contornar a neutralização de fórmulas.
    const leading=s.replace(/^[\s\u200b-\u200f\u2060\ufeff]+/u,'');
    if(/^[=+\-@]/.test(leading))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function toCsv(rows,headers){return '\ufeff'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n'}
  function normalizedSku(v){return String(v||'').trim().toUpperCase()}
  const api={demo,status,inventoryView,reserved,reservationRemaining,planConsumption,available,positiveQty,assertMovement,newStock,assertReservation,assertCount,summary,validateWorkspace,validUsers,normalizeUsers,createTeamUser,updateTeamUser,updateMaterialSettings,validWarehouses,normalizeWarehouses,createWarehouse,updateWarehouse,updateCompany,reorderSuggestions,escapeHTML,csvCell,toCsv,normalizedSku};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.StockModel=api;
})();
