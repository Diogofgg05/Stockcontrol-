'use strict';
// Architecture: generate components or page shells using canonical tokens.
(function scaffoldMain(){
 const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
 const root=path.resolve(__dirname,'..');
 const kind=process.argv[2],name=(process.argv.slice(3).join(' ')||'').trim();
 if(!['page','component'].includes(kind)||!name||name.length>64||!/^[\p{L}\p{N} _-]+$/u.test(name)){
  console.error('Uso: node tools/scaffold.cjs page|component "Nome legível"');
  process.exit(2);
 }
 const slug=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 if(!/^[a-z][a-z0-9-]{1,40}$/.test(slug))throw Error('Nome inválido para slug.');
 const ident=slug.replace(/-/g,'_');
 const Ename=JSON.stringify(name),Eslug=JSON.stringify(slug);
 const sourceRoot=path.join(root,'src');
 if(kind==='component'){
  const folder=path.join(sourceRoot,'components');
  fs.mkdirSync(folder,{recursive:true});
  const filename=path.join(folder,slug+'.jsfrag');
  if(fs.existsSync(filename))throw Error('O componente já existe: '+slug);
  const contents=`  function component_${ident}({label='',value='',detail=''}={}){
    return \`<article class="stat-card sc-component"><div class="stat-top"><span>\${E(label)}</span></div><strong>\${E(value)}</strong><small>\${E(detail)}</small></article>\`;
  }
`;
  fs.writeFileSync(filename,contents,'utf8');
 }else{
  const folder=path.join(sourceRoot,'pages');
  fs.mkdirSync(folder,{recursive:true});
  const filename=path.join(folder,slug+'.jsfrag');
  if(fs.existsSync(filename))throw Error('A página já existe: '+slug);
  const runtimeFile=path.join(sourceRoot,'00-runtime.jsfrag');
  const runtime=fs.readFileSync(runtimeFile,'utf8');
  const titleAnchor="const titles={design:'Design system',";
  const navAnchor="['team','users']";
  if(!runtime.includes(titleAnchor)||!runtime.includes(navAnchor))throw Error('Âncoras de navegação alteradas; não é seguro gerar.');
  if(runtime.includes("'"+slug+"':"))throw Error('Página com este identificador já registada.');
  const titleNext=runtime.replace(titleAnchor,titleAnchor+"'"+slug+"':"+Ename+",");
  const runtimeNext=titleNext.replace(navAnchor,navAnchor+",['"+slug+"','file-text']");
  const safeTitle=name.replace(/[<>"']/g,'');
  const contents=`  function page_${ident}(){
    return \`\${pageHeader("NOVA SECÇÃO",${Ename},"Página com os componentes do sistema visual StockControl.")}
      <section class="panel"><div class="panel-head"><div><h2>${safeTitle}</h2><p>Estrutura de conteúdo para esta secção.</p></div></div>
      <div class="settings-section"><p>Substitui este conteúdo pelo fluxo real e pelos estados necessários.</p></div></section>\`;
  }
  additionalPages[${Eslug}]=page_${ident};
`;
  fs.writeFileSync(filename,contents,'utf8');
  fs.writeFileSync(runtimeFile,runtimeNext,'utf8');
 }
 cp.execFileSync(process.execPath,[path.join(__dirname,'build.cjs')],{stdio:'inherit'});
 console.log('Gerado '+kind+': '+slug+' — tokens e componentes partilhados');
})();
