/* NominalCAD: the cabinet builder, "Cabinet / case" (design/specs/01-cabinet-case-builder.md).

   The pieces of a case (buildCase), the rows of its form (CASE_PARAMS) and the preset itself (PRESETS.push).
   Everything is decided by casePlan (js/caseplan.js); this file only lays the pieces where the plan says. The
   builder never shows under its own name (preset.hidden, js/presetentry.js): a person picks a catalog entry
   (CATALOG, js/catalog.js) such as the Bookshelf, which hands it starting values, the rows shown first and its
   own limits. Loads after js/caseplan.js, js/casecheck.js and js/casesteps.js.

   Stage 1: open cases. The Bookshelf is made by this builder; the Bookshelf preset of js/presets.js is retired
   (below): no longer listed in the presets window, still built by its name for designs saved with it (a design
   saved with it is brought up to date by js/fasteningupgrade.js through it), still swept by selfTest, and held
   piece for piece against this builder by caseMatchesOldPresets (js/casechecks.js). */
'use strict';

/* The pieces, from the plan. Positions are worked out with the sides from z = 0 to the depth and the back behind
   them; at the end everything is moved so the lowest corner of the case is at 0 (the floor stays at y = 0), which
   is where the Bookshelf always stood. */
function buildCase(p){
  const s=casePlan(p),T=s.T,pieces=[];
  const panel=s.mat;                          // sides, dividers, bottoms, shelves, inside top
  const strip=s.boards?'1x4':'ply34';         // toe kick, base, back and top rails
  pieces.push(mk('Side',panel,[T,s.Hc,s.D],[0,0,0]),mk('Side',panel,[T,s.Hc,s.D],[s.W-T,0,0]));
  if(s.top==='inside')pieces.push(mk('Top',panel,[s.W-2*T,T,s.D],[T,s.Hc-T,0]));
  if(s.top==='over'){
    // two rails lying flat between the sides, at the front and the back: the top is screwed up through them. They
    // are cut from the top's sheet of 3/4" plywood, in a 1x case too: the structural check (js/verify.js) finds a
    // 1x4 lying flat too weak under a wide top or a deep overhang, and the plywood strip strong enough
    pieces.push(mk('Top rail','ply34',[s.W-2*T,T,s.railW],[T,s.Hc-T,0]),
      mk('Top rail','ply34',[s.W-2*T,T,s.railW],[T,s.Hc-T,s.D-s.railW]));
  }
  s.bays.forEach((bay,k)=>{
    if(k>0)pieces.push(mk('Divider',panel,[T,s.dividerTop,s.D],[bay.x-T,0,0]));
    pieces.push(mk('Bottom',panel,[bay.len,T,s.D],[bay.x,s.yF,0]));
    for(const y of bay.shelfY)pieces.push(mk('Shelf',panel,[bay.len,T,s.D],[bay.x,y,0]));
    if(s.base==='kick')pieces.push(mk('Toe kick',strip,[bay.len,s.kickH,T],[bay.x,0,s.D-s.kickBack-T]));
    if(s.baseRail)pieces.push(mk('Base rail',strip,[bay.len,s.kickH,T],[bay.x,0,0]));
    if(s.backRail)pieces.push(mk('Back rail',strip,[bay.len,s.railW,T],[bay.x,s.ceilIn-s.railW,0]));
    if(s.top==='rails'){
      // rails standing on edge between the uprights, at the front and the back: a bought top rests on them
      pieces.push(mk('Top rail',strip,[bay.len,s.railW,T],[bay.x,s.Hc-s.railW,0]),
        mk('Top rail',strip,[bay.len,s.railW,T],[bay.x,s.Hc-s.railW,s.D-T]));
    }
  });
  for(const back of s.backPanels)pieces.push(mk('Back panel','ply14',[back.len,s.Hc-s.yF,s.tb],[back.x,s.yF,-s.tb]));
  if(s.topOver)pieces.push(mk('Top','ply34',[s.topOver.len,T,s.topOver.depth],[s.topOver.x,s.Hc,s.topOver.z]));
  // the lowest corner of the case at 0 (left and back)
  const left=Math.min(...pieces.map(piece=>piece.pos[0])),back=Math.min(...pieces.map(piece=>piece.pos[2]));
  for(const piece of pieces){
    piece.pos[0]=r16(piece.pos[0]-left);
    piece.pos[2]=r16(piece.pos[2]-back);
  }
  return pieces;
}

/* ---- the form (section 1.2 of the spec, the rows of stage 1) ----
   The order of the rows is the order they are read in: a row's show(p) is handed the rows above it, so the rows
   that decide the bays (width, what it is made from, the depth, the top, the load) come before "The middle bay
   holds". A catalog entry lists the rows it shows first (entry.short); the rest are under "More options". */
const caseHoldsShelves=p=>caseRecipeHoldsShelves(p.fill)||(caseRecipeHoldsShelves(p.fillMid)&&caseMiddleBay(p));
const caseMiddleBay=p=>{const count=caseBayCount(p);return count>=3&&count%2===1;};
const CASE_KIND_CHOICES=Object.entries(CASE_KINDS).map(([key,kind])=>[key,kind.name]);
const caseRecipeChoices=()=>caseRecipeKeys().map(key=>[key,CASE_RECIPES[key].label]);
const CASE_PARAMS=[
  num('W','Width',30,...CASE.limits.W),
  num('H','Height (floor to the top)',35.25,...CASE.limits.H),
  {k:'kind',label:'Made for',opts:CASE_KIND_CHOICES,v:'basecab'},
  {k:'mat',label:'Made from',opts:[['ply','3/4" plywood'],['boards','1x pine boards']],v:'ply'},
  // (the depth of the sides, not the overall depth: the back panel behind them and a top laid on past their front
  // edges come on top of it, so its label says what it measures: the owner's rule, js/overallsizes.js)
  {...num('D','Depth of the sides',24,...CASE.limits.D),show:p=>p.mat!=='boards'},
  {k:'board',label:'Shelf depth',opts:[['1x8','7 1/4" (1x8)'],['1x10','9 1/4" (1x10)'],['1x12','11 1/4" (1x12)']],v:'1x10',show:p=>p.mat==='boards'},
  // "No back" is not offered: in this stage a case with no back panel always gets the rails, which is "Open back"
  {k:'back',label:'Back',opts:[['panel','1/4" plywood back'],['rails','Open back with rails']],v:'panel'},
  {k:'top',label:'Top',opts:[['inside','Between the sides, flush'],['over','On top, past the edges'],['rails','Rails only, for a top you buy']],v:'over'},
  {k:'use',label:'Shelves hold',opts:[['books','Books'],['shelf','Heavy things (pantry, tools)'],['general','Light things (clothes, linens)']],v:'shelf'},
  {k:'bays',label:'Bays (sections side by side)',opts:[['auto','Let the program choose'],...[1,2,3,4,5,6].map(count=>[String(count),String(count)])],v:'auto'},
  {k:'fill',label:'What goes inside',opts:caseRecipeChoices(),v:'shelves'},
  {k:'fillMid',label:'The middle bay holds',opts:[['same','The same'],...caseRecipeChoices()],v:'same',show:caseMiddleBay},
  // The owner: "bookshelves need a shelf height also" and "make sure book shelves are able to have a desired
  // shelf spacing". Evenly spaced to start with; "At a spacing I choose" fits as many shelves as the height
  // allows at the opening typed, and what is left goes to the top or the bottom opening; "Set the height of each
  // opening" shows one box for each opening below the top one, bottom opening first.
  {k:'spacing',label:'Shelf spacing',opts:[['even','Evenly spaced'],['gap','At a spacing I choose'],['set','Set the height of each opening']],v:'even',show:caseHoldsShelves},
  {k:'n',label:'Shelves inside',v:1,int:1,min:CASE.limits.n[0],max:CASE.limits.n[1],show:p=>caseHoldsShelves(p)&&p.spacing!=='gap'},
  {...num('gap','Opening between shelves (clear height)',CASE.spacing.usual,...CASE.spacing.limits),show:p=>caseHoldsShelves(p)&&p.spacing==='gap'},
  {k:'extra',label:'What is left goes to',opts:[['top','The top opening'],['bottom','The bottom opening']],v:'top',show:p=>caseHoldsShelves(p)&&p.spacing==='gap'},
  {head:'Height of each opening (bottom first; 0 = share what is left)',show:p=>caseHoldsShelves(p)&&p.spacing==='set'&&p.n>=1},
  ...bookshelfOpeningFields().map(field=>({...field,show:p=>caseHoldsShelves(p)&&field.show(p)})),
  {k:'base',label:'Base',opts:[['kick','Toe kick (set back, for your toes)'],['none','None: the sides stand on the floor']],v:'kick'},
  {...num('kickH','Toe kick height',CASE_KINDS.basecab.kickH,...CASE.limits.kickH),show:p=>p.base!=='none'&&p.mat!=='boards'},
  {...num('kickBack','Toe kick set back from the front',CASE_KINDS.basecab.kickBack,...CASE.limits.kickBack),show:p=>p.base!=='none'},
  {...num('overSide','Top overhang at each side',0,...CASE.limits.overSide),show:p=>p.top==='over'},
  {...num('overFront','Top overhang past the front',1,...CASE.limits.overFront),show:p=>p.top==='over'},
  // (only while the case would not be fastened anyway: a case tall for its depth, or a kind always fastened, is)
  {k:'wall',label:'Fasten to the wall',opts:[['auto','When it needs it'],['yes','Always']],v:'auto',show:p=>!casePlan({...p,wall:'auto'}).anchored},
];

/* Other choices the structural sweep of selfTest tries at every limit (README, "The preset rule"): every recipe
   of this stage in one bay and in three, boards, each top, the open back, no toe kick, each spacing, and every
   kind of case. */
const CASE_VARIANTS=[
  {fill:'open'},{bays:'3'},{bays:'3',fill:'shelves',fillMid:'open'},
  {mat:'boards',kind:'bookshelf',use:'books',top:'inside'},
  {mat:'boards',top:'over'},{top:'inside'},{top:'rails'},
  {back:'rails'},{back:'rails',base:'none'},{base:'none'},
  {spacing:'gap',gap:CASE.spacing.limits[0]},{spacing:'gap',gap:CASE.spacing.limits[1],extra:'bottom'},
  {spacing:'set',o1:14,o2:0},
  ...Object.keys(CASE_KINDS).filter(key=>key!=='basecab').map(kind=>({kind})),
];

PRESETS.push({name:CASE_BUILDER,hidden:true,spec:'Shelves, a back, bays side by side',
  desc:'A case of sides, a bottom, a top and fixed shelves, on a toe kick, with a thin back. Wide cases get upright dividers so the shelves cannot sag.',
  params:CASE_PARAMS,
  build:buildCase,check:p=>caseCheck(p),info:p=>caseInfo(p),notes:p=>caseNotes(p),hw:p=>caseHardware(p),steps:p=>caseSteps(p),
  uses:p=>caseUses(p),wall:p=>casePlan(p).anchored,joints:p=>caseJoints(p),variants:CASE_VARIANTS,
  pluggedPockets:casePocketsPlugged,hiddenFace:caseHiddenFace,
  // a shelf more than 54" up takes the angled screws at a divider in its top face (rule 13, js/fastenerreach.js)
  angledScrewsFollowRule13:true});

/* The Bookshelf preset is retired: the catalog's Bookshelf is this builder now (js/catalog.js). */
(function retireTheOldBookshelf(){
  const old=PRESETS.find(preset=>preset.name==='Bookshelf');
  if(old)old.retired=true;
})();
