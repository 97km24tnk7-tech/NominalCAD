/* NominalCAD: the rules of shaped pieces (design\specs\03, section 4).

     shapeFindings(parts)     the findings of every shaped piece, in the format of the structural check
                              ({level, code, ids, group, rank, text, fix}); verifyDesign (js/verify.js) adds them, so
                              Check my design and the presets form show them like any other finding
     shapePieceFindings(p)    the findings of one piece (Properties refuses a typed value that makes a STOP)
     shapeNetWidth(p)         the width of wood left beside the widest opening (bending, V4)
     shapeOpenShare(p)        the largest share of a panel's width or length an opening takes out (bending, V4)

   A shape never adds a load path; it only takes wood away. The rules, each with where its number comes from:
     S1  wood left between an opening and an edge, an end, a cut or another opening: under 1/4" stop, under 3/8"
         warn (the program's own rules 6 and 3 of js/fasteners.js, FASTEN.dowelCover and FASTEN.edgeMin)
     S3  an opening wholly inside the piece (geometry)
     S4  the cuts of the two ends leave at least 1/4" of short side (the same program rule)
     S5  radii and corners (geometry)
     S6  saw limits: a miter over 50°, a bevel over 45° (design\reference\21-shaping-tools.md, sections 2a and 4)
     S10 at most 40 lines in a piece's list, 1,000 openings (program limits)
     W4  a turned post standing on an end that is not flat on the floor (2°, this program's own rule of thumb).
         Written, and OFF until the lead has seen what it says about the 22 presets (SHAPE_W4_ON).
     W5  a joint left with fewer than 2 fasteners because the others had no room beside a hole or a cut
     W6  an end cut at an angle that only touches another piece: no fasteners are worked out for it */
'use strict';

const SHAPE_W4_ON=false;      // spec 03, V5: "run it on all 22 presets first and report ... before it is switched on"
const SHAPE_W4_DEGREES=2;     // a 2x4 foot that is 2° off rocks less than 1/8" (3.5 x tan 2° = 0.12")

/* the name of a feature in a sentence: 'The 6" hole', 'The 4" × 1 1/4" cut-out' */
function featureName(f){
  if(f.kind==='hole')return`${fmt(f.d)} hole`;
  if(f.kind==='cutout')return`${fmt(f.a)} × ${fmt(f.b)} cut-out`;
  if(f.kind==='slot')return`${fmt(f.d)} × ${fmt(f.len)} slot`;
  return`${fmt(f.len)} × ${fmt(f.depth)} notch`;
}
/* the side of the blank nearest a feature: 'top end', 'front edge' */
function nearestSide(p,b,names){
  const sides=[[b.u0,shapeLower(names.end[0])],[p.l-b.u1,shapeLower(names.end[1])],[b.v0,shapeLower(names.edge[0])],[p.w-b.v1,shapeLower(names.edge[1])]];
  return sides.reduce((best,side)=>side[0]<best[0]?side:best)[1];
}
const sixteenthUp=x=>Math.ceil(x*16-1e-9)/16;
/* the words of S3 for an opening that does not fit: [text, fix]. It may run off a side of the blank (by how much,
   and how far to move it to leave 1/4" of wood), lie wholly past it (after the piece was made shorter), or run into
   a cut (an angled end, a corner) while inside the blank. */
function offWords(p,f,b,names){
  const name=featureName(f);
  const sides=[
    {over:-b.u0,past:b.u1<=1e-6,side:names.end[0],toward:names.end[1],size:'longer'},
    {over:b.u1-p.l,past:b.u0>=p.l-1e-6,side:names.end[1],toward:names.end[0],size:'longer'},
    {over:-b.v0,past:b.v1<=1e-6,side:names.edge[0],toward:names.edge[1],size:'wider'},
    {over:b.v1-p.w,past:b.v0>=p.w-1e-6,side:names.edge[1],toward:names.edge[0],size:'wider'},
  ];
  const worst=sides.reduce((best,side)=>side.over>best.over?side:best);
  if(worst.over<=1e-6){
    return[`The ${name} in ${p.name} runs into the cut at the ${nearestSide(p,b,names)}.`,'Move it in, or make it smaller.'];
  }
  const move=fmt(sixteenthUp(worst.over+SHAPE_RULE.least));   // back onto the piece, with 1/4" of wood left (S1)
  const toward=`toward the ${shapeLower(worst.toward)}`;
  if(worst.past){
    return[`The ${name} is now past the ${shapeLower(worst.side)} of ${p.name}: none of it is on the piece.`,
      `Move it at least ${move} ${toward}, or make ${p.name} ${worst.size}.`];
  }
  return[`The ${name} in ${p.name} runs off the piece by ${fmt(sixteenthUp(worst.over))} at the ${shapeLower(worst.side)}.`,
    `Move it at least ${move} ${toward}, or make it smaller.`];
}

function shapePieceFindings(p){
  if(!p.shape)return[];
  const found=[],names=shapeNames(p),outline=shapeOutline(p),loop=outlineAt(p,p.t/2,outline);
  const add=(level,code,text,fix,rank)=>found.push({level,code:'shape-'+code,ids:[p.id],group:p.name+'|'+code+'|'+text,rank:rank||1,text,fix:fix||''});
  const feats=shapeFeatures(p);

  // S10: how many
  const openings=feats.filter(f=>f.kind!=='notch').length;
  if(feats.length>SHAPE_RULE.features)add('stop','many',`A piece can have at most ${SHAPE_RULE.features} holes and cuts in its list, and ${p.name} has ${feats.length}. Use fewer, or split the piece in two.`);
  if(openings>SHAPE_RULE.openings)add('stop','many',`A piece can have at most ${SHAPE_RULE.openings.toLocaleString()} holes. Use fewer, or split the piece in two.`);

  // S4: the cuts of the two ends meet
  const sides=shortSides(p);
  if(sides.least<SHAPE_RULE.shortSide-1e-6){
    const end=[0,1].map(i=>shapeEnd(p,i)).find(e=>e&&e.cut==='round');
    const saw=[0,1].map(i=>shapeEnd(p,i)).find(e=>e&&e.cut==='saw'&&e.miter);
    const why=saw?`at ${degText(saw.miter)} a cut takes ${fmt(p.w*Math.tan(degToRad(saw.miter)))} off the length of a ${fmt(p.w)} wide piece`
      :end?`a ${fmt(Math.min(end.r,p.w/2))} radius takes ${fmt(Math.min(end.r,p.w/2))} off the end`:'the cuts take more than the length';
    add('stop','ends-meet',`The cuts at the two ends of ${p.name} meet: ${why}, and this piece is only ${fmt(p.l)} long.`,'Make the piece longer, or use a smaller angle.');
  }
  // S5: rounded ends, corners
  [0,1].forEach(i=>{
    const e=shapeEnd(p,i);
    if(e&&e.cut==='round'&&e.r>p.w/2+1e-6)add('stop','round',`A rounded end can be at most half the width: ${fmt(p.w/2)} on this ${fmt(p.w)} wide piece.`,`Make the radius of the ${shapeLower(names.end[i])} ${fmt(p.w/2)} or less.`);
  });
  const corners=[0,1,2,3].map(i=>shapeCorner(p,i));
  corners.forEach((c,i)=>{
    if(!c)return;
    if(shapeEnd(p,i<2?0:1)){add('stop','corner-end',`A corner can only be cut on a square end. Make the ${shapeLower(names.end[i<2?0:1])} of ${p.name} square first.`,'Or take the corner cut off.');return;}
    if(c.cut==='notch'&&(c.a>=p.l-1e-6||c.b>=p.w-1e-6))add('stop','corner-notch',`A notch cannot take a whole side of ${p.name}.`,'Make the notch smaller.');
    if(c.cut==='round'){
      const sameEnd=corners[i<2?(i===0?1:0):(i===2?3:2)],sameEdge=corners[(i+2)%4];
      const most=!sameEnd&&!sameEdge?Math.min(p.l,p.w):Math.min(p.l,p.w)/2;
      if(c.r>most+1e-6)add('stop','corner-round',`The rounded corners of ${p.name} overlap. Make them ${fmt(most)} or smaller.`,'');
    }
  });
  // two corners on the same end (across the width) or the same edge (along the length) that run into each other
  const reach=c=>!c?{a:0,b:0}:c.cut==='round'?{a:c.r,b:c.r}:{a:c.a,b:c.b};
  for(const[i,k]of[[0,1],[2,3]])if(corners[i]&&corners[k]&&reach(corners[i]).b+reach(corners[k]).b>p.w+1e-6)add('stop','corner-overlap',`The corner cuts at the ${shapeLower(names.end[i<2?0:1])} of ${p.name} run into each other.`,'Make them smaller.');
  for(const[i,k]of[[0,2],[1,3]])if(corners[i]&&corners[k]&&reach(corners[i]).a+reach(corners[k]).a>p.l+1e-6)add('stop','corner-overlap',`The corner cuts along the ${shapeLower(names.edge[i%2])} of ${p.name} run into each other.`,'Make them smaller.');

  // S6: saw limits
  [0,1].forEach(i=>{
    const e=shapeEnd(p,i);
    if(!e)return;
    const steep=e.cut==='saw'?e.miter:e.cut==='point'&&e.across==='w'?e.deg:0;
    if(steep>SHAPE_RULE.sawMiter+1e-6)add('warn','saw',`Most miter saws stop at ${SHAPE_RULE.sawMiter}°. Mark this ${degText(steep)} cut on ${p.name} and cut it with a circular saw or a jigsaw.`,'');
    const tilt=e.cut==='saw'?e.bevel:e.cut==='point'&&e.across==='t'?e.deg:0;
    if(tilt>SHAPE_RULE.sawBevel+1e-6)add('warn','saw',`A saw blade tilts to ${SHAPE_RULE.sawBevel}° on any saw. Mark this ${degText(tilt)} cut on ${p.name} and cut it by hand, or make it ${SHAPE_RULE.sawBevel}° or less.`,'');
  });

  // S3 and S1: every opening inside the piece, with enough wood around it
  const rings=[],missing=misfits(p);   // the openings kept but not cut (js/shapes.js)
  for(const f of feats){
    const b=featureBounds(p,f);
    // two openings that run into each other: neither is cut, one STOP for the pair
    const pairs=missing.overlaps.filter(pair=>pair.includes(f));
    if(pairs.length){
      for(const pair of pairs.filter(pair=>pair[0]===f))add('stop','overlap',`The ${featureName(f)} in ${p.name} runs into the ${featureName(pair[1])}. Two openings cannot share wood: the saw or the bit would cut into the other one.`,'Move one of them, or make it smaller.');
      continue;
    }
    if(missing.bad.includes(f)){
      add('stop','off',...offWords(p,f,b,names));
      continue;
    }
    if(f.kind==='notch')continue;
    const c=featureCenter(p,f);
    // wood between the opening and the outline (the true circle for a hole)
    const gap=f.kind==='hole'?distanceToLoop(c.u,c.v,loop)-f.d/2:Math.min(...openingPoints(p,f).map(([u,v])=>distanceToLoop(u,v,loop)));
    rings.push({f,c,ring:openingPoints(p,f)});
    s1(f,gap,`at the ${nearestSide(p,b,names)}`);
  }
  // between two openings
  for(let i=0;i<rings.length;i++)for(let k=i+1;k<rings.length;k++){
    const A=rings[i],B=rings[k];
    // (true circles for two holes; else the least distance between the two outlines, looked at both ways)
    const gap=A.f.kind==='hole'&&B.f.kind==='hole'?Math.hypot(A.c.u-B.c.u,A.c.v-B.c.v)-A.f.d/2-B.f.d/2:ringGap(A.ring,B.ring);
    s1(A.f,gap,`between it and the ${featureName(B.f)}`);
  }
  function s1(f,gap,where){
    const name=featureName(f);
    if(gap<SHAPE_RULE.least-1e-6){
      const more=sixteenthUp(SHAPE_RULE.least-Math.max(0,gap));
      add('stop','thin',`The ${name} in ${p.name} leaves only ${fmt(Math.max(0,gap))} of wood ${where}. Wood that thin breaks off when you cut it.`,`Move the ${f.kind==='hole'?'hole':'opening'} at least ${fmt(more)} toward the middle, or make it smaller.`,-gap);
    }else if(gap<SHAPE_RULE.safer-1e-6){
      add('warn','thin',`Only ${fmt(gap)} of wood is left beside the ${name} in ${p.name}, ${where}. It may crack when you cut it or if it is knocked. 3/8" or more is safer.`,'',-gap);
    }
  }
  return found;
}

/* the lean of a turned post that stands on the floor, and the angle between its foot and the floor (W4) */
function footOnTheFloor(p){
  const q=quatOf(p);
  if(!q||isProp(p))return null;
  const along=AXV[p.ax[0]].clone().applyQuaternion(q);
  if(Math.abs(along.y)<Math.max(Math.abs(along.x),Math.abs(along.z)))return null;   // not standing: a beam
  const b=box(p);
  if(b.lo[1]>.05)return null;                                                         // not on the floor
  const bottom=along.y>0?0:1,e=shapeEnd(p,bottom);
  // the outward normal of the bottom end in the piece's frame (u, v, s), then in the world
  let n=[bottom===1?1:-1,0,0];
  if(e&&e.cut==='saw'){
    const tm=Math.tan(degToRad(e.miter||0)),tb=Math.tan(degToRad(e.bevel||0))/Math.cos(degToRad(e.miter||0));
    n=[bottom===1?1:-1,(e.long===1?-1:1)*tm,(e.bevelLong===1?-1:1)*tb];
  }else if(e)return null;   // a round or pointed foot is not meant to stand flat
  const world=new THREE.Vector3();
  for(let k=0;k<3;k++)world.setComponent(p.ax[k],n[k]);
  world.normalize().applyQuaternion(q);
  const off=Math.acos(Math.max(-1,Math.min(1,-world.y)))*180/SHAPE_PI;
  const lean=Math.acos(Math.min(1,Math.abs(along.y)))*180/SHAPE_PI;
  return{off,lean,bottom,cut:e&&e.cut==='saw'?e.miter:0};
}
function footFinding(p){
  const foot=footOnTheFloor(p);
  if(!foot||foot.off<=SHAPE_W4_DEGREES)return null;
  const end=shapeLower(shapeEndName(p,foot.bottom));
  return{level:'warn',code:'shape-foot',ids:[p.id],group:p.name+'|foot',rank:foot.off,
    text:`${p.name} stands on the corner of its ${end}: the end is cut at ${degText(foot.cut)} but the piece leans ${degText(foot.lean)}, so it will rock and dig in.`,
    fix:`Cut that end at ${degText(foot.lean)} (Shape, in Properties), or stand the piece straight.`};
}

function shapeFindings(given){
  // (the structural check is handed damaged files too: what is not a readable piece is its business, not this)
  if(!Array.isArray(given))return[];
  const parts=given.filter(p=>p&&typeof p==='object'&&M[p.mat]&&Array.isArray(p.ax)&&Array.isArray(p.pos)&&isFinite(p.l)&&isFinite(p.w)&&isFinite(p.t));
  try{return shapeFindingsOf(parts);}catch(e){return[];}
}
function shapeFindingsOf(parts){
  const found=[];
  for(const p of parts){
    if(isProp(p))continue;
    if(p.shape)found.push(...shapePieceFindings(p));
    if(SHAPE_W4_ON&&tilted(p)){const foot=footFinding(p);if(foot)found.push(foot);}
  }
  // W6: an end cut at an angle that only touches another piece
  const shaped=parts.some(p=>p.shape);
  if(shaped&&typeof shapeEndTies==='function'){
    for(const tie of shapeEndTies(parts)){
      const cut=tie.cutEnd,other=tie.a===cut?tie.b:tie.a,end=shapeEnd(cut,tie.endIndex);
      const how=end&&end.cut==='round'?'rounded':end&&end.cut==='point'?'cut to a point':'cut at an angle';
      found.push({level:'warn',code:'shape-tie',ids:[cut.id,other.id],group:cut.name+'|'+other.name,rank:1,
        text:`The ${shapeLower(shapeEndName(cut,tie.endIndex))} of ${cut.name} is ${how} and only touches ${other.name}. The program does not work out screws for that yet.`,
        fix:'Fasten them by hand as the plan you follow says, or make that end square.'});
    }
  }
  // W5: a joint whose fasteners had no room beside a hole or a cut (keepOffOpenings, js/shapes.js). Only for the
  // design on screen: the layouts are those of its connections.
  if(shaped)found.push(...fastenersLeftOut(parts));
  return found;
}
function fastenersLeftOut(parts){
  if(typeof connGraph!=='function'||parts.length!==S.parts.length||parts.some((p,i)=>p!==S.parts[i]))return[];
  const found=[];
  for(const link of connGraph().links){
    const j=link.joint;
    if(!j||!j.shapes||!link.fastened||link.type==='glue'||link.type==='angled')continue;
    const laid=layoutAsLaidOut(link);
    if(!laid.planned||!laid.dropped)continue;
    const kept=laid.length,planned=laid.planned;
    if(kept>=Math.min(2,planned))continue;   // two or more are still there (or the one there was to be)
    const shapedOne=[j.a,j.b].find(p=>p.shape),opening=shapeFeatures(shapedOne).some(f=>f.kind!=='notch')?'hole':'cut';
    const what=link.type==='nail'?'brads':link.type==='dowel'?'dowels':link.type==='pocket'?'pocket screws':link.type==='bracket'?'brackets':'screws';
    found.push({level:'warn',code:'shape-fasteners',ids:[j.a.id,j.b.id],group:j.a.name+'|'+j.b.name+'|left out',rank:planned-kept,
      text:`${planned-kept} of the ${planned} ${what} between ${j.a.name} and ${j.b.name} had no room beside the ${opening} in ${shapedOne.name}, so they were left out.`,
      fix:`${planned>=2?'Two or more are needed: m':'M'}ove the ${opening}, or fasten this joint another way.`});
  }
  return found;
}

/* ---------- bending with an opening (V4) ---------- */
function shapeNetWidth(p){
  let widest=0;
  for(const f of shapeFeatures(p)){
    const b=featureBounds(p,f);
    widest=Math.max(widest,Math.min(p.w,b.v1)-Math.max(0,b.v0));
  }
  return Math.max(p.w*.05,p.w-widest);
}
function shapeOpenShare(p){
  let share=0;
  for(const f of shapeFeatures(p)){
    const b=featureBounds(p,f);
    share=Math.max(share,(b.v1-b.v0)/p.w,(b.u1-b.u0)/p.l);
  }
  return Math.min(.95,share);
}

/* ---------- self-checks ---------- */
/* each rule at its limit and a sixteenth past it: silent (or the lesser level), then it fires */
SELFTESTS.push(function shapeRulesAtTheirEdges(problems){
  const wrong=text=>problems.push('shape rules: '+text);
  const levelOf=(p,code)=>{
    const hits=shapePieceFindings(p).filter(f=>f.code==='shape-'+code);
    return hits.some(f=>f.level==='stop')?'stop':hits.length?'warn':'';
  };
  const piece=(mat,l,w,t,shape)=>{const p={id:-1,name:'Test',mat,l,w,t,ax:[0,2,1],pos:[0,0,0],shape};tidyShape(p);return p;};
  const blank=()=>({v:1,ends:[null,null],corners:[null,null,null,null],feats:[]});
  // S1: a 1" hole in a 3 1/2" board, its center moved toward edge 0: wood left 1/4" (warn), 3/16" (stop), 3/8" (silent)
  for(const[left,want]of[[.375,''],[.375-1/16,'warn'],[.25,'warn'],[.25-1/16,'stop']]){
    const s=blank();s.feats.push({kind:'hole',d:1,at:{u:{from:'mid',d:0},v:{from:0,d:left+.5}}});
    const got=levelOf(piece('2x4',24,3.5,1.5,s),'thin');
    if(got!==want)wrong(`a hole leaving ${fmt(left)} of wood gives "${got||'nothing'}", not "${want||'nothing'}"`);
  }
  // the scoreboard drink shelf (sheet 04 [18]): 4" x 10 1/4" with two 3" holes leaves 1/2": no finding
  const shelf=blank();
  shelf.feats.push({kind:'hole',d:3,at:{u:{from:0,d:2.5},v:{from:'mid',d:0}}},{kind:'hole',d:3,at:{u:{from:1,d:2.5},v:{from:'mid',d:0}}});
  if(shapePieceFindings(piece('1x4',10.25,4,.75,shelf)).length)wrong('the drink shelf with two 3" holes gets a finding');
  // S3: a hole that runs off the end
  const off=blank();off.feats.push({kind:'hole',d:2,at:{u:{from:0,d:.5},v:{from:'mid',d:0}}});
  if(levelOf(piece('2x4',24,3.5,1.5,off),'off')!=='stop')wrong('a hole running off the end is not stopped');
  // (a second piece of the same shape shares the remembered outline: it must be stopped too)
  if(levelOf(piece('2x4',24,3.5,1.5,JSON.parse(JSON.stringify(off))),'off')!=='stop')wrong('a second piece with the same hole running off the end is not stopped');
  // S4: two 45° ends on a 3 1/2" board: 7 1/4" long leaves 1/4" (silent), 7 3/16" stops
  for(const[l,want]of[[7.25,''],[7.25-1/16,'stop']]){
    const s=blank();s.ends=[{cut:'saw',miter:45,long:0},{cut:'saw',miter:45,long:0}];
    const got=levelOf(piece('2x4',l,3.5,1.5,s),'ends-meet');
    if(got!==want)wrong(`two 45° ends on a ${fmt(l)} board give "${got||'nothing'}", not "${want||'nothing'}"`);
  }
  // S5: a rounded end at half the width, and a sixteenth over
  for(const[r,want]of[[1.75,''],[1.75+1/16,'stop']]){
    const s=blank();s.ends=[null,{cut:'round',r}];
    const got=levelOf(piece('2x4',24,3.5,1.5,s),'round');
    if(got!==want)wrong(`a ${fmt(r)} rounded end on a 2x4 gives "${got||'nothing'}"`);
  }
  // S6: a miter at the saw limit, and past it
  for(const[deg,want]of[[SHAPE_RULE.sawMiter,''],[SHAPE_RULE.sawMiter+.5,'warn']]){
    const s=blank();s.ends=[{cut:'saw',miter:deg,long:0},null];
    const got=levelOf(piece('2x4',24,3.5,1.5,s),'saw');
    if(got!==want)wrong(`a ${deg}° miter gives "${got||'nothing'}"`);
  }
  // two openings that run into each other, in either order: a STOP, neither is cut (the solid and the weight do
  // not count wood twice), and the same answer whichever was added first
  const middle={u:{from:'mid',d:0},v:{from:'mid',d:0}};
  const cutout={kind:'cutout',a:4,b:2,r:.5,at:middle},hole={kind:'hole',d:.5,at:middle},slot={kind:'slot',d:.5,len:8,dir:'u',at:middle};
  for(const[name,list]of[['a hole inside a cut-out',[cutout,hole]],['a cut-out around a hole',[hole,cutout]],['a slot across a cut-out',[cutout,slot]]]){
    const s=blank();s.feats.push(...JSON.parse(JSON.stringify(list)));
    const shelf=piece('1x8',30,7.25,.75,s);
    if(levelOf(shelf,'overlap')!=='stop')wrong(`${name} on a 1x8 gives "${levelOf(shelf,'overlap')||'nothing'}", not a stop`);
    if(Math.abs(pieceVolume(shelf)-30*7.25*.75)>1e-6)wrong(`${name}: the solid is cut where the openings overlap`);
  }
  // a hole wholly past the end of a deck that was made shorter: said so, with how far to move it
  const past=blank();past.feats.push({kind:'hole',d:6,at:{u:{from:0,d:24},v:{from:'mid',d:0}}});
  const pastText=shapePieceFindings(piece('ply34',20,24,.75,past)).map(f=>f.text+' '+f.fix).join(' ');
  if(!/is now past the .* end .*none of it is on the piece.*at least 7 1\/4"/.test(pastText))wrong(`a hole wholly past the end reads "${pastText}"`);
  // S10: 41 lines
  const many=blank();
  for(let i=0;i<41;i++)many.feats.push({kind:'hole',d:.125,at:{u:{from:0,d:1+i},v:{from:'mid',d:0}}});
  if(levelOf(piece('1x4',48,3.5,.75,many),'many')!=='stop')wrong('41 holes in one piece are not stopped');
});
/* the 2x4 leg with its foot cut at 11° and turned 11°: it stands flat (W4 silent); with a square foot W4 fires */
SELFTESTS.push(function shapeBoundsWhenTurned(problems){
  const make=cut=>{
    const p={id:-1,name:'Leg',mat:'2x4',l:11.5,t:1.5,w:3.5,ax:[1,0,2],pos:[0,0,0]};
    if(cut)p.shape={v:1,ends:[{cut:'saw',miter:11,long:1},{cut:'round',r:1.75}],corners:[null,null,null,null],feats:[]};
    tidyShape(p);
    // lean it 11° about the front-back axis, so its width runs down to the floor at a slant
    p.rot={k:2,deg:11};
    const b=box(p);p.pos[1]-=b.lo[1];   // stand it on the floor
    return p;
  };
  const cut=make(true),lowest=Math.min(...toWorld(cut,pieceCorners(cut)).map(q=>q[1]));
  if(Math.abs(lowest)>1/64||Math.abs(box(cut).lo[1])>1/64)problems.push(`shapes: the turned leg's lowest point is ${lowest.toFixed(3)}", not on the floor`);
  const footCut=footOnTheFloor(cut),footSquare=footOnTheFloor(make(false));
  if(!footCut||footCut.off>SHAPE_W4_DEGREES)problems.push(`shapes: a leg leaning 11° with its foot cut 11° does not stand flat (off by ${footCut?footCut.off.toFixed(1):'?'}°)`);
  if(!footSquare||footSquare.off<=SHAPE_W4_DEGREES||!footFinding(make(false)))problems.push('shapes: a leg leaning 11° on a square foot gets no W4');
});
