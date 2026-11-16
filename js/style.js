/* NominalCAD: style, wood type, finish, and the difficulty/time/cost estimate */
'use strict';
/* ---------- style, wood and finish ---------- */
const WOODS={pine:['Construction pine or spruce (cheapest)',0xe6c592,1,0],select:['Select pine (smooth, few knots)',0xf1dcae,2.2,0],poplar:['Poplar (best under paint)',0xd8d3a4,2.4,0],
 cedar:['Cedar (outdoor, resists rot)',0xcb8f62,2.6,0],pt:['Pressure-treated pine (outdoor)',0xb7b587,1.4,0],oak:['Red oak (hardwood)',0xcf9a63,4,1],rough:['Rough-sawn or reclaimed boards',0xa5855e,1.3,0]}; // name, color, price multiplier, hardwood
const FINISHES={none:['Bare wood',null,0],clear:['Clear coat (polyurethane)',null,0],stainL:['Light stain + clear coat',0xb07a3a,1],stainD:['Dark stain + clear coat',0x5a3a20,1],
 white:['Painted white',0xf3f1ea,2],black:['Painted black',0x2e2e2e,2],gray:['Painted gray',0x8d9499,2],blue:['Painted navy blue',0x2f4a6b,2],green:['Painted sage green',0x7c9473,2]}; // name, color, 1 = stain, 2 = paint
const STYLES={rustic:['Rustic / rough','Construction lumber, screws left showing, quick sanding. Fastest, cheapest and the most forgiving.'],
 std:['Everyday','Clean and sturdy. Screws where they are easy, pocket holes where they hide. A normal sanding and finish.'],
 fine:['Fine furniture','No fasteners showing: pocket holes and glue, holes filled, sanded smooth to 220 grit. Takes the most time and care.']};
const look=()=>S.look||(S.look={style:'std',wood:'pine',finish:'clear'});
function partColor(p){const m=M[p.mat];if(m.kind==='prop')return m.color;const L=look(),c=new THREE.Color(WOODS[m.treated?'pt':L.wood][1]),f=FINISHES[L.finish]; // a pressure-treated board keeps its own greenish color
  if(m.kind==='sheet')c.multiplyScalar(.93);else if(m.id==='4x4')c.multiplyScalar(.96);
  if(f[2]===1)c.lerp(new THREE.Color(f[1]),.72);else if(f[2]===2)c.set(f[1]);
  return c.getHex();}
function styleType(t,j,style){const s=style||look().style; // the style nudges the suggested fastener; a choice made by hand always wins (js/verify.js passes the style itself)
  if(s==='rustic'&&(t==='pocket'||t==='dowel'))return'screw';
  if(s==='fine'&&t==='screw'&&!(j.fa==='face'&&j.fb==='face'))return'pocket';
  return t;}
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
  return sand+' '+fin;}
const stepText=st=>st.t===FIN.t?finText():st.t;
const surfaceSqFt=()=>S.parts.reduce((a,p)=>isProp(p)?a:a+2*(p.l*p.w+p.l*p.t+p.w*p.t)/144,0);
function finishSupplies(){const L=look(),f=FINISHES[L.finish],rows=[],a=surfaceSqFt();if(!a)return rows;
  const qt=c=>Math.max(1,Math.ceil(a*c/100)); // a quart covers about 100 sq ft per coat
  if(!hasFinishStep())return rows;                 // no step sands or finishes it: nothing to buy for that
  rows.push([`Sandpaper, ${sandpaperGrits()} (packs)`,1]);
  if(L.style==='fine')rows.push(['Wood filler, small tub',1]);
  if(f[2]===1)rows.push(['Pre-stain wood conditioner, quarts',qt(1)],['Wood stain, quarts',qt(1)]);
  if(f[2]===2)rows.push(['Primer, quarts',qt(1)],['Paint, quarts',qt(2)]);
  if(L.finish==='clear'||f[2]===1)rows.push(['Polyurethane, quarts',qt(L.style==='fine'?3:2)]);
  return rows;}
const lumberCost=()=>lumberToBuy(S.parts.concat(woodStrips()),S.stock).cost; // lumberToBuy is in plans.js, next to the board and sheet packing
function assess(lk){ // how hard, how long and how much, for a given style / wood / finish
  const keep=S.look;S.look=lk;
  try{const js=findJoints(),ts={},ps=S.parts.filter(p=>!isProp(p)),n=ps.length,f=FINISHES[lk.finish],area=surfaceSqFt();
    js.forEach(j=>{const t=jType(j);ts[t]=(ts[t]||0)+1;});
    const sc=1+(n>25?.5:0)+(n>60?.5:0)+(ps.some(p=>M[p.mat].kind==='sheet')?.5:0)+(ts.pocket?.5:0)+(ts.dowel?1:0)+(ps.some(tilted)?1:0)+WOODS[lk.wood][3]*.5+(f[2]===1?.5:0)+(lk.style==='fine'?1:lk.style==='rustic'?-.5:0);
    const mins=n*4+(ts.screw||0)*3+(ts.pocket||0)*6+(ts.dowel||0)*12+(ts.nail||0)*2+(ts.frame||0)*2+(ts.toenail||0)*3+(ts.bracket||0)*5+(ts.glue||0)*5+area*(lk.style==='rustic'?.5:lk.style==='fine'?3:1.5)+area*(lk.finish==='none'?0:f[2]?2.5:1.5);
    return{level:sc<2?'Beginner: a good first project':sc<3?'Beginner with patience':sc<4?'Some experience helps':'Experienced builder',hours:Math.max(1,Math.round(mins/60)),cost:lumberCost(),tools:toolList(js).length,pocket:!!ts.pocket};
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
const jType=j=>S.joints[j.key]||styleType(defaultType(j),j);
const TWO_SCREWS_FROM=2.25;   // inches of contact: 3/4 in at each end and 3/4 in between two screws
function jSpec(j,type){
  if(type==='frame'||type==='toenail'){   // nails for framing: js/framing.js
    // (framing looks at where the two pieces stand; inside a turned set that is read with the set standing square, js/neighbors.js)
    return j.frame&&!squaredNow?squaredUp(()=>framingSpec(j,type)):framingSpec(j,type);
  }
  const long=Math.max(j.ru[1]-j.ru[0],j.rv[1]-j.rv[0]),th=thruPart(j);
  const dT=th?(th==='a'?j.da:j.db):null,dO=th?(th==='a'?j.db:j.da):null;
  const hw=[];let text='',n=0,glue=false;
  // A fastener must stop at least 1/8 in short of the far face, or it pokes out of the wood. pickLE allows a
  // length up to .13 over what it is given (so a 1-5/8 screw can stand in for 1.5), so that slack is taken off
  // the limit here: the length picked can never reach the far face.
  const stopShort=th?dT+dO-.125-.13:0;
  // Two screws need 3/4 in from each end of the joint and 3/4 in between them (TWO_SCREWS_FROM): a shorter
  // contact (the top of a 2x2 leg, the strip of an outer board that lies over a cross rail) takes one screw in
  // its middle. Two crammed in would sit 1/2 in apart and split the wood.
  if(type==='screw'){n=long<TWO_SCREWS_FROM?1:Math.max(2,Math.ceil(long/8));
    const len=th?pickLE(SCREWS,Math.min(dT+Math.min(1.5,Math.max(.75,dT*1.2)),stopShort)):SCREWS[4];
    const screws=`#8 × ${len[1]} ${screwKind()}`;   // exterior screws in cedar and pressure-treated lumber
    text=`${n} × ${screws}`+(th?'':' driven at an angle');hw.push([screws,n]);glue=true;}
  else if(type==='pocket'){n=long<2?1:Math.max(2,Math.ceil(long/6));
    const hp=th?(th==='a'?j.b:j.a):(j.fa==='end'?j.a:j.fb==='end'?j.b:(j.a.t<=j.b.t?j.a:j.b)),t=hp.t;
    const len=t<=.55?'1"':t<=.8?'1-1/4"':t<=1.1?'1-1/2"':'2-1/2"';
    text=`${n} × ${len} pocket screws (holes in the ${hp.name.toLowerCase()})`;hw.push([`${len} pocket-hole screws`,n]);}
  else if(type==='dowel'){n=Math.max(2,Math.ceil(long/6));const thin=Math.min(j.a.t,j.b.t)<.7;
    const d=thin?'1/4" × 1"':'3/8" × 1-1/2"';text=`${n} × ${d} dowels + glue`;hw.push([`${d} wood dowels`,n]);glue=true;}
  else if(type==='nail'){n=Math.max(2,Math.ceil(long/6));
    const len=th?pickLE(BRADS,Math.min(dT*2.5,stopShort)):BRADS[3];
    text=`${n} × ${len[1]} brad nails + glue`;hw.push([`${len[1]} brad nails (18 gauge)`,n]);glue=true;}
  else if(type==='bracket'){n=Math.max(1,Math.ceil(long/18));
    text=`${n} × 1-1/2" L-bracket${n>1?'s':''} (4 screws each)`;hw.push(['1-1/2" L-brackets (corner braces)',n],['#8 × 5/8" screws for brackets',n*4]);}
  else if(type==='glue'){text='Wood glue and clamps';glue=true;}
  else text='No fastener: the pieces only touch';
  return{text,hw,n,glue};
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

