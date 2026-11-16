/* NominalCAD: the fasteners in the 3D view.

   Every fastener of fastenerLayout() (js/fasteners.js) is drawn at its real size and in its real direction: a
   screw, a brad or a framing nail is a head, a shank and a point; a pocket hole is the slanted hole with its
   screw and the oval it leaves on
   the hidden face; a dowel is a peg across the joint; a brad is a thin pin; a bracket is an L plate with its
   four screws; glue is a thin film on the contact (see-through and fasteners-only views only).

   They are drawn as a handful of THREE.InstancedMesh objects (one per shape, however many fasteners there are),
   kept in fastGroup, and only built again when something they depend on has changed: the design, what is hidden,
   the view mode, the picked connection. Selecting a piece does not rebuild them.

   A design with more than FASTENER_PIECES_MAX pieces draws only the fasteners of the selected pieces; the status
   bar says so (#stFast).

     drawFasteners()          rebuildScene() calls it (js/view3d.js)
     drawnFasteners           what is on screen now: [{f, link}] (f is a fastenerLayout entry)
   Pointing at a fastener shows its tip; clicking it picks its connection ({type:'conn', key}, js/viewpick.js),
   and the Properties panel then shows the two pieces, the fastener (which can be changed) and Delete connection. */
'use strict';

const FASTENER_PIECES_MAX=2000;   // more pieces than this: fasteners of the selection only. (Measured at 2,950 pieces with 15,210 fasteners: 60 ms more per change, 125 ms more per undo.)
const FASTENERS_DRAWN_MAX=30000;  // never more than this many at once
const HEAD_THICK=.1,HEAD_PROUD=.02; // a head is this thick, and stands this far out of the wood so that it can be seen
/* what each kind looks like in the Solid and See-through views (in Fasteners only they take the color of their
   kind from JTYPES, the same colors as the key on the Fasteners tab) */
const FASTENER_LOOK={screw:0x4b4f55,pocket:0x5f7186,brad:0x7b7f85,nail:0x8a8f96,dowel:0x9a6b3c,bracket:0xb9bec5,bracketScrew:0x55595f,hole:0x4a3524,glue:0xf2c230};
/* the fastener type a kind stands for, when a fastener does not say its own (f.type, set by fastenerLayout) */
const TYPE_OF_KIND={screw:'screw',pocket:'pocket',brad:'nail',dowel:'dowel',bracket:'bracket',nail:'frame'};

let drawnFasteners=[];
let fastenersKey='';     // what the fasteners on screen were built from
const graphNumbers=new WeakMap();
let graphCount=0;

/* ---------- shapes that are drawn many times ---------- */
const FAST_STICK=new THREE.CylinderGeometry(1,1,1,8).translate(0,.5,0); // from the origin one unit up; scaled to radius and length
const FAST_POINT=new THREE.ConeGeometry(1,1,8).translate(0,.5,0);
const FAST_BLOCK=new THREE.BoxGeometry(1,1,1);
const FAST_UP=new THREE.Vector3(0,1,0);
const tmp={pos:new THREE.Vector3(),dir:new THREE.Vector3(),scale:new THREE.Vector3(),turn:new THREE.Quaternion(),x:new THREE.Vector3(),z:new THREE.Vector3()};
/* a stick of this radius and length that starts at pos and runs along dir */
function stickAt(pos,dir,radius,length){
  tmp.turn.setFromUnitVectors(FAST_UP,tmp.dir.set(dir[0],dir[1],dir[2]).normalize());
  return new THREE.Matrix4().compose(tmp.pos.set(pos[0],pos[1],pos[2]),tmp.turn,tmp.scale.set(radius,length,radius));
}
function blockAt(center,sizes){
  return new THREE.Matrix4().compose(tmp.pos.set(center[0],center[1],center[2]),tmp.turn.set(0,0,0,1),tmp.scale.set(sizes[0],sizes[1],sizes[2]));
}
/* the oval a slanted hole leaves on a face: a flat disc on the face (normal = out), stretched along the hole */
function ovalAt(center,out,along,halfWide,halfLong){
  const normal=tmp.dir.set(out[0],out[1],out[2]);
  tmp.z.set(along[0],along[1],along[2]).addScaledVector(normal,-(along[0]*out[0]+along[1]*out[1]+along[2]*out[2])).normalize();
  tmp.x.crossVectors(normal,tmp.z);
  return new THREE.Matrix4().makeBasis(tmp.x.clone().multiplyScalar(halfWide),normal.clone().multiplyScalar(.03),tmp.z.clone().multiplyScalar(halfLong))
    .setPosition(center[0]+out[0]*.01,center[1]+out[1]*.01,center[2]+out[2]*.01);
}
/* one InstancedMesh from a list of [matrix, color] */
function instanced(shape,items,material){
  if(!items.length)return null;
  const mesh=new THREE.InstancedMesh(shape,material,items.length),color=new THREE.Color();
  items.forEach(([matrix,hex],i)=>{
    mesh.setMatrixAt(i,matrix);
    mesh.setColorAt(i,color.setHex(hex));
  });
  mesh.frustumCulled=false; // the instances are all over the design, not where the one shape is
  return mesh;
}

/* ---------- which connections get their fasteners drawn ---------- */
function linksToDraw(){
  const graph=connGraph();
  if(S.parts.length<=FASTENER_PIECES_MAX)return{links:graph.links,limited:false};
  const found=new Map();
  for(const id of sel){
    for(const link of connectionsOf(id))found.set(link.key,link);
    if(found.size>FASTENERS_DRAWN_MAX)break;
  }
  if(picked&&picked.type==='conn'&&graph.byKey.has(picked.key))found.set(picked.key,graph.byKey.get(picked.key));
  return{links:[...found.values()],limited:true};
}
function fastenersKeyNow(on){
  if(!on)return'off';
  const graph=connGraph();
  if(!graphNumbers.has(graph))graphNumbers.set(graph,++graphCount);
  let hidden=0,chosen=0;
  for(const id of hiddenIds)hidden+=id;
  const big=S.parts.length>FASTENER_PIECES_MAX;
  if(big)for(const id of sel)chosen+=id;
  // (squaredNow: while a picture is taken with the turned sets standing square, their fasteners stand elsewhere than on screen)
  return[graphNumbers.get(graph),woodMode,hiddenIds.size,hidden,picked&&picked.type==='conn'?picked.key:'',big?sel.size+':'+chosen:'',openSignature(),squaredNow?'squared':''].join('|');
}

function drawFasteners(){
  checkPicked(); // a pick whose thing is gone is dropped before anything is drawn with it (js/viewpick.js)
  const on=$('#showFast').checked&&!lite&&!spotlightIds; // not while a resize is being dragged, and not during Show me (js/visibility.js)
  const key=fastenersKeyNow(on);
  if(key===fastenersKey)return;
  fastenersKey=key;
  for(const mesh of fastGroup.children)mesh.dispose(); // frees the per-instance data of an InstancedMesh
  emptyGroup(fastGroup);
  drawnFasteners=[];
  const note=$('#stFast');
  if(!on){if(note)note.hidden=true;return;}

  const{links,limited}=linksToDraw();
  if(note){
    note.hidden=!limited;
    note.textContent=sel.size?'Fasteners: selection only':'Fasteners: select a piece';
  }
  const byKind=woodMode==='fast',inside=woodMode!=='solid'; // inside: the wood can be seen into, so what is inside it is drawn too
  const sticks=[],points=[],blocks=[],ovals=[],films=[];
  const colorOf=(f,isPicked)=>isPicked?VIEW_COL.sel:byKind?JTYPES[f.type||TYPE_OF_KIND[f.kind]][1]:FASTENER_LOOK[f.kind];
  /* The fasteners of a turned set are laid out in the frame of their set (js/neighbors.js). Each shape is made
     there like any other and then taken to the world as it is, by the matrix of the set. */
  let frame=null;
  const placed=matrix=>frame&&!squaredNow?matrix.premultiply(frame.matrix):matrix; // (while the design is squared up for a picture, the frame IS the world)
  /* a screw or a brad: head, shank and point */
  const pin=(f,hex,headHex)=>{
    const pointLong=Math.min(.25,f.len*.2);
    if(f.head)sticks.push([placed(stickAt(pointPlus(f.pos,f.dir,-HEAD_PROUD),f.dir,f.head/2,HEAD_THICK)),headHex]);
    sticks.push([placed(stickAt(f.pos,f.dir,f.dia/2,f.len-pointLong)),hex]);
    points.push([placed(stickAt(pointPlus(f.pos,f.dir,f.len-pointLong),f.dir,f.dia/2,pointLong)),hex]);
  };
  // every layout is worked out with the turned sets standing square, once for all of them
  const layouts=squaredUp(()=>links.map(link=>link.fastened&&link.joint?fastenersOfLink(link):null));
  links.forEach((link,index)=>{
    if(!link.fastened||!link.joint||hiddenIds.has(link.a.id)||hiddenIds.has(link.b.id))return;
    if(isPosedOpen(link.a.id)||isPosedOpen(link.b.id))return; // drawn swung open or pulled out: its fasteners would be left hanging where it was (js/motion.js)
    const isPicked=!!picked&&picked.type==='conn'&&picked.key===link.key;
    frame=link.joint.frame||null;
    if(inside){
      const film=glueFilm(link.joint,link.type);
      if(film){
        const center=[0,0,0],sizes=[0,0,0],j=link.joint;
        center[film.k]=film.plane;sizes[film.k]=.03;
        center[j.u]=(film.ru[0]+film.ru[1])/2;sizes[j.u]=film.ru[1]-film.ru[0];
        center[j.v]=(film.rv[0]+film.rv[1])/2;sizes[j.v]=film.rv[1]-film.rv[0];
        films.push([placed(blockAt(center,sizes)),isPicked?VIEW_COL.sel:byKind?JTYPES.glue[1]:FASTENER_LOOK.glue]);
      }
    }
    for(const f of layouts[index]){
      if(drawnFasteners.length>=FASTENERS_DRAWN_MAX)break;
      drawnFasteners.push({f,link});
      const hex=colorOf(f,isPicked);
      if(f.kind==='screw'||f.kind==='brad'||f.kind==='nail')pin(f,hex,hex);
      else if(f.kind==='pocket'){
        pin(f,hex,hex);
        const hole=isPicked?VIEW_COL.sel:FASTENER_LOOK.hole,slant=Math.sin(FASTEN.pocketDegrees*Math.PI/180);
        ovals.push([placed(ovalAt(f.pocket.mouth,f.pocket.out,f.dir,f.pocket.dia/2,f.pocket.dia/2/slant)),hole]);
        if(inside){ // the slanted hole itself, from the face down to the head of the screw
          const long=Math.hypot(f.pos[0]-f.pocket.mouth[0],f.pos[1]-f.pocket.mouth[1],f.pos[2]-f.pocket.mouth[2]);
          sticks.push([placed(stickAt(f.pocket.mouth,f.dir,f.pocket.dia/2*.9,long)),hole]);
        }
      }
      else if(f.kind==='dowel')sticks.push([placed(stickAt(f.pos,f.dir,f.dia/2,f.len)),hex]);
      else if(f.kind==='bracket'){
        for(const plate of f.plates)blocks.push([placed(blockAt(plate.c,plate.s)),hex]);
        const screwHex=isPicked?VIEW_COL.sel:byKind?hex:FASTENER_LOOK.bracketScrew;
        for(const screw of f.screws)pin(screw,screwHex,screwHex);
      }
    }
  });
  const metal=()=>new THREE.MeshLambertMaterial({color:0xffffff});
  for(const mesh of[instanced(FAST_STICK,sticks,metal()),instanced(FAST_POINT,points,metal()),instanced(FAST_BLOCK,blocks,metal()),instanced(FAST_STICK,ovals,metal()),
    instanced(FAST_BLOCK,films,new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.55,depthWrite:false}))]){
    if(mesh)fastGroup.add(mesh);
  }
}
/* emptyGroup() frees what a group held; the three shared shapes must survive that */
for(const shape of[FAST_STICK,FAST_POINT,FAST_BLOCK])shape.dispose=()=>{};

/* ---------- pointing and clicking ---------- */
/* how close the pointer's ray passes to the stretch from p0 to p1, and how far along the ray that is */
function rayToStretch(origin,dir,p0,p1){
  const vx=p1[0]-p0[0],vy=p1[1]-p0[1],vz=p1[2]-p0[2];
  const wx=origin.x-p0[0],wy=origin.y-p0[1],wz=origin.z-p0[2];
  const b=dir.x*vx+dir.y*vy+dir.z*vz,c=vx*vx+vy*vy+vz*vz,d=dir.x*wx+dir.y*wy+dir.z*wz,e=vx*wx+vy*wy+vz*wz;
  const den=c-b*b;
  const onStretch=Math.max(0,Math.min(1,den<1e-9?0:(e-b*d)/den));
  const onRay=Math.max(0,onStretch*b-d);
  const gx=wx+onRay*dir.x-onStretch*vx,gy=wy+onRay*dir.y-onStretch*vy,gz=wz+onRay*dir.z-onStretch*vz;
  return{gap:Math.hypot(gx,gy,gz),dist:onRay};
}
VIEW_PICKERS.push({
  early:false,
  find(){
    if(!fastGroup.visible||!drawnFasteners.length)return null;
    const reach=Math.max(.18,cam.r*.004); // about three pixels at any zoom
    const inFrame=new Map(); // the pointer's ray in the frame of each turned set, where the fasteners of that set are laid out
    const rayFor=f=>{
      if(!f.frame)return ray.ray;
      if(!inFrame.has(f.frame))inFrame.set(f.frame,{origin:ray.ray.origin.clone().applyMatrix4(f.frame.inverse),direction:ray.ray.direction.clone().applyQuaternion(f.frame.qInverse)});
      return inFrame.get(f.frame);
    };
    let best=null;
    for(const drawn of drawnFasteners){
      const f=drawn.f,origin=rayFor(f).origin,dir=rayFor(f).direction;
      // its head (what shows on the surface) first, then anywhere along it
      let hit=rayToStretch(origin,dir,f.pos,f.pos);
      if(hit.gap>Math.max(reach,f.head/2))hit=rayToStretch(origin,dir,f.pos,pointPlus(f.pos,f.dir,f.len));
      if(hit.gap>Math.max(reach,f.dia/2))continue;
      if(!best||hit.dist<best.dist)best={dist:hit.dist,drawn};
    }
    if(!best)return null;
    const{f,link}=best.drawn;
    return{dist:best.dist,tip:f.tip,through:woodMode!=='solid',press:()=>setPicked({type:'conn',key:link.key})};
  },
});

/* ---------- a picked connection ---------- */
const pickedLink=pick=>connGraph().byKey.get(pick.key);
PICKED_KINDS.conn={
  exists:pick=>{const link=pickedLink(pick);return!!link&&link.fastened;},
  prompt(pick){
    const link=pickedLink(pick);
    return`Connection: ${link.a.name} to ${link.b.name}, ${linkSaid(link)}. Change the fastener in Properties, or press Delete to remove the connection.`;
  },
  props(pick){
    const link=pickedLink(pick);
    if(!link)return null;
    let html=propsNote(`<b>${esc(link.a.name)}</b> is fastened to <b>${esc(link.b.name)}</b>.`);
    if(link.joint){
      const j=link.joint,spec=jSpec(j,link.type);
      const types=Object.entries(JTYPES).map(([key,type])=>`<option value="${key}"${key===link.type?' selected':''}>${type[0]}</option>`).join('');
      // in plain words: which piece the fastener goes through, which it goes into, and where (the same sentence
      // the build instructions use: connectionSentence, js/buildsteps.js), and a way to the card of this joint
      const said=connectionSentence(link),cardIndex=WORD_LINKS.findIndex(row=>row.joint===link.type);
      if(said)html+=propsNote(esc(said));
      if(cardIndex>=0)html+=`<button class="btn t" data-conn-card data-link="${cardIndex}" title="What this fastener is, what you need for it and how to do it, with a drawing">${icon('i-info')}How this joint is made</button>`;
      html+=propsNote(`The ${j.fa} of ${esc(j.a.name)} meets the ${j.fb} of ${esc(j.b.name)}.`)+
        propsRow('Fasten with',`<select class="fld" data-conn-type="${link.key}">${types}</select>`,true)+
        propsRow('How many',`<b>${spec.n?spec.n:'none'}</b>`,true)+
        propsNote(`<b>${esc(spec.text)}</b><br>${esc(JTYPES[link.type][2])}`);
    }else html+=propsNote(esc(linkSaid(link)));
    html+=propsSection('The two pieces')+
      `<div class="f3 even"><button class="btn t" data-conn-piece="${link.a.id}" title="Select this piece">${esc(link.a.name)}</button>`+
      `<button class="btn t" data-conn-piece="${link.b.id}" title="Select this piece">${esc(link.b.name)}</button></div>`+
      propsSection('Remove')+
      `<button class="btn dng" data-conn-delete title="Deletes this connection, after asking. The two pieces then only touch, and each can be moved alone (Delete)">${icon('i-unfasten')}Delete connection</button>`;
    return{title:'Connection',html};
  },
  remove(pick){
    const link=pickedLink(pick);
    if(link)askDeleteLinks([link],`${link.a.name} or ${link.b.name}`,'The connection is deleted. Connect (C) fastens the two pieces again.');
  },
};
$('#props').addEventListener('change',e=>{
  const key=e.target.dataset.connType;
  if(!key)return;
  S.joints[key]=e.target.value;
  commit();
});
$('#props').addEventListener('click',e=>{
  const piece=e.target.closest('[data-conn-piece]');
  if(piece){picked=null;sel=new Set([+piece.dataset.connPiece]);renderAll();return;}
  const card=e.target.closest('[data-conn-card]');
  // the card of this kind of joint, beside the button (js/wordlinks.js). After this click has run its course:
  // the page closes an open card on any click outside it.
  if(card){setTimeout(()=>openInfoCard(card),0);return;}
  if(e.target.closest('[data-conn-delete]'))deletePicked();
});
/* the two pieces of the picked connection get the lighter outline, so it is clear what the fasteners hold */
SCENE_EXTRAS.push(function outlinePickedConnection(){
  if(!picked||picked.type!=='conn')return;
  const link=pickedLink(picked);
  if(!link)return;
  for(const piece of[link.a,link.b]){
    const group=meshes.get(piece.id);
    if(!group)continue;
    const edges=group.children[1].material;
    edges.color.setHex(VIEW_COL.follow);
    edges.transparent=true;
    edges.opacity=1;
  }
});

/* ---------- checks ---------- */
SELFTESTS.push(function fastenersInTheView(problems){
  const wrong=text=>problems.push('fastener view: '+text);
  const modeKept=woodMode,switchKept=$('#showFast').checked,pickedKept=picked;
  load(JSON.stringify(blank()),true);
  // a leg with a top screwed down onto it and a rail pocket-screwed into its side
  const[leg,top,rail]=addParts([mk('Leg','4x4',[3.5,20,3.5],[0,0,0]),mk('Top','1x6',[20,.75,5.5],[0,20,0]),mk('Rail','2x4',[16,3.5,1.5],[3.5,10,1])]);
  S.joints[leg+'-'+top]='screw';
  $('#showFast').checked=true;
  try{
    setWoodMode('solid');
    commit();
    const expected=connGraph().links.reduce((sum,link)=>sum+(link.joint&&link.fastened?jSpec(link.joint,link.type).n:0),0);
    if(!expected||drawnFasteners.length!==expected)wrong(`${drawnFasteners.length} fasteners are drawn but the Fasteners tab lists ${expected}`);
    if(!fastGroup.children.length||!fastGroup.children.every(mesh=>mesh.isInstancedMesh))wrong('the fasteners are not drawn as instanced meshes');
    const meshesBefore=fastGroup.children.slice();
    sel=new Set([leg]);renderAll();
    if(fastGroup.children[0]!==meshesBefore[0])wrong('selecting a piece rebuilt the fasteners (it should not)');
    // pointing at the head of a screw on top of the board finds it, with a tip in plain words
    const screw=drawnFasteners.find(d=>d.f.kind==='screw');
    if(!screw)wrong('no wood screw is drawn for a screwed joint');
    else{
      ray.set(new THREE.Vector3(screw.f.pos[0],screw.f.pos[1]+30,screw.f.pos[2]),new THREE.Vector3(0,-1,0));
      const found=VIEW_PICKERS.filter(p=>!p.early).map(p=>p.find()).find(Boolean);
      if(!found||!/wood screw\. Goes through Top into Leg\./.test(found.tip))wrong('pointing at a screw head does not give its tip: '+(found&&found.tip));
      else{
        found.press();
        if(!picked||picked.type!=='conn'||sel.size)wrong('clicking a fastener did not pick its connection');
        if(!/Fasten with/.test($('#props').textContent)||!/Delete connection/.test($('#props').textContent))wrong('Properties of a picked connection lacks the fastener choice or Delete connection');
        const choice=$('#props [data-conn-type]');
        choice.value='dowel';choice.dispatchEvent(new Event('change',{bubbles:true}));
        if(S.joints[leg+'-'+top]!=='dowel'||!drawnFasteners.some(d=>d.f.kind==='dowel'))wrong('changing the fastener of a picked connection did not take');
        deletePicked(); // answered yes at once while the self-check runs
        if(S.joints[leg+'-'+top]!=='none'||picked)wrong('Delete connection did not delete the picked connection');
      }
    }
    $('#showFast').checked=false;rebuildScene();
    if(fastGroup.children.length)wrong('the Fasteners switch did not hide the fasteners');
    void rail;
  }finally{
    $('#showFast').checked=switchKept;picked=pickedKept;
    setWoodMode(modeKept);
    if($('#toast'))$('#toast').classList.remove('on');
  }
});

/* A design that is turned as one to an angle that is not a quarter turn (R 30, a rotate ring at 45 degrees) is
   still the same design: the same joints with the same fasteners, the same hardware to buy, the same "Fasten
   with" lines in the steps, and its fasteners are drawn inside its wood where it stands now. Tried about the
   upright direction and about a level one, on two presets and on a framed shed wall's worth of nails. */
SELFTESTS.push(function turnedSetsKeepTheirJoints(problems){
  const wrong=text=>problems.push('turned design: '+text);
  const kept={mode:woodMode,shown:$('#showFast').checked,sel,tab};
  let presetKept=null;   // placePreset remembers the preset it placed for the dialog; that must not change here
  try{presetKept=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  const facts=()=>({
    joints:connGraph().links.filter(link=>link.joint).map(link=>link.key+' '+link.type).sort().join('|'),
    rows:JSON.stringify(hardwareTotals(findJoints()).rows),
    drawn:drawnFasteners.length,
    lines:buildPlan(true).steps.map(step=>step.groups.map(group=>group.line).join(' / ')).join(' || '),
    sets:fastenedGroups().length,
  });
  /* is this point of the world inside the piece as it stands now (turned or not), give or take a little? */
  const inPiece=(point,piece)=>{
    const s=size(piece),local=point.clone().sub(new THREE.Vector3(piece.pos[0]+s[0]/2,piece.pos[1]+s[1]/2,piece.pos[2]+s[2]/2));
    const q=quatOf(piece);
    if(q)local.applyQuaternion(q.clone().invert());
    return[0,1,2].every(k=>Math.abs(local.getComponent(k))<=s[k]/2+.08);
  };
  $('#showFast').checked=true;
  try{
    setTab('design');
    setWoodMode('solid');
    for(const name of['Base cabinet with doors','Workbench','Shed']){
      const preset=PRESETS.find(candidate=>candidate.name===name);
      if(!preset)continue;
      for(const[axis,degrees]of name==='Shed'?[[1,30]]:[[1,30],[0,20]]){
        const label=`${name} turned ${degrees} degrees about ${axis===1?'the upright direction':'a level direction'}: `;
        load(JSON.stringify(blank()),true);
        const vals=presetDefaults(preset);
        placePreset(preset,vals,preset.build(vals),false);
        const before=facts();
        if(!before.drawn||!before.joints){wrong(label+'(setting up) the design has no fasteners to begin with');continue;}
        sel=new Set([S.parts.find(p=>!isProp(p)&&!tilted(p)).id]);
        applyRot(snapshot(),axis,degrees*Math.PI/180,selCenter());finishRot();commit();
        const after=facts();
        if(after.joints!==before.joints)wrong(label+`it had ${before.joints.split('|').length} joints and now has ${after.joints?after.joints.split('|').length:0}, or their fasteners changed`);
        if(after.rows!==before.rows)wrong(label+'the hardware to buy changed');
        if(after.drawn!==before.drawn)wrong(label+`${after.drawn} fasteners are drawn; before the turn there were ${before.drawn}`);
        if(after.lines!==before.lines)wrong(label+'the "Fasten with" lines of the steps changed');
        if(after.sets!==before.sets)wrong(label+`it is ${after.sets} fastened sets; before the turn it was ${before.sets}`);
        // each fastener is drawn where its two pieces are now: its head in or on one of them, its point in the other
        const astray=drawnFasteners.find(({f})=>{
          const world=fastenerInWorld(f),head=new THREE.Vector3(world.pos[0],world.pos[1],world.pos[2]);
          const point=head.clone().addScaledVector(new THREE.Vector3(world.dir[0],world.dir[1],world.dir[2]),f.len);
          const pieces=[f.through,f.into,...(f.also||[])];
          return!pieces.some(piece=>inPiece(head,piece))||!pieces.some(piece=>inPiece(point,piece));
        });
        if(astray)wrong(label+`a ${astray.f.label} of ${astray.link.a.name} to ${astray.link.b.name} is drawn outside the two pieces`);
        // pointing at a fastener of the turned design still finds it
        const screw=drawnFasteners.find(({f})=>f.frame&&(f.kind==='screw'||f.kind==='nail'));
        if(screw){
          const world=fastenerInWorld(screw.f),head=new THREE.Vector3(world.pos[0],world.pos[1],world.pos[2]),along=new THREE.Vector3(world.dir[0],world.dir[1],world.dir[2]);
          ray.set(head.clone().addScaledVector(along,-30),along);
          const found=VIEW_PICKERS.filter(picker=>!picker.early).map(picker=>picker.find()).find(Boolean);
          if(!found||!/Goes through/.test(found.tip||''))wrong(label+'pointing at the head of a fastener does not find it');
        }
        // the pictures for the plans do not leave the design standing square on screen, or change it
        const stood=JSON.stringify(S.parts.map(p=>[p.pos,p.q||0,p.rot||0]));
        takePictures(true);
        if(JSON.stringify(S.parts.map(p=>[p.pos,p.q||0,p.rot||0]))!==stood)wrong(label+'taking the pictures for the plans moved the pieces');
        if(squaredNow)wrong(label+'the design was left squared up after the pictures');
        // a turn that makes it a quarter turn in all: the pieces stand square again, with everything as it was
        if(axis===1){
          applyRot(snapshot(),axis,(90-degrees)*Math.PI/180,selCenter());finishRot();commit();
          const squared=facts();
          if(turnedSets(S.parts).list.length)wrong(label+'after the rest of a quarter turn its pieces still count as turned');
          if(squared.rows!==before.rows||squared.sets!==before.sets)wrong(label+'after the rest of a quarter turn the hardware to buy or the fastened sets changed');
        }
      }
    }
  }finally{
    $('#showFast').checked=kept.shown;
    setWoodMode(kept.mode);
    load(JSON.stringify(blank()),true);
    sel=kept.sel;
    setTab(kept.tab);
    try{
      if(presetKept===null)localStorage.removeItem(LAST_PRESET_KEY);
      else localStorage.setItem(LAST_PRESET_KEY,presetKept);
    }catch(e){}
    if($('#toast'))$('#toast').classList.remove('on');
  }
});
