/* NominalCAD: the marking views of the close-ups, drawn like a shop drawing.

   A close-up of a joint is two pictures (js/steppictures.js): a 3D view that shows HOW the fastener goes in
   (through this piece, into that one), and this flat MARKING VIEW, which shows WHERE: the face a person marks,
   drills or nails on, seen square on, so every size on it is drawn at its true length. It is drawn in 2D from the
   model alone, with no 3D render, which is why it is quick and why the self-check can measure it.

   The conventions (the ones of a US shop drawing):
     - the view is square to the face, so a size is never foreshortened; the scale is the same both ways
     - every size has two extension lines that come off what it measures (an edge of a piece, the middle of a
       fastener), with a small gap at the object, and run a little past the dimension line; the dimension line
       runs between them, outside the outline of the piece, with a slash tick at each end; the number sits on
       its own line, centered above it (beside it for an upright line), or outside with a leader when it does
       not fit
     - sizes along one row are a chain on one line, starting at the edge they are measured from; equal
       spacings are written once with the count ("3 spaces at 4 5/8""); sizes that are all measured from one
       edge (two heights from the bottom end) are stacked, the shortest nearest the piece
     - the edge or end a size is measured from is drawn heavy and named on the picture ("top end of Back panel
       (H)"); left, right, top and bottom are as the view is drawn, and the view says how it is seen
     - what is behind the face (the rail the nails go into) is dashed, with a dash-dot line through its middle
       when the row is on its middle; every fastener is a circle with a center cross
     - a piece too long for the picture is broken with a break line, and the count of the row is written out

   Every size on a marking view is a number of the words of its line: the words and the view are worked out
   from the same "rule" (placesWords and fastenerPlaces in js/buildsteps.js), and the self-check
   markingViewsMeasureTrue holds them to it.

     markingFrame(axis, look, piece)    how a face is seen: which world direction is right and up on the paper,
                                        the names of its ends and edges as seen, and the words for it
     jointMarkPlan(group, letterOf)     the marking view of a "Fasten with" line (group.sample), or null
     hardwareMarkPlan(row, letterOf)    the marking view of a line of hardware (cup hinges, pulls, slides,
                                        runners, kickers), or null
     marksMarkPlan(lines, letterOf)     the marking view of the pencil marks of a marking step (markingLines)
     layoutMarkPlan(plan)               where everything goes on the paper, in picture pixels (no drawing)
     markingPicture(plan)               the picture, as a data URL ('' for no plan)

   A plan is in inches, in view coordinates (u to the right on the paper, v up):
     {frame, title, subtitle, rect (the marked face), others: [{rect, hidden, label}], points: [{at, kind, r,
      far, slot}], dims: [{a, b, measure, text, value, count, place, row}], refs: [{feature, label}],
      centers: [[a, b]], pencils: [[a, b]], bars: [{rect, mid}], notes: [text], legend: [{kind, text}], words}
   A feature (the end of a size) is {kind:'edge', c, rect} (an edge of a piece at view coordinate c across the
   measured direction) or {kind:'point', at:[u, v]} (the middle of a fastener). */
'use strict';

const MARK_VIEW={
  width:880,height:560,pad:14,titleH:74,
  number:30,label:25,legend:23,drawMin:380,   // text sizes in picture pixels (printed half a page wide: about 9, 7 1/2 and 7 points); the least height of the drawing
  firstRow:28,rowStep:50,sideGap:24,    // the first dimension line this far outside the piece, the next ones this much further
  extGap:3,extOver:8,tick:7,            // extension lines: the gap at the object, how far past the dimension line; half a tick
  leastDrawn:8,tallest:1100,                  // pixels: the shortest a size may be drawn (its extension lines must be seen apart)
  maxScale:90,                        // picture pixels per inch, at most (a narrow slat is drawn large, so its numbers fit between their lines)
  heavy:4.5,outline:2,
  ink:'#14181d',paper:'#ffffff',wood:'#eef0f2',woodOther:'#f7f8f9',fastener:'#0b3a8f',hidden:'#3c434b',
};

/* a break in the middle of a view (layoutMarkPlan): at least `keep` inches drawn on each side of it (8% of the gap,
   at most keepMost), left out only
   when that leaves out at least `least` inches and `share` of what is measured along that way; `room` pixels for
   the two break lines on the paper */
const BREAK={keep:1.25,keepMost:3,least:6,share:.2,room:34};
/* a size smaller than this (inches) is not drawn as a dimension where it cannot be seen at the scale of the view (a
   1/16" set-back): it is written in a note under the picture */
const SMALLEST_DRAWN=.25;

/* ---------- how a face is seen ---------- */
/* axis: the world axis square to the face (0 x, 1 y up, 2 z front). look: +1 or -1, the way the eye looks along
   it, into the face. piece: the piece the face belongs to (for "from inside").
     right, up          {axis, sign}: the world direction that is right, and up, on the paper
     seen, from         'seen from the back', 'underside, seen from below'; 'from the back'
     mirrored           true when the world's left is on the right of the paper (seen from behind)
     toView(p)          a world point as [u, v] on the paper, in inches
     nameOf(axis, high) the name of an end or edge as this view sees it: 'left', 'top', 'front' ...
     screenSide(axis, high)   'left' | 'right' | 'top' | 'bottom': where that face of a piece is on the paper
     screenLowIsHigh(axis)    true when the left end (or the bottom) of the paper is the high world end */
function markingFrame(axis,look,piece){
  look=look<0?-1:1;
  let right,up,from;
  if(axis===1){
    // a level face: the left of the design stays on the left. From above the back is at the top of the paper;
    // from below the front is (the way a person under it, facing the back, sees it, with left and right kept)
    right={axis:0,sign:1};up={axis:2,sign:look<0?-1:1};
    from=look<0?'from above':'from below';
  }else if(axis===0){
    right={axis:2,sign:look};up={axis:1,sign:1};
    from=`from the ${look>0?'left':'right'}`;
  }else{
    right={axis:0,sign:-look};up={axis:1,sign:1};
    from=`from the ${look<0?'front':'back'}`;
  }
  // "from inside": the eye is on the side of the piece where the middle of the design is
  let inside=false;
  if(piece&&axis!==1){
    const b=plainBox(piece),middle=designMiddle(),center=(b.lo[axis]+b.hi[axis])/2;
    inside=look>0?middle[axis]<center-.01:middle[axis]>center+.01;
  }
  const seen=axis===1?(look<0?'top face, seen from above':'underside, seen from below'):`seen ${from}${inside?' (from inside)':''}`;
  const mirrored=right.axis===0&&right.sign<0;
  const signOf=k=>k===right.axis?right.sign:k===up.axis?up.sign:0;
  // what is past the face, in words: under a top seen from above, above an underside, behind anything else
  const beyond=axis===1?(look<0?'under it':'above it'):'behind';
  return{axis,look,right,up,from,seen,mirrored,inside,signOf,beyond,
    toView:p=>[p[right.axis]*right.sign,p[up.axis]*up.sign],
    nameOf:(k,high)=>mirrored&&k===0?(high?'left':'right'):DIRECTION_ENDS[k][high?1:0],
    screenSide:(k,high)=>k===right.axis?((high===(right.sign>0))?'right':'left'):k===up.axis?((high===(up.sign>0))?'top':'bottom'):null,
    screenLowIsHigh:k=>k===right.axis?right.sign<0:k===up.axis?up.sign<0:false,
    viewAxis:k=>k===right.axis?0:k===up.axis?1:-1,
  };
}

/* ---------- small helpers ---------- */
const markText=v=>fmt(r16(v));
/* the rectangle of a piece on the paper, in inches */
function viewRectOf(piece,frame){
  const b=plainBox(piece),r=frame.right,u=frame.up;
  const us=[b.lo[r.axis]*r.sign,b.hi[r.axis]*r.sign],vs=[b.lo[u.axis]*u.sign,b.hi[u.axis]*u.sign];
  return{lo:[Math.min(...us),Math.min(...vs)],hi:[Math.max(...us),Math.max(...vs)]};
}
/* an edge of a piece (the face of its box at the high or low end of a world axis), as the end of a size */
function edgeFeature(frame,piece,axis,high){
  const b=plainBox(piece);
  return{kind:'edge',c:(high?b.hi[axis]:b.lo[axis])*frame.signOf(axis),rect:viewRectOf(piece,frame),piece,axis,high};
}
/* an edge at a world coordinate (the side of the place where two pieces touch), on the piece that has a face there */
function coordFeature(frame,pieces,axis,value){
  for(const piece of pieces){
    const b=plainBox(piece);
    for(const high of[false,true])if(Math.abs((high?b.hi[axis]:b.lo[axis])-value)<.02)return edgeFeature(frame,piece,axis,high);
  }
  return{kind:'edge',c:value*frame.signOf(axis),rect:viewRectOf(pieces[0],frame),piece:null,axis,high:false};
}
const pointFeature=(frame,p)=>({kind:'point',at:frame.toView(p)});
/* the word for a face of a piece, as the words of the steps use it: its ends are square to its length; the wide
   face of a board that is seen on edge (a shelf under a drawer slide) is its face; the rest are edges */
function faceWord(piece,axis,marked){
  return piece.ax[0]===axis?'end':!marked&&piece.ax[2]===axis?'face':'edge';
}
/* the name of an edge on the picture: 'top end of Back panel (H)' */
function edgeName(frame,feature,letterOf,behind,marked){
  if(!feature.piece)return'edge of the place where the two pieces meet';
  return`${frame.nameOf(feature.axis,feature.high)} ${faceWord(feature.piece,feature.axis,marked)} of ${pieceLabel(feature.piece,letterOf)}${behind?` (${frame.beyond})`:''}`;
}
const featureKey=feature=>[feature.piece?feature.piece.id:'',feature.axis,feature.high].join('|');
/* is this other piece behind the face (further along the way the eye looks)? */
function behindFace(frame,face,other){
  const b=plainBox(other),k=frame.axis;
  return frame.look>0?b.lo[k]>=face-.02:b.hi[k]<=face+.02;
}
function newMarkPlan(frame,piece,letterOf,title){
  return{frame,piece,title,subtitle:`${pieceLabel(piece,letterOf)}, ${frame.seen}`,rect:viewRectOf(piece,frame),
    others:[],points:[],dims:[],refs:[],centers:[],pencils:[],bars:[],notes:[],legend:[],words:'',rowNote:''};
}
/* one size of a plan. place: the side of the piece its line is on; row: 0 nearest the piece. A chain shares a row.
   value is the distance in the model; the number written (text) must be that distance (the self-check holds it to
   it). count and gaps: "3 spaces at 4 5/8"" stands for count equal gaps, and gaps lists them as they are. */
function addDim(plan,a,b,measure,text,value,place,row,count,gaps){
  plan.dims.push({a,b,measure,text,value,count:count||1,gaps:gaps||null,place,row:row||0});
}
/* every edge a size is measured from is named once, and drawn heavy */
function addRefs(plan,letterOf){
  const seen=new Set(plan.refs.map(ref=>featureKey(ref.feature)));
  for(const dim of plan.dims)for(const feature of[dim.a,dim.b]){
    if(feature.kind!=='edge'||feature.line)continue;   // (the line of a slide or a pencil mark is not an edge of a piece)
    const key=featureKey(feature);
    if(seen.has(key))continue;
    seen.add(key);
    const behind=feature.piece&&feature.piece!==plan.piece&&plan.others.some(other=>other.piece===feature.piece&&other.hidden);
    let label=edgeName(plan.frame,feature,letterOf,behind,feature.piece===plan.piece);
    // the words measure from "the nearest" end or edge: the picture says that this is the nearest one here
    if(feature.nearest&&feature.piece)label+=`, the ${faceWord(feature.piece,feature.axis,true)} nearest the ${plan.nearWhat||'marks'}`;
    plan.refs.push({feature,label,hidden:behind});
  }
  // a size from an edge of the piece behind: that edge cannot be seen from where you mark, so say how to find it
  const hiddenNames=[...new Set(plan.refs.filter(ref=>ref.hidden).map(ref=>ref.feature.piece.name))];
  if(hiddenNames.length)plan.notes.push(`The heavy dashed line is an edge of the ${listWords(hiddenNames)} behind: set it in place, or mark where it will sit, before you measure from it.`);
  // and at the other places of the line it may be the other edge: say so under the picture
  const nearest=plan.refs.filter(ref=>ref.feature.nearest&&ref.feature.piece);
  const words=[...new Set(nearest.map(ref=>faceWord(ref.feature.piece,ref.feature.axis,true)))];
  if(plan.places>1&&plan.sampleAt){
    // a line whose places are marked with different numbers (sortsByPlace in js/buildsteps.js): this view is for
    // the place the line names first, and the others are marked as the line says, never "with the same numbers"
    const from=nearest.length?`, each measured from the ${listWords(words)} of the ${plan.piece.name} nearest the ${plan.nearWhat||'marks'} there`:'';
    plan.notes.push(`This view is for ${plan.sampleAt}. Mark the other places with the numbers the line gives for each${from}.`);
  }else if(nearest.length&&plan.places>1){
    plan.notes.push(`At the other places, measure from the ${listWords(words)} of the ${plan.piece.name} nearest the ${plan.nearWhat||'marks'} there, with the same numbers: it may be the other ${words.length>1?'one':words[0]}.`);
  }
}
function addOther(plan,other,face,letterOf){
  // dashed only where it is hidden: behind the face AND behind the piece as the paper shows it (a skid under a rim
  // joist is beside it on the paper, so it is drawn solid)
  const rect=viewRectOf(other,plan.frame),r=plan.rect;
  const covered=rect.lo[0]<r.hi[0]-.01&&rect.hi[0]>r.lo[0]+.01&&rect.lo[1]<r.hi[1]-.01&&rect.hi[1]>r.lo[1]+.01;
  const hidden=covered&&behindFace(plan.frame,face,other);
  plan.others.push({piece:other,rect,hidden,label:pieceLabel(other,letterOf)});
  plan.legend.push(hidden?{kind:'hidden',text:`${pieceLabel(other,letterOf)}, ${plan.frame.beyond}`}:{kind:'other',text:`${pieceLabel(other,letterOf)}, beside it`});
}
/* a row of four or more along a long piece: the ones between the second and the last are not what the sizes are
   measured to, so the picture may break them out (layoutMarkPlan leaves out the length between the second and the
   last when it is long, and the note under the picture gives the count of the row) */
function leaveOutMiddle(points){
  if(points.length<4)return;
  for(const point of points.slice(2,-1))if(point)point.focus=false;
}
const fastenerNoun=f=>f.kind==='dowel'?'dowel hole':f.kind==='pocket'?'pocket hole':f.kind==='bracket'?'bracket':f.kind==='brad'?'brad nail':f.kind==='nail'?'nail':'screw';

/* ---------- the marking view of a "Fasten with" line ---------- */
function jointMarkPlan(group,letterOf){
  const sample=group&&group.sample;
  if(!sample||!sample.layout||!sample.layout.length)return null;
  const rule=sample.rule||{},here=sample.here||{};
  let plan=null;
  if(rule.sheet)plan=sheetMarkPlan(group,letterOf);
  else if(rule.plate)plan=plateMarkPlan(group,letterOf);
  else if(here.row)plan=rowMarkPlan(group,letterOf);
  else if(here.spot)plan=straightMarkPlan(group,letterOf);
  if(plan){
    plan.words=(group.line||'')+' '+(group.whereKept||group.where||'');   // (whereKept: a line drilled in step 2, js/drillplan.js)
    plan.places=group.places||1;
    plan.sampleAt=group.sampleAt||null;   // (the place this view is for, when the places of the line have other numbers)
    plan.sampleWords=group.sampleWords?(group.line||'')+' '+group.sampleWords:'';   // (then the words of that place alone)
    plan.rule=rule;
    addRefs(plan,letterOf);
    // a line whose words give no sizes for this joint gets no marking view: a picture with nothing measured on it
    // only says "spread them as the line says" (the 3D view beside it shows where they sit)
    // (the long screws of a wall plate keep theirs: it shows which joists they land on)
    if(!plan.dims.length&&!rule.plate)return null;
  }
  return plan;
}

/* screws, brads, nails and dowels driven straight in: the face of the piece that is marked */
function straightMarkPlan(group,letterOf){
  const sample=group.sample,spot=sample.here.spot,frame=spot.frame,rule=sample.rule||{};
  const marked=spot.marked,into=spot.into,L=spot.L,W=spot.W;
  const layout=sample.layout.map(f=>f.pos0?{...f,pos:f.pos0}:f);
  const sorted=layout.slice().sort((a,b)=>a.pos[L]-b.pos[L]);
  const f0=layout[0],dowel=f0.kind==='dowel',n=sorted.length;
  const plan=newMarkPlan(frame,marked,letterOf,dowel?'Where to drill':'Where to mark');
  // a dowel hole is drilled in the face of the joint: say which ('the end of Shelf (C)')
  if(dowel)plan.subtitle=`the ${faceSaid(sample.link.joint,marked)} of ${pieceLabel(marked,letterOf)}, ${frame.seen}`;
  const face=f0.pos[frame.axis];
  if(!dowel)addOther(plan,into,face,letterOf);
  // a head sunk in a counterbore (under a plug, or deep so the screw reaches): the 3/8" hole is drawn at its size
  // round the mark, and the legend names it
  const counterbore=!dowel&&f0.sunk>0;
  plan.points=layout.map(f=>({at:frame.toView(f.pos),kind:dowel||counterbore?'hole':'cross',r:dowel?f.dia/2:counterbore?PLUG_DIA/2:0}));
  const pointFor=new Map(layout.map((f,index)=>[f,plan.points[index]]));
  const sunkWords=!counterbore?'':f0.plug?`, then drill a 3/8" counterbore ${markText(f0.sunk)} deep there for the ${plugCoverWords(f0).name.toLowerCase()}`
    :`, then drill a 3/8" counterbore ${markText(f0.sunk)} deep there for the head`;
  plan.legend.unshift({kind:dowel||counterbore?'hole':'cross',text:`${fastenerNoun(f0)}: mark its middle${sunkWords}`});
  // the row on the middle of the piece behind: a dash-dot line through that middle
  const intoBox=plainBox(into),markedBox=plainBox(marked);
  if(spot.overInto&&!dowel){
    const middle=(intoBox.lo[W]+intoBox.hi[W])/2,a=[0,0,0],b=[0,0,0];
    a[frame.axis]=b[frame.axis]=face;a[W]=b[W]=middle;
    a[L]=Math.max(intoBox.lo[L],markedBox.lo[L]);b[L]=Math.min(intoBox.hi[L],markedBox.hi[L]);
    plan.centers.push([frame.toView(a),frame.toView(b)]);
    plan.legend.push({kind:'center',text:`middle of the ${into.name}`});
  }
  const WV=frame.viewAxis(W),LV=frame.viewAxis(L);
  if(WV<0||LV<0)return plan;
  const edge=(axis,high)=>edgeFeature(frame,marked,axis,high);
  // an edge the words call "the nearest": at the other places of the line it may be the other edge, so the
  // picture says so where it names it ("back edge of Side (A), the edge nearest the screws")
  const nearEdge=(axis,high)=>Object.assign(edge(axis,high),{nearest:true});
  plan.nearWhat=fastenerNoun(f0)+(layout.length>1?'s':'');
  const at=f=>pointFeature(frame,f.pos);
  const nearW=f=>f.pos[W]-markedBox.lo[W]>markedBox.hi[W]-f.pos[W];   // true: nearer the high edge
  const nearL=f=>f.pos[L]-markedBox.lo[L]>markedBox.hi[L]-f.pos[L];

  /* two set on a slant: each from its nearest end and its nearest edge (each size on a row of its own) */
  if(rule.slant){
    const rowsUsed={};
    const addRow=(a,b,measure,text,value,place)=>{rowsUsed[place]=(rowsUsed[place]||0);addDim(plan,a,b,measure,text,value,place,rowsUsed[place]++);};
    sorted.forEach((f,index)=>{
      const highL=nearL(f),highW=nearW(f);
      const alongValue=highL?markedBox.hi[L]-f.pos[L]:f.pos[L]-markedBox.lo[L];
      const acrossValue=highW?markedBox.hi[W]-f.pos[W]:f.pos[W]-markedBox.lo[W];
      if(rule.slant==='joint'){
        // each from its own side of the place where the pieces touch, and from its nearest edge: its own numbers
        const rangeL=jointShape(sample.link.joint).rangeL,start=coordFeature(frame,[into,marked],L,index?rangeL[1]:rangeL[0]);
        const fromSide=Math.abs(f.pos[L]-(index?rangeL[1]:rangeL[0]));
        addRow(start,at(f),LV,markText(fromSide),fromSide,frame.screenSide(W,highW));
        addRow(nearEdge(W,highW),at(f),WV,markText(acrossValue),acrossValue,frame.screenSide(L,highL));
        return;
      }
      addRow(nearEdge(L,highL),at(f),LV,markText(alongValue),alongValue,frame.screenSide(W,highW));
      addRow(nearEdge(W,highW),at(f),WV,markText(acrossValue),acrossValue,frame.screenSide(L,highL));
    });
    return plan;
  }

  /* across: from which edge the row (or the two rows) is measured */
  const across=rule.across||{kind:'none'},along=rule.along||{kind:rule.free?'free':'none'};
  let acrossHigh=nearW(sorted[0]);
  let alongHigh=n===1?nearL(sorted[0]):!(spot.alongLow[0]+spot.alongLow[n-1]<=spot.alongHigh[0]+spot.alongHigh[n-1]+.03);
  if(along.kind==='from'&&along.side!=='near')alongHigh=along.side==='high';
  if(along.kind==='even')alongHigh=frame.screenLowIsHigh(L);
  if(along.kind==='middle'||along.kind==='joint')alongHigh=false;
  if(across.kind==='from')acrossHigh=across.side==='near'?!spot.nearLowW:across.side==='high';
  if(across.kind==='middle')acrossHigh=false;
  const alongPlace=frame.screenSide(W,acrossHigh),acrossPlace=frame.screenSide(L,alongHigh);
  // the fastener nearest the end that along sizes start from
  const fromStart=alongHigh?sorted.slice().reverse():sorted;
  if(across.kind==='middle'){
    const f=fromStart[0],text=markText(spot.acrossLow[0]);
    addDim(plan,edge(W,false),at(f),WV,text,f.pos[W]-markedBox.lo[W],acrossPlace,0);
    addDim(plan,at(f),edge(W,true),WV,text,markedBox.hi[W]-f.pos[W],acrossPlace,0);
  }else if(across.kind==='from'){
    // one row, or two in a zig-zag: each from the same edge, the nearer one nearest the piece
    const values=acrossHigh?spot.acrossHigh:spot.acrossLow;
    values.forEach((said,index)=>{
      const world=acrossHigh?markedBox.hi[W]-said:markedBox.lo[W]+said;
      const f=fromStart.find(candidate=>Math.abs(candidate.pos[W]-world)<.07)||fromStart[0];
      // (the number from where this fastener really is; the words round the same distance the same way)
      const value=Math.abs(f.pos[W]-(acrossHigh?markedBox.hi[W]:markedBox.lo[W]));
      addDim(plan,across.side==='near'?nearEdge(W,acrossHigh):edge(W,acrossHigh),at(f),WV,markText(value),value,acrossPlace,index);
    });
  }
  /* along: where on that row. Every number is worked out here from where the fasteners of the joint drawn really
     are, and the self-check holds each to its line on the paper and to the words. */
  const what=fastenerNoun(sorted[0])+(n>1?'s':'');
  const alongOf=f=>f.pos[L];
  const endAt=high=>high?markedBox.hi[L]:markedBox.lo[L];
  // a chain from a start (an edge at world coordinate startAt) through the fasteners in order: the first from the
  // start, then the gaps, written once with their count when they are all one size
  const chain=(start,startAt,list,row)=>{
    const first=Math.abs(alongOf(list[0])-startAt);
    leaveOutMiddle(list.map(f=>pointFor.get(f)));
    addDim(plan,start,at(list[0]),LV,markText(first),first,alongPlace,row);
    if(list.length<2)return first;
    const gaps=list.slice(1).map((f,index)=>Math.abs(alongOf(f)-alongOf(list[index])));
    const even=gaps.every(one=>Math.abs(one-gaps[0])<.03);
    if(even&&list.length>2)addDim(plan,at(list[0]),at(list[list.length-1]),LV,`${list.length-1} spaces at ${markText(gaps[0])}`,gaps[0],alongPlace,row,list.length-1,gaps);
    else gaps.forEach((one,index)=>addDim(plan,at(list[index]),at(list[index+1]),LV,markText(one),one,alongPlace,row));
    if(list.length>2)plan.rowNote=`${list.length} ${what} in this row: the first ${markText(first)} from the ${frame.nameOf(L,startAt===endAt(true))} ${spot.sideL}, then `+
      (even?`every ${markText(gaps[0])}`:`at gaps of ${listWords(gaps.map(markText))}`);
    return first;
  };
  if(along.kind==='middle'){
    const f=sorted[0];
    addDim(plan,edge(L,false),at(f),LV,markText(alongOf(f)-markedBox.lo[L]),alongOf(f)-markedBox.lo[L],alongPlace,0);
    addDim(plan,at(f),edge(L,true),LV,markText(markedBox.hi[L]-alongOf(f)),markedBox.hi[L]-alongOf(f),alongPlace,0);
  }else if(along.kind==='from'){
    const start=along.side==='near'?nearEdge(L,alongHigh):edge(L,alongHigh);
    if(n===2){
      // two from one end: stacked, each from that end (the words give both from it)
      fromStart.forEach((f,index)=>{const value=Math.abs(alongOf(f)-endAt(alongHigh));addDim(plan,start,at(f),LV,markText(value),value,alongPlace,index);});
    }else chain(start,endAt(alongHigh),fromStart,0);
  }else if(along.kind==='even'){
    chain(edge(L,alongHigh),endAt(alongHigh),fromStart,0);
    const lastValue=Math.abs(endAt(!alongHigh)-alongOf(fromStart[n-1]));
    addDim(plan,at(fromStart[n-1]),edge(L,!alongHigh),LV,markText(lastValue),lastValue,alongPlace,0);
  }else if(along.kind==='joint'){
    /* from the sides of the place where the two pieces touch (the edges of the rail behind), and also from the end
       of the marked piece, which a person marking it can measure from: the words give that number too */
    const rangeL=jointShape(sample.link.joint).rangeL;
    const start=coordFeature(frame,[into,marked],L,rangeL[0]),end=coordFeature(frame,[into,marked],L,rangeL[1]);
    chain(start,rangeL[0],sorted,0);
    if(n===2){const value=rangeL[1]-alongOf(sorted[1]);addDim(plan,at(sorted[1]),end,LV,markText(value),value,alongPlace,0);}
    const own=alongOf(sorted[0])-markedBox.lo[L];
    if(own>.05)addDim(plan,edge(L,false),at(sorted[0]),LV,markText(own),own,alongPlace,1);
  }else if(along.kind==='free'&&rule.gap&&n>1){
    const one=Math.abs(alongOf(sorted[1])-alongOf(sorted[0]));
    addDim(plan,at(sorted[0]),at(sorted[1]),LV,markText(one),one,alongPlace,0);
  }
  if(!plan.dims.length)plan.notes.push('The words of this line give no sizes here: spread them as the line says.');
  return plan;
}

/* pocket holes, angled screws and nails, brackets: spread along one line on the face they are marked on */
function rowMarkPlan(group,letterOf){
  const sample=group.sample,row=sample.here.row,frame=row.frame,rule=sample.rule||{};
  const layout=sample.layout,f0=layout[0],through=f0.through,into=f0.into,shape=jointShape(sample.link.joint);
  const pocket=f0.kind==='pocket',bracket=f0.kind==='bracket',toe=!!f0.toe;
  const plan=newMarkPlan(frame,through,letterOf,pocket?'Where to drill the pocket holes':bracket?'Where the brackets go':'Where to start the nails');
  if(toe&&f0.kind!=='nail')plan.title='Where to start the screws';
  const throughBox=plainBox(through),face=frame.look>0?throughBox.lo[frame.axis]:throughBox.hi[frame.axis];
  addOther(plan,into,face,letterOf);
  const axis=row.axis,pointOf=f=>pocket?f.pocket.mouth:f.pos;
  const sorted=layout.slice().sort((a,b)=>pointOf(a)[axis]-pointOf(b)[axis]),n=sorted.length;
  const pointFor=new Map();
  for(const f of layout){
    pointFor.set(f,plan.points.length);
    if(pocket){
      // the hole opens as a long slot that runs back from where the screw comes out, away from the joint
      const away=f.dir.map((v,k)=>k===frame.axis?0:-v),long=Math.hypot(...away)||1,unit=away.map(v=>v/long);
      // the oval the bit leaves, centred on where the middle of the bit comes out and POCKET_OVAL each way
      // (js/fasteners.js), as the part drawings draw it (carry-over 8); never past the edges of the piece. The slot
      // is drawn from its end at `slot` back through the mouth to the same distance on the other side.
      let reach=Math.max(0,POCKET_OVAL-f.pocket.dia/2);
      for(let k=0;k<3;k++){
        if(k===frame.axis||Math.abs(unit[k])<1e-6)continue;
        for(const sign of[1,-1]){
          const u=unit[k]*sign;
          const room=u>0?throughBox.hi[k]-f.pocket.dia/2-f.pocket.mouth[k]:f.pocket.mouth[k]-(throughBox.lo[k]+f.pocket.dia/2);
          reach=Math.min(reach,Math.max(0,room/Math.abs(u)));
        }
      }
      const tail=pointPlus(f.pocket.mouth,unit,reach);
      plan.points.push({at:frame.toView(f.pocket.mouth),kind:'pocket',r:f.pocket.dia/2,slot:frame.toView(tail)});
    }else if(bracket){
      for(const plate of f.plates){
        if(plate.s[frame.axis]>.2)continue;   // the leg that lies on this face
        const lo=plate.c.map((v,k)=>v-plate.s[k]/2),hi=plate.c.map((v,k)=>v+plate.s[k]/2),a=frame.toView(lo),b=frame.toView(hi);
        plan.bars.push({rect:{lo:[Math.min(a[0],b[0]),Math.min(a[1],b[1])],hi:[Math.max(a[0],b[0]),Math.max(a[1],b[1])]},kind:'bracket'});
      }
      plan.points.push({at:frame.toView(f.pos),kind:'mid',r:0});
    }else{
      const far=Math.abs(f.pos[frame.axis]-f0.pos[frame.axis])>.01;   // started from the other side
      plan.points.push({at:frame.toView(f.pos),kind:'cross',r:0,far});
    }
  }
  plan.legend.unshift({kind:pocket?'pocket':bracket?'bracket':'cross',text:pocket?'pocket hole: drill it with the jig':bracket?'bracket: its middle':`${fastenerNoun(f0)}: where it starts`});
  if(toe&&layout.some(f=>Math.abs(f.pos[frame.axis]-f0.pos[frame.axis])>.01))plan.legend.push({kind:'far',text:'started from the other side'});
  const AV=frame.viewAxis(axis),KV=frame.viewAxis(shape.k);
  if(AV<0||KV<0||rule.free)return plan;
  // the end of the piece at the joint (the end that meets the other piece), and the sizes beside it
  const jointHigh=Math.abs(throughBox.hi[shape.k]-shape.plane)<.02;
  const place=frame.screenSide(shape.k,jointHigh);
  const range=row.range,ends=[coordFeature(frame,[through,into],axis,range[0]),coordFeature(frame,[through,into],axis,range[1])];
  const startHigh=row.startHigh,ordered=startHigh?sorted.slice().reverse():sorted;
  const start=ends[startHigh?1:0],end=ends[startHigh?0:1];
  const at=f=>pointFeature(frame,pointOf(f));
  // (a line said once for many boards crossing the piece, crossingPocketWords in js/buildsteps.js: the words
  //  measure from the edges of the board that crosses, so the view does too, below)
  if((row.alongPiece||rule.alongPiece)&&!rule.crossing){
    /* the words give each place along the piece itself, from its start end (a row moved clear of another piece,
       or a joint over part of the piece: a top board crossing a cross rail): every size from that end, one to
       each hole of this joint. Up the paper they are running sizes on one line (each number beside its own tick);
       across the paper the numbers are wider than the gaps between the holes, so each size gets its own row,
       the nearest hole nearest the piece (sizes from one end, stacked) */
    const pieceStart=startHigh?throughBox.hi[axis]:throughBox.lo[axis];
    const pieceEnd=edgeFeature(frame,through,axis,startHigh);
    const running=n>1&&AV===1;
    ordered.forEach((f,index)=>{
      const value=Math.abs(pointOf(f)[axis]-pieceStart);
      addDim(plan,pieceEnd,at(f),AV,markText(value),value,place,running?0:index);
      if(running)plan.dims[plan.dims.length-1].running=true;
    });
    if(running)plan.legend.push({kind:'datum',text:`running sizes: each from the ${frame.nameOf(axis,startHigh)} ${faceWord(through,axis,true)} (the small circle)`});
  }else{
    // (every number from where the fasteners of this joint are: the first and the last from their own ends)
    leaveOutMiddle(ordered.map(f=>plan.points[pointFor.get(f)]));
    const firstValue=Math.abs(pointOf(ordered[0])[axis]-(startHigh?range[1]:range[0]));
    const lastValue=Math.abs((startHigh?range[0]:range[1])-pointOf(ordered[n-1])[axis]);
    addDim(plan,start,at(ordered[0]),AV,markText(firstValue),firstValue,place,0);
    if(n>1){
      const gaps=ordered.slice(1).map((f,index)=>Math.abs(pointOf(f)[axis]-pointOf(ordered[index])[axis]));
      const even=gaps.every(one=>Math.abs(one-gaps[0])<.03);
      if(n>2&&even)addDim(plan,at(ordered[0]),at(ordered[n-1]),AV,`${n-1} spaces at ${markText(gaps[0])}`,gaps[0],place,0,n-1,gaps);
      else gaps.forEach((one,index)=>addDim(plan,at(ordered[index]),at(ordered[index+1]),AV,markText(one),one,place,0));
      if(n>2)plan.rowNote=`${n} ${fastenerNoun(f0)}s: the first ${markText(firstValue)} from the ${frame.nameOf(axis,startHigh)} ${row.refWord}, then `+
        (even?`every ${markText(gaps[0])}`:`at gaps of ${listWords(gaps.map(markText))}`);
    }
    addDim(plan,at(ordered[n-1]),end,AV,markText(lastValue),lastValue,place,0);
  }
  // an angled nail starts back from the joint
  if(toe&&row.back){
    const f=ordered.find(candidate=>Math.abs(candidate.pos[frame.axis]-f0.pos[frame.axis])<.01)||ordered[0];
    addDim(plan,edgeFeature(frame,through,shape.k,jointHigh),at(f),KV,markText(row.back),Math.abs(f.pos[shape.k]-shape.plane),frame.screenSide(axis,startHigh),0);
  }
  // the end of the piece that meets the other one: where a pocket hole, a bracket or an angled nail is worked from
  // (named the way the view sees it, end or edge: the bottom edge of a joist that sits on a skid is an edge)
  const meets=shape.k===1&&!jointHigh?'sits on':'meets';
  plan.refs.push({feature:edgeFeature(frame,through,shape.k,jointHigh),
    label:`${frame.nameOf(shape.k,jointHigh)} ${faceWord(through,shape.k,true)} of ${pieceLabel(through,letterOf)}, where it ${meets} the ${into.name}`});
  if(pocket)plan.notes.push(`Set the pocket-hole jig for ${fmt(f0.jig)} stock: it puts each hole the right distance from the end.`);
  return plan;
}

/* plywood nailed by spacing: the sheet with the framing behind it, and the nails by the rule of the line */
function sheetMarkPlan(group,letterOf){
  const sample=group.sample,rule=sample.rule,f0=sample.layout[0],sheet=f0.through,k=sample.link.joint.k;
  const frame=markingFrame(k,Math.sign(f0.dir[k])||1,sheet);
  const plan=newMarkPlan(frame,sheet,letterOf,'Where to nail');
  const sheetBox=plainBox(sheet),face=f0.pos[k];
  const framing=[];
  for(const link of group.links){
    const laid=fastenersOfLink(link)[0];
    if(laid&&laid.through===sheet&&!framing.includes(laid.into))framing.push(laid.into);
  }
  if(!framing.length)framing.push(f0.into);
  const seenNames=new Set();
  for(const piece of framing){
    plan.others.push({piece,rect:viewRectOf(piece,frame),hidden:true,label:pieceLabel(piece,letterOf)});
    if(!seenNames.has(piece.name)){seenNames.add(piece.name);plan.legend.push({kind:'hidden',text:`${pluralName(piece.name)}, ${frame.beyond}`});}
  }
  plan.legend.unshift({kind:'cross',text:'nail'});
  // nails along the middle of each piece behind, inside the sheet: every rule.edge at an edge of the sheet, rule.field elsewhere
  const view=frame.viewAxis.bind(frame),[U,V]=[frame.right.axis,frame.up.axis];
  const rows=[];
  for(const piece of framing){
    const b=plainBox(piece);
    const longAxis=[U,V].reduce((best,axis)=>Math.min(b.hi[axis],sheetBox.hi[axis])-Math.max(b.lo[axis],sheetBox.lo[axis])>Math.min(b.hi[best],sheetBox.hi[best])-Math.max(b.lo[best],sheetBox.lo[best])?axis:best);
    const crossAxis=longAxis===U?V:U;
    const middle=(Math.max(b.lo[crossAxis],sheetBox.lo[crossAxis])+Math.min(b.hi[crossAxis],sheetBox.hi[crossAxis]))/2;
    const from=Math.max(b.lo[longAxis],sheetBox.lo[longAxis])+.75,to=Math.min(b.hi[longAxis],sheetBox.hi[longAxis])-.75;
    if(to<=from)continue;
    const atEdge=Math.min(Math.abs(middle-sheetBox.lo[crossAxis]),Math.abs(middle-sheetBox.hi[crossAxis]))<2;
    const spacing=atEdge?rule.edge:rule.field,spots=[];
    for(let x=from;x<=to+.01;x+=spacing){
      const p=[0,0,0];p[k]=face;p[crossAxis]=middle;p[longAxis]=x;
      const at=frame.toView(p);
      // where two pieces behind cross (a joist under a rim), one nail does for both
      if(plan.points.some(point=>Math.hypot(point.at[0]-at[0],point.at[1]-at[1])<1.25))continue;
      spots.push(p);
      plan.points.push({at,kind:'cross',r:0});
    }
    // (the row across the paper: which way it runs on the paper, and where it is across that)
    const rowAxis=view(crossAxis),c=frame.toView(spots.length?spots[0]:[middle,middle,middle])[rowAxis];
    if(spots.length)rows.push({piece,longAxis,crossAxis,atEdge,spacing,spots,rowAxis,c});
  }
  /* One corner of the sheet, drawn large and broken off (a whole sheet would be a blur of nails): the corner at the
     bottom left of the paper, as far as the first row in from the edge and a little past it, so that the picture
     shows an edge row (nails rule.edge apart) and a row in between (rule.field apart) */
  const sheetRect=viewRectOf(sheet,frame),limit=[0,0];
  for(let axis=0;axis<2;axis++){
    // (the first row in between that lies across this way, if there is one: an edge row is the far edge)
    const firstField=rows.filter(row=>row.rowAxis===axis&&!row.atEdge).sort((a,b)=>a.c-b.c)[0];
    limit[axis]=Math.max(sheetRect.lo[axis]+14,firstField?firstField.c+3:-Infinity);
    // and far enough along for two nails of the first edge row and of the first row in between that run this way
    for(const edge of[true,false]){
      const first=rows.filter(row=>row.rowAxis!==axis&&row.atEdge===edge).sort((a,b)=>a.c-b.c)[0];
      const spots=first?first.spots.map(p=>frame.toView(p)[axis]).sort((a,b)=>a-b):[];
      if(spots.length>1)limit[axis]=Math.max(limit[axis],spots[1]+3);
    }
  }
  const inCorner=at=>at[0]<=limit[0]+.01&&at[1]<=limit[1]+.01;
  for(const point of plan.points)point.focus=inCorner(point.at);
  plan.cornerOnly=true;
  // one size for the nails along an edge (the row nearest the corner, measured on the side of that edge) and one
  // for a row in between (the first one in from the edge, measured on the far side of the corner, where no other
  // row is between it and its size)
  /* The size of a row is put on a side of the picture where no other row of the part shown lies between the row
     and its size, and between two nails of it that are not where another row crosses (so its extension lines run
     over no other nails) */
  const shownRows=rows.filter(row=>row.c<=limit[row.rowAxis]+.01);
  const choose=edge=>{
    for(const row of shownRows.filter(candidate=>candidate.atEdge===edge).sort((a,b)=>a.c-b.c)){
      const along=1-row.rowAxis;
      const crossing=shownRows.filter(other=>other.rowAxis!==row.rowAxis).map(other=>other.c);
      const spots=row.spots.filter(p=>inCorner(frame.toView(p))).sort((a,b)=>frame.toView(a)[along]-frame.toView(b)[along]);
      const free=spots.filter(p=>crossing.every(c=>Math.abs(frame.toView(p)[along]-c)>1.25));
      for(const high of[false,true]){
        const blocked=shownRows.some(other=>other!==row&&other.rowAxis===row.rowAxis&&(high?other.c>row.c+.5:other.c<row.c-.5));
        if(blocked)continue;
        for(let i=0;i+1<free.length;i++){
          const gap=Math.abs(frame.toView(free[i+1])[along]-frame.toView(free[i])[along]);
          if(Math.abs(gap-row.spacing)<.02)return{row,spots:[free[i],free[i+1]],key:row.rowAxis===0?(high?'right':'left'):(high?'top':'bottom')};
        }
      }
    }
    return null;
  };
  const placeOf={};
  for(const edge of[true,false]){
    const chosen=choose(edge);
    if(!chosen)continue;
    const{row,spots,key}=chosen;
    placeOf[key]=(placeOf[key]||0);
    addDim(plan,pointFeature(frame,spots[0]),pointFeature(frame,spots[1]),view(row.longAxis),`${row.spacing}"`,row.spacing,key,placeOf[key]++);
  }
  plan.notes.push(`This is part of the sheet, at an edge, broken off where it goes on. Nails ${rule.edge}" apart along every edge of the sheet and ${rule.field}" apart over the framing in between, each on the middle of the piece behind.`);
  return plan;
}
/* the long screws of a wall plate: the plate seen from above, with the framing under the deck dashed */
function plateMarkPlan(group,letterOf){
  const sample=group.sample,f0=sample.layout[0],plate=f0.through;
  const frame=markingFrame(1,-1,plate);
  const plan=newMarkPlan(frame,plate,letterOf,'Where the screws go');
  const seen=new Set();
  for(const f of sample.layout){
    plan.points.push({at:frame.toView(f.pos),kind:'cross',r:0});
    for(const under of f.also||[]){
      if(seen.has(under.id))continue;
      seen.add(under.id);
      plan.others.push({piece:under,rect:viewRectOf(under,frame),hidden:true,label:pieceLabel(under,letterOf)});
    }
  }
  plan.legend.unshift({kind:'cross',text:'screw'});
  if(seen.size)plan.legend.push({kind:'hidden',text:'framing under the plywood'});
  plan.notes.push('Each screw goes where a joist or a rim joist is under the plywood (dashed).');
  return plan;
}

/* ---------- the marking view of a line of hardware ---------- */
/* The same numbers as the line under "Hardware in this step" (cupHingeLine, pullLine, slideLine, kickerLine in
   js/buildsteps.js), on the face that is drilled or that the hardware is screwed to. */
function hardwareMarkPlan(row,letterOf){
  // the screws into the wall studs and the bolts between rack sections: js/rackwall.js
  if(row.kind==='wallscrew'||row.kind==='bolt')return rackHardwareMarkPlan(row,letterOf);
  const item=row.items[0],host=byId(item.on);
  if(!host||tilted(host))return null;
  const hostBox=plainBox(host);
  let plan=null;
  if(row.kind==='cup'&&item.to!=null){
    // the holes are drilled in the BACK of the door, the face toward the cabinet
    const back=host.ax[2],backSign=designMiddle()[back]>(hostBox.lo[back]+hostBox.hi[back])/2?1:-1;
    const frame=markingFrame(back,-backSign,host),face=backSign>0?hostBox.hi[back]:hostBox.lo[back];
    plan=newMarkPlan(frame,host,letterOf,'Where to drill the cup holes');
    plan.subtitle=`${pieceLabel(host,letterOf)}, back face (lay the door face down)`;
    const items=row.items.filter(other=>other.on===host.id),spots=items.map(other=>hardwareSpot(other,host));
    const cross=spots[0].cross,edgeHigh=!!cross.side,inward=edgeHigh?-1:1;
    const edgeAt=edgeHigh?hostBox.hi[cross.axis]:hostBox.lo[cross.axis];
    const CV=frame.viewAxis(cross.axis),AV=frame.viewAxis(spots[0].along.axis);
    // One hole is drawn large, near its end of the door (the lowest one): the door is broken off above it. The
    // others are measured the same way from their own end, and the note under the picture says so.
    const order=items.map((other,index)=>index).sort((a,b)=>{
      const m=spots[a].along,n=spots[b].along,at=s=>s.centered?1e9:s.side?1e6+s.distance:s.distance;
      return at(m)-at(n);
    });
    const shown=order[0],others=[];
    items.forEach((other,index)=>{
      const m=spots[index].along,p=[0,0,0];
      p[back]=face;p[cross.axis]=edgeAt+inward*CUP_HOLE.fromEdge;
      p[m.axis]=m.centered?(hostBox.lo[m.axis]+hostBox.hi[m.axis])/2:m.side?hostBox.hi[m.axis]-m.distance:hostBox.lo[m.axis]+m.distance;
      plan.points.push({at:frame.toView(p),kind:'hole',r:CUP_HOLE.wide/2,focus:index===shown});
      if(index!==shown){others.push(m.centered?'halfway along it':`${markText(m.distance)} from its ${DIRECTION_ENDS[m.axis][m.side]} ${host.ax[0]===m.axis?'end':'edge'}`);return;}
      if(!m.centered)addDim(plan,edgeFeature(frame,host,m.axis,!!m.side),pointFeature(frame,p),AV,markText(m.distance),m.distance,frame.screenSide(cross.axis,edgeHigh),0);
      addDim(plan,edgeFeature(frame,host,cross.axis,edgeHigh),pointFeature(frame,p),CV,markText(CUP_HOLE.fromEdge),CUP_HOLE.fromEdge,frame.screenSide(m.axis,!!m.side),0);
    });
    if(others.length)plan.notes.push(`The other hole${others.length>1?'s':''} of this door: ${listWords(others)}, and ${markText(CUP_HOLE.fromEdge)} from the hinged edge too.`);
    plan.legend.unshift({kind:'hole',text:`cup hole, ${markText(CUP_HOLE.wide)} wide: mark its middle`});
    plan.refs.push({feature:edgeFeature(frame,host,cross.axis,edgeHigh),label:`hinged edge of ${pieceLabel(host,letterOf)}`,named:true});
    if(frame.mirrored)plan.notes.push(`Seen from the back, so the hinged edge (the ${DIRECTION_ENDS[cross.axis][edgeHigh?1:0]} edge as you look at the front) is on the ${frame.screenSide(cross.axis,edgeHigh)}.`);
  }else if(row.kind==='pull'){
    const pose=hardwarePose(item);
    const faceAxis=[0,1,2].reduce((best,k)=>Math.abs(pose.n.getComponent(k))>Math.abs(pose.n.getComponent(best))?k:best,0);
    const faceSign=pose.n.getComponent(faceAxis)>0?1:-1,face=faceSign>0?hostBox.hi[faceAxis]:hostBox.lo[faceAxis];
    const frame=markingFrame(faceAxis,-faceSign,host);
    plan=newMarkPlan(frame,host,letterOf,'Where to drill for the pull');
    const half=size(host).map(v=>v/2),center=hostBox.lo.map((v,k)=>v+half[k]+item.at[k]);
    const alongAxis=[0,1,2].filter(k=>k!==faceAxis).reduce((best,k)=>Math.abs(item.u[k])>Math.abs(item.u[best])?k:best);
    const crossAxis=[0,1,2].find(k=>k!==faceAxis&&k!==alongAxis);
    const low=item.at[crossAxis]+half[crossAxis],high=half[crossAxis]-item.at[crossAxis];
    const fromHigh=crossAxis===1?high<=low+.13:high<low-.13;
    const fromLowEnd=item.at[alongAxis]+half[alongAxis],fromHighEnd=half[alongAxis]-item.at[alongAxis];
    const nearHighEnd=alongAxis===1?fromHighEnd<=fromLowEnd+.13:fromHighEnd<fromLowEnd-.13;
    const holes=[-1,1].map(sign=>{const p=center.slice();p[faceAxis]=face;p[alongAxis]+=sign*item.size/2;return p;})
      .sort((a,b)=>nearHighEnd?b[alongAxis]-a[alongAxis]:a[alongAxis]-b[alongAxis]);
    const middle=nearHighEnd?fromHighEnd:fromLowEnd,said=[middle-item.size/2,middle+item.size/2];
    for(const p of holes)plan.points.push({at:frame.toView(p),kind:'hole',r:3/32});
    const CV=frame.viewAxis(crossAxis),AV=frame.viewAxis(alongAxis);
    const acrossValue=fromHigh?high:low;
    addDim(plan,edgeFeature(frame,host,crossAxis,fromHigh),pointFeature(frame,holes[0]),CV,markText(acrossValue),acrossValue,frame.screenSide(alongAxis,nearHighEnd),0);
    holes.forEach((p,index)=>addDim(plan,edgeFeature(frame,host,alongAxis,nearHighEnd),pointFeature(frame,p),AV,markText(said[index]),said[index],frame.screenSide(crossAxis,fromHigh),index));
    plan.legend.unshift({kind:'hole',text:'3/16" hole for a screw of the pull'});
  }else if(['slide','runner','kicker'].includes(row.kind)){
    plan=slideMarkPlan(row,letterOf);
  }
  if(plan){
    plan.words=row.line;
    addRefs(plan,letterOf);   // (the hinged edge is named by its job already, so it is not named twice)
  }
  return plan;
}
/* slides, runners and kickers: the inside face of the cabinet side, with the panel under the drawers */
function slideMarkPlan(row,letterOf){
  const riding=ridingPieces(),kicker=row.kind==='kicker',item=row.items[0];
  const side=kicker?byId(item.on):byId(item.to);
  if(!side)return null;
  const mine=row.items.filter(other=>(kicker?other.on:other.to)===side.id);
  const sideBox=plainBox(side),inner=side.ax[2];
  // the face the strips are on: the side of the panel where the first one sits (not the middle of the design: a
  // drawer case at one end of a desk has the knee space beside it)
  const insideSign=hardwarePose(mine[0]).at.getComponent(inner)>(sideBox.lo[inner]+sideBox.hi[inner])/2?1:-1;
  const frame=markingFrame(inner,-insideSign,side);
  const travel=[0,2].find(k=>k!==inner);
  const plan=newMarkPlan(frame,side,letterOf,kicker?'Where the kickers go':row.kind==='runner'?'Where the runners go':'Where the slides go');
  plan.subtitle=`${pieceLabel(side,letterOf)}, inside face, ${frame.seen.replace(' (from inside)','')} (from inside the cabinet)`;
  const front=hardwareFrontEdge(side,travel);
  const TV=frame.viewAxis(travel),HV=frame.viewAxis(1);
  const shown=new Set();
  const rows=[];
  mine.forEach(other=>{
    const pose=hardwarePose(other);
    let height,base,under;
    if(kicker){
      height=pose.at.y-(other.geo&&other.geo.mid?DRAWER.runnerStrip/2:0);
      under=panelUnder(side,height-.5,riding);
    }else{
      const facts=drawerFacts(other.on);
      if(!facts)return;
      height=facts.slideHeight;
      under=panelUnder(side,height-(row.kind==='runner'?DRAWER.runnerStrip:.5),riding);
    }
    base=under?under.top:sideBox.lo[1];
    // the strip or the slide itself, from its front end back
    const frontEnd=pose.at.getComponent(travel)+front.outward*other.size/2;
    const lo=[0,0,0],hi=[0,0,0];
    lo[inner]=hi[inner]=0;
    lo[travel]=Math.min(frontEnd,frontEnd-front.outward*other.size);hi[travel]=Math.max(frontEnd,frontEnd-front.outward*other.size);
    const body=row.kind==='slide'?[height-SLIDE_BODY/2,height+SLIDE_BODY/2]:row.kind==='runner'?[height-DRAWER.runnerStrip,height]:[height,height+DRAWER.runnerStrip];
    lo[1]=body[0];hi[1]=body[1];
    const a=frame.toView(lo),b=frame.toView(hi);
    const rect={lo:[Math.min(a[0],b[0]),Math.min(a[1],b[1])],hi:[Math.max(a[0],b[0]),Math.max(a[1],b[1])]};
    plan.bars.push({rect,kind:row.kind,mid:row.kind==='slide'?height:null});
    if(under&&!shown.has(under.piece.id)){
      shown.add(under.piece.id);
      plan.others.push({piece:under.piece,rect:viewRectOf(under.piece,frame),hidden:false,label:pieceLabel(under.piece,letterOf)});
    }
    rows.push({height,base,under,frontEnd,rect});
  });
  if(!rows.length)return null;
  rows.sort((a,b)=>a.height-b.height);
  const place=frame.screenSide(travel,front.outward>0);
  rows.forEach((one,index)=>{
    const baseFeature=one.under?edgeFeature(frame,one.under.piece,1,true):edgeFeature(frame,side,1,false);
    // the measured line of the strip: the middle of a slide, the top of a runner, the underside of a kicker
    const measured={kind:'edge',c:one.height,rect:{lo:[one.rect.lo[0],one.height],hi:[one.rect.hi[0],one.height]},piece:null,axis:1,high:false,line:true};
    addDim(plan,baseFeature,measured,HV,markText(one.height-one.base),one.height-one.base,place,index);
  });
  // how far back the front end is from the front edge of the side (the first one; the line gives one number)
  const setBack=Math.abs(front.edge-rows[0].frontEnd);
  // a set-back under 1/4" cannot be seen drawn to scale (its two extension lines would touch): it is given in a note
  const noun=row.kind==='kicker'?'kicker':row.kind==='runner'?'runner':'slide';
  if(setBack>.03&&setBack<SMALLEST_DRAWN)plan.notes.push(`Set the front end of each ${noun} ${markText(setBack)} back from the front edge of the ${side.name} (too small to draw to scale here).`);
  else if(setBack>.03){
    const endFeature={kind:'edge',c:rows[0].frontEnd*frame.signOf(travel),rect:rows[0].rect,piece:null,axis:travel,high:false,line:true};
    addDim(plan,edgeFeature(frame,side,travel,front.outward>0),endFeature,TV,markText(setBack),setBack,'top',0);
  }
  plan.legend.unshift({kind:'bar',text:row.kind==='slide'?'cabinet half of a slide (dash-dot: its row of screw holes)':row.kind==='runner'?'runner: its top edge is measured':'kicker: its underside is measured'});
  return plan;
}

/* ---------- the marking view of the pencil marks of a marking step ---------- */
/* lines: from markingLines (js/steppictures.js), [{piece, from, to, text}] in design inches. One piece is drawn
   (the marks are the same on each piece the step marks), with each height measured up from its bottom end. */
function marksMarkPlan(lines,letterOf,words){
  if(!lines.length)return null;
  const piece=lines[0].piece,own=lines.filter(line=>line.piece===piece);
  const k=[0,2].find(axis=>Math.abs(own[0].from[axis]-own[0].to[axis])<1e-6);
  const b=plainBox(piece),plane=own[0].from[k],center=(b.lo[k]+b.hi[k])/2;
  const frame=markingFrame(k,plane<center?1:-1,piece);
  const plan=newMarkPlan(frame,piece,letterOf,'The pencil marks');
  plan.subtitle=`${pieceLabel(piece,letterOf)}, the face the pieces meet, ${frame.seen}`;
  const HV=frame.viewAxis(1);
  const sortedLines=own.slice().sort((one,two)=>one.from[1]-two.from[1]);
  const across=[0,2].find(axis=>axis!==k);
  const place=frame.screenSide(across,false);
  sortedLines.forEach((line,index)=>{
    const a=frame.toView(line.from),c=frame.toView(line.to);
    plan.pencils.push([a,c]);
    const measured={kind:'edge',c:line.from[1],rect:{lo:[Math.min(a[0],c[0]),a[1]],hi:[Math.max(a[0],c[0]),a[1]]},piece:null,axis:1,high:false,line:true};
    // three or more heights are running sizes: one line up from the bottom end, each number at its own tick (a
    // stack of eight would not fit beside the piece)
    const running=sortedLines.length>2;
    addDim(plan,edgeFeature(frame,piece,1,false),measured,HV,line.text,line.from[1]-piece.pos[1],place,running?0:index);
    if(running)plan.dims[plan.dims.length-1].running=true;
  });
  if(sortedLines.length>2)plan.legend.push({kind:'datum',text:'running sizes: each from the bottom end (the small circle)'});
  plan.legend.unshift({kind:'pencil',text:'pencil mark: the underside of a piece sits on it, on the side of the X'});
  const names=[...new Set(lines.map(line=>line.piece.name))];
  const count=new Set(lines.map(line=>line.piece.id)).size;
  if(count>1)plan.notes.push(`Mark ${count===2?'both':'all '+count} ${pluralName(names[0])} the same way, with their bottom ends lined up.`);
  plan.words=words||'';
  addRefs(plan,letterOf);
  return plan;
}

/* ---------- laying a plan out on the paper ---------- */
let markCanvas=null;
function markContext(){
  if(!markCanvas){markCanvas=document.createElement('canvas');markCanvas.width=MARK_VIEW.width;markCanvas.height=MARK_VIEW.height;}
  return markCanvas.getContext('2d');
}
const rectsOverlap=(a,b,gap)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
/* does the segment a-b pass through the rectangle (grown by gap)? */
function segmentHitsRect(a,b,rect,gap){
  const x0=rect.x-gap,x1=rect.x+rect.w+gap,y0=rect.y-gap,y1=rect.y+rect.h+gap;
  let t0=0,t1=1;
  const dx=b[0]-a[0],dy=b[1]-a[1];
  for(const[p,q]of[[-dx,a[0]-x0],[dx,x1-a[0]],[-dy,a[1]-y0],[dy,y1-a[1]]]){
    if(Math.abs(p)<1e-9){if(q<0)return false;continue;}
    const t=q/p;
    if(p<0){if(t>t1)return false;if(t>t0)t0=t;}else{if(t<t0)return false;if(t<t1)t1=t;}
  }
  return t0<=t1;
}
/* Does the segment run beside an extension line or a dimension line of the layout: nearly parallel to it (within
   about 15 degrees), within LEADER_KEEP_OFF pixels of it, over some of its length? A leader that does reads as one
   more extension line (the leader of a name dropped beside the extension line of the first nail). */
const LEADER_KEEP_OFF=20,LEADER_LONGEST=190;
/* does a leader run along the edge it names (and so cannot be seen on it)? nearly parallel and within 6 px */
function leaderAlongEdge([a,b],[p,q]){
  const dx=b[0]-a[0],dy=b[1]-a[1],long=Math.hypot(dx,dy),ex=q[0]-p[0],ey=q[1]-p[1],elong=Math.hypot(ex,ey);
  if(long<1||elong<1)return false;
  if(Math.abs(dx/long*ey/elong-dy/long*ex/elong)>Math.sin(15*Math.PI/180))return false;
  return Math.abs((a[0]-p[0])*ey/elong-(a[1]-p[1])*ex/elong)<6;
}
/* do two segments cross (or touch)? */
function segmentsCross([a,b],[c,d]){
  const side=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));
  return side(a,b,c)!==side(a,b,d)&&side(c,d,a)!==side(c,d,b);
}
function runsAlongSizes(layout,segment){
  const[a,b]=segment,dx=b[0]-a[0],dy=b[1]-a[1],long=Math.hypot(dx,dy);
  if(long<1)return false;
  const unit=[dx/long,dy/long];
  const lines=[];
  for(const laid of layout.dims){lines.push(laid.line);for(const ext of laid.ext)lines.push([ext.from,ext.to]);}
  return lines.some(([p,q])=>{
    const ex=q[0]-p[0],ey=q[1]-p[1],elong=Math.hypot(ex,ey);
    if(elong<1)return false;
    if(Math.abs(unit[0]*ey/elong-unit[1]*ex/elong)>Math.sin(15*Math.PI/180))return false;   // not parallel
    // how far apart, square to the line, and whether they overlap along it
    const across=Math.abs((a[0]-p[0])*ey/elong-(a[1]-p[1])*ex/elong);
    if(across>LEADER_KEEP_OFF)return false;
    const along=point=>((point[0]-p[0])*ex+(point[1]-p[1])*ey)/elong;
    const s0=Math.min(along(a),along(b)),s1=Math.max(along(a),along(b));
    return s1>2&&s0<elong-2;
  });
}
/* The entries of a legend, each made short enough to fit on one line of the picture. An entry whose words are
   wider than the picture ("bottom edge of Side rail (D), the edge nearest the screws: the heavy line at the
   bottom") is broken between words: its first part keeps the symbol, each further part is an entry of kind 'cont'
   (no symbol, its words lined up with the words above). The picture never cuts a word off at its right edge.
     entries      [{kind, text}]
     textWidth    text -> its width in picture pixels
     room         the width of one line of the legend, symbol included */
const LEGEND_SYMBOL_WIDTH=40;   // the symbol and the space after it, in picture pixels (the words start 38 in)
function legendParts(entries,textWidth,room){
  const parts=[];
  for(const entry of entries){
    if(textWidth(entry.text)+LEGEND_SYMBOL_WIDTH<=room){parts.push(entry);continue;}
    let kind=entry.kind,line='';
    for(const word of entry.text.split(' ')){
      const longer=line?line+' '+word:word;
      if(line&&textWidth(longer)+LEGEND_SYMBOL_WIDTH>room){parts.push({...entry,kind,text:line,whole:entry.text});kind='cont';line=word;}
      else line=longer;
    }
    if(line)parts.push({...entry,kind,text:line,whole:entry.text});
  }
  return parts;
}
/* Everything in picture pixels:{plan, scale, px(u, v), box (the piece on paper), dims: [{dim, line:[a, b],
   ext:[{from, to, feature}], text:{x, y, w, h, text}, leader}], refs: [{label rect, edge}], texts: [all text
   rects], markers: [rects], segments: [[a, b]], legend, clashes: [what could not be placed clear of the rest]} */
/* inLegend: the names of edges that found no clear place beside their edge on a first try: they are written in the
   legend under the picture instead ("top end of Post (A): the heavy line at the top"), so no text covers another */
/* room: extra room past the rows of sizes on each side, for numbers that did not fit on a first try (each pass gives
   a side one more row, at most two) */
function layoutMarkPlan(plan,inLegend,room,withRowNote){
  const V=MARK_VIEW,ctx=markContext(),frame=plan.frame;
  const measure=(text,size,bold)=>{ctx.font=`${bold?600:400} ${size}px ${PICTURE_FONT}`;return Math.ceil(ctx.measureText(text).width);};
  const out={plan,dims:[],refs:[],texts:[],markers:[],segments:[],clashes:[],breaks:[]};
  inLegend=inLegend||new Set();
  room=room||{top:0,bottom:0,left:0,right:0};
  const failedNames=[],failedPlaces=new Map();   // side -> pixels more room it needs

  /* the rows of dimension lines on each side of the piece, and the room they take */
  const rows={top:[],bottom:[],left:[],right:[]};
  for(const dim of plan.dims){
    // ("3 spaces at 4 5/8"" beside an upright line is written on two lines, so the row of sizes is not as wide)
    dim.lines=dim.measure===1&&dim.count>1?dim.text.replace(/ spaces at /,' spaces\nat ').split('\n'):[dim.text];
    dim.w=Math.max(...dim.lines.map(line=>measure(line,V.number,true)));
    dim.h=dim.lines.length*V.number+(dim.lines.length-1)*4;
    const list=rows[dim.place]||rows.top;
    while(list.length<=dim.row)list.push({dims:[],width:0});
    list[dim.row].dims.push(dim);
    list[dim.row].width=Math.max(list[dim.row].width,dim.w);
  }
  for(const place of['top','bottom','left','right'])rows[place]=rows[place].filter(row=>row.dims.length);
  const offsets={};
  for(const place of['top','bottom','left','right']){
    let at=V.firstRow+(place==='bottom'?V.number+8:0);
    offsets[place]=rows[place].map(row=>{
      const here=at;
      at+=place==='left'||place==='right'?row.width+V.sideGap+12:V.rowStep;
      return here;
    });
    const list=rows[place];
    offsets[place].band=(list.length?(place==='left'||place==='right'?offsets[place][list.length-1]+list[list.length-1].width+16:place==='top'?offsets[place][list.length-1]+V.number+12:offsets[place][list.length-1]+10):10)+room[place];
  }

  /* the legend and the notes along the bottom */
  const legendLines=[];
  {
    let line=[],width=0;
    // which heavy line it is, in words: dashed or not, at which side, and the outer or the inner one when two of
    // one kind are at one side (the bottom end of a post and the bottom edge of a rail behind it)
    const sideOf=ref=>frame.screenSide(ref.feature.axis,ref.feature.high);
    const whichLine=ref=>{
      const side=sideOf(ref),dashed=!!ref.hidden;
      const alike=plan.refs.filter(other=>sideOf(other)===side&&!!other.hidden===dashed);
      let order='';
      if(alike.length>1){
        // the outer one is furthest out on that side (view coordinates run right and up)
        const outwardSign=side==='top'||side==='right'?-1:1;
        const sorted=alike.slice().sort((a,b)=>(a.feature.c-b.feature.c)*outwardSign);
        order=sorted.indexOf(ref)===0?'outer ':'inner ';
      }
      return`the ${order}heavy ${dashed?'dashed ':''}line at the ${side}`;
    };
    const moved=plan.refs.filter(ref=>inLegend.has(ref.label)).map(ref=>({kind:ref.hidden?'heavyDashed':'heavy',text:`${ref.label}: ${whichLine(ref)}`}));
    for(const entry of legendParts(moved.concat(plan.legend),text=>measure(text,V.legend,false),V.width-2*V.pad)){
      const w=measure(entry.text,V.legend,false)+40;
      if(line.length&&width+w>V.width-2*V.pad){legendLines.push(line);line=[];width=0;}
      line.push({...entry,w});width+=w+18;
    }
    if(line.length)legendLines.push(line);
  }
  out.legendRoom=V.width-2*V.pad;   // (for the self-check legendStaysInItsPicture)
  // the notes, broken into lines that fit the paper
  const noteLines=[];
  // (withRowNote: 'between' when a break leaves out the ones in the middle of the row, else the picture ends first)
  const rowNoteEnd=withRowNote==='between'?' (the break in the picture leaves out the ones in between).':' (the picture shows the first few).';
  for(const note of plan.notes.concat(withRowNote?[plan.rowNote+rowNoteEnd]:[])){
    let line='';
    for(const word of note.split(' ')){
      const longer=line?line+' '+word:word;
      if(line&&measure(longer,V.legend,false)>V.width-2*V.pad){noteLines.push(line);line=word;}else line=longer;
    }
    if(line)noteLines.push(line);
  }
  const bottomH=(legendLines.length+noteLines.length)*(V.legend+8)+8;
  // the picture is as tall as it needs to be for the drawing to keep at least drawMin pixels above the legend and
  // the notes (a view with many notes is taller, never a smaller drawing)
  // (room.extraH: more height, asked for below when the smallest size would be drawn too short to see)
  // (and the rows of sizes above and below it never leave the drawing less than half of drawMin: seven sizes
  // stacked from one end of an apron, each on its own row, make a taller picture)
  const sizeBands=offsets.top.band+offsets.bottom.band;
  const H=Math.max(V.height,V.titleH+V.drawMin+bottomH,V.titleH+sizeBands+V.drawMin/2+bottomH)+(room.extraH||0);
  out.height=H;

  /* the window: the whole piece when it fits at a size where its smallest number has room, else the part near the
     fasteners and the edges they are measured from, broken off where the piece goes on */
  const area={x0:V.pad+offsets.left.band,x1:V.width-V.pad-offsets.right.band,y0:V.titleH+offsets.top.band,y1:H-bottomH-offsets.bottom.band};
  const aw=Math.max(60,area.x1-area.x0),ah=Math.max(60,area.y1-area.y0);
  // the marked piece, and up to 1 1/2" of a piece beside it (the leg an apron is pocket-screwed to), for context
  const piece={lo:plan.rect.lo.slice(),hi:plan.rect.hi.slice()};
  for(const other of plan.others){
    if(other.hidden)continue;
    for(let k=0;k<2;k++){
      const overlaps=other.rect.lo[1-k]<plan.rect.hi[1-k]-.01&&other.rect.hi[1-k]>plan.rect.lo[1-k]+.01;
      if(!overlaps)continue;
      if(other.rect.hi[k]>plan.rect.hi[k]+.01&&other.rect.lo[k]<=plan.rect.hi[k]+.01)piece.hi[k]=Math.max(piece.hi[k],Math.min(other.rect.hi[k],plan.rect.hi[k]+1.5));
      if(other.rect.lo[k]<plan.rect.lo[k]-.01&&other.rect.hi[k]>=plan.rect.lo[k]-.01)piece.lo[k]=Math.min(piece.lo[k],Math.max(other.rect.lo[k],plan.rect.lo[k]-1.5));
    }
  }
  const focus={lo:[1e9,1e9],hi:[-1e9,-1e9]};
  const take=(u,v)=>{if(u!==null){focus.lo[0]=Math.min(focus.lo[0],u);focus.hi[0]=Math.max(focus.hi[0],u);}if(v!==null){focus.lo[1]=Math.min(focus.lo[1],v);focus.hi[1]=Math.max(focus.hi[1],v);}};
  for(const point of plan.points)if(point.focus!==false)take(point.at[0],point.at[1]);
  for(const bar of plan.bars){take(bar.rect.lo[0],bar.rect.lo[1]);take(bar.rect.hi[0],bar.rect.hi[1]);}
  for(const line of plan.pencils)for(const p of line)take(p[0],p[1]);
  for(const dim of plan.dims)for(const feature of[dim.a,dim.b]){
    if(feature.kind==='point')take(feature.at[0],feature.at[1]);
    else if(dim.measure===0)take(feature.c,null);else take(null,feature.c);
  }
  if(focus.lo[0]>focus.hi[0]){focus.lo=piece.lo.slice();focus.hi=piece.hi.slice();}
  // the edges sizes are measured from are kept in: across them the focus reaches the outline
  for(const dim of plan.dims)for(const feature of[dim.a,dim.b]){
    if(feature.kind!=='edge')continue;
    const across=1-dim.measure,r=feature.rect;
    take(...(across===0?[Math.max(r.lo[0],Math.min(r.hi[0],(focus.lo[0]+focus.hi[0])/2)),null]:[null,Math.max(r.lo[1],Math.min(r.hi[1],(focus.lo[1]+focus.hi[1])/2))]));
  }
  /* A break in the middle: when what is measured sits in two clusters far apart along one direction (a bottom end
     20" below two screws), the length between them is left out, between two break lines, so the sizes near the
     screws are drawn large. A size across the break keeps its full number (the way a broken view is dimensioned).
     cuts[k]: [{from, to}] in view inches along k (u for 0, v for 1), the parts left out, low to high. Every gap
     that is long enough is left out (the screws in the middle of a long apron: a break on each side of them). */
  const cuts=[[],[]];
  // (not in the corner of a sheet: it is shown as it is, and broken off where it goes on)
  for(let k=0;k<2&&!plan.cornerOnly;k++){
    const along=[];
    for(const point of plan.points)if(point.focus!==false)along.push(point.at[k]);
    for(const bar of plan.bars)along.push(bar.rect.lo[k],bar.rect.hi[k]);
    for(const line of plan.pencils)for(const p of line)along.push(p[k]);
    for(const dim of plan.dims)for(const feature of[dim.a,dim.b]){
      if(feature.kind==='point')along.push(feature.at[k]);
      else if(dim.measure===k)along.push(feature.c);
    }
    const sorted=[...new Set(along.map(value=>Math.round(value*100)/100))].sort((a,b)=>a-b);
    if(sorted.length<2)continue;
    const extent=sorted[sorted.length-1]-sorted[0];
    // (never through the length of a slide or along a pencil mark: they are drawn whole)
    const wholeSpans=plan.bars.map(bar=>[bar.rect.lo[k],bar.rect.hi[k]]).concat(plan.pencils.map(line=>[Math.min(line[0][k],line[1][k]),Math.max(line[0][k],line[1][k])]));
    for(let i=1;i<sorted.length;i++){
      if(wholeSpans.some(([lo,hi])=>lo<=sorted[i-1]+.01&&hi>=sorted[i]-.01))continue;
      const gap=sorted[i]-sorted[i-1],keep=Math.min(BREAK.keepMost,Math.max(BREAK.keep,gap*.08));   // (drawn on each side of the break)
      if(gap-2*keep>Math.max(BREAK.least,extent*BREAK.share))cuts[k].push({from:sorted[i-1]+keep,to:sorted[i]-keep});
    }
  }
  // where a view coordinate lands once the cuts are left out: gapIn is the room a break takes, in inches at the
  // scale of the picture (it is worked out again below once the scale is known)
  let gapIn=[0,0];
  const squeeze=(value,k)=>{
    let shift=0;
    for(const cut of cuts[k]){
      if(value<=cut.from)break;
      if(value>=cut.to){shift+=(cut.to-cut.from)-gapIn[k];continue;}
      return cut.from-shift+(value-cut.from)/(cut.to-cut.from)*gapIn[k];
    }
    return value-shift;
  };
  const squeezed=(r)=>({lo:[squeeze(r.lo[0],0),squeeze(r.lo[1],1)],hi:[squeeze(r.hi[0],0),squeeze(r.hi[1],1)]});
  // the scale at which every number fits between its own extension lines (as far as that can be had); a size
  // across a break is drawn shorter than it is and is left out of this
  const across=dim=>[dim.a,dim.b].map(feature=>feature.kind==='point'?feature.at[dim.measure]:feature.c);
  // the cuts a size runs across
  const cutsSpanned=dim=>{const[a,b]=across(dim);return cuts[dim.measure].filter(cut=>Math.min(a,b)<=cut.from+1e-6&&Math.max(a,b)>=cut.to-1e-6);};
  const needs=plan.dims.filter(dim=>dim.value*dim.count>.01&&!cutsSpanned(dim).length).map(dim=>(dim.measure===0?dim.w+16:dim.h+10)/(dim.value*dim.count));
  // (running sizes: their numbers, one at each tick, need the room of a number between two ticks)
  const runningAt=plan.dims.filter(dim=>dim.running).map(dim=>dim.value).sort((a,b)=>a-b);
  for(let i=1;i<runningAt.length;i++)if(runningAt[i]-runningAt[i-1]>.01)needs.push((V.number+4)/(runningAt[i]-runningAt[i-1]));
  // (the scale the most demanding size needs: every number between its own lines; it was the least demanding one,
  // which let a 3/8" size on a 36" board be drawn 7 px long)
  const need=needs.length?Math.max(6,Math.min(V.maxScale,Math.max(...needs))):6;
  let win,scale;
  // twice: the room of the break depends on the scale, and the scale on the room of the break
  for(let pass=0;pass<3;pass++){
    const sp=squeezed(piece),sf=squeezed(focus);
    const pw=sp.hi[0]-sp.lo[0],ph=sp.hi[1]-sp.lo[1];
    const whole=Math.min(aw/(pw+.5),ah/(ph+.5));
    // (a sheet nailed by spacing shows one corner only: plan.cornerOnly)
    if(!plan.cornerOnly&&(whole>=need||(sf.hi[0]-sf.lo[0]>=pw*.8&&sf.hi[1]-sf.lo[1]>=ph*.8))){
      win={lo:[sp.lo[0]-.25,sp.lo[1]-.25],hi:[sp.hi[0]+.25,sp.hi[1]+.25]};
    }else{
      const margin=[Math.max(1.25,(sf.hi[0]-sf.lo[0])*.15),Math.max(1.25,(sf.hi[1]-sf.lo[1])*.15)];
      win={lo:[sf.lo[0]-margin[0],sf.lo[1]-margin[1]],hi:[sf.hi[0]+margin[0],sf.hi[1]+margin[1]]};
      // never past the piece more than a little
      for(let k=0;k<2;k++){win.lo[k]=Math.max(win.lo[k],sp.lo[k]-.25);win.hi[k]=Math.min(win.hi[k],sp.hi[k]+.25);}
    }
    scale=Math.min(V.maxScale,aw/(win.hi[0]-win.lo[0]),ah/(win.hi[1]-win.lo[1]));
    // fill the paper the other way with more of the piece, so a long thin view is not a strip in the middle (not
    // the corner of a sheet: more of it would bring in rows that its sizes do not measure)
    for(let k=0;k<2&&!plan.cornerOnly;k++){
      const room=(k?ah:aw)/scale,size=win.hi[k]-win.lo[k];
      if(room<=size+.01)continue;
      const grow=room-size,lowSpace=Math.max(0,win.lo[k]-(sp.lo[k]-.25)),highSpace=Math.max(0,sp.hi[k]+.25-win.hi[k]);
      let before=Math.min(grow/2,lowSpace);
      const after=Math.min(grow-before,highSpace);
      before+=Math.min(grow-before-after,lowSpace-before);
      win.lo[k]-=before;win.hi[k]+=after;
    }
    const wanted=[0,1].map(k=>cuts[k].length?BREAK.room/scale:0);
    if(pass===2||wanted.every((value,k)=>Math.abs(value-gapIn[k])<1e-4))break;
    gapIn=wanted;
  }
  /* A size drawn shorter than leastDrawn cannot be read (its two extension lines run together). When the height
     of the picture is what holds the scale down, the picture is made taller (up to tallest) and laid out again. */
  if((room.heightPasses||0)<3){
    const shortest=Math.min(...plan.dims.filter(dim=>!cutsSpanned(dim).length&&dim.value>.01).map(dim=>dim.value*dim.count));
    const byHeight=ah/(win.hi[1]-win.lo[1])<=aw/(win.hi[0]-win.lo[0])+1e-6&&scale<V.maxScale-1e-6;
    if(isFinite(shortest)&&shortest*scale<V.leastDrawn&&byHeight){
      const wanted=Math.min(V.maxScale,V.leastDrawn*1.1/shortest);
      const extra=Math.min(V.tallest-H,(wanted/scale-1)*ah+4);
      if(extra>2)return layoutMarkPlan(plan,inLegend,{...room,extraH:(room.extraH||0)+extra,heightPasses:(room.heightPasses||0)+1},withRowNote);
    }
  }
  const drawnW=(win.hi[0]-win.lo[0])*scale,drawnH=(win.hi[1]-win.lo[1])*scale;
  const x0=area.x0+(aw-drawnW)/2,y0=area.y0+(ah-drawnH)/2;
  const px=(u,v)=>[x0+(squeeze(u,0)-win.lo[0])*scale,y0+(win.hi[1]-squeeze(v,1))*scale];
  out.scale=scale;out.px=px;out.win=win;
  // the breaks in picture pixels, and what a size across one measures: its length on the paper, less the room of
  // the break, plus the length left out
  // (each break: at, the two break lines in picture pixels, smaller first)
  out.cuts=cuts.flatMap((list,k)=>list.map(cut=>({axis:k,from:cut.from,to:cut.to,left:cut.to-cut.from,room:gapIn[k]*scale,
    at:[k?px(0,cut.to)[1]:px(cut.from,0)[0],k?px(0,cut.from)[1]:px(cut.to,0)[0]]})));
  out.inchesOf=laid=>{
    const onPaper=laid.horizontal?Math.abs(laid.line[1][0]-laid.line[0][0]):Math.abs(laid.line[1][1]-laid.line[0][1]);
    const spanned=cutsSpanned(laid.dim);
    return(onPaper-spanned.length*gapIn[laid.dim.measure]*scale)/scale+spanned.reduce((sum,cut)=>sum+cut.to-cut.from,0);
  };
  const clipRect=raw=>{
    const r=squeezed(raw);
    const lo=[Math.max(r.lo[0],win.lo[0]),Math.max(r.lo[1],win.lo[1])],hi=[Math.min(r.hi[0],win.hi[0]),Math.min(r.hi[1],win.hi[1])];
    if(lo[0]>=hi[0]||lo[1]>=hi[1])return null;
    const a=[x0+(lo[0]-win.lo[0])*scale,y0+(win.hi[1]-hi[1])*scale],b=[x0+(hi[0]-win.lo[0])*scale,y0+(win.hi[1]-lo[1])*scale];
    return{x:a[0],y:a[1],w:b[0]-a[0],h:b[1]-a[1],cut:{left:r.lo[0]<win.lo[0]-1e-6,right:r.hi[0]>win.hi[0]+1e-6,bottom:r.lo[1]<win.lo[1]-1e-6,top:r.hi[1]>win.hi[1]+1e-6}};
  };
  // the same for a line (a rectangle with no height or no width: the measured line of a slide, a pencil mark)
  const boundsPx=raw=>{
    const r=squeezed(raw);
    const lo=[Math.max(r.lo[0],win.lo[0]),Math.max(r.lo[1],win.lo[1])],hi=[Math.min(r.hi[0],win.hi[0]),Math.min(r.hi[1],win.hi[1])];
    const a=[x0+(lo[0]-win.lo[0])*scale,y0+(win.hi[1]-hi[1])*scale],b=[x0+(hi[0]-win.lo[0])*scale,y0+(win.hi[1]-lo[1])*scale];
    return{x:a[0],y:a[1],w:Math.max(0,b[0]-a[0]),h:Math.max(0,b[1]-a[1])};
  };
  const inWin=(u,v)=>{const s=[squeeze(u,0),squeeze(v,1)];return s[0]>=win.lo[0]-1e-6&&s[0]<=win.hi[0]+1e-6&&s[1]>=win.lo[1]-1e-6&&s[1]<=win.hi[1]+1e-6;};
  out.box=clipRect(plan.rect);
  out.others=plan.others.map(other=>({...other,box:clipRect(other.rect)})).filter(other=>other.box);
  out.bars=plan.bars.map(bar=>({...bar,box:clipRect(bar.rect)})).filter(bar=>bar.box);
  const box=out.box;
  // the outline of the piece and the others are things a text must not cross
  const edgesOf=b=>[[[b.x,b.y],[b.x+b.w,b.y]],[[b.x+b.w,b.y],[b.x+b.w,b.y+b.h]],[[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]],[[b.x,b.y],[b.x,b.y+b.h]]];
  if(box)out.segments.push(...edgesOf(box));
  for(const other of out.others)out.segments.push(...edgesOf(other.box));
  for(const bar of out.bars)out.segments.push(...edgesOf(bar.box));
  for(const[a,b]of plan.centers.concat(plan.pencils))out.segments.push([px(...a),px(...b)]);
  if(box)for(const side of['left','right','top','bottom'])if(box.cut[side])out.breaks.push(side);
  // the break lines of a break in the middle are lines a text must not cross either
  for(const cut of out.cuts)if(cut&&box){
    for(const at of cut.at)out.segments.push(cut.axis===0?[[at,box.y-6],[at,box.y+box.h+6]]:[[box.x-6,at],[box.x+box.w+6,at]]);
  }
  // fasteners
  out.points=plan.points.map(point=>{
    const at=px(point.at[0],point.at[1]),r=Math.max(point.kind==='hole'?point.r*scale:0,7);
    const marker={x:at[0]-r-4,y:at[1]-r-4,w:2*r+8,h:2*r+8};
    // (a fastener in the length a break leaves out is not drawn: the note under the picture gives the whole row)
    const inBreak=[0,1].some(k=>cuts[k].some(cut=>point.at[k]>cut.from+1e-6&&point.at[k]<cut.to-1e-6));
    const inside=inWin(point.at[0],point.at[1])&&!inBreak;
    if(inside)out.markers.push(marker);
    const slot=point.slot?px(point.slot[0],point.slot[1]):null;
    // (the slot runs both ways from the mouth, to slot and to its mirror)
    if(slot&&inside){
      const back=[2*at[0]-slot[0],2*at[1]-slot[1]];
      out.markers.push({x:Math.min(back[0],slot[0])-r-4,y:Math.min(back[1],slot[1])-r-4,w:Math.abs(slot[0]-back[0])+2*r+8,h:Math.abs(slot[1]-back[1])+2*r+8});
    }
    return{...point,px:at,radius:r,slotPx:slot,inside};
  });
  out.cutRow=out.points.some(point=>!point.inside);
  // a row that goes on past the picture: its count and spacing are written under it (laid out again to make room)
  if(out.cutRow&&plan.rowNote&&!withRowNote){
    const outsideOnly=out.points.some(point=>!point.inside&&!inWin(point.at[0],point.at[1]));
    return layoutMarkPlan(plan,inLegend,room,outsideOnly?'first':'between');
  }

  /* the dimension lines, their extension lines and ticks */
  // (outside the marked piece and the piece drawn beside it, so a row of sizes never runs over a piece)
  const around=clipRect(piece);
  const sideBase=place=>{
    const b=around||box||{x:x0,y:y0,w:drawnW,h:drawnH};
    return place==='top'?b.y:place==='bottom'?b.y+b.h:place==='left'?b.x:b.x+b.w;
  };
  const outward=place=>place==='top'||place==='left'?-1:1;
  for(const place of['top','bottom','left','right']){
    rows[place].forEach((row,index)=>{
      const lineAt=sideBase(place)+outward(place)*offsets[place][index];
      for(const dim of row.dims){
        const horizontal=dim.measure===0;   // a size measured left to right: its line runs across, above or below the piece
        const along=feature=>feature.kind==='point'?(horizontal?px(feature.at[0],0)[0]:px(0,feature.at[1])[1]):(horizontal?px(feature.c,0)[0]:px(0,feature.c)[1]);
        const ends=[dim.a,dim.b].map(feature=>{
          const c=along(feature);
          // where the extension line starts: just off the fastener, or off the end of the edge nearest this side
          let start,object;
          if(feature.kind==='point'){
            const p=px(feature.at[0],feature.at[1]),radius=out.points.reduce((r,point)=>Math.hypot(point.px[0]-p[0],point.px[1]-p[1])<1?point.radius:r,7);
            object=horizontal?p[1]:p[0];
            start=object+outward(place)*(radius+V.extGap);
          }else{
            const r=boundsPx(feature.rect);
            object=place==='top'?r.y:place==='bottom'?r.y+r.h:place==='left'?r.x:r.x+r.w;
            start=object+outward(place)*V.extGap;
          }
          const end=lineAt+outward(place)*V.extOver;
          return{c,object,from:horizontal?[c,start]:[start,c],to:horizontal?[c,end]:[end,c],feature};
        });
        const a=horizontal?[ends[0].c,lineAt]:[lineAt,ends[0].c],b=horizontal?[ends[1].c,lineAt]:[lineAt,ends[1].c];
        const lineSegment=[a,b];
        out.dims.push({dim,line:lineSegment,lineAt,horizontal,place,ext:ends.map(end=>({from:end.from,to:end.to,object:end.object,feature:end.feature})),text:null,leader:null});
        out.segments.push(lineSegment);
        for(const end of ends)out.segments.push([end.from,end.to]);
      }
    });
  }

  /* the numbers: centered on their own line; outside it with a leader when they do not fit, clear of the rest */
  const titleRect={x:0,y:0,w:V.width,h:V.titleH-8};
  // (the legend and the notes along the bottom are kept clear too)
  const clear=(rect,ownLine)=>rect.x>=2&&rect.y>=V.titleH-6&&rect.x+rect.w<=V.width-2&&rect.y+rect.h<=H-bottomH-2&&
    !rectsOverlap(rect,titleRect,0)&&!out.texts.some(other=>rectsOverlap(rect,other,4))&&!out.markers.some(other=>rectsOverlap(rect,other,1))&&
    !out.segments.some(seg=>seg!==ownLine&&segmentHitsRect(seg[0],seg[1],rect,2));
  // the numbers that fit between their extension lines first; then the others, which go past an end of their line
  const fits=laid=>{
    const[a,b]=laid.line;
    return laid.horizontal?laid.dim.w+12<=Math.abs(b[0]-a[0]):laid.dim.h+8<=Math.abs(b[1]-a[1]);
  };
  // an end of a line that no other line of the same row shares: a number put out there is in nobody's way
  const freeEnd=(laid,coordinate)=>!out.dims.some(other=>other!==laid&&other.place===laid.place&&Math.abs(other.lineAt-laid.lineAt)<1&&
    other.line.some(end=>Math.abs((laid.horizontal?end[0]:end[1])-coordinate)<1.5));
  const ordered=out.dims.filter(fits).concat(out.dims.filter(laid=>!fits(laid)));
  for(const laid of ordered){
    const w=laid.dim.w,h=laid.dim.h,[a,b]=laid.line;
    const tries=[];
    if(laid.dim.running){
      /* running sizes (many heights from one bottom end, on one line): each number at the tick of its own end,
         outside the line, or slid along a little with a short leader to that tick */
      const end=b,outside=outward(laid.place);
      for(const slide of[0,-.6,.6,-1.2,1.2,-1.8,1.8]){
        if(laid.horizontal){
          const tx=end[0]-w/2+slide*(w+8),ty=laid.lineAt-5-h;
          tries.push({x:tx,y:ty,leader:slide?[[Math.max(tx,Math.min(tx+w,end[0])),ty+h+2],end]:null});
        }else{
          const tx=outside<0?laid.lineAt-12-w:laid.lineAt+12,ty=end[1]-h/2+slide*(h+4);
          tries.push({x:tx,y:ty,leader:slide?[[outside<0?tx+w+2:tx-2,ty+h/2],end]:null});
        }
      }
    }else if(laid.horizontal){
      const left=Math.min(a[0],b[0]),right=Math.max(a[0],b[0]),y=laid.lineAt-5-h,mid=(left+right)/2;
      if(w+12<=right-left)for(const slide of[0,-.25,.25])tries.push({x:mid-w/2+slide*(right-left-w),y});
      const pastRight={x:right+12,y,leader:[[right,laid.lineAt],[right+10,laid.lineAt]]},pastLeft={x:left-12-w,y,leader:[[left,laid.lineAt],[left-10,laid.lineAt]]};
      // just past an end of its line only where no other line of the row goes on from that end (past a shared end
      // the number would sit beside the next line of the chain, and be read as its number)
      tries.push(...[pastRight,pastLeft].filter(t=>freeEnd(laid,t===pastRight?right:left)));
      // further out, away from the piece, tied to the middle of its own line
      for(const lift of[1,2,3])for(const shift of[0,-.6,.6,-1.2,1.2])tries.push({x:mid-w/2+shift*w,y:y+outward(laid.place)*lift*(h+12),leader:'mid'});
    }else{
      const top=Math.min(a[1],b[1]),bottom=Math.max(a[1],b[1]),mid=(top+bottom)/2,toLeft=laid.place==='left';
      const x=toLeft?laid.lineAt-12-w:laid.lineAt+12;
      if(h+8<=bottom-top)for(const slide of[0,-.3,.3,-.15,.15])tries.push({x,y:mid-h/2+slide*(bottom-top-h)});
      const below={x,y:bottom+8,leader:[[laid.lineAt,bottom],[laid.lineAt,bottom+8+h/2]]},above={x,y:top-8-h,leader:[[laid.lineAt,top],[laid.lineAt,top-8-h/2]]};
      tries.push(...[below,above].filter(t=>freeEnd(laid,t===below?bottom:top)));
      // further out, away from the piece, tied to the middle of its own line
      for(const step of[1,2,3])for(const drop of[0,-1,1,-2,2]){
        const tx=toLeft?x-step*(w+16):x+step*(w+16),ty=mid-h/2+drop*(h+6);
        tries.push({x:tx,y:ty,leader:[[laid.lineAt,mid],[toLeft?tx+w+2:tx-2,ty+h/2]]});
      }
    }
    // the leader that ties a number put away from its line back to it; it must not run through another text
    const leaderFor=t=>{
      if(t.leader!=='mid')return t.leader||null;
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      return[[Math.max(t.x,Math.min(t.x+w,mid[0])),t.y<mid[1]?t.y+h+2:t.y-2],mid];
    };
    const leaderClear=t=>{const seg=leaderFor(t);return!seg||!out.texts.some(rect=>segmentHitsRect(seg[0],seg[1],rect,1));};
    // a number moved out from its line is never put beside another line of the same row: a beginner would read
    // it as that line's number (markLayoutProblems checks the same)
    const ownSpan=laid.horizontal?[Math.min(a[0],b[0]),Math.max(a[0],b[0])]:[Math.min(a[1],b[1]),Math.max(a[1],b[1])];
    const besideOther=t=>{
      if(laid.dim.running)return false;   // (running sizes share one line: each number is at its own tick)
      const along=laid.horizontal?t.x+w/2:t.y+h/2;
      if(along>=ownSpan[0]-1&&along<=ownSpan[1]+1)return false;
      return out.dims.some(other=>other!==laid&&other.place===laid.place&&Math.abs(other.lineAt-laid.lineAt)<1&&(()=>{
        const s=laid.horizontal?[Math.min(other.line[0][0],other.line[1][0]),Math.max(other.line[0][0],other.line[1][0])]:[Math.min(other.line[0][1],other.line[1][1]),Math.max(other.line[0][1],other.line[1][1])];
        return along>s[0]+1&&along<s[1]-1;
      })());
    };
    let pick=tries.find(t=>clear({x:t.x,y:t.y,w,h},laid.line)&&leaderClear(t)&&!besideOther(t));
    if(!pick){
      pick=tries[0];out.clashes.push(`the number ${laid.dim.text}`);
      // laid out again with more room: another row on its side, and room past the free end of its line (a number
      // at the end of a chain that runs to the edge of the picture goes there)
      failedPlaces.set(laid.place,Math.max(failedPlaces.get(laid.place)||0,laid.horizontal?V.rowStep:w+16));
      const[low,high]=laid.horizontal?[Math.min(a[0],b[0]),Math.max(a[0],b[0])]:[Math.min(a[1],b[1]),Math.max(a[1],b[1])];
      // (both ends when both are free: past the high end the lines of other rows may stand in the way, as they do
      // for sizes stacked from one end of an apron, whose short ones go past the end they are measured from)
      const endSides=[];
      if(freeEnd(laid,high))endSides.push(laid.horizontal?'right':'bottom');
      if(freeEnd(laid,low))endSides.push(laid.horizontal?'left':'top');
      for(const endSide of endSides)if(endSide!==laid.place)failedPlaces.set(endSide,Math.max(failedPlaces.get(endSide)||0,laid.horizontal?w+28:h+20));
    }
    laid.text={x:pick.x,y:pick.y,w,h,text:laid.dim.text,lines:laid.dim.lines};
    laid.leader=leaderFor(pick);
    out.texts.push(laid.text);
    if(laid.leader)out.segments.push(laid.leader);
  }

  /* the names of the edges sizes are measured from: beside the heavy edge, inside the piece or just outside it */
  for(const ref of plan.refs){
    const feature=ref.feature,r=clipRect(feature.rect);
    if(!r)continue;
    const side=frame.screenSide(feature.axis,feature.high);
    const w=measure(ref.label,V.label,true),h=V.label;
    const edge=side==='top'?[[r.x,r.y],[r.x+r.w,r.y]]:side==='bottom'?[[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]]:side==='left'?[[r.x,r.y],[r.x,r.y+r.h]]:[[r.x+r.w,r.y],[r.x+r.w,r.y+r.h]];
    if(inLegend.has(ref.label)){out.refs.push({ref,rect:null,edge,leader:null,side});continue;}   // named in the legend
    /* Tried in this order: right beside the edge, then further off it with a leader to it, at places along the
       edge from its middle outward; inside the piece first (there is room there), then outside it, past the
       rows of sizes. The first place clear of every other text, fastener and line wins. */
    const tries=[],level=side==='top'||side==='bottom',inward=side==='top'||side==='left'?1:-1;
    // along the edge: nearest the rows of sizes first (a side edge measured at the top is named near the top)
    const sizesAt=place=>plan.dims.filter(dim=>dim.place===place).length;
    const lowFirst=level?sizesAt('left')>=sizesAt('right'):sizesAt('top')>=sizesAt('bottom');
    const shares=lowFirst?[.12,.3,.5,.7,.88,.02,.98]:[.88,.7,.5,.3,.12,.98,.02];
    // inside the piece only when it is roomy enough that the name does not crowd the marks (a thin rail gets it outside)
    const roomy=level?r.h>=h*3.2:r.w>=w+24;
    // beside an end of the edge, in line with it, outside the piece: "top end of Post (A)" written at the top end
    const beside=[];
    for(const gap of[10,(level?Math.max(offsets.left.band,offsets.right.band):Math.max(offsets.top.band,offsets.bottom.band))+10]){
      if(level){
        const y=(side==='top'?r.y:r.y+r.h)-h/2;
        beside.push({x:r.x+r.w+gap,y,anchor:[r.x+r.w,y+h/2],far:gap>12},{x:r.x-gap-w,y,anchor:[r.x,y+h/2],far:gap>12});
        // past all the wood drawn (an edge of a piece behind, inside the outline of the piece in front), a little
        // above or below the edge, with a slanted leader and a dot onto the end of the edge
        const woodRight=Math.max(...[box,...out.others.map(other=>other.box)].filter(Boolean).map(b=>b.x+b.w));
        const woodLeft=Math.min(...[box,...out.others.map(other=>other.box)].filter(Boolean).map(b=>b.x));
        const edgeY=side==='top'?r.y:r.y+r.h;
        for(const lift of[-1.1,1.1,-2.2,2.2])beside.push(
          {x:woodRight+gap+8,y:edgeY-h/2+lift*h,anchor:[r.x+r.w-3,edgeY],far:true},
          {x:woodLeft-gap-8-w,y:edgeY-h/2+lift*h,anchor:[r.x+3,edgeY],far:true});
      }else{
        // an end that stands upright: the name beside it, outside the piece, with a short leader and a dot on the
        // end (a name written above or below the piece, in line with the end, reads as the name of the edge
        // next to it)
        const edgeX=side==='left'?r.x:r.x+r.w;
        for(const share of shares){
          const y=Math.max(V.titleH,Math.min(H-h-4,r.y+share*r.h-h/2));
          beside.push({x:side==='left'?edgeX-gap-w:edgeX+gap,y,anchor:[edgeX,Math.max(r.y+2,Math.min(r.y+r.h-2,y+h/2))],far:true});
        }
        // or above or below the piece, off to the outside of the end, with a slanted leader down (or up) to a dot
        // near the top (or the bottom) of the end
        const reach=Math.min(r.h/2,40);
        // (how far the text sits out past the end, in widths of the text: wholly past it, so that the leader from its
        // corner slants down onto the end and is not lost along it)
        for(const out_ of[1,1.4]){
          const x=side==='left'?edgeX-out_*w-(out_>=1?gap:0):edgeX+(out_>=1?gap:0)+(out_-1)*w;
          const clamped=Math.min(V.width-w-4,Math.max(4,x));
          beside.push({x:clamped,y:r.y-gap-h-6,anchor:[edgeX,r.y+reach],far:true},
            {x:clamped,y:r.y+r.h+gap+6,anchor:[edgeX,r.y+r.h-reach],far:true});
        }
      }
    }
    for(const distance of roomy?[7]:[]){
      for(const share of shares){
        if(level){
          const x=Math.max(r.x+4,Math.min(r.x+r.w-w-4,r.x+share*r.w-w/2));
          tries.push({x,y:side==='top'?r.y+distance:r.y+r.h-distance-h,anchor:[x+w/2,side==='top'?r.y:r.y+r.h],far:false});
        }else{
          const y=Math.max(r.y+4,Math.min(r.y+r.h-h-4,r.y+share*r.h-h/2));
          tries.push({x:side==='left'?r.x+distance:r.x+r.w-distance-w,y,anchor:[side==='left'?r.x:r.x+r.w,y+h/2],far:false});
        }
      }
    }
    tries.push(...beside);
    // further in, with a leader that slants (as a drafter draws one, never square to the edge, where it would
    // read as one more extension line or a mark on the wood) to a dot on the edge
    for(const distance of roomy?[36,70,110,160]:[]){
      const slant=distance*.9;
      for(const share of shares){
        if(level){
          const x=Math.max(r.x+4,Math.min(r.x+r.w-w-4,r.x+share*r.w-w/2));
          const y=side==='top'?r.y+distance:r.y+r.h-distance-h;
          const edgeY=side==='top'?r.y:r.y+r.h;
          const anchorX=x-slant>=r.x+6?x-slant:Math.min(r.x+r.w-6,x+w+slant);
          tries.push({x,y,anchor:[anchorX,edgeY],far:true});
        }else{
          const y=Math.max(r.y+4,Math.min(r.y+r.h-h-4,r.y+share*r.h-h/2));
          const x=side==='left'?r.x+distance:r.x+r.w-distance-w;
          const edgeX=side==='left'?r.x:r.x+r.w;
          const anchorY=y-slant>=r.y+6?y-slant:Math.min(r.y+r.h-6,y+h+slant);
          tries.push({x,y,anchor:[edgeX,anchorY],far:true});
        }
      }
    }
    for(const extra of[8,40,76])for(const share of shares){
      const band=offsets[side].band+extra;
      if(level){
        // (the leader slants, as above)
        const x=Math.max(4,Math.min(V.width-w-4,r.x+share*r.w-w/2)),slant=band*.6;
        const anchorX=x-slant>=r.x+3?x-slant:x+w+slant<=r.x+r.w-3?x+w+slant:Math.max(r.x+3,Math.min(r.x+r.w-3,x+w/2));
        tries.push({x,y:side==='top'?r.y-band-h:r.y+r.h+band,anchor:[anchorX,side==='top'?r.y:r.y+r.h],far:true});
      }else{
        const y=Math.max(V.titleH,Math.min(H-h-4,r.y+share*r.h-h/2)),slant=band*.6;
        const anchorY=y-slant>=r.y+3?y-slant:y+h+slant<=r.y+r.h-3?y+h+slant:Math.max(r.y+3,Math.min(r.y+r.h-3,y+h/2));
        tries.push({x:side==='left'?r.x-band-w:r.x+r.w+band,y,anchor:[side==='left'?r.x:r.x+r.w,anchorY],far:true});
      }
    }
    void inward;
    // (a leader from the name to its edge must not run through another text or a fastener either)
    const leaderOf=t=>[[Math.max(t.x,Math.min(t.x+w,t.anchor[0])),Math.max(t.y-1,Math.min(t.y+h+1,t.anchor[1]))],t.anchor];
    const leaderClear=t=>{
      if(!t.far)return true;
      const[a,b]=leaderOf(t);
      // (nor run beside an extension line or a dimension line: it would read as one more of them; nor be long,
      // or cross the leader of another name: a name far from its edge goes in the legend instead)
      return Math.hypot(b[0]-a[0],b[1]-a[1])<=LEADER_LONGEST&&!leaderAlongEdge([a,b],edge)&&!out.texts.some(rect=>segmentHitsRect(a,b,rect,1))&&!out.markers.some(rect=>segmentHitsRect(a,b,rect,0))&&
        !runsAlongSizes(out,[a,b])&&!out.refs.some(other=>other.leader&&segmentsCross(other.leader,[a,b]));
    };
    let pick=tries.find(t=>clear({x:t.x,y:t.y,w,h},null)&&leaderClear(t));
    if(!pick){
      failedNames.push(ref.label);
      out.refs.push({ref,rect:null,edge,leader:null,side});
      continue;
    }
    const rect={x:pick.x,y:pick.y,w,h,text:ref.label};
    let leader=null;
    if(pick.far){
      // from the nearest point of the text to the edge, ending in a dot on the edge
      const near=[Math.max(rect.x,Math.min(rect.x+rect.w,pick.anchor[0])),Math.max(rect.y-1,Math.min(rect.y+rect.h+1,pick.anchor[1]))];
      leader=[near,pick.anchor];
    }
    out.refs.push({ref,rect,edge,leader,side});
    out.texts.push(rect);
    if(leader)out.segments.push(leader);
  }
  // names that found no place: laid out again with them in the legend
  // numbers that found no place: laid out again with more room on their side (twice at most)
  // (three times at most: room.passes counts them)
  if(failedPlaces.size&&(room.passes||0)<3){
    const more={...room,passes:(room.passes||0)+1};
    for(const[place,extra]of failedPlaces)more[place]+=extra;
    return layoutMarkPlan(plan,inLegend,more,withRowNote);
  }
  // names that found no place: first once more with a row of room above and below the piece (a name is best on
  // the picture, by its edge), then in the legend
  if(failedNames.length&&!room.forNames){
    const more={...room,forNames:true};
    for(const place of['top','bottom'])more[place]+=V.label+26;
    const again=layoutMarkPlan(plan,inLegend,more,withRowNote);
    // (kept only when it named more of them on the picture)
    const named=layout=>layout.refs.filter(laid=>laid.rect).length;
    if(named(again)>out.refs.filter(laid=>laid.rect).length)return again;
  }
  if(failedNames.length)return layoutMarkPlan(plan,new Set([...inLegend,...failedNames]),{...room,forNames:true},withRowNote);   // (each pass moves at least one: it ends)
  out.legendLines=legendLines;out.noteLines=noteLines;out.bottomH=bottomH;
  return out;
}

/* ---------- drawing it ---------- */
function drawMarkLayout(layout,ctx){
  const V=MARK_VIEW,plan=layout.plan,px=layout.px;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle=V.paper;ctx.fillRect(0,0,V.width,layout.height);
  ctx.lineCap='butt';ctx.lineJoin='miter';
  const line=(a,b,width,color,dash)=>{
    ctx.strokeStyle=color||V.ink;ctx.lineWidth=width;ctx.setLineDash(dash||[]);
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([]);
  };
  // the marked piece, then the pieces beside it or in front of it (solid: a shelf seen end-on in front of a
  // cabinet side), then what is behind it (dashed)
  const box=layout.box;
  if(box){
    ctx.fillStyle=V.wood;ctx.fillRect(box.x,box.y,box.w,box.h);
    // the outline, left open where the piece is broken off
    const sides={top:[[box.x,box.y],[box.x+box.w,box.y]],bottom:[[box.x,box.y+box.h],[box.x+box.w,box.y+box.h]],left:[[box.x,box.y],[box.x,box.y+box.h]],right:[[box.x+box.w,box.y],[box.x+box.w,box.y+box.h]]};
    for(const[side,[a,b]]of Object.entries(sides))if(!box.cut[side])line(a,b,V.outline);
    // break lines: a zig-zag across the piece where it goes on past the picture
    for(const side of layout.breaks){
      const[a,b]=sides[side],horizontal=side==='top'||side==='bottom',inset=side==='top'||side==='left'?4:-4;
      const start=horizontal?[a[0]-8,a[1]+inset]:[a[0]+inset,a[1]-8],stop=horizontal?[b[0]+8,b[1]+inset]:[b[0]+inset,b[1]+8];
      const long=Math.hypot(stop[0]-start[0],stop[1]-start[1]),mid=[(start[0]+stop[0])/2,(start[1]+stop[1])/2];
      const dir=[(stop[0]-start[0])/long,(stop[1]-start[1])/long],normal=[-dir[1],dir[0]];
      ctx.fillStyle=V.paper;
      if(horizontal)ctx.fillRect(a[0]-1,side==='top'?a[1]-2:a[1]-5,b[0]-a[0]+2,7);else ctx.fillRect(side==='left'?a[0]-2:a[0]-5,a[1]-1,7,b[1]-a[1]+2);
      ctx.strokeStyle=V.ink;ctx.lineWidth=1.6;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(start[0],start[1]);
      const z=[mid[0]-dir[0]*7,mid[1]-dir[1]*7];ctx.lineTo(z[0],z[1]);
      ctx.lineTo(mid[0]-dir[0]*2+normal[0]*9,mid[1]-dir[1]*2+normal[1]*9);
      ctx.lineTo(mid[0]+dir[0]*2-normal[0]*9,mid[1]+dir[1]*2-normal[1]*9);
      ctx.lineTo(mid[0]+dir[0]*7,mid[1]+dir[1]*7);ctx.lineTo(stop[0],stop[1]);ctx.stroke();
    }
  }
  for(const other of layout.others.filter(o=>!o.hidden)){
    const b=other.box;
    ctx.fillStyle=V.woodOther;ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.strokeStyle=V.ink;ctx.lineWidth=1.5;ctx.strokeRect(b.x,b.y,b.w,b.h);
  }
  for(const other of layout.others.filter(o=>o.hidden)){
    const b=other.box;
    ctx.strokeStyle=V.hidden;ctx.lineWidth=1.6;ctx.setLineDash([9,6]);ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.setLineDash([]);
  }
  for(const[a,b]of plan.centers)line(px(...a),px(...b),1.2,V.hidden,[18,5,3,5]);
  // hardware strips, slides and brackets
  for(const bar of layout.bars){
    const b=bar.box;
    ctx.fillStyle='#dfe3e8';ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.strokeStyle=V.fastener;ctx.lineWidth=2;ctx.strokeRect(b.x,b.y,b.w,b.h);
    if(bar.mid!==null&&bar.mid!==undefined){const y=px(0,bar.mid)[1];line([b.x+4,y],[b.x+b.w-4,y],1.2,V.fastener,[14,4,3,4]);}
  }
  // the edges sizes are measured from, heavy
  // (an edge of a piece behind is heavy but dashed: it cannot be seen from where you mark)
  for(const laid of layout.refs){
    const[a,b]=laid.edge;
    line(a,b,V.heavy,V.ink,laid.ref.hidden?[14,7]:null);
  }
  // pencil marks: a line, with an X on the side the piece goes (above it: the underside of the piece sits on the line)
  for(const[a,b]of plan.pencils){
    const p=px(...a),q=px(...b);
    line(p,q,2.6,V.ink);
    const mid=[(p[0]+q[0])/2,(p[1]+q[1])/2-9];
    line([mid[0]-5,mid[1]-5],[mid[0]+5,mid[1]+5],1.8,V.ink);line([mid[0]-5,mid[1]+5],[mid[0]+5,mid[1]-5],1.8,V.ink);
  }
  // the fasteners: a circle with a center cross (a pocket hole: its slot; a hole drawn at its real size)
  for(const point of layout.points){
    if(!point.inside)continue;
    const[x,y]=point.px,r=point.radius;
    ctx.strokeStyle=V.fastener;ctx.lineWidth=2.2;ctx.setLineDash(point.far?[4,3]:[]);
    if(point.kind==='pocket'&&point.slotPx){
      // the long slot of a pocket hole: a half circle round each end, joined by two straight sides
      // (centred on the mouth: from the mirror of `slot` about the mouth to `slot`)
      const[sx,sy]=point.slotPx,angle=Math.atan2(sy-y,sx-x),bx=2*x-sx,by=2*y-sy;
      ctx.beginPath();
      ctx.arc(sx,sy,r,angle-Math.PI/2,angle+Math.PI/2,false);
      ctx.arc(bx,by,r,angle+Math.PI/2,angle+Math.PI*1.5,false);
      ctx.closePath();ctx.stroke();
    }else if(point.kind!=='mid'){
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
    }
    ctx.setLineDash([]);
    const c=point.kind==='mid'?9:r+4;
    line([x-c,y],[x+c,y],1.6,V.fastener);line([x,y-c],[x,y+c],1.6,V.fastener);
  }
  // breaks in the middle: the wood between two break lines is left out (white), across the piece and the pieces
  // drawn with it; the sizes across it are drawn on over it, with their full numbers
  for(const cut of layout.cuts||[]){
    if(!cut)continue;
    const boxes=[layout.box].concat(layout.others.map(other=>other.box)).filter(Boolean);
    if(!boxes.length)continue;
    const level=cut.axis===0;   // a break across a piece that runs left to right: the break lines stand upright
    const spanLo=Math.min(...boxes.map(b=>level?b.y:b.x))-6,spanHi=Math.max(...boxes.map(b=>level?b.y+b.h:b.x+b.w))+6;
    const[a,b]=cut.at;
    ctx.fillStyle=V.paper;
    if(level)ctx.fillRect(a+1,spanLo,b-a-2,spanHi-spanLo);else ctx.fillRect(spanLo,a+1,spanHi-spanLo,b-a-2);
    for(const at of[a+3,b-3]){
      const mid=(spanLo+spanHi)/2,points=level?[[at,spanLo],[at,mid-7],[at-7,mid-2],[at+7,mid+2],[at,mid+7],[at,spanHi]]:[[spanLo,at],[mid-7,at],[mid-2,at+7],[mid+2,at-7],[mid+7,at],[spanHi,at]];
      ctx.strokeStyle=V.ink;ctx.lineWidth=1.6;ctx.setLineDash([]);ctx.beginPath();
      points.forEach((p,index)=>index?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();
    }
  }
  // extension lines (each drawn once, the longest), dimension lines with a slash tick at each end, leaders
  const drawnExt=new Map();
  for(const laid of layout.dims)for(const ext of laid.ext){
    const key=[laid.place,Math.round(laid.horizontal?ext.from[0]:ext.from[1]),Math.round(laid.horizontal?ext.from[1]:ext.from[0])].join('|');
    const long=Math.hypot(ext.to[0]-ext.from[0],ext.to[1]-ext.from[1]);
    if(!drawnExt.has(key)||drawnExt.get(key).long<long)drawnExt.set(key,{ext,long});
  }
  for(const{ext}of drawnExt.values())line(ext.from,ext.to,1.2,V.ink);
  for(const laid of layout.dims){
    const[a,b]=laid.line;
    line(a,b,1.5,V.ink);
    // (running sizes start at a small circle on the end they are all measured from)
    for(const end of laid.dim.running?[b]:[a,b])line([end[0]-V.tick,end[1]+V.tick],[end[0]+V.tick,end[1]-V.tick],2.2,V.ink);
    if(laid.dim.running){ctx.fillStyle=V.paper;ctx.strokeStyle=V.ink;ctx.lineWidth=2;ctx.beginPath();ctx.arc(a[0],a[1],5,0,Math.PI*2);ctx.fill();ctx.stroke();}
    if(laid.leader)line(laid.leader[0],laid.leader[1],1.5,V.ink);
  }
  for(const laid of layout.refs)if(laid.leader){
    line(laid.leader[0],laid.leader[1],1.2,V.ink);
    ctx.fillStyle=V.ink;ctx.beginPath();ctx.arc(laid.leader[1][0],laid.leader[1][1],3.5,0,Math.PI*2);ctx.fill();
  }
  // texts on white, so a line under them never cuts a number
  ctx.textBaseline='top';ctx.textAlign='left';
  const write=(rect,size,bold)=>{
    ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(rect.x-2,rect.y-2,rect.w+4,rect.h+4);
    ctx.fillStyle=V.ink;ctx.font=`${bold?600:400} ${size}px ${PICTURE_FONT}`;
    (rect.lines||[rect.text]).forEach((line,index)=>ctx.fillText(line,rect.x,rect.y+index*(size+4)));
  };
  for(const laid of layout.dims)write(laid.text,V.number,true);
  for(const laid of layout.refs)if(laid.rect)write(laid.rect,V.label,true);
  // the title, and how the face is seen
  ctx.fillStyle=V.ink;ctx.font=`600 26px ${PICTURE_FONT}`;ctx.fillText(plan.title,V.pad,12);
  // (how it is seen, as large as fits the width)
  let subtitleSize=23;
  ctx.font=`400 ${subtitleSize}px ${PICTURE_FONT}`;
  while(subtitleSize>16&&ctx.measureText(plan.subtitle).width>V.width-2*V.pad){subtitleSize--;ctx.font=`400 ${subtitleSize}px ${PICTURE_FONT}`;}
  ctx.fillText(plan.subtitle,V.pad,44);
  line([V.pad,V.titleH-6],[V.width-V.pad,V.titleH-6],1,'#b8bec5');
  // the legend and the notes along the bottom
  let y=layout.height-layout.bottomH+6;
  for(const text of layout.noteLines){
    ctx.fillStyle=V.ink;ctx.font=`400 ${V.legend}px ${PICTURE_FONT}`;ctx.fillText(text,V.pad,y);
    y+=V.legend+8;
  }
  for(const row of layout.legendLines){
    let x=V.pad;
    for(const entry of row){
      const cy=y+V.legend/2+1;
      ctx.strokeStyle=V.fastener;ctx.lineWidth=2;ctx.setLineDash([]);
      if(entry.kind==='cross'||entry.kind==='hole'||entry.kind==='far'||entry.kind==='pocket'){
        if(entry.kind==='far')ctx.setLineDash([4,3]);
        ctx.beginPath();ctx.arc(x+14,cy,7,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
        line([x+4,cy],[x+24,cy],1.4,V.fastener);line([x+14,cy-10],[x+14,cy+10],1.4,V.fastener);
      }else if(entry.kind==='hidden')line([x,cy],[x+30,cy],1.6,V.hidden,[9,6]);
      else if(entry.kind==='center')line([x,cy],[x+30,cy],1.2,V.hidden,[18,5,3,5]);
      else if(entry.kind==='pencil')line([x,cy],[x+30,cy],2.6,V.ink);
      else if(entry.kind==='heavy')line([x,cy],[x+30,cy],V.heavy,V.ink);
      else if(entry.kind==='heavyDashed')line([x,cy],[x+30,cy],V.heavy,V.ink,[9,5]);
      else if(entry.kind==='datum'){line([x+6,cy],[x+30,cy],1.5,V.ink);ctx.fillStyle=V.paper;ctx.strokeStyle=V.ink;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+6,cy,5,0,Math.PI*2);ctx.fill();ctx.stroke();}
      else if(entry.kind==='other'){ctx.fillStyle=V.woodOther;ctx.fillRect(x+2,cy-7,26,14);ctx.strokeStyle=V.ink;ctx.lineWidth=1.5;ctx.strokeRect(x+2,cy-7,26,14);}
      else if(entry.kind==='cont'){}   // the rest of the words of the entry above (legendParts): no symbol
      else{ctx.strokeRect(x+2,cy-6,26,12);}
      ctx.fillStyle=V.ink;ctx.font=`400 ${V.legend}px ${PICTURE_FONT}`;ctx.fillText(entry.text,x+38,y);
      x+=entry.w+18;
    }
    y+=V.legend+8;
  }
}
/* the picture of a plan, as a data URL; '' when there is no plan */
function markingPicture(plan){
  if(!plan)return'';
  const layout=layoutMarkPlan(plan);
  const ctx=markContext();
  if(markCanvas.height!==layout.height)markCanvas.height=layout.height;   // (a view with many notes is taller)
  drawMarkLayout(layout,ctx);
  return markCanvas.toDataURL('image/png');
}

/* ---------- drawing them when they are needed ----------
   The Build instructions page has a marking view beside every close-up (22 on a shed). Drawing them all before the
   page shows made the tab slow to open, so the page gets a key for each (markingPictureLater) and a light empty
   picture of the same size; fillMarkViews draws the ones on screen at once, the rest a few at a time after the page
   is up, and all that are left before printing.
     markingPictureLater(plan)   'markview:N', or '' for no plan (the last MARK_LATER_KEPT are kept)
     markingSource(key)          the picture of that key, drawn the first time it is asked for (a data URL)
     fillMarkViews(page)         fills the pictures of a page that carry data-mark */
const markLater=new Map();
let markLaterNext=0;
function markingPictureLater(plan){
  if(!plan)return'';
  const key=`markview:${++markLaterNext}`;
  markLater.set(key,{plan,src:''});
  // (the oldest are forgotten: they belong to pages that were drawn again since)
  while(markLater.size>MARK_LATER_KEPT)markLater.delete(markLater.keys().next().value);
  return key;
}
const MARK_LATER_KEPT=600;
function markingSource(key){
  const entry=markLater.get(key);
  if(!entry)return'';
  if(!entry.src)entry.src=markingPicture(entry.plan);
  return entry.src;
}
// an empty white picture of the usual size, so the page does not jump when the real one is drawn
const MARK_BLANK=`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${MARK_VIEW.width}" height="${MARK_VIEW.height}"><rect width="100%" height="100%" fill="#fff"/></svg>`)}`;
function fillMarkViews(page){
  const waiting=[...page.querySelectorAll('img[data-mark]')];
  if(!waiting.length)return;
  const fill=img=>{
    if(!img.dataset.mark)return;
    const src=markingSource(img.dataset.mark);
    if(src)img.src=src;
    delete img.dataset.mark;
  };
  // the ones on screen now, and each one as it scrolls into view
  if(typeof IntersectionObserver==='function'){
    const watcher=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){fill(entry.target);watcher.unobserve(entry.target);}
    },{rootMargin:'400px'});
    for(const img of waiting)watcher.observe(img);
  }
  // the rest a few at a time while nothing else is going on
  let next=0;
  const some=()=>{
    const started=performance.now();
    while(next<waiting.length&&performance.now()-started<30)fill(waiting[next++]);
    if(next<waiting.length)setTimeout(some,40);
  };
  setTimeout(some,200);
}
// before printing, every one that is not drawn yet
window.addEventListener('beforeprint',()=>{
  for(const img of document.querySelectorAll('img[data-mark]')){
    const src=markingSource(img.dataset.mark);
    if(src)img.src=src;
    delete img.dataset.mark;
  }
});

/* ---------- self-check (selfTest runs every function in SELFTESTS, see js/core.js) ----------
   For every preset at its default sizes, every marking view of every close-up (each "Fasten with" line with a
   close-up, each line of hardware, the pencil marks of a marking step), worked out from the plan and laid out
   without drawing (drawing is the slow part):
     - every size has two extension lines that start at what it measures (in line with the edge or the middle of
       the fastener, within a pixel or two, and starting at it) and its dimension line between them;
     - its length on the paper divided by the scale is its number (true length: the view is square to the face);
     - its number is a number of the words of its line;
     - every edge it names is a face of the named piece, called by the word the view gives it, and drawn where
       the view puts it;
     - no two texts overlap, no text covers a fastener or a line, and nothing is outside the picture. */
function markLayoutProblems(layout,label){
  const found=[],plan=layout.plan,scale=layout.scale;
  // a line whose places have other numbers: the note under the view says which place it is for, and never that the
  // other places take the same numbers (it once did, under the line of the bed's plugged corners)
  if(plan.sampleAt&&plan.places>1){
    if(!plan.notes.some(note=>note.includes(plan.sampleAt)))found.push(`${label}: the view does not say which place it is for (${plan.sampleAt})`);
    if(plan.notes.some(note=>/with the same numbers/.test(note)))found.push(`${label}: its line marks the places with other numbers, and the note under the view says "with the same numbers"`);
  }
  // the legend and the notes stay inside the picture: no line of them runs past its right edge (legendParts)
  {
    const ctx=markContext();
    ctx.font=`400 ${MARK_VIEW.legend}px ${PICTURE_FONT}`;
    for(const row of layout.legendLines||[]){
      // as drawn: each entry's words start 38 px after its start, entries 18 px apart
      let x=0,right=0;
      for(const entry of row){right=x+38+Math.ceil(ctx.measureText(entry.text).width);x+=entry.w+18;}
      if(right>layout.legendRoom+.5)found.push(`${label}: a line of the legend is ${right-layout.legendRoom} px wider than the picture: "${row.map(entry=>entry.text).join(' | ')}"`);
    }
    for(const text of layout.noteLines||[])if(Math.ceil(ctx.measureText(text).width)>layout.legendRoom+.5)found.push(`${label}: a note under the picture is wider than the picture: "${text}"`);
  }
  const numbers=text=>String(text).match(/\d+(?: \d+\/\d+)?"|\d+\/\d+"/g)||[];
  for(const laid of layout.dims){
    const dim=laid.dim;
    laid.ext.forEach((ext,index)=>{
      const feature=ext.feature,c=laid.horizontal?ext.from[0]:ext.from[1];
      const want=feature.kind==='point'?(laid.horizontal?layout.px(feature.at[0],0)[0]:layout.px(0,feature.at[1])[1]):(laid.horizontal?layout.px(feature.c,0)[0]:layout.px(0,feature.c)[1]);
      if(Math.abs(c-want)>1.5)found.push(`${label}: an extension line of ${dim.text} is ${Math.abs(c-want).toFixed(1)} px off what it measures`);
      // it starts at the object: just off the edge of the piece, or just off the mark of the fastener
      const start=laid.horizontal?ext.from[1]:ext.from[0];
      if(feature.kind==='point'){
        const p=layout.px(feature.at[0],feature.at[1]),mark=layout.points.find(point=>Math.hypot(point.px[0]-p[0],point.px[1]-p[1])<1);
        const allowed=(mark?mark.radius:7)+MARK_VIEW.extGap+1.5;
        if(Math.abs(start-(laid.horizontal?p[1]:p[0]))>allowed)found.push(`${label}: the extension line of ${dim.text} starts ${Math.abs(start-(laid.horizontal?p[1]:p[0])).toFixed(0)} px from the middle of the fastener`);
        if(!mark||!mark.inside)found.push(`${label}: ${dim.text} is measured to a fastener that is not in the picture`);
      }else if(Math.abs(start-ext.object)>MARK_VIEW.extGap+1.5)found.push(`${label}: the extension line of ${dim.text} starts ${Math.abs(start-ext.object).toFixed(0)} px from the edge it measures`);
      const lineEnd=laid.line[index];
      if(Math.hypot(lineEnd[0]-(laid.horizontal?c:laid.lineAt),lineEnd[1]-(laid.horizontal?laid.lineAt:c))>1.5)found.push(`${label}: the dimension line of ${dim.text} does not end on its extension line`);
    });
    // (a size across a break in the middle: its length on the paper less the room of the break, plus what is left out)
    const inches=layout.inchesOf(laid),said=dim.value*dim.count;
    // and it can be seen: its two extension lines are apart on the paper
    const onPaper=laid.horizontal?Math.abs(laid.line[1][0]-laid.line[0][0]):Math.abs(laid.line[1][1]-laid.line[0][1]);
    if(onPaper<MARK_VIEW.leastDrawn)found.push(`${label}: ${dim.text} is drawn ${onPaper.toFixed(1)} px long, too short to see`);
    if(Math.abs(inches-said)>dim.count/32+.02)found.push(`${label}: ${dim.text} is drawn ${inches.toFixed(3)}" long on the paper, not ${said.toFixed(3)}"`);
    const told=numbers(dim.text);
    if(!told.length||told.some(number=>!plan.words.includes(number)))found.push(`${label}: the marking view shows ${dim.text}, which the words of its line do not say: ${plan.words.slice(0,180)}`);
    // the number written is the distance in the model, to the nearest 1/16" (a number must never sit on a line of
    // another length: 1 5/8" written on a size that is 1/2" in the model)
    const written=told.length?parseLen(told[told.length-1].replace(/"$/,'')):NaN;
    if(!(Math.abs(written-dim.value)<=1/32+1e-6))found.push(`${label}: ${dim.text} is written on a size that is ${dim.value.toFixed(3)}" in the model`);
    // "3 spaces at 4 5/8"": every one of the gaps is that size
    if(dim.count>1&&(!dim.gaps||dim.gaps.length!==dim.count||dim.gaps.some(one=>Math.abs(one-dim.value)>1/32+1e-6)))found.push(`${label}: ${dim.text} stands for gaps of ${dim.gaps?dim.gaps.map(one=>one.toFixed(3)).join(', '):'(not given)'}`);
  }
  // a number moved off its own line never sits beside another line of the same row (a beginner reads it as that
  // line's number): its middle, along the row, is within its own line or past the outer ends of the row
  for(const laid of layout.dims){
    const t=laid.text;
    if(!t)continue;
    // running sizes: the number is at the tick of its own end (within a little, or tied to it by a leader)
    if(laid.dim.running){
      const end=laid.line[1],along=laid.horizontal?t.x+t.w/2:t.y+t.h/2,at=laid.horizontal?end[0]:end[1];
      const tied=laid.leader&&Math.hypot(laid.leader[1][0]-end[0],laid.leader[1][1]-end[1])<1.5;
      if(!tied&&Math.abs(along-at)>3)found.push(`${label}: the running size ${laid.dim.text} is not written at its own tick`);
      continue;
    }
    const span=item=>{const a=laid.horizontal?item.line[0][0]:item.line[0][1],b=laid.horizontal?item.line[1][0]:item.line[1][1];return[Math.min(a,b),Math.max(a,b)];};
    const along=laid.horizontal?t.x+t.w/2:t.y+t.h/2,across=laid.horizontal?t.y+t.h/2:t.x+t.w/2;
    const own=span(laid);
    if(along>=own[0]-1&&along<=own[1]+1)continue;
    const nextTo=layout.dims.find(other=>other!==laid&&other.place===laid.place&&Math.abs(other.lineAt-laid.lineAt)<1&&
      (s=>along>s[0]+1&&along<s[1]-1)(span(other))&&Math.abs(across-laid.lineAt)<MARK_VIEW.number+12);
    if(nextTo)found.push(`${label}: the number ${laid.dim.text} is written beside the line of ${nextTo.dim.text}`);
  }
  for(const laid of layout.refs){
    const feature=laid.ref.feature;
    if(!feature.piece)continue;
    const b=plainBox(feature.piece),value=(feature.high?b.hi:b.lo)[feature.axis]*plan.frame.signOf(feature.axis);
    if(Math.abs(value-feature.c)>.01)found.push(`${label}: "${laid.ref.label}" is not a face of the ${feature.piece.name}`);
    const word=faceWord(feature.piece,feature.axis,feature.piece===plan.piece);
    if(!laid.ref.named&&!laid.ref.label.startsWith(`${plan.frame.nameOf(feature.axis,feature.high)} ${word} of ${feature.piece.name}`))found.push(`${label}: the edge named "${laid.ref.label}" is not what the view calls it`);
    // and the words never call it the other way: the picture says 'top end of Back panel' where the line says
    // 'the bottom end of the Back panel' and not the top one
    // (where the places of a line are marked in different ways, the words of the place the picture shows)
    const said=high=>(plan.sampleWords||plan.words).includes(`${plan.frame.nameOf(feature.axis,high)} ${word}`);
    if(!laid.ref.named&&feature.piece===plan.piece&&said(!feature.high)&&!said(feature.high))found.push(`${label}: the picture names the "${laid.ref.label}", its line names the other one: ${plan.words.slice(0,200)}`);
    if(laid.side!==plan.frame.screenSide(feature.axis,feature.high))found.push(`${label}: "${laid.ref.label}" is drawn on the ${laid.side} of the piece`);
  }
  for(let i=0;i<layout.texts.length;i++){
    const a=layout.texts[i];
    if(a.x<0||a.y<0||a.x+a.w>MARK_VIEW.width||a.y+a.h>layout.height)found.push(`${label}: "${a.text}" is outside the picture`);
    for(let j=i+1;j<layout.texts.length;j++)if(rectsOverlap(a,layout.texts[j],0))found.push(`${label}: "${a.text}" is written over "${layout.texts[j].text}"`);
  }
  // a leader never runs through another text
  for(const[leader,own]of layout.dims.map(laid=>[laid.leader,laid.text]).concat(layout.refs.map(laid=>[laid.leader,laid.rect]))){
    if(!leader)continue;
    const crossed=layout.texts.find(rect=>rect!==own&&segmentHitsRect(leader[0],leader[1],rect,0));
    if(crossed)found.push(`${label}: the leader of "${own.text}" runs through "${crossed.text}"`);
  }
  // the leader of a name never runs beside an extension line or a dimension line (it would read as one)
  for(const laid of layout.refs)if(laid.leader&&runsAlongSizes(layout,laid.leader))found.push(`${label}: the leader of "${laid.ref.label}" runs beside a size line`);
  // ... is short, and crosses no other name's leader
  layout.refs.forEach((laid,index)=>{
    if(!laid.leader)return;
    const[a,b]=laid.leader;
    if(leaderAlongEdge(laid.leader,laid.edge))found.push(`${label}: the leader of "${laid.ref.label}" runs along the edge it names, where it cannot be seen`);
    if(Math.hypot(b[0]-a[0],b[1]-a[1])>LEADER_LONGEST+.5)found.push(`${label}: the leader of "${laid.ref.label}" is ${Math.round(Math.hypot(b[0]-a[0],b[1]-a[1]))} px long`);
    if(layout.refs.slice(index+1).some(other=>other.leader&&segmentsCross(other.leader,laid.leader)))found.push(`${label}: the leader of "${laid.ref.label}" crosses another`);
  });
  // the name of an end that stands upright is beside it, not above or below the piece in line with it
  for(const laid of layout.refs){
    if(!laid.rect||(laid.side!=='left'&&laid.side!=='right'))continue;
    const[top,bottom]=[laid.edge[0][1],laid.edge[1][1]].sort((one,two)=>one-two),middle=laid.rect.y+laid.rect.h/2;
    // (above or below it only with a leader that ends on the end itself)
    const onEnd=laid.leader&&Math.abs(laid.leader[1][0]-laid.edge[0][0])<1.5&&laid.leader[1][1]>=top-1&&laid.leader[1][1]<=bottom+1;
    if((middle<top-2||middle>bottom+2)&&!onEnd)found.push(`${label}: "${laid.ref.label}" is written above or below the end it names, with no leader to it`);
  }
  // the words measure from "the nearest" end or edge: the picture names that edge as the nearest one
  const rule=plan.rule||{};
  const saysNearest=rule.slant==='nearest'||(rule.across&&rule.across.side==='near')||(rule.along&&rule.along.side==='near');
  if(saysNearest&&!plan.refs.some(ref=>/ nearest the /.test(ref.label)))found.push(`${label}: the words measure from the nearest edge, the picture names no edge as the nearest: ${plan.refs.map(ref=>ref.label).join('; ')}`);
  // no two fasteners are drawn over each other (each can be told apart)
  const shown=layout.points.filter(point=>point.inside);
  for(let i=0;i<shown.length;i++)for(let j=i+1;j<shown.length;j++){
    const a=shown[i],b=shown[j];
    if(Math.hypot(a.px[0]-b.px[0],a.px[1]-b.px[1])<a.radius+b.radius-.5){found.push(`${label}: two fasteners are drawn over each other`);i=shown.length;break;}
  }
  // every fastener (and the slot of a pocket hole) is drawn on the picture, above the legend and the notes
  for(const point of layout.points){
    if(!point.inside)continue;
    // (a slot runs both ways from the mouth: its two ends)
    const back=point.slotPx?[2*point.px[0]-point.slotPx[0],2*point.px[1]-point.slotPx[1]]:null;
    const ends=[point.px].concat(point.slotPx?[point.slotPx,back]:[]);
    for(const[x,y]of ends)if(x-point.radius<0||x+point.radius>MARK_VIEW.width||y-point.radius<MARK_VIEW.titleH-6||y+point.radius>layout.height-layout.bottomH)
      found.push(`${label}: a fastener is drawn at ${Math.round(x)}, ${Math.round(y)}, over the title, the legend or the notes, or off the picture`);
    // and on its piece: a pocket hole's slot stays inside the piece it is drilled in
    if(point.slotPx&&layout.box){
      const b=layout.box;
      for(const[sx,sy]of[point.slotPx,back])if(sx<b.x-1||sx>b.x+b.w+1||sy<b.y-1||sy>b.y+b.h+1){found.push(`${label}: the slot of a pocket hole runs off the piece`);break;}
    }
  }
  for(const clash of layout.clashes)found.push(`${label}: ${clash} could not be placed clear of the other texts, the fasteners and the lines`);
  return found;
}
/* every marking view of the design as it is now: [{label, plan}] */
function markingPlansOfDesign(name){
  const plan=buildPlan(true),list=[];
  for(const step of plan.steps){
    const withSample=step.groups.filter(group=>group.sample&&group.sample.layout.length);
    const chosen=withSample.slice().sort((a,b)=>b.places-a.places).slice(0,CLOSEUPS_MAX);
    // (a line whose words give no sizes, "start each one about an inch back", has no marking view; every other has)
    for(const group of chosen){
      const rule=group.sample.rule||{};
      // (a line whose holes are drilled in step 2 shows the drawing there instead: its view is checked, not needed)
      list.push({label:`${name}, step ${step.no}, line ${group.no}`,plan:jointMarkPlan(group,plan.letterOf),needed:!group.predrilled&&(!rule.free||!!rule.gap)});
    }
    for(const row of step.hardware)list.push({label:`${name}, step ${step.no}, ${row.kind} line ${row.no}`,plan:hardwareMarkPlan(row,plan.letterOf),needed:['cup','pull','slide','runner','kicker','wallscrew','bolt'].includes(row.kind)});
    const fresh=new Set(step.pieces.concat(step.brought||[]).map(p=>p.id));
    const marks=markingLines(step,fresh);
    if(marks.length)list.push({label:`${name}, step ${step.no}, pencil marks`,plan:marksMarkPlan(marks,plan.letterOf,step.words),marks:true});
  }
  return list;
}
SELFTESTS.push(function markingViewsMeasureTrue(problems){
  const wrong=text=>{if(problems.length<60)problems.push('marking views: '+text);};
  let views=0,sizes=0;
  // The marking views need the design, not the 3D scene: the scene is not drawn again for each preset here (that
  // would be two thirds of the time of this check). It is drawn again at the end.
  const drawKept=renderAll;
  // Besides every preset at its default sizes, a few choices that once drew a wrong number or an unreadable view:
  // a 10 gallon level of the fish rack (uneven gaps), a 4x4 upright, a narrow shed wall (a sheet with almost no
  // nails), a lean-to shed, a deep shed floor, a wide platform bed, the runner drawers of the nightstand
  const MORE_CHOICES=[['Fish tank wall / rack',{r1:'g10'}],['Fish tank wall / rack',{up:'4x4'}],
    // a rack screwed to the wall studs and one built as bolted sections: their steps mount the wall screws and the bolts
    ['Fish tank wall / rack',{orient:'long'}],['Fish tank wall / rack',{W:240,build:'sections'}],['Shed',{W:48}],['Shed',{roof:'lean'}],
    ['Shed',{D:48}],['Platform bed',{Wm:84}],['Nightstand with drawers',{slides:'runner'}]];
  try{
    renderAll=()=>{};
    const runs=PRESETS.map(preset=>[preset,{}]).concat(MORE_CHOICES.map(([name,choice])=>[PRESETS.find(preset=>preset.name===name),choice]).filter(([preset])=>preset));
    for(const[preset,choice]of runs){
      const vals=Object.assign(presetDefaults(preset),choice);
      let parts=[];
      try{parts=preset.build(vals)||[];}catch(e){continue;}
      if(!parts.length)continue;
      placePreset(preset,vals,parts,false);
      const said=Object.keys(choice).length?` (${JSON.stringify(choice)})`:'';
      for(const{label,plan,needed}of markingPlansOfDesign(preset.name)){
        if(!plan){if(needed)wrong(`${label}${said} has a close-up with no marking view`);continue;}
        views++;
        const layout=layoutMarkPlan(plan);
        sizes+=layout.dims.length;
        markLayoutProblems(layout,label+said).slice(0,3).forEach(wrong);
      }
    }
  }finally{renderAll=drawKept;}
  if(views<230||sizes<850)wrong(`only ${views} marking views with ${sizes} sizes were checked (238 and 887 at the default sizes alone when this check was last changed): the check found too few`);
  // the two the owner sent: the back panel into the top rail, and a drawer side into the drawer box front, on the
  // nightstand the owner saw (a cabinet 20" wide, 16" deep and 26" tall under its top: since its form asks for the
  // overall size, that is 21" x 17 9/16" x 26 3/4" typed)
  const nightstand=PRESETS.find(preset=>preset.name==='Nightstand with drawers');
  const vals={...presetDefaults(nightstand),...nightstandOverall({W:20,D:16,H:26},'overlay')};
  placePreset(nightstand,vals,nightstand.build(vals),false);
  const groups=buildPlan(true).steps.flatMap(step=>step.groups);
  const rail=groups.find(group=>/Back panel \(\w+\) into the edge of the Top rail/.test(group.line));
  if(!rail)wrong('the Nightstand has no line for the back panel into the top rail');
  else{
    const plan=jointMarkPlan(rail,buildPlan().letterOf);
    if(!plan||!/seen from the back/.test(plan.subtitle))wrong('the marking view of the back panel does not say it is seen from the back');
    else{
      if(!plan.refs.some(ref=>/^top end of Back panel/.test(ref.label)))wrong('the marking view of the back panel does not name the top end it is measured from: '+plan.refs.map(ref=>ref.label).join('; '));
      if(!plan.dims.some(dim=>/^3 spaces at 4 5\/8"$/.test(dim.text)))wrong('the back panel row does not read "3 spaces at 4 5/8""');
      if(!plan.others.some(other=>other.hidden&&other.piece.name==='Top rail'))wrong('the top rail is not drawn dashed behind the back panel');
      if(!/3\/8" down from the top end of the Back panel/.test(rail.where)||!/from the left edge/.test(rail.where)||!/as you look at the Back panel from the back/.test(rail.where))wrong('the words of the back panel line do not say "3/8" down from the top end", "from the left edge" and how it is seen: '+rail.where);
    }
  }
  const drawerSide=groups.find(group=>/Drawer side \(\w+\) into the end of the Drawer box front/.test(group.line));
  const sidePlan=drawerSide&&jointMarkPlan(drawerSide,buildPlan().letterOf);
  if(!sidePlan||!sidePlan.refs.some(ref=>/^front end of Drawer side/.test(ref.label))||sidePlan.dims.length<3)wrong('the marking view of the drawer side does not measure from its front end and both edges');
  // the page: every close-up of a joint is a pair of pictures, and its caption is the number, a space, the words
  const tabKept=tab;
  try{
    renderCut(true);
    const shots=picturesFor(true).steps;
    const figures=[...$('#instrPage').querySelectorAll('.closeups figure')];
    // (each marking view is drawn when it is seen: drawn here, it must be a picture)
    const pairs=shots.reduce((sum,shot)=>sum+shot.closeups.filter(close=>/^data:image\/png/.test(close.mark?markingSource(close.mark):'')).length,0);
    // (a close-up of a line drilled in step 2 is one picture, its caption naming the drawing: js/drillplan.js)
    const total=shots.reduce((sum,shot)=>sum+shot.closeups.filter(close=>!/drilled already, drawing/.test(close.caption)).length,0);
    if(pairs!==total)wrong(`the Nightstand has ${total} close-ups and ${pairs} marking views`);
    if(figures.filter(figure=>figure.classList.contains('pair')&&figure.querySelectorAll('img').length===2).length!==pairs)wrong('the Build instructions page does not show each close-up as a pair of pictures');
    // the marking views on the page are drawn once they are seen, and all of them before printing
    const waiting=[...$('#instrPage').querySelectorAll('img[data-mark]')];
    if(!waiting.length&&pairs)wrong('the marking views of the page were all drawn before the page was shown (they are to be drawn as they are seen)');
    window.dispatchEvent(new Event('beforeprint'));
    if($('#instrPage').querySelector('img[data-mark]'))wrong('a marking view is still not drawn when the page is printed');
    if([...$('#instrPage').querySelectorAll('.closeups figure.pair img:nth-child(2)')].some(img=>!/^data:image\/png/.test(img.src)))wrong('a marking view on the page is not a picture after printing begins');
    // each picture of a pair is shown whole: scaled to its half of the figure, never cut off by it
    for(const figure of figures.filter(one=>one.classList.contains('pair'))){
      const box=figure.getBoundingClientRect();
      if(!box.width)continue;   // (the page is not on screen)
      for(const img of figure.querySelectorAll('img')){
        const r=img.getBoundingClientRect();
        if(r.right>box.right+1||r.left<box.left-1){wrong(`a picture of a close-up is ${Math.round(r.right-box.right)} px wider than its place on the page`);break;}
      }
    }
    const caption=figures[0]&&figures[0].querySelector('figcaption').textContent;
    if(!/^\d+ Close-up of line \d+/.test(caption||''))wrong(`a close-up caption reads "${caption}": the number of the line, a space, then the words`);
    if(!shots.some(shot=>shot.closeups.length)||!figures.length)wrong('the Nightstand page has no close-ups to check');
  }finally{setTab(tabKept);}
});
