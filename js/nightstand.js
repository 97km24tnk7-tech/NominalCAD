/* NominalCAD: the "Nightstand with drawers" preset.

   A plywood cabinet a beginner can build with a saw and a drill: two sides that run to the floor, a bottom
   panel on a recessed toe kick, two rails under the top, a thin back that keeps it square, an optional open
   shelf, and one to four drawers. The drawers are built by js/drawers.js (buildDrawer) and run on real, placed
   hardware: a pair of side-mount ball-bearing slides each, or wooden runners with nothing to buy. Their fronts
   lie over the cabinet edges (overlay) or sit inside the opening (inset).

   The cabinet's size rules are in NS below; every drawer clearance is in DRAWER (js/drawers.js), so there is
   one copy of each rule. nightstandPlan() turns the form into checked numbers (and says what it had to change
   and why), buildNightstand() makes the pieces from that plan, nightstandTip() checks that it will not fall on
   its face with a full drawer open, and the preset registers itself at the bottom of this file.

   The preset rule (README.md): the form's numbers have limits (the ones in NS), nightstandCheck() hands the
   tip check to the warning box as a "stop" or a "warn", and the structural check (js/verify.js) is told what
   the panels are for (nightstandUses). Before the design is placed the check takes the drawer sides as hanging
   on their slides (hung); once it is placed the slides are really there (mountPresetDrawers, js/drawers.js),
   and the check reads those: take a slide or a cabinet side away and it says the drawer is not held. */
'use strict';

const NS={
  kick:3,                 // the bottom panel sits this far above the floor, on the toe kick
  kickBack:2,             // the toe kick is set back this far from the front, room for your toes
  rail:3,                 // width of the two rails the top is screwed to from below
  topSide:.5,             // the top overhangs each side by this much
  topFront:.5,            // and overhangs the drawer fronts (or, with inset fronts, the cabinet) by this much
  frontReveal:.125,       // overlay drawer fronts stop this far short of the outside of each side
  minFront:5,             // an overlay front shorter than this leaves a box too shallow to be useful
  minFrontInset:3.5,      // an inset front covers no cabinet edges, so the same box needs less front
  maxFront:12,            // a taller front makes a heavy drawer that pulls the cabinet over when it is open
  minShelf:6,             // an open shelf lower than this holds nothing
  maxDrawers:4,
  top:.75,                // the top is 3/4" plywood
  back:.25,               // the back panel is 1/4" plywood, nailed on behind the sides; the top covers its edge
  /* The limits of the form. Its Width, Depth and Height are the OVERALL size of the piece, the top included (the
     owner's rule: what a person types is what they get): the width and the depth of the top, and the height from
     the floor to the top of the top. The cabinet under the top is worked out from them (nightstandCase).
     30" wide overall leaves a cabinet 29" wide: about the most a 3/4" plywood bottom, shelf or rail spans between
     the sides without sagging under a full load (the structural check allows about 29" clear; 29 less the two
     sides is 27 1/2). Lower than 21" overall, a cabinet of the usual width and depth with two drawers over an open
     shelf only just passes the tip check (a full top drawer pulled out). */
  minWidth:15,maxWidth:30,minDepth:13.5,maxDepth:24,minHeight:21,maxHeight:36,
  plyDensity:.0197,       // lb per cubic inch of softwood plywood (about 34 lb per cubic foot)
  loadPerCubicFoot:10,    // lb: a drawer packed tight with clothes
  minLoad:10,             // lb: or a small drawer with a few heavy books in it
  tipStop:1.25,           // holding force must be at least this many times the tipping force, or it is not built
  tipWarn:1.5,            // below this the form says so and tells you to strap it to the wall
};
const NIGHTSTAND_DEFAULTS={W:20,D:16,H:26,N:'2',cub:true,fh:7,slides:'slide',fronts:'overlay'};

/* The plan for the form as it stands: the sizes, where each drawer front starts, the drawer box sizes,
   `tip` (the tip check, see nightstandTip) and `changed`: plain sentences for every value the plan had to
   change and why. Nothing is drawn here.
   A big drawer is heavy enough to pull a light cabinet over when it is open and full. When the first layout
   fails the tip check, lighter drawers are tried, which is what a cabinetmaker would do: with an open shelf
   the drawer fronts get shorter half an inch at a time (the shelf gets taller); without one, a drawer is added
   so each is smaller. If it still fails with the smallest drawers, plan.tip.factor is under NS.tipStop and
   buildNightstand makes nothing; the form then says why. */
function nightstandPlan(p){
  const checked=layout=>{layout.tip=nightstandTip(layout);return layout;};
  let plan=checked(nightstandLayout(p,{}));
  const first=plan;
  while(plan.tip.factor<NS.tipStop){
    let lighter=null;
    if(plan.shelf&&plan.frontHeight>plan.minFront)lighter=nightstandLayout(p,{frontHeight:Math.max(plan.minFront,plan.frontHeight-.5)});
    else if(!plan.shelf&&plan.drawers<NS.maxDrawers)lighter=nightstandLayout(p,{drawers:plan.drawers+1});
    // stop when there is nothing lighter left to try (the layout came back no different)
    if(!lighter||(lighter.frontHeight>=plan.frontHeight&&lighter.drawers<=plan.drawers))break;
    plan=checked(lighter);
  }
  if(plan!==first&&plan.tip.factor>=NS.tipStop){
    plan.changed=plan.changed.filter(sentence=>!/drawers were used/.test(sentence));
    plan.changed.push(plan.shelf
      ?`The drawer front${plan.drawers>1?'s were':' was'} cut back to ${typedLen(plan.frontHeight)} tall: any taller and a full, open drawer could pull the cabinet over.`
      :`${plan.drawers} drawers were used: with fewer, a full, open drawer could pull the cabinet over.`);
  }
  return plan.tip.factor>=NS.tipStop?plan:first;
}
/* How far the top reaches past the front edges of the cabinet sides: past the drawer fronts by NS.topFront, and
   overlay fronts stand out of the cabinet by their thickness and the gap behind them. */
const nightstandTopPast=style=>(style==='overlay'?DRAWER.overlayStandoff+DRAWER.frontThick:0)+NS.topFront;
/* The cabinet under the top, from the overall size typed in the form ({W, D, H}: the width and the depth of the
   top, the height to the top of the top): narrower by the overhang at each side, lower by the top, and shallower
   by the back panel behind the sides and by what the top reaches past the front of the sides. */
function nightstandCase(overall,style){
  return{W:r16(overall.W-2*NS.topSide),D:r16(overall.D-NS.back-nightstandTopPast(style)),H:r16(overall.H-NS.top)};
}
/* The other way round: the overall size of a cabinet of these sizes with its top (for a self-check that thinks in
   cabinet sizes, and for reading an older design). */
function nightstandOverall(cabinet,style){
  return{W:cabinet.W+2*NS.topSide,D:cabinet.D+NS.back+nightstandTopPast(style),H:cabinet.H+NS.top};
}
/* One layout, with no tip check. `force` lets nightstandPlan try lighter drawers: {frontHeight} with an open
   shelf, {drawers} without one. The cabinet's own numbers are worked out here; the stack of drawers is
   drawerStackLayout's (below), which the cabinet builder shares. */
function nightstandLayout(p,force){
  const changed=[];
  const within=(value,lo,hi,what)=>{
    // a box of the form that was put right: under the form it reads as the box shows it (typedLen, js/core.js)
    if(!(value>=lo)){changed.push(`${what} was raised to ${typedLen(lo)}, the smallest that works.`);return lo;}
    if(value>hi){changed.push(`${what} was cut back to ${typedLen(hi)}, the largest this design is checked for.`);return hi;}
    return value;
  };
  const kind=p.slides==='runner'?'runner':'slide',style=p.fronts==='inset'?'inset':'overlay';
  // the sizes typed are the overall size; W, D and H from here on are the cabinet under the top
  const overall={W:within(p.W,NS.minWidth,NS.maxWidth,'Width'),D:within(p.D,NS.minDepth,NS.maxDepth,'Depth'),H:within(p.H,NS.minHeight,NS.maxHeight,'Height')};
  const{W,D,H}=nightstandCase(overall,style);
  const gap=DRAWER.frontGap,panel=.75;
  const floorOfCabinet=NS.kick+panel;                  // top of the bottom panel
  /* The zone the drawers fill: between the two sides, from the top of the bottom panel up to the underside of the
     top rails. How far the fronts reach past it:
       Overlay: the bottom front covers the whole edge of the panel below it, the top front stops one gap under
                the top (the rails less one gap), and each side keeps NS.frontReveal of the cabinet side showing.
       Inset:   the fronts sit inside, one gap away from the panel below and from the rails. */
  const zone={x:panel,width:W-2*panel,depth:D,floorTop:floorOfCabinet,ceilUnder:H-panel,
    lapBelow:style==='overlay'?panel:-gap,lapAbove:style==='overlay'?panel-gap:-gap,lapSide:panel-NS.frontReveal,
    panel,style,kind,open:!!p.cub};
  const asked=Math.min(NS.maxDrawers,Math.max(1,parseInt(p.N,10)||1));
  const stack=drawerStackLayout(zone,{drawers:asked,frontHeight:p.fh,forceFrontHeight:force.frontHeight,forceDrawers:force.drawers},within);
  changed.push(...stack.changed);
  const{drawers,frontHeight,fronts,openingOf,drawer}=stack;
  return{W,D,H,overall,kind,style,minFront:stack.minFront,shelf:!!p.cub,shelfHeight:stack.openHeight,floorOfCabinet,
    frontsFrom:stack.frontsFrom,drawers,frontHeight,fronts,changed,
    kickerPairs:stack.kickerPairs,   // how many drawers get a pair of kicker strips above them (the lower ones, on runners, behind overlay fronts)
    openingOf,drawerOptions:stack.drawerOptions,drawer,
    // the numbers of every drawer, under the names the rest of this file uses
    slide:drawer.length,travel:drawer.travel,boxWidth:drawer.boxWidth,boxHeight:drawer.boxHeight,bottomThick:drawer.bottomThick,
    boxBottom:front=>r16(openingOf(front).y+drawer.boxBottom),
    // what the heights of the slides are measured from in the steps: the panel right under the drawers
    underDrawers:openingOf(fronts[0]).y};
}

/* The words drawerStackLayout says when it had to change what was asked. A caller may hand its own in
   zone.words (the cabinet builder speaks of an open space, not of a tick box); what it leaves out is said
   this way, the Nightstand's words. */
const DRAWER_STACK_WORDS={
  fewerOverOpen:drawers=>`Only ${drawers} drawer${drawers>1?'s fit':' fits'} above an open shelf at this height. Make it taller, or leave out the open shelf, for more.`,
  cutBackOverOpen:(frontHeight,least)=>`The drawer fronts were cut back to ${typedLen(frontHeight)} tall so the open shelf keeps ${fmt(least)}.`,
  moreDrawers:(drawers,most)=>`${drawers} drawers were used: with fewer, each drawer front would be over ${fmt(most)} tall, heavy enough to pull the cabinet over when open. Tick the open shelf if you want fewer drawers.`,
  fewerDrawers:(drawers,least)=>`Only ${drawers} drawer${drawers>1?'s fit':' fits'} at this height: each drawer front has to be at least ${fmt(least)} tall.`,
  frontHeight:'Drawer front height',
};
/* A stack of drawers in one zone between two uprights: how many, how tall their fronts are, where each front
   starts, the space each drawer box is built in, and what had to change and why. The Nightstand's rules:
   overlay fronts at least NS.minFront, inset fronts at least NS.minFrontInset, none taller than NS.maxFront;
   with an open space under them the fronts give way first (shorter), then fewer drawers; with drawers only,
   more drawers while a front would pass NS.maxFront.
     zone  {x, width, depth   the space between the two uprights, from the back to their front edges (z, optional:
                              where that space starts front to back, 0 when left out)
            floorTop          the top of the panel under the drawers
            ceilUnder         the underside of what is over them (rails, a top, a panel)
            lapBelow          how far the bottom front reaches below floorTop (an inset front: -1/8, it stops short)
            lapAbove          how far the top front reaches above ceilUnder (the same way)
            lapSide           how far an overlay front covers each upright
            panel             the thickness of the panel that goes between the drawers and an open space under them
            style             'overlay' | 'inset';  kind  'slide' | 'runner'
            open              true when an open space stays under the drawers (it keeps at least NS.minShelf)
            maxDrawers        optional, NS.maxDrawers when left out
            firstNumber       optional: the number of the bottom drawer ("Drawer 1" when left out)
            words             optional, see DRAWER_STACK_WORDS}
     ask   {drawers: how many were asked for; frontHeight: the front height asked for (read with an open space);
            forceFrontHeight, forceDrawers: what nightstandPlan tries when a full open drawer would tip it}
     within(value, lo, hi, what)  optional: puts a typed value inside its limits and says so
   Returns {drawers, frontHeight, fronts (the bottom edge of each front, bottom one first), frontsFrom,
            openHeight (the clear height of the open space: the panel over it has its underside at
            floorTop + openHeight; 0 without one), minFront, kickerPairs, openingOf(front), drawerOptions(index),
            drawer (drawerPlan of the bottom one: every box of a stack comes out alike), changed}. */
function drawerStackLayout(zone,ask,within){
  const changed=[],words={...DRAWER_STACK_WORDS,...(zone.words||{})};
  within=within||((value,lo,hi)=>Math.min(hi,Math.max(lo,value)));
  const gap=DRAWER.frontGap,style=zone.style,kind=zone.kind;
  const maxDrawers=zone.maxDrawers||NS.maxDrawers;
  const minFront=style==='overlay'?NS.minFront:NS.minFrontInset;
  const frontsTo=zone.ceilUnder+zone.lapAbove;          // the top edge of the top drawer front
  const capBottom=zone.panel-zone.lapBelow;             // from the top of the panel over an open space to the bottom front
  const stack=(n,frontHeight)=>n*frontHeight+(n-1)*gap; // height of n drawer fronts with their gaps
  const asked=ask.drawers;
  let drawers=zone.open?asked:(ask.forceDrawers||asked),frontHeight,openHeight=0,frontsFrom;

  if(zone.open){
    // With an open space: the drawers take the front height asked for, counted down from the top, and the open
    // space gets what is left. It must keep at least NS.minShelf, so drawers give way first: shorter, then fewer.
    frontHeight=ask.forceFrontHeight||floor16(within(ask.frontHeight,minFront,NS.maxFront,words.frontHeight));
    const room=frontsTo-zone.floorTop-NS.minShelf-capBottom;    // the most the drawer fronts can take
    while(drawers>1&&stack(drawers,minFront)>room)drawers--;
    if(drawers<asked)changed.push(words.fewerOverOpen(drawers));
    if(stack(drawers,frontHeight)>room){
      frontHeight=floor16((room-(drawers-1)*gap)/drawers);
      changed.push(words.cutBackOverOpen(frontHeight,NS.minShelf));
    }
    openHeight=r16(frontsTo-stack(drawers,frontHeight)-capBottom-zone.floorTop);
    frontsFrom=zone.floorTop+openHeight+capBottom;   // openHeight is the clear height under the panel over it
  }else{
    // With no open space the drawers share the whole height above the panel under them.
    frontsFrom=zone.floorTop-zone.lapBelow;
    const share=n=>floor16((frontsTo-frontsFrom-(n-1)*gap)/n);
    while(drawers<maxDrawers&&share(drawers)>NS.maxFront)drawers++;
    if(drawers>asked)changed.push(words.moreDrawers(drawers,NS.maxFront));
    while(drawers>1&&share(drawers)<minFront)drawers--;
    if(drawers<asked)changed.push(words.fewerDrawers(drawers,minFront));
    frontHeight=share(drawers);
  }
  const fronts=[];
  for(let i=0;i<drawers;i++)fronts.push(r16(frontsFrom+i*(frontHeight+gap)));

  /* The space each drawer is built for (the "opening" of js/drawers.js), between the two uprights. There are no
     panels between the drawers, so every drawer gets a space of the same height: the one the top drawer has
     under what is over it. All the boxes then come out alike, and all the drawer parts are cut alike.
       Overlay: from the top of the panel its front covers (lapBelow above the bottom edge of the front) up to
                the underside of what is over it (lapAbove below the top edge of the top front).
       Inset:   one gap below the front to one gap above it (both laps are minus one gap). */
  const openingOf=front=>({x:zone.x,y:r16(front+zone.lapBelow),z:zone.z||0,width:zone.width,
    height:r16(frontHeight-zone.lapBelow-zone.lapAbove),depth:zone.depth});
  /* Wooden runners with no rail between two drawers: what keeps a lower drawer from tipping when it is open?
       Overlay: its space ends 1 1/2" under the space above, so a kicker strip goes on each side there.
       Inset:   the spaces lie right on top of each other (they share the one gap between two fronts), so the
                runners of the drawer above are right over the sides of the drawer below and do the job
                themselves. They hang one gap into the top of the lower space, and the box stays out of that
                (topTaken). Every box is cut alike, so the top one gets the same height and has that much more
                air under the rails, which still keep it from tipping (KICKER_REACH, js/drawers.js). */
  const stackedOnRunners=kind==='runner'&&drawers>1;
  const kickerPairs=stackedOnRunners&&style==='overlay'?drawers-1:0;
  const firstNumber=zone.firstNumber||1;
  // overlay: the front laps the uprights by lapSide, what is over the drawers by lapAbove, the panel under them by lapBelow
  const drawerOptions=index=>({name:`Drawer ${index+firstNumber}`,slide:kind,front:style,
    topTaken:stackedOnRunners&&style==='inset'?gap:0,
    lap:{side:zone.lapSide,top:zone.lapAbove,bottom:zone.lapBelow}});
  const drawer=drawerPlan(openingOf(fronts[0]),drawerOptions(0));   // every clearance comes from DRAWER (js/drawers.js)
  if(drawer.bottomThick>.25)changed.push('The drawer bottoms are 1/2" plywood: in a drawer this size a 1/4" bottom would sag when the drawer is full.');
  return{drawers,frontHeight,fronts,frontsFrom,openHeight,minFront,kickerPairs,openingOf,drawerOptions,drawer,changed};
}

/* The pieces for the form as it stands. Returns nothing when the tip check fails (nightstandInfo then says why). */
function buildNightstand(p){
  const plan=nightstandPlan(p);
  return plan.tip.factor>=NS.tipStop?nightstandPieces(plan):[];
}
/* The pieces of one plan. z = 0 is the back edge of the sides; the front edge is z = D. */
function nightstandPieces(plan){
  const{W,D,H}=plan,inner=W-1.5,parts=[];
  // the cabinet
  parts.push(
    mk('Side','ply34',[.75,H,D],[0,0,0]),
    mk('Side','ply34',[.75,H,D],[W-.75,0,0]),
    mk('Bottom','ply34',[inner,.75,D],[.75,NS.kick,0]),
    mk('Toe kick','ply34',[inner,NS.kick,.75],[.75,0,D-NS.kickBack-.75]),
    mk('Top rail','ply34',[inner,.75,NS.rail],[.75,H-.75,0]),
    mk('Top rail','ply34',[inner,.75,NS.rail],[.75,H-.75,D-NS.rail]));
  if(plan.shelf)parts.push(mk('Shelf','ply34',[inner,.75,D],[.75,plan.floorOfCabinet+plan.shelfHeight,0]));
  parts.push(mk('Back panel','ply14',[W,H-NS.kick,NS.back],[0,NS.kick,-NS.back]));
  // the top covers the back panel's edge and reaches past the drawer fronts (past the cabinet, when they are inset):
  // it is the overall size typed in the form (nightstandCase)
  parts.push(mk('Top','ply34',[W+2*NS.topSide,NS.top,NS.back+D+nightstandTopPast(plan.style)],[-NS.topSide,H,-NS.back]));
  // the drawers, bottom one first: each its own subcomponent, "Drawer 1" at the bottom
  plan.fronts.forEach((front,index)=>parts.push(...buildDrawer(plan.openingOf(front),plan.drawerOptions(index))));
  return parts;
}

/* Will it tip forward when the top drawer is pulled all the way out, full?
   "Full" is NS.loadPerCubicFoot lb for every cubic foot of drawer (clothes packed tight), and never less than
   NS.minLoad lb (a few heavy books). Everything that is not the open drawer holds the cabinet down, turning
   about the front bottom edge of the sides (z = D); the open drawer and its load, out past that edge, try to
   tip it. "All the way out" is as far as its hardware lets it: the length of a metal slide, two thirds of that
   on wooden runners. Nothing on top (a lamp helps) and nothing in the other drawers is counted, which is the
   safe side. Returns {factor: holding / tipping, load}. A factor over 1 stays put; NS.tipStop is the least
   that is built. */
function nightstandTip(plan){
  return drawerTipFactor(nightstandPieces(plan),plan.drawer,plan.D,`Drawer ${plan.drawers}`);
}
/* The tip check of one open drawer, for any case (the cabinet builder runs it for every drawer in turn).
     pieces     every piece of the case and its drawers, as built (each drawer's pieces carry sub: its name)
     drawer     drawerPlan of the drawer that is pulled out (its length, travel, box sizes)
     edge       z of the front bottom edge the case would turn about (the front edge of its sides)
     openName   the subcomponent name of the open drawer ("Drawer 2")
     openingZ   optional: z of the back of that drawer's opening (drawer.boxFace is measured from there), 0 when
                left out (the Nightstand's openings start at the back of the sides)
   The open drawer and its load try to tip it, everything else holds it down. Returns {factor, load}. */
function drawerTipFactor(pieces,drawer,edge,openName,openingZ){
  const cubicFeet=(drawer.boxWidth-1)*(drawer.length-1)*(drawer.boxHeight-drawer.bottomThick)/1728;
  const load=Math.max(NS.minLoad,Math.round(cubicFeet*NS.loadPerCubicFoot));
  // the load sits in the middle of the open box
  let holding=0,tipping=load*((openingZ||0)+drawer.boxFace-drawer.length/2+drawer.travel-edge);
  for(const part of pieces){
    const s=size(part),weight=s[0]*s[1]*s[2]*NS.plyDensity,middle=part.pos[2]+s[2]/2;
    if(part.sub===openName)tipping+=weight*(middle+drawer.travel-edge);
    else holding+=weight*(edge-middle);
  }
  return{factor:holding/tipping,load};
}

/* The tip check for the warning box (the preset's check(p)): a size that would fall on its face is a "stop"
   and is not built; one that stays up without much to spare is a "warn", and Create asks first. */
function nightstandCheck(p){
  const plan=nightstandPlan(p),tip=plan.tip;
  if(tip.factor<NS.tipStop)return[{level:'stop',
    text:`At this size it would fall forward with the top drawer pulled all the way out and ${tip.load} lb in it, even with the smallest drawers that fit.`,
    fix:`Make it deeper or wider${plan.shelf?'':', or tick the open shelf'}.`}];
  if(tip.factor<NS.tipWarn)return[{level:'warn',
    text:`With the top drawer pulled all the way out and ${tip.load} lb in it, it stays up, but not by much.`,
    fix:'Fasten it to the wall with an anti-tip strap, or make it deeper.'}];
  return[];
}
/* What the panels are for (keys of USES in js/verify.js). With an open shelf, things stand on the bottom panel. */
/* Every piece that carries something is named here, so the check has nothing left to guess from a name: the toe
   kick carries the bottom panel, the top rails carry the top, and the four parts of a drawer box carry its bottom
   and what is in the drawer. */
const nightstandUses=p=>{
  const bottom=p.cub?'shelf':'general';
  return{'Top':'tableTop','Top rail':'tableTop','Shelf':'shelf','Bottom':bottom,'Toe kick':bottom,
    'Drawer bottom':DRAWER.bottomUse,'Drawer box front':DRAWER.bottomUse,'Drawer box back':DRAWER.bottomUse,'Drawer side':DRAWER.bottomUse};
};
const nightstandRunsOn=plan=>plan.kind==='slide'?`${plan.slide}" side-mount slides`:`wooden runners ${plan.slide}" long`;
/* the remark under the form: what you get, anything that was changed and why, and the tip check */
function nightstandInfo(p){
  const plan=nightstandPlan(p),tip=plan.tip;
  if(tip.factor<NS.tipStop)return[...plan.changed,
    `Not built: at this size it would fall forward with the top drawer pulled all the way out and ${tip.load} lb in it, even with the smallest drawers that fit. Make it deeper or wider${plan.shelf?'':', or tick the open shelf'}.`].join(' ');
  const text=[...plan.changed,
    // the sizes typed are the overall size: say what the cabinet under the top comes out at
    `The top overhangs the cabinet ${fmt(NS.topSide)} at each side and ${fmt(nightstandTopPast(plan.style))} at the front, so the cabinet under it is ${fmt(plan.W)} wide and ${fmt(plan.D)} deep.`,
    `${plan.drawers} drawer${plan.drawers>1?'s':''} on ${nightstandRunsOn(plan)}, each ${plan.style} front ${fmt(plan.frontHeight)} tall${plan.shelf?`, over an open shelf ${fmt(plan.shelfHeight)} tall`:''}. Inside, each drawer is ${fmt(plan.boxWidth-1)} wide and ${fmt(plan.boxHeight-plan.bottomThick)} deep, and comes out ${fmt(r16(plan.travel))}.`];
  if(!plan.shelf&&p.fh!==undefined)text.push('With no open shelf the drawers share the whole height, so the drawer front height box is not used.');
  // a tip check that passes "but not by much" is said by the warning box above this remark (nightstandCheck)
  if(tip.factor>=NS.tipWarn)text.push(`Tip check: with the top drawer pulled all the way out and ${tip.load} lb in it, it stays put with room to spare.`);
  return text.join(' ');
}
function nightstandNotes(p){
  const plan=nightstandPlan(p),tip=plan.tip,pairs=`${plan.drawers} pair${plan.drawers>1?'s':''}`;
  const hardwareNote=plan.kind==='slide'
    ?`Drawer slides: buy ${pairs} of ${plan.slide}" side-mount ball-bearing slides. They need ${fmt(DRAWER.slideSide)} between the drawer box and the cabinet on each side, and the drawer boxes here are cut for exactly that. If the package says a different gap, change the width of the drawer box front, back and bottom to match before you cut.`
    :`Wooden runners: the drawers ride on strips of wood ${fmt(DRAWER.runnerStrip)} by ${fmt(DRAWER.runnerStrip)}, ${plan.slide}" long, screwed to the cabinet sides. Buy 3/4" square stock, or rip a 1x2 down the middle (the two halves come out a hair under 3/4", which is fine). There is no metal hardware to buy, and the drawers come out ${fmt(r16(plan.travel))}, about two thirds of their depth: past that a drawer on runners would drop out.`;
  const frontNote=plan.style==='overlay'
    ?`Each drawer front is ${fmt(plan.frontHeight)} tall with ${fmt(DRAWER.frontGap)} gaps. The fronts go on last, with the drawers in place, so the gaps come out even.`
    :`Each drawer front is ${fmt(plan.frontHeight)} tall and sits inside the cabinet with a ${fmt(DRAWER.frontGap)} gap all around, ${fmt(DRAWER.insetSetBack)} behind the front edges of the sides. The fronts go on last, with the drawers in place, so the gaps come out even.`;
  return[hardwareNote,frontNote,
    `Tip check: the cabinet was checked with the top drawer pulled all the way out and ${tip.load} lb in it${tip.factor>=NS.tipWarn?'':'. It passes, but not by much: fasten it to the wall'}. A nightstand is light. If small children may pull on an open drawer, fasten the cabinet to the wall with an anti-tip strap whatever its size (a furniture strap sold with child-proofing things; it is not in the shopping list).`,
    'Sizes and the tip check are rules of thumb for a bedside cabinet holding a lamp, books and clothes. They are not engineering.'];
}
/* The heights the steps quote, bottom drawer first, measured up from the panel right under the drawers (the shelf
   when there is one, else the bottom panel): the middle of each slide, or the top of each runner; and the
   underside of each kicker strip (runners only: every drawer but the top one, which has the rails above it). */
function nightstandHeights(plan){
  const from=plan.underDrawers,drawer=plan.drawer;
  const hardware=plan.fronts.map(front=>r16(plan.openingOf(front).y+drawer.slideHeight-from));
  const kickers=plan.kickerPairs
    ?plan.fronts.slice(0,plan.kickerPairs).map(front=>r16(plan.openingOf(front).y+drawer.boxBottom+drawer.boxHeight+DRAWER.runnerAbove-from)):[];
  return{hardware,kickers,panel:plan.shelf?'the shelf':'the bottom panel'};
}
/* the pieces of the drawer boxes: built on the bench, then slid into the cabinet in the step that mounts the slides or runners */
const nightstandDrawerBox=piece=>['Drawer box front','Drawer box back','Drawer side','Drawer bottom'].includes(piece.name);
function nightstandSteps(p){
  const plan=nightstandPlan(p),many=plan.drawers>1,drawer=plan.drawer,heights=nightstandHeights(plan);
  const list=values=>values.map(value=>fmt(value)).join(', then ');
  const firstOnes=many?' (bottom drawer first)':'';
  const fromEdge=drawer.slideFromEdge,fromBox=drawer.slideFromBoxFront;
  const whySidesRunThrough=plan.kind==='slide'?'the slides will be screwed along the sides':'the sides are what the cabinet guides, so they run the whole length';
  const steps=[CUT,
    // Everyday and Fine furniture: no screw shows on the outside of the sides (CASE_SIDE_JOINTS): the boards are held
    // by pocket holes drilled in them; Rustic / rough screws through the sides
    styledStep({
      std:`Fasten the bottom between the two sides, ${fmt(NS.kick)} up from the floor, and the two top rails between the sides flush with the top: one flush with the front edge, one flush with the back edge. First drill the pocket holes listed below in the underside of the bottom and of each rail, near their ends. Then glue each joint and drive the pocket screws into the sides, so nothing shows on the outside.`,
      rustic:`Fasten the bottom between the two sides, ${fmt(NS.kick)} up from the floor, and the two top rails between the sides flush with the top: one flush with the front edge, one flush with the back edge. Glue each joint, drill pilot holes, and drive the screws through the outside of the sides into the ends of the bottom and the rails.`},['Side','Bottom','Top rail'],
      [' First drill the pocket holes listed below in the underside of the bottom and of each rail, near their ends.']),
    styledStep({
      std:`Fasten the toe kick under the bottom panel, on edge, set back ${fmt(NS.kickBack)} from the front. Hold it to the bottom panel and to the sides with the pocket screws listed below, from holes drilled in its back face.`,
      rustic:`Fasten the toe kick under the bottom panel, on edge, set back ${fmt(NS.kickBack)} from the front. Screw down through the bottom panel into its top edge, and through the sides into its ends.`},['Toe kick'])];
  if(plan.shelf)steps.push(styledStep({
    std:`Fasten the shelf between the sides, with its underside ${fmt(plan.shelfHeight)} above the bottom panel. Drill the pocket holes listed below in its underside near each end. Cut two scrap blocks ${fmt(plan.shelfHeight)} long, stand them on the bottom panel and rest the shelf on them while you drive the pocket screws into the sides.`,
    rustic:`Fasten the shelf between the sides, with its underside ${fmt(plan.shelfHeight)} above the bottom panel. Cut two scrap blocks ${fmt(plan.shelfHeight)} long, stand them on the bottom panel and rest the shelf on them while you screw through the sides into its ends.`},['Shelf'],
    [' Drill the pocket holes listed below in its underside near each end.']));
  steps.push(
    {t:'Lay the cabinet on its front. Measure corner to corner both ways and push it until the two measurements match, then glue and nail the back panel on, flush with the outside of the sides and the top. The back is what keeps the cabinet square, so do not skip the glue.',add:['Back panel']},
    {t:`Stand the cabinet up. Run a thin line of glue along the top edges of the two sides, then set the top on: flush with the back of the back panel, ${fmt(NS.topSide)} past each side, and ${fmt(nightstandTopPast(plan.style))} past the front of the cabinet. Screw up through the two top rails into the top with 1-1/4" screws, from inside the cabinet, so no screw shows on top.`,add:['Top']},
    {t:`Build ${many?`the ${plan.drawers} drawer boxes, all the same`:'the drawer box'}. Stand the drawer box front and the drawer box back between the two drawer sides, so the sides cover their ends: ${whySidesRunThrough}. Glue each corner, then nail through the sides into the ends of the box front and the box back with brads (if you are using a hammer, drill a thin pilot hole first so the plywood does not split). Check the box is square, then glue and nail the bottom on underneath, flush at the back and the sides. It stops ${fmt(DRAWER.bottomShy)} short at the front on purpose.`,add:['Drawer box front','Drawer box back','Drawer side','Drawer bottom']});
  if(plan.kind==='slide'){
    steps.push({t:`Mount the slides. Each slide pulls apart into a cabinet half and a drawer half. Screw a cabinet half to the inside of each side, level, with its front end ${fmt(fromEdge)} back from the front edge of the side and its middle ${many?'at these heights':'this high'} above ${heights.panel}: ${list(heights.hardware)}${firstOnes}. `+
      `Use a spacer block so the left and right slides come out at exactly the same height: ${many?'start with the top pair, ':''}cut a scrap of plywood that holds the slide at its mark when it stands on ${heights.panel}, rest the slide on it against one side and screw it on, then do the same on the other side${many?'. Cut the block shorter for the next pair down':''}. `+
      `Screw a drawer half along the middle of each drawer side, with its front end ${fromBox>0?`${fmt(fromBox)} back from`:'flush with'} the front of the box. Push each drawer in until the slides click together.`,add:[],hardware:['slide'],bring:[nightstandDrawerBox]});   // hardware: the placed slides are listed under this step (js/buildsteps.js)
  }else{
    steps.push({t:`Mount the runners. Each runner is a strip of wood ${fmt(DRAWER.runnerStrip)} by ${fmt(DRAWER.runnerStrip)} and ${plan.slide}" long. Glue and screw one to the inside of each side, level, with its front end ${fmt(fromEdge)} back from the front edge of the side and its top edge ${many?'at these heights':'this high'} above ${heights.panel}: ${list(heights.hardware)}${firstOnes}. The lowest pair lies on ${heights.panel}. `+
      `Use a spacer block so the left and right runners come out at exactly the same height: ${many?'start with the top pair, ':''}cut a scrap of plywood that holds the runner at its mark when it stands on ${heights.panel}, and use it on both sides${many?'. Cut the block shorter for the next pair down':''}. `+
      (heights.kickers.length?`Then screw a kicker strip, the same size, to each side above ${heights.kickers.length>1?'every drawer but the top one':'the bottom drawer'}, with its underside ${list(heights.kickers)} above ${heights.panel}: it keeps an open drawer from tipping down. The top drawer needs none, because the top rails do that job. `
        :many?`No kicker strips are needed: the runners of the drawer above sit ${fmt(DRAWER.runnerAbove)} over the sides of the drawer below and keep it from tipping down when it is open, and the top rails do that for the top drawer. `
        :'The top rails keep the open drawer from tipping down. ')+
      `Rub the tops of the runners with candle wax, then slide ${many?'each drawer':'the drawer'} in. The fit is right when it moves freely with about ${fmt(DRAWER.runnerSide)} of play on each side.`,add:[],hardware:['runner','kicker'],bring:[nightstandDrawerBox]});
  }
  const lastWords=`Then drill for the ${many?'pulls':'pull'} in the middle of ${many?'each front':'the front'} and bolt ${many?'them':'it'} on.`;
  if(plan.style==='overlay'){
    steps.push({t:`Put the drawer fronts on last, ${many?'starting with the bottom one':'with the drawer in place'}. Hold the front against the drawer box so it covers the edge of the panel below it, with the same amount of cabinet side showing at each end${many?`, and a ${fmt(DRAWER.frontGap)} gap between fronts (two stacked nickels make a good spacer)`:''}. Clamp it or stick it with double-sided tape, open the drawer, and drive the short screws listed below from inside the drawer, through the drawer box front into the back of the drawer front. Do not use longer screws here: they would come out through the face. ${many?'Work up, keeping the same gap. ':''}${lastWords}`,add:['Drawer front']});
  }else{
    steps.push({t:`Put the drawer fronts on last, ${many?'starting with the bottom one':'with the drawer in place'}. An inset front sits inside the cabinet, ${fmt(DRAWER.insetSetBack)} behind the front edges of the sides, with a ${fmt(DRAWER.frontGap)} gap all around: stand it on two stacked nickels and put two more at each end. Stick it to the drawer box with double-sided tape, open the drawer, and drive the short screws listed below from inside the drawer, through the drawer box front into the back of the drawer front. Do not use longer screws here: they would come out through the face. ${many?'Work up, keeping the same gap between fronts. ':''}${lastWords}`,add:['Drawer front']});
  }
  steps.push(
    {t:`Get ready for sanding and finishing: pull ${many?'the drawers':'the drawer'} out and take the ${many?'pulls':'pull'} off again, so that no dust or finish gets on the ${plan.kind==='slide'?'slides or the hardware':'runners or the hardware'}. Keep them off until the finish is dry; then put the ${many?'pulls':'pull'} back and slide ${many?'the drawers':'the drawer'} in.`,add:[]},
    FIN);
  return steps;
}
/* Bought hardware. The slides (or the runner and kicker strips) and the pulls are also placed in the model when the
   design is created, and what is placed is taken off these lines by number (hardwareRows, js/hardware.js), so
   nothing is bought twice. */
function nightstandHardware(p){
  const plan=nightstandPlan(p),drawers=plan.drawers;
  if(plan.kind==='slide')return[[`Drawer slides, ${plan.slide}" side-mount ball-bearing (pair)`,drawers],['Drawer pulls',drawers]];
  // runners and kickers are strips of wood: they are on the cut list, and the shopping list counts their screws
  // from the strips that are placed (kind.wood, js/hardware.js)
  return[['Drawer pulls',drawers]];
}

PRESETS.push({
  name:'Nightstand with drawers',tile:'Drawer nightstand',spec:'Plywood, 1 to 4 drawers',icon:'i-p-cabinet',
  desc:'A bedside cabinet in plywood with one to four drawers that really open, on metal slides or wooden runners, and an open shelf underneath if you want one.',
  // the overall size, the top included (what is typed is what is built: nightstandCase works out the cabinet)
  params:[num('W','Width (of the top)',NIGHTSTAND_DEFAULTS.W,NS.minWidth,NS.maxWidth),num('D','Depth (of the top)',NIGHTSTAND_DEFAULTS.D,NS.minDepth,NS.maxDepth),
    num('H','Height (floor to the top)',NIGHTSTAND_DEFAULTS.H,NS.minHeight,NS.maxHeight),
    {k:'N',label:'Drawers',opts:[['1','1'],['2','2'],['3','3'],['4','4']],v:NIGHTSTAND_DEFAULTS.N},
    {k:'cub',label:'Open shelf under the drawers',check:1,v:NIGHTSTAND_DEFAULTS.cub},
    num('fh','Drawer front height (with an open shelf)',NIGHTSTAND_DEFAULTS.fh,NS.minFront,NS.maxFront),
    {k:'slides',label:'Drawers run on',opts:[['slide','Metal slides'],['runner','Wooden runners']],v:NIGHTSTAND_DEFAULTS.slides},
    {k:'fronts',label:'Drawer fronts',opts:[['overlay','Overlay: over the cabinet edges'],['inset','Inset: inside the cabinet']],v:NIGHTSTAND_DEFAULTS.fronts}],
  build:buildNightstand,info:nightstandInfo,notes:nightstandNotes,steps:nightstandSteps,
  // The preset rule. Before the design is placed, the structural check takes each drawer side as hanging on the
  // slide or runner on the cabinet side beside it, and the rest of the box as held through the drawer sides.
  // Placing it mounts the real hardware, and the check reads that from then on. check(p) is the tip check with a
  // full drawer open.
  uses:nightstandUses,hung:['Drawer side'],check:nightstandCheck,
  // every choice of the two new options, with and without the open shelf, is tried at every limit as well
  variants:[{slides:'runner'},{fronts:'inset'},{slides:'runner',fronts:'inset'},{cub:false,slides:'runner'},{cub:false,fronts:'inset'}],
  // the top is held by the rail screws from below, with glue on the sides, so nothing shows on top;
  // the fasteners inside a drawer are the same for every drawer (DRAWER_JOINTS, js/drawers.js)
  joints:[['Side','Top','glue'],...DRAWER_JOINTS,
    // nothing shows on the outside of the sides: the bottom, the rails, the shelf and the toe kick are held to them
    // by pocket holes (CASE_SIDE_JOINTS, js/builders-storage.js); Rustic / rough screws through the sides
    ...CASE_SIDE_JOINTS,
    // the top of the bottom panel is the floor of the open shelf, seen from the front: the toe kick is held to it
    // by pocket holes in the toe kick's back face, not by screws down through it (as the Bookshelf does)
    ['Bottom','Toe kick','pocketUnlessRustic']],
  hw:nightstandHardware,
});
PRESET_GROUPS.find(group=>group[0]==='Bedroom')[1].push('Nightstand with drawers');

/* Checked across the whole range the form allows (and past it), for both kinds of hardware and both kinds of
   front: nothing shares space, the drawers keep their clearances, and every size that gets built passes the tip
   check. */
SELFTESTS.push(function nightstandWithDrawers(problems){
  let built=0,notBuilt=0,notClean=0,lowest=Infinity;
  const nightstand=PRESETS.find(preset=>preset.name==='Nightstand with drawers');
  const insideLimits=p=>p.W>=NS.minWidth&&p.W<=NS.maxWidth&&p.D>=NS.minDepth&&p.D<=NS.maxDepth&&p.H>=NS.minHeight&&p.H<=NS.maxHeight&&
    p.fh>=NS.minFront&&p.fh<=NS.maxFront;
  // the usual choice is tried at many sizes; the three others at the limits, the usual size and one size past each limit
  const sizes={
    many:{W:[5,14,20,30,36,60],D:[5,12,14,16,20,24],H:[5,16,20,26,30,36],fh:[3,5,7,12]},
    few:{W:[5,14,20,30],D:[12,16,24],H:[16,26,36,40],fh:[3,7,12]}};
  const choices=[['slide','overlay',sizes.many],['runner','overlay',sizes.few],['slide','inset',sizes.few],['runner','inset',sizes.few]];
  for(const[slides,fronts,tried]of choices)
  for(const W of tried.W)for(const D of tried.D)for(const H of tried.H)
  for(const N of['1','2','3','4'])for(const cub of[true,false])for(const fh of tried.fh){
    const p={W,D,H,N,cub,fh,slides,fronts},label=`nightstand ${JSON.stringify(p)}: `,plan=nightstandPlan(p),parts=buildNightstand(p);
    if(!parts.length){
      notBuilt++;
      if(!nightstandInfo(p).includes('Not built:'))problems.push(label+'nothing is built and the form does not say why');
      const refusal=nightstandCheck(p)[0];
      if(!refusal||refusal.level!=='stop'||!refusal.text||!refusal.fix)problems.push(label+'nothing is built and check(p) does not refuse it with a reason and a fix');
      continue;
    }
    // The preset rule, for every size the form itself allows: the structural check finds nothing, and the only
    // thing check(p) may say about a design that is built is its "not by much" tip warning.
    if(insideLimits(p)){
      const check=checkPreset(nightstand,p,parts);
      const wrong=check.problems.filter(f=>!(f.code==='input'&&f.level==='warn'&&plan.tip.factor<NS.tipWarn));
      if(wrong.length){notClean++;if(notClean<=5)problems.push(label+'the structural check says: '+wrong[0].text);}
    }
    // what is typed is what is built: the overall size of the pieces is the size in the form, the top included
    if(insideLimits(p)){
      const whole=bbox(parts),got=[0,1,2].map(k=>r16(whole.hi[k]-whole.lo[k])),typed=[p.W,p.H,p.D];
      if(got.some((v,k)=>Math.abs(v-typed[k])>.01))problems.push(label+`comes out ${got.map(fmt).join(' x ')} overall (wide, tall, deep) for ${typed.map(fmt).join(' x ')} typed`);
    }
    built++;lowest=Math.min(lowest,plan.tip.factor);
    if(plan.tip.factor<NS.tipStop)problems.push(label+`built although it tips (factor ${plan.tip.factor.toFixed(2)})`);
    if(plan.frontHeight<plan.minFront||plan.frontHeight>NS.maxFront)problems.push(label+`drawer front ${plan.frontHeight} is outside ${plan.minFront} to ${NS.maxFront}`);
    if(plan.shelf&&plan.shelfHeight<NS.minShelf)problems.push(label+`open shelf is only ${plan.shelfHeight} tall`);
    if(!(plan.slide>=DRAWER.slideLengths[0]))problems.push(label+'no slide fits the depth');
    if(parts.filter(part=>part.name==='Drawer front').length!==plan.drawers||new Set(parts.map(part=>part.sub).filter(Boolean)).size!==plan.drawers)problems.push(label+'the drawers are not one subcomponent each');
    const boxes=parts.map(part=>{const s=size(part);return{part,lo:part.pos,hi:part.pos.map((v,i)=>v+s[i])};});
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      if([0,1,2].every(k=>Math.min(a.hi[k],b.hi[k])-Math.max(a.lo[k],b.lo[k])>.01)){problems.push(label+`${a.part.name} and ${b.part.name} share space`);i=boxes.length;break;}
    }
    const sideGap=plan.drawer.sideGap,above=plan.kind==='slide'?DRAWER.boxAbove:DRAWER.runnerAbove;
    for(const b of boxes){
      if(!/^Drawer (box|side|bottom)/.test(b.part.name))continue;
      if(b.lo[0]<.75+sideGap-.001||b.hi[0]>plan.W-.75-sideGap+.001){problems.push(label+`${b.part.name} is inside the ${fmt(sideGap)} its ${plan.kind==='slide'?'slides need':'runners leave'}`);break;}
      if(b.lo[2]<DRAWER.behind-.07){problems.push(label+`${b.part.name} reaches the back panel`);break;}
      if(b.hi[1]>plan.H-.75-above+.001){problems.push(label+`${b.part.name} would hit the top rails`);break;}
    }
    // an inset front stays inside the cabinet; an overlay front stays under the top
    for(const b of boxes){
      if(b.part.name!=='Drawer front')continue;
      if(plan.style==='inset'&&(b.lo[0]<.75+DRAWER.frontGap-.001||b.hi[0]>plan.W-.75-DRAWER.frontGap+.001||b.hi[2]>plan.D-DRAWER.insetSetBack+.001)){problems.push(label+'an inset drawer front does not sit inside the cabinet with its gaps');break;}
      if(b.hi[1]>plan.H-DRAWER.frontGap+.001){problems.push(label+'a drawer front reaches the top');break;}
    }
  }
  if(!built)problems.push('nightstand: no size at all could be built');
  SELFTESTS.nightstand={built,notBuilt,notClean,lowestTipFactor:Math.round(lowest*100)/100}; // for whoever runs the check by hand
});
