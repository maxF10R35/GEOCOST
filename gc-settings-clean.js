/* GeoCost SC 2026 — depuración del formulario IMT sin eliminar los IDs que usa el motor
   heredado para mostrar su comparativo. Todo lo nuevo usa controles propios. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const edit=()=>document.dispatchEvent(new Event('geocoast:imt-edit'));
 const box=(cls)=>{const e=document.createElement('div');e.className=cls;return e};
 function moveInput(id,to){const field=box('gc-setting-field'),label=document.querySelector(`label[for="${id}"]`),input=$(id);if(!input)return;
  if(label)field.append(label);field.append(input);$(to).append(field);
 }
 function setUpTiers(){const root=$('gcTierFields');if(!root||!window.GCIMT)return;
  root.className='gc-tier-inputs';
  root.innerHTML=window.GCIMT.tierDefaults.map((tier,i)=>`<label>${tier.name} <small>${i?'% sobre C':'base'}</small><input id="gcTier_${tier.id}" value="${tier.pct}" min="${i?0:0}" max="70" step="1" type="number" ${i?'':'readonly'}></label>`).join('');
  root.addEventListener('change',()=>{let previous=0;for(const tier of window.GCIMT.tierDefaults){const inp=$('gcTier_'+tier.id);if(!inp)continue;const current=Math.min(70,Math.max(previous,Number(inp.value)||0));inp.value=String(current);previous=current;}edit()});
 }
 function setUpFleet(){const root=$('gcFleetFields');if(!root||!window.GCIMT)return;
  root.innerHTML=Object.entries(window.GCIMT.carrierProfiles).map(([id,conf])=>`<div class="gc-fleet-editor"><strong>${id[0].toUpperCase()+id.slice(1)} <small>${conf.fleet} unidades</small></strong><div class="gc-fleet-rows"><label>Adm. por unidad ×<input type="number" id="gcCarrierAdmin_${id}" min="0" max="4" step="0.01" value="${conf.admin}"></label><label>Patio / infraestructura ×<input type="number" id="gcCarrierPatio_${id}" min="0" max="4" step="0.01" value="${conf.patio}"></label><label>Aprovechamiento ×<input type="number" id="gcCarrierUtil_${id}" min="0.3" max="2" step="0.01" value="${conf.utilization}"></label></div></div>`).join('');
  root.addEventListener('input',()=>{describeFleet();edit()});
  $('tipoTransportista')?.addEventListener('change',()=>{describeFleet();edit()});
  describeFleet();
 }
 function describeFleet(){const kind=$('tipoTransportista')?.value||'mediano';const conf=window.GCIMT.carrierProfiles[kind],a=Number($('gcCarrierAdmin_'+kind)?.value)||0,p=Number($('gcCarrierPatio_'+kind)?.value)||0,u=Number($('gcCarrierUtil_'+kind)?.value)||0;
  const text=kind==='chico'?'Estructura administrativa pequeña, menos infraestructura, posible menor utilización del vehículo.':kind==='mediano'?'Operación intermedia con coordinación, mantenimiento y controles propios.':'Mayor personal de soporte e infraestructura, con potencial de mayor utilización de la flota.';
  $('gcCarrierCurrent').innerHTML=`<strong>${kind.toUpperCase()} · ${conf.fleet} vehículos</strong><small>${text}</small><span>Administración ×${a.toFixed(2)} · Patio ×${p.toFixed(2)} · Utilización ×${u.toFixed(2)}</span><small>Multiplicadores de simulación; no equivalen a salarios ni estructuras certificados por segmento.</small>`;
 }
 function compactFuel(){const p=$('fuelCurrentPrice');if(!p||!$('gcDieselShort'))return;
  const update=()=>{$('gcDieselShort').textContent=p.textContent||'Pendiente'};
  update();new MutationObserver(update).observe(p,{childList:true,characterData:true,subtree:true});
 }
 function init(){if(!$('gcCleanSettings'))return;
  const legacy=$('gcLegacyControls');if(!legacy)return;
  moveInput('diesel','gcMainFields');moveInput('handling','gcMainFields');
  const diesel=legacy.querySelector('.diesel-panel');if(diesel)$('gcFuelPlace').append(diesel);
  moveInput('tolls','gcTollsPlace');const toll=$('tollSearch')?.closest('.dynamic-costs');if(toll)$('gcTollsPlace').append(toll);
  if($('imtSettings'))$('gcIMTPlace').append($('imtSettings'));
  const year=$('imtModelYear');if(year&&!year.children.length){for(let y=2026;y>=2000;y--){const opt=document.createElement('option');opt.value=String(y);opt.textContent=String(y);opt.selected=y===2022;year.append(opt)}}
  const manualFields=$('gcManualCostFields');
  if(manualFields){const labels={fixed:'Costos fijos asignados al ciclo',diesel:'Diésel',maintenance:'Mantenimiento',tires:'Llantas',lubricants:'Lubricantes',def:'DEF / AdBlue',tolls:'Peajes ambos sentidos',serviceMisc:'Maniobras, viáticos, servicios',riskCost:'Custodia / riesgo justificado'};
    manualFields.innerHTML=Object.entries(labels).map(([k,s])=>`<label>${s} (MXN / ciclo)<input id="gcManual_${k}" data-gcmanual="${k}" type="number" min="0" step="0.01" placeholder="Auto" autocomplete="off"></label>`).join('');
    manualFields.addEventListener('change',edit);
    $('gcManualReset')?.addEventListener('click',()=>{manualFields.querySelectorAll('input').forEach(x=>x.value='');edit()});
  }
  setUpTiers();setUpFleet();compactFuel();
  // IMT–GeoRisk es el único motor. No se generan cotizaciones paralelas.
  $('imtEnabled').checked=true;
  for(const id of ['gcMarketMin','gcMarketMax','gcMarketSource','imtModelYear','imtMakeModel'])$(id)?.addEventListener('change',edit);
  const status=$('settingsStatus');if(status)status.textContent='Modelo único GeoCoast–IMT–GeoRisk. La memoria técnica se genera de forma independiente.';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
