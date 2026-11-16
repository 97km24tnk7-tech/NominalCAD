/* NominalCAD: show faces. Where the head of every fastener ends up, and whether anybody can see it.

   The owner's rule (README, "Show faces"): on furniture for the house, in the Everyday and Fine furniture styles,
   no fastener head lands on the TOP surface or the FRONT of the piece: a top is held on from underneath (pocket
   screws through the aprons and rails, STYLE_RULES in js/joints.js), and only Rustic / rough leaves screw heads
   showing on top. Shop, garage, outdoor and building presets may keep screws through the top.

     fastenerHeads(links)   every head of the design: {f, at: [x, y, z], out: [x, y, z], link}
                            (a screw or a brad: where it goes in, facing back along it; a pocket hole: where the
                            hole opens; a bracket: each of its own screws)
     headShows(head, wood)  true when a line from the head straight out of its face leaves the design without
                            running into wood: the head can be seen from outside
     showingHeads()         the heads that can be seen, each with the face it is on: 'top', 'front', 'back',
                            'side' or 'under'
     HOUSE_FURNITURE        the presets this rule is checked on (the self-checks at the bottom of this file) */
'use strict';

const HOUSE_FURNITURE=['Desk','Dining table','Coffee table','Side table / nightstand','Sturdy bench','Five-board bench',
  'Entryway shoe bench','Bookshelf','Nightstand with drawers','Base cabinet with doors','Storage box / toy chest','Wall shelf','Platform bed'];
/* the faces a head may never show on, in those presets, in these styles: the top, the front and the sides (the
   owner, on the heads on the outside of a bookshelf side: "hide those too, or mention and explain how to cover").
   The back is left out: a piece for the house stands with its back to a wall, and the brads of a back panel or the
   pocket holes on the back of a cleat are not seen. A head sunk and covered by a plug does not show. */
const SHOW_FACES={styles:['std','fine'],faces:['top','front','side']};
/* Heads that the owner has agreed may stay on a show face, in one style of one preset. The notes of the preset say
   where they are and how to hide them. Sturdy bench: "leave as is but that can be included in the fine finish". */
const SHOW_FACE_ALLOWED=[
  {preset:'Sturdy bench',style:'std',through:'Leg',into:'Short apron',
   why:'the short aprons at the ends are too short for pocket holes (TABLE_KINDS: shortEnds) and are held by structural screws through the legs; Fine furniture dowels them'}];
/* The line the notes of a preset of furniture for the house end with: where screw heads show, in each style, and
   how to hide the ones that stay (placePreset in js/app.js adds it). The notes are written once, when the design
   is made, so the line speaks of all three styles. [] for any other preset. */
const HEADS_NOTE_USUAL='Screw heads: in the Everyday and Fine furniture styles none shows on the top, the front or the sides. Those joints are held from underneath or from inside with pocket screws. On a board more than 54" up, where an underside is seen from below, the holes go in its top face (a shelf, under the books; a top above eye level) or are filled with glued pocket-hole plugs. In Rustic / rough the screws go in from outside and their heads show, on the top and the sides too.';
const HEADS_NOTES={
  'Platform bed':'Screw heads: in the Everyday and Fine furniture styles none shows on the head and foot ends, and the side rails show none but the screws that hold each side rail to its two legs. That joint carries the bed and keeps the frame square, and no hidden joint does it as well, so those screws go in from outside with their heads sunk 3/8" deep and covered: a wooden plug glued in and cut flush, or wood filler under paint. The build step and the finishing step say how, and the shopping list has the plugs (or the filler). In Rustic / rough all the screws go in from outside and their heads show.',
  'Sturdy bench':'Screw heads: in the Everyday style the two short aprons at the ends of the bench are held by structural screws through the legs, and their washer heads show on the front and back faces of the four legs, two on each leg (the aprons are too short for pocket holes). To hide them, choose Fine furniture in Style & finish, which joins those aprons to the legs with glued dowels instead, or do this at each of the four joints between a leg and a short apron: click one of its screws in the 3D view and pick "Screws, heads plugged" in Properties (a choice there changes that one joint). That sinks each head 1 1/4" deep in the leg under a glued length of 3/8" dowel rod cut flush; the steps and the shopping list then say so. Nothing else shows on the top, the front or the sides in Everyday and Fine furniture. In Rustic / rough the screws go in from outside and their heads show, on the seat too.',
  'Wall shelf':'Screw heads: in the Everyday and Fine furniture styles none shows on the shelf or the supports: the pocket holes are on the back of the cleat, against the wall, and on the inside faces of the supports. A shelf hung so high that those faces are seen from below (more than 54" up) gets its support holes filled with glued pocket-hole plugs, sanded flush; the step and the shopping list say so. In Rustic / rough the shelf is screwed down from above and the heads show.'
};
function headsNote(presetName){
  if(!HOUSE_FURNITURE.includes(presetName))return[];
  return[HEADS_NOTES[presetName]||HEADS_NOTE_USUAL];
}
const showFaceAllowed=(presetName,style,head)=>SHOW_FACE_ALLOWED.some(row=>row.preset===presetName&&row.style===style&&
  head.f.through.name===row.through&&head.f.into.name===row.into);

/* every head of the fasteners of these connections (all of the design when none are given) */
function fastenerHeads(links){
  const heads=[];
  for(const link of links||connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link)){
      if(f.kind==='dowel')continue;                      // a dowel is inside the joint: nothing shows
      // (a pocket hole filled with a glued plug, rule 13 in js/fasteners.js, is covered)
      if(f.kind==='pocket'){heads.push({f,link,at:f.pocket.mouth,out:f.pocket.out,covered:!!f.pocket.plugged});continue;}
      if(f.kind==='bracket'){
        for(const screw of f.screws)heads.push({f,link,at:screw.pos,out:screw.dir.map(v=>-v)});
        continue;
      }
      // a head sunk under a wooden plug (or filler, under paint) is covered: it does not show (rule 12, js/fasteners.js)
      // (a head at the bottom of a deep hole is seen down that hole: it is looked at from where the hole opens)
      const at=f.plug?f.plug.at:pointPlus(f.pos,f.dir,-(f.sunk||0));
      heads.push({f,link,at,out:slantedHeadFace(f,at)||f.dir.map(v=>-v),covered:!!f.plug});
    }
  }
  return heads;
}
/* A screw driven at a slant (a toe screw, or one angled from the hidden side of a board at a divider, js/
   fastenerreach.js) has its head on a face of the board it goes through, and is seen from outside that face, not
   from along the screw: the screws angled up from the underside of a bookshelf's Bottom into a divider point
   mostly sideways, yet their heads are on the underside, hidden by the toe kick and the floor. Returns that
   face's outward direction, or null for a screw driven square to its face (whose face is the way it points
   back) and for a board set at an angle. */
function slantedHeadFace(f,at){
  const square=f.dir.filter(v=>Math.abs(v)>1e-6).length===1;
  if(square||!f.through||tilted(f.through))return null;
  const b=plainBox(f.through);
  let best=null,nearest=.05;   // the face the head lies on, within 1/20"
  for(let k=0;k<3;k++){
    for(const side of[-1,1]){
      const gap=Math.abs(at[k]-(side>0?b.hi[k]:b.lo[k]));
      // the face the screw goes in through: the screw points into the wood from it
      if(gap<nearest&&f.dir[k]*side<0){nearest=gap;best=[0,1,2].map(axis=>axis===k?side:0);}
    }
  }
  return best;
}
/* the face a head is on, by the way it faces */
function faceOfHead(out){
  const axis=[0,1,2].reduce((best,k)=>Math.abs(out[k])>Math.abs(out[best])?k:best,0);
  if(axis===1)return out[1]>0?'top':'under';
  if(axis===2)return out[2]>0?'front':'back';
  return'side';
}
function headShows(head,wood){
  const length=Math.hypot(...head.out)||1,way=head.out.map(v=>v/length);
  const from=pointPlus(head.at,way,.06);   // just off the face, so the piece the head is in does not count
  return!wood.some(b=>rayHitsBox(from,way,b));
}
function showingHeads(){
  // what covers a head: wood, and what lies on it (a mattress over the slats of a bed)
  const wood=S.parts.filter(p=>!tilted(p)).map(plainBox);
  return fastenerHeads().filter(head=>!head.covered&&headShows(head,wood)).map(head=>({...head,face:faceOfHead(head.out)}));
}
/* The heads (and open pocket holes) that a person standing in front sees on a show face: the top, the front and
   the sides (SHOW_FACES), where nothing covers them; and, higher than SEEN.underAbove, one on an underside or on a
   face under a shelf, seen from below (rule 13 in js/fasteners.js). A top face as high as SEEN.topFrom is above
   the eye: what is on it is not seen. Covered heads (plugged) are left out. */
function headsOnShowFaces(){
  const wood=S.parts.filter(p=>!tilted(p)).map(plainBox);
  return fastenerHeads().filter(head=>!head.covered).map(head=>({...head,face:faceOfHead(head.out)})).filter(head=>{
    if(head.face==='top'&&head.at[1]>=SEEN.topFrom-1e-6)return false;
    if(SHOW_FACES.faces.includes(head.face)&&headShows(head,wood))return true;
    return seenFromBelow(head.at,head.out);
  });
}
/* Screw and nail heads on the floor of an open shelf: a face that looks up, below the eye (SEEN.topFrom), with
   nothing between it and the front of the design. Looking straight up from such a head meets the board above it
   (a drawer, a shelf), so showingHeads counts it as hidden, but a person in front of the piece looks into the
   opening and sees it (the screws down through the bottom panel of a drawer nightstand into its toe kick, on the
   floor of the open shelf under the drawers). Pocket holes are left out: rule 13 in js/fasteners.js puts those of
   a high shelf on its top face, under the books, on purpose. */
function headsOnAnOpenFloor(){
  const wood=S.parts.filter(p=>!isProp(p)&&!tilted(p)).map(plainBox),forward=[0,0,1];
  return fastenerHeads().filter(head=>!head.covered&&head.f.kind!=='pocket'&&faceOfHead(head.out)==='top'&&head.at[1]<SEEN.topFrom)
    .filter(head=>{
      const from=pointPlus(head.at,[0,1,0],.06);   // just above the face, so the board the head is in does not count
      return!wood.some(b=>rayHitsBox(from,forward,b));
    });
}
/* the heads that would show but are sunk and plugged: where the notes say heads are covered */
function coveredHeads(){
  const wood=S.parts.filter(p=>!tilted(p)).map(plainBox);
  return fastenerHeads().filter(head=>head.covered&&headShows(head,wood)).map(head=>({...head,face:faceOfHead(head.out)}));
}
/* The pieces that make the top surface of a design (their top faces are the highest), and how high that is. */
function topSurface(){
  const wood=S.parts.filter(p=>!isProp(p)&&!tilted(p));
  const y=Math.max(...wood.map(p=>plainBox(p).hi[1]));
  return{y,pieces:wood.filter(p=>Math.abs(plainBox(p).hi[1]-y)<.02)};
}
/* The fasteners whose point comes nearer than it should to the top surface: at least 1/4" of wood over the point
   in a top 3/4" thick or more (POCKET_COVER), never less than 1/8" (POCKET_COVER_MIN). [{f, cover}] */
function pointsNearTheTop(){
  const top=topSurface(),inTop=new Set(top.pieces),near=[];
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link)){
      if(f.kind==='bracket'){
        for(const screw of f.screws){
          const point=pointPlus(screw.pos,screw.dir,screw.len);
          const piece=[f.through,f.into].find(p=>inTop.has(p)&&insideBox(point,p));
          if(piece)checkCover(f,point,piece);
        }
        continue;
      }
      if(!inTop.has(f.into)&&!inTop.has(f.through))continue;
      const point=pointPlus(f.pos,f.dir,f.len),piece=inTop.has(f.into)?f.into:f.through;
      if(f.dir[1]>.5)checkCover(f,point,piece);   // driven up into the top from below
    }
  }
  function checkCover(f,point,piece){
    const cover=plainBox(piece).hi[1]-point[1],wanted=piece.t>=.75-1e-6?POCKET_COVER:POCKET_COVER_MIN;
    if(cover<wanted-.005)near.push({f,cover});
  }
  return near;
}
/* The boards of a plank top, a seat or a lower shelf (each one is a board of its own, not glued to the next) that
   have no fastener in the outer third of their length (on a board under 30" long, within 10" of the end: there
   the holes that hold the aprons to the legs leave the end of an apron free of holes) at one end or the other:
   such a board can lift and cup at that end, like the middle seat board of a bench held only at its middle.
   [pieces] */
const BOARDS_HELD_AT_BOTH_ENDS=['Top board','Seat board','Shelf slat'];
const BOARD_END_REACH=10;
function boardsNotHeldAtBothEnds(){
  const along=new Map();
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link)){
      for(const piece of[f.through,f.into]){
        if(!BOARDS_HELD_AT_BOTH_ENDS.includes(piece.name))continue;
        if(!along.has(piece))along.set(piece,[]);
        const end=pointPlus(f.pos,f.dir,f.len);
        along.get(piece).push((f.pos[piece.ax[0]]+end[piece.ax[0]])/2);
      }
    }
  }
  return S.parts.filter(piece=>BOARDS_HELD_AT_BOTH_ENDS.includes(piece.name)).filter(piece=>{
    const spots=along.get(piece)||[],lo=plainBox(piece).lo[piece.ax[0]],third=Math.max(piece.l/3,Math.min(BOARD_END_REACH,piece.l/2));
    return!spots.some(at=>at<=lo+third)||!spots.some(at=>at>=lo+piece.l-third);
  });
}
const insideBox=(point,piece)=>{const b=plainBox(piece);return[0,1,2].every(k=>point[k]>=b.lo[k]-.03&&point[k]<=b.hi[k]+.03);};

/* ---------- self-checks ---------- */
/* Runs fn without drawing the screen after each change (the checks below place a few hundred designs; drawing
   each one would take most of their time). The design is drawn again by whoever runs the checks. */
function withoutDrawing(fn){
  const draw=renderAll,fit0=fit;
  renderAll=()=>{};fit=()=>{};
  try{return fn();}finally{renderAll=draw;fit=fit0;}
}
/* Places a preset the way Create does (with the gate that refuses or asks out of the way) in this style. */
function placeInStyle(preset,vals,style){
  const parts=preset.build(vals);
  if(!parts.length)return false;
  placePreset(preset,vals,parts,false);
  look().style=style;
  commit();
  return true;
}
/* the sizes a preset is tried at: its defaults, and each number at its smallest and at its largest */
function sizesToTry(preset){
  const usual=presetDefaults(preset),list=[{vals:usual,where:'default size'}];
  for(const q of preset.params){
    if(!q.k||q.opts||q.check||q.min===undefined||q.max===undefined)continue;
    if(q.show&&!q.show(usual))continue;   // a row the form hides with the usual choices (the Bookshelf's openings)
    list.push({vals:{...usual,[q.k]:q.min},where:`${q.label} ${q.min}`},{vals:{...usual,[q.k]:q.max},where:`${q.label} ${q.max}`});
  }
  return list;
}
/* For every preset of house furniture, at its usual size and at the smallest and largest of each number, in
   Everyday and in Fine furniture: no fastener head can be seen on the top surface or on the front, and no point
   comes through the top. In all three styles no fastener pokes out of its wood (fastenerProblem). Rustic: the
   table tops are screwed down from above. The Workbench keeps its screws through the top in Everyday. */
SELFTESTS.push(function showFacesOfHouseFurniture(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('show faces: '+text);};
  const seen=new Set(),once=(key,text)=>{if(!seen.has(key)){seen.add(key);wrong(text);}};
  for(const name of HOUSE_FURNITURE){
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(!preset){wrong(`${name}: the preset is missing`);continue;}
    for(const{vals,where}of sizesToTry(preset)){
      if(preset.check&&(preset.check(vals)||[]).some(f=>f.level==='stop'))continue;   // refused at this size: nothing is built
      for(const style of Object.keys(STYLES)){
        if(!placeInStyle(preset,vals,style))continue;
        const at=`${name} (${where}, ${STYLES[style][0]})`;
        for(const link of connGraph().links){
          for(const f of fastenersOfLink(link)){
            const problem=fastenerProblem(f);
            if(problem){once(name+style+'problem',`${at}: ${f.through.name} into ${f.into.name}: ${problem}`);break;}
          }
        }
        if(!SHOW_FACES.styles.includes(style))continue;
        const showing=headsOnShowFaces().filter(head=>!showFaceAllowed(name,style,head));
        if(showing.length)once(name+style+'face',`${at}: ${showing.length} fastener heads show on the ${showing[0].face} (${showing[0].f.label}, ${showing[0].f.through.name} into ${showing[0].f.into.name})`);
        const onFloor=headsOnAnOpenFloor().filter(head=>!showFaceAllowed(name,style,head));
        if(onFloor.length)once(name+style+'floor',`${at}: ${onFloor.length} fastener heads show on the floor of an open shelf, seen from the front (${onFloor[0].f.label}, ${onFloor[0].f.through.name} into ${onFloor[0].f.into.name})`);
        const near=pointsNearTheTop();
        if(near.length)once(name+style+'cover',`${at}: ${near.length} fasteners end only ${fmt(Math.max(0,near[0].cover))} under the top surface (${near[0].f.label}, ${near[0].f.through.name} into ${near[0].f.into.name})`);
        // no two screws, pocket holes or deep holes for heads run into each other (the holes for a top against
        // the holes that hold an apron to its legs: rule 11 in js/fasteners.js; drilledStretches)
        const met=screwsThatMeet();
        if(met.length)once(name+style+'meet',`${at}: ${met.length} pairs of fasteners or their holes run into each other (${met[0].a.through.name} into ${met[0].a.into.name}, and ${met[0].b.through.name} into ${met[0].b.into.name})`);
        const loose=boardsNotHeldAtBothEnds();
        if(loose.length)once(name+style+'ends',`${at}: a ${loose[0].name} is not held near both of its ends`);
      }
    }
  }
  // Rustic / rough: the table tops are screwed down from above, heads showing; and back to Everyday gives the
  // same fasteners as before (switching the style and back changes nothing)
  for(const name of Object.keys(TABLE_KINDS)){
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(!preset)continue;
    const vals=presetDefaults(preset);
    placeInStyle(preset,vals,'std');
    const before=fastenerSummary();
    const onTopEveryday=showingHeads().filter(head=>head.face==='top').length;
    look().style='rustic';commit();
    const onTopRustic=showingHeads().filter(head=>head.face==='top').length;
    if(!onTopRustic)wrong(`${name}: in Rustic / rough the top is not screwed down from above`);
    look().style='fine';commit();
    look().style='std';commit();
    if(fastenerSummary()!==before)wrong(`${name}: switching the style to Rustic, to Fine and back to Everyday does not give the same fasteners`);
    if(TABLE_KINDS[name].shop&&!onTopEveryday)wrong(`${name}: a shop bench keeps its screws through the top in Everyday, and this one has none`);
  }
});});
/* every fastener of the design in one line of text, to compare two states */
function fastenerSummary(){
  return connGraph().links.filter(link=>link.joint).map(link=>link.key+':'+link.type+':'+fastenersOfLink(link).map(f=>f.label+'@'+f.pos.map(v=>v.toFixed(2)).join(',')).join(';')).sort().join('|');
}
/* The count on every list agrees: for each house preset in each style, the fasteners laid out equal what jSpec
   says, and the shopping list carries the same number of each. */
SELFTESTS.push(function showFacesCountsAgree(problems){withoutDrawing(()=>{
  for(const name of HOUSE_FURNITURE.concat(['Workbench'])){
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(!preset)continue;
    for(const style of Object.keys(STYLES)){
      placeInStyle(preset,presetDefaults(preset),style);
      const counted=new Map();
      for(const link of connGraph().links){
        if(!link.joint||!link.fastened)continue;
        const spec=jSpec(link.joint,link.type),laid=fastenersOfLink(link);
        if(laid.length!==spec.n){problems.push(`show faces: ${name} (${STYLES[style][0]}): ${link.joint.a.name} to ${link.joint.b.name} is laid out with ${laid.length} but listed with ${spec.n}`);break;}
        for(const[label,count]of spec.hw)counted.set(label,(counted.get(label)||0)+count);
      }
      const list=new Map(hardwareTotals(findJoints()).rows);
      for(const[label,count]of counted){
        if((list.get(label)||0)<count)problems.push(`show faces: ${name} (${STYLES[style][0]}): the shopping list has ${list.get(label)||0} of "${label}", the joints take ${count}`);
        if(typeof hardwareFamily==='function'&&!hardwareFamily(label))problems.push(`show faces: "${label}" has no price`);
      }
    }
  }
});});
/* The preset rule in every style: selfTest's structural list (selfTestStructure, js/selftest.js) checks every
   preset in the Everyday style. The fasteners of a design change with the style (a top that only rests on the
   legs in Everyday is screwed into them in Rustic; pocket holes in Fine), so every preset is checked the same
   way in Rustic / rough and in Fine furniture too: at its defaults, with each number at its smallest and its
   largest, and with each of its variants. A top held by screws from below rests on the frame that carries it;
   the check counts it as carried by that frame, whatever holds it down. */
SELFTESTS.push(function structuralInEveryStyle(problems){
  for(const style of Object.keys(STYLES)){
    if(style==='std')continue;   // selfTestStructure checks that one
    const label=STYLES[style][0];
    const run=(preset,where,vals,mayRefuse)=>{
      let check;
      try{check=checkPreset(preset,vals,null,{style});}
      catch(e){problems.push(`structural (${label}): ${preset.name} at ${where}: error: ${e.message}`);return;}
      if(check.refused){
        if(!mayRefuse)problems.push(`structural (${label}): ${preset.name} refuses its own default sizes`);
        return;
      }
      for(const f of check.problems)problems.push(`structural (${label}): ${preset.name} at ${where}: ${f.level} ${f.code}: ${f.text}`);
    };
    for(const preset of PRESETS){
      const defaults=presetDefaults(preset);
      for(const variant of[{},...(preset.variants||[])]){
        const base={...defaults,...variant},isDefault=!Object.keys(variant).length;
        run(preset,isDefault?'default sizes':'a variant',base,!isDefault);
        for(const q of preset.params){
          if(!q.k||q.opts||q.check)continue;
          for(const limit of[q.min,q.max])if(limit!==undefined)run(preset,`${q.k} = ${limit}`,{...base,[q.k]:limit},true);
        }
      }
    }
  }
});

/* Self-check: the corners of a bed are held by more than a corner brace. The head and foot rails take the racking
   each time someone sits on the end of the bed, so in Everyday and Fine furniture each leg (and each center leg
   that stands against an end rail) is screwed to its end rail with at least two wood screws, driven from the inside
   face of the leg (screwSide in js/fasteners.js), heads hidden; Rustic / rough screws through the end rail. At the
   usual size and at the smallest and largest. */
SELFTESTS.push(function bedCornersScrewedFromInside(problems){withoutDrawing(()=>{
  const wrong=text=>problems.push('bed corners: '+text);
  const bed=PRESETS.find(preset=>preset.name==='Platform bed');
  if(!bed){wrong('the Platform bed is missing');return;}
  for(const{vals,where}of sizesToTry(bed)){
    if(bed.check&&(bed.check(vals)||[]).some(f=>f.level==='stop'))continue;
    for(const style of Object.keys(STYLES)){
      placeInStyle(bed,vals,style);
      const at=`Platform bed (${where}, ${STYLES[style][0]})`;
      const corners=connGraph().links.filter(link=>link.joint&&[link.a.name,link.b.name].includes('End rail')&&/^(Leg|Center leg)$/.test(link.a.name==='End rail'?link.b.name:link.a.name));
      if(!corners.length){wrong(`${at}: no leg touches an end rail`);return;}
      for(const link of corners){
        const layout=fastenersOfLink(link),leg=link.a.name==='End rail'?link.b:link.a;
        const throughLeg=layout.every(f=>f.through===leg);
        if(link.type!=='screw'||layout.length<2||layout.some(f=>f.kind!=='screw')){wrong(`${at}: a ${leg.name} is held to the end rail by ${layout.length} ${link.type}, not two screws or more`);return;}
        if(style==='rustic'?throughLeg:!throughLeg){wrong(`${at}: the screws between a ${leg.name} and the end rail go through the ${style==='rustic'?'leg (Rustic screws through the end rail)':'end rail, a show face'}`);return;}
      }
    }
  }
});});
