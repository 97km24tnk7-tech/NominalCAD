/* NominalCAD: style, wood type, finish, and the difficulty/time/cost estimate */
'use strict';
/* ---------- style, wood and finish ---------- */
const WOODS={pine:['Construction pine or spruce (cheapest)',0xe6c592,1,0],select:['Select pine (smooth, few knots)',0xf1dcae,2.2,0],poplar:['Poplar (best under paint)',0xd8d3a4,2.4,0],
 cedar:['Cedar (outdoor, resists rot)',0xcb8f62,2.6,0],pt:['Pressure-treated pine (outdoor)',0xb7b587,1.4,0],oak:['Red oak (hardwood)',0xcf9a63,4,1],rough:['Rough-sawn or reclaimed boards',0xa5855e,1.3,0]}; // name, color, price multiplier, hardwood
const FINISHES={none:['Bare wood',null,0],clear:['Clear coat (polyurethane)',null,0],stainL:['Light stain + clear coat',0xb07a3a,1],stainD:['Dark stain + clear coat',0x5a3a20,1],
 white:['Painted white',0xf3f1ea,2],black:['Painted black',0x2e2e2e,2],gray:['Painted gray',0x8d9499,2],blue:['Painted navy blue',0x2f4a6b,2],green:['Painted sage green',0x7c9473,2]}; // name, color, 1 = stain, 2 = paint
/* The three build styles. The words on each card must stay true: the style decides how tops and fronts are
   fastened (STYLE_RULES in js/joints.js, styleType below), and a beginner must be able to tell from these words
   that only Rustic / rough leaves screw heads showing on top. */
const STYLES={rustic:['Rustic / rough','Construction lumber and quick sanding. Screws go straight in from outside, so their heads show, on the top and the sides of a table or bench too (through a 4x4 leg they are structural screws with washer heads). Fastest, cheapest and the most forgiving.'],
 std:['Everyday','Clean and sturdy. Nothing shows on the top, the front or the sides of furniture: it is held from underneath and from inside with pocket screws, and a screw that has to go in through a face (a bed rail into its leg) is sunk under a wooden plug. The notes of a design say where any head shows. Plain screws on backs and on shop pieces. A normal sanding and finish.'],
 fine:['Fine furniture','Fasteners hidden almost everywhere: pocket holes on the hidden side and glue, the few holes left filled, sanded smooth to 220 grit. Takes the most time and care.']};
const look=()=>S.look||(S.look={style:'std',wood:'pine',finish:'clear'});
function partColor(p){const m=M[p.mat];if(m.kind==='prop')return m.color;const L=look(),c=new THREE.Color(WOODS[m.treated?'pt':L.wood][1]),f=FINISHES[L.finish]; // a pressure-treated board keeps its own greenish color
  if(m.kind==='sheet')c.multiplyScalar(.93);else if(m.id==='4x4')c.multiplyScalar(.96);
  if(f[2]===1)c.lerp(new THREE.Color(f[1]),.72);else if(f[2]===2)c.set(f[1]);
  return c.getHex();}
function styleType(t,j,style){const s=style||look().style; // the style nudges the suggested fastener; a choice made by hand always wins (js/verify.js passes the style itself)
  if(s==='rustic'&&(t==='pocket'||t==='dowel'))return'screw';
  // Fine furniture hides a screw in a pocket hole, but a pocket-hole jig only takes stock up to 1 1/2" thick:
  // a hole cannot be drilled in a 4x4 that way, so there the screw stays
  if(s==='fine'&&t==='screw'&&!(j.fa==='face'&&j.fb==='face')&&pocketPiece(j).t<=POCKET_JIG_MAX+1e-6)return'pocket';
  return t;}
/* ---------- pocket holes: the jig ----------
   A pocket-hole jig is set for the thickness of the stock, and each setting has its screw (the chart on every
   jig). Where the two pieces differ, the jig is set for the thinner one, so the screw cannot come out of it.
   The bit drills to a fixed stop, so the head of the screw always seats at the same place in the hole: SHOULDER
   is how far that is from where the screw leaves the piece, along the screw. What is left of the screw goes into
   the second piece, at 15 degrees. These are rule-of-thumb numbers, close to the usual jigs, not a maker's chart.
     set       the thickness the jig is set for (inches)
     screw     the screw for that setting: its length, and the shopping-list size
     shoulder  from the head of the screw to where it leaves the piece, along the screw */
const POCKET_JIG=[
  {set:.5,  screw:1,   size:'1"',     shoulder:.65},
  {set:.75, screw:1.25,size:'1-1/4"', shoulder:.75},
  {set:1,   screw:1.5, size:'1-1/2"', shoulder:1},
  {set:1.5, screw:2.5, size:'2-1/2"', shoulder:1.5}
];
const POCKET_JIG_MAX=1.5;     // the thickest stock a pocket-hole jig takes
const POCKET_COVER=.25;       // wood wanted over the point of a pocket screw, where the stock allows
const POCKET_COVER_MIN=.125;  // never less than this
/* The jig setting for a pocket-hole joint: hp is the piece with the holes, mateDepth how thick the other piece is
   where the screw goes in. The jig is set for the thinner of the two, to the nearest setting at or below it. */
function pocketJig(hp,mateDepth){
  const thinner=Math.min(hp.t,mateDepth);
  let row=POCKET_JIG[0];
  for(const candidate of POCKET_JIG)if(candidate.set<=thinner+.02)row=candidate;
  return row;
}
/* how deep the point of a pocket screw of this setting ends in the second piece, square to the joint */
const pocketReach=jig=>(jig.screw-jig.shoulder)*Math.cos(15*Math.PI/180);
/* Wood for outdoors: cedar or pressure-treated. Screws in it are bought as exterior screws (plain steel rusts away
   in treated lumber), and a finish for it is an exterior one. */
const outdoorWood=()=>look().wood==='cedar'||look().wood==='pt';
const screwKind=()=>outdoorWood()?'exterior screws':'wood screws';
/* Does this design get a finishing step? A design with general steps does. A preset's own steps do when one of
   them is the finishing step, or when the design has a finish to put on: stepsSection (js/plans.js) then adds
   the step, so a shed that the person chose to paint is told how. A bare garden bed or shed is not sanded,
   and the lists below do not ask for sandpaper for it. */
const isFinishStep=step=>step.t===FIN.t;
function hasFinishStep(){
  const own=S.steps&&S.steps.length;
  return!own||S.steps.some(isFinishStep)||look().finish!=='none';
}
/* The sandpaper to buy, as the tools list and the shopping list name it: "80, 120 and 180 grit". The grits follow
   the style, and the 320 grit that the finishing step asks for between coats is there whenever the finish has coats. */
function sandpaperGrits(){
  const L=look(),f=FINISHES[L.finish];
  const grits=L.style==='rustic'?['80']:L.style==='fine'?['120','180','220','320']:['80','120','180'];
  const betweenCoats=L.finish==='clear'||f[2]===1;
  if(betweenCoats&&!grits.includes('320'))grits.push('320');
  return(grits.length>1?grits.slice(0,-1).join(', ')+' and ':'')+grits[grits.length-1]+' grit';
}
function finText(){const L=look(),f=FINISHES[L.finish],out=outdoorWood(),coats=L.style==='fine'?'three':'two';
  const sand=L.style==='rustic'?'Knock off splinters and sharp corners with 80-grit sandpaper. Rough is fine for this look.'
    :L.style==='fine'?'Fill every screw hole and gap with wood filler and let it dry. Sand with the grain using 120, then 180, then 220 grit, wipe with a damp cloth to raise the grain, and sand with 220 once more. Round over the sharp edges slightly.'
    :'Sand everything: 80 grit, then 120, then 180, and round over the sharp edges. Wipe off the dust.';
  const fin=L.finish==='none'?(out?'Leave it bare; it will weather to gray.':'Leave it bare. Bare wood stains easily, so this suits a workshop or garage piece.')
    :f[2]===1?`Brush on pre-stain wood conditioner (pine and poplar blotch without it), then wipe on the stain and wipe off the extra after a few minutes. Let it dry overnight, then brush on ${coats} thin coats of ${out?'exterior spar urethane':'polyurethane'}, sanding lightly with 320 grit between coats.`
    :f[2]===2?`Prime first, using a stain-blocking primer over any knots, then roll or brush on two coats of ${out?'exterior ':''}paint, sanding lightly between coats.`
    :`Brush on ${coats} thin coats of ${out?'exterior spar urethane':'water-based polyurethane'}, sanding lightly with 320 grit between coats.`;
  return(coverWords()?coverWords()+' ':'')+sand+' '+fin;}
/* Screw heads that stay on a show face are sunk and covered (type 'plug', rule 12 in js/fasteners.js). The
   finishing step says how they are hidden, first, because it is done before the sanding. */
const plugsInDesign=()=>S.parts.length>0&&findJoints().some(j=>jType(j)==='plug');
function coverWords(){
  if(!plugsInDesign())return'';
  // heads sunk deeper than a plug is long were covered with lengths of dowel rod, under paint too (jSpec)
  const plugged=findJoints().filter(j=>jType(j)==='plug').map(j=>jSpec(j,'plug'));
  const dowels=plugged.some(spec=>spec.deep),shallow=plugged.some(spec=>!spec.deep);
  if(FINISHES[look().finish][2]===2){
    return'Hide the screw heads that were sunk in counterbores: '+
      (dowels?'once the glue is dry, saw the pieces of dowel off flush with a flush-cut saw and sand them smooth'+(shallow?'; ':'. '):'')+
      (shallow?`press wood filler into each ${dowels?'of the other holes':'hole'}, a little proud of the surface, let it dry and sand it flush. `:'')+
      'Under the primer and paint they disappear.';
  }
  return`Hide the screw heads that were sunk in counterbores: once the glue is dry, saw each ${dowels&&shallow?'plug and each piece of dowel':dowels?'piece of dowel':'plug'} off flush with a flush-cut saw (or pare it with a sharp chisel, bevel up) and sand it smooth with the rest. Under a clear finish the plugs show as small round dots of wood; a decorative wooden button glued into the hole instead stands a little proud and is meant to be seen.`;
}
/* The words of a preset step. A step whose work depends on the build style (a top screwed down through its face
   in Rustic / rough, held from underneath in the other two) carries its words for each style in byStyle; st.t is
   the Everyday wording. */
const stepText=st=>st.t===FIN.t?finText():(st.byStyle&&st.byStyle[look().style])||st.t;
/* a step with words for each style: {t: the Everyday words, byStyle: {rustic, std, fine}} */
// drill (optional): the sentences of these words that tell the person to drill pocket holes, one list for every
// style or {std, fine, rustic}; the steps leave them out while "Drill your pieces" holds those holes (js/drillplan.js)
const styledStep=(words,add,drill)=>({t:words.std,byStyle:{rustic:words.rustic,std:words.std,fine:words.fine||words.std},add,...(drill?{drill}:{})});
const surfaceSqFt=()=>S.parts.reduce((a,p)=>isProp(p)?a:a+2*(p.l*p.w+p.l*p.t+p.w*p.t)/144,0);
function finishSupplies(){const L=look(),f=FINISHES[L.finish],rows=[],a=surfaceSqFt();if(!a)return rows;
  const qt=c=>Math.max(1,Math.ceil(a*c/100)); // a quart covers about 100 sq ft per coat
  if(!hasFinishStep())return rows;                 // no step sands or finishes it: nothing to buy for that
  rows.push([`Sandpaper, ${sandpaperGrits()} (packs)`,1]);
  // filler for the holes of Fine furniture, and for the counterbores over screw heads under paint (coverWords)
  if(L.style==='fine'||(f[2]===2&&plugsInDesign()))rows.push(['Wood filler, small tub',1]);
  if(f[2]===1)rows.push(['Pre-stain wood conditioner, quarts',qt(1)],['Wood stain, quarts',qt(1)]);
  if(f[2]===2)rows.push(['Primer, quarts',qt(1)],['Paint, quarts',qt(2)]);
  if(L.finish==='clear'||f[2]===1)rows.push(['Polyurethane, quarts',qt(L.style==='fine'?3:2)]);
  return rows;}
const lumberCost=()=>lumberToBuy(S.parts.concat(woodStrips()),S.stock).cost; // lumberToBuy is in plans.js, next to the board and sheet packing
/* ---------- how hard is it: the skill rating ----------
   A rule of thumb, the way an experienced hobbyist sizes up a project for a beginner: what makes a build hard is
   how many different operations it asks for and how unforgiving each one is, not which tool drives the screws.
   Every design starts at SKILL.base points and each thing below adds its weight once; the total picks a row of
   SKILL_LEVELS. Pieces are recognised by what they are (a piece named Door, Lid, Drawer front; a tank; a piece set
   at an angle; framing nails), so a preset gets the same rating in the presets window (pieces not placed yet) as
   on the Build instructions page (the placed design): see presetWindowRatesAsThePage in js/app.js. A design made
   by hand is also read by its hardware: a piece that hangs on hinges is a door (or a lid, when it is named so),
   and the pieces that run on slides or runners make drawers. The presets put their hinges on their Door and Lid
   pieces and their slides on their drawers, so for them this counts nothing twice. */
const SKILL={
  base:1,            // measure, cut square, drill and drive screws: every design asks for that much
  manyPieces:.5,     // more than SKILL_MANY_PIECES pieces: many cuts that must come out the same length, and more to keep square
  lotsOfPieces:.5,   // more than SKILL_LOTS_OF_PIECES: on top of that, a long build where small errors add up
  plywoodCase:.5,    // SKILL_CASE_PANELS or more panels of 1/2" plywood or thicker (a box or a cabinet): big sheets to
                     // handle and rip straight with a saw guide, and each panel must match its partner exactly. One top
                     // or a thin back is not counted: the store cuts those, and a back hides small errors
  lid:.5,            // a lid on hinges: it lines up along one edge only, and a gap around a lid is forgiving
  doors:1,           // hanging doors so the gaps are even: the hinge holes must be at the same place on every door,
                     // and the doors adjusted until they sit flat and line up with each other
  drawers:1.5,       // drawers: each box must be square to within 1/16", its slides or runners level and parallel,
                     // and the fronts lined up across the cabinet. The least forgiving job in ordinary furniture
  angled:.5,         // cuts at an angle (a roof board, a brace): a bevel or miter set on the saw and checked
  manyAngled:.5,     // SKILL_MANY_ANGLED or more angled pieces (rafters): a layout marked once and cut over and over
                     // until every piece matches
  framing:1.5,       // framing a building: walls built flat, raised, plumbed and squared, a level floor, a roof
  tanks:1,           // it carries fish tanks: hundreds of pounds of water, so it must stand level and dead square, and
                     // a mistake floods the room. Never a first project, however small the rack
  dowels:1,          // dowel joints: the holes in both pieces must line up exactly, and glue-up is a race against time
  hardwood:.5,       // hardwood: harder to cut, every screw needs a pilot hole, and mistakes show
  stain:.5,          // a stain: pine and poplar blotch unless the wood is conditioned, and glue left on shows
  fine:1,            // Fine furniture: every hole filled, sanded to 220, nothing out of square may show
  rustic:-.5,        // Rustic / rough: screws from outside and quick sanding; small errors are part of the look
  pocketHoles:0,     // a pocket-hole jig is a beginner's tool: clamp, drill to the stop, drive the screw. No weight
  plugs:0,           // a screw head sunk under a glued plug (type 'plug'), or pocket holes filled with plugs: drill
                     // with a counterbore bit to its stop collar, glue the plug in, saw it flush and sand. Forgiving
                     // (a bad plug is drilled out and redone, sanding hides the rest), so no weight; it costs time
                     // (TIME_MINUTES.plug), and Fine furniture's point already pays for filling every hole
  tanksScrewedToWall:'Experienced builder',
                     // not points but a floor: a rack or stand of fish tanks too tall for its depth to stand free,
                     // which must be screwed into the wall studs (the wall-screws plan of js/rackwall.js gives more
                     // than 0), rates at least this. The owner: "if it attaches to the wall it should be experienced
                     // builder the others are fine". Finding the studs behind the rack, driving long structural
                     // screws through its top rail into them, and loading it with hundreds of pounds of water that
                     // the screws must keep from tipping is no job to learn on. A rack that stands free keeps the
                     // rating the rows above give it. Only things that carry tanks: the Wall shelf and the anti-tip
                     // strap of a bookshelf are not affected
};
const SKILL_MANY_PIECES=25,SKILL_LOTS_OF_PIECES=60,SKILL_CASE_PANELS=5,SKILL_MANY_ANGLED=6;
/* the ratings, from the easiest: a design is the first row whose `below` its points stay under */
const SKILL_LEVELS=[
  {below:2,       level:'Beginner: a good first project'},
  {below:3,       level:'Beginner with patience'},
  {below:4,       level:'Some experience helps'},
  {below:Infinity,level:'Experienced builder'},
];
/* What the rating sees in a design: counts of the things SKILL weighs. ts is the count of joints by fastener type;
   hardware is the placed hardware of the design (S.hardware, js/hardware.js), empty for pieces not placed yet.
   plannedWallScrews: for pieces not placed yet (the presets window), how many screws into the wall studs placing
   them will drive (preset.wallScrews, js/builders-fish.js); left out, the placed screws are counted. */
const isDoorPiece=p=>/(^|\s)door$/i.test(p.name);        // "Door", "Shed door"; not "Door stile" or "Door header"
const isLidPiece=p=>/(^|\s)lid$/i.test(p.name);
function skillFacts(parts,ts,hardware=[],plannedWallScrews){
  const wood=parts.filter(p=>!isProp(p));
  const drawerFronts=wood.filter(p=>/^drawer front$/i.test(p.name)).length;
  const drawerSubs=new Set(wood.map(p=>p.sub).filter(sub=>/^drawer\b/i.test(sub||''))).size;
  // the pieces that move on the hardware placed on them: hung on hinges, or running on slides or runners
  const pieceById=new Map(wood.map(p=>[p.id,p]));
  const movedBy=motion=>[...new Set(hardware.filter(item=>HARDWARE[item.kind]&&HARDWARE[item.kind].motion===motion).map(item=>item.on))]
    .map(id=>pieceById.get(id)).filter(Boolean);
  const hinged=movedBy('swing'),sliding=movedBy('slide');
  const doors=new Set([...wood.filter(isDoorPiece),...hinged.filter(p=>!isLidPiece(p))]);
  // a drawer is one subcomponent (sub: "Drawer 2"); loose pieces on slides count a drawer for each two (its two sides)
  const slidingLoose=sliding.filter(p=>!p.sub).length;
  const slidDrawers=new Set(sliding.map(p=>p.sub).filter(Boolean)).size+Math.ceil(slidingLoose/2);
  const opens=p=>doors.has(p)||isLidPiece(p)||/^drawer\b/i.test(p.name);
  return{
    pieces:wood.length,
    casePanels:wood.filter(p=>M[p.mat].kind==='sheet'&&M[p.mat].t>=.5-1e-6&&!opens(p)).length,
    doors:doors.size,
    lids:wood.filter(isLidPiece).length,
    drawers:Math.max(drawerFronts,drawerSubs,slidDrawers),
    angled:wood.filter(tilted).length,
    framing:!!(ts.frame||ts.toenail),
    tanks:parts.some(p=>p.gal),
    wallScrews:typeof plannedWallScrews==='number'?plannedWallScrews:hardware.filter(item=>item.kind==='wallscrew').length,
    dowels:!!ts.dowel,
    pocketHoles:!!ts.pocket,
    plugs:!!ts.plug,
  };
}
/* The points of a design and why: [{what, points}] with the base first. */
function skillPoints(facts,lk){
  const why=[{what:'measuring, cutting and screwing',points:SKILL.base}];
  const add=(on,points,what)=>{if(on&&points)why.push({what,points});};
  add(facts.pieces>SKILL_MANY_PIECES,SKILL.manyPieces,`more than ${SKILL_MANY_PIECES} pieces`);
  add(facts.pieces>SKILL_LOTS_OF_PIECES,SKILL.lotsOfPieces,`more than ${SKILL_LOTS_OF_PIECES} pieces`);
  add(facts.casePanels>=SKILL_CASE_PANELS,SKILL.plywoodCase,'many plywood panels cut to match');
  add(facts.lids>0,SKILL.lid,'a lid on hinges');
  add(facts.doors>0,SKILL.doors,'doors to hang');
  add(facts.drawers>0,SKILL.drawers,'drawers to fit');
  add(facts.angled>0,SKILL.angled,'cuts at an angle');
  add(facts.angled>=SKILL_MANY_ANGLED,SKILL.manyAngled,'many matching angled pieces');
  add(facts.framing,SKILL.framing,'framing a building');
  add(facts.tanks,SKILL.tanks,'it carries fish tanks');
  add(facts.dowels,SKILL.dowels,'dowel joints');
  add(facts.pocketHoles,SKILL.pocketHoles,'pocket holes');            // weighs 0 (see SKILL): listed so the table decides
  add(facts.plugs,SKILL.plugs,'screw heads sunk under plugs');        // weighs 0 (see SKILL)
  add(WOODS[lk.wood][3]===1,SKILL.hardwood,'hardwood');
  add(FINISHES[lk.finish][2]===1,SKILL.stain,'a stain');
  add(lk.style==='fine',SKILL.fine,'the Fine furniture style');
  add(lk.style==='rustic',SKILL.rustic,'the Rustic / rough style');
  // last, after every weight: the floor of a tank rack that must be screwed to the wall (SKILL.tanksScrewedToWall)
  if(facts.tanks&&facts.wallScrews>0){
    const sum=why.reduce((total,row)=>total+row.points,0);
    const floor=skillFloorPoints(SKILL.tanksScrewedToWall);
    if(sum<floor)why.push({what:'it must be screwed into the wall studs',points:floor-sum});
  }
  return why;
}
/* the fewest points that rate a design at this level of SKILL_LEVELS (the `below` of the row before it) */
function skillFloorPoints(level){
  const index=SKILL_LEVELS.findIndex(row=>row.level===level);
  return index>0?SKILL_LEVELS[index-1].below:0;
}
const skillLevel=points=>SKILL_LEVELS.find(row=>points<row.below-1e-9).level;
/* ---------- how long: the working time ----------
   Minutes per piece, per joint by fastener type, per square foot sanded and finished, and for each door, lid and
   drawer (cutting a drawer box, mounting its slides and lining up its front takes about an hour; drilling and hanging
   a door and adjusting it about half that). A plugged screw (type 'plug') takes 8: counterbore, drive, glue the
   plug in, saw it flush and sand. */
const TIME_MINUTES={piece:4,screw:3,plug:8,pocket:6,dowel:12,nail:2,frame:2,toenail:3,bracket:5,glue:5,door:30,lid:20,drawer:60};
function assess(lk){ // how hard, how long and how much, for a given style / wood / finish
  const keep=S.look;S.look=lk;
  try{const js=findJoints(),ts={},f=FINISHES[lk.finish],area=surfaceSqFt();
    js.forEach(j=>{const t=jType(j);ts[t]=(ts[t]||0)+1;});
    // (S.plannedWallScrews: only on the project assessParts makes for a preset not placed yet, js/app.js)
    const facts=skillFacts(S.parts,ts,S.hardware||[],S.plannedWallScrews),why=skillPoints(facts,lk);
    const points=why.reduce((sum,row)=>sum+row.points,0);
    const T=TIME_MINUTES;
    const joints=['screw','plug','pocket','dowel','nail','frame','toenail','bracket','glue'].reduce((sum,type)=>sum+(ts[type]||0)*T[type],0);
    const opening=facts.doors*T.door+facts.lids*T.lid+facts.drawers*T.drawer;
    const sanding=area*(lk.style==='rustic'?.5:lk.style==='fine'?3:1.5),finishing=area*(lk.finish==='none'?0:f[2]?2.5:1.5);
    const mins=facts.pieces*T.piece+joints+opening+sanding+finishing;
    return{level:skillLevel(points),points,why,hours:Math.max(1,Math.round(mins/60)),cost:lumberCost(),tools:toolList(js).length,pocket:!!ts.pocket};
  }finally{S.look=keep;}}
/* The Style, finish and difficulty dialog (#styleDlg): one choice per style with what it takes for THIS design
   (skill, time, lumber cost, tools), then the wood and the finish. app.js applies a choice as soon as it is made. */
function renderStyle(){
  const L=look();
  const choice=([key,[name,about]])=>{
    const a=assess({...L,style:key}),on=key===L.style;
    return`<label class="opt${on?' on':''}" data-style="${key}">`+
      `<span class="ck"><input type="radio" name="lookStyle" value="${key}"${on?' checked':''}><b>${name}</b></span>`+
      `<p>${about}</p>`+
      `<dl><dt>Skill</dt><dd>${a.level}</dd>`+
      `<dt>Time</dt><dd>about ${a.hours} hour${a.hours>1?'s':''} of work</dd>`+
      `<dt>Lumber</dt><dd>about $${Math.round(a.cost).toLocaleString()}</dd>`+
      `<dt>Tools</dt><dd>${a.tools} kinds${a.pocket?', including a pocket-hole jig':''}</dd></dl></label>`;
  };
  $('#styleCards').innerHTML=S.parts.length?Object.entries(STYLES).map(choice).join('')
    :'<p class="dlg-msg">Add some pieces or pick a preset first, then come back to compare styles.</p>';
  $('#woodSel').innerHTML=Object.entries(WOODS).map(([k,v])=>`<option value="${k}"${k===L.wood?' selected':''}>${v[0]}${v[2]>1?` (about ${v[2]}× the price)`:''}</option>`).join('');
  $('#finSel').innerHTML=Object.entries(FINISHES).map(([k,v])=>`<option value="${k}"${k===L.finish?' selected':''}>${v[0]}</option>`).join('');
}
/* the fastener of a joint: the one picked by hand (or named by the preset as a fixed type), else the suggestion,
   which may follow the style (suggestedType and STYLE_RULES in js/joints.js) */
const jType=j=>S.joints[j.key]||suggestedType(j);
const TWO_SCREWS_FROM=2.25;   // inches of contact: 3/4 in at each end and 3/4 in between two screws
/* Small L-brackets: one about every 12", the first and the last within 4" of the ends of the joint (BRACKET in
   js/fasteners.js places them); a joint under 8" takes one, in its middle. */
const BRACKET_EVERY=12,BRACKET_FROM_END=4;
const bracketCount=long=>long<2*BRACKET_FROM_END?1:Math.ceil((long-2*BRACKET_FROM_END)/BRACKET_EVERY)+1;
/* The short screws of a bracket: 5/8" usually, 1/2" where one of the pieces is thinner than 1", so that the point
   stays at least 1/4" under the far face of a 3/4" top (the plate itself is about 1/16" thick). */
function bracketScrew(j){
  return Math.min(j.da,j.db,j.a.t,j.b.t)<1-1e-6?{len:.5,size:'1/2"'}:{len:.625,size:'5/8"'};
}
/* The screw for a joint driven straight through one piece into the other (rules 4 and 12 in js/fasteners.js).
   dT: how thick the piece it goes through is, dO: how far the receiving piece reaches along it, endGrain: it goes
   into the end of a board, plug: its head is sunk PLUG_DEPTH under a plug. The usual length (through the piece
   and about two thirds of the next, never more than 1 1/2" into it), made longer where that would not bite as
   deep as rule 12 wants, and never so long that its point comes within 1/8" of the far face. Where no #8 screw is
   long enough to bite into end grain, a 1/4" structural screw. Where none fits at all, the longest #8 that does,
   and the layout sinks its head (drivenStraight). Returns {len, size, structural}. */
function screwForJoint(dT,dO,endGrain,plug){
  const through=dT-(plug?PLUG_DEPTH:0);
  const longest=through+dO-.125;                            // the point stays 1/8" inside the far face
  const bite=biteWanted(dO,endGrain);
  let pick=pickLE(SCREWS,Math.min(through+Math.min(1.5,Math.max(.75,through*1.2)),longest-.13));
  if(pick[0]-through<bite-.01){
    const longer=SCREWS.find(screw=>screw[0]-through>=bite-.01&&screw[0]<=longest+1e-6);
    if(longer)pick=longer;
    else if(endGrain&&!plug){
      const structural=STRUCTURAL_SCREWS.find(screw=>screw[0]-through>=SCREW_BITE.structuralEnd-.01&&screw[0]<=longest+1e-6);
      if(structural)return{len:structural[0],size:structural[1],structural:true};
    }
  }
  return{len:pick[0],size:pick[1],structural:false};
}
/* the plugs that hide the heads of plugged screws (type 'plug'), as the shopping list names them */
const PLUG_LABEL='3/8" wood plugs';
/* a head sunk deeper than a plug is long: the hole is filled with a length of dowel rod, cut a little long */
const DOWEL_ROD_LABEL='3/8" dowel rod, cut into plugs';
/* pocket holes that would be seen from below are filled with these (rule 13 in js/fasteners.js) */
const POCKET_PLUG_LABEL='Pocket-hole plugs';
function jSpec(j,type,opts){
  if(type==='frame'||type==='toenail'){   // nails for framing: js/framing.js
    // (framing looks at where the two pieces stand; inside a turned set that is read with the set standing square, js/neighbors.js)
    return j.frame&&!squaredNow?squaredUp(()=>framingSpec(j,type)):framingSpec(j,type);
  }
  // the piece the fastener goes through: as the layout drives it (screwSide in js/fasteners.js: a plain screw in
  // house furniture may go in from the inside face of the thicker piece)
  const long=Math.max(j.ru[1]-j.ru[0],j.rv[1]-j.rv[0]),th=type==='screw'&&typeof screwSide==='function'?screwSide(j,true):thruPart(j);
  const dT=th?(th==='a'?j.da:j.db):null,dO=th?(th==='a'?j.db:j.da):null;
  const hw=[];let text='',n=0,glue=false,deep=0;   // deep: how far a plugged head is sunk when it is deeper than a plug is long
  // A fastener must stop at least 1/8 in short of the far face, or it pokes out of the wood. pickLE allows a
  // length up to .13 over what it is given (so a 1-5/8 screw can stand in for 1.5), so that slack is taken off
  // the limit here: the length picked can never reach the far face.
  const stopShort=th?dT+dO-.125-.13:0;
  // Two screws need 3/4 in from each end of the joint and 3/4 in between them (TWO_SCREWS_FROM): a shorter
  // contact (the top of a 2x2 leg, the strip of an outer board that lies over a cross rail) takes one screw in
  // its middle. Two crammed in would sit 1/2 in apart and split the wood.
  if(type==='screw'||type==='plug'){n=long<TWO_SCREWS_FROM?1:Math.max(2,Math.ceil(long/8));
    // the length by rules 4 and 12 in js/fasteners.js (deep enough into the receiving piece, never through it)
    const plug=type==='plug'&&!!th,pick=th?screwForJoint(dT,dO,intoEndGrain(j,th),plug):{len:SCREWS[4][0],size:SCREWS[4][1]};
    // exterior screws in cedar and pressure-treated lumber; a 1/4" structural screw where a #8 cannot reach
    const screws=pick.structural?`1/4" × ${pick.size} structural screws`:`#8 × ${pick.size} ${screwKind()}`;
    text=`${n} × ${screws}`+(th?'':' driven at an angle');hw.push([screws,n]);glue=true;
    if(plug){
      // The heads sit in a 3/8" counterbore and are hidden: a glued wooden plug cut flush, or filler under paint.
      // The depth is the one the layout drills (sunkDepth, js/fasteners.js): through a thick piece into end grain
      // (a 4x4 leg into a short apron) the head goes deeper than a 3/8" plug is long, and the hole is filled with a
      // glued length of 3/8" dowel rod instead, under paint too (filler alone would sink in so deep a hole).
      const painted=FINISHES[look().finish][2]===2;
      const sunk=sunkDepth('screw',pick.len,dT,dO,intoEndGrain(j,th),true);
      if(plugIsDowel(sunk)){
        text+=`, heads sunk ${fmt(sunk)} deep in 3/8" holes, each filled with a glued length of 3/8" dowel cut flush`;
        hw.push([DOWEL_ROD_LABEL,n]);   // counted in plugs; the price book sells the rod (about 20 plugs to a 36" rod)
        deep=sunk;
      }else{
        text+=painted?', heads sunk 3/8" and filled with wood filler':', heads sunk 3/8" under glued wooden plugs';
        if(!painted)hw.push([PLUG_LABEL,n]);
      }
    }}
  else if(type==='pocket'){n=long<TWO_SCREWS_FROM?1:Math.max(2,Math.ceil(long/6));   // two holes need the same room as two screws
    // a row that had to leave out holes with no room past the holes in the ends of its piece (rule 11 in
    // js/fasteners.js) is counted as it is laid out, so the lists buy what is drawn (opts.asPlanned: the count
    // before that, which the layout itself starts from)
    if(!(opts&&opts.asPlanned)){const laid=pocketCountAsLaidOut(j);if(laid)n=laid;}
    // the holes are drilled in the piece that is not lying flat against the joint (pocketPiece, js/fasteners.js),
    // and the jig is set for the thinner of the two pieces (pocketJig above)
    const hp=pocketPiece(j),jig=pocketJigFor(j,hp);   // (a board on a thin deck: set for the board, with the longer screw rule 12 asks for: pocketJigFor in js/fasteners.js)
    text=`${n} × ${jig.size} pocket screws (holes in the ${hp.name.toLowerCase()}, jig set for ${fmt(jig.set)} stock)`;
    hw.push([`${jig.size} pocket-hole screws`,n]);
    // holes that would be seen from below are filled with glued plugs (rule 13 in js/fasteners.js)
    const plugs=opts&&opts.asPlanned?0:pocketPlugsAsLaidOut(j);
    if(plugs){text+=`, ${plugs===n?'the holes':plugs+' of the holes'} filled with glued pocket-hole plugs`;hw.push([POCKET_PLUG_LABEL,plugs]);}}
  else if(type==='dowel'){n=Math.max(2,Math.ceil(long/6));const thin=Math.min(j.a.t,j.b.t)<.7;
    const d=thin?'1/4" × 1"':'3/8" × 1-1/2"';text=`${n} × ${d} dowels + glue`;hw.push([`${d} wood dowels`,n]);glue=true;}
  else if(type==='nail'){n=Math.max(2,Math.ceil(long/6));
    const len=th?pickLE(BRADS,Math.min(dT*2.5,stopShort)):BRADS[3];
    text=`${n} × ${len[1]} brad nails + glue`;hw.push([`${len[1]} brad nails (18 gauge)`,n]);glue=true;}
  else if(type==='bracket'){n=bracketCount(long);
    const screw=bracketScrew(j);
    text=`${n} × 1-1/2" L-bracket${n>1?'s':''} on the hidden side, inside the corner (4 × #8 × ${screw.size} screws each)`;
    hw.push(['1-1/2" L-brackets (corner braces)',n],[`#8 × ${screw.size} screws for brackets`,n*4]);}
  else if(type==='glue'){text='Wood glue and clamps';glue=true;}
  else text='No fastener: the pieces only touch';
  // a shaped piece: counted as laid out, off its holes (js/shapes.js); a joint left with no fastener has no sunk head
  if(j.shapes&&!(opts&&opts.asPlanned)){
    const laidOut=shapedSpecAsLaidOut(j,type,{text,hw,n,deep});
    return{...laidOut,glue,deep:laidOut.n?deep:0};
  }
  return{text,hw,n,glue,deep};
}
/* Everything to buy that is not lumber: what the joints take, what the preset lists itself, and the finishing
   supplies. Glue: a joint that is glued (glue, brads, dowels) always asks for it. A screwed joint is stronger
   with glue, so it asks for it too, unless the design is put together dry (S.glue === false: a preset whose
   steps never glue says glue:false, see placePreset in js/app.js). */
function hardwareTotals(js){const m=new Map();let glue=false;
  for(const j of js){const type=jType(j),sp=jSpec(j,type);
    if(sp.glue&&(type!=='screw'||S.glue!==false))glue=true;
    for(const[k,q]of sp.hw)m.set(k,(m.get(k)||0)+q);}
  for(const[k,q]of hardwareRows(S.hw))m.set(k,(m.get(k)||0)+q); // hardware placed in the model, and the plain lines of a preset that are not placed (js/hardware.js)
  for(const[k,q]of finishSupplies())m.set(k,q);
  return{rows:[...m.entries()].sort(),glue};}
function jointGroups(js){
  const g=new Map();
  for(const j of js){let A=[j.a.name,j.fa],B=[j.b.name,j.fb];if(A.join()>B.join())[A,B]=[B,A];
    const key=A.join('|')+'||'+B.join('|');if(!g.has(key))g.set(key,{A,B,js:[]});g.get(key).js.push(j);}
  return[...g.values()];
}

