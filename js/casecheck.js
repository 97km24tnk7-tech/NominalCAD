/* NominalCAD: what the cabinet builder says about a case (design/specs/01-cabinet-case-builder.md, 3.1 and 4).

     caseCheck(p)     the warning box: [{level, text, fix}] for numbers that cannot work together (the plan's
                      refusals: too many shelves, opening heights that do not fit, a bay set by hand too wide,
                      a top larger than a sheet). "stop" blocks Create.
     caseInfo(p)      the remark under the form: the openings, what the program put right and why
     caseNotes(p)     the notes of the design: the load, the dividers, the wall
     caseHardware(p)  the screws into the wall studs
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
  if(s.anchored){
    if(s.anchorWhy.includes('tall'))out.push(`It is more than 4 times as tall as it is deep, so it must be screwed to the wall studs through the rail ${s.backRail?'under its top':'at the back of its top'}.`);
    else if(s.anchorWhy.includes('kind'))out.push(`${s.kind.word[0].toUpperCase()+s.kind.word.slice(1)} is screwed to the wall studs.`);
    else out.push('It is screwed to the wall studs, as you asked.');
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
    const rail=s.backRail?'the back rail under its top':'the top rail at its back';
    const loaded=s.shelfUse==='books'?'Loaded with books it':'Loaded, it';
    out.push(s.anchorWhy.includes('tall')?`This case is more than 4 times as tall as it is deep. ${loaded} can be pulled over, so it must be screwed to the wall studs through ${rail}. Do not skip that step.`
      :`It is screwed to the wall studs through ${rail}. Do not skip that step.`);
  }else out.push('It is low enough to stand on its own. If children may climb it, strap it to a wall stud anyway.');
  if(s.back!=='panel')out.push(`With no plywood back, the rails under the top and under the bottom keep the case from leaning sideways. It is less stiff than a case with a back: do not leave the rails out.`);
  if(s.top==='rails')out.push('The top is bought (a stone or laminate top, or a vanity top): rest it on the rails, set in a few dots of silicone or screwed up through the rails, as its maker says. Its thickness adds to the height.');
  return out;
}
function caseHardware(p){
  const s=casePlan(p);
  return s.anchored?[[`Wood screws, 3", through the ${s.backRail?'back rail':'back top rail'} into the wall studs`,2*s.studs]]:[];
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
   sees looking down on a shelf at chest height or from a step stool. Everyday leaves them open: the owner has not
   said yet whether he wants them plugged there too (spec, section 8). The bottom's are hidden by the toe kick and
   the floor. */
const CASE_PLUGGED_IN_FINE=['Shelf','Top','Top rail'];
function casePocketsPlugged(piece,out,style){
  return style==='fine'&&CASE_PLUGGED_IN_FINE.includes(piece.name)&&Math.abs(out[1])>.5;
}
/* The face of a piece that stays out of sight (js/fasteners.js asks, hiddenFaceByPreset): a back rail is drilled
   and screwed from its back face, also in an open-backed case that is not screwed to the wall. The back of a piece
   for the house is not a face anybody looks at (SHOW_FACES, js/showfaces.js); its front is seen in every bay. */
function caseHiddenFace(piece,axis){
  if(axis!==2)return 0;
  // the back rail, and the back one of the two top rails that stand on edge under a top you buy (the pieces are
  // built with the back of the case at z = 0: js/casebuild.js)
  const backTopRail=piece.name==='Top rail'&&size(piece)[2]<=CASE.T+1e-6&&piece.pos[2]<1;
  return piece.name==='Back rail'||backTopRail?-1:0;
}
/* Is there a shelf on the other face of the divider of this joint, at the same height? (a joint of a Divider and
   a Shelf; worked out from the plan and the two pieces alone). Every bay has its bottom, toe kick, rails, so only a
   shelf can stand alone: beside an open middle bay ("The middle bay holds: Nothing"). */
function caseShelfPairedAtDivider(s,j){
  const divider=j.a.name==='Divider'?j.a:j.b,shelf=divider===j.a?j.b:j.a;
  // the pieces were moved so the lowest corner of the case is at 0 (buildCase): a top laid on with an overhang
  const shift=s.topOver?s.overSide:0;
  const dividerX=divider.pos[0]-shift;
  const k=s.bays.findIndex((bay,index)=>index>0&&Math.abs(bay.x-s.T-dividerX)<.01);
  if(k<0)return true;
  const onLeft=shelf.pos[0]-shift<dividerX;
  const other=s.bays[onLeft?k:k-1];
  return other.shelfY.some(y=>Math.abs(y-shelf.pos[1])<1/32);
}
/* the dividers that have a shelf on both of their faces (the steps speak of the second shelf only at those) */
function caseDividersWithPairedShelves(s){
  return s.bays.slice(1).filter((bay,k)=>bay.shelfY.length&&s.bays[k].shelfY.length).length;
}
function caseJoints(p){
  const s=casePlan(p);
  const atSide=s.narrow?'pluggedUnlessRustic':'pocketUnlessRustic';
  const rows=[];
  // the boards that span a bay, and the rails under the bottom: plugged screws through the sides in a narrow bay,
  // where a pocket-hole driver has no room between the sides (the toe kick's space too)
  for(const board of['Top','Bottom','Shelf','Top rail'])rows.push(['Side',board,board==='Top'&&s.top==='over'?'glue':atSide]);
  for(const rail of['Toe kick','Base rail'])rows.push(['Side',rail,atSide]);
  // (a back rail is drilled on its back face, outside the case, where the driver has room in any bay)
  rows.push(['Side','Back rail','pocketUnlessRustic']);
  // At a divider, in every style, the board in the bay on its left is screwed straight through the divider and the
  // one on its right gets angled screws (js/fastenerreach.js), as the steps say (CASE_SECOND_BOARD): named here so
  // that the shapes or the style never choose another way the words do not describe. A shelf with no shelf on the
  // divider's other face (an open middle bay) is held as at a side: no head is left in plain sight in the open bay.
  const paired={when:j=>caseShelfPairedAtDivider(s,j)};
  for(const board of['Bottom','Shelf','Toe kick','Base rail','Back rail'])rows.push(['Divider',board,'screw',...(board==='Shelf'?[paired]:[])]);
  rows.push(['Divider','Shelf',atSide]);
  if(s.top==='rails')rows.push(['Divider','Top rail','screw']);
  rows.push(['Bottom','Toe kick','pocketUnlessRustic'],['Bottom','Base rail','pocketUnlessRustic']);
  if(s.top==='inside')rows.push(['Top','Back rail','pocketUnlessRustic'],['Top','Divider','pocketUnlessRustic']);
  if(s.top==='over'){
    // the top is screwed up through its rails from inside the case, and glued to the top of the sides
    // (only on cases low enough that the underside of the rails is out of sight: casePlan refuses taller ones, C15)
    rows.push(['Top','Top rail','screw',{through:'Top rail'}],['Top rail','Divider','pocketUnlessRustic'],
      ['Back rail','Top rail','screw',{through:'Top rail'}],['Top','Back panel','none']);
  }
  return rows;
}
