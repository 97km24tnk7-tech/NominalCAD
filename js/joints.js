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
/* The joint where the faces of two square-set pieces touch, or null when they do not.
   a and b are {p, lo, hi, s}: the piece, its min and max corners, and its size (jointBox makes one).
   The piece that comes first in the design must be a, so that the joint's key is always the same. */
const jointBox=p=>{const s=size(p);return{p,lo:p.pos,hi:p.pos.map((v,i)=>v+s[i]),s};};
function jointBetween(a,b){
  for(let k=0;k<3;k++){let plane=null;
    if(Math.abs(a.hi[k]-b.lo[k])<.02)plane=a.hi[k];else if(Math.abs(b.hi[k]-a.lo[k])<.02)plane=a.lo[k];
    if(plane===null)continue;
    const[u,v]=[0,1,2].filter(x=>x!==k);
    const ru=[Math.max(a.lo[u],b.lo[u]),Math.min(a.hi[u],b.hi[u])],rv=[Math.max(a.lo[v],b.lo[v]),Math.min(a.hi[v],b.hi[v])];
    if(ru[1]-ru[0]<.1||rv[1]-rv[0]<.1)continue;
    return{key:a.p.id+'-'+b.p.id,a:a.p,b:b.p,k,u,v,ru,rv,plane,fa:faceType(a.p,k),fb:faceType(b.p,k),da:a.s[k],db:b.s[k]};}
  return null;
}
/* every joint in the design, or in the list of pieces given (js/verify.js finds the same joints with a faster sweep) */
function findJoints(list){
  const out=[],B=(list||S.parts).filter(p=>!isProp(p)&&!tilted(p)).map(jointBox);
  for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){const joint=jointBetween(B[i],B[j]);if(joint)out.push(joint);}
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
