/* NominalCAD: tabs, the File menu and ribbon actions, the dialogs that belong to them, and start-up.
   (The dialog pattern and askConfirm / showMessage are in dialogs.js; Copy in a row and Mirror are in transform.js.) */
'use strict';
/* ---------- tabs ---------- */
let tab='design';
const TAB_PAGES={design:'#designPage',joints:'#jointsPage',cut:'#cutPage',instr:'#instrPage'};
function setTab(t){
  tab=t;
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  document.body.dataset.tab=t; // the style sheet shows and hides things by tab
  if(t==='cut')renderCut();
  if(t==='instr')renderCut(true);
  for(const[name,page]of Object.entries(TAB_PAGES))$(page).style.display=name!==t?'none':name==='design'?'flex':'block';
  if(t==='joints')renderJoints();
  if(t==='design'){resize();syncPanels();} // the 3D view had no size while it was hidden
  renderStatus();
}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function renderAll(){
  $('#projName').value=S.name;
  document.title=S.name+' - NominalCAD';
  $('#bUndo').disabled=!undoStack.length;
  $('#bRedo').disabled=!redoStack.length;
  $('#bInstr').disabled=$('#bStyle').disabled=!S.parts.length; // nothing to style or print until there is a piece
  rebuildScene();renderParts();renderProps();renderStatus();syncPanels();
  if(tab==='joints')renderJoints();if(tab==='cut')renderCut();if(tab==='instr')renderCut(true);
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

/* ---------- My projects: named designs kept in this browser, plus a file to download as a backup ---------- */
const getProjects=()=>{try{return JSON.parse(localStorage.getItem('woodshop.projects'))||{};}catch(e){return{};}};
function putProjects(projects){
  try{localStorage.setItem('woodshop.projects',JSON.stringify(projects));return true;}
  catch(e){
    showMessage('Could not save','This browser is out of storage space for saved projects. Use File, then Download as a file, instead.');
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
$('#bImport').onclick=()=>$('#fileIn').click();
$('#bExport').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'}));
  a.download=(S.name.replace(/[^\w\- ]+/g,'').trim()||'project')+'.woodshop.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
/* a project file is this program's JSON with a list of parts in it; anything else is turned away with a notice */
function openProjectText(text){
  try{
    const project=JSON.parse(text);
    if(!Array.isArray(project.parts))throw new Error('no parts');
    load(text);fit('fit');
    $('#projDlg').close();
  }catch(err){
    showMessage('Not a NominalCAD project','That file is not a NominalCAD project. Pick a file that was saved with File, then Download as a file.');
  }
}
$('#fileIn').onchange=e=>{const f=e.target.files[0];if(!f)return;f.text().then(openProjectText);e.target.value='';};
$('#bPrint').onclick=()=>{setTab('instr');setTimeout(()=>window.print(),300);};
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
   Left: the catalog as tiles (drawn by renderPresetCards in presets.js). Right: the form of the chosen preset,
   made from its params, with a live summary underneath. The footer has Create and, when there is already
   a design, Add beside the current design. */
let curPreset=null;          // the preset whose form is showing
let presetTimer=0;           // delays the live summary a moment while someone is typing
const PREVIEW_JOINTS_MAX=1500; // above this many pieces the skill and time estimate is left out of the preview (it would make typing sluggish)
renderPresetCards();

/* A label may end in a remark in brackets, e.g. "Wall width (try 10')". The remark is shown as a quiet hint
   beside the field instead of making the label long. Returns [label, remark]. */
function splitLabel(label){
  const found=String(label).match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return found?[found[1],found[2]]:[label,''];
}
/* one row of the form for one entry of a preset's params (see the notes at the bottom of presets.js) */
function presetField(q){
  if(q.head){
    const[title,remark]=splitLabel(q.head);
    return`<div class="sec">${esc(title)}${remark?`<i>${esc(remark)}</i>`:''}</div>`;
  }
  const[label,remark]=splitLabel(q.label),id='pf-'+q.k,hint=remark?`<i>${esc(remark)}</i>`:'';
  if(q.opts){
    const options=q.opts.map(([value,text])=>`<option value="${value}"${value===q.v?' selected':''}>${esc(text)}</option>`).join('');
    return`<div class="frow"><label for="${id}">${esc(label)} ${hint}</label><select class="fld" id="${id}" data-k="${q.k}">${options}</select></div>`;
  }
  if(q.check){
    return`<div class="frow"><label for="${id}">${esc(label)}</label><span class="ck"><input type="checkbox" id="${id}" data-k="${q.k}"${q.v?' checked':''}>${hint}</span></div>`;
  }
  const value=q.int||q.dec?q.v:fa(q.v);
  return`<div class="frow"><label for="${id}">${esc(label)}</label><input class="fld" type="text" id="${id}" data-k="${q.k}" value="${value}">${hint}</div>`;
}
function choosePreset(index){
  curPreset=PRESETS[index];
  document.querySelectorAll('#presetCards .card').forEach(c=>c.classList.toggle('on',+c.dataset.i===index));
  const firstHeading=curPreset.params[0].head?'':'<div class="sec">Size</div>'; // a short form without sections still gets one heading
  $('#presetForm').innerHTML=
    `<div class="pform-b"><h4>${esc(curPreset.name)}</h4><p>${esc(curPreset.desc)}</p>${firstHeading}${curPreset.params.map(presetField).join('')}</div>
     <div class="pform-s"><div class="sum" id="presetSum"></div><p class="note" id="presetInfo"></p></div>`;
  $('#bPGo').disabled=false;
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
      $(`#presetForm [data-k="${key}"]`).value=target.int||target.dec?value:fmt(value);
    }
  }else if(!param.fill&&sizeChoice&&param.k!=='clr'&&Object.values(sizeChoice.fill).some(set=>param.k in set)){
    $(`#presetForm [data-k="${sizeChoice.k}"]`).value='custom';
  }
}
/* Reads the form. Returns {key: value}, or null when a size cannot be read; the boxes at fault turn red. */
function readVals(focusBad){
  const vals={};
  let firstBad=null;
  for(const q of curPreset.params){
    if(q.head)continue;
    const el=$(`#presetForm [data-k="${q.k}"]`);
    if(q.opts){vals[q.k]=el.value;continue;}
    if(q.check){vals[q.k]=el.checked;continue;}
    const v=q.int?parseInt(el.value,10):q.dec?parseFloat(el.value):parseLen(el.value);
    const bad=isNaN(v)||v<0||v>1200;
    el.classList.toggle('bad',bad);
    if(bad)firstBad=firstBad||el;else vals[q.k]=v;
  }
  if(!firstBad)return vals;
  if(focusBad){firstBad.focus();firstBad.select();}
  return null;
}
/* Skill, time and cost for pieces that are not the design yet: look at them as if they were a new project. */
function assessParts(parts){
  const keep=S;
  S={...blank(),parts,look:{style:'std',wood:'pine',finish:'clear'}};
  try{
    const buy=lumberToBuy(parts);
    return{buy,rating:parts.length<=PREVIEW_JOINTS_MAX?assess(look()):null};
  }finally{S=keep;}
}
/* the live summary under the form: overall size, pieces, lumber to buy and cost, with the sizes typed so far */
function showPresetSummary(){
  clearTimeout(presetTimer);
  if(!curPreset)return;
  const sum=$('#presetSum'),info=$('#presetInfo'),foot=$('#presetFoot'),vals=readVals(false);
  foot.textContent='';
  if(!vals){
    sum.innerHTML='<span class="err">A size in red cannot be read. Type it like 36, 3 1/2 or 4\' 6.</span>';
    info.textContent='';
    return;
  }
  info.textContent=curPreset.info?curPreset.info(vals):'';
  const parts=curPreset.build(vals);
  if(!parts.length){sum.innerHTML='<span class="err">Nothing fits with these sizes. Try a wider or taller space.</span>';return;}
  const b=bbox(parts),wood=parts.filter(p=>!isProp(p)).length,{buy,rating}=assessParts(parts);
  const lumber=[buy.boards?`${buy.boards} board${buy.boards>1?'s':''}`:'',buy.sheets?`${buy.sheets} sheet${buy.sheets>1?'s':''}`:''].filter(Boolean).join(', ');
  const cell=(caption,value)=>`<span><small>${caption}</small><b>${value}</b></span>`;
  sum.innerHTML=cell('Overall size',`${fmtFt(b.hi[0]-b.lo[0])} × ${fmtFt(b.hi[2]-b.lo[2])} × ${fmtFt(b.hi[1]-b.lo[1])}`)+
    cell('Pieces to cut',wood.toLocaleString())+cell('Lumber to buy',lumber||'none')+cell('About','$'+Math.round(buy.cost).toLocaleString());
  sum.title='Overall size is width × depth × height. The cost is a rough guess for the lumber only.';
  foot.textContent=rating?`${rating.level} · about ${rating.hours} hour${rating.hours>1?'s':''} of work`:'';
}
/* Create (add = false) or Add beside the current design (add = true) */
function makePreset(add){
  if(!curPreset)return;
  const preset=curPreset,vals=readVals(true);
  if(!vals)return;
  const parts=preset.build(vals);
  if(!parts.length){showMessage('Nothing fits','Nothing fits with those sizes. Try a wider or taller space.');return;}
  if(add||!S.parts.length){placePreset(preset,vals,parts,add);return;}
  askConfirm('Replace the design on screen with this one? Undo (Ctrl+Z) brings the old design back.',
    {title:'Replace the current design',action:'Replace'},()=>placePreset(preset,vals,parts,false));
}
function placePreset(preset,vals,parts,add){
  const notes=preset.notes?preset.notes(vals):[];
  const stepsOf=preset.steps||STEPS[preset.name],steps=stepsOf?stepsOf(vals):[];
  if(add){
    const b=bbox(S.parts),dx=b?b.hi[0]+8:0;
    parts.forEach(p=>p.pos[0]=r16(p.pos[0]+dx));
    S.notes=(S.notes||[]).concat(notes);
    S.steps=[]; // two designs side by side have no single order of steps; the instructions fall back to general ones
  }else{
    S.parts=[];S.joints={};S.stock={};S.name=preset.name;S.notes=notes;S.steps=steps;S.hw=[];
    S.look={style:'std',wood:'pine',finish:'clear'};
  }
  if(preset.hw)S.hw=(S.hw||[]).concat(preset.hw(vals));
  sel=new Set();
  addParts(parts);
  $('#presetDlg').close();
  setTab('design');
  commit();
  fit('fit');
}
function openPresets(){
  if(curPreset){$('#bPAdd').hidden=!S.parts.length;showPresetSummary();} // back where it was left, sizes and all
  else showNoPreset();
  $('#presetDlg').showModal();
  const tile=$('#presetCards .card.on')||$('#presetCards .card'); // the keyboard starts on the chosen design, or the first one
  if(tile)tile.focus();
}
$('#presetCards').onclick=e=>{
  const card=e.target.closest('.card');
  if(card)choosePreset(+card.dataset.i);
};
$('#presetForm').oninput=()=>{clearTimeout(presetTimer);presetTimer=setTimeout(showPresetSummary,180);};
$('#presetForm').onchange=e=>{if(!curPreset)return;presetFieldChanged(e.target);showPresetSummary();};
$('#bPGo').onclick=()=>makePreset(false);
$('#bPAdd').onclick=()=>makePreset(true);
$('#bPreset').onclick=openPresets;

/* ---------- boot ---------- */
let saved=null;try{saved=localStorage.getItem('woodshop.autosave');}catch(e){}
try{load(saved||JSON.stringify(blank()));}catch(e){load(JSON.stringify(blank()));}
resize();fit('fit');
if(!S.parts.length)openPresets();
