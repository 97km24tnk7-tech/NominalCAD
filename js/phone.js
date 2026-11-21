/* NominalCAD phone page: a second front end over the same program (design/specs/13-phone-page.md). js/phonerule.js
   decides at the top of <body> whether this device gets it. phoneMount builds one shell, #phone (top bar, body, bottom
   bar, size pad), and MOVES the program's own nodes into it (#presetForm, #presetFoot, #cvWrap, #cutPage, #instrPage),
   so the same code draws them; phoneUnmount puts each one back. Screens: Pick (the catalog), Sizes (the moved form,
   - / + and the size pad), Result (3D turned by a finger; Shopping, Cut list and Steps laid out by js/phonepages.js). */
'use strict';

/* ---------- the tables ---------- */

/* The four tabs of the Result screen. tab: the program's own tab (setTab, js/app.js) that draws what it shows.
   shown: the function js/phonepages.js gives for that section; phone.js calls it, when it exists, each time the
   section is shown, with the section's id and the node that holds the pages. */
const PHONE_SECTIONS=[
  {id:'3d',label:'3D',icon:'i-fit',tab:'design'},
  {id:'shop',label:'Shopping',icon:'i-price',tab:'cut',shown:'phoneShoppingShown'},
  {id:'cut',label:'Cut list',icon:'i-list',tab:'cut',shown:'phoneCutListShown'},
  {id:'steps',label:'Steps',icon:'i-steps',tab:'instr',shown:'phoneStepsShown'},
];
/* How a finger turns the 3D view: the desktop's own numbers (js/tools.js, the orbit and pan of a mouse drag and the
   wheel), so the same drag turns the model the same amount on both. */
const PHONE_VIEW={
  turn:.008,          // radians per pixel of drag (tools.js: cam.th += dx*.008)
  lowest:.001,        // how far over the top the view may go (cam.ph is kept between these two)
  below:.25,          // and how far under the floor line (Math.PI/2 + .25)
  slide:.0016,        // a pan moves cam.r * .0016 per pixel
  near:8,far:2500,    // the closest and the farthest the camera may be (the wheel's limits)
  wheel:.001,         // the wheel zooms by exp(deltaY * .001)
  deadZone:4,         // pixels a finger may wander before a press becomes a turn (tools.js: drag.moved)
  uprightBack:2,      // Reset view on an upright screen steps back at most this many times Fit view's distance
  margin:8,           // pixels kept clear between the framed model and the buttons, lines and edges around it
};
const PHONE_REPEAT={after:450,every:120};   // holding - or + still steps: the first step after 450 ms, then every 120 ms
const PHONE_STEP_SLOP=10;                   // pixels a finger on - or + may move before the press is a scroll, not a hold
const PHONE_SAVE_AFTER=500;                 // the page state is handed to phoneSaveState this long after typing stops
/* The places the phone's own Back button steps back through (one entry of the browser's history each), in the order
   a person goes forward: a higher number is further in. The pad and a large picture count, so Back closes them. */
const PHONE_RANK={pick:0,sizes:1,pad:1.5,result:2,picture:3};
/* the line over "Build it" (the phone skips the desktop's "Replace the design on screen?" question, so it says so here) */
const PHONE_REPLACE_LINE='Building this replaces the design you made before.';
const PHONE_STOP_LINE='These sizes cannot be built. Tap Build it to see why.';
const PHONE_STOP_ROW_LINE='This cannot be built with these sizes. The red box at the end of the form says why.';
/* the desktop's advice when the browser will not store the design names its File menu; the phone page has none */
const PHONE_KEEP_ADVICE='The design stays only while this page is open. In a private window, open the link in a normal window instead to keep your designs.';
/* The desktop's short messages that name a key or a click, in words for a phone (the View sheet of the 3D tab,
   js/phoneview.js, and Show me). Only on the phone page; the desktop's own words are not changed. */
const PHONE_TOAST_WORDS=[
  [/ Shift\+[SF] goes back\./,' View, then Solid, goes back.'],
  [' Alt+O closes them again.',' Close all, under View, closes them again.'],
  ['Click anywhere to go back to normal.','Tap the picture to go back to normal.'],
];
/* the closing words of a large picture on a phone (the desktop's say Click and Esc) */
const PHONE_PICTURE_CLOSE='Slide to see all of it. Tap anywhere to close.';
/* the fractions of the size pad: eighths (and "None", which takes the fraction off) or the odd sixteenths */
const PHONE_EIGHTHS=['1/8','1/4','3/8','1/2','5/8','3/4','7/8',''];
const PHONE_SIXTEENTHS=['1/16','3/16','5/16','7/16','9/16','11/16','13/16','15/16'];

/* What the shell is doing now. One object, so phoneUnmount can see everything it has to undo. */
const phone={
  root:null,          // #phone, while it is mounted
  holder:null,        // where it was mounted (document.body on a phone, a fixed box in the self-checks)
  moved:[],           // {node, parent, next}: every node moved into the shell, in the order moved
  screen:'pick',      // 'pick' | 'sizes' | 'result'
  section:'3d',       // the open tab of the Result screen
  scrolls:{},         // screen or section -> scrollTop of the body, so each keeps its place
  observer:null,      // watches #presetForm: a form drawn again gets its -/+ buttons again
  saveTimer:0,
  badTimer:0,
  pad:null,           // the size pad while it is open: {box, q, old, feet, inches, frac, sixteenths}
  repeat:null,        // the - or + being pressed: {button, pointerId, x, y, timer, stepped}
  heldStepped:null,   // the - or + whose hold stepped: the click that ends that hold adds no step of its own
  builtEntry:'',      // the catalog entry the design on screen was built from on this page ("‹ Sizes" opens it)
  popping:false,      // true while a Back of the phone is being shown (the history is not written then)
  pictureOpen:false,  // a large picture (#picZoom) is open
  historyGoing:false, // the page has stepped the history back and its popstate has not come yet
  historyWant:null,   // the place shown meanwhile, written to the history when it comes
  historyTimer:0,
  touchReset:null,    // forgets the fingers on the 3D view (the page was hidden while a finger was down)
  listeners:[],       // [target, type, handler]: what phoneMount listens to outside the shell, taken off by phoneUnmount
};

/* ---------- mounting ---------- */

/* Builds the shell inside holder and moves the program's nodes into it. Without the html.phone-page class (the
   self-checks) the desktop around it is left alone. Returns the shell. */
function phoneMount(holder){
  if(phone.root)phoneUnmount();
  holder=holder||document.body;
  const root=document.createElement('div');
  root.id='phone';
  root.innerHTML=phoneShellHtml();
  holder.appendChild(root);
  phone.root=root;
  phone.holder=holder;
  phone.moved=[];
  phone.scrolls={};
  phone.screen='pick';
  phone.section='3d';
  phone.builtEntry='';
  phone.pictureOpen=false;
  // the program's own nodes, each into its place in the shell
  phoneMove($('#presetForm'),root.querySelector('.ph-form-slot'));
  phoneMove($('#presetFoot'),root.querySelector('.ph-form-slot'));
  phoneMove($('#cvWrap'),root.querySelector('.ph-view'),root.querySelector('.ph-touch'));
  phoneMove($('#cutPage'),root.querySelector('.ph-docs'));
  phoneMove($('#instrPage'),root.querySelector('.ph-docs'));
  // a form drawn again (another design picked, Reset sizes) gets its controls again
  phone.observer=new MutationObserver(()=>phoneDecorateForm());
  phone.observer.observe($('#presetForm'),{childList:true});
  phoneDecorateForm();
  root.addEventListener('click',phoneClick);
  root.addEventListener('input',phoneTyped);
  root.addEventListener('change',phoneTyped);
  phoneTouchLayer(root.querySelector('.ph-touch'));
  phoneWirePad(root.querySelector('.ph-pad'));
  phoneWireSteppers(root);
  if(typeof window.phoneViewMount==='function')window.phoneViewMount(root);   // the View sheet of the 3D tab (js/phoneview.js)
  // a call, the app switcher or the screen locking: a held - or + stops, the fingers on the 3D view are forgotten,
  // and the place is saved now; the phone's Back steps back through the screens
  phone.listeners=[
    [document,'visibilitychange',()=>{if(document.visibilityState==='hidden')phoneOnHidden();}],
    [window,'pagehide',phoneOnHidden],
    [window,'popstate',phoneBackPressed],
    [document,'click',phonePictureClick],
  ];
  for(const[target,type,handler]of phone.listeners)target.addEventListener(type,handler);
  phoneShow('pick');
  return root;
}
/* the page is being hidden: nothing may go on stepping or turning while nobody sees it */
function phoneOnHidden(){
  if(!phone.root)return;
  phoneStopRepeat(true);
  if(phone.touchReset)phone.touchReset();
  phoneSaveSoon(0);
}
/* Puts every moved node back at its old parent and place, takes away everything the shell added to them, and
   removes the shell. */
function phoneUnmount(){
  if(!phone.root)return;
  phoneStopRepeat(false);
  phoneClosePad(false);
  clearTimeout(phone.saveTimer);
  clearTimeout(phone.badTimer);
  clearTimeout(phone.historyTimer);
  phone.historyGoing=false;
  phone.historyWant=null;
  if(phone.observer)phone.observer.disconnect();
  phone.observer=null;
  for(const[target,type,handler]of phone.listeners)target.removeEventListener(type,handler);
  phone.listeners=[];
  phone.touchReset=null;
  if(typeof window.phoneViewUnmount==='function')window.phoneViewUnmount();   // steps and Show me end (js/phoneview.js)
  phoneUndecorateForm();
  if(typeof window.phonePagesUndo==='function')window.phonePagesUndo();   // the pages as renderCut drew them (js/phonepages.js)
  for(const record of phone.moved.slice().reverse()){
    const next=record.next&&record.next.parentNode===record.parent?record.next:null;
    record.parent.insertBefore(record.node,next);
  }
  phone.moved=[];
  phone.root.remove();
  phone.root=null;
  phone.holder=null;
  if(typeof resize==='function')resize();   // the 3D view is back in the desktop window
}
/* moves node into target (before `before`, or at the end), remembering where it came from */
function phoneMove(node,target,before){
  if(!node||!target)return;
  phone.moved.push({node,parent:node.parentNode,next:node.nextSibling});
  target.insertBefore(node,before||null);
}
function phoneShellHtml(){
  const tabs=PHONE_SECTIONS.map(section=>
    `<button type="button" class="ph-tab" data-ph-tab="${section.id}">${icon(section.icon,'m')}<span>${esc(section.label)}</span></button>`).join('');
  return`<header class="ph-bar"></header>
    <div class="ph-body">
      <section class="ph-scr" data-scr="pick">
        <div class="ph-find"><input class="fld" type="search" id="phFind" placeholder="Find a design" autocomplete="off" spellcheck="false" aria-label="Find a design"></div>
        <div class="ph-list"></div>
      </section>
      <section class="ph-scr" data-scr="sizes">
        <div class="ph-form-slot"></div>
      </section>
      <section class="ph-scr" data-scr="result">
        <div class="ph-view">
          <div class="ph-touch" aria-label="The design in 3D. One finger turns it, two fingers zoom and slide it."></div>
          <p class="ph-hint">One finger turns it. Two fingers zoom and slide.</p>
          <button type="button" class="ph-reset" data-ph="reset">Reset view</button>
        </div>
        <div class="ph-docs"></div>
      </section>
    </div>
    <footer class="ph-foot">
      <p class="ph-footline" hidden></p>
      <button type="button" class="ph-build" data-ph="build">Build it</button>
      <nav class="ph-tabs" aria-label="What to show">${tabs}</nav>
    </footer>
    <div class="ph-pad" hidden>${phonePadHtml()}</div>`;
}

/* ---------- screens ---------- */

/* Shows one screen: its top bar, its bottom bar and its body, at the scroll place it was left at. */
function phoneShow(screen){
  if(!phone.root)return;
  phoneKeepScroll();
  phone.screen=screen;
  const root=phone.root;
  root.dataset.screen=screen;
  root.dataset.section=phone.section;
  root.querySelectorAll('.ph-scr').forEach(node=>{node.hidden=node.dataset.scr!==screen;});
  phoneDrawBar();
  if(screen==='pick')phoneDrawPick();
  if(screen==='sizes')phoneSyncForm();
  else phoneFootLine();
  phoneRestoreScroll();
  phoneSaveSoon(0);
  phoneHistoryTo(screen);
}
/* the top bar of the screen showing: a way back on the left, the name, one link on the right */
function phoneDrawBar(){
  const bar=phone.root.querySelector('.ph-bar');
  const button=(action,text,extra)=>`<button type="button" class="ph-barbtn${extra||''}" data-ph="${action}">${esc(text)}</button>`;
  const title=text=>`<b class="ph-title">${esc(text)}</b>`;
  if(phone.screen==='pick')bar.innerHTML=title('NominalCAD')+button('full','Full program');
  else if(phone.screen==='sizes'){
    const entry=catalogEntry(catalogState.picked);
    bar.innerHTML=button('pick','‹ Designs',' ph-back')+title(entry?entry.name:(curPreset?presetTitle(curPreset):''));
  }else bar.innerHTML=button('sizes','‹ Sizes',' ph-back')+title(S.name||'')+button('new','New');
}
/* each Result tab keeps its own place, and so does the form of each design (a design opened from the list starts at
   the top of its form: phoneOpenSizes) */
function phoneScrollKey(){
  if(phone.screen==='result')return'result:'+phone.section;
  if(phone.screen==='sizes')return'sizes:'+(catalogState.picked||'');
  return phone.screen;
}
function phoneKeepScroll(){
  if(!phone.root||!phone.root.dataset.screen)return;
  phone.scrolls[phoneScrollKey()]=phone.root.querySelector('.ph-body').scrollTop;
}
function phoneRestoreScroll(){
  phone.root.querySelector('.ph-body').scrollTop=phone.scrolls[phoneScrollKey()]||0;
}

/* Every tap in the shell that is not a key of the pad or a - / + comes here, by its data-ph word. */
function phoneClick(event){
  const row=event.target.closest('[data-entry]');
  if(row&&phone.root.contains(row)){phoneOpenSizes(row.dataset.entry);return;}
  const tabButton=event.target.closest('[data-ph-tab]');
  if(tabButton){phoneShowSection(tabButton.dataset.phTab);return;}
  const lengthBox=event.target.closest('#presetForm input[data-len]');
  if(lengthBox&&lengthBox.readOnly){phoneOpenPad(lengthBox);return;}
  const checkRow=event.target.closest('#presetForm .frow.ph-ck');
  if(checkRow&&!event.target.closest('input,label,button,a')){phoneToggleRow(checkRow);return;}
  const action=event.target.closest('[data-ph]');
  if(!action)return;
  const word=action.dataset.ph;
  if(word==='full')phoneGoTo('full');
  else if(word==='pick')phoneShow('pick');
  else if(word==='new')phoneShow('pick');
  else if(word==='last')phoneOpenResult('3d');
  else if(word==='sizes')phoneBackToSizes();
  else if(word==='build')phoneBuild();
  else if(word==='reset'){
    // everything the View sheet changed goes back too (js/phoneview.js), then the design is framed
    if(typeof window.phoneViewReset==='function')window.phoneViewReset();
    phoneFitView();
  }
}
/* stores the choice of page on this device and opens it */
function phoneGoTo(choice){
  setPhoneChoice(choice);
  location.reload();
}

/* ---------- the phone's own Back button ----------
   Android's Back button and an iPhone's swipe in from the left edge go back through the browser's history. Each
   place a person goes forward to (Sizes, Result, the size pad, a large picture) is one entry of it, so Back goes one
   place back, as in any phone app. The address never changes. Each entry holds the places from the first one:
   {phTrail:['pick','sizes','result']}, so the page knows where Back leads even after a reload. The self-checks mount
   the shell in a box at the desktop: there the history is left alone. */
function phoneHistoryOn(){
  return!!(phone.root&&phone.holder===document.body&&window.PHONE_PAGE);
}
function phoneTrailNow(){
  const state=history.state;
  return state&&Array.isArray(state.phTrail)&&state.phTrail.length?state.phTrail.slice():null;
}
/* place now shows: going further in adds an entry; going back goes back through the entries that are there.
   Going back is history.go, which the browser does a moment later: until its popstate comes, the entry the page
   is on is not yet the one gone to, so a place shown meanwhile (a design picked at once) waits for it. */
function phoneHistoryTo(place){
  if(!phoneHistoryOn()||phone.popping)return;
  if(phone.historyGoing){phone.historyWant=place;return;}
  try{
    const trail=phoneTrailNow();
    if(!trail){history.replaceState({phTrail:[place]},'');return;}
    const last=trail[trail.length-1];
    if(last===place)return;
    if(PHONE_RANK[place]>PHONE_RANK[last]){
      trail.push(place);
      history.pushState({phTrail:trail},'');
      return;
    }
    const at=trail.lastIndexOf(place);
    if(at>=0){
      // (the screen shows already; the popstate that follows only says the browser got there)
      phone.historyGoing=true;
      phone.historyWant=null;
      clearTimeout(phone.historyTimer);
      phone.historyTimer=setTimeout(()=>{phone.historyGoing=false;},1000);   // (a browser that never says so)
      history.go(at-(trail.length-1));
      return;
    }
    trail[trail.length-1]=place;
    history.replaceState({phTrail:trail},'');
  }catch(e){}
}
/* After a reload: the entry of the history the page is on says where it is now (the entries behind it, from before
   the reload, still lead back through the screens). */
function phoneHistorySettle(){
  if(!phoneHistoryOn())return;
  try{
    const trail=phoneTrailNow()||[];
    if(trail[trail.length-1]===phone.screen)return;
    if(trail.length)trail[trail.length-1]=phone.screen;else trail.push(phone.screen);
    history.replaceState({phTrail:trail},'');
  }catch(e){}
}
/* the phone's Back (or Forward): show the place the entry names */
function phoneBackPressed(event){
  if(!phoneHistoryOn())return;
  if(phone.historyGoing){
    // the page's own step back has arrived: the screen shows already; a place shown meanwhile is written now
    phone.historyGoing=false;
    clearTimeout(phone.historyTimer);
    const want=phone.historyWant;
    phone.historyWant=null;
    if(want)phoneHistoryTo(want);
    return;
  }
  const trail=event.state&&Array.isArray(event.state.phTrail)?event.state.phTrail:['pick'];
  const place=trail[trail.length-1];
  const screen=place==='pad'?'sizes':place==='picture'?'result':place;
  phone.popping=true;
  try{
    if(place!=='picture'&&typeof phoneCloseLargePicture==='function')phoneCloseLargePicture();
    if(place!=='pad'&&phone.pad)phoneClosePad(true);   // Back on the pad is Cancel
    if(screen===phone.screen)return;
    if(screen==='sizes')phoneBackToSizes();
    else if(screen==='result'&&S.parts.length)phoneOpenResult(phone.section);
    else phoneShow('pick');
  }finally{phone.popping=false;}
}
/* A large picture (showPictureLarge, js/plans.js, which listens on the document and so runs before this): when one
   has just opened, its closing words are a phone's and it is one place of the history; when a tap has just closed
   it, that place is left. */
function phonePictureClick(event){
  const large=$('#picZoom');
  if(!phone.root||!large)return;
  const open=!large.hidden;
  if(open&&!phone.pictureOpen){
    phone.pictureOpen=true;
    const words=large.querySelector('.zclose');
    if(words)words.textContent=PHONE_PICTURE_CLOSE;
    phoneCenterLargePicture(large);
    phoneHistoryTo('picture');
  }else if(!open&&phone.pictureOpen){
    phone.pictureOpen=false;
    phoneHistoryTo(phone.screen);
  }
}
/* A large picture is bigger than the screen: it opens with its middle in the middle of the screen (where the
   design is), not at its top left corner, which is mostly floor. Done again once the picture has its size. */
function phoneCenterLargePicture(large){
  const image=large.querySelector('img');
  if(!image)return;
  const center=()=>{
    if(large.hidden)return;
    large.scrollLeft=Math.max(0,image.offsetLeft+image.offsetWidth/2-large.clientWidth/2);
    large.scrollTop=Math.max(0,image.offsetTop+image.offsetHeight/2-large.clientHeight/2);
  };
  if(image.complete&&image.naturalWidth)center();
  else image.addEventListener('load',center,{once:true});
}
/* the phone's Back on a large picture closes it */
function phoneCloseLargePicture(){
  const large=$('#picZoom');
  if(large)large.hidden=true;
  phone.pictureOpen=false;
}

/* ---------- Pick ---------- */

/* the list of designs: the last design on this device, then Start here, Recent and every group; or the search */
function phoneDrawPick(){
  const list=phone.root.querySelector('.ph-list'),find=phone.root.querySelector('#phFind').value.trim();
  const entries=catalogEntries(),byId=id=>entries.find(entry=>entry.id===id);
  const rows=items=>items.filter(Boolean).map(phoneRowHtml).join('');
  const block=(title,items)=>items.length?`<h3 class="ph-group">${esc(title)}</h3>${rows(items)}`:'';
  if(find){
    const found=searchEntries(find);
    list.innerHTML=found.length?block(`Results for "${find}"`,found)
      :`<p class="ph-none">Nothing matches "${esc(find)}". Try another word, like shelf, bench or table.</p>`;
    return;
  }
  const last=S.parts.length?`<button type="button" class="ph-row ph-last" data-ph="last">${icon('i-doc','l')}<span><b>Your last design</b><small>${esc(S.name)}</small></span>${icon('i-chev')}</button>`:'';
  list.innerHTML=last+
    block('Start here',CATALOG_START.map(byId))+
    block('Recent',catalogStored(CATALOG_RECENT_KEY).map(byId))+
    CATALOG_GROUPS.map(group=>block(group.name,entries.filter(entry=>entry.group===group.id))).join('');
}
function phoneRowHtml(entry){
  return`<button type="button" class="ph-row" data-entry="${esc(entry.id)}">${icon(entry.icon||'i-presets','l')}`+
    `<span><b>${esc(entry.name)}</b><small>${esc(entry.spec||'')}</small></span>${icon('i-chev')}</button>`;
}

/* ---------- Sizes ---------- */

/* Opens the form of a catalog entry (the desktop's own catalogPick: its start values, and what was typed for it
   earlier in this visit); typed, when given, are box texts to put back (readFormBoxes). */
function phoneOpenSizes(id,typed){
  if(!catalogPick(id))return false;
  if(typed&&fillFormBoxes(typed,false))showPresetSummary();
  phoneDecorateForm();
  delete phone.scrolls['sizes:'+id];   // a design opened from the list shows its name, picture and first size
  phoneShow('sizes');
  return true;
}
/* The catalog entry the design on screen was made from: the one built on this page, else the one its placement
   names (S.sets, js/app.js placePreset: the builder, and the entry's name for a builder that serves several).
   '' for a design that no entry made (drawn by hand in the full program). */
function phoneDesignEntry(){
  const last=S.parts.length&&S.sets&&S.nextSet?S.sets[S.nextSet]:null;
  if(!last)return'';
  const fits=entry=>!!entry&&entry.builder===last.name&&(!last.entry||entry.name===last.entry);
  if(phone.builtEntry&&fits(catalogEntry(phone.builtEntry)))return phone.builtEntry;
  const entries=catalogEntries();
  const found=entries.find(row=>fits(row)&&row.name===(last.entry||last.name))||entries.find(fits);
  return found?found.id:'';
}
/* "‹ Sizes" from the Result screen: ALWAYS the form of the design on screen, filled with the values it was built
   with (S.sets, js/app.js placePreset), even when another design's form was opened since or the page was loaded
   again. A design no catalog entry made (drawn in the full program) has no form: the list of designs opens. */
function phoneBackToSizes(){
  const id=phoneDesignEntry();
  if(!id){phoneShow('pick');return;}
  const last=S.sets[S.nextSet];
  catalogPick(id);
  if(last.vals&&fillFormBoxes(last.vals,true))showPresetSummary();
  phoneDecorateForm();
  phoneShow('sizes');
}
/* the parameter of a row of the form (its data-q is the index in curPreset.params) */
function phoneParamOf(row){
  return curPreset&&row?curPreset.params[+row.dataset.q]:null;
}
/* Gives each row of the moved form its phone controls, without moving any box:
     a size            [-] [box] [+], the box read-only (a tap opens the size pad), and the range under it
     a count, a number [-] [box] [+], the box typed in with the number keyboard
     a choice          the select as it is (made big by css/phone.css)
     a check box       the whole row taps it */
function phoneDecorateForm(){
  if(!phone.root||!curPreset)return;
  document.querySelectorAll('#presetForm .frow[data-q]').forEach(row=>{
    if(row.dataset.phDone)return;
    const q=phoneParamOf(row),box=row.querySelector('[data-k]');
    if(!q||!box)return;
    row.dataset.phDone='1';   // (its own mark: data-ph is the word of an action, read by phoneClick)
    if(q.opts){row.classList.add('ph-sel');return;}
    if(q.check){row.classList.add('ph-ck');return;}
    row.classList.add('ph-step');
    if(box.hasAttribute('data-len'))box.readOnly=true;
    else box.setAttribute('inputmode',q.int?'numeric':'decimal');
    box.insertAdjacentHTML('beforebegin',`<button type="button" class="ph-minus" data-ph-step="-1" aria-label="Less">${icon('i-min')}</button>`);
    box.insertAdjacentHTML('afterend',`<button type="button" class="ph-plus" data-ph-step="1" aria-label="More">${icon('i-plus')}</button>`);
    const range=phoneRangeText(q);
    if(range)row.insertAdjacentHTML('beforeend',`<small class="ph-range">${esc(range)}</small>`);
  });
  phoneSyncForm();
}
/* takes away everything phoneDecorateForm added, so the desktop's form is as it drew it */
function phoneUndecorateForm(){
  const form=$('#presetForm');
  if(!form)return;
  form.querySelectorAll('.ph-minus,.ph-plus,.ph-range,.ph-badline').forEach(node=>node.remove());
  form.querySelectorAll('.frow[data-ph-done]').forEach(row=>{
    delete row.dataset.phDone;
    row.classList.remove('ph-sel','ph-ck','ph-step');
    const box=row.querySelector('[data-k]');
    if(box){box.readOnly=false;box.removeAttribute('inputmode');}
  });
}
/* "From 2'-0" to 8'-0"": the limits of a box, written the way the box and the desktop's red line write them */
function phoneRangeText(q){
  const{min,max}=presetLimits(q),show=value=>q.int||q.dec?String(value):boxLenOf(q,value);
  if(min!==undefined&&max!==undefined)return`From ${show(min)} to ${show(max)}`;
  if(min!==undefined)return`At least ${show(min)}`;
  if(max!==undefined)return`At most ${show(max)}`;
  return'';
}
/* the value a box holds now, read the way readVals reads it (NaN when it cannot be read) */
function phoneBoxValue(box,q){
  return q.int?parseInt(box.value,10):q.dec?parseFloat(box.value):parseLen(box.value);
}
/* After any change: - and + grey out at the limits, and the red line sits under the first red row. */
function phoneSyncForm(){
  if(!phone.root)return;
  document.querySelectorAll('#presetForm .frow.ph-step').forEach(row=>{
    const q=phoneParamOf(row),box=row.querySelector('[data-k]');
    if(!q||!box)return;
    const{min,max}=presetLimits(q),value=phoneBoxValue(box,q),readable=!isNaN(value);
    const minus=row.querySelector('.ph-minus'),plus=row.querySelector('.ph-plus');
    if(minus)minus.disabled=readable&&min!==undefined&&value<=min+1e-9;
    if(plus)plus.disabled=readable&&max!==undefined&&value>=max-1e-9;
  });
  phoneMarkBad();
  phoneFootLine();
}
/* the first box marked red that a person can see, or null */
function phoneFirstBad(){
  return[...document.querySelectorAll('#presetForm .fld.bad')].find(box=>!box.closest('[hidden]'))||null;
}
/* the sizes give a "stop" (or build nothing): the desktop's summary then holds its red line (showPresetSummary) */
function phoneCannotBuild(){
  return!presetFieldNote&&!!document.querySelector('#presetSum .err');
}
/* The red line under the first red row: the desktop's own (presetFieldNote) for a size out of range; for sizes that
   cannot be built, where the reason is (the warning box at the end of the form). */
function phoneMarkBad(){
  document.querySelectorAll('#presetForm .ph-badline').forEach(node=>node.remove());
  const bad=phoneFirstBad(),row=bad&&bad.closest('.frow');
  if(!row)return;
  const words=presetFieldNote||(phoneCannotBuild()?PHONE_STOP_ROW_LINE:'');
  if(words)row.insertAdjacentHTML('beforeend',`<p class="ph-badline">${esc(words)}</p>`);
}
/* The line over "Build it", which is always in sight: why it cannot build yet (the button then looks waiting), or
   that building replaces the design made before. */
function phoneFootLine(){
  if(!phone.root)return;
  const line=phone.root.querySelector('.ph-footline'),build=phone.root.querySelector('.ph-build');
  const onSizes=phone.screen==='sizes'&&!!curPreset;
  const bad=onSizes&&!!presetFieldNote&&!!phoneFirstBad(),cannot=onSizes&&!bad&&phoneCannotBuild();
  build.classList.toggle('ph-wait',bad||cannot);
  line.classList.toggle('bad',bad||cannot);
  line.textContent=!onSizes?'':bad?presetFieldNote:cannot?PHONE_STOP_LINE:S.parts.length?PHONE_REPLACE_LINE:'';
  line.hidden=!line.textContent;
}
/* typing anywhere in the shell: the form's own handlers draw the summary; the phone follows a moment later */
function phoneTyped(event){
  // (only while typing: the "change" that comes as the box loses the focus, when a found row is tapped, must not
  // draw the list again under the finger, or the tap is lost)
  if(event.target.id==='phFind'){if(event.type==='input')phoneDrawPick();return;}
  if(!event.target.closest('#presetForm'))return;
  clearTimeout(phone.badTimer);
  phone.badTimer=setTimeout(phoneSyncForm,200);   // after showPresetSummary (180 ms after typing) has read the boxes
  phoneSaveSoon(PHONE_SAVE_AFTER);
}
/* a tap on a check box row away from the box itself ticks it, as the box would */
function phoneToggleRow(row){
  const box=row.querySelector('input[type=checkbox]');
  if(!box)return;
  box.checked=!box.checked;
  box.dispatchEvent(new Event('input',{bubbles:true}));
  box.dispatchEvent(new Event('change',{bubbles:true}));
}

/* ---------- - and + ---------- */

/* One step of 1 (an inch, or 1 of a count or a number), held to the limits, written the way the box writes it,
   then "input", as typing would. */
function phoneStep(button){
  const row=button.closest('.frow'),q=phoneParamOf(row),box=row&&row.querySelector('[data-k]');
  if(!q||!box||button.disabled)return false;
  const{min,max}=presetLimits(q);
  let value=phoneBoxValue(box,q);
  if(isNaN(value))value=presetStartValue(q);
  value+=+button.dataset.phStep;
  value=Math.max(min!==undefined?min:0,value);   // (no size and no count is below 0: readVals could not read it)
  if(max!==undefined)value=Math.min(max,value);
  value=Math.round(value*10000)/10000;
  box.value=q.int||q.dec?String(value):boxLenIn(box,value);
  box.dispatchEvent(new Event('input',{bubbles:true}));
  readVals(false);
  phoneSyncForm();
  return true;
}
/* A press does nothing at once: these buttons sit at both edges of every size row, right where a thumb starts to
   scroll the form. A tap (the browser's click, which it does not send for a scroll) is one step, then "change", so
   a size choice that these numbers stand for switches to Custom (presetFieldChanged, js/app.js). A press held still
   for PHONE_REPEAT.after starts stepping, and its release fires "change". A press that becomes a scroll (the
   finger moves, or the browser sends pointercancel) changes nothing. */
function phoneWireSteppers(root){
  root.addEventListener('pointerdown',event=>{
    phone.heldStepped=null;
    const button=event.target.closest('[data-ph-step]');
    if(!button||event.button>0||button.disabled)return;
    phoneStopRepeat(false);
    const repeat={button,pointerId:event.pointerId,x:event.clientX,y:event.clientY,timer:0,stepped:false};
    repeat.timer=setTimeout(function again(){
      if(phone.repeat!==repeat)return;
      if(!phoneStep(button)){phoneStopRepeat(true);return;}
      repeat.stepped=true;
      repeat.timer=setTimeout(again,PHONE_REPEAT.every);
    },PHONE_REPEAT.after);
    phone.repeat=repeat;
  });
  const ours=event=>phone.repeat&&event.pointerId===phone.repeat.pointerId;
  root.addEventListener('pointermove',event=>{
    if(ours(event)&&Math.hypot(event.clientX-phone.repeat.x,event.clientY-phone.repeat.y)>PHONE_STEP_SLOP)phoneStopRepeat(true);
  });
  root.addEventListener('pointerup',event=>{
    if(!ours(event))return;
    if(phone.repeat.stepped)phone.heldStepped=phone.repeat.button;   // (the click that comes next is this hold's)
    phoneStopRepeat(true);
  });
  root.addEventListener('pointercancel',event=>{if(ours(event))phoneStopRepeat(true);});
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-ph-step]');
    if(!button)return;
    if(phone.heldStepped===button){phone.heldStepped=null;return;}
    if(phoneStep(button))phoneFireChange(button.closest('.frow').querySelector('[data-k]'));
  });
}
/* ends a press of - or +; fireChange: when the hold stepped, the box fires "change" as a release would */
function phoneStopRepeat(fireChange){
  const repeat=phone.repeat;
  if(!repeat)return;
  phone.repeat=null;
  clearTimeout(repeat.timer);
  if(fireChange&&repeat.stepped&&repeat.button.isConnected)phoneFireChange(repeat.button.closest('.frow').querySelector('[data-k]'));
}
function phoneFireChange(box){
  if(!box)return;
  box.dispatchEvent(new Event('change',{bubbles:true}));
  phoneSyncForm();
}

/* ---------- the size pad ----------
   Keeps feet, whole inches and one fraction. Every key writes boxLen(feet*12 + inches + fraction) into the real box
   and fires "input", so the picture and the summary follow; the box, readVals and parseLen do all the reading. */
function phonePadHtml(){
  const key=(word,text,extra,name)=>`<button type="button" class="ph-key${extra||''}" data-key="${word}"${name?` aria-label="${name}"`:''}>${esc(text)}</button>`;
  const digits=['7','8','9'].map(d=>key(d,d)).join('')+key('back','⌫',' fn','Delete')+
    ['4','5','6'].map(d=>key(d,d)).join('')+key('ft','ft',' fn')+
    ['1','2','3'].map(d=>key(d,d)).join('')+key('clear','Clear',' fn')+
    key('0','0',' wide')+key('sixteenths','16ths',' fn wide');
  return`<div class="ph-pad-shade" data-key="cancel"></div>
    <div class="ph-pad-sheet" role="dialog" aria-modal="true" aria-label="Type a size">
      <div class="ph-pad-head"><b class="ph-pad-label"></b><small class="ph-pad-range"></small></div>
      <div class="ph-pad-read"><output class="ph-pad-keyed"></output><small class="ph-pad-means"></small></div>
      <div class="ph-pad-keys"><div class="ph-pad-digits">${digits}</div><div class="ph-pad-fracs"></div></div>
      <button type="button" class="lnk ph-pad-type" data-key="type">Type it instead</button>
      <div class="ph-pad-btns"><button type="button" class="btn" data-key="cancel">Cancel</button><button type="button" class="btn pri" data-key="done">Done</button></div>
    </div>`;
}
function phoneWirePad(pad){
  pad.addEventListener('click',event=>{
    const key=event.target.closest('[data-key]');
    if(key)phonePadKey(key.dataset.key);
  });
}
function phoneOpenPad(box){
  const row=box.closest('.frow'),q=phoneParamOf(row);
  if(!q)return;
  const pad=phone.root.querySelector('.ph-pad');
  box.blur();   // a read-only box keeps no keyboard; the pad is the keyboard
  phone.pad={box,q,old:box.value,feet:null,inches:'',frac:'',sixteenths:false};
  pad.querySelector('.ph-pad-label').textContent=splitLabel(q.label)[0];
  pad.querySelector('.ph-pad-range').textContent=phoneRangeText(q);
  pad.hidden=false;
  phoneDrawPad();
  phoneHistoryTo('pad');   // (the phone's Back closes it, as Cancel)
}
/* closes the pad; cancel puts the old text back */
function phoneClosePad(cancel){
  const state=phone.pad;
  if(!state)return;
  phone.pad=null;
  if(phone.root)phone.root.querySelector('.ph-pad').hidden=true;
  phoneHistoryTo('sizes');
  if(cancel&&state.box.isConnected){
    state.box.value=state.old;
    state.box.dispatchEvent(new Event('input',{bubbles:true}));
    phoneFireChange(state.box);
  }
}
/* the inches the pad holds, or null when nothing has been keyed */
function phonePadInches(state){
  if(state.feet===null&&!state.inches&&!state.frac)return null;
  const[top,bottom]=state.frac?state.frac.split('/').map(Number):[0,1];
  return(+(state.feet||0))*12+(+(state.inches||0))+top/bottom;
}
function phonePadKey(word){
  const state=phone.pad;
  if(!state)return;
  if(word==='cancel'){phoneClosePad(true);return;}
  if(word==='done'){phoneClosePad(false);phoneFireChange(state.box);return;}
  if(word==='type'){phoneTypeInstead(state.box);return;}
  if(word==='sixteenths'){state.sixteenths=!state.sixteenths;phoneDrawPad();return;}
  if(/^\d$/.test(word)){if(state.inches.length<4)state.inches=(state.inches==='0'?'':state.inches)+word;}
  else if(word==='ft'){if(state.inches&&state.feet===null){state.feet=state.inches;state.inches='';}}
  else if(word==='clear'){state.feet=null;state.inches='';state.frac='';}
  else if(word==='back'){
    if(state.frac)state.frac='';
    else if(state.inches)state.inches=state.inches.slice(0,-1);
    else if(state.feet!==null){state.feet=state.feet.slice(0,-1);if(!state.feet)state.feet=null;}
  }
  else if(word==='nofrac')state.frac='';
  else if(/^\d+\/\d+$/.test(word))state.frac=word;
  const inches=phonePadInches(state);
  state.box.value=inches===null?state.old:boxLenIn(state.box,inches);
  state.box.dispatchEvent(new Event('input',{bubbles:true}));
  readVals(false);
  phoneSyncForm();
  phoneDrawPad();
}
/* the readout (what was keyed), what the box reads it as or the desktop's red line, and the fraction keys */
function phoneDrawPad(){
  const state=phone.pad,pad=phone.root.querySelector('.ph-pad');
  const keyed=[];
  if(state.feet!==null)keyed.push(`${state.feet}'`);
  if(state.inches||state.frac)keyed.push(`${[state.inches,state.frac].filter(Boolean).join(' ')}"`);
  const readout=pad.querySelector('.ph-pad-keyed'),means=pad.querySelector('.ph-pad-means');
  readout.textContent=keyed.join(' ')||state.old;
  readout.classList.toggle('old',!keyed.length);
  const bad=state.box.classList.contains('bad');
  means.classList.toggle('bad',bad);
  if(bad)means.textContent=presetFieldNote||CANNOT_READ;
  else if(!keyed.length)means.textContent='Tap the numbers to type a new size';
  else{
    // a size of a foot or more also in inches: "2'-6"" is not read as 30 inches by everyone
    const inches=parseLen(state.box.value),written=boxLenIn(state.box,inches);
    means.textContent='Reads as '+written+(inches>=12&&fmt(inches)!==written?` (${fmt(inches)})`:'');
  }
  const fractions=state.sixteenths?PHONE_SIXTEENTHS:PHONE_EIGHTHS;
  pad.querySelector('.ph-pad-fracs').innerHTML=fractions.map(fraction=>fraction
    ?`<button type="button" class="ph-key frac${state.frac===fraction?' on':''}" data-key="${fraction}">${fraction}</button>`
    :`<button type="button" class="ph-key fn" data-key="nofrac">None</button>`).join('');
  pad.querySelector('[data-key="sixteenths"]').textContent=state.sixteenths?'8ths':'16ths';
}
/* "Type it instead": the pad closes and the box takes the phone's own keyboard, until it is left */
function phoneTypeInstead(box){
  phoneClosePad(false);
  box.readOnly=false;
  box.setAttribute('inputmode','text');
  box.addEventListener('blur',()=>{
    if(phone.root&&box.closest('#phone')){box.readOnly=true;box.removeAttribute('inputmode');}
  },{once:true});
  box.focus();
  if(box.select)box.select();
}

/* ---------- building ---------- */

/* "Build it": the desktop's own way, through readVals and presetGate (js/checkui.js): a red box is scrolled to and
   nothing is built; a "stop" is refused with the desktop's message; a "warn" asks Build anyway / Go back. The
   phone never asks "Replace the design on screen?": the line over the button has said so already. */
function phoneBuild(){
  if(!curPreset)return;
  const vals=readVals(false);
  phoneSyncForm();
  if(!vals){
    // the line over the button says why; the box at fault is brought into sight
    const bad=phoneFirstBad();
    if(bad)bad.closest('.frow').scrollIntoView({block:'center'});
    return;
  }
  const preset=curPreset,entryName=presetEntryName(preset),entryId=catalogState.picked;
  presetGate(preset,vals,parts=>{
    placePreset(preset,vals,parts,false,entryName);
    phone.builtEntry=entryId||'';
    if(typeof phoneView!=='undefined')phoneView.resumeStep=null;   // (a new design starts its 3D tab afresh: js/phoneview.js)
    // shared with the full program's Recent; the self-check builds are not something this device "made"
    if(entryId&&catalogEntry(entryId)&&(!autoConfirm||catalogState.rememberInCheck))rememberRecent(entryId);
    phoneOpenResult('3d');
  });
}

/* ---------- Result ---------- */

function phoneOpenResult(sectionId){
  phone.section=sectionId||'3d';
  phoneShow('result');
  phoneShowSection(phone.section,true);
  if(phone.section==='3d')phoneFitView();
}
/* Shows one tab of the Result screen. The program's own tab draws it (setTab), then the section's function in
   js/phonepages.js lays it out for the phone. */
function phoneShowSection(id,force){
  const section=PHONE_SECTIONS.find(row=>row.id===id);
  if(!section||!phone.root)return;
  if(phone.screen!=='result'){phone.section=id;phoneShow('result');force=true;}
  // a tap on the tab that shows already goes back to its top (to the list of steps, on Steps), as phone apps do
  if(!force&&phone.section===id&&phone.root.dataset.section===id){phone.root.querySelector('.ph-body').scrollTop=0;return;}
  phoneKeepScroll();
  // the 3D tab is left: Build step by step remembers its step (js/phoneview.js), as setTab ends it
  if(phone.section==='3d'&&id!=='3d'&&typeof window.phoneViewLeaving==='function')window.phoneViewLeaving();
  phone.section=id;
  const root=phone.root;
  root.dataset.section=id;
  root.querySelectorAll('.ph-tab').forEach(button=>{
    const on=button.dataset.phTab===id;
    button.classList.toggle('on',on);
    button.setAttribute('aria-pressed',String(on));
  });
  // (the 3D view must have its size before setTab('design') measures it)
  if(tab!==section.tab)setTab(section.tab);
  if(id==='3d'){
    resize();
    if(typeof window.phoneViewShown==='function')window.phoneViewShown();
  }
  const fill=section.shown&&window[section.shown];
  if(typeof fill==='function')fill(id,root.querySelector('.ph-docs'));
  phoneRestoreScroll();
  phoneSaveSoon(0);
}

/* ---------- the 3D view, turned with a finger ----------
   A layer over the canvas takes every finger (Pointer Events: one path for a mouse and a touch), so the canvas,
   where a press selects and moves a piece, never gets one. One finger turns, two fingers zoom (the change in their
   distance) and slide (the move of their middle). A tap does nothing. */
function phoneTouchLayer(layer){
  const fingers=new Map();     // pointerId -> {x, y}
  let one=null;                // one finger: {sx, sy, lx, ly, moved}
  let two=null;                // two fingers: {dist, mx, my} at the last move
  let several=false;           // more than one finger has been down since the first one landed (then it is no tap)
  const pair=()=>{
    const[a,b]=[...fingers.values()];
    return{dist:Math.hypot(a.x-b.x,a.y-b.y),mx:(a.x+b.x)/2,my:(a.y+b.y)/2};
  };
  // after a finger is lifted, the one left goes on turning from where it is, with no jump
  const settle=()=>{
    two=null;one=null;
    if(fingers.size===1){const f=[...fingers.values()][0];one={sx:f.x,sy:f.y,lx:f.x,ly:f.y,moved:true};}
    else if(fingers.size>=2)two=pair();
  };
  // (the page hidden while a finger was down: its pointerup may never come)
  phone.touchReset=()=>{fingers.clear();one=null;two=null;};
  layer.addEventListener('pointerdown',event=>{
    event.preventDefault();
    if(event.isPrimary)fingers.clear();   // a first finger: any finger still held is one whose lift was lost
    if(typeof window.phoneViewPressed==='function')window.phoneViewPressed();   // (Show me stays while the view turns: js/phoneview.js)
    try{layer.setPointerCapture(event.pointerId);}catch(e){}
    fingers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(fingers.size===1){one={sx:event.clientX,sy:event.clientY,lx:event.clientX,ly:event.clientY,moved:false};several=false;}
    else{several=true;settle();}
  });
  layer.addEventListener('pointermove',event=>{
    if(!fingers.has(event.pointerId))return;
    fingers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(fingers.size===1&&one)phoneTurn(one,event.clientX,event.clientY);
    else if(fingers.size>=2&&two){const now=pair();phonePinch(two,now);two=now;}
  });
  const lift=event=>{
    if(!fingers.delete(event.pointerId))return;
    // one finger down and up without turning the view: a tap (js/phoneview.js: it ends Show me; two make a double
    // tap, which opens a door or drawer)
    const tapped=event.type==='pointerup'&&!fingers.size&&!several&&one&&!one.moved;
    settle();
    if(tapped&&typeof window.phoneViewTapped==='function')window.phoneViewTapped(event.clientX,event.clientY);
  };
  layer.addEventListener('pointerup',lift);
  layer.addEventListener('pointercancel',lift);
  layer.addEventListener('wheel',event=>{
    event.preventDefault();
    cam.r=Math.min(PHONE_VIEW.far,Math.max(PHONE_VIEW.near,cam.r*Math.exp(event.deltaY*PHONE_VIEW.wheel)));
    updateCam();
  },{passive:false});
  layer.addEventListener('contextmenu',event=>event.preventDefault());
  layer.addEventListener('gesturestart',event=>event.preventDefault());   // older iPhones zoom the whole page otherwise
}
/* Reset view: the desktop's Fit view (fit('fit'), js/view3d.js), which is made for a wide window. On an upright
   screen the same distance cuts the sides off, so the camera steps back by the narrowness of the view (at most
   twice as far), until the whole width shows. dir: the desktop's fit() direction ('fit', 'front', 'side', 'top'),
   for the standard views of the View sheet (js/phoneview.js). */
function phoneFitView(dir){
  resize();   // (the step bar or the color key may have come or gone since the view was last measured)
  fit(dir||'fit');
  phoneUprightBack();
  phoneKeepInFree();
}
/* The part of the 3D view no button, line or bar covers, in pixels of the canvas: under the line at the top (or
   the step bar) and the color key, over Reset view and View. js/phoneview.js lists the things that cover it. */
function phoneFreeArea(){
  const canvas=$('#cv').getBoundingClientRect();
  if(!canvas.width||!canvas.height)return null;
  const margin=PHONE_VIEW.margin;
  let top=canvas.top,bottom=canvas.bottom;
  for(const node of phone.root.querySelectorAll('.ph-view .ph-hint,.ph-view .ph-stepbar,.ph-view #legend')){
    const box=node.getBoundingClientRect();
    if(box.height)top=Math.max(top,box.bottom);   // (all three sit at the top of the view)
  }
  for(const node of phone.root.querySelectorAll('.ph-view .ph-reset,.ph-view .ph-viewbtn')){
    const box=node.getBoundingClientRect();
    if(box.height)bottom=Math.min(bottom,box.top);
  }
  return{left:margin,right:canvas.width-margin,top:top-canvas.top+margin,bottom:bottom-canvas.top-margin,width:canvas.width,height:canvas.height};
}
/* Keeps the whole model (as it is drawn now: pulled apart, doors open, and its size lines) inside the free area:
   the camera only steps back, never in, and the model is slid to the middle of that area. Used after every
   framing, so Reset view, a standard view and leaving Build step by step show all of it. */
function phoneKeepInFree(){
  const free=phoneFreeArea();
  if(!free||free.right<=free.left||free.bottom<=free.top)return;
  const box=new THREE.Box3();
  meshes.forEach(group=>box.expandByObject(group));
  if(typeof dimGroup!=='undefined'&&dimGroup.visible)box.expandByObject(dimGroup);
  if(box.isEmpty())return;
  const corners=[];
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z));
  const right=new THREE.Vector3(),up=new THREE.Vector3(),point=new THREE.Vector3();
  // a few rounds: each steps back and slides by what the last one measured (a perspective view is not linear)
  for(let round=0;round<4;round++){
    camera.updateMatrixWorld();
    let left=Infinity,rightmost=-Infinity,top=Infinity,bottom=-Infinity,behind=false;
    for(const corner of corners){
      point.copy(corner).project(camera);
      if(point.z>1||point.z<-1){behind=true;break;}
      const x=(point.x+1)/2*free.width,y=(1-point.y)/2*free.height;
      left=Math.min(left,x);rightmost=Math.max(rightmost,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    if(behind){cam.r=Math.min(PHONE_VIEW.far,cam.r*1.5);updateCam();continue;}
    const step=Math.max(1,(rightmost-left)/(free.right-free.left),(bottom-top)/(free.bottom-free.top));
    const slideX=(left+rightmost)/2-(free.left+free.right)/2,slideY=(top+bottom)/2-(free.top+free.bottom)/2;
    if(step<1.001&&Math.abs(slideX)<1&&Math.abs(slideY)<1)break;
    // pixels to inches at the distance of the target
    const perPixel=2*cam.r*Math.tan(camera.fov*Math.PI/360)/free.height;
    right.setFromMatrixColumn(camera.matrixWorld,0);
    up.setFromMatrixColumn(camera.matrixWorld,1);
    cam.target.addScaledVector(right,slideX*perPixel).addScaledVector(up,-slideY*perPixel);
    cam.r=Math.min(PHONE_VIEW.far,cam.r*step);
    updateCam();
  }
}
/* steps the camera back by the narrowness of an upright view (at most PHONE_VIEW.uprightBack times), for a camera
   the desktop placed for its wide window (Fit view, Show me) */
function phoneUprightBack(){
  const aspect=camera.aspect;
  if(aspect>0&&aspect<1){
    cam.r=Math.min(PHONE_VIEW.far,cam.r*Math.min(PHONE_VIEW.uprightBack,1/aspect));
    updateCam();
  }
}
/* one finger: the desktop's orbit (tools.js), dead zone and all */
function phoneTurn(drag,x,y){
  const dx=x-drag.lx,dy=y-drag.ly;
  drag.lx=x;drag.ly=y;
  if(!drag.moved&&Math.hypot(x-drag.sx,y-drag.sy)<PHONE_VIEW.deadZone)return;
  if(typeof window.phoneViewTurned==='function')window.phoneViewTurned();   // (the line over the view stops naming a standard view)
  drag.moved=true;
  cam.th+=dx*PHONE_VIEW.turn;
  cam.ph=Math.min(Math.PI/2+PHONE_VIEW.below,Math.max(PHONE_VIEW.lowest,cam.ph-dy*PHONE_VIEW.turn));
  updateCam();
}
/* two fingers: zoom by the change in their distance, slide by the move of their middle (the desktop's pan) */
function phonePinch(before,now){
  if(before.dist>0&&now.dist>0)cam.r=Math.min(PHONE_VIEW.far,Math.max(PHONE_VIEW.near,cam.r*before.dist/now.dist));
  const dx=now.mx-before.mx,dy=now.my-before.my;
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
  cam.target.addScaledVector(right,-dx*cam.r*PHONE_VIEW.slide).addScaledVector(up,dy*cam.r*PHONE_VIEW.slide);
  updateCam();
}

/* ---------- what the page remembers (the storage itself is js/phonepages.js: phoneSaveState / phoneLoadState) ---------- */

/* {screen, section, entry, typed, built}: the screen, the Result tab, the catalog entry of the form, what is in the
   boxes, and the entry the design on screen was built from */
function phoneCurrentState(){
  const state={screen:phone.screen,section:phone.section,entry:catalogState.picked||'',built:phone.builtEntry||''};
  if(phone.screen==='sizes'&&curPreset)state.typed=readFormBoxes();
  return state;
}
/* opens the page as a state says: Result if the design has pieces, Sizes of its entry with its boxes, else Pick */
function phoneApplyState(state){
  phone.builtEntry=state&&typeof state.built==='string'?state.built:'';
  if(state&&state.screen==='result'&&S.parts.length){phoneOpenResult(PHONE_SECTIONS.some(row=>row.id===state.section)?state.section:'3d');return;}
  if(state&&state.screen==='sizes'&&state.entry&&catalogEntry(state.entry)&&phoneOpenSizes(state.entry,state.typed))return;
  phoneShow('pick');
}
function phoneSaveSoon(delay){
  clearTimeout(phone.saveTimer);
  const save=()=>{if(phone.root&&typeof window.phoneSaveState==='function')window.phoneSaveState(phoneCurrentState());};
  if(!delay)save();else phone.saveTimer=setTimeout(save,delay);
}

/* ---------- start ---------- */

/* On a phone: the shell over the whole page, at the screen it was left at. In the full program on a device the rule
   calls a phone: one button, "Phone page", bottom right. Runs once every script has loaded (js/phonepages.js comes
   after this file). */
function phoneStart(){
  if(window.PHONE_PAGE){
    phoneToastWords();
    // (read before mounting: the mount shows Pick, and showing a screen saves it)
    const state=typeof window.phoneLoadState==='function'?window.phoneLoadState():null;
    // (the history is left alone while the page finds its place: the mount shows Pick first, and stepping the
    // history back to Pick would undo the place restored a moment later)
    phone.popping=true;
    try{
      phoneMount(document.body);
      phoneApplyState(state);
    }finally{phone.popping=false;}
    phoneHistorySettle();
    return;
  }
  if(phonePageRule(phoneFacts())){
    const link=document.createElement('button');
    link.type='button';
    link.id='phoneLink';
    link.textContent='Phone page';
    link.title='Opens the page made for a phone: pick a design, set its sizes, see it in 3D and read the lists';
    link.onclick=()=>phoneGoTo('phone');
    document.body.appendChild(link);
  }
}
/* On the phone page only: a message that ends with the desktop's advice for keeping a design the browser will not
   store (KEEP_ADVICE, js/hosted.js: "Use File, then ...") ends with advice a phone can follow. The desktop's
   toast and its words are left as they are. */
function phoneToastWords(){
  if(typeof KEEP_ADVICE!=='string')return;
  const phoneWords=message=>{
    let text=String(message);
    for(const[desktop,phoneSays]of PHONE_TOAST_WORDS)text=text.replace(desktop,phoneSays);
    return text.endsWith(KEEP_ADVICE)?text.slice(0,-KEEP_ADVICE.length)+PHONE_KEEP_ADVICE:text;
  };
  // the autosave's toast (js/state.js) and the "Could not save" message (js/app.js)
  if(typeof toast==='function'){
    const desktopToast=toast;
    toast=function(message){return desktopToast.call(this,phoneWords(message));};
  }
  if(typeof showMessage==='function'){
    const desktopMessage=showMessage;
    showMessage=function(title,text,options){return desktopMessage.call(this,title,phoneWords(text),options);};
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',phoneStart);
else setTimeout(phoneStart,0);

/* ---------- self-checks (selfTest runs every function in SELFTESTS, at the desktop window) ---------- */

/* Mounts the shell in a 320 x 568 box over the desktop, runs check(root), and in every case unmounts it and puts
   back the design, the undo stacks, the tab, the form, the catalog's memory, the camera and autoConfirm. */
function phoneCheckAround(check){
  const keepSnap=lastSnap,undo0=undoStack.slice(),redo0=redoStack.slice(),tab0=tab,confirm0=autoConfirm;
  const picked0=catalogState.picked,typed0=JSON.parse(JSON.stringify(catalogState.typed)),preset0=curPreset,entry0=curEntry;
  const view0={target:cam.target.clone(),r:cam.r,th:cam.th,ph:cam.ph};
  let recent0=null,last0=null;
  try{recent0=localStorage.getItem(CATALOG_RECENT_KEY);last0=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  const putBack=(key,value)=>{try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch(e){}};
  const holder=document.createElement('div');
  holder.style.cssText='position:fixed;left:0;top:0;width:320px;height:568px;z-index:1000;background:#fff';
  document.body.appendChild(holder);
  autoConfirm=true;
  try{
    const root=phoneMount(holder);
    check(root);
  }finally{
    phoneUnmount();
    holder.remove();
    autoConfirm=confirm0;
    load(keepSnap,true);undoStack=undo0;redoStack=redo0;
    if(tab!==tab0)setTab(tab0);
    catalogState.typed=typed0;
    if(picked0&&catalogEntry(picked0)){catalogState.picked='';catalogPick(picked0);}
    else if(preset0&&PRESETS.includes(preset0))choosePreset(PRESETS.indexOf(preset0),entry0);
    else showNoPreset();
    catalogState.picked=picked0;
    renderPresetCards();   // the tiles of the presets window, drawn again without anything the check picked
    putBack(CATALOG_RECENT_KEY,recent0);
    putBack(LAST_PRESET_KEY,last0);
    cam.target.copy(view0.target);cam.r=view0.r;cam.th=view0.th;cam.ph=view0.ph;updateCam();
  }
}
/* the catalog entry of a builder, by its preset name */
function phoneEntryOf(builder){
  const entry=catalogEntries().find(row=>row.builder===builder);
  return entry?entry.id:'';
}

/* 1. The rule gives the phone page to phones only; the stored choice wins; storage that throws still gives the rule. */
SELFTESTS.push(function phoneRuleIsForPhonesOnly(problems){
  const wrong=text=>problems.push('phone page rule: '+text);
  const touch=shortSide=>({coarse:true,noHover:true,shortSide});
  for(const side of[320,375,390,412,430])if(!phonePageRule(touch(side)))wrong(`a phone with a ${side} px short side did not get the phone page`);
  for(const side of[744,768,1024,600])if(phonePageRule(touch(side)))wrong(`a tablet with a ${side} px short side got the phone page`);
  if(phonePageRule({coarse:false,noHover:false,shortSide:400}))wrong('a touch laptop (fine pointer) got the phone page');
  if(phonePageRule({coarse:false,noHover:false,shortSide:1080}))wrong('a narrow window on a 1920 x 1080 screen got the phone page');
  if(!phonePageWanted('phone',touch(1024))||phonePageWanted('full',touch(375)))wrong('the stored choice did not win over the rule');
  if(phonePageWanted('',touch(1024))||!phonePageWanted('',touch(375)))wrong('with no stored choice the rule did not decide');
  // a browser that refuses storage: the choice reads as none, and the rule decides
  const storage=Object.getOwnPropertyDescriptor(window,'localStorage');
  let refused='x';
  try{
    Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('refused');}});
    refused=phoneChoice();
    setPhoneChoice('phone');
  }catch(e){wrong('a browser that refuses storage made the rule throw: '+e.message);}
  finally{if(storage)Object.defineProperty(window,'localStorage',storage);else delete window.localStorage;}
  if(refused!=='')wrong('with storage refused the choice should read as none');
  if(phoneFacts().shortSide>=PHONE_SHORT_SIDE_MAX&&window.PHONE_PAGE&&!phoneChoice())wrong('this desktop got the phone page without choosing it');
});

/* 2. The phone's styles reach only the phone page: every rule of css/phone.css starts with #phone or
   html.phone-page (and #phoneLink, the one button the full program shows on a phone). */
SELFTESTS.push(function phoneStylesStayOnThePhone(problems){
  // css/phone.css (the shell) and css/phonepages.css (the result pages, js/phonepages.js)
  for(const file of['phone','phonepages']){
    const sheet=[...document.styleSheets].find(row=>new RegExp(`css/${file}\\.css(\\?|#|$)`).test(row.href||''));
    if(!sheet){problems.push(`phone page styles: css/${file}.css is not loaded`);continue;}
    let rules=null;
    try{rules=sheet.cssRules;}catch(e){rules=null;}   // opened from disk, the browser may not let the page read it
    const walk=list=>{
      for(const rule of list||[]){
        if(rule.cssRules&&!rule.selectorText){walk(rule.cssRules);continue;}   // @media
        if(!rule.selectorText)continue;
        for(const selector of rule.selectorText.split(',').map(text=>text.trim())){
          if(!/^(#phone(?![\w-])|html\.phone-page(?![\w-])|#phoneLink(?![\w-]))/.test(selector))problems.push(`phone page styles (css/${file}.css): "${selector}" could reach the desktop`);
        }
      }
    };
    walk(rules);
  }
});

/* 3. The size pad and - / + read like the desktop: what is keyed lands in the real box and readVals reads it. */
SELFTESTS.push(function phoneSizePadReadsLikeTheDesktop(problems){
  const wrong=text=>problems.push('phone size pad: '+text);
  phoneCheckAround(root=>{
    if(!phoneOpenSizes('wall-shelf')){wrong('the Wall shelf cannot be opened');return;}
    const box=$('#presetForm [data-k="L"]'),row=box&&box.closest('.frow');
    if(!box||!row.querySelector('.ph-minus')||!row.querySelector('.ph-plus')||!box.readOnly)return wrong('the Length row has no - and + or its box is not read-only');
    const keys=list=>list.forEach(word=>phonePadKey(word));
    box.click();
    if(!phone.pad)return wrong('a tap on the box did not open the pad');
    keys(['4','7','sixteenths','15/16']);
    if(box.value!=='3\'-11 15/16"')wrong(`4 7 15/16 wrote ${box.value} in the box`);
    phonePadKey('done');
    let vals=readVals(false);
    if(!vals||vals.L!==47.9375)wrong(`4 7 15/16 was read as ${vals&&vals.L}`);
    box.click();
    keys(['3','ft','1','1/2','done']);
    vals=readVals(false);
    if(!vals||vals.L!==37.5)wrong(`3 ft 1 1/2 was read as ${vals&&vals.L}`);
    // + at the largest size greys out
    const{max}=presetLimits(phoneParamOf(row));
    box.value=boxLen(max);
    box.dispatchEvent(new Event('input',{bubbles:true}));
    phoneSyncForm();
    if(!row.querySelector('.ph-plus').disabled)wrong('+ is not greyed out at the largest size');
    // 900 through "Type it instead": red, and the red line is the desktop's
    box.click();
    phonePadKey('type');
    if(box.readOnly||phone.pad)wrong('"Type it instead" did not hand the box to the keyboard');
    box.value='900';
    box.dispatchEvent(new Event('input',{bubbles:true}));
    readVals(false);
    phoneSyncForm();
    const line=row.querySelector('.ph-badline');
    if(!box.classList.contains('bad'))wrong('900 did not turn the box red');
    if(!line||line.textContent!==presetFieldNote||!presetFieldNote)wrong(`the red line says "${line&&line.textContent}", the desktop "${presetFieldNote}"`);
    box.blur();
    // a size that a size choice stands for (Fish tank wall, tank length) shows only with Custom picked (the short
    // forms, js/shortforms.js); picked, + steps it and the choice stays Custom
    const rack=phoneEntryOf('Fish tank wall / rack');
    if(!rack||!phoneOpenSizes(rack))return wrong('the Fish tank wall cannot be opened');
    const tank=$('#presetForm [data-k="tl"]'),choice=curPreset.params.find(q=>q.fill);
    if(!tank||!choice)return wrong('the Fish tank wall has no tank length box or no size choice');
    const plus=tank.closest('.frow').querySelector('.ph-plus'),choiceBox=$(`#presetForm [data-k="${choice.k}"]`);
    if(!tank.closest('.frow').hidden)wrong('the tank length shows while a named tank size is picked');
    choiceBox.value='custom';
    choiceBox.dispatchEvent(new Event('change',{bubbles:true}));
    readVals(false);
    phoneSyncForm();
    if(tank.closest('.frow').hidden)return wrong('picking Custom does not bring the tank length');
    const press=(type,x)=>plus.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:10}));
    // a thumb that lands on + to scroll the form (the browser takes the gesture and sends pointercancel, and no
    // click) changes nothing: not the size, not the size choice
    const before={tank:tank.value,choice:choiceBox.value};
    press('pointerdown',10);press('pointermove',10);press('pointercancel',10);
    if(tank.value!==before.tank||choiceBox.value!==before.choice)wrong(`a scroll that started on + changed the tank length to ${tank.value} or the tank size to ${choiceBox.value}`);
    // a tap (press, release, the browser's click) is one step, and the size choice stays Custom
    press('pointerdown',10);press('pointerup',10);plus.click();
    if(phoneBoxValue(tank,phoneParamOf(tank.closest('.frow')))!==phoneBoxValue({value:before.tank},phoneParamOf(tank.closest('.frow')))+1)wrong(`a tap on + made the tank length ${tank.value} from ${before.tank}`);
    if(choiceBox.value!=='custom')wrong('a step on the tank length took the tank size off Custom');
    const stepped=readVals(false);
    if(!stepped||Math.abs(stepped.tl-(phoneBoxValue({value:before.tank},phoneParamOf(tank.closest('.frow')))+1))>1e-6)wrong(`after a tap on + the form hands the builder a tank length of ${stepped&&stepped.tl}`);
  });
});

/* 4. A finger turns the view by the desktop's numbers; two fingers zoom and slide; a tap selects and moves nothing. */
SELFTESTS.push(function phoneTurnsLikeTheDesktop(problems){
  const wrong=text=>problems.push('phone 3D view: '+text);
  const pointer=(target,type,x,y,id)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,pointerId:id||1,button:0,buttons:type==='pointerup'?0:1,pointerType:'touch',isPrimary:(id||1)===1}));
  const drag=(target,x,y,dx)=>{pointer(target,'pointerdown',x,y);pointer(target,'pointermove',x+dx,y);pointer(target,'pointerup',x+dx,y);};
  phoneCheckAround(root=>{
    if(!phoneOpenSizes('wall-shelf'))return wrong('the Wall shelf cannot be opened');
    phoneBuild();
    if(!S.parts.length)return wrong('the Wall shelf was not built');
    // the desktop: a 100 px drag on empty space of the canvas (its top left corner, sky)
    const holder=phone.holder;
    phoneUnmount();
    setTab('design');
    const cv=$('#cv'),box=cv.getBoundingClientRect();
    fit('fit');
    const start=cam.th;
    drag(cv,box.left+3,box.top+3,100);
    const desktopTurn=cam.th-start;
    if(!(Math.abs(desktopTurn)>0))return wrong('the desktop drag did not turn the view, so this check proves nothing');
    // the desktop's pan (a right-button drag of 100 px) and one notch of its wheel, from the same distance
    const panFrom=r=>{cam.r=r;updateCam();return cam.target.clone();};
    const at=panFrom(100);
    cv.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,clientX:box.left+3,clientY:box.top+3,pointerId:9,button:2,buttons:2,pointerType:'mouse',isPrimary:true}));
    cv.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,clientX:box.left+103,clientY:box.top+3,pointerId:9,button:-1,buttons:2,pointerType:'mouse',isPrimary:true}));
    cv.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,clientX:box.left+103,clientY:box.top+3,pointerId:9,button:2,buttons:0,pointerType:'mouse',isPrimary:true}));
    const desktopSlide=cam.target.distanceTo(at);
    if(!(desktopSlide>0))wrong('the desktop right-button drag did not slide the view, so the slide is not compared');
    cam.r=100;updateCam();
    cv.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:100,clientX:box.left+3,clientY:box.top+3}));
    const desktopWheel=cam.r/100;
    // the phone: the same drag on the touch layer
    phoneMount(holder);
    phoneOpenResult('3d');
    const layer=phone.root.querySelector('.ph-touch'),area=layer.getBoundingClientRect();
    const cx=area.left+area.width/2,cy=area.top+area.height/2;
    // a real finger lands on whatever is on top there: it must be the touch layer, never the canvas, where a press
    // selects and moves a piece (a dispatched event is not hit-tested, so this is asked of the page)
    for(const[x,y]of[[cx,cy],[area.left+20,area.top+40],[area.right-10,area.top+10]]){
      const hit=document.elementFromPoint(x,y);
      if(hit!==layer)wrong(`a finger at ${Math.round(x-area.left)}, ${Math.round(y-area.top)} of the 3D view lands on ${hit?hit.tagName.toLowerCase()+(hit.id?'#'+hit.id:'')+(typeof hit.className==='string'&&hit.className?'.'+hit.className.split(' ')[0]:''):'nothing'}, not on the touch layer`);
    }
    const keep=JSON.stringify(S.parts);
    fit('fit');
    const before=cam.th;
    drag(layer,area.left+20,area.top+40,100);
    if(Math.abs(cam.th-before-desktopTurn)>1e-9)wrong(`a 100 px drag turned the view ${cam.th-before} on the phone and ${desktopTurn} on the desktop`);
    // two fingers whose middle moves 100 px, the same distance apart, slide the view as far as the desktop's
    // right-button drag (the numbers of the slide; the fingers themselves are tried below: one dispatched pointer
    // moves at a time, so their distance changes between the two moves)
    const phoneAt=panFrom(100);
    phonePinch({dist:40,mx:cx,my:cy},{dist:40,mx:cx+100,my:cy});
    const phoneSlide=cam.target.distanceTo(phoneAt);
    if(desktopSlide>0&&Math.abs(phoneSlide-desktopSlide)>1e-6*desktopSlide+1e-9)wrong(`a 100 px slide moved the view ${phoneSlide} on the phone and ${desktopSlide} on the desktop`);
    // one notch of a wheel (a mouse on the phone page) zooms as on the desktop
    cam.r=100;updateCam();
    layer.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:100,clientX:cx,clientY:cy}));
    if(Math.abs(cam.r/100-desktopWheel)>1e-9)wrong(`one wheel notch zoomed by ${cam.r/100} on the phone and ${desktopWheel} on the desktop`);
    fit('fit');
    // two fingers moving apart to twice the distance halve the distance to the model
    const r0=cam.r;
    pointer(layer,'pointerdown',cx-20,cy,1);pointer(layer,'pointerdown',cx+20,cy,2);
    for(let step=1;step<=4;step++){const half=20+5*step;pointer(layer,'pointermove',cx-half,cy,1);pointer(layer,'pointermove',cx+half,cy,2);}
    if(Math.abs(cam.r-r0/2)>1e-6*r0)wrong(`pinching out to twice the distance gave ${cam.r}, not ${r0/2}`);
    // the two fingers moving together slide the view
    const target0=cam.target.clone();
    pointer(layer,'pointermove',cx-40+60,cy,1);pointer(layer,'pointermove',cx+40+60,cy,2);
    if(cam.target.distanceTo(target0)<1e-6)wrong('two fingers moving together did not slide the view');
    pointer(layer,'pointerup',cx+20,cy,1);pointer(layer,'pointerup',cx+100,cy,2);
    // a tap on the middle of the model selects nothing and changes nothing
    // (sent to whatever is on top at that point, as a real finger would be)
    sel=new Set();
    const under=document.elementFromPoint(cx,cy)||layer;
    pointer(under,'pointerdown',cx,cy);pointer(under,'pointerup',cx,cy);
    under.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:cx,clientY:cy}));
    if(sel.size||JSON.stringify(S.parts)!==keep)wrong('a tap on the model selected or changed it');
    // Reset view is Fit view, stepped back for the upright screen (the holder is 320 x 568)
    fit('fit');
    const desktopR=cam.r;
    phoneFitView();
    if(!(cam.r>desktopR))wrong('Reset view on an upright screen did not step back from Fit view');
    const fitted={r:cam.r,th:cam.th,ph:cam.ph,target:cam.target.clone()};
    cam.th+=1;cam.r*=3;updateCam();
    phone.root.querySelector('.ph-reset').click();
    if(Math.abs(cam.r-fitted.r)>1e-9||Math.abs(cam.th-fitted.th)>1e-9||Math.abs(cam.ph-fitted.ph)>1e-9||cam.target.distanceTo(fitted.target)>1e-9)wrong('Reset view did not give the fitted view');
  });
});

/* 5. A "stop" is not built and says why in the desktop's words; a "warn" builds after Build anyway; the phone never
   asks the desktop's "Replace the design on screen?" question. */
SELFTESTS.push(function phoneStopIsNotBuilt(problems){
  const wrong=text=>problems.push('phone stop: '+text);
  const asked=[],askConfirm0=window.askConfirm;
  window.askConfirm=function(message,options,onYes){asked.push(String(message));return askConfirm0.apply(this,arguments);};
  const madeUp={name:'Self-check phone warn',desc:'',spec:'self-check',build:p=>[mk('Board','1x4',[p.W||20,.75,3.5],[0,0,0])],
    params:[num('W','Width',20,10,30)],check:()=>[{level:'warn',text:'This is a made-up warning.',fix:'Nothing to change.'}]};
  try{
    phoneCheckAround(root=>{
      const shed=phoneEntryOf('Shed');
      if(!shed||!phoneOpenSizes(shed))return wrong('the Shed cannot be opened');
      const roof=$('#presetForm [data-k="roof"]'),pitch=$('#presetForm [data-k="pitch"]'),depth=$('#presetForm [data-k="D"]');
      if(!roof||!pitch||!depth)return wrong('the Shed form has no roof, pitch or depth box');
      roof.value='lean';roof.dispatchEvent(new Event('change',{bubbles:true}));
      pitch.value='12';pitch.dispatchEvent(new Event('input',{bubbles:true}));pitch.dispatchEvent(new Event('change',{bubbles:true}));
      depth.click();
      ['1','4','4','done'].forEach(word=>phonePadKey(word));
      const vals=readVals(false);
      if(!vals||vals.roof!=='lean'||vals.pitch!==12||vals.D!==144)return wrong('the phone controls did not set roof lean, pitch 12, depth 144: '+JSON.stringify(vals));
      showPresetSummary();
      const desktop=findingsHtml(speakAsBoxes(()=>checkPreset(curPreset,vals,null,{maxPieces:LIVE_CHECK_MAX_PIECES})).shown,false);
      if(!/stop/.test(desktop))wrong('these sizes no longer give a stop, so this check proves nothing');
      const drawn=document.createElement('div');   // (the HTML as the browser writes it back, as the box holds it)
      drawn.innerHTML=desktop;
      if($('#presetCheck').innerHTML!==drawn.innerHTML)wrong('the warning box on the phone is not the desktop\'s');
      const sets=S.nextSet||0;
      autoMessages.length=0;
      root.querySelector('.ph-build').click();
      const said=autoMessages.splice(0);
      if((S.nextSet||0)!==sets)wrong('a design with a stop was built');
      if(!said.length||!said[0].startsWith(CANNOT_BUILD_TITLE+': '))wrong('Build it did not give the desktop\'s message: '+said.join(' | '));
      // a made-up preset with one warning builds after Build anyway (autoConfirm answers it)
      // (taken out again before phoneCheckAround puts the form and the tiles back)
      PRESETS.push(madeUp);
      try{
        if(!phoneOpenSizes('preset:'+madeUp.name))return wrong('the made-up preset cannot be opened');
        asked.length=0;
        root.querySelector('.ph-build').click();
        if((S.nextSet||0)!==sets+1||!S.parts.length)wrong('a design with only a warning was not built after Build anyway');
        if(!asked.some(text=>/made-up warning/.test(text)))wrong('Build anyway was not asked for a warning');
        // a second build replaces the first without the desktop's question
        root.querySelector('[data-ph="sizes"]').click();
        root.querySelector('.ph-build').click();
        if(asked.some(text=>/Replace the design on screen/.test(text)))wrong('the phone asked "Replace the design on screen?"');
        if(phone.screen!=='result')wrong('after building, the phone is not on the Result screen');
      }finally{
        const at=PRESETS.indexOf(madeUp);
        if(at>=0)PRESETS.splice(at,1);
      }
    });
  }finally{
    window.askConfirm=askConfirm0;
    const at=PRESETS.indexOf(madeUp);
    if(at>=0)PRESETS.splice(at,1);
    autoMessages.length=0;
  }
});
