/* Perfil para vehículo de carga: no sustituye la validación NOM-012.
 * Gateway seguro para proveedor empresarial, NUNCA reenruta silenciosamente por OSRM automóvil.
 * Contrato del proveedor: {truckProfileVerified:true,routes:[{distance_m,duration_s,coordinates:[[lon,lat],...]}]}.
 */
exports.handler=async function(event){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
 const fail=(status,error)=>({statusCode:status,headers,body:JSON.stringify({error})});
 if(event.httpMethod!=='POST')return fail(405,'Método no permitido');
 const url=process.env.TRUCK_ROUTER_URL,token=process.env.TRUCK_ROUTER_TOKEN;
 if(!url||!token)return fail(503,'Ruteo pesado no habilitado: configure proveedor especializado y dimensiones/ejes del vehículo. Use modo referencial si sólo desea una distancia OSRM.');
 let target;try{target=new URL(url)}catch{return fail(500,'URL proveedor inválida')}
 if(target.protocol!=='https:'||target.username||target.password||/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i.test(target.hostname))return fail(500,'Proveedor debe utilizar HTTPS autorizado');
 let body;try{body=JSON.parse(event.body||'{}')}catch{return fail(400,'JSON inválido')}
 const coords=xs=>Array.isArray(xs)&&xs.length===2&&xs.every(Number.isFinite)&&xs[0]>=-119&&xs[0]<=-86&&xs[1]>=14&&xs[1]<=33;
 if(!coords(body.origin)||!coords(body.destination)||!['Camioneta','Rabón','Torton','Tráiler','Full'].includes(body.vehicle)||!(Number(body.tons)>0&&Number(body.tons)<=50))return fail(400,'Origen, destino o datos de unidad inválidos');
 try{const response=await fetch(target.toString(),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)return fail(502,'Proveedor pesado HTTP '+response.status);
  const result=await response.json();if(result.truckProfileVerified!==true||!Array.isArray(result.routes))return fail(502,'El proveedor no confirma cálculo con perfil de carga: ruta no utilizable como pesada');
  const routes=result.routes.slice(0,3).filter(r=>Number.isFinite(r.distance_m)&&r.distance_m>0&&Number.isFinite(r.duration_s)&&r.duration_s>0&&Array.isArray(r.coordinates)&&r.coordinates.length>=2&&r.coordinates.length<=50000&&r.coordinates.every(coords)).map(r=>({distance_m:r.distance_m,duration_s:r.duration_s,coordinates:r.coordinates}));
  if(!routes.length)return fail(502,'Sin rutas válidas para vehículo de carga');
  return {statusCode:200,headers,body:JSON.stringify({truckProfileVerified:true,routes})};
 }catch(e){return fail(502,'Ruteo pesado no disponible: '+String(e.message||'Error de red').slice(0,100))}
};
