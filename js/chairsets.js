/* NominalCAD: "Chairs to match" on the Dining table's form (stage 2 of design\specs\12-dining-chairs.md, section 11.1).

   Ticking "Chairs to match" on the Dining table makes the table and a set of Dining chairs (js/diningchair.js) in one
   go: as many as fit along each side between the legs (or 1 or 2 chosen by hand), and one at each end if ticked,
   each tucked in under the top, facing the table. "[25 §n]" is a section of design\reference\25-dining-chairs.md.

   HOW IT IS PUT TOGETHER
     - The chairs are the Dining chair preset's own pieces (buildDiningChair), at the chair's usual sizes, with the
       seat height worked out from the table (chairSeatForTable, the rule of spec section 2 and sheet §1).
     - Each chair is built in its own frame and turned to face the table by a quarter or half turn stored square
       (setQuat, js/orient.js, which folds the turn into the piece's axes and turns the shape of the back legs with
       it): never a rotation left on a piece, so every joint, fastener and check still sees every piece.
     - Every piece of chair k carries unit:'Dining chair k' and unitOf:'Dining chair'. The unit makes each chair a
       top-level component of its own (componentFromPreset, js/components.js), so a click picks one chair and a drag
       moves that chair only (the chairs are not fastened to the table). unitOf makes the chair's pieces answer to
       the chair preset where a piece's preset matters (presetOfPiece, js/fasteners.js): hidden faces, plugs, the
       back as a show face. The table and its chairs stay ONE placement (S.sets), with the table's form values.
     - The table's uses and joints gain the chair's rows only while Chairs to match is ticked (they are functions of
       the form values), so the table as first opened is exactly the table it always was.
     - The steps: the table's steps, then the chair's steps once, each building every chair ("Do this for each of
       the 6 chairs; the lists below count all 6"), then the finish. Cut list, shopping list and drill drawings
       count the pieces as they are, so they follow with no new code.
     - The overall size of the table counts only the table (builtOverall, js/overallsizes.js, leaves out pieces
       of a unit).

   IN THIS FILE
     CHAIR_SET_RULES            the numbers, with where they come from
     chairSeatForTable(table)   the seat height for this table
     chairSetPlan(p)            how many chairs, where, and what cannot work (memoized)
     chairSetParts(p)           the chairs' pieces, placed
     the Dining table preset widened with the chair rows, then the self-checks at the bottom. */
'use strict';

const CHAIR_SET_RULES={
  outside:1,          // the back legs' front edge, at the height of the table top, stands this far outside the edge
                      // of the top when tucked in (spec 11.1; PRACTICE) [25 §5: "the chair stops when its back meets
                      // the table edge", no number]. On the leaning back that is the tapered edge (chairSetPlaces)
  facing:1,           // two seats facing each other under the table stay at least this far apart (PRACTICE) [25 §5]
  endClear:1,         // an end chair's seat stops this far short of the nearest side chair's seat (PRACTICE) [25 §5]
  edgeEach:CHAIR_RULES.edgeEach,between:CHAIR_RULES.between,   // 24" of table edge each, 2" between, checked [25 §5]
  topAbove:11,        // a seat about 11" under the top (the middle of 10"-12") [25 §1]: seat = top - 12 at most
  thighEasy:CHAIR_RULES.thighEasy,thighLeast:CHAIR_RULES.thighLeast,
};

/* the table this form builds (tablePlan, js/builders-furniture.js) */
const chairSetTable=p=>tablePlan(tableArgs('Dining table',p));

/* The seat height for this table (spec section 2, sheet §1): the top less 12" at most, and 7 1/2" under the apron at
   most; raised to 17" (the lowest dining seat) while the apron still leaves 7" over it; never over 19". */
function chairSeatForTable(table){
  const R=CHAIR_SET_RULES,[least,most]=CHAIR_LIMITS.S,under=table.legH-table.apronDepth;
  let seat=Math.min(table.H-12,under-R.thighEasy);
  if(seat<least&&under-least>=R.thighLeast-1e-9)seat=least;
  return Math.floor(Math.min(most,seat)*16+1e-9)/16;
}

/* the chair's form values for the chairs of this table */
function chairSetChairVals(p,table){
  return{...presetDefaults(chairPreset()),S:chairSeatForTable(table||chairSetTable(p)),SW:CHAIR_RULES.seatWide.usual,BH:CHAIR_RULES.backHigh.usual,
    upright:!!p.chairUpright,table:false,wood:'pine'};
}

/* (how many fit along a side is the chair's own T3 rule, chairsAlongSide in js/diningchair.js, so the chair's form
   and the table's never count differently) */
/* does a count chosen by hand fit (each chair 24" of edge and 2" between)? */
const chairsFitAlong=(n,longSpan,seatWide)=>n*(seatWide+CHAIR_SET_RULES.between)+CHAIR_SET_RULES.between<=longSpan+1e-9&&longSpan/n>=CHAIR_SET_RULES.edgeEach-1e-9;

const chairSetMemo=new Map();
function chairSetPlan(p){
  // (the table's sizes are said as its boxes write them while the form is talking: typedLen, js/core.js)
  const key=JSON.stringify(p||{})+'|'+(typeof S!=='undefined'&&S&&S.look?S.look.style:'')+(boxSpeech>0?'|boxes':'');
  if(!chairSetMemo.has(key)){
    if(chairSetMemo.size>200)chairSetMemo.clear();
    chairSetMemo.set(key,chairSetPlanFresh(p||{}));
  }
  return chairSetMemo.get(key);
}
function chairSetPlanFresh(p){
  const R=CHAIR_SET_RULES,problems=[],out={on:!!p.chairs,problems,places:[],perSide:0,ends:false};
  if(!out.on)return out;
  const table=chairSetTable(p),chairVals=chairSetChairVals(p,table),chair=diningChairPlan(chairVals);
  Object.assign(out,{table,chairVals,chair,seat:chairVals.S});
  const untick=' Or untick Chairs to match.';
  // the table fits of the chair (T1, T2, T5, T6): a table no dining chair suits is refused here
  const fit=diningChairPlan({...chairVals,table:true,tL:p.L,tW:p.W,tH:p.H}).fit||[];
  for(const finding of fit)if(finding.level==='warn'&&['T1','T2','T5','T6'].includes(finding.rule)){
    problems.push({level:'stop',code:'chairs-table',text:finding.text,fix:finding.fix+untick});
  }
  if(problems.length)return out;
  // how many along each side
  const side=table.longSpan,fits=chairsAlongSide(side,chair.SW);
  const wanted=p.perSide==='1'||p.perSide==='2'?+p.perSide:fits;
  if(!fits){
    problems.push({level:'stop',code:'chairs-count',text:`Between the legs along a side there is only ${fmt(side)}: even one chair ${fmt(chair.SW)} wide needs ${fmt(chair.SW+2*R.between)} there.`,fix:'Make the table longer.'+untick});
    return out;
  }
  if(wanted>fits||!chairsFitAlong(wanted,side,chair.SW)){
    let longer=null;
    for(let L=Math.ceil(p.L);L<=108;L++){
      const t=chairSetTable({...p,L});
      if(t.apron!=='2x4')break;
      if(chairsAlongSide(t.longSpan,chair.SW)>=wanted){longer=L;break;}
    }
    problems.push({level:'stop',code:'chairs-count',
      text:`Only ${countWord(fits)} chair${fits===1?' fits':'s fit'} along a side: there is ${fmt(side)} between the legs, and ${countWord(wanted)} would get ${fmt(r16(side/wanted))} of table each, less than the ${fmt(R.edgeEach)} a person needs.`,
      fix:`Choose ${fits}${longer!==null?`, or make the table ${typedLen(longer)} long or longer for ${countWord(wanted)} a side`:''}.`+untick});
    return out;
  }
  out.perSide=wanted;
  // a chair at each end, between the end legs (T4)
  if(p.ends){
    const end=table.shortSpan;
    if(end<chair.SW+2*R.between-1e-9){
      let wider=null;
      for(let W=Math.ceil(p.W);W<=50;W++){
        const t=chairSetTable({...p,W});
        if(t.apron!=='2x4')break;
        if(t.shortSpan>=chair.SW+2*R.between-1e-9){wider=t.W;break;}   // (the top comes out in whole boards: say the width it is built at)
      }
      problems.push({level:'stop',code:'chairs-ends',text:`A chair at each end needs ${fmt(chair.SW+2*R.between)} between the end legs, and this table has ${fmt(end)} there.`,
        fix:`Untick A chair at each end${wider!==null?`, or make the table ${typedLen(wider)} wide or wider`:''}.`});
      return out;
    }
    out.ends=true;
  }
  chairSetPlaces(out,table,chair);
  return out;
}
/* Where each chair goes (spec 11.1). The table runs along x (its length) and z (its width, 0 at the back edge).
   Along a side, chair i of n is centered in the i-th equal share of the space between the legs. Tucked in: the back
   legs stand CHAIR_SET_RULES.outside outside the edge of the top, so the seat reaches `under` under the top, but
   two seats facing each other stop (W - facing) / 2 in. An end chair stops where its seat front is endClear short
   of the nearest side chair's seat. Each place: {k, side, turn (quarter turns: 0 faces +z, 1 +x, 2 -z, 3 -x), box}
   where box is the chair's footprint on the floor {x:[lo,hi], z:[lo,hi]}. */
function chairSetPlaces(out,table,chair){
  const R=CHAIR_SET_RULES,{L,W,over,leg}=table,deep=chair.seatDepth,wide=chair.SW;
  // how far the seat goes under the top: the back legs' front edge AT THE HEIGHT OF THE TOP stands `outside` past
  // the edge of the top (spec 11.1); on the leaning back that edge is the tapered one (chair.frontAt)
  const legFrontAtTop=Math.min(chair.legDepth,chair.frontAt(table.H));
  const reach=deep-R.outside-legFrontAtTop;
  const under=Math.min(reach,(W-R.facing)/2);
  out.under=under;
  const n=out.perSide,share=table.longSpan/n,first=over+leg;
  const centres=[];
  for(let i=0;i<n;i++)centres.push(first+share*(i+.5));
  let k=0;
  // the back side first (they face the front, +z), then the front side (they face the back), left to right
  for(const cx of centres)out.places.push({k:++k,side:'back',turn:0,box:{x:[cx-wide/2,cx+wide/2],z:[under-deep,under]}});
  for(const cx of centres)out.places.push({k:++k,side:'front',turn:2,box:{x:[cx-wide/2,cx+wide/2],z:[W-under,W-under+deep]}});
  if(out.ends){
    const nearest=Math.min(centres[0]-wide/2,L-(centres[centres.length-1]+wide/2));   // the side seats nearest each end
    const inEnd=Math.max(0,Math.min(reach,nearest-R.endClear));
    out.endUnder=inEnd;
    const z=[W/2-wide/2,W/2+wide/2];
    out.places.push({k:++k,side:'left',turn:1,box:{x:[inEnd-deep,inEnd],z}});
    out.places.push({k:++k,side:'right',turn:3,box:{x:[L-inEnd,L-inEnd+deep],z}});
  }
  out.count=out.places.length;
}

/* Turns a chair's pieces (built in the chair's own frame) by `turn` quarter turns about the vertical, stored square,
   and moves them onto the footprint box. */
function chairTurnedInto(parts,turn,box){
  if(turn){
    const angle=turn*Math.PI/2,q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
    const cos=Math.cos(angle),sin=Math.sin(angle);
    for(const piece of parts){
      const s=size(piece),c=piece.pos.map((v,i)=>v+s[i]/2);
      const turned=[c[0]*cos+c[2]*sin,c[1],-c[0]*sin+c[2]*cos];
      setQuat(piece,q);
      const t=size(piece);
      piece.pos=turned.map((v,i)=>v-t[i]/2);
    }
  }
  const b=bbox(parts),shift=[box.x[0]-b.lo[0],0,box.z[0]-b.lo[2]];
  for(const piece of parts)piece.pos=piece.pos.map((v,i)=>r16(v+shift[i]));
  return parts;
}
/* the chairs' pieces, placed, each marked with its unit (none while Chairs to match is off or refused) */
function chairSetParts(p){
  const plan=chairSetPlan(p);
  if(!plan.on||plan.problems.some(f=>f.level==='stop'))return[];
  const parts=[];
  for(const place of plan.places){
    const chairParts=buildDiningChair(plan.chairVals);
    chairTurnedInto(chairParts,place.turn,place.box);
    for(const piece of chairParts){piece.unit=`Dining chair ${place.k}`;piece.unitOf='Dining chair';}
    parts.push(...chairParts);
  }
  return parts;
}

/* ---------- the words ---------- */
/* the line under the form, added to the table's (sizes in inches, as chairs are spoken of) */
function chairSetInfo(p){
  const plan=chairSetPlan(p);
  if(!plan.on||plan.problems.length)return'';
  const t=plan.table,chair=plan.chair,under=t.legH-t.apronDepth;
  // (the share of table edge is said for the chairs along the sides: an end chair has the whole end)
  const along=`${countWord(plan.perSide)} along each side between the legs, each ${fmt(chair.SW)} wide with ${fmt(r16(t.longSpan/plan.perSide))} of table edge`;
  const ends=plan.ends?`, and one at each end, between the end legs (${fmt(t.shortSpan)})`:'';
  const style=typeof S!=='undefined'&&S&&S.look&&STYLES[S.look.style]?S.look.style:'std';
  const lines=[`Chairs to match: ${countWord(plan.count)} Dining chairs, ${along}${ends}.`,
    `Their seats are ${fmt(plan.seat)} high: ${fmt(r16(under-plan.seat))} under the aprons and ${fmt(r16(t.H-plan.seat))} below the top.`,
    `Tucked in, their back legs stand ${fmt(CHAIR_SET_RULES.outside)} outside the edge of the top, at its height, and their seats go ${fmt(r16(plan.under))} under it${plan.ends?`; the end chairs go in only ${fmt(r16(plan.endUnder))}, so their seats stop ${fmt(CHAIR_SET_RULES.endClear)} short of the side chairs' seats`:''}.`,
    `Backs ${chair.taper>0?'leaning back about 5°':'standing upright'}, their tops ${fmt(chair.crest.top)} from the floor; about ${Math.round(chair.weight.pounds)} lb each.`,
    // the table and its chairs are built in one style: the one of the design that is open (chairSetLook)
    `Create builds the table and the chairs in the ${STYLES[style][0]} style of the design that is open${style==='std'?'':`, so the top is ${style==='rustic'?'screwed down from above':'held on from underneath'}`}; change it afterwards in Style and finish.`,
    'Each chair is a part of its own: drag any piece of a chair to move that chair (the table and the other chairs stay).'];
  return lines.join(' ');
}

/* ---------- the steps: the table's, then the chair's once for all the chairs ---------- */
/* The chair's steps are written once, for ONE chair: each is stamped with the pieces of the first chair only
   (pick) and says unitOf 'Dining chair', and the build plan puts every other chair of the same pieces in the same
   steps and counts them as the design is now (unitsInSteps and copyWords, js/buildsteps.js): "For each of the 6
   dining chairs: build its two side frames ...", "You are making 6 dining chairs" in the cutting step. A chair
   deleted, or copied, changes the count; no number of chairs is stored in the words. */
const firstChairUnit=parts=>{const units=parts.filter(p=>p.unit).map(p=>p.unit);return units.sort((a,b)=>a.localeCompare(b,'en',{numeric:true}))[0];};
function chairSetSteps(p,tableStepList){
  const plan=chairSetPlan(p);
  if(!plan.on||plan.problems.length)return tableStepList;
  const chairSteps=diningChairSteps(plan.chairVals);
  const isFin=step=>step===FIN||step.t===FIN.t;
  // every word of a step, in each style (styledStep, js/style.js)
  const reword=(step,change)=>({...step,t:change(step.t),...(step.byStyle?{byStyle:Object.fromEntries(Object.entries(step.byStyle).map(([style,words])=>[style,change(words)]))}:{})});
  // 1. one cutting step for everything: the table's, with the chair's own words for its blocks, its seat edge
  // and its back legs (the program adds the batch tip with the count)
  const chairCut=chairSteps[0],tableCut=tableStepList[0];
  const lower=words=>words.charAt(0).toLowerCase()+words.slice(1);
  const cut=reword(chairCut,words=>`${tableCut.t} For each chair: ${lower(words.slice(CUT.t.length).trim())}`);
  const tableBuild=tableStepList.slice(1).filter(step=>!isFin(step));
  const chairBuild=chairSteps.slice(1).filter(step=>!isFin(step)&&!/^Finish the undersides/.test(step.t));
  // each chair step holds the first chair's pieces (pick) and is marked as a step of the unit
  const ofOneChair=step=>({...step,unitOf:'Dining chair',...(step.add.length?{pick:(piece,parts)=>piece.unit===firstChairUnit(parts)}:{})});
  const undersides=chairSteps.find(step=>/^Finish the undersides/.test(step.t));
  return[cut,...tableBuild,...chairBuild.map(ofOneChair),FIN,...(undersides?[reword(undersides,words=>words.replace('the chair on its back','each chair on its back'))]:[])];
}

/* ---------- the Dining table, widened ---------- */
const DINING_TABLE_PRESET=PRESETS.find(preset=>preset.name==='Dining table');
(function widenTheDiningTable(table){
  const own={build:table.build,uses:table.uses,joints:table.joints,check:table.check,notes:table.notes,info:table.info,steps:table.steps};
  // the form: "Chairs to match" and, only while it is ticked, its own rows (under, js/presets.js)
  const rows=under('chairs',[
    {k:'perSide',label:'Chairs along each side',opts:[['fit','As many as fit'],['1','1'],['2','2']],v:'fit'},
    {k:'ends',label:'A chair at each end',check:1,v:false},
    {k:'chairUpright',label:'Straight back legs on the chairs (no taper cut; the backs stand upright)',check:1,followsDesign:true,v:false}]);
  // (under() copies each row, so the chair back's start is made a getter again here: ticked in Rustic / rough,
  // unticked in Everyday and Fine furniture, as on the chair's own form; the owner, 17 Nov)
  Object.defineProperty(rows[2],'v',{get(){return chairUprightByStyle();},enumerable:true,configurable:true});
  table.params.push({k:'chairs',label:'Chairs to match',check:1,v:false},...rows);
  const on=p=>!!(p&&p.chairs);
  table.build=p=>own.build(p).concat(on(p)?chairSetParts(p):[]);
  // Create keeps the build style of the design that is open when the chairs come with the table, as the chair's own
  // Create does (js/diningchair.js): the chairs' straight back legs start ticked in Rustic, and a Rustic form must
  // not make an Everyday set. A plain table still starts a new design in Everyday. look is a function of the form
  // values (presetLook, js/app.js); the remark says which style Create will use (chairSetInfo).
  table.look=vals=>on(vals)&&typeof S!=='undefined'&&S&&S.look&&STYLES[S.look.style]?{style:S.look.style}:{};
  table.uses=p=>on(p)?{...own.uses,...DINING_CHAIR_USES}:own.uses;
  table.joints=p=>on(p)?own.joints.concat(DINING_CHAIR_JOINTS):own.joints;
  table.check=p=>own.check(p).concat(on(p)?chairSetPlan(p).problems:[]);
  table.info=p=>[own.info(p),on(p)?chairSetInfo(p):''].filter(Boolean).join(' ');
  table.notes=p=>{
    const notes=own.notes(p);
    if(!on(p)||chairSetPlan(p).problems.length)return notes;
    const plan=chairSetPlan(p),chairNotes=diningChairNotes(plan.chairVals);
    return notes.concat(chairNotes[0].replace(/^How this chair holds together\./,'How each dining chair holds together.'),chairNotes.slice(1));
  };
  // the screw heads of the table and of the chairs, each said as whose it is (placePreset adds them after the notes)
  table.headsNotes=p=>{
    const whose=(notes,who)=>notes.map(note=>note.replace(/^Screw heads:/,`${who} screw heads:`));
    return on(p)&&!chairSetPlan(p).problems.length?whose(headsNote('Dining table'),"The table's").concat(whose(headsNote('Dining chair'),"The chairs'")):headsNote('Dining table');
  };
  table.steps=p=>on(p)?chairSetSteps(p,own.steps(p)):own.steps(p);
  table.hw=p=>on(p)&&!chairSetPlan(p).problems.length?DINING_CHAIR_PRESET.hw(chairSetPlan(p).chairVals).map(([label,qty])=>[label,qty*chairSetPlan(p).count]):[];
  // Check my design: the chairs checked again in the wood chosen since (a soft wood holds a screw less well)
  table.recheck=vals=>on(vals)&&!chairSetPlan(vals).problems.length?diningChairRecheck(chairSetPlan(vals).chairVals):[];
  // the structural check and the fastener checks also try the table with its chairs, every way (presetVariants)
  table.variants=(table.variants||[]).concat([{chairs:true},{chairs:true,ends:true},{chairs:true,chairUpright:true},{chairs:true,chairUpright:false,ends:true},{chairs:true,perSide:'1'}]);
})(DINING_TABLE_PRESET);

/* ---------- self-checks (spec 11.1) ----------
   They place the table and its chairs the way Create does (placePreset, js/app.js) without drawing, and put the
   design back afterwards. */
const chairSetVals=change=>({...presetDefaults(DINING_TABLE_PRESET),chairs:true,chairUpright:false,...change});
/* places the Dining table at these values in this style, in an empty design */
function placeTableSet(vals,style){
  load(JSON.stringify(blank()),true);
  return placeInStyle(DINING_TABLE_PRESET,vals,style||'std');
}
const chairSetChecked=fn=>Object.defineProperty(function(problems){
  const wrong=text=>{if(problems.length<60)problems.push('chairs to match: '+text);};
  const kept=JSON.stringify(S);
  try{withoutDrawing(()=>fn(wrong));}
  catch(e){wrong(`${fn.name} threw ${e.message}`);}
  finally{load(kept,true);}
},"name",{value:fn.name});   // (named as the check, for the report of selfTest)
/* the pieces of each chair, by unit */
function chairUnits(){
  const units=new Map();
  for(const p of S.parts)if(p.unit){if(!units.has(p.unit))units.set(p.unit,[]);units.get(p.unit).push(p);}
  return units;
}

/* How many fit (sheet 25 §5, derived): tables 36" to 74" long, 33" and 27 1/2" wide: one a side under 59", two from
   there; a chair at each end only on a table 33" wide or wider; a table with 2x6 aprons (84"), too low (28") or too
   high (33") refused with a fix that works; a count chosen by hand that does not fit refused with a fix that works.
   And the Dining table as first opened is the table it was: Chairs to match off, its pieces, joints and uses as
   without this file. */
SELFTESTS.push(function chairsToMatchCount(problems){
  const wrong=text=>problems.push('chairs to match count: '+text);
  const table=DINING_TABLE_PRESET,usual=presetDefaults(table);
  if(usual.chairs)wrong('the Dining table opens with Chairs to match ticked');
  const plain=buildTable(tableArgs('Dining table',usual)),built=table.build(usual);
  if(built.length!==plain.length||built.some(p=>p.unit))wrong('the Dining table as first opened builds other pieces than the plain table');
  if(table.joints(usual)!==tableJoints('Dining table')||JSON.stringify(table.uses(usual))!==JSON.stringify(tableUses('Dining table')))wrong('the Dining table as first opened names other joints or uses');
  for(const W of[33,27.5])for(const L of[36,42,48,54,60,66,72,74]){
    const plan=chairSetPlan(chairSetVals({L,W,ends:true})),want=L-11>=48?2:1,stops=plan.problems.filter(f=>f.level==='stop');
    if(W>=33){
      if(stops.length)wrong(`${L}" x ${W}": refused (${stops[0].text})`);
      else if(plan.perSide!==want||plan.count!==2*want+2)wrong(`${L}" x ${W}": ${plan.perSide} a side and ${plan.count} in all, not ${want} and ${2*want+2}`);
    }else{
      if(!stops.some(f=>f.code==='chairs-ends'))wrong(`${L}" x ${W}": a chair at each end is not refused, with ${fmt(chairSetTable({...usual,L,W}).shortSpan)} between the end legs`);
      const sides=chairSetPlan(chairSetVals({L,W}));
      if(sides.problems.length||sides.perSide!==want)wrong(`${L}" x ${W}": ${sides.perSide} a side, not ${want}`);
    }
  }
  // refused tables, each with a fix that, taken, clears it
  const number=(fix,pattern)=>{const m=fix.match(pattern);return m?+m[1]:null;};
  const fixes=[[{L:84},'chairs-table',fix=>{const L=number(fix,/table (\d+)" long/);return L?{L}:null;}],
    [{H:28},'chairs-table',fix=>{const H=number(fix,/table (\d+)" to/);return H?{H}:null;}],
    [{H:33},'chairs-table',fix=>{const H=number(fix,/to (\d+)" high/);return H?{H}:null;}],
    [{L:48,perSide:'2'},'chairs-count',fix=>{const L=number(fix,/table (\d+)" long/);return L?{L}:null;}],
    [{W:27,ends:true},'chairs-ends',fix=>{const W=number(fix,/table (\d+)" wide/);return W?{W}:null;}]];
  for(const[change,code,fixed]of fixes){
    const found=chairSetPlan(chairSetVals(change)).problems.find(f=>f.level==='stop'&&f.code===code);
    if(!found){wrong(`${JSON.stringify(change)} is not refused (${code})`);continue;}
    if(/undefined|NaN/.test(found.text+found.fix))wrong(`${JSON.stringify(change)}: "${found.text} ${found.fix}"`);
    // the table's own sizes speak the way its boxes do while the form is talking (typedLen: 7'-0", not 84"), and
    // in inches in the notes; the chairs' sizes stay in inches
    const typed=speakAsBoxes(()=>chairSetPlan(chairSetVals(change)).problems.find(f=>f.level==='stop'&&f.code===code));
    const quoted=change.L!==undefined&&code==='chairs-table'?change.L:change.H!==undefined?change.H:null;
    if(quoted!==null&&!(typed.text+typed.fix).includes(boxLen(quoted)))wrong(`${JSON.stringify(change)}: under the form the table's ${fmt(quoted)} is not written as its box writes it (${boxLen(quoted)}): "${typed.text}"`);
    if(/\d'-/.test(found.text+found.fix))wrong(`${JSON.stringify(change)}: in the notes a size is in feet and inches: "${found.text} ${found.fix}"`);
    if(/(seat|chair)[^.]*\d'-/.test(typed.text.replace(/table \S+ (high|long|wide)/g,'')))wrong(`${JSON.stringify(change)}: a chair's size in feet and inches under the form: "${typed.text}"`);
    const after=fixed(found.fix);
    if(!after)wrong(`${JSON.stringify(change)}: the fix "${found.fix}" names no size`);
    else if(chairSetPlan(chairSetVals({...change,...after})).problems.some(f=>f.level==='stop'))wrong(`${JSON.stringify(change)}: the fix "${found.fix}" does not clear it`);
    if(table.build(chairSetVals(change)).some(p=>p.unit))wrong(`${JSON.stringify(change)}: chairs are built though refused`);
  }
  // the seat height follows the table (spec section 2): 17 1/2" at 30", 17" at 29", 19" at 32"
  for(const[H,seat]of[[30,17.5],[29,17],[31,18.5],[32,19]]){
    const plan=chairSetPlan(chairSetVals({H}));
    if(plan.seat!==seat)wrong(`at a table ${H}" high the seats are ${fmt(plan.seat)}, not ${fmt(seat)}`);
  }
});

/* Tucked in and clear: no clash; no chair touches the table (they are not fastened to it); every seat 7" or more
   under the apron and between the legs; seats facing each other 1" or more apart; end chairs' seats 1" or more
   short of the side chairs' seats; every chair square-set, on the floor, facing the table, a component of its own. */
SELFTESTS.push(chairSetChecked(function chairsTuckedClear(wrong){
  const tries=[{},{ends:true},{L:36,W:27},{L:74,ends:true},{L:48,W:44,ends:true},{H:29},{H:32,ends:true},{chairUpright:true,ends:true},{perSide:'1',ends:true}];
  for(const change of tries){
    const vals=chairSetVals(change),label=JSON.stringify(change);
    if(!placeTableSet(vals,'std')){wrong(`${label} builds nothing`);continue;}
    const plan=chairSetPlan(vals),t=plan.table,units=chairUnits();
    if(units.size!==plan.count)wrong(`${label}: ${units.size} chairs placed, not ${plan.count}`);
    if(findClashes().length)wrong(`${label}: ${findClashes()[0].map(p=>p.name).join(' runs into ')}`);
    if(findJoints().some(j=>(j.a.unit||'')!==(j.b.unit||'')))wrong(`${label}: a chair touches the table or another chair`);
    const legs=bbox(S.parts.filter(p=>!p.unit&&p.name==='Leg')),middle=[(legs.lo[0]+legs.hi[0])/2,(legs.lo[2]+legs.hi[2])/2];
    const seats=[];
    for(const[unit,parts]of units){
      if(parts.some(p=>p.q||p.rot))wrong(`${label}: ${unit} is not square-set`);
      if(Math.min(...parts.map(p=>box(p).lo[1]))!==0)wrong(`${label}: ${unit} does not stand on the floor`);
      const seat=bbox(parts.filter(p=>/seat board/i.test(p.name)));
      if(t.legH-t.apronDepth-seat.hi[1]<CHAIR_RULES.thighLeast-1e-6)wrong(`${label}: ${unit}'s seat is only ${fmt(t.legH-t.apronDepth-seat.hi[1])} under the apron`);
      const centre=b=>[(b.lo[0]+b.hi[0])/2,(b.lo[2]+b.hi[2])/2];
      const backs=centre(bbox(parts.filter(p=>p.name==='Back leg'))),fronts=centre(bbox(parts.filter(p=>p.name==='Front leg')));
      if(Math.hypot(backs[0]-middle[0],backs[1]-middle[1])<=Math.hypot(fronts[0]-middle[0],fronts[1]-middle[1]))wrong(`${label}: ${unit} does not face the table`);
      const end=Math.abs(backs[0]-fronts[0])>Math.abs(backs[1]-fronts[1]);
      // between the legs: a side chair between the legs along x, an end chair between the end legs along z
      const k=end?2:0;
      if(seat.lo[k]<legs.lo[k]+t.leg-1e-6||seat.hi[k]>legs.hi[k]-t.leg+1e-6)wrong(`${label}: ${unit}'s seat is not between the table legs`);
      // the tuck of spec 11.1: the back legs' front edge at the height of the top stands 1" (or, where two seats
      // face each other or an end chair meets the side chairs, more) outside the edge of the top, never under it
      // (axis k2: the way this chair runs front to back in the room; out: +1 or -1, away from the table)
      const k2=end?0:2,c=end?0:1,out=Math.sign(backs[c]-middle[c]);
      const legBox=bbox(parts.filter(p=>p.name==='Back leg')),backFace=out>0?legBox.hi[k2]:legBox.lo[k2];
      const frontAtTop=backFace-out*Math.min(plan.chair.legDepth,plan.chair.frontAt(t.H));
      const edge=out>0?(end?t.L:t.W):0;
      const outside=out*(frontAtTop-edge);
      // (to 1/32": the pieces are placed to the sixteenth, the tapered edge is not)
      if(outside<CHAIR_SET_RULES.outside-1/32)wrong(`${label}: the back legs of ${unit} stand only ${fmt(r16(outside))} outside the edge of the top at its height`);
      if(!end&&plan.under<(t.W-CHAIR_SET_RULES.facing)/2-1e-3&&outside>CHAIR_SET_RULES.outside+1/16)wrong(`${label}: ${unit} is tucked in ${fmt(r16(outside-CHAIR_SET_RULES.outside))} less than the spec's 1" outside the top`);
      const comp=compChain(parts[0].id).slice(-1)[0];
      if(!comp||comp.parent!=null||compPieceIds(comp.id).length!==parts.length)wrong(`${label}: ${unit} is not a component of its own`);
      seats.push({unit,seat,end});
    }
    for(let i=0;i<seats.length;i++)for(let j=i+1;j<seats.length;j++){
      const a=seats[i].seat,b=seats[j].seat,gap=Math.max(...[0,2].map(k=>Math.max(a.lo[k]-b.hi[k],b.lo[k]-a.hi[k])));
      const least=seats[i].end||seats[j].end?CHAIR_SET_RULES.endClear:CHAIR_SET_RULES.facing;
      if(gap<least-1e-6)wrong(`${label}: the seats of ${seats[i].unit} and ${seats[j].unit} are ${fmt(Math.max(0,gap))} apart`);
    }
  }
}));

/* Show faces and fasteners with the chairs at the table, in every style: in Everyday and Fine no head or open pocket
   hole on a show face (the back of each chair included, SHOW_FACES_OF in js/showfaces.js); in Rustic the table as
   the table's own check has it, and on the chairs only the screws down through the seat boards and the pocket holes
   on the backs;
   no two fasteners too close, none outside the wood or undrivable, every pocket hole of a chair's rail or stretcher
   on the inside of its own chair; and the structural check passes for the whole set. */
SELFTESTS.push(chairSetChecked(function chairsShowAndHold(wrong){
  for(const style of Object.keys(STYLES))for(const change of[{ends:true},{ends:true,chairUpright:true}]){
    const vals=chairSetVals(change),label=`${STYLES[style][0]} ${JSON.stringify(change)}`;
    placeTableSet(vals,style);
    const allowed=head=>style==='rustic'&&((!head.f.through.unit&&!head.f.into.unit)||(head.f.kind!=='pocket'&&/seat board|top board/i.test(head.f.through.name))||(head.f.kind==='pocket'&&chairBackRail(head.f.through)));
    const heads=headsOnShowFaces().filter(head=>!allowed(head));
    if(heads.length)wrong(`${label}: a head or open pocket hole shows (${heads[0].face}, ${heads[0].f.through.name} into ${heads[0].f.into.name})`);
    if(fastenersTooClose().length)wrong(`${label}: ${fastenersTooClose().length} pairs of fasteners closer than a drill bit`);
    let faulted=false,outside=false;
    for(const link of connGraph().links)for(const f of fastenersOfLink(link)){
      const fault=fastenerFault(f);
      if(fault&&!faulted){faulted=true;wrong(`${label}: ${f.through.name} into ${f.into.name}: ${fault}`);}
      if(f.kind!=='pocket'||!f.through.unit||!CHAIR_FRAME_NAMES.includes(f.through.name)||outside)continue;
      const k=[0,2].find(axis=>Math.abs(f.pocket.out[axis])>.5);
      if(k===undefined)continue;
      const own=bbox(S.parts.filter(p=>p.unit===f.through.unit)),face=plainBox(f.through);
      if(Math.sign((own.lo[k]+own.hi[k])/2-(face.lo[k]+face.hi[k])/2)!==Math.sign(f.pocket.out[k])){outside=true;wrong(`${label}: a pocket hole of a ${f.through.name.toLowerCase()} of ${f.through.unit} is on its outside face`);}
    }
    if(boardsNotHeldAtBothEnds().length)wrong(`${label}: a ${boardsNotHeldAtBothEnds()[0].name} is not held near both ends`);
    // each chair's seat frame braced seen from above (chairSeatBraces, js/diningchair.js)
    for(const[unit,parts]of chairUnits())if(!chairSeatBraces(parts).length){wrong(`${label}: nothing keeps the seat frame of ${unit} square seen from above`);break;}
    if(style==='std'){
      const check=checkPreset(DINING_TABLE_PRESET,vals);
      if(check.problems.length)wrong(`${label}: the structural check finds ${check.problems[0].text}`);
    }
  }
}));

/* Each chair is picked and moved as a chair: a click on a chair piece (pick components) selects that chair's pieces
   and nothing else; moving it moves only them; the table and the other chairs stay. */
SELFTESTS.push(chairSetChecked(function chairsMoveAsChairs(wrong){
  const keptLevel=pickLevel,keptSel=sel;
  try{
    placeTableSet(chairSetVals({ends:true}),'std');
    pickLevel='comp';
    const[unit,parts]=[...chairUnits()][0],ids=new Set(parts.map(p=>p.id));
    const picked=pickIds(parts[0].id);
    if(picked.length!==parts.length||picked.some(id=>!ids.has(id)))wrong(`a click on a piece of ${unit} picks ${picked.length} pieces, not its ${parts.length}`);
    // in Beginner a click picks one piece; dragging it takes along what is fastened to it: the whole chair, no more
    pickLevel='piece';
    sel=new Set([parts[0].id]);
    const followers=movingParts();
    if(followers.length!==parts.length||followers.some(p=>!ids.has(p.id)))wrong(`dragging one piece of ${unit} takes ${followers.length} pieces along, not its ${parts.length}`);
    pickLevel='comp';
    sel=new Set(picked);
    const moving=movingParts();
    if(moving.length!==parts.length||moving.some(p=>!ids.has(p.id)))wrong(`moving ${unit} takes ${moving.length} pieces along, not only its ${parts.length}`);
    const before=new Map(S.parts.map(p=>[p.id,p.pos.slice()]));
    shiftPieces(moving,[0,0,-6]);commit();
    if(S.parts.some(p=>!ids.has(p.id)&&p.pos.some((v,k)=>v!==before.get(p.id)[k])))wrong(`moving ${unit} moved something else too`);
    if(S.parts.some(p=>ids.has(p.id)&&p.pos[2]!==before.get(p.id)[2]-6))wrong(`${unit} did not move by the 6" asked`);
  }finally{pickLevel=keptLevel;sel=keptSel;}
}));

/* What the build instructions and the lists say about the chairs, for the design as it is now, with n chairs in
   it (after Create, after a chair is deleted, after one is copied). Each fault is handed to wrong(). */
function chairSetStepFaults(n,label,wrong){
  const plan=buildPlan(true);
  if(plan.suggested){wrong(`${label}: the steps are a suggested order, not the table's and the chair's`);return;}
  buildStepProblems(label).slice(0,3).forEach(wrong);   // every piece in one step, the fasteners add up (js/buildsteps.js)
  const units=chairUnits();
  if(units.size!==n)wrong(`${label}: (setting up) ${units.size} chairs in the design, not ${n}`);
  const count=name=>S.parts.filter(p=>p.name===name).length;
  if(count('Back leg')!==2*n||count('Crest rail')!==n)wrong(`${label}: ${count('Back leg')} back legs and ${count('Crest rail')} crest rails for ${n} chairs`);
  const cutQty=cutRows().rows.reduce((sum,r)=>sum+r.qty,0),wood=S.parts.filter(p=>!isProp(p)).length;
  if(cutQty!==wood)wrong(`${label}: the cut list counts ${cutQty} pieces, the design has ${wood}`);
  // the felt pads: four a chair on the shopping list, and listed in the step that sticks them on
  const pads=(S.hw||[]).filter(line=>/felt pads/i.test(line[0])).reduce((sum,line)=>sum+line[1],0);
  if(pads!==4*n)wrong(`${label}: ${pads} felt pads on the shopping list for ${n} chairs`);
  const padStep=plan.steps.find(step=>/stick felt pads/i.test(step.words));
  if(!padStep||!JSON.stringify(padStep.need||{}).includes(`Felt pads`)||!new RegExp(`\\b${4*n}\\b`).test(JSON.stringify(padStep.need||{})))
    wrong(`${label}: the step that sticks the felt pads on does not list ${4*n} of them under You need`);
  // the chair steps: the chair's own words (never written again from the pieces), each building every chair,
  // saying so first, counted as the design is now
  const chairSteps=plan.steps.filter(step=>step.pieces.some(p=>p.unit));
  if(chairSteps.length!==CHAIR_STEP_ORDER.length)wrong(`${label}: ${chairSteps.length} chair steps, not the chair's ${CHAIR_STEP_ORDER.length}`);
  const lastTable=Math.max(...plan.steps.map((step,i)=>step.pieces.some(p=>!p.unit)?i:-1));
  for(const step of chairSteps){
    if(step.source!=='preset'){wrong(`${label}: step ${step.no} is ${step.source}, not the chair's own words`);continue;}
    if(plan.steps.indexOf(step)<lastTable)wrong(`${label}: step ${step.no} builds chairs before the table is done`);
    const inStep=new Set(step.pieces.map(p=>p.unit));
    if(inStep.size!==n)wrong(`${label}: step ${step.no} builds ${inStep.size} of the ${n} chairs`);
    if(n>1&&!step.words.startsWith(`For each of the ${n} dining chairs: `))wrong(`${label}: step ${step.no} does not start "For each of the ${n} dining chairs:" (${step.words.slice(0,60)})`);
    // its picture and its Put in words show one chair: that chair's pieces of the step, and nothing of another
    const one=step.oneOf;
    if(n>1&&(!one||new Set(S.parts.filter(p=>one.has(p.id)).map(p=>p.unit)).size!==1))wrong(`${label}: step ${step.no} does not show one chair by itself`);
    if(/row \d|\d(st|nd|rd|th) /.test(step.put||''))wrong(`${label}: the Put in words of step ${step.no} list the pieces of several chairs: ${step.put.slice(0,120)}`);
  }
  // no sentence names a number of chairs other than the chairs in the design
  for(const step of plan.steps){
    for(const said of step.words.matchAll(/(?:each of the|making|count all) (\d+)/g))if(+said[1]!==n)wrong(`${label}: step ${step.no} speaks of ${said[1]} chairs, the design has ${n}`);
    if(n>1&&step.kind==='note'&&/sit still/.test(step.words)&&!new RegExp(`Do this for each of the ${n} dining chairs\\.$`).test(step.words))wrong(`${label}: the step that levels the feet is not said for each of the ${n} chairs`);
    if(step.kind==='note'&&/lists below/.test(step.words))wrong(`${label}: step ${step.no} speaks of lists below and has none`);
  }
  const cut=plan.steps.find(step=>step.kind==='cut');
  if(n>1&&(!cut||!new RegExp(`You are making ${n} dining chairs: cut each dining chair piece`).test(cut.words)))wrong(`${label}: the cutting step does not say to cut the ${n} chairs alike`);
  if(cut&&/: [A-Z]/.test(cut.words.replace(/Shapes to cut|Tip: [A-Z]/g,'')))wrong(`${label}: a capital after a colon in the cutting step: ${cut.words.match(/.{30}: [A-Z].{20}/)}`);
  const finish=plan.steps.findIndex(step=>step.kind==='finish');
  if(finish<0||finish<plan.steps.indexOf(chairSteps[chairSteps.length-1]))wrong(`${label}: the finish does not come after the chairs`);
}
/* the pieces of one chair as the person picks it in Expert (Pick: Component) */
const oneChairIds=unit=>S.parts.filter(p=>p.unit===unit).map(p=>p.id);

/* On the lists and in the steps (finding 1-3 of the stage 2 reviews): in every style, the set as Create makes it,
   then with a chair deleted (an end chair; and the first chair, whose pieces the steps were written with), then
   with one chair copied beside the table. Every time: the counts in the words, the felt pads, the pictures and the
   Put in words of one chair, the chair's own words kept (chairSetStepFaults). And the copy is a chair of its own:
   every pocket hole of every chair on the inside of its own chair, no head or open hole on a show face. */
SELFTESTS.push(chairSetChecked(function tableAndChairsSteps(wrong){
  const selKept=sel;
  try{
    for(const style of Object.keys(STYLES)){
      const vals=chairSetVals({ends:true}),label=STYLES[style][0];
      placeTableSet(vals,style);
      const n=chairSetPlan(vals).count;
      chairSetStepFaults(n,label,wrong);
      // an end chair deleted, then the first chair too
      sel=new Set(oneChairIds(`Dining chair ${n}`));delSel();
      chairSetStepFaults(n-1,`${label}, the last chair deleted`,wrong);
      sel=new Set(oneChairIds('Dining chair 1'));delSel();
      chairSetStepFaults(n-2,`${label}, the first chair deleted too`,wrong);
      if(style==='rustic')continue;
      // one chair copied, set beside the table: a chair of its own
      placeTableSet(vals,style);
      const originals=new Set(oneChairIds('Dining chair 1'));
      sel=new Set(originals);
      copyRow(1,0,-30);
      const copied=[...sel].filter(id=>!originals.has(id)).map(byId);
      if(copied.length!==oneChairIds('Dining chair 1').length||new Set(copied.map(p=>p.unit)).size!==1||copied[0].unit==='Dining chair 1')wrong(`${label}: a copied chair does not become a chair of its own (${copied[0]&&copied[0].unit})`);
      chairSetStepFaults(n+1,`${label}, a chair copied`,wrong);
      chairPocketsInside(`${label}, a chair copied`,wrong);
      const heads=headsOnShowFaces();
      if(heads.length)wrong(`${label}, a chair copied: a head or open pocket hole shows (${heads[0].face}, ${heads[0].f.through.name} of ${heads[0].f.through.unit||'the table'})`);
    }
  }finally{sel=selKept;}
}));
/* every pocket hole of a chair's rail or stretcher opens on the inside of its own chair */
function chairPocketsInside(label,wrong){
  for(const link of connGraph().links)for(const f of fastenersOfLink(link)){
    if(f.kind!=='pocket'||!f.through.unit||!CHAIR_FRAME_NAMES.includes(f.through.name))continue;
    const k=[0,2].find(axis=>Math.abs(f.pocket.out[axis])>.5);
    if(k===undefined)continue;
    const own=bbox(S.parts.filter(p=>p.set===f.through.set&&p.unit===f.through.unit)),face=plainBox(f.through);
    if(Math.sign((own.lo[k]+own.hi[k])/2-(face.lo[k]+face.hi[k])/2)!==Math.sign(f.pocket.out[k])){wrong(`${label}: a pocket hole of a ${f.through.name.toLowerCase()} of ${f.through.unit} is on its outside face`);return;}
  }
}

/* The table keeps its own inside (code review 4): with every chair pulled 40" out from the table, in Everyday and
   Fine, no head or open pocket hole shows on the table or on a chair, and every pocket hole of the aprons opens
   toward the middle of the table. */
SELFTESTS.push(chairSetChecked(function chairsPulledOutKeepTheTableHidden(wrong){
  for(const style of['std','fine']){
    placeTableSet(chairSetVals({ends:true}),style);
    const plan=chairSetPlan(chairSetVals({ends:true})),t=plan.table;
    const middle=[t.L/2,t.W/2];
    // the chairs along the front and the one at the right end, each 40" farther out from the table, the way its
    // back faces: the whole design's middle moves well past the front apron (the others stay tucked in)
    for(const parts of chairUnits().values()){
      const backs=bbox(parts.filter(p=>p.name==='Back leg')),fronts=bbox(parts.filter(p=>p.name==='Front leg'));
      const dx=(backs.lo[0]+backs.hi[0]-fronts.lo[0]-fronts.hi[0])/2,dz=(backs.lo[2]+backs.hi[2]-fronts.lo[2]-fronts.hi[2])/2;
      if(dx<=0&&dz<=0)continue;
      const len=Math.hypot(dx,dz)||1;
      shiftPieces(parts,[r16(40*dx/len),0,r16(40*dz/len)]);

    }
    commit();
    const label=`${STYLES[style][0]}, the chairs pulled out`;
    const heads=headsOnShowFaces();
    if(heads.length)wrong(`${label}: a head or open pocket hole shows (${heads[0].face}, ${heads[0].f.through.name} into ${heads[0].f.into.name})`);
    for(const link of connGraph().links)for(const f of fastenersOfLink(link)){
      if(f.kind!=='pocket'||f.through.unit||!/apron/i.test(f.through.name))continue;
      const k=[0,2].find(axis=>Math.abs(f.pocket.out[axis])>.5);
      if(k===undefined)continue;
      const face=plainBox(f.through),centre=(face.lo[k]+face.hi[k])/2,toward=Math.sign(middle[k===0?0:1]-centre);
      if(Math.sign(f.pocket.out[k])!==toward){wrong(`${label}: a pocket hole of the ${f.through.name.toLowerCase()} opens on its outside face`);break;}
    }
    chairPocketsInside(label,wrong);
  }
}));

/* On the lists (spec 11.1, chairsOnTheLists): with the chairs facing all four ways, each chair piece is ONE row of
   the cut list with every chair's pieces in it (2 back legs a chair, 1 crest rail a chair ...), and the drill
   drawings give each kind of chair piece one drawing, or a mirror pair, for all the chairs. */
SELFTESTS.push(chairSetChecked(function chairsOnTheLists(wrong){
  const vals=chairSetVals({ends:true});
  placeTableSet(vals,'std');
  const n=chairSetPlan(vals).count,one=[...chairUnits().values()][0];
  const perChair=new Map();
  for(const p of one)perChair.set(p.name,(perChair.get(p.name)||0)+1);
  const rows=cutRows().rows,letterOf=cutRows().letterOf;
  for(const[name,each]of perChair){
    const pieces=S.parts.filter(p=>p.unit&&p.name===name);
    const letters=new Set(pieces.map(letterOf));
    const qty=rows.filter(row=>letters.has(row.id)).reduce((sum,row)=>sum+row.qty,0);
    if(pieces.length!==each*n)wrong(`${n} chairs have ${pieces.length} pieces named ${name}, not ${each*n}`);
    // (a row may also hold the table's pieces of the same board and size: the chair's own count is in it)
    if(letters.size!==1||qty<each*n)wrong(`the ${pluralName(name).toLowerCase()} of the chairs are ${letters.size} rows of the cut list (${qty} in all), not one row of ${each*n}`);
  }
  const drill=buildPlan(true).drill;
  for(const name of perChair.keys()){
    // (a piece with nothing to drill has a label of its own, without a drawing: label.way is empty)
    const labels=S.parts.filter(p=>p.unit&&p.name===name).map(p=>drill.labelOfPiece.get(p.id)).filter(label=>label&&label.way);
    const drawings=new Set(labels.filter(label=>!label.mirror).map(label=>label.name));
    if(drawings.size>1)wrong(`the ${pluralName(name).toLowerCase()} of the chairs are drilled from ${drawings.size} drawings (${[...drawings].join(', ')}), not one (or a mirror pair)`);
  }
}));

/* The set's lists agree with its steps, as stepsAgreeWithLists (js/plans.js) holds every preset at its defaults,
   where Chairs to match is off: pocket-hole screws on the list when a step fastens with pocket holes, glue only
   when a step glues, sandpaper when a step sands, the finish when there is a finishing step, and no fastener
   between pieces that only touch (the table's top boards, the chairs' seat boards). In every style. */
SELFTESTS.push(chairSetChecked(function tableAndChairsAgreeWithLists(wrong){
  const onlyTouch=[['Top board','Top board'],['Seat board','Seat board'],['Seat board','Back seat board'],['Front seat board','Seat board'],['Front seat board','Front leg'],['Seat board','Back leg']];
  for(const style of Object.keys(STYLES)){
    placeTableSet(chairSetVals({ends:true}),style);
    const label=STYLES[style][0]+': ',joints=findJoints(),hardware=hardwareTotals(joints);
    const items=hardware.rows.map(row=>row[0]).join(' | '),plan=buildPlan(true),words=plan.steps.map(step=>step.words).join(' ');
    if(/pocket/i.test(words)&&!/pocket-hole screws/.test(items))wrong(label+'a step fastens with pocket holes, and no pocket-hole screws are on the hardware list');
    if(hardware.glue&&!/glue/i.test(words))wrong(label+'wood glue is on the shopping list and no step glues anything');
    if(/\bglue (every|each|the ends)|Spread (a thin line of wood )?glue/i.test(words)&&!hardware.glue)wrong(label+'a step glues and no wood glue is on the shopping list');
    if(/Sandpaper/.test(items)&&!/\bsand/i.test(words))wrong(label+'sandpaper is on the shopping list and no step sands');
    if(/Polyurethane|Paint|stain/.test(items)&&!plan.steps.some(step=>step.kind==='finish'))wrong(label+'a finish is on the shopping list and the steps have no finishing step');
    if(/320 grit/.test(words)&&!/320/.test(items))wrong(label+'the finishing step asks for 320 grit sandpaper that is not on the shopping list');
    for(const[a,b]of onlyTouch){
      if(joints.some(j=>((j.a.name===a&&j.b.name===b)||(j.a.name===b&&j.b.name===a))&&jType(j)!=='none'))wrong(`${label}a fastener is listed between the ${a} and the ${b}, which only touch`);
    }
  }
}));

/* The form opens short: Length, Width, Height and Chairs to match; the three rows of the chairs only while it is
   ticked; the chairs' straight back legs start ticked in Rustic / rough only; the entry "Dining table and chairs"
   opens with Chairs to match ticked. */
SELFTESTS.push(function chairSetFormIsShort(problems){
  const wrong=text=>problems.push('chairs to match form: '+text);
  if(typeof catalogPick!=='function')return;
  const kept={picked:catalogState.picked,typed:{...catalogState.typed},preset:curPreset,entry:curEntry,style:look().style};
  const shown=()=>[...document.querySelectorAll('#presetForm .frow')].filter(row=>!row.hidden&&!row.closest('[hidden]'));
  const box=key=>$(`#presetForm [data-k="${key}"]`);
  try{
    for(const style of Object.keys(STYLES)){
      look().style=style;
      if(!catalogPick('dining-table',{fresh:true})){wrong('the dining-table entry cannot be picked');return;}
      readVals(false);
      if(box('chairUpright').checked!==(style==='rustic'))wrong(`in ${STYLES[style][0]} the chairs' straight back legs start ${box('chairUpright').checked?'ticked':'unticked'}`);
      if(style!=='std')continue;
      if(shown().length!==4||box('chairs').checked)wrong(`the Dining table opens with ${shown().length} rows${box('chairs').checked?' and Chairs to match ticked':''}, not 4 and unticked`);
      box('chairs').checked=true;readVals(false);
      if(shown().length!==7||['perSide','ends','chairUpright'].some(key=>!box(key).closest('.frow').classList.contains('sub')))wrong('ticking Chairs to match does not show its three rows, indented');
      box('chairs').checked=false;readVals(false);
      if(shown().length!==4)wrong('unticking Chairs to match leaves its rows showing');
    }
    look().style='std';
    if(!catalogPick('dining-set',{fresh:true})||!box('chairs').checked)wrong('the entry Dining table and chairs does not open with Chairs to match ticked');
    // Create with a Rustic design open: the set is built Rustic, its chairs upright, as the form showed them; a
    // plain table still starts a new design in Everyday
    const keptDesign=JSON.stringify(S),table=DINING_TABLE_PRESET;
    try{
      for(const chairs of[true,false]){
        load(JSON.stringify(blank()),true);
        look().style='rustic';
        const vals={...presetDefaults(table),chairs};
        withoutDrawing(()=>placePreset(table,vals,table.build(vals),false));
        if(chairs&&(look().style!=='rustic'||S.parts.some(p=>p.unit&&p.shape)))wrong(`Create with a Rustic design open builds the set in ${STYLES[look().style][0]}${S.parts.some(p=>p.unit&&p.shape)?' with leaning backs':''}`);
        if(!chairs&&look().style!=='std')wrong('a plain Dining table no longer starts a new design in Everyday');
      }
    }finally{load(keptDesign,true);}
  }finally{
    look().style=kept.style;
    catalogState.picked=kept.picked;catalogState.typed=kept.typed;
    if(kept.preset&&PRESETS.includes(kept.preset))choosePreset(PRESETS.indexOf(kept.preset),kept.entry);else showNoPreset();
  }
});
