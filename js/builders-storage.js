/* NominalCAD: the shelving, cabinet and box presets (Bookshelf, Garage shelves, Base cabinet with doors,
   Wall shelf, Storage box / toy chest).

   Every preset here has one "plan" function that turns the numbers typed in the form into every size, count and
   position the design needs. Its builder, its steps, its notes, its hardware list and its own check(p) all read
   that one plan, so they cannot disagree about what gets built.

   THE PRESET RULE (README.md): each of these must pass the structural check in js/verify.js at its default
   sizes and at every limit of its form. The plans below size things from the same tables the check uses
   (USES, maxSpanFor, TIP_RULES), so a wider shelf gets a divider or another support instead of a sag.

   To change a limit, change the ..._LIMITS table; the form in js/presets.js and the builder both read it. */
'use strict';

/* ---------- helpers shared with js/builders-outdoor.js ---------- */
/* a size from the form, kept inside its limits [smallest, largest] and on the 1/16" grid */
function sizeWithin(value,limits){
  const size=Number.isFinite(+value)?+value:limits[0];
  return r16(Math.min(limits[1],Math.max(limits[0],size)));
}
/* a whole number from the form, kept inside its limits */
function countWithin(value,limits){
  const count=Number.isFinite(+value)?Math.round(+value):limits[0];
  return Math.min(limits[1],Math.max(limits[0],count));
}
/* The longest clear span, in inches, for a board or a sheet lying flat under the design load of a use
   (a key of USES in js/verify.js). The load and the stiffness both grow with the width, so the width cancels. */
function flatSpanLimit(thickness,isPlywood,useKey){
  const width=12;
  return maxSpanFor(sectionOf(width,thickness,isPlywood),USES[useKey].psf*width/144,useKey);
}
/* Splits the opening from start to end into the fewest equal bays that are each no wider than maxBay, leaving
   room for an upright of the given thickness between bays. Returns [{x, len}]; the upright after bay k stands
   at bays[k].x + bays[k].len. Everything lands on the 1/16" grid so the pieces touch exactly. */
function splitIntoBays(start,end,uprightThickness,maxBay){
  const inside=end-start;
  let count=1;
  while((inside-(count-1)*uprightThickness)/count>maxBay)count++;
  const width=(inside-(count-1)*uprightThickness)/count,bays=[];
  for(let k=0;k<count;k++){
    const from=k===0?start:r16(start+k*(width+uprightThickness));
    const to=k===count-1?end:r16(start+(k+1)*(width+uprightThickness))-uprightThickness;
    bays.push({x:from,len:to-from});
  }
  return bays;
}
/* "1 divider" / "2 dividers" */
const countOf=(count,word)=>count+' '+word+(count===1?'':'s');
/* the step-by-step list without the names of pieces this build does not have (a bookshelf with no shelves) */
function stepsForPieces(steps,parts){
  const built=new Set(parts.map(piece=>piece.name));
  return steps.map(step=>({...step,add:step.add.filter(name=>built.has(name))}));   // (pick, bring, hardware and fasten stay on the step)
}
const STORAGE_CUT_STEP={t:'Cut every piece on the cut list and pencil its letter on it. Measure twice, cut once, and cut the longest pieces first.',add:[]};
/* Boards that meet an upright from both sides at the same height: the first board covers the spot where a straight
   screw into the second would have to go in, so the second gets the same two screws driven at an angle. The
   fastener list counts two screws of that size for every such joint, so the words and the list agree. */
const secondSideOfUpright=upright=>`Where two boards meet the ${upright} from both sides at the same height, screw through the ${upright} into the first one. That board then covers the spot where a straight screw into the second would go in. So glue the second board and fasten it with two of the same screws driven at an angle: start each one in the underside of the board, about 1" from its end, and slant it up into the ${upright}. Drill the pilot holes at the same slant.`;
/* the same for a rail or a toe kick at a divider */
const SECOND_RAIL_AT_UPRIGHT='the one in the first bay is screwed through the divider, and the one in the next bay gets its two screws driven at an angle through its end into the divider';
const STORAGE_FINISH_STEP={t:'Sand everything: 80 grit, then 120, then 180, and round over the sharp edges. Wipe off the dust, then paint or stain, and finish with at least two coats of clear coat.',add:[]};

/* ======================================================================================================
   Bookshelf: two sides, fixed shelves, a toe kick and a base rail under the bottom, a thin plywood back.
   A 3/4" board sags under a row of books once it spans more than about 33", so a wider case gets upright
   dividers that stand on the floor like the sides. A case taller than 4 times its depth is fastened to the wall.
   ====================================================================================================== */
const BOOKSHELF_LIMITS={W:[12,72],H:[24,84],n:[0,8]};
/* How close together shelves may be. Shelves between two sides are screwed from outside the case, so the only
   limit is that a hand can still reach in. Shelves that meet a divider are fastened from underneath, and the
   drill needs room. Closer than that cannot be built, so the form says why and builds nothing. */
const BOOKSHELF_MIN_OPENING={plain:4,atDivider:6};
/* House furniture shows no fastener on its top or its front, unless it is built Rustic / rough (STYLE_RULES in
   js/joints.js). The bookshelf's top is held to the back rail by pocket holes in the rail (on its back face, which
   the back panel covers); the toy chest's front is held by pocket holes inside the sides and the bottom; the wall
   shelf is held from underneath by pocket holes in the cleat (on its back, against the wall) and the supports.
   The outside of the sides shows nothing either (the owner: "hide those too"): the boards between the sides of a
   bookshelf or a cabinet are held to them by pocket holes on their underside or on the face toward the inside of
   the case, and the toy chest's sides, back and bottom by pocket holes on the inside. A divider or a partition is
   inside the case: the screws through it are covered by the board on its other side, as before. */
const CASE_SIDE_JOINTS=['Top','Bottom','Shelf','Toe kick','Base rail','Back rail','Top rail'].map(board=>['Side',board,'pocketUnlessRustic']);
/* The retired Bookshelf (designs saved with it still open): a shelf on the right of a divider that is more than
   SEEN.underAbove up takes pocket screws there, as at its other end, never the angled screws of the second board,
   whose heads would be in plain sight from below (the review of the audit fixes: a saved 36" x 72" Bookshelf still
   had two). Every shelf of this builder has a shelf at the same height on the divider's other face. The same rule
   as caseHighSecondShelf (js/casecheck.js) for the Cabinet / case builder; judged from the two pieces alone. */
function oldBookshelfHighSecondShelf(j){
  const divider=j.a.name==='Divider'?j.a:j.b,shelf=divider===j.a?j.b:j.a;
  return shelf.pos[0]>divider.pos[0]&&shelf.pos[1]>SEEN.underAbove;
}
const BOOKSHELF_JOINTS=[['Divider','Shelf','pocketUnlessRustic',{when:oldBookshelfHighSecondShelf}],
  ['Top','Back rail','pocketUnlessRustic'],['Top','Divider','pocketUnlessRustic'],...CASE_SIDE_JOINTS,
  ['Bottom','Toe kick','pocketUnlessRustic'],['Bottom','Base rail','pocketUnlessRustic']];
const STORAGE_BOX_JOINTS=[['Front','Side','pocketUnlessRustic'],['Front','Bottom','pocketUnlessRustic'],
  ['Back','Side','pocketUnlessRustic'],['Back','Bottom','pocketUnlessRustic'],['Side','Bottom','pocketUnlessRustic']];
const WALL_SHELF_JOINTS=[['Shelf','Wall cleat','pocketUnlessRustic'],['Shelf','Support','pocketUnlessRustic']];
const BOOKSHELF_USES={Top:'books',Bottom:'books',Shelf:'books','Toe kick':'books','Base rail':'books','Back rail':'none'};
const SHEET_WIDTH=48;               // a sheet of plywood is 4 ft wide

/* ---- the shelf openings ----
   An opening is the clear space between two boards: the bottom board and the first shelf, two shelves, or the
   last shelf and the top. A case with n shelves has n + 1 openings. The form offers two ways to space them
   ("Shelf spacing"): evenly, or with the height of each opening set by hand. Set by hand there is one box for
   each opening except the top one, bottom opening first (o1, o2, ... in the form). A box left at 0 means "not
   set": those openings and the top one share what is left evenly, so the top opening always takes up the slack. */
const shelvesWord=count=>count+(count===1?' shelf':' shelves');
const BOOKSHELF_FLOOR_TOP=4.25;     // top face of the bottom board: it sits on a 3 1/2" toe kick and is 3/4" thick
const BOOKSHELF_OPENING_BOXES=BOOKSHELF_LIMITS.n[1];                // one box for each shelf the form allows
const BOOKSHELF_OPENING_LIMITS=[0,BOOKSHELF_LIMITS.H[1]-BOOKSHELF_FLOOR_TOP-.75]; // 0 = not set; no opening is taller than the inside of the tallest case
/* the boxes of the form, bottom opening first; each shows only while its opening exists and heights are set by hand */
function bookshelfOpeningFields(){
  const fields=[];
  for(let i=1;i<=BOOKSHELF_OPENING_BOXES;i++){
    fields.push({...num('o'+i,i===1?'Opening 1 (bottom)':'Opening '+i,0,...BOOKSHELF_OPENING_LIMITS),
      show:p=>p.spacing==='set'&&i<=p.n});
  }
  return fields;
}
/* The heights asked for, one for each opening below the top one, bottom first; 0 where none is set.
   An empty list means evenly spaced. */
function bookshelfAskedOpenings(p,shelves){
  if(p.spacing!=='set')return[];
  const asked=[];
  for(let i=1;i<=shelves;i++){
    const size=+p['o'+i];
    asked.push(Number.isFinite(size)&&size>0?r16(size):0);
  }
  return asked;
}
/* The clear height of every opening, bottom to top.
     asked       from bookshelfAskedOpenings
     room        the clear height there is to share: the inside height less the thickness of the shelves
     least       the lowest opening that can be built (BOOKSHELF_MIN_OPENING)
     caseHeight  the height of the case, for the words
   Returns {openings, custom, problems}. When the heights asked for cannot work, problems says why and what to
   change (they become the preset's check(p)), and openings falls back to even spacing so that the picture still
   shows a sensible case. */
function bookshelfOpenings(asked,shelves,room,least,caseHeight){
  const count=shelves+1,even=Array(count).fill(room/count);
  const set=asked.filter(size=>size>0);
  const stop=(text,fix)=>({openings:even,custom:false,problems:[{level:'stop',text,fix}]});
  // too many shelves for the height: no choice of heights can work, and bookshelfCheck says so
  if(!set.length||room/count<least-1e-6)return{openings:even,custom:false,problems:[]};
  const tooLow=asked.findIndex(size=>size>0&&size<least-1e-6);
  if(tooLow>=0){
    const why=least>BOOKSHELF_MIN_OPENING.plain?'the shelves that meet a divider are fastened from underneath, and a drill needs that much room'
      :'a hand cannot reach in to fasten, sand or paint it, and almost nothing fits in it';
    // typedLen (js/core.js): the heights typed in the opening boxes, and those to type there, as the boxes show them
    return stop(`Opening ${tooLow+1}${tooLow?'':' (the bottom one)'} is set to ${typedLen(asked[tooLow])}. An opening lower than ${typedLen(least)} cannot be built here: ${why}.`,
      `Make it ${typedLen(least)} or more, or type 0 to let it share what is left.`);
  }
  // what is left over goes to the top opening, shared evenly with the openings that are not set
  const used=set.reduce((sum,size)=>sum+size,0),free=count-set.length,each=(room-used)/free;
  if(each<least-1e-6){
    const others=free===1?'the top opening':`the ${free} openings that share what is left`;
    const most=Math.floor((room-free*least)*16)/16;
    return stop(`The ${set.length===1?'opening height you set is':'opening heights you set add up to'} ${typedLen(used)}. A case ${typedLen(caseHeight)} tall with ${shelvesWord(shelves)} has ${typedLen(Math.floor(room*16)/16)} of clear height to share between its ${count} openings, so that leaves ${each>0?'only '+typedLen(Math.floor(each*16)/16)+(free>1?' each':''):'nothing'} for ${others}, and an opening lower than ${typedLen(least)} cannot be built.`,
      `Lower the heights you set (together no more than ${typedLen(most)}), make the case taller, or use fewer shelves.`);
  }
  // The openings that share come out the same to the 1/16", so the shelf marks are easy to measure; the few
  // sixteenths that rounding leaves over go to the top opening, which takes what is left.
  const share=Math.floor(each*16+1e-6)/16,top=room-used-(free-1)*share;
  return{openings:asked.map(size=>size>0?size:share).concat([top]),custom:true,problems:[]};
}

/* ---- shelves at a spacing the person types ("Shelf spacing": "At a spacing I choose") ----
   The owner: "make sure book shelves are able to have a desired shelf spacing". The person types the clear
   opening they want between shelves (12" say); the case gets as many shelves as its height allows with every
   opening exactly that, and what is left over goes to one opening, the top or the bottom one (p.extra). That
   opening is never lower than the smallest spacing (7") nor than the lowest that can be built
   (BOOKSHELF_MIN_OPENING), so it may come out taller than the others: a shelf that would leave less is left out.
   The spacing is the clear opening, from the top of one board to the underside of the next, and the form and the
   remark say so. The limits are the reference sheet's (design/reference/01-case-furniture.md, 2f and 4):
   openings of 7" to 15" clear, 11" usual. */
const BOOKSHELF_SPACING_LIMITS=[7,15];
const BOOKSHELF_SPACING_USUAL=11;
/* What fits: {gap, shelves, leftover, at ('top' | 'bottom'), openings (bottom to top), more (how many the
   height had room for before the form's most, BOOKSHELF_LIMITS.n), lowest (the least the leftover opening may
   be), alike (the leftover came out the same as the others), evenAt (the case heights just below and just above
   this one, within the form's limits, at which every opening comes out the same)}.
     inside  the clear height between the bottom board and the top
     least   the lowest opening that can be built here
     T       the thickness of a shelf */
function bookshelfFitAtSpacing(p,inside,least,T){
  const gap=sizeWithin(p.gap,BOOKSHELF_SPACING_LIMITS),at=p.extra==='bottom'?'bottom':'top';
  // The opening that takes what is left is a shelf space like the others: never lower than the smallest spacing
  // the reference sheet gives (7"), so that it is not a slot nobody can use (a 48" case at 9" once got a 4" top
  // opening), and never lower than what can be built here.
  const lowest=Math.max(least,BOOKSHELF_SPACING_LIMITS[0]);
  const room=Math.floor((inside-lowest)/(gap+T)+1e-6);                 // shelves the height has room for
  const shelves=Math.max(0,Math.min(BOOKSHELF_LIMITS.n[1],room));
  const leftover=r16(inside-shelves*(gap+T));
  const even=Array(shelves).fill(gap);
  // the case heights nearest this one at which every opening comes out the same (the leftover one too)
  const H=inside+BOOKSHELF_FLOOR_TOP+T,caseFor=count=>r16(H-inside+(count+1)*gap+count*T);
  const evenHeights=[];
  for(let count=0;count<=BOOKSHELF_LIMITS.n[1];count++){
    const height=caseFor(count);
    if(height>=BOOKSHELF_LIMITS.H[0]&&height<=BOOKSHELF_LIMITS.H[1])evenHeights.push(height);
  }
  const below=evenHeights.filter(height=>height<H-1e-6).pop(),above=evenHeights.find(height=>height>H+1e-6);
  return{gap,shelves,leftover,at,lowest,more:Math.max(shelves,room),
    alike:Math.abs(leftover-gap)<1/32,evenAt:[below,above].filter(height=>height!==undefined),
    openings:at==='bottom'?[leftover].concat(even):even.concat([leftover])};
}
/* The remark under the form for shelves at a chosen spacing: how many shelves that makes, the opening that takes
   what is left, and what fits at which spacing (the reference sheet's spacings by item). Sizes read as the
   boxes show them (typedLen, js/core.js). */
function bookshelfSpacingWords(s){
  const{gap,shelves,leftover,at,more,lowest,alike,evenAt}=s.fit,most=BOOKSHELF_LIMITS.n[1];
  // what the spacing measures, said once: the clear space a book stands in
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
  // the case heights at which the leftover comes out the same as the rest
  if(!alike&&evenAt.length)fits+=` For openings all the same, make the case ${evenAt.map(height=>typedLen(height)).join(' or ')} tall.`;
  return fits+` Most books fit in ${typedLen(10)} to ${typedLen(12)} (paperbacks ${typedLen(8)}); binders, record albums and large books want ${typedLen(13)} to ${typedLen(15)}.`;
}

function bookshelfPlan(p){
  const T=.75;                       // every 1x board is 3/4" thick
  const board=M[p.board]&&M[p.board].kind==='board'?p.board:'1x10',depth=M[board].w;
  const W=sizeWithin(p.W,BOOKSHELF_LIMITS.W),H=sizeWithin(p.H,BOOKSHELF_LIMITS.H);
  const back=!!p.back,backT=back?.25:0;
  // How wide a bay may be. The structural check (js/verify.js) counts the board's own weight with the books, and
  // measures a span to the middle of the upright a board runs over: the top of a case with dividers runs over
  // them, so its span is up to one board thickness longer than the clear width of the bay. The bays are sized
  // by that same measure, so the case never stops just short of its own rule (it once did, at 68" to 69" wide).
  const reach=maxSpanFor(sectionOf(1,T,false),USES.books.psf/144+WOOD_RULES.DENSITY*T,'books');
  const bays=splitIntoBays(T,W-T,T,W-2*T<=reach?reach:reach-T);
  // The bottom board is 3 1/2" off the floor. The shelves share the height between it and the top evenly, unless
  // the person set the height of the openings themselves ("Shelf spacing" in the form).
  const floorTop=BOOKSHELF_FLOOR_TOP,topUnder=H-T;
  const least=bays.length>1?BOOKSHELF_MIN_OPENING.atDivider:BOOKSHELF_MIN_OPENING.plain;
  // At a spacing the person chose, the height decides how many shelves there are; otherwise the form does.
  const fit=p.spacing==='gap'?bookshelfFitAtSpacing(p,topUnder-floorTop,least,T):null;
  const shelves=fit?fit.shelves:countWithin(p.n,BOOKSHELF_LIMITS.n);
  const room=topUnder-floorTop-shelves*T;
  const spacing=fit?{openings:fit.openings,custom:true,problems:[]}
    :bookshelfOpenings(bookshelfAskedOpenings(p,shelves),shelves,room,least,H);
  const opening=Math.min(...spacing.openings);
  const shelfY=[];
  let under=floorTop;                // the underside of the next shelf: the opening below it, on top of what is below
  for(let i=0;i<shelves;i++){
    under+=spacing.openings[i];
    shelfY.push(r16(under));
    under+=T;
  }
  // The 1/4" back comes from sheets 4 ft wide. A case too big for one sheet gets its back in strips that meet
  // on the middle of a divider.
  const backPanels=[];
  if(back){
    const fitsOneSheet=Math.min(W,H-3.5)<=SHEET_WIDTH;
    const seams=bays.slice(0,-1).map(bay=>bay.x+bay.len+T/2).concat([W]); // where a strip may end
    let from=0;
    seams.forEach((seam,k)=>{
      const last=k===seams.length-1;
      // end the strip here at the end of the case, or when going on to the next seam would make it wider than a sheet
      if(last||(!fitsOneSheet&&seams[k+1]-from>SHEET_WIDTH)){
        backPanels.push({x:from,len:seam-from});
        from=seam;
      }
    });
  }
  const anchored=H>TIP_RULES.narrow*depth;                      // taller than 4 times its depth: it is fastened to the wall studs
  // A rail under the top at the back of each bay. With no plywood back it is what keeps the case from leaning,
  // and on a case that is fastened to the wall it is the solid wood the screws into the studs go through.
  return{T,board,depth,W,H,shelves,back,backT,bays,dividers:bays.length-1,opening,shelfY,backPanels,anchored,
    least,room,                      // the lowest opening that can be built here, and the clear height all openings share
    fit,                             // shelves at a spacing the person chose (bookshelfFitAtSpacing), or null
    openings:spacing.openings,customOpenings:spacing.custom,openingProblems:spacing.problems,
    backRail:!back||anchored,studs:Math.max(1,Math.ceil(W/16))};
}
function buildBookshelf(p){
  const s=bookshelfPlan(p),P=[],T=s.T,z=s.backT;
  P.push(mk('Side',s.board,[T,s.H,s.depth],[0,0,z]),mk('Side',s.board,[T,s.H,s.depth],[s.W-T,0,z]));
  P.push(mk('Top',s.board,[s.W-2*T,T,s.depth],[T,s.H-T,z]));
  s.bays.forEach((bay,k)=>{
    if(k>0)P.push(mk('Divider',s.board,[T,s.H-T,s.depth],[bay.x-T,0,z]));
    P.push(mk('Bottom',s.board,[bay.len,T,s.depth],[bay.x,3.5,z]));
    for(const y of s.shelfY)P.push(mk('Shelf',s.board,[bay.len,T,s.depth],[bay.x,y,z]));
    P.push(mk('Toe kick','1x4',[bay.len,3.5,T],[bay.x,0,z+s.depth-1.75]));
    P.push(mk('Base rail','1x4',[bay.len,3.5,T],[bay.x,0,z]));
    if(s.backRail)P.push(mk('Back rail','1x4',[bay.len,3.5,T],[bay.x,s.H-T-3.5,z]));
  });
  for(const panel of s.backPanels)P.push(mk('Back panel','ply14',[panel.len,s.H-3.5,.25],[panel.x,3.5,0]));
  return P;
}
function bookshelfCheck(p){
  const s=bookshelfPlan(p),least=s.least;
  // Too many shelves for the height: even spaced as tightly as they can be, the openings come out too low. No
  // choice of opening heights can mend that, so this is said first, whichever way the shelves are spaced.
  if(s.shelves&&s.room/(s.shelves+1)<least-1e-6){
    const most=Math.floor((s.H-s.T-BOOKSHELF_FLOOR_TOP-least)/(least+s.T));
    const why=s.dividers?`A case this wide has ${s.dividers>1?'dividers':'a divider'}, and the shelves that meet a divider are fastened from underneath: a drill needs about ${fmt(least)} of room to do that.`
      :`A hand cannot reach into a space lower than about ${fmt(least)} to sand or paint it, and almost nothing fits on such a shelf.`;
    return[{level:'stop',text:`${shelvesWord(s.shelves)} in a case ${typedLen(s.H)} tall would be only ${typedLen(Math.floor(s.room/(s.shelves+1)*16)/16)} apart. ${why}`,
      fix:`Use ${most>0?most+' or fewer':'no'} shelves at this height, or make the case taller.`}];
  }
  return s.openingProblems;          // the opening heights set by hand cannot work: why, and what to change
}
/* the clear height of every opening as built, bottom to top, measured between the boards themselves */
function bookshelfBuiltOpenings(s){
  const boards=[BOOKSHELF_FLOOR_TOP-s.T].concat(s.shelfY,[s.H-s.T]);   // the underside of each board, bottom board to top
  return boards.slice(1).map((under,i)=>under-(boards[i]+s.T));
}
function bookshelfInfo(p){
  const s=bookshelfPlan(p),out=[];
  // at a spacing the person chose: how many shelves that makes, and the opening that takes what is left
  if(s.fit)out.push(bookshelfSpacingWords(s));
  // the clear height of every opening, so the person sees what their numbers (or even spacing) give
  else if(s.shelves&&!bookshelfCheck(p).length){
    const heights=bookshelfBuiltOpenings(s);
    if(s.customOpenings){
      const shared=s.shelves+1-bookshelfAskedOpenings(p,s.shelves).filter(size=>size>0).length;
      // under the form the heights read as the opening boxes show them (typedLen, js/core.js)
      out.push(`Openings from the bottom up: ${heights.map(height=>typedLen(height)).join(', ')}. ${shared>1?`The ${shared-1===1?'opening':shared-1+' openings'} left at 0 and the top one share what is left.`:'The top one takes what is left.'}`);
    }else{
      out.push(`Each of the ${heights.length} openings is ${typedLen(heights[0])} tall`+
        (p.spacing==='set'?': every box is at 0, so they share the height evenly. Type a height for the ones you want different.'
          :'. Under Shelf spacing, "At a spacing I choose" fits the shelves to the opening you type, and "Set the height of each opening" sets them one by one.'));
    }
  }
  if(s.dividers)out.push(`A 3/4" shelf sags under books when it spans more than about ${fmt(Math.floor(flatSpanLimit(s.T,false,'books')))}, so this case gets ${countOf(s.dividers,'upright divider')}.`);
  if(s.anchored)out.push('It is more than 4 times as tall as it is deep, so it must be screwed to the wall studs through the rail under its top.');
  return out.join(' ');
}
function bookshelfNotes(p){
  const s=bookshelfPlan(p),bay=Math.max(...s.bays.map(b=>b.len)),sqft=bay*s.depth/144;
  const out=[`Each shelf is sized for a full row of books: about ${Math.round(USES.books.psf*sqft/5)*5} lb spread along it (40 lb per square foot). These are rule-of-thumb sizes, not an engineer's numbers.`];
  if(s.dividers)out.push(`The ${s.dividers>1?'dividers stand':'divider stands'} on the floor like the sides and ${s.dividers>1?'keep':'keeps'} every shelf under ${fmt(Math.ceil(bay))} long, which is what stops the sag.`);
  out.push(s.anchored?'This case is more than 4 times as tall as it is deep. Loaded with books it can be pulled over, so it must be screwed to the wall studs through the back rail under its top. Do not skip that step.'
    :'It is low enough to stand on its own. If children may climb it, strap it to a wall stud anyway.');
  if(!s.back)out.push('With no plywood back, the rails under the top and under the bottom keep the case from leaning sideways. It is less stiff than a case with a back: do not leave the rails out.');
  return out;
}
function bookshelfHardware(p){
  const s=bookshelfPlan(p);
  return s.anchored?[['Wood screws, 3", through the back rail into the wall studs',2*s.studs]]:[];
}
function bookshelfSteps(p){
  const s=bookshelfPlan(p),heights=s.shelfY.map(fmt),div=s.dividers;
  // shelves high enough to take their pocket holes on the top face, and where the holes of the top go
  // (read from the pieces with the fastener layout's own rule, caseHoleFaces in js/casesteps.js, not from the heights)
  const faces=caseHoleFaces(buildBookshelf(p));
  const highShelves=s.shelfY.filter(faces.shelfOnTop).map(fmt);
  const highSecond=s.shelfY.filter(y=>y>SEEN.underAbove).map(fmt);   // their second board at a divider: pocket screws
  const highNote=highShelves.length?` (in its top face instead for the ${highShelves.length>1?'shelves':'shelf'} at ${listWords(highShelves)}: an underside more than ${SEEN.underAbove}" up is in plain sight from below, and the books cover the top face)`:'';
  const topFace=faces.top;
  const topHoles=topFace==='top'?`from holes drilled in its top face near each end (the top is more than ${SEEN.topFrom}" up, above the eye, where nobody sees them; underneath they would be in plain sight from below), so nothing shows on the sides`
    :topFace==='plugged'?`from holes drilled in its underside near each end, so nothing shows on the top or on the sides. An underside this high is seen from below, so fill those holes with glued pocket-hole plugs, as the list says`
    :'from holes drilled in its underside near each end, so nothing shows on the top or on the sides';
  const uprights=div?`the two sides and the ${div>1?div+' dividers':'divider'}`:'the two sides';
  // shelves at heights set by hand: say what the clear openings come to, so the marks can be checked against them
  const openings=s.fit&&s.shelves?` Every opening between the boards is ${fmt(s.fit.gap)} clear${s.fit.alike?'':`, except the ${s.fit.at} one, which is ${fmt(s.fit.leftover)}`}. From the bottom up: ${bookshelfBuiltOpenings(s).map(fmt).join(', ')}.`
    :s.customOpenings&&!s.fit?` The shelves are not evenly spaced. The clear openings between the boards are, from the bottom up: ${bookshelfBuiltOpenings(s).map(fmt).join(', ')}.`:'';
  const steps=[STORAGE_CUT_STEP,
    {t:`Lay ${uprights} next to each other with their bottom ends lined up, and mark the shelf positions across all of them at once so they match. Underside of each piece, measured from the bottom end of the side: bottom board 3 1/2"${heights.length?', shelves '+heights.join(', '):''}.`+openings+
      (div?` The ${div>1?'dividers are':'divider is'} 3/4" shorter than the sides, because the top sits on ${div>1?'them':'it'}.`:''),add:['Side','Divider']},
    // The order is the order a drill can follow: the bottom board, then the toe kick and base rail under it (their
    // screws go down through the bottom board, and with the first shelf in place the drill no longer fits above
    // it), then the shelves, then the top.
    // Everyday and Fine furniture: nothing shows on the outside of the sides (CASE_SIDE_JOINTS), so each board is
    // held to a side by pocket holes drilled in the board before it goes in; Rustic / rough screws through the side
    styledStep({
      std:`Fasten the ${div?'bottom boards':'bottom board'} between the ${div?`uprights (the two sides and the ${div>1?'dividers':'divider'}), one bay at a time. A bay is the space between two uprights`:'sides'}, at the lowest mark, flush with the front and back edges. First drill the pocket holes listed below in the underside of each board, near its ends, so that no screw shows on the outside of the sides. Then glue the ends and drive the pocket screws into the sides.`+
        (div?` At a divider, screw through the divider into the end of the board in the first bay, as the list below says. ${secondSideOfUpright('divider')}`:''),
      rustic:`Fasten the ${div?'bottom boards':'bottom board'} between the ${div?`uprights (the two sides and the ${div>1?'dividers':'divider'}), one bay at a time. A bay is the space between two uprights`:'sides'}, at the lowest mark, flush with the front and back edges. Drill pilot holes, add glue, and drive two screws through the ${div?'upright':'side'} into each end of a board.`+
        (div?' '+secondSideOfUpright('divider'):'')},['Bottom'],['First drill the pocket holes listed below in the underside of each board, near its ends, so that no screw shows on the outside of the sides. ']),
    styledStep({
      std:`Under ${div?'each bottom board':'the bottom board'}, fasten a toe kick set back 1" from the front edge and a base rail flush with the back edge. Drill the pocket holes listed below in the face of each one that looks into the case: ${div?'at an end that meets a side, for the side':'at each end, for the sides'}, and along it, for the bottom board above it. Glue them and drive the pocket screws.`+
        (div?` At a divider, ${SECOND_RAIL_AT_UPRIGHT}.`:'')+` They carry the bottom board, so it cannot sag.`+(heights.length?' Do this now, before the shelves go in: afterwards the drill does not fit between the bottom board and the first shelf.':''),
      rustic:`Under ${div?'each bottom board':'the bottom board'}, fasten a toe kick set back 1" from the front edge and a base rail flush with the back edge. Glue them, drive two screws through each ${div?'upright':'side'} into each of their ends, and screw down through the bottom board into them about every 8".`+
        (div?` At a divider, ${SECOND_RAIL_AT_UPRIGHT}.`:'')+` They carry the bottom board, so it cannot sag.`+(heights.length?' Do this now, before the shelves go in: afterwards the drill does not fit between the bottom board and the first shelf.':'')},['Toe kick','Base rail'],
      [` Drill the pocket holes listed below in the face of each one that looks into the case: ${div?'at an end that meets a side, for the side':'at each end, for the sides'}, and along it, for the bottom board above it.`]),
    ...(heights.length?[styledStep({
      std:`Fasten the shelves between the ${div?'uprights, one bay at a time':'sides'}, at the marks, flush with the front and back edges, the same way as the bottom board: pocket holes near the ends of each shelf, in its underside${highNote}, glue, and the pocket screws listed below into the ${div?'uprights':'sides'}.`+
        (div?` At a divider, screw through the divider into the first shelf, as you did with the bottom boards. ${secondSideOfUpright('divider')}`:'')+
        // (a second shelf high up takes pocket screws at the divider: oldBookshelfHighSecondShelf)
        (div&&highSecond.length?` For the ${highSecond.length>1?'shelves':'shelf'} at ${listWords(highSecond)}, hold the second board with pocket screws instead, from the holes near that end, the same way as at its other end: angled screws that high would leave their heads in plain sight.`:''),
      rustic:`Fasten the shelves between the ${div?'uprights, one bay at a time':'sides'}, at the marks, flush with the front and back edges, the same way as the bottom board: pilot holes, glue, and two screws through the ${div?'upright':'side'} into each end of a shelf.`+
        (div?' '+secondSideOfUpright('divider'):'')},['Shelf'])]:[]),
    styledStep({
      std:`Fasten the top between the sides, flush with their top ends: glue, and the pocket screws listed below ${topHoles}${div?'. Then fasten it to the top of '+(div>1?'each divider':'the divider')+' with the pocket screws listed below, from holes drilled in the faces of the divider near its top end':''}.`,
      rustic:`Fasten the top between the sides, flush with their top ends, with glue and two screws through each side into its end${div?'. Then drive two screws down through it into the top of '+(div>1?'each divider':'the divider'):''}.`},['Top'])];
  if(s.backRail){
    const railWords=`Fasten a back rail under the top at the back${div?' of each bay':''}, standing on edge. Glue it, drive two screws through each ${div?'upright':'side'} into each of its ends, and `;
    const railMore=
      (div?` At a divider, ${SECOND_RAIL_AT_UPRIGHT}.`:'')+
      (s.back?'':' Together with the base rail'+(div?'s':'')+' it keeps the case (the box that the sides, the top and the bottom make) from leaning sideways.')+(s.anchored?' The screws into the wall studs will go through this rail.':'');
    // Everyday and Fine: pocket holes in the back face of the rail, at its ends into the sides and along it into the
    // top (CASE_SIDE_JOINTS); Rustic / rough screws through the sides and down through the top
    const fromBehind=`Fasten a back rail under the top at the back${div?' of each bay':''}, standing on edge. Glue it, and drive the pocket screws listed below from holes drilled in its back face before it goes in: ${div?'at an end that meets a side, into the side':'at each end into the side'}, and along it up into the top (the back face is covered by the back panel or the wall, so no hole shows, and nothing shows on the top or the sides).`+railMore;
    steps.push(styledStep({std:fromBehind,fine:fromBehind,rustic:railWords+'screw down through the top into it about every 8".'+railMore},['Back rail']));
  }
  if(s.back){
    steps.push({t:'Lay the case (the box you have built so far) face down. Measure corner to corner both ways and nudge it until the two measurements match, then glue and nail the back on, with a nail about every 6" into the back edge of every board it lies against: the sides, the top, '+(div?'the bottom boards'+(heights.length?', the shelves':'')+' and the '+(div>1?'dividers':'divider'):heights.length?'the bottom board and the shelves':'and the bottom board')+'.'+
      (s.backPanels.length>1?' The back is in '+s.backPanels.length+' strips; each seam lands on the middle of a divider.':'')+' Its top edge is flush with the top of the case and its bottom edge with the underside of the bottom board, so the base rail shows below it. The back is what stops the bookshelf from leaning sideways.',add:['Back panel']});
  }
  steps.push(STORAGE_FINISH_STEP,
    {t:s.anchored?'Stand it against the wall, find the wall studs with a stud finder, and drive two 3" screws through the back rail under the top into every stud it crosses (at least one).'+
        (s.W<32?' Studs are usually 16" apart, so a case this narrow may miss them where you first set it: slide it sideways until the rail crosses one.':'')+
        ' If a baseboard holds the case off the wall, put a scrap of wood that thick behind the rail at each screw, so the screws do not pull the case out of square. This case is tall for its depth: do not load it before it is fastened.'
      :'Stand it in place. It is low enough to stand on its own, but strap it to a wall stud if children may climb on it.',add:[]});
  return stepsForPieces(steps,buildBookshelf(p));
}

/* ======================================================================================================
   Garage shelves: 2x4 shelf frames (two rails, cross pieces at most 24" apart, an end rail across each end) with
   1/2" plywood decks, hung on 2x4 posts. Each post sits in the pocket between a rail and an end rail and is
   screwed to both, so the unit cannot lean left to right (the rails) or front to back (the end rails).
   Long units get a middle pair of posts so the rails never span too far.
   The lower decks have to fit between the posts. The top deck does not: it covers the whole top, full width
   and full depth, and the posts stop under it (asked for by the owner, who saw four post tops showing at the
   corners of the top shelf). So the posts are one deck thickness shorter than the unit, and the top deck
   rests on the post tops as well as on the top frame.
   ====================================================================================================== */
const GARAGE_LIMITS={W:[24,96],D:[12,24],H:[24,84],n:[2,6]};
const GARAGE_MIN_OPENING=6;         // clear height between shelves; lower than this a hand cannot reach to the back
const GARAGE_CROSS_SPACING=24;      // cross pieces between the rails, center to center, at most
const GARAGE_DECK=.5;               // the decks are 1/2" plywood
const GARAGE_USES={'Shelf deck':'shelf','Top deck':'shelf',Rail:'shelf','End rail':'shelf','Cross piece':'shelf'};
/* The decks are cut from 4 x 8 sheets with the grain along the 8 ft length, so their length (the width of the unit)
   lies along the sheet. A deck that is exactly half the sheet's length (48"), or a whole fraction of it near
   enough, misses sharing that length with the others by the width of a saw cut: two 48" decks need 96 1/8". Such
   a deck gives up GARAGE_DECK_GIVE (1/16", approved by the owner) when that lets one more deck come out of the
   sheet's length, so four 48" decks come from one sheet instead of two. It still bears on the end rail at both
   ends (1 7/16" of the 1 1/2" at one end), and the gap at the end does not show. */
const GARAGE_DECK_GIVE=1/16;
// how many decks of this length come out of the sheet's length, with a saw cut between each two
const garageDecksAlongSheet=length=>Math.floor((SHEET_LONG+SAW_KERF)/(length+SAW_KERF)+1e-9);
function garageDeckLength(W){
  const shorter=W-GARAGE_DECK_GIVE;
  return garageDecksAlongSheet(shorter)>garageDecksAlongSheet(W)?shorter:W;
}

function garagePlan(p){
  const W=sizeWithin(p.W,GARAGE_LIMITS.W),D=sizeWithin(p.D,GARAGE_LIMITS.D),H=sizeWithin(p.H,GARAGE_LIMITS.H);
  const shelves=countWithin(p.n,GARAGE_LIMITS.n);
  // the bottom frame is 4" off the floor, and the top of the top deck is the height asked for
  const pitch=(H-8)/(shelves-1),levels=[];
  for(let i=0;i<shelves;i++)levels.push(r16(4+i*pitch));
  // posts: a pair at each end, and more pairs in between when a 2x4 rail would span too far under a loaded shelf
  const railLoad=USES.shelf.psf*(D/2)/144;                      // lb per inch of rail: half the shelf each
  const railSpan=maxSpanFor(sectionOf(1.5,3.5,false),railLoad,'shelf')*.9;
  const firstToLast=W-3-3.5;                                    // from the left face of the first post to that of the last
  let postBays=1;
  while(firstToLast/postBays-3.5>railSpan)postBays++;
  const postX=[];
  for(let k=0;k<=postBays;k++)postX.push(r16(1.5+firstToLast*k/postBays));
  // cross pieces between the rails
  const spaces=Math.ceil((W-1.5)/GARAGE_CROSS_SPACING),crossX=[];
  for(let k=1;k<spaces;k++)crossX.push(r16((W-1.5)*k/spaces));
  return{W,D,H,shelves,pitch,opening:pitch-4,levels,postX,crossX,crossGap:(W-1.5)/spaces,
    deckLength:garageDeckLength(W),                              // the decks' length: W, or 1/16" less to share a sheet
    loadPerShelf:Math.floor(USES.shelf.psf*W*(D-3)/144/10)*10,
    anchored:H>TIP_RULES.narrow*D,
    wallBraces:Math.max(2,Math.ceil(W/32))};                    // corner braces that hold it to the wall studs
}
function buildGarageShelves(p){
  const s=garagePlan(p),P=[],{W,D,H}=s;
  // the posts stop under the top deck
  for(const x of s.postX)for(const z of[0,D-1.5])P.push(mk('Post','2x4',[3.5,H-GARAGE_DECK,1.5],[x,0,z]));
  s.levels.forEach((y,level)=>{
    P.push(mk('End rail','2x4',[1.5,3.5,D],[0,y,0]),mk('End rail','2x4',[1.5,3.5,D],[W-1.5,y,0]));
    P.push(mk('Rail','2x4',[W-3,3.5,1.5],[1.5,y,1.5]),mk('Rail','2x4',[W-3,3.5,1.5],[1.5,y,D-3]));
    for(const x of s.crossX)P.push(mk('Cross piece','2x4',[1.5,3.5,D-6],[x,y,3]));
    // a lower deck fits between the posts; the top deck covers the whole top, post tops and all. Both start at the
    // left end of the unit and are s.deckLength long (garageDeckLength: perhaps 1/16" short at the right end).
    if(level<s.levels.length-1)P.push(mk('Shelf deck','ply12',[s.deckLength,GARAGE_DECK,D-3],[0,y+3.5,1.5]));
    else P.push(mk('Top deck','ply12',[s.deckLength,GARAGE_DECK,D],[0,y+3.5,0]));
  });
  return P;
}
function garageCheck(p){
  const s=garagePlan(p);
  if(s.opening<GARAGE_MIN_OPENING-1e-6){
    const most=Math.floor((s.H-8)/(GARAGE_MIN_OPENING+4))+1;
    return[{level:'stop',text:`${s.shelves} shelves in a unit ${typedLen(s.H)} tall would leave ${s.opening>0?'only '+fmt(Math.floor(s.opening*16)/16)+' of':'no'} clear height between them, because each shelf frame is 4" thick. A hand cannot reach to the back of a space lower than about ${fmt(GARAGE_MIN_OPENING)}, and almost nothing fits in it.`,
      fix:most>=2?`Use ${most===2?'2':most+' or fewer'} shelves at this height, or make the unit taller.`:`Make the unit at least ${typedLen(GARAGE_MIN_OPENING+12)} tall.`}];   // typedLen: as the Height box shows it (js/core.js)
  }
  return[];
}
function garageInfo(p){
  const s=garagePlan(p),out=[`Each shelf is sized for about ${s.loadPerShelf} lb spread evenly.`];
  if(s.postX.length>2)out.push('At this width it gets a middle pair of posts so the rails do not sag.');
  if(s.anchored)out.push('It is more than 4 times as tall as it is deep, so it must be screwed to the wall studs.');
  return out.join(' ');
}
function garageNotes(p){
  const s=garagePlan(p);
  return[`Each shelf is sized for about ${s.loadPerShelf} lb spread evenly over it (50 lb per square foot). Keep the heaviest things on the bottom shelf. These are rule-of-thumb sizes, not an engineer's numbers.`,
    'Cut the plywood decks with the grain of the face running the long way, across the cross pieces. Plywood is about twice as stiff that way.',
    ...(s.deckLength<s.W?[`The decks are ${fmt(s.deckLength)} long, not ${fmt(s.W)}: 1/16" shorter than the unit is wide, so that ${['','one','two','three','four'][garageDecksAlongSheet(s.deckLength)]||garageDecksAlongSheet(s.deckLength)} of them come out of the 8 ft length of a sheet with room for the saw cuts between them. Line each deck up with the left end of the unit; the 1/16" at the right end does not show.`]:[]),
    s.anchored?'This unit is more than 4 times as tall as it is deep. It must be fastened to the wall studs before you load it; the last step says how.'
      :'It stands on its own, but fasten it to the wall studs if anyone might climb it or if the floor slopes. '+garageWallHow(s)+
        ` The braces are extra, so they are not in the shopping list: buy ${s.wallBraces} corner braces and a few 1 5/8" screws if you do this.`,
    'It is left as bare wood, sanded so it does not give splinters. To paint or seal it, pick a finish under Style & finish and the lists and the steps follow.'];
}
/* Fasteners the garage shelves name themselves: a lower deck is cut to fit between the posts and only touches them. */
const GARAGE_JOINTS=[['Post','Shelf deck','none']];
function garageHardware(p){
  const s=garagePlan(p);
  // Only what the joints do not already count. The screws that hold the frames, posts and decks together are
  // worked out from the joints, like in every other design (hardwareTotals in js/style.js); listing them here
  // as well put them on the shopping list twice and charged for them twice.
  // The unit is held to the wall by corner braces on top of the top shelf: the back rail is 1 1/2" off the wall
  // (the posts stand between), so no screw can go straight through it into a stud.
  const braces=s.anchored?s.wallBraces:0;
  return[['Corner braces (L-brackets), 4", to hold the unit to the wall',braces],
    ['Screws, 1 5/8" (corner braces down into the top shelf)',2*braces],
    ['Wood screws, 3" (corner braces into the wall studs)',2*braces]].filter(row=>row[1]>0);
}
/* How to hold the unit to the wall: said in the steps when it must be done, and in the notes when it is optional. */
function garageWallHow(s){
  return`Find the wall studs with a stud finder. Set ${s.wallBraces} corner braces (4" L-brackets) on top of the top shelf against the wall, each at a stud${s.W<34?' (slide the unit sideways until it crosses two studs; they are usually 16" apart)':', spread along the unit'}. `+
    'Screw the half of each brace that lies on the shelf down through the plywood into the back rail with 1 5/8" screws. The rail starts 1 1/2" from the wall, so use the holes that are over it. Screw the half that stands against the wall into the stud with 3" screws.';
}
/* the posts along the back of the unit (z runs from the back, 0, to the front): they go on first, with the unit lying on its front */
function garageBackPost(piece,parts){
  const depths=parts.filter(p=>p.name==='Post').map(p=>p.pos[2]);
  return piece.pos[2]<(Math.min(...depths)+Math.max(...depths))/2;
}
function garageSteps(p){
  const s=garagePlan(p),heights=s.levels.map(fmt),middle=s.postX.length-2;
  const steps=[STORAGE_CUT_STEP,
    {t:`Build ${s.shelves} shelf frames, all alike. For each one, stand two rails on edge, ${fmt(s.D-6)} apart`+
      (s.crossX.length===1?', and fit the cross piece between them at the middle of their length':s.crossX.length?`, and fit the ${s.crossX.length} cross pieces between them, spaced evenly: about ${fmt(Math.round(s.crossGap))} from the middle of one to the middle of the next, and the same from each end of the rails`:'')+
      (s.crossX.length?'. Drive two 3" screws through each rail into each end of a cross piece':'')+
      `. Then lay an end rail across each end of the frame and drive two 3" screws through it into the end of each rail. The end rail is 3" longer than the frame is deep: let it stick out 1 1/2" past the rail at the front and at the back. Those two notches are where the posts go.`,add:['Rail','Cross piece','End rail']},
    {t:`Screw a plywood deck onto ${s.shelves>2?'every frame except one':'one of the two frames'}, with a 1 1/4" screw about every 8" into the rails, the end rails${s.crossX.length?' and the cross pieces':''}. Its long edges sit flush with the outside faces of the rails and its ends flush with the end rails${s.deckLength<s.W?' (it is 1/16" shorter than the frame: keep the left ends flush)':''}, so the notches for the posts stay open. The frame left bare is the top one: its deck is bigger and goes on last.`,add:['Shelf deck']},
    {t:`Lay all ${countOf(2*s.postX.length,'post')} side by side with their bottom ends lined up and mark the underside of each shelf frame across them, measured from the bottom end: ${heights.join(', ')}. The bare top frame goes at the last mark, which puts its top flush with the top ends of the posts. Get a helper, or cut scrap blocks to hold the spacing. Stand the shelf frames on their front edges on the floor, lay the ${countOf(s.postX.length,'back post')} on top of them at the marks, each corner post tight in its notch${middle?', the middle post'+(middle>1?'s spaced evenly':' centered')+' on the rail':''}, and drive two 2 1/2" screws down through each post into the back rail of every frame. (A 3" screw would come out the far side.)${middle?' Where a middle post covers the screws that hold a cross piece, keep its screws clear of them.':''} Then, at every frame, drive two 3" screws through the end rail into the edge of the corner post. These screws are what holds every shelf up, so do not leave any out.`,add:['Post'],pick:garageBackPost},
    {t:`Turn the unit over so it lies on the posts you just fastened. Lay the ${countOf(s.postX.length,'front post')} on at the marks and fasten ${s.postX.length>1?'them':'it'} the same way: two 2 1/2" screws down through each post into the front rail of every frame, then two 3" screws through each end rail into the edge of the corner post. Stand the unit up. The end rails are what stop it from leaning front to back, so do not leave out their screws into the posts.`,add:['Post']},
    {t:`Lay the top deck on. ${s.deckLength<s.W?'It is the full depth of the unit and 1/16" short of its width, so it covers the top ends of the posts and sits flush with the outside of the unit at the front, the back and the left end.':'It is the full size of the unit, so it covers the top ends of the posts and sits flush with the outside of the unit all the way round.'} Screw it down with 1 1/4" screws, about every 8" into the rails, the end rails${s.crossX.length?' and the cross pieces':''}, and two into the top end of each post.`,add:['Top deck']},
    STORAGE_FINISH_STEP,
    {t:s.anchored?'Stand it against the wall. This unit is tall for its depth, so it must be held to the wall before it is loaded. '+garageWallHow(s)+' Keep the heaviest things on the bottom shelf.'
      :'Stand it in place and keep the heaviest things on the bottom shelf. Fasten it to the wall studs if anyone might climb on it (the notes say how).',add:[]}];
  return stepsForPieces(steps,buildGarageShelves(p));
}

/* ======================================================================================================
   Base cabinet with doors: 3/4" plywood sides, a bottom on a toe kick and a base rail, two top rails, a back
   rail for the screws into the wall, a shelf, a 1/4" back, a countertop and overlay doors. A 3/4" plywood shelf sags under a garage load once it
   spans more than about 30", so a wider cabinet gets a partition that stands on the floor like the sides.
   ====================================================================================================== */
/* The form asks for the OVERALL size (the owner's rule: what a person types is what they get): the width and the
   depth of the countertop with the back panel behind it, and the height from the floor to the top of the
   countertop. The cabinet under the countertop is worked out from them (cabinetCase). The limits keep the cabinet
   within the sizes it was checked for: 12" to 47" wide, 12 3/4" to 28 3/4" deep, 24 1/4" to 41 1/4" tall. */
const CABINET_LIMITS={W:[13,48],D:[14,30],H:[25,42]};
const CABINET_TOP={side:.5,front:1,thick:.75,back:.25};   // the countertop overhangs 1/2" at each side and 1" at the front; the 1/4" back panel is behind the sides
const cabinetCase=overall=>({W:r16(overall.W-2*CABINET_TOP.side),D:r16(overall.D-CABINET_TOP.front-CABINET_TOP.back),H:r16(overall.H-CABINET_TOP.thick)});
const CABINET_ONE_DOOR_BELOW=21;    // narrower than this, one door; from here up, a pair
const CABINET_USES={Side:'none',Partition:'none',Bottom:'shelf',Shelf:'shelf',Countertop:'tableTop','Top rail':'tableTop','Toe kick':'shelf','Base rail':'shelf','Back rail':'none',Door:'door'};
/* Fasteners the cabinet names itself: the countertop is screwed from below through the top rails, and only rests
   on the top edges of the sides (a screw there would have to go down through the face of the countertop). The
   sides show nothing outside (CASE_SIDE_JOINTS): the bottom, the rails and the shelf are held by pocket holes. */
const CABINET_JOINTS=[['Countertop','Side','none'],['Countertop','Partition','none'],...CASE_SIDE_JOINTS];

function cabinetPlan(p){
  const T=.75;
  // the overall size typed; W, D and H from here on are the cabinet under the countertop
  const overall={W:sizeWithin(p.W,CABINET_LIMITS.W),D:sizeWithin(p.D,CABINET_LIMITS.D),H:sizeWithin(p.H,CABINET_LIMITS.H)};
  const{W,D,H}=cabinetCase(overall);
  const bays=splitIntoBays(T,W-T,T,flatSpanLimit(T,true,'shelf')*.98);
  return{T,W,D,H,overall,bays,partitions:bays.length-1,doors:W<CABINET_ONE_DOOR_BELOW?1:2,
    studs:Math.max(1,Math.ceil(W/16)),   // wall studs the back rail can reach
    shelfY:r16(4.25+(H-5)/2-.375)};   // halfway between the bottom and the top rails
}
function buildCabinet(p){
  const s=cabinetPlan(p),{T,W,D,H}=s;
  const P=[mk('Side','ply34',[T,H,D],[0,0,0]),mk('Side','ply34',[T,H,D],[W-T,0,0])];
  s.bays.forEach((bay,k)=>{
    if(k>0)P.push(mk('Partition','ply34',[T,H-T,D],[bay.x-T,0,0]));
    P.push(mk('Bottom','ply34',[bay.len,T,D],[bay.x,3.5,0]),
      mk('Toe kick','ply34',[bay.len,3.5,T],[bay.x,0,D-3]),
      mk('Base rail','ply34',[bay.len,3.5,T],[bay.x,0,0]),
      mk('Shelf','ply34',[bay.len,T,D-1],[bay.x,s.shelfY,0]),
      // on edge under the back top rail: the solid wood the screws into the wall studs go through. An empty
      // cabinet with its doors swung open is front-heavy, so it is held to the wall like a kitchen cabinet.
      mk('Back rail','ply34',[bay.len,3.5,T],[bay.x,H-T-3.5,0]));
  });
  P.push(mk('Top rail','ply34',[W-2*T,T,3.5],[T,H-T,0]),mk('Top rail','ply34',[W-2*T,T,3.5],[T,H-T,D-3.5]),
    mk('Back panel','ply14',[W,H-3.5,.25],[0,3.5,-.25]),
    mk('Countertop','ply34',[W+2*CABINET_TOP.side,CABINET_TOP.thick,D+CABINET_TOP.front],[-CABINET_TOP.side,H,0]));
  if(s.doors===1)P.push(mk('Door','ply34',[W-.25,H-4,T],[.125,3.75,D]));
  else{
    const doorWidth=(W-.375)/2;
    P.push(mk('Door','ply34',[doorWidth,H-4,T],[.125,3.75,D]),mk('Door','ply34',[doorWidth,H-4,T],[W/2+.0625,3.75,D]));
  }
  return P;
}
function cabinetInfo(p){
  const s=cabinetPlan(p);
  // the sizes typed are the overall size: say what the cabinet under the countertop comes out at
  const under=`The countertop overhangs the cabinet ${fmt(CABINET_TOP.side)} at each side and ${fmt(CABINET_TOP.front)} at the front, so the cabinet under it is ${fmt(s.W)} wide, ${fmt(s.D)} deep and ${fmt(s.H)} tall.`;
  return under+(s.partitions?` A 3/4" plywood shelf sags under a garage load when it spans more than about ${fmt(Math.floor(flatSpanLimit(s.T,true,'shelf')))}, so this cabinet gets a partition in the middle.`:'');
}
function cabinetNotes(p){
  const s=cabinetPlan(p),bay=Math.max(...s.bays.map(b=>b.len));
  return[`The shelf and the bottom are sized for about ${Math.round(USES.shelf.psf*bay*(s.D-1)/144/5)*5} lb each${s.partitions?' on each side of the partition':''}, spread evenly (50 lb per square foot), and the countertop for the same. It is a countertop, not a workbench for pounding on. These are rule-of-thumb sizes, not an engineer's numbers.`,
    'Screw the cabinet to the wall through the back rail, as the last step says. Empty, with the doors swung open, it is front-heavy, and a child pulling on a door could tip it.',
    'Paint or seal every plywood edge in a garage or a laundry room so damp cannot soak in.'];
}
function cabinetHardware(p){
  const s=cabinetPlan(p),doors=s.doors;
  return[['Cabinet hinges, full overlay',2*doors],['Door pulls',doors],['Magnetic door catches',doors],
    ['Wood screws, 3", through the back rail into the wall studs',2*s.studs]];
}
function cabinetSteps(p){
  const s=cabinetPlan(p),part=s.partitions;
  // Everyday and Fine furniture: nothing shows on the outside of the sides (CASE_SIDE_JOINTS), so every board is held
  // to a side by pocket holes drilled in the board itself; Rustic / rough screws through the sides
  const atSide='the pocket screws listed below, from holes drilled in it before it goes in (the list says which face), so nothing shows on the outside of the sides';
  const steps=[STORAGE_CUT_STEP,
    styledStep({
      std:`Mark the underside of the bottom (3 1/2" from the bottom end) and of the shelf (${fmt(s.shelfY)}) on the inside of both sides${part?' and on both faces of the partition':''}. Fasten ${part?'a bottom panel between each side and the partition':'the bottom between the two sides'}, flush with the back edges. Glue every joint, and hold each end that meets a side with ${atSide}.`+
        (part?' The partition stands on the floor like the sides and is 3/4" shorter, because the top rails sit on it. At the partition, screw through the partition into the bottom panel of the first bay, as the list below says. '+secondSideOfUpright('partition'):''),
      rustic:`Mark the underside of the bottom (3 1/2" from the bottom end) and of the shelf (${fmt(s.shelfY)}) on the inside of both sides${part?' and on both faces of the partition':''}. Fasten ${part?'a bottom panel between each side and the partition':'the bottom between the two sides'}, flush with the back edges. Glue every joint, drill pilot holes and screw through the ${part?'side or the partition':'sides'} into its ends, about every 8".`+
        (part?' The partition stands on the floor like the sides and is 3/4" shorter, because the top rails sit on it. '+secondSideOfUpright('partition'):'')},['Side','Partition','Bottom']),
    styledStep({
      std:`Under ${part?'each bottom panel':'the bottom'}, fasten a toe kick set back 2 1/4" from the front and a base rail flush with the back. Glue them, hold each end that meets a side with ${atSide}, and screw down through the bottom into them about every 8".`+
        (part?' At the partition, the one in the first bay is screwed through the partition, and the one in the next bay gets its two screws driven at an angle through its end into the partition.':'')+` They carry the bottom${part?' panels':''}.`,
      rustic:`Under ${part?'each bottom panel':'the bottom'}, fasten a toe kick set back 2 1/4" from the front and a base rail flush with the back. Glue them, drive two screws through each side into each of their ends, and screw down through the bottom into them about every 8".`+
        (part?' At the partition, the one in the first bay is screwed through the partition, and the one in the next bay gets its two screws driven at an angle through its end into the partition.':'')+` They carry the bottom${part?' panels':''}.`},['Toe kick','Base rail']),
    styledStep({
      std:`Fasten the two top rails between the sides, lying flat and flush with the top, one at the front and one at the back, with glue and ${atSide}${part?'. Then screw down through them into the top of the partition (the countertop covers those heads)':''}.`,
      rustic:`Fasten the two top rails between the sides, lying flat and flush with the top, one at the front and one at the back, with glue and two screws through each side into each end${part?'. Then screw down through them into the top of the partition':''}.`},['Top rail']),
    styledStep({
      std:`Under the back top rail, fasten ${part?'a back rail in each bay':'the back rail'}, standing on edge and flush with the back. Glue it, hold each end that meets a side with ${atSide}, and screw down through the top rail into it about every 8".`+
        (part?' At the partition, do as you did with the base rails.':'')+' The screws that hold the cabinet to the wall will go through this rail.',
      rustic:`Under the back top rail, fasten ${part?'a back rail in each bay':'the back rail'}, standing on edge and flush with the back. Glue it, drive two screws through each side into each of its ends, and screw down through the top rail into it about every 8".`+
        (part?' At the partition, do as you did with the base rails.':'')+' The screws that hold the cabinet to the wall will go through this rail.'},['Back rail']),
    styledStep({
      std:`Fasten ${part?'a shelf in each bay':'the shelf'} at the marks, with glue and ${atSide}${part?' (and at the partition, the second shelf the same way as the second bottom panel)':''}. It sits flush with the back and 1" back from the front, so the doors can close.`,
      rustic:`Fasten ${part?'a shelf in each bay':'the shelf'} at the marks, with glue and a screw about every 8" through the sides into its ends${part?' (and at the partition, the second shelf the same way as the second bottom panel)':''}. It sits flush with the back and 1" back from the front, so the doors can close.`},['Shelf']),
    {t:'Lay the cabinet face down. Measure corner to corner both ways and nudge the cabinet until the two measurements match, then glue and nail the back panel on, with a nail about every 6" into every edge it lies against. The back keeps the cabinet square.',add:['Back panel']},
    {t:'Set the countertop on so it overhangs 1/2" on each side and 1" at the front. Screw up through the two top rails into it with 1 1/4" screws, about every 8": they hold without coming through the top.',add:['Countertop']},
    STORAGE_FINISH_STEP,   // before the doors: a door is finished lying flat, and no hinge or pull gets finish on it
    // The hinges are the concealed cup hinges the program places and lists (hangDoor, js/hanging.js): the sentence
    // names that kind, and puts them where hingeInset puts them, so the words agree with the lines under them.
    {t:(s.doors===1?'Hang the door, on whichever side suits the room, on two concealed cup hinges (full overlay). ':'Hang the two doors, one hinged on each side of the cabinet, on two concealed cup hinges (full overlay) each. ')+
      CUP_HINGE_HOLE+
      `Lay a door face down, drill the two cup holes along the hinged side, one ${fmt(hingeInset(s.H-4))} below the top edge and one ${fmt(hingeInset(s.H-4))} above the bottom edge, and screw a hinge into each. `+
      'Hold the door against the front of the cabinet with its top edge 1/4" below the countertop and its hinged side 1/8" in from the outside of the cabinet side, and screw the plates of the hinges to the inside of that side. Turn the adjusting screws until the gaps are even. '+
      (s.doors===1?'':'Hang the second door the same way: the two meet in the middle with a gap of 1/8". ')+
      `Screw a magnetic catch under the front top rail where the free side of ${s.doors===1?'the door':'each door'} closes, and its metal plate to the back of the door. Then drill for the ${s.doors===1?'pull':'pulls'} and screw ${s.doors===1?'it':'them'} on.`,add:['Door']},
    {t:`Set the cabinet against the wall, find the wall studs with a stud finder, and drive two 3" screws through the back rail into every stud it crosses (at least one)${s.W<32?'. Studs are usually 16" apart, so slide a narrow cabinet sideways until its rail crosses one':''}. If a baseboard holds the cabinet off the wall, put a scrap of wood that thick behind the rail at each screw. Do this before you load it: with the doors open an empty cabinet is front-heavy.`,add:[]}];
  return stepsForPieces(steps,buildCabinet(p));
}

/* ======================================================================================================
   Wall shelf: a board on a 1x4 cleat that is screwed into the wall studs, with supports under it. The cleat
   carries the back edge; the supports, screwed to the cleat and to the shelf, carry the front. A longer shelf
   gets more supports so the board never spans more than about 32" between them.
   ====================================================================================================== */
const WALL_SHELF_LIMITS={L:[16,96],up:[12,84]};
const WALL_SHELF_INSET=4;           // the end supports sit this far in from the ends of the shelf
const WALL_SHELF_USES={Shelf:'shelf',Support:'shelf','Wall cleat':'shelf'};
const WALL_SHELF_ON_WALL=['Wall cleat'];

function wallShelfPlan(p){
  const board=M[p.board]&&M[p.board].kind==='board'?p.board:'1x8',depth=M[board].w;
  const L=sizeWithin(p.L,WALL_SHELF_LIMITS.L),up=sizeWithin(p.up,WALL_SHELF_LIMITS.up);
  const maxGap=Math.min(32,flatSpanLimit(.75,false,'shelf')*.95);
  const run=L-2*WALL_SHELF_INSET-.75;                            // from the first support to the last
  const count=Math.max(2,Math.ceil(run/(maxGap+.75))+1),supportX=[];
  for(let k=0;k<count;k++)supportX.push(r16(WALL_SHELF_INSET+run*k/(count-1)));
  return{board,depth,L,up,supportX,studs:Math.max(1,Math.ceil(L/16)),
    load:Math.round(USES.shelf.psf*L*depth/144/5)*5};
}
function buildWallShelf(p){
  const s=wallShelfPlan(p);
  const P=[mk('Wall cleat','1x4',[s.L,3.5,.75],[0,s.up,0]),mk('Shelf',s.board,[s.L,.75,s.depth],[0,s.up+3.5,0])];
  for(const x of s.supportX)P.push(mk('Support','1x4',[.75,3.5,s.depth-1.5],[x,s.up,.75]));
  return P;
}
function wallShelfInfo(p){
  const s=wallShelfPlan(p);
  return`Sized for about ${s.load} lb spread evenly, with the cleat screwed into wall studs.`+(s.supportX.length>2?` At this length it gets ${s.supportX.length} supports.`:'');
}
function wallShelfNotes(p){
  const s=wallShelfPlan(p);
  return[`The shelf is sized for about ${s.load} lb spread evenly (50 lb per square foot), and only when the cleat is screwed into wall studs. Drywall anchors alone will not hold a loaded shelf. These are rule-of-thumb sizes, not an engineer's numbers.`,
    s.L<32?'Studs are usually 16" apart, so a shelf this short may cross only one. Put two screws into that stud and a heavy-duty toggle bolt near each end of the cleat.'
      :'Studs are usually 16" apart. Put two screws into every stud the cleat crosses.'];
}
function wallShelfHardware(p){
  const s=wallShelfPlan(p);
  return[['Wood screws, 3", into the wall studs',2*s.studs]].concat(s.L<32?[['Heavy-duty toggle bolts',2]]:[]);
}
function wallShelfSteps(p){
  const s=wallShelfPlan(p),n=s.supportX.length;
  return[STORAGE_CUT_STEP,
    styledStep({
      std:'Glue the shelf onto the top edge of the wall cleat, flush along the back, and fasten it from below with the pocket screws listed below, from holes drilled in the back face of the cleat (the face that goes against the wall, so no hole shows).',
      rustic:'Glue and screw the shelf onto the top edge of the wall cleat, flush along the back, with a screw every 8".'},['Wall cleat','Shelf']),
    styledStep({
      std:`Fasten the ${n} supports under the shelf, tight against the cleat: one ${fmt(WALL_SHELF_INSET)} in from each end${n>2?' and the rest spaced evenly between them':''}. Drive two screws in through the back of the cleat into the end of each support, and fasten the shelf to each support with the pocket screws listed below, from holes in a face of the support near its top edge. The supports are what hold the front of the shelf up.`,
      rustic:`Fasten the ${n} supports under the shelf, tight against the cleat: one ${fmt(WALL_SHELF_INSET)} in from each end${n>2?' and the rest spaced evenly between them':''}. Drive two screws in through the back of the cleat into the end of each support and two down through the shelf into it. The supports are what hold the front of the shelf up.`},['Support']),
    STORAGE_FINISH_STEP,
    {t:`Find the wall studs with a stud finder. Hold the shelf level with its top ${fmt(s.up+4.25)} above the floor and drive two 3" screws through the cleat into every stud it crosses.`+
      (s.L<32?' If it crosses only one stud, add a heavy-duty toggle bolt through the cleat near each end.':'')+' Do not rely on plastic drywall anchors for a loaded shelf.',add:[]}];
}

/* ======================================================================================================
   Storage box / toy chest: a plywood box whose bottom sits inside the four walls on the floor, with a lid
   that rests on the walls. People sit on toy chests, so the lid is sized as a seat: a 1/2" box whose lid would
   span too far for a person gets a 3/4" lid.
   ====================================================================================================== */
/* The form asks for the OVERALL size (what a person types is what they get): with the lid on, the height is to the
   top of the lid, and the walls are that much lower (the lid lies on them, as wide as the box; it is the depth typed,
   and the walls stand back from its front edge by the lip a person lifts it by, STORAGE_BOX_LID_LIP). */
const STORAGE_BOX_LIMITS={W:[12,48],D:[10,24],H:[9,24]};
/* What the structural check loads each piece with: the lid as a lid people sit on (USES.seatLid: a seat's load, and
   like any lid it only rests on the walls, held by its hinges) and the bottom as a shelf, because the notes say a
   grown person may sit on the lid and the bottom carries toys and blankets (the preset audit of 20 Nov, note 11; the
   code review of the audit fixes, 11: what a preset claims is checked by code). */
const STORAGE_BOX_USES={Lid:'seatLid',Bottom:'shelf',Front:'none',Back:'none',Side:'none'};
/* How far the lid reaches past the front wall: the lip a person lifts it by (the preset audit of 20 Nov, finding 3:
   the bar pull screwed to the top of the lid was in the way of someone sitting on it, and a child could trip on
   it). Reference sheet 20 says a chest lid "has a front lip or pull" and gives about 1/2" of overhang on a starter
   plan (one source); 3/4" is the program's own choice (PRACTICE), enough for the fingertips. The lid stays flush
   with the back, where it is hinged, and with the two ends; nothing is fastened to its top. */
const STORAGE_BOX_LID_LIP=.75;
/* how the air holes are drilled and why, the end of the step that drills them (also written into an old chest that
   gets its holes when it is opened: toyChestAirStepFromWalls, js/reviewupgrade.js) */
const toyChestAirHoleHow=()=>`Use a ${fmt(AIR_HOLES.d)} spade bit with a scrap clamped under the wood, so it does not splinter where the bit comes out. `+
  'They let air in if a child is shut inside, so a chest that may hold toys must have them: never leave them out, and never put them only in the back or the bottom, where a wall or the floor can block them.';

function storageBoxPlan(p){
  const ply=M[p.ply]&&M[p.ply].kind==='sheet'&&M[p.ply].t>=.5?p.ply:'ply34',t=M[ply].t;
  const W=sizeWithin(p.W,STORAGE_BOX_LIMITS.W),D=sizeWithin(p.D,STORAGE_BOX_LIMITS.D),overallH=sizeWithin(p.H,STORAGE_BOX_LIMITS.H);
  // with a lid, the walls stand the lip less deep than the depth typed, so the lid's front edge is the front of
  // the chest (the depth typed is the overall depth, js/overallsizes.js)
  const lip=p.lid?STORAGE_BOX_LID_LIP:0,wallD=r16(D-lip);
  // The lid is held along all four walls, so it only has to make the shorter distance. Somebody will sit on it,
  // so when the chosen plywood cannot carry a person that far the lid is cut from 3/4" plywood instead.
  const lidSpan=Math.min(W,wallD)-2*t;
  const lidPly=lidSpan>flatSpanLimit(t,true,'seat')*.98?'ply34':ply,lidT=M[lidPly].t;
  // H from here on is the height of the walls: the overall height less the lid that lies on them
  const H=r16(p.lid?overallH-lidT:overallH);
  return{ply,t,W,D,wallD,lip,H,overallH,lid:!!p.lid,lidSpan,lidPly,lidT,thickerLid:lidPly!==ply};
}
function buildStorageBox(p){
  const s=storageBoxPlan(p),{ply,t,W,D,H}=s,wallD=s.wallD;
  const P=[mk('Front',ply,[W,H,t],[0,0,wallD-t]),mk('Back',ply,[W,H,t],[0,0,0]),
    mk('Side',ply,[t,H,wallD-2*t],[0,0,t]),mk('Side',ply,[t,H,wallD-2*t],[W-t,0,t]),
    mk('Bottom',ply,[W-2*t,t,wallD-2*t],[t,0,t])];
  if(s.lid){
    // (noPull: hung without a pull, hangPresetDoors in js/hanging.js; the lip at the front is what lifts it)
    P.push({...mk('Lid',s.lidPly,[W,s.lidT,D],[0,H,0]),noPull:true});
    // a chest a child can be shut in gets its air holes, as real holes in the front and the two ends
    for(const wall of P.filter(piece=>piece.name==='Front'||piece.name==='Side'))drillAirHoles(wall);
  }
  return P;
}
/* ---- air holes of a toy chest ----
   Reference sheet 20 (design\reference\20-boxes-and-chests.md): CPSC asks for "ventilation holes that are not blocked
   by the floor or against the wall" (2a), and lists a toy chest "with no ventilation holes, or holes only in the
   bottom or back where the floor or a wall blocks them" among the things that are wrong (5, item 3); its safety
   words say to drill them "in the sides near the top" (6). So they go high on the front and on BOTH ends: a chest
   pushed into a corner still has its front and one end open. Neither CPSC nor anything the sheet read gives a size
   or a count (2a, and "still uncertain"), so these numbers are the program's own choice (PRACTICE), never a rule:
     d       1": a common spade bit
     down    the centers 1 1/4" below the top edge of the wall: high, just under the lid that lies on the walls, with
             3/4" of wood left above each hole; and clear of the lid stay, which is screwed 2 1/2" below the lid
     end     no hole nearer than 3 1/2" to an end of a wall, where the pocket screws of the corners go in
     apart   about 6" apart along a wall, at least one hole in every wall
   Every hole is measured from one named end and the top edge of its wall (the Front from its left end, a Side from
   its front end), so the Shapes to cut drawing and the step give the same numbers. */
const AIR_HOLES={d:1,down:1.25,end:3.5,apart:6};
/* where the holes go along a wall this long: distances from the end they are measured from */
function airHolePlaces(length){
  const span=length-2*AIR_HOLES.end;
  if(span<=0)return[r16(length/2)];
  const count=Math.floor(span/AIR_HOLES.apart+1e-9)+1;
  if(count===1)return[r16(length/2)];
  const places=[];
  for(let i=0;i<count;i++)places.push(r16(AIR_HOLES.end+i*span/(count-1)));
  return places;
}
/* cuts the air holes in one wall (the Front or a Side, standing up): along its level direction from the left end
   (the Front) or the front end (a Side), and down from its top edge */
function drillAirHoles(wall){
  const up=wall.ax.indexOf(1),level=up===0?1:0;            // which of the piece's length and width runs up
  const levelAxis=wall.ax[level],length=level===0?wall.l:wall.w;
  const fromHigh=levelAxis===2;                              // a Side runs front to back: measured from its front end
  for(const place of airHolePlaces(length)){
    const along={from:fromHigh?1:0,d:place},down={from:1,d:AIR_HOLES.down};
    addHole(wall,{d:AIR_HOLES.d,at:up===0?{u:down,v:along}:{u:along,v:down}});
  }
  return wall;
}
function storageBoxInfo(p){
  const s=storageBoxPlan(p);
  const thicker=s.lid&&s.thickerLid?`The lid is cut from 3/4" plywood: a ${fmt(s.t)} lid ${fmt(s.lidSpan)} across would crack if someone sat on it. `:'';
  // the height typed is the overall height: with the lid on, the walls are the lid's thickness lower
  return thicker+(s.lid?`The walls are ${fmt(s.H)} tall, so with the ${fmt(s.lidT)} lid on top it stands ${typedLen(s.overallH)} tall.`:'');
}
/* the honest line every preset carries (the preset audit of 20 Nov, finding 4) */
const storageBoxRuleOfThumb=lid=>(lid?'The lid is sized for a grown person sitting on it, and the bottom for toys and blankets.':'The bottom is sized for toys and blankets.')+
  ' These are rule-of-thumb sizes, not an engineer\'s numbers.';
function storageBoxNotes(p){
  const s=storageBoxPlan(p);
  if(!s.lid)return[storageBoxRuleOfThumb(false)];
  const holes=storageBoxAirHoles(p);
  return[(s.thickerLid?'The lid is cut from 3/4" plywood, because a thinner lid this wide would crack if someone sat on it. ':'')+
    `The lid is stiff enough for someone to sit on. Do not stand on it. It reaches ${fmt(s.lip)} past the front, and you lift it by that lip: no pull is screwed to its top, where someone sits.`,
    storageBoxRuleOfThumb(true),toyChestWarning(holes.total)];
}
/* reference sheet 20, section 6: the toy chest warnings (CPSC), for a chest with this many air holes (also written
   into a design saved before the air holes, when it is opened: js/reviewupgrade.js) */
function toyChestWarning(total){
  return`A child can climb into a chest like this and be shut in. So it has ${total} air holes, ${fmt(AIR_HOLES.d)} across, high on the front and on both ends, where the floor or a wall cannot block them (the U.S. Consumer Product Safety Commission's advice for toy chests). Drill every one, and never move them to the back or the bottom only. `+
    'Use a lid support that holds the lid open at any position (sold as a toy box lid support), so the lid cannot fall on a child, and do not fit a latch, hasp or lock.';
}
/* the air holes of the chest these values build: where along the front and along each side, and how many in all */
function storageBoxAirHoles(p){
  const s=storageBoxPlan(p);
  if(!s.lid)return{front:[],side:[],total:0};
  const front=airHolePlaces(s.W),side=airHolePlaces(s.wallD-2*s.t);
  return{front,side,total:front.length+2*side.length};
}
function storageBoxHardware(p){
  return storageBoxPlan(p).lid?[['Hinges, 2 1/2", for the lid',2],['Soft-close lid support',1]]:[];
}
function storageBoxSteps(p){
  const s=storageBoxPlan(p);
  // The walls go together in two steps, so that only the last one is screwed from inside the closed box: the
  // sides onto the front first, while the drill has all the room it wants behind each pocket hole, then the back.
  // The bottom's holes are all on its underside and are driven with the chest upside down.
  // the air holes, in a step of their own while the front and the sides lie flat (their drawings are in Shapes to
  // cut on the cut list page, measured from the same end and edge as these words)
  const holes=storageBoxAirHoles(p),built=buildStorageBox(p);
  // the names of the top and of the end or edge each wall is measured from, as its drawing names them (a wall
  // taller than it is long has its "ends" at the top and the bottom)
  const sideNames=name=>{
    const wall=built.find(piece=>piece.name===name);
    if(!wall)return{top:'top',from:''};
    const up=wall.ax.indexOf(1),level=up===0?1:0,fromHigh=wall.ax[level]===2;
    const nameOf=(index,high)=>shapeLower(index===0?shapeEndName(wall,high?1:0):shapeEdgeName(wall,high?1:0));
    return{top:nameOf(up,true),from:nameOf(level,fromHigh)};
  };
  const frontNames=sideNames('Front'),endNames=sideNames('Side');
  const airStep={t:`The holes that Shapes to cut shows in the front and the sides are air holes. Drill them while those pieces lie flat on the bench, before anything goes together: ${holes.front.length} in the front and ${holes.side.length} in each side, ${fmt(AIR_HOLES.d)} across, `+
    `each center ${fmt(AIR_HOLES.down)} down from the top of the piece. In the front: ${listWords(holes.front.map(fmt))} from its ${frontNames.from} (and ${fmt(AIR_HOLES.down)} from its ${frontNames.top}). In each side: ${listWords(holes.side.map(fmt))} from its ${endNames.from}, the one that meets the front (and ${fmt(AIR_HOLES.down)} from its ${endNames.top}). `+
    'Shapes to cut is on the cut list page. '+toyChestAirHoleHow(),add:[],
    // this step, not the cutting step, makes the shapes of these pieces (js/buildsteps.js: the cutting step leaves
    // them out, and this step lists the bit they need)
    shapes:['Front','Side']};
  const steps=[STORAGE_CUT_STEP,...(s.lid?[airStep]:[]),
    styledStep({
      std:'Drill the pocket holes listed below on the inside face of each side, at both ends (the ends that meet the front and the back). Stand the front face down, glue the front end of each side and fasten the two sides to it with the pocket screws listed below, square to the front, so nothing shows on the outside of the chest.',
      rustic:'Stand the front face down and fasten the two sides to it, square to it. Glue each joint, drill pilot holes and screw through the front into the side edges, a screw every 6".'},['Front','Side'],
      ['Drill the pocket holes listed below on the inside face of each side, at both ends (the ends that meet the front and the back). ']),
    styledStep({
      std:'Glue the back ends of the sides, set the back on, flush all round, and drive the pocket screws listed below from inside the chest into the back.',
      rustic:'Set the back on the other ends of the sides, flush all round, and screw through it into the side edges the same way, with glue.'},['Back']),
    styledStep({
      std:'Drill the pocket holes listed below in the underside of the bottom, along all four edges. Turn the chest upside down, drop the bottom in flush with the lower edges, glue it and drive the pocket screws into the front, the back and the two sides, so nothing shows on the outside of the chest.',
      rustic:'Drop the bottom in flush with the lower edges and fasten it through all four walls with glue and a screw every 6".'},['Bottom'],
      ['Drill the pocket holes listed below in the underside of the bottom, along all four edges. ']),
    {t:`Set the lid on top, flush with the back and the two ends, with its front edge ${fmt(s.lip)} past the front of the chest: that lip is what you lift it by, so nothing is fastened to the top of the lid. Hang it on two hinges along the back. Fit the lid support inside, one that holds the lid open at any position, so the lid cannot fall or slam on a child. Fit no latch or lock.`,add:['Lid']},
    STORAGE_FINISH_STEP];
  return stepsForPieces(s.lid?steps:steps.filter(step=>!step.add.includes('Lid')),buildStorageBox(p));
}

/* ---------- self-checks for this file (selfTest runs every function in SELFTESTS, see js/core.js) ---------- */
/* Garage shelves: the top deck covers the whole top and the posts stop under it; every lower deck fits between
   the posts. Tried at the default sizes and at each limit. */
SELFTESTS.push(function garageTopDeck(problems){
  const near=(a,b)=>Math.abs(a-b)<.01;
  const L=GARAGE_LIMITS;
  const shapes=[{},{W:L.W[0]},{W:L.W[1]},{D:L.D[0]},{D:L.D[1]},{H:L.H[0],n:L.n[0]},{H:L.H[1]},{n:L.n[0]},{n:L.n[1]},
    {W:L.W[1],D:L.D[1],H:L.H[1],n:L.n[1]},{W:L.W[0],D:L.D[0],H:L.H[1]}];
  for(const shape of shapes){
    const vals={W:48,D:18,H:72,n:4,...shape},label='garage shelves '+JSON.stringify(shape)+': ';
    const parts=buildGarageShelves(vals),tops=parts.filter(piece=>piece.name==='Top deck');
    if(tops.length!==1){problems.push(label+'there must be exactly one top deck');continue;}
    const top=box(tops[0]),posts=parts.filter(piece=>piece.name==='Post').map(box);
    // (full width, but for the 1/16" a deck gives up at the right end to share a sheet: garageDeckLength)
    const deckLength=garagePlan(vals).deckLength;
    if(deckLength<vals.W-GARAGE_DECK_GIVE-1e-6)problems.push(label+`the decks are ${fmt(deckLength)} long, more than 1/16" short of the ${fmt(vals.W)} width`);
    if(!near(top.lo[0],0)||!near(top.hi[0],deckLength)||!near(top.lo[2],0)||!near(top.hi[2],vals.D)||!near(top.hi[1],vals.H))problems.push(label+'the top deck does not cover the whole top');
    if(posts.some(post=>!near(post.hi[1],top.lo[1])))problems.push(label+'the posts do not stop under the top deck');
    // the deck rests on the top frame as well as on the post tops
    const frame=parts.filter(piece=>piece.name==='Rail'||piece.name==='End rail').map(box).filter(rail=>near(rail.hi[1],top.lo[1]));
    if(frame.length!==4)problems.push(label+'the top deck does not rest on the two rails and two end rails of the top frame');
    const lower=parts.filter(piece=>piece.name==='Shelf deck').map(box);
    if(lower.length!==vals.n-1)problems.push(label+'every frame below the top one needs a deck that fits between the posts');
    if(lower.some(deck=>posts.some(post=>[0,1,2].every(k=>deck.lo[k]<post.hi[k]-.01&&post.lo[k]<deck.hi[k]-.01))))problems.push(label+'a lower deck runs into a post');
    // one full sheet is enough for the top deck, and the words follow the pieces
    if(Math.min(vals.W,vals.D)>SHEET_WIDTH||Math.max(vals.W,vals.D)>96)problems.push(label+'the top deck cannot be cut from one sheet of plywood');
    const steps=garageSteps(vals),topStep=steps.find(step=>step.add.includes('Top deck')),postStep=steps.findIndex(step=>step.add.includes('Post'));
    if(!topStep||steps.indexOf(topStep)<postStep)problems.push(label+'the top deck needs its own step, after the posts are on');
  }
});
/* Garage shelves: a deck gives up 1/16" only where that lets one more deck come out of a sheet's 8 ft length (at the
   usual 48" width: two to the length, four decks to one sheet), it still rests on the end rail at both ends, and
   at no width the form allows does the shopping list buy more sheets than with the decks the full width. */
SELFTESTS.push(function garageDecksShareASheet(problems){
  const say=text=>{if(problems.length<60)problems.push('garage shelves: '+text);};
  const L=GARAGE_LIMITS;
  if(garageDeckLength(48)!==48-GARAGE_DECK_GIVE)say(`48" wide, the decks are ${fmt(garageDeckLength(48))} long, not 47 15/16" (two to the 8 ft length of a sheet)`);
  if(garageDeckLength(40)!==40||garageDeckLength(32)!==32)say('a deck that shares a sheet without it gives up 1/16"');
  // the notes say how many decks then come out of the sheet's length: two at 48", three at 31 15/16" (31 7/8" decks)
  for(const[W,word]of[[48,'two'],[31.9375,'three']]){
    const notes=garageNotes({W,D:18,H:72,n:4}).join(' ');
    if(!notes.includes(`so that ${word} of them come out of the 8 ft length`))say(`${W}" wide, the notes do not say that ${word} decks come out of the 8 ft length of a sheet`);
  }
  const sheetsFor=parts=>{const pieces=parts.filter(piece=>piece.mat==='ply12');return materialBuy(M.ply12,pieces,()=>'',0).sheets.length;};
  const widths=[];
  for(let W=L.W[0];W<=L.W[1];W+=1)widths.push(W);
  widths.push(31.9375,47.9375,48.0625);
  for(const W of widths)for(const D of[L.D[0],18,L.D[1]])for(const n of[L.n[0],4,L.n[1]]){
    const vals={W,D,H:72,n},label=`${fmt(W)} wide, ${fmt(D)} deep, ${n} shelves: `;
    if((garageCheck(vals)||[]).some(f=>f.level==='stop'))continue;
    const s=garagePlan(vals),parts=buildGarageShelves(vals);
    const decks=parts.filter(piece=>/deck$/.test(piece.name)).map(box);
    const rightRail=parts.filter(piece=>piece.name==='End rail').map(box).filter(rail=>rail.lo[0]>W/2);
    if(decks.some(deck=>Math.abs(deck.hi[0]-deck.lo[0]-s.deckLength)>1e-6))say(label+'a deck is not the deck length');
    // resting on the right end rail: at least 1" of its 1 1/2" under the deck
    if(rightRail.some(rail=>decks.some(deck=>Math.abs(deck.lo[1]-rail.hi[1])<.01&&deck.hi[0]-rail.lo[0]<1)))say(label+'a deck does not rest on the end rail at the right end');
    if(s.deckLength<W){
      // what the full-width decks would need: the same pieces at the full length
      const full=parts.map(piece=>/deck$/.test(piece.name)?{...piece,l:W}:piece);
      if(sheetsFor(parts)>sheetsFor(full))say(label+`the decks 1/16" shorter buy ${sheetsFor(parts)} sheets, more than the ${sheetsFor(full)} of full-width decks`);
    }
  }
});
/* No preset may have a top like the one the owner pointed at on the Garage shelves: a plywood deck fitted between
   posts whose top ends show beside it. Wherever a preset has decks and posts, the highest deck must lie over the
   top end of every post that reaches up to it. Tried on every preset at its default sizes and with every choice
   of each option of its form (a list of choices, or a tick box); today that is the Garage shelves and the three
   fish tank presets, and a new preset with decks on posts is covered without anyone adding it here. */
SELFTESTS.push(function noPostBesideTheTopDeck(problems){
  for(const preset of PRESETS){
    const defaults=presetDefaults(preset),tries=[defaults];
    for(const q of preset.params){
      if(q.opts)for(const[value]of q.opts)tries.push({...defaults,[q.k]:value});
      else if(q.check)tries.push({...defaults,[q.k]:!q.v});
    }
    const seen=new Set();
    for(const vals of tries){
      let parts=[];
      try{parts=preset.build(vals)||[];}
      catch(e){continue;}               // choices the preset refuses are judged by its check(p), not here
      // (the countertop of a closed fish cabinet is a deck too: js/fishtop.js)
      const decks=parts.filter(piece=>/deck$|^countertop$/i.test(piece.name)&&!tilted(piece)).map(box),posts=parts.filter(piece=>piece.name==='Post').map(box);
      if(!decks.length||!posts.length)continue;
      const topOfDecks=Math.max(...decks.map(deck=>deck.hi[1]));
      const topDecks=decks.filter(deck=>deck.hi[1]>topOfDecks-.01);
      // a post that comes up to the top deck (or past it) must have that deck over its whole top end
      const covered=post=>topDecks.some(deck=>Math.abs(deck.lo[1]-post.hi[1])<.01&&[0,2].every(k=>deck.lo[k]<=post.lo[k]+.01&&deck.hi[k]>=post.hi[k]-.01));
      const poking=posts.filter(post=>post.hi[1]>topDecks[0].lo[1]-.01&&!covered(post));
      const said=`${preset.name}: ${poking.length} post${poking.length===1?'':'s'} show beside the top deck instead of stopping under it`;
      if(poking.length&&!seen.has(said)){seen.add(said);problems.push(said);}
    }
  }
});
/* Bookshelf: the clear height of each opening can be set ("Shelf spacing" in the form). Evenly spaced unless
   the person chooses to set them; heights set are used from the bottom up, a box left at 0 shares what is left,
   and the top opening always takes up the slack. Heights that cannot work are refused with the reason and the
   fix, never built wrong. Then the sweep: cases at the corners of the form's limits, with the openings set as
   unevenly as they can be, must still pass the structural check with nothing to report. */
SELFTESTS.push(function bookshelfShelfOpenings(problems){
  const preset=PRESETS.find(candidate=>candidate.name==='Bookshelf');
  if(!preset)return;
  const base={...presetDefaults(preset),W:32,H:48,board:'1x10',n:3,back:true},near=(a,b)=>Math.abs(a-b)<.07;
  const setTo=(heights,more)=>({...base,...more,spacing:'set',...Object.fromEntries(heights.map((height,i)=>['o'+(i+1),height]))});
  // the clear heights a build really has, bottom to top, measured on the pieces themselves (the first bay)
  const built=vals=>{
    const parts=buildBookshelf(vals),level=name=>parts.filter(piece=>piece.name===name).map(box);
    const boards=level('Bottom').slice(0,1).concat(level('Shelf').filter(shelf=>near(shelf.lo[0],.75)),level('Top')).sort((a,b)=>a.lo[1]-b.lo[1]);
    return boards.slice(1).map((board,i)=>board.lo[1]-boards[i].hi[1]);
  };
  const said=heights=>heights.map(fmt).join(', ');

  // the form: the choice, and one box with limits for each shelf the form allows, shown only for the openings there are
  const boxes=preset.params.filter(q=>/^o\d+$/.test(q.k||''));
  if(!preset.params.some(q=>q.k==='spacing'&&q.v==='even'))problems.push('bookshelf: the form must offer Shelf spacing, evenly spaced to start with');
  if(boxes.length!==BOOKSHELF_LIMITS.n[1]||boxes.some(q=>q.min!==0||!(q.max>0)||q.v!==0||typeof q.show!=='function'))problems.push('bookshelf: the form needs one opening box for each shelf it allows, each with limits and starting at 0');
  else if(boxes.filter(q=>q.show({spacing:'set',n:3})).length!==3||boxes.some(q=>q.show({spacing:'even',n:3})))problems.push('bookshelf: with 3 shelves and the heights set by hand the form must show 3 opening boxes, and none when evenly spaced');

  // evenly spaced: by default, and when every box is left at 0; boxes do nothing while the choice is "evenly spaced"
  const even=built(base);
  if(even.length!==4||!even.every(height=>near(height,even[0])))problems.push('bookshelf: evenly spaced shelves are not evenly spaced: '+said(even));
  if(said(built(setTo([0,0,0])))!==said(even))problems.push('bookshelf: with every opening box at 0 the shelves must be evenly spaced');
  if(said(built({...setTo([14,8]),spacing:'even'}))!==said(even))problems.push('bookshelf: opening heights must do nothing while Shelf spacing is "Evenly spaced"');

  // heights set from the bottom up; what is left is shared by the boxes at 0 and the top opening
  const cases=[[[14,8],[14,8,null,null]],[[14,8,6],[14,8,6,12.75]],[[0,0,12],[null,null,12,null]],[[10.5],[10.5,null,null,null]]];
  for(const[heights,want]of cases){
    // the openings left to share are the same to the 1/16"; the top one takes what is left, a few sixteenths more at most
    const vals=setTo(heights),got=built(vals),free=got.filter((height,i)=>want[i]===null),top=got[got.length-1];
    const shared=free.slice(0,-1).every(height=>Math.abs(height-free[0])<.001)&&top>=free[0]-.001&&top-free[0]<free.length/16;
    const right=want.every((height,i)=>height===null||near(got[i],height))&&(want[want.length-1]!==null||shared)&&near(got.reduce((sum,height)=>sum+height,0),even[0]*4);
    if(!right||bookshelfCheck(vals).length)problems.push(`bookshelf: openings set to ${heights.join(', ')} came out as ${said(got)}`);
    if(!bookshelfInfo(vals).includes(said(got)))problems.push(`bookshelf: the remark under the form does not give the openings ${said(got)}`);
    const marks=bookshelfSteps(vals).map(step=>step.t).join(' ');
    if(!marks.includes(said(got)))problems.push(`bookshelf: the steps do not give the openings ${said(got)}`);
  }
  if(/not evenly spaced/.test(bookshelfSteps(base).map(step=>step.t).join(' ')))problems.push('bookshelf: the steps of an evenly spaced case say the shelves are not evenly spaced');
  // a box above the last shelf belongs to no opening and is passed over
  if(said(built(setTo([14,8,0,30,30])))!==said(built(setTo([14,8]))))problems.push('bookshelf: an opening box above the last shelf must be passed over');

  // what cannot work is refused in plain words, with what to change
  const refusals=[[[2,10],{},/Opening 1 \(the bottom one\) is set to 2"/],[[12,3],{},/Opening 2 is set to 3"/],[[20,20],{},/add up to 40"/],
    [[36],{},/you set is 36"/],[[14,5],{W:72},/meet a divider/],[[10,10],{H:30},/add up to 20"/],[[79],{H:84,n:1},/nothing|only/],
    [[6,6,6],{H:24,n:4},/4 shelves in a case 24" tall would be only/],[[],{n:8,H:36,spacing:'even'},/8 shelves in a case 36" tall/]];
  for(const[heights,more,why]of refusals){
    const vals={...setTo(heights,more),...(more.spacing?{spacing:more.spacing}:{})},found=bookshelfCheck(vals);
    if(found.length!==1||found[0].level!=='stop'||!why.test(found[0].text)||!found[0].fix)problems.push(`bookshelf: openings set to ${heights.join(', ')||'nothing'} with ${JSON.stringify(more)} must be refused with the reason and the fix, and got: ${found.map(f=>f.text).join(' / ')||'no refusal'}`);
    // a refused form still draws a sensible case: the shelves fall back to even spacing
    const fallback=built(vals);
    if(!fallback.every(height=>near(height,fallback[0])))problems.push(`bookshelf: a refused set of openings (${heights.join(', ')}) must fall back to even spacing in the picture`);
  }

  // the sweep: narrowest and widest (which has dividers), shortest and tallest, few and many shelves, and the
  // openings as uneven as the case allows: all the slack in the top opening, then all of it in the bottom one
  for(const W of BOOKSHELF_LIMITS.W)for(const H of BOOKSHELF_LIMITS.H)for(const n of[1,3,BOOKSHELF_LIMITS.n[1]])for(const back of[true,false]){
    const plan=bookshelfPlan({...base,W,H,n,back}),least=plan.least;
    if(plan.room/(n+1)<least)continue;                       // too many shelves for this height: refused, tried above
    const slack=Math.floor((plan.room-(n+1)*least)*16)/16;
    for(const heights of[Array(n).fill(least),[least+slack].concat(Array(n-1).fill(least))]){
      const vals=setTo(heights,{W,H,n,back}),label=`bookshelf ${W}" wide, ${H}" tall, ${n} shelves${back?'':', no back'}, openings ${heights.join(', ')}: `;
      const check=checkPreset(preset,vals),got=built(vals);
      if(check.problems.length)problems.push(label+check.problems[0].text);
      if(heights.some((height,i)=>!near(got[i],height))||got.some(height=>height<least-.07))problems.push(label+'built as '+said(got));
      const shelves=check.parts.filter(piece=>piece.name==='Shelf').length;
      if(shelves!==n*plan.bays.length)problems.push(label+`${shelves} shelves were built, not ${n} in each of the ${plan.bays.length} bays`);
    }
  }

  // Every width, not only the two limits: the case adds a divider where a board would sag, and the structural
  // check must have nothing to say just below and just above each width where it does (at 68 1/4" wide it once
  // left the top 3/8" over its own rule). Each shelf board, with no shelf inside and with as many as fit.
  for(const board of['1x8','1x10','1x12'])for(const n of[0,BOOKSHELF_LIMITS.n[1]]){
    for(let W=BOOKSHELF_LIMITS.W[0];W<=BOOKSHELF_LIMITS.W[1];W+=.75){
      const check=checkPreset(preset,{...base,W,H:BOOKSHELF_LIMITS.H[1],board,n});
      if(check.problems.length){
        problems.push(`bookshelf ${fmt(W)} wide with ${board} boards and ${n} shelves: ${check.problems[0].text}`);
        break;
      }
    }
  }
});

/* Self-check of "At a spacing I choose": for every height from the shortest case to the tallest and every spacing
   from the smallest to the largest (each inch of both, and some odd sixteenths), with one bay and with dividers, the
   leftover at the top and at the bottom: every opening but the leftover one is the spacing to 1/16", the leftover
   is where it was asked and never lower than the lowest opening that can be built, the boards do not overlap,
   no shelf more would have fitted, and the remark and the steps say what was built. At the corners the preset
   rule's structural check has nothing to say. And "Evenly spaced" and "Set the height of each opening" still
   build what they built before this choice was added (the shelf heights below were read from the program then). */
SELFTESTS.push(function bookshelfSpacingFits(problems){
  const preset=PRESETS.find(candidate=>candidate.name==='Bookshelf');
  if(!preset)return;
  const wrong=text=>{if(problems.length<60)problems.push('bookshelf spacing: '+text);};
  const base={...presetDefaults(preset),board:'1x10',back:true};
  const on16=(a,b)=>Math.abs(a-b)<1/32;
  // the form: the choice, the spacing box with the reference sheet's limits, shown only with that choice
  const field=key=>preset.params.find(q=>q.k===key);
  const spacing=field('spacing'),gap=field('gap'),extra=field('extra'),count=field('n');
  if(!spacing||!spacing.opts.some(([value])=>value==='gap')||spacing.v!=='even')wrong('the form must offer "At a spacing I choose", with evenly spaced to start with');
  if(!gap||gap.min!==BOOKSHELF_SPACING_LIMITS[0]||gap.max!==BOOKSHELF_SPACING_LIMITS[1]||!gap.show||gap.show({spacing:'even'})||!gap.show({spacing:'gap'}))wrong('the spacing box needs its limits and must show only with "At a spacing I choose"');
  // a beginner must be told what the spacing measures: the clear space, not shelf top to shelf top
  if(gap&&!/clear/.test(gap.label))wrong(`the spacing box does not say that it is the clear opening: "${gap.label}"`);
  if(!/top of one board to the underside of the next/.test(bookshelfInfo({...base,spacing:'gap',gap:11})))wrong('the remark does not say what the spacing measures');
  if(!extra||!extra.show||extra.show({spacing:'set'})||!extra.show({spacing:'gap'}))wrong('the choice of where the leftover goes must show only with "At a spacing I choose"');
  if(!count||!count.show||count.show({spacing:'gap'})||!count.show({spacing:'even'}))wrong('the number of shelves must be hidden while the height decides it');
  // the clear openings as built, bottom to top, measured between the boards of the first bay
  const builtOpenings=vals=>{
    const parts=buildBookshelf(vals),left=Math.min(...parts.filter(piece=>piece.name==='Bottom').map(piece=>piece.pos[0]));
    const boards=parts.filter(piece=>['Bottom','Shelf','Top'].includes(piece.name)&&(piece.name==='Top'||Math.abs(piece.pos[0]-left)<.01)).map(box).sort((a,b)=>a.lo[1]-b.lo[1]);
    return boards.slice(1).map((board,i)=>board.lo[1]-boards[i].hi[1]);
  };
  const heights=[];
  for(let H=BOOKSHELF_LIMITS.H[0];H<=BOOKSHELF_LIMITS.H[1];H+=1)heights.push(H);
  heights.push(47+13/16,60+1/16,83+15/16);
  const spacings=[];
  for(let g=BOOKSHELF_SPACING_LIMITS[0];g<=BOOKSHELF_SPACING_LIMITS[1];g+=1)spacings.push(g);
  spacings.push(9+3/16,12+15/16);
  for(const W of[32,BOOKSHELF_LIMITS.W[1]])for(const H of heights)for(const g of spacings)for(const at of['top','bottom']){
    const vals={...base,W,H,spacing:'gap',gap:g,extra:at},plan=bookshelfPlan(vals),label=`${W}" wide, ${fmt(H)} tall, ${fmt(g)} apart, leftover at the ${at}: `;
    const got=builtOpenings(vals),n=plan.shelves,leftAt=at==='top'?got.length-1:0;
    if(got.length!==n+1){wrong(label+`${got.length} openings for ${n} shelves`);continue;}
    if(got.some((height,i)=>i!==leftAt&&!on16(height,g)))wrong(label+'openings built as '+got.map(fmt).join(', '));
    if(got.some(height=>height<=0))wrong(label+'boards overlap');
    const lowest=Math.max(plan.least,BOOKSHELF_SPACING_LIMITS[0]);   // never a slot lower than the smallest spacing
    if(plan.fit.lowest!==lowest)wrong(label+`the leftover opening may be as low as ${fmt(plan.fit.lowest)}, not ${fmt(lowest)}`);
    if(got[leftAt]<lowest-1/32)wrong(label+`the leftover opening is ${fmt(got[leftAt])}, lower than ${fmt(lowest)}`);
    if(n<BOOKSHELF_LIMITS.n[1]&&got[leftAt]>=g+plan.T+lowest-1/32)wrong(label+`one more shelf would have fitted (leftover ${fmt(got[leftAt])})`);
    // the heights offered for openings all the same really give them
    for(const height of plan.fit.evenAt){
      const at={...vals,H:height},even=builtOpenings(at);
      if(height<BOOKSHELF_LIMITS.H[0]||height>BOOKSHELF_LIMITS.H[1]||even.some(opening=>!on16(opening,g)))wrong(label+`the case height offered for openings all the same, ${fmt(height)}, builds ${even.map(fmt).join(', ')}`);
    }
    if(bookshelfCheck(vals).length)wrong(label+'refused: '+bookshelfCheck(vals)[0].text);
    const said=bookshelfInfo(vals);
    if(!said.includes(n?`${shelvesWord(n)} ${n===1?'fits':'fit'}`:'No shelf fits')||!said.includes(typedLen(r16(got[leftAt]))))wrong(label+'the remark does not say how many shelves and the leftover: '+said);
    if(n){
      const steps=bookshelfSteps(vals).map(step=>step.t).join(' ');
      if(!steps.includes(got.map(fmt).join(', ')))wrong(label+'the steps do not give the openings '+got.map(fmt).join(', '));
    }
  }
  // the preset rule at the corners: narrowest and widest, shortest and tallest, smallest and largest spacing
  for(const W of BOOKSHELF_LIMITS.W)for(const H of BOOKSHELF_LIMITS.H)for(const g of BOOKSHELF_SPACING_LIMITS)for(const at of['top','bottom'])for(const back of[true,false]){
    const check=checkPreset(preset,{...base,W,H,back,spacing:'gap',gap:g,extra:at});
    if(check.problems.length)wrong(`${W}" wide, ${H}" tall, ${g}" apart${back?'':', no back'}: ${check.problems[0].text}`);
  }
  // evenly spaced and set by hand: the shelf heights the program built before this choice existed
  const before=[[{W:32,H:48,n:3},[14.4375,25.375,36.3125]],[{W:12,H:24,n:1},[13.375]],
    [{W:72,H:84,n:8},[12.375,21.25,30.0625,38.9375,47.8125,56.6875,65.5,74.375]],[{W:40,H:61.5,n:5},[13.0625,22.5625,32.125,41.6875,51.1875]],
    [{W:32,H:48,n:3,spacing:'set',o1:14,o2:8},[18.25,27,37.125]],[{W:72,H:84,n:4,spacing:'set',o1:9,o2:0,o3:13.5},[13.25,31.8125,46.0625,64.625]],
    [{W:12,H:30,n:2,spacing:'set',o1:4},[8.25,18.75]],[{W:40,H:84,n:8,spacing:'set',o1:6,o2:6,o3:6,o4:6,o5:6,o6:6,o7:6},[10.25,17,23.75,30.5,37.25,44,50.75,67]]];
  for(const[vals,shelfY]of before){
    const now=bookshelfPlan({...base,spacing:'even',...vals}).shelfY;
    if(now.length!==shelfY.length||now.some((y,i)=>Math.abs(y-shelfY[i])>1e-9))wrong(`${JSON.stringify(vals)} now puts the shelves at ${now.join(', ')}, before at ${shelfY.join(', ')}`);
  }
});

/* The woodworker's-eye review, E3 (child safety): the toy chest had no air holes, only a note that said "leave a
   finger gap or drill air holes" as if it were a choice. Now the holes are real holes in the model. Tried at the
   default size, at each limit of the form, at the smallest and the largest of all at once, and in 1/2" plywood:
   the front and both ends have air holes and the back, the bottom and the lid none; each hole is high (its center
   no more than 2" below the top of the wall, with wood above it); every hole fits its piece; no screw, pocket hole
   or lid stay comes within 3/8" of a hole; the holes' drawing lines measure each one from one named end and one
   named edge; a step of its own drills them, before the walls go together, and gives every place of the front's
   holes; the notes count them as the model does and no longer offer them as a choice. A box with no lid has none. */
SELFTESTS.push(function toyChestHasAirHoles(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('toy chest air holes: '+text);};
  const preset=PRESETS.find(row=>row.name==='Storage box / toy chest');
  if(!preset){wrong('the preset is missing');return;}
  const kept=JSON.stringify(S),L=STORAGE_BOX_LIMITS,ROOM=SHAPE_RULE.safer;
  const sizes=[{},{W:L.W[0]},{W:L.W[1]},{D:L.D[0]},{D:L.D[1]},{H:L.H[0]},{H:L.H[1]},{ply:'ply12'},
    {W:L.W[0],D:L.D[0],H:L.H[0]},{W:L.W[1],D:L.D[1],H:L.H[1]},{W:L.W[0],D:L.D[1],H:L.H[0],ply:'ply12'}];
  // a hole's center in the world (the walls stand square, unturned)
  const holeCenter=(wall,f)=>{const c=featureCenter(wall,f),at=wall.pos.slice();at[wall.ax[0]]+=c.u;at[wall.ax[1]]+=c.v;return at;};
  try{
    for(const size of sizes){
      const vals={...presetDefaults(preset),...size},label=JSON.stringify(size);
      load(JSON.stringify(blank()),true);
      placeInStyle(preset,vals,'std');
      const walls=S.parts.filter(piece=>shapeFeatures(piece).length);
      for(const name of['Front','Side'])for(const wall of S.parts.filter(piece=>piece.name===name))
        if(!shapeFeatures(wall).some(f=>f.kind==='hole'))wrong(`${label}: a ${name} has no air hole`);
      if(walls.some(wall=>!['Front','Side'].includes(wall.name)))wrong(`${label}: the ${walls.find(wall=>!['Front','Side'].includes(wall.name)).name} has holes (air holes only count high on the front and the ends)`);
      const holes=walls.flatMap(wall=>shapeFeatures(wall).map(f=>({wall,f,at:holeCenter(wall,f)})));
      for(const{wall,f,at}of holes){
        const top=plainBox(wall).hi[1];
        if(top-at[1]>2+1e-6||top-(at[1]+f.d/2)<ROOM-1e-6)wrong(`${label}: a hole in the ${wall.name} is not high, just under the lid (center ${fmt(top-at[1])} below the top)`);
        if(f.d<AIR_HOLES.d-1e-6)wrong(`${label}: an air hole is only ${fmt(f.d)} across`);
      }
      for(const wall of walls){
        const off=misfits(wall);
        if(off.bad.length||off.overlaps.length)wrong(`${label}: a hole of the ${wall.name} does not fit it`);
        // every hole located from one named end and one named edge on its drawing
        for(const line of shapeHowLines(wall).filter(line=>/^Hole/.test(line)))
          if(!/from the \w+ (end|edge) and [^"]+" from the \w+ (end|edge)/.test(line))wrong(`${label}: a hole of the ${wall.name} is not measured from one end and one edge: ${line}`);
      }
      if(shapeFindings().length)wrong(`${label}: the shape rules find ${shapeFindings()[0].text||shapeFindings()[0].code}`);
      // nothing driven or mounted within 3/8" of a hole: every point along each fastener, and the lid stay
      const nearAHole=(point,margin)=>holes.find(({wall,f,at})=>{
        const b=plainBox(wall),t=wall.ax[2];
        if(point[t]<b.lo[t]-.01||point[t]>b.hi[t]+.01)return false;
        const along=[wall.ax[0],wall.ax[1]].map(k=>point[k]-at[k]);
        return Math.hypot(...along)<f.d/2+margin-.01;
      });
      const fasteners=[...new Set(fastenerHeads().map(head=>head.f))];
      for(const f of fasteners){
        const points=[0,.25,.5,.75,1].map(share=>f.pos.map((v,k)=>v+f.dir[k]*f.len*share)).concat(f.pocket?[f.pocket.mouth]:[]);
        const hit=points.map(point=>nearAHole(point,ROOM)).find(Boolean);
        if(hit)wrong(`${label}: a ${f.kind} from the ${f.through.name} into the ${f.into.name} runs within 3/8" of an air hole in the ${hit.wall.name}`);
      }
      for(const item of hardwareList().filter(item=>item.kind==='stay')){
        const host=byId(item.on),middle=pieceMiddle(host),center=[middle.x+item.at[0],middle.y+item.at[1],middle.z+item.at[2]];
        const half=(item.size||8)/2,u=item.u||[0,0,1],ends=[-half,0,half].map(s=>center.map((v,k)=>v+u[k]*s));
        // the stay and its screws stand about 0.3" above and below its line
        const close=ends.some(point=>[-.3,0,.3].some(dy=>nearAHole([point[0],point[1]+dy,point[2]],ROOM)));
        if(close)wrong(`${label}: the lid stay is screwed within 3/8" of an air hole`);
      }
      // the words: a step of its own before the walls go together, with every place of the front's holes; the notes
      const plan=buildPlan(true),stepAt=plan.steps.findIndex(step=>/air holes/.test(step.words));
      const frontStep=plan.steps.findIndex(step=>step.pieces.some(piece=>piece.name==='Front'));
      if(stepAt<0||!(stepAt<frontStep))wrong(`${label}: no step drills the air holes before the walls go together`);
      else{
        const front=S.parts.find(piece=>piece.name==='Front'),datum=shapeDatum(front);
        const missing=shapeFeatures(front).map(f=>fmt(featureFromDatum(front,f,datum).along[0].value)).filter(text=>!plan.steps[stepAt].words.includes(text));
        if(missing.length)wrong(`${label}: the air holes step does not give the front's holes at ${missing.join(', ')}`);
        // drilled in that step only: the cutting step does not also send a person to cut them, and the step names
        // the bit they need (not a saw because its words mention "Shapes to cut")
        const cutStep=plan.steps.find(step=>step.kind==='cut');
        if(cutStep&&/Then cut the shape/.test(cutStep.words))wrong(`${label}: the cutting step also tells a person to cut the air holes: ${cutStep.words.slice(cutStep.words.indexOf('Then cut'))}`);
        const tools=stepTools(plan.steps[stepAt]);
        if(!tools.some(tool=>/spade bit|forstner/i.test(tool)))wrong(`${label}: the air holes step does not list the bit for them (it lists ${tools.join('; ')})`);
        if(tools.includes('saw'))wrong(`${label}: the air holes step lists a saw`);
      }
      const notes=(S.notes||[]).join(' ');
      if(/finger gap or drill air holes|or drill air holes/.test(notes))wrong(`${label}: the notes still offer the air holes as a choice`);
      if(!notes.includes(`${holes.length} air holes`))wrong(`${label}: the notes do not say the chest has ${holes.length} air holes`);
    }
    // an open box (no lid) cannot shut a child in: no holes, and no step for them
    load(JSON.stringify(blank()),true);
    placeInStyle(preset,{...presetDefaults(preset),lid:false},'std');
    if(S.parts.some(piece=>shapeFeatures(piece).length))wrong('a box with no lid has holes');
    if((S.steps||[]).some(step=>/air holes/.test(stepText(step))))wrong('a box with no lid has a step for air holes');
  }finally{load(kept,true);}
});});

/* The preset audit of 20 Nov, finding 3: the toy chest's bar pull was screwed to the top of the lid, which the notes
   say can be sat on (someone sits on the pull, a child trips on it). A chest lid is lifted by a lip past the front
   (reference sheet 20). At the usual size, at each limit, at the smallest and largest of all and in 1/2" plywood, as
   Create places it: nothing is mounted on the lid but its hinges (no pull, no knob), no fastener head is on its top
   face in any style, the lid reaches STORAGE_BOX_LID_LIP past the front wall and is flush with the back and the
   ends, the overall depth is still the depth typed, and the step and the notes say how it is lifted. */
SELFTESTS.push(function toyChestLidTopIsClear(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('toy chest lid: '+text);};
  const preset=PRESETS.find(row=>row.name==='Storage box / toy chest');
  if(!preset){wrong('the preset is missing');return;}
  const kept=JSON.stringify(S),L=STORAGE_BOX_LIMITS;
  const sizes=[{},{W:L.W[0]},{W:L.W[1]},{D:L.D[0]},{D:L.D[1]},{ply:'ply12'},
    {W:L.W[0],D:L.D[0],H:L.H[0]},{W:L.W[1],D:L.D[1],H:L.H[1]}];
  try{
    for(const size of sizes){
      const vals={...presetDefaults(preset),...size},label=JSON.stringify(size);
      for(const style of Object.keys(STYLES)){
        load(JSON.stringify(blank()),true);
        placeInStyle(preset,vals,style);
        const lid=S.parts.find(piece=>piece.name==='Lid'),front=S.parts.find(piece=>piece.name==='Front');
        if(!lid||!front){wrong(`${label}: no lid or no front`);return;}
        const on=hardwareList().filter(item=>item.on===lid.id&&!['butt','piano','strap','cup'].includes(item.kind));
        if(on.length)wrong(`${label} (${STYLES[style][0]}): a ${on[0].kind} is mounted on the lid`);
        const onTop=fastenerHeads().filter(head=>head.f.through===lid&&faceOfHead(head.out)==='top');
        if(onTop.length)wrong(`${label} (${STYLES[style][0]}): ${onTop.length} fastener heads on the top of the lid`);
        const lidBox=plainBox(lid),frontBox=plainBox(front),wood=S.parts.filter(piece=>!isProp(piece)).map(plainBox);
        if(Math.abs(lidBox.hi[2]-frontBox.hi[2]-STORAGE_BOX_LID_LIP)>.01)wrong(`${label}: the lid reaches ${fmt(lidBox.hi[2]-frontBox.hi[2])} past the front, not ${fmt(STORAGE_BOX_LID_LIP)}`);
        if(Math.abs(lidBox.lo[2]-Math.min(...wood.map(b=>b.lo[2])))>.01)wrong(`${label}: the lid is not flush with the back`);
        const deep=Math.max(...wood.map(b=>b.hi[2]))-Math.min(...wood.map(b=>b.lo[2]));
        if(Math.abs(deep-sizeWithin(vals.D,L.D))>.01)wrong(`${label}: the chest is ${fmt(deep)} deep, not the ${fmt(vals.D)} typed`);
        if(style!=='std')continue;
        const words=(S.steps||[]).map(stepText).join(' '),notes=(S.notes||[]).join(' ');
        if(!/that lip is what you lift it by/.test(words))wrong(`${label}: the lid step does not say the lid is lifted by its lip`);
        if(!/you lift it by that lip/.test(notes))wrong(`${label}: the notes do not say how the lid is lifted`);
      }
    }
    // Hung again by hand, the lid still gets no pull (the code review of the audit fixes, 3): its hinges taken off,
    // then Connect to the back (which hangs a door or a lid, connectWhatOpens in js/connections.js); and the Hang
    // dialog's plan with nothing asked. A pull asked for by hand is still given.
    load(JSON.stringify(blank()),true);
    placeInStyle(preset,presetDefaults(preset),'std');
    const lid=S.parts.find(piece=>piece.name==='Lid'),back=S.parts.find(piece=>piece.name==='Back');
    removeHardware(hardwareList().filter(item=>item.on===lid.id||(item.geo&&item.geo.for===lid.id)).map(item=>item.id));
    const said=connectWhatOpens(lid,back);
    if(!hardwareList().some(item=>item.on===lid.id&&['butt','piano','strap','cup'].includes(item.kind)))wrong(`unfastened and connected again, the lid is not hung on hinges (${said})`);
    if(hardwareList().some(item=>item.on===lid.id&&(item.kind==='pull'||item.kind==='knob')))wrong('unfastened and connected again, the lid gets a pull on its top');
    if(hangPlan(lid,{}).items.some(item=>item.kind==='pull'||item.kind==='knob'))wrong('hung again with nothing asked, the lid gets a pull on its top');
    if(!hangPlan(lid,{pull:true}).items.some(item=>item.kind==='pull'||item.kind==='knob'))wrong('a pull asked for by hand on the lid is not given');
  }finally{load(kept,true);}
});});
