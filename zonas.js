/** Urban footprints, not municipal boundaries or circles around settlement names. */
const validPoint=p=>p&&Number.isFinite(p.lon)&&Number.isFinite(p.lat);
const same=(a,b)=>a.lon===b.lon&&a.lat===b.lat;
const closed=g=>g.length>=4&&g.every(validPoint)&&same(g[0],g.at(-1));
export function isUrbanFootprint(tags={}){
 if(tags.boundary==='administrative'||tags.admin_level)return false;
 return ['residential','commercial','retail'].includes(tags.landuse)||['city','town','village'].includes(tags.place);
}
function joinRings(members){
 if(members.some(m=>!m.geometry||m.geometry.length<2||!m.geometry.every(validPoint)))return null;
 const pending=members.map(m=>m.geometry).filter(g=>g?.length>=2&&g.every(validPoint)).map(g=>[...g]),rings=[];
 while(pending.length){
  let ring=pending.shift(),changed=true;
  while(!same(ring[0],ring.at(-1))&&changed){
   changed=false;
   for(let i=0;i<pending.length;i++){
    const next=pending[i];
    if(same(ring.at(-1),next[0]))ring.push(...next.slice(1));
    else if(same(ring.at(-1),next.at(-1)))ring.push(...next.slice(0,-1).reverse());
    else if(same(ring[0],next.at(-1)))ring=[...next.slice(0,-1),...ring];
    else if(same(ring[0],next[0]))ring=[...next.slice(1).reverse(),...ring];
    else continue;
    pending.splice(i,1);changed=true;break;
   }
  }
  if(closed(ring))rings.push(ring);
  else return null; // Never manufacture a closing edge for incomplete geometry.
 }
 return rings;
}
function ringContains(p,g){
 let inside=false;
 for(let i=0,j=g.length-1;i<g.length;j=i++){
  const a=g[i],b=g[j];
  if((a.lat>p[1])!==(b.lat>p[1])&&p[0]<(b.lon-a.lon)*(p[1]-a.lat)/(b.lat-a.lat)+a.lon)inside=!inside;
 }
 return inside;
}
export function urbanAreaFromOSM(element){
 if(!isUrbanFootprint(element.tags))return null;
 if(element.type==='way')return closed(element.geometry||[])?{...element,polygons:[{outer:element.geometry,holes:[]}]}:null;
 if(element.type!=='relation'||!['multipolygon','boundary'].includes(element.tags?.type))return null;
 if((element.members||[]).some(m=>m.type==='relation'&&['outer','inner',''].includes(m.role||'')))return null;
 const members=element.members||[],outer=joinRings(members.filter(m=>m.type==='way'&&['outer',''].includes(m.role||''))),inner=joinRings(members.filter(m=>m.type==='way'&&m.role==='inner'));
 if(!outer?.length||!inner)return null;
 const polygons=outer.map(ring=>({outer:ring,holes:[]}));
 for(const hole of inner){
  // Assign each hole to its smallest containing outer ring, allowing islands.
  const candidates=polygons.filter(p=>ringContains([hole[0].lon,hole[0].lat],p.outer)).sort((a,b)=>ringArea(a.outer)-ringArea(b.outer));
  if(!candidates.length)return null;
  candidates[0].holes.push(hole);
 }
 return {...element,polygons};
}
function ringArea(g){return Math.abs(g.slice(1).reduce((sum,p,i)=>sum+g[i].lon*p.lat-p.lon*g[i].lat,0));}
export function areaPolygons(area){
 if(area.tags&&!isUrbanFootprint(area.tags))return [];
 return (area.polygons||[...(closed(area.geometry||[])?[{outer:area.geometry,holes:area.holes||[]}]:[])]).filter(p=>closed(p.outer||[])&&(p.holes||[]).every(closed)).map(p=>({...p,holes:p.holes||[]}));
}
export function pointInUrbanArea(p,area){
 return areaPolygons(area).some(poly=>ringContains(p,poly.outer)&&!(poly.holes||[]).some(hole=>ringContains(p,hole)));
}
export function urbanIndex(areas){
 const entries=[];
 for(const area of areas)for(const polygon of areaPolygons(area)){
  const xs=polygon.outer.map(p=>p.lon),ys=polygon.outer.map(p=>p.lat);
  entries.push({area,polygon,west:Math.min(...xs),east:Math.max(...xs),south:Math.min(...ys),north:Math.max(...ys)});
 }
 return entries;
}
export function urbanAt(p,index){
 return index.find(e=>p[0]>=e.west&&p[0]<=e.east&&p[1]>=e.south&&p[1]<=e.north&&ringContains(p,e.polygon.outer)&&!e.polygon.holes.some(h=>ringContains(p,h)))?.area||null;
}
export const URBAN_STREET_OFFSETS=[10,25,35];
export function urbanStreetAt(p,a,b,index){
 // A mapped road may be excluded from the landuse blocks on either side.
 // Only bilateral built-up evidence qualifies; never fill a polygon's holes.
 if(index.some(e=>e.polygon.holes.length&&ringContains(p,e.polygon.outer)&&e.polygon.holes.some(h=>ringContains(p,h))))return null;
 const kx=Math.cos(p[1]*Math.PI/180)*111195,dx=(b[0]-a[0])*kx,dy=(b[1]-a[1])*111195,len=Math.hypot(dx,dy);if(!len)return null;
 let left=null,right=null;
 for(const m of URBAN_STREET_OFFSETS){
  const ox=-dy/len*m/kx,oy=dx/len*m/111195;
  left ||= urbanAt([p[0]+ox,p[1]+oy],index);
  right ||= urbanAt([p[0]-ox,p[1]-oy],index);
 }
 if(!left||!right||left===right||!left.tags?.landuse||!right.tags?.landuse)return null;
 return {id:`${left.id}|${right.id}`,tags:{name:'Calle entre áreas urbanizadas'},estimated:true};
}
function crossing(a,b,c,d){
 const rx=b[0]-a[0],ry=b[1]-a[1],sx=d.lon-c.lon,sy=d.lat-c.lat,den=rx*sy-ry*sx;
 if(Math.abs(den)<1e-16)return null;
 const qx=c.lon-a[0],qy=c.lat-a[1],t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;
 return t>=0&&t<=1&&u>=0&&u<=1?t:null;
}
/** Exact line/ring crossings split even a tiny urban enclave within one sample. */
export function urbanBoundaryCuts(axis,index){
 const cuts=[];
 // Index boundary edges, avoiding a route-vertices × whole-city-ring scan.
 const grid=new Map(),cell=.01;
 for(const entry of index)for(const ring of [entry.polygon.outer,...entry.polygon.holes])for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i];
  for(let x=Math.floor(Math.min(a.lon,b.lon)/cell);x<=Math.floor(Math.max(a.lon,b.lon)/cell);x++)for(let y=Math.floor(Math.min(a.lat,b.lat)/cell);y<=Math.floor(Math.max(a.lat,b.lat)/cell);y++){
   const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push({a,b});
  }
 }
 for(let i=1;i<axis.coords.length;i++){
  const originalA=axis.coords[i-1],originalB=axis.coords[i],lat=(originalA[1]+originalB[1])/2,kx=Math.cos(lat*Math.PI/180)*111195,dx=(originalB[0]-originalA[0])*kx,dy=(originalB[1]-originalA[1])*111195,len=Math.hypot(dx,dy);
  // Also cut street-gap evidence at each block's actual longitudinal end.
  for(const offset of [0,...URBAN_STREET_OFFSETS.flatMap(m=>[-m,m])]){
  const ox=len?-dy/len*offset/kx:0,oy=len?dx/len*offset/111195:0;
  const a=[originalA[0]+ox,originalA[1]+oy],b=[originalB[0]+ox,originalB[1]+oy],seen=new Set();
  for(let x=Math.floor(Math.min(a[0],b[0])/cell);x<=Math.floor(Math.max(a[0],b[0])/cell);x++)for(let y=Math.floor(Math.min(a[1],b[1])/cell);y<=Math.floor(Math.max(a[1],b[1])/cell);y++)for(const edge of grid.get(x+','+y)||[]){
   if(seen.has(edge))continue;seen.add(edge);
   const t=crossing(a,b,edge.a,edge.b);if(t!==null)cuts.push(axis.cum[i-1]+t*(axis.cum[i]-axis.cum[i-1]));
  }
  }
 }
 return cuts;
}
