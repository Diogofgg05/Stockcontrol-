'use strict';
// Node is needed only to develop or regenerate the bundle, never to run the browser app.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),src=path.join(root,'src');
const file=n=>path.join(src,n+'.jsfrag');
const dynamic=dir=>{
 const folder=path.join(src,dir);
 return fs.existsSync(folder)?fs.readdirSync(folder).filter(n=>n.endsWith('.jsfrag')).sort().map(n=>fs.readFileSync(path.join(folder,n),'utf8')):[];
};
const parts=['00-runtime','10-persistence','20-ui-shell','25-reference-visuals'];
const source=[
 ...parts.map(n=>fs.readFileSync(file(n),'utf8')),
 ...dynamic('components'),
 fs.readFileSync(file('30-inventory-operations'),'utf8'),
 ...dynamic('pages'),
 ...['40-reports-management','50-router-dialogs','60-operation-commands','70-event-binding'].map(n=>fs.readFileSync(file(n),'utf8'))
].join('');
const out=path.join(root,'app.js');
if(process.argv.includes('--check')){
 if(fs.readFileSync(out,'utf8')!==source){console.error('Bundle desatualizado: executa node tools/build.cjs');process.exitCode=1;}
 else console.log('V6 design system bundle synchronized ('+source.length+' characters)');
}else{
 fs.writeFileSync(out,source,'utf8');
 console.log('V6 bundle regenerated from source, pages and components');
}
