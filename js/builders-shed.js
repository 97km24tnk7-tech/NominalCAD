/* NominalCAD: the shed. A framed garden shed that has to pass the structural check (js/verify.js) at every
   size the form allows, or say in plain words why it cannot be built ("The preset rule" in README.md).

   How it is built, from the ground up:
     floor    4x4 skids, the outer two right under the front and back walls; a rim joist on each of those and
              floor joists every 16" between them; 3/4" plywood deck with its sheet ends on joists
     walls    2x4 studs measured from the outside corner, bottom plate, top plate and a cap plate that laps the
              corners; at the door and each window a full stud, a trimmer stud and a doubled header sized for
              the opening; 1/2" plywood sheathing, which is what stops the shed from leaning over.
              The door and window openings are framed and left open (the owner: a plywood slab for a door
              "seems silly", they "should just be openings"). "Add a plywood door" (p.door) and "Show the
              window" (p.glass) are options of the form, off to start with; the door's pieces, hinges,
              latch and building step are there only when its option is on.
     gable    a ridge board, pairs of rafters notched over the front and back walls, a rafter tie across the shed
              no more than 4 ft apart so the walls cannot spread, gable studs under the two end pairs
     lean-to  the front wall is taller; the side walls follow the slope under a sloped rake plate; rafters run
              from the back wall to the front wall
   Rafters, floor joists and headers are picked with beamCheck (js/verify.js), the same sums the check uses.

   shedPlan(p) makes every decision once: sizes, lumber, where the openings go, and the list of things that
   cannot work (plan.problems, which is what the preset's check(p) returns). buildShed, shedNotes, shedSteps
   and shedHardware all read the same plan, so the drawing, the notes and the instructions cannot disagree.

   World axes: X = left to right (the ridge of a gable runs this way), Y = up, Z = back (0) to front. */
'use strict';

const SHED={
  WALL:3.5,            // thickness of a 2x4 wall
  OVERHANG:6,          // how far the roof reaches past the front and back walls, measured level
  RAFTER_EVERY:24,     // rafters, on center
  JOIST_EVERY:16,      // floor joists, on center
  SKID_EVERY:72,       // skids are never further apart than this
  TIE_EVERY:48,        // rafter ties are never further apart than this
  NAIL_LB:115,         // what one 3" (10d) common nail holds sideways in spruce framing lumber, by rule of thumb
  TIE_MIN_NAILS:4,     // never fewer nails than this at each end of a rafter tie
  TIE_MAX_NAILS:6,     // ties 4 ft apart are used only when this many nails at each end can take the push
  RAFTERS:['2x4','2x6','2x8','2x10','2x12'],
  JOISTS:['2x6','2x8'],
  HEADERS:['2x6','2x8','2x10','2x12'],   // always doubled
  RIDGES:['2x4','2x6','2x8','2x10','2x12'],
  MARGIN:.97,          // a member is picked when it uses no more than this much of its limit
  GABLE_MIN_PITCH:3,   // flatter than this the rafters push the walls apart harder than ties should be trusted with
  TALLEST_WALL:120,    // 2x4 studs are not used taller than 10 ft; this is what limits the slope of a lean-to
  CORNER:4.5,          // nearest an opening may come to the end of its wall: corner stud, full stud, trimmer stud
  BETWEEN:6,           // least solid wall between two openings: trimmer and full stud for each
  BRACE:24,            // a stretch of sheathed wall at least this wide braces the wall
  PIER:12,             // with nothing wider than this between openings, on either of two facing walls, nothing braces them
  SLIVER:8,            // no sheet of plywood narrower than this along a wall
  STRIP:3,             // a strip of sheathing lower than this, or a block shorter than this, is left out
  SHEATHING:.5,        // the wall sheathing is 1/2" plywood
  DOOR_THICK:.75,      // the optional door ("Add a plywood door") is 3/4" plywood
  DOOR_GAP:.25,        // the gap round that door, and between the two doors of a pair
  DOOR_SHEET:48        // a sheet of plywood is 4 ft wide, so an opening wider than this gets a pair of doors
};
/* what the structural check should take each piece for (keys of USES in js/verify.js) */
const SHED_USES={'Skid':'floor','Rim joist':'floor','Floor joist':'floor','Floor deck':'floor',
  'Top plate':'roof','Cap plate':'roof','Rake plate':'roof','Header':'roof','Rafter':'roof','Roof deck':'roof',
  'Bottom plate':'roof','Stud':'roof','Trimmer stud':'roof','Cripple':'roof','Gable stud':'roof',
  'Ridge board':'none','Rafter tie':'none','Sill':'none','Blocking':'none','Wall sheathing':'none','Shed door':'door'};

/* How the shed is fastened: the preset's `joints` list, [piece name, piece name, fastener type] (the types are
   rows of JTYPES in js/joints.js). A shed is nailed, not put together with pocket screws and glue, which is
   what the program would suggest from the shapes of the pieces alone:
     frame     nailed straight through (js/framing.js picks the piece the nail goes through, turns plywood into
               nails by spacing, and gives a wall plate on the floor deck long screws down into the floor frame)
     toenail   nailed at an angle, for a piece that stands on one already in place
     none      the two only touch: the edges of two sheets of plywood, where no fastener can hold
   The floor deck is nailed like the rest of the plywood (screws would bring wood glue and clamps onto the lists,
   which nobody uses on a shed floor). A pair that is not listed would keep the program's suggestion; the
   self-check at the end of this file makes sure no pair is left to it.
   Rafters, rake plates and the roof deck are rotated pieces, which have no joints; shedRoofFasteners counts
   their nails and writes their lines. */
const SHED_JOINTS=(()=>{
  const framing=['Rim joist','Floor joist','Bottom plate','Top plate','Cap plate','Stud','Trimmer stud','Header','Cripple','Sill','Blocking','Gable stud'];
  return[
    // floor
    ['Rim joist','Skid','toenail'],['Floor joist','Skid','toenail'],['Floor joist','Rim joist','frame'],
    ['Floor deck','Floor joist','frame'],['Floor deck','Rim joist','frame'],
    ['Floor deck','Floor deck','none'],['Floor deck','Wall sheathing','none'],['Wall sheathing','Wall sheathing','none'],
    // walls: studs between plates, and the wall down to the floor
    ['Bottom plate','Floor deck','frame'],
    ...['Stud','Trimmer stud','Cripple'].flatMap(stud=>[['Bottom plate',stud,'frame'],[stud,'Top plate','frame']]),
    ['Stud','Stud','frame'],['Stud','Trimmer stud','frame'],['Header','Stud','frame'],['Header','Trimmer stud','frame'],['Cripple','Header','frame'],
    ['Sill','Trimmer stud','frame'],['Cripple','Sill','frame'],['Blocking','Stud','frame'],['Blocking','Trimmer stud','frame'],['Blocking','Cripple','frame'],
    ['Stud','Cap plate','frame'],
    // plates at the corners and on top
    ['Bottom plate','Bottom plate','toenail'],['Top plate','Top plate','toenail'],['Cap plate','Cap plate','toenail'],['Cap plate','Top plate','frame'],
    // what stands on the cap plates once the walls are up
    ['Cap plate','Rafter tie','toenail'],['Cap plate','Gable stud','toenail'],['Gable stud','Ridge board','toenail'],
    // plywood on the frame
    ...framing.map(name=>[name,'Wall sheathing','frame'])];
})();

/* ---------- small helpers ---------- */
/* a number from the form, or the fallback when it cannot be read, kept between lo and hi */
function shedNumber(value,fallback,lo,hi){
  const v=Number.isFinite(+value)?+value:fallback;
  return r16(Math.min(hi,Math.max(lo,v)));   // to the nearest 1/16", so that pieces cut from these sizes meet exactly
}
/* The smallest board of `sizes` that carries `lbPerInchOf(section)` over `span` inches within the limits of the
   use. plies = 2 for a doubled header. Returns {mat, ratio, good} (good = the longest span it could make), or null. */
function shedPickBeam(sizes,span,lbPerInchOf,useKey,plies){
  for(const mat of sizes){
    const section=sectionOf((plies||1)*M[mat].t,M[mat].w,false),load=lbPerInchOf(section);
    const result=beamCheck(section,span,load,useKey);
    if(result.ratio<=SHED.MARGIN)return{mat,ratio:result.ratio,good:maxSpanFor(section,load,useKey)};
  }
  return null;
}
/* Left edges of 1 1/2" members along a run: one at each end, and one centered on every multiple of `every`
   measured from the outside corner of the building, which is `offset` before the start of the run. One that
   would run into the member at the far end stands tight against it instead, so that no two are ever further
   apart than `every` (the roof deck and the floor deck are only good for that much). */
function shedLayout(length,every,offset){
  const out=[0];
  for(let center=every;;center+=every){
    let edge=center-.75-offset;
    if(edge>=length-1.5-1e-6)break;           // at or past the end member
    if(edge>length-3)edge=length-3;           // it would overlap the end member
    if(edge>=1.5-1e-6)out.push(edge);
  }
  out.push(length-1.5);
  return out;
}
/* Cuts the stretch from a to b into sheets no wider than maxWidth. Every cut lands on a multiple of `every`,
   which is the middle of a stud, joist or rafter, and no sheet is a sliver. Returns [[from, to], ...]. */
function shedBreaks(a,b,every,maxWidth){
  const out=[];
  let cur=a;
  while(b-cur>maxWidth+1e-6){
    let next=Math.floor((cur+maxWidth+1e-6)/every)*every;
    if(b-next<SHED.SLIVER)next-=every;
    if(next<=cur+1e-6)next=cur+maxWidth;
    out.push([cur,next]);
    cur=next;
  }
  out.push([cur,b]);
  return out;
}

/* ---------- the plan ---------- */
function shedPlan(p){
  const problems=[];
  const stop=(text,fix)=>{if(!problems.some(f=>f.text===text))problems.push({level:'stop',text,fix});};
  const W=shedNumber(p.W,120,48,192),D=shedNumber(p.D,96,48,144),Hb=shedNumber(p.Hb,84,72,96);
  const lean=p.roof==='lean',sp=+p.sp===24?24:16,T=SHED.WALL;

  // the roof slope
  const asked=Number.isFinite(+p.pitch)?Math.min(24,Math.max(0,+p.pitch)):4;
  let pitch=Math.min(12,Math.max(1,asked));
  if(!lean&&asked<SHED.GABLE_MIN_PITCH){
    stop(`A gable roof this flat (${asked} in 12) cannot be built this way. The flatter the roof, the harder the rafters push the tops of the walls outward, and below ${SHED.GABLE_MIN_PITCH} in 12 that push is more than rafter ties and nails should be trusted with.`,
      `Use a slope of ${SHED.GABLE_MIN_PITCH} or more, or choose the lean-to roof, which can be as flat as 1 in 12.`);
    pitch=SHED.GABLE_MIN_PITCH;
  }
  // A lean-to may be as steep as the form allows. A steep one looks odd, but it stands: what stops it is the
  // height of its front wall (see TALLEST_WALL below), never the slope by itself.
  const deg=Math.round(Math.atan(pitch/12)*18000/Math.PI)/100,ang=deg*Math.PI/180;
  const tan=Math.tan(ang),cos=Math.cos(ang),sin=Math.sin(ang);

  // The notch (birdsmouth) that sits on the wall: as long as the plate is wide, but never deeper than a third
  // of the board, so on a steep roof it is short and the rafter bears on the outer edge of the wall only.
  const seatFor=mat=>Math.min(T,Math.floor(M[mat].w/3/sin*16)/16);
  // The span of a rafter, measured on the level the way the structural check measures it: between the middles
  // of its bearings, and no more than 1 3/4" into each. A lean-to rafter runs from wall to wall; a gable
  // rafter from its seat to the ridge, so a short seat makes the span a little longer.
  const spanFor=mat=>{
    const seat=seatFor(mat);
    return lean?D-T:D/2-.75-seat+Math.min(seat/2,1.75)+1.75;
  };
  // rafters: the smallest board that carries the roof over its own span
  const roofLoad=section=>USES.roof.psf/144*SHED.RAFTER_EVERY+WOOD_RULES.DENSITY*section.A;
  let rafter=null;
  for(const mat of SHED.RAFTERS){
    rafter=shedPickBeam([mat],spanFor(mat),roofLoad,'roof');
    if(rafter)break;
  }
  const rafterSpan=spanFor(rafter?rafter.mat:'2x12');
  if(!rafter){
    stop(`No rafter up to a 2x12 can span ${fmtFt(r16(rafterSpan))} under a roof load of ${USES.roof.psf} lb per square foot.`,
      lean?'Make the shed shallower, or choose the gable roof, whose rafters span half as far.':'Make the shed shallower.');
    rafter={mat:'2x12',ratio:1,good:rafterSpan};
  }
  const depth=M[rafter.mat].w,plumb=depth/cos,seat=seatFor(rafter.mat);

  // Rafter ties (gable). Each pair of rafters pushes the tops of the walls apart with about
  //   (roof load on the pair, per inch of shed depth) x depth / (4 x rise over run)   pounds,
  // so a flat roof on a deep shed pushes hardest. A tie takes the push of every pair up to the next tie and
  // hands it to the rafters through the nails at its ends, so the nails decide how far apart the ties may be:
  // 4 ft when a few nails can take it, otherwise a tie beside every pair. Within the limits of the form the
  // hardest case (12 ft deep at 3 in 12, a tie at every pair) needs 7 nails, which fit in that long overlap.
  const pushPerPair=USES.roof.psf/144*SHED.RAFTER_EVERY*D/(4*tan);
  const tieNails=every=>Math.max(SHED.TIE_MIN_NAILS,Math.ceil(pushPerPair*every/SHED.RAFTER_EVERY/SHED.NAIL_LB-1e-6));
  const tieEvery=tieNails(SHED.TIE_EVERY)<=SHED.TIE_MAX_NAILS?SHED.TIE_EVERY:SHED.RAFTER_EVERY;
  const tie={every:tieEvery,nails:tieNails(tieEvery),push:Math.round(pushPerPair*tieEvery/SHED.RAFTER_EVERY)};

  // floor: skids no further apart than SKID_EVERY, and the smallest joist that spans between them
  const floorLoad=section=>USES.floor.psf/144*SHED.JOIST_EVERY+WOOD_RULES.DENSITY*section.A;
  const skidCount=Math.max(2,Math.ceil((D-T)/SHED.SKID_EVERY-1e-6)+1),joistSpan=(D-T)/(skidCount-1);
  const joist=shedPickBeam(SHED.JOISTS,joistSpan,floorLoad,'floor')||{mat:'2x8',ratio:1,good:joistSpan};
  const skids=[];
  for(let i=0;i<skidCount;i++)skids.push(r16(i*(D-T)/(skidCount-1)));
  const F=3.5+M[joist.mat].w+.75;                       // top of the floor deck above the ground

  // wall heights
  // (rounded down to 1/16": a front wall a hair too tall would make the rafter notch deeper than it may be)
  const Hf=lean?Math.floor((Hb+(D-T)*tan)*16+1e-6)/16:Hb;
  if(lean&&Hf>SHED.TALLEST_WALL+1e-6){
    // the steepest slope, to one decimal, that keeps the front wall within the limit at this depth and back wall
    const steepest=Math.floor((SHED.TALLEST_WALL-Hb)/(D-T)*120)/10;
    // typedLen (js/core.js): under the form this sentence quotes the typed depth and wall height as the boxes show
    // them, and the heights worked out beside them the same way, so one sentence never mixes 7'-0" and 9' 4"
    stop(`The front wall of this lean-to would be ${typedLen(Hf,fmtFt)} tall: at ${pitch} in 12 the roof climbs ${typedLen(r16(Hf-Hb),fmtFt)} over a shed ${typedLen(D,fmtFt)} deep. 2x4 studs should not stand taller than ${typedLen(SHED.TALLEST_WALL,fmtFt)}: they bow, and a wall that tall catches the wind.`,
      `Use a slope of ${steepest} in 12 or less with these sizes, lower the back wall, make the shed shallower, or choose the gable roof: its peak is in the middle, so the walls stay ${typedLen(Hb,fmtFt)} tall at any slope up to 12 in 12.`);
  }

  // gable: the ridge board is as deep as the plumb cut on the rafters, unless that would foul the rafter ties
  const ridgeTop=(D/2-.75-seat)*tan+plumb;              // above the top of the walls
  let ridge=SHED.RIDGES.find(mat=>M[mat].w>=plumb-1e-6)||'2x12';
  if(ridgeTop-M[ridge].w<3.5){
    const lower=SHED.RIDGES.filter(mat=>M[mat].w>=depth-1e-6&&ridgeTop-M[mat].w>=3.5).pop();
    if(lower)ridge=lower;
  }
  // a rafter tie is a 2x4 on edge; its ends stop where its top corner would poke through the roof
  const tieClip=Math.min(2.5,Math.max(0,Math.ceil((seat+(3.5-plumb)/tan)*16)/16));

  // the four walls. u runs along a wall from its start; side walls fit between the front and back walls.
  const walls={
    back: {key:'back', label:'back wall', alongX:true, ox:0,  oz:0,  len:W,    outer:0,offset:0,bearing:true, height:Hb},
    front:{key:'front',label:'front wall',alongX:true, ox:0,  oz:D-T,len:W,    outer:1,offset:0,bearing:true, height:Hf},
    left: {key:'left', label:'left wall', alongX:false,ox:0,  oz:T,  len:D-2*T,outer:0,offset:T,bearing:false,height:Hb},
    right:{key:'right',label:'right wall',alongX:false,ox:W-T,oz:T,  len:D-2*T,outer:1,offset:T,bearing:false,height:Hb}};
  // how far the sheathing stops below the top of a wall the rafter tails pass over
  const tailDrop=Math.ceil(((seat+.5)*tan+.125)*16)/16;
  for(const wall of Object.values(walls)){
    wall.ops=[];
    wall.outside=wall.len+2*wall.offset;   // corner to corner of the building, which is the length a person measures
    wall.raked=lean&&!wall.alongX;
    // where the studs end, above the floor deck: under the two plates, or under the sloped rake plate
    wall.studTop=wall.raked?u=>Hb+(T+u-seat)*tan-1.5/cos:()=>wall.height-3;
    wall.cap=wall.raked?null:lean?[0,wall.len]:wall.alongX?[T,wall.len-T]:[-T,wall.len+T];
    // sheathing goes up to the top of the wall; on a side wall of a lean-to, level with its low end (the sloped
    // strip above that is cut on site to follow the roof)
    // Where a rafter or the rake plate passes right over the top edge it stops 1/4" short: the roof sits on the
    // plates, never on the edge of the plywood.
    wall.sheathTop=wall.raked?r16(F+wall.studTop(0))-.25
      :wall.key==='back'||(wall.key==='front'&&!lean)?F+wall.height-tailDrop
      :lean?F+wall.height-.25:F+wall.height;
    // One sheet covers 8 ft. It starts at the top of the skids when it reaches the top of the wall from there,
    // otherwise it hangs from the top of the wall; a wall too tall for either gets a second row of sheets.
    const top=wall.sheathTop;
    wall.sheathBottom=top-3.5<=96?3.5:top-F<=96?top-96:3.5;
    // A level joint between sheets needs wood behind it (blocking). Height above the floor deck of that joint:
    // between two rows of sheets, or along the top edge of the sheets on a raked wall, where the sloped piece
    // the builder cuts to the roof begins. null when the sheets end on the plates.
    wall.sheathJoint=top-wall.sheathBottom>96+1e-6?wall.sheathBottom+96-F:wall.raked?top-F:null;
  }

  // headers: doubled, sized for the opening and for how much roof the wall carries
  const lineLoad=wall=>USES.roof.psf/144*(wall.bearing?D/2+SHED.OVERHANG:SHED.RAFTER_EVERY);
  const headerFor=(wall,width)=>shedPickBeam(SHED.HEADERS,width+1.5,section=>lineLoad(wall)+WOOD_RULES.DENSITY*section.A,'roof',2);
  /* an opening between u0 and u1, from `bot` to `top` above the floor deck. The header sits on top of it, or
     tight under the plate when less than a cripple stud's worth of space would be left above it. */
  const addOpening=(wall,kind,u0,width,bot,top,header)=>{
    const room=wall.studTop(u0-1.5),deep=M[header].w;
    wall.ops.push({kind,u0,u1:u0+width,bot,top,header,hy:room-(top+deep)<1.5?Math.floor((room-deep)*16)/16:top});
    wall.ops.sort((a,b)=>a.u0-b.u0);
  };

  // the door
  const doorWall=walls[p.dwall]||walls.front,doorRoom=doorWall.len-2*SHED.CORNER;
  let dw=shedNumber(p.dw,36,12,96),dh=shedNumber(p.dh,72,24,120),du;
  if(dw>doorRoom+1e-6){
    // typedLen (js/core.js): a size typed in a box of the form, or one to type there, is quoted the way the box shows it
    stop(`The door is ${typedLen(dw)} wide, but the ${doorWall.label} is only ${typedLen(doorWall.outside,fmtFt)} long on the outside. With a corner stud, a full stud and a trimmer stud on each side there is room for a door up to ${typedLen(doorRoom)} wide.`,
      'Make the door narrower, put it on a longer wall, or make the shed bigger.');
    dw=doorRoom;
  }
  // The door's distance is measured the way a person standing outside and facing the wall would measure it:
  // from the outside corner on their left to the near edge of the door. On the back wall and the right wall
  // that corner is at the far end of the wall as this plan counts along it (u runs left to right seen from the
  // front, and back to front), so the distance is turned round there.
  const doff=shedNumber(p.doff,0,0,1200);
  if(doff>0){
    const fromStart=doff-doorWall.offset,turned=doorWall.key==='back'||doorWall.key==='right';
    du=turned?doorWall.len-fromStart-dw:fromStart;
    if(du<SHED.CORNER-1e-6||du+dw>doorWall.len-SHED.CORNER+1e-6){
      // to the 1/16" like every other size; rounded inward so that both ends of the range really fit
      const nearest=Math.ceil((doorWall.offset+SHED.CORNER)*16-1e-6)/16,furthest=Math.floor((doorWall.offset+doorWall.len-SHED.CORNER-dw)*16+1e-6)/16;
      const where=furthest>nearest+1e-6?`between ${typedLen(nearest)} and ${typedLen(furthest)}`:typedLen(nearest);   // one number when there is only one place for it
      stop(`A ${typedLen(dw)} door set ${typedLen(doff)} from the corner does not fit on the ${doorWall.label}, which is ${typedLen(doorWall.outside,fmtFt)} long on the outside. It needs a corner stud, a full stud and a trimmer stud between it and each corner.`,
        `Set it ${where} from the corner, or type 0 to center it.`);
      du=Math.min(Math.max(du,SHED.CORNER),doorWall.len-SHED.CORNER-dw);
    }
  }else du=r16((doorWall.len-dw)/2);
  let doorHeader=headerFor(doorWall,dw);
  if(!doorHeader){
    stop(`A door ${typedLen(dw)} wide in the ${doorWall.label} needs a header stronger than a doubled 2x12 to carry the roof above it.`,
      'Make the door narrower, or put it in a side wall, which carries much less of the roof.');
    doorHeader={mat:'2x12'};
  }
  const doorTop=doorWall.studTop(du-1.5)-M[doorHeader.mat].w;
  if(dh>doorTop+1e-6){
    stop(`The door is ${typedLen(dh)} tall. With the doubled ${doorHeader.mat} header over it, it needs ${typedLen(dh+M[doorHeader.mat].w)} under the top plates, but the ${doorWall.label} has only ${typedLen(r16(doorTop+M[doorHeader.mat].w))} there.`,
      `Make the door ${typedLen(Math.floor(doorTop))} or shorter, or make the walls taller${lean&&doorWall.key!=='front'?', or put the door in the taller front wall':''}.`);
    dh=Math.floor(doorTop);
  }
  addOpening(doorWall,'door',du,dw,0,dh,doorHeader.mat);

  // the windows: shared out over the wall or walls chosen, either side of a door on the same wall
  const windowWalls=p.wwall==='both'?[walls.left,walls.right]:[walls[p.wwall]||walls.right];
  const wanted=new Map(windowWalls.map(wall=>[wall,0]));
  const windowCount=Math.round(shedNumber(p.wn,1,0,24));
  for(let i=0;i<windowCount;i++){
    const wall=windowWalls[i%windowWalls.length];
    wanted.set(wall,wanted.get(wall)+1);
  }
  const ww=shedNumber(p.ww,24,6,96),wh=shedNumber(p.wh,24,6,96),sill=shedNumber(p.sill,40,6,96);
  for(const[wall,count]of wanted){
    if(!count)continue;
    const door=wall.ops.find(o=>o.kind==='door');
    const free=door?[[SHED.CORNER,door.u0-SHED.BETWEEN],[door.u1+SHED.BETWEEN,wall.len-SHED.CORNER]]:[[SHED.CORNER,wall.len-SHED.CORNER]];
    const room=free.map(([a,b])=>Math.max(0,Math.floor((b-a+SHED.BETWEEN+1e-6)/(ww+SHED.BETWEEN))));
    const fits=room.reduce((sum,n)=>sum+n,0);
    if(count>fits){
      stop(`${count} window${count>1?'s':''} ${typedLen(ww)} wide ${count>1?'do':'does'} not fit on the ${wall.label}, which is ${typedLen(wall.outside,fmtFt)} long on the outside${door?' and has the door in it':''}. Each window needs a trimmer stud and a full stud on both sides. There is room for ${fits||'none'}.`,
        'Ask for fewer or narrower windows, or put them on a longer wall or on both side walls.');
    }
    let header=headerFor(wall,ww);
    if(!header){
      stop(`A window ${typedLen(ww)} wide in the ${wall.label} needs a header stronger than a doubled 2x12.`,'Make the windows narrower.');
      header={mat:'2x12'};
    }
    const share=room.map(()=>0);
    for(let left=Math.min(count,fits),i=0;left>0;i++){
      const k=i%room.length;
      if(share[k]<room[k]){share[k]++;left--;}
    }
    free.forEach(([a,b],k)=>{
      const n=share[k];
      if(!n)return;
      const between=Math.max(SHED.BETWEEN,(b-a-n*ww)/(n+1)),ends=(b-a-n*ww-(n-1)*between)/2;
      for(let i=0;i<n;i++){
        const u0=r16(a+ends+i*(ww+between)),top=wall.studTop(u0-1.5)-M[header.mat].w;
        let height=wh;
        if(sill+wh>top+1e-6){
          // typedLen (js/core.js): the top of the glass is the typed sill plus the typed window height, so under the
          // form it reads the way those boxes show sizes, like the door's finding above
          stop(`The windows reach ${typedLen(sill+wh)} above the floor. With the doubled ${header.mat} header over them they need ${typedLen(sill+wh+M[header.mat].w)} under the top plate, but the ${wall.label} has only ${typedLen(r16(top+M[header.mat].w))} there.`,
            `Lower the windows or make them shorter (the top of the glass can be at most ${typedLen(Math.floor(top))} above the floor), or make the walls taller.`);
          height=Math.floor(top)-sill;
        }
        if(height>=6)addOpening(wall,'window',u0,ww,sill,sill+height,header.mat);
      }
    });
  }

  // bracing: each way the shed could lean, one of the two walls that resist it needs a solid sheathed stretch
  for(const wall of Object.values(walls)){
    const total=wall.alongX?W:D;
    let from=0,widest=0;
    for(const o of wall.ops){widest=Math.max(widest,wall.offset+o.u0-from);from=wall.offset+o.u1;}
    wall.solid=Math.max(widest,total-from);
  }
  for(const[a,b,way]of[[walls.front,walls.back,'left or right'],[walls.left,walls.right,'forward or back']]){
    const widest=Math.max(a.solid,b.solid);
    if(widest>=SHED.BRACE)continue;
    // narrow piers between openings brace a little (marginal); next to nothing cannot work
    problems.push({level:widest>=SHED.PIER?'warn':'stop',
      text:`Neither the ${a.label} nor the ${b.label} has a solid stretch at least ${fmt(SHED.BRACE)} wide between its corners and openings (the widest is ${fmt(r16(widest))}). The plywood sheathing on those stretches is all that stops the shed from leaning ${way}`+
        (widest>=SHED.PIER?', and narrow strips between openings do that job poorly.':'.'),
      fix:'Make the door or the windows narrower, ask for fewer windows, or move some of them to another wall.'});
  }

  // The openings are framed and left open. Two options of the form put something in them; neither changes a
  // single piece of the framing, so the bracing rule above and every other check hold with them on or off.
  const windowOpenings=Object.values(walls).flatMap(wall=>wall.ops).filter(o=>o.kind==='window');
  return{W,D,Hb,Hf,F,lean,pitch,deg,ang,tan,cos,sin,sp,seat,walls,problems,skids,
    plywoodDoor:!!p.door,          // "Add a plywood door": off, the door opening is framed and left open
    doorLeaves:p.door?shedDoorLeaves(dw):0,   // how many plywood doors are built: none, one, or a pair in a wide opening
    showWindows:!!p.glass,         // "Show the window": off, the window openings are framed and left open
    windowCount:windowOpenings.length,
    windowSize:windowOpenings.length?[ww,windowOpenings[0].top-windowOpenings[0].bot]:null,   // width and height of each opening
    rafter:{mat:rafter.mat,depth,plumb,span:rafterSpan,good:rafter.good},
    joist:{mat:joist.mat,span:joistSpan,good:joist.good},
    ridge:{mat:ridge,top:ridgeTop},tieClip,tie,
    rafterEdges:shedLayout(W,SHED.RAFTER_EVERY,0),
    peak:lean?F+Hf+(T-seat+SHED.OVERHANG)*tan+plumb:F+Hb+(D/2-seat)*tan+plumb};
}

/* ---------- building it ---------- */
function shedFloor(P,plan){
  const{W,D,joist}=plan,deep=M[joist.mat].w;
  // the skids and the floor frame are pressure-treated boards (materials of their own, js/core.js): they sit near the ground
  const floorMat=treatedMat(joist.mat);
  for(const z of plan.skids)P.push(mk('Skid',treatedMat('4x4'),[W,3.5,3.5],[0,0,z]));
  P.push(mk('Rim joist',floorMat,[W,deep,1.5],[0,3.5,0]),mk('Rim joist',floorMat,[W,deep,1.5],[0,3.5,D-1.5]));
  for(const x of shedLayout(W,SHED.JOIST_EVERY,0))P.push(mk('Floor joist',floorMat,[1.5,deep,D-3],[x,3.5,1.5]));
  // the sheets lie with their grain across the joists, and their ends on the middle of a joist
  P.push(...shedFloorPieces(plan,shedFloorChoice(plan),3.5+deep));
}
/* The floor deck: the floor is cut into columns between joints over joists (shedBreaks, at most 96" wide) and each
   column into rows front to back (at most 48" deep). How the pieces are cut is chosen to buy the fewest sheets of
   3/4" plywood (shedFloorChoice), with two rules a builder of floors keeps:
   - The grain across the joists. A floor sheet is strong along its face grain (the 8 ft way of a full sheet), so
     the grain runs left to right (world X), across the joists. A piece deeper than it is wide that reaches over a
     joist between its ends, such as the 24" x 48" pieces at the end of a 10 ft x 8 ft floor, is cut with the
     grain along its width: grainAxis tells the cutting diagrams so (sheetWays, js/buying.js), and two such pieces
     come out of one sheet at full size. A narrow strip that reaches only from one joist to the next is cut as
     before, its longer side along the sheet. At the few sizes where the grain across would take one more sheet,
     those pieces are cut as before too, and the floor step says so.
   - 1/16" given up at a joint (SHED_FLOOR_GIVE, approved by the owner), only where that saves a sheet: two 48"
     squares at the end of a 12 ft floor miss sharing a sheet by the width of a saw cut. Only at a joint between
     two floor pieces, never at the outside of the floor, so the floor still reaches the rim joists all round and
     every joint across the joists still lands on a joist; the gap of 1/8" or less is what floors are laid with.
   choice: {grain: true for the grain across the joists, give: per column {depth, width: 'left' | 'right' | false}}.
   y: the height of the underside of the deck. */
const SHED_FLOOR_GIVE=1/16;
function shedFloorPieces(plan,choice,y){
  const{W,D}=plan,rows=Math.ceil(D/48-1e-6),joistsAt=shedLayout(W,SHED.JOIST_EVERY,0),out=[];
  shedBreaks(0,W,SHED.JOIST_EVERY,96).forEach(([x0,x1],column)=>{
    const give=choice.give[column]||{depth:false,width:false};
    for(let row=0;row<rows;row++){
      let z0=r16(row*D/rows),z1=r16((row+1)*D/rows);
      // the 1/16" a piece gives up at the joint with the next row: the first row at its front edge, the others at their back edge
      if(give.depth){if(row===0)z1-=SHED_FLOOR_GIVE;else z0+=SHED_FLOOR_GIVE;}
      const left=x0+(give.width==='left'?SHED_FLOOR_GIVE:0),width=x1-x0-(give.width?SHED_FLOOR_GIVE:0);
      const piece=mk('Floor deck','ply34',[width,.75,z1-z0],[left,y,z0]);
      // the grain across the joists: a piece deeper than it is wide, with a joist between its ends (middle of the joist)
      const overAJoist=joistsAt.some(x=>x+.75>left+1&&x+.75<left+width-1);
      if(choice.grain&&piece.ax[0]!==0&&overAJoist)piece.grainAxis=0;
      out.push(piece);
    }
  });
  return out;
}
/* The way to cut the floor that buys the fewest sheets: the grain across the joists first, then with the pieces as
   before; in each, a column gives up 1/16" (depth, width, both, tried in that order) only when that buys fewer
   sheets for the whole floor. A tie keeps the grain across and the pieces whole. */
function shedFloorChoice(plan){
  const sheetsFor=choice=>materialBuy(M.ply34,shedFloorPieces(plan,choice,0),()=>'',0).sheets.length;
  const rows=Math.ceil(plan.D/48-1e-6),columns=shedBreaks(0,plan.W,SHED.JOIST_EVERY,96);
  let best=null,bestSheets=Infinity;
  for(const grain of[true,false]){
    const choice={grain,give:columns.map(()=>({depth:false,width:false}))};
    let sheets=sheetsFor(choice);
    columns.forEach(([x0,x1],column)=>{
      // a column a full sheet wide (96") gains nothing from 1/16" less
      if(x1-x0>=96-1e-6)return;
      const side=x0>1e-6?'left':x1<plan.W-1e-6?'right':false;
      const tries=[{depth:rows>1,width:false}];
      if(side)tries.push({depth:false,width:side},{depth:rows>1,width:side});
      for(const give of tries){
        if(!give.depth&&!give.width)continue;
        const trial={grain,give:choice.give.map((g,c)=>c===column?give:g)};
        const count=sheetsFor(trial);
        if(count<sheets){choice.give=trial.give;sheets=count;break;}
      }
    });
    if(sheets<bestSheets){best=choice;bestSheets=sheets;}
  }
  // the pieces as before won: with the same 1/16" given up, the grain across may do as well
  if(!best.grain&&sheetsFor({grain:true,give:best.give})<=bestSheets)best={grain:true,give:best.give};
  return best;
}
/* The words for the floor pieces that gave up 1/16" (shedFloorChoice), for the notes and the floor step; '' when none did. */
function shedFloorGiveWords(plan){
  const choice=shedFloorChoice(plan),rows=Math.ceil(plan.D/48-1e-6),columns=shedBreaks(0,plan.W,SHED.JOIST_EVERY,96);
  const column=columns.findIndex((_,index)=>choice.give[index]&&(choice.give[index].depth||choice.give[index].width));
  if(column<0)return'';
  const[x0,x1]=columns[column],give=choice.give[column];
  const width=r16(x1-x0-(give.width?SHED_FLOOR_GIVE:0)),depth=r16(plan.D/rows-(give.depth?SHED_FLOOR_GIVE:0));
  const sides=[give.depth?'front to back':'',give.width?'left to right':''].filter(Boolean).join(' and ');
  return`The floor pieces at the ${x0>0?'right':'left'} end are cut ${fmt(width)} × ${fmt(depth)}, 1/16" short of their space ${sides}, so that they share a sheet of plywood instead of taking one each. Leave the little gap at the joint between floor pieces: floors are laid with about 1/8" between sheets anyway, so the plywood can swell.`;
}
/* The words for floor pieces cut with the grain along their width (shedFloorPieces), for the floor step; '' when none is. */
function shedFloorGrainWords(parts){
  const decks=parts.filter(piece=>piece.name==='Floor deck');
  const across=decks.filter(piece=>piece.grainAxis===0&&piece.ax[1]===0);
  // a piece deeper than it is wide cut as before, longer side along the sheet (no grainAxis: shedFloorPieces)
  const strips=decks.filter(piece=>piece.ax[0]!==0&&piece.grainAxis===undefined);
  let words='';
  if(across.length){
    const piece=across[0],end=piece.pos[0]>0?'right':'left',many=across.length>1;
    const which=many?`${across.length===2?'two':across.length} ${fmt(piece.w)} × ${fmt(piece.l)} pieces at the ${end} end are`:`${fmt(piece.w)} × ${fmt(piece.l)} piece at the ${end} end is`;
    words+=` The ${which} cut with the grain of the face running along the ${fmt(piece.w)} side (the cutting diagrams show it), so that on the floor the grain runs across the joists like the rest.`;
  }
  if(strips.length){
    const piece=strips[0],end=piece.pos[0]>0?'right':'left',many=strips.length>1;
    words+=` The ${fmt(piece.w)} × ${fmt(piece.l)} ${many?'pieces':'piece'} at the ${end} end ${many?'are':'is'} narrow and ${many?'are':'is'} cut with the grain along ${many?'their':'its'} ${fmt(piece.l)} side, so that ${many?'they come':'it comes'} out of the sheets on the list: on the floor that grain runs along the joists.`;
  }
  return words;
}
/* one framed wall: plates, studs, and the framing round each opening */
function shedWall(P,plan,wall){
  const T=SHED.WALL,len=wall.len;
  // a piece in wall coordinates: u along the wall, y above the floor deck, n through the wall
  const put=(name,mat,u,ul,y,yl,n0,nl)=>{
    P.push(wall.alongX?mk(name,mat,[ul,yl,nl],[wall.ox+u,plan.F+y,wall.oz+n0]):mk(name,mat,[nl,yl,ul],[wall.ox+n0,plan.F+y,wall.oz+u]));
  };
  // a stud is cut to its long point: under a sloped plate that is its higher side
  const longPoint=u=>Math.max(wall.studTop(u),wall.studTop(u+1.5));
  const uprights=[];   // every upright of this wall: where it stands and from where to where it goes (for the blocking)
  const upright=(name,u,from,to)=>{
    if(to-from<1.5-1e-6)return;
    put(name,'2x4',u,1.5,from,to-from,0,T);
    // A block exactly as tall as a 2x4 is wide (a 3 1/2" cripple) or as it is thick (1 1/2") could be read as
    // lying through the wall or along it: its sizes alone do not say which way it stands. It stands like every
    // other upright, and that is written down here instead of being guessed: its length is its height (so it
    // is nailed into its end like the rest), its 1 1/2" runs along the wall and its 3 1/2" through it.
    const piece=P[P.length-1],alongWall=wall.alongX?0:2,throughWall=2-alongWall;
    piece.ax=[1,throughWall,alongWall];
    piece.l=to-from;piece.w=T;piece.t=1.5;
    uprights.push({u,from,to});
  };

  let plates=[[0,len]];
  for(const o of wall.ops){
    if(o.kind==='door')plates=plates.flatMap(([a,b])=>o.u0>a&&o.u1<b?[[a,o.u0],[o.u1,b]]:[[a,b]]);
  }
  for(const[a,b]of plates)put('Bottom plate','2x4',a,b-a,0,1.5,0,T);
  if(!wall.raked){
    put('Top plate','2x4',0,len,wall.height-3,1.5,0,T);
    put('Cap plate','2x4',wall.cap[0],wall.cap[1]-wall.cap[0],wall.height-1.5,1.5,0,T);
  }
  const layout=shedLayout(len,plan.sp,wall.offset);
  const atOpening=u=>wall.ops.some(o=>u<o.u1+3-1e-6&&u+1.5>o.u0-3+1e-6);
  for(const u of layout)if(!atOpening(u))upright('Stud',u,1.5,longPoint(u));

  for(const o of wall.ops){
    const deep=M[o.header].w,width=o.u1-o.u0;
    upright('Stud',o.u0-3,1.5,longPoint(o.u0-3));
    upright('Stud',o.u1+1.5,1.5,longPoint(o.u1+1.5));
    upright('Trimmer stud',o.u0-1.5,1.5,o.hy);
    upright('Trimmer stud',o.u1,1.5,o.hy);
    // two boards on edge, flush with both faces of the wall; scraps of 1/2" plywood go between them
    for(const n0 of[0,2])put('Header',o.header,o.u0-1.5,width+3,o.hy,deep,n0,1.5);
    if(o.kind==='window')put('Sill','2x4',o.u0,width,o.bot-1.5,1.5,0,T);
    for(const u of layout){
      if(u>=o.u0-1.5-1e-6&&u+1.5<=o.u1+1.5+1e-6)upright('Cripple',u,o.hy+deep,longPoint(u));
      if(o.kind==='window'&&u>=o.u0-1e-6&&u+1.5<=o.u1+1e-6)upright('Cripple',u,1.5,o.bot-1.5);
    }
    // An opening is framed and left open unless its option is on.
    if(o.kind==='window'){
      if(plan.showWindows)put('Window','glass',o.u0,width,o.bot,o.top-o.bot,1.25,1);
      continue;
    }
    if(!plan.plywoodDoor)continue;
    // The door stands in the opening with a gap all round, and its face is flush with the outside of the wall
    // sheathing: a T-hinge has one leaf on the wall and one on the door, so the two faces must be level.
    const leaves=shedDoorLeaves(width),gap=SHED.DOOR_GAP,leaf=(width-gap*(leaves+1))/leaves;
    const flush=wall.outer?T+SHED.SHEATHING-SHED.DOOR_THICK:-SHED.SHEATHING;
    for(let i=0;i<leaves;i++)put('Shed door','ply34',o.u0+gap+i*(leaf+gap),leaf,gap,o.top-2*gap,flush,SHED.DOOR_THICK);
  }
  shedBlocking(wall,uprights,put);
}
/* how many doors close an opening of this width when "Add a plywood door" is on: one, or a pair */
function shedDoorLeaves(openingWidth){
  return openingWidth>SHED.DOOR_SHEET?2:1;
}
/* Blocking: a 2x4 on edge between the studs, flush with the outside of the wall, behind a level joint in the
   sheathing (wall.sheathJoint), so that the edges of both sheets have wood to be nailed to. One goes wherever
   two neighboring uprights both pass the joint and no opening, sill or header is in the way. */
function shedBlocking(wall,uprights,put){
  if(wall.sheathJoint===null)return;
  const at=wall.sheathJoint,half=1.75;
  const through=uprights.filter(s=>s.from<=at-half+1e-6&&s.to>=at+half-1e-6).sort((a,b)=>a.u-b.u);
  for(let i=1;i<through.length;i++){
    const from=through[i-1].u+1.5,to=through[i].u;
    // the sheets above and below an opening have no level joint, so nothing goes between its two full studs
    const inTheWay=wall.ops.some(o=>from<o.u1-1e-6&&to>o.u0+1e-6);
    if(to-from>=SHED.STRIP&&!inTheWay)put('Blocking','2x4',from,to-from,at-half,3.5,wall.outer?SHED.WALL-1.5:0,1.5);
  }
}
/* 1/2" plywood on the outside of one wall, corner to corner of the building, cut round the openings.
   Sloped tops (a lean-to's side walls, the triangle of a gable) are left for the builder to cut to the roof. */
function shedSheathing(P,plan,wall){
  const total=wall.alongX?plan.W:plan.D,off=wall.offset,out=wall.outer?SHED.WALL:-.5;
  const wallTop=wall.sheathTop,wallBottom=wall.sheathBottom;
  const sheet=(a,b,y0,y1)=>{
    if(b-a<1||y1-y0<SHED.STRIP)return;
    for(let y=y0;y<y1-1e-6;y+=96){
      const tall=Math.min(96,y1-y);
      P.push(wall.alongX?mk('Wall sheathing','ply12',[b-a,tall,.5],[a,y,wall.oz+out]):mk('Wall sheathing','ply12',[.5,tall,b-a],[wall.ox+out,y,a]));
    }
  };
  const solid=(a,b)=>{
    if(b-a<1)return;
    for(const[from,to]of shedBreaks(a,b,plan.sp,48))sheet(from,to,wallBottom,wallTop);
  };
  // the piece above or below an opening: one sheet turned on its side while it is no taller than a sheet is
  // wide; otherwise (over a wide door in a tall wall) cut into widths like the rest of the wall, which puts
  // the joints on the cripple studs above the header
  const patch=(a,b,y0,y1)=>{
    if(b-a<=48+1e-6||y1-y0<=48+1e-6)sheet(a,b,y0,y1);
    else for(const[from,to]of shedBreaks(a,b,plan.sp,48))sheet(from,to,y0,y1);
  };
  let from=0;
  for(const o of wall.ops){
    const a=off+o.u0,b=off+o.u1;
    solid(from,a);
    patch(a,b,plan.F+o.top,wallTop);                                     // above the opening
    patch(a,b,wallBottom,plan.F+(o.kind==='door'?0:o.bot));              // below a window, or over the floor frame under a door
    from=b;
  }
  solid(from,total);
}
/* A board or a sheet lying on the roof slope. It runs from zA to zB (measured level) along the line
   y = lineAt(z), which rises toward the front when dir is 1 and toward the back when dir is -1.
   above = true: it lies on top of the line (the roof deck on the rafters); false: it hangs under it
   (a rafter under the roof surface). Both ends are cut square, so the length is the full board. */
function shedSlopePiece(plan,name,mat,x0,wide,thick,zA,zB,lineAt,dir,above){
  const length=(zB-zA)/plan.cos,zMid=(zA+zB)/2,side=above?1:-1;
  const cy=lineAt(zMid)+side*thick/2*plan.cos,cz=zMid-side*dir*thick/2*plan.sin;
  const piece=mk(name,mat,[wide,thick,length],[x0,0,0]);
  // exact, not rounded to 1/16": pieces on a slope have to touch each other to within a hair
  const s=size(piece),fine=v=>Math.round(v*1024)/1024;
  piece.pos=[x0,fine(cy-s[1]/2),fine(cz-s[2]/2)];
  piece.rot={k:0,deg:-dir*plan.deg};
  return piece;
}
/* plywood on one roof slope: long side across the rafters, sheet ends on the middle of a rafter */
function shedRoofDeck(P,plan,zA,zB,topLine,dir){
  const courses=Math.ceil((zB-zA)/plan.cos/48-1e-6),step=(zB-zA)/courses;
  for(const[x0,x1]of shedBreaks(0,plan.W,SHED.RAFTER_EVERY,96)){
    for(let c=0;c<courses;c++)P.push(shedSlopePiece(plan,'Roof deck','ply12',x0,x1-x0,.5,zA+c*step,zA+(c+1)*step,topLine,dir,true));
  }
}
function shedGableRoof(P,plan){
  const{W,D,tan,seat,sp}=plan,mid=D/2,wallTop=plan.F+plan.Hb,over=SHED.OVERHANG,rafter=plan.rafter;
  // the underside of the rafters on each slope; the roof surface is one plumb cut higher
  const slopes=[
    {dir:1, from:-over, to:mid-.75,deckFrom:-over,deckTo:mid,   under:z=>wallTop+(z-seat)*tan},
    {dir:-1,from:mid+.75,to:D+over,deckFrom:mid,  deckTo:D+over,under:z=>wallTop+(D-seat-z)*tan}];
  const ridgeDeep=M[plan.ridge.mat].w,ridgeBottom=wallTop+plan.ridge.top-ridgeDeep;
  P.push(mk('Ridge board',plan.ridge.mat,[W,ridgeDeep,1.5],[0,ridgeBottom,mid-.75]));
  for(const slope of slopes){
    const surface=z=>slope.under(z)+rafter.plumb;
    for(const x of plan.rafterEdges)P.push(shedSlopePiece(plan,'Rafter',rafter.mat,x,1.5,rafter.depth,slope.from,slope.to,surface,slope.dir,false));
    shedRoofDeck(P,plan,slope.deckFrom,slope.deckTo,surface,slope.dir);
  }
  // rafter ties: across the shed on the cap plates, beside a pair of rafters, never more than plan.tie.every
  // apart (4 ft, or beside every pair when the roof pushes hard; the end walls tie the two end pairs)
  // A rafter that stands over an end wall (the last one of the regular spacing can land there) is tied by that
  // wall like the end pair, and a tie beside it would run into the gable studs.
  const inner=plan.rafterEdges.slice(1,-1).filter(x=>x<=W-SHED.WALL+1e-6);
  let tied=0;
  inner.forEach((x,i)=>{
    const nextLine=i+1<inner.length?inner[i+1]+.75:W;
    if(nextLine-tied<=plan.tie.every+1e-6)return;
    P.push(mk('Rafter tie','2x4',[1.5,3.5,D-2*plan.tieClip],[x-1.5,wallTop,plan.tieClip]));
    tied=x+.75;
  });
  // gable studs: on the cap plate of each end wall, under the end rafters, in line with the wall studs below
  for(const x0 of[0,W-SHED.WALL]){
    const stud=(z,top)=>{if(top-wallTop>=3)P.push(mk('Gable stud','2x4',[3.5,r16(top-wallTop),1.5],[x0,wallTop,z]));};
    stud(mid-.75,ridgeBottom);
    for(let center=sp;center<D-1e-6;center+=sp){
      if(Math.abs(center-mid)<2.25)continue;
      const z=center-.75;
      stud(z,center<mid?slopes[0].under(z+1.5):slopes[1].under(z));
    }
  }
}
function shedLeanRoof(P,plan){
  const{W,D,tan,seat}=plan,wallTop=plan.F+plan.Hb,over=SHED.OVERHANG,rafter=plan.rafter;
  const under=z=>wallTop+(z-seat)*tan,surface=z=>under(z)+rafter.plumb;
  // the sloped plate on top of each side wall; the end rafters lie on these
  for(const x0 of[0,W-SHED.WALL])P.push(shedSlopePiece(plan,'Rake plate','2x4',x0,3.5,1.5,SHED.WALL,D-SHED.WALL,under,1,false));
  for(const x of plan.rafterEdges)P.push(shedSlopePiece(plan,'Rafter',rafter.mat,x,1.5,rafter.depth,-over,D+over,surface,1,false));
  shedRoofDeck(P,plan,-over,D+over,surface,1);
}
function buildShed(p){
  const plan=shedPlan(p),P=[];
  shedFloor(P,plan);
  for(const wall of Object.values(plan.walls)){
    shedWall(P,plan,wall);
    shedSheathing(P,plan,wall);
  }
  if(plan.lean)shedLeanRoof(P,plan);
  else shedGableRoof(P,plan);
  return P;
}

/* ---------- words: notes, hardware, steps ---------- */
/* "a doubled 2x6", or "a doubled 2x6 or 2x8" when the openings need different sizes */
function shedHeaderWords(plan){
  const mats=[...new Set(Object.values(plan.walls).flatMap(wall=>wall.ops.map(o=>o.header)))];
  mats.sort((a,b)=>M[a].w-M[b].w);
  return'a doubled '+mats.join(' or ');
}
/* where the rafter ties go: "at least every 4 ft", or "beside every pair of rafters" when the roof pushes hard */
function shedTieWords(plan){
  return plan.tie.every>SHED.RAFTER_EVERY?`at least every ${plan.tie.every/12} ft`:'beside every pair of rafters between the two end walls';
}
/* the end of the "Not in the cut list" note: the door and the windows, when their openings are left open */
function shedNotIncluded(plan){
  const several=plan.windowCount>1,windows=several?'windows':'a window';
  const missing=[plan.plywoodDoor?'':'a door',plan.windowCount&&!plan.showWindows?windows:''].filter(Boolean);
  let words='';
  if(missing.length){
    const openings=missing.length>1||several?'The openings are framed and left open, ready for the ones you choose':'The opening is framed and left open, ready for the one you choose';
    words+=`. Also not included: ${missing.join(' and ')}. ${openings}`+
      (plan.plywoodDoor?'':' (the Shed preset can add a plain plywood door: tick "Add a plywood door" in More options)');
  }
  // a window that is drawn is still a bought one: it is in no list, so say what size to buy
  if(plan.windowCount&&plan.showWindows){
    words+=`. The ${several?plan.windowCount+' windows drawn are bought ones and are':'window drawn is a bought one and is'} not in the shopping list: buy ${several?'windows':'one'} made for an opening ${fmt(plan.windowSize[0])} wide and ${fmt(plan.windowSize[1])} tall`;
  }
  return words;
}
function shedNotes(p){
  const s=shedPlan(p),roofArea=Math.ceil(s.W*(s.D+2*SHED.OVERHANG)/s.cos/144*1.1);
  const roofing=s.pitch<2?'At this slope use roll roofing or a rubber membrane: shingles leak on a roof flatter than 2 in 12.'
    :s.pitch<4?'At this slope metal panels work best: shingles need a double layer of underlayment below 4 in 12.'
    :'Shingles or metal panels both suit this slope.';
  // The first two notes are also the remark under the presets form, where they repeat the sizes typed in its
  // boxes the way the boxes show them (typedLen, js/core.js); the heights worked out beside them in the same
  // sentence read the same way there, so one sentence never mixes 7'-0" and 9' 4". In the notes: fmtFt.
  const shape=s.lean
    ?`It has a lean-to roof at ${s.pitch} in 12 (${Math.round(s.deg)} degrees): the back wall is ${typedLen(s.Hb,fmtFt)} tall and the front wall ${typedLen(s.Hf,fmtFt)}, so the roof drains to the back.`
    :`It has a gable roof at ${s.pitch} in 12 (${Math.round(s.deg)} degrees): the walls are ${typedLen(s.Hb,fmtFt)} tall and the ridge is ${typedLen(r16(s.peak),fmtFt)} above the ground.`;
  // The sizing, one short sentence at a time. "Reaches ... with nothing under it" is what builders call the span.
  const rafterReach=`Each ${s.rafter.mat} rafter, one every ${SHED.RAFTER_EVERY}", reaches ${fmtFt(r16(s.rafter.span))} ${s.lean?'from wall to wall':`from the wall to the ${s.ridge.mat} ridge board`} with nothing under it (its span). A ${s.rafter.mat} is good for about ${fmtFt(Math.floor(s.rafter.good))} there.`;
  const ties=s.lean?'':` A 2x4 rafter tie crosses the shed ${shedTieWords(s)}, so the roof cannot push the walls apart. Each tie holds back about ${Math.round(s.tie.push/10)*10} lb.`;
  const gable=shedGableSheets(s),above=s.lean?'the sloped strip of sheathing above each side wall':'the triangle of sheathing above each end wall';
  return['BUILD AT YOUR OWN RISK. This is a simplified framing layout to help you plan and price a shed. It is not an engineered plan. Sheds usually need a permit and must meet local rules for wind, snow, anchoring, size and distance from property lines, so check with your city or county building department before you buy lumber.',
   `The shed is ${typedLen(s.W,fmtFt)} wide × ${typedLen(s.D,fmtFt)} deep (${Math.round(s.W*s.D/144)} sq ft of floor). ${shape}`,
   `The roof is sized by rule of thumb for light snow: ${USES.roof.psf} lb on every square foot. ${rafterReach}${ties} Heavy snow country needs bigger rafters than this: ask your building department.`,
   `The floor is sized by rule of thumb for ${USES.floor.psf} lb on every square foot. Each ${s.joist.mat} floor joist, one every ${SHED.JOIST_EVERY}", reaches ${fmtFt(r16(s.joist.span))} from one skid to the next. A ${s.joist.mat} is good for about ${fmtFt(Math.floor(s.joist.good))} there. Over each opening in a wall there is ${shedHeaderWords(s)} header.`,
   ...(shedFloorGiveWords(s)?[shedFloorGiveWords(s)]:[]),
   'The 1/2" plywood wall sheathing is what stops the shed from leaning over, so do not leave it off. Grooved plywood siding (T1-11) nailed straight to the studs does the same job in its place. To see the framing behind the sheathing, turn on the see-through view (Alt+Z) or hide those pieces.',
   `Not drawn and not in the cut list: ${above}, because you cut it on site to follow the roof. The plywood for it is on the shopping list with the lumber (${gable} more sheet${gable>1?'s':''} of 1/2" plywood).`,
   `Not in any list: roofing for about ${roofArea} sq ft (drip edge, underlayment, and the roofing itself), siding or paint, and trim${shedNotIncluded(s)}. ${roofing}`,
   'The nail and screw counts on the shopping list are close estimates. Nails are sold by the box, so there will be some left over.',
   'Set the skids on solid concrete blocks or a compacted gravel pad, level in both directions, and anchor the shed to the ground. The skids and the floor frame are pressure-treated lumber in the cut list and the shopping list, because ordinary wood rots that close to the ground. Buy the framing nails hot-dip galvanized: plain steel nails rust away in treated lumber.'];
}
/* Sheets of 1/2" plywood for the wall above the drawn sheathing: the two triangles of a gable, or the sloped
   strips above the side walls of a lean-to. They are cut on site to follow the roof, so they are not pieces of
   the design; the two of them together are as big as one rectangle as long as the shed is deep and as tall as
   the roof rises, and a sheet is 48" by 96". At least one sheet. */
function shedGableSheets(plan){
  const rise=plan.lean?plan.Hf-plan.Hb:plan.ridge.top;
  return Math.max(1,Math.ceil(plan.D*rise/(48*96)-.02));
}
function shedHardware(p){
  const s=shedPlan(p),leaves=s.doorLeaves;
  // Hinges and a latch only when the plywood door is asked for: an opening needs neither. Of a pair of doors
  // one is bolted shut at the top and the bottom, and the latch holds the other one to it.
  // The screws that come with T-hinges are too short to reach a stud through the sheathing, and often too long
  // for a 3/4" door, so the two kinds the door step asks for are listed.
  const doorHardware=!leaves?[]:[['Heavy T-hinges, 8"',3*leaves],['Gate latch or hasp',1]]
    .concat(leaves>1?[['Barrel bolts, for the door of the pair that stays shut',2]]:[])
    .concat([[`Exterior screws, 2 1/2", for the hinge leaves on the wall`,3*SHED_HINGE.wallScrews*leaves],
      [`Exterior screws, 3/4", for the hinge straps on the door`,3*SHED_HINGE.doorScrews*leaves]]);
  const ties=2*s.rafterEdges.length,roof=shedRoofFasteners(p,s),sheets=shedGableSheets(s);
  return doorHardware.concat([
    // nails for the roof: the program finds no joints on rotated pieces, so the shed counts these itself
    // (the nails of the floor and the walls are counted from their joints, under the same two names)
    [FRAMING.NAIL,roof.framing],
    [FRAMING.SHEET_NAIL,roof.plywood],
    [SHED_TIE_LABEL,ties],
    [SHED_TIE_NAIL_LABEL,ties*SHED_HINGE.tieNails],
    // (now a lumber row of the shopping list beside "3/4" plywood, 4 ft × 8 ft sheet": one sheet is "sheet")
    [`1/2" plywood, 4 ft × 8 ft sheet${sheets===1?'':'s'}, for ${s.lean?'the sloped tops of the side walls':'the gable ends'} (cut to the roof)`,sheets],
    ['Solid concrete blocks for under the skids',s.skids.length*(Math.ceil(s.W/48)+1)],
    ['Ground anchors with cable or strap',4]]);
}
/* small counts for the hardware list: screws for each leaf of a T-hinge, nails for each metal hurricane tie */
const SHED_HINGE={wallScrews:3,doorScrews:4,tieNails:10};
/* The roof's own nails, counted from the plan and the pieces: {framing, plywood, lines}. lines are the
   "Fasten with" lines the roof steps show, since no joint is found for a rotated piece.
     gable    3 nails where each rafter meets the ridge board, 2 driven at an angle where it sits on the wall,
              plan.tie.nails at each end of every rafter tie, 2 for each gable stud into the rafter above it
     lean-to  2 nails at an angle at each wall, the end rafters nailed down to the rake plates every 12", and
              2 nails through each rake plate into every stud under it
     both     the roof deck: one 2 1/2" nail for every 8" of rafter under a sheet, which is what a nail every 6"
              at the sheet edges and every 12" elsewhere comes to */
function shedRoofFasteners(p,plan){
  const parts=buildShed(p),named=name=>parts.filter(piece=>piece.name===name);
  const rafters=named('Rafter').length;
  let plywood=0;
  for(const sheet of named('Roof deck')){
    // across the rafters (left to right) and up the slope; whichever is longer is the sheet's "length"
    const across=sheet.ax[0]===0?sheet.l:sheet.w,upSlope=sheet.ax[0]===0?sheet.w:sheet.l;
    const raftersUnder=Math.round(across/SHED.RAFTER_EVERY)+1;         // a sheet's ends land on rafters
    plywood+=raftersUnder*Math.ceil(upSlope/FRAMING.SHEET_COUNT_EVERY);
  }
  /* A line of a roof step, written like the lines the program writes for joints it can see: how many, what
     size, through which piece into which, and where. uses: what the line takes from the hardware list, so the
     "You need" row of the step can count it (js/buildsteps.js). */
  const nailLine=(count,words)=>({line:`${fastenerPhrase(count,FRAMING.NAIL)}: ${words}`,uses:[[FRAMING.NAIL,count]]});
  const ties=2*plan.rafterEdges.length,tieNails=ties*SHED_HINGE.tieNails;
  const tieLine={line:`${ties} metal hurricane ties, one where each rafter crosses a wall: hold the tie in the corner between the Rafter and the Cap plate and drive a joist hanger nail, 1-1/2", through every hole of the tie (${SHED_HINGE.tieNails} in each tie, ${tieNails} in all), half of them into the Rafter and half into the Cap plate.`,
    uses:[[SHED_TIE_LABEL,ties],[SHED_TIE_NAIL_LABEL,tieNails]]};
  const deck={line:`About ${fastenerPhrase(plywood,FRAMING.SHEET_NAIL)}, through the Roof deck into the Rafters under it: one every ${FRAMING.SHEET_EDGE}" along the edges of each sheet and every ${FRAMING.SHEET_FIELD}" in between.`,uses:[[FRAMING.SHEET_NAIL,plywood]]};
  if(plan.lean){
    const sideStuds=parts.filter(piece=>/^(Stud|Trimmer stud|Cripple)$/.test(piece.name)&&(piece.pos[0]<1||piece.pos[0]>plan.W-SHED.WALL-1)).length;
    const alongRake=2*Math.ceil(plan.D/plan.cos/12);
    return{plywood,framing:rafters*4+alongRake+2*sideStuds,
      lines:{rake:[nailLine(2*sideStuds,'2 down through the Rake plate into the top end of every Stud under it.')],
        rafter:[nailLine(rafters*4,`2 where each of the ${rafters} rafters sits on each of the two walls, driven at an angle through the side of the Rafter into the Cap plate, one from each side of the rafter.`),
          nailLine(alongRake,'down through each of the two end Rafters into the Rake plate under it, one every 12" along its length.'),tieLine],
        deck:[deck]}};
  }
  const tiesAcross=named('Rafter tie').length,gableStuds=named('Gable stud').length;
  return{plywood,framing:rafters*5+tiesAcross*2*plan.tie.nails+gableStuds*2,
    lines:{rafter:[nailLine(rafters*3,`3 at the top of each of the ${rafters} rafters. For the first rafter of a pair, drive them through the Ridge board into the end of the Rafter. Its partner cannot be reached that way, so drive its 3 at an angle through the side of the Rafter into the Ridge board.`),
        nailLine(rafters*2,`2 where each rafter sits on a wall, driven at an angle through the side of the Rafter into the Cap plate, one from each side of the rafter.`),tieLine],
      tie:[nailLine(tiesAcross*2*plan.tie.nails,`${plan.tie.nails} at each end of ${tiesAcross>1?`each of the ${tiesAcross} rafter ties`:'the rafter tie'}, through the Rafter tie into the side of the Rafter it lies against, in two rows spread over the whole overlap.`)],
      gable:[nailLine(gableStuds*2,`2 at the top of each of the ${gableStuds} gable studs, driven at an angle up through the Gable stud into the Rafter above it (the middle stud of each end: into the Ridge board).`)],
      deck:[deck]}};
}
/* names on the hardware list that the roof lines count from */
const SHED_TIE_LABEL='Metal hurricane ties, one where each rafter crosses a wall';
const SHED_TIE_NAIL_LABEL='Joist hanger nails, 1-1/2", for the metal hurricane ties';
/* One wall in words, for its own step: how long it is, what its plates and studs measure, and where each
   opening starts. Distances are given the way a person standing outside and facing the wall measures them:
   from the outside corner of the shed on their left. On the back wall and the right wall that corner is at the
   far end of the wall as the plan counts along it, so the distance is turned round there (as for p.doff). */
function shedWallWords(plan,wall,counts){
  // counts: how many studs and cripples this wall has (shedWallCounts), so that the step of each wall says what
  // to take from the pile; without it the words give the sizes only
  const studs=counts&&counts.Stud?counts.Stud+' studs':'studs',cripples=counts&&counts.Cripple?counts.Cripple:0;
  const turned=wall.key==='back'||wall.key==='right';
  const fromLeft=o=>r16(turned?wall.outside-(wall.offset+o.u1):wall.offset+o.u0);
  const name=wall.label[0].toUpperCase()+wall.label.slice(1);
  const between=wall.alongX?'':', because this wall fits between the front and back walls';
  let text=`${name}: ${fmtFt(wall.outside)} long on the outside of the shed. `;
  if(wall.raked){
    const longPoint=u=>Math.max(wall.studTop(u),wall.studTop(u+1.5))-1.5;
    text+=`Its bottom plate is ${fmt(wall.len)} long${between}. It gets no top plate yet: the sloped rake plate goes on when the walls are up. Its ${studs} get longer toward the front, from ${fmt(r16(longPoint(0)))} at the back to ${fmt(r16(longPoint(wall.len-1.5)))} at the front.`;
  }else{
    text+=`Its bottom plate and top plate are ${fmt(wall.len)} long${between}. Its ${studs} are ${fmt(r16(wall.height-4.5))} long.`;
  }
  if(!wall.ops.length)return text+' It has no opening: a stud at each end and one on every mark between.';
  const ops=wall.ops.slice().sort((a,b)=>fromLeft(a)-fromLeft(b));
  for(const o of ops){
    const wide=fmt(o.u1-o.u0),start=fromLeft(o);
    const onPlate=wall.offset?` (${fmt(r16(start-wall.offset))} from that end of the plates)`:'';
    const framing=`Each side of it gets a full stud, then a trimmer stud ${fmt(r16(o.hy-1.5))} long on the side of the opening. The header, two ${o.header} boards ${fmt(o.u1-o.u0+3)} long, sits on the two trimmer studs.`;
    if(o.kind==='door'){
      text+=` The door opening is ${wide} wide and ${fmt(o.top)} tall. Seen from outside, it starts ${fmt(start)} from the left corner of the shed${onPlate}. The bottom plate stops at the opening, so it is in two pieces: ${fmt(turned?wall.len-o.u1:o.u0)} on the left and ${fmt(turned?o.u0:wall.len-o.u1)} on the right. ${framing}`;
    }else{
      text+=` A window opening ${wide} wide and ${fmt(o.top-o.bot)} tall starts ${fmt(start)} from the left corner of the shed, seen from outside${onPlate}. Its bottom is ${fmt(o.bot)} above the floor deck. ${framing} The sill, a flat 2x4 ${wide} long, goes between the trimmer studs under the opening.`;
    }
  }
  // where the short studs go: above a header that leaves room under the plate, and under a window sill
  const above=ops.some(o=>wall.studTop(o.u0)-(o.hy+M[o.header].w)>=1.5-1e-6),below=ops.some(o=>o.kind==='window');
  const where=[above?`above ${ops.length>1?'each header':'the header'}`:'',below?'under the window sill':''].filter(Boolean).join(' and ');
  const short=cripples===1?'One short cripple stud fills in':`${cripples?cripples+' short':'Short'} cripple studs fill in`;
  return text+(where?` ${short} ${where}, on the stud marks.`:'');
}
/* How many uprights of each kind stand in one wall, counted on the pieces themselves: {Stud, 'Trimmer stud',
   Cripple}. A piece belongs to the wall whose strip of floor it stands inside. */
function shedWallCounts(wall,parts){
  const along=wall.alongX?0:2,through=wall.alongX?2:0,start=wall.alongX?wall.ox:wall.oz,inner=wall.alongX?wall.oz:wall.ox;
  const counts={};
  for(const piece of parts){
    if(!/^(Stud|Trimmer stud|Cripple)$/.test(piece.name))continue;
    const b=box(piece);
    const inside=b.lo[through]>=inner-.01&&b.hi[through]<=inner+SHED.WALL+.01&&b.lo[along]>=start-.01&&b.hi[along]<=start+wall.len+.01;
    if(inside)counts[piece.name]=(counts[piece.name]||0)+1;
  }
  return counts;
}
function shedSteps(p){
  const s=shedPlan(p),parts=buildShed(p),built=new Set(parts.map(piece=>piece.name));
  const roofLines=shedRoofFasteners(p,s).lines;
  // a step lists only the pieces this shed really has; fasten = lines for joints the program cannot see
  // more: other fields of the step (info:true for a step that only explains how, and uses nothing itself)
  const step=(t,names,fasten,more)=>{
    const made={t,add:(names||[]).filter(name=>built.has(name)),...(more||{})};
    if(fasten&&fasten.length)made.fasten=fasten;
    return made;
  };
  const degrees=Math.round(s.deg*10)/10;
  const brace='hold it upright with a brace (a spare board nailed at a slant from the wall down to the floor frame)';
  const plumb='plumb (straight up and down: check with a level)';
  const longScrews='drive the long screws down through the bottom plates and the floor deck into the floor frame, into a joist wherever one passes under the plate';
  const steps=[
    step('Read the notes at the top first: check permit rules, and build at your own risk. A shed is a big project: if you have never framed a wall, build it with somebody who has. Then cut every piece on the cut list and pencil its letter on it.'),
    step(`Set the ${s.skids.length} skids (the pressure-treated 4x4s) on solid blocks or a gravel pad, ${fmtFt(r16(s.joist.span))} apart, measured from the middle of one to the middle of the next, with the outer two flush with the front and back of the floor, and level them both ways. Build the floor frame on top: a rim joist along the front and back skids with the ${s.joist.mat} floor joists between them, one every ${SHED.JOIST_EVERY}" measured from the middle of one joist to the middle of the next (builders call that "on center"). Nail through each rim joist into the end of every joist. Measure corner to corner until the two diagonals match, then nail the frame down to the skids with nails driven at an angle.`,['Skid','Rim joist','Floor joist']),
    // (the grain across the joists, also on a piece deeper than it is wide: shedFloorPiece)
    step('Nail the 3/4" plywood floor deck to the joists and the rim joists. Lay each piece with the grain of its face running across the joists (on a full sheet that is its long side), so that the ends of the pieces land on the middle of a joist.'+
      shedFloorGrainWords(parts)+(shedFloorGiveWords(s)?' '+shedFloorGiveWords(s):''),['Floor deck']),
    step(`Frame the four walls flat on the floor deck, one at a time. This step says how; each of the next four steps builds one wall, with its sizes, its pieces and its nails. Lay the top plate and the bottom plate side by side and mark the stud positions on both at once: every ${s.sp}" from the middle of one stud to the middle of the next, measured from the outside corner of the shed, so that the joints in the sheathing land on studs. Nail through the plates into the ends of the studs. At the door and each window put a full stud on each side, then a shorter trimmer stud nailed to it on the side of the opening, for the header to sit on. The header is two boards on edge (${shedHeaderWords(s).replace('a doubled ','')}, see the cut list) with scraps of 1/2" plywood between them so that it is as thick as the wall. A flat 2x4 sill goes under each window, with short cripple studs above the header and below the sill. Leave each finished wall lying flat, out of the way, until all four are framed.`,[],null,{info:true}),
    // one step for each wall: it takes the pieces that stand in that wall (the last wall takes what is left)
    ...SHED_WALL_ORDER.map((key,index)=>({...step(shedWallWords(s,s.walls[key],shedWallCounts(s.walls[key],parts)),SHED_WALL_PIECES),
      ...(index<SHED_WALL_ORDER.length-1?{pick:piece=>shedInWall(s.walls[key],piece)}:{})})),
    s.lean
      ?step(`Stand the back wall first and ${brace}. Then stand the two side walls and the tall front wall. Check that each one is ${plumb}, nail the corner studs together, and ${longScrews}. The two side walls follow the roof: the top of each of their studs is cut at ${degrees} degrees, and the lengths in the cut list are measured to the longer side of that cut. Nail the sloped rake plate across the tops of those studs, from the back wall to the front wall, and nail a cap plate on top of the front and back walls. Get a helper for this step: walls are heavy and awkward.`,['Rake plate','Cap plate'],roofLines.rake)
      :step(`Stand the back wall first and ${brace}. Then stand the two end walls and the front wall. Check that each one is ${plumb}, nail the corner studs together, and ${longScrews}. Then nail the cap plates on top. The cap plates of the end walls run over the ends of the front and back walls: that overlap ties the four walls together. Get a helper for this step: walls are heavy and awkward.`,['Cap plate']),
    step('Check once more that every wall is plumb and the corners are square. '+
      (built.has('Blocking')?`Nail the short 2x4 blocks on edge between the studs, flush with the outside of the wall, ${s.lean&&s.walls.front.sheathJoint!==null?'behind the level joint between the lower and upper sheets of the tall front wall and ':''}along the top edge of the sheets on the two side walls, so that every edge of every sheet has wood behind it. `:'')+
      'Then nail the 1/2" plywood sheathing to the studs and plates, with each upright joint on the middle of a stud. This is what keeps the shed from leaning, so sheathe the walls before you frame the roof.',
      ['Blocking','Wall sheathing'])];
  // The notch (birdsmouth) of a gable rafter, as marks on the board. Along the bottom edge, from the short point of
  // the slanted top cut down to the inside corner of the notch, it is the level run from the ridge board to the
  // inside of the seat, taken up the slope. The seat is cut level (square to the top cut), the heel plumb
  // (parallel to the top cut), and the notch is seat x sin deep at its deepest, measured square to the edge.
  // the four walls are framed lying down, each in its own step, and stood up in this one (bring: js/buildsteps.js)
  const standUp=steps.find(made=>/^Stand the back wall first/.test(made.t));
  standUp.bring=SHED_WALL_ORDER.map(key=>piece=>SHED_WALL_PIECES.includes(piece.name)&&shedWallOf(s,piece)===key);
  const notchFromTop=r16((s.D/2-.75-s.seat)/s.cos),notchDeep=r16(s.seat*s.sin);
  const notch=s.lean
    ?`Where a rafter sits on a wall, cut a notch (a birdsmouth) with a level seat ${fmt(s.seat)} long, so the rafter sits flat on the plate; never notch deeper than a third of the board. Mark the notches from the building itself: with a helper, hold the first rafter against the sides of both walls where it will sit, pencil along the top and the outside face of each wall plate, and cut along those lines. Try it on the walls, then use it as the pattern for the others`
    :`Where a rafter sits on a wall, cut a notch (a birdsmouth), so the rafter sits flat on the plate. Mark it like this: measure ${fmt(notchFromTop)} along the bottom edge of the rafter from the short point of the slanted top cut, and make a mark. That is the inside corner of the notch. From that mark draw a line square to the top cut (it will be level once the rafter is up), ${fmt(s.seat)} long, toward the lower end: that is the seat. From the end of the seat line draw a line parallel to the top cut out to the bottom edge: that is the heel, which stands against the outside of the wall. The notch is ${fmt(notchDeep)} deep at its deepest, measured square to the edge: never deeper than a third of the board. Cut one rafter, try it on the wall, then use it as the pattern for the others`;
  const ladder='Work from a ladder that stands on the floor inside the shed, never from the top of a wall';
  if(s.lean){
    steps.push(step(`Set a ${s.rafter.mat} rafter every ${SHED.RAFTER_EVERY}", measured from the middle of one to the middle of the next, running from the back wall up to the front wall with about ${fmt(SHED.OVERHANG)} hanging over at each end. They sit at ${degrees} degrees. ${notch}. The two end rafters lie on the rake plates: nail them down along their whole length. Fasten every rafter to both walls with a metal hurricane tie. ${ladder}.`,['Rafter'],roofLines.rafter));
  }else{
    steps.push(
      step(`Cut the ${s.rafter.mat} rafters. The top end of each is cut at a slant, ${degrees} degrees off a square cut, so that it stands upright against the ridge board once the rafter is in place. The length in the cut list is measured to the longer side of that cut. The bottom end stays square. ${notch}. Start at one end of the shed: with a helper, set a pair of rafters with their feet on the wall plates and their top ends against the two faces of the ${s.ridge.mat} ridge board, at its end, and nail them. Do the same at the other end, so that the ridge board is held level. Then add a pair every ${SHED.RAFTER_EVERY}", measured from the middle of one rafter to the middle of the next, each rafter opposite its partner. Fasten every rafter to the wall with a metal hurricane tie. ${ladder}.`,['Ridge board','Rafter'],roofLines.rafter),
      step(`Rafter ties stop the roof from pushing the walls apart, so never leave them out. Lay a 2x4 on edge across the shed from the front wall to the back wall, resting on the cap plates against the side of a pair of rafters: one ${shedTieWords(s)}. Nail it to the side of both rafters with ${s.tie.nails} nails at each end, spread over the whole overlap in two rows so the wood does not split, and trim its top corners to the roof slope. These nails are what hold the roof together (each tie holds back about ${Math.round(s.tie.push/10)*10} lb on this shed), so do not use fewer. The end walls do this job for the two end pairs.`,['Rafter tie'],roofLines.tie),
      step(`Fill in under the two end pairs of rafters with gable studs. They stand on the cap plate in line with the studs of the wall below, with their tops cut at ${degrees} degrees to fit under the rafter (their lengths are measured to the longer side of that cut). The middle one holds up the end of the ridge board.`,['Gable stud'],roofLines.gable));
  }
  const gableSheets=shedGableSheets(s);
  steps.push(
    step('Nail the 1/2" plywood roof deck to the rafters. Lay each sheet with its long side across the rafters, with the ends of the sheets on the middle of a rafter, starting at the lower edge of the roof. Work from a ladder, or from the roof deck once the first row is nailed down.',['Roof deck'],roofLines.deck),
    step(`Cut sheathing to fit ${s.lean?'the sloped strip above each side wall':'the triangle above each end wall'} from the extra ${gableSheets>1?gableSheets+' sheets':'sheet'} of 1/2" plywood on the shopping list, and nail it on like the rest of the sheathing. Then add the siding or paint, the drip edge, the underlayment and the roofing.`));
  // The door and the windows. Each opening is framed and left open unless its option is on, so the plywood
  // door is only built, and a window only fitted, when the person asked for it.
  const windowCount=s.windowCount;
  if(s.plywoodDoor)steps.push(step(shedDoorWords(s),['Shed door']));
  if(s.showWindows&&windowCount)steps.push(step(`Fit ${windowCount>1?'the windows in their openings':'the window in its opening'} and seal around ${windowCount>1?'them':'it'} with exterior caulk.`,['Window']));
  steps.push(step(shedOpenWords(s,windowCount)+'Anchor the shed to the ground.'));
  return steps;
}
/* the order the walls are framed and stood up in: each gets a step of its own (shedWallWords) */
const SHED_WALL_ORDER=['back','left','right','front'];
/* the pieces a wall is framed from, lying flat, before it is stood up */
const SHED_WALL_PIECES=['Bottom plate','Top plate','Stud','Trimmer stud','Header','Sill','Cripple'];
/* does this piece stand inside the strip of floor of this wall? (the same test shedWallCounts counts studs with) */
function shedInWall(wall,piece){
  const along=wall.alongX?0:2,through=wall.alongX?2:0,start=wall.alongX?wall.ox:wall.oz,inner=wall.alongX?wall.oz:wall.ox;
  const b=box(piece);
  return b.lo[through]>=inner-.01&&b.hi[through]<=inner+SHED.WALL+.01&&b.lo[along]>=start-.01&&b.hi[along]<=start+wall.len+.01;
}
/* the wall a piece belongs to: 'back', 'left', 'right' or 'front' (the front wall takes what stands in none of the others) */
function shedWallOf(plan,piece){
  return SHED_WALL_ORDER.slice(0,-1).find(key=>shedInWall(plan.walls[key],piece))||SHED_WALL_ORDER[SHED_WALL_ORDER.length-1];
}
/* The step that hangs the plywood door (only there with "Add a plywood door"). It names nothing that is not in
   the cut list or the hardware list: the plywood, three T-hinges a door, the latch, and for a pair the two bolts. */
function shedDoorWords(plan){
  const pair=plan.doorLeaves>1,gap=fmt(SHED.DOOR_GAP);
  const hang=`Stand ${pair?'each door':'it'} in the opening on ${gap} spacers, with its face flush with the outside of the wall sheathing, and hang it on three T-hinges${pair?' along its outer edge':''}: `+
    'screw the short leaf of each hinge through the sheathing into the studs beside the opening, and the long strap across the face of the door. '+
    'Do not use the screws packed with the hinges. For the leaf on the wall use the 2 1/2" exterior screws on the shopping list, so that they reach the studs; for the strap on the door use the 3/4" ones, which do not come out through the back of the plywood.';
  const shut=pair?' Fit a barrel bolt at the top and one at the bottom of one door, on the inside, so that it can be bolted shut into the header and the floor, and fit the latch between the two doors.'
    :' Fit the latch on the edge away from the hinges.';
  return`Cut the ${pair?'two doors (a pair, because a sheet of plywood is only 4 ft wide)':'door'} from 3/4" plywood. The cut list size leaves a gap of ${gap} all round${pair?' and between the two':''}, so ${pair?'they swing':'it swings'} freely. `+
    hang+shut+' Prime and paint the plywood on both faces and every edge before the first rain, or it soaks up water and comes apart (primer and paint are not on the shopping list: see the notes).';
}
/* What the last step says about the openings that are left open: nothing when the door and the windows are
   both asked for, otherwise one sentence naming what is open and what can go there. */
function shedOpenWords(plan,windowCount){
  const doorOpen=!plan.plywoodDoor,windowsOpen=windowCount>0&&!plan.showWindows;
  if(!doorOpen&&!windowsOpen)return'';
  const windows=windowCount>1?'window openings':'window opening';
  if(doorOpen&&windowsOpen)return`The door opening and the ${windows} are framed and left open: hang a door and fit ${windowCount>1?'windows':'a window'} of your choice later, and seal around them with exterior caulk. `;
  if(doorOpen)return'The door opening is framed and left open: hang a door of your choice there later. ';
  return`The ${windows} ${windowCount>1?'are':'is'} framed and left open: fit ${windowCount>1?'windows':'a window'} of your choice there later, and seal around ${windowCount>1?'them':'it'} with exterior caulk. `;
}

/* ---------- a check on the builder itself ---------- */
/* The structural check (js/verify.js) works from which pieces touch and are fastened, so a rafter whose notch
   was a little too deep, or a stud a hair short of its plate, could still pass it. This looks at the pieces
   themselves and lists every place where wood does not sit on wood:
     - every rafter crosses a wall, has a cap plate under it there, bears on at least 1 1/2" of it, and its notch
       is no deeper than a third of the board; on a gable its top corner meets the ridge board at the top edge
     - the ridge board sits on a gable stud at both ends
     - every stud, trimmer stud, cripple and gable stud stands on a plate, header or sill and has a plate, a
       header, a sill, the ridge or the underside of a sloped piece on top of it
     - every header board sits on two trimmer studs, and every rafter tie on both walls beside a pair of rafters
   Returns plain sentences; an empty list means all is well. selfTest runs it for sheds of both roof styles
   (selfTestShed in js/selftest.js). `parts` is only given by that test, to prove a fault is noticed. */
function shedBearingProblems(p,parts){
  const plan=shedPlan(p),found=[],T=SHED.WALL,close=.07;
  parts=parts||buildShed(p);
  const named=(...names)=>parts.filter(piece=>names.includes(piece.name));
  const where=piece=>`the ${piece.name} at ${box(piece).lo.map(v=>fmt(r16(v))).join(', ')}`;
  const overlap=(a,b,k)=>Math.min(a.hi[k],b.hi[k])-Math.max(a.lo[k],b.lo[k]);
  // A piece lying on the slope is turned about the left-to-right axis. under(z) is the height of its underside,
  // which runs from `from` to `to`; its top edge is `shift` further along and `rise` higher.
  const sloped=piece=>{
    const s=size(piece),turn=piece.rot.deg*Math.PI/180,cos=Math.cos(turn),sin=Math.sin(turn);
    const y0=piece.pos[1]+s[1]/2-s[1]/2*cos,z0=piece.pos[2]+s[2]/2-s[1]/2*sin,half=s[2]/2*cos;
    return{under:z=>y0-sin/cos*(z-z0),from:z0-half,to:z0+half,shift:s[1]*sin,rise:s[1]*cos,cos,backSlope:turn<0};
  };
  const rafters=named('Rafter'),caps=named('Cap plate').map(box);

  // rafters on the walls
  const strips=[{label:'back wall',from:0,to:T,top:plan.F+plan.Hb},{label:'front wall',from:plan.D-T,to:plan.D,top:plan.F+plan.Hf}];
  for(const rafter of rafters){
    const line=sloped(rafter),bounds=box(rafter),depth=M[rafter.mat].w;
    const crossed=strips.filter(strip=>line.from<strip.to&&line.to>strip.from);
    if(!crossed.length)found.push(`${where(rafter)} crosses no wall`);
    for(const strip of crossed){
      let seat=0,deepest=0;
      for(let z=strip.from;z<=strip.to+1e-9;z+=1/16){
        const gap=line.under(z)-strip.top;
        if(gap<=close)seat+=1/16;
        deepest=Math.max(deepest,-gap);
      }
      // how much of the rafter's thickness has a cap plate under it (it may straddle the joint between two plates)
      const under=caps.filter(cap=>Math.abs(cap.hi[1]-strip.top)<close&&cap.lo[2]<strip.to&&cap.hi[2]>strip.from)
        .reduce((sum,cap)=>sum+Math.max(0,overlap(cap,bounds,0)),0);
      const plate=under>1.4;
      if(!plate)found.push(`${where(rafter)} has no cap plate under it on the ${strip.label}`);
      else if(seat<1.5)found.push(`${where(rafter)} bears on only ${fmt(seat)} of the ${strip.label}`);
      if(deepest*line.cos>depth/3+close)found.push(`${where(rafter)} is notched deeper than a third of the board over the ${strip.label}`);
    }
  }

  // gable: rafters meet the ridge board, and the ridge board sits on the two end walls
  const ridgeBoard=named('Ridge board')[0];
  if(!plan.lean&&!ridgeBoard)found.push('there is no ridge board');
  if(ridgeBoard){
    const ridge=box(ridgeBoard);
    for(const rafter of rafters){
      const line=sloped(rafter),end=line.backSlope?line.to:line.from,face=line.backSlope?ridge.lo[2]:ridge.hi[2];
      if(Math.abs(end+line.shift-face)>close||Math.abs(line.under(end)+line.rise-ridge.hi[1])>close)found.push(`${where(rafter)} does not meet the top edge of the ridge board`);
    }
    const kings=named('Gable stud').map(box).filter(stud=>Math.abs(stud.hi[1]-ridge.lo[1])<close&&overlap(stud,ridge,2)>1.4);
    if(kings.length<2)found.push('the ridge board does not sit on a gable stud at both ends');
  }

  // uprights: wood under the foot and wood on top
  const level=named('Bottom plate','Top plate','Cap plate','Header','Sill','Ridge board').map(box);
  const onSlope=named('Rake plate','Rafter').map(piece=>({bounds:box(piece),line:sloped(piece)}));
  for(const upright of named('Stud','Trimmer stud','Cripple','Gable stud')){
    const b=box(upright),overPlan=other=>overlap(b,other,0)>.2&&overlap(b,other,2)>.2;
    const foot=level.some(other=>overPlan(other)&&Math.abs(other.hi[1]-b.lo[1])<close);
    // under a sloped piece the top of the upright is cut to the slope: its long point touches
    const head=level.some(other=>overPlan(other)&&Math.abs(other.lo[1]-b.hi[1])<close)||
      onSlope.some(({bounds,line})=>overlap(b,bounds,0)>.2&&b.hi[2]>=line.from&&b.lo[2]<=line.to&&
        Math.abs(Math.max(line.under(b.lo[2]),line.under(b.hi[2]))-b.hi[1])<close);
    if(!foot)found.push(`${where(upright)} stands on nothing`);
    if(!head)found.push(`${where(upright)} has nothing on top of it`);
  }

  // headers on trimmer studs, rafter ties on the walls
  const trimmers=named('Trimmer stud').map(box);
  for(const header of named('Header')){
    const b=box(header);
    if(trimmers.filter(stud=>Math.abs(stud.hi[1]-b.lo[1])<close&&overlap(stud,b,0)>1.4&&overlap(stud,b,2)>1.4).length!==2)found.push(`${where(header)} does not sit on two trimmer studs`);
  }
  for(const tie of named('Rafter tie')){
    const b=box(tie);
    const onWalls=caps.filter(cap=>Math.abs(cap.hi[1]-b.lo[1])<close&&overlap(cap,b,0)>1.4&&overlap(cap,b,2)>=.9).length;
    const beside=rafters.filter(rafter=>Math.abs(box(rafter).lo[0]-b.hi[0])<close).length;
    if(onWalls<2||beside<2)found.push(`${where(tie)} does not rest on both walls beside a pair of rafters`);
  }
  return[...new Set(found)];
}

/* A size field of a preset's form: key, label, default size, and (optional) the smallest and the largest size
   the form accepts, in inches. The presets dialog turns away anything outside the limits with a plain message,
   and selfTest builds the preset at both limits (see "The preset rule" in README.md). */
const num=(k,label,v,min,max)=>{
  const field={k,label,v};
  if(min!==undefined)field.min=min;
  if(max!==undefined)field.max=max;
  return field;
};

/* ---------- self-check: the openings (selfTest runs every function in SELFTESTS, see js/core.js) ---------- */
/* The door and window openings are framed and left open unless their option is on. The plywood door's pieces,
   hinges, latch and building step are there only with "Add a plywood door"; the window only with "Show the window".
   Neither option may change the framing or what check(p) says, so the bracing rule and every other check hold
   either way: that is tried on every shed of SHED_SHAPES (js/selftest.js) and on the sheds of SHED_DOOR_SHAPES,
   which put the door on each wall, make it a pair, and move the windows about. */
const SHED_DOOR_SHAPES=[{dw:72},{dw:24,dh:60},{dwall:'back',doff:30},{dwall:'left'},{dwall:'right',wwall:'left'},{wn:0},
  {wwall:'both',wn:4,ww:12},{roof:'lean',pitch:3,dwall:'left',dh:66},{roof:'lean',pitch:2,dwall:'back',wwall:'front',wn:2},{W:192,D:144,Hb:96,dw:72,dh:80,wn:8,wwall:'both'}];
SELFTESTS.push(function shedOpenings(problems){
  const shed=PRESETS.find(preset=>preset.name==='Shed');
  if(!shed)return;
  const defaults=presetDefaults(shed),close=.01;
  /* everything one shed comes to that the two options may touch */
  const look=vals=>{
    const parts=buildShed(vals),named=name=>parts.filter(piece=>piece.name===name);
    const hardware=shedHardware(vals),count=word=>hardware.filter(row=>word.test(row[0])).reduce((sum,row)=>sum+row[1],0);
    const steps=shedSteps(vals),words=steps.map(step=>step.t).join(' ');
    return{parts,doors:named('Shed door'),windows:named('Window'),framed:named('Header').length>0&&named('Trimmer stud').length>0,
      framing:JSON.stringify(parts.filter(piece=>piece.name!=='Shed door'&&piece.name!=='Window')),
      hinges:count(/T-hinges/i),hingeScrews:count(/screws.*for the hinge/i),latches:count(/latch/i),bolts:count(/barrel bolt/i),
      doorStep:steps.some(step=>step.add.includes('Shed door')),windowStep:steps.some(step=>step.add.includes('Window')),
      openWords:/left open/.test(words),notes:shedNotes(vals).join(' '),verdict:JSON.stringify(shedPlan(vals).problems)};
  };
  // the default choices: openings framed and left open, and nothing that belongs to a door
  const open=look(defaults);
  if(open.doors.length||open.windows.length)problems.push('shed: with its default choices the door and window openings must be left open');
  if(!open.framed)problems.push('shed: an opening that is left open must still be framed (trimmer studs and a header)');
  if(open.hinges||open.hingeScrews||open.latches||open.bolts||open.doorStep||open.windowStep)problems.push('shed: hinges, their screws, a latch, bolts, the door step or the window step are listed although neither is asked for');
  if(!open.openWords||!/Also not included: a door and a window/.test(open.notes))problems.push('shed: the steps and the notes must say that the door and window openings are left open');
  // each option alone
  const doorOnly=look({...defaults,door:true}),windowOnly=look({...defaults,glass:true});
  if(doorOnly.doors.length!==1||doorOnly.windows.length||!doorOnly.doorStep||doorOnly.windowStep)problems.push('shed: "Add a plywood door" alone must add the door and its step, and no window');
  if(windowOnly.windows.length!==1||windowOnly.doors.length||windowOnly.hinges||windowOnly.latches||windowOnly.doorStep||!windowOnly.windowStep)problems.push('shed: "Show the window" alone must draw the window, and add nothing that belongs to a door');
  if(!/not in the shopping list/.test(windowOnly.notes))problems.push('shed: with the window shown the notes must say that it is a bought one and what size to buy');
  const closed=look({...defaults,door:true,glass:true});
  if(closed.openWords)problems.push('shed: the steps say an opening is left open although the door and the windows are asked for');
  if(/1x4/.test(shedDoorWords(shedPlan({...defaults,door:true}))))problems.push('shed: the door step asks for 1x4 boards that are in no list');
  // the door step names the screws for both leaves of a hinge, and both kinds are on the hardware list
  if(doorOnly.hingeScrews!==3*(SHED_HINGE.wallScrews+SHED_HINGE.doorScrews)||!/2 1\/2" exterior screws/.test(shedDoorWords(shedPlan({...defaults,door:true}))))problems.push('shed: the door step must say which screws hold the hinges, and the hardware list must have them');

  // every shape, with the options off and on
  for(const shape of SHED_SHAPES.concat(SHED_DOOR_SHAPES)){
    const off={...defaults,...shape,door:false,glass:false},on={...off,door:true,glass:true},label='shed '+JSON.stringify(shape)+': ';
    let bare,full;
    try{bare=look(off);full=look(on);}
    catch(e){problems.push(label+'it threw "'+e.message+'" with the door and window options');continue;}
    if(bare.framing!==full.framing)problems.push(label+'the door or the window option changed the framing');
    if(bare.verdict!==full.verdict)problems.push(label+'the door or the window option changed what check(p) says');
    if(bare.doors.length||bare.windows.length||bare.hinges||bare.latches||bare.bolts)problems.push(label+'a door, a window or door hardware is there with both options off');
    const plan=shedPlan(on),wall=Object.values(plan.walls).find(w=>w.ops.some(o=>o.kind==='door')),opening=wall.ops.find(o=>o.kind==='door');
    const leaves=shedDoorLeaves(opening.u1-opening.u0);
    if(full.doors.length!==leaves||plan.doorLeaves!==leaves)problems.push(label+`an opening ${fmt(opening.u1-opening.u0)} wide needs ${leaves} plywood door${leaves>1?'s':''}, not ${full.doors.length}`);
    if(full.hinges!==3*leaves||full.latches!==1||full.bolts!==(leaves>1?2:0)||!full.doorStep)problems.push(label+'the door needs three hinges a door, one latch, two bolts for a pair, and its step');
    if(full.windows.length!==plan.windowCount||full.windowStep!==plan.windowCount>0)problems.push(label+'"Show the window" must draw one window in each window opening, and the step that fits them');
    // each door: cut from one sheet, inside its opening with the gap all round, its face level with the sheathing
    const along=wall.alongX?0:2,through=wall.alongX?2:0,start=wall.alongX?wall.ox:wall.oz,inner=wall.alongX?wall.oz:wall.ox;
    const face=wall.outer?inner+SHED.WALL+SHED.SHEATHING:inner-SHED.SHEATHING;
    for(const door of full.doors){
      const b=box(door);
      if(Math.min(door.l,door.w)>SHED.DOOR_SHEET+close||Math.max(door.l,door.w)>96+close)problems.push(label+'a door is bigger than a sheet of plywood');
      if(b.lo[along]<start+opening.u0+SHED.DOOR_GAP-close||b.hi[along]>start+opening.u1-SHED.DOOR_GAP+close||
        Math.abs(b.lo[1]-(plan.F+SHED.DOOR_GAP))>close||Math.abs(b.hi[1]-(plan.F+opening.top-SHED.DOOR_GAP))>close)problems.push(label+'a door does not stand in its opening with the gap all round');
      if(Math.abs((wall.outer?b.hi[through]:b.lo[through])-face)>close)problems.push(label+'the face of a door is not level with the outside of the wall sheathing, so a T-hinge cannot lie flat');
      const hit=full.parts.find(piece=>piece!==door&&!tilted(piece)&&[0,1,2].every(k=>b.lo[k]<box(piece).hi[k]-close&&box(piece).lo[k]<b.hi[k]-close));
      if(hit)problems.push(label+'a door runs into the '+hit.name);
    }
  }
  // The structural check itself is tried with both options on by selfTest().structural, at every limit of the
  // form and for both roof styles: they are `variants` of the Shed in js/presets.js, and must stay there.
  const tried=(shed.variants||[]).filter(variant=>variant.door&&variant.glass).map(variant=>variant.roof||'gable');
  if(!tried.includes('gable')||!tried.includes('lean'))problems.push('shed: its variants must try the plywood door and the windows shown on a gable and on a lean-to');
});

/* ---------- self-check: how the shed is fastened ---------- */
/* A shed is nailed. Its joints list (SHED_JOINTS) must leave no pair of pieces with pocket screws, glue, dowels,
   brads or brackets, the wall plates must be held to the floor by a fastener that reaches the floor frame (never
   a short screw that ends in the plywood, or one driven up from under the floor), every nail the steps ask for
   must be on the hardware list, and the roof steps, whose pieces are rotated and so have no joints, must carry
   their own "Fasten with" lines. Tried on a gable, a lean-to and a large shed with the door and windows. */
SELFTESTS.push(function shedFasteners(problems){
  const shed=PRESETS.find(preset=>preset.name==='Shed');
  if(!shed)return;
  if(shed.joints!==SHED_JOINTS)problems.push('shed fasteners: the Shed preset must hand SHED_JOINTS to the program as its joints');
  const named=(j,a,b)=>(j.a.name===a&&j.b.name===b)||(j.a.name===b&&j.b.name===a);
  for(const shape of[{},{roof:'lean',pitch:3},{W:192,D:144,Hb:96,dw:72,dh:80,wn:4,wwall:'both',door:true,glass:true}]){
    const vals={...presetDefaults(shed),...shape},label='shed fasteners '+JSON.stringify(shape)+': ';
    const plan=shedPlan(vals),parts=buildShed(vals);
    parts.forEach((piece,index)=>{piece.id=index+1;});
    const wrong=new Set();
    for(const j of findJoints(parts)){
      const own=SHED_JOINTS.find(([a,b])=>named(j,a,b)),type=own?own[2]:defaultType(j);
      if(type==='none')continue;
      const pair=j.a.name+' and '+j.b.name;
      if(!['frame','toenail'].includes(type))wrong.add(`${pair} would get ${JTYPES[type][0].toLowerCase()}`);
      if(named(j,'Bottom plate','Floor deck')&&jSpec(j,type).hw[0][0]!==FRAMING.LONG_SCREW)wrong.add('the bottom plates are not held to the floor with the long screws');
    }
    wrong.forEach(text=>problems.push(label+text));
    const hardware=new Map(shedHardware(vals)),roof=shedRoofFasteners(vals,plan);
    for(const item of[FRAMING.NAIL,FRAMING.SHEET_NAIL])if(!(hardware.get(item)>0))problems.push(label+'the hardware list has no '+item+' for the roof');
    if(![...hardware.keys()].some(name=>/hanger nails/.test(name)))problems.push(label+'the hardware list has no nails for the metal hurricane ties');
    if(![...hardware.keys()].some(name=>/^1\/2" plywood/.test(name)))problems.push(label+'the plywood for the wall above the drawn sheathing is not on the hardware list');
    const steps=shedSteps(vals),words=steps.map(step=>step.t).join(' ');
    for(const step of steps){
      const rotated=step.add.filter(name=>['Rafter','Roof deck','Rake plate','Rafter tie','Gable stud'].includes(name));
      if(rotated.length&&!(step.fasten||[]).length)problems.push(label+'the step that adds the '+rotated[0]+' has no "Fasten with" line of its own');
    }
    for(const wall of Object.values(plan.walls))if(!steps.some(step=>step.t.startsWith(wall.label[0].toUpperCase()+wall.label.slice(1)+':')))problems.push(label+'there is no step for the '+wall.label);
    // each wall's step says how many studs it takes, and the four counts add up to the studs of the shed
    const studsByWall=Object.values(plan.walls).map(wall=>shedWallCounts(wall,parts).Stud||0);
    if(studsByWall.reduce((sum,count)=>sum+count,0)!==parts.filter(piece=>piece.name==='Stud').length)problems.push(label+'the studs counted wall by wall do not add up to the studs of the shed');
    if(studsByWall.some(count=>!words.includes(`Its ${count} studs `)))problems.push(label+'a wall step does not say how many studs the wall takes');
    if(!/starts [\d /"']+ from the left corner/.test(words))problems.push(label+'no step says where the door opening starts');
    if(/pocket|glue/i.test(words))problems.push(label+'a step talks about pocket screws or glue');
    if(/[Ss]crew the 3\/4" plywood floor/.test(words))problems.push(label+'the floor deck step says screw, and the floor deck is nailed');
    if(!plan.lean&&!new RegExp(`with ${plan.tie.nails} nails at each end`).test(words)||(!plan.lean&&!roof.lines.tie[0].line.includes(plan.tie.nails+' at each end')))problems.push(label+'the rafter tie sentence and its "Fasten with" line do not give the same number of nails');
    if(/Sized by rule of thumb/.test(shedNotes(vals).join(' '))||shedNotes(vals).some(note=>note.split(/[.:;] /).some(sentence=>sentence.split(' ').length>45)))problems.push(label+'a note has a sentence of more than 45 words');
  }
});

/* The window at every height the form allows, an inch at a time, under both roofs and at the lowest and the highest
   wall: every piece is a real box (its three sizes run along three different directions, and are its length, width
   and thickness), and the shed is either clean or refused by its own check with a reason. A cripple over the
   header that is exactly as long as a 2x4 is thick (the top of the window 10" under the top of the wall) used to
   come out with no width or depth. */
SELFTESTS.push(function shedWindowAtEveryHeight(problems){
  const shed=PRESETS.find(preset=>preset.name==='Shed');
  if(!shed)return;
  const sill=shed.params.find(field=>field.k==='sill'),height=shed.params.find(field=>field.k==='wh');
  if(!sill||!height){problems.push('shed windows: the Shed form has no window height or sill height any more');return;}
  let reported=0;
  const say=text=>{if(reported++<4)problems.push('shed windows: '+text);};
  for(const shape of[{},{roof:'lean',pitch:3},{Hb:72},{Hb:96,wwall:'both',wn:2}]){
    for(let bottom=sill.min;bottom<=sill.max;bottom+=1){
      for(const tall of[height.min,14,24]){
        const vals={...presetDefaults(shed),...shape,sill:bottom,wh:tall},label=JSON.stringify({...shape,sill:bottom,wh:tall})+': ';
        if(shed.check(vals).some(found=>found.level==='stop'))continue;   // refused with a reason: nothing is built
        const parts=buildShed(vals);
        for(const piece of parts){
          if(isProp(piece))continue;
          const whole=[0,1,2].every(k=>piece.ax.includes(k)),extent=size(piece),material=M[piece.mat];
          if(!whole||extent.some(v=>!(v>0))||Math.abs(piece.t-material.t)>1e-6){say(label+`a ${piece.name} ${fmt(piece.l)} long is not a real box (its directions are ${piece.ax.join()})`);break;}
        }
        // a few of them are checked whole as well (the check takes about as long as building the shed)
        if(bottom%6===0||bottom+tall===vals.Hb-10){
          const found=checkPreset(shed,vals,parts).problems;
          if(found.length)say(label+'the check says: '+found[0].text);
        }
      }
    }
  }
});
/* The floor of the Shed at sizes across the form: the floor pieces reach the rim joists all round, nothing overlaps,
   no gap between two pieces is more than 1/8" (a piece gives up at most 1/16" at a joint, SHED_FLOOR_GIVE), every
   left or right end of a piece lands on a joist or at the outside of the floor, and on the cutting diagrams every floor piece lies with the side that runs across the joists (left to
   right) along the 8 ft length of the sheet, where the face grain runs: a floor sheet is strong that way. The only
   pieces that may lie the other way: a narrow strip with no joist between its ends, and the end pieces at a size
   where the grain across would take one more sheet (the floor step then says so). Every 6" of width and depth:
   the 3/4" plywood bought is never more than when every piece is laid with its longer side along the sheet (as the
   program bought before), and at the usual 10 ft x 8 ft the two 24" x 48" end pieces share one sheet: 3 sheets. */
SELFTESTS.push(function shedFloorGrainAcrossJoists(problems){
  const shed=PRESETS.find(preset=>preset.name==='Shed');
  if(!shed)return;
  let reported=0;
  const say=text=>{if(reported++<6)problems.push('shed floor: '+text);};
  const near=1e-6;
  const floorPlan=pieces=>materialBuy(M.ply34,pieces,()=>'',0);
  for(let W=48;W<=192;W+=6)for(let D=48;D<=144;D+=6){
    const vals={...presetDefaults(shed),W,D},label=`${W}" x ${D}": `;
    if(shed.check(vals).some(found=>found.level==='stop'))continue;
    const parts=buildShed(vals);
    const decks=parts.filter(piece=>piece.name==='Floor deck').map(piece=>({piece,b:box(piece)}));
    const joists=parts.filter(piece=>piece.name==='Floor joist').map(box);
    for(const{b}of decks){
      for(const x of[b.lo[0],b.hi[0]]){
        const outside=x<near||x>W-near;
        if(!outside&&!joists.some(joist=>x>joist.lo[0]+near&&x<joist.hi[0]-near))say(label+`a floor piece ends at ${fmt(x)} from the left, not over a joist`);
      }
    }
    // the floor reaches the rim joists all round (nothing given up at the outside), no piece lies over another, and
    // no gap between two floor pieces is more than 1/8" (the 1/16" a piece may give up at a joint: SHED_FLOOR_GIVE)
    if(Math.min(...decks.map(d=>d.b.lo[0]))>near||Math.max(...decks.map(d=>d.b.hi[0]))<W-near||
      Math.min(...decks.map(d=>d.b.lo[2]))>near||Math.max(...decks.map(d=>d.b.hi[2]))<D-near)say(label+'the floor does not reach the rim joists all round');
    const overlap=decks.some((a,i)=>decks.some((o,j)=>j>i&&Math.min(a.b.hi[0],o.b.hi[0])-Math.max(a.b.lo[0],o.b.lo[0])>near&&Math.min(a.b.hi[2],o.b.hi[2])-Math.max(a.b.lo[2],o.b.lo[2])>near));
    if(overlap)say(label+'two floor pieces lie over each other');
    for(const{b}of decks){
      if(b.lo[0]>near&&!decks.some(o=>Math.abs(o.b.hi[0]-b.lo[0])<=.125+near&&o.b.hi[0]<=b.lo[0]+near&&o.b.lo[2]<b.hi[2]&&o.b.hi[2]>b.lo[2]))say(label+'a gap of more than 1/8" to the floor piece on the left');
      if(b.lo[2]>near&&!decks.some(o=>Math.abs(o.b.hi[2]-b.lo[2])<=.125+near&&o.b.hi[2]<=b.lo[2]+near&&o.b.lo[0]<b.hi[0]&&o.b.hi[0]>b.lo[0]))say(label+'a gap of more than 1/8" to the floor piece behind');
    }
    // a piece is its full space or 1/16" short of it, never more
    const area=decks.reduce((sum,d)=>sum+(d.b.hi[0]-d.b.lo[0])*(d.b.hi[2]-d.b.lo[2]),0);
    if(area<W*D-(W+D)*2*SHED_FLOOR_GIVE*decks.length-near)say(label+'the floor pieces leave more uncovered than the 1/16" a piece may give up');
    // on the sheets: the left-to-right side of each piece along the 8 ft length (a square piece may lie either way,
    // and so may a narrow strip with no joist between its ends, which carries no grainAxis)
    const plan=floorPlan(decks.map(d=>d.piece));
    const across=d=>d.b.hi[0]-d.b.lo[0],along=d=>d.b.hi[2]-d.b.lo[2];
    // a piece deeper than it is wide that reaches over a joist asks for its grain across the joists, unless that
    // would take one more sheet (then shedFloor lays them as before, and the floor step says so)
    const wantsAcross=d=>along(d)>across(d)+near&&joists.some(joist=>(joist.lo[0]+joist.hi[0])/2>d.b.lo[0]+1&&(joist.lo[0]+joist.hi[0])/2<d.b.hi[0]-1);
    if(decks.some(d=>wantsAcross(d)&&d.piece.grainAxis!==0)){
      const turned=decks.map(d=>wantsAcross(d)?{...d.piece,grainAxis:0}:d.piece);
      if(floorPlan(turned).sheets.length<=floorPlan(decks.map(d=>d.piece)).sheets.length)say(label+'a floor piece that reaches over a joist does not ask for its grain across the joists, though that takes no more sheets');
      const step=((shed.steps||STEPS[shed.name])(vals).find(s=>/floor deck/.test(s.t))||{}).t||'';
      if(!/on the floor that grain runs along the joists/.test(step))say(label+'the floor step does not say which pieces have their grain along the joists');
    }
    for(const sheet of plan.sheets)for(const item of sheet.items){
      if(Math.abs(item.w-item.h)<near)continue;
      const grainAcross=decks.some(d=>Math.abs(across(d)-item.w)<near&&Math.abs(along(d)-item.h)<near);
      const freeStrip=decks.some(d=>d.piece.grainAxis===undefined&&Math.abs(along(d)-item.w)<near&&Math.abs(across(d)-item.h)<near);
      if(!grainAcross&&!freeStrip)say(label+`a floor piece of ${fmt(item.w)} × ${fmt(item.h)} is drawn with its grain along the joists`);
    }
    // the floor as the program cut it before: every piece its full space, its longer side along the sheet
    const before=floorPlan(shedFloorPieces(shedPlan(vals),{grain:false,give:[]},0)).sheets.length;
    if(plan.sheets.length>before)say(label+`the floor takes ${plan.sheets.length} sheets, more than the ${before} it took before`);
    if(W===120&&D===96&&plan.sheets.length!==3)say(label+`the usual floor takes ${plan.sheets.length} sheets of 3/4" plywood, not 3 (its two 24" x 48" end pieces share one)`);
  }
});
