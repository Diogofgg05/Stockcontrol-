'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../portal_php/public/assets/design-v4/model.js');
const demo = () => M.demo();
test('o ambiente de demonstração é isolado entre inicializações', () => {
  const a=demo(),b=demo();a.materials[0].stock=0;
  assert.equal(b.materials[0].stock,345);
});
test('métricas consistentes com materiais fictícios',()=>{
  const w=demo(),s=M.summary(w);
  assert.equal(s.total,w.materials.length);
  assert.equal(s.low,2);
  assert.equal(s.out,1);
  assert.equal(s.active,2);
  assert.ok(s.worth>0);
});
test('stock disponível desconta reservas ativas',()=>{
  const w=demo(),m=w.materials[0];
  assert.equal(M.reserved(m.sku,w.reservations),30);
  assert.equal(M.available(m,w.reservations),315);
});
test('reservas canceladas deixam de bloquear stock',()=>{
  const w=demo();w.reservations[0].status='Cancelada';
  assert.equal(M.available(w.materials[0],w.reservations),345);
});
test('não é possível reservar mais do que está disponível',()=>{
  const w=demo();
  assert.throws(()=>M.assertReservation(w.materials[0],316,w.reservations),/insuficiente/);
});
test('reservas aceitam quantidade igual ao disponível',()=>{
  const w=demo();assert.equal(M.assertReservation(w.materials[0],315,w.reservations),true);
});
test('saída de stock não consome unidades reservadas',()=>{
  const w=demo();assert.throws(()=>M.newStock(w.materials[0],'Saída',316,w.reservations),/disponível/);
});
test('entrada e devolução aumentam stock sem alterar o original',()=>{
  const w=demo(),m=w.materials[0];
  assert.equal(M.newStock(m,'Entrada',5,w.reservations),350);
  assert.equal(M.newStock(m,'Devolução',2,w.reservations),347);
  assert.equal(m.stock,345);
});
test('saída é descontada corretamente',()=>{
  const w=demo();
  assert.equal(M.newStock(w.materials[0],'Saída',10,w.reservations),335);
});
test('movimentos inválidos são rejeitados',()=>{
  const w=demo();
  for(const n of [0,-1,NaN,Infinity,'a',0.0001]){
    assert.throws(()=>M.assertMovement(w.materials[0],'Entrada',n,w.reservations));
  }
  assert.throws(()=>M.assertMovement(w.materials[0],'Apagar',2,w.reservations));
});
test('contagem aceita zero e rejeita números negativos ou imprecisos',()=>{
  const w=demo();assert.equal(M.assertCount(w.materials[0],0),0);
  assert.throws(()=>M.assertCount(w.materials[0],-1));
  assert.throws(()=>M.assertCount(w.materials[0],0.0001));
});
test('materiais esgotados e abaixo do mínimo são distinguidos',()=>{
  assert.equal(M.status({stock:0,min:10}),'Esgotado');
  assert.equal(M.status({stock:10,min:10}),'Stock baixo');
  assert.equal(M.status({stock:11,min:10}),'Disponível');
});
test('escaping HTML protege dados introduzidos no protótipo',()=>{
  assert.equal(M.escapeHTML('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('CSV inclui aspas, pontos-e-vírgulas e evita fórmulas',()=>{
  const out=M.toCsv([['=1+1','Peça;teste','a"b','linha\n2']],['Expressão','Nome','Aspas','Notas']);
  assert.match(out,/"'=1\+1"/);
  assert.match(out,/"Peça;teste"/);
  assert.match(out,/"a""b"/);
  assert.match(out,/"linha\n2"/);
  assert.ok(out.startsWith('\ufeff'));
});
test('SKUs são normalizados sem alterar outros campos',()=>{
  assert.equal(M.normalizedSku(' mat-a01 '),'MAT-A01');
});
test('pré-visualização inclui aviso explícito de dados fictícios',()=>{
  const root=path.join(__dirname,'../portal_php/public/assets/design-v4');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  assert.match(html,/Demonstração/);
  assert.match(app,/Sem API, autenticação ou pagamentos reais/);
  assert.match(app,/StockControl V4 Workspace/);
});
test('a UI não contém endpoints ou credenciais hardcoded',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../portal_php/public/assets/design-v4/app.js'),'utf8');
  assert.doesNotMatch(js,/sk_(test|live)_|service_role|whsec_/);
  assert.doesNotMatch(js,/fetch\s*\(|XMLHttpRequest/);
});

test('estado inicial passa validação integral',()=>{
  assert.equal(M.validateWorkspace(demo()),true);
});
test('não aceita estados persistidos malformados',()=>{
  const w=demo();w.materials[0].stock='345';
  assert.equal(M.validateWorkspace(w),false);
});
test('não aceita duas referências de material repetidas',()=>{
  const w=demo();w.materials.push({...w.materials[0]});
  assert.equal(M.validateWorkspace(w),false);
});
test('não aceita reservas superiores ao stock físico em estado adulterado',()=>{
  const w=demo();w.reservations[0].qty=500;
  assert.equal(M.validateWorkspace(w),false);
});
test('não aceita movimentos com material inexistente',()=>{
  const w=demo();w.movements[0].sku='NAO-EXISTE';
  assert.equal(M.validateWorkspace(w),false);
});
test('não aceita estados de reserva nem contagem ilegais',()=>{
  const w=demo();w.reservations[0].status='Sem autorização';
  assert.equal(M.validateWorkspace(w),false);
  const other=demo();other.counts.push({id:'CT-X',sku:'MAT-001',counted:10,expected:345,status:'Aprovada'});
  assert.equal(M.validateWorkspace(other),false);
});
test('validar quantidades sem converter vazios em zero',()=>{
  const m=demo().materials[0];
  for(const v of ['', ' ', null, undefined, NaN, Infinity, -1, 0.0001, 1000000001]){
    assert.throws(()=>M.assertCount(m,v),String(v));
  }
  assert.equal(M.assertCount(m,0),0);
});
test('stock não ultrapassa teto numérico de demonstração',()=>{
  const w=demo(),m=w.materials[0];m.stock=1000000000;
  assert.throws(()=>M.newStock(m,'Entrada',1,w.reservations),/máximo/);
});
test('três casas decimais suportadas nas quantidades',()=>{
  const w=demo(),m=w.materials[0];
  assert.equal(M.assertReservation(m,0.001,w.reservations),true);
  assert.equal(M.newStock(m,'Entrada',0.001,w.reservations),345.001);
  assert.equal(M.newStock(m,'Saída',0.001,w.reservations),344.999);
});
test('CSV evita fórmulas precedidas por caracteres invisíveis',()=>{
  const fields=['\u200b=2+2','\u2060+SUM(1;1)','\ufeff@cmd','-1+2','regular'];
  const cells=fields.map(M.csvCell);
  for(let i=0;i<4;i++)assert.ok(cells[i].startsWith('"\''),cells[i]);
  assert.equal(cells[4],'"regular"');
});
test('limites de arrays e dados financeiros dos estados guardados',()=>{
  const w=demo();w.materials[0].cost=Infinity;
  assert.equal(M.validateWorkspace(w),false);
  const another=demo();another.events=Array(201).fill(another.events[0]);
  assert.equal(M.validateWorkspace(another),false);
});
test('registo de ajuste tem variação assinada para auditoria',()=>{
  const w=demo();
  w.movements.push({id:'MV-ADJUST',sku:'MAT-001',type:'Ajuste',qty:12,delta:-12,
    actor:'Administrador (demo)',note:'Contagem CT-1',createdAt:new Date().toISOString()});
  assert.equal(M.validateWorkspace(w),true);
});
test('código implementa rollback de erros de persistência e deteção de outras abas',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../portal_php/public/assets/design-v4/app.js'),'utf8');
  assert.match(js,/CONCURRENT_CHANGE/);
  assert.match(js,/function recover\(/);
  assert.match(js,/addEventListener\('storage'/);
  assert.match(js,/host\.inert=true/);
  assert.match(js,/function saveFeedback\(/);
});
