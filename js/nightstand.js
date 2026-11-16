/* NominalCAD: the "Nightstand with drawers" preset.

   A plywood cabinet a beginner can build with a saw and a drill: two sides that run to the floor, a bottom
   panel on a recessed toe kick, two rails under the top, a thin back that keeps it square, an optional open
   shelf, and one to four drawers on side-mount ball-bearing slides with overlay fronts.

   Every size rule is in NS below. nightstandPlan() turns the form into checked numbers (and says what it had
   to change and why), buildNightstand() makes the pieces from that plan, nightstandTip() checks that it will
   not fall on its face with a full drawer open, and the preset registers itself at the bottom of this file,
   so nothing else has to know about it.

   The preset rule (README.md): the form's numbers have limits (the ones in NS), nightstandCheck() hands the
   tip check to the warning box as a "stop" or a "warn", and the structural check (js/verify.js) is told what
   the panels are for (nightstandUses) and that the drawers hang on slides (hung: the drawer sides).

   The slides and pulls are bought hardware: they are in the shopping list, not in the 3D model yet. */
'use strict';

const NS={
  kick:3,                 // the bottom panel sits this far above the floor, on the toe kick
  kickBack:2,             // the toe kick is set back this far from the front, room for your toes
  rail:3,                 // width of the two rails the top is screwed to from below
  topSide:.5,             // the top overhangs each side by this much
  topFront:.5,            // and overhangs the drawer fronts by this much
  frontGap:.125,          // gap between drawer fronts and under the top (two nickels, stacked)
  frontReveal:.125,       // the drawer fronts stop this far short of the outside of each side
  frontStandoff:.0625,    // drawer fronts sit this far proud of the cabinet (the bumpers), so they never rub
  slideSide:.5,           // side-mount ball-bearing slides need 1/2 in between the drawer box and each side
  boxBelow:.5,            // clear space under each drawer box
  boxAbove:.25,           // clear space between the top drawer box and the rails
  slides:[10,12,14,16,18,20,22], // slide lengths sold in stores, inches
  slideBehind:.5,         // room left between the back of a drawer box and the back panel
  bottomUse:'general',    // what a drawer bottom is sized for: a key of USES in js/verify.js (20 lb per square foot)
  minFront:5,             // a drawer front shorter than this leaves a box too shallow to be useful
  maxFront:12,            // a taller front makes a heavy drawer that pulls the cabinet over when it is open
  minShelf:6,             // an open shelf lower than this holds nothing
  maxDrawers:4,
  // 30 in wide is the most a 3/4 in plywood bottom, shelf or rail spans between the sides without sagging
  // under a full load (the structural check allows about 29 in clear; 30 less the two sides is 28 1/2)
  minWidth:14,maxWidth:30,minDepth:12,maxDepth:24,minHeight:16,maxHeight:36,
  plyDensity:.0197,       // lb per cubic inch of softwood plywood (about 34 lb per cubic foot)
  loadPerCubicFoot:10,    // lb: a drawer packed tight with clothes
  minLoad:10,             // lb: or a small drawer with a few heavy books in it
  tipStop:1.25,           // holding force must be at least this many times the tipping force, or it is not built
  tipWarn:1.5,            // below this the form says so and tells you to strap it to the wall
};
const NIGHTSTAND_DEFAULTS={W:20,D:16,H:26,N:'2',cub:true,fh:7};
const floor16=v=>Math.floor(v*16+1e-6)/16;

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
    if(plan.shelf&&plan.frontHeight>NS.minFront)lighter=nightstandLayout(p,{frontHeight:Math.max(NS.minFront,plan.frontHeight-.5)});
    else if(!plan.shelf&&plan.drawers<NS.maxDrawers)lighter=nightstandLayout(p,{drawers:plan.drawers+1});
    // stop when there is nothing lighter left to try (the layout came back no different)
    if(!lighter||(lighter.frontHeight>=plan.frontHeight&&lighter.drawers<=plan.drawers))break;
    plan=checked(lighter);
  }
  if(plan!==first&&plan.tip.factor>=NS.tipStop){
    plan.changed=plan.changed.filter(sentence=>!/drawers were used/.test(sentence));
    plan.changed.push(plan.shelf
      ?`The drawer front${plan.drawers>1?'s were':' was'} cut back to ${fmt(plan.frontHeight)} tall: any taller and a full, open drawer could pull the cabinet over.`
      :`${plan.drawers} drawers were used: with fewer, a full, open drawer could pull the cabinet over.`);
  }
  return plan.tip.factor>=NS.tipStop?plan:first;
}
/* One layout, with no tip check. `force` lets nightstandPlan try lighter drawers: {frontHeight} with an open
   shelf, {drawers} without one. */
function nightstandLayout(p,force){
  const changed=[];
  const within=(value,lo,hi,what)=>{
    if(!(value>=lo)){changed.push(`${what} was raised to ${fmt(lo)}, the smallest that works.`);return lo;}
    if(value>hi){changed.push(`${what} was cut back to ${fmt(hi)}, the largest this design is checked for.`);return hi;}
    return value;
  };
  const W=within(p.W,NS.minWidth,NS.maxWidth,'Width');
  const D=within(p.D,NS.minDepth,NS.maxDepth,'Depth');
  const H=within(p.H,NS.minHeight,NS.maxHeight,'Height');
  const floorOfCabinet=NS.kick+.75;                    // top of the bottom panel
  const frontsTo=H-NS.frontGap;                        // the top drawer front stops just under the top
  const stack=(n,frontHeight)=>n*frontHeight+(n-1)*NS.frontGap; // height of n drawer fronts with their gaps
  const asked=Math.min(NS.maxDrawers,Math.max(1,parseInt(p.N,10)||1));
  let drawers=p.cub?asked:(force.drawers||asked),frontHeight,shelfHeight=0,frontsFrom;

  if(p.cub){
    // With an open shelf: the drawers take the front height asked for, counted down from the top, and the open
    // shelf gets what is left. It must keep at least NS.minShelf, so drawers give way first: shorter, then fewer.
    frontHeight=force.frontHeight||floor16(within(p.fh,NS.minFront,NS.maxFront,'Drawer front height'));
    const room=frontsTo-floorOfCabinet-NS.minShelf;    // the most the drawer fronts can take
    while(drawers>1&&stack(drawers,NS.minFront)>room)drawers--;
    if(drawers<asked)changed.push(`Only ${drawers} drawer${drawers>1?'s fit':' fits'} above an open shelf at this height. Make it taller, or leave out the open shelf, for more.`);
    if(stack(drawers,frontHeight)>room){
      frontHeight=floor16((room-(drawers-1)*NS.frontGap)/drawers);
      changed.push(`The drawer fronts were cut back to ${fmt(frontHeight)} tall so the open shelf keeps ${fmt(NS.minShelf)}.`);
    }
    shelfHeight=r16(frontsTo-stack(drawers,frontHeight)-floorOfCabinet);
    frontsFrom=floorOfCabinet+shelfHeight;             // the bottom drawer front covers the edge of the shelf panel
  }else{
    // With no open shelf the drawers share the whole height. The bottom front covers the edge of the bottom panel.
    frontsFrom=NS.kick;
    const share=n=>floor16((frontsTo-frontsFrom-(n-1)*NS.frontGap)/n);
    while(drawers<NS.maxDrawers&&share(drawers)>NS.maxFront)drawers++;
    if(drawers>asked)changed.push(`${drawers} drawers were used: with fewer, each drawer front would be over ${fmt(NS.maxFront)} tall, heavy enough to pull the cabinet over when open. Tick the open shelf if you want fewer drawers.`);
    while(drawers>1&&share(drawers)<NS.minFront)drawers--;
    if(drawers<asked)changed.push(`Only ${drawers} drawer${drawers>1?'s fit':' fits'} at this height: each drawer front has to be at least ${fmt(NS.minFront)} tall.`);
    frontHeight=share(drawers);
  }
  const fronts=[];
  for(let i=0;i<drawers;i++)fronts.push(r16(frontsFrom+i*(frontHeight+NS.frontGap)));

  // the slides: the longest length sold that leaves room behind the drawer
  const slide=NS.slides.filter(length=>length<=D-NS.slideBehind).pop();
  const boxWidth=W-1.5-2*NS.slideSide;                 // between the sides, less 1/2 in each side for the slides
  // A drawer box starts 1/2 in above the panel its front covers (the panel is 3/4 in thick). The top box must
  // end 1/4 in under the rails, whose underside is 3/4 in less the gap below the top edge of the top front.
  // Every box is made that same height, so all the drawer parts are cut alike.
  const boxBottom=front=>r16(front+.75+NS.boxBelow);
  const boxHeight=floor16(frontHeight-(.75+NS.boxBelow)-(.75-NS.frontGap+NS.boxAbove));
  // The drawer bottom is nailed on under the box, all the way round. 1/4 in plywood does while the box is small
  // one way; past that it would sag under a full drawer and 1/2 in is used. Same load and the same bending
  // helper as the structural check, which measures the span between the middles of the box parts.
  const bottomSpan=Math.min(boxWidth,slide)-.5;
  const thinBottom=sectionOf(1,.25,true),bottomLoad=USES[NS.bottomUse].psf/144+WOOD_RULES.DENSITY*.25;
  const bottomThick=bottomSpan>maxSpanFor(thinBottom,bottomLoad,NS.bottomUse)?.5:.25;
  if(bottomThick>.25)changed.push('The drawer bottoms are 1/2" plywood: in a drawer this size a 1/4" bottom would sag when the drawer is full.');
  return{W,D,H,shelf:!!p.cub,shelfHeight,floorOfCabinet,frontsFrom,drawers,frontHeight,fronts,slide,boxWidth,boxHeight,boxBottom,bottomThick,changed};
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
  parts.push(mk('Back panel','ply14',[W,H-NS.kick,.25],[0,NS.kick,-.25]));
  // the top covers the back panel's edge and reaches past the drawer fronts
  const topDepth=.25+D+NS.frontStandoff+.75+NS.topFront;
  parts.push(mk('Top','ply34',[W+2*NS.topSide,.75,topDepth],[-NS.topSide,H,-.25]));
  // the drawers, bottom one first
  const boxFace=D+NS.frontStandoff,boxBack=boxFace-plan.slide,boxLeft=.75+NS.slideSide;
  const bottom=plan.bottomThick,bottomPly=bottom>.25?'ply12':'ply14',sideHeight=plan.boxHeight-bottom;
  for(const front of plan.fronts){
    const y=plan.boxBottom(front);
    parts.push(
      // the box front and back run the full width and cap the ends of the sides, so every screw is hidden
      mk('Drawer box front','ply12',[plan.boxWidth,sideHeight,.5],[boxLeft,y+bottom,boxFace-.5]),
      mk('Drawer box back','ply12',[plan.boxWidth,sideHeight,.5],[boxLeft,y+bottom,boxBack]),
      mk('Drawer side','ply12',[.5,sideHeight,plan.slide-1],[boxLeft,y+bottom,boxBack+.5]),
      mk('Drawer side','ply12',[.5,sideHeight,plan.slide-1],[boxLeft+plan.boxWidth-.5,y+bottom,boxBack+.5]),
      // the bottom is glued and nailed on underneath, cut 1/16 in shy at the front so it never holds the front off
      mk('Drawer bottom',bottomPly,[plan.boxWidth,bottom,plan.slide-.0625],[boxLeft,y,boxBack]),
      mk('Drawer front','ply34',[W-2*NS.frontReveal,plan.frontHeight,.75],[NS.frontReveal,front,boxFace]));
  }
  return parts;
}

/* Will it tip forward when the top drawer is pulled all the way out, full?
   "Full" is NS.loadPerCubicFoot lb for every cubic foot of drawer (clothes packed tight), and never less than
   NS.minLoad lb (a few heavy books). Everything that is not the open drawer holds the cabinet down, turning
   about the front bottom edge of the sides (z = D); the open drawer and its load, out past that edge, try to
   tip it. Nothing on top (a lamp helps) and nothing in the other drawers is counted, which is the safe side.
   Returns {factor: holding / tipping, load}. A factor over 1 stays put; NS.tipStop is the least that is built. */
function nightstandTip(plan){
  const parts=nightstandPieces(plan),edge=plan.D;
  const topFront=plan.fronts[plan.fronts.length-1],topBox=plan.boxBottom(topFront);
  const inOpenDrawer=part=>/^Drawer/.test(part.name)&&(part.name==='Drawer front'?Math.abs(part.pos[1]-topFront)<.01:part.pos[1]>=topBox-.01);
  const cubicFeet=(plan.boxWidth-1)*(plan.slide-1)*(plan.boxHeight-plan.bottomThick)/1728;
  const load=Math.max(NS.minLoad,Math.round(cubicFeet*NS.loadPerCubicFoot));
  let holding=0,tipping=load*(NS.frontStandoff+plan.slide/2);   // the load sits in the middle of the open box
  for(const part of parts){
    const s=size(part),weight=s[0]*s[1]*s[2]*NS.plyDensity,middle=part.pos[2]+s[2]/2;
    if(inOpenDrawer(part))tipping+=weight*(middle+plan.slide-edge);
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
    'Drawer bottom':NS.bottomUse,'Drawer box front':NS.bottomUse,'Drawer box back':NS.bottomUse,'Drawer side':NS.bottomUse};
};
/* the remark under the form: what you get, anything that was changed and why, and the tip check */
function nightstandInfo(p){
  const plan=nightstandPlan(p),tip=plan.tip;
  if(tip.factor<NS.tipStop)return[...plan.changed,
    `Not built: at this size it would fall forward with the top drawer pulled all the way out and ${tip.load} lb in it, even with the smallest drawers that fit. Make it deeper or wider${plan.shelf?'':', or tick the open shelf'}.`].join(' ');
  const text=[...plan.changed,
    `${plan.drawers} drawer${plan.drawers>1?'s':''} on ${plan.slide}" side-mount slides, each front ${fmt(plan.frontHeight)} tall${plan.shelf?`, over an open shelf ${fmt(plan.shelfHeight)} tall`:''}. Inside, each drawer is ${fmt(plan.boxWidth-1)} wide and ${fmt(plan.boxHeight-plan.bottomThick)} deep.`];
  if(!plan.shelf&&p.fh!==undefined)text.push('With no open shelf the drawers share the whole height, so the drawer front height box is not used.');
  // a tip check that passes "but not by much" is said by the warning box above this remark (nightstandCheck)
  if(tip.factor>=NS.tipWarn)text.push(`Tip check: with the top drawer pulled all the way out and ${tip.load} lb in it, it stays put with room to spare.`);
  return text.join(' ');
}
function nightstandNotes(p){
  const plan=nightstandPlan(p),tip=plan.tip;
  return[
    `Drawer slides: buy ${plan.drawers} pair${plan.drawers>1?'s':''} of ${plan.slide}" side-mount ball-bearing slides. They need 1/2" between the drawer box and the cabinet on each side, and the drawer boxes here are cut for exactly that. If the package says a different gap, change the width of the drawer box front, back and bottom to match before you cut.`,
    `Each drawer front is ${fmt(plan.frontHeight)} tall with 1/8" gaps. The fronts go on last, with the drawers in place, so the gaps come out even.`,
    `Tip check: the cabinet was checked with the top drawer pulled all the way out and ${tip.load} lb in it${tip.factor>=NS.tipWarn?'':'. It passes, but not by much: fasten it to the wall'}. A nightstand is light. If small children may pull on an open drawer, fasten the cabinet to the wall with an anti-tip strap whatever its size (a furniture strap sold with child-proofing things; it is not in the shopping list).`,
    'Sizes and the tip check are rules of thumb for a bedside cabinet holding a lamp, books and clothes. They are not engineering.'];
}
function nightstandSteps(p){
  const plan=nightstandPlan(p),many=plan.drawers>1;
  // where the middle of each slide goes, measured up from the top of the bottom panel, bottom drawer first
  const slideHeights=plan.fronts.map(front=>fmt(plan.boxBottom(front)+plan.boxHeight/2-plan.floorOfCabinet)).join(', then ');
  const steps=[CUT,
    {t:`Fasten the bottom between the two sides, ${fmt(NS.kick)} up from the floor, and the two top rails between the sides flush with the top: one flush with the front edge, one flush with the back edge. Glue each joint, drill pilot holes, and drive the screws through the outside of the sides into the ends of the bottom and the rails.`,add:['Side','Bottom','Top rail']},
    {t:`Fasten the toe kick under the bottom panel, on edge, set back ${fmt(NS.kickBack)} from the front. Screw down through the bottom panel into its top edge, and through the sides into its ends.`,add:['Toe kick']}];
  if(plan.shelf)steps.push({t:`Fasten the shelf between the sides, with its underside ${fmt(plan.shelfHeight)} above the bottom panel. Cut two scrap blocks ${fmt(plan.shelfHeight)} long, stand them on the bottom panel and rest the shelf on them while you screw through the sides into its ends.`,add:['Shelf']});
  steps.push(
    {t:'Lay the cabinet on its front. Measure corner to corner both ways and push it until the two measurements match, then glue and nail the back panel on, flush with the outside of the sides and the top. The back is what keeps the cabinet square, so do not skip the glue.',add:['Back panel']},
    {t:`Stand the cabinet up. Run a thin line of glue along the top edges of the two sides, then set the top on: flush with the back of the back panel, ${fmt(NS.topSide)} past each side, and ${fmt(NS.frontStandoff+.75+NS.topFront)} past the front of the cabinet. Screw up through the two top rails into the top with 1-1/4" screws, from inside the cabinet, so no screw shows on top.`,add:['Top']},
    {t:`Build ${many?`the ${plan.drawers} drawer boxes, all the same`:'the drawer box'}. Stand the two drawer sides between the drawer box front and the drawer box back, so the front and back cover the ends of the sides. Glue each corner, then nail through the box front and the box back into the ends of the sides with brads (if you are using a hammer, drill a thin pilot hole first so the plywood does not split). Check the box is square, then glue and nail the bottom on underneath, flush at the back and the sides. It stops 1/16" short at the front on purpose.`,add:['Drawer box front','Drawer box back','Drawer side','Drawer bottom']},
    {t:`Mount the slides. Each slide pulls apart into a cabinet half and a drawer half. Screw a cabinet half to the inside of each side, level, with its front end 1/16" back from the front edge of the side and its middle ${many?'at these heights':'this high'} above the bottom panel: ${slideHeights}${many?' (bottom drawer first)':''}. Cut a scrap block to rest the slide on, so the left and right slides come out at exactly the same height. Screw a drawer half along the middle of each drawer side, flush with the front of the box. Push each drawer in until the slides click together.`,add:[]},
    {t:`Put the drawer fronts on last, ${many?'starting with the bottom one':'with the drawer in place'}. Hold the front against the drawer box so it covers the edge of the panel below it, with the same amount of cabinet side showing at each end${many?', and a 1/8" gap between fronts (two stacked nickels make a good spacer)':''}. Clamp it or stick it with double-sided tape, open the drawer, and drive 1" screws from inside the drawer, through the drawer box front into the back of the drawer front. Do not use longer screws here: they would come out through the face. ${many?'Work up, keeping the same gap. ':''}Then drill for the pulls and bolt them on.`,add:['Drawer front']},
    {t:`Before the finish goes on, pull ${many?'the drawers':'the drawer'} out and take the ${many?'pulls':'pull'} off again, so that no finish gets on the slides or the hardware. Finish the cabinet and the drawer ${many?'fronts':'front'}, let everything dry, then put the ${many?'pulls':'pull'} back and slide ${many?'the drawers':'the drawer'} in.`,add:[]},
    FIN);
  return steps;
}

PRESETS.push({
  name:'Nightstand with drawers',tile:'Drawer nightstand',spec:'Plywood, 1 to 4 drawers',icon:'i-p-cabinet',
  desc:'A bedside cabinet in plywood with one to four drawers on metal slides, and an open shelf underneath if you want one.',
  params:[num('W','Width',NIGHTSTAND_DEFAULTS.W,NS.minWidth,NS.maxWidth),num('D','Depth',NIGHTSTAND_DEFAULTS.D,NS.minDepth,NS.maxDepth),
    num('H','Height',NIGHTSTAND_DEFAULTS.H,NS.minHeight,NS.maxHeight),
    {k:'N',label:'Drawers',opts:[['1','1'],['2','2'],['3','3'],['4','4']],v:NIGHTSTAND_DEFAULTS.N},
    {k:'cub',label:'Open shelf under the drawers',check:1,v:NIGHTSTAND_DEFAULTS.cub},
    num('fh','Drawer front height (with an open shelf)',NIGHTSTAND_DEFAULTS.fh,NS.minFront,NS.maxFront)],
  build:buildNightstand,info:nightstandInfo,notes:nightstandNotes,steps:nightstandSteps,
  // The preset rule. The drawer boxes hang on bought slides screwed to the cabinet sides: the structural check
  // takes each drawer side as fastened to the cabinet side 1/2 in beside it, and the rest of the box is held
  // through the drawer sides. check(p) is the tip check with a full drawer open.
  uses:nightstandUses,hung:['Drawer side'],check:nightstandCheck,
  // the top is held by the rail screws from below, with glue on the sides, so nothing shows on top;
  // drawer boxes in 1/2 in plywood are glued and nailed, since a wood screw splits an edge that thin
  joints:[['Side','Top','glue'],['Drawer box front','Drawer side','nail'],['Drawer box back','Drawer side','nail'],
    ['Drawer bottom','Drawer side','nail'],['Drawer bottom','Drawer box front','nail'],['Drawer bottom','Drawer box back','nail']],
  hw:p=>{const plan=nightstandPlan(p);return[[`Drawer slides, ${plan.slide}" side-mount ball-bearing (pair)`,plan.drawers],['Drawer pulls',plan.drawers]];},
});
PRESET_GROUPS.find(group=>group[0]==='Bedroom')[1].push('Nightstand with drawers');

/* Checked across the whole range the form allows (and past it): nothing shares space, the drawers keep their
   clearances for the slides, and every size that gets built passes the tip check. */
SELFTESTS.push(function nightstandWithDrawers(problems){
  let built=0,notBuilt=0,notClean=0,lowest=Infinity;
  const nightstand=PRESETS.find(preset=>preset.name==='Nightstand with drawers');
  const insideLimits=p=>p.W>=NS.minWidth&&p.W<=NS.maxWidth&&p.D>=NS.minDepth&&p.D<=NS.maxDepth&&p.H>=NS.minHeight&&p.H<=NS.maxHeight&&
    p.fh>=NS.minFront&&p.fh<=NS.maxFront;
  for(const W of[5,14,20,30,36,60])for(const D of[5,12,14,16,20,24])for(const H of[5,16,20,26,30,36])
  for(const N of['1','2','3','4'])for(const cub of[true,false])for(const fh of[3,5,7,12]){
    const p={W,D,H,N,cub,fh},label=`nightstand ${JSON.stringify(p)}: `,plan=nightstandPlan(p),parts=buildNightstand(p);
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
    built++;lowest=Math.min(lowest,plan.tip.factor);
    if(plan.tip.factor<NS.tipStop)problems.push(label+`built although it tips (factor ${plan.tip.factor.toFixed(2)})`);
    if(plan.frontHeight<NS.minFront||plan.frontHeight>NS.maxFront)problems.push(label+`drawer front ${plan.frontHeight} is outside ${NS.minFront} to ${NS.maxFront}`);
    if(plan.shelf&&plan.shelfHeight<NS.minShelf)problems.push(label+`open shelf is only ${plan.shelfHeight} tall`);
    if(!(plan.slide>=NS.slides[0]))problems.push(label+'no slide fits the depth');
    const boxes=parts.map(part=>{const s=size(part);return{part,lo:part.pos,hi:part.pos.map((v,i)=>v+s[i])};});
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      if([0,1,2].every(k=>Math.min(a.hi[k],b.hi[k])-Math.max(a.lo[k],b.lo[k])>.01)){problems.push(label+`${a.part.name} and ${b.part.name} share space`);i=boxes.length;break;}
    }
    for(const b of boxes){
      if(!/^Drawer (box|side|bottom)/.test(b.part.name))continue;
      if(b.lo[0]<.75+NS.slideSide-.001||b.hi[0]>plan.W-.75-NS.slideSide+.001){problems.push(label+`${b.part.name} is inside the 1/2 in the slides need`);break;}
      if(b.lo[2]<NS.slideBehind-.07){problems.push(label+`${b.part.name} reaches the back panel`);break;}
      if(b.hi[1]>plan.H-.75-NS.boxAbove+.001){problems.push(label+`${b.part.name} would hit the top rails`);break;}
    }
  }
  if(!built)problems.push('nightstand: no size at all could be built');
  SELFTESTS.nightstand={built,notBuilt,notClean,lowestTipFactor:Math.round(lowest*100)/100}; // for whoever runs the check by hand
});
