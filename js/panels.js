/* WoodShop Designer: side panels (piece list, properties, status) and the Joints tab */
'use strict';
/* ---------- panels ---------- */
function renderParts(){
  $('#partCount').textContent=S.parts.length?`(${S.parts.length})`:'';
  $('#partList').innerHTML=(S.parts.length>400?`<div class="hint">Showing the first 400 of ${S.parts.length} pieces. Click any piece in the 3D view to select it.</div>`:'')+S.parts.slice(0,400).map(p=>`<li data-id="${p.id}" class="${sel.has(p.id)?'on':''}${hiddenIds.has(p.id)?' hid':''}"><span>${esc(p.name)}</span><small>${esc(M[p.mat].short)} · ${fmt(p.l)}</small></li>`).join('')
    ||'<div class="hint">Nothing here yet. Pick a furniture preset, or add a board above.</div>';
}
$('#partList').addEventListener('click',e=>{const li=e.target.closest('li');if(!li)return;const id=+li.dataset.id;
  if(e.ctrlKey||e.metaKey){sel.has(id)?sel.delete(id):sel.add(id);}else sel=new Set([id]);renderAll();});
function renderProps(){
  const ps=selParts(),el=$('#props');
  if(!ps.length){el.innerHTML=`<h3>How it works</h3>
    <div class="hint"><b>Click</b> a piece to select it, then <b>drag</b> to slide it across the floor. It snaps to other pieces.</div>
    <div class="hint"><b>Shift + drag</b> raises or lowers it. <b>Alt</b> turns snapping off.</div>
    <div class="hint"><b>Drag empty space</b> to look around, <b>right-drag</b> to pan, <b>scroll</b> to zoom.</div>
    <div class="hint"><b>Ctrl + click</b> selects several pieces so they move together.</div>
    <div class="hint">Keys: arrows nudge, PgUp/PgDn raise/lower, R turns, Ctrl+D copies, Delete removes.</div>
    <div class="hint">Type sizes like <b>36</b>, <b>3 1/2</b> or <b>4' 6</b>.</div>`;return;}
  if(ps.length>1){const b=bbox(ps);el.innerHTML=`<h3>${ps.length} pieces selected</h3>
    <div class="hint">Together: ${fmt(b.hi[0]-b.lo[0])} wide × ${fmt(b.hi[2]-b.lo[2])} deep × ${fmt(b.hi[1]-b.lo[1])} tall</div>
    ${ps.length===2?(()=>{const A=box(ps[0]),B=box(ps[1]),lab=['Left to right','Up and down','Front to back'],rows=[0,2,1].map(k=>{const g=Math.max(A.lo[k]-B.hi[k],B.lo[k]-A.hi[k]);
        return`<div class="f"><label>${lab[k]}</label><span class="ro"><b>${g>.01?fmt(g)+' gap':g>-.01?'touching':'overlap '+fmt(-g)}</b></span></div>`;}).join('');
      const[ia,ib]=[...sel],jn=findJoints().find(j=>(j.a.id===ia&&j.b.id===ib)||(j.a.id===ib&&j.b.id===ia));let cn;
      if(jn){const t=jType(jn),sp=jSpec(jn,t);cn=`<div class="hint">The ${jn.fa} of <b>${esc(jn.a.name)}</b> meets the ${jn.fb} of <b>${esc(jn.b.name)}</b>.</div>
        <div class="f"><label>Fasten with</label><select data-f="jt" data-key="${jn.key}">${Object.entries(JTYPES).map(([k,v])=>`<option value="${k}"${k===t?' selected':''}>${v[0]}</option>`).join('')}</select></div>
        <div class="hint"><b>${esc(sp.text)}</b><br>${esc(JTYPES[t][2])}</div>`;}
      else cn=`<div class="hint">These two are not touching yet.</div><div class="btnrow"><button data-act="connect" class="primary">Connect them</button></div>
        <div class="hint">Moves, stretches or trims <b>${esc((byId(ia)||{}).name||'')}</b> (the one you picked first) so it meets <b>${esc((byId(ib)||{}).name||'')}</b>, then suggests the fastener.</div>`;
      return`<h3 style="margin-top:12px">Connection</h3>${cn}<h3 style="margin-top:12px">Tape measure</h3><div class="hint">Space between <b>${esc(ps[0].name)}</b> and <b>${esc(ps[1].name)}</b>:</div>${rows}`;})():'<div class="hint">Select exactly two pieces to measure the gap between them.</div>'}
    <div class="btnrow"><button data-act="dup">Duplicate</button><button data-act="row">Copy in a row</button><button data-act="mirror">Mirror</button><button data-act="del" class="danger">Delete</button></div>`;return;}
  const p=ps[0],m=M[p.mat];
  if(m.kind==='prop'){el.innerHTML=`<h3>${esc(m.short)}</h3>
    <div class="hint">${fmt(p.l)} long × ${fmt(p.w)} front-to-back × ${fmt(p.t)} tall. Shown for reference only; it is not in the cut list.</div>
    <div class="f"><label>From left</label><input type="text" data-f="x" value="${fa(p.pos[0])}"></div>
    <div class="f"><label>From back</label><input type="text" data-f="z" value="${fa(p.pos[2])}"></div>
    <div class="f"><label>Off the floor</label><input type="text" data-f="y" value="${fa(p.pos[1])}"></div>
    <div class="btnrow"><button data-act="drop">Drop down</button><button data-act="dup">Duplicate</button><button data-act="row">Copy in a row</button><button data-act="mirror">Mirror</button><button data-act="del" class="danger">Delete</button></div>`;return;}
  el.innerHTML=`<h3>Selected piece</h3>
   <div class="f"><label>Name</label><input type="text" data-f="name" value="${esc(p.name)}"></div>
   <div class="f"><label>Material</label><select data-f="mat">${MATS.filter(x=>x.kind!=='prop').map(x=>`<option value="${x.id}"${x.id===p.mat?' selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
   <div class="f"><label>Length</label><input type="text" data-f="l" value="${fa(p.l)}"></div>
   <div class="f"><label>Width</label><input type="text" data-f="w" value="${fa(p.w)}"></div>
   <div class="f"><label>Thickness</label><span class="ro">${fmt(p.t)}</span></div>
   ${m.kind==='board'?`<div class="hint">A ${m.short} is really ${fmt(m.t)} × ${fmt(m.w)}. A narrower width means a rip cut.</div>`:''}
   <h3 style="margin-top:12px">Position</h3>
   <div class="f"><label>From left</label><input type="text" data-f="x" value="${fa(p.pos[0])}"></div>
   <div class="f"><label>From back</label><input type="text" data-f="z" value="${fa(p.pos[2])}"></div>
   <div class="f"><label>Off the floor</label><input type="text" data-f="y" value="${fa(p.pos[1])}"></div>
   <div class="btnrow"><button data-act="drop" title="Lower until it rests on the floor or the piece below">Drop down</button></div>
   <h3 style="margin-top:12px">Turn</h3>
   <div class="btnrow"><button data-act="rotY" title="R">Spin flat</button><button data-act="rotX">Tip front/back</button><button data-act="rotZ">Tip sideways</button></div>
   <h3 style="margin-top:12px">Angle (braces, splayed legs)</h3>
   <div class="f"><label>Tilt, degrees</label><input type="text" data-f="deg" value="${p.rot?p.rot.deg:p.q?angleOf(p):0}"></div>
   <div class="f"><label>Direction</label><select data-f="rax">${[[2,'Lean left / right'],[0,'Lean front / back'],[1,'Swing flat (like a clock hand)']].map(([k,l])=>`<option value="${k}"${(p.rot?p.rot.k:2)===k?' selected':''}>${l}</option>`).join('')}</select></div>
   ${tilted(p)?'<div class="hint">Angled pieces are drawn and added to the cut list, but their joints are not worked out automatically. Cut the ends to match the angle and add your own screws.</div>':''}
   <div class="btnrow"><button data-act="dup">Duplicate</button><button data-act="row">Copy in a row</button><button data-act="mirror">Mirror</button><button data-act="del" class="danger">Delete</button></div>`;
}
$('#props').addEventListener('change',e=>{
  const f=e.target.dataset.f,p=selParts()[0];if(!f||!p)return;const m=M[p.mat];
  if(f==='jt'){S.joints[e.target.dataset.key]=e.target.value;commit();return;}
  if(f==='name'){p.name=e.target.value.trim()||'Piece';}
  else if(f==='mat'){const nm=M[e.target.value];p.mat=nm.id;p.t=nm.t;if(nm.kind==='board')p.w=nm.w;}
  else if(f==='deg'){const v=parseFloat(e.target.value);if(isNaN(v)){renderProps();return;}
    const d=Math.max(-90,Math.min(90,Math.round(v*2)/2));delete p.q;if(d)p.rot={k:p.rot?p.rot.k:2,deg:d};else delete p.rot;}
  else if(f==='rax'){delete p.q;p.rot={k:+e.target.value,deg:p.rot?p.rot.deg:0};}
  if(f==='deg'||f==='rax'){const b=box(p);if(b.lo[1]<0)p.pos[1]=r16(p.pos[1]-b.lo[1]);} // keep a tilted piece above the floor
  else if(f!=='name'&&f!=='mat'){const v=parseLen(e.target.value);if(isNaN(v)){renderProps();return;}
    if(f==='l'){if(v<=0){renderProps();return;}p.l=r16(v);}
    else if(f==='w'){if(v<=0){renderProps();return;}p.w=r16(m.kind==='board'?Math.min(v,m.w):v);}
    else p.pos['xyz'.indexOf(f)]=r16(f==='y'?Math.max(0,v):v);}
  commit();
});
$('#props').addEventListener('click',e=>{
  const a=e.target.dataset.act;if(!a)return;const p=selParts()[0];
  if(a==='row'){openRow();return;}if(a==='mirror'){openMirror();return;}
  if(a==='connect'){const[ia,ib]=[...sel],msg=connectParts(byId(ia),byId(ib));commit();toast(msg);return;}
  if(a==='del')delSel();else if(a==='dup')dupSel();
  else if(a==='drop'){p.pos[1]=dropPart(p);commit();}
  else if(a.startsWith('rot')){rotatePart(p,'XYZ'.indexOf(a[3]));commit();}
});
function renderStatus(){
  const b=bbox(S.parts);
  $('#status').innerHTML=b?`Overall size: <b>${fmt(b.hi[0]-b.lo[0])} wide × ${fmt(b.hi[2]-b.lo[2])} deep × ${fmt(b.hi[1]-b.lo[1])} tall</b> &nbsp;·&nbsp; ${S.parts.length} pieces &nbsp;·&nbsp; grid squares are 12"`+(()=>{const tk=S.parts.filter(p=>p.mat==='tank'&&p.gal);if(!tk.length)return'';const g=tk.reduce((a,p)=>a+p.gal,0);
      return` &nbsp;·&nbsp; <b>${tk.length} tank${tk.length>1?'s':''}, ${Math.round(g).toLocaleString()} gallons, about ${Math.round(g*11.25).toLocaleString()} lb filled</b>`;})()+(S.notes&&S.notes[0]?`<br>${esc(S.notes[0])} See the Cut list tab for weight and safety notes.`:'')
    :'Start with <b>Furniture presets</b>, or click <b>Draw a board</b> above and drag on the floor.';
  const hint=tool==='draw'?'<b>Draw mode.</b> Pick a material on the left, then drag on the floor, or on top of a piece, to draw it. Hold Shift to stand a board upright. Press Esc when you are done.'
    :tool==='connect'?(connectFirst?'<b>Connect.</b> Now click the piece it should meet. That one stays where it is.':'<b>Connect.</b> Click the piece you want to move or stretch.'):'';
  if(hint)$('#status').innerHTML=hint+'<br>'+$('#status').innerHTML;
  const cl=findClashes();if(cl.length)$('#status').innerHTML=`<b class="warn">Overlap:</b> ${esc(cl[0][0].name)} and ${esc(cl[0][1].name)} are in the same space${cl.length>1?`, and ${cl.length-1} more pair${cl.length>2?'s':''}`:''}. They are shown in red; move or shorten one.<br>`+$('#status').innerHTML;
  if(hiddenIds.size)$('#status').innerHTML+=` &nbsp;·&nbsp; <b>${hiddenIds.size} hidden</b> (Alt+H shows everything)`;
}

/* ---------- joints page ---------- */
function renderJoints(){
  const js=findJoints(),groups=jointGroups(js),hw=hardwareTotals(js);
  let h=`<h2>How the pieces join</h2><div class="hint">Every place two pieces touch is listed here with a suggested fastener. Change any of them; the hardware list updates.</div>`;
  if(!groups.length)h+='<p>No pieces are touching yet. Slide pieces together in the Design tab and the joints appear here.</p>';
  else{h+=`<table><tr><th>Pieces</th><th>Joints</th><th>How they meet</th><th>Fasten with</th><th>Per joint</th></tr>`;
    groups.forEach((g,i)=>{const types=new Set(g.js.map(jType)),cur=types.size===1?[...types][0]:'';
      const sp=cur?jSpec(g.js[0],cur):null;
      h+=`<tr><td><b>${esc(g.A[0])}</b> to <b>${esc(g.B[0])}</b></td><td class="n">${g.js.length}</td><td>${g.A[1]} to ${g.B[1]}</td>
        <td><select data-g="${i}">${cur?'':'<option value="" selected>(mixed)</option>'}${Object.entries(JTYPES).map(([k,v])=>`<option value="${k}"${k===cur?' selected':''}>${v[0]}</option>`).join('')}</select></td>
        <td>${sp?esc(sp.text)+`<div class="hint">${esc(JTYPES[cur][2])}</div>`:'—'}</td></tr>`;});
    h+=`</table><div class="btnrow noprint"><button id="bJReset">Reset all to suggested</button></div>`;}
  h+=`<h2>Hardware to buy</h2>`+hwTable(hw);
  h+=`<h2>Dots in the 3D view</h2><div class="hint">${Object.entries(JTYPES).filter(([k])=>k!=='none'&&k!=='glue').map(([k,v])=>`<span class="dot" style="background:#${v[1].toString(16).padStart(6,'0')}"></span>${v[0]}`).join(' &nbsp; ')}</div>`;
  const el=$('#jointsPage');el.innerHTML=h;
  el.querySelectorAll('select[data-g]').forEach(s=>s.onchange=()=>{if(!s.value)return;groups[+s.dataset.g].js.forEach(j=>S.joints[j.key]=s.value);commit();});
  const rb=$('#bJReset');if(rb)rb.onclick=()=>{S.joints={};commit();};
}
function hwTable(hw){
  if(!hw.rows.length&&!hw.glue)return'<p>No hardware needed yet.</p>';
  return`<table style="max-width:520px"><tr><th>Item</th><th>Quantity</th></tr>${hw.rows.map(([k,q])=>`<tr><td>${esc(k)}</td><td class="n">${q}</td></tr>`).join('')}${hw.glue?'<tr><td>Wood glue</td><td class="n">1 bottle</td></tr>':''}</table><div class="hint">Buy a few extra screws; boxes are cheap and some will strip.</div>`;
}

