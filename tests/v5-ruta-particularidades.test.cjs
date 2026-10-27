'use strict';
const assert=require('node:assert/strict');
const {quote}=require('../imt-cost-model.js');
const basic={type:'Rabón',km:120,loadTons:8,year:2022,dieselPrice:26.4,travelHours:2.3,utility:.08,elevationAvailable:true,ascent:0,descent:0};
function forRoad(id,overrides={}){return quote({...basic,rows:[{id,km:basic.km}],...overrides});}
const highway=forRoad('autopista_sin');
const pavement=forRoad('pavimento_sin');
const gravel=forRoad('terraceria_sin');
const mountain=forRoad('terraceria_con',{ascent:1450,descent:1350});
assert(highway.variable.suspension>0,'suspensión automática desglosada');
assert(pavement.variable.maintenance>highway.variable.maintenance,'pavimento secundario añade coste');
assert(pavement.variable.suspension>highway.variable.suspension,'superficie afecta suspensión');
for(const rubro of ['diesel','maintenance','suspension','tires']){
  assert(gravel.variable[rubro]>highway.variable[rubro],`${rubro}: terracería debe costar más`);
}
for(const rubro of ['diesel','maintenance','suspension','tires']){
  assert(mountain.variable[rubro]>gravel.variable[rubro],`${rubro}: gradiente añade desgaste/consumo`);
}
assert(gravel.tariff>pavement.tariff && pavement.tariff>highway.tariff,'tarifa ordenada por dificultad en esta simulación');
for(const q of [highway,pavement,gravel,mountain]){
 assert(Math.abs(Object.values(q.variable).reduce((a,b)=>a+b,0)-q.variableTotal)<1e-5);
 assert(Math.abs(q.fixedAllocation+q.variableTotal+q.profit-q.tariff)<1e-5);
 assert(Math.abs((q.fixedAllocation+q.variableTotal+q.profit)/q.tariff*100-100)<1e-8);
}
assert.notEqual(100*gravel.variable.suspension/gravel.tariff,100*mountain.variable.suspension/mountain.tariff,'participación no fija');
const priceChange=forRoad('pavimento_sin',{dieselPrice:28.6});
assert(priceChange.variable.diesel>pavement.variable.diesel && priceChange.tariff>pavement.tariff,'precio diésel por ruta en tarifa');
const noSusp=forRoad('autopista_sin',{suspensionShare:0});
assert.equal(noSusp.variable.suspension,0);
assert(Math.abs(noSusp.variable.maintenance-(highway.variable.maintenance+highway.variable.suspension))<1e-6,'la suspensión base no se cobra 2 veces');
const forced=forRoad('autopista_sin',{manualCosts:{suspension:1000}});
assert.equal(forced.variable.suspension,1000,'ajuste manual independiente');
assert.equal(forced.audit.manualApplied.suspension,1000);
const noGeo=forRoad('autopista_sin',{legacyEffortPct:50,ira:5});
assert.equal(noGeo.tariff,highway.tariff,'modelo independiente de esfuerzos GeoRisk');
console.log('PASS V5: distancias iguales con tramos/pedientes diferentes generan costos distintos; suspensión sin doble cargo; precios diésel distintos; no GeoRisk.');
console.log(JSON.stringify({highway:{tariff:highway.tariff,maintenance:highway.variable.maintenance,suspension:highway.variable.suspension,tyres:highway.variable.tires,diesel:highway.variable.diesel},pavement:{tariff:pavement.tariff},gravel:{tariff:gravel.tariff},mountain:{tariff:mountain.tariff}},null,2));
