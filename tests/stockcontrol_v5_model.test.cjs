'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../portal_php/public/assets/design-v5/model.js');
const Backup = require('../portal_php/public/assets/design-v5/backup.js');
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
  assert.match(app,/StockControl V5 Offline/);
});
test('a UI não contém endpoints ou credenciais hardcoded',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../portal_php/public/assets/design-v5/app.js'),'utf8');
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
  const js=fs.readFileSync(path.join(__dirname,'../portal_php/public/assets/design-v5/app.js'),'utf8');
  assert.match(js,/CONCURRENT_CHANGE/);
  assert.match(js,/function recover\(/);
  assert.match(js,/addEventListener\('storage'/);
  assert.match(js,/host\.inert=true/);
  assert.match(js,/function saveFeedback\(/);
});

test('ajuste inválido não passa validação do histórico',()=>{
  const w=demo();
  const a={id:'MV-ERR',sku:'MAT-001',type:'Ajuste',qty:7,delta:4,
    actor:'Administrador (demo)',createdAt:new Date().toISOString()};
  w.movements.push(a);
  assert.equal(M.validateWorkspace(w),false,'delta tem de corresponder a quantidade com sinal');
  a.delta=-7;
  assert.equal(M.validateWorkspace(w),true);
  delete a.delta;
  assert.equal(M.validateWorkspace(w),false,'delta é obrigatório em ajustes');
});

test('consumo parcial reduz stock e reserva sem alterar disponibilidade livre',()=>{
  const w=demo(),m=w.materials[0],r=w.reservations[0];
  const initial=M.available(m,w.reservations);
  const change=M.planConsumption(m,r,12,w.reservations);
  assert.deepEqual(change,{stock:333,consumed:12,status:'Ativa',used:12,remaining:18});
  m.stock=change.stock;r.consumed=change.consumed;
  assert.equal(M.reservationRemaining(r),18);
  assert.equal(M.available(m,w.reservations),initial);
  assert.equal(M.validateWorkspace(w),true);
});
test('consumo total conclui a reserva e mantém saldo livre constante',()=>{
  const w=demo(),m=w.materials[0],r=w.reservations[0];
  const initial=M.available(m,w.reservations);
  const result=M.planConsumption(m,r,30,w.reservations);
  m.stock=result.stock;r.consumed=result.consumed;r.status=result.status;
  assert.equal(result.remaining,0);
  assert.equal(r.status,'Concluída');
  assert.equal(M.reserved(m.sku,w.reservations),0);
  assert.equal(M.available(m,w.reservations),initial);
  assert.equal(M.validateWorkspace(w),true);
});
test('consumo acima do saldo ou em reserva concluída é rejeitado',()=>{
  const w=demo(),m=w.materials[0],r=w.reservations[0];
  assert.throws(()=>M.planConsumption(m,r,30.001,w.reservations),/saldo reservado/);
  assert.throws(()=>M.planConsumption(m,r,0,w.reservations),/quantidade positiva/);
  const result=M.planConsumption(m,r,30,w.reservations);
  r.consumed=result.consumed;r.status=result.status;m.stock=result.stock;
  assert.throws(()=>M.planConsumption(m,r,0.001,w.reservations),/não está ativa/);
});
test('cancelamento depois de consumo parcial não reverte stock físico consumido',()=>{
  const w=demo(),m=w.materials[0],r=w.reservations[0];
  const result=M.planConsumption(m,r,12,w.reservations);
  m.stock=result.stock;r.consumed=result.consumed;r.status='Cancelada';
  assert.equal(m.stock,333);
  assert.equal(M.reservationRemaining(r),0);
  assert.equal(M.available(m,w.reservations),333);
  assert.equal(M.validateWorkspace(w),true);
});
test('histórico do consumo exige referência válida e delta negativo correto',()=>{
  const w=demo(),entry={id:'MV-CONSUMO',sku:'MAT-001',type:'Consumo',qty:12,delta:-12,
    reservationId:'RS-001',actor:'Operador (demo)',createdAt:new Date().toISOString()};
  w.movements.unshift(entry);
  assert.equal(M.validateWorkspace(w),true);
  entry.delta=12;assert.equal(M.validateWorkspace(w),false);
  entry.delta=-12;entry.reservationId='RS-404';assert.equal(M.validateWorkspace(w),false);
});
test('dados V5 de reservas antigas sem consumed continuam a ser aceites',()=>{
  const w=demo();delete w.reservations[0].consumed;
  assert.equal(M.validateWorkspace(w),true);
  assert.equal(M.reservationRemaining(w.reservations[0]),30);
});

test('material totalmente reservado mas com stock físico positivo fica sem disponibilidade',()=>{
  const w=demo(),m=w.materials[0];
  w.reservations[0].qty=345;
  const view=M.inventoryView(w);
  assert.equal(m.stock,345);
  assert.equal(view.availableBySku.get(m.sku),0);
  assert.equal(view.statusBySku.get(m.sku),'Sem disponibilidade');
  assert.equal(M.status(m,w.reservations),'Sem disponibilidade');
  assert.equal(view.blocked,1);
  assert.equal(view.out,1);
  assert.equal(M.validateWorkspace(w),true);
});
test('estado Stock baixo usa saldo livre após reservas, não apenas o físico',()=>{
  const w=demo(),m=w.materials[0];
  w.reservations[0].qty=300;
  const view=M.inventoryView(w);
  assert.equal(view.availableBySku.get('MAT-001'),45);
  assert.equal(view.statusBySku.get('MAT-001'),'Stock baixo');
  assert.equal(M.status(m,w.reservations),'Stock baixo');
  assert.equal(view.low,3);
});
test('dashboard não confunde stock físico esgotado com material totalmente reservado',()=>{
  const w=demo();
  w.reservations[0].qty=345;
  const view=M.inventoryView(w);
  assert.equal(view.out,1);
  assert.equal(view.blocked,1);
  assert.equal(view.total-w.materials.length,0);
  assert.equal(M.summary(w).blocked,1);
});
test('consumo parcial mantém os estados derivados do saldo livre',()=>{
  const w=demo(),m=w.materials[0],r=w.reservations[0];
  r.qty=345;
  const initial=M.inventoryView(w).statusBySku.get(m.sku);
  const p=M.planConsumption(m,r,10,w.reservations);
  m.stock=p.stock;r.consumed=p.consumed;r.status=p.status;
  assert.equal(initial,'Sem disponibilidade');
  assert.equal(M.inventoryView(w).statusBySku.get(m.sku),'Sem disponibilidade');
  assert.equal(M.inventoryView(w).availableBySku.get(m.sku),0);
});
test('indicadores agregados e stock disponível individual são equivalentes',()=>{
  const w=demo();
  const view=M.inventoryView(w);
  for(const m of w.materials){
    assert.equal(view.availableBySku.get(m.sku),M.available(m,w.reservations));
    assert.equal(view.statusBySku.get(m.sku),M.status(m,w.reservations));
  }
  assert.equal(view.total,w.materials.length);
  assert.equal(view.active,w.reservations.filter(r=>r.status==='Ativa').length);
});

test('backup offline íntegro permite restauração com reservas consumidas',()=>{
  const w=demo(),m=w.materials[0],reservation=w.reservations[0];
  const change=M.planConsumption(m,reservation,12,w.reservations);
  m.stock=change.stock;reservation.consumed=change.consumed;
  const json=Backup.exportBackup(w,M,()=> '2026-11-20T00:00:00.000Z');
  const restored=Backup.parseBackup(json,M);
  assert.deepEqual(restored,w);
  assert.equal(restored.reservations[0].consumed,12);
});
test('backup rejeita quantidades e referências inválidas',()=>{
  const w=demo();
  const input=JSON.parse(Backup.exportBackup(w,M));
  input.workspace.materials[0].stock=-4;
  assert.throws(()=>Backup.parseBackup(JSON.stringify(input),M),/Backup rejeitado/);
  input.workspace.materials[0].stock=345;
  input.workspace.reservations[0].sku='SKU-404';
  assert.throws(()=>Backup.parseBackup(JSON.stringify(input),M),/Backup rejeitado/);
});
test('backup rejeita versões incompatíveis, conteúdo inválido e tamanho excessivo',()=>{
  const backup=JSON.parse(Backup.exportBackup(demo(),M));
  backup.version=8;
  assert.throws(()=>Backup.parseBackup(JSON.stringify(backup),M),/incompatível/);
  assert.throws(()=>Backup.parseBackup('invalid json',M),/JSON válido/);
  assert.throws(()=>Backup.parseBackup('a'.repeat(Backup.LIMIT+1),M),/8 MB/);
});
test('backup não modifica o workspace e mantém versão explícita',()=>{
  const w=demo(),before=JSON.stringify(w);
  const serialized=Backup.exportBackup(w,M);
  assert.equal(JSON.stringify(w),before);
  assert.equal(JSON.parse(serialized).format,Backup.FORMAT);
  assert.equal(JSON.parse(serialized).version,Backup.VERSION);
});
