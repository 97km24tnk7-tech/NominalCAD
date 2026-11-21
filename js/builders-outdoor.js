/* NominalCAD: the small outdoor presets (Planter box, Raised garden bed, Bird feeder).

   Like js/builders-storage.js: one "plan" function per design turns the form's numbers into every size and
   position, and the builder, the steps, the notes and the hardware list all read that one plan.

   THE PRESET RULE (README.md): each of these must pass the structural check in js/verify.js at its default
   sizes and at every limit of its form. The check does not work out soil pushing the walls of a planter or a
   bed outward, so that is done here (soilSpanLimit): a wall too long to hold the soil back without bowing gets
   posts in the middle, and on a raised bed a cross tie between them. */
'use strict';

/* ---------- soil pushing sideways on a wall ---------- */
const SOIL_RULES={
  SIDEWAYS:.5,    // wet soil pushes sideways about half as hard as it weighs down
  LB_PER_CU_FT:100,
  BOW:240,        // a side board may bow outward by its clear span / 240
  MAX_CLEAR:72    // however shallow the soil, no side runs further than this between posts
};
/* The longest clear run between posts, in inches, for a side board standing on edge with soil behind it.
   soilAbove is how far the middle of the board is below the top of the soil; the lowest board is pushed hardest. */
function soilSpanLimit(board,soilAbove){
  const m=M[board];
  const push=SOIL_RULES.SIDEWAYS*SOIL_RULES.LB_PER_CU_FT/1728*soilAbove*m.w;   // lb per inch of board
  const stiffness=WOOD_RULES.E*m.w*m.t**3/12;                                  // bending the weak way, across its thickness
  return Math.min(SOIL_RULES.MAX_CLEAR,Math.cbrt(384*stiffness/(5*SOIL_RULES.BOW*push)));
}

/* ======================================================================================================
   Planter box and Raised garden bed: side boards screwed to corner posts.
     Planter     1x6 sides on 2x2 posts that reach 1 1/2" below the box as feet, so it drains and does not sit
                 in the wet. The bottom is slats on cleats screwed along the long walls; the slats also tie
                 the two long walls together.
     Raised bed  2x6 sides on 4x4 posts, no bottom, sitting on the ground. A long side gets 2x4 posts in the
                 middle with a cross tie between each pair so the soil cannot bow the sides outward.
   ====================================================================================================== */
const BOX_KINDS={
  planter:{limits:{L:[18,72],D:[10,24],rows:[2,3]},board:'1x6',post:'2x2',middle:'2x2',middleName:'Middle leg',feet:1.5,bottom:true},
  bed:    {limits:{L:[36,144],D:[18,48],rows:[1,4]},board:'2x6',post:'4x4',middle:'2x4',middleName:'Middle post',feet:0,bottom:false}
};
const PLANTER_USES={'Bottom slat':'soil','Slat cleat':'soil','Long side':'soil',End:'none'};
const BED_USES={'Long side':'none',End:'none','Cross tie':'none'};
/* Fasteners the planter names itself: a cleat only touches the posts at its ends, and a bottom slat only touches
   the walls and posts beside it (it is screwed down into the two cleats). */
const PLANTER_JOINTS=[['Corner post','Slat cleat','none'],['Middle leg','Slat cleat','none'],['Bottom slat','Corner post','none'],
  ['Bottom slat','Middle leg','none'],['Bottom slat','Long side','none']];
const SLAT_GAP=.375;                // drainage gap between bottom slats
const SLAT_MIN_RIP=1.5;             // a slat ripped narrower than this is not worth cutting

/* Bottom slats side by side along a run, with drainage gaps. When full-width slats leave room for a narrower
   one, the last slat is ripped to fit, so no gap is wide enough for soil to fall through. Returns [{x, w}]. */
function slatRow(start,length,slatWidth){
  const full=Math.floor((length+SLAT_GAP)/(slatWidth+SLAT_GAP));
  if(full<1)return[{x:start,w:Math.floor(length*16)/16}];
  const left=length-full*(slatWidth+SLAT_GAP);                  // room after the last full slat and one more gap
  const slats=[];
  if(left>=SLAT_MIN_RIP){
    for(let i=0;i<full;i++)slats.push({x:start+i*(slatWidth+SLAT_GAP),w:slatWidth});
    slats.push({x:start+full*(slatWidth+SLAT_GAP),w:Math.floor(left*16)/16});
  }else{
    const gap=(length-full*slatWidth)/(full+1);                 // too little room for another slat: share it out
    for(let i=0;i<full;i++)slats.push({x:start+gap+i*(slatWidth+gap),w:slatWidth});
  }
  return slats;
}
function soilBoxPlan(kind,p){
  const k=BOX_KINDS[kind],board=M[k.board],bt=board.t,bw=board.w,ps=M[k.post].w,mw=M[k.middle].w;
  const L=sizeWithin(p.L,k.limits.L),D=sizeWithin(p.D,k.limits.D),rows=countWithin(p.rows,k.limits.rows);
  const H=rows*bw;
  // posts in the middle of a long side, as many as it takes to keep the lowest board from bowing
  const clearLimit=soilSpanLimit(k.board,H-bw/2);
  const bays=splitIntoBays(bt+ps,L-bt-ps,mw,clearLimit);
  const middleX=bays.slice(0,-1).map(bay=>bay.x+bay.len);
  const slats=k.bottom?bays.map(bay=>slatRow(bay.x,bay.len,bw)):[];
  const floorTop=k.bottom?2.25:0;                                // cleat 1 1/2" + slat 3/4", above the lowest edge of the walls
  const cubicFeet=(L-2*bt)*(D-2*bt)*(H-floorTop)/1728;
  return{kind,k,bt,bw,ps,mw,L,D,rows,H,feet:k.feet,top:k.feet+H,bays,middleX,slats,clearLimit,
    ripped:slats.flat().some(slat=>slat.w<bw-1e-6),
    soilCubicFeet:Math.round(cubicFeet*10)/10,soilWeight:Math.round(cubicFeet*SOIL_RULES.LB_PER_CU_FT/10)*10};
}
function buildSoilBox(kind,p){
  const s=soilBoxPlan(kind,p),k=s.k,P=[],{bt,bw,ps,mw,L,D,H,feet}=s;
  for(let row=0;row<s.rows;row++){
    const y=feet+row*bw;
    P.push(mk('Long side',k.board,[L,bw,bt],[0,y,0]),mk('Long side',k.board,[L,bw,bt],[0,y,D-bt]));
    P.push(mk('End',k.board,[bt,bw,D-2*bt],[0,y,bt]),mk('End',k.board,[bt,bw,D-2*bt],[L-bt,y,bt]));
  }
  for(const x of[bt,L-bt-ps])for(const z of[bt,D-bt-ps])P.push(mk('Corner post',k.post,[ps,feet+H,ps],[x,0,z]));
  for(const x of s.middleX){
    P.push(mk(k.middleName,k.middle,[mw,feet+H,1.5],[x,0,bt]),mk(k.middleName,k.middle,[mw,feet+H,1.5],[x,0,D-bt-1.5]));
    // a raised bed has no bottom to hold its long sides together, so each pair of middle posts gets a tie
    if(!k.bottom)P.push(mk('Cross tie','2x4',[1.5,3.5,D-2*bt],[x+mw,H-3.5,bt]));
  }
  if(k.bottom){
    s.bays.forEach((bay,n)=>{
      P.push(mk('Slat cleat','1x2',[bay.len,1.5,.75],[bay.x,feet,bt]),mk('Slat cleat','1x2',[bay.len,1.5,.75],[bay.x,feet,D-bt-.75]));
      for(const slat of s.slats[n])P.push(mk('Bottom slat',k.board,[slat.w,bt,D-2*bt],[slat.x,feet+1.5,bt]));
    });
  }
  return P;
}
function soilBoxInfo(kind,p){
  const s=soilBoxPlan(kind,p),n=s.middleX.length;
  const middle=n?(kind==='bed'?`At this length the long sides get ${countOf(n,'pair')} of middle posts with a cross tie, so the soil cannot bow them outward. `
    :`At this length it gets ${countOf(n,'pair')} of middle legs, so the soil cannot bow the long sides. `):'';
  return middle+`Holds about ${s.soilCubicFeet} cubic feet of soil.`;
}
function soilBoxNotes(kind,p){
  const s=soilBoxPlan(kind,p),n=s.middleX.length;
  const out=[`It holds about ${s.soilCubicFeet} cubic feet of soil, which weighs about ${s.soilWeight.toLocaleString('en-US')} lb when wet.`+(kind==='planter'?' Set it where it will stay before you fill it.':''),
    'The lists are for cedar and exterior screws, which stand up to wet soil. Redwood works as well, and so does pressure-treated lumber rated for ground contact, which costs less: to price that, pick it under Style & finish. Ordinary pine rots in a few seasons.'];
  if(s.L>96)out.push(`The long sides are ${fmtFt(s.L)} long. Buy boards longer than 8 ft for them (10 ft or 12 ft), and check they fit in your vehicle.`);
  if(kind==='planter')out.push('The posts reach 1 1/2" below the box as feet, so water drains out under it and the boards do not sit in the wet.');
  if(n)out.push(kind==='bed'?`Wet soil pushes the long sides outward. The ${n>1?'cross ties hold':'cross tie holds'} them together: do not leave ${n>1?'them':'it'} out. You can plant right up to and under a tie.`
    :`Wet soil pushes the long sides outward. The middle legs and the bottom slats screwed to the cleats hold them together.`);
  else if(kind==='bed')out.push('At this length the long sides hold the soil back by themselves. A longer bed gets posts in the middle of its long sides and a board across between them, which the program adds.');
  out.push('These are rule-of-thumb sizes, not an engineer\'s numbers.');
  return out;
}
function soilBoxHardware(kind,p){
  // Only what the joints do not already count. The screws are worked out from the joints, like in every other
  // design (hardwareTotals in js/style.js), so listing them here as well put every screw on the shopping list
  // twice and charged for it twice. The notes say to buy them exterior-rated.
  const s=soilBoxPlan(kind,p);
  if(kind==='bed')return[['Landscape fabric for the inside of the walls (length in feet)',Math.ceil(2*(s.L+s.D)/12)]];
  return[['Landscape fabric to line the inside (length in feet)',Math.ceil((2*(s.L+s.D)+s.L)/12)]];
}
function soilBoxSteps(kind,p){
  const s=soilBoxPlan(kind,p),n=s.middleX.length,planter=kind==='planter',middle=s.k.middleName.toLowerCase();
  const steps=[{t:'Cut every piece on the cut list and pencil its letter on it. Measure twice, cut once, and cut the longest pieces first.'+
      (s.ripped?' One or more bottom slats are narrower than the board they come from: saw those to width along their length.':''),add:[]},
    {t:`Build the two long walls. Lay two corner posts${n?' and '+(n>1?n+' '+middle+'s':'a '+middle):''} on the floor and screw the long side boards across them, lowest board first, two screws through each board into each post. Each corner post sits one board thickness (${fmt(s.bt)}) in from the ends of the boards`+
      (n?`, and the ${middle}${n>1?'s are spaced evenly':' is centered'} between them`:'')+'.'+
      (planter?' The posts stick out 1 1/2" below the lowest board: those are the feet. Do not leave out a screw on the lowest board: it carries all the soil.'
        :' The posts are flush with the boards top and bottom.'+(n?` Use 2 1/2" screws into the ${middle}${n>1?'s':''}: a 3" screw would come out the far side.`:'')),add:['Corner post',s.k.middleName,'Long side']}];
  // The cleats go on while each wall still lies flat: once the box is closed there is no room inside for a drill.
  if(planter)steps.push({t:'Turn each long wall over so its posts face up. Screw a slat cleat along the inside of the lowest board, between the posts, flush with the lower edge of the board. Do it now, while the wall lies flat: once the box is closed there is no room inside for a drill. Use exterior glue and a 1 1/4" screw about every 8" (a longer screw would come through the outside): the cleats carry all the soil.',add:['Slat cleat']});
  steps.push({t:'Stand the two long walls up and screw the end boards between them: two screws through each end board into each corner post, and two through the long side into the end of each end board.',add:['End']});
  if(planter){
    steps.push({t:`Lay the bottom slats across on the cleats with gaps of about 3/8" so water can drain. Drill pilot holes and drive two screws down through each end of every slat into the cleat under it`+
      (s.slats.flat().some(slat=>slat.w<TWO_SCREWS_FROM)?` (one at each end of a slat narrower than ${fmt(TWO_SCREWS_FROM)}: two would split it)`:'')+`. The slats also hold the two long walls together.`,add:['Bottom slat']},
      {t:'Line the inside with landscape fabric, stapled along the top edge. It keeps the soil in and covers the narrow gap beside the posts at each end. Set the planter where it will stay, check it does not rock, then fill it.',add:[]});
  }else{
    if(n)steps.push({t:`Screw a cross tie across the bed beside each pair of middle posts, on edge, with its top level with the top of the bed: two 3" screws through the tie into the edge of each post and two through each long side into the end of the tie. Drill pilot holes first, because these screws are close to the ends of the tie. Wet soil pushes the long sides outward, and the tie is what stops them from bowing.`,add:['Cross tie']});
    steps.push({t:'Set the bed in place on bare, level ground and check the corners are square by measuring corner to corner both ways. Staple landscape fabric to the inside of the walls with a staple gun, to keep wet soil off the wood, then fill it.',add:[]});
  }
  return stepsForPieces(steps,buildSoilBox(kind,p));
}

/* ======================================================================================================
   Bird feeder: a tray with a rim, a post at each end, and two roof boards that meet at the ridge.
   The top of each post is cut to a point at the roof slope, so the roof boards lie flat on the cut ends and
   are glued and screwed down into them; the posts are shaped pieces (pointEnd, js/shapes.js), drawn with that
   point and listed at their full length to the tip. The
   feeder hangs from a screw eye driven through the ridge into each post, so the chain pulls on the posts and
   not on the roof.
   ====================================================================================================== */
const FEEDER_LIMITS={L:[8,24]};
const FEEDER={SLOPE:25,POST_LENGTH:8.4375,POST_WIDTH:3.5,TRAY_WIDTH:9.25,ROOF_WIDTH:7.25};
const FEEDER_USES={Tray:'general','Roof board':'roof','Long rim':'none','End rim':'none'};
/* Fasteners the feeder names itself: the rim strips are glued and screwed to the tray from below, and only touch
   each other at the corners. */
const FEEDER_JOINTS=[['End rim','Long rim','none']];
/* The roof boards lie at the slope, where the program finds no joint: their screws are counted here, one where
   each board lies on each post, and bought through the preset's own hardware list. */
const FEEDER_ROOF_SCREW='#8 × 1-5/8" exterior screws',FEEDER_ROOF_SCREWS=4;

function feederPlan(p){
  const L=sizeWithin(p.L,FEEDER_LIMITS.L),angle=FEEDER.SLOPE*Math.PI/180;
  const tip=.75+FEEDER.POST_LENGTH;                               // the point of a post: the underside of the ridge
  return{L,angle,tip,
    ridgeY:tip+.75/Math.cos(angle),                              // the ridge: where the top faces of the two roof boards meet
    shoulderDrop:FEEDER.POST_WIDTH/2*Math.tan(angle)};           // how far the corners of the pointed post top sit below its tip
}
function buildFeeder(p){
  const s=feederPlan(p),L=s.L,P=[],cos=Math.cos(s.angle),sin=Math.sin(s.angle);
  const width=FEEDER.TRAY_WIDTH,middle=width/2,half=FEEDER.ROOF_WIDTH/2;
  P.push(mk('Tray','1x10',[L,.75,width],[0,0,0]),
    mk('Long rim','1x2',[L,1.5,.75],[0,.75,0]),mk('Long rim','1x2',[L,1.5,.75],[0,.75,width-.75]),
    mk('End rim','1x2',[.75,1.5,width-1.5],[0,.75,.75]),mk('End rim','1x2',[.75,1.5,width-1.5],[L-.75,.75,.75]),
    mk('Roof post','1x4',[.75,FEEDER.POST_LENGTH,FEEDER.POST_WIDTH],[.75,.75,middle-FEEDER.POST_WIDTH/2]),
    mk('Roof post','1x4',[.75,FEEDER.POST_LENGTH,FEEDER.POST_WIDTH],[L-1.5,.75,middle-FEEDER.POST_WIDTH/2]));
  // The top of each post is cut to a point at the roof slope, across its width (js/shapes.js): the model, the cut
  // list's part drawing of the post (the shop packet) both show the cut, and the roof boards lie on the two cuts (the
  // preset audit of 20 Nov, finding 6: the posts were drawn square, with a note that said so).
  for(const post of P.filter(piece=>piece.name==='Roof post'))pointEnd(post,'high',FEEDER.SLOPE,'w');
  for(const side of[-1,1]){
    // A roof board lies flat, then is turned to the roof slope about its middle. Its middle is placed so that the
    // upper edge of its top face lands on the ridge; the two boards overlap below that, which is the bevel.
    const centerY=s.ridgeY-half*sin-.375*cos,centerZ=middle+side*(half*cos-.375*sin);
    const roof=mk('Roof board','1x8',[L+2,.75,FEEDER.ROOF_WIDTH],[-1,centerY-.375,centerZ-half]);
    roof.rot={k:0,deg:side*FEEDER.SLOPE};
    P.push(roof);
  }
  return P;
}
function feederNotes(){
  return['The top of each roof post is cut to a point at the slope of the roof, so the roof boards lie flat on the two cuts. The cut list gives each post at its full length to the tip, and its part drawing on the cut list page shows how to mark and cut the point.',
    'The lists are for cedar, which stands up to weather, and exterior screws. Buy glue marked exterior or waterproof. Leave the inside bare: birds eat from it.',
    'The tray, the posts and the roof are rule-of-thumb sizes for seed, birds and the weather, not an engineer\'s numbers.'];
}
/* A Bird feeder saved before its roof posts were shaped pieces (the preset audit of 20 Nov, finding 6) has square
   posts. Opened now, its posts get their point (the same cut as buildFeeder makes), so the model, Shapes to cut and
   the words agree whichever words it keeps: words written again from the preset (presetValuesOf matches these
   pieces exactly, since a shape is not part of the match) say Shapes to cut shows the point, and an old step that
   cuts it by hand is left out, as the cutting step and Shapes to cut now say how. The note about square posts is
   replaced. Done once per placement (S.sets[n].pointedPosts), so a point taken off by hand stays off. The code
   review of the audit fixes, 12. One line says what changed (sayFeederUpgrade, the self-check listens in).
   (Since the shop packet, spec 14, "Shapes to cut" is the shape block of the post's part drawing on the Cut list
   page; the note and the line say so.) */
let sayFeederUpgrade=text=>toast(text);
const OLD_FEEDER_NOTE=/roof posts square at the top/;
const OLD_FEEDER_POINT_STEP=/^Cut the top of each roof post to a point/;
function pointOldFeederPosts(){
  if(!S||!Array.isArray(S.parts)||!S.sets)return;
  let pointed=0;
  for(const[number,set]of Object.entries(S.sets)){
    if(!set||set.name!=='Bird feeder'||set.pointedPosts)continue;
    set.pointedPosts=true;
    const posts=S.parts.filter(piece=>String(piece.set)===number&&piece.name==='Roof post');
    for(const post of posts){
      if(post.shape)continue;
      pointEnd(post,'high',FEEDER.SLOPE,'w');
      pointed++;
    }
  }
  if(!pointed)return;
  S.notes=(S.notes||[]).map(note=>OLD_FEEDER_NOTE.test(note)?feederNotes()[0]:note);
  S.steps=(S.steps||[]).filter(step=>!(step&&(step.add||[]).length===0&&OLD_FEEDER_POINT_STEP.test(step.t||'')));
  sayFeederUpgrade('Updated to the current plans: the roof posts of this Bird feeder are drawn with their pointed tops, and their part drawing on the cut list page shows how to mark and cut them.');
}
ON_LOAD.push(pointOldFeederPosts);
/* a Bird feeder made today has its pointed posts from the start: marked at its first commit */
ON_COMMIT.push(()=>{
  if(!S||!S.sets)return;
  for(const set of Object.values(S.sets))if(set&&set.name==='Bird feeder'&&!set.pointedPosts)set.pointedPosts=true;
});
function feederSteps(){
  return[{t:'Cut every piece on the cut list and pencil its letter on it.',add:[]},
    {t:'Glue the four rim strips around the top of the tray, flush with its edges, and drive two screws up through the tray into each strip. Drill pilot holes first: the strips are thin and split easily. Then drill four 1/4" drain holes through the tray.',add:['Tray','Long rim','End rim']},
    // (the pointed tops of the roof posts are cut with the other pieces: the posts' part drawing on the Cut list page
    //  says how; "Shapes to cut" was retired by the shop packet, js/shoppacket.js)
    {t:'Stand a roof post at each end of the tray, centered, tight against the inside of the end rim. Glue it, drive two screws up through the tray into its end and two through the end rim into its face.',add:['Roof post']},
    {t:`Saw or plane a ${FEEDER.SLOPE} degree bevel along one long edge of each roof board, so the two boards meet tightly at the ridge. Glue and screw them onto the sloped tops of the posts with the beveled edges together, hanging over 1" at each end. Drill pilot holes first so the post tops do not split, and drive one screw through each board into each post: the glue does most of the holding. Run a thin line of exterior glue along the ridge.`,add:['Roof board'],
      // the roof boards are set at the slope, so the program sees no joint there: the screws are counted here and
      // are on the shopping list through the preset's own hardware lines (FEEDER_ROOF_SCREWS)
      fasten:[{line:`${fastenerPhrase(FEEDER_ROOF_SCREWS,FEEDER_ROOF_SCREW)}, down through the Roof board into the sloped top of the Roof post, one at each of the 4 places where a board lies on a post (the sloped cut is under 2 1/4" wide, too narrow for two). Mark it on the Roof board, 2 1/8" in from its end (over the middle of the post) and 1" down from its beveled edge`,
        uses:[[FEEDER_ROOF_SCREW,FEEDER_ROOF_SCREWS]]}]},
    {t:'Leave the wood bare or use a water-based exterior finish on the outside only. Drill a pilot hole down through the ridge into the tip of each post and twist a screw eye into it, so the chain pulls on the posts and not on the roof. Hang it where squirrels cannot jump to it.',add:[]}];
}

/* ---------- self-check (selfTest runs every function in SELFTESTS, see js/core.js) ---------- */
/* A Bird feeder as the published program saved it (square posts, the note that says so, the step that points the
   posts by hand; its pieces are otherwise today's), opened under the fastening rule it was saved with (5) and under
   today's: its posts are pointed, the notes and the steps never speak of a point that the model does not have, it
   says so once, and opened again nothing more happens. A point taken off by hand stays off. */
SELFTESTS.push(function oldFeederGetsPointedPosts(problems){withoutDrawing(()=>{
  const wrong=text=>problems.push('old Bird feeder: '+text);
  const preset=PRESETS.find(row=>row.name==='Bird feeder');
  if(!preset){wrong('the preset is missing');return;}
  const kept=JSON.stringify(S),keepSay=sayFeederUpgrade,said=[];
  sayFeederUpgrade=text=>said.push(text);
  const open=project=>{said.length=0;load(JSON.stringify(project),true);return said.slice();};
  try{
    load(JSON.stringify(blank()),true);
    placeInStyle(preset,presetDefaults(preset),'std');
    const old=JSON.parse(JSON.stringify(S));
    for(const piece of old.parts)if(piece.name==='Roof post')delete piece.shape;
    for(const set of Object.values(old.sets||{}))delete set.pointedPosts;
    old.notes=['The drawing shows the roof posts square at the top. Cut each top to a point as the steps say; the cut list gives the full length to the tip.'].concat(old.notes.slice(1));
    old.steps.splice(2,0,{t:'Cut the top of each roof post to a point. Mark the middle of the top end, then saw down and away from the mark at 25 degrees on each side, so the two corners end up 13/16" lower than the tip. The roof boards will lie flat on these two cuts.',add:[],ids:[],sig:null});
    for(const savedUnder of[5,FASTENING_NOW]){
      const lines=open({...old,fastening:savedUnder});
      const posts=S.parts.filter(piece=>piece.name==='Roof post');
      if(posts.length!==2||posts.some(post=>!post.shape))wrong(`saved under ${savedUnder}: its roof posts are not pointed`);
      if((S.notes||[]).some(note=>OLD_FEEDER_NOTE.test(note)))wrong(`saved under ${savedUnder}: the notes still say the posts are drawn square`);
      if(!(S.notes||[]).some(note=>/part drawing on the cut list page shows how to mark and cut the point/.test(note)))wrong(`saved under ${savedUnder}: the notes do not say where the point is drawn`);
      const words=buildPlan(true).steps.map(step=>step.words).join(' ');
      if(OLD_FEEDER_POINT_STEP.test(words)||/Cut the top of each roof post to a point/.test(words))wrong(`saved under ${savedUnder}: a step still cuts the points by hand beside the part drawing`);
      if(lines.length!==1||!/pointed tops/.test(lines[0]))wrong(`saved under ${savedUnder}: it must say once that its posts are pointed now, and said: ${lines.join(' / ')||'nothing'}`);
      if(open(JSON.parse(JSON.stringify(S))).length)wrong(`saved under ${savedUnder}: brought up to date, it is updated again when opened again`);
    }
    for(const post of S.parts.filter(piece=>piece.name==='Roof post'))delete post.shape;
    commit();
    open(JSON.parse(JSON.stringify(S)));
    if(S.parts.some(piece=>piece.name==='Roof post'&&piece.shape))wrong('a point taken off by hand comes back when the design is opened again');
  }finally{sayFeederUpgrade=keepSay;load(kept,true);}
});});
/* A design made for outdoors starts as bare wood, so its shopping list does not ask for polyurethane: every
   preset in the Outdoors group must say so with look:{finish:'none'} (OUTDOOR_LOOK in js/presets.js), and the
   name of that finish must still exist. */
SELFTESTS.push(function outdoorPresetsStartBare(problems){
  const outdoors=(PRESET_GROUPS.find(group=>group[0]==='Outdoors')||[,[]])[1];
  for(const name of outdoors){
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(!preset)continue;
    const finish=preset.look&&preset.look.finish;
    if(finish!=='none'||!FINISHES[finish])problems.push(`${name}: an outdoor preset must start as bare wood (look:{finish:'none'}), or its shopping list asks for polyurethane`);
  }
});
/* What the notes of an outdoor preset ask for is what its lists say. The planter, the garden bed and the bird
   feeder start in cedar, so the page says cedar, the shopping list asks for cedar boards and every screw at a
   joint is an exterior screw. The shed stays in framing lumber, with its skids and floor frame as
   pressure-treated boards (materials of their own, js/core.js) on rows of their own. A garden bed, which
   stands in wet soil and is never glued, has no wood glue on its list. */
SELFTESTS.push(function outdoorListsMatchTheNotes(problems){
  const rowsOf=()=>{
    const hardware=hardwareTotals(findJoints());
    return{hardware,shop:shoppingModel(diagramSection(cutRows()).buy,hardware).rows.map(row=>row.name)};
  };
  for(const name of['Planter box','Raised garden bed','Bird feeder']){
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(!preset)continue;
    const vals=presetDefaults(preset);
    placePreset(preset,vals,preset.build(vals),false);
    const{hardware,shop}=rowsOf(),label=name+': ';
    if(look().wood!=='cedar')problems.push(label+'its notes ask for cedar, so it must start in cedar');
    if(hardware.rows.some(row=>/wood screws/.test(row[0])))problems.push(label+'a screw at a joint is listed as a plain wood screw, and its notes ask for exterior screws');
    if(!hardware.rows.some(row=>/exterior screws/.test(row[0])))problems.push(label+'no exterior screws on its hardware list');
    if(!shop.some(row=>/^Cedar \d+x\d+,/.test(row)))problems.push(label+'the shopping list does not ask for cedar boards');
    if(name==='Raised garden bed'&&hardware.glue)problems.push(label+'wood glue is on the list of a bed that is never glued');
  }
  const shed=PRESETS.find(candidate=>candidate.name==='Shed');
  if(shed){
    const vals=presetDefaults(shed);
    placePreset(shed,vals,shed.build(vals),false);
    const nearGround=S.parts.filter(part=>['Skid','Rim joist','Floor joist'].includes(part.name));
    if(!nearGround.length||nearGround.some(part=>!M[part.mat].treated))problems.push('Shed: the skids and the floor frame must be pressure-treated boards');
    if(S.parts.some(part=>M[part.mat].treated&&!['Skid','Rim joist','Floor joist'].includes(part.name)))problems.push('Shed: only the skids and the floor frame are pressure-treated');
    const{shop}=rowsOf();
    if(shop.filter(row=>/^Pressure-treated (2x\d+|4x4), \d+ ft long$/.test(row)).length<2)problems.push('Shed: the shopping list needs rows of their own for the pressure-treated 4x4 and the pressure-treated joist size, and has: '+shop.slice(0,6).join('; '));
    if(!/pressure-treated/i.test((S.notes||[]).join(' ')))problems.push('Shed: the notes must say which wood is pressure-treated');
  }
  // every treated board is the size of the plain board it is named after, and has a price
  for(const m of MATS.filter(mat=>mat.treated)){
    const plain=M[m.nom];
    if(!plain||plain.t!==m.t||plain.w!==m.w||!(builtInPrice(m)>builtInPrice(plain)))problems.push(`materials: ${m.name} must be the size of a plain ${m.nom} and cost more`);
  }
});
