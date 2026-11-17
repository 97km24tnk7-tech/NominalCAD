/* NominalCAD: drawers.

   One place for everything a drawer needs: its clearance rules (DRAWER), the builder that turns an opening
   into the pieces of one drawer, and the pass that puts a drawer on real slides with a pull on its front.

     DRAWER                       every clearance rule, with the reason for each number
     drawerPlan(opening, options) the numbers of one drawer for an opening, nothing drawn:
                                    {ok, problems, kind, style, sideGap, boxWidth, boxHeight, sideHeight, bottomThick,
                                     length (of the box and of its slides), travel, boxBottom, boxFace, boxBack,
                                     front {u, y, width, height}, slideHeight, slideFromEdge, slideFromBoxFront}
     buildDrawer(opening, options)  the pieces of that drawer: two sides, a box front, a box back, a bottom and the
                                    drawer front. Each carries sub: the name of its own subcomponent ("Drawer 1").
                                    Returns [] when the opening is too small; drawerPlan().problems says why.
     DRAWER_JOINTS                the fasteners between the pieces of a drawer, in the form of a preset's joints list
     mountDrawer(pieceIds, opts)  put exactly these pieces on a pair of slides (or runners), with a pull in the middle
                                  of the front. Returns {ok, message, items}. Call commit() afterwards.
     mountPresetDrawers(ids)      what placePreset calls: mounts every drawer among the new pieces
     drawerFacts(pieceId)         the numbers of a drawer that is in the design, read from its pieces and hardware:
                                  for the build instructions and for Properties

   THE OPENING
     {x, y, z, width, height, depth, across, out}
       x, y, z   the corner of the open space with the lowest x, y and z
       width     between the two cabinet sides; height  from the panel below to the rail or panel above;
       depth     from the back of the space to the FRONT EDGE of the cabinet sides
       across    0 when the width runs left to right (the usual case), 2 when it runs back to front
       out       +1 when the drawer comes out toward higher numbers along the other level direction, -1 otherwise
     Left out, across is 0 and out is +1: a cabinet that faces the front of the design.

   OPTIONS
     {name, slide: 'slide' | 'runner', front: 'overlay' | 'inset', lap: {side, top, bottom}}
       name    of the subcomponent ("Drawer 2")
       slide   metal side-mount ball-bearing slides (the default), or wooden runners
       front   an overlay front lies over the front edges of the cabinet (the default); an inset front sits inside
               the opening
       lap     how far an overlay front reaches past the opening on each edge (left out: DRAWER.lap)
       topTaken  inches at the top of the opening that the box must stay out of, because something on the
               cabinet sides hangs into it: in a stack of inset drawers on wooden runners with no rails between
               them, the runners of the drawer above (left out: 0)

   The open state of a drawer is a picture only (js/motion.js). Nothing here reads it. */
'use strict';

const DRAWER={
  /* ---- the box: 1/2 in plywood, glued and nailed, the bottom nailed on underneath ---- */
  boxPly:'ply12',boxThick:.5,
  bottomShy:.0625,        // the bottom stops 1/16 in short at the front, so it can never hold the drawer front off
  bottomUse:'general',    // what a drawer bottom is sized for: a key of USES in js/verify.js (20 lb per square foot)
  /* ---- metal side-mount ball-bearing slides ---- */
  slideSide:.5,           // each slide fills 1/2 in between the drawer box and the cabinet side: the box is 1 in narrower than its opening
  slideLengths:[10,12,14,16,18,20,22], // the lengths sold in stores, inches
  behind:.5,              // room left between the back of the box and the back of the opening
  boxBelow:.5,            // clear space under the box, so it never drags on the panel below
  boxAbove:.25,           // clear space above the box, so it can be lifted on to its slides
  slideBack:.0625,        // the cabinet half of a slide stops 1/16 in short of the front edge of the cabinet side
  /* ---- wooden runners: a strip under each side of the box, no hardware to buy ---- */
  runnerSide:.0625,       // 1/16 in each side: close enough for the cabinet sides to guide the box, loose enough to move
  runnerStrip:.75,        // the strip is 3/4 in by 3/4 in (ripped from a 1x2); the box rides on top of it
  runnerAbove:.125,       // 1/8 in above the box: the rail or the kicker strip up there keeps an open drawer from tipping down
  /* ---- the drawer front: 3/4 in plywood, screwed on from inside the box ---- */
  frontPly:'ply34',frontThick:.75,
  frontGap:.125,          // the gap between two fronts, and all around an inset front (two nickels, stacked)
  overlayStandoff:.0625,  // an overlay front sits 1/16 in proud of the cabinet (the bumpers), so it never rubs
  insetSetBack:.0625,     // an inset front sits 1/16 in behind the front edges of the cabinet, so a small error does not show
  lap:{side:.3125,top:.3125,bottom:.3125}, // an overlay front covers half of a 3/4 in edge less half the gap, unless the caller says otherwise
  /* ---- the smallest drawer worth building ---- */
  minBoxWidth:5,          // inches across the box
  minSide:1.5,            // inches of drawer side above the bottom
};
const floor16=v=>Math.floor(v*16+1e-6)/16;

/* ---------- the screws of a pull on a drawer front ----------
   A pull on a drawer front is screwed on from inside the drawer, through the front AND the drawer box front behind
   it, so the short screws in the pull's package (about 1") do not reach. The pull step asks for screws long enough
   (pullLine, js/buildsteps.js, works out what they pass through from the pieces), and the shopping list buys them:
   #8-32 machine screws (the thread of US cabinet pulls), two to a pull, priced by the row 'pull-screws' in
   js/prices.js. Both use this one length rule. (The Computer desk buys the same line through its own
   deskPullScrewLabel, js/computerdesk.js, with the same rule; it can switch to drawerPullScrewLine.) */
const PULL_SCREW_INTO_PULL=.375;   // how far the screw goes into the pull
/* The length of screw for this much wood (inches): the wood and 3/8" into the pull, to the next 1/4" up. With no
   wood given: a drawer front on a drawer box front (DRAWER.frontThick + DRAWER.boxThick, 1 3/4"). */
function drawerPullScrewLength(wood){
  const through=wood||DRAWER.frontThick+DRAWER.boxThick;
  return Math.ceil((through+PULL_SCREW_INTO_PULL)*4)/4;
}
/* The shopping-list line for the screws of `pulls` pulls on drawer fronts over drawer boxes: [label, count]. */
function drawerPullScrewLine(pulls,wood){
  return[`Machine screws, #8-32 × ${fmt(drawerPullScrewLength(wood))}, for the drawer pulls (the ones in the package are too short)`,2*pulls];
}
/* The fasteners between the pieces of a drawer. The box is glued and nailed (a wood screw splits an edge of 1/2 in
   plywood); the front is screwed on from inside the box with screws too short to reach the face; the ends of the
   drawer sides only touch the back of the front. */
const DRAWER_JOINTS=[['Drawer box front','Drawer side','nail'],['Drawer box back','Drawer side','nail'],
  ['Drawer bottom','Drawer side','nail'],['Drawer bottom','Drawer box front','nail'],['Drawer bottom','Drawer box back','nail'],
  ['Drawer side','Drawer front','none'],['Drawer box front','Drawer front','screw']];

/* ---------- the numbers of one drawer ---------- */
function drawerPlan(opening,options){
  options=options||{};
  const kind=options.slide==='runner'?'runner':'slide',style=options.front==='inset'?'inset':'overlay';
  const problems=[];
  // across the opening: the gap the slide or the runner needs on each side
  const sideGap=kind==='slide'?DRAWER.slideSide:DRAWER.runnerSide;
  const boxWidth=r16(opening.width-2*sideGap);
  // up and down: room under the box (clear air over a slide-hung box, the runner strip under a box that rides on it)
  const below=kind==='slide'?DRAWER.boxBelow:DRAWER.runnerStrip;
  const above=kind==='slide'?DRAWER.boxAbove:DRAWER.runnerAbove;
  // topTaken: the top of the space is not free all the way up (the runners of the drawer above hang into it)
  const boxHeight=floor16(opening.height-below-above-(options.topTaken||0));
  // front to back, measured from the back of the opening: where the front of the box is, and the longest slide that fits behind it
  const boxFace=style==='overlay'?opening.depth+DRAWER.overlayStandoff:opening.depth-DRAWER.insetSetBack-DRAWER.frontThick;
  const length=DRAWER.slideLengths.filter(stock=>stock<=boxFace-DRAWER.behind+1e-6).pop()||0;
  if(!length){
    const needed=DRAWER.slideLengths[0]+DRAWER.behind+(style==='inset'?DRAWER.insetSetBack+DRAWER.frontThick:0);
    problems.push(`The space is ${fmt(opening.depth)} deep. The shortest drawer slide is ${fmt(DRAWER.slideLengths[0])} long, so the space must be at least ${fmt(r16(needed))} deep.`);
  }
  if(boxWidth<DRAWER.minBoxWidth)problems.push(`The space is ${fmt(opening.width)} wide. It must be at least ${fmt(DRAWER.minBoxWidth+2*sideGap)} wide for a drawer box and its ${kind==='slide'?'slides':'runners'}.`);
  // The bottom is nailed on under the box, all the way round. 1/4 in plywood does while the box is small one way;
  // past that it would sag under a full drawer and 1/2 in is used. Same load and the same bending helper as the
  // structural check, which measures the span between the middles of the box parts.
  const bottomSpan=Math.min(boxWidth,length)-DRAWER.boxThick;
  const thinBottom=sectionOf(1,.25,true),bottomLoad=USES[DRAWER.bottomUse].psf/144+WOOD_RULES.DENSITY*.25;
  const bottomThick=bottomSpan>maxSpanFor(thinBottom,bottomLoad,DRAWER.bottomUse)?.5:.25;
  const sideHeight=r16(boxHeight-bottomThick);
  if(sideHeight<DRAWER.minSide)problems.push(`The space is ${fmt(opening.height)} tall. It must be at least ${fmt(r16(below+above+bottomThick+DRAWER.minSide))} tall for a drawer box.`);
  // the drawer front, measured from the low corner of the opening
  const lap=Object.assign({},DRAWER.lap,options.lap||{}),gap=DRAWER.frontGap;
  const front=style==='overlay'
    ?{u:-lap.side,y:-lap.bottom,width:r16(opening.width+2*lap.side),height:r16(opening.height+lap.top+lap.bottom)}
    :{u:gap,y:gap,width:r16(opening.width-2*gap),height:r16(opening.height-2*gap)};
  // Where the slides go. The cabinet half stops slideBack short of the front edge of the cabinet side; behind an
  // inset front it starts where the box starts. slidePlan (js/hanging.js) places them by the same rule.
  const slideFront=Math.min(boxFace,opening.depth-DRAWER.slideBack);
  const travel=length&&typeof HARDWARE!=='undefined'?HARDWARE[kind].travel(length):length;
  return{ok:!problems.length,problems,kind,style,sideGap,boxWidth,boxHeight,sideHeight,bottomThick,length,travel,
    boxBottom:below,                  // the underside of the drawer bottom, above the floor of the opening
    boxFace,boxBack:boxFace-length,   // the front and the back of the box, from the back of the opening
    front,
    // the middle of a slide, or the top of a runner, above the floor of the opening
    slideHeight:kind==='slide'?r16(below+bottomThick+sideHeight/2):below,
    slideFromEdge:r16(opening.depth-slideFront),   // the front end of the cabinet half, behind the front edge of the cabinet side
    slideFromBoxFront:r16(boxFace-slideFront)};    // the front end of the drawer half, behind the front of the box
}

/* ---------- the pieces of one drawer ---------- */
function buildDrawer(opening,options){
  options=options||{};
  const plan=drawerPlan(opening,options),parts=[];
  parts.plan=plan;
  if(!plan.ok)return parts;
  const across=opening.across===2?2:0,deep=2-across,out=opening.out===-1?-1:1,name=options.name||'Drawer';
  /* one piece from sizes and a place measured in the opening: u across it, y up, w from its back toward its front */
  const piece=(pieceName,material,sizeU,sizeY,sizeW,u,y,w)=>{
    const extent=[0,0,0],at=[0,0,0],corner=[opening.x,opening.y,opening.z];
    extent[across]=sizeU;extent[1]=sizeY;extent[deep]=sizeW;
    at[across]=corner[across]+u;
    at[1]=corner[1]+y;
    at[deep]=out>0?corner[deep]+w:corner[deep]+opening.depth-w-sizeW;
    const made=mk(pieceName,material,extent,at);
    made.sub=name;
    parts.push(made);
  };
  const thick=DRAWER.boxThick,bottomPly=plan.bottomThick>.25?'ply12':'ply14';
  const left=plan.sideGap,sidesFrom=plan.boxBottom+plan.bottomThick;
  // the sides run the whole length of the box, because the slides are screwed along them
  piece('Drawer side',DRAWER.boxPly,thick,plan.sideHeight,plan.length,left,sidesFrom,plan.boxBack);
  piece('Drawer side',DRAWER.boxPly,thick,plan.sideHeight,plan.length,left+plan.boxWidth-thick,sidesFrom,plan.boxBack);
  // the box front and the box back fit between the sides; the nails go through the sides into their ends
  piece('Drawer box front',DRAWER.boxPly,plan.boxWidth-2*thick,plan.sideHeight,thick,left+thick,sidesFrom,plan.boxFace-thick);
  piece('Drawer box back',DRAWER.boxPly,plan.boxWidth-2*thick,plan.sideHeight,thick,left+thick,sidesFrom,plan.boxBack);
  piece('Drawer bottom',bottomPly,plan.boxWidth,plan.bottomThick,plan.length-DRAWER.bottomShy,left,plan.boxBottom,plan.boxBack);
  piece('Drawer front',DRAWER.frontPly,plan.front.width,plan.front.height,DRAWER.frontThick,plan.front.u,plan.front.y,plan.boxFace);
  return parts;
}

/* ---------- mounting: slides or runners, a pull, and kickers where a runner drawer needs them ---------- */
const DRAWER_PULLS=['pull','knob'];
function mountDrawer(pieceIds,opts){
  opts=opts||{};
  const own=new Set(pieceIds),pieces=S.parts.filter(p=>own.has(p.id)&&!isProp(p));
  // the kind that was asked for, or else the one whose gap the drawer has: 1/2 in for metal slides, next to none for runners
  // A pair, one on each side, is what a drawer runs on: a kind that only finds one side with its gap loses to a
  // kind that finds both.
  let kind=opts.kind||'slide';
  if(!opts.kind){
    const plans=['slide','runner'].map(tried=>slidePlan(pieceIds,{exact:true,kind:tried,dir:opts.dir}));   // js/hanging.js
    const best=plans.find(plan=>plan.ok&&plan.items.length>1)||plans.find(plan=>plan.ok);
    if(!best)return plans[0];
    kind=best.items[0].kind;
  }
  const result=mountSlides(pieceIds,{exact:true,kind,dir:opts.dir});
  if(!result.ok)return result;
  // Its hardware is drawn from here on. What a preset declared as "hangs on hardware that is not drawn" no longer
  // stands in for it: take a slide away and Check my design says the drawer is not held (js/holds.js).
  for(const p of pieces)p.unhung=true;
  const pose=hardwarePose(result.items[0]),travelAxis=[0,1,2].find(k=>Math.abs(pose.u.getComponent(k))>.5);
  const outward=pose.u.getComponent(travelAxis)>0?1:-1;
  if(result.items[0].kind==='runner'&&opts.kickers!==false)addKickers(result.items,[own]);
  if(opts.pull!==false){
    // the front: the piece that lies across the way the drawer travels and is farthest out
    const reach=p=>outward>0?plainBox(p).hi[travelAxis]:-plainBox(p).lo[travelAxis];
    const front=pieces.filter(p=>!tilted(p)&&p.ax[2]===travelAxis).sort((p,q)=>reach(q)-reach(p))[0];
    if(front&&!hardwareOn(front.id).some(item=>DRAWER_PULLS.includes(item.kind))){
      const narrow=Math.min(front.l,front.w)<3||Math.max(front.l,front.w)<8;
      result.items.push(addPull(front,{sign:outward,kind:narrow?'knob':'pull'}));
      result.message+=` A ${narrow?'knob':'pull'} is in the middle of its front.`;
    }
  }
  return result;
}
/* The space a wooden strip fills, as a box of the world: a runner (under the drawer, against the cabinet side) or a
   kicker (on the cabinet side). For strips on pieces that stand square, which is all the strips there are. */
function stripBox(item){
  const pose=hardwarePose(item),strip=DRAWER.runnerStrip;
  if(!pose||(item.kind!=='runner'&&item.kind!=='kicker'))return null;
  const travelAxis=[0,1,2].find(k=>Math.abs(pose.u.getComponent(k))>.5),acrossAxis=2-travelAxis;
  const lo=[0,0,0],hi=[0,0,0];
  lo[travelAxis]=pose.at.getComponent(travelAxis)-item.size/2;
  hi[travelAxis]=lo[travelAxis]+item.size;
  // out of the face it is fixed to: a runner is measured from the face of the drawer side toward the cabinet side
  // (the gap between them), a kicker from the face of the cabinet side toward the drawer
  const out=pose.n.getComponent(acrossAxis)>0?1:-1,face=pose.at.getComponent(acrossAxis);
  const far=item.kind==='runner'?face+out*((item.geo&&item.geo.g)||0):face,near=item.kind==='runner'?far-out*strip:far+out*strip;
  lo[acrossAxis]=Math.min(far,near);hi[acrossAxis]=Math.max(far,near);
  if(item.kind==='runner'){hi[1]=pose.at.y;lo[1]=hi[1]-strip;}              // its top is where the drawer rides
  else if(item.geo&&item.geo.mid){lo[1]=pose.at.y-strip/2;hi[1]=lo[1]+strip;} // a kicker is placed by its middle
  else{lo[1]=pose.at.y;hi[1]=lo[1]+strip;}                                   // (kickers of an earlier version: by their underside)
  return{lo,hi};
}
/* A drawer on wooden runners tips down when it is pulled out unless something is right above its sides. Where a
   rail or a panel is there (within KICKER_REACH: the drawers of a stack are cut alike, and what is left over of
   the height, up to 7/16 in, ends up above the top one), that does the job; so does the runner of the drawer above, when it
   is fixed to the cabinet side right over the drawer side. Where there is nothing, a kicker strip goes on the
   cabinet side above the drawer side, its underside 1/8 in (DRAWER.runnerAbove) above it. A kicker is placed by
   its MIDDLE, like every other piece of hardware, so "measured to the middle" is true wherever its place is read.
   runners: the runner items of the drawers to look at. drawers: the pieces of each of those drawers, as Sets of
   ids (a drawer's own pieces never count as "something above it"). Call it when every runner is in place. */
const KICKER_REACH=.5;
function addKickers(runners,drawers){
  const strips=hardwareList().filter(item=>item.kind==='runner'||item.kind==='kicker').map(item=>({item,box:stripBox(item)}));
  for(const runner of runners){
    const drawerSide=byId(runner.on),cabinetSide=byId(runner.to);
    if(!drawerSide||!cabinetSide)continue;
    const own=drawers.find(ids=>ids.has(runner.on))||new Set([runner.on]);
    const pose=hardwarePose(runner),sideBox=plainBox(drawerSide),top=sideBox.hi[1];
    const travelAxis=[0,1,2].find(k=>Math.abs(pose.u.getComponent(k))>.5),acrossAxis=2-travelAxis;
    const rightAbove=b=>b.lo[1]>=top-.01&&b.lo[1]<=top+KICKER_REACH+.01&&
      b.lo[acrossAxis]<sideBox.hi[acrossAxis]&&b.hi[acrossAxis]>sideBox.lo[acrossAxis]&&
      b.lo[travelAxis]<sideBox.hi[travelAxis]&&b.hi[travelAxis]>sideBox.lo[travelAxis];
    const coveredByWood=S.parts.some(other=>!own.has(other.id)&&!isProp(other)&&!tilted(other)&&rightAbove(plainBox(other)));
    const coveredByStrip=strips.some(strip=>strip.item!==runner&&strip.box&&rightAbove(strip.box));
    if(coveredByWood||coveredByStrip)continue;
    // on the face of the cabinet side that looks at the drawer
    const gap=(runner.geo&&runner.geo.g)||0;
    const at=pose.at.clone().addScaledVector(pose.n,gap);
    at.y=top+DRAWER.runnerAbove+DRAWER.runnerStrip/2;
    const inward=pose.n.clone().negate();
    const kicker=addHardware({kind:'kicker',size:runner.size,on:cabinetSide.id,to:null,
      at:toHostFrame(cabinetSide,at),n:toHostFrame(cabinetSide,inward,true),u:toHostFrame(cabinetSide,pose.u,true),
      geo:{mid:1,for:drawerSide.id}});
    strips.push({item:kicker,box:stripBox(kicker)});
  }
}
/* Every drawer among the pieces a preset just added: a subcomponent that has drawer sides in it (buildDrawer marks
   its pieces, componentFromPreset turns the marks into subcomponents). Returns the messages of the ones that
   could not be mounted. */
function mountPresetDrawers(ids){
  const groups=new Map();
  for(const id of ids){
    const piece=byId(id),comp=compChain(id)[0];
    if(!piece||isProp(piece)||!comp||comp.parent==null)continue;
    if(!groups.has(comp.id))groups.set(comp.id,[]);
    groups.get(comp.id).push(piece);
  }
  const failed=[],runners=[],drawers=[];
  for(const pieces of groups.values()){
    if(!pieces.some(p=>p.name==='Drawer side'))continue;
    const ids=pieces.map(p=>p.id),result=mountDrawer(ids,{kickers:false});
    if(!result.ok)failed.push(result.message);
    else{
      runners.push(...result.items.filter(item=>item.kind==='runner'));
      drawers.push(new Set(ids));
    }
  }
  // The kickers come last, when every runner is in place: the runner of the drawer above is what keeps a lower
  // drawer from tipping wherever it sits right over the drawer side, and a kicker there would be in its way.
  if(runners.length)addKickers(runners,drawers);
  return failed;
}

/* ---------- the numbers of a drawer that is in the design ---------- */
/* For the piece of any drawer that is on slides or runners: what the build instructions need to say where the
   hardware goes. Heights are measured up from the floor (y = 0) and from the lowest panel between the two
   cabinet sides, whichever the caller wants to quote. Returns null when the piece rides on nothing. */
function drawerFacts(pieceId){
  const mover=moverOf(pieceId);
  if(!mover||mover.kind!=='slide')return null;
  const first=mover.items[0],pose=hardwarePose(first),cabinetSide=byId(first.to);
  const travelAxis=[0,1,2].find(k=>Math.abs(pose.u.getComponent(k))>.5),outward=pose.u.getComponent(travelAxis)>0?1:-1;
  const frontEnd=pose.at.getComponent(travelAxis)+outward*first.size/2;
  const cabinetBox=cabinetSide?plainBox(cabinetSide):null;
  const cabinetEdge=cabinetBox?(outward>0?cabinetBox.hi[travelAxis]:cabinetBox.lo[travelAxis]):frontEnd;
  const drawerSide=byId(first.on),sideBox=plainBox(drawerSide);
  const boxFront=outward>0?sideBox.hi[travelAxis]:sideBox.lo[travelAxis];
  const pulls=hardwareList().filter(item=>mover.riders.has(item.on)&&DRAWER_PULLS.includes(item.kind));
  return{
    name:mover.name,kind:first.kind,pairs:mover.items.length/2,
    length:first.size,travel:mover.travel,
    sideGap:(first.geo&&first.geo.g)||0,                          // between the drawer side and the cabinet side
    slideHeight:r16(pose.at.y),                                   // the middle of a slide (the top of a runner), above the floor
    slideFromEdge:r16((cabinetEdge-frontEnd)*outward),            // its front end, behind the front edge of the cabinet side
    slideFromBoxFront:r16((boxFront-frontEnd)*outward),           // and behind the front end of the drawer side
    cabinetSide:cabinetSide?cabinetSide.name:'',
    pull:pulls.length?{kind:pulls[0].kind,size:pulls[0].size,centered:pulls[0].at.every((v,k)=>k===travelAxis||Math.abs(v)<.01)}:null,
  };
}

/* ---------- checks ---------- */
/* The Nightstand as Create places it, at its usual sizes, with every choice of every option and at each limit:
   nothing shares space, every drawer is one subcomponent on a pair of slides (or runners) that sit where the steps
   say, with a pull in the middle of its front; each opens all the way and hits nothing; the shopping list counts
   slides in pairs and pulls once; Check my design passes, and says so when a slide or a cabinet side is taken
   away; something in the way of a drawer is named; and the tip rule still refuses what would fall over. */
SELFTESTS.push(function drawersOnRealSlides(problems){
  const wrong=text=>problems.push('drawers: '+text);
  const preset=PRESETS.find(candidate=>candidate.name==='Nightstand with drawers');
  if(!preset){wrong('there is no Nightstand with drawers');return;}
  const tabKept=tab,modeKept=woodMode;
  let presetKept=null;   // placePreset remembers the preset it placed for the dialog; that must not change here
  try{presetKept=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  const usual=presetDefaults(preset);
  const place=vals=>{
    const parts=preset.build(vals);
    if(!parts.length)return false;
    load(JSON.stringify(blank()),true);
    placePreset(preset,vals,parts,false);
    return true;
  };
  const check=()=>verifyDesign(S.parts,designCheckOptions());
  const stops=()=>check().problems.filter(found=>found.level==='stop');
  const count=(rows,words)=>rows.filter(row=>words.test(row[0])&&!HW_NOT_PLAIN.test(row[0])).reduce((sum,row)=>sum+row[1],0);
  // every choice of every option, each number at both of its limits, and a few corners
  const cases=[{}];
  for(const field of preset.params){
    if(field.opts)field.opts.forEach(([value])=>cases.push({[field.k]:value}));
    else if(field.check)cases.push({[field.k]:!field.v});
    else if(field.min!==undefined)cases.push({[field.k]:field.min},{[field.k]:field.max});
  }
  cases.push({slides:'runner',fronts:'inset'},{cub:false,N:'4',H:36},{cub:false,slides:'runner',N:'3',H:30},{cub:false,fronts:'inset',N:'4',H:36,W:30,D:24},
    {W:14,D:12},{W:30,D:24,H:36,N:'4',cub:false,slides:'runner',fronts:'inset'},
    // a depth with a half inch in it: the back of the drawer box then stands as far from the back panel as a
    // slide is thick, and must not be taken for a side of the drawer
    {D:12.5},{D:14.5},{D:16.5,N:'3',H:30},{D:12.5,slides:'runner'},{D:22.5,slides:'runner'},{D:18.5,slides:'runner',fronts:'inset'},{D:14.5,fronts:'inset'});
  try{
    setWoodMode('solid');
    for(const extra of cases){
      const vals={...usual,...extra},label=`the nightstand with ${JSON.stringify(extra)}: `,plan=nightstandPlan(vals);
      if(!place(vals))continue;   // refused by the tip rule: checked below
      drawersAsPlaced(plan,label,wrong,check,count);
    }
    // every depth the form takes in half inches (and a few odd ones), on slides and on runners: each drawer is on
    // its own pair of the length the plan names, and Check my design finds no stop
    for(const slides of['slide','runner']){
      for(let D=NS.minDepth;D<=NS.maxDepth;D+=.5){
        for(const depth of D%2?[D]:[D,D+.125]){
          const vals={...usual,D:depth,slides},plan=nightstandPlan(vals);
          if(depth>NS.maxDepth||!place(vals))continue;
          const label=`the nightstand ${depth}" deep on ${slides}s: `,list=movers();
          if(list.length!==plan.drawers||list.some(mover=>mover.items.length!==2||mover.items.some(item=>item.kind!==slides||item.size!==plan.slide||byId(item.to).name!=='Side'))){
            wrong(label+`its drawers are on ${list.map(mover=>mover.items.map(item=>`${item.size}" ${item.kind} on ${byId(item.to).name}`).join(' and ')).join('; ')||'nothing'}, not each on a pair of ${plan.slide}" ${slides}s on the cabinet sides`);
          }else if(stops().length)wrong(label+'Check my design says: '+stops()[0].text);
        }
      }
    }

    // taking hardware or a cabinet side away is noticed, for slides and for runners
    for(const slides of['slide','runner']){
      const label=`the nightstand on ${slides}s: `;
      place({...usual,slides});
      const lead=movers()[0].lead,pair=movers()[0].items.map(item=>item.id);
      removeHardware([pair[0]]);commit();
      if(!stops().some(found=>/Drawer side/.test(found.text)))wrong(label+'with one slide of a drawer removed, Check my design does not name the drawer side that lost it');
      removeHardware([pair[1]]);commit();
      if(!stops().some(found=>/Nothing holds up/.test(found.text)&&/Drawer/.test(found.text)))wrong(label+'with both slides of a drawer removed, Check my design does not say that nothing holds the drawer up');
      if(moverOf(lead.id))wrong(label+'a drawer with no slides can still be pulled out');
      // "Mount this drawer" puts it back, and the check is clean again
      sel=new Set([lead.id]);
      mountDrawerOfSel();
      if(!moverOf(lead.id)||moverOf(lead.id).items.length!==2||stops().length)wrong(label+'mounting the drawer again by hand did not bring it back: '+(stops()[0]||{text:'it does not move'}).text);
      if(hardwareList().filter(item=>DRAWER_PULLS.includes(item.kind)).length!==movers().length)wrong(label+'mounting a drawer again gave it a second pull');
      // a cabinet side deleted: the slides on it hold nothing
      place({...usual,slides});
      sel=new Set([S.parts.find(p=>p.name==='Side').id]);
      delSel();
      if(!stops().some(found=>/Drawer/.test(found.text)))wrong(label+'with a cabinet side deleted, Check my design does not say the drawers lost their hold');
    }

    // something in the way of a drawer: the warning names it
    place(usual);
    const topDrawer=movers()[movers().length-1],frontBox=bbox(topDrawer.parts);
    addParts([mk('Block','2x4',[10,3.5,1.5],[5,frontBox.lo[1]+1,frontBox.hi[2]+3])]);
    commit();
    const blocked=moverOf(topDrawer.lead.id),reach=openReach(blocked);
    if(!reach.hit||reach.hit.other.name!=='Block'||reach.free>=1)wrong('a block 3" in front of a drawer is not found in its way');
    setOpen(blocked,1);commit();
    if(!motionTroubles().some(trouble=>/Block/.test(trouble.text))||$('#stMotion').hidden)wrong('a drawer pulled into a block shows no warning that names the block');

    // the tip rule: what would fall forward is still refused with a reason and a fix, and what is built holds
    // Cabinets small, light and low with no open shelf: the 14 by 12 one, 16" tall, tips. The form now asks for
    // the overall size and stops at 21" tall, where nothing it allows tips; so that the rule itself stays checked,
    // these cabinets are typed as their overall sizes with the form's lowest height let down for the loop.
    let refused=0;
    const lowestKept=NS.minHeight;
    try{
      NS.minHeight=nightstandOverall({W:14,D:12,H:16},'overlay').H;
      for(const D of[12,13,14])for(const W of[14,16]){
        const vals={...usual,...nightstandOverall({W,D,H:16},'overlay'),N:'1',cub:false},plan=nightstandPlan(vals),built=preset.build(vals).length>0;
        if(built&&plan.tip.factor<NS.tipStop)wrong(`a nightstand ${W}" wide and ${D}" deep is built although a full open drawer tips it`);
        if(!built){
          refused++;
          const refusal=nightstandCheck(vals)[0];
          if(!refusal||refusal.level!=='stop'||!refusal.fix)wrong(`a nightstand ${W}" wide and ${D}" deep is not built, and check(p) does not say why`);
        }
      }
    }finally{NS.minHeight=lowestKept;}
    if(!refused)wrong('the tip rule refuses nothing any more');
    // wooden runners let a drawer out two thirds of the way, so they tip a cabinet less, never more
    const onSlides=nightstandPlan(usual),onRunners=nightstandPlan({...usual,slides:'runner'});
    if(!(onRunners.travel<onSlides.travel)||!(onRunners.tip.factor>onSlides.tip.factor))wrong('the tip check does not use how far the drawer really comes out');

    // the builder itself: too small a space is refused in words, and every direction gives the same drawer
    const tooShallow=drawerPlan({x:0,y:0,z:0,width:16,height:6,depth:9},{}),tooLow=drawerPlan({x:0,y:0,z:0,width:16,height:2,depth:16},{});
    if(tooShallow.ok||!/deep/.test(tooShallow.problems[0])||tooLow.ok||!/tall/.test(tooLow.problems.join(' ')))wrong('a space too shallow or too low for a drawer is not refused with the reason');
    if(buildDrawer({x:0,y:0,z:0,width:16,height:6,depth:9},{}).length)wrong('buildDrawer made pieces for a space no slide fits');
    const facing=buildDrawer({x:0,y:0,z:0,width:16,height:6,depth:16},{name:'Drawer 9'});
    const sideways=buildDrawer({x:0,y:0,z:0,width:16,height:6,depth:16,across:2,out:-1},{name:'Drawer 9'});
    if(facing.length!==6||sideways.length!==6||facing.some(part=>part.sub!=='Drawer 9'))wrong('buildDrawer does not return six pieces marked with the name of their drawer');
    else if(facing.some((part,index)=>Math.abs(size(part)[0]-size(sideways[index])[2])>1e-6||Math.abs(size(part)[2]-size(sideways[index])[0])>1e-6))wrong('a drawer built for a cabinet that faces sideways is not the same drawer turned');
  }finally{
    setWoodMode(modeKept);
    load(JSON.stringify(blank()),true);
    setTab(tabKept);
    try{
      if(presetKept===null)localStorage.removeItem(LAST_PRESET_KEY);
      else localStorage.setItem(LAST_PRESET_KEY,presetKept);
    }catch(e){}
    if($('#toast'))$('#toast').classList.remove('on');
  }
});
/* One placed nightstand, looked at drawer by drawer (the design on screen is the one made from `plan`). */
function drawersAsPlaced(plan,label,wrong,check,count){
  const kind=plan.kind,heights=nightstandHeights(plan);
  if(findClashes().length)wrong(label+'pieces share space');
  const list=movers();
  if(list.length!==plan.drawers){wrong(label+`${list.length} drawers can move, of ${plan.drawers}`);return;}
  list.forEach((mover,index)=>{
    const name=`Drawer ${index+1}`;
    if(mover.name!==name||mover.riders.size!==6||mover.stuck)wrong(label+`${name} is not six pieces that move as one (${mover.name}, ${mover.riders.size} pieces${mover.stuck?', stuck on '+mover.stuck.name:''})`);
    if(mover.kind!=='slide'||mover.items.length!==2||mover.items.some(item=>item.kind!==kind||item.size!==plan.slide))wrong(label+`${name} is not on a pair of ${plan.slide}" ${kind}s`);
    if(Math.abs(mover.travel-HARDWARE[kind].travel(plan.slide))>1e-6)wrong(label+`${name} comes out ${mover.travel}", not as far as its ${kind}s allow`);
    if(mover.travel>plan.slide+1e-6||(kind==='runner'&&mover.travel>plan.slide*.7))wrong(label+`${name} comes out ${mover.travel}", further than ${plan.slide}" ${kind}s can carry it`);
    const reach=openReach(mover);
    if(reach.hit||reach.free<1)wrong(label+`${name} hits ${reach.hit?reach.hit.other.name:'something'} before it is fully open`);
    // the hardware sits where the steps say, between the drawer side and the cabinet side, on the cabinet side
    const facts=drawerFacts(mover.lead.id),stepHeight=plan.underDrawers+heights.hardware[index];
    if(Math.abs(facts.slideHeight-stepHeight)>.001)wrong(label+`the ${kind}s of ${name} are ${fmt(facts.slideHeight)} above the floor; the steps put them ${fmt(stepHeight)} up`);
    if(Math.abs(facts.slideFromEdge-plan.drawer.slideFromEdge)>.001||Math.abs(facts.slideFromBoxFront-plan.drawer.slideFromBoxFront)>.001)wrong(label+`the ${kind}s of ${name} start ${fmt(facts.slideFromEdge)} behind the cabinet edge; the steps say ${fmt(plan.drawer.slideFromEdge)}`);
    if(Math.abs(facts.sideGap-plan.drawer.sideGap)>.001)wrong(label+`${name} has ${fmt(facts.sideGap)} beside it, not ${fmt(plan.drawer.sideGap)}`);
    for(const item of mover.items){
      const cabinetSide=byId(item.to),pose=hardwarePose(item);
      if(!cabinetSide||cabinetSide.name!=='Side'){wrong(label+`a ${kind} of ${name} is not fixed to a cabinet side`);continue;}
      const b=plainBox(cabinetSide);
      if(pose.at.z+item.size/2>b.hi[2]+.001||pose.at.z-item.size/2<b.lo[2]-.001)wrong(label+`a ${kind} of ${name} reaches past the cabinet side`);
      // both halves are drawn, each on its own piece: the drawer half travels, the cabinet half stays
      const drawn=hardwareMeshes.filter(mesh=>mesh.userData.hw===item.id);
      const onDrawer=drawn.filter(mesh=>mesh.parent===meshes.get(item.on)).length,onCabinet=drawn.filter(mesh=>mesh.parent===meshes.get(item.to)).length;
      if(onCabinet!==1||onDrawer!==(kind==='slide'?1:0))wrong(label+`a ${kind} of ${name} is drawn with ${onDrawer} part on the drawer and ${onCabinet} on the cabinet`);
    }
    if(!facts.pull||!facts.pull.centered)wrong(label+`${name} has no pull in the middle of its front`);
  });
  // opened, the picture moves by the travel and the design itself stays where it is
  const top=list[list.length-1],front=top.parts.find(p=>p.name==='Drawer front'),closedZ=meshes.get(front.id).position.z,stood=front.pos[2];
  setOpen(top,1);commit();
  const opened=moverOf(front.id);
  if(Math.abs(meshes.get(front.id).position.z-closedZ-opened.travel)>1e-6||front.pos[2]!==stood)wrong(label+'the open top drawer is not drawn pulled out by its travel, or opening it moved the piece itself');
  if(motionTroubles().length)wrong(label+'an open drawer is reported as hitting something: '+motionTroubles()[0].text);
  setOpen(opened,0);commit();
  // the shopping list: slides in pairs, pulls once each, nothing left of the preset's own lines
  const rows=hardwareTotals(findJoints()).rows,pulls=count(rows,/\bpulls?\b|knob/i);
  if(pulls!==plan.drawers)wrong(label+`${pulls} pulls are on the shopping list for ${plan.drawers} drawers`);
  if(kind==='slide'){
    if(count(rows,/slide/i)!==plan.drawers)wrong(label+`${count(rows,/slide/i)} pairs of slides are on the shopping list for ${plan.drawers} drawers`);
  }else{
    // Runners and kickers are strips of wood to cut: they are rows of the cut list (one for each strip), never
    // hardware to buy, and what the shopping list buys for them is their screws, three for each strip.
    const strips=2*plan.drawers+2*plan.kickerPairs,onCutList=cutRows().rows.filter(row=>row.strip).reduce((sum,row)=>sum+row.qty,0);
    if(onCutList!==strips)wrong(label+`${onCutList} runner and kicker strips are on the cut list; the drawers need ${strips}`);
    if(count(rows,/runner/i)||count(rows,/kicker/i)||count(rows,/slide/i))wrong(label+'wooden runners or kickers are on the shopping list as hardware to buy, although they are cut from a board');
    const stripScrews=hardwareRows([]).filter(row=>row[0]===HARDWARE.runner.wood.screwLabel).reduce((sum,row)=>sum+row[1],0);
    if(stripScrews!==3*strips)wrong(label+`${stripScrews} screws are listed for ${strips} runner and kicker strips, which take 3 each`);
  }
  if(hardwareList().filter(item=>item.kind==='kicker').length!==2*plan.kickerPairs)wrong(label+`there are ${hardwareList().filter(item=>item.kind==='kicker').length} kicker strips; the plan and the steps count ${2*plan.kickerPairs}`);
  // Wooden strips are wood: a runner or a kicker shares no space with a piece or with another strip, every drawer
  // side on runners has something within reach right above it (a rail, a panel, a kicker, or the runner of the
  // drawer above), with room to move, and a kicker sits where the steps put it.
  const strips=hardwareList().filter(item=>item.kind==='runner'||item.kind==='kicker').map(item=>({item,box:stripBox(item)}));
  const shares=(a,b)=>[0,1,2].every(k=>Math.min(a.hi[k],b.hi[k])-Math.max(a.lo[k],b.lo[k])>.01);
  for(const strip of strips){
    const inWood=S.parts.find(p=>!isProp(p)&&shares(strip.box,plainBox(p)));
    if(inWood){wrong(label+`a ${strip.item.kind} strip is drawn through ${inWood.name}`);break;}
    if(strips.some(other=>other!==strip&&shares(strip.box,other.box))){wrong(label+`a ${strip.item.kind} strip is drawn through another strip`);break;}
  }
  if(kind==='runner'){
    const kickerHeights=heights.kickers.map(height=>plan.underDrawers+height);
    const undersides=strips.filter(strip=>strip.item.kind==='kicker').map(strip=>strip.box.lo[1]);
    if(undersides.some(y=>!kickerHeights.some(height=>Math.abs(height-y)<.001)))wrong(label+'a kicker strip is not at the height the steps give for its underside');
    for(const mover of list){
      for(const runner of mover.items){
        const sideBox=plainBox(byId(runner.on)),top=sideBox.hi[1];
        const over=b=>b.lo[1]>=top-.01&&[0,2].every(k=>b.lo[k]<sideBox.hi[k]&&b.hi[k]>sideBox.lo[k]);
        const covers=S.parts.filter(p=>!mover.riders.has(p.id)&&!isProp(p)).map(p=>plainBox(p)).concat(strips.map(strip=>strip.box)).filter(over);
        const nearest=Math.min(...covers.map(b=>b.lo[1]-top));
        if(!(nearest>=DRAWER.runnerAbove-.001&&nearest<=KICKER_REACH+.001))wrong(label+`a side of ${mover.name} has ${covers.length?fmt(r16(nearest)):'nothing'} above it: it needs a rail, a kicker or a runner ${fmt(DRAWER.runnerAbove)} to ${fmt(KICKER_REACH)} over it`);
      }
    }
  }
  if(rows.some(row=>/undefined|NaN/.test(row.join(' ')))||rows.some(row=>!hardwareFamily(row[0])))wrong(label+'a hardware line of the shopping list is broken or has no price');
  // Check my design: clean as placed (but for the preset's own "not by much" tip warning)
  const found=check().problems.filter(item=>!(item.level==='warn'&&plan.tip.factor<NS.tipWarn));
  if(found.length)wrong(label+'as placed, Check my design says: '+found[0].text);
}

/* Every preset whose steps ask for longer pull screws buys them: at its usual sizes and with each choice of each
   option of its form (a list of choices, or a tick box), every pull step that says "use screws about ... long"
   has a line of #8-32 machine screws of that length on the shopping list, two for each pull placed, with a price
   of its own (the row 'pull-screws', js/prices.js). A step naming a screw the list does not buy sends a beginner
   back to the store. */
SELFTESTS.push(function pullStepsBuyTheirScrews(problems){
  const kept=JSON.stringify(S);
  const wrong=text=>{if(problems.length<60)problems.push('pull screws: '+text);};
  try{
    for(const preset of PRESETS){
      const defaults=presetDefaults(preset),tries=[defaults];
      for(const field of preset.params){
        if(field.opts){
          for(const[value]of field.opts)if(value!==defaults[field.k])tries.push({...defaults,[field.k]:value});
        }else if(field.check)tries.push({...defaults,[field.k]:!field.v});
      }
      for(const vals of tries){
        if(preset.check&&(preset.check(vals)||[]).some(found=>found.level==='stop'))continue;   // refused: nothing is built
        let parts;
        try{parts=preset.build(vals)||[];}catch(e){continue;}
        if(!parts.length)continue;
        load(JSON.stringify(blank()),true);
        placePreset(preset,vals,parts,false);
        const pulls=hardwareList().filter(item=>item.kind==='pull').length;
        if(!pulls)continue;
        const asked=new Set();
        for(const step of buildPlan().steps)for(const line of step.hardware||[]){
          const long=/use screws about (.+?) long/.exec(line.line||'');
          if(line.kind==='pull'&&long)asked.add(parseLen(long[1]));
        }
        const rows=hardwareTotals(findJoints()).rows,label=`${preset.name} ${JSON.stringify(vals)===JSON.stringify(defaults)?'(usual sizes)':JSON.stringify(Object.fromEntries(Object.entries(vals).filter(([k,v])=>v!==defaults[k])))}: `;
        for(const length of asked){
          const row=rows.find(([words])=>/machine screws/i.test(words)&&words.includes(`× ${fmt(length)}`));
          if(!row){wrong(label+`a step asks for pull screws about ${fmt(length)} long and the shopping list does not buy them`);continue;}
          if(row[1]<2*pulls)wrong(label+`the shopping list buys ${row[1]} pull screws for ${pulls} pulls`);
          const family=hardwareFamily(row[0]);
          if(!family||family.id!=='pull-screws')wrong(label+`"${row[0]}" has no price of its own`);
        }
      }
    }
    // the step and the list use the same length rule: 3/4" front + 1/2" box front + 3/8" into the pull = 1 3/4"
    if(drawerPullScrewLength()!==1.75)wrong(`a pull on a drawer front over a drawer box asks for ${fmt(drawerPullScrewLength())} screws, not 1 3/4"`);
  }finally{
    load(kept,true);
  }
});
