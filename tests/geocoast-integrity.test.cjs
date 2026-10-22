'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('index.html'),css=read('styles.css');
for(const tag of html.matchAll(/<script\b[^>]*src="([^"]+)"/g)){
 const src=tag[1];if(src.startsWith('http'))continue;
 assert(fs.existsSync(path.join(root,src)),'Missing active script: '+src);
}
for(const tag of css.matchAll(/url\(['"]?([^)'" ]+)['"]?\)/g)){
 const asset=tag[1];if(asset.startsWith('http')||asset.startsWith('data:'))continue;
 assert(fs.existsSync(path.join(root,asset)),'Missing CSS image: '+asset);
}
for(const module of read('georisk-efforts-bridge.js').matchAll(/from\s+['"]\.\/([^'"]+)['"]/g))assert(fs.existsSync(path.join(root,module[1])),'Missing GeoRisk module: '+module[1]);
for(const file of ['data/frentes.json','data/bodegas.json','data/cemex-ubicaciones-oficiales.json','data/zt/index.json','data/diesel-estados.json','data/capufe-tarifas.json'])assert.doesNotThrow(()=>JSON.parse(read(file)),'Malformed JSON '+file);
const index=JSON.parse(read('data/zt/index.json'));
assert(fs.readdirSync(path.join(root,'data/zt')).filter(s=>s.endsWith('.json')).length>=33,'Missing territorial source data');
assert(fs.existsSync(path.join(root,'netlify/functions/gasolineras-nacional.js')));
assert(read('app.js').includes("document.dispatchEvent(new Event('geocoast:route-selected'))"));
assert(read('imt-cost-model.js').includes('includeManualCosts===false'));
assert(read('executive-report.js').includes('const costReport='));
assert(read('executive-report.js').includes('const effortReport='));
console.log('PASS: resources, source datasets, station function, route-isolation hooks, executive report.');
