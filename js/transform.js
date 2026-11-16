/* WoodShop Designer: moving and turning pieces the way 3D programs do it.
   - Gizmo: colored arrows (move along one direction) and rings (turn about one direction) drawn on the selection.
   - Hotkeys: M move, R rotate, S stretch. Then X / Y / Z locks a direction, typing gives an exact amount,
     click or Enter keeps it, Esc or right-click cancels.
   - Shift + drag on empty space selects everything inside a box.
   Directions follow the usual 3D convention: X is left-right (red), Y is front-back (green), Z is up (blue). */
'use strict';
const gizmoGroup=new THREE.Group();scene.add(gizmoGroup);
const GCOL=[0xe53935,0x1e88e5,0x43a047],GNAME=['X (left-right)','Z (up-down)','Y (front-back)']; // indexed by world axis
const KEYAXIS={x:0,y:2,z:1};
const HOTKEY={m:'g',r:'r',s:'s'}; // M move, R rotate, S stretch (inside the code the move operation is called 'g')
let modal=null,lastMouse=null;
function selCenter(){const b=bbox(selParts());return b?b.lo.map((v,i)=>(v+b.hi[i])/2):null;}
function buildGizmo(){
  while(gizmoGroup.children.length){const c=gizmoGroup.children.pop();c.traverse(o=>{o.geometry&&o.geometry.dispose();o.material&&o.material.dispose();});}
  gizmoGroup.position.set(0,0,0);gizmoGroup.visible=true; if(explode)return;
  if(!sel.size||lite||modal||(tool!=='select'&&tool!=='rotate'))return;
  const c=selCenter(),L=cam.r*.13;if(!c)return;
  for(let k=0;k<3;k++){const mat=new THREE.MeshBasicMaterial({color:GCOL[k],depthTest:false,transparent:true,opacity:.95}),g=new THREE.Group();let hit;
    if(tool==='select'){ // an arrow pointing along axis k
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(L*.018,L*.018,L,8),mat),tip=new THREE.Mesh(new THREE.ConeGeometry(L*.07,L*.22,12),mat);
      hit=new THREE.Mesh(new THREE.CylinderGeometry(L*.09,L*.09,L*1.25,8),new THREE.MeshBasicMaterial({visible:false}));
      shaft.position.y=L/2;tip.position.y=L*1.1;hit.position.y=L*.62;shaft.renderOrder=tip.renderOrder=9;g.add(shaft,tip,hit);
      if(k===0)g.rotation.z=-Math.PI/2;else if(k===2)g.rotation.x=Math.PI/2;hit.userData={gz:'axis',k};}
    else{ // a ring to turn about axis k
      const ring=new THREE.Mesh(new THREE.TorusGeometry(L,L*.02,8,64),mat);hit=new THREE.Mesh(new THREE.TorusGeometry(L,L*.1,6,32),new THREE.MeshBasicMaterial({visible:false}));
      ring.renderOrder=9;g.add(ring,hit);if(k===0)g.rotation.y=Math.PI/2;else if(k===1)g.rotation.x=Math.PI/2;hit.userData={gz:'ring',k};}
    g.position.set(c[0],c[1],c[2]);gizmoGroup.add(g);}
}
/* how far along the line through c in direction k the mouse is pointing */
function axisCoord(k,c){const A=AXV[k],D=ray.ray.direction,w0=ray.ray.origin.clone().sub(new THREE.Vector3(c[0],c[1],c[2])),b=D.dot(A),den=1-b*b;
  return den<1e-5?0:(A.dot(w0)-b*D.dot(w0))/den;}
/* the angle of the mouse around axis k through c, measured in the plane square to that axis */
function ringAngle(k,c){const pt=new THREE.Vector3(),C=new THREE.Vector3(c[0],c[1],c[2]);
  if(!ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(AXV[k],C),pt))return null;
  const v=pt.sub(C).toArray();return Math.atan2(v[(k+2)%3],v[(k+1)%3]);}
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
function gizmoHit(e){
  if(!gizmoGroup.children.length)return null;setRay(e);
  const h=ray.intersectObjects(gizmoGroup.children,true).find(h=>h.object.userData.gz);if(!h)return null;
  const{gz,k}=h.object.userData,c=selCenter();fastGroup.visible=dimGroup.visible=handleGroup.visible=false;
  return gz==='axis'?{mode:'axis',k,c,s0:axisCoord(k,c),...moveState([...sel][0])}:{mode:'ring',k,c,a0:ringAngle(k,c),snap:snapshot()};
}
function axisDrag(e){setRay(e);const d=[0,0,0];d[drag.k]=axisCoord(drag.k,drag.c)-drag.s0;
  const dl=applyMove(drag,d,[drag.k],e.altKey);gizmoGroup.position.set(dl[0],dl[1],dl[2]);
  $('#status').innerHTML=`Moving along ${GNAME[drag.k]}: <b>${fmt(dl[drag.k])}</b>. Hold Alt to turn snapping off.`;draw();}
function ringDrag(e){setRay(e);const a=ringAngle(drag.k,drag.c);if(a===null||drag.a0===null)return;
  const ang=snapAngle(wrapAngle(a-drag.a0),e.altKey);applyRot(drag.snap,drag.k,ang,drag.c);
  $('#status').innerHTML=`Turning about ${GNAME[drag.k]}: <b>${Math.round(ang*1800/Math.PI)/10}°</b>. Snaps every 15°; hold Alt for any angle.`;draw();}
const snapAngle=(a,free)=>free?Math.round(a*180/Math.PI)*Math.PI/180:Math.round(a/(Math.PI/12))*Math.PI/12;

/* remember the selection exactly as it is, so a turn can be previewed, redone from scratch, or cancelled */
function snapshot(){return new Map(selParts().map(p=>{const s=size(p);return[p.id,{pos:p.pos.slice(),ax:p.ax.slice(),rot:p.rot&&{...p.rot},q:p.q&&p.q.slice(),l:p.l,c:p.pos.map((v,i)=>v+s[i]/2)}];}));}
function restore(snap){for(const[id,s]of snap){const p=byId(id);if(!p)continue;p.pos=s.pos.slice();p.ax=s.ax.slice();p.l=s.l;delete p.rot;delete p.q;if(s.rot)p.rot={...s.rot};if(s.q)p.q=s.q.slice();}}
function applyRot(snap,k,ang,pivot){ // turn the remembered selection by ang about axis k through pivot
  const R=new THREE.Quaternion().setFromAxisAngle(AXV[k],ang),P=new THREE.Vector3(pivot[0],pivot[1],pivot[2]);
  restore(snap);
  for(const[id,s]of snap){const p=byId(id);if(!p)continue;
    const c=new THREE.Vector3(s.c[0],s.c[1],s.c[2]).sub(P).applyQuaternion(R).add(P),q=R.clone().multiply(quatOf(p)||new THREE.Quaternion()),sz=size(p);
    delete p.rot;p.q=[q.x,q.y,q.z,q.w];p.pos=[c.x-sz[0]/2,c.y-sz[1]/2,c.z-sz[2]/2];setMeshPos(p);}
}
function finishRot(){ // tidy up after a turn: fold quarter turns back to square, round positions, keep everything above the floor
  for(const p of selParts()){setQuat(p,quatOf(p)||new THREE.Quaternion());p.pos=p.pos.map(r16);const b=box(p);if(b.lo[1]<0)p.pos[1]=r16(p.pos[1]-b.lo[1]);}
}

/* ---------- M / R / S: start with a key, steer with the mouse or type a number ---------- */
function startModal(type){
  if(tab!=='design'||!sel.size||modal||drag)return false;
  if(type==='s'&&(sel.size!==1||isProp(selParts()[0]))){toast('Select one board to stretch with S.');return true;}
  modal={type,axis:type==='r'?1:null,num:'',c:selCenter(),snap:snapshot(),st:moveState([...sel][0]),ref:null};
  fastGroup.visible=dimGroup.visible=false;buildHandles();buildGizmo();modalStatus();draw();return true;
}
function modalStatus(extra){const m=modal,ax=m.axis===null?'':` along <b>${GNAME[m.axis]}</b>`;
  const what=m.type==='g'?`Move${ax}`:m.type==='r'?`Rotate about <b>${GNAME[m.axis]}</b>`:'Stretch';
  $('#status').innerHTML=`<b>${what}</b>${m.num?`: typed <b>${esc(m.num)}</b>`:extra?': <b>'+extra+'</b>':''}<br>Move the mouse${m.type==='s'?'':', press X, Y or Z to lock a direction'}, or type an exact ${m.type==='r'?'angle':'size'}. Click or Enter to keep it, Esc to cancel.`;}
function modalMove(e){
  const m=modal;if(!m||m.num)return;setRay(e);const c=m.c;
  if(m.type==='g'){const d=[0,0,0];let axes;
    if(m.axis===null){const pt=new THREE.Vector3();if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-c[1]),pt))return;
      if(!m.ref)m.ref=pt.clone();d[0]=pt.x-m.ref.x;d[2]=pt.z-m.ref.z;axes=[0,2];}
    else{const s=axisCoord(m.axis,c);if(m.ref===null)m.ref=s;d[m.axis]=s-m.ref;axes=[m.axis];}
    const dl=applyMove(m.st,d,axes,e.altKey);modalStatus(axes.map(k=>fmt(dl[k])).join(', '));}
  else{const v=new THREE.Vector3(c[0],c[1],c[2]).project(camera),r=cv.getBoundingClientRect(),px=(v.x+1)/2*r.width+r.left,py=(1-v.y)/2*r.height+r.top;
    if(m.type==='r'){const th=Math.atan2(e.clientY-py,e.clientX-px);if(m.ref===null)m.ref=th;
      const toward=AXV[m.axis].dot(camera.position.clone().sub(new THREE.Vector3(c[0],c[1],c[2])))>0?1:-1,ang=snapAngle(-wrapAngle(th-m.ref)*toward,e.altKey);
      applyRot(m.snap,m.axis,ang,c);m.ang=ang;modalStatus(Math.round(ang*1800/Math.PI)/10+'°');draw();}
    else{const dist=Math.hypot(e.clientX-px,e.clientY-py);if(m.ref===null)m.ref=Math.max(20,dist);
      const p=selParts()[0],g=parseFloat($('#gridSel').value);p.l=Math.max(1,Math.round(m.snap.get(p.id).l*dist/m.ref/g)*g);lite=true;rebuildScene();modalStatus(fmt(p.l)+' long');}}
}
function modalTyped(){ // apply the number typed so far
  const m=modal;if(!m.num){restore(m.snap);rebuildScene();modalStatus();return;}
  if(m.type==='g'){const v=parseLen(m.num),k=m.axis===null?0:m.axis,d=[0,0,0];if(isNaN(v))return modalStatus();d[k]=v;applyMove(m.st,d,[k],true);}
  else if(m.type==='r'){const v=parseFloat(m.num);if(isNaN(v))return modalStatus();applyRot(m.snap,m.axis,v*Math.PI/180,m.c);draw();}
  else{const v=parseLen(m.num);if(isNaN(v)||v<=0)return modalStatus();selParts()[0].l=r16(v);lite=true;rebuildScene();}
  modalStatus();
}
function modalEnd(keep){
  const m=modal;if(!m)return;modal=null;lite=false;
  if(keep){if(m.type==='r')finishRot();commit();}
  else{if(m.isNew){S.parts=S.parts.filter(p=>!sel.has(p.id));sel=new Set();}else restore(m.snap);renderAll();} // cancelling a duplicate-and-drag removes the copy
}
/* returns true when the key belonged to M / R / S, so nothing else should react to it */
function modalKey(e){
  const k=e.key.toLowerCase(),c=e.ctrlKey||e.metaKey;
  if(!modal)return!c&&!e.shiftKey&&tab==='design'&&k in HOTKEY?startModal(HOTKEY[k]):false;
  const m=modal;
  if(k==='enter')modalEnd(true);else if(k==='escape')modalEnd(false);
  else if(k in KEYAXIS&&m.type!=='s'){const a=KEYAXIS[k];m.axis=m.type==='g'&&m.axis===a?null:a;m.ref=null;restore(m.snap);for(const p of selParts())setMeshPos(p);
    if(m.num)modalTyped();else{modalStatus();draw();if(lastMouse)modalMove(lastMouse);}}
  else if(k==='backspace'){m.num=m.num.slice(0,-1);modalTyped();}
  else if(/^[0-9.\-\/' ]$/.test(e.key)){m.num+=e.key;modalTyped();}
  return true;
}

/* ---------- box select: Shift + drag on empty space ---------- */
function boxDrag(e){const r=$('#cvWrap').getBoundingClientRect(),el=$('#boxSel'),x0=Math.min(drag.sx,e.clientX),y0=Math.min(drag.sy,e.clientY);
  drag.x1=e.clientX;drag.y1=e.clientY;el.style.cssText=`display:block;left:${x0-r.left}px;top:${y0-r.top}px;width:${Math.abs(e.clientX-drag.sx)}px;height:${Math.abs(e.clientY-drag.sy)}px`;}
function boxEnd(d){
  $('#boxSel').style.display='none';if(!d.moved)return;
  const r=cv.getBoundingClientRect(),x0=Math.min(d.sx,d.x1),x1=Math.max(d.sx,d.x1),y0=Math.min(d.sy,d.y1),y1=Math.max(d.sy,d.y1),hit=d.add?new Set(sel):new Set();
  for(const p of S.parts){if(hiddenIds.has(p.id))continue;const b=box(p),v=new THREE.Vector3((b.lo[0]+b.hi[0])/2,(b.lo[1]+b.hi[1])/2,(b.lo[2]+b.hi[2])/2).project(camera);
    const x=(v.x+1)/2*r.width+r.left,y=(1-v.y)/2*r.height+r.top;if(v.z<1&&x>=x0&&x<=x1&&y>=y0&&y<=y1)hit.add(p.id);}
  sel=hit;renderAll();
}

/* ---------- copy tools: duplicate and drag, copy in a row, mirror ---------- */
const clonePart=p=>({...p,ax:p.ax.slice(),pos:p.pos.slice(),rot:p.rot&&{...p.rot},q:p.q&&p.q.slice()});
function dupGrab(){ // make a copy on top of the selection and start moving it straight away (Shift+D)
  const ps=selParts();if(!ps.length||modal||tab!=='design')return;
  sel=new Set(addParts(regroup(ps.map(clonePart))));rebuildScene();if(startModal('g')&&modal)modal.isNew=true;}
function copyRow(n,k,step){ // n more copies, each one "step" further along axis k
  const ps=selParts();if(!ps.length||!(n>0)||!step)return;const ids=[];
  for(let i=1;i<=n;i++)ids.push(...addParts(regroup(ps.map(p=>{const c=clonePart(p);c.pos[k]=r16(c.pos[k]+i*step);return c;}))));
  sel=new Set([...sel,...ids]);commit();toast(`Added ${n} cop${n>1?'ies':'y'}, ${fmt(Math.abs(step))} apart`);}
function mirrorSel(k,about,keep){ // flip the selection across a plane square to axis k
  const ps=selParts();if(!ps.length)return;const b=bbox(about==='design'?S.parts:ps),m=about==='lo'?b.lo[k]:about==='hi'?b.hi[k]:(b.lo[k]+b.hi[k])/2,out=keep?regroup(ps.map(clonePart)):ps;
  for(const p of out){const s=size(p);p.pos[k]=r16(2*m-p.pos[k]-s[k]);
    if(p.q)p.q=p.q.map((v,i)=>i<3&&i!==k?-v:v);else if(p.rot&&p.rot.k!==k)p.rot.deg=-p.rot.deg;
    const pb=box(p);if(pb.lo[1]<0)p.pos[1]=r16(p.pos[1]-pb.lo[1]);}
  if(keep)sel=new Set(addParts(out));commit();toast(keep?'Mirrored copy added':'Mirrored');}
const needSel=()=>{if(tab!=='design')setTab('design');if(sel.size)return true;toast('Select one or more pieces first.');return false;};
function openRow(){if(!needSel())return;rowSpacing();$('#rowDlg').showModal();}
function rowSpacing(){const b=bbox(selParts()),k=+$('#rowDir').value;if(b)$('#rowStep').value=fmt(b.hi[k]-b.lo[k]);}
function openMirror(){if(needSel())$('#mirrorDlg').showModal();}
$('#rowDir').onchange=rowSpacing;
$('#bRowGo').onclick=()=>{const n=parseInt($('#rowN').value,10),step=parseLen($('#rowStep').value);
  if(!(n>0)||n>200){$('#rowN').focus();return;}if(isNaN(step)||!step){$('#rowStep').focus();return;}
  $('#rowDlg').close();copyRow(n,+$('#rowDir').value,step);};
$('#bMirrorGo').onclick=()=>{$('#mirrorDlg').close();mirrorSel(+$('#mirDir').value,$('#mirAbout').value,$('#mirKeep').checked);};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
