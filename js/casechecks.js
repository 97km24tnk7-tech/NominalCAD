/* NominalCAD: the self-checks of the cabinet builder (design/specs/01-cabinet-case-builder.md, section 6).

   Stage 0 (the groundwork) has no cabinet preset yet. Its checks hold the shared pieces the builder will stand on:
     drawerStackKeepsTheNightstand   the stack of drawers and the tip check split out of js/nightstand.js still give
                                     the Nightstand's numbers, and work for a bay that is not the Nightstand's
     presetFormFollowsItsEntry       the presets form with a catalog entry's short list ("More options"), its own
                                     limits and start values, a builder named after its entry, afterPlace, and
                                     the hinge side a door piece asks for (js/presetentry.js, js/app.js, js/hanging.js)
     catalogEntryLimitsFit           every entry's short list, limits and start values fit its builder's form
     shelfPinsHold                   a shelf on four shelf pins is held; without them it is not (HARDWARE.pin.holds)
     screwsGoThroughThePieceNamed    a preset's {through:'Piece name'} decides which of two faces a screw starts in
     caseTablesAreWhole              CASE, CASE_KINDS, CASE_RECIPES, PRESET_ALIASES and fitsSheet
   Stage 1 (open cases; the Bookshelf is made by the builder):
     caseMatchesOldPresets           the Bookshelf of the builder against the retired Bookshelf preset, piece for piece,
                                     finding for finding, at its defaults, limits, choices and every width; only the
                                     improvements of 5.5 differ; and the frozen default cut list
     caseSectionsAddUp               every recipe, bay count, top and base: openings add up, nothing overlaps, every
                                     size on the 1/16" grid, every name explained, every piece in exactly one step
     caseEntriesStartClean           each entry of the builder in each style: clean at its start, its short rows at
                                     their limits clean or refused with a reason and a fix, named after the entry
     caseNoHeadsShowing              Everyday and Fine: no head on a top, front or side, for every top and recipe;
                                     Rustic shows the side screws; Fine plugs the pocket holes under the shelves
     caseJointsReachable             in step order, a drill reaches every fastener when its step comes
     caseShelfSpacingFits            "At a spacing I choose": every opening the spacing, the leftover where asked and
                                     never under 7", no shelf more would fit, and the words say what was built
     caseAnchoring                   the wall rules: a back rail, the screws, the last step and the declaration
     caseSecondBoardOnTheRight       at a divider the board on its left is screwed through it, the one on its right
                                     gets the angled screws, as the steps say
     casePlanSpeed                   the plan and the pieces of the largest case in a few milliseconds
   Every check puts the project, the form and the lists back as they were. */
'use strict';

/* The Nightstand's numbers before the split, read from the program on main as it was when this branch took it in
   (16 Nov, after main made the form's Width, Depth and Height the overall size, top included: nightstandCase).
   The split must give them exactly, the tip factor to 1e-9. (The first numbers of this table, written down before
   that change, were for the same p read as the cabinet under the top; the first case still gives them when its p
   is turned into the overall size with nightstandOverall.) */
const NIGHTSTAND_GOLDEN=[
  {p:{W:20,D:16,H:26,N:'2',cub:true,fh:7,slides:'slide',fronts:'overlay'},drawers:2,frontHeight:7,fronts:[11,18.125],shelf:7.25,factor:1.8502112572152591,load:10,pieces:21},
  {p:{W:30,D:24,H:36,N:'1',cub:false,fh:7,slides:'slide',fronts:'overlay'},drawers:3,frontHeight:10.625,fronts:[3,13.75,24.5],shelf:0,factor:1.7139178346142518,load:25,pieces:26},
  {p:{W:14,D:12,H:30,N:'4',cub:true,fh:12,slides:'runner',fronts:'inset'},drawers:4,frontHeight:4.3125,fronts:[10.75,15.1875,19.625,24.0625],shelf:6.125,factor:12.364555078442635,load:10,pieces:33},
  {p:{W:24,D:18,H:20,N:'3',cub:false,fh:7,slides:'runner',fronts:'overlay'},drawers:3,frontHeight:5.625,fronts:[3,8.75,14.5],shelf:0,factor:4.886150743305367,load:10,pieces:26},
  {p:{W:16,D:12,H:36,N:'2',cub:true,fh:12,slides:'slide',fronts:'inset'},drawers:2,frontHeight:11.8125,fronts:[10.625,22.5625],shelf:6,factor:2.421113819710309,load:10,pieces:21},
];

SELFTESTS.push(function drawerStackKeepsTheNightstand(problems){
  const wrong=text=>problems.push('drawer stack: '+text);
  for(const golden of NIGHTSTAND_GOLDEN){
    const plan=nightstandPlan(golden.p),label=JSON.stringify(golden.p);
    const same=plan.drawers===golden.drawers&&plan.frontHeight===golden.frontHeight&&plan.shelfHeight===golden.shelf&&
      JSON.stringify(plan.fronts)===JSON.stringify(golden.fronts)&&plan.tip.load===golden.load&&
      Math.abs(plan.tip.factor-golden.factor)<1e-9&&buildNightstand(golden.p).length===golden.pieces;
    if(!same)wrong(`the Nightstand ${label} no longer comes out as before the split (drawers ${plan.drawers}, fronts ${plan.fronts}, tip ${plan.tip.factor})`);
  }
  // a bay that is not the Nightstand's: the second bay of a case, set forward of the back, its drawers numbered on
  const zone={x:20,width:18,depth:16,z:.75,floorTop:4.25,ceilUnder:30,lapBelow:.75,lapAbove:.625,lapSide:.375,panel:.75,
    style:'overlay',kind:'slide',open:false,firstNumber:4,maxDrawers:6};
  const stack=drawerStackLayout(zone,{drawers:2});
  const opening=stack.openingOf(stack.fronts[0]),top=stack.fronts[stack.fronts.length-1]+stack.frontHeight;
  if(opening.x!==20||opening.z!==.75||opening.width!==18)wrong('a drawer opening is not where its zone is');
  if(stack.drawerOptions(0).name!=='Drawer 4')wrong('the drawers of a second bay are not numbered on from the first');
  if(stack.frontsFrom!==3.5)wrong(`the bottom front should cover the panel under it and start at 3 1/2", not ${stack.frontsFrom}`);
  // (the fronts are cut to the 1/16" below: the top one ends up to 1/16" per drawer short of one gap under the top)
  const frontsTo=zone.ceilUnder+zone.lapAbove;
  if(top>frontsTo+1e-9||frontsTo-top>stack.drawers/16+1e-9)wrong(`the top front ends at ${top}, not one gap under the top (${frontsTo})`);
  if(stack.frontHeight<NS.minFront||stack.frontHeight>NS.maxFront)wrong(`a front of ${stack.frontHeight} is outside the Nightstand's rules`);
  // 25 3/4" of fronts: more than two at 12", so a third drawer is added, and the words say so
  if(stack.drawers!==3||!stack.changed.some(sentence=>/3 drawers were used/.test(sentence)))wrong('a drawer stack with fronts over 12" does not add a drawer and say so');
  // the tip check of one open drawer does not care where the case stands front to back
  const plan=nightstandPlan(NIGHTSTAND_GOLDEN[0].p),pieces=nightstandPieces(plan),moved=pieces.map(piece=>({...piece,pos:[piece.pos[0],piece.pos[1],piece.pos[2]+3]}));
  const here=drawerTipFactor(pieces,plan.drawer,plan.D,'Drawer 2'),there=drawerTipFactor(moved,plan.drawer,plan.D+3,'Drawer 2',3);
  if(Math.abs(here.factor-there.factor)>1e-9||here.load!==there.load)wrong('the tip factor changes when the whole case and its openings move back');
});

/* The presets form with a catalog entry, on a made-up builder and entry (taken out again at the end). */
SELFTESTS.push(function presetFormFollowsItsEntry(problems){
  const wrong=text=>problems.push('presets form with an entry: '+text);
  let seen=null;
  const builder={name:'Self-check case builder',hidden:true,desc:'A made-up builder for the self-check.',
    params:[num('W','Width',30,12,96),num('H','Height',30,16,96),{head:'The case'},num('D','Depth',16,8,30),
      {k:'mat',label:'Made from',opts:[['ply','3/4" plywood'],['boards','1x pine boards']],v:'ply'},
      {...num('X','Board spacing',2,1,9),show:p=>p.mat==='boards'}],
    build(p){
      const T=.75,door=mk('Door','ply34',[p.W-.25,p.H-.25,T],[.125,.125,p.D]);
      door.hinge=p.side||'right';
      return[mk('Side','ply34',[T,p.H,p.D],[0,0,0]),mk('Side','ply34',[T,p.H,p.D],[p.W-T,0,0]),
        mk('Bottom','ply34',[p.W-2*T,T,p.D],[T,0,0]),mk('Top','ply34',[p.W-2*T,T,p.D],[T,p.H-T,0]),door];
    },
    afterPlace(ids,vals){seen={ids:[...ids],vals:{...vals}};}};
  const entry={id:'self-check-case',name:'Self-check cabinet',group:'storage',spec:'Made up',icon:'i-p-cabinet',
    builder:builder.name,tags:[],start:{W:24,D:12,X:5},short:['W','H'],limits:{W:[18,36]}};
  const kept={project:JSON.stringify(S),picked:catalogState.picked,typed:{...catalogState.typed},preset:curPreset,entry:curEntry,
    lastPreset:(()=>{try{return localStorage.getItem(LAST_PRESET_KEY);}catch(e){return null;}})()};
  const box=key=>$(`#presetForm [data-k="${key}"]`);
  PRESETS.push(builder);
  CATALOG.push(entry);
  try{
    if(!catalogPick(entry.id)){wrong('the made-up entry could not be picked');return;}
    if($('#presetForm .pform-h h4').textContent!==entry.name)wrong('a builder that serves several entries does not show the entry name over its form');
    const fold=$('#presetForm .pform-more'),button=$('#presetForm [data-fold]');
    if(!fold||!button){wrong('an entry with a short list has no "More options"');return;}
    if(!fold.hidden||button.textContent!=='More options')wrong('"More options" is not closed at first');
    if(!fold.contains(box('D'))||!fold.contains(box('mat'))||fold.contains(box('W'))||fold.contains(box('H')))wrong('the rows outside the short list are not the ones in the fold');
    if(document.querySelectorAll('#presetForm .sec[data-q="2"]').length!==1||!fold.querySelector('.sec[data-q="2"]'))wrong('a heading whose rows are all folded is not in the fold, once');
    if(box('W').value!==boxLen(24)||box('D').value!==boxLen(12))wrong('the boxes do not start at the entry\'s start values');
    let vals=readVals(false);
    if(!vals||vals.W!==24||vals.D!==12||vals.H!==30||vals.mat!=='ply')wrong('the folded rows are not read like the others: '+JSON.stringify(vals));
    else if(vals.X!==5)wrong(`a hidden row does not keep the entry's start value (${vals.X})`);
    if(!fold.hidden)wrong('the fold opened by itself with every value at its start');
    // the entry's own limits, narrower than the builder's
    box('W').value='40';
    if(readVals(false)!==null||!box('W').classList.contains('bad'))wrong('a width over the entry\'s largest (36") is not refused');
    else if(!presetFieldNote.includes(boxLen(18))||!presetFieldNote.includes(boxLen(36)))wrong('the line under the form does not give the entry\'s limits: '+presetFieldNote);
    box('W').value=boxLen(24);
    // the fold by hand, then by itself: a red box inside it, a value inside it that is not the start value
    button.click();
    if(fold.hidden||button.textContent!=='Fewer options')wrong('"More options" does not open on a click');
    button.click();
    if(!fold.hidden||button.textContent!=='More options')wrong('"Fewer options" does not close the fold');
    box('D').value='5';
    readVals(false);
    if(fold.hidden)wrong('a red box under "More options" does not open the fold');
    setPresetFold(false);
    box('D').value=boxLen(14);
    readVals(false);
    if(fold.hidden)wrong('a value under "More options" that is not the start value does not open the fold');
    box('D').value=boxLen(12);
    setPresetFold(false);
    vals=readVals(false);
    // placed: named after the entry, the builder kept for the checks, afterPlace handed the new pieces
    const nameNow=presetEntryName(builder);
    if(nameNow!==entry.name)wrong('a hidden builder is not given the entry\'s name to place under');
    placePreset(builder,vals,builder.build(vals),false,nameNow);
    const set=S.sets[S.nextSet],top=(S.comps||[]).find(comp=>comp.parent==null);
    if(S.name!==entry.name||!top||top.name!==entry.name)wrong(`the design is named "${S.name}" and its component "${top&&top.name}", not after the entry`);
    if(!set||set.name!==builder.name||set.entry!==entry.name)wrong('the placement does not keep the builder\'s name and the entry\'s');
    if(!seen||seen.ids.length!==S.parts.length||seen.ids.some(id=>!byId(id))||seen.vals.W!==24)wrong('afterPlace was not handed the new pieces and the form values');
    // the hinge side a door piece asks for
    const hingeSide=()=>{
      const door=S.parts.find(piece=>piece.name==='Door'),hinges=(S.hardware||[]).filter(item=>item.on===door.id&&HARDWARE[item.kind].motion==='swing');
      return hinges.length&&hinges.every(item=>item.at[0]>0)?'right':hinges.length&&hinges.every(item=>item.at[0]<0)?'left':'none';
    };
    if(hingeSide()!=='right')wrong(`a door that asks for its hinges on the right is hung on the ${hingeSide()}`);
    placePreset(builder,{...vals,side:'left'},builder.build({...vals,side:'left'}),false,nameNow);
    if(hingeSide()!=='left')wrong(`a door that asks for its hinges on the left is hung on the ${hingeSide()}`);
    // an entry of a builder that is not hidden: the form and the design keep the builder's name, as always
    const plain=CATALOG.find(row=>row.id==='wall-shelf');
    if(plain&&catalogPick(plain.id)){
      if(presetEntryName(curPreset)!==''||$('#presetForm .pform-h h4').textContent!==curPreset.name)wrong('an entry of a preset that is not hidden changes its name');
      if($('#presetForm .pform-more'))wrong('an entry with no short list gets a fold');
    }
  }finally{
    PRESETS.splice(PRESETS.indexOf(builder),1);
    CATALOG.splice(CATALOG.indexOf(entry),1);
    catalogState.picked=kept.picked;
    catalogState.typed=kept.typed;
    load(kept.project,true);
    if(kept.preset&&PRESETS.includes(kept.preset))choosePreset(PRESETS.indexOf(kept.preset),kept.entry);else showNoPreset();
    renderPresetCards();
    try{
      if(kept.lastPreset===null)localStorage.removeItem(LAST_PRESET_KEY);else localStorage.setItem(LAST_PRESET_KEY,kept.lastPreset);
    }catch(e){}
  }
});

/* Every catalog entry's short list names rows of its builder, its limits lie inside the builder's and its start
   values inside its limits (section 5.3 of the spec). */
SELFTESTS.push(function catalogEntryLimitsFit(problems){
  const wrong=text=>problems.push('catalog entry limits: '+text);
  for(const entry of CATALOG){
    const preset=PRESETS.find(row=>row.name===entry.builder);
    if(!preset)continue;
    const field=key=>preset.params.find(q=>q.k===key);
    for(const key of entry.short||[])if(!field(key))wrong(`${entry.name} shows "${key}" first, which its form does not have`);
    for(const[key,limits]of Object.entries(entry.limits||{})){
      const q=field(key);
      if(!q){wrong(`${entry.name} limits "${key}", which its form does not have`);continue;}
      if(!Array.isArray(limits)||limits.length!==2||!(limits[0]<=limits[1]))wrong(`${entry.name}: the limits of ${key} are not [smallest, largest]`);
      else if((q.min!==undefined&&limits[0]<q.min-1e-9)||(q.max!==undefined&&limits[1]>q.max+1e-9))wrong(`${entry.name}: the limits of ${key} reach past the builder's own`);
      const start=entry.start&&key in entry.start?entry.start[key]:q.v;
      if(!(start>=limits[0]-1e-9&&start<=limits[1]+1e-9))wrong(`${entry.name} starts ${key} at ${start}, outside its own limits`);
    }
  }
});

/* A shelf that rests on four shelf pins is held by them (they carry it down to the uprights), and the check says
   so when they are gone. */
SELFTESTS.push(function shelfPinsHold(problems){
  const wrong=text=>problems.push('shelf pins: '+text);
  const kept=JSON.stringify(S);
  try{
    load(JSON.stringify(blank()),true);
    const T=.75,inside=24,D=12,y=15;
    const left=mk('Side','ply34',[T,30,D],[0,0,0]),right=mk('Side','ply34',[T,30,D],[T+inside,0,0]);
    const shelf=mk('Adjustable shelf','ply34',[inside-1/8,T,D-.5],[T+1/16,y,0]);
    addParts([left,right,shelf]);
    const shelfStops=()=>verifyDesign(S.parts,designCheckOptions()).problems.filter(found=>found.level==='stop'&&(found.ids||[]).includes(shelf.id));
    if(!shelfStops().length)wrong('a shelf with nothing under it is not reported');
    // four pins, 1 1/2" in from the front and the back of the shelf, their tops at its underside
    for(const side of[left,right])for(const z of[CASE.pins.fromEdge,D-.5-CASE.pins.fromEdge])
      addOnFace('pin',side,0,side===left?1:-1,{offset:[y-15,z-D/2],to:shelf.id});
    connCache=null;
    const held=shelfStops();
    if(held.length)wrong('a shelf on four shelf pins is still not held: '+held[0].text);
    if(!connGraph().links.some(link=>link.hold&&link.type==='pin'&&(link.a===shelf||link.b===shelf)))wrong('the pins are not a connection of the shelf');
  }finally{
    load(kept,true);
  }
});

/* {through:'Top rail'} in a preset's joints: two 3/4" pieces face to face, screwed through the one named, in every
   style, and a copy of the pair keeps it. */
SELFTESTS.push(function screwsGoThroughThePieceNamed(problems){
  const wrong=text=>problems.push('screws through the piece named: '+text);
  const kept=JSON.stringify(S),style=S.look&&S.look.style;
  try{
    load(JSON.stringify(blank()),true);
    S.look={style:'std',wood:'pine',finish:'clear'};
    // the false front first in the design: left to itself, the screws would start in its show face
    const front=mk('False front','ply34',[20,6,.75],[0,10,12.75]),rail=mk('Top rail','ply34',[20,3.5,.75],[0,12.5,12]);
    addParts([front,rail]);
    const throughOf=()=>{
      connCache=null;
      const j=findJoints().find(joint=>(joint.a===front&&joint.b===rail)||(joint.a===rail&&joint.b===front));
      return j?[...new Set(fastenerLayout(j,'screw').map(f=>f.through&&f.through.name))].join(', '):'no joint';
    };
    if(throughOf()!=='False front')wrong(`the test pair is screwed through the ${throughOf()} without a word from the preset: it shows nothing`);
    storeNamedJoints({joints:[['False front','Top rail','screw',{through:'Top rail'}]]},[front,rail]);
    for(const look of['std','rustic','fine']){
      S.look.style=look;
      if(throughOf()!=='Top rail')wrong(`in ${look} the screws go through the ${throughOf()}, not the Top rail the preset named`);
    }
    S.look.style='std';
    // a copy of the two keeps the word
    const clones=[front,rail].map(piece=>({...JSON.parse(JSON.stringify(piece)),pos:[piece.pos[0]+40,piece.pos[1],piece.pos[2]]}));
    addCopies([front,rail],clones);
    connCache=null;
    const j=findJoints().find(joint=>joint.a.id===clones[0].id||joint.b.id===clones[0].id);
    const through=j?[...new Set(fastenerLayout(j,'screw').map(f=>f.through&&f.through.name))].join(', '):'no joint';
    if(through!=='Top rail')wrong(`a copy of the pair is screwed through the ${through}`);
    // the row is read as before by everything that only wants the fastener
    const plain=findJoints()[0];
    if(namedJointType(plain,[['False front','Top rail','screw',{through:'Top rail'}]])!=='screw')wrong('a row with {through} does not give its fastener');
  }finally{
    load(kept,true);
    if(style&&S.look)S.look.style=style;
  }
});

/* The tables of js/casedata.js are whole: every use a load table knows, every section a known kind, every alias
   a catalog entry, and the sheet size the plywood store sells. */
SELFTESTS.push(function caseTablesAreWhole(problems){
  const wrong=text=>problems.push('cabinet tables: '+text);
  for(const[key,kind]of Object.entries(CASE_KINDS)){
    for(const use of Object.values(kind.uses))if(!USES[use])wrong(`${key} uses "${use}", which is not in USES`);
    if(!(kind.kickH>=CASE.limits.kickH[0]&&kind.kickH<=CASE.limits.kickH[1]))wrong(`${key}: the toe kick of ${kind.kickH} is outside its limits`);
    if(!(kind.kickBack>=CASE.limits.kickBack[0]&&kind.kickBack<=CASE.limits.kickBack[1]))wrong(`${key}: the set back of ${kind.kickBack} is outside its limits`);
    if(!kind.word||!kind.name)wrong(`${key} has no words`);
  }
  for(const[key,recipe]of Object.entries(CASE_RECIPES)){
    if(!recipe.label||/—/.test(recipe.label))wrong(`${key} has no plain label`);
    for(const section of recipe.sections)if(!CASE_SECTION_KINDS.includes(section.kind))wrong(`${key} has a section of kind "${section.kind}"`);
  }
  for(const[name,id]of Object.entries(PRESET_ALIASES)){
    if(!CATALOG.some(entry=>entry.id===id))wrong(`the old name "${name}" opens "${id}", which is not in the catalog`);
    if(!PRESETS.some(preset=>preset.name===name)&&!CATALOG.some(entry=>entry.id===id))wrong(`"${name}" is neither a preset nor an entry`);
  }
  if(!fitsSheet(48,96)||!fitsSheet(96,48)||fitsSheet(48.5,96)||fitsSheet(24,97))wrong('fitsSheet does not match a 4 ft by 8 ft sheet');
  if(CASE.oneDoorBelow!==20.75)wrong(`one door below ${CASE.oneDoorBelow}, not 20 3/4" (today's Base cabinet)`);
  // the visit counter may send the names of the catalog's entries (a Dresser of the cabinet builder), and only those
  for(const entry of CATALOG)if(!VISIT_PRESET_NAMES.includes(entry.name))wrong(`the visit counter cannot send the entry name "${entry.name}"`);
});

/* ======================================================================================================
   Stage 1: open cases. The Bookshelf entry is made by the cabinet builder.
   ====================================================================================================== */
const caseBuilder=()=>PRESETS.find(preset=>preset.name===CASE_BUILDER);
const caseEntry=id=>CATALOG.find(entry=>entry.id===id);
/* the form values of an entry of the builder, with more on top */
const caseEntryVals=(id,more)=>({...presetDefaults(caseBuilder()),...(caseEntry(id).start||{}),...(more||{})});
/* the pieces as name, material, size and place, the whole list moved so its lowest corner is at 0, sorted */
function casePieceLines(parts){
  const lo=[0,1,2].map(k=>Math.min(...parts.map(piece=>piece.pos[k])));
  return parts.map(piece=>[piece.name,piece.mat,...size(piece).map(v=>v.toFixed(4)),...piece.pos.map((v,k)=>(v-lo[k]).toFixed(4))].join(' ')).sort();
}
/* The Bookshelf's default cut list as the retired preset made it (name, length, width, thickness): it stays the
   net once the old preset is deleted. */
const CASE_BOOKSHELF_DEFAULT_CUT=['Back panel 44.5 32 0.25','Back rail 30.5 3.5 0.75','Base rail 30.5 3.5 0.75','Bottom 30.5 9.25 0.75',
  'Shelf 30.5 9.25 0.75','Shelf 30.5 9.25 0.75','Shelf 30.5 9.25 0.75','Side 48 9.25 0.75','Side 48 9.25 0.75','Toe kick 30.5 3.5 0.75','Top 30.5 9.25 0.75'];

/* 6.1 of the spec. The improvements the builder makes on purpose (5.5): no opening under 6" in any case (the old
   Bookshelf allowed 4" between plain sides), a shelf never spans more than 32" (between 33 1/2" and 34 3/4" wide it
   gets a divider, between 64 3/4" and 67 5/16" three bays: the spec wrote 66 1/4", but a bay beside a divider
   is measured to the middle of the divider, so 2 bays end at 64 3/4"). Everything else must be the same. */
SELFTESTS.push(function caseMatchesOldPresets(problems){
  const wrong=text=>{if(problems.length<80)problems.push('cabinet builder against the old Bookshelf: '+text);};
  const builder=caseBuilder();
  if(!builder||!caseEntry('bookshelf')){wrong('the builder or its Bookshelf entry is missing');return;}
  const cut=buildCase(caseEntryVals('bookshelf')).map(piece=>[piece.name,piece.l,piece.w,piece.t].join(' ')).sort();
  if(cut.join('|')!==CASE_BOOKSHELF_DEFAULT_CUT.join('|'))wrong('the default Bookshelf cut list is not the one it always was: '+cut.join(', '));
  const old=PRESETS.find(preset=>preset.name==='Bookshelf');
  if(!old)return;   // deleted: the frozen cut list above is the net
  const oldVals=more=>({...presetDefaults(old),...more});
  const newVals=more=>caseEntryVals('bookshelf',{...more,...('back' in more?{back:more.back?'panel':'rails'}:{})});
  const inRanges=W=>(W>33.5-1e-6&&W<34.75+1e-6)||(W>64.75+1e-6&&W<67.3125+1e-6);
  const findings=check=>check.problems.filter(f=>f.level==='stop'||f.level==='warn').map(f=>f.level+':'+f.code).sort().join(',');
  const compare=(more,full)=>{
    const label=JSON.stringify(more);
    const before=oldVals(more),after=newVals(more);
    const oldStop=(old.check(before)||[]).some(f=>f.level==='stop'),newStop=caseCheck(after).some(f=>f.level==='stop');
    if(oldStop&&newStop)return;
    const plan=bookshelfPlan(before),lowest=Math.min(...bookshelfBuiltOpenings(plan));
    if(newStop){
      if(!(lowest<CASE.leastOpening-1e-6))wrong(`${label}: the builder refuses what the old Bookshelf built (${caseCheck(after)[0].text})`);
      return;
    }
    if(oldStop){wrong(`${label}: the builder builds what the old Bookshelf refused`);return;}
    const a=casePieceLines(old.build(before)),b=casePieceLines(buildCase(after));
    if(a.join('|')!==b.join('|')){
      const bays=plan.bays.length!==casePlan(after).bays.length;
      if(!(bays&&inRanges(sizeWithin(more.W===undefined?32:more.W,[12,72]))))wrong(`${label}: pieces differ (${a.filter(line=>!b.includes(line))[0]||'more pieces'} / ${b.filter(line=>!a.includes(line))[0]||'fewer pieces'})`);
      return;
    }
    if(JSON.stringify(old.hw(before))!==JSON.stringify(builder.hw(after)))wrong(`${label}: the hardware lines differ`);
    if(full){
      const x=findings(checkPreset(old,before)),y=findings(checkPreset(builder,after));
      if(x!==y)wrong(`${label}: the findings differ (${x||'none'} / ${y||'none'})`);
    }
  };
  // the defaults, every number of the old form at its smallest and largest, with and without a back, and the old
  // preset's variants (its "4 then 6" openings are now "6 then 6": 5.5)
  const numbers=old.params.filter(q=>q.k&&!q.opts&&!q.check&&q.min!==undefined);
  const variants=[{},{back:false},...(old.variants||[]).map(variant=>variant.o1===4?{...variant,o1:6}:variant)];
  for(const variant of variants){
    compare(variant,true);
    for(const q of numbers)for(const limit of[q.min,q.max])compare({...variant,[q.k]:limit},true);
  }
  // every width, each board, no shelf and the most, the tallest case: the pieces only
  for(const board of['1x8','1x10','1x12'])for(const n of[0,8])for(let W=12;W<=72;W+=.75)compare({W,H:84,board,n},false);
  for(const H of[24,30,36,48,60,72,84])for(const n of[1,3,5])compare({H,n},false);
});

/* 6.2: the sections, panels and openings of every bay add up to the inside height; the pieces do not overlap, are
   on the 1/16" grid, are explained by a word of TERMS (js/glossary.js) and each one is in exactly one step. */
SELFTESTS.push(function caseSectionsAddUp(problems){
  const wrong=text=>{if(problems.length<80)problems.push('cabinet sections: '+text);};
  const builder=caseBuilder();
  if(!builder)return;
  const base=presetDefaults(builder),grid=v=>Math.abs(v*16-Math.round(v*16))<1e-6;
  const sizes=[{},{W:CASE.limits.W[0]},{W:CASE.limits.W[1]},{H:CASE.limits.H[0]+12},{H:CASE.limits.H[1]},{W:60,mat:'boards',top:'inside'}];
  for(const fill of caseRecipeKeys())for(const bays of['auto','2','3'])for(const top of['inside','over','rails'])for(const baseKind of['kick','none'])for(const more of sizes){
    const vals={...base,fill,bays,top,base:baseKind,n:3,...more},label=JSON.stringify({fill,bays,top,base:baseKind,...more});
    if(caseCheck(vals).some(f=>f.level==='stop'))continue;
    const plan=casePlan(vals);
    for(const bay of plan.bays){
      const sum=bay.sections.reduce((total,section)=>total+section.clear,0)+(bay.sections.length-1)*plan.T;
      if(Math.abs(sum-plan.inside)>1/32)wrong(`${label}: the sections of a bay add up to ${sum}, not ${plan.inside}`);
      if(bay.shelfY.length){
        const openings=caseBuiltOpenings(plan),total=openings.reduce((a,b)=>a+b,0)+bay.shelfY.length*plan.T;
        if(Math.abs(total-plan.shelfSection.clear)>1/32||openings.some(o=>o<CASE.leastOpening-1e-6))wrong(`${label}: the openings ${openings.map(fmt).join(', ')} do not fill the section`);
      }
    }
    const parts=buildCase(vals);
    const boxes=parts.map(piece=>({piece,b:box(piece)}));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i].b,b=boxes[j].b;
      if([0,1,2].every(k=>a.lo[k]<b.hi[k]-1e-3&&b.lo[k]<a.hi[k]-1e-3)){wrong(`${label}: ${boxes[i].piece.name} and ${boxes[j].piece.name} overlap`);break;}
    }
    for(const piece of parts){
      if(!size(piece).every(v=>v>0&&grid(v))||!piece.pos.every(grid)){wrong(`${label}: the ${piece.name} is not on the 1/16" grid (${size(piece)} at ${piece.pos})`);break;}
      if(typeof termFor==='function'&&!termFor(piece.name)){wrong(`${label}: no word explains "${piece.name}"`);break;}
    }
    if(parts.some(piece=>box(piece).lo[1]<-1e-6))wrong(`${label}: a piece is below the floor`);
    const steps=caseSteps(vals),names=new Set(parts.map(piece=>piece.name));
    for(const name of names){
      const count=steps.filter(step=>step.add.includes(name)).length;
      if(count!==1)wrong(`${label}: the ${name} is in ${count} steps`);
    }
  }
});

/* 6.3: every entry of the builder, in every style: clean at its start; each row of its short list at the entry's
   smallest and largest clean or refused with a reason and a fix; the design and its component named after it. */
SELFTESTS.push(function caseEntriesStartClean(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('cabinet entries: '+text);};
  const builder=caseBuilder();
  if(!builder)return;
  const kept=JSON.stringify(S),keptEntry=curEntry,keptPreset=curPreset;
  try{
    for(const entry of CATALOG.filter(row=>row.builder===CASE_BUILDER)){
      const start=caseEntryVals(entry.id);
      for(const style of Object.keys(STYLES)){
        const check=checkPreset(builder,start,null,{style});
        if(check.problems.some(f=>f.level==='stop'||f.level==='warn'))wrong(`${entry.name} in ${STYLES[style][0]}: ${check.problems[0].text}`);
      }
      for(const key of entry.short||[]){
        const q=builder.params.find(row=>row.k===key);
        if(!q||q.opts||q.check)continue;
        const limits=(entry.limits&&entry.limits[key])||[q.min,q.max];
        for(const limit of limits){
          if(limit===undefined)continue;
          const vals={...start,[key]:limit};
          if(q.show&&!q.show(vals))continue;
          const check=checkPreset(builder,vals);
          if(check.refused){if(check.stops.some(f=>!(f.text&&f.fix)))wrong(`${entry.name} at ${key} = ${limit}: refused without a reason and a fix`);}
          else if(check.problems.some(f=>f.level==='stop'||f.level==='warn'))wrong(`${entry.name} at ${key} = ${limit}: ${check.problems[0].text}`);
        }
      }
      // placed from its entry: named after the entry
      curPreset=builder;curEntry=entry;
      placePreset(builder,start,builder.build(start),false,presetEntryName(builder));
      const top=(S.comps||[]).find(comp=>comp.parent==null);
      if(S.name!==entry.name||!top||top.name!==entry.name)wrong(`${entry.name} is placed as "${S.name}"`);
    }
  }finally{
    curEntry=keptEntry;curPreset=keptPreset;
    load(kept,true);
  }
});});

/* 6.5: Everyday and Fine furniture show no fastener head on a top, a front or the outside of a side, for every
   recipe and every kind of top, in one bay and in three; Rustic / rough shows the screws through the sides; Fine
   furniture plugs the pocket holes under the shelves (the owner has not said yet for Everyday: they stay open). */
SELFTESTS.push(function caseNoHeadsShowing(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('cabinet show faces: '+text);};
  const builder=caseBuilder();
  if(!builder)return;
  const kept=JSON.stringify(S),faces=['top','front','side'];
  try{
    const cases=[caseEntryVals('bookshelf'),caseEntryVals('bookshelf',{W:12}),caseEntryVals('bookshelf',{W:72,H:84,n:8}),
      // an open back on a case that stands on its own (nothing covers the back rail), an open middle bay, a tall
      // case whose high shelves take their holes in the top face
      caseEntryVals('bookshelf',{W:72,H:36,n:1,back:'rails'}),caseEntryVals('bookshelf',{W:72,H:48,bays:'3',fillMid:'open'}),
      caseEntryVals('bookshelf',{W:72,H:84,n:6}),{...presetDefaults(builder),W:60,bays:'5',fill:'shelves',fillMid:'open',n:2},
      ...['inside','over','rails'].flatMap(top=>caseRecipeKeys().map(fill=>({...presetDefaults(builder),top,fill,bays:'3',W:60}))),
      {...presetDefaults(builder),top:'rails',back:'rails',W:30,H:30}];
    for(const vals of cases){
      if(caseCheck(vals).some(f=>f.level==='stop'))continue;
      const label=JSON.stringify({W:vals.W,H:vals.H,top:vals.top,fill:vals.fill,fillMid:vals.fillMid,back:vals.back,mat:vals.mat});
      for(const style of['std','fine']){
        placeInStyle(builder,vals,style);
        const showing=headsOnShowFaces().filter(head=>faces.includes(head.face)||head.face==='under');
        if(showing.length)wrong(`${label} in ${STYLES[style][0]}: ${showing.length} heads show on the ${showing[0].face} (${showing[0].f.through.name} into ${showing[0].f.into.name})`);
        // nothing opens on a face that looks to the front (the front of a back rail with no back panel behind it)
        const toFront=showingHeads().filter(head=>head.face==='front');
        if(toFront.length)wrong(`${label} in ${STYLES[style][0]}: ${toFront.length} heads or holes face the front (${toFront[0].f.through.name} into ${toFront[0].f.into.name})`);
        // a screw through a divider into a shelf only where another shelf covers its head on the other face
        const lone=fastenerHeads().filter(head=>head.f.kind==='screw'&&head.f.through.name==='Divider'&&head.f.into.name==='Shelf'&&!head.covered&&
          !S.parts.some(piece=>piece.name==='Shelf'&&piece!==head.f.into&&[0,1,2].every(k=>box(piece).lo[k]-.05<=head.at[k]&&head.at[k]<=box(piece).hi[k]+.05)));
        if(lone.length)wrong(`${label} in ${STYLES[style][0]}: ${lone.length} screw heads on a divider are in plain sight in an open bay`);
        // Fine furniture plugs every pocket hole of the shelves and the top: under them, and the top faces of the high ones
        const open=fastenerHeads().filter(head=>head.f.kind==='pocket'&&['Shelf','Top','Top rail'].includes(head.f.through.name)&&!head.covered&&Math.abs(head.out[1])>.5);
        if(style==='fine'&&open.length)wrong(`${label} in Fine furniture: ${open.length} pocket holes of the ${open[0].f.through.name} at ${fmt(open[0].at[1])} are not plugged`);
        if(style==='std'&&fastenerHeads().some(head=>head.f.kind==='pocket'&&head.f.through.name==='Shelf'&&head.covered&&head.at[1]<SEEN.underAbove))wrong(`${label} in Everyday: low pocket holes under the shelves are plugged (the owner has not asked for that yet)`);
      }
      placeInStyle(builder,vals,'rustic');
      if(!showingHeads().some(head=>head.face==='side'))wrong(`${label} in Rustic / rough: no screw goes in through the sides`);
    }
  }finally{load(kept,true);}
});});

/* 6.6: in the order of the steps, a drill reaches every fastener when its step comes: from the head straight out
   along the screw, nothing that is already in place is in the way for 6" behind a screw (js/buildsteps.js gives a
   pocket hole with less than the usual room its own words and a right-angle drill, so a pocket hole only needs
   DRIVER_ROOM.least). Pieces of one step go in bay by bay from the left, bottom up. At most 400 fasteners. */
SELFTESTS.push(function caseJointsReachable(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('cabinet drill room: '+text);};
  const builder=caseBuilder();
  if(!builder)return;
  const kept=JSON.stringify(S);
  try{
    const cases=[caseEntryVals('bookshelf'),caseEntryVals('bookshelf',{W:72,H:84,n:8}),caseEntryVals('bookshelf',{W:12,H:24,n:1}),
      {...presetDefaults(builder),W:60,bays:'3'},{...presetDefaults(builder),top:'rails',W:60},{...presetDefaults(builder),top:'inside',base:'none'}];
    for(const vals of cases)for(const style of Object.keys(STYLES)){
      if(caseCheck(vals).some(f=>f.level==='stop'))continue;
      placeInStyle(builder,vals,style);
      const label=`${JSON.stringify({W:vals.W,H:vals.H,top:vals.top,base:vals.base})} in ${STYLES[style][0]}`;
      // the order the pieces go in: step by step, and inside a step bay by bay from the left, bottom up
      const order=new Map();
      (S.steps||[]).forEach((step,index)=>{
        const pieces=(step.ids||[]).map(byId).filter(Boolean).sort((a,b)=>box(a).lo[0]-box(b).lo[0]||box(a).lo[1]-box(b).lo[1]);
        pieces.forEach((piece,k)=>order.set(piece.id,index*1000+k));
      });
      let seen=0;
      for(const link of connGraph().links){
        if(!link.joint||!link.fastened)continue;
        for(const f of fastenersOfLink(link)){
          if(++seen>400)break;
          if(!['screw','pocket'].includes(f.kind)||!f.through)continue;
          const when=Math.max(order.get(f.through.id)||0,order.get(f.into.id)||0);
          const length=Math.hypot(...f.dir)||1,back=f.dir.map(v=>-v/length);
          const from=pointPlus(f.kind==='pocket'?f.pocket.mouth:pointPlus(f.pos,f.dir,-(f.sunk||0)),back,.05);
          const need=f.kind==='pocket'?DRIVER_ROOM.least:6;
          let room=Infinity,blocker=null;
          for(const piece of S.parts){
            if(piece===f.through||piece===f.into||isProp(piece)||tilted(piece)||!(order.get(piece.id)<when))continue;
            const distance=rayDistanceToBox(from,back,plainBox(piece));
            if(distance<room){room=distance;blocker=piece;}
          }
          if(room<need){wrong(`${label}: the ${f.kind==='pocket'?'pocket screws':'screws'} through the ${f.through.name} into the ${f.into.name} have ${fmt(room)} of room behind them before the ${blocker.name}, which is already in place`);break;}
        }
      }
    }
  }finally{load(kept,true);}
});});

/* 6.9, for the spacing the Bookshelf has ("At a spacing I choose"): for every height of the Bookshelf (each 2")
   and every spacing (each inch, and two odd sixteenths), one bay and dividers, the leftover at the top and at the
   bottom: every opening but the leftover one is the spacing to 1/16", the leftover is where it was asked and never
   under 7", one more shelf would not have fitted, the case heights offered really give openings all the same, and
   the remark and the steps say what was built. */
SELFTESTS.push(function caseShelfSpacingFits(problems){
  const wrong=text=>{if(problems.length<60)problems.push('cabinet shelf spacing: '+text);};
  if(!caseBuilder())return;
  const on16=(a,b)=>Math.abs(a-b)<1/32,entry=caseEntry('bookshelf'),[lowH,highH]=entry.limits.H;
  const spacings=[];
  for(let g=CASE.spacing.limits[0];g<=CASE.spacing.limits[1];g+=1)spacings.push(g);
  spacings.push(9+3/16,12+15/16);
  for(const W of[32,72])for(let H=lowH;H<=highH;H+=2)for(const g of spacings)for(const at of['top','bottom']){
    const vals=caseEntryVals('bookshelf',{W,H,spacing:'gap',gap:g,extra:at}),plan=casePlan(vals),label=`${W}" wide, ${fmt(H)} tall, ${fmt(g)} apart, leftover at the ${at}: `;
    const got=caseBuiltOpenings(plan),n=plan.shelves,leftAt=at==='top'?got.length-1:0;
    if(got.length!==n+1){wrong(label+`${got.length} openings for ${n} shelves`);continue;}
    if(got.some((height,i)=>i!==leftAt&&!on16(height,g)))wrong(label+'openings built as '+got.map(fmt).join(', '));
    if(got[leftAt]<CASE.spacing.leastLeftover-1/32)wrong(label+`the leftover opening is ${fmt(got[leftAt])}, lower than 7"`);
    if(n<CASE.limits.n[1]&&got[leftAt]>=g+plan.T+CASE.spacing.leastLeftover-1/32)wrong(label+`one more shelf would have fitted (leftover ${fmt(got[leftAt])})`);
    for(const height of plan.fit.evenAt){
      const even=caseBuiltOpenings(casePlan({...vals,H:height}));
      if(height<lowH||height>highH||even.some(opening=>!on16(opening,g)))wrong(label+`the case height offered for openings all the same, ${fmt(height)}, builds ${even.map(fmt).join(', ')}`);
    }
    if(caseCheck(vals).length)wrong(label+'refused: '+caseCheck(vals)[0].text);
    const said=caseInfo(vals);
    if(!said.includes(n?`${shelvesWord(n)} ${n===1?'fits':'fit'}`:'No shelf fits')||!said.includes(typedLen(r16(got[leftAt]))))wrong(label+'the remark does not say how many shelves and the leftover: '+said);
    if(n&&!caseSteps(vals).map(step=>step.t).join(' ').includes(got.map(fmt).join(', ')))wrong(label+'the steps do not give the openings '+got.map(fmt).join(', '));
  }
});

/* 6.11: each rule that fastens a case to the wall gives it a back rail (or the on-edge rail at the back of its
   top), the screws into the studs, the last step's words and the declaration for Check my design. */
SELFTESTS.push(function caseAnchoring(problems){
  const wrong=text=>problems.push('cabinet on the wall: '+text);
  const builder=caseBuilder();
  if(!builder)return;
  const low={...presetDefaults(builder),H:30,D:16,wall:'auto'};
  const cases=[['tall',{...low,H:72,D:12}],['kind',{...low,kind:'pantry'}],['asked',{...low,wall:'yes'}],['asked',{...low,wall:'yes',top:'rails'}],['none',low]];
  for(const[rule,vals]of cases){
    const plan=casePlan(vals),parts=buildCase(vals),steps=caseSteps(vals),last=steps[steps.length-1].t;
    const fastened=rule!=='none';
    if(plan.anchored!==fastened||builder.wall(vals)!==fastened){wrong(`rule "${rule}" ${fastened?'does not fasten':'fastens'} the case`);continue;}
    if(!fastened){
      if(caseHardware(vals).length||/drive two 3" screws/.test(last))wrong('a case that stands on its own is told to go on the wall');
      continue;
    }
    const rail=parts.some(piece=>piece.name==='Back rail')||(vals.top==='rails'&&parts.some(piece=>piece.name==='Top rail'&&piece.pos[2]<=CASE.back+1e-6));
    if(!rail)wrong(`rule "${rule}": no rail at the back for the wall screws`);
    const screws=caseHardware(vals);
    if(!screws.length||screws[0][1]!==2*Math.max(1,Math.ceil(vals.W/16)))wrong(`rule "${rule}": the screws into the studs are not listed (${JSON.stringify(screws)})`);
    if(!/drive two 3" screws through/.test(last))wrong(`rule "${rule}": the last step does not fasten it to the wall: ${last}`);
  }
});

/* The first board at a divider is the one on its left, as the steps say (CASE_SECOND_BOARD, js/casesteps.js): in
   Rustic / rough the straight screws go through the divider into the left board, and the right board gets the
   angled ones, at every divider of a three-bay Bookshelf. */
SELFTESTS.push(function caseSecondBoardOnTheRight(problems){withoutDrawing(()=>{
  const wrong=text=>problems.push('cabinet divider screws: '+text);
  const builder=caseBuilder();
  if(!builder)return;
  const kept=JSON.stringify(S);
  try{
    placeInStyle(builder,caseEntryVals('bookshelf',{W:72,H:48}),'rustic');
    for(const link of connGraph().links){
      if(!link.joint||!link.fastened)continue;
      const divider=[link.joint.a,link.joint.b].find(piece=>piece.name==='Divider'),board=[link.joint.a,link.joint.b].find(piece=>piece!==divider);
      if(!divider||!['Shelf','Bottom'].includes(board.name))continue;
      const onLeft=box(board).hi[0]<=box(divider).lo[0]+1e-6,list=fastenersOfLink(link);
      const straight=list.length&&list.every(f=>f.through===divider&&!f.toe),angled=list.length&&list.every(f=>f.through===board);
      if(onLeft&&!straight)wrong(`the ${board.name} on the left of a divider at ${fmt(box(board).lo[1])} is not screwed straight through the divider`);
      if(!onLeft&&!angled)wrong(`the ${board.name} on the right of a divider at ${fmt(box(board).lo[1])} is not the one with the angled screws`);
    }
    if(!caseSteps(caseEntryVals('bookshelf',{W:72})).some(step=>(step.byStyle?step.byStyle.rustic:step.t).includes('the board in the bay on its left first')))wrong('the steps do not say which board goes first');
  }finally{load(kept,true);}
});});

/* 6.13: the plan and the pieces of the largest case are quick enough for the live picture, which asks on every key. */
SELFTESTS.push(function casePlanSpeed(problems){
  const builder=caseBuilder();
  if(!builder)return;
  const vals={...presetDefaults(builder),W:CASE.limits.W[1],H:CASE.limits.H[1],D:CASE.limits.D[1],n:8};
  const started=performance.now();
  for(let i=0;i<5;i++){casePlanMemo={key:null,plan:null};buildCase({...vals,W:vals.W-i/16});}
  const each=(performance.now()-started)/5;
  if(each>30)problems.push(`cabinet speed: the plan and the pieces of the largest case take ${each.toFixed(1)} ms, more than 30`);
});

/* After the reviews of stage 1 (the woodworker's and the code reader's):
     caseOldNamesOpenTheirEntry   a browser that last made the old Bookshelf opens the Bookshelf entry, not the
                                  retired preset; the name the builder goes by is never shown (the tile's tip)
     oldBookshelfKeepsItsScrews   a design of the retired Bookshelf keeps its angled screws where its steps say (the
                                  underside), however high the shelf: rule 13 for those screws is the builder's own
     caseDrillsAheadAndHasRoom    Everyday: every pocket hole is drilled in the marking step; a case too narrow for a
                                  pocket-hole drill asks for no right-angle attachment; a step that does is on the
                                  Tools list; a close-up at a divider is seen from the front */
SELFTESTS.push(function caseOldNamesOpenTheirEntry(problems){
  const wrong=text=>problems.push('cabinet old names: '+text);
  if(!caseBuilder())return;
  const keptPicked=catalogState.picked;
  let keptName=null;
  try{keptName=localStorage.getItem(LAST_PRESET_KEY);}catch(e){}
  try{
    const entry=presetEntryForName('Bookshelf');
    if(!entry||entry.id!=='bookshelf')wrong('the old name "Bookshelf" does not open the Bookshelf entry');
    if(presetEntryForName('Garage shelves'))wrong('a preset that is still listed is sent to an entry');
    try{localStorage.setItem(LAST_PRESET_KEY,'Bookshelf');}catch(e){}
    const index=startingPreset();
    if(PRESETS[index]!==caseBuilder()||catalogState.picked!=='bookshelf')wrong(`a browser that last made the old Bookshelf starts on "${PRESETS[index]&&PRESETS[index].name}" (${catalogState.picked})`);
    const tip=tileHtml(caseEntry('bookshelf'),new Set(),false);
    if(tip.includes(CASE_BUILDER))wrong('the Bookshelf tile names the builder ("'+CASE_BUILDER+'") in its tip');
  }finally{
    catalogState.picked=keptPicked;
    try{if(keptName===null)localStorage.removeItem(LAST_PRESET_KEY);else localStorage.setItem(LAST_PRESET_KEY,keptName);}catch(e){}
  }
});
SELFTESTS.push(function oldBookshelfKeepsItsScrews(problems){withoutDrawing(()=>{
  const old=PRESETS.find(preset=>preset.name==='Bookshelf');
  if(!old)return;
  const kept=JSON.stringify(S);
  try{
    placeInStyle(old,{...presetDefaults(old),W:48,H:84,n:8},'std');
    const moved=fastenerHeads().filter(head=>head.f.through.name==='Shelf'&&head.f.into.name==='Divider'&&head.out[1]>.5);
    if(moved.length)problems.push(`old Bookshelf: ${moved.length} angled screws at its divider start in the top face of a shelf, while its steps say the underside`);
  }finally{load(kept,true);}
});});
SELFTESTS.push(function caseDrillsAheadAndHasRoom(problems){withoutDrawing(()=>{
  const wrong=text=>problems.push('cabinet drilling: '+text);
  const builder=caseBuilder();
  if(!builder)return;
  const kept=JSON.stringify(S);
  try{
    for(const vals of[caseEntryVals('bookshelf'),caseEntryVals('bookshelf',{W:40})]){
      placeInStyle(builder,vals,'std');
      const plan=buildPlan();
      // the pocket holes are drilled ahead: in step 2 "Drill your pieces" (js/drillplan.js), which then holds every
      // one of them on a drawing and the marking step after it does not say it again; without step 2, in the
      // marking step's own words
      const drillStep=plan.steps.find(step=>step.kind==='drill');
      if(drillStep){
        if(plan.steps[1]!==drillStep)wrong(`${vals.W}" wide: "Drill your pieces" is not the step right after cutting`);
        if(!plan.drill.complete)wrong(`${vals.W}" wide: some pocket holes drilled ahead have no drawing`);
        if(/drill every pocket hole now/.test(plan.steps[2].words))wrong(`${vals.W}" wide: the marking step tells to drill the pocket holes that step 2 holds`);
      }else if(!/drill every pocket hole now/.test(plan.steps[1].words))wrong(`${vals.W}" wide: the marking step does not drill the pocket holes ahead`);
      const tight=plan.steps.some(step=>(step.tight||[]).length);
      const listed=toolList(findJoints(),plan).some(tool=>/right-angle/i.test(tool));
      if(tight!==listed)wrong(`${vals.W}" wide: a step ${tight?'asks for':'does not ask for'} a right-angle drill attachment, and the Tools list ${listed?'has':'does not have'} one`);
      // the close-up of the screws through a divider into the shelf on its left: seen from the front
      const link=connGraph().links.find(row=>row.joint&&row.fastened&&['Divider','Shelf'].every(name=>[row.joint.a.name,row.joint.b.name].includes(name)));
      if(link){
        const layout=fastenersOfLink(link),center=[0,1,2].map(k=>layout.reduce((sum,f)=>sum+f.pos[k],0)/layout.length);
        center[2]=0;   // even near the back of the case
        if(closeupEye(layout[0],link.joint,center)[2]<=0)wrong('the close-up of a shelf at a divider is seen from the back: left and right are swapped');
      }
    }
    placeInStyle(builder,caseEntryVals('bookshelf',{W:12,H:24,n:1}),'std');
    const plan=buildPlan();
    if(plan.steps.some(step=>(step.tight||[]).length))wrong('the 12" Bookshelf asks for a right-angle drill attachment: a bay this narrow is screwed through the sides');
    if(fastenerHeads().some(head=>head.f.kind==='pocket'&&head.f.into.name==='Side'))wrong('the 12" Bookshelf has pocket screws into its sides, in a bay too narrow for the drill');
  }finally{load(kept,true);}
});});
