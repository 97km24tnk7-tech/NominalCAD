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
const PART_VIEW={width:920,maxScale:40,maxHeight:300,number:16,label:14,legend:14,title:16,
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
    const kind=entry.clamp==='top'||entry.clamp==='bottom'?entry.clamp:'end';
    let row=rows.find(one=>one.setup===entry.setup&&one.kind===kind);
    if(!row){row={setup:entry.setup,kind,holes:[]};rows.push(row);}
    row.holes.push(entry);
  }
  return rows.sort((a,b)=>a.setup-b.setup||(a.kind<b.kind?-1:1));
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
  const margins=views.map(view=>sideNeeds(view));
  const mL=Math.max(...margins.map(m=>m.left)),mR=Math.max(...margins.map(m=>m.right));
  const L=views[0].length,H=views[0].height;
  const scale=Math.min(V.maxScale,(V.width-mL-mR)/L,V.maxHeight/H);
  out.scale=scale;
  const x0=mL+((V.width-mL-mR)-L*scale)/2,x1=x0+L*scale;
  // the title
  const name=`${labelNames(label)} (${label.name}${label.mirrorLabel?' and '+label.mirrorLabel.name:''})`;void piece;
  addText(`Where to drill: ${name}`,16,24,V.title,{cls:'t1',bold:true,role:'title'});
  addText(drawingSubtitle(label,views),16,43,V.label,{cls:'t2',role:'title'});
  let y=62;
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
/* how much room a view needs left and right of the piece: the sizes down from the top edge at an end */
function sideNeeds(view){
  const ends=endChains(view);
  const width=list=>list.length?24+Math.max(...list.map(value=>partTextWidth(fmt(r16(value)),PART_VIEW.number,true)))+14:0;
  return{left:Math.max(56,width(ends.left)+16),right:Math.max(56,width(ends.right)+16)};
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
  if(views.length===1)return`${capital(face)}, seen square on, top edge up`;
  if(views[1].kind==='mirror')return`${capital(face)}, seen square on, top edge up: as drawn (${label.name}) and the mirror image (${label.mirrorLabel.name})`;
  return'Face 1 (with the label) and face 2, each seen square on, top edge up';
}
/* one view: the piece, its sizes, its holes, its tags */
function layView(out,view,index,label,ctx){
  const V=PART_VIEW,{x0,x1,scale,addText,line}=ctx;
  let y=ctx.y;
  const two=label.views.length>1;
  if(two){
    const title=view.kind==='face1'?'Face 1, with the label':view.kind==='face2'?'Face 2: turn it end for end, top edge still up'
      :`Mirror image (${label.mirrorLabel.name}): the same sizes, the end with the label on the right`;
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
  // the band above the piece: the running sizes and the name of the top edge
  const topBand=runTop.length?numberLen(runTop)+V.gap+22:30;
  const yTop=y+topBand,yBottom=yTop+view.height*scale;
  const px=a=>view.datumLeft?x0+a*scale:x1-a*scale;   // a: from the end with the label
  const py=b=>yTop+b*scale;                          // b: down from the top edge
  const xDatum=view.datumLeft?x0:x1,xFar=view.datumLeft?x1:x0;
  const layoutView={kind:view.kind,x0,x1,yTop,yBottom,datumLeft:view.datumLeft,view};
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
  // the holes
  const holeMarks=view.holes.map(entry=>{
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
  });
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
      const marks=holeMarks.filter(mark=>Math.abs(r16(mark.entry.b)-value)<1e-6&&(mark.entry.clamp==='labelled'||mark.entry.clamp==='far')&&(right?mark.cx>(x0+x1)/2:mark.cx<(x0+x1)/2));
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
  // the label, written in the corner with the small circle, its arrow to the top edge (on face 1 only: face 2 shows
  // where the end with the label is by its heavy line and small circle)
  if(view.kind!=='face2')placeLabelBox(out,view,label,holeMarks,{x0,x1,yTop,yBottom});
  layViewNames(out,view,index,label,holeMarks,others,{x0,x1,yTop,yBottom,xDatum,addText,runBottom,numberLen,rows});
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
  for(let along=8;!tagBox&&along<(x1-x0)/2;along+=8){
    const box={x:cornerX+(view.datumLeft?along:-along),y:yTop+4,w:tagW,h:tagH};
    if(!blocked(box))tagBox=box;
  }
  if(!tagBox)tagBox={x:cornerX,y:yTop+4,w:tagW,h:tagH};
  out.items.push({type:'labelbox',...tagBox});
  out.texts.push({text:tag,x:tagBox.x+tagW/2,y:tagBox.y+13.5,size:V.label,anchor:'middle',rotate:false,box:{...tagBox},cls:'labt',bold:true,role:'labelbox'});
}
/* the names of a view: the top edge (in the widest gap above the piece), and the row under the piece: the end with
   the label (with a leader), a tag for each row of the table, the pieces that sit here later */
function layNames(out,view,index,label,holeMarks,others,{x0,x1,yTop,yBottom,xDatum,addText,runBottom,numberLen,rows},namesFirst){
  const V=PART_VIEW;
  let crossed=false;   // (a name had to take a place whose leader is not clear: layViewNames tries the other order)
  const xs=[x0,x1].concat(out.dims.filter(dim=>dim.view===index&&dim.kind==='along'&&dim.top).map(dim=>dim.x)).sort((a,b)=>a-b);
  let bestGap=null;
  for(let i=1;i<xs.length;i++)if(!bestGap||xs[i]-xs[i-1]>bestGap[1]-bestGap[0])bestGap=[xs[i-1],xs[i]];
  addText('top edge',(bestGap[0]+bestGap[1])/2,yTop-7,V.label,{anchor:'middle',cls:'lb',role:'name'});
  const bottomBand=runBottom.length?numberLen(runBottom)+V.gap+14:0;
  const rowY=yBottom+bottomBand+34,LINE=26;
  /* Each name goes as near its own x as it can on the first line under the piece where it fits clear of the names
     already there, else on the next line down. Returns {x, y} of its box. */
  const lines=[];
  // a leader is clear when it runs through no text, no tag already placed and no hole but its own target
  const tagBoxes=[],leaders=[];
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
    for(let line=0;line<6;line++){const pick=lineTries(line,true);if(pick)return pick;}
    for(let line=0;line<6;line++){const pick=lineTries(line,'overHoles');if(pick)return pick;}
    // no place with a clear leader: the first line that has room (the self-check reports what the leader crosses)
    crossed=true;
    for(let line=0;line<12;line++){const pick=lineTries(line,false);if(pick)return pick;}
    // (a name wider than the paper: at the left, on a line of its own)
    lines.push([{x:8,w:width}]);
    return{x:8,y:rowY+(lines.length-1)*LINE,target:wanted[0]};
  };
  // the end with the label: its leader ends on the end, at the corner under it or halfway up it
  {
    const text='end with the label',w=partTextWidth(text,V.label,false);
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
  for(const row of rows){
    const marks=holeMarks.filter(mark=>row.holes.includes(mark.entry)).sort((a,b)=>a.entry.a-b.entry.a);
    // (a row along the top edge of a piece that has a row along the bottom edge too: its leader crosses the piece,
    //  so it is tied to the hole nearest the middle, clear of what lies near the ends)
    if(row.kind==='top'&&rows.some(other=>other.kind==='bottom'))marks.sort((a,b)=>Math.abs(a.cx-(x0+x1)/2)-Math.abs(b.cx-(x0+x1)/2));
    const words=rowCountWords(row);
    const w=2*V.hexR+8+partTextWidth(words,V.label,false);
    const wanted=marks.flatMap(mark=>[{x:mark.cx+6,mark},{x:mark.cx-w-6,mark},{x:mark.cx+30,mark}]);
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
  for(let i=0;i<tags.length;i++)for(let j=i+1;j<tags.length;j++){
    const a=tags[i],b=tags[j];
    if(Math.abs(a.w-b.w)>.5||!segmentsCross(a.leader,b.leader))continue;
    const atA={...a.at,x:b.at.x,y:b.at.y},atB={...b.at,x:a.at.x,y:a.at.y};
    const leaderA=a.leaderOf(atA),leaderB=b.leaderOf(atB);
    if(segmentsCross(leaderA,leaderB))continue;
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
    const text=`${other.name} sits here${other.step?`, step ${other.step}`:''}`;
    if(!byName.has(text))byName.set(text,[]);
    byName.get(text).push(other);
  }
  // (several of one name: one leader, to one of them; the note under the drawing gives each place)
  for(const[text,list]of byName){
    const many=list.length>1?text.replace(/ sits here/,` sits at the dashed places (${list.length})`):text;
    const w=partTextWidth(many,V.label,false);
    // (the leader ends on the bottom edge of the dashed piece, which is the bottom edge of this one when it runs
    //  across; along a long piece several places on that edge are tried, so the leader can cross no other)
    //  (a dashed piece that runs across the whole width: its leader may also end inside it, partway up)
    const wanted=list.flatMap(other=>[.5,.8,.2,.65,.35,.95,.05].flatMap(f=>{
      const end=[other.px[0]+(other.px[1]-other.px[0])*f,other.py[1]];
      return[{x:end[0]+8,end},{x:end[0]-w-8,end}];
    }).concat(other.wholeWidth?[.5,.3,.7].flatMap(f=>{
      const end=[(other.px[0]+other.px[1])/2,other.py[0]+(other.py[1]-other.py[0])*f];
      return[{x:end[0]+30,end},{x:end[0]+90,end},{x:end[0]-w-30,end}];
    }):[]));
    const leaderOf=t=>[[Math.max(t.x+4,Math.min(t.x+w-4,t.target.end[0])),t.y-9],t.target.end];
    const at=place(wanted,w,leaderOf);
    addText(many,at.x,at.y+4.5,V.label,{cls:'lb',role:'name'});
    const[from,to]=leaderOf(at);
    out.items.push({type:'leader',x1:from[0],y1:from[1],x2:to[0],y2:to[1],dot:true,ink:true});
    leaders.push([from,to]);
  }
  }
}
/* The names of a view (layNames), laid a second time with the names of the pieces that sit here later before the
   tags when the first time left a leader no clear way (it would cross another leader or run through a text): in a
   mirror image the tag at the end with the label can shut in a dashed piece at that end. The first layout is kept
   unless the second is clear. */
function layViewNames(out,view,index,label,holeMarks,others,ctx){
  const textsBefore=out.texts.length,itemsBefore=out.items.length;
  const first=layNames(out,view,index,label,holeMarks,others,ctx,false);
  if(!first.crossed||!others.length)return;
  const kept={texts:out.texts.splice(textsBefore),items:out.items.splice(itemsBefore),bottom:out.bottomOfView};
  const second=layNames(out,view,index,label,holeMarks,others,ctx,true);
  if(!second.crossed)return;
  out.texts.splice(textsBefore);out.items.splice(itemsBefore);
  out.texts.push(...kept.texts);out.items.push(...kept.items);out.bottomOfView=kept.bottom;
}
const arrowBox=mark=>({x:Math.min(mark.arrow[0],mark.arrow[2])-3,y:Math.min(mark.arrow[1],mark.arrow[3])-3,w:Math.abs(mark.arrow[2]-mark.arrow[0])+6,h:Math.abs(mark.arrow[3]-mark.arrow[1])+6});
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
  const list=[{kind:'pocket',text:'pocket hole: the arrow points to where the jig goes'}];
  const tags=[...new Set(label.views.flatMap(view=>view.holes.map(entry=>entry.setup)))].sort((a,b)=>a-b);
  list.push({kind:'hex',tag:tags[0],tags,text:tags.length>1?`jig settings ${listWords(tags.map(String))} (the table above)`:`jig setting ${tags[0]} (the table above)`});
  list.push({kind:'datum',text:'sizes run from the small circle (0): write the label in that corner, its arrow to the top edge'});
  if(layout.items.some(item=>item.type==='rect'&&item.cls==='hid'))list.push({kind:'hidden',text:'dashed: a piece that sits here later'});
  if(label.views.some(view=>view.holes.some(entry=>entry.plugged)))list.push({kind:'plug',text:'a bar across: plug this hole once its screw is in'});
  return list;
}

/* ---------- the SVG ---------- */
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
        break;
      }
    }
  }
  for(const mark of layout.holes){
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
const tagSvg=no=>`<svg class="tag" viewBox="0 0 22 20" role="img" aria-label="setting ${no}"><polygon points="21,10 16,19 6,19 1,10 6,1 16,1"/><text x="11" y="14">${no}</text></svg>`;
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
  });
  return rows;
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
      if(row.kind==='end')continue;
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
  if(views.length>1){
    const endOnly=views.find(view=>viewRows(view).every(row=>row.kind==='end')),edgeOnly=views.find(view=>viewRows(view).every(row=>row.kind!=='end'));
    if(endOnly&&edgeOnly){
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
const doneKey=label=>`woodshop.drillDone.${S.name}.${label.name}.${label.signature}`;
function doneTicks(label){
  try{const kept=JSON.parse(localStorage.getItem(doneKey(label))||'[]');return Array.isArray(kept)?kept:[];}catch(e){return[];}
}
document.addEventListener('change',event=>{
  const box=event.target.closest&&event.target.closest('input[data-done-key]');
  if(!box)return;
  const figure=box.closest('.drill-fig');
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
  const each=`${label.holesEach} pocket hole${label.holesEach===1?'':'s'}${count>1?' each':''}${twoFaces?', on both faces':''}`;
  const ticks=doneTicks(label);
  const boxes=Array.from({length:count},(unused,i)=>`<input type="checkbox" data-done-key="${esc(doneKey(label))}"${ticks[i]?' checked':''} aria-label="${esc(piece.name)} ${i+1} drilled">`).join('');
  const sep='<span class="sep">·</span>';
  const names=[...new Set(label.members.concat(label.mirrorLabel?label.mirrorLabel.members:[]).map(member=>member.piece.name))].join(', ');
  const head=`<div class="fig-head"><span class="key">${esc(label.name)}</span><b>${esc(names)}</b>${sep}${esc(m.short)}, ${esc(fmt(piece.l))}${sep}${esc(make)}${sep}${esc(each)}<span class="done">Done ${boxes}</span></div>`;
  const rows=holeTableRows(label,plan);
  const table=docTable([['',''],['Setting',''],['How many',''],['Where',''],['Later','']],
    rows.map(row=>`<tr><td>${tagSvg(row.tag)}</td><td>${esc(row.setting)}</td><td>${esc(row.many)}</td><td>${esc(row.where)}</td><td>${esc(row.later)}</td></tr>`),'drill-holes');
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
  const setups=drill.setups;
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
  if(nothing){
    const items=nothing.entries.map(entry=>`${keyBox(entry.name)} ${esc(entry.pieces[0].name)} (${entry.count})`);
    lines.push(`Nothing to drill: ${listWords(items)}. ${esc(nothing.why)}`);
  }
  const drilledPieces=drill.labels.reduce((sum,label)=>sum+label.members.length,0);
  const perLabel=drill.labels.map(label=>`${label.name} ${label.holesEach}${label.members.length>1?' on each':''}`);
  const listed=pocketScrewsListed(),screwsTotal=listed.screws.reduce((sum,[,count])=>sum+count,0);
  const screws=listed.screws.map(([label,count],index)=>index?`${count}, ${screwSize(label)}`:`${count} pocket-hole screws, ${screwSize(label)}`);
  const plugs=listed.plugs.reduce((sum,[,count])=>sum+count,0);
  lines.push(esc(`When you are done: ${drill.total} pocket hole${drill.total===1?'':'s'} in ${drilledPieces} piece${drilledPieces===1?'':'s'} (${listWords(perLabel)}). `+
    (screwsTotal===drill.total?`That matches the shopping list: ${listWords(screws)}${plugs?`, and ${plugs} pocket-hole plugs`:''}.`:`The shopping list has ${listWords(screws)}.`)));
  for(const line of assemblyWords(drill,letterOf))lines.push(esc(line));
  return`<div class="tail">${lines.map(line=>`<p>${line}</p>`).join('')}</div>`;
}
const BEFORE_YOU_DRILL=[
  'On each piece, pick the face you like least: the holes go in it, and it ends up inside or underneath, where nobody sees it.',
  'Write the label of the piece on that face in the corner with the small circle, with an arrow pointing to the top edge, as its drawing shows. Every size is measured from that corner: hook your tape on the end with the label.',
  'Store boards vary by about 1/16" in width and thickness, so measure from the end and the edge the drawing names, and drill one test hole in a scrap of the same board first, to check the jig and the stop collar.'];
function drillStepHtml(step,plan){
  const drill=plan.drill;
  let h=stepTextHtml(step);
  h+=`<div class="drill-box"><h4>Before you drill</h4><ol>${BEFORE_YOU_DRILL.map(line=>`<li>${esc(line)}</li>`).join('')}</ol></div>`;
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
  const settings=drill.setups.length===1?`Your pocket-hole jig needs one setting: ${fmt(drill.setups[0].jig)} stock.`
    :`Your pocket-hole jig needs ${drill.setups.length} settings: ${listWords(drill.setups.map(setup=>`${setup.no} for ${fmt(setup.jig)} stock`))}.`;
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
    if(preset)for(const size of sizesToTry(preset).slice(1))runs.push({preset,vals:size.vals,style:'std',name:`${name} (${size.where})`});
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
/* the holes of a piece of a label, in its own frame, against the view that draws them */
function memberHolesMatch(label,member,drill){
  const sample=label.way.sample,back=inverseSymmetry(member.sym);
  const carry=v=>toWorldVector(member.piece,mapVector(back,toLocalVector(sample,v)));
  const wrong=[];
  const used=label.views.map(view=>new Array(view.holes.length).fill(false));
  for(const hole of drill.byPiece.get(member.piece.id)||[]){
    const k=label.faces.findIndex(face=>sameVector(carry(face),hole.out));
    if(k<0){wrong.push('a hole on a face the drawing does not show');continue;}
    const frame={...member.frame,n:carry(label.faces[k])},at=benchPoint(frame,hole.at);
    const view=label.views[k];
    const index=view.holes.findIndex((entry,i)=>!used[k][i]&&entry.setup===hole.setup&&Math.abs(entry.a-at.a)<=DRILL_SAME&&Math.abs(entry.b-at.b)<=DRILL_SAME);
    if(index<0){wrong.push(`a hole ${fmt(r16(at.a))} from the end with the label and ${fmt(r16(at.b))} down from the top edge is not on the drawing`);continue;}
    used[k][index]=true;
  }
  return wrong;
}
/* checks 1 to 5 on the design as it is now; returns how many drawings it looked at */
function drillDesignProblems(plan,said,run){
  const drill=plan.drill;
  // 1. every live hole drilled ahead is a hole of the plan, on one view of one label, once per piece
  const live=[];
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link))if(drilledAhead(drillKindOf(f)))live.push(f);
  }
  if(live.length!==drill.total)said('drillPlanHoldsEveryHole',`${live.length} pocket holes in the model, ${drill.total} in step 2`);
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
      memberHolesMatch(label,member,drill).slice(0,1).forEach(text=>said('drillPlanHoldsEveryHole',`${label.name}: ${text}`));
    }
    const drawn=label.views.filter(view=>view.kind!=='mirror').reduce((sum,view)=>sum+view.holes.length,0);
    if(drawn!==label.holesEach)said('drillPlanHoldsEveryHole',`the drawing of ${label.name} shows ${drawn} holes, the piece has ${label.holesEach}`);
    if(label.views.length>2)said('drillPlanHoldsEveryHole',`the drawing of ${label.name} has ${label.views.length} views`);
    if(label.mirror)continue;
    // 2. the drawing measures true
    drawings++;
    const figure=drawingFigure(label,plan);
    partLayoutProblems(figure,label,drill).slice(0,2).forEach(text=>said('partDrawingsMeasureTrue',`${label.name}: ${text}`));
    if(figure.allNotes.length>3)said('partDrawingsMeasureTrue',`${label.name} has ${figure.allNotes.length} notes: ${figure.allNotes.map(note=>note.slice(0,30)).join(' / ')}`);
    // the Later column tells the step and the piece of every piece's screws, not only the first piece's
    const pieces=label.members.length+(label.mirrorLabel?label.mirrorLabel.members.length:0);
    for(const row of figure.rows){
      if(row.laterHoles.length!==row.row.holes.length*pieces)said('partDrawingsMeasureTrue',`${label.name}: the Later column of setting ${row.tag} reads ${row.laterHoles.length} holes of ${row.row.holes.length*pieces}`);
      const untold=row.laterHoles.find(hole=>!new RegExp(`\\b${hole.step}\\b`).test(row.later)||!row.later.includes(pieceLabel(hole.f.into,plan.letterOf)));
      if(untold)said('partDrawingsMeasureTrue',`${label.name}: a screw of ${untold.piece.name} goes into the ${untold.f.into.name} in step ${untold.step}, and the Later column says "${row.later}"`);
    }
    // 4. the face the header and the views name is the face the holes are on
    for(const view of label.views)if(view.kind!=='mirror'&&view.holes.some(entry=>!sameVector(entry.hole.out,view.frame.n)))said('drilledFacesStayHidden',`the view of ${label.name} names another face than the one its holes are on`);
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
  for(const f of live)if(!drill.holes.some(hole=>hole.f===f)){said('drillPlanHoldsEveryHole',`a pocket hole in ${f.through.name} is in no label`);break;}
  // 3. the counts against the shopping list
  if(drill.total){
    const listed=pocketScrewsListed(),bySize=new Map();
    for(const hole of drill.holes)bySize.set(screwSize(hole.screw),(bySize.get(screwSize(hole.screw))||0)+1);
    for(const[label,count]of listed.screws)if(bySize.get(screwSize(label))!==count)said('drillCountsMatchTheShoppingList',`${bySize.get(screwSize(label))||0} holes for ${label}, the shopping list buys ${count}`);
    if(listed.screws.reduce((sum,[,count])=>sum+count,0)!==drill.total)said('drillCountsMatchTheShoppingList',`${drill.total} holes, ${listed.screws.reduce((sum,[,count])=>sum+count,0)} pocket-hole screws on the shopping list`);
    const plugged=drill.holes.filter(hole=>hole.plugged).length,plugs=listed.plugs.reduce((sum,[,count])=>sum+count,0);
    if(plugged!==plugs)said('drillCountsMatchTheShoppingList',`${plugged} holes to plug, ${plugs} pocket-hole plugs on the shopping list`);
    const tail=drillTailHtml(drill,plan.letterOf);
    if(!tail.includes(`When you are done: ${drill.total} pocket hole`)||!/That matches the shopping list/.test(tail))said('drillCountsMatchTheShoppingList','the count line does not give the count that matches the shopping list');
  }
  // 4. the face a drawing names is the face its pieces' steps name ("inside face" on the drawing, "outside face" in
  //    the step that puts in one of its pieces is a wrong face)
  for(const step of plan.steps){
    for(const group of step.groups){
      if(!group.predrilled)continue;
      for(const link of group.links){
        const f=fastenersOfLink(link)[0],label=f&&drill.labelOfPiece.get(f.through.id);
        if(!label||!label.way)continue;
        // (a drawing of two faces names them face 1 and face 2, not by where they face)
        const base=label.mirror?label.twin:label,named=drawnFaceWords(base).split(' (')[0];
        if(/face with the holes/.test(named)||base.views.some(view=>view.kind==='face2'))continue;
        const inLine=faceWords(f.through,f.pocket.out,false).split(' (')[0];
        if(inLine!==named){said('drilledFacesStayHidden',`step ${step.no}, line ${group.no} drills the ${inLine} of ${f.through.name}, its drawing ${base.name} names the ${named}`);break;}
      }
    }
  }
  // 4. no drilled face is a show face (house furniture, Everyday and Fine)
  if(HOUSE_FURNITURE.includes(run.preset.name)&&SHOW_FACES.styles.includes(run.style)){
    const ours=new Set(drill.holes.map(hole=>hole.f));
    const shown=headsOnShowFaces().filter(head=>ours.has(head.f)&&!showFaceAllowed(run.preset.name,run.style,head));
    if(shown.length)said('drilledFacesStayHidden',`${shown.length} pocket holes drilled ahead are on a face that is seen (${shown[0].f.through.name}, ${shown[0].face})`);
  }
  // 5. no later step asks to drill a hole step 2 holds; every pre-drilled line names its drawing, with the numbers of it
  if(drill.total&&drill.complete){
    const words=new Map(drill.labels.filter(label=>label.drawn&&label.way&&!label.mirror).map(label=>[label.name,drawingWords(label,plan)]));
    for(const step of plan.steps){
      const pockets=step.groups.filter(group=>group.type==='pocket');
      if(pockets.length&&pockets.every(group=>group.predrilled)){
        const orders=drillOrders(step.words);
        if(orders.length)said('noHoleDrilledTwice',`step ${step.no} still says: "${orders[0].trim().slice(0,90)}"`);
      }
      for(const group of pockets){
        if(!group.predrilled){said('noHoleDrilledTwice',`step ${step.no}, line ${group.no}: its pocket holes are on no drawing`);continue;}
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
/* every number and word a drawing of a label gives: its sizes and its table, its notes */
function drawingWords(label,plan){
  const figure=drawingFigure(label,plan);
  return figure.layout.texts.map(text=>text.text).concat(figure.rows.map(row=>row.where+' '+row.many),figure.notes).join(' ');
}
/* check 2 on one figure: sizes, numbers, ovals, settings, and no text over another or over a hole */
function partLayoutProblems(figure,label,drill){
  const found=[],layout=figure.layout,scale=layout.scale;
  const table=figure.rows.map(row=>row.where).join(' ');
  for(const dim of layout.dims){
    const lay=layout.views[dim.view],view=lay.view;
    if(dim.text!==fmt(r16(dim.value)))found.push(`the size ${dim.text} is not its value written to 1/16"`);
    if(dim.kind==='along'){
      const want=lay.datumLeft?lay.x0+dim.value*scale:lay.x1-dim.value*scale;
      if(Math.abs(dim.x-want)>1)found.push(`the size ${dim.text} is drawn ${Math.abs(dim.x-want).toFixed(1)} px from where it measures`);
      const isEnd=Math.abs(dim.value)<1e-6||Math.abs(dim.value-r16(view.length))<1e-6;
      const hole=view.holes.find(entry=>(entry.clamp==='top')===dim.top&&(entry.clamp==='top'||entry.clamp==='bottom')&&Math.abs(r16(entry.a)-dim.value)<1e-6);
      if(!isEnd&&!hole)found.push(`the size ${dim.text} along the piece measures to no hole`);
      if(hole&&Math.abs(hole.a-dim.value)>DRILL_SAME)found.push(`the size ${dim.text} is ${Math.abs(hole.a-dim.value).toFixed(3)}" off its hole`);
      if(!isEnd&&!table.includes(dim.text))found.push(`the size ${dim.text} is not in the table`);
    }else{
      const want=lay.yTop+dim.value*scale;
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
    if(Math.abs(mark.rx-Math.max(6,POCKET_OVAL*scale))>.01)found.push('a pocket hole is not drawn as long as the oval the bit leaves');
    const hole=mark.entry.hole,setup=drill.setups.find(one=>one.no===hole.setup);
    if(!setup||Math.abs(setup.jig-hole.jig)>1e-6)found.push('a hole is tagged with a setting that is not its own');
  }
  for(const row of figure.rows)if(!row.setting.includes(fmt(drill.setups.find(one=>one.no===row.tag).jig)+' stock')||row.row.holes.some(entry=>Math.abs(entry.hole.jig-drill.setups.find(one=>one.no===row.tag).jig)>1e-6))found.push(`the table gives setting ${row.tag} for holes of another`);
  // a dashed piece is drawn where that piece meets this face in the model: its ends along the piece and its edges
  // across it, measured from the end with the label and the top edge (worked out here from the two boxes)
  for(const item of layout.items){
    if(item.type!=='rect'||item.cls!=='hid'||!item.other)continue;
    const lay=layout.views[item.view],view=lay.view,frame=view.frame;
    const mine=plainBox(view.piece),theirs=plainBox(item.other.piece);
    const span=k=>[Math.max(mine.lo[k],theirs.lo[k]),Math.min(mine.hi[k],theirs.hi[k])];
    const[aLo,aHi]=span(frame.lengthAxis).map(v=>(v-frame.datumAt)*Math.sign(frame.along[frame.lengthAxis])).sort((x,y)=>x-y);
    const[bLo,bHi]=span(frame.upAxis).map(v=>(frame.topAt-v)*Math.sign(frame.up[frame.upAxis])).sort((x,y)=>x-y);
    const x=lay.datumLeft?lay.x0+aLo*scale:lay.x1-aHi*scale,y=lay.yTop+bLo*scale;
    if(Math.abs(item.x-x)>1||Math.abs(item.w-(aHi-aLo)*scale)>1||Math.abs(item.y-y)>1||Math.abs(item.h-(bHi-bLo)*scale)>1)
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
    look().style='rustic';commit();
    plan=buildPlan(true);
    if(plan.steps.some(step=>step.kind==='drill')||plan.drill.total)wrong('the Desk in Rustic / rough has a step "Drill your pieces"');
    const shed=PRESETS.find(candidate=>candidate.name==='Shed');
    if(shed){
      placeInStyle(shed,presetDefaults(shed),'std');
      if(buildPlan(true).steps.some(step=>step.kind==='drill'))wrong('the Shed has a step "Drill your pieces"');
      if(/Drill first/.test(cutListSection(cutRows())))wrong('the Shed has a Drill first column');
    }
    const shelf=PRESETS.find(candidate=>candidate.name==='Bookshelf');
    if(shelf){
      placeInStyle(shelf,{...presetDefaults(shelf),W:40},'std');
      const count=buildPlan(true).drill.labels.length;
      if(count>6)wrong(`the Bookshelf 40" wide has ${count} labels to drill`);
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
  });
});
