/* NominalCAD: does every screw hold? The self-check of rule 12 in js/fasteners.js (a screw bites deep enough into
   the piece that receives it: 3/4" into side grain, 1 1/4" into end grain, 1 1/2" for a structural screw, less only
   where the receiving piece is too thin), and of the wood left under every screw head.

     screwBite(f, link)       {bite, wanted, endGrain}: how deep this screw really goes into the piece that
                              receives it, measured along the screw inside that piece, and what rule 12 wants
     weakScrews()             the screws of the design as it is now that bite less than rule 12 wants, or that
                              have less than HEAD_WOOD of wood under their head: [{f, link, why}]
     fastenerSweep(styles)    (for working on presets, not a self-check) every preset at its default, smallest
                              and largest sizes in the styles given: screws that bite too little, fasteners that
                              poke out of the wood, heads on too little wood, and fasteners that run into each
                              other inside the wood (screwsThatMeet). Returns a list of lines. Run it from the
                              console: fastenerSweep(['rustic','std','fine']). The check that fasteners keep a
                              drill bit apart belongs to js/fastenerroom.js, not here.

   Which screws are held to the rule: wood screws, plugged screws and structural screws driven straight through
   one piece into another (kind 'screw', not at an angle, not the long screws of a wall plate that go on into the
   framing). Pocket screws follow the jig's chart (rule 5), brads are held by the glue, and the short screws of a
   bracket are sized for the bracket (bracketScrew, js/style.js). */
'use strict';

const HEAD_WOOD=.375;   // the least wood under a screw head, so the head cannot pull through (3/8")

/* the length of the stretch of a screw that lies inside a piece */
function lengthInside(f,piece){
  const b=plainBox(piece);
  let from=0,to=f.len;
  for(let k=0;k<3;k++){
    const way=f.dir[k],at=f.pos[k];
    if(Math.abs(way)<1e-9){
      if(at<b.lo[k]-1e-6||at>b.hi[k]+1e-6)return 0;
      continue;
    }
    let enter=(b.lo[k]-at)/way,leave=(b.hi[k]-at)/way;
    if(enter>leave)[enter,leave]=[leave,enter];
    from=Math.max(from,enter);
    to=Math.min(to,leave);
  }
  return Math.max(0,to-from);
}
/* Is this fastener one that rule 12 holds to its bite? */
const heldToBite=(f,link)=>f.kind==='screw'&&!f.toe&&!(f.also&&f.also.length)&&(link.type==='screw'||link.type==='plug');
function screwBite(f,link){
  const j=link.joint,endGrain=(f.into===j.a?j.fa:j.fb)==='end';
  const depthInto=f.into===j.a?j.da:j.db;
  const wanted=f.structural?SCREW_BITE.structuralEnd:biteWanted(depthInto,endGrain);
  return{bite:lengthInside(f,f.into),wanted,endGrain};
}
function weakScrews(){
  const weak=[];
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link)){
      if(!heldToBite(f,link))continue;
      const{bite,wanted,endGrain}=screwBite(f,link);
      if(bite<wanted-.02)weak.push({f,link,why:`bites only ${fmt(r16(bite))} into the ${endGrain?'end':'side'} of the ${f.into.name}, where rule 12 wants ${fmt(r16(wanted))}`});
      const under=lengthInside(f,f.through);   // the wood the screw passes through, under its head
      if(under<HEAD_WOOD-.02)weak.push({f,link,why:`has only ${fmt(r16(under))} of the ${f.through.name} under its head, too little to hold it`});
    }
  }
  return weak;
}

/* For working on presets: everything that can be wrong with a fastener, over every preset, its sizes and the
   styles given. Not run by selfTest (it takes a while); the parts of it that are rules are self-checks. */
function fastenerSweep(styles){
  const lines=[];
  withoutDrawing(()=>{
    for(const preset of PRESETS){
      for(const{vals,where}of sizesToTry(preset)){
        if(preset.check&&(preset.check(vals)||[]).some(f=>f.level==='stop'))continue;
        for(const style of styles||Object.keys(STYLES)){
          if(!placeInStyle(preset,vals,style))continue;
          const at=`${preset.name} (${where}, ${STYLES[style][0]})`,seen=new Set();
          const say=text=>{if(!seen.has(text)){seen.add(text);lines.push(`${at}: ${text}`);}};
          for(const weak of weakScrews())say(`${weak.f.through.name} into ${weak.f.into.name} (${weak.f.label}) ${weak.why}`);
          for(const link of connGraph().links){
            for(const f of fastenersOfLink(link)){
              const problem=fastenerProblem(f);
              if(problem)say(`${f.through.name} into ${f.into.name} (${f.label}): ${problem}`);
            }
          }
          const met=screwsThatMeet();
          if(met.length)say(`${met.length} pairs run into each other (${met[0].a.through.name} into ${met[0].a.into.name}, and ${met[0].b.through.name} into ${met[0].b.into.name})`);
        }
      }
    }
  });
  return lines;
}

/* Self-check: rule 12 over every preset in every style, at its default sizes and with each number at its smallest
   and its largest: every screw bites as deep as the rule wants into the piece that receives it, and has enough
   wood under its head. Then the rule itself on a few joints made by hand: a 3/4" side into the end of a 3/4"
   shelf takes 2" screws, a 4x4 leg into the end of a 2x4 apron takes 1/4" × 5" structural screws, a 4x4 into the
   edge of a 2x4 is counterbored, and a plugged screw sits under its plug. */
SELFTESTS.push(function screwsBiteDeepEnough(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('screw bite: '+text);};
  const seen=new Set();
  for(const preset of PRESETS){
    for(const{vals,where}of sizesToTry(preset)){
      if(preset.check&&(preset.check(vals)||[]).some(f=>f.level==='stop'))continue;
      for(const style of Object.keys(STYLES)){
        if(!placeInStyle(preset,vals,style))continue;
        for(const weak of weakScrews()){
          const key=preset.name+style+weak.f.through.name+weak.f.into.name;
          if(seen.has(key))continue;
          seen.add(key);
          wrong(`${preset.name} (${where}, ${STYLES[style][0]}): ${weak.f.through.name} into ${weak.f.into.name} (${weak.f.label}) ${weak.why}`);
        }
      }
    }
  }
  // the rule on joints made by hand
  load(JSON.stringify(blank()),true);
  const ids=addParts([
    mk('Side','1x10',[.75,30,9.25],[0,0,0]),mk('Shelf','1x10',[20,.75,9.25],[.75,10,0]),        // a side into the end of a shelf
    mk('Leg','4x4',[3.5,28,3.5],[40,0,0]),mk('Apron','2x4',[20,3.5,1.5],[43.5,24,0]),           // a 4x4 leg into the end of an apron
    mk('Post','4x4',[3.5,28,3.5],[80,0,0]),mk('Rail','2x4',[3.5,1.5,20],[83.5,10,0])]);         // a 4x4 into the edge of a 2x4
  commit();
  const pieces=ids.map(byId),joint=(a,b)=>jointBetween(pieces[a],pieces[b]);
  const shelf=jSpec(joint(0,1),'screw'),leg=jSpec(joint(2,3),'screw'),post=fastenerLayout(joint(4,5),'screw');
  if(!/2"/.test(shelf.text))wrong(`a 3/4" side into the end of a 3/4" shelf must take 2" screws, and takes "${shelf.text}"`);
  if(!/1\/4" × 5" structural screws/.test(leg.text))wrong(`a 4x4 leg into the end of a 2x4 apron must take 1/4" × 5" structural screws, and takes "${leg.text}"`);
  if(!post.length||!post.every(f=>f.sunk>0&&lengthInside(f,f.into)>=SCREW_BITE.side-.02))wrong('a 4x4 screwed into the edge of a 2x4 must be counterbored so that its screws bite 3/4"');
  const plugged=fastenerLayout(joint(0,1),'plug');
  if(!plugged.length||!plugged.every(f=>f.plug&&Math.abs(f.sunk-PLUG_DEPTH)<.01&&lengthInside(f,f.into)>=SCREW_BITE.end-.02))wrong('a plugged screw must sit 3/8" deep under its plug and still bite 1 1/4" into the end of the shelf');
  if(weakScrews().length)wrong('the joints made by hand have weak screws: '+weakScrews()[0].why);
});});

/* Self-check: a plugged head says the depth it is really sunk, everywhere. The Sturdy bench in Everyday, with the
   four joints between a leg and a short apron changed to "Screws, heads plugged" as its notes tell the builder to:
   through the 4x4 leg the head goes 1 1/4" deep (sunkDepth), deeper than a 3/8" plug is long, so the fastener's
   words (jSpec, shown in Properties), the step, the tip in the 3D view and the shopping list all speak of that
   depth and of lengths of dowel rod (with a price), and none of 3/8" plugs. The notes say the same depth. And with
   a painted finish the holes are still filled with dowel, and the step's tools keep the hammer that taps it in. */
SELFTESTS.push(function pluggedHeadsSayTheirDepth(problems){withoutDrawing(()=>{
  const wrong=text=>problems.push('plugged heads: '+text);
  const bench=PRESETS.find(preset=>preset.name==='Sturdy bench');
  if(!bench){wrong('the Sturdy bench is missing');return;}
  for(const finish of['clear','white']){
    placeInStyle(bench,presetDefaults(bench),'std');
    look().finish=finish;
    const ends=findJoints().filter(j=>[j.a.name,j.b.name].sort().join('|')==='Leg|Short apron');
    if(ends.length!==4){wrong(`the Sturdy bench has ${ends.length} joints between a leg and a short apron, not 4`);return;}
    for(const j of ends)S.joints[j.key]='plug';
    commit();
    const at=`Sturdy bench (Everyday, ${finish})`;
    for(const j of ends){
      const spec=jSpec(j,'plug'),layout=fastenerLayout(j,'plug');
      const sunk=layout.length?layout[0].sunk:0,said=fmt(sunk);
      if(!layout.length||layout.some(f=>!f.plug||Math.abs(f.sunk-sunk)>.01)){wrong(`${at}: the plugged screws are not all sunk alike under a plug`);break;}
      if(!plugIsDowel(sunk))wrong(`${at}: through a 4x4 leg into the end of an apron the head should go deeper than a plug is long, and goes ${said}`);
      if(!spec.text.includes(`sunk ${said} deep`)||/sunk 3\/8"/.test(spec.text))wrong(`${at}: the fastener's words do not give the depth the head is sunk (${said}): "${spec.text}"`);
      if(!spec.hw.some(([label])=>label===DOWEL_ROD_LABEL)||spec.hw.some(([label])=>label===PLUG_LABEL))wrong(`${at}: a head ${said} deep must be covered with dowel rod, not 3/8" plugs: ${JSON.stringify(spec.hw)}`);
      if(!layout[0].tip.includes(`${said} deep`))wrong(`${at}: the tip in the 3D view does not give the depth: ${layout[0].tip}`);
    }
    const rows=hardwareTotals(findJoints()).rows;
    if(rows.some(([label])=>label===PLUG_LABEL))wrong(`${at}: the shopping list still buys 3/8" wood plugs`);
    if(!rows.some(([label])=>label===DOWEL_ROD_LABEL)||(typeof hardwareFamily==='function'&&!hardwareFamily(DOWEL_ROD_LABEL)))wrong(`${at}: the shopping list has no dowel rod, or it has no price`);
    const steps=buildPlan(true).steps,step=steps.find(candidate=>candidate.groups.some(group=>group.type==='plug'));
    if(!step)wrong(`${at}: no step drives the plugged screws`);
    else{
      // (or, with the counterbores drilled in step 2 "Drill your pieces" (js/drillplan.js), the depth they were drilled to)
      if(!/drill a 3\/8" hole 1 1\/4" deep|3\/8" counterbores drilled in step \d+, 1 1\/4" deep/.test(step.words+step.groups.map(group=>group.line).join(' '))||!/dowel rod/.test(step.groups.map(group=>group.line).join(' ')))wrong(`${at}: the step does not say to drill 1 1/4" deep and fill the hole with dowel rod`);
      if(/tap in a 3\/8" wooden plug/.test(step.groups.map(group=>group.line).join(' ')))wrong(`${at}: the step still taps a 3/8" plug into a hole 1 1/4" deep`);
      if(!step.need.tools.some(tool=>/hammer/.test(tool)))wrong(`${at}: the step's tools have no hammer for tapping the dowel in`);
    }
    const finishing=steps.find(candidate=>candidate.kind==='finish');
    if(!finishing||!/piece of dowel|pieces of dowel/.test(finishing.words)||!finishing.need.tools.some(tool=>/flush-cut saw/.test(tool)))wrong(`${at}: the finishing step does not say to saw the dowels flush, or lists no flush-cut saw`);
  }
  // the notes say the depth the layout drills
  if(!/1 1\/4" deep in the leg under a glued length of 3\/8" dowel rod/.test(headsNote('Sturdy bench')[0]))wrong('the notes of the Sturdy bench do not say how deep the plugged heads go');
});});

/* Self-check: the words and tools of a step fit its screws. For every preset of furniture for the house and the
   Workbench, at its usual size, in every style, and with a clear and a painted finish: a step whose screws are
   all structural screws (driven with no pilot hole) does not tell the builder to drill pilot holes and does not
   list a pilot-hole or countersink bit; a step whose plugged heads are only filled (under paint, 3/8" deep) lists
   no hammer for tapping plugs in. */
SELFTESTS.push(function stepToolsFitTheirScrews(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('step tools: '+text);};
  const seen=new Set(),once=(key,text)=>{if(!seen.has(key)){seen.add(key);wrong(text);}};
  for(const name of HOUSE_FURNITURE.concat(['Workbench'])){
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(!preset)continue;
    for(const style of Object.keys(STYLES))for(const finish of['clear','white']){
      placeInStyle(preset,presetDefaults(preset),style);
      look().finish=finish;commit();
      const at=`${name} (${STYLES[style][0]}, ${finish})`;
      for(const step of buildPlan(true).steps){
        const screws=step.groups.filter(group=>group.type==='screw'||group.type==='plug');
        const structural=screws.length&&screws.every(group=>[...group.hardware.keys()].some(label=>/structural screws/.test(label)));
        if(structural&&(/drill pilot holes/i.test(step.words)||step.need.tools.some(tool=>/pilot-hole bit|countersink/.test(tool))))
          once(name+style+'pilot',`${at}: step ${step.no} drives only structural screws but tells the builder to drill pilot holes or lists the bits for them`);
        const plugs=step.groups.filter(group=>group.type==='plug');
        const tapped=finish!=='white'||plugs.some(group=>group.links.some(link=>jSpec(link.joint,'plug').deep));
        if(plugs.length&&!tapped&&step.need.tools.some(tool=>/hammer/.test(tool)))once(name+style+'hammer',`${at}: step ${step.no} fills its counterbores with filler but lists a hammer for plugs`);
      }
    }
  }
});});

/* Self-check: a pocket screw through a thin deck (an upright of a fish rack standing on the 1/2" plywood of the frame
   under it, pocketJigFor in js/fasteners.js) ends in the framing under the deck with the bite rule 12 asks for:
   3/4" into the side grain of the rail or cross piece, measured along the screw. Pocket screws are otherwise held
   to the jig's chart, not to rule 12; this joint is the one where the chart's screw would end too shallow. The rack
   as the form starts, with its tanks long side out, as sections, on a cabinet base, the Cabinet stand, in every
   style. The shopping list buys the length that is drawn. */
SELFTESTS.push(function pocketScrewsThroughADeckBite(problems){withoutDrawing(()=>{
  const wrong=text=>{if(problems.length<80)problems.push('pocket screws through a deck: '+text);};
  const rack=PRESETS.find(preset=>preset.name==='Fish tank wall / rack'),cabinet=PRESETS.find(preset=>preset.name==='Cabinet stand with a row of tanks');
  if(!rack||!cabinet){wrong('a fish preset is missing');return;}
  const cases=[[rack,{}],[rack,{orient:'long'}],[rack,{build:'sections'}],[rack,{orient:'long',base:'cabinet',brace:false}],[cabinet,{}]];
  let seen=0;
  for(const[preset,changes]of cases){
    for(const style of Object.keys(STYLES)){
      if(!placeInStyle(preset,{...presetDefaults(preset),...changes},style))continue;
      const at=`${preset.name} ${JSON.stringify(changes)} (${STYLES[style][0]})`;
      for(const link of connGraph().links){
        if(!link.joint||!link.fastened||link.type!=='pocket')continue;
        const list=fastenersOfLink(link).filter(f=>f.kind==='pocket'&&f.also&&f.also.length);
        if(!list.length)continue;
        seen++;
        const bite=Math.min(...list.map(f=>lengthInside(f,f.also[0])));
        if(bite<SCREW_BITE.side-.02)wrong(`${at}: ${list[0].through.name} through ${list[0].into.name} goes only ${fmt(r16(bite))} into the ${list[0].also[0].name}, where rule 12 wants ${fmt(SCREW_BITE.side)}`);
        const spec=jSpec(link.joint,'pocket');
        const bought=spec.hw.find(([label])=>/pocket-hole screws/.test(label));
        if(!bought||Math.abs(sizesInLabel(bought[0])[0]-list[0].len)>.01)wrong(`${at}: the list buys "${bought?bought[0]:'nothing'}" for the ${fmt(list[0].len)} pocket screws drawn`);
      }
    }
  }
  if(!seen)wrong('no pocket screw through a deck was found, so this check proves nothing');
});});
