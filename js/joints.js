/* NominalCAD: finding where pieces touch and choosing fasteners */
'use strict';
/* ---------- joints ---------- */
const JTYPES={screw:['Wood screws',0x333333,'Drill a pilot hole first so the wood does not split. A thin line of glue makes it much stronger.'],
 // a wood screw whose head is hidden: sunk in a 3/8" counterbore under a glued wooden plug (filler under paint)
 plug:['Screws, heads plugged',0x6d4c2f,'Drill a 3/8" hole for each head (a counterbore, 3/8" deep, or as deep as the list says), drive the screw, glue in a wooden plug (in a deeper hole, a piece of 3/8" dowel rod) and saw it flush when the glue is dry. Under paint, a 3/8" deep hole is filled with wood filler instead.'],
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
/* ---------- fasteners that follow the build style ----------
   Furniture for the house is fastened so that nothing shows on its top or its front, unless the person picked the
   Rustic / rough style, where screw heads on top are the look (the owner: "we don't want furniture looking THAT
   rough ... unless you set the style to rough/rustic"). A preset says so for a joint by naming one of these rules
   in its `joints` list instead of a fastener type: ['Top','Long apron','pocketUnlessRustic'].
   Such a joint is not stored like a choice made by hand (S.joints): it is kept in S.styled[key] as the rule, and the
   fastener is read from the style every time (suggestedType). So changing the style on the style cards changes
   these joints at once, everywhere, while a fastener picked by hand in Properties or on the Fasteners tab still
   wins over the rule. Each rule gives the fastener for each key of STYLES (js/style.js). */
const STYLE_RULES={
  // a top held on from underneath (pocket holes in the apron or rail under it, driven up into the top);
  // Rustic screws it down through its face. Also a rail held from its own inside face, not through the front.
  pocketUnlessRustic:{rustic:'screw',std:'pocket',fine:'pocket'},
  // a top that only rests on the end of a leg (the aprons carry it); Rustic screws down into the leg too
  restsUnlessRustic:{rustic:'screw',std:'none',fine:'none'},
  // a metal corner bracket on the inside of a frame, where no pocket hole can be drilled (a 4x4 leg);
  // Rustic screws straight through from outside
  bracketUnlessRustic:{rustic:'screw',std:'bracket',fine:'bracket'},
  // a shop top screwed down so it can be replaced when it wears; in Fine furniture it only rests on the legs
  // (the aprons and rails hold it from below there)
  restsInFine:{rustic:'screw',std:'screw',fine:'none'},
  // an apron too short for pocket holes at both ends and the holes for the top as well (TABLE_KINDS: shortEnds):
  // screwed through the leg from the end of the piece, and doweled in Fine furniture
  doweledInFine:{rustic:'screw',std:'screw',fine:'dowel'},
  // the top and the foot of an upright of a fish rack where it meets a rail: pocket screws, but in Fine furniture,
  // where the cross pieces are held to the rails by pocket screws of their own that pass the same spot inside the
  // rail, an L-bracket on the inside of the corner (js/builders-fish.js, RACK_JOINTS)
  bracketInFine:{rustic:'pocket',std:'pocket',fine:'bracket'},
  // a joint that takes a screw through a show face and has no hidden way that is as strong (a bed rail to its
  // leg): the head is sunk and covered by a glued wooden plug (filler under paint); Rustic leaves it showing
  pluggedUnlessRustic:{rustic:'screw',std:'plug',fine:'plug'}
};
const isStyleRule=type=>typeof type==='string'&&Object.prototype.hasOwnProperty.call(STYLE_RULES,type);
/* the fastener a type or a rule stands for in this style ('std' when none is given and there is no design yet) */
function typeForStyle(type,style){
  if(!isStyleRule(type))return type;
  const rule=STYLE_RULES[type];
  return rule[style||(typeof S!=='undefined'&&S&&S.look&&S.look.style)||'std']||rule.std;
}
/* The fastener the program suggests for a joint, before any choice made by hand: the preset's rule for it
   (S.styled, kept per joint by storeNamedJoints), else the one worked out from the shapes, nudged by the style.
   jType (js/style.js) puts a choice made by hand in front of this. */
function suggestedType(j,style){
  const rule=S.styled&&S.styled[j.key];
  if(rule&&isStyleRule(rule))return typeForStyle(rule,style);
  return styleType(defaultType(j),j,style);
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
  const own=new Set(parts),pocketRules=[];
  for(const j of findJoints()){
    if(!own.has(j.a)||!own.has(j.b))continue;
    const type=namedJointType(j,preset.joints);   // the first row of the list that fits
    if(!type)continue;
    if(isStyleRule(type)){
      // a fastener that follows the style: kept as the rule, read through suggestedType, never frozen
      if(!S.styled||typeof S.styled!=='object')S.styled={};
      S.styled[j.key]=type;
      if(type==='pocketUnlessRustic')pocketRules.push(j.key);
      continue;
    }
    S.joints[j.key]=type;
    // What the preset named is also kept apart from what the person chooses later (S.named). Unfasten stores
    // "Not joined", and that is forgotten when the two pieces part (rule 2 in js/connections.js); the preset's
    // own word for the joint comes back then, so a countertop that was lifted off and set down again is
    // fastened the way the preset fastens it, and not screwed to the sides it only rests on.
    if(!S.named||typeof S.named!=='object')S.named={};
    S.named[j.key]=type;
  }
  roomForTopRows(pocketRules);
}
/* A top board that only crosses an apron right beside a leg has no room there for a pocket hole: the holes that
   hold the apron to the leg take up that end of the apron (rule 11 in js/fasteners.js). Such a board is held by
   the long apron that runs under it, so in Everyday and Fine furniture that joint only rests ('restsUnlessRustic');
   Rustic / rough still screws down through it. Worked out once, when the preset is placed, on the design as it
   is then, laid out as in the Everyday style (the rows of holes of Fine furniture are the same). */
function roomForTopRows(keys){
  if(!keys.length||typeof buildConnGraph!=='function'||typeof fastenerLayout!=='function')return;
  const saved=connCache,style=look().style;
  look().style='std';
  try{
    // a graph of the design as it is now, with the rules just stored, for the layouts below to look around in
    connCache=buildConnGraph(findJoints(),[],[]);
    for(const key of keys){
      const link=connCache.byKey.get(key);
      if(!link||link.type!=='pocket'||!link.joint)continue;
      if(fastenerLayout(link.joint,'pocket').noRoom)S.styled[key]='restsUnlessRustic';
    }
  }finally{
    connCache=saved;
    look().style=style;
    if(typeof layoutCarry!=='undefined')layoutCarry.clear();   // nothing laid out on that graph is kept
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
