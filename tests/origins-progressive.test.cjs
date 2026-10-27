'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const segment=app.slice(app.indexOf('let activeComparison=null;'),app.indexOf('window.selectOriginQuote=',app.indexOf('let activeComparison=null;')));
assert(!app.includes('geoBreakdown('),'Legacy effort editor unexpectedly rendered');
assert(!fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').includes('id="effort-editor-panel"'),'Legacy effort panel still present');
const visual={innerHTML:''};
const storage={'originQuoteResults':visual};
const start=[19.5,-99.15],end=[19.4,-99.10];
const originSites=[
 {site:{name:'Cidetec',ll:[19.48,-99.18],idx:1},linear:9},
 {site:{name:'CEDA',ll:[19.37,-99.09],idx:2},linear:12}
];
const main={km:20,h:.5,coords:[start,end],terrainCache:[{p:start,e:2000},{p:end,e:1960}]};
const ctx={
 console,Promise,Map,Math,Number,Array,String,Date,AbortSignal,setTimeout,
 document:{getElementById:id=>storage[id]},
 window:{
  GCFuel:{getPrice:()=>25.10,getForRoute:async r=>({price:r.coords[0][0]>.45?27.13:25.93})},
  GCRoadPhysics:{analyze:async r=>{r.roadPhysics={rows:[{id:'pavimento_sin',km:r.km}],classifiedKm:r.km};return r.roadPhysics}},
  GCIMT:{fromApp:(r,elev,roads,opts)=>{assert(opts.dieselPrice>=10,'diesel per-route is required');const tariff=r.km*100+opts.dieselPrice*20+(elev?.length||0);return {tariff,cost:tariff/1.08,journeyHours:r.h*2}}}
 },
 $:id=>storage[id],
 route:main,selectedDest:{nombre:'Destino',ll:end},selectedSite:{name:'Vallejo'},originQuotes:[],quoteRequest:0,
 findNearbySites:()=>({items:originSites,radius:25}),
 validate:()=>true,
 gcRouteMode:()=> 'reference',gcRoutingProfile:()=>({planningSpeedKmh:65}),
 vehSel:{value:'Rabón'},
 input:id=>id==='ton'?9:8,
 escapeHtml:s=>String(s),
 N:n=>Number(n).toFixed(1),MX:n=>'$'+Number(n).toFixed(0),
 axisRoute:c=>({total:1000,coords:c}),pointOnAxis:(axis,t)=>start,
 fetch:async url=>({ok:true,json:async()=>{
  if(url.includes('open-meteo'))return {elevation:Array(28).fill(1975)};
  const r=url.includes('-99.18')?{distance:26000,duration:1600,geometry:{coordinates:[[-99.18,19.48],[-99.1,19.4]]}}:{distance:14000,duration:900,geometry:{coordinates:[[-99.09,19.37],[-99.1,19.4]]}};
  return {code:'Ok',routes:[r]};
 }})
};
vm.createContext(ctx);
vm.runInContext(segment,ctx);
vm.runInContext('showNearbyPreview()',ctx);
assert(visual.innerHTML.includes('Cidetec')&&visual.innerHTML.includes('CEDA'),'Nearby names should appear before routing');
vm.runInContext('compareNearbyOrigins()',ctx);
assert(visual.innerHTML.includes('Consultando'),'Progressive wait state not rendered');
const done=new Promise((resolve,reject)=>{
 let attempts=0;
 const poll=()=>{
  if(ctx.originQuotes.length===2&&ctx.originQuotes.every(o=>o.ok)){resolve();return;}
  if(++attempts>120){reject(new Error('Timed out on progressive origin prices'));return;}
  setTimeout(poll,5);
 };poll();
});
done.then(()=>{
 assert(Number.isFinite(ctx.originQuotes[0].quote.tariff));
 assert.notEqual(ctx.originQuotes[0].quote.tariff,ctx.originQuotes[1].quote.tariff,'Different routes should not share a quotation');
 assert(visual.innerHTML.includes('Ver ruta'),'Selecting priced origin should be possible');
 assert(!visual.innerHTML.includes('Esfuerzo'),'Legacy effort column should not be shown');
 console.log('PASS: names appear immediately; OSRM + state fuel + elevation + OSM update progressively; per-origin quotes differ.');
}).catch(e=>{console.error(e);process.exitCode=1});
