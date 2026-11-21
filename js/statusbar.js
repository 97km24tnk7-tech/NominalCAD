/* NominalCAD: the status bar under the 3D view.

   Left    the prompt: what to do next with the current tool, and the live readout while something is being
           dragged, drawn, stretched or moved with M / R / S.
   Middle  facts about the design: overall size, piece count, fish tanks and their filled weight, hidden pieces,
           notes, a warning chip when pieces overlap (clicking it selects them), and the count of problems the
           last Check my design found (clicking it checks again; js/checkui.js draws it).
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
    if(!n&&pickLevel==='comp')return['i-select','Select / move','Click a piece to select the component it belongs to. Click it again for the component around that one.'];
    if(!n)return['i-select','Select / move','Click a piece to select it. Drag empty space to turn the view, right-drag to slide it, scroll to zoom.'];
    const along=followerCount(); // pieces that are fastened to the selection and move with it (js/connections.js)
    if(along&&n===1)return['i-select','Select / move',`Fastened: ${along+1} pieces move together. Unfasten (U) frees this one. A blue handle changes only its length.`];
    if(along)return['i-select','Select / move',`${n} selected, fastened to ${along} more: all ${n+along} move together. Unfasten (U) frees the selection.`];
    if(n===1)return['i-select','Select / move','Drag the piece to slide it. Shift + drag lifts it. Drag a blue handle to change its length. Alt turns snapping off.'];
    return['i-select','Select / move',`${n} pieces selected. Drag one to move them together. Shift + drag lifts them. Alt turns snapping off.`];
  },
  rotate(){
    const along=followerCount();
    if(along)return['i-rotate','Rotate',`Fastened: ${sel.size+along} pieces turn together when you drag a ring. Unfasten (U) frees the selection.`];
    return['i-rotate','Rotate',sel.size?'Drag a colored ring to turn it. It snaps every 15°; hold Alt for any angle.'
      :'Click a piece, then drag a colored ring to turn it.'];
  },
  draw(){
    const m=M[$('#addMat').value];
    return['i-draw','Draw a board',`Drag on the floor, or on top of a piece, to draw a ${m.kind==='board'?m.short:m.short+' panel'}. Hold Shift to stand a board upright. Press Esc when you are done.`];
  },
  connect(){
    return['i-connect','Connect',connectFirst?'Now click the piece it should meet. That one stays where it is, and the two are fastened.'
      :'Click the piece you want to move or stretch. Two pieces that already touch are simply fastened.'];
  },
};
/* the prompt on the other tabs says what the page is for */
const PAGE_PROMPTS={
  joints:['i-screw','Fasteners','Every place two pieces touch, with a suggested fastener. Pick another in the Fasten with column and the hardware list follows.'],
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
  else if(spotlightIds)p=['i-display','Show me: '+esc(spotlightWord.toLowerCase()),`${spotlightIds.size===1?'This piece is':'These '+spotlightIds.size+' pieces are'} blue and everything else is see-through. Drag to look around; click anywhere or press Esc to go back to normal.`];
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
/* The overall size of a design is the size of what gets built: the wooden pieces. A mattress or a fish tank that
   is drawn for fit is bought, and counting it made a bed frame 14" off the floor read "23" tall". Where such a
   thing reaches higher than the wood, that height is said apart: "14" tall (23" tall with the mattress)".
   Returns {box, with}: the bounds to give as the size, and the extra words ('' when there are none). */
function builtSize(parts){
  // Units placed with a design (the chairs of a Dining table with Chairs to match, p.unit, js/chairsets.js) are not
  // part of its size: the table is 60" x 33", and the floor the set takes is said apart ("with the dining chairs").
  const units=parts.filter(p=>p.unit&&!isProp(p)),main=parts.filter(p=>!p.unit);
  if(units.length&&main.some(p=>!isProp(p))){
    const inner=builtSize(main),every=bbox(parts.filter(p=>!isProp(p))),kinds=[...new Set(units.map(p=>p.unitOf||'unit'))];
    const set=`${fmtFt(every.hi[0]-every.lo[0])} × ${fmtFt(every.hi[2]-every.lo[2])} with the ${kinds.length===1?kinds[0].toLowerCase()+'s':'pieces placed with it'}`;
    return{box:inner.box,with:[inner.with,set].filter(Boolean).join('; ')};
  }
  const wood=bbox(parts.filter(p=>!isProp(p))),all=bbox(parts);
  if(!wood||!all)return{box:all,with:''};
  const loads=parts.filter(p=>p.mat==='tank'||p.mat==='mattress');
  const top=Math.max(...loads.map(p=>box(p).hi[1]),-Infinity);
  if(top<=wood.hi[1]+.01)return{box:wood,with:''};
  const tanks=loads.filter(p=>p.mat==='tank').length;
  const what=!tanks?'the mattress':tanks===1?'the tank':'the tanks';
  return{box:wood,with:`${fmtFt(top-wood.lo[1])} tall with ${what}`};
}
/* The pieces the overall size lines measure (the 3D view, js/view3d.js; Views with sizes, js/plans.js): the same
   as builtSize, so the lines never give the set's floor space as if it were the table's. Without units, all of
   them. unitWords(parts): what the lines leave out and the floor the whole set takes, or ''. */
const measuredParts=parts=>parts.some(p=>p.unit&&!isProp(p))&&parts.some(p=>!p.unit&&!isProp(p))?parts.filter(p=>!p.unit):parts;
function unitWords(parts){
  const units=parts.filter(p=>p.unit&&!isProp(p));
  if(!units.length||measuredParts(parts)===parts)return'';
  const main=parts.find(p=>!p.unit&&!isProp(p)),set=main&&S.sets&&S.sets[main.set];
  const whose=set&&set.name?set.name.toLowerCase():'design';
  const kinds=[...new Set(units.map(p=>(p.unitOf||'piece').toLowerCase()+'s'))];
  const every=bbox(parts.filter(p=>!isProp(p)));
  return`The size lines measure the ${whose} by itself; with the ${listWords(kinds)} it takes ${fmtFt(every.hi[0]-every.lo[0])} × ${fmtFt(every.hi[2]-every.lo[2])} of floor.`;
}
function renderFacts(){
  const count=S.parts.length,built=builtSize(S.parts),b=built.box;

  // overall size: long form on a wide window, short form on a narrow one (the style sheet shows one of the two)
  if(b){
    const w=fmtFt(b.hi[0]-b.lo[0]),d=fmtFt(b.hi[2]-b.lo[2]),h=fmtFt(b.hi[1]-b.lo[1]);
    setFact('#stSize',`<span class="long">${w} wide × ${d} deep × ${h} tall</span><span class="short">${w} × ${d} × ${h}</span>`,
      `Overall size of what you build: ${w} wide × ${d} deep × ${h} tall`+(built.with?` (${built.with})`:''));
  }else setFact('#stSize','');

  setFact('#stCount',count?`${count.toLocaleString()} piece${count===1?'':'s'}`:'No pieces yet');

  // fish tanks and what they weigh when filled (the program allows 11.25 lb for every gallon)
  const tanks=S.parts.filter(p=>p.mat==='tank'&&p.gal);
  // the fish tank controls in the ribbon only show while the design has a tank in it (the style sheet reads this)
  document.body.toggleAttribute('data-tanks',S.parts.some(p=>p.mat==='tank'));
  if(tanks.length){
    const gallons=tanks.reduce((sum,p)=>sum+p.gal,0),pounds=Math.round(gallons*11.25).toLocaleString();
    setFact('#stTanks',`${tanks.length} tank${tanks.length>1?'s':''} · ${pounds} lb filled`,
      `${tanks.length} fish tank${tanks.length>1?'s':''}, ${Math.round(gallons).toLocaleString()} gallons, about ${pounds} lb when filled`);
  }else setFact('#stTanks','');

  setFact('#stHidden',hiddenIds.size?`${icon('i-hide')}${hiddenIds.size} hidden`:'');

  const notes=S.notes||[];
  setFact('#stNotes',notes.length?`${icon('i-info')}${notes.length} note${notes.length>1?'s':''}`:'',
    notes.length?`${notes[0]} Click to read the weight and safety notes on the Cut list & shopping tab.`:'');

  // pieces that occupy the same space
  const clashes=findClashes();
  if(clashes.length){
    const ids=new Set(clashes.flatMap(([a,c])=>[a.id,c.id])),more=clashes.length-1;
    setFact('#stWarn',`${icon('i-warn')}${ids.size} pieces overlap`,
      `${clashes[0][0].name} and ${clashes[0][1].name} are in the same space${more?`, and ${more} more pair${more>1?'s':''}`:''}. They are shown in red; move or shorten one. Click to select them.`);
  }else setFact('#stWarn','');

  // what the last Check my design found (js/checkui.js)
  renderCheckChip();
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
