/* NominalCAD: the looks of a case (the cabinet builder, js/casebuild.js): no hole and no screw head in sight, and
   no rail across the back under the top.

   The owner, 20 Nov, on a Bookshelf seen from a little below: "a human would look up and see all these holes i would
   prefer them hidden if thats an option but its fine if not also whats with the board across the top in the back of
   the top shelf, it doesnt look great"; then "pocket hole plugs arent something people will just have so if its
   easily purchasable then include it in the parts list too". Reference sheet 01, section 9.

   What a person sees is worked out from where eyes really are (js/lineofsight.js: standing 60" to 69", seated 40" to
   44", 6 ft in front). In Everyday and Fine furniture, in this order of preference:
     1. a face nobody sees: the underside of a board below the seated eyes, the top face of a SHELF above the tall
        standing eye (as a sub-top takes its holes on top, sheet 01 §9.1; never the top face of the top of the case,
        which is a top surface: the owner's rule), the top end of a divider under the rails of a laid-on top (screwed
        down through the rail, which the top then covers);
     2. else glued pocket-hole plugs, bought by the bag (sheet 01 §9.4; js/prices.js "Pocket-hole plugs"): the holes of
        a board seen from both eyes (between the two) go underneath and are plugged, and so are the holes near the top
        of a divider when they are in sight;
     3. else a wooden plug over a sunk screw (the type 'plug'): the screws up through the flat rails under a laid-on top
        when the rails' undersides are in sight.
   Rustic / rough may show them. Fine furniture also fills the holes of the shelves, the top and the top rails that
   nobody sees, as it always did (CASE_PLUGGED_IN_FINE, js/casecheck.js): the finer finish.

   The rail across the back under the top: with a 1/4" plywood back it is gone. Like store-bought and plan bookcases
   (sheet 01 §9.1, §9.3), the back keeps the case square and the top is held at both ends and nailed to the back; a case
   that must be fastened to the wall gets bought anti-tip kits, their case brackets screwed to the back of the case into
   the back edge of the top, out of sight from the front. With an open back the rail stays: there it keeps the case
   square (casePlan, C4), and it is held from its back face.

     caseLooks(p)            what the eyes see of the case the form describes, from its own pieces (for the joints and the
                             words, which are written before the case is placed): the face of the holes of the top and of
                             the shelves at each height, the top's top face, the rails under a laid-on top
     caseSightParts(piece)   the pieces of a placed case around a piece, and the top a person buys for a case with rails
     casePocketInSight(piece, out)   is the face a pocket hole of this placed piece opens on in sight?
     caseBoardFace(piece, parts)     'under', 'top' or 'plugged' for a board lying flat
     CASE_ANTI_TIP           the anti-tip kits: how many, the words of the shopping list line and of the step
   The self-checks are at the end of this file. Loads after js/casechecks.js. */
'use strict';

/* boards lying flat that may take their pocket holes in their top face (nothing lies on them); a flat top rail under
   a laid-on top does not: the top covers that face, and its holes are drilled from underneath */
const CASE_TOP_FACE_BOARDS=['Shelf','Top'];
/* how far down from its top end a divider takes its pocket holes for the top (they are near that end) */
const CASE_DIVIDER_HOLE_REACH=3;

/* The top a person buys for a case with rails only (top 'rails') is not one of its pieces, but it covers the rails
   from above as surely as wood: 1 1/2" thick (a usual counter or vanity top), over the whole case and 1" past the
   front. Added to the pieces a line of sight is worked out with. */
const CASE_BOUGHT_TOP='Top you buy';
function caseWithBoughtTop(parts,top){
  if(top!=='rails'||!parts.length)return parts;
  const boxes=parts.map(plainBox);
  const lo=[0,1,2].map(k=>Math.min(...boxes.map(b=>b.lo[k]))),hi=[0,1,2].map(k=>Math.max(...boxes.map(b=>b.hi[k])));
  const bought=mk(CASE_BOUGHT_TOP,'ply34',[hi[0]-lo[0],1.5,hi[2]-lo[2]+1],[lo[0],hi[1],lo[2]]);
  return parts.concat([bought]);
}
/* the pieces of the placed case a piece belongs to (its placement, S.sets), and the top you buy over its rails */
function caseSightParts(piece){
  const own=S.parts.filter(other=>other.set===piece.set);
  const set=S.sets&&piece.set!==undefined?S.sets[piece.set]:null;
  const vals=set&&set.vals;
  // A case saved before its form values were kept (or pasted without them): rails standing on edge and no top piece
  // are the rails of a top you buy (the code review of this job, finding 11)
  const railsOnEdge=!own.some(piece=>piece.name==='Top')&&own.some(piece=>piece.name==='Top rail'&&size(piece)[1]>size(piece)[2]+1e-6);
  return caseWithBoughtTop(own,vals?casePlan(vals).top:railsOnEdge?'rails':null);
}
/* Where the pocket holes of a board lying flat go: 'under' when nobody sees its underside, 'top' when nobody sees its
   top face (a shelf or the top above the standing eye), else 'plugged' (underneath, filled with plugs). */
function caseBoardFace(piece,parts){
  if(!faceInSight(piece,1,-1,parts))return'under';
  if(caseTopFaceHidden(piece,parts))return'top';
  return'plugged';
}
/* Is the top face of a shelf or of the top out of sight, so that holes or heads may go there? Out of sight of every
   eye (above the tall standing eye). A face with nothing of the case over it (the top of the case, or the top shelf
   under the rails of a top you buy, which is not one of the pieces) is a top surface, and it is never drilled,
   however high: the owner's standing rule is no screw head and no hole on the top unless the style is Rustic, and a
   top is seen from a step stool, a stair and by the person who dusts it (the real-thing review of this job, finding
   2: bare screw heads on the top of a 72" case over its divider). */
function caseTopFaceHidden(piece,parts){
  if(!CASE_TOP_FACE_BOARDS.includes(piece.name))return false;
  // (over the middle of the face: the rails of a top you buy run along its front and back edges and do not cover it)
  const b=plainBox(piece),middle=[(b.lo[0]+b.hi[0])/2,0,(b.lo[2]+b.hi[2])/2];
  const over=parts.some(other=>{
    if(other===piece||other.name===CASE_BOUGHT_TOP)return false;
    const o=plainBox(other);
    return o.lo[1]>=b.hi[1]-1e-6&&o.lo[0]<middle[0]&&o.hi[0]>middle[0]&&o.lo[2]<middle[2]&&o.hi[2]>middle[2];
  });
  if(!over)return false;
  return!faceInSight(piece,1,1,parts);
}
/* The face a pocket hole opens on, as `out` gives it, is it in sight? (the axis it looks along, the side) Near the top
   end of a divider only (its holes for the top are there); every other piece over the whole face. */
function casePocketInSight(piece,out){
  const axis=[0,1,2].reduce((best,k)=>Math.abs(out[k])>Math.abs(out[best])?k:best,0),side=out[axis]>0?1:-1;
  const parts=caseSightParts(piece);
  if(piece.name==='Divider'&&axis!==1){
    const top=plainBox(piece).hi[1];
    return faceInSight(piece,axis,side,parts,{1:[top-CASE_DIVIDER_HOLE_REACH,top]});
  }
  return faceInSight(piece,axis,side,parts);
}

/* ---- the case the form describes, before it is placed ---- */
let caseLooksMemo={key:null,looks:null};
function caseLooks(p){
  const key=JSON.stringify(p);
  if(caseLooksMemo.key!==key)caseLooksMemo={key,looks:makeCaseLooks(p)};
  return caseLooksMemo.looks;
}
function makeCaseLooks(p){
  const s=casePlan(p),parts=caseWithBoughtTop(buildCase(p),s.top);
  const top=s.top==='inside'?parts.find(piece=>piece.name==='Top'):null;
  const shelvesAt=y=>parts.filter(piece=>piece.name==='Shelf'&&Math.abs(piece.pos[1]-y)<1/32);
  // the face of the holes of the shelves at one height: every shelf at a height is placed alike, so the first one that
  // differs from 'under' decides ('plugged' wins over 'top', so no hole is left in sight)
  const shelfFace=y=>{
    const faces=shelvesAt(y).map(piece=>caseBoardFace(piece,parts));
    return faces.includes('plugged')?'plugged':faces.includes('top')?'top':'under';
  };
  const rails=parts.filter(piece=>piece.name==='Top rail'&&s.top==='over');
  return{
    parts,
    // the top between the sides: the face of its holes ('under' or 'plugged': its top face is never drilled)
    top:top?caseBoardFace(top,parts):null,
    shelfFace,
    // a shelf at this height whose underside is in sight (the second shelf at a divider then takes pocket screws:
    // caseHighSecondShelf, js/casecheck.js)
    shelfUnderSeen:y=>shelvesAt(y).some(piece=>faceInSight(piece,1,-1,parts)),
    // the flat rails under a laid-on top: their undersides in sight (their pocket holes plugged, and the screws up
    // into the top sunk under wooden plugs)
    railsUnderSeen:rails.some(piece=>faceInSight(piece,1,-1,parts)),
    // the holes near the top end of the dividers, for a top between the sides whose top face is seen
    dividerTopSeen:parts.some(piece=>piece.name==='Divider'&&[-1,1].some(side=>
      faceInSight(piece,0,side,parts,{1:[plainBox(piece).hi[1]-CASE_DIVIDER_HOLE_REACH,plainBox(piece).hi[1]]}))),
  };
}

/* The pocket holes the notes and the steps of a case say are filled with plugs in Everyday (and Fine), from the case
   the form describes. Only pieces that really take pocket holes there count: in a bay too narrow for a pocket-hole
   drill the top, the shelves and the flat top rails are screwed through the sides under wooden plugs, and the only
   pocket holes of a shelf are at the left end of a shelf on the right of a divider whose underside is seen
   (caseHighSecondShelf). The code review of this job, finding 2: a narrow case was told to plug pocket holes it does
   not have. Each:
     top          the holes under the top between the sides
     shelves      the heights (in words) of the shelves whose holes are plugged, at both ends
     atDivider    in a narrow case, the heights of the shelves on the right of a divider whose holes there are plugged
     rails        the holes under the flat top rails of a laid-on top
     sides        the holes near the top of the sides, on their inside faces, for a laid-on top (caseTopBySides)
     dividerTop   the holes near the top end of the dividers, for a top between the sides */
/* Is a laid-on top held by pocket screws from the inside faces of the sides (where a person in front sees the
   undersides of its rails), not by screws up through the rails? Their heads would show, and sunk under 3/8" plugs
   in a 3/4" rail the shortest #8 screw (1") comes within 1/8" of the top surface (pointsNearTheTop wants 1/4"). */
function caseTopBySides(s,looks){
  return s.top==='over'&&looks.railsUnderSeen;
}
function casePluggedWords(p){
  const s=casePlan(p),looks=caseLooks(p);
  // (underneath where seen, and on the top face of a shelf above the eyes, seen from a step stool: casePocketsPlugged)
  const plugged=y=>looks.shelfFace(y)!=='under';
  // (caseHighPairedShelves gives its heights to the 1/16"; the shelves are found by their own heights)
  const highSecond=caseHighPairedShelves(s,looks).high.map(y=>s.bays.flatMap(bay=>bay.shelfY).find(own=>Math.abs(r16(own)-y)<1e-6)||y);
  return{
    top:!s.narrow&&looks.top==='plugged',
    shelves:s.narrow?[]:s.shelfY.filter(plugged).map(fmt),
    // of those, the ones whose holes are in their top face
    onTop:s.narrow?[]:s.shelfY.filter(y=>looks.shelfFace(y)==='top').map(fmt),
    atDivider:s.narrow?highSecond.filter(plugged).map(fmt):[],
    rails:!s.narrow&&s.top==='over'&&looks.railsUnderSeen,
    // the holes near the top end of the sides, on their inside faces, for a laid-on top held from the sides
    sides:caseTopBySides(s,looks),
    dividerTop:s.top==='inside'&&s.dividers>0&&looks.dividerTopSeen,
  };
}

/* ---- fastened to the wall with anti-tip kits (sheet 01 §9.3) ----
   One kit near each end of the case (and one more in the middle of a case wider than 48"): its case bracket screwed
   to the back of the case into the back edge of the top (through the back panel, where there is one), or into the
   back face of the back top rail under a top you buy; its wall bracket into a wall stud. */
const CASE_ANTI_TIP={
  // (short: it is a row of the shopping list on the phone page too; the code review of this job, note 20)
  label:'Furniture anti-tip kits (2 brackets and a strap each)',
  wideFrom:48,
  count:s=>s.W>CASE_ANTI_TIP.wideFrom?3:2,
  // the case end is screwed into solid wood with screws this long or longer, so they go at least 1" into it: the kit
  // is bought with screws this long
  // (the review of the strength plan, finding 8; the real-thing review of this job, finding 3)
  screw:'1 1/4"',
};
/* the piece at the back of the top the case brackets are screwed into, in words: solid wood, never the thin back
   panel alone (Anchor It; sheet 01 §9.3). With an open back, the face of the back rail under the top. */
function caseAntiTipInto(s){
  if(s.top==='rails')return s.back==='panel'?'the back face of the back top rail, through the back panel':'the back face of the back top rail';
  if(s.backRail)return s.top==='over'?'the back face of the back rail under the back top rail':'the back face of the back rail under the top';
  return s.back==='panel'&&s.top==='inside'?'the back edge of the top, through the back panel':'the back edge of the top';
}
/* The words of the last step for a case that goes on the wall, in the order a kit is really put on (CPSC Anchor It,
   how to install a kit: the wall bracket is fixed with the furniture pulled out, the strap joined, the furniture
   pushed back into place, the strap snugged; the real-thing review of this job, finding 3: with the case already
   against the wall nobody can reach the stud behind it). */
function caseAntiTipWords(s){
  const count=CASE_ANTI_TIP.count(s);
  const where=count>2?'one near each end and one in the middle':'one near each end';
  const level=s.top==='rails'||s.backRail?'':s.top==='inside'&&s.back==='panel'?` (its screws 3/8" down from the top edge of the back, so they go into the middle of the top's edge behind it)`:` (its screws in the middle of that edge)`;
  const helper=s.H>48?'With a helper, stand':'Stand';
  return`Fasten it to the wall with the ${count} anti-tip kits, ${where}. First mark the wall where the case will stand: find the wall studs with a stud finder and mark the stud nearest each place a kit goes, and the height of the top of the case. `+
    `Lay the case face down and screw the case bracket of each kit to the back of the case, about 2" in from its end, into ${caseAntiTipInto(s)}${level}, with the screws that come with it (buy a kit whose screws are at least ${CASE_ANTI_TIP.screw} long, so they go at least 1" into the wood). `+
    `Screw each wall bracket into its stud, at the height of its case bracket (the strap may run at a slant to reach a stud). ${helper} the case up a little out from the wall, join each pair of brackets with its strap, push the case back against the wall, and tighten each strap from above the case until it is snug. Nothing of them shows from the front.`;
}

/* ---- the Wall shelf: the same look (point 5 of the owner's brief of 20 Nov) ----
   Its supports take their pocket holes on a face of their own (WALL_SHELF_JOINTS, js/builders-storage.js), and a
   person in front sees those faces at most heights: below a shelf hung low the standing eye looks in under it, above
   54" rule 13 already plugged them. So in Everyday and Fine the holes of a support are plugged wherever its face is in
   sight; the cleat's are on its back face, against the wall. Hung from here, as the retired Bookshelf is retired from
   js/casebuild.js, so the preset's own row in js/presets.js is not touched. */
(function wallShelfPlugsWhatIsSeen(){
  const shelf=PRESETS.find(preset=>preset.name==='Wall shelf');
  if(shelf&&!shelf.pluggedPockets)shelf.pluggedPockets=(piece,out,style)=>style!=='rustic'&&piece.name==='Support'&&pocketFaceInSight(piece,out);
})();
/* The same cheap fix for two more house presets whose stretchers show their pocket holes to the eyes in front (the
   fixing round of the case looks job, with the eyes as bands: the Coffee table's long stretcher into its legs, the
   shoe bench's long stretcher into its legs and up into the shelf slats): plugged where seen, in Everyday and Fine.
   The plugs are bought (the shopping list counts them from the layout), the "Fasten with" lines say to glue them in,
   and the step lists the saw that trims them (js/buildsteps.js). Only where a preset has no pluggedPockets of its own. */
const PLUG_WHAT_IS_SEEN=['Coffee table','Entryway shoe bench'];
/* Like pieces stay alike (the owner, 20 Nov: "we want like pieces"; js/drilledkinds.js pins it). The two long
   stretchers of these presets face each other and are drilled alike: when a person in front sees the inside face of
   the back one, its holes are plugged, and the front one's are plugged too, so both stay one part drawing (a plug
   is cheap; a coffee table is seen from the couch side as well, which the eyes in front do not cover). Found at the
   merge of the pocket-edge round with the case looks: plugging only the seen one split the stretchers into two
   drilled kinds. A twin is a piece of the same name and cut size in the same placement; its holes face the other
   way along the axis the face looks. */
function twinFaceInSight(piece,out){
  const axis=[0,1,2].reduce((best,k)=>Math.abs(out[k])>Math.abs(out[best])?k:best,0);
  const facing=out.map((value,k)=>k===axis?-value:value);
  const sameCut=other=>other.name===piece.name&&other.mat===piece.mat&&Math.abs(other.l-piece.l)<.01&&Math.abs(other.w-piece.w)<.01;
  return S.parts.some(other=>other!==piece&&other.set===piece.set&&sameCut(other)&&pocketFaceInSight(other,facing));
}
(function plugWhatIsSeen(){
  for(const name of PLUG_WHAT_IS_SEEN){
    const preset=PRESETS.find(row=>row.name===name);
    if(preset&&!preset.pluggedPockets)preset.pluggedPockets=(piece,out,style)=>style!=='rustic'&&(pocketFaceInSight(piece,out)||twinFaceInSight(piece,out));
  }
})();

/* ---------- self-checks ---------- */

/* The cases the line-of-sight check builds: the Bookshelf at its start, smallest and largest, with one divider and
   more, narrow bays and an open middle bay, an open back; every kind of case at the builder's own start and at its
   largest; and every choice the structural sweep tries (CASE_VARIANTS) at the start, the largest and 60" x 50" (a top
   between the two eyes). [{label, vals}] */
/* (The real-thing review of this job, finding 5: every "largest" trial was refused, a laid-on top cannot be 96" tall,
   and the check skipped refused trials without a word, so no case above 72" x 84" was ever looked at. Now a "largest"
   trial has the top between the sides unless it names its top, and comes down in height, then in width, until it
   builds; and every trial must build: caseNothingInSight fails on one that does not.) */
const CASE_SIGHT_HEIGHTS=[96,90,84,78,72,66,60,54,50,48,42,36,30,24];
function caseBuildsAt(vals,from){
  const refused=v=>caseCheck(v).some(f=>f.level==='stop');
  if(!refused(vals))return vals;
  for(const W of[vals.W,72,48,36].filter((w,i,all)=>w<=vals.W&&all.indexOf(w)===i))
    for(const H of CASE_SIGHT_HEIGHTS.filter(h=>h<=from)){
      const tried={...vals,W,H};
      if(!refused(tried))return tried;
    }
  return vals;
}
function caseSightTrials(){
  const book=more=>caseEntryVals('bookshelf',more),own=more=>({...presetDefaults(caseBuilder()),...more});
  const largest=more=>caseBuildsAt(own({top:'inside',...more,W:96,H:96}),96);
  const sized=(label,vals)=>`${label} (${vals.W}" x ${vals.H}")`;
  const trials=[['the Bookshelf at its start',book({})],['the Bookshelf at its smallest',book({W:12,H:24,n:1})],
    // a shelf between 54" and 57" up (the code review of this job, finding 1), tall narrow bays (finding 2), and the
    // sizes the owner's brief names
    ['the Bookshelf 32" x 72"',book({W:32,H:72})],['the Bookshelf 12" x 72", one narrow bay',book({W:12,H:72})],
    ['the Bookshelf 36" x 60" in 3 narrow bays',book({W:36,H:60,bays:'3'})],['the Bookshelf 48" x 84"',book({W:48,H:84})],
    ['the Bookshelf 40" x 84", one divider',book({W:40,H:84})],['the Bookshelf 36" x 72"',book({W:36,H:72})],
    ['the Bookshelf at its largest',book({W:72,H:84,n:8})],['the Bookshelf 72" x 84" with 6 shelves',book({W:72,H:84,n:6})],
    ['the Bookshelf 48" x 72", one divider',book({W:48,H:72,n:5})],['the Bookshelf 64" x 72", one divider',book({W:64,H:72,n:5})],
    ['the Bookshelf 40" x 60", one divider',book({W:40,H:60})],['the Bookshelf 72" x 24", two dividers',book({W:72,H:24,n:1})],
    ['the Bookshelf 36" x 72" in 3 narrow bays',book({W:36,H:72,bays:'3'})],['the Bookshelf with an open middle bay',book({W:72,H:48,bays:'3',fillMid:'open'})],
    ['the Bookshelf with an open back',book({W:72,H:36,n:1,back:'rails'})],
    ['the Bookshelf at its largest, rails for a top you buy',book({W:72,H:84,n:8,top:'rails'})],
    ['the Bookshelf 72" x 54", a top laid on',book({W:72,H:54,top:'over'})],
    ['the Bookshelf at its largest, a top laid on',book({W:72,H:84,n:8,top:'over'})]];
  for(const kind of Object.keys(CASE_KINDS)){
    const big=largest({kind});
    trials.push([`a ${CASE_KINDS[kind].name} at the start`,own({kind})],[sized(`a ${CASE_KINDS[kind].name} at its largest`,big),big]);
  }
  for(const variant of CASE_VARIANTS){
    const words=JSON.stringify(variant),big=largest(variant),middle=caseBuildsAt(own({...variant,W:60,H:50}),50);
    trials.push([`variant ${words}`,own(variant)],[sized(`variant ${words}, largest`,big),big],[sized(`variant ${words}, 60" wide, between the two eyes`,middle),middle]);
  }
  return trials.map(([label,vals])=>({label,vals}));
}
/* the pocket holes filled with plugs in the design's fastener layout, and the plugs on its shopping list */
function plugsLaidOut(){
  let count=0;
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    count+=fastenersOfLink(link).filter(f=>f.pocket&&f.pocket.plugged).length;
  }
  return count;
}
function plugsOnTheList(){
  // (the line names the kind of plug since the merge with the pocket-edge round, "Pocket-hole plugs, oak":
  //  POCKET_PLUG_LINE reads it, with or without the kind)
  return hardwareTotals(findJoints()).rows.filter(([label])=>POCKET_PLUG_LINE.test(label)).reduce((sum,row)=>sum+row[1],0);
}

/* the height of the top surface of the placed design (the highest top face of its wood) */
function caseTopSurface(){
  return Math.max(...S.parts.filter(piece=>!isProp(piece)).map(piece=>plainBox(piece).hi[1]));
}
/* The words of the placed case against its own fastener layout and shopping list (the code review of this job,
   findings 1 and 2: the steps said "underside" where the layout drilled the top face of a shelf at 54 5/16", and a
   narrow case was told to plug pocket holes it does not have and that the list does not buy). The layout is read
   from the placed pieces (fastenerHeads), the words from the steps and notes as placed, so the two are worked out
   apart. Returns what disagrees, in words. */
function casePlugWordsAgree(vals,style,listed){
  const out=[],s=casePlan(vals);
  const steps=(S.steps||[]).map(stepText),words=steps.concat(S.notes||[]).join(' ');
  // a sentence names pocket-hole plugs exactly when the shopping list buys them
  const named=/pocket-hole plugs/i.test(words);
  if(named&&!listed)out.push('the words name pocket-hole plugs, the shopping list buys none');
  if(!named&&listed)out.push(`the shopping list buys ${listed} pocket-hole plugs, and no step or note says to glue them in`);
  // the pocket holes of the shelves, height by height, as the layout drills them
  const heights=new Map();
  for(const head of fastenerHeads()){
    if(head.f.kind!=='pocket'||head.f.through.name!=='Shelf'||Math.abs(head.out[1])<.5)continue;
    const y=caseLocalPos(head.f.through)[1],key=r16(y);
    if(!heights.has(key))heights.set(key,{y,top:0,under:0,plugged:0});
    const at=heights.get(key);
    if(head.out[1]>0)at.top++;else at.under++;
    if(head.f.pocket&&head.f.pocket.plugged)at.plugged++;
  }
  const list=[...heights.values()].sort((a,b)=>a.y-b.y);
  const said=(text,re)=>((text||'').match(re)||[])[1]||'';
  const marking=steps.find(text=>/^Lay the two sides/.test(text))||'';
  const shelfStep=steps.find(text=>/^Fasten the shel/.test(text))||'';
  // (the marking step names the pocket holes only while it tells to drill them; "Drill your pieces" may hold them)
  const markingDrills=/drill (?:every pocket hole|the pocket holes) now/.test(marking);
  if(!s.narrow){
    const onTop=listWords(list.filter(at=>at.top).map(at=>fmt(at.y)));
    const saidTop=said(marking,/in the top face instead for the shel(?:f|ves) at ([^)]+)\)/);
    if(markingDrills&&saidTop!==onTop)out.push(`the marking step drills the top face of the shelves at "${saidTop}", the layout at "${onTop}"`);
    const saidShelfTop=said(shelfStep,/in its top face instead for the shel(?:f|ves) at ([^:]+):/);
    if(saidShelfTop!==onTop)out.push(`the shelves step puts the pocket holes in the top face of the shelves at "${saidShelfTop}", the layout at "${onTop}"`);
  }else{
    // the one place a narrow case has pocket holes in a shelf: the left end of a high shelf on the right of a divider
    for(const at of list.filter(()=>markingDrills)){
      const face=at.top&&at.under?'its top face or underside, as the list below says':at.top?'its top face':'its underside';
      if(!new RegExp(`at [^;.]*${fmt(at.y).replace(/[.*+?^${}()|[\]\\"]/g,'\\$&')}[^;.]* on the right of [^;.]*, in ${face}, for the divider`).test(marking))
        out.push(`the marking step does not drill the pocket holes of the shelf at ${fmt(at.y)} in ${face}, as the layout does`);
    }
  }
  if(style==='std'){
    // Everyday plugs the shelves a person sees: the step that glues them in names exactly those heights
    const pluggedAt=listWords(list.filter(at=>at.plugged).map(at=>fmt(at.y)));
    const saidPlugged=s.narrow?said(shelfStep,/fill the pocket holes at the left end of the shel(?:f|ves) at (.+?) with glued pocket-hole plugs/)
      :said(shelfStep,/fill the pocket holes of the shel(?:f|ves) at (.+?) with glued pocket-hole plugs/);
    if(saidPlugged!==pluggedAt)out.push(`the shelves step plugs the shelves at "${saidPlugged}", the layout plugs those at "${pluggedAt}"`);
  }
  return out;
}

/* Point 4 of the owner's brief: from a standing eye (60" to 69" up) and a seated eye (40" to 44" up), 6 ft in front
   of the case and anywhere along it, no open pocket hole and no screw head is in sight, looking up into a bay and down
   onto a shelf included, on every case trial in Everyday and Fine furniture; every plug the layout puts in is on the
   shopping list; and the words say what the layout does (casePlugWordsAgree). Rustic / rough must show heads (the
   check would be blind otherwise). On the Bookshelf of main before this job it fails: the default 32" x 48" shows 4
   open pocket holes under its top to the seated eye, a 64" x 72" two-bay one the pocket holes under its shelf at 49"
   and the angled screws of the shelf on the right of its divider. On the first build of this job it failed on the
   open holes on top of the shelf at 59 15/16" of the 64" x 72" (seen from the tall eye), the bare heads on its top
   over the divider, and the words of the 36" x 72" and of a 12" x 72" narrow case (the reviews of the job). */
SELFTESTS.push(function caseNothingInSight(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('case looks: '+text);};
  const builder=caseBuilder();
  if(!builder||!caseEntry('bookshelf')){wrong('the cabinet builder or its Bookshelf entry is missing');return;}
  const kept=JSON.stringify(S);
  let built=0;
  try{
    for(const{label,vals}of caseSightTrials()){
      // (every trial must build, or it is never looked at: the real-thing review of this job, finding 5)
      if(caseCheck(vals).some(f=>f.level==='stop')){wrong(`${label} is refused, so it is never looked at: pick a size that builds`);continue;}
      built++;
      for(const style of['std','fine']){
        placeInStyle(builder,vals,style);
        const seen=headsInSight();
        if(seen.length)wrong(`${label} in ${STYLES[style][0]}: ${headsInSightWords(seen)}`);
        // Nothing on the top surface of the case at any height, not even above every eye: no open pocket hole, no
        // plug and no bare head (the owner's rule, "no screw heads on the top ... unless the build style is Rustic";
        // the real-thing review of this job, finding 2: two bare heads and four pocket holes on the top of a 72" case)
        const top=caseTopSurface();
        const onTop=fastenerHeads().filter(head=>head.out[1]>.5&&Math.abs(head.at[1]-top)<.05&&(!head.covered||head.f.kind==='pocket'));
        if(onTop.length)wrong(`${label} in ${STYLES[style][0]}: ${onTop.length} ${onTop[0].f.kind==='pocket'?'pocket holes':'screw heads'} on the top of the case (${onTop[0].f.through.name} into ${onTop[0].f.into.name})`);
        // (laid out and listed both come from the layout: this catches a plugged joint the list does not count, not
        // a miscount of the layout itself)
        const laid=plugsLaidOut(),listed=plugsOnTheList();
        if(laid!==listed)wrong(`${label} in ${STYLES[style][0]}: ${laid} pocket holes are plugged, the shopping list buys ${listed} plugs`);
        casePlugWordsAgree(vals,style,listed).forEach(text=>wrong(`${label} in ${STYLES[style][0]}: ${text}`));
        // the step that fastens a case to the wall lists the bought kits under "You need" (the code review of this
        // job, finding 5; the real-thing review, finding 3)
        if(style==='std'&&casePlan(vals).anchored){
          const planned=buildPlan().steps,last=planned[planned.length-1];
          if(!last||!last.need||!last.need.fasteners.some(line=>/anti-tip kits?/.test(line)))wrong(`${label}: the step that fastens it to the wall does not list the anti-tip kits under "You need"`);
        }
      }
    }
    placeInStyle(builder,caseEntryVals('bookshelf'),'rustic');
    if(!headsInSight().length)wrong('the Bookshelf in Rustic / rough shows no screw head to the eyes: the check cannot see');
  }finally{load(kept,true);}
});});

/* The owner, 20 Nov: "pocket hole plugs arent something people will just have so if its easily purchasable then
   include it in the parts list too". Every preset (each catalog entry at its start values, and the presets no entry
   starts) in every build style: the pocket holes the layout fills with plugs are exactly the plugs on the shopping
   list, and the line has a price (a store pack). */
SELFTESTS.push(function pocketPlugsAreBought(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('pocket-hole plugs: '+text);};
  const kept=JSON.stringify(S);
  try{
    const designs=[];
    for(const preset of PRESETS){
      if(preset.retired)continue;
      const entries=CATALOG.filter(entry=>entry.builder===preset.name);
      if(entries.length)for(const entry of entries)designs.push([entry.name,preset,{...presetDefaults(preset),...(entry.start||{})}]);
      else if(!preset.hidden)designs.push([preset.name,preset,presetDefaults(preset)]);
    }
    let plugged=0;
    for(const[name,preset,vals]of designs){
      if(preset.check&&(preset.check(vals)||[]).some(f=>f.level==='stop'))continue;
      for(const style of Object.keys(STYLES)){
        if(!placeInStyle(preset,vals,style))continue;
        const laid=plugsLaidOut(),listed=plugsOnTheList();
        plugged+=laid;
        if(laid!==listed)wrong(`${name} (${STYLES[style][0]}): ${laid} pocket holes are plugged, the shopping list buys ${listed} plugs`);
        if(listed&&typeof hardwareFamily==='function'&&!hardwareFamily(pocketPlugLabel()))wrong('the pocket-hole plugs have no price');
      }
    }
    if(!plugged)wrong('no preset plugs a pocket hole in any style, so this check proves nothing');
  }finally{load(kept,true);}
});});

/* Point 5 of the owner's brief: the same look at every other preset of furniture for the house (HOUSE_FURNITURE,
   js/showfaces.js), each catalog entry at its start values, with every number of its form at its smallest and with
   every number at its largest, in Everyday and Fine furniture. The heads the owner agreed may stay
   (SHOW_FACE_ALLOWED) are left out. What other teams' presets still show is listed here with its count (the same in
   both styles), found by the case looks job (21 Nov) and handed on, because the chair, the tables and the benches are
   being changed by other teams: a count may only go down, and when it does the check asks for the table to be
   lowered with it. Every other entry, and every case of the cabinet builder, shows none. The counts are LOWER BOUNDS
   of what a person sees: the eyes stand only in front (a table, a bench or a chair is seen from its back and ends
   too) and 6" apart, so a narrow line of sight between slats can be missed (the real-thing review of this job, note
   9: the shoe bench shows 8 to a person walking along it). */
/* (The fixing round of this job made the eyes bands, 60" to 69" standing and 40" to 44" seated, and the counts were
   measured again with them: the chair's went from 10 to 14 at its start and smallest, the set's from 24 to 28. The
   Coffee table and the shoe bench now plug what is seen, PLUG_WHAT_IS_SEEN above, and show none.) */
/* (Merged with the chair's frame and seats round, branch seats: the Dining chair plugs its stretchers' pocket holes
   in Everyday and Fine and has no corner blocks, so it and "Dining table and chairs" show none now; their rows, 14
   and 28, were taken out as the check asked. Nothing is handed on today: every entry shows none.) */
const LINE_OF_SIGHT_HANDED_ON={
};
/* an entry's start values, and with every number its form shows at its smallest or at its largest (the entry's own
   limits first) */
function lineOfSightTrials(preset,entry){
  const base={...presetDefaults(preset),...(entry.start||{})},limits=entry.limits||{};
  const numbers=preset.params.filter(q=>q.k&&!q.head&&!q.opts&&!q.check&&(!q.show||q.show(base))&&q.min!==undefined&&q.max!==undefined);
  const at=end=>({...base,...Object.fromEntries(numbers.map(q=>[q.k,(limits[q.k]||[q.min,q.max])[end]]))});
  return[['start',base],['smallest',at(0)],['largest',at(1)]];
}
SELFTESTS.push(function houseFurnitureOutOfSight(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('line of sight: '+text);};
  const kept=JSON.stringify(S);
  let looked=0;
  try{
    for(const name of HOUSE_FURNITURE){
      const preset=PRESETS.find(candidate=>candidate.name===name);
      if(!preset||preset.retired)continue;
      const entries=CATALOG.filter(entry=>entry.builder===name);
      for(const entry of entries.length?entries:[{name,start:{},limits:{}}]){
        for(const[where,vals]of lineOfSightTrials(preset,entry)){
          // (an entry's start values must build; a limit that is refused is not looked at, and is counted)
          if(preset.check&&(preset.check(vals)||[]).some(f=>f.level==='stop')){
            if(where==='start')wrong(`${entry.name}: its start values are refused, so it is never looked at`);
            continue;
          }
          looked++;
          const allowed=(LINE_OF_SIGHT_HANDED_ON[entry.name]||{})[where]||0;
          let most=0;
          for(const style of SHOW_FACES.styles){
            placeInStyle(preset,vals,style);
            const seen=headsInSight().filter(head=>!showFaceAllowed(name,style,head));
            most=Math.max(most,seen.length);
            if(seen.length>allowed)wrong(`${entry.name} at ${where==='start'?'its start':'its '+where} (${STYLES[style][0]}): ${headsInSightWords(seen)}${allowed?` (handed on: ${allowed})`:''}`);
          }
          // a ratchet, not a ceiling: once fewer show, the table is lowered with them, so they cannot come back unseen
          // (the code review of this job, finding 4)
          if(most<allowed)wrong(`${entry.name} at ${where==='start'?'its start':'its '+where}: ${most} holes or heads are in sight now, fewer than the ${allowed} handed on: lower its count in LINE_OF_SIGHT_HANDED_ON (js/caselooks.js) to ${most}`);
        }
      }
    }
    if(looked<HOUSE_FURNITURE.length)wrong(`only ${looked} designs were looked at`);
  }finally{load(kept,true);}
});});
