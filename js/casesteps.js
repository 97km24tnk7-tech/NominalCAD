/* NominalCAD: the build steps of the cabinet builder (design/specs/01-cabinet-case-builder.md, section 3.2).

   caseSteps(p) writes the steps from the plan (casePlan, js/caseplan.js), in the order a drill can follow: the
   marking, where Everyday and Fine furniture also drill every pocket hole ahead (the owner, 16 Nov: "you want all
   your pieces made and then you just assemble it"), the bottoms, then the toe kicks under them with the case
   upside down (afterwards a drill no longer fits between a bottom and the first shelf), the shelves bottom up, the
   top, the back rails, the back, the finish, and last standing it up and fastening it to the wall when it must be.
   Words that differ by build style are written for each style (styledStep, js/style.js): Everyday and Fine
   furniture hold every board from a face nobody sees (pocket holes under a board, on the face of a rail that looks
   into the space under the bottom, on the back of a back rail), Rustic / rough screws through the sides.
   The "Fasten with" lines under each step come from the model (js/buildsteps.js), so these words never give a
   count of screws; they say what to do and in what order.

   Stage 1: steps 1 and 3 to 9, 11 and 17 of the spec (edge banding, step 2, comes with the doors in stage 2).
   Where two boards meet one divider from its two sides, the board in the bay on the LEFT of the divider (as you face
   the front of the case) is screwed through the divider first and the one on its right gets screws driven at an
   angle (js/fastenerreach.js decides it the same way; caseSecondBoardOnTheRight in js/casechecks.js holds the two
   together). A shelf with an open bay on the divider's other side is held as at a side (caseJoints). */
'use strict';

/* The words for the second board at a divider (the fault the owner's lead found: "the first one" named no bay).
   high: the heights of the shelves whose angled screws start in the top face (Rustic: the shelves caseBoardFace
   drills on top, js/caselooks.js; the builder's hiddenFace has the last word in js/fastenerreach.js). some: only some dividers
   have a shelf on both faces (the others stand beside an open bay). */
const CASE_SECOND_BOARD=(high,some)=>`At each divider${some?' with a shelf on both of its faces':''}, screw through the divider into the end of the board in the bay on its left first (left as you face the front of the case), as the list below says. That board then covers the spot where a straight screw into the board on its right would go in. So glue the board on the right and fasten it with two of the same screws driven at an angle: start each one in the underside of the board, near its end, and slant it up into the divider`+
  (high.length?` (for the ${high.length>1?'shelves':'shelf'} at ${listWords(high)}, start them in the top face instead and slant them down: an underside that high is in plain sight from below)`:'')+'. Drill the pilot holes at the same slant.';
/* The same words for Everyday and Fine furniture. A shelf on the right of a divider whose underside a person in
   front sees takes pocket screws there instead of angled screws (caseHighSecondShelf, js/casecheck.js):
   angled screws would put their heads on the shelf, in plain sight. high: the heights of those shelves; lowToo:
   some shelf (or bottom) of a pair is lower and still gets the angled screws. */
const CASE_SECOND_BOARD_HIDDEN=(high,some,lowToo=true,narrow=false)=>{
  if(!high.length)return CASE_SECOND_BOARD([],some);
  const first=`At each divider${some?' with a shelf on both of its faces':''}, screw through the divider into the end of the board in the bay on its left first (left as you face the front of the case), as the list below says. That board then covers the spot where a straight screw into the board on its right would go in.`;
  const angled=' So glue the board on the right and fasten it with two of the same screws driven at an angle: start each one in the underside of the board, near its end, and slant it up into the divider. Drill the pilot holes at the same slant.';
  const shelves=`the ${high.length>1?'shelves':'shelf'} at ${listWords(high)}`;
  // (in a narrow bay the other end is screwed through the side, so the pocket holes are named by the list)
  const how=narrow?'from the pocket holes near that end that the list below names':'from the holes near that end, the same way as at its other end';
  const pocket=lowToo?` For ${shelves}, glue the board on the right and hold it with pocket screws instead, ${how}: angled screws that high would leave their heads in plain sight.`
    :` So glue the board on the right and drive the pocket screws listed below ${how}.`;
  return first+(lowToo?angled:'')+pocket;
};
/* The heights of the shelves that are the second board of a pair at a divider and "high" (they take pocket screws
   there, caseHighSecondShelf), and whether any shelf of a pair is not. looks (caseLooks, js/caselooks.js): "high" is a
   shelf whose underside a person in front sees, as caseHighSecondShelf judges it (the case looks job); without it
   (the retired Bookshelf's words), more than SEEN.underAbove up as before. */
function caseHighPairedShelves(s,looks){
  const high=new Set();
  let low=false;
  s.bays.forEach((bay,k)=>{
    if(!k)return;
    for(const y of bay.shelfY){
      if(!s.bays[k-1].shelfY.some(other=>Math.abs(other-y)<1/32))continue;
      if(looks?looks.shelfUnderSeen(y):y>SEEN.underAbove)high.add(r16(y));else low=true;
    }
  });
  return{high:[...high].sort((a,b)=>a-b),low};
}
/* Rule 13 (js/fasteners.js) as the fastener layout decides it, asked of the very pieces this case is built from:
   the words read the same function as the layout (undersideHoleFace), so a step can never say "in its top face"
   while its "Fasten with" lines say "the underside" (the woodworker's-eye review, E1: the top of a 40" x 84"
   case with a divider, whose middle lies on the divider). parts: buildCase(p).
     top          'under', 'top' or 'plugged', for the top that sits between the sides
     shelfOnTop(y) true when every shelf whose underside is at height y takes its holes in its top face */
function caseHoleFaces(parts){
  const faceOf=piece=>undersideHoleFace(piece,parts);
  const top=parts.find(piece=>piece.name==='Top');
  const shelfOnTop=y=>{
    const shelves=parts.filter(piece=>piece.name==='Shelf'&&Math.abs(piece.pos[1]-y)<.01);
    return shelves.length>0&&shelves.every(piece=>faceOf(piece)==='top');
  };
  return{top:top?faceOf(top):'under',shelfOnTop};
}
/* A step that fills pocket holes with glued plugs names what trims them flush (the owner, 20 Nov: the step that glues
   them lists them, with glue and a way to trim them): the plugs and the glue are on its list from the fasteners, the
   saw and the sanding block are its own tools (presetStepTools, js/buildsteps.js), in each style that plugs there.
   plugs: {std, fine}, true where that style's words plug pocket holes in this step. */
/* a case taller than this gets its laid-on top while it lies on its back (nobody lifts a top over their head) */
const CASE_TOP_ON_LYING_FROM=60;
const CASE_PLUG_TOOL='flush-cut saw and a sanding block, to trim the pocket-hole plugs flush';
function withPlugTools(step,plugs){
  if(!plugs.std&&!plugs.fine)return step;
  return{...step,tools:{std:plugs.std?[CASE_PLUG_TOOL]:[],fine:plugs.fine?[CASE_PLUG_TOOL]:[],rustic:[]}};
}
const CASE_SECOND_RAIL='the one in the bay on its left (as you face the front) is screwed through the divider, and the one in the bay on its right gets its two screws driven at an angle through its end into the divider';

/* Everyday and Fine furniture: every pocket hole is drilled in the marking step, before anything goes together
   (spec 3.2 step 3, the owner's rule of 16 Nov 7:35 PM). Where each piece takes them, from the plan; the steps
   after it name the holes again with their screws. Returns {words, drill}: drill is the sentence that tells to
   drill the pocket holes, the step's drill field (styledStep, js/style.js), which the step leaves out while step 2
   "Drill your pieces" (js/drillplan.js) holds every pocket hole on its drawings. The screw holes through the sides
   of a narrow bay are a drill sentence of kind 'screw' (left out while step 2 holds them). faces: caseHoleFaces, the faces the fastener
   layout really drills (the top's face named from it). */
function casePocketHolesAhead(s,heights,highShelves,faces,highSecond=[]){
  const words=casePocketHolesAheadWords(s,heights,highShelves,faces,highSecond);
  const at=words.indexOf(' Then drill ');
  // (stage 2: the screw holes and counterbores through the sides of a narrow bay are on the drawings of step 2 too)
  return{words,drill:(at<0?[]:[words.slice(at)]).concat(s.narrow?[{text:at<0?words:words.slice(0,at),kind:'screw'}]:[])};
}
/* highSecond: the heights of the shelves on the right of a divider, more than SEEN.underAbove up, that take pocket
   screws into it (caseHighSecondShelf). In a narrow case they are the one place with pocket holes in a shelf: the
   list names them, and the narrow sentence says why and how they are driven (the review of the audit fixes, real
   thing 5 and code 2: the list left them out, and the sentence said no pocket screws are used). */
function casePocketHolesAheadWords(s,heights,highShelves,faces,highSecond=[]){
  const div=s.dividers,bottoms=div?'each bottom board':'the bottom board',where=[];
  const shelvesToo=heights.length?(heights.length>1?' and of every shelf':' and of the shelf'):'';
  const highWords=`the ${highSecond.length>1?'shelves':'shelf'} at ${listWords(highSecond)} on the right of ${div>1?'each divider':'the divider'}`;
  // (faces.secondOnTop: the heights among highSecond whose holes are in the top face; the others are underneath)
  const secondFace=!faces.secondOnTop||highSecond.every(y=>faces.secondOnTop.includes(y))?'its top face'
    :highSecond.every(y=>!faces.secondOnTop.includes(y))?'its underside':'its top face or underside, as the list below says';
  if(!s.narrow){
    where.push(`near both ends of ${bottoms}${shelvesToo}, in its underside`+
      (highShelves.length?` (in the top face instead for the ${highShelves.length>1?'shelves':'shelf'} at ${listWords(highShelves)})`:''));
  }else if(highSecond.length)where.push(`near the left end of ${highWords}, in ${secondFace}, for the divider`);
  if(s.base==='kick')where.push(s.narrow?`in each toe kick${s.baseRail?' and base rail':''}, along the face that will look into the space under the bottom, for the bottom board`
    :`in each toe kick${s.baseRail?' and base rail':''}, on the face that will look into the space under the bottom, near its ends and along it`);
  if(s.backRail)where.push('in each back rail, on its back face, near its ends and along it');
  if(!s.narrow&&s.top==='inside'){
    const face=faces.top==='top'?'top face':'underside';
    where.push(`near both ends of the top, in its ${face}`);
  }
  if(!s.narrow&&s.top==='over')where.push('near both ends of the two top rails, in their undersides');
  // (a laid-on top whose rails are seen from below is held by pocket screws from the sides: caseTopBySides)
  if(faces.topBySides)where.push('along the top end of each side, on its inside face, for the top');
  if(!s.narrow&&s.top==='rails')where.push('near both ends of each top rail: the front one on the face that will look into the case, the back one on its back face');
  // (the top rails of a laid-on top are screwed down into the dividers instead; the top between the sides never is)
  if(div&&s.top==='inside')where.push(`in ${div>1?'each divider':'the divider'}, near its top end on both faces, for the top`);
  const narrowWords=s.narrow?` In a bay this narrow a pocket-hole drill has no room, so the boards are screwed through the sides instead: at every mark, drill the screw holes through the sides now, each with a counterbore (a wider hole for the head) as deep as the lists of the next steps say.`+
    (highSecond.length?` The one exception is the left end of ${highWords}: there is no side to screw through there, and angled screws that high would show, so it takes two pocket screws into the divider, driven with a right-angle drill attachment.`:''):'';
  if(!where.length)return narrowWords;
  return narrowWords+` Then drill ${s.narrow?'the pocket holes':'every pocket hole'} now, before anything goes together, so that what follows is only putting the pieces together: ${where.length<2?where.join(''):where.slice(0,-1).join('; ')+'; and '+where[where.length-1]}. The steps below say which screw goes in which hole.`;
}

function caseSteps(p){
  const s=casePlan(p),div=s.dividers,heights=s.shelfY.map(fmt);
  // the faces of the holes, as the fastener layout puts them: from the eyes of a person in front (caseLooks,
  // js/caselooks.js; the same rule the preset's hiddenFace and pluggedPockets give the layout)
  const parts=buildCase(p),looks=caseLooks(p);
  // the pocket holes these words fill with plugs in Everyday (only pieces that really take pocket holes)
  const seen=casePluggedWords(p);
  const faces={top:looks.top||'under',shelfOnTop:y=>looks.shelfFace(y)==='top',topBySides:seen.sides};
  const bottomWord=s.boards?'bottom board':'bottom panel',bottomWords=div?bottomWord+'s':bottomWord;
  const shelfWord=heights.length===1?'shelf':'shelves';
  const uprights=div?`the two sides and the ${div>1?div+' dividers':'divider'}`:'the two sides';
  const between=div?`uprights (the two sides and the ${div>1?'dividers':'divider'}), one bay at a time from the left`:'sides';
  const bayWord=div?' A bay is the space between two uprights.':'';
  const upright=div?'upright':'side';
  const atDivider=div?' '+CASE_SECOND_BOARD([],false):'';
  // the shelves: the second board only at the dividers that have a shelf on both faces
  const pairedDividers=caseDividersWithPairedShelves(s);
  const seenUnder=s.shelfY.filter(faces.shelfOnTop).map(fmt);
  const atDividerHigh=pairedDividers?' '+CASE_SECOND_BOARD(seenUnder,pairedDividers<div):'';
  // Everyday and Fine furniture: the second shelf of a pair high up takes pocket screws (caseHighSecondShelf)
  const highPairs=caseHighPairedShelves(s,looks);
  faces.secondOnTop=highPairs.high.filter(y=>looks.shelfFace(y)==='top').map(fmt);
  const atDividerHidden=pairedDividers?' '+CASE_SECOND_BOARD_HIDDEN(highPairs.high.map(fmt),pairedDividers<div,highPairs.low,s.narrow):'';
  const railAtDivider=div?` At each divider, ${CASE_SECOND_RAIL}.`:'';
  const steps=[STORAGE_CUT_STEP];
  // Everyday and Fine furniture in a bay too narrow for a pocket-hole drill (casePlan: narrow): screws through the
  // sides with their heads sunk and plugged (caseJoints, js/casecheck.js); the holes are drilled when marking
  const plugged=(what,why=true)=>` Add glue, and drive the screws listed below through the holes in each side into each end of ${what}, each head sunk in its counterbore. Then glue a wooden plug into each hole, so no screw shows on the sides (the plugs are cut flush when you finish).`+(why?' (The bay is too narrow for a pocket-hole drill.)':'');
  // Fine furniture fills the pocket holes of the shelves, the top and its rails (casePocketsPlugged)
  const plugPockets=' Then fill those pocket holes with glued pocket-hole plugs and sand them flush, as the list says, so no hole shows.';

  // marking: the heights of the bottom and every shelf, measured from the bottom end of the sides; in Everyday and
  // Fine furniture every pocket hole is drilled now too
  const highShelves=s.shelfY.filter(faces.shelfOnTop).map(fmt);
  const highNote=highShelves.length?` (in its top face instead for the ${highShelves.length>1?'shelves':'shelf'} at ${listWords(highShelves)}: an underside that high is in sight of a person in front, and the top face is above the eye of even a tall grown-up)`:'';
  // the shelves whose holes stay underneath and are seen by a person standing or seated in front: plugged in Everyday
  // as in Fine (casePocketsPlugged, js/casecheck.js); in a narrow case only the left ends of the high shelves on the
  // right of a divider have pocket holes (casePluggedWords)
  const pluggedShelves=seen.shelves,pluggedAtDivider=seen.atDivider;
  const seenWhy=seen.onTop.length===pluggedShelves.length?'a person on a step stool looks down on them'
    :seen.onTop.length?'a person standing or sitting in front sees them, and the top face of a high shelf is seen from a step stool'
    :`a person standing or sitting in front sees ${pluggedShelves.length>1?'those undersides':'that underside'}`;
  const plugSeenShelves=pluggedShelves.length?` Then fill the pocket holes of the ${pluggedShelves.length>1?'shelves':'shelf'} at ${listWords(pluggedShelves)} with glued pocket-hole plugs (the bag on the list) and sand them flush when the glue is dry: ${seenWhy}.`
    :pluggedAtDivider.length?` Then fill the pocket holes at the left end of the ${pluggedAtDivider.length>1?'shelves':'shelf'} at ${listWords(pluggedAtDivider)} with glued pocket-hole plugs (the bag on the list) and sand them flush when the glue is dry: a person standing or sitting in front sees them.`:'';
  const openings=s.fit&&s.shelves?` Every opening between the boards is ${fmt(s.fit.gap)} clear${s.fit.alike?'':`, except the ${s.fit.at} one, which is ${fmt(s.fit.leftover)}`}. From the bottom up: ${caseBuiltOpenings(s).map(fmt).join(', ')}.`
    :s.customOpenings&&!s.fit?` The shelves are not evenly spaced. The clear openings between the boards are, from the bottom up: ${caseBuiltOpenings(s).map(fmt).join(', ')}.`:'';
  const bottomMark=s.yF>0?`${bottomWord} ${fmt(s.yF)}`:`${bottomWord} flush with the bottom ends (it stands on the floor)`;
  const shorter=!div?'':s.top==='rails'?` The ${div>1?'dividers are':'divider is'} as tall as the sides: the top rails fit between them.`
    :` The ${div>1?'dividers are':'divider is'} 3/4" shorter than the sides, because the ${s.top==='over'?'top rails sit':'top sits'} on ${div>1?'them':'it'}.`;
  const marking=`Lay ${uprights} next to each other with their bottom ends lined up, and mark the shelf positions across all of them at once so they match. Underside of each piece, measured from the bottom end of the side: ${bottomMark}${heights.length?`, ${shelfWord} `+heights.join(', '):''}.`+openings+shorter;
  const ahead=casePocketHolesAhead(s,heights,highShelves,faces,highPairs.high.map(fmt));
  steps.push(styledStep({std:marking+ahead.words,rustic:marking},['Side','Divider'],ahead.drill));

  // the bottoms
  const bottomLead=`Fasten the ${bottomWords} between the ${between}, at the lowest mark, flush with the front and back edges.${bayWord}`;
  steps.push(styledStep({
    std:s.narrow?bottomLead+plugged('the '+bottomWord)+atDivider
      :`${bottomLead} Glue the ends and drive the pocket screws listed below into the ${div?'uprights':'sides'} from the holes in the underside of each ${s.boards?'board':'panel'}, near its ends, so that no screw shows on the outside of the sides.`+atDivider,
    rustic:`${bottomLead} Drill pilot holes, add glue, and drive two screws through the ${upright} into each end of a ${s.boards?'board':'panel'}.`+atDivider},['Bottom']));

  // the toe kicks and base rails, before any shelf, with the case upside down
  if(s.base==='kick'){
    const set=`a toe kick set back ${fmt(s.kickBack)} from the front edge${s.baseRail?' and a base rail flush with the back edge':''}`;
    const them=s.baseRail?'They carry':'It carries';
    const glueThem=s.baseRail?'them':'it';
    const before=heights.length?` Do this now, before the ${shelfWord} ${heights.length===1?'goes':'go'} in: afterwards the drill does not fit between the ${bottomWord} and the first shelf.`:'';
    const overturn=`Turn the case upside down (it is still light, with only its sides and ${bottomWords}), so the space under the ${bottomWord} is open to you.`;
    const underEach=`Under ${div?'each '+bottomWord:'the '+bottomWord}, fasten ${set}.`;
    const pocketsUp=`the pocket screws listed below from the holes in the face of each one that looks into that space`;
    steps.push(styledStep({
      std:s.narrow
        ?`${overturn} ${underEach}${plugged(s.baseRail?'the toe kick and the base rail':'the toe kick',false)} Then drive ${pocketsUp}, up into the ${bottomWord}.`+railAtDivider+` ${them} the ${bottomWord}, so it cannot sag. Stand the case back up.`+before
        :`${overturn} ${underEach} Glue ${glueThem} and drive ${pocketsUp}: ${div?'at an end that meets a side, into the side':'at each end, into the sides'}, and along it, up into the ${bottomWord}.`+railAtDivider+` ${them} the ${bottomWord}, so it cannot sag. Stand the case back up.`+before,
      rustic:`${underEach} Glue ${glueThem}, drive two screws through each ${upright} into each of ${s.baseRail?'their':'its'} ends, and screw down through the ${bottomWord} into ${glueThem} about every 8".`+railAtDivider+` ${them} the ${bottomWord}, so it cannot sag.`+before},['Toe kick','Base rail']));
  }

  // the shelves, bottom up
  if(heights.length){
    const shelvesThe=heights.length===1?'the shelf':'the shelves';
    const eachShelf=heights.length===1?'the shelf':'each shelf';
    const where=div?`uprights, bottom up, one bay at a time from the left`:heights.length===1?'sides':'sides, bottom up';
    const shelfLead=`Fasten ${shelvesThe} between the ${where}, at the marks, flush with the front and back edges, the same way as the ${bottomWord}`;
    const shelfPockets=`${shelfLead}: glue, and the pocket screws listed below from the holes near the ends of each shelf, in its underside${highNote}, into the ${div?'uprights':'sides'}.`;
    // Pocket holes in the top face of a shelf above eye level are out of sight of a person standing or seated in front
    // (js/caselooks.js); Fine furniture still plugs them, after the last pocket screw of the step, the ones at a divider
    // included (the review of the audit fixes, real thing 7). Everyday plugs the ones a person sees (plugSeenShelves),
    // after the last pocket screw too. The owner, 20 Nov: "i would prefer them hidden".
    const plugAll=' Then fill all those pocket holes, at the sides and at the dividers, with glued pocket-hole plugs and sand them flush, as the list says, so no hole shows.';
    steps.push(withPlugTools(styledStep({
      std:(s.narrow?shelfLead+'.'+plugged(eachShelf):shelfPockets)+atDividerHidden+plugSeenShelves,
      fine:s.narrow?shelfLead+'.'+plugged(eachShelf)+atDividerHidden+(highPairs.high.length?' Then fill those pocket holes with glued pocket-hole plugs and sand them flush, as the list says, so no hole shows.':'')
        :shelfPockets+(highPairs.high.length?atDividerHidden+plugAll:plugPockets+atDividerHidden),
      rustic:`${shelfLead}: pilot holes, glue, and two screws through the ${upright} into each end of a shelf.`+atDividerHigh},['Shelf']),
      {std:!!plugSeenShelves,fine:!s.narrow||highPairs.high.length>0}));
  }

  // the top: a board between the sides, two flat rails under a top that lies on the case, or rails on edge
  if(s.top==='inside'){
    // (the top's holes are never in its top face, a top surface: caseTopFaceHidden, js/caselooks.js)
    const topFace=faces.top;
    const topHoles=seen.top?'from the holes in its underside near each end, so nothing shows on the top or on the sides. A person standing or sitting in front sees that underside, so fill those holes with glued pocket-hole plugs (the bag on the list) and sand them flush when the glue is dry'
      :'from the holes in its underside near each end, so nothing shows on the top or on the sides';
    // at a divider: pocket screws from the divider, plugged where a person sees them (caseJoints, js/casecheck.js)
    const dividers=div>1?'each divider':'the divider';
    const toDividers=!div?'':` Then fasten it to the top of ${dividers} with the pocket screws listed below, from the holes in the faces of the divider near its top end.`+
      (seen.dividerTop?' Those holes are in sight in the open bays, so fill them with glued pocket-hole plugs and sand them flush.':'');
    const topPockets=`Fasten the top between the sides, flush with their top ends: glue, and the pocket screws listed below ${topHoles}.`+toDividers;
    const topNarrow='Fasten the top between the sides, flush with their top ends.'+plugged('the top')+toDividers;
    const dividerPlugs=seen.dividerTop;
    steps.push(withPlugTools(styledStep({
      std:s.narrow?topNarrow:topPockets,
      fine:s.narrow?topNarrow:topPockets+(topFace==='plugged'?'':plugPockets),
      rustic:`Fasten the top between the sides, flush with their top ends, with glue and two screws through each side into its end${div?'. Then drive two screws down through it into the top of '+(div>1?'each divider':'the divider'):''}.`},['Top']),
      {std:seen.top||dividerPlugs,fine:!s.narrow||dividerPlugs}));
  }else if(s.top==='over'){
    const railLead='Fasten the two top rails between the sides, lying flat and flush with their top ends, one flush with the front edges and one flush with the back edges';
    // (screwed down into the dividers: the top covers those heads; caseJoints, js/casecheck.js)
    const railDividers=div?' Then drive the screws listed below down through each rail into the top of '+(div>1?'each divider':'the divider')+' (the top covers their heads).':'';
    // the undersides of the rails in sight of a seated person: their pocket holes plugged in Everyday too (caseLooks)
    const railPlugs=seen.rails?' A person in front sees the undersides of these rails, so fill the pocket holes under the rails with glued pocket-hole plugs (the bag on the list) and sand them flush.':'';
    const railPockets=`${railLead}: glue, and the pocket screws listed below from the holes in the underside of each rail near its ends, so nothing shows on the sides.`+railDividers;
    const railNarrow=railLead+'.'+plugged('each rail')+railDividers;
    steps.push(withPlugTools(styledStep({
      std:(s.narrow?railNarrow:railPockets+railPlugs)+' The top is screwed to these rails later.',
      fine:(s.narrow?railNarrow:railPockets+plugPockets)+' The top is screwed to these rails later.',
      rustic:`Fasten the two top rails between the sides, lying flat and flush with their top ends, one flush with the front edges and one flush with the back edges, with glue and two screws through each side into each end${div?'. Then drive two screws down through each rail into the top of '+(div>1?'each divider':'the divider')+' (the top covers their heads)':''}. The top is screwed to these rails later.`},['Top rail']),
      {std:seen.rails,fine:!s.narrow}));
  }else{
    const edgeLead=`Fasten the top rails between the ${div?'uprights, one bay at a time from the left':'sides'}, standing on edge with their top edges flush with the top ends of the ${div?'uprights':'sides'}, one flush with the front edges and one flush with the back edges`;
    steps.push(styledStep({
      std:(s.narrow?edgeLead+'.'+plugged('each rail'):`${edgeLead}: glue, and the pocket screws listed below from the holes near the ends of each rail: in the face of the front rail that looks into the case, and in the back face of the back rail, where nobody looks.`)+railAtDivider+' The top you buy rests on these rails.',
      rustic:`${edgeLead}, with glue and two screws through each ${upright} into each end.`+railAtDivider+' The top you buy rests on these rails.'},['Top rail']));
  }

  // the back rails: what keeps an open back from leaning (and what the case brackets of its anti-tip kits go into)
  if(s.backRail){
    const under=s.top==='over'?'under the back top rail':'under the top';
    // (only an open back has this rail since the case looks job: the wall is held by anti-tip kits, js/caselooks.js)
    const more=railAtDivider+(s.back==='panel'?'':' Together with the base rail'+(div?'s':'')+' it keeps the case (the box that the sides, the top and the bottom make) from leaning sideways.');
    const downInto=s.top==='over'?'screw down through the top rail into it about every 8" (the top covers those heads).':'';
    const hidden=s.back==='panel'?'the back panel covers it':s.anchored?'the wall covers it':'it is at the back of the case, where nobody looks';
    const fromBehind=`Fasten a back rail ${under} at the back${div?' of each bay':''}, standing on edge. Glue it, and drive the pocket screws listed below from the holes in its back face: ${div?'at an end that meets a side, into the side':'at each end, into the side'}${s.top==='over'?'. Then '+downInto:', and along it, up into the top.'} No hole shows from the front, the top or the sides: the holes are in the back face, and ${hidden}.`+more;
    const rustic=`Fasten a back rail ${under} at the back${div?' of each bay':''}, standing on edge. Glue it, drive two screws through each ${upright} into each of its ends, and ${s.top==='over'?downInto:'screw down through the top into it about every 8".'}`+more;
    steps.push(styledStep({std:fromBehind,fine:fromBehind,rustic},['Back rail']));
  }

  // the back
  if(s.back==='panel'){
    const touches=['the sides',s.top==='inside'?'the top':s.top==='over'?'the top rails':'the back top rails']
      .concat(s.backRail?[s.bays.length>1?'the back rails':'the back rail']:[],div?['the '+bottomWord+'s']:['the '+bottomWord],
        heights.length?[heights.length===1&&!div?'the shelf':'the shelves']:[],div?[div>1?'the dividers':'the divider']:[]);
    steps.push({t:`Lay the case (the box you have built so far) face down. Measure corner to corner both ways and nudge it until the two measurements match, then glue and nail the back on, with a nail about every 6" into the back edge of every board it lies against: ${listWords(touches)}.`+
      (s.backPanels.length>1?' The back is in '+s.backPanels.length+' strips; each seam lands on the middle of a divider.':'')+
      ` Its top edge is flush with the top of the ${s.top==='over'?'sides':'case'} and its bottom edge with the underside of the ${bottomWord}${s.baseRail?', so the base rail shows below it':''}. The back is what stops ${s.kind.word} from leaning sideways.`,add:['Back panel']});
  }else{
    steps.push({t:'Lay the case face down and measure corner to corner both ways. The two must match: nudge the case until they do, and let the glue set before you stand it up. With an open back, the rails at the top and the bottom are what keep it square.',add:[]});
  }

  // the top that lies on the case
  if(s.top==='over'){
    const sides=s.overSide>0?`, overhanging ${fmt(s.overSide)} at each side`:', flush with the outside of the sides';
    const front=s.overFront>0?` and ${fmt(s.overFront)} past the front edges`:' and flush with the front edges';
    // (a case taller than a person reaches over gets its top while it lies on its back: no lifting a top overhead, and
    // the screws are driven down into the case through its open front, which then faces up)
    const tall=s.H>CASE_TOP_ON_LYING_FROM;
    const back=`flush with the back of the ${s.back==='panel'?'back panel':'case'}${sides}${front}`;
    const place=tall
      ?`Turn the case over so it lies on its back. Run a thin line of glue along the top ends of the sides${seen.sides?' and the top rails':''} and set the top against them, standing on its back edge on the floor, ${back}. Clamp it`
      :`Stand the case up. Run a thin line of glue along the top ends of the sides${seen.sides?' and the top rails':''} and lay the top on, its back edge ${back}. Clamp it`;
    const reach=tall?'(reach in through the open front, which faces up)':'(reach in through the open front)';
    const standUp=tall?' With a helper, stand the case up.':'';
    // where a person in front sees the undersides of the rails, the top is held by pocket screws from the inside faces
    // of the sides, plugged (caseTopBySides, js/caselooks.js); Rustic screws it down into the top ends of the sides
    const layOn=seen.sides
      ?`${place}, then drive the pocket screws listed below from the holes along the top end of each side, on its inside face, up into the top ${reach}. A person in front sees those faces, so fill those holes with glued pocket-hole plugs (the bag on the list) and sand them flush when the glue is dry. Nothing shows on the top, and nothing under the rails.${standUp}`
      :`${place}, then drive the screws listed below ${tall?'':'up '}through the top rails into the top from inside ${reach}, so nothing shows on the top.${standUp}`;
    const rusticBySides=`${place}, then drive the screws listed below down through the top into the top end of each side.${standUp}`;
    steps.push(seen.sides?withPlugTools(styledStep({std:layOn,rustic:rusticBySides},['Top']),{std:true,fine:true}):{t:layOn,add:['Top']});
  }
  steps.push(STORAGE_FINISH_STEP);

  // stand it up, and fasten it to the wall when it must be
  // fastened with bought anti-tip kits screwed to the back of the top (js/caselooks.js), not screws through a rail
  let stand;
  if(s.anchored){
    const reason=s.anchorWhy.includes('tall')?' This case is tall for its depth: do not load it before it is fastened.'
      :s.anchorWhy.includes('kind')?` ${CASE_KINDS[s.kindKey].word[0].toUpperCase()+CASE_KINDS[s.kindKey].word.slice(1)} is always fastened to the wall: loaded, it can be pulled over.`:'';
    stand=caseAntiTipWords(s)+reason;
  }else{
    stand='Stand it in place. It is low enough to stand on its own, but strap it to a wall stud if children may climb on it.';
  }
  if(s.top==='rails')stand+=' Then set the top you bought on the rails, as its maker says.';
  steps.push({t:stand,add:[]});
  return stepsForPieces(steps,parts);
}
