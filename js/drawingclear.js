/* NominalCAD: nothing on a part drawing overlaps (the owner's addendum to the shop packet, point 9, 20 Nov).

   The owner, about the Platform bed's side rail drawing: "the overlap here is horrible this has to have some sort
   of check so this cant happen". So every part drawing is measured as it is laid out, at the size it is drawn:
     - no two texts touch (CLEAR.text px apart at least), turned texts included;
     - no text covers a hole mark, the arrow of a pocket hole, a small circle (the end with the label, the corner of
       a place), a corner mark, a tag or the label box;
     - no line runs through a text unless it is that text's own (an extension line or a leader that ends at it):
       extension lines, dimension lines, ticks, leaders, the outline of the piece, dashed pieces;
     - no small circle or corner mark sits on a hole mark, and no tag either;
     - no text runs outside the drawing.
   The text boxes are the widths the page draws them at (partTextWidth: the same font and size as css/style.css,
   svg.pd), turned texts turned. Checked on the drilling drawings (partDrawingLayout, js/partdrawings.js) and the
   plain outlines of the packet (plainPartLayout, js/shoppacket.js), also at the larger size the phone draws an
   outline's words; the shape drawings and marking views have their own check (markLayoutProblems,
   js/markingview.js).

     CLEAR                         the least room between two things, in drawing pixels
     drawingClearProblems(layout)  what overlaps on one drilling drawing: [text]
     plainClearProblems(layout)    the same for a plain outline
     clearCheckRuns()              the designs: every preset at its defaults, its smallest and its largest sizes,
                                   in the three build styles
   The self-check drawingMarksNeverOverlap runs them all; it was proved failing on the Platform bed's side rail (D)
   as it was on 20 Nov, before the layout was mended (see the report of the shop packet). */
'use strict';

const CLEAR={text:4,mark:2,own:8};

/* the parts of a drilling drawing that take room on the paper, as boxes and segments */
function drawingObstacles(layout){
  const V=PART_VIEW;
  const circles=[],segments=[],boxes=[];
  for(const item of layout.items){
    switch(item.type){
      case'line':segments.push({a:[item.x1,item.y1],b:[item.x2,item.y2],kind:item.cls==='tick'?'tick':'line'});break;
      case'leader':segments.push({a:[item.x1,item.y1],b:[item.x2,item.y2],kind:'leader'});break;
      case'rect':{
        const{x,y,w,h}=item,kind=item.cls==='wood'?'outline':'dashed';
        segments.push({a:[x,y],b:[x+w,y],kind},{a:[x+w,y],b:[x+w,y+h],kind},{a:[x+w,y+h],b:[x,y+h],kind},{a:[x,y+h],b:[x,y],kind});
        break;
      }
      case'datum':circles.push({x:item.x-V.datumR-1,y:item.y-V.datumR-1,w:2*V.datumR+2,h:2*V.datumR+2,kind:'circle',owner:item});break;
      case'corner':{
        // (its small circle is left off where it would cover a hole: layPlaces, js/partdrawings.js)
        if(!item.noCircle)circles.push({x:item.x-V.datumR-1,y:item.y-V.datumR-1,w:2*V.datumR+2,h:2*V.datumR+2,kind:'circle',owner:item});
        // the corner mark: two heavy strokes 12 px long from the corner, along the place's two sides
        const ex=item.x+item.dx*12,ey=item.y+item.dy*12;
        boxes.push({x:Math.min(item.x,ex)-2.5,y:item.y-2.5,w:Math.abs(ex-item.x)+5,h:5,kind:'corner mark',owner:item});
        boxes.push({x:item.x-2.5,y:Math.min(item.y,ey)-2.5,w:5,h:Math.abs(ey-item.y)+5,kind:'corner mark',owner:item});
        break;
      }
      case'labelbox':boxes.push({x:item.x,y:item.y,w:item.w,h:item.h,kind:'label box'});break;
      case'hex':boxes.push({x:item.cx-V.hexR,y:item.cy-V.hexR,w:2*V.hexR,h:2*V.hexR,kind:'tag',owner:item});break;
    }
  }
  const holes=layout.holes.map(mark=>({box:mark.box,arrow:mark.arrow?arrowBox(mark):null}));
  return{circles,segments,boxes,holes};
}
/* does a segment end at (or very near) this box: it is the box's own extension line or leader */
// (a leader is its name's own only at its start, the end at the name: where it ends, on the piece, it may pass close
//  to another text, which it then crosses)
const segmentEndsAt=(segment,box)=>(segment.kind==='leader'?[segment.a]:[segment.a,segment.b]).some(([x,y])=>x>=box.x-CLEAR.own&&x<=box.x+box.w+CLEAR.own&&y>=box.y-CLEAR.own&&y<=box.y+box.h+CLEAR.own);
const shrunk=(box,by)=>({x:box.x+by,y:box.y+by,w:Math.max(0,box.w-2*by),h:Math.max(0,box.h-2*by)});
const quoted=text=>`"${String(text).slice(0,40)}"`;

/* What overlaps on one drilling drawing (its layout): [text]. */
function drawingClearProblems(layout){
  const found=[],texts=layout.texts,{circles,segments,boxes,holes}=drawingObstacles(layout);
  for(let i=0;i<texts.length;i++){
    const text=texts[i],box=text.box;
    // inside the drawing
    if(box.x<-.5||box.y<-.5||box.x+box.w>layout.width+.5||box.y+box.h>layout.height+.5)found.push(`${quoted(text.text)} runs outside the drawing`);
    // two texts
    for(let j=i+1;j<texts.length;j++)if(boxesOverlap(box,texts[j].box,CLEAR.text))found.push(`${quoted(text.text)} touches ${quoted(texts[j].text)}`);
    // a hole mark, the arrow of a pocket hole
    if(holes.some(hole=>boxesOverlap(box,hole.box,CLEAR.mark)||(hole.arrow&&boxesOverlap(box,hole.arrow,0))))found.push(`${quoted(text.text)} is written over a hole`);
    // a small circle, a corner mark, a tag, the label box (a text in the label box is its own)
    const mark=circles.concat(boxes).find(other=>!(text.role==='labelbox'&&other.kind==='label box')&&boxesOverlap(box,other,other.kind==='label box'?CLEAR.mark:CLEAR.mark));
    if(mark)found.push(`${quoted(text.text)} is written over a ${mark.kind==='circle'?'small circle':mark.kind}`);
    // a line through it that is not its own (a tick is nobody's own)
    const inner=shrunk(box,.5);
    const crossing=segments.find(segment=>segmentHitsRect(segment.a,segment.b,inner,0)&&(segment.kind==='tick'||!segmentEndsAt(segment,box))&&
      !(text.role==='labelbox'&&segment.kind!=='tick'&&segment.kind!=='leader'));
    if(crossing)found.push(`${quoted(text.text)} is crossed by ${crossing.kind==='tick'?'a tick':crossing.kind==='leader'?'a leader':crossing.kind==='outline'?'the outline of the piece':crossing.kind==='dashed'?'a dashed piece':'a line'}`);
  }
  // marks on holes: a small circle, a corner mark or a tag sitting on a hole mark
  const marks=circles.concat(boxes.filter(box=>box.kind!=='label box'));
  marks.forEach((mark,i)=>{
    if(holes.some(hole=>boxesOverlap(mark,hole.box,0)))found.push(`a ${mark.kind==='circle'?'small circle':mark.kind} sits on a hole`);
    // two marks of different places on one spot (the strokes and the circle of one corner mark are one mark)
    if(marks.slice(i+1).some(other=>other.owner!==mark.owner&&boxesOverlap(mark,other,0)))found.push(`two marks (small circles, corner marks or tags) sit on each other`);
  });
  return[...new Set(found)];
}

/* What overlaps on a plain outline (plainPartLayout, js/shoppacket.js), at the size its words are drawn: [text]. */
function plainClearProblems(layout){
  const found=[];
  for(let i=0;i<layout.texts.length;i++){
    const text=layout.texts[i],box=text.box;
    if(box.x<-.5||box.y<-.5||box.x+box.w>layout.width+.5||box.y+box.h>layout.height+.5)found.push(`${quoted(text.text)} runs outside the drawing`);
    for(let j=i+1;j<layout.texts.length;j++)if(boxesOverlap(box,layout.texts[j].box,CLEAR.text))found.push(`${quoted(text.text)} touches ${quoted(layout.texts[j].text)}`);
    if(layout.marks.some(mark=>boxesOverlap(box,mark,CLEAR.mark)))found.push(`${quoted(text.text)} is written over a hole or a small circle`);
    const inner=shrunk(box,.5);
    if(layout.segments.some(segment=>segmentHitsRect(segment.a,segment.b,inner,0)&&!segmentEndsAt(segment,box)))found.push(`${quoted(text.text)} is crossed by a line`);
  }
  return[...new Set(found)];
}

/* ---------- the designs the check draws ----------
   Every preset at its defaults, at its smallest and at its largest sizes, in the three build styles. Smallest: every
   number of its form at the least the form allows (sizesToTry, js/structchecks.js, gives each number's least and most);
   largest: every number at its most. Where the preset refuses that mix (a slope too steep for a wall that low), each
   number is tried at its least (or most) alone. */
function clearCheckRuns(){
  const runs=[];
  for(const preset of PRESETS){
    const tries=sizesToTry(preset),base=presetDefaults(preset);
    const ends={smallest:{...base},largest:{...base}},single={smallest:[],largest:[]};
    // (sizesToTry lists each number twice after the default: its least, then its most)
    for(const size of tries.slice(1)){
      const changed=Object.keys(size.vals).filter(key=>size.vals[key]!==base[key]);
      for(const key of changed){
        const end=Number(size.vals[key])<Number(base[key])?'smallest':'largest';
        ends[end][key]=size.vals[key];
        single[end].push({vals:size.vals,where:size.where});
      }
    }
    for(const style of['std','fine','rustic']){
      runs.push({preset,vals:base,style,name:`${preset.name} (${STYLES[style][0]})`});
      for(const end of['smallest','largest'])runs.push({preset,vals:ends[end],style,name:`${preset.name} (${STYLES[style][0]}, ${end})`,fallback:single[end]});
    }
  }
  // and every choice of every form (presetVariants), in Everyday, as the drill checks try them
  for(const variant of presetVariants())if(variant.name!==variant.preset.name)runs.push({preset:variant.preset,vals:{...presetDefaults(variant.preset),...variant.vals},style:'std',name:variant.name});
  return runs;
}
/* the problems of every drawing of the design as it is now: [text] */
function clearProblemsOfDesign(){
  const found=[];
  const plan=buildPlan(true),list=cutRows();
  for(const label of plan.drill.labels){
    if(!label.drawn||label.mirror||!label.way)continue;
    const figure=drawingFigure(label,plan);
    for(const text of drawingClearProblems(figure.layout))found.push(`${label.name}: ${text}`);
  }
  // the plain outlines, at the size the page draws their words and at the phone's (css/phonepages.css)
  // (as partFigure draws them, js/shoppacket.js: a row with no drilling and no shape, or with drain holes)
  for(const row of list.rows){
    const holes=shopMakeOf(row,plan).some(entry=>entry.holes==='drain')?drainHolesOf(row):null;
    const drilled=plan.drill.labels.some(label=>label.letter===row.id&&label.drawn&&label.way&&!label.mirror),shaped=!!(row.sample&&row.sample.shape);
    if((drilled||shaped)&&!holes)continue;
    for(const phone of[false,true]){
      const layout=plainPartLayout(row,holes,!(drilled||shaped)&&!holes,phone);
      for(const text of plainClearProblems(layout))found.push(`${row.id} (outline${phone?', on the phone':''}): ${text}`);
    }
  }
  return found;
}
SELFTESTS.push(function drawingMarksNeverOverlap(problems){
  const kept=JSON.stringify(S);
  let designs=0;
  try{withoutDrawing(()=>{
    for(const run of clearCheckRuns()){
      // (a mix of least or most sizes the preset refuses: each number at its end alone)
      const attempts=[{vals:run.vals,name:run.name}].concat(run.fallback?run.fallback.map(one=>({vals:one.vals,name:`${run.preset.name} (${STYLES[run.style][0]}, ${one.where})`})):[]);
      for(const attempt of attempts){
        let placed=false;
        try{placed=placeInStyle(run.preset,{...attempt.vals},run.style);}catch(e){placed=false;}
        if(!placed)continue;
        designs++;
        for(const text of clearProblemsOfDesign().slice(0,3))if(problems.length<40)problems.push(`drawings: ${attempt.name}: ${text}`);
        if(attempt===attempts[0])break;   // the mix placed: its single ends are not needed
      }
    }
  });}finally{load(kept,true);}
  if(designs<200)problems.push(`drawings: only ${designs} designs were drawn to look for marks that overlap, too few`);
});
