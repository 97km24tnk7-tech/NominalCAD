/* NominalCAD: what a person types is what they get.

   The owner's rule: when a preset's form asks for the size of the piece ("Width", "Depth", "Height"), the piece
   that is built is that size overall, top, countertop and lid included. A woodworker who types 26" to match a
   mattress gets 26", not 26 3/4". A form that means something else says so in its label ("Seat height", "Tray
   length", "Floor width (left to right)", "Stand height"), and its builder works out the rest from it.

   OVERALL_SIZES lists, for each preset whose form asks for an overall size, which of its boxes is the size along
   which direction of the built piece (0 left to right, 1 up, 2 front to back). The self-check
   typedSizesAreBuilt builds each such preset at its usual sizes, at the smallest and the largest of each listed box,
   and with each of its choices, and measures the wood it builds (a mattress, a fish tank or a light drawn with it
   is not counted). A table top of whole boards that cannot come out at the width typed is allowed only while
   the remark under the form says the size it comes out at instead. It also holds every form to the rule: a box labelled with a bare "Width", "Depth", "Height" or
   "Length" reads as the overall size, so its preset must be in the list. */
'use strict';

const OVERALL_AXIS={across:0,up:1,deep:2};
const OVERALL_SIZES={
  'Nightstand with drawers':{W:OVERALL_AXIS.across,D:OVERALL_AXIS.deep,H:OVERALL_AXIS.up},
  'Base cabinet with doors':{W:OVERALL_AXIS.across,D:OVERALL_AXIS.deep,H:OVERALL_AXIS.up},
  'Storage box / toy chest':{W:OVERALL_AXIS.across,D:OVERALL_AXIS.deep,H:OVERALL_AXIS.up},
  'Bookshelf':{W:OVERALL_AXIS.across,H:OVERALL_AXIS.up},
  // the cabinet builder (js/casebuild.js), which makes the Bookshelf of the catalog; its depth box is the depth of
  // the sides and says so ("Depth of the sides")
  'Cabinet / case':{W:OVERALL_AXIS.across,H:OVERALL_AXIS.up},
  'Garage shelves':{W:OVERALL_AXIS.across,D:OVERALL_AXIS.deep,H:OVERALL_AXIS.up},
  'Dining table':{L:OVERALL_AXIS.across,W:OVERALL_AXIS.deep,H:OVERALL_AXIS.up},
  'Coffee table':{L:OVERALL_AXIS.across,W:OVERALL_AXIS.deep,H:OVERALL_AXIS.up},
  'Side table / nightstand':{L:OVERALL_AXIS.across,W:OVERALL_AXIS.deep,H:OVERALL_AXIS.up},
  'Desk':{L:OVERALL_AXIS.across,W:OVERALL_AXIS.deep,H:OVERALL_AXIS.up},
  // the Computer desk and the Gaming desk (js/computerdesk.js): the Height is floor to the top of the desk; with the
  // monitor shelf ticked the remark says how tall it comes out overall
  'Computer desk':{L:OVERALL_AXIS.across,W:OVERALL_AXIS.deep,H:OVERALL_AXIS.up},
  'Workbench':{L:OVERALL_AXIS.across,W:OVERALL_AXIS.deep,H:OVERALL_AXIS.up},
  'Sturdy bench':{L:OVERALL_AXIS.across},
  'Five-board bench':{L:OVERALL_AXIS.across},
  'Entryway shoe bench':{L:OVERALL_AXIS.across},
  'Wall shelf':{L:OVERALL_AXIS.across},
  'Planter box':{L:OVERALL_AXIS.across,D:OVERALL_AXIS.deep},
  'Raised garden bed':{L:OVERALL_AXIS.across,D:OVERALL_AXIS.deep},
};
/* a label that names a plain overall size: "Width", "Depth", "Height", "Length", or one of them followed by words
   in brackets that say it is the overall size ("Height (floor to the top)", "Width (of the countertop)") */
const OVERALL_LABEL=/^(Width|Depth|Height|Length)( \((overall|of the|floor to the)\b[^)]*\))?$/;

/* The overall size of what a preset builds, in inches along each direction: the wood only. */
function builtOverall(parts){
  const wood=parts.filter(part=>!isProp(part));
  if(!wood.length)return null;
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const part of wood){
    const b=box(part);
    for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],b.lo[k]);hi[k]=Math.max(hi[k],b.hi[k]);}
  }
  return hi.map((v,k)=>v-lo[k]);
}

SELFTESTS.push(function typedSizesAreBuilt(problems){
  const wrong=text=>{if(problems.length<60)problems.push('typed sizes: '+text);};
  const DIRECTION=['wide','tall','deep'];
  // every form whose box reads as an overall size is on the list
  for(const preset of PRESETS){
    for(const row of preset.params){
      if(!row.k||typeof row.v!=='number'||!OVERALL_LABEL.test(row.label||''))continue;
      const listed=OVERALL_SIZES[preset.name];
      if(!listed||listed[row.k]===undefined)wrong(`${preset.name}: its box "${row.label}" reads as the overall size, and it is not in OVERALL_SIZES (js/overallsizes.js), so nothing holds the piece to it`);
    }
  }
  let measured=0;
  for(const[name,boxes]of Object.entries(OVERALL_SIZES)){
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(!preset){wrong(`${name} is in OVERALL_SIZES and is no preset`);continue;}
    const usual=presetDefaults(preset);
    // the usual sizes, each listed box at its smallest and its largest, and each choice of the form at the usual sizes
    const tries=[{vals:usual,where:'its usual sizes'}];
    for(const row of preset.params){
      if(boxes[row.k]===undefined)continue;
      if(row.min!==undefined)tries.push({vals:{...usual,[row.k]:row.min},where:`${row.label} ${row.min}`});
      if(row.max!==undefined)tries.push({vals:{...usual,[row.k]:row.max},where:`${row.label} ${row.max}`});
    }
    for(const row of preset.params){
      if(row.opts)for(const opt of row.opts){const value=Array.isArray(opt)?opt[0]:opt;if(value!==usual[row.k])tries.push({vals:{...usual,[row.k]:value},where:`${row.label} ${value}`});}
      else if(row.check)tries.push({vals:{...usual,[row.k]:!usual[row.k]},where:`${row.label} ${usual[row.k]?'off':'on'}`});
    }
    (preset.variants||[]).forEach((variant,index)=>tries.push({vals:{...usual,...variant},where:`variant ${index+1}`}));
    for(const{vals,where}of tries){
      // a size the preset itself refuses builds nothing to measure
      if(preset.check&&(preset.check(vals)||[]).some(found=>found.level==='stop'))continue;
      let parts=[];
      try{parts=preset.build(vals)||[];}catch(e){wrong(`${name} at ${where}: building it threw ${e.message}`);continue;}
      const got=builtOverall(parts);
      if(!got)continue;
      measured++;
      // (a preset that has to round a size, such as a table top of whole boards, may build another size only
      // when the remark under its form says so, with the size it comes out at: "it comes out 27 1/2" from front
      // to back instead of 27"" (the preset rule: a number the preset corrects is said in info(p)))
      const remark=preset.info?String(preset.info(vals)||''):'';
      const said=size=>new RegExp(`comes out ${fmt(r16(size)).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[^.]* instead of`).test(remark);
      for(const[key,axis]of Object.entries(boxes)){
        if(Math.abs(got[axis]-vals[key])>1/32&&!said(got[axis]))wrong(`${name} at ${where}: ${key} is typed ${fmt(vals[key])} and the piece comes out ${fmt(r16(got[axis]))} ${DIRECTION[axis]}`);
      }
    }
  }
  if(measured<60)wrong(`only ${measured} designs were measured: the check found too few`);
});
