/* NominalCAD: shared builder for tables and benches, plus the tank size list */
'use strict';
/* ---------- tables, desks and benches ----------
   Every table, desk and bench preset is the same thing: four legs, an apron frame flush with the top of the
   legs, a top of planks or plywood, and sometimes a lower frame of stretchers that carries a shelf.

   TABLE_KINDS says what each preset is made of. tablePlan(o) works out every size from the numbers on the form:
   it adds cross rails under the top where the top would sag between the aprons, picks deeper aprons when the
   span or the height needs them, and lists what cannot work in plan.problems (the preset's check(p) hands those
   to the warning box). buildTable draws the plan; tableNotes and tableSteps (js/presets.js) describe it.
   All bending is worked out with beamCheck / maxSpanFor from js/verify.js, with the loads in its USES table,
   so the plan and the structural check agree. */
const TABLE_RULES={
  topMargin:.85,     // the top may span this share of what the bending helper allows between its cross rails
  memberMargin:.95,  // aprons, stretchers and rails are sized to this share of their limit
  plankRailGap:32,   // a plank top gets a cross rail at least this often: it keeps the boards flat and in line
  sheetRailGap:36,   // a plywood top gets one at least this often: something to screw it to, and it keeps the aprons straight
  thinSeatGap:16,    // seat boards under 1" thick get one at least this often (one grown person on one board)
  rackDepth:10,      // aprons at least 1/10 as deep as the legs are tall hold the frame square without stretchers
  kneeRoom:24,       // room wanted under the apron of a table you sit at
  personLb:250,      // one grown person sitting in the middle of a bench
  shelfRoom:2,       // the least room between a lower shelf and the aprons above it; less and the shelf is left out
  stretcherClear:1   // the lower frame stays at least this far off the floor
};
/* What each preset is made of.
     leg, top    material ids;  aprons: the sizes to try, shallowest first (the first is also used for cross rails)
     over        how far the top reaches past the legs on every side. Under a 2x6 plank top on 4x4 legs it is 2",
                 so the inside face of each leg lines up with a joint between boards: an outer board then lies on
                 the legs and a long apron, and never on a strip of short apron too thin to take a screw
     use         what the top is for: a key of USES in js/verify.js (it sets the design load)
     seatBoards  the top boards are called "Seat board" (benches)
     sitsAt      people sit at it with their knees under the apron (the notes mention knee room)
     shelf       material of the lower shelf (a board: slats across; a sheet: one panel)
     lowY        how far its frame is off the floor when the stretchers are the shallowest size (deeper ones reach lower)
     endStretch  the lower frame also has short stretchers at the ends
     spec        the short line under the name on the preset's tile in the Furniture presets dialog (about 25 letters) */
const TABLE_KINDS={
  'Dining table':           {leg:'4x4',aprons:['2x4','2x6'],top:'2x6',over:2,use:'tableTop',sitsAt:true,spec:'4x4 legs, 2x6 plank top'},
  'Coffee table':           {leg:'2x2',aprons:['1x4','1x6'],top:'1x6',over:1,use:'tableTop',shelf:'1x4',lowY:3,spec:'Slatted lower shelf'},
  'Side table / nightstand':{leg:'2x2',aprons:['1x4','1x6'],top:'1x6',over:1,use:'tableTop',spec:'2x2 legs, board top'},
  'Desk':                   {leg:'4x4',aprons:['2x4','2x6'],top:'ply34',over:1,use:'tableTop',sitsAt:true,spec:'4x4 legs, plywood top'},
  'Sturdy bench':           {leg:'4x4',aprons:['2x4','2x6'],top:'2x6',over:2,use:'seat',seatBoards:true,spec:'4x4s, 2x4s and 2x6s'},
  // the 2x10 is what lets a full 4 ft by 8 ft sheet be a workbench top on four legs
  'Workbench':              {leg:'4x4',aprons:['2x4','2x6','2x8','2x10'],top:'ply34',over:1,use:'benchTop',shelf:'ply34',lowY:6,endStretch:true,spec:'4x4 frame, plywood top'},
  'Entryway shoe bench':    {leg:'2x2',aprons:['1x4','1x6'],top:'1x6',over:1,use:'seat',seatBoards:true,shelf:'1x4',lowY:3,shoes:true,spec:'Seat over a shoe shelf'}
};
/* the form values of a table preset together with what it is made of: what tablePlan and buildTable take */
const tableArgs=(name,p)=>Object.assign({},p,TABLE_KINDS[name],{name});
/* what each piece of a table is for (the structural check reads this) */
function tableUses(name){
  const use=TABLE_KINDS[name].use;
  return{'Top':use,'Top board':use,'Seat board':use,'Long apron':use,'Short apron':use,'Cross rail':use,
    'Long stretcher':'shelf','Short stretcher':'none','Shelf slat':'shelf','Lower shelf':'shelf','Shelf rail':'shelf'};
}
/* Can a board of this material, standing on edge, span this far carrying a strip of surface this wide? */
function railFits(mat,span,stripWidth,useKey){
  const m=M[mat],section=sectionOf(m.t,m.w,false);
  const load=USES[useKey].psf/144*stripWidth+WOOD_RULES.DENSITY*section.A;
  return beamCheck(section,span,load,useKey).ratio<=TABLE_RULES.memberMargin;
}
/* the longest span such a board is allowed (same margin as railFits) */
function railReach(mat,stripWidth,useKey){
  const m=M[mat],section=sectionOf(m.t,m.w,false);
  const load=USES[useKey].psf/144*stripWidth+WOOD_RULES.DENSITY*section.A;
  return maxSpanFor(section,load,useKey)*Math.sqrt(TABLE_RULES.memberMargin);
}
/* The longest stretch a top or shelf of this material may bridge between supports, in inches. It is used to
   space the rails under a top, where one more rail costs little, so it keeps the wide topMargin. */
function surfaceReach(mat,useKey,stripWidth){
  const m=M[mat],sheet=m.kind==='sheet',breadth=sheet?1:m.w,section=sectionOf(breadth,m.t,sheet);
  const load=USES[useKey].psf/144*(stripWidth||breadth)+WOOD_RULES.DENSITY*section.A;
  return maxSpanFor(section,load,useKey)*TABLE_RULES.topMargin;
}
/* Can a board of this material, lying flat, span this far carrying a strip of surface this wide? This is for
   shelf slats, where no rail can be added under them: like railFits it uses the member margin, so a size the
   structural check finds sound is not turned away. */
function slatFits(mat,span,stripWidth,useKey){
  const m=M[mat],section=sectionOf(m.w,m.t,false);
  const load=USES[useKey].psf/144*stripWidth+WOOD_RULES.DENSITY*section.A;
  return beamCheck(section,span,load,useKey).ratio<=TABLE_RULES.memberMargin;
}
/* the longest span such a slat is allowed, to the sixteenth of an inch below (same margin as slatFits) */
function slatSpanLimit(mat,stripWidth,useKey){
  const m=M[mat],section=sectionOf(m.w,m.t,false);
  const load=USES[useKey].psf/144*stripWidth+WOOD_RULES.DENSITY*section.A;
  let span=Math.floor(maxSpanFor(section,load,useKey)*16)/16;
  while(span>1&&!slatFits(mat,span,stripWidth,useKey))span-=1/16;
  return span;
}
/* One grown person sitting in the middle of a bench: can its two long aprons of this material carry that
   between the legs? (The structural check works with weight spread evenly; this is the one heavy spot.) */
function personFits(mat,span){
  return span<=personReach(mat)+1e-6;
}
function personReach(mat){
  const m=M[mat],section=sectionOf(m.t,m.w,false);
  return 8*section.S*WOOD_RULES.FB_SHORT/TABLE_RULES.personLb;   // from  person * span / 4  =  two aprons * S * stress
}
/* The lower frame of a table and the shelf on it, or null when there is no room for one under the aprons.
   size: the table's main sizes from tablePlan; apronDepth: how deep the aprons above it came out.
   Adds to problems when the shelf cannot work. */
function tableShelfPlan(o,size,apronDepth,problems){
  const R=TABLE_RULES,shelfM=M[o.shelf],sheet=shelfM.kind==='sheet',{W,longSpan,over,leg,railT,sizes}=size;
  const stretcher=sizes.find(mat=>railFits(mat,longSpan,W/2,'shelf'))||sizes[sizes.length-1];
  // The top edge of the lower frame stays where the shallowest stretcher puts it (lowY off the floor plus its
  // depth). A deeper stretcher reaches down toward the floor, not up into the room above the shelf, but never
  // closer to the floor than stretcherClear.
  const depth=M[stretcher].w,y=Math.max(o.lowY+M[sizes[0]].w,R.stretcherClear+depth),low=y-depth;
  const room=size.legH-apronDepth-y-shelfM.t;
  if(room<R.shelfRoom)return null;
  const shelf={mat:o.shelf,sheet,stretcher,low,y,room,ends:!!o.endStretch,length:longSpan,rails:[],slats:0,slatGap:0};
  if(sheet){
    // plywood is cut with its face grain running the long way, so it must make the distance between shelf
    // rails that way: one rail at each end of the shelf and as many between as it takes
    const bays=Math.max(1,Math.ceil((longSpan-railT)/surfaceReach(o.shelf,'shelf')-1e-6));
    for(let i=0;i<=bays;i++)shelf.rails.push(over+leg+i*(longSpan-railT)/bays);
    return shelf;
  }
  // slats run from one long stretcher to the other
  shelf.slats=Math.max(1,Math.floor(longSpan/(shelfM.w+.25)));
  shelf.slatGap=(longSpan-shelf.slats*shelfM.w)/(shelf.slats+1);
  const across=W-2*over-M[stretcher].t;       // center to center of the two long stretchers
  const strip=shelfM.w+shelf.slatGap;         // the strip of shelf one slat carries
  if(!slatFits(o.shelf,across,strip,'shelf')){
    const reach=slatSpanLimit(o.shelf,strip,'shelf');
    const widest=Math.floor((reach+M[stretcher].t+2*over)/size.boardW)*size.boardW;
    problems.push({level:'stop',
      text:`The shelf slats would have to span ${fmt(across)} from one long stretcher to the other. A ${shelfM.short} lying flat sags under a loaded shelf beyond about ${fmt(Math.floor(reach))}.`,
      fix:`Make the ${size.what} ${fmt(widest)} or less from front to back.`});
  }
  return shelf;
}
const SHEET_SIZE=[96,48];   // a sheet of plywood, in inches
function tablePlan(o){
  const R=TABLE_RULES,legM=M[o.leg],topM=M[o.top],use=o.use||'tableTop',sizes=o.aprons||[o.apron];
  const leg=legM.w,over=o.over,topT=topM.t,planks=topM.kind==='board',railMat=sizes[0],railT=M[railMat].t;
  const what=(o.name||'table').toLowerCase(),problems=[];
  // overall size: at least big enough for four legs, and a plank top is a whole number of boards wide
  const L=Math.max(o.L,2*over+2*leg+4),H=Math.max(o.H,M[sizes[0]].w+topT+2);
  let W=Math.max(o.W,2*over+2*leg+2),boards=0;
  if(planks){
    boards=Math.max(Math.ceil((2*over+2*leg+1)/topM.w),Math.round(o.W/topM.w));
    W=boards*topM.w;
  }
  const legH=H-topT,longSpan=L-2*over-2*leg,shortSpan=W-2*over-2*leg,crossSpan=W-2*over-2*railT;

  // cross rails under the top, between the long aprons: close enough that the top does not sag between them
  let railGap=Math.min(surfaceReach(o.top,use),planks?R.plankRailGap:R.sheetRailGap);
  if(planks&&USES[use].people&&topT<1)railGap=Math.min(railGap,R.thinSeatGap);
  const between=L-2*over-railT;               // center to center of the two short aprons
  let railCount=Math.max(0,Math.ceil(between/railGap-1e-6)-1);
  while(railCount<60&&!railFits(railMat,crossSpan,between/(railCount+1),use))railCount++;
  const railStep=between/(railCount+1);

  // The aprons. They must carry half the top each between the legs (on a bench, also one grown person sitting
  // in the middle), and unless a full lower frame braces the legs they must be deep enough for the height to
  // keep the frame from leaning (racking).
  const endStrip=over+railT/2+railStep/2;       // what a short apron carries: out to the edge, and halfway to the next rail
  const people=!!USES[use].people,biggest=sizes[sizes.length-1];
  const strong=mat=>railFits(mat,longSpan,W/2,use)&&railFits(mat,shortSpan,endStrip,use)&&(!people||personFits(mat,longSpan));
  const apronFor=minDepth=>sizes.find(mat=>strong(mat)&&M[mat].w>=minDepth-1e-9)||biggest;
  // The lower frame and its shelf, if there is room for it under the aprons. A frame with stretchers on all four
  // sides braces the legs by itself, so the aprons are chosen first as if it were there.
  let minDepth=o.shelf&&o.endStretch?0:legH/R.rackDepth;
  let apron=apronFor(minDepth);
  let shelf=o.shelf?tableShelfPlan(o,{L,W,legH,longSpan,over,leg,railT,sizes,what,boardW:planks?topM.w:1},M[apron].w,problems):null;
  if(!shelf&&minDepth===0){
    minDepth=legH/R.rackDepth;
    apron=apronFor(minDepth);
  }
  const deep=mat=>M[mat].w>=minDepth-1e-9;
  if(!planks&&(L>SHEET_SIZE[0]+1e-6||W>SHEET_SIZE[1]+1e-6)){
    problems.push({level:'stop',
      text:`The top is one piece of plywood ${fmt(L)} by ${fmt(W)}, and a sheet of plywood is only ${fmt(SHEET_SIZE[0])} by ${fmt(SHEET_SIZE[1])}.`,
      fix:`Keep it to ${fmt(SHEET_SIZE[0])} long and ${fmt(SHEET_SIZE[1])} from front to back, or less.`});
  }
  if(!deep(biggest)){
    const tallest=Math.floor(M[biggest].w*R.rackDepth+topT);
    problems.push({level:'stop',
      text:`At ${fmt(H)} tall the legs are ${fmt(legH)} long, and the ${M[biggest].short} aprons (${fmt(M[biggest].w)} deep) are the only thing keeping them square. Aprons hold a frame steady up to about ${R.rackDepth} times their depth; taller than that it sways.`,
      fix:`Keep the height to ${fmt(tallest)} or less.`});
  }
  if(!strong(biggest)){
    const reach=Math.min(railReach(biggest,W/2,use),people?personReach(biggest):Infinity);
    const longest=Math.floor(reach+2*over+2*leg);
    problems.push({level:'stop',
      text:`The long aprons would span ${fmt(longSpan)} between the legs and carry half of a ${people?'seat':'top'} ${fmt(W)} wide (${USES[use].label}, about ${USES[use].psf} lb per square foot). Even ${M[biggest].short} aprons on edge would sag or be overloaded.`,
      fix:longest>=2*over+2*leg+4?`Keep the length to ${fmt(longest)} or less at this width, or make it narrower.`:'Make it narrower.'});
  }
  return{name:o.name||'',L,W,H,legH,leg,over,use,planks,boards,topMat:o.top,topT,legMat:o.leg,
    topName:planks?(o.seatBoards?'Seat board':'Top board'):'Top',
    apron,apronDepth:M[apron].w,apronT:M[apron].t,baseApron:sizes[0],apronWhy:apron===sizes[0]?'':(strong(sizes[0])?'height':'span'),
    longSpan,shortSpan,crossSpan,railMat,railT,railCount,railStep,between,
    kneeRoom:legH-M[apron].w,sitsAt:!!o.sitsAt,shoes:!!o.shoes,lowY:o.lowY||0,shelf,shelfLeftOut:!!o.shelf&&!shelf,problems};
}
function buildTable(o){
  const plan=o.legH?o:tablePlan(o),P=[];
  const{L,W,H,legH,leg,over,topT,apron,apronDepth,apronT,railT}=plan;
  // the top
  if(plan.planks){
    const width=M[plan.topMat].w;
    for(let i=0;i<plan.boards;i++)P.push(mk(plan.topName,plan.topMat,[L,topT,width],[0,legH,i*width]));
  }else P.push(mk(plan.topName,plan.topMat,[L,topT,W],[0,legH,0]));
  // four legs, set in from the edge of the top
  for(const x of[over,L-over-leg])for(const z of[over,W-over-leg])P.push(mk('Leg',plan.legMat,[leg,legH,leg],[x,0,z]));
  // a frame of rails between the legs, flush with their outside faces
  const frame=(y,name,mat,ends)=>{
    const depth=M[mat].w,thick=M[mat].t;
    P.push(mk('Long '+name,mat,[plan.longSpan,depth,thick],[over+leg,y,over]),
           mk('Long '+name,mat,[plan.longSpan,depth,thick],[over+leg,y,W-over-thick]));
    if(ends)P.push(mk('Short '+name,mat,[thick,depth,plan.shortSpan],[over,y,over+leg]),
                   mk('Short '+name,mat,[thick,depth,plan.shortSpan],[L-over-thick,y,over+leg]));
  };
  frame(legH-apronDepth,'apron',apron,true);
  // cross rails between the long aprons, flush with their top edges
  const railDepth=M[plan.railMat].w;
  for(let i=1;i<=plan.railCount;i++){
    P.push(mk('Cross rail',plan.railMat,[railT,railDepth,W-2*over-2*apronT],[over+i*plan.railStep,legH-railDepth,over+apronT]));
  }
  // the lower frame and the shelf on it
  const shelf=plan.shelf;
  if(shelf){
    const stretcherM=M[shelf.stretcher],shelfM=M[shelf.mat];
    frame(shelf.low,'stretcher',shelf.stretcher,shelf.ends);
    for(const x of shelf.rails){
      P.push(mk('Shelf rail',plan.railMat,[railT,M[plan.railMat].w,W-2*over-2*stretcherM.t],[x,shelf.y-M[plan.railMat].w,over+stretcherM.t]));
    }
    if(shelf.sheet)P.push(mk('Lower shelf',shelf.mat,[shelf.length,shelfM.t,W-2*over],[over+leg,shelf.y,over]));
    for(let i=0;i<shelf.slats;i++){
      P.push(mk('Shelf slat',shelf.mat,[shelfM.w,shelfM.t,W-2*over],[over+leg+shelf.slatGap+i*(shelfM.w+shelf.slatGap),shelf.y,over]));
    }
  }
  return P;
}
/* what to know about a table before building it: shown under the form and at the top of the instructions */
function tableNotes(name,p){
  const plan=tablePlan(tableArgs(name,p)),notes=[],R=TABLE_RULES,use=USES[plan.use];
  const surface=plan.topName==='Seat board'?'seat':'top';
  // what happened to the lower shelf comes first: the line under the form shows only the first notes
  if(plan.shelfLeftOut){
    notes.push(`The lower shelf is left out: under ${M[plan.apron].short} aprons at this height there is less than ${fmt(R.shelfRoom)} of room for it. Raise the ${surface} to get it back.`);
  }
  if(plan.shoes&&plan.shelf)notes.push(`There is ${fmt(plan.shelf.room)} between the shoe shelf and the aprons.`);
  if(plan.planks&&Math.abs(plan.W-p.W)>.01){
    notes.push(`The ${surface} is ${plan.boards} whole ${M[plan.topMat].short} boards, so it comes out ${fmt(plan.W)} from front to back instead of ${fmt(p.W)}.`);
  }
  if(plan.apronWhy==='span'){
    notes.push(`The aprons are ${M[plan.apron].short} instead of ${M[plan.baseApron].short}: at this size the long ones span ${fmt(plan.longSpan)} between the legs, too far for a ${M[plan.baseApron].short}.`);
  }
  if(plan.apronWhy==='height'){
    notes.push(`The aprons are ${M[plan.apron].short} instead of ${M[plan.baseApron].short}: legs ${fmt(plan.legH)} long need deeper aprons to stay square.`);
  }
  if(plan.sitsAt&&plan.kneeRoom<R.kneeRoom){
    notes.push(`There is ${fmt(plan.kneeRoom)} of knee room under the aprons. Most chairs want about ${fmt(R.kneeRoom)}, so try your chair first or raise the top.`);
  }
  if(plan.railCount===1){
    notes.push(`A cross rail under the middle of the ${surface} ${plan.planks?'keeps the boards flat and carries their middle':'carries the plywood and gives you something to screw it to'}.`);
  }
  if(plan.railCount>1){
    notes.push(`There are ${plan.railCount} cross rails under the ${surface}, about one every ${fmt(Math.round(plan.railStep*8)/8)}, measured from the middle of one to the middle of the next. They ${plan.planks?'keep the boards flat and carry their middle':'carry the plywood and give you something to screw it to'}.`);
  }
  if(!plan.planks||(plan.shelf&&plan.shelf.sheet))notes.push('Cut the plywood with its face grain running the long way. It is much stiffer that way.');
  notes.push(`Sized by rule of thumb for ${use.label}: about ${use.psf} lb on every square foot of the ${surface}.`);
  return notes;
}
/* Fasteners a table, desk or bench names itself (joints on the preset; see namedJointType in js/joints.js).
   The boards of a plank top are each screwed down to the frame and are not glued to each other, and the lower
   shelf only touches the legs it is fitted between. */
const TABLE_JOINTS=[['Top board','Top board','none'],['Seat board','Seat board','none'],['Leg','Lower shelf','none']];
/* A table, desk or bench preset: everything but the name, the description and the form comes from the tables above. */
function tablePreset(name,desc,params){
  return{name,spec:TABLE_KINDS[name].spec,desc,params,
    build:p=>buildTable(tableArgs(name,p)),
    uses:tableUses(name),
    joints:TABLE_JOINTS,
    check:p=>tablePlan(tableArgs(name,p)).problems,
    notes:p=>tableNotes(name,p),
    info:p=>tableNotes(name,p).slice(0,3).join(' '),
    steps:p=>tableSteps(tablePlan(tableArgs(name,p)))};
}

/* ---------- five-board bench ----------
   Two plank legs, a seat and two aprons. The legs are one board size narrower than the seat, so the aprons lap
   over the edges of the legs (glue and screws into long grain, which is what keeps the bench from leaning
   sideways) and the seat sits on the legs and on both aprons, carried along both of its long edges. */
const FIVE_BOARD={
  legFor:{'1x10':'1x8','1x12':'1x10'},  // the leg board for each seat board
  apron:'1x4',
  legInset:3,     // the legs stand this far in from the ends of the seat
  apronInset:1    // the aprons stop this far short of the ends of the seat
};
function fiveBoardPlan(p){
  const F=FIVE_BOARD,seatMat=F.legFor[p.board]?p.board:'1x12',legMat=F.legFor[seatMat];
  const seatM=M[seatMat],legM=M[legMat],apronM=M[F.apron];
  const L=Math.max(p.L,14),H=Math.max(p.H,8),depth=seatM.w,problems=[];
  const edge=(depth-legM.w-2*apronM.t)/2;           // how far the seat reaches past the aprons, front and back
  const span=L-2*F.legInset-legM.t;                 // each apron, center to center of the legs
  if(!railFits(F.apron,span,depth/2,'seat')||!personFits(F.apron,span)){
    const longest=Math.floor(Math.min(railReach(F.apron,depth/2,'seat'),personReach(F.apron))+2*F.legInset+legM.t);
    problems.push({level:'stop',
      text:`The two ${apronM.short} aprons would span ${fmt(span)} between the legs with people sitting on the seat. That is too far for boards that thin: they would sag or be overloaded.`,
      fix:`Keep the length to ${fmt(longest)} or less. For a longer bench use the Sturdy bench.`});
  }
  return{L,H,depth,edge,seatMat,legMat,apronMat:F.apron,legH:H-seatM.t,problems};
}
function buildFiveBoard(p){
  const plan=fiveBoardPlan(p),F=FIVE_BOARD,{L,H,depth,edge,legH}=plan;
  const seatT=M[plan.seatMat].t,legT=M[plan.legMat].t,legW=M[plan.legMat].w,apronW=M[plan.apronMat].w,apronT=M[plan.apronMat].t;
  const apronLength=L-2*F.apronInset,apronY=legH-apronW;
  // a plank leg: its grain always runs up and down, also when the leg is no taller than the board is wide
  const leg=x=>Object.assign(mk('Leg',plan.legMat,[legT,legH,legW],[x,0,edge+apronT]),{l:r16(legH),w:legW,t:legT,ax:[1,2,0]});
  return[
    leg(F.legInset),
    leg(L-F.legInset-legT),
    mk('Apron',plan.apronMat,[apronLength,apronW,apronT],[F.apronInset,apronY,edge]),
    mk('Apron',plan.apronMat,[apronLength,apronW,apronT],[F.apronInset,apronY,depth-edge-apronT]),
    mk('Seat',plan.seatMat,[L,seatT,depth],[0,legH,0])];
}
function fiveBoardNotes(p){
  const plan=fiveBoardPlan(p);
  return[`The legs are ${M[plan.legMat].short}, one size narrower than the ${M[plan.seatMat].short} seat, so the aprons lap over their edges. That joint is what keeps the bench from leaning sideways: glue it.`,
    'Sized by rule of thumb for people sitting on it: about 100 lb on every square foot of the seat.'];
}

/* ---------- platform bed ----------
   A 2x6 frame bolted to 4x4 corner legs. The slats rest on a cleat along each side rail and on as many center
   beams as it takes to keep their span short enough for the mattress and the sleepers (USES.bedSlat); every
   center beam has its own legs. A center leg stands beside its beam with its top level with the beam's top,
   the same way a corner leg stands beside the rails: the beam is glued and screwed to the side of the leg
   (screws into long grain, with room to drive them), the slats above also rest on the top of the leg, and the
   leg at each end of a beam laps the head or foot rail far enough to be screwed to it as well.
   (A leg standing under the beam would reach only 1/4" up the rail: nothing to screw to, and the only way to
   hold it to the beam would be 6" screws down through the beam into end grain.) */
const BED_RULES={
  rail:'2x6',leg:'4x4',cleat:'2x2',beam:'2x4',slat:'1x4',
  slatPitch:6.5,     // one slat about this often: the gaps stay near 3", which mattress makers ask for
  slatMargin:.95,    // a slat may span this share of what the bending helper allows
  beamLegGap:44,     // a center beam gets a leg at least this often
  mattressDrop:1.75  // the slats sit this far below the top of the frame, so the mattress cannot slide off
};
function bedPlan(p){
  const B=BED_RULES,railT=M[B.rail].t,slatM=M[B.slat],cleatW=M[B.cleat].w,beamM=M[B.beam],legW=M[B.leg].w;
  const W=Math.max(p.Wm,20)+3.5,L=Math.max(p.Lm,30)+3.5,H=Math.max(p.H,8),slatY=H-B.mattressDrop;
  const slats=Math.ceil(L/B.slatPitch),slatGap=(L-2*railT-slats*slatM.w)/(slats-1);
  // how far one slat may span, carrying the strip of mattress from its middle to the next slat's middle
  const slatSection=sectionOf(slatM.w,slatM.t,false);
  const slatLoad=USES.bedSlat.psf/144*(slatM.w+slatGap)+WOOD_RULES.DENSITY*slatSection.A;
  const slatReach=maxSpanFor(slatSection,slatLoad,'bedSlat')*B.slatMargin;
  // center beams: split the distance between the two cleats (center to center) into bays a slat can span
  const firstCleat=railT+cleatW/2,betweenCleats=W-2*firstCleat;
  const bays=Math.max(1,Math.ceil(betweenCleats/slatReach-1e-6)),bay=betweenCleats/bays;
  const beamXs=[];
  for(let i=1;i<bays;i++)beamXs.push(firstCleat+i*bay);
  // Legs for each center beam: one at each end, tight against the head and foot rails (so the long end rails get
  // a leg in the middle too), and as many between as keep the beam's span short enough, never further apart
  // than beamLegGap.
  const beamLength=L-2*railT,beamSection=sectionOf(beamM.t,beamM.w,false);
  const beamLoad=USES.bedSlat.psf/144*bay+WOOD_RULES.DENSITY*beamSection.A;
  const beamReach=Math.min(B.beamLegGap,maxSpanFor(beamSection,beamLoad,'bedSlat')*B.slatMargin);
  const legBays=Math.max(1,Math.ceil((beamLength-legW)/beamReach-1e-6));
  const beamLegZs=[];
  for(let j=0;j<=legBays;j++)beamLegZs.push(railT+j*(beamLength-legW)/legBays);
  // how far a center leg reaches up the head or foot rail it stands against: the room there is for screws
  const railLap=slatY-(H-M[B.rail].w);
  return{W,L,H,slatY,slats,slatGap,bays,bay,beamXs,beamLegZs,beamLength,legH:slatY,beamLegH:slatY,railLap,problems:[]};
}
function buildBed(p){
  const plan=bedPlan(p),B=BED_RULES,P=[],{W,L,H,slatY}=plan;
  const railT=M[B.rail].t,railW=M[B.rail].w,legW=M[B.leg].w,cleatW=M[B.cleat].w,beamM=M[B.beam],slatM=M[B.slat];
  P.push(mk('Side rail',B.rail,[railT,railW,L],[0,H-railW,0]),mk('Side rail',B.rail,[railT,railW,L],[W-railT,H-railW,0]));
  P.push(mk('End rail',B.rail,[W-2*railT,railW,railT],[railT,H-railW,0]),mk('End rail',B.rail,[W-2*railT,railW,railT],[railT,H-railW,L-railT]));
  // a leg in each inside corner, its top level with the cleats
  for(const x of[railT,W-railT-legW])for(const z of[railT,L-railT-legW])P.push(mk('Leg',B.leg,[legW,plan.legH,legW],[x,0,z]));
  // a cleat along the inside of each side rail, from leg to leg
  for(const x of[railT,W-railT-cleatW])P.push(mk('Cleat',B.cleat,[cleatW,cleatW,L-2*railT-2*legW],[x,slatY-cleatW,railT+legW]));
  // center beams on edge between the head and foot rails; the legs of each stand against its side, on the side
  // that faces the middle of the bed, with their tops level with the top of the beam
  for(const x of plan.beamXs){
    P.push(mk('Center beam',B.beam,[beamM.t,beamM.w,plan.beamLength],[x-beamM.t/2,slatY-beamM.w,railT]));
    const legX=x>W/2+.01?x-beamM.t/2-legW:x+beamM.t/2;
    for(const z of plan.beamLegZs)P.push(mk('Center leg',B.leg,[legW,plan.beamLegH,legW],[legX,0,z]));
  }
  for(let i=0;i<plan.slats;i++)P.push(mk('Slat',B.slat,[W-2*railT,slatM.t,slatM.w],[railT,slatY,railT+i*(slatM.w+plan.slatGap)]));
  P.push(mk('Mattress','mattress',[W-3.5,10,L-3.5],[1.75,slatY+slatM.t,1.75]));
  return P;
}
/* Fasteners the bed names itself: the slats only touch the rails they lie between (they are screwed down into
   the cleats, the beams and the tops of the legs), and a cleat only touches the legs at its ends. */
const BED_JOINTS=[['Side rail','Slat','none'],['End rail','Slat','none'],['Cleat','Leg','none']];
function bedNotes(p){
  const plan=bedPlan(p),beams=plan.beamXs.length,legs=plan.beamLegZs.length,notes=[];
  const onLegs=beams===1?`on ${legs} legs of its own`:`each on ${legs} legs of its own`;
  notes.push(beams?`${beams===1?'One center beam runs':beams+' center beams run'} under the slats, ${onLegs}: a 1x4 slat carries a mattress and sleepers across about ${fmt(Math.floor(plan.bay))}, not across the whole bed.`
    :'This bed is narrow enough for the slats to reach from side to side, so it has no center beam.');
  notes.push(`${plan.slats} slats with gaps of about ${fmt(plan.slatGap)}. Most mattress makers ask for gaps of 3" or less.`);
  notes.push('Sized by rule of thumb for a mattress and two sleepers: about 30 lb on every square foot.');
  return notes;
}
/* ---------- regression check for the tables, benches and the bed (selfTest calls it) ----------
   selfTestStructure tries one number at its limit at a time. This tries every corner of the limits together
   (smallest with tallest, longest with widest, every choice in a list), and at each one it wants either a
   refusal that explains itself or a design with nothing for the structural check to find. It also looks at
   something the structural check does not: two pieces that touch over a strip too thin to drive a screw
   through are not a joint, whatever the Fasteners tab would suggest for them. */
const FAMILY_CHECK={
  presets:Object.keys(TABLE_KINDS).concat(['Five-board bench','Platform bed']),
  thinnestJoint:.7,   // the edge of a 3/4" board is the thinnest thing a screw is driven into
  slats:/^(Slat|Shelf slat)$/   // slats land wherever their even spacing puts them, so they are not looked at
};
function selfTestTablesFamily(problems){
  const F=FAMILY_CHECK;
  for(const name of F.presets){
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(!preset){problems.push(`${name}: the preset is missing`);continue;}
    // every number at its smallest or its largest, and every choice of every plain list
    const axes=[];
    for(const field of preset.params){
      if(!field.k||field.check||field.fill)continue;
      if(field.opts)axes.push(field.opts.map(option=>[field.k,option[0]]));
      else if(field.min!==undefined&&field.max!==undefined)axes.push([[field.k,field.min],[field.k,field.max]]);
    }
    const tryOne=vals=>{
      const where=`${name} at ${axes.map(axis=>vals[axis[0][0]]).join(' x ')}`;
      let check;
      try{check=checkPreset(preset,vals);}
      catch(e){problems.push(`${where}: error: ${e.message}`);return;}
      if(check.refused){
        if(check.stops.some(f=>f.code==='input'&&!(f.text&&f.fix)))problems.push(`${where}: refused without saying why and what to change`);
        return;
      }
      check.problems.forEach(f=>problems.push(`${where}: ${f.level} ${f.code}: ${f.text}`));
      for(const joint of findJoints(check.parts)){
        if(F.slats.test(joint.a.name)||F.slats.test(joint.b.name)||defaultType(joint)==='none')continue;
        const strip=Math.min(joint.ru[1]-joint.ru[0],joint.rv[1]-joint.rv[0]);
        if(strip<F.thinnestJoint)problems.push(`${where}: the ${joint.a.name} and the ${joint.b.name} touch over a strip only ${fmt(strip)} wide: no room for a fastener`);
      }
    };
    const walk=(depth,vals)=>{
      if(depth===axes.length){tryOne(vals);return;}
      for(const[key,value]of axes[depth])walk(depth+1,Object.assign({},vals,{[key]:value}));
    };
    walk(0,presetDefaults(preset));
  }
}
const TANKS={g5:[16,8,10,5.5,'5.5 gallon'],g10:[20,10,12,10,'10 gallon'],g15:[24,12,12,15,'15 gallon'],g20h:[24,12,16,20,'20 gallon high (tall)'],g20l:[30,12,12,20,'20 gallon long'],
 g29:[30,12,18,29,'29 gallon'],g30b:[36,18,12,30,'30 gallon breeder'],g40b:[36,18,16,40,'40 gallon breeder'],g40l:[48,12,16,40,'40 gallon long'],g55:[48,13,21,55,'55 gallon'],
 g65:[36,18,24,65,'65 gallon (tall)'],g75:[48,18,21,75,'75 gallon'],g90:[48,18,24,90,'90 gallon (tall)'],g100:[72,18,18,100,'100 gallon'],g120:[48,24,24,120,'120 gallon'],g125:[72,18,21,125,'125 gallon']};
const TANK_OPTS=Object.entries(TANKS).map(([k,v])=>[k,v[4]]);
