/* NominalCAD: the status bar under the 3D view.

   Left    the prompt: what to do next with the current tool, and the live readout while something is being
           dragged, drawn, stretched or moved with M / R / S.
   Middle  facts about the design: overall size, piece count, fish tanks and their filled weight, hidden pieces,
           notes, and a warning chip when pieces overlap (clicking it selects them).
   Right   the Show switches and the Snap sizes. Those are ordinary form controls in index.html
           (#showFast, #showDims, #gridSel); this file only keeps the Snap buttons and the hidden select in step.

   What the rest of the program calls:
     setPrompt(html, iconId)   show a live readout in the prompt, e.g. setPrompt('<b>Stretching Leg</b>34" long.').
                       It stays until the next renderStatus(). iconId is optional.
     renderStatus()    redraw the whole bar from the current state. renderAll() calls it after every change.
     renderFacts()     redraw only the facts and the warning chip (cheap enough to call while dragging).

   To give a new tool its own prompt, add a row to TOOL_PROMPTS. A row is a function that returns
   [icon id, name shown in bold, one plain sentence]. */
'use strict';

const TOOL_PROMPTS={
  select(){
    const n=sel.size;
    if(!S.parts.length)return['i-select','Select / move','Start with Furniture presets, or pick Draw a board and drag on the floor.'];
    if(!n)return['i-select','Select / move','Click a piece to select it. Drag empty space to turn the view, right-drag to slide it, scroll to zoom.'];
    if(n===1)return['i-select','Select / move','Drag the piece to slide it. Shift + drag lifts it. Drag a blue handle to change its length. Alt turns snapping off.'];
    return['i-select','Select / move',`${n} pieces selected. Drag one to move them together. Shift + drag lifts them. Alt turns snapping off.`];
  },
  rotate(){
    return['i-rotate','Rotate',sel.size?'Drag a colored ring to turn it. It snaps every 15°; hold Alt for any angle.'
      :'Click a piece, then drag a colored ring to turn it.'];
  },
  draw(){
    const m=M[$('#addMat').value];
    return['i-draw','Draw a board',`Drag on the floor, or on top of a piece, to draw a ${m.kind==='board'?m.short:m.short+' panel'}. Hold Shift to stand a board upright. Press Esc when you are done.`];
  },
  connect(){
    return['i-connect','Connect',connectFirst?'Now click the piece it should meet. That one stays where it is.'
      :'Click the piece you want to move or stretch.'];
  },
};
/* the prompt on the other tabs says what the page is for */
const PAGE_PROMPTS={
  joints:['i-screw','Joints & hardware','Every place two pieces touch, with a suggested fastener. Pick another in the Fasten with column and the hardware list follows.'],
  cut:['i-list','Cut list & shopping','What to buy and how to cut it. Type the prices from your store into the boxes and the total follows.'],
  instr:['i-print','Build instructions','Shopping list, cut list and the steps in order. '+PRINT_HINT], // PRINT_HINT: hosted.js
};

/* ---------- the prompt ---------- */
/* html starts with the name of what is going on in <b>, then the readout or the next step in plain words.
   iconId (optional) changes the small icon in front, e.g. 'i-move'. */
function setPrompt(html,iconId){
  const el=$('#status');
  if(iconId)$('#statusIcon').setAttribute('href','#'+iconId);
  el.innerHTML=html;
  el.parentElement.title=el.textContent; // the full sentence is still readable when the bar is too narrow for it
}
function renderPrompt(){
  if(modal)return; // M / R / S is running and owns the prompt until it ends
  let p;
  if(tab!=='design'){
    p=PAGE_PROMPTS[tab];
    if(!S.parts.length)p=[p[0],p[1],'Nothing to show yet. Go to 1 Design and pick a furniture preset, or add a piece.']; // an empty page has no prices to type and nothing to print
  }
  else if(explode)p=['i-display','Exploded view','Click any piece to put the design back together.'];
  else p=(TOOL_PROMPTS[tool]||TOOL_PROMPTS.select)();
  setPrompt(`<b>${p[1]}</b>${p[2]}`,p[0]);
}

/* ---------- the facts and the warning chip ---------- */
/* fills one segment of the bar, or hides it when there is nothing to say */
function setFact(id,html,title){
  const el=$(id);
  el.hidden=!html;
  if(!html)return;
  el.innerHTML=html;
  if(title!==undefined)el.title=title;
}
function renderFacts(){
  const count=S.parts.length,b=bbox(S.parts);

  // overall size: long form on a wide window, short form on a narrow one (the style sheet shows one of the two)
  if(b){
    const w=fmtFt(b.hi[0]-b.lo[0]),d=fmtFt(b.hi[2]-b.lo[2]),h=fmtFt(b.hi[1]-b.lo[1]);
    setFact('#stSize',`<span class="long">${w} wide × ${d} deep × ${h} tall</span><span class="short">${w} × ${d} × ${h}</span>`,
      `Overall size: ${w} wide × ${d} deep × ${h} tall`);
  }else setFact('#stSize','');

  setFact('#stCount',count?`${count.toLocaleString()} piece${count===1?'':'s'}`:'No pieces yet');

  // fish tanks and what they weigh when filled (the program allows 11.25 lb for every gallon)
  const tanks=S.parts.filter(p=>p.mat==='tank'&&p.gal);
  if(tanks.length){
    const gallons=tanks.reduce((sum,p)=>sum+p.gal,0),pounds=Math.round(gallons*11.25).toLocaleString();
    setFact('#stTanks',`${tanks.length} tank${tanks.length>1?'s':''} · ${pounds} lb filled`,
      `${tanks.length} fish tank${tanks.length>1?'s':''}, ${Math.round(gallons).toLocaleString()} gallons, about ${pounds} lb when filled`);
  }else setFact('#stTanks','');

  setFact('#stHidden',hiddenIds.size?`${icon('i-hide')}${hiddenIds.size} hidden`:'');

  const notes=S.notes||[];
  setFact('#stNotes',notes.length?`${icon('i-info')}${notes.length} note${notes.length>1?'s':''}`:'',
    notes.length?`${notes[0]} Click to read the weight and safety notes on the Cut list tab.`:'');

  // pieces that occupy the same space
  const clashes=findClashes();
  if(clashes.length){
    const ids=new Set(clashes.flatMap(([a,c])=>[a.id,c.id])),more=clashes.length-1;
    setFact('#stWarn',`${icon('i-warn')}${ids.size} pieces overlap`,
      `${clashes[0][0].name} and ${clashes[0][1].name} are in the same space${more?`, and ${more} more pair${more>1?'s':''}`:''}. They are shown in red; move or shorten one. Click to select them.`);
  }else setFact('#stWarn','');
}
function renderStatus(){
  renderPrompt();
  renderFacts();
}

/* clicking the warning selects every piece that overlaps another, so they are easy to find and fix */
$('#stWarn').onclick=()=>{
  const ids=new Set(findClashes().flatMap(([a,b])=>[a.id,b.id]));
  if(!ids.size)return;
  if(tab!=='design')setTab('design');
  sel=ids;
  renderAll();
};
$('#stNotes').onclick=()=>setTab('cut');
$('#addMat').addEventListener('change',()=>renderStatus()); // the Draw a board prompt names the material

/* ---------- Snap: four buttons that drive the hidden #gridSel select (the rest of the code reads that select) ---------- */
function syncSnap(){
  const value=$('#gridSel').value;
  document.querySelectorAll('#snapSeg [data-snap]').forEach(b=>b.classList.toggle('on',b.dataset.snap===value));
}
$('#snapSeg').addEventListener('click',e=>{
  const b=e.target.closest('[data-snap]');
  if(!b)return;
  const s=$('#gridSel');
  s.value=b.dataset.snap;
  s.dispatchEvent(new Event('change'));
});
$('#gridSel').addEventListener('change',syncSnap);
syncSnap();
