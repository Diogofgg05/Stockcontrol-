(function offlineBackup(){
  'use strict';
  const FORMAT='stockcontrol-offline-backup';
  const VERSION=1;
  const LIMIT=8*1024*1024;
  const deepClone=value=>JSON.parse(JSON.stringify(value));
  function exportBackup(workspace,model,clock=()=>new Date().toISOString()){
    if(!model.validateWorkspace(workspace))throw Error('O inventário atual não passou na verificação de integridade.');
    return JSON.stringify({format:FORMAT,version:VERSION,exportedAt:clock(),workspace:deepClone(workspace)},null,2);
  }
  function parseBackup(input,model){
    if(typeof input!=='string'||input.length>LIMIT)throw Error('Ficheiro inválido ou superior a 8 MB.');
    let parsed;
    try{parsed=JSON.parse(input)}catch{throw Error('O ficheiro não contém JSON válido.')}
    if(!parsed||typeof parsed!=='object'||parsed.format!==FORMAT||parsed.version!==VERSION
      ||!Object.prototype.hasOwnProperty.call(parsed,'workspace'))
      throw Error('Formato ou versão de backup incompatível.');
    if(!model.validateWorkspace(parsed.workspace))
      throw Error('Backup rejeitado: referências, quantidades ou movimentos inconsistentes.');
    return deepClone(parsed.workspace);
  }
  const api=Object.freeze({FORMAT,VERSION,LIMIT,exportBackup,parseBackup});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.StockBackup=api;
})();
