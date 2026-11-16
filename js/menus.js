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
   A button inside an element marked data-design switches to the Design tab before it runs. */
'use strict';
const COMMANDS={
  duplicate:()=>dupSel(),
  remove:()=>delSel(),
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
  group:()=>groupSel(),ungroup:()=>ungroupSel(),similar:()=>selectSimilar(),
  hide:()=>hideSel(),isolate:()=>isolateSel(),showAll:()=>showAll(),focus:()=>focusSel(),
  xray:()=>toggleXray(),explode:()=>setExplode(explode?0:.55),
  fit:()=>fit('fit'),preset:()=>$('#bPreset').click(),draw:()=>setTool('draw'),
  help:()=>$('#helpDlg').showModal(),
};
/* commands that are switches: is the thing on right now? Their menu rows get a tick, their buttons the "on" look. */
const CHECKS={
  viewReal:()=>viewMode==='real',
  viewBlock:()=>viewMode==='block',
  xray:()=>xray,
  explode:()=>!!explode,
  toggleFasteners:()=>$('#showFast').checked,
  toggleSizes:()=>$('#showDims').checked,
  toggleLegend:()=>legendOn,
  togglePieces:()=>!panelOf('left').off,
  toggleProps:()=>!panelOf('right').off,
};
/* commands that only make sense some of the time: can it be used right now? */
const ENABLED={
  toggleLegend:()=>viewMode==='block', // the color key explains the Color blocks look
};
function setViewMode(m){const s=$('#viewMode');s.value=m;s.dispatchEvent(new Event('change'));}

/* show the current state on every switch-like control: ticks in menus, "on" buttons, the current tool */
function syncChecks(){
  document.querySelectorAll('[data-cmd]').forEach(el=>{
    const cmd=el.dataset.cmd;
    if(CHECKS[cmd])el.classList.toggle(el.classList.contains('mi')?'checked':'on',!!CHECKS[cmd]());
    if(ENABLED[cmd])el.disabled=!ENABLED[cmd]();
  });
  document.querySelectorAll('.mi[data-tool]').forEach(el=>el.classList.toggle('checked',el.dataset.tool===tool));
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
/* before anything else reacts to a click: put away the menu the click came from, and go to the Design tab
   when the control only makes sense there */
document.addEventListener('click',e=>{
  const button=e.target.closest('button');
  if(!button||button.classList.contains('pd-btn'))return;
  if(button.closest('.menu,.pop')&&!button.hasAttribute('data-keep')){closeMenus();closeContext();}
  if(tab!=='design'&&button.closest('[data-design]'))setTab('design');
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
  else if(c&&k==='g'){e.preventDefault();e.shiftKey?ungroupSel():groupSel();}
  else if(c&&k==='m'){e.preventDefault();openMirror();}
  else if(c)return;                                                   // every other Ctrl combination belongs to app.js or the browser
  else if(e.altKey&&k==='h'){e.preventDefault();showAll();}           // Alt+H  show everything
  else if(e.altKey&&k==='z'){e.preventDefault();toggleXray();}        // Alt+Z  see-through view
  else if(e.altKey)return;
  else if(k==='h')e.shiftKey?isolateSel():hideSel();                  // H hide, Shift+H show only the selection
  else if(k==='f')focusSel();                                         // F  zoom to the selection
  else if(e.shiftKey&&k==='g')selectSimilar();                        // Shift+G  select all pieces like this
  else if(e.shiftKey&&k==='d'){e.preventDefault();dupGrab();}         // Shift+D  duplicate and drag
  else if(k==='1')fit('front');else if(k==='3')fit('side');else if(k==='7')fit('top');else if(k==='home')fit('fit');
});

/* ---------- right-click menu on the 3D view ---------- */
/* each row: [command, label, shortcut, icon id (optional)]; null draws a separator */
const CTX_SEL=[['move','Move','M','i-move'],['rotate','Rotate','R','i-rotate'],['stretch','Stretch (change length)','S','i-dim'],null,
  ['duplicate','Duplicate','Ctrl+D','i-dup'],['dupGrab','Duplicate and drag','Shift+D'],['row','Copy in a row…','','i-row'],['mirror','Mirror…','Ctrl+M','i-mirror'],null,
  ['group','Group','Ctrl+G'],['ungroup','Ungroup','Ctrl+Shift+G'],['similar','Select all pieces like this','Shift+G'],null,
  ['hide','Hide','H','i-hide'],['isolate','Show only these','Shift+H'],['focus','Zoom to these','F'],null,['remove','Delete','Del','i-delete']];
const CTX_NONE=[['preset','Furniture preset…','','i-presets'],['draw','Draw a board','D','i-draw'],null,
  ['showAll','Show everything','Alt+H'],['fit','Fit everything on screen','Home','i-fit'],['xray','See-through view','Alt+Z'],['explode','Exploded view','']];
function openContext(x,y,hitId){
  if(tab!=='design'||modal)return;
  closeMenus();
  if(hitId&&!sel.has(hitId)){sel=new Set(groupIds(hitId));renderAll();}
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
