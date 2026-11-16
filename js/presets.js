/* NominalCAD: the preset catalog and the step-by-step instructions for each preset */
'use strict';
/* The look a design made for outdoors starts with: bare wood. A new design otherwise starts with a clear coat
   (placePreset in js/app.js), and the shopping list buys polyurethane for it, which is wrong for a shed, a
   garden bed that holds food plants, or a bird feeder. The person can still pick any finish in Style & finish. */
const OUTDOOR_LOOK={finish:'none'};
/* The small outdoor presets also start in cedar, the wood their notes ask for: the page then says cedar, the
   shopping list asks for cedar boards, and every screw at a joint is listed as an exterior screw (screwKind in
   js/style.js). The Shed stays in ordinary framing lumber; its skids and floor frame are pressure-treated boards,
   which are materials of their own (js/core.js). */
const OUTDOOR_CEDAR={finish:'none',wood:'cedar'};
const PRESETS=[
 {name:'Fish tank wall / rack',spec:'One rack or a whole wall',desc:'From one rack to a whole fish room wall. Auto-fits the most tanks and sizes the lumber for the water weight, or set every row by hand.',
  params:[{head:'Main tank'},
   {k:'size',label:'Tank size',opts:[...TANK_OPTS,['custom','Custom (type below)']],v:'g20h',
     fill:Object.fromEntries(Object.entries(TANKS).map(([k,v])=>[k,{tl:v[0],td:v[1],th:v[2],gal:v[3],clr:Math.max(8,Math.ceil(v[2]/2))}]))},
   num('tl','Tank length',24,8,96),num('td','Tank front-to-back',12,6,36),num('th','Tank height',16,6,36),{k:'gal',label:'Gallons',v:20,dec:1,min:1,max:RACK_RULES.MAX_GALLONS},
   {head:'Your space'},
   num('W','Wall width (try 10\')',120,24,600),num('H','Height available',84,24,120),num('maxD','Max depth from wall',30,8,60),
   {k:'board',label:'Longest board you can haul',opts:[['96','8 ft'],['120','10 ft'],['144','12 ft'],['192','16 ft']],v:'96'},
   RACK_BUILD_FIELD,
   {head:'Access and lighting'},
   num('light','Space for light',3,0,12),num('clr','Hand room above tank',8,0,24),num('low','Lowest tank off floor',6,0,36),
   {k:'orient',label:'Tanks face',opts:[['auto','Auto: whichever fits most'],['long','Long side out'],['end','Short end out']],v:'auto'},
   {head:'Do it by hand (leave on Auto to let the program decide)'},
   {k:'levels',label:'Number of rows',opts:[['0','Auto: as many as fit'],...[1,2,3,4,5,6,7,8].map(n=>[''+n,''+n])],v:'0'},
   {k:'perRow',label:'Tanks per row (0 = auto)',v:0,int:1,min:0,max:500},
   {k:'rail',label:'Shelf rail size',opts:[['auto','Auto'],['2x4','2x4'],['2x6','2x6'],['2x8','2x8'],['2x10','2x10']],v:'auto'},
   {k:'up',label:'Upright size',opts:[['auto','Auto'],['2x4','2x4'],['4x4','4x4'],['2x6','2x6 (for rows of different depths)'],['2x8','2x8 (for rows of different depths)']],v:'auto'},
   {k:'brace',label:'Diagonal back braces',check:1,v:true},
   {k:'base',label:'Under the bottom row',opts:[['open','Nothing: tanks start near the floor'],['shelf','Open storage shelf'],['cabinet','Cabinet with doors']],v:'open'},
   {head:'Different tank on each row (bottom row first)'},
   ...[1,2,3,4,5,6].map(i=>({k:'r'+i,label:'Row '+i+(i===1?' (bottom)':''),opts:[['','Main tank'],...TANK_OPTS,['store','Storage / sump shelf, no tanks']],v:''})),
   num('storeH','Storage or cabinet height',16,6,48)],
  info:p=>rackNotes(p).slice(0,5).join(' '),notes:p=>rackNotes(p),build:buildRack,hw:p=>rackHw(p,true),
  uses:RACK_USES,wall:RACK_WALL,check:p=>rackCheck(p),joints:RACK_JOINTS},
 {name:'Single aquarium stand',spec:'One tank, cabinet below',desc:'Stand for one tank, sized for its filled weight, with a cabinet, an open shelf or a second tank underneath.',
  params:[{head:'Tank'},
   {k:'size',label:'Tank size',opts:[...TANK_OPTS,['custom','Custom (type below)']],v:'g20h',
     fill:Object.fromEntries(Object.entries(TANKS).map(([k,v])=>[k,{tl:v[0],td:v[1],th:v[2],gal:v[3]}]))},
   num('tl','Tank length',24,8,96),num('td','Tank front-to-back',12,6,36),num('th','Tank height',16,6,36),{k:'gal',label:'Gallons',v:20,dec:1,min:1,max:RACK_RULES.MAX_GALLONS},
   {head:'Stand'},
   num('standH','Stand height',30,STAND_MIN_HEIGHT,STAND_MAX_HEIGHT),
   {k:'under',label:'Underneath the tank',opts:[['cabinet','Cabinet with doors'],['panels','Closed back and sides, open front'],['shelf','Open storage shelf'],['tank','A second tank']],v:'cabinet'},
   {head:'Do it by hand (leave on Auto to let the program decide)'},
   {k:'rail',label:'Rail size',opts:[['auto','Auto'],['2x4','2x4'],['2x6','2x6'],['2x8','2x8'],['2x10','2x10']],v:'auto'},
   {k:'up',label:'Upright size',opts:[['auto','Auto'],['2x4','2x4'],['4x4','4x4']],v:'auto'}],
  info:p=>standNotes(p).slice(0,3).join(' '),notes:p=>standNotes(p),uses:RACK_USES,wall:standWall,check:standCheck,joints:STAND_JOINTS,
  hw(p){
    const a=standArgs(p),list=[];
    if(!a)return list;
    const pl=rackPlan(a);
    if(p.under==='cabinet')list.push(...doorHardware(doorTotal(pl),p.standH-1));
    if(pl.wall)list.push(...wallScrewLines(pl,standWallGap(p)));
    return list;
  },
  build(p){const a=standArgs(p);if(!a)return[];const pl=rackPlan(a),P=buildRack(a);
    if(p.under==='cabinet'||p.under==='panels')cabinetSkin(P,0,pl.mods[0],pl,p.standH,{doors:p.under==='cabinet',left:true,right:true,back:true});
    return P;}},
 {name:'Cabinet stand with a row of tanks',tile:'Cabinet stand',spec:'Doors below, tanks on top',desc:'A long cabinet with doors and one or more rows of tanks on top. Looks like furniture, works like a rack.',
  params:[{head:'Tanks'},
   {k:'size',label:'Tank size',opts:[...TANK_OPTS,['custom','Custom (type below)']],v:'g20h',
     fill:Object.fromEntries(Object.entries(TANKS).map(([k,v])=>[k,{tl:v[0],td:v[1],th:v[2],gal:v[3],clr:Math.max(8,Math.ceil(v[2]/2))}]))},
   num('tl','Tank length',24,8,96),num('td','Tank front-to-back',12,6,36),num('th','Tank height',16,6,36),{k:'gal',label:'Gallons',v:20,dec:1,min:1,max:RACK_RULES.MAX_GALLONS},
   {k:'levels',label:'Rows of tanks on top',opts:[['1','1 row'],['2','2 rows'],['3','3 rows']],v:'1'},
   num('clr','Hand room above each tank',8,0,24),
   {head:'Cabinet'},
   num('W','Length available',72,24,600),num('storeH','Cabinet height inside',24,6,48),RACK_BUILD_FIELD,
   {head:'Do it by hand (leave on Auto to let the program decide)'},
   {k:'perRow',label:'Tanks per row (0 = auto)',v:0,int:1,min:0,max:500},
   {k:'rail',label:'Rail size',opts:[['auto','Auto'],['2x4','2x4'],['2x6','2x6'],['2x8','2x8'],['2x10','2x10']],v:'auto'},
   {k:'up',label:'Upright size',opts:[['auto','Auto'],['2x4','2x4'],['4x4','4x4']],v:'auto'}],
  info:p=>rackNotes(cabArgs(p),CABINET_FIELDS).slice(0,4).join(' '),notes:p=>rackNotes(cabArgs(p),CABINET_FIELDS),build:p=>buildRack(cabArgs(p)),hw:p=>rackHw(cabArgs(p)),steps:p=>rackSteps(cabArgs(p),false,'cabinet stand'),
  uses:RACK_USES,wall:p=>rackWallIfNeeded(cabArgs(p)),check:p=>rackCheck(cabArgs(p),CABINET_FIELDS),joints:RACK_JOINTS},
 {name:'Platform bed',spec:'2x6 frame, 1x4 slats',desc:'2x6 frame on 4x4 legs with 1x4 slats. No box spring needed.',
  params:[{k:'size',label:'Mattress',opts:[['twin','Twin'],['twinxl','Twin XL'],['full','Full'],['queen','Queen'],['king','King'],['calking','California king'],['custom','Custom (type below)']],v:'queen',
     fill:{twin:{Wm:38,Lm:75},twinxl:{Wm:38,Lm:80},full:{Wm:54,Lm:75},queen:{Wm:60,Lm:80},king:{Wm:76,Lm:80},calking:{Wm:72,Lm:84}}},
   num('Wm','Mattress width',60,28,84),num('Lm','Mattress length',80,52,90),num('H','Top of frame off floor',14,9,24)],
  build:buildBed,notes:bedNotes,info:p=>bedNotes(p)[0],check:p=>bedPlan(p).problems,joints:BED_JOINTS,
  uses:{'Slat':'bedSlat','Cleat':'bedSlat','Center beam':'bedSlat','Side rail':'bedSlat','End rail':'bedSlat'}},
 {name:'Shed',spec:'Gable or lean-to roof',desc:'Adjustable storage shed: floor on skids, stud walls sheathed in plywood, a gable or lean-to roof, with a door opening and window openings where you want them. Build at your own risk.',
  params:[{head:'Size'},
   num('W','Width (left to right)',120,48,192),num('D','Depth (front to back)',96,48,144),num('Hb','Wall height (the low back wall of a lean-to)',84,72,96),
   {head:'Roof'},
   {k:'roof',label:'Roof style',opts:[['gable','Gable: a peak in the middle'],['lean','Lean-to: one slope, high at the front']],v:'gable'},
   {k:'pitch',label:'Roof slope (inches up per foot)',v:4,dec:1,min:1,max:12},{k:'sp',label:'Wall studs, middle to middle',opts:[['16','16" apart'],['24','24" apart']],v:'16'},
   // The door and window openings are framed and left open. A plywood door and the picture of a window are
   // options, off to start with (the owner: a plywood slab for a door "seems silly", they "should just be openings").
   {head:'Door opening'},
   {k:'dwall',label:'Door is on the',opts:[['front','Front wall'],['back','Back wall'],['left','Left wall'],['right','Right wall']],v:'front'},
   num('dw','Door width',36,24,72),num('dh','Door height',72,60,80),num('doff','Door from the left corner (seen from outside; 0 = centered)',0,0,180),
   {k:'door',label:'Add a plywood door (off: the opening is left open)',check:1,v:false},
   {head:'Window openings'},
   {k:'wn',label:'How many windows',v:1,int:1,min:0,max:8},
   {k:'wwall',label:'Windows are on the',opts:[['right','Right wall'],['left','Left wall'],['both','Both side walls'],['back','Back wall'],['front','Front wall']],v:'right'},
   num('ww','Window width',24,12,48),num('wh','Window height',24,12,48),num('sill','Bottom of window above floor',40,12,60),
   {k:'glass',label:'Show the window (a bought window, drawn in each opening)',check:1,v:false}],
  info:p=>shedNotes(p).slice(0,2).join(' '),notes:shedNotes,build:buildShed,steps:shedSteps,hw:shedHardware,
  // the preset rule: what each piece is for, the numbers that cannot work (shedPlan in js/builders-shed.js
  // explains each one), and the other choices (the other roof style; the plywood door and the windows shown,
  // under each roof style), which selfTest also tries at every limit
  uses:SHED_USES,check:p=>shedPlan(p).problems,
  // a shed is nailed: the fastener for each pair of pieces (js/builders-shed.js)
  joints:SHED_JOINTS,
  variants:[{roof:'lean',pitch:3},{door:true,glass:true},{roof:'lean',pitch:3,door:true,glass:true}],
  // It starts as bare wood: the notes say siding or paint is not in the list, and a clear coat on a whole shed
  // (some 28 quarts of polyurethane) is not what anyone buys. Style & finish can still change it.
  look:OUTDOOR_LOOK},
 {name:'Bird feeder',spec:'Tray with a pitched roof',desc:'Platform feeder with a pitched roof. A good first project from fence pickets or 1x boards.',
  params:[num('L','Length',12,...FEEDER_LIMITS.L)],
  build:buildFeeder,steps:feederSteps,notes:feederNotes,uses:FEEDER_USES,
  hw:()=>[['Screw eyes',2],['Chain or rope, feet',4],[FEEDER_ROOF_SCREW,FEEDER_ROOF_SCREWS]],look:OUTDOOR_CEDAR,joints:FEEDER_JOINTS},
 {name:'Bookshelf',spec:'Fixed shelves, thin back',desc:'Sides, fixed shelves, toe kick and a thin plywood back. Wide ones get upright dividers so the shelves cannot sag.',
  params:[num('W','Width',32,...BOOKSHELF_LIMITS.W),num('H','Height',48,...BOOKSHELF_LIMITS.H),
   {k:'board',label:'Shelf depth',opts:[['1x8','7 1/4" (1x8)'],['1x10','9 1/4" (1x10)'],['1x12','11 1/4" (1x12)']],v:'1x10'},
   {k:'back',label:'Plywood back',check:1,v:true},
   // The owner: "bookshelves need a shelf height also" and "make sure book shelves are able to have a desired
   // shelf spacing". Evenly spaced to start with (a number of shelves); "At a spacing I choose" fits as many
   // shelves as the height allows at the opening typed, and what is left goes to the top or the bottom opening
   // (bookshelfFitAtSpacing); "Set the height of each opening" shows one box for each opening below the top one,
   // bottom opening first (bookshelfOpeningFields in js/builders-storage.js). The top opening takes what is left.
   {k:'spacing',label:'Shelf spacing',opts:[['even','Evenly spaced'],['gap','At a spacing I choose'],['set','Set the height of each opening']],v:'even'},
   {k:'n',label:'Shelves inside',v:3,int:1,min:BOOKSHELF_LIMITS.n[0],max:BOOKSHELF_LIMITS.n[1],show:p=>p.spacing!=='gap'},
   {...num('gap','Opening between shelves (clear height)',BOOKSHELF_SPACING_USUAL,...BOOKSHELF_SPACING_LIMITS),show:p=>p.spacing==='gap'},
   {k:'extra',label:'What is left goes to',opts:[['top','The top opening'],['bottom','The bottom opening']],v:'top',show:p=>p.spacing==='gap'},
   {head:'Height of each opening (bottom first; 0 = share what is left)',show:p=>p.spacing==='set'&&p.n>=1},
   ...bookshelfOpeningFields()],
  build:buildBookshelf,steps:bookshelfSteps,info:bookshelfInfo,notes:bookshelfNotes,hw:bookshelfHardware,check:bookshelfCheck,
  // variants: the structural list also tries shelves at uneven heights, at every limit of the form
  uses:BOOKSHELF_USES,wall:p=>bookshelfPlan(p).anchored,joints:BOOKSHELF_JOINTS,variants:[{spacing:'set',o1:14,o2:8},{spacing:'set',o1:4,o2:0,o3:6},
    {spacing:'gap',gap:BOOKSHELF_SPACING_LIMITS[0]},{spacing:'gap',gap:BOOKSHELF_SPACING_LIMITS[1],extra:'bottom'}]},
 /* The tables, desks and benches below are all made by tablePreset (js/builders-furniture.js): what each is made of
    is one row of TABLE_KINDS there, and the plan adds cross rails and deeper aprons as the sizes typed here need them. */
 tablePreset('Dining table','4x4 legs, 2x4 aprons, 2x6 plank top on a cross rail (none on a short table, more on a long one).',
  [num('L','Length',60,36,108),num('W','Width',33,27,50),num('H','Height',30,26,42)]),
 tablePreset('Coffee table','Light frame with a board top and a slatted lower shelf.',
  [num('L','Length',44,24,60),num('W','Width',22,16,33),num('H','Height',18,14,24)]),
 tablePreset('Side table / nightstand','Small table with 2x2 legs and a board top.',
  [num('L','Width',20,12,36),num('W','Depth',16.5,11,24),num('H','Height',24,16,36)]),
 tablePreset('Desk','4x4 legs, 2x4 aprons, one-piece plywood top on a cross rail (more on a wide desk).',
  [num('L','Width',48,30,96),num('W','Depth',24,18,48),num('H','Height',30,26,44)]),
 tablePreset('Sturdy bench','Outdoor-style bench from 4x4s, 2x4s and 2x6s.',
  [num('L','Length',48,24,108),num('W','Seat depth',16.5,14,24),num('H','Seat height',18,14,24)]),
 {name:'Five-board bench',spec:'Classic first project',desc:'Classic beginner bench: two plank legs, a seat, and two aprons lapped over the legs.',
  params:[num('L','Length',36,18,72),num('H','Seat height',18,10,20),{k:'board',label:'Seat board',opts:[['1x10','9 1/4" (1x10)'],['1x12','11 1/4" (1x12)']],v:'1x12'}],
  build:buildFiveBoard,notes:fiveBoardNotes,info:p=>fiveBoardNotes(p)[0],check:p=>fiveBoardPlan(p).problems,joints:FIVE_BOARD_JOINTS,
  uses:{'Seat':'seat','Apron':'seat'}},
 tablePreset('Workbench','Heavy 4x4 frame, 3/4" plywood top on cross rails, and a lower shelf.',
  [num('L','Length',60,36,96),num('W','Depth',24,18,48),num('H','Height',34,28,42)]),
 {name:'Garage shelves',spec:'2x4 frame, plywood decks',desc:'2x4 posts and shelf frames with plywood decks. Each shelf is sized for 50 lb per square foot.',
  params:[num('W','Width',48,...GARAGE_LIMITS.W),num('D','Depth',18,...GARAGE_LIMITS.D),num('H','Height',72,...GARAGE_LIMITS.H),
   {k:'n',label:'Shelves',v:4,int:1,min:GARAGE_LIMITS.n[0],max:GARAGE_LIMITS.n[1]}],
  build:buildGarageShelves,steps:garageSteps,info:garageInfo,notes:garageNotes,hw:garageHardware,check:garageCheck,
  uses:GARAGE_USES,wall:p=>garagePlan(p).anchored,joints:GARAGE_JOINTS,
  // garage shelving is left bare and put together with screws alone: no polyurethane and no glue on its lists
  look:{finish:'none'},glue:false},
 {name:'Storage box / toy chest',spec:'Plywood box, hinged lid',desc:'Plywood box with a hinged lid.',
  params:[num('W','Width',30,...STORAGE_BOX_LIMITS.W),num('D','Depth',16,...STORAGE_BOX_LIMITS.D),num('H','Height',16,...STORAGE_BOX_LIMITS.H),
   {k:'ply',label:'Plywood',opts:[['ply34','3/4"'],['ply12','1/2"']],v:'ply34'},{k:'lid',label:'Lid',check:1,v:true}],
  build:buildStorageBox,steps:storageBoxSteps,info:storageBoxInfo,notes:storageBoxNotes,hw:storageBoxHardware,uses:STORAGE_BOX_USES,joints:STORAGE_BOX_JOINTS},
 {name:'Planter box',spec:'1x6 sides, slatted bottom',desc:'1x6 sides on 2x2 corner posts that double as feet, with a slatted bottom that drains.',
  params:[num('L','Length',36,...BOX_KINDS.planter.limits.L),num('D','Width',16,...BOX_KINDS.planter.limits.D),
   {k:'rows',label:'Boards high',v:2,int:1,min:BOX_KINDS.planter.limits.rows[0],max:BOX_KINDS.planter.limits.rows[1]}],
  build:p=>buildSoilBox('planter',p),steps:p=>soilBoxSteps('planter',p),info:p=>soilBoxInfo('planter',p),
  notes:p=>soilBoxNotes('planter',p),hw:p=>soilBoxHardware('planter',p),uses:PLANTER_USES,look:OUTDOOR_CEDAR,joints:PLANTER_JOINTS},
 {name:'Raised garden bed',spec:'2x6 sides, 4x4 posts',desc:'2x6 sides screwed to 4x4 corner posts. Long beds get a cross tie so the soil cannot bow the sides.',
  params:[num('L','Length',72,...BOX_KINDS.bed.limits.L),num('D','Width',36,...BOX_KINDS.bed.limits.D),
   {k:'rows',label:'Boards high',v:2,int:1,min:BOX_KINDS.bed.limits.rows[0],max:BOX_KINDS.bed.limits.rows[1]}],
  build:p=>buildSoilBox('bed',p),steps:p=>soilBoxSteps('bed',p),info:p=>soilBoxInfo('bed',p),
  notes:p=>soilBoxNotes('bed',p),hw:p=>soilBoxHardware('bed',p),uses:BED_USES,look:OUTDOOR_CEDAR,
  glue:false}, // put together with screws alone: it stands in wet soil, and its steps never glue,
 tablePreset('Entryway shoe bench','Sit-down bench with a slatted shoe shelf underneath.',
  [num('L','Length',42,24,60),num('W','Seat depth',16.5,11,24),num('H','Seat height',18,16,24)]),
 {name:'Base cabinet with doors',tile:'Base cabinet',spec:'Shelf, doors and a top',desc:'Plywood cabinet with a shelf, doors and a countertop. Good for a garage or laundry room.',
  params:[num('W','Width',30,...CABINET_LIMITS.W),num('D','Depth',24,...CABINET_LIMITS.D),num('H','Height (without top)',34.5,...CABINET_LIMITS.H)],
  build:buildCabinet,steps:cabinetSteps,info:cabinetInfo,notes:cabinetNotes,hw:cabinetHardware,uses:CABINET_USES,joints:CABINET_JOINTS},
 {name:'Wall shelf',spec:'Board on a wall cleat',desc:'A board shelf on a wall cleat with supports under it. Screws into wall studs.',
  params:[num('L','Length',36,...WALL_SHELF_LIMITS.L),{k:'board',label:'Shelf depth',opts:[['1x6','5 1/2" (1x6)'],['1x8','7 1/4" (1x8)'],['1x10','9 1/4" (1x10)']],v:'1x8'},
   num('up','Height on the wall',54,...WALL_SHELF_LIMITS.up)],
  build:buildWallShelf,steps:wallShelfSteps,info:wallShelfInfo,notes:wallShelfNotes,hw:wallShelfHardware,
  uses:WALL_SHELF_USES,wall:WALL_SHELF_ON_WALL,joints:WALL_SHELF_JOINTS},
];

/* ---------- step-by-step instructions for presets ----------
   A sentence in a step never states a count or a size that the "Fasten with" list under it contradicts: the
   numbers below are the ones jSpec (js/style.js) works out for these joints, and where a size depends on the
   lumber chosen the sentence leaves it to the list ("the screws listed below"). */
const CUT={t:'Cut every piece on the cut list and pencil its letter on it. Measure twice, cut once, and cut the longest pieces first.',add:[]};
const FIN={t:'Sand everything: 80 grit, then 120, then 180, and round over the sharp edges. Wipe off the dust, then paint or stain, and finish with at least two coats of clear coat.',add:[]};
/* The steps for a table, desk or bench, written from its plan (tablePlan in js/builders-furniture.js), so they
   name exactly the pieces that are built: cross rails, stretchers, shelf rails and the shelf only when it has them. */
/* The words follow the build style where the work does (styledStep, js/style.js): a table for the house holds its
   top on from underneath with pocket screws in the aprons and cross rails (TABLE_HOUSE_JOINTS in
   js/builders-furniture.js), and in Rustic / rough it is screwed down through the top, heads showing. A shop
   workbench (TABLE_KINDS: shop) keeps its top screwed down in Everyday too. */
function tableSteps(plan){
  const shelf=plan.shelf,low=fmt(shelf?shelf.low:plan.lowY),seat=plan.topName==='Seat board';
  const shop=!!(TABLE_KINDS[plan.name]&&TABLE_KINDS[plan.name].shop),surface=seat?'seat':'top';
  const steps=[CUT];
  const endFrames='Build the two end frames. Lay two legs on a flat surface and fit a short apron between them, flush with the top of the legs and with their outside faces.'+
    (shelf&&shelf.ends?` Fit a short stretcher the same way, with its underside ${low} up from the bottom of the legs.`:'');
  const square=' Then check each corner with a square.';
  // the holes that will hold the top are drilled now, while the aprons are loose: in a built frame the jig does not fit
  const drillForTop=` Before you put the frames together, also drill the pocket holes that will hold the ${surface}: along the top edge of the inside face of every apron${plan.railCount?' and cross rail':''}, as many as the step that fastens the ${surface} lists, with the jig set as that list says.`;
  const pocketWords=' Glue each joint and drive two pocket screws through each end of the apron into the leg. Drill the pocket holes on the inside face, where they will not show.';
  // What kind of screw goes through the leg depends on the leg and on the fastener picked: through a 4x4 the list
  // gives 1/4" structural screws, which take no pilot hole (screwForJoint, js/style.js), and "Screws, heads
  // plugged" picked by hand gives #8 screws in deep counterbores. So these words leave that to the list under
  // the step, whose lines say it (fastenLine, js/buildsteps.js), and never contradict it.
  const throughLeg=' Glue each joint and drive the screws listed below in through the outside face of the leg into each end of the apron, the way the list says: wood screws take a pilot hole, structural screws do not, and the list says where a head needs a deep hole first.';
  // TABLE_KINDS shortEnds: a short apron with no room for pocket holes at both ends and the seat's holes as well
  const shortEnds=!!(TABLE_KINDS[plan.name]&&TABLE_KINDS[plan.name].shortEnds);
  const shortWhy=` The short aprons are too short for pocket holes at their ends: those holes would take up the room the holes that hold the ${surface} need.`;
  // (the owner kept those heads in Everyday: the notes and this sentence say how they can be hidden)
  const shortHeads=` Their heads show on the front and back faces of the legs. To hide them, choose Fine furniture in Style & finish, which joins these aprons with glued dowels instead, or click a screw of each of the four joints between a leg and a short apron in the 3D view and pick "Screws, heads plugged" in Properties (a choice there changes that one joint), which sinks the heads deep in the leg under glued lengths of dowel rod.`;
  const dowelWords=' Glue each joint and join it with the dowels listed below: mark matching places on the leg and on the end of the apron, drill the holes with a doweling jig, glue the dowels in and clamp the joint.';
  steps.push(styledStep({
    std:endFrames+(shortEnds?throughLeg+shortWhy+shortHeads:pocketWords)+(shop?'':drillForTop)+square,
    fine:endFrames+(shortEnds?dowelWords+shortWhy:pocketWords)+drillForTop+square,
    rustic:endFrames+throughLeg+square},
    ['Leg','Short apron'].concat(shelf&&shelf.ends?['Short stretcher']:[])));
  const longAprons='Stand the end frames up and join them with the two long aprons, flush with the top of the legs and with their outside faces.'+
    (shelf?` Add the long stretchers with their undersides ${low} up from the floor.`:'');
  const squareFrame=' Measure corner to corner both ways: the frame is square when the two measurements match.';
  steps.push(styledStep({
    std:longAprons+(shortEnds?' Glue these joints and fasten them with two pocket screws at each end, from holes drilled on the inside face of the long apron, where they will not show.'
      :' Glue these joints and fasten them with two pocket screws at each end, the same way.')+squareFrame,
    rustic:longAprons+' Glue these joints and screw them through the legs the same way, with the screws listed below.'+squareFrame},
    ['Long apron'].concat(shelf?['Long stretcher']:[])));
  if(plan.railCount){
    // where the middle of each cross rail goes, measured along a long apron from the outside face of one end frame
    const middles=[];
    for(let i=1;i<=plan.railCount;i++)middles.push(fmt(i*plan.railStep+plan.railT/2));
    const one=plan.railCount===1;
    const where=one?`with its middle ${middles[0]} from the outside face of either end frame, which is halfway along`
      :`with their middles ${middles.slice(0,-1).join(', ')} and ${middles[middles.length-1]} from the outside face of one end frame`;
    const place=`Fasten the ${one?'cross rail':plan.railCount+' cross rails'} between the long aprons, on edge and flush with their top edges, ${where}. Mark those places on both aprons first.`;
    const carries=` The ${seat?'seat':'top'} rests on ${one?'it':'these'}, so it cannot sag in the middle.`;
    const throughApron=` Drive two screws through each apron into each end of ${one?'the rail':'a rail'}.`;
    const fromRail=` Drive the pocket screws listed below from the holes in each end of ${one?'the rail':'a rail'} into the apron. Drill those holes, and the holes along its top edge that will hold the ${surface}, before the rail goes in. Nothing goes through the front apron.`;
    steps.push(styledStep({std:place+(shop?throughApron:fromRail)+carries,fine:place+fromRail+carries,rustic:place+throughApron+carries},['Cross rail']));
  }
  if(shelf&&shelf.rails.length){
    // where the middle of each rail between the two end ones goes, measured along a stretcher from the outside
    // face of one end frame, so the builder has numbers to mark and not only "spaced evenly"
    const inner=shelf.rails.slice(1,-1).map(x=>fmt(r16(x-plan.over+plan.railT/2)));
    const middleWords=!inner.length?'':inner.length===1?`, and the one between them with its middle ${inner[0]} from the outside face of either end frame`
      :`, and the ${inner.length} between them with their middles ${inner.slice(0,-1).join(', ')} and ${inner[inner.length-1]} from the outside face of one end frame (mark those places on both stretchers first)`;
    const railPlace=`Fasten the ${shelf.rails.length} shelf rails between the long stretchers, on edge and flush with their top edges: one tight against the legs at each end${middleWords}.`;
    const toLegs=' and two screws through each of the two end rails into each leg it lies against.';
    steps.push(styledStep({
      std:railPlace+' Drive two screws through each stretcher into each end of a rail,'+toLegs,
      fine:railPlace+' Drive the pocket screws listed below from holes in each end of a rail into the stretchers (drill them before the rails go in),'+toLegs},
      ['Shelf rail']));
  }
  if(shelf&&shelf.slats){
    const lay=`Lay the shelf slats across the long stretchers with even gaps of about ${fmt(shelf.slatGap)}`;
    const down=`${lay}, and drive two screws down through each end of every slat into the stretcher under it.`;
    const below=`${lay}, and fasten each one from below: drive the pocket screws listed below from the holes on the inside face of the long stretchers up into the ends of the slats. Drill those holes before the stretchers go in, at the places the list gives.`;
    steps.push(styledStep({std:below,fine:below,rustic:down},['Shelf slat']));
  }
  if(shelf&&shelf.sheet){
    const drop='Drop the lower shelf onto the stretchers and shelf rails, between the legs, and ';
    steps.push(styledStep({
      std:drop+'screw it down about every 8" into the stretchers and the shelf rails.',
      fine:drop+'fasten it from below with the pocket screws listed below, from holes on the inside of the stretchers and the shelf rails.'},
      ['Lower shelf']));
  }
  const rails=plan.railCount?(plan.railCount===1?' and the cross rail':' and each cross rail'):'';
  // Held from underneath (Everyday and Fine for the house, Fine for a shop bench): the usual way to work is upside
  // down on a blanket, so the overhang can be marked all round and every pocket hole is easy to reach.
  const fromBelow=(plan.planks
    ?`Lay the ${surface} boards best face down on a blanket or a piece of carpet, tight together. Turn the frame upside down and set it on them, so that the ${surface} overhangs ${fmt(plan.over)} past the legs on every side: mark the overhang at each corner and measure it all round before you drive anything.`
    :`Lay the top best face down on a blanket or a piece of carpet. Turn the frame upside down and set it on the top, so that the top overhangs ${fmt(plan.over)} past the legs on every side: mark the overhang at each corner and measure it all round before you drive anything.`)+
    ` Drive the pocket screws listed below from the holes on the inside of the aprons${plan.railCount?' and the cross rails':''} up into the underside of the ${surface}`+
    (plan.planks?`: every board is held near both ends${plan.railCount?' and wherever it crosses a cross rail':''}, the inner boards by the short aprons and the two outer boards by the long aprons under them, all along their length. Right beside a leg there are no holes: the holes that hold the apron to the leg take up that end of the apron.`:'.')+
    ` The ${surface} only rests on the tops of the legs: nothing is driven into them. The screws stop short of the ${surface} surface, so nothing shows on it. Turn it right side up.`;
  const screwDown=plan.planks
    ?`Lay the ${surface} boards on the frame, best face up and tight together, overhanging ${fmt(plan.over)} past the legs on every side. Screw down through each board with the screws listed below: into each short apron${rails} it crosses and into the top of a leg where the board lies over one (two screws where the board covers ${fmt(TWO_SCREWS_FROM)} or more of the piece under it, one where it covers less, so the wood does not split), and one about every 8" along the long apron under each of the two outer boards. Drill pilot holes, and set the screw heads just below the surface.`
    :`Center the top on the frame so it overhangs ${fmt(plan.over)} past the legs on every side. Screw down through it with the screws listed below, about every 8" along the aprons${plan.railCount?' and the cross rails':''}, and ${plan.leg>=TWO_SCREWS_FROM?'two':'one'} into the top of each leg. Set the screw heads just below the surface.`;
  steps.push(styledStep({std:shop?screwDown:fromBelow,fine:fromBelow,rustic:screwDown},[plan.topName]));
  steps.push(FIN);
  return steps;
}
function bedSteps(p){
  const plan=bedPlan(p),beams=plan.beamXs.length,legs=plan.beamLegZs.length;
  // The head and the foot are the ends people look at: in Everyday and Fine nothing goes through the end rails
  // (BED_JOINTS in js/builders-furniture.js); in Rustic / rough the end rails are screwed through, heads showing.
  // The sides show no heads either in Everyday and Fine, but for the screws that hold a side rail to its legs: those
  // are sunk under wooden plugs (BED_JOINTS: pluggedUnlessRustic), and the finishing step says how the plugs are cut
  const fitRails='Stand the two side rails on edge, cleats facing in, and fit the two end rails (the head and the foot of the bed) between them, flush with the ends of the side rails.';
  const standLegs=' Then stand a leg in each inside corner, in the space past the end of the cleat, with its top level with the top of the cleat.';
  const steps=[CUT,
   {t:'Screw a cleat along the inside of each side rail, 1 3/4" below the top edge and centered end to end. Glue it and drive the screws listed below in through the cleat into the rail, about one every 8", so their heads are on the inside, under the slats. The slats rest on these, so do not skimp on the screws.',add:['Side rail','Cleat']},
   styledStep({
     std:fitRails+' Glue each joint and drive the pocket screws listed below into the side rail, from holes drilled in the inside face of the end rail near its ends (drill them before the rails go together).'+standLegs+
       ' Glue it and fasten the side rail to it with the screws listed below, driven in through the outside of the side rail. That joint carries the bed, so it is screwed, but the heads would show: sink each one in a counterbore and cover it, as the list says. Then fasten the leg to the end rail from inside the bed: drive the screws listed below in through the inside face of the leg into the end rail, each head in a counterbore as deep as the list says, so that no screw shows on the head or the foot.',
     rustic:fitRails+' Glue each joint and drive the screws listed below through the side rail into the end of the end rail.'+standLegs+' Glue it and drive the screws listed below through the side rail and through the end rail into it.'},['End rail','Leg'])];
  if(beams){
    const one=beams===1,theBeam=one?'the beam':'each beam';
    const place=`Fasten the ${one?'center beam':beams+' center beams'} between the head and foot rails, on edge, with ${one?'its top':'their tops'} level with the cleats${one?', in the middle of the bed':', spaced evenly across the bed'}. `;
    const legsWords=`Stand ${legs} center legs against one side of ${theBeam}${one?'':' (the side that faces the middle of the bed)'}, with their tops level with the top of the beam: one at each end, tight against the head or foot rail, and ${legs===3?'one in the middle':'the rest evenly spaced between'}. `+
      'Glue each leg to the beam and drive two of the screws listed below through the beam into it. ';
    steps.push(styledStep({
      std:place+`Drive the pocket screws listed below from the holes in each end of ${theBeam} into the head and foot rails (drill them before the beam goes in). `+legsWords+
        'Then fasten the leg that stands against the head rail, and the one against the foot rail, to that rail from inside the bed: the screws listed below go in through the leg into the rail, each head in a counterbore as deep as the list says.',
      rustic:place+`Drive two of the screws listed below through each rail into the end of ${theBeam}. `+legsWords+
        `Then drive two screws through the head rail and two through the foot rail into the leg that stands against it: that leg reaches ${fmt(plan.railLap)} up the rail, which is the room you have for them.`},
      ['Center beam','Center leg']));
  }
  steps.push({t:`Lay the slats across with even gaps of about ${fmt(plan.slatGap)}; the first and the last lie tight against the head and foot rails, on the tops of the corner legs. Drive two of the screws listed below down through each end of every slat into the cleat${beams?', and two more into '+(beams===1?'the center beam':'each center beam'):''}. Where a slat lies on the top of a leg, its two screws go into the end of the leg instead, and they are longer (the list gives both lengths): a screw into the end of a board needs more grip. The mattress sits about 1" down inside the frame so it cannot slide.`,add:['Slat']},
    FIN,{t:'Set the mattress on the slats.',add:['Mattress']});
  return steps;
}
function fiveBoardSteps(p){
  const plan=fiveBoardPlan(p),F=FIVE_BOARD;
  // Everyday and Fine: nothing shows on the seat or the front (FIVE_BOARD_JOINTS in js/builders-furniture.js)
  const legs=`Cut a shallow V or an arch out of the bottom of each leg so it stands on two feet and does not rock. Stand the legs up and glue the two aprons across their edges, flush with the tops of the legs. Each leg sits ${fmt(F.legInset-F.apronInset)} in from the ends of the aprons.`;
  const overhang=`overhangs the aprons ${fmt(F.apronInset)} at each end and ${fmt(plan.edge)} front and back`;
  return[CUT,
   styledStep({
     std:`Before you put anything together, drill the pocket holes: on the inside face of each leg, near its edges for the aprons and near its top end for the seat, and along the top edge of the inside face of each apron for the seat, as many as the lists of this step and the next say. `+legs+
       ' Drive the pocket screws listed below from the holes in the legs into the aprons, then check that the legs are square to the aprons.',
     rustic:legs.replace('glue the two aprons','glue and screw the two aprons')+' Drill pilot holes and drive two screws through the apron into the edge of each leg, then check that the legs are square to the aprons.'},
     ['Leg','Apron']),
   styledStep({
     std:`Lay the seat best face down on a blanket or a piece of carpet, and set the legs and aprons upside down on it, centered so that the seat ${overhang}: measure it all round. Glue it, and drive the pocket screws listed below from the holes on the inside of the aprons and the legs up into the seat. They stop short of the top, so nothing shows on it. Turn the bench right side up.`,
     rustic:`Center the seat on top so it ${overhang}. Glue it, then screw down into the legs and into both aprons every 8".`},
     ['Seat']),FIN];
}
const STEPS={
 'Fish tank wall / rack':p=>rackSteps(p,true),
 'Single aquarium stand':p=>standSteps(p),   // js/builders-fish.js
 'Platform bed':bedSteps,
 /* the tables, desks and benches made by tablePreset carry their own steps (tableSteps above) */
 'Five-board bench':fiveBoardSteps,
};


/* How to add a preset later:
   1. Add one object to PRESETS above: { name, spec, desc, params, build(p), and optionally tile, info(p), notes(p), hw(p),
      steps(p), uses, wall, hung, check(p), joints, variants }. A preset can also live in its own file, with everything
      that belongs to it (rules, plan, pieces, steps, its own self-check): see js/nightstand.js. Such a file is loaded
      after this one, adds itself with PRESETS.push({...}) and puts its name in a group with
      PRESET_GROUPS.find(group=>group[0]==='Bedroom')[1].push(name).
      - spec is the one short line under the name on the preset's tile: what it is made of, in about 25 letters
        ('4x4 legs, plywood top'). desc is the full sentence shown on the right once the tile is picked.
        If the name is too long for a tile (about 20 letters), give a shorter one in tile ('Cabinet stand').
        selfTest() reports a tile whose name or line does not fit.
      - info(p) is a remark shown under the form; when build(p) returns no pieces it must say why nothing fits
        and what to change.
      - params is the form: num('key','Label',default, smallest, largest), {k,label,opts:[[value,label]],v}, {k,label,check:1,v},
        {k,label,v,int:1,min,max}, {head:'Section title'}. The form refuses a number outside smallest and largest and says so.
        Any entry (a heading too) may carry show:p=>... for a row that only belongs on the form with some of the
        choices above it: the Bookshelf's "Opening 3" box shows with three shelves and "Set the height of each
        opening". p holds the values of the rows above. A hidden box is not judged and hands build(p) the value it
        starts with, so build(p) and check(p) must also pass such a field over when it does not apply.
      - build(p) returns the pieces, each made with mk(name, material, [width, height, depth], [x, y, z]).
      - steps(p) returns [{t:'what to do', add:['names of the pieces this step adds']}]. Older presets keep their steps in STEPS, keyed by name.
        A step may also carry fasten:[...] (lines for joints the program cannot see) and hardware:['slide'] (the kinds of placed
        hardware it mounts). The pieces, fasteners and tools under a step are worked out from the model: js/buildsteps.js.
      - THE PRESET RULE (README.md): a preset must pass the structural check in js/verify.js. Tell the check what the
        load-carrying pieces are for with uses:{'Shelf':'books'} (piece name: a key of USES in js/verify.js), which
        pieces are screwed to the wall with wall:['Wall cleat'], give every number a smallest and largest size, and
        return [{level:'stop' or 'warn', text, fix}] from check(p) for numbers that cannot work together. A "stop" keeps
        Create from building it and the message gives the reason and the fix; a "warn" asks Build anyway / Go back.
        Pieces that hang on bought hardware (drawers on slides, doors on hinges) are named in hung:['Drawer side']:
        each must have a wooden neighbour right beside it to mount to (see the top of js/verify.js).
        variants:[{roof:'lean'}] lists other settings of the form that selfTest must also try at every limit.
        selfTest().structural lists every preset that does not pass yet.
      - joints:[['Side','Top','glue']] names the fastener between two kinds of piece (a key of JTYPES in js/joints.js)
        where the one worked out from the shapes alone would be wrong. It is stored like a choice made by hand, and
        the structural check uses it too.
      - look:{finish:'none'} (or style, wood) is the style, wood and finish the design starts with, where the usual
        start (everyday style, pine, clear coat) would be wrong; the outdoor presets use OUTDOOR_LOOK.
      - hw(p) returns bought hardware for the shopping list: [['Cabinet hinges', 4]]. List only what the joints do
        not already count: the screws, nails and glue between the pieces are worked out from the joints, so a screw
        listed here as well is bought twice. Screws into the wall, hinges, slides and braces belong here. Every
        name needs a price: a row of HARDWARE_PRICES in js/prices.js must match it (selfTest checks both).
   2. Give it an entry in CATALOG in js/catalog.js: that is its tile in the Furniture presets window (name, group,
      short line, icon, tags). A preset without an entry shows under "More", and selfTest() reports it.
   3. If it is an outdoor preset, also put its name in the Outdoors row below (the bare-wood checks read it). */
const PRESET_GROUPS=[
 ['Aquariums and fish rooms',['Fish tank wall / rack','Cabinet stand with a row of tanks','Single aquarium stand']],
 ['Tables and seating',['Dining table','Coffee table','Side table / nightstand','Desk','Sturdy bench','Five-board bench','Entryway shoe bench']],
 ['Storage and shelving',['Bookshelf','Garage shelves','Base cabinet with doors','Storage box / toy chest','Wall shelf','Workbench']],
 ['Bedroom',['Platform bed']],
 ['Outdoors',['Shed','Planter box','Raised garden bed','Bird feeder']]];
/* PRESET_GROUPS is the older grouping. The Furniture presets window no longer shows it: its groups, tiles and
   icons are the catalog in js/catalog.js (renderPresetCards there). The checks that outdoor presets start as bare
   wood still read its Outdoors row, and a self-check keeps that row equal to the Outdoors group of the catalog. */
