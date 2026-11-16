/* NominalCAD: hinges and drawer slides that work.

   A piece on hinges swings about the line through the hinge pins; a piece on slides travels along them. How far
   it is open is a STATE of the piece, a number from 0 (closed) to 1 (as far as the hardware allows):

     p.open      stored on the piece the first hinge or slide is mounted on (the "lead"); missing when closed

   It never changes p.pos, p.ax or any size: the cut list, the joints, the overlap check and the sizes all see the
   closed design. Only the picture changes: setMeshPos() (js/view3d.js) asks poseIfOpen() for every piece it
   places. The pictures of the printed plans show everything closed unless takePictures() is asked otherwise.

   What moves together: the lead and everything fastened to it by anything but the hinges or slides themselves
   (the rest of the door, the other parts of the drawer), plus whatever hardware is mounted on those pieces (the
   pull, the drawer half of each slide).

     movers()                 every door, lid and drawer that can move, worked out once per change:
                                {lead, name, kind:'swing'|'slide', items, riders (Set of piece ids), parts,
                                 limit (degrees) | travel (inches), stuck (a piece it is also screwed to), open}
     moverOf(pieceId)         the mover that piece rides on, or undefined
     setOpen(mover, share)    open it this far (0 to 1). Call commit() afterwards, or use openTo() which does.
     openTo(mover, share)     the same, as one undo step, with a word in the status bar when it hits something
     setAllOpen(share)        Display: "Open all doors and drawers" and "Close all"
     openClash(mover, share)  what it overlaps when it stands open exactly this far: {rider, other} (pieces) or null
     openReach(mover)         how far it opens before it hits something: {free (0 to 1), hit}
     openBlock(mover, share)  what it hits on the way to being open this far, or null
     openSaid(mover, share)  '35°' for a hinge, '6 1/2"' for a slide
     showClosed               true while everything is to be drawn closed (the printed pictures)

   In the 3D view the selected door, lid or drawer shows a blue handle with a light rim: drag it to open or close
   (a ball on an arc for a hinge, a cone on a line for a slide); click it to swing fully open or shut. A
   double-click on the piece itself does the same as that click (openByDoubleClick). While the selection is the
   door, lid or drawer, the move arrows give way to the handle (selectionMover), and the status bar says how to
   open it (moverPrompt). */
'use strict';

let showClosed=false;
const OPEN_CLASH_MIN=.06;   // inches two pieces must overlap, in every direction, to count as hitting each other
const OPEN_STEPS=[.05,.1,.2,.3,.4,.5,.6,.7,.8,.9,1]; // the openings that are tried when asking how far something opens
const CANNOT_OPEN=.1;       // hitting something at or before this share of the way means it cannot open at all
const moversMemo=new WeakMap(); // graph -> {list, ofPiece}

/* ---------- who moves ---------- */
function buildMovers(graph){
  const pieces=pieceMap(),list=[],ofPiece=new Map();
  /* A design that was turned to an odd angle has no worked-out joints: every piece holds on to what it touches
     (js/connections.js). A door must not be held shut by that: what a hinged or sliding piece merely touches,
     outside its own door or drawer, does not ride with it. */
  const ownOfHost=new Map();
  for(const item of hardwareList()){
    if(HARDWARE[item.kind]&&HARDWARE[item.kind].motion&&pieces.has(item.on)&&!ownOfHost.has(item.on))ownOfHost.set(item.on,ownParts(pieces.get(item.on)));
  }
  const onlyTouches=link=>link.type==='angled'&&S.joints[link.key]===undefined&&
    ((ownOfHost.has(link.a.id)&&!ownOfHost.get(link.a.id).has(link.b.id))||(ownOfHost.has(link.b.id)&&!ownOfHost.get(link.b.id).has(link.a.id)));
  /* the lead and everything fastened to it, without crossing a hinge or a slide */
  const ridersOf=start=>{
    const riders=new Set([start]),todo=[start];
    while(todo.length){
      const id=todo.pop();
      for(const link of graph.of.get(id)||[]){
        if(!link.fastened||link.key.startsWith('hw:')||onlyTouches(link))continue;
        const other=link.a.id===id?link.b.id:link.a.id;
        if(!riders.has(other)){riders.add(other);todo.push(other);}
      }
      for(const prop of graph.carries.get(id)||[]){
        if(!riders.has(prop)){riders.add(prop);todo.push(prop);}
      }
    }
    return riders;
  };
  for(const item of hardwareList()){
    const kind=HARDWARE[item.kind];
    if(!kind||!kind.motion||item.to==null||!pieces.has(item.on)||!pieces.has(item.to))continue;
    let mover=ofPiece.get(item.on);
    if(mover){ // another hinge of the same door, the second slide of the same drawer
      if(mover.kind!==kind.motion)continue;
      mover.items.push(item);
      if(kind.motion==='swing')mover.limit=Math.min(mover.limit,kind.limit);
      else mover.travel=Math.min(mover.travel,kind.travel(item.size));
      if(mover.riders.has(item.to))mover.stuck=pieces.get(item.to);
      continue;
    }
    const lead=pieces.get(item.on),riders=ridersOf(lead.id),pose=hardwarePose(item),middle=pieceMiddle(lead);
    mover={lead,kind:kind.motion,items:[item],riders,parts:[...riders].map(id=>pieces.get(id)).filter(Boolean),
      stuck:riders.has(item.to)?pieces.get(item.to):null,
      axis:pose.u.clone().normalize(),          // the pin of the hinge, or the way the slide travels
      pivotFromLead:pose.at.clone().sub(middle), // where the pin is, measured from the middle of the lead
      limit:kind.limit||0,travel:kind.travel?kind.travel(item.size):0,
      get open(){return Math.max(0,Math.min(1,+this.lead.open||0));},
    };
    // named after its component when that is exactly what moves ("Door 2"), otherwise after the lead piece
    const comp=compChain(lead.id)[0];
    mover.name=comp&&compPieceIds(comp.id).every(id=>riders.has(id))?comp.name:lead.name;
    list.push(mover);
    for(const id of riders)ofPiece.set(id,mover);
  }
  // a lid stay only lets the lid go so far
  for(const item of hardwareList()){
    const kind=HARDWARE[item.kind];
    if(!kind||kind.motion||!kind.limit)continue;
    const mover=ofPiece.get(item.on)||(item.to!=null&&ofPiece.get(item.to))||(item.geo&&ofPiece.get(item.geo.for)); // geo.for: the lid it was fitted for (js/hanging.js)
    if(mover&&mover.kind==='swing')mover.limit=Math.min(mover.limit,kind.limit);
  }
  return{list,ofPiece};
}
function moversNow(){
  const graph=connGraph();
  let found=moversMemo.get(graph);
  if(!found){
    found=buildMovers(graph);
    moversMemo.set(graph,found);
  }
  return found;
}
const movers=()=>moversNow().list;
const moverOf=pieceId=>moversNow().ofPiece.get(pieceId);
/* a change of hardware that has not been committed yet (the self-checks do this) */
function forgetMovers(){
  moversMemo.delete(connGraph());
}

/* ---------- the picture of an open door or drawer ---------- */
const poseTurn=new THREE.Quaternion(),posePivot=new THREE.Vector3();
/* setMeshPos() calls this last for every piece it places: g is the piece's group, already where the closed piece is */
function poseIfOpen(p,g){
  if(showClosed)return;
  const found=moversNow();
  if(!found.list.length)return;
  const mover=found.ofPiece.get(p.id);
  if(!mover||mover.stuck)return;
  const open=mover.open;
  if(!open)return;
  if(mover.kind==='slide'){
    g.position.addScaledVector(mover.axis,open*mover.travel);
    return;
  }
  poseTurn.setFromAxisAngle(mover.axis,open*mover.limit*Math.PI/180);
  posePivot.copy(pieceMiddle(mover.lead)).add(mover.pivotFromLead);
  g.position.sub(posePivot).applyQuaternion(poseTurn).add(posePivot);
  g.quaternion.premultiply(poseTurn);
}
/* is this piece drawn away from where it stands, right now? (the fasteners inside it are then left out) */
function isPosedOpen(pieceId){
  if(showClosed)return false;
  const mover=moversNow().ofPiece.get(pieceId);
  return!!mover&&!mover.stuck&&mover.open>0;
}
/* changes whenever something opens or closes: part of what the drawn fasteners depend on */
function openSignature(){
  if(showClosed)return'';
  return movers().filter(m=>m.open>0&&!m.stuck).map(m=>m.lead.id).join(',');
}
function openSaid(mover,share){
  return mover.kind==='swing'?Math.round(share*mover.limit)+'°':fmt(r16(share*mover.travel));
}

/* ---------- does it hit anything? ---------- */
/* a piece as a turned box, with the mover's pose for this opening applied */
function posedBox(p,mover,share){
  const b=turnedBox(p,0);
  if(mover.kind==='slide'){
    b.c.addScaledVector(mover.axis,share*mover.travel);
    return b;
  }
  const turn=new THREE.Quaternion().setFromAxisAngle(mover.axis,share*mover.limit*Math.PI/180);
  const pivot=pieceMiddle(mover.lead).add(mover.pivotFromLead);
  b.c.sub(pivot).applyQuaternion(turn).add(pivot);
  b.axes.forEach(axis=>axis.applyQuaternion(turn));
  return b;
}
/* Do two turned boxes share space? Like turnedBoxesTouch (js/neighbors.js), but they must overlap by a little
   in every direction: two pieces that only touch do not hit each other. */
function turnedBoxesOverlap(a,b){
  const between=new THREE.Vector3().subVectors(b.c,a.c),probe=new THREE.Vector3();
  const reach=(box,dir)=>box.half[0]*Math.abs(dir.dot(box.axes[0]))+box.half[1]*Math.abs(dir.dot(box.axes[1]))+box.half[2]*Math.abs(dir.dot(box.axes[2]));
  const apartAlong=dir=>Math.abs(between.dot(dir))>reach(a,dir)+reach(b,dir)-OPEN_CLASH_MIN;
  for(let i=0;i<3;i++){
    if(apartAlong(a.axes[i])||apartAlong(b.axes[i]))return false;
  }
  for(let i=0;i<3;i++){
    for(let j=0;j<3;j++){
      probe.crossVectors(a.axes[i],b.axes[j]);
      if(probe.lengthSq()<1e-8)continue;
      probe.normalize();
      if(apartAlong(probe))return false;
    }
  }
  return true;
}
/* the wooden pieces a mover could ever reach: found once, so that trying many openings stays quick */
function withinReach(mover){
  if(mover.near)return mover.near;
  const pivot=pieceMiddle(mover.lead).add(mover.pivotFromLead);
  let reach=0;
  const all=bbox(mover.parts);
  if(mover.kind==='swing'){
    for(const x of[all.lo[0],all.hi[0]])for(const y of[all.lo[1],all.hi[1]])for(const z of[all.lo[2],all.hi[2]]){
      reach=Math.max(reach,pivot.distanceTo(new THREE.Vector3(x,y,z)));
    }
  }
  const lo=mover.kind==='swing'?[pivot.x-reach,pivot.y-reach,pivot.z-reach]:all.lo.map((v,k)=>v+Math.min(0,mover.axis.getComponent(k)*mover.travel));
  const hi=mover.kind==='swing'?[pivot.x+reach,pivot.y+reach,pivot.z+reach]:all.hi.map((v,k)=>v+Math.max(0,mover.axis.getComponent(k)*mover.travel));
  mover.near=[];
  for(const b of woodBounds()){
    if(b.lo[0]<hi[0]&&b.hi[0]>lo[0]&&b.lo[1]<hi[1]&&b.hi[1]>lo[1]&&b.lo[2]<hi[2]&&b.hi[2]>lo[2]&&!mover.riders.has(b.p.id))mover.near.push(turnedBox(b.p,0));
  }
  return mover.near;
}
/* the outer bounds of every wooden piece, worked out once per change (a wall of cabinets has hundreds of doors,
   and each of them asks what is near it) */
function woodBounds(){
  const found=moversNow();
  if(!found.bounds){
    found.bounds=[];
    for(const p of S.parts){
      if(isProp(p))continue;
      const b=box(p);
      found.bounds.push({p,lo:b.lo,hi:b.hi});
    }
  }
  return found.bounds;
}
function openClash(mover,share){
  if(mover.stuck||share<=0)return null;
  const others=withinReach(mover);
  if(!others.length)return null;
  for(const rider of mover.parts){
    if(isProp(rider))continue;
    const posed=posedBox(rider,mover,share),c=posed.c,reach=[0,0,0];
    for(let k=0;k<3;k++){ // its outer bounds in this pose: most pieces are nowhere near and need no closer look
      reach[k]=posed.half[0]*Math.abs(posed.axes[0].getComponent(k))+posed.half[1]*Math.abs(posed.axes[1].getComponent(k))+posed.half[2]*Math.abs(posed.axes[2].getComponent(k));
    }
    for(const other of others){
      if(other.lo[0]>c.x+reach[0]||other.hi[0]<c.x-reach[0]||other.lo[1]>c.y+reach[1]||other.hi[1]<c.y-reach[1]||other.lo[2]>c.z+reach[2]||other.hi[2]<c.z-reach[2])continue;
      if(turnedBoxesOverlap(posed,other))return{rider,other:other.p};
    }
  }
  return null;
}
function openReach(mover){
  if(mover.reach)return mover.reach;
  let free=0;
  for(const share of OPEN_STEPS){
    const hit=openClash(mover,share);
    if(hit){mover.reach={free,hit};return mover.reach;}
    free=share;
  }
  mover.reach={free:1,hit:null};
  return mover.reach;
}
/* What stops it from being open this far: what it hits on the way there, {rider, other}, or null when the way is
   clear. (A door drawn past a board has not got round it: it hit the board on the way.) */
function openBlock(mover,share){
  if(mover.stuck||share<=0)return null;
  const reach=openReach(mover);
  return reach.hit&&share>reach.free+1e-9?reach.hit:null;
}
/* what is wrong with the doors and drawers as they stand now: one line each */
function motionTroubles(){
  const lines=[];
  for(const mover of movers()){
    if(mover.stuck){lines.push({mover,text:`${mover.name} cannot open: it is also fastened to ${mover.stuck.name}. Unfasten that connection (U).`});continue;}
    const open=mover.open,hit=openBlock(mover,open);
    if(!hit)continue;
    const reach=openReach(mover);
    lines.push({mover,hit,text:reach.free<CANNOT_OPEN
      ?`${mover.name} cannot open: it hits ${hit.other.name} right away. This is a design fault: move ${hit.other.name}, or hang it from another edge.`
      :`${mover.name} cannot open this far (${openSaid(mover,open)}): it hits ${hit.other.name}. It opens ${openSaid(mover,reach.free)} freely.`});
  }
  return lines;
}

/* ---------- opening and closing ---------- */
function setOpen(mover,share){
  const value=Math.max(0,Math.min(1,share));
  if(value>0)mover.lead.open=Math.round(value*1000)/1000;else delete mover.lead.open;
}
/* redraw only what moved (while a handle or the slider is dragged) */
function showOpen(mover){
  for(const p of mover.parts)setMeshPos(p);
  buildMotionHandle();
  draw();
}
function openTo(mover,share){
  if(mover.stuck){toast(`${mover.name} cannot open: it is also fastened to ${mover.stuck.name}. Unfasten that connection first (U).`);return;}
  setOpen(mover,share);
  const hit=openBlock(mover,mover.open);
  commit();
  if(hit)toast(`${mover.name} hits ${hit.other.name} before it is open ${openSaid(mover,mover.open)}. Both are shown in red. It opens ${openSaid(mover,openReach(mover).free)} freely.`);
}
function setAllOpen(share){
  const list=movers().filter(m=>!m.stuck);
  if(!list.length){toast('Nothing in this design is on hinges or drawer slides yet. Select a door or lid and use Hang this door or lid.');return;}
  for(const mover of list)setOpen(mover,share);
  commit();
  const hits=movers().filter(m=>openBlock(m,m.open)).length;
  toast(share>0?`Opened ${list.length} door${list.length===1?'':'s, lids and drawers'}.${hits?` ${hits} of them hit${hits===1?'s':''} something: shown in red.`:''} Alt+O closes them again.`
    :'Everything is closed.');
}
/* an open state only means something on the lead of a mover */
ON_COMMIT.push(function tidyOpenStates(){
  let any=false;
  for(const p of S.parts)if(p.open!=null){any=true;break;}
  if(!any)return;
  const leads=new Set(movers().map(m=>m.lead.id));
  for(const p of S.parts){
    if(p.open==null)continue;
    if(!leads.has(p.id)||!(p.open>0))delete p.open;
    else if(p.open>1)p.open=1;
  }
});

/* ---------- red for what it hits, and a word in the status bar ---------- */
SCENE_EXTRAS.push(function showMotionTroubles(){
  const chip=$('#stMotion');
  const troubles=showClosed?[]:motionTroubles();
  if(chip){
    chip.hidden=!troubles.length;
    if(troubles.length){
      const first=troubles[0],more=troubles.length-1;
      chip.innerHTML=icon('i-warn')+esc(first.hit?`${first.mover.name} hits ${first.hit.other.name}`:`${first.mover.name} cannot open`);
      chip.title=first.text+(more?` (and ${more} more)`:'')+' Click to select it.';
      chip.dataset.piece=first.mover.lead.id;
    }
  }
  for(const trouble of troubles){
    if(!trouble.hit)continue;
    for(const piece of[trouble.hit.rider,trouble.hit.other]){
      const group=meshes.get(piece.id);
      if(!group||sel.has(piece.id))continue;
      group.children[0].material.color.setHex(VIEW_COL.clash);
      group.children[1].material.color.setHex(VIEW_COL.clashEdge);
      group.children[1].material.opacity=1;
    }
  }
});
$('#stMotion').onclick=e=>{
  const id=+e.currentTarget.dataset.piece;
  if(!id)return;
  if(tab!=='design')setTab('design');
  sel=new Set([id]);
  renderAll();
};

/* ---------- the handle in the 3D view ---------- */
/* The handle has to be clear to see and to grab on any wood and on glass: a blue core with a light rim around it,
   drawn above everything in the scene (the move arrows of js/transform.js are drawn at order 9). When the selection
   is the door, lid or drawer itself, the move arrows are not drawn at all (selectionMover): the handle takes their
   place, and the piece still moves by dragging it, with M, or with the X, Y, Z boxes in Properties. */
const HANDLE_COL=VIEW_COL.sel;   // the selection blue: a darker blue than the up arrow (GCOL in js/transform.js)
const HANDLE_RIM=0xffffff;       // the light rim and the light edge of the track
const HANDLE_SIZE=.018;          // radius of the ball (or the base of the cone) as a share of the distance to the eye
const HANDLE_MIN=.65;            // inches: never smaller than this, however close the eye is
const HANDLE_ORDER=12;           // drawn after everything else in the scene
const motionGroup=new THREE.Group();
scene.add(motionGroup);
let motionHandle=null; // {mover, at: THREE.Vector3, radius, ...} for the selected door, lid or drawer

function selectedMover(){
  for(const id of sel){
    const mover=moverOf(id);
    if(mover&&!mover.stuck)return mover;
  }
  return null;
}
/* The door, lid or drawer that IS the selection: every selected piece rides on it (the drawer front alone, or the
   whole drawer). Null when anything else is selected as well. A stuck one is returned too: the status bar then
   says why it cannot open. */
function selectionMover(){
  if(!sel.size)return null;
  let mover=null;
  for(const id of sel){
    const riding=moverOf(id);
    if(!riding||(mover&&riding!==mover))return null;
    mover=riding;
  }
  return mover;
}
/* one see-through mesh of the handle, drawn above everything (order: the rim first, the blue core over it) */
function handleMesh(geometry,color,opacity,order){
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false,transparent:true,opacity}));
  mesh.renderOrder=order;
  motionGroup.add(mesh);
  return mesh;
}
/* the track of the handle (the arc of a hinge, the line of a slide) as a thin blue tube with a light edge */
function handleTrack(curve,segments,radius){
  handleMesh(new THREE.TubeGeometry(curve,segments,radius*.2,6,false),HANDLE_RIM,.7,HANDLE_ORDER);
  handleMesh(new THREE.TubeGeometry(curve,segments,radius*.09,6,false),HANDLE_COL,.9,HANDLE_ORDER+1);
}
/* Where the handle of a swinging piece is: a little way past its far edge (clear of the blue stretch handle that
   sits on that edge), on a circle about the pin. */
function swingGeometry(mover,share,past){
  const pivot=pieceMiddle(mover.lead).add(mover.pivotFromLead),toMiddle=pieceMiddle(mover.lead).sub(pivot);
  const alongPin=mover.axis.clone().multiplyScalar(toMiddle.dot(mover.axis));
  const center=pivot.clone().add(alongPin);                   // the middle of the circle
  const out=toMiddle.clone().sub(alongPin).multiplyScalar(2); // from that middle to the far edge, closed
  out.setLength(out.length()+past);
  const turned=out.clone().applyAxisAngle(mover.axis,share*mover.limit*Math.PI/180);
  return{center,out,at:center.clone().add(turned)};
}
function buildMotionHandle(){
  while(motionGroup.children.length){
    const child=motionGroup.children.pop();
    child.geometry.dispose();child.material.dispose();
  }
  motionHandle=null;
  if(tool!=='select'||modal||explode||showClosed||lite)return;
  const mover=selectedMover();
  if(!mover)return;
  const radius=Math.max(HANDLE_MIN,cam.r*HANDLE_SIZE),open=mover.open;
  if(mover.kind==='swing'){
    // a ball on the arc it travels along, a little way past the far edge of the door
    const g=swingGeometry(mover,open,radius*4.5),points=[];
    for(let i=0;i<=32;i++)points.push(g.center.clone().add(g.out.clone().applyAxisAngle(mover.axis,i/32*mover.limit*Math.PI/180)));
    handleTrack(new THREE.CatmullRomCurve3(points),48,radius);
    handleMesh(new THREE.SphereGeometry(radius*1.35,20,14),HANDLE_RIM,.9,HANDLE_ORDER+2).position.copy(g.at);
    handleMesh(new THREE.SphereGeometry(radius,20,14),HANDLE_COL,1,HANDLE_ORDER+3).position.copy(g.at);
    motionHandle={mover,at:g.at,radius:radius*1.35,swing:g};
  }else{
    // a cone pointing the way the drawer comes out, on the line it travels along, just in front of the drawer
    const all=bbox(mover.parts),middle=new THREE.Vector3((all.lo[0]+all.hi[0])/2,(all.lo[1]+all.hi[1])/2,(all.lo[2]+all.hi[2])/2);
    const half=Math.abs(mover.axis.x)*(all.hi[0]-all.lo[0])/2+Math.abs(mover.axis.y)*(all.hi[1]-all.lo[1])/2+Math.abs(mover.axis.z)*(all.hi[2]-all.lo[2])/2;
    const closedAt=middle.addScaledVector(mover.axis,half+radius*2.5);
    const at=closedAt.clone().addScaledVector(mover.axis,open*mover.travel);
    handleTrack(new THREE.LineCurve3(closedAt,closedAt.clone().addScaledVector(mover.axis,mover.travel)),1,radius);
    const pointing=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),mover.axis);
    for(const[scale,color,opacity,order]of[[1.35,HANDLE_RIM,.9,HANDLE_ORDER+2],[1,HANDLE_COL,1,HANDLE_ORDER+3]]){
      const cone=handleMesh(new THREE.ConeGeometry(radius*scale,radius*2.6*scale,20),color,opacity,order);
      cone.quaternion.copy(pointing);
      cone.position.copy(at);
    }
    motionHandle={mover,at,radius:radius*1.4,closedAt};
  }
}
SCENE_EXTRAS.push(buildMotionHandle);
cv.addEventListener('wheel',()=>{if(motionHandle){buildMotionHandle();draw();}}); // the handle keeps one size on screen

/* the opening the pointer asks for while the handle is dragged */
function shareUnderPointer(handle){
  const mover=handle.mover;
  if(mover.kind==='swing'){
    const g=handle.swing,hit=new THREE.Vector3();
    if(!ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(mover.axis,g.center),hit))return null;
    const to=hit.sub(g.center),from=g.out;
    let angle=Math.atan2(new THREE.Vector3().crossVectors(from,to).dot(mover.axis),from.dot(to))*180/Math.PI;
    if(angle<-90)angle+=360; // past half a turn, for hinges that open all the way round
    return Math.max(0,Math.min(1,angle/mover.limit));
  }
  // a slide: how far along its track the pointer is
  const origin=ray.ray.origin,dir=ray.ray.direction,w=origin.clone().sub(handle.closedAt);
  const b=dir.dot(mover.axis),den=1-b*b;
  if(den<1e-5)return null;
  return Math.max(0,Math.min(1,((mover.axis.dot(w)-b*dir.dot(w))/den)/mover.travel));
}
VIEW_PICKERS.push({
  early:true,
  find(){
    const handle=motionHandle;
    if(!handle)return null;
    const origin=ray.ray.origin,dir=ray.ray.direction;
    const along=Math.max(0,handle.at.clone().sub(origin).dot(dir));
    const gap=origin.clone().addScaledVector(dir,along).distanceTo(handle.at);
    if(gap>handle.radius*1.5)return null;
    const mover=handle.mover;
    return{dist:along,tip:`Drag to open or close ${mover.name}. Click to ${mover.open?'close':'open'} it, or double-click the piece.`,through:true,
      press(e,base){
        lastHandlePress=performance.now();
        lastHandleMover=mover;
        selAtHandlePress=new Set(sel);
        const start=mover.open;
        drag={...base,mode:'custom',
          move(ev){
            setRay(ev);
            const share=shareUnderPointer(handle);
            if(share===null)return;
            const step=ev.altKey?1e-4:mover.kind==='swing'?5/mover.limit:.25/mover.travel; // whole 5 degrees or quarter inches; Alt for any amount
            setOpen(mover,Math.min(1,Math.round(share/step)*step));
            showOpen(mover);
            const hit=openBlock(mover,mover.open);
            setPrompt(`<b>${mover.open?'Opening':'Closing'} ${esc(mover.name)}</b>${openSaid(mover,mover.open)} of ${openSaid(mover,1)}.`+
              (hit?` It hits ${esc(hit.other.name)} after ${openSaid(mover,openReach(mover).free)}.`:'')+' Release to keep it. Alt for any amount.');
          },
          up(d){
            if(!d.moved){
              // The second click of a double-click is left to the double-click (see below): the first click
              // already swung it, and a second swing would undo that.
              if(pressCount>=2)return;
              setOpen(mover,start>0?0:1); // a click swings it fully open or shut
              handleClickedAt=performance.now();
            }
            const hit=openBlock(mover,mover.open);
            commit();
            if(hit)toast(`${mover.name} hits ${hit.other.name} before it is open ${openSaid(mover,mover.open)}. Both are shown in red.`);
          }};
      }};
  },
});

/* ---------- double-click a door, lid or drawer to open or close it ----------
   A double-click on any piece that rides on a mover opens it fully when it is closed, and closes it when it is open
   at all, as one undo step (openTo), with the same word about what it hits. It leaves that piece selected. The two
   clicks of a double-click are ordinary clicks first: they select the piece and do not move it (a press only
   becomes a drag after the pointer has moved). Only the second click must not step the selection up to the
   component around the piece (pickAgain, js/components.js). A double-click on anything else does nothing new.
   The open handle can sit over the piece (in front of the middle of a drawer front, seen from the front), so a
   double-click may land on it too, and it still swings the door or drawer once, never twice:
     first click on the handle        it swings (an ordinary click on the handle); the double-click then does nothing
     second click on the handle       the handle leaves it to the double-click, which swings the handle's mover
   Things that are not pieces: a double-click on a hinge, a pull or other hardware mounted on a door, lid or drawer
   opens that one; on a fastener, or on hardware of the cabinet, it does nothing new (the fastener stays picked),
   even when the wood behind it is a door (Fasteners only shows the cabinet's screws through a closed door).
   With Ctrl (or Cmd) held the clicks add to and take from the selection, so the double-click does nothing new. In
   an exploded view the first click only puts the design back together. */
let pressCount=0;            // the click count of the last press on the 3D view (2 on the second press of a double-click)
let lastHandlePress=-1e9;    // when the open handle was last pressed (performance.now())
let handleClickedAt=-1e9;    // when a click on the open handle last swung its mover
let lastHandleMover=null;    // the mover of the handle that was pressed last
let selAtHandlePress=new Set(); // and what was selected then
let pressesAt=[-1e9,-1e9];   // when the last two left presses on the 3D view began: a double-click's own two
let pressesApart=[false,false]; // and whether the view was exploded when each began
let steppedUpAt=-1e9;        // when a click last stepped the selection up to a component (pickAgain)
cv.addEventListener('pointerdown',e=>{ // capture: runs before the press is handled (and the handle is pressed)
  if(e.button!==0)return;
  pressesAt=[pressesAt[1],performance.now()];
  pressesApart=[pressesApart[1],!!explode]; // read before js/tools.js puts an exploded view back together
},true);
cv.addEventListener('mousedown',e=>{pressCount=e.detail;});
cv.addEventListener('pointerup',()=>{ // runs before the pointerup of js/tools.js, which would step the selection up
  if(pressCount>=2&&drag&&drag.mode==='move'&&!drag.moved&&moverOf(drag.primary))drag.again=false;
},true);
/* With Pick set to Component, the first click of a double-click on a door that is already selected steps the
   selection up to the component around it, and says so. The double-click then puts the selection back on the
   door; it needs to know that this happened, to take the words away again. */
const pickAgainBeforeMotion=pickAgain;
pickAgain=function(pieceId){
  steppedUpAt=performance.now();
  return pickAgainBeforeMotion(pieceId);
};
/* the hardware the clicks picked, when it is mounted on a door, lid or drawer: the piece it is on; else null */
function pickedHardwarePiece(){
  if(!picked||picked.type!=='hw')return null;
  const item=hardwareList().find(candidate=>candidate.id===picked.id);
  return item&&moverOf(item.on)?item.on:null;
}
cv.addEventListener('dblclick',e=>{
  if(e.button!==0||e.ctrlKey||e.metaKey)return;
  if(tool!=='select'||modal||explode||tab!=='design'||showClosed||placingHardware||placingDrawer)return;
  if(pressesApart[0]||pressesApart[1])return; // the first click put an exploded view back together
  const firstPress=pressesAt[0]; // the start of this double-click
  if(handleClickedAt>=firstPress){ // its first click was on the handle and has swung it already
    // The handle moved with it, so the second click may have landed on empty space (which drops the selection)
    // or on another piece: the selection goes back to what it was on the handle's door or drawer.
    const stillOnIt=sel.size>0&&[...sel].every(id=>{const m=moverOf(id);return m&&lastHandleMover&&m.lead.id===lastHandleMover.lead.id;});
    if(!stillOnIt&&selAtHandlePress.size){sel=new Set(selAtHandlePress);renderAll();}
    return;
  }
  if(lastHandlePress>=firstPress&&lastHandleMover){ // its second click was on the handle
    const mover=movers().find(m=>m.lead.id===lastHandleMover.lead.id);
    if(mover&&!mover.stuck)openTo(mover,mover.open>0?0:1); // the selection is already on it
    return;
  }
  // A click on a fastener or on hardware picks it (and a click on a piece drops the pick): the double-click was
  // on that thing, not on the wood behind it.
  let pieceId=null;
  if(picked)pieceId=pickedHardwarePiece();
  else{
    scene.updateMatrixWorld(); // the clicks may have redrawn the scene since the last frame
    const hit=pick(e);
    if(hit)pieceId=hit.object.userData.id;
  }
  if(pieceId==null||!moverOf(pieceId))return;
  if(steppedUpAt>=firstPress&&$('#toast'))$('#toast').classList.remove('on'); // "Selected ..., the component that ..."
  openByDoubleClick(pieceId);
});
/* Open or close the mover a piece rides on; false when it rides on none (nothing happens then). The selection
   becomes what a click on the piece picks, but only the pieces of this door, lid or drawer: with Pick set to
   Component a click picks the whole "Doors" component, and the handle would then show on one door while the
   move arrows came back for the pair. */
function openByDoubleClick(pieceId){
  const mover=moverOf(pieceId);
  if(!mover)return false;
  const isOnIt=id=>{const riding=moverOf(id);return!!riding&&riding.lead.id===mover.lead.id;};
  sel=new Set();
  const onIt=pickIds(pieceId).filter(isOnIt);
  sel=new Set(onIt.length?onIt:[pieceId]);
  picked=null;
  // the component the selection now is exactly, if any, so that a later click steps up from there
  if(pickedComp!=null&&!selectionIs(pickedComp))pickedComp=(compChain(pieceId).find(comp=>selectionIs(comp.id))||{id:null}).id;
  if(mover.stuck){renderAll();return true;} // the status bar says why it cannot open (moverPrompt)
  openTo(mover,mover.open>0?0:1);
  return true;
}

/* ---------- the status bar while a door, lid or drawer is selected: how to open it ---------- */
function moverPrompt(mover){
  const name=esc(mover.name);
  if(mover.stuck)return`${name} cannot open: it is also fastened to ${esc(mover.stuck.name)}. Unfasten that connection (U).`;
  const verb=mover.kind==='swing'?(mover.open>0?'close':'open'):(mover.open>0?'push in':'pull out');
  const moving=sel.size+followerCount(); // the piece moves with everything it is fastened to (js/connections.js)
  return`To ${verb} ${name}, double-click it or drag the blue handle. `+
    (moving>1?`Dragging the piece moves all ${moving} pieces that are fastened together.`:'Dragging the piece moves it.');
}
const promptBeforeMotion=TOOL_PROMPTS.select;
TOOL_PROMPTS.select=()=>{
  const mover=!picked&&selectionMover();
  return mover?['i-select','Select / move',moverPrompt(mover)]:promptBeforeMotion();
};

/* ---------- check: a double-click opens and closes, the handle stands clear of the move arrows ---------- */
SELFTESTS.push(function openWithTheMouse(problems){
  const wrong=text=>problems.push('open with the mouse: '+text);
  const preset=PRESETS.find(candidate=>candidate.name==='Nightstand with drawers');
  if(!preset){wrong('there is no Nightstand with drawers');return;}
  const tabKept=tab,toolKept=tool,arrowsKept=moveArrowsOn,modeKept=woodMode,pickKept=pickLevel,pickedCompKept=pickedComp;
  let presetKept=null,storedArrows=null;
  try{presetKept=localStorage.getItem(LAST_PRESET_KEY);storedArrows=localStorage.getItem(ARROWS_KEY);}catch(e){}
  const arrowsInScene=()=>{
    const found=[];
    gizmoGroup.traverse(o=>{if(o.userData.gz==='axis')found.push(o);});
    return found;
  };
  /* a real double-click on the middle of a piece, as the browser sends it */
  const doubleClick=(pieceId,across,keys)=>{
    const frame=cv.getBoundingClientRect();
    scene.updateMatrixWorld(true);
    // across: how far across its face, from the left (.1 is clear of the pull and the handle in the middle)
    // keys: modifier keys held, as {ctrlKey:true}
    const b=box(byId(pieceId)),middle=new THREE.Vector3(b.lo[0]+(b.hi[0]-b.lo[0])*(across||.1),(b.lo[1]+b.hi[1])/2,b.hi[2]).project(camera);
    const where={clientX:frame.left+(middle.x+1)/2*frame.width,clientY:frame.top+(1-middle.y)/2*frame.height,button:0,pointerId:1,bubbles:true,...(keys||{})};
    for(const detail of[1,2]){
      scene.updateMatrixWorld(true); // the first click redraws the scene; a frame would be drawn before the second
      cv.dispatchEvent(new PointerEvent('pointerdown',where));
      cv.dispatchEvent(new MouseEvent('mousedown',{...where,detail}));
      cv.dispatchEvent(new PointerEvent('pointerup',where));
      cv.dispatchEvent(new MouseEvent('mouseup',{...where,detail}));
      cv.dispatchEvent(new MouseEvent('click',{...where,detail}));
    }
    scene.updateMatrixWorld(true);
    cv.dispatchEvent(new MouseEvent('dblclick',{...where,detail:2}));
  };
  try{
    setWoodMode('solid');
    setTab('design');
    setTool('select');
    lastHandlePress=handleClickedAt=-1e9;
    const vals=presetDefaults(preset);
    load(JSON.stringify(blank()),true);
    placePreset(preset,vals,preset.build(vals),false);
    undoStack=[]; // it holds at most 200 steps, and the self-checks before this one may have filled it (selfTest puts it back)
    fit('front');
    const frame=cv.getBoundingClientRect();
    const drawer=movers().filter(m=>m.kind==='slide').pop(); // the top drawer
    const front=drawer&&drawer.parts.find(p=>p.name==='Drawer front');
    if(!front){wrong('the nightstand has no drawer front on a slide');return;}
    const where=JSON.stringify(S.parts.map(p=>[p.id,p.pos,p.l,p.w,p.t]));

    // the double-click, through the real events of the 3D view
    if(frame.width){
      sel=new Set();renderAll();
      const undoBefore=undoStack.length;
      doubleClick(front.id);
      if(!(moverOf(front.id).open>=1))wrong('a double-click on a closed drawer front does not pull the drawer out');
      if(undoStack.length!==undoBefore+1)wrong(`opening a drawer by double-click took ${undoStack.length-undoBefore} undo steps, not one`);
      if(sel.size!==1||!sel.has(front.id))wrong('after a double-click the selection is not the drawer front');
      doubleClick(front.id);
      if(moverOf(front.id).open>0)wrong('a second double-click on an open drawer does not push it back in');
      if(undoStack.length!==undoBefore+2)wrong('closing a drawer by double-click is not one undo step');
      if(sel.size!==1||!sel.has(front.id))wrong('after the second double-click the selection is not the drawer front');
      if(JSON.stringify(S.parts.map(p=>[p.id,p.pos,p.l,p.w,p.t]))!==where)wrong('the clicks of a double-click moved a piece');
      // in the middle of the front, where the open handle of the selected drawer stands in front of it: once each
      doubleClick(front.id,.5);
      if(!(moverOf(front.id).open>=1))wrong('a double-click on the middle of a drawer front (over its handle) does not leave it pulled out');
      doubleClick(front.id,.5);
      if(moverOf(front.id).open>0)wrong('a second double-click on the middle of a drawer front does not leave it pushed in');
      if(undoStack.length!==undoBefore+4)wrong(`four double-clicks made ${undoStack.length-undoBefore} undo steps`);
      // with Ctrl held the clicks add to and take from the selection: nothing opens, the selection is kept
      sel=new Set([front.id]);renderAll();
      doubleClick(front.id,.1,{ctrlKey:true});
      if(moverOf(front.id).open>0||undoStack.length!==undoBefore+4)wrong('a Ctrl + double-click opens the drawer');
      // in an exploded view the first click only puts the design back together
      sel=new Set();setExplode(1);renderAll();
      doubleClick(front.id);
      if(moverOf(front.id).open>0||undoStack.length!==undoBefore+4)wrong('a double-click in the exploded view opens the drawer');
      if(explode)setExplode(0);
    }
    // a double-click on a fastener picks it and opens nothing, even with a drawer front right behind it; on a pull it
    // opens the drawer the pull is on (the dblclick alone, as if the two clicks had picked the thing)
    const dblclickOver=pieceId=>{
      const b=box(byId(pieceId)),middle=new THREE.Vector3((b.lo[0]+b.hi[0])/2,(b.lo[1]+b.hi[1])/2,b.hi[2]).project(camera),frameNow=cv.getBoundingClientRect();
      lastHandlePress=handleClickedAt=-1e9;
      pressesAt=[performance.now(),performance.now()];
      pressesApart=[false,false];
      cv.dispatchEvent(new MouseEvent('dblclick',{clientX:frameNow.left+(middle.x+1)/2*frameNow.width,clientY:frameNow.top+(1-middle.y)/2*frameNow.height,button:0,bubbles:true,detail:2}));
    };
    const connection=connGraph().links.find(link=>link.fastened&&link.joint&&(link.a.id===front.id||link.b.id===front.id));
    const pull=hardwareList().find(item=>item.on===front.id&&HARDWARE[item.kind]&&!HARDWARE[item.kind].motion);
    if(frame.width&&connection){
      sel=new Set();picked={type:'conn',key:connection.key};renderAll();
      const undoBefore=undoStack.length;
      dblclickOver(front.id);
      if(moverOf(front.id).open>0||undoStack.length!==undoBefore)wrong('a double-click on a fastener opens the drawer behind it');
      if(!picked||picked.type!=='conn')wrong('a double-click on a fastener drops the fastener');
      picked=null;
    }
    if(frame.width&&pull){
      sel=new Set();picked={type:'hw',id:pull.id};renderAll();
      dblclickOver(front.id);
      if(!(moverOf(front.id).open>=1))wrong('a double-click on the pull of a drawer does not pull it out');
      if(picked||!sel.has(front.id))wrong('after a double-click on a pull the drawer front is not the selection');
      undo();
    }
    // and the same through the function the event calls, which works when the 3D view is not on screen
    openByDoubleClick(front.id);
    if(!(moverOf(front.id).open>=1))wrong('openByDoubleClick does not open a closed drawer');
    undo();
    if(moverOf(front.id).open>0)wrong('one undo after a double-click does not close the drawer again');

    // the drawer selected: the handle is there, the move arrows are not, and the status bar says how to open it
    sel=new Set([front.id]);renderAll();
    if(!motionHandle||motionHandle.mover.lead.id!==drawer.lead.id||!motionGroup.children.length)wrong('a selected drawer front shows no open handle');
    if(arrowsInScene().length)wrong('the move arrows are drawn over a selected drawer');
    if(!/double-click/.test($('#status').textContent))wrong('the status bar does not say how to open a selected drawer: '+$('#status').textContent);
    if(motionGroup.children.some(mesh=>GCOL.includes(mesh.material.color.getHex())))wrong('the open handle has the color of a move arrow');
    if(motionGroup.children.some(mesh=>mesh.renderOrder<=9))wrong('the open handle is not drawn above the move arrows');

    // Pick set to Component: a click on a cabinet door picks the pair ("Doors"); a double-click opens the door that
    // was clicked and leaves only that door selected, with its handle and without the move arrows
    const stand=PRESETS.find(candidate=>candidate.name==='Single aquarium stand');
    if(stand&&frame.width){
      const standVals=presetDefaults(stand);
      load(JSON.stringify(blank()),true);
      placePreset(stand,standVals,stand.build(standVals),false);
      undoStack=[];
      fit('front');
      pickLevel='comp';pickedComp=null;sel=new Set();renderAll();
      const door=movers().find(m=>m.kind==='swing');
      if(door){
        doubleClick(door.lead.id,.3);
        const onlyThatDoor=sel.size>0&&[...sel].every(id=>{const m=moverOf(id);return m&&m.lead.id===door.lead.id;});
        if(!(moverOf(door.lead.id).open>=1))wrong('with Pick set to Component a double-click on a door does not open it');
        if(!onlyThatDoor)wrong('with Pick set to Component a double-click on a door leaves more than that door selected');
        if(arrowsInScene().length)wrong('with Pick set to Component the move arrows come back after a double-click on a door');
        if(!motionHandle||motionHandle.mover.lead.id!==door.lead.id)wrong('with Pick set to Component the handle is not on the door that was double-clicked');
      }
      pickLevel=pickKept;pickedComp=null;
    }

    // a plain board: a double-click changes nothing; the arrows are there and see-through; the switch hides them
    load(JSON.stringify(blank()),true);
    const[board]=addParts([mk('Shelf','1x12',[30,.75,11.25],[0,20,0])]);
    commit();
    undoStack=[];
    fit('front');
    sel=new Set();renderAll();
    const before=JSON.stringify(S.parts),undoBefore=undoStack.length;
    if(frame.width)doubleClick(board);
    if(openByDoubleClick(board))wrong('a plain board is taken for a door or drawer');
    if(JSON.stringify(S.parts)!==before||undoStack.length!==undoBefore)wrong('a double-click on a plain board changed the design');
    sel=new Set([board]);
    setMoveArrows(true);
    lightArrow(null);
    renderAll();
    const shown=arrowsInScene();
    if(shown.length!==3)wrong(`a selected board shows ${shown.length} move arrows, not 3`);
    if(!arrowMats.length||arrowMats.some(mat=>Math.abs(mat.opacity-ARROW_SEE_THROUGH)>1e-6))wrong('the move arrows of a selected board are not see-through');
    lightArrow(0);
    if(Math.abs(arrowMats[0].opacity-ARROW_FULL)>1e-6||Math.abs(arrowMats[1].opacity-ARROW_SEE_THROUGH)>1e-6)wrong('the arrow under the pointer is not drawn at full strength');
    lightArrow(null);
    setMoveArrows(false);
    if(arrowsInScene().length)wrong('with Move arrows off in Display the arrows are still drawn');
    setTool('rotate');
    let rings=0;
    gizmoGroup.traverse(o=>{if(o.userData.gz==='ring')rings++;});
    if(rings!==3)wrong('with Move arrows off the rings of the Rotate tool are gone too');
    setTool('select');
  }finally{
    pickLevel=pickKept;
    pickedComp=pickedCompKept;
    picked=null;
    if(explode)setExplode(0);
    moveArrowsOn=arrowsKept;
    try{
      if(storedArrows===null)localStorage.removeItem(ARROWS_KEY);else localStorage.setItem(ARROWS_KEY,storedArrows);
      if(presetKept===null)localStorage.removeItem(LAST_PRESET_KEY);else localStorage.setItem(LAST_PRESET_KEY,presetKept);
    }catch(e){}
    arrowLit=null;
    setWoodMode(modeKept);
    load(JSON.stringify(blank()),true);
    setTool(toolKept);
    setTab(tabKept);
    if($('#toast'))$('#toast').classList.remove('on');
  }
});

/* ---------- Properties: how far it is open ---------- */
function propsMotion(ps){
  const riding=ps.map(p=>moversNow().ofPiece.get(p.id)).find(Boolean);
  if(!riding)return'';
  const mover=riding,what=hardwareWords(mover.items);
  let html=propsSection(mover.kind==='swing'?'Open and close':'Pull out and push in');
  if(mover.stuck){
    return html+propsNote(`${esc(mover.name)} is on ${esc(what)}, but it is also fastened to <b>${esc(mover.stuck.name)}</b>, so it cannot open. Unfasten that connection (U).`);
  }
  const open=mover.open,reach=openReach(mover);
  html+=`<div class="frow wide"><label>Open</label><span class="rng"><input type="range" min="0" max="100" step="1" value="${Math.round(open*100)}" data-open-slide aria-label="How far open"><b data-open-said>${openSaid(mover,open)}</b></span></div>`+
    `<div class="f3 even"><button class="btn t" data-open-to="1"${open>=1?' disabled':''}>Open</button><button class="btn t" data-open-to="0"${open<=0?' disabled':''}>Close</button></div>`;
  const most=mover.kind==='swing'?`${esc(mover.name)} swings up to ${mover.limit}° on ${esc(what)}.`:`${esc(mover.name)} comes out ${fmt(r16(mover.travel))} on ${esc(what)}.`;
  if(!reach.hit)html+=propsNote(most+' Nothing is in its way.');
  else if(reach.free<CANNOT_OPEN)html+=propsNote(`<b>It cannot open:</b> it hits ${esc(reach.hit.other.name)} right away. Move ${esc(reach.hit.other.name)}, or hang it from another edge.`);
  else html+=propsNote(most+` <b>It hits ${esc(reach.hit.other.name)} after ${openSaid(mover,reach.free)}.</b>`);
  return html;
}
$('#props').addEventListener('input',e=>{
  if(!e.target.matches('[data-open-slide]'))return;
  const mover=selectedMover();
  if(!mover)return;
  setOpen(mover,e.target.value/100);
  showOpen(mover);
  $('#props [data-open-said]').textContent=openSaid(mover,mover.open);
});
$('#props').addEventListener('change',e=>{
  if(!e.target.matches('[data-open-slide]'))return;
  const mover=selectedMover();
  if(mover)openTo(mover,e.target.value/100);
});
$('#props').addEventListener('click',e=>{
  const button=e.target.closest('[data-open-to]');
  const mover=button&&selectedMover();
  if(mover)openTo(mover,+button.dataset.openTo);
});
