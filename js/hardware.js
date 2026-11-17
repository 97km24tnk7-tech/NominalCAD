/* NominalCAD: hardware as real objects: hinges, drawer slides, pulls, catches, casters and the rest.

   THE CATALOG
     HARDWARE[kind] = {
       name      'Butt hinge'                      one of them, in plain words
       group     'Hinges'                          its heading in the Add > Hardware pulldown
       sizes     [[3, '3"'], ...]                  the US sizes on offer: [inches, label]
       size      3                                 the size used when none is asked for
       term      the word of the entry in TERMS (js/glossary.js) that explains it to a beginner
                 (its price is a row of HARDWARE_PRICES in js/prices.js, found through the line that buy() gives)
       buy       (size) => the line on the shopping list ('Butt hinges, 3"')
       pairs     true when the store sells them in pairs (the shopping list then counts pairs)
       screws    the screws it needs, in words ('6 flat-head screws, #6 × 3/4" (in the package)')
       mount     one or two plain sentences on how to mount it (for the build instructions)
       motion    'swing' (a hinge) or 'slide' (a drawer slide); missing for hardware that does not move anything
       holds     true for hardware that holds two pieces together without moving either (a bolt): like a hinge, it
                 joins the piece it is on to the piece `to` (HOLD_SOURCES), and Unfasten takes it off
       line      (group, hosts, letterOf) => its line under a build step, for a kind that writes its own (optional)
       plain     a pattern for the plain lines of a preset's hardware list that mean this kind, for a kind whose
                 name says screws or bolts (HW_NOT_PLAIN would otherwise keep such a line off every kind): once
                 the preset is placed, what is placed is counted and the plain line is settled (plainKinds)
       limit     hinges: how far it opens, in degrees
       travel    slides: (size) => how far the drawer comes out, in inches
       wood      for a kind that is a strip of wood to cut, not something to buy (a runner, a kicker):
                 {name, mat, w, t, screwLabel, screwsEach}. It is then a row of the cut list and of the lumber to
                 buy (woodStrips), and the shopping list counts its screws instead of the strip
       shape     (size, geo) => {on: [...], to: [...]}   its 3D shape as simple boxes and cylinders (js/hardwareshapes.js
                 explains the format). "on" is the part on the piece it is mounted on, "to" the part on the other piece.
     }
     To add a kind: add a row. Nothing else needs to know.

   IN THE PROJECT
     S.hardware = [{id, kind, size, on, to, at, n, u, geo}]      (old projects have none: the list starts empty)
       on    id of the piece it is mounted on. For a hinge that is the door or lid, for a slide the drawer side:
             the piece that MOVES. Everything is measured in that piece's own frame, so the hardware follows the
             piece when it is moved, turned, mirrored or copied.
       to    id of the second piece (the frame a hinge is screwed to, the cabinet side of a slide), or null
       at    [x, y, z] where it sits, measured from the middle of the piece "on", along the directions of the world
             as the piece stood before any free rotation (the same frame the piece's own box is drawn in)
       n     unit vector pointing out of the face it is mounted on
       u     unit vector along it: the pin of a hinge, the travel of a slide, the length of a pull.
             A hinge opens by turning right-handed about u; a slide opens by moving along u.
       geo   a few numbers some shapes need (the thickness of the door for a cup hinge, the gap a slide fills)
     S.nextHw   the next free id

   WHAT THE REST OF THE PROGRAM CALLS
     hardwareList()                 S.hardware, always an array
     hardwareById(id)   hardwareOn(pieceId)   hardwareBetween(pieceId) (on or to)
     addHardware(fields)            add one; returns it. Call commit() afterwards.
     removeHardware(ids)            delete some. Call commit() afterwards.
     hardwarePose(item)             where it is in the world with everything closed: {at, n, u} as THREE.Vector3
     toHostFrame(piece, point, isDirection)   a world point or direction, in the frame of that piece
     hardwareWords(items)           '2 butt hinges'
     hardwareRows(plainLines)       the hardware lines of the shopping list: what is placed in the model, plus the
                                    plain lines a preset listed (S.hw), minus the plain lines whose kind is placed
     hardwareTurned(piece, quaternion), hardwareMirrored(pieceIds, k), copyHardware(copyOf)
                                    called by the code that turns, mirrors and copies pieces

   Hardware that moves something (a hinge, a slide) also HOLDS: the door belongs to the fastened set of its frame
   (HOLD_SOURCES, js/connections.js), and Unfasten lists it as "Door to Side: 2 concealed cup hinges". */
'use strict';

const HW_COLOR={steel:0xb9bec5,zinc:0x9aa3ad,dark:0x33363b,brass:0xc2a24a,white:0xf1f1ee,wood:0xd9b47c,rubber:0x2a2c2f};
const inches=v=>fmt(v);
const box3=(c,s,color)=>({box:s,at:c,color});
const cyl3=(c,radius,length,axis,color)=>({cyl:[radius,length],at:c,axis,color});

/* the leaves of a butt, piano or strap hinge: both lie in one plane; the door leaf runs toward -z, the frame leaf toward +z */
function leafHinge(long,doorLeaf,frameLeaf,barrel,color){
  return{
    on:[box3([0,.03,-doorLeaf/2],[long,.06,doorLeaf],color),cyl3([0,barrel*.8,0],barrel,long,'x',color)],
    to:[box3([0,.03,frameLeaf/2],[long,.06,frameLeaf],color)],
  };
}
const HARDWARE={
  butt:{name:'Butt hinge',group:'Hinges',sizes:[[2,'2"'],[2.5,'2 1/2"'],[3,'3"'],[3.5,'3 1/2"'],[4,'4"']],size:3,term:'Butt hinge',
    buy:s=>`Butt hinges, ${inches(s)}`,screws:'6 flat-head screws, #6 × 3/4" (in the package)',motion:'swing',limit:180,
    mount:'Hold the hinge in place with the barrel just clear of the edge and mark the screw holes. Drill small pilot holes, then screw one leaf to the door or lid and the other to the frame.',
    shape:(s,geo)=>leafHinge(s,Math.min(geo.wd||9,s>=3?1.5:s/2),Math.min(geo.wf||9,s>=3?1.5:s/2),.12,'brass')},
  strap:{name:'T-hinge (strap hinge)',group:'Hinges',sizes:[[4,'4"'],[6,'6"'],[8,'8"'],[10,'10"']],size:8,term:'T-hinge',
    buy:s=>`Heavy T-hinges, ${inches(s)}`,screws:'7 screws, #10 × 1-1/4" (use longer screws into the framing)',motion:'swing',limit:180,
    mount:'For shed and gate doors. Screw the short plate to the door frame and the long strap across the face of the door. Set the door on spacers first so the gap is even all around.',
    shape:(s,geo)=>{
      const tall=Math.min(4,s*.55),plate=Math.min(geo.wf||9,1.5);
      return{on:[box3([0,.04,-s*.25],[1.7,.08,s*.5],'dark'),box3([0,.04,-s*.75],[1.1,.08,s*.5],'dark'),cyl3([0,.11,0],.14,tall,'x','dark')],
        to:[box3([0,.04,plate/2],[tall,.08,plate],'dark')]};
    }},
  cup:{name:'Concealed cup hinge',group:'Hinges',sizes:[[1.375,'Full overlay']],size:1.375,term:'Overlay hinge',
    buy:()=>'Cabinet hinges, concealed, full overlay',screws:'4 screws (in the package)',motion:'swing',limit:110,
    mount:'For cabinet doors. Drill the 1 3/8" cup hole in the back of the door, 7/8" from the edge to the middle of the hole and 1/2" deep (a Forstner bit and a hinge jig make this easy). Screw the cup to the door and the plate inside the cabinet, then turn the adjusting screws until the gaps are even.',
    shape:(s,geo)=>{
      const t=geo.t||.75,inset=geo.e===undefined?.3:geo.e;
      return{on:[cyl3([0,-t+.25,-.875],s/2,.5,'y','steel'),box3([0,-t-.04,-.875],[1.9,.08,1.5],'steel')],
        to:[box3([0,-t-.75,-(inset+.3)],[.65,1.3,.45],'steel'),box3([0,-t-1.3,-(inset+.06)],[2.2,1.4,.12],'zinc')]};
    }},
  piano:{name:'Piano hinge (lid hinge)',group:'Hinges',sizes:[[12,'12"'],[24,'24"'],[30,'30"'],[36,'36"'],[48,'48"'],[72,'72"']],size:30,term:'Piano hinge',
    buy:s=>`Piano hinge, ${inches(s)} long`,screws:'1 small screw every 2" in each leaf, #4 × 5/8" (in the package)',motion:'swing',limit:180,
    mount:'One long hinge for the whole back edge of a lid. Cut it to length with a hacksaw, then screw one leaf to the back of the box and the other to the edge of the lid, starting with a screw at each end.',
    shape:(s,geo)=>leafHinge(s,Math.min(geo.wd||9,.5),Math.min(geo.wf||9,.5),.08,'steel')},
  slide:{name:'Drawer slide, ball-bearing side-mount',group:'Drawers',sizes:[[10,'10"'],[12,'12"'],[14,'14"'],[16,'16"'],[18,'18"'],[20,'20"'],[22,'22"']],size:16,term:'Drawer slide',pairs:true,
    buy:s=>`Drawer slides, ball-bearing side-mount, ${inches(s)} (pairs)`,screws:'8 pan-head screws per slide, #6 × 1/2" (in the package)',motion:'slide',travel:s=>s,
    mount:'Sold in pairs, one for each side. The drawer box must be 1" narrower than its opening: each slide fills a 1/2" gap. Pull the two halves apart, screw the cabinet half to the cabinet side, level and 1/16" back from the front edge, and the drawer half to the side of the drawer. Slide the drawer in until both sides click.',
    shape:(s,geo)=>{
      const gap=geo.g||.5;
      return{on:[box3([0,gap*.22,0],[s,gap*.44,1.4],'zinc')],to:[box3([0,gap*.76,0],[s,gap*.48,1.8],'steel')]};
    }},
  runner:{name:'Wooden drawer runner',group:'Drawers',sizes:[[10,'10"'],[12,'12"'],[14,'14"'],[16,'16"'],[18,'18"'],[20,'20"'],[22,'22"']],size:16,term:'Drawer runner',wood:{name:'Drawer runner',mat:'1x2',w:.75,t:.75,screwLabel:'#8 × 1-1/4" wood screws',screwsEach:3},
    buy:s=>`Wooden drawer runners, 3/4" × 3/4" × ${inches(s)} (cut from a 1x2)`,screws:'3 wood screws per runner, #8 × 1-1/4"',motion:'slide',travel:s=>s*2/3,
    mount:'A strip of hardwood the drawer side rides on. Glue and screw one strip to each cabinet side, level, where the bottom edge of the drawer side will run. Rub the top with candle wax so the drawer slides easily. The drawer comes out about two thirds of its depth.',
    shape:(s,geo)=>{
      const gap=geo.g||.06,up=geo.up||1;
      return{on:[],to:[box3([0,gap-.375,-up*.375],[s,.75,.75],'wood')]};
    }},
  /* the strip above a drawer that rides on wooden runners. It is mounted on the cabinet side and moves nothing;
     js/drawers.js puts one above each drawer side that has no rail or panel right above it */
  kicker:{name:'Drawer kicker',group:'Drawers',sizes:[[10,'10"'],[12,'12"'],[14,'14"'],[16,'16"'],[18,'18"'],[20,'20"'],[22,'22"']],size:16,term:'Drawer kicker',wood:{name:'Drawer kicker',mat:'1x2',w:.75,t:.75,screwLabel:'#8 × 1-1/4" wood screws',screwsEach:3},
    buy:s=>`Wooden drawer kickers, 3/4" × 3/4" × ${inches(s)} (cut from a 1x2)`,screws:'3 wood screws per kicker, #8 × 1-1/4"',
    mount:'A strip of wood just above the side of a drawer that rides on wooden runners. Glue and screw one to each cabinet side, level, 1/8" above where the top edge of the drawer side will be. It keeps the drawer from tipping down when it is pulled out.',
    // placed by its middle (geo.mid), like every other kind; a kicker saved by an earlier version sits on its underside
    shape:(s,geo)=>({on:[box3([0,.375,geo.mid?0:(geo.up||1)*.375],[s,.75,.75],'wood')],to:[]})},
  pull:{name:'Pull handle',group:'Handles and catches',sizes:[[3,'3"'],[3.75,'3 3/4"'],[5,'5"']],size:3.75,term:'Pull and catch',
    buy:s=>`Pull handles, ${inches(s)} between holes`,screws:'2 machine screws from the back (in the package)',
    mount:'Mark the two holes with a square so the pull sits straight, drill 3/16" holes through the door or drawer front, and screw the pull on from the back.',
    shape:s=>({on:[cyl3([-s/2,.5,0],.16,1,'y','dark'),cyl3([s/2,.5,0],.16,1,'y','dark'),cyl3([0,1,0],.2,s+1,'x','dark')],to:[]})},
  knob:{name:'Knob',group:'Handles and catches',sizes:[[1.25,'1 1/4"']],size:1.25,term:'Pull and catch',
    buy:s=>`Knobs, ${inches(s)}`,screws:'1 machine screw from the back (in the package)',
    mount:'Drill one 3/16" hole and screw the knob on from the back.',
    shape:s=>({on:[cyl3([0,.3,0],.2,.6,'y','dark'),cyl3([0,.8,0],s/2,.45,'y','dark')],to:[]})},
  catch:{name:'Magnetic catch',group:'Handles and catches',sizes:[[1.75,'1 3/4"']],size:1.75,term:'Pull and catch',
    buy:()=>'Magnetic door catches',screws:'2 screws for the magnet and 1 for the strike plate (in the package)',
    mount:'Screw the magnet inside the cabinet, just behind the closed door. Stick the small steel plate to the magnet, close the door on it to mark the spot, and screw the plate to the back of the door there.',
    shape:s=>({on:[box3([0,.275,.36],[s,.55,.6],'white'),box3([0,.275,.03],[s*.7,.4,.06],'steel')],to:[]})},
  hasp:{name:'Hasp / latch',group:'Handles and catches',sizes:[[3.5,'3 1/2"'],[4.5,'4 1/2"']],size:4.5,term:'Hasp',
    buy:s=>`Gate latch or hasp, ${inches(s)}`,screws:'7 screws (in the package)',
    mount:'Screw the hinged strap to the door and the loop (staple) to the frame so the strap closes over it. A padlock through the loop keeps it shut.',
    shape:s=>({on:[box3([0,.12,1.1-s/2],[1.25,.08,s],'zinc')],to:[box3([0,.04,.8],[1.5,.08,1],'zinc'),box3([0,.3,.75],[.45,.5,.3],'zinc')]})},
  stay:{name:'Lid stay (lid support)',group:'Handles and catches',sizes:[[6,'6"'],[8,'8"'],[10,'10"']],size:8,term:'Lid stay',limit:95,
    buy:s=>`Lid stays (soft-close lid supports), ${inches(s)}`,screws:'4 screws (in the package)',
    mount:'Holds a lid open and keeps it from slamming on fingers. Screw one end inside the box near the back and the other under the lid, following the sheet in the package for the two distances.',
    shape:s=>({on:[box3([0,.15,0],[s,.12,.5],'steel'),cyl3([-s/2+.3,.15,0],.3,.25,'y','steel'),cyl3([s/2-.3,.15,0],.3,.25,'y','steel')],to:[]})},
  caster:{name:'Caster',group:'Feet and shelves',sizes:[[2,'2"'],[3,'3"'],[4,'4"']],size:3,term:'Caster',
    buy:s=>`Casters, ${inches(s)} wheel`,screws:'4 screws, #12 × 3/4" (or lag screws into a leg)',
    mount:'Screw one under each corner. Use two with brakes on the front so it stays put.',
    shape:s=>({on:[box3([0,.06,0],[s*.8+.6,.12,s*.8+.6],'zinc'),box3([0,.12+s*.35,0],[s*.55,s*.7,.35],'zinc'),cyl3([0,.12+s*.8,0],s/2,s*.4,'x','rubber')],to:[]})},
  foot:{name:'Leveling foot',group:'Feet and shelves',sizes:[[1.5,'1 1/2"']],size:1.5,term:'Leveling foot',
    buy:()=>'Leveling feet with threaded inserts',screws:'1 threaded insert (T-nut) per foot',
    mount:'Drill a hole in the bottom of each leg, tap in the threaded insert, and screw the foot in. Turn the feet until nothing rocks.',
    shape:s=>({on:[cyl3([0,.4,0],.19,.8,'y','steel'),cyl3([0,.9,0],s/2,.25,'y','rubber')],to:[]})},
  /* A structural screw through the back of a design into a wall stud (the fish racks: js/rackwall.js places them,
     WALL_SCREW_RULES in js/verify.js says how many). It is mounted on the piece whose front face its head sits on
     and points out of the back of the design, into the wall: n is the way out of the face the head is on, and
     the screw runs the other way, its full length. Nothing of the wall is drawn, so the part that shows behind
     the design is what goes into the drywall and the stud. */
  wallscrew:{name:'Structural screw into a wall stud',group:'Wall and bolts',sizes:[[3,'3"'],[3.5,'3 1/2"'],[4,'4"'],[5,'5"'],[6,'6"'],[8,'8"'],[10,'10"']],size:5,term:'Wall stud and stud finder',
    buy:s=>`Screws for the wall studs, ${inches(s)} structural`,plain:/^Screws for the wall studs/i,
    line:(group,hosts,letterOf)=>wallScrewStepLine(group,hosts,letterOf),   // its line under the wall step (js/rackwall.js)
    screws:'None: it is the screw. Structural screws come with the driver bit that fits them',
    mount:'Find the studs with a stud finder and mark them. Drill a 5/32" pilot hole through the wood in front of the stud, then drive the screw into the middle of the stud until its washer head is snug against the wood. Do not drive it deeper: that crushes the wood.',
    shape:s=>({on:[cyl3([0,.05,0],.32,.1,'y','brass'),cyl3([0,-s/2,0],.125,s,'y','brass')],to:[]})},
  /* A carriage bolt with a flat washer and a nut, through pieces that are clamped together (the end posts of two
     sections of a fish rack, js/rackwall.js). It is mounted on the piece its round head is on, and `to` is the
     piece the washer and the nut are on: it holds the two together (HOLD_SOURCES), and undoing the nut parts
     them again. geo.grip: how thick the pieces it passes through are, together. */
  bolt:{name:'Carriage bolt, 3/8", with washer and nut',group:'Wall and bolts',sizes:[[3,'3"'],[3.5,'3 1/2"'],[4,'4"'],[4.5,'4 1/2"'],[5,'5"'],[5.5,'5 1/2"'],[6,'6"'],[7,'7"'],[8,'8"'],[10,'10"'],[12,'12"']],size:4,term:'Carriage bolt',holds:true,
    buy:s=>`Carriage bolts, 3/8" × ${inches(s)}, with a flat washer and a nut each`,plain:/^Carriage bolts/i,
    line:(group,hosts,letterOf)=>boltStepLine(group,hosts,letterOf),        // its line under the step that joins the sections (js/rackwall.js)
    screws:'None: a 3/8" flat washer and a 3/8" nut go on the end (buy them with the bolts)',
    mount:'Clamp the pieces tight together and drill a 3/8" hole straight through all of them. Tap the bolt in from the head side with a hammer until its square neck sits in the wood (it keeps the bolt from turning), or, where there is no room to swing a hammer, let the nut pull it in: put the washer and the nut on the other end and tighten the nut with a 9/16" wrench until the head pulls snug. To take the pieces apart again, undo the nut and tap the bolt out.',
    shape:(s,geo)=>{
      const grip=Math.min(s-.4,geo.grip||s-.5);
      return{on:[cyl3([0,.1,0],.42,.2,'y','zinc'),box3([0,-.17,0],[.375,.34,.375],'zinc'),cyl3([0,-s/2,0],.1875,s,'y','zinc')],
        to:[cyl3([0,-grip-.04,0],.5,.08,'y','steel'),box3([0,-grip-.08-.165,0],[.56,.33,.56],'steel')]};
    }},
  pin:{name:'Shelf pin',group:'Feet and shelves',sizes:[[.25,'1/4"']],size:.25,term:'Shelf pin',
    buy:()=>'Shelf pins, 1/4"',screws:'None: it pushes into a 1/4" hole',
    mount:'Drill 1/4" holes, 3/8" deep, at the same height on both sides (four per shelf). Push the pins in and rest the shelf on them.',
    shape:s=>({on:[cyl3([0,.2,0],s/2,.4,'y','steel'),box3([0,.33,.16],[.3,.06,.36],'steel')],to:[]})},
};
/* A plain line of a preset's hardware list (S.hw) that means one of these kinds. What is placed in the model is
   counted there, so that many are taken off the plain line (hardwareRows). A line that names screws or nails is
   never one of these, even when it says what they are for ("Exterior screws, 3/4", for the hinge straps"). */
const HW_PLAIN=[[/hinge/i,['butt','strap','cup','piano']],[/\bpulls?\b|knob/i,['pull','knob']],[/catch/i,['catch']],
  [/latch|hasp/i,['hasp']],[/slide/i,['slide']],[/runner/i,['runner']],[/kicker/i,['kicker']],[/caster/i,['caster']],[/lid stay|lid support/i,['stay']]];
const HW_NOT_PLAIN=/\bscrews?\b|\bnails?\b|\bbolts?\b/i;
function plainKinds(label){
  // a kind that names its own plain lines (the screws into the wall studs, carriage bolts) is asked first
  const own=Object.keys(HARDWARE).filter(key=>HARDWARE[key].plain&&HARDWARE[key].plain.test(label));
  if(own.length)return own;
  if(HW_NOT_PLAIN.test(label))return null;
  const match=HW_PLAIN.find(([words])=>words.test(label));
  return match?match[1]:null;
}

/* ---------- the list in the project ---------- */
function hardwareList(){
  if(!Array.isArray(S.hardware))S.hardware=[];
  return S.hardware;
}
const hardwareById=id=>hardwareList().find(item=>item.id===id);
const hardwareOn=pieceId=>hardwareList().filter(item=>item.on===pieceId);
const hardwareBetween=pieceId=>hardwareList().filter(item=>item.on===pieceId||item.to===pieceId);
const sizeLabel=item=>{const row=HARDWARE[item.kind].sizes.find(s=>s[0]===item.size);return row?row[1]:inches(item.size);};

function addHardware(fields){
  const list=hardwareList(),kind=HARDWARE[fields.kind];
  const used=list.reduce((most,item)=>Math.max(most,item.id),0);
  const item={id:Math.max(S.nextHw||1,used+1),kind:fields.kind,size:fields.size||kind.size,on:fields.on,to:fields.to==null?null:fields.to,
    at:fields.at.map(clean),n:fields.n.map(clean),u:fields.u.map(clean),geo:fields.geo||{}};
  S.nextHw=item.id+1;
  list.push(item);
  return item;
}
function removeHardware(ids){
  const gone=new Set(ids);
  S.hardware=hardwareList().filter(item=>!gone.has(item.id));
}
/* numbers as they are stored: no 0.30000000000000004, no -0 */
function clean(v){
  const rounded=Math.round(v*4096)/4096;
  return rounded===0?0:rounded;
}
/* '2 butt hinges', '1 pair of drawer slides' */
function hardwareWords(items){
  const counts=new Map();
  for(const item of items)counts.set(item.kind,(counts.get(item.kind)||0)+1);
  return[...counts.entries()].map(([kind,count])=>{
    let name=HARDWARE[kind].name.replace(/\s*\(.*\)$/,'').replace(/,.*$/,'').replace(/ \/.*$/,'');
    if(name[1]!=='-')name=name[0].toLowerCase()+name.slice(1); // "butt hinge", but "T-hinge"
    return`${count} ${name}${count===1?'':/(ch|sh|s|x)$/.test(name)?'es':'s'}`;   // "2 magnetic catches"
  }).join(' and ');
}

/* Hardware that is really wood to cut (kind.wood): each as a piece-like row for the cut list, the cutting
   diagrams and the lumber to buy. They are not pieces of the design (they are placed and drawn as hardware), so
   nothing else sees them. */
function woodStrips(){
  const pieces=pieceMap(),strips=[];
  for(const item of hardwareList()){
    const kind=HARDWARE[item.kind];
    if(!kind||!kind.wood||!pieces.has(item.on))continue;
    strips.push({strip:item,name:kind.wood.name,mat:kind.wood.mat,l:item.size,w:kind.wood.w,t:kind.wood.t});
  }
  return strips;
}

/* ---------- where it is ---------- */
let pieceMapMemo=null;
/* id -> piece, worked out once per change of the list of pieces */
function pieceMap(){
  if(!pieceMapMemo||pieceMapMemo.parts!==S.parts||pieceMapMemo.count!==S.parts.length){
    pieceMapMemo={parts:S.parts,count:S.parts.length,map:new Map(S.parts.map(p=>[p.id,p]))};
  }
  return pieceMapMemo.map;
}
const pieceMiddle=p=>{const s=size(p);return new THREE.Vector3(p.pos[0]+s[0]/2,p.pos[1]+s[1]/2,p.pos[2]+s[2]/2);};
function hardwarePose(item){
  const host=pieceMap().get(item.on);
  if(!host)return null;
  const q=quatOf(host);
  const turn=v=>{const out=new THREE.Vector3(v[0],v[1],v[2]);return q?out.applyQuaternion(q):out;};
  return{at:turn(item.at).add(pieceMiddle(host)),n:turn(item.n),u:turn(item.u)};
}
/* a point (or, with isDirection, a direction) of the world, measured in the frame of this piece */
function toHostFrame(piece,v,isDirection){
  const out=new THREE.Vector3(v[0]!==undefined?v[0]:v.x,v[1]!==undefined?v[1]:v.y,v[2]!==undefined?v[2]:v.z);
  if(!isDirection)out.sub(pieceMiddle(piece));
  const q=quatOf(piece);
  if(q)out.applyQuaternion(q.clone().invert());
  return[out.x,out.y,out.z];
}

/* ---------- following the piece ---------- */
/* The piece is about to have this rotation folded into the way it lies (p.ax): what is mounted on it turns too. */
function hardwareTurned(piece,q){
  if(!S||!piece.id||!Array.isArray(S.hardware)||!S.hardware.length)return;
  for(const item of S.hardware){
    if(item.on!==piece.id)continue;
    for(const key of['at','n','u']){
      const v=new THREE.Vector3(item[key][0],item[key][1],item[key][2]).applyQuaternion(q);
      item[key]=[clean(v.x),clean(v.y),clean(v.z)];
    }
  }
}
/* These pieces were flipped across a plane square to direction k. A mirrored door opens the mirrored way, so the
   direction "along" also turns around. */
function hardwareMirrored(pieceIds,k){
  const flipped=new Set(pieceIds);
  for(const item of hardwareList()){
    if(!flipped.has(item.on))continue;
    item.at[k]=clean(-item.at[k]);
    item.n[k]=clean(-item.n[k]);
    item.u=item.u.map((v,i)=>clean(i===k?v:-v));
  }
}
/* copyOf: Map from the id of an original piece to the id of its copy */
function copyHardware(copyOf){
  for(const item of hardwareList().slice()){
    if(!copyOf.has(item.on))continue;
    addHardware({...item,at:item.at.slice(),n:item.n.slice(),u:item.u.slice(),geo:{...item.geo},
      on:copyOf.get(item.on),to:item.to!=null&&copyOf.has(item.to)?copyOf.get(item.to):null});
  }
}
/* When a piece changes size, what is mounted near one of its ends keeps its distance from that end, and what is
   near the middle keeps its share of the length. */
const sizesAtLastChange=new Map(); // piece id -> its box size after the last change
function rememberSizes(){
  sizesAtLastChange.clear();
  for(const item of hardwareList()){
    const host=pieceMap().get(item.on);
    if(host)sizesAtLastChange.set(host.id,size(host));
  }
}
function followResizes(){
  for(const item of hardwareList()){
    const host=pieceMap().get(item.on),before=sizesAtLastChange.get(item.on);
    if(!host||!before)continue;
    const now=size(host);
    if(before.slice().sort().join()===now.slice().sort().join())continue; // same size (perhaps turned: the turn took care of it)
    for(let k=0;k<3;k++){
      if(Math.abs(now[k]-before[k])<1e-6)continue;
      const fromMiddle=item.at[k],nearEnd=Math.abs(fromMiddle)>before[k]/4;
      item.at[k]=clean(nearEnd?fromMiddle+Math.sign(fromMiddle)*(now[k]-before[k])/2:fromMiddle*now[k]/before[k]);
    }
  }
}

/* ---------- keeping the list sound ---------- */
function tidyHardware(){
  const pieces=pieceMap();
  const sound=item=>item&&HARDWARE[item.kind]&&pieces.has(item.on)&&
    ['at','n','u'].every(key=>Array.isArray(item[key])&&item[key].length===3&&item[key].every(Number.isFinite));
  S.hardware=hardwareList().filter(sound);
  for(const item of S.hardware){
    if(item.to!=null&&!pieces.has(item.to))item.to=null; // the frame was deleted: the hinge stays on its door, holding nothing
    if(!item.geo||typeof item.geo!=='object')item.geo={};
    if(!HARDWARE[item.kind].sizes.some(s=>s[0]===item.size))item.size=HARDWARE[item.kind].size;
  }
}
/* A project saved before hardware was drawn has no hardware list. Its doors and drawers were checked on the
   understanding that their hinges and slides are there without being drawn; it is marked, so that Check my design
   keeps reading it that way (js/holds.js). */
ON_LOAD.unshift(()=>{   // first of all the hooks: the others ask for the hardware list, which makes an empty one
  if(!Array.isArray(S.hardware)&&S.parts.length)S.assumeHardware=true;
});
ON_LOAD.push(()=>{
  tidyHardware();
  rememberSizes();
});
ON_COMMIT.push(()=>{tidyHardware();followResizes();rememberSizes();});

/* ---------- hardware that holds: hinges and slides ---------- */
/* One connection per pair of pieces: the two or three hinges of a door are one line in Unfasten. */
HOLD_SOURCES.push(function hardwareHolds(){
  const pieces=pieceMap(),pairs=new Map();
  for(const item of hardwareList()){
    if(!HARDWARE[item.kind]||!(HARDWARE[item.kind].motion||HARDWARE[item.kind].holds)||item.to==null)continue;
    const a=pieces.get(item.on),b=pieces.get(item.to);
    if(!a||!b)continue;
    const key=`hw:${item.on}:${item.to}`;
    if(!pairs.has(key))pairs.set(key,{key,a,b,items:[]});
    pairs.get(key).items.push(item);
  }
  return[...pairs.values()].map(pair=>({
    key:pair.key,a:pair.a,b:pair.b,type:pair.items[0].kind,words:hardwareWords(pair.items),
    remove(){removeHardware(pair.items.map(item=>item.id));},
  }));
});

/* ---------- the shopping list ---------- */
/* Everything is counted once. What is placed in the model is a row under its own name. A plain line of the
   preset for the same kind of thing (its hinges, its pulls) is cut down by the number that is placed, and left
   out when none remain: a cabinet whose four hinges are all in the model lists them once, and a nightstand with
   three pulls on its list and one pull placed by hand lists that one and the two still to come. */
function hardwareRows(plainLines){
  const counts=new Map();
  for(const item of hardwareList()){
    const kind=HARDWARE[item.kind];
    if(kind.wood){   // a strip of wood: it is on the cut list, and what is bought for it is its screws
      counts.set(kind.wood.screwLabel,(counts.get(kind.wood.screwLabel)||0)+kind.wood.screwsEach);
      continue;
    }
    const label=kind.buy(item.size);
    counts.set(label,(counts.get(label)||0)+(kind.pairs?.5:1));
  }
  const rows=[...counts.entries()].map(([label,count])=>[label,Math.ceil(count)]);
  return rows.concat(plainLinesLeft(plainLines,hardwareList()));
}
/* The plain lines that are left when these placed items are taken off them: each item uses up one of a line that
   means its kind (a pair of slides one of a line of pairs); a line with nothing left is dropped; a line that
   means no kind of placed hardware (wall screws, landscape fabric) stays as it is. */
function plainLinesLeft(plainLines,items){
  const placed=new Map();   // kind -> how many of it are placed (a pair of slides is one)
  for(const item of items)placed.set(item.kind,(placed.get(item.kind)||0)+(HARDWARE[item.kind].pairs?.5:1));
  for(const kind of placed.keys())placed.set(kind,Math.ceil(placed.get(kind)));
  const rows=[];
  for(const[label,quantity]of plainLines||[]){
    const kinds=plainKinds(label);
    let left=quantity;
    for(const kind of kinds||[]){
      const taken=Math.min(left,placed.get(kind)||0);
      left-=taken;
      placed.set(kind,(placed.get(kind)||0)-taken);
    }
    if(left>0||!kinds)rows.push([label,left]);
  }
  return rows;
}
/* A preset lists its hardware as plain lines (preset.hw). Placing it puts the hinges, slides, pulls and catches
   into the model, and from then on THOSE are what is listed: the lines they stood for are settled here, once, and
   are gone for good. So a pull that is deleted from the model later is off the shopping list too, and does not
   come back under the preset's own name for it. What the preset lists and does not place (the screws into the
   wall) stays. Returns the lines that are left; placePreset keeps them for this placement (S.sets[n].hw), so a
   copy of the whole design can list them again (copySets, js/copies.js).
     before   S.hw as it was before this placement
     own      the lines of this placement
     pieceIds the pieces of this placement: the hardware mounted on them is what was placed for it */
function settlePlainLines(before,own,pieceIds){
  const mine=new Set(pieceIds);
  const left=plainLinesLeft(own,hardwareList().filter(item=>mine.has(item.on)));
  S.hw=(before||[]).concat(left);
  return left;
}
