/* NominalCAD: the Dining chair (stage 1 of design\specs\12-dining-chairs.md, with its Amendment A: the solid wood seat).

   The spec is written from the reference sheet design\reference\25-dining-chairs.md; "[25 §n]" below is a section
   of that sheet. 1SO = the sheet marks the number "one source only". PRACTICE = this program's own choice, a default
   or a remark, never sold as a standard. "derived" = arithmetic on the sheet's numbers or on the program's own rules.

   WHAT IT IS. A plain side chair (no arms) for the program's Dining table, made from the same store lumber:
     - four 2x4 legs, set with their 3 1/2" face running front to back (from the side each leg is as wide as a 4x4
       table leg);
     - 2x4 seat rails on edge on all four sides, flush with the tops and the outside faces of the legs (the table's
       aprons: the same board, the same depth, the same joint);
     - stretchers on edge, 3" off the floor, on all four sides: 2x4s at the sides, 2x3s at the front and the back
       (2x3s all round before branch seats);
     - a SOLID WOOD seat (the owner: "do solid wood"): three whole 2x6 boards running side to side, laid tight in
       front of the back legs, and one short 2x4 "back seat board" between the back legs. They are the table top's own
       boards, held the way its top is held: pocket screws driven up from the inside faces of the seat rails, never
       glued, so each board can swell and shrink by itself. Rustic / rough screws them down from above;
     - a back of two boards between the back legs: a 1x4 lower back rail and a 1x6 crest rail;
     - nothing under the side seat rails (branch seats). Stage 1 hung a square 2x4 block under each end of each side
       rail, which the owner found "unsightly and unnecessary", then showed four real chairs: "these other chairs
       dont have that ugly block so whats going on?". The blocks were there because the lean-back check compared
       the European TEST load with the US building code's DESIGN value for a screw, itself the test strength divided
       by about 5 1/2: two safety margins stacked. Corrected from sources (reference sheet 25 section 15,
       chairScrewHold below), the plain chair with its low stretchers passes at every size;
     - a SEAT of the person's choice (spec 12 stage 3, the form's Seat row): solid wood boards (the start), a 3/4"
       plywood seat left bare, or a padded slip seat (a plywood base, foam, batting and fabric stapled underneath),
       the last two carried by two seat braces between the side seat rails and screwed on from below.
   The back leans back about 5 degrees. The back legs stand straight and square; above the seat their front edge is
   cut back along ONE straight saw line (a corner cut off, SHAPE_KINDS['corner-clip'] in js/shapes.js), and the two
   back rails sit 1/8" behind that line. Every piece is square-set (no rot, no q), so the joints, the fasteners, the
   drill drawings and the checks of the program all see every joint. "Straight back legs" leaves the cut out; it
   starts unticked in Everyday and Fine furniture and ticked in Rustic / rough (the owner: "lean back for normal and
   straight for rusting/rough").

   IN THIS FILE
     CHAIR_RULES             every number, with where it comes from
     diningChairPlan(p)      every size and place worked out once, nothing drawn, with the two load cases this
                             program has nowhere else (chairLeanLoads: leaning back, DC4; chairTipFactor: tipping
                             backward, DC6), the seat loads (chairSeatLoad, DC3), the table fits (chairTableFit,
                             T1 to T6) and the problems
     buildDiningChair(p)     the pieces
     diningChairCheck(p)     the warning box
     diningChairInfo(p)      the remark under the form
     diningChairNotes(p)     the notes at the top of the build instructions
     diningChairSteps(p)     the build steps
   and the preset itself, then its self-checks, at the bottom.

   THE CHECKS ARE A RULE OF THUMB, NOT ENGINEERING. The loads are those of the European home chair tests [25 §6b,
   §6c] and the screw values what wood screws hold in tests, with one margin of 2 [25 §15], counting the screws only and
   not the glue. Nothing here is an engineer's calculation or a lab test, and the notes say so. */
'use strict';

const CHAIR_RULES={
  // ---- the form [25 §1-§3] ----
  seatHigh:{least:17,usual:17.5,most:19},  // 17-19 checked, 18 usual; 17 1/2 so a 2x4-apron table leaves 7 1/2" [25 §1]
  seatWide:{least:18,usual:18,most:20},    // 16-20, 18 common [25 §2]; 18 least so the back legs are 14" apart (DC17)
  backHigh:{least:14,usual:15,most:15},    // 12-20 checked [25 §3]; 14 is the least that fits the two back rails
                                           // (derived); 15 the most for which the lean check DC4 kept 1.1 at the
                                           // lowest seat by its old basis (spec A.7). Since branch seats it is kept
                                           // for the look: its top 2 1/2" above a 30" table top (an owner question:
                                           // taller backs); the lean check's scores are in SELFTESTS.diningChair
  // ---- the frame ----
  leg:'2x4',                // all four legs, the 3 1/2" face front to back (PRACTICE, spec 5.1)
  rail:'2x4',               // the seat rails, on edge: the Dining table's aprons (TABLE_KINDS['Dining table'])
  // the SIDE stretchers, on edge. 2x4 since branch seats (PRACTICE, for DC4): with the screws counted at their test
  // value the plain chair holds the EN static lean with 2x3s too, but not the EN repeated lean (fatigue, below, the
  // lead's strength basis, design\specs\15 with its corrections), and with the pull of the side seat rail counted
  // (chairFrameShare) 2x3 side stretchers score about 0.98 on it: a 3 1/2" stretcher end has its two screws as far
  // apart as the seat rail's, so the low corners carry their full share. The FRONT and BACK stretchers are not part
  // of the side frames that a lean back pushes out of square, so they stay 2x3s (crossStretcher), slimmer from the
  // front (the real-thing review: a 2x4 at the floor read as a second apron). A chair saved before the seat choice
  // keeps its 2x3s all round (stretcherBefore), as it was built.
  stretcher:'2x4',crossStretcher:'2x3',stretcherBefore:'2x3',
  stretcherUp:3,            // the underside of the stretchers off the floor: 3-4 checked [25 §4]; 3 is PRACTICE for DC4
  // the corner blocks: a 2x4 block glued under each end of each side seat rail, against the leg, with two pocket
  // screws of its own into the leg. They make the joint that a lean back works hardest 7" deep instead of 3 1/2":
  // "glue face to face" is where a pocket-screwed chair gets its real strength [25 §7, notes on building]; the
  // check counts the block's screws, and its glue line along the rail is worked against the glue maker's figure
  // (since branch seats the corner blocks are built only for a chair saved before it, whose form values have no Seat:
  // such a chair opens and is written as it was saved. A chair made today has a plain 2x4 side seat rail, as every
  // real chair the owner showed has: the lean check now counts the screws against what they really hold, design\
  // reference\25-dining-chairs.md section 15, and the plain chair passes it at every size.)
  block:'2x4',
  blockLong:4,              // the shortest 2x4 block that holds its two pocket holes (they reach about 3 3/4" from its end) (PRACTICE)
  // ---- the seat kinds (spec 12 stage 3; the owner: "plywood seems cheap but idk whats standard", then "do solid wood
  //      and we can add the others later", then "i dont see the plywood option that can be left or cushion option") ----
  panel:'ply34',            // the plywood seat, and the padded seat's base: 3/4" plywood (see panelStrip and the padded seat below)
  panelCorner:1,            // the front corners of a plywood seat or base rounded this much (eased, PRACTICE)
  // a grown person (DC3) on a plywood seat is counted on a strip of it this wide (PRACTICE): about the width of the
  // part of a seated person that bears on a seat (about 119 sq in, reference sheet 25 §14) and of two feet side by
  // side. A board seat counts the whole load on one 5 1/2" board, because the boards are separate; a sheet spreads it.
  panelStrip:12,
  // A plywood or padded seat stands on two SEAT BRACES, 2x3s on edge from side seat rail to side seat rail, and is
  // screwed up through two SEAT CLEATS, 2x2s glued to the inside of the front and the back seat rail. The braces'
  // pocket holes are on the faces toward the nearer legs (diningChairHiddenFace): facing each other 1" apart, the
  // second brace could not be screwed (both reviews of branch seats).
  // (2x2: a square stick meets the seat and the rail face to face, so its screws can be named to go through it,
  // {through} in js/joints.js; a 2x3 on edge would meet the seat with its edge, and the program screws a face into
  // an edge from the face side, down through the seat.)
  brace:'2x3',cleat:'2x2',
  braceFromEnd:4.25,        // braces and cleats stand this far in from the ends of the rails they meet: clear of the
                            // rails' own pocket holes into the legs (they reach about 3 1/2" along the rail), 3/4" to spare
  // the padded slip seat [25 §13]: the base, 2" high-density foam, batting and fabric. The seat height of the form is
  // the top of the cushion as a person sits on it: the foam is counted to squash a quarter of its thickness (derived,
  // reference sheet 25 §14: firm seat foam is rated to give 25% under about 0.9 psi, and a seated person bears about
  // 0.4 to 0.7 psi), so the frame is built lower by the base, the foam less its squash, and the cover
  foam:2,foamSquash:.25,cover:.25,
  // the base is 3/4" plywood, not the 1/2" Baltic birch of the one source [25 §13, S74]: a grown person standing on a
  // 1/2" base between the braces would bend it past the program's limit for plywood (DC3, worked in chairSeatLoad)
  basePly:'ply34',
  // the base is cut this much short of the back legs at each face of its two notches, so the batting and the fold of
  // fabric wrapped round those edges fit between the legs: an inset slip seat's platform is cut about 1/8" short all
  // round, or 3/16" to 1/4" short of the rail, checked [25 §13, S74 S75] (3/16", the middle). The cushion is drawn as
  // covered, to the leg faces.
  coverRoom:.1875,
  // vent holes through the base, so air can leave the foam: five or six, one source [25 §13, S76]; 3/8" across
  // (PRACTICE: no size given), in the open spans between the cleats and the braces
  vents:6,ventD:.375,
  // ---- the seat (Amendment A): whole boards, the table top's own 2x6 ----
  seatBoard:'2x6',          // the table top's board, 1 1/2" thick: carries a person standing on one board (DC3)
  seatBoards:3,             // three whole boards in front of the back legs: 16 1/2" deep, inside 16"-18" [25 §2] (DC18)
  backSeatBoard:'2x4',      // the strip between the back legs is exactly a 2x4 lying flat (3 1/2" deep like the legs)
  frontRound:.5,            // the front edge of the seat rounded over about this much (PRACTICE: no source gives a size) (DC22)
  overhang:.5,              // the seat stands this far past the front legs and the sides, 1SO [25 §2]
  lowerRail:'1x4',crestRail:'1x6',
  lumbar:7.5,               // the middle of the lower back rail above the seat: 7 1/2 preferred, checked [25 §3]
  crestOverLower:6,         // the lower rail's top stays this far under the top of the back (a 1x6 and a 1/2" gap)
  openUnder:[4,8],          // the open space under the lower back rail, 1SO [25 §3] (DC11)
  railGapLeast:.5,          // between the two back rails (PRACTICE) (DC11)
  // ---- the lean of the back ----
  leanDeg:5,                // 5 deg in every plan and dining guide checked [25 §3]
  reveal:.125,              // the back rails stand this far behind the cut line at their top edges (PRACTICE)
  topLeast:1.75,            // the top of the cut-back leg keeps this much wood for the crest rail (PRACTICE) (DC10)
  taperScrewRoom:.375,      // a screw stays this far off the cut line (PRACTICE, as keepOffOpenings in js/shapes.js)
  // ---- loads (EN 12520 / EN 1728 / EN 1022 as read on [25 §6b, §6c]) ----
  lbfPerN:0.224809,
  seatN:1300,               // a grown person on the seat, on a rail, on one seat board [25 §6b] (DC3)
  leanN:450,                // the lean-back push [25 §6b], half on each back leg (DC4)
  leanBelowTop:4,           // 4" below the top of the back [25 §6b]
  // the EN repeated sitting and leaning test: 1000 N on the seat with 300 N on the back, 25,000 times [25 §6b, one
  // source]; pushed at the same height as the static push (the safe side: the clause's point was not read). A joint
  // under loads that come and go thousands of times is counted at half its strength under one load [25 §15, S98],
  // on top of the margin of 2: a quarter of the test average, as the lead's strength basis has it (design\specs\15,
  // "Corrections after review", item 1)
  fatigueBackN:300,fatigueShare:.5,
  tipSeatLb:135,            // the backward tip: 135 lb on the seat [25 §6c] (DC6)
  tipSeatAhead:6,           // in front of the back legs' front faces (PRACTICE: EN's loading point is not sourced)
  tipBackN:mm=>0.2857*(1000-mm),   // N at the top of the back, S in mm, checked on two lab reports [25 §6c]
  sideTipLb:135,sideTipIn:2.375,sideTipPush:4.5,   // forward and sideways tip, 1SO [25 §6c] (DC7)
  pullLbf:30,               // someone pulls the chair out by its back (PRACTICE: no source gives this load) (case d)
  personLb:250,             // rocking back on two legs: half of a grown person each side (TABLE_RULES.personLb) (case e)
  rockAhead:6,              // that person's weight this far in front of the back leg's seat joint (PRACTICE) (case e)
  legForwardN:400,          // a front leg pushed forward at its foot, someone seated, checked [25 §6b] (case f)
  legSidewaysN:300,         // a front leg pushed sideways at its foot, two sources, one a summary [25 §6b] (case g)
  // ---- what one pocket screw holds pulling out (corrected on branch seats; reference sheet 25 sections 15 and 16) ----
  // BASIS: furniture test load against tested strength (basis F of the lead's strength basis, design\specs\15 with
  // its "Corrections after review"). The EN lean-back push is a TEST load: a chair must come through it (ten pushes
  // of 10 seconds) unbroken. So it is compared with what a screw really holds, the average pull-out found in tests:
  // p = 15,700 x G^2 x D lb per inch of thread in side grain (the Wood Handbook's wood screw formula [25 §6d, S63;
  // §15]), with ONE margin, 2, for a single hard load. That 2 covers three things at once, and leaves nothing past
  // the point where an average joint starts to open: (1) the formula is the maximum load in tests reaching failure in
  // 5 to 10 minutes, with a lead hole about 70% of the root in softwood and for the gauges of its table, and its
  // source says values are likely less outside those limits: a #8 pocket screw driven with no lead hole is outside
  // both, so the formula OVERSTATES this screw; (2) home-made screwed joints scatter (about the 5th percentile at a
  // 30% spread, the strength critique, reports\spec15-critique.md); (3) the one test of pocket-screwed joints saw a
  // gap open at about half the breaking load [S46]. For loads that come back thousands of times each screw is
  // counted at half of that again (fatigueShare below): furniture research takes a joint's strength under repeated
  // loads as at most half its strength under one load [25 §15, S98]; S98 supports only that repeated case, not the
  // margin of 2. Until branch seats it was compared with the US building code's DESIGN value, W = 2850 x G^2 x D,
  // which is that same test average divided by about 5 1/2 for buildings that must stand for decades (safety, ten
  // years of load, test conditions [25 §15, S99, S100]): two safety margins stacked, by which the chair in the owner's
  // home-shop plan, and almost every pocket-screwed chair ever built, would fail by half. The old value is kept
  // (ndsPerInch) so the report and the self-check can show the old score beside the new one.
  // D 0.164 (a #8); G the specific gravity of the wood (CHAIR_WOOD_G). The thread in the leg: how far the screw goes
  // into the leg by the jig maker's own penetration chart, 1 1/4" for a 2 1/2" screw at the 1 1/2" setting (the
  // head 1 1/4" from the joint: shoulderChart, by jig setting; reference sheet 27 sections 1c and 7 item 2, one
  // source, which names this very sum), along the
  // screw, its tapered point inside it (the formula's L is the penetration of the threaded part, and a pocket
  // screw's auger point is threaded to its tip). Until the fixes of branch seats it was the program's drawn 1"
  // (POCKET_JIG in js/style.js then kept a 1 1/2" shoulder, 1/4" long by that chart: LESSONS A5; the pocket-edge
  // round corrected it to the chart's 1 1/4", so the drawn screw and the counted thread now agree; chairScrewHold
  // takes the smaller of the two). A pocket screw leans 15 deg off the rail (FASTEN.pocketDegrees), so it holds the rail
  // by the pull-out x cos 15 deg. Still not counted: the glue in a joint (end grain against side grain holds little
  // [25 §7, S46]), the floor's grip on the front feet, and the program's own 1.1 kept on top (leanWanted).
  testPerInch:15700,margin:2,ndsPerInch:2850,D:.164,shoulderChart:{1.5:1.25},
  leanStop:1,               // under this the lean or the tip is refused
  leanWanted:1.1,           // the form's limits keep every factor at this or more (the self-check)
  bendLimit:.95,            // a share of WOOD_RULES.FB_SHORT, as TABLE_RULES.memberMargin
  planeLeast:8,             // the seat rail and the stretcher of a leg plane are at least this far apart (PRACTICE) (DC5)
  // the glue line of a corner block, along the underside of its rail (long grain to long grain, edge to edge): the
  // maker's figure for wood glue, 3,600 psi in hard maple by ASTM D905 (one source, the maker's data sheet); pine is
  // softer and a glue line in it breaks in the wood, so a tenth of that is the most the check lets it carry (PRACTICE)
  glueMakerPsi:3600,glueShare:.1,
  heavyLb:33,               // heavy solid dining chairs weigh up to about 33 lb, checked [25 §4] (DC12: a note, said plainly)
  backLegsApartLeast:14,    // 14 1/4-15 1/2 at the back of a dining seat, checked [25 §2]; SW - 4 (derived) (DC17)
  feltDepth:[16,18],        // seat front to the back rest, checked [25 §2] (DC18)
  // ---- the table fits [25 §1, §5] ----
  thighLeast:7,thighEasy:7.5,          // seat to the underside of the apron: 7 least checked, 7 1/2 1SO (T1)
  topAbove:{usual:[10,12],outer:[9,13]},   // table top above the seat: 10-12 checked, 9-13 derived (T2)
  edgeEach:24,between:2,               // table edge for each chair, room between chairs and from the legs, checked (T3, T4)
};
/* The specific gravity G of each wood the program offers (WOODS, js/style.js), for the screw value: an engineering
   reference's table "Wood Structural Design Data" (American Forest and Paper Association, 1992), one source, read
   in a search: spruce-pine-fir 0.42, eastern white pine 0.36, western cedars 0.36, yellow poplar 0.43, Southern pine
   0.55, hem-fir 0.43, red oak 0.67. Where a store name covers more than one wood the softer is counted: select pine
   is eastern white pine or ponderosa pine (0.43), pressure-treated pine is Southern pine or, in the West, hem-fir;
   rough-sawn or reclaimed boards are of no known wood, so the softest in the table is counted. */
const CHAIR_WOOD_G={pine:.42,select:.36,poplar:.43,cedar:.36,pt:.43,oak:.67,rough:.36};
const chairWoodG=wood=>CHAIR_WOOD_G[wood]||Math.min(...Object.values(CHAIR_WOOD_G));
/* the wood of the design that is open (a chair made with Create is in construction pine, js/app.js placePreset) */
const chairWoodNow=()=>typeof S!=='undefined'&&S&&S.look&&WOODS[S.look.wood]?S.look.wood:'pine';
const chairOrWords=items=>items.length<2?items.join(""):items.slice(0,-1).join(", ")+" or "+items[items.length-1];
const chairWoodName=wood=>WOODS[wood]?WOODS[wood][0].replace(/\s*\(.*$/,'').toLowerCase():'this wood';
/* tableKind: the table the chair is checked against, 'program' (the Dining table of this program, by its length,
   width and height) or 'measured' (a table the person measured: mH the height of its top, mU the underside of its
   apron, mSide the room between the legs along a side, mEnd between the legs at an end; each 0 = not measured, and
   nothing is assumed about a size left at 0) */
/* The seats the form offers, in its order: [key, the words on the form, the name of the seat in a sentence]. */
const CHAIR_SEAT_KINDS=[['boards','Solid wood boards','solid wood seat'],['plywood','Plywood, left bare','plywood seat'],['padded','Padded cushion','padded seat']];
const chairSeatPanel=seat=>seat==='plywood'||seat==='padded';   // carried by seat braces, screwed on from below
/* (Beware: form values with NO `seat` key are read as a chair saved before the seat choice and built with its corner
   blocks and 2x3 stretchers, chairValues. A caller that hands in partial values must include `seat`.) */
const DINING_CHAIR_DEFAULTS={seat:'boards',S:17.5,SW:18,BH:15,upright:false,table:false,tL:60,tW:33,tH:30,tableKind:'program',mH:0,mU:0,mSide:0,mEnd:0};
const CHAIR_LIMITS={S:[17,19],SW:[18,20],BH:[14,15],tL:[36,108],tW:[27,50],tH:[26,42],mH:[0,48],mU:[0,48],mSide:[0,144],mEnd:[0,72]};
/* "Straight back legs" starts ticked in the Rustic / rough style and unticked in the other two (the owner, 17 Nov).
   The style read is the one of the design that is open when the form is shown (look(), js/style.js). */
const chairUprightByStyle=()=>typeof S!=='undefined'&&S&&S.look&&S.look.style==='rustic';

/* the pieces' real board sizes */
const chairBoard=mat=>({t:M[mat].t,w:M[mat].w});

/* ---------- the plan ---------- */
const chairPlanMemo=new Map();
function diningChairPlan(p){
  // (the table's sizes are said as its boxes write them while the form is talking: typedLen, js/core.js)
  const key=JSON.stringify(p||{})+(boxSpeech>0?'|boxes':'');
  if(!chairPlanMemo.has(key)){
    if(chairPlanMemo.size>300)chairPlanMemo.clear();
    chairPlanMemo.set(key,chairPlanFresh(p||{}));
  }
  return chairPlanMemo.get(key);
}
/* The form values the plan works from: every size inside its limits, every option off unless ticked. There is no
   seat depth (three whole 2x6 boards); a value SD handed in by anything older is not read. */
function chairValues(p){
  const within=(key,usual)=>{
    const value=+p[key],[lo,hi]=CHAIR_LIMITS[key];
    return Number.isFinite(value)&&p[key]!==''&&p[key]!==null&&p[key]!==undefined?Math.min(hi,Math.max(lo,value)):usual;
  };
  const d=DINING_CHAIR_DEFAULTS;
  // (wood: the wood the chair is checked in; the form and Create use construction pine, Check my design the
  // wood of the design, diningChairRecheck)
  // (seat: the kind of seat; blocks: form values with no seat at all are those of a chair saved before the seat
  // choice existed, and are built as it was saved, with its four corner blocks, so it opens,
  // and is written again, as it was: spec 12 stage 3, the owner's rule that saved designs keep their pieces)
  const seat=CHAIR_SEAT_KINDS.some(kind=>kind[0]===p.seat)?p.seat:d.seat,blocks=p.blocks===true||!('seat' in p);
  return{seat,blocks,S:within('S',d.S),SW:within('SW',d.SW),BH:within('BH',d.BH),upright:!!p.upright,
    table:!!p.table,tL:within('tL',d.tL),tW:within('tW',d.tW),tH:within('tH',d.tH),wood:WOODS[p.wood]?p.wood:'pine',
    tableKind:p.tableKind==='measured'?'measured':'program',mH:within('mH',d.mH),mU:within('mU',d.mU),mSide:within('mSide',d.mSide),mEnd:within('mEnd',d.mEnd)};
}
/* bare: the numbers only, without the table fits and the problems (for the searches inside chairProblems, which
   would otherwise call themselves) */
function chairPlanFresh(raw,bare){
  const R=CHAIR_RULES,v=chairValues(raw),problems=[];
  const strMat=v.blocks?R.stretcherBefore:R.stretcher,crossMat=v.blocks?R.stretcherBefore:R.crossStretcher;
  const leg=chairBoard(R.leg),rail=chairBoard(R.rail),str=chairBoard(strMat),cross=chairBoard(crossMat);
  const seatM=chairBoard(R.seatBoard);
  const{S,SW,BH}=v;
  // how far the seat surface stands over the tops of the seat rails: a 2x6 board seat 1 1/2"; a plywood seat 3/4"; a
  // padded seat its 3/4" base, the foam as it squashes under a person and the cover (the seat height is the top of
  // the cushion as a person sits on it, so the frame is built that much lower)
  const panelT=M[R.panel].t,baseT=M[R.basePly].t,cushionSat=R.foam*(1-R.foamSquash)+R.cover;
  const seatT=v.seat==='plywood'?panelT:v.seat==='padded'?baseT+cushionSat:seatM.t;
  // across (x): the seat spans 0 to SW, the frame (outside the legs) the overhang in from each side
  const F=SW-2*R.overhang,x0=R.overhang,x1=SW-R.overhang;
  const legX=[x0,x1-leg.t];                         // the left and right legs, 1 1/2" thick across
  const inner=[x0+leg.t,x1-leg.t];                  // the cross pieces fit between the legs
  // front to back (z): back legs 0 to 3 1/2, the three seat boards in front of them, front legs D - 3 1/2 to D
  const SD=R.seatBoards*seatM.w;                    // 16 1/2: three whole 2x6 boards
  const seatDepth=leg.w+SD;                         // the back seat board is as deep as the back legs: 20
  const D=seatDepth-R.overhang;                     // the front faces of the front legs: 19 1/2
  // height (y)
  const railTop=S-seatT,railBottom=railTop-rail.w;
  const strBottom=R.stretcherUp,strTop=strBottom+str.w;
  const backLegH=S+BH,frontLegH=railTop;
  // the cut on the front edge of the back legs: from the seat surface up to the top, b in from the front at the top
  const taper=v.upright?0:Math.round(BH*Math.tan(R.leanDeg*Math.PI/180)*16)/16;
  const frontAt=y=>leg.w-Math.max(0,y-S)*taper/BH;   // the leg's front edge at height y
  // the back rails: their tops, and their front faces 1/8" behind the cut line at their top edges
  const lowerTop=Math.min(S+R.lumbar+M[R.lowerRail].w/2,S+BH-R.crestOverLower),lowerBottom=lowerTop-M[R.lowerRail].w;
  const crestTop=S+BH,crestBottom=crestTop-M[R.crestRail].w;
  const lowerFront=floor16(frontAt(lowerTop))-R.reveal,crestFront=floor16(frontAt(crestTop))-R.reveal;
  // the seat boards: three 2x6 side to side, from the front faces of the back legs; the back seat board between them
  const boards=[];
  for(let i=0;i<R.seatBoards;i++)boards.push({z:leg.w+i*seatM.w,deep:seatM.w});
  // the side seat rail is one plain 2x4 from leg to leg, as on every chair the owner showed. Only a chair saved before
  // the seat choice (v.blocks) has the four corner blocks of stage 1 under the ends of its side seat rails, built as
  // it was saved (the side twice as deep at each leg, two more pocket screws: chairCorners).
  const sideLength=D-2*leg.w;
  const blockM=chairBoard(R.block),blockBottom=railBottom-blockM.w;
  const blocks=v.blocks?[{z:leg.w,at:'back'},{z:D-leg.w-R.blockLong,at:'front'}]:[];
  // the seat braces of a plywood or padded seat: two 2x3s on edge from side seat rail to side seat rail, tops flush
  // with the rails, each braceFromEnd in from the ends of the side rails (clear of their pocket holes); and the two
  // seat cleats, 2x2s on the inside faces of the front and the back seat rail, braceFromEnd in from each end
  const braceM=chairBoard(R.brace),cleatM=chairBoard(R.cleat);
  const sideZ=[leg.w,D-leg.w];   // the side seat rails run from the back legs to the front legs
  const braces=chairSeatPanel(v.seat)?[sideZ[0]+R.braceFromEnd,sideZ[1]-R.braceFromEnd-braceM.t].map(z=>({z})):[];
  const cleats=chairSeatPanel(v.seat)?[{z:rail.t,at:'back'},{z:D-rail.t-cleatM.t,at:'front'}].map(c=>({...c,x0:inner[0]+R.braceFromEnd,x1:inner[1]-R.braceFromEnd})):[];
  // the plywood seat or the padded seat's base: the outline of the board seat (the seat's whole width, from the back
  // faces of the back legs to 1/2" past the front legs), notched round the two back legs, its front corners rounded.
  // The padded seat's base is cut coverRoom short of the legs at each face of its notches (the fabric wrapped round
  // those edges takes it up); the plywood seat is fitted to the legs (sanded a little if they pinch it)
  const room=v.seat==='padded'?R.coverRoom:0;
  const panel=chairSeatPanel(v.seat)?{mat:v.seat==='padded'?R.basePly:R.panel,t:v.seat==='padded'?baseT:panelT,y:railTop,
    notch:{x:x0+leg.t+room,z:leg.w+room},room,corner:R.panelCorner}:null;
  // the padded seat's cushion (foam, batting and fabric, bought, drawn as one piece): as cut, before anyone sits on it,
  // and as covered, to the faces of the back legs
  const cushion=v.seat==='padded'?{y:railTop+baseT,t:R.foam+R.cover,squash:R.foam*R.foamSquash,notch:{x:x0+leg.t,z:leg.w}}:null;
  const plan={v,S,SW,SD,BH,F,D,x0,x1,legX,inner,crossLength:inner[1]-inner[0],sideLength,seatDepth,seatT,seat:v.seat,
    panel,cushion,braces,cleats,braceDeep:braceM.w,braceThick:braceM.t,cleatSize:cleatM.t,
    // the depth under the side seat rail that its corners count (a saved chair's corner blocks; 0 for a plain rail)
    // and the glue line of such a block along its rail
    glueLong:R.blockLong,
    railTop,railBottom,strBottom,strTop,backLegH,frontLegH,taper,frontAt,boards,blocks,blockBottom,blockDeep:v.blocks?blockM.w:0,blockThick:blockM.t,railDeep:rail.w,strDeep:str.w,strMat,
    // the front and back stretchers (2x3s since the fixes of branch seats), their undersides as high as the sides'
    crossMat,crossTop:strBottom+cross.w,crossDeep:cross.w,
    backSeatBoard:{x:inner[0],length:inner[1]-inner[0],deep:leg.w},
    lower:{top:lowerTop,bottom:lowerBottom,front:lowerFront,back:lowerFront-M[R.lowerRail].t},
    crest:{top:crestTop,bottom:crestBottom,front:crestFront,back:crestFront-M[R.crestRail].t},
    legDepth:leg.w,legThick:leg.t,problems};
  plan.betweenBackLegs=plan.crossLength;
  plan.openUnder=lowerBottom-S;
  plan.railGap=crestBottom-lowerTop;
  plan.topDepth=leg.w-taper;
  // the depth a body feels: seat front to the front of the lower back rail
  plan.feltDepth=seatDepth-lowerFront;
  // the lean of the back, measured on the rail fronts and on the cut line
  const middleOf=part=>(part.top+part.bottom)/2;
  plan.backLeanDeg=Math.atan2(lowerFront-crestFront,middleOf(plan.crest)-middleOf(plan.lower))*180/Math.PI;
  plan.cutLeanDeg=Math.atan2(taper,BH)*180/Math.PI;
  plan.lean=chairLeanLoads(plan);
  plan.weight=chairWeight(plan);
  plan.tip=chairTipFactor(plan);
  plan.seatLoad=chairSeatLoad(plan);
  if(bare)return plan;
  plan.fit=v.table?chairTableFit(plan):null;
  chairProblems(plan,raw);
  return plan;
}

/* ---------- the two load cases this program has nowhere else (DC4, DC6), and DC3 and DC7 ---------- */
/* What one 2 1/2" pocket screw holds the rail by, pulling out of the side grain of a leg (lb): the test average
   pull-out in the chair's wood (the Wood Handbook's formula, CHAIR_RULES.testPerInch) with the one margin of 2, per
   inch of thread, times the thread in the leg by the jig maker's chart (the screw less the chart's shoulder,
   CHAIR_RULES.shoulderChart), times cos 15 deg (the screw leans that much off the rail). drawnThread: what the
   program draws in the leg (POCKET_JIG), which the self-check reads back from the placed screws. */
function chairScrewHold(wood){
  const R=CHAIR_RULES,jig=POCKET_JIG.find(row=>row.set===1.5),G=chairWoodG(wood);
  // what the program draws in the leg (POCKET_JIG): since the pocket-edge round its shoulder is the chart's, so 1 1/4"
  const drawnThread=jig.screw-jig.shoulder;
  // 1 1/4" of thread in the leg by the chart, along the screw; never more than the program draws (the smaller of the
  // two, so a later change to either can only make the count stricter)
  const thread=Math.min(jig.screw-R.shoulderChart[jig.set],drawnThread);
  const tested=R.testPerInch*G*G*R.D;                       // 15,700 x 0.42^2 x 0.164 = 454 lb per inch in pine, the test average
  const perInch=tested/R.margin;                            // 227 lb per inch with the one margin of 2
  const along=Math.cos(FASTEN.pocketDegrees*Math.PI/180);   // 0.966
  // (the building code's design value, 2850 x 0.42^2 x 0.164 = 82.4 lb per inch over 1" of thread, the drawn thread
  // before the pocket-edge round corrected POCKET_JIG: the basis until branch seats, kept only to show the old score,
  // ndsPerScrew)
  const ndsPerInch=R.ndsPerInch*G*G*R.D,oldThread=1;
  return{perScrew:perInch*thread*along,thread,drawnThread,perInch,tested,G,along,ndsPerScrew:ndsPerInch*oldThread*along};
}
/* The pocket screws of one corner of a side of the chair, as heights above the edge of the joint that presses on
   the leg when the side is pushed out of square (the hinge). jSpec gives a 3 1/2" or a 2 1/2" end two pocket screws,
   and the layout (js/fasteners.js) puts them a quarter of the end in from each edge, but never nearer an edge than
   rule 1 allows (FASTEN.endMin, 3/4": a 2 1/2" stretcher end gets them at 3/4" and 1 3/4"); the self-check
   diningChairScrewsClear reads them back from the layout. A seat rail corner has the rail's two screws, at 7/8" and
   2 5/8" of its 3 1/2". (On a chair saved with the corner blocks of stage 1 the block and the rail together: the
   block's two screws, then the rail's, 7" in all; at the back leg the hinge is the underside of the block, at the
   front leg the top of the rail: the same four heights.) A stretcher corner has its two. */
function chairCorners(plan){
  // (an end too short for two screws, under TWO_SCREWS_FROM, gets one in its middle, as jSpec lays it out: a 1 1/2"
  // stretcher end is ONE screw at 3/4", never two at the same height)
  const quarters=deep=>{
    if(deep<TWO_SCREWS_FROM-1e-9)return[deep/2];
    const edge=Math.max(FASTEN.endMin,deep/4);
    return[edge,deep-edge];
  };
  const rail=[...(plan.blockDeep?quarters(plan.blockDeep):[]),...quarters(plan.railDeep).map(h=>h+plan.blockDeep)];
  const stretcher=quarters(plan.strDeep);
  const name=plan.v.blocks?'side seat rail and corner block':'side seat rail';
  // pullAt: how far the rail's own pull (its middle) is from the hinge of the corner: at the back leg the hinge is the
  // underside of the rail (of a saved chair's block), at the front leg its top
  return[{name:`${name} at the back leg`,heights:rail,kind:'rail',at:'back',pullAt:plan.blockDeep+plan.railDeep/2},
    {name:`${name} at the front leg`,heights:rail,kind:'rail',at:'front',pullAt:plan.railDeep/2},
    {name:'side stretcher at the back leg',heights:stretcher,kind:'stretcher',at:'back',pullAt:plan.strDeep/2},
    {name:'side stretcher at the front leg',heights:stretcher,kind:'stretcher',at:'front',pullAt:plan.strDeep/2}];
}
/* A side of the chair (a back leg, a front leg, the side seat rail and the side stretcher) pushed out of square by a
   moment `moment` (in-lb): its four corners turn by the same small angle, because pocket-screwed joints give far
   more than the boards between them (one home test saw such a joint open a gap at about 295 in-lb [25 §6d, S46]).
   By virtual work the four corner moments then add up to the whole moment, and each corner takes a share in
   proportion to how stiff it is: the sum of h^2 of its screws, every screw stretching in proportion to its height
   h above the hinge.
   THE RAIL'S PULL (the code review of the seats round, its finding 1). The front foot is free to slide, so the front
   leg is held only by the rail and the stretcher; nothing at its foot can turn it, so the two must turn it back
   against the two corner moments on it: the side seat rail pulls on the front leg (tension) and the stretcher pushes
   on it (compression), R x lever = M(rail, front) + M(stretcher, front), lever the height between the middles of the
   rail and the stretcher. The same R pulls the rail straight off both legs. Taking moments about the hinge of a rail
   corner, its screws carry the corner moment PLUS R times the height of the rail's middle above that hinge (pullAt),
   shared by h^2 as before: the farthest screw takes (M + R x pullAt) x h_max / (sum of h^2 of the corner). The
   stretcher, pushed against the legs, gains nothing that is counted (its corners keep the moment alone, the safe
   side). Returns {factor, worst, corners, total, pull (R), lever, balance}: balance is R x lever less the two
   front corner moments, 0 when the front leg is in balance (the self-check reads it). */
function chairFrameShare(plan,moment,hold){
  const corners=chairCorners(plan).map(corner=>({...corner,stiff:corner.heights.reduce((sum,h)=>sum+h*h,0),far:Math.max(...corner.heights)}));
  const total=corners.reduce((sum,corner)=>sum+corner.stiff,0);
  for(const corner of corners)corner.moment=moment*corner.stiff/total;
  // the rail's pull: what keeps the front leg from turning
  const lever=(plan.railTop+plan.railBottom)/2-(plan.strTop+plan.strBottom)/2;
  const frontMoments=corners.filter(corner=>corner.at==='front').reduce((sum,corner)=>sum+corner.moment,0);
  const pull=frontMoments/lever;
  for(const corner of corners){
    const extra=corner.kind==='rail'?pull*corner.pullAt:0;
    corner.pull=(corner.moment+extra)*corner.far/corner.stiff;   // lb on its farthest screw
    corner.factor=hold/corner.pull;
  }
  const worst=corners.reduce((a,b)=>b.factor<a.factor?b:a);
  return{factor:worst.factor,worst,corners,total,pull,lever,balance:pull*lever-frontMoments};
}
/* The lean-back check (spec 7.1, reworked after review), cases a to g, each a factor (what holds over what pulls) or
   a share of the bending limit.
   (b) Leaning back, the case that decides. EN pushes the back with 450 N (101 lbf, half on each back leg [25 §6b])
   4" below its top [25 §6b], someone seated, the chair stopped at its back feet (the heavier reading of EN 1728,
   spec 3). The front feet are free to slide, so each side of the chair (a frame of two legs, a seat rail and a
   stretcher, with no diagonal) can only be kept square by its four corners working in bending: by virtual work
   their moments add up to F x y_p (one review worked it as a frame: 605 + 402 + 219 + 215 = 1,441 in-lb at the
   default). chairFrameShare shares it out. The seat load is carried by the rails as beams between their joints;
   since the joints are far softer than the rails it adds little to the corner moments and is not counted.
   (b2) The repeated lean: EN's 300 N, 25,000 times, at the same height, each screw at half its static hold.
   (d) Pulled out by the top of its back with 30 lbf (PRACTICE): the same, with 15 lbf a side at the top. A pull now
   and then: the single-load basis.
   (e) Rocking back on the back legs, the front off the floor: the front of each side hangs on the two back corners
   and turns about them; by virtual work the four corners again add up to the load times its distance in front of
   the back leg, half a 250 lb person 6" in front of the joint: 750 in-lb. The front feet are off the floor, so the
   rail pulls on the front leg as in (b). People rock back again and again (sheet 25 section 7: the most destructive
   load a chair sees), so it is counted on the repeated basis, each screw at half its static hold (the code review's
   note 18).
   (f), (g) A front leg pushed forward (400 N) or sideways (300 N) at its foot, someone seated [25 §6b], EN static
   test loads on the single-load basis: the push and what stops the chair are both at the floor, so nothing is pushed
   out of square; the leg bends between its foot and the stretcher of its plane (forward: the side stretcher;
   sideways: the front stretcher), and that stretcher pulls on its two end screws: C = P x y_r / (y_r - y_s)
   (moments about the rail).
   Not counted, so the real joints are stronger: the glue in them, the seat boards, the back seat rail, and the grip
   of the floor on the front feet under the seated person (the front feet are taken as free to slide). Not counted
   the other way: the seat load (about 50 lb at each rail end) that the same two screws carry sideways while they are
   pulled (no sideways value for a screw is on the sheet; small beside the pull, the real-thing review's finding 5).
   Each screw is counted at the test average pull-out with one margin of 2 (chairScrewHold, since branch seats). */
function chairLeanLoads(plan){
  const R=CHAIR_RULES,hold=chairScrewHold(plan.v.wood);
  const F=R.leanN*R.lbfPerN/2;                                // lbf on each back leg [25 §6b]
  const yPush=plan.S+plan.BH-R.leanBelowTop;                  // 4" below the top of the back [25 §6b]
  const yRail=(plan.railTop+plan.railBottom)/2,yStr=(plan.strTop+plan.strBottom)/2,lever=yRail-yStr;
  const limit=R.bendLimit*WOOD_RULES.FB_SHORT;
  // (b) leaning back
  const leanMoment=F*yPush,lean=chairFrameShare(plan,leanMoment,hold.perScrew);
  // the same corner counted the way it was until branch seats (the building code's design value), for the record
  const oldJoint=lean.factor*hold.ndsPerScrew/hold.perScrew;
  // (b2) the repeated lean: 300 N, half on each back leg, at the same height, each screw at half its static hold
  const fatigue=chairFrameShare(plan,R.fatigueBackN*R.lbfPerN/2*yPush,hold.perScrew*R.fatigueShare);
  // the glue line of a saved chair's corner block along its rail carries what the rail's two screws pull at that
  // corner, the rail's pull included (a plain rail has no such glue line: 0)
  const railCorner=lean.corners[0];
  const railScrews=plan.blockDeep?railCorner.heights.slice(2).reduce((sum,h)=>sum+(railCorner.moment+lean.pull*railCorner.pullAt)*h/railCorner.stiff,0):0;
  const glueStress=railScrews/(plan.blockThick*plan.glueLong),glueLimit=R.glueMakerPsi*R.glueShare;
  // (a) the back leg bending at the side rail, on its full 3 1/2" depth (limit: WOOD_RULES.FB_SHORT x 0.95)
  const legS=plan.legThick*plan.legDepth*plan.legDepth/6;
  const legStress=F*(yPush-yRail)/legS;
  // (c) the crest rail across its thickness: the whole push at the middle of its span (the safe side of EN's pad)
  const crest=M[R.crestRail],crestS=crest.w*crest.t*crest.t/6;
  const crestStress=2*F*plan.crossLength/4/crestS;
  // (d) pulled out by the top of its back (30 lbf, PRACTICE)
  const pullOut=chairFrameShare(plan,R.pullLbf/2*(plan.S+plan.BH),hold.perScrew);
  // (e) rocking back on the two back legs (the repeated basis)
  const rocking=chairFrameShare(plan,R.personLb/2*R.rockAhead,hold.perScrew*R.fatigueShare);
  // (f), (g) a front leg pushed forward or sideways at its foot: the stretcher of that plane pulled on its two screws
  // (the side stretcher, or the front stretcher), and the leg bending over its foot (forward: about its 3 1/2" depth;
  // sideways: about its 1 1/2" thickness)
  const yCross=plan.strBottom+plan.crossDeep/2;
  const legPush=(newtons,yLow)=>{
    const P=newtons*R.lbfPerN,pull=P*yRail/(yRail-yLow);
    return{P,pull,factor:2*hold.perScrew/pull};
  };
  const forward=legPush(R.legForwardN,yStr),sideways=legPush(R.legSidewaysN,yCross);
  forward.bend=forward.P*yStr/legS/limit;
  sideways.bend=sideways.P*yCross/(plan.legDepth*plan.legThick*plan.legThick/6)/limit;
  return{F,yPush,yRail,yStr,lever,hold:hold.perScrew,screw:hold,moment:leanMoment,frame:lean,
    joint:lean.factor,oldJoint,                 // (b), the static lean (and its score by the old basis)
    fatigue:fatigue.factor,fatigueFrame:fatigue,// (b2), the repeated lean
    leanLeast:Math.min(lean.factor,fatigue.factor),
    leg:legStress/limit,legStress,              // (a), a share of the limit
    crest:crestStress/limit,crestStress,        // (c)
    stretcher:pullOut.factor,                   // (d)
    rock:rocking.factor,                        // (e)
    legForward:forward,legSideways:sideways,    // (f), (g)
    legPushLeast:Math.min(forward.factor,sideways.factor),legBendMost:Math.max(forward.bend,sideways.bend),
    glueStress,glue:glueStress/glueLimit};      // the corner blocks' glue line, a share of what it may carry
}
/* The seat loads (DC3): a grown person (1300 N [25 §6b], 292 lb) at the middle of each span that carries the seat,
   as a share of the bending limit (WOOD_RULES.FB_SHORT x 0.95). Spans center to center of the supports (the long,
   safe side). {frontRail, board, backBoard, worst}
   - the front seat rail on edge, between the inside faces of the front legs;
   - one 2x6 seat board lying flat, between the middles of the two side seat rails (a person standing on it);
   - the back seat board (a 2x4 lying flat, 3 1/2" deep) is not counted as a beam between the back legs: that would
     hang a kneeling person on the one pocket screw at each end, loaded sideways, and no sideways value for a screw
     is on the sheet [25 §12]. It lies on the back seat rail, whose top carries its back 1 1/2"; a knee in the middle
     of it bears 1/4" in front of the rail, and one at its front edge bears on the first seat board as well (they
     are laid tight). So the back seat rail on edge, between the back legs, is what is checked: backBoard. */
/* A plywood seat or a padded seat's base (stage 3) is checked instead of the boards:
   - panel: the plywood, as a strip CHAIR_RULES.panelStrip wide (only WOOD_RULES.SHEET_STRENGTH of its section counts,
     as for every plywood beam in js/verify.js), across the longest span between its supports front to back: from the
     middle of the back (or the front) seat rail to the middle of the nearer seat brace, or between the two braces
     (the cleats are not counted: they stand only in the middle of the rails);
   - brace: one seat brace (a 2x3 on edge) taking the whole person at its middle, between the middles of the two side
     seat rails;
   and, as for the boards, the front seat rail, and the back seat rail under the back of the seat (backBoard).
   {frontRail, board|panel, brace, backBoard, worst, spans} */
function chairSeatLoad(plan){
  const R=CHAIR_RULES,P=R.seatN*R.lbfPerN,limit=R.bendLimit*WOOD_RULES.FB_SHORT;
  const share=(mat,flat,span)=>{
    const m=M[mat],b=flat?m.w:m.t,d=flat?m.t:m.w;
    return P*span/4/(b*d*d/6)/limit;
  };
  const frontRail=share(R.rail,false,plan.crossLength);
  const backBoard=share(R.rail,false,plan.crossLength);   // the back seat rail under the back seat board (above)
  if(!plan.panel){
    const board=share(R.seatBoard,true,plan.F-plan.legThick);
    return{frontRail,board,backBoard,worst:Math.max(frontRail,board,backBoard)};
  }
  // the supports under the panel, front to back: the middles of the back and the front seat rail and of the braces
  const railT=M[R.rail].t;
  const supports=[railT/2,...plan.braces.map(b=>b.z+plan.braceThick/2),plan.D-railT/2].sort((a,b)=>a-b);
  const spans=supports.slice(1).map((z,i)=>z-supports[i]);
  const span=Math.max(...spans),t=plan.panel.t;
  const panel=P*span/4/(WOOD_RULES.SHEET_STRENGTH*R.panelStrip*t*t/6)/limit;
  const brace=share(R.brace,false,plan.F-plan.legThick);
  return{frontRail,panel,brace,backBoard,span,spans,worst:Math.max(frontRail,panel,brace,backBoard)};
}
/* The weight of the chair (lb) and where its middle is, from its own pieces (shapes taken off: pieceVolume), at the
   program's 35 lb per cubic foot (WOOD_RULES.DENSITY). */
function chairWeight(plan){
  const parts=chairPieces(plan);
  let pounds=0,zMoment=0;
  for(const piece of parts){
    const volume=typeof pieceVolume==='function'?pieceVolume(piece):piece.l*piece.w*piece.t;
    // the padded seat's cushion is foam and cloth: high-density seat foam is about 1.8 lb per cubic foot (the store
    // listings of reference sheet 25 §14), and the batting and fabric are counted as half a pound more (PRACTICE)
    const lb=isProp(piece)?volume*1.8/1728+.5:volume*WOOD_RULES.DENSITY,s=size(piece);
    pounds+=lb;
    zMoment+=lb*(piece.pos[2]+s[2]/2);
  }
  return{pounds,zMiddle:zMoment/pounds};
}
/* Tipping (DC6, backward, and DC7, forward and sideways): what holds the chair down over what tips it, about the
   edge of the feet it would tip over [25 §6c]. */
function chairTipFactor(plan){
  const R=CHAIR_RULES,wt=plan.weight;
  // backward, about the back edge of the back feet (z 0): 135 lb on the seat 6" in front of the back legs' front
  // faces, the chair's own weight at its middle; the push at the very top of the back (the worst case [25 §6c])
  const backPush=R.tipBackN(plan.S*25.4)*R.lbfPerN,top=plan.S+plan.BH;
  const backHold=R.tipSeatLb*(plan.legDepth+R.tipSeatAhead)+wt.pounds*wt.zMiddle;
  const backward=backHold/(backPush*top);
  // forward, about the front edge of the front feet (z D): 135 lb 2 3/8" in from the seat's front edge, 4 1/2 lbf
  // outward at the seat
  const inFront=plan.D-(plan.seatDepth-R.sideTipIn);
  const forward=(R.sideTipLb*inFront+wt.pounds*(plan.D-wt.zMiddle))/(R.sideTipPush*plan.S);
  // sideways, about the outside of the legs
  const inSide=R.sideTipIn-R.overhang;
  const sideways=(R.sideTipLb*inSide+wt.pounds*(plan.SW/2-plan.x0))/(R.sideTipPush*plan.S);
  return{backward,forward,sideways,backPush,top};
}
/* the largest back height (1/4" steps, inside the form) that keeps both the lean and the tip at the stop or above */
function chairTallestBack(plan){
  for(let BH=CHAIR_LIMITS.BH[1];BH>=CHAIR_LIMITS.BH[0];BH-=.25){
    const trial=chairPlanFresh({...plan.v,BH,table:false},true);
    if(trial.lean.leanLeast>=CHAIR_RULES.leanStop&&trial.tip.backward>=CHAIR_RULES.leanStop)return BH;
  }
  return null;
}

/* ---------- the program's Dining table, and how the chair fits it (T1 to T6) ---------- */
function chairTableOf(v){
  return tablePlan(tableArgs('Dining table',{L:v.tL,W:v.tW,H:v.tH}));
}
/* How many chairs fit along a side between the legs: 24" of table edge for each, and 2" between chairs and from the
   legs [25 §5] (T3); at least one when one fits with its 2" each side. The one rule for the chair's own check and
   for Chairs to match on the Dining table (js/chairsets.js), so the two forms never count differently. */
function chairsAlongSide(longSpan,seatWide){
  const R=CHAIR_RULES,each=seatWide+R.between;
  let along=Math.floor(longSpan/R.edgeEach+1e-9);
  if(!along&&longSpan>=seatWide+2*R.between-1e-9)along=1;
  while(along>0&&along*each+R.between>longSpan+1e-9)along--;
  return along;
}
/* Is there a dining chair seat (17" to 19") that leaves 7" under the apron and stands 9" to 13" below the top? */
function chairSeatWorks(H,underside){
  const R=CHAIR_RULES;
  for(let S=CHAIR_LIMITS.S[0];S<=CHAIR_LIMITS.S[1]+1e-9;S+=1/16){
    if(underside-S>=R.thighLeast-1e-9&&H-S>=R.topAbove.outer[0]-1e-9&&H-S<=R.topAbove.outer[1]+1e-9)return true;
  }
  return false;
}
/* T1 and T2: the seat against a table top this high, with the underside of its apron this high (the program's
   table, or one measured: a size not measured is null and its rule is not said) */
function chairSeatFits(plan,say,H,under){
  const R=CHAIR_RULES;
  // T1: the seat to the underside of the apron
  if(under!==null){
    const thigh=under-plan.S;
    if(thigh<R.thighLeast-1e-9){
      const lowest=floor16(under-R.thighLeast);
      say('T1','warn',thigh<=0?`With the seat at ${fmt(plan.S)}, the underside of the table's apron (${fmt(under)} up) is no higher than the seat. Thighs need at least about ${fmt(R.thighLeast)} under it.`
        :`With the seat at ${fmt(plan.S)}, there is ${fmt(r16(thigh))} between the seat and the underside of the table's apron (${fmt(under)}). Thighs need at least about ${fmt(R.thighLeast)}.`,
        lowest>=CHAIR_LIMITS.S[0]-1e-9?`Make the seat ${fmt(lowest)} high or lower.`
          :`A dining chair seat is at least ${fmt(CHAIR_LIMITS.S[0])} high, so this chair suits a table whose apron is ${fmt(CHAIR_LIMITS.S[0]+R.thighLeast)} or more off the floor.`);
    }else if(thigh<R.thighEasy-1e-9)say('T1','note',`There is ${fmt(r16(thigh))} between the seat and the apron: enough for most people, snug for a large person.`);
    else say('T1','fits',`Under the apron there is ${fmt(r16(thigh))} for your thighs.`);
  }
  // T2: the table top above the seat
  if(H!==null){
    const above=H-plan.S,[lo,hi]=R.topAbove.usual,[outLo,outHi]=R.topAbove.outer;
    const thigh=under!==null?under-plan.S:null;
    if(above<outLo-1e-9||above>outHi+1e-9){
      const target=r16(H-(lo+hi)/2),seat=Math.min(CHAIR_LIMITS.S[1],Math.max(CHAIR_LIMITS.S[0],target));
      say('T2','warn',above<=0?`The table top (${fmt(H)} up) is no higher than the seat. At a dining table people sit ${fmt(lo)} to ${fmt(hi)} below the top.`
        :`The table top is ${fmt(r16(above))} above the seat. At a dining table people sit ${fmt(lo)} to ${fmt(hi)} below the top.`,
        `Make the seat ${fmt(seat)} high, or check the table height.`);
    }else if(above<lo-1e-9||above>hi+1e-9){
      say('T2','note',`The table top is ${fmt(r16(above))} above the seat, a little ${above>hi?'more':'less'} than the usual ${fmt(lo)} to ${fmt(hi)}${above>hi&&thigh!==null&&thigh<R.thighEasy+1e-9?`, so the seat stays ${fmt(r16(thigh))} under the apron`:''}.`);
    }else say('T2','fits',`The table top is ${fmt(r16(above))} above the seat, the usual height.`);
  }
}
/* T3 and T4: chairs along a side and at an end, from the room between the legs (null: not measured). Returns how
   many fit along a side, or null. */
function chairRoomFits(plan,say,side,end){
  const R=CHAIR_RULES;
  let along=null;
  if(side!==null){
    along=chairsAlongSide(side,plan.SW);
    if(along>0)say('T3','note',`Between the legs along a side there is ${fmt(side)}: ${countWord(along)} of these chairs ${along===1?'fits':'fit'} there, with ${fmt(r16(side/along))} of table ${along===1?'for it':'each'} (28" to 30" is roomy).`);
    else say('T3','warn',`Between the legs along a side there is only ${fmt(side)}: even one chair ${fmt(plan.SW)} wide needs ${fmt(plan.SW+2*R.between)} there.`,'Use the chairs at the ends, or make the table longer.');
  }
  // T4: with chairs tucked in along the sides, their seats reach in under the top and an end chair stops against
  // them (spec 11.1)
  if(end!==null){
    if(end>=plan.SW+2*R.between-1e-9)say('T4','note',`A chair also fits at each end, between the end legs (${fmt(end)}), with ${fmt(r16((end-plan.SW)/2))} to spare at each side; it pushes in only part way when the chairs along the sides are tucked in.`);
    else say('T4','note',`The ${fmt(end)} between the end legs is too narrow for a chair ${fmt(plan.SW)} wide: no chair fits at the ends.`);
  }
  return along;
}
/* [{rule, fits, level:'warn'|'note'|'fits', text, fix}], with .table (the program's table; for one measured
   {H, under, measured}) and .along (chairs along a side, or null when not measured) */
function chairTableFit(plan){
  return plan.v.tableKind==='measured'?chairMeasuredFit(plan):chairProgramTableFit(plan);
}
/* A table the person measured (spec 11, stage 2): only the sizes typed are checked, each by its own rule. */
function chairMeasuredFit(plan){
  const v=plan.v,out=[];
  const say=(rule,level,text,fix)=>out.push({rule,level,fits:level!=='warn',text,fix:fix||''});
  const given=size=>size>0?size:null;
  const H=given(v.mH),under=given(v.mU);
  if(H!==null&&under!==null&&under>=H-1e-9){
    say('T0','warn',`The underside of the apron (${fmt(under)} up) is not below the table top (${fmt(H)} up).`,
      'Measure both again from the floor: to the top of the table, and to the underside of the apron (the board under the edge of the top).');
  }else chairSeatFits(plan,say,H,under);
  const along=chairRoomFits(plan,say,given(v.mSide),given(v.mEnd));
  if(!out.length)say('T0','note','Type the sizes of your table that you have measured; a box left at 0 is not checked.');
  out.table={H:H!==null?H:null,under,measured:true};
  out.along=along;
  return out;
}
/* The program's own Dining table. Its sizes are said the way its boxes write them while the form is talking
   (typedLen, js/core.js); a chair's sizes in inches, the way people speak of chairs (17 1/2", not 1'-5 1/2"). */
function chairProgramTableFit(plan){
  const R=CHAIR_RULES,v=plan.v,table=chairTableOf(v),out=[];
  const under=table.legH-table.apronDepth;
  const say=(rule,level,text,fix)=>out.push({rule,level,fits:level!=='warn',text,fix:fix||''});
  const twoBySix=table.apron!=='2x4';
  // T6 first: a table too high or too low for any dining chair, judged with the usual 2x4 aprons, so a table as
  // high as a counter is told so and not blamed on its aprons
  const usualUnder=table.legH-M['2x4'].w;
  let refused=false;   // T5 or T6: no dining chair suits this table, so no chairs are counted along it
  if(!chairSeatWorks(table.H,usualUnder)){
    refused=true;
    let low=null,high=null;
    for(let H=CHAIR_LIMITS.tH[0];H<=CHAIR_LIMITS.tH[1];H+=.5){
      const t=chairTableOf({...v,tH:H});
      if(t.apron==='2x4'&&chairSeatWorks(t.H,t.legH-t.apronDepth)){if(low===null)low=H;high=H;}
    }
    const wanted=r16(table.H-(R.topAbove.usual[0]+R.topAbove.usual[1])/2);
    // a counter stool seat is 24" to 26", a bar stool 28" to 30" [25 §9]: named only when the seat wanted is that high
    const stool=wanted>=28-1e-9?', the height of a bar stool':wanted>=24-1e-9?', the height of a counter stool':'';
    const what=table.H>CHAIR_LIMITS.S[1]+R.topAbove.outer[1]
      ?`A table ${typedLen(table.H)} high wants a seat about ${fmt(wanted)} high: higher than a dining chair seat (${fmt(CHAIR_LIMITS.S[0])} to ${fmt(CHAIR_LIMITS.S[1])})${stool}.`
      :`A table ${typedLen(table.H)} high leaves too little room between a dining chair seat and the underside of its aprons (${fmt(under)} up): the seat could be at most ${fmt(r16(under-R.thighLeast))} high, and dining chairs are ${fmt(CHAIR_LIMITS.S[0])} to ${fmt(CHAIR_LIMITS.S[1])}.`;
    say('T6','warn',what,low!==null?`Use a table ${typedLen(low)} to ${typedLen(high)} high.`:'Use a table of an ordinary height.');
  }else if(twoBySix){
    refused=true;
    // T5: at this size the program's table has 2x6 aprons, 2" deeper than 2x4: no dining seat both leaves 7" under
    // them and sits at most 13" below the top (a 5 1/2" apron, the 1 1/2" top and 7" make 14")
    const most=r16(under-R.thighLeast);
    const why=most<CHAIR_LIMITS.S[0]-1e-9?`, and dining chair seats are ${fmt(CHAIR_LIMITS.S[0])} to ${fmt(CHAIR_LIMITS.S[1])} high`
      :`, and a seat that high sits ${fmt(r16(table.H-most))} below the ${typedLen(table.H)} top, more than the ${fmt(R.topAbove.outer[1])} at most that people sit below a dining table`;
    // the fix that works: shorter at this width, else narrower at this length, else lower; each tried and found
    const works=change=>{const t=chairTableOf({...v,...change});return t.apron==='2x4'&&chairSeatWorks(t.H,t.legH-t.apronDepth)?t:null;};
    let fix='';
    for(let L=Math.floor(v.tL);L>=CHAIR_LIMITS.tL[0]&&!fix;L--)if(works({tL:L}))fix=`Keep the table ${typedLen(L)} long or shorter at ${typedLen(table.W)} wide, where its aprons stay 2x4.`;
    for(let W=Math.floor(v.tW);W>=CHAIR_LIMITS.tW[0]&&!fix;W--){const t=works({tW:W});if(t)fix=`Make the table ${typedLen(t.W)} wide or narrower at ${typedLen(table.L)} long, where its aprons stay 2x4.`;}
    for(let H=Math.floor(v.tH);H>=CHAIR_LIMITS.tH[0]&&!fix;H--)if(works({tH:H}))fix=`Make the table ${typedLen(H)} high, where its aprons stay 2x4.`;
    say('T5','warn',`At ${typedLen(table.L)} long and ${typedLen(table.W)} wide the table's aprons are ${M[table.apron].short}, so there is only ${fmt(under)} under them: a dining chair seat could be at most ${fmt(most)} high to leave ${fmt(R.thighLeast)} for the thighs${why}.`,
      fix||'Make the table shorter or narrower, so its aprons stay 2x4.');
  }else chairSeatFits(plan,say,table.H,under);
  // T3 and T4, not counted for a table no dining chair suits
  const along=refused?0:chairRoomFits(plan,say,table.longSpan,table.shortSpan);
  out.table=table;
  out.along=along;
  return out;
}
/* The program's Dining table at its usual size, for the remark when the table box is not ticked: the seat to the
   underside of its aprons (T1 without a warning box: only the person knows the table). */
function chairUnderUsualTable(plan){
  const d=DINING_CHAIR_DEFAULTS,table=chairTableOf({tL:d.tL,tW:d.tW,tH:d.tH}),under=table.legH-table.apronDepth;
  return{table,under,thigh:under-plan.S};
}

/* ---------- what cannot work (the stops), DC1 to DC22 ----------
   Inside the form's limits and in construction pine none of these stops is reached (the self-check
   diningChairStandsAtEveryLimit records the least margins, and diningChairStopsFire makes each fire); they are here
   for a softer wood, a number typed outside the limits and the day a rule or a limit is moved. */
/* the woods of the program in which this chair passes the lean check with the margin wanted */
function chairWoodsThatHold(plan){
  return Object.keys(WOODS).filter(wood=>chairPlanFresh({...plan.v,table:false,wood},true).lean.leanLeast>=CHAIR_RULES.leanWanted-1e-9);
}
function chairProblems(plan,raw){
  const R=CHAIR_RULES,found=plan.problems;
  // DC1, DC17: a number typed outside the form's limits (the form's box turns red too; this is the reason)
  const outside=(key,label,why,fix)=>{
    const value=+raw[key],[lo,hi]=CHAIR_LIMITS[key];
    if(raw[key]===undefined||raw[key]===''||raw[key]===null||!Number.isFinite(value))return;
    if(value<lo-1e-9||value>hi+1e-9)found.push({level:'stop',text:`${label} ${fmt(value)}: ${why}`,fix:fix||`Use ${fmt(lo)} to ${fmt(hi)}.`});
  };
  outside('S','A seat height of','dining chairs are 17" to 19" high, so the seat suits a table about 30" high and leaves room under its apron for the thighs.',
    `Use ${fmt(CHAIR_LIMITS.S[0])} to ${fmt(CHAIR_LIMITS.S[1])}; for a counter or a bar, a stool is what is wanted.`);
  outside('SW','A seat width of',`the room between the back legs is 4" less than the seat, and a person needs at least ${fmt(R.backLegsApartLeast)} there; wider than ${fmt(CHAIR_LIMITS.SW[1])} two chairs no longer fit along a side of the table.`);
  outside('BH','A back height of',`a back lower than ${fmt(CHAIR_LIMITS.BH[0])} has no room for its two rails, and the program sizes and checks this chair with backs up to ${fmt(CHAIR_LIMITS.BH[1])}.`);
  if(found.length)return;
  // DC4: leaning back (cases b, d, e: the sides of the chair pushed out of square; f, g: a front leg pushed)
  const lean=plan.lean,weakest=Math.min(lean.leanLeast,lean.stretcher,lean.rock,lean.legPushLeast);
  if(weakest<R.leanStop){
    const holding=chairWoodsThatHold(plan),soft=chairWoodG(plan.v.wood)<CHAIR_WOOD_G.pine-1e-9;
    const tallest=soft?null:chairTallestBack(plan);
    const woods=holding.map(chairWoodName),under=plan.v.blocks?'their corner blocks':'the side stretchers';
    found.push({level:'stop',code:'chair-lean',
      text:soft?`In ${chairWoodName(plan.v.wood)}, a softer wood than construction pine, the pocket screws hold only about ${Math.round(100*chairWoodG(plan.v.wood)**2/CHAIR_WOOD_G.pine**2)}% as well, and leaning back would work the side seat rails and ${under} loose from the legs.`
        :`Leaning back would work the side seat rails and ${under} loose from the legs.`,
      fix:soft&&woods.length?`Build this chair in ${chairOrWords(woods)} (Style and finish).`
        :tallest!==null?`Make the back ${fmt(tallest)} tall or lower.`:'Make the back lower.'});
  }else if(chairWoodG(plan.v.wood)<CHAIR_WOOD_G.pine-1e-9&&lean.leanLeast<R.leanWanted){
    found.push({level:'warn',code:'chair-lean',text:`In ${chairWoodName(plan.v.wood)} the pocket screws hold a little less well than in construction pine, and the chair keeps less than the margin wanted when someone leans back.`,
      fix:`Build it in ${chairOrWords(chairWoodsThatHold(plan).map(chairWoodName))} (Style and finish).`});
  }
  // the corner blocks' glue line
  if(lean.glue>1)found.push({level:'stop',text:'The glue line of a corner block would carry more than wood glue in pine can be trusted with.',fix:'Make the back lower.'});
  // DC6: tipping backward
  if(plan.tip.backward<R.leanStop){
    const tallest=chairTallestBack(plan);
    found.push({level:'stop',code:'chair-tip',text:'Pushed at the top of its back, the chair would tip over backward: the back is too tall for its feet.',
      fix:tallest!==null?`Make the back ${fmt(tallest)} tall or lower.`:'Make the back lower.'});
  }
  // DC3: the seat loads
  const widest=key=>{
    for(let SW=CHAIR_LIMITS.SW[1];SW>=CHAIR_LIMITS.SW[0];SW-=.5)if(chairPlanFresh({...plan.v,SW,table:false},true).seatLoad[key]<=1)return SW;
    return null;
  };
  const narrower=key=>{const SW=widest(key);return SW!==null&&SW<plan.SW?`Make the seat ${fmt(SW)} wide or narrower.`:'Make the seat narrower.';};
  if(plan.seatLoad.board>1)found.push({level:'stop',code:'chair-seat',text:'A grown person standing on one seat board would bend it too far.',fix:narrower('board')});
  // (the sheet spans front to back, between the seat rails and the braces, whatever the seat's width: a narrower seat
  // does not clear it, so the fix is the board seat, whose 2x6 boards span side to side; the code review's finding 9)
  if(plan.seatLoad.panel>1)found.push({level:'stop',code:'chair-seat',text:`A grown person standing on the ${plan.seat==='padded'?'seat base':'plywood seat'} would bend it too far between the seat braces and the seat rails.`,fix:'Choose Solid wood boards for the seat.'});
  if(plan.seatLoad.brace>1)found.push({level:'stop',code:'chair-seat',text:'A seat brace would bend too far under a grown person standing over it.',fix:'Choose Solid wood boards for the seat.'});
  if(plan.seatLoad.backBoard>1)found.push({level:'stop',code:'chair-seat',text:'The back seat rail would bend too far under a grown person kneeling on the back of the seat.',fix:narrower('backBoard')});
  if(plan.seatLoad.frontRail>1)found.push({level:'stop',code:'chair-seat',text:'The front seat rail would bend too far under a grown person sitting on its middle.',fix:narrower('frontRail')});
  // DC10, DC11: room on the back legs for the two back rails
  if(plan.topDepth<R.topLeast-1e-9)found.push({level:'stop',code:'chair-top',text:`The top of each back leg would be only ${fmt(plan.topDepth)} deep after the cut, too little to hold the crest rail.`,fix:'Tick Straight back legs, or make the back lower.'});
  if(plan.openUnder<R.openUnder[0]-1e-9||plan.railGap<R.railGapLeast-1e-9)found.push({level:'stop',code:'chair-rails',text:'The back is too low for its two rails and the open space under them.',fix:`Make the back ${fmt(CHAIR_LIMITS.BH[0])} tall or more.`});
  // DC12, the weight, is a note: said plainly in the remark (diningChairInfo)
}

/* ---------- the pieces ---------- */
function buildDiningChair(p){
  const plan=diningChairPlan(p);
  if(plan.problems.some(f=>f.level==='stop'))return[];
  return chairPieces(plan);
}
/* The corner of a piece's face at the low or high end of each of two world axes, as the index of p.shape.corners
   ([end 0 edge 0, end 0 edge 1, end 1 edge 0, end 1 edge 1], js/shapes.js), and the corner's two sizes in the
   piece's own frame (a along the length, b across it). */
function chairCorner(piece,sides,sizes){
  const end=sides[piece.ax[0]],edge=sides[piece.ax[1]];
  return{index:(end?2:0)+(edge?1:0),a:sizes[piece.ax[0]],b:sizes[piece.ax[1]]};
}
function chairPieces(plan){
  const R=CHAIR_RULES,P=[],leg=chairBoard(R.leg),rail=chairBoard(R.rail),str=chairBoard(plan.strMat),block=chairBoard(R.block);
  const{legX,inner,D,S,BH}=plan;
  for(const x of legX){
    // the back leg: straight, its front edge cut back from the seat to the top (corner-clip on the top front corner)
    const back=mk('Back leg',R.leg,[leg.t,plan.backLegH,leg.w],[x,0,0]);
    if(plan.taper>0){
      const corner=chairCorner(back,{1:1,2:1},{1:BH,2:plan.taper});
      cutCorner(back,corner.index,{cut:'clip',a:corner.a,b:corner.b});
    }
    P.push(back);
    P.push(mk('Front leg',R.leg,[leg.t,plan.frontLegH,leg.w],[x,0,D-leg.w]));
    P.push(mk('Side seat rail',R.rail,[rail.t,rail.w,plan.sideLength],[x,plan.railBottom,leg.w]));
    // (only a chair saved before the seat choice: a corner block under each end of the side seat rail, against the leg)
    for(const b of plan.blocks)P.push(mk('Corner block',R.block,[block.t,block.w,R.blockLong],[x,plan.blockBottom,b.z]));
    P.push(mk('Side stretcher',plan.strMat,[str.t,str.w,plan.sideLength],[x,plan.strBottom,leg.w]));
  }
  const across=plan.crossLength;
  P.push(mk('Front seat rail',R.rail,[across,rail.w,rail.t],[inner[0],plan.railBottom,D-rail.t]));
  P.push(mk('Back seat rail',R.rail,[across,rail.w,rail.t],[inner[0],plan.railBottom,0]));
  const cross=chairBoard(plan.crossMat);
  P.push(mk('Front stretcher',plan.crossMat,[across,cross.w,cross.t],[inner[0],plan.strBottom,D-cross.t]));
  P.push(mk('Back stretcher',plan.crossMat,[across,cross.w,cross.t],[inner[0],plan.strBottom,0]));
  P.push(...chairSeatPieces(plan));
  const lower=M[R.lowerRail],crest=M[R.crestRail];
  P.push(mk('Lower back rail',R.lowerRail,[across,lower.w,lower.t],[inner[0],plan.lower.bottom,plan.lower.back]));
  P.push(mk('Crest rail',R.crestRail,[across,crest.w,crest.t],[inner[0],plan.crest.bottom,plan.crest.back]));
  return P;
}

/* The seat of the kind chosen.
   - Solid wood boards: the back seat board between the back legs, then the three 2x6 boards from the back legs
     forward (the front one named apart: its top front edge is rounded, and it rests on the side rails, where the
     rails' own pocket screws into the front legs leave no room for a screw into it).
   - Plywood, left bare: two seat braces between the side seat rails, and one piece of 3/4" plywood the
     outline of the board seat, notched round the back legs, its front corners rounded.
   - Padded cushion: the same braces; a 3/4" plywood seat base of that outline; on it the cushion (foam, batting and
     fabric, bought), drawn as one piece of the same outline, as tall as it is before anyone sits on it. */
function chairSeatPieces(plan){
  const R=CHAIR_RULES,P=[],S=plan.S;
  if(!plan.panel){
    const seatY=S-plan.seatT,backBoard=chairBoard(R.backSeatBoard),board=chairBoard(R.seatBoard);
    P.push(mk('Back seat board',R.backSeatBoard,[plan.backSeatBoard.length,backBoard.t,backBoard.w],[plan.backSeatBoard.x,seatY,0]));
    plan.boards.forEach((b,i)=>P.push(mk(i===plan.boards.length-1?'Front seat board':'Seat board',R.seatBoard,[plan.SW,board.t,board.w],[0,seatY,b.z])));
    return P;
  }
  const brace=chairBoard(R.brace),cleat=chairBoard(R.cleat);
  for(const b of plan.braces)P.push(mk('Seat brace',R.brace,[plan.crossLength,brace.w,brace.t],[plan.inner[0],plan.railTop-brace.w,b.z]));
  for(const c of plan.cleats)P.push(mk('Seat cleat',R.cleat,[c.x1-c.x0,cleat.w,cleat.t],[c.x0,plan.railTop-cleat.w,c.z]));
  // the outline: notched round each back leg (from the side of the seat to the inside face of the leg, from the back
  // to the front face of the leg; the padded seat's base coverRoom more each way), the two front corners rounded
  const shaped=(name,mat,y,t,notch)=>{
    const piece=mk(name,mat,[plan.SW,t,plan.seatDepth],[0,y,0]);
    const{x,z}=notch;
    for(const side of[0,1]){
      const back=chairCorner(piece,{0:side,2:0},{0:x,2:z});
      cutCorner(piece,back.index,{cut:'notch',a:back.a,b:back.b});
      const front=chairCorner(piece,{0:side,2:1},{0:plan.panel.corner,2:plan.panel.corner});
      cutCorner(piece,front.index,{cut:'round',r:plan.panel.corner});
    }
    return piece;
  };
  if(plan.seat==='plywood')P.push(shaped('Plywood seat',plan.panel.mat,plan.railTop,plan.panel.t,plan.panel.notch));
  else{
    const base=shaped('Seat base',plan.panel.mat,plan.railTop,plan.panel.t,plan.panel.notch);
    for(const vent of chairVentHoles(plan))chairHoleAt(base,vent.x,vent.z,CHAIR_RULES.ventD);
    P.push(base);
    P.push(shaped('Seat cushion','cushion',plan.cushion.y,plan.cushion.t,plan.cushion.notch));
  }
  return P;
}
/* The vent holes of a padded seat's base [25 §13]: two rows of three, in the open spans of the base in front of and
   behind the seat braces (between them and the seat cleats), spread across the seat clear of the cleats' screws.
   [{x, z}] in the chair's own place. */
function chairVentHoles(plan){
  const R=CHAIR_RULES,railT=M[R.rail].t;
  const braces=plan.braces.map(b=>b.z).sort((a,b)=>a-b);
  if(braces.length<2)return[];
  // the middles of the open spans: from the back seat rail to the back brace, and from the front brace to the front rail
  const rows=[(railT+plan.cleatSize+braces[0])/2,(braces[1]+plan.braceThick+plan.D-railT-plan.cleatSize)/2];
  const xs=[plan.SW/4,plan.SW/2,plan.SW*3/4].map(r16);
  const out=[];
  for(const z of rows.map(r16))for(const x of xs)out.push({x,z});
  return out.slice(0,R.vents);
}
/* a plain round hole through a flat piece at the world place x, z (its middle), measured on the piece's drawing
   from its end 0 and its edge 0 (addHole, js/shapes.js) */
function chairHoleAt(piece,x,z,d){
  const world=[x,0,z],from=k=>r16(world[piece.ax[k]]-piece.pos[piece.ax[k]]);
  addHole(piece,{d,at:{u:{from:0,d:from(0)},v:{from:0,d:from(1)}}});
}
/* the height a person sits at on these pieces of one chair: the top of its seat, less what the cushion squashes */
function chairSitHeight(parts){
  const seat=parts.filter(p=>/seat board|^plywood seat$|^seat base$|^seat cushion$/i.test(p.name));
  if(!seat.length)return null;
  const top=Math.max(...seat.map(p=>box(p).hi[1]));
  return parts.some(p=>p.name==='Seat cushion')?top-CHAIR_RULES.foam*CHAIR_RULES.foamSquash:top;
}

/* ---------- the seat frame seen from above (spec A.6; stage 1 left it unchecked) ----------
   Seen from above, the four seat rails could lean into a diamond (the frame twisting out of square in plan). A
   glued panel would stop that; this seat is never glued. What holds it, by rule of thumb: a seat board that is
   screwed to BOTH side seat rails with a pair of screws at each, the two screws of a pair at least an inch apart
   across the board, so that the board resists turning on the rails (as boards nailed across a wall's studs, two nails
   to a stud, keep the wall square), together with the four side frames held at two heights (DC5). No number is
   worked: no sideways value for a screw is on the reference sheet [25 §12]. chairSeatBraces(pieces) reads the
   real fasteners of one placed chair and returns the boards that brace it. */
const CHAIR_SQUARE={pairApart:1};   // inches between the two screws of a pair, across the board (PRACTICE)
function chairSeatBraces(pieces){
  const own=new Set(pieces),braces=[];
  for(const board of pieces.filter(p=>p.name==='Seat board')){
    const across=board.ax[1];   // the board's width runs along this world axis
    const pairs=connGraph().links.filter(link=>link.fastened&&own.has(link.a)&&own.has(link.b)&&[link.a,link.b].includes(board)&&[link.a.name,link.b.name].includes('Side seat rail'))
      .map(link=>fastenersOfLink(link).map(f=>f.pos[across]))
      .filter(at=>at.length>=2&&Math.max(...at)-Math.min(...at)>=CHAIR_SQUARE.pairApart-1e-6);
    if(pairs.length>=2)braces.push(board);
  }
  return braces;
}
/* A plywood seat or a padded seat's base keeps the frame square when it is one stiff sheet tied to the front AND the
   back seat rails: for the frame to lean into a diamond seen from above, the front rail must slide sideways against
   the back rail, and a sheet fastened to both cannot let it. Here the sheet is screwed up through the two seat
   cleats, and each cleat is glued face to face to its rail. Rule of thumb, no number (no sideways value for a screw
   is on the sheet [25 §12]): a cleat glued to the front seat rail and one glued to the back seat rail, each with
   two or more screws up into the sheet CHAIR_SQUARE.panelApart or more apart along it, so the sheet cannot turn on
   it. Returns the two cleats, or an empty list when the sheet is not tied to both rails so. */
CHAIR_SQUARE.panelApart=2;   // inches between the outermost screws up into the sheet along one cleat (PRACTICE; twice a board seat's pair)
function chairPanelTies(pieces){
  const own=new Set(pieces),links=connGraph().links.filter(link=>link.fastened&&own.has(link.a)&&own.has(link.b));
  const sheet=pieces.find(p=>p.name==='Plywood seat'||p.name==='Seat base');
  if(!sheet)return[];
  const ties=[],railsTied=new Set();
  for(const cleat of pieces.filter(p=>p.name==='Seat cleat')){
    // (glued to its rail: a glued link holds, though it lays out no screw)
    const rail=['Front seat rail','Back seat rail'].find(name=>connGraph().links.some(link=>own.has(link.a)&&own.has(link.b)&&(link.fastened||link.type==='glue')&&[link.a,link.b].includes(cleat)&&[link.a.name,link.b.name].includes(name)));
    const up=links.filter(link=>[link.a,link.b].includes(cleat)&&[link.a,link.b].includes(sheet)).flatMap(link=>fastenersOfLink(link)).map(f=>f.pos[cleat.ax[0]]);
    if(rail&&up.length>=2&&Math.max(...up)-Math.min(...up)>=CHAIR_SQUARE.panelApart-1e-6){ties.push(cleat);railsTied.add(rail);}
  }
  return railsTied.size===2?ties:[];
}
/* the seat of one placed chair keeps its frame square seen from above: the boards that brace it, or the braces that
   tie its sheet (an empty list when nothing does) */
const chairSeatHeldSquare=pieces=>pieces.some(p=>p.name==='Plywood seat'||p.name==='Seat base')?chairPanelTies(pieces):chairSeatBraces(pieces);

/* ---------- the warning box ---------- */
function diningChairCheck(p){
  const plan=diningChairPlan(p),found=plan.problems.slice();
  if(found.some(f=>f.level==='stop'))return found;
  // the table fits: what does not fit is a warning, because only the person knows the table
  if(plan.fit)for(const finding of plan.fit)if(finding.level==='warn')found.push({level:'warn',word:'Does not fit.',text:finding.text,fix:finding.fix});
  return found;
}
/* Check my design (js/checkui.js, keptWarnings): the chair checked again as the design is now, in the wood chosen in
   Style and finish since it was made (a chair is made in construction pine; cedar, select pine and rough boards hold
   a screw less well). vals: the form values it was made with (S.sets). */
function diningChairRecheck(vals){
  const plan=diningChairPlan({...vals,table:false,wood:chairWoodNow()});
  return plan.problems.filter(f=>f.code==='chair-lean');
}

/* ---------- the remark under the form ---------- */
const chairLeanWords=plan=>plan.taper>0?`leaning back about ${Math.round(plan.cutLeanDeg)}°`:'standing upright';
/* the weight, said plainly (DC12) */
function chairWeightWords(plan){
  const R=CHAIR_RULES,lb=Math.round(plan.weight.pounds);
  const why=plan.seat==='boards'?`the 2x4s and 2x6s and the 1 1/2" seat${plan.v.blocks?' and the corner blocks':''}`
    :`the 2x4 frame and the 3/4" plywood ${plan.seat==='padded'?'base':'seat'}`;
  return`about ${lb} lb: heavier than most bought chairs (13 to 17 lb)${plan.weight.pounds>R.heavyLb?`, and a little heavier than the heaviest bought dining chairs found (about ${R.heavyLb} lb)`:''}, because of ${why}`;
}
/* the seat in one sentence of the remark (the seat's sizes in inches, the way people speak of chairs) */
function chairSeatWords(plan){
  const R=CHAIR_RULES,start=`Seat ${fmt(plan.S)} high and ${fmt(plan.SW)} wide`,depth=`${fmt(plan.seatDepth)} from front to back (about ${fmt(Math.round(plan.feltDepth*2)/2)} to the back rest)`;
  // (one 4 x 8 sheet of plywood is bought even for one chair: the real-thing review asked that the remark say it makes
  // the seats of a whole set)
  const sheetNote='; the shopping list buys a whole 4 ft x 8 ft sheet of 3/4" plywood, which makes the seats of six chairs or more';
  if(plan.seat==='plywood')return`${start}: one piece of 3/4" plywood ${depth}, notched round the back legs, carried by two seat braces, glued down and screwed on from underneath through two seat cleats${sheetNote}`;
  if(plan.seat==='padded')return`${start} at the top of the cushion as you sit on it: a padded slip seat ${depth}, a 3/4" plywood base with ${fmt(R.foam)} foam, batting and fabric stapled underneath, resting on two seat braces and screwed on from underneath through two seat cleats${sheetNote}. The foam is counted to squash about ${fmt(plan.cushion.squash)} (a quarter of it), so the cushion stands ${fmt(plan.cushion.squash)} higher before anyone sits on it and the frame is built ${fmt(r16(plan.seatT-M[R.seatBoard].t))} lower than with a board seat`;
  return`${start}, three 2x6 boards ${fmt(plan.SD)} deep (about ${fmt(Math.round(plan.feltDepth*2)/2)} to the back rest)`;
}
function diningChairInfo(p){
  const plan=diningChairPlan(p),v=plan.v;
  if(plan.problems.some(f=>f.level==='stop'))return'';
  // (a measured table whose height was left at 0: the program's usual table height is the reference)
  const tableH=v.table&&plan.fit.table.H?plan.fit.table.H:DINING_CHAIR_DEFAULTS.tH;
  const overTable=plan.crest.top-tableH;
  const lines=[];
  // (a chair's sizes are said in inches, the way people speak of chairs)
  lines.push(`${chairSeatWords(plan)}, with ${fmt(plan.betweenBackLegs)} between the back legs. `+
    `Back ${fmt(plan.BH)} tall and ${chairLeanWords(plan)}; its top is ${fmt(plan.crest.top)} from the floor, ${fmt(Math.abs(overTable))} ${overTable>=0?'above':'below'} a ${fmt(tableH)} table top. `+
    `Overall ${fmt(plan.SW)} wide, ${fmt(plan.seatDepth)} deep and ${fmt(plan.crest.top)} tall, ${chairWeightWords(plan)}.`);
  if(plan.fit){
    for(const finding of plan.fit)if(finding.level!=='warn')lines.push(finding.text);
  }else{
    // with the table box not ticked: a seat too high for the program's own table at its usual size is still said
    const usual=chairUnderUsualTable(plan);
    if(usual.thigh<CHAIR_RULES.thighEasy-1e-9)lines.push(`Under the program's Dining table at its usual ${fmt(usual.table.H)} (its aprons ${fmt(usual.under)} up) this seat leaves only ${fmt(r16(usual.thigh))} for the thighs${usual.thigh<CHAIR_RULES.thighLeast-1e-9?', less than the 7" they need':''}: tick Check it against my table.`);
  }
  if(v.upright&&chairUprightByStyle())lines.push('Straight back legs start ticked in the Rustic / rough style; untick the box for a back that leans back about 5°.');
  lines.push(v.blocks?'Under each end of each side seat rail a corner block, glued to the rail and screwed into the leg, makes the joint that leaning back works hardest twice as deep.'
    :`Each side is a plain 2x4 seat rail and a 2x4 stretcher ${fmt(plan.strBottom)} off the floor, glued and pocket-screwed into both legs, with slimmer 2x3 stretchers across the front and the back: when someone leans back, the rail and the stretcher hold the legs together at two heights. The side stretchers are 2x4s because each corner of a side has only two pocket screws: the deeper stretcher puts its two screws as far apart as the rail's, so the four corners share the lean equally.`);
  lines.push(plan.seat==='boards'?'In the Everyday and Fine furniture styles the seat boards are held on from underneath and the pocket holes on the back rails and on the stretchers are filled with glued plugs, so no screw or open hole shows on the seat, the sides or the back (Rustic / rough screws the front seat board and the back seat board down from above).'
    :`The ${plan.seat==='padded'?'padded seat':'plywood seat'} is screwed on from underneath in every style, so no screw shows on it${plan.seat==='plywood'?'; in the Everyday and Fine furniture styles its edges that show get iron-on edge banding, in Rustic / rough they are rounded over and sanded':''}. In Everyday and Fine furniture the pocket holes on the back rails and on the stretchers are filled with glued plugs.`);
  const wood=chairWoodNow();
  if(chairWoodG(wood)<CHAIR_WOOD_G.pine-1e-9)lines.push(`Made with Create it is in construction pine. Added beside a design in ${chairWoodName(wood)}, it takes that wood, which holds a screw less well: Check my design will say whether the chair still holds. Construction pine or spruce, poplar, pressure-treated pine and red oak hold.`);
  lines.push('It takes the build style of the design that is open. To make a set, make one chair, select it and use Copy in a row: the cut list, the shopping list and the build steps count every chair. Or tick Chairs to match on the Dining table (the entry Dining table and chairs): it makes the table and as many chairs as fit, tucked in.');
  return lines.join(' ');
}

/* ---------- the notes ---------- */
/* a 1" round self-stick felt pad under each of the four feet (a 2x4 foot is 1 1/2" across; the shopping list buys a pack) */
const CHAIR_FELT_PADS=4,CHAIR_FELT_LABEL='Felt pads, 1" round, self-stick';
/* The bought things of the seats (spec 12 stage 3), each a line of the shopping list counted from the chairs as the
   design is now (chairLinesFollowTheChairs): store sizes and prices are the rows of js/prices.js, each from the
   store listings of reference sheet 25 §14.
   - the plywood seat's iron-on edge banding (Everyday and Fine furniture; Rustic rounds the edges over instead): the
     front, both sides and the back edge between the notches, with a tenth more for trimming, in 25 ft rolls;
   - the padded seat: one piece of 2" foam a seat (three seats come out of a 24" x 72" sheet), batting, a yard of
     54" upholstery fabric a seat (a seat with its wrap is about 32" square), staples, spray adhesive for the foam, and
     one staple gun whatever the number of chairs. */
const CHAIR_BANDING_LABEL='Edge banding, 13/16" iron-on, for the plywood chair seats (25 ft rolls)',CHAIR_BANDING_ROLL=25;
const CHAIR_UPHOLSTERY=[
  {label:'Upholstery foam, 2" high density',each:1},
  {label:'Upholstery batting, polyester',each:1},
  {label:'Upholstery fabric, 54" wide, 1 yard a seat',each:1},
  {label:'Staples, 3/8" (T50), for the upholstery',each:100},
  {label:'Spray adhesive, for the foam',each:1},
  {label:'Staple gun, heavy duty (takes T50 staples)',once:true}];
/* how many feet of edge banding one plywood seat takes (the edges that show), with a tenth for trimming */
function chairBandingFeet(plan){
  const n=plan.panel.notch;
  return(plan.SW+2*(plan.seatDepth-n.z)+(plan.SW-2*n.x))*1.1/12;
}
/* every bought line of one chair at these form values, in the style given (felt pads, banding, upholstery) */
function chairLines(vals,style){
  const plan=diningChairPlan(vals),lines=[[CHAIR_FELT_LABEL,CHAIR_FELT_PADS]];
  if(plan.seat==='plywood'&&style!=='rustic')lines.push([CHAIR_BANDING_LABEL,Math.ceil(chairBandingFeet(plan)/CHAIR_BANDING_ROLL)]);
  if(plan.seat==='padded')for(const line of CHAIR_UPHOLSTERY)lines.push([line.label,line.once?1:line.each]);
  return lines;
}
/* The bought lines follow the chairs. A preset's plain lines are written once, at Create (S.hw), so a chair deleted
   from a set, or copied, would leave the count as it was. At every change each chair line is set from the chairs
   in the design: a felt pad for each leg of a Dining chair (four a chair), banding for the plywood seats as the
   style is now, the upholstery for each padded seat (one staple gun). Two such lines (a chair copied with its own)
   become one. A line taken off the list by hand stays off; with no chair needing it the line goes. */
function chairLinesFollowTheChairs(){
  if(!Array.isArray(S.hw))return;
  const ofChair=p=>(presetOfPiece(p)||{}).name==='Dining chair';
  // (nothing to do, fast, on a design with no chair line on its list and no chair seat: a 5,000 piece fish wall must
  // not be scanned three times at every change; the code review's finding 15)
  const labels=new Set([CHAIR_FELT_LABEL,CHAIR_BANDING_LABEL,...CHAIR_UPHOLSTERY.map(line=>line.label)]);
  if(!S.hw.some(line=>line&&labels.has(line[0]))&&!S.parts.some(p=>p.name==='Plywood seat'||p.name==='Seat cushion'))return;
  const legs=S.parts.filter(p=>(p.name==='Back leg'||p.name==='Front leg')&&ofChair(p)).length;
  const plywood=S.parts.filter(p=>p.name==='Plywood seat'&&ofChair(p));
  const cushions=S.parts.filter(p=>p.name==='Seat cushion'&&ofChair(p)).length;
  // the banding of each plywood seat as it is now (its edges: the outline less the notches), in rolls for them all
  const style=typeof S!=='undefined'&&S.look?S.look.style:'std';
  const feet=plywood.reduce((sum,p)=>{
    const across=size(p)[0],deep=size(p)[2],n=CHAIR_RULES;
    return sum+(across+2*(deep-M[n.leg].w)+(across-2*(n.overhang+M[n.leg].t)))*1.1/12;
  },0);
  const want=new Map([[CHAIR_FELT_LABEL,legs],[CHAIR_BANDING_LABEL,style==='rustic'?0:Math.ceil(feet/CHAIR_BANDING_ROLL-1e-9)]]);
  for(const line of CHAIR_UPHOLSTERY)want.set(line.label,line.once?(cushions?1:0):cushions*line.each);
  // the banding follows the build style too: a plywood seat changed to Everyday after it was made in Rustic gets it
  // (its own label, so the banding of a desk or a fish stand top in the same design is never touched). It comes back
  // only when it was off because of the style (S.chairBandingByStyle, set while the design is Rustic with a plywood
  // seat): a banding line taken off the list by hand stays off (the code review's note 24)
  const bandingListed=S.hw.some(line=>line&&line[0]===CHAIR_BANDING_LABEL);
  if(style==='rustic'&&plywood.length)S.chairBandingByStyle=true;
  else if(bandingListed)delete S.chairBandingByStyle;
  if(want.get(CHAIR_BANDING_LABEL)&&!bandingListed&&S.chairBandingByStyle){
    S.hw=S.hw.concat([[CHAIR_BANDING_LABEL,0]]);
    delete S.chairBandingByStyle;
  }
  for(const[label,count]of want){
    if(!S.hw.some(line=>line&&line[0]===label))continue;
    const at=S.hw.findIndex(line=>line&&line[0]===label);
    const rest=S.hw.filter(line=>!(line&&line[0]===label));
    if(count)rest.splice(at,0,[label,count]);
    S.hw=rest;
  }
}
ON_COMMIT.push(chairLinesFollowTheChairs);
/* The honest paragraph (spec 7.2), for the chair as it is built (a saved chair's corner blocks named when it has
   them) and its seat. */
function chairHonest(plan){
  const blocks=plan.v.blocks;
  const deep=blocks?' The corner blocks under the seat rails make the two corners that work hardest twice as deep.':'';
  const glue='So glue every joint of the frame'+(blocks?' and every corner block':'');
  const seat=plan.seat==='boards'?`The seat is solid boards, screwed down from underneath and not glued, so that each board can swell and shrink with the seasons. ${glue}, never glue the seat`
    :plan.seat==='plywood'?`The seat is one piece of plywood, which does not swell and shrink the way boards do, so it is glued down onto the seat rails and the two seat braces and screwed on from underneath through two seat cleats, and it keeps the seat frame square. ${glue}`
    :`The seat is a padded slip seat, resting on two seat braces and screwed on from underneath through two seat cleats, so it can be taken off to be covered again; its plywood base keeps the seat frame square. ${glue}`;
  const loose=plan.seat==='boards'?' Check the chair after the first few weeks and snug up any pocket screw under the seat that has loosened (those holes are left open for that).':' Check the chair after the first few weeks and snug up the screws under the seat.';
  // what is not worked out with a number (the code review's finding 10: the braces' end screws for a sheet seat)
  const notWorked=['the screws at the ends of the two back rails, which carry the push on the back sideways'];
  if(plan.seat==='boards')notWorked.push('the back seat board between its two end screws (it is counted as lying on the back seat rail)');
  else notWorked.push('the two pocket screws at each end of each seat brace, which carry the brace sideways (the brace itself is checked in bending with a grown person on its middle)');
  return`How this chair holds together. When someone leans back, each side of the chair is pushed out of square, and its four corners hold it: the seat rail and the stretcher where they meet the back leg and the front leg, each glued and held by two pocket screws.${deep} The seat rail is pulled along its length as well, and the stretcher pushed, because nothing at the front feet stops the front legs from turning: the program counts that pull on the rail's screws. That is why the stretchers sit low down, on all four sides: with the seat rail above them they hold every pair of legs at two heights. ${seat}, and never leave out a stretcher${blocks?' or a corner block':''}.${loose} The program checks this chair by rule of thumb, with the loads the European home-chair tests use (a grown person sitting and leaning back, a leg pushed, and the push that tips a chair backward) against what a screw holds in construction pine or spruce in tests, with a margin of 2, counting the screws only and not the glue in the joints. Two things it does not work out with a number, because no sideways value for a screw is on hand: ${notWorked.join(', and ')}. It is not an engineer's calculation or a lab test, and rocking back on two legs will tip and loosen any chair.`;
}
const CHAIR_DRY='Store 2x4s and 2x6s are dried only to about 19% water, and wood indoors settles at about 6% to 9%. Stack the boards indoors, with sticks between them, for a week or two before you cut them. A seat built straight from the store shrinks about 1/8" across each board as it dries, and small gaps open between the seat boards: that does no harm. Boards that have stood indoors for months are drier than a damp summer: lay those with a gap the thickness of a playing card between them, so they have room to swell.';
const CHAIR_GRAIN='Choose the two straightest 2x4s for the back legs, with no knot in the tapered part or where the side rail meets them: on the cutting diagram the two back legs share one 8 ft 2x4, so make that the straightest board you buy. For the seat, choose 2x6s with no loose knots and no splits at the ends; put the best one at the front.';
const CHAIR_NO_GLUE='The seat boards are screwed down from underneath and not glued, to the rails or to each other. Wood swells and shrinks across its width with the seasons, about 1/16" on each board indoors; glue would fight that and push the joints apart. The screws let each board move a little by itself.';
function diningChairNotes(p){
  const plan=diningChairPlan(p),notes=[chairHonest(plan)];
  const lean=plan.lean,worst=lean.frame.worst;
  notes.push(`Leaning back: the European test pushes back with 101 lb, 4" below the top of the back, while someone sits on the chair. On each side of the chair that tries to turn the legs back with about ${Math.round(lean.moment)} in-lb (inch-pounds), shared out among the four corners by how stiff each is, and it pulls the side seat rail along its length with about ${Math.round(lean.frame.pull)} lb. The corner that works hardest is the ${worst.name}: its top screw is pulled with about ${Math.round(worst.pull)} lb, and it is counted to hold ${Math.round(lean.hold)} lb, ${lean.joint.toFixed(2)} times that. That counted value is half of what pulls such a screw out of construction pine on average in tests (about ${Math.round(lean.screw.tested*lean.screw.thread*lean.screw.along)} lb, with ${fmt(lean.screw.thread)} of thread in the leg, as the pocket-hole jig maker's chart gives it). The half covers three things: the test formula is for screws driven into a pilot hole, so it says more than a pocket screw holds; joints made at home vary; and a pocket-screwed joint starts to open at about half the load that breaks it. The European test also pushes the back with 67 lb 25,000 times; for a load that comes back that often each screw is counted at half that again, and the chair holds ${lean.fatigue.toFixed(2)} times it. A heavy person (250 lb) dropping into a chair pushes on the back with about 86 lb, more than that 67 lb: so do not let anyone drop into it. No glue is counted. Pushed at the very top of its back with ${Math.round(plan.tip.backPush)} lb while someone sits on it, the chair holds ${plan.tip.backward.toFixed(2)} times what it takes to tip it backward.`);
  notes.push('Rocking back on the two back legs tips any chair, and it is the hardest thing on its joints.');
  notes.push('Build it in construction pine or spruce (the program starts every chair in it), poplar, pressure-treated pine or red oak. Select pine, cedar and rough-sawn or reclaimed boards are softer or of no known kind and hold a screw less well: Check my design refuses the chair in them.');
  if(plan.seat==='boards'){
    notes.push(CHAIR_DRY,CHAIR_GRAIN,CHAIR_NO_GLUE);
    notes.push(`Seen from above, the seat frame is kept square mostly by the four sides of the chair, each held at two heights by a seat rail and a stretcher, and a little by the middle seat board, which is screwed to each side seat rail with two screws ${fmt(CHAIR_SQUARE.pairApart)} or more apart, so it resists turning on them. The program checks that such a board is there: a rule of thumb, not a number.`);
  }else{
    const sheet=plan.seat==='padded'?'seat base':'plywood seat',load=plan.seatLoad;
    notes.push(CHAIR_GRAIN.replace(/ For the seat,.*$/,''));
    notes.push(`Two seat braces, 2x3s on edge from side seat rail to side seat rail, carry the ${sheet} in the middle, and it is ${plan.seat==='plywood'?'glued down and ':''}screwed on from underneath through two seat cleats, 2x2s glued to the inside of the front and the back seat rail, with screws that stop 1/4" under its top. A grown person standing on the ${sheet} is counted on a 12" wide strip of it across its longest span, ${fmt(r16(load.span))} between its supports: it is at ${Math.round(load.panel*100)}% of the program's limit for plywood, and a brace with the whole person on its middle at ${Math.round(load.brace*100)}% of its limit for lumber.`);
    notes.push(`Seen from above, the seat frame is kept square by the ${sheet}: one stiff sheet screwed to the cleats on the front and the back seat rail, so the front of the frame cannot slide sideways against the back. The program checks that the sheet is screwed to a cleat on each of those rails, with its screws ${fmt(CHAIR_SQUARE.panelApart)} or more apart: a rule of thumb, not a number.`);
    if(plan.seat==='plywood')notes.push('Edges: in the Everyday and Fine furniture styles the edges of the plywood seat that show (the front, both sides and the back between the back legs) get iron-on edge banding, so the layers of the plywood do not show; in Rustic / rough they are rounded over with sandpaper instead.');
    else notes.push(`The padded seat is a slip seat: a 3/4" plywood base with ${fmt(CHAIR_RULES.foam)} of high-density foam glued on, batting over it, and upholstery fabric pulled around it and stapled underneath. It is screwed on from underneath, so it comes off to be covered again. The base is cut ${fmt(plan.panel.room)} short of the back legs at its notches, so the covered seat still fits between them, and it has ${countWord(chairVentHoles(plan).length)} small vent holes so air can leave the foam. The seat height is the top of the cushion as you sit on it: the foam is counted to squash about a quarter of its thickness (${fmt(plan.cushion.squash)}), so the frame is built lower than with a board seat. Cover the seat after the finish on the chair has dried. Common slip seats use a 1/2" base; this one is 3/4" because a grown person standing on a 1/2" base between the braces would bend it past the program's limit for plywood. Use upholstery fabric (not clothing or curtain fabric, which wears through fast).`);
  }
  notes.push(`Stick a felt pad under each foot to protect the floor: ${countWord(CHAIR_FELT_PADS)} self-stick felt pads, 1" round, for each chair are on the shopping list.`);
  notes.push(`The chair stands ${fmt(plan.F)} x ${fmt(plan.D)} on the floor. Bought chairs are often about 22" deep because their back legs sweep back; these stand straight under the back, which keeps them from tipping.`);
  notes.push(`It weighs ${chairWeightWords(plan)}.`);
  if(plan.taper===0)notes.push('With straight back legs the back stands upright (90°). That suits a quick meal and the Rustic / rough style; a back that leans back about 5°, the start in Everyday and Fine furniture, is what dining chairs usually have: untick Straight back legs for it.');
  if(plan.fit)for(const finding of plan.fit)notes.push(finding.level==='warn'?`${finding.text} ${finding.fix}`:finding.text);
  notes.push('Sized by rule of thumb for people sitting on it, with the European home-chair test loads. Rule of thumb, not engineered.');
  return notes;
}

/* The screw heads note (placePreset adds it after the notes): the shared one (HEADS_NOTES in js/showfaces.js) speaks
   of the board seat; a plywood or padded seat is screwed on from underneath in every style. */
function diningChairHeadsNotes(p){
  const plan=diningChairPlan(p);
  // (the chair's own words since the fixes of branch seats, which plug the stretchers' pocket holes too; the shared
  // line of js/showfaces.js is left as it is)
  const plugged='the rails and stretchers have their pocket holes on their inside faces; those of the four stretchers, which show through the open frame, and those on the back of the two back rails are filled with glued pocket-hole plugs and sanded flush';
  if(plan.seat==='boards')return[`Screw heads: in the Everyday and Fine furniture styles none shows on the seat, the front, the sides or the back. The seat boards are held from underneath by pocket screws in the seat rails, and ${plugged}. In Rustic / rough the seat boards are screwed down from above and the pocket holes on the stretchers and the back rails are left open.`];
  const sheet=plan.seat==='padded'?'padded seat':'plywood seat';
  return[`Screw heads: in every style none shows on the seat: the ${sheet} is screwed on from underneath, through the seat cleats. In the Everyday and Fine furniture styles none shows on the front, the sides or the back either: ${plugged}. In Rustic / rough the pocket holes on the stretchers and the back rails are left open.`];
}

/* ---------- the build steps ----------
   Every piece is in exactly one step. The order puts each frame together while every screw of it can still be
   reached, and puts the seat on before the back: the back seat board is lowered between the back legs exactly where
   the back rails stand above it, so lowered after them it would hit the lower back rail. The sentences that tell to
   drill pocket holes are each step's drill field (styledStep, js/style.js): they drop out while step 2 "Drill your
   pieces" holds the holes. The seat step never uses the word glue on its own (only "glued", "not glued"): its
   "You need" must not list wood glue (stepTools reads the word, js/buildsteps.js). A step's `tools` are the tools
   its words name that the program does not work out from the fasteners (stepTools); the words avoid "cut" and
   "level" where no saw and no level are used, since stepTools reads those words too. */
// the Rustic plywood seat's edges, rounded over while it is loose (named, so the shop packet's row that moves it onto
// the part drawing is proved on these very words: SHOP_MOVES, js/shoppacket.js, its `sample`)
const CHAIR_PLYWOOD_ROUND_WORDS='Round over the edges of the plywood seat that show, while it is loose: the front edge with its two rounded corners, both sides, and the back edge between the two notches. Take each top corner down to a round about 1/8" across with 80 grit sandpaper on a block, then sand smooth with 120 grit. The layers of the plywood show on these edges, which suits the rough style.';
function diningChairSteps(p){
  const plan=diningChairPlan(p),R=CHAIR_RULES,upright=plan.taper===0;
  const railTop=fmt(plan.railTop),strUp=fmt(plan.strBottom);
  const steps=[];
  // 1. cut, with the cut on the back legs explained for both legs, and the front edge of the seat
  const frontEdge=` Then the front edge of the seat: of the three 2x6 seat boards, pick the best for the front seat board. On its top face and on one long edge, draw a line ${fmt(R.frontRound)} from the corner along the whole length. Take that corner down to the two lines with a block plane or coarse sandpaper on a block, then sand it round. This is the edge the backs of your legs rest on, and it goes at the front.`;
  const blocks=plan.v.blocks?` The four corner blocks are ${fmt(R.blockLong)} pieces of 2x4: cut their ends square, since each one is glued under a rail and screwed to a leg by one end.`:'';
  const sheet=plan.seat==='padded'?'seat base':'plywood seat';
  const padded=plan.seat==='padded';
  const room=padded?` Its notches are cut ${fmt(plan.panel.room)} wider and deeper than the back legs, so the fabric wrapped round those edges fits between the legs. Drill its ${countWord(chairVentHoles(plan).length)} ${fmt(CHAIR_RULES.ventD)} vent holes where its drawing shows them, so air can leave the foam when someone sits down (without them the seat puffs like a cushion of air).`:'';
  const panelCut=` Cut the ${sheet} from the 3/4" plywood with its good face down (the saw splinters the face that is up), then mark and cut its two notches and round its two front corners as Shapes to cut shows.${room}${padded?' Leave the foam, the batting and the fabric for the end, after the finish.':''}`;
  const seatCut=plan.seat==='boards'?frontEdge:panelCut;
  // (the program adds the line that sends the person to "Shapes to cut" for the back legs, js/shapedrawings.js)
  const cutWords=upright?`${CUT.t}${blocks}${seatCut}`
    :`${CUT.t}${blocks}${seatCut} Each back leg gets one straight cut along its front edge, the cut that makes the back lean: measure ${fmt(plan.BH)} down the front edge from the top and mark it (that mark is level with the top of the seat), and ${fmt(plan.taper)} along the top end from the front corner, draw a straight line between the two marks with a straightedge, and saw on the waste side of it with a circular saw or a jigsaw, starting at the top. Stop the saw about 1/4" short of the mark at the seat end, so it cannot run past it and leave a notch beside the seat, and take the last of it down to the mark with a block plane or sandpaper. Both back legs get exactly the same cut: lay them side by side, cut edges together, to check. They become a left and a right leg only when you build the side frames, so you cannot cut one the wrong way, as long as the cut is on the edge that will face the front.`;
  // the block plane rounds the front seat board and finishes the taper: a plywood or padded seat on straight back
  // legs uses neither (the code review's finding 12: no tool the words do not use)
  const planeUsed=plan.seat==='boards'||!upright;
  steps.push({t:cutWords,add:[],tools:planeUsed?['block plane or coarse sandpaper on a block']:[]});
  // the plywood seat's edges, while it is loose: banded in Everyday and Fine furniture, rounded over in Rustic
  if(plan.seat==='plywood'){
    const band=`Band the edges of the plywood seat that show, while it is loose: the front edge with its two rounded corners, both sides, and the back edge between the two notches (the edges of the notches go against the legs). Set a household iron to cotton with no steam and press the edge banding on, its coated side down, a little at a time, bending it round the rounded corners. Let it cool, then trim the overhang flush with an edge banding trimmer or a sharp chisel, and ease every banded edge and corner with 120 grit sandpaper on a block, so nothing catches. The banding is only about 1/50" thick: when the chair is sanded for its finish, sand the banded edges by hand with 180 grit only, lightly, and do not round them over, or you will sand through it.`;
    // (both are part making, done while the seat is loose: the shop packet moves them onto the part drawing of the
    //  plywood seat, SHOP_MOVES in js/shoppacket.js, and the step, left empty, is dropped from the Build instructions)
    steps.push({...styledStep({std:band,rustic:CHAIR_PLYWOOD_ROUND_WORDS},[]),tools:{std:['120 grit sandpaper on a block'],fine:['120 grit sandpaper on a block'],rustic:['80 and 120 grit sandpaper on a block']}});
  }
  // 2 is "Drill your pieces", put in by the program (js/drillplan.js)
  // 3. the two side frames, flat on the bench (a saved chair's corner blocks glued under its seat rails first)
  const blocks3=plan.v.blocks;
  const seatRow=plan.seat==='boards'?', and the holes along the top edge of that face of each seat rail that will hold the seat boards':'';
  const drillSides=blocks3?` Drill the pocket holes listed below before you start: in both ends of each side seat rail and side stretcher and in the end of each corner block that meets a leg, on the face that will be inside the chair${seatRow}.`
    :` Drill the pocket holes listed below before you start: in both ends of each side seat rail and side stretcher, on the face that will be inside the chair${seatRow}.`;
  const gluedUnder=blocks3?' First glue the corner blocks to the side seat rails: spread glue on the top edge of a corner block, set it under one end of a side seat rail, flush with the end of the rail and with both of its faces, its pocket holes on the same face as the rail\'s, and clamp it there. Do the same at the other end and on the other rail, and let the glue set for an hour. Then':' ';
  const sideFrame=`Build the two side frames, flat on the bench.${'{drill}'}${gluedUnder}${blocks3?' lay':'Lay'} a back leg and a front leg on a flat surface, outside face down, bottom ends lined up, with the ${upright?'front edge':'tapered front edge'} of the back leg toward the front leg. Fit a side seat rail${blocks3?', with its two blocks under it,':''} between them, on edge, flush with the outside faces of the legs and with the top of the front leg: its top edge ${railTop} up from the bottom of both legs. Fit a side stretcher the same way, its underside ${strUp} up. Their drilled faces face up. Spread glue on the ends of the rail${blocks3?', of the blocks':''} and of the stretcher, clamp the frame flat, and drive the pocket screws listed below into the legs. Check each corner with a square. Build the second frame as the mirror image: lay its legs with the other face down, so that when the two frames stand up their drilled faces face each other and both ${upright?'back legs':'tapered edges'} face the front.`.replace('{drill}',drillSides);
  steps.push({...styledStep({std:sideFrame,rustic:sideFrame},['Back leg','Front leg','Side seat rail',...(blocks3?['Corner block']:[]),'Side stretcher'],[drillSides]),
    tools:[blocks3?'two bar clamps (24" or longer), and two small clamps for the corner blocks':'two bar clamps (24" or longer)']});
  // 4. join the side frames with the pieces across
  const panel=!!plan.panel;
  const braceHoles=panel?' and in both ends of each seat brace, on one face,':'';
  const drillAcross=panel?` Drill the pocket holes listed below in both ends of the front and back seat rails and stretchers, on the face that will be inside the chair,${braceHoles} before they go in.`
    :' Drill the pocket holes listed below in both ends of the front and back seat rails and stretchers, on the face that will be inside the chair, and the holes along the top edge of that face of each seat rail that will hold the seat boards, before they go in.';
  const drillAcrossRustic=` Drill the pocket holes listed below in both ends of the front and back seat rails and stretchers, on the face that will be inside the chair,${braceHoles} before they go in.`;
  // the seat cleats and braces of a plywood or padded seat go in with the pieces across, while the chair stands on
  // its feet: the cleats on the front and back seat rails first, while those rails are loose
  const cleats=panel?` First glue a seat cleat to the inside face of the front seat rail and of the back seat rail: spread glue on one face of the cleat, set it with its top flush with the top of the rail and its ends ${fmt(R.braceFromEnd)} in from the ends of the rail, and clamp it while the glue sets (an hour).`:'';
  const braces=panel?` Then fit the two seat braces between the side seat rails, on edge, their tops flush with the tops of the rails, one ${fmt(R.braceFromEnd)} from the back legs and one ${fmt(R.braceFromEnd)} from the front legs (lay a scrap of the plywood across the rails to check that they are flush), and drive their pocket screws into the side seat rails.`:'';
  const join=`Join the two side frames.{drill}${cleats} Stand both frames up on a flat surface, drilled faces toward each other. Fit the front seat rail between the front legs, flush with their front faces and their tops, and the back seat rail between the back legs, flush with their back faces, its top edge ${railTop} up from the floor like the side rails. Fit the front stretcher and the back stretcher the same way, flush with the front and the back faces of the legs, their undersides ${strUp} up. Spread glue on the ends of each and drive the pocket screws listed below into the legs from inside the chair: a helper or a band clamp holds the frames together while you drive. Measure the seat frame corner to corner both ways and push it until the two measurements match, then leave the chair standing on all four feet on the flat surface while the glue sets, so it dries without a twist.${braces}`;
  steps.push({...styledStep({std:join.replace('{drill}',drillAcross),rustic:join.replace('{drill}',drillAcrossRustic)},
    ['Front seat rail','Back seat rail','Front stretcher','Back stretcher',...(panel?['Seat cleat','Seat brace']:[])],{std:[drillAcross],fine:[drillAcross],rustic:[drillAcrossRustic]}),tools:panel?['a band clamp, or a helper','two small clamps for the seat cleats']:['a band clamp, or a helper']});
  // 5. the seat, before the back, one board at a time from the back, with two clamps; never glued
  const loose='The seat boards are screwed only, never glued: not to the rails and not to each other, so each board can swell and shrink by itself.';
  const crown='Before you lay each board, look along its end: if it is cupped (curved across its width), lay it with the crown, the high middle, up.';
  const drillBackBoard=' Drill the pocket hole listed below on the underside of the back seat board at each end, before it goes in.';
  const backBoardIn=`Put the seat on, before the back: the back seat board goes where the back rails will stand above it. ${loose} ${crown} Set the back seat board between the back legs on the back seat rail, flush with the backs of the legs. It should slide in snug; if the legs pinch it, sand a little off one end.`;
  const boardByBoard=(first)=>` Lay the first 2x6 seat board tight against the front faces of the back legs and against the back seat board, ${fmt(R.overhang)} past the side rails at both ends, and clamp its two ends to the side rails. Lay the chair on its back on a blanket and drive its pocket screws listed below up into it from inside the frame. Stand the chair up, move the two clamps to the next board and do the same: the second board tight against the first, then the front seat board, rounded edge forward, tight against the second${first?'':`, ${fmt(R.overhang)} past the front legs`}.`;
  const boardsStd=` Clamp it to the back seat rail, lay the chair on its back on a blanket and drive the pocket screws listed below up into it from the back seat rail, and the one at each end of the board into the legs. Stand the chair up.${boardByBoard(false)} The screws stop short of the seat surface, so nothing shows on it.`;
  const boardsRustic=` Drive the screws listed below down through it into the back seat rail: drill pilot holes and set the heads just below the surface. Lay the chair on its back on a blanket and drive the pocket screw at each end of the board into the legs, from its underside. Stand the chair up. Lay the first and the second 2x6 seat board as in the other styles: each tight against the one behind it, ${fmt(R.overhang)} past the side rails at both ends, clamped with two clamps, and screwed from underneath with the pocket screws listed below, the chair on its back. Then lay the front seat board, rounded edge forward, tight against the second, ${fmt(R.overhang)} past the front legs and the sides, and drive its screws listed below down through it into the front seat rail, with pilot holes, heads just below the surface.`;
  if(!panel)steps.push({...styledStep({std:backBoardIn+drillBackBoard+boardsStd,rustic:backBoardIn+drillBackBoard+boardsRustic},['Back seat board','Seat board','Front seat board'],[drillBackBoard]),tools:['two bar clamps (24" or longer)']});
  // the plywood seat, or the bare base of the padded seat, set on and screwed up through the braces (in every style)
  const onFrame=`its notches round the back legs, flush with the backs of the legs and ${fmt(R.overhang)} past the side rails and the front legs`;
  // the straight screws up through the cleats are driven from under the seat, with the stretcher below: the room
  // for the drill is said, and a short bit or a right-angle attachment named (the code review's finding 16)
  const cleatRoom=r16(plan.railTop-plan.cleatSize-plan.crossTop);
  const shortBit=panel?` There is only about ${fmt(cleatRoom)} between the underside of a cleat and the stretcher below it: use a short screwdriver bit in the drill, or a right-angle attachment.`:'';
  const shortTool=panel?['a short screwdriver bit, or a right-angle attachment for the drill']:[];
  // the plywood seat is glued and screwed down, as plywood chair seats are [25 §8b, §10 item 9]: it does not swell
  // and shrink as boards do (the real-thing review of the seats round, its finding 8)
  // (in Everyday and Fine its edges were banded on its part drawing, on the Cut list page: the warning about sanding
  //  through the banding is said again here, before the sanding of the finish step, where the chair is sanded)
  const plywoodOn=`Put the seat on, before the back: the back of the plywood seat goes between the back legs, where the back rails will stand above it. Set the plywood seat on the frame dry first, good face up, ${onFrame}; it should drop between the back legs snugly (if the legs pinch it, sand a little off the edges of the notches). Lift it off, spread a thin bead of glue along the tops of the four seat rails and of the two seat braces, and set it back in place. Lay the chair on its back on a blanket and drive the screws listed below up through the holes already drilled in each seat cleat into the seat.${shortBit} The screws stop 1/4" under the top of the seat, so nothing shows on it. Wipe off any glue that squeezes out with a damp rag, and stand the chair up.`;
  const bandedEdges=' Its edge banding is only about 1/50" thick: when you sand the chair for its finish, sand the banded edges by hand with 180 grit only, lightly, and leave them square, or you will sand through it.';
  if(plan.seat==='plywood')steps.push({...styledStep({std:plywoodOn+bandedEdges,rustic:plywoodOn},['Plywood seat']),tools:shortTool});
  if(plan.seat==='padded')steps.push({t:`Fit the bare seat base now, before the back: its back part goes between the back legs, where the back rails will stand above it. Set the seat base on the frame, good face down, ${onFrame}, centered between the back legs with the same small gap (about ${fmt(plan.panel.room)}) at each: the fabric fills that gap later. Pencil FRONT on its underside. Lay the chair on its back on a blanket and drive the screws listed below up through the holes already drilled in each seat cleat into the base; they stop 1/4" under its top.${shortBit} Then back the screws out, lift the base off and keep it with the screws: the holes are made, so the finished seat goes back on in exactly this place after it is covered.`,add:['Seat base'],tools:shortTool});
  // 6. the back rails, slid in from behind
  const markFront=upright?`${fmt(plan.lower.front)} from the back face of the leg (1/8" behind its front edge)`
    :`${fmt(plan.lower.front)} for the lower back rail and ${fmt(plan.crest.front)} for the crest rail, from the back face of the leg (1/8" behind the tapered edge)`;
  const drillBack=' Drill the pocket holes listed below in both ends of each back rail, on its back face, before they go in.';
  const back=`Put the back on.${'{drill}'} On the inside face of each back leg mark where the two back rails go: the top edge of the lower back rail ${fmt(plan.lower.top)} up from the bottom of the leg, the top edge of the crest rail flush with the top of the leg (${fmt(plan.crest.top)} up), and the front face of each rail ${markFront}. Spread glue on the ends of each rail, slide it in from behind the chair onto its marks, and drive the pocket screws listed below from the holes in its back face into the legs.`.replace('{drill}',drillBack);
  // (the four stretchers' pocket holes, which show through the open frame, are plugged in the steps that screw them:
  //  their Fasten with lines say so, and those steps list the flush-cut saw, js/buildsteps.js; so they are not
  //  told here a second time)
  const plugs=' Then put a little glue in each pocket hole on the back of the two rails and tap in a pocket-hole plug; when the glue is dry, cut the plugs flush with a flush-cut saw and sand them smooth. The pocket holes under the seat stay open, out of sight, so their screws can be snugged up later.';
  steps.push({...styledStep({std:back+plugs,rustic:back+' The pocket holes stay open on the back of the rails.'},['Lower back rail','Crest rail'],[drillBack]),tools:{std:['flush-cut saw, for the plugs'],fine:['flush-cut saw, for the plugs'],rustic:[]}});
  // 7. even up the feet [25 §8e]
  steps.push({t:'Make the chair sit still. Stand it on a flat surface. If it rocks, press down on one pair of opposite feet and then the other: the pair that rocks is the short pair. Sand or plane the other two feet a little at a time, turning the chair about, until it sits still, and round over the edges of all four feet with sandpaper. If it sits still there but rocks on your floor, the floor is the trouble: do not take anything off the legs (the pads stuck under the feet at the end take up a little of it).',add:[],tools:['sandpaper on a block, or a block plane']});
  // 8. finish, the undersides of the seat boards too, then the felt pads
  steps.push(FIN);
  if(plan.seat==='boards')steps.push({t:'Finish the undersides of the seat boards too: lay the chair on its back on a blanket and brush the same coats on the underside of every seat board, so each board takes up and loses moisture evenly on both faces and stays flat. When the finish is dry, stick felt pads under the feet.',add:[]});
  if(plan.seat==='plywood')steps.push({t:'Finish the underside of the plywood seat too, with the chair on its back on a blanket, so both faces take up and lose moisture alike and the seat stays flat. When the finish is dry, stick felt pads under the feet.',add:[]});
  if(plan.seat==='padded')steps.push(chairUpholsteryStep(plan));
  return steps;
}
/* The padded seat's last step: the upholstery, after the finish on the chair has dried [25 §13]. Written for a
   beginner, the corners above all. Its words never use "glue" or "cut" on their own (stepTools would then list wood
   glue and a saw, js/buildsteps.js): the foam is stuck down with spray adhesive and trimmed with a knife. */
function chairUpholsteryStep(plan){
  const R=CHAIR_RULES,wrap=r16(R.foam+R.cover+plan.panel.t+3);
  const words=`Cover the seat, once the finish on the chair is dry. Work on a clean table. `+
    `1. The foam: lay the seat base on the foam, trace round it with a marker, and trim the foam on the line with a long bread knife or an electric carving knife, held straight up. Outdoors, mist spray adhesive on the top of the base and on one face of the foam, wait a minute, then press the foam down on the base, edges lined up. With the knife, take the bottom edge of the foam off at a slant (about 45°, 1/2" each way) all round, so the fabric rolls it down into a soft rounded edge. `+
    `2. The batting: lay a piece of batting over the foam and trim it so it comes down over the edges of the foam and the base and only just round onto the underside, so it does not bunch where the seat sits on the rails. `+
    `3. The fabric: trim a piece ${fmt(wrap)} larger than the base on every side. Lay it face down on the table, the batting and the base on it, foam side down and centered, with the pattern square to the front. `+
    `4. Staple from the middle of each side outward: bring the fabric over the middle of the back edge and put in three staples about 3/4" in from the edge of the underside. Stretch the front edge snug, firm enough to round the foam but not so hard that the edge dents, and staple its middle; then the middles of the two sides. Work out from each middle toward the corners, a staple about every 1 1/2", smoothing the fabric as you go, and stop about 2" short of each corner. `+
    `5. The two rounded front corners: bring the point of the fabric straight over the corner toward the middle of the seat and staple it. Then fold the fabric on each side of it into two or three small, even folds (pleats), draw each fold down snug and staple it, so the corner is smooth from the top. `+
    `6. The two notches at the back, where the seat goes round the back legs: snip the fabric from its edge straight in to the inside corner of the notch, stopping 1/4" short of the corner, fold each flap down along its side of the notch and staple it underneath. `+
    `7. Trim the fabric and the batting about 1" inside the staples. The back rails now stand over the back of the seat, so it cannot be lowered straight down: hold the covered seat FRONT forward, tilt its back edge down a little, slide it in from the front of the chair, back edge first, under the lower back rail and between the back legs, then lower the front onto the rails. It goes in snug: the base was made ${fmt(plan.panel.room)} short of the legs for the fabric. Lay the chair on its back on a blanket and drive the screws back up through the seat cleats into the holes made before. When that is done, stick felt pads under the feet.`;
  // (the staple gun is listed by the program from the word "staple", js/buildsteps.js stepTools)
  return{t:words,add:['Seat cushion'],tools:['marker, scissors and a long bread knife or an electric carving knife']};
}

/* ---------- what each piece is for, and the fasteners it names (spec section 6 and A.3) ---------- */
const DINING_CHAIR_USES={'Seat board':'seat','Front seat board':'seat','Back seat board':'seat','Side seat rail':'seat','Front seat rail':'seat','Back seat rail':'seat',
  'Plywood seat':'seat','Seat base':'seat','Seat brace':'seat','Seat cleat':'none',
  'Corner block':'none','Side stretcher':'none','Front stretcher':'none','Back stretcher':'none','Lower back rail':'none','Crest rail':'none'};
/* Every frame joint is two pocket screws from the inside face of the rail or stretcher, in every style: a screw
   through the leg would need 5" to reach the rail through 3 1/2" of leg and would end in end grain. (A plain
   'pocket' is kept in every style, as the fish racks' 'Upright','Cross piece' row is; no STYLE_RULES row is needed.)
   Each corner block is glued along its top edge to the underside of its side seat rail (long grain to long grain)
   and has two pocket screws of its own into the leg.
   The seat boards are held from underneath by the side seat rails in every style: a screw driven down into a side
   rail near its end would pass about 1/8" from the rail's own pocket screw into the leg (the chair maker's review),
   so Rustic / rough screws down only the front seat board into the front seat rail and the back seat board into the
   back seat rail. They only rest on the front legs (a screw down into the 1 1/2" end grain of a leg top would meet
   the frame's own pocket screws there), only touch the back legs and each other, and are never glued. The back seat
   board is pocket-screwed into the back legs from its underside in every style. */
const DINING_CHAIR_JOINTS=[
  ['Side seat rail','Back leg','pocket'],['Side seat rail','Front leg','pocket'],
  ['Corner block','Back leg','pocket'],['Corner block','Front leg','pocket'],['Corner block','Side seat rail','glue'],
  ['Front seat rail','Front leg','pocket'],['Back seat rail','Back leg','pocket'],
  ['Side stretcher','Back leg','pocket'],['Side stretcher','Front leg','pocket'],
  ['Front stretcher','Front leg','pocket'],['Back stretcher','Back leg','pocket'],
  ['Lower back rail','Back leg','pocket'],['Crest rail','Back leg','pocket'],
  ['Seat board','Side seat rail','pocket'],['Front seat board','Front seat rail','pocketUnlessRustic'],['Front seat board','Side seat rail','none'],
  ['Back seat board','Back seat rail','pocketUnlessRustic'],['Back seat board','Back leg','pocket'],
  ['Front seat board','Front leg','none'],['Seat board','Back leg','none'],['Front seat board','Seat board','none'],
  ['Seat board','Seat board','none'],['Seat board','Back seat board','none'],
  // the plywood seat and the padded seat's base (stage 3): carried by the two seat braces (each pocket-screwed into
  // both side seat rails), and screwed up from underneath through the two seat cleats in every style: a pocket screw
  // up into 3/4" plywood would leave about 1/8" over its point by the jig maker's chart (reference sheet 27 section
  // 8), under the 1/4" the program keeps, so the screws are straight ones, through a 2x2 cleat (its 1 1/2" and 1/2"
  // into the plywood: a 2" screw leaves 1/4"). Each cleat is glued to the inside of its rail. The sheet rests on the
  // rails, the braces and the front legs and stands against the back legs. The bare plywood seat is GLUED to the four
  // seat rails and the two braces as well, as plywood chair seats are [25 §8b, §10 item 9] (the fixes of branch seats;
  // plywood does not swell and shrink as boards do); the padded seat's base is never glued (it comes off to be
  // covered again)
  ['Seat brace','Side seat rail','pocket'],
  // (each cleat glued face to face to its rail and clamped, like a glue block: screws through it into the rail
  // would cross the screws up into the seat 3/8" apart)
  ['Seat cleat','Front seat rail','glue'],['Seat cleat','Back seat rail','glue'],
  ['Plywood seat','Seat cleat','screw',{through:'Seat cleat'}],['Seat base','Seat cleat','screw',{through:'Seat cleat'}],
  ...['Seat brace','Side seat rail','Front seat rail','Back seat rail'].map(name=>['Plywood seat',name,'glue']),
  ...['Front leg','Back leg'].map(name=>['Plywood seat',name,'none']),
  ...['Seat brace','Side seat rail','Front seat rail','Back seat rail','Front leg','Back leg'].map(name=>['Seat base',name,'none'])];
/* The face of each rail and stretcher that stays out of sight, worked out from the chair's own pieces, not from the
   middle of the whole design (hiddenSide in js/fasteners.js takes that): with several chairs made by Copy in a row,
   or a chair beside the table, the middle of the design moves and some rails would get their pocket holes on their
   outside faces. A seat rail, a corner block or a stretcher faces the middle of its own chair (the pieces of the
   same placement, piece.set, which Copy in a row gives each copy); the two back rails face the back of their own
   chair, along whichever level axis the chair runs front to back (a chair turned a quarter turn to sit at the end
   of the table runs along x): the front is what the sitter and the room see. */
const CHAIR_FRAME_NAMES=['Side seat rail','Front seat rail','Back seat rail','Corner block','Side stretcher','Front stretcher','Back stretcher','Seat brace','Seat cleat'];
const chairBackRail=piece=>piece.name==='Lower back rail'||piece.name==='Crest rail';
let chairMiddleMemo={tick:-1,parts:null,bySet:new Map()};
/* {middle, axis, back}: the middle of the chair of this piece, the level axis it runs front to back along (0 or 2)
   and the side its back is on along that axis (-1 or +1), from its own back legs and front legs */
function chairFrame(piece){
  const tick=typeof designTick==='number'?designTick:0;
  if(chairMiddleMemo.tick!==tick||chairMiddleMemo.parts!==S.parts||chairMiddleMemo.count!==S.parts.length)chairMiddleMemo={tick,parts:S.parts,count:S.parts.length,bySet:new Map()};
  // one chair: the pieces of its placement (piece.set), and of its unit when several chairs were placed together
  // (the chairs of a Dining table, unit 'Dining chair 3', js/chairsets.js)
  const unitOf=p=>typeof p.unit==='string'?p.unit:'';
  const key=piece.set+'|'+unitOf(piece);
  if(!chairMiddleMemo.bySet.has(key)){
    const own=S.parts.filter(p=>p.set===piece.set&&unitOf(p)===unitOf(piece)&&!isProp(p));
    const b=bbox(own.length?own:[piece]),middle=b.lo.map((v,k)=>(v+b.hi[k])/2);
    const centre=name=>{
      const legs=own.filter(p=>p.name===name);
      if(!legs.length)return null;
      const lb=bbox(legs);
      return lb.lo.map((v,k)=>(v+lb.hi[k])/2);
    };
    const back=centre('Back leg'),front=centre('Front leg');
    let axis=2,side=-1;
    if(back&&front){
      axis=Math.abs(back[0]-front[0])>Math.abs(back[2]-front[2])?0:2;
      side=back[axis]<front[axis]?-1:1;
    }
    chairMiddleMemo.bySet.set(key,{middle,axis,back:side});
  }
  return chairMiddleMemo.bySet.get(key);
}
const chairMiddle=piece=>chairFrame(piece).middle;
function diningChairHiddenFace(piece,axis){
  if(axis===1||tilted(piece))return 0;
  if(chairBackRail(piece)){
    const frame=chairFrame(piece);
    return axis===frame.axis?frame.back:0;
  }
  if(!CHAIR_FRAME_NAMES.includes(piece.name))return 0;
  const b=plainBox(piece),middle=chairMiddle(piece)[axis],own=(b.lo[axis]+b.hi[axis])/2;
  if(Math.abs(middle-own)<.01)return 0;
  // a seat brace has its pocket holes on the face toward the nearer legs, out of sight under the seat: the two
  // braces stand 1" apart, and with their holes facing each other the second could not be screwed (both reviews of
  // the seats round). chairBracesFaceInward puts the old layout back for the self-check that shows it failing.
  if(piece.name==='Seat brace'&&!chairBracesFaceInward)return middle>own?-1:1;
  return middle>own?1:-1;
}
let chairBracesFaceInward=false;
/* In Everyday and Fine furniture the pocket holes on the back of the two back rails are filled with glued plugs: the
   back of a dining chair is what the room sees when it is tucked in [25 §11 item 18]. */
/* So are the pocket holes on the inside faces of the four stretchers: seen from in front of and beside the chair at
   knee height, through the open frame (the real-thing review of the seats round, its finding 7; the owner's rule of
   20 Nov: no open pocket hole where a person in the room would see it). The holes under the seat stay open, out of
   sight, so their screws can be snugged up later [25 §7, S46]. */
const CHAIR_STRETCHER_NAMES=['Side stretcher','Front stretcher','Back stretcher'];
const diningChairPlugged=(piece,out,style)=>style!=='rustic'&&(
  (chairBackRail(piece)&&Math.abs(out[chairFrame(piece).axis])>.5)||CHAIR_STRETCHER_NAMES.includes(piece.name));

const DINING_CHAIR_PRESET={
  name:'Dining chair',tile:'Dining chair',spec:'Matches the Dining table',icon:'i-p-chair',
  desc:'A side chair that matches the Dining table: 2x4 legs and seat rails like its aprons, stretchers all round, a seat of 2x6 boards like its top (or plywood, or padded), and a back that leans back about 5°.',
  params:[
    // (why: the reason the form gives with its limit line when a size outside them is typed, readVals in js/app.js)
    {...num('S','Seat height (floor to the top of the seat, or of the cushion as you sit on it; 17 1/2" suits a 30" table)',DINING_CHAIR_DEFAULTS.S,...CHAIR_LIMITS.S),
      inches:true,
      why:'Dining chairs are 17" to 19" high: higher, and the thighs meet the underside of the table\'s apron; lower, and the table top is too high to eat at.'},
    {...num('SW','Seat width (side to side; the length of the seat boards, 4" more than the room between the back legs)',DINING_CHAIR_DEFAULTS.SW,...CHAIR_LIMITS.SW),
      inches:true,
      why:'Narrower, and the back legs stand less than 14" apart, too narrow to sit between; wider, and it is wider than dining chairs are and heavier than a chair should be.'},
    {...num('BH','Back height (top of the seat to the top of the back)',DINING_CHAIR_DEFAULTS.BH,...CHAIR_LIMITS.BH),
      inches:true,
      why:'Lower, and there is no room for the two back rails. The form offers backs up to 15": the top of such a back stands about 2 1/2" above a 30" table top when the chair is tucked in.'},
    // the seat (spec 12 stage 3): one row, solid wood boards to start (the owner: "do solid wood and we can add the
    // others later", then "i dont see the plywood option that can be left or cushion option")
    {k:'seat',label:'Seat',opts:CHAIR_SEAT_KINDS.map(([key,words])=>[key,words]),v:DINING_CHAIR_DEFAULTS.seat},
    // (starts ticked in Rustic / rough, unticked in Everyday and Fine furniture: the owner, 17 Nov. followsDesign:
    // the form does not remember it with the typed sizes unless the person changed it, js/catalog.js readFormBoxes)
    {k:'upright',label:'Straight back legs (no taper cut; the back stands upright)',check:1,followsDesign:true,get v(){return chairUprightByStyle();}},
    {k:'table',label:'Check it against my table',check:1,v:false},
    // the table: the program's own Dining table by its three sizes, or a table the person measured (spec 11, stage
    // 2), each measured box 0 = not measured, with one plain line on how to measure it
    ...under('table',[
      {k:'tableKind',label:'My table is',opts:[['program','The Dining table from this program'],['measured','A table I measured']],v:DINING_CHAIR_DEFAULTS.tableKind},
      ...under('tableKind',[
        num('tL','Table length (the Dining table from this program)',DINING_CHAIR_DEFAULTS.tL,...CHAIR_LIMITS.tL),
        num('tW','Table width',DINING_CHAIR_DEFAULTS.tW,...CHAIR_LIMITS.tW),
        num('tH','Table height',DINING_CHAIR_DEFAULTS.tH,...CHAIR_LIMITS.tH)],kind=>kind!=='measured'),
      ...under('tableKind',[
        {...num('mH','Table top, from the floor (floor to the top of the table; 0 = not measured)',DINING_CHAIR_DEFAULTS.mH,...CHAIR_LIMITS.mH),inches:true},
        {...num('mU','Under the apron, from the floor (floor to the underside of the board under the edge of the top; 0 = not measured)',DINING_CHAIR_DEFAULTS.mU,...CHAIR_LIMITS.mU),inches:true},
        {...num('mSide','Between the legs along a side (inside of one leg to the inside of the next; 0 = not measured)',DINING_CHAIR_DEFAULTS.mSide,...CHAIR_LIMITS.mSide),inches:true},
        {...num('mEnd','Between the legs at an end (inside of one leg to the inside of the other; 0 = not measured)',DINING_CHAIR_DEFAULTS.mEnd,...CHAIR_LIMITS.mEnd),inches:true}],kind=>kind==='measured')])],
  build:buildDiningChair,check:diningChairCheck,info:diningChairInfo,notes:diningChairNotes,steps:diningChairSteps,
  headsNotes:diningChairHeadsNotes,
  recheck:diningChairRecheck,
  // a felt pad under each foot (priced: 'felt-pads' in js/prices.js), the plywood seat's edge banding and the padded
  // seat's upholstery (chairLines; they follow the chairs and the style afterwards, chairLinesFollowTheChairs)
  hw:vals=>chairLines(vals,typeof S!=='undefined'&&S&&S.look&&STYLES[S.look.style]?S.look.style:'std'),
  uses:DINING_CHAIR_USES,joints:DINING_CHAIR_JOINTS,hiddenFace:diningChairHiddenFace,pluggedPockets:diningChairPlugged,
  // Create keeps the build style of the design that is open, so the chair built is the one whose form was shown
  // ("Straight back legs" follows that style; wood and finish start as for every design, js/app.js placePreset)
  get look(){return{style:typeof S!=='undefined'&&S&&S.look&&STYLES[S.look.style]?S.look.style:'std'};},
  // every frame joint is glued, and the pocket screws do not say so themselves (S.glue, js/app.js and js/style.js)
  glue:true,
  // chairs made from this one with Copy in a row are built with its steps, for each chair (js/buildsteps.js)
  copiesShareSteps:true,
  // the structural check also tries these at every limit of the form (spec 10.3): both backs, so both pass in every
  // style (selfTest tries every style), the lowest seat with the tallest back, the largest and the smallest chair
  variants:[{upright:true},{upright:false},{S:17,BH:15},{S:19,BH:15,SW:20},{S:17,SW:18,BH:14},{S:17,BH:15,upright:true},
    // each seat (stage 3) at the default, the smallest and the largest chair, and the lowest seat with the tallest back
    ...['plywood','padded'].flatMap(seat=>[{seat},{seat,S:17,SW:18,BH:14},{seat,S:19,SW:20,BH:15},{seat,S:17,BH:15,upright:true}])],
};
PRESETS.push(DINING_CHAIR_PRESET);

/* ---------- self-checks (spec 10.4) ----------
   They place the chair the way Create does (placeInStyle, js/showfaces.js) without drawing, and put the design back
   afterwards. The least margins found are recorded in SELFTESTS.diningChair, to read after selfTest(). */
const chairPreset=()=>PRESETS.find(preset=>preset.name==='Dining chair');
/* the sizes and choices the checks try: the default (leaning back), every variant and the corners of the form */
function chairTries(){
  const preset=chairPreset(),base={...presetDefaults(preset),upright:false,wood:'pine'};   // (in construction pine, the wood Create makes it in)
  const list=[{},...preset.variants.filter(change=>!change.seat)];
  for(const key of['S','SW','BH'])for(const limit of CHAIR_LIMITS[key])list.push({[key]:limit});
  list.push({S:17,SW:20,BH:15},{S:19,SW:18,BH:14},{S:19,SW:20,BH:14,upright:true});
  // every size and choice with each of the three seats (stage 3)
  return CHAIR_SEAT_KINDS.flatMap(([seat])=>list.map(change=>({...base,...change,seat})));
}
/* a few of them, for the checks that place the chair (each placement lays out every fastener) */
const CHAIR_PLACED_TRIES=[{},{upright:true},{S:17,SW:18,BH:14},{S:19,SW:20,BH:15},{S:17,BH:15}];
/* places the chair at these values in this style in an empty design (the caller puts the design back) */
function placeChair(vals,style){
  const preset=chairPreset();
  load(JSON.stringify(blank()),true);
  return placeInStyle(preset,{...presetDefaults(preset),upright:false,...vals},style);
}
/* a self-check that places chairs: the design is kept and put back, nothing is drawn meanwhile */
const chairChecked=(name,fn)=>function(problems){
  const wrong=text=>{if(problems.length<60)problems.push('dining chair: '+text);};
  const kept=JSON.stringify(S);
  try{withoutDrawing(()=>fn(wrong));}
  catch(e){wrong(`${name} threw ${e.message}`);}
  finally{load(kept,true);}
};
/* is wood glue on the shopping list of the design now? */
const glueListedNow=()=>hardwareTotals(findJoints()).glue;

/* 1. The form opens short: five rows; the three table rows only while "Check it against my table" is ticked. And
   "Straight back legs" starts unticked in Everyday and Fine furniture, ticked in Rustic / rough. */
SELFTESTS.push(function diningChairFormIsShort(problems){
  const wrong=text=>problems.push('dining chair form: '+text);
  if(typeof catalogPick!=='function')return;
  const kept={picked:catalogState.picked,typed:{...catalogState.typed},preset:curPreset,entry:curEntry,style:look().style};
  const shownRows=()=>[...document.querySelectorAll('#presetForm .frow')].filter(row=>!row.hidden&&!row.closest('[hidden]'));
  const box=key=>$(`#presetForm [data-k="${key}"]`),row=key=>box(key)&&box(key).closest('.frow');
  try{
    for(const style of Object.keys(STYLES)){
      look().style=style;
      if(!catalogPick('dining-chair',{fresh:true})){wrong('the dining-chair entry cannot be picked');return;}
      readVals(false);
      const wanted=style==='rustic';
      if(box('upright').checked!==wanted)wrong(`in ${STYLES[style][0]} "Straight back legs" starts ${box('upright').checked?'ticked':'unticked'}; the owner wants it ${wanted?'ticked':'unticked'}`);
      if(presetDefaults(chairPreset()).upright!==wanted)wrong(`the defaults in ${STYLES[style][0]} do not follow the style`);
      if(style!=='std')continue;
      // (six since stage 3: the Seat row, one row of three choices, solid wood boards to start)
      const count=shownRows().length;
      if(count!==6)wrong(`the form opens with ${count} rows, not 6`);
      if(!box('seat')||box('seat').value!=='boards'||box('seat').options.length!==3)wrong('the Seat row is missing, does not start at Solid wood boards, or does not offer the three seats');
      if(shownRows().some(r=>r.classList.contains('sub')))wrong('a row of the table check shows while its box is not ticked');
      // a chair's sizes read in inches, as a chair maker says them: 17 1/2", not 1'-5 1/2" (stage 1 left this), also
      // after the box is left and in the limit line; the table's length stays in feet and inches like the table's form
      if(box('S').value!=='17 1/2"'||box('SW').value!=='18"'||box('BH').value!=='15"')wrong(`the chair's sizes show as ${box('S').value}, ${box('SW').value}, ${box('BH').value}, not in inches`);
      box('S').value='18.5';tidyLengthBox(box('S'));
      if(box('S').value!=='18 1/2"')wrong(`a seat height typed as 18.5 is written ${box('S').value}, not 18 1/2"`);
      box('S').value='17 1/2"';
      if(box('tL').value!=="5'-0\"")wrong(`the table length box shows ${box('tL').value}, not 5'-0" as on the table's own form`);
      box('table').checked=true;readVals(false);
      const measuredKeys=['mH','mU','mSide','mEnd'];
      if(['tableKind','tL','tW','tH'].some(key=>row(key).hidden||!row(key).classList.contains('sub')))wrong('ticking "Check it against my table" does not show My table is and the three sizes of the program\'s table, indented');
      if(measuredKeys.some(key=>!row(key).hidden))wrong('the boxes of a measured table show while the program\'s table is chosen');
      // "A table I measured" (spec 11, stage 2): its four boxes in place of the program's three, each 0 to start
      box('tableKind').value='measured';readVals(false);
      if(measuredKeys.some(key=>row(key).hidden||!row(key).classList.contains('sub'))||['tL','tW','tH'].some(key=>!row(key).hidden))wrong('choosing A table I measured does not show its four boxes in place of the program table\'s three');
      if(measuredKeys.some(key=>parseLen(box(key).value)!==0))wrong('a box of the measured table does not start at 0 (not measured)');
      if(shownRows().length>11)wrong(`with a measured table the form shows ${shownRows().length} rows`);
      box('tableKind').value='program';
      box('table').checked=false;readVals(false);
      if(['tableKind','tL','tW','tH',...measuredKeys].some(key=>!row(key).hidden))wrong('unticking "Check it against my table" leaves its rows showing');
    }
    // a size typed is kept, but a box the person never clicked follows the style the next time (the chair maker's
    // review: typed in Rustic, reopened in Everyday, the box was still ticked); a box clicked is kept
    look().style='rustic';
    catalogPick('dining-chair',{fresh:true});
    box('S').value='18';
    catalogState.typed[catalogState.picked]=readFormBoxes();
    look().style='std';
    catalogPick('dining-chair');
    if(box('upright').checked)wrong('"Straight back legs" stays ticked in Everyday after a size was typed in Rustic, though nobody clicked it');
    if(parseLen(box('S').value)!==18)wrong('the seat height typed was not kept');
    box('upright').checked=true;
    catalogState.typed[catalogState.picked]=readFormBoxes();
    catalogPick('dining-chair');
    if(!box('upright').checked)wrong('"Straight back legs" ticked by hand in Everyday was not kept');
    // the window opened again over the form as it was left, after the style was changed in between (found at the
    // merge with main: the box kept the start of the old style until the tile was clicked again); followDesignBoxes,
    // js/app.js, which openPresets calls. A box ticked by hand is still kept.
    if(typeof followDesignBoxes==='function'){
      look().style='std';
      catalogPick('dining-chair',{fresh:true});
      look().style='rustic';
      followDesignBoxes();
      if(!box('upright').checked)wrong('"Straight back legs" stays unticked when the window is opened again after the style was changed to Rustic');
      look().style='std';
      followDesignBoxes();
      if(box('upright').checked)wrong('"Straight back legs" stays ticked when the window is opened again after the style was changed back to Everyday');
      box('upright').checked=true;
      followDesignBoxes();
      if(!box('upright').checked)wrong('"Straight back legs" ticked by hand is unticked when the window is opened again');
    }else wrong('followDesignBoxes (js/app.js) is missing');
    // Create builds the chair in the style whose box the form showed (the code review: it used to build Everyday)
    const keptDesign=JSON.stringify(S);
    try{
      load(JSON.stringify(blank()),true);
      look().style='rustic';
      const preset=chairPreset(),vals=presetDefaults(preset);
      withoutDrawing(()=>placePreset(preset,vals,preset.build(vals),false));
      if(look().style!=='rustic'||!vals.upright)wrong(`Create with a Rustic design open builds the chair in ${STYLES[look().style][0]}, its box ${vals.upright?'ticked':'unticked'}`);
    }finally{load(keptDesign,true);}
  }finally{
    look().style=kept.style;
    catalogState.picked=kept.picked;catalogState.typed=kept.typed;
    if(kept.preset&&PRESETS.includes(kept.preset))choosePreset(PRESETS.indexOf(kept.preset),kept.entry);else showNoPreset();
  }
});

/* 2. At the default the pieces are the spec's table 5.2 with Amendment A, to 1/16": name, board, size, place; the one
   shape is the cut on the back legs, 15" by 1 5/16" at the top front corner; no plywood, no piece named Seat. */
const CHAIR_SPEC_PIECES=[   // name, board, [x, y, z] size, [x, y, z] place (spec 5.2, A.2), at S 17 1/2, SW 18, BH 15
  ['Back leg','2x4',[1.5,32.5,3.5],[.5,0,0]],['Back leg','2x4',[1.5,32.5,3.5],[16,0,0]],
  ['Front leg','2x4',[1.5,16,3.5],[.5,0,16]],['Front leg','2x4',[1.5,16,3.5],[16,0,16]],
  ['Side seat rail','2x4',[1.5,3.5,12.5],[.5,12.5,3.5]],['Side seat rail','2x4',[1.5,3.5,12.5],[16,12.5,3.5]],
  // (nothing under the side seat rails: branch seats took stage 1's four corner blocks away)
  ['Front seat rail','2x4',[14,3.5,1.5],[2,12.5,18]],['Back seat rail','2x4',[14,3.5,1.5],[2,12.5,0]],
  // (2x4 side stretchers since branch seats: CHAIR_RULES.stretcher; the front and back stretchers 2x3s since its
  // fixes: CHAIR_RULES.crossStretcher)
  ['Side stretcher','2x4',[1.5,3.5,12.5],[.5,3,3.5]],['Side stretcher','2x4',[1.5,3.5,12.5],[16,3,3.5]],
  ['Front stretcher','2x3',[14,2.5,1.5],[2,3,18]],['Back stretcher','2x3',[14,2.5,1.5],[2,3,0]],
  ['Seat board','2x6',[18,1.5,5.5],[0,16,3.5]],['Seat board','2x6',[18,1.5,5.5],[0,16,9]],['Front seat board','2x6',[18,1.5,5.5],[0,16,14.5]],
  ['Back seat board','2x4',[14,1.5,3.5],[2,16,0]],
  ['Lower back rail','1x4',[14,3.5,.75],[2,23,1+13/16]],['Crest rail','1x6',[14,5.5,.75],[2,27,1+5/16]]];
SELFTESTS.push(function diningChairIsTheSpec(problems){
  const wrong=text=>problems.push('dining chair pieces: '+text);
  const parts=buildDiningChair({...presetDefaults(chairPreset()),upright:false});
  const key=(name,mat,s,at)=>[name,mat,...s.map(r16),...at.map(r16)].join('|');
  const built=parts.map(p=>key(p.name,p.mat,size(p),p.pos)).sort(),wanted=CHAIR_SPEC_PIECES.map(row=>key(...row)).sort();
  for(const row of wanted)if(!built.includes(row))wrong(`missing or moved: ${row}`);
  for(const row of built)if(!wanted.includes(row))wrong(`not in the spec: ${row}`);
  if(parts.some(p=>M[p.mat].kind==='sheet'||p.name==='Seat'))wrong('a sheet of plywood or a piece named Seat is built: the seat is solid wood');
  const shaped=parts.filter(p=>p.shape);
  if(shaped.length!==2||shaped.some(p=>p.name!=='Back leg'))wrong('only the two back legs may be shaped');
  for(const leg of shaped.filter(p=>p.name==='Back leg')){
    const cut=leg.shape.corners.find(Boolean);
    if(!cut||cut.cut!=='clip'||r16(cut.a)!==15||r16(cut.b)!==1+5/16)wrong(`the cut on a back leg is ${JSON.stringify(cut)}, not 15" by 1 5/16"`);
  }
  // the other two seats at the default: the same frame, the seat's own pieces (spec 12 stage 3), each to 1/16"
  for(const[seat,rows]of Object.entries(CHAIR_SEAT_SPEC)){
    const built=buildDiningChair({...presetDefaults(chairPreset()),upright:false,seat});
    const frame=CHAIR_SPEC_PIECES.filter(row=>!/seat board/i.test(row[0])).map(row=>{
      // the frame stands higher by what the board seat is thicker than this seat
      // (the seat rails and the tops of the front legs move; the stretchers stay 3" up, the back legs and the back
      // rails stay where the seat height puts them)
      const lift=1.5-(seat==='plywood'?.75:2.5),at=row[3].slice();
      if(/seat rail/i.test(row[0]))at[1]+=lift;
      const s=row[2].slice();
      if(row[0]==='Front leg')s[1]+=lift;
      return[row[0],row[1],s,at];
    });
    const keys=list=>list.map(row=>key(...row)).sort();
    const got=keys(built.map(p=>[p.name,p.mat,size(p),p.pos])),want=keys(frame.concat(rows));
    for(const row of want)if(!got.includes(row))wrong(`${seat}: missing or moved: ${row}`);
    for(const row of got)if(!want.includes(row))wrong(`${seat}: not in the spec: ${row}`);
  }
});
/* The seats of stage 3 at the default (S 17 1/2, SW 18, BH 15), worked by hand: the plywood seat's top at 17 1/2,
   so the frame stands 3/4" higher than with the board seat (rails 13 1/4 to 16 3/4); the padded seat's cushion sat on
   at 17 1/2 (its 2 1/4" squashing 1/2"), so the base is 2 1/2" under that: rails 11 1/2 to 15. The braces from side
   rail to side rail, 4 1/4" in from the legs (z 7 3/4 and 10 1/4); the cleats 4 1/4" in from the inside faces of the
   legs (x 6 1/4 to 11 3/4), on the back face of the front seat rail and the front face of the back seat rail. */
const CHAIR_SEAT_SPEC={
  plywood:[['Seat brace','2x3',[14,2.5,1.5],[2,14.25,7.75]],['Seat brace','2x3',[14,2.5,1.5],[2,14.25,10.25]],
    ['Seat cleat','2x2',[5.5,1.5,1.5],[6.25,15.25,1.5]],['Seat cleat','2x2',[5.5,1.5,1.5],[6.25,15.25,16.5]],
    ['Plywood seat','ply34',[18,.75,20],[0,16.75,0]]],
  padded:[['Seat brace','2x3',[14,2.5,1.5],[2,12.5,7.75]],['Seat brace','2x3',[14,2.5,1.5],[2,12.5,10.25]],
    ['Seat cleat','2x2',[5.5,1.5,1.5],[6.25,13.5,1.5]],['Seat cleat','2x2',[5.5,1.5,1.5],[6.25,13.5,16.5]],
    ['Seat base','ply34',[18,.75,20],[0,15,0]],['Seat cushion','cushion',[18,2.25,20],[0,15.75,0]]]};

/* 3. The back leans: the back rail fronts stand 1/8" behind the cut line at their top edges and inside the leg over
   their height, the back leans 4 1/2 to 6 deg; with Straight back legs it is upright and nothing is shaped. */
SELFTESTS.push(function diningChairLeansBack(problems){
  const wrong=text=>problems.push('dining chair lean: '+text);
  for(const vals of chairTries()){
    const plan=diningChairPlan(vals),what=JSON.stringify({S:vals.S,SW:vals.SW,BH:vals.BH,upright:vals.upright});
    if(plan.problems.length)continue;
    for(const rail of[plan.lower,plan.crest]){
      const gap=plan.frontAt(rail.top)-rail.front;
      if(gap<CHAIR_RULES.reveal-1e-6||gap>CHAIR_RULES.reveal+1/16+1e-6)wrong(`${what}: a back rail stands ${fmt(gap)} behind the leg's front edge at its top, not 1/8"`);
      if(plan.frontAt(rail.bottom)<rail.front-1e-6)wrong(`${what}: a back rail stands forward of the leg`);
    }
    if(vals.upright){
      if(plan.taper!==0||Math.abs(plan.backLeanDeg)>.01)wrong(`${what}: straight back legs still lean`);
      if(buildDiningChair(vals).some(p=>p.shape&&p.name==='Back leg'))wrong(`${what}: straight back legs are still shaped`);
    }else if(plan.backLeanDeg<4.5||plan.backLeanDeg>6||plan.cutLeanDeg<4.5||plan.cutLeanDeg>6)wrong(`${what}: the back leans ${plan.backLeanDeg.toFixed(1)} deg (the cut ${plan.cutLeanDeg.toFixed(1)}), not about 5`);
  }
});

/* 4. to 7. At every size and choice: built clean (no stop, no warn) by its own check and the structural check; the
   lean (DC4), the tip (DC6, DC7), the seat (DC3) inside their limits with the factors wanted; every leg plane held at
   two heights 8" or more apart (DC5); the back feet behind every back rail (DC8); the weight of a chair and 14" or
   more between the back legs (DC12, DC17); the depth a body feels 16" to 18" (DC18). The least margins are kept. */
SELFTESTS.push(function diningChairStandsAtEveryLimit(problems){
  const wrong=text=>problems.push('dining chair strength: '+text);
  const R=CHAIR_RULES,least={joint:Infinity,fatigue:Infinity,stretcher:Infinity,backward:Infinity,forward:Infinity,sideways:Infinity,rock:Infinity,legPush:Infinity},
    most={leg:0,crest:0,seat:0,legBend:0,glue:0},weight=[Infinity,0],at={};
  const preset=chairPreset();
  for(const vals of chairTries()){
    const what=JSON.stringify({S:vals.S,SW:vals.SW,BH:vals.BH,upright:vals.upright});
    const plan=diningChairPlan(vals);
    const check=checkPreset(preset,vals);
    if(check.problems.length)wrong(`${what}: ${check.problems.map(f=>f.level+' '+f.text).join(' / ')}`);
    const lean=plan.lean;
    const found={joint:lean.joint,fatigue:lean.fatigue,stretcher:lean.stretcher,rock:lean.rock,legPush:lean.legPushLeast,backward:plan.tip.backward,forward:plan.tip.forward,sideways:plan.tip.sideways};
    for(const[key,value]of Object.entries(found))if(value<least[key]){least[key]=value;at[key]=what;}
    for(const[key,value]of Object.entries({leg:lean.leg,crest:lean.crest,seat:plan.seatLoad.worst,legBend:lean.legBendMost,glue:lean.glue}))if(value>most[key]){most[key]=value;at[key]=what;}
    // the side of the chair is a frame with no diagonal: its four corners together carry the whole moment of the
    // push (the code review's finding 1: a model that lets the rail's pull alone hold it cannot be in balance)
    const shared=lean.frame.corners.reduce((sum,corner)=>sum+corner.moment,0);
    if(Math.abs(shared-lean.moment)>.001*lean.moment)wrong(`${what}: the four corners carry ${Math.round(shared)} in-lb of the ${Math.round(lean.moment)} the push puts on a side`);
    // the front leg is in balance: nothing at its foot turns it, so the rail's pull times the height between the
    // rail and the stretcher equals the two front corner moments, and that pull is counted on the rail's top screw
    // (the code review of the seats round, its finding 1: a model without it left the rail screws ~25% light)
    for(const frame of[lean.frame,lean.fatigueFrame]){
      const front=frame.corners.filter(c=>c.at==='front').reduce((sum,c)=>sum+c.moment,0);
      if(!(frame.pull>0)||Math.abs(frame.pull*frame.lever-front)>.001*front)wrong(`${what}: the front leg is not in balance (rail pull ${frame.pull} x ${frame.lever} against ${front.toFixed(1)} in-lb)`);
      for(const corner of frame.corners.filter(c=>c.kind==='rail')){
        const wanted=(corner.moment+frame.pull*corner.pullAt)*corner.far/corner.stiff;
        if(Math.abs(corner.pull-wanted)>.01||corner.pull<=corner.moment*corner.far/corner.stiff)wrong(`${what}: the rail's pull is not counted on the ${corner.name}`);
      }
    }
    // DC5 for the front plane too: the front seat rail and the 2x3 front stretcher 8" or more apart
    const frontApart=(plan.railTop+plan.railBottom)/2-(plan.strBottom+plan.crossDeep/2);
    if(frontApart<R.planeLeast)wrong(`${what}: the front seat rail and the front stretcher are only ${fmt(frontApart)} apart`);
    if(Math.abs(lean.moment-lean.F*(plan.S+plan.BH-R.leanBelowTop))>.01)wrong(`${what}: the moment of the push is not half of 450 N times its height`);
    // the screw counted along the rail: the test average pull-out with the one margin of 2, 1 1/4" of thread by the
    // jig maker's chart (reference sheet 27 section 1c), cos 15 deg (branch seats, reference sheet 25 sections 15 and
    // 16; the code review's finding 3 for the angle), and the old basis (the building code's design value over the
    // drawn 1") kept beside it only for the record. The thread counted is never more than the chart gives.
    if(Math.abs(lean.screw.perScrew-15700/2*.42*.42*.164*1.25*Math.cos(15*Math.PI/180))>.05)wrong(`${what}: a pocket screw is counted at ${lean.screw.perScrew.toFixed(1)} lb, not 15,700 / 2 x 0.42^2 x 0.164 x 1 1/4" x cos 15 deg`);
    if(lean.screw.thread>2.5-1.25+1e-9)wrong(`${what}: ${fmt(lean.screw.thread)} of thread is counted in the leg, more than the jig maker's chart gives (1 1/4")`);
    if(Math.abs(lean.screw.ndsPerScrew-2850*.42*.42*.164*Math.cos(15*Math.PI/180))>.05)wrong(`${what}: the old basis is not the NDS design value`);
    for(const corner of lean.frame.corners)if(corner.factor<lean.joint-1e-9)wrong(`${what}: the worst corner is not the one that decides`);
    weight[0]=Math.min(weight[0],plan.weight.pounds);weight[1]=Math.max(weight[1],plan.weight.pounds);
    // DC12: the weight is said in the remark, and over what the heaviest bought chairs weigh, it says so
    const info=diningChairInfo(vals);
    if(!info.includes(`about ${Math.round(plan.weight.pounds)} lb`))wrong(`${what}: the remark does not give the weight`);
    if(plan.weight.pounds>R.heavyLb&&!/heaviest bought dining chairs/.test(info))wrong(`${what}: about ${plan.weight.pounds.toFixed(1)} lb and the remark does not say it is heavier than the heaviest bought chairs`);
    if(/\d'-/.test(info))wrong(`${what}: the remark gives a chair size in feet and inches`);
    if(plan.betweenBackLegs<R.backLegsApartLeast-1e-9)wrong(`${what}: only ${fmt(plan.betweenBackLegs)} between the back legs`);
    if(plan.feltDepth<R.feltDepth[0]||plan.feltDepth>R.feltDepth[1])wrong(`${what}: ${fmt(plan.feltDepth)} from the seat front to the back rest`);
    if(plan.openUnder<R.openUnder[0]||plan.openUnder>R.openUnder[1]||plan.railGap<R.railGapLeast-1e-9||plan.topDepth<R.topLeast)wrong(`${what}: the back rails do not fit their legs`);
    // DC5: each plane of legs held by its seat rail and its stretcher, their middles 8" or more apart
    const apart=(plan.railTop+plan.railBottom)/2-(plan.strTop+plan.strBottom)/2;
    if(apart<R.planeLeast)wrong(`${what}: the seat rails and the stretchers are only ${fmt(apart)} apart`);
    const parts=buildDiningChair(vals);
    for(const[railName,stretcherName]of[['Side seat rail','Side stretcher'],['Front seat rail','Front stretcher'],['Back seat rail','Back stretcher']]){
      const rails=parts.filter(p=>p.name===railName).length,stretchers=parts.filter(p=>p.name===stretcherName).length;
      if(!rails||rails!==stretchers)wrong(`${what}: a ${railName.toLowerCase()} has no ${stretcherName.toLowerCase()} under it`);
    }
    // each side of the chair: ONE side seat rail of the stated board (a 2x4 on edge, 3 1/2" deep), from leg to leg,
    // nothing glued under it (sideRailIsOneBoard) and no corner block (those are built only for a chair saved before
    // the seat choice, diningChairOpensAsSaved)
    const side=sideRailIsOneBoard(parts);
    if(side)wrong(`${what}: ${side}`);
    // DC8: the back feet behind every back rail
    const backOf=name=>Math.min(...parts.filter(p=>p.name===name).map(p=>p.pos[2]));
    if(backOf('Back leg')>Math.min(backOf('Lower back rail'),backOf('Crest rail'))+1e-9)wrong(`${what}: a back rail stands behind the back feet`);
  }
  // the factors wanted (spec 10.4 item 4): DC4 (b), (d), (f), (g) and DC6 at 1.1 or more; the bending shares (a),
  // (c), DC3, the legs pushed and the corner blocks' glue line at 1 or less; DC7 at 5 or more
  if(least.joint<R.leanWanted)wrong(`leaning back, the corner that works hardest holds only ${least.joint.toFixed(2)} times its pull, at ${at.joint}`);
  if(least.fatigue<R.leanWanted)wrong(`leaning back again and again (the repeated test), the corner that works hardest holds only ${least.fatigue.toFixed(2)} times its pull, at ${at.fatigue}`);
  if(least.stretcher<R.leanWanted)wrong(`pulled out by its back, a corner holds only ${least.stretcher.toFixed(2)} times, at ${at.stretcher}`);
  if(least.rock<R.leanWanted)wrong(`rocked back on its back legs again and again, a corner holds only ${least.rock.toFixed(2)} times, at ${at.rock}`);
  if(least.legPush<R.leanWanted)wrong(`a front leg pushed at its foot: its stretcher holds only ${least.legPush.toFixed(2)} times, at ${at.legPush}`);
  if(least.backward<R.leanWanted)wrong(`it tips backward at ${least.backward.toFixed(2)}, at ${at.backward}`);
  if(least.forward<5||least.sideways<5)wrong(`it tips forward or sideways too easily (${least.forward.toFixed(1)}, ${least.sideways.toFixed(1)})`);
  for(const key of['leg','crest','seat','legBend','glue'])if(most[key]>1)wrong(`the ${key} is past its limit (${most[key].toFixed(2)}), at ${at[key]}`);
  // the code review's hand number at the default: 1,441 in-lb on a side from the push
  const usual=diningChairPlan(chairTries()[0]);
  if(Math.abs(usual.lean.moment-1441.5)>1)wrong(`the push puts ${usual.lean.moment.toFixed(1)} in-lb on a side at the default, not about 1,441 as worked by hand`);
  // the default chair by hand (the fixes of branch seats, reference sheet 25 section 16): rail pull 75.9 lb, static
  // 1.62, repeated 1.22
  if(Math.abs(usual.lean.frame.pull-75.9)>.2||Math.abs(usual.lean.joint-1.622)>.005||Math.abs(usual.lean.fatigue-1.216)>.005)wrong(`at the default the rail pull is ${usual.lean.frame.pull.toFixed(1)} lb and the lean scores ${usual.lean.joint.toFixed(3)} / ${usual.lean.fatigue.toFixed(3)}, not 75.9, 1.622 and 1.216 as worked by hand`);
  SELFTESTS.diningChair={...(SELFTESTS.diningChair||{}),leanJoint:+least.joint.toFixed(3),leanJointAt:at.joint,defaultLean:+usual.lean.joint.toFixed(3),railPull:+usual.lean.frame.pull.toFixed(1),
    defaultLeanOldBasis:+usual.lean.oldJoint.toFixed(3),leanFatigue:+least.fatigue.toFixed(3),leanFatigueAt:at.fatigue,defaultFatigue:+usual.lean.fatigue.toFixed(3),
    pullOut:+least.stretcher.toFixed(2),rockingBack:+least.rock.toFixed(2),legPush:+least.legPush.toFixed(2),legPushAt:at.legPush,
    tipBackward:+least.backward.toFixed(3),tipBackwardAt:at.backward,defaultTip:+usual.tip.backward.toFixed(3),tipForward:+least.forward.toFixed(2),tipSideways:+least.sideways.toFixed(2),
    legShare:+most.leg.toFixed(3),crestShare:+most.crest.toFixed(3),crestAt:at.crest,seatShare:+most.seat.toFixed(3),seatAt:at.seat,legBend:+most.legBend.toFixed(3),
    glueShare:+most.glue.toFixed(3),pounds:[+weight[0].toFixed(2),+weight[1].toFixed(2)]};
});

/* In every wood the program offers: the chair holds with the margin wanted, or the check refuses it with the wood
   named and woods that hold given as the fix (the code review's finding 2: the screw value was that of construction
   pine whatever wood was picked); Check my design says so for a chair changed to a soft wood after it was made. */
SELFTESTS.push(function diningChairWoods(problems){
  const wrong=text=>problems.push('dining chair woods: '+text);
  for(const vals of chairTries()){
    for(const wood of Object.keys(WOODS)){
      const plan=diningChairPlan({...vals,wood}),stop=plan.problems.find(f=>f.level==='stop'&&f.code==='chair-lean');
      const holds=plan.lean.leanLeast>=CHAIR_RULES.leanWanted&&plan.lean.legPushLeast>=CHAIR_RULES.leanWanted&&plan.lean.stretcher>=CHAIR_RULES.leanWanted;
      if(holds&&plan.problems.some(f=>f.code==='chair-lean'))wrong(`${wood}: refused although it holds`);
      if(!holds&&!plan.problems.some(f=>f.code==='chair-lean'))wrong(`${wood} at ${JSON.stringify({S:vals.S,SW:vals.SW,BH:vals.BH})}: holds only ${plan.lean.leanLeast.toFixed(2)} and nothing is said`);
      if(stop&&!stop.text.includes(chairWoodName(wood)))wrong(`${wood}: the refusal does not name the wood`);
      if(stop){
        const named=Object.keys(WOODS).filter(other=>stop.fix.includes(chairWoodName(other)));
        if(!named.length||named.some(other=>diningChairPlan({...vals,wood:other}).problems.some(f=>f.code==='chair-lean')))wrong(`${wood}: the woods offered as the fix do not hold either`);
      }
    }
  }
  chairChecked('woods',fail=>{
    placeChair({},'std');
    look().wood='cedar';
    if(!keptWarnings().some(f=>f.level==='stop'&&/cedar/.test(f.text)))fail('Check my design does not refuse a chair changed to cedar');
    look().wood='pine';
    if(keptWarnings().some(f=>f.code==='recheck'))fail('Check my design refuses the chair in construction pine');
  })(problems);
});

/* Each stop of the chair's own check fires when its rule is pushed past its limit, with its words, and the fix it
   offers clears it (the code review's finding 8: inside the form's limits no input reaches them). The rules are put
   back afterwards. */
SELFTESTS.push(function diningChairStopsFire(problems){
  const wrong=text=>problems.push('dining chair stops: '+text);
  const R=CHAIR_RULES,base={...chairTries()[0]};
  const tryRule=(label,change,vals,code,words,fixed)=>{
    const kept={};
    for(const key of Object.keys(change)){kept[key]=R[key];R[key]=change[key];}
    chairPlanMemo.clear();
    try{
      const found=diningChairPlan(vals).problems.find(f=>f.code===code&&f.level==='stop');
      if(!found){wrong(`${label}: no stop`);return;}
      if(!words.test(found.text))wrong(`${label}: the stop says "${found.text}"`);
      if(/undefined|NaN|\d'-/.test(found.text+found.fix))wrong(`${label}: "${found.text} ${found.fix}"`);
      const after=fixed(found.fix);
      if(!after)wrong(`${label}: the fix "${found.fix}" names nothing to change`);
      else if(diningChairPlan({...vals,...after}).problems.some(f=>f.code===code&&f.level==='stop'))wrong(`${label}: the fix "${found.fix}" does not clear it`);
    }finally{
      Object.assign(R,kept);
      chairPlanMemo.clear();
    }
  };
  const inches=(fix,word)=>{
    const m=fix.match(new RegExp(word+' ([0-9][0-9 /]*)"'));
    return m?parseLen(m[1]+'"'):null;
  };
  // DC4: a heavier push than the test's, which a lower back still holds
  // (1.65 times since the fixes of branch seats, where the rail's pull is counted and the screw has the chart's
  // 1 1/4" of thread: the chair holds 1.62 at the default, 1.69 with the back 14" tall)
  tryRule('leaning back',{leanN:450*1.65},base,'chair-lean',/leaning back/i,fix=>{const BH=inches(fix,'back');return BH?{BH}:null;});
  // DC4, the repeated lean: the 2x3 stretchers of before branch seats hold the static push but not the repeated one
  // at the default, and a lower back clears it
  {
    const kept=R.stretcher;R.stretcher='2x3';chairPlanMemo.clear();
    try{
      const lean=diningChairPlan(base).lean;
      if(!(lean.joint>=R.leanStop&&lean.fatigue<R.leanStop))wrong(`the repeated lean with 2x3 stretchers: static ${lean.joint.toFixed(2)}, repeated ${lean.fatigue.toFixed(2)}, not passing and failing`);
    }finally{R.stretcher=kept;chairPlanMemo.clear();}
  }
  tryRule('leaning back again and again, 2x3 stretchers',{stretcher:'2x3'},base,'chair-lean',/leaning back/i,fix=>{const BH=inches(fix,'back');return BH?{BH}:null;});
  // DC4 in a soft wood: the woods named hold
  tryRule('leaning back in cedar',{},{...base,wood:'cedar'},'chair-lean',/cedar/,fix=>/construction pine/.test(fix)?{wood:'pine'}:null);
  // DC3: a heavier person, so that the widest seat bends too far and a narrower one does not
  tryRule('a seat board',{seatN:1300*1.6},{...base,SW:20},'chair-seat',/seat board/,fix=>{const SW=inches(fix,'seat');return SW?{SW}:null;});
  // DC3 for a plywood seat (the code review's finding 9: these two stops never fired, and the plywood's fix, a
  // narrower seat, could not clear it): a heavier person bends the plywood (0.88 of its limit at every width), a
  // 2x2 brace in place of the 2x3 bends the brace; the board seat clears both
  tryRule('the plywood seat',{seatN:1300*1.2},{...base,seat:'plywood'},'chair-seat',/plywood seat would bend/,fix=>/Solid wood boards/.test(fix)?{seat:'boards'}:null);
  tryRule('a seat brace',{brace:'2x2'},{...base,seat:'padded'},'chair-seat',/seat brace would bend/,fix=>/Solid wood boards/.test(fix)?{seat:'boards'}:null);
  // DC10: more wood wanted at the top of the leg than the taper leaves: straight back legs clear it
  tryRule('the top of the back leg',{topLeast:2.5},base,'chair-top',/top of each back leg/,fix=>/Straight back legs/.test(fix)?{upright:true}:null);
  // DC6: a lighter person on the seat, so that the tip is under 1 at the tallest back and over it lower
  // (0.64 since branch seats: the chair's weight changed with the blocks gone and 2x4 stretchers, 0.99 at the tallest
  // back and 1.02 at the lowest)
  tryRule('tipping backward',{tipSeatLb:135*.64},{...base,S:19},'chair-tip',/tip over backward/,fix=>{const BH=inches(fix,'back');return BH?{BH}:null;});
});

/* 8. Show faces: in Everyday and Fine no head or open pocket hole on the top, the front, the sides or the back
   (SHOW_FACES_OF in js/showfaces.js), also with three chairs made by Copy in a row and with a chair set at the front
   of a Dining table facing it; every pocket hole of every chair on the inside face of its rail or stretcher. In
   Rustic only the screws down through the seat and the pocket holes on the back of the back rails show. */
SELFTESTS.push(function diningChairShowFaces(problems){
  chairChecked('show faces',wrong=>{
    const preset=chairPreset(),chairVals={...presetDefaults(preset),upright:false};
    const insideFaces=label=>{
      for(const link of connGraph().links)for(const f of fastenersOfLink(link)){
        if(f.kind!=='pocket'||!CHAIR_FRAME_NAMES.includes(f.through.name))continue;
        const k=[0,2].find(axis=>Math.abs(f.pocket.out[axis])>.5);
        if(k===undefined)continue;
        const own=bbox(S.parts.filter(p=>p.set===f.through.set)),face=plainBox(f.through);
        const middle=(own.lo[k]+own.hi[k])/2,centre=(face.lo[k]+face.hi[k])/2;
        // (a seat brace, under the seat, has its holes on the face toward the nearer legs, away from the other brace)
        if(f.through.name==='Seat brace'){
          if(Math.sign(middle-centre)!==-Math.sign(f.pocket.out[k])){wrong(`${label}: a pocket hole of a seat brace faces the other brace`);return;}
          continue;
        }
        if(Math.sign(middle-centre)!==Math.sign(f.pocket.out[k])){wrong(`${label}: a pocket hole of a ${f.through.name.toLowerCase()} is on its outside face`);return;}
      }
    };
    const heads=label=>{
      const showing=headsOnShowFaces();
      if(showing.length)wrong(`${label}: ${showing.length} heads or open pocket holes show (${showing[0].face}, ${showing[0].f.through.name} into ${showing[0].f.into.name})`);
    };
    for(const style of['std','fine']){
      for(const vals of[{},{upright:true},{seat:'plywood'},{seat:'padded'},{seat:'padded',upright:true}]){
        placeChair(vals,style);
        heads(`${STYLES[style][0]} ${JSON.stringify(vals)}`);
        insideFaces(`${STYLES[style][0]} ${JSON.stringify(vals)}`);
        // the stretchers' pocket holes, seen through the open frame from in front and beside, are plugged (the
        // real-thing review of the seats round, its finding 7)
        const open=connGraph().links.flatMap(fastenersOfLink).filter(f=>f.kind==='pocket'&&CHAIR_STRETCHER_NAMES.includes(f.through.name)&&!f.pocket.plugged);
        if(open.length)wrong(`${STYLES[style][0]} ${JSON.stringify(vals)}: ${open.length} pocket holes of the stretchers are left open in sight`);
      }
      // three chairs in a row, made the way Copy in a row makes them (js/copies.js)
      placeChair({},style);
      const sources=S.parts.slice();
      for(const k of[1,2]){
        const clones=sources.map(p=>({...JSON.parse(JSON.stringify(p)),pos:[p.pos[0]+k*22,p.pos[1],p.pos[2]]}));
        addCopies(sources,clones);
      }
      commit();
      if(new Set(S.parts.map(p=>p.set)).size!==3)wrong('Copy in a row does not give each chair its own placement');
      heads(`three chairs in a row, ${STYLES[style][0]}`);
      insideFaces(`three chairs in a row, ${STYLES[style][0]}`);
      // a chair at the front of the default Dining table, facing it, its seat front under the apron
      const table=PRESETS.find(p=>p.name==='Dining table');
      load(JSON.stringify(blank()),true);
      placePreset(table,presetDefaults(table),table.build(presetDefaults(table)),false);
      const chairParts=preset.build(chairVals);
      placePreset(preset,chairVals,chairParts,true);
      const shiftX=21-chairParts[0].pos[0];
      chairParts.forEach(p=>{p.pos=[p.pos[0]+shiftX,p.pos[1],p.pos[2]-18];});
      look().style=style;commit();
      heads(`a chair at the table, ${STYLES[style][0]}`);
      insideFaces(`a chair at the table, ${STYLES[style][0]}`);
      // a chair turned a quarter turn to sit at the end of the table, facing it (the chair maker's review: its back
      // rails' pocket holes came out on the front, open), with R Z 90 as a person turns it (applyRot, js/transform.js)
      const endChair=preset.build(chairVals);
      placePreset(preset,chairVals,endChair,true);
      sel.clear();endChair.forEach(p=>sel.add(p.id));
      applyRot(snapshot(),1,-Math.PI/2,selCenter());finishRot(true);
      const turned=bbox(endChair),tableBox=bbox(S.parts.filter(p=>p.name==='Leg'));
      const moveBy=[tableBox.hi[0]-12-turned.lo[0],0,(tableBox.lo[2]+tableBox.hi[2])/2-(turned.lo[2]+turned.hi[2])/2];
      endChair.forEach(p=>{p.pos=p.pos.map((v,k)=>r16(v+moveBy[k]));});
      sel.clear();look().style=style;commit();
      if(endChair.some(p=>p.q||p.rot))wrong('a chair turned a quarter turn is not square-set');
      if(chairFrame(endChair.find(p=>p.name==='Crest rail')).axis!==0)wrong('a chair turned a quarter turn does not run front to back along x');
      if(findClashes().length)wrong(`a chair at the end of the table runs into something (${findClashes().length})`);
      heads(`a chair turned to sit at the end of the table, ${STYLES[style][0]}`);
      insideFaces(`a chair turned to sit at the end of the table, ${STYLES[style][0]}`);
      for(const link of connGraph().links)for(const f of fastenersOfLink(link)){
        if(f.kind!=='pocket'||!chairBackRail(f.through)||!endChair.includes(f.through))continue;
        const frame=chairFrame(f.through);
        if(Math.sign(f.pocket.out[frame.axis])!==frame.back||!f.pocket.plugged){wrong(`a chair turned to the end of the table has a pocket hole of its ${f.through.name.toLowerCase()} open or on the front`);break;}
      }
    }
    placeChair({},'rustic');
    const odd=headsOnShowFaces().filter(head=>!(head.f.kind!=='pocket'&&/seat board/i.test(head.f.through.name))&&!(head.f.kind==='pocket'&&chairBackRail(head.f.through)));
    if(odd.length)wrong(`Rustic: a head shows on ${odd[0].f.through.name} into ${odd[0].f.into.name} (${odd[0].face})`);
    if(!['Front seat board','Back seat board'].every(name=>headsOnShowFaces().some(head=>head.f.through.name===name)))wrong('Rustic: the front seat board and the back seat board are not screwed down from above');
    // a plywood or padded seat is screwed on from underneath in Rustic too: only the back rails' pocket holes show
    for(const seat of['plywood','padded']){
      placeChair({seat},'rustic');
      const shown=headsOnShowFaces().filter(head=>!(head.f.kind==='pocket'&&chairBackRail(head.f.through)));
      if(shown.length)wrong(`Rustic, ${seat} seat: a head shows on ${shown[0].f.through.name} into ${shown[0].f.into.name} (${shown[0].face})`);
    }
  })(problems);
});

/* 9. and 12. Every fastener in the wood and drivable (fastenerFault), none too near another (fastenersTooClose), none
   within 3/8" of the cut on the back legs, 1/4" or more of seat board over every screw driven up into the seat; the
   seat loose: no glue, dowel or nail at any joint of a seat board, every Seat board held near both ends, the back
   seat board with one pocket screw at each end and none under the back seat rail, no screw into a front leg top, the
   boards 2x6, three, tight. In all three styles, at the default, both backs and the corners of the form. The seat's
   screws at the default in Everyday are counted against spec A.3. */
SELFTESTS.push(function diningChairScrewsClear(problems){
  chairChecked('screws',wrong=>{
    const R=CHAIR_RULES,counts={};
    const isSeat=name=>/seat board|^plywood seat$|^seat base$/i.test(name);
    for(const style of Object.keys(STYLES))for(const[seat]of CHAIR_SEAT_KINDS){
      for(const base of CHAIR_PLACED_TRIES){
        const change={...base,seat};
        if(!placeChair(change,style)){wrong(`${JSON.stringify(change)} builds nothing`);continue;}
        const label=`${STYLES[style][0]} ${JSON.stringify(change)}`,plan=diningChairPlan(S.sets[1].vals);
        for(const link of connGraph().links){
          const seatJoint=[link.a.name,link.b.name].some(isSeat);
          // (the board seat and the padded seat's base are never glued; the bare plywood seat is glued to its rails and
          // braces only, as plywood seats are [25 §8b]: never to a leg)
          const plywoodGlued=seat==='plywood'&&[link.a.name,link.b.name].includes('Plywood seat')&&[link.a.name,link.b.name].some(name=>/seat rail$|^Seat brace$/.test(name))&&link.type==='glue';
          if(seatJoint&&!plywoodGlued&&link.joint&&(glueFilm(link.joint,link.type)||['glue','dowel','nail'].includes(link.type)))wrong(`${label}: ${link.a.name} to ${link.b.name} is ${link.type}: the seat is never glued there`);
          if(seatJoint&&link.fastened&&[link.a.name,link.b.name].includes('Front leg'))wrong(`${label}: a seat board is fastened into a front leg top`);
          for(const f of fastenersOfLink(link)){
            const fault=fastenerFault(f);
            if(fault){wrong(`${label}: ${f.through.name} into ${f.into.name}: ${fault}`);continue;}
            const point=pointPlus(f.pos,f.dir,f.len);
            // the cut on the back legs: every screw in a back leg stays 3/8" behind the leg's front edge
            for(const piece of[f.through,f.into]){
              if(piece.name!=='Back leg'||!plan.taper)continue;
              for(const spot of[f.pos,point]){
                if(spot[1]<=plan.S)continue;
                const room=plan.frontAt(spot[1])-(spot[2]-piece.pos[2]);
                if(room<R.taperScrewRoom-1e-6)wrong(`${label}: a screw in a back leg comes within ${fmt(Math.max(0,room))} of the cut`);
              }
            }
            // the wood over a screw driven up into the seat (pointsNearTheTop only looks at the top surface)
            if(isSeat(f.into.name)&&f.dir[1]>.5){
              const cover=plainBox(f.into).hi[1]-point[1];
              if(cover<POCKET_COVER-.005)wrong(`${label}: only ${fmt(Math.max(0,cover))} of ${f.into.name.toLowerCase()} over a screw`);
            }
            // a plywood seat or a seat base is screwed on from underneath in every style: nothing goes down through it
            if(/^(plywood seat|seat base)$/i.test(f.through.name))wrong(`${label}: a screw goes down through the ${f.through.name.toLowerCase()}`);
          }
          if(style==='std'&&seat==='boards'&&!Object.keys(base).length&&seatJoint&&link.fastened){
            const name=[link.a,link.b].map(p=>p.name==='Seat board'?`Seat board at ${fmt(p.pos[2])}`:p.name).sort().join(' / ');
            counts[name]=(counts[name]||0)+fastenersOfLink(link).length;
          }
        }
        const close=fastenersTooClose();
        if(close.length)wrong(`${label}: ${close.length} pairs of fasteners closer than a drill bit`);
        // a plywood seat or a seat base: screwed up through both seat cleats, and every cleat glued to its rail; the
        // bare plywood seat glued to the four seat rails and the two braces as well
        if(seat==='plywood'){
          const sheet=S.parts.find(p=>p.name==='Plywood seat');
          for(const other of S.parts.filter(p=>/seat rail$|^Seat brace$/.test(p.name))){
            const link=connGraph().links.find(l=>[l.a,l.b].includes(sheet)&&[l.a,l.b].includes(other));
            if(!link||link.type!=='glue')wrong(`${label}: the plywood seat is not glued to the ${other.name.toLowerCase()}`);
          }
        }
        if(seat!=='boards'){
          const sheet=S.parts.find(p=>isSeat(p.name)),links=connGraph().links.filter(l=>l.fastened);
          for(const cleat of S.parts.filter(p=>p.name==='Seat cleat')){
            const up=links.filter(l=>[l.a,l.b].includes(cleat)&&[l.a,l.b].includes(sheet)).flatMap(l=>fastenersOfLink(l));
            const toRail=connGraph().links.find(l=>[l.a,l.b].includes(cleat)&&/^(Front|Back) seat rail$/.test([l.a,l.b].find(p=>p!==cleat).name));
            if(up.length<2||up.some(f=>f.through!==cleat))wrong(`${label}: the ${sheet.name.toLowerCase()} is not screwed up through a seat cleat with two screws`);
            if(!toRail||!glueFilm(toRail.joint,toRail.type))wrong(`${label}: a seat cleat is not glued to its rail`);
          }
          if(S.parts.filter(p=>p.name==='Seat cleat').length!==2||S.parts.filter(p=>p.name==='Seat brace').length!==2)wrong(`${label}: the seat has not its two cleats and two braces`);
        }
        if(seat==='boards'){
        const loose=boardsNotHeldAtBothEnds();
        if(loose.length)wrong(`${label}: a ${loose[0].name} is not held near both of its ends`);
        // the back seat board: one pocket screw at each end into the legs, none under the back seat rail
        const backBoard=S.parts.find(p=>p.name==='Back seat board'),rail=S.parts.find(p=>p.name==='Back seat rail');
        for(const link of connGraph().links.filter(l=>l.fastened&&[l.a,l.b].includes(backBoard)&&[l.a.name,l.b.name].includes('Back leg'))){
          const screws=fastenersOfLink(link);
          if(screws.length!==1)wrong(`${label}: the back seat board has ${screws.length} pocket screws into a back leg, not 1`);
          if(screws.some(f=>f.pocket&&f.pocket.mouth[2]<plainBox(rail).hi[2]+.05))wrong(`${label}: a pocket hole of the back seat board is under the back seat rail`);
        }
        // the seat boards: three 2x6 (the front one named apart), tight, no gap and no overlap
        const boards=S.parts.filter(p=>p.name==='Seat board'||p.name==='Front seat board').sort((a,b)=>a.pos[2]-b.pos[2]);
        if(boards.length!==R.seatBoards||boards.some(p=>p.mat!==R.seatBoard)||boards[boards.length-1].name!=='Front seat board')wrong(`${label}: the seat is not three 2x6 boards, the front one the Front seat board`);
        // the front seat board held near both its ends too, by the front seat rail (it is not on the list that
        // boardsNotHeldAtBothEnds reads): within a third of its length, or 9", of each end
        const front=boards[boards.length-1],frontBox=plainBox(front),reach=Math.max(front.l/3,Math.min(9,front.l/2));
        const along=connGraph().links.filter(l=>l.fastened&&[l.a,l.b].includes(front)).flatMap(l=>fastenersOfLink(l)).map(f=>f.pos[0]);
        if(!along.some(x=>x-frontBox.lo[0]<=reach+1e-6)||!along.some(x=>frontBox.hi[0]-x<=reach+1e-6))wrong(`${label}: the front seat board is not held near both of its ends`);
        const edges=[backBoard,...boards];
        for(let i=1;i<edges.length;i++){
          const gap=edges[i].pos[2]-plainBox(edges[i-1]).hi[2];
          if(Math.abs(gap)>1/32)wrong(`${label}: a ${fmt(Math.abs(gap))} ${gap>0?'gap':'overlap'} between seat boards`);
        }
        }
        // the joints that the strength counts on: two pocket screws, at least the thread the program's jig data draws
        // in the leg (1"; the strength counts the jig maker's chart, 1 1/4", the same screw a quarter inch deeper:
        // chairScrewHold), at the heights above the hinge that chairCorners gives (the code review's finding 7)
        const railHinge=plan.railBottom-plan.blockDeep,heights=chairCorners(plan);
        for(const[name,first]of[['Side seat rail',0],['Side stretcher',2]]){
          for(const link of connGraph().links.filter(l=>l.fastened&&[l.a.name,l.b.name].includes(name)&&[l.a.name,l.b.name].some(n=>/^(Back|Front) leg$/.test(n)))){
            const screws=fastenersOfLink(link);
            if(screws.length!==2||screws.some(f=>f.kind!=='pocket')){wrong(`${label}: ${name} into a leg has ${screws.length} screws, not 2 pocket screws`);continue;}
            const leg=[link.a,link.b].find(p=>/leg$/.test(p.name)),legBox=plainBox(leg);
            for(const f of screws){
              let inLeg=0;
              for(let i=0;i<40;i++){const at=pointPlus(f.pos,f.dir,f.len*(i+.5)/40);if([0,1,2].every(k=>at[k]>legBox.lo[k]-1e-6&&at[k]<legBox.hi[k]+1e-6))inLeg+=f.len/40;}
              if(inLeg<chairScrewHold(plan.v.wood).drawnThread-.07)wrong(`${label}: a pocket screw of the ${name.toLowerCase()} has only ${fmt(inLeg)} in the leg`);
            }
            const wanted=name==='Side stretcher'?heights[2].heights.map(h=>plan.strBottom+h)
              :leg.name==='Back leg'?heights[0].heights.map(h=>railHinge+h):heights[0].heights.map(h=>plan.railTop-h);
            for(const f of screws)if(!wanted.some(y=>Math.abs(y-f.pos[1])<1/16+1e-6))wrong(`${label}: a pocket screw of the ${name.toLowerCase()} into the ${leg.name.toLowerCase()} is at ${fmt(f.pos[1])}, not where the strength counts it`);
          }
        }
        // no screw of the seat near a screw of the frame (the chair maker's review: a Rustic screw down into a side
        // rail passed 0.40" from the rail's own pocket screw): 1/2" or more between their center lines
        const items=connGraph().links.filter(l=>l.fastened).flatMap(l=>fastenersOfLink(l).map(f=>({f,seat:[l.a.name,l.b.name].some(isSeat)})));
        const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
        const apart=(a,b)=>{
          let best=Infinity;
          for(let i=0;i<=16;i++)for(let j=0;j<=16;j++){
            const p=pointPlus(a.pos,unit(a.dir),a.len*i/16),q=pointPlus(b.pos,unit(b.dir),b.len*j/16);
            best=Math.min(best,Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]));
          }
          return best;
        };
        let nearest=Infinity;
        for(const a of items)if(a.seat)for(const b of items)if(!b.seat)nearest=Math.min(nearest,apart(a.f,b.f));
        if(nearest<.5)wrong(`${label}: a screw of the seat passes ${fmt(nearest)} from a screw of the frame`);
      }
    }
    // the counts of spec A.3 at the default in Everyday
    const want={'Seat board at 3 1/2" / Side seat rail':2,'Seat board at 9" / Side seat rail':4,'Front seat board / Front seat rail':3,
      'Back seat board / Back seat rail':3,'Back leg / Back seat board':2};
    for(const[name,n]of Object.entries(want))if(counts[name]!==n)wrong(`${name}: ${counts[name]||0} screws, spec A.3 says ${n}`);
    SELFTESTS.diningChair={...(SELFTESTS.diningChair||{}),seatScrews:Object.values(counts).reduce((a,b)=>a+b,0)};
  })(problems);
});

/* The seat frame stays square seen from above (stage 1 left it unchecked): in every style, at the default, both
   backs and the corners of the form, at least one seat board is screwed to both side seat rails with a pair of
   screws an inch or more apart at each (chairSeatBraces). And the check can fail: with the screws of that board into
   one side rail taken away, no board braces the frame. */
SELFTESTS.push(function diningChairSeatStaysSquare(problems){
  chairChecked('seat square',wrong=>{
    for(const style of Object.keys(STYLES))for(const[seat]of CHAIR_SEAT_KINDS)for(const base of CHAIR_PLACED_TRIES){
      const change={...base,seat};
      if(!placeChair(change,style))continue;
      const braces=chairSeatHeldSquare(S.parts);
      if(!braces.length){wrong(`${STYLES[style][0]} ${JSON.stringify(change)}: ${seat==='boards'?'no seat board is screwed to both side seat rails with a pair of screws at each':'the seat sheet is not screwed up through a cleat on the front and one on the back seat rail'}, so nothing keeps the seat frame square seen from above`);continue;}
      if(style==='std'&&!Object.keys(base).length){
        // the failing case: unscrew the bracing board from one side rail; the sheet from the cleat on the front rail
        for(const piece of braces){
          const link=connGraph().links.find(l=>l.fastened&&[l.a,l.b].includes(piece)&&[l.a.name,l.b.name].some(name=>seat==='boards'?name==='Side seat rail':/^(Plywood seat|Seat base)$/.test(name)));
          if(link&&(seat==='boards'||piece.pos[2]>10))S.joints[link.joint.key]='none';
        }
        commit();
        if(chairSeatHeldSquare(S.parts).length)wrong(`${seat}: with the ${seat==='boards'?'bracing board unscrewed from a side rail':'seat unscrewed from the front cleat'}, the check still finds the seat frame braced`);
      }
    }
  })(problems);
});

/* Nothing hangs under a seat rail in sight (Part 0 of the seats round: the owner circled the square blocks under the
   side seat rails, "these blocks seem unsightly and unnecessary"). A piece that touches the underside of a seat rail
   and is flush with the rail's outside face (so it is seen from beside the chair) and does not run the rail's whole
   length from leg to leg is a block hung under the rail. Returns the pieces that hang so. (A piece the whole length
   is the doubled rail of the first try on branch seats: sideRailIsOneBoard below finds that.) */
function piecesHungUnderSeatRails(parts){
  const hung=[];
  for(const rail of parts.filter(p=>/^(Side|Front|Back) seat rail$/.test(p.name))){
    const r=plainBox(rail),thin=[0,2].find(k=>r.hi[k]-r.lo[k]<2);   // the rail's thickness runs along this level axis
    if(thin===undefined)continue;
    const along=thin===0?2:0;
    for(const piece of parts){
      if(piece===rail||isProp(piece))continue;
      const b=plainBox(piece);
      const under=Math.abs(b.hi[1]-r.lo[1])<.01&&b.lo[along]<r.hi[along]-.01&&b.hi[along]>r.lo[along]+.01&&b.lo[thin]<r.hi[thin]-.01&&b.hi[thin]>r.lo[thin]+.01;
      const flush=Math.abs(b.lo[thin]-r.lo[thin])<.01||Math.abs(b.hi[thin]-r.hi[thin])<.01;
      const whole=b.lo[along]<=r.lo[along]+1/16&&b.hi[along]>=r.hi[along]-1/16;
      if(under&&flush&&!whole)hung.push(piece);
    }
  }
  return hung;
}
/* Each side of the chair has ONE side seat rail, a single board of the stated size (CHAIR_RULES.rail, a 2x4 on edge,
   3 1/2" deep), from the back leg to the front leg, with nothing glued or screwed under it: no corner block and no
   second board doubling it (the owner's real chairs, branch seats). Returns '' when so, else what is wrong. */
function sideRailIsOneBoard(parts){
  const rails=parts.filter(p=>p.name==='Side seat rail'),deep=M[CHAIR_RULES.rail].w;
  if(rails.length!==2)return`${rails.length} side seat rails, not 2`;
  if(parts.some(p=>p.name==='Corner block'))return'a corner block is built';
  for(const rail of rails){
    const r=plainBox(rail);
    if(rail.mat!==CHAIR_RULES.rail||Math.abs(r.hi[1]-r.lo[1]-deep)>.01)return`a side seat rail is a ${M[rail.mat].name} ${fmt(r.hi[1]-r.lo[1])} deep, not one ${M[CHAIR_RULES.rail].name} ${fmt(deep)} deep`;
    const legs=parts.filter(p=>/^(Back|Front) leg$/.test(p.name)).map(plainBox)
      .filter(b=>b.lo[0]<r.hi[0]-.01&&b.hi[0]>r.lo[0]+.01&&(Math.abs(b.hi[2]-r.lo[2])<.01||Math.abs(b.lo[2]-r.hi[2])<.01));
    if(legs.length!==2)return'a side seat rail does not run from the back leg to the front leg';
    const under=parts.find(p=>p!==rail&&!isProp(p)&&(()=>{
      const b=plainBox(p);
      return Math.abs(b.hi[1]-r.lo[1])<.01&&b.lo[0]<r.hi[0]-.01&&b.hi[0]>r.lo[0]+.01&&b.lo[2]<r.hi[2]-.01&&b.hi[2]>r.lo[2]+.01;
    })());
    if(under)return`a ${under.name.toLowerCase()} is fastened under a side seat rail, making it deeper than one board`;
  }
  return'';
}
SELFTESTS.push(function diningChairNothingHangsUnderARail(problems){
  const wrong=text=>problems.push('dining chair rails: '+text);
  for(const vals of chairTries()){
    const parts=buildDiningChair(vals),what=JSON.stringify({seat:vals.seat,S:vals.S,SW:vals.SW,BH:vals.BH});
    const hung=piecesHungUnderSeatRails(parts);
    if(hung.length){wrong(`${what}: a ${hung[0].name.toLowerCase()} hangs under a seat rail in sight`);break;}
    const side=sideRailIsOneBoard(parts);
    if(side){wrong(`${what}: ${side}`);break;}
  }
  // and both can fail: a chair saved before the seat choice (its four corner blocks) is found by both; the doubled,
  // full-length rail of the first try on branch seats by the second
  const old={...presetDefaults(chairPreset())};delete old.seat;
  const oldParts=buildDiningChair(old);
  if(piecesHungUnderSeatRails(oldParts).filter(p=>p.name==='Corner block').length!==4)wrong('the four corner blocks of a chair saved before the seat choice are not found hanging under its side seat rails');
  if(!sideRailIsOneBoard(oldParts))wrong('the corner blocks of a saved chair pass as one side rail board');
  const today=buildDiningChair({...presetDefaults(chairPreset()),seat:'boards'});
  const doubled=today.concat(today.filter(p=>p.name==='Side seat rail').map(rail=>mk('Lower side rail',CHAIR_RULES.rail,size(rail),[rail.pos[0],rail.pos[1]-size(rail)[1],rail.pos[2]])));
  if(piecesHungUnderSeatRails(doubled).length||!/deeper than one board/.test(sideRailIsOneBoard(doubled)))wrong('a second 2x4 glued under each side seat rail is not found as a doubled rail (or is called a block)');
  const twoBy6=today.map(p=>p.name==='Side seat rail'?mk('Side seat rail','2x6',[size(p)[0],5.5,size(p)[2]],[p.pos[0],p.pos[1]-2,p.pos[2]]):p);
  if(!/not one/.test(sideRailIsOneBoard(twoBy6)))wrong('a 2x6 side seat rail passes as the stated 2x4');
});

/* A chair saved before the seat choice (its form values have no Seat) opens and is written as it was saved: its four
   corner blocks, its solid wood seat, its steps and notes speaking of corner blocks, every piece in a step; and it
   still holds, by the same lean check (its blocks counted, so it holds more than the chair of today). The same chair
   as made today has plain side seat rails: no block, nothing under them. */
SELFTESTS.push(function diningChairOpensAsSaved(problems){
  chairChecked('saved chairs',wrong=>{
    const old={...presetDefaults(chairPreset()),upright:false};delete old.seat;
    const parts=buildDiningChair(old);
    if(parts.filter(p=>p.name==='Corner block').length!==4||!parts.some(p=>p.name==='Seat board'))wrong('a chair saved before the seat choice is not built with its four corner blocks and its board seat');
    if(!diningChairSteps(old).some(step=>/corner blocks/.test(step.t))||!diningChairNotes(old)[0].includes('corner block'))wrong('the steps or the notes of a chair saved before the seat choice do not speak of its corner blocks');
    if(!(diningChairPlan(old).lean.joint>diningChairPlan({...old,seat:'boards'}).lean.joint)||diningChairPlan(old).problems.length)wrong('the saved chair with its corner blocks is not checked as holding at least as well as the chair of today');
    if(diningChairSteps({...old,seat:'boards'}).some(step=>/corner block/i.test(step.t))||diningChairNotes({...old,seat:'boards'}).some(note=>/corner block/i.test(note)))wrong('the steps or the notes of the chair of today speak of corner blocks');
    load(JSON.stringify(blank()),true);
    placeInStyle(chairPreset(),old,'std');
    const saved=JSON.stringify(S);
    load(saved,true);
    if(S.parts.filter(p=>p.name==='Corner block').length!==4)wrong('a saved chair with corner blocks does not open with them');
    const plan=buildPlan(true),inSteps=new Set(plan.steps.flatMap(step=>step.pieces.map(p=>p.id)));
    if(S.parts.some(p=>!inSteps.has(p.id))||plan.steps.some(step=>step.source!=='preset'&&step.kind==='build'))wrong('a saved chair with corner blocks gets steps of its own or leaves a piece out');
    const today=buildDiningChair({...old,seat:'boards'});
    if(sideRailIsOneBoard(today))wrong(`the chair made today: ${sideRailIsOneBoard(today)}`);
    // the saved chair's corner blocks still do what its check counts (the code review's finding 13): each block two
    // pocket screws into its leg, at the heights chairCorners gives, and its glue line along the rail carries a share
    // that is above nothing and within what the glue may carry
    load(saved,true);
    const savedPlan=diningChairPlan(S.sets[1].vals),corners=chairCorners(savedPlan);
    for(const link of connGraph().links.filter(l=>l.fastened&&[l.a.name,l.b.name].includes('Corner block')&&[l.a.name,l.b.name].some(n=>/^(Back|Front) leg$/.test(n)))){
      const screws=fastenersOfLink(link),leg=[link.a,link.b].find(p=>/leg$/.test(p.name));
      const wanted=leg.name==='Back leg'?corners[0].heights.slice(0,2).map(h=>savedPlan.railBottom-savedPlan.blockDeep+h):corners[1].heights.slice(2).map(h=>savedPlan.railTop-h);
      if(screws.length!==2||screws.some(f=>f.kind!=='pocket'||!wanted.some(y=>Math.abs(y-f.pos[1])<1/16+1e-6)))wrong(`a saved chair's corner block into the ${leg.name.toLowerCase()} has its screws at ${screws.map(f=>fmt(f.pos[1])).join(', ')}, not ${wanted.map(fmt).join(', ')}`);
    }
    if(!(savedPlan.lean.glue>0&&savedPlan.lean.glue<=1))wrong(`a saved chair's corner block glue line carries ${savedPlan.lean.glue.toFixed(2)} of what the glue may carry`);
    // a Dining table saved with its chairs before the chairs had a seat choice opens with the chairs as they were:
    // corner blocks, 2x3 stretchers, the board seat, every piece in a step, the steps speaking of corner blocks
    load(JSON.stringify(blank()),true);
    const table=PRESETS.find(p=>p.name==='Dining table'),tableVals={...presetDefaults(table),chairs:true};
    delete tableVals.chairSeat;
    placeInStyle(table,tableVals,'std');
    load(JSON.stringify(S),true);
    const chairs=S.parts.filter(p=>p.unit);
    const count=new Set(chairs.map(p=>p.unit)).size;
    if(!count||chairs.filter(p=>p.name==='Corner block').length!==4*count)wrong(`a Dining table saved with its chairs before the seat choice opens with ${chairs.filter(p=>p.name==='Corner block').length} corner blocks for ${count} chairs`);
    if(chairs.some(p=>/stretcher$/.test(p.name)&&p.mat!==CHAIR_RULES.stretcherBefore)||chairs.some(p=>/^(Plywood seat|Seat base)$/.test(p.name)))wrong('the chairs of a Dining table saved before the seat choice do not keep their 2x3 stretchers and board seat');
    const setSteps=buildPlan(true),inSet=new Set(setSteps.steps.flatMap(step=>step.pieces.map(p=>p.id)));
    if(S.parts.some(p=>!inSet.has(p.id)))wrong('a Dining table saved with its chairs leaves a piece out of the steps');
    if(!setSteps.steps.some(step=>/corner blocks/.test(step.words)))wrong('the steps of a Dining table saved with its chairs do not speak of their corner blocks');
  })(problems);
});

/* The seats on the lists (spec 12 stage 3): in each style, one chair of each seat, then three made by Copy in a row.
   The shopping list buys what the seat needs and nothing else: the edge banding for a plywood seat in Everyday and
   Fine and none in Rustic; for a padded seat the foam, batting, fabric, staples, spray adhesive, counted per seat, and
   ONE staple gun; the cut list has the plywood piece, and the plywood goes on the cutting diagrams; every piece name
   is explained (TERMS). And it can fail: a cushion taken out of the design takes its upholstery with it. */
SELFTESTS.push(function diningChairSeatsOnTheLists(problems){
  chairChecked('seat lists',wrong=>{
    const line=label=>(S.hw||[]).find(row=>row[0]===label);
    for(const style of Object.keys(STYLES))for(const[seat]of CHAIR_SEAT_KINDS){
      placeChair({seat},style);
      const sources=S.parts.slice();
      for(const k of[1,2]){
        const clones=sources.map(p=>({...JSON.parse(JSON.stringify(p)),pos:[p.pos[0]+k*24,p.pos[1],p.pos[2]]}));
        addCopies(sources,clones);
      }
      commit();
      const label=`${STYLES[style][0]}, ${seat}, three chairs`;
      const banding=line(CHAIR_BANDING_LABEL);
      if(seat==='plywood'&&style!=='rustic'&&(!banding||banding[1]<1))wrong(`${label}: no edge banding on the shopping list`);
      if((seat!=='plywood'||style==='rustic')&&banding)wrong(`${label}: edge banding is on the shopping list`);
      for(const row of CHAIR_UPHOLSTERY){
        const found=line(row.label),want=seat==='padded'?(row.once?1:3*row.each):0;
        if((found?found[1]:0)!==want)wrong(`${label}: ${found?found[1]:0} of "${row.label}" on the shopping list, not ${want}`);
      }
      // each line is priced (a row of js/prices.js matches it)
      for(const row of S.hw||[])if(!hardwareFamily(row[0]))wrong(`${label}: "${row[0]}" has no price`);
      const cut=cutRows(),sheet=seat==='plywood'?'Plywood seat':seat==='padded'?'Seat base':null;
      if(sheet&&!S.parts.some(p=>p.name===sheet&&cut.rows.some(row=>row.id===cut.letterOf(p))))wrong(`${label}: the ${sheet.toLowerCase()} is not on the cut list`);
      if(S.parts.some(p=>isProp(p)&&cut.letterOf(p)&&cut.rows.some(row=>row.id===cut.letterOf(p))))wrong(`${label}: the cushion is on the cut list`);
      // the plywood on the cutting diagram: the three seats from one 4 x 8 sheet
      if(sheet){
        const ply=materialBuy(M[CHAIR_RULES.panel],S.parts.filter(p=>p.name===sheet),cut.letterOf);
        if(!ply.sheets||ply.sheets.length!==1||ply.sheets[0].pieces&&ply.sheets[0].pieces.length!==3)wrong(`${label}: the three ${sheet.toLowerCase()}s are not laid out on one sheet of plywood (${ply.sheets&&ply.sheets.length})`);
      }
      for(const p of S.parts)if(!termFor(p.name)){wrong(`${label}: no explanation for "${p.name}"`);break;}
      if(seat==='padded'&&style==='std'){
        // the failing case: a cushion taken away takes its share of the upholstery
        S.parts=S.parts.filter(p=>p!==S.parts.find(q=>q.name==='Seat cushion'));
        commit();
        if((line(CHAIR_UPHOLSTERY[0].label)||[0,0])[1]!==2)wrong('with a cushion taken out, the foam on the shopping list is not counted for the two cushions left');
      }
    }
  })(problems);
});

/* The padded seat's base, bare, against the back legs (the real-thing review of the seats round, its finding 3: cut
   exactly to the legs, the covered seat could not go back between them): each face of each notch stands
   CHAIR_RULES.coverRoom or more clear of the leg it goes round; the cushion is drawn as covered, to the legs; and the
   base has its vent holes [25 §13], each over open air (not over a brace, a cleat or a rail). Returns what is wrong
   with the pieces of one chair built from this plan, or ''. */
function chairSeatBaseProblem(parts,plan){
  const base=parts.find(p=>p.name==='Seat base');
  if(!base)return'';
  const legs=parts.filter(p=>p.name==='Back leg').map(plainBox),b=plainBox(base);
  const notches=(base.shape&&base.shape.corners||[]).map((c,index)=>({c,index})).filter(n=>n.c&&n.c.cut==='notch');
  if(notches.length!==2)return`the seat base has ${notches.length} notches, not 2`;
  for(const{c,index}of notches){
    // the notch in world sizes: c.a runs along the base's length axis, c.b along its width axis (chairCorner)
    const along={[base.ax[0]]:c.a,[base.ax[1]]:c.b},high={[base.ax[0]]:index>=2,[base.ax[1]]:index%2===1};
    const xLo=high[0]?b.hi[0]-along[0]:b.lo[0],xHi=high[0]?b.hi[0]:b.lo[0]+along[0],zHi=high[2]?b.hi[2]:b.lo[2]+along[2];
    const leg=legs.find(l=>l.lo[0]<xHi&&l.hi[0]>xLo);
    if(!leg)return'a notch of the seat base is not at a back leg';
    const side=high[0]?leg.lo[0]-xLo:xHi-leg.hi[0],front=zHi-leg.hi[2];
    if(side<CHAIR_RULES.coverRoom-1e-6||front<CHAIR_RULES.coverRoom-1e-6)return`the seat base is only ${fmt(Math.max(0,Math.min(side,front)))} clear of a back leg at its notch, not ${fmt(CHAIR_RULES.coverRoom)} for the fabric`;
  }
  // the vent holes: as many as chairVentHoles places (five or six), none over a piece under the base
  const holes=(base.shape.feats||[]).filter(f=>f.kind==='hole'),vents=chairVentHoles(plan);
  if(holes.length<5||holes.length>6||holes.length!==vents.length)return`the seat base has ${holes.length} vent holes, not five or six`;
  const under=parts.filter(p=>/^(Seat brace|Seat cleat|Front seat rail|Back seat rail|Side seat rail)$/.test(p.name)).map(plainBox);
  for(const vent of vents)
    if(under.some(u=>vent.x>u.lo[0]-CHAIR_RULES.ventD&&vent.x<u.hi[0]+CHAIR_RULES.ventD&&vent.z>u.lo[2]-CHAIR_RULES.ventD&&vent.z<u.hi[2]+CHAIR_RULES.ventD))return`a vent hole of the seat base at ${fmt(vent.x)}, ${fmt(vent.z)} is over a piece under it`;
  return'';
}
SELFTESTS.push(function diningChairSeatBaseFits(problems){
  const wrong=text=>problems.push('dining chair seat base: '+text);
  for(const vals of chairTries().filter(v=>v.seat==='padded')){
    const parts=buildDiningChair(vals),what=JSON.stringify({S:vals.S,SW:vals.SW,BH:vals.BH,upright:vals.upright});
    const problem=chairSeatBaseProblem(parts,diningChairPlan(vals));
    if(problem){wrong(`${what}: ${problem}`);break;}
    const cushion=parts.find(p=>p.name==='Seat cushion'),c=cushion&&cushion.shape.corners.find(corner=>corner&&corner.cut==='notch');
    const sideTo=CHAIR_RULES.overhang+M[CHAIR_RULES.leg].t,frontTo=M[CHAIR_RULES.leg].w;   // the seat's side to the leg's inside face; the back to its front face
    if(!c||Math.abs(Math.min(c.a,c.b)-sideTo)>.01||Math.abs(Math.max(c.a,c.b)-frontTo)>.01)wrong(`${what}: the cushion is not drawn as covered, to the faces of the back legs`);
  }
  // and the check can fail: the base cut exactly to the legs (as the first try of the seats round had it)
  const kept=CHAIR_RULES.coverRoom;
  try{
    CHAIR_RULES.coverRoom=0;chairPlanMemo.clear();
    const tightVals={...presetDefaults(chairPreset()),upright:false,seat:'padded'};
    const tight=buildDiningChair(tightVals),tightPlan=diningChairPlan(tightVals);
    CHAIR_RULES.coverRoom=kept;
    if(!/clear of a back leg/.test(chairSeatBaseProblem(tight,tightPlan)))wrong('a seat base cut exactly to the back legs passes');
  }finally{CHAIR_RULES.coverRoom=kept;chairPlanMemo.clear();}
});

/* The seat braces can be screwed in (both reviews of the seats round, their finding 2): with every piece of the chair
   in place, each pocket hole of each brace has room for a driver, at least DRIVER_ROOM.least. And the check can fail:
   with the braces' holes facing each other, 1" apart, as the first try had them, there is not. */
SELFTESTS.push(function diningChairBracesCanBeScrewed(problems){
  chairChecked('braces',wrong=>{
    const room=()=>{
      const all=new Set(S.parts.map(p=>p.id));
      return Math.min(...connGraph().links.filter(l=>l.fastened&&[l.a.name,l.b.name].includes('Seat brace')).flatMap(fastenersOfLink).filter(f=>f.through.name==='Seat brace').map(f=>driverRoom(f,all,null)));
    };
    for(const seat of['plywood','padded'])for(const base of CHAIR_PLACED_TRIES){
      placeChair({...base,seat},'std');
      const least=room();
      if(!(least>=DRIVER_ROOM.least))wrong(`${seat} ${JSON.stringify(base)}: a seat brace's pocket hole has only ${fmt(least)} for a driver`);
    }
    try{
      chairBracesFaceInward=true;
      placeChair({seat:'plywood'},'std');
      if(room()>=DRIVER_ROOM.least)wrong('two seat braces with their holes facing each other pass as drivable');
    }finally{chairBracesFaceInward=false;}
  })(problems);
});

/* 10. The steps: side frames, then the pieces between them, then the seat (back seat board with the seat boards),
   then the back; every piece in one step; every pocket screw has room for a driver among the pieces and does not
   point into the bench or the floor the step stands the chair on; a step with little room says so and lists the
   right-angle attachment; nothing is lowered onto a place another piece already stands over (the back seat board
   under the back rails: the back must come after the seat); no wood glue in the seat step, wood glue in the frame
   steps and on the shopping list; the seat step says the boards are never glued. Every style, both backs. */
const CHAIR_STEP_ORDER=[['Back leg','Front leg','Side seat rail','Side stretcher'],['Front seat rail','Back seat rail','Front stretcher','Back stretcher'],
  ['Back seat board','Seat board','Front seat board'],['Lower back rail','Crest rail']];
/* the same for each seat (stage 3): the cleats and braces go in with the pieces across, the plywood seat or the bare
   seat base where the boards go, and the padded seat's cushion in a step of its own at the very end */
function chairStepOrder(seat){
  if(seat==='boards')return CHAIR_STEP_ORDER;
  const order=[CHAIR_STEP_ORDER[0],CHAIR_STEP_ORDER[1].concat(['Seat cleat','Seat brace']),[seat==='padded'?'Seat base':'Plywood seat'],CHAIR_STEP_ORDER[3]];
  return seat==='padded'?order.concat([['Seat cushion']]):order;
}
/* What each of those steps stands the chair on (the plane a drill must not run into): the side frames lie flat on
   their outside faces, the chair stands on the floor to be joined and to get its back, and lies on its back (the back
   faces of the back legs, z 0) for the seat's screws. And where its pieces come from: the seat boards are lowered from
   above, the back rails slide in from behind. */
const CHAIR_STEP_SURFACE=[{axis:0,outside:true},{axis:1,at:0},{axis:2,at:0},{axis:1,at:0}];
const CHAIR_STEP_ARRIVES=[null,null,{axis:1,way:1},{axis:2,way:-1},{axis:2,way:1}];   // (the covered seat slides in from the front)
SELFTESTS.push(function diningChairStepsInOrder(problems){
  chairChecked('steps',wrong=>{
    for(const style of Object.keys(STYLES))for(const[seat]of CHAIR_SEAT_KINDS){
      for(const upright of[false,true]){
        placeChair({upright,seat},style);
        const label=`${STYLES[style][0]}, ${seat}${upright?', straight back legs':''}`;
        const order=chairStepOrder(seat),boards=seat==='boards';
        const plan=buildPlan(true),stepOf=new Map();
        plan.steps.forEach((step,index)=>step.pieces.forEach(piece=>{
          if(stepOf.has(piece.id))wrong(`${label}: ${piece.name} is in two steps`);
          stepOf.set(piece.id,index);
        }));
        for(const piece of S.parts)if(!stepOf.has(piece.id))wrong(`${label}: ${piece.name} is in no step`);
        const indexOf=order.map(names=>{
          const found=[...new Set(S.parts.filter(p=>names.includes(p.name)).map(p=>stepOf.get(p.id)))];
          if(found.length!==1)wrong(`${label}: ${names.join(', ')} are not in one step`);
          return found[0];
        });
        for(let i=1;i<indexOf.length;i++)if(!(indexOf[i]>indexOf[i-1]))wrong(`${label}: the steps are not side frames, join, seat, back${seat==='padded'?', cushion':''} in that order`);
        if(!glueListedNow())wrong(`${label}: wood glue is not on the shopping list`);
        // the padded seat is covered after the finish has dried: its step comes after the finishing step
        if(seat==='padded'&&!(indexOf[4]>plan.steps.findIndex(step=>step.kind==='finish')))wrong(`${label}: the seat is covered before the finish`);
        const xs=S.parts.map(p=>plainBox(p)),left=Math.min(...xs.map(b=>b.lo[0])),right=Math.max(...xs.map(b=>b.hi[0]));
        indexOf.forEach((index,i)=>{
          const step=plan.steps[index];
          if(!step)return;
          // the cushion (i 4) is slid in from the front under the lower back rail (the real-thing review's finding
          // 11): only its arrival is checked
          if(i<4){
          const glue=step.need.fasteners.includes('wood glue');
          // (the board seat and the padded seat's base are never glued; the bare plywood seat is glued down)
          if(i===2&&glue&&seat!=='plywood')wrong(`${label}: the seat step lists wood glue; the seat is never glued`);
          if(i===2&&!glue&&seat==='plywood')wrong(`${label}: the plywood seat is glued down, and its step lists no wood glue`);
          if(i!==2&&!glue)wrong(`${label}: the step with the ${order[i][0].toLowerCase()} lists no wood glue`);
          // the straight screws up through the seat cleats: the room under the cleat is said, and a short bit or a
          // right-angle attachment listed (the code review's finding 16)
          if(i===2&&!boards){
            const cleat=plainBox(S.parts.find(p=>p.name==='Seat cleat')),low=plainBox(S.parts.find(p=>p.name==='Back stretcher'));
            const roomUnder=cleat.lo[1]-low.hi[1];
            if(roomUnder<11&&(!step.need.tools.some(tool=>/short screwdriver bit|right-angle/.test(tool))||!step.words.includes(fmt(r16(roomUnder)))))wrong(`${label}: only ${fmt(roomUnder)} under the seat cleats for the drill, and the seat step does not say so or list a short bit`);
          }
          if(i===2&&boards&&!/never glued/.test(step.words))wrong(`${label}: the seat step does not say the seat boards are not glued`);
          if(step.tight.length&&(!/Little room for the drill/.test(step.words)||!step.need.tools.some(tool=>/right-angle/.test(tool))))wrong(`${label}: step ${index+1} has little room but does not say so or list the right-angle attachment`);
          // a driver behind every pocket hole: room among the pieces, and not into the bench or the floor
          const before=new Set(S.parts.filter(p=>stepOf.get(p.id)<index).map(p=>p.id));
          const own=new Set(step.pieces.map(p=>p.id));
          for(const group of step.groups)for(const link of group.links)for(const f of fastenersOfLink(link)){
            if(f.kind!=='pocket')continue;
            // (the seat braces go in last in their step, after the cleats, the rails, the stretchers and each other,
            // as its words say: every piece of the step counts as in for them; the code review's finding 2, which
            // found two braces 1" apart with their holes facing each other passing because the other brace was
            // left out of the count)
            const later=f.through.name==='Seat brace'?new Set():new Set([...own].filter(id=>id!==f.through.id&&id!==f.into.id));
            if(driverRoom(f,new Set([...before,...own]),later)<DRIVER_ROOM.least)wrong(`${label}: no room for a driver behind a pocket hole of ${f.through.name}`);
            const surface=CHAIR_STEP_SURFACE[i],back=f.dir.map(v=>-v/Math.hypot(...f.dir)),k=surface.axis;
            const middleX=(left+right)/2,mouth=f.pocket.mouth;
            const plane=surface.outside?(mouth[0]<middleX?left:right):surface.at;
            const run=Math.abs(back[k])<1e-9?Infinity:(plane-mouth[k])/back[k];
            if(run>0&&run<DRIVER_ROOM.usual)wrong(`${label}: a pocket hole of ${f.through.name} points into the ${k===1?'floor':'bench'} ${fmt(run)} away`);
          }
          }
          // nothing lowered (or slid) onto a place a piece already in stands over
          const arrives=CHAIR_STEP_ARRIVES[i];
          if(!arrives)return;
          for(const piece of step.pieces){
            const b=plainBox(piece),k=arrives.axis;
            const blocker=S.parts.find(other=>stepOf.get(other.id)<index&&[0,1,2].every(axis=>{
              const o=plainBox(other);
              if(axis===k)return arrives.way>0?o.lo[axis]>=b.hi[axis]-1e-6:o.hi[axis]<=b.lo[axis]+1e-6;
              return o.lo[axis]<b.hi[axis]-1e-6&&o.hi[axis]>b.lo[axis]+1e-6;
            }));
            if(blocker)wrong(`${label}: the ${piece.name.toLowerCase()} cannot go in: the ${blocker.name.toLowerCase()} is already in its way`);
          }
        });
        // the test case: the back seat board (or the back of the sheet) lies right under the lower back rail, so the order matters
        const board=plainBox(S.parts.find(p=>p.name===(boards?'Back seat board':order[2][0]))),lower=plainBox(S.parts.find(p=>p.name==='Lower back rail'));
        if(!(lower.lo[2]<board.hi[2]&&lower.hi[2]>board.lo[2]&&lower.lo[1]>=board.hi[1]))wrong(`${label}: the lower back rail no longer stands over the back of the seat (the order test means nothing)`);
        // the tools each step's words name are in its You need, and no tool its words do not use (the chair maker's
        // review: a saw where nothing is cut, a level that is never used, no flush-cut saw for the plugs)
        const toolsOf=index=>(plan.steps[index]&&plan.steps[index].need.tools||[]).join('; ');
        // (the cutting and the rounded front edge are in the shop packet now: its tools, js/shoppacket.js)
        // (the block plane rounds the front seat board or finishes the taper: a plywood or padded seat on straight
        // back legs has neither, and the packet lists none; the code review's finding 12)
        const planeUsed=boards||!upright;
        if(planeUsed!==/block plane/.test(shopTools(plan).join('; ')))wrong(`${label}: the part drawings ${planeUsed?'round the front edge or finish the taper with a block plane but the packet does not list one':'list a block plane that nothing in them uses'}`);
        // the covered seat cannot be lowered straight down past the lower back rail: its step says to slide it in
        // from the front (the real-thing review's finding 11)
        if(seat==='padded'&&!/slide it in from the front of the chair, back edge first, under the lower back rail/.test(plan.steps[indexOf[4]].words))wrong(`${label}: the step that covers the seat does not say how the covered seat gets in under the lower back rail`);
        // (the side frames and the join plug the stretchers' pocket holes in Everyday and Fine, as their Fasten with
        // lines say, and list what trims the plugs flush: STEP_TOOLS.pocketPlugs since the pocket-edge round (main),
        // STEP_TOOLS.plugTrim before it as a backstop; that saw only, and only there)
        const plugsTrimmed=index=>{
          const step=plan.steps[index];
          return!!step&&step.groups.some(group=>group.type==='pocket'&&group.links.some(link=>fastenersOfLink(link).some(f=>f.pocket&&f.pocket.plugged)));
        };
        const plugTools=[STEP_TOOLS.plugTrim,STEP_TOOLS.pocketPlugs];
        const sawsOf=index=>(plan.steps[index]&&plan.steps[index].need.tools||[]).filter(tool=>!(plugTools.includes(tool)&&plugsTrimmed(index))).join('; ');
        if(/\bsaw\b/.test(sawsOf(indexOf[0]))||/\bsaw\b/.test(sawsOf(indexOf[1])))wrong(`${label}: a step that cuts nothing lists a saw`);
        if((style!=='rustic')!==plugsTrimmed(indexOf[0])||(style!=='rustic')!==plugsTrimmed(indexOf[1]))wrong(`${label}: the stretchers' pocket holes are ${style!=='rustic'?'not ':''}plugged in the steps that screw them`);
        // one saw line in the cutting step, not "saw" and again "saw (a circular saw or jigsaw ...)" (stage 1 left it)
        if(shopTools(plan).filter(tool=>/^saw\b/i.test(tool)).length>1)wrong(`${label}: the tools for making the parts list a saw twice (${shopTools(plan).join('; ')})`);
        if(!/band clamp/.test(toolsOf(indexOf[1])))wrong(`${label}: the step that joins the side frames names a band clamp but does not list one`);
        if(boards&&!/two bar clamps/.test(toolsOf(indexOf[2])))wrong(`${label}: the seat step does not list the two clamps it is written for`);
        // a padded seat: the step that covers it lists the staple gun and the knife its words use, and no saw
        if(seat==='padded'&&(!/staple gun/.test(toolsOf(indexOf[4]))||!/knife/.test(toolsOf(indexOf[4]))||/\bsaw\b/.test(toolsOf(indexOf[4]))))wrong(`${label}: the step that covers the seat lists ${toolsOf(indexOf[4])}`);
        // a plywood seat in Everyday and Fine: the edge banding is ironed on from the part drawing of the plywood seat
        // (the shop packet, js/shoppacket.js: banding is part making, done while the seat is loose) and the tools for
        // making the parts list the iron; no step of the Build instructions bands it again
        if(seat==='plywood'&&style!=='rustic'){
          const banded=plan.shop.make.some(entry=>entry.kind==='band'&&entry.on.includes('Plywood seat')&&/edge banding/.test(entry.words));
          if(!banded||!shopTools(plan).some(tool=>/household iron/.test(tool)))wrong(`${label}: the part drawing of the plywood seat does not iron on the edge banding with the iron listed`);
          if(plan.steps.some(step=>/Band the edges of the plywood seat/.test(step.words)))wrong(`${label}: a step of the Build instructions still bands the plywood seat`);
        }
        if(/(^|; )saw(;|$)/.test(toolsOf(indexOf[3])))wrong(`${label}: the back step lists a plain saw as well as the flush-cut saw`);
        if((style!=='rustic')!==/flush-cut saw/.test(toolsOf(indexOf[3])))wrong(`${label}: the back step ${style!=='rustic'?'cuts plugs flush but does not list':'lists'} a flush-cut saw`);
        const feet=plan.steps.findIndex(step=>/sit still/.test(step.words));
        if(feet<0||/\blevel\b|\bsaw\b/.test(toolsOf(feet)))wrong(`${label}: the step that makes the feet sit still lists a level or a saw`);
        // the seat step never asks for more than the two clamps: one board at a time
        if(/Clamp them/.test(plan.steps[indexOf[2]].words))wrong(`${label}: the seat step clamps several boards at once`);
      }
    }
    // a set made with Copy in a row is built with the chair's own steps, for each chair (the chair maker's review:
    // chairs 2 to 4 got general steps in a wrong order, with words that contradicted the drawings)
    placeChair({},'std');
    const single=buildPlan(true).steps.length,sources=S.parts.slice();
    for(const k of[1,2,3]){
      const clones=sources.map(p=>({...JSON.parse(JSON.stringify(p)),pos:[p.pos[0]+k*24,p.pos[1],p.pos[2]]}));
      addCopies(sources,clones);
    }
    commit();
    const set=buildPlan(true);
    if(set.steps.length!==single)wrong(`four chairs made with Copy in a row get ${set.steps.length} steps, not the chair's ${single}`);
    if(set.steps.some(step=>step.source!=='preset'&&step.kind==='build'))wrong('four chairs made with Copy in a row get steps the chair does not have');
    const sideStep=set.steps.find(step=>step.pieces.some(p=>p.name==='Side seat rail'));
    if(!sideStep||sideStep.pieces.filter(p=>p.name==='Side seat rail').length!==8||!/each of the 4 dining chairs/.test(sideStep.words))wrong('the side frame step of four chairs does not build all 8 side frames, for each chair');
    if(!/You are making 4 dining chairs/.test(set.shop.copiesLine))wrong('the cutting of four chairs (the shop packet, js/shoppacket.js) does not say to cut them alike');
  })(problems);
});

/* 11. The table fits (T1 to T6), against the program's own Dining table: the defaults fit with no warning; a table
   too long (2x6 aprons), too low or too high, too short for a chair along a side, and a seat too high for the
   apron, are each warned with a reason and a fix that works. */
SELFTESTS.push(function diningChairFitsTheTable(problems){
  const wrong=text=>problems.push('dining chair table: '+text);
  const preset=chairPreset(),base={...presetDefaults(preset),upright:false,table:true};
  const warns=vals=>diningChairCheck(vals).filter(f=>f.level==='warn');
  if(warns(base).length)wrong(`the default chair at the default table is warned: ${warns(base)[0].text}`);
  const rule=(vals,code)=>(diningChairPlan(vals).fit||[]).find(f=>f.rule===code);
  const t1=rule(base,'T1'),t3=rule(base,'T3');
  if(!t1||t1.level!=='fits'||!/7 1\/2"/.test(t1.text))wrong('at the default the seat does not leave 7 1/2" under the apron');
  if(!t3||!/two of these chairs/.test(t3.text)||diningChairPlan(base).fit.along!==2)wrong('two chairs do not fit along a side of the default table');
  // (the shortest table the program makes, 36", still has 25" between its legs: one chair a side always fits, T3)
  const narrow=rule({...base,tL:36,tW:27},'T4'),short=rule({...base,tL:36,tW:27},'T3');
  if(!narrow||!/no chair fits at the ends/.test(narrow.text))wrong('a table 27" wide does not say no chair fits at its ends');
  if(!short||!/one of these chairs fits there, with .* of table for it/.test(short.text))wrong('a table 36" long does not say one chair fits along a side, in good words');
  // a table no dining chair suits (2x6 aprons, T5; too high or too low, T6) counts no chairs along it (the chair
  // maker's review: "Does not fit" and "three of these chairs fit there" in one remark)
  for(const change of[{tL:84},{tH:34},{tH:28}])if(['T3','T4'].some(code=>rule({...base,...change},code)))wrong(`${JSON.stringify(change)}: chairs are counted along a table that no dining chair suits`);
  // T6: a counter stool is named only for a seat that high (24" to 26" [25 §9]); the chair's sizes are in inches
  const t6=rule({...base,tH:32.5},'T6');
  if(t6&&/counter stool/.test(t6.text))wrong('a table 32 1/2" high is said to want a counter stool');
  if(!/counter stool/.test((rule({...base,tH:36},'T6')||{text:''}).text))wrong('a table 36" high does not say it wants a counter stool');
  for(const vals of[base,{...base,tL:84},{...base,tH:34}])for(const f of diningChairPlan(vals).fit)if(/\d'-/.test(f.text+f.fix))wrong(`a table fit gives a size in feet and inches: ${f.text}`);
  // with the table box not ticked, a seat too high for the program's own table at its usual size is still said
  if(!/tick Check it against my table/.test(diningChairInfo({...base,table:false,S:19})))wrong('a 19" seat with the table box not ticked says nothing of the program\'s 30" table');
  if(/tick Check it against my table/.test(diningChairInfo({...base,table:false})))wrong('the default seat is said to be too high for the program\'s table');
  const cases=[[{tL:84},'T5'],[{tH:28},'T6'],[{tH:34},'T6'],[{S:19,tH:29.5},'T1']];
  for(const[change,code]of cases){
    const vals={...base,...change},found=rule(vals,code);
    if(!found||found.level!=='warn')wrong(`${JSON.stringify(change)}: ${code} does not warn`);
    else if(!found.fix)wrong(`${JSON.stringify(change)}: ${code} gives no fix`);
    else if(!warns(vals).some(f=>f.word==='Does not fit.'))wrong(`${JSON.stringify(change)}: the warning box does not say "Does not fit."`);
  }
  // the 2x6 threshold is the table's own (tablePlan): the fix names the longest table with 2x4 aprons
  const lengths=[];
  for(let L=36;L<=108;L++)if(chairTableOf({tL:L,tW:33,tH:30}).apron==='2x4')lengths.push(L);
  const t5=rule({...base,tL:84},'T5');
  if(t5&&!t5.fix.includes(typedLen(lengths[lengths.length-1])))wrong(`T5's fix does not name ${lengths[lengths.length-1]}", the longest table with 2x4 aprons`);
  // the fix offered for a seat too high is a seat that fits
  const t1fix=rule({...base,S:19,tH:29.5},'T1');
  const fixedSeat=t1fix&&parseLen((t1fix.fix.match(/seat (.+?) high/)||[])[1]||'');
  if(fixedSeat&&rule({...base,S:Math.max(17,fixedSeat),tH:29.5},'T1').level==='warn')wrong('the fix offered for a seat too high for the apron does not fit either');
  // The refusals name the real reason (stage 2 review): a table as high as a counter is told so (T6), not blamed on
  // its 2x6 aprons; a 2x6 refusal says how high a seat COULD be and why that does not work, also when that height
  // is an ordinary dining seat; the fix names a size, and taken, it clears the refusal
  for(const tH of[38,42]){
    if(!rule({...base,tH},'T6')||rule({...base,tH},'T5'))wrong(`a table ${tH}" high is not refused for its height (T6)`);
  }
  for(const change of[{tL:84},{tL:70,tW:36,tH:32},{tL:63,tW:50}]){
    const t=rule({...base,...change},'T5');
    if(!t){wrong(`${JSON.stringify(change)}: the 2x6 aprons are not refused (T5)`);continue;}
    if(/would have to be/.test(t.text)||!/could be at most/.test(t.text)||!/(seats are|below the)/.test(t.text))wrong(`${JSON.stringify(change)}: T5 does not say why no seat works: "${t.text}"`);
    const size=t.fix.match(/table (\S+) (long|wide|high)/);
    const key=size?{long:'tL',wide:'tW',high:'tH'}[size[2]]:null;
    if(!key)wrong(`${JSON.stringify(change)}: T5's fix names no size: "${t.fix}"`);
    else if(['T5','T6'].some(code=>rule({...base,...change,[key]:parseLen(size[1])},code)))wrong(`${JSON.stringify(change)}: T5's fix "${t.fix}" does not clear it`);
  }
  // the table's sizes as its boxes write them while the form is talking (typedLen), in inches in the notes
  const typedT5=speakAsBoxes(()=>rule({...base,tL:84},'T5'));
  if(!typedT5||!typedT5.text.includes(boxLen(84))||!typedT5.fix.includes(boxLen(lengths[lengths.length-1])))wrong(`under the form T5 does not write the table's sizes as its boxes do: "${typedT5&&typedT5.text} ${typedT5&&typedT5.fix}"`);
  const typedT6=speakAsBoxes(()=>rule({...base,tH:36},'T6'));
  if(!typedT6||!typedT6.text.includes(boxLen(36))||/seat about 2'-/.test(typedT6.text))wrong(`under the form T6 writes the table in other units than its box, or the seat in feet: "${typedT6&&typedT6.text}"`);
  // "A table I measured" (spec 11, stage 2): each box left at 0 is not checked; each size typed is checked by its
  // own rule (T1 the underside of the apron, T2 the top, T3 between the legs along a side, T4 at an end), with a fix
  // that works; nothing measured gives no warning; an apron above the top is told
  const measured={...base,tableKind:'measured'};
  const fitOf=change=>diningChairPlan({...measured,...change}).fit;
  const codes=change=>fitOf(change).map(f=>f.rule);
  if(warns(measured).length||!/a box left at 0 is not checked/.test(fitOf({}).map(f=>f.text).join(' ')))wrong('a measured table with nothing measured is warned, or not told to type its sizes');
  if(codes({mU:25}).join()!=='T1'||codes({mH:30}).join()!=='T2'||codes({mSide:49}).join()!=='T3'||codes({mEnd:22}).join()!=='T4')wrong(`a measured size is not checked by its own rule alone: ${['mU','mH','mSide','mEnd'].map(k=>codes({[k]:k==='mSide'?49:k==='mEnd'?22:k==='mH'?30:25}).join('+')).join(', ')}`);
  if(warns({...measured,mH:30,mU:25,mSide:49,mEnd:22}).length)wrong('the program\'s own table, measured, is warned');
  const lowApron=fitOf({mU:23.5}).find(f=>f.rule==='T1');
  if(!lowApron||lowApron.level!=='warn'||!/Make the seat 16 1\/2" high or lower|at least 17" high/.test(lowApron.fix))wrong(`a measured apron 23 1/2" up is not warned with a fix: ${lowApron&&lowApron.fix}`);
  const fixedLow=lowApron&&parseLen((lowApron.fix.match(/seat (.+?) high or lower/)||[])[1]||'');
  if(fixedLow&&fixedLow>=17&&fitOf({mU:23.5,S:fixedLow}).find(f=>f.rule==='T1').level==='warn')wrong('the fix offered for a measured apron does not clear it');
  if(!warns({...measured,mH:36}).some(f=>f.word==='Does not fit.'))wrong('a measured top 36" up is not warned "Does not fit."');
  if(!fitOf({mSide:20}).some(f=>f.rule==='T3'&&f.level==='warn'))wrong('20" between the legs along a side is not warned');
  if(!fitOf({mH:25,mU:26}).some(f=>f.rule==='T0'&&f.level==='warn'))wrong('an apron measured above the top is not told');
  for(const f of fitOf({mH:30,mU:25,mSide:49,mEnd:22}))if(/undefined|NaN|\d'-/.test(f.text+f.fix))wrong(`a measured table fit reads "${f.text} ${f.fix}"`);
  if(!/Check it against my table|my table/i.test(diningChairInfo({...measured,mU:25}))&&!/for your thighs/.test(diningChairInfo({...measured,mU:25})))wrong('the remark does not give the measured table\'s fit');
});
