// GeoCost V25: referencias CAPUFE/FONADIN de GeoRisk V112; sin falsa detección geográfica.
(()=>{
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],selected=[],baseManual=0;
const stateNames=['Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'];
window.GCRegional={getSelected:()=>selected.slice(),getManualBase:()=>baseManual};
function total(){return selected.reduce((a,x)=>a+x.price,0)}
function refreshTolls(){
 $('tollItems').innerHTML=selected.length?selected.map((x,i)=>`<div class="toll-item"><span>${esc(x.name)} · ${esc(x.section)} · ${esc(x.cls)}: <b>$${x.price.toFixed(2)}</b></span><button type="button" data-remove="${i}" aria-label="Eliminar caseta">×</button></div>`).join(''):'Sin casetas agregadas.';
 $('tolls').value=(total()+baseManual).toFixed(2);
 $('tollItems').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{selected.splice(+b.dataset.remove,1);refreshTolls();recalc()});
}
function recalc(){if(typeof updateCalculations==='function')updateCalculations();}
function renderOptions(){const q=$('tollSearch').value.trim().toLowerCase();let filtered=rows.filter(x=>!q||(`${x.name} ${x.section}`).toLowerCase().includes(q)).slice(0,100);$('tollTariff').innerHTML=filtered.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.section)} · ${esc(x.effective||'s/f')}</option>`).join('')||'<option value="">Sin coincidencias</option>'}
window.addEventListener('DOMContentLoaded',()=>{
 $('stateFuelPrices').innerHTML='<div class="state-price-toolbar"><button class="secondary" type="button" id="toggleStatePrices">Editar precios por estado</button><span class="hint">Solo referencia; sin datos estatales cargados.</span></div><div class="state-price-grid" id="fuelGrid" hidden>'+stateNames.map(n=>`<label>${esc(n)}<input type="number" min="0" step=".01" placeholder="Sin dato" data-fuel-state="${esc(n)}"></label>`).join('')+'</div>';
 $('toggleStatePrices').onclick=()=>{$('fuelGrid').hidden=!$('fuelGrid').hidden};
 $('tolls').addEventListener('input',()=>{baseManual=Math.max(0,Number($('tolls').value)||0)-total()});
 $('tollSearch').addEventListener('input',renderOptions);
 $('tollClass').addEventListener('change',()=>{});
 $('tollAdd').onclick=()=>{const r=rows.find(x=>x.id===$('tollTariff').value),cls=$('tollClass').value;if(!r)return;const price=Number(r.rates?.[cls]);if(!Number.isFinite(price)||price<=0){alert('No hay tarifa válida para esa configuración. Revisa la sección o ingresa el importe manualmente.');return}selected.push({id:r.id,name:r.name,section:r.section,cls,price,date:r.effective});refreshTolls();recalc()};
 $('tollClear').onclick=()=>{selected=[];refreshTolls();recalc()};
 fetch('data/capufe-tarifas.json').then(r=>{if(!r.ok)throw Error('No disponible');return r.json()}).then(j=>{rows=j.records||[];renderOptions();$('tollSearch').placeholder=`Buscar en ${rows.length} tarifas CAPUFE/FONADIN`;}).catch(()=>{$('tollTariff').innerHTML='<option>Catálogo no disponible. Usa importe manual.</option>'});
});
})();