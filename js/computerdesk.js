/* NominalCAD: the Computer desk (and the Gaming desk, which is the same builder with other start values).

   The spec is design\specs\10-computer-desk.md (stage 1), written from the reference sheet
   design\reference\22-computer-desks.md; "[22 l.n]" below is a line of that sheet.

   WHAT IT IS. As first opened it is the plain Desk (the same 4x4 legs, 2x4 aprons on four sides, cross rails and
   one-piece plywood top, built by the Desk's own tablePlan / buildTable in js/builders-furniture.js), 60" x 30" x
   30", with two things added: a plywood drawer case standing on the floor at the right end, inside the legs and
   under the aprons, with three drawers on ball-bearing slides; and the rest of the width left open for the knees
   and the chair. Everything else is an option, off to start with:
     drawers at the left end, at both ends, or none; 2 to 4 drawers; an open shelf under them; the case width;
     wooden runners; inset fronts                                         (the Drawer nightstand's drawer code)
     a monitor shelf across the back, full width or narrower
     a power strip under the back of the top, and a hook on one end      (hardware, placed by afterPlace)
     a tower shelf at one end, a low plywood stand on the floor that a computer tower sits on
     cable holes in the top with grommets, a cable tray under them (the power strip lies in it), the front corners
     of the top rounded, a cup holder over the tower shelf, and pictures of a monitor and a tower (stage 2)
     "Check it against my room": four measurements, and plain words on whether the desk fits (R1 to R4)

   THE FORM opens short (the owner: "most of the options hidden behind check boxes"). The rows everyone sets and the
   option boxes come first; an option's own rows show only while its box is ticked (under() in js/presets.js, the
   generic helper, which draws them indented). The details of the drawers, the tower space and the hook are in the
   "More options" fold of the catalog entry (entry.short, js/presetentry.js).

   IN THIS FILE
     DESK_RULES               every number, with where it comes from
     computerDeskPlan(p)      the whole design worked out once, nothing drawn: the Desk's frame plan, the cross
                              rails (deskRails), the tower shelf, the drawer case of each stack
                              (drawerStackLayout, js/nightstand.js), the knee space, the monitor shelf and its
                              supports, the bay of the power strip, the end of the hook, and what cannot work
     buildComputerDesk(p)     the pieces
     computerDeskCheck(p)     the warning box: stops and warns (CD1-CD26, R1-R4 of the spec)
     computerDeskInfo(p)      the remark under the form
     computerDeskNotes(p)     the notes at the top of the build instructions
     computerDeskSteps(p)     the build steps
     computerDeskHardware(p)  the shopping list lines it names itself
     computerDeskAfterPlace   puts the power strip and the hook on the new pieces
   and the preset itself, then its self-checks, at the bottom. */
'use strict';

const DESK_RULES={
  // the sizes on the form [22 l.95-97]
  minL:46,maxL:72,minW:24,maxW:36,minH:28,maxH:30,
  // the knee space
  kneeLeast:30,          // inches of knee width, the ADA width [22 l.53]; less is refused (CD5)
  kneeEasy:41,           // the recommended knee width [22 l.53] (SECONDARY): a note under it (CD6)
  kneeDepthLeast:17.3,   // knee depth, least [22 l.54]
  footDepthLeast:23.6,   // foot depth, least [22 l.55]
  footHigh:4,            // the foot box is this high off the floor (self-check)
  thighTall:27.75,       // a tall person's thigh tops when seated, about 27.7" derived [22 l.43] (CD8)
  // the drawer case
  caseW:16,caseMinW:14,caseMaxW:20,   // outside width; store pedestals 15.5"-16", a letter file case 16" [22 l.142, l.251]
  caseTallest:27,        // storage under a fixed desk is 27" tall at most [22 l.58]
  overlaySetBack:.75,    // overlay fronts: the case front edges stand this far behind the front face of the front
                         // legs, so a 3/4" front 1/16" off the case ends 1/16" proud of the legs
  backPanel:.25,         // the case back is 1/4" plywood, flush with the back faces of the back legs
  // the tower shelf: a low plywood stand at one end that the computer tower sits on (the owner, 16 Nov 10:27 PM:
  // "the desktop divider seems pointless, should be like a shelf it sits on"). It replaces the tower panel of stage
  // 1, which is no longer built (a design saved with the panel keeps its pieces and their fasteners). The shelf is
  // held at both of its long sides by two plywood sides that stand on the floor, running front to back, flush with
  // the front and back faces of the legs; the sides stand towerLip above the shelf, so a foot cannot push the
  // computer off it. Open at the front and the back for the air [22 l.338]. It stands on the floor on its own, its
  // outer side against the end legs: the tower's weight goes straight to the floor, none of it to the desk.
  towerInside:11,        // the shelf's width, inside between its sides: a mid tower 9.1"-9.5" wide + 1" [22 l.186, l.339]
  towerInsideLeast:10.5, // a 9 1/2" mid tower and 1/2" each side
  towerInsideMost:16,
  towerUp:3,             // floor to the top of the shelf, off the carpet and the dust: a store stand lifts a tower about
                         // 3", an article on floor PCs asks about 4" for high-pile carpet (sheet 22, section 10, sources 64-65)
  // (the most is what the highest desk with 2x4 aprons gives: 25 3/4" under the front apron less a 20" tower, CD14;
  //  a higher number would always be refused)
  towerUpLeast:2,towerUpMost:5.75,
  towerLip:1.5,          // the sides stand this far above the shelf, so a foot cannot push the computer off it
  towerTall:20,          // a mid tower is 18"-20" tall [22 l.186]: it must slide in under the front apron (CD14)
  towerAirOpen:2,        // air over it out in the open under a desk, not shut in an enclosure [22 l.336] (CD14)
  towerDeep:21.5,        // the deepest mid tower [22 l.186]: the shelf runs the full depth of the desk's legs
  towerWeight:38,        // a built mid tower weighs 22-38 lb [22 l.189]. The shelf is checked by verifyDesign as a loaded
                         // storage shelf (50 lb per square foot, USES.shelf): 80 lb or more on the smallest shelf the
                         // form allows, more than the heaviest mid tower (self-check computerDeskTowerSpace)
  fullTower:31,          // a full tower with its air space [22 l.338] (CD16)
  panel:.75,             // plywood of the tower shelf and its sides (and of the old tower panel)
  // Cable holes through the top, each with a grommet: 2" (Commercial Electric, Home Depot) or 2 1/2" (Rockler), cut
  // with a hole saw of the same size [22 l.222-225]. Over open space only [22 l.226, l.508]: never over a leg, an
  // apron, a cross rail, a drawer case, the tower shelf or a monitor shelf support; over the knee space, near the
  // back edge, in the bay of the back apron between two cross rails (the bay of the power strip and the cable tray).
  // Each hole's back edge is `clear` in front of the back apron's inside face, so its middle is 3 5/8" (2") or
  // 3 7/8" (2 1/2") from the back edge of the top, inside the sheet's "2" to 4" in from the back edge" [22 l.226].
  // railClear: what a hole keeps off a cross rail, a case side or a shelf support in plan, so a cable drops past it;
  // apart: between two holes; plug: a plug is about 1 1/2" wide, the drop it needs under a hole (self-check).
  // rim: a grommet's rim lies on the top this far past the edge of its hole all round (a 2" grommet's flange is
  // 2 1/2" to 2 3/4" across; HARDWARE.grommet in js/hardware.js draws it so): a shelf support keeps the rim and
  // railClear more off it, measured round the hole, so the grommet sits flat and its cap lifts out.
  holes:{sizes:[['2','2"'],['2.5','2 1/2"']],clear:.125,railClear:.5,apart:3,plug:1.5,rim:.3},
  // The cable tray under the holes (a wood trough, not sourced [22 l.261]: PRACTICE): a 1x6 bottom laid flat UNDER
  // the back apron, lapping its whole bottom edge (`lap`, the apron's 1 1/2": its back edge flush with the apron's
  // back face) and screwed up into that edge, so the floor of the tray is level with the underside of the apron and
  // 3 1/2" below the top (store trays are 3" to 5" tall [22 l.258]); and a 1x2 on edge standing on its front edge,
  // screwed up through the bottom. The bottom sticks out 4" past the apron and is held along 1 1/2": within the
  // structural check's rule for a piece held at one edge (LEVER, js/verify.js: 4 times the joint). Inside: 3 1/4"
  // from the apron's face to the lip (6-outlet strips are 1.2" to 3" wide [22 l.198]), 1 1/2" up to the top of the
  // lip and open above it; both hole sizes are wholly over that inside. It lies in the bay of the
  // knee space between two cross rails, stopping `ends` short of each, its ends open for the cords. The power strip
  // lies on its floor, outlets up, hung on two screws through its keyhole slots, so it lifts off to plug something
  // in; a plug dropped through a hole comes down onto it. It stays at the back, out of the knee space, which is from
  // the front edge back 17.3" [22 l.261]: on a desk too shallow for that the tray is refused.
  tray:{bottom:'1x6',lip:'1x2',lap:1.5,ends:1,screwDeep:.625},
  // the front corners of the top, rounded (spec 03's default radius); the edge banding is wrapped around them in
  // one piece (sheet 22, section 10, sources 66-67: iron-on veneer follows a curve when heated a little at a time and held)
  cornerRadius:1,
  // the cup holder: a drop-in insert in a 3 3/4" hole near a front corner over the tower shelf (sheet 22, 4k).
  // Inserts hang 3 1/4" to 3 3/4"; one stainless insert asks for 3 3/4" of depth (section 10, source 68): 4" is used.
  // Never over a drawer, a leg, an apron or the knees (4k; section 6, item 23). clear: what its body keeps off
  // the front apron, a leg and a cross rail in plan; below: what its bottom keeps above the tallest mid tower.
  // The insert hangs over the computer, which may breathe out of its top: one with a closed bottom (no drain hole) is
  // bought, so a spill or a sweating drink stays in it (HARDWARE.cupinsert's words say so).
  cup:{d:3.75,deep:4,clear:.5,below:.25},
  // the pictures only (weightless, never bought or cut): a 24" monitor on its stand (Dell P2422H, 21.2" x 7.1" x
  // 14.3"-19.5") and a mid tower (Corsair 4000D Airflow, 9.1" W x 18.3" H x 17.8" D) [22 l.155, l.185]
  monitor:{w:21.2,screenTall:12.6,screenDeep:1.9,lowest:14.3,baseW:8,baseDeep:7.1,baseTall:.6,neckW:2.4,neckDeep:1.2,fromBack:1},
  pcTower:{w:9.1,tall:18.3,deep:17.8,fromFront:1,beside:2},
  // the monitor shelf
  riserBoards:{'1x10':'9 1/4" (1x10)','1x12':'11 1/4" (1x12)'},   // 1x8 is too shallow [22 l.233]
  riserSupport:'1x4',    // on edge, grain front to back: the shelf top is 3 1/2 + 3/4 = 4 1/4" over the desk [22 l.232]
  riserBack:4.75,        // the supports start this far from the back edge: the shelf reaches past them for the cables
  riserEndLeast:3,       // an end support stands at least this far in from the end of the shelf
  drillRoom:1.5,         // a drill held straight up needs this much clear of a leg, an apron, a rail or a panel (CD18)
  riserLeast:24,         // the narrowest shelf: a 24" monitor is about 21.2" wide [22 l.155]
  roomInFront:20,        // about 20" of desk in front of the shelf for a keyboard [22 l.236] (CD20)
  screen:[43,54],        // the top of the screen, seated [22 l.78] (CD21)
  screenOnStand:[43,48.5,29],   // a 24" monitor on its own stand on a 29" desk [22 l.235]
  depthBest:30,          // [22 l.96, l.510] (CD22)
  heightLeast:28.5,      // HFES fixed desk, SECONDARY [22 l.40] (CD23)
  // the room boxes (PRACTICE margins)
  sillRoom:.125,armRoom:.5,chairSide:1,
  roomMost:{space:240,sill:60,arms:40,chairW:40},
  // a person leaning on an open drawer (PRACTICE: 50 lb pressed down on the front of a fully open drawer is the
  // usual furniture test load; a child standing on one weighs about that). Less than this tips it: not built.
  leanLoad:50,
  leanSlideLeast:16,     // the drawers are never put on slides shorter than this to pass the lean check
  // hardware
  // a 6-outlet strip [22 l.198]. It hangs LOW on the back apron, its bottom edge stripLift above the apron's bottom
  // edge, so the screws in its keyhole slots go in under the pocket holes along the top of the apron.
  strip:{length:11.5,tall:1.75,out:1.25,bayLeast:13.5,clear:1,lift:.125,screwDeep:.75},
  hookFromLeg:2,         // the hook's plate starts 2" in front of the back leg, under the overhang, never at the front [22 l.295]
  hookPlate:1.8,
  hookTall:1.6,hookLift:.25,hookScrews:.5,   // its plate is 1.6" tall, hung 1/4" above the apron's bottom edge (under
                         // the pocket holes and, in Rustic, under the screws down through the top); its two screws
                         // 1/2" above and below its middle, about 3/4" into the apron
  screwClear:.25,        // a hardware screw keeps this much wood between itself and any other fastener's hole
  banding:{roll:25,label:'Edge banding, 13/16" iron-on, 25 ft roll'},   // EDGEMATE 1SO [22 l.392]
  wallGap:1.5,           // leave this between the back of the desk and the wall, for the cables
  armHoleClear:1.5,      // a monitor arm's grommet hole this far in front of the back apron's inside face, so the
                         // arm's plate under the top (about 3" across, PRACTICE) clears the apron
  // the pulls: their screws pass through the drawer front and the drawer box front behind it, so the short screws in
  // a pull's package do not reach. Bought: #8-32 machine screws (the thread of US cabinet pulls), as long as the
  // pull line of the step says (pullLine, js/buildsteps.js: the wood plus 3/8" into the pull, to the next 1/4").
  pullScrewInPull:.375,
};
const COMPUTER_DESK_DEFAULTS={L:60,W:30,H:30,drawers:'right',N:'3',caseW:16,fh:7,slides:'slide',fronts:'overlay',
  riserBoard:'1x10',riserSpan:'full',riserW:36,towerSide:'left',towerW:11,towerUp:3,hookSide:'away',holeN:'1',holeD:'2'};
/* the words for each end, and for the drawer choice */
const DESK_DRAWER_CHOICES=[['right','At the right end (as you sit)'],['left','At the left end'],['both','At both ends'],['none','No drawers']];
const DESK_CASE_NAMES=['Side','Bottom','Toe kick','Top rail','Back panel','Shelf'];
const deskEndWords=side=>side==='left'?'left':'right';

/* ---------- the plan ---------- */
const deskPlanMemo=new Map();
function computerDeskPlan(p){
  const key=JSON.stringify(p);
  if(!deskPlanMemo.has(key)){
    if(deskPlanMemo.size>400)deskPlanMemo.clear();
    deskPlanMemo.set(key,deskPlanLeanSafe(p));
  }
  return deskPlanMemo.get(key);
}
/* The plan, with drawer slides short enough that a person leaning on an open drawer (DESK_RULES.leanLoad) does not
   tip the desk: on a shallow desk the longest slide that fits brings the open drawer so far out that 50 lb on its
   front would tip it, so the next shorter slide is used (the drawer box gets as much shorter, the case stays). It
   never goes under DESK_RULES.leanSlideLeast; if that is still not enough the warning box refuses (CD11). */
function deskPlanLeanSafe(p){
  let plan=deskPlanFresh(p);
  if(!plan.stacks.length||plan.problems.some(f=>f.level==='stop'))return plan;
  const full=plan.stacks[0].layout.drawer.length;
  while(deskLeanOf(plan)<DESK_RULES.leanLoad){
    const now=plan.stacks[0].layout.drawer.length,shorter=DRAWER.slideLengths.filter(length=>length<now).pop();
    if(!shorter||shorter<DESK_RULES.leanSlideLeast)break;
    const next=deskPlanFresh(p,shorter);
    if(next.problems.some(f=>f.level==='stop'))break;
    plan=next;
  }
  const used=plan.stacks[0].layout.drawer.length;
  if(used<full)plan.changed.push(`The drawers run on ${used}" ${plan.v.kind==='slide'?'slides':'runners'}, not the ${full}" that would fit: with those, a person leaning on an open drawer would tip a desk this shallow.`);
  return plan;
}
/* the form values the plan works from: every option off unless its box is ticked, every size inside its limits */
function deskValues(p){
  const R=DESK_RULES,within=(v,lo,hi,usual)=>Number.isFinite(+v)?Math.min(hi,Math.max(lo,+v)):usual;
  const drawers=['right','left','both','none'].includes(p.drawers)?p.drawers:'right';
  return{
    L:within(p.L,R.minL,R.maxL,60),W:within(p.W,R.minW,R.maxW,30),H:within(p.H,R.minH,R.maxH,30),drawers,
    N:Math.min(NS.maxDrawers,Math.max(2,parseInt(p.N,10)||3)),cub:drawers!=='none'&&!!p.cub,fh:within(p.fh,NS.minFront,NS.maxFront,7),
    caseW:within(p.caseW,R.caseMinW,R.caseMaxW,R.caseW),kind:p.slides==='runner'?'runner':'slide',style:p.fronts==='inset'?'inset':'overlay',
    riser:!!p.riser,riserBoard:p.riserBoard==='1x12'?'1x12':'1x10',riserPart:p.riserSpan==='part',riserW:within(p.riserW,R.riserLeast,R.maxL,36),
    strip:!!p.strip,tower:!!p.tower&&drawers!=='both',towerSide:p.towerSide==='right'?'right':'left',
    towerW:within(p.towerW,R.towerInsideLeast,R.towerInsideMost,R.towerInside),towerUp:within(p.towerUp,R.towerUpLeast,R.towerUpMost,R.towerUp),
    cup:!!p.tower&&drawers!=='both'&&!!p.cup,
    hook:!!p.hook,hookSide:['left','right'].includes(p.hookSide)?p.hookSide:'away',
    // stage 2: cable holes (and the tray under them), rounded front corners, the pictures of a monitor and a tower
    holes:!!p.holes,holeN:String(p.holeN)==='2'?2:1,holeD:String(p.holeD)==='2.5'?2.5:2,tray:!!p.holes&&!!p.tray,
    round:!!p.round,props:!!p.props,
    room:!!p.room,space:+p.space||0,sill:+p.sill||0,arms:+p.arms||0,chairW:+p.chairW||0};
}
/* slideMost: optional, the longest slide (or runner) the drawers may have (deskPlanLeanSafe) */
function deskPlanFresh(raw,slideMost){
  const R=DESK_RULES,v=deskValues(raw),problems=[],changed=[],chose=[];
  // the frame: exactly the plain Desk's at these sizes (TABLE_KINDS.Desk, js/builders-furniture.js)
  const frame=tablePlan(tableArgs('Desk',{L:v.L,W:v.W,H:v.H}));
  const{L,W,H,legH,leg,over,apronDepth,apronT}=frame;
  problems.push(...frame.problems);
  const caseHeight=legH-apronDepth;   // floor to the underside of the aprons
  // (raw: the form values as given, so the room check can try the desk again at another width: deskSpaceFix)
  const plan={raw,v,frame,L,W,H,legH,leg,over,apronT,apronDepth,caseHeight,problems,changed,chose,stacks:[],tower:null,riser:null,strip:null,hook:null,
    holes:null,tray:null,cup:null,props:null};

  // ---- the drawer stacks, each in its own case at one end, its outer side against the end legs ----
  const ends=v.drawers==='both'?['left','right']:v.drawers==='none'?[]:[v.drawers];
  let number=1;
  for(const side of ends){
    const x0=side==='left'?over+leg:L-over-leg-v.caseW;
    const back=over,sidesFrom=over+R.backPanel;
    const front=v.style==='overlay'?W-over-R.overlaySetBack:W-over;   // inset fronts: the case is flush with the legs
    const gap=DRAWER.frontGap,panel=.75;
    // the space the drawers are built in, from the back of the sides to their front edges; with a shorter slide
    // asked for (slideMost), only as deep as that slide needs, so the drawer boxes stop short of the case back
    let depth=front-sidesFrom;
    if(slideMost){
      const beforeFront=v.style==='overlay'?-DRAWER.overlayStandoff:DRAWER.insetSetBack+DRAWER.frontThick;
      depth=Math.min(depth,slideMost+DRAWER.behind+beforeFront);
    }
    const zone={x:x0+panel,z:front-depth,width:v.caseW-2*panel,depth,floorTop:NS.kick+panel,ceilUnder:caseHeight-panel,
      lapBelow:v.style==='overlay'?panel:-gap,lapAbove:v.style==='overlay'?panel-gap:-gap,lapSide:panel-NS.frontReveal,
      panel,style:v.style,kind:v.kind,open:v.cub,firstNumber:number};
    const within=(value,lo,hi,what)=>{
      if(!(value>=lo)){changed.push(`${what} was raised to ${typedLen(lo)}, the smallest that works.`);return lo;}
      if(value>hi){changed.push(`${what} was cut back to ${typedLen(hi)}, the largest that works.`);return hi;}
      return value;
    };
    const layout=deskStackLayout(zone,v,within);
    // both stacks say the same thing: say it once
    for(const sentence of layout.changed)if(!changed.includes(sentence))changed.push(sentence);
    if(!layout.drawer.ok)problems.push({level:'stop',text:layout.drawer.problems[0],fix:'Make the desk deeper, or the drawer case wider.'});
    plan.stacks.push({side,x0,x1:x0+v.caseW,back,sidesFrom,front,zone,layout,firstNumber:number,lastNumber:number+layout.drawers-1});
    number+=layout.drawers;
  }

  // ---- the tower shelf, at the end with no drawers (deskTowerShelf) ----
  if(v.tower){
    plan.tower=deskTowerShelf(plan);
    if(v.drawers!=='none')chose.push(`The tower shelf is at the ${plan.tower.side} end, the end without drawers.`);
  }

  // ---- the knee space: between whatever stands at its two ends ----
  const leftWall=Math.max(over+leg,...plan.stacks.filter(s=>s.side==='left').map(s=>s.x1),plan.tower&&plan.tower.side==='left'?plan.tower.x1:0);
  const rightWall=Math.min(L-over-leg,...plan.stacks.filter(s=>s.side==='right').map(s=>s.x0),plan.tower&&plan.tower.side==='right'?plan.tower.x0:Infinity);
  plan.knee={lo:leftWall,hi:rightWall,width:r16(rightWall-leftWall),room:frame.kneeRoom,depth:r16(W-over-apronT)};

  // ---- the cross rails: the Desk's own (no tower panel stands under the top any more) ----
  plan.rails=deskRails(plan);

  // ---- what cannot work ----
  const towerTakes=plan.tower?plan.tower.x1-plan.tower.x0:0;
  if((ends.length||plan.tower)&&plan.knee.width<R.kneeLeast-1e-6){
    const takenBy=[ends.length===2?'the drawers at both ends':ends.length?`the drawers at the ${ends[0]} end`:'',plan.tower?'the tower shelf':''].filter(Boolean).join(' and ');
    const least=Math.ceil(R.kneeLeast+2*(over+leg)+ends.length*v.caseW+towerTakes-1e-6);
    // only the ways that really give 30": each is worked out, none is offered because it merely helps
    const short=R.kneeLeast-plan.knee.width;
    const narrowest=ends.length?floor16(v.caseW-short/ends.length+1e-6):0;   // the widest case that still leaves 30"
    const ways=[
      least<=R.maxL?`Make the desk at least ${typedLen(least)} wide`:'',
      ends.length&&narrowest>=R.caseMinW&&narrowest<v.caseW?`make the drawer case ${typedLen(narrowest)} wide or less (under More options)`:'',
      ends.length===2&&plan.knee.width+v.caseW>=R.kneeLeast-1e-6?'put the drawers at one end only':'',
      ends.length&&plan.knee.width+ends.length*v.caseW>=R.kneeLeast-1e-6?'choose No drawers':'',
      plan.tower&&floor16(v.towerW-short+1e-6)>=R.towerInsideLeast&&floor16(v.towerW-short+1e-6)<v.towerW?`make the tower shelf ${typedLen(floor16(v.towerW-short+1e-6))} wide or less`:'',
      plan.tower&&plan.knee.width+towerTakes>=R.kneeLeast-1e-6?'leave out the tower shelf':''].filter(Boolean);
    if(!ways.length)ways.push(ends.length?'choose No drawers and leave out the tower shelf':'leave out the tower shelf');
    problems.push({level:'stop',
      text:`With ${takenBy}, only ${fmt(plan.knee.width)} is left for your knees and the chair. A desk needs at least ${fmt(R.kneeLeast)} there.`,
      fix:capitalFirst(listWithOr(ways))+'.'});
  }
  // CD14: a mid tower (up to 20" tall) slides onto the shelf under the front apron, and out in the open under a
  // desk it wants 2" of air over it [22 l.186, l.336]
  if(plan.tower){
    const highest=floor16(Math.min(plan.knee.room-R.towerTall,frame.legH-R.towerTall-R.towerAirOpen)+1e-6);
    if(v.towerUp>highest+1e-6){
      // only the changes that really give the room: a lower shelf (never under its least), a higher desk, a desk
      // narrow enough that the aprons stay 2x4 (a 2x6 apron takes 2" more off the room under it). Each is tried.
      const roomAt=(width,height)=>tablePlan(tableArgs('Desk',{L:width,W:v.W,H:height})).kneeRoom;
      const enough=(width,height)=>roomAt(width,height)-R.towerTall>=v.towerUp-1e-6;
      let widest=0;
      for(let width=R.minL;width<=Math.floor(L);width++)if(enough(width,H))widest=width;
      const ways=[];
      if(highest>=R.towerUpLeast-1e-6)ways.push(`Set the tower shelf ${typedLen(highest)} or less off the floor`);
      if(H<R.maxH-1e-6&&enough(L,R.maxH))ways.push(`make the desk ${typedLen(R.maxH)} high`);
      if(widest&&widest<L)ways.push(`make it ${typedLen(widest)} wide or less, so the aprons stay ${M[frame.baseApron].short}`);
      ways.push('stand the tower on the floor beside the desk and leave out the tower shelf');
      problems.push({level:'stop',
        text:`A mid tower is up to ${fmt(R.towerTall)} tall and slides onto the tower shelf under the front apron, which is ${fmt(plan.knee.room)} off the floor. With the shelf ${fmt(v.towerUp)} up it does not fit under it.`,
        fix:capitalFirst(listWithOr(ways))+'.'});
    }
  }

  // ---- the tip check: the top drawer of each stack pulled all the way out, full ----
  // (worked out from the pieces, in computerDeskTip, so the plan itself stays free of them)

  // ---- the bay of the back apron over the knee space: the power strip, the cable tray and the cable holes ----
  plan.bay=deskStripBay(plan);
  // ---- the monitor shelf: its supports where a drill reaches their screws from under the top, clear of the cable
  // tray. The tray is laid out first, as long as the bay allows, and made shorter (never under the power strip's
  // bay, centered in its bay) until the supports find their places beside it; when none does, the supports are
  // placed alone and the tray takes what they leave (deskTray) ----
  if(v.riser){
    if(v.tray&&plan.bay){
      const whole=deskTray(plan);
      if(whole){
        const middle=(whole.x0+whole.x1)/2;
        for(let length=whole.x1-whole.x0;length>=DESK_RULES.strip.bayLeast-1e-6;length-=1){
          plan.tray=deskTray(plan,[middle-length/2,middle+length/2]);
          plan.riser=deskRiser(plan);
          if(!plan.riser.failed)break;
        }
      }
      if(!plan.riser||plan.riser.failed)plan.tray=null;
    }
    if(!plan.riser||plan.riser.failed)plan.riser=deskRiser(plan);
    if(plan.riser.failed){
      const near=deskRiserWidthsThatWork(plan);
      problems.push({level:'stop',
        text:`At this width the monitor shelf has no place for its supports where a drill held straight up under the top can reach their screws, with every bay short enough for the shelf.`,
        fix:near.length?`Make the shelf ${listWithOr(near.map(width=>typedLen(width)))} wide.`:v.riserPart?'Choose As wide as the desk, or leave out the monitor shelf.':'Leave out the monitor shelf.'});
    }
  }
  // ---- the cable tray: in that bay, stopping short of a shelf support's drill room (deskTray) ----
  if(v.tray){
    if(plan.bay&&!plan.tray)plan.tray=deskTray(plan);
    if(!plan.tray){
      // the fix names only what works: the least wider desk at which the tray fits (each width tried), and leaving
      // out the monitor shelf when that gives the tray its room
      let wider=0;
      for(let width=Math.floor(L)+1;width<=R.maxL&&!wider;width++)if(!computerDeskPlan({...raw,L:width}).problems.some(f=>f.tray))wider=width;
      const ways=[wider?`Make the desk ${typedLen(wider)} wide or more`:'',
        plan.riser&&!computerDeskPlan({...raw,riser:false}).problems.some(f=>f.tray)?'leave out the monitor shelf':'','leave out the cable tray'].filter(Boolean);
      problems.push({level:'stop',tray:true,
        text:`There is no room between the cross rails over the knee space${plan.riser?', beside the monitor shelf supports,':''} for a cable tray ${fmt(DESK_RULES.strip.bayLeast)} long.`,
        fix:capitalFirst(listWithOr(ways))+'.'});
    }
    // the tray reaches this far in from the back edge: in front of it the knees need their depth [22 l.54, l.261]
    if(plan.tray&&plan.tray.z1>W-R.kneeDepthLeast+1e-6){
      const deep=Math.ceil(plan.tray.z1+R.kneeDepthLeast-1e-6);
      problems.push({level:'stop',
        text:`The cable tray reaches ${fmt(plan.tray.z1)} in from the back edge of the top, so on a desk this shallow it would be in the ${fmt(R.kneeDepthLeast)} in front of that which your knees need.`,
        fix:(deep<=R.maxW?`Make the desk ${typedLen(deep)} deep or more, or leave`:'Leave')+' out the cable tray.'});
    }
  }
  // ---- the power strip: in the bay over the knee space nearest its middle (in the cable tray when there is one) ----
  if(v.strip)plan.strip=plan.bay?{...plan.bay,inTray:!!plan.tray,x:plan.tray?r16((plan.tray.x0+plan.tray.x1)/2):plan.bay.x}:null;
  // ---- the cable holes, over that bay, clear of the rails and the shelf supports ----
  if(v.holes){
    plan.holes=plan.bay?deskHoles(plan):null;
    if(!plan.holes){
      // the fix names only what works: each change is tried (one hole, the smaller hole, the least wider desk, the
      // cable tray, which moves the shelf supports off the bay, and leaving out the monitor shelf)
      const works=change=>!computerDeskPlan({...raw,...change}).problems.some(f=>f.holes||f.tray);
      let wider=0;
      for(let width=Math.floor(L)+1;width<=R.maxL&&!wider;width++)if(works({L:width}))wider=width;
      const ways=[v.holeN===2&&works({holeN:'1'})?'choose one cable hole':'',
        v.holeD>2&&works({holeD:'2'})?'choose 2" holes':'',
        wider?`make the desk ${typedLen(wider)} wide or more`:'',
        plan.riser&&!v.tray&&works({tray:true})?'tick the cable tray (the shelf supports then stand beside it)':'',
        plan.riser&&works({riser:false})?'leave out the monitor shelf':'',
        'leave out the cable holes'].filter(Boolean);
      problems.push({level:'stop',holes:true,
        text:`There is no place over the knee space, between the cross rails${plan.riser?' and clear of the monitor shelf supports':''}, for ${v.holeN===2?'two cable holes':'a cable hole'} ${fmt(v.holeD)} across.`,
        fix:capitalFirst(listWithOr(ways))+'.'});
    }
  }
  // ---- the cup holder, over the tower shelf near the front corner ----
  if(v.cup&&plan.tower){
    plan.cup=deskCupHolder(plan);
    if(plan.cup.problem)problems.push(plan.cup.problem);
  }
  // ---- the hook: on the end away from the drawers unless the person picked an end ----
  if(v.hook){
    const away=v.drawers==='left'?'right':'left';
    plan.hook={side:v.hookSide==='away'?away:v.hookSide};
    if(v.hookSide==='away')chose.push(`The hook is on the ${plan.hook.side} end${ends.length===1?', away from the drawers':''}.`);
  }
  // ---- the pictures of a monitor and a tower (after the hook: the tower picture keeps off the hook's end) ----
  if(v.props)plan.props=deskProps(plan);
  if(frame.apronWhy)chose.push(tableNotes('Desk',{L:v.L,W:v.W,H:v.H}).find(line=>/^The aprons are/.test(line))||'');
  return plan;
}
const capitalFirst=text=>text.charAt(0).toUpperCase()+text.slice(1);
const listWithOr=items=>items.length<2?items.join(''):items.slice(0,-1).join(', ')+', or '+items[items.length-1];

/* The drawers of one stack (drawerStackLayout, js/nightstand.js). With the open shelf under them, the drawer front
   height typed is kept and the stack takes as many drawers of that height as fit over the shelf (never more than
   asked): three drawers cut down to 5" fronts would be under 3" deep inside, which holds nothing. Only when one
   drawer of that height does not fit are the fronts made shorter. */
function deskStackLayout(zone,v,within){
  const quiet=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
  if(!zone.open)return drawerStackLayout(zone,{drawers:v.N,frontHeight:v.fh},within);
  const wanted=floor16(quiet(v.fh,NS.minFront,NS.maxFront));
  let drawers=v.N;
  while(drawers>1&&drawerStackLayout(zone,{drawers,frontHeight:v.fh},quiet).frontHeight<wanted-1e-6)drawers--;
  const layout=drawerStackLayout(zone,{drawers,frontHeight:v.fh},within);
  if(layout.drawers<v.N){
    layout.changed=layout.changed.filter(line=>!/^Only \d+ drawers? fits? above an open shelf/.test(line));
    layout.changed.unshift(`Only ${layout.drawers} drawer${layout.drawers>1?'s':''} with ${typedLen(layout.frontHeight)} fronts fit${layout.drawers>1?'':'s'} above the open shelf. Make the drawer front height smaller for more drawers, or leave out the open shelf.`);
  }
  return layout;
}

/* A person leaning on the top drawer, pulled all the way out (the drawer itself, empty): how many pounds pressed
   down on the front of it tip the desk forward about the front faces of the front legs. Everything else holds the
   desk down; nothing on the top is counted, which is the safe side. Rule of thumb, not engineered. */
const deskLeanMemo=new Map();
const computerDeskLean=p=>deskLeanOf(computerDeskPlan(p));
function deskLeanOf(plan){
  if(!plan.stacks.length)return Infinity;
  if(!deskLeanMemo.has(plan)){
    if(deskLeanMemo.size>200)deskLeanMemo.clear();
    const pieces=deskPieces(plan).filter(part=>!isProp(part)),edge=plan.W-plan.over;   // (the pictures weigh nothing)
    let least=Infinity;
    for(const stack of plan.stacks){
      const drawer=stack.layout.drawer,open=`Drawer ${stack.lastNumber}`;
      let holding=0,tipping=0;
      for(const part of pieces){
        const s=size(part),weight=s[0]*s[1]*s[2]*NS.plyDensity,middle=part.pos[2]+s[2]/2;
        if(part.sub===open)tipping+=weight*(middle+drawer.travel-edge);
        else holding+=weight*(edge-middle);
      }
      // the hand presses on the front face of the drawer front, pulled out by the drawer's travel
      const front=Math.max(...pieces.filter(part=>part.sub===open&&part.name==='Drawer front').map(part=>part.pos[2]+size(part)[2]));
      const lever=front+drawer.travel-edge;
      least=Math.min(least,(holding-tipping)/lever);
    }
    deskLeanMemo.set(plan,Math.floor(least));
  }
  return deskLeanMemo.get(plan);
}

/* The tower shelf at one end: {side, x0, x1 (its outside faces, left to right), width (inside, between its sides),
   up (floor to the top of the shelf), sideTall, z0, z1 (front to back, flush with the back and front faces of the
   legs)}. Its outer side stands against the inside faces of the two end legs. At the end without drawers; with
   no drawers at the end the person picks. */
function deskTowerShelf(plan){
  const R=DESK_RULES,v=plan.v,{L,W,over,leg}=plan,T=R.panel;
  const side=v.drawers==='right'?'left':v.drawers==='left'?'right':v.towerSide;
  const outside=v.towerW+2*T;
  const x0=side==='left'?over+leg:L-over-leg-outside;
  return{side,x0,x1:x0+outside,width:v.towerW,up:v.towerUp,sideTall:r16(v.towerUp+R.towerLip),z0:over,z1:W-over,
    // the x of the inner side (toward the knees) and of the outer side (against the legs)
    inner:side==='left'?x0+outside-T:x0,outer:side==='left'?x0:x0+outside-T};
}
/* The cross rails under the top, as the x of each one's left face: exactly the Desk's (tablePlan: evenly between
   the middles of the two short aprons, no more than the top may span between them). A design of stage 1 had a
   tower panel helping to carry the top and its rails spaced from it; the tower shelf stands on the floor and
   carries nothing of the top, so the rails are the plain Desk's again. */
function deskRails(plan){
  const f=plan.frame,rails=[];
  for(let i=1;i<=f.railCount;i++)rails.push(f.over+i*f.railStep);
  return rails;
}

/* The x ranges under the top that a drill held straight up cannot pass through, in the strip of depth z0..z1:
   legs, short aprons, cross rails, the sides of a drawer case and, in its own strip, the cable tray (laid out first
   and made shorter until the supports find their places beside it, deskPlanFresh; deskTray also keeps a drill's
   room off any support already placed). */
function deskDrillBlocks(plan,z0,z1){
  const blocks=[],{L,over,leg,apronT}=plan,overlapsZ=(a,b)=>a<z1&&b>z0;
  for(const x of[over,L-over-leg])for(const z of[over,plan.W-over-leg])if(overlapsZ(z,z+leg))blocks.push([x,x+leg]);
  if(overlapsZ(over+leg,plan.W-over-leg)){blocks.push([over,over+apronT]);blocks.push([L-over-apronT,L-over]);}
  for(const x of plan.rails)blocks.push([x,x+plan.frame.railT]);
  for(const s of plan.stacks){blocks.push([s.x0,s.x0+.75]);blocks.push([s.x1-.75,s.x1]);}
  if(plan.tray&&overlapsZ(plan.tray.z0,plan.tray.z1))blocks.push([plan.tray.x0,plan.tray.x1]);
  return blocks;
}
/* The monitor shelf and where its supports stand. The two end supports stand the same distance in from the ends of
   the shelf, the least that leaves a drill room to drive their screws up from under the top (CD18); the ones between
   split the rest into bays no longer than a 3/4" board may span under a shelf load (CD19), each moved off a cross
   rail, a case side or a panel where it lands on one, or one more support added. */
function deskRiser(plan){
  const R=DESK_RULES,v=plan.v,mat=v.riserBoard,depth=M[mat].w,supportLen=r16(depth-R.riserBack);
  const z0=R.riserBack,z1=depth,blocks=deskDrillBlocks(plan,z0,z1),room=R.drillRoom,t=.75;
  const clear=x=>blocks.every(([a,b])=>x+t+room<=a+1e-6||x-room>=b-1e-6);
  // the shelf: as wide as the desk, or the width typed, centered over the knee space (and kept on the desk)
  let length=plan.L,x0=0;
  if(v.riserPart&&v.riserW<plan.L){
    length=v.riserW;
    const middle=(plan.knee.lo+plan.knee.hi)/2;
    x0=r16(Math.min(plan.L-length,Math.max(0,middle-length/2)));
  }
  const x1=x0+length;
  let inset=R.riserEndLeast,endsFound=false;
  while(inset<length/2-2){
    if(clear(x0+inset)&&clear(x1-inset-t)){endsFound=true;break;}
    inset+=1/16;
  }
  inset=r16(inset);
  const left=r16(x0+inset),right=r16(x1-inset-t),maxBay=flatSpanLimit(.75,false,'shelf');
  let supports=null,moved=false;
  // the fewest bays that span (splitIntoBays, js/builders-storage.js), then one more at a time while a support
  // between them finds no place a drill reaches
  const fewest=splitIntoBays(left+t,right,t,maxBay).length;
  // First a layout that is the mirror image of itself about the middle of the shelf, the way a woodworker draws it
  // (the bays the same each side); only when none is found are the supports placed one by one (below).
  for(let count=fewest;count<fewest+6&&!supports;count++){
    const mirror=deskMirroredSupports({x0,x1,left,right,t,maxBay,count,clear});
    if(mirror){supports=mirror.supports;moved=mirror.moved;}
  }
  for(let count=fewest;count<fewest+6&&!supports;count++){
    const width=(right-left-t-(count-1)*t)/count,middles=[];
    for(let k=1;k<count;k++)middles.push(r16(left+t+k*width+(k-1)*t));
    const placed=[left];
    let ok=true;
    moved=false;
    for(const x of middles){
      let best=null;
      for(let shift=0;shift<=10&&best===null;shift+=1/16){
        for(const tryX of shift?[x-shift,x+shift]:[x]){
          const before=tryX-(placed[placed.length-1]+t);
          if(best===null&&clear(tryX)&&before<=maxBay+1e-6)best=r16(tryX);
        }
      }
      if(best===null){ok=false;break;}
      if(Math.abs(best-x)>1e-6)moved=true;
      placed.push(best);
    }
    if(ok&&right-(placed[placed.length-1]+t)<=maxBay+1e-6){placed.push(right);supports=placed;}
  }
  // No layout found: never built with a support nobody can screw, or a bay longer than the board spans. The warning
  // box refuses it and names a shelf width a step either way that works (deskRiserWidthsThatWork).
  const failed=!endsFound||!supports||right-left<t;
  if(failed)supports=[];
  if(moved&&!failed)plan.chose.push('A shelf support was moved off a cross rail or a case side, so its screws can be driven from under the top.');
  const overCase=supports.filter(x=>plan.stacks.some(s=>x>=s.x0+.75&&x+t<=s.x1-.75));
  return{mat,depth,length,x0,x1,inset,supports,supportLen,z0,y:plan.H+M[R.riserSupport].w,top:r16(plan.H+M[R.riserSupport].w+.75),
    rise:r16(M[R.riserSupport].w+.75),frontRoom:r16(plan.W-depth),overCase,part:v.riserPart&&v.riserW<plan.L,maxBay,failed};
}
/* Supports for `count` bays that mirror each other about the middle of the shelf: {supports (left faces, the two
   end ones included), moved}, or null. Each pair is moved apart or together by the same amount until both have a
   drill's room (clear), and a support in the very middle stays there; no bay may be longer than maxBay. */
function deskMirroredSupports({x0,x1,left,right,t,maxBay,count,clear}){
  const width=(right-left-t-(count-1)*t)/count,ideal=[];
  for(let k=1;k<count;k++)ideal.push(left+t+k*width+(k-1)*t);
  const between=new Array(count-1),twinOf=x=>x0+x1-x-t;
  let moved=false;
  for(let k=0;k<Math.floor((count-1)/2);k++){
    let found=null;
    for(let shift=0;shift<=10&&found===null;shift+=1/16){
      for(const x of shift?[ideal[k]-shift,ideal[k]+shift]:[ideal[k]]){
        if(found===null&&twinOf(x)>=x+t&&clear(x)&&clear(twinOf(x)))found=r16(x);
      }
    }
    if(found===null)return null;
    if(Math.abs(found-ideal[k])>1e-6)moved=true;
    between[k]=found;
    between[count-2-k]=r16(twinOf(found));
  }
  if((count-1)%2){
    const middle=r16((x0+x1-t)/2);
    if(!clear(middle))return null;
    between[(count-2)/2]=middle;
  }
  const supports=[left,...between,right];
  for(let i=1;i<supports.length;i++){
    const bay=supports[i]-supports[i-1]-t;
    if(bay<0||bay>maxBay+1e-6)return null;
  }
  return{supports,moved};
}
/* The nearest shelf widths, one narrower and one wider (whole inches, inside the limits), whose supports do find
   their places; [] when none does or the shelf is as wide as the desk. */
function deskRiserWidthsThatWork(plan){
  const v=plan.v,found=[];
  if(!v.riserPart)return found;
  const works=width=>!deskRiser({...plan,v:{...v,riserW:width},chose:[]}).failed;
  for(const step of[-1,1]){
    for(let width=Math.round(v.riserW)+step;width>=DESK_RULES.riserLeast&&width<=plan.L;width+=step){
      if(works(width)){found.push(width);break;}
    }
  }
  return found.sort((a,b)=>a-b);
}
/* The bay of the back apron the power strip goes in: between rails, long enough for the strip and 1" each side,
   over the knee space, the one whose middle is nearest the middle of the knee space. (With the cable tray, the
   tray is in this same bay and the strip lies in it: deskTray.) */
function deskStripBay(plan){
  const R=DESK_RULES.strip,{L,over,leg}=plan;
  const blocks=plan.rails.map(x=>[x,x+plan.frame.railT]);
  blocks.sort((a,b)=>a[0]-b[0]);
  const bays=[];
  let from=over+leg;
  for(const[a,b]of blocks){bays.push([from,a]);from=b;}
  bays.push([from,L-over-leg]);
  const kneeMiddle=(plan.knee.lo+plan.knee.hi)/2,half=R.length/2+R.clear;
  const fits=bays.filter(([a,b])=>b-a>=R.bayLeast-1e-6&&Math.min(b,plan.knee.hi)-Math.max(a,plan.knee.lo)>=R.bayLeast-1e-6);
  if(!fits.length)return null;
  fits.sort((p,q)=>Math.abs((p[0]+p[1])/2-kneeMiddle)-Math.abs((q[0]+q[1])/2-kneeMiddle));
  const[a,b]=fits[0],lo=Math.max(a,plan.knee.lo)+half,hi=Math.min(b,plan.knee.hi)-half;
  const x=r16(Math.min(hi,Math.max(lo,(a+b)/2)));
  return{x,bay:[a,b]};
}
/* The cable tray, in the bay of the strip, over the knee space only, stopping DESK_RULES.tray.ends short of the
   rails: {x0, x1, z0, z1 (the bottom board, back to front), y (the underside of the bottom), inside: [z, z] from
   the apron's face to the lip, lip: {z0, z1, y0, y1}}, or null when what is left is shorter than the power strip's
   bay (DESK_RULES.strip.bayLeast). A monitor shelf support standing over the bay is screwed up through the top
   there: the tray stops a drill's room (DESK_RULES.drillRoom) short of it, on the side that leaves the longer tray. */
function deskTray(plan,range){
  const R=DESK_RULES.tray,{over,apronT,legH,apronDepth}=plan,[a,b]=plan.bay.bay;
  const bottom=M[R.bottom],lip=M[R.lip];
  // range: optional, a shorter stretch of the bay the tray is held to (the monitor shelf's layout above)
  let x0=Math.max(a,plan.knee.lo)+R.ends,x1=Math.min(b,plan.knee.hi)-R.ends;
  if(range){x0=Math.max(x0,range[0]);x1=Math.min(x1,range[1]);}
  const z0=r16(over+apronT-R.lap),z1=r16(z0+bottom.w);
  if(plan.riser&&!plan.riser.failed&&plan.riser.z0<z1){
    for(const x of plan.riser.supports){
      const lo=x-DESK_RULES.drillRoom,hi=x+.75+DESK_RULES.drillRoom;
      if(hi<=x0||lo>=x1)continue;
      if(lo-x0>=x1-hi)x1=lo;else x0=hi;
    }
  }
  x0=r16(x0);x1=r16(x1);
  if(x1-x0<DESK_RULES.strip.bayLeast-1e-6)return null;
  const y=r16(legH-apronDepth-bottom.t);
  return{x0,x1,z0,z1,y,floor:r16(y+bottom.t),inside:[over+apronT,r16(z1-lip.t)],
    lip:{z0:r16(z1-lip.t),z1,y0:r16(y+bottom.t),y1:r16(y+bottom.t+lip.w)}};
}
/* The cable holes through the top: [{x, z, d}] (their middles, from the left end and the back edge of the top), or
   null when none fits. They are over the bay of the strip and the knee space (over the tray's inside, when there is
   a tray), their back edges just in front of the back apron, clear of the cross rails and of any monitor shelf
   support above them. One hole goes as near the middle of the bay as it may; two go side by side, `apart` between
   them, their pair as near the middle as it may. */
function deskHoles(plan){
  const R=DESK_RULES.holes,v=plan.v,d=v.holeD,r=d/2,count=v.holeN,[a,b]=plan.bay.bay;
  const z=r16(plan.over+plan.apronT+R.clear+r);
  // the room along the bay: inside the tray's ends, or clear of the rails at the ends of the bay
  const lo=plan.tray?plan.tray.x0+r:Math.max(a,plan.knee.lo)+R.railClear+r;
  const hi=plan.tray?plan.tray.x1-r:Math.min(b,plan.knee.hi)-R.railClear-r;
  // the monitor shelf supports stand on the top: each keeps the grommet's rim and a cord's room off it, measured
  // round the hole (deskHoleRoom), so the grommet sits flat, its cap lifts out and a cord comes in beside it
  const fits=middle=>middle>=lo-1e-6&&middle<=hi+1e-6&&deskHoleRoom(plan,{x:middle,z,d})>=0;
  const step=count===2?d+R.apart:0,middle=(lo+hi)/2;
  for(let shift=0;shift<=hi-lo+1e-6;shift+=1/16){
    for(const centre of shift?[middle-shift,middle+shift]:[middle]){
      const xs=count===2?[centre-step/2,centre+step/2]:[centre];
      if(xs.every(fits))return xs.map(x=>({x:r16(x),z,d}));
    }
  }
  return null;
}
/* How much room is left between a cable hole's grommet rim, with a cord's room (DESK_RULES.holes.railClear) round
   it, and the nearest monitor shelf support standing on the top, in plan: below 0 a support is on the rim or in the
   way of the cords. Infinity with no monitor shelf. (The self-check computerDeskStageTwo measures the same from the
   pieces and the grommet as it is drawn.) */
function deskHoleRoom(plan,hole){
  const R=DESK_RULES.holes,riser=plan.riser;
  if(!riser||riser.failed)return Infinity;
  const reach=hole.d/2+R.rim+R.railClear;
  let least=Infinity;
  for(const x of riser.supports){
    const dx=Math.max(x-hole.x,0,hole.x-(x+.75)),dz=Math.max(riser.z0-hole.z,0,hole.z-riser.depth);
    least=Math.min(least,Math.hypot(dx,dz)-reach);
  }
  return least;
}
/* The cup holder: a hole for a drop-in insert over the middle of the tower shelf, near the front, its edge `clear`
   behind the front apron's inside face. {x, z, d, deep, bottom (floor to the bottom of the insert), problem}. */
function deskCupHolder(plan){
  const R=DESK_RULES,C=R.cup,t=plan.tower,r=C.d/2;
  const x=r16((t.x0+R.panel+t.x1-R.panel)/2),z=r16(plan.W-plan.over-plan.apronT-C.clear-r);
  const bottom=r16(plan.H-C.deep),towerTop=r16(t.up+R.towerTall);
  const cup={x,z,d:C.d,deep:C.deep,bottom};
  // a cross rail or a leg under its place (in plan, with room for the insert's body)
  const near=([p,q])=>x+r+C.clear>p+1e-6&&x-r-C.clear<q-1e-6;
  const legs=[[plan.over,plan.over+plan.leg],[plan.L-plan.over-plan.leg,plan.L-plan.over]];
  if(plan.rails.some(rail=>near([rail,rail+plan.frame.railT]))||legs.some(near))
    cup.problem={level:'stop',text:'A cross rail or a leg is under the place of the cup holder, over the middle of the tower shelf.',fix:'Make the tower shelf narrower, or leave out the cup holder.'};
  // its insert hangs below the top: it must clear the tallest mid tower on the shelf
  else if(bottom<towerTop+C.below-1e-6){
    const highest=floor16(bottom-C.below-R.towerTall+1e-6);
    cup.problem={level:'stop',
      text:`The cup holder's insert hangs about ${fmt(C.deep)} below the top, down to ${fmt(bottom)} off the floor, and a mid tower up to ${fmt(R.towerTall)} tall on the tower shelf ${fmt(t.up)} up would reach ${fmt(towerTop)}.`,
      fix:highest>=R.towerUpLeast-1e-6?`Set the tower shelf ${typedLen(highest)} or less off the floor, or leave out the cup holder.`:'Leave out the cup holder.'};
  }
  return cup;
}
/* Where the pictures of a monitor and a computer tower stand (they weigh nothing, are not cut or bought and never
   count in a check): {monitor:{x, y, z} (the middle of its base's width, its base's underside and back), tower:
   {x0, y, z0} or null, why: the words when the tower is not shown}. The monitor stands on the monitor shelf when
   there is one, else on the top in front of the cable holes, over the middle of the knee space either way (in front
   of the chair [22 section 7, item 11], kept wholly on a narrower shelf). The tower stands on the tower shelf when
   there is one, else on the floor just past one end of the desk: the end away from the drawers, or with drawers at
   both ends the right end, and never the end the hook is on (a bag on the hook would hang against it). */
function deskProps(plan){
  const R=DESK_RULES,Mo=R.monitor,T=R.pcTower,{L,W,H}=plan;
  const riser=plan.riser&&!plan.riser.failed?plan.riser:null;
  let x=(plan.knee.lo+plan.knee.hi)/2;
  if(riser)x=Math.min(riser.x1-Mo.w/2,Math.max(riser.x0+Mo.w/2,x));
  x=r16(x);
  let z=Mo.fromBack;
  if(!riser&&plan.holes)z=Math.max(z,...plan.holes.map(hole=>hole.z+hole.d/2+.5));
  const monitor={x,y:riser?riser.top:H,z:r16(z),on:riser?'the monitor shelf':'the top'};
  let tower=null,why='';
  if(plan.tower){
    const t=plan.tower;
    tower={x0:r16((t.x0+t.x1)/2-T.w/2),y:t.up,z0:r16(t.z1-T.fromFront-T.deep),on:'the tower shelf'};
  }else{
    let side=plan.stacks.length===1&&plan.stacks[0].side==='left'?'right':plan.stacks.length===2?'right':'left';
    if(plan.hook&&plan.hook.side===side)side=side==='left'?'right':'left';
    const left=side==='left';
    tower={x0:left?-T.beside-T.w:L+T.beside,y:0,z0:r16(W-T.fromFront-T.deep),on:`the floor beside the ${side} end`};
  }
  return{monitor,tower,why};
}
/* the pieces of the pictures (props, js/core.js: drawn, never cut, bought or checked) */
function deskPropPieces(plan){
  const Mo=DESK_RULES.monitor,T=DESK_RULES.pcTower,parts=[],m=plan.props.monitor;
  parts.push(mk('Monitor stand','monitor',[Mo.baseW,Mo.baseTall,Mo.baseDeep],[m.x-Mo.baseW/2,m.y,m.z]));
  const screenBottom=m.y+Mo.lowest-Mo.screenTall;
  parts.push(mk('Monitor stand','monitor',[Mo.neckW,r16(screenBottom+Mo.screenTall/2-m.y-Mo.baseTall),Mo.neckDeep],[m.x-Mo.neckW/2,m.y+Mo.baseTall,m.z+Mo.neckDeep]));
  parts.push(mk('Monitor','monitor',[Mo.w,Mo.screenTall,Mo.screenDeep],[m.x-Mo.w/2,screenBottom,m.z+2*Mo.neckDeep]));
  const t=plan.props.tower;
  if(t)parts.push(mk('PC tower','pctower',[T.w,T.tall,T.deep],[t.x0,t.y,t.z0]));
  return parts;
}
/* the holes and the rounded corners of the top (js/shapes.js): measured from the left end and the back edge */
function deskShapeTop(plan,top){
  const v=plan.v,u=x=>r16(x-top.pos[0]),w=z=>r16(z-top.pos[2]);
  if(v.round)for(const corner of[1,3])cutCorner(top,corner,{cut:'round',r:DESK_RULES.cornerRadius});   // the two front corners
  for(const hole of plan.holes||[])addHole(top,{d:hole.d,use:'wire',at:{u:{from:0,d:u(hole.x)},v:{from:0,d:w(hole.z)}}});
  if(plan.cup&&!plan.cup.problem)addHole(top,{d:plan.cup.d,use:'cup',at:{u:{from:0,d:u(plan.cup.x)},v:{from:0,d:w(plan.cup.z)}}});
  return top;
}

/* ---------- the pieces ---------- */
function buildComputerDesk(p){
  return deskPieces(computerDeskPlan(p));
}
function deskPieces(plan){
  const v=plan.v,f=plan.frame,{L,W,H,legH,over,apronT}=plan;
  // the Desk's own top, legs and aprons; the cross rails are added here, where the plan put them
  const parts=buildTable({...f,railCount:0});
  // the cable holes, the cup holder and the rounded front corners are cut in the Desk's own top
  const top=parts.find(part=>part.name==='Top');
  if(top&&(v.round||plan.holes||plan.cup))deskShapeTop(plan,top);
  const railDepth=M[f.railMat].w;
  for(const x of plan.rails)parts.push(mk('Cross rail',f.railMat,[f.railT,railDepth,W-2*over-2*apronT],[x,legH-railDepth,over+apronT]));
  // (sizes that leave no knee space at all, which the warning box refuses, get the frame alone: the cases would overlap)
  if(plan.knee.width>0){
    if(plan.tower)parts.push(...deskTowerPieces(plan));
    for(const stack of plan.stacks)parts.push(...deskCasePieces(plan,stack));
  }
  const riser=plan.riser;
  if(riser&&!riser.failed){
    const supportM=M[DESK_RULES.riserSupport];
    for(const x of riser.supports)parts.push(mk('Monitor shelf support',DESK_RULES.riserSupport,[supportM.t,supportM.w,riser.supportLen],[x,H,riser.z0]));
    parts.push(mk('Monitor shelf',riser.mat,[riser.length,M[riser.mat].t,riser.depth],[riser.x0,riser.y,0]));
  }
  const tray=plan.tray;
  if(tray){
    const R=DESK_RULES.tray,bottom=M[R.bottom],lip=M[R.lip],length=r16(tray.x1-tray.x0);
    parts.push(mk('Cable tray bottom',R.bottom,[length,bottom.t,bottom.w],[tray.x0,tray.y,tray.z0]));
    parts.push(mk('Cable tray lip',R.lip,[length,lip.w,lip.t],[tray.x0,tray.lip.y0,tray.lip.z0]));
  }
  if(plan.props)parts.push(...deskPropPieces(plan));
  return parts;
}
/* The tower shelf: the shelf between its two sides, which stand on the floor and run front to back. */
function deskTowerPieces(plan){
  const t=plan.tower,T=DESK_RULES.panel,depth=t.z1-t.z0;
  return[
    mk('Tower shelf side','ply34',[T,t.sideTall,depth],[t.x0,0,t.z0]),
    mk('Tower shelf side','ply34',[T,t.sideTall,depth],[t.x1-T,0,t.z0]),
    mk('Tower shelf','ply34',[t.width,T,depth],[t.x0+T,t.up-T,t.z0])];
}
/* One drawer case and its drawers, the Nightstand's way: two sides to the floor, a bottom on a toe kick set back
   2", two top rails that lie under the long aprons (and are screwed up into them), a 1/4" back, the drawers. */
function deskCasePieces(plan,stack){
  const T=.75,w=plan.v.caseW,height=plan.caseHeight,inner=w-2*T,depth=stack.front-stack.sidesFrom,parts=[];
  const{x0,sidesFrom,front,layout}=stack;
  parts.push(
    mk('Side','ply34',[T,height,depth],[x0,0,sidesFrom]),
    mk('Side','ply34',[T,height,depth],[x0+w-T,0,sidesFrom]),
    mk('Bottom','ply34',[inner,T,depth],[x0+T,NS.kick,sidesFrom]),
    mk('Toe kick','ply34',[inner,NS.kick,T],[x0+T,0,front-NS.kickBack-T]),
    mk('Top rail','ply34',[inner,T,NS.rail],[x0+T,height-T,sidesFrom]),
    mk('Top rail','ply34',[inner,T,NS.rail],[x0+T,height-T,front-NS.rail]));
  if(plan.v.cub)parts.push(mk('Shelf','ply34',[inner,T,depth],[x0+T,NS.kick+T+layout.openHeight,sidesFrom]));
  parts.push(mk('Back panel','ply14',[w,height-NS.kick,DESK_RULES.backPanel],[x0,NS.kick,stack.back]));
  layout.fronts.forEach((bottom,index)=>parts.push(...buildDrawer(layout.openingOf(bottom),layout.drawerOptions(index))));
  return parts;
}

/* Will a full drawer pulled all the way out tip the desk forward, about the front faces of the front legs? The
   Nightstand's method (drawerTipFactor), for the top drawer of each stack. Returns the lowest {factor, load}. */
const deskTipMemo=new Map();
function computerDeskTip(p){
  const plan=computerDeskPlan(p);
  if(!plan.stacks.length)return{factor:Infinity,load:0};
  if(!deskTipMemo.has(plan)){
    if(deskTipMemo.size>200)deskTipMemo.clear();
    const pieces=deskPieces(plan).filter(part=>!isProp(part)),edge=plan.W-plan.over;   // (the pictures weigh nothing)
    let worst={factor:Infinity,load:0};
    for(const stack of plan.stacks){
      const tip=drawerTipFactor(pieces,stack.layout.drawer,edge,`Drawer ${stack.lastNumber}`,stack.zone.z);
      if(tip.factor<worst.factor)worst=tip;
    }
    deskTipMemo.set(plan,worst);
  }
  return deskTipMemo.get(plan);
}

/* ---------- the room check (R1-R4) ----------
   Each measurement the person filled in gives one finding: {fits, text, fix}. 0 means "not measured": nothing is
   said and nothing assumed.
   One way of writing a size in one sentence: a sentence that only compares boxes of the form (the width with the
   space, the height with the sill) speaks the way the boxes do (typedLen); a sentence that compares a box with a
   size the desk gives (the chair arms with the front apron, the chair with the knee space) is all in plain inches
   (fmt), the way the remark gives the knee space, so the same size never reads two ways. */
/* What to change when the desk is wider than the space (R1). Narrowing the desk to the space is the first answer,
   but at that width the drawers (or a tower space, or a monitor shelf of its own width) may no longer leave a knee
   space a chair fits: so the desk is tried again at the space's width, and when the warning box would refuse it
   there, the fix also names each change that makes it work at that width, each one tried. Returns
   {fix, tries}: tries are the form values each offered change gives (for the self-check computerDeskRoomWords). */
function deskSpaceFix(plan){
  const R=DESK_RULES,v=plan.v,raw=plan.raw||{};
  if(v.space<R.minL)return{fix:`This desk is at least ${typedLen(R.minL)} wide. Measure the space again, or find a wider spot.`,tries:[]};
  const width=Math.floor(v.space);
  const works=change=>!computerDeskCheck({...raw,room:false,L:width,...change}).some(f=>f.level==='stop');
  const narrower=`Make it ${typedLen(width)} wide or less`;
  if(works({}))return{fix:narrower+'.',tries:[{L:width}]};
  // the changes that may make it buildable at that width (the drawer case: the widest that works, in 1/2" steps
  // down to the narrowest the form allows; or the narrowest the form allows when none works alone)
  const candidates=[];
  if(v.drawers==='both')candidates.push({change:{drawers:'right'},words:'put the drawers at one end only'});
  if(v.drawers!=='none'){
    let caseW=R.caseMinW;
    for(let tried=v.caseW-.5;tried>=R.caseMinW-1e-6;tried-=.5)if(works({caseW:tried})){caseW=tried;break;}
    if(caseW<v.caseW)candidates.push({change:{caseW},words:`make the drawer case ${typedLen(caseW)} wide or less (under More options)`});
    candidates.push({change:{drawers:'none'},words:'choose No drawers'});
  }
  if(v.tower)candidates.push({change:{tower:false},words:'leave out the tower shelf'});
  if(v.riser&&v.riserPart)candidates.push({change:{riserSpan:'full'},words:'make the monitor shelf As wide as the desk'});
  // each change alone, each tried; when none works alone, two changes together (two that touch the same box, such as
  // the drawer case and No drawers, are not paired)
  let ways=candidates.filter(way=>works(way.change));
  if(!ways.length){
    for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
      const a=candidates[i],b=candidates[j];
      if(Object.keys(a.change).some(key=>key in b.change)||(a.change.caseW&&b.change.drawers)||(b.change.caseW&&a.change.drawers))continue;
      const change={...a.change,...b.change};
      if(works(change))ways.push({change,words:`${a.words} and ${b.words}`});
    }
  }
  if(!ways.length)return{fix:`At ${typedLen(width)} wide this desk cannot be built with the options ticked. Measure the space again, or find a wider spot.`,tries:[]};
  const knee=computerDeskPlan({...raw,room:false,L:width}).knee.width<R.kneeLeast-1e-6;
  const why=knee?'the knee space would be too narrow for a chair':'the options ticked would not fit';
  return{fix:`${narrower}. At that width ${why}, so also ${listWithOr(ways.map(way=>way.words))}.`,
    tries:ways.map(way=>({L:width,...way.change}))};
}
function deskRoomFindings(plan){
  const R=DESK_RULES,v=plan.v,found=[];
  if(!v.room)return found;
  if(v.space>0){
    const spare=r16(v.space-plan.L);
    if(spare>=0)found.push({fits:true,text:`The desk is ${typedLen(plan.L)} wide and your space ${typedLen(v.space)}: ${spare?`${typedLen(r16(spare/2))} to spare at each end when it is centered`:'it just fits, with nothing to spare'}.`});
    else found.push({fits:false,text:`The desk is ${typedLen(plan.L)} wide and your space is ${typedLen(v.space)}: it is ${typedLen(-spare)} too wide.`,
      ...deskSpaceFix(plan)});
  }
  if(v.sill>0){
    const spare=r16(v.sill-plan.H);
    if(spare>=R.sillRoom-1e-6){
      found.push({fits:true,text:`The top is ${typedLen(plan.H)} high and the underside of your sill is at ${typedLen(v.sill)}: the back of the desk tucks under it with ${typedLen(spare)} to spare.`});
      if(plan.riser&&plan.riser.top>v.sill)found.push({fits:true,text:`The monitor shelf stands ${fmt(r16(plan.riser.top-v.sill))} above the sill and covers the bottom of the window by that much.`});
    }else{
      const lowest=floor16(v.sill-R.sillRoom);
      found.push({fits:false,text:`The top is ${typedLen(plan.H)} high and the underside of your sill is at ${typedLen(v.sill)}, so the desk cannot slide under the sill: it will stand out from the wall by however far the sill sticks out.`,
        fix:lowest>=R.minH?`Make the desk ${typedLen(lowest)} high or lower, or measure how far the sill sticks out and leave that gap.`:`Measure how far the sill sticks out and leave that gap behind the desk (it cannot be made lower than ${typedLen(R.minH)}).`});
    }
  }
  if(v.arms>0){
    const apron=plan.knee.room,spare=r16(apron-v.arms);
    if(spare>=R.armRoom-1e-6)found.push({fits:true,text:`Your chair arms (${fmt(v.arms)}) slide under the front apron (${fmt(apron)}) with ${fmt(spare)} to spare.`});
    else{
      // What really gives the arms room: a higher top raises the apron with it (the desk goes to 30" at most);
      // otherwise the chair has to change. The front apron stays: it is what holds up the front edge of the top.
      const higher=r16(tablePlan(tableArgs('Desk',{L:plan.L,W:plan.W,H:R.maxH})).kneeRoom),fitsHigher=plan.H<R.maxH-1e-6&&higher-v.arms>=R.armRoom-1e-6;
      const lowest=r16(apron-R.armRoom);
      const fix=fitsHigher
        ?`Make the desk ${fmt(R.maxH)} high: the front apron is then ${fmt(higher)} off the floor. Or lower the chair until its arms are ${fmt(lowest)} or lower.`
        :`Lower the chair until its arms are ${fmt(lowest)} or lower, push the arms down or take them off if they adjust, or use a chair with lower arms. This desk keeps its front apron, which holds up the front edge of the top, so the room under it cannot be made higher than ${fmt(Math.max(apron,higher))}.`;
      found.push(spare>0
        ?{fits:false,text:`Your chair arms (${fmt(v.arms)}) only just pass under the front apron (${fmt(apron)} off the floor): ${fmt(spare)} to spare, so they may rub.`,fix}
        :{fits:false,text:`Your chair arms are ${fmt(v.arms)} high and the front apron is ${fmt(apron)} off the floor: the arms stop against it, ${fmt(-spare)} short, so the chair cannot pull in all the way.`,fix});
    }
  }
  if(v.chairW>0){
    const needed=v.chairW+2*R.chairSide,spare=r16((plan.knee.width-v.chairW)/2);
    if(plan.knee.width>=needed-1e-6)found.push({fits:true,text:`Your chair (${fmt(v.chairW)} across the arms) rolls into the ${fmt(plan.knee.width)} knee space with ${fmt(spare)} to spare at each side.`});
    else{
      // only the ways that really give the room: each is worked out
      const short=needed-plan.knee.width,stacks=plan.stacks.length,towerTakes=plan.tower?plan.tower.x1-plan.tower.x0:0;
      const wider=Math.ceil(plan.L+short-1e-6),narrowest=stacks?floor16(v.caseW-short/stacks+1e-6):0;
      const ways=[wider<=R.maxL?`make the desk ${typedLen(wider)} wide or more`:'',
        stacks&&narrowest>=R.caseMinW&&narrowest<v.caseW?`make the drawer case ${typedLen(narrowest)} wide or less (under More options)`:'',
        stacks===2&&v.caseW>=short-1e-6?'put the drawers at one end only':'',
        stacks&&stacks*v.caseW>=short-1e-6?'choose No drawers':'',
        plan.tower&&floor16(v.towerW-short+1e-6)>=R.towerInsideLeast&&floor16(v.towerW-short+1e-6)<v.towerW?`make the tower shelf ${typedLen(floor16(v.towerW-short+1e-6))} wide or less`:'',
        plan.tower&&towerTakes>=short-1e-6?'leave out the tower shelf':''].filter(Boolean);
      found.push({fits:false,text:plan.knee.width>v.chairW
          ?`Your chair is ${fmt(v.chairW)} across the arms and the knee space is ${fmt(plan.knee.width)} wide: it rolls in with less than ${fmt(R.chairSide)} each side and will knock the drawers or the legs.`
          :`Your chair is ${fmt(v.chairW)} across the arms and the knee space is ${fmt(plan.knee.width)} wide: it will not roll in.`,
        fix:capitalFirst(listWithOr(ways.length?ways:['use a narrower chair']))+'.'});
    }
  }
  return found;
}

/* ---------- the warning box ---------- */
function computerDeskCheck(p){
  const plan=computerDeskPlan(p),found=plan.problems.slice();
  if(found.some(f=>f.level==='stop'))return found;
  // the tip check (CD11)
  const tip=computerDeskTip(p);
  if(tip.factor<NS.tipStop)found.push({level:'stop',
    text:`At this size it would tip forward with the top drawer pulled all the way out and ${tip.load} lb in it.`,fix:'Make the desk deeper, or choose fewer or shorter drawers.'});
  else if(tip.factor<NS.tipWarn)found.push({level:'warn',
    text:`With the top drawer pulled all the way out and ${tip.load} lb in it, the desk stays up, but not by much.`,fix:'Make the desk deeper, or keep heavy things out of the top drawer.'});
  // a person leaning on the open top drawer (no size the form allows comes near it: the self-check records the least)
  const lean=computerDeskLean(p);
  if(lean<DESK_RULES.leanLoad)found.push({level:'stop',
    text:`About ${lean} lb pressed down on the front of the top drawer, pulled all the way out, would tip the desk forward. A person leaning on it, or a child standing on it, weighs more than that.`,
    fix:'Make the desk deeper, or choose wooden runners (the drawers come out less far).'});
  // the monitor shelf wider than the desk (CD17)
  if(plan.v.riser&&plan.v.riserPart&&plan.v.riserW>plan.L+1e-6)found.push({level:'stop',
    text:`The monitor shelf is ${typedLen(plan.v.riserW)} wide and the desk only ${typedLen(plan.L)}.`,fix:`Make the shelf ${typedLen(plan.L)} wide or less, or choose As wide as the desk.`});
  // the room (R1-R4): what does not fit is a warning, because only the person knows the room
  // (its own first word: "Marginal." would be wrong for a desk that is 4" too wide for the space)
  for(const finding of deskRoomFindings(plan))if(!finding.fits)found.push({level:'warn',word:'Does not fit.',text:finding.text,fix:finding.fix});
  return found;
}

/* ---------- the remark under the form ---------- */
const deskRunsOn=stack=>stack.layout.drawer.kind==='slide'?`${stack.layout.drawer.length}" slides`:`wooden runners ${stack.layout.drawer.length}" long`;
function deskStackWords(plan){
  if(!plan.stacks.length)return'';
  const s=plan.stacks[0],d=s.layout.drawer,count=s.layout.drawers;
  const where=plan.stacks.length===2?'at each end':`at the ${s.side} end`;
  const fronts=plan.v.style==='overlay'?`The fronts stand ${fmt(DRAWER.overlayStandoff)} proud of the legs.`:`The fronts sit inside the case, ${fmt(DRAWER.insetSetBack)} behind the front of the legs.`;
  return`${count} drawer${count>1?'s':''} ${where}, each ${fmt(d.boxWidth-1)} wide and ${fmt(r16(d.boxHeight-d.bottomThick))} deep inside, on ${deskRunsOn(s)}${plan.v.cub?`, over an open shelf ${fmt(s.layout.openHeight)} tall`:''}. ${fronts}`;
}
function deskKneeWords(plan){
  return`Knee space ${fmt(plan.knee.width)} wide, ${fmt(plan.knee.room)} high under the front apron and ${fmt(plan.knee.depth)} deep.`;
}
/* the notes of section 7 that apply, in their order (CD6, CD7, CD16, CD20-CD23); CD8 and CD24 go in the notes only */
function deskFormNotes(plan){
  const R=DESK_RULES,notes=[];
  if((plan.stacks.length||plan.tower)&&plan.knee.width<R.kneeEasy-1e-6&&plan.knee.width>=R.kneeLeast-1e-6){
    const easy=Math.ceil(plan.L+R.kneeEasy-plan.knee.width-1e-6);
    // (the knee width itself is the first line of the remark: not said twice)
    // (the Width is quoted the way its box shows it, in a sentence of its own)
    notes.push(`${fmt(R.kneeEasy)} or more of knee space lets a chair with arms swing in and out easily.${easy<=R.maxL?` A Width of ${typedLen(easy)} gives that.`:''}`);
  }
  if(plan.knee.room<TABLE_RULES.kneeRoom-1e-6)notes.push(`There is ${fmt(plan.knee.room)} of knee room under the aprons. Most chairs want about ${fmt(TABLE_RULES.kneeRoom)}, so try your chair first or raise the top.`);
  if(plan.tower)notes.push(`A full tower (about ${fmt(R.fullTower)} tall with its air space) does not fit under a ${typedLen(plan.H)} desk. Stand it on the floor beside the desk.`);
  if(plan.riser){
    if(plan.riser.frontRoom<R.roomInFront-1e-6)notes.push(`There is ${fmt(plan.riser.frontRoom)} of desk in front of the monitor shelf. About ${fmt(R.roomInFront)} leaves room for a keyboard and your forearms.`);
    const[low,high,on]=R.screenOnStand,raise=plan.H-on;
    // (all in plain inches: the sentence compares the desk's height with the screen heights)
    notes.push(`On a ${fmt(plan.H)} desk a 24" monitor on its own stand reaches ${fmt(r16(low+raise))} to ${fmt(r16(high+raise))} at its top; the shelf raises it ${fmt(plan.riser.rise)} more. The top of the screen is best ${fmt(R.screen[0])} to ${fmt(R.screen[1])} off the floor when you sit: lower the stand if it ends up higher.`);
  }
  if(plan.W<R.depthBest-1e-6)notes.push(`Computer desks are best ${fmt(R.depthBest)} deep; 24" is enough only without a monitor.`);
  if(plan.H<R.heightLeast-1e-6)notes.push(`HFES gives ${fmt(R.heightLeast)} as the lowest fixed desk. ${typedLen(plan.H)} suits a shorter person: try your chair.`);
  return notes;
}
function computerDeskInfo(p){
  const plan=computerDeskPlan(p);
  if(plan.problems.some(f=>f.level==='stop'))return'';
  const lines=[deskKneeWords(plan)];
  const stack=deskStackWords(plan);
  if(stack)lines.push(stack,...plan.changed);
  for(const finding of deskRoomFindings(plan))if(finding.fits)lines.push(finding.text);
  lines.push(...plan.chose.filter(Boolean));
  // What is typed is what is built (js/overallsizes.js): the Height is floor to the top of the desk, and a monitor
  // shelf stands on that top, so the piece as a whole is taller than the number typed. Say so, with the size.
  if(plan.riser&&!plan.riser.failed){
    // (the overall size is written as the "Overall size" line beside the form writes it; the Height is named, not
    // quoted, so the sentence never writes one size as its box does and another in plain inches)
    lines.push(`With the monitor shelf it comes out ${fmt(plan.riser.top)} tall overall instead of the Height typed: the top of the desk stays at that height and the shelf stands ${fmt(plan.riser.rise)} above it.`);
  }
  lines.push(tableTopWords('Desk','std'));
  const first=deskFormNotes(plan)[0];
  if(first)lines.push(first);
  // what the live picture does not draw (js/preview.js draws wood only)
  const placed=[plan.strip?'the power strip':'',plan.hook?'the hook':'',plan.holes?`the grommet${plan.holes.length>1?'s':''}`:'',plan.cup&&!plan.cup.problem?'the cup holder insert':''].filter(Boolean);
  if(placed.length)lines.push(`${capitalFirst(listWords(placed))} ${placed.length>1?'are':'is'} put in place when you create the design.`);
  if(plan.props&&plan.props.why)lines.push(plan.props.why);
  return lines.join(' ');
}

/* ---------- the notes ---------- */
function computerDeskNotes(p){
  const plan=computerDeskPlan(p),R=DESK_RULES,notes=[];
  // the Desk's own notes, but for the closing line about the load, which comes last
  const desk=tableNotes('Desk',{L:plan.v.L,W:plan.v.W,H:plan.v.H}).filter(line=>!/^Sized by rule of thumb/.test(line)&&!/knee room under the aprons/.test(line));
  notes.push(deskKneeWords(plan),...desk);
  if(plan.stacks.length){
    const s=plan.stacks[0],d=s.layout.drawer,all=plan.stacks.reduce((sum,stack)=>sum+stack.layout.drawers,0),pairs=`${all} pair${all>1?'s':''}`;
    notes.push(deskStackWords(plan));
    // what the plan changed by itself (fewer drawers over the open shelf, shorter slides on a shallow desk): said in
    // the notes as well as under the form, so the instructions explain why the count or the slides differ from the form
    notes.push(...plan.changed);
    notes.push(d.kind==='slide'
      ?`Drawer slides: buy ${pairs} of ${d.length}" side-mount ball-bearing slides. They need ${fmt(DRAWER.slideSide)} between the drawer box and the case on each side, and the drawer boxes here are cut for exactly that. If the package says a different gap, change the width of the drawer box front, back and bottom to match before you cut.`
      :`Wooden runners: the drawers ride on strips of wood ${fmt(DRAWER.runnerStrip)} by ${fmt(DRAWER.runnerStrip)}, ${d.length}" long, screwed to the case sides. Rip a 1x2 down the middle, or buy 3/4" square stock. The drawers come out ${fmt(r16(d.travel))}, about two thirds of their depth.`);
    notes.push(`The drawer case stands on the floor inside the legs, under the aprons, and is screwed up into the aprons through its top rails: it holds the drawers and carries nothing of the top.`);
    const tip=computerDeskTip(p);
    notes.push(`Tip check: the desk was checked with the top drawer pulled all the way out and ${tip.load} lb in it${tip.factor>=NS.tipWarn?', and it stays put with room to spare':'. It passes, but not by much'}.`);
    notes.push(`Leaning on an open drawer: about ${computerDeskLean(p)} lb pressed down on the front of the top drawer, pulled all the way out, would tip the desk forward. Do not stand or lean on an open drawer. If small children are around, fasten the desk to the wall with an anti-tip strap (a furniture strap sold with child-proofing things; it is not in the shopping list).`);
  }
  notes.push(...deskFormNotes(plan));
  notes.push(`The front apron leaves ${fmt(plan.knee.room)} for your legs and the chair arms. A tall person's thighs reach about ${fmt(R.thighTall)} when seated, so try your chair and your knees under it before you build: tick "Check it against my room" and fill in your chair's arm height.`);
  // CD24, what to do today: the person drills the one hole a through-the-desk mount needs. (A cable hole is not
  // offered for the arm's bolt: its middle is under 4" from the back edge, so a 3" plate centered on it would lie on
  // the back apron.)
  const armHole=plan.over+plan.apronT+DESK_RULES.armHoleClear;
  notes.push(`A monitor arm's clamp needs about 4" of clear wood under the back edge. The back apron is ${fmt(plan.over)} in from the edge, so a clamp will not fit. Use an arm with a through-the-desk mount instead: drill the one hole its instructions ask for through the top, about ${fmt(armHole)} in from the back edge, over the knee space and clear of the cross rails${plan.tray?' and of the cable tray':''}${plan.holes?' and the cable holes':''}, so its plate under the top sits clear of the back apron.${plan.riser?' The monitor shelf covers that part of the top, so with the shelf stand the monitor on it instead.':''}`);
  if(plan.tower){
    const carries=Math.floor(USES[computerDeskUses(plan.raw)['Tower shelf']].psf*plan.tower.width*(plan.tower.z1-plan.tower.z0)/144);
    notes.push(`Tower shelf: a low plywood stand under the ${plan.tower.side} end that the computer sits on, ${fmt(plan.tower.width)} wide inside and ${fmt(plan.tower.up)} off the floor, so its air intake stays off the carpet and out of the dust. Its front and back are open for the air. It stands on the floor on its own, not fastened to the desk: pull it out to reach the back of the computer, then push it back flush with the front legs. It was checked for ${carries} lb, more than the heaviest mid tower (about ${R.towerWeight} lb).`);
  }
  if(plan.holes)notes.push(`Cable holes: ${plan.holes.length>1?`${plan.holes.length} holes`:'one hole'} ${fmt(plan.holes[0].d)} across near the back of the top, over the knee space, each with a ${fmt(plan.holes[0].d)} grommet. ${plan.holes.length>1?'They are':'It is'} over open space only: no apron, cross rail, leg or drawer case under ${plan.holes.length>1?'them':'it'}${plan.tray?', only the inside of the cable tray':''}, so a plug drops straight through.${plan.riser?` The monitor shelf stands over the back of the top, its supports clear of the grommets: the cords of the keyboard, mouse and lamp reach ${plan.holes.length>1?'the holes':'the hole'} under the front of the shelf.`:''}`);
  if(plan.tray){
    const inside=fmt(r16(plan.tray.inside[1]-plan.tray.inside[0]));
    const above=fmt(r16(plan.legH-plan.tray.floor));
    notes.push(`Cable tray: a ${M[R.tray.bottom].short} under the back apron with a ${M[R.tray.lip].short} lip, ${fmt(r16(plan.tray.x1-plan.tray.x0))} long, under the cable holes. It is ${inside} wide inside and ${above} from its floor up to the underside of the top, and it holds ${plan.strip?'the power strip and ':''}the cords off the floor and out of the way of your knees.${plan.strip?` A power strip up to ${inside} wide lies in it, and so does a laptop or monitor power brick up to that width, at one end of the tray. With the strip lying outlets up there is about ${fmt(r16(plan.legH-plan.tray.floor-R.strip.out))} over it to the top: use flat or right-angle plugs.`:''}`);
  }
  if(plan.cup&&!plan.cup.problem)notes.push(`Cup holder: a drop-in insert in a ${fmt(plan.cup.d)} hole over the tower shelf, near the front. It hangs about ${fmt(plan.cup.deep)} below the top, above the tallest mid tower on the shelf. Buy one with a closed bottom (no drain hole): it hangs over the computer, and many computers breathe out of their top.`);
  if(plan.v.round)notes.push(`The two front corners of the top are rounded (${fmt(R.cornerRadius)} radius), so they do not catch a hip or a sleeve.`);
  if(plan.props)notes.push(`The monitor${plan.props.tower?' and the computer tower':''} in the picture show where ${plan.props.tower?'they go: they are':'it goes: it is'} not built, bought or counted as weight.${plan.props.why?' '+plan.props.why:''}`);
  if(plan.strip)notes.push(plan.strip.inTray
    ?`Power strip: any strip about ${fmt(R.strip.length)} long with keyhole slots on its back lies in the cable tray, outlets up, hung on two screws, so it lifts off to plug something in and the cords stay off the floor.`
    :`Power strip: any strip about ${fmt(R.strip.length)} long with keyhole slots on its back hangs on two screws low on the inside of the back apron, over the knee space, so the cords stay off the floor. Its screws go in under the pocket holes along the top of the apron.`);
  if(plan.hook)notes.push('Hook: a screw-on hook for headphones, low on the outside of one end, near the back, under the overhang of the top.');
  notes.push(`Edge banding: ${listWords(deskBandedEdges(plan))} get iron-on edge banding, so the layers of the plywood do not show.`);
  for(const finding of deskRoomFindings(plan))notes.push(finding.fits?finding.text:`${finding.text} ${finding.fix}`);
  notes.push(`Stand the desk about ${fmt(R.wallGap)} from the wall, so the cables can drop down behind it.`);
  notes.push('Sized by rule of thumb for a table or desk top: about 50 lb on every square foot of the top. Rule of thumb, not engineered.');
  return notes;
}

/* ---------- the shopping list lines it names itself ----------
   The slides (or runners) and the pulls are also placed in the model when the design is created, and what is placed
   is taken off these lines (hardwareRows, js/hardware.js). So are the power strip and the hook (afterPlace). */
function computerDeskHardware(p){
  const plan=computerDeskPlan(p),rows=[],R=DESK_RULES;
  const drawers=plan.stacks.reduce((sum,stack)=>sum+stack.layout.drawers,0);
  if(drawers){
    const d=plan.stacks[0].layout.drawer;
    if(d.kind==='slide')rows.push([`Drawer slides, ${d.length}" side-mount ball-bearing (pair)`,drawers]);
    rows.push(['Drawer pulls',drawers]);
    // the step that puts the pulls on asks for screws long enough to pass the drawer front and the box front:
    // what a step uses, the list buys (two per pull)
    rows.push([deskPullScrewLabel(),2*drawers]);
  }
  if(plan.strip){
    rows.push([HARDWARE.strip.buy(),1]);
    rows.push(['Round-head wood screws, #8 × 3/4", for the power strip',2]);
  }
  if(plan.hook)rows.push([HARDWARE.hook.buy(),1]);
  // a grommet for each cable hole, an insert for the cup holder (placed in the model too: afterPlace)
  if(plan.holes)rows.push([HARDWARE.grommet.buy(plan.holes[0].d),plan.holes.length]);
  if(plan.cup&&!plan.cup.problem)rows.push([HARDWARE.cupinsert.buy(),1]);
  rows.push([R.banding.label,Math.max(1,Math.ceil(deskBandingFeet(plan)/R.banding.roll-1e-6))]);
  return rows;
}
/* The pull screws: through the drawer front and the drawer box front, and 3/8" into the pull, to the next 1/4" up
   (the length the step's pull line asks for, pullLine in js/buildsteps.js). "screws" keeps the line off the pulls
   themselves (plainKinds, js/hardware.js), and its price row is 'pull-screws' in js/prices.js. */
function deskPullScrewLength(){
  return Math.ceil((DRAWER.frontThick+DRAWER.boxThick+DESK_RULES.pullScrewInPull)*4)/4;
}
const deskPullScrewLabel=()=>`Machine screws, #8-32 × ${fmt(deskPullScrewLength())}, for the drawer pulls (the ones in the package are too short)`;
/* The plywood edges a person sees, each banded: [{words, inches}].
   The top: its front edge and both ends. Each drawer front: all four edges. The tower shelf: the front edges of
   the shelf and its sides (the back edges face the wall).
   The drawer case: the front edges of its two sides always (below the bottom drawer front, along the gaps, and
   the inner side faces the knee space); with inset fronts also the front edges of the bottom panel and the front
   top rail, which frame the drawers; with the open shelf the front edges of the bottom panel and the shelf (an
   overlay front covers the shelf's edge, so then only the bottom panel's). */
function deskCaseEdges(plan){
  const edges=[];
  if(!plan.stacks.length)return edges;
  const inner=plan.v.caseW-1.5,stacks=plan.stacks.length,inset=plan.v.style==='inset',shelf=plan.v.cub;
  const each=stacks>1?' of each drawer case':' of the drawer case';
  edges.push({words:`the front edges of the two sides${each}`,inches:stacks*2*plan.caseHeight});
  if(inset||shelf)edges.push({words:`the front edge of its bottom panel`,inches:stacks*inner});
  if(inset)edges.push({words:'the front edge of its front top rail',inches:stacks*inner});
  if(inset&&shelf)edges.push({words:'the front edge of its open shelf',inches:stacks*inner});
  return edges;
}
function deskBandedEdgeList(plan){
  // (with the front corners rounded, one strip runs around each curve: a little shorter than the square corners)
  const list=[{words:plan.v.round?'the front edge and both ends of the top, around its rounded front corners':'the front edge and both ends of the top',inches:plan.L+2*plan.W}];
  let fronts=0;
  for(const stack of plan.stacks){
    const front=stack.layout.drawer.front;
    fronts+=stack.layout.drawers*2*(front.width+front.height);
  }
  if(fronts)list.push({words:'all four edges of each drawer front',inches:fronts});
  if(plan.tower)list.push({words:'the front edges of the tower shelf and of its two sides',inches:plan.tower.width+2*plan.tower.sideTall});
  return list.concat(deskCaseEdges(plan));
}
const deskBandedEdges=plan=>deskBandedEdgeList(plan).map(edge=>edge.words);
/* how many feet of edge banding the edges that show take, with 10% for the trimming */
function deskBandingFeet(plan){
  return deskBandedEdgeList(plan).reduce((sum,edge)=>sum+edge.inches,0)*1.1/12;
}

/* ---------- placing the power strip and the hook ---------- */
function computerDeskAfterPlace(ids,vals){
  const plan=computerDeskPlan(vals),pieces=ids.map(byId).filter(Boolean);
  const middle=piece=>{const b=plainBox(piece);return b.lo.map((v,k)=>(v+b.hi[k])/2);};
  // the plan measures from the left end and the back of the design; the pieces may have been placed elsewhere
  const top=pieces.find(piece=>piece.name==='Top');
  const shift=top?[plainBox(top).lo[0],0,plainBox(top).lo[2]]:[0,0,0];
  const tray=pieces.find(piece=>piece.name==='Cable tray bottom');
  if(plan.strip&&plan.strip.inTray&&tray){
    // in the cable tray: lying on its floor, outlets up, its length along the tray, in the middle of its inside
    const b=plainBox(tray),inside=plan.tray.inside;
    addOnFace('strip',tray,1,1,{along:0,offset:[plan.strip.x+shift[0]-middle(tray)[0],(inside[0]+inside[1])/2+shift[2]-middle(tray)[2]]});
  }else if(plan.strip){
    // the long apron at the back (the lower z), its inside face (+z), the strip running along it, its middle where the plan says
    const aprons=pieces.filter(piece=>piece.name==='Long apron').sort((a,b)=>plainBox(a).lo[2]-plainBox(b).lo[2]);
    const back=aprons[0];
    if(back){
      const x0=plainBox(back).lo[0];   // the plan measures from the left end of the design; the piece may have moved with it
      const shift=x0-(plan.over+plan.leg);
      // low on the apron, its bottom edge a little above the apron's: its screws go in under the pocket holes
      const stripRule=DESK_RULES.strip,low=plainBox(back).lo[1]+stripRule.lift+stripRule.tall/2;
      addOnFace('strip',back,2,1,{along:0,offset:[plan.strip.x+shift-middle(back)[0],low-middle(back)[1]]});
    }
  }
  if(plan.hook){
    const ends=pieces.filter(piece=>piece.name==='Short apron').sort((a,b)=>plainBox(a).lo[0]-plainBox(b).lo[0]);
    const apron=plan.hook.side==='left'?ends[0]:ends[ends.length-1];
    if(apron){
      // its plate 2" in front of the back leg: the back leg ends where the apron starts
      const z=plainBox(apron).lo[2]+DESK_RULES.hookFromLeg+DESK_RULES.hookPlate/2;
      // low on the apron: its plate a little above the apron's bottom edge, under the pocket holes (and under the
      // Rustic screws down through the top)
      const low=plainBox(apron).lo[1]+DESK_RULES.hookLift+DESK_RULES.hookTall/2;
      addOnFace('hook',apron,0,plan.hook.side==='left'?-1:1,{along:1,offset:[low-middle(apron)[1],z-middle(apron)[2]]});
    }
  }
  // a grommet in each cable hole and the insert in the cup holder hole, on the top face of the Top
  if(top){
    const inHole=(kind,x,z,size)=>addOnFace(kind,top,1,1,{size,along:0,offset:[x+shift[0]-middle(top)[0],z+shift[2]-middle(top)[2]]});
    for(const hole of plan.holes||[])inHole('grommet',hole.x,hole.z,hole.d);
    if(plan.cup&&!plan.cup.problem)inHole('cupinsert',plan.cup.x,plan.cup.z,plan.cup.d);
  }
}

/* ---------- the build steps ---------- */
/* the case pieces of one stack (a step brings each case in as one part) */
const deskCaseOf=stack=>piece=>DESK_CASE_NAMES.includes(piece.name)&&plainBox(piece).lo[0]>=stack.x0-.01&&plainBox(piece).hi[0]<=stack.x1+.01;
const deskDrawerBox=piece=>['Drawer box front','Drawer box back','Drawer side','Drawer bottom'].includes(piece.name);
function computerDeskSteps(p){
  const plan=computerDeskPlan(p),v=plan.v,R=DESK_RULES,stacks=plan.stacks,two=stacks.length===2;
  const desk=tableSteps(plan.frame);           // CUT, end frames, long aprons, cross rails (if any), the top, FIN
  const frameSteps=desk.slice(1,-1);
  const topIndex=frameSteps.findIndex(step=>step.add.includes('Top'));
  const steps=[CUT];
  // the holes and the rounded corners of the top are cut while it lies loose on the bench, before it is banded
  // and long before it goes on the frame (its drawing is in Shapes to cut)
  const topShapes=deskTopShapeStep(plan);
  if(topShapes)steps.push(topShapes);
  // the edges that show are banded while every piece is loose
  const roundBanding=v.round?` At the two rounded front corners, do not cut the banding: wrap it around each curve in one piece. Heat a few inches at a time, press it into the curve with a block of scrap wood and hold it there until it cools. If it lifts, heat it again and hold it longer; iron-on banding can pull away from a curve this tight, so if it keeps lifting, use a strip of self-stick banding at the corners instead (it is not on the shopping list): it bends round a tight curve more easily.`:'';
  steps.push({t:`Band the edges that show, while every piece is loose: iron edge banding onto ${listWords(deskBandedEdges(plan))}. Set a household iron to cotton with no steam, press the banding on with its glue side down, let it cool, then trim the overhang flush with an edge banding trimmer or a sharp chisel and ease the corners with sandpaper.${roundBanding}`,add:[]});
  frameSteps.forEach((step,index)=>{
    if(index===topIndex){
      steps.push(deskTopStep(plan,step));
      return;
    }
    steps.push(deskRailFaceStep(step));
  });
  // the cable tray goes on while the desk is upside down: its screws are driven down into the bottom edge of the apron
  if(plan.tray)steps.push(...deskTraySteps(plan));
  if(stacks.length)steps.push(...deskCaseSteps(plan));
  if(plan.riser)steps.push(...deskRiserSteps(plan));
  // the drawer boxes are built, then everything is sanded and finished while no hardware is on it; the slides,
  // the fronts and the pulls go on after the finish is dry
  const drawerSteps=stacks.length?deskDrawerSteps(plan):{boxes:[],afterFinish:[]};
  steps.push(...drawerSteps.boxes);
  // the tower shelf is a small piece of furniture of its own: built on the bench, finished with everything else
  if(plan.tower)steps.push(deskTowerShelfStep(plan));
  steps.push(FIN);
  steps.push(...drawerSteps.afterFinish);
  // (the power strip in the cable tray is listed in the tray's step, where its screws go in: here it is only hung)
  const stripInTray=plan.strip&&plan.strip.inTray;
  const hardware=[plan.holes?'grommet':'',plan.cup&&!plan.cup.problem?'cupinsert':'',plan.strip&&!stripInTray?'strip':'',plan.hook?'hook':''].filter(Boolean);
  if(hardware.length||stripInTray){
    const grommets=plan.holes?`Press a grommet into ${plan.holes.length>1?'each cable hole':'the cable hole'} and set its cap in with the slot toward the back.`:'';
    const cup=hardware.includes('cupinsert')?`Drop the cup holder insert into its hole. ${HARDWARE.cupinsert.mount.replace(/^Drop the insert into the hole so its rim sits flat on the top\. /,'')}`:'';
    const strip=!plan.strip?'':stripInTray
      ?`Hang the power strip on the two screws you drove in the cable tray bottom, outlets up, its keyhole slots over the screw heads: it lifts off them when you want to plug something in. Plug in the cords, lay them in the tray and run the strip's own cord out of the end of the tray, down behind the desk to the wall outlet. A plug pushed down through a cable hole lands in the tray beside the strip.`
      :`Hang the power strip on the inside face of the back apron, over the knee space, with its outlets facing you, low on the apron: its bottom edge ${fmt(DESK_RULES.strip.lift)} above the bottom edge of the apron, so its screws go in under the pocket holes along the top of the apron. ${HARDWARE.strip.mount}`;
    const hook=plan.hook?`Screw the hook to the outside face of the ${plan.hook.side} short apron, near the back of that end, under the overhang of the top, low on the apron: its plate ${fmt(DESK_RULES.hookLift)} above the bottom edge of the apron, so its screws stay clear of the screws that hold the top. ${HARDWARE.hook.mount}`:'';
    steps.push({t:[grommets,cup,strip,hook].filter(Boolean).join(' '),add:[],...(hardware.length?{hardware}:{})});
  }
  // the desk in its place; the tower shelf slides in under its end; the pictures show where the monitor and the
  // computer go (they are in this step so every piece of the design is in one)
  const tower=plan.tower?` Then slide the tower shelf in under the ${plan.tower.side} end, standing on the floor: its outer side against the inside faces of the two ${plan.tower.side} legs, its front edges flush with the front faces of the front legs. It is not fastened to the desk on purpose: pull it out when you need to reach the back of the computer, and push it back flush. Set the computer on it with its fan openings toward the front or the back, never against a side, and leave its back open for the air.`:'';
  const cables=plan.holes
    ?` Run the cables of what stands on the desk down through the cable hole${plan.holes.length>1?'s':''}${plan.tray?' into the cable tray':''}${plan.riser?` (under the monitor shelf: ${plan.holes.length>1?'the holes are':'the hole is'} under its back half, so the keyboard, mouse and lamp cords go in under the front of the shelf to ${plan.holes.length>1?'them':'it'}, and the monitor's own cables drop off the back of the shelf behind the desk)`:''}. The rest run over the back edge and under the back apron${plan.strip?' to the power strip':''}.`
    :` Run them over the back edge and under the back apron${plan.strip?' to the power strip':''}.`;
  const props=plan.props?` The monitor${plan.props.tower?' and the computer tower':''} in the picture only show where ${plan.props.tower?'they go':'it goes'}: nothing to build.`:'';
  steps.push({t:`Stand the desk in its place. Leave about ${fmt(R.wallGap)} between the back of the desk and the wall, so the cables can drop down behind it.${cables}${tower}${props}`,
    add:plan.props?['Monitor','Monitor stand','PC tower']:[]});
  return steps;
}
/* The step that cuts the cable holes, the cup holder hole and the rounded front corners of the top, while it lies
   loose on the bench (its drawing, measured from the left end and the back edge, is in Shapes to cut on the cut
   list page). The cutting step leaves the Top's shapes to it (shapes:['Top'], js/buildsteps.js). null: none. */
function deskTopShapeStep(plan){
  const v=plan.v,lines=[];
  if(!plan.holes&&!(plan.cup&&!plan.cup.problem)&&!v.round)return null;
  if(plan.holes){
    const d=fmt(plan.holes[0].d),many=plan.holes.length>1;
    lines.push(`Cut the ${many?`${plan.holes.length} cable holes`:'cable hole'} in the top, ${d} across, where Shapes to cut marks ${many?'their middles':'its middle'} (from the left end and the back edge of the top). Use a ${d} hole saw, the size of the grommet: lay the top good face up on two scrap boards, so the saw does not cut the bench, set the hole saw's pilot bit on the mark and drill straight down until the tip of the pilot bit pokes out underneath. Then turn the top over and finish the hole from the underside, from the pilot hole: the wood does not splinter on either face.`);
  }
  // (after the cable holes it is "the same way"; alone, the whole way is said)
  const cupD=plan.cup?fmt(plan.cup.d):'';
  if(plan.cup&&!plan.cup.problem)lines.push(plan.holes
    ?`Cut the cup holder hole, ${cupD} across, where Shapes to cut marks it, the same way: a ${cupD} hole saw from the good face until the pilot bit pokes through, then from the underside. Check that the insert drops in before you go on.`
    :`Cut the cup holder hole in the top, ${cupD} across, where Shapes to cut marks its middle (from the left end and the back edge of the top). Use a ${cupD} hole saw, the size of the insert: lay the top good face up on two scrap boards, so the saw does not cut the bench, set the hole saw's pilot bit on the mark and drill straight down until the tip of the pilot bit pokes out underneath. Then turn the top over and finish the hole from the underside, from the pilot hole: the wood does not splinter on either face. Check that the insert drops in before you go on.`);
  if(v.round)lines.push(`Round the two front corners of the top: set a compass to ${fmt(DESK_RULES.cornerRadius)} (or trace around a jar lid or a small can about ${fmt(2*DESK_RULES.cornerRadius)} across), put its point ${fmt(DESK_RULES.cornerRadius)} in from the front edge and the end, draw the curve, cut just outside the line with a jigsaw and sand to the line.`);
  lines.push('Sand the edges of the holes and the corners smooth. Do it now, while the top is a loose piece: once it is on the frame the aprons are in the way.');
  return{t:lines.join(' '),add:[],shapes:['Top']};
}
/* The cable tray: its lip screwed onto the bottom on the bench, then the tray onto the back apron while the desk is
   still upside down (the screws go down into the apron's bottom edge, where a drill reaches them easily). */
function deskTraySteps(plan){
  const t=plan.tray,R=DESK_RULES.tray,lap=fmt(R.lap);
  const fromLeft=fmt(r16(t.x0-plan.over));
  const build=`Build the cable tray and put it on. On the bench, stand the cable tray lip on edge along one long edge of the cable tray bottom, flush with that edge and with both ends; drill pilot holes through the bottom into the lip and drive the screws listed below that join them, with a bead of glue in the joint. `;
  // The power strip hangs on two screws in the tray's floor. Under the top a drill cannot stand on that floor, so
  // they go in now, on the bench, measured from the strip itself (its slots are on its back, so they cannot be
  // marked through); the strip is only hung on them in the last step.
  // (measured from the lip's outside face, the edge the hardware line below measures from too)
  const fromLip=fmt(r16(t.z1-(t.inside[0]+t.inside[1])/2));
  const strip=plan.strip&&plan.strip.inTray
    ?`Then, while the tray is still loose, put in the two screws the power strip hangs on. Measure from the middle of one keyhole slot on the back of the strip to the middle of the other. On the face of the tray bottom the lip stands on, draw a line ${fromLip} in from the outside face of the lip, and mark two points on it that far apart, the same distance each side of the middle of the tray's length. Drill small pilot holes there and drive the screws listed below for the power strip until their heads stand about 1/8" above the wood. `
    :'';
  const lay=`the bottom edge of the back apron faces up: lay the tray across it over the knee space, the lip hanging down inside the frame, with ${lap} of the tray bottom lying on the apron's edge: all of it, the tray's other long edge flush with the back face of the apron. Its left end is ${fromLeft} from the outside face of the left end frame (mark that on the apron first); its ends stop short of the cross rails, so the cords can come out of them. `+
    `Hold it there, drill pilot holes down through the middle of the ${lap} of tray bottom that lies on the apron, into its edge, and drive the screws listed below. When the desk stands up, the tray hangs under the back of the top, open at the top of its lip.`;
  // with no drawer case to set in next, nothing else goes in from below: the desk is turned over here
  const over=plan.stacks.length?'':' Then get a helper and turn the desk right side up.';
  return[{...styledStep({
    std:`${build}${strip}The desk is still upside down on its blanket, so ${lay}${over}`,
    rustic:`${build}${strip}Get a helper and turn the desk upside down on a blanket, so ${lay}${over}`},['Cable tray bottom','Cable tray lip']),
    ...(strip?{hardware:['strip']}:{})}];
}
/* A step's words changed in every style (its t and each of byStyle), and in its drill field too: the drill field
   holds sentences of those words exactly (taken out while step 2 "Drill your pieces" holds the holes, js/drillplan.js),
   so a sentence changed in the words must be changed there the same way or it would no longer be found. */
function deskStepWords(step,change){
  const changed={...step,t:change(step.t)};
  if(step.byStyle)changed.byStyle=Object.fromEntries(Object.entries(step.byStyle).map(([style,words])=>[style,change(words)]));
  if(step.drill)changed.drill=deskDrillWords(step.drill,change);
  return changed;
}
/* the drill field of a step (a string, a list, or per style {std, fine, rustic}) with each sentence changed */
function deskDrillWords(drill,change){
  if(typeof drill==='string')return change(drill);
  if(Array.isArray(drill))return drill.map(sentence=>deskDrillWords(sentence,change));
  return Object.fromEntries(Object.entries(drill).map(([style,sentences])=>[style,deskDrillWords(sentences,change)]));
}
/* The Desk's end-frame step drills the pocket holes that hold the top "along the top edge of the inside face of
   every apron and cross rail". A cross rail of this desk stands off the middle (two of them, or spaced from a tower
   panel), so the holes the fastener list gives are on whichever of its faces it names, not on an "inside" face:
   send the reader to that list instead of naming a face the list then contradicts. */
function deskRailFaceStep(step){
  return deskStepWords(step,words=>words.replace(' of every apron and cross rail, as many as',
    ' of every apron and along the top edge of each cross rail, on the face of the rail that the step fastening the top names, as many as'));
}
/* The tower shelf, built on the bench as one piece and slid in under its end of the desk: a beginner's order (the
   sides on edge, the shelf between them on two spacer blocks, the pocket screws from below, then in place). */
function deskTowerShelfStep(plan){
  const R=DESK_RULES,t=plan.tower,side=t.side;
  // built upside down: the sides stand on their top edges, the shelf lies face down between them on blocks as tall
  // as the sides stand above it, and its pocket screws are driven down from above
  const what=`Build the tower shelf, the low stand the computer sits on: the shelf between its two sides, with its top ${fmt(t.up)} above their bottom edges, so the sides stand ${fmt(R.towerLip)} above it and a foot cannot push the computer off. Build it upside down: stand the two sides on their top edges on the bench, ${fmt(t.width)} apart, and lay the shelf between them, good face down, on two scrap blocks ${fmt(R.towerLip)} tall, flush with their front and back edges.`;
  const drill=' Drill the pocket holes listed below in the underside of the shelf, near its two long edges, before it goes in.';
  const place=` It goes in under the ${side} end of the desk when the desk stands in its place (the last step). It stands on the floor on its own, so the computer's weight goes straight down to the floor and none of it hangs on the desk.`;
  return styledStep({
    std:`${what}${drill} Glue the joints and drive the pocket screws listed below down from the underside of the shelf into the sides, then turn it over.${place}`,
    rustic:`${what} Glue the joints, drill pilot holes, and drive the screws listed below through the outside of each side into the edges of the shelf.${place}`},['Tower shelf side','Tower shelf'],[drill]);
}
/* the Desk's own step for the top, told that the desk stays upside down when a drawer case or the cable tray goes
   in next */
function deskTopStep(plan,step){
  const withCase=plan.stacks.length>0,tray=!!plan.tray;
  const edit=words=>{
    let text=words;
    // the case is built in the steps that follow, while the frame waits upside down: say so, so a beginner does
    // not look for the case to go in at the very next step
    if(withCase){
      const cases=plan.stacks.length>1?'the two drawer cases':'the drawer case',many=plan.stacks.length>1;
      const own=many?'on their own':'on its own';
      text=text.replace(/ Turn it right side up\.$/,tray
        ?` Leave it upside down on the blanket: the cable tray goes on next, and then ${cases}, built ${own}, ${many?'go':'goes'} in from this side before the desk is turned over.`
        :` Leave it upside down on the blanket: the next steps build ${cases} ${own}, and ${many?'they go':'it goes'} in from this side before the desk is turned over.`);
    }else if(tray)text=text.replace(/ Turn it right side up\.$/,' Leave it upside down on the blanket: the cable tray goes on next.');
    return text;
  };
  const byStyle=step.byStyle||{std:step.t,rustic:step.t,fine:step.t};
  return styledStep({std:edit(byStyle.std),rustic:edit(byStyle.rustic),fine:edit(byStyle.fine)},step.add,step.drill);
}
function deskCaseSteps(plan){
  const v=plan.v,R=DESK_RULES,two=plan.stacks.length===2;
  const theCase=two?'each drawer case':'the drawer case',cases=two?'the two drawer cases, the same way':'the drawer case';
  const s=plan.stacks[0],shelfHeight=s.layout.openHeight;
  // each top rail lies partly under its apron: the screws that hold the case to the frame go in the middle of that
  // strip. Their holes are drilled while the rails are loose (the owner: make every piece first, then assemble),
  // not 2 ft deep inside the upside-down case.
  const backStrip=r16(plan.over+plan.apronT-s.sidesFrom),frontStrip=r16(s.front-(plan.W-plan.over-plan.apronT));
  const railLines=`${fmt(r16(backStrip/2))} in from the back edge of the back rail and ${fmt(r16(frontStrip/2))} in from the front edge of the front rail`;
  // (clearance holes for plain wood screws: step 2 "Drill your pieces" draws them (stage 2), so the sentence is the
  //  step's drill field of kind 'screw', left out while step 2 holds them: js/drillplan.js)
  const railHoles=` While the top rails are loose, drill a clearance hole for each screw that will hold the case to the aprons: through the rail, on a line ${railLines}, at the places the step that sets the case in gives, each countersunk on the underside.`;
  const steps=[];
  steps.push(styledStep({
    std:`Build ${cases}. Fasten the bottom between the two sides, ${fmt(NS.kick)} up from the floor, and the two top rails between the sides flush with the top: one flush with the front edge, one flush with the back edge. First drill the pocket holes listed below in the underside of the bottom and of each rail, near their ends.${railHoles} Then glue each joint and drive the pocket screws into the sides, so nothing shows on the outside.`,
    rustic:`Build ${cases}. Fasten the bottom between the two sides, ${fmt(NS.kick)} up from the floor, and the two top rails between the sides flush with the top: one flush with the front edge, one flush with the back edge.${railHoles} Glue each joint, drill pilot holes, and drive the screws through the outside of the sides into the ends of the bottom and the rails.`},['Side','Bottom','Top rail'],
    [' First drill the pocket holes listed below in the underside of the bottom and of each rail, near their ends.',{text:railHoles,kind:'screw'}]));
  steps.push(styledStep({
    std:`Fasten the toe kick under the bottom panel of ${theCase}, on edge, set back ${fmt(NS.kickBack)} from the front. Hold it to the bottom panel and to the sides with the pocket screws listed below, from holes drilled in its back face.`,
    rustic:`Fasten the toe kick under the bottom panel of ${theCase}, on edge, set back ${fmt(NS.kickBack)} from the front. Screw down through the bottom panel into its top edge, and through the sides into its ends.`},['Toe kick']));
  if(v.cub)steps.push(styledStep({
    std:`Fasten the open shelf between the sides, with its underside ${fmt(shelfHeight)} above the bottom panel. Drill the pocket holes listed below in its underside near each end. Cut two scrap blocks ${fmt(shelfHeight)} long, stand them on the bottom panel and rest the shelf on them while you drive the pocket screws into the sides.`,
    rustic:`Fasten the open shelf between the sides, with its underside ${fmt(shelfHeight)} above the bottom panel. Cut two scrap blocks ${fmt(shelfHeight)} long, stand them on the bottom panel and rest the shelf on them while you screw through the sides into its ends.`},['Shelf'],
    [' Drill the pocket holes listed below in its underside near each end.']));
  steps.push({t:`Lay ${theCase} on its front. Measure corner to corner both ways and push it until the two measurements match, then glue and nail the back panel on, flush with the outside of the sides and the top. It stops ${fmt(NS.kick)} above the floor, level with the underside of the bottom panel. The back is what keeps the case square, so do not skip the glue.`,add:['Back panel']});
  // set in: the case is brought in as one part, so the screws into the aprons belong to this step
  const where=two?'one at each end':`at the ${plan.stacks[0].side} end (${plan.stacks[0].side} as you sit at the desk)`;
  const front=v.style==='overlay'
    ?`the front edges of its sides ${fmt(R.overlaySetBack)} behind the front face of the front legs (hold a scrap of 3/4" plywood against the leg as a gauge)`
    :'the front edges of its sides flush with the front face of the front legs';
  // each top rail lies partly under its apron: its screws go in the middle of that strip, through the holes drilled
  // in the rails while they were loose
  const lines=`through the holes you drilled in the rails, each in the middle of the strip of rail that lies under the apron (${railLines})`;
  const setIn=`lower ${two?'each case':'the case'} in upside down ${where}, between the legs and under the aprons: its outer side against the inside faces of the two end legs, its back panel flush with the back faces of the back legs, and ${front}. Its two top rails lie on the long aprons. From inside the case, drive the screws listed below through each top rail into the apron, ${lines}. Then get a helper and turn the desk right side up: the case stands on the floor, and nothing of it is in the knee space.`;
  steps.push({...styledStep({std:`Set ${theCase} in. The desk is still upside down on its blanket from the step that put the top on: ${setIn}`,
    // (in Rustic the top step leaves the desk standing; the cable tray step, when there is one, turned it over)
    rustic:plan.tray?`Set ${theCase} in. The desk is still upside down on its blanket from the step that put the cable tray on: ${setIn}`
      :`Set ${theCase} in. Get a helper and turn the desk upside down on a blanket, then ${setIn}`},[]),bring:plan.stacks.map(deskCaseOf)});
  return steps;
}
function deskRiserSteps(plan){
  const r=plan.riser,places=r.supports.map(x=>fmt(r16(x))),many=places.length>1;
  const overCase=r.overCase.length?` For the support over the drawer case, reach in through the case, which has no drawers yet, and drive its screws up between the top rails.`:'';
  const supports={t:`Mark where each monitor shelf support stands on the top: their left faces ${listWords(places)} from the left end of the top, their back ends ${fmt(DESK_RULES.riserBack)} from the back edge, running front to back. Drill the pilot holes for the screws listed below straight down through the top, on the line where each support's bottom edge will sit. Spread wood glue on the bottom edge of each support (the glue is what keeps the shelf from swaying sideways), clamp it on its marks, on edge, square to the top, then from underneath drive the screws up through those holes into its bottom edge, so the heads are under the desk.${overCase}`,add:['Monitor shelf support']};
  const ends=r.part?`centered over the knee space: its left end ${fmt(r.x0)} from the left end of the top`:'with its ends flush with the ends of the top';
  const lay=`Spread wood glue on the top edge of each support and lay the monitor shelf on them, flush with the back edge of the top and ${ends}.`;
  const shelf=styledStep({
    std:`${lay} Drive the screws listed below down through the shelf into the top edge of each support: each head goes in a counterbore as deep as the list says, under a wooden plug glued in and cut flush when the glue is dry, so no screw shows on the shelf.`,
    rustic:`${lay} Drive the screws listed below down through the shelf into the top edge of each support, with the heads just below the surface.`},['Monitor shelf']);
  return[supports,shelf];
}
function deskDrawerSteps(plan){
  const v=plan.v,two=plan.stacks.length===2,s=plan.stacks[0],layout=s.layout,drawer=layout.drawer;
  const all=plan.stacks.reduce((sum,stack)=>sum+stack.layout.drawers,0),many=all>1;
  // the heights the steps quote, from the panel under the drawers (the Nightstand's nightstandHeights)
  const heights=nightstandHeights({underDrawers:layout.openingOf(layout.fronts[0]).y,drawer,fronts:layout.fronts,openingOf:layout.openingOf,
    kickerPairs:layout.kickerPairs,shelf:v.cub});
  const list=values=>values.map(value=>fmt(value)).join(', then ');
  const firstOnes=layout.drawers>1?' (bottom drawer first)':'';
  const inEach=two?' in each case':'';
  const steps=[];   // the slides, the fronts and the pulls: after the finish
  const boxes=[];   // the drawer boxes: before it, so they are finished with everything else
  boxes.push({t:`Build the ${all} drawer boxes, all the same. Stand the drawer box front and the drawer box back between the two drawer sides, so the sides cover their ends: ${drawer.kind==='slide'?'the slides will be screwed along the sides':'the sides ride on the runners, so they run the whole length'}. Glue each corner, then nail through the sides into the ends of the box front and the box back with brads (drill a thin pilot hole first if you use a hammer, so the plywood does not split). Check the box is square, then glue and nail the bottom on underneath, flush at the back and the sides. It stops ${fmt(DRAWER.bottomShy)} short at the front on purpose.`,
    add:['Drawer box front','Drawer box back','Drawer side','Drawer bottom']});
  if(drawer.kind==='slide'){
    steps.push({t:`Mount the slides. Each slide pulls apart into a case half and a drawer half. Screw a case half to the inside of each case side, level, with its front end ${fmt(drawer.slideFromEdge)} back from the front edge of the side and its middle at these heights above ${heights.panel}${inEach}: ${list(heights.hardware)}${firstOnes}. `+
      `Use a spacer block so the left and right slides come out at exactly the same height: start with the top pair, cut a scrap of plywood that holds the slide at its mark when it stands on ${heights.panel}, rest the slide on it against one side and screw it on, then do the same on the other side. Cut the block shorter for the next pair down. `+
      `Screw a drawer half along the middle of each drawer side, with its front end ${drawer.slideFromBoxFront>0?`${fmt(drawer.slideFromBoxFront)} back from`:'flush with'} the front of the box. Push each drawer in until the slides click together: it should run straight out, clear of the legs.`,add:[],hardware:['slide'],bring:[deskDrawerBox]});
  }else{
    steps.push({t:`Mount the runners. Each runner is a strip of wood ${fmt(DRAWER.runnerStrip)} by ${fmt(DRAWER.runnerStrip)} and ${drawer.length}" long. Screw one to the inside of each case side (no glue: it does not hold on the finish, and the screws are enough), level, with its front end ${fmt(drawer.slideFromEdge)} back from the front edge of the side and its top edge at these heights above ${heights.panel}${inEach}: ${list(heights.hardware)}${firstOnes}. The lowest pair lies on ${heights.panel}. `+
      `Use a spacer block so the left and right runners come out at exactly the same height. `+
      (heights.kickers.length?`Then screw a kicker strip, the same size, to each side above every drawer but the top one, with its underside ${list(heights.kickers)} above ${heights.panel}: it keeps an open drawer from tipping down. The top drawer needs none, because the top rails do that job. `
        :`No kicker strips are needed: the runners of the drawer above keep a drawer from tipping down when it is open, and the top rails do that for the top drawer. `)+
      `Rub the tops of the runners with candle wax, then slide each drawer in. The fit is right when it moves freely with about ${fmt(DRAWER.runnerSide)} of play on each side.`,add:[],hardware:['runner','kicker'],bring:[deskDrawerBox]});
  }
  const pulls=`Then drill for the pull in the middle of each front and screw it on from inside the drawer with the ${fmt(deskPullScrewLength())} machine screws on the shopping list: the short ones in the package do not reach through the front and the box.`;
  if(v.style==='overlay'){
    steps.push({t:`Put the drawer fronts on last, starting with the bottom one${two?' of each case':''}. Hold the front against the drawer box so it covers the edge of the bottom panel below it, ${fmt(NS.frontReveal)} in from the outside of each case side, with a ${fmt(DRAWER.frontGap)} gap between fronts (two stacked nickels make a good spacer). Clamp it or stick it with double-sided tape, open the drawer, and drive the short screws listed below from inside the drawer, through the drawer box front into the back of the drawer front. Do not use longer screws here: they would come out through the face. Work up, keeping the same gap. ${pulls}`,add:['Drawer front']});
  }else{
    steps.push({t:`Put the drawer fronts on last, starting with the bottom one${two?' of each case':''}. An inset front sits inside the case, ${fmt(DRAWER.insetSetBack)} behind the front edges of its sides, with a ${fmt(DRAWER.frontGap)} gap all around: stand it on two stacked nickels and put two more at each end. Stick it to the drawer box with double-sided tape, open the drawer, and drive the short screws listed below from inside the drawer, through the drawer box front into the back of the drawer front. Do not use longer screws here: they would come out through the face. Work up, keeping the same gap between fronts. ${pulls}`,add:['Drawer front']});
  }
  return{boxes,afterFinish:steps};
}

/* ---------- what each piece is for, and the fasteners it names ---------- */
const computerDeskUses=p=>{
  const bottom=p&&p.cub&&p.drawers!=='none'?'shelf':'general';
  return{...tableUses('Desk'),'Bottom':bottom,'Toe kick':bottom,'Shelf':'shelf','Side':'none','Top rail':'none','Back panel':'none',
    'Drawer bottom':DRAWER.bottomUse,'Drawer box front':DRAWER.bottomUse,'Drawer box back':DRAWER.bottomUse,'Drawer side':DRAWER.bottomUse,
    'Monitor shelf':'shelf','Monitor shelf support':'shelf','Tower panel':'tableTop',
    // the tower shelf carries the computer: checked as a loaded storage shelf, more than the heaviest mid tower
    // (DESK_RULES.towerWeight); its sides stand on the floor and carry nothing of their own
    'Tower shelf':'shelf','Tower shelf side':'none',
    // the cable tray carries a power strip and cords: light things
    'Cable tray bottom':'general','Cable tray lip':'none'};
};
/* The frame keeps the Desk's own fasteners (TABLE_HOUSE_JOINTS). In Everyday and Fine furniture no head shows on the
   top, the front, the sides, the drawer fronts or the monitor shelf (README, "Show faces"). */
const COMPUTER_DESK_JOINTS=[
  // pieces that only touch: the case stands on the floor beside the legs and under the aprons
  ['Side','Leg','none'],['Side','Long apron','none'],['Side','Short apron','none'],['Side','Cross rail','none'],['Top rail','Cross rail','none'],
  ['Back panel','Leg','none'],['Back panel','Long apron','none'],['Back panel','Cross rail','none'],['Tower panel','Cross rail','none'],
  ...tableJoints('Desk'),...DRAWER_JOINTS,
  // the case: nothing through its sides (the inner one faces the knee space), the Nightstand's way
  ...CASE_SIDE_JOINTS,['Bottom','Toe kick','pocketUnlessRustic'],
  // what holds the case to the frame: screws up through its top rails into the aprons, heads inside the case
  ['Top rail','Long apron','screw'],
  // the tower panel of a design saved before the tower shelf (stage 1): pocket holes on its knee-side face, into the
  // top and the aprons (Rustic screws through them). No design made today has one.
  ['Tower panel','Top','pocketUnlessRustic'],['Tower panel','Long apron','pocketUnlessRustic'],
  // the tower shelf: the shelf held between its two sides by pocket screws from its underside (Rustic: screws in
  // through the sides); it only stands beside the legs
  ['Tower shelf','Tower shelf side','pocketUnlessRustic'],['Tower shelf side','Leg','none'],
  // the cable tray: its bottom screwed up into the bottom edge of the back apron, its lip screwed on from under the
  // bottom; heads on the underside, at the back, where nobody looks
  ['Cable tray bottom','Long apron','screw'],['Cable tray lip','Cable tray bottom','screw'],
  // the monitor shelf: its supports screwed up through the top from underneath, the shelf screwed down under plugs
  ['Monitor shelf support','Top','screw'],['Monitor shelf','Monitor shelf support','pluggedUnlessRustic']];

PRESETS.push({
  name:'Computer desk',tile:'Computer desk',spec:'Drawers and a knee space',icon:'i-presets',hidden:true,
  desc:'The plain Desk with a stack of drawers on real slides at one end and an open knee space for the chair. Every other option is a check box, most of them under More options.',
  params:[
    num('L','Width (left to right; measure the space you have)',COMPUTER_DESK_DEFAULTS.L,DESK_RULES.minL,DESK_RULES.maxL),
    num('W','Depth (front to back)',COMPUTER_DESK_DEFAULTS.W,DESK_RULES.minW,DESK_RULES.maxW),
    num('H','Height (floor to the top; most desks are 29" to 30")',COMPUTER_DESK_DEFAULTS.H,DESK_RULES.minH,DESK_RULES.maxH),
    {k:'drawers',label:'Drawers',opts:DESK_DRAWER_CHOICES,v:COMPUTER_DESK_DEFAULTS.drawers},
    {k:'riser',label:'Monitor shelf across the back',check:1,v:false},
    ...under('riser',[
      {k:'riserBoard',label:'Shelf depth',opts:Object.entries(DESK_RULES.riserBoards),v:COMPUTER_DESK_DEFAULTS.riserBoard},
      {k:'riserSpan',label:'Shelf width',opts:[['full','As wide as the desk'],['part','Narrower, centered over the knee space']],v:COMPUTER_DESK_DEFAULTS.riserSpan},
      ...under('riserSpan',[num('riserW','Width of the shelf',COMPUTER_DESK_DEFAULTS.riserW,DESK_RULES.riserLeast,DESK_RULES.maxL)],value=>value==='part')]),
    {k:'strip',label:'Power strip under the back of the top',check:1,v:false},
    {k:'room',label:'Check it against my room',check:1,v:false},
    ...under('room',[
      num('space','Space for the desk (wall to wall, or what you have; 0 = not measured)',0,0,DESK_RULES.roomMost.space),
      num('sill','Window sill (floor to the underside of the sill; 0 = no window)',0,0,DESK_RULES.roomMost.sill),
      num('arms','Chair arms (floor to the top of the arm pad; 0 = not measured)',0,0,DESK_RULES.roomMost.arms),
      num('chairW','Chair width (across the arms; 0 = not measured)',0,0,DESK_RULES.roomMost.chairW)]),
    // under "More options" (the catalog entry's short list leaves these out)
    ...[{k:'N',label:'Drawers in each stack',opts:[['2','2'],['3','3'],['4','4']],v:COMPUTER_DESK_DEFAULTS.N},
      {k:'cub',label:'Open shelf under the drawers',check:1,v:false},
      ...under('cub',[num('fh','Drawer front height (with the open shelf)',COMPUTER_DESK_DEFAULTS.fh,NS.minFront,NS.maxFront)]),
      num('caseW','Drawer case width (outside; the knee space gets narrower)',COMPUTER_DESK_DEFAULTS.caseW,DESK_RULES.caseMinW,DESK_RULES.caseMaxW),
      {k:'slides',label:'Drawers run on',opts:[['slide','Metal slides'],['runner','Wooden runners']],v:COMPUTER_DESK_DEFAULTS.slides},
      {k:'fronts',label:'Drawer fronts',opts:[['overlay','Over the case edges, flush with the legs'],['inset','Inside the case']],v:COMPUTER_DESK_DEFAULTS.fronts}]
      .map(row=>({...row,show:p=>p.drawers!=='none'&&(row.show?row.show(p):true)})),
    // stage 2: every option a box, off; its own rows show only while it is ticked
    {k:'tower',label:'Tower shelf at one end (a low shelf the computer sits on)',check:1,v:false,show:p=>p.drawers!=='both'},
    ...under('tower',[{k:'towerSide',label:'Tower shelf at the',opts:[['left','Left end'],['right','Right end']],v:COMPUTER_DESK_DEFAULTS.towerSide,show:p=>p.drawers==='none'},
      num('towerW','Tower shelf width (inside; a mid tower is about 9 1/2" wide)',COMPUTER_DESK_DEFAULTS.towerW,DESK_RULES.towerInsideLeast,DESK_RULES.towerInsideMost),
      num('towerUp','Height off the floor (top of the shelf; keeps the air intake off the carpet and out of the dust)',COMPUTER_DESK_DEFAULTS.towerUp,DESK_RULES.towerUpLeast,DESK_RULES.towerUpMost),
      {k:'cup',label:'Cup holder over the tower shelf',check:1,v:false}]),
    {k:'holes',label:'Cable holes in the top, with grommets',check:1,v:false},
    ...under('holes',[{k:'holeN',label:'How many holes',opts:[['1','1'],['2','2']],v:COMPUTER_DESK_DEFAULTS.holeN},
      {k:'holeD',label:'Hole size (the grommet\'s size)',opts:DESK_RULES.holes.sizes,v:COMPUTER_DESK_DEFAULTS.holeD},
      {k:'tray',label:'Cable tray under the holes (a power strip can lie in it)',check:1,v:false}]),
    {k:'round',label:'Round the front corners of the top',check:1,v:false},
    {k:'props',label:'Show a monitor and a tower (pictures only)',check:1,v:false},
    {k:'hook',label:'Hook for headphones',check:1,v:false},
    ...under('hook',[{k:'hookSide',label:'Hook on the',opts:[['away','End away from the drawers'],['left','Left end'],['right','Right end']],v:COMPUTER_DESK_DEFAULTS.hookSide}])],
  build:buildComputerDesk,check:computerDeskCheck,info:computerDeskInfo,notes:computerDeskNotes,steps:computerDeskSteps,hw:computerDeskHardware,
  // the preset rule: what each piece carries, and that the drawer sides hang on their slides until the slides are placed
  uses:computerDeskUses,hung:['Drawer side'],joints:COMPUTER_DESK_JOINTS,afterPlace:computerDeskAfterPlace,
  // every other layout the structural check must also pass at every limit (none ticks "Check it against my room")
  variants:[{drawers:'left'},{drawers:'both',L:72},{drawers:'none'},{N:'2'},{N:'4'},{cub:true},{slides:'runner'},{fronts:'inset'},
    {riser:true},{riser:true,riserBoard:'1x12',riserSpan:'part'},{drawers:'none',tower:true},{drawers:'none',tower:true,towerSide:'right'},
    {strip:true,hook:true},
    // stage 2: the tower shelf (with the cup holder and at its other end), the cable holes and the tray, the
    // rounded corners, the pictures, and the Gaming desk's start
    // (each variant builds at some corner of the sizes: computerDeskVariantsBuild)
    {tower:true,cup:true,L:72},{drawers:'none',tower:true,towerW:16,towerUp:5},{drawers:'none',tower:true,towerSide:'right',cup:true,props:true},
    {holes:true},{holes:true,riser:true},{holes:true,riser:true,drawers:'both',L:72},
    {holes:true,holeN:'2',holeD:'2.5',tray:true,strip:true},{holes:true,holeN:'2',holeD:'2.5',tray:true,riser:true,drawers:'left',L:72},
    {holes:true,holeN:'2',tray:true,riser:true,drawers:'none'},
    {round:true},{props:true},{props:true,riser:true,drawers:'none'},
    {L:72,riser:true,strip:true,tower:true,hook:true,holes:true,holeN:'2',tray:true,round:true,props:true}],
});
/* the start of the Gaming desk entry (js/catalog.js): the same builder with the options shown off (stage 2: the two
   cable holes with the tray and the power strip in it, the rounded front corners and the pictures of a monitor
   and a tower) */
const GAMING_DESK_START={L:72,riser:true,strip:true,tower:true,hook:true,holes:true,holeN:'2',tray:true,round:true,props:true};
/* its own description (the tile's tooltip and the line over the form): what it starts with, and where the options
   that are ticked but folded away are */
const GAMING_DESK_WORDS='A 6 ft Computer desk set up for gaming: monitor shelf, drawers at the right, a tower shelf at the left, two cable holes over a cable tray with the power strip in it, rounded front corners, a headphone hook and pictures of a monitor and a tower (most of them under More options).';
/* the rows the form shows at once; the rest are under "More options" (entry.short, js/presetentry.js) */
const COMPUTER_DESK_SHORT=['L','W','H','drawers','riser','riserBoard','riserSpan','riserW','strip','room','space','sill','arms','chairW'];

/* ---------- self-checks (selfTest runs every function in SELFTESTS) ---------- */
const deskPreset=()=>PRESETS.find(preset=>preset.name==='Computer desk');
const deskCorners=()=>{
  const R=DESK_RULES,list=[];
  for(const L of[R.minL,R.maxL])for(const W of[R.minW,R.maxW])for(const H of[R.minH,R.maxH])list.push({L,W,H});
  return list;
};
const deskVariants=()=>{
  const preset=deskPreset();
  return[{}].concat(preset.variants).map(variant=>({...presetDefaults(preset),...variant}));
};
/* The form as first opened shows no more than eight rows (the owner: "i dont want to overwhelm the user"); a ticked
   option shows its own rows, indented, and unticked hides them again. */
SELFTESTS.push(function computerDeskFormIsShort(problems){
  const wrong=text=>problems.push('computer desk form: '+text);
  if(typeof catalogPick!=='function')return;
  const kept={picked:catalogState.picked,typed:{...catalogState.typed},preset:curPreset,entry:curEntry};
  const shownRows=()=>[...document.querySelectorAll('#presetForm .frow')].filter(row=>!row.hidden&&!row.closest('[hidden]'));
  try{
    for(const id of['computer-desk','gaming-desk']){
      if(!catalogPick(id,{fresh:true})){wrong(`the ${id} entry cannot be picked`);continue;}
      readVals(false);
      // the Gaming desk starts with the monitor shelf ticked, so its two rows show as well
      const count=shownRows().length,most=id==='computer-desk'?8:10;
      if(count>most)wrong(`${id} opens with ${count} rows; the owner asked for a short form (${most} at most)`);
      if(id!=='computer-desk')continue;
      const box=key=>$(`#presetForm [data-k="${key}"]`),row=key=>box(key)&&box(key).closest('.frow');
      if(!$('#presetForm .pform-more'))wrong('the drawer details, the tower space and the hook are not under "More options"');
      if(shownRows().some(r=>r.classList.contains('sub')))wrong('a row of an option that is not ticked is shown');
      box('riser').checked=true;readVals(false);
      if(['riserBoard','riserSpan'].some(key=>row(key).hidden||!row(key).classList.contains('sub')))wrong('ticking the monitor shelf does not show its own rows, indented');
      if(!row('riserW').hidden)wrong('the shelf width box shows while the shelf is as wide as the desk');
      box('riserSpan').value='part';readVals(false);
      if(row('riserW').hidden)wrong('choosing a narrower shelf does not show its width');
      box('riser').checked=false;readVals(false);
      if(['riserBoard','riserSpan','riserW'].some(key=>!row(key).hidden))wrong('unticking the monitor shelf leaves its rows showing');
      // the stage 2 boxes (in the fold): each hides its own rows until it is ticked, and they are indented
      for(const[key,rows]of[['tower',['towerW','towerUp','cup']],['holes',['holeN','holeD','tray']]]){
        if(!box(key)){wrong(`there is no "${key}" box`);continue;}
        if(box(key).checked)wrong(`the "${key}" box is ticked as first opened`);
        if(rows.some(k=>!row(k)||!row(k).hidden))wrong(`the rows of the "${key}" box show before it is ticked`);
        box(key).checked=true;readVals(false);
        if(rows.some(k=>row(k).hidden||!row(k).classList.contains('sub')))wrong(`ticking the "${key}" box does not show its own rows, indented`);
        box(key).checked=false;readVals(false);
        if(rows.some(k=>!row(k).hidden))wrong(`unticking the "${key}" box leaves its rows showing`);
      }
      for(const key of['round','props','hook'])if(!box(key)||box(key).checked)wrong(`the "${key}" box is missing or ticked as first opened`);
      box('room').checked=true;readVals(false);
      if(['space','sill','arms','chairW'].some(key=>row(key).hidden))wrong('ticking "Check it against my room" does not show the four boxes');
      box('drawers').value='none';readVals(false);
      if(['N','caseW','slides','fronts'].some(key=>!row(key).hidden))wrong('with no drawers the drawer rows still show');
    }
  }finally{
    catalogState.picked=kept.picked;catalogState.typed=kept.typed;
    if(kept.preset&&PRESETS.includes(kept.preset))choosePreset(PRESETS.indexOf(kept.preset),kept.entry);else showNoPreset();
  }
});
/* With no drawers and every option off it is exactly the plain Desk at the same sizes. */
SELFTESTS.push(function computerDeskFrameIsTheDesks(problems){
  const desk=PRESETS.find(preset=>preset.name==='Desk'),mine=deskPreset();
  const shape=parts=>parts.map(p=>[p.name,p.mat,...p.pos.map(r16),...size(p).map(r16)].join('|')).sort().join(';');
  for(const corner of[{L:60,W:30,H:30},...deskCorners()]){
    const vals={...presetDefaults(mine),...corner,drawers:'none'};
    if(shape(mine.build(vals))!==shape(desk.build(corner)))problems.push(`computer desk: with no drawers at ${corner.L} x ${corner.W} x ${corner.H} it is not the plain Desk`);
  }
  // and with drawers the frame is still the Desk's: the same top, legs, aprons and cross rails
  const frameOnly=parts=>parts.filter(p=>['Top','Leg','Long apron','Short apron','Cross rail'].includes(p.name));
  if(shape(frameOnly(mine.build(presetDefaults(mine))))!==shape(desk.build({L:60,W:30,H:30})))problems.push('computer desk: the default frame is not the plain Desk\'s');
});
/* Every layout at the eight corners of width, depth and height: refused with a reason and a fix, or clean; no two
   pieces share space; no wood in the knee and foot space; the drawer case under 27", outside the knee space. */
SELFTESTS.push(function computerDeskOptionsStand(problems){
  const R=DESK_RULES,preset=deskPreset(),wrong=text=>{if(problems.length<60)problems.push('computer desk: '+text);};
  let lowestTip=Infinity,lowestLean=Infinity,built=0,refused=0;
  const boxes=parts=>parts.map(part=>{const s=size(part);return{part,lo:part.pos,hi:part.pos.map((v,i)=>v+s[i])};});
  const inside=(b,lo,hi)=>[0,1,2].every(k=>Math.min(b.hi[k],hi[k])-Math.max(b.lo[k],lo[k])>.01);
  for(const base of deskVariants())for(const corner of deskCorners()){
    const vals={...base,...corner},label=JSON.stringify({...corner,...Object.fromEntries(Object.entries(vals).filter(([k,v])=>v!==presetDefaults(preset)[k]&&!(k in corner)))})+': ';
    const check=checkPreset(preset,vals);
    // the lean on an open drawer, at every size whose plan is otherwise sound (the stop it would give is recorded)
    if(!computerDeskPlan(vals).problems.some(f=>f.level==='stop'))lowestLean=Math.min(lowestLean,computerDeskLean(vals));
    if(check.refused){
      refused++;
      if(check.stops.some(f=>!(f.text&&f.fix)))wrong(label+'refused without a reason and a fix');
      continue;
    }
    built++;
    if(check.problems.length){wrong(label+check.problems[0].level+' '+check.problems[0].code+': '+check.problems[0].text);continue;}
    const plan=computerDeskPlan(vals),parts=check.parts,list=boxes(parts);
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      if(inside(list[i],list[j].lo,list[j].hi)){wrong(label+`${list[i].part.name} and ${list[j].part.name} share space`);i=list.length;break;}
    }
    // the knee box and the foot box (CD15, [22 l.54, l.55]): no wood between the two walls of the knee space
    const kneeLo=[plan.knee.lo,0,plan.W-R.kneeDepthLeast],kneeHi=[plan.knee.hi,plan.knee.room,plan.W];
    const footLo=[plan.knee.lo,0,plan.W-R.footDepthLeast],footHi=[plan.knee.hi,R.footHigh,plan.W];
    const inKnee=list.find(b=>inside(b,kneeLo,kneeHi)||inside(b,footLo,footHi));
    if(inKnee)wrong(label+`${inKnee.part.name} is in the knee space`);
    if(plan.stacks.length||plan.tower){
      if(plan.knee.width<R.kneeLeast-1e-6)wrong(label+`built with only ${fmt(plan.knee.width)} of knee space`);
    }
    for(const stack of plan.stacks){
      if(plan.caseHeight>R.caseTallest+1e-6)wrong(label+`the drawer case is ${fmt(plan.caseHeight)} tall`);
      if(stack.x1>plan.knee.lo+.01&&stack.x0<plan.knee.hi-.01)wrong(label+'the drawer case reaches into the knee space');
    }
    const tip=computerDeskTip(vals);
    lowestTip=Math.min(lowestTip,tip.factor);
  }
  if(!built)wrong('nothing could be built at any corner');
  SELFTESTS.computerDesk={built,refused,lowestTipFactor:Math.round(lowestTip*100)/100,lowestLeanPounds:lowestLean};   // for whoever runs the check by hand
  if(lowestTip<NS.tipWarn)wrong(`a full open drawer comes close to tipping a desk the form allows (factor ${lowestTip.toFixed(2)})`);
  if(lowestLean<R.leanLoad)wrong(`a desk the form allows is refused because ${lowestLean} lb leaning on its open top drawer tips it (it should be built at every size)`);
  // the knee rule is a stop with a fix that quotes the width that passes
  const narrow=computerDeskCheck({...presetDefaults(preset),L:46}),bothAt60=computerDeskCheck({...presetDefaults(preset),drawers:'both'});
  if(!narrow.some(f=>f.level==='stop'&&/at least 30"/.test(f.text)&&/55"|4'-7"/.test(f.fix)))wrong('46" wide with drawers is not refused for its knee space with the width that would pass');
  if(!bothAt60.some(f=>f.level==='stop'&&/both ends/.test(f.text)))wrong('drawers at both ends of a 60" desk are not refused');
  // (the tower shelf with a drawer stack: computerDeskTowerSpace)
});
/* The desk as Create places it, with each drawer layout: every drawer on its pair of slides (or runners) on the case
   sides, with a pull, opening all the way without hitting anything; nothing shares space; Check my design is clean. */
SELFTESTS.push(function computerDeskDrawers(problems){withoutDrawing(()=>{
  const preset=deskPreset(),wrong=text=>problems.push('computer desk drawers: '+text);
  const kept=JSON.stringify(S),tabKept=tab;
  let presetKept=null;
  try{presetKept=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  try{
    for(const extra of[{},{drawers:'left'},{drawers:'both',L:72},{N:'4',slides:'runner'},{cub:true,fronts:'inset'},{W:24,H:28,L:55}]){
      const vals={...presetDefaults(preset),...extra},label=JSON.stringify(extra)+': ',plan=computerDeskPlan(vals);
      load(JSON.stringify(blank()),true);
      placePreset(preset,vals,preset.build(vals),false);
      if(findClashes().length)wrong(label+'pieces share space: '+findClashes()[0].map(p=>p.name).join(' and '));
      const list=movers(),count=plan.stacks.reduce((sum,stack)=>sum+stack.layout.drawers,0);
      if(list.length!==count){wrong(label+`${list.length} drawers move, of ${count}`);continue;}
      for(const mover of list){
        if(mover.items.length!==2||mover.items.some(item=>byId(item.to).name!=='Side'))wrong(label+`${mover.name} is not on a pair of ${plan.v.kind}s on the case sides`);
        const reach=openReach(mover);
        if(reach.hit||reach.free<1)wrong(label+`${mover.name} hits ${reach.hit?reach.hit.other.name:'something'} before it is fully open`);
        const facts=drawerFacts(mover.lead.id);
        if(!facts||!facts.pull||!facts.pull.centered)wrong(label+`${mover.name} has no pull in the middle of its front`);
      }
      const found=verifyDesign(S.parts,designCheckOptions()).problems;
      if(found.length)wrong(label+'Check my design says: '+found[0].text);
    }
  }finally{
    load(kept,true);setTab(tabKept);
    try{if(presetKept===null)localStorage.removeItem(LAST_PRESET_KEY);else localStorage.setItem(LAST_PRESET_KEY,presetKept);}catch(e){}
  }
});});
/* The tower shelf (the owner, 16 Nov 10:27 PM: "should be like a shelf it sits on"): no tower panel; a shelf held
   at both of its long sides by two sides standing on the floor, its top at the height typed, as wide inside as
   typed, the sides standing above it, outside the knee space, nothing above it up to the front apron but the
   computer, its front and back open, and as a loaded shelf it carries more than the heaviest mid tower; the cross
   rails are the plain Desk's. Then the power strip in a bay over the knee space at every width, and the hook on a
   short apron. */
SELFTESTS.push(function computerDeskTowerSpace(problems){withoutDrawing(()=>{
  const R=DESK_RULES,preset=deskPreset(),wrong=text=>{if(problems.length<60)problems.push('computer desk: '+text);};
  const desk=PRESETS.find(p=>p.name==='Desk');
  for(const extra of[{drawers:'none',tower:true},{drawers:'none',tower:true,towerSide:'right'},{tower:true,L:72},{drawers:'left',tower:true,L:72},
    {drawers:'none',tower:true,towerW:R.towerInsideLeast,towerUp:R.towerUpLeast},{drawers:'none',tower:true,towerW:R.towerInsideMost,towerUp:5},{tower:true,L:72,cup:true,props:true}]){
    for(const corner of deskCorners()){
      const vals={...presetDefaults(preset),...extra,...corner};
      if(computerDeskCheck(vals).some(f=>f.level==='stop'))continue;
      const plan=computerDeskPlan(vals),parts=buildComputerDesk(vals),label=JSON.stringify({...extra,...corner})+': ',t=plan.tower;
      if(parts.some(p=>p.name==='Tower panel'))wrong(label+'a tower panel is built');
      const shelf=parts.find(p=>p.name==='Tower shelf'),sides=parts.filter(p=>p.name==='Tower shelf side');
      if(!shelf||sides.length!==2){wrong(label+'no tower shelf with two sides');continue;}
      const s=plainBox(shelf),[a,b]=sides.map(plainBox).sort((p,q)=>p.lo[0]-q.lo[0]);
      // held at both long sides: each side touches one long edge of the shelf over its whole depth, and stands on the floor
      if(Math.abs(a.hi[0]-s.lo[0])>.01||Math.abs(b.lo[0]-s.hi[0])>.01)wrong(label+'the tower shelf is not held between its two sides');
      if([a,b].some(side=>side.lo[1]>.01||side.lo[2]>s.lo[2]+.01||side.hi[2]<s.hi[2]-.01))wrong(label+'a side of the tower shelf does not reach the floor, or is shorter than the shelf');
      if(Math.abs(s.hi[1]-vals.towerUp)>.01)wrong(label+`the tower shelf is ${fmt(s.hi[1])} off the floor, not the ${fmt(vals.towerUp)} typed`);
      if(Math.abs(s.hi[0]-s.lo[0]-vals.towerW)>.01)wrong(label+`the tower shelf is ${fmt(s.hi[0]-s.lo[0])} wide inside, not ${fmt(vals.towerW)}`);
      if([a,b].some(side=>side.hi[1]<s.hi[1]+R.towerLip-.01))wrong(label+'the sides of the tower shelf do not stand above it');
      if(b.hi[0]>plan.knee.lo+.01&&a.lo[0]<plan.knee.hi-.01)wrong(label+'the tower shelf reaches into the knee space');
      // the room for the tower: from the shelf up to the front apron, the shelf's width, its whole depth
      const inSpace=parts.find(p=>p!==shelf&&!sides.includes(p)&&!isProp(p)&&!['Top','Long apron','Short apron','Leg'].includes(p.name)&&
        plainBox(p).lo[0]<s.hi[0]-.01&&plainBox(p).hi[0]>s.lo[0]+.01&&plainBox(p).lo[1]<plan.knee.room-.01&&plainBox(p).hi[1]>s.hi[1]+.01);
      if(inSpace)wrong(label+`${inSpace.name} is in the space over the tower shelf`);
      if(plan.knee.room-s.hi[1]<R.towerTall-1e-6)wrong(label+'a 20" mid tower does not slide in under the front apron');
      // the load the structural check puts on it is the one its declared use gives (verifyDesign reads preset.uses)
      const use=USES[(preset.uses(vals)||{})['Tower shelf']];
      if(!use||!(use.psf>0))wrong(label+'the tower shelf carries no load in the structural check');
      else if(use.psf*(s.hi[0]-s.lo[0])*(s.hi[2]-s.lo[2])/144<R.towerWeight)wrong(label+`the tower shelf is checked for less than a ${R.towerWeight} lb tower`);
      // the cross rails are the Desk's at these sizes: nothing of the top rests on the tower shelf
      const rails=parts=>parts.filter(p=>p.name==='Cross rail').map(p=>r16(p.pos[0])).sort((p,q)=>p-q).join();
      if(rails(parts)!==rails(desk.build({L:vals.L,W:vals.W,H:vals.H})))wrong(label+'the cross rails are not the plain Desk\'s');
    }
  }
  // the knee rule with a tower shelf and a drawer stack: refused at one inch under the least width, built at it
  {
    const base={...presetDefaults(preset),tower:true},frame=computerDeskPlan(base);
    const least=Math.ceil(R.kneeLeast+2*(frame.over+frame.leg)+R.caseW+R.towerInside+2*R.panel-1e-6);   // 67 1/2", so 68"
    const at=L=>computerDeskCheck({...base,L}).some(f=>f.level==='stop');
    if(!at(least-1)||at(least))wrong(`a tower shelf and a drawer stack are not refused at ${least-1}" and built at ${least}"`);
  }
  for(const L of[R.minL,52,60,66,R.maxL])for(const drawers of['right','both','none'])for(const tower of[false,true]){
    const vals={...presetDefaults(preset),L,drawers,tower,strip:true};
    if(computerDeskCheck(vals).some(f=>f.level==='stop'))continue;
    const plan=computerDeskPlan(vals);
    if(!plan.strip){wrong(`${L}" wide, drawers ${drawers}${tower?', tower':''}: no bay over the knee space takes the power strip`);continue;}
    const half=R.strip.length/2;
    if(plan.strip.x-half<plan.knee.lo-.01||plan.strip.x+half>plan.knee.hi+.01)wrong(`${L}" wide, drawers ${drawers}: the power strip is not over the knee space`);
    if(plan.rails.some(x=>x<plan.strip.x+half+R.strip.clear-.01&&x+plan.frame.railT>plan.strip.x-half-R.strip.clear+.01))wrong(`${L}" wide, drawers ${drawers}: the power strip is within 1" of a cross rail`);
  }
  // placed: the strip on the inside face of the back apron and the hook on a short apron, each listed once
  const kept=JSON.stringify(S),tabKept=tab;
  let presetKept=null;
  try{presetKept=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  try{
    for(const tray of[false,true]){
      const vals={...presetDefaults(preset),strip:true,hook:true,...(tray?{holes:true,tray:true}:{})},said=tray?' (with the cable tray)':'';
      load(JSON.stringify(blank()),true);
      placePreset(preset,vals,preset.build(vals),false);
      const strip=hardwareList().find(item=>item.kind==='strip'),hook=hardwareList().find(item=>item.kind==='hook');
      if(tray){
        // in the tray: on the top face of the tray bottom, within its inside, outlets up
        const t=computerDeskPlan(vals).tray,pose=strip&&hardwarePose(strip);
        if(!strip||byId(strip.on).name!=='Cable tray bottom'||pose.n.y<.5)wrong('with the cable tray the power strip does not lie in it');
        else if(pose.at.z-DESK_RULES.strip.tall/2<t.inside[0]-.01||pose.at.z+DESK_RULES.strip.tall/2>t.inside[1]+.01)wrong('the power strip does not fit between the back apron and the lip of the cable tray');
      }else if(!strip||byId(strip.on).name!=='Long apron'||hardwarePose(strip).n.z<.5)wrong('the power strip is not on the inside face of the back apron');
      if(strip&&Math.abs(hardwarePose(strip).at.x-computerDeskPlan(vals).strip.x)>.01)wrong('the power strip is not where the plan put it'+said);
      if(!hook||byId(hook.on).name!=='Short apron'||Math.abs(hardwarePose(hook).n.x)<.5)wrong('the hook is not on the outside face of a short apron');
      else if(hardwarePose(hook).at.z>plan0Back(vals)+DESK_RULES.hookFromLeg+DESK_RULES.hookPlate+.01)wrong('the hook is not near the back of the end');
      const rows=hardwareTotals(findJoints()).rows;
      for(const kind of['strip','hook']){
        const label=HARDWARE[kind].buy(),count=rows.filter(row=>row[0]===label).reduce((sum,row)=>sum+row[1],0);
        if(count!==1)wrong(`the shopping list has ${count} of "${label}"${said}`);
        if(typeof hardwareFamily==='function'&&!hardwareFamily(label))wrong(`"${label}" has no price`);
      }
      const steps=buildPlan().steps;
      if(!steps.some(step=>(step.hardware||[]).some(line=>line.kind==='strip'))||!steps.some(step=>(step.hardware||[]).some(line=>line.kind==='hook')))wrong('the power strip or the hook is in no build step'+said);
    }
  }finally{
    load(kept,true);setTab(tabKept);
    try{if(presetKept===null)localStorage.removeItem(LAST_PRESET_KEY);else localStorage.setItem(LAST_PRESET_KEY,presetKept);}catch(e){}
  }
});});
/* the z of the front face of the back legs, where the hook's place is measured from */
const plan0Back=vals=>{const plan=computerDeskPlan(vals);return plan.over+plan.leg;};
/* The monitor shelf: every screw drivable and inside its wood (fastenerFault), the supports never over a rail, a leg or
   a case side, and in Everyday and Fine the screws through the shelf under plugs. */
SELFTESTS.push(function computerDeskShelfScrewsDrivable(problems){withoutDrawing(()=>{
  const preset=deskPreset(),wrong=text=>problems.push('computer desk shelf: '+text);
  const kept=JSON.stringify(S),tabKept=tab;
  try{
    for(const extra of[{riser:true},{riser:true,riserBoard:'1x12',W:24},{riser:true,riserSpan:'part',riserW:36},{riser:true,drawers:'both',L:72},{riser:true,drawers:'none',tower:true,L:52}]){
      const vals={...presetDefaults(preset),...extra},plan=computerDeskPlan(vals),label=JSON.stringify(extra)+': ';
      if(computerDeskCheck(vals).some(f=>f.level==='stop')){wrong(label+'refused');continue;}
      const blocks=deskDrillBlocks(plan,plan.riser.z0,plan.riser.depth);
      for(const x of plan.riser.supports)if(blocks.some(([a,b])=>x<b+DESK_RULES.drillRoom-1e-6&&x+.75>a-DESK_RULES.drillRoom+1e-6))wrong(label+`a support at ${fmt(x)} has no room for a drill under it`);
      for(let i=1;i<plan.riser.supports.length;i++)if(plan.riser.supports[i]-plan.riser.supports[i-1]-.75>plan.riser.maxBay+1e-6)wrong(label+'a bay of the shelf is longer than the board may span');
      for(const style of['std','fine','rustic']){
        load(JSON.stringify(blank()),true);
        placePreset(preset,vals,preset.build(vals),false);
        look().style=style;commit();
        for(const link of connGraph().links){
          if(!link.joint||!link.fastened||![link.a.name,link.b.name].some(name=>/^Monitor shelf/.test(name)))continue;
          for(const f of fastenersOfLink(link)){
            const fault=fastenerFault(f);
            if(fault){wrong(`${label}(${STYLES[style][0]}) ${f.through.name} into ${f.into.name}: ${fault}`);break;}
          }
          const shelfJoint=[link.a.name,link.b.name].sort().join()==='Monitor shelf,Monitor shelf support';
          if(shelfJoint&&style!=='rustic'&&link.type!=='plug')wrong(`${label}(${STYLES[style][0]}) the shelf is held by ${link.type}, not by screws under plugs`);
        }
      }
    }
  }finally{load(kept,true);setTab(tabKept);}
});});
/* Show faces with every option (showFacesOfHouseFurniture, js/showfaces.js, tries the default layout only): in
   Everyday and Fine no head shows on the top, the front, the ends or the drawer fronts, and none on the floor of the
   open shelf; in every style no two fasteners meet and none leaves its wood. */
SELFTESTS.push(function computerDeskShowFaces(problems){withoutDrawing(()=>{
  const preset=deskPreset(),wrong=text=>problems.push('computer desk show faces: '+text);
  const kept=JSON.stringify(S),tabKept=tab;
  try{
    for(const variant of preset.variants){
      const vals={...presetDefaults(preset),...variant},label=JSON.stringify(variant);
      if(computerDeskCheck(vals).some(f=>f.level==='stop'))continue;
      for(const style of Object.keys(STYLES)){
        placeInStyle(preset,vals,style);
        const at=`${label} (${STYLES[style][0]})`;
        if(SHOW_FACES.styles.includes(style)){
          const showing=headsOnShowFaces(),floor=headsOnAnOpenFloor();
          if(showing.length){wrong(`${at}: ${showing.length} heads show on the ${showing[0].face} (${showing[0].f.through.name} into ${showing[0].f.into.name})`);continue;}
          if(floor.length){wrong(`${at}: heads show on the floor of the open shelf`);continue;}
        }
        const met=screwsThatMeet();
        if(met.length)wrong(`${at}: ${met[0].a.through.name} into ${met[0].a.into.name} meets ${met[0].b.through.name} into ${met[0].b.into.name}`);
        for(const link of connGraph().links){
          const fault=fastenersOfLink(link).map(f=>fastenerFault(f)&&`${f.through.name} into ${f.into.name}: ${fastenerFault(f)}`).find(Boolean);
          if(fault){wrong(`${at}: ${fault}`);break;}
        }
      }
    }
  }finally{load(kept,true);setTab(tabKept);}
});});
/* "Check it against my room": each of the four measurements gives the right plain words, fitting and not. */
SELFTESTS.push(function computerDeskRoomWords(problems){
  const preset=deskPreset(),base={...presetDefaults(preset),room:true},wrong=text=>problems.push('computer desk room: '+text);
  const say=extra=>computerDeskCheck({...base,...extra}),notes=extra=>deskRoomFindings(computerDeskPlan({...base,...extra}));
  const cases=[
    [{space:72},true,/6" to spare at each end/],[{space:56},false,/4" too wide/],
    [{sill:31},true,/1" to spare/],[{sill:29.5},false,/cannot slide under the sill/],
    [{arms:25},true,/3\/4" to spare/],[{arms:27},false,/1 1\/4" short/],
    [{chairW:28},true,/3 1\/2" to spare at each side/],[{chairW:34},false,/knock|will not roll/]];
  for(const[extra,fits,words]of cases){
    const found=notes(extra);
    if(found.length!==1||found[0].fits!==fits||!words.test(found[0].text))wrong(`${JSON.stringify(extra)} gives "${found.map(f=>f.text).join(' ')}"`);
    const warns=say(extra).filter(f=>f.level==='warn');
    if(fits?warns.length:!(warns.length===1&&warns[0].fix))wrong(`${JSON.stringify(extra)}: the warning box ${fits?'warns although it fits':'does not warn with a fix'}`);
  }
  // a space narrower than the desk: every change the fix offers really fits the space and can be built (at 50"
  // the drawers at the right leave too little knee space once the desk is narrowed to the space)
  for(const extra of[{space:56},{space:50},{space:52,drawers:'both',L:72},{space:48,tower:true,drawers:'none'},{space:54,riser:true,riserSpan:'part',riserW:60}]){
    const finding=notes(extra).find(f=>f.fits===false);
    if(!finding){wrong(`${JSON.stringify(extra)}: no "too wide" finding`);continue;}
    if(!finding.tries||!finding.tries.length){wrong(`${JSON.stringify(extra)}: the fix "${finding.fix}" offers no change that works`);continue;}
    for(const change of finding.tries){
      const vals={...extra,...change},stops=computerDeskCheck({...base,...vals}).filter(f=>f.level==='stop');
      if(stops.length)wrong(`${JSON.stringify(extra)}: the fix "${finding.fix}" offers ${JSON.stringify(change)}, which is refused: ${stops[0].text}`);
      if(computerDeskPlan({...base,...vals}).L>extra.space+1e-6)wrong(`${JSON.stringify(extra)}: the change ${JSON.stringify(change)} does not fit the space`);
    }
  }
  if(notes({}).length||say({}).length)wrong('with nothing measured the room check still says something');
  if(deskRoomFindings(computerDeskPlan({...base,room:false,space:20})).length)wrong('with the box unticked the room is still checked');
});
/* The screws of the power strip and of the hook keep clear of every other screw and pocket hole in their apron, in
   every style (hardwareHoles, js/fasteners.js, only knows bolts and wall screws, so they are checked here). The
   strip's keyhole slots may be anywhere along it (strips differ), so a screw is tried every 1/2" along its length;
   the hook's two screws are where its plate has them. */
function deskHardwareScrews(){
  const R=DESK_RULES,screws=[];
  const screwAt=(at,into,host)=>({kind:'screw',pos:at,dir:into,len:R.strip.screwDeep,dia:.164,head:.33,structural:false,host});
  for(const item of hardwareList()){
    if(item.kind!=='strip'&&item.kind!=='hook')continue;
    const host=byId(item.on),pose=hardwarePose(item);
    if(!host)continue;
    const at=[pose.at.x,pose.at.y,pose.at.z],into=[-pose.n.x,-pose.n.y,-pose.n.z];
    // the point on the face of the apron (the pose is on it), moved along the face
    const moved=(axis,by)=>{const p=at.slice();p[axis]+=by;return p;};
    if(item.kind==='strip'){
      const along=[0,1,2].find(k=>Math.abs(pose.u.getComponent(k))>.5),half=R.strip.length/2-1;
      for(let by=-half;by<=half+1e-6;by+=.5)screws.push(screwAt(moved(along,by),into,host));
    }else for(const by of[-R.hookScrews,R.hookScrews])screws.push(screwAt(moved(1,by),into,host));
  }
  return screws;
}
SELFTESTS.push(function computerDeskHardwareScrewsClear(problems){withoutDrawing(()=>{
  const preset=deskPreset(),wrong=text=>problems.push('computer desk hardware: '+text);
  const kept=JSON.stringify(S),tabKept=tab;
  try{
    for(const extra of[{},{drawers:'left'},{drawers:'none',tower:true},{L:72,tower:true,riser:true},{drawers:'both',L:72},{W:24,H:28,L:55},
      {holes:true,tray:true},{holes:true,holeN:'2',tray:true,L:72,riser:true}]){
      const vals={...presetDefaults(preset),...extra,strip:true,hook:true};
      if(computerDeskCheck(vals).some(f=>f.level==='stop'))continue;
      for(const style of Object.keys(STYLES)){
        placeInStyle(preset,vals,style);
        const mine=deskHardwareScrews();
        if(!mine.length){wrong(`${JSON.stringify(extra)}: the power strip and the hook were not placed`);continue;}
        let hit=null;
        for(const link of connGraph().links){
          if(!link.joint||!link.fastened)continue;
          for(const f of fastenersOfLink(link)){
            if(f.kind!=='screw'&&f.kind!=='pocket')continue;
            const other=mine.find(screw=>(f.through===screw.host||f.into===screw.host)&&screwsMeet(screw,f));
            if(other){hit={f,other};break;}
          }
          if(hit)break;
        }
        if(hit)wrong(`${JSON.stringify(extra)} (${STYLES[style][0]}): a screw of the ${hit.other.host.name==='Short apron'?'hook':'power strip'} runs into the ${hit.f.kind==='pocket'?'pocket hole':'screw'} of the ${hit.f.through.name} into the ${hit.f.into.name}`);
      }
    }
  }finally{load(kept,true);setTab(tabKept);}
});});
/* The monitor shelf at every width the "Width of the shelf" box allows: its supports are where a drill reaches
   them and no bay is longer than the shelf may span, or the warning box refuses it with a width that works. */
SELFTESTS.push(function computerDeskShelfAtEveryWidth(problems){
  const R=DESK_RULES,preset=deskPreset(),wrong=text=>{if(problems.length<60)problems.push('computer desk shelf width: '+text);};
  for(const base of[{},{drawers:'both',L:72},{drawers:'none',tower:true},{L:R.minL,drawers:'none'},{W:R.minW,riserBoard:'1x12'}]){
    const L=base.L||presetDefaults(preset).L;
    for(let width=R.riserLeast;width<=L;width+=1){
      const vals={...presetDefaults(preset),...base,riser:true,riserSpan:'part',riserW:width},plan=computerDeskPlan(vals);
      const label=`${JSON.stringify(base)} shelf ${width}": `;
      if(plan.problems.some(f=>f.level==='stop')){
        const stop=plan.problems.find(f=>f.level==='stop');
        if(!(stop.text&&stop.fix))wrong(label+'refused without a reason and a fix');
        continue;
      }
      const riser=plan.riser,blocks=deskDrillBlocks(plan,riser.z0,riser.depth),room=R.drillRoom;
      if(riser.supports.length<2){wrong(label+'fewer than two supports');continue;}
      for(const x of riser.supports)if(blocks.some(([a,b])=>x<b+room-1e-6&&x+.75>a-room+1e-6))wrong(label+`a support at ${fmt(x)} has no room for a drill under it`);
      for(let i=1;i<riser.supports.length;i++)if(riser.supports[i]-riser.supports[i-1]-.75>riser.maxBay+1e-6)wrong(label+'a bay is longer than the shelf may span');
      if(riser.supports[0]<riser.x0-1e-6||riser.supports[riser.supports.length-1]+.75>riser.x1+1e-6)wrong(label+'a support stands past the end of the shelf');
    }
  }
});
/* What a step uses, the shopping list buys: a pull step that asks for screws longer than the ones in a pull's
   package finds them on the shopping list, as many as the pulls need and with a price. */
SELFTESTS.push(function computerDeskBuysThePullScrews(problems){withoutDrawing(()=>{
  const preset=deskPreset(),wrong=text=>problems.push('computer desk pull screws: '+text);
  const kept=JSON.stringify(S),tabKept=tab;
  try{
    for(const extra of[{},{drawers:'both',L:72},{N:'4',fronts:'inset'},{cub:true}]){
      const vals={...presetDefaults(preset),...extra},label=JSON.stringify(extra)+': ';
      load(JSON.stringify(blank()),true);
      placePreset(preset,vals,preset.build(vals),false);
      const pulls=hardwareList().filter(item=>item.kind==='pull').length;
      const asked=[];
      for(const step of buildPlan().steps)for(const line of step.hardware||[]){
        const long=/use screws about (.+?) long/.exec(line.line||'');
        if(line.kind==='pull'&&long)asked.push(parseLen(long[1]));
      }
      if(!pulls){wrong(label+'no pulls placed');continue;}
      if(!asked.length){wrong(label+'no pull step says how long the pull screws must be');continue;}
      const rows=hardwareTotals(findJoints()).rows;
      for(const length of asked){
        const row=rows.find(([words])=>/machine screws/i.test(words)&&words.includes(`× ${fmt(length)}`));
        if(!row)wrong(label+`the step asks for ${fmt(length)} pull screws and the shopping list does not buy them`);
        else{
          if(row[1]<2*pulls)wrong(label+`the shopping list buys ${row[1]} pull screws for ${pulls} pulls`);
          const family=typeof hardwareFamily==='function'?hardwareFamily(row[0]):null;
          if(!family||family.id!=='pull-screws')wrong(label+`"${row[0]}" has no price of its own`);
        }
      }
    }
  }finally{load(kept,true);setTab(tabKept);}
});});
/* Words a person reads say what to do today: none promises a later version or points to an option the desk does
   not have; and while the form is talking, no sentence writes one size as the boxes do (2'-6") and another in
   plain inches over a foot (25 3/4"), so a size never reads two ways in one sentence. */
SELFTESTS.push(function computerDeskWordsSayToday(problems){withoutDrawing(()=>{
  const preset=deskPreset(),wrong=text=>{if(problems.length<60)problems.push('computer desk words: '+text);};
  // (a cable hole is named only by a desk that has the option ticked)
  const promise=/later version|in a later stage|comes later|once the desk has/i,noHoles=/cable holes?/i;
  const feet=/\d+'-\d/,inchesOverAFoot=/(?<![-'\d])(1[3-9]|[2-9]\d|\d{3})( \d+\/\d+)?"/;
  const rooms=[{},{room:true,space:56,sill:29.5,arms:27,chairW:34},{room:true,space:100,sill:31,arms:25,chairW:28},{room:true,arms:26,chairW:31}];
  for(const variant of[{}].concat(preset.variants))for(const room of rooms){
    const vals={...presetDefaults(preset),...variant,...room},label=JSON.stringify({...variant,...room})+': ';
    const formWords=speakAsBoxes(()=>[computerDeskInfo(vals),...computerDeskCheck(vals).flatMap(f=>[f.text,f.fix])]).filter(Boolean);
    const pageWords=[...computerDeskNotes(vals),...computerDeskSteps(vals).flatMap(step=>[step.t,...Object.values(step.byStyle||{})])].filter(Boolean);
    for(const words of formWords.concat(pageWords)){
      if(promise.test(words))wrong(label+`"${promise.exec(words)[0]}" in: ${words.slice(0,120)}`);
      if(!vals.holes&&noHoles.test(words))wrong(label+`a cable hole is named, and the desk has none, in: ${words.slice(0,120)}`);
    }
    for(const words of formWords)for(const sentence of words.split(/(?<=\.)\s+/)){
      if(feet.test(sentence)&&inchesOverAFoot.test(sentence))wrong(label+`a size is written two ways in: ${sentence}`);
    }
  }
});});
/* The steps keep the desk the right way up, in every style and layout: a step that says the desk is "still upside
   down" (or leaves it so) comes while it is upside down, a step that needs it standing (screws driven up from
   underneath, the desk stood in its place) comes while it stands, and after the last step it stands. A sentence
   that turns it over changes which way up it is, in the order the words say it. */
const DESK_TURNS=[
  {re:/turn (?:it|the desk|the frame) upside down/gi,sets:'down'},
  {re:/still upside down|leave it upside down/gi,needs:'down'},
  {re:/right side up/gi,sets:'up'},
  {re:/stand the desk in its place|from underneath drive/gi,needs:'up'}];
function deskTurnFaults(steps,style){
  let way='up';
  const faults=[];
  steps.forEach((step,index)=>{
    const words=(step.byStyle&&step.byStyle[style])||step.t||'';
    const found=[];
    for(const turn of DESK_TURNS)for(const m of words.matchAll(turn.re))found.push({at:m.index,turn,text:m[0]});
    found.sort((a,b)=>a.at-b.at);
    for(const{turn,text}of found){
      if(turn.needs&&turn.needs!==way)faults.push(`step ${index+1} says "${text}" while the desk is ${way==='up'?'standing':'upside down'}`);
      if(turn.sets)way=turn.sets;
    }
  });
  if(way!=='up')faults.push('after the last step the desk is still upside down');
  return faults;
}
SELFTESTS.push(function computerDeskStepsKeepItTheRightWayUp(problems){
  const preset=deskPreset(),wrong=text=>{if(problems.length<60)problems.push('computer desk steps: '+text);};
  const layouts=[{}].concat(preset.variants,[{drawers:'none',holes:true,tray:true},{drawers:'none',holes:true,tray:true,riser:true,L:72},
    {holes:true,tray:true,strip:true},{drawers:'none'}]);
  for(const layout of layouts){
    const vals={...presetDefaults(preset),...layout};
    if(computerDeskCheck(vals).some(f=>f.level==='stop'))continue;
    const steps=computerDeskSteps(vals);
    for(const style of Object.keys(STYLES)){
      const faults=deskTurnFaults(steps,style);
      if(faults.length)wrong(`${JSON.stringify(layout)} (${STYLES[style][0]}): ${faults[0]}`);
    }
  }
});
/* Every layout the structural check is asked to try (preset.variants) really builds at one corner of the sizes or
   more: a variant refused at every size would be checked by nothing. */
SELFTESTS.push(function computerDeskVariantsBuild(problems){
  const preset=deskPreset();
  for(const variant of preset.variants){
    const builds=deskCorners().some(corner=>!computerDeskCheck({...presetDefaults(preset),...variant,...corner}).some(f=>f.level==='stop'));
    if(!builds)problems.push(`computer desk: the variant ${JSON.stringify(variant)} is refused at every corner of the sizes, so no check ever builds it`);
  }
});
/* With the open shelf the drawers keep the front height typed (fewer of them, never cut down to shallow boxes),
   unless not even one fits; and no front is ever cut under the 5" the Nightstand's rule takes as the least. */
SELFTESTS.push(function computerDeskOpenShelfDrawers(problems){
  const preset=deskPreset(),wrong=text=>problems.push('computer desk open shelf: '+text);
  for(const corner of[{},...deskCorners()])for(const fh of[5,7,9,12])for(const N of['2','3','4']){
    const vals={...presetDefaults(preset),...corner,cub:true,fh,N},plan=computerDeskPlan(vals);
    if(plan.problems.some(f=>f.level==='stop')||!plan.stacks.length)continue;
    const layout=plan.stacks[0].layout,d=layout.drawer,deep=d.boxHeight-d.bottomThick,label=JSON.stringify({...corner,fh,N})+': ';
    if(layout.drawers>1&&Math.abs(layout.frontHeight-floor16(fh))>1e-6)wrong(label+`${layout.drawers} drawers with ${fmt(layout.frontHeight)} fronts, not the ${fmt(fh)} typed`);
    if(layout.drawers>+N)wrong(label+`${layout.drawers} drawers, more than the ${N} asked for`);
    // fewer drawers than asked is said, under the form and in the notes of the instructions
    const said=new RegExp(`Only ${layout.drawers} drawers? with`);
    if(layout.drawers<+N&&!(said.test(computerDeskInfo(vals))&&computerDeskNotes(vals).some(line=>said.test(line))))wrong(label+`${layout.drawers} drawers of the ${N} asked for, and the remark or the notes do not say why`);
    // (a 5" front, the least the form takes, gives the shallowest drawer the Nightstand's rule allows: never less)
    if(layout.frontHeight<NS.minFront-1e-6)wrong(label+`the drawer fronts were cut to ${fmt(layout.frontHeight)}, under the ${fmt(NS.minFront)} that leaves a useful drawer (${fmt(deep)} deep inside)`);
    if(layout.openHeight<NS.minShelf-1e-6)wrong(label+`the open shelf is only ${fmt(layout.openHeight)} tall`);
  }
});

/* Stage 2, each option at the eight corners of width, depth and height with each drawer choice, the tower shelf
   and the monitor shelf: refused with a reason and a fix, or built so that
     - every cable hole is over open space (no wood under it but the cable tray, whose inside leaves a plug's width
       of clear drop under it), never under a monitor shelf support, over the knee space, with the wood the shapes
       rules ask for between it and the back edge (misfits, js/shapes.js);
     - the cable tray is under the holes, at the back, clear of the knee space and of the rails;
     - the front corners are rounded when asked, and only then;
     - the cup holder is over the tower shelf, outside the knee space, its insert clear of the tallest mid tower;
     - the pictures are props: never on the cut list, never weighed.
   Then the Gaming desk as Create places it: a grommet in each hole and the insert in its hole, each where the plan
   says and on the shopping list once, with a price; Check my design clean; every piece in one step. */
SELFTESTS.push(function computerDeskStageTwo(problems){withoutDrawing(()=>{
  const R=DESK_RULES,preset=deskPreset(),wrong=text=>{if(problems.length<60)problems.push('computer desk stage 2: '+text);};
  const options=[{holes:true},{holes:true,holeN:'2',holeD:'2.5'},{holes:true,tray:true,strip:true},{holes:true,holeN:'2',tray:true,riser:true},
    {holes:true,riser:true},{holes:true,holeN:'2',riser:true},{holes:true,riser:true,riserSpan:'part',riserW:30},
    {holes:true,holeD:'2.5',riser:true,riserBoard:'1x12'},{round:true},{tower:true,cup:true},{props:true},{props:true,riser:true,tower:true},
    {holes:true,holeN:'2',holeD:'2.5',tray:true,strip:true,round:true,tower:true,cup:true,props:true,riser:true}];
  let built=0,refused=0;
  for(const option of options)for(const drawers of['right','left','both','none'])for(const corner of deskCorners()){
    const vals={...presetDefaults(preset),...option,drawers,...corner},label=JSON.stringify({...option,drawers,...corner})+': ';
    const stops=computerDeskCheck(vals).filter(f=>f.level==='stop');
    if(stops.length){
      refused++;
      if(stops.some(f=>!(f.text&&f.fix)))wrong(label+'refused without a reason and a fix');
      continue;
    }
    built++;
    const plan=computerDeskPlan(vals),parts=buildComputerDesk(vals),top=parts.find(p=>p.name==='Top');
    const wood=parts.filter(p=>!isProp(p));
    const overlapsPlan=(p,lo,hi)=>{const b=plainBox(p);return b.lo[0]<hi[0]-.01&&b.hi[0]>lo[0]+.01&&b.lo[2]<hi[1]-.01&&b.hi[2]>lo[1]+.01;};
    // the holes
    if(vals.holes){
      const feats=shapeFeatures(top).filter(f=>f.kind==='hole'&&f.use==='wire');
      if(feats.length!==+vals.holeN)wrong(label+`${feats.length} cable holes in the top, of ${vals.holeN}`);
      // where each hole is really cut, in the world (from the Top's own place and turn), is where the plan put it
      const cutAt=feats.map(f=>{const c=featureCenter(top,f),[x,,z]=toWorld(top,[[c.u,c.v,0]])[0];return{x,z,d:f.d};});
      for(const hole of plan.holes||[])if(!cutAt.some(c=>Math.abs(c.x-hole.x)<1/32&&Math.abs(c.z-hole.z)<1/32&&Math.abs(c.d-hole.d)<1e-6))wrong(label+`no hole is cut in the top where the plan puts a cable hole (${fmt(hole.x)} from the left end)`);
      for(const hole of cutAt){
        const r=hole.d/2,lo=[hole.x-r,hole.z-r],hi=[hole.x+r,hole.z+r];
        if(hole.x-r<plan.knee.lo-1e-6||hole.x+r>plan.knee.hi+1e-6)wrong(label+`a cable hole at ${fmt(hole.x)} is not over the knee space`);
        // nothing of wood straight under it, from the top down to the floor, but the cable tray
        const under=wood.find(p=>p!==top&&!/^Cable tray/.test(p.name)&&plainBox(p).hi[1]<=plan.H-.75+.01&&overlapsPlan(p,lo,hi));
        if(under)wrong(label+`the ${under.name} is under a cable hole`);
        // no monitor shelf support on the grommet's rim (as HARDWARE.grommet draws it) or in a cord's room round it,
        // measured round the hole from the support pieces themselves
        const rim=Math.max(...HARDWARE.grommet.shape(hole.d).on.filter(s=>s.cyl).map(s=>s.cyl[0]));
        for(const support of wood.filter(p=>p.name==='Monitor shelf support')){
          const b=plainBox(support),dx=Math.max(b.lo[0]-hole.x,0,hole.x-b.hi[0]),dz=Math.max(b.lo[2]-hole.z,0,hole.z-b.hi[2]);
          const gap=Math.hypot(dx,dz)-rim;
          if(gap<R.holes.railClear-1e-6){wrong(label+`a monitor shelf support stands ${gap<=0?'on':fmt(gap)+' from'} the rim of a grommet (it needs ${fmt(R.holes.railClear)} clear of it)`);break;}
        }
        // a plug drops through: with the tray, the whole hole is over its inside (never over its lip)
        if(plan.tray){
          if(lo[1]<plan.tray.inside[0]-1e-6||hi[1]>plan.tray.inside[1]+1e-6)wrong(label+'a cable hole is not wholly over the inside of the cable tray');
          if(hole.x-r<plan.tray.x0-1e-6||hole.x+r>plan.tray.x1+1e-6)wrong(label+'a cable hole is not over the cable tray');
        }
      }
      const shapeSays=shapePieceFindings(top);
      if(shapeSays.length)wrong(label+"the shapes of the top: "+shapeSays[0].text);
    }
    // the tray: at the back, out of the knee box, clear of the rails
    if(plan.tray){
      for(const piece of wood.filter(p=>/^Cable tray/.test(p.name))){
        const b=plainBox(piece);
        if(b.hi[2]>plan.W-R.kneeDepthLeast+1e-6)wrong(label+`the ${piece.name} reaches into the knee space`);
        if(plan.rails.some(x=>b.lo[0]<x+plan.frame.railT+.5&&b.hi[0]>x-.5))wrong(label+`the ${piece.name} runs into a cross rail`);
      }
      // a monitor shelf support over the bay keeps a drill's room off the tray, so its screws can be driven
      if(plan.riser&&plan.riser.supports.some(x=>x-R.drillRoom<plan.tray.x1-1e-6&&x+.75+R.drillRoom>plan.tray.x0+1e-6))wrong(label+'a monitor shelf support has no room for the drill beside the cable tray');
    }
    // the corners
    const rounded=[1,3].every(i=>{const c=shapeCorner(top,i);return c&&c.cut==='round'&&Math.abs(c.r-R.cornerRadius)<1e-6;});
    if(!!vals.round!==rounded)wrong(label+(vals.round?'the front corners of the top are not rounded':'the front corners are rounded and the box is not ticked'));
    if([0,2].some(i=>shapeCorner(top,i)))wrong(label+'a back corner of the top is cut');
    // and in the room: no wood at the very front corners of the top, wood at the back ones
    if(vals.round){
      const b=plainBox(top),y=(b.lo[1]+b.hi[1])/2,near=.1;
      const woodAt=(x,z)=>{const[u,v]=toLocal(top,[x,y,z]);return materialAt(top,u,v,0);};
      const ends=[b.lo[0]+near,b.hi[0]-near];
      if(!ends.every(x=>!woodAt(x,b.hi[2]-near)&&woodAt(x,b.lo[2]+near)))wrong(label+'the rounded corners are not the two front corners of the top in the room');
    }
    // the cup holder
    if(vals.cup&&plan.tower){
      if(!shapeFeatures(top).some(f=>f.kind==='hole'&&f.use==='cup'))wrong(label+'no cup holder hole');
      const c=plan.cup,t=plan.tower;
      if(c.x-c.d/2<t.x0+R.panel-1e-6||c.x+c.d/2>t.x1-R.panel+1e-6)wrong(label+'the cup holder is not over the tower shelf');
      if(c.x+c.d/2>plan.knee.lo+1e-6&&c.x-c.d/2<plan.knee.hi-1e-6)wrong(label+'the cup holder is over the knee space');
      if(c.bottom<t.up+R.towerTall+R.cup.below-1e-6)wrong(label+'the cup holder insert would hit a mid tower on the shelf');
      if(c.z+c.d/2>plan.W-plan.over-plan.apronT-1e-6)wrong(label+'the cup holder is over the front apron');
    }
    // the pictures
    if(vals.props){
      const props=parts.filter(isProp);
      if(!props.some(p=>p.name==='Monitor'))wrong(label+'no monitor in the picture');
      if(plan.props.tower&&!props.some(p=>p.name==='PC tower'))wrong(label+'no computer tower in the picture');
      if(!plan.props.tower&&!plan.props.why)wrong(label+'the tower is not shown and nothing says why');
      if(plan.tower&&plan.props.tower&&Math.abs(plan.props.tower.y-plan.tower.up)>1e-6)wrong(label+'the computer tower does not stand on the tower shelf');
      if(props.some(p=>!['monitor','pctower'].includes(p.mat)))wrong(label+'a picture is not a prop');
      // the size lines in the 3D view and on the Views with sizes leave out what is marked a picture only
      if(props.some(p=>!M[p.mat].picture))wrong(label+'a picture of a monitor or a tower would be counted in the overall size');
    }else if(parts.some(isProp))wrong(label+'a picture is drawn with the box unticked');
  }
  if(!built)wrong('nothing could be built');
  SELFTESTS.computerDeskStageTwo={built,refused};
  // the Gaming desk as Create places it
  const kept=JSON.stringify(S),tabKept=tab;
  try{
    const vals={...presetDefaults(preset),...GAMING_DESK_START},plan=computerDeskPlan(vals);
    const said=computerDeskCheck(vals);
    if(said.length){wrong('the Gaming desk start is not clean: '+said[0].text);return;}
    load(JSON.stringify(blank()),true);
    placePreset(preset,vals,preset.build(vals),false);
    const top=S.parts.find(p=>p.name==='Top');
    const grommets=hardwareList().filter(item=>item.kind==='grommet');
    if(grommets.length!==plan.holes.length)wrong(`the Gaming desk has ${grommets.length} grommets for ${plan.holes.length} cable holes`);
    // each grommet in a hole really cut in the top (the hole's place in the room, from the Top as placed)
    const cut=shapeFeatures(top).filter(f=>f.kind==='hole'&&f.use==='wire').map(f=>{const c=featureCenter(top,f),[x,,z]=toWorld(top,[[c.u,c.v,0]])[0];return{x,z};});
    for(const item of grommets){
      const pose=hardwarePose(item);
      if(item.on!==top.id||pose.n.y<.5||!cut.some(hole=>Math.abs(pose.at.x-hole.x)<1/32&&Math.abs(pose.at.z-hole.z)<1/32))wrong('a grommet is not in a hole cut in the top, on its top face');
    }
    // the power strip's two screws go into the tray bottom while it is loose, in the step that builds the tray: under
    // the top a drill cannot stand on the tray's floor
    const planned=buildPlan(),trayPiece=S.parts.find(p=>p.name==='Cable tray bottom');
    const stripAt=planned.steps.findIndex(step=>(step.hardware||[]).some(line=>line.kind==='strip'));
    if(!trayPiece||stripAt<0||planned.stepOfPiece.get(trayPiece.id)!==stripAt)wrong('the power strip\'s screws are not driven in the step that builds the cable tray, while it is loose');
    if(!hardwareFamily('Round-head wood screws, #8 × 3/4", for the power strip')||hardwareFamily('Round-head wood screws, #8 × 3/4", for the power strip').id!=='round-head-screws')wrong('the power strip\'s two screws are not priced as a small pack of round-head screws');
    let rows=hardwareTotals(findJoints()).rows;
    const once=(label,count)=>{
      const got=rows.filter(row=>row[0]===label).reduce((sum,row)=>sum+row[1],0);
      if(got!==count)wrong(`the shopping list has ${got} of "${label}", not ${count}`);
      if(typeof hardwareFamily==='function'&&!hardwareFamily(label))wrong(`"${label}" has no price`);
    };
    once(HARDWARE.grommet.buy(plan.holes[0].d),plan.holes.length);
    if(rows.some(row=>/cup holder/i.test(row[0])))wrong('the Gaming desk buys a cup holder it does not have');
    const props=S.parts.filter(isProp);
    if(!props.length)wrong('the Gaming desk shows no monitor or tower');
    if(cutRows().rows.some(row=>M[row.mat]&&M[row.mat].kind==='prop'))wrong('a picture is on the cut list');
    const found=verifyDesign(S.parts,designCheckOptions()).problems;
    if(found.length)wrong('Check my design says of the Gaming desk: '+found[0].text);
    const stepOf=buildPlan().stepOfPiece;
    const missing=S.parts.find(p=>!stepOf.has(p.id));
    if(missing)wrong(`the ${missing.name} of the Gaming desk is in no build step`);
    // with the cup holder: its insert in its hole, on the list once
    const withCup={...vals,cup:true},cupPlan=computerDeskPlan(withCup);
    if(computerDeskCheck(withCup).some(f=>f.level==='stop'))wrong('the Gaming desk with the cup holder is refused');
    else{
      load(JSON.stringify(blank()),true);
      placePreset(preset,withCup,preset.build(withCup),false);
      const insert=hardwareList().filter(item=>item.kind==='cupinsert');
      if(insert.length!==1||Math.abs(hardwarePose(insert[0]).at.x-cupPlan.cup.x)>.02)wrong('the cup holder insert is not in its hole');
      rows=hardwareTotals(findJoints()).rows;
      once(HARDWARE.cupinsert.buy(),1);
    }
  }finally{load(kept,true);setTab(tabKept);}
});});
