/* NominalCAD: which pieces touch, found fast.

   findJoints() (js/joints.js) used to compare every piece with every other piece. That is fine for a table and
   far too slow for a fish room wall of 5,000 pieces (12 million pairs). This file finds the same joints by
   sweeping once along the longest side of the design: the pieces are sorted by where they start along that
   side, and a piece is only compared with the pieces that have not ended yet when it starts.

     findJointsFast(parts)      the joints of square-set wooden pieces, exactly as findJointsAllPairs() gives them
                                (same entries, same keys, same order)
     jointOfPair(a, b)          the joint between two boxes from boxOfPiece(), or null when they do not touch
     jointBetween(pA, pB)       the joint between two pieces, or null (for Connect and the Properties panel)
     findAngledTies(parts)      contacts of pieces that are set at an angle (braces, rafters, a design turned
                                15 degrees). They have no fastener worked out, but they hold: see js/connections.js
     findPropRests(parts)       what each fish tank, light, mattress or window sits on, so that it goes along when
                                its stand is moved

   A joint is described in the briefing and in js/joints.js:
     {key, a, b, k, u, v, ru, rv, plane, fa, fb, da, db}   key is "idOfA-idOfB", a is the piece that comes first in S.parts. */
'use strict';

const TOUCH_GAP=.02;      // inches: two faces this close or closer count as touching
const TOUCH_OVERLAP=.1;   // inches: the faces must overlap at least this much in both directions to make a joint

/* a piece as the sweep needs it: its box, and its place in the list (which decides who is "a" in a joint) */
function boxOfPiece(p,index){
  const s=size(p);
  return{p,index,lo:p.pos,hi:[p.pos[0]+s[0],p.pos[1]+s[1],p.pos[2]+s[2]],s};
}

/* The joint between two boxes, a before b in the list, or null. The test is the one findJointsAllPairs has always
   used, so both give the same answer: the first direction in which a face of one lies on a face of the other,
   with the two faces overlapping. */
function jointOfPair(a,b){
  const joint=rawJointOfPair(a,b);
  // a contact with a shaped piece is trimmed to where the wood really is (a rail under a hole, a cut end:
  // trimJoint, js/shapes.js); pairs of plain pieces skip it
  return joint&&(joint.a.shape||joint.b.shape)?trimJoint(joint,a,b):joint;
}
/* the contact of two blank boxes, before any shape is looked at */
function rawJointOfPair(a,b){
  for(let k=0;k<3;k++){
    // apart in this direction: they cannot touch at all
    if(a.lo[k]>b.hi[k]+TOUCH_GAP||b.lo[k]>a.hi[k]+TOUCH_GAP)return null;
  }
  for(let k=0;k<3;k++){
    let plane=null;
    if(Math.abs(a.hi[k]-b.lo[k])<TOUCH_GAP)plane=a.hi[k];
    else if(Math.abs(b.hi[k]-a.lo[k])<TOUCH_GAP)plane=a.lo[k];
    if(plane===null)continue;
    const u=k===0?1:0,v=k===2?1:2; // the two directions that lie in the touching faces
    const ru=[Math.max(a.lo[u],b.lo[u]),Math.min(a.hi[u],b.hi[u])];
    const rv=[Math.max(a.lo[v],b.lo[v]),Math.min(a.hi[v],b.hi[v])];
    if(ru[1]-ru[0]<TOUCH_OVERLAP||rv[1]-rv[0]<TOUCH_OVERLAP)continue;
    return{key:a.p.id+'-'+b.p.id,a:a.p,b:b.p,k,u,v,ru,rv,plane,
      fa:faceType(a.p,k),fb:faceType(b.p,k),da:a.s[k],db:b.s[k]};
  }
  return null;
}

/* Runs visit(a, b) for every two boxes that could touch (their spans along the sweep direction meet). a comes
   before b in the list the boxes were made from. gap is how far apart two boxes may be and still count. */
function sweepPairs(boxes,gap,visit){
  if(boxes.length<2)return;
  // sweep along the longest side of the design: that is where the pieces are spread out most
  const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
  for(const b of boxes){
    for(let k=0;k<3;k++){
      if(b.lo[k]<lo[k])lo[k]=b.lo[k];
      if(b.hi[k]>hi[k])hi[k]=b.hi[k];
    }
  }
  let axis=0;
  for(let k=1;k<3;k++)if(hi[k]-lo[k]>hi[axis]-lo[axis])axis=k;

  const order=boxes.slice().sort((p,q)=>p.lo[axis]-q.lo[axis]);
  let open=[]; // boxes that started already and have not ended yet
  for(const box of order){
    const start=box.lo[axis]-gap;
    let kept=0;
    for(const other of open){
      if(other.hi[axis]<start)continue; // ended before this one starts: it can never touch a later one either
      open[kept++]=other;
      if(other.index<box.index)visit(other,box);else visit(box,other);
    }
    open.length=kept;
    open.push(box);
  }
}

/* ---------- a design that was turned as one ----------
   A cabinet that is turned 30 degrees in the room is still the same cabinet: the same screws, the same shopping
   list, the same steps. Turning a fastened set gives every piece of it that stood square the same rotation and
   marks it (piece.turned; applyRot, js/transform.js), so marked pieces that share one rotation are a TURNED SET:
   seen from inside, they stand square to each other exactly as they did before the turn. Their joints are
   worked out in that frame.

     turnedSets(parts)   {list, of}: the turned sets among these pieces, and a Map from piece to its set. A set is
                         {key, pieces, lo (Map piece -> its low corner in the frame of the set), matrix (takes a
                         point of that frame to the world), inverse (the other way), q, qInverse}. Two or more
                         pieces; one piece alone at an angle is a brace, not a set.
     joint.frame         the set a joint was worked out in (missing for pieces that stand square in the world).
                         Everything about such a joint is in the frame of its set: plane, ru, rv, and the layout of
                         its fasteners (f.frame, js/fasteners.js).
     squaredUp(fn)       runs fn with every turned set standing square, as it stood before it was turned (each set
                         un-turned in place, about its first piece), and puts the pieces back afterwards, whatever
                         happens. Inside it the design IS the square design: positions, boxes, joints and fastener
                         layouts all agree, so the code that words the steps, counts the hardware or takes the
                         pictures needs to know nothing about turned sets. Calls nest. squaredNow is the sets
                         while it runs, else null.
   The frame of a set stands on sixteenths again, as the design did before the turn. */
let squaredNow=null;
const NO_SETS={list:[],of:new Map()};
/* one text for every piece that is turned the same way ('' for a piece that stands square) */
function turnKey(p){
  const q=quatOf(p);
  if(!q)return'';
  const flip=q.w<0||(q.w===0&&(q.x<0||(q.x===0&&(q.y<0||(q.y===0&&q.z<0)))))?-1:1; // q and -q are the same turn
  return[q.x,q.y,q.z,q.w].map(v=>Math.round(v*flip*1e4)).join();
}
function turnedSets(parts){
  if(squaredNow)return squaredNow;
  let byKey=null;
  for(const p of parts){
    // p.turned: this piece stood square and was turned by the Rotate tool or R (applyRot, js/transform.js). A piece
    // that is set at an angle within its design (a rafter, a brace) is not marked, however the design is turned:
    // it has no joints worked out, before or after.
    if(isProp(p)||!p.q||!p.turned)continue;
    const key=turnKey(p);
    if(!byKey)byKey=new Map();
    if(!byKey.has(key))byKey.set(key,[]);
    byKey.get(key).push(p);
  }
  if(!byKey)return NO_SETS;   // nothing is set at an angle: the usual case, and no work
  const sets={list:[],of:new Map()};
  for(const[key,pieces]of byKey){
    if(pieces.length<2)continue;
    const q=quatOf(pieces[0]),qInverse=q.clone().invert();
    const middle=p=>{const s=size(p);return new THREE.Vector3(p.pos[0]+s[0]/2,p.pos[1]+s[1]/2,p.pos[2]+s[2]/2);};
    const pivot=middle(pieces[0]),corners=pieces.map(p=>{
      const s=size(p),c=middle(p).sub(pivot).applyQuaternion(qInverse).add(pivot);
      return[c.x-s[0]/2,c.y-s[1]/2,c.z-s[2]/2];
    });
    // back on the sixteenths the design stood on before it was turned: the first piece decides, the rest follow
    const shift=corners[0].map(v=>r16(v)-v),lo=new Map();
    pieces.forEach((p,i)=>lo.set(p,corners[i].map((v,k)=>{
      const at=v+shift[k],onGrid=r16(at);
      return Math.abs(at-onGrid)<.002?onGrid:at;
    })));
    // frame -> world: take the shift off, then turn about the pivot
    const matrix=new THREE.Matrix4().makeTranslation(pivot.x,pivot.y,pivot.z)
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
      .multiply(new THREE.Matrix4().makeTranslation(-pivot.x-shift[0],-pivot.y-shift[1],-pivot.z-shift[2]));
    // id: the same text for the same set turned the same way, however often it is worked out
    const id=key+'|'+Array.from(matrix.elements,v=>Math.round(v*1e3)).join();
    const set={key,id,pieces,lo,q,qInverse,matrix,inverse:matrix.clone().invert()};
    sets.list.push(set);
    for(const p of pieces)sets.of.set(p,set);
  }
  return sets;
}
function squaredUp(fn){
  if(squaredNow)return fn();
  const sets=turnedSets(S.parts);
  if(!sets.list.length)return fn();
  const kept=[];
  for(const set of sets.list){
    for(const p of set.pieces){
      kept.push({p,pos:p.pos,q:p.q,rot:p.rot});
      p.pos=set.lo.get(p).slice();
      // (emptied, not deleted: the piece keeps the order of its fields, so it is saved exactly as before)
      if('q' in p)p.q=undefined;
      if('rot' in p)p.rot=undefined;
    }
  }
  squaredNow=sets;
  try{return fn();}
  finally{
    squaredNow=null;
    for(const was of kept){
      was.p.pos=was.pos;
      if('q' in was.p)was.p.q=was.q;
      if('rot' in was.p)was.p.rot=was.rot;
    }
  }
}
/* a piece of a turned set as the sweep needs it: its box in the frame of the set */
function boxInSet(p,index,set){
  const s=size(p),lo=squaredNow?p.pos:set.lo.get(p);
  return{p,index,lo,hi:[lo[0]+s[0],lo[1]+s[1],lo[2]+s[2]],s};
}

function findJointsFast(parts){
  const boxes=[],sets=turnedSets(parts),setBoxes=new Map();
  parts.forEach((p,index)=>{
    if(isProp(p))return;
    const set=sets.of.get(p);
    if(set){
      if(!setBoxes.has(set))setBoxes.set(set,[]);
      setBoxes.get(set).push(boxInSet(p,index,set));
    }else if(!tilted(p))boxes.push(boxOfPiece(p,index));
  });
  const found=[];
  sweepPairs(boxes,TOUCH_GAP,(a,b)=>{
    const joint=jointOfPair(a,b);
    if(joint)found.push([a.index,b.index,joint]);
  });
  // the pieces of each turned set among themselves, in the frame of their set
  for(const[set,inSet]of setBoxes){
    sweepPairs(inSet,TOUCH_GAP,(a,b)=>{
      const joint=jointOfPair(a,b);
      if(!joint)return;
      joint.frame=set;
      found.push([a.index,b.index,joint]);
    });
  }
  // the same order as comparing every pair in turn: by the first piece, then by the second
  found.sort((x,y)=>x[0]-y[0]||x[1]-y[1]);
  return found.map(entry=>entry[2]);
}

/* the joint between two given pieces, or null when they do not touch (or one is a prop or set at an angle by itself) */
function jointBetween(pA,pB){
  if(!pA||!pB||pA===pB||isProp(pA)||isProp(pB))return null;
  const ia=S.parts.indexOf(pA),ib=S.parts.indexOf(pB);
  const first=ia<ib?pA:pB,second=ia<ib?pB:pA;
  if(tilted(pA)||tilted(pB)||squaredNow){
    // two pieces of one turned set meet like square pieces, in the frame of their set
    const sets=turnedSets(S.parts),set=sets.of.get(pA);
    if(set||sets.of.get(pB)){
      if(set!==sets.of.get(pB))return null;
      const joint=jointOfPair(boxInSet(first,0,set),boxInSet(second,1,set));
      if(joint)joint.frame=set;
      return joint;
    }
    if(tilted(pA)||tilted(pB))return null;
  }
  return jointOfPair(boxOfPiece(first,0),boxOfPiece(second,1));
}

/* ---------- pieces set at an angle ----------
   findJoints leaves angled pieces out, because no fastener can be worked out for them. They still hold on to what
   they touch: a brace is screwed to its leg, and a whole table that was turned 15 degrees is still one table.
   A tie is a contact that involves at least one angled piece:  {key, a, b, tie:true}  (a comes first in S.parts).
   Two pieces are tied when their real, turned boxes touch or overlap. */
const TIE_GAP=.06; // inches: an angled piece this close to another one counts as touching it (positions are rounded to 1/16)

/* a piece as a turned box: its middle, half sizes, and the three directions its sides run in */
function turnedBox(p,index){
  const s=size(p),q=quatOf(p),b=box(p);
  const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)];
  if(q)axes.forEach(axis=>axis.applyQuaternion(q));
  return{p,index,lo:b.lo,hi:b.hi,angled:!!q,
    c:new THREE.Vector3(p.pos[0]+s[0]/2,p.pos[1]+s[1]/2,p.pos[2]+s[2]/2),
    half:[s[0]/2,s[1]/2,s[2]/2],axes};
}
/* Do two turned boxes touch or overlap? The standard test: they are apart exactly when some direction (a side of
   either box, or a direction square to one side of each) shows a gap between them. */
function turnedBoxesTouch(a,b){
  const between=new THREE.Vector3().subVectors(b.c,a.c),probe=new THREE.Vector3();
  const reach=(box,dir)=>box.half[0]*Math.abs(dir.dot(box.axes[0]))+box.half[1]*Math.abs(dir.dot(box.axes[1]))+box.half[2]*Math.abs(dir.dot(box.axes[2]));
  const apartAlong=dir=>Math.abs(between.dot(dir))>reach(a,dir)+reach(b,dir)+TIE_GAP;
  for(let i=0;i<3;i++){
    if(apartAlong(a.axes[i])||apartAlong(b.axes[i]))return false;
  }
  for(let i=0;i<3;i++){
    for(let j=0;j<3;j++){
      probe.crossVectors(a.axes[i],b.axes[j]);
      if(probe.lengthSq()<1e-8)continue; // the two sides run the same way: already covered above
      probe.normalize();
      if(apartAlong(probe))return false;
    }
  }
  return true;
}
function findAngledTies(parts){
  // an end cut at an angle that only touches another piece is a tie too (shapeEndTies, js/shapes.js)
  if(!parts.some(p=>tilted(p)&&!isProp(p)))return shapeEndTies(parts); // nothing is set at an angle: the usual case, and no work
  const boxes=[];
  for(const p of parts){
    if(!isProp(p))boxes.push(turnedBox(p,boxes.length));
  }
  const ties=[],sets=turnedSets(parts);
  sweepPairs(boxes,TIE_GAP,(a,b)=>{
    if(!a.angled&&!b.angled)return; // two square pieces: findJoints has them
    if(a.angled&&b.angled&&sets.of.get(a.p)&&sets.of.get(a.p)===sets.of.get(b.p))return; // two pieces of one turned set: findJoints has those too
    for(let k=0;k<3;k++){
      if(a.lo[k]>b.hi[k]+TIE_GAP||b.lo[k]>a.hi[k]+TIE_GAP)return; // their outer bounds are apart
    }
    if(turnedBoxesTouch(a,b))ties.push({key:a.p.id+'-'+b.p.id,a:a.p,b:b.p,tie:true});
  });
  return ties.concat(shapeEndTies(parts));
}

/* ---------- things that are not wood ----------
   A fish tank, a light, a mattress or a window is not fastened to anything, but it sits somewhere: the tank on its
   shelf, the light over its tank. When the stand is moved they should go along, and they should still be free to
   move by themselves. A rest says what a prop sits on:  {prop, on}  (both pieces). A prop rests on
     - every wooden piece it touches, on any side (a tank on a shelf, a window between its studs);
     - a prop it stands on;
     - when it touches nothing at all: the nearest thing straight below it, up to PROP_HANG inches away
       (a light that hangs over its tank). */
const PROP_HANG=12; // inches
function findPropRests(parts){
  if(!parts.some(isProp))return[];
  const boxes=parts.map((p,index)=>{
    const b=box(p);
    return{p,index,lo:b.lo,hi:b.hi,prop:isProp(p)};
  });
  const rests=[],below=new Map(); // below: prop -> the nearest thing under it, in case it touches nothing
  const overlap=(a,b,k)=>Math.min(a.hi[k],b.hi[k])-Math.max(a.lo[k],b.lo[k]);
  const consider=(prop,other)=>{
    // how they meet: apart in one direction at most, and overlapping in the other two
    let apartIn=-1,gap=0;
    for(let k=0;k<3;k++){
      const space=-overlap(prop,other,k);
      if(space<-TOUCH_OVERLAP)continue;        // they overlap in this direction
      if(apartIn>=0||space>PROP_HANG)return;    // apart in two directions, or too far
      apartIn=k;gap=space;
    }
    if(apartIn<0)return;                        // one inside the other: not a rest
    const propIsAbove=prop.lo[apartIn]>=other.hi[apartIn]-TIE_GAP;
    if(gap<=TIE_GAP){
      if(!other.prop||(apartIn===1&&propIsAbove))rests.push({prop:prop.p,on:other.p,touching:true});
    }else if(apartIn===1&&propIsAbove){
      const nearest=below.get(prop.p);
      if(!nearest||gap<nearest.gap)below.set(prop.p,{on:other.p,gap});
    }
  };
  sweepPairs(boxes,PROP_HANG,(a,b)=>{
    if(a.prop)consider(a,b);
    if(b.prop)consider(b,a);
  });
  const touching=new Set(rests.map(rest=>rest.prop));
  for(const[prop,nearest]of below){
    if(!touching.has(prop))rests.push({prop,on:nearest.on,touching:false});
  }
  return rests;
}

/* The fast search must agree with the plain one. */
SELFTESTS.push(function neighborsAgree(problems){
  // (the plain search knows square pieces only; the joints inside a turned set have their own check, turnedSetsKeepTheirJoints)
  const plain=findJointsAllPairs(),fast=findJointsFast(S.parts).filter(joint=>!joint.frame);
  const flat=joints=>joints.map(j=>[j.key,j.k,j.plane,j.ru,j.rv,j.fa,j.fb,j.da,j.db].join(' ')).join('\n');
  if(flat(plain)!==flat(fast))problems.push(`neighbors: the fast search found ${fast.length} joints, the plain one ${plain.length}, or they differ in detail`);
});
