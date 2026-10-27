const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../referencias.js');
const root=path.join(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const ix=R.indexar(read('data/referencias.json')),mapa=read('data/origen_map.json'),bodegas=read('data/bodegas.json');
// integridad de datos
assert(ix.map.size>0,'índice vacío');
for(const [n,id] of Object.entries(mapa))assert(bodegas.some(b=>b[0]===n)&&/^[A-Z0-9]+$/.test(id),'origen_map inválido '+n);
assert.equal(R.tipoConexion('Tráiler',true),'TRAILERGRN');assert.equal(R.tipoConexion('Torton',false),'TORTON');
assert.equal(R.precioCompacto(8612),'$8.6k');assert.equal(R.precioCompacto(950),'$950');
// 3 destinos de ejemplo sobre Vallejo / TORTON
const l=ix.map.get(mapa['Vallejo']+'|TORTON');assert(l&&l.length>50,'sin datos Vallejo/TORTON');
const base={indice:ix,idOrigen:mapa['Vallejo'],tipo:'TORTON'};
const conCas=l.find(r=>r.TieneCasetas&&r.Casetas>0&&r.Kms),sinCas=l.find(r=>!r.TieneCasetas&&r.Kms);
const run=(r,extra={})=>R.buscar({...base,lat:r.lat,lon:r.lon,kms:r.Kms,casetasModelo:0,...extra});
for(const [n,r] of [['con casetas',conCas],['sin casetas',sinCas]]){
 const o=run(r),tol=Math.max(.1*r.Kms,5);
 assert(o.pines.length>0,n+': sin pines');
 assert(R.RADIOS.includes(o.radio),n+': radio inválido');
 assert(o.pines.every(p=>p.dist<=o.radio+1e-9),n+': pin fuera de radio');
 assert(o.pines.every(p=>p.kmSinDato||Math.abs(p.Kms-r.Kms)<=tol+1e-9),n+': filtro de kms');
 assert(o.pines.every(p=>p.Tipo==='TORTON'&&p.IdOrigen===base.idOrigen),n+': origen/conexión');
 assert.equal(o.ampliado,o.radio>R.RADIOS[0]);
}
// radio progresivo: un punto lejano de cualquier ZT no devuelve pines y usa el radio máximo
const nada=R.buscar({...base,lat:25,lon:-110,kms:100,casetasModelo:0});assert.equal(nada.pines.length,0);assert.equal(nada.radio,15);
// aviso de casetas
assert.equal(run(conCas).avisoCasetas,true,'aviso con modelo en 0');
assert.equal(run(conCas,{casetasModelo:null}).avisoCasetas,true,'aviso con modelo nulo');
assert.equal(run(conCas,{casetasModelo:1200}).avisoCasetas,false,'sin aviso si el modelo trae casetas');
assert.equal(run(sinCas).avisoCasetas,run(sinCas).pines.some(p=>p.TieneCasetas&&p.Casetas>0));
// ZM16 en 0 no cuenta como casetas
const falso=ix.map.get('Z|T')||[];assert.equal(falso.length,0);
const sint={cols:['IdOrigen','ZT','Tipo','Kms','lat','lon','Mediana','Base','Ajustes','Casetas','Min','Max','nFleteros','TieneCasetas','Fecha','Estado','Municipio','Ancho'],corte:'x',
 rows:[['O','Z1','T',50,19.4,-99.1,5000,5000,0,0,5000,5000,1,1,'2026-01-01','E','M',3],['O','Z2','T',null,19.41,-99.1,6000,5500,0,500,6000,6000,2,1,'2026-01-01','E','M',20]]};
const s=R.buscar({indice:R.indexar(sint),idOrigen:'O',tipo:'T',lat:19.4,lon:-99.1,kms:52,casetasModelo:0});
assert.equal(s.pines.length,2);assert.equal(s.pines.find(p=>p.ZT==='Z2').kmSinDato,true);assert.equal(s.pines.find(p=>p.ZT==='Z2').aprox,true);
assert.equal(s.casetasRefMediana,500,'solo cuentan casetas > 0');assert.equal(s.avisoCasetas,true);
// no rompe lo existente: los hooks quedaron en su lugar
assert(fs.readFileSync(path.join(root,'app.js'),'utf8').includes("'geocoast:quote'"));
assert(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('referencias-ui.js'));
console.log('PASS: referencias (radios, filtros, km sin dato, aviso de casetas, ZM16=0, hooks).');
