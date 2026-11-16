/* WoodShop Designer: the floating panels over the 3D view (Pieces on the left, Properties on the right).
   Each can be dragged by its title bar, rolled up, or hidden, and the app remembers where you left them.
   To add another floating panel: give an <aside class="float" id="..."> the same header markup and list it in PANELS. */
'use strict';
const PANELS=['left','right'];
let panelState={};try{panelState=JSON.parse(localStorage.getItem('woodshop.panels'))||{};}catch(e){}
const panelOf=k=>panelState[k]||(panelState[k]={});
const savePanels=()=>{try{localStorage.setItem('woodshop.panels',JSON.stringify(panelState));}catch(e){}};
function syncPanels(){
  for(const k of PANELS){const el=$('#'+k),st=panelOf(k);
    el.classList.toggle('min',!!st.min);
    el.classList.toggle('off',!!st.off||(k==='right'&&!sel.size)); // Properties only appears while something is selected
    if(st.x!=null){el.style.left=st.x+'px';el.style.top=st.y+'px';el.style.right='auto';}else el.style.left=el.style.top=el.style.right='';}
  $('#tPieces').classList.toggle('on',!panelOf('left').off);$('#tProps').classList.toggle('on',!panelOf('right').off);
}
function togglePanel(k){const st=panelOf(k);st.off=!st.off;savePanels();syncPanels();}
function resetPanels(){panelState={};savePanels();syncPanels();}
document.querySelectorAll('aside.float .fh').forEach(h=>{
  const el=h.parentElement,k=el.id;
  h.addEventListener('pointerdown',e=>{
    if(e.target.closest('button'))return;
    const wrap=$('#cvWrap').getBoundingClientRect(),r=el.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;h.setPointerCapture(e.pointerId);
    const move=ev=>{const st=panelOf(k);st.x=Math.round(Math.max(0,Math.min(wrap.width-80,ev.clientX-wrap.left-dx)));st.y=Math.round(Math.max(0,Math.min(wrap.height-34,ev.clientY-wrap.top-dy)));syncPanels();};
    const up=()=>{h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',up);savePanels();};
    h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);});
  h.querySelector('[data-min]').onclick=()=>{const st=panelOf(k);st.min=!st.min;savePanels();syncPanels();};
  h.querySelector('[data-hide]').onclick=()=>togglePanel(k);
});
