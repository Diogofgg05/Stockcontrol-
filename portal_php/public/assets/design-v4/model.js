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
    reservations:[{id:'RS-001',sku:'MAT-001',qty:30,order:'OP-104',status:'Ativa',createdAt:'2026-11-19T10:10:00.000Z'},{id:'RS-002',sku:'MAT-007',qty:15,order:'OP-105',status:'Ativa',createdAt:'2026-11-19T11:10:00.000Z'}],
    movements:[{id:'MV-001',sku:'MAT-001',type:'Entrada',qty:120,createdAt:'2026-11-19T09:42:00.000Z',actor:'Equipa demo'},{id:'MV-002',sku:'MAT-002',type:'Saída',qty:36,createdAt:'2026-11-19T09:18:00.000Z',actor:'Equipa demo'}],
    counts:[],events:[{id:'EV-001',action:'Ambiente de demonstração iniciado',actor:'Sistema',createdAt:'2026-11-19T09:00:00.000Z'}],
    documents:[],users:[{name:'Ana Silva',role:'Administrador',state:'Ativo'},{name:'Bruno Costa',role:'Operador',state:'Ativo'},{name:'Carla Reis',role:'Auditor',state:'Ativo'}]
  });
  function status(m){if(m.stock===0)return'Esgotado';return m.stock<=m.min?'Stock baixo':'Disponível'}
  function reserved(sku,reservations){return reservations.filter(r=>r.sku===sku&&r.status==='Ativa').reduce((sum,r)=>sum+r.qty,0)}
  function available(m,reservations){return Math.max(0,Math.round((m.stock-reserved(m.sku,reservations))*1000)/1000)}
  function positiveQty(value){const n=Number(value);return Number.isFinite(n)&&n>0&&Math.round(n*1000)===n*1000}
  function assertMovement(m,type,qty,reservations){if(!m)throw Error('Material inexistente.');if(!['Entrada','Saída','Devolução'].includes(type))throw Error('Tipo de movimento inválido.');if(!positiveQty(qty))throw Error('Introduz uma quantidade positiva (até 3 casas decimais).');if(type==='Saída'&&Number(qty)>available(m,reservations))throw Error('Quantidade superior ao stock disponível após reservas.');return true}
  function newStock(m,type,qty,reservations){assertMovement(m,type,qty,reservations);const delta=type==='Saída'?-Number(qty):Number(qty);return Math.round((m.stock+delta)*1000)/1000}
  function assertReservation(m,qty,reservations){if(!m)throw Error('Material inexistente.');if(!positiveQty(qty))throw Error('A quantidade tem de ser positiva.');if(Number(qty)>available(m,reservations))throw Error('Stock disponível insuficiente para esta reserva.');return true}
  function assertCount(m,value){const n=Number(value);if(!m)throw Error('Material inexistente.');if(!Number.isFinite(n)||n<0||Math.round(n*1000)!==n*1000)throw Error('A contagem tem de ser zero ou superior (até 3 casas decimais).');return n}
  function summary(workspace){const ms=workspace.materials;return{total:ms.length,low:ms.filter(m=>status(m)==='Stock baixo').length,out:ms.filter(m=>status(m)==='Esgotado').length,active:workspace.reservations.filter(r=>r.status==='Ativa').length,worth:ms.reduce((sum,m)=>sum+(m.stock*Number(m.cost||0)),0)}}
  function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function csvCell(v){let s=String(v??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  function toCsv(rows,headers){return '\ufeff'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n'}
  function normalizedSku(v){return String(v||'').trim().toUpperCase()}
  const api={demo,status,reserved,available,positiveQty,assertMovement,newStock,assertReservation,assertCount,summary,escapeHTML,csvCell,toCsv,normalizedSku};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.StockModel=api;
})();
