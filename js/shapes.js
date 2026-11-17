/* NominalCAD: shaped pieces. A piece that is not a plain rectangular board (design\specs\03, stage 1).

   A piece stays what it always was: a rectangular BLANK (l, w, t, ax, pos, rot or q), the stock the cut list tells
   a person to cut first. A shaped piece adds ONE optional field, p.shape:

     p.shape = {
       v: 1,                                  format version
       ends:    [End|null, End|null],         end 0 (u = 0) and end 1 (u = l); null = cut square
       corners: [C|null x 4],                 [end 0 edge 0, end 0 edge 1, end 1 edge 0, end 1 edge 1]
       feats:   [Feature, ...]                holes, cut-outs, slots, notches in an edge, in the order added
     }
     End     {cut:'saw', miter, long, bevel, bevelLong}   miter (across the face) 0..60, bevel (through the
                                                          thickness) 0..45; long: the edge that keeps the full
                                                          length; bevelLong: the face that does
           | {cut:'round', r}                             r = w/2 is a half circle
           | {cut:'point', deg, across:'w'|'t'}           two cuts meeting in a tip (w) or a ridge (t)
     C       {cut:'clip', a, b} | {cut:'round', r} | {cut:'notch', a, b}    a along the length, b across it
     Feature {kind:'hole', at, d, use:'plain'|'cup'|'wire'}
           | {kind:'cutout', at, a, b, r}                 a rectangle a x b with round corners r
           | {kind:'slot', at, d, len, dir:'u'|'v'}       d wide, len end to end
           | {kind:'notch', edge:0|1, at:{u}, len, depth}
     at = {u:{from:0|1|'mid', d}, v:{from:0|1|'mid', d}}  the distance to the feature's CENTER, measured the way a
                                                          woodworker marks it; d is signed only for 'mid'

   The piece's own frame: u along the length (0 at end 0, world axis ax[0]), v across the width (0 at edge 0,
   ax[1]), s through the thickness (0 at face 0, ax[2]). Every feature is stored by what it is measured from, so
   stretching a piece keeps a hole where it was marked. This file is the one place that turns a shape into an
   outline, a volume and a list of corners; the 3D solid is js/shapeview.js, the rules js/shapecheck.js, the
   Properties section js/shapeprops.js, the drawings and cut list words js/shapedrawings.js.

   A piece without p.shape runs exactly the code it always did: presetsKeepTheirCutLists (the end of this file)
   holds every preset to the fingerprint recorded before any of this existed. */
'use strict';

/* ---------- numbers ---------- */
const SHAPE_RULE={
  // S1: wood left between an opening and an edge, an end, a cut or another opening. Both are rules the program
  // already has: rule 6 of js/fasteners.js (FASTEN.dowelCover, 1/4") and rule 3 (FASTEN.edgeMin, 3/8").
  least:.25,      // under this: stop
  safer:.375,     // under this: warning; also how far a fastener keeps off an opening (3a)
  shortSide:.25,  // S4: the least short side left between the cuts of two ends (the same program rule as least)
  // S6, tool facts from design\reference\21-shaping-tools.md: every miter saw checked there miters to at least 50°
  // both ways (section 2a, "checked" on DWS713, DWS716, DWS779, DWS780; Bosch 52° left), and bevels to "45° safe
  // for any saw" (section 4). Spec 03 had 45° for both; the sheet is followed (see the report).
  sawMiter:50,
  sawBevel:45,
  features:40,    // S10: lines in one piece's list (a program limit that keeps the 3D view and the drawings quick)
  openings:1000,  // S10: openings in one piece
  contact:.25,    // a contact smaller than this (square inches) is not a joint
  segment:.25,    // a curve is drawn as straight pieces about this long, 8 to 48 per arc
};
const SHAPE_HOLE_SIZES=[.125,.375,.5,1,3,4,6];   // the sizes the reference sheets name (the Diameter pulldown)
const SHAPE_PI=Math.PI,degToRad=deg=>deg*SHAPE_PI/180;
const round64=x=>Math.round(x*64)/64;
const roundDeg=deg=>Math.round(deg*2)/2;          // angles are shown to the nearest half degree (sheet 21, section 4)
const degText=deg=>`${roundDeg(deg)}°`;

/* ---------- reading a shape ---------- */
const hasShape=p=>!!(p&&p.shape);
const shapeEnd=(p,i)=>p.shape&&p.shape.ends?p.shape.ends[i]:null;
const shapeCorner=(p,i)=>p.shape&&p.shape.corners?p.shape.corners[i]:null;
const shapeFeatures=p=>p.shape&&p.shape.feats?p.shape.feats:[];
const isSquareEnd=end=>!end;

/* the center of a feature in the piece's frame. at.u.from: 0 = from end 0, 1 = from end 1, 'mid' = from the
   middle (d signed, toward end 1 when above 0); the same across the width with the edges */
function featureCenter(p,f){
  const along=(spec,size)=>{
    if(!spec)return size/2;
    if(spec.from===0)return spec.d;
    if(spec.from===1)return size-spec.d;
    return size/2+(spec.d||0);
  };
  const u=along(f.at&&f.at.u,p.l);
  const v=f.kind==='notch'?(f.edge===1?p.w-f.depth/2:f.depth/2):along(f.at&&f.at.v,p.w);
  return{u,v};
}

/* how far each end's cut reaches into the length: on edge 0, on edge 1, and through the thickness (on the face
   that is cut short). An angled end keeps its long point at the blank's end (invariant 2). */
function endSetback(p,i){
  const end=shapeEnd(p,i),w=p.w,t=p.t,none={edge:[0,0],face:[0,0],most:0};
  if(!end)return none;
  if(end.cut==='saw'){
    const face=w*Math.tan(degToRad(end.miter||0));                                    // along the short edge
    const thick=t*Math.tan(degToRad(end.bevel||0))/Math.cos(degToRad(end.miter||0));   // along the edge, on the short face
    const edge=end.long===1?[face,0]:[0,face];
    const faces=end.bevelLong===1?[thick,0]:[0,thick];
    return{edge:[edge[0]+thick,edge[1]+thick],face:faces,most:face+thick,miterSet:face,bevelSet:thick};
  }
  if(end.cut==='round'){
    const r=Math.min(end.r,w/2);
    return{edge:[r,r],face:[0,0],most:r};
  }
  if(end.cut==='point'){
    const reach=end.across==='t'?(t/2)*Math.tan(degToRad(end.deg)):(w/2)*Math.tan(degToRad(end.deg));
    return end.across==='t'?{edge:[reach,reach],face:[reach,reach],most:reach}:{edge:[reach,reach],face:[0,0],most:reach};
  }
  return none;
}
/* the length left on each edge between the two end cuts (the "Short side" a person measures with a tape) */
function shortSides(p){
  const a=endSetback(p,0),b=endSetback(p,1);
  return{edge:[p.l-a.edge[0]-b.edge[0],p.l-a.edge[1]-b.edge[1]],least:p.l-a.most-b.most};
}
/* true when the two end cuts would cross: the piece is then drawn with square ends until it is fixed (invariant 3) */
const endsCross=p=>hasShape(p)&&shortSides(p).least<=1e-6;

/* ---------- the outline ----------
   The face outline as one loop of points {u, v, tag, end}, counterclockwise in (u, v): up the end-1 side, back
   along edge 1, down the end-0 side, along edge 0. tag 'cut' marks a point on a saw end and 'ridge' a point of
   a point cut across the thickness: those move along u with the depth s (outlineAt). Openings are loops of
   [u, v] points. */
function arcPoints(cu,cv,r,from,to,tag){
  const sweep=Math.abs(to-from),n=Math.max(8,Math.min(48,Math.ceil(r*sweep/SHAPE_RULE.segment)));
  const out=[];
  for(let i=0;i<=n;i++){
    const a=from+(to-from)*i/n;
    out.push({u:cu+r*Math.cos(a),v:cv+r*Math.sin(a),tag:tag||'arc'});
  }
  return out;
}
/* the end-1 side of the outline (u near l), from edge 0 up to edge 1. cornerA sits at (l, 0), cornerB at (l, w).
   End 0 is drawn by the same function on the piece mirrored end for end (see shapeOutline). */
function endSidePoints(end,cornerA,cornerB,l,w){
  if(end&&end.cut==='saw'){
    const back=w*Math.tan(degToRad(end.miter||0));
    return end.long===1?[{u:l-back,v:0,tag:'cut'},{u:l,v:w,tag:'cut'}]:[{u:l,v:0,tag:'cut'},{u:l-back,v:w,tag:'cut'}];
  }
  if(end&&end.cut==='round'){
    const r=Math.min(end.r,w/2);
    if(r>=w/2-1e-9)return arcPoints(l-w/2,w/2,w/2,-SHAPE_PI/2,SHAPE_PI/2);
    return arcPoints(l-r,r,r,-SHAPE_PI/2,0).concat(arcPoints(l-r,w-r,r,0,SHAPE_PI/2));
  }
  if(end&&end.cut==='point'){
    if(end.across==='t')return[{u:l,v:0,tag:'ridge'},{u:l,v:w,tag:'ridge'}];
    const back=(w/2)*Math.tan(degToRad(end.deg));
    return[{u:l-back,v:0,tag:''},{u:l,v:w/2,tag:''},{u:l-back,v:w,tag:''}];
  }
  // a square end: its two corners
  const out=[];
  if(!cornerA)out.push({u:l,v:0,tag:''});
  else if(cornerA.cut==='clip')out.push({u:l-cornerA.a,v:0,tag:''},{u:l,v:cornerA.b,tag:''});
  else if(cornerA.cut==='notch')out.push({u:l-cornerA.a,v:0,tag:''},{u:l-cornerA.a,v:cornerA.b,tag:''},{u:l,v:cornerA.b,tag:''});
  else if(cornerA.cut==='round')out.push(...arcPoints(l-cornerA.r,cornerA.r,cornerA.r,-SHAPE_PI/2,0));
  if(!cornerB)out.push({u:l,v:w,tag:''});
  else if(cornerB.cut==='clip')out.push({u:l,v:w-cornerB.b,tag:''},{u:l-cornerB.a,v:w,tag:''});
  else if(cornerB.cut==='notch')out.push({u:l,v:w-cornerB.b,tag:''},{u:l-cornerB.a,v:w-cornerB.b,tag:''},{u:l-cornerB.a,v:w,tag:''});
  else if(cornerB.cut==='round')out.push(...arcPoints(l-cornerB.r,w-cornerB.r,cornerB.r,0,SHAPE_PI/2));
  return out;
}
/* the polygon of an opening (a hole, a cut-out, a slot), counterclockwise, or null for a notch (it is part of the outline) */
function openingPoints(p,f){
  const c=featureCenter(p,f);
  if(f.kind==='hole')return arcPoints(c.u,c.v,f.d/2,0,2*SHAPE_PI).slice(0,-1).map(q=>[q.u,q.v]);
  if(f.kind==='slot'){
    const half=Math.max(0,f.len-f.d)/2,r=f.d/2,alongU=f.dir!=='v';
    const ends=[[c.u+(alongU?half:0),c.v+(alongU?0:half)],[c.u-(alongU?half:0),c.v-(alongU?0:half)]];
    const start=alongU?-SHAPE_PI/2:0;
    const one=arcPoints(ends[0][0],ends[0][1],r,start,start+SHAPE_PI).map(q=>[q.u,q.v]);
    const two=arcPoints(ends[1][0],ends[1][1],r,start+SHAPE_PI,start+2*SHAPE_PI).map(q=>[q.u,q.v]);
    return one.concat(two);
  }
  if(f.kind==='cutout'){
    const a=f.a/2,b=f.b/2,r=Math.min(f.r||0,a,b),out=[];
    if(r<=1e-6)return[[c.u-a,c.v-b],[c.u+a,c.v-b],[c.u+a,c.v+b],[c.u-a,c.v+b]];
    // four quarter circles, counterclockwise from the corner at the high end of the length and edge 0
    const corner=(cu,cv,from)=>out.push(...arcPoints(cu,cv,r,from,from+SHAPE_PI/2).map(q=>[q.u,q.v]));
    corner(c.u+a-r,c.v-b+r,-SHAPE_PI/2);
    corner(c.u+a-r,c.v+b-r,0);
    corner(c.u-a+r,c.v+b-r,SHAPE_PI/2);
    corner(c.u-a+r,c.v-b+r,SHAPE_PI);
    return out;
  }
  return null;
}
/* the outline of a shaped piece: {outer, openings, bad}. bad lists the features that do not fit (drawn red, not cut).
   Remembered by shape and size: the joints, the clash check and the rules ask for it many times. Treat it as read only. */
const outlineMemo=new Map();
function shapeOutline(p){
  const memo=JSON.stringify(p.shape)+'|'+p.l+'|'+p.w+'|'+p.t;
  let outline=outlineMemo.get(memo);
  if(!outline){
    outline=outlineOf(p);
    if(outlineMemo.size>2000)outlineMemo.clear();
    outlineMemo.set(memo,outline);
  }
  return outline;
}
function outlineOf(p){
  const l=p.l,w=p.w,crossed=endsCross(p);
  const ends=crossed?[null,null]:[shapeEnd(p,0),shapeEnd(p,1)];
  const corner=i=>{
    const end=ends[i<2?0:1];
    return end?null:shapeCorner(p,i);   // a corner can only be cut on a square end (rule S5)
  };
  // end 1, then end 0 worked out as end 1 of the piece turned end for end, mirrored back and read the other way
  const side1=endSidePoints(ends[1],corner(2),corner(3),l,w).map(q=>({...q,end:1}));
  const side0=endSidePoints(ends[0],corner(0),corner(1),l,w).map(q=>({...q,u:l-q.u,end:0})).reverse();
  const notches=shapeFeatures(p).filter(f=>f.kind==='notch'&&notchFits(p,f));
  const along0=[],along1=[];
  for(const f of notches.slice().sort((a,b)=>featureCenter(p,a).u-featureCenter(p,b).u)){
    const c=featureCenter(p,f).u,h=f.len/2;
    if(f.edge===1)along1.unshift({u:c+h,v:w,tag:''},{u:c+h,v:w-f.depth,tag:''},{u:c-h,v:w-f.depth,tag:''},{u:c-h,v:w,tag:''});
    else along0.push({u:c-h,v:0,tag:''},{u:c-h,v:f.depth,tag:''},{u:c+h,v:f.depth,tag:''},{u:c+h,v:0,tag:''});
  }
  const loop=side1.concat(along1,side0,along0);
  // no two points in the same place one after the other (a quarter circle that ends where an edge starts)
  const outer=[];
  for(const q of loop){
    const last=outer[outer.length-1];
    if(last&&Math.abs(last.u-q.u)<1e-7&&Math.abs(last.v-q.v)<1e-7){if(q.tag&&!last.tag)last.tag=q.tag;continue;}
    outer.push(q);
  }
  if(outer.length>2){
    const first=outer[0],last=outer[outer.length-1];
    if(Math.abs(last.u-first.u)<1e-7&&Math.abs(last.v-first.v)<1e-7)outer.pop();
  }
  // An opening that runs off the piece, or into another opening, is kept but not cut (drawn red, a STOP:
  // invariant 3). Two that run into each other are BOTH left uncut, whichever was added first, so the solid, the
  // weight and the findings never depend on the order of the list (the caches are keyed by the sorted shape).
  // overlaps: [[a feature, the one it runs into]], each pair once.
  // The outline is remembered by the TEXT of the shape and shared by every piece with the same text, so it holds
  // features by their place in the list (bad, overlaps), never the feature objects of one piece: misfits(p) gives
  // the piece's own.
  const bad=[],overlaps=[],fitting=[];
  shapeFeatures(p).forEach((f,index)=>{
    if(f.kind==='notch'){if(!notchFits(p,f))bad.push(index);return;}
    const ring=openingPoints(p,f);
    if(!ring)return;
    if(!openingFits(p,f,outer)){bad.push(index);return;}
    fitting.push({index,ring,clash:false});
  });
  for(let i=0;i<fitting.length;i++)for(let k=i+1;k<fitting.length;k++){
    if(!ringsOverlap(fitting[i].ring,fitting[k].ring))continue;
    overlaps.push([fitting[k].index,fitting[i].index]);
    fitting[i].clash=fitting[k].clash=true;
  }
  for(const one of fitting)if(one.clash)bad.push(one.index);
  bad.sort((a,b)=>a-b);
  const openings=fitting.filter(one=>!one.clash).map(one=>one.ring);
  return{outer,openings,bad,overlaps};
}
/* the features of p that are kept but not cut: {bad: [feature], overlaps: [[feature, the one it runs into]]} */
function misfits(p){
  const outline=shapeOutline(p),feats=shapeFeatures(p);
  return{bad:outline.bad.map(i=>feats[i]),overlaps:outline.overlaps.map(([i,k])=>[feats[i],feats[k]])};
}
/* a notch fits when it lies on its edge, inside the length, and leaves wood across the width */
function notchFits(p,f){
  const c=featureCenter(p,f).u;
  return f.len>0&&f.depth>0&&f.depth<p.w-1e-6&&c-f.len/2>-1e-6&&c+f.len/2<p.l+1e-6;
}
/* the bounds of an opening in the piece's frame (true circles, not their straight-piece outline) */
function featureBounds(p,f){
  const c=featureCenter(p,f);
  if(f.kind==='hole')return{u0:c.u-f.d/2,u1:c.u+f.d/2,v0:c.v-f.d/2,v1:c.v+f.d/2};
  if(f.kind==='slot'){
    const alongU=f.dir!=='v',a=(alongU?f.len:f.d)/2,b=(alongU?f.d:f.len)/2;
    return{u0:c.u-a,u1:c.u+a,v0:c.v-b,v1:c.v+b};
  }
  if(f.kind==='cutout')return{u0:c.u-f.a/2,u1:c.u+f.a/2,v0:c.v-f.b/2,v1:c.v+f.b/2};
  if(f.kind==='notch')return{u0:c.u-f.len/2,u1:c.u+f.len/2,v0:f.edge===1?p.w-f.depth:0,v1:f.edge===1?p.w:f.depth};
  return{u0:0,u1:0,v0:0,v1:0};
}
/* an opening fits when every point of it is inside the outline (it is wholly inside the piece: rule S3) */
function openingFits(p,f,outer){
  const ring=openingPoints(p,f);
  if(!ring)return true;
  const loop=(outer||shapeOutline(p).outer).map(q=>[q.u,q.v]);
  return ring.every(([u,v])=>pointInLoop(u,v,loop)&&distanceToLoop(u,v,loop)>1e-4);
}

/* ---------- plane geometry (loops are arrays of [u, v]) ---------- */
function pointInLoop(u,v,loop){
  let inside=false;
  for(let i=0,j=loop.length-1;i<loop.length;j=i++){
    const[ui,vi]=loop[i],[uj,vj]=loop[j];
    if((vi>v)!==(vj>v)&&u<(uj-ui)*(v-vi)/(vj-vi)+ui)inside=!inside;
  }
  return inside;
}
function distanceToSegment(u,v,[au,av],[bu,bv]){
  const du=bu-au,dv=bv-av,len2=du*du+dv*dv;
  const t=len2?Math.max(0,Math.min(1,((u-au)*du+(v-av)*dv)/len2)):0;
  return Math.hypot(u-(au+t*du),v-(av+t*dv));
}
function distanceToLoop(u,v,loop){
  let least=Infinity;
  for(let i=0,j=loop.length-1;i<loop.length;j=i++)least=Math.min(least,distanceToSegment(u,v,loop[j],loop[i]));
  return least;
}
/* do two segments cross (or touch)? */
function segmentsMeet(a,b,c,d){
  const side=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const d1=side(c,d,a),d2=side(c,d,b),d3=side(a,b,c),d4=side(a,b,d);
  if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0)))return true;
  const onIt=(p,q,r)=>Math.abs(side(p,q,r))<1e-12&&Math.min(p[0],q[0])-1e-12<=r[0]&&r[0]<=Math.max(p[0],q[0])+1e-12&&Math.min(p[1],q[1])-1e-12<=r[1]&&r[1]<=Math.max(p[1],q[1])+1e-12;
  return onIt(c,d,a)||onIt(c,d,b)||onIt(a,b,c)||onIt(a,b,d);
}
/* do two loops share any area: a point of either inside the other, or two of their sides crossing? Looked at both
   ways, so a small hole wholly inside a bigger cut-out is found whichever was added first. */
function ringsOverlap(A,B){
  // (apart by their bounds: the usual case, and no work)
  const bounds=ring=>ring.reduce((b,[u,v])=>[Math.min(b[0],u),Math.max(b[1],u),Math.min(b[2],v),Math.max(b[3],v)],[Infinity,-Infinity,Infinity,-Infinity]);
  const a=bounds(A),b=bounds(B);
  if(a[1]<b[0]||b[1]<a[0]||a[3]<b[2]||b[3]<a[2])return false;
  if(A.some(([u,v])=>pointInLoop(u,v,B))||B.some(([u,v])=>pointInLoop(u,v,A)))return true;
  for(let i=0,k=A.length-1;i<A.length;k=i++){
    for(let m=0,n=B.length-1;m<B.length;n=m++)if(segmentsMeet(A[k],A[i],B[n],B[m]))return true;
  }
  return false;
}
/* the least distance between two loops that do not overlap (0 when they do) */
function ringGap(A,B){
  if(ringsOverlap(A,B))return 0;
  return Math.min(...A.map(([u,v])=>distanceToLoop(u,v,B)),...B.map(([u,v])=>distanceToLoop(u,v,A)));
}
const loopArea=loop=>{
  let a=0;
  for(let i=0,j=loop.length-1;i<loop.length;j=i++)a+=loop[j][0]*loop[i][1]-loop[i][0]*loop[j][1];
  return a/2;
};
/* Sutherland-Hodgman: the part of a loop inside the rectangle [u0, u1] x [v0, v1] */
function clipLoopToRect(loop,u0,u1,v0,v1){
  const edges=[[q=>q[0]>=u0,(a,b)=>cut(a,b,0,u0)],[q=>q[0]<=u1,(a,b)=>cut(a,b,0,u1)],
    [q=>q[1]>=v0,(a,b)=>cut(a,b,1,v0)],[q=>q[1]<=v1,(a,b)=>cut(a,b,1,v1)]];
  function cut(a,b,k,c){const t=(c-a[k])/(b[k]-a[k]);return[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];}
  let out=loop;
  for(const[inside,cross]of edges){
    const next=[];
    for(let i=0;i<out.length;i++){
      const cur=out[i],prev=out[(i+out.length-1)%out.length];
      if(inside(cur)){if(!inside(prev))next.push(cross(prev,cur));next.push(cur);}
      else if(inside(prev))next.push(cross(prev,cur));
    }
    out=next;
    if(!out.length)break;
  }
  return out;
}

/* ---------- through the thickness ----------
   A bevel (and a point across the thickness) is a cut that is not square to the faces: the end points move along
   the length with the depth s. That is how the 3D solid is made (js/shapeview.js) and how volume and corners are
   worked out here, so all three agree. */
function shiftAt(p,point,s){
  const end=shapeEnd(p,point.end);
  if(!end||endsCross(p))return 0;
  if(point.tag==='cut'&&end.cut==='saw'&&end.bevel){
    const fromLong=end.bevelLong===1?p.t-s:s;
    return fromLong*Math.tan(degToRad(end.bevel))/Math.cos(degToRad(end.miter||0));
  }
  if(point.tag==='ridge'&&end.cut==='point')return Math.abs(s-p.t/2)*Math.tan(degToRad(end.deg));
  return 0;
}
/* the face outline at depth s (0 = face 0, t = face 1), as [u, v] points */
function outlineAt(p,s,outline){
  const outer=(outline||shapeOutline(p)).outer;
  return outer.map(q=>{
    const shift=shiftAt(p,q,s);
    return[q.end===1?q.u-shift:q.end===0?q.u+shift:q.u,q.v];
  });
}
const slanted=p=>[0,1].some(i=>{const e=shapeEnd(p,i);return e&&((e.cut==='saw'&&e.bevel)||(e.cut==='point'&&e.across==='t'));});

/* the volume of the wood (cubic inches). The area of a face cut at depth s changes as a quadratic in s (twice, for a
   ridge), so Simpson's rule on five depths is exact for the straight-piece outline the 3D view draws. */
const volumeMemo=new Map();
function pieceVolume(p){
  if(!hasShape(p))return p.l*p.w*p.t;
  const key=shapeKey(p)+'|'+p.l+'|'+p.w+'|'+p.t;
  if(volumeMemo.has(key))return volumeMemo.get(key);
  const outline=shapeOutline(p),t=p.t;
  const area=s=>loopArea(outlineAt(p,s,outline))-outline.openings.reduce((sum,ring)=>sum+loopArea(ring),0);
  const volume=t/12*(area(0)+4*area(t/4)+2*area(t/2)+4*area(3*t/4)+area(t));
  if(volumeMemo.size>2000)volumeMemo.clear();
  volumeMemo.set(key,volume);
  return volume;
}
/* the corners of the solid in the piece's frame, [u, v, s] (both faces, and the middle for a ridge) */
function pieceCorners(p){
  const outline=shapeOutline(p),depths=slanted(p)?[0,p.t/2,p.t]:[0,p.t],out=[];
  for(const s of depths)for(const[u,v]of outlineAt(p,s,outline))out.push([u,v,s]);
  return out;
}
/* points of the piece's frame in the world: world = center + R (e[ax0] (u - l/2) + e[ax1] (v - w/2) + e[ax2] (s - t/2)) */
function toWorld(p,points){
  const s=size(p),center=p.pos.map((x,i)=>x+s[i]/2),q=quatOf(p),half=[p.l/2,p.w/2,p.t/2];
  return points.map(point=>{
    const local=new THREE.Vector3();
    for(let k=0;k<3;k++)local.setComponent(p.ax[k],point[k]-half[k]);
    if(q)local.applyQuaternion(q);
    return[center[0]+local.x,center[1]+local.y,center[2]+local.z];
  });
}
/* the world bounds of a TURNED shaped piece: its real corners in the world (box, js/orient.js) */
function shapedBox(p){
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const point of toWorld(p,pieceCorners(p))){
    for(let k=0;k<3;k++){if(point[k]<lo[k])lo[k]=point[k];if(point[k]>hi[k])hi[k]=point[k];}
  }
  return{lo,hi};
}
/* a world point in the piece's frame (square-set pieces, or the frame the caller squared up) */
function toLocal(p,point,lo){
  const base=lo||p.pos;
  return[point[p.ax[0]]-base[p.ax[0]],point[p.ax[1]]-base[p.ax[1]],point[p.ax[2]]-base[p.ax[2]]];
}
/* is (u, v) wood, with at least `margin` of wood around it? s: the depth looked at (the middle by default) */
function materialAt(p,u,v,margin,s){
  if(!hasShape(p))return u>=margin&&u<=p.l-margin&&v>=margin&&v<=p.w-margin;
  const outline=shapeOutline(p),loop=outlineAt(p,s===undefined?p.t/2:s,outline);
  margin=margin||0;
  if(!pointInLoop(u,v,loop)||distanceToLoop(u,v,loop)<margin-1e-9)return false;
  for(const ring of outline.openings){
    if(pointInLoop(u,v,ring)||distanceToLoop(u,v,ring)<margin-1e-9)return false;
  }
  return true;
}

/* ---------- turning a shape over ----------
   flipShape(shape, axis) gives the same marks seen with one local axis reversed: axis 0 swaps the ends (and what is
   measured from them), 1 the edges, 2 the faces. It is used for a mirror image, for a half turn (setQuat,
   js/orient.js: ax has no sign) and for the keys of the cut list. */
function flipShape(shape,axis){
  const copy=JSON.parse(JSON.stringify(shape));
  const flipFrom=spec=>{
    if(!spec)return;
    if(spec.from===0||spec.from===1)spec.from=1-spec.from;
    else if(spec.d)spec.d=-spec.d;
  };
  if(axis===0){
    copy.ends=[copy.ends[1],copy.ends[0]];
    copy.corners=[copy.corners[2],copy.corners[3],copy.corners[0],copy.corners[1]];
    for(const f of copy.feats)if(f.at)flipFrom(f.at.u);
  }else if(axis===1){
    for(const end of copy.ends)if(end&&end.cut==='saw')end.long=1-(end.long||0);
    copy.corners=[copy.corners[1],copy.corners[0],copy.corners[3],copy.corners[2]];
    for(const f of copy.feats){
      if(f.kind==='notch')f.edge=1-(f.edge||0);
      else if(f.at)flipFrom(f.at.v);
    }
  }else{
    for(const end of copy.ends)if(end&&end.cut==='saw')end.bevelLong=1-(end.bevelLong||0);
  }
  return copy;
}
/* mirror the piece's own shape along local axis i, in place (the piece's world image is reversed along it) */
function mirrorShape(p,i){
  if(hasShape(p))p.shape=flipShape(p.shape,i);
}
/* A quarter turn (+90°) about world axis k that is stored by swapping the two other world axes in p.ax (rotatePart,
   js/tools.js: Spin flat, Tip front/back, Tip sideways). ax has no sign, so the swap alone is a reflection: the one
   local axis whose world direction the real turn reverses takes the shape with it, as setQuat does. Call it BEFORE
   the swap. */
function shapeQuarterTurned(p,k){
  if(!hasShape(p))return;
  const q=new THREE.Quaternion().setFromAxisAngle(AXV[k],SHAPE_PI/2);
  for(let i=0;i<3;i++){
    const turned=AXV[p.ax[i]].clone().applyQuaternion(q);
    if(turned.x+turned.y+turned.z<-.5)mirrorShape(p,i);   // it now runs along a world axis the other way
  }
}
/* The key of a shape for the cut list: the shape written out by where things are (not by what they are measured
   from), the smallest of the four ways the same blank can be turned over (identity, end for end, over, both). Two
   pieces with the same key are cut alike. shapeKeyMirror is the same over the four single reflections: a piece
   whose key is another's mirror key is its left or right twin. '' for a plain piece. */
function shapeText(p,shape){
  const r=round64,w=p.w;
  const endText=e=>!e?'s':e.cut==='saw'?`a${r(e.miter||0)},${e.miter?e.long||0:0},${r(e.bevel||0)},${e.bevel?e.bevelLong||0:0}`
    :e.cut==='round'?`r${r(Math.min(e.r,w/2))}`:`p${r(e.deg)},${e.across}`;
  const cornerText=c=>!c?'s':c.cut==='round'?`r${r(c.r)}`:`${c.cut[0]}${r(c.a)},${r(c.b)}`;
  const view={...p,shape};
  const feats=shape.feats.map(f=>{
    const c=featureCenter(view,f);
    if(f.kind==='hole')return`h${r(f.d)},${r(c.u)},${r(c.v)},${f.use||'plain'}`;
    if(f.kind==='cutout')return`c${r(f.a)},${r(f.b)},${r(f.r||0)},${r(c.u)},${r(c.v)}`;
    if(f.kind==='slot')return`l${r(f.d)},${r(f.len)},${f.dir},${r(c.u)},${r(c.v)}`;
    return`n${f.edge},${r(f.len)},${r(f.depth)},${r(c.u)}`;
  }).sort();
  return[shape.ends.map(endText).join('/'),shape.corners.map(cornerText).join('/'),feats.join(';')].join('|');
}
const shapeKeysMemo=new Map();
function shapeKeys(p){
  if(!hasShape(p))return{proper:'',mirror:''};
  const memo=JSON.stringify(p.shape)+'|'+p.l+'|'+p.w;
  if(shapeKeysMemo.has(memo))return shapeKeysMemo.get(memo);
  const s=p.shape,f0=flipShape(s,0),f1=flipShape(s,1),f2=flipShape(s,2);
  const proper=[s,flipShape(f0,1),flipShape(f1,2),flipShape(f0,2)].map(x=>shapeText(p,x)).sort()[0];
  const mirror=[f0,f1,f2,flipShape(flipShape(f0,1),2)].map(x=>shapeText(p,x)).sort()[0];
  if(shapeKeysMemo.size>2000)shapeKeysMemo.clear();
  shapeKeysMemo.set(memo,{proper,mirror});
  return{proper,mirror};
}
const shapeKey=p=>shapeKeys(p).proper;
const shapeKeyMirror=p=>shapeKeys(p).mirror;

/* ---------- keeping shapes tidy (invariants 1 and 4 of the spec) ----------
   tidyShape(p) never throws. A plain piece ends up with no shape field at all, so an old design saves back byte for
   byte. A feature it cannot read is dropped and counted. */
const shapeFinite=x=>typeof x==='number'&&isFinite(x);
function tidyEnd(end){
  if(!end||typeof end!=='object')return null;
  if(end.cut==='saw'){
    const miter=shapeFinite(end.miter)?Math.max(0,Math.min(60,end.miter)):0,bevel=shapeFinite(end.bevel)?Math.max(0,Math.min(45,end.bevel)):0;
    if(!miter&&!bevel)return null;   // both angles 0: the end is square again
    return{cut:'saw',miter,long:end.long===1?1:0,bevel,bevelLong:end.bevelLong===0?0:1};
  }
  if(end.cut==='round'&&shapeFinite(end.r)&&end.r>0)return{cut:'round',r:end.r};
  if(end.cut==='point'&&shapeFinite(end.deg)&&end.deg>0)return{cut:'point',deg:Math.max(10,Math.min(60,end.deg)),across:end.across==='t'?'t':'w'};
  return null;
}
function tidyCorner(c){
  if(!c||typeof c!=='object')return null;
  if(c.cut==='round'&&shapeFinite(c.r)&&c.r>0)return{cut:'round',r:c.r};
  if((c.cut==='clip'||c.cut==='notch')&&shapeFinite(c.a)&&shapeFinite(c.b)&&c.a>0&&c.b>0)return{cut:c.cut,a:c.a,b:c.b};
  return null;
}
function tidyAt(at,notch){
  const one=spec=>{
    if(!spec||typeof spec!=='object')return{from:'mid',d:0};
    const from=spec.from===0||spec.from===1?spec.from:'mid',d=shapeFinite(spec.d)?spec.d:0;
    return{from,d:from==='mid'?d:Math.max(0,d)};
  };
  return notch?{u:one(at&&at.u)}:{u:one(at&&at.u),v:one(at&&at.v)};
}
function tidyFeature(f){
  if(!f||typeof f!=='object')return null;
  const pos=x=>shapeFinite(x)&&x>0;
  if(f.kind==='hole'&&pos(f.d))return{kind:'hole',at:tidyAt(f.at),d:f.d,use:['plain','cup','wire'].includes(f.use)?f.use:'plain'};
  if(f.kind==='cutout'&&pos(f.a)&&pos(f.b))return{kind:'cutout',at:tidyAt(f.at),a:f.a,b:f.b,r:shapeFinite(f.r)&&f.r>0?f.r:0};
  if(f.kind==='slot'&&pos(f.d)&&pos(f.len))return{kind:'slot',at:tidyAt(f.at),d:f.d,len:f.len,dir:f.dir==='v'?'v':'u'};
  if(f.kind==='notch'&&pos(f.len)&&pos(f.depth))return{kind:'notch',edge:f.edge===1?1:0,at:tidyAt(f.at,true),len:f.len,depth:f.depth};
  return null;
}
/* returns how many features could not be read */
function tidyShape(p){
  if(!('shape' in p))return 0;
  const s=p.shape;
  if(!s||typeof s!=='object'){delete p.shape;return 0;}
  const ends=[0,1].map(i=>tidyEnd(Array.isArray(s.ends)?s.ends[i]:null));
  const corners=[0,1,2,3].map(i=>tidyCorner(Array.isArray(s.corners)?s.corners[i]:null));
  const given=Array.isArray(s.feats)?s.feats:[];
  const feats=given.map(tidyFeature).filter(Boolean);
  const lost=given.length-feats.length;
  if(ends.every(e=>!e)&&corners.every(c=>!c)&&!feats.length){delete p.shape;return lost;}
  p.shape={v:1,ends,corners,feats};
  return lost;
}
let shapeLoadLost=0;
function tidyShapes(onLoad){
  let lost=0;
  for(const p of S.parts)if('shape' in p)lost+=tidyShape(p);
  if(onLoad&&lost){
    shapeLoadLost+=lost;
    toast(`${lost===1?'1 hole or cut':lost+' holes or cuts'} in this design could not be read and ${lost===1?'was':'were'} left out.`);
  }
}
ON_LOAD.push(()=>tidyShapes(true));
ON_COMMIT.push(()=>tidyShapes(false));
/* an empty shape to start from */
const blankShape=()=>({v:1,ends:[null,null],corners:[null,null,null,null],feats:[]});
function ensureShape(p){
  if(!p.shape)p.shape=blankShape();
  return p.shape;
}

/* ---------- names, as a person sees the piece in the room ----------
   Ends, edges and faces are named by where they point: the length's world direction nearest to up gives
   "Bottom end" / "Top end", to left-right "Left end" / "Right end", to front-back "Back end" / "Front end"; edges
   the same with the width, faces with the thickness. A tie is broken in the order up, front-back, left-right.
   (Not "edgeName": js/markingview.js already has a global of that name.) */
const SIDE_WORDS=[['left','right'],['bottom','top'],['back','front']];   // by world axis: [low, high]
function sideWord(p,i,high){
  const d=AXV[p.ax[i]].clone(),q=quatOf(p);
  if(q)d.applyQuaternion(q);
  const a=[Math.abs(d.x),Math.abs(d.y),Math.abs(d.z)];
  const axis=a[1]>=Math.max(a[0],a[2])-1e-6?1:a[2]>=a[0]-1e-6?2:0;
  const positive=d.getComponent(axis)>0;
  return{axis,word:SIDE_WORDS[axis][positive===!!high?1:0]};
}
const shapeCapital=text=>text.charAt(0).toUpperCase()+text.slice(1);
const shapeEndName=(p,i)=>shapeCapital(sideWord(p,0,i===1).word)+' end';
const shapeEdgeName=(p,i)=>shapeCapital(sideWord(p,1,i===1).word)+' edge';
function shapeFaceName(p,i){
  const side=sideWord(p,2,i===1);
  if(side.axis===1)return side.word==='bottom'?'Underside':'Top face';
  return shapeCapital(side.word)+' face';
}
function shapeCornerName(p,i){
  const end=sideWord(p,0,i>=2),edge=sideWord(p,1,i%2===1);
  if(end.axis===edge.axis)return`${shapeEndName(p,i>=2?1:0)}, ${shapeEdgeName(p,i%2).toLowerCase()} corner`;
  const order=['top','bottom','front','back','left','right'];
  const words=[end.word,edge.word].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  return shapeCapital(`${words[0]} ${words[1]} corner`);
}
const shapeLower=text=>text.charAt(0).toLowerCase()+text.slice(1);
/* the names of everything at once, for the words and the Properties section */
function shapeNames(p){
  return{end:[0,1].map(i=>shapeEndName(p,i)),edge:[0,1].map(i=>shapeEdgeName(p,i)),
    face:[0,1].map(i=>shapeFaceName(p,i)),corner:[0,1,2,3].map(i=>shapeCornerName(p,i))};
}

/* ---------- words ---------- */
/* where a feature's center is, in words: 'center 9" from the top end, centered' */
function placeWords(p,f,names){
  const u=f.at&&f.at.u,v=f.at&&f.at.v;
  const along=!u||u.from==='mid'?(!u||!u.d?'halfway along':`${fmt(Math.abs(u.d))} from the middle toward the ${shapeLower(names.end[u.d>0?1:0])}`)
    :`${fmt(u.d)} from the ${shapeLower(names.end[u.from])}`;
  if(f.kind==='notch')return`its middle ${along}`;
  const across=!v||v.from==='mid'?(!v||!v.d?'centered':`${fmt(Math.abs(v.d))} off center toward the ${shapeLower(names.edge[v.d>0?1:0])}`)
    :`${fmt(v.d)} from the ${shapeLower(names.edge[v.from])}`;
  return`center ${along}, ${across}`;
}
/* ---------- where the features are measured from on the drawing and in the How to cut lines ----------
   A shop drawing locates every hole, cut-out, slot and notch of a piece by a number from ONE named end and a number
   from ONE named edge, the same end and edge for all of them, so a person hooks one tape on one corner and marks
   everything from there. "Centered" is only ever a remark after the number. The end and the edge most features
   were placed from win; on a tie, a square end before a shaped one (a rounded or pointed end has nothing to hook a
   tape on once it is cut), then end 0, and edge 0. A notch counts for the edge it is cut in. */
function shapeDatum(p){
  let endVote=0,edgeVote=0;
  for(const f of shapeFeatures(p)){
    const at=f.at||{};
    if(at.u&&at.u.from===0)endVote--;
    else if(at.u&&at.u.from===1)endVote++;
    if(f.kind==='notch')edgeVote+=f.edge===1?1:-1;
    else if(at.v&&at.v.from===0)edgeVote--;
    else if(at.v&&at.v.from===1)edgeVote++;
  }
  let end=endVote>0?1:0;
  if(!endVote&&shapeEnd(p,0)&&!shapeEnd(p,1))end=1;
  return{end,edge:edgeVote>0?1:0};
}
/* a feature measured from the datum end and edge:
     along   [{u, value}]: its center from the end (a notch: its two sides, the nearer first)
     across  {v, value}: its center from the edge (a notch: its inside line, the bottom of the notch)
     midLength, midWidth: whether its center is halfway along, or halfway across (a remark, never the number) */
function featureFromDatum(p,f,datum){
  datum=datum||shapeDatum(p);
  const c=featureCenter(p,f),endU=datum.end?p.l:0,edgeV=datum.edge?p.w:0;
  const fromEnd=u=>({u,value:Math.abs(u-endU)});
  if(f.kind==='notch'){
    const bottom=f.edge===1?p.w-f.depth:f.depth;
    return{along:[c.u-f.len/2,c.u+f.len/2].map(fromEnd).sort((a,b)=>a.value-b.value),
      across:{v:bottom,value:Math.abs(bottom-edgeV)},midLength:false,midWidth:false};
  }
  return{along:[fromEnd(c.u)],across:{v:c.v,value:Math.abs(c.v-edgeV)},
    midLength:Math.abs(c.u-p.l/2)<1e-6,midWidth:Math.abs(c.v-p.w/2)<1e-6};
}
/* in words, for the How to cut lines: '9" from the right end and 12" from the back edge (centered across the width)' */
function datumWords(p,f,names){
  const datum=shapeDatum(p),at=featureFromDatum(p,f,datum);
  const end=shapeLower(names.end[datum.end]),edge=shapeLower(names.edge[datum.edge]);
  const remark=at.midLength&&at.midWidth?' (the middle of the piece)':at.midWidth?' (centered across the width)':at.midLength?' (halfway along)':'';
  return`${fmt(at.along[0].value)} from the ${end} and ${fmt(at.across.value)} from the ${edge}${remark}`;
}
/* one line of the feature list: '6" hole, center 9" from the top end, centered' */
function featureWords(p,f,names){
  names=names||shapeNames(p);
  const kind=SHAPE_KINDS[f.kind];
  return kind?kind.words(p,f,names):'';
}
/* a short note for the cut list: 'Bottom end cut at 11°, top end rounded, a 6" hole' */
function shapeNote(p){
  if(!hasShape(p))return'';
  const names=shapeNames(p),parts=[];
  [0,1].forEach(i=>{
    const end=shapeEnd(p,i);
    if(end)parts.push(`${shapeLower(names.end[i])} ${SHAPE_KINDS[end.cut].short(p,end,names)}`);
  });
  // two ends angled across the face: do they slant the same way (a parallelogram) or opposite ways (a trapezoid)?
  const[a,b]=[shapeEnd(p,0),shapeEnd(p,1)];
  if(a&&b&&a.cut==='saw'&&b.cut==='saw'&&a.miter&&b.miter){
    parts.push(a.long===b.long?`ends slant opposite ways (both long points on the ${shapeLower(names.edge[a.long===1?1:0])}, like a frame side)`:Math.abs(a.miter-b.miter)<1e-6?'ends parallel (the long points on opposite edges)':'ends slant the same way (the long points on opposite edges)');
  }
  [0,1,2,3].forEach(i=>{
    const c=shapeCorner(p,i);
    if(c)parts.push(`${shapeLower(names.corner[i])} ${SHAPE_KINDS['corner-'+c.cut].short(p,c)}`);
  });
  const counts={};
  for(const f of shapeFeatures(p))counts[f.kind]=(counts[f.kind]||0)+1;
  for(const[kind,n]of Object.entries(counts)){
    const sample=shapeFeatures(p).find(f=>f.kind===kind);
    parts.push(n===1?SHAPE_KINDS[kind].short(p,sample):`${n} ${SHAPE_KINDS[kind].plural}`);
  }
  return shapeCapital(parts.join(', '));
}

/* ---------- the kinds of cut: one row each (a new kind of cut is one row here) ----------
   label: its name in the Shape section; expert: only shown in Expert; fields: what Properties asks for
   ({key, label, type:'len'|'deg'|'select', min(p,x), max(p,x), def(p), show(p,x), options(p,names)});
   short(p,x): its few words in the cut list Note; words(p,x,names): its line in the list of holes and cut-outs;
   how(p,x,names,which): its numbered "How to cut" line; tools(p,x): the tools it needs. */
const halfShorter=p=>Math.min(p.l,p.w)/2;
const edgeOptions=(p,names)=>[[0,names.edge[0]],[1,names.edge[1]]];
const faceOptions=(p,names)=>[[0,names.face[0]],[1,names.face[1]]];
const SHAPE_KINDS={
  saw:{label:'Angled',group:'end',
    fields:[
      {key:'miter',label:'Angle across the face, degrees',type:'deg',min:()=>0,max:()=>60,def:()=>45},
      {key:'long',label:'Long point on',type:'select',options:edgeOptions,def:()=>0,show:(p,e)=>e.miter>0},
      {key:'bevel',label:'Angle through the thickness, degrees',type:'deg',min:()=>0,max:()=>45,def:()=>0,expertUnlessSet:true},
      {key:'bevelLong',label:'Long point on',type:'select',options:faceOptions,def:()=>1,show:(p,e)=>e.bevel>0},
    ],
    // which way it leans is part of the cut: the long point's edge (and face, for a tilted blade), sheet 21 section 5
    short(p,e,names){
      const edge=names?`, long point on the ${shapeLower(names.edge[e.long===1?1:0])}`:'';
      const face=names?`, long point on the ${shapeLower(names.face[e.bevelLong===1?1:0])}`:'';
      if(e.miter&&e.bevel)return`cut at ${degText(e.miter)}${edge}, with the blade tilted ${degText(e.bevel)}${face}`;
      return e.miter?`cut at ${degText(e.miter)}${edge}`:`cut with the blade tilted ${degText(e.bevel)}${face}`;
    },
    how(p,e,names,i){
      const set=endSetback(p,i),end=names.end[i];
      const lines=[];
      if(e.miter){
        const shortEdge=shapeLower(names.edge[e.long===1?0:1]),longEdge=shapeLower(names.edge[e.long===1?1:0]);
        const tool=e.miter>SHAPE_RULE.sawMiter?'Clamp the board down and cut on the line with a circular saw or a jigsaw':`Set the miter saw to ${degText(e.miter)} and cut on the waste side of the line`;
        lines.push(`${end}: on the ${shortEdge}, measure ${fmt(set.miterSet)} from the end and mark. Draw a line from the mark to the corner on the ${longEdge}. ${tool}.`);
      }
      if(e.bevel){
        const shortFace=shapeLower(names.face[e.bevelLong===1?0:1]),longFace=shapeLower(names.face[e.bevelLong===1?1:0]);
        lines.push(`${e.miter?'Tilt':end+': tilt'} the saw blade to ${degText(e.bevel)} for this cut (a bevel), with the long point on the ${longFace}: on the edge, the cut ends ${fmt(set.bevelSet)} in from the end on the ${shortFace}.`);
      }
      return lines.join(' ');
    },
    tools:(p,e)=>(e.miter>SHAPE_RULE.sawMiter||e.bevel>SHAPE_RULE.sawBevel)?['Circular saw or jigsaw, for a cut steeper than a miter saw takes']:['Miter saw (or a circular saw and a speed square)'],
  },
  round:{label:'Rounded',group:'end',
    fields:[{key:'r',label:'Radius',type:'len',min:()=>.25,max:p=>p.w/2,def:p=>p.w/2}],
    short:(p,e)=>e.r>=p.w/2-1e-6?'rounded':`with rounded corners (${fmt(e.r)} radius)`,
    how(p,e,names,i){
      const end=names.end[i],r=Math.min(e.r,p.w/2);
      if(r>=p.w/2-1e-6)return`${end}: set a compass to ${fmt(r)}. Put its point ${fmt(r)} from the end, in the middle of the width, and draw the curve. Cut just outside the line with a jigsaw and sand to the line.`;
      return`${end}: set a compass to ${fmt(r)}. Put its point ${fmt(r)} from the end and ${fmt(r)} from each edge, and draw the two curves. Cut just outside the lines with a jigsaw and sand to them.`;
    },
    tools:()=>['Compass and jigsaw (or a coping saw), then sandpaper'],
  },
  point:{label:'Pointed',group:'end',
    fields:[
      {key:'deg',label:'Point angle, degrees from square, each side',type:'deg',min:()=>10,max:()=>60,def:()=>45},
      {key:'across',label:'Point across',type:'select',options:()=>[['w','Width (a stake)'],['t','Thickness (a ridge)']],def:()=>'w',expertOption:'t'},
    ],
    short:(p,e)=>e.across==='t'?`cut to a ridge at ${degText(e.deg)}`:`cut to a point at ${degText(e.deg)}`,
    how(p,e,names,i){
      const end=names.end[i],reach=endSetback(p,i).most;
      if(e.across==='t')return`${end}: draw a line across both edges in the middle of the thickness, and on both faces ${fmt(reach)} from the end. Tilt the saw blade to ${degText(e.deg)} and cut from each face to the middle line, so the two cuts meet in a ridge.`;
      const tool=e.deg>SHAPE_RULE.sawMiter?'cut on the lines with a circular saw or a jigsaw':`set the miter saw to ${degText(e.deg)} and cut on each line, turning the board over between the cuts`;
      return`${end}: mark the middle of the end. On each edge measure ${fmt(reach)} from the end and mark. Draw a line from each mark to the middle mark, then ${tool}.`;
    },
    tools:(p,e)=>e.deg>SHAPE_RULE.sawMiter?['Circular saw or jigsaw, for a cut steeper than a miter saw takes']:['Miter saw (or a circular saw and a speed square)'],
  },
  'corner-clip':{label:'Cut off',group:'corner',
    fields:[
      {key:'a',label:'Along the edge',type:'len',min:()=>.25,max:p=>p.l,def:halfShorter},
      {key:'b',label:'Along the end',type:'len',min:()=>.25,max:p=>p.w,def:halfShorter},
    ],
    short:(p,c)=>c.a>=p.l-1e-6&&c.b>=p.w-1e-6?'cut off corner to corner':`cut off ${fmt(c.a)} × ${fmt(c.b)}`,
    how(p,c,names,i){
      const corner=names.corner[i];
      if(c.a>=p.l-1e-6&&c.b>=p.w-1e-6)return`Cut the piece once from corner to corner, through the ${shapeLower(corner)}'s two neighbouring corners. The saw blade takes its width from the long side, so the piece comes out about 1/16" to 1/8" short of the square.`;
      const edge=shapeLower(names.edge[i%2]),end=shapeLower(names.end[i>=2?1:0]);
      return`${corner}: measure ${fmt(c.a)} along the ${edge} and ${fmt(c.b)} along the ${end} from the corner, and mark both. Draw a line between the marks and cut on it.`;
    },
    tools:()=>['Saw (a circular saw or jigsaw along a marked line)'],
  },
  'corner-round':{label:'Rounded',group:'corner',
    fields:[{key:'r',label:'Radius',type:'len',min:()=>.125,max:p=>Math.min(p.l,p.w),def:()=>1}],
    short:(p,c)=>`rounded (${fmt(c.r)} radius)`,
    how(p,c,names,i){
      const corner=names.corner[i];
      if(c.r>=Math.min(p.l,p.w)-1e-6)return`${corner}: set a compass to ${fmt(c.r)}. Put its point on the opposite corner and draw the quarter circle. Cut just outside the line with a jigsaw and sand to it.`;
      return`${corner}: set a compass to ${fmt(c.r)}. Put its point ${fmt(c.r)} in from both sides of the corner and draw the curve. Cut just outside the line with a jigsaw and sand to it.`;
    },
    tools:()=>['Compass and jigsaw (or a coping saw), then sandpaper'],
  },
  'corner-notch':{label:'Notched',group:'corner',expert:true,
    fields:[
      {key:'a',label:'Along the edge',type:'len',min:()=>.25,max:p=>p.l-.25,def:halfShorter},
      {key:'b',label:'Along the end',type:'len',min:()=>.25,max:p=>p.w-.25,def:halfShorter},
    ],
    short:(p,c)=>`notched ${fmt(c.a)} × ${fmt(c.b)}`,
    how(p,c,names,i){
      const edge=shapeLower(names.edge[i%2]),end=shapeLower(names.end[i>=2?1:0]);
      return`${names.corner[i]}: mark a notch ${fmt(c.a)} along the ${edge} and ${fmt(c.b)} along the ${end}, and draw its two inside lines with a square. Cut on the two lines with a handsaw or a jigsaw.`;
    },
    tools:()=>['Handsaw or jigsaw'],
  },
  hole:{label:'Hole',group:'feature',plural:'holes',
    fields:[
      {key:'d',label:'Diameter',type:'len',min:()=>.125,max:p=>Math.min(p.l,p.w)-.5,def:()=>1,sizes:SHAPE_HOLE_SIZES},
      {key:'use',label:'What it is for',type:'select',options:()=>[['plain','Plain hole'],['cup','Cup holder'],['wire','Wires']],def:()=>'plain'},
    ],
    short:(p,f)=>`a ${fmt(f.d)} hole`,
    words:(p,f,names)=>`${fmt(f.d)} ${f.use==='cup'?'cup holder hole':f.use==='wire'?'hole for wires':'hole'}, ${placeWords(p,f,names)}`,
    how(p,f,names){
      const mark=`mark the center ${datumWords(p,f,names)}`;
      // tool breaks from design\reference\21-shaping-tools.md: spade bits are sold 1/4" to 1 1/2" (2i), hole saws
      // up to 6" (2g, 4); a hole saw cuts about 1 5/8" deep from one face (2g), so it is cut from both faces (3, item 7)
      if(f.d<.5)return`Hole: ${mark}. Drill it with a ${fmt(f.d)} drill bit, with a scrap of wood clamped under it so the wood does not splinter where the bit comes out.`;
      if(f.d<=1.5)return`Hole: ${mark}. Drill it with a ${fmt(f.d)} spade bit or Forstner bit. Stop when the point shows on the far side and finish from that side, so the wood does not splinter.`;
      const saw=f.d<=6?` (or use a ${fmt(f.d)} hole saw: drill until its pilot bit pokes through, then finish from the other face)`:'';
      return`Hole: ${mark}. Set a compass to ${fmt(f.d/2)} and draw the circle (${fmt(f.d)} across). Drill a 1/2" starter hole just inside the line and cut on the line with a jigsaw${saw}, then sand the edge.`;
    },
    tools:(p,f)=>f.d<.5?[`Drill bit, ${fmt(f.d)}`]:f.d<=1.5?[`Spade bit or Forstner bit, ${fmt(f.d)}`]:[f.d<=6?`Jigsaw and a 1/2" drill bit for the starter hole (or a ${fmt(f.d)} hole saw)`:'Jigsaw and a 1/2" drill bit for the starter hole'],
  },
  cutout:{label:'Cut-out',group:'feature',plural:'cut-outs',
    fields:[
      {key:'a',label:'Along the length',type:'len',min:()=>.5,max:p=>p.l-.5,def:()=>4},
      {key:'b',label:'Across the width',type:'len',min:()=>.5,max:p=>p.w-.5,def:()=>1.25},
      {key:'r',label:'Corner radius',type:'len',min:()=>0,max:(p,f)=>Math.min(f.a,f.b)/2,def:()=>.5},
    ],
    short:(p,f)=>`a ${fmt(f.a)} × ${fmt(f.b)} cut-out`,
    words:(p,f,names)=>`${fmt(f.a)} × ${fmt(f.b)} cut-out${f.r?`, corners rounded ${fmt(f.r)}`:''}, ${placeWords(p,f,names)}`,
    how(p,f,names){
      const corners=f.r>0?`, with its corners rounded to ${fmt(f.r)} (a compass at each corner)`:'';
      return`Cut-out: mark its center ${datumWords(p,f,names)} and draw the ${fmt(f.a)} × ${fmt(f.b)} rectangle around it${corners}. Drill a 1/2" starter hole inside the line at a corner, then cut on the line with a jigsaw.`;
    },
    tools:()=>['Drill and jigsaw'],
  },
  slot:{label:'Slot',group:'feature',expert:true,plural:'slots',
    fields:[
      {key:'d',label:'Width',type:'len',min:()=>.125,max:p=>Math.min(p.l,p.w)-.5,def:()=>.5},
      {key:'len',label:'Length',type:'len',min:(p,f)=>f.d+1/16,max:p=>p.l-.5,def:()=>3},
      {key:'dir',label:'Runs',type:'select',options:()=>[['u','Along the piece'],['v','Across it']],def:()=>'u'},
    ],
    short:(p,f)=>`a ${fmt(f.d)} × ${fmt(f.len)} slot`,
    words:(p,f,names)=>`${fmt(f.d)} × ${fmt(f.len)} slot ${f.dir==='v'?'across':'along'} the piece, ${placeWords(p,f,names)}`,
    how(p,f,names){
      return`Slot: mark its center ${datumWords(p,f,names)}. Mark the centers of its two round ends ${fmt(f.len-f.d)} apart on a line ${f.dir==='v'?'across':'along'} the piece and drill a ${fmt(f.d)} hole at each. Cut out the wood between the holes with a jigsaw along two straight lines.`;
    },
    tools:(p,f)=>[`Drill bit ${fmt(f.d)} and a jigsaw`],
  },
  notch:{label:'Notch in an edge',group:'feature',expert:true,plural:'notches',
    fields:[
      {key:'edge',label:'In the',type:'select',options:edgeOptions,def:()=>0},
      {key:'len',label:'Length',type:'len',min:()=>.25,max:p=>p.l-.5,def:()=>3.5},
      {key:'depth',label:'Depth',type:'len',min:()=>.25,max:p=>p.w-.25,def:()=>1.5},
    ],
    short:(p,f)=>`a ${fmt(f.len)} × ${fmt(f.depth)} notch`,
    words:(p,f,names)=>`${fmt(f.len)} × ${fmt(f.depth)} notch in the ${shapeLower(names.edge[f.edge])}, ${placeWords(p,f,names)}`,
    how(p,f,names){
      // its two sides from the datum end, and its inside line from the datum edge (the same end and edge as every
      // other feature of the piece); the depth from its own edge is a remark when that is the other edge
      const datum=shapeDatum(p),at=featureFromDatum(p,f,datum);
      const end=shapeLower(names.end[datum.end]),edge=shapeLower(names.edge[f.edge]),datumEdge=shapeLower(names.edge[datum.edge]);
      const depth=f.edge===datum.edge?`${fmt(f.depth)} in from the ${edge}`:`in to ${fmt(at.across.value)} from the ${datumEdge} (the notch is ${fmt(f.depth)} deep)`;
      return`Notch: on the ${edge}, mark ${fmt(at.along[0].value)} and ${fmt(at.along[1].value)} from the ${end} (the notch is ${fmt(f.len)} long). Square a line from each mark ${depth} and join their ends. Cut the two sides with a handsaw or a jigsaw, then cut out along the bottom line with the jigsaw.`;
    },
    tools:()=>['Handsaw or jigsaw'],
  },
};
/* the "How to cut" lines of one piece, numbered by the caller; the first cuts the blank */
function shapeHowLines(p){
  const names=shapeNames(p),m=M[p.mat],lines=[];
  lines.push(m.kind==='sheet'?`Cut the ${m.short} to ${fmt(p.l)} × ${fmt(p.w)}, square.`:`Cut the ${m.short} to ${fmt(p.l)} long${p.w<m.w-.01?`, ripped to ${fmt(p.w)} wide`:''}, both ends square.`);
  const features=shapeFeatures(p).map(f=>SHAPE_KINDS[f.kind].how(p,f,names));
  // the features are measured from one end (shapeDatum): when that end gets a shape of its own, they are marked
  // first, while it is still square and a tape can be hooked on it
  const datumEnd=shapeDatum(p).end,markFirst=features.length&&shapeEnd(p,datumEnd);
  if(markFirst){
    features[0]=features[0].replace(/^([^:]+): /,`$1, before you cut the ${shapeLower(names.end[datumEnd])} to shape (while it is still square): `);
    lines.push(...features);
  }
  [0,1].forEach(i=>{const e=shapeEnd(p,i);if(e)lines.push(SHAPE_KINDS[e.cut].how(p,e,names,i));});
  [0,1,2,3].forEach(i=>{const c=shapeCorner(p,i);if(c&&!shapeEnd(p,i<2?0:1))lines.push(SHAPE_KINDS['corner-'+c.cut].how(p,c,names,i));});
  if(!markFirst)lines.push(...features);
  return lines;
}
/* the tools a shaped piece needs */
function shapeTools(p){
  const out=new Set();
  [0,1].forEach(i=>{const e=shapeEnd(p,i);if(e)SHAPE_KINDS[e.cut].tools(p,e).forEach(t=>out.add(t));});
  [0,1,2,3].forEach(i=>{const c=shapeCorner(p,i);if(c)SHAPE_KINDS['corner-'+c.cut].tools(p,c).forEach(t=>out.add(t));});
  for(const f of shapeFeatures(p))SHAPE_KINDS[f.kind].tools(p,f).forEach(t=>out.add(t));
  return[...out];
}

/* ---------- helpers for builders (a builder works shapes out from its own form; a person can change them after) ----------
   which: 'low' or 'high', the end lower or higher along the length's world axis as the piece is built (square). */
const endIndex=(p,which)=>which==='high'||which===1?1:0;
function sawEnd(p,which,miter,toward,bevel,face){
  ensureShape(p).ends[endIndex(p,which)]={cut:'saw',miter:miter||0,long:toward===1?1:0,bevel:bevel||0,bevelLong:face===0?0:1};
  tidyShape(p);return p;
}
function roundEnd(p,which,r){ensureShape(p).ends[endIndex(p,which)]={cut:'round',r:r===undefined?p.w/2:r};tidyShape(p);return p;}
function pointEnd(p,which,deg,across){ensureShape(p).ends[endIndex(p,which)]={cut:'point',deg:deg||45,across:across==='t'?'t':'w'};tidyShape(p);return p;}
function cutCorner(p,i,corner){ensureShape(p).corners[i]=corner;tidyShape(p);return p;}
function addFeature(p,feature){ensureShape(p).feats.push(feature);tidyShape(p);return p;}
const addHole=(p,spec)=>addFeature(p,{kind:'hole',use:'plain',...spec});
const addCutout=(p,spec)=>addFeature(p,{kind:'cutout',a:4,b:1.25,r:.5,...spec});
const addSlot=(p,spec)=>addFeature(p,{kind:'slot',d:.5,len:3,dir:'u',...spec});
const addNotch=(p,spec)=>addFeature(p,{kind:'notch',edge:0,len:3.5,depth:1.5,...spec});
/* the blank length of a piece known by its center line length (a leg from pivot to floor), rounded UP to 1/16" so
   the cut piece is never short. ends: [{miter, bevel}, {miter, bevel}] */
function blankLength(centerLength,ends,w,t){
  const tan=deg=>Math.tan(degToRad(deg||0)),cos=deg=>Math.cos(degToRad(deg||0));
  const[a,b]=ends.map(e=>e||{});
  const x=centerLength+(w/2)*(tan(a.miter)+tan(b.miter))+(t/2)*(tan(a.bevel)/cos(a.miter)+tan(b.bevel)/cos(b.miter));
  return Math.ceil(x*16-1e-9)/16;
}

/* ---------- joints, fasteners and overlaps of shaped pieces (spec 03, section 3) ----------
   The sweep that finds contacts still works on the blanks (the blank is the tight box of the wood, invariant 2).
   When a contact has a shaped piece, trimJoint looks at the wood that is really there, in the frame the joint
   was found in (box.lo is where the blank is in that frame: the world, or a turned set stood square). */
const SHAPE_SAMPLE=1/16;   // the step along an edge or an end when its trimmed length is measured
/* where along one line of the piece (local axis `along`, at `across` on the other local axis) there is wood:
   [first, last] inside [lo, hi], or null */
function woodAlongLine(p,along,across,lo,hi){
  let first=null,last=null;
  const steps=Math.max(1,Math.ceil((hi-lo)/SHAPE_SAMPLE));
  // (the samples sit a hair inside the range: a point exactly on the outline is neither in nor out, and a plain
  // stretch of edge must keep its whole length, as it would on a plain piece)
  const inset=Math.min(1e-3,(hi-lo)/4);
  for(let i=0;i<=steps;i++){
    const x=Math.max(lo+inset,Math.min(hi-inset,lo+(hi-lo)*i/steps));
    const wood=along===0?materialAt(p,x,across,0):materialAt(p,across,x,0);
    if(wood){if(first===null)first=i;last=i;}
  }
  if(first===null)return null;
  // the first and last samples with wood, taken to the ends of the range when the wood reaches them
  const at=i=>i===0?lo:i===steps?hi:lo+(hi-lo)*i/steps;
  return[at(first),at(last)];
}
function trimJoint(joint,boxA,boxB){
  let j=joint;
  const trim={a:null,b:null};
  for(const[p,box,side]of[[joint.a,boxA,'a'],[joint.b,boxB,'b']]){
    if(!p.shape||!j)continue;
    const which=p.ax.indexOf(j.k);                  // 2: its face, 1: its edge, 0: its end
    const high=Math.abs(j.plane-box.lo[j.k])>1e-6;  // the contact is on its high side (face 1, edge 1, end 1)
    // the contact rectangle in the piece's own (u, v) where it applies
    const range=axis=>{
      const r=axis===j.u?j.ru:j.rv;
      return[r[0]-box.lo[axis],r[1]-box.lo[axis]];
    };
    if(which===2){
      const ru=range(p.ax[0]),rv=range(p.ax[1]),outline=shapeOutline(p);
      const clipped=clipLoopToRect(outlineAt(p,high?p.t:0,outline),ru[0],ru[1],rv[0],rv[1]);
      let area=clipped.length>2?Math.abs(loopArea(clipped)):0;
      for(const ring of outline.openings){
        const inside=clipLoopToRect(ring,ru[0],ru[1],rv[0],rv[1]);
        if(inside.length>2)area-=Math.abs(loopArea(inside));
      }
      if(area<SHAPE_RULE.contact)return null;   // wholly under a hole, or too small to fasten
      const us=clipped.map(q=>q[0]),vs=clipped.map(q=>q[1]);
      j=narrowJoint(j,p.ax[0],Math.min(...us)+box.lo[p.ax[0]],Math.max(...us)+box.lo[p.ax[0]]);
      j=narrowJoint(j,p.ax[1],Math.min(...vs)+box.lo[p.ax[1]],Math.max(...vs)+box.lo[p.ax[1]]);
      trim[side]=clipped;
    }else if(which===1){
      const ru=range(p.ax[0]),found=woodAlongLine(p,0,high?p.w-.01:.01,ru[0],ru[1]);
      if(!found||found[1]-found[0]<.1)return null;
      j=narrowJoint(j,p.ax[0],found[0]+box.lo[p.ax[0]],found[1]+box.lo[p.ax[0]]);
      trim[side]=true;
    }else{
      if(shapeEnd(p,high?1:0))return null;          // a cut end only touches: a tie (shapeEndTies), never a square joint
      const rv=range(p.ax[1]),found=woodAlongLine(p,1,high?p.l-.01:.01,rv[0],rv[1]);
      if(!found||found[1]-found[0]<.1)return null;
      j=narrowJoint(j,p.ax[1],found[0]+box.lo[p.ax[1]],found[1]+box.lo[p.ax[1]]);
      trim[side]=true;
    }
  }
  if(!j)return null;
  j.trim=trim;
  j.shapes=shapeKey(j.a)+'#'+shapeKey(j.b);   // read by the layout cache (layoutCarry, js/fasteners.js)
  return j;
}
/* the joint with its range along world axis `axis` cut down to [lo, hi] */
function narrowJoint(j,axis,lo,hi){
  if(axis!==j.u&&axis!==j.v)return j;
  const key=axis===j.u?'ru':'rv',r=j[key];
  const next=[Math.max(r[0],lo),Math.min(r[1],hi)];
  if(next[1]-next[0]<.1)return null;
  return{...j,[key]:next};
}
/* the ends cut at an angle that only touch another piece: ties ({key, a, b, tie, cutEnd}), so the two move together,
   Connections see them touching, and Check my design says so (W6). Only pieces with a cut end are looked at. */
/* Two ways a cut end meets another piece:
     - the blanks touch at that end (an angled end resting on a face): the contact is found on the blanks;
     - the blanks overlap there but the wood does not (two mitered boards at a frame corner, whose blanks cross):
       the cut face of the end is looked at, a hair outside the wood, and it touches when the other piece's wood is
       there (endTouchesWood).
   Each tie says which end (cutEnd, endIndex) and keeps the order of the pieces in the design (a, b). */
function shapeEndTies(parts){
  const cut=parts.filter(p=>p.shape&&!tilted(p)&&!isProp(p)&&(shapeEnd(p,0)||shapeEnd(p,1)));
  if(!cut.length)return[];
  const ties=[],seen=new Set();
  const others=parts.filter(p=>!tilted(p)&&!isProp(p));
  if(cut.length*others.length>400000)return[];   // a design that big keeps its blanks (stated limitation)
  const order=new Map(parts.map((p,i)=>[p,i]));
  for(const p of cut){
    const a=jointBox(p),sp=size(p);
    for(const other of others){
      if(other===p)continue;
      const so=size(other);
      // (apart: the usual case)
      if([0,1,2].some(k=>p.pos[k]>other.pos[k]+so[k]+TOUCH_GAP||other.pos[k]>p.pos[k]+sp[k]+TOUCH_GAP))continue;
      const first=order.get(p)<order.get(other);
      const[A,B]=first?[p,other]:[other,p];
      const key=A.id+'-'+B.id;
      if(seen.has(key))continue;
      let endIndex=-1;
      const contact=first?rawJointOfPair(a,jointBox(other)):rawJointOfPair(jointBox(other),a);
      if(contact){
        if(p.ax.indexOf(contact.k)!==0)continue;
        const high=Math.abs(contact.plane-p.pos[contact.k])>1e-6;
        if(shapeEnd(p,high?1:0))endIndex=high?1:0;
      }else{
        // the blanks overlap: a tie when the wood does not, and the other's wood is right at one of p's cut ends
        const overlap=[0,1,2].every(k=>Math.min(p.pos[k]+sp[k],other.pos[k]+so[k])-Math.max(p.pos[k],other.pos[k])>TOUCH_GAP);
        if(!overlap||solidsOverlap(p,other))continue;
        endIndex=[0,1].find(i=>shapeEnd(p,i)&&endTouchesWood(p,i,other));
        if(endIndex===undefined)endIndex=-1;
      }
      if(endIndex<0)continue;
      seen.add(key);
      ties.push({key,a:A,b:B,tie:true,cutEnd:p,endIndex});
    }
  }
  return ties;
}
/* does the cut face of end i of p touch the wood of `other`? Points on the cut, at three depths, moved 1/32" out of
   p (away from its middle along the length), are tested in other's frame. Both are square-set. */
function endTouchesWood(p,i,other){
  const outline=shapeOutline(p),outward=i===1?1:-1;
  for(const s of[p.t*.25,p.t*.5,p.t*.75]){
    const loop=outlineAt(p,s,outline),onEnd=outline.outer.map((q,k)=>q.end===i?loop[k]:null).filter(Boolean);
    // the points of the cut and the middles between them
    const points=[];
    for(let k=0;k<onEnd.length;k++){
      points.push(onEnd[k]);
      if(k+1<onEnd.length)points.push([(onEnd[k][0]+onEnd[k+1][0])/2,(onEnd[k][1]+onEnd[k+1][1])/2]);
    }
    for(const[u,v]of points){
      const world=toWorld(p,[[u+outward/32,Math.max(.01,Math.min(p.w-.01,v)),s]])[0];
      const local=toLocal(other,world);
      if(local[2]<0||local[2]>other.t)continue;
      if(materialAt(other,local[0],local[1],0,local[2]))return true;
    }
  }
  return false;
}
/* Fasteners kept off the openings of a shaped piece (spec 03, 3a). A fastener is looked at where it really is: along
   its shank, inside each shaped piece it passes through or goes into. Every point of the shank there must be wood
   with 3/8" of wood between it and any opening, and between it and any CUT line of the outline (an angled end, a
   rounded corner, a notch; FASTEN.edgeMin, rule 3 of js/fasteners.js). The plain sides of the blank are left to
   the layout itself, which keeps its fasteners off them exactly as it does on a plain piece: a screw into the
   square end of a rail, or into the edge under a deck, sits on that line and is fine.
   One that is not clear is moved along its row in 1/16" steps, up to half the spacing of the row, to the nearest
   clear point; one that finds none is left out (W5, js/shapecheck.js, says so). */

/* is a segment of the outline one of the blank's own sides (both ends on u = 0, u = l, v = 0 or v = w)? */
function onBlankSide(p,a,b){
  const on=(x,y,at)=>Math.abs(x-at)<1e-6&&Math.abs(y-at)<1e-6;
  return on(a[0],b[0],0)||on(a[0],b[0],p.l)||on(a[1],b[1],0)||on(a[1],b[1],p.w);
}
/* is the point (u, v) at depth s wood a fastener may pass through: inside the outline, `margin` clear of every
   opening and of every cut line of the outline (not of the blank's own sides)? */
function woodForFastener(p,u,v,s,margin){
  const outline=shapeOutline(p),loop=outlineAt(p,s,outline);
  if(!pointInLoop(u,v,loop))return false;
  for(let i=0,k=loop.length-1;i<loop.length;k=i++){
    if(onBlankSide(p,loop[k],loop[i]))continue;
    if(distanceToSegment(u,v,loop[k],loop[i])<margin-1e-9)return false;
  }
  for(const ring of outline.openings){
    if(pointInLoop(u,v,ring)||distanceToLoop(u,v,ring)<margin-1e-9)return false;
  }
  return true;
}
/* the part of a straight line (from `start`, along `dir`, `len` long; world or joint frame) that lies inside the
   blank of p, as [t0, t1] along it, or null. The slab test on the blank's box. */
function shankInBlank(p,start,dir,len){
  const s=size(p);
  let t0=0,t1=len;
  for(let k=0;k<3;k++){
    const lo=p.pos[k],hi=p.pos[k]+s[k];
    if(Math.abs(dir[k])<1e-9){
      if(start[k]<lo-1e-9||start[k]>hi+1e-9)return null;
      continue;
    }
    let a=(lo-start[k])/dir[k],b=(hi-start[k])/dir[k];
    if(a>b)[a,b]=[b,a];
    t0=Math.max(t0,a);t1=Math.min(t1,b);
  }
  return t1-t0>1e-6?[t0,t1]:null;
}
/* every straight part of a fastener that goes into the wood: [{pos, dir, len}] (a bracket: its short screws) */
const fastenerShanks=f=>f.kind==='bracket'&&Array.isArray(f.screws)?f.screws:[f];
/* is this fastener clear of the openings and cuts of every shaped piece of the joint? */
function fastenerClear(f,shaped){
  for(const shank of fastenerShanks(f)){
    for(const p of shaped){
      const inside=shankInBlank(p,shank.pos,shank.dir,shank.len);
      if(!inside)continue;                       // it does not reach this piece
      // five points along the part inside, a hair in from where it enters and where it stops
      const from=inside[0]+1e-3,to=inside[1]-1e-3;
      for(let i=0;i<=4;i++){
        const t=to>from?from+(to-from)*i/4:(inside[0]+inside[1])/2;
        const point=[0,1,2].map(k=>shank.pos[k]+shank.dir[k]*t);
        const local=toLocal(p,point);
        if(!woodForFastener(p,local[0],local[1],Math.max(0,Math.min(p.t,local[2])),SHAPE_RULE.safer))return false;
      }
    }
  }
  return true;
}
/* a copy of a fastener moved by `shift` along world axis `axis` (with its pocket, bracket plates and screws) */
function shiftedFastener(f,axis,shift){
  const move=point=>{const out=point.slice();out[axis]+=shift;return out;};
  const copy={...f,pos:move(f.pos)};
  if(f.pocket)copy.pocket={...f.pocket,mouth:move(f.pocket.mouth)};
  if(Array.isArray(f.screws))copy.screws=f.screws.map(screw=>({...screw,pos:move(screw.pos)}));
  if(Array.isArray(f.plates))copy.plates=f.plates.map(plate=>({...plate,c:move(plate.c)}));
  return copy;
}
function keepOffOpenings(j,list){
  if(!list.length||!j.trim)return list;
  const shaped=[j.a,j.b].filter(p=>p.shape);
  const rowAxis=j.ru[1]-j.ru[0]>=j.rv[1]-j.rv[0]?j.u:j.v,row=rowAxis===j.u?j.ru:j.rv;
  const spacing=(row[1]-row[0])/Math.max(1,list.length);
  const kept=[];
  for(const f of list){
    if(fastenerClear(f,shaped)){kept.push(f);continue;}
    // a moved fastener stays in the joint, and no nearer the end of the joint than 3/8" (or than it was laid out)
    const keep=Math.min(SHAPE_RULE.safer,f.pos[rowAxis]-row[0],row[1]-f.pos[rowAxis]);
    let moved=null;
    for(let step=SHAPE_SAMPLE;step<=spacing/2+1e-9&&!moved;step+=SHAPE_SAMPLE){
      for(const sign of[1,-1]){
        const copy=shiftedFastener(f,rowAxis,sign*step),at=copy.pos[rowAxis];
        if(f.kind!=='bracket'&&(at<row[0]+keep-1e-9||at>row[1]-keep+1e-9))continue;
        if(fastenerClear(copy,shaped)){moved=copy;break;}
      }
    }
    if(moved)kept.push(moved);   // else no room anywhere near: left out (W5 when fewer than 2 are left)
  }
  kept.dropped=list.length-kept.length;
  kept.planned=list.length;
  if(list.loose)kept.loose=true;
  return kept;
}
/* After keepOffOpenings, drivableLayout (js/fastenerreach.js) may angle or move the screws of a joint (two boards
   screwed through one divider from its two sides: the second is driven at an angle, from the board into the
   divider), and its copy of the list loses the count first planned. The new places are kept off the openings the
   same way, and the planned count goes with them, so jSpec still buys what is drawn. Called from layoutAsLaidOut
   (js/fasteners.js) only for a joint with a shaped piece whose list drivableLayout changed. */
function keepOffOpeningsAgain(j,list,before){
  const kept=keepOffOpenings(j,list);
  if(kept!==list){
    if(list.loose)kept.loose=true;
    if(list.near)kept.near=list.near;
  }
  const planned=before.planned!==undefined?before.planned:before.length;
  kept.planned=planned;
  kept.dropped=planned-kept.length;
  return kept;
}
/* would this fastener of this joint pass through or beside an opening of one of its shaped pieces? The settling of
   screws that meet (settledLayouts, js/fasteners.js) counts such a place as taken, so a screw is never moved into a
   hole there. A fastener of a turned set is judged with the set standing square, where it was laid out. */
function fastenerInAnOpening(f,joint){
  if(!joint||!joint.shapes)return false;
  if(f.frame&&!squaredNow)return squaredUp(()=>fastenerInAnOpening(f,joint));
  return!fastenerClear(f,[joint.a,joint.b].filter(p=>p.shape));
}
/* jSpec (js/style.js) of a joint with a shaped piece counts the fasteners as they are laid out, so the step words,
   the hardware table and the shopping list buy what is drawn. spec: {text, hw, n} by the rules of thumb; returns
   the same with the count of the layout (and the hardware rows scaled with it), or spec as it was. */
let countingShaped=false;
function shapedSpecAsLaidOut(j,type,spec){
  if(countingShaped||!spec.n||typeof connGraph!=='function'||!S.parts.includes(j.a))return spec;
  countingShaped=true;
  try{
    const link=connGraph().byKey.get(j.key);
    if(!link||!link.joint||link.type!==type||link.joint.a!==j.a||link.joint.b!==j.b)return spec;
    const laid=layoutAsLaidOut(link);
    if(!laid.planned||laid.length===spec.n)return spec;
    const n=laid.length;
    if(!n)return{...spec,n:0,hw:[],text:`No room for ${type==='nail'?'brads':type==='dowel'?'dowels':type==='pocket'?'pocket screws':type==='bracket'?'brackets':'screws'} beside the hole or cut: fasten this joint another way`};
    const hw=spec.hw.map(([label,qty])=>[label,Math.round(qty*n/spec.n)]);
    return{...spec,n,hw,text:spec.text.replace(new RegExp('^'+spec.n+' ×'),n+' ×')};
  }finally{countingShaped=false;}
}
/* do two pieces whose blanks overlap really share wood? (findClashes, js/visibility.js) The overlap box is sampled
   in a grid of at most 16 x 16 x 3 points; a point that is wood in both is a clash. */
function solidsOverlap(a,b){
  const sa=size(a),sb=size(b),lo=[],hi=[];
  for(let k=0;k<3;k++){lo.push(Math.max(a.pos[k],b.pos[k]));hi.push(Math.min(a.pos[k]+sa[k],b.pos[k]+sb[k]));}
  const woodIn=(p,point)=>{
    const local=toLocal(p,point);
    if(local[2]<0||local[2]>p.t)return false;
    // (a point on the very line two cuts share, as at a mitered corner, is in neither)
    return materialAt(p,local[0],local[1],.002,local[2]);
  };
  const n=[16,16,16];
  const thin=[0,1,2].reduce((best,k)=>hi[k]-lo[k]<hi[best]-lo[best]?k:best,0);
  n[thin]=3;
  for(let i=0;i<n[0];i++)for(let k=0;k<n[1];k++)for(let m=0;m<n[2];m++){
    const point=[lo[0]+(hi[0]-lo[0])*(i+.5)/n[0],lo[1]+(hi[1]-lo[1])*(k+.5)/n[1],lo[2]+(hi[2]-lo[2])*(m+.5)/n[2]];
    if(woodIn(a,point)&&woodIn(b,point))return true;
  }
  return false;
}

/* ---------- self-checks (spec 03, section 6) ---------- */
const shapeTestShape=(ends,corners,feats)=>({v:1,ends:ends||[null,null],corners:corners||[null,null,null,null],feats:feats||[]});
const shapeAt=(uFrom,uD,vFrom,vD)=>({u:{from:uFrom,d:uD},v:{from:vFrom===undefined?'mid':vFrom,d:vD||0}});
/* the worked numbers of section 2c, checked by hand */
SELFTESTS.push(function shapeOutlineMath(problems){
  const wrong=text=>problems.push('shape math: '+text);
  const near=(a,b,tol)=>Math.abs(a-b)<=(tol||.001);
  const piece=(mat,l,w,t,shape)=>{const p={id:-1,name:'Test',mat,l,w,t,ax:[0,2,1],pos:[0,0,0],shape};tidyShape(p);return p;};
  // a 2x4 end at 11°: set-back 3.5 tan 11° = 0.6803", written 11/16"
  const leg=piece('2x4',11.5,3.5,1.5,shapeTestShape([{cut:'saw',miter:11,long:0},{cut:'round',r:1.75}]));
  const set=endSetback(leg,0).miterSet;
  if(!near(set,.6803,1e-4)||fmt(set)!=='11/16"')wrong(`an 11° end on a 2x4 sets back ${set.toFixed(4)}" (${fmt(set)}), not 0.6803" (11/16")`);
  // the rounded end at 1 3/4" is one half circle centered 1 3/4" from the end, in the middle
  const arc=endSidePoints(leg.shape.ends[1],null,null,leg.l,leg.w);
  if(!arc.every(q=>near(Math.hypot(q.u-(11.5-1.75),q.v-1.75),1.75,1e-9)))wrong('a 1 3/4" rounded end on a 2x4 is not one half circle');
  // a 1x3 stake pointed at 45°: the sides reach 1 1/4" from the tip, the tip in the middle
  const stake=piece('1x3',72,2.5,.75,shapeTestShape([{cut:'point',deg:45,across:'w'},null]));
  const tip=shapeOutline(stake).outer.find(q=>q.u===0);
  if(!near(endSetback(stake,0).most,1.25)||!tip||!near(tip.v,1.25))wrong('a 1x3 stake pointed at 45° does not reach 1 1/4" with its tip in the middle');
  // the cornhole deck: 24 x 48 x 3/4 with a 6" hole, 1123.73 square inches (the 48-sided hole is 0.3% small), 17.07 lb
  const deck=piece('ply34',48,24,.75,shapeTestShape(null,null,[{kind:'hole',d:6,at:shapeAt(1,9)}]));
  const area=pieceVolume(deck)/.75,pounds=pieceVolume(deck)*WOOD_RULES.DENSITY;
  if(!near(area,1123.73,.1))wrong(`the deck with a 6" hole has ${area.toFixed(2)} sq in of face, not 1123.73`);
  if(pounds.toFixed(2)!=='17.07')wrong(`the deck with a 6" hole weighs ${pounds.toFixed(2)} lb, not 17.07`);
  // the plinko divider: a 45° bevel through 3/4" sets back 0.75"
  const divider=piece('1x3',4.75,2.125,.75,shapeTestShape([null,{cut:'saw',miter:0,bevel:45,bevelLong:1}]));
  if(!near(endSetback(divider,1).bevelSet,.75))wrong('a 45° bevel through 3/4" does not set back 3/4"');
  // compound: 3 1/2" x 1 1/2", miter 30, bevel 45: 2.021" on the face, 1.732" on the edge
  const compound=piece('2x4',24,3.5,1.5,shapeTestShape([{cut:'saw',miter:30,long:0,bevel:45,bevelLong:1},null]));
  const both=endSetback(compound,0);
  if(!near(both.miterSet,2.021)||!near(both.bevelSet,1.732))wrong(`a compound cut sets back ${both.miterSet.toFixed(3)}" and ${both.bevelSet.toFixed(3)}", not 2.021" and 1.732"`);
  // feature centers for every way of measuring
  const p={l:48,w:24};
  const centers=[[shapeAt(0,9),9,12],[shapeAt(1,9),39,12],[shapeAt('mid',-6),18,12],[shapeAt(0,9,0,5),9,5],[shapeAt(0,9,1,5),9,19],[shapeAt(0,9,'mid',3),9,15]];
  for(const[place,u,v]of centers){
    const c=featureCenter(p,{kind:'hole',at:place});
    if(!near(c.u,u)||!near(c.v,v))wrong(`a hole measured ${JSON.stringify(place)} is at (${c.u}, ${c.v}), not (${u}, ${v})`);
  }
  // a leg known by its center line rounds UP to the sixteenth
  const blank=blankLength(10,[{miter:11},null],3.5,1.5);
  if(blank<10+1.75*Math.tan(degToRad(11))||blank*16!==Math.round(blank*16))wrong(`blankLength gives ${blank}, short or not on a sixteenth`);
});
/* mirrored across each world axis (through Mirror) and turned a half and a quarter about each (through setQuat), for
   all six ways a piece can lie: the hole and the long point are where geometry says; mirrored twice is the original */
SELFTESTS.push(function shapeMirrorAndTurn(problems){
  const wrong=text=>problems.push('shape mirror and turn: '+text);
  const kept=JSON.stringify(S),keptSel=sel;
  const perms=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  const shape=shapeTestShape([{cut:'saw',miter:11,long:0,bevel:20,bevelLong:1},null],null,[{kind:'hole',d:.5,at:shapeAt(1,4,0,1)}]);
  const marks=p=>{
    const c=featureCenter(p,p.shape.feats[0]);
    // the hole's center, and the long point of the angled end (wherever the shape now has it)
    const i=shapeEnd(p,0)?0:1,e=shapeEnd(p,i);
    return toWorld(p,[[c.u,c.v,p.t/2],[i?p.l:0,e.long===1?p.w:0,e.bevelLong===1?p.t:0]]);
  };
  const close=(a,b)=>a.every((x,i)=>Math.abs(x-b[i])<1e-6);
  let reported=0;
  const fail=text=>{if(reported++<4)wrong(text);};
  try{
    for(const ax of perms){
      // mirror across each world axis, in place, through the Mirror command's own code
      for(let k=0;k<3;k++){
        load(JSON.stringify(blank()),true);
        const p={name:'Test',mat:'2x4',l:24,w:3.5,t:1.5,ax:ax.slice(),pos:[10,10,10],shape:JSON.parse(JSON.stringify(shape))};
        addParts([p]);sel=new Set([p.id]);
        const before=marks(p),plane=box(p).hi[k];   // (about its top side: mirrored down it would be lifted back onto the floor)
        mirrorSel(k,'hi',false);
        const after=marks(S.parts[0]);
        const want=before.map(q=>q.map((x,i)=>i===k?2*plane-x:x));
        if(!close(after[0],want[0])||!close(after[1],want[1]))fail(`mirrored across axis ${k} lying ${ax.join('')}: the hole or the long point is not the mirror image`);
        mirrorSel(k,'lo',false);
        const tidied={shape:JSON.parse(JSON.stringify(shape))};tidyShape(tidied);
        if(JSON.stringify(S.parts[0].shape)!==JSON.stringify(tidied.shape))fail(`mirrored twice across axis ${k} lying ${ax.join('')} is not the original`);
      }
      // turned a half and a quarter about each axis, through setQuat
      for(let k=0;k<3;k++)for(const turn of[Math.PI,Math.PI/2]){
        const p={id:-1,name:'Test',mat:'2x4',l:24,w:3.5,t:1.5,ax:ax.slice(),pos:[10,10,10],shape:JSON.parse(JSON.stringify(shape))};
        const s0=size(p),center=p.pos.map((x,i)=>x+s0[i]/2),q=new THREE.Quaternion().setFromAxisAngle(AXV[k],turn);
        const want=marks(p).map(point=>{const v=new THREE.Vector3(point[0]-center[0],point[1]-center[1],point[2]-center[2]).applyQuaternion(q);return[v.x+center[0],v.y+center[1],v.z+center[2]];});
        setQuat(p,q);
        const got=marks(p);
        // (setQuat puts the blank on the sixteenth: allow for that)
        const near=(a,b)=>a.every((x,i)=>Math.abs(x-b[i])<1/32);
        if(!near(got[0],want[0])||!near(got[1],want[1]))fail(`turned ${Math.round(turn*180/Math.PI)}° about axis ${k} lying ${ax.join('')}: the hole or the long point moved`);
      }
      // a quarter turn by the buttons of Properties (Spin flat, Tip front/back, Tip sideways: turnQuarter, which
      // turns a piece fastened to nothing by rotatePart): every corner of the solid and the hole where a real
      // +90° turn puts them, not their mirror image
      for(let k=0;k<3;k++){
        load(JSON.stringify(blank()),true);
        const p={name:'Test',mat:'2x4',l:20,w:3.5,t:1.5,ax:ax.slice(),pos:[30,30,30],shape:JSON.parse(JSON.stringify(shape))};
        addParts([p]);sel=new Set([p.id]);
        const s0=size(p),center=p.pos.map((x,i)=>x+s0[i]/2),q=new THREE.Quaternion().setFromAxisAngle(AXV[k],Math.PI/2);
        const turned=point=>{const v=new THREE.Vector3(point[0]-center[0],point[1]-center[1],point[2]-center[2]).applyQuaternion(q);return[v.x+center[0],v.y+center[1],v.z+center[2]];};
        const hole=x=>{const c=featureCenter(x,x.shape.feats[0]);return toWorld(x,[[c.u,c.v,x.t/2]])[0];};
        const wantCorners=toWorld(p,pieceCorners(p)).map(turned),wantHole=turned(hole(p));
        turnQuarter(p,k);
        const gotCorners=toWorld(p,pieceCorners(p)),gotHole=hole(p);
        const apart=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
        let worst=apart(wantHole,gotHole);
        for(const want of wantCorners)worst=Math.max(worst,Math.min(...gotCorners.map(got=>apart(want,got))));
        if(worst>1/32)fail(`a quarter turn about axis ${k} by the Properties buttons, lying ${ax.join('')}: the solid is ${worst.toFixed(3)}" from where the turn puts it (its mirror image?)`);
      }
    }
    // the mirror key of a mirrored copy is the key of the original
    const p={id:-1,name:'Test',mat:'2x4',l:24,w:3.5,t:1.5,ax:[0,2,1],pos:[0,0,0],shape:JSON.parse(JSON.stringify(shape))};
    const twin={...p,shape:flipShape(p.shape,2)};
    if(shapeKeyMirror(twin)!==shapeKey(p)||shapeKey(twin)===shapeKey(p))wrong('the mirror key of a mirrored copy is not the key of the original');
  }finally{
    load(kept,true);sel=keptSel;renderAll();
  }
});
/* copies get their own shapes: by clonePart, by Duplicate, by Copy in a row */
SELFTESTS.push(function shapeCopyIsItsOwn(problems){
  const kept=JSON.stringify(S),keptSel=sel,keptToast=window.toast;
  try{
    load(JSON.stringify(blank()),true);
    const original=mk('Shelf','1x8',[24,.75,7.25],[0,0,0]);
    original.shape=shapeTestShape(null,null,[{kind:'hole',d:1,at:shapeAt('mid',0)}]);
    addParts([original]);sel=new Set([original.id]);
    const changed=copy=>{copy.shape.feats[0].d=2;return original.shape.feats[0].d!==1;};
    if(changed(clonePart(original)))problems.push('shapes: a copy by clonePart shares its hole with the original');
    dupSel();
    const dup=S.parts.find(p=>p.id!==original.id);
    if(!dup||!dup.shape||changed(dup))problems.push('shapes: Duplicate shares the hole of the original');
    sel=new Set([original.id]);
    copyRow(1,2,10);
    const row=S.parts.find(p=>p.pos[2]===10);
    if(!row||!row.shape||changed(row))problems.push('shapes: Copy in a row shares the hole of the original');
  }finally{
    load(kept,true);sel=keptSel;renderAll();
  }
});
/* save and load, undo and redo bring the shapes back; a feature that cannot be read is left out with one message */
SELFTESTS.push(function shapeSaveRoundTrip(problems){
  const kept=JSON.stringify(S);
  try{
    load(JSON.stringify(blank()),true);
    const leg=mk('Leg','2x4',[1.5,11.5,3.5],[0,0,0]);
    leg.shape=shapeTestShape([{cut:'saw',miter:11,long:0,bevel:0,bevelLong:1},{cut:'round',r:1.75}],null,[{kind:'hole',use:'plain',d:.375,at:shapeAt(1,1.75)}]);
    addParts([leg]);commit();
    const text=JSON.stringify(S),shapeText=JSON.stringify(S.parts[0].shape);
    load(text,true);
    if(JSON.stringify(S.parts[0].shape)!==shapeText)problems.push('shapes: a saved shape does not load back the same');
    if(readProject&&!readProject(text))problems.push('shapes: a design with a shape is not read as a project by Paste design');
    S.parts[0].shape.feats.push({kind:'hole',d:1,use:'plain',at:shapeAt(0,4)});commit();
    undo();
    if(S.parts[0].shape.feats.length!==1)problems.push('shapes: undo does not take back a hole');
    redo();
    if(S.parts[0].shape.feats.length!==2)problems.push('shapes: redo does not bring the hole back');
    const bad=JSON.parse(text);
    bad.parts[0].shape.feats.push({kind:'hole',d:-2},{kind:'blob'});
    const lostBefore=shapeLoadLost;
    load(JSON.stringify(bad),true);
    if(shapeLoadLost-lostBefore!==2||S.parts[0].shape.feats.length!==1)problems.push('shapes: features that cannot be read are not left out and counted');
  }finally{
    load(kept,true);
  }
});
/* stretched by its end-1 handle: a hole measured from end 0 stays put, one from end 1 moves with it, a centered one
   stays centered; shortened until the ends cross: a STOP, and the ends are drawn square */
SELFTESTS.push(function shapeResizeKeepsMarks(problems){
  const p={id:-1,name:'Deck',mat:'ply34',l:48,w:24,t:.75,ax:[0,2,1],pos:[0,0,0],
    shape:shapeTestShape(null,null,[{kind:'hole',d:2,at:shapeAt(0,9)},{kind:'hole',d:2,at:shapeAt(1,9)},{kind:'hole',d:2,at:shapeAt('mid',0)}])};
  const centers=()=>p.shape.feats.map(f=>toWorld(p,[[featureCenter(p,f).u,12,0]])[0][0]);
  const before=centers();
  p.l=60;   // the end-1 handle moves end 1 by 12"
  const after=centers();
  if(Math.abs(after[0]-before[0])>1e-9||Math.abs(after[1]-before[1]-12)>1e-9||Math.abs(after[2]-before[2]-6)>1e-9)
    problems.push('shapes: stretching a deck does not keep each hole where it was measured from');
  const short={id:-1,name:'Rail',mat:'2x4',l:4,w:3.5,t:1.5,ax:[0,2,1],pos:[0,0,0],shape:shapeTestShape([{cut:'saw',miter:45,long:0},{cut:'saw',miter:45,long:1}])};
  if(!shapePieceFindings(short).some(f=>f.level==='stop'&&f.code==='shape-ends-meet'))problems.push('shapes: ends that cross give no STOP');
  if(shapeOutline(short).outer.length!==4)problems.push('shapes: ends that cross are not drawn square');
});
/* contacts with shaped pieces: a deck with a 6" hole on rails, a rail wholly under the hole, an angled end on a face */
SELFTESTS.push(function shapeContacts(problems){
  const wrong=text=>problems.push('shape contacts: '+text);
  const kept=JSON.stringify(S);
  try{
    load(JSON.stringify(blank()),true);
    // the deck lies flat, 48" along x, 24" deep; its hole is 9" from the right end, centered: x 39, z 12, 6" across
    const deck=mk('Deck','ply34',[48,.75,24],[0,3.5,0]);
    deck.shape=shapeTestShape(null,null,[{kind:'hole',d:6,at:shapeAt(1,9)}]);
    const across=mk('Rail','2x4',[1.5,3.5,24],[38.25,0,0]);     // runs front to back right under the hole's middle
    const under=mk('Block','2x4',[1.5,3.5,3],[38.25,0,10.5]);   // wholly under the hole
    const side=mk('Side','2x4',[48,3.5,1.5],[0,0,0]);           // along the back, far from the hole
    addParts([deck,across,side]);
    tidyShapes();
    const jointWith=p=>findJoints().find(j=>(j.a===deck&&j.b===p)||(j.b===deck&&j.a===p));
    const crossing=jointWith(across);
    if(!jointWith(side))wrong('the deck and a rail along its back do not meet');
    if(!crossing)wrong('a rail crossing under the hole does not meet the deck on either side of it');
    else{
      S.joints[crossing.key]='screw';
      for(const f of fastenerLayout(crossing,'screw')){
        const d=Math.hypot(f.pos[0]-39,f.pos[2]-12);
        if(d<3+SHAPE_RULE.safer-1e-6)wrong(`a screw lands ${fmt(Math.max(0,d-3))} from the edge of the hole`);
      }
    }
    // the layout is worked out again when a hole is added under the screws of the back rail
    S.joints[jointWith(side).key]='screw';commit();
    const backLink=connGraph().links.find(l=>l.joint&&(l.a===side||l.b===side));
    const screwsBefore=fastenersOfLink(backLink).map(f=>f.pos[0]);
    deck.shape.feats.push({kind:'hole',d:2,use:'plain',at:{u:{from:0,d:screwsBefore[0]},v:{from:0,d:1.5}}});commit();
    const link=connGraph().links.find(l=>l.joint&&(l.a===side||l.b===side));
    if(link&&fastenersOfLink(link).some(f=>Math.hypot(f.pos[0]-screwsBefore[0],f.pos[2]-1.5)<1+SHAPE_RULE.safer-1e-6))wrong('a hole added under a screw left the screw in the hole');
    // a block wholly under the hole: no joint
    load(JSON.stringify(blank()),true);
    const deck2=JSON.parse(JSON.stringify(deck));delete deck2.id;
    deck2.shape.feats=deck2.shape.feats.slice(0,1);
    addParts([deck2,under]);tidyShapes();
    if(findJoints().length)wrong('a block wholly under the hole is found as a joint');
    // an end cut at an angle resting on a face: a tie, and W6
    load(JSON.stringify(blank()),true);
    const post=mk('Post','2x4',[3.5,24,1.5],[0,0,0]);
    post.shape=shapeTestShape([null,{cut:'saw',miter:30,long:0}]);
    const top=mk('Top','1x6',[20,.75,5.5],[0,24,0]);
    addParts([post,top]);tidyShapes();
    if(findJoints().some(j=>j.a===post||j.b===post))wrong('an end cut at an angle is found as a square joint');
    if(!findAngledTies(S.parts).some(t=>t.cutEnd===post))wrong('an end cut at an angle on a face is not a tie');
    if(!shapeFindings(S.parts).some(f=>f.code==='shape-tie'))wrong('an end cut at an angle on a face gives no W6');

    // a shaped rail butted into a leg keeps its screws: they go into its square end, which is plain wood, whatever
    // is cut elsewhere in the rail (a hole in its middle, a rounded far end)
    const railCase=(shapeIt,oneLeg)=>{
      load(JSON.stringify(blank()),true);
      addParts([mk('Leg','2x4',[1.5,30,3.5],[0,0,0]),mk('Rail','1x4',[24,3.5,.75],[1.5,20,0])]);
      if(!oneLeg)addParts([mk('Leg','2x4',[1.5,30,3.5],[25.5,0,0])]);
      commit();
      shapeIt(S.parts[1]);commit();
      const links=connGraph().links.filter(l=>l.joint);
      return{links,laid:links.map(l=>fastenersOfLink(l).length),spec:links.map(l=>jSpec(l.joint,l.type).n),
        bought:(hardwareTotals(findJoints()).rows.find(r=>/wood screws/.test(r[0]))||[0,0])[1]};
    };
    const middleHole=railCase(p=>addHole(p,{d:1,at:{u:{from:'mid',d:0},v:{from:'mid',d:0}}}));
    if(middleHole.laid.join()!=='2,2'||middleHole.spec.join()!=='2,2'||middleHole.bought!==4)wrong(`a rail with a 1" hole in its middle butted between two legs has ${middleHole.laid.join(' and ')} screws laid out, ${middleHole.spec.join(' and ')} in the words, ${middleHole.bought} bought (2, 2 and 4)`);
    // (with its far end rounded it is butted into one leg: the rounded end touches nothing)
    const roundFar=railCase(p=>roundEnd(p,'high',1.75),true);
    if(roundFar.laid.join()!=='2'||roundFar.spec.join()!=='2'||roundFar.bought!==2)wrong(`a rail with a rounded far end butted into a leg has ${roundFar.laid.join(' and ')} screws laid out, ${roundFar.spec.join(' and ')} in the words, ${roundFar.bought} bought (2, 2 and 2)`);
    // a 2 1/2" hole right at the end leaves no room: none laid out, the words and the shopping list say so, and W5
    const tight=railCase(p=>addHole(p,{d:2.5,at:{u:{from:0,d:1.75},v:{from:'mid',d:0}}}));
    const atHole=tight.links.findIndex(l=>l.a.pos[0]===0||l.b.pos[0]===0);
    if(tight.laid[atHole]!==0||tight.spec[atHole]!==0||tight.bought!==2)wrong(`a rail end with a 2 1/2" hole has ${tight.laid[atHole]} screws laid out, ${tight.spec[atHole]} in the words, ${tight.bought} bought (0, 0 and 2)`);
    if(!verifyDesign(S.parts).problems.some(f=>f.code==='shape-fasteners'&&/2 of the 2 screws/.test(f.text)))wrong('screws left out beside a hole give no W5');
    // the cornhole deck on two side rails: a 3/8" pivot hole near the end of one rail keeps all 6 deck screws in it
    load(JSON.stringify(blank()),true);
    addParts([mk('Rail','2x4',[48,3.5,1.5],[0,0,0]),mk('Rail','2x4',[48,3.5,1.5],[0,0,22.5]),mk('Deck','ply34',[48,.75,24],[0,3.5,0])]);commit();
    addHole(S.parts[0],{d:.375,at:{u:{from:0,d:1.75},v:{from:'mid',d:0}}});commit();
    const deckScrews=connGraph().links.filter(l=>l.joint).map(l=>fastenersOfLink(l).length).join();
    if(deckScrews!=='6,6')wrong(`a 3/8" hole near the end of a cornhole side rail leaves ${deckScrews} deck screws, not 6 and 6`);
    // the angled end of a rail on a leg: no "touches nothing" beside W6, which says the same thing truly
    load(JSON.stringify(blank()),true);
    addParts([mk('Leg','2x4',[1.5,30,3.5],[0,0,0]),mk('Rail','1x4',[24,3.5,.75],[1.5,20,0])]);
    sawEnd(S.parts[1],'low',30,0);commit();
    const said=verifyDesign(S.parts).problems;
    if(said.some(f=>f.code==='floating'))wrong('an angled end that touches a leg is also called floating');
    if(!said.some(f=>f.code==='shape-tie'))wrong('an angled end that touches a leg gives no W6');
    // two 45° mitered 1x4s at a corner, whose blanks cross: a tie with W6, not a joint, not a clash
    load(JSON.stringify(blank()),true);
    addParts([mk('Front','1x4',[24,.75,3.5],[0,0,0]),mk('Side','1x4',[3.5,.75,24],[20.5,0,0])]);
    sawEnd(S.parts[0],'high',45,0);sawEnd(S.parts[1],'low',45,1);commit();
    if(findClashes().length)wrong('two mitered 1x4s at a corner show as an overlap');
    if(!findAngledTies(S.parts).some(t=>t.a===S.parts[0]&&t.b===S.parts[1]))wrong('two mitered 1x4s at a corner are not tied together');
    if(!verifyDesign(S.parts).problems.some(f=>f.code==='shape-tie'))wrong('two mitered 1x4s at a corner give no W6');
    // pulled 1/8" apart they do not touch: no tie
    S.parts[1].pos[0]+=.125;commit();
    if(findAngledTies(S.parts).length)wrong('two mitered 1x4s 1/8" apart are still tied');
  }finally{
    load(kept,true);
  }
});
/* A shelf screwed to the far side of a divider gets its screws driven at an angle, from the shelf into the divider
   (drivableLayout, js/fastenerreach.js), after keepOffOpenings has looked at them. A hole in the shelf right where
   an angled screw goes in, and a bigger one over both: every screw drawn keeps off the hole, can be driven, and the
   shopping list counts what is drawn. (Found when this branch was merged with main: one angled screw went straight
   through a 1/2" hole.) */
SELFTESTS.push(function shapeHolesBesideAngledScrews(problems){
  const wrong=text=>problems.push('shape holes beside angled screws: '+text);
  const preset=PRESETS.find(p=>p.name==='Bookshelf');
  if(!preset||typeof drivableLayout!=='function')return;
  const kept=JSON.stringify(S);
  try{
    for(const hole of[{d:.5,at:shapeAt(0,.9,0,3.56)},{d:3,at:shapeAt(0,1.9,'mid',0)}]){
      load(JSON.stringify(blank()),true);
      const vals={...presetDefaults(preset),W:40};
      placePreset(preset,vals,preset.build(vals)||[],false);
      const divider=S.parts.find(p=>p.name==='Divider');
      const shelf=divider&&S.parts.find(p=>p.name==='Shelf'&&p.pos[0]>divider.pos[0]);
      if(!shelf){wrong('a 40" bookshelf has no shelf right of its divider');return;}
      shelf.shape=shapeTestShape(null,null,[{kind:'hole',use:'plain',...hole}]);
      commit();
      const link=connGraph().links.find(l=>l.joint&&l.fastened&&l.joint.shapes&&
        [l.joint.a,l.joint.b].includes(divider)&&[l.joint.a,l.joint.b].includes(shelf));
      if(!link){wrong(`the shelf with a ${fmt(hole.d)} hole is not fastened to the divider`);continue;}
      const drawn=fastenersOfLink(link);
      if(!drawn.some(f=>f.toe))wrong('the shelf right of the divider has no screws driven at an angle (the case this checks)');
      drawn.forEach((f,i)=>{
        if(fastenerInAnOpening(f,link.joint))wrong(`screw ${i+1} of the shelf goes through or beside its ${fmt(hole.d)} hole`);
        const fault=fastenerFault(f);
        if(fault)wrong(`screw ${i+1} beside the ${fmt(hole.d)} hole: ${fault}`);
      });
      const spec=jSpec(link.joint,link.type);
      if(spec.n!==drawn.length)wrong(`beside a ${fmt(hole.d)} hole the list buys ${spec.n} screws and ${drawn.length} are drawn`);
    }
  }finally{
    load(kept,true);
  }
});
/* overlaps: a board in the cut-off corner of another, two mitered 1x4s at a corner, and two plain boards */
SELFTESTS.push(function shapeClashes(problems){
  const kept=JSON.stringify(S);
  try{
    load(JSON.stringify(blank()),true);
    const panel=mk('Panel','ply34',[12,.75,12],[0,0,0]);
    panel.shape=shapeTestShape(null,[{cut:'clip',a:6,b:6},null,null,null]);
    const block=mk('Block','2x2',[1.5,.75,1.5],[.25,0,.25]);
    addParts([panel,block]);tidyShapes();
    if(findClashes().length)problems.push('shapes: a block in the cut-off corner of a panel shows as an overlap');
    load(JSON.stringify(blank()),true);
    const a=mk('Front','1x4',[20,.75,3.5],[0,0,0]),b=mk('Side','1x4',[3.5,.75,20],[16.5,0,0]);
    a.shape=shapeTestShape([null,{cut:'saw',miter:45,long:0}]);
    b.shape=shapeTestShape([{cut:'saw',miter:45,long:1},null]);
    addParts([a,b]);tidyShapes();
    if(findClashes().length)problems.push('shapes: two mitered 1x4s meeting at a corner show as an overlap');
    load(JSON.stringify(blank()),true);
    addParts([mk('One','1x4',[20,.75,3.5],[0,0,0]),mk('Two','1x4',[3.5,.75,20],[16.5,0,0])]);
    if(findClashes().length!==1)problems.push('shapes: two plain boards that overlap are no longer an overlap');
  }finally{
    load(kept,true);
  }
});
/* every trade word the shape words use is explained for a beginner */
SELFTESTS.push(function shapeWordsExplained(problems){
  if(typeof TERMS==='undefined')return;
  for(const word of['Miter','Bevel','Long point','Blank','Rounded end','Hole saw','Spade bit','Forstner bit','Starter hole','Compass','Jigsaw','Speed square','Notch','Slot','Cut-out']){
    if(!TERMS.some(t=>t.word===word))problems.push(`shapes: the word "${word}" has no entry in TERMS (js/glossary.js)`);
    if(typeof WORD_LINKS!=='undefined'&&!WORD_LINKS.some(link=>link.word===word))problems.push(`shapes: the word "${word}" is not linked on the pages (WORD_LINKS)`);
  }
});

/* ---------- the presets stay as they were ----------
   The fingerprint of every preset at its default sizes, recorded on main without the shaped-piece code (first on
   40ae483; recorded again on main 60c552b and then cb67847 when this branch was merged with them, because main's own
   fastening, rack and overall-size work had legitimately changed some presets since; each time from an empty design,
   twice, with the same result):
   [pieces, joints, fasteners laid out, hash of the cut list rows and the weight, hash of the 3D scene (each mesh's
   vertex count, place and turn)]. presetsKeepTheirCutLists fails when any of them changes, so a change made for
   shaped pieces cannot move, add or drop anything in a design that has none. When main changes a preset on purpose,
   record these again from main's own code, never from this file's. (Main 63756c1 added the "Cabinet / case" entry;
   its fingerprint was recorded there the same way, and the other 22 read back from main 63756c1 exactly as below.) */
const PRESET_PRINTS={
  "Fish tank wall / rack":[94,178,352,"131vjz0","1ej6odg"],
  "Single aquarium stand":[26,86,169,"v10vc9","1636v6l"],
  "Cabinet stand with a row of tanks":[33,98,243,"1pnhk3","yxrr1s"],
  "Platform bed":[28,95,142,"1hachhz","1agns1k"],
  "Shed":[124,356,1407,"1fct8b8","t4pvx6"],
  "Bird feeder":[9,12,16,"1mh07bv","3ds3br"],
  "Bookshelf":[11,27,102,"1haojk5","wytljj"],
  "Dining table":[15,35,60,"10rz846","1qqg79y"],
  "Coffee table":[25,55,94,"1mt3rdl","ljvb7v"],
  "Side table / nightstand":[11,22,26,"dt5pnd","45r6gd"],
  "Desk":[10,19,44,"e9zf5h","1xev6rg"],
  "Sturdy bench":[12,23,42,"woskta","1gnz2ol"],
  "Five-board bench":[5,8,20,"dbcrj0","1hvsbq8"],
  "Workbench":[19,49,115,"d4wis","uaazbz"],
  "Garage shelves":[28,92,194,"ohine2","1klmv0d"],
  "Storage box / toy chest":[6,12,28,"1j7e04h","1w8rx6u"],
  "Planter box":[20,62,78,"w1hui8","1vjtz3k"],
  "Raised garden bed":[12,28,48,"urv8mo","yfeo9i"],
  "Entryway shoe bench":[24,54,94,"18cr36y","i0c8pa"],
  "Base cabinet with doors":[13,33,88,"f994ew","1rj8jrf"],
  "Wall shelf":[4,5,14,"171rfgs","s79we0"],
  "Nightstand with drawers":[21,43,94,"1amjky2","uhgody"],
  "Cabinet / case":[10,24,77,"1pz6vmn","963zac"],
};
/* a project saved before shaped pieces existed, and the hash of how it reads back (recorded on main 60c552b and cb67847 the same
   way: main's loading now adds fields of its own, so the text read back is longer than it was on 40ae483) */
const OLD_PROJECT_TEXT='{"name":"Old saved project","parts":[{"id":1,"name":"Leg","mat":"2x4","l":30,"w":3.5,"t":1.5,"ax":[1,2,0],"pos":[0,0,0]},{"id":2,"name":"Top","mat":"ply34","l":24,"w":18,"t":0.75,"ax":[0,2,1],"pos":[0,30,0]},{"id":3,"name":"Brace","mat":"1x4","l":20,"w":3.5,"t":0.75,"ax":[0,1,2],"pos":[2,10,4],"rot":{"k":2,"deg":30}}],"joints":{},"stock":{},"notes":[],"steps":[],"hw":[],"nextId":4,"nextGrp":1}';
const OLD_PROJECT_PRINT=['7qjr6r',477];

/* a short hash of a text (FNV-1a), written in base 36 */
function printHash(text){
  let h=2166136261;
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,16777619)>>>0;
  }
  return h.toString(36);
}
/* the fingerprint of one preset at its defaults (it is placed as the design, so the caller keeps the design) */
function presetPrint(preset){
  load(JSON.stringify(blank()),true);   // from an empty design, so piece numbers do not depend on what was open
  const vals=presetDefaults(preset);
  placePreset(preset,vals,preset.build(vals)||[],false);
  const joints=findJoints();
  let fasteners=0;
  for(const joint of joints){
    const type=jType(joint);
    if(type!=='none')fasteners+=fastenerLayout(joint,type).length;
  }
  const list=cutRows();
  const cut=list.rows.map(g=>[g.id,g.mat,g.l,g.w,g.t,g.deg,g.qty].join(',')).join(';')+'|'+list.pounds.toFixed(2);
  rebuildScene();
  const round=x=>Math.round(x*1000)/1000,scene=[];
  S.parts.forEach((p,index)=>{
    const group=meshes.get(p.id);
    if(!group)return;
    const geometry=group.children[0].geometry,at=group.position,turn=group.quaternion;
    scene.push([index,p.name,geometry.attributes.position.count,round(at.x),round(at.y),round(at.z),round(turn.x),round(turn.y),round(turn.z),round(turn.w)].join(','));
  });
  return[S.parts.length,joints.length,fasteners,printHash(cut),printHash(scene.join(';'))];
}
SELFTESTS.push(function presetsKeepTheirCutLists(problems){
  const kept=JSON.stringify(S);
  try{
    for(const preset of PRESETS){
      const want=PRESET_PRINTS[preset.name];
      if(!want){problems.push(`shapes: ${preset.name} has no recorded fingerprint (PRESET_PRINTS, js/shapes.js)`);continue;}
      let got=presetPrint(preset);
      // (once, on main, the very first pass of a fresh page gave one different layout; a second look settles it)
      if(JSON.stringify(got)!==JSON.stringify(want))got=presetPrint(preset);
      if(S.parts.some(p=>'shape' in p))problems.push(`shapes: ${preset.name} builds a piece with a shape`);
      const names=['pieces','joints','fasteners','cut list','3D scene'];
      got.forEach((value,i)=>{
        if(value!==want[i])problems.push(`shapes: ${preset.name} changed its ${names[i]} (${value}, was ${want[i]})`);
      });
    }
    // an old saved project reads back exactly as it did before shapes existed, and saves back unchanged
    load(OLD_PROJECT_TEXT,true);
    const text=JSON.stringify(S);
    if(printHash(text)!==OLD_PROJECT_PRINT[0]||text.length!==OLD_PROJECT_PRINT[1])problems.push('shapes: an old saved project does not read back as it did before');
    load(text,true);
    if(JSON.stringify(S)!==text)problems.push('shapes: an old saved project does not save back byte for byte');
  }finally{
    load(kept,true);
  }
});
