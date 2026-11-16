/* NominalCAD: finding where pieces touch and choosing fasteners */
'use strict';
/* ---------- joints ---------- */
const JTYPES={screw:['Wood screws',0x333333,'Drill a pilot hole first so the wood does not split. A thin line of glue makes it much stronger.'],
 pocket:['Pocket-hole screws',0x1e88e5,'Needs a pocket-hole jig. Drill the angled holes on the hidden side, clamp, then drive the screws.'],
 dowel:['Dowels + glue',0x8d5524,'Drill matching holes in both pieces (a dowel jig helps), glue, tap together and clamp.'],
 nail:['Brad nails + glue',0x888888,'Glue does the holding; brads just keep things in place while it dries.'],
 bracket:['L-brackets',0xe53935,'Easiest joint there is: screw a metal corner bracket into both pieces on the hidden side.'],
 glue:['Glue only',0xf9a825,'Spread glue evenly and clamp for at least 30 minutes. Good for edge-to-edge and face-to-face.'],
 // nails for stud walls, floor frames and roofs (js/framing.js works out the words and the count)
 frame:['Framing nails',0x6d4c41,'For stud walls, floor frames and roofs. The nail goes straight through one piece into the other. Plywood is nailed by spacing: closer along the edges of a sheet.'],
 toenail:['Nails driven at an angle',0x00897b,'For a piece that stands on another one and cannot be nailed through it. Start each nail in the side of the piece, about 1" up, and slant it down into the piece below.'],
 none:['Not joined',0,'These pieces only touch.']};
const SCREWS=[[1,'1"'],[1.25,'1-1/4"'],[1.625,'1-5/8"'],[2,'2"'],[2.5,'2-1/2"'],[3,'3"'],[3.5,'3-1/2"']];
const BRADS=[[.625,'5/8"'],[.75,'3/4"'],[1,'1"'],[1.25,'1-1/4"'],[1.5,'1-1/2"'],[2,'2"']];
const pickLE=(arr,x)=>{let r=arr[0];for(const a of arr)if(a[0]<=x+.13)r=a;return r;};
function faceType(p,k){const m=M[p.mat];if(p.ax[2]===k)return'face';if(p.ax[1]===k)return isSquare(m)?'face':'edge';return m.kind==='sheet'?'edge':'end';}
/* Every joint in the design, or in the list of pieces given (a builder's own pieces, before they are in the
   design). The quick search is in js/neighbors.js; it is checked against the plain one below. */
function findJoints(list){return findJointsFast(list||S.parts);}
/* a piece as jointOfPair (js/neighbors.js) needs it: {p, lo, hi, s}. The joint between two given boxes is
   jointOfPair(a, b), with the piece that comes first in the design as a; between two pieces of the design it
   is jointBetween(pieceA, pieceB). */
const jointBox=p=>{const s=size(p);return{p,lo:p.pos,hi:p.pos.map((v,i)=>v+s[i]),s};};
function findJointsAllPairs(){
  const out=[],ps=S.parts.filter(p=>!isProp(p)&&!tilted(p)),B=ps.map(p=>{const s=size(p);return{p,lo:p.pos,hi:p.pos.map((v,i)=>v+s[i]),s};});
  for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){const a=B[i],b=B[j];
    for(let k=0;k<3;k++){let plane=null;
      if(Math.abs(a.hi[k]-b.lo[k])<.02)plane=a.hi[k];else if(Math.abs(b.hi[k]-a.lo[k])<.02)plane=a.lo[k];
      if(plane===null)continue;
      const[u,v]=[0,1,2].filter(x=>x!==k);
      const ru=[Math.max(a.lo[u],b.lo[u]),Math.min(a.hi[u],b.hi[u])],rv=[Math.max(a.lo[v],b.lo[v]),Math.min(a.hi[v],b.hi[v])];
      if(ru[1]-ru[0]<.1||rv[1]-rv[0]<.1)continue;
      out.push({key:a.p.id+'-'+b.p.id,a:a.p,b:b.p,k,u,v,ru,rv,plane,fa:faceType(a.p,k),fb:faceType(b.p,k),da:a.s[k],db:b.s[k]});
      break;}}
  return out;
}
/* The fastener a preset names for this joint in its `joints` list, or '' when it names none.
   A row is [pieceNameA, pieceNameB, type] and may carry a fourth part, 'faceOfA-faceOfB', for two kinds of piece
   that meet in more than one way: ['Post','Shelf deck','none','face-edge'] is only the joint where the face of a
   post lies against the edge of a deck (they only touch there), and leaves alone the deck that lies on top of
   the posts ('end-face'). The first row that fits wins, so a row with a fourth part goes above a general one.
   placePreset (js/app.js) and the structural check (js/verify.js) both read the list through this. */
function namedJointType(j,list){
  for(const[a,b,type,how]of list||[]){
    const straight=j.a.name===a&&j.b.name===b,swapped=j.a.name===b&&j.b.name===a;
    if(!straight&&!swapped)continue;
    if(!how)return type;
    if((straight&&how===j.fa+'-'+j.fb)||(swapped&&how===j.fb+'-'+j.fa))return type;
  }
  return'';
}
/* Stores the fasteners a preset names for its own pieces like fasteners chosen by hand (S.joints). parts: the
   pieces of this placement, already in the design. Only joints between two of them are touched, so "Add beside
   the current design" leaves the design that was there alone. placePreset (js/app.js) calls it, and so do the
   self-checks that place a preset without the dialog (placeForCheck, js/fasteners.js). */
function storeNamedJoints(preset,parts){
  if(!preset.joints)return;
  const own=new Set(parts);
  for(const j of findJoints()){
    if(!own.has(j.a)||!own.has(j.b))continue;
    const type=namedJointType(j,preset.joints);   // the first row of the list that fits
    if(!type)continue;
    S.joints[j.key]=type;
    // What the preset named is also kept apart from what the person chooses later (S.named). Unfasten stores
    // "Not joined", and that is forgotten when the two pieces part (rule 2 in js/connections.js); the preset's
    // own word for the joint comes back then, so a countertop that was lifted off and set down again is
    // fastened the way the preset fastens it, and not screwed to the sides it only rests on.
    if(!S.named||typeof S.named!=='object')S.named={};
    S.named[j.key]=type;
  }
}
function thruPart(j){ // the piece a fastener passes through first
  if(j.fa==='face'&&j.fb==='face')return j.da<=j.db?'a':'b';
  return j.fa==='face'?'a':j.fb==='face'?'b':null;
}
function defaultType(j){
  const th=thruPart(j);
  if(/^(Lid|Door)$/.test(j.a.name)||/^(Lid|Door)$/.test(j.b.name))return'none'; // lids lift off, doors hang on hinges
  if(!th)return(j.fa==='edge'&&j.fb==='edge')?(j.k===1?'none':'glue'):'pocket'; // boards stacked on edge just rest on each other
  const tp=j[th],d=th==='a'?j.da:j.db,ot=th==='a'?j.b:j.a,of=th==='a'?j.fb:j.fa;
  if(d<=.3)return'nail';
  if(M[ot.mat].kind==='sheet'&&of==='edge'&&ot.t<=.3)return'none'; // nothing holds in the edge of a 1/4 in panel
  if(M[ot.mat].kind==='sheet'&&of==='edge'&&ot.t<=.5&&isSquare(M[tp.mat]))return'none'; // thin panel just butting a leg
  if(isSquare(M[tp.mat])&&!(j.fa==='face'&&j.fb==='face'&&isSquare(M[j.a.mat])&&isSquare(M[j.b.mat])))return'pocket';
  if(d>1.6)return'pocket';
  return'screw';
}

/* self-check: a row of a preset's joints list with a fourth part fits only the joint where the pieces meet that way */
SELFTESTS.push(function namedJointsByHowTheyMeet(problems){
  const post=mk('Post','2x4',[1.5,30,3.5],[0,0,0]);
  const beside=mk('Shelf deck','ply12',[20,.5,3.5],[1.5,10,0]),onTop=mk('Shelf deck','ply12',[20,.5,3.5],[0,30,0]);
  [post,beside,onTop].forEach((piece,index)=>{piece.id=index+1;});
  const joints=findJoints([post,beside,onTop]);
  const edge=joints.find(j=>j.b===beside),top=joints.find(j=>j.b===onTop);
  const list=[['Shelf deck','Post','none','edge-face'],['Post','Shelf deck','screw']];
  if(!edge||!top)problems.push('named joints: the two test joints were not found');
  else if(namedJointType(edge,list)!=='none'||namedJointType(top,list)!=='screw'||namedJointType(top,[['Post','Rail','glue']])!=='')problems.push('named joints: a row with a fourth part must fit only the joint where the pieces meet that way');
});
