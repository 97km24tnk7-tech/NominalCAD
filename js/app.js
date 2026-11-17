/* NominalCAD: tabs, the File menu and ribbon actions, the dialogs that belong to them, and start-up.
   (The dialog pattern and askConfirm / showMessage are in dialogs.js; Copy in a row and Mirror are in transform.js.) */
'use strict';
/* ---------- tabs ---------- */
let tab='design';
document.body.dataset.tab=tab; // the style sheet shows and hides things by tab (the hosted page has no <body> tag of its own to say this)
const TAB_PAGES={design:'#designPage',joints:'#jointsPage',cut:'#cutPage',instr:'#instrPage'};
function setTab(t){
  if(t!=='design'&&stepMode)endStepMode();   // Build step by step belongs to the 3D view (js/stepmode.js)
  tab=t;
  if(t!=='design'){spotlightIds=null;spotlightWord='';}   // "Show me" (js/visibility.js) belongs to the 3D view
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  document.body.dataset.tab=t; // the style sheet shows and hides things by tab
  if(t==='cut')renderCut();
  if(t==='instr')renderCut(true);
  for(const[name,page]of Object.entries(TAB_PAGES))$(page).style.display=name!==t?'none':name==='design'?'flex':'block';
  if(t==='joints')renderJoints();
  if(t==='design'){resize();syncPanels();} // the 3D view had no size while it was hidden
  renderStatus();
  if(window.syncRibbonEdge)syncRibbonEdge(); // the ribbon shows other groups on this tab (defined further down; missing during start-up)
  if(window.countVisitTab)countVisitTab(t); // the public site counts the first opening of a document tab (js/visits.js)
}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
$('#bBack').onclick=()=>setTab('design'); // "Back to design" in the ribbon of the document tabs
function renderAll(){
  const empty=!S.parts.length;
  $('#projName').value=S.name;
  document.title=S.name+' - NominalCAD';
  $('#bUndo').disabled=!undoStack.length;
  $('#bRedo').disabled=!redoStack.length;
  $('#bInstr').disabled=$('#bStyle').disabled=empty; // nothing to style or print until there is a piece
  document.querySelectorAll('[data-doc]').forEach(button=>button.disabled=empty); // the same for Print and Style & finish on the document tabs
  rebuildScene();renderParts();renderProps();renderStatus();syncPanels();
  if(tab==='joints')renderJoints();if(tab==='cut')renderCut();if(tab==='instr')renderCut(true);
  if(window.syncChecks)syncChecks(); // menus.js: greys out what cannot be used now (it loads after this file, so it is missing during start-up)
}
$('#projName').onchange=e=>{S.name=e.target.value.trim()||'My project';commit();};
$('#addMat').innerHTML=MATS.filter(m=>m.kind!=='prop').map(m=>`<option value="${m.id}"${m.id==='2x4'?' selected':''}>${esc(m.name)}</option>`).join('');
$('#bAdd').onclick=()=>{const m=M[$('#addMat').value],b=bbox(S.parts),x=b?b.hi[0]+3:0,z=b?b.lo[2]:0;
  const p=m.kind==='board'?mk(m.short+' piece',m.id,[24,m.t,m.w],[x,0,z]):mk('Panel',m.id,[24,m.t,24],[x,0,z]);
  sel=new Set(addParts([p]));commit();};
/* add a fish tank by hand: a see-through box that carries its gallons so the weight total stays right */
$('#addTank').innerHTML=TANK_OPTS.map(([k,l])=>`<option value="${k}"${k==='g20h'?' selected':''}>${esc(l)} tank</option>`).join('');
$('#bAddTank').onclick=()=>{const t=TANKS[$('#addTank').value],b=bbox(S.parts),p=mk('Tank','tank',[t[0],t[2],t[1]],[b?b.hi[0]+3:0,0,b?b.lo[2]:0]);
  p.gal=t[3];sel=new Set(addParts([p]));commit();};

/* ---------- Import a cut list: pieces typed or pasted from another plan, one per line ---------- */
function matchMat(s){s=s.toLowerCase().replace(/\s+/g,'');const m=s.match(/(\d)x(\d+)/);if(m&&M[m[1]+'x'+m[2]])return m[1]+'x'+m[2];
  if(/ply|osb|sheet|panel/.test(s))return/1\/4|\.25/.test(s)?'ply14':/1\/2|\.5/.test(s)?'ply12':'ply34';return null;}
$('#bImportCut').onclick=()=>{$('#cutErr').textContent='';$('#cutDlg').showModal();};
$('#bCutGo').onclick=()=>{const bad=[],parts=[],b=bbox(S.parts);let z=b?b.lo[2]:0;const x=b?b.hi[0]+6:0;
  for(const raw of $('#cutText').value.split('\n')){const line=raw.trim();if(!line)continue;
    const f=line.split(/[,\t;]+/).map(s=>s.trim()),qty=parseInt(f[0],10),mat=f[2]&&matchMat(f[2]),len=parseLen(f[3]||''),wid=parseLen(f[4]||'');
    if(f.length<4||!(qty>0)||qty>500||!f[1]||!mat||!(len>0)){bad.push(line);continue;}
    const m=M[mat],w=m.kind==='board'?(wid>0?Math.min(wid,m.w):m.w):(wid>0?wid:len);
    for(let i=0;i<qty;i++){const p=mk(f[1],mat,[len,m.t,w],[x,0,z]);p.l=r16(len);p.w=r16(w);p.t=m.t;p.ax=[0,2,1];parts.push(p);z+=w+1;}}
  if(!parts.length){$('#cutErr').textContent='No lines could be read. Each line needs a quantity, a name, a material and a length.';return;}
  sel=new Set(addParts(parts));$('#cutDlg').close();setTab('design');commit();fit('fit');
  if(bad.length)showMessage('Some lines were skipped',
    `Added ${parts.length} piece${parts.length>1?'s':''}. ${bad.length>1?'These lines':'This line'} could not be read:\n\n${bad.join('\n')}`);};

$('#bUndo').onclick=undo;$('#bRedo').onclick=redo;

/* ---------- File: New design ---------- */
function newDesign(){load(JSON.stringify(blank()));fit('fit');}
$('#bNew').onclick=()=>{
  if(!S.parts.length){newDesign();return;}
  askConfirm('Start a new, empty design? The design on screen is cleared. Save it first (File, then Save) if you want to keep it.',
    {title:'New design',action:'Start a new design',danger:true},newDesign);
};

/* ---------- My projects: named designs kept in this browser ---------- */
const getProjects=()=>{try{return JSON.parse(localStorage.getItem('woodshop.projects'))||{};}catch(e){return{};}};
function putProjects(projects){
  try{localStorage.setItem('woodshop.projects',JSON.stringify(projects));return true;}
  catch(e){
    showMessage('Could not save','This browser would not store the project (its storage is full or turned off). '+KEEP_ADVICE);
    return false;
  }
}
function renderProjects(){
  const projects=getProjects(),names=Object.keys(projects).sort((a,b)=>projects[b].t-projects[a].t);
  if(!names.length){
    $('#projList').innerHTML='<p class="dlg-msg">Nothing saved yet. Click File, then Save, to keep the design you are working on.</p>';
    return;
  }
  const rows=names.map(name=>{
    const saved=projects[name];
    return`<tr><td><b>${esc(name)}</b></td><td class="num">${saved.n}</td><td class="nowrap">${new Date(saved.t).toLocaleDateString()}</td>`+
      `<td class="act"><button class="btn s" data-open="${esc(name)}">Open</button><button class="btn s dng" data-del="${esc(name)}">Delete</button></td></tr>`;
  }).join('');
  $('#projList').innerHTML=`<table class="tbl"><thead><tr><th>Project</th><th class="num">Pieces</th><th>Saved</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}
function saveProject(){
  const projects=getProjects();
  projects[S.name]={t:Date.now(),n:S.parts.length,json:JSON.stringify(S)};
  if(putProjects(projects))toast('Saved "'+S.name+'" to My projects');
}
$('#bSave').onclick=saveProject;
$('#bOpen').onclick=()=>{renderProjects();$('#projDlg').showModal();};
$('#projList').onclick=e=>{
  const button=e.target.closest('button');
  if(!button)return;
  const projects=getProjects(),open=button.dataset.open,del=button.dataset.del;
  if(open&&projects[open]){
    load(projects[open].json);fit('fit');
    $('#projDlg').close();setTab('design');
  }
  if(del){
    askConfirm(`Delete "${del}" from My projects? This cannot be undone.`,{title:'Delete a saved project',action:'Delete',danger:true},()=>{
      const left=getProjects();
      delete left[del];
      putProjects(left);
      renderProjects();
    });
  }
};
/* (Download as a file, Load from a file, Copy design as text and Paste design from text are in transfer.js.) */

/* ---------- File: Print instructions. printPage (hosted.js) opens the print window, or explains why it cannot. ---------- */
$('#bPrint').onclick=()=>{
  setTab('instr');
  setTimeout(printPage,300); // a moment for the pictures of the design to be drawn
};
$('#bInstr').onclick=()=>setTab('instr');

/* ---------- Style, finish and difficulty (the dialog is drawn by renderStyle in style.js) ---------- */
function openStyle(){renderStyle();$('#styleDlg').showModal();}
$('#bStyle').onclick=openStyle;
$('#styleCards').onchange=e=>{
  if(e.target.name!=='lookStyle')return;
  look().style=e.target.value;commit();renderStyle();
  const picked=$('#styleCards input:checked');if(picked)picked.focus(); // the cards were redrawn; keep the keyboard on the choice
};
$('#woodSel').onchange=e=>{look().wood=e.target.value;commit();renderStyle();};
$('#finSel').onchange=e=>{look().finish=e.target.value;commit();renderStyle();};

$('#showFast').onchange=rebuildScene;$('#showDims').onchange=rebuildScene;
$('#viewMode').value=viewMode;$('#viewMode').onchange=e=>{viewMode=e.target.value;try{localStorage.setItem('woodshop.view',viewMode);}catch(err){}rebuildScene();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>fit(b.dataset.view));
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
/* In a window too narrow for the whole ribbon, the ribbon scrolls sideways inside its own strip (style.css,
   section 13). The strip shows no scroll bar, so the mouse wheel turns it. */
$('#ribbon').addEventListener('wheel',e=>{
  const ribbon=e.currentTarget;
  if(e.target.closest('.menu,.pop'))return;                   // the wheel is over an open pulldown, which scrolls by itself
  if(ribbon.scrollWidth<=ribbon.clientWidth||e.deltaX)return; // everything fits, or the wheel already goes sideways
  closeMenus(); // an open pulldown would be left behind by its button
  ribbon.scrollLeft+=e.deltaY;
  e.preventDefault();
},{passive:false});
/* While part of the ribbon is off screen to the right, its right edge fades out (class "more" in the style sheet)
   to say that there are more commands that way. */
function syncRibbonEdge(){
  const ribbon=$('#ribbon');
  ribbon.classList.toggle('more',ribbon.scrollLeft+ribbon.clientWidth<ribbon.scrollWidth-1);
}
$('#ribbon').addEventListener('scroll',syncRibbonEdge);
window.addEventListener('resize',syncRibbonEdge);
/* No command of the ribbon is ever cut off. In a window RIBBON_FITS_FROM wide or wider the whole ribbon of every
   tab fits (the widths at which the style sheet makes it more compact are measured for that: css/style.css,
   section 13). In a narrower window it scrolls inside its strip, and the fade says that there is more. */
const RIBBON_FITS_FROM=1115;
SELFTESTS.push(function ribbonIsNeverCutOff(problems){
  const ribbon=$('#ribbon'),tabKept=tab;
  try{
    for(const name of['design','cut','instr']){
      setTab(name);
      const over=ribbon.scrollWidth-ribbon.clientWidth;
      if(!/auto|scroll/.test(getComputedStyle(ribbon).overflowX))problems.push(`ribbon: on the ${name} tab what does not fit is cut off, and the strip cannot be scrolled`);
      if(over>1&&innerWidth>=RIBBON_FITS_FROM)problems.push(`ribbon: in a window ${innerWidth} px wide the ribbon of the ${name} tab is ${over} px too wide. Move the widths in section 13 of css/style.css to where it stops fitting`);
      syncRibbonEdge();
      if(over>1&&!ribbon.classList.contains('more'))problems.push(`ribbon: commands of the ${name} tab are off screen to the right and nothing shows it`);
    }
  }finally{setTab(tabKept);}
});
window.addEventListener('keydown',e=>{
  if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)||document.querySelector('dialog[open]'))return; // typing, or a dialog has the keyboard
  const c=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(modalKey(e)){e.preventDefault();return;}
  if(c&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  else if(c&&k==='y'){e.preventDefault();redo();}
  else if(tab!=='design')return;
  else if(c&&k==='d'){e.preventDefault();dupSel();}
  else if(!c&&!e.shiftKey&&k==='d')setTool('draw');
  else if(!c&&!e.shiftKey&&k==='c')setTool('connect');
  else if(c&&k==='a'){e.preventDefault();selectAllVisible();}
  else if(k==='delete'||k==='backspace'){e.preventDefault();delSel();}
  else if(k==='arrowleft'){e.preventDefault();nudge(0,-1);}else if(k==='arrowright'){e.preventDefault();nudge(0,1);}
  else if(k==='arrowup'){e.preventDefault();nudge(2,-1);}else if(k==='arrowdown'){e.preventDefault();nudge(2,1);}
  else if(k==='pageup'){e.preventDefault();nudge(1,1);}else if(k==='pagedown'){e.preventDefault();nudge(1,-1);}
  else if(k==='escape'){if(tool!=='select')setTool('select');else{sel=new Set();renderAll();}}
});

/* ---------- Furniture presets dialog ----------
   Left and middle: the groups and the tiles of the catalog (js/catalog.js, which also handles a click on a tile).
   Right, the live pane: the chosen preset: its name and
   description, a live picture of what the sizes typed so far will build (preview.js), the form made from its
   params, and a live summary underneath. The footer has Create and, when there is already a design, Add beside
   the current design. A preset is always chosen when the dialog opens, so the right side is never empty. */
let curPreset=null;          // the preset whose form is showing
let presetTimer=0;           // delays the live summary a moment while someone is typing
let presetEdited=null;       // the box of the form that was changed last; it is the one marked when nothing fits
const LAST_PRESET_KEY='woodshop.preset'; // browser storage: the name of the preset that was created last
const PREVIEW_JOINTS_MAX=1500; // above this many pieces the skill and time estimate is left out of the preview (it would make typing sluggish)
renderPresetCards();

/* A label may end in a remark in brackets, e.g. "Wall width (try 10')". The remark is shown as a quiet hint
   beside the field instead of making the label long. Returns [label, remark]. */
function splitLabel(label){
  const found=String(label).match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return found?[found[1],found[2]]:[label,''];
}
/* One row of the form for one entry of a preset's params (see the notes at the bottom of presets.js).
   index is the entry's place in params; the row carries it as data-q so that a row with a show(p) rule can be
   found again and shown or hidden (presetRowShown below). */
function presetField(q,index){
  const row=`data-q="${index}"`;
  if(q.head){
    const[title,remark]=splitLabel(q.head);
    return`<div class="sec" ${row}>${esc(title)}${remark?`<i>${esc(remark)}</i>`:''}</div>`;
  }
  const[label,remark]=splitLabel(q.label),id='pf-'+q.k,hint=remark?`<i>${esc(remark)}</i>`:'';
  if(q.opts){
    const options=q.opts.map(([value,text])=>`<option value="${value}"${value===q.v?' selected':''}>${esc(text)}</option>`).join('');
    return`<div class="frow" ${row}><label for="${id}">${esc(label)} ${hint}</label><select class="fld" id="${id}" data-k="${q.k}">${options}</select></div>`;
  }
  if(q.check){
    return`<div class="frow" ${row}><label for="${id}">${esc(label)}</label><span class="ck"><input type="checkbox" id="${id}" data-k="${q.k}"${q.v?' checked':''}>${hint}</span></div>`;
  }
  // A count (int) or a plain number (dec: gallons, a roof slope) shows as typed. A size shows the way every
  // length box does, 2'-8" over 12" (boxLen, js/core.js), and is tidied into that form when the box is left
  // (data-len, js/lengthboxes.js).
  if(q.int||q.dec){
    return`<div class="frow" ${row}><label for="${id}">${esc(label)}</label><input class="fld" type="text" id="${id}" data-k="${q.k}" value="${q.v}">${hint}</div>`;
  }
  return`<div class="frow" ${row}><label for="${id}">${esc(label)}</label><input class="fld" type="text" id="${id}" data-k="${q.k}" data-len value="${esc(boxLen(q.v))}">${hint}</div>`;
}
/* A row of the form may only make sense with some of the other choices: the Bookshelf's "Opening 3" box needs
   three shelves and the choice to set the heights by hand. Such an entry of params carries show(p), which is
   handed the values read so far (the rows above it) and says whether the row belongs on the form. Shows or
   hides the row to match and returns the answer. A row without show(p) is always shown. */
function presetRowShown(q,index,vals){
  let shown=true;
  if(q.show){
    try{shown=!!q.show(vals);}
    catch(e){shown=false;}
  }
  // (a heading can stand twice, above the fold of "More options" and inside it: js/presetentry.js)
  document.querySelectorAll(`#presetForm [data-q="${index}"]`).forEach(row=>{row.hidden=!shown;});
  return shown;
}
/* entry: the catalog entry picked (catalogPick, js/catalog.js), with its start values, its short list of rows and
   its own limits (js/presetentry.js); left out when code chooses the preset */
function choosePreset(index,entry){
  curPreset=PRESETS[index];
  curEntry=entry||null;
  document.querySelectorAll('#presetCards .card').forEach(c=>c.classList.toggle('on',+c.dataset.i===index));
  presetEdited=null;
  const firstHeading=curPreset.params[0].head?'':'<div class="sec">Size</div>'; // a short form without sections still gets one heading
  $('#presetForm').innerHTML=
    `<div class="pform-h"><h4>${esc(presetTitle(curPreset))}</h4><p>${esc(presetDesc(curPreset))}</p></div>
     <div class="pview" id="presetPic" title="What these sizes build. It follows the numbers as you type."></div>
     <div class="pform-b">${firstHeading}${presetFormRows(curPreset.params)}</div>
     <div class="pform-s"><div class="sum" id="presetSum"></div><div class="chk" id="presetCheck"></div><p class="note" id="presetInfo"></p></div>`;
  $('#bPGo').disabled=$('#bPAdd').disabled=false;
  $('#bPAdd').hidden=!S.parts.length;
  showPresetSummary();
}
function showNoPreset(){
  curPreset=null;
  $('#presetForm').innerHTML='<p class="pform-empty">Pick a design on the left. Its sizes appear here, ready to change.</p>';
  $('#presetFoot').textContent='';
  $('#bPGo').disabled=true;
  $('#bPAdd').hidden=true;
}
/* A "size" choice (a tank size, a mattress size) fills in the fields it stands for. Changing one of those
   fields by hand afterwards switches the choice to Custom. */
function presetFieldChanged(field){
  const param=curPreset.params.find(q=>q.k===field.dataset.k);
  if(!param)return;
  const sizeChoice=curPreset.params.find(q=>q.fill);
  if(param.fill&&param.fill[field.value]){
    for(const[key,value]of Object.entries(param.fill[field.value])){
      const target=curPreset.params.find(q=>q.k===key);
      $(`#presetForm [data-k="${key}"]`).value=target.int||target.dec?value:boxLen(value);
    }
  }else if(!param.fill&&sizeChoice&&param.k!=='clr'&&Object.values(sizeChoice.fill).some(set=>param.k in set)){
    $(`#presetForm [data-k="${sizeChoice.k}"]`).value='custom';
  }
}
/* Reads the form. Returns {key: value}, or null when a size cannot be read or is outside the limits its preset
   gives it (min and max on the field, see num() in builders-shed.js); the boxes at fault turn red and
   presetFieldNote says in plain words what is wrong with the first one.
   On the way it shows or hides the rows that have a show(p) rule. A hidden box is not judged: whatever was left
   in it, the preset gets the value the box starts with, because the person cannot see it to put it right. */
let presetFieldNote='';
const CANNOT_READ='A size in red cannot be read. Type it like 36, 3 1/2, 2\'-8" or 2 ft 8.';
function readVals(focusBad){
  const vals={};
  let firstBad=null;
  presetFieldNote='';
  curPreset.params.forEach((q,index)=>{
    const shown=presetRowShown(q,index,vals);
    if(q.head)return;
    const el=$(`#presetForm [data-k="${q.k}"]`);
    // (hidden: the value the form starts with, which is the catalog entry's own when it gives one)
    if(!shown){vals[q.k]=presetStartValue(q);el.classList.remove('bad');return;}
    if(q.opts){vals[q.k]=el.value;return;}
    if(q.check){vals[q.k]=el.checked;return;}
    const v=q.int?parseInt(el.value,10):q.dec?parseFloat(el.value):parseLen(el.value);
    const unreadable=isNaN(v)||v<0||v>1200;
    // A box for a count (how many windows, how many shelves) takes a whole number and nothing else. "2.7" was
    // once read as 2 without a word, so the box showed one number and the design was built with another.
    const notWhole=!!q.int&&!unreadable&&!/^\d+(\.0*)?$/.test(el.value.trim());
    // the limits of the field, or the narrower ones of the catalog entry picked (js/presetentry.js)
    const{min,max}=presetLimits(q);
    const tooSmall=!unreadable&&min!==undefined&&v<min-1e-9,tooBig=!unreadable&&max!==undefined&&v>max+1e-9;
    const bad=unreadable||notWhole||tooSmall||tooBig;
    el.classList.toggle('bad',bad);
    if(!bad){vals[q.k]=v;return;}
    if(firstBad)return;
    firstBad=el;
    const show=size=>q.int||q.dec?String(size):boxLen(size),name=splitLabel(q.label)[0]; // a limit is written the way its box shows it
    presetFieldNote=unreadable?CANNOT_READ
      :notWhole?`${name} must be a whole number, like ${v} or ${v+1}.`
      :min!==undefined&&max!==undefined?`${name} must be between ${show(min)} and ${show(max)}.`
      :tooSmall?`${name} cannot be less than ${show(min)}.`:`${name} cannot be more than ${show(max)}.`;
  });
  presetFoldOpenIfNeeded(vals);   // a red box or a changed value under "More options" is shown (js/presetentry.js)
  if(!firstBad)return vals;
  if(focusBad){firstBad.focus();firstBad.select();}
  return null;
}
/* Skill, time and cost for pieces that are not the design yet: look at them as if they were a new project, the
   way Create will make it: with the finish the preset starts with, the fasteners it names and its rule for glue.
   The Build instructions of the placed design then give the same skill and the same working time. */
/* vals: the form values the parts were built from. With them, a preset that screws itself into the wall studs when
   it is placed (preset.wallScrews: the fish racks and stands too tall for their depth) is rated with those screws,
   as the Build instructions page rates it once they are in the design (SKILL.tanksScrewedToWall, js/style.js),
   and a preset whose joints follow the form (joints as a function: the cabinet builder) names its fasteners. */
function assessParts(parts,preset,vals){
  const keep=S;
  S={...blank(),parts,look:{style:'std',wood:'pine',finish:'clear',...((preset&&preset.look)||{})}};
  try{
    // A joint is known by the ids of its two pieces, so every piece needs an id of its own. Pieces fresh from a
    // builder all carry id 0 (mk in js/core.js): with one key for every joint, the first "Not joined" the preset
    // names counted for all of them, and the window rated a design with no fasteners at all.
    if(new Set(parts.map(piece=>piece.id)).size<parts.length||parts.some(piece=>!piece.id))parts.forEach((piece,index)=>{piece.id=index+1;});
    if(preset){
      if(preset.glue===false)S.glue=false;
      storeNamedJoints(preset,parts,vals);
      if(vals&&typeof preset.wallScrews==='function'){
        try{S.plannedWallScrews=(preset.wallScrews(vals,parts)||[]).length;}catch(e){S.plannedWallScrews=0;}
      }
    }
    const buy=lumberToBuy(parts);
    return{buy,rating:parts.length<=PREVIEW_JOINTS_MAX?assess(look()):null};
  }finally{S=keep;}
}
/* The live picture and summary of the chosen preset with the sizes typed so far: what it looks like, overall
   size, pieces, lumber to buy and cost, and under them what the structural check (js/verify.js) and the preset's
   own check(p) say about those sizes.
     - A box that cannot be read, or is outside the limits of its field, turns red and one line says why.
       Nothing is drawn, and Create waits until the box is put right.
     - Sizes that cannot work ("stop") are listed in red with the reason and what to change; the box that was
       changed last is marked. Create stays live: pressing it gives the same reasons in a message (presetGate).
     - Sizes that work but are marginal ("warn") are listed in amber; Create asks before it builds. */
function showPresetSummary(){
  clearTimeout(presetTimer);
  if(!curPreset)return;
  const sum=$('#presetSum'),info=$('#presetInfo'),foot=$('#presetFoot'),found=$('#presetCheck'),picture=$('#presetPic');
  const vals=readVals(false);
  const say=message=>{sum.innerHTML=`<span class="err">${esc(message)}</span>`;};
  foot.textContent='';
  found.innerHTML='';
  found.title='';
  $('#bPGo').disabled=$('#bPAdd').disabled=!vals;
  if(!vals){
    say(presetFieldNote);
    info.textContent='';
    showPreview(picture,[]);
    return;
  }
  // the remark and the findings under the form quote the sizes typed in its boxes the way the boxes show them
  const remark=speakAsBoxes(()=>curPreset.info?curPreset.info(vals):'');
  const check=speakAsBoxes(()=>checkPreset(curPreset,vals,null,{maxPieces:LIVE_CHECK_MAX_PIECES})),parts=check.parts;
  found.innerHTML=findingsHtml(check.shown,false);   // the preset's own reasons alone when it refuses (checkPreset)
  found.title=check.shown.length?'Create will '+(check.stops.length?'not build this until the red items are fixed.':'ask before building this.'):'';
  showPreview(picture,parts);
  const cannot=check.stops.length>0||!parts.length;
  // the box that was typed in last is the one to look at first
  if(cannot&&presetEdited&&presetEdited.isConnected&&presetEdited.type==='text')presetEdited.classList.add('bad');
  if(!parts.length||check.stops.length){
    // The reasons are in the list of findings. A preset with none (it builds nothing and has no check(p)) says
    // why in its own remark; cannotBuildText is the one place that picks the words, here and in presetGate.
    // Nothing is said about pieces, price or hours of work for a design that cannot be built: the picture
    // stays, so the person sees what their numbers ask for, and the red box under it says what to change.
    say(check.stops.length?'This cannot be built with these sizes. The box below says why.':speakAsBoxes(()=>cannotBuildText(curPreset,vals)));
    info.textContent='';
    return;
  }

  info.textContent=remark;
  const b=builtSize(parts).box,wood=parts.filter(p=>!isProp(p)).length,{buy,rating}=assessParts(parts,curPreset,vals);   // the size of what is built, not of a tank or a mattress drawn on it
  const lumber=[buy.boards?`${buy.boards} board${buy.boards>1?'s':''}`:'',buy.sheets?`${buy.sheets} sheet${buy.sheets>1?'s':''}`:''].filter(Boolean).join(', ');
  const cell=(caption,value)=>`<span><small>${caption}</small><b>${value}</b></span>`;
  sum.innerHTML=cell('Overall size',`${fmtFt(b.hi[0]-b.lo[0])} × ${fmtFt(b.hi[2]-b.lo[2])} × ${fmtFt(b.hi[1]-b.lo[1])}`)+
    cell('Pieces to cut',wood.toLocaleString())+cell('Lumber to buy',lumber||'none')+cell('About','$'+Math.round(buy.cost).toLocaleString());
  sum.title='Overall size is width × depth × height. The cost is a rough guess for the lumber only.';
  foot.textContent=rating?`${rating.level} · about ${rating.hours} hour${rating.hours>1?'s':''} of work`:'';
}
/* Create (add = false) or Add beside the current design (add = true).
   presetGate (js/checkui.js) stands in between: a design with a "stop" is not built and a box says why; one
   with only "warn" items is built after Build anyway; a clean one is built at once. */
function makePreset(add){
  if(!curPreset)return;
  const preset=curPreset,vals=readVals(true),entryName=presetEntryName(preset);   // (js/presetentry.js)
  if(!vals){showPresetSummary();return;} // the line under the form says what is wrong with the box in red
  // One decision, not two: when a marginal design would also replace the one on screen, the gate's own question
  // says so (replaceNote) and its "Build anyway" is the answer to both.
  const replacing=!add&&S.parts.length>0;
  const replaceNote=replacing?'Building it replaces the design on screen. Undo (Ctrl+Z) brings the old design back.':'';
  presetGate(preset,vals,(parts,alreadyAsked)=>{
    if(!replacing||alreadyAsked){placePreset(preset,vals,parts,add,entryName);return;}
    askConfirm('Replace the design on screen with this one? Undo (Ctrl+Z) brings the old design back.',
      {title:'Replace the current design',action:'Replace'},()=>placePreset(preset,vals,parts,false,entryName));
  },replaceNote);
}
/* entryName (optional): the name of the catalog entry it was made from, for a builder that serves several
   (preset.hidden, js/presetentry.js). The project, its component and the visit are named after it; the placement
   keeps the builder's name (S.sets[n].name, which the checks look the preset up by) and the entry's (.entry). */
function placePreset(preset,vals,parts,add,entryName){
  const shownName=entryName||preset.name;
  // (furniture for the house also says where screw heads show in each style, and how to hide any: headsNote, js/showfaces.js)
  const notes=(preset.notes?preset.notes(vals):[]).concat(headsNote(preset.name));
  const stepsOf=preset.steps||STEPS[preset.name],steps=stepsOf?stepsOf(vals):[];
  // What each piece is for, which pieces go on the wall and which hang on bought hardware: Check my design reads
  // them later. They are kept for THIS placement, under a number that each of its pieces carries (piece.set), not
  // for the whole project by piece name: a Bookshelf and a Workbench side by side both have a "Top", and only the
  // Bookshelf is screwed to the wall. The marginal findings of the preset's own check(p) (a nightstand that a
  // full open drawer nearly tips) are kept with it too, so that Check my design can repeat them.
  const declared=presetOptions(preset,vals);
  const ownWarnings=(preset.check?preset.check(vals)||[]:[]).filter(f=>f.level==='warn').map(f=>({text:f.text,fix:f.fix||''}));
  if(add){
    const b=bbox(S.parts),dx=b?b.hi[0]+8:0;
    parts.forEach(p=>p.pos[0]=r16(p.pos[0]+dx));
    S.notes=(S.notes||[]).concat(notes);
    S.steps=[]; // two designs side by side have no single order of steps: the steps are then worked out from the pieces, as a suggested order (js/buildsteps.js)
  }else{
    S.parts=[];S.joints={};S.named={};S.styled={};S.comps=[];S.stock={};S.name=shownName;S.notes=notes;S.steps=steps;S.hw=[];
    delete S.through;   // which piece named joints are screwed through (js/joints.js): kept only for these pieces
    // every design starts in the everyday style, in pine, with a clear coat, unless its preset says otherwise
    // (look:{finish:'none'} on the outdoor presets, so nobody is told to buy polyurethane for a shed)
    S.look={style:'std',wood:'pine',finish:'clear',...(preset.look||{})};
    // nothing is declared for the project as a whole any more (projects saved by older versions still have
    // these lists, and they are still read for pieces without a set)
    S.uses={};S.wall=[];S.hung=[];S.wallFixed=false;S.sets={};
    delete S.assumeHardware;   // hardware is drawn from here on, so nothing about it is assumed (js/holds.js)
    delete S.glue;
  }
  // A preset whose steps never glue (2x4 garage shelving, a garden bed that stands in the wet) says glue:false,
  // and the lists then leave wood glue out for its screwed joints (hardwareTotals in js/style.js). Beside a
  // design that is glued, the glue stays on the list.
  if(preset.glue===false&&(!add||S.glue===false))S.glue=false;
  else delete S.glue;
  const setNumber=S.nextSet=(S.nextSet||0)+1;
  S.sets=S.sets||{};
  // vals: the form values it was made with, so its steps and notes can be written again for it later (a design
  // brought up to a new rule for fasteners, js/fasteningupgrade.js)
  S.sets[setNumber]={name:preset.name,uses:declared.uses,wall:declared.wall,hung:declared.hung,wallFixed:declared.wallFixed,warnings:ownWarnings,vals:{...vals}};
  if(entryName)S.sets[setNumber].entry=entryName;
  parts.forEach(p=>{p.set=setNumber;});
  const hwBefore=S.hw||[],hwOwn=preset.hw?preset.hw(vals):[];
  S.hw=hwBefore.concat(hwOwn);   // while the doors are hung: whether the preset lists a catch decides whether they get one
  sel=new Set();
  const ids=addParts(parts);
  // Each step keeps the ids of its pieces and what they looked like, so the build instructions follow later
  // edits: a renamed piece stays in its step, and a step whose pieces were changed is written again (js/buildsteps.js).
  if(!add)S.steps=stampSteps(steps,parts);
  // A preset can name the fastener between two kinds of piece itself, joints:[['Side','Top','glue']], where the
  // suggestion worked out from the shapes alone would be wrong. It is kept like a fastener chosen by hand.
  storeNamedJoints(preset,parts,vals);   // js/joints.js
  // After the fasteners are named (pieces that only touch, 'none', must not count as fastened to each other):
  componentFromPreset(shownName,ids);   // the preset arrives as one component (js/components.js)
  hangPresetDoors(ids);                 // every door and lid gets its hinges, a pull and a catch (js/hanging.js)
  mountPresetDrawers(ids);              // every drawer gets its pair of slides or runners, and a pull (js/drawers.js)
  if(preset.place)preset.place(vals,parts);   // hardware a preset places itself: a fish rack's wall screws and section bolts (js/rackwall.js)
  if(typeof preset.afterPlace==='function')preset.afterPlace(ids,vals);   // more hardware of its own (js/presetentry.js)
  // What was just placed is listed as what it is from now on; the preset's own lines for it are settled for good,
  // so a hinge or a pull that is deleted later does not come back on the shopping list (js/hardware.js).
  S.sets[setNumber].hw=settlePlainLines(hwBefore,hwOwn,ids);
  try{localStorage.setItem(LAST_PRESET_KEY,shownName);}catch(e){} // the dialog opens on this one next time (an entry's name: startingPreset finds it)
  if(window.countVisitEvent&&$('#presetDlg').open)countVisitEvent('preset',shownName); // made by the person in the presets window: the public site counts its catalog name (js/visits.js)
  $('#presetDlg').close();
  setTab('design');
  commit();
  fit('fit');
}
/* the preset the dialog shows when none has been chosen yet in this visit: the one created last time, or else
   the first tile of the list */
function startingPreset(){
  let lastName='';
  try{lastName=localStorage.getItem(LAST_PRESET_KEY)||'';}catch(e){}
  // a name kept from before a preset was retired ("Bookshelf"), or the name of an entry of a builder that serves
  // several: the catalog entry it opens (presetEntryForName, js/presetentry.js) and its builder
  const entry=presetEntryForName(lastName);
  if(entry){
    catalogState.picked=entry.id;   // so the window shows that entry, not another one of the same builder
    const index=PRESETS.findIndex(p=>p.name===entry.builder);
    if(index>=0)return index;
  }
  const last=PRESETS.findIndex(p=>p.name===lastName&&!p.retired),firstTile=$('#presetCards .card');
  return last>=0?last:firstTile?+firstTile.dataset.i:0;
}
function openPresets(){
  if(curPreset){$('#bPAdd').hidden=!S.parts.length;showPresetSummary();} // back where it was left, sizes and all
  else choosePreset(startingPreset());
  $('#presetDlg').showModal();
  catalogOpened(); // js/catalog.js: the groups and tiles show the chosen design, the keyboard is in the search box
}
$('#presetForm').oninput=e=>{presetEdited=e.target;clearTimeout(presetTimer);presetTimer=setTimeout(showPresetSummary,180);};
$('#presetForm').onchange=e=>{if(!curPreset)return;presetEdited=e.target;presetFieldChanged(e.target);showPresetSummary();};
/* Enter in a box of the form presses Create (the shared Enter of every dialog, js/dialogs.js, which listens further
   out and so comes after this). The summary, which decides whether Create can be pressed, waits a moment after
   typing (presetTimer), and the change event of the box only comes after Enter: so a box just put right would
   still have Create waiting from when it was red, and the first Enter would do nothing. The box is read now
   instead, as its change event would read it, so one Enter creates from what the boxes say at this moment; a box
   that is still red leaves Create waiting. */
$('#presetForm').addEventListener('keydown',e=>{
  if(e.key!=='Enter'||!curPreset||e.target.tagName!=='INPUT'||e.target.type==='checkbox')return;
  presetEdited=e.target;
  presetFieldChanged(e.target);
  showPresetSummary();
});
$('#bPGo').onclick=()=>makePreset(false);
$('#bPAdd').onclick=()=>makePreset(true);
$('#bPreset').onclick=openPresets;

/* ---------- self-check: rows of a preset form that come and go (selfTest runs every function in SELFTESTS) ----------
   Tried on a made-up preset, through the form itself: a row with show(p) is hidden until the rows above it say
   it belongs, a hidden box is never judged and hands the preset the value it starts with, and a box that shows
   is held to its limits like any other. */
SELFTESTS.push(function presetRowsComeAndGo(problems){
  const before=curPreset;
  PRESETS.push({name:'Self-check rows',desc:'',build:p=>[mk('Board','1x4',[p.W||20,.75,3.5],[0,0,0])],
    params:[num('W','Width',20,10,30),
      {k:'count',label:'How many',v:2,int:1,min:0,max:8},
      {k:'extra',label:'Extras',opts:[['no','None'],['yes','Some']],v:'no'},
      {head:'Extra sizes',show:p=>p.extra==='yes'},
      {...num('gap','Gap',2,1,5),show:p=>p.extra==='yes'}]});
  try{
    choosePreset(PRESETS.length-1);
    const row=key=>$(`#presetForm [data-k="${key}"]`).closest('.frow'),head=$('#presetForm .sec[data-q="3"]');
    // a box for a count takes a whole number: "2.7" is turned away in words, never read as 2 without a word
    const count=$('#presetForm [data-k="count"]');
    count.value='2.7';
    if(readVals(false)!==null||!count.classList.contains('bad')||!/How many must be a whole number/.test(presetFieldNote))problems.push('preset form: 2.7 in a box for a whole number must be turned away in words: '+presetFieldNote);
    count.value='3';
    const whole=readVals(false);
    if(!whole||whole.count!==3)problems.push('preset form: 3 in a box for a whole number must be read as 3');
    const choice=$('#presetForm [data-k="extra"]'),gap=$('#presetForm [data-k="gap"]');
    if(!row('gap').hidden||!head.hidden||row('W').hidden)problems.push('preset form: a row with show(p) must start hidden when its rule says so, and the other rows must show');
    gap.value='99';                                   // out of limits, but nobody can see the box
    const hiddenRead=readVals(false);
    if(!hiddenRead||hiddenRead.gap!==2||gap.classList.contains('bad'))problems.push('preset form: a hidden box must not be judged, and must hand over the value it starts with');
    choice.value='yes';
    choice.dispatchEvent(new Event('change',{bubbles:true}));
    if(row('gap').hidden||head.hidden)problems.push('preset form: the rows did not appear when the choice above them asked for them');
    if(readVals(false)!==null||!/Gap must be between 1" and 5"/.test(presetFieldNote))problems.push('preset form: a box that shows must be held to its limits: '+presetFieldNote);
    gap.value='3';
    const shownRead=readVals(false);
    if(!shownRead||shownRead.gap!==3)problems.push('preset form: a box that shows must be read');
    choice.value='no';
    choice.dispatchEvent(new Event('change',{bubbles:true}));
    if(!row('gap').hidden||!head.hidden)problems.push('preset form: the rows did not go away again');
  }finally{
    PRESETS.pop();
    // back to the form that was showing (unless that was another check's made-up preset, which is gone by now)
    const was=PRESETS.indexOf(before);
    if(was>=0)choosePreset(was);else showNoPreset();
  }
});

/* Self-check: one Enter right after a red size box is put right creates the design, with the size typed; Enter
   while a box is still red creates nothing. Done through the window, with the keys a person presses. */
SELFTESTS.push(function presetEnterAfterAFix(problems){
  const wrong=text=>problems.push('presets window Enter: '+text);
  const keepSnap=lastSnap,undo0=undoStack.slice(),redo0=redoStack.slice(),confirm0=autoConfirm,picked0=catalogState.picked;
  const enter=box=>box.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  const type=(box,text)=>{box.focus();box.value=text;box.dispatchEvent(new Event('input',{bubbles:true}));};
  autoConfirm=true;                                        // the question "Replace the design on screen?" answers yes
  try{
    if($('#presetDlg').open)$('#presetDlg').close();
    $('#bPreset').click();
    catalogPick('wall-shelf',{fresh:true});
    const width=$('#presetForm [data-k="L"]');
    if(!width){wrong('the Wall shelf form has no Length box');return;}
    const setsBefore=S.nextSet||0;
    // a size far outside the limits: the box turns red and Enter creates nothing
    type(width,'900');
    enter(width);
    if(!width.classList.contains('bad'))wrong('a size of 900" did not turn the box red');
    if((S.nextSet||0)!==setsBefore||!$('#presetDlg').open)wrong('Enter on a red box created the design');
    // put right, then Enter at once, before the summary has caught up: one Enter creates, with that size
    const length=20;                                       // inside the limits, and not the length it starts with
    type(width,String(length));
    if(!presetTimer)wrong('typing did not leave the summary waiting, so this check proves nothing');
    enter(width);
    if((S.nextSet||0)===setsBefore)wrong('one Enter after putting the box right did not create the design');
    else{
      const made=S.parts.filter(piece=>piece.set===S.nextSet);
      const longest=made.map(piece=>Math.max(...size(piece)));
      if(!longest.some(each=>Math.abs(each-length)<1/32))wrong(`the design was made, but not with the ${fmt(length)} typed (longest pieces: ${longest.map(fmt).join(', ')})`);
    }
  }finally{
    autoConfirm=confirm0;
    if($('#presetDlg').open)$('#presetDlg').close();
    load(keepSnap,true);undoStack=undo0;redoStack=redo0;
    if(picked0&&catalogEntry(picked0))catalogState.picked=picked0;
  }
});

/* Self-check: the preset window and the Build instructions page give one skill and one working time for a preset
   as Create makes it (the first-time builder read "about 12 hours" in the window and "about 8 hours" on the page). */
SELFTESTS.push(function presetWindowRatesAsThePage(problems){
  // Every preset at its defaults, and the fish rack with its tanks long side out, which is screwed into the wall
  // studs when it is placed (the window counts the screws placing it will drive; the page the screws placed).
  const rack=PRESETS.find(preset=>preset.name==='Fish tank wall / rack');
  const tries=PRESETS.map(preset=>[preset,presetDefaults(preset)]);
  if(rack)tries.push([rack,{...presetDefaults(rack),orient:'long'}]);
  for(const[preset,vals]of tries){
    let parts=[];
    try{parts=preset.build(vals)||[];}catch(e){}
    if(!parts.length||parts.length>PREVIEW_JOINTS_MAX)continue;
    const window_=assessParts(parts,preset,vals).rating;
    placePreset(preset,vals,preset.build(vals),false);
    const page=assess(look());
    if(!window_||window_.level!==page.level||window_.hours!==page.hours){
      problems.push(`${preset.name}: the preset window says "${window_&&window_.level}, about ${window_&&window_.hours} hours" and the instructions "${page.level}, about ${page.hours} hours"`);
    }
  }
});

/* ---------- boot ---------- */
let saved=null;try{saved=localStorage.getItem('woodshop.autosave');}catch(e){}
try{load(saved||JSON.stringify(blank()));}catch(e){load(JSON.stringify(blank()));}
resize();fit('fit');
syncRibbonEdge();
if(!S.parts.length)openPresets();
