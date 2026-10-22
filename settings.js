
// GeoCost V17: parámetros de costos editables, persistentes durante esta sesión.
window.addEventListener('DOMContentLoaded',()=>{
 const panel=document.getElementById('cost-settings-panel');
 const button=document.getElementById('openCostSettings');
 const close=()=>{panel.hidden=true;button.setAttribute('aria-expanded','false')};
 const open=()=>{panel.hidden=false;button.setAttribute('aria-expanded','true');panel.querySelector('input')?.focus()};
 button?.addEventListener('click',()=>panel.hidden?open():close());
 document.getElementById('closeCostSettings')?.addEventListener('click',close);
 document.getElementById('cancelCostSettings')?.addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close()});
 // Reutilizamos la acción apply del motor existente para recalcular origen y alternativas.
 document.getElementById('apply')?.addEventListener('click',()=>{
   document.getElementById('settingsStatus').textContent='Parámetros aplicados a la simulación.';
   close();
 });
});
