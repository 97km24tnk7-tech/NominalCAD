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
/* the faces a head may never show on, in those presets, in these styles */
const SHOW_FACES={styles:['std','fine'],faces:['top','front']};

/* every head of the fasteners of these connections (all of the design when none are given) */
function fastenerHeads(links){
  const heads=[];
  for(const link of links||connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link)){
      if(f.kind==='dowel')continue;                      // a dowel is inside the joint: nothing shows
      if(f.kind==='pocket'){heads.push({f,link,at:f.pocket.mouth,out:f.pocket.out});continue;}
      if(f.kind==='bracket'){
        for(const screw of f.screws)heads.push({f,link,at:screw.pos,out:screw.dir.map(v=>-v)});
        continue;
      }
      heads.push({f,link,at:f.pos,out:f.dir.map(v=>-v)});
    }
  }
  return heads;
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
  return fastenerHeads().filter(head=>headShows(head,wood)).map(head=>({...head,face:faceOfHead(head.out)}));
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
        const showing=showingHeads().filter(head=>SHOW_FACES.faces.includes(head.face));
        if(showing.length)once(name+style+'face',`${at}: ${showing.length} fastener heads show on the ${showing[0].face} (${showing[0].f.label}, ${showing[0].f.through.name} into ${showing[0].f.into.name})`);
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
