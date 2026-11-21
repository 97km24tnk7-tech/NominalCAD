/* NominalCAD: the special screw of a pocket hole, bought and named as what it is.

   The owner, 20 Nov: "pocket holes use a special screw so they are hidden, make sure thats included". A pocket-hole
   screw (reference sheet 27, section 10) has a head that is flat underneath, a self-drilling tip and a smooth shank
   under the head; it is coarse thread for pine, fir, cedar and plywood, fine thread for a hard wood, the coated
   exterior kind for cedar and treated lumber, and it is driven with the long #2 square bit that comes with the jig.
   The words and the lists come from js/style.js (pocketScrewLabel, POCKET_SCREW_LINE, POCKET_SCREW_BIT); the step
   lines from js/buildsteps.js (FASTENER_LABELS, STEP_TOOLS); the tools list from js/plans.js; the prices from
   js/prices.js (a row of its own for each length, the exterior ones apart).

     pocketScrewFaults(label)   what is wrong with how the design as it is now buys and names its pocket-hole
                                screws and plugs: a list of sentences

   Self-checks: pocketScrewsBoughtAsTheirOwn (every preset with each of its choices, in each style, and the presets in
   oak and in cedar) and pocketScrewRuleCanFail. */
'use strict';
/* The kinds of pocket-hole screw the model drives, counted: Map 'length|thread|exterior' -> count. Also the number of
   pocket holes filled with plugs. */
/* The thread and the coating the model's screw should be bought in, said here again from sheet 27 (section 10) rather
   than read from pocketScrewThread, so the check does not compare the rule with itself (the code reader's finding 20):
   fine thread where the thread holds in a board of a hard wood, coarse in plywood and soft woods, and only in a
   thread a store sells at that length (POCKET_FINE_SOLD, POCKET_COARSE_SOLD); exterior where the wood is cedar or
   treated, where the design is an outdoor preset, or where any piece is pressure-treated. */
function pocketScrewWanted(f){
  const size=pocketScrewSize(f.len),holdsIn=f.also&&f.also[0]?f.also[0]:f.into;   // (through a thin deck: the framing under it)
  const hard=WOODS[look().wood]&&WOODS[look().wood][3]===1,board=M[holdsIn.mat]&&M[holdsIn.mat].kind!=='sheet';
  let thread=hard&&board?'fine':'coarse';
  if(thread==='fine'&&!POCKET_FINE_SOLD.includes(size))thread='coarse';
  if(thread==='coarse'&&!POCKET_COARSE_SOLD.includes(size))thread='fine';
  const outdoors=(PRESET_GROUPS.find(group=>group[0]==='Outdoors')||[,[]])[1];
  const exterior=look().wood==='cedar'||look().wood==='pt'||Object.values(S.sets||{}).some(set=>set&&outdoors.includes(set.name))||
    S.parts.some(p=>M[p.mat]&&M[p.mat].treated);
  return{size,thread,exterior};
}
function pocketScrewsInModel(){
  const kinds=new Map(),screws=[];
  let plugged=0;
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened||link.type!=='pocket')continue;
    for(const f of fastenersOfLink(link)){
      if(f.kind!=='pocket')continue;
      const want=pocketScrewWanted(f);
      const key=`${fmt(f.len)}|${want.thread}|${want.exterior?'exterior':''}`;
      kinds.set(key,(kinds.get(key)||0)+1);
      screws.push({f,link});
      if(f.pocket&&f.pocket.plugged)plugged++;
    }
  }
  return{kinds,plugged,screws};
}
/* How deep the point of a pocket screw ends in the piece it holds in, square to the joint (through a thin deck, in
   the framing under it), and how deep that piece is there */
function pocketScrewBite(f,j){
  const k=j.k,point=pointPlus(f.pos,f.dir,f.len),holdsIn=f.also&&f.also[0]?f.also[0]:f.into,b=plainBox(holdsIn);
  const into=plainBox(f.into),start=Math.abs(into.lo[k]-j.plane)<.03?into.lo[k]:into.hi[k];   // the face of the joint
  const from=holdsIn===f.into?start:(Math.abs(b.lo[k]-point[k])<Math.abs(b.hi[k]-point[k])?b.hi[k]:b.lo[k]);
  return{bite:Math.abs(point[k]-from),depth:b.hi[k]-b.lo[k],holdsIn};
}
/* the longest pocket screw shorter than 1" (the 3/4" pan-head one) may only join two sheets 1/2" thick or thinner */
const POCKET_LEAST_LENGTH=1;
const POCKET_LEAST_BITE=.5;   // thread wanted in the piece a pocket screw holds in, or half that piece's depth when it is thinner
/* What is wrong with the pocket-hole screws of the design as it is now, as sentences beginning with label. */
function pocketScrewFaults(label){
  const faults=[];
  const say=text=>faults.push(`${label}: ${text}`);
  const model=pocketScrewsInModel();
  const rows=hardwareTotals(findJoints()).rows;
  // 1. every pocket-hole screw line is of the one form, with its thread, and has a price row of its own
  const bought=new Map();
  for(const[item,count]of rows){
    if(/pocket[- ]hole screw|pocket screw/i.test(item)){
      const parts=String(item).match(POCKET_SCREW_LINE);
      if(!parts){say(`the shopping list has "${item}", not "<length> pocket-hole screws, coarse or fine thread"`);continue;}
      const key=`${fmt(parseLen(parts[1]))}|${parts[2]}|${parts[3]?'exterior':''}`;
      bought.set(key,(bought.get(key)||0)+count);
      const family=hardwareFamily(item);
      if(!family||!/^pocket-screws/.test(family.id)||!(family.pack>0)||!(family.price>0))
        say(`"${item}" has no price row of pocket-hole screws with a pack size and a price`);
      else if(!!parts[3]!==/exterior/.test(family.id))say(`"${item}" is priced as ${/exterior/.test(family.id)?'exterior':'plain zinc'} screws`);
      // a row of its own length, never "other lengths" (the real-thing reviewer's finding 2: a 3/4" line fell there)
      else if(!family.id.endsWith(':'+parts[1]))say(`"${item}" has no price row of its own length (it falls to "${family.name}")`);
      // a length and thread a store really sells (sheet 27, section 10)
      if(!(parts[2]==='fine'?POCKET_FINE_SOLD:POCKET_COARSE_SOLD).includes(parts[1]))say(`"${item}": pocket-hole screws of that length are not sold in ${parts[2]} thread`);
    }
    // 2. no pocket-hole screw is counted among the wood screws
    if(/wood screws|exterior screws/i.test(item)&&/pocket/i.test(item))say(`"${item}" mixes pocket-hole screws with wood screws`);
  }
  // 3. the counts agree with the model, length by length and thread by thread
  for(const key of new Set([...model.kinds.keys(),...bought.keys()])){
    const drawn=model.kinds.get(key)||0,listed=bought.get(key)||0;
    if(drawn!==listed){
      const[length,thread,exterior]=key.split('|');
      say(`${drawn} pocket-hole screws ${length} ${thread} thread${exterior?' exterior':''} in the model, ${listed} on the shopping list`);
    }
  }
  // 3b. every pocket screw holds: at least 1" long (the 3/4" pan-head one only between two 1/2" sheets, where the
  //     corner is glued) and at least POCKET_LEAST_BITE of thread in the piece it holds in (half that piece's depth
  //     where it is thinner): the real-thing reviewer's finding 2, a 3/4" screw with 3/16" in a garage shelf's deck
  for(const{f,link}of model.screws){
    const{bite,depth,holdsIn}=pocketScrewBite(f,link.joint);
    if(f.len<POCKET_LEAST_LENGTH-1e-6&&!(M[f.through.mat].kind==='sheet'&&M[holdsIn.mat].kind==='sheet'&&f.through.t<=.5+.02&&holdsIn.t<=.5+.02)){
      say(`a ${f.label} (${f.through.name} into ${f.into.name}): a pocket screw shorter than 1" only joins two 1/2" sheets`);break;}
    if(bite<Math.min(POCKET_LEAST_BITE,depth/2)-.01){
      say(`a ${f.label} (${f.through.name} into ${f.into.name}) has only ${fmt(r16(bite))} of thread in the ${holdsIn.name}`);break;}
  }
  // the short pan-head screw only clamps a glued corner: the glue is bought
  if(model.screws.some(({f})=>f.len<POCKET_LEAST_LENGTH-1e-6)&&!hardwareTotals(findJoints()).glue)say('3/4" pocket-hole screws are used, and no wood glue is bought for the corners they clamp');
  // 4. every plugged pocket has its plug bought, of the kind that suits the design (oak in oak, maple in poplar,
  //    paint grade under paint, else pine: the owner's addendum, 11:10 PM; maple for poplar from the case looks job,
  //    sheet 01 §9.4, taken in at the merge of both)
  const plugRows=rows.filter(([item])=>POCKET_PLUG_LINE.test(item));
  const plugs=plugRows.reduce((sum,[,count])=>sum+count,0);
  if(plugs!==model.plugged)say(`${model.plugged} pocket holes are filled with plugs, ${plugs} pocket-hole plugs on the shopping list`);
  const painted=FINISHES[look().finish]&&FINISHES[look().finish][2]===2,plugKind=painted?'paint grade':look().wood==='oak'?'oak':look().wood==='poplar'?'maple':'pine';
  for(const[item]of plugRows){
    const kind=(String(item).match(POCKET_PLUG_LINE)||[])[1];
    if(kind!==plugKind)say(`"${item}" does not name the plugs that suit this design (${plugKind})`);
    const family=hardwareFamily(item);
    if(!family||!/^pocket-plugs/.test(family.id)||!(family.price>0)||(family.id!=='pocket-plugs'&&!family.name.endsWith(kind||'-')))say(`"${item}" has no price row of pocket-hole plugs of its own kind`);
  }
  // 5. the tools list names the long square driver bit, and no step calls a pocket-hole screw a wood screw
  if(model.kinds.size){
    const plan=buildPlan(true);
    if(!toolList(findJoints(),plan).some(tool=>/square driver bit/.test(tool)))say('the tools list does not name the square driver bit of the pocket-hole screws');
    for(const step of plan.steps){
      const pocketGroups=step.groups.filter(group=>group.type==='pocket');
      if(!pocketGroups.length)continue;
      for(const group of pocketGroups){
        const words=String(group.line||'');
        if(/wood screw/i.test(words))say(`step ${step.n||''}: "${words.slice(0,80)}" calls a pocket-hole screw a wood screw`);
        if(!/pocket-hole screws?, \d[\d\/-]*"/.test(words))say(`step ${step.n||''}: the line "${words.slice(0,80)}" does not say "pocket-hole screws" with the length`);
      }
      const tools=step.need&&step.need.tools?step.need.tools.join('; '):'';
      if(!/square driver bit/.test(tools))say(`step ${step.n||''} drives pocket-hole screws, and its You need does not name the square driver bit (${tools.slice(0,80)})`);
      // a step that plugs pockets lists the plugs and glue with its fasteners, and a flush-cut saw or a sanding block
      // with its tools (the owner's addendum, 11:10 PM)
      const plugsHere=pocketGroups.some(group=>group.links.some(link=>fastenersOfLink(link).some(f=>f.pocket&&f.pocket.plugged)));
      if(plugsHere){
        const need=step.need&&step.need.fasteners?step.need.fasteners.join('; '):'';
        if(!/pocket-hole plugs?/.test(need)||!/glue/.test(need))say(`step ${step.n||''} fills pocket holes with plugs, and its You need does not list the plugs and glue (${need.slice(0,80)})`);
        if(!/flush-cut saw|sanding block/.test(tools))say(`step ${step.n||''} fills pocket holes with plugs, and its You need names no flush-cut saw or sanding block`);
      }
    }
  }
  return faults;
}
/* Self-check: every preset with each of its choices, in Rustic, Everyday and Fine furniture, and every preset in red
   oak (fine thread) and in cedar (exterior): the pocket-hole screws are bought on lines of their own, of their own
   length and thread, priced, as many as the model drives, never among the wood screws, a plug for every plugged
   pocket, the square driver bit in the tools and in the step that drives them, and the glossary says what they
   are. */
SELFTESTS.push(function pocketScrewsBoughtAsTheirOwn(problems){
  const seen=new Set();
  const wrong=text=>{const kind=text.replace(/^[^:]*: /,'').replace(/\d+/g,'#');if(!seen.has(kind)&&problems.length<20){seen.add(kind);problems.push('pocket-hole screws: '+text);}};
  const kept=JSON.stringify(S);
  let lines=0,fine=0,exterior=0;
  try{withoutDrawing(()=>{
    const tryOne=(preset,vals,style,wood,name)=>{
      if(preset.check&&preset.check(vals).some(found=>found.level==='stop'))return;
      if(!placeInStyle(preset,vals,style))return;
      if(wood){look().wood=wood;connCache=null;}
      for(const fault of pocketScrewFaults(`${name} (${STYLES[style][0]}${wood?', '+WOODS[wood][0]:''})`))wrong(fault);
      for(const[item]of hardwareTotals(findJoints()).rows){
        const parts=String(item).match(POCKET_SCREW_LINE);
        if(!parts)continue;
        lines++;
        if(parts[2]==='fine')fine++;
        if(parts[3])exterior++;
      }
    };
    for(const variant of presetVariants()){
      for(const style of Object.keys(STYLES))tryOne(variant.preset,{...presetDefaults(variant.preset),...variant.vals},style,'',variant.name);
    }
    const outdoors=(PRESET_GROUPS.find(group=>group[0]==='Outdoors')||[,[]])[1];
    for(const preset of PRESETS){
      tryOne(preset,presetDefaults(preset),'std','oak',preset.name);
      tryOne(preset,presetDefaults(preset),'std','cedar',preset.name);
      // an outdoor preset switched to an indoor wood still stands outside: exterior screws (finding 10 / 19)
      if(outdoors.includes(preset.name)){
        tryOne(preset,presetDefaults(preset),'fine','pine',preset.name);
        tryOne(preset,presetDefaults(preset),'std','pt',preset.name);
        const before=exterior;
        tryOne(preset,presetDefaults(preset),'fine','poplar',preset.name);
        if(hardwareTotals(findJoints()).rows.some(([item])=>POCKET_SCREW_LINE.test(item))&&exterior===before)
          wrong(`${preset.name} in poplar buys plain zinc pocket-hole screws for a design that stands outside`);
      }
    }
  });}finally{load(kept,true);}
  if(!lines)wrong('no preset buys pocket-hole screws, so this check proves nothing');
  if(!fine)wrong('no preset in oak buys fine-thread pocket-hole screws');
  if(!exterior)wrong('no preset in cedar buys exterior pocket-hole screws');
  if(!TERMS.some(term=>term.word==='Pocket-hole plug'&&/bag/.test(term.what)))wrong('the glossary has no "Pocket-hole plug" that says what they are and that they are bought');
  if(!TERMS.some(term=>term.word==='Pocket-hole screw'&&/ordinary wood screw/.test(term.what)))wrong('the glossary has no "Pocket-hole screw" that says why an ordinary wood screw must not be used');
});
/* Self-check: the rule can fail. A list that buys the pocket-hole screws as wood screws, one with a count off by
   one, and a plugged pocket with no plug bought are all found. */
SELFTESTS.push(function pocketScrewRuleCanFail(problems){
  const kept=JSON.stringify(S),keptTotals=hardwareTotals;
  try{withoutDrawing(()=>{
    const desk=PRESETS.find(preset=>preset.name==='Desk');
    if(!desk||!placeInStyle(desk,presetDefaults(desk),'std')){problems.push('pocket-hole screws: the Desk cannot be placed for the test');return;}
    if(pocketScrewFaults('Desk').length){problems.push('pocket-hole screws: the Desk as placed already has a fault: '+pocketScrewFaults('Desk')[0]);return;}
    const tampered=change=>{
      hardwareTotals=js=>{const totals=keptTotals(js);return{...totals,rows:change(totals.rows.map(row=>row.slice()))};};
      try{return pocketScrewFaults('Desk');}finally{hardwareTotals=keptTotals;}
    };
    const asWoodScrews=tampered(rows=>rows.map(([item,count])=>POCKET_SCREW_LINE.test(item)?[item.replace(/ pocket-hole screws.*$/,' wood screws').replace(/^/,'#8 × '),count]:[item,count]));
    if(!asWoodScrews.length)problems.push('pocket-hole screws: a list that buys them as wood screws is not found');
    const offByOne=tampered(rows=>rows.map(([item,count])=>POCKET_SCREW_LINE.test(item)?[item,count+1]:[item,count]));
    if(!offByOne.length)problems.push('pocket-hole screws: a count one more than the model drives is not found');
    const noPlug=tampered(rows=>rows.concat([['Pocket-hole plugs',3]]));
    if(!noPlug.length)problems.push('pocket-hole screws: plugs bought for pockets that are not plugged are not found');
    // (the code reader's finding 14: each other thing the rule checks, seen to fail)
    const noLength=tampered(rows=>rows.map(([item,count])=>POCKET_SCREW_LINE.test(item)?[item.replace(/^\S+ /,'3/4" '),count]:[item,count]));
    if(!noLength.some(fault=>/not sold in coarse thread|own length|in the model/.test(fault)))problems.push('pocket-hole screws: a 3/4" coarse-thread line (not sold) is not found');
    const keptTools=toolList;
    toolList=(js,plan)=>keptTools(js,plan).filter(tool=>!/square driver bit/.test(tool));
    try{if(!pocketScrewFaults('Desk').some(fault=>/tools list/.test(fault)))problems.push('pocket-hole screws: a tools list without the square driver bit is not found');}
    finally{toolList=keptTools;}
    const keptPlan=buildPlan;
    buildPlan=full=>{const plan=keptPlan(full);for(const step of plan.steps){if(step.need&&step.need.tools)step.need.tools=step.need.tools.filter(tool=>!/square driver bit/.test(tool));for(const group of step.groups)if(group.type==='pocket')group.line=String(group.line||'').replace(/pocket-hole screws?, \S+/g,'pocket screws');}return plan;};
    try{
      const found=pocketScrewFaults('Desk');
      if(!found.some(fault=>/You need does not name the square driver bit/.test(fault)))problems.push('pocket-hole screws: a step whose You need lacks the square driver bit is not found');
      if(!found.some(fault=>/does not say "pocket-hole screws" with the length/.test(fault)))problems.push('pocket-hole screws: a step line without "pocket-hole screws" and the length is not found');
    }finally{buildPlan=keptPlan;}
    // a screw shorter than 1" through a board (the garage shelves' posts into the top deck of finding 2)
    const keptOfLink=fastenersOfLink;
    fastenersOfLink=link=>keptOfLink(link).map(f=>f.kind==='pocket'?{...f,len:.75,label:'3/4" pocket-hole screw, fine thread'}:f);
    try{if(!pocketScrewFaults('Desk').some(fault=>/shorter than 1"|thread in the/.test(fault)))problems.push('pocket-hole screws: a 3/4" pocket screw through a 2x4 is not found');}
    finally{fastenersOfLink=keptOfLink;}
    // in oak, a coarse line where the model's screws want fine thread (the Dining chair's seat screws)
    const chair=PRESETS.find(preset=>preset.name==='Dining chair');
    if(chair&&placeInStyle(chair,presetDefaults(chair),'std')){
      look().wood='oak';connCache=null;
      const coarse=tampered(rows=>rows.map(([item,count])=>[String(item).replace('fine thread','coarse thread'),count]));
      if(!coarse.some(fault=>/in the model/.test(fault)))problems.push('pocket-hole screws: coarse thread bought for a red oak chair is not found');
      // plugs of the wrong kind (pine plugs in an oak chair)
      const pinePlugs=tampered(rows=>rows.map(([item,count])=>[String(item).replace(/^Pocket-hole plugs, \w+.*$/,'Pocket-hole plugs, pine'),count]));
      if(!pinePlugs.some(fault=>/do(es)? not name the plugs that suit/.test(fault)))problems.push('pocket-hole screws: pine plugs bought for an oak chair are not found');
    }
    // outdoors without the coating (a Planter box, which stands outside)
    const planter=PRESETS.find(preset=>preset.name==='Planter box');
    if(planter&&placeInStyle(planter,presetDefaults(planter),'fine')){
      const indoor=tampered(rows=>rows.map(([item,count])=>[String(item).replace(', exterior',''),count]));
      if(hardwareTotals(findJoints()).rows.some(([item])=>POCKET_SCREW_LINE.test(item))&&!indoor.some(fault=>/in the model|priced as/.test(fault)))
        problems.push('pocket-hole screws: plain zinc screws bought for a Planter box are not found');
    }
  });}finally{hardwareTotals=keptTotals;load(kept,true);}
});
