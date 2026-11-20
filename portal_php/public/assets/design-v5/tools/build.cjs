'use strict';
// No npm, API or server required for the browser bundle.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const parts=[
 '00-runtime','10-persistence','20-ui-shell','30-inventory-operations',
 '40-reports-management','50-router-dialogs','60-operation-commands','70-event-binding'
];
const source=parts.map(n=>fs.readFileSync(path.join(root,'src',n+'.jsfrag'),'utf8')).join('');
const out=path.join(root,'app.js');
const mode=process.argv.includes('--check')?'check':'build';
if(mode==='check'){
 const compiled=fs.readFileSync(out,'utf8');
 if(compiled!==source){console.error('app.js is out of date. Execute node tools/build.cjs');process.exitCode=1;}
 else console.log('V5 bundle synchronized with 8 source modules');
}else{fs.writeFileSync(out,source,'utf8');console.log('Wrote '+out+' ('+source.length+' characters)')}
