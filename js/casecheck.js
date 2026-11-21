/* NominalCAD: what the cabinet builder says about a case (design/specs/01-cabinet-case-builder.md, 3.1 and 4).

     caseCheck(p)     the warning box: [{level, text, fix}] for numbers that cannot work together (the plan's
                      refusals: too many shelves, opening heights that do not fit, a bay set by hand too wide,
                      a top larger than a sheet). "stop" blocks Create.
     caseInfo(p)      the remark under the form: the openings, what the program put right and why
     caseNotes(p)     the notes of the design: the load, the dividers, the wall
     caseHardware(p)  the anti-tip kits of a case that goes on the wall (js/caselooks.js)
     caseUses(p)      what each piece carries, for the structural check (USES keys, js/verify.js)
     caseJoints(p)    the fastener of each pair of pieces, by build style (STYLE_RULES, js/joints.js)
   All of them read casePlan (js/caseplan.js). */
'use strict';

function caseCheck(p){
  return casePlan(p).problems.map(found=>({level:found.level,text:found.text,fix:found.fix}));
}

/* the load in words, for the remark and the notes */
const CASE_LOAD_WORDS={books:'books',shelf:'heavy things',general:'light things'};

/* The remark for shelves at a chosen spacing: how many shelves that makes, the opening that takes what is left,
   and what fits at which spacing (the reference sheet's spacings by item). Sizes read as the boxes show them. */
function caseSpacingWords(s){
  const{gap,shelves,leftover,at,more,lowest,alike,evenAt}=s.fit,most=CASE.limits.n[1];
  const clear=`${typedLen(gap)} clear between shelves (from the top of one board to the underside of the next)`;
  let fits;
  if(!shelves){
    fits=`No shelf fits at ${clear} in a case ${typedLen(s.H)} tall: the opening left above or below it would be lower than ${typedLen(lowest)}. The case has one opening of ${typedLen(leftover)}.`;
  }else if(alike){
    fits=`At ${clear}, ${shelvesWord(shelves)} ${shelves===1?'fits':'fit'} in a case ${typedLen(s.H)} tall, and all ${shelves+1} openings come out ${typedLen(gap)}.`;
  }else{
    fits=`At ${clear}, ${shelvesWord(shelves)} ${shelves===1?'fits':'fit'} in a case ${typedLen(s.H)} tall: `+
      `${shelves===1?'one opening':shelves+' openings'} of ${typedLen(gap)}, and the ${at} opening takes what is left, ${typedLen(leftover)}.`+
      (more>shelves?` The height has room for ${more}, but this form makes ${most} at most, so the ${at} opening is the taller one.`:'');
  }
  if(!alike&&evenAt.length)fits+=` For openings all the same, make the case ${evenAt.map(height=>typedLen(height)).join(' or ')} tall.`;
  // (sizes of things, not of a box: written in inches throughout, so one sentence does not mix 12" and 1'-1")
  return fits+(s.use==='books'?` Most books fit in ${fmt(10)} to ${fmt(12)} (paperbacks ${fmt(8)}); binders, record albums and large books want ${fmt(13)} to ${fmt(15)}.`:'');
}
function caseInfo(p){
  const s=casePlan(p),out=[],stopped=s.problems.some(found=>found.level==='stop');
  if(s.fit)out.push(caseSpacingWords(s));
  else if(s.shelves&&!stopped){
    const heights=caseBuiltOpenings(s);
    if(s.customOpenings){
      const shared=s.shelves+1-bookshelfAskedOpenings(p,s.shelves).filter(size=>size>0).length;
      out.push(`Openings from the bottom up: ${heights.map(height=>typedLen(height)).join(', ')}. ${shared>1?`The ${shared-1===1?'opening':shared-1+' openings'} left at 0 and the top one share what is left.`:'The top one takes what is left.'}`);
    }else{
      // the openings as built: the same to the 1/16", or (when the height does not share out evenly to the 1/16")
      // two sizes 1/16" apart, which the remark says rather than rounding them to one
      const sizes=[...new Set(heights.map(r16))].sort((a,b)=>a-b).map(height=>typedLen(height));
      out.push((sizes.length===1?`Each of the ${heights.length} openings is ${sizes[0]} tall`
        :`The ${heights.length} openings are ${listWords(sizes).replace(/ and /,' or ')} tall (the height does not share out evenly to the 1/16")`)+
        (s.spacing==='set'?': every box is at 0, so they share the height evenly. Type a height for the ones you want different.'
          :'. Under Shelf spacing, "At a spacing I choose" fits the shelves to the opening you type, and "Set the height of each opening" sets them one by one.'));
    }
  }
  if(s.dividers&&s.bays.length&&p.bays!==undefined&&p.bays!=='auto'){
    out.push(`It has the ${s.bays.length} bays you asked for, so ${countOf(s.dividers,'upright divider')}.`);
  }else if(s.dividers){
    const load=CASE_LOAD_WORDS[s.limitUse];
    out.push(`A 3/4" shelf sags${load?' under '+load:''} when it spans more than about ${fmt(Math.floor(s.bayLimit))}, so this case gets ${countOf(s.dividers,'upright divider')}.`);
  }
  const narrowest=typedLen(floor16(Math.min(...s.bays.map(bay=>bay.len))));
  if(s.narrow&&!stopped)out.push(`${s.bays.length>1?'Each bay is only '+narrowest+' wide inside':'The case is only '+narrowest+' wide inside'}, too narrow for a pocket-hole drill, so in Everyday and Fine furniture the boards are held by screws through the sides with their heads sunk and covered by glued wooden plugs.`);
  // bays that cannot all come out the same to the 1/16": their shelves are cut to two lengths, which must not be mixed up
  const bayWidths=[...new Set(s.bays.map(bay=>r16(bay.len)))].sort((a,b)=>a-b);
  if(bayWidths.length>1&&!stopped)out.push(`The bays are ${listWords(bayWidths.map(width=>typedLen(width)))} wide inside: the width does not share out evenly to the 1/16", so the boards of the bays are cut to lengths 1/16" apart. Pencil its bay on each one as you cut it.`);
  // (fastened with anti-tip kits screwed to the back of the case: js/caselooks.js)
  if(s.anchored){
    if(s.anchorWhy.includes('tall'))out.push('It is more than 4 times as tall as it is deep, so it must be fastened to the wall studs with anti-tip kits screwed to the back of the case near its top.');
    else if(s.anchorWhy.includes('kind'))out.push(`${s.kind.word[0].toUpperCase()+s.kind.word.slice(1)} is fastened to the wall studs with anti-tip kits.`);
    else out.push('It is fastened to the wall studs with anti-tip kits, as you asked.');
  }
  if(s.top==='rails')out.push('The top you buy adds its thickness to the height.');
  return out.join(' ');
}
function caseNotes(p){
  const s=casePlan(p),bay=Math.max(...s.bays.map(b=>b.len)),sqft=bay*s.D/144,psf=USES[s.shelfUse].psf;
  const load=s.shelfUse==='books'?'a full row of books':s.shelfUse==='shelf'?'heavy things (pantry goods, tools)':'light things (clothes, linens)';
  const out=[`Each shelf is sized for ${load}: about ${Math.max(5,Math.round(psf*sqft/5)*5)} lb spread along it (${psf} lb per square foot). These are rule-of-thumb sizes, not an engineer's numbers.`];
  if(s.dividers)out.push(`The ${s.dividers>1?'dividers stand':'divider stands'} on the floor like the sides and ${s.dividers>1?'keep':'keeps'} every shelf under ${fmt(Math.ceil(bay))} long, which is what stops the sag.`);
  if(s.anchored){
    const kits=`${CASE_ANTI_TIP.count(s)} anti-tip kits (bought), their brackets screwed to the back of the case into ${caseAntiTipInto(s).replace(/, through the back panel$/,'')} and into wall studs, where they do not show`;
    const loaded=s.shelfUse==='books'?'Loaded with books it':'Loaded, it';
    out.push(s.anchorWhy.includes('tall')?`This case is more than 4 times as tall as it is deep. ${loaded} can be pulled over, so it must be fastened to the wall with ${kits}. Do not skip that step.`
      :`It is fastened to the wall with ${kits}. Do not skip that step.`);
  }else out.push('It is low enough to stand on its own. If children may climb it, strap it to a wall stud anyway.');
  // the holes a person in front would see, plugged in Everyday and Fine (js/caselooks.js)
  // (only pieces that really take pocket holes: casePluggedWords, which knows a narrow bay has none in most boards)
  const seen=casePluggedWords(p),plugged=[];
  if(seen.top)plugged.push('under the top');
  const under=seen.shelves.filter(y=>!seen.onTop.includes(y));
  if(under.length)plugged.push(`under the ${under.length>1?'shelves':'shelf'} at ${listWords(under)}`);
  if(seen.onTop.length)plugged.push(`on top of the ${seen.onTop.length>1?'shelves':'shelf'} at ${listWords(seen.onTop)}`);
  if(seen.atDivider.length)plugged.push(`at the left end of the ${seen.atDivider.length>1?'shelves':'shelf'} at ${listWords(seen.atDivider)} on the right of ${s.dividers>1?'each divider':'the divider'}`);
  if(seen.rails)plugged.push('under the top rails');
  if(seen.sides)plugged.push('near the top of the sides, on their inside faces');
  if(seen.dividerTop)plugged.push(`near the top of the ${s.dividers>1?'dividers':'divider'}`);
  if(plugged.length)out.push(`A person in front of the case (standing, seated${seen.onTop.length?' or on a step stool':''}) would see the pocket holes ${listWords(plugged)}, so in Everyday and Fine furniture they are filled with glued pocket-hole plugs, sanded flush. The shopping list buys the plugs.`);
  if(s.back!=='panel')out.push(`With no plywood back, the rails under the top and under the bottom keep the case from leaning sideways. It is less stiff than a case with a back: do not leave the rails out.`);
  if(s.top==='rails')out.push('The top is bought (a stone or laminate top, or a vanity top): rest it on the rails, set in a few dots of silicone or screwed up through the rails, as its maker says. Its thickness adds to the height.');
  return out;
}
function caseHardware(p){
  const s=casePlan(p);
  // anti-tip kits in place of screws through a rail under the top (js/caselooks.js, the owner of 20 Nov)
  return s.anchored?[[CASE_ANTI_TIP.label,CASE_ANTI_TIP.count(s)]]:[];
}
function caseUses(p){
  const s=casePlan(p);
  return{Side:'none',Divider:'none',Top:s.topUse,'Top rail':s.topUse,Bottom:s.bottomUse,Shelf:s.shelfUse,
    'Toe kick':s.bottomUse,'Base rail':s.bottomUse,'Back rail':'none'};
}
/* The fasteners the case names (3.1 of the spec). Everyday and Fine furniture: pocket holes on a face nobody
   sees (under a board, on the back of a rail, on the face of a divider), so no head shows on the top, the front or
   the outside of a side (the owner, 16 Nov); in a bay too narrow for a pocket-hole drill the boards are screwed
   through the sides and the heads plugged. Rustic / rough screws through the sides. Joints at a divider are left
   to the shapes (screws through the divider; the second board at the same height gets angled screws,
   js/fastenerreach.js). */
/* Fine furniture fills every pocket hole of the shelves, of a top between the sides and of flat top rails with
   glued pocket-hole plugs (js/fasteners.js asks, pocketPluggedByPreset): the ones in their undersides, and the
   ones a shelf or a top higher than 54" takes in its top face instead (rule 13, js/fasteners.js), which a person
   sees looking down on a shelf at chest height or from a step stool. The bottom's are hidden by the toe kick and
   the floor. The owner, 20 Nov, on the rest: "i would prefer them hidden": in Everyday and Fine every pocket hole a
   person standing or seated in front can see is plugged too (casePocketInSight, js/caselooks.js). */
const CASE_PLUGGED_IN_FINE=['Shelf','Top','Top rail'];
function casePocketsPlugged(piece,out,style){
  if(style==='fine'&&CASE_PLUGGED_IN_FINE.includes(piece.name)&&Math.abs(out[1])>.5)return true;
  // the holes in the top face of a shelf above every standing eye are plugged in Everyday too: a person on a step
  // stool, or taking a book from the top shelf, looks down on them (the fixing round of the case looks job)
  if(style==='std'&&piece.name==='Shelf'&&out[1]>.5)return true;
  return style!=='rustic'&&casePocketInSight(piece,out);
}
/* The face of a piece that stays out of sight (js/fasteners.js asks, hiddenFaceByPreset): a back rail is drilled
   and screwed from its back face, also in an open-backed case that is not screwed to the wall. The back of a piece
   for the house is not a face anybody looks at (SHOW_FACES, js/showfaces.js); its front is seen in every bay. */
function caseHiddenFace(piece,axis){
  // a shelf or the top between the sides: its top face when nobody sees that, else its underside (plugged where that
  // is seen: casePocketsPlugged); from the eyes of a person in front (caseBoardFace, js/caselooks.js)
  if(axis===1&&CASE_TOP_FACE_BOARDS.includes(piece.name))return caseBoardFace(piece,caseSightParts(piece))==='top'?1:-1;
  if(axis!==2)return 0;
  // the back rail, and the back one of the two top rails that stand on edge under a top you buy (the pieces are
  // built with the back of the case at z = 0: js/casebuild.js)
  const backTopRail=piece.name==='Top rail'&&size(piece)[2]<=CASE.T+1e-6&&piece.pos[2]<1;
  return piece.name==='Back rail'||backTopRail?-1:0;
}
/* Is there a shelf on the other face of the divider of this joint, at the same height? (a joint of a Divider and
   a Shelf; worked out from the plan and the two pieces alone). Every bay has its bottom, toe kick, rails, so only a
   shelf can stand alone: beside an open middle bay ("The middle bay holds: Nothing"). */
/* Where a piece is inside its own case: its corner measured from the lowest corner of the case, which is where
   buildCase puts 0. A placed case may stand beside another design or be moved; the plan's numbers are inside the
   case (the code review of the case looks job, finding 11). */
function caseLocalPos(piece){
  if(piece.set===undefined||typeof S==='undefined'||!S.parts.includes(piece))return piece.pos;
  const own=S.parts.filter(other=>other.set===piece.set).map(plainBox);
  const corner=[0,1,2].map(k=>Math.min(...own.map(b=>b.lo[k])));
  return piece.pos.map((v,k)=>v-corner[k]);
}
function caseShelfPairedAtDivider(s,j){
  const divider=j.a.name==='Divider'?j.a:j.b,shelf=divider===j.a?j.b:j.a;
  const dividerPos=caseLocalPos(divider),shelfPos=caseLocalPos(shelf);
  // the pieces were moved so the lowest corner of the case is at 0 (buildCase): a top laid on with an overhang
  const shift=s.topOver?s.overSide:0;
  const dividerX=dividerPos[0]-shift;
  const k=s.bays.findIndex((bay,index)=>index>0&&Math.abs(bay.x-s.T-dividerX)<.01);
  if(k<0)return true;
  const onLeft=shelfPos[0]-shift<dividerX;
  const other=s.bays[onLeft?k:k-1];
  return other.shelfY.some(y=>Math.abs(y-shelfPos[1])<1/32);
}
/* Is this joint of a Divider and a Shelf the SECOND board of a pair (the shelf on the right of the divider, with a
   shelf on its left at the same height) on a shelf whose underside is seen from below (more than SEEN.underAbove
   up, rule 13 in js/fasteners.js)? Such a shelf cannot take the angled screws of the second board: from its
   underside their heads are in plain sight from below, and from its top face they sit on the floor of an open
   shelf below the eye (the preset audit of 20 Nov, finding 1: the 36" x 72" Bookshelf). It is held the way its
   other end is held at the side: pocket screws from the face rule 13 gives it, plugged in Fine furniture
   (casePocketsPlugged), and in Rustic / rough the screws of the style. Judged from the plan and the two pieces.
   For stage 2 (doors, adjustable shelves): behind a door the angled screws would be hidden, and the words of
   CASE_SECOND_BOARD_HIDDEN ("angled screws that high would leave their heads in plain sight") would no longer be
   true there; this rule and those words then need to know about the door (the code review of the audit fixes, 15). */
/* looks (caseLooks, js/caselooks.js): since the case looks job, "high" is a shelf whose underside a person standing
   or seated in front sees (a seated eye is 44" up), not only one more than 54" up. */
function caseHighSecondShelf(s,j,looks){
  if(!caseShelfPairedAtDivider(s,j))return false;
  const divider=j.a.name==='Divider'?j.a:j.b,shelf=divider===j.a?j.b:j.a;
  const onRight=shelf.pos[0]>divider.pos[0],y=caseLocalPos(shelf)[1];
  return onRight&&(looks?looks.shelfUnderSeen(y):y>SEEN.underAbove);
}
/* the dividers that have a shelf on both of their faces (the steps speak of the second shelf only at those) */
function caseDividersWithPairedShelves(s){
  return s.bays.slice(1).filter((bay,k)=>bay.shelfY.length&&s.bays[k].shelfY.length).length;
}
function caseJoints(p){
  const s=casePlan(p),looks=caseLooks(p);
  const atSide=s.narrow?'pluggedUnlessRustic':'pocketUnlessRustic';
  const rows=[];
  // A laid-on top whose rails a person in front sees from below is held by pocket screws from the inside faces of the
  // sides, up into the top (plugged where seen), and only glued to the rails: screws up through the 3/4" rails with
  // their heads sunk under 3/8" plugs would come within 1/8" of the top surface (the fixing round of the case looks
  // job; caseTopBySides).
  const bySides=caseTopBySides(s,looks);
  // the boards that span a bay, and the rails under the bottom: plugged screws through the sides in a narrow bay,
  // where a pocket-hole driver has no room between the sides (the toe kick's space too)
  for(const board of['Top','Bottom','Shelf','Top rail'])rows.push(['Side',board,board==='Top'&&s.top==='over'?(bySides?'pocketUnlessRustic':'glue'):atSide]);
  for(const rail of['Toe kick','Base rail'])rows.push(['Side',rail,atSide]);
  // (a back rail is drilled on its back face, outside the case, where the driver has room in any bay)
  rows.push(['Side','Back rail','pocketUnlessRustic']);
  // At a divider, in every style, the board in the bay on its left is screwed straight through the divider and the
  // one on its right gets angled screws (js/fastenerreach.js), as the steps say (CASE_SECOND_BOARD): named here so
  // that the shapes or the style never choose another way the words do not describe. A shelf with no shelf on the
  // divider's other face (an open middle bay) is held as at a side: no head is left in plain sight in the open bay.
  const paired={when:j=>caseShelfPairedAtDivider(s,j)};
  // (the second shelf of a pair, high up: pocket screws as at a side, never angled screws on a show face)
  rows.push(['Divider','Shelf','pocketUnlessRustic',{when:j=>caseHighSecondShelf(s,j,looks)}]);
  for(const board of['Bottom','Shelf','Toe kick','Base rail','Back rail'])rows.push(['Divider',board,'screw',...(board==='Shelf'?[paired]:[])]);
  rows.push(['Divider','Shelf',atSide]);
  if(s.top==='rails')rows.push(['Divider','Top rail','screw']);
  rows.push(['Bottom','Toe kick','pocketUnlessRustic'],['Bottom','Base rail','pocketUnlessRustic']);
  // The top on a divider: pocket screws from the divider near its top end, plugged where a person sees them
  // (casePocketsPlugged). Never screwed down through the top: that is a top surface, at any height (the real-thing
  // review of the case looks job, finding 2).
  if(s.top==='inside')rows.push(['Top','Back rail','pocketUnlessRustic'],['Top','Divider','pocketUnlessRustic']);
  if(s.top==='over'){
    // the top is screwed up through its rails from inside the case, and glued to the top of the sides
    // (where a person in front sees the undersides of the rails, by pocket screws from the sides instead, at any
    // height: casePlan no longer refuses a tall case with a top laid on). The rails are screwed down into the
    // dividers: the top covers those heads (js/caselooks.js).
    rows.push(['Top','Top rail',bySides?'glue':'screw',{through:'Top rail'}],['Top rail','Divider','screw',{through:'Top rail'}],
      ['Back rail','Top rail','screw',{through:'Top rail'}],['Top','Back panel','none']);
  }
  return rows;
}
