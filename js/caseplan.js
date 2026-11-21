/* NominalCAD: the cabinet builder's plan (design/specs/01-cabinet-case-builder.md, section 2).

   casePlan(p) turns the numbers and choices of the form into every size, count and position of a case, once.
   The pieces (js/casebuild.js), the check, the remark, the notes and the hardware (js/casecheck.js) and the steps
   (js/casesteps.js) all read it, so they cannot disagree about what is built. It is pure (it reads no style and
   no project) and remembers the last answer, because the live picture asks for it on every key typed.

   STAGE 1 (open cases): sides, bottoms, a toe kick or none, a top between the sides, on top of them or rails for a
   top you buy, a 1/4" back or an open back with rails, bays side by side (as many as the shelf span needs, or set
   by hand), fixed shelves spaced evenly, at a spacing the person chooses or one by one, the load they hold and
   what the case is made for, and when it is screwed to the wall. Doors, drawers, shelf pins and rods come in the
   later stages; until then their recipes are not offered (CASE_RECIPES[..].stage).

   Words: T = 3/4" (every panel), a bay = the space between two uprights (a side or a divider), a section = one
   part of a bay, bottom up. World axes: X left to right, Y up, Z back (0) to front; the floor is y = 0. The plan
   puts the sides from z = 0 to z = D and the back panel behind them; js/casebuild.js moves the finished pieces so
   the lowest corner of the case is at 0. */
'use strict';

const CASE_STAGE=1;   // the stage of the spec built so far (section 7)

/* the recipes ("What goes inside") of the stages built so far */
function caseRecipeKeys(){
  return Object.keys(CASE_RECIPES).filter(key=>CASE_RECIPES[key].stage<=CASE_STAGE);
}
/* Does a recipe put shelves in a bay? */
const caseRecipeHoldsShelves=key=>!!CASE_RECIPES[key]&&CASE_RECIPES[key].sections.some(section=>section.shelves==='n');

/* The case heights a catalog entry allows (its own limits, else the builder's). The words that offer "make the
   case 51 1/4" tall" only offer heights the form takes. The entry is the one that starts with this kind of case
   (the Bookshelf for kind bookshelf): a fixed table, so the plan stays pure. */
function caseHeightLimitsFor(kindKey){
  const entry=typeof CATALOG==='undefined'?null:CATALOG.find(row=>row.builder===CASE_BUILDER&&row.start&&row.start.kind===kindKey);
  const own=entry&&entry.limits&&entry.limits.H;
  return Array.isArray(own)?own:CASE.limits.H;
}

/* The form's values, read and put inside the builder's own limits (the form's entry may be narrower, but a
   design is never built outside what the plan was checked for). Old values are read as well: a Bookshelf made
   before the cabinet builder had a tick for its back (true / false). */
function caseInputs(p){
  const kindKey=CASE_KINDS[p.kind]?p.kind:'basecab',kind=CASE_KINDS[kindKey],L=CASE.limits;
  const boards=p.mat==='boards';
  const board=M[p.board]&&M[p.board].kind==='board'?p.board:'1x10';
  const number=(value,fallback)=>value!==''&&value!==null&&value!==undefined&&Number.isFinite(+value)?+value:fallback;
  const recipes=caseRecipeKeys();
  const choice=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
  return{
    kindKey,kind,boards,board,
    mat:boards?board:'ply34',                      // the material of the sides, dividers, bottoms, shelves and inside top
    W:sizeWithin(number(p.W,30),L.W),
    H:sizeWithin(number(p.H,35.25),L.H),
    D:boards?M[board].w:sizeWithin(number(p.D,24),L.D),
    bays:p.bays===undefined||p.bays==='auto'?'auto':countWithin(number(p.bays,1),L.bays),
    fill:choice(p.fill,recipes,'shelves'),
    fillMid:choice(p.fillMid,['same',...recipes],'same'),
    n:countWithin(number(p.n,1),L.n),
    spacing:choice(p.spacing,['even','gap','set'],'even'),
    use:choice(p.use,['books','shelf','general'],kind.uses.shelf),
    base:p.base==='none'?'none':'kick',
    kickH:boards?3.5:sizeWithin(number(p.kickH,kind.kickH),L.kickH),   // a 1x case takes a 1x4: 3 1/2"
    kickBack:sizeWithin(number(p.kickBack,kind.kickBack),L.kickBack),
    top:choice(p.top,['inside','over','rails'],'over'),
    overSide:sizeWithin(number(p.overSide,0),L.overSide),
    overFront:sizeWithin(number(p.overFront,0),L.overFront),
    back:p.back===true||p.back==='panel'?'panel':p.back===false||p.back==='rails'?'rails':'panel',
    wall:p.wall==='yes'?'yes':'auto',
  };
}

/* How far a 3/4" board or panel lying flat may span under the load of a use (a key of USES, js/verify.js), with
   its own weight counted: the measure the structural check itself uses (the Bookshelf's `reach` before the
   cabinet builder). Books and storage never more than 32" whatever the bending numbers allow [01 §2f, §5 item 1]. */
function caseSpanLimit(use,boards){
  const T=CASE.T;
  const reach=maxSpanFor(sectionOf(1,T,!boards),USES[use].psf/144+WOOD_RULES.DENSITY*T,use);
  return CASE.maxSpanUses.includes(use)?Math.min(reach,CASE.maxShelfSpan):reach;
}
/* count bays of the same width between start and end, with uprights of thickness t between them; the same 1/16"
   grid as splitIntoBays (js/builders-storage.js), which finds the count itself */
function caseEqualBays(start,end,t,count){
  const width=(end-start-(count-1)*t)/count,bays=[];
  for(let k=0;k<count;k++){
    const from=k===0?start:r16(start+k*(width+t));
    const to=k===count-1?end:r16(start+(k+1)*(width+t))-t;
    bays.push({x:from,len:to-from});
  }
  return bays;
}

/* ---- the shelf openings (section 2.8) ----
   An opening is the clear space between two boards. A section with n shelves has n + 1 openings.
     even  every opening the same, to the 1/16"; the top one takes the rounding
     gap   "At a spacing I choose": as many shelves as fit with every opening the spacing typed; what is left goes
           into one opening, the top or the bottom one, never lower than 7" (the owner, 16 Nov: "no 4 in.
           shelves") nor than the lowest opening that can be built
     set   one box for each opening but the top one, bottom first (o1, o2 ...); a box at 0 shares what is left */
const CASE_LEAST_WHY='each shelf is screwed from underneath, and a drill needs about 6" of room to do that';
/* The openings set by hand (asked: from bookshelfAskedOpenings, js/builders-storage.js), as bookshelfOpenings
   works them out, with the reason of the cabinet builder: one least opening in every style. Returns {openings,
   custom, problems}; heights that cannot work are refused with the reason and the fix, and the openings fall back
   to even spacing so that the picture still shows a sensible case. */
function caseSetOpenings(asked,shelves,room,least,caseHeight){
  const count=shelves+1,even=Array(count).fill(room/count);
  const set=asked.filter(size=>size>0);
  const stop=(text,fix)=>({openings:even,custom:false,problems:[{level:'stop',text,fix}]});
  // too many shelves for the height: no heights can mend it, and caseCheck says so first
  if(!set.length||room/count<least-1e-6)return{openings:even,custom:false,problems:[]};
  const tooLow=asked.findIndex(size=>size>0&&size<least-1e-6);
  if(tooLow>=0){
    return stop(`Opening ${tooLow+1}${tooLow?'':' (the bottom one)'} is set to ${typedLen(asked[tooLow])}. An opening lower than ${typedLen(least)} cannot be built: ${CASE_LEAST_WHY}.`,
      `Make it ${typedLen(least)} or more, or type 0 to let it share what is left.`);
  }
  const used=set.reduce((sum,size)=>sum+size,0),free=count-set.length,each=(room-used)/free;
  if(each<least-1e-6){
    const others=free===1?'the top opening':`the ${free} openings that share what is left`;
    const most=floor16(room-free*least);
    return stop(`The ${set.length===1?'opening height you set is':'opening heights you set add up to'} ${typedLen(used)}. A case ${typedLen(caseHeight)} tall with ${shelvesWord(shelves)} has ${typedLen(floor16(room))} of clear height to share between its ${count} openings, so that leaves ${each>0?'only '+typedLen(floor16(each))+(free>1?' each':''):'nothing'} for ${others}, and an opening lower than ${typedLen(least)} cannot be built.`,
      `Lower the heights you set (together no more than ${typedLen(most)}), make the case taller, or use fewer shelves.`);
  }
  // the openings that share come out the same to the 1/16"; the top one takes the few sixteenths left over
  const share=floor16(each),top=room-used-(free-1)*share;
  return{openings:asked.map(size=>size>0?size:share).concat([top]),custom:true,problems:[]};
}
/* "At a spacing I choose" in a section `clear` tall of a case `caseHeight` tall: {gap, shelves, leftover, at,
   openings (bottom to top), more (how many the height has room for before the form's most), lowest (the least
   the leftover may be), alike (the leftover came out the same as the others), evenAll (the case heights, for
   0 to the most shelves, at which every opening comes out the same)}. The rule of bookshelfFitAtSpacing
   (js/builders-storage.js), for any section of any case. */
function caseFitAtSpacing(p,clear,caseHeight){
  const T=CASE.T,most=CASE.limits.n[1];
  const gap=sizeWithin(p.gap,CASE.spacing.limits),at=p.extra==='bottom'?'bottom':'top';
  const lowest=Math.max(CASE.leastOpening,CASE.spacing.leastLeftover);
  const room=Math.floor((clear-lowest)/(gap+T)+1e-6);          // shelves the height has room for
  const shelves=Math.max(0,Math.min(most,room));
  const leftover=r16(clear-shelves*(gap+T));
  const even=Array(shelves).fill(gap);
  const evenAll=[];
  for(let count=0;count<=most;count++)evenAll.push(r16(caseHeight-clear+(count+1)*gap+count*T));
  return{gap,shelves,leftover,at,lowest,more:Math.max(shelves,room),alike:Math.abs(leftover-gap)<1/32,evenAll,
    openings:at==='bottom'?[leftover].concat(even):even.concat([leftover])};
}

/* The sections of one bay, bottom up, each {kind, floor (the top face of what is under it), clear, shelves ('n'
   or 0)}, and the fixed panels between them. Stage 1 recipes have one section; the rule for more is in 2.5 of
   the spec: a fixed 3/4" Shelf between two sections (none under a false front), the rest shared evenly. */
function caseSections(recipeKey,floorIn,inside){
  const T=CASE.T,list=CASE_RECIPES[recipeKey].sections;
  const panels=list.slice(1).filter(section=>section.panelBelow!==false).length;
  const each=floor16((inside-panels*T)/list.length);
  const sections=[];
  let floor=floorIn;
  list.forEach((section,index)=>{
    const last=index===list.length-1;
    const clear=last?floorIn+inside-floor:each;
    sections.push({kind:section.kind,shelves:section.shelves||0,floor,clear});
    floor+=clear+(list[index+1]&&list[index+1].panelBelow!==false?T:0);
  });
  return{sections,panels};
}

/* ---- the plan ---- */
const CASE_BUILDER='Cabinet / case';   // the builder's name (never shown: an entry's name is)
let casePlanMemo={key:null,plan:null};
function casePlan(p){
  const key=JSON.stringify(p);
  if(casePlanMemo.key!==key)casePlanMemo={key,plan:makeCasePlan(p)};
  return casePlanMemo.plan;
}
function makeCasePlan(p){
  const v=caseInputs(p),kind=v.kind,T=CASE.T,problems=[],changed=[];
  // the frame of the case (2.2)
  const tb=v.back==='panel'?CASE.back:0;
  const topT=v.top==='over'?T:0;
  const Hc=v.H-topT;                                   // top of the sides
  const yF=v.base==='kick'?v.kickH:0;                  // underside of the bottom panel
  const floorIn=yF+T;                                  // top of the bottom panel: the floor of every bay
  const railW=kind.railW;                              // the top, back and base rails
  const ceilIn=v.top==='rails'?Hc-railW:Hc-T;          // underside of the top, of the flat rails, or of the on-edge rails
  const inside=ceilIn-floorIn;                         // clear height of every bay

  // what each piece carries: the form's "Shelves hold" for the shelves and the open bottom, the kind for the top
  const usesShelves=caseRecipeHoldsShelves(v.fill)||caseRecipeHoldsShelves(v.fillMid);
  const shelfUse=v.use,bottomUse=v.use,topUse=kind.uses.top;
  // bays and dividers (2.3): the widest a bay may be is set by every piece that spans it side to side
  // (a top that lies on the case, and the flat rails under it, are 3/4" plywood in a 1x case too: js/casebuild.js;
  // the on-edge rails under a top you buy are deep and do not count)
  const spanning=[{use:bottomUse,boards:v.boards}].concat(usesShelves?[{use:shelfUse,boards:v.boards}]:[],
    v.top==='inside'?[{use:topUse,boards:v.boards}]:v.top==='over'?[{use:topUse,boards:false}]:[]);
  const spanLimits=spanning.map(row=>({use:row.use,limit:caseSpanLimit(row.use,row.boards)}));
  const bayLimit=Math.min(...spanLimits.map(row=>row.limit));
  const limitUse=spanLimits.find(row=>row.limit===bayLimit).use;
  let bays;
  if(v.bays==='auto'){
    // a span is measured to the middle of the upright it runs over, so with dividers a bay is one T narrower
    bays=splitIntoBays(T,v.W-T,T,v.W-2*T<=bayLimit?bayLimit:bayLimit-T);
  }else{
    bays=caseEqualBays(T,v.W-T,T,v.bays);
    const widest=Math.max(...bays.map(bay=>bay.len)),limit=bays.length>1?bayLimit-T:bayLimit;
    if(widest>limit+1e-6){
      let enough=bays.length;
      while(enough<CASE.limits.bays[1]&&Math.max(...caseEqualBays(T,v.W-T,T,enough).map(bay=>bay.len))>bayLimit-T+1e-6)enough++;
      problems.push({level:'stop',code:'C3',text:`Each of the ${bays.length} bays would be ${typedLen(floor16(widest))} wide. A 3/4" ${limitUse==='books'?'shelf holding books':'shelf'} sags when it spans more than about ${fmt(Math.floor(bayLimit))}, so ${bays.length>1?'these':'it'} would sag.`,
        fix:`Use ${enough} bays or more, or choose "Let the program choose".`});
    }
    const narrowest=Math.min(...bays.map(bay=>bay.len));
    if(narrowest<CASE.leastOpening-1e-6)problems.push({level:'stop',code:'C3',text:`Each of the ${bays.length} bays would be only ${typedLen(floor16(narrowest))} wide: too narrow to reach into, or to fasten a shelf in.`,
      fix:`Use fewer bays, or make the case wider.`});
  }
  const dividers=bays.length-1;
  // a bay too narrow for a pocket-hole driver: its boards are held by plugged screws through the sides in
  // Everyday and Fine furniture (CASE.reachClear, PRACTICE)
  const narrow=Math.min(...bays.map(bay=>bay.len))<CASE.reachClear-1e-6;

  // what goes inside each bay: the same recipe in every bay, or another one in the middle bay of an odd count
  const middle=bays.length>=3&&bays.length%2===1?(bays.length-1)/2:-1;
  const recipeOf=k=>k===middle&&v.fillMid!=='same'?v.fillMid:v.fill;
  // the shelves: the same count and heights in every bay that holds shelves
  const least=CASE.leastOpening;
  const shelfRecipe=bays.map((bay,k)=>recipeOf(k)).find(caseRecipeHoldsShelves)||null;
  const shelfSection=shelfRecipe?caseSections(shelfRecipe,floorIn,inside).sections.find(section=>section.shelves==='n'):null;
  let fit=null,shelves=0,openings=[],customOpenings=false,openingProblems=[],room=0;
  if(shelfSection){
    if(v.spacing==='gap'){
      fit=caseFitAtSpacing(p,shelfSection.clear,v.H);
      shelves=fit.shelves;
      openings=fit.openings;
      customOpenings=true;
      // the heights offered for openings all the same: the nearest below and above, that the form takes
      const[lowH,highH]=caseHeightLimitsFor(v.kindKey);
      const within=fit.evenAll.filter(height=>height>=lowH-1e-6&&height<=highH+1e-6);
      fit.evenAt=[within.filter(height=>height<v.H-1e-6).pop(),within.find(height=>height>v.H+1e-6)].filter(height=>height!==undefined);
    }else{
      shelves=v.n;
      room=shelfSection.clear-shelves*T;
      const spaced=caseSetOpenings(bookshelfAskedOpenings({...p,spacing:v.spacing},shelves),shelves,room,least,v.H);
      openings=spaced.openings;
      customOpenings=spaced.custom;
      openingProblems=spaced.problems;
    }
    room=shelfSection.clear-shelves*T;
  }
  const shelfY=[];
  if(shelfSection){
    let under=shelfSection.floor;   // the underside of the next shelf: the opening below it, on top of what is below
    for(let i=0;i<shelves;i++){
      under+=openings[i];
      shelfY.push(r16(under));
      under+=T;
    }
  }
  // C1: too many shelves for the height, even spaced as tightly as they can be
  if(shelfSection&&shelves&&room/(shelves+1)<least-1e-6){
    const most=Math.max(0,Math.floor((shelfSection.clear-least)/(least+T)+1e-6));
    problems.push({level:'stop',code:'C1',text:`${shelvesWord(shelves)} in a case ${typedLen(v.H)} tall would be only ${typedLen(floor16(room/(shelves+1)))} apart. Each shelf is screwed from underneath, and a drill needs about ${fmt(least)} of room to do that.`,
      fix:`Use ${most>0?most+' or fewer':'no'} shelves at this height, or make the case taller.`});
  }else problems.push(...openingProblems);
  // C1 for an open space with no shelf in it: lower than the least opening it cannot be reached into
  if(inside<least-1e-6)problems.push({level:'stop',code:'C1',text:`The space inside a case ${typedLen(v.H)} tall is only ${typedLen(floor16(inside))} high: too low to reach into, or to fasten the boards in.`,fix:'Make the case taller.'});

  const bayPlans=bays.map((bay,k)=>{
    const recipe=recipeOf(k),{sections}=caseSections(recipe,floorIn,inside);
    return{...bay,recipe,sections,shelfY:caseRecipeHoldsShelves(recipe)?shelfY:[]};
  });

  // the back (2.4): 1/4" plywood from sheets 4 ft wide; a case too big for one sheet gets strips that meet on the
  // middle of a divider
  const backPanels=[];
  if(v.back==='panel'){
    const fitsOneSheet=Math.min(v.W,Hc-yF)<=SHEET_WIDTH;
    const seams=bays.slice(0,-1).map(bay=>bay.x+bay.len+T/2).concat([v.W]);
    let from=0;
    seams.forEach((seam,k)=>{
      const last=k===seams.length-1;
      if(last||(!fitsOneSheet&&seams[k+1]-from>SHEET_WIDTH)){
        backPanels.push({x:from,len:seam-from});
        from=seam;
      }
    });
  }
  // fastened to the wall (4.5, stage 1: rules 1, 3 and 4)
  const why=[];
  if(v.H>TIP_RULES.narrow*v.D)why.push('tall');                 // rule 1: more than 4 times as tall as it is deep
  if(kind.rules.wall)why.push('kind');                           // rule 3: TV stands, pantries, wardrobes
  if(v.wall==='yes')why.push('asked');                           // rule 4: the person asked
  const anchored=why.length>0;
  // A rail across the back under the top only with an open back, where it keeps the case square (C4 below); with on-edge
  // top rails, the back one does it. A case with a plywood back that goes on the wall is held by anti-tip kits screwed
  // to the back of its top instead (the owner, 20 Nov, on that rail: "it doesnt look great"; js/caselooks.js).
  const backRail=v.back!=='panel'&&v.top!=='rails';
  const baseRail=v.base==='kick'&&(kind.baseRail||v.back!=='panel');
  // C4: an open back is kept square by its rails, which works up to a height (the racking rule of js/verify.js:
  // one rail at least a tenth as deep as the sides are tall, or rails at the top and the bottom each at least a
  // 24th as deep)
  if(v.back!=='panel'){
    const lowRail=baseRail?Math.min(railW,v.kickH):0;
    const deepEnough=railW>=Hc/10-1e-6||lowRail>=Math.max(2.5,Hc/24)-1e-6;
    if(!deepEnough){
      const most=floor16(Math.max(railW*10,lowRail*24)+topT);
      const holds=baseRail?'the rails at the top and the bottom keep':'with no toe kick, the rail at the top keeps';
      problems.push({level:'stop',code:'C4',text:`With an open back, ${holds} a case up to ${typedLen(most)} tall from leaning sideways. This one is ${typedLen(v.H)} tall: pushed from the side, it would fold like a parallelogram.`,
        fix:`Choose a 1/4" plywood back, or make the case ${typedLen(most)} tall or lower.`});
    }
  }
  // the top that lies on the case (C6: one sheet)
  const topOver=v.top==='over'?{x:-v.overSide,len:v.W+2*v.overSide,z:-tb,depth:tb+v.D+v.overFront}:null;
  // A top that lies on the case is screwed up through its two flat rails from inside. It used to be refused higher
  // than SEEN.underAbove (C15), where the undersides of those rails are seen from below. Since the case looks job the
  // rails' pocket holes are plugged and the screws up into the top sunk under wooden plugs wherever a person in front
  // sees those undersides (js/caselooks.js), so that reason is gone and a tall case may have a top laid on, as tall
  // real cases (a wardrobe, an armoire) do; a tall one gets its top while it lies on its back (caseSteps). The
  // real-thing review of that job, finding 5.
  if(topOver&&(topOver.len>96+1e-6||topOver.depth>48+1e-6)){
    problems.push({level:'stop',code:'C6',text:topOver.len>96+1e-6?`The top would be ${typedLen(topOver.len)} long, and a sheet of plywood is 96" (8 ft) long.`:`The top would be ${typedLen(topOver.depth)} deep, and a sheet of plywood is 48" (4 ft) wide.`,
      fix:'Make the case narrower or the overhang smaller.'});
  }
  return{...v,T,tb,topT,Hc,yF,floorIn,railW,ceilIn,inside,shelfUse,bottomUse,topUse,bayLimit,limitUse,
    bays:bayPlans,dividers,narrow,least,shelfSection,shelves,openings,customOpenings,fit,room,shelfY,
    backPanels,anchored,anchorWhy:why,backRail,baseRail,topOver,
    dividerTop:v.top==='rails'?Hc:Hc-T,
    studs:Math.max(1,Math.ceil(v.W/16)),
    problems,changed};
}
/* the number of bays the case will have, for the form's rows that depend on it ("The middle bay holds") */
function caseBayCount(p){
  return casePlan(p).bays.length;
}
/* the clear height of every opening of the first bay with shelves as built, bottom to top, between the boards */
function caseBuiltOpenings(plan){
  if(!plan.shelfSection)return[];
  const floor=plan.shelfSection.floor,ceil=floor+plan.shelfSection.clear;
  const unders=plan.shelfY.concat([ceil]);
  let top=floor;
  return unders.map(under=>{const opening=under-top;top=under+plan.T;return opening;});
}
