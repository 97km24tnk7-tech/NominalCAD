/* NominalCAD: the pictures of the build steps.

   takePictures() (js/plans.js) sets the 3D scene up for pictures (nothing selected or hidden, doors closed, white
   paper behind) and then calls stepPictures(plan) here. It uses the same renderer and the same scene as every
   other picture; nothing here makes a second 3D view.

   For every step of buildPlan() (js/buildsteps.js):
     the step picture   the whole design from the usual corner: pieces added in this step orange, earlier pieces
                        pale, later ones left out. THIS STEP'S fasteners are drawn in dark blue on top of the wood
                        (so they show through it), thick enough to see at this size, and each "Fasten with" line
                        has a numbered balloon that points at one of its joints.
     close-ups          one for each different kind of connection in the step (never more than CLOSEUPS_MAX), as a
                        pair: "How it goes in" (src), a slanted view near one joint with only its two pieces, the
                        fasteners at their real size passing through one piece into the other, both pieces and
                        the fastener labelled, and no sizes; and "Where to mark" (mark), the marking view of
                        js/markingview.js: the face that is marked, seen square on, with every size of the line
                        drawn at its true length from the edge the words measure it from.
     pencil marks       a marking step draws its pencil lines on the step picture; their heights are in a marking
                        view of their own (markView)
   Labels and balloons are drawn in 2D over the 3D picture, so they are sharp and always the same size.

     stepPictures(plan)                 [{src, closeups: [{src, mark, no, caption, words}], markView, drawn, total}], one entry
                                        per step; mark and markView.src are keys of marking views drawn when they are
                                        seen (markingSource, js/markingview.js)
     fastenerMarkers(fasteners, look)   a THREE.Group that draws these fasteners; Build step by step uses it too */
'use strict';

const STEP_COL={added:0xf2a03d,earlier:0xefe3cc,fastener:0x0b3a8f,ink:'#14181d',paper:'#ffffff'};
const STEP_PICTURE={width:880,height:560};   // in picture pixels, whatever the screen's pixel ratio
const CLOSEUPS_MAX=6;        // close-ups in one step: one for each line (a step has at most LINES_MAX lines, js/buildsteps.js)
const MARKERS_MAX=900;
const CLOSEUP_MIN_RADIUS=.055; // in a close-up a fastener is drawn at its real size, but never thinner than this (a brad is 1/16" thick: it would be a hair)       // fasteners drawn in one step picture; the page says so when a step has more

/* ---------- fasteners drawn as plain dark shapes ---------- */
/* look: {color, minRadius, onTop}
     minRadius   a fastener is drawn at least this thick, in inches (0 = at its real size)
     onTop       true to draw over the wood, so the fastener shows through it */
function fastenerMarkers(fasteners,look){
  const sticks=[],blocks=[],color=look.color,minRadius=look.minRadius||0;
  const pin=f=>{
    const radius=Math.max(f.dia/2,minRadius),headRadius=Math.max((f.head||f.dia)/2,minRadius*1.5);
    sticks.push([stickAt(f.pos,f.dir,radius,f.len),color]);
    if(f.head)sticks.push([stickAt(pointPlus(f.pos,f.dir,-.04),f.dir,headRadius,Math.max(.1,minRadius*.8)),color]);
  };
  for(const f of fasteners){
    if(f.kind==='bracket'){
      for(const plate of f.plates)blocks.push([blockAt(plate.c,plate.s.map(v=>Math.max(v,minRadius))),color]);
      for(const screw of f.screws)pin(screw);
    }else pin(f);
    if(f.kind==='pocket'&&look.real){   // the slanted hole, from the face down to the head of the screw
      const mouth=f.pocket.mouth,long=Math.hypot(f.pos[0]-mouth[0],f.pos[1]-mouth[1],f.pos[2]-mouth[2]);
      sticks.push([stickAt(mouth,f.dir,f.pocket.dia/2,long),0x6b7d99]);
    }
    // a plugged head (rule 12, js/fasteners.js): the plug that fills the counterbore over the head, a short round
    // of wood from the face down to the head, in the color the 3D view gives plugs
    if(f.plug&&look.real)sticks.push([stickAt(f.plug.at,f.dir,f.plug.dia/2,Math.max(.05,f.sunk-.04)),FASTENER_LOOK.plug]);
  }
  const group=new THREE.Group();
  // onTop: drawn after the wood, see-through wood included (three.js draws transparent things last, in renderOrder)
  const material=()=>new THREE.MeshBasicMaterial({color:0xffffff,depthTest:!look.onTop,depthWrite:!look.onTop,transparent:!!look.onTop});
  for(const mesh of[instanced(FAST_STICK,sticks,material()),instanced(FAST_BLOCK,blocks,material())]){
    if(!mesh)continue;
    mesh.renderOrder=5;
    group.add(mesh);
  }
  return group;
}
/* every fastener of a step, as one list */
function stepFasteners(step){
  const list=[];
  for(const group of step.groups)for(const link of group.links)for(const f of fastenersOfLink(link))list.push(f);
  return list;
}

/* ---------- drawing in 2D over a 3D picture ---------- */
let annotateCanvas=null;
/* Renders the scene through this camera, lets draw(pen) add to it in 2D, and returns the picture.
   pen = {ctx, scale, width, height, point(xyz) -> [x, y] in picture pixels} */
function annotatedPicture(eye,draw){
  renderer.render(scene,eye);
  const source=renderer.domElement;
  if(!annotateCanvas)annotateCanvas=document.createElement('canvas');
  annotateCanvas.width=source.width;annotateCanvas.height=source.height;
  const ctx=annotateCanvas.getContext('2d');
  ctx.drawImage(source,0,0);
  const scale=source.width/STEP_PICTURE.width,spot=new THREE.Vector3();
  ctx.setTransform(scale,0,0,scale,0,0);   // everything below is drawn in picture pixels
  const point=p=>{
    spot.set(p[0],p[1],p[2]).project(eye);
    return[(spot.x+1)/2*STEP_PICTURE.width,(1-spot.y)/2*STEP_PICTURE.height];
  };
  draw({ctx,point,width:STEP_PICTURE.width,height:STEP_PICTURE.height});
  return annotateCanvas.toDataURL('image/jpeg',.86);
}
const PICTURE_FONT='"Segoe UI",system-ui,Arial,sans-serif';
/* a line with a white edge, so it reads on wood and on paper */
function inkLine(ctx,from,to,width){
  for(const[color,wide]of[[STEP_COL.paper,width+3],[STEP_COL.ink,width]]){
    ctx.strokeStyle=color;ctx.lineWidth=wide;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(from[0],from[1]);ctx.lineTo(to[0],to[1]);ctx.stroke();
  }
}
function inkDot(ctx,at,radius){
  ctx.fillStyle=STEP_COL.paper;ctx.beginPath();ctx.arc(at[0],at[1],radius+1.5,0,7);ctx.fill();
  ctx.fillStyle=STEP_COL.ink;ctx.beginPath();ctx.arc(at[0],at[1],radius,0,7);ctx.fill();
}
/* a white box with one or two lines of text; returns its rectangle {x, y, w, h}. at = its top left corner. */
function textBox(ctx,lines,at,measureOnly){
  const pad=8,gap=4;
  let wide=0,high=pad*2-gap;
  for(const line of lines){
    ctx.font=`${line.bold?600:400} ${line.size}px ${PICTURE_FONT}`;
    wide=Math.max(wide,ctx.measureText(line.text).width);
    high+=line.size+gap;
  }
  const rect={x:at[0],y:at[1],w:Math.ceil(wide)+pad*2,h:Math.ceil(high)};
  if(measureOnly)return rect;
  ctx.fillStyle=STEP_COL.paper;ctx.fillRect(rect.x,rect.y,rect.w,rect.h);
  ctx.strokeStyle=STEP_COL.ink;ctx.lineWidth=1.5;ctx.strokeRect(rect.x+.75,rect.y+.75,rect.w-1.5,rect.h-1.5);
  ctx.fillStyle=STEP_COL.ink;ctx.textBaseline='top';ctx.textAlign='left';
  let y=rect.y+pad;
  for(const line of lines){
    ctx.font=`${line.bold?600:400} ${line.size}px ${PICTURE_FONT}`;
    ctx.fillText(line.text,rect.x+pad,y);
    y+=line.size+gap;
  }
  return rect;
}
/* the point of a rectangle nearest to a point outside it */
const nearestOnRect=(rect,p)=>[Math.max(rect.x,Math.min(rect.x+rect.w,p[0])),Math.max(rect.y,Math.min(rect.y+rect.h,p[1]))];

/* ---------- the step picture: numbered balloons ---------- */
const BALLOON={radius:24,reach:80,font:30};
/* balloons: [{no, spot: [x, y, z]}]: the number of a line, and the place in the design its balloon points at */
function drawBalloons(pen,balloons,avoid){
  const{ctx,point,width,height}=pen,placed=[];
  // avoid: rectangles already written on the picture (the heights of pencil marks), which a balloon must not cover
  const clearOf=spot=>(avoid||[]).every(rect=>Math.hypot(spot[0]-Math.max(rect.x,Math.min(rect.x+rect.w,spot[0])),spot[1]-Math.max(rect.y,Math.min(rect.y+rect.h,spot[1])))>BALLOON.radius+4);
  for(const group of balloons){
    const target=point(group.spot);
    // it stands off toward the edge of the picture, turned a little when another balloon is in the way
    let angle=Math.atan2(target[1]-height/2,target[0]-width/2),at=null;
    if(Math.hypot(target[0]-width/2,target[1]-height/2)<8)angle=-Math.PI/2;
    const TRIES=avoid&&avoid.length?20:12;
    for(let tries=0;tries<TRIES&&!at;tries++){
      const turn=angle+(tries%2?1:-1)*Math.ceil(tries/2)*.5,reach=BALLOON.reach+(tries>7?40:0);
      const spot=[target[0]+Math.cos(turn)*reach,target[1]+Math.sin(turn)*reach];
      spot[0]=Math.max(BALLOON.radius+6,Math.min(width-BALLOON.radius-6,spot[0]));
      spot[1]=Math.max(BALLOON.radius+6,Math.min(height-BALLOON.radius-6,spot[1]));
      const free=clearOf(spot)&&placed.every(other=>Math.hypot(other.at[0]-spot[0],other.at[1]-spot[1])>BALLOON.radius*2+8&&Math.hypot(other.target[0]-spot[0],other.target[1]-spot[1])>BALLOON.radius+8);
      if(free||tries===TRIES-1)at=spot;
    }
    placed.push({at,target,no:group.no});
  }
  for(const balloon of placed)inkLine(ctx,balloon.target,balloon.at,2.5);
  for(const balloon of placed){
    inkDot(ctx,balloon.target,5);
    ctx.fillStyle=STEP_COL.paper;ctx.beginPath();ctx.arc(balloon.at[0],balloon.at[1],BALLOON.radius,0,7);ctx.fill();
    ctx.strokeStyle=STEP_COL.ink;ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle=STEP_COL.ink;ctx.font=`600 ${BALLOON.font}px ${PICTURE_FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(balloon.no),balloon.at[0],balloon.at[1]+1);
  }
}

/* ---------- cut-list letters on the pieces ---------- */
/* A small square tag with the cut-list letter on each of these pieces, where the piece is in the picture just now
   (a door may be drawn open, the design pulled apart). With more than PIECE_TAGS_MAX pieces only the first piece
   of each letter gets one, so a wall of studs does not disappear under its tags. */
const PIECE_TAGS_MAX=24;
/* avoid: rectangles a tag must keep off (the pencil marks of a marking step); a tag that would sit on one is moved
   along the piece, up or down first, until it is clear. Returns the rectangles of the tags. */
function drawPieceLetters(pen,pieces,letterOf,avoid){
  const{ctx,point}=pen,seen=new Set(),spot=new THREE.Vector3(),placed=[];
  ctx.font=`600 20px ${PICTURE_FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';
  for(const piece of pieces){
    const letter=letterOf(piece),g=meshes.get(piece.id);
    if(!letter||!g||(pieces.length>PIECE_TAGS_MAX&&seen.has(letter)))continue;
    seen.add(letter);
    g.updateMatrixWorld(true);
    g.getWorldPosition(spot);
    const middle=point([spot.x,spot.y,spot.z]),wide=ctx.measureText(letter).width+10;
    const hits=at=>(avoid||[]).some(rect=>at[0]-wide/2<rect.x+rect.w+3&&at[0]+wide/2>rect.x-3&&at[1]-12<rect.y+rect.h+3&&at[1]+12>rect.y-3);
    const moves=[[0,0],[0,-30],[0,30],[0,-60],[0,60],[0,-90],[0,90],[-30,0],[30,0]];
    const at=moves.map(([dx,dy])=>[middle[0]+dx,middle[1]+dy]).find(candidate=>!hits(candidate))||middle;
    placed.push({x:at[0]-wide/2,y:at[1]-12,w:wide,h:24});
    ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(at[0]-wide/2,at[1]-12,wide,24);
    ctx.strokeStyle=STEP_COL.ink;ctx.lineWidth=1.2;ctx.strokeRect(at[0]-wide/2,at[1]-12,wide,24);
    ctx.fillStyle=STEP_COL.ink;ctx.fillText(letter,at[0],at[1]+1);
  }
  return placed;
}

/* ---------- pencil marks of a marking step ---------- */
/* A step that tells the builder to mark where pieces go ("mark the shelf positions across all of them") shows the
   marks: on each upright piece of the step, a line across the face where a flat piece will meet it, at the height
   of that piece's underside, with the height written beside it. Only heights that the words of the step give are
   drawn, so the picture and the words always agree. Returns [{piece, from, to, text}] in design inches. */
const MARKING_WORDS=/\bmark\b/i;
function markingLines(step,fresh){
  if(!MARKING_WORDS.test(step.words))return[];
  const uprights=new Set(S.parts.filter(p=>fresh.has(p.id)&&!isProp(p)&&!tilted(p)&&p.ax[0]===1).map(p=>p.id));
  if(!uprights.size)return[];
  const lines=[],seen=new Set();
  for(const joint of findJoints()){
    if(joint.k===1)continue;   // a mark goes on a standing face
    for(const[piece,other]of[[joint.a,joint.b],[joint.b,joint.a]]){
      if(!uprights.has(piece.id)||uprights.has(other.id))continue;
      const height=r16(plainBox(other).lo[1]-piece.pos[1]),text=fmt(height);
      if(height<.1||!step.words.includes(text)||seen.has(piece.id+'|'+text))continue;
      seen.add(piece.id+'|'+text);
      const b=plainBox(piece),across=[0,2].find(k=>k!==joint.k);
      const from=[0,0,0],to=[0,0,0];
      from[joint.k]=to[joint.k]=joint.plane;
      from[1]=to[1]=piece.pos[1]+height;
      from[across]=b.lo[across];to[across]=b.hi[across];
      lines.push({piece,from,to,text});
    }
  }
  return lines;
}
/* The marks as dark pencil lines. Their heights are NOT written here: this picture is seen at a slant, where a
   height cannot be drawn at its true length. They are in the marking view under the picture (marksMarkPlan,
   js/markingview.js), drawn square to the face. Returns the rectangles the letter tags and the balloons must keep
   off: the box round each pencil line. */
function drawMarks(pen,lines){
  const{ctx,point}=pen,boxes=[];
  for(const line of lines){
    const a=point(line.from),b=point(line.to);
    inkLine(ctx,a,b,3);
    boxes.push({x:Math.min(a[0],b[0])-2,y:Math.min(a[1],b[1])-2,w:Math.abs(a[0]-b[0])+4,h:Math.abs(a[1]-b[1])+4});
  }
  return boxes;
}

/* ---------- the close-up of one joint ---------- */
/* Where the eye is for a close-up, as a direction from the joint: on the side the fastener is driven from, off
   to one side so the fastener is seen from the side as well, and always from a little above. */
/* Is the close-up of a joint whose faces meet along k looked at from the front, along this axis? A joint of two
   pieces side by side (k is left to right: a shelf against a divider) is, so the board the steps call "the one on
   the left" is on the left in the picture too; seen from the back it would be on the right. Not when the fastener
   is driven from the back (from: the way back out of the wood). */
function frontSeen(k,axis,from){
  return k===0&&axis===2&&!(from[2]<-.5);
}
function closeupEye(f,joint,center){
  const middle=designMiddle(),k=joint.k;
  if(f.kind==='pocket'){
    /* A pocket hole is on the hidden face of its piece, and the screw crosses the joint at a slant. So the eye is
       on the side the holes open to (the inside face, or underneath), a little back from the joint and off to one
       side: the mouths of the holes show on that face, and the screws are seen going in at their slant. */
    const out=f.pocket.out,eye=[0,0,0];
    const across=[0,1,2].find(axis=>axis!==k&&Math.abs(out[axis])<.5);   // the direction the holes are spread along
    for(let axis=0;axis<3;axis++)eye[axis]=out[axis]*.62;
    eye[k]-=Math.sign(f.dir[k]||1)*.42;                                  // from the piece with the holes, looking toward the joint
    // and from one side (from above when the row of holes is upright); a joint between two pieces side by side
    // (a shelf and a divider) from the front, so its left and right are the ones the words name (frontSeen)
    eye[across]+=(across===1?1:frontSeen(k,across,[0,0,0])?1:center[across]>=middle[across]-1?1:-1)*.5;
    if(Math.abs(out[1])<.5&&eye[1]<.3)eye[1]=.3;                         // holes in an upright face: looked at from a little above
    const length=Math.hypot(eye[0],eye[1],eye[2]);
    return eye.map(v=>v/length);
  }
  const from=[-f.dir[0],-f.dir[1],-f.dir[2]];
  const eye=[0,0,0];
  eye[k]=Math.sign(from[k]||1)*.34;   // mostly from the side, so the whole length of the fastener shows
  const others=[0,1,2].filter(axis=>axis!==k);
  const level=others.filter(axis=>axis!==1);   // the directions that run along the floor
  others.forEach(axis=>{
    // from above; else from outside the design (from the front or the right when it is in the middle); a joint of
    // two pieces side by side always from the front, unless the screw is driven from the back (frontSeen)
    const away=axis===1?1:frontSeen(k,axis,from)?1:center[axis]>=middle[axis]-1?1:-1;
    // a fastener that lies level is looked at from a little above; one that stands upright from two sides at once
    eye[axis]=away*(axis===1?.42:level.length===1?.8:axis===level[0]?.76:.55);
  });
  // a screw that is driven UP (through a rail into the underside of a top) is looked at from below, where the
  // drill is; everything else from a little above
  const drivenUp=k===1&&f.dir[1]>.7;
  if(drivenUp)eye[1]=-.42;
  else if(eye[1]<.3)eye[1]=.3;
  const long=Math.hypot(eye[0],eye[1],eye[2]);
  return eye.map(v=>v/long);
}
function closeupPicture(step,group,fresh){
  const{link,layout,dims}=group.sample,joint=link.joint,f0=layout[0];
  const shape=jointShape(joint);
  // near one end of the joint: the first two fasteners along it
  const along=f0.kind==='pocket'||f0.toe?null:shape.L;
  const near=layout.slice().sort((a,b)=>along===null?0:a.pos[along]-b.pos[along]).slice(0,2);
  const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
  const take=p=>{for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}};
  for(const f of near){take(f.pos);take(pointPlus(f.pos,f.dir,f.len));}
  for(const dim of dims){   // the size lines too, but not the far end of a long one
    take(dim.to);
    if(Math.hypot(dim.to[0]-dim.from[0],dim.to[1]-dim.from[1],dim.to[2]-dim.from[2])<9)take(dim.from);
  }
  const center=lo.map((v,k)=>(v+hi[k])/2);
  const reach=Math.max(3.2,Math.min(13,Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])/2+2.4));   // half the height of the picture, in inches
  const aspect=STEP_PICTURE.width/STEP_PICTURE.height;
  const eye=new THREE.OrthographicCamera(-reach*aspect,reach*aspect,reach,-reach,.1,4000);
  const direction=closeupEye(f0,joint,center);
  eye.position.set(center[0]+direction[0]*600,center[1]+direction[1]*600,center[2]+direction[2]*600);
  eye.up.set(0,1,0);
  eye.lookAt(center[0],center[1],center[2]);
  eye.updateMatrixWorld();

  // only the pieces of this joint, see-through enough for the fastener to show inside, solid enough for their
  // edges to be found (the owner's tester could not find the edges at 42%)
  const shown=new Set([f0.through.id,f0.into.id,...(f0.also||[]).map(p=>p.id)]),touched=[];
  for(const p of S.parts){
    const g=meshes.get(p.id);
    if(!g)continue;
    g.userData.wasVisible=g.visible;
    g.visible=shown.has(p.id);
    if(!g.visible)continue;
    const faces=g.children[0].material,lines=g.children[1].material;
    touched.push({faces,lines,color:faces.color.getHex(),opacity:lines.opacity});
    faces.color.setHex(fresh.has(p.id)?STEP_COL.added:STEP_COL.earlier);
    faces.transparent=true;faces.opacity=.64;faces.depthWrite=false;faces.needsUpdate=true;
    lines.opacity=1;
  }
  const markers=fastenerMarkers(layout,{color:STEP_COL.fastener,minRadius:CLOSEUP_MIN_RADIUS,onTop:true,real:true});
  scene.add(markers);
  const src=annotatedPicture(eye,pen=>drawCloseupLabels(pen,group,shape,center,reach));
  scene.remove(markers);
  emptyGroup(markers);
  for(const item of touched){
    item.faces.color.setHex(item.color);
    item.faces.transparent=false;item.faces.opacity=1;item.faces.depthWrite=true;item.faces.needsUpdate=true;
    item.lines.opacity=item.opacity;
  }
  for(const p of S.parts){
    const g=meshes.get(p.id);
    if(g)g.visible=g.userData.wasVisible;
  }
  return src;
}
/* ---------- the close-up of a line of hardware ---------- */
/* What a close-up of hardware shows, worked out from the model with the same numbers its line under "Hardware in
   this step" gives (the self-check stepPicturesShowTheWork holds every number here to that line):
     cup hinges   the door alone, seen from the back: the cup holes drawn as circles, the distance of the first
                  hole from the hinged edge and from the nearer end of the door
     pulls        the door or drawer front alone: the two holes, the distance of the line of holes from the edge,
                  of the first hole from the end, and between the holes
     slides, runners, kickers   the cabinet side alone, seen from inside, with the panel under the drawers: the
                  height of each one above that panel (a slide to its middle, a runner to its top edge, a kicker
                  to its underside) and how far back its front end is from the front edge of the side
   Returns {show: [piece ids], items: [hardware ids], eye: [x, y, z] direction, dims: [{from, to, text}],
   circles: [{at, normal, radius}]} or null for other kinds. */
function hardwareCloseupPlan(row){
  // the screws into the wall studs and the bolts between rack sections: js/rackwall.js
  if(row.kind==='wallscrew'||row.kind==='bolt')return rackHardwareCloseupPlan(row);
  const item=row.items[0],host=byId(item.on);
  if(!host||tilted(host))return null;
  const hostBox=plainBox(host),pose=hardwarePose(item);
  const faceAxis=[0,1,2].reduce((best,k)=>Math.abs(pose.n.getComponent(k))>Math.abs(pose.n.getComponent(best))?k:best,0);
  const faceSign=pose.n.getComponent(faceAxis)>0?1:-1,face=faceSign>0?hostBox.hi[faceAxis]:hostBox.lo[faceAxis];
  const point=(values)=>{const p=[0,0,0];for(const[k,v]of Object.entries(values))p[k]=v;return p;};
  const towardFace=(lift)=>{const eye=[0,0,0];eye[faceAxis]=faceSign;eye[1]+=lift;return eye;};
  if(row.kind==='cup'&&item.to!=null){
    // the holes are drilled in the BACK of the door: the face toward the cabinet, as the door lies face down
    const back=host.ax[2],backSign=designMiddle()[back]>(hostBox.lo[back]+hostBox.hi[back])/2?1:-1;
    const face=backSign>0?hostBox.hi[back]:hostBox.lo[back],faceAxis=back;
    const towardFace=lift=>{const eye=[0,0,0];eye[back]=backSign;eye[1]+=lift;return eye;};
    const items=row.items.filter(other=>other.on===host.id),spots=items.map(other=>hardwareSpot(other,host));
    const cross=spots[0].cross,along=spots[0].along;
    const edge=(cross.side||0)?hostBox.hi[cross.axis]:hostBox.lo[cross.axis],inward=(cross.side||0)?-1:1;
    const holes=items.map((other,index)=>{
      const m=spots[index].along,p=[0,0,0];
      p[faceAxis]=face;p[cross.axis]=edge+inward*CUP_HOLE.fromEdge;
      p[m.axis]=m.centered?(hostBox.lo[m.axis]+hostBox.hi[m.axis])/2:m.side?hostBox.hi[m.axis]-m.distance:hostBox.lo[m.axis]+m.distance;
      return p;
    });
    const first=holes[0],toEdge=first.slice(),toEnd=first.slice();
    toEdge[cross.axis]=edge;
    toEnd[along.axis]=along.side?hostBox.hi[along.axis]:hostBox.lo[along.axis];
    // a little more of the door than the size lines reach, so the hole is not drawn in a corner of the picture
    const intoDoor=first.slice();
    intoDoor[cross.axis]+=inward*3;intoDoor[along.axis]+=(along.side?-1:1)*2;
    /* How it goes on: the door and the cabinet side it hangs on, seen at a slant from inside the cabinet (from
       the back of the door, off toward the middle of the cabinet, a little from above), with the hinge on them:
       its cup in the door, its plate on the side */
    const side=item.to!=null?byId(item.to):null;
    void towardFace;
    const eye=[0,0,0];eye[back]=backSign*.75;eye[cross.axis]=inward*.5;eye[1]+=.4;
    const hinge=hardwarePose(item).at,hingeAt=[hinge.x,hinge.y,hinge.z];
    const labels=[
      {at:intoDoor,lines:[{text:pieceLabel(host,buildPlan().letterOf),size:30,bold:true},{text:'the cup hole is drilled in its back',size:23}]},
      {at:hingeAt,lines:[{text:'Cup hinge',size:27,bold:true},{text:'its cup sits in the hole',size:23}]},
    ];
    const extra=[intoDoor];
    if(side){
      // a point on the inside face of the side, beside the hinge: where its mounting plate is screwed
      const sideBox=plainBox(side),onSide=hingeAt.map((v,k)=>Math.max(sideBox.lo[k]+.2,Math.min(sideBox.hi[k]-.2,v)));
      onSide[along.axis]=Math.max(sideBox.lo[along.axis]+.2,Math.min(sideBox.hi[along.axis]-.2,hingeAt[along.axis]+(along.side?-1.5:1.5)));
      labels.push({at:onSide,lines:[{text:pieceLabel(side,buildPlan().letterOf),size:30,bold:true},{text:'the hinge plate screws to its inside face',size:23}]});
      extra.push(onSide);
    }
    return{show:[host.id].concat(side?[side.id]:[]),items:[],eye,labels,seen:`the back of the door and the ${side?side.name:'cabinet'} it hangs on`,extra,
      dims:[{from:toEdge,to:first,text:fmt(CUP_HOLE.fromEdge)}].concat(along.centered?[]:[{from:toEnd,to:first,text:fmt(r16(along.distance))}]),
      circles:holes.map(at=>({at,axis:faceAxis,radius:CUP_HOLE.wide/2}))};
  }
  if(row.kind==='pull'){
    const half=size(host).map(v=>v/2),center=hostBox.lo.map((v,k)=>v+half[k]+item.at[k]);
    const alongAxis=[0,1,2].filter(k=>k!==faceAxis).reduce((best,k)=>Math.abs(item.u[k])>Math.abs(item.u[best])?k:best);
    const crossAxis=[0,1,2].find(k=>k!==faceAxis&&k!==alongAxis);
    const low=item.at[crossAxis]+half[crossAxis],high=half[crossAxis]-item.at[crossAxis];
    const fromHigh=crossAxis===1?high<=low+.13:high<low-.13;
    const fromLowEnd=item.at[alongAxis]+half[alongAxis],fromHighEnd=half[alongAxis]-item.at[alongAxis];
    const nearHighEnd=alongAxis===1?fromHighEnd<=fromLowEnd+.13:fromHighEnd<fromLowEnd-.13;
    const holes=[-1,1].map(sign=>{const p=center.slice();p[faceAxis]=face;p[alongAxis]+=sign*item.size/2;return p;})
      .sort((a,b)=>nearHighEnd?b[alongAxis]-a[alongAxis]:a[alongAxis]-b[alongAxis]);
    const toEdge=holes[0].slice(),toEnd=holes[0].slice();
    toEdge[crossAxis]=fromHigh?hostBox.hi[crossAxis]:hostBox.lo[crossAxis];
    toEnd[alongAxis]=nearHighEnd?hostBox.hi[alongAxis]:hostBox.lo[alongAxis];
    // (the picture shows the pull on the front, so the band says just that)
    const pullAt=hardwarePose(item).at;
    // (the door is named at a point of its front a little beside the pull, which is in the picture)
    const besidePull=[pullAt.x,pullAt.y,pullAt.z];
    besidePull[faceAxis]=face;
    besidePull[crossAxis]=Math.max(hostBox.lo[crossAxis]+.5,Math.min(hostBox.hi[crossAxis]-.5,besidePull[crossAxis]+(fromHigh?-1:1)*2.5));
    const pullLabels=[
      {at:besidePull,lines:[{text:pieceLabel(host,buildPlan().letterOf),size:30,bold:true},{text:'the front face',size:23}]},
      {at:[pullAt.x,pullAt.y,pullAt.z],lines:[{text:'Pull',size:27,bold:true},{text:'over its two holes',size:23}]},
    ];
    return{show:[host.id],items:[],eye:(()=>{const eye=towardFace(.3);eye[alongAxis]+=.35;return eye;})(),labels:pullLabels,seen:`the front of the ${host.name}`,
      dims:[{from:toEdge,to:holes[0],text:fmt(r16(fromHigh?high:low))},{from:toEnd,to:holes[0],text:fmt(r16(Math.abs(toEnd[alongAxis]-holes[0][alongAxis])))},
        {from:holes[0],to:holes[1],text:fmt(item.size)}],
      circles:holes.map(at=>({at,axis:faceAxis,radius:3/32}))};
  }
  if(['slide','runner','kicker'].includes(row.kind)){
    const riding=ridingPieces(),kicker=row.kind==='kicker';
    const side=kicker?host:byId(item.to);
    if(!side)return null;
    const mine=row.items.filter(other=>(kicker?other.on:other.to)===side.id);
    const sideBox=plainBox(side),inner=side.ax[2];   // the way through the thickness of the side: toward the drawers
    // the face the strips are on: the side of the panel where the first one sits (the middle of the design is not
    // always inside the cabinet: a drawer case at one end of a desk has the knee space beside it)
    const firstStrip=hardwarePose(mine[0]).at.getComponent(inner);
    const insideSign=firstStrip>(sideBox.lo[inner]+sideBox.hi[inner])/2?1:-1;
    const insideFace=insideSign>0?sideBox.hi[inner]:sideBox.lo[inner];
    const travel=[0,2].find(k=>k!==inner);
    const dims=[],show=[side.id];
    mine.forEach((other,index)=>{
      const at=hardwarePose(other).at;
      let height,base;
      if(kicker){
        height=at.y-(other.geo&&other.geo.mid?DRAWER.runnerStrip/2:0);
        const under=panelUnder(side,height-.5,riding);
        base=under?under.top:sideBox.lo[1];
        if(under&&!show.includes(under.piece.id))show.push(under.piece.id);
      }else{
        const facts=drawerFacts(other.on);
        if(!facts)return;
        height=facts.slideHeight;
        const under=panelUnder(side,height-(row.kind==='runner'?DRAWER.runnerStrip:.5),riding);
        base=under?under.top:sideBox.lo[1];
        if(under&&!show.includes(under.piece.id))show.push(under.piece.id);
      }
      // the size line stands a little behind the front edge, one beside the other for each drawer
      const front=hardwareFrontEdge(side,travel);
      const x=front.edge-front.outward*(1.5+index*3.5);
      dims.push({from:point({[inner]:insideFace,1:base,[travel]:x}),to:point({[inner]:insideFace,1:height,[travel]:x}),text:fmt(r16(height-base))});
    });
    // what is what: the side, and the first of the strips on it
    const firstAt=hardwarePose(mine[0]).at,frontEdge=hardwareFrontEdge(side,travel);
    const onFace=point({[inner]:insideFace,1:Math.max(sideBox.lo[1]+1,Math.min(sideBox.hi[1]-1,firstAt.y+3)),[travel]:frontEdge.edge-frontEdge.outward*2});
    const stripName=row.kind==='slide'?'Drawer slide':row.kind==='runner'?'Runner':'Kicker';
    const labels=[
      {at:onFace,lines:[{text:pieceLabel(side,buildPlan().letterOf),size:30,bold:true},{text:'its inside face',size:23}]},
      {at:[firstAt.x,firstAt.y,firstAt.z],lines:[{text:stripName,size:27,bold:true},{text:row.kind==='slide'?'the cabinet half, screwed to the side':'screwed to the side',size:23}]},
    ];
    return{show,items:mine.map(other=>other.id),labels,seen:`the inside face of the cabinet ${side.name}`,eye:(()=>{const eye=[0,0,0];eye[inner]=insideSign*.8;eye[travel]=hardwareFrontEdge(side,travel).outward*.55;eye[1]=.3;return eye;})(),dims,circles:[]};
  }
  return null;
}
/* the front edge of a cabinet side along the way the drawers travel: the edge the drawers come out past */
function hardwareFrontEdge(side,travel){
  const b=plainBox(side),middle=designMiddle();
  const mover=movers().find(candidate=>candidate.kind==='slide');
  const outward=mover?(mover.axis.getComponent(travel)>0?1:-1):(b.hi[travel]>middle[travel]?1:-1);
  return{edge:outward>0?b.hi[travel]:b.lo[travel],outward};
}
function hardwareCloseupPicture(row,fresh){
  const plan=hardwareCloseupPlan(row);
  if(!plan||!plan.dims.length)return null;
  const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
  for(const p of plan.dims.flatMap(dim=>[dim.from,dim.to]).concat(plan.extra||[]))for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}
  const center=lo.map((v,k)=>(v+hi[k])/2);
  const reach=Math.max(3.5,Math.min(16,Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])/2+2.5));
  const aspect=STEP_PICTURE.width/STEP_PICTURE.height;
  const eye=new THREE.OrthographicCamera(-reach*aspect,reach*aspect,reach,-reach,.1,4000);
  const length=Math.hypot(...plan.eye);
  eye.position.set(...center.map((v,k)=>v+plan.eye[k]/length*600));
  eye.up.set(0,1,0);eye.lookAt(center[0],center[1],center[2]);eye.updateMatrixWorld();
  // only the pieces of the close-up, and the hardware of this line on them (how it goes on; where is the marking view)
  const shown=new Set(plan.show),items=new Set(row.items.filter(item=>shown.has(item.on)||shown.has(item.to)).map(item=>item.id)),kept=[];
  for(const p of S.parts){
    const g=meshes.get(p.id);
    if(!g)continue;
    kept.push([g,g.visible,g.children[0].material.color.getHex()]);
    g.visible=shown.has(p.id);
    if(g.visible)g.children[0].material.color.setHex(fresh.has(p.id)?STEP_COL.added:STEP_COL.earlier);
  }
  const hardwareKept=hardwareMeshes.map(mesh=>[mesh,mesh.visible]);
  for(const mesh of hardwareMeshes)mesh.visible=items.has(mesh.userData.hw);
  const src=annotatedPicture(eye,pen=>drawHardwareCloseup(pen,plan,row));
  for(const[g,visible,color]of kept){g.visible=visible;g.children[0].material.color.setHex(color);}
  for(const[mesh,visible]of hardwareKept)mesh.visible=visible;
  return src;
}
/* what a hardware close-up is, in the band across its top, and labels for the pieces and the hardware (the door,
   the hinge cup, the side it hangs on); its sizes are in the marking view beside it */
function drawHardwareCloseup(pen,plan,row){
  if(plan.labels&&plan.labels.length)drawCornerLabels(pen,plan.labels.map(label=>({target:pen.point(label.at),lines:label.lines})));
  const title=HARDWARE[row.kind]?HARDWARE[row.kind].name:'Hardware';
  drawPictureBand(pen.ctx,pen.width,'How it goes on',`${title.replace(/ \(.*\)$/,'')}, on ${plan.seen}`);
}

/* what the fastener does to a piece, for the small line under its name */
function roleWords(f,isThrough){
  const what=f.kind==='dowel'?'dowel':f.kind==='bracket'?'bracket':f.kind==='brad'||f.kind==='nail'?'nail':'screw';
  if(f.kind==='dowel')return'half of the dowel goes in here';
  if(f.kind==='bracket')return'the bracket is screwed to this';
  if(f.kind==='pocket')return isThrough?'the pocket holes are drilled in this':'the screw goes into this';
  return isThrough?`the ${what} goes through this`:`the ${what} goes into this`;
}
/* The 3D close-up shows HOW the fastener goes in: through which piece, into which, and at what slant. WHERE it goes,
   with every size, is the marking view beside it (js/markingview.js), drawn square to the face so no size is
   foreshortened: the slanted view carries no sizes. A band across the top says which picture this is. */
const CLOSEUP_BAND=46;
function drawPictureBand(ctx,width,title,line){
  ctx.fillStyle=STEP_COL.paper;ctx.fillRect(0,0,width,CLOSEUP_BAND);
  ctx.strokeStyle='#b8bec5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(10,CLOSEUP_BAND-.5);ctx.lineTo(width-10,CLOSEUP_BAND-.5);ctx.stroke();
  ctx.fillStyle=STEP_COL.ink;ctx.textBaseline='middle';ctx.textAlign='left';
  ctx.font=`600 26px ${PICTURE_FONT}`;ctx.fillText(title,14,CLOSEUP_BAND/2+1);
  if(line){
    const titleWide=ctx.measureText(title).width;
    let size=21;
    ctx.font=`400 ${size}px ${PICTURE_FONT}`;
    while(size>14&&14+titleWide+14+ctx.measureText(line).width>width-14){size--;ctx.font=`400 ${size}px ${PICTURE_FONT}`;}
    ctx.fillText(line,14+titleWide+14,CLOSEUP_BAND/2+2);
  }
}
/* Labels in the corners of a close-up (under its band), each with a line and a dot to what it names: the
   corners are given out so that the lines are shortest in all. labels: [{target: [x, y] in picture pixels, lines:
   [{text, size, bold}]}] (four at most). */
function drawCornerLabels(pen,labels){
  const{ctx,width,height}=pen;
  for(const label of labels)label.size=textBox(ctx,label.lines,[0,0],true);
  const corner=(index,size)=>({x:index%2?width-size.w-10:10,y:index>1?height-size.h-10:CLOSEUP_BAND+8,w:size.w,h:size.h});
  let best=null;
  const tryCorners=(picks,cost)=>{
    if(picks.length===labels.length){
      if(!best||cost<best.cost)best={cost,picks:picks.slice()};
      return;
    }
    const label=labels[picks.length];
    for(let slot=0;slot<4;slot++){
      if(picks.includes(slot))continue;
      const from=nearestOnRect(corner(slot,label.size),label.target);
      tryCorners(picks.concat(slot),cost+Math.hypot(from[0]-label.target[0],from[1]-label.target[1]));
    }
  };
  tryCorners([],0);
  labels.forEach((label,index)=>{label.rect=corner(best.picks[index],label.size);});
  for(const label of labels){
    inkLine(ctx,nearestOnRect(label.rect,label.target),label.target,2);
    inkDot(ctx,label.target,5);
  }
  for(const label of labels)textBox(ctx,label.lines,[label.rect.x,label.rect.y]);
}
let closeupLabelsDrawn=[];   // the words of the labels of the close-up drawn last, for the self-check
function drawCloseupLabels(pen,group,shape,center,reach){
  const{ctx,point,width,height}=pen,{layout,link}=group.sample,f0=layout[0];
  const letterOf=buildPlan().letterOf,taken=[];   // taken: the rectangles that already hold text
  void link;
  const overlaps=rect=>taken.some(other=>rect.x<other.x+other.w+4&&rect.x+rect.w+4>other.x&&rect.y<other.y+other.h+4&&rect.y+rect.h+4>other.y);
  /* three labels in the corners of the picture, each with a line to what it names. They take the corners that
     keep the lines shortest. */
  const way=shape.signInto(f0.into),k=shape.k;
  const inside=(piece,depth)=>{   // a point inside that piece, near the fasteners
    const p=center.slice(),b=plainBox(piece);
    p[k]=shape.plane+(piece===f0.into?way:-way)*Math.min(depth,shape.depthOf(piece)/2);
    for(let axis=0;axis<3;axis++)p[axis]=Math.max(b.lo[axis]+.1,Math.min(b.hi[axis]-.1,p[axis]));
    return p;
  };
  const middleOf=f=>pointPlus(f.pos,f.dir,f.len*.5);
  const labels=[
    {target:point(inside(f0.through,reach*.45)),lines:[{text:pieceLabel(f0.through,letterOf),size:30,bold:true},{text:roleWords(f0,true),size:23}]},
    {target:point(inside(f0.into,reach*.45)),lines:[{text:pieceLabel(f0.into,letterOf),size:30,bold:true},{text:roleWords(f0,false),size:23}]},
    {target:point(middleOf(layout[layout.length>1?1:0])),lines:[{text:group.label,size:27,bold:true}].concat(shape.k===1&&f0.dir[1]>.7?[{text:'driven up from underneath (seen from below)',size:23}]:[])},
  ];
  // a pocket hole: where the drill goes in, on the face the holes are in (the fourth corner of the picture)
  if(f0.kind==='pocket'){
    const mouth=layout[0].pocket.mouth,underneath=f0.pocket.out[1]<-.5;
    labels.push({target:point(mouth),lines:[{text:'Drill the pocket holes here',size:27,bold:true},{text:underneath?'on the underside (seen from below)':'on this face: the inside face',size:23}]});
  }
  // a plugged head: the plug over it, in the counterbore (the fourth corner; a pocket hole is never plugged this way)
  if(f0.plug&&f0.kind!=='pocket'){
    const cover=plugCoverWords(f0);
    labels.push({target:point(pointPlus(f0.plug.at,f0.dir,f0.sunk/2)),lines:[{text:cover.name,size:27,bold:true}].concat(cover.does.map(text=>({text,size:23})))});
  }
  closeupLabelsDrawn=labels.map(label=>label.lines.map(one=>one.text).join(' '));
  drawCornerLabels(pen,labels);
  void overlaps;void taken;void width;void height;
  const a=pieceLabel(f0.through,letterOf),b=pieceLabel(f0.into,letterOf);
  drawPictureBand(ctx,width,'How it goes in',f0.kind==='dowel'?`half in ${a}, half in ${b}`:f0.kind==='bracket'?`in the corner of ${a} and ${b}`
    :`${f0.kind==='pocket'?'from the pocket holes in':'through'} ${a} into ${b}`);
}

/* ---------- every step ---------- */
/* What the picture of one step shows, worked out before anything is drawn:
     visible(id)   is this piece in the picture? Later pieces are left out, and so is a part that is built apart
                   and not set in place yet. A step that builds a part by itself shows that part only.
     fresh         the ids drawn orange: the pieces the step adds, the part it sets in place, or, for a step that
                   only mounts hardware, the pieces the hardware goes on
     mounted       the ids of the hardware this step mounts
     opened        the doors and drawers whose hinges or slides this step mounts: they are drawn open, so the
                   hardware can be seen
     behind        true when the step nails a thin panel onto the back: the picture is then taken from behind
     notes         sentences for under the picture, so that it never contradicts the words without saying so */
const WORKED_LYING_DOWN=/\b(lay|lie|lies|lying|face down|on its (front|back|side)|on their (front|back) edges|flat on)\b/i;
const plainBoxOrBox=p=>tilted(p)?box(p):plainBox(p);
function boxesTouch(a,b){
  const one=plainBoxOrBox(a),two=plainBoxOrBox(b);
  return[0,1,2].every(k=>one.lo[k]<=two.hi[k]+.03&&two.lo[k]<=one.hi[k]+.03);
}
function stepScene(plan,index){
  const step=plan.steps[index],away=piecesNotYetThere(plan,index),apart=partBuiltApart(plan,index);
  const visible=id=>apart?apart.ids.has(id):!away.has(id);
  const hosts=step.hardware.flatMap(row=>row.items.map(item=>item.on));
  const added=step.pieces.concat(step.brought);
  const fresh=new Set(added.length?added.map(p=>p.id):hosts);
  const mounted=new Set(step.hardware.flatMap(row=>row.items.map(item=>item.id)));
  const opened=movers().filter(mover=>!mover.stuck&&mover.items.some(item=>mounted.has(item.id)));
  const wood=step.pieces.filter(p=>!isProp(p)),middle=designMiddle();
  const behind=!apart&&wood.length>0&&wood.every(p=>M[p.mat].kind==='sheet'&&p.t<=.3&&p.ax[2]===2&&p.pos[2]+p.t/2<middle[2]);
  const notes=[];
  if(apart&&apart.alike>1)notes.push(`This step builds ${apart.alike} parts that are alike. The picture shows one of them by itself.`);
  else if(apart)notes.push('The picture shows this part by itself, standing the way it ends up in the finished design.');
  // pieces that hang in the air, or that the words handle lying down, are drawn where they end up: say so
  const builtBefore=S.parts.filter(p=>visible(p.id)&&!fresh.has(p.id)&&!isProp(p));
  const touches=p=>plainBoxOrBox(p).lo[1]<.3||builtBefore.some(other=>boxesTouch(p,other));
  // (also when nothing in the picture stands on the floor: shelf frames drawn at their heights, before any post holds them)
  const grounded=S.parts.some(p=>visible(p.id)&&!isProp(p)&&plainBoxOrBox(p).lo[1]<.3);
  const floats=wood.length>0&&!apart&&(!wood.some(touches)||!grounded);
  if(floats||WORKED_LYING_DOWN.test(step.words))notes.push('The picture shows the pieces where they end up in the finished design, not how they lie while you work on them.');
  if(behind)notes.push('Seen from behind.');
  if(opened.length)notes.push(`Drawn ${opened.some(mover=>mover.kind==='swing')?'with the doors open':'with the drawers pulled out'}, so that the hardware shows.`);
  if(step.hardware.length)notes.push('The hardware of this step is dark blue. Its numbers in circles match the lines under "Hardware in this step".');
  return{step,visible,fresh,mounted,opened,behind,notes,apart};
}
/* how far the doors and drawers of a hardware step are drawn open: enough to see the hinges and the slides */
const PICTURE_OPEN={swing:.7,slide:.75};
/* the eye of a step picture: the usual corner, near enough that what is shown fills the picture */
function aimAtShown(visible,behind,below){
  const bounds=new THREE.Box3(),one=new THREE.Box3();
  for(const p of S.parts){
    const g=meshes.get(p.id);
    if(!g||!visible(p.id))continue;
    g.updateMatrixWorld(true);
    bounds.union(one.setFromObject(g.children[0]));
  }
  if(bounds.isEmpty())return;
  bounds.getCenter(cam.target);
  cam.r=Math.max(16,bounds.getSize(new THREE.Vector3()).length()*1.7)*.85;
  cam.th=behind?-1.05:1.05;cam.ph=below?Math.PI-1.15:1.15;
  updateCam();
}
/* where the balloon of a "Fasten with" line points: the middle of the fasteners of one of its joints that is in
   the picture, or, for a line that is glue alone, the middle of the place where the two pieces touch */
function balloonSpot(group,visible){
  const link=group.links.find(candidate=>visible(candidate.a.id)&&visible(candidate.b.id));
  if(!link)return null;
  const layout=fastenersOfLink(link),middle=[0,0,0];
  if(layout.length){
    for(const f of layout)for(let k=0;k<3;k++)middle[k]+=f.pos[k]/layout.length;
    return middle;
  }
  const joint=link.joint;
  middle[joint.k]=joint.plane;
  middle[joint.u]=(joint.ru[0]+joint.ru[1])/2;
  middle[joint.v]=(joint.rv[0]+joint.rv[1])/2;
  return middle;
}
/* where a piece of hardware is in the picture just now (its piece may be drawn open) */
function hardwareSpotNow(item){
  const g=meshes.get(item.on);
  if(!g)return null;
  g.updateMatrixWorld(true);
  const at=new THREE.Vector3(item.at[0],item.at[1],item.at[2]).applyMatrix4(g.matrixWorld);
  return[at.x,at.y,at.z];
}
function stepPictures(plan){
  const out=[];
  // step pictures are taken at one size whatever the screen is, so that a sharp screen does not make them slow
  const ratioKept=renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(STEP_PICTURE.width,STEP_PICTURE.height,false);
  const camKept={target:cam.target.clone(),r:cam.r,th:cam.th,ph:cam.ph};
  // the step that mounts each piece of placed hardware: it is not drawn before that step
  const mountedAt=new Map();
  plan.steps.forEach((step,index)=>step.hardware.forEach(row=>row.items.forEach(item=>mountedAt.set(item.id,index))));
  const blue=new THREE.MeshBasicMaterial({color:STEP_COL.fastener,depthTest:false,depthWrite:false,transparent:true});
  plan.steps.forEach((step,index)=>{
    const entry={src:'',closeups:[],drawn:0,total:0,notes:[]};
    out.push(entry);
    const view=stepScene(plan,index);
    if(!view.fresh.size&&!step.groups.length)return;
    entry.notes=view.notes;
    // this step's pieces orange, earlier ones pale, the rest left out
    for(const p of S.parts){
      const g=meshes.get(p.id);
      if(!g)continue;
      g.visible=view.visible(p.id);
      if(g.visible)g.children[0].material.color.setHex(isProp(p)?M[p.mat].color:view.fresh.has(p.id)?STEP_COL.added:STEP_COL.earlier);
    }
    // hardware: only what is mounted by now, and this step's own in dark blue over the wood
    const repainted=[];
    for(const mesh of hardwareMeshes){
      const at=mountedAt.get(mesh.userData.hw);
      mesh.visible=at===undefined||at<=index;
      if(view.mounted.has(mesh.userData.hw)){
        repainted.push([mesh,mesh.material,mesh.renderOrder]);
        mesh.material=blue;mesh.renderOrder=6;
      }
    }
    // the doors and drawers this step hangs are drawn open
    const leadsOpened=view.opened.map(mover=>[mover.lead,mover.lead.open]);
    if(view.opened.length){
      showClosed=false;
      for(const mover of view.opened)mover.lead.open=PICTURE_OPEN[mover.kind];
      for(const p of S.parts)setMeshPos(p);
    }
    if(view.apart)grid.visible=floor.visible=false;   // a part drawn by itself does not stand on the floor of the design
    const fasteners=stepFasteners(step).filter(f=>view.visible(f.through.id)&&view.visible(f.into.id));
    // a step whose screws are all driven up into the underside of a top (a top held on from underneath) is seen
    // from below, where the work is done; seen from above its screws would seem to be on the top
    const fromBelow=fasteners.length>0&&fasteners.every(f=>f.dir[1]>.5);
    if(fromBelow)entry.notes=entry.notes.concat('Seen from below: these screws are driven up into the underside, and nothing shows on top.');
    if(fromBelow)grid.visible=floor.visible=false;   // the floor would hide what is seen from under it
    aimAtShown(view.visible,view.behind,fromBelow);
    const reach=cam.r*.0036;   // how thick a fastener is drawn in the step picture: about 3 pixels across
    entry.total=fasteners.length;
    entry.drawn=Math.min(fasteners.length,MARKERS_MAX);
    const markers=fastenerMarkers(fasteners.slice(0,MARKERS_MAX),{color:STEP_COL.fastener,minRadius:reach,onTop:true});
    scene.add(markers);
    const balloons=[];
    for(const group of step.groups){
      const spot=balloonSpot(group,view.visible);
      if(spot)balloons.push({no:group.no,spot});
    }
    for(const row of step.hardware){
      const spot=hardwareSpotNow(row.items[0]);
      if(spot&&view.visible(row.items[0].on))balloons.push({no:row.no,spot});
    }
    const lettered=S.parts.filter(p=>view.fresh.has(p.id)&&view.visible(p.id)&&!isProp(p));
    const marks=markingLines(step,view.fresh).filter(line=>view.visible(line.piece.id));
    if(marks.length){
      entry.notes.push('The dark lines are the pencil marks this step asks for: each shows where the underside of a piece will sit. Their heights are in "The pencil marks" under the picture.');
      const markPlan=marksMarkPlan(marks,plan.letterOf,step.words);
      if(markPlan)entry.markView={src:markingPictureLater(markPlan),caption:`The pencil marks of step ${step.no}, with their heights measured up from the bottom end.`};
    }
    entry.marks=marks.length;
    entry.src=annotatedPicture(camera,pen=>{
      const written=drawMarks(pen,marks);
      const tags=drawPieceLetters(pen,lettered,plan.letterOf,written);
      drawBalloons(pen,balloons,written.concat(tags));
    });
    grid.visible=floor.visible=true;
    scene.remove(markers);
    emptyGroup(markers);
    for(const[mesh,material,order]of repainted){mesh.material=material;mesh.renderOrder=order;}
    if(view.opened.length){
      for(const[lead,was]of leadsOpened){if(was===undefined)delete lead.open;else lead.open=was;}
      showClosed=true;
      for(const p of S.parts)setMeshPos(p);
    }
    // one close-up for each line; when a step has more lines than CLOSEUPS_MAX, the ones with the most joints
    const withSample=step.groups.filter(group=>group.sample&&group.sample.layout.length);
    const chosen=withSample.slice().sort((a,b)=>b.places-a.places).slice(0,CLOSEUPS_MAX).sort((a,b)=>a.no-b.no);
    grid.visible=floor.visible=false;
    // each close-up is a pair: how it goes in (src, the 3D view) and where (mark, the marking view)
    for(const group of chosen){
      const others=group.places-1;
      // (words: where the line says the fasteners go, shown under the picture when it is opened large)
      // (mark: the marking view, a key drawn when it is seen; markingSource(mark) draws it)
      // (a line whose holes are drilled in step 2 has no "Where to mark": its caption names the drawing, js/drillplan.js)
      const drilled=group.predrilled?` Where to mark: drilled already, drawing ${listWords(group.predrilled.labels)}.`:'';
      // (a line whose places are marked differently names the one shown: group.sampleAt, js/buildsteps.js; when the
      //  holes are drilled already there is nothing to mark at the other places, only the pieces to put in)
      const otherPlaces=others>1?`At the other ${others} places`:'At the other place';
      const shownPlace=group.sampleAt?`, ${group.sampleOneOf?'one of the places at':'at'} ${group.sampleAt}. ${otherPlaces}, ${group.predrilled?'fasten':'mark'} as the line says.`:'';
      entry.closeups.push({no:group.no,src:closeupPicture(step,group,view.fresh),mark:group.predrilled?null:markingPictureLater(jointMarkPlan(group,plan.letterOf)),
        caption:`Close-up of line ${group.no}`+(shownPlace
          ||(others>1?`. Do the same at the other ${others} places.`:others===1?'. Do the same at the other place.':'.'))+drilled,
        words:group.where||''});
    }
    // and one for each line of hardware that has numbers to show (hinges, pulls, slides, runners, kickers)
    for(const row of step.hardware){
      if(entry.closeups.length>=CLOSEUPS_MAX)break;
      const src=hardwareCloseupPicture(row,view.fresh);
      if(src)entry.closeups.push({no:row.no,src,mark:markingPictureLater(hardwareMarkPlan(row,plan.letterOf)),caption:`Close-up of line ${row.no}: the numbers of that line, measured on the piece.`,words:row.line||''});
    }
    const left=withSample.filter(group=>!chosen.includes(group)).map(group=>group.no);
    if(left.length)entry.notes.push(`No close-up for line${left.length>1?'s':''} ${listWords(left.map(String))}: ${left.length>1?'they are':'it is'} driven like the lines above.`);
    grid.visible=floor.visible=true;
  });
  blue.dispose();
  for(const mesh of hardwareMeshes)mesh.visible=true;
  cam.target.copy(camKept.target);cam.r=camKept.r;cam.th=camKept.th;cam.ph=camKept.ph;
  updateCam();
  renderer.setPixelRatio(ratioKept);
  return out;
}

/* ---------- self-check (selfTest runs every function in SELFTESTS, see js/core.js) ----------
   What the pictures show, for the cases a first-time builder was misled by:
     - the drawer boxes of the Nightstand are built in a picture of ONE box by itself, not inside the finished cabinet;
     - the step that mounts the slides draws the drawers pulled out and numbers its hardware line;
     - hardware is in no picture before the step that mounts it (the list stepPictures hides by);
     - a part that is set in place later (the top frame of the aquarium stand) is in no picture in between;
     - the close-up of a pocket-hole joint is seen from the side the holes are on;
     - a glue line has a place for its balloon, so no picture starts its numbers at 2. */
SELFTESTS.push(function stepPicturesShowTheWork(problems){
  const wrong=text=>{if(problems.length<60)problems.push('step pictures: '+text);};
  const place=(name,values)=>{
    const preset=PRESETS.find(candidate=>candidate.name===name),vals={...presetDefaults(preset),...(values||{})};
    placePreset(preset,vals,preset.build(vals),false);
    return buildPlan(true);
  };
  for(const runsOn of['slide','runner']){
    const plan=place('Nightstand with drawers',{slides:runsOn});
    const boxes=plan.steps.findIndex(step=>step.pieces.some(p=>p.name==='Drawer side'));
    const view=stepScene(plan,boxes);
    if(!view.apart||view.apart.alike!==2)wrong(`Nightstand (${runsOn}): the step that builds the drawer boxes does not show one box by itself`);
    else if(S.parts.some(p=>p.name==='Side'&&view.visible(p.id)))wrong(`Nightstand (${runsOn}): the picture of the drawer box step still shows the cabinet`);
    const mount=plan.steps.findIndex(step=>step.hardware.some(row=>row.kind===runsOn));
    const mounting=stepScene(plan,mount);
    if(!mounting.opened.length)wrong(`Nightstand (${runsOn}): the step that mounts the ${runsOn}s does not draw the drawers pulled out`);
    if(plan.steps[mount].hardware.some(row=>!row.no))wrong(`Nightstand (${runsOn}): a hardware line has no number for its balloon`);
    // every piece of hardware belongs to one step, and no step before it counts it as mounted
    for(let index=0;index<mount;index++){
      if(stepScene(plan,index).mounted.size&&plan.steps[index].hardware.some(row=>row.kind===runsOn))wrong(`Nightstand (${runsOn}): step ${index+1} already shows the ${runsOn}s`);
    }
    for(const step of plan.steps){
      for(const group of step.groups)if(!balloonSpot(group,()=>true))wrong(`Nightstand (${runsOn}): line ${group.no} of step ${step.no} has no place for its balloon`);
    }
  }
  const stand=place('Single aquarium stand');
  const posts=stand.steps.findIndex(step=>step.pieces.some(p=>p.name==='Post'));
  const topDeck=S.parts.filter(p=>/^(Shelf deck|Top deck|Countertop)$/.test(p.name)).sort((a,b)=>b.pos[1]-a.pos[1])[0];   // (the countertop of a closed stand: js/fishtop.js)
  if(stepScene(stand,posts).visible(topDeck.id))wrong('aquarium stand: the picture of the post step shows the top frame, which is set on a step later');
  if(!stepScene(stand,posts+1).fresh.has(topDeck.id))wrong('aquarium stand: the step that lowers the top frame does not draw it as new');
  // a line of hinges, pulls, slides, runners or kickers has a close-up whose every number is in its line
  for(const[name,values]of[['Base cabinet with doors'],['Single aquarium stand'],['Nightstand with drawers'],['Nightstand with drawers',{slides:'runner'}],
    ['Fish tank wall / rack',{orient:'long'}],['Fish tank wall / rack',{W:240,build:'sections'}]]){
    const plan=place(name,values);
    for(const row of plan.steps.flatMap(step=>step.hardware)){
      if(!['cup','pull','slide','runner','kicker','wallscrew','bolt'].includes(row.kind))continue;
      const close=hardwareCloseupPlan(row);
      if(!close||!close.dims.length){wrong(`${name}: the ${row.kind} line has no close-up with its numbers`);continue;}
      const missing=close.dims.find(dim=>!row.line.includes(dim.text));
      if(missing)wrong(`${name}: the close-up of the ${row.kind} line shows ${missing.text}, which its line does not say: ${row.line.slice(0,160)}`);
    }
  }
  // shelf frames drawn at their heights before any post holds them up: the picture says so
  const garage=place('Garage shelves');
  const decks=garage.steps.findIndex(step=>step.pieces.some(p=>p.name==='Shelf deck'));
  if(!stepScene(garage,decks).notes.some(note=>/where they end up/.test(note)))wrong('Garage shelves: the deck step draws the frames in the air and does not say so');
  // a step that says "mark" draws every mark it gives a height for, on each piece it marks
  for(const[name,heights,pieces]of[['Bookshelf',4,2],['Base cabinet with doors',2,2],['Garage shelves',4,2]]){
    const plan=place(name);
    const index=plan.steps.findIndex(step=>/\bmark\b/i.test(step.words)&&step.pieces.length);
    const lines=index<0?[]:markingLines(plan.steps[index],stepScene(plan,index).fresh);
    if(lines.length!==heights*pieces)wrong(`${name}: the marking step draws ${lines.length} pencil marks, it gives ${heights} heights on ${pieces} pieces`);
  }
  const bench=place('Workbench');
  const pocket=bench.steps.flatMap(step=>step.groups).find(group=>group.sample&&group.sample.layout[0].kind==='pocket');
  if(!pocket)wrong('the Workbench has no pocket-hole line to check the close-up of');
  else{
    const f=pocket.sample.layout[0],eye=closeupEye(f,pocket.sample.link.joint,f.pos);
    if(eye[0]*f.pocket.out[0]+eye[1]*f.pocket.out[1]+eye[2]*f.pocket.out[2]<=.3)wrong('the close-up of a pocket-hole joint is not seen from the face the holes are drilled in');
  }
  // A plugged screw: the close-up draws the plug over each head (a third stick per screw: body, head, plug) and
  // labels it, and the marking view's legend names the 3/8" counterbore (the bed's side rails into its legs)
  const bed=place('Platform bed');
  const plugged=bed.steps.flatMap(step=>step.groups.map(group=>({step,group}))).find(one=>one.group.sample&&one.group.sample.layout.some(f=>f.plug));
  if(!plugged)wrong('the Platform bed has no line of plugged screws to check the pictures of');
  else{
    const{step,group}=plugged,layout=group.sample.layout;
    const markers=fastenerMarkers(layout,{color:STEP_COL.fastener,minRadius:CLOSEUP_MIN_RADIUS,onTop:true,real:true});
    const sticks=markers.children.reduce((sum,mesh)=>sum+(mesh.count||0),0);
    if(sticks!==layout.length*3)wrong(`the close-up of the plugged screws draws ${sticks} shapes for ${layout.length} screws: each needs its body, its head and the plug over it`);
    emptyGroup(markers);
    closeupLabelsDrawn=[];
    closeupPicture(step,group,new Set(step.pieces.map(p=>p.id)));
    if(!closeupLabelsDrawn.some(text=>/^Wooden plug .*3\/8" counterbore/.test(text)))wrong(`the close-up of the plugged screws does not label the plug and its counterbore: ${closeupLabelsDrawn.join(' / ')}`);
    const plan=jointMarkPlan(group,bed.letterOf);
    if(!plan||!plan.legend.some(entry=>/3\/8" counterbore 3\/8" deep there for the wooden plug/.test(entry.text)))wrong(`the marking view of the plugged screws does not name the 3/8" counterbore in its legend: ${plan?plan.legend.map(entry=>entry.text).join(' / '):'no view'}`);
  }
});
