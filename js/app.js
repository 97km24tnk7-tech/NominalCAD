/* WoodShop Designer: tabs, top-bar actions, dialogs and start-up */
'use strict';
/* ---------- tabs & top bar ---------- */
let tab='design';
function setTab(t){tab=t;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  document.body.dataset.tab=t;
  if(t==='cut')renderCut();if(t==='instr')renderCut(true);
  $('#designPage').style.display=t==='design'?'flex':'none';$('#jointsPage').style.display=t==='joints'?'block':'none';$('#cutPage').style.display=t==='cut'?'block':'none';$('#instrPage').style.display=t==='instr'?'block':'none';
  if(t==='joints')renderJoints();if(t==='design')resize();}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function renderAll(){
  $('#projName').value=S.name;document.title=S.name+' - NominalCAD';$('#bUndo').disabled=!undoStack.length;$('#bRedo').disabled=!redoStack.length;
  rebuildScene();renderParts();renderProps();renderStatus();syncPanels();
  if(tab==='joints')renderJoints();if(tab==='cut')renderCut();if(tab==='instr')renderCut(true);
  $('#bInstr').style.display=$('#bStyle').style.display=S.parts.length?'':'none';
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
/* import a cut list typed or pasted from another plan */
function matchMat(s){s=s.toLowerCase().replace(/\s+/g,'');const m=s.match(/(\d)x(\d+)/);if(m&&M[m[1]+'x'+m[2]])return m[1]+'x'+m[2];
  if(/ply|osb|sheet|panel/.test(s))return/1\/4|\.25/.test(s)?'ply14':/1\/2|\.5/.test(s)?'ply12':'ply34';return null;}
$('#bImportCut').onclick=()=>{$('#cutErr').textContent='';$('#cutDlg').showModal();};
$('#bCutClose').onclick=()=>$('#cutDlg').close();
$('#bCutGo').onclick=()=>{const bad=[],parts=[],b=bbox(S.parts);let z=b?b.lo[2]:0;const x=b?b.hi[0]+6:0;
  for(const raw of $('#cutText').value.split('\n')){const line=raw.trim();if(!line)continue;
    const f=line.split(/[,\t;]+/).map(s=>s.trim()),qty=parseInt(f[0],10),mat=f[2]&&matchMat(f[2]),len=parseLen(f[3]||''),wid=parseLen(f[4]||'');
    if(f.length<4||!(qty>0)||qty>500||!f[1]||!mat||!(len>0)){bad.push(line);continue;}
    const m=M[mat],w=m.kind==='board'?(wid>0?Math.min(wid,m.w):m.w):(wid>0?wid:len);
    for(let i=0;i<qty;i++){const p=mk(f[1],mat,[len,m.t,w],[x,0,z]);p.l=r16(len);p.w=r16(w);p.t=m.t;p.ax=[0,2,1];parts.push(p);z+=w+1;}}
  if(!parts.length){$('#cutErr').textContent='No lines could be read. Each line needs: quantity, name, material, length.';return;}
  sel=new Set(addParts(parts));$('#cutDlg').close();setTab('design');commit();fit('fit');
  if(bad.length)alert(`Added ${parts.length} pieces. These lines could not be read and were skipped:\n\n${bad.join('\n')}`);};
$('#bUndo').onclick=undo;$('#bRedo').onclick=redo;
$('#bNew').onclick=()=>{if(S.parts.length&&!confirm('Start a new empty project? Save first if you want to keep this one.'))return;load(JSON.stringify(blank()));fit('fit');};
/* My projects: named designs kept in this browser, plus file export/import as a backup */
const getProjects=()=>{try{return JSON.parse(localStorage.getItem('woodshop.projects'))||{};}catch(e){return{};}};
const putProjects=o=>{try{localStorage.setItem('woodshop.projects',JSON.stringify(o));return true;}catch(e){alert('This browser is out of storage space for saved projects. Use "Download as a file" instead.');return false;}};
function renderProjects(){const pr=getProjects(),names=Object.keys(pr).sort((a,b)=>pr[b].t-pr[a].t);
  $('#projList').innerHTML=names.length?names.map(n=>`<div class="proj"><div><b>${esc(n)}</b><span>${pr[n].n} pieces · saved ${new Date(pr[n].t).toLocaleDateString()}</span></div><button data-open="${esc(n)}" class="primary">Open</button><button data-del="${esc(n)}" class="danger">Delete</button></div>`).join('')
    :'<div class="hint">Nothing saved yet. Press Save in the top bar to keep the design you are working on.</div>';}
function saveProject(){const pr=getProjects();pr[S.name]={t:Date.now(),n:S.parts.length,json:JSON.stringify(S)};
  if(putProjects(pr))toast('Saved "'+S.name+'" to My projects');}
$('#bSave').onclick=saveProject;
$('#bOpen').onclick=()=>{renderProjects();$('#projDlg').showModal();};
$('#bProjClose').onclick=()=>$('#projDlg').close();
$('#projList').onclick=e=>{const o=e.target.dataset.open,d=e.target.dataset.del,pr=getProjects();
  if(o&&pr[o]){load(pr[o].json);fit('fit');$('#projDlg').close();setTab('design');}
  if(d&&confirm(`Delete "${d}" from My projects? This cannot be undone.`)){delete pr[d];putProjects(pr);renderProjects();}};
$('#bImport').onclick=()=>$('#fileIn').click();
$('#bExport').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'}));
  a.download=(S.name.replace(/[^\w\- ]+/g,'').trim()||'project')+'.woodshop.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
$('#fileIn').onchange=e=>{const f=e.target.files[0];if(!f)return;f.text().then(t=>{try{const o=JSON.parse(t);if(!Array.isArray(o.parts))throw 0;load(t);fit('fit');$('#projDlg').close();}catch(err){alert('That file is not a WoodShop project.');}});e.target.value='';};
$('#bPrint').onclick=()=>{setTab('instr');setTimeout(()=>window.print(),300);};
$('#bInstr').onclick=()=>setTab('instr');
function openStyle(){renderStyle();$('#styleDlg').showModal();}
$('#bStyle').onclick=openStyle;$('#bStyleClose').onclick=()=>$('#styleDlg').close();
$('#styleCards').onclick=e=>{const c=e.target.closest('[data-style]');if(!c)return;look().style=c.dataset.style;commit();renderStyle();};
$('#woodSel').onchange=e=>{look().wood=e.target.value;commit();renderStyle();};
$('#finSel').onchange=e=>{look().finish=e.target.value;commit();renderStyle();};
$('#showFast').onchange=rebuildScene;$('#showDims').onchange=rebuildScene;
$('#viewMode').value=viewMode;$('#viewMode').onchange=e=>{viewMode=e.target.value;try{localStorage.setItem('woodshop.view',viewMode);}catch(err){}rebuildScene();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>fit(b.dataset.view));
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
window.addEventListener('keydown',e=>{
  if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)||$('#presetDlg').open)return;
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

/* ---------- preset dialog ---------- */
let curPreset=null;
renderPresetCards();
$('#presetCards').onclick=e=>{const c=e.target.closest('.card');if(!c)return;curPreset=PRESETS[+c.dataset.i];
  document.querySelectorAll('.card').forEach(x=>x.classList.toggle('on',x===c));
  $('#presetForm').innerHTML=`<h3>${esc(curPreset.name)}: set your size</h3><div class="grid">${curPreset.params.map(q=>q.head?`<h3 class="ph">${esc(q.head)}</h3>`:`<div class="f"><label>${esc(q.label)}</label>${
    q.opts?`<select data-k="${q.k}">${q.opts.map(([v,l])=>`<option value="${v}"${v===q.v?' selected':''}>${esc(l)}</option>`).join('')}</select>`
    :q.check?`<input type="checkbox" data-k="${q.k}"${q.v?' checked':''}>`
    :`<input type="text" data-k="${q.k}" value="${q.int||q.dec?q.v:fa(q.v)}">`}</div>`).join('')}</div>
    <div class="hint" id="presetInfo" style="font-size:13px;color:var(--ink)"></div>
    <div class="btnrow"><button class="primary" id="bPGo">Create ${esc(curPreset.name.toLowerCase())}</button>${S.parts.length?'<button id="bPAdd">Add next to current design</button>':''}</div>
    <div class="hint">Sizes are in inches; type feet like 10' or 8' 6. Lumber is standard US sizes as sold at Home Depot or Lowe's. Board tops round to the nearest whole board. Everything can be edited afterwards.</div>`;
  $('#bPGo').onclick=()=>makePreset(false);const ab=$('#bPAdd');if(ab)ab.onclick=()=>makePreset(true);
  const info=()=>{if(!curPreset.info)return;const v=readVals(false);$('#presetInfo').textContent=v?curPreset.info(v):'';};
  const pf=$('#presetForm');pf.oninput=info;
  pf.onchange=e=>{const q=curPreset.params.find(q=>q.k===e.target.dataset.k);
    if(q&&q.fill&&q.fill[e.target.value])for(const[k,v]of Object.entries(q.fill[e.target.value])){const t=curPreset.params.find(x=>x.k===k);$(`#presetForm [data-k="${k}"]`).value=t.int||t.dec?v:fmt(v);}
    else if(q&&!q.fill){const sz=curPreset.params.find(x=>x.fill);if(sz&&Object.values(sz.fill).some(f=>q.k in f)&&q.k!=='clr')$(`#presetForm [data-k="${sz.k}"]`).value='custom';}
    info();};
  info();
  $('#presetForm').scrollIntoView({block:'nearest'});};
function readVals(focusBad){
  const vals={};
  for(const q of curPreset.params){if(q.head)continue;const el=$(`#presetForm [data-k="${q.k}"]`);
    if(q.opts)vals[q.k]=el.value;else if(q.check)vals[q.k]=el.checked;
    else{const v=q.int?parseInt(el.value,10):q.dec?parseFloat(el.value):parseLen(el.value);
      if(isNaN(v)||v<0||v>1200){if(focusBad){el.focus();el.select();}return null;}vals[q.k]=v;}}
  return vals;
}
function makePreset(add){
  const vals=readVals(true);if(!vals)return;
  const parts=curPreset.build(vals);
  if(!parts.length){alert('Nothing fits with those sizes. Try a wider or taller space.');return;}
  const notes=curPreset.notes?curPreset.notes(vals):[],sf=curPreset.steps||STEPS[curPreset.name],steps=sf?sf(vals):[];
  if(add){const b=bbox(S.parts),dx=b?b.hi[0]+8:0;parts.forEach(p=>p.pos[0]=r16(p.pos[0]+dx));S.notes=(S.notes||[]).concat(notes);S.steps=[];}
  else{if(S.parts.length&&!confirm('Replace the current design with this preset?'))return;S.parts=[];S.joints={};S.stock={};S.name=curPreset.name;S.notes=notes;S.steps=steps;S.hw=[];S.look={style:'std',wood:'pine',finish:'clear'};}
  if(curPreset.hw)S.hw=(S.hw||[]).concat(curPreset.hw(vals));
  sel=new Set();addParts(parts);$('#presetDlg').close();setTab('design');commit();fit('fit');
}
$('#bPreset').onclick=()=>{$('#presetForm').innerHTML='';document.querySelectorAll('.card').forEach(x=>x.classList.remove('on'));$('#presetDlg').showModal();};
$('#bPresetClose').onclick=()=>$('#presetDlg').close();

/* ---------- boot ---------- */
let saved=null;try{saved=localStorage.getItem('woodshop.autosave');}catch(e){}
try{load(saved||JSON.stringify(blank()));}catch(e){load(JSON.stringify(blank()));}
resize();fit('fit');
if(!S.parts.length)$('#presetDlg').showModal();
