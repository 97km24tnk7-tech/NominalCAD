/* NominalCAD: pulldown menus, commands, keyboard shortcuts and the right-click menu.

   A pulldown can sit anywhere on the page (the File button, the "More" button of a ribbon group, Display):
       <div class="pd">
         <button class="pd-btn">File</button>
         <div class="menu"> ...rows... </div>        (or class="pop" for a small panel of settings)
       </div>
   Clicking the button opens it under its bar; clicking outside or pressing Esc closes it; while one is open,
   pointing at another opens that one instead.

   To add a command anywhere (a menu row, a ribbon button, a status-bar chip), give a <button> ONE of these:
     data-cmd="name"              runs COMMANDS.name below
     data-click="#someButtonId"   presses an existing button (keeps one source of truth for what the action does)
     data-view / data-tool        handled in app.js
   A menu row looks like:  <button class="mi" data-cmd="hide"><i></i><span>Hide selected</span><kbd>H</kbd></button>
   (the first cell is an icon, or an empty <i> that shows a tick when the command has a row in CHECKS).
   Add data-keep to a row that should leave its panel open after the click (the switches in Display).
   To grey a command out while it cannot be used, give it a row in ENABLED. */
'use strict';
const COMMANDS={
  duplicate:()=>dupSel(),
  remove:()=>picked?deletePicked():delSel(), // a picked fastener or piece of hardware goes first: js/viewpick.js
  selectAll:()=>selectAllVisible(),
  viewReal:()=>setViewMode('real'),
  viewBlock:()=>setViewMode('block'),
  toggleFasteners:()=>$('#showFast').click(),
  toggleSizes:()=>$('#showDims').click(),
  toggleLegend:()=>toggleLegend(),
  dupGrab:()=>dupGrab(),
  row:()=>openRow(),
  mirror:()=>openMirror(),
  togglePieces:()=>togglePanel('left'),
  toggleProps:()=>togglePanel('right'),
  resetPanels:()=>resetPanels(),
  move:()=>startModal('g'),rotate:()=>startModal('r'),stretch:()=>startModal('s'),
  makeComponent:()=>makeComponent(),breakApart:()=>breakApart(),similar:()=>selectSimilar(), // js/components.js
  unfasten:()=>unfastenSel(),                                                                 // js/unfasten.js
  hide:()=>hideSel(),isolate:()=>isolateSel(),showAll:()=>showAll(),focus:()=>focusSel(),
  woodSolid:()=>setWoodMode('solid'),woodThrough:()=>setWoodMode('through'),woodFast:()=>setWoodMode('fast'), // js/viewmodes.js
  xray:()=>toggleWoodMode('through'),fastOnly:()=>toggleWoodMode('fast'),
  explode:()=>setExplode(explode?0:.55),
  hang:()=>openHang(),                                                               // js/hanging.js
  slides:()=>mountDrawerOfSel(),drawer:()=>openDrawerDialog(),                       // js/drawertool.js
  openAll:()=>setAllOpen(1),closeAll:()=>setAllOpen(0),                              // js/motion.js
  stepMode:()=>toggleStepMode(),                                                     // Build step by step: js/stepmode.js
  fit:()=>fit('fit'),preset:()=>$('#bPreset').click(),draw:()=>setTool('draw'),
  check:()=>checkDesign(), // "will it stand?": js/checkui.js shows what js/verify.js finds
  help:()=>$('#helpDlg').showModal(),
  updatePrices:()=>updatePricesClicked(),priceBook:()=>openPriceBook(),pastePrices:()=>openPastePrices(), // js/prices.js
};
/* commands that are switches: is the thing on right now? Their menu rows get a tick, their buttons the "on" look. */
const CHECKS={
  stepMode:()=>!!stepMode,
  viewReal:()=>viewMode==='real',
  viewBlock:()=>viewMode==='block',
  woodSolid:()=>woodMode==='solid',
  woodThrough:()=>woodMode==='through',
  woodFast:()=>woodMode==='fast',
  xray:()=>woodMode==='through',
  fastOnly:()=>woodMode==='fast',
  explode:()=>!!explode,
  toggleFasteners:()=>$('#showFast').checked,
  toggleSizes:()=>$('#showDims').checked,
  toggleLegend:()=>legendOn,
  togglePieces:()=>!panelOf('left').off,
  toggleProps:()=>!panelOf('right').off,
};
/* commands that only make sense some of the time: can it be used right now? While the answer is no, every
   button and menu row of the command is greyed out. A command that is not listed can always be used. */
const somethingSelected=()=>sel.size>0;
const ENABLED={
  stepMode:()=>S.parts.length>0,
  remove:()=>sel.size>0||!!picked,
  hang:()=>canHang(),                                   // one door or lid is selected (js/hanging.js)
  slides:()=>sel.size>0,
  openAll:()=>movers().some(m=>!m.stuck&&m.open<1),     // something can still be opened (js/motion.js)
  closeAll:()=>movers().some(m=>m.open>0),
  duplicate:somethingSelected,
  dupGrab:somethingSelected,
  row:somethingSelected,
  mirror:somethingSelected,
  move:somethingSelected,
  rotate:somethingSelected,
  stretch:()=>sel.size===1&&!isProp(selParts()[0]),   // one board at a time
  hide:somethingSelected,
  isolate:somethingSelected,
  similar:somethingSelected,
  makeComponent:somethingSelected,
  breakApart:()=>selParts().some(p=>p.comp!=null),      // something selected is inside a component
  unfasten:()=>canUnfasten(),                           // the selection is fastened to something outside it
  selectAll:()=>S.parts.length>0,
  showAll:()=>hiddenIds.size>0,
  toggleLegend:()=>viewMode==='block',                // the color key explains the Color blocks look
  updatePrices:()=>canUpdatePrices(),                 // not while it is already asking, and never in the hosted copy
};
function setViewMode(m){const s=$('#viewMode');s.value=m;s.dispatchEvent(new Event('change'));}

/* Shows the current state on every control: ticks in menus, "on" buttons, the current tool, and which commands
   can be used right now. renderAll() calls it after every change to the design or the selection. */
function syncChecks(){
  document.querySelectorAll('[data-cmd]').forEach(el=>{
    const cmd=el.dataset.cmd;
    if(CHECKS[cmd])el.classList.toggle(el.classList.contains('mi')?'checked':'on',!!CHECKS[cmd]());
    if(ENABLED[cmd])el.disabled=!ENABLED[cmd]();
  });
  // a row that presses another button (data-click) can be used exactly when that button can
  document.querySelectorAll('[data-click]').forEach(el=>{
    const target=$(el.dataset.click);
    if(target)el.disabled=target.disabled;
  });
  document.querySelectorAll('.mi[data-tool]').forEach(el=>el.classList.toggle('checked',el.dataset.tool===tool));
  $('#bDisplay').classList.toggle('on',woodMode!=='solid'||!!explode); // Display looks "on" while a special view is: see-through, fasteners only or exploded
}

/* ---------- pulldowns ---------- */
function closeMenus(){
  document.querySelectorAll('.pd.open').forEach(pd=>pd.classList.remove('open'));
}
function openMenu(pd){
  closeMenus();
  closeContext();
  syncChecks();
  pd.classList.add('open');
  // hang the list under the bar its button sits in (so it is flush with the ribbon), and keep it on screen
  const button=pd.querySelector('.pd-btn'),list=pd.querySelector('.menu,.pop'),bar=button.closest('.ribbon,.tabrow');
  const b=button.getBoundingClientRect(),top=bar?bar.getBoundingClientRect().bottom-1:b.bottom;
  list.style.top=top+'px';
  list.style.left=Math.max(0,Math.min(b.left,innerWidth-list.offsetWidth-4))+'px';
  list.style.maxHeight=(innerHeight-top-8)+'px';
}
/* before anything else reacts to a click: put away the menu the click came from */
document.addEventListener('click',e=>{
  const button=e.target.closest('button');
  if(!button||button.classList.contains('pd-btn'))return;
  if(button.closest('.menu,.pop')&&!button.hasAttribute('data-keep')){closeMenus();closeContext();}
},true);
document.addEventListener('click',e=>{
  const opener=e.target.closest('.pd-btn');
  if(opener){
    const pd=opener.closest('.pd');
    if(pd.classList.contains('open'))closeMenus();else openMenu(pd);
    return;
  }
  const el=e.target.closest('[data-cmd],[data-click]');
  if(el&&!el.disabled){
    if(el.dataset.click)$(el.dataset.click).click();
    else if(COMMANDS[el.dataset.cmd])COMMANDS[el.dataset.cmd]();
  }
  if(document.querySelector('.pd.open'))syncChecks(); // a panel that stayed open shows its new state
});
// pointing at another pulldown while one is open switches to it, like a desktop program
document.addEventListener('mouseover',e=>{
  const opener=e.target.closest('.pd-btn');
  if(!opener)return;
  const pd=opener.closest('.pd'),open=document.querySelector('.pd.open');
  if(open&&open!==pd)openMenu(pd);
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.pd'))closeMenus();});
// Esc closes an open menu and does nothing else (it does not also drop the tool or the selection)
window.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(!document.querySelector('.pd.open')&&$('#ctxMenu').style.display!=='block')return;
  closeMenus();closeContext();
  e.stopImmediatePropagation();
},true);

/* ---------- keyboard shortcuts (Ctrl+Z, Ctrl+D, arrows, D, C, Delete and M / R / S are in app.js and transform.js) ---------- */
window.addEventListener('keydown',e=>{
  const c=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(c&&k==='s'){e.preventDefault();$('#bSave').click();}
  else if(c&&k==='p'){e.preventDefault();$('#bPrint').click();}
  else if(k==='f1'){e.preventDefault();if(!document.querySelector('dialog[open]'))COMMANDS.help();}
  else if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)||document.querySelector('dialog[open]')||modal||tab!=='design')return;
  // THE RULE FOR A NEW KEY (the owner's): the first letter of the command, as M, R, S, D, C, U and H are. When
  // the plain letter is taken, Shift + that letter (Shift+S See-through, Shift+F Fasteners only, Shift+M Make
  // component, Shift+B Break apart, Shift+C Check my design), then Ctrl or Alt + that letter (Ctrl+M Mirror,
  // Alt+O Open all). The self-check hotkeysFollowFirstLetters reads the keys shown in the menus against this.
  // (Ctrl+G, Ctrl+Shift+G, Alt+Z and Alt+X still work for hands that learned them; no menu shows them.)
  else if(c&&k==='g'){e.preventDefault();e.shiftKey?breakApart():makeComponent();}
  else if(c&&k==='m'){e.preventDefault();openMirror();}
  else if(c)return;                                                   // every other Ctrl combination belongs to app.js or the browser
  else if(e.altKey&&k==='h'){e.preventDefault();showAll();}           // Alt+H  show everything
  else if(e.altKey&&k==='z'){e.preventDefault();toggleWoodMode('through');}
  else if(e.altKey&&k==='x'){e.preventDefault();toggleWoodMode('fast');}
  else if(e.altKey&&k==='o'){e.preventDefault();setAllOpen(movers().some(m=>m.open>0)?0:1);} // Alt+O  open or close all doors and drawers
  else if(e.altKey)return;
  else if(e.shiftKey&&k==='s'){e.preventDefault();toggleWoodMode('through');} // Shift+S  See-through view
  else if(e.shiftKey&&k==='f'){e.preventDefault();toggleWoodMode('fast');}    // Shift+F  Fasteners only
  else if(e.shiftKey&&k==='m'){e.preventDefault();makeComponent();}           // Shift+M  Make component
  else if(e.shiftKey&&k==='b'){e.preventDefault();breakApart();}              // Shift+B  Break apart
  else if(e.shiftKey&&k==='c'){e.preventDefault();checkDesign();}             // Shift+C  Check my design
  else if(k==='h')e.shiftKey?isolateSel():hideSel();                  // H hide, Shift+H show only the selection
  else if(k==='f')focusSel();                                         // F  zoom to the selection
  else if(k==='u'&&!e.shiftKey)unfastenSel();                         // U  unfasten the selection (asks first)
  else if(e.shiftKey&&k==='g')selectSimilar();                        // Shift+G  select all pieces like this
  else if(e.shiftKey&&k==='d'){e.preventDefault();dupGrab();}         // Shift+D  duplicate and drag
  else if(k==='1')fit('front');else if(k==='3')fit('side');else if(k==='7')fit('top');else if(k==='home')fit('fit');
});

/* ---------- right-click menu on the 3D view ---------- */
/* each row: [command, label, shortcut, icon id (optional)]; null draws a separator */
const CTX_SEL=[['move','Move','M','i-move'],['rotate','Rotate','R','i-rotate'],['stretch','Stretch (change length)','S','i-dim'],null,
  ['duplicate','Duplicate','Ctrl+D','i-dup'],['dupGrab','Duplicate and drag','Shift+D'],['row','Copy in a row…','','i-row'],['mirror','Mirror…','Ctrl+M','i-mirror'],null,
  ['unfasten','Unfasten…','U','i-unfasten'],['hang','Hang this door or lid…','','i-hinge'],['slides','Mount this drawer on slides','','i-hardware'],null,
  ['makeComponent','Make component…','Shift+M','i-comp'],['breakApart','Break apart','Shift+B'],['similar','Select all pieces like this','Shift+G'],null,
  ['hide','Hide','H','i-hide'],['isolate','Show only these','Shift+H'],['focus','Zoom to these','F'],null,['remove','Delete','Del','i-delete']];
const CTX_NONE=[['preset','Furniture preset…','','i-presets'],['draw','Draw a board','D','i-draw'],['drawer','Add a drawer…','','i-hardware'],null,
  ['check','Check my design…','Shift+C','i-verify'],null,
  ['showAll','Show everything','Alt+H'],['fit','Fit everything on screen','Home','i-fit'],['xray','See-through view','Shift+S'],['fastOnly','Fasteners only','Shift+F'],['explode','Exploded view',''],null,
  ['openAll','Open all doors and drawers','Alt+O'],['closeAll','Close all','']];
function openContext(x,y,hitId){
  if(tab!=='design'||modal)return;
  closeMenus();
  if(hitId&&!sel.has(hitId)){sel=new Set(pickIds(hitId));renderAll();}
  const el=$('#ctxMenu');
  el.innerHTML=(sel.size?CTX_SEL:CTX_NONE).map(row=>row
    ?`<button class="mi" data-cmd="${row[0]}">${row[3]?icon(row[3]):'<i></i>'}<span>${row[1]}</span><kbd>${row[2]}</kbd></button>`
    :'<div class="msep"></div>').join('');
  syncChecks();
  el.style.display='block';
  el.style.left=Math.max(4,Math.min(x,innerWidth-el.offsetWidth-8))+'px';
  el.style.top=Math.max(4,Math.min(y,innerHeight-el.offsetHeight-8))+'px';
}
function closeContext(){$('#ctxMenu').style.display='none';}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#ctxMenu'))closeContext();});

syncChecks(); // the state at start-up (the first renderAll ran before this file was loaded)

/* ---------- check: hotkeys follow first letters ----------
   Every key that a menu shows beside a command is the first letter of that command's name (with Shift, Ctrl or
   Alt when the plain letter is taken): Shift+S for See-through view, Shift+M for Make component. The keys in
   KEYS_FROM_BEFORE were in the program before this rule was written down and the owner is used to them; a new
   command does not get added there, it gets a key that follows the rule. */
const KEYS_FROM_BEFORE={isolate:'Shift+H',showAll:'Alt+H',selectAll:'Ctrl+A',focus:'F',similar:'Shift+G'};
SELFTESTS.push(function hotkeysFollowFirstLetters(problems){
  const shown=[];   // [command, label, key] for every menu row with a key
  for(const row of document.querySelectorAll('button.mi[data-cmd]')){
    const key=row.querySelector('kbd'),label=row.querySelector('span');
    if(key&&label&&key.textContent.trim())shown.push([row.dataset.cmd,label.textContent,key.textContent.trim()]);
  }
  for(const row of[...CTX_SEL,...CTX_NONE])if(row&&row[2])shown.push([row[0],row[1],row[2]]);
  const keysOf=new Map();
  for(const[command,label,key]of shown){
    if(!keysOf.has(command))keysOf.set(command,new Set());
    keysOf.get(command).add(key);
    const letter=key.split('+').pop();
    if(!/^[A-Z]$/.test(letter)||KEYS_FROM_BEFORE[command]===key)continue;   // Del, Esc, Home and the like name themselves
    if(label.trim()[0].toUpperCase()!==letter)problems.push(`hotkeys: "${label}" is on ${key}, which is not its first letter`);
  }
  for(const[command,keys]of keysOf)if(keys.size>1)problems.push(`hotkeys: the command "${command}" is shown with two different keys: ${[...keys].join(' and ')}`);
  // and the keys do what the menus say (tried on the ones that only change the view)
  const modeKept=woodMode,tabKept=tab;
  const press=(key,shift)=>window.dispatchEvent(new KeyboardEvent('keydown',{key,shiftKey:!!shift,bubbles:true,cancelable:true}));
  try{
    setTab('design');
    if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
    setWoodMode('solid');
    press('S',true);
    if(woodMode!=='through')problems.push('hotkeys: Shift+S does not switch to the See-through view');
    press('F',true);
    if(woodMode!=='fast')problems.push('hotkeys: Shift+F does not switch to Fasteners only');
    press('F',true);
    if(woodMode!=='solid')problems.push('hotkeys: Shift+F a second time does not go back to solid wood');
  }finally{
    setWoodMode(modeKept);
    setTab(tabKept);
    if($('#toast'))$('#toast').classList.remove('on');
  }
});
