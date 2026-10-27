
window.addEventListener('DOMContentLoaded',()=>{
  const cover=document.getElementById('welcome');
  const app=document.getElementById('app');
  const start=document.getElementById('startApp');
  const reportTop=document.getElementById('topReports');
  const showResults=document.getElementById('showResults');
  // La opción de conexión se mantiene internamente como Entrega sin mostrar el panel.
  const conn=document.getElementById('conexion');
  if(conn && !conn.value) conn.value='Entrega';
  const lote=document.getElementById('ton');
  const viajes=document.getElementById('numeroViajes');

  const vehicleSelect=document.getElementById('vehiculo');
  const unitButtons=[...document.querySelectorAll('.unit-btn')];
  function syncUnitButtons(){
    const val=vehicleSelect.value;
    const allowed=new Set([...vehicleSelect.options].map(option=>option.value));
    unitButtons.forEach(b=>{
      b.classList.toggle('active',b.dataset.unit===val);
      b.disabled=!allowed.has(b.dataset.unit);
      b.title=b.disabled?'No disponible para esta presentación':'Seleccionar '+b.dataset.unit;
    });
  }
  unitButtons.forEach(btn=>btn.addEventListener('click',()=>{
    if(btn.disabled)return;
    vehicleSelect.value=btn.dataset.unit;
    vehicleSelect.dispatchEvent(new Event('change'));
    syncUnitButtons();
  }));
  vehicleSelect.addEventListener('change',syncUnitButtons);
  const mo=new MutationObserver(syncUnitButtons); mo.observe(vehicleSelect,{childList:true,subtree:true});
  setTimeout(syncUnitButtons,500);

  // Estado del portal persistente durante la sesión: el usuario solo regresa con Salir.
  const NAV_KEY='geocoast-workspace-open-v2';
  function saveStage(isOpen){try{sessionStorage.setItem(NAV_KEY,isOpen?'1':'0')}catch(_) {}}
  function readStage(){try{return sessionStorage.getItem(NAV_KEY)==='1'}catch(_){return false}}
  function setStage(isOpen,persist=true){
    const opened=Boolean(isOpen);
    if(persist)saveStage(opened);
    document.body.classList.toggle('gc-entered',opened);
    app.classList.toggle('app-hidden',!opened);
    cover.hidden=opened;
    cover.setAttribute('aria-hidden',String(opened));
    cover.style.display=opened?'none':'block';
    if(opened){window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>window.map?.invalidateSize?.()));}
  }
  const openApp=()=>setStage(true);
  window.GCNavigation={open:openApp,exit:()=>setStage(false),isOpen:()=>document.body.classList.contains('gc-entered')};
  start.setAttribute('type','button');
  start.addEventListener('click',event=>{event.preventDefault();openApp()});
  setStage(readStage(),false);
  window.addEventListener('pageshow',()=>setStage(readStage(),false));
  document.getElementById('topExit')?.addEventListener('click',event=>{
    event.preventDefault();
    window.geoLayers?.setSitesVisible?.(false);
    window.geoLayers?.setClientsVisible?.(false);
    window.geoOfficialSites?.toggle?.(false);
    document.getElementById('serviceClose')?.click();
    setStage(false);
  });
  document.getElementById('topClients').onclick=()=>{openApp();window.geoLayers?.toggleClients()};
  document.getElementById('topBodegas').onclick=()=>{openApp();const next=!window.geoLayers?.sitesVisible?.();window.geoLayers?.setSitesVisible(next);window.geoOfficialSites?.toggle(false)};
  if(showResults)showResults.onclick=()=>window.openExecutiveReport?.();
  reportTop.onclick=()=>{openApp(); window.openExecutiveReport?.()};
});
