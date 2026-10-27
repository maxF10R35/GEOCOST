/* Adaptador de datos históricos de flota. Requiere API corporativa autorizada.
 * NO conoce ni presupone la API comercial de Active Track.
 * El proveedor/API gateway debe servir {records:[{origin,destination,unit,km,hours,vdu,date,source}]}.
 * Las credenciales permanecen exclusivamente en variables Netlify. */
exports.handler=async function(event){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'same-origin'};
 const fail=(status,error)=>({statusCode:status,headers,body:JSON.stringify({error})});
 if(event.httpMethod!=='GET')return fail(405,'Método no permitido');
 const url=process.env.ACTIVETRACK_EXPORT_URL,token=process.env.ACTIVETRACK_TOKEN;
 if(!url||!token)return fail(503,'No hay API Active Track corporativa configurada. Importa un CSV/JSON autorizado.');
 let target;try{target=new URL(url)}catch{return fail(500,'URL de Active Track no válida')}
 if(target.protocol!=='https:'||target.username||target.password||/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i.test(target.hostname))return fail(500,'Se requiere proveedor HTTPS autorizado');
 try{const response=await fetch(target.toString(),{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)return fail(502,`API corporativa sin respuesta válida (HTTP ${response.status})`);
  const data=await response.json();if(!Array.isArray(data.records))return fail(502,'El proveedor debe entregar {records:[...]}. Configura el adaptador con su documentación oficial.');
  const records=data.records.slice(0,3000).map(r=>({origin:r.origin,destination:r.destination,unit:r.unit,km:r.km,hours:r.hours,speed:r.speed,vdu:r.vdu,date:r.date,source:'Active Track (API corporativa)'}));
  return {statusCode:200,headers,body:JSON.stringify({records})};
 }catch(e){return fail(502,'No se pudo consultar la API corporativa: '+String(e.message||'Error de red').slice(0,100))}
};
