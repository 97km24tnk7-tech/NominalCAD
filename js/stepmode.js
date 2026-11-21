/* NominalCAD: Build step by step, on screen.

   A mode of the Design tab (the "Build step by step" button in the ribbon's Finish group; it works in Beginner).
   The 3D view shows the build as it stands at one step of buildPlan() (js/buildsteps.js):
     - what is built so far is drawn as usual,
     - the pieces this step adds are orange,
     - the pieces of later steps are hidden,
     - this step's fasteners are dark blue and show through the wood.
   A panel down the right side of the view shows the words of the step, its "You need" line and its "Fasten with" lines
   (the same text as the Build instructions page: stepTextHtml, js/plans.js). Back and Next, or the left and
   right arrow keys, move through the steps. Esc, or the X of the panel, leaves, and the view is put back exactly
   as it was: the camera, the selection, what was hidden, the view mode.

   It only changes the picture. Nothing is written to the project, and undo is not touched. The design can still
   be turned, zoomed and clicked while the mode is on; when it is edited, the steps are worked out again.

     stepMode             null, or {index, keep} while the mode is on
     startStepMode()      toggleStepMode()      endStepMode()
     showBuildStep(index) go to a step (0 is the first) */
'use strict';

let stepMode=null;
const stepGroup=new THREE.Group();   // this step's fasteners, drawn over the wood
scene.add(stepGroup);
const STEP_FASTENER_RADIUS=.11;      // a fastener of the step is drawn at least this thick on screen, in inches

function startStepMode(){
  if(stepMode||!S.parts.length)return;
  if(tab!=='design')setTab('design');
  endSpotlight();
  stepMode={index:0,keep:{cam:{...cam,target:cam.target.clone()},sel:new Set(sel),hidden:new Set(hiddenIds),wood:woodMode,picked,explode}};
  sel=new Set();picked=null;explode=0;woodMode='solid';
  // It opens on step 1, like the printed page. A step before the building starts (cutting) adds nothing to the
  // picture, so the whole design is shown there: this is what you are going to build.
  document.body.dataset.stepmode='on';
  $('#stepPanel').hidden=false;
  showBuildStep(0);
  syncWoodModeChip();
}
function endStepMode(){
  if(!stepMode)return;
  const keep=stepMode.keep;
  stepMode=null;
  emptyGroup(stepGroup);
  delete document.body.dataset.stepmode;
  $('#stepPanel').hidden=true;
  // exactly as it was. Pieces that were deleted meanwhile are simply no longer there to select or hide.
  const present=new Set(S.parts.map(p=>p.id));
  sel=new Set([...keep.sel].filter(id=>present.has(id)));
  hiddenIds=new Set([...keep.hidden].filter(id=>present.has(id)));
  woodMode=keep.wood;picked=keep.picked;explode=keep.explode;
  Object.assign(cam,keep.cam);
  syncWoodModeChip();
  renderAll();
  updateCam();
}
function toggleStepMode(){
  if(stepMode)endStepMode();else startStepMode();
}
function showBuildStep(index){
  if(!stepMode)return;
  const plan=buildPlan(),steps=plan.steps;
  stepMode.index=Math.max(0,Math.min(steps.length-1,index));
  const step=steps[stepMode.index];
  // later pieces are hidden the way Hide does it, so their fasteners and hardware go with them; so is a part that
  // was built apart and is not set in place yet (piecesNotYetThere, js/buildsteps.js)
  const firstBuild=steps.findIndex(candidate=>candidate.pieces.length);
  const beforeBuilding=stepMode.index<firstBuild;
  hiddenIds=beforeBuilding?new Set():piecesNotYetThere(plan,stepMode.index);
  stepMode.line=0;   // the "Fasten with" line that was clicked in the view, if any
  sel=new Set([...sel].filter(id=>!hiddenIds.has(id)));
  $('#stepCount').textContent=`Step ${step.no} of ${steps.length}`;
  const skipped=beforeBuilding?'<p class="hint">The view shows the finished design: this is what you are going to build. From the first building step on it shows the build as it stands at that step.</p>':'';
  // (step 1 starts with the line that every part is made first, from its part drawing on the Cut list page: js/shoppacket.js)
  const first=stepMode.index===0?`<p class="hint shop-first-line">${esc(SHOP_FIRST_WORDS)}</p>`:'';
  $('#stepBody').innerHTML=first+(stepMode.index===0&&plan.note?`<p class="hint">${esc(plan.note)}</p>`:'')+skipped+stepTextHtml(step);
  $('#stepBody').scrollTop=0;
  linkWords($('#stepBody'));   // the highlighted words of the printed page work here too (js/wordlinks.js)
  $('#stepBack').disabled=stepMode.index===0;
  $('#stepNext').disabled=stepMode.index===steps.length-1;
  renderAll();
}
/* after the pieces are in the scene: this step's pieces orange, and its fasteners on top of the wood */
SCENE_EXTRAS.push(function paintBuildStep(){
  emptyGroup(stepGroup);
  if(!stepMode||forceDims)return;   // forceDims: the pictures for the plans are being taken
  const step=buildPlan().steps[stepMode.index];
  if(!step)return;
  const hosts=step.hardware.flatMap(row=>row.items.map(item=>item.on));
  // brought: a part built earlier that this step sets in place
  const added=step.pieces.concat(step.brought||[]);
  for(const id of added.length?added.map(p=>p.id):hosts){
    const group=meshes.get(id);
    if(group&&!sel.has(id)&&!isProp(byId(id)))group.children[0].material.color.setHex(STEP_COL.added);
  }
  // (fastenerInWorld: the fasteners of a design that was turned as one are laid out in its own frame, js/fasteners.js)
  stepGroup.add(fastenerMarkers(stepFasteners(step).slice(0,MARKERS_MAX).map(fastenerInWorld),{color:STEP_COL.fastener,minRadius:STEP_FASTENER_RADIUS,onTop:true}));
});
/* ---------- clicking a fastener of the step ----------
   The dark blue fasteners are what the step is about, so each is a generous target, through the wood. Pointing at
   one says which line it belongs to; a click shows that line at the top of the panel and marks it in the list.
   It selects nothing, so no board is picked by mistake and Properties does not cover the joint. */
function stepFastenerUnderPointer(){
  const step=stepMode&&buildPlan().steps[stepMode.index];
  if(!step||!step.groups.length)return null;
  const reach=Math.max(.45,cam.r*.012);   // about nine pixels at any zoom
  let best=null;
  for(const group of step.groups){
    for(const link of group.links){
      if(hiddenIds.has(link.a.id)||hiddenIds.has(link.b.id))continue;
      for(const laid of fastenersOfLink(link)){
        const f=fastenerInWorld(laid);
        const hit=rayToStretch(ray.ray.origin,ray.ray.direction,f.pos,pointPlus(f.pos,f.dir,f.len));
        if(hit.gap<=reach&&(!best||hit.gap<best.gap))best={gap:hit.gap,dist:hit.dist,group,f};
      }
    }
  }
  return best;
}
VIEW_PICKERS.push({
  early:false,
  find(){
    const found=stepFastenerUnderPointer();
    if(!found)return null;
    return{dist:found.dist,through:true,tip:`Line ${found.group.no} of this step. ${found.f.tip} Click to read the whole line.`,
      press:()=>showStepLine(found.group.no)};
  },
});
function showStepLine(no){
  if(!stepMode)return;
  const step=buildPlan().steps[stepMode.index],group=step&&step.groups.find(candidate=>candidate.no===no);
  if(!group)return;
  stepMode.line=no;
  const body=$('#stepBody');
  body.querySelectorAll('.stp-pick').forEach(el=>el.remove());
  body.querySelectorAll('li.on').forEach(el=>el.classList.remove('on'));
  const line=body.querySelector(`li[data-line="${no}"]`);
  if(line)line.classList.add('on');
  const card=document.createElement('div');
  card.className='stp-pick';
  card.innerHTML=`<b>The fastener you clicked</b> is one of line ${no} under "Fasten with": ${esc(group.line)}${group.where?' '+esc(group.where):''}`;
  body.prepend(card);
  body.scrollTop=0;
}

/* an edit while the mode is on: the steps are new, so the panel and what is hidden are worked out again */
ON_COMMIT.push(()=>{
  if(stepMode)setTimeout(()=>{if(stepMode)showBuildStep(stepMode.index);},0);
});
ON_LOAD.push(()=>{
  if(stepMode)setTimeout(()=>{if(stepMode)showBuildStep(stepMode.index);},0);
});

$('#stepBack').onclick=()=>showBuildStep(stepMode.index-1);
$('#stepNext').onclick=()=>showBuildStep(stepMode.index+1);
$('#stepClose').onclick=endStepMode;
/* Arrow keys and Esc, before the keys of the Design tab see them (there the arrows nudge the selection). Not while
   a text box, a dialog, a menu or a tool that is in the middle of something wants the key. */
window.addEventListener('keydown',event=>{
  if(!stepMode||tab!=='design')return;
  if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)||document.querySelector('dialog[open]')||document.querySelector('.pd.open'))return;
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  const busy=modal||placingHardware||placingDrawer||tool!=='select'||picked||sel.size;
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
    // always a step back or forward here, never a nudge: someone reading the steps must not move the furniture
    showBuildStep(stepMode.index+(event.key==='ArrowRight'?1:-1));
  }else if(event.key==='Escape'){
    if(busy)return;       // Esc first drops the tool, the pick or the selection; the next Esc leaves
    endStepMode();
  }else return;
  event.preventDefault();
  event.stopImmediatePropagation();
},true);
/* (Leaving the Design tab leaves the mode: setTab in js/app.js calls endStepMode, because the document pages take
   their own pictures of the whole design.) */

/* ---------- self-check (selfTest runs every function in SELFTESTS, see js/core.js) ----------
   The Build instructions page as a person sees it, for a few designs of different kinds (a table with pocket
   holes, a cabinet with doors, the shed with its nails, a design drawn by hand): every step shows its "You
   need" line, every step that fastens something has a picture and at least one close-up, no step shows more
   close-ups than CLOSEUPS_MAX, a numbered line has its balloon, and the page is not slow. */
SELFTESTS.push(function stepPicturesAndPage(problems){
  const wrong=text=>{if(problems.length<60)problems.push('step pictures: '+text);};
  const tabKept=tab;
  const check=label=>{
    const started=performance.now();
    renderCut(true);
    const took=performance.now()-started,plan=buildPlan(),shots=picturesFor(true).steps;
    if(shots.length!==plan.steps.length)wrong(`${label}: ${shots.length} sets of pictures for ${plan.steps.length} steps`);
    const boxes=[...$('#instrPage').querySelectorAll('.step')];
    if(boxes.length!==plan.steps.length)wrong(`${label}: the page shows ${boxes.length} steps, the plan has ${plan.steps.length}`);
    plan.steps.forEach((step,index)=>{
      const shot=shots[index]||{closeups:[]},box=boxes[index];
      if(box&&!box.querySelector('.need.you'))wrong(`${label}: step ${step.no} shows no "You need" line`);
      const fastened=step.groups.some(group=>group.sample);
      if((step.pieces.length||fastened)&&!/^data:image/.test(shot.src))wrong(`${label}: step ${step.no} has no picture`);
      if(fastened&&!shot.closeups.length)wrong(`${label}: step ${step.no} fastens pieces and has no close-up`);
      if(shot.closeups.length>CLOSEUPS_MAX)wrong(`${label}: step ${step.no} has ${shot.closeups.length} close-ups`);
      // (a close-up is of a "Fasten with" line or of a line under "Hardware in this step")
      if(shot.closeups.some(close=>!/^data:image/.test(close.src)||!step.groups.concat(step.hardware).some(line=>line.no===close.no)))wrong(`${label}: step ${step.no} has a close-up without a picture or without its line`);
      if(box&&box.querySelectorAll('.need.fasten .bal:not(.none)').length!==step.groups.length)wrong(`${label}: step ${step.no} does not number every "Fasten with" line`);
      if(box&&box.querySelectorAll('.closeups figure').length!==shot.closeups.length)wrong(`${label}: step ${step.no} does not show all its close-ups`);
    });
    if(took>4000)wrong(`${label}: the instructions took ${Math.round(took)} ms to draw`);
    // a second visit takes the pictures from memory
    const again=performance.now();
    renderCut(true);
    if(picturesFor(true).steps!==shots)wrong(`${label}: the pictures were taken again although nothing changed`);
    void again;
  };
  try{
    for(const name of['Workbench','Base cabinet with doors','Shed']){
      const preset=PRESETS.find(candidate=>candidate.name===name),vals=presetDefaults(preset);
      placePreset(preset,vals,preset.build(vals),false);
      check(name);
    }
    load(JSON.stringify(blank()),true);
    addParts([mk('Side','1x10',[.75,30,9.25],[0,0,0]),mk('Side','1x10',[.75,30,9.25],[24.75,0,0]),mk('Top','1x12',[27.5,.75,11.25],[-1,30,-1])]);
    commit();
    check('a design drawn by hand');
    // Build step by step: later pieces hidden, this step's fasteners drawn, and the view exactly as it was afterwards
    const before=JSON.stringify([cam.r,cam.th,cam.ph,cam.target.toArray(),woodMode,[...sel],[...hiddenIds],explode]);
    startStepMode();
    const plan=buildPlan();
    if(!stepMode||$('#stepPanel').hidden)wrong('Build step by step did not start');
    else{
      // it opens on step 1 (the first assembly step: the parts are made from the Cut list page, js/shoppacket.js);
      // a step before the first one with pieces shows the whole design
      if(stepMode.index!==0)wrong('Build step by step does not open on step 1');
      if(!plan.steps[0].pieces.length&&hiddenIds.size)wrong('Build step by step hides pieces on a step before the building starts, where the whole design is to be seen');
      if(!$('#stepBody .shop-first-line'))wrong('Build step by step, step 1, does not say that the parts are made first');
      const index=plan.steps.findIndex(step=>step.pieces.length);
      showBuildStep(index);
      const later=S.parts.filter(p=>plan.stepOfPiece.get(p.id)>index);
      // with a piece selected the arrow keys still change the step, and the piece stays where it is
      const held=S.parts.find(p=>!hiddenIds.has(p.id)),heldAt=held.pos.slice();
      sel=new Set([held.id]);
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
      if(stepMode.index!==index+1||held.pos.some((v,k)=>v!==heldAt[k]))wrong('with a piece selected, the right arrow key did not go to the next step (or it moved the piece)');
      sel=new Set();
      showBuildStep(index);
      // a click on a fastener of the step shows its line
      const lined=plan.steps.findIndex(step=>step.groups.some(group=>group.sample));
      if(lined>=0){
        showBuildStep(lined);
        showStepLine(plan.steps[lined].groups[0].no);
        if(!$('#stepBody .stp-pick')||!$('#stepBody li.on'))wrong('a clicked fastener does not show its "Fasten with" line in the panel');
        showBuildStep(index);
      }
      if(!later.length||!later.every(p=>hiddenIds.has(p.id)))wrong('Build step by step does not hide the pieces of later steps');
      if(!/You need/.test($('#stepBody').textContent))wrong('the panel of Build step by step shows no "You need" line');
      showBuildStep(index+1);
      if(stepMode.index!==index+1||!stepGroup.children.length||!/Fasten with/.test($('#stepBody').textContent))wrong('Next did not show the next step with its fasteners');
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
      if(stepMode.index!==index)wrong('the left arrow key did not go back a step');
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      if(stepMode)wrong('Esc did not leave Build step by step');
    }
    endStepMode();
    if(JSON.stringify([cam.r,cam.th,cam.ph,cam.target.toArray(),woodMode,[...sel],[...hiddenIds],explode])!==before)wrong('leaving Build step by step did not put the view back as it was');
  }finally{
    endStepMode();
    setTab(tabKept);
  }
});
