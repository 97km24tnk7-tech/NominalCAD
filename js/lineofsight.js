/* NominalCAD: line of sight. What a person in the room really sees of a piece of furniture.

   The owner, 20 Nov, on a Bookshelf seen from a little below: "a human would look up and see all these holes i would
   prefer them hidden". So a hole or a screw head is judged from where people's eyes are, not from which way its face
   points: a person STANDING (eye 60" to 69") or SEATED (eye 40" to 44"), EYES.away (6 ft) in front of
   the piece, anywhere from EYES.past (2 ft) beyond its left end to as far beyond its right end. A point is in sight
   when a straight line from it reaches one of those eyes without passing through wood, and leaves the face the point
   is on at more than EYES.leastSlope (about 2 degrees: a 3/8" hole seen flatter than that is a line, not a hole).
   Reference sheet 01, section 9.5.

     sightBoxes(parts)            what blocks a line of sight: square-set wood, and bought things that are not glass
     pocketFaceInSight(piece, out)   is the face a pocket hole of a placed piece opens on in sight anywhere?
     sightEyes(boxes)             the eye points in front of those boxes
     eyeThatSees(at, out, ...)    the first eye that sees a point on a face looking `out`, or null
     faceInSight(piece, axis, side, parts, region)
                                  is any part of one face of a piece in sight (sampled across the face)?
     headsInSight(parts)          the open pocket holes and uncovered heads of the design that a person sees
   Pure geometry: no style, no preset. The cabinet builder decides its pocket-hole faces and plugs with it
   (js/caselooks.js); its self-checks hold every house preset to it. */
'use strict';

/* The eyes are two BANDS, not two points (the real-thing review of the case looks job, findings 1 and 4): 60" is the
   standing eye of a median grown woman, but a median man's is about 65" and a tall man's about 69" (ANSUR II summary
   tables, sheet 01 §9.7), so the top face of a shelf at 61" to 68" is in plain sight, looking down, for half the
   grown-ups in the room; and a person on a low sofa or a child sits with the eye nearer 40" than 44", which sees up
   under a shelf just above 44". Each band is looked at from both of its ends: looking down onto a face the highest
   eye sees the most, looking up under one the lowest. */
const EYES={
  standing:60,        // the owner's number for a grown-up standing (a median woman)
  tall:69,            // a tall grown man standing (95th percentile)
  seated:44,          // the owner's number for a grown-up seated
  low:40,             // a person on a low sofa, or a child, seated
  away:72,            // 6 ft in front of the front of the piece
  past:24,            // the eye may stand this far beyond either end of the piece
  every:6,            // eye points this far apart along the front
  leastSlope:Math.sin(2*Math.PI/180),   // a line flatter than about 2 degrees to the face does not show the hole
  sample:3,           // a face is looked at every 3" across it
};

/* What can stand between a point and an eye: the square-set wood, and the bought things that are not see-through
   (a mattress over the slats of a bed, a monitor), as showingHeads (js/showfaces.js) counts them. A glass tank is
   seen through. */
const SIGHT_SEE_THROUGH=['tank','glass'];
function sightBoxes(parts){
  return parts.filter(piece=>!tilted(piece)&&!SIGHT_SEE_THROUGH.includes(piece.mat)).map(plainBox);
}
/* the heights the eyes are looked from: the owner's two first (most lines are settled by them), then the far ends of
   the two bands */
const EYE_HEIGHTS=[EYES.standing,EYES.seated,EYES.tall,EYES.low];
/* the eye points: the four heights, every EYES.every inches from EYES.past beyond one end of the boxes to as far
   beyond the other, all EYES.away in front of the front of the boxes (z grows toward the front). Only in front: right
   for a case against a wall; a piece that stands out in a room (a table, a bench, a chair) is seen from its back and
   ends too, which these eyes do not look from. */
function sightEyes(boxes){
  if(!boxes.length)return[];
  const left=Math.min(...boxes.map(b=>b.lo[0]))-EYES.past,right=Math.max(...boxes.map(b=>b.hi[0]))+EYES.past;
  const front=Math.max(...boxes.map(b=>b.hi[2]))+EYES.away;
  const eyes=[];
  for(const y of EYE_HEIGHTS){
    for(let x=left;x<=right+1e-6;x+=EYES.every)eyes.push([x,y,front]);
    if((right-left)%EYES.every>1e-6)eyes.push([right,y,front]);
  }
  return eyes;
}
/* Does the straight piece of line from `from` to `to` pass through box b? (the slab test, on a segment) */
function segmentHitsBox(from,to,b){
  let near=0,far=1;
  for(let k=0;k<3;k++){
    const way=to[k]-from[k];
    if(Math.abs(way)<1e-9){
      if(from[k]<b.lo[k]||from[k]>b.hi[k])return false;
      continue;
    }
    let t1=(b.lo[k]-from[k])/way,t2=(b.hi[k]-from[k])/way;
    if(t1>t2)[t1,t2]=[t2,t1];
    near=Math.max(near,t1);
    far=Math.min(far,t2);
    if(near>far)return false;
  }
  return far>0&&near<1;
}
/* The first eye that sees the point `at` on a face looking `out`, or null. The line starts just off the face, so
   the piece the point is on does not count. */
function eyeThatSees(at,out,boxes,eyes){
  const length=Math.hypot(...out)||1,way=out.map(v=>v/length);
  const from=pointPlus(at,way,.06);
  for(const eye of eyes){
    const sight=[0,1,2].map(k=>eye[k]-at[k]),distance=Math.hypot(...sight);
    const slope=(sight[0]*way[0]+sight[1]*way[1]+sight[2]*way[2])/distance;
    if(slope<EYES.leastSlope)continue;                      // behind the face, or too flat to show a hole
    if(!boxes.some(b=>segmentHitsBox(from,eye,b)))return eye;
  }
  return null;
}
/* Is any part of one face of a piece in sight? axis: the axis the face looks along (0, 1 or 2); side: -1 the low
   face, +1 the high face. The face is looked at every EYES.sample inches across it, not at its edges (a hole is
   never drilled right at an edge). region (optional): {axis: [from, to]} narrows the part of the face looked at (the
   top end of a divider). parts: the pieces around it (the piece's own design, or the pieces a preset is about to
   place). Answers are remembered for the same pieces in the same places. */
const faceSightMemo=new Map();
function faceInSight(piece,axis,side,parts,region){
  const boxes=sightBoxes(parts);
  const key=[piece.id,piece.name,axis,side,JSON.stringify(region||null),JSON.stringify(plainBox(piece)),
    boxes.map(b=>b.lo.concat(b.hi).map(v=>v.toFixed(3)).join(',')).join(';')].join('|');
  if(faceSightMemo.has(key))return faceSightMemo.get(key);
  if(faceSightMemo.size>4000)faceSightMemo.clear();
  const b=plainBox(piece),eyes=sightEyes(boxes),out=[0,0,0];
  out[axis]=side;
  const across=[0,1,2].filter(k=>k!==axis);
  // the points looked at along each of the two directions across the face, a little in from its edges
  const spots=k=>{
    let lo=b.lo[k],hi=b.hi[k];
    if(region&&region[k]){lo=Math.max(lo,region[k][0]);hi=Math.min(hi,region[k][1]);}
    const length=hi-lo,count=Math.max(1,Math.min(24,Math.ceil(length/EYES.sample)));
    return Array.from({length:count},(_,i)=>lo+length*(i+.5)/count);
  };
  let seen=false;
  for(const u of spots(across[0])){
    for(const v of spots(across[1])){
      const at=[0,0,0];
      at[axis]=side>0?b.hi[axis]:b.lo[axis];
      at[across[0]]=u;
      at[across[1]]=v;
      if(eyeThatSees(at,out,boxes,eyes)){seen=true;break;}
    }
    if(seen)break;
  }
  faceSightMemo.set(key,seen);
  return seen;
}
/* Is the face a pocket hole of this placed piece opens on (out: the way the face looks) in sight anywhere, with the
   pieces of its own placement around it? For a preset's pluggedPockets (js/fasteners.js asks): the holes are then
   filled with glued pocket-hole plugs, bought and counted on the shopping list. */
function pocketFaceInSight(piece,out,parts=S.parts.filter(other=>other.set===piece.set)){
  const axis=[0,1,2].reduce((best,k)=>Math.abs(out[k])>Math.abs(out[best])?k:best,0);
  return faceInSight(piece,axis,out[axis]>0?1:-1,parts);
}
/* The open pocket holes and the uncovered screw, nail and bracket heads of the design (fastenerHeads,
   js/showfaces.js) that a person standing or seated in front sees. parts: the pieces that block the view (the
   design). Each: {f, at, out, eye, face}. */
function headsInSight(parts=S.parts){
  const boxes=sightBoxes(parts),eyes=sightEyes(boxes);
  const inSight=[];
  for(const head of fastenerHeads()){
    if(head.covered)continue;
    const eye=eyeThatSees(head.at,head.out,boxes,eyes);
    if(eye)inSight.push({...head,eye,face:faceOfHead(head.out)});
  }
  return inSight;
}
/* one line for a list of heads in sight: "2 open pocket holes (Top into Side) seen from the seated eye" */
function headsInSightWords(heads){
  const groups=new Map();
  for(const head of heads){
    const what=head.f.kind==='pocket'?'open pocket hole':head.f.kind==='brad'?'nail head':'screw head';
    const from=head.eye[1]>=EYES.standing?'standing':'seated';
    const key=`${what}|${head.f.through.name} into ${head.f.into.name}|${from}`;
    groups.set(key,(groups.get(key)||0)+1);
  }
  return[...groups].map(([key,count])=>{
    const[what,pair,from]=key.split('|');
    return`${count} ${what}${count===1?'':'s'} (${pair}) seen from the ${from} eye`;
  }).join('; ');
}
