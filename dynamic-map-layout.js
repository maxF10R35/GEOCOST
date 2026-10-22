/* Only controls layout; never changes route, quote, IRA or effort calculations. */
(function () {
  'use strict';
  const shell=document.querySelector('.app-shell');
  if(!shell)return;
  const results=['p-resumen','p-costos','p-bodegas','effort-editor-panel'].map(id=>document.getElementById(id)).filter(Boolean);
  let last=null, queued=false;
  function visible(el){return !el.hidden&&!el.classList.contains('hidden')&&!el.classList.contains('visually-hidden');}
  function redraw(){
    queued=false;
    if(window.map && typeof window.map.invalidateSize==='function'){
      window.map.invalidateSize({pan:false,animate:false});
    }
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>requestAnimationFrame(redraw));}
  function sync(){
    const hasResults=results.some(visible);
    if(hasResults!==last){last=hasResults;shell.classList.toggle('map-only-mode',!hasResults);schedule();}
  }
  const observer=new MutationObserver(sync);
  for(const el of results)observer.observe(el,{attributes:true,attributeFilter:['hidden','class','style']});
  window.addEventListener('resize',schedule,{passive:true});
  sync();
})();
