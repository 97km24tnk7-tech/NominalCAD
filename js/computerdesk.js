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
     a space for a computer tower at one end, walled off by a tower panel
     "Check it against my room": four measurements, and plain words on whether the desk fits (R1 to R4)

   THE FORM opens short (the owner: "most of the options hidden behind check boxes"). The rows everyone sets and the
   option boxes come first; an option's own rows show only while its box is ticked (under() in js/presets.js, the
   generic helper, which draws them indented). The details of the drawers, the tower space and the hook are in the
   "More options" fold of the catalog entry (entry.short, js/presetentry.js).

   IN THIS FILE
     DESK_RULES               every number, with where it comes from
     computerDeskPlan(p)      the whole design worked out once, nothing drawn: the Desk's frame plan, the cross
                              rails (deskRails, spaced again from a tower panel), the drawer case of each stack
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
  // the tower space
  towerInside:11,        // inches between the end legs and the tower panel [22 l.336]
  towerLeast:24,         // a mid tower 18"-20" tall and 4" of air over it [22 l.333, l.337] (CD14)
  fullTower:31,          // a full tower with its air space [22 l.338] (CD16)
  panel:.75,             // the tower panel is 3/4" plywood
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
};
const COMPUTER_DESK_DEFAULTS={L:60,W:30,H:30,drawers:'right',N:'3',caseW:16,fh:7,slides:'slide',fronts:'overlay',
  riserBoard:'1x10',riserSpan:'full',riserW:36,towerSide:'left',hookSide:'away'};
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
    hook:!!p.hook,hookSide:['left','right'].includes(p.hookSide)?p.hookSide:'away',
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
  const plan={v,frame,L,W,H,legH,leg,over,apronT,apronDepth,caseHeight,problems,changed,chose,stacks:[],tower:null,riser:null,strip:null,hook:null};

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

  // ---- the tower space, at the end with no drawers ----
  if(v.tower){
    const side=v.drawers==='right'?'left':v.drawers==='left'?'right':v.towerSide;
    const x=side==='left'?over+leg+R.towerInside:L-over-leg-R.towerInside-R.panel;
    plan.tower={side,x};
    if(v.drawers!=='none')chose.push(`The tower space is at the ${side} end, the end without drawers.`);
  }

  // ---- the knee space: between whatever stands at its two ends ----
  const leftWall=Math.max(over+leg,...plan.stacks.filter(s=>s.side==='left').map(s=>s.x1),plan.tower&&plan.tower.side==='left'?plan.tower.x+R.panel:0);
  const rightWall=Math.min(L-over-leg,...plan.stacks.filter(s=>s.side==='right').map(s=>s.x0),plan.tower&&plan.tower.side==='right'?plan.tower.x:Infinity);
  plan.knee={lo:leftWall,hi:rightWall,width:r16(rightWall-leftWall),room:frame.kneeRoom,depth:r16(W-over-apronT)};

  // ---- the cross rails: the Desk's, or spaced again from the tower panel ----
  plan.rails=deskRails(plan);

  // ---- what cannot work ----
  if((ends.length||plan.tower)&&plan.knee.width<R.kneeLeast-1e-6){
    const takenBy=[ends.length===2?'the drawers at both ends':ends.length?`the drawers at the ${ends[0]} end`:'',plan.tower?'the tower space':''].filter(Boolean).join(' and ');
    const least=Math.ceil(R.kneeLeast+2*(over+leg)+ends.length*v.caseW+(plan.tower?R.towerInside+R.panel:0)-1e-6);
    // only the ways that really give 30": each is worked out, none is offered because it merely helps
    const short=R.kneeLeast-plan.knee.width,towerTakes=plan.tower?R.towerInside+R.panel:0;
    const narrowest=ends.length?floor16(v.caseW-short/ends.length+1e-6):0;   // the widest case that still leaves 30"
    const ways=[
      least<=R.maxL?`Make the desk at least ${typedLen(least)} wide`:'',
      ends.length&&narrowest>=R.caseMinW&&narrowest<v.caseW?`make the drawer case ${typedLen(narrowest)} wide or less (under More options)`:'',
      ends.length===2&&plan.knee.width+v.caseW>=R.kneeLeast-1e-6?'put the drawers at one end only':'',
      ends.length&&plan.knee.width+ends.length*v.caseW>=R.kneeLeast-1e-6?'choose No drawers':'',
      plan.tower&&plan.knee.width+towerTakes>=R.kneeLeast-1e-6?'leave out the tower space':''].filter(Boolean);
    if(!ways.length)ways.push(ends.length?'choose No drawers and leave out the tower space':'leave out the tower space');
    problems.push({level:'stop',
      text:`With ${takenBy}, only ${fmt(plan.knee.width)} is left for your knees and the chair. A desk needs at least ${fmt(R.kneeLeast)} there.`,
      fix:capitalFirst(listWithOr(ways))+'.'});
  }
  if(plan.tower&&plan.knee.room<R.towerLeast-1e-6){
    // Only the changes that really give 24" under the apron (a 2x6 apron takes 2" more off the room under it): a
    // higher desk, a narrower one (so the aprons stay 2x4), or both. Each is tried with the Desk's own frame rule.
    const roomAt=(width,height)=>tablePlan(tableArgs('Desk',{L:width,W:v.W,H:height})).kneeRoom;
    const enough=(width,height)=>roomAt(width,height)>=R.towerLeast-1e-6;
    let widest=0,widestHigh=0;
    for(let width=R.minL;width<=Math.floor(L);width++){
      if(enough(width,H))widest=width;
      if(enough(width,R.maxH))widestHigh=width;
    }
    const ways=[];
    if(H<R.maxH-1e-6&&enough(L,R.maxH))ways.push(`Make the desk ${typedLen(R.maxH)} high`);
    if(widest&&widest<L)ways.push(`make it ${typedLen(widest)} wide or less, so the aprons stay ${M[frame.baseApron].short}`);
    else if(H<R.maxH-1e-6&&widestHigh&&widestHigh<L&&!enough(L,R.maxH))ways.push(`make it ${typedLen(R.maxH)} high and ${typedLen(widestHigh)} wide or less`);
    ways.push('stand the tower on the floor beside the desk');
    problems.push({level:'stop',
      text:`A mid tower is about 18" to 20" tall and needs about 4" of air above it, so the tower space needs ${fmt(R.towerLeast)} under the front apron. At this size there is ${fmt(plan.knee.room)}.`,
      fix:capitalFirst(listWithOr(ways))+'.'});
  }

  // ---- the tip check: the top drawer of each stack pulled all the way out, full ----
  // (worked out from the pieces, in computerDeskTip, so the plan itself stays free of them)

  // ---- the monitor shelf ----
  if(v.riser){
    plan.riser=deskRiser(plan);
    if(plan.riser.failed){
      const near=deskRiserWidthsThatWork(plan);
      problems.push({level:'stop',
        text:`At this width the monitor shelf has no place for its supports where a drill held straight up under the top can reach their screws, with every bay short enough for the shelf.`,
        fix:near.length?`Make the shelf ${listWithOr(near.map(width=>typedLen(width)))} wide.`:'Choose As wide as the desk, or leave out the monitor shelf.'});
    }
  }
  // ---- the power strip: in the bay over the knee space nearest its middle ----
  if(v.strip)plan.strip=deskStripBay(plan);
  // ---- the hook: on the end away from the drawers unless the person picked an end ----
  if(v.hook){
    const away=v.drawers==='left'?'right':'left';
    plan.hook={side:v.hookSide==='away'?away:v.hookSide};
    if(v.hookSide==='away')chose.push(`The hook is on the ${plan.hook.side} end${ends.length===1?', away from the drawers':''}.`);
  }
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
    const pieces=deskPieces(plan),edge=plan.W-plan.over;
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

/* The cross rails under the top, as the x of each one's left face. Without a tower panel they are exactly the
   Desk's (tablePlan: evenly between the middles of the two short aprons). With one, the bay on each side of the
   panel is spaced by the same rule (no more than surfaceReach or TABLE_RULES.sheetRailGap apart, and each rail
   strong enough for its strip: railFits), from the middle of the panel to the middle of the short apron, so no
   rail is ever built in the tower space or near the panel (CD15). */
function deskRails(plan){
  const f=plan.frame,railT=f.railT;
  if(!plan.tower){
    const rails=[];
    for(let i=1;i<=f.railCount;i++)rails.push(f.over+i*f.railStep);
    return rails;
  }
  const gap=Math.min(surfaceReach(f.topMat,f.use),TABLE_RULES.sheetRailGap);
  const spaced=(from,to)=>{
    const between=to-from;
    let count=Math.max(0,Math.ceil(between/gap-1e-6)-1);
    while(count<20&&!railFits(f.railMat,f.crossSpan,between/(count+1),f.use))count++;
    const step=between/(count+1),rails=[];
    for(let i=1;i<=count;i++)rails.push(r16(from+i*step-railT/2));
    return rails;
  };
  const panelMiddle=plan.tower.x+DESK_RULES.panel/2,leftApron=f.over+plan.apronT/2,rightApron=plan.L-f.over-plan.apronT/2;
  return spaced(leftApron,panelMiddle).concat(spaced(panelMiddle,rightApron));
}

/* The x ranges under the top that a drill held straight up cannot pass through, in the strip of depth z0..z1:
   legs, short aprons, cross rails, the tower panel and the sides of a drawer case. */
function deskDrillBlocks(plan,z0,z1){
  const blocks=[],{L,over,leg,apronT}=plan,overlapsZ=(a,b)=>a<z1&&b>z0;
  for(const x of[over,L-over-leg])for(const z of[over,plan.W-over-leg])if(overlapsZ(z,z+leg))blocks.push([x,x+leg]);
  if(overlapsZ(over+leg,plan.W-over-leg)){blocks.push([over,over+apronT]);blocks.push([L-over-apronT,L-over]);}
  for(const x of plan.rails)blocks.push([x,x+plan.frame.railT]);
  if(plan.tower)blocks.push([plan.tower.x,plan.tower.x+DESK_RULES.panel]);
  for(const s of plan.stacks){blocks.push([s.x0,s.x0+.75]);blocks.push([s.x1-.75,s.x1]);}
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
/* The bay of the back apron the power strip goes in: between rails (and the tower panel), long enough for the
   strip and 1" each side, over the knee space, the one whose middle is nearest the middle of the knee space. */
function deskStripBay(plan){
  const R=DESK_RULES.strip,{L,over,leg}=plan;
  const blocks=plan.rails.map(x=>[x,x+plan.frame.railT]);
  if(plan.tower)blocks.push([plan.tower.x,plan.tower.x+DESK_RULES.panel]);
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

/* ---------- the pieces ---------- */
function buildComputerDesk(p){
  return deskPieces(computerDeskPlan(p));
}
function deskPieces(plan){
  const v=plan.v,f=plan.frame,{L,W,H,legH,over,apronT}=plan;
  // the Desk's own top, legs and aprons; the cross rails are added here, where the plan put them
  const parts=buildTable({...f,railCount:0});
  const railDepth=M[f.railMat].w;
  for(const x of plan.rails)parts.push(mk('Cross rail',f.railMat,[f.railT,railDepth,W-2*over-2*apronT],[x,legH-railDepth,over+apronT]));
  // (sizes that leave no knee space at all, which the warning box refuses, get the frame alone: the cases would overlap)
  if(plan.knee.width>0){
    if(plan.tower)parts.push(mk('Tower panel','ply34',[DESK_RULES.panel,legH,W-2*over-2*apronT],[plan.tower.x,0,over+apronT]));
    for(const stack of plan.stacks)parts.push(...deskCasePieces(plan,stack));
  }
  const riser=plan.riser;
  if(riser&&!riser.failed){
    const supportM=M[DESK_RULES.riserSupport];
    for(const x of riser.supports)parts.push(mk('Monitor shelf support',DESK_RULES.riserSupport,[supportM.t,supportM.w,riser.supportLen],[x,H,riser.z0]));
    parts.push(mk('Monitor shelf',riser.mat,[riser.length,M[riser.mat].t,riser.depth],[riser.x0,riser.y,0]));
  }
  return parts;
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
    const pieces=deskPieces(plan),edge=plan.W-plan.over;
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
   said and nothing assumed. */
function deskRoomFindings(plan){
  const R=DESK_RULES,v=plan.v,found=[];
  if(!v.room)return found;
  if(v.space>0){
    const spare=r16(v.space-plan.L);
    if(spare>=0)found.push({fits:true,text:`The desk is ${typedLen(plan.L)} wide and your space ${typedLen(v.space)}: ${spare?`${fmt(r16(spare/2))} to spare at each end when it is centered`:'it just fits, with nothing to spare'}.`});
    else found.push({fits:false,text:`The desk is ${typedLen(plan.L)} wide and your space is ${typedLen(v.space)}: it is ${fmt(-spare)} too wide.`,
      fix:v.space>=R.minL?`Make it ${typedLen(Math.floor(v.space))} wide or less.`:`This desk is at least ${typedLen(R.minL)} wide. Measure the space again, or find a wider spot.`});
  }
  if(v.sill>0){
    const spare=r16(v.sill-plan.H);
    if(spare>=R.sillRoom-1e-6){
      found.push({fits:true,text:`The top is ${typedLen(plan.H)} high and the underside of your sill is at ${typedLen(v.sill)}: the back of the desk tucks under it with ${fmt(spare)} to spare.`});
      if(plan.riser&&plan.riser.top>v.sill)found.push({fits:true,text:`The monitor shelf stands ${fmt(r16(plan.riser.top-v.sill))} above the sill and covers the bottom of the window by that much.`});
    }else{
      const lowest=floor16(v.sill-R.sillRoom);
      found.push({fits:false,text:`The top is ${typedLen(plan.H)} high and the underside of your sill is at ${typedLen(v.sill)}, so the desk cannot slide under the sill: it will stand out from the wall by however far the sill sticks out.`,
        fix:lowest>=R.minH?`Make the desk ${typedLen(lowest)} high or lower, or measure how far the sill sticks out and leave that gap.`:`Measure how far the sill sticks out and leave that gap behind the desk (it cannot be made lower than ${typedLen(R.minH)}).`});
    }
  }
  if(v.arms>0){
    const apron=plan.knee.room,spare=r16(apron-v.arms);
    if(spare>=R.armRoom-1e-6)found.push({fits:true,text:`Your chair arms (${typedLen(v.arms)}) slide under the front apron (${fmt(apron)}) with ${fmt(spare)} to spare.`});
    else{
      // What really gives the arms room: a higher top raises the apron with it (the desk goes to 30" at most);
      // otherwise the chair has to change. The front apron stays: it is what holds up the front edge of the top.
      const higher=r16(tablePlan(tableArgs('Desk',{L:plan.L,W:plan.W,H:R.maxH})).kneeRoom),fitsHigher=plan.H<R.maxH-1e-6&&higher-v.arms>=R.armRoom-1e-6;
      const lowest=r16(apron-R.armRoom);
      const fix=fitsHigher
        ?`Make the desk ${typedLen(R.maxH)} high: the front apron is then ${fmt(higher)} off the floor. Or lower the chair until its arms are ${fmt(lowest)} or lower.`
        :`Lower the chair until its arms are ${fmt(lowest)} or lower, push the arms down or take them off if they adjust, or use a chair with lower arms. This desk keeps its front apron, which holds up the front edge of the top, so the room under it cannot be made higher than ${fmt(Math.max(apron,higher))}.`;
      found.push(spare>0
        ?{fits:false,text:`Your chair arms (${typedLen(v.arms)}) only just pass under the front apron (${fmt(apron)} off the floor): ${fmt(spare)} to spare, so they may rub.`,fix}
        :{fits:false,text:`Your chair arms are ${typedLen(v.arms)} high and the front apron is ${fmt(apron)} off the floor: the arms stop against it, ${fmt(-spare)} short, so the chair cannot pull in all the way.`,fix});
    }
  }
  if(v.chairW>0){
    const needed=v.chairW+2*R.chairSide,spare=r16((plan.knee.width-v.chairW)/2);
    if(plan.knee.width>=needed-1e-6)found.push({fits:true,text:`Your chair (${typedLen(v.chairW)} across the arms) rolls into the ${fmt(plan.knee.width)} knee space with ${fmt(spare)} to spare at each side.`});
    else{
      // only the ways that really give the room: each is worked out
      const short=needed-plan.knee.width,stacks=plan.stacks.length,towerTakes=plan.tower?R.towerInside+R.panel:0;
      const wider=Math.ceil(plan.L+short-1e-6),narrowest=stacks?floor16(v.caseW-short/stacks+1e-6):0;
      const ways=[wider<=R.maxL?`make the desk ${typedLen(wider)} wide or more`:'',
        stacks&&narrowest>=R.caseMinW&&narrowest<v.caseW?`make the drawer case ${typedLen(narrowest)} wide or less (under More options)`:'',
        stacks===2&&v.caseW>=short-1e-6?'put the drawers at one end only':'',
        stacks&&stacks*v.caseW>=short-1e-6?'choose No drawers':'',
        plan.tower&&towerTakes>=short-1e-6?'leave out the tower space':''].filter(Boolean);
      found.push({fits:false,text:plan.knee.width>v.chairW
          ?`Your chair is ${typedLen(v.chairW)} across the arms and the knee space is ${fmt(plan.knee.width)} wide: it rolls in with less than ${fmt(R.chairSide)} each side and will knock the drawers or the legs.`
          :`Your chair is ${typedLen(v.chairW)} across the arms and the knee space is ${fmt(plan.knee.width)} wide: it will not roll in.`,
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
    notes.push(`${fmt(R.kneeEasy)} or more of knee space lets a chair with arms swing in and out easily${easy<=R.maxL?`: a Width of ${typedLen(easy)} gives that`:''}.`);
  }
  if(plan.knee.room<TABLE_RULES.kneeRoom-1e-6)notes.push(`There is ${fmt(plan.knee.room)} of knee room under the aprons. Most chairs want about ${fmt(TABLE_RULES.kneeRoom)}, so try your chair first or raise the top.`);
  if(plan.tower)notes.push(`A full tower (about ${fmt(R.fullTower)} tall with its air space) does not fit under a ${typedLen(plan.H)} desk. Stand it on the floor beside the desk.`);
  if(plan.riser){
    if(plan.riser.frontRoom<R.roomInFront-1e-6)notes.push(`There is ${fmt(plan.riser.frontRoom)} of desk in front of the monitor shelf. About ${fmt(R.roomInFront)} leaves room for a keyboard and your forearms.`);
    const[low,high,on]=R.screenOnStand,raise=plan.H-on;
    notes.push(`On a ${typedLen(plan.H)} desk a 24" monitor on its own stand reaches ${fmt(r16(low+raise))} to ${fmt(r16(high+raise))} at its top; the shelf raises it ${fmt(plan.riser.rise)} more. The top of the screen is best ${fmt(R.screen[0])} to ${fmt(R.screen[1])} off the floor when you sit: lower the stand if it ends up higher.`);
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
    lines.push(`With the monitor shelf it comes out ${fmt(plan.riser.top)} tall overall instead of ${typedLen(plan.H)}: the top of the desk stays at the ${typedLen(plan.H)} typed in Height and the shelf stands ${fmt(plan.riser.rise)} above it.`);
  }
  lines.push(tableTopWords('Desk','std'));
  const first=deskFormNotes(plan)[0];
  if(first)lines.push(first);
  if(plan.strip||plan.hook)lines.push(`The ${plan.strip&&plan.hook?'power strip and the hook are':plan.strip?'power strip is':'hook is'} put in place when you create the design.`);
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
  notes.push(`A monitor arm's clamp needs about 4" of clear wood under the back edge. The back apron is ${fmt(plan.over)} in from the edge, so a clamp will not fit: use an arm with a grommet mount once the desk has cable holes.`);
  if(plan.strip)notes.push(`Power strip: any strip about ${fmt(R.strip.length)} long with keyhole slots on its back hangs on two screws low on the inside of the back apron, over the knee space, so the cords stay off the floor. Its screws go in under the pocket holes along the top of the apron.`);
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
  }
  if(plan.strip){
    rows.push([HARDWARE.strip.buy(),1]);
    rows.push(['Round-head wood screws, #8 × 3/4", for the power strip',2]);
  }
  if(plan.hook)rows.push([HARDWARE.hook.buy(),1]);
  rows.push([R.banding.label,Math.max(1,Math.ceil(deskBandingFeet(plan)/R.banding.roll-1e-6))]);
  return rows;
}
/* The plywood edges a person sees, each banded: [{words, inches}].
   The top: its front edge and both ends. Each drawer front: all four edges. The tower panel: its front edge.
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
  const list=[{words:'the front edge and both ends of the top',inches:plan.L+2*plan.W}];
  let fronts=0;
  for(const stack of plan.stacks){
    const front=stack.layout.drawer.front;
    fronts+=stack.layout.drawers*2*(front.width+front.height);
  }
  if(fronts)list.push({words:'all four edges of each drawer front',inches:fronts});
  if(plan.tower)list.push({words:'the front edge of the tower panel',inches:plan.legH});
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
  if(plan.strip){
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
  // the edges that show are banded while every piece is loose
  steps.push({t:`Band the edges that show, while every piece is loose: iron edge banding onto ${listWords(deskBandedEdges(plan))}. Set a household iron to cotton with no steam, press the banding on with its glue side down, let it cool, then trim the overhang flush with an edge banding trimmer or a sharp chisel and ease the corners with sandpaper.`,add:[]});
  frameSteps.forEach((step,index)=>{
    if(step.add.includes('Cross rail')&&plan.tower){if(plan.rails.length)steps.push(deskRailStep(plan));return;}
    if(index===topIndex){
      if(plan.tower)steps.push(deskTowerStep(plan));
      steps.push(deskTopStep(plan,step));
      return;
    }
    steps.push(step);
  });
  if(stacks.length)steps.push(...deskCaseSteps(plan));
  if(plan.riser)steps.push(...deskRiserSteps(plan));
  // the drawer boxes are built, then everything is sanded and finished while no hardware is on it; the slides,
  // the fronts and the pulls go on after the finish is dry
  const drawerSteps=stacks.length?deskDrawerSteps(plan):{boxes:[],afterFinish:[]};
  steps.push(...drawerSteps.boxes);
  steps.push(FIN);
  steps.push(...drawerSteps.afterFinish);
  const hardware=[plan.strip?'strip':'',plan.hook?'hook':''].filter(Boolean);
  if(hardware.length){
    const strip=plan.strip?`Hang the power strip on the inside face of the back apron, over the knee space, with its outlets facing you, low on the apron: its bottom edge ${fmt(DESK_RULES.strip.lift)} above the bottom edge of the apron, so its screws go in under the pocket holes along the top of the apron. ${HARDWARE.strip.mount}`:'';
    const hook=plan.hook?`Screw the hook to the outside face of the ${plan.hook.side} short apron, near the back of that end, under the overhang of the top, low on the apron: its plate ${fmt(DESK_RULES.hookLift)} above the bottom edge of the apron, so its screws stay clear of the screws that hold the top. ${HARDWARE.hook.mount}`:'';
    steps.push({t:[strip,hook].filter(Boolean).join(' '),add:[],hardware});
  }
  steps.push({t:`Stand the desk in its place. Leave about ${fmt(R.wallGap)} between the back of the desk and the wall, so the cables can drop down behind it. Run them over the back edge and under the back apron${plan.strip?' to the power strip':''}.`,add:[]});
  return steps;
}
/* the cross rails when a tower panel stands at one end: the places the plan gave them, from the outside face of the left end frame */
function deskRailStep(plan){
  const middles=plan.rails.map(x=>fmt(r16(x-plan.over+plan.frame.railT/2))),one=middles.length===1;
  const where=one?`with its middle ${middles[0]} from the outside face of the left end frame`
    :`with their middles ${middles.slice(0,-1).join(', ')} and ${middles[middles.length-1]} from the outside face of the left end frame`;
  const place=`Fasten the ${one?'cross rail':middles.length+' cross rails'} between the long aprons, on edge and flush with their top edges, ${where}. Mark those places on both aprons first. No rail goes in the tower space.`;
  // (drillRail: the sentence that tells to drill the rail's pocket holes, left out while step 2 "Drill your pieces"
  //  holds them: the step's drill field, js/drillplan.js)
  const drillRail=' Drill those holes, and the holes along its top edge that will hold the top, before the rail goes in.';
  const fromRail=` Drive the pocket screws listed below from the holes in each end of ${one?'the rail':'a rail'} into the apron.${drillRail} Nothing goes through the front apron.`;
  const throughApron=` Drive two screws through each apron into each end of ${one?'the rail':'a rail'}.`;
  const carries=` The top rests on ${one?'it':'these'}, so it cannot sag in the middle.`;
  return styledStep({std:place+fromRail+carries,fine:place+fromRail+carries,rustic:place+throughApron+carries},['Cross rail'],[drillRail]);
}
function deskTowerStep(plan){
  const R=DESK_RULES,side=plan.tower.side;
  const place=`Stand the tower panel between the two long aprons, from the floor up to their top edges, ${fmt(R.towerInside)} in from the inside faces of the two ${side} legs: mark that place on the inside of both aprons first. It walls off the space for a computer tower at the ${side} end, open at the front and the back for the air.`;
  const drillPanel=' Drill those holes, and the ones along its top edge that will hold the top, before it goes in.';
  return styledStep({
    std:place+' Drive the pocket screws listed below from the holes near its front and back edges, on the face toward the knee space, into the aprons.'+drillPanel,
    rustic:place+' Drive the screws listed below in through each apron into its front and back edges.'},['Tower panel'],[drillPanel]);
}
/* the Desk's own step for the top, told that the desk stays upside down when a drawer case goes in next, and that
   a tower panel is screwed to the top as well */
function deskTopStep(plan,step){
  const withCase=plan.stacks.length>0,panel=!!plan.tower;
  const edit=words=>{
    let text=words;
    if(panel)text=text.replace(' up into the underside of the top',', and from the holes along the top edge of the tower panel, up into the underside of the top')
      .replace(' along the aprons',' along the aprons and the tower panel');
    if(withCase)text=text.replace(/ Turn it right side up\.$/,` Leave it upside down: the drawer case${plan.stacks.length>1?'s go':' goes'} in next, from this side.`);
    return text;
  };
  const byStyle=step.byStyle||{std:step.t,rustic:step.t,fine:step.t};
  return styledStep({std:edit(byStyle.std),rustic:edit(byStyle.rustic),fine:edit(byStyle.fine)},step.add,step.drill);
}
function deskCaseSteps(plan){
  const v=plan.v,R=DESK_RULES,two=plan.stacks.length===2;
  const theCase=two?'each drawer case':'the drawer case',cases=two?'the two drawer cases, the same way':'the drawer case';
  const s=plan.stacks[0],shelfHeight=s.layout.openHeight;
  const steps=[];
  steps.push(styledStep({
    std:`Build ${cases}. Fasten the bottom between the two sides, ${fmt(NS.kick)} up from the floor, and the two top rails between the sides flush with the top: one flush with the front edge, one flush with the back edge. First drill the pocket holes listed below in the underside of the bottom and of each rail, near their ends. Then glue each joint and drive the pocket screws into the sides, so nothing shows on the outside.`,
    rustic:`Build ${cases}. Fasten the bottom between the two sides, ${fmt(NS.kick)} up from the floor, and the two top rails between the sides flush with the top: one flush with the front edge, one flush with the back edge. Glue each joint, drill pilot holes, and drive the screws through the outside of the sides into the ends of the bottom and the rails.`},['Side','Bottom','Top rail'],
    [' First drill the pocket holes listed below in the underside of the bottom and of each rail, near their ends.']));
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
  // each top rail lies partly under its apron: its screws go in the middle of that strip
  const backStrip=r16(plan.over+plan.apronT-s.sidesFrom),frontStrip=r16(s.front-(plan.W-plan.over-plan.apronT));
  const lines=`each screw in the middle of the strip of rail that lies under the apron: ${fmt(r16(backStrip/2))} in from the back edge of the back rail, ${fmt(r16(frontStrip/2))} in from the front edge of the front rail`;
  const setIn=`lower ${two?'each case':'the case'} in upside down ${where}, between the legs and under the aprons: its outer side against the inside faces of the two end legs, its back panel flush with the back faces of the back legs, and ${front}. Its two top rails lie on the long aprons. From inside the case, drive the screws listed below through each top rail into the apron, ${lines}. Then get a helper and turn the desk right side up: the case stands on the floor, and nothing of it is in the knee space.`;
  steps.push({...styledStep({std:`Set ${theCase} in. The desk is still upside down on its blanket from the step that put the top on: ${setIn}`,
    rustic:`Set ${theCase} in. Get a helper and turn the desk upside down on a blanket, then ${setIn}`},[]),bring:plan.stacks.map(deskCaseOf)});
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
  const pulls='Then drill for the pull in the middle of each front and bolt it on.';
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
    'Monitor shelf':'shelf','Monitor shelf support':'shelf','Tower panel':'tableTop'};
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
  // the tower panel: pocket holes on its knee-side face, into the top and the aprons (Rustic screws through them)
  ['Tower panel','Top','pocketUnlessRustic'],['Tower panel','Long apron','pocketUnlessRustic'],
  // the monitor shelf: its supports screwed up through the top from underneath, the shelf screwed down under plugs
  ['Monitor shelf support','Top','screw'],['Monitor shelf','Monitor shelf support','pluggedUnlessRustic']];

PRESETS.push({
  name:'Computer desk',tile:'Computer desk',spec:'Drawers and a knee space',icon:'i-presets',hidden:true,
  desc:'The plain Desk with a stack of drawers on real slides at one end and an open knee space for the chair. Every other option is a check box: a monitor shelf, a power strip, a tower space, a hook, and a check against your own room.',
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
    {k:'tower',label:'Space for a computer tower at one end',check:1,v:false,show:p=>p.drawers!=='both'},
    ...under('tower',[{k:'towerSide',label:'Tower space at the',opts:[['left','Left end'],['right','Right end']],v:COMPUTER_DESK_DEFAULTS.towerSide,show:p=>p.drawers==='none'}],
      value=>!!value),
    {k:'hook',label:'Hook for headphones',check:1,v:false},
    ...under('hook',[{k:'hookSide',label:'Hook on the',opts:[['away','End away from the drawers'],['left','Left end'],['right','Right end']],v:COMPUTER_DESK_DEFAULTS.hookSide}])],
  build:buildComputerDesk,check:computerDeskCheck,info:computerDeskInfo,notes:computerDeskNotes,steps:computerDeskSteps,hw:computerDeskHardware,
  // the preset rule: what each piece carries, and that the drawer sides hang on their slides until the slides are placed
  uses:computerDeskUses,hung:['Drawer side'],joints:COMPUTER_DESK_JOINTS,afterPlace:computerDeskAfterPlace,
  // every other layout the structural check must also pass at every limit (none ticks "Check it against my room")
  variants:[{drawers:'left'},{drawers:'both',L:72},{drawers:'none'},{N:'2'},{N:'4'},{cub:true},{slides:'runner'},{fronts:'inset'},
    {riser:true},{riser:true,riserBoard:'1x12',riserSpan:'part'},{drawers:'none',tower:true},{drawers:'none',tower:true,towerSide:'right'},
    {strip:true,hook:true},{L:72,riser:true,strip:true,tower:true,hook:true}],
});
/* the start of the Gaming desk entry (js/catalog.js): the same builder with the options shown off */
const GAMING_DESK_START={L:72,riser:true,strip:true,tower:true,hook:true};
/* its own description (the tile's tooltip and the line over the form): what it starts with, and where the options
   that are ticked but folded away are */
const GAMING_DESK_WORDS='The Computer desk at 6 ft wide, set up for a gaming computer: a monitor shelf across the back, a power strip under the back of the top, a stack of drawers at the right end and a space for a computer tower at the left end, open at the front and the back for air, with a hook for headphones. The tower space and the hook are ticked under More options; untick anything you do not want.';
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
  const tower66=computerDeskCheck({...presetDefaults(preset),L:66,tower:true}),tower67=computerDeskCheck({...presetDefaults(preset),L:67,tower:true});
  if(!tower66.some(f=>f.level==='stop')||tower67.some(f=>f.level==='stop'))wrong('a tower space and a drawer stack are not refused at 66" and built at 67"');
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
/* The tower space: open front and back, 11" wide inside, nothing in it, the panel from the floor to the top, no rail
   within 1 1/2" of the panel; the power strip in a bay over the knee space at every width; the hook on a short apron. */
SELFTESTS.push(function computerDeskTowerAndHardware(problems){withoutDrawing(()=>{
  const R=DESK_RULES,preset=deskPreset(),wrong=text=>problems.push('computer desk: '+text);
  for(const extra of[{drawers:'none',tower:true},{drawers:'none',tower:true,towerSide:'right'},{tower:true,L:72},{drawers:'left',tower:true,L:72}]){
    for(const corner of deskCorners()){
      const vals={...presetDefaults(preset),...extra,...corner};
      if(computerDeskCheck(vals).some(f=>f.level==='stop'))continue;
      const plan=computerDeskPlan(vals),parts=buildComputerDesk(vals),label=JSON.stringify({...extra,...corner})+': ';
      const panel=parts.find(p=>p.name==='Tower panel');
      if(!panel){wrong(label+'no tower panel');continue;}
      const b=plainBox(panel),left=plan.tower.side==='left';
      const space=left?[plan.over+plan.leg,b.lo[0]]:[b.hi[0],plan.L-plan.over-plan.leg];
      if(Math.abs(space[1]-space[0]-R.towerInside)>.01)wrong(label+`the tower space is ${fmt(space[1]-space[0])} wide inside`);
      if(b.lo[1]>.01||Math.abs(b.hi[1]-plan.legH)>.01)wrong(label+'the tower panel does not run from the floor to the top');
      const inSpace=parts.find(p=>p!==panel&&!['Top','Long apron'].includes(p.name)&&plainBox(p).lo[0]<space[1]-.01&&plainBox(p).hi[0]>space[0]+.01&&plainBox(p).lo[1]<plan.knee.room-.01);
      if(inSpace)wrong(label+`${inSpace.name} is in the tower space`);
      if(plan.rails.some(x=>x<b.hi[0]+R.drillRoom&&x+plan.frame.railT>b.lo[0]-R.drillRoom))wrong(label+'a cross rail is within 1 1/2" of the tower panel');
    }
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
    const vals={...presetDefaults(preset),strip:true,hook:true};
    load(JSON.stringify(blank()),true);
    placePreset(preset,vals,preset.build(vals),false);
    const strip=hardwareList().find(item=>item.kind==='strip'),hook=hardwareList().find(item=>item.kind==='hook');
    if(!strip||byId(strip.on).name!=='Long apron'||hardwarePose(strip).n.z<.5)wrong('the power strip is not on the inside face of the back apron');
    else if(Math.abs(hardwarePose(strip).at.x-computerDeskPlan(vals).strip.x)>.01)wrong('the power strip is not where the plan put it');
    if(!hook||byId(hook.on).name!=='Short apron'||Math.abs(hardwarePose(hook).n.x)<.5)wrong('the hook is not on the outside face of a short apron');
    else if(hardwarePose(hook).at.z>plan0Back(vals)+DESK_RULES.hookFromLeg+DESK_RULES.hookPlate+.01)wrong('the hook is not near the back of the end');
    const rows=hardwareTotals(findJoints()).rows;
    for(const kind of['strip','hook']){
      const label=HARDWARE[kind].buy(),count=rows.filter(row=>row[0]===label).reduce((sum,row)=>sum+row[1],0);
      if(count!==1)wrong(`the shopping list has ${count} of "${label}"`);
      if(typeof hardwareFamily==='function'&&!hardwareFamily(label))wrong(`"${label}" has no price`);
    }
    const steps=buildPlan().steps;
    if(!steps.some(step=>(step.hardware||[]).some(line=>line.kind==='strip'))||!steps.some(step=>(step.hardware||[]).some(line=>line.kind==='hook')))wrong('the power strip or the hook is in no build step');
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
    for(const extra of[{},{drawers:'left'},{drawers:'none',tower:true},{L:72,tower:true,riser:true},{drawers:'both',L:72},{W:24,H:28,L:55}]){
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
    // (a 5" front, the least the form takes, gives the shallowest drawer the Nightstand's rule allows: never less)
    if(layout.frontHeight<NS.minFront-1e-6)wrong(label+`the drawer fronts were cut to ${fmt(layout.frontHeight)}, under the ${fmt(NS.minFront)} that leaves a useful drawer (${fmt(deep)} deep inside)`);
    if(layout.openHeight<NS.minShelf-1e-6)wrong(label+`the open shelf is only ${fmt(layout.openHeight)} tall`);
  }
});
