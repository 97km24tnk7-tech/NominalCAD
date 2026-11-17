/* NominalCAD phone page: the ways of looking at the design in the 3D tab (the owner, after trying the phone page:
   "it's hard to do different views, need a fasteners mode, translucent mode and so on").

   A "View" button over the 3D view opens a sheet from the bottom. Every switch in it is the DESKTOP's own command
   (COMMANDS in js/menus.js, ticked by CHECKS), so the picture is the desktop's picture:
     - the wood: Solid, See-through, Fasteners only (setWoodMode, js/viewmodes.js)
     - Fasteners and Sizes on or off (the two switches of the desktop's status bar, #showFast and #showDims)
     - the look: Realistic wood or Color blocks, with the desktop's color key over the top of the view (#legend)
     - Exploded view, Open all doors and drawers, Close all (js/motion.js)
     - the standard views: Front, Back, Left, Right, Top, Corner (fit() of js/view3d.js; Back and Left are Front
       and Right seen from the other side)
     - Build step by step (js/stepmode.js): a bar over the view with Back, Next, the step's number and first
       sentence, and Leave.
   A double tap on a door, lid or drawer opens or closes it (openByDoubleClick, js/motion.js), as a double-click
   does on the desktop. "Show me" of the words list (js/glossary.js) shows its pieces here, and a tap ends it.
   The line at the top of the view says what is on; the View button is marked while anything is. All of it stays
   when another tab is opened and the 3D tab again (the steps go on at the step they were at), and "Reset view"
   puts everything back the way the view started.
   js/phone.js calls phoneViewMount / phoneViewUnmount, phoneViewTapped, phoneViewLeaving / phoneViewShown and
   phoneViewReset. */
'use strict';

/* ---------- the tables ---------- */

/* The rows of the sheet. Each choice names the desktop's command (COMMANDS) and how it is ticked (CHECKS). */
const PHONE_VIEW_ROWS=[
  {title:'Wood',choices:[
    {cmd:'woodSolid',label:'Solid'},
    {cmd:'woodThrough',label:'See-through'},
    {cmd:'woodFast',label:'Fasteners only'},
  ]},
  {title:'Show',choices:[
    {cmd:'toggleFasteners',label:'Fasteners',toggle:true},
    {cmd:'toggleSizes',label:'Sizes',toggle:true},
  ]},
  {title:'Look',choices:[
    {cmd:'viewReal',label:'Realistic wood'},
    {cmd:'viewBlock',label:'Color blocks'},
  ],legend:true},
  {title:'Pieces',choices:[
    {cmd:'explode',label:'Exploded view',toggle:true},
  ]},
  {title:'Doors and drawers',choices:[
    {cmd:'openAll',label:'Open all'},
    {cmd:'closeAll',label:'Close all'},
  ],when:()=>movers().length>0},
];
/* The standard views: the desktop's fit(direction), then a half turn for the two sides it has no button for. */
const PHONE_STANDARD_VIEWS=[
  {id:'front',label:'Front',said:'the front',fit:'front',turn:0},
  {id:'back',label:'Back',said:'the back',fit:'front',turn:Math.PI},
  {id:'left',label:'Left',said:'the left',fit:'side',turn:Math.PI},
  {id:'right',label:'Right',said:'the right',fit:'side',turn:0},
  {id:'top',label:'Top',said:'above',fit:'top',turn:0},
  {id:'corner',label:'Corner',said:'a corner',fit:'fit',turn:0},
];
/* the choices after which the model is kept in sight (phoneKeepInFree, js/phone.js): the pieces pulled apart, and
   the color key coming over the top of the view */
const PHONE_VIEW_REFRAME=['explode','viewBlock'];
/* two taps this close in time (ms) and place (px) are a double tap */
const PHONE_DOUBLE_TAP={within:350,near:24};
/* the line at the top of the view when nothing special is on */
const PHONE_VIEW_HINT='One finger turns it. Two fingers zoom and slide.';

/* what this file is doing now */
const phoneView={
  sheet:null,        // the sheet, while the shell is mounted
  lastTap:null,      // {at, x, y}: the tap before, for a double tap
  resumeStep:null,   // the step Build step by step was at when another tab was opened
  spotHeld:null,     // "Show me" pieces kept while a finger is down on the view (see phoneViewWatchSpotlight)
};

/* ---------- mounting ---------- */

/* Adds the View button, the step bar, the state line and the sheet to the shell, and moves the desktop's color key
   into the sheet (phone.moved, so phoneUnmount puts it back). */
function phoneViewMount(root){
  const view=root.querySelector('.ph-view');
  const button=document.createElement('button');
  button.type='button';
  button.className='ph-viewbtn';
  button.dataset.phView='open';
  button.textContent='View';
  view.appendChild(button);
  const bar=document.createElement('div');
  bar.className='ph-stepbar';
  bar.hidden=true;
  bar.innerHTML=`<div class="ph-step-words"><b class="ph-step-count"></b><span class="ph-step-title"></span></div>
    <div class="ph-step-btns"><button type="button" class="btn" data-ph-view="step-back">Back</button>
    <button type="button" class="btn" data-ph-view="step-read">Read it</button>
    <button type="button" class="btn" data-ph-view="step-leave">Leave</button>
    <button type="button" class="btn pri" data-ph-view="step-next">Next</button></div>`;
  view.appendChild(bar);
  const sheet=document.createElement('div');
  sheet.className='ph-viewsheet';
  sheet.hidden=true;
  sheet.innerHTML=`<div class="ph-pad-shade" data-ph-view="close"></div>
    <div class="ph-viewsheet-body" role="dialog" aria-modal="true" aria-label="View">
      <div class="ph-viewsheet-head"><b>View</b><button type="button" class="btn pri" data-ph-view="close">Done</button></div>
      <div class="ph-viewsheet-rows"></div>
    </div>`;
  root.appendChild(sheet);
  phoneView.sheet=sheet;
  phoneView.lastTap=null;
  phoneView.resumeStep=null;
  phoneView.spotHeld=null;
  phoneView.look=null;
  // (the desktop's color key stays where the desktop has it, in the 3D view: css/phone.css sets it over the top of
  // the view, so the key and the model are seen together)
  root.addEventListener('click',phoneViewClick);
  phoneViewDrawState();
}
/* Before the shell is taken down: Build step by step and Show me end, as when the desktop leaves its 3D view. */
function phoneViewUnmount(){
  if(typeof stepMode!=='undefined'&&stepMode)endStepMode();
  if(typeof endSpotlight==='function')endSpotlight();
  if(typeof hideViewTip==='function')hideViewTip();
  if(phone.root){
    phone.root.removeEventListener('click',phoneViewClick);
    const view=phone.root.querySelector('.ph-view');
    if(view)view.style.removeProperty('--ph-key-top');
  }
  phoneView.sheet=null;
  phoneView.resumeStep=null;
  phoneView.spotHeld=null;
}

/* ---------- the sheet ---------- */

function phoneViewOpen(){
  if(!phoneView.sheet)return;
  phoneViewDrawSheet();
  phoneView.sheet.hidden=false;
}
function phoneViewClose(){
  if(phoneView.sheet)phoneView.sheet.hidden=true;
  phoneViewDrawState();
}
/* the rows of the sheet, each choice ticked as the desktop's menus tick it */
function phoneViewDrawSheet(){
  const rows=phoneView.sheet.querySelector('.ph-viewsheet-rows');
  const choice=item=>{
    const on=!!(CHECKS[item.cmd]&&CHECKS[item.cmd]());
    const usable=!ENABLED[item.cmd]||ENABLED[item.cmd]();
    return`<button type="button" class="ph-vchoice${on?' on':''}" data-ph-cmd="${item.cmd}" aria-pressed="${on}"${usable?'':' disabled'}>${esc(item.label)}${item.toggle?`<small>${on?'on':'off'}</small>`:''}</button>`;
  };
  const html=PHONE_VIEW_ROWS.filter(row=>!row.when||row.when()).map(row=>
    `<div class="ph-vrow"><div class="ph-vrow-h">${esc(row.title)}</div><div class="ph-vchoices">${row.choices.map(choice).join('')}</div></div>`).join('');
  const looks=PHONE_STANDARD_VIEWS.map(look=>`<button type="button" class="ph-vchoice" data-ph-look="${look.id}">${esc(look.label)}</button>`).join('');
  const steps=S.parts.length?`<div class="ph-vrow"><div class="ph-vrow-h">How it goes together</div><div class="ph-vchoices"><button type="button" class="ph-vchoice${stepMode?' on':''}" data-ph-view="steps" aria-pressed="${!!stepMode}">Build step by step</button></div></div>`:'';
  rows.innerHTML=html+`<div class="ph-vrow"><div class="ph-vrow-h">Look from</div><div class="ph-vchoices ph-vlooks">${looks}</div></div>`+steps+
    `<div class="ph-vrow"><button type="button" class="btn ph-vreset" data-ph-view="reset">Reset view</button></div>`;
}
function phoneViewClick(event){
  const target=event.target.closest('[data-ph-cmd],[data-ph-look],[data-ph-view]');
  if(!target||!phone.root.contains(target))return;
  if(target.dataset.phCmd){
    const name=target.dataset.phCmd,command=COMMANDS[name];
    const spread=1+(explode||0);
    if(typeof command==='function')command();
    // the desktop's message for the choice would cover the sheet's buttons; with the sheet open the ticked button
    // already says what is on, so the message is not shown
    const message=$('#toast');
    if(message)message.classList.remove('on');
    // the exploded view pushes every piece out from the middle (js/view3d.js setMeshPos): the camera steps back by
    // as much, so the pieces stay on the narrow screen, and comes in again when they go back together
    if(name==='explode'){cam.r=Math.min(PHONE_VIEW.far,cam.r*(1+(explode||0))/spread);updateCam();}
    phoneViewDrawSheet();
    phoneViewDrawState();
    // the pieces pulled apart, or the color key now over the top of the view: still all of the model in sight
    if(PHONE_VIEW_REFRAME.includes(name))phoneKeepInFree();
    return;
  }
  if(target.dataset.phLook){
    phoneViewLookFrom(target.dataset.phLook);
    phoneViewClose();
    return;
  }
  const word=target.dataset.phView;
  if(word==='open')phoneViewOpen();
  else if(word==='close')phoneViewClose();
  else if(word==='reset'){phoneViewClose();phoneViewReset();phoneFitView();}
  else if(word==='steps'){
    phoneViewClose();
    if(stepMode)endStepMode();
    else{
      startStepMode();
      phoneViewDrawState();   // (the step bar shows, and the view under it gets its size: then it is framed)
      resize();
      phoneViewFrame();
    }
    phoneViewDrawState();
  }
  else if(word==='step-back'&&stepMode){showBuildStep(stepMode.index-1);phoneViewDrawState();}
  else if(word==='step-next'&&stepMode){showBuildStep(stepMode.index+1);phoneViewDrawState();}
  else if(word==='step-leave'&&stepMode){
    // the desktop puts back the camera it had before the steps, which was framed for the shorter view under the
    // step bar and for the pieces together; the exploded view and the full height come back, so it is framed again
    endStepMode();
    phoneViewDrawState();
    resize();
    phoneKeepInFree();
  }
  else if(word==='step-read'&&stepMode){
    // the words of this step on the Steps tab; the 3D tab comes back at the same step
    const no=buildPlan().steps[stepMode.index].no;
    phoneShowSection('steps');
    const step=$(`#instrPage .doc>.step[data-step="${no}"]`);
    if(step)step.scrollIntoView({block:'start'});
  }
}
/* one of the standard views, framed for the phone's screen as Reset view frames it (phoneFitView, js/phone.js) */
function phoneViewLookFrom(id){
  const look=PHONE_STANDARD_VIEWS.find(row=>row.id===id);
  if(!look)return;
  // (the line over the view names the direction; it is drawn first, as its height is part of the framing)
  phoneView.look=look;
  phoneViewDrawState();
  phoneFitView(look.fit);
  if(look.turn){cam.th+=look.turn;updateCam();phoneKeepInFree();}
}
/* a finger has turned the view (js/phone.js phoneTurn): it no longer looks from the standard direction named */
function phoneViewTurned(){
  if(!phoneView.look)return;
  phoneView.look=null;
  phoneViewDrawState();
}
/* Build step by step on the desktop keeps the camera where it was; on the phone the design is framed for the
   upright screen first, so the steps are seen whole */
function phoneViewFrame(){
  const keep=stepMode&&stepMode.keep;
  phoneFitView('fit');
  if(keep)keep.cam={...cam,target:cam.target.clone()};
}

/* ---------- what is on: the line over the view, the mark on the button, the step bar ---------- */

/* the views that are not the way the 3D tab starts, in a few words each: what is shown, and what is hidden */
function phoneViewStates(){
  const shown=[],hidden=[];
  if(woodMode!=='solid')shown.push(WOOD_MODES[woodMode].name.toLowerCase());
  if(viewMode==='block')shown.push('color blocks');
  if(explode)shown.push('exploded');
  if(movers().some(mover=>mover.open>0))shown.push('doors or drawers open');
  if(spotlightIds)shown.push(`${spotlightWord||'pieces'} in blue, tap to end`);
  if(!$('#showFast').checked)hidden.push('fasteners');
  if(!$('#showDims').checked)hidden.push('sizes');
  return{shown,hidden};
}
/* all of them, one entry each (the View button counts them) */
function phoneViewOnWords(){
  const states=phoneViewStates();
  return states.shown.concat(states.hidden.map(word=>word+' hidden'));
}
/* the line over the view, e.g. "See-through, exploded. Hidden: sizes. Seen from the back." */
function phoneViewLine(){
  const{shown,hidden}=phoneViewStates(),sentences=[];
  const capital=text=>text.charAt(0).toUpperCase()+text.slice(1);
  if(shown.length)sentences.push(capital(shown.join(', '))+'.');
  if(hidden.length)sentences.push('Hidden: '+hidden.join(', ')+'.');
  if(phoneView.look&&!stepMode)sentences.push(`Seen from ${phoneView.look.said}.`);
  return sentences.join(' ');
}
function phoneViewDrawState(){
  if(!phone.root)return;
  const words=phoneViewOnWords(),hint=phone.root.querySelector('.ph-hint'),button=phone.root.querySelector('.ph-viewbtn');
  const line=phoneViewLine();
  if(hint)hint.textContent=line||PHONE_VIEW_HINT;
  // the color key (#legend, the desktop's own) sits just under that line
  const view=phone.root.querySelector('.ph-view');
  if(view&&hint)view.style.setProperty('--ph-key-top',(stepMode?8:hint.offsetTop+hint.offsetHeight+6)+'px');
  if(button){
    button.classList.toggle('on',words.length>0||!!stepMode);
    button.textContent=words.length?`View (${words.length} on)`:'View';
  }
  const bar=phone.root.querySelector('.ph-stepbar');
  if(!bar)return;
  bar.hidden=!stepMode;
  phone.root.querySelector('.ph-view').classList.toggle('ph-stepping',!!stepMode);
  if(!stepMode)return;
  const steps=buildPlan().steps,step=steps[stepMode.index];
  bar.querySelector('.ph-step-count').textContent=`Step ${step.no} of ${steps.length}`;
  bar.querySelector('.ph-step-title').textContent=phoneStepTitle(step);
  bar.querySelector('[data-ph-view="step-back"]').disabled=stepMode.index===0;
  bar.querySelector('[data-ph-view="step-next"]').disabled=stepMode.index===steps.length-1;
  // the 3D view starts under the bar (css/phone.css), so the bar covers none of the model
  phone.root.querySelector('.ph-view').style.setProperty('--ph-bar-h',bar.offsetHeight+'px');
}
/* the first sentence of a step's own words, as the list at the top of the Steps tab shows it */
function phoneStepTitle(step){
  const text=String(step.words||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
  return(text.match(/^.*?\.(?=\s+[A-Z]|$)/)||[text])[0];
}

/* ---------- the hooks js/phone.js calls ---------- */

/* a tap (no move) on the 3D view: it ends Show me, as a click does on the desktop; a second tap close by is a double
   tap, which opens or closes the door, lid or drawer under it */
function phoneViewTapped(x,y){
  const now=Date.now(),last=phoneView.lastTap;
  const double=last&&now-last.at<=PHONE_DOUBLE_TAP.within&&Math.hypot(x-last.x,y-last.y)<=PHONE_DOUBLE_TAP.near;
  phoneView.lastTap=double?null:{at:now,x,y};
  if(spotlightIds){endSpotlight();phoneViewDrawState();return;}
  if(double){hideViewTip();phoneViewDoubleTap(x,y);return;}
  phoneViewTip(x,y);
}
/* A tap on a fastener (or a piece of hardware, or a fastener of the step) shows the desktop's own tip for it, the
   words its pointer shows beside it (js/viewpick.js): what it is and which pieces it joins. Nothing is picked or
   selected. The desktop's "Click ..." and "Drag ..." sentences of a tip are left out, as a tap does not do them. */
function phoneViewTip(x,y){
  hideViewTip();
  if(explode||typeof thingUnderPointer!=='function')return;
  scene.updateMatrixWorld();
  const finger={clientX:x,clientY:y};
  const thing=thingUnderPointer(finger,false);
  const words=thing&&thing.tip?String(thing.tip).replace(/\s*(Click|Drag|Double-click)\b[^.]*\./g,'').trim():'';
  if(words)showViewTip(finger,words);
}
/* the desktop's double-click on a piece (js/motion.js): only a piece on hinges or slides moves, never in the
   exploded view; the phone selects nothing, so the selection the desktop makes is dropped again */
function phoneViewDoubleTap(x,y){
  if(explode)return false;
  scene.updateMatrixWorld();
  const hit=pick({clientX:x,clientY:y});
  const id=hit?hit.object.userData.id:null;
  if(id==null||!moverOf(id))return false;
  openByDoubleClick(id);
  sel=new Set();
  picked=null;
  renderAll();
  phoneViewDrawState();
  return true;
}
/* the 3D tab is left for another: Build step by step remembers its step (the desktop ends it with its 3D view) */
function phoneViewLeaving(){
  phoneView.resumeStep=stepMode?stepMode.index:null;
  if(phoneView.sheet)phoneView.sheet.hidden=true;
}
/* the 3D tab shows again: the steps go on where they were */
function phoneViewShown(){
  if(phoneView.resumeStep!=null&&S.parts.length&&!stepMode){
    const index=phoneView.resumeStep;
    startStepMode();
    showBuildStep(index);
    phoneView.resumeStep=null;
    phoneViewDrawState();
    resize();   // (the 3D view is under the step bar again)
    return;
  }
  phoneView.resumeStep=null;
  phoneViewDrawState();
}
/* Reset view: everything back the way the 3D tab starts (js/phone.js then frames the design) */
function phoneViewReset(){
  phoneView.resumeStep=null;
  phoneView.look=null;
  hideViewTip();
  if(stepMode)endStepMode();
  endSpotlight();
  if(woodMode!=='solid')setWoodMode('solid');
  if(!$('#showFast').checked)COMMANDS.toggleFasteners();
  if(!$('#showDims').checked)COMMANDS.toggleSizes();
  if(viewMode!=='real')COMMANDS.viewReal();
  if(explode)COMMANDS.explode();
  if(movers().some(mover=>mover.open>0))COMMANDS.closeAll();
  phoneViewDrawState();
}

/* "Show me" (js/visibility.js) ends at a press anywhere but the desktop's canvas, and on the phone a finger lands
   on the touch layer over it, so turning the view would end it. The touch layer stands for the canvas: for a press
   on it the pieces are held aside just before the desktop's listener (this one runs first, on the window) and put
   back by the touch layer itself (phoneViewPressed); a tap then ends it (phoneViewTapped), as on the desktop. */
window.addEventListener('pointerdown',event=>{
  if(!phone.root||typeof spotlightIds==='undefined'||!spotlightIds)return;
  if(!(event.target.closest&&event.target.closest('#phone .ph-touch')))return;
  phoneView.spotHeld={ids:spotlightIds,word:spotlightWord};
  spotlightIds=null;
},true);
function phoneViewPressed(){
  hideViewTip();   // (a fastener's tip goes at the next touch)
  if(!phoneView.spotHeld)return;
  spotlightIds=phoneView.spotHeld.ids;
  spotlightWord=phoneView.spotHeld.word;
  phoneView.spotHeld=null;
}

/* ---------- self-check (selfTest runs every function in SELFTESTS, at the desktop window) ---------- */

/* 12. Every switch of the View sheet changes the 3D view exactly as the desktop's own command, Reset view puts all
   of it back, the steps go on after another tab, and a double tap opens a drawer and selects nothing. */
SELFTESTS.push(function phoneViewIsTheDesktops(problems){
  const wrong=text=>problems.push('phone view: '+text);
  const fastKept=$('#showFast').checked,dimsKept=$('#showDims').checked,viewKept=viewMode,woodKept=woodMode;
  phoneCheckAround(root=>{
    if(!phoneBuildThrough('Nightstand with drawers'))return wrong('the Nightstand was not built through the phone');
    phoneShowSection('3d');
    const tap=selector=>{const node=root.querySelector(selector);if(!node){wrong(`no ${selector}`);return false;}node.click();return true;};
    tap('.ph-viewbtn');
    if(phoneView.sheet.hidden)wrong('the View button did not open the sheet');
    // each choice is the desktop's command and is ticked as the desktop ticks it
    for(const row of PHONE_VIEW_ROWS){
      for(const item of row.choices){
        if(!root.querySelector(`[data-ph-cmd="${item.cmd}"]`)){wrong(`the sheet has no ${item.label}`);continue;}
        if(item.cmd==='closeAll')continue;
        tap(`[data-ph-cmd="${item.cmd}"]`);
        if(!$('#legend'))return wrong(`after ${item.label} the desktop's color key is gone`);
        if(!CHECKS[item.cmd])continue;   // (Open all is a command, not a switch)
        const button=root.querySelector(`[data-ph-cmd="${item.cmd}"]`);
        const on=!!CHECKS[item.cmd]();
        if(button.classList.contains('on')!==on)wrong(`${item.label} is ${on?'on':'off'} and the sheet shows it ${on?'off':'on'}`);
      }
    }
    tap('[data-ph-cmd="woodThrough"]');
    if(woodMode!=='through')wrong('See-through did not set the desktop\'s see-through view');
    if(!/See-through/.test(root.querySelector('.ph-hint').textContent))wrong('the line over the view does not say See-through is on');
    if(!root.querySelector('.ph-viewbtn').classList.contains('on'))wrong('the View button is not marked while See-through is on');
    // the standard views are the desktop's fit()
    for(const look of PHONE_STANDARD_VIEWS){
      tap('.ph-viewbtn');
      tap(`[data-ph-look="${look.id}"]`);
      const th=cam.th;
      fit(look.fit);
      const expected=cam.th+look.turn;
      if(Math.abs(Math.cos(th)-Math.cos(expected))>1e-6||Math.abs(Math.sin(th)-Math.sin(expected))>1e-6)wrong(`${look.label} does not look from the ${look.label.toLowerCase()}`);
    }
    // the state stays when another tab is opened, and the steps go on at their step
    tap('.ph-viewbtn');
    tap('[data-ph-view="steps"]');
    if(!stepMode)wrong('Build step by step did not start');
    else{
      tap('[data-ph-view="step-next"]');
      tap('[data-ph-view="step-next"]');
      const at=stepMode.index;
      if(root.querySelector('.ph-step-count').textContent!==`Step ${buildPlan().steps[at].no} of ${buildPlan().steps.length}`)wrong('the step bar does not say which step shows');
      phoneShowSection('cut');
      phoneShowSection('3d');
      if(!stepMode||stepMode.index!==at)wrong('after the Cut list tab the steps did not go on at the same step');
      tap('[data-ph-view="step-leave"]');
      if(stepMode)wrong('Leave did not end Build step by step');
      // (the desktop's steps are drawn solid; the see-through view comes back when they end)
      if(woodMode!=='through')wrong('after the steps and the Cut list tab the see-through view was gone');
    }
    // a double tap on a drawer front opens it, and nothing is selected
    const front=S.parts.find(part=>moverOf(part.id)&&/front/i.test(part.name));
    if(!front)wrong('the Nightstand has no drawer front to open');
    else{
      phoneViewReset();
      phoneFitView('front');
      const box3=new THREE.Box3().setFromObject(meshes.get(front.id));
      const middle=box3.getCenter(new THREE.Vector3()).project(camera),frame=$('#cv').getBoundingClientRect();
      const x=frame.left+(middle.x+1)/2*frame.width,y=frame.top+(1-middle.y)/2*frame.height;
      phoneView.lastTap=null;
      phoneViewTapped(x,y);
      phoneViewTapped(x,y);
      if(!(moverOf(front.id).open>0))wrong('a double tap on a drawer front did not pull the drawer out');
      if(sel.size)wrong('a double tap selected a piece');
    }
    // "Show me" of the words list opens the 3D tab with its pieces; turning keeps them, a tap ends it
    phoneShowSection('steps');
    const showMe=$('#instrPage [data-show-term]');
    if(!showMe)wrong('the Steps tab has no Show me');
    else{
      showMe.click();
      if(phone.section!=='3d'||!spotlightIds)wrong('Show me did not show its pieces in the 3D tab');
      const layer=root.querySelector('.ph-touch'),frame=layer.getBoundingClientRect();
      const finger=(type,x)=>layer.dispatchEvent(new PointerEvent(type,{pointerId:9,isPrimary:true,clientX:frame.left+x,clientY:frame.top+frame.height/2,bubbles:true,pointerType:'touch'}));
      finger('pointerdown',100);finger('pointermove',140);finger('pointermove',180);finger('pointerup',180);
      if(!spotlightIds)wrong('turning the view ended Show me');
      phoneView.lastTap=null;
      finger('pointerdown',100);finger('pointerup',100);
      if(spotlightIds)wrong('a tap on the view did not end Show me');
    }
    // Reset view puts everything back
    tap('.ph-viewbtn');
    tap('[data-ph-cmd="woodFast"]');
    tap('[data-ph-cmd="toggleSizes"]');
    tap('[data-ph-cmd="viewBlock"]');
    tap('[data-ph-view="close"]');
    tap('.ph-reset');
    const left=phoneViewOnWords();
    if(left.length||stepMode)wrong(`Reset view left ${left.join(', ')||'Build step by step'} on`);
    if(root.querySelector('.ph-viewbtn').classList.contains('on'))wrong('the View button is still marked after Reset view');
  });
  // the desktop's own switches as they were before the check
  $('#showFast').checked=fastKept;$('#showDims').checked=dimsKept;
  if(viewMode!==viewKept)setViewMode(viewKept);
  if(woodMode!==woodKept)setWoodMode(woodKept);
  rebuildScene();
  if($('#toast'))$('#toast').classList.remove('on');
});
