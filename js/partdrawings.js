/* NominalCAD: the piece drawings of "Drill your pieces" (spec 11, stage 1), and the HTML of that step.

   One drawing per label (js/drillplan.js), like a steel shop's single-part drawing: the piece lies with its length
   across the paper, the end with the label on the left, the top edge up; running sizes from that end (a small
   circle and 0, then one number at each hole, the cut length last), sizes down from the top edge only where the
   person marks them (the holes at the ends: the jig sets the other way), the end with the label and the top edge
   drawn heavy, each pocket hole as the oval the bit leaves (POCKET_OVAL, js/fasteners.js) with an arrow to where the
   jig goes, a hexagon tag for its jig setting, the dashed outline of a piece that sits on this one later where it
   explains a moved hole, and a legend. The drawing speaks the language of the marking views (js/markingview.js):
   the same ink, the one dark blue for holes (MARK_VIEW.fastener), extension lines with a small gap, slash ticks.
   It is drawn as SVG, so it prints sharp and the page can be read by the self-checks.

     PART_VIEW                   the sizes of the drawing (picture pixels; the SVG is shown the width of the page)
     partDrawingLayout(label, letterOf)   everything on the paper, measured: {width, height, views, texts, items,
                                 dims, holes, scale}  (no drawing: the self-check reads it)
     partDrawingSvg(layout)      the SVG
     drillStepHtml(step, plan)   step 2 on the Build instructions page
     drillModeHtml(step, plan)   the same step in Build step by step (js/stepmode.js)

   Why its own layout and not layoutMarkPlan: a marking view is one face of one joint, windowed and broken around
   its fasteners, one picture per plan. A piece drawing is the whole piece, one or two views at one scale, every
   number written along its own extension line, tags and the label corner: the spec's frame and words are used
   (benchFrame, js/drillplan.js), the drawing is laid out here. */
'use strict';

// (the type sizes are those of css/style.css, svg.pd; the picture is shown about 0.74 of its width on the page)
// (minDrawn: a long thin piece is drawn at least this tall, stretched across its width, so that its holes can be told
//  apart; its title says so, and every size is written, so nothing is measured off the paper: carry-over 12)
const PART_VIEW={width:920,maxScale:40,maxHeight:300,minDrawn:56,number:16,label:14,legend:14,title:16,
  gap:24,ext:3,extOver:6,tick:5,datumR:4.5,arrow:10,hexR:10};
const PART_INK='#14181d',PART_GRAY='#3c434b';
const PART_HOLE=()=>MARK_VIEW.fastener;

/* text widths, measured as the page draws them */
let partCanvas=null;
function partTextWidth(text,size,bold){
  if(!partCanvas)partCanvas=document.createElement('canvas');
  const ctx=partCanvas.getContext('2d');
  ctx.font=`${bold?600:400} ${size}px "Segoe UI",system-ui,Arial,sans-serif`;
  return Math.ceil(ctx.measureText(text).width);
}
const boxesOverlap=(a,b,gap)=>a.x<b.x+b.w+(gap||0)&&a.x+a.w+(gap||0)>b.x&&a.y<b.y+b.h+(gap||0)&&a.y+a.h+(gap||0)>b.y;

/* ---------- the rows of a view's hole table: one per setting and way the jig goes ---------- */
function viewRows(view){
  const rows=[];
  for(const entry of view.holes){
    if(entry.clamp==='face')continue;   // (a hole a bit makes: its rows are those of its place, placeRows)
    const kind=entry.clamp==='top'||entry.clamp==='bottom'?entry.clamp:'end';
    let row=rows.find(one=>one.setup===entry.setup&&one.kind===kind);
    if(!row){row={setup:entry.setup,kind,holes:[]};rows.push(row);}
    row.holes.push(entry);
  }
  return rows.sort((a,b)=>a.setup-b.setup||(a.kind<b.kind?-1:1));
}

/* ---------- the places a view's holes a bit makes are measured from (spec 11, 4.4, stage 2) ----------
   A clearance hole and its pilot, the two holes of a dowel: both drawings measure them from the same corner of the
   place where the two pieces touch (placePairs, js/drillplan.js), with the same numbers. On this view each place
   is: its corner (a: from the end with the label, b: down from the top edge), its far corner, the holes' distances
   from the corner across the paper (h) and down it (v), and the name of the other piece. A place that is not the
   whole face is drawn dashed and its corner located from the end with the label and the top edge first. */
const PLACE_EDGE=1/64;
function viewPlaces(view){
  const groups=new Map();
  for(const entry of view.holes){
    if(entry.clamp!=='face'||!entry.hole.place)continue;
    const place=entry.hole.place;
    if(!groups.has(place))groups.set(place,[]);
    groups.get(place).push(entry);
  }
  const L=view.length,H=view.height,frame=view.frame;
  const clip=(v,size)=>Math.max(0,Math.min(size,v));
  return[...groups].map(([place,entries])=>{
    const own=cornerOfPlace(place,view.piece);
    const corner=benchPoint(frame,own);
    const far=own.slice();
    far[place.u]=place.ru[0]+place.ru[1]-own[place.u];
    far[place.v]=place.rv[0]+place.rv[1]-own[place.v];
    const other=benchPoint(frame,far);
    const a=[clip(corner.a,L),clip(other.a,L)],b=[clip(corner.b,H),clip(other.b,H)];
    const atEdgeA=v=>v<PLACE_EDGE||v>L-PLACE_EDGE,atEdgeB=v=>v<PLACE_EDGE||v>H-PLACE_EDGE;
    const whole=Math.min(...a)<PLACE_EDGE&&Math.max(...a)>L-PLACE_EDGE&&Math.min(...b)<PLACE_EDGE&&Math.max(...b)>H-PLACE_EDGE;
    const hole0=entries[0].hole,f=hole0.f,otherPiece=hole0.piece===f.through?f.into:f.through;
    // which end and edge a dashed place is pencilled on from: the one it is flush with (a place flush with the far
    // end is measured from the far end, never across the piece from the end with the label: C2 of the stage 2 review)
    const fromFar=Math.max(...a)>L-PLACE_EDGE&&Math.min(...a)>=PLACE_EDGE,fromBottom=Math.max(...b)>H-PLACE_EDGE&&Math.min(...b)>=PLACE_EDGE;
    return{place,entries,corner:{a:corner.a,b:corner.b},far:{a:other.a,b:other.b},a,b,dashed:!whole,fromFar,fromBottom,
      // where the corner is from the end with the label and the top edge, when it is not on them (located first)
      locateA:!atEdgeA(corner.a),locateB:!atEdgeB(corner.b),
      offsets:entries.map(entry=>({entry,h:Math.abs(entry.a-corner.a),v:Math.abs(entry.b-corner.b)})),
      other:otherPiece,beyond:hole0.kind==='clear'};
  });
}
/* The names of the four sides of a view on the paper (spec 11, 4.4: "say plainly which face of the board the person
   is looking at"): its top and bottom, the side where its sizes start (start) and the other (far). On a face the
   sides are edges and ends; on an edge view the top and bottom of the paper are the two faces; on an end view the
   start is the face with the label. */
const VIEW_SIDES={
  face1:{top:'top edge',bottom:'bottom edge',start:'end with the label',far:'far end'},
  topedge:{top:'face without the label',bottom:'face with the label',start:'end with the label',far:'far end'},
  bottomedge:{top:'face with the label',bottom:'face without the label',start:'end with the label',far:'far end'},
  labelend:{top:'top edge',bottom:'bottom edge',start:'face with the label',far:'face without the label'},
};
VIEW_SIDES.face2=VIEW_SIDES.mirror=VIEW_SIDES.face1;
VIEW_SIDES.farend=VIEW_SIDES.labelend;
const sidesOf=view=>VIEW_SIDES[view.kind]||VIEW_SIDES.face1;
/* the title of a view: which face of the board the person looks at, and how it lies */
function viewTitle(view,label){
  const sides=sidesOf(view),onLeft=view.datumLeft?'left':'right';
  switch(view.kind){
    case'face1':return'Face 1, with the label';
    case'face2':return'Face 2: turn it end for end, top edge still up';
    case'mirror':return`Mirror image (${label.mirrorLabel.name}): the same sizes, the end with the label on the right`;
    case'topedge':return`The top edge, seen square on: the face with the label at the bottom of the picture, the end with the label on the ${onLeft}`;
    case'bottomedge':return`The bottom edge, seen square on: the face with the label at the top of the picture, the end with the label on the ${onLeft}`;
    case'labelend':return`The end with the label, seen square on, top edge up: the face with the label on the ${onLeft}`;
    case'farend':return`The far end, seen square on, top edge up: the face with the label on the ${onLeft}`;
  }
  void sides;
  return'';
}
/* The chains of sizes of a view's places (spec 11, 4.4): from the corner of each place (its own small circle and 0)
   to its holes, along the paper and across it. Places whose corners share one line share a chain: the sizes from
   that line are the same for both. Along chains go in bands under the piece, across chains in bands beside it, on
   the side their places are nearer. */
/* A view with more places than this (a top screwed down onto legs, aprons and a rail) draws each place dashed with
   the small circle at its corner, and gives their sizes in the table only: a chain of sizes per place, stacked
   round the piece, would bury it (spec 11, "keep step 2 readable"). Its title says so. */
const PLACES_SIZED_ON_PAPER=3;
const placesSizedOnPaper=view=>viewPlaces(view).length<=PLACES_SIZED_ON_PAPER;
function placeChains(view){
  const along=[],across=[];
  if(!placesSizedOnPaper(view))return{along,across};
  // (places share a chain only when it gives the same numbers for each: different numbers from one line would crowd
  //  one another, so they go in a band of their own)
  const add=(list,origin,dir,values,place)=>{
    const same=[...new Set(values)].sort((a,b)=>a-b).join(',');
    let chain=list.find(one=>Math.abs(one.origin-origin)<1e-6&&one.dir===dir&&one.same===same);
    if(!chain){chain={origin,dir,values:new Set(),places:[],same};list.push(chain);}
    for(const value of values)chain.values.add(value);
    chain.places.push(place);
  };
  for(const place of viewPlaces(view)){
    const dirA=place.far.a>=place.corner.a?1:-1,dirB=place.far.b>=place.corner.b?1:-1;
    add(along,place.corner.a,dirA,place.offsets.map(o=>r16(o.h)),place);
    add(across,place.corner.b,dirB,place.offsets.map(o=>r16(o.v)),place);
  }
  for(const chain of along.concat(across))chain.values=[...chain.values].sort((a,b)=>a-b);
  for(const chain of across){
    const middle=average(chain.places.map(place=>(place.a[0]+place.a[1])/2));
    chain.side=(middle<view.length/2)===view.datumLeft?'left':'right';
  }
  return{along,across};
}
/* the room beside the piece: the sizes of the pocket holes at its ends first, then a band per across chain */
function sideBands(view){
  const V=PART_VIEW,ends=endChains(view),chains=placeChains(view);
  const numberWidth=list=>list.length?Math.max(...list.map(value=>partTextWidth(fmt(r16(value)),V.number,true))):0;
  const sides={left:{used:ends.left.length?24+numberWidth(ends.left)+14:0,bands:[]},right:{used:ends.right.length?24+numberWidth(ends.right)+14:0,bands:[]}};
  // chains whose stretches up and down the paper do not meet share a column (the places at the top and at the bottom
  // of a deck); the scale is not known yet, so their stretches are judged at the largest scale the piece could take
  const guess=Math.min(V.maxScale,(V.width-120)/view.length,V.maxHeight/view.height);
  for(const sideName of['left','right']){
    const side=sides[sideName],own=chains.across.filter(chain=>chain.side===sideName);
    const spans=own.map(chain=>{
      const ends=[chain.origin,chain.origin+chain.dir*Math.max(...chain.values)].map(v=>v*guess);
      return{lo:Math.min(...ends)-V.number,hi:Math.max(...ends)+V.number};
    });
    const column=packBands(spans,4),columns=own.length?Math.max(...column)+1:0;
    for(let c=0;c<columns;c++){
      const inColumn=own.filter((chain,i)=>column[i]===c);
      const base=side.used+22;
      for(const chain of inColumn)side.bands.push({chain,base});
      side.used=base+10+numberWidth(inColumn.flatMap(chain=>chain.values).concat([0]))+10;
    }
  }
  return{ends,chains,sides};
}
/* the size of a hole a bit makes on the paper (inches): its bit, or the counterbore its head sits in */
function roundHoleDia(hole){
  if(hole.kind==='clear')return hole.sunk>0?DRILL_BITS.counterbore.size:DRILL_BITS.clearance.size;   // (DRILL_BITS: the one table of bits)
  if(hole.kind==='pilot')return DRILL_BITS[pilotBitKey()].size;
  return hole.dia||.375;
}
/* A hole a bit makes, on the paper: a circle the size of the bit (at least a few pixels); the clearance hole with a
   ring for the countersink on the face its head goes in, or with the 11/64" hole drawn inside its counterbore; a
   pilot hole with a center cross; a dowel hole with a center cross; a short flag on a hole whose head is plugged. */
function roundMark(out,entry,cx,cy,scale,index){
  const hole=entry.hole,kind=hole.kind;
  const r=Math.max(kind==='pilot'?2.5:3.5,roundHoleDia(hole)/2*scale);
  const ring=kind==='clear'&&hole.countersink?r+3:0;
  const inner=kind==='clear'&&hole.sunk>0?Math.max(1.8,DRILL_BITS.clearance.size/2*scale):0;
  const outer=Math.max(r,ring);
  const mark={round:true,kind,cx,cy,r,ring,inner,plug:!!hole.plug,entry,view:index,
    box:{x:cx-outer,y:cy-outer,w:2*outer,h:2*outer}};
  if(mark.plug){
    // the flag: a short staff up and to the right, with a small pennant
    mark.flag=[cx+outer*.7,cy-outer*.7,cx+outer*.7+5,cy-outer*.7-9];
    mark.box={x:cx-outer,y:cy-outer-10,w:2*outer+11,h:2*outer+10};
  }
  out.holes.push(mark);
  return mark;
}
/* The places of the holes a bit makes on one view, drawn and measured (spec 11, 4.4): a place that is not the whole
   face dashed (it is located in words, like a piece that sits here later: the table says where to pencil it), and
   from its corner, on the paper, the running sizes of its holes along and across. Returns the names to lay under
   the piece ({text, px, py} as dashedPieces gives them) and how much room the bands take under it. */
function layPlaces(out,view,index,ctx){
  const V=PART_VIEW,{x0,x1,yTop,yBottom,px,py,addText,line,holeMarks}=ctx;
  const layout=sideBands(view),chains=layout.chains,names=[];
  const places=viewPlaces(view);
  for(const place of places){
    if(!place.dashed)continue;
    const xa=px(place.a[0]),xb=px(place.a[1]),ya=py(Math.min(...place.b)),yb=py(Math.max(...place.b));
    const rect={type:'rect',x:Math.min(xa,xb),y:ya,w:Math.abs(xb-xa),h:yb-ya,cls:'hid',place,view:index};
    out.items.push(rect);
    names.push({text:`${pieceLabel(place.other,ctx.letterOf||(()=>''))} sits here`,px:[rect.x,rect.x+rect.w],py:[ya,yb],
      wholeWidth:Math.min(...place.b)<PLACE_EDGE&&Math.max(...place.b)>view.height-PLACE_EDGE,place});
  }
  const marksOf=(chain,value,axis)=>holeMarks.filter(mark=>chain.places.some(place=>place.offsets.some(o=>o.entry===mark.entry&&Math.abs(r16(axis==='along'?o.h:o.v)-value)<1e-6)));
  // along: bands above the piece when nothing else is there (the tags under the piece then reach their holes
  // without crossing a number), else under it (under the running sizes of a row along the bottom edge)
  const{bandOf,bandHeight,bands}=placeAlongBands(view,px);
  const above=!!ctx.above,start=ctx.below;
  // the corner of each place, where its sizes start: a small circle with a corner mark that runs along the place's
  // two sides, so it is told apart from the circle at the end with the label (C9 of the stage 2 review)
  for(const place of places){
    const toward=(from,to)=>to>=from?1:-1;
    out.items.push({type:'corner',x:px(place.corner.a),y:py(place.corner.b),
      dx:(view.datumLeft?1:-1)*toward(place.corner.a,place.far.a),dy:toward(place.corner.b,place.far.b)});
  }
  chains.along.forEach((chain,k)=>{
    const base=above?yTop-V.gap-bandOf[k]*bandHeight:yBottom+start+V.gap+bandOf[k]*bandHeight;
    const out1=above?-V.extOver:V.extOver;
    const points=[{value:0,x:px(chain.origin),origin:true}].concat(chain.values.map(value=>({value,x:px(chain.origin+chain.dir*value)})));
    const xs=points.map(point=>point.x);
    line(Math.min(...xs),base,Math.max(...xs),base,'thin');
    let last=null;
    for(const point of points.slice().sort((a,b)=>a.x-b.x)){
      // the extension line: from the corner of the place nearest the band, or from the hole at this size nearest it
      const marks=point.origin?[]:marksOf(chain,point.value,'along');
      const from=above
        ?(point.origin?Math.min(...chain.places.map(place=>py(place.corner.b)))-V.ext:Math.min(...marks.map(mark=>mark.box.y))-V.ext)
        :(point.origin?Math.max(...chain.places.map(place=>py(place.corner.b)))+V.ext:Math.max(...marks.map(mark=>mark.box.y+mark.box.h))+V.ext);
      line(point.x,from,point.x,base+out1,'thin');
      if(point.origin){out.items.push({type:'datum',x:point.x,y:base});continue;}
      line(point.x-V.tick,base+V.tick,point.x+V.tick,base-V.tick,'tick');
      const text=fmt(point.value);
      let tx=point.x+5;
      if(last!==null&&tx-V.number*.78<last+3)tx=last+3+V.number*.78;
      const ty=above?base+out1-4:base+out1+4;
      const entry=addText(text,tx,ty,V.number,{rotate:true,anchor:above?'start':'end',bold:true,role:'dim'});
      if(Math.abs(tx-(point.x+5))>.5)line(point.x,base+out1,tx-5,above?ty-2:ty+2,'thin');
      last=entry.box.x+entry.box.w;
      out.dims.push({kind:'place',axis:'along',value:point.value,text,x:point.x,base,entry,view:index,chain,top:above});
    }
  });
  // across: bands beside the piece
  for(const sideName of['left','right']){
    for(const band of layout.sides[sideName].bands){
      const chain=band.chain,right=sideName==='right',xb=right?x1+band.base:x0-band.base;
      const points=[{value:0,y:py(chain.origin),origin:true}].concat(chain.values.map(value=>({value,y:py(chain.origin+chain.dir*value)})));
      const ys=points.map(point=>point.y);
      line(xb,Math.min(...ys),xb,Math.max(...ys),'thin');
      let last=null;
      for(const point of points.slice().sort((a,b)=>a.y-b.y)){
        const marks=point.origin?[]:marksOf(chain,point.value,'across');
        const cornerXs=chain.places.map(place=>px(place.corner.a));
        const from=point.origin?(right?Math.max(...cornerXs)+V.ext:Math.min(...cornerXs)-V.ext)
          :right?Math.max(...marks.map(mark=>mark.box.x+mark.box.w))+V.ext:Math.min(...marks.map(mark=>mark.box.x))-V.ext;
        line(from,point.y,right?xb+V.extOver:xb-V.extOver,point.y,'thin');
        if(point.origin){out.items.push({type:'datum',x:xb,y:point.y});continue;}
        line(xb-V.tick,point.y+V.tick,xb+V.tick,point.y-V.tick,'tick');
        const text=fmt(point.value);
        let ty=point.y+5;
        if(last!==null&&ty-V.number*.78<last+2)ty=last+2+V.number*.78;
        const entry=addText(text,right?xb+10:xb-10,ty,V.number,{anchor:right?'start':'end',bold:true,role:'dim'});
        if(Math.abs(ty-(point.y+5))>.5)line(right?xb+V.extOver:xb-V.extOver,point.y,right?xb+9:xb-9,ty-5,'thin');
        last=entry.box.y+entry.box.h;
        out.dims.push({kind:'place',axis:'across',value:point.value,text,y:point.y,base:xb,entry,view:index,chain});
      }
    }
  }
  return{names,below:start+(bands&&!above?V.gap+bands*bandHeight:0)};
}
/* The bands the along chains of a view's places take (packed so that chains side by side share one): the band of each
   chain, how tall a band is, and how many (px: a distance from the end with the label to the paper) */
function placeAlongBands(view,px){
  const V=PART_VIEW,chains=placeChains(view).along;
  const numberLen=list=>list.length?Math.max(...list.map(value=>partTextWidth(fmt(r16(value)),V.number,true))):0;
  const spans=chains.map(chain=>{
    const xs=[chain.origin,...chain.values.map(value=>chain.origin+chain.dir*value)].map(px);
    return{lo:Math.min(...xs)-6,hi:Math.max(...xs)+V.number+8};
  });
  const bandOf=packBands(spans,10);
  const bandHeight=V.gap+V.extOver+8+numberLen(chains.flatMap(chain=>chain.values));
  return{bandOf,bandHeight,bands:chains.length?Math.max(...bandOf)+1:0};
}
/* Chains packed into bands: each chain {lo, hi} (paper units) goes in the first band where it overlaps nothing.
   Returns the band number of each. */
function packBands(chains,gap){
  const bands=[];
  return chains.map(chain=>{
    let index=bands.findIndex(band=>band.every(other=>chain.hi+gap<other.lo||chain.lo>other.hi+gap));
    if(index<0){bands.push([]);index=bands.length-1;}
    bands[index].push(chain);
    return index;
  });
}

/* ---------- the layout ---------- */
function partDrawingLayout(label,plan){
  const V=PART_VIEW,views=label.views,piece=label.way.sample;
  const out={width:V.width,height:0,texts:[],items:[],dims:[],holes:[],views:[],label,scale:0};
  const addText=(text,x,y,size,opts)=>{
    // x, y: the start of the baseline (anchor 'start'), or its end or middle; rotated texts read bottom to top
    opts=opts||{};
    const w=partTextWidth(text,size,opts.bold),h=size;
    const anchor=opts.anchor||'start',rotate=!!opts.rotate;
    let box;
    if(!rotate){
      const x0=anchor==='start'?x:anchor==='end'?x-w:x-w/2;
      box={x:x0,y:y-h*.78,w,h};
    }else{
      // rotated -90 about (x, y): the text runs up from y (anchor start) or ends at y (anchor end)
      const y0=anchor==='start'?y-w:anchor==='end'?y:y-w/2;
      box={x:x-h*.78,y:y0,w:h,h:w};
    }
    const entry={text,x,y,size,anchor,rotate,box,cls:opts.cls||'n',bold:!!opts.bold,role:opts.role||''};
    out.texts.push(entry);
    return entry;
  };
  const line=(x1,y1,x2,y2,cls)=>out.items.push({type:'line',x1,y1,x2,y2,cls});
  // the scale: the length of the piece across the paper, at most 40 px per inch, at most PART_VIEW.maxHeight tall
  // (every view at one scale, the length of the faces and edges across the paper; an end view is drawn at its true
  //  shape and size beside them, not stretched to their width: the end of a 2x4 must look like the end of a 2x4)
  const margins=views.map(view=>sideNeeds(view));
  const mL=Math.max(...margins.map(m=>m.left)),mR=Math.max(...margins.map(m=>m.right));
  const lengthViews=views.filter(view=>!isEndView(view));
  const L=Math.max(...(lengthViews.length?lengthViews:views).map(view=>view.length)),H=Math.max(...views.map(view=>view.height));
  const scale=Math.min(V.maxScale,(V.width-mL-mR)/L,V.maxHeight/H);
  out.scale=scale;
  const x0=mL+((V.width-mL-mR)-L*scale)/2,x1=x0+L*scale;
  // the title
  const name=`${labelNames(label)} (${label.name}${label.mirrorLabel?' and '+label.mirrorLabel.name:''})`;void piece;
  addText(`Where to drill: ${name}`,16,24,V.title,{cls:'t1',bold:true,role:'title'});
  const stretched=lengthViews.some(view=>stretchOf(view,scale)>scale+1e-9);
  const endsLarger=views.some(view=>isEndView(view)&&stretchOf(view,scale)>scale+1e-9);
  addText(drawingSubtitle(label,views),16,43,V.label,{cls:'t2',role:'title'});
  let y=62;
  if(stretched){addText('Drawn wider across than it is, so the holes can be told apart: go by the numbers.',16,y-1,V.label,{cls:'t2',role:'title'});y+=18;}
  if(endsLarger){addText('The end is drawn larger than the rest, at its true shape, so its holes can be told apart.',16,y-1,V.label,{cls:'t2',role:'title'});y+=18;}
  if(views.some(view=>!placesSizedOnPaper(view))){
    addText('Each dashed place has a corner mark where its holes are measured from: their sizes are in the table.',16,y-1,V.label,{cls:'t2',role:'title'});
    y+=18;
  }
  views.forEach((view,index)=>{
    const block=layView(out,view,index,label,{x0,x1,y,scale,addText,line,letterOf:plan.letterOf,stepOfPiece:plan.stepOfPiece});
    y=block.bottom+14;
  });
  // (the legend is drawn once for the whole step, above the first drawing: drillLegendLayout)
  out.legend=legendEntries(label,out);
  out.height=Math.ceil(y+2);
  return out;
}
/* One legend for all the drawings of step 2 (the same few signs on every drawing: written once, the page is
   shorter): every sign any of the drawings uses. */
function drillLegendLayout(layouts){
  const V=PART_VIEW,out={width:V.width,height:0,texts:[],items:[],dims:[],holes:[],views:[],label:null,scale:1,legendOnly:true};
  const entries=[];
  for(const layout of layouts)for(const entry of layout.legend||[]){
    const same=entries.find(one=>one.kind===entry.kind);
    if(!same)entries.push({...entry,tags:entry.tags?entry.tags.slice():undefined});
    else if(entry.tags)same.tags=[...new Set(same.tags.concat(entry.tags))].sort((a,b)=>a-b);
  }
  for(const entry of entries)if(entry.kind==='hex'){
    entry.tag=entry.tags[0];
    entry.text=entry.tags.length>1?`jig settings ${listWords(entry.tags.map(String))} (the table above)`:`jig setting ${entry.tag} (the table above)`;
  }
  // (the order of the signs: holes first, then the tags, then the circles and the dashed lines)
  const ORDER=['pocket','clear','bore','flag','pilot','dowel','hex','datum','corner','hidden','plug'];
  entries.sort((a,b)=>ORDER.indexOf(a.kind)-ORDER.indexOf(b.kind));
  let x=16,y=18;
  for(const entry of entries){
    const w=partTextWidth(entry.text,V.legend,false)+40;
    if(x+w>V.width-12){x=16;y+=22;}
    out.items.push({type:'legend',kind:entry.kind,x,y,tag:entry.tag});
    const w2=partTextWidth(entry.text,V.legend,false);
    out.texts.push({text:entry.text,x:x+34,y:y+4,size:V.legend,anchor:'start',rotate:false,box:{x:x+34,y:y+4-V.legend*.78,w:w2,h:V.legend},cls:'lg',bold:false,role:'legend'});
    x+=w+18;
  }
  out.height=Math.ceil(y+14);
  return out;
}
/* an end of the piece seen square on: drawn at its own true shape (the same scale both ways), centred under the
   faces, never stretched to their length */
const isEndView=view=>view.kind==='labelend'||view.kind==='farend';
/* the scale down the paper of a view: the drawing's scale, or more for a thin view, to be at least minDrawn tall
   (an end view takes the same scale across: it is drawn larger, not stretched) */
function stretchOf(view,scale){
  return Math.max(scale,Math.min(PART_VIEW.maxScale,PART_VIEW.minDrawn/view.height));
}
/* how much room a view needs left and right of the piece: the sizes down from the top edge at an end */
function sideNeeds(view){
  const sides=sideBands(view).sides;
  return{left:Math.max(56,sides.left.used+16),right:Math.max(56,sides.right.used+16)};
}
/* the sizes down from the top edge of the holes at each end of the paper: left and right ([] where there are none;
   the same numbers at both ends are written once, at the right) */
function endChains(view){
  const atSide=side=>view.holes.filter(entry=>entry.clamp==='labelled'||entry.clamp==='far').filter(entry=>(entry.clamp==='labelled')===(side==='left'?view.datumLeft:!view.datumLeft));
  const values=list=>[...new Set(list.map(entry=>r16(entry.b)))].sort((a,b)=>a-b);
  let left=values(atSide('left')),right=values(atSide('right'));
  if(left.length&&right.length&&left.join()===right.join())left=[];
  return{left,right};
}
/* the name of the drilled face: the same for every piece of the label ('inside face (the one that faces the middle
   of the design)'), else, when the pieces of one label end up facing different ways (a base rail facing in, a back
   rail facing the back), the face by what it is: the one with the holes */
function drawnFaceWords(label){
  const members=label.members.concat(label.mirrorLabel?label.mirrorLabel.members:[]);
  const names=new Set(members.map(member=>faceWords(member.piece,member.frame.n,false)));
  return names.size===1?[...names][0]:'the face with the holes (it ends up hidden)';
}
function drawingSubtitle(label,views){
  const face=drawnFaceWords(label);
  // (an edge or an end alone: the view says which, and where the face with the label is)
  if(views.length===1&&!/^face1$/.test(views[0].kind))return viewTitle(views[0],label);
  if(views.length===1)return`${capital(face)}, seen square on, top edge up`;
  if(views[1].kind==='mirror')return`${capital(face)}, seen square on, top edge up: as drawn (${label.name}) and the mirror image (${label.mirrorLabel.name})`;
  if(views.every(view=>view.kind==='face1'||view.kind==='face2'))return'Face 1 (with the label) and face 2, each seen square on, top edge up';
  return`${views.length} views of the piece: the faces, edges and ends that have holes, each seen square on`;
}
/* one view: the piece, its sizes, its holes, its tags */
function layView(out,view,index,label,ctx){
  const V=PART_VIEW,{addText,line}=ctx;
  // (the faces and edges run from x0 to x1 at the drawing's scale; an end view, its own width at its true shape,
  //  centred under them)
  const endView=isEndView(view),scale=endView?stretchOf(view,ctx.scale):ctx.scale;
  const middleX=(ctx.x0+ctx.x1)/2,x0=endView?middleX-view.length*scale/2:ctx.x0,x1=endView?middleX+view.length*scale/2:ctx.x1;
  let y=ctx.y;
  const two=label.views.length>1;
  if(two){
    const title=viewTitle(view,label);
    const first=index===0&&label.mirrorLabel&&view.kind==='face1'?`As drawn (${label.name})`:title;
    addText(first,16,y+12,V.label,{cls:'lb',bold:true,role:'view'});
    y+=22;
  }
  const rows=viewRows(view);
  const topRows=view.holes.filter(entry=>entry.clamp==='top'),bottomRows=view.holes.filter(entry=>entry.clamp==='bottom');
  const numberLen=list=>list.length?Math.max(...list.map(value=>partTextWidth(fmt(r16(value)),V.number,true))):0;
  const alongValues=list=>[...new Set(list.map(entry=>r16(entry.a)))].sort((a,b)=>a-b);
  const topValues=alongValues(topRows),bottomValues=alongValues(bottomRows);
  const runTop=topValues.length?[0,...topValues,r16(view.length)]:[];
  const runBottom=bottomValues.length?[0,...bottomValues,r16(view.length)]:[];
  const px=a=>view.datumLeft?x0+a*scale:x1-a*scale;   // a: from the end with the label
  const sy=stretchOf(view,scale);                      // the scale down the paper (a thin piece stretched)
  // the band above the piece: the running sizes and the name of the top edge; or, with no row along the top, the
  // sizes along the piece from the corners of its places (layPlaces)
  const placeBands=runTop.length?null:placeAlongBands(view,px);
  const placesAbove=!!placeBands&&placeBands.bands>0;
  const topBand=runTop.length?numberLen(runTop)+V.gap+22:placesAbove?V.gap+placeBands.bands*placeBands.bandHeight+6:30;
  const yTop=y+topBand,yBottom=yTop+view.height*sy;
  const py=b=>yTop+b*sy;                             // b: down from the top edge
  const xDatum=view.datumLeft?x0:x1,xFar=view.datumLeft?x1:x0;
  const layoutView={kind:view.kind,x0,x1,yTop,yBottom,datumLeft:view.datumLeft,view,sx:scale,sy};
  out.views.push(layoutView);
  // the piece, with the end with the label and the top edge heavy
  out.items.push({type:'rect',x:x0,y:yTop,w:x1-x0,h:yBottom-yTop,cls:'wood'});
  line(x0,yTop,x1,yTop,'heavy');
  line(xDatum,yTop,xDatum,yBottom,'heavy');
  // a piece that sits here later, where it explains a moved hole (rule 10): dashed, named with a leader below
  const others=dashedPieces(view,ctx);
  for(const other of others){
    const a=px(other.from),b=px(other.to),top=py(other.top),bottom=py(other.bottom);
    out.items.push({type:'rect',x:Math.min(a,b),y:top,w:Math.abs(b-a),h:bottom-top,cls:'hid',other,view:index});
    other.px=[Math.min(a,b),Math.max(a,b)];
    other.py=[top,bottom];
  }
  // the holes: pocket holes as the oval the bit leaves; the holes a bit makes as circles (roundMark)
  const holeMarks=view.holes.filter(entry=>entry.clamp==='face').map(entry=>roundMark(out,entry,px(entry.a),py(entry.b),scale,index));
  holeMarks.unshift(...view.holes.filter(entry=>entry.clamp!=='face').map(entry=>{
    const cx=px(entry.a),cy=py(entry.b);
    const dx=(view.datumLeft?1:-1)*entry.dAlong,dy=entry.dDown,long=Math.hypot(dx,dy)||1;
    const ux=dx/long,uy=dy/long;
    const rx=Math.max(6,POCKET_OVAL*scale),ry=Math.max(2.5,(entry.hole.f.pocket.dia/2)*scale);
    const angle=Math.atan2(uy,ux)*180/Math.PI;
    // the box the oval takes on the paper
    const ex=Math.sqrt((rx*ux)**2+(ry*uy)**2),ey=Math.sqrt((rx*uy)**2+(ry*ux)**2);
    const mark={cx,cy,rx,ry,angle,ux,uy,entry,box:{x:cx-ex,y:cy-ey,w:2*ex,h:2*ey},
      arrow:[cx+ux*(rx+2.5),cy+uy*(rx+2.5),cx+ux*(rx+2.5+V.arrow),cy+uy*(rx+2.5+V.arrow)],plugged:entry.plugged,view:index};
    out.holes.push(mark);
    return mark;
  }));
  // running sizes along the top: from the end with the label (0) to each hole of a row along the top edge, and the far end
  const chainAlong=(values,top)=>{
    if(!values.length)return;
    const base=top?yTop-V.gap:yBottom+V.gap;
    line(Math.min(px(values[0]),px(values[values.length-1])),base,Math.max(px(values[0]),px(values[values.length-1])),base,'thin');
    let last=null;
    const ordered=values.map(value=>({value,x:px(value)})).sort((a,b)=>a.x-b.x);
    for(const{value,x}of ordered){
      const isEnd=Math.abs(value)<1e-6||Math.abs(value-r16(view.length))<1e-6;
      // the extension line: off the edge of the piece at an end, off the hole for a hole
      const marks=holeMarks.filter(mark=>Math.abs(r16(mark.entry.a)-value)<1e-6&&mark.entry.clamp===(top?'top':'bottom'));
      const from=isEnd&&!marks.length?(top?yTop-V.ext:yBottom+V.ext):top?Math.min(...marks.map(mark=>mark.box.y))-V.ext:Math.max(...marks.map(mark=>mark.box.y+mark.box.h))+V.ext;
      const to=top?base-V.extOver:base+V.extOver;
      line(x,from,x,to,'thin');
      if(Math.abs(value)<1e-6)out.items.push({type:'datum',x,y:base});
      else line(x-V.tick,base+V.tick,x+V.tick,base-V.tick,'tick');
      // the number, along its extension line, past the end of it; slid aside with a short leader when it would
      // run into the number before it
      const text=fmt(r16(value));
      const w=partTextWidth(text,V.number,true);
      let tx=x+5;
      if(last&&tx-V.number*.78<last+3)tx=last+3+V.number*.78;
      const ty=top?to-4:to+4;
      const entry=addText(text,tx,ty,V.number,{rotate:true,anchor:top?'start':'end',bold:true,role:'dim'});
      if(Math.abs(tx-(x+5))>.5)line(x,to,tx-5,top?ty-2:ty+2,'thin');
      last=entry.box.x+entry.box.w;
      out.dims.push({kind:'along',value,text,x,base,entry,view:index,top});
      void w;
    }
  };
  chainAlong(runTop,true);
  chainAlong(runBottom,false);
  // sizes down from the top edge, beside the end whose holes they place
  const ends=endChains(view);
  const chainAcross=(values,side)=>{
    if(!values.length)return;
    const right=side==='right',xb=right?x1+22:x0-22;
    const all=[0,...values];
    line(xb,py(0),xb,py(values[values.length-1]),'thin');
    let last=null;
    for(const value of all){
      const yy=py(value);
      const marks=holeMarks.filter(mark=>!mark.round&&Math.abs(r16(mark.entry.b)-value)<1e-6&&(mark.entry.clamp==='labelled'||mark.entry.clamp==='far')&&(right?mark.cx>(x0+x1)/2:mark.cx<(x0+x1)/2));
      const from=value===0?(right?x1+V.ext:x0-V.ext):right?Math.max(...marks.map(mark=>Math.max(mark.box.x+mark.box.w,mark.arrow[2])))+V.ext:Math.min(...marks.map(mark=>Math.min(mark.box.x,mark.arrow[2])))-V.ext;
      line(from,yy,right?xb+V.extOver:xb-V.extOver,yy,'thin');
      if(value===0)out.items.push({type:'datum',x:xb,y:yy});
      else line(xb-V.tick,yy+V.tick,xb+V.tick,yy-V.tick,'tick');
      const text=fmt(r16(value));
      let ty=yy+5;
      if(last!==null&&ty-V.number*.78<last+2)ty=last+2+V.number*.78;
      const entry=addText(text,right?xb+10:xb-10,ty,V.number,{anchor:right?'start':'end',bold:true,role:'dim'});
      if(Math.abs(ty-(yy+5))>.5)line(right?xb+V.extOver:xb-V.extOver,yy,right?xb+9:xb-9,ty-5,'thin');
      last=entry.box.y+entry.box.h;
      out.dims.push({kind:'across',value,text,y:yy,base:xb,entry,view:index,side});
    }
  };
  chainAcross(ends.left,'left');
  chainAcross(ends.right,'right');
  // the places of the holes a bit makes, their corners located first, then the holes from each corner
  const placed=layPlaces(out,view,index,{x0,x1,yTop,yBottom,px,py,scale,addText,line,holeMarks,ends,above:placesAbove,
    below:runBottom.length?numberLen(runBottom)+V.gap+14:0,letterOf:ctx.letterOf});
  // (a place whose piece is already drawn dashed for a moved pocket hole is named once)
  others.push(...placed.names.filter(name=>!others.some(other=>other.piece===name.place.other)));
  // the label, written in the corner with the small circle, its arrow to the top edge (on face 1 only: face 2 shows
  // where the end with the label is by its heavy line and small circle)
  // (an edge or an end view does not show the face the label is on: its title says where that face is)
  if(view.kind==='face1'||view.kind==='mirror')placeLabelBox(out,view,label,holeMarks,{x0,x1,yTop,yBottom});
  layViewNames(out,view,index,label,holeMarks,others,{x0,x1,yTop,yBottom,xDatum,addText,runBottom,numberLen,rows,extraBelow:placed.below});
  return{bottom:out.bottomOfView};
}
function placeLabelBox(out,view,label,holeMarks,{x0,x1,yTop,yBottom}){
  const V=PART_VIEW;
  const tag=`${(view.kind==='mirror'?label.mirrorLabel:label).name} ↑`;
  const tagW=partTextWidth(tag,V.label,true)+12,tagH=18;
  // in the corner when it is clear of the holes; else lower down the same end; else slid along the top edge
  const blocked=box=>holeMarks.some(mark=>boxesOverlap(box,mark.box,2)||boxesOverlap(box,arrowBox(mark),1));
  const cornerX=view.datumLeft?x0+4:x1-4-tagW;
  let tagBox=null;
  if(yBottom-yTop<tagH+8)tagBox={x:view.datumLeft?x0:x1-tagW,y:yBottom+6,w:tagW,h:tagH};
  for(let dy=4;!tagBox&&yTop+dy+tagH<=yBottom-3;dy+=2){
    const box={x:cornerX,y:yTop+dy,w:tagW,h:tagH};
    if(!blocked(box))tagBox=box;
  }
  // (then anywhere in the half of the piece nearer the end with the label, the place nearest the corner first: a
  //  panel with holes along all its edges, a deck with plugged screws near the corner)
  const tries=[];
  for(let along=0;along<(x1-x0)/2;along+=6)for(let dy=4;yTop+dy+tagH<=yBottom-3;dy+=4)tries.push({along,dy,far:Math.hypot(along,dy)});
  tries.sort((a,b)=>a.far-b.far);
  for(const one of tries){
    if(tagBox)break;
    const box={x:cornerX+(view.datumLeft?one.along:-one.along),y:yTop+one.dy,w:tagW,h:tagH};
    if(!blocked(box))tagBox=box;
  }
  // (no room among the holes: just under the piece at the end with the label, as for a thin piece)
  if(!tagBox)tagBox={x:view.datumLeft?x0:x1-tagW,y:yBottom+6,w:tagW,h:tagH};
  out.items.push({type:'labelbox',...tagBox});
  out.texts.push({text:tag,x:tagBox.x+tagW/2,y:tagBox.y+13.5,size:V.label,anchor:'middle',rotate:false,box:{...tagBox},cls:'labt',bold:true,role:'labelbox'});
}
/* the names of a view: the top edge (in the widest gap above the piece), and the row under the piece: the end with
   the label (with a leader), a tag for each row of the table, the pieces that sit here later */
function layNames(out,view,index,label,holeMarks,others,{x0,x1,yTop,yBottom,xDatum,addText,runBottom,numberLen,rows,extraBelow,tagsReversed},namesFirst,nameOrder){
  const V=PART_VIEW;
  let crossed=false;   // (a name had to take a place whose leader is not clear: layViewNames tries the other order)
  const xs=[x0,x1].concat(out.dims.filter(dim=>dim.view===index&&(dim.kind==='along'||dim.kind==='place'&&dim.axis==='along')&&dim.top).map(dim=>dim.x)).sort((a,b)=>a-b);
  let bestGap=null;
  for(let i=1;i<xs.length;i++)if(!bestGap||xs[i]-xs[i-1]>bestGap[1]-bestGap[0])bestGap=[xs[i-1],xs[i]];
  {
    // (clear of a hole drawn right at the top edge: a plug's flag, a countersink ring reach above it)
    const text=sidesOf(view).top,w=partTextWidth(text,V.label,false),x=(bestGap[0]+bestGap[1])/2;
    const under=holeMarks.filter(mark=>mark.box.x<x+w/2+2&&mark.box.x+mark.box.w>x-w/2-2).map(mark=>mark.box.y-3);
    addText(text,x,Math.min(yTop-7,...under),V.label,{anchor:'middle',cls:'lb',role:'name'});
  }
  // (extraBelow: the bands of the places, layPlaces, already take in the bottom row's band)
  const bottomBand=extraBelow||(runBottom.length?numberLen(runBottom)+V.gap+14:0);
  const rowY=yBottom+bottomBand+34,LINE=26;
  /* Each name goes as near its own x as it can on the first line under the piece where it fits clear of the names
     already there, else on the next line down. Returns {x, y} of its box. */
  const lines=[];
  // a leader is clear when it runs through no text, no tag already placed and no hole but its own target
  const tagBoxes=[],leaders=[],namesLaid=[];
  // (overHoles: a leader to a row along the far edge has to pass the holes of a row along the near edge: allowed on
  //  the second try, never through a text, a tag or another leader)
  const leaderClear=(from,to,target,overHoles)=>!out.texts.some(text=>segmentHitsRect(from,to,text.box,1))&&!tagBoxes.some(box=>segmentHitsRect(from,to,box,1))&&
    (overHoles||!holeMarks.some(mark=>mark!==target&&segmentHitsRect(from,to,mark.box,1)))&&!leaders.some(segment=>segmentsCross([from,to],segment));   // (segmentsCross: js/markingview.js)
  /* Each name goes on the first line under the piece where it fits clear of the names already there, as near its
     wanted x as it can, with its leader clear (leaderOf gives the leader for a place); else on the next line down. */
  const place=(wanted,width,leaderOf)=>{
    const lineTries=(line,withLeader)=>{
      if(!lines[line])lines[line]=[];
      const taken=lines[line],low=8,high=PART_VIEW.width-8-width,y=rowY+line*LINE;
      const free=x=>x>=low-1e-6&&x<=high+1e-6&&!taken.some(box=>x<box.x+box.w+14&&x+width>box.x-14);
      const tries=[];
      for(const desired of wanted){
        const start=Math.max(low,Math.min(high,desired.x));
        for(const x of[start].concat(taken.flatMap(box=>[box.x+box.w+14,box.x-width-14])))if(free(x))tries.push({x,y,target:desired,distance:Math.abs(x-start)});
      }
      tries.sort((a,b)=>a.distance-b.distance);
      const pick=tries.find(t=>{if(!withLeader)return true;const[from,to]=leaderOf(t);return leaderClear(from,to,t.target.mark,withLeader==='overHoles');});
      if(pick)taken.push({x:pick.x,w:width});
      return pick;
    };
    for(let line=0;line<8;line++){const pick=lineTries(line,true);if(pick)return pick;}
    for(let line=0;line<8;line++){const pick=lineTries(line,'overHoles');if(pick)return pick;}
    // no place with a clear leader: the first line that has room (the self-check reports what the leader crosses)
    crossed=true;
    for(let line=0;line<12;line++){const pick=lineTries(line,false);if(pick)return pick;}
    // (a name wider than the paper: at the left, on a line of its own)
    lines.push([{x:8,w:width}]);
    return{x:8,y:rowY+(lines.length-1)*LINE,target:wanted[0]};
  };
  // the end with the label: its leader ends on the end, at the corner under it or halfway up it
  {
    const text=sidesOf(view).start,w=partTextWidth(text,V.label,false);
    // (from the middle of the name: from its nearest point the leader may run straight up the extension line of the 0)
    const leaderOf=t=>[[t.target.middle?t.x+w/2:Math.max(t.x,Math.min(t.x+w,t.target.end[0])),t.y-10],t.target.end];
    const wanted=[];
    for(const middle of[false,true])for(const end of[[xDatum,yBottom],[xDatum,(yTop+yBottom)/2]])for(const out of[.6,1.1,1.5,2]){
      wanted.push({x:view.datumLeft?x0-w*out:x1-w*(1-out),end,middle});
    }
    const at=place(wanted,w,leaderOf);
    addText(text,at.x,at.y+4,V.label,{cls:'lb',role:'name'});
    const[from,to]=leaderOf(at);
    out.items.push({type:'leader',x1:from[0],y1:from[1],x2:to[0],y2:to[1],dot:true,ink:true});
    leaders.push([from,to]);
    tagBoxes.push({x:at.x,y:at.y-10,w,h:14});
  }
  // the tags of the rows and the names of the pieces that sit here later, in the order asked (namesFirst: the
  // names first, when the tags laid first leave a name no clear leader, layViewNames)
  if(namesFirst){layDashedNames();layTags();}
  else{layTags();layDashedNames();}
  const lastLine=lines.reduce((last,line,index)=>line.length?index:last,0);
  out.bottomOfView=rowY+lastLine*LINE+14;
  return{crossed};

  // a tag for each row of the table, tied to one of its holes (the one nearest the end with the label first)
  function layTags(){
  const tags=[];
  // (the holes a bit makes carry no tag on the picture: their shape says the kind (the legend), and the table gives
  //  each place its row with the bit and the depth; tags with leaders up through the sizes of the places would
  //  cross them)
  for(const row of tagsReversed?rows.slice().reverse():rows){
    const marks=holeMarks.filter(mark=>row.holes.includes(mark.entry)).sort((a,b)=>a.entry.a-b.entry.a);
    // (a row along the top edge of a piece that has a row along the bottom edge too: its leader crosses the piece,
    //  so it is tied to the hole nearest the middle, clear of what lies near the ends)
    if(row.kind==='top'&&rows.some(other=>other.kind==='bottom'))marks.sort((a,b)=>Math.abs(a.cx-(x0+x1)/2)-Math.abs(b.cx-(x0+x1)/2));
    const words=rowCountWords(row);
    const w=2*V.hexR+8+partTextWidth(words,V.label,false);
    const wanted=marks.flatMap(mark=>[{x:mark.cx+6,mark},{x:mark.cx-w-6,mark},{x:mark.cx+30,mark},{x:mark.cx+70,mark},{x:mark.cx-w-50,mark}]);
    const leaderOf=t=>[[t.x+V.hexR,t.y-V.hexR+1],[t.target.mark.cx,t.target.mark.box.y+t.target.mark.box.h+1]];
    const at=place(wanted,w,leaderOf);
    const leader=leaderOf(at);
    leaders.push(leader);
    const tagBox={x:at.x,y:at.y-V.hexR,w:2*V.hexR,h:2*V.hexR};
    tagBoxes.push(tagBox);
    tags.push({row,words,w,at,leaderOf,leader,tagBox});
  }
  // two tags of the same width whose leaders cross (a row along the top edge and one along the bottom, tied to holes
  // one above the other) change places, so each leader runs to its own hole without crossing the other
  // (of other widths too, when each fits in the other's place on its line: the end tag "× 2, at the end with the
  //  label" and a "× 1" of a row, tied to holes side by side)
  const fitsOnLine=(at,w,skip)=>{
    const line=lines[Math.round((at.y-rowY)/LINE)]||[];
    return at.x>=8&&at.x+w<=PART_VIEW.width-8&&!line.some(box=>!skip.includes(box)&&at.x<box.x+box.w+14&&at.x+w>box.x-14);
  };
  const slotOf=tag=>(lines[Math.round((tag.at.y-rowY)/LINE)]||[]).find(box=>Math.abs(box.x-tag.at.x)<.5&&Math.abs(box.w-tag.w)<.5);
  for(let i=0;i<tags.length;i++)for(let j=i+1;j<tags.length;j++){
    const a=tags[i],b=tags[j];
    if(!segmentsCross(a.leader,b.leader))continue;
    const slotA=slotOf(a),slotB=slotOf(b);
    let atA={...a.at,x:Math.min(b.at.x,PART_VIEW.width-8-a.w),y:b.at.y},atB={...b.at,x:Math.min(a.at.x,PART_VIEW.width-8-b.w),y:a.at.y};
    // (on one line: their order swapped, side by side from where the left one began)
    if(Math.abs(a.at.y-b.at.y)<1){
      const[left,right]=a.at.x<b.at.x?[a,b]:[b,a];
      const rightAt={...right.at,x:left.at.x},leftAt={...left.at,x:left.at.x+right.w+14};
      [atA,atB]=a===left?[leftAt,rightAt]:[rightAt,leftAt];
    }
    const apart=Math.abs(atA.y-atB.y)>1||atA.x+a.w+14<=atB.x||atB.x+b.w+14<=atA.x;
    if(Math.abs(a.w-b.w)>.5&&(!slotA||!slotB||!apart||!fitsOnLine(atA,a.w,[slotA,slotB])||!fitsOnLine(atB,b.w,[slotA,slotB])))continue;
    const leaderA=a.leaderOf(atA),leaderB=b.leaderOf(atB);
    if(segmentsCross(leaderA,leaderB))continue;
    // (the line slots follow: a's old slot now holds b, b's old slot holds a)
    if(slotA&&slotB){slotA.x=atB.x;slotA.w=b.w;slotB.x=atA.x;slotB.w=a.w;}
    a.leader.splice(0,2,...leaderA);b.leader.splice(0,2,...leaderB);   // (the same arrays are in `leaders`)
    [a.at,b.at]=[atA,atB];
    [a.tagBox.x,a.tagBox.y,b.tagBox.x,b.tagBox.y]=[atA.x,atA.y-V.hexR,atB.x,atB.y-V.hexR];
  }
  for(const tag of tags){
    const{at,leader:[from,to],row,words}=tag;
    out.items.push({type:'hex',cx:at.x+V.hexR,cy:at.y,no:row.setup});
    out.items.push({type:'leader',x1:from[0],y1:from[1],x2:to[0],y2:to[1],dot:false});
    addText(words,at.x+2*V.hexR+6,at.y+4.5,V.label,{cls:'lb',role:'tag'});
    out.items.push({type:'hexno',x:at.x+V.hexR,y:at.y+4,no:row.setup});
  }
  }
  // the pieces that sit here later: one name for pieces of one name, with a leader to the bottom edge under each
  function layDashedNames(){
  const byName=new Map();
  for(const other of others){
    const text=other.text||`${other.name} sits here${other.step?`, step ${other.step}`:''}`;
    if(!byName.has(text))byName.set(text,[]);
    byName.get(text).push(other);
  }
  // (several of one name: one leader, to one of them; the note under the drawing gives each place)
  // (nameOrder: the names left to right, or right to left, by where their pieces are: layViewNames tries both when
  //  the order given leaves a leader no clear way)
  const entries=[...byName];
  const xOf=list=>(list[0].px[0]+list[0].px[1])/2;
  if(nameOrder==='asc')entries.sort((a,b)=>xOf(a[1])-xOf(b[1]));
  if(nameOrder==='desc')entries.sort((a,b)=>xOf(b[1])-xOf(a[1]));
  // (more than three: each by its name alone, "Top rail (E), 2 places": the legend says what a dashed piece is, and
  //  shorter names leave their leaders room)
  const short=entries.length>3;
  for(const[text,list]of entries){
    const base=text.replace(/ sits here.*$/,'');
    const many=short?(list.length>1?`${base}, ${list.length} places`:base):list.length>1?text.replace(/ sits here/,` sits at the dashed places (${list.length})`):text;
    const w=partTextWidth(many,V.label,false);
    // (the leader ends on the bottom edge of the dashed piece, which is the bottom edge of this one when it runs
    //  across; along a long piece several places on that edge are tried, so the leader can cross no other)
    //  (a dashed piece that runs across the whole width: its leader may also end inside it, partway up)
    const wanted=list.flatMap(other=>[.5,.8,.2,.65,.35,.95,.05].flatMap(f=>{
      const end=[other.px[0]+(other.px[1]-other.px[0])*f,other.py[1]];
      return[{x:end[0]+8,end},{x:end[0]-w-8,end},{x:end[0]-w/2,end},{x:end[0]+60,end},{x:end[0]-w-60,end}];
    }).concat([.5,.3,.7].flatMap(f=>{
      // (inside the dashed piece, partway up: any dashed piece, when no leader to its bottom edge is clear)
      return[.5,.25,.75].flatMap(g=>{
        const end=[other.px[0]+(other.px[1]-other.px[0])*g,other.py[0]+(other.py[1]-other.py[0])*f];
        return[{x:end[0]+30,end},{x:end[0]+90,end},{x:end[0]-w-30,end},{x:end[0]-w-90,end}];
      });
    })));
    const leaderOf=t=>[[Math.max(t.x+4,Math.min(t.x+w-4,t.target.end[0])),t.y-9],t.target.end];
    const at=place(wanted,w,leaderOf);
    const entry=addText(many,at.x,at.y+4.5,V.label,{cls:'lb',role:'name'});
    const[from,to]=leaderOf(at);
    const item={type:'leader',x1:from[0],y1:from[1],x2:to[0],y2:to[1],dot:true,ink:true};
    out.items.push(item);
    const segment=[from,to];
    leaders.push(segment);
    namesLaid.push({entry,item,segment,w,at,leaderOf});
  }
  untangleNames();
  }
  /* Two names whose leaders cross change places when both fit in the other's place (two leaders that cross no
     longer do once their names swap); then whether any leader still crosses another or runs through a text. */
  function untangleNames(){
    const box=(x,y,w)=>({x,y:y+4.5-V.label*.78,w,h:V.label});
    const clearOfTexts=(b,skip)=>!out.texts.some(text=>!skip.includes(text)&&boxesOverlap(b,text.box,4));
    for(let pass=0;pass<3;pass++){
      let swapped=false;
      for(let i=0;i<namesLaid.length;i++)for(let j=i+1;j<namesLaid.length;j++){
        const a=namesLaid[i],b=namesLaid[j];
        if(!segmentsCross(a.segment,b.segment))continue;
        // (each kept on the paper: a long name in a short name's place slides left as far as it must)
        const atA={...a.at,x:Math.min(b.at.x,PART_VIEW.width-8-a.w),y:b.at.y},atB={...b.at,x:Math.min(a.at.x,PART_VIEW.width-8-b.w),y:a.at.y};
        const boxA=box(atA.x,atA.y,a.w),boxB=box(atB.x,atB.y,b.w),skip=[a.entry,b.entry];
        if(boxA.x+boxA.w>PART_VIEW.width-4||boxB.x+boxB.w>PART_VIEW.width-4||boxesOverlap(boxA,boxB,4)||!clearOfTexts(boxA,skip)||!clearOfTexts(boxB,skip))continue;
        const segA=a.leaderOf(atA),segB=b.leaderOf(atB);
        if(segmentsCross(segA,segB))continue;
        for(const[one,at,seg,b2]of[[a,atA,segA,boxA],[b,atB,segB,boxB]]){
          one.at=at;one.entry.x=at.x;one.entry.y=at.y+4.5;one.entry.box=b2;
          one.segment.splice(0,2,...seg);
          Object.assign(one.item,{x1:seg[0][0],y1:seg[0][1],x2:seg[1][0],y2:seg[1][1]});
        }
        swapped=true;
      }
      if(!swapped)break;
    }
    // (what is left decides whether layViewNames tries another order: a leader that crosses another, or runs
    //  through a text other than its own, as partLayoutProblems judges it)
    const own=(segment,b)=>segment[0][0]>=b.x-16&&segment[0][0]<=b.x+b.w+16&&segment[0][1]>=b.y-16&&segment[0][1]<=b.y+b.h+16;
    crossed=leaders.some((one,i)=>leaders.some((other,j)=>j>i&&segmentsCross(one,other)))||
      leaders.some(segment=>out.texts.some(text=>!own(segment,text.box)&&segmentHitsRect(segment[0],segment[1],text.box,0)));
  }
}
/* The names of a view (layNames), laid a second time with the names of the pieces that sit here later before the
   tags when the first time left a leader no clear way (it would cross another leader or run through a text): in a
   mirror image the tag at the end with the label can shut in a dashed piece at that end. The first layout is kept
   unless the second is clear. */
function layViewNames(out,view,index,label,holeMarks,others,ctx){
  const textsBefore=out.texts.length,itemsBefore=out.items.length;
  const first=layNames(out,view,index,label,holeMarks,others,ctx,false);
  if(!first.crossed)return;
  const kept={texts:out.texts.splice(textsBefore),items:out.items.splice(itemsBefore),bottom:out.bottomOfView};
  // (then the names before the tags, and the names left to right or right to left by where their pieces are, so
  //  leaders to pieces side by side do not cross; then the tags laid in the other order (a row along the top edge
  //  over a row along the bottom edge): the first clear one is kept)
  const tries=others.length?[[true,''],[false,'asc'],[true,'asc'],[false,'desc'],[true,'desc'],[false,'',true],[true,'',true]]:[[false,'',true]];
  for(const[namesFirst,order,tagsReversed]of tries){
    const again=layNames(out,view,index,label,holeMarks,others,{...ctx,tagsReversed},namesFirst,order);
    if(!again.crossed)return;
    out.texts.splice(textsBefore);out.items.splice(itemsBefore);
  }
  out.texts.push(...kept.texts);out.items.push(...kept.items);out.bottomOfView=kept.bottom;
}
// (a round hole a bit makes has no arrow: its own box)
const arrowBox=mark=>!mark.arrow?mark.box:({x:Math.min(mark.arrow[0],mark.arrow[2])-3,y:Math.min(mark.arrow[1],mark.arrow[3])-3,w:Math.abs(mark.arrow[2]-mark.arrow[0])+6,h:Math.abs(mark.arrow[3]-mark.arrow[1])+6});
/* the count words of the tag of one row of the table: '× 4, 2 at each end', '× 7' */
function rowCountWords(row){
  let words=`× ${row.holes.length}`;
  if(row.kind==='end'){
    const atLabel=row.holes.filter(entry=>entry.clamp==='labelled').length,atFar=row.holes.length-atLabel;
    if(atLabel&&atFar&&atLabel===atFar)words+=`, ${atLabel} at each end`;
    else if(atLabel&&atFar)words+=`, ${atLabel} at the end with the label, ${atFar} at the far end`;
    else words+=atLabel?', at the end with the label':', at the far end';
  }
  return words;
}
/* the pieces that sit on this face later where they moved a hole (rule 10, f.clear): their stretch along the piece */
function dashedPieces(view,ctx){
  const names=new Set(view.holes.flatMap(entry=>entry.hole.clear||[]));
  if(!names.size)return[];
  const piece=view.piece,b=plainBox(piece),frame=view.frame,found=[];
  const n=frame.n,axis=mainAxis(n),face=n[axis]>0?b.hi[axis]:b.lo[axis];
  for(const link of connectionsOf(piece.id)){
    const other=link.a===piece?link.b:link.a;
    if(!names.has(other.name)||isProp(other)||found.some(entry=>entry.piece===other))continue;
    const o=plainBox(other),against=n[axis]>0?Math.abs(o.lo[axis]-face)<.03:Math.abs(o.hi[axis]-face)<.03;
    if(!against)continue;
    // its stretch along the piece (from the end with the label) and across it (down from the top edge)
    const corner1=benchPoint(frame,o.lo),corner2=benchPoint(frame,o.hi);
    const lo=Math.max(0,Math.min(corner1.a,corner2.a)),hi=Math.min(view.length,Math.max(corner1.a,corner2.a));
    const top=Math.max(0,Math.min(corner1.b,corner2.b)),bottom=Math.min(view.height,Math.max(corner1.b,corner2.b));
    if(hi-lo<.05||bottom-top<.05)continue;
    const index=ctx.stepOfPiece?ctx.stepOfPiece.get(other.id):undefined;
    found.push({piece:other,name:pieceLabel(other,ctx.letterOf||(()=>'')),from:lo,to:hi,top,bottom,
      // (a piece that runs the whole length is placed by its edges, one that runs the whole width by its ends)
      wholeLength:lo<DRILL_SAME&&hi>view.length-DRILL_SAME,wholeWidth:top<DRILL_SAME&&bottom>view.height-DRILL_SAME,
      step:index===undefined?0:index+1});
  }
  return found;
}
/* the legend under a drawing */
function legendEntries(label,layout){
  const list=[],entries=label.views.flatMap(view=>view.holes),holes=entries.map(entry=>entry.hole);
  const pockets=entries.filter(entry=>entry.clamp!=='face');
  if(pockets.length)list.push({kind:'pocket',text:'pocket hole: the arrow points to where the jig goes'});
  const jigTags=[...new Set(pockets.map(entry=>entry.setup))].sort((a,b)=>a-b);
  if(jigTags.length)list.push({kind:'hex',tag:jigTags[0],tags:jigTags,text:''});
  // the holes a bit makes (spec 11, section 2): one sign each
  if(holes.some(hole=>hole.kind==='clear'&&hole.countersink))list.push({kind:'clear',text:`a screw goes through: ${DRILL_BITS.clearance.name} right through, the ring a countersink on this face`});
  if(holes.some(hole=>hole.kind==='clear'&&hole.sunk>0))list.push({kind:'bore',text:`a sunk head: a ${DRILL_BITS.counterbore.name} counterbore, then ${DRILL_BITS.clearance.name} through its middle`});
  if(holes.some(hole=>hole.plug))list.push({kind:'flag',text:'flag: a wooden plug covers this head'});
  if(holes.some(hole=>hole.kind==='pilot'))list.push({kind:'pilot',text:'pilot hole: a screw goes into it, as deep as the table says'});
  if(holes.some(hole=>hole.kind==='dowel'))list.push({kind:'dowel',text:'dowel hole, as deep as the table says'});
  list.push({kind:'datum',text:'sizes run from the small circle (0); the label box shows where to write the label, its arrow to the top edge'});
  if(holes.some(hole=>hole.place))list.push({kind:'corner',text:'corner mark: the corner of a place where another piece touches; the sizes of its holes run from it, the same on both drawings'});
  if(layout.items.some(item=>item.type==='rect'&&item.cls==='hid'))list.push({kind:'hidden',text:'dashed: a piece that sits here later'});
  if(pockets.some(entry=>entry.plugged))list.push({kind:'plug',text:'a bar across: plug this hole once its screw is in'});
  return list;
}

/* ---------- the SVG ---------- */
/* one hole a bit makes (roundMark): the circle of the bit, a ring for a countersink, the 11/64" hole inside a
   counterbore (the counterbore lightly filled), a center cross on a pilot or a dowel hole, a flag for a plug */
function roundMarkSvg(mark){
  const a=v=>Math.round(v*10)/10,{cx,cy,r}=mark,parts=[];
  if(mark.ring)parts.push(`<circle class="pd-hole" cx="${a(cx)}" cy="${a(cy)}" r="${a(mark.ring)}"/>`);
  parts.push(`<circle class="${mark.inner?'pd-bore':'pd-hole'}" cx="${a(cx)}" cy="${a(cy)}" r="${a(r)}"/>`);
  if(mark.inner)parts.push(`<circle class="pd-hole" cx="${a(cx)}" cy="${a(cy)}" r="${a(mark.inner)}"/>`);
  if(mark.kind==='pilot'||mark.kind==='dowel'){
    const c=r+3;
    parts.push(`<path class="pd-cx" d="M${a(cx-c)} ${a(cy)}h${a(2*c)}M${a(cx)} ${a(cy-c)}v${a(2*c)}"/>`);
  }
  if(mark.flag){
    const[fx,fy,tx,ty]=mark.flag;
    parts.push(`<path class="pd-flag" d="M${a(fx)} ${a(fy)}L${a(tx)} ${a(ty)}l6 1.5l-4.5 3.5"/>`);
  }
  return parts.join('');
}
let partSvgNext=0;
function partDrawingSvg(layout){
  const id=`pd${++partSvgNext}`,V=PART_VIEW,hole=PART_HOLE();
  const parts=[];
  const attr=v=>Number.isFinite(v)?Math.round(v*10)/10:0;
  parts.push(`<defs><marker id="${id}a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${hole}"/></marker></defs>`);
  const hexPoints=(cx,cy,r)=>[0,1,2,3,4,5].map(i=>{const a=Math.PI/3*i;return`${attr(cx+r*Math.cos(a))},${attr(cy+r*.95*Math.sin(a))}`;}).join(' ');
  // wood first, then the dashed pieces, the lines, the holes, the texts
  for(const item of layout.items.filter(item=>item.type==='rect'&&item.cls==='wood'))parts.push(`<rect class="pd-wood" x="${attr(item.x)}" y="${attr(item.y)}" width="${attr(item.w)}" height="${attr(item.h)}"/>`);
  for(const item of layout.items){
    switch(item.type){
      case'rect':if(item.cls==='hid')parts.push(`<rect class="pd-hid" x="${attr(item.x)}" y="${attr(item.y)}" width="${attr(item.w)}" height="${attr(item.h)}"/>`);break;
      case'line':parts.push(`<line class="pd-${item.cls}" x1="${attr(item.x1)}" y1="${attr(item.y1)}" x2="${attr(item.x2)}" y2="${attr(item.y2)}"/>`);break;
      case'datum':parts.push(`<circle class="pd-dat" cx="${attr(item.x)}" cy="${attr(item.y)}" r="${V.datumR}"/>`);break;
      case'corner':parts.push(`<circle class="pd-dat" cx="${attr(item.x)}" cy="${attr(item.y)}" r="${V.datumR}"/><path class="pd-heavy" d="M${attr(item.x+item.dx*12)} ${attr(item.y)}H${attr(item.x)}V${attr(item.y+item.dy*12)}"/>`);break;
      case'leader':parts.push(`<line class="${item.ink?'pd-ldk':'pd-ld'}" x1="${attr(item.x1)}" y1="${attr(item.y1)}" x2="${attr(item.x2)}" y2="${attr(item.y2)}"/>`+(item.dot?`<circle cx="${attr(item.x2)}" cy="${attr(item.y2)}" r="2.2" fill="${PART_INK}"/>`:''));break;
      case'hex':parts.push(`<polygon class="pd-hex" points="${hexPoints(item.cx,item.cy,V.hexR)}"/>`);break;
      case'hexno':parts.push(`<text class="pd-hexn" x="${attr(item.x)}" y="${attr(item.y)}">${item.no}</text>`);break;
      case'labelbox':parts.push(`<rect class="pd-lab" x="${attr(item.x)}" y="${attr(item.y)}" width="${attr(item.w)}" height="${attr(item.h)}" rx="2"/>`);break;
      case'legend':{
        const x=item.x,y=item.y;
        if(item.kind==='pocket')parts.push(`<ellipse class="pd-hole" cx="${x+20}" cy="${y}" rx="11" ry="3.5"/><line class="pd-arr" marker-end="url(#${id}a)" x1="${x+7}" y1="${y}" x2="${x}" y2="${y}"/>`);
        if(item.kind==='hex')parts.push(`<polygon class="pd-hex" points="${hexPoints(x+16,y,9)}"/><text class="pd-hexn" x="${x+16}" y="${y+4}">${item.tag}</text>`);
        if(item.kind==='datum')parts.push(`<circle class="pd-dat" cx="${x+16}" cy="${y}" r="${V.datumR}"/>`);
        if(item.kind==='hidden')parts.push(`<rect class="pd-hid" x="${x+4}" y="${y-6}" width="24" height="12"/>`);
        if(item.kind==='plug')parts.push(`<ellipse class="pd-hole" cx="${x+16}" cy="${y}" rx="11" ry="3.5"/><line class="pd-cx" x1="${x+16}" y1="${y-7}" x2="${x+16}" y2="${y+7}"/>`);
        if(item.kind==='clear')parts.push(roundMarkSvg({kind:'clear',cx:x+16,cy:y,r:3.5,ring:6.5,inner:0}));
        if(item.kind==='bore')parts.push(roundMarkSvg({kind:'clear',cx:x+16,cy:y,r:7,ring:0,inner:3}));
        if(item.kind==='flag')parts.push(roundMarkSvg({kind:'clear',cx:x+12,cy:y+2,r:4,ring:0,inner:0,flag:[x+15,y-1,x+20,y-10]}));
        if(item.kind==='pilot')parts.push(roundMarkSvg({kind:'pilot',cx:x+16,cy:y,r:3,ring:0,inner:0}));
        if(item.kind==='dowel')parts.push(roundMarkSvg({kind:'dowel',cx:x+16,cy:y,r:6,ring:0,inner:0}));
        if(item.kind==='corner')parts.push(`<circle class="pd-dat" cx="${x+10}" cy="${y-3}" r="${V.datumR}"/><path class="pd-heavy" d="M${x+22} ${y-3}H${x+10}V${y+8}"/>`);
        break;
      }
    }
  }
  for(const mark of layout.holes){
    if(mark.round){parts.push(roundMarkSvg(mark));continue;}
    parts.push(`<ellipse class="pd-hole" cx="${attr(mark.cx)}" cy="${attr(mark.cy)}" rx="${attr(mark.rx)}" ry="${attr(mark.ry)}" transform="rotate(${attr(mark.angle)} ${attr(mark.cx)} ${attr(mark.cy)})"/>`);
    parts.push(`<path class="pd-cx" d="M${attr(mark.cx-4)} ${attr(mark.cy)}h8M${attr(mark.cx)} ${attr(mark.cy-4)}v8"/>`);
    parts.push(`<line class="pd-arr" marker-end="url(#${id}a)" x1="${attr(mark.arrow[0])}" y1="${attr(mark.arrow[1])}" x2="${attr(mark.arrow[2])}" y2="${attr(mark.arrow[3])}"/>`);
    if(mark.plugged){
      const px=-mark.uy,py=mark.ux,r=mark.ry+4;
      parts.push(`<line class="pd-plug" x1="${attr(mark.cx-px*r)}" y1="${attr(mark.cy-py*r)}" x2="${attr(mark.cx+px*r)}" y2="${attr(mark.cy+py*r)}"/>`);
    }
  }
  for(const text of layout.texts){
    const anchor=text.anchor==='start'?'':` text-anchor="${text.anchor}"`;
    const at=text.rotate?` transform="translate(${attr(text.x)},${attr(text.y)}) rotate(-90)"`:` x="${attr(text.x)}" y="${attr(text.y)}"`;
    parts.push(`<text class="pd-${text.cls}"${anchor}${at}${text.bold?' font-weight="600"':''}>${esc(text.text)}</text>`);
  }
  if(layout.legendOnly)return`<svg class="pd legend" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="What the signs on the drawings mean">${parts.join('')}</svg>`;
  const name=layout.label.way.sample.name;
  return`<svg class="pd" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Where to drill the ${esc(name)} (${esc(layout.label.name)})">${parts.join('')}</svg>`;
}

/* ---------- the hole table and the notes of one drawing (spec 11, 1.2) ---------- */
// (round: the tag of a bit, a circle; else of a setting of the pocket-hole jig, a hexagon)
const tagSvg=(no,round)=>`<svg class="tag" viewBox="0 0 22 20" role="img" aria-label="${round?'bit':'setting'} ${no}">${round?'<circle cx="11" cy="10" r="9"/>':'<polygon points="21,10 16,19 6,19 1,10 6,1 16,1"/>'}<text x="11" y="14">${no}</text></svg>`;
/* '1-1/4"' from '1-1/4" pocket-hole screw' */
const screwSize=label=>String(label).replace(/ pocket-hole screws?$/,'');
/* the step and the piece the screws of these holes go into: 'Step 4: 2-1/2" pocket-hole screws into the Leg (D)' */
/* holes: every piece's holes of one row of the table (holesOfEveryPiece): the pieces of one label can go in at
   different steps and into different pieces, and each is said ('Steps 4, 6 and 7: ... into the Side (B)'). */
function laterWords(holes,letterOf){
  // the screws of each step, then the steps whose screws go the same way into the same pieces on one line
  const byStep=new Map();
  for(const entry of holes){
    const hole=entry.hole||entry,size=screwSize(hole.screw),way=hole.dir[1]>.5?'up into':hole.dir[1]<-.5?'down into':'into';
    const key=`${hole.step}|${size}|${way}`;
    if(!byStep.has(key))byStep.set(key,{step:hole.step,size,way,into:new Set()});
    byStep.get(key).into.add(pieceLabel(hole.f.into,letterOf));
  }
  const lines=new Map();
  for(const row of[...byStep.values()].sort((a,b)=>a.step-b.step)){
    const into=listWords([...row.into].sort()),key=`${row.size}|${row.way}|${into}`;
    if(!lines.has(key))lines.set(key,{steps:[],size:row.size,way:row.way,into});
    lines.get(key).steps.push(row.step||'?');
  }
  return[...lines.values()].map((line,index)=>{
    const steps=line.steps.length>1?`${index?'steps':'Steps'} ${listWords(line.steps.map(String))}`:`${index?'step':'Step'} ${line.steps[0]}`;
    return`${steps}: ${line.size} pocket-hole screws ${line.way} the ${line.into}`;
  }).join('; ');
}
const average=list=>list.reduce((sum,v)=>sum+v,0)/(list.length||1);
const sizesWords=values=>listWords([...new Set(values.map(v=>r16(v)))].sort((a,b)=>a-b).map(v=>fmt(v)));
function holeTableRows(label,plan){
  const drill=plan.drill,views=label.views.filter(view=>view.kind!=='mirror'),two=views.length>1;
  const rows=[],everyPiece=holesOfEveryPiece(label,drill);
  const holesOfRow=row=>row.holes.flatMap(entry=>everyPiece.get(entry)||[entry.hole]);
  views.forEach((view,index)=>{
    for(const row of viewRows(view)){
      const setup=drill.setups.find(one=>one.no===row.setup);
      const against=row.kind==='end'?'the end':row.kind==='top'?'the top edge':'the bottom edge';
      let many=String(row.holes.length);
      const onFace=two?`, on face ${index+1}`:'';
      let where;
      if(row.kind==='end'){
        const atLabel=row.holes.filter(entry=>entry.clamp==='labelled'),atFar=row.holes.filter(entry=>entry.clamp==='far');
        const each=atLabel.length&&atFar.length&&atLabel.length===atFar.length;
        many+=onFace+(each?`: ${atLabel.length} at each end`:atLabel.length&&atFar.length?`: ${atLabel.length} at the end with the label, ${atFar.length} at the far end`:atLabel.length?': at the end with the label':': at the far end');
        const sameAcross=sizesWords(atLabel.map(entry=>entry.b))===sizesWords(atFar.map(entry=>entry.b));
        const across=!atLabel.length||!atFar.length||sameAcross?`${sizesWords(row.holes.map(entry=>entry.b))} down from the top edge.`
          :`At the end with the label ${sizesWords(atLabel.map(entry=>entry.b))} down from the top edge; at the far end ${sizesWords(atFar.map(entry=>entry.b))}.`;
        const fromEnd=average(row.holes.map(entry=>entry.clamp==='labelled'?entry.a:view.length-entry.a));
        where=`${across} (The jig puts them about ${fmt(r16(fromEnd))} in from the end.)`;
      }else{
        many+=onFace;
        const alongs=sizesWords(row.holes.map(entry=>entry.a));
        const set=row.kind==='top'?average(row.holes.map(entry=>entry.b)):average(row.holes.map(entry=>view.height-entry.b));
        where=`${alongs} from ${label.symmetric?'either end':'the end with the label'}. (The jig puts them about ${fmt(r16(set))} ${row.kind==='top'?'down from the top edge':'up from the bottom edge'}.)`;
      }
      rows.push({tag:row.setup,setting:`${settingWords(setup)}, clamped against ${against}`,many,where,later:laterWords(holesOfRow(row),plan.letterOf),laterHoles:holesOfRow(row),row,view});
    }
    // the holes a bit makes: one row per place and bit (and depth), measured from the corner of the place; places
    // where pieces of one label sit with the same holes, measured the same way (the four legs under a top), share
    // one row, each place pencilled on in turn
    const merged=new Map();
    for(const place of viewPlaces(view)){
      const groups=new Map();
      for(const offset of place.offsets){
        const key=offset.entry.key;
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(offset);
      }
      for(const offsets of groups.values()){
        const entries=offsets.map(offset=>offset.entry),setup=drill.setups.find(one=>one.no===entries[0].setup);
        const said=placeHoleWords(place,offsets,view);
        const key=[setup.no,entries[0].key,pieceLabel(place.other,plan.letterOf),place.dashed,said.corner,said.holes].join('|');
        if(!merged.has(key))merged.set(key,{setup,places:[],entries:[],said});
        const row=merged.get(key);
        row.places.push(place);
        row.entries.push(...entries);
        if(said.pencil){row.said.pencils=(row.said.pencils||[]).concat([said.pencil]);row.said.parts=(row.said.parts||[]).concat([said.pencilParts]);}
      }
    }
    for(const{setup,places,entries,said}of merged.values()){
      const row={setup:setup.no,kind:'bit',holes:entries};
      const each=places.length>1?`, ${entries.length/places.length} at each of ${places.length} places`:'';
      rows.push({tag:setup.no,round:true,setting:bitRowWords(setup,entries[0].hole),many:String(entries.length)+each+(two?`, on ${/^face/.test(viewShortName(view))?'':'the '}${viewShortName(view)}`:''),
        where:placeWhereWords(places,said,plan.letterOf),later:roundLaterWords(holesOfRow(row),drill,plan.letterOf),laterHoles:holesOfRow(row),row,view,place:places[0],places});
    }
  });
  return rows;
}
/* the short name of a view, for the How many column of a drawing of several views */
function viewShortName(view){
  return{face1:'face 1',face2:'face 2',topedge:'top edge',bottomedge:'bottom edge',labelend:'end with the label',farend:'far end',mirror:'mirror image'}[view.kind]||'face';
}
/* the bit of a row of holes a bit makes, with how deep (spec 11, section 2) */
function bitRowWords(setup,hole){
  const deep=value=>`${fmt(r16(value))} deep`;
  if(hole.kind==='clear'&&hole.sunk>0)return`${DRILL_BITS.counterbore.name} ${deep(hole.sunk)} (a counterbore), then ${DRILL_BITS.clearance.name} right through its middle`;
  if(hole.kind==='clear')return`${DRILL_BITS.clearance.name} right through, then the ${DRILL_BITS.countersink.name} on this face`;
  if(hole.kind==='pilot')return`${DRILL_BITS[pilotBitKey()].name}, ${deep(hole.depth)}`;
  return`${fmt(hole.dia)} bit in a dowel jig, ${deep(hole.depth)}`;
}
/* Where the holes of one place are (spec 11, 4.4): a place that is not the whole face is pencilled on first, from the
   start and the top of the view; then every hole from the corner with the small circle, the way the picture runs
   from it ("2", 9 1/2" and 17" to the right, 3/4" down"). The other drawing gives the same numbers. */
/* The words of one place's holes, in parts: {holes: from the corner ("2", 9 1/2" and 17" to the right, 3/4" down"),
   corner: which corner, in words, pencil: where to pencil a dashed place on (from the start and the top of the view)} */
function placeHoleWords(place,offsets,view){
  const sides=sidesOf(view),L=view.length,H=view.height;
  const right=(place.far.a>=place.corner.a)===view.datumLeft?'to the right':'to the left';
  const down=place.far.b>=place.corner.b?'down':'up';
  const hs=offsets.map(o=>r16(o.h)),vs=offsets.map(o=>r16(o.v));
  const one=list=>new Set(list).size===1;
  const listOf=list=>sizesWords(list);
  let holes;
  if(one(vs))holes=`${listOf(hs)} ${right}, ${fmt(vs[0])} ${down}`;
  else if(one(hs))holes=`${fmt(hs[0])} ${right}, ${listOf(vs)} ${down}`;
  else holes=offsets.slice().sort((p,q)=>p.h-q.h||p.v-q.v).map(o=>`${fmt(r16(o.h))} ${right} and ${fmt(r16(o.v))} ${down}`).join('; ');
  if(!place.dashed){
    const atA=place.corner.a<PLACE_EDGE?sides.start:sides.far,atB=place.corner.b<PLACE_EDGE?sides.top:sides.bottom;
    return{holes,corner:`at the ${atA} and the ${atB}`,pencil:''};
  }
  // the corner of a dashed place: the one nearer one end of the view and one side (said short: R6 of the review)
  const corner=`nearer the ${place.corner.a<=place.far.a?sides.start:sides.far} and the ${place.corner.b<=place.far.b?sides.top:sides.bottom}`;
  // (from the end or edge the place is flush with: a place flush with the far end, "0 to 3 1/2" from the far end")
  const span=(lo,hi,size,fromFar,near,farName)=>lo<PLACE_EDGE&&hi>size-PLACE_EDGE?null
    :fromFar?{range:`${fmt(0)} to ${fmt(r16(size-lo))}`,from:farName}:{range:`${fmt(r16(lo))} to ${fmt(r16(hi))}`,from:near};
  const spanA=span(Math.min(...place.a),Math.max(...place.a),L,place.fromFar,sides.start,sides.far);
  const spanB=span(Math.min(...place.b),Math.max(...place.b),H,place.fromBottom,sides.top,sides.bottom);
  const words=one=>one?`${one.range} from the ${one.from}`:'';
  return{holes,corner,pencil:[words(spanA),words(spanB)].filter(Boolean).join(', '),pencilParts:{a:spanA,b:spanB}};
}
/* The Where column of a row of holes a bit makes: a place that is not the whole face is pencilled on first (each of
   them, when several places share the row); then the holes from the corner with the small circle. The other
   drawing gives the same numbers (spec 11, 4.4). */
function placeWhereWords(places,said,letterOf){
  const place=places[0],many=places.length>1;
  if(!place.dashed)return`From the corner mark (${said.corner}): ${said.holes}.`;
  const name=pieceLabel(place.other,letterOf);
  let pencils=(said.pencils||[said.pencil]).join('; ');
  // (several places with the same span one way: that span said once, the places listed the other way, R6)
  const parts=said.parts||[];
  const same=(list,key)=>list.length>1&&list.every(one=>one[key]&&list[0][key]&&one[key].range===list[0][key].range&&one[key].from===list[0][key].from);
  const oneFrom=(list,key)=>list.every(one=>one[key]&&one[key].from===list[0][key].from);
  if(parts.length>1&&parts.length===places.length){
    if(same(parts,'b')&&oneFrom(parts,'a'))pencils=`${listWords(parts.map(one=>one.a.range))} from the ${parts[0].a.from}, each ${parts[0].b.range} from the ${parts[0].b.from}`;
    else if(same(parts,'a')&&oneFrom(parts,'b'))pencils=`${listWords(parts.map(one=>one.b.range))} from the ${parts[0].b.from}, each ${parts[0].a.range} from the ${parts[0].a.from}`;
  }
  return`Pencil on where ${many?'each':'the'} ${name} sits (dashed${many?`, ${places.length} places`:''}): ${pencils}. `+
    `From its corner mark (${said.corner}): ${said.holes}.`;
}
/* the label of the drawing a hole's mate is on, for the Later column, or null when that piece has no drawing on the
   page (past DRILL_DRAWINGS_MAX: its holes are then made at assembly, C6 of the stage 2 review) */
function mateLabel(hole,drill){
  const label=hole.mate&&drill.labelOfPiece.get(hole.mate.piece.id);
  return label&&label.way&&label.drawn?label:null;
}
/* the drawings of some mates in words: 'drawing D', 'drawing F1 (F2 is its mirror image)', 'drawing F1 (F1 and its
   mirror image F2)': each drawing named once (R17 of the stage 2 review) */
function mateDrawingsWords(labels){
  const byBase=new Map();
  for(const label of labels){
    const base=label.mirror?label.twin:label;
    if(!byBase.has(base))byBase.set(base,new Set());
    byBase.get(base).add(label);
  }
  // ("drawings E1, E2 and E5": the word once, R6)
  const items=[...byBase].sort((a,b)=>labelNameOrder(a[0].name,b[0].name)).map(([base,set])=>{
    const mirror=[...set].find(label=>label.mirror);
    if(!mirror)return base.name;
    return set.has(base)?`${base.name} (${base.name} and its mirror image ${mirror.name})`:`${base.name} (${mirror.name} is its mirror image)`;
  });
  return`${items.length>1?'drawings':'drawing'} ${listWords(items)}`;
}
/* The Later column of holes a bit makes: the step, the screws or dowels, the other piece, and the drawing of the
   holes they meet ('Step 3: #8 × 2" wood screws into the Leg (D), whose pilot holes are on drawing D, with the same
   sizes'). The rows of one step and one other piece are one line. */
function roundLaterWords(holes,drill,letterOf){
  const lines=new Map();
  for(const entry of holes){
    const hole=entry.hole||entry,f=hole.f,other=hole.piece===f.through?f.into:f.through;
    const key=`${hole.kind}|${pieceLabel(other,letterOf)}|${hole.screw}`;
    if(!lines.has(key))lines.set(key,{hole,other,steps:new Set(),mates:new Set(),undrawn:false});
    const line=lines.get(key);
    line.steps.add(hole.step||'?');
    const mate=mateLabel(hole,drill);
    if(mate)line.mates.add(mate);else if(hole.mate)line.undrawn=true;
  }
  return[...lines.values()].map((line,index)=>{
    const steps=[...line.steps].sort((a,b)=>a-b).map(String);
    const head=`${index?'s':'S'}tep${steps.length>1?'s':''} ${listWords(steps)}`;
    const otherName=pieceLabel(line.other,letterOf),mates=mateDrawingsWords([...line.mates]);
    const what=line.hole.kind==='dowel'?'dowels':pluralName(String(line.hole.screw).replace(/^\d+ /,''));
    // (the other piece has no drawing on the page: its holes are made in that step, through or against these)
    if(!line.mates.size&&line.undrawn){
      const verb=line.hole.kind==='pilot'?'through':'into';
      return`${head}: ${what} ${verb} the ${otherName}, whose holes are made in that step, as it says`;
    }
    if(line.hole.kind==='clear')return`${head}: ${what} into the ${otherName}, whose pilot holes are on ${mates}, with the same sizes`;
    if(line.hole.kind==='pilot')return`${head}: ${what} through the ${otherName}, whose holes are on ${mates}, with the same sizes`;
    return`${head}: ${what} into the ${otherName}, whose dowel holes are on ${mates}, with the same sizes`;
  }).join('; ');
}
const ordinal=n=>n+(n%10===1&&n%100!==11?'st':n%10===2&&n%100!==12?'nd':n%10===3&&n%100!==13?'rd':'th');
/* the notes under a drawing: at most three, the ones that matter most first */
function drawingNotes(label,plan){
  const notes=[],drill=plan.drill,letterOf=plan.letterOf,piece=label.way.sample;
  const views=label.views.filter(view=>view.kind!=='mirror');
  const near={letterOf,stepOfPiece:plan.stepOfPiece};
  if(label.mirrorLabel)notes.push(`${label.mirrorLabel.name} is the mirror image of ${label.name}: the same sizes, with the end with the label on the right. Write ${label.mirrorLabel.name} in that corner.`);
  // a row moved on purpose (rules 10 and 11 in js/fasteners.js)
  // (clearOfDashed: view -> index of its note when the row stays clear of the dashed pieces drawn on it; the note
  //  that says where to pencil those pieces on is then added to that one, as one note about the same pieces)
  const clearOfDashed=new Map();
  for(const view of views){
    for(const row of viewRows(view)){
      if(row.kind==='end'||row.holes.length<2)continue;   // (a row of one hole cannot be unevenly spaced: R17)
      const sorted=row.holes.slice().sort((a,b)=>a.a-b.a);
      const passEnds=sorted.filter(entry=>entry.hole.passEnds),clear=sorted.filter(entry=>entry.hole.clear);
      if(!passEnds.length&&!clear.length)continue;
      const gaps=sorted.slice(1).map((entry,i)=>entry.a-sorted[i].a);
      const even=gaps.length>0&&gaps.every(gap=>Math.abs(gap-gaps[0])<=DRILL_SAME);
      const nth=entry=>ordinal(sorted.indexOf(entry)+1);
      if(even&&!clear.length){
        notes.push(`They start ${fmt(r16(sorted[0].a))} in on purpose, to stay clear of the holes at the ends; the gaps are even (${fmt(r16(gaps[0]))}).`);
        continue;
      }
      const reasons=[],others=dashedPieces(view,near);
      if(passEnds.length)reasons.push(`the ${listWords(passEnds.map(nth))} stay${passEnds.length===1?'s':''} clear of the holes at the ends`);
      if(clear.length){
        const names=others.length?[...new Set(others.map(other=>other.name))]:[...new Set(clear.flatMap(entry=>entry.hole.clear))];
        const word=passEnds.length?'':` stay${clear.length===1?'s':''} clear`;
        reasons.push(`the ${listWords(clear.map(nth))}${word} of where the ${listWords(names)} ${others.length>1||names.length>1?'sit':'sits'}`);
      }
      let keep='';
      if(clear.length&&others.length){
        const entry=clear[0],gap=Math.min(...others.map(other=>Math.min(Math.abs(entry.a-other.from),Math.abs(entry.a-other.to))))-entry.hole.f.pocket.dia/2;
        if(gap>0)keep=` Keep the ${nth(entry)} on its mark: it is ${fmt(r16(gap))} from the ${others[0].piece.name.toLowerCase()}.`;
      }
      if(clear.length&&others.length&&!clearOfDashed.has(view))clearOfDashed.set(view,notes.length);
      notes.push(`Not evenly spaced on purpose: ${reasons.join(', and ')}.${keep}`);
    }
  }
  // the pieces that sit here later: pencil them on now
  for(const view of views){
    const byName=new Map();
    for(const other of dashedPieces(view,near)){
      if(!byName.has(other.name))byName.set(other.name,[]);
      byName.get(other.name).push(other);
    }
    // where to pencil each: between its ends along the piece, and between its edges across it; a piece that runs the
    // whole length is placed by its edges only, one that runs the whole width by its ends only
    const along=other=>`${fmt(r16(other.from))} to ${fmt(r16(other.to))} from the end with the label`;
    const across=other=>`${fmt(r16(other.top))} to ${fmt(r16(other.bottom))} down from the top edge`;
    const said=[...byName].map(([name,list])=>{
      const step=list[0].step?` (step ${list[0].step})`:'';
      const spans=list.map(other=>other.wholeLength?across(other):other.wholeWidth?along(other):`${along(other)}, ${across(other)}`);
      return list.length===1?{one:true,text:`${name} sits here${step}`,spans}
        :{one:false,text:`${capital(pluralName(list[0].piece.name))}${name.slice(list[0].piece.name.length)} sit at the dashed places${step}`,spans};
    });
    // (pieces of two or more names sitting on one face make one note, so the drawing keeps to three; and when the
    //  row of this face stays clear of those pieces, the place to pencil them is said in that row's note)
    let pencil='';
    if(said.length===1)pencil=`${said[0].text}: pencil ${said[0].one?'it':'them'} on now, ${listWords(said[0].spans)}.`;
    else if(said.length)pencil=`Pencil on now where the pieces that sit here later go: ${said.map(entry=>`${entry.text.replace(/ sits? (here|at the dashed places)/,'')}, ${listWords(entry.spans)}`).join('; ')}.`;
    if(pencil&&clearOfDashed.has(view))notes[clearOfDashed.get(view)]+=' '+pencil;
    else if(pencil)notes.push(pencil);
  }
  // holes on the other face on purpose (a piece held at its ends by pocket holes of its own)
  // (only for pocket holes on two faces, the end holes on one and a row along an edge on the other: that is the case
  //  the note was written for. Holes a bit makes need no reason for their face: R8 of the stage 2 review)
  const pocketViews=views.filter(view=>viewRows(view).length);
  if(pocketViews.length>1){
    const endOnly=pocketViews.find(view=>viewRows(view).every(row=>row.kind==='end')),edgeOnly=pocketViews.find(view=>viewRows(view).every(row=>row.kind!=='end'));
    if(endOnly&&edgeOnly&&endOnly!==edgeOnly){
      const into=[...new Set(edgeOnly.holes.map(entry=>entry.hole.f.into.name.toLowerCase()))];
      notes.push(`The holes for the ${listWords(into)} are on the other face on purpose: on the same face their screws would run into the screws at the ends.`);
    }
  }
  if(label.symmetric)notes.push('The same from either end: either end can be the end with the label.'+(views.length>1?' Write the label on face 1 only.':''));
  const plugged=label.way.holes.filter(hole=>hole.plugged);
  if(plugged.length){
    const steps=[...new Set(plugged.map(hole=>hole.step).filter(Boolean))];
    // (from below on a high underside; the back rails of a Dining chair are seen from behind)
    const below=plugged.every(hole=>{const out=(hole.hole||hole).out;return!out||out[1]<-.5;});
    notes.push(`${plugged.length===label.way.holes.length?'These holes are':`${plugged.length} of these holes are`} ${below?'seen from below':'on a face that is seen'}: once the screws are in${steps.length?` (step ${listWords(steps.map(String))})`:''}, glue a pocket-hole plug into each and sand it flush.`);
  }
  const wall=drill.wallScrews.filter(item=>label.members.some(member=>member.piece.id===item.on));
  if(wall.length)notes.push(`At install, screws go through this ${piece.name.toLowerCase()} into the wall studs (last step). Do not drill them now: the studs decide where.`);
  // (every piece of the label, and every step that drives such a screw: the At assembly line gives the same steps)
  const ofLabel=new Set(label.members.concat(label.mirrorLabel?label.mirrorLabel.members:[]).map(member=>member.piece));
  const toe=drill.other.filter(entry=>entry.row.key==='toe'&&(ofLabel.has(entry.f.through)||ofLabel.has(entry.f.into)));
  if(toe.length){
    const steps=[...new Set(toe.map(entry=>entry.step).filter(Boolean))].sort((a,b)=>a-b).map(String);
    notes.push(`At assembly, screws are driven at an angle ${ofLabel.has(toe[0].f.through)?'through':'into'} this piece (${steps.length>1?'steps '+listWords(steps):'step '+(steps[0]||'?')}): they are not drilled now.`);
  }
  // (every note is shown; the self-check holds a drawing to three of them, so none is dropped without a word)
  return notes;
}

/* ---------- Done boxes: ticks kept in this browser, per design, label and holes ---------- */
/* (carry-over 5: two designs of one name must not share their ticks. A design gets its own number, S.drillId, the
   first time a box is ticked; until then, and for designs ticked before that number existed, the ticks are kept
   under the design's name. A design made in place of it (a preset, js/app.js placePreset) starts without the
   number (R11 of the stage 2 review); Undo and Redo keep it, because it is written into the saved steps of the undo
   history when it is given (C12). Two copies of one saved file are the same design and share their ticks.) */
const doneKey=label=>`woodshop.drillDone.${S.drillId||S.name}.${label.name}.${label.signature}`;
function doneTicks(label){
  try{const kept=JSON.parse(localStorage.getItem(doneKey(label))||'[]');return Array.isArray(kept)?kept:[];}catch(e){return[];}
}
document.addEventListener('change',event=>{
  const box=event.target.closest&&event.target.closest('input[data-done-key]');
  if(!box)return;
  const figure=box.closest('.drill-fig');
  // the design's own number, given once and kept in the design (autosaved now, so it is there when it is opened again)
  if(!S.drillId){
    S.drillId=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    try{lastSnap=JSON.stringify(S);save();}catch(e){}
    // (the saved steps of Undo and Redo get the number too, so an Undo of an earlier edit keeps the ticks)
    const withId=snap=>typeof snap==='string'&&!/"drillId":/.test(snap)?snap.replace(/^\{/,`{"drillId":${JSON.stringify(S.drillId)},`):snap;
    try{undoStack=undoStack.map(withId);redoStack=redoStack.map(withId);}catch(e){}
    // the boxes on the page move to the new keys, with the ticks kept under the name so far
    const byName=`woodshop.drillDone.${S.name}.`,byId=`woodshop.drillDone.${S.drillId}.`;
    for(const input of document.querySelectorAll('input[data-done-key]')){
      const old=input.dataset.doneKey;
      input.dataset.doneKey=old.replace(byName,byId);
      try{const kept=localStorage.getItem(old);if(kept!==null)localStorage.setItem(input.dataset.doneKey,kept);}catch(e){}
    }
  }
  const ticks=[...figure.querySelectorAll('input[data-done-key]')].map(input=>input.checked);
  try{localStorage.setItem(box.dataset.doneKey,JSON.stringify(ticks));}catch(e){}
});

/* ---------- one figure: header, picture, table, notes ---------- */
function drawingFigure(label,plan){
  const piece=label.way.sample,m=M[piece.mat];
  const layout=partDrawingLayout(label,plan);
  const twoFaces=label.views.length>1&&label.views[1].kind==='face2';
  const count=label.members.length+(label.mirrorLabel?label.mirrorLabel.members.length:0);
  const make=label.mirrorLabel?`make ${count}: ${label.members.length} as drawn (${label.name}), ${label.mirrorLabel.members.length} mirror image (${label.mirrorLabel.name})`
    :count>1?`make ${count}, drilled alike`:'make 1';
  // every kind counted: '11 pocket holes, 4 pilot holes each'
  const each=`${holeCountWords(label.way.holes,count>1)}${twoFaces?', on both faces':''}`;
  const ticks=doneTicks(label);
  const boxes=Array.from({length:count},(unused,i)=>`<input type="checkbox" data-done-key="${esc(doneKey(label))}"${ticks[i]?' checked':''} aria-label="${esc(piece.name)} ${i+1} drilled">`).join('');
  const sep='<span class="sep">·</span>';
  const names=[...new Set(label.members.concat(label.mirrorLabel?label.mirrorLabel.members:[]).map(member=>member.piece.name))].join(', ');
  const head=`<div class="fig-head"><span class="key">${esc(label.name)}</span><b>${esc(names)}</b>${sep}${esc(m.short)}, ${esc(fmt(piece.l))}${sep}${esc(make)}${sep}${esc(each)}${label.tape?`${sep}label on painter's tape`:''}<span class="done">Done ${boxes}</span></div>`;
  const rows=holeTableRows(label,plan);
  const table=docTable([['',''],['Setting',''],['How many',''],['Where',''],['Later','']],
    rows.map(row=>`<tr><td>${tagSvg(row.tag,row.round)}</td><td>${esc(row.setting)}</td><td>${esc(row.many)}</td><td>${esc(row.where)}</td><td>${esc(row.later)}</td></tr>`),'drill-holes');
  const notes=drawingNotes(label,plan);
  const html=`<figure class="drill-fig" data-label="${esc(label.name)}">${head}${partDrawingSvg(layout)}${table}${notes.length?`<ul class="notes">${notes.map(note=>`<li>${esc(note)}</li>`).join('')}</ul>`:''}</figure>`;
  return{html,layout,notes,allNotes:notes,rows};
}

/* ---------- step 2 (spec 11, 1.1) ---------- */
/* the screws of one setting: '20 pocket-hole screws, 2-1/2" (steps 3, 4 and 5)' */
function settingScrews(setup,withSteps){
  const bySize=new Map();
  for(const hole of setup.holes){
    const size=screwSize(hole.screw);
    if(!bySize.has(size))bySize.set(size,{count:0,steps:new Set()});
    bySize.get(size).count++;
    if(hole.step)bySize.get(size).steps.add(hole.step);
  }
  return[...bySize.entries()].map(([size,row])=>{
    const steps=[...row.steps].sort((a,b)=>a-b).map(String);
    return`${row.count} pocket-hole screws, ${size}`+(withSteps&&steps.length?` (step${steps.length>1?'s':''} ${listWords(steps)})`:'');
  }).join('; ');
}
function settingsHtml(drill){
  return jigSettingsHtml(drill)+bitOrderHtml(drill);
}
/* Where a setting's holes are, label by label: 'E (25), A1 and A2 (2 on each)' */
function setupPlacesWords(drill,setup){
  const onLabels=[];
  for(const label of drill.labels){
    if(!label.way||label.mirror)continue;
    const own=label.way.holes.filter(hole=>hole.setup===setup.no);
    if(!own.length)continue;
    const count=label.members.length+(label.mirrorLabel?label.mirrorLabel.members.length:0);
    onLabels.push(`${label.mirrorLabel?label.name+' and '+label.mirrorLabel.name:label.name} (${own.length}${count>1?' on each':''})`);
  }
  return listWords(onLabels);
}
/* The order of work after the jig (spec 11, section 9, sheet 23 section 5): one bit at a time, so the bit is
   changed as seldom as possible. One line per bit setting, with the round tag the drawings use. */
function bitOrderHtml(drill){
  const bits=drill.setups.filter(setup=>setup.kind==='bit');
  if(!bits.length)return'';
  const jigs=drill.setups.some(setup=>setup.kind==='jig');
  const items=bits.map(setup=>`<li>${tagSvg(setup.no,true)} ${esc(`${capital(bitSettingWords(setup))}: ${setup.holes.length} hole${setup.holes.length===1?'':'s'}, in ${setupPlacesWords(drill,setup)}.`)}</li>`);
  return`<p class="lead2">${esc(jigs?'Then the holes a plain bit drills, one bit at a time, so you change bits as seldom as possible:':'Drill the holes one bit at a time, so you change bits as seldom as possible:')}</p><ol class="drill-bits">${items.join('')}</ol>`;
}
function jigSettingsHtml(drill){
  const setups=drill.setups.filter(setup=>setup.kind==='jig');
  if(!setups.length)return'';
  const design=designWord();
  let h='';
  if(setups.length===1){
    const setup=setups[0],bySize=new Map();
    for(const hole of setup.holes)bySize.set(screwSize(hole.screw),(bySize.get(screwSize(hole.screw))||0)+1);
    const sizes=[...bySize.entries()],n=setup.holes.length;
    const screws=sizes.length===1?`with ${sizes[0][0]} pocket-hole screws (${n} hole${n===1?'':'s'})`
      :`${n} holes: ${listWords(sizes.map(([size,count],index)=>`${count} for ${size}${index?'':' pocket-hole'} screws`))}`;
    h+=`<p class="lead2">${esc(`Your pocket-hole jig needs one setting for this ${design}: ${fmt(setup.jig)} stock, ${screws}.`)}</p>`;
  }else{
    h+=`<p class="lead2">Your pocket-hole jig needs ${setups.length} settings for this ${esc(design)}. Drill every hole of setting 1 on every piece, then change the jig and the stop collar${setups.length>2?' for the next setting, and so on':' once'}.</p>`;
    const rows=setups.map(setup=>{
      const kinds=new Set(),onLabels=[];
      for(const label of drill.labels){
        if(!label.way||label.mirror)continue;
        const own=label.way.holes.filter(hole=>hole.setup===setup.no);
        if(!own.length)continue;
        for(const hole of own)kinds.add(holeClampKind(hole,label.frame.lengthAxis));
        const count=label.members.length+(label.mirrorLabel?label.mirrorLabel.members.length:0);
        onLabels.push(`${label.mirrorLabel?label.name+' and '+label.mirrorLabel.name:label.name} (${own.length}${count>1?' on each':''})`);
      }
      const where=kinds.size===1?(kinds.has('end')?'the ends of ':'the edges of '):'';
      return`<tr><td>${tagSvg(setup.no)} Jig and collar set for ${esc(fmt(setup.jig))} stock</td><td class="num">${setup.holes.length}</td><td>${esc(where+listWords(onLabels))}</td><td>${esc(settingScrews(setup,true))}</td></tr>`;
    });
    h+=docTable([['Setting',''],['Holes','num'],['On',''],['Screws for them, later','']],rows,'drill-setups');
  }
  // a setting thinner than a piece it drills: its screws go into a thinner piece
  for(const setup of setups){
    const thick=setup.holes.filter(hole=>hole.piece.t>setup.jig+.02);
    if(!thick.length)continue;
    const names=[...new Set(thick.map(hole=>hole.piece.name))].map(name=>{
      const many=new Set(thick.filter(hole=>hole.piece.name===name).map(hole=>hole.piece.id)).size>1;
      return(many?pluralName(name):name).toLowerCase();
    });
    const sizes=[...new Set(thick.map(hole=>fmt(hole.piece.t)))];
    const into=[...new Set(thick.map(hole=>hole.f.into.name))];
    const plural=names.length>1||new Set(thick.map(hole=>hole.piece.id)).size>1;
    h+=`<p class="hint drill-why">${esc(`${setups.length>1?`Setting ${setup.no}`:'The setting'} is for ${fmt(setup.jig)} stock although the ${listWords(names)} ${plural?'are':'is'} ${sizes.length===1?sizes[0]:'thicker'} thick: these screws go into the ${fmt(setup.jig)} ${listWords(into)}, and the thicker setting would push them out through ${into.length>1?'them':'it'}.`)}</p>`;
  }
  return h;
}
function drillTailHtml(drill,letterOf){
  const lines=[];
  const nothing=nothingWords(drill);
  // pieces whose holes a step of their own drills right after this one (the toy chest's air holes, a step with
  // shapes): never on the Nothing line, and that step is named (R10 of the stage 2 review)
  const shapedStep=(drill.steps||[]).find(step=>step.no===drill.stepNo+1&&step.preset&&Array.isArray(step.preset.shapes)&&step.preset.shapes.length);
  const shaped=new Set(shapedStep?shapedStep.preset.shapes:[]);
  const entries=nothing?nothing.entries.filter(entry=>!entry.pieces.every(p=>shaped.has(p.name))):[];
  const later=nothing?nothing.entries.filter(entry=>entry.pieces.every(p=>shaped.has(p.name))):[];
  if(later.length){
    const items=later.map(entry=>`${keyBox(entry.name)} ${esc(entry.pieces[0].name)} (${entry.count})`);
    lines.push(`${listWords(items)}: ${later.length>1||later[0].count>1?'their':'its'} holes are drilled in step ${shapedStep.no}, the next step, while ${later.length>1||later[0].count>1?'they are':'it is'} still flat.`);
  }
  if(entries.length){
    const items=entries.map(entry=>`${keyBox(entry.name)} ${esc(entry.pieces[0].name)} (${entry.count})`);
    lines.push(`Nothing to drill: ${listWords(items)}. ${esc(nothing.why)}`);
  }else{
    // every piece has a hole, and structural screws join some of them: they are named all the same (spec 11, 1.6)
    const structural=drill.other.filter(entry=>entry.row.key==='structural');
    if(structural.length){
      const steps=[...new Set(structural.map(entry=>entry.step).filter(Boolean))].sort((a,b)=>a-b).map(String);
      lines.push(esc(`Structural screws need no hole: the ${structural.length} of them are driven straight in${steps.length?`, in step${steps.length>1?'s':''} ${listWords(steps)}`:''}.`));
    }
  }
  lines.push(esc(drillCountLine(drill)));
  for(const line of assemblyWords(drill,letterOf))lines.push(esc(line));
  const hardware=hardwareHoleWords(drill.steps);
  if(hardware)lines.push(esc(hardware));
  return`<div class="tail">${lines.map(line=>`<p>${line}</p>`).join('')}</div>`;
}
/* The fasteners whose holes step 2 drills, by the label the shopping list buys them under, against the count the
   shopping list has: [{label, drilled, listed}] (a pocket screw, a wood screw, a dowel: each counted once, however
   many holes it takes). The count line and the self-check drillCountsMatchTheShoppingList read it. */
function drilledFastenerCounts(drill){
  const byLabel=new Map();
  for(const hole of drill.holes){
    if(!byLabel.has(hole.f.label))byLabel.set(hole.f.label,new Set());
    byLabel.get(hole.f.label).add(hole.f);
  }
  const rows=hardwareTotals(findJoints()).rows;
  return[...byLabel].map(([label,set])=>{
    const row=rows.find(([name])=>name===label||name===label+'s'||name.startsWith(label+' ')||name.startsWith(label+'s'));
    return{label,drilled:set.size,listed:row?row[1]:0,row:row?row[0]:''};
  });
}
/* "When you are done: 58 holes in 10 pieces (29 clearance holes, 29 pilot holes: A1 7, ...). That matches the
   shopping list: ..." (spec 11, 1.1 item 7) */
function drillCountLine(drill){
  const drilledPieces=drill.labels.reduce((sum,label)=>sum+label.members.length,0);
  const perLabel=drill.labels.map(label=>`${label.name} ${label.holesEach}${label.members.length>1?' on each':''}`);
  const kinds=holeCountWords(drill.holes,false);
  const counts=drilledFastenerCounts(drill);
  // the shopping list's lines, each with its count ("44 pocket-hole screws, 1-1/4"" reads as stage 1 wrote it)
  const listed=counts.map(one=>`${one.listed} ${one.row||pluralName(one.label)}`);
  const plugs=pocketScrewsListed().plugs.reduce((sum,[,count])=>sum+count,0);
  // (one kind: "44 pocket holes in 5 pieces"; several: "58 holes in 10 pieces: 29 clearance holes, 29 pilot holes")
  const oneKind=!/,/.test(kinds);
  const noun=oneKind?HOLE_NOUNS[drill.holes[0].kind]:'hole';
  const head=`When you are done: ${drill.total} ${noun}${drill.total===1?'':'s'} in ${drilledPieces} piece${drilledPieces===1?'':'s'}${oneKind?'':`: ${kinds}`} (${listWords(perLabel)}).`;
  const all=counts.every(one=>one.drilled===one.listed);
  if(all)return`${head} That matches the shopping list: ${listWords(listed)}${plugs?`, and ${plugs} pocket-hole plugs`:''}.`;
  // (some of a kind go in at assembly: the line after this one says which)
  return`${head} The shopping list has ${listWords(listed)}. Of those, ${listWords(counts.filter(one=>one.drilled!==one.listed).map(one=>`${one.drilled} ${pluralName(one.label)}`))} go in these holes, the rest where their steps say.`;
}
const BEFORE_YOU_DRILL=[
  'On each piece, pick the face you like least: the holes go in it, and it ends up inside or underneath, where nobody sees it.',
  'Write the label of the piece on that face where its drawing shows the label box (at the end with the label, by the top edge), with an arrow pointing to the top edge. The sizes run from that end and that edge: hook your tape on the end with the label.',
  'Store boards vary by about 1/16" in width and thickness, so measure from the end and the edge the drawing names, and drill one test hole in a scrap of the same board first, to check the jig and the stop collar.'];
/* The lines of the "Before you drill" box for this design (spec 11, 1.1 item 3 and 1.6):
     - a piece whose face 1 is seen once it is built (the heads of a Rustic top are meant to show): its label goes on
       painter's tape, which peels off clean (spec 11, 3.2);
     - no pocket holes: the test hole checks the bit and its depth, not the jig;
     - a hole that meets a hole in another piece (a clearance hole and its pilot, the two holes of a dowel): line 4. */
const BEFORE_TAPE=' Where face 1 of a drawing is a face that shows once it is built (its drawing says "label on painter\'s tape"), write the label on a strip of painter\'s tape there instead: it peels off clean.';
const BEFORE_PAIRS='A hole that meets a hole in another piece is measured on both drawings from the same end and edge, with the same numbers. Drill the first pair, hold the two pieces together to check, then drill the rest. If you prefer, leave the pilot holes in the second piece and drill them through the first piece when you put it together.';
function beforeYouDrillLines(drill){
  const lines=BEFORE_YOU_DRILL.slice();
  if(!drill.pockets)lines[0]='On each piece, find face 1 of its drawing: the face the holes are drilled into, or the hidden face of a piece whose holes are in an edge or an end. The label goes on that face.';
  // (pocket holes and holes a bit makes in one design: the face of a piece with other holes is set by the design,
  //  where its holes meet the next piece or its heads are plugged: C15 of the stage 2 review)
  else if(drill.total>drill.pockets)lines[0]='On a piece with only pocket holes, pick the face you like least: the holes go in it, and it ends up inside or underneath, where nobody sees it. On every other piece, face 1 is set by its drawing: find it before you mark anything.';
  if(drill.labels.some(label=>label.tape))lines[0]+=BEFORE_TAPE;
  if(!drill.pockets)lines[2]=lines[2].replace('to check the jig and the stop collar','to check the bit and how deep it goes');
  else if(drill.total>drill.pockets)lines[2]=lines[2].replace('to check the jig and the stop collar','to check the jig, the stop collar and each bit');
  // (a pair both of whose pieces have a drawing on the page: past DRILL_DRAWINGS_MAX a mate may have none)
  const drawn=piece=>{const label=drill.labelOfPiece.get(piece.id);return!!(label&&label.way&&label.drawn);};
  if(drill.holes.some(hole=>hole.mate&&drawn(hole.piece)&&drawn(hole.mate.piece)))lines.push(BEFORE_PAIRS);
  return lines;
}
function drillStepHtml(step,plan){
  const drill=plan.drill;
  let h=stepTextHtml(step);
  h+=`<div class="drill-box"><h4>Before you drill</h4><ol>${beforeYouDrillLines(drill).map(line=>`<li>${esc(line)}</li>`).join('')}</ol></div>`;
  h+=settingsHtml(drill);
  let figures='';
  const made=drill.labels.filter(label=>!label.mirror&&label.drawn&&label.way).map(label=>drawingFigure(label,plan));
  // one legend above the drawings: what the signs on every drawing mean
  if(made.length)figures+=`<div class="drill-legend">${partDrawingSvg(drillLegendLayout(made.map(figure=>figure.layout)))}</div>`;
  for(const figure of made)figures+=figure.html;
  const over=drill.labels.filter(label=>!label.drawn);
  if(over.length)figures+=`<p class="hint">More pieces have pocket holes than this page has room to draw: ${esc(listWords(over.map(label=>`${label.name} (${label.members.length})`)))}. Their holes are given in the steps that drive them, each with its marking view.</p>`;
  return`<div class="step-text">${h}<div class="drill-body">${figures}${drillTailHtml(drill,plan.letterOf)}</div></div>`;
}
/* Build step by step: the words, the settings in one sentence, and where the drawings are */
function drillModeHtml(step,plan){
  const drill=plan.drill;
  const jigs=drill.setups.filter(setup=>setup.kind==='jig'),bits=drill.setups.filter(setup=>setup.kind==='bit');
  const jigWordsSaid=!jigs.length?'':jigs.length===1?`Your pocket-hole jig needs one setting: ${fmt(jigs[0].jig)} stock.`
    :`Your pocket-hole jig needs ${jigs.length} settings: ${listWords(jigs.map(setup=>`${setup.no} for ${fmt(setup.jig)} stock`))}.`;
  // (the bits in the order of work, one sentence)
  const bitWordsSaid=bits.length?`${jigs.length?'Then the bits':'The bits, in this order'}: ${listWords(bits.map(setup=>`${setup.no}, ${setupWords(setup)}`))}.`:'';
  const settings=[jigWordsSaid,bitWordsSaid].filter(Boolean).join(' ');
  // (the words of the page say "the drawings below": here the drawings are on the Build instructions page)
  const words=step.words.replace('on the drawings below now',`on the drawings of the Build instructions page, step ${step.no}, now`);
  return stepTextHtml({...step,words})+`<p>${esc(settings)}</p>`;
}

/* ---------- self-checks (spec 11, section 8; selfTest runs every function in SELFTESTS, see js/core.js) ----------
   Checks 1 to 5, and the Put in part of 6 (putInPlacesEveryHole), look at every preset at its usual sizes in the
   three styles, at each of its choices (presetVariants) in Everyday, and at the smallest and largest of each number
   of the Desk, the Bookshelf (old and cabinet builder), the Computer desk, the Nightstand and the fish rack, without drawing the 3D scene. They share one pass over
   those designs (drillCheckPass): the first of them makes it, the others read what it found. Checks 6 to 8 build
   their own designs. */
const DRILL_CHECKS=['drillPlanHoldsEveryHole','partDrawingsMeasureTrue','drillCountsMatchTheShoppingList','drilledFacesStayHidden','noHoleDrilledTwice','putInPlacesEveryHole'];
let drillCheckFound=null;
function drillCheckRuns(){
  const runs=[];
  for(const preset of PRESETS)for(const style of['std','fine','rustic'])runs.push({preset,vals:presetDefaults(preset),style,name:`${preset.name} (${STYLES[style][0]})`});
  for(const variant of presetVariants())if(variant.name!==variant.preset.name)runs.push({preset:variant.preset,vals:{...presetDefaults(variant.preset),...variant.vals},style:'std',name:variant.name});
  // (the Bookshelf the presets window makes is the cabinet builder's, "Cabinet / case"; "Bookshelf" is the retired
  //  preset that older designs still open with)
  for(const name of['Desk','Bookshelf','Cabinet / case','Computer desk','Nightstand with drawers','Fish tank wall / rack']){
    const preset=PRESETS.find(candidate=>candidate.name===name);
    if(preset)for(const size of sizesToTry(preset).slice(1))runs.push({preset,vals:size.vals,style:'std',name:`${name} (${size.where})`,extreme:true});
  }
  return runs;
}
function drillCheckPass(){
  const found=Object.fromEntries(DRILL_CHECKS.map(name=>[name,[]]));
  let designs=0,holes=0,drawings=0;
  withoutDrawing(()=>{
    for(const run of drillCheckRuns()){
      let placed=false;
      try{placed=placeInStyle(run.preset,{...run.vals},run.style);}catch(e){placed=false;}
      if(!placed)continue;
      designs++;
      const said=(check,text)=>{if(found[check].length<12)found[check].push(`${run.name}: ${text}`);};
      try{
        const plan=buildPlan(true);
        holes+=plan.drill.total;
        drawings+=drillDesignProblems(plan,said,run);
      }catch(e){said('drillPlanHoldsEveryHole',`stopped: ${e.message}`);}
    }
  });
  found.counts={designs,holes,drawings};
  return found;
}
/* checks 1 to 5 on the design as it is now; returns how many drawings it looked at */
function drillDesignProblems(plan,said,run){
  const drill=plan.drill;
  // 1. every live hole drilled ahead is a hole of the plan, on one view of one label, once per piece
  // (every kind live in this stage: a pocket hole; a clearance hole and its pilot; a dowel hole in each piece)
  const live=[];
  let liveHoles=0;
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link)){
      const row=drillKindOf(f);
      if(!drilledAhead(row))continue;
      live.push(f);
      liveHoles+=row.holes(f,link).length;
    }
  }
  if(liveHoles!==drill.total)said('drillPlanHoldsEveryHole',`${liveHoles} holes drilled ahead in the model, ${drill.total} in step 2`);
  const drillStep=plan.steps.find(step=>step.kind==='drill');
  if(!!drillStep!==!!drill.total)said('drillPlanHoldsEveryHole',drill.total?'the design has pocket holes and no step "Drill your pieces"':'a step "Drill your pieces" with nothing to drill');
  if(drillStep&&drillStep.no!==2)said('drillPlanHoldsEveryHole',`"Drill your pieces" is step ${drillStep.no}, not step 2`);
  let made=0,drawings=0;
  for(const label of drill.labels){
    made+=label.members.length*label.holesEach;
    if(!label.drawn)continue;
    for(const member of label.members){
      const holes=drill.byPiece.get(member.piece.id)||[];
      if(holes.length!==label.holesEach)said('drillPlanHoldsEveryHole',`a piece of ${label.name} has ${holes.length} holes, its drawing ${label.holesEach}`);
      // each hole of the piece, taken through its own frame (the drawing's view of its face, edge or end), is a hole
      // of the drawing, one to one (entriesOfPiece, js/drillplan.js)
      const missed=entriesOfPiece(label,member.piece,member.frame,drill).missed;
      if(missed)said('drillPlanHoldsEveryHole',`${label.name}: ${missed} is not on the drawing`);
    }
    const drawn=label.views.filter(view=>view.kind!=='mirror').reduce((sum,view)=>sum+view.holes.length,0);
    if(drawn!==label.holesEach)said('drillPlanHoldsEveryHole',`the drawing of ${label.name} shows ${drawn} holes, the piece has ${label.holesEach}`);
    // (stage 2: a face, the face behind it, an edge and an end can each have holes; more views than DRILL_VIEWS_MAX
    //  is more than a beginner reads as one piece)
    if(label.views.length>DRILL_VIEWS_MAX)said('drillPlanHoldsEveryHole',`the drawing of ${label.name} has ${label.views.length} views`);
    if(label.mirror)continue;
    // 2. the drawing measures true
    drawings++;
    const figure=drawingFigure(label,plan);
    partLayoutProblems(figure,label,drill).slice(0,2).forEach(text=>said('partDrawingsMeasureTrue',`${label.name}: ${text}`));
    for(const text of offSixteenths(label).slice(0,1))said('partDrawingsMeasureTrue',`${label.name}: ${text}`);
    if(figure.allNotes.length>3)said('partDrawingsMeasureTrue',`${label.name} has ${figure.allNotes.length} notes: ${figure.allNotes.map(note=>note.slice(0,30)).join(' / ')}`);
    // the Later column tells the step and the piece of every piece's screws, not only the first piece's
    const pieces=label.members.length+(label.mirrorLabel?label.mirrorLabel.members.length:0);
    for(const row of figure.rows){
      if(row.laterHoles.length!==row.row.holes.length*pieces)said('partDrawingsMeasureTrue',`${label.name}: the Later column of setting ${row.tag} reads ${row.laterHoles.length} holes of ${row.row.holes.length*pieces}`);
      // (the other piece: the one a screw goes into, or for a pilot hole the one it comes through)
      const otherOf=hole=>hole.piece===hole.f.through?hole.f.into:hole.f.through;
      const untold=row.laterHoles.find(hole=>!new RegExp(`\\b${hole.step}\\b`).test(row.later)||!row.later.includes(pieceLabel(otherOf(hole),plan.letterOf)));
      if(untold)said('partDrawingsMeasureTrue',`${label.name}: a screw of ${untold.piece.name} meets the ${otherOf(untold).name} in step ${untold.step}, and the Later column says "${row.later}"`);
    }
    // 4. the face the header and the views name is the face the holes are on
    for(const view of label.views)if(view.kind!=='mirror'&&view.holes.some(entry=>!sameVector(entry.hole.out,view.frame.n)))said('drilledFacesStayHidden',`the view of ${label.name} names another face than the one its holes are on`);
    // 4.4: a dashed place flush with an end or an edge of this piece is located from that end or edge (its corner on
    // it, or its pencil words from it), never across the piece from the other side, where a piece cut a little long
    // or short would move the holes off the holes they meet
    for(const view of label.views){
      if(view.kind==='mirror')continue;
      const sides=sidesOf(view);
      for(const place of viewPlaces(view)){
        if(!place.dashed)continue;
        const words=placeHoleWords(place,place.offsets,view);
        const onFar=Math.abs(place.corner.a-view.length)<PLACE_EDGE,onBottom=Math.abs(place.corner.b-view.height)<PLACE_EDGE;
        if(place.fromFar&&!onFar&&!words.pencil.includes(`from the ${sides.far}`))said('partDrawingsMeasureTrue',`${label.name}: the place of the ${place.other.name} is flush with the ${sides.far} and located from the ${sides.start}`);
        if(place.fromBottom&&!onBottom&&!words.pencil.includes(`from the ${sides.bottom}`))said('partDrawingsMeasureTrue',`${label.name}: the place of the ${place.other.name} is flush with the ${sides.bottom} and located from the ${sides.top}`);
      }
    }
  }
  if(made!==drill.total)said('drillPlanHoldsEveryHole',`the labels make ${made} holes, the plan has ${drill.total}`);
  // the Drill first column of a letter cut more than one way names every way, the pieces with nothing to drill too
  if(drill.total){
    for(const row of cutRows().rows){
      const names=drill.labels.filter(label=>label.letter===row.id).map(label=>label.name)
        .concat(drill.nothing.filter(entry=>entry.letter===row.id&&entry.label).map(entry=>entry.name));
      const text=drillColumn(row,drill);
      if(names.length>1&&names.some(name=>!new RegExp(`\\b${name}\\b`).test(text)))said('drillPlanHoldsEveryHole',`the Drill first column of ${row.id} says "${text}", not each of ${names.join(', ')}`);
    }
  }
  // 6. each piece is drilled in the hand its drawing shows: a piece drilled alike has its end with the label on the
  //    left as drawn (a turn of the sample), a mirror image on the right (a reflection); and a piece put in the way
  //    its Put in line says, in every way those words allow, has every hole where the model has it
  for(const label of drill.labels){
    if(!label.way||!label.drawn)continue;
    for(const member of label.members){
      if(datumOnLeft(member.frame)===!!label.mirror){said('putInPlacesEveryHole',`${member.piece.name} (${label.name}) is drilled as the ${label.mirror?'drawing':'mirror image'} shows it, not as ${label.mirror?'its mirror image':'drawn'}`);continue;}
      const put=drill.putSaid.get(member.piece.id);
      if(!put)continue;
      for(const frame of framesOfPlace(member)){
        if(put.say(frame)!==put.said)continue;
        const missed=holesMissedByFrame(label,member.piece,frame,drill);
        if(missed){said('putInPlacesEveryHole',`put in as its Put in line says ("${put.said.replace(/\|/g,' ')}"), ${missed} is not where the model has it`);break;}
      }
    }
  }
  for(const f of live)if(!drill.byFastener.has(f)){said('drillPlanHoldsEveryHole',`a hole of a ${f.label} in ${f.through.name} is in no label`);break;}
  // pieces stacked straight above one another (the drawers of a stack) are the same piece: never drilled as mirror
  // images of each other (R9 of the stage 2 review)
  for(const label of drill.labels){
    if(!label.mirror)continue;
    // (the same piece: one name, the same place across the room; a base rail under a back rail of one size is not)
    const same=(p,q)=>{const a=plainBox(p),b=plainBox(q);return p.name===q.name&&[0,2].every(k=>Math.abs(a.lo[k]-b.lo[k])<.01&&Math.abs(a.hi[k]-b.hi[k])<.01);};
    const stacked=label.members.find(m=>label.twin.members.some(t=>same(m.piece,t.piece)));
    if(stacked){said('drillPlanHoldsEveryHole',`${stacked.piece.name} (${label.name}) is drilled as the mirror image of the same piece stacked above or below it (${label.twin.name})`);break;}
  }
  // a Put in line names only pieces that are in already ("the end with the label against the Seat" in the step
  // before the seat goes on: R13 of the stage 2 review)
  plan.steps.forEach((step,index)=>{
    for(const[,name]of String(step.put||'').matchAll(/against the (.+?) \([A-Z]+\d*\)/g)){
      for(const one of name.split(/, | and /)){
        const pieces=S.parts.filter(p=>p.name===one);
        if(pieces.length&&!pieces.some(p=>plan.stepOfPiece.get(p.id)<=index))said('putInPlacesEveryHole',`step ${step.no} puts a piece against the ${one}, which goes in later`);
      }
    }
  });
  // every hole a bit makes, and the plug over a sunk head, is on the line of its own fastener as the model has it
  // (f.pos, f.dir: the screw the 3D view draws and every clash check measures), so a piece drilled by its drawing
  // has the screw where the layout put it, clear of the others (a plug left behind when its screw was moved drew
  // both holes of the Platform bed's rail screws 3/8" off the real screw, into two other screws)
  for(const f of live){
    const offLine=p=>{const d=[0,1,2].map(k=>p[k]-f.pos[k]),along=dotOf(d,f.dir);return Math.hypot(...d.map((v,k)=>v-along*f.dir[k]));};
    const off=(drill.byFastener.get(f)||[]).find(hole=>straightHole(hole)&&offLine(hole.at)>1/64);
    if(off){said('drillPlanHoldsEveryHole',`the ${HOLE_NOUNS[off.kind]} of a ${f.label} in the ${off.piece.name} is drawn ${fmt(r16(offLine(off.at)))} off the screw`);break;}
    if(f.plug&&offLine(f.plug.at)>1/64){said('drillPlanHoldsEveryHole',`the plug of a ${f.label} in the ${f.through.name} is ${fmt(r16(offLine(f.plug.at)))} off its screw`);break;}
  }
  // 4.4: a hole and the hole it meets, drilled from two drawings, are on one line with the same numbers
  // (every pair both of whose pieces are drawn, past DRILL_DRAWINGS_MAX too: C6 of the stage 2 review)
  for(const problem of pairProblems(drill))said(problem.check,problem.text);
  // 3. the counts against the shopping list
  // (every fastener whose holes step 2 drills, by its shopping-list line: those drilled now and those of the same
  //  line whose holes are made at assembly are no more than the list buys (the same screws can also hold hardware,
  //  runners or a roof the preset counts itself); every pocket-hole screw is drilled now, so those match exactly)
  if(drill.total){
    const listed=pocketScrewsListed();
    for(const one of drilledFastenerCounts(drill)){
      const later=drill.other.filter(entry=>entry.f.label===one.label).length;
      const pocket=/pocket-hole screw/.test(one.label);
      if(pocket?one.drilled!==one.listed:one.drilled+later>one.listed)said('drillCountsMatchTheShoppingList',`${one.drilled} ${pluralName(one.label)} have holes in step 2${later?` and ${later} at assembly`:''}, the shopping list buys ${one.listed}`);
    }
    const pockets=drill.holes.filter(hole=>hole.kind==='pocket').length;
    if(listed.screws.reduce((sum,[,count])=>sum+count,0)!==pockets)said('drillCountsMatchTheShoppingList',`${pockets} pocket holes, ${listed.screws.reduce((sum,[,count])=>sum+count,0)} pocket-hole screws on the shopping list`);
    const plugged=drill.holes.filter(hole=>hole.plugged).length,plugs=listed.plugs.reduce((sum,[,count])=>sum+count,0);
    if(plugged!==plugs)said('drillCountsMatchTheShoppingList',`${plugged} holes to plug, ${plugs} pocket-hole plugs on the shopping list`);
    // the shopping page's tools name the bits the holes need, and no bit nothing needs (R12 of the stage 2 review)
    const tools=toolList(findJoints().filter(j=>jType(j)!=='none'),plan).join('; ');
    const woodHoles=drill.holes.some(hole=>hole.kind==='clear'||hole.kind==='pilot')||drill.other.some(entry=>(entry.row.key==='toe'||entry.row.key==='plate')&&!entry.f.structural);
    if(woodHoles!==/Drill bits: /.test(tools))said('drillCountsMatchTheShoppingList',woodHoles?'the tool list has no bits for the holes of the wood screws':'the tool list buys drill bits for wood screws that take no hole');
    if(drill.holes.some(hole=>hole.kind==='dowel')&&!/brad-point bit/.test(tools))said('drillCountsMatchTheShoppingList','the tool list has no bit for the dowel holes');
    // the hardware sentence names each kind once, in a beginner's words, and never the wall screws said already
    const hardware=hardwareHoleWords(drill.steps);
    const nouns=(hardware.split(': ')[1]||'').split(/, (?:and )?| and /).map(item=>item.replace(/ \(steps? .*$/,''));
    if(/wall stud|studs \(/i.test(hardware)||/\bt-hinge/.test(hardware)||new Set(nouns).size!==nouns.length)said('drillPlanHoldsEveryHole',`the hardware sentence reads wrong: ${hardware}`);
    const tail=drillTailHtml(drill,plan.letterOf);
    // a piece whose holes the next step drills is not on the Nothing line (R10 of the stage 2 review)
    const next=plan.steps.find(step=>step.no===drill.stepNo+1),nothingLine=(tail.match(/Nothing to drill:[^<]*(<[^>]*>[^<]*)*?<\/p>/)||[''])[0].replace(/<[^>]+>/g,' ');
    for(const name of next&&next.preset&&Array.isArray(next.preset.shapes)?next.preset.shapes:[])
      if(nothingLine.includes(` ${name} (`))said('noHoleDrilledTwice',`the ${name} is on the Nothing line, and step ${next.no} drills its holes`);
    if(!tail.includes(`When you are done: ${drill.total} `)||!/That matches the shopping list|The shopping list has/.test(tail))said('drillCountsMatchTheShoppingList','the count line does not give the count that matches the shopping list');
  }
  // 4. the face a drawing names is the face its pieces' steps name ("inside face" on the drawing, "outside face" in
  //    the step that puts in one of its pieces is a wrong face)
  for(const step of plan.steps){
    for(const group of step.groups){
      if(!group.predrilled)continue;
      for(const link of group.links){
        const f=fastenersOfLink(link)[0],label=f&&drill.labelOfPiece.get(f.through.id);
        if(!label||!label.way||!f.pocket)continue;   // (a line of pocket holes names their face; a screw's line its head)
        // (a drawing of two faces names them face 1 and face 2, not by where they face)
        const base=label.mirror?label.twin:label,named=drawnFaceWords(base).split(' (')[0];
        if(/face with the holes/.test(named)||base.views.some(view=>view.kind==='face2'))continue;
        const inLine=faceWords(f.through,f.pocket.out,false).split(' (')[0];
        if(inLine!==named){said('drilledFacesStayHidden',`step ${step.no}, line ${group.no} drills the ${inLine} of ${f.through.name}, its drawing ${base.name} names the ${named}`);break;}
      }
    }
  }
  // 4. no drilled face is a show face (house furniture, Everyday and Fine)
  // (a size the preset refuses, "cannot work", is never built: showFacesOfHouseFurniture skips it the same way. The
  //  Cabinet / case 96" tall is refused because its top rails' undersides, and the screws in them, would be seen)
  const refused=!!(run.preset.check&&(run.preset.check(run.vals)||[]).some(finding=>finding.level==='stop'));
  if(HOUSE_FURNITURE.includes(run.preset.name)&&SHOW_FACES.styles.includes(run.style)&&!refused){
    // (every hole drilled ahead, at every size tried: C4 of the stage 2 review took out the exception for wood-screw
    //  heads at the smallest and largest sizes)
    const ours=new Set(drill.holes.map(hole=>hole.f));
    const shown=headsOnShowFaces().filter(head=>ours.has(head.f)&&!showFaceAllowed(run.preset.name,run.style,head));
    if(shown.length)said('drilledFacesStayHidden',`${shown.length} holes drilled ahead are on a face that is seen, with no plug over them (${shown[0].f.through.name}, ${shown[0].face})`);
  }
  // 5. no later step asks to drill a hole step 2 holds; every pre-drilled line names its drawing, with the numbers of it
  // (carry-over 10: also past DRILL_DRAWINGS_MAX, step by step: a line whose holes are on no drawing then keeps its
  //  own words and marking view, and only a line that is drilled already is held to these)
  if(drill.total){
    const words=new Map(drill.labels.filter(label=>label.drawn&&label.way&&!label.mirror).map(label=>[label.name,drawingWords(label,plan)]));
    for(const step of plan.steps){
      const pockets=step.groups.filter(group=>group.type==='pocket');
      if(pockets.length&&pockets.every(group=>group.predrilled)){
        const orders=drillOrders(step.words);
        if(orders.length)said('noHoleDrilledTwice',`step ${step.no} still says: "${orders[0].trim().slice(0,90)}"`);
      }
      // (stage 2, every step after step 2, a marking step with no lines too: no order to drill a dowel hole, a
      //  clearance hole or a counterbore that step 2 holds, the step's own lines of that kind all pre-drilled, or none
      //  in the step and every drawing shown)
      if(step.kind!=='drill'&&step.no>2){
        const held=drillWordsHeld(drill,step.groups);
        const order=boreOrders(step.words).find(one=>held[one.kind]);
        if(order)said('noHoleDrilledTwice',`step ${step.no} still tells to drill ${order.kind==='dowel'?'dowel holes':'the holes of wood screws'}: "${order.sentence.trim().slice(0,90)}"`);
      }
      // (stage 2: a step whose wood screws all have their holes on the drawings tells nobody to drill their pilot
      //  holes or counterbores, in its words or in its lines)
      const screws=step.groups.filter(group=>group.type==='screw'||group.type==='plug');
      if(screws.length&&screws.every(group=>group.predrilled)){
        const orders=pilotOrders(step.words).concat(...screws.map(group=>pilotOrders(group.line+' '+group.where)));
        if(orders.length)said('noHoleDrilledTwice',`step ${step.no} still says: "${orders[0].trim().slice(0,90)}"`);
        const bore=screws.find(group=>/drill a 3\/8" hole|Drill a hole [^.]* deep for each head first/.test(group.line));
        if(bore)said('noHoleDrilledTwice',`step ${step.no}, line ${bore.no} still says to drill the counterbores: ${bore.line.slice(0,120)}`);
      }
      for(const group of screws)if(group.predrilled&&!/drilled already: drawings? [A-Z]/.test(group.where))said('noHoleDrilledTwice',`step ${step.no}, line ${group.no} does not point to its drawing: ${group.where}`);
      for(const group of pockets){
        if(!group.predrilled){if(drill.complete)said('noHoleDrilledTwice',`step ${step.no}, line ${group.no}: its pocket holes are on no drawing`);continue;}
        if(!/drilled already: drawings? [A-Z]/.test(group.where)||/Where to mark/.test(group.where))said('noHoleDrilledTwice',`step ${step.no}, line ${group.no} does not point to its drawing: ${group.where}`);
        // every place the words gave (not a gap between two holes: "1 3/4" apart", "at gaps of") is on the drawing,
        // from the same edge or, measured from the other edge or end, as the rest of the piece
        const size='(?:\\d+ \\d+\\/\\d+|\\d+\\/\\d+|\\d+)"';
        const kept=String(group.whereKept||'').replace(new RegExp(`${size} apart|gaps of [^.]*|every ${size}`,'g'),'');
        const told=kept.match(/\d+(?: \d+\/\d+)?"|\d+\/\d+"/g)||[];
        const theirs=group.predrilled.labels.map(name=>words.get(name)||'').join(' ');
        const through=group.links.map(link=>fastenersOfLink(link)[0]).filter(Boolean)[0];
        const sizes=through?[through.through.l,through.through.w,through.through.t]:[];
        // (a hole that lies halfway between two sixteenths, at the middle of a board an odd number of sixteenths
        //  wide or a third of the way along it, rounds to the nearest 1/16" from each edge on its own: 2 13/32" from
        //  the back edge of a 14 7/16" board is 2 7/16" in the words and 12 1/16" from the front edge on the
        //  drawing. So the number from the other edge is worked out from where the holes of the line really are:
        //  for each hole the words round to this number, the drawing must give what it rounds to from the other edge.)
        const holesOfLine=group.links.flatMap(link=>fastenersOfLink(link)).filter(f=>f.kind==='pocket');
        const fromOtherEdge=value=>holesOfLine.flatMap(f=>{
          const b=box(f.through),found=[];
          for(let k=0;k<3;k++){
            const fromLow=f.pos[k]-b.lo[k],fromHigh=b.hi[k]-f.pos[k];
            if(fromLow<0||fromHigh<0)continue;
            if(Math.abs(r16(fromLow)-value)<1e-6)found.push(fromHigh);
            if(Math.abs(r16(fromHigh)-value)<1e-6)found.push(fromLow);
          }
          return found;
        });
        const onDrawing=number=>{
          const value=parseLen(number.replace(/"$/,''));
          return[value,...sizes.map(size=>size-value),...fromOtherEdge(value)].some(v=>v>0&&theirs.includes(fmt(r16(v))));
        };
        const missing=told.find(number=>!onDrawing(number));
        if(missing)said('noHoleDrilledTwice',`step ${step.no}, line ${group.no} gave ${missing}, which its drawing does not: ${String(group.whereKept).slice(0,120)}`);
      }
    }
  }
  return drawings;
}
/* ---------- the holes that meet a hole in another piece (spec 11, 4.4), checked as the person drills them ----------
   For a clearance hole and its pilot, and the two holes of a dowel: each piece is drilled from its own drawing (the
   corner of the place pencilled on from the end with the label and the top edge, the holes from that corner, every
   number as printed, to 1/16"), then put in as its Put in line says, in every way those words allow. The two holes
   must then lie on one line within 1/64", and the two drawings must print the same numbers for the pair.
   Also: a pilot or dowel hole never comes out of the far face of its piece, and no hole of one fastener lands on a
   hole of another in the same piece. Returns {check, text} problems. */
const PAIR_LINE=1/64+1e-6;
function pairProblems(drill){
  const found=[];
  const say=(check,text)=>{if(found.length<40)found.push({check,text});};
  // per piece: its holes matched to its drawing through its own frame, and the other frames its Put in words allow
  const ofPiece=new Map();
  const pieceInfo=piece=>{
    if(ofPiece.has(piece.id))return ofPiece.get(piece.id);
    let info=null;
    const label=drill.labelOfPiece.get(piece.id),member=drill.memberOf.get(piece.id);
    if(label&&label.way&&label.drawn&&member&&member.frame){
      const base=label.mirror?label.twin:label;
      const pairs=new Map(entriesOfPiece(label,piece,member.frame,drill).pairs.map(pair=>[pair.hole,pair]));
      const put=drill.putSaid&&drill.putSaid.get(piece.id);
      // (a drilled piece that no step tells how to put in could go in any way: C16 of the stage 2 review)
      if(!put&&drill.putSaid&&drill.putSaid.size)say('putInPlacesEveryHole',`the ${piece.name} (${label.name}) has holes that meet another piece's and no Put in words`);
      const frames=[member.frame].concat(put?framesOfPlace(member).filter(frame=>frame!==member.frame&&put.say(frame)===put.said):[]);
      const places=new Map(base.views.filter(view=>view.kind!=='mirror').map(view=>[view,viewPlaces(view)]));
      info={label,base,member,pairs,frames,places};
    }
    ofPiece.set(piece.id,info);
    return info;
  };
  // the hole as its drawing prints it: the corner of its place and its offsets from that corner, to 1/16"; and the
  // point in the room where a person who drills by those numbers makes it, for a frame the piece can be put in by
  const printed=hole=>{
    const info=pieceInfo(hole.piece);
    if(!info)return null;
    const pair=info.pairs.get(hole);
    if(!pair)return{missing:true};
    const group=(info.places.get(pair.view)||[]).find(one=>one.entries.includes(pair.entry));
    if(!group)return{missing:true};
    const offset=group.offsets.find(one=>one.entry===pair.entry);
    const h=r16(offset.h),v=r16(offset.v);
    const dirA=group.far.a>=group.corner.a?1:-1,dirB=group.far.b>=group.corner.b?1:-1;
    const view=pair.view;
    // (the corner as the person locates it: from the end and the edge its pencil words measure from)
    const cornerA=group.fromFar?view.length-r16(view.length-group.corner.a):r16(group.corner.a);
    const cornerB=group.fromBottom?view.height-r16(view.height-group.corner.b):r16(group.corner.b);
    const a=cornerA+dirA*h,b=cornerB+dirB*v;
    const points=info.frames.map(frame=>{
      const vf=frameOfView(frame,view.kind,hole.piece),p=hole.at.slice();
      p[vf.lengthAxis]=vf.datumAt+a*Math.sign(vf.along[vf.lengthAxis]);
      p[vf.upAxis]=vf.topAt-b*Math.sign(vf.up[vf.upAxis]);
      return p;
    });
    // the two numbers by the ways of the place (u and v), so the two drawings can be compared whichever way each runs
    const byAxis={};
    byAxis[pair.frame.lengthAxis]=h;byAxis[pair.frame.upAxis]=v;
    // (what the person reads: the Where words of the hole's row give both its numbers, C16 of the stage 2 review)
    const words=placeHoleWords(group,group.offsets,view).holes;
    const sizes=words.match(/\d+ \d+\/\d+"|\d+\/\d+"|\d+"/g)||[];
    const read=[h,v].every(value=>sizes.includes(fmt(value)));
    return{h,v,key:`${fmt(byAxis[hole.place.u])}|${fmt(byAxis[hole.place.v])}`,points,label:info.base.name,read,words};
  };
  // place by place (the joint of two pieces): the holes of each piece as its drawing prints them. The two drawings
  // print the same pairs of numbers (as the rows list them, in either order), and every hole one drawing makes
  // meets a hole the other makes, within 1/64", however each piece is put in as its words allow. (Both drawings may
  // measure the place from different corners of it where its holes read the same from both: two screws in the
  // middle of a cleat, the diagonal pair in the end of a leg.)
  const byLink=new Map();
  for(const hole of drill.holes){
    if(!hole.mate||!hole.place)continue;
    if(!byLink.has(hole.link))byLink.set(hole.link,[]);
    byLink.get(hole.link).push(hole);
  }
  for(const[link,holes]of byLink){
    const pieces=[...new Set(holes.map(hole=>hole.piece))];
    if(pieces.length!==2)continue;
    const sides=pieces.map(piece=>holes.filter(hole=>hole.piece===piece).map(printed));
    if(sides.some(list=>list.some(one=>!one)))continue;
    const f=holes[0].f,name=`the ${pluralName(f.label)} through the ${f.through.name} into the ${f.into.name}`;
    if(sides.some(list=>list.some(one=>one.missing))){say('partDrawingsMeasureTrue',`a hole of ${name} is in no row of its drawing`);continue;}
    const unread=sides.flat().find(one=>!one.read);
    if(unread){say('partDrawingsMeasureTrue',`${name}: drawing ${unread.label} does not print ${fmt(unread.h)} and ${fmt(unread.v)} in its words ("${unread.words}")`);continue;}
    const keys=list=>list.map(one=>one.key).sort().join(' ; ');
    if(keys(sides[0])!==keys(sides[1])){say('partDrawingsMeasureTrue',`${name}: drawing ${sides[0][0].label} prints ${keys(sides[0])}, drawing ${sides[1][0].label} ${keys(sides[1])}`);continue;}
    const k=link.joint.k;
    const apart=(p,q)=>Math.max(...[0,1,2].filter(axis=>axis!==k).map(axis=>Math.abs(p[axis]-q[axis])));
    // every way of putting each piece in: each hole of one side meets a hole of the other
    let worst=0;
    const frames0=Math.max(...sides[0].map(one=>one.points.length)),frames1=Math.max(...sides[1].map(one=>one.points.length));
    for(let i=0;i<frames0;i++)for(let j=0;j<frames1;j++){
      for(const one of sides[0]){
        const p=one.points[i]||one.points[0];
        const nearest=Math.min(...sides[1].map(other=>apart(p,other.points[j]||other.points[0])));
        worst=Math.max(worst,nearest);
      }
    }
    if(worst>PAIR_LINE)say('putInPlacesEveryHole',`${name}: drilled by the two drawings and put in as the steps say, a hole is ${fmt(worst)} out of line with the hole it meets`);
  }
  // a pilot or a dowel hole stays inside its piece; holes of two fasteners in one piece do not meet on a face
  for(const[id,holes]of drill.byPiece){
    for(const hole of holes){
      if(hole.kind!=='pilot'&&hole.kind!=='dowel')continue;
      const k=mainAxis(hole.dir),b=plainBox(hole.piece);
      const room=hole.dir[k]>0?b.hi[k]-hole.at[k]:hole.at[k]-b.lo[k];
      if(hole.depth>room-1/32)say('partDrawingsMeasureTrue',`a ${HOLE_NOUNS[hole.kind]} ${fmt(r16(hole.depth))} deep in the ${hole.piece.name} comes out of its far face (${fmt(r16(room))} of wood)`);
    }
    // (on one face: two round holes closer than their two radii; a pocket hole's oval, POCKET_OVAL each way along its
    //  slant and 3/16" across it, with a round hole's radius around it. Two pocket holes are rule 11's matter.)
    const meet=(a,c)=>{
      const k=mainAxis(a.out),d=[0,1,2].map(axis=>axis===k?0:c.at[axis]-a.at[axis]);
      if(a.kind==='pocket'&&c.kind==='pocket')return false;
      if(a.kind!=='pocket'&&c.kind!=='pocket')return Math.hypot(...d)<roundHoleDia(a)/2+roundHoleDia(c)/2-.01;
      const pocket=a.kind==='pocket'?a:c,round=pocket===a?c:a;
      const slant=pocket.dir.map((v,axis)=>axis===k?0:v),long=Math.hypot(...slant)||1,unit=slant.map(v=>v/long);
      const along=Math.abs(dotOf(d,unit)),across=Math.hypot(...d.map((v,axis)=>v-dotOf(d,unit)*unit[axis])),r=roundHoleDia(round)/2;
      return(along/(POCKET_OVAL+r))**2+(across/(3/16+r))**2<1;
    };
    for(let i=0;i<holes.length;i++)for(let j=i+1;j<holes.length;j++){
      const a=holes[i],c=holes[j];
      if(a.f===c.f||!sameVector(a.out,c.out)||Math.abs(a.at[mainAxis(a.out)]-c.at[mainAxis(a.out)])>.05)continue;
      if(meet(a,c)){say('partDrawingsMeasureTrue',`a ${HOLE_NOUNS[a.kind]} and a ${HOLE_NOUNS[c.kind]} of two fasteners run into each other in the ${a.piece.name}`);break;}
    }
    void id;
  }
  return found;
}
/* Rule 14 (js/fasteners.js): every hole a drawing gives is on a whole sixteenth from the end and the edge it is
   measured from, and from the other end and edge too when the piece is a whole number of sixteenths, so the two
   numbers add up to the size of the piece. Returns what is off, in words. */
const onWholeSixteenth=value=>Math.abs(value*16-Math.round(value*16))<.02;
function offSixteenths(label){
  const found=[];
  for(const view of label.views){
    if(view.kind==='mirror')continue;
    for(const entry of view.holes){
      // what the drawing measures: a pocket hole at an end down from the top edge, one of a row along the piece,
      // a straight hole both ways (its place, js/partdrawings.js, measures from the same sixteenths)
      const atEnd=entry.clamp==='labelled'||entry.clamp==='far',inRow=entry.clamp==='top'||entry.clamp==='bottom';
      const pairs=atEnd?[[entry.b,view.height]]:inRow?[[entry.a,view.length]]:[[entry.a,view.length],[entry.b,view.height]];
      for(const[value,size]of pairs){
        if(!onWholeSixteenth(value)||(onWholeSixteenth(size)&&!onWholeSixteenth(size-value)))
          found.push(`a hole is ${value.toFixed(4)}" from where it is measured on a piece ${fmt(size)} across: not on a whole sixteenth`);
      }
    }
  }
  return found;
}
/* every number and word a drawing of a label gives: its sizes and its table, its notes */
function drawingWords(label,plan){
  const figure=drawingFigure(label,plan);
  return figure.layout.texts.map(text=>text.text).concat(figure.rows.map(row=>row.where+' '+row.many),figure.notes).join(' ');
}
/* check 2 on one figure: sizes, numbers, ovals, settings, and no text over another or over a hole */
function partLayoutProblems(figure,label,drill){
  const found=[],layout=figure.layout;
  const table=figure.rows.map(row=>row.where).join(' ');
  // every view is drawn the size of the face it shows: its length across at the drawing's scale (an end, at its
  // own true shape: the same scale both ways), its height down; the faces and edges of one drawing at one scale
  for(const lay of layout.views){
    const view=lay.view;
    if(Math.abs((lay.x1-lay.x0)-view.length*lay.sx)>1||Math.abs((lay.yBottom-lay.yTop)-view.height*lay.sy)>1)
      found.push(`the ${viewShortName(view)} is not drawn the size of the piece (${fmt(r16(view.length))} by ${fmt(r16(view.height))})`);
    if(isEndView(view)&&Math.abs(lay.sx-lay.sy)>1e-6)found.push(`the ${viewShortName(view)} is stretched: an end is drawn at its true shape`);
    if(!isEndView(view)&&Math.abs(lay.sx-layout.scale)>1e-6)found.push(`the ${viewShortName(view)} is drawn at another scale than the rest of the drawing`);
  }
  for(const dim of layout.dims){
    const lay=layout.views[dim.view],view=lay.view,scale=lay.sx;
    if(dim.text!==fmt(r16(dim.value)))found.push(`the size ${dim.text} is not its value written to 1/16"`);
    if(dim.kind==='place'){
      // a size from the corner of a place (spec 11, 4.4): drawn where it measures, to a hole of that place, and in the table
      const chain=dim.chain,scaleSign=dim.axis==='along'?(lay.datumLeft?1:-1):1;
      const want=dim.axis==='along'?(lay.datumLeft?lay.x0:lay.x1)+scaleSign*(chain.origin+chain.dir*dim.value)*scale:lay.yTop+(chain.origin+chain.dir*dim.value)*lay.sy;
      const at=dim.axis==='along'?dim.x:dim.y;
      if(Math.abs(at-want)>1)found.push(`the size ${dim.text} from the corner of a place is drawn ${Math.abs(at-want).toFixed(1)} px from where it measures`);
      const hole=chain.places.some(place=>place.offsets.some(o=>Math.abs((dim.axis==='along'?o.h:o.v)-dim.value)<=DRILL_SAME));
      if(!hole)found.push(`the size ${dim.text} from the corner of a place measures to no hole`);
      if(!table.includes(dim.text))found.push(`the size ${dim.text} from the corner of a place is not in the table`);
    }else if(dim.kind==='along'){
      const want=lay.datumLeft?lay.x0+dim.value*scale:lay.x1-dim.value*scale;
      if(Math.abs(dim.x-want)>1)found.push(`the size ${dim.text} is drawn ${Math.abs(dim.x-want).toFixed(1)} px from where it measures`);
      const isEnd=Math.abs(dim.value)<1e-6||Math.abs(dim.value-r16(view.length))<1e-6;
      const hole=view.holes.find(entry=>(entry.clamp==='top')===dim.top&&(entry.clamp==='top'||entry.clamp==='bottom')&&Math.abs(r16(entry.a)-dim.value)<1e-6);
      if(!isEnd&&!hole)found.push(`the size ${dim.text} along the piece measures to no hole`);
      if(hole&&Math.abs(hole.a-dim.value)>DRILL_SAME)found.push(`the size ${dim.text} is ${Math.abs(hole.a-dim.value).toFixed(3)}" off its hole`);
      if(!isEnd&&!table.includes(dim.text))found.push(`the size ${dim.text} is not in the table`);
    }else{
      const want=lay.yTop+dim.value*lay.sy;
      if(Math.abs(dim.y-want)>1)found.push(`the size ${dim.text} down from the top edge is drawn ${Math.abs(dim.y-want).toFixed(1)} px from where it measures`);
      const hole=view.holes.find(entry=>(entry.clamp==='labelled'||entry.clamp==='far')&&Math.abs(r16(entry.b)-dim.value)<1e-6);
      if(dim.value>1e-6&&!hole)found.push(`the size ${dim.text} down from the top edge measures to no hole`);
      if(dim.value>1e-6&&!table.includes(dim.text))found.push(`the size ${dim.text} is not in the table`);
    }
    // its number at its own tick (slid aside a little at most)
    const box=dim.entry.box,middle=dim.kind==='along'?box.x+box.w/2:box.y+box.h/2,at=dim.kind==='along'?dim.x:dim.y;
    if(Math.abs(middle-at)>40)found.push(`the number ${dim.text} is ${Math.round(Math.abs(middle-at))} px from its tick`);
  }
  for(const mark of layout.holes){
    const hole=mark.entry.hole,setup=drill.setups.find(one=>one.no===hole.setup),scale=layout.views[mark.view].sx;
    if(!setup||!setup.holes.includes(hole))found.push('a hole is tagged with a setting that is not its own');
    if(mark.round){
      // a hole a bit makes: a circle the size of its bit (or of its counterbore), drawn where the hole is
      const want=Math.max(hole.kind==='pilot'?2.5:3.5,roundHoleDia(hole)/2*scale);
      if(Math.abs(mark.r-want)>.01)found.push(`a ${HOLE_NOUNS[hole.kind]} is not drawn the size of its bit`);
      continue;
    }
    if(Math.abs(mark.rx-Math.max(6,POCKET_OVAL*scale))>.01)found.push('a pocket hole is not drawn as long as the oval the bit leaves');
    if(setup&&Math.abs(setup.jig-hole.jig)>1e-6)found.push('a pocket hole is tagged with a jig setting that is not its own');
  }
  // a hole a bit makes is drawn where it is, from the end with the label and the top edge of its view
  for(const mark of layout.holes){
    const lay=layout.views[mark.view],entry=mark.entry,scale=lay.sx;
    const x=lay.datumLeft?lay.x0+entry.a*scale:lay.x1-entry.a*scale,y=lay.yTop+entry.b*lay.sy;
    if(Math.abs(mark.cx-x)>1||Math.abs(mark.cy-y)>1)found.push(`a ${HOLE_NOUNS[entry.hole.kind]} is drawn ${Math.hypot(mark.cx-x,mark.cy-y).toFixed(1)} px from where it is`);
  }
  for(const row of figure.rows){
    const setup=drill.setups.find(one=>one.no===row.tag);
    if(!setup||row.row.holes.some(entry=>!setup.holes.includes(entry.hole)))found.push(`the table gives setting ${row.tag} for holes of another`);
    else if(setup.kind==='jig'&&!row.setting.includes(fmt(setup.jig)+' stock'))found.push(`the table gives setting ${row.tag} without its stock`);
    else if(setup.kind==='bit'){
      const bit={counterbore:DRILL_BITS.counterbore.name,countersink:DRILL_BITS.clearance.name,pilot:DRILL_BITS[pilotBitKey()].name,dowel:`${fmt(setup.dia||0)} bit`}[setup.bit];
      if(!row.setting.includes(bit))found.push(`the table gives bit ${row.tag} without its size (${bit})`);
    }
  }
  // a dashed piece is drawn where that piece meets this face in the model: its ends along the piece and its edges
  // across it, measured from the end with the label and the top edge (worked out here from the two boxes)
  for(const item of layout.items){
    if(item.type!=='rect'||item.cls!=='hid'||!item.other)continue;
    const lay=layout.views[item.view],view=lay.view,frame=view.frame,scale=lay.sx;
    const mine=plainBox(view.piece),theirs=plainBox(item.other.piece);
    const span=k=>[Math.max(mine.lo[k],theirs.lo[k]),Math.min(mine.hi[k],theirs.hi[k])];
    const[aLo,aHi]=span(frame.lengthAxis).map(v=>(v-frame.datumAt)*Math.sign(frame.along[frame.lengthAxis])).sort((x,y)=>x-y);
    const[bLo,bHi]=span(frame.upAxis).map(v=>(frame.topAt-v)*Math.sign(frame.up[frame.upAxis])).sort((x,y)=>x-y);
    const x=lay.datumLeft?lay.x0+aLo*scale:lay.x1-aHi*scale,y=lay.yTop+bLo*lay.sy;
    if(Math.abs(item.x-x)>1||Math.abs(item.w-(aHi-aLo)*scale)>1||Math.abs(item.y-y)>1||Math.abs(item.h-(bHi-bLo)*lay.sy)>1)
      found.push(`the dashed ${item.other.piece.name} is not drawn where it meets this face (${fmt(r16(aLo))} to ${fmt(r16(aHi))} along, ${fmt(r16(bLo))} to ${fmt(r16(bHi))} down from the top edge)`);
    // the note says where to pencil it, with the sizes that place it (its edges when it runs the whole length)
    const notes=figure.allNotes.join(' ');
    const needed=item.other.wholeLength?[bLo,bHi]:item.other.wholeWidth?[aLo,aHi]:[aLo,aHi,bLo,bHi];
    const missing=needed.find(v=>!notes.includes(`${fmt(r16(v))} `));
    if(missing!==undefined)found.push(`the note does not say where to pencil the ${item.other.piece.name} (${fmt(r16(missing))} is missing)`);
  }
  const texts=layout.texts;
  for(let i=0;i<texts.length;i++){
    const a=texts[i].box;
    if(a.x<0||a.y<0||a.x+a.w>layout.width+.5||a.y+a.h>layout.height+.5)found.push(`"${texts[i].text}" is outside the picture`);
    for(let j=i+1;j<texts.length;j++)if(boxesOverlap(a,texts[j].box,0))found.push(`"${texts[i].text}" is written over "${texts[j].text}"`);
    if(texts[i].role!=='title'&&layout.holes.some(mark=>boxesOverlap(a,mark.box,0)))found.push(`"${texts[i].text}" is written over a hole`);
  }
  // a leader runs through no text but its own (segmentHitsRect, js/markingview.js)
  for(const item of layout.items){
    if(item.type!=='leader')continue;
    const own=box=>item.x1>=box.x-16&&item.x1<=box.x+box.w+16&&item.y1>=box.y-16&&item.y1<=box.y+box.h+16;
    const crossed=texts.find(text=>!own(text.box)&&segmentHitsRect([item.x1,item.y1],[item.x2,item.y2],text.box,0));
    if(crossed)found.push(`a leader runs through "${crossed.text}"`);
  }
  // no two leaders cross (a reader follows the wrong one to the wrong place)
  const leaderLines=layout.items.filter(item=>item.type==='leader').map(item=>[[item.x1,item.y1],[item.x2,item.y2]]);
  for(let i=0;i<leaderLines.length;i++)for(let j=i+1;j<leaderLines.length;j++)if(segmentsCross(leaderLines[i],leaderLines[j]))found.push('two leaders cross');
  return found;
}
for(const name of DRILL_CHECKS){
  SELFTESTS.push({[name](problems){
    // the first of the five makes the pass, the others read it
    if(name===DRILL_CHECKS[0]||!drillCheckFound)drillCheckFound=drillCheckPass();
    for(const text of drillCheckFound[name])problems.push('drill your pieces: '+text);
    if(name===DRILL_CHECKS[0]){
      const counts=drillCheckFound.counts;
      // (measured when this check was written: see README, "Drill your pieces")
      if(counts.designs<150||counts.holes<4000||counts.drawings<350)problems.push(`drill your pieces: only ${counts.designs} designs, ${counts.holes} holes and ${counts.drawings} drawings were checked: the check found too few`);
    }
  }}[name]);
}
/* Carry-over 11: PRESET_PRINTS (js/shapes.js) pins how many fasteners each preset lays out, not where. So the places
   of the holes step 2 drills are pinned here too: for every preset at its usual sizes in each style, a hash of every
   hole (its kind, the piece, where it opens in that piece's own terms to 1/16", the face). A change that moves a
   hole, adds one or drops one shows here. When a preset is changed on purpose, record its line again (drillPrintOf
   below, from an empty design, twice the same) and say why in the commit. Recorded on branch drill2 (stage 2), and
   again in all three styles after its review (twice the same): in Everyday only the Platform bed moved on purpose (a
   plugged rail screw's holes now on the screw, R1) and the Fish tank wall / rack, Garage shelves, Raised garden bed
   and Computer desk (a staggered pair no longer flipped up and down by the middle of the design, R9).
   Recorded again when branch fishtop was merged with main (the fish countertop, the owner's "no need to see [the
   screws]"), the three fish presets only, in all three styles, twice the same: in Everyday and Fine their tops are
   held from underneath by pocket screws in the rails and cross pieces, so the clearance holes down through the top
   deck and the screws through it into the post tops are gone; the two cabinet stands' top is the 3/4" Countertop
   (Rustic screws it down, so its holes are on the Countertop, and the rack's top deck is named Top deck); the frames
   in sight are held from inside. Every other preset reads back as main recorded it. */
const DRILL_PRINTS_RECORDED={
  "Fish tank wall / rack":{"std":[570,"1si7anw"],"fine":[404,"s8o11m"],"rustic":[632,"f39hn3"]},          // recorded again at the fishtop merge
  "Single aquarium stand":{"std":[160,"1h0o42o"],"fine":[144,"1y2nfu0"],"rustic":[208,"b1o0ge"]},         // recorded again at the fishtop merge
  "Cabinet stand with a row of tanks":{"std":[218,"1lfya"],"fine":[202,"wmnv36"],"rustic":[304,"hivzkd"]},  // recorded again at the fishtop merge
  "Platform bed":{"std":[272,"1cemwt2"],"fine":[246,"1fihgop"],"rustic":[284,"172jgbs"]},
  "Shed":{"std":[0,"ztntfp"],"fine":[0,"ztntfp"],"rustic":[0,"ztntfp"]},
  "Bird feeder":{"std":[32,"15p3vv0"],"fine":[20,"150qkn8"],"rustic":[32,"15p3vv0"]},
  "Bookshelf":{"std":[50,"sd54cb"],"fine":[50,"sd54cb"],"rustic":[88,"1chbdza"]},
  "Dining table":{"std":[60,"17rhid5"],"fine":[60,"17rhid5"],"rustic":[104,"ub9joa"]},
  "Coffee table":{"std":[94,"1j5fax8"],"fine":[94,"1j5fax8"],"rustic":[212,"1nav7ow"]},
  "Side table / nightstand":{"std":[26,"f21k6n"],"fine":[26,"f21k6n"],"rustic":[72,"1lzhhcy"]},
  "Desk":{"std":[44,"13uisfz"],"fine":[44,"13uisfz"],"rustic":[58,"1r6xfhr"]},
  "Sturdy bench":{"std":[34,"polw3n"],"fine":[50,"1l34yvf"],"rustic":[60,"do00qc"]},
  "Five-board bench":{"std":[20,"3qi8d8"],"fine":[20,"3qi8d8"],"rustic":[44,"krwp0d"]},
  "Workbench":{"std":[198,"1tzl7wr"],"fine":[130,"1o7s03l"],"rustic":[166,"lgq7fn"]},
  "Garage shelves":{"std":[388,"iavqmk"],"fine":[244,"10asvl8"],"rustic":[388,"iavqmk"]},
  "Storage box / toy chest":{"std":[28,"1t5nm5p"],"fine":[28,"1t5nm5p"],"rustic":[40,"tiv8do"]},
  "Planter box":{"std":[156,"10rcc5o"],"fine":[118,"4elxkx"],"rustic":[156,"10rcc5o"]},
  "Raised garden bed":{"std":[96,"6jc24k"],"fine":[80,"f1z4eg"],"rustic":[96,"6jc24k"]},
  "Entryway shoe bench":{"std":[94,"d0vlq1"],"fine":[94,"d0vlq1"],"rustic":[212,"1q9nm0w"]},
  "Base cabinet with doors":{"std":[76,"1ksg96i"],"fine":[67,"1gg7b1s"],"rustic":[104,"8b0z50"]},
  "Wall shelf":{"std":[18,"19l6c3g"],"fine":[14,"1qmxroo"],"rustic":[26,"yhhtnb"]},
  "Nightstand with drawers":{"std":[47,"vzyj6o"],"fine":[47,"vzyj6o"],"rustic":[66,"3h6xy9"]},
  "Computer desk":{"std":[105,"9r21s5"],"fine":[105,"9r21s5"],"rustic":[152,"vpdk9n"]},
  "Dining chair":{"std":[62,"179c6o7"],"fine":[62,"179c6o7"],"rustic":[64,"1uox7wm"]},
  "Cabinet / case":{"std":[58,"1addffs"],"fine":[58,"1addffs"],"rustic":[88,"1kqy00"]},
};
/* (C3 of the stage 2 review: in all three styles, since the holes a bit makes live mostly in Rustic (wood screws)
   and Fine (dowels, plugs). drillPrintsNow() gives the whole table as it is now, to paste when lines are recorded
   again on purpose.) */
const DRILL_PRINT_STYLES=['std','fine','rustic'];
function drillPrintsNow(){
  const kept=JSON.stringify(S),table={};
  try{withoutDrawing(()=>{for(const preset of PRESETS){table[preset.name]={};for(const style of DRILL_PRINT_STYLES)table[preset.name][style]=drillPrintOf(preset,style);}});}finally{load(kept,true);}
  return JSON.stringify(table).replace(/\],"/g,'],"').replace(/\},"/g,'},\n  "');
}
function drillPrintOf(preset,style){
  load(JSON.stringify(blank()),true);
  placeInStyle(preset,presetDefaults(preset),style||'std');
  const drill=buildPlan(true).drill;
  const lines=drill.holes.map(hole=>{
    const local=toLocalPoint(hole.piece,hole.at).map(v=>r16(v)),out=toLocalVector(hole.piece,hole.out).map(v=>Math.round(v));
    return[hole.kind,hole.piece.name,local.join(','),out.join(','),r16(hole.depth||0)].join('|');
  }).sort();
  return[drill.holes.length,printHash(lines.join(';'))];
}
SELFTESTS.push(function drillHolesStayWhereTheyWere(problems){
  const kept=JSON.stringify(S);
  try{withoutDrawing(()=>{
    for(const preset of PRESETS){
      const recorded=DRILL_PRINTS_RECORDED[preset.name];
      for(const style of DRILL_PRINT_STYLES){
        const want=recorded&&recorded[style];
        if(!want){problems.push(`drill your pieces: ${preset.name} (${STYLES[style][0]}) has no recorded hole places (DRILL_PRINTS_RECORDED, js/partdrawings.js)`);continue;}
        let got=drillPrintOf(preset,style);
        // (a second look, as presetsKeepTheirCutLists takes one: the very first pass of a fresh page can lay one
        //  joint out differently; a print that differs twice is a real change)
        if(got[0]!==want[0]||got[1]!==want[1])got=drillPrintOf(preset,style);
        if(got[0]!==want[0]||got[1]!==want[1])problems.push(`drill your pieces: ${preset.name} (${STYLES[style][0]}) drills other holes than recorded (${got.join(', ')}, was ${want.join(', ')})`);
      }
    }
  });}finally{load(kept,true);}
});
/* The Done ticks belong to their design (R11 and C12 of the stage 2 review): a box ticked gives the design its
   number and the undo history keeps it (an Undo of an earlier edit keeps the ticks); a design made in its place
   from the presets starts without it, so it never shows the ticks of the design before. */
SELFTESTS.push(function doneTicksBelongToTheirDesign(problems){
  const kept=JSON.stringify(S),keptUndo=undoStack.slice(),keptRedo=redoStack.slice();
  const wrong=text=>problems.push('drill your pieces: '+text);
  const figure=document.createElement('figure');
  try{
    withoutDrawing(()=>{
      const desk=PRESETS.find(candidate=>candidate.name==='Desk');
      load(JSON.stringify(blank()),true);undoStack=[];redoStack=[];
      placePreset(desk,presetDefaults(desk),desk.build(presetDefaults(desk)),false);commit();
      S.parts[0].pos=[S.parts[0].pos[0]+1,S.parts[0].pos[1],S.parts[0].pos[2]];commit();   // an edit, to undo
      // a Done box ticked (the page's own handler)
      figure.className='drill-fig';figure.style.display='none';
      figure.innerHTML=`<input type="checkbox" data-done-key="woodshop.drillDone.selftest.${Date.now()}">`;
      document.body.appendChild(figure);
      const box=figure.querySelector('input');
      box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));
      try{localStorage.removeItem(box.dataset.doneKey);}catch(e){}
      const id=S.drillId;
      if(!id)wrong('a ticked Done box gives the design no number of its own');
      undo();
      if(S.drillId!==id)wrong('an Undo after a Done box was ticked loses the design\'s number, and with it the ticks');
      placePreset(desk,presetDefaults(desk),desk.build(presetDefaults(desk)),false);commit();
      if(S.drillId)wrong('a design made again from the presets keeps the Done ticks of the design before');
    });
  }finally{figure.remove();load(kept,true);undoStack=keptUndo;redoStack=keptRedo;}
});
/* 5, the old files: a design saved before step 2 opened today tells nobody to drill a hole step 2 holds */
SELFTESTS.push(function oldFilesDrillNothingTwice(problems){
  const keepSay=sayFasteningUpgrade;
  sayFasteningUpgrade=()=>{};
  try{withoutDrawing(()=>{
    for(const[name,project]of[['Desk',OLD_PROJECTS.desk],['Bookshelf',{...OLD_PROJECTS.bookshelf,...OLD_WORDS.bookshelf}],['Platform bed',{...OLD_PROJECTS.bed,...OLD_WORDS.bed}],['toy chest',OLD_PROJECTS.toychest]]){
      load(JSON.stringify(project),true);
      const plan=buildPlan(true);
      for(const step of plan.steps){
        const pockets=step.groups.filter(group=>group.type==='pocket');
        if(!pockets.length||!pockets.every(group=>group.predrilled))continue;
        const orders=drillOrders(step.words);
        if(orders.length){problems.push(`drill your pieces: the old ${name} opened today still says in step ${step.no}: "${orders[0].trim().slice(0,90)}"`);break;}
      }
    }
    // (C11 of the stage 2 review) designs saved as stage 1 saved them (fastened by rule 5, their steps' drill
    // fields holding only the pocket-hole sentences), opened today: no step tells to drill a dowel hole, a
    // clearance hole, a counterbore or a pilot hole step 2 holds, nor to mark again what step 2 pencils on
    for(const[name,style]of[['Desk','rustic'],['Desk','std'],['Sturdy bench','fine'],['Computer desk','std']]){
      const preset=PRESETS.find(candidate=>candidate.name===name);
      if(!preset)continue;
      placeInStyle(preset,presetDefaults(preset),style);
      const old=JSON.parse(JSON.stringify(S));
      old.fastening=5;
      for(const step of old.steps||[]){
        if(!step||!step.drill)continue;
        const strings=list=>(Array.isArray(list)?list:[list]).filter(one=>typeof one==='string');
        step.drill=Array.isArray(step.drill)||typeof step.drill==='string'?strings(step.drill)
          :Object.fromEntries(Object.entries(step.drill).map(([key,list])=>[key,strings(list)]));
      }
      load(JSON.stringify(old),true);
      const plan=buildPlan(true),drill=plan.drill,at=`the ${name} (${STYLES[style][0]}) saved by stage 1, opened today`;
      for(const step of plan.steps){
        if(step.kind==='drill'||step.no<=2)continue;
        const held=drillWordsHeld(drill,step.groups);
        const bore=boreOrders(step.words).find(one=>held[one.kind]);
        if(bore){problems.push(`drill your pieces: ${at}, still says in step ${step.no}: "${bore.sentence.trim().slice(0,90)}"`);break;}
        const screws=step.groups.filter(group=>(group.type==='screw'||group.type==='plug')&&group.predrilled);
        const pilots=screws.length&&screws.length===step.groups.filter(group=>group.type==='screw'||group.type==='plug').length?pilotOrders(step.words):[];
        if(pilots.length){problems.push(`drill your pieces: ${at}, still says in step ${step.no}: "${pilots[0].trim().slice(0,90)}"`);break;}
        if(/Mark those places on both aprons first/.test(step.words)&&piecesPencilledOn(drill).has('Cross rail')){problems.push(`drill your pieces: ${at}, still asks in step ${step.no} to mark the rail places step 2 pencils on`);break;}
      }
    }
  });}finally{sayFasteningUpgrade=keepSay;}
});
/* 6. the same design built twice, moved and turned gives the same labels and drawings */
function drillSummary(){
  const drill=buildPlan(true).drill;
  return drill.labels.map(label=>`${label.name}:${label.members.length}x${label.holesEach}:`+label.views.map(view=>view.holes.map(entry=>[r16(entry.a),r16(entry.b),entry.setup,entry.clamp].join('/')).join(' ')).join('|')).join(' ; ');
}
/* Two boards of one letter, the second set in the room by a turn of the first (or by a turn and a reflection end for
   end), carrying its holes with it: the turn must be drilled alike, the reflection must be a mirror pair, whichever
   way each board lies (on edge, flat, along X or along Z: the order of its axes is even for some and odd for others,
   and a left-handed frame turns one into the other). */
function handednessProblems(){
  const found=[];
  const sample={id:-901,name:'Rail',mat:'1x4',l:10,w:3.5,t:.75,ax:[0,1,2],pos:[0,0,0]};
  // two holes, one near an end and one off the middle: no symmetry of their own
  const holes=[{at:[2,1,.75],out:[0,0,1],dir:[-1,0,0],setup:1},{at:[5,1.4,.75],out:[0,0,1],dir:[0,1,0],setup:1}];
  // turns of the room (a matrix as rows), and where the turned board then lies
  const turns=[
    {name:'on edge, the same way',rows:[[1,0,0],[0,1,0],[0,0,1]]},
    {name:'lying flat',rows:[[1,0,0],[0,0,-1],[0,1,0]]},
    {name:'along Z',rows:[[0,0,1],[0,1,0],[-1,0,0]]},
    {name:'along Z, lying flat',rows:[[0,1,0],[0,0,1],[1,0,0]]},
  ];
  const apply=(rows,v)=>rows.map(row=>row[0]*v[0]+row[1]*v[1]+row[2]*v[2]);
  const mirror=h=>({...h,at:[10-h.at[0],h.at[1],h.at[2]],out:[-h.out[0],h.out[1],h.out[2]],dir:[-h.dir[0],h.dir[1],h.dir[2]]});
  for(const turn of turns){
    for(const mirrored of[false,true]){
      // the board's corners and holes carried by the turn, then moved clear of the first board
      const corners=[[0,0,0],[10,3.5,.75]].map(p=>apply(turn.rows,p)),lo=[0,1,2].map(k=>Math.min(corners[0][k],corners[1][k]));
      const shift=p=>p.map((v,k)=>v-lo[k]+(k===0?20:0));
      const ax=[0,1,2].map(i=>mainAxis(apply(turn.rows,axisVector(i,1))));
      const other={id:-902,name:'Rail',mat:'1x4',l:10,w:3.5,t:.75,ax,pos:shift(lo)};
      const moved=(mirrored?holes.map(mirror):holes).map(h=>({...h,at:shift(apply(turn.rows,h.at)),out:apply(turn.rows,h.out),dir:apply(turn.rows,h.dir)}));
      const labels=labelPieces('Z',[sample,other],{byPiece:new Map([[sample.id,holes],[other.id,moved]])});
      const said=labels.map(label=>label.name+(label.mirror?' (mirror)':'')).join(', ');
      if(!mirrored&&!(labels.length===1&&labels[0].members.length===2))found.push(`a board turned ${turn.name} is labelled ${said}, not drilled alike`);
      if(mirrored&&!(labels.length===2&&labels[1].mirror))found.push(`a mirror image of a board, ${turn.name}, is labelled ${said}, not a mirror pair`);
      for(const label of labels)for(const member of label.members)if(datumOnLeft(member.frame)===!!label.mirror)found.push(`a board ${turn.name}${mirrored?', mirrored':''} has its end with the label on the wrong side of its drawing`);
    }
  }
  return found;
}
SELFTESTS.push(function labelsAreStable(problems){
  const wrong=text=>problems.push('drill your pieces: '+text);
  for(const text of handednessProblems())wrong(text);
  withoutDrawing(()=>{
    for(const name of['Desk','Bookshelf','Nightstand with drawers','Coffee table']){
      const preset=PRESETS.find(candidate=>candidate.name===name);
      if(!preset)continue;
      placeInStyle(preset,presetDefaults(preset),'std');
      const first=drillSummary();
      placeInStyle(preset,presetDefaults(preset),'std');
      if(drillSummary()!==first)wrong(`${name} built twice gives other labels or drawings`);
      // moved as a whole
      for(const p of S.parts)p.pos=[p.pos[0]+13.25,p.pos[1],p.pos[2]-7.5];
      commit();
      if(drillSummary()!==first)wrong(`${name} moved as a whole gives other labels or drawings`);
      // turned as a whole with Rotate (a turned set, worked out standing square: squaredUp, js/neighbors.js)
      sel=new Set([S.parts.find(p=>!isProp(p)&&!tilted(p)).id]);
      applyRot(snapshot(),1,30*Math.PI/180,selCenter());finishRot();commit();
      sel=new Set();
      if(drillSummary()!==first)wrong(`${name} turned 30 degrees as a whole gives other labels or drawings`);
      // the pieces of one label map onto each other by a turn, a mirror pair by a reflection and by no turn
      const drill=buildPlan(true).drill;
      for(const label of drill.labels){
        if(!label.way)continue;
        for(const member of label.members){
          if(member.sym.det!==(label.mirror?-1:1))wrong(`${name}: a piece of ${label.name} is not carried onto its drawing by a ${label.mirror?'reflection':'turn'}`);
          if(label.mirror&&symmetryBetween(pieceDims(member.piece),localPattern(member.piece,drill.byPiece.get(member.piece.id)),label.way.pattern,1))wrong(`${name}: ${label.name} is called a mirror image, yet a turn makes it ${label.twin.name}`);
        }
      }
    }
  });
});
/* 7. step 2 stays short: the Desk as the spec counts it; the Shed and a Rustic desk have none; the Bookshelf 40" wide few labels */
SELFTESTS.push(function drillStepStaysShort(problems){
  const wrong=text=>problems.push('drill your pieces: '+text);
  withoutDrawing(()=>{
    const desk=PRESETS.find(candidate=>candidate.name==='Desk');
    placeInStyle(desk,presetDefaults(desk),'std');
    let plan=buildPlan(true),drill=plan.drill;
    const names=drill.labels.map(label=>label.name).join(',');
    if(names!=='A,B,C')wrong(`the Desk is labelled ${names}, not A, B and C (the two long aprons drilled alike)`);
    if(drill.setups.length!==2||drill.total!==44)wrong(`the Desk has ${drill.setups.length} settings and ${drill.total} holes, not 2 and 44`);
    if(drill.nothing.map(entry=>entry.name).join(',')!=='D,E')wrong(`the Desk has ${drill.nothing.map(entry=>entry.name).join(', ')} on the Nothing line, not D and E`);
    if(!plan.steps[1]||plan.steps[1].kind!=='drill')wrong('the Desk has no step 2 "Drill your pieces"');
    // Build step by step shows no drawings: its words must not point to drawings "below"
    else{
      const mode=drillModeHtml(plan.steps[1],plan);
      if(/below/.test(mode)||!/Build instructions page, step 2/.test(mode))wrong('Build step by step, step 2, points to drawings it does not show: '+mode.replace(/<[^>]+>/g,' ').slice(0,160));
    }
    // (stage 2: the Rustic Desk is held by wood screws, so it has a step 2 too: no pocket-hole jig, a few drawings
    //  a beginner can follow, the structural screws named as needing no hole)
    look().style='rustic';commit();
    plan=buildPlan(true);
    const rustic=plan.steps.find(step=>step.kind==='drill');
    if(!rustic)wrong('the Desk in Rustic / rough has no step "Drill your pieces" for its wood screws');
    else{
      const drill=plan.drill,drawn=drill.labels.filter(label=>!label.mirror);
      if(drill.setups.some(setup=>setup.kind==='jig'))wrong('the Desk in Rustic / rough asks for the pocket-hole jig');
      if(drawn.length>6)wrong(`the Desk in Rustic / rough has ${drawn.length} drawings`);
      const html=drillStepHtml(rustic,plan);
      if(!/Structural screws need no hole/.test(html))wrong('the Desk in Rustic / rough does not say its structural screws need no hole');
      if(!html.includes(BEFORE_PAIRS))wrong('the Desk in Rustic / rough does not say how holes that meet are measured (Before you drill, line 4)');
      if(!/painter's tape/.test(html))wrong('the Desk in Rustic / rough does not put the label of its top on painter\'s tape');
    }
    const shed=PRESETS.find(candidate=>candidate.name==='Shed');
    if(shed){
      placeInStyle(shed,presetDefaults(shed),'std');
      if(buildPlan(true).steps.some(step=>step.kind==='drill'))wrong('the Shed has a step "Drill your pieces"');
      if(/Drill first/.test(cutListSection(cutRows())))wrong('the Shed has a Drill first column');
    }
    const shelf=PRESETS.find(candidate=>candidate.name==='Bookshelf');
    if(shelf){
      placeInStyle(shelf,{...presetDefaults(shelf),W:40},'std');
      // (drawings: a mirror image shares its twin's; stage 2 adds the screws of the toe kick and the shelves, which
      //  split two letters into mirror pairs and alike pieces)
      const drawings=buildPlan(true).drill.labels.filter(label=>!label.mirror).length;
      if(drawings>6)wrong(`the Bookshelf 40" wide has ${drawings} drawings`);
    }
  });
});
/* 8. step 2 follows edits: a wider Desk, a piece deleted, a board added by hand with pocket screws, a design drawn from scratch */
SELFTESTS.push(function drillPlanFollowsEdits(problems){
  const wrong=text=>problems.push('drill your pieces: '+text);
  const continuous=label=>{const plan=buildPlan(true);if(plan.steps.some((step,index)=>step.no!==index+1))wrong(`${label}: the step numbers are not continuous`);return plan;};
  const columnSays=()=>cutListSection(cutRows());
  withoutDrawing(()=>{
    const desk=PRESETS.find(candidate=>candidate.name==='Desk');
    // one long apron screwed instead of pocket-screwed: its letter is drilled one way and has one piece with nothing
    placeInStyle(desk,presetDefaults(desk),'std');
    const screwed=S.parts.find(p=>p.name==='Long apron');
    for(const j of findJoints())if(j.a.id===screwed.id||j.b.id===screwed.id)S.joints[j.key]='screw';
    commit();
    {
      const drill=buildPlan(true).drill,letter=drill.labelOf(screwed).replace(/\d+$/,'');
      const row=cutRows().rows.find(one=>one.id===letter),text=row?drillColumn(row,drill):'';
      const names=drill.labels.filter(label=>label.letter===letter).map(label=>label.name).concat(drill.nothing.filter(entry=>entry.letter===letter&&entry.label).map(entry=>entry.name));
      if(names.length<2||names.some(name=>!new RegExp(`\\b${name}\\b`).test(text)))wrong(`a Desk with one long apron screwed: the Drill first column of ${letter} says "${text}", not each of ${names.join(', ')}`);
    }
    placeInStyle(desk,{...presetDefaults(desk),L:60},'std');
    let plan=continuous('the Desk 60" wide');
    const rails=S.parts.filter(p=>p.name==='Cross rail').length;
    if(rails<2)wrong('the Desk 60" wide has fewer than two cross rails to check');
    const before=plan.drill.total;
    if(!plan.drill.labels.some(label=>label.way&&label.way.sample.name==='Cross rail'))wrong('the cross rails of a 60" Desk have no drawing');
    // a short apron deleted
    const apron=S.parts.find(p=>p.name==='Short apron'),apronHoles=plan.drill.holesOfPiece(apron).length;
    S.parts=S.parts.filter(p=>p!==apron);
    commit();
    plan=continuous('the Desk with a short apron deleted');
    if(!apronHoles||plan.drill.total!==before-apronHoles)wrong(`deleting a short apron (${apronHoles} holes) left ${plan.drill.total} holes of ${before}`);
    if(!/Drill first/.test(columnSays()))wrong('the cut list has no Drill first column after an edit');
    // a 2x4 added by hand under the top, between the long aprons, joined with pocket screws
    const aprons=S.parts.filter(p=>p.name==='Long apron').map(plainBox);
    const zLow=Math.min(aprons[0].hi[2],aprons[1].hi[2]),zHigh=Math.max(aprons[0].lo[2],aprons[1].lo[2]);
    const[braceId]=addParts([mk('Brace','2x4',[1.5,3.5,zHigh-zLow],[aprons[0].lo[0]+12,aprons[0].lo[1],zLow])]);
    for(const j of findJoints())if(j.a.id===braceId||j.b.id===braceId)S.joints[j.key]='pocket';
    commit();
    plan=continuous('the Desk with a brace added by hand');
    if(!plan.drill.holesOfPiece(byId(braceId)).length)wrong('a 2x4 added by hand with pocket screws has no holes in step 2');
    else if(!plan.drill.labels.some(label=>label.members.some(member=>member.piece.id===braceId)))wrong('a 2x4 added by hand with pocket screws has no drawing');
    const braceStep=plan.steps[plan.stepOfPiece.get(braceId)];
    if(!braceStep||!braceStep.groups.some(group=>group.predrilled)||!/^Put in: /.test(braceStep.put||''))wrong('the step of a board added by hand does not point to its drawing or say how it is put in');
    // a design drawn from scratch: two boards joined with pocket screws
    load(JSON.stringify(blank()),true);
    const ids=addParts([mk('Side','1x4',[.75,24,3.5],[0,0,0]),mk('Shelf','1x4',[18,.75,3.5],[.75,10,0])]);
    for(const j of findJoints())S.joints[j.key]='pocket';
    commit();
    plan=continuous('two boards drawn by hand');
    if(!plan.drill.total||!plan.steps.some(step=>step.kind==='drill'))wrong('two boards drawn by hand and joined with pocket screws get no step "Drill your pieces"');
    else if(!plan.drill.holesOfPiece(byId(ids[1])).length)wrong('the board drawn by hand that takes the pocket holes has none on its drawing');
    if(!/Drill first/.test(columnSays()))wrong('a design drawn by hand with pocket holes has no Drill first column');
    // (stage 2) the same two boards joined with plain wood screws, then with dowels: both pieces get their holes
    for(const[type,kinds]of[['screw',['clear','pilot']],['dowel',['dowel']]]){
      for(const j of findJoints())S.joints[j.key]=type;
      commit();
      plan=continuous(`two boards drawn by hand, joined with ${type}s`);
      const got=new Set(plan.drill.holes.map(hole=>hole.kind)),pieces=new Set(plan.drill.holes.map(hole=>hole.piece.id));
      if(!plan.steps.some(step=>step.kind==='drill')||kinds.some(kind=>!got.has(kind))||pieces.size!==2)
        wrong(`two boards drawn by hand and joined with ${type}s get ${[...got].join(', ')||'no holes'} in ${pieces.size} pieces in step 2, not ${kinds.join(' and ')} in both`);
      else if(plan.drill.labels.filter(label=>!label.mirror).length<2)wrong(`two boards joined with ${type}s do not get a drawing each`);
      if(pairProblems(plan.drill).length)wrong(`two boards joined with ${type}s: ${pairProblems(plan.drill)[0].text}`);
    }
    // a size changed: the drawings follow (the Desk 6" longer moves the holes of its long aprons and its top)
    placeInStyle(desk,presetDefaults(desk),'rustic');
    const before2=drillSummary();
    placeInStyle(desk,{...presetDefaults(desk),L:presetDefaults(desk).L+6},'rustic');
    if(drillSummary()===before2)wrong('the Rustic Desk made 6" longer gives the same drawings');
    const longer=buildPlan(true);
    if(pairProblems(longer.drill).length)wrong(`the Rustic Desk made 6" longer: ${pairProblems(longer.drill)[0].text}`);
  });
});
