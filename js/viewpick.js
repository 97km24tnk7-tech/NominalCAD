/* NominalCAD: pointing at and clicking the things in the 3D view that are not pieces.

   A fastener, a piece of hardware and the handle that opens a door are small things on or inside the wood. This
   file is the one place that decides what the pointer is on, shows the small tip beside it, and remembers which
   of them is "picked" (clicked). Pieces keep their own selection (sel); picking one of these clears it, and
   selecting a piece clears the pick.

     picked                   null, or {type, ...}: the fastener connection or the hardware that was clicked
                                {type:'conn', key}   a connection of connGraph()   (js/fastenerview.js)
                                {type:'hw', id}      a piece of hardware           (js/hardwaretool.js)
     setPicked(pick)          pick it (or null to drop it) and redraw
     VIEW_PICKERS             the files that own such things add themselves here:
                                VIEW_PICKERS.push({early, find(event)})
                              find returns null, or what the pointer is on:
                                {dist, tip, through, press(event, base)}
                                  dist     how far along the pointer's ray it is (the nearest thing wins)
                                  tip      the words for the small tip
                                  through  true when it may be picked through wood (decided by its owner)
                                  press    what a click does. To start a drag it sets
                                           drag = {...base, mode:'custom', move(event), up(drag)}
                              early: true for handles, which win over the move arrows of the selection
     PICKED_KINDS             per type of pick: {exists(pick), props(pick), remove(pick), prompt(pick)}
     deletePicked()           the Delete key and the Delete command, while something is picked */
'use strict';

let picked=null;
const VIEW_PICKERS=[];
const PICKED_KINDS={};
const PICK_SLACK=.35; // inches: a thing this close behind the surface of the wood still counts as on it

function setPicked(pick){
  picked=pick||null;
  if(picked)sel=new Set();
  renderAll();
}
/* drops a pick whose thing is gone (after an undo, a delete, a new design) */
function checkPicked(){
  if(!picked)return;
  const kind=PICKED_KINDS[picked.type];
  if(sel.size||!kind||!kind.exists(picked))picked=null;
}
function deletePicked(){
  if(picked&&PICKED_KINDS[picked.type])PICKED_KINDS[picked.type].remove(picked);
}
/* The Properties panel of the pick. renderProps() (js/panels.js) asks first; true means the panel is drawn. */
function renderPickedProps(){
  if(!picked)return false;
  const drawn=PICKED_KINDS[picked.type].props(picked);
  if(!drawn)return false;
  $('#propsName').textContent=drawn.title;
  $('#props').innerHTML=drawn.html;
  return true;
}

/* ---------- what is under the pointer ---------- */
function thingUnderPointer(e,early){
  setRay(e);
  let best=null;
  for(const picker of VIEW_PICKERS){
    if(!!picker.early!==early)continue;
    const found=picker.find(e);
    if(found&&(!best||found.dist<best.dist))best=found;
  }
  if(!best||early||best.through)return best;
  // on the wood, not behind it
  const wood=pick(e);
  return!wood||best.dist<=wood.distance+PICK_SLACK?best:null;
}
/* The canvas calls this when the left button goes down with the Select tool (js/tools.js): once before the move
   arrows are tried (early = true) and once after. True means the press was used. */
function viewPickDown(e,base,early){
  if(tool!=='select'||explode)return false;
  const thing=thingUnderPointer(e,early);
  if(thing){
    hideViewTip();
    thing.press(e,base);
    return true;
  }
  if(!early&&picked){picked=null;renderAll();} // a click anywhere else drops the pick
  return false;
}

/* ---------- the small tip beside the pointer ---------- */
let tipQueued=false,tipEvent=null;
function hideViewTip(){
  const el=$('#viewTip');
  if(el)el.hidden=true;
  cv.style.cursor=tool==='draw'||tool==='connect'||placingHardware||placingDrawer?'crosshair':'';
}
function showViewTip(e,text){
  const el=$('#viewTip'),frame=$('#cvWrap').getBoundingClientRect();
  el.textContent=text;
  el.hidden=false;
  const x=Math.min(e.clientX-frame.left+14,frame.width-el.offsetWidth-6),y=Math.min(e.clientY-frame.top+16,frame.height-el.offsetHeight-6);
  el.style.transform=`translate(${Math.round(Math.max(4,x))}px,${Math.round(Math.max(4,y))}px)`;
  cv.style.cursor='pointer';
}
cv.addEventListener('pointermove',e=>{
  tipEvent=e;
  if(tipQueued)return;
  tipQueued=true;
  requestAnimationFrame(()=>{ // at most once per drawn frame, however fast the pointer moves
    tipQueued=false;
    if(drag||modal||tool!=='select'||explode||placingHardware||placingDrawer||tab!=='design'){hideViewTip();return;}
    const thing=thingUnderPointer(tipEvent,true)||thingUnderPointer(tipEvent,false);
    if(thing&&thing.tip)showViewTip(tipEvent,thing.tip);else hideViewTip();
  });
});
cv.addEventListener('pointerleave',hideViewTip);
cv.addEventListener('pointerdown',hideViewTip,true);

/* ---------- keys ---------- */
window.addEventListener('keydown',e=>{
  if(!picked||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)||document.querySelector('dialog[open]'))return;
  if(e.key==='Delete'||e.key==='Backspace'){
    e.preventDefault();e.stopImmediatePropagation();
    deletePicked();
  }else if(e.key==='Escape'){
    picked=null; // the usual Esc handling follows and redraws
  }
},true);

/* the status bar prompt while something is picked */
const promptWithoutPick=TOOL_PROMPTS.select;
TOOL_PROMPTS.select=()=>{
  const words=picked&&PICKED_KINDS[picked.type]&&PICKED_KINDS[picked.type].prompt(picked);
  return words?['i-select','Select / move',words]:promptWithoutPick();
};
