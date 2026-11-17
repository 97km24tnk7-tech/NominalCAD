/* NominalCAD: mouse handling and the on-screen tools: move, draw, resize, connect */
'use strict';
/* ---------- mouse ---------- */
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let drag=null;
function setRay(e){const r=cv.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);}
function pick(e){setRay(e);const hits=ray.intersectObjects(partsGroup.children.map(g=>g.children[0]));return hits[0]||null;}
/* Right-click belongs to the program everywhere except where the browser's own menu is useful: in a box you type
   in (copy and paste) and on the document pages (copy text, save a picture). The program's menu opens under the
   pointer a moment BEFORE the browser asks about its own menu, so the question arrives on our menu, not on the
   3D view: this has to cover the whole page or the browser's menu lands on top of ours. */
document.addEventListener('contextmenu',e=>{
  if(e.target.closest&&e.target.closest('input,textarea,.page'))return;
  e.preventDefault();
});
SELFTESTS.push(function rightClickMenu(problems){
  // true when the browser would have shown its own menu for a right-click on this element
  const browserMenuOn=el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
  const typing=document.createElement('input');document.body.appendChild(typing);
  if(browserMenuOn(cv))problems.push('right-click: the browser menu would open over the 3D view');
  if(browserMenuOn($('#ctxMenu')))problems.push('right-click: the browser menu would open on top of the program\'s own right-click menu');
  if(!browserMenuOn(typing))problems.push('right-click: a box you type in lost the browser\'s copy and paste menu');
  typing.remove();
});
cv.addEventListener('pointerdown',e=>{
  try{cv.setPointerCapture(e.pointerId);}catch(err){} // keeps the drag when the pointer leaves the view; a pointer that cannot be captured still drags
  const base={sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:false};
  if(modal){modalEnd(e.button===0);return;} // while M / R / S is running, a click places it and a right-click cancels
  if(e.button!==0){const h=pick(e);drag={...base,mode:'pan',hitId:h?h.object.userData.id:null};return;} // right button: drag to slide the view, click for the menu
  if(tool==='draw'){startDraw(e,base);return;}
  if(placeDrawerClick(e))return;                            // Add, Drawer is waiting for a click inside a space (js/drawertool.js)
  if(placeHardwareClick(e))return;                          // the Hardware tool is waiting for a click on a piece (js/hardwaretool.js)
  if(viewPickDown(e,base,true))return;                      // the handle that opens a door or a drawer (js/viewpick.js)
  // What the pointer grabs on a selected piece, in this order: a blue stretch handle, then a move arrow or a ring,
  // then the piece itself. The handle goes first because it sits on the end of the piece, where a move arrow
  // often reaches too; if the arrow went first the handle could not be grabbed there.
  setRay(e);const hh=ray.intersectObjects(handleGroup.children)[0];
  if(hh){const q=selParts()[0],b=box(q),{k,side}=hh.object.userData; // grab a blue handle to stretch or shorten the piece
    drag={...base,mode:'resize',id:q.id,k,side,lo:b.lo.slice(),hi:b.hi.slice(),P:hh.object.position.clone(),off:hh.object.position.getComponent(k)-(side?b.hi[k]:b.lo[k])};lite=true;return;}
  const gz=gizmoHit(e);if(gz){drag={...base,...gz};return;} // an arrow or a ring of the transform gizmo
  if(viewPickDown(e,base,false))return;                     // a fastener or a piece of hardware
  const hit=pick(e);if(explode&&hit){setExplode(0);drag=null;return;} // clicking a piece puts an exploded view back together
  if(tool==='connect'){if(hit)connectClick(hit.object.userData.id);else drag={...base,mode:'orbit'};return;}
  if(!hit){drag={...base,mode:e.shiftKey?'box':'orbit',add:e.ctrlKey||e.metaKey};return;} // Shift + drag on empty space draws a selection box
  const id=hit.object.userData.id,ctrl=e.ctrlKey||e.metaKey;
  const picked=pickIds(id),again=sel.has(id)&&!ctrl; // one piece or its component, by the Pick switch (js/components.js)
  if(ctrl){const on=sel.has(id);picked.forEach(i=>on?sel.delete(i):sel.add(i));}else if(!sel.has(id))sel=new Set(picked);
  renderAll();
  if(tool==='rotate'&&again)pickAgain(id);
  if(!sel.has(id)||tool==='rotate'){drag=null;return;}
  const vertical=e.shiftKey,n=new THREE.Vector3();
  if(vertical){camera.getWorldDirection(n);n.y=0;if(n.lengthSq()<1e-6)n.set(0,0,1);n.normalize();}else n.set(0,1,0);
  drag={...base,mode:'move',again,vertical,pt:hit.point.clone(),plane:new THREE.Plane().setFromNormalAndCoplanarPoint(n,hit.point),...moveState(id)};
});
/* Everything a move needs to remember when it starts. What moves is the selection AND every piece fastened to it
   (movingParts, js/connections.js): a board that is screwed to another never slides away from its screws.
     items      one entry per moving piece: {p, start (its position now), off and ext (its outer bounds: where they
                begin relative to the position, and how big they are)}
     first      the entry of the piece that was picked; the grid snaps to it and the readout is about it
     snappers   the entries whose faces and middles snap to other pieces. Every piece of a small set; for a big
                set (a whole wall) only the picked piece and the set as one box, or each mouse move would compare
                thousands of pieces with thousands of others.
     others     the outer bounds of everything that stays where it is: what the move snaps to */
const SNAP_PIECES_MAX=40;
function moveState(primary){
  const moving=movingParts(),ids=movingIds();
  const items=moving.map(p=>{
    const b=box(p);
    return{p,start:p.pos.slice(),off:b.lo.map((v,k)=>v-p.pos[k]),ext:b.hi.map((v,k)=>v-b.lo[k])};
  });
  const first=items.find(item=>item.p.id===primary)||items[0];
  let snappers=items;
  if(items.length>SNAP_PIECES_MAX){
    const all=bbox(moving);
    snappers=[first,{p:null,start:all.lo.slice(),off:[0,0,0],ext:all.hi.map((v,k)=>v-all.lo[k])}];
  }
  const others=S.parts.filter(p=>!ids.has(p.id)).map(box);
  return{primary,first,items,snappers,others};
}
cv.addEventListener('pointermove',e=>{
  lastMouse=e;if(modal&&!drag){modalMove(e);return;}
  if(!drag)return;const dx=e.clientX-drag.lx,dy=e.clientY-drag.ly;drag.lx=e.clientX;drag.ly=e.clientY;
  if(!drag.moved&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<4)return;drag.moved=true;
  if(drag.mode==='move')fastGroup.visible=dimGroup.visible=false;
  if(drag.mode==='custom')drag.move(e); // a drag that belongs to a feature file: see VIEW_PICKERS in js/viewpick.js
  else if(drag.mode==='resize')resizeDrag(e);else if(drag.mode==='draw')drawDrag(e);
  else if(drag.mode==='axis')axisDrag(e);else if(drag.mode==='ring')ringDrag(e);else if(drag.mode==='box')boxDrag(e);
  else if(drag.mode==='orbit'){cam.th+=dx*.008;cam.ph=Math.min(Math.PI/2+.25,Math.max(.001,cam.ph-dy*.008));updateCam();}
  else if(drag.mode==='pan'){const rt=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
    cam.target.addScaledVector(rt,-dx*cam.r*.0016).addScaledVector(up,dy*cam.r*.0016);updateCam();}
  else moveDrag(e);
});
function moveDrag(e){
  setRay(e);const pt=new THREE.Vector3();if(!ray.ray.intersectPlane(drag.plane,pt))return;
  const delta=applyMove(drag,[pt.x-drag.pt.x,pt.y-drag.pt.y,pt.z-drag.pt.z],drag.vertical?[1]:[0,2],e.altKey);
  setPrompt(moveReadout(drag,delta));
}
/* the live readout while pieces are dragged: how far they have gone, and where the one under the pointer is now */
function moveReadout(st,delta){
  const p=st.first.p,count=st.items.length;
  const ways=[['left','right'],['down','up'],['toward the back','toward the front']];
  const moved=[0,2,1].filter(k=>Math.abs(delta[k])>1e-6).map(k=>`${fmt(Math.abs(delta[k]))} ${ways[k][delta[k]>0?1:0]}`).join(', ');
  const what=count===1?esc(p.name):count>sel.size?`${count} pieces that are fastened together`:`${count} pieces`;
  return`<b>Moving ${what}</b>${moved||'0"'}. `+
    `Now X ${fmt(p.pos[0])}, Y ${fmt(p.pos[2])}, Z ${fmt(p.pos[1])}. Alt turns snapping off.`;
}
/* Move everything in st (from moveState) by d along the given axes from where it started, snapping to other
   pieces or the grid. Every piece moves by exactly the same amount, so a fastened set stays in one piece. */
function applyMove(st,d,axes,noSnap){
  const delta=[0,0,0],grid=parseFloat($('#gridSel').value);
  for(const k of axes){
    delta[k]=d[k];
    if(noSnap)continue;
    let best=null;
    const closer=(gap,reach)=>{if(Math.abs(gap)<reach&&(best===null||Math.abs(gap)<Math.abs(best)))best=gap;};
    for(const item of st.snappers){
      const low=item.start[k]+item.off[k]+delta[k],high=low+item.ext[k],middle=(low+high)/2;
      for(const o of st.others){
        closer((o.lo[k]+o.hi[k])/2-middle,.5); // middles line up
        closer(o.lo[k]-low,.75);closer(o.hi[k]-low,.75);closer(o.lo[k]-high,.75);closer(o.hi[k]-high,.75); // faces meet
      }
      if(k===1)closer(-low,.75); // the floor
    }
    if(best!==null)delta[k]+=best;
    else{const at=st.first.start[k]+delta[k];delta[k]+=Math.round(at/grid)*grid-at;}
  }
  if(axes.includes(1)){ // never below the floor
    let lowest=1e9;
    for(const item of st.items)lowest=Math.min(lowest,item.start[1]+item.off[1]+delta[1]);
    if(lowest<0)delta[1]-=lowest;
  }
  // land the picked piece on a sixteenth, and take the rest along by exactly the same amount
  for(let k=0;k<3;k++)delta[k]=r16(st.first.start[k]+delta[k])-st.first.start[k];
  for(const item of st.items){
    item.p.pos=item.start.map((v,k)=>placeRound(item.p,v+delta[k]));
    setMeshPos(item.p);
  }
  draw();renderFacts();return delta; // the overall size and the overlap warning follow the move; the caller writes the prompt
}
cv.addEventListener('pointerup',()=>{
  if(!drag)return;const d=drag;drag=null;
  if(d.mode==='custom')d.up(d);
  else if(d.mode==='resize'){lite=false;if(d.moved)commit();else rebuildScene();}
  else if(d.mode==='axis'){if(d.moved)commit();}
  else if(d.mode==='ring'){if(d.moved){finishRot(d.floor);commit();}}
  else if(d.mode==='box')boxEnd(d);
  else if(d.mode==='draw')endDraw(d);
  else if(d.mode==='move'&&d.moved)commit();
  else if(d.mode==='move'&&d.again)pickAgain(d.primary); // a second click on a picked piece steps up to its parent component
  else if(d.mode==='pan'&&!d.moved)openContext(d.sx,d.sy,d.hitId);
  else if(d.mode==='orbit'&&!d.moved&&sel.size){sel=new Set();renderAll();}
});
/* ---------- on-screen tools: draw a board, stretch it with handles, connect two pieces ---------- */
let tool='select',lite=false,connectFirst=null;
const handleGroup=new THREE.Group(),preview=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:VIEW_COL.sel,transparent:true,opacity:.45,depthWrite:false}));
preview.visible=false;scene.add(handleGroup,preview);
function setTool(t){tool=t;connectFirst=null;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  cv.style.cursor=t==='draw'||t==='connect'?'crosshair':'';if(t==='draw'||t==='connect')sel=new Set();renderAll();}
function snapCoord(v,k,skip){let best=null; // snap to the face of a nearby piece, otherwise to the grid
  for(const p of S.parts){if(p.id===skip)continue;const b=box(p);for(const ed of[b.lo[k],b.hi[k]]){const d=ed-v;if(Math.abs(d)<.75&&(best===null||Math.abs(d)<Math.abs(best)))best=d;}}
  if(best!==null)return r16(v+best);const g=parseFloat($('#gridSel').value);return Math.round(v/g)*g;}
function buildHandles(){
  while(handleGroup.children.length){const c=handleGroup.children.pop();c.geometry.dispose();c.material.dispose();}
  handleGroup.visible=true;if(tool!=='select'||sel.size!==1||modal||explode)return;const p=selParts()[0];if(!p||isProp(p)||tilted(p))return;
  if(isPosedOpen(p.id))return; // drawn swung open or pulled out (js/motion.js): the handles would hang in the air where the closed piece is
  const b=box(p),c=b.lo.map((v,i)=>(v+b.hi[i])/2),hs=Math.max(.8,cam.r*.016),axes=M[p.mat].kind==='sheet'?[p.ax[0],p.ax[1]]:[p.ax[0]];
  for(const k of axes)for(const side of[0,1]){const h=new THREE.Mesh(new THREE.BoxGeometry(hs,hs,hs),new THREE.MeshBasicMaterial({color:VIEW_COL.sel,depthTest:false}));
    const q=c.slice();q[k]=side?b.hi[k]+hs*.7:b.lo[k]-hs*.7;h.position.set(q[0],q[1],q[2]);h.userData={k,side};h.renderOrder=8;handleGroup.add(h);}
}
function resizeDrag(e){
  const p=byId(drag.id);if(!p)return;setRay(e);
  const k=drag.k,A=new THREE.Vector3(+(k===0),+(k===1),+(k===2)),D=ray.ray.direction,w0=ray.ray.origin.clone().sub(drag.P),b=D.dot(A),den=1-b*b;if(den<1e-5)return;
  let v=drag.P.getComponent(k)+(A.dot(w0)-b*D.dot(w0))/den-drag.off; // where the dragged face is now, along the piece
  if(!e.altKey)v=snapCoord(v,k,p.id);
  const len=Math.max(1,r16(drag.side?v-drag.lo[k]:drag.hi[k]-v));
  if(p.ax.indexOf(k)===0)p.l=len;else p.w=len;
  p.pos[k]=drag.side?drag.lo[k]:r16(drag.hi[k]-len);if(p.pos[1]<0)p.pos[1]=0;
  rebuildScene();renderFacts();
  setPrompt(`<b>Stretching ${esc(p.name)}</b>${fmt(p.l)} long${M[p.mat].kind==='sheet'?` × ${fmt(p.w)} wide`:''}. Release to keep it. Alt turns snapping off.`);
}
function startDraw(e,base){
  const hit=pick(e),y0=hit&&hit.face&&hit.face.normal.y>.9?r16(hit.point.y):0,pt=new THREE.Vector3();setRay(e); // start on the floor, or on top of the piece under the pointer
  if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-y0),pt)){drag={...base,mode:'orbit'};return;}
  drag={...base,mode:'draw',y0,a:[snapCoord(pt.x,0),y0,snapCoord(pt.z,2)]};lite=true;
}
function drawDrag(e){
  setRay(e);const m=M[$('#addMat').value],a=drag.a,pt=new THREE.Vector3();let s,pos;
  if(e.shiftKey&&m.kind==='board'){ // Shift stands the board upright: drag sets its height
    const n=new THREE.Vector3();camera.getWorldDirection(n);n.y=0;if(n.lengthSq()<1e-6)n.set(0,0,1);n.normalize();
    if(!ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n,new THREE.Vector3(a[0],a[1],a[2])),pt))return;
    s=[m.w,Math.max(0,snapCoord(pt.y,1)-a[1]),m.t];pos=[a[0]-m.w/2,a[1],a[2]-m.t/2];}
  else{if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-drag.y0),pt))return;
    const bx=snapCoord(pt.x,0),bz=snapCoord(pt.z,2),dx=bx-a[0],dz=bz-a[2];
    if(m.kind==='sheet'){s=[Math.abs(dx),m.t,Math.abs(dz)];pos=[Math.min(a[0],bx),a[1],Math.min(a[2],bz)];}
    else if(Math.abs(dx)>=Math.abs(dz)){s=[Math.abs(dx),m.t,m.w];pos=[Math.min(a[0],bx),a[1],a[2]-m.w/2];}
    else{s=[m.w,m.t,Math.abs(dz)];pos=[a[0]-m.w/2,a[1],Math.min(a[2],bz)];}}
  drag.s=s;drag.pos=pos;const ok=s.every(v=>v>=.5);preview.visible=ok;
  if(ok){preview.scale.set(s[0],s[1],s[2]);preview.position.set(pos[0]+s[0]/2,pos[1]+s[1]/2,pos[2]+s[2]/2);}
  setPrompt(`<b>Drawing a ${esc(m.short)}</b>${fmt(Math.max(...s))} long${m.kind==='sheet'?` × ${fmt(Math.min(s[0],s[2]))} wide`:''}. Release to place it.`);draw();
}
function endDraw(d){
  preview.visible=false;lite=false;const m=M[$('#addMat').value];
  if(d.s&&d.s.every(v=>v>=1)){sel=new Set(addParts([mk(m.kind==='board'?m.short+' piece':'Panel',m.id,d.s.map(r16),d.pos)]));commit();}else renderAll();
}
function connectParts(A,B){ // make A meet B: line it up, then stretch, trim or slide A. B never moves.
  if(!A||!B||A===B)return'';
  if(tilted(A)||tilted(B))return'Angled pieces cannot be connected automatically. Move them by hand and add your own fasteners.';
  const L=A.ax[0],a=box(A),b=box(B),oth=[0,1,2].filter(i=>i!==L),lab=['left to right','up and down','front to back'];
  const fitAxis=k=>{const wa=a.hi[k]-a.lo[k],wb=b.hi[k]-b.lo[k];let sh=0;
    if(wa<=wb+.01){if(a.lo[k]<b.lo[k])sh=b.lo[k]-a.lo[k];else if(a.hi[k]>b.hi[k])sh=b.hi[k]-a.hi[k];}
    else if(Math.min(a.hi[k],b.hi[k])-Math.max(a.lo[k],b.lo[k])<wb-.01)sh=(b.lo[k]+b.hi[k])/2-(a.lo[k]+a.hi[k])/2;
    A.pos[k]=r16(A.pos[k]+sh);};
  let msg;
  if(!isProp(A)&&(b.lo[L]>=a.hi[L]-.01||b.hi[L]<=a.lo[L]+.01)){ // B is off one end of A: line A up with it, then stretch or trim A to touch
    oth.forEach(fitAxis);const old=A.l;
    if(b.lo[L]>=a.hi[L]-.01)A.l=r16(b.lo[L]-a.lo[L]);else{A.l=r16(a.hi[L]-b.hi[L]);A.pos[L]=r16(b.hi[L]);}
    msg=`${A.name} now meets ${B.name}. Its length went from ${fmt(old)} to ${fmt(A.l)}.`;}
  else{const gap=k=>Math.max(b.lo[k]-a.hi[k],a.lo[k]-b.hi[k]),ks=isProp(A)?[0,1,2]:oth,k=ks.reduce((m,x)=>gap(x)>gap(m)?x:m,ks[0]); // B is alongside A: slide A until the faces touch
    const sh=(a.lo[k]+a.hi[k])/2<(b.lo[k]+b.hi[k])/2?b.lo[k]-a.hi[k]:b.hi[k]-a.lo[k];A.pos[k]=r16(A.pos[k]+sh);
    for(const o of ks)if(o!==k&&Math.min(a.hi[o],b.hi[o])-Math.max(a.lo[o],b.lo[o])<.1)fitAxis(o);
    msg=`${A.name} was moved ${fmt(Math.abs(sh))} ${lab[k]} to sit against ${B.name}.`;}
  if(A.pos[1]<0)A.pos[1]=0;
  return msg+' The fastener for this joint is in the Properties panel.';
}
function connectClick(id){
  if(!connectFirst){connectFirst=id;sel=new Set([id]);renderAll();return;}
  if(id===connectFirst)return;const first=connectFirst,msg=connectAndFasten(byId(first),byId(id)); // js/connections.js
  setTool('select');sel=new Set([first,id]);commit();toast(msg);
}
cv.addEventListener('wheel',e=>{e.preventDefault();cam.r=Math.min(2500,Math.max(8,cam.r*Math.exp(e.deltaY*.001)));updateCam();buildHandles();buildGizmo();},{passive:false});

/* ---------- editing ops ---------- */
function rotatePart(p,k){const s0=size(p),c=p.pos.map((v,i)=>v+s0[i]/2),[u,v]=[0,1,2].filter(i=>i!==k);
  hardwareTurned(p,new THREE.Quaternion().setFromAxisAngle(AXV[k],Math.PI/2)); // what is mounted on it turns with it (js/hardware.js)
  if(p.shape)shapeQuarterTurned(p,k); // swapping two axes alone would make a shaped piece its own mirror image (js/shapes.js)
  p.ax=p.ax.map(a=>a===u?v:a===v?u:a);const s=size(p);p.pos=c.map((ci,i)=>r16(ci-s[i]/2));if(p.pos[1]<0)p.pos[1]=0;}
function dropPart(p,skip){const b=box(p);let y=0; // skip: ids of the pieces that go down with it (the selection, when left out)
  for(const o of S.parts){if(o===p||(skip||sel).has(o.id))continue;const ob=box(o);
    if(b.lo[0]<ob.hi[0]-.01&&b.hi[0]>ob.lo[0]+.01&&b.lo[2]<ob.hi[2]-.01&&b.hi[2]>ob.lo[2]+.01){
      const top=ob.hi[1];if(top<=b.lo[1]+.01&&top>y)y=top;}}
  return r16(y-(b.lo[1]-p.pos[1]));}
function selParts(){return S.parts.filter(p=>sel.has(p.id));}
function delSel(){if(!sel.size)return;S.parts=S.parts.filter(p=>!sel.has(p.id));sel=new Set();commit();}
function dupSel(){const ps=selParts();if(!ps.length)return;const b=bbox(ps),dx=b.hi[0]-b.lo[0]+2;
  const ids=addCopies(ps,ps.map(p=>({...p,rot:p.rot&&{...p.rot},q:p.q&&p.q.slice(),ax:p.ax.slice(),pos:[p.pos[0]+dx,p.pos[1],p.pos[2]],
    ...(p.shape?{shape:JSON.parse(JSON.stringify(p.shape))}:{})})));sel=new Set(ids); // addCopies: js/copies.js; a copy gets its own holes and cuts (js/shapes.js)
  bornLoose(ids);commit(); // a copy is free of what it lands against (rule 4, js/connections.js), and says so
  if(copiesLeftLoose())toast((ids.length>1?'Copies added.':'Copy added.')+LOOSE_COPY_WORDS);}
function nudge(k,dir){ // the arrow keys: one snap step. The pieces fastened to the selection go along.
  const ps=movingParts();if(!ps.length)return;
  const step=[0,0,0];step[k]=parseFloat($('#gridSel').value)*dir;
  if(k===1&&dir<0&&bbox(ps).lo[1]+step[1]<0)return; // never below the floor
  shiftPieces(ps,step);commit();}

