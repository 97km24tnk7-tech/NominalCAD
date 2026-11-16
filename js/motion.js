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

   In the 3D view the selected door, lid or drawer shows a small blue handle: drag it to open or close (an arc for
   a hinge, an arrow for a slide); click it to swing fully open or shut. */
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
  const radius=Math.max(.5,cam.r*.014),open=mover.open;
  const paint=()=>new THREE.MeshBasicMaterial({color:VIEW_COL.sel,depthTest:false,transparent:true,opacity:.95});
  let at;
  if(mover.kind==='swing'){
    const g=swingGeometry(mover,open,radius*4.5),points=[];
    at=g.at;
    for(let i=0;i<=32;i++)points.push(g.center.clone().add(g.out.clone().applyAxisAngle(mover.axis,i/32*mover.limit*Math.PI/180)));
    const arc=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:VIEW_COL.sel,depthTest:false,transparent:true,opacity:.8}));
    arc.renderOrder=8;
    motionGroup.add(arc);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(radius,16,12),paint());
    ball.position.copy(at);ball.renderOrder=9;
    motionGroup.add(ball);
    motionHandle={mover,at,radius,swing:g};
  }else{
    const all=bbox(mover.parts),middle=new THREE.Vector3((all.lo[0]+all.hi[0])/2,(all.lo[1]+all.hi[1])/2,(all.lo[2]+all.hi[2])/2);
    const half=Math.abs(mover.axis.x)*(all.hi[0]-all.lo[0])/2+Math.abs(mover.axis.y)*(all.hi[1]-all.lo[1])/2+Math.abs(mover.axis.z)*(all.hi[2]-all.lo[2])/2;
    const closedAt=middle.addScaledVector(mover.axis,half+radius*2.5); // just in front of the drawer
    at=closedAt.clone().addScaledVector(mover.axis,open*mover.travel);
    const cone=new THREE.Mesh(new THREE.ConeGeometry(radius,radius*2.6,16),paint());
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),mover.axis);
    cone.position.copy(at);cone.renderOrder=9;
    motionGroup.add(cone);
    const track=new THREE.Line(new THREE.BufferGeometry().setFromPoints([closedAt,closedAt.clone().addScaledVector(mover.axis,mover.travel)]),
      new THREE.LineBasicMaterial({color:VIEW_COL.sel,depthTest:false,transparent:true,opacity:.8}));
    track.renderOrder=8;
    motionGroup.add(track);
    motionHandle={mover,at,radius:radius*1.3,closedAt};
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
    return{dist:along,tip:`Drag to open or close ${mover.name}. Click to ${mover.open?'close':'open'} it.`,through:true,
      press(e,base){
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
            if(!d.moved)setOpen(mover,start>0?0:1); // a click swings it fully open or shut
            const hit=openBlock(mover,mover.open);
            commit();
            if(hit)toast(`${mover.name} hits ${hit.other.name} before it is open ${openSaid(mover,mover.open)}. Both are shown in red.`);
          }};
      }};
  },
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
