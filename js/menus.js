/* WoodShop Designer: the menu bar, commands and keyboard shortcuts.
   To add a menu item later: add a <button> inside a .mlist in index.html with ONE of these attributes:
     data-click="#someButtonId"   presses an existing button (keeps one source of truth for what the action does)
     data-cmd="name"              runs COMMANDS.name below
     data-view / data-tool        handled in app.js, same as the toolbar buttons */
'use strict';
const COMMANDS={
  duplicate:()=>dupSel(),
  remove:()=>delSel(),
  selectAll:()=>selectAllVisible(),
  viewReal:()=>setViewMode('real'),
  viewBlock:()=>setViewMode('block'),
  toggleFasteners:()=>$('#showFast').click(),
  toggleSizes:()=>$('#showDims').click(),
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
function setViewMode(m){const s=$('#viewMode');s.value=m;s.dispatchEvent(new Event('change'));}
const closeMenus=()=>document.querySelectorAll('.menu.open').forEach(m=>m.classList.remove('open'));
$('#menubar').addEventListener('click',e=>{
  const top=e.target.closest('.mbtn');
  if(top){const m=top.parentElement,was=m.classList.contains('open');closeMenus();if(!was)m.classList.add('open');return;}
  const item=e.target.closest('.mlist button');if(!item)return;
  closeMenus();
  if(item.dataset.click)$(item.dataset.click).click();
  else if(item.dataset.cmd&&COMMANDS[item.dataset.cmd]){if(tab!=='design'&&item.dataset.design)setTab('design');COMMANDS[item.dataset.cmd]();}
});
// hovering another menu name while one is open switches to it, like a desktop program
$('#menubar').addEventListener('mouseover',e=>{const top=e.target.closest('.mbtn');
  if(top&&document.querySelector('.menu.open')&&!top.parentElement.classList.contains('open')){closeMenus();top.parentElement.classList.add('open');}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#menubar'))closeMenus();});
$('#bHelpClose').onclick=()=>$('#helpDlg').close();
window.addEventListener('keydown',e=>{
  const c=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(k==='escape')closeMenus();
  if(c&&k==='s'){e.preventDefault();$('#bSave').click();}
  else if(c&&k==='p'){e.preventDefault();$('#bPrint').click();}
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
const CTX_SEL=[['move','Move','M'],['rotate','Rotate','R'],['stretch','Stretch (change length)','S'],null,
  ['duplicate','Duplicate','Ctrl+D'],['dupGrab','Duplicate and drag','Shift+D'],['row','Copy in a row…',''],['mirror','Mirror…','Ctrl+M'],null,
  ['group','Group','Ctrl+G'],['ungroup','Ungroup','Ctrl+Shift+G'],['similar','Select all pieces like this','Shift+G'],null,
  ['hide','Hide','H'],['isolate','Show only these','Shift+H'],['focus','Zoom to these','F'],null,['remove','Delete','Del']];
const CTX_NONE=[['preset','Furniture preset…',''],['draw','Draw a board','D'],null,
  ['showAll','Show everything','Alt+H'],['fit','Fit everything on screen','Home'],['xray','See-through view on / off','Alt+Z'],['explode','Exploded view on / off','']];
function openContext(x,y,hitId){
  if(tab!=='design'||modal)return;
  if(hitId&&!sel.has(hitId)){sel=new Set(groupIds(hitId));renderAll();}
  const el=$('#ctxMenu');
  el.innerHTML=(sel.size?CTX_SEL:CTX_NONE).map(i=>i?`<button data-cmd="${i[0]}">${i[1]}<kbd>${i[2]}</kbd></button>`:'<hr>').join('');
  el.style.display='block';el.style.left=Math.min(x,innerWidth-el.offsetWidth-8)+'px';el.style.top=Math.min(y,innerHeight-el.offsetHeight-8)+'px';
}
const closeContext=()=>{$('#ctxMenu').style.display='none';};
$('#ctxMenu').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;closeContext();COMMANDS[b.dataset.cmd]();});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#ctxMenu'))closeContext();});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeContext();});
// toolbar buttons can run the same commands as menu items
document.querySelectorAll('#viewBtns [data-cmd]').forEach(b=>b.onclick=()=>COMMANDS[b.dataset.cmd]());
