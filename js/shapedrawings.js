/* NominalCAD: shaped pieces on the document pages (design\specs\03, sections 2f and 3e).

     shapeMarkPlan(row)        the flat drawing of one shaped cut-list row, as data: the outline and openings in
                               the piece's frame, every size written on it ({what, value, text}) and where each
                               hole, cut-out, slot and notch is measured from (locations), so the self-check can
                               read the numbers back against the model
     shapeDrawingLayout(plan)  where every line and every text of that drawing goes, in picture units: the
                               lines first, then each text at the first place clear of every line and every
                               other text (beside its own size line, or out on a short leader), as js/markingview.js
                               places its numbers and names
     shapeDrawingSvg(plan)     that drawing as SVG: the face seen square on, edge 0 at the bottom, end 0 at the
                               left, with extension lines, slash ticks and the number on its own line
     shapesSection(list)       "Shapes to cut" on the cut list page: one drawing per shaped row, its numbered
                               "How to cut" lines and its tools
     shapeCutStepLine(list, elsewhere)  the line the cutting step gets: "Then cut the shapes of C, E and F ...",
                               leaving out the pieces whose shapes a later step of their own makes
     sheetRects(pieces, nameOf) the rectangles a list of plywood pieces is packed as: one per piece, except that a
                               piece cut once from corner to corner (a corner shelf) is packed two to a square
     sheetShapePath(item)      the outline of a shaped piece inside its rectangle on a cutting diagram
     shapeToolLines(only, leaving)  the tools the shaped pieces of the design need (toolList, js/plans.js); of
                               some pieces only, or leaving some out (the cutting step and a step of their own)

   The drawing here is a self-contained SVG shop drawing, not the marking-view layout of js/markingview.js, but it
   keeps the same rules: no text touches a line or another text, and every text is inside the picture (the picture
   is made as big as what is drawn on it). The self-check shapeDrawingsReadClear measures the texts as the page
   draws them. Every hole, cut-out, slot and notch is located from one named end and one named edge (shapeDatum,
   js/shapes.js), the same two for all of them, by sizes that all start at that corner.

   The drawing is in picture units (the SVG's viewBox: one unit is one CSS pixel when it is shown 640 wide; it
   scales evenly with the page and in print, so what is clear at one width is clear at every width). */
'use strict';

const SHAPE_DRAW={
  width:640,          // the picture is at most this wide (it is fitted to what is drawn)
  maxHeight:240,      // the piece itself is drawn at most this tall
  maxScale:40,        // picture units per inch, at most (a small piece is not blown up)
  leastHeight:44,     // a long narrow piece is drawn at least this tall, with its plain middle left out (a break)
  breakGap:18,        // the width a break takes on the picture
  firstRow:28,row:26, // the first size line this far outside the piece, the next ones this much further
  extGap:3,extOver:5, // extension lines: the gap at the object, and how far past the size line they run
  keep:3,             // the least room between a text and any line
  keepText:4,         // the least room between two texts
  keepOther:12,       // ... between two texts of different kinds (a size and a hole's note)
  paper:8,            // paper round everything drawn
  font:'Segoe UI,system-ui,Arial,sans-serif',size:12,
  ink:'#14181d',wood:'#eef0f2',dim:'#3c434b',white:'#ffffff',
};
const SVG_NS='http://www.w3.org/2000/svg';

/* is this piece's shape exactly one corner cut from corner to corner (a right triangle)? */
function isDiagonalHalf(p){
  if(!p.shape||shapeFeatures(p).length||shapeEnd(p,0)||shapeEnd(p,1))return false;
  const cut=[0,1,2,3].map(i=>shapeCorner(p,i)).filter(Boolean);
  return cut.length===1&&cut[0].cut==='clip'&&cut[0].a>=p.l-1e-6&&cut[0].b>=p.w-1e-6;
}

/* ---------- the drawing, as data ---------- */
/* The plan, in inches in the piece's frame (u along the length, v across the width, up on the paper):
     outer, hidden, openings     the outline on the near face, on the far face (a tilted cut), the openings
     dims        [{what, axis 'u'|'v', from, to, side 'below'|'above'|'left'|'right', value, text, ends, overall}]:
                 every size, with the two points on the piece its extension lines come off (ends)
     crosses     [[u, v]]: center crosses (holes, cut-outs, slots, the centers of curves)
     callouts    [{text, kind 'ring'|'arc'|'loop'|'point', ...}]: a text on a leader to a hole, a curve, an opening
     angles      [{vertex, square, cut, text}]: an angle from square, drawn with its arc
     locations   [{feature, along:[dim], across: dim}]: the sizes that locate each hole, cut-out, slot and notch
     busy        [[u0, u1]]: the stretches of the length where something is drawn (a break may only go elsewhere)
     notes       the lines written under the picture */
function shapeMarkPlan(row){
  const p=row.sample,names=shapeNames(p),outline=shapeOutline(p),datum=shapeDatum(p);
  const plan={letter:row.id,piece:p,names,l:p.l,w:p.w,datum,
    outer:outlineAt(p,0,outline),hidden:slanted(p)?outlineAt(p,p.t,outline):null,lines:[],
    openings:outline.openings,bad:misfits(p).bad,dims:[],marks:[],crosses:[],callouts:[],angles:[],notes:[],locations:[],busy:[]};
  const lower=shapeLower;
  // an end cut to a ridge across the thickness: both faces stop short of the end, and the ridge is the end of the
  // piece as it is seen (drawn solid, with the edges running out to it)
  [0,1].forEach(i=>{
    const e=shapeEnd(p,i);
    if(!e||e.cut!=='point'||e.across!=='t'||endsCross(p))return;
    const endU=i?p.l:0,faceEnd=endU+(i?-1:1)*endSetback(p,i).most;
    plan.lines.push([[faceEnd,0],[endU,0]],[[endU,0],[endU,p.w]],[[endU,p.w],[faceEnd,p.w]]);
  });
  // the point of the piece a size's extension line comes off: on the outline (or the far face's outline) at that
  // length (or width), the one nearest the side the size is written on; the blank's corner if there is none
  const drawnPoints=plan.outer.concat(plan.hidden||[],...plan.lines);
  const objectAt=(axis,value,side)=>{
    const k=axis==='u'?0:1,other=1-k,high=side==='above'||side==='right';
    const on=drawnPoints.filter(q=>Math.abs(q[k]-value)<1e-6);
    if(!on.length){
      const corner=[0,0];corner[k]=value;corner[other]=high?(k?p.l:p.w):0;
      return corner;
    }
    return on.reduce((best,q)=>(high?q[other]>best[other]:q[other]<best[other])?q:best);
  };
  // a size; the same size twice (two holes the same distance from the end) is written once
  const addDim=spec=>{
    const same=plan.dims.find(d=>d.axis===spec.axis&&d.side===spec.side&&Math.abs(d.from-spec.from)<1e-6&&Math.abs(d.to-spec.to)<1e-6);
    if(same)return same;
    // (the ends in the order of from and to)
    const k=spec.axis==='u'?0:1,ends=spec.ends.slice().sort((a,b)=>a[k]-b[k]);
    const dim={...spec,ends,value:spec.to-spec.from,text:fmt(spec.to-spec.from)};
    plan.dims.push(dim);
    return dim;
  };
  const sizeAlong=(what,a,b,side,ends,overall)=>addDim({what,axis:'u',from:Math.min(a,b),to:Math.max(a,b),side,ends:ends||[objectAt('u',a,side),objectAt('u',b,side)],overall});
  const sizeAcross=(what,a,b,side,ends,overall)=>addDim({what,axis:'v',from:Math.min(a,b),to:Math.max(a,b),side,ends:ends||[objectAt('v',a,side),objectAt('v',b,side)],overall});

  // overall sizes of the blank: the cut list row's numbers, outermost
  sizeAlong('length',0,p.l,'below',null,true);
  // the width beside a square end if there is one (beside an angled end its extension line would cross the waste
  // where the angle is drawn); else beside a rounded or pointed end; else the left
  const endRank=i=>{const e=shapeEnd(p,i);return!e?0:e.cut==='saw'?2:1;};
  sizeAcross('width',0,p.w,endRank(1)<endRank(0)?'right':'left',null,true);

  // the ends (two end cuts that would cross are drawn square, as the 3D view draws them: the piece cannot be cut so)
  if(endsCross(p))plan.notes.push('The two end cuts run into each other, so this piece cannot be cut as it is set: the drawing shows square ends. Make the piece longer or the cuts less steep.');
  [0,1].forEach(i=>{
    const e=endsCross(p)?null:shapeEnd(p,i),set=endSetback(p,i),endU=i?p.l:0,inward=i?-1:1,end=lower(names.end[i]);
    if(!e)return;
    plan.busy.push([Math.min(endU,endU+inward*set.most),Math.max(endU,endU+inward*set.most)]);
    if(e.cut==='saw'&&e.miter){
      // the set-back is marked along the short edge, from the end: a beginner marks with a tape and a square;
      // the angle is drawn from the square line at the long point to the cut
      const shortEdge=e.long===1?0:1,longV=shortEdge?0:p.w,shortV=shortEdge?p.w:0,cutU=endU+inward*set.miterSet;
      sizeAlong(`set-back of the ${end}`,endU,cutU,shortEdge?'above':'below');
      plan.angles.push({vertex:[endU,longV],square:[endU,shortV],cut:[cutU,shortV],deg:e.miter,text:degText(e.miter),what:`angle of the ${end}`});
    }
    if(e.cut==='saw'&&e.bevel){
      plan.notes.push(`${names.end[i]}: blade tilt ${degText(e.bevel)}, long on the ${lower(names.face[e.bevelLong])}; on the edge the cut ends ${fmt(set.bevelSet)} in from the end on the ${lower(names.face[1-e.bevelLong])}.`);
    }
    if(e.cut==='round'){
      const r=Math.min(e.r,p.w/2),cu=endU+inward*r;
      // a half circle, or two quarter circles at the corners (start and end angles, counterclockwise)
      const arcs=r>=p.w/2-1e-6?[{u:cu,v:p.w/2,from:i?-90:90,to:i?90:270}]
        :[{u:cu,v:r,from:i?-90:180,to:i?0:270},{u:cu,v:p.w-r,from:i?0:90,to:i?90:180}];
      for(const arc of arcs)plan.crosses.push([arc.u,arc.v]);
      plan.callouts.push({kind:'arc',arcs:arcs.map(arc=>({...arc,r})),text:arcs.length>1?`R ${fmt(r)}, 2 corners`:`R ${fmt(r)}`,what:`radius of the ${end}`,value:r});
      plan.marks.push({what:`center of the ${end} curve, from the end`,value:r});
    }
    if(e.cut==='point'){
      if(e.across==='w'){
        const tipBack=endU+inward*set.most;
        sizeAlong(`point of the ${end}`,endU,tipBack,'above');
        plan.angles.push({vertex:[endU,p.w/2],square:[endU,p.w],cut:[tipBack,p.w],deg:e.deg,text:degText(e.deg),what:`angle of the ${end}`});
      }else{
        plan.notes.push(`${names.end[i]}: a ridge in the middle of the thickness, each face cut back ${fmt(set.most)} with the blade tilted ${degText(e.deg)}.`);
      }
    }
  });

  // the corners
  [0,1,2,3].forEach(i=>{
    const c=shapeCorner(p,i);
    if(!c||shapeEnd(p,i<2?0:1))return;
    const endU=i>=2?p.l:0,inward=i>=2?-1:1,edgeV=i%2?p.w:0,down=i%2?-1:1;
    const edgeSide=i%2?'above':'below',endSide=i>=2?'right':'left';
    if(c.cut==='round'){
      const cu=endU+inward*c.r,cv=edgeV+down*c.r;
      // the quarter circle between the end and the edge (counterclockwise from the start angle)
      const from=i===0?180:i===1?90:i===2?270:0;
      plan.crosses.push([cu,cv]);
      plan.callouts.push({kind:'arc',arcs:[{u:cu,v:cv,r:c.r,from,to:from+90}],text:`R ${fmt(c.r)}`,what:`radius of the ${lower(names.corner[i])}`,value:c.r});
      plan.busy.push([Math.min(endU,cu),Math.max(endU,cu)]);
      return;
    }
    plan.notes.push(`${names.corner[i]}: ${c.cut==='clip'?(isDiagonalHalf(p)?'cut from corner to corner':'cut off'):'notched'} ${fmt(c.a)} along the ${lower(names.edge[i%2])}, ${fmt(c.b)} along the ${lower(names.end[i>=2?1:0])}.`);
    plan.busy.push([Math.min(endU,endU+inward*c.a),Math.max(endU,endU+inward*c.a)]);
    if(isDiagonalHalf(p))return;   // (its two sizes are the overall sizes)
    // its two sizes, each from the corner of the blank
    sizeAlong(`${c.cut==='clip'?'cut-off':'notch'} of the ${lower(names.corner[i])} along the edge`,endU,endU+inward*c.a,edgeSide);
    sizeAcross(`${c.cut==='clip'?'cut-off':'notch'} of the ${lower(names.corner[i])} along the end`,edgeV,edgeV+down*c.b,endSide);
  });

  // the features: each from the one datum end and the one datum edge (running sizes from that corner)
  const endU=datum.end?p.l:0,edgeV=datum.edge?p.w:0;
  const feats=shapeFeatures(p);
  // the sizes along the length on the datum edge's side; each size across the width beside the end its feature is
  // nearer (they all start at the datum edge either way: the side only keeps the extension lines short)
  const alongSide=datum.edge?'above':'below';
  const endName=lower(names.end[datum.end]),edgeName=lower(names.edge[datum.edge]);
  feats.forEach((f,index)=>{
    const name=featureName(f);
    // a feature that does not fit (off the piece, or into another opening) is not cut: it is not drawn either
    if(plan.bad.includes(f)){
      plan.notes.push(`The ${name} does not fit where it is placed, so it is left off this drawing and cannot be cut until it is moved (the 3D view shows it in red).`);
      return;
    }
    const at=featureFromDatum(p,f,datum),b=featureBounds(p,f),c=featureCenter(p,f);
    const acrossSide=c.u>p.l/2?'right':'left';
    plan.busy.push([b.u0,b.u1]);
    // the extension lines come off the feature on the side its sizes are written
    const along=at.along.map((spot,k)=>sizeAlong(f.kind==='notch'?`${k?'far':'near'} side of the ${name}, from the ${endName}`:`center of the ${name}, from the ${endName}`,
      endU,spot.u,alongSide,[objectAt('u',endU,alongSide),[spot.u,alongSide==='below'?b.v0:b.v1]]));
    const across=sizeAcross(f.kind==='notch'?`inside line of the ${name}, from the ${edgeName}`:`center of the ${name}, from the ${edgeName}`,
      edgeV,at.across.v,acrossSide,[objectAt('v',edgeV,acrossSide),[acrossSide==='left'?b.u0:b.u1,at.across.v]]);
    plan.locations.push({feature:f,index,along,across});
    if(f.kind==='notch'){
      const inside=f.edge===1?p.w-f.depth:f.depth;
      plan.callouts.push({kind:'point',at:[c.u,inside],toward:f.edge===1?1:-1,text:`${fmt(f.len)} × ${fmt(f.depth)} notch`,what:name});
      return;
    }
    plan.crosses.push([c.u,c.v]);
    if(f.kind==='hole')plan.callouts.push({kind:'ring',u:c.u,v:c.v,r:f.d/2,text:`${fmt(f.d)} dia.`,what:name,value:f.d});
    else plan.callouts.push({kind:'loop',u:c.u,v:c.v,loop:openingPoints(p,f),
      text:f.kind==='cutout'?`${fmt(f.a)} × ${fmt(f.b)}${f.r>0?`, corners R ${fmt(f.r)}`:''}`:`${fmt(f.d)} × ${fmt(f.len)} slot`,what:name});
    // "centered" is a remark after the number, never instead of it
    if(at.midWidth)plan.notes.push(`The ${name} is centered across the width: ${fmt(at.across.value)} from the ${edgeName}.`);
    if(at.midLength)plan.notes.push(`The ${name} is halfway along: ${fmt(at.along[0].value)} from the ${endName}.`);
  });
  const drawnFeats=feats.filter(f=>!plan.bad.includes(f));
  if(drawnFeats.length){
    const feats=drawnFeats;
    // "The 6" hole is", "The notch and the slot are both", "The holes and the cut-out are all"
    const singular={hole:'hole',cutout:'cut-out',slot:'slot',notch:'notch'};
    const kinds=[...new Set(feats.map(f=>f.kind))].map(kind=>{
      const n=feats.filter(f=>f.kind===kind).length;
      return n===1?`the ${singular[kind]}`:`the ${SHAPE_KINDS[kind].plural}`;
    });
    const listed=kinds.length===1?kinds[0]:kinds.slice(0,-1).join(', ')+' and '+kinds[kinds.length-1];
    const who=feats.length===1?`The ${featureName(feats[0])} is`:shapeCapital(listed)+(feats.length===2?' are both':' are all');
    plan.notes.unshift(`${who} measured from the ${endName} and the ${edgeName}.`);
  }
  if(isDiagonalHalf(p))plan.notes.push('Cut the square, then cut it once corner to corner. The saw blade takes its width from the long side, so each triangle comes out about 1/16" to 1/8" short of the square.');
  return plan;
}

/* ---------- the drawing, as SVG ---------- */
/* ---------- texts: their size as the page draws them ----------
   Measured once on a hidden SVG with the drawing's own font, so the layout keeps clear of what is really drawn:
   {w, up (baseline to the top of the box), down (baseline to its bottom)}. Without a page to measure on, a rough
   guess. */
let shapeMeasureHost=null;
const shapeTextSizes=new Map();
function shapeTextSize(text,bold){
  const key=(bold?'b|':'|')+text;
  if(shapeTextSizes.has(key))return shapeTextSizes.get(key);
  let size=null;
  try{
    if(!shapeMeasureHost||!shapeMeasureHost.isConnected){
      shapeMeasureHost=document.createElementNS(SVG_NS,'svg');
      shapeMeasureHost.setAttribute('style','position:absolute;left:-10000px;top:0;width:640px;height:40px;visibility:hidden');
      shapeMeasureHost.setAttribute('font-family',SHAPE_DRAW.font);
      shapeMeasureHost.setAttribute('font-size',SHAPE_DRAW.size);
      document.body.appendChild(shapeMeasureHost);
    }
    const node=document.createElementNS(SVG_NS,'text');
    if(bold)node.setAttribute('font-weight','600');
    node.textContent=text;
    shapeMeasureHost.appendChild(node);
    const box=node.getBBox();
    node.remove();
    if(box.width>0)size={w:box.width,up:-box.y,down:box.y+box.height};
  }catch(e){size=null;}
  if(!size)return{w:text.length*7,up:13,down:4};   // (not remembered: the page may be measurable later)
  shapeTextSizes.set(key,size);
  return size;
}
const shapeBoxesMeet=(a,b,gap)=>a.x0<b.x1+gap&&a.x1+gap>b.x0&&a.y0<b.y1+gap&&a.y1+gap>b.y0;
const shapeBoxRect=box=>({x:box.x0,y:box.y0,w:box.x1-box.x0,h:box.y1-box.y0});
/* the least distance between two straight lines a-b and c-d (0 when they cross) */
function shapeSegmentGap(a,b,c,d){
  if(segmentsCross([a,b],[c,d]))return 0;
  return Math.min(distanceToSegment(a[0],a[1],c,d),distanceToSegment(b[0],b[1],c,d),distanceToSegment(c[0],c[1],a,b),distanceToSegment(d[0],d[1],a,b));
}

/* ---------- the scale, and a break in a long narrow piece ----------
   room: the width the piece may take on the paper. A piece so long and narrow that it would be drawn thinner than
   leastHeight leaves out part of its longest plain stretch (no cut, no hole there), between two break lines; its
   sizes still give the true lengths. Returns {s, brk: null | {u0, u1}}. */
function shapeDrawingScale(plan,room){
  const D=SHAPE_DRAW;
  const fit=Math.min(D.maxScale,D.maxHeight/plan.w,room/plan.l);
  if(plan.w*fit>=D.leastHeight)return{s:fit,brk:null};
  // the longest stretch with nothing drawn on it
  const busy=plan.busy.map(([a,b])=>[Math.max(0,a),Math.min(plan.l,b)]).sort((x,y)=>x[0]-y[0]);
  let stretch=null,reached=0;
  for(const[a,b]of busy.concat([[plan.l,plan.l]])){
    if(a-reached>(stretch?stretch[1]-stretch[0]:0))stretch=[reached,a];
    reached=Math.max(reached,b);
  }
  if(!stretch)return{s:fit,brk:null};
  const want=Math.min(D.maxScale,D.maxHeight/plan.w,D.leastHeight/plan.w);
  const keep=Math.max(1.5,40/want);                       // inches drawn each side of the break
  const most=stretch[1]-stretch[0]-2*keep;                 // the most that may be left out
  if(most<6)return{s:fit,brk:null};
  const leaveOut=Math.min(most,plan.l-(room-D.breakGap)/want);
  if(leaveOut<=0)return{s:fit,brk:null};
  const s=Math.min(want,(room-D.breakGap)/(plan.l-leaveOut));
  const middle=(stretch[0]+stretch[1])/2;
  return{s,brk:{u0:middle-leaveOut/2,u1:middle+leaveOut/2}};
}

/* ---------- the layout ----------
   Lines first: the outline (solid, the far face dashed), the center crosses, the break lines, every size line with
   its ticks and extension lines, and the arcs of the angles. Then the texts, each at the first place clear of every
   line and every text already placed: the numbers of the sizes beside their own line (in a break of it for an
   upright one) or just past one of its ends; the angles beside their arc; the hole sizes and radii on a leader;
   the names of the ends and the edges outside everything. A number that finds no place moves its size one row
   further out and the whole drawing is laid out again. The picture is then made as big as what is drawn, and the
   scale is brought down until it is at most SHAPE_DRAW.width wide.
   Returns {segs: [{a, b, kind}], texts: [{x, y, size, text, bold, box, role}], fills, brk, view: {x, y, w, h},
   clashes: [texts that found no clear place]} */
function shapeDrawingLayout(plan){
  const D=SHAPE_DRAW,bumps=new Map();
  let room=D.width-200,layout=null,grown=false,shrunk=false;
  for(let pass=0;pass<14;pass++){
    const fit=shapeDrawingScale(plan,room);
    layout=layOutShapeDrawing(plan,fit,bumps);
    if(layout.bumped)continue;                              // a number moved out a row: again
    // too wide: the piece is drawn narrower by as much (from the width it really took)
    const drawnWidth=layout.X(plan.l)-layout.X(0);
    if(layout.view.w>D.width+.5&&drawnWidth>60){shrunk=true;room=Math.max(60,Math.min(room,drawnWidth)-(layout.view.w-D.width)-1);continue;}
    // much narrower than it may be, and the width is what holds the scale down: once more, wider
    const widthBound=fit.s<Math.min(D.maxScale,D.maxHeight/plan.w)-1e-6;
    if(!grown&&!shrunk&&widthBound&&layout.view.w<D.width-24){grown=true;room+=D.width-layout.view.w-4;continue;}
    break;
  }
  return layout;
}
function layOutShapeDrawing(plan,fit,bumps){
  const D=SHAPE_DRAW,{s,brk}=fit,gap=brk?D.breakGap:0;
  const X=u=>{
    if(!brk||u<=brk.u0)return u*s;
    if(u>=brk.u1)return brk.u0*s+gap+(u-brk.u1)*s;
    return brk.u0*s+gap*(u-brk.u0)/(brk.u1-brk.u0);
  };
  const Y=v=>(plan.w-v)*s;
  const P=([u,v])=>[X(u),Y(v)];
  const out={plan,s,brk,segs:[],texts:[],fills:[],clashes:[],bumped:false,X,Y};
  const line=(a,b,kind,owner)=>{const seg={a,b,kind,owner};out.segs.push(seg);return seg;};

  // the outline: each straight piece, less what lies in the break
  const inBreak=u=>brk&&u>brk.u0+1e-9&&u<brk.u1-1e-9;
  const outlineSegs=(loop,kind,open)=>{
    for(let i=0;i<(open?loop.length-1:loop.length);i++){
      let a=loop[i],b=loop[(i+1)%loop.length];
      if(brk){
        if(inBreak(a[0])&&inBreak(b[0]))continue;
        const cutAt=(p,q,u)=>[u,p[1]+(q[1]-p[1])*(u-p[0])/(q[0]-p[0])];
        const lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]);
        if(lo<brk.u0&&hi>brk.u1){   // straight across the break: the two ends of it
          const[left,right]=a[0]<b[0]?[a,b]:[b,a];
          line(P(left),P(cutAt(left,right,brk.u0)),kind);
          line(P(cutAt(left,right,brk.u1)),P(right),kind);
          continue;
        }
        if(inBreak(a[0]))a=cutAt(b,a,a[0]<brk.u1&&b[0]>=brk.u1?brk.u1:brk.u0);
        if(inBreak(b[0]))b=cutAt(a,b,b[0]<brk.u1&&a[0]>=brk.u1?brk.u1:brk.u0);
      }
      line(P(a),P(b),kind);
    }
  };
  out.fills.push([plan.outer].concat(plan.openings).map(loop=>loop.map(P)));
  outlineSegs(plan.outer,'outline');
  for(const loop of plan.openings)outlineSegs(loop,'outline');
  for(const open of plan.lines)outlineSegs(open,'outline',true);
  if(plan.hidden){
    // the far face's outline, less where it lies under a line of the near one (an edge both faces share is
    // drawn once, solid)
    const before=out.segs.length;
    outlineSegs(plan.hidden,'hidden');
    const visible=out.segs.filter(seg=>seg.kind==='outline');
    const dashed=out.segs.splice(before);
    for(const seg of dashed){
      const dx=seg.b[0]-seg.a[0],dy=seg.b[1]-seg.a[1],long=Math.hypot(dx,dy);
      if(long<.5)continue;
      // the stretches of it (0..1 along it) that a visible line covers
      const covered=[];
      for(const other of visible){
        const onIt=q=>Math.abs((q[0]-seg.a[0])*dy-(q[1]-seg.a[1])*dx)/long<.6;
        if(!onIt(other.a)||!onIt(other.b))continue;
        const t=q=>((q[0]-seg.a[0])*dx+(q[1]-seg.a[1])*dy)/(long*long);
        covered.push([Math.min(t(other.a),t(other.b)),Math.max(t(other.a),t(other.b))]);
      }
      covered.sort((x,y)=>x[0]-y[0]);
      let from=0;
      const at=t=>[seg.a[0]+dx*t,seg.a[1]+dy*t];
      for(const[c0,c1]of covered){
        if(c0>from+1e-3)line(at(from),at(Math.min(1,c0)),'hidden');
        from=Math.max(from,c1);
        if(from>=1)break;
      }
      if(from<1-1e-3)line(at(from),at(1),'hidden');
    }
  }
  // the break: two zigzag lines across the piece, a little past its edges
  if(brk){
    const top=Y(plan.w)-4,bottom=Y(0)+4,middle=(top+bottom)/2;
    for(const x of[X(brk.u0),X(brk.u0)+gap]){
      const zig=[[x,top],[x,middle-6],[x+4,middle-2],[x-4,middle+2],[x,middle+6],[x,bottom]];
      for(let i=1;i<zig.length;i++)line(zig[i-1],zig[i],'break');
    }
    out.breakAt=[X(brk.u0),X(brk.u0)+gap];
  }
  // center crosses
  for(const c of plan.crosses){
    const[x,y]=P(c);
    line([x-6,y],[x+6,y],'cross');line([x,y-6],[x,y+6],'cross');
  }

  // the sizes: rows on each side, the shortest nearest the piece and the overall size outermost; two sizes share
  // a row only when they are far enough apart for both numbers
  const along=d=>d.axis==='u'?[X(d.from),X(d.to)]:[Y(d.to),Y(d.from)];
  const dimKey=d=>[d.axis,d.side,d.from.toFixed(4),d.to.toFixed(4)].join('|');
  const sides={below:[],above:[],left:[],right:[]};
  for(const d of plan.dims)sides[d.side].push(d);
  const laidDims=[];
  for(const[side,list]of Object.entries(sides)){
    if(!list.length)continue;
    const level=side==='below'||side==='above';
    const sizeOf=d=>shapeTextSize(d.text);
    // an upright size has its number in a break of its line: its rows are as far apart as the widest number
    const widest=Math.max(...list.map(d=>sizeOf(d).w));
    const step=level?D.row:Math.max(D.row,widest+2*D.keep+6);
    // beside an end cut at an angle, room between the end and the sizes for the angle's number
    const angleHere=!level&&plan.angles.some(angle=>(angle.vertex[0]<plan.l/2)===(side==='left'));
    const first=level?D.firstRow:Math.max(D.firstRow,widest/2+D.keep+6)+(angleHere?36:0);
    const ordered=list.filter(d=>!d.overall).sort((a,b)=>(a.to-a.from)-(b.to-b.from)||a.from-b.from).concat(list.filter(d=>d.overall));
    const rows=[];
    let outermost=-1;
    for(const d of ordered){
      const[lo,hi]=along(d),need=(level?sizeOf(d).w:sizeOf(d).up+sizeOf(d).down)+12;
      let r=bumps.get(dimKey(d))||0;
      if(d.overall)r=Math.max(r,outermost+1);
      while(rows[r]&&rows[r].some(([a,b])=>lo-need<b&&hi+need>a))r++;
      (rows[r]=rows[r]||[]).push([lo,hi]);
      outermost=Math.max(outermost,r);
      const away=first+r*step;
      const lineAt=side==='below'?Y(0)+away:side==='above'?Y(plan.w)-away:side==='left'?X(0)-away:X(plan.l)+away;
      laidDims.push({dim:d,side,level,row:r,lineAt,lo,hi,key:dimKey(d)});
    }
  }
  const outward=side=>side==='below'||side==='right'?1:-1;
  for(const laid of laidDims){
    const{dim,side,level,lineAt}=laid,o=outward(side);
    const ends=dim.ends.map(P);
    // the ends of the size along its line, in the order of from and to
    const at=level?[[X(dim.from),lineAt],[X(dim.to),lineAt]]:[[lineAt,Y(dim.from)],[lineAt,Y(dim.to)]];
    laid.line=line(at[0],at[1],'dim',laid);
    for(const[x,y]of at)laid.tick=line([x-4,y+4],[x+4,y-4],'tick',laid);
    // extension lines from the object (a small gap at it) to a little past the size line
    laid.ext=ends.map((point,k)=>{
      if(level){
        const x=at[k][0];
        if(Math.abs((lineAt-point[1])*o)<D.extGap+1)return null;
        return line([x,point[1]+o*D.extGap],[x,lineAt+o*D.extOver],'ext',laid);
      }
      const y=at[k][1];
      if(Math.abs((lineAt-point[0])*o)<D.extGap+1)return null;
      return line([point[0]+o*D.extGap,y],[lineAt+o*D.extOver,y],'ext',laid);
    });
  }

  // the angles: a thin line along the square end from the long point, and an arc from it to the cut
  const laidAngles=plan.angles.map(angle=>{
    const v=P(angle.vertex),sq=P(angle.square),ct=P(angle.cut);
    const dirOf=q=>{const dx=q[0]-v[0],dy=q[1]-v[1],len=Math.hypot(dx,dy)||1;return{x:dx/len,y:dy/len,len};};
    const a=dirOf(sq),b=dirOf(ct);
    line(v,sq,'ref');
    const r=Math.max(10,Math.min(30,.6*Math.min(a.len,b.len)));
    const start=Math.atan2(a.y,a.x);
    let sweep=Math.atan2(b.y,b.x)-start;
    while(sweep>Math.PI)sweep-=2*Math.PI;
    while(sweep<-Math.PI)sweep+=2*Math.PI;
    const n=Math.max(4,Math.ceil(Math.abs(sweep)*r/4));
    let last=null;
    for(let i=0;i<=n;i++){
      const t=start+sweep*i/n,q=[v[0]+r*Math.cos(t),v[1]+r*Math.sin(t)];
      if(last)line(last,q,'arc');
      last=q;
    }
    const mid=start+sweep/2;
    return{angle,vertex:v,r,mid:[v[0]+r*Math.cos(mid),v[1]+r*Math.sin(mid)],bisector:[Math.cos(mid),Math.sin(mid)]};
  });

  /* ---- the texts ---- */
  // (a text keeps further from a text of another kind: a size beside a hole's note would read as one with it)
  const clear=(box,ignore,role)=>!out.segs.some(seg=>seg!==ignore&&segmentHitsRect(seg.a,seg.b,shapeBoxRect(box),D.keep))&&
    !out.texts.some(text=>shapeBoxesMeet(text.box,box,text.role===role?D.keepText:D.keepOther));
  const touchesText=(a,b)=>out.texts.some(text=>segmentHitsRect(a,b,shapeBoxRect(text.box),1.5));
  const put=(x,y,size,text,role,bold)=>{
    const placed={x,y,size,text,role,bold:!!bold,box:{x0:x,y0:y-size.up,x1:x+size.w,y1:y+size.down}};
    out.texts.push(placed);
    return placed;
  };
  const boxAt=(x,y,size)=>({x0:x,y0:y-size.up,x1:x+size.w,y1:y+size.down});

  // the numbers of the sizes: those that fit between their extension lines first
  const fits=laid=>{
    const size=shapeTextSize(laid.dim.text);
    return laid.level?size.w+2*D.keep+4<=laid.hi-laid.lo:size.up+size.down+2*D.keep+4<=laid.hi-laid.lo;
  };
  // a number put past an end of its line must not stand beside another size of the same row (it would be read as
  // that size's number)
  const besideOther=(laid,lo,hi)=>laidDims.some(other=>other!==laid&&other.side===laid.side&&other.row===laid.row&&lo<other.hi+4&&hi>other.lo-4);
  for(const laid of laidDims.filter(fits).concat(laidDims.filter(laid=>!fits(laid)))){
    const size=shapeTextSize(laid.dim.text),{lo,hi,lineAt}=laid;
    const tries=[];
    // (a number past an end of its line keeps clear of the tick there: it reaches 4 out)
    const pastGap=9;
    if(laid.level){
      // above its line, on every side: so on each side the numbers of all rows sit the same way round
      const y=lineAt-4-size.down,middle=(lo+hi)/2;
      for(const slide of[0,-.25,.25,-.45,.45])tries.push({x:middle-size.w/2+slide*Math.max(0,hi-lo-size.w),y});
      // past an end: the size line runs on under the number
      tries.push({x:hi+pastGap,y,past:[hi,hi+pastGap+size.w],run:[[hi,lineAt],[hi+pastGap+size.w,lineAt]]});
      tries.push({x:lo-pastGap-size.w,y,past:[lo-pastGap-size.w,lo],run:[[lo-pastGap-size.w,lineAt],[lo,lineAt]]});
    }else{
      // in a break of its upright line
      const middle=(lo+hi)/2,h=size.up+size.down,x=lineAt-size.w/2;
      for(const slide of[0,-.25,.25,-.45,.45])tries.push({x,y:middle+(size.up-size.down)/2+slide*Math.max(0,hi-lo-h),inLine:true});
      // past an end, in line with it
      tries.push({x,y:lo-pastGap-size.down,past:[lo-pastGap-h,lo]});
      tries.push({x,y:hi+pastGap+size.up,past:[hi,hi+pastGap+h]});
    }
    const ok=t=>{
      const box=boxAt(t.x,t.y,size);
      if(!clear(box,t.inLine?laid.line:null,'size'))return false;
      if(t.past&&besideOther(laid,t.past[0],t.past[1]))return false;
      // the size line run on under the number must not touch another text
      if(t.run&&touchesText(t.run[0],t.run[1]))return false;
      return true;
    };
    let pick=tries.find(ok);
    if(!pick){
      // no clear place: this size goes one row further out, and the drawing is laid out again
      bumps.set(laid.key,laid.row+1);
      if(laid.row<6)out.bumped=true;
      out.clashes.push(`the number ${laid.dim.text} (${laid.dim.what})`);
      pick=tries[0];
    }
    const placed=put(pick.x,pick.y,size,laid.dim.text,'size');
    placed.dim=laid.dim;
    if(pick.inLine){
      // the upright line is broken round its number
      const seg=laid.line,top=placed.box.y0-D.keep,bottom=placed.box.y1+D.keep;
      out.segs.splice(out.segs.indexOf(seg),1);
      if(top>lo+1)line([lineAt,lo],[lineAt,top],'dim',laid);
      if(bottom<hi-1)line([lineAt,bottom],[lineAt,hi],'dim',laid);
    }else if(pick.run){
      line(pick.run[0],pick.run[1],'dim',laid);
    }
  }

  /* a text on a leader: from a point of the piece (anchor), out along a slant, then a short level shoulder and the
     text. Tried nearest first, every direction; first without crossing a size line, then crossing one. */
  // is a text box on the wood? (an angle or a radius is written off the piece, in the waste or outside it)
  const woodLoop=plan.outer.map(P);
  const onWood=box=>[[box.x0,box.y0],[box.x1,box.y0],[box.x0,box.y1],[box.x1,box.y1],[(box.x0+box.x1)/2,(box.y0+box.y1)/2]].some(([x,y])=>{
    let inside=false;
    for(let i=0,j=woodLoop.length-1;i<woodLoop.length;j=i++){
      const[ax,ay]=woodLoop[i],[bx,by]=woodLoop[j];
      if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    }
    return inside;
  });
  const callout=(text,anchorAt,preferred,role,bold,offWood)=>{
    const size=shapeTextSize(text,bold);
    // the preferred directions first, then every other way round
    const directions=preferred.concat([45,135,-45,-135,20,160,-20,-160,70,110,-70,-110,0,180,90,-90].filter(deg=>!preferred.includes(deg)));
    // first a leader that crosses no other line of a size; then one that crosses extension lines only (as
    // drafters allow); then any
    const tiers=[['dim','ext','tick','leader','ref','arc'],['dim','tick','leader','arc'],[]];
    for(const avoid of tiers){
      const strict=avoid.length>0;
      for(const reach of[14,24,36,52,72,96,126,160,200,260]){
        for(const deg of directions){
          const t=deg*Math.PI/180,anchor=anchorAt(t);
          if(!anchor)continue;
          const elbow=[anchor[0]+reach*Math.cos(t),anchor[1]-reach*Math.sin(t)];
          const right=Math.cos(t)>-1e-6,shoulder=[elbow[0]+(right?8:-8),elbow[1]];
          const x=right?shoulder[0]+3:shoulder[0]-3-size.w,y=elbow[1]+(size.up-size.down)/2;
          const box=boxAt(x,y,size);
          if(!clear(box,null,role))continue;
          if(offWood&&onWood(box))continue;
          const leader=[[anchor,elbow],[elbow,shoulder]];
          if(leader.some(([a,b])=>touchesText(a,b)))continue;
          // the level shoulder by the text, and the bend, stand clear of every line
          if(out.segs.some(seg=>shapeSegmentGap(elbow,shoulder,seg.a,seg.b)<D.keep))continue;
          // nor does this leader come near the shoulder of another
          if(out.segs.some(seg=>seg.shoulder&&shapeSegmentGap(anchor,elbow,seg.a,seg.b)<D.keep))continue;
          if(strict&&leader.some(([a,b])=>out.segs.some(seg=>avoid.includes(seg.kind)&&segmentsCross([a,b],[seg.a,seg.b]))))continue;
          // the leader of an angle or a radius never runs across the piece (it would read as a cut)
          const nearAnchor=seg=>distanceToSegment(anchor[0],anchor[1],seg.a,seg.b)<1.5;
          if(offWood&&leader.some(([a,b])=>out.segs.some(seg=>seg.kind==='outline'&&!nearAnchor(seg)&&segmentsCross([a,b],[seg.a,seg.b]))))continue;
          line(anchor,elbow,'leader');
          line(elbow,shoulder,'leader').shoulder=true;
          return put(x,y,size,text,role,bold);
        }
      }
    }
    out.clashes.push(`the text ${text}`);
    const anchor=directions.map(deg=>anchorAt(deg*Math.PI/180)).find(Boolean)||[0,0];
    return put(anchor[0]+20,anchor[1]-20,size,text,role,bold);
  };
  const ring=[45,135,-45,-135,20,160,-20,-160,70,110,-70,-110,0,180,90,-90];

  // the angles: beside the arc, on the side away from the vertex; or on a leader
  for(const laid of laidAngles){
    const size=shapeTextSize(laid.angle.text,true),[bx,by]=laid.bisector;
    let placed=null;
    for(const extra of[6,12,20]){
      const cx=laid.vertex[0]+bx*(laid.r+extra+size.w/2),cy=laid.vertex[1]+by*(laid.r+extra+(size.up+size.down)/2);
      const x=cx-size.w/2,y=cy+(size.up-size.down)/2;
      if(clear(boxAt(x,y,size),null,'angle')&&!onWood(boxAt(x,y,size))){placed=put(x,y,size,laid.angle.text,'angle',true);break;}
    }
    if(!placed){
      const toward=Math.round(Math.atan2(-by,bx)*180/Math.PI);
      placed=callout(laid.angle.text,()=>laid.mid,[toward,toward+30,toward-30,toward+60,toward-60,toward+90,toward-90,toward+150,toward-150,toward+180],'angle',true,true);
    }
    placed.angle=laid.angle;
  }

  // the sizes of holes, curves and openings
  for(const c of plan.callouts){
    let anchorAt,directions=ring;
    if(c.kind==='ring'){
      const center=P([c.u,c.v]),r=c.r*s;
      anchorAt=t=>[center[0]+r*Math.cos(t),center[1]-r*Math.sin(t)];
    }else if(c.kind==='arc'){
      // on a curve, outward from its center, within its sweep
      const arcs=c.arcs.slice().reverse();   // (the upper one first: its leader goes up, away from the sizes below)
      directions=[];
      for(const arc of arcs)for(const share of[.5,.3,.7,.15,.85])directions.push(arc.from+(arc.to-arc.from)*share);
      anchorAt=t=>{
        const deg=((t*180/Math.PI)%360+360)%360;
        const arc=arcs.find(a=>{const from=((a.from%360)+360)%360,span=a.to-a.from;return((deg-from+360)%360)<=span+1e-6;});
        if(!arc)return null;
        return P([arc.u+arc.r*Math.cos(t),arc.v+arc.r*Math.sin(t)]);
      };
    }else if(c.kind==='loop'){
      // where a ray from the center meets the opening's outline
      const center=P([c.u,c.v]),loop=c.loop.map(P);
      anchorAt=t=>{
        const dir=[Math.cos(t),-Math.sin(t)];
        let best=null;
        for(let i=0;i<loop.length;i++){
          const a=loop[i],b=loop[(i+1)%loop.length],ex=b[0]-a[0],ey=b[1]-a[1];
          const det=dir[0]*(-ey)-dir[1]*(-ex);
          if(Math.abs(det)<1e-9)continue;
          const ax=a[0]-center[0],ay=a[1]-center[1];
          const along=(ax*(-ey)-ay*(-ex))/det,on=(dir[0]*ay-dir[1]*ax)/det;
          if(along>0&&on>=0&&on<=1&&(best===null||along<best))best=along;
        }
        return best===null?null:[center[0]+best*dir[0],center[1]+best*dir[1]];
      };
    }else{
      // a notch: from the middle of its inside line, out through the notch
      const at=P(c.at);
      anchorAt=()=>at;
      directions=c.toward>0?[60,120,45,135,75,105]:[-60,-120,-45,-135,-75,-105];
    }
    callout(c.text,anchorAt,directions,'callout',false,c.kind==='arc').callout=c;
  }

  // the names of the ends and the edges, as the piece stands in the design: outside everything drawn
  const extent=()=>{
    const xs=[],ys=[];
    for(const seg of out.segs){xs.push(seg.a[0],seg.b[0]);ys.push(seg.a[1],seg.b[1]);}
    for(const text of out.texts){xs.push(text.box.x0,text.box.x1);ys.push(text.box.y0,text.box.y1);}
    return{x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};
  };
  // one line above everything: "Left end" ending over the left end, the top edge's name over the middle, "Right
  // end" starting over the right end; the bottom edge's name under everything (a name beside the piece would
  // stand next to a number and read as one with it)
  const middleX=(X(0)+X(plan.l))/2,drawn=extent();
  const sizes=[plan.names.end[0],plan.names.edge[1],plan.names.end[1],plan.names.edge[0]].map(text=>shapeTextSize(text));
  const topY=drawn.y0-10-Math.max(...sizes.slice(0,3).map(size=>size.down));
  const topEdge={x:middleX-sizes[1].w/2,w:sizes[1].w};
  // over a narrow piece the three names would run together: the edge's name goes a line higher
  const roomy=topEdge.x-X(0)>=30&&X(plan.l)-(topEdge.x+topEdge.w)>=30;
  put(X(0)-sizes[0].w,topY,sizes[0],plan.names.end[0],'name');
  put(topEdge.x,roomy?topY:topY-sizes[1].down-sizes[1].up-8,sizes[1],plan.names.edge[1],'name');
  put(X(plan.l),topY,sizes[2],plan.names.end[1],'name');
  put(middleX-sizes[3].w/2,drawn.y1+10+sizes[3].up,sizes[3],plan.names.edge[0],'name');

  // the picture: what is drawn, with paper round it
  const e=extent();
  out.view={x:e.x0-D.paper,y:e.y0-D.paper,w:e.x1-e.x0+2*D.paper,h:e.y1-e.y0+2*D.paper};
  return out;
}

/* ---------- the drawing, as SVG ---------- */
function shapeDrawingSvgOf(layout){
  const D=SHAPE_DRAW,v=layout.view,f=n=>n.toFixed(1);
  const path=segs=>segs.map(seg=>`M${f(seg.a[0])} ${f(seg.a[1])}L${f(seg.b[0])} ${f(seg.b[1])}`).join('');
  const of=(...kinds)=>layout.segs.filter(seg=>kinds.includes(seg.kind));
  // (shown at its own size, one unit a pixel, so a narrow picture is not blown up to the page's width)
  let svg=`<svg class="shape-draw" xmlns="${SVG_NS}" width="${Math.ceil(v.w)}" height="${Math.ceil(v.h)}" viewBox="${f(v.x)} ${f(v.y)} ${f(v.w)} ${f(v.h)}" font-family="${D.font}" font-size="${D.size}">`;
  // the wood (with its openings), the paper over the part left out at a break
  for(const fill of layout.fills)svg+=`<path d="${fill.map(loop=>loop.map((q,i)=>`${i?'L':'M'}${f(q[0])} ${f(q[1])}`).join('')+'Z').join('')}" fill="${D.wood}" fill-rule="evenodd"/>`;
  if(layout.breakAt){
    const[x0,x1]=layout.breakAt;
    svg+=`<rect x="${f(x0)}" y="${f(layout.Y(layout.plan.w)-2)}" width="${f(x1-x0)}" height="${f(layout.plan.w*layout.s+4)}" fill="${D.white}"/>`;
  }
  svg+=`<path d="${path(of('outline'))}" fill="none" stroke="${D.ink}" stroke-width="2" stroke-linejoin="round"/>`;
  const hidden=of('hidden');
  if(hidden.length)svg+=`<path d="${path(hidden)}" fill="none" stroke="${D.dim}" stroke-width="1" stroke-dasharray="5 3"/>`;
  svg+=`<path d="${path(of('cross','break'))}" fill="none" stroke="${D.ink}" stroke-width="1"/>`;
  svg+=`<path d="${path(of('dim','ext','tick','leader','ref','arc'))}" fill="none" stroke="${D.dim}" stroke-width="1"/>`;
  for(const text of layout.texts){
    const fill=text.role==='name'?D.dim:D.ink;
    svg+=`<text x="${f(text.x)}" y="${f(text.y)}" fill="${fill}"${text.bold?' font-weight="600"':''}>${esc(text.text)}</text>`;
  }
  return svg+'</svg>';
}
function shapeDrawingSvg(plan){
  return shapeDrawingSvgOf(shapeDrawingLayout(plan));
}

/* ---------- the words of a cut list row ---------- */
/* the first end of a row's piece that is cut with the blade tilted (a bevel): the cut that makes lefts and rights */
function tiltedEndOf(p){
  return[0,1].find(i=>{const e=shapeEnd(p,i);return e&&e.cut==='saw'&&e.bevel;});
}
/* how the two hands of a mirror-twin row differ, said by what the person at the saw sees (not "left" and "right",
   which the Note already uses for the ends of the piece): {asDrawn, other, line} or null for a row of one hand */
function rowHands(g){
  if(!g.mirrored)return null;
  const p=g.sample,names=shapeNames(p),many=n=>n===1?'1':String(n);
  const drawn=g.qty-g.mirrored,i=tiltedEndOf(p);
  if(i===undefined){
    return{asDrawn:`${many(drawn)} as drawn`,other:`${many(g.mirrored)} the mirror image of the drawing`,
      line:`For the ${g.mirrored===1?'other one':'other '+g.mirrored}: the mirror image of the drawing (every cut the other way round).`};
  }
  const e=shapeEnd(p,i),end=shapeLower(names.end[i]);
  const face=shapeLower(names.face[e.bevelLong===1?1:0]),otherFace=shapeLower(names.face[e.bevelLong===1?0:1]);
  return{asDrawn:`${many(drawn)} with the long point of the ${end}'s tilted cut on the ${face}`,other:`${many(g.mirrored)} with it on the ${otherFace}`,
    line:`For the ${g.mirrored===1?'other one':'other '+g.mirrored}: make the same cuts the other way round, so the long point of each tilted cut is on the ${otherFace} instead of the ${face}. Tilt the blade the other way, or turn the board over and cut from the other end.`};
}
/* the shape part of a cut list row's Note: how it is cut, where its drawing is, how its length is measured, how
   many squares a corner shelf takes, and how the two hands of a mirror-twin row differ */
function shapeRowNote(g){
  const p=g.sample;
  if(!p||!p.shape)return[];
  const out=[`${shapeNote(p)}. See drawing ${g.id}`];
  if([0,1].some(i=>{const e=shapeEnd(p,i);return e&&e.cut==='saw';}))out.push('Length is long point to long point');
  if(isDiagonalHalf(p)){
    const squares=Math.ceil(g.qty/2);
    out.push(`Cut ${squares} square${squares>1?'s':''}: each one, cut once corner to corner, gives 2`);
  }
  const hands=rowHands(g);
  if(hands)out.push(`${g.qty}: ${hands.asDrawn}, ${hands.other}`);
  return out;
}

/* ---------- the pages ---------- */
function shapesSection(list){
  const rows=list.rows.filter(g=>g.sample&&g.sample.shape);
  if(!rows.length)return'';
  let h=`<h2>Shapes to cut</h2><p class="hint">Cut each blank to the size in the cut list first, then mark and cut its shape as its drawing shows. Sizes are in inches, measured from the end or edge they start at. A dashed line is the outline on the far face (a cut with the blade tilted).</p>`;
  for(const g of rows){
    const plan=shapeMarkPlan(g),how=shapeHowLines(g.sample),tools=shapeTools(g.sample),hands=rowHands(g);
    // a mirror-twin row: the drawing shows one hand; the other gets its own last line
    if(hands)how.push(hands.line);
    const count=hands?`${g.qty} to cut: ${hands.asDrawn}, ${hands.other}`:`${g.qty} to cut`;
    const layout=shapeDrawingLayout(plan);
    if(layout.brk)plan.notes.push(`The middle of the piece is left out of the drawing between the two zigzag lines (${fmt(layout.brk.u1-layout.brk.u0)} of plain board). The sizes are the real ones.`);
    h+=`<div class="shape-cut"><h3>${keyBox(g.id)} ${esc([...g.names].join(', '))}, ${esc(count)}</h3>${shapeDrawingSvgOf(layout)}`+
      (plan.notes.length?`<ul class="shape-notes">${plan.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`:'')+
      `<h4>How to cut</h4><ol>${how.map(line=>`<li>${esc(line)}</li>`).join('')}</ol>`+
      `<p class="shape-tools"><b>Tools:</b> ${esc(tools.join('; '))}.</p></div>`;
  }
  return h;
}
/* elsewhere: names of pieces whose shapes a later step of their own makes (a preset step's `shapes`, such as the
   toy chest's air holes, js/builders-storage.js): the cutting step leaves them to that step */
function shapeCutStepLine(list,elsewhere=[]){
  const letters=list.rows.filter(g=>g.sample&&g.sample.shape&&!elsewhere.includes(g.sample.name)).map(g=>g.id);
  if(!letters.length)return'';
  const named=letters.length===1?letters[0]:letters.slice(0,-1).join(', ')+' and '+letters[letters.length-1];
  return`Then cut the shape${letters.length>1?'s':''} of ${named} as ${letters.length>1?'their drawings show':'its drawing shows'} (Shapes to cut, on the cut list page).`;
}
/* the tools the shaped pieces need; only: names to ask about (a step that makes the shapes of those pieces), or
   leaving out: names whose shapes another step makes */
function shapeToolLines(only=null,leaving=[]){
  const out=new Set();
  for(const p of S.parts)if(p.shape&&!isProp(p)&&(!only||only.includes(p.name))&&!leaving.includes(p.name))shapeTools(p).forEach(t=>out.add(t));
  return[...out];
}

/* ---------- cutting diagrams ---------- */
function sheetRects(pieces,nameOf){
  const out=[],halves=new Map();
  for(const p of pieces){
    if(isDiagonalHalf(p)){
      const key=[p.l,p.w,nameOf(p)].join('|');
      if(!halves.has(key))halves.set(key,[]);
      halves.get(key).push(p);
      continue;
    }
    out.push({a:p.l,b:p.w,name:nameOf(p),piece:p.shape?p:null});
  }
  // two right triangles from one square: the bounding rectangle would buy twice the plywood (sheet 15)
  for(const list of halves.values()){
    for(let i=0;i<list.length;i+=2){
      const two=i+1<list.length;
      const label=nameOf(list[i]).split(':')[0];
      out.push({a:list[i].l,b:list[i].w,name:two?`${label} x2: cut on the diagonal`:`${label}: cut on the diagonal`,diagonal:true});
    }
  }
  return out;
}
function sheetShapePath(item){
  const p=item.piece;
  if(item.diagonal)return`<path class="shape-diag" d="M${item.x} ${item.y+item.h}L${item.x+item.w} ${item.y}" stroke="#14181d" stroke-width=".3" fill="none"/>`;
  if(!p||!p.shape)return'';
  const turned=Math.abs(item.w-p.l)>1e-6||Math.abs(item.h-p.w)>1e-6;
  const at=([u,v])=>turned?[item.x+v,item.y+u]:[item.x+u,item.y+v];
  const path=loop=>loop.map((q,i)=>{const[x,y]=at(q);return`${i?'L':'M'}${x.toFixed(3)} ${y.toFixed(3)}`;}).join('')+'Z';
  const outline=shapeOutline(p);
  return`<path class="shape-out" d="${path(outlineAt(p,0,outline))}${outline.openings.map(path).join('')}" fill-rule="evenodd"/>`;
}

/* ---------- self-checks ---------- */
SELFTESTS.push(function shapeCutRows(problems){
  const wrong=text=>problems.push('shape cut list: '+text);
  const kept=JSON.stringify(S);
  try{
    load(JSON.stringify(blank()),true);
    const leg=(x,long,bevel)=>{
      const p=mk('Leg','2x4',[1.5,11.5,3.5],[x,0,0]);
      p.shape={v:1,ends:[{cut:'saw',miter:11,long,bevel:bevel||0,bevelLong:1},{cut:'round',r:1.75}],corners:[null,null,null,null],feats:[]};
      return p;
    };
    // mirror twins with a face miter only: one row, qty 2
    addParts([leg(0,0),leg(10,1)]);
    tidyShapes();
    let list=cutRows();
    if(list.rows.length!==1||list.rows[0].qty!==2)wrong(`two legs that are mirror images make ${list.rows.length} rows`);
    // a different angle: a second row
    const other=leg(20,0);other.shape.ends[0].miter=12;addParts([other]);tidyShapes();
    list=cutRows();
    if(list.rows.length!==2)wrong(`a leg cut at 12° shares a row with the 11° legs (${list.rows.length} rows)`);
    // a bevelled pair: one row, "1 left, 1 right"
    load(JSON.stringify(blank()),true);
    addParts([leg(0,0,30),leg(10,1,30)]);
    const right=S.parts[1];right.shape=flipShape(S.parts[0].shape,2);
    tidyShapes();
    list=cutRows();
    if(list.rows.length!==1||list.rows[0].mirrored!==1)wrong('a bevelled leg and its mirror image are not one row with a left and a right');
    // the note and the drawing's numbers
    const html=cutListSection(list);
    if(!/cut at 11°, long point on the \w+ edge/.test(html)||!/See drawing A/.test(html))wrong('the cut list note does not say how the end is cut and where its long point is');
    if(!/Length is long point to long point/.test(html))wrong('the cut list does not say the length of an angled piece is long point to long point');
    if(!/2: 1 with the long point of the \w+ end's tilted cut on the \w+ face, 1 with it on the \w+ face/.test(html))wrong('the cut list does not say how the two hands of a bevelled pair differ');
    if(/\bleft, \d+ right/.test(html))wrong('the cut list still names the hands "left" and "right"');
    const drawn=shapesSection(list);
    if(!/For the other one: make the same cuts the other way round/.test(drawn))wrong('Shapes to cut gives the other hand no line of its own');
    // a trapezoid and a parallelogram do not read the same
    load(JSON.stringify(blank()),true);
    addParts([mk('Trap','1x4',[24,.75,3.5],[0,0,0]),mk('Para','1x4',[24,.75,3.5],[0,0,10])]);
    sawEnd(S.parts[0],'low',45,0);sawEnd(S.parts[0],'high',45,0);sawEnd(S.parts[1],'low',45,0);sawEnd(S.parts[1],'high',45,1);
    tidyShapes();
    const sides=cutListSection(cutRows());
    if(!/ends slant opposite ways/.test(sides)||!/ends parallel/.test(sides))wrong('a trapezoid and a parallelogram read the same in the cut list');
    // the cutting step names the tools the shapes need
    commit();
    const cutStep=buildPlan(true).steps.find(step=>step.kind==='cut');
    if(!cutStep)wrong('a design of two shaped boards has no cutting step');
    else if(!stepTools(cutStep).includes('miter saw (or a circular saw and a speed square)'))wrong('the cutting step does not list the miter saw the angled ends need');
    const plan=shapeMarkPlan(list.rows[0]),set=plan.dims.find(d=>/set-back/.test(d.what));
    if(!set||fmt(set.value)!=='11/16"'||set.text!=='11/16"')wrong(`the drawing marks the 11° set-back as ${set?set.text:'nothing'}, not 11/16"`);
    for(const d of plan.dims)if(d.text!==fmt(d.value)||Math.abs(d.to-d.from-d.value)>1e-6)wrong(`a size on the drawing says ${d.text} for ${d.what}, which measures ${fmt(d.to-d.from)}`);
    // six corner shelves cut corner to corner pack as three squares
    load(JSON.stringify(blank()),true);
    const shelves=[];
    for(let i=0;i<6;i++){
      const s=mk('Corner shelf','ply34',[11.875,.75,11.875],[i*13,0,0]);
      s.shape={v:1,ends:[null,null],corners:[{cut:'clip',a:11.875,b:11.875},null,null,null],feats:[]};
      shelves.push(s);
    }
    addParts(shelves);tidyShapes();
    const rects=sheetRects(S.parts,p=>'A: '+p.name);
    if(rects.length!==3||!rects.every(r=>/x2: cut on the diagonal/.test(r.name)))wrong(`six corner-to-corner shelves pack as ${rects.length} rectangles, not 3`);
    if(!/Cut 3 squares: each one, cut once corner to corner, gives 2/.test(cutListSection(cutRows())))wrong('the cut list row of six corner shelves does not say to cut 3 squares');
    if(!/1\/16(&quot;|") to 1\/8(&quot;|") short/.test(shapesSection(cutRows())))wrong('the drawing of a corner shelf does not mention the saw cut on the diagonal');
  }finally{
    load(kept,true);
  }
});

/* ---------- the drawings read clear, and every feature is located from one end and one edge ----------
   What a detailer sends back: a text cut off at the edge of the picture, a text on a line or on another text, a
   hole that is only SAID to be centered, features measured from different ends. Each drawing is drawn as the page
   draws it and its texts are measured there (the SVG scales evenly with the page and in print, so clear at one
   width is clear at all). */
function shapeTestPieces(){
  const board=(name,mat,l,x)=>mk(name,mat,[l,M[mat].t,M[mat].w],[x,0,0]);
  const sheet=(name,l,w,x)=>mk(name,'ply34',[l,.75,w],[x,0,0]);
  const at=(fromU,du,fromV,dv)=>({u:{from:fromU,d:du},v:{from:fromV,d:dv}});
  const pieces=[];
  // a 2x4 with each kind of end
  let p=board('Angled and rounded','2x4',24,0);sawEnd(p,0,30,0);roundEnd(p,1);pieces.push(p);
  p=board('Pointed and tilted','2x4',24,0);pointEnd(p,0,45,'w');sawEnd(p,1,15,0,30,1);pieces.push(p);
  p=board('Rounded corners and ridge','2x4',30,0);roundEnd(p,0,1);pointEnd(p,1,30,'t');pieces.push(p);
  p=board('Tilted and steep','2x4',24,0);sawEnd(p,0,0,0,45,1);sawEnd(p,1,45,1);pieces.push(p);
  // a long 1x2 with angled ends (drawn with a break)
  p=board('Long frame side','1x2',96,0);sawEnd(p,0,45,0);sawEnd(p,1,45,0);pieces.push(p);
  // a short wide panel with rounded corners and a small hole
  p=sheet('Short wide panel',30,10,0);p.l=10;p.w=30;p.ax=[p.ax[1],p.ax[0],p.ax[2]];cutCorner(p,2,{cut:'round',r:2});cutCorner(p,3,{cut:'round',r:2});addHole(p,{d:1,at:at('mid',0,0,6)});pieces.push(p);
  // a panel with one hole: 6" across, 9" from the right end, centered across the width
  p=sheet('One hole',48,24,0);addHole(p,{d:6,at:at(1,9,'mid',0)});pieces.push(p);
  // three holes
  p=sheet('Three holes',48,24,0);
  addHole(p,{d:3,at:at(0,6,0,8)});addHole(p,{d:1,at:at('mid',0,'mid',0)});addHole(p,{d:.5,at:at(0,40,1,4)});
  pieces.push(p);
  // a cut-out
  p=sheet('Cut-out',30,16,0);addCutout(p,{a:8,b:4,r:.5,at:at(0,10,'mid',0)});pieces.push(p);
  // rounded and cut corners
  p=sheet('Corners',24,18,0);
  cutCorner(p,0,{cut:'round',r:2});cutCorner(p,1,{cut:'clip',a:1.5,b:1.5});cutCorner(p,2,{cut:'round',r:1});cutCorner(p,3,{cut:'clip',a:3,b:2});
  pieces.push(p);
  // an edge notch and a slot
  p=board('Notch and slot','1x6',36,0);
  addNotch(p,{edge:1,len:3.5,depth:1,at:{u:{from:1,d:8}}});addSlot(p,{d:.5,len:3,dir:'u',at:at(0,18,'mid',0)});
  pieces.push(p);
  return pieces;
}
/* the problems of one drawing, its texts measured on the page (host: an element on the page to draw it in) */
function shapeDrawingProblems(plan,host,label){
  const problems=[],wrong=text=>problems.push(`${label}: ${text}`);
  const layout=shapeDrawingLayout(plan);
  for(const clash of layout.clashes)wrong(`${clash} found no place clear of the rest`);
  host.innerHTML=shapeDrawingSvgOf(layout);
  const svg=host.querySelector('svg'),nodes=[...svg.querySelectorAll('text')],view=layout.view;
  if(svg.viewBox.baseVal.width>SHAPE_DRAW.width+1)wrong(`the picture is ${Math.round(svg.viewBox.baseVal.width)} wide, more than ${SHAPE_DRAW.width}`);
  // shown at its own size (never blown up to the width of the page: its texts would be huge), and evenly
  const shown=svg.getBoundingClientRect();
  if(shown.width>Math.ceil(view.w)+3)wrong(`the picture is shown ${Math.round(shown.width)} wide, more than its own ${Math.ceil(view.w)}`);
  if(shown.width>0&&Math.abs(shown.height/shown.width-view.h/view.w)>.02)wrong('the picture is stretched more one way than the other');
  const boxes=nodes.map(node=>{
    const b=node.getBBox();
    return{text:node.textContent,x0:b.x,y0:b.y,x1:b.x+b.width,y1:b.y+b.height};
  });
  boxes.forEach((box,i)=>{
    // wholly inside the picture
    if(box.x0<view.x-.5||box.y0<view.y-.5||box.x1>view.x+view.w+.5||box.y1>view.y+view.h+.5)wrong(`"${box.text}" leaves the picture`);
    // clear of every line (an outline is drawn 2 wide)
    for(const seg of layout.segs){
      if(segmentHitsRect(seg.a,seg.b,shapeBoxRect(box),seg.kind==='outline'?1.5:1)){
        wrong(`"${box.text}" touches a line (${seg.kind}${seg.owner&&seg.owner.dim?' of '+seg.owner.dim.text:''})`);
        break;
      }
    }
    // clear of every other text
    for(let k=i+1;k<boxes.length;k++)if(shapeBoxesMeet(box,boxes[k],1))wrong(`"${box.text}" runs into "${boxes[k].text}"`);
  });
  // the shoulder of a leader (the level bit by its text) touches no other line: it would point at the wrong thing
  for(const shoulder of layout.segs.filter(seg=>seg.shoulder)){
    if(layout.segs.some(seg=>seg!==shoulder&&!(seg.kind==='leader'&&(seg.b===shoulder.a||seg.a===shoulder.a))&&shapeSegmentGap(shoulder.a,shoulder.b,seg.a,seg.b)<1))wrong('the leader of a note runs into a line by its text');
  }
  // every number on the drawing is the size it measures
  for(const d of plan.dims){
    if(d.text!==fmt(d.value)||Math.abs(d.to-d.from-d.value)>1e-6)wrong(`a size says ${d.text} for ${d.what}, which measures ${fmt(d.to-d.from)}`);
    if(!layout.texts.some(text=>text.dim===d))wrong(`the size ${d.text} (${d.what}) has no number on the drawing`);
    // its extension lines come off the piece where the size starts and ends
    const k=d.axis==='u'?0:1;
    if(Math.abs(d.ends[0][k]-d.from)>1e-6||Math.abs(d.ends[1][k]-d.to)>1e-6)wrong(`the extension lines of ${d.text} (${d.what}) do not come off where it starts and ends`);
  }
  // every hole, cut-out, slot and notch: a size from the one datum end and one from the one datum edge, as the
  // model has them
  const p=plan.piece,endU=plan.datum.end?p.l:0,edgeV=plan.datum.edge?p.w:0,feats=shapeFeatures(p);
  const names=shapeNames(p),how=shapeHowLines(p).join(' ');
  const endName=shapeLower(names.end[plan.datum.end]),edgeName=shapeLower(names.edge[plan.datum.edge]);
  feats.forEach((f,index)=>{
    if(plan.bad.includes(f))return;   // (not cut, so not drawn: the drawing says so in a note)
    const name=featureName(f),c=featureCenter(p,f),place=plan.locations.find(spot=>spot.index===index);
    const wantAlong=f.kind==='notch'?[c.u-f.len/2,c.u+f.len/2].map(u=>Math.abs(u-endU)):[Math.abs(c.u-endU)];
    const wantAcross=Math.abs((f.kind==='notch'?(f.edge===1?p.w-f.depth:f.depth):c.v)-edgeV);
    if(!place){wrong(`the ${name} is not located on the drawing`);return;}
    const fromDatum=(d,axis,origin)=>d&&plan.dims.includes(d)&&d.axis===axis&&(Math.abs(d.from-origin)<1e-6||Math.abs(d.to-origin)<1e-6);
    wantAlong.forEach((want,k)=>{
      const d=place.along.find(dim=>Math.abs(dim.value-want)<1e-6);
      if(!fromDatum(d,'u',endU))wrong(`the ${name} has no size of ${fmt(want)} from the ${endName}`);
      if(!how.includes(`${fmt(want)}`)||!new RegExp(`${fmt(want).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[^.]*from the ${endName}`).test(how))wrong(`the How to cut lines do not say the ${name} is ${fmt(want)} from the ${endName}`);
    });
    if(!fromDatum(place.across,'v',edgeV)||Math.abs(place.across.value-wantAcross)>1e-6)wrong(`the ${name} has no size of ${fmt(wantAcross)} from the ${edgeName}`);
    if(!how.includes(`${fmt(wantAcross)} from the ${edgeName}`)&&!(f.kind==='notch'&&f.edge===plan.datum.edge&&how.includes(`${fmt(f.depth)} in from the ${edgeName}`)))wrong(`the How to cut lines do not say the ${name} is ${fmt(wantAcross)} from the ${edgeName}`);
  });
  // "centered" only as a remark after the numbers
  if(/centered/.test(how.replace(/\d"? from the [a-z]+ edge \(centered across the width\)/g,'')))wrong('a How to cut line says "centered" without a number before it');
  return problems;
}
SELFTESTS.push(function shapeDrawingsReadClear(problems){
  const kept=JSON.stringify(S);
  const host=document.createElement('div');
  host.setAttribute('style','position:absolute;left:-10000px;top:0;width:640px;visibility:hidden');
  document.body.appendChild(host);
  try{
    load(JSON.stringify(blank()),true);
    const pieces=shapeTestPieces();
    addParts(pieces);
    tidyShapes();
    const rows=cutRows().rows.filter(g=>g.sample&&g.sample.shape);
    if(rows.length!==pieces.length)problems.push(`shape drawings: ${pieces.length} shaped test pieces make ${rows.length} rows`);
    for(const row of rows){
      for(const problem of shapeDrawingProblems(shapeMarkPlan(row),host,`shape drawing of ${row.sample.name}`))problems.push(problem);
    }
    // the owner's two examples, word for word
    const hole=rows.find(g=>g.sample.name==='One hole');
    if(hole){
      const how=shapeHowLines(hole.sample).join(' ');
      if(!/mark the center 9" from the right end and 12" from the back edge \(centered across the width\)/.test(how))problems.push(`shape drawings: the 6" hole is not marked "9" from the right end and 12" from the back edge" (${how})`);
    }
  }finally{
    host.remove();
    load(kept,true);
  }
});
