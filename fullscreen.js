// V20: independent operation mode and map fullscreen controls.
(function(){
'use strict';
const mode=document.getElementById('operationMode'), target=document.getElementById('destino'), label=document.getElementById('destinationLabel'), mapBox=document.querySelector('.map-column'), btn=document.getElementById('fullscreenMap');
if(!target||!mapBox||!btn)return;
function updateMode(){const abasto=mode.value==='abasto';target.value='';target.placeholder=abasto?'Buscar bodega o planta CEMEX destino':'Buscar frente por nombre o ID';label.textContent=abasto?'Destino · instalación CEMEX':'Destino · frente / cliente';document.getElementById('destinoSuggestions').hidden=true;const comparisons=document.getElementById('originQuoteResults');if(comparisons)comparisons.textContent=abasto?'Selecciona las instalaciones de origen y destino y calcula para comparar el abasto.':'Selecciona un frente y calcula para comparar las bodegas cercanas.';document.getElementById('mapStatus').textContent=abasto?'Modo abasto: selecciona dos instalaciones CEMEX diferentes.':'Modo entrega: selecciona un frente destino.';}
if(mode)mode.addEventListener('change',updateMode);
function resized(){try{window.map?.invalidateSize()}catch(e){}}
function updateFull(){const active=!!document.fullscreenElement||mapBox.classList.contains('map-maximized');btn.textContent=active?'⤢ Salir de pantalla completa':'⛶ Pantalla completa';btn.setAttribute('aria-pressed',String(active));setTimeout(resized,80)}
btn.addEventListener('click',async()=>{if(document.fullscreenElement){try{await document.exitFullscreen()}catch(e){}mapBox.classList.remove('map-maximized')}else if(mapBox.classList.contains('map-maximized')){mapBox.classList.remove('map-maximized')}else{try{if(mapBox.requestFullscreen)await mapBox.requestFullscreen();else mapBox.classList.add('map-maximized')}catch(e){mapBox.classList.add('map-maximized')}}updateFull()});
document.addEventListener('fullscreenchange',updateFull);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mapBox.classList.contains('map-maximized')){mapBox.classList.remove('map-maximized');updateFull()}});
})();
