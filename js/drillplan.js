/* NominalCAD: drill your pieces. The data and the words of the step "Drill your pieces" (spec 11, stage 1).

   The owner, a steel detailer: "you want all your pieces made and then you just assemble it". So the Build
   instructions get a step 2, right after cutting: every hole that can be drilled ahead is on a drawing of its piece,
   located from one named end and one named edge, and after that step the person only puts the pieces together and
   drives the screws. Stage 1 does this for every pocket hole of every design (presets and designs drawn by hand);
   the other holes are listed in words as drilled in the step that drives them.

   This file holds the data and the words, no drawing and no HTML: the drawings and the step's page are in
   js/partdrawings.js. buildPlan (js/buildsteps.js) calls drillPlan once and keeps it on the plan (plan.drill), so
   the memo of the plan is the memo of this.

     DRILL_KINDS          one row per kind of hole: when it is drilled ('ahead' in step 2, 'assembly' in the step that
                          drives it, 'none' for nothing to drill) and from which stage on that is live. A new kind of
                          hole is a row here.
     DRILL_STAGE          which rows are live (1: pocket holes)
     DRILL_DRAWINGS_MAX   drawings on the page at most; past that the labels are listed and their lines keep the
                          marking views of the steps (no hole loses its place)
     drillPlan(graph, letterOf)   {holes, labels, setups, nothing, assembly, total, complete, labelOf(piece),
                          holesOfPiece(piece), covers(links), number(stepOfLink)}
       hole   {f, link, piece, kind, jig, screw, plugged, at (where the hole opens), out (the face it is on), dir,
               clear, passEnds, setup, step}
       label  {name ('A' or 'A1'), letter, way, members: [{piece, frame}], mirror (true for the second of a mirror
               pair: it shares its twin's drawing), twin, views, drawn, holesEach, signature}
     benchFrame(...)      how a person sees one face of a piece on the bench: the end with the label on one side,
                          the top edge up (frames below)
     placementWords(step, plan)   the "Put in" line of an assembly step
     drilledAlready(cover)        "The holes are drilled already: drawing C, holes ⬡1."
     drillColumn(row, plan)       the text of the Drill first column of the cut list

   A frame (how one piece is drilled and put in), in world terms:
     {n: [x, y, z] the face the label is on (out of the wood), up: [x, y, z] toward the top edge,
      along: [x, y, z] from the end with the label toward the other end, lengthAxis, upAxis,
      datumAt: the world coordinate of the end with the label (along lengthAxis), topAt: of the top edge}
   Seen square on with the top edge up, the end with the label is on the left of the paper when up x n points along
   `along` (a right-handed view: right x up = toward the eye); else it is on the right (the second face of a piece
   drilled on both faces, and the mirror image of a mirror pair). */
'use strict';

const DRILL_STAGE=1;
const DRILL_DRAWINGS_MAX=40;
const DRILL_SAME=1/32+1e-6;   // two holes are in the same place within this (inches)
/* One row per kind of hole (spec 11, section 2). test(f): is this fastener of this kind. */
const DRILL_KINDS=[
  {key:'pocket',when:'ahead',stage:1,test:f=>f.kind==='pocket'&&!!f.pocket},
  {key:'structural',when:'none',stage:1,test:f=>f.kind==='screw'&&!!f.structural},
  {key:'toe',when:'assembly',stage:1,test:f=>!!f.toe&&f.kind==='screw'},
  {key:'plug',when:'ahead',stage:2,test:f=>f.kind==='screw'&&!!f.plug},
  {key:'screw',when:'ahead',stage:2,test:f=>f.kind==='screw'},
  {key:'dowel',when:'ahead',stage:2,test:f=>f.kind==='dowel'},
  {key:'bracket',when:'assembly',stage:1,test:f=>f.kind==='bracket'},
  {key:'nail',when:'none',stage:1,test:f=>f.kind==='brad'||f.kind==='nail'},
];
const drillKindOf=f=>DRILL_KINDS.find(row=>row.test(f))||null;
const drilledAhead=row=>!!row&&row.when==='ahead'&&row.stage<=DRILL_STAGE;

/* ---------- small vector helpers (world vectors along one axis, as [x, y, z]) ---------- */
const axisVector=(axis,sign)=>{const v=[0,0,0];v[axis]=sign<0?-1:1;return v;};
// (crossOf, the cross product, is in js/hanging.js)
const dotOf=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const mainAxis=v=>[0,1,2].reduce((best,k)=>Math.abs(v[k])>Math.abs(v[best])?k:best,0);
const sameVector=(a,b)=>dotOf(a,b)>.99;

/* ---------- a piece in its own terms ----------
   Local coordinates: along its length (ax[0]), its width (ax[1]) and its thickness (ax[2]), from its low corner.
   Turning a piece end for end, over, or a square stick a quarter turn about its length are the symmetries of its
   box: a signed permutation of those three axes that keeps every size. det +1: a turn (a piece can be turned);
   det -1: a mirror image (it cannot: that is a different piece).
   The local frame must have the room's handedness, or a turn in the room reads as a mirror image (and a mirror
   image as a turn). ax can be any order of the three world axes: a board on edge along X has [0,1,2], the same
   board lying flat [0,2,1]. When that order is odd, the frame length x width x thickness is left-handed, so the
   thickness is counted from the high face instead (pointing the other way), which makes every local frame
   right-handed. */
const PERMS=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
const permParity=p=>(p[0]===0?(p[1]===1?1:-1):p[0]===1?(p[1]===0?-1:1):(p[1]===1?-1:1));
/* +1 when the piece's (length, width, thickness) frame is right-handed in the room, -1 when it is not */
const localHand=piece=>permParity(piece.ax);
function pieceDims(piece){return[piece.l,piece.w,piece.t];}
function toLocalPoint(piece,p){
  const b=plainBox(piece),flip=localHand(piece)<0;
  return piece.ax.map((axis,i)=>i===2&&flip?b.hi[axis]-p[axis]:p[axis]-b.lo[axis]);
}
function toLocalVector(piece,v){const flip=localHand(piece)<0;return piece.ax.map((axis,i)=>i===2&&flip?-v[axis]:v[axis]);}
function toWorldVector(piece,v){
  const w=[0,0,0],flip=localHand(piece)<0;
  piece.ax.forEach((axis,i)=>{w[axis]=i===2&&flip?-v[i]:v[i];});
  return w;
}
function boxSymmetries(dims){
  const list=[];
  for(const perm of PERMS){
    if(perm.some((from,i)=>Math.abs(dims[from]-dims[i])>DRILL_SAME))continue;
    for(let m=0;m<8;m++){
      const signs=[m&1?-1:1,m&2?-1:1,m&4?-1:1];
      list.push({perm,signs,det:permParity(perm)*signs[0]*signs[1]*signs[2]});
    }
  }
  // the plain identity first, then the other turns, then the mirror images
  return list.sort((a,b)=>(b.det-a.det)||(symmetryRank(a)-symmetryRank(b)));
}
const symmetryRank=sym=>sym.perm.filter((from,i)=>from!==i).length*10+sym.signs.filter(s=>s<0).length;
function mapPoint(sym,dims,p){return sym.perm.map((from,i)=>sym.signs[i]>0?p[from]:dims[from]-p[from]);}
function mapVector(sym,v){return sym.perm.map((from,i)=>sym.signs[i]*v[from]);}
/* the inverse of a symmetry: q[i] = s_i * p[perm[i]] (+ size), so p[perm[i]] = s_i * q[i] (+ size) */
function inverseSymmetry(sym){
  const perm=[0,0,0],signs=[1,1,1];
  sym.perm.forEach((from,i)=>{perm[from]=i;signs[from]=sym.signs[i];});
  return{perm,signs,det:sym.det};
}
/* the holes of a piece in its own terms: [{p, n, d, setup, hole}] */
function localPattern(piece,holes){
  return holes.map(hole=>({p:toLocalPoint(piece,hole.at),n:toLocalVector(piece,hole.out),d:toLocalVector(piece,hole.dir),setup:hole.setup,hole}));
}
/* Are these two lists of holes the same, one to one (within 1/32", the same face, the same slant, the same setting)? */
function samePattern(a,b){
  if(a.length!==b.length)return false;
  const used=new Array(b.length).fill(false);
  for(const one of a){
    const index=b.findIndex((other,i)=>!used[i]&&other.setup===one.setup&&sameVector(other.n,one.n)&&dotOf(other.d,one.d)>.98&&
      one.p.every((v,k)=>Math.abs(v-other.p[k])<=DRILL_SAME));
    if(index<0)return false;
    used[index]=true;
  }
  return true;
}
function transformPattern(sym,dims,pattern){
  return pattern.map(h=>({...h,p:mapPoint(sym,dims,h.p),n:mapVector(sym,h.n),d:mapVector(sym,h.d)}));
}
/* the symmetry of the box that carries pattern `from` onto pattern `onto`, of this det (+1 a turn, -1 a mirror) */
function symmetryBetween(dims,from,onto,det){
  return boxSymmetries(dims).find(sym=>sym.det===det&&samePattern(transformPattern(sym,dims,from),onto))||null;
}
/* the end for end mirror (along the length) of a pattern: the same holes measured from the other end */
const END_FOR_END={perm:[0,1,2],signs:[-1,1,1],det:-1};

/* ---------- the frame a piece is drilled in (spec 11, 4.1) ---------- */
/* world vector of the length of the paper for a face: the piece's length, unless the face is an end */
function lengthAxisFor(piece,normalAxis){
  if(piece.ax[0]!==normalAxis)return piece.ax[0];
  return piece.w>=piece.t?piece.ax[1]:piece.ax[2];
}
/* Where do this hole's screw and its jig point, on a face seen square on: 'end' when it comes out of an end of the
   piece (the jig is clamped against that end), 'edge' when out of an edge. */
function holeClampKind(hole,lengthAxis){
  const along=Math.abs(hole.dir[lengthAxis]);
  const across=Math.max(...[0,1,2].filter(k=>k!==lengthAxis&&Math.abs(hole.out[k])<.5).map(k=>Math.abs(hole.dir[k])));
  return along>=across?'end':'edge';
}
/* The frame of the sample piece of a way of drilling, by the rules of 4.1:
     - an upright piece: the end with the label is its bottom end;
     - else, when only one end has holes the jig is clamped against (end holes): that end;
     - else the top edge is the edge a row of holes is worked from (its screws come out of that edge);
     - else the end on the left as the marking views see that face in the design (markingFrame), so "left"
       agrees with every step.
   Whatever the rule fixes, the rest follows from seeing the face square on with the label on the left. */
function datumOf(piece,holes,faces){
  const n=faces[0],normalAxis=mainAxis(n);
  const lengthAxis=lengthAxisFor(piece,normalAxis);
  const upAxis=[0,1,2].find(k=>k!==lengthAxis&&k!==normalAxis);
  const b=plainBox(piece);
  // with the top edge this way, where is the end with the label (for it to be on the left of the paper)?
  const endLowFor=upSign=>dotOf(crossOf(axisVector(upAxis,upSign),n),axisVector(lengthAxis,1))>0;
  const upSignFor=endLow=>endLowFor(1)===endLow?1:-1;
  let endLow,upSign;
  const endHoles=holes.filter(hole=>holeClampKind(hole,lengthAxis)==='end');
  const edgeHoles=holes.filter(hole=>holeClampKind(hole,lengthAxis)==='edge');
  const middle=(b.lo[lengthAxis]+b.hi[lengthAxis])/2;
  const lowEnd=endHoles.filter(hole=>hole.at[lengthAxis]<middle).length,highEnd=endHoles.length-lowEnd;
  // (the edge a row is worked from comes before the end with the end holes: a rail with a post at one end only is
  //  drawn the way it stands, its top edge up, and not upside down for the sake of the end)
  if(lengthAxis===1){endLow=true;upSign=upSignFor(true);}
  else if(edgeHoles.length){
    const high=edgeHoles.filter(hole=>hole.dir[upAxis]>0).length;
    upSign=high>=edgeHoles.length-high?1:-1;
    endLow=endLowFor(upSign);
  }else if(upAxis===1){upSign=1;endLow=endLowFor(1);}   // a face that stands up: drawn as it stands
  else if(endHoles.length&&(!lowEnd||!highEnd)){endLow=lowEnd>0;upSign=upSignFor(endLow);}
  else{
    const seen=markingFrame(normalAxis,-Math.sign(n[normalAxis]),piece);
    if(seen.right.axis===lengthAxis){endLow=seen.right.sign>0;upSign=upSignFor(endLow);}
    else{upSign=1;endLow=endLowFor(1);}
  }
  return{n:n.slice(),up:axisVector(upAxis,upSign),along:axisVector(lengthAxis,endLow?1:-1),lengthAxis,upAxis,
    datumAt:endLow?b.lo[lengthAxis]:b.hi[lengthAxis],topAt:upSign>0?b.hi[upAxis]:b.lo[upAxis]};
}
/* the frame of another piece of the same way, carried over by the symmetry that maps the sample's holes onto it:
   sym carries this piece's local pattern onto the sample's, so its inverse carries the sample's frame onto this one */
function carriedFrame(sample,frame,piece,sym){
  const back=inverseSymmetry(sym),dims=pieceDims(sample);
  const local=v=>toWorldVector(piece,mapVector(back,toLocalVector(sample,v)));
  const n=local(frame.n),up=local(frame.up),along=local(frame.along);
  const lengthAxis=mainAxis(along),upAxis=mainAxis(up),b=plainBox(piece);
  void dims;
  return{n,up,along,lengthAxis,upAxis,
    datumAt:along[lengthAxis]>0?b.lo[lengthAxis]:b.hi[lengthAxis],topAt:up[upAxis]>0?b.hi[upAxis]:b.lo[upAxis]};
}
/* the frame of one face of a piece (the second face of a piece drilled on both): the same end and top edge */
function faceFrame(frame,n){return{...frame,n:n.slice()};}
/* is the end with the label on the left of the paper, for this frame? */
const datumOnLeft=frame=>dotOf(crossOf(frame.up,frame.n),frame.along)>0;
/* a world point in bench terms: how far from the end with the label, how far down from the top edge */
function benchPoint(frame,p){
  return{a:(p[frame.lengthAxis]-frame.datumAt)*Math.sign(frame.along[frame.lengthAxis]),
    b:(frame.topAt-p[frame.upAxis])*Math.sign(frame.up[frame.upAxis])};
}
/* how a face is seen on the bench, with the interface the marking views read (markingFrame, js/markingview.js):
   right and up on the paper, and the names of its ends and edges as the bench sees them */
function benchFrame(piece,frame){
  const left=datumOnLeft(frame),rightSign=Math.sign(frame.along[frame.lengthAxis])*(left?1:-1);
  const right={axis:frame.lengthAxis,sign:rightSign},up={axis:frame.upAxis,sign:Math.sign(frame.up[frame.upAxis])};
  const axis=mainAxis(frame.n),look=-Math.sign(frame.n[axis]);
  const signOf=k=>k===right.axis?right.sign:k===up.axis?up.sign:0;
  return{axis,look,right,up,from:'on the bench',seen:'seen square on, top edge up',mirrored:false,inside:false,signOf,beyond:'behind',
    toView:p=>[p[right.axis]*right.sign,p[up.axis]*up.sign],
    nameOf:(k,high)=>k===up.axis?((high===(up.sign>0))?'top':'bottom'):k===right.axis?((high===(right.sign>0))===left?'far':'labelled'):'face',
    screenSide:(k,high)=>k===right.axis?((high===(right.sign>0))?'right':'left'):k===up.axis?((high===(up.sign>0))?'top':'bottom'):null,
    screenLowIsHigh:k=>k===right.axis?right.sign<0:k===up.axis?up.sign<0:false,
    viewAxis:k=>k===right.axis?0:k===up.axis?1:-1,
    datumLeft:left,piece};
}

/* ---------- the plan ---------- */
function drillPlan(graph,letterOf){
  const plan={holes:[],labels:[],setups:[],nothing:[],other:[],total:0,complete:true,wallScrews:[],
    byPiece:new Map(),labelOfPiece:new Map(),memberOf:new Map(),
    putSaid:new Map()};   // piece id -> {say(frame), said}: the Put in words of each piece (placementWords), for the self-check
  // 1. every hole drilled ahead, from the layout the 3D view draws; the rest is kept for the At assembly line
  for(const link of graph.links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link)){
      const row=drillKindOf(f);
      if(!row)continue;
      if(!drilledAhead(row)){plan.other.push({f,link,row});continue;}
      const hole={f,link,piece:f.through,kind:row.key,jig:f.jig,screw:f.label,plugged:!!f.pocket.plugged,at:f.pocket.mouth,out:f.pocket.out,dir:f.dir,
        clear:f.clear||null,passEnds:f.passEnds||null,setup:null,step:0};
      plan.holes.push(hole);
      if(!plan.byPiece.has(hole.piece.id))plan.byPiece.set(hole.piece.id,[]);
      plan.byPiece.get(hole.piece.id).push(hole);
    }
  }
  plan.total=plan.holes.length;
  // the screws into the wall studs: placed hardware, or a line of the preset's own list
  for(const item of hardwareList())if(item.kind==='wallscrew'&&byId(item.on))plan.wallScrews.push({on:item.on,count:1});
  // (a preset that lists them as a plain line, with the pieces they go through in its `wall` list: the Bookshelf)
  for(const[label,count]of plainLinesLeft(S.hw||[],hardwareList())){
    if(!/wall studs?/i.test(label)||!(count>0))continue;
    const names=new Set(Object.values(S.sets||{}).flatMap(set=>Array.isArray(set&&set.wall)?set.wall:[]));
    const through=S.parts.filter(p=>names.has(p.name));
    if(through.length)for(const p of through)plan.wallScrews.push({on:p.id,count:count/through.length});
    else plan.wallScrews.push({on:null,count});
  }
  // 2. the jig settings, thickest first: the frame is built before the top goes on
  const settings=[...new Set(plan.holes.map(hole=>hole.jig))].sort((a,b)=>b-a);
  plan.setups=settings.map((jig,index)=>({no:index+1,jig,holes:plan.holes.filter(hole=>hole.jig===jig)}));
  for(const setup of plan.setups)for(const hole of setup.holes)hole.setup=setup.no;
  // 3. the labels: by cut-list letter, then by way of drilling
  const byLetter=new Map();
  for(const p of S.parts){
    if(isProp(p))continue;
    const letter=letterOf(p);
    if(!letter)continue;
    if(!byLetter.has(letter))byLetter.set(letter,[]);
    byLetter.get(letter).push(p);
  }
  const letters=[...byLetter.keys()].sort(letterOrder);
  for(const letter of letters){
    const pieces=byLetter.get(letter).slice().sort(pieceOrder);
    if(!pieces.some(p=>plan.byPiece.has(p.id))){
      plan.nothing.push({name:letter,letter,pieces,count:pieces.length,label:null});
      continue;
    }
    for(const label of labelPieces(letter,pieces,plan))plan.labels.push(label);
  }
  // pieces of a letter drilled more than one way that have nothing to drill go on the Nothing line under their number
  plan.labels=plan.labels.filter(label=>{
    if(label.way)return true;
    plan.nothing.push({name:label.name,letter:label.letter,pieces:label.members.map(m=>m.piece),count:label.members.length,label});
    return false;
  });
  plan.nothing.sort((a,b)=>letterOrder(a.letter,b.letter)||(a.name<b.name?-1:1));
  // 4. the drawings: at most DRILL_DRAWINGS_MAX; past that, the labels are listed and their lines keep the marking views
  const drawings=plan.labels.filter(label=>!label.mirror);
  drawings.forEach((label,index)=>{label.drawn=index<DRILL_DRAWINGS_MAX;});
  for(const label of plan.labels)if(label.mirror)label.drawn=label.twin.drawn;
  plan.complete=plan.labels.every(label=>label.drawn);
  for(const label of plan.labels){
    for(const member of label.members){plan.labelOfPiece.set(member.piece.id,label);plan.memberOf.set(member.piece.id,member);}
    label.views=label.drawn?labelViews(label,plan):[];
  }
  for(const entry of plan.nothing)for(const p of entry.pieces)plan.labelOfPiece.set(p.id,entry.label||{name:entry.name,letter:entry.letter,nothing:true});
  plan.labelOf=piece=>{const label=plan.labelOfPiece.get(piece.id);return label?label.name:letterOf(piece);};
  plan.holesOfPiece=piece=>plan.byPiece.get(piece.id)||[];
  /* covers(links): when every hole drilled ahead of these joints is on a drawing that is shown, the drawings and the
     settings that hold them ({labels: ['C'], tags: [1]}); else null */
  plan.covers=links=>{
    const labels=new Set(),tags=new Set();
    let any=false;
    for(const link of links){
      for(const f of fastenersOfLink(link)){
        if(!drilledAhead(drillKindOf(f)))return null;
        const label=plan.labelOfPiece.get(f.through.id);
        if(!label||!label.drawn||label.nothing)return null;
        labels.add(label.mirror?label.twin.name:label.name);
        const hole=plan.holes.find(candidate=>candidate.f===f);
        if(hole)tags.add(hole.setup);
        any=true;
      }
    }
    return any?{labels:[...labels].sort(labelNameOrder),tags:[...tags].sort((a,b)=>a-b)}:null;
  };
  // the step of each hole, once the steps are numbered (makeBuildPlan calls it)
  plan.number=stepOfLink=>{
    for(const hole of plan.holes)hole.step=stepOfLink.get(hole.link)||0;
    for(const entry of plan.other)entry.step=stepOfLink.get(entry.link)||0;
    plan.stepOfLink=stepOfLink;
  };
  return plan;
}
/* 'A' < 'B' < ... < 'Z' < 'AA' */
const letterOrder=(a,b)=>a.length-b.length||(a<b?-1:a>b?1:0);
const labelNameOrder=(a,b)=>{
  const[, la,na]=String(a).match(/^([A-Z]+)(\d*)$/)||[0,a,''],[, lb,nb]=String(b).match(/^([A-Z]+)(\d*)$/)||[0,b,''];
  return letterOrder(la,lb)||(+na||0)-(+nb||0);
};
/* back, left, bottom first (the order whichOne names them in) */
function pieceOrder(a,b){
  const ca=plainBox(a),cb=plainBox(b),mid=box=>box.lo.map((v,k)=>(v+box.hi[k])/2);
  const ma=mid(ca),mb=mid(cb);
  return(ma[2]-mb[2])||(ma[0]-mb[0])||(ma[1]-mb[1])||(a.id-b.id);
}
/* Spec 11, 3.1 and 3.3: the pieces of one letter sorted into ways of drilling. Pieces whose holes match under a
   turn of the box are drilled alike (one label); a mirror image is its own label and shares its twin's drawing;
   anything else gets a label of its own. Returns the labels of this letter, the way with the most pieces first. */
function labelPieces(letter,pieces,plan){
  const dims=pieceDims(pieces[0]);
  const ways=[];   // {pattern, sample, members:[{piece, sym}], mirrors:[{piece, sym}], first}
  const bare=[];
  pieces.forEach((piece,order)=>{
    const holes=plan.byPiece.get(piece.id)||[];
    if(!holes.length){bare.push(piece);return;}
    const pattern=localPattern(piece,holes);
    for(const way of ways){
      const turn=symmetryBetween(dims,pattern,way.pattern,1);
      if(turn){way.members.push({piece,sym:turn});return;}
    }
    for(const way of ways){
      const mirror=symmetryBetween(dims,pattern,way.pattern,-1);
      if(mirror){way.mirrors.push({piece,sym:mirror});return;}
    }
    ways.push({pattern,sample:piece,holes,members:[{piece,sym:boxSymmetries(dims)[0]}],mirrors:[],first:order});
  });
  // A1 is the way with more pieces (a mirror pair counts as one way and its mirror as the next)
  ways.sort((a,b)=>(b.members.length+b.mirrors.length)-(a.members.length+a.mirrors.length)||a.first-b.first);
  const single=ways.length===1&&!ways[0].mirrors.length&&!bare.length;
  const labels=[];
  let number=0;
  const nameOf=()=>single?letter:letter+(++number);
  for(const way of ways){
    const faces=facesOf(way.holes,way.sample);
    const frame=datumOf(way.sample,way.holes,faces);
    const label={name:nameOf(),letter,way,faces,frame,mirror:false,twin:null,members:[],holesEach:way.holes.length,
      symmetric:samePattern(transformPattern(END_FOR_END,dims,way.pattern),way.pattern)};
    label.members=way.members.map(member=>({piece:member.piece,sym:member.sym,frame:carriedFrame(way.sample,frame,member.piece,member.sym)}));
    labels.push(label);
    if(way.mirrors.length){
      const twin={name:nameOf(),letter,way,faces,frame,mirror:true,twin:label,members:[],holesEach:way.holes.length,symmetric:false};
      twin.members=way.mirrors.map(member=>({piece:member.piece,sym:member.sym,frame:carriedFrame(way.sample,frame,member.piece,member.sym)}));
      label.mirrorLabel=twin;
      labels.push(twin);
    }
  }
  if(bare.length)labels.push({name:nameOf(),letter,way:null,members:bare.map(piece=>({piece,frame:null})),holesEach:0});
  for(const label of labels)label.signature=label.way?drillSignature(label):'';
  return labels;
}
/* the faces of a piece that have holes, the face with the holes at the ends first (else the face with the most) */
function facesOf(holes,piece){
  const faces=[];
  for(const hole of holes)if(!faces.some(face=>sameVector(face,hole.out)))faces.push(hole.out.slice());
  const lengthAxis=piece.ax[0];
  const score=face=>{
    const on=holes.filter(hole=>sameVector(hole.out,face));
    return on.filter(hole=>holeClampKind(hole,lengthAxis)==='end').length*1000+on.length;
  };
  return faces.sort((a,b)=>score(b)-score(a));
}
/* a short text that changes when the holes of a label change (the Done boxes are kept under it) */
function drillSignature(label){
  const frame=label.frame,text=label.way.holes.map(hole=>{const at=benchPoint(frame,hole.at);return[r16(at.a),r16(at.b),hole.setup,mainAxis(hole.out)].join(',');}).sort().join(';');
  let hash=0;
  for(let i=0;i<text.length;i++)hash=(hash*31+text.charCodeAt(i))|0;
  return(hash>>>0).toString(36);
}

/* ---------- the views of one drawing (spec 11, 4.3) ----------
   One view per face with holes; a mirror pair: the face as drawn and its mirror image. Each view lists its holes in
   bench terms: a (from the end with the label), b (down from the top edge), how the jig goes, and its setting. */
function labelViews(label,plan){
  if(label.mirror)return label.twin.views;
  const sample=label.way.sample,views=[];
  label.faces.forEach((face,index)=>{
    const frame=faceFrame(label.frame,face);
    views.push(makeView(sample,frame,label.way.holes.filter(hole=>sameVector(hole.out,face)),index===0?'face1':'face2',false));
  });
  // a mirror pair on one face: the second view is the same picture end for end, measured from the other end
  if(label.mirrorLabel&&views.length===1)views.push(makeView(sample,label.frame,views[0].holes.map(entry=>entry.hole),'mirror',true));
  void plan;
  return views;
}
function makeView(piece,frame,holes,kind,mirrored){
  const L=piece[['l','w','t'][piece.ax.indexOf(frame.lengthAxis)]],H=piece[['l','w','t'][piece.ax.indexOf(frame.upAxis)]];
  // (the mirror image is the same picture end for end: every number from its own end with the label, which is on
  //  the other side of the paper)
  const left=datumOnLeft(frame)!==mirrored;
  const entries=holes.map(hole=>{
    const at=benchPoint(frame,hole.at),a=at.a;
    // the way the screw comes out: along (toward the far end +) and down (+)
    const dAlong=dotOf(hole.dir,frame.along),dDown=-dotOf(hole.dir,frame.up);
    const clamp=Math.abs(dAlong)>=Math.abs(dDown)?(dAlong<0?'labelled':'far'):(dDown<0?'top':'bottom');
    return{hole,a,b:at.b,dAlong,dDown,clamp,setup:hole.setup,plugged:hole.plugged};
  }).sort((x,y)=>x.setup-y.setup||x.a-y.a||x.b-y.b);
  return{kind,frame,mirrored,datumLeft:left,length:L,height:H,holes:entries,piece};
}

/* ---------- words ---------- */
const jigWords=jig=>fmt(jig);
/* the name of the design for a sentence: "this desk"; a design that is not one preset: "this design" */
function designWord(){
  // (S.sets: the placements, by number; only those that still have pieces count)
  const used=new Set(S.parts.map(p=>p.set).filter(set=>set!==undefined));
  const sets=[...used].map(set=>S.sets&&S.sets[set]).filter(Boolean),name=String(S.name||'').trim();
  if(S.parts.some(p=>p.set===undefined&&!isProp(p)))return'design';
  if(sets.length===1&&sets[0].name===name&&name.split(/\s+/).length<=3&&!/[\/(]/.test(name))return name.toLowerCase();
  return'design';
}
/* the setting of a hole, for the tables: 'Jig set for 1 1/2" stock' */
const settingWords=setup=>`Jig set for ${jigWords(setup.jig)} stock`;
/* The reference that replaces the "where" sentence of a pre-drilled line (spec 11, 1.4) */
function drilledAlready(cover){
  const drawings=cover.labels.length>1?`drawings ${listWords(cover.labels)}`:`drawing ${cover.labels[0]}`;
  const holes=cover.tags.map(tag=>'⬡'+tag);
  return`The holes are drilled already: ${drawings}, holes ${listWords(holes)}.`;
}
/* The "Fasten with" lines of a step whose holes are all on drawings that are shown: the line stays, its "where"
   sentence is kept on the line (whereKept, for the self-check) and replaced by the reference (spec 11, 1.4, 5.3) */
function markPredrilled(groups,drill){
  if(!drill||!drill.total)return;
  for(const group of groups){
    if(group.type!=='pocket')continue;
    const cover=drill.covers(group.links);
    if(!cover)continue;
    group.predrilled=cover;
    group.whereKept=group.where;
    group.where=drilledAlready(cover);
  }
}
/* The preset's own sentences that tell the person to drill pocket holes (step.drill: a string, a list, or per
   style {std, fine, rustic}, written by styledStep in js/style.js). They stay in the words of the step; while
   step 2 holds every pocket hole of the design they are taken out of what the step shows (spec 11, 5.2). */
function drillTextOf(step){
  const drill=step&&step.drill;
  if(!drill)return[];
  const mine=typeof drill==='string'||Array.isArray(drill)?drill:drill[look().style]||drill.std||[];
  return(Array.isArray(mine)?mine:[mine]).filter(Boolean);
}
/* The sentences of some words that tell the person to drill pocket holes ("Drill the pocket holes listed below in
   its underside", "(drill them before the rails go in)"); a sentence about holes already drilled ("from holes
   drilled in its back face") does not count. For the self-check and for designs saved before step 2. */
function drillOrders(text){
  // (the verb "drill" with the holes as its object: not "a drill with the long pocket-hole bit")
  return String(text).split(/(?<=[.:;])\s+|\(|\)/).filter(sentence=>
    /\bdrill (the|those|these|them|all|every|each)\b[^.]*\bholes\b|\bdrill (them|those holes)\b|\bdrill the pocket holes\b/i.test(sentence)&&
    !/\bpilot\b|\bcup\b|\bpulls?\b|\bdowel/i.test(sentence));
}
function withoutDrillWords(words,step,drill){
  if(!drill||!drill.total||!drill.complete)return words;
  let text=String(words);
  for(const sentence of drillTextOf(step))text=text.split(sentence).join('');
  return text.replace(/ {2,}/g,' ').replace(/ ([.,])/g,'$1').trim();
}
/* The Drill first column of the cut list (spec 11, 1.3): for one cut-list row */
function drillColumn(row,drill){
  if(!drill||!drill.total)return'';
  const labels=drill.labels.filter(label=>label.letter===row.id);
  if(!labels.length){
    // round holes of its shape are not pocket holes, and they are cut in their own step (Shapes to cut)
    const entry=drill.nothing.find(e=>e.letter===row.id&&!e.label);
    return entry&&entry.pieces.some(hasShapeHoles)?'no pocket holes; its round holes: see Shapes to cut':'nothing';
  }
  const holes=n=>`${n} pocket hole${n===1?'':'s'}`;
  // the pieces of this letter that have nothing to drill ('A2 (1)' on the Nothing line), said in every form
  const bare=drill.nothing.filter(entry=>entry.letter===row.id&&entry.label);
  const bareWords=bare.map(entry=>`; ${entry.count} as ${entry.name}: nothing`).join('');
  if(labels.length===1&&!bare.length){
    const label=labels[0],count=label.members.length;
    return`${holes(label.holesEach)}${count>1?' each':''} (step ${drill.stepNo})`;
  }
  const mirrorPair=labels.length===2&&labels[1].mirror&&labels[1].twin===labels[0];
  if(mirrorPair)return`${labels[0].members.length} as ${labels[0].name}, ${labels[1].members.length} as ${labels[1].name} (mirror images): ${holes(labels[0].holesEach)} each${bareWords} (step ${drill.stepNo})`;
  return labels.map(label=>`${label.members.length} as ${label.name}: ${holes(label.holesEach)}${label.members.length>1?' each':''}${label.mirror?' (mirror image of '+label.twin.name+')':''}`)
    .concat(bare.map(entry=>`${entry.count} as ${entry.name}: nothing`)).join('; ')+` (step ${drill.stepNo})`;
}

/* ---------- Put in (spec 11, 3.4) ----------
   For each labelled piece of an assembly step: which way its label faces, where its arrow points, and where the end
   with the label goes. Only what the holes fix is said; a piece the same from either end says so. */
function directionWord(v,forFace){
  const axis=mainAxis(v),high=v[axis]>0;
  if(axis===1)return high?'up':'down';
  if(axis===2)return forFace?(high?'the front':'the back'):(high?'to the front':'to the back');
  return forFace?(high?'the right':'the left'):(high?'to the right':'to the left');
}
function faceDirectionWords(piece,n){
  const axis=mainAxis(n),high=n[axis]>0;
  if(axis===1)return high?'facing up':'facing down';
  const b=plainBox(piece),middle=designMiddle();
  if(middle[axis]>b.lo[axis]-.5&&middle[axis]<b.hi[axis]+.5){
    return axis===0?`facing the ${high?'right':'left'} end of the ${designWord()}`:`facing ${high?'the front':'the back'}`;
  }
  const inward=high===(middle[axis]>(b.lo[axis]+b.hi[axis])/2);
  if(inward)return'facing in';
  return axis===2?`facing ${high?'the front':'the back'}`:'facing out';
}
/* the pieces fastened against one end of a piece (along the frame's length): those whose box meets that end face */
function piecesAtEnd(piece,frame,atLabel){
  const b=plainBox(piece),k=frame.lengthAxis,labelHigh=frame.along[k]<0,high=atLabel?labelHigh:!labelHigh;
  const face=high?b.hi[k]:b.lo[k],found=new Set();
  for(const link of connectionsOf(piece.id)){
    if(!link.fastened)continue;
    const other=link.a===piece?link.b:link.a;
    if(isProp(other))continue;
    const o=plainBox(other),touch=high?Math.abs(o.lo[k]-face)<.03:Math.abs(o.hi[k]-face)<.03;
    if(touch)found.add(other);
  }
  return[...found];
}
/* Where the end with the label goes. Named by the piece it is fastened against when only that end meets it (the
   other end meets nothing, or other pieces); else by its direction in the room ("at the bottom", "on the left",
   "at the back"), which holds whichever way the label faces. */
function endWords(piece,frame,letterOf){
  const atLabel=piecesAtEnd(piece,frame,true),atFar=piecesAtEnd(piece,frame,false);
  const farNames=new Set(atFar.map(p=>pieceLabel(p,letterOf)));
  const own=[...new Set(atLabel.map(p=>pieceLabel(p,letterOf)))].filter(name=>!farNames.has(name));
  if(own.length)return`the end with the label against the ${listWords(own)}`;
  return`the end with the label ${endWordsInRoom(frame)}`;
}
/* The words of one piece's Put in: which way its label faces, where its arrow points, where its end with the label
   goes. The self-check (putInPlacesEveryHole, js/partdrawings.js) puts the piece in every way these words allow
   and finds every hole where the model has it. */
function memberWords(label,member,letterOf){
  const frame=member.frame,piece=member.piece;
  const parts=[`with its label ${faceDirectionWords(piece,frame.n)}`,`its arrow ${directionWord(frame.up,false)}`];
  let tail='';
  if(label.symmetric)tail='Either end can go either way.';
  else parts.push(endWords(piece,frame,letterOf));
  return{text:listWords(parts),tail};
}
/* the short words of one piece in a long list of many pieces of one name (the uprights of a fish rack): its label
   and the way its label faces in the room; the arrows of a row and the end with the label are said once */
function listedPieceWords(label,frame){
  return`${label.name} facing ${directionWord(frame.n,true).replace(/^the /,'')}`;
}
/* The ways a labelled piece can be set in its place in the design: its own frame turned by every turn of its box
   (a board end for end, over, a square post a quarter turn). A person who reads the Put in words may set it in any
   of these whose words are the same as the words written; the self-check puts the holes in through each. */
function framesOfPlace(member){
  const piece=member.piece;
  return boxSymmetries(pieceDims(piece)).filter(sym=>sym.det>0).map(sym=>carriedFrame(piece,member.frame,piece,sym));
}
/* Do the holes of the drawing, put on the piece through this frame, land on the holes the model has in it (within
   1/32", the same face, the same setting, the jig against the same end or edge)? Returns the first hole that does
   not, in words, or ''. */
function holesMissedByFrame(label,piece,frame,drill){
  return entriesOfPiece(label,piece,frame,drill).missed;
}
/* The holes of one piece matched to the holes of its label's drawing, through a frame of that piece:
   {pairs: [{view, entry, hole}], missed: '' or the first hole that is not on the drawing, in words} */
function entriesOfPiece(label,piece,frame,drill){
  const pairs=[];
  // (a mirror image shares its twin's drawing: the same faces and numbers, measured from its own end with the label)
  const base=label.mirror?label.twin:label,views=base.views.filter(view=>view.kind!=='mirror');
  // each face of the drawing as a mix of the drawing's own along, up and out, then the same mix in this frame
  const mix=face=>[dotOf(face,base.frame.along),dotOf(face,base.frame.up),dotOf(face,base.frame.n)];
  const inFrame=c=>[0,1,2].map(k=>c[0]*frame.along[k]+c[1]*frame.up[k]+c[2]*frame.n[k]);
  const faces=base.faces.map(face=>inFrame(mix(face)));
  const used=views.map(view=>new Array(view.holes.length).fill(false));
  for(const hole of drill.byPiece.get(piece.id)||[]){
    const k=faces.findIndex(face=>sameVector(face,hole.out));
    if(k<0||!views[k])return{pairs,missed:`a hole on a face the drawing does not show (${piece.name})`};
    const at=benchPoint({...frame,n:faces[k]},hole.at);
    const dAlong=dotOf(hole.dir,frame.along),dDown=-dotOf(hole.dir,frame.up);
    const clamp=Math.abs(dAlong)>=Math.abs(dDown)?(dAlong<0?'labelled':'far'):(dDown<0?'top':'bottom');
    const index=views[k].holes.findIndex((entry,i)=>!used[k][i]&&entry.setup===hole.setup&&entry.clamp===clamp&&
      Math.abs(entry.a-at.a)<=DRILL_SAME&&Math.abs(entry.b-at.b)<=DRILL_SAME);
    if(index<0)return{pairs,missed:`the hole ${fmt(r16(at.a))} from the end with the label and ${fmt(r16(at.b))} down from the top edge of ${piece.name} (${label.name})`};
    used[k][index]=true;
    pairs.push({view:views[k],entry:views[k].holes[index],hole});
  }
  return{pairs,missed:''};
}
/* For each hole of a drawing (a view entry), the same hole in every piece the drawing makes (both of a mirror pair):
   Map entry -> [hole]. The Later column of the table reads it: the pieces of one label can go in at different
   steps and into different pieces (the bottom, the shelves and the top of a bookshelf). */
function holesOfEveryPiece(label,drill){
  const byEntry=new Map();
  const labels=[label].concat(label.mirrorLabel?[label.mirrorLabel]:[]);
  for(const one of labels)for(const member of one.members){
    for(const pair of entriesOfPiece(one,member.piece,member.frame,drill).pairs){
      if(!byEntry.has(pair.entry))byEntry.set(pair.entry,[]);
      byEntry.get(pair.entry).push(pair.hole);
    }
  }
  return byEntry;
}
function placementWords(step,plan){
  const drill=plan.drill;
  if(!drill||!drill.total)return'';
  // by name: the pieces of one name that go in the same way (one label, the same words) are one group; several
  // groups of one name are told apart by where they go
  const byName=new Map();
  for(const piece of step.pieces){
    const label=drill.labelOfPiece.get(piece.id),member=drill.memberOf.get(piece.id);
    if(!label||!label.way||!label.drawn||!member)continue;
    const said=memberWords(label,member,plan.letterOf);
    if(!byName.has(piece.name))byName.set(piece.name,[]);
    const groups=byName.get(piece.name);
    const group=groups.find(one=>one.label===label&&one.text===said.text);
    if(group)group.pieces.push(piece);else groups.push({label,text:said.text,tail:said.tail,pieces:[piece]});
  }
  if(!byName.size)return'';
  const sentences=[];
  // what was said of each piece, as a function of how it is set in (the self-check tries every way: drill.putSaid)
  const said=(piece,say)=>{if(drill.putSaid)drill.putSaid.set(piece.id,{say,said:say(drill.memberOf.get(piece.id).frame)});};
  for(const[name,groups]of byName){
    // many pieces of one name going in many ways (the uprights of a fish rack): which label goes where and which way
    // its label faces, row by row from the left; the arrows of a row and the end with the label said once
    if(groups.length>3){
      const all=groups.flatMap(group=>group.pieces);
      const labels=[...new Set(groups.map(group=>group.label))];
      const frameOf=p=>drill.memberOf.get(p.id).frame,labelOf=p=>drill.labelOfPiece.get(p.id);
      // rows front to back (pieces within 2" of each other, front to back, are one row), each from the left
      const middleZ=p=>{const b=plainBox(p);return(b.lo[2]+b.hi[2])/2;};
      const rows=[];
      for(const p of all.slice().sort((a,b)=>middleZ(a)-middleZ(b))){
        const row=rows.find(one=>Math.abs(middleZ(one[0])-middleZ(p))<2);
        if(row)row.push(p);else rows.push([p]);
      }
      const rowName=index=>rows.length===1?'':rows.length===2?(index?'in the front row':'in the back row'):`in row ${index+1} from the back`;
      const ends=new Set(all.map(p=>endWordsInRoom(frameOf(p))));
      const endSaid=ends.size===1?[...ends][0]:'';
      const which=rows.map((row,index)=>{
        row.sort((a,b)=>plainBox(a).lo[0]-plainBox(b).lo[0]);
        const arrows=new Set(row.map(p=>directionWord(frameOf(p).up,false)));
        const oneArrow=arrows.size===1?[...arrows][0]:'';
        const items=row.map(p=>listedPieceWords(labelOf(p),frameOf(p))+(oneArrow?'':`, arrow ${directionWord(frameOf(p).up,false)}`));
        for(const p of row)said(p,frame=>[listedPieceWords(labelOf(p),frame),directionWord(frame.up,false),endSaid?endWordsInRoom(frame):''].join('|'));
        const head=[rowName(index),oneArrow?`arrows ${oneArrow}`:''].filter(Boolean).join(', ');
        return`${head?head+', ':''}from the left: ${items.join(', ')}`;
      });
      sentences.push(`the ${pluralName(name)} (${listWords(labels.map(label=>label.name))}) in this order, ${which.join('; ')}. Each goes with its label facing the way the list says${endSaid?`, the end with the label ${endSaid}`:''}.`);
      continue;
    }
    const where=groups.length>1?placesApart(groups.map(group=>group.pieces)):null;
    groups.forEach((group,index)=>{
      const key=`(${group.label.name})`,many=group.pieces.length>1;
      // ("the higher Board", "the 2nd Board from the bottom", "each Board on the left")
      const place=where?where[index]:'',nth=place.match(/^(\S+) (from the bottom)$/);
      const named=/^(lower|higher)$/.test(place)?`${place} ${name}`:nth?`${nth[1]} ${name} ${nth[2]}`:`${name}${place?' '+place:''}`;
      const who=groups.length===1||where?`${many?'each':'the'} ${named} ${key}`
        :listWords(group.pieces.map(piece=>whichOne(piece,S.parts.filter(other=>other.name===name))))+` ${key}`;
      sentences.push(`${who} ${group.text}.`+(group.tail?' '+group.tail:''));
      for(const piece of group.pieces){
        const label=group.label;
        said(piece,frame=>{const words=memberWords(label,{piece,frame},plan.letterOf);return words.text+'|'+words.tail;});
      }
    });
  }
  return'Put in: '+sentences.map((sentence,index)=>index?capital(sentence):sentence).join(' ');
}
/* the end with the label by its direction in the room: 'at the bottom', 'on the left' ... */
function endWordsInRoom(frame){
  const toward=frame.along.map(v=>-v),axis=mainAxis(toward),high=toward[axis]>0;
  return axis===1?(high?'at the top':'at the bottom'):axis===0?(high?'on the right':'on the left'):(high?'at the front':'at the back');
}
/* Words that tell groups of pieces apart by where they are: ['on the left', 'on the right'], or null when no one
   direction parts them (each group wholly to one side of the next) */
function placesApart(groups){
  const middle=p=>{const b=plainBox(p);return b.lo.map((v,k)=>(v+b.hi[k])/2);};
  const words=[['on the left','on the right'],['lower','higher'],['at the back','at the front']];
  for(const axis of[0,2,1]){
    const spans=groups.map(list=>{const values=list.map(p=>middle(p)[axis]);return{lo:Math.min(...values),hi:Math.max(...values)};});
    const order=spans.map((span,index)=>index).sort((a,b)=>spans[a].lo-spans[b].lo);
    if(order.every((index,i)=>!i||spans[order[i-1]].hi<spans[index].lo-.5)){
      if(groups.length===2)return order[0]===0?words[axis]:[words[axis][1],words[axis][0]];
      if(axis===1){const rank=new Map(order.map((index,i)=>[index,i]));return groups.map((group,index)=>`${ordinal(rank.get(index)+1)} from the bottom`);}
    }
  }
  return null;
}

/* ---------- the lines at the end of step 2 ---------- */
/* "D Leg (4) and E Top (1)" in cut-list order, and the sentence after it */
/* a piece with round holes or cut-outs of its shape (js/shapes.js): those are cut in a step of their own, so the
   piece is never said to have "nothing to drill" */
const hasShapeHoles=p=>typeof shapeFeatures==='function'&&shapeFeatures(p).some(f=>f.kind==='hole');
function nothingWords(drill){
  const entries=drill.nothing.filter(entry=>!entry.pieces.some(hasShapeHoles));
  if(!entries.length)return null;
  const ids=new Set(entries.flatMap(entry=>entry.pieces.map(p=>p.id)));
  // what goes into those pieces: pocket screws only, or other fasteners too
  let other=false;
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened||(!ids.has(link.a.id)&&!ids.has(link.b.id)))continue;
    if(link.type!=='pocket'&&link.type!=='glue'){other=true;break;}
  }
  return{entries,why:other?'Their screws and nails go in when you put it together, and the steps say where.':'The pocket screws cut their own way into them.'};
}
/* how many pocket-hole screws of each size the shopping list buys, and the plugs */
function pocketScrewsListed(){
  // (the same list the shopping list is made from: renderCut, js/plans.js)
  const totals=hardwareTotals(findJoints());
  const screws=[],plugs=[];
  for(const[label,count]of totals.rows){
    if(/pocket-hole screws$/.test(label))screws.push([label,count]);
    if(/^Pocket-hole plugs$/.test(label))plugs.push([label,count]);
  }
  return{screws,plugs,totals};
}
/* the At assembly line (spec 11, 1.1, item 8): holes made in the step that drives them, with why */
function assemblyWords(drill,letterOf){
  const parts=[];
  const stepsOf=list=>{
    const steps=[...new Set(list.map(entry=>entry.step).filter(Boolean))].sort((a,b)=>a-b);
    if(!steps.length)return'';
    if(steps.length===1)return`step ${steps[0]}`;
    const run=steps.every((v,i)=>!i||v===steps[i-1]+1);
    return run&&steps.length>2?`steps ${steps[0]} to ${steps[steps.length-1]}`:`steps ${listWords(steps.map(String))}`;
  };
  const toe=drill.other.filter(entry=>entry.row.key==='toe');
  if(toe.length){
    const into=[...new Set(toe.map(entry=>pieceLabel(entry.f.into,letterOf)))];
    parts.push(`${toe.length} screw${toe.length>1?'s':''} driven at an angle into the ${listWords(into)}, ${stepsOf(toe)} (the angle is set against the piece in place)`);
  }
  const wall=Math.round(drill.wallScrews.reduce((sum,item)=>sum+item.count,0));
  if(wall)parts.push(`${wall} screw${wall>1?'s':''} for the wall studs, when it goes against the wall (the studs decide where)`);
  const asSteps=[];
  for(const[key,noun]of[['plug','wood screws with plugged heads'],['screw','wood screws'],['dowel','dowels'],['bracket','L-brackets']]){
    const list=drill.other.filter(entry=>entry.row.key===key);
    if(!list.length)continue;
    const through=[...new Set(list.map(entry=>pieceLabel(entry.f.through,letterOf)))];
    asSteps.push(`${list.length} ${noun}${key==='bracket'?'':' through the '+(through.length>3?'pieces their steps name':listWords(through))}`);
  }
  const lines=[];
  if(parts.length)lines.push(`Drilled when you put it together, in the step that drives them: ${parts.join('; ')}.`);
  if(asSteps.length)lines.push(`${capital(listWords(asSteps))}: their holes are drilled in the step that drives them${drill.other.some(entry=>entry.row.key==='bracket')?' (a bracket is its own guide)':''}.`);
  return lines;
}
/* the tools of step 2 (spec 11, 1.1 item 2) */
function drillTools(drill){
  const stock=[...new Set(drill.holes.map(hole=>M[hole.piece.mat].short))];
  return['pocket-hole jig with its stepped bit and stop collar','drill','clamp','tape measure, square and pencil',
    `a scrap of ${listWords(stock)} for a test hole`];
}
/* the names of the pieces of a label ('Toe kick, Base rail'), as the cut list gives a row of several names */
const labelNames=label=>[...new Set(label.members.map(member=>member.piece.name))].join(', ');
/* what "You need" lists for step 2: the pieces that get holes, by label */
function drillNeeds(drill){
  const pieces=[];
  for(const label of drill.labels){
    if(!label.drawn)continue;
    const p=label.members[0].piece;
    pieces.push({qty:label.members.length,letter:label.name,name:labelNames(label),length:fmt(p.l)});
  }
  return{pieces,fasteners:[],hardware:[],tools:drillTools(drill)};
}
const DRILL_WORDS='Drill your pieces. Drill every hole on the drawings below now, while each piece lies flat on the bench: once the pieces are put together the pocket-hole jig no longer fits. After this step you only put the pieces together and drive the screws.';
