/* NominalCAD: the helpers that do the usual hardware job in one go.

     hangDoor(door, opts)          hang a door or a lid: hinges on the edge next to its frame, a pull on the far
                                   side, and a catch, latch or lid stay. Returns {ok, message, items}.
                                     opts.side   'left' | 'right' | 'top' | 'bottom' (as you look at the door from
                                                 outside; for a lid top is its back edge). Left out: found by itself.
                                     opts.kind   'butt' | 'strap' | 'cup' | 'piano'. Left out: chosen to suit.
                                     opts.pull, opts.catch   false to leave them off
     hangPlan(door, opts)          the same without changing anything: what would be mounted, and where
     mountSlides(pieceIds, opts)   put a drawer on a pair of slides. pieceIds: any pieces of the drawer box.
                                   Returns {ok, message, items}.
                                     opts.kind   'slide' (ball-bearing, needs a 1/2" gap each side) or 'runner'
                                     opts.dir    [x, y, z] the way the drawer opens. Left out: toward the open
                                                 front of the cabinet.
                                     opts.exact  true: the drawer is exactly pieceIds (what a builder passes). Otherwise,
                                                 from one piece: its subcomponent (a Drawer inside a Cabinet), or else
                                                 everything fastened to it.
                                   Both helpers also store "Not joined" between the door or drawer and its frame:
                                   what hangs on hinges or runs on slides is not screwed shut as well.
     addOnFace(kind, piece, axis, sign, opts)   one piece of hardware on a face of a piece: the face that looks
                                   along world direction axis (0 left-right, 1 up, 2 back-front), sign +1 or -1.
                                     opts.size, opts.along (world direction its length runs in),
                                     opts.offset [a, b] from the middle of the face along the two other directions
                                     opts.to     the id of the piece it carries (a shelf pin's shelf)
     addPull(piece, opts)         a pull in the middle of the outer face of a drawer front or door
     hangPresetDoors(ids)          what makePreset calls: hangs every piece named Door or Lid among the new pieces
   All of them only add to S.hardware; call commit() afterwards (the commands openHang here and mountDrawerOfSel in js/drawertool.js do).

   THE RULES OF THUMB
     - Two hinges, 3" to 4" from each end; a third in the middle when the door is over 40" tall. A shed door gets
       three heavy T-hinges from 60" up.
     - Cabinet doors of plywood that lie on the front of their cabinet get concealed cup hinges (110 degrees). A door
       that sits in its opening, flush with the wall, gets T-hinges or butt hinges on the face. A lid gets butt
       hinges on the back edge, and a lid stay so that it cannot slam.
     - The pull goes on the side away from the hinges, 2" to 2 1/2" in from the edge: near the top of a low door,
       near the bottom of a high one, about 36" up on a tall one.
     - A side-mount drawer slide fills a 1/2" gap between the drawer side and the cabinet side, and is as long as
       the drawer side allows (10" to 22" in 2" steps). */
'use strict';

// (a "Door stile" is the frame piece two doors meet on, not a door: SUB_BY_NAME in js/components.js says the same)
const DOOR_NAMES=/^(shed )?door\b(?! stile\b)|^lid\b/i;
const SLIDE_GAP=.5;                // what a side-mount ball-bearing slide needs on each side of the drawer
const SLIDE_GAP_RANGE=[.4,.6];     // gaps that still count as that
const RUNNER_GAP_RANGE=[0,.3];     // a drawer on wooden runners sits close to the cabinet side
const unit=(k,sign)=>{const v=[0,0,0];v[k]=sign;return v;};
const crossOf=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const middleOf=b=>b.lo.map((v,k)=>(v+b.hi[k])/2);
const overlapRange=(a,b,k)=>[Math.max(a.lo[k],b.lo[k]),Math.min(a.hi[k],b.hi[k])];

/* ---------- what belongs to a door or a drawer, and what it must be free of ---------- */
/* The pieces that are part of the same door or drawer as this piece: the other pieces of its component, when that
   is a subcomponent (a Door inside a Cabinet). The component of a whole design does not count. */
function ownParts(piece){
  const comp=compChain(piece.id)[0];
  return new Set(comp&&comp.parent!=null?compPieceIds(comp.id):[piece.id]);
}
/* Something that hangs on hinges or runs on slides is not screwed to its frame as well. Stores "Not joined" for
   every joint between these pieces and the rest of the design; returns the names of the pieces they were fastened to. */
function freeFromFrame(pieceIds){
  const own=new Set(pieceIds),mine=S.parts.filter(p=>own.has(p.id)&&!isProp(p)),freed=new Set();
  if(!mine.length)return[];
  const reach=bbox(mine);
  for(const other of S.parts){
    if(own.has(other.id)||isProp(other))continue;
    const ob=box(other);
    if(![0,1,2].every(k=>ob.lo[k]<=reach.hi[k]+.1&&ob.hi[k]>=reach.lo[k]-.1))continue;
    for(const piece of mine){
      const joint=jointBetween(piece,other);
      if(joint&&jType(joint)!=='none'){
        S.joints[joint.key]='none';
        freed.add(other.name);
      }else if(!joint&&(tilted(piece)||tilted(other))){ // pieces set at an angle hold on to what they touch unless told otherwise
        const key=S.parts.indexOf(piece)<S.parts.indexOf(other)?piece.id+'-'+other.id:other.id+'-'+piece.id;
        if(connGraph().byKey.has(key)&&S.joints[key]!=='none'){S.joints[key]='none';freed.add(other.name);}
      }
    }
  }
  return[...freed];
}

/* ---------- hanging a door or a lid ---------- */
/* the wooden pieces around a door that it could be hinged to */
function doorNeighbors(door,b){
  const out=[],swinging=new Set(hardwareList().filter(item=>HARDWARE[item.kind].motion==='swing').map(item=>item.on)),own=ownParts(door);
  for(const p of S.parts){
    if(p===door||isProp(p)||tilted(p)||own.has(p.id))continue;
    if(DOOR_NAMES.test(p.name)||swinging.has(p.id))continue; // another door: nothing is hinged to something that swings itself
    const stored=S.joints[door.id+'-'+p.id]||S.joints[p.id+'-'+door.id];
    if(stored&&stored!=='none')continue; // fastened to the door by hand: part of the door, not of its frame
    const pb=plainBox(p);
    if([0,1,2].every(k=>pb.lo[k]<b.hi[k]+.75&&pb.hi[k]>b.lo[k]-.75))out.push({p,lo:pb.lo,hi:pb.hi});
  }
  return out;
}
/* which way a door or lid of this thickness direction can be hinged: [side name, pin direction A, across B, sign of the hinge edge along B] */
function hingeEdges(T,outSign){
  if(T===1)return[['top',0,2,-1],['bottom',0,2,1],['left',2,0,-1],['right',2,0,1]]; // a lid: its back edge first
  const B=T===2?0:2;
  // "left" as someone sees it who stands in front of the door: their right hand is forward x up
  const forward=unit(T,-outSign),right=crossOf(forward,[0,1,0]),leftSign=right[B]>0?-1:1;
  return[['left',1,B,leftSign],['right',1,B,-leftSign],['top',B,1,1],['bottom',B,1,-1]];
}
/* what there is to hinge to along one edge of the door */
function edgeSupports(b,near,T,outSign,A,B,edgeSign){
  const edge=edgeSign>0?b.hi[B]:b.lo[B],inner=outSign>0?b.lo[T]:b.hi[T],outer=outSign>0?b.hi[T]:b.lo[T];
  const found={edge,inner,outer,backers:[],flankers:[],flush:[]};
  for(const n of near){
    const rA=overlapRange(n,b,A);
    if(rA[1]-rA[0]<.1)continue;
    const rB=overlapRange(n,b,B);
    const behind=Math.abs((outSign>0?n.hi[T]:n.lo[T])-inner)<.05&&rB[1]-rB[0]>=.1; // its face lies against the back of the door
    if(behind){
      const toEdge=edgeSign>0?edge-rB[1]:rB[0]-edge;
      if(toEdge<=2.5)found.backers.push({n,rA,rB});
      const side=((edgeSign>0?n.hi[B]:n.lo[B])-edge)*edgeSign; // how far its outer side is past the edge of the door
      if(Math.abs(side)<=.26)found.flush.push({n,rA,side});
    }
    const gap=edgeSign>0?n.lo[B]-edge:edge-n.hi[B]; // beyond the edge, with its face level with the face of the door
    if(gap>=-.05&&gap<=.5&&rA[1]-rA[0]>=.5&&Math.abs((outSign>0?n.hi[T]:n.lo[T])-outer)<=.07)found.flankers.push({n,rA,gap:Math.max(0,gap)});
  }
  const lengthA=b.hi[A]-b.lo[A],covered=list=>list.reduce((sum,s)=>sum+s.rA[1]-s.rA[0],0);
  // a post or a side that runs along the edge counts fully; a rail that only crosses the edge counts a little
  found.score=covered(found.flankers)+found.backers.reduce((sum,s)=>sum+(s.rA[1]-s.rA[0])*(s.rA[1]-s.rA[0]>=lengthA*.4?1:.1),0);
  return found;
}
/* another door right beside this one, on the low or the high side along B */
function doorBeside(door,b,T,B,sign){
  return S.parts.find(p=>{
    if(p===door||!DOOR_NAMES.test(p.name)||p.ax[2]!==T||tilted(p))return false;
    const pb=plainBox(p),gap=sign>0?pb.lo[B]-b.hi[B]:b.lo[B]-pb.hi[B];
    return gap>=-.05&&gap<=.5&&Math.abs(pb.lo[T]-b.lo[T])<.1&&overlapRange(pb,b,1)[1]-overlapRange(pb,b,1)[0]>1;
  });
}
/* the side (-1 low, +1 high along B) an already hung door has its hinges on, or 0 */
function hungSide(door,B){
  const hinge=hardwareOn(door.id).find(item=>HARDWARE[item.kind].motion==='swing');
  return hinge?Math.sign(hinge.at[B]):0;
}
/* How far from each end of a door or lid its end hinges sit: 3" to 4" in half inches, a quarter of the length on
   a short one. The steps of a preset that state this distance read it here (the Base cabinet does). */
function hingeInset(length){
  return length<12?r16(length/4):Math.min(4,Math.max(3,Math.round(length*.1*2)/2));
}
/* The sentence about the cup hole, for the steps of every preset whose doors get concealed cup hinges (the same
   numbers as HARDWARE.cup.mount, js/hardware.js). It ends with a space. */
const CUP_HINGE_HOLE='The round cup of each hinge sits in a hole 1 3/8" wide and 1/2" deep in the back of the door, drilled with a Forstner bit: the sheet in the package gives how far from the edge, usually 7/8" to the middle of the hole. ';
function hangPlan(door,opts){
  opts=opts||{};
  const fail=message=>({ok:false,message,items:[]});
  if(!door||isProp(door))return fail('Select a wooden door or lid first.');
  // A builder may hang a piece with no pull (piece.noPull: the toy chest's lid is lifted by its front lip). Every
  // way of hanging it again honors that (Connect, holds.js, the Hang dialog's start), unless the person asks for a
  // pull themselves (opts.pull true: the Hang dialog's box ticked by hand). The code review of the audit fixes, 3.
  if(door.noPull&&opts.pull===undefined)opts={...opts,pull:false};
  if(tilted(door))return fail(`${door.name} is set at an angle. Hinges can only be worked out for a piece that stands square.`);
  const T=door.ax[2],lid=T===1,b=plainBox(door),middle=middleOf(b),thick=b.hi[T]-b.lo[T];
  const near=doorNeighbors(door,b);
  // which face looks out: the one away from what the door lies against, or away from the middle of the design
  let low=0,high=0;
  for(const n of near){
    const rU=overlapRange(n,b,(T+1)%3),rV=overlapRange(n,b,(T+2)%3);
    if(rU[1]-rU[0]<.1||rV[1]-rV[0]<.1)continue;
    const area=(rU[1]-rU[0])*(rV[1]-rV[0]);
    if(Math.abs(n.hi[T]-b.lo[T])<.05)low+=area;
    if(Math.abs(n.lo[T]-b.hi[T])<.05)high+=area;
  }
  const outSign=low||high?(low>=high?1:-1):lid?1:designMiddle()[T]<=middle[T]?1:-1;
  const edges=hingeEdges(T,outSign);

  // the edge to hinge on
  let edge=edges.find(e=>e[0]===opts.side),how='';
  if(!edge){
    if(lid){edge=edges[0];how='its back edge';}
    else{
      const[left,right]=[edges[0],edges[1]].map(e=>({e,found:edgeSupports(b,near,T,outSign,e[1],e[2],e[3])}));
      if(Math.abs(left.found.score-right.found.score)>.5)edge=(left.found.score>right.found.score?left:right).e;
      else{
        // nothing to tell the two edges apart: pair up with the door beside it, so that the handles meet
        const B=left.e[2],lowDoor=doorBeside(door,b,T,B,-1),highDoor=doorBeside(door,b,T,B,1);
        let sign;
        if(lowDoor&&!highDoor)sign=1;
        else if(highDoor&&!lowDoor)sign=-1;
        else if(lowDoor&&hungSide(lowDoor,B))sign=-hungSide(lowDoor,B);
        else sign=middle[B]<=designMiddle()[B]?-1:1;
        edge=left.e[3]===sign?left.e:right.e;
      }
    }
  }
  const[side,A,B,edgeSign]=edge,found=edgeSupports(b,near,T,outSign,A,B,edgeSign);
  const lengthA=b.hi[A]-b.lo[A],lengthB=b.hi[B]-b.lo[B],sheet=M[door.mat].kind==='sheet';

  // the kind of hinge and how it is mounted: on the faces, on the edge, or a cup in the back of the door
  let kind=opts.kind&&HARDWARE[opts.kind]&&HARDWARE[opts.kind].motion==='swing'?opts.kind:'',style;
  if(kind==='cup'){
    if(!found.backers.length)return fail(`A cup hinge needs the cabinet right behind the ${side} edge of ${door.name}. Pick another edge or another hinge.`);
    style='cup';
  }else if(found.flankers.length&&!lid)style='face';
  else if(found.flush.length&&(lid||kind))style='edge';
  else if(found.backers.length&&!lid&&!kind)style='cup';
  else if(found.flankers.length)style='face';
  else if(kind&&found.backers.length)return fail(`A ${HARDWARE[kind].name.toLowerCase()} needs the frame flush with the ${side} edge of ${door.name}, or level with its face. A concealed cup hinge fits here.`);
  else return fail(`There is nothing along the ${side==='top'&&lid?'back':side} edge of ${door.name} to hinge it to. Move it against its frame, or pick another edge.`);
  if(!kind)kind=style==='cup'?'cup':style==='face'&&!lid&&(lengthA>=48||!sheet)?'strap':'butt';
  const supports=style==='face'?found.flankers:style==='cup'?found.backers:found.flush;

  // how many, what size, and where along the edge (the rules at the top)
  let size=HARDWARE[kind].size,count=lengthA>40?3:2;
  if(kind==='butt')size=lengthA<16?2:lengthA<30?2.5:3;
  if(kind==='strap'){size=lengthA>=60?8:lengthA>=30?6:4;count=lengthA>=60?3:2;}
  if(kind==='piano'){
    const fits=HARDWARE.piano.sizes.map(s=>s[0]).filter(s=>s<=lengthA-.5);
    if(!fits.length)return fail(`${door.name} is too short for the shortest piano hinge (12").`);
    size=fits[fits.length-1];count=1;
  }
  const inset=hingeInset(lengthA);
  const wanted=count===1?[middle[A]]:count===2?[b.lo[A]+inset,b.hi[A]-inset]:[b.lo[A]+inset,middle[A],b.hi[A]-inset];
  const half=kind==='piano'?0:Math.min(1.25,size/2),places=[];
  for(const want of wanted){
    // on the support that is there, or slid along the edge to the nearest one
    // (a piece too thin to take the screws of a hinge, like the edge of a plywood shelf, only when there is nothing else)
    let best=null;
    for(const s of supports){
      const room=Math.min(half,(s.rA[1]-s.rA[0])/2),at=Math.max(s.rA[0]+room,Math.min(s.rA[1]-room,want));
      // A post, an upright or a side that runs along the edge is what a hinge is screwed to (the steps of the
      // presets say so). A rail that only crosses the edge is used when no such piece is within 3" of the place.
      const crosses=s.rA[1]-s.rA[0]<lengthA*.4;
      // Of two that fit as well, the one right at the edge of the door (an end post, not the upright behind it
      // that stands further in): offEdge, how far in from the edge it starts, tips the balance.
      const offEdge=s.rB?Math.max(0,edgeSign>0?found.edge-s.rB[1]:s.rB[0]-found.edge):0;
      // The edge of a thin panel behind the door (a 1/4" side panel whose front edge an overlay door covers, as on
      // the fish cabinets, js/fishtop.js) takes no hinge screws: the post beside it does, so it is used only when
      // there is nothing else.
      const thinEdge=s.rB&&s.rB[1]-s.rB[0]<.5?50:0;
      const miss=Math.abs(at-want)+(s.rA[1]-s.rA[0]<1.25?100:0)+(crosses?3:0)+offEdge*.01+thinEdge;
      if(!best||miss<best.miss)best={at,s,miss};
    }
    if(best&&!places.some(p=>Math.abs(p.at-best.at)<2))places.push(best);
  }
  if(!places.length)return fail(`There is nothing along the ${side} edge of ${door.name} to hinge it to.`);

  const nOut=unit(T,outSign),eEdge=unit(B,edgeSign),items=[];
  const world=(a,bb,t)=>{const p=[0,0,0];p[A]=a;p[B]=bb;p[T]=t;return p;};
  const onDoor=point=>point.map((v,k)=>v-middle[k]);
  for(const place of places){
    const s=place.s,fields={kind,size,on:door.id,to:s.n.p.id,geo:{}};
    if(style==='edge'){ // the leaves lie on the edge of the door and the outside of the frame; the pin is at the seam
      fields.at=onDoor(world(place.at,found.edge+s.side*edgeSign,found.inner));
      fields.n=eEdge;fields.u=crossOf(nOut,eEdge);
      fields.geo={wd:Math.max(.25,thick-.0625)};
    }else{              // the pin is at the corner of the outer face and the hinge edge
      fields.at=onDoor(world(place.at,found.edge+(style==='face'?edgeSign*s.gap/2:0),found.outer));
      fields.n=nOut;fields.u=crossOf(nOut,eEdge);
      if(style==='cup'){
        const face=edgeSign>0?s.n.lo[B]:s.n.hi[B],insetOfFrame=(found.edge-face)*edgeSign; // the inside face of the frame piece, where the plate goes
        fields.geo={t:thick};
        if(insetOfFrame>=.2&&insetOfFrame<=2.5)fields.geo.e=clean(insetOfFrame);
      }else fields.geo={wf:Math.max(.5,Math.min(1.5,(s.n.hi[B]-s.n.lo[B])-.2))};
    }
    items.push(fields);
  }
  const said=[hardwareWords(items)+` on ${side==='top'&&lid?'its back':'its '+side} edge`];

  // the pull, on the side away from the hinges
  const free=edgeSign>0?b.lo[B]:b.hi[B];
  let pullAt=middle[A];
  if(!lid&&A===1){
    const step=Math.min(4,lengthA/4);
    pullAt=b.hi[1]<=42?b.hi[1]-step:b.lo[1]>=48?b.lo[1]+step:Math.min(b.hi[1]-6,b.lo[1]+36);
  }
  if(opts.pull!==false){
    const small=Math.min(lengthA,lengthB)<6,pullKind=small?'knob':'pull';
    items.push({kind:pullKind,size:small?1.25:kind==='strap'?5:3.75,on:door.id,to:null,
      at:onDoor(world(pullAt,free+edgeSign*Math.min(2.5,lengthB/4),found.outer)),n:nOut,u:unit(A,1),geo:{}});
    said.push(small?'a knob':'a pull');
  }
  if(opts.catch!==false){
    if(lid){
      const stay=lidStay(door,found,A,B,T,edgeSign,outSign,b);
      if(stay){items.push(stay);said.push('a lid stay');}
    }else if(kind==='strap'){
      const beyond=edgeSupports(b,near,T,outSign,A,B,-edgeSign).flankers[0];
      const eFree=unit(B,-edgeSign);
      items.push({kind:'hasp',size:4.5,on:door.id,to:beyond?beyond.n.p.id:null,
        at:onDoor(world(Math.min(b.hi[A]-3,pullAt+6),free-edgeSign*(beyond?beyond.gap/2:0),found.outer)),n:nOut,u:crossOf(nOut,eFree),geo:{}});
      said.push('a latch');
    }else{
      const made=doorCatch(door,found,near,A,B,T,edgeSign,outSign,b);
      if(made){items.push(made);said.push('a magnetic catch');}
    }
  }
  const extras=said.slice(1),words=said[0]+(extras.length?', with '+(extras.length>1?extras.slice(0,-1).join(', ')+' and ':'')+extras[extras.length-1]:'');
  return{ok:true,side,kind,style,items,message:`${door.name} is hung on ${words}.`};
}
/* A magnetic catch: inside the cabinet, just behind the door, near its free top corner. It goes on a face of a
   frame piece that looks into the opening behind the door. */
function doorCatch(door,found,near,A,B,T,edgeSign,outSign,b){
  const free=edgeSign>0?b.lo[B]:b.hi[B],want=[0,0,0];
  want[A]=b.hi[A]-2;want[B]=free+edgeSign*1.5;
  let best=null;
  for(const n of near){
    if(Math.abs((outSign>0?n.hi[T]:n.lo[T])-found.inner)>.05)continue; // not against the back of the door
    for(const X of[A,B]){
      const Y=X===A?B:A,rY=overlapRange(n,b,Y);
      if(rY[1]-rY[0]<2)continue;
      for(const s of[-1,1]){
        const face=s>0?n.hi[X]:n.lo[X];
        if((s>0?b.hi[X]-face:face-b.lo[X])<1.2||face<b.lo[X]+.3||face>b.hi[X]-.3)continue; // the door must cover the opening beside this face
        const along=Math.max(rY[0]+1,Math.min(rY[1]-1,want[Y]));
        const miss=Math.abs(face-want[X])+Math.abs(along-want[Y]);
        if(!best||miss<best.miss)best={miss,n,X,Y,s,face,along};
      }
    }
  }
  if(!best)return null;
  const point=[0,0,0];
  point[best.X]=best.face;point[best.Y]=best.along;point[T]=found.inner;
  const n=unit(best.X,best.s),host=best.n.p;
  return{kind:'catch',size:1.75,on:host.id,to:null,at:toHostFrame(host,point),n,u:crossOf(unit(T,outSign),n),geo:{for:door.id}};
}
/* A lid stay: on the inside of a side of the box, near the hinges. */
function lidStay(door,found,A,B,T,edgeSign,outSign,b){
  const sides=found.backers.concat(found.flush).map(s=>s.n).filter(n=>n.hi[A]-n.lo[A]<=1.6&&n.hi[B]-n.lo[B]>=8);
  // any piece under the lid that runs front to back will do when none reaches the hinge edge
  const under=sides[0]||null;
  if(!under)return null;
  const middleA=(b.lo[A]+b.hi[A])/2,s=(under.lo[A]+under.hi[A])/2<middleA?1:-1,size=8;
  const point=[0,0,0];
  point[A]=s>0?under.hi[A]:under.lo[A];
  point[B]=found.edge-edgeSign*(size/2+1.5);
  point[T]=found.inner-outSign*2.5;
  return{kind:'stay',size,on:under.p.id,to:null,at:toHostFrame(under.p,point),n:unit(A,s),u:unit(B,1),geo:{for:door.id}};
}
function hangDoor(door,opts){
  const plan=hangPlan(door,opts);
  if(!plan.ok)return plan;
  // hung before: the old hinges, pull and catch make way
  const old=hardwareList().filter(item=>(item.on===door.id&&['butt','strap','cup','piano','pull','knob','hasp'].includes(item.kind))||(item.geo&&item.geo.for===door.id));
  removeHardware(old.map(item=>item.id));
  plan.items=plan.items.map(addHardware);
  const freed=freeFromFrame([...ownParts(door)]);
  if(freed.length)plan.message+=` It is no longer fastened to ${freed.slice(0,3).join(', ')}${freed.length>3?' and the rest of its frame':''}: the hinges hold it now.`;
  return plan;
}
/* ---------- by hand: ask before a piece is taken off its fasteners ----------
   hangDoor and mountSlides free the piece from its frame (freeFromFrame). When a preset is placed that is part
   of building it. When a PERSON hangs or mounts a piece, those are connections of the design, and nothing deletes
   a connection without the Unfasten question: a cabinet side clicked by mistake with a hinge must stay screwed on.
   So every by-hand way goes through these two: the Hang dialog, a hinge or slide kind from the Hardware
   pulldown, "Mount this drawer on slides". */
/* the connections that freeFromFrame would delete for these pieces: everything that fastens them to the rest of
   the design, but for the hinges and slides themselves */
function frameLinks(pieceIds){
  return linksToOutside(new Set(pieceIds)).filter(link=>!link.hold);
}
/* Asks when `links` is not empty, then runs go(). what: 'hinges' or 'slides'. name: the door, or 'the drawer'. */
function askBeforeFreeing(links,pieceIds,name,what,go){
  if(!links.length){go();return;}
  const one=links.length===1,Name=name[0].toUpperCase()+name.slice(1);
  askAboutLinks(links,
    {title:what==='hinges'?`Hang ${name} on hinges?`:`Put ${name} on slides?`,action:what==='hinges'?'Delete and hang it':'Delete and mount it',freed:new Set(pieceIds),
      text:`${Name} is fastened to other pieces. Something that ${what==='hinges'?'hangs on hinges':'runs on slides'} cannot be screwed to its frame as well, `+
        `so ${one?'this connection':'these connections'} will be deleted. Undo (Ctrl+Z) brings ${one?'it':'them'} back. If this is not a ${what==='hinges'?'door or a lid':'drawer'}, keep ${one?'it':'them'}.`},
    go);
}
/* Hang a door or lid by hand. after: the hint that follows the message ("Drag the blue ball to swing it open."). */
function hangByHand(door,opts,after){
  const plan=hangPlan(door,opts);
  if(!plan.ok){showMessage('Could not hang it',plan.message);return;}
  const own=[...ownParts(door)];
  askBeforeFreeing(frameLinks(own),own,door.name,'hinges',()=>{
    const result=hangDoor(door,opts);
    if(!result.ok){showMessage('Could not hang it',result.message);return;}
    sel=new Set([door.id]);
    commit();
    toast(result.message+' '+after);
  });
}
/* Put a drawer on slides or runners by hand. plan: a slidePlan that fits; mount(): does it and returns the result. */
function mountByHand(plan,mount,after,selectId){
  const drawer=plan.drawer.map(piece=>piece.id);
  askBeforeFreeing(frameLinks(drawer),drawer,'the drawer','slides',()=>{
    const result=mount();
    if(!result.ok){showMessage('Could not mount this drawer',result.message);return;}
    if(selectId!==undefined)sel=new Set([selectId]);
    commit();
    toast(result.message+' '+after);
  });
}
function hangPresetDoors(ids){
  const fresh=new Set(ids),listed=(S.hw||[]).map(row=>row[0]).join(' ');
  const doors=S.parts.filter(p=>fresh.has(p.id)&&DOOR_NAMES.test(p.name)&&!isProp(p))
    .sort((p,q)=>p.ax[2]-q.ax[2]||p.pos[0]-q.pos[0]||p.pos[2]-q.pos[2]); // left to right, so that pairs of doors work out
  const failed=[];
  for(const door of doors){
    const lid=door.ax[2]===1;
    // a catch only where the preset's own list asks for one (cup hinges close by themselves); a lid always gets its stay
    // (a piece the builder hangs with no pull, piece.noPull, gets none: hangPlan)
    const opts={catch:lid||/catch|latch|hasp/i.test(listed)};
    // a builder may say which edge a door hangs on (piece.hinge: 'left' or 'right'); when that edge has nothing
    // to hang it on, the edge is found as for any other door. Older designs have no such field.
    let result=door.hinge==='left'||door.hinge==='right'?hangDoor(door,{...opts,side:door.hinge}):null;
    if(!result||!result.ok)result=hangDoor(door,opts);
    if(!result.ok)failed.push(result.message);
  }
  return failed;
}

/* ---------- the Hang dialog ---------- */
function canHang(){
  if(sel.size!==1)return false;
  const p=selParts()[0];
  return!!p&&!isProp(p)&&!tilted(p);
}
function hangOptions(){
  return{side:$('#hangSide').value||undefined,kind:$('#hangKind').value||undefined,pull:$('#hangPull').checked,catch:$('#hangCatch').checked};
}
function showHangPlan(){
  const plan=hangPlan(selParts()[0],hangOptions()),say=$('#hangSay');
  say.textContent=plan.ok?plan.message.replace(' is hung on ',' will hang on '):plan.message;
  say.classList.toggle('err',!plan.ok);
  $('#bHangGo').disabled=!plan.ok;
}
function openHang(){
  if(tab!=='design')setTab('design');
  if(!canHang()){toast('Select one door or lid first, then choose Hang this door or lid.');return;}
  const lid=selParts()[0].ax[2]===1;
  $('#hangSide').innerHTML=[['','Find it for me'],['left','Left'],['right','Right'],['top',lid?'Back':'Top'],['bottom',lid?'Front':'Bottom']]
    .map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  $('#hangKind').innerHTML='<option value="">Choose for me</option>'+
    Object.entries(HARDWARE).filter(([,kind])=>kind.motion==='swing').map(([key,kind])=>`<option value="${key}">${esc(kind.name)}</option>`).join('');
  $('#hangPull').checked=!selParts()[0].noPull;   // (a lid lifted by its lip starts with no pull: hangPlan)
  $('#hangCatch').checked=true;
  showHangPlan();
  $('#hangDlg').showModal();
}
$('#hangDlg').addEventListener('change',showHangPlan);
$('#bHangGo').onclick=()=>{
  const door=selParts()[0];
  $('#hangDlg').close();
  if(!door)return;
  hangByHand(door,hangOptions(),'Drag the blue ball to swing it open.'); // asks first when the piece is fastened to others
};

/* ---------- drawer slides ---------- */
/* The underside a wooden runner carries: the lowest point of the drawer over the strip, which is 3/4" wide against
   the cabinet side and runs between the two ends given. `pair` is a drawer side with the cabinet side beside it. */
function lowestOver(drawer,pair,endA,endB){
  const g=pair.g,h=pair.h,face=pair.side>0?pair.cb.lo[g]:pair.cb.hi[g];
  const from=Math.min(endA,endB),to=Math.max(endA,endB);
  let lowest=pair.db.lo[1];
  for(const piece of drawer){
    const b=plainBox(piece);
    const overStrip=pair.side>0?b.hi[g]>face-.75:b.lo[g]<face+.75;
    if(overStrip&&b.lo[h]<to-.5&&b.hi[h]>from+.5&&b.lo[1]<lowest&&b.hi[1]>pair.db.lo[1]-1)lowest=b.lo[1];
  }
  return lowest;
}
/* these pieces and everything reached from them through fastened wood joints alone */
function joinedByWood(pieceIds){
  const joined=new Set(pieceIds),todo=[...pieceIds];
  while(todo.length){
    const id=todo.pop();
    for(const link of connectionsOf(id)){
      if(!link.fastened||link.hold)continue;
      const other=link.a.id===id?link.b.id:link.a.id;
      if(!joined.has(other)){joined.add(other);todo.push(other);}
    }
  }
  return joined;
}
function slidePlan(pieceIds,opts){
  opts=opts||{};
  const fail=message=>({ok:false,message,items:[]});
  const kind=opts.kind==='runner'?'runner':'slide',range=kind==='slide'?SLIDE_GAP_RANGE:RUNNER_GAP_RANGE;
  // what the drawer is: exactly these pieces; or, from one piece, its subcomponent (a Drawer inside a Cabinet), or
  // else everything joined to it by wood joints (not by slides, hinges or hardware a preset only declares: those
  // are what holds a drawer to its cabinet, and the cabinet is not part of the drawer)
  let riders=new Set(pieceIds);
  if(!opts.exact){
    const own=pieceIds.length===1&&byId(pieceIds[0])?ownParts(byId(pieceIds[0])):new Set();
    riders=own.size>1?own:joinedByWood(pieceIds);
  }
  const square=p=>!isProp(p)&&!tilted(p);
  const drawer=S.parts.filter(p=>riders.has(p.id)&&square(p)),rest=S.parts.filter(p=>!riders.has(p.id)&&square(p));
  if(!drawer.length)return fail('Select the drawer first.');
  if(drawer.length>60)return fail('The selection is fastened to the whole cabinet, so it cannot slide. Unfasten the drawer from the cabinet first (U).');
  // a side of the drawer facing a side of the cabinet across the right gap
  const pairs=[];
  for(const d of drawer){
    const db=plainBox(d);
    for(const c of rest){
      const cb=plainBox(c);
      for(const g of[0,2]){
        const h=2-g,side=cb.lo[g]>=db.hi[g]-.01?1:cb.hi[g]<=db.lo[g]+.01?-1:0;
        if(!side)continue;
        const gap=side>0?cb.lo[g]-db.hi[g]:db.lo[g]-cb.hi[g];
        if(gap<range[0]-.01||gap>range[1]+.01)continue;
        const rH=overlapRange(db,cb,h),rY=overlapRange(db,cb,1);
        if(rH[1]-rH[0]<4||rY[1]-rY[0]<1)continue;
        pairs.push({d,c,db,cb,g,h,side,gap,rH,rY,area:(rH[1]-rH[0])*(rY[1]-rY[0])});
      }
    }
  }
  if(!pairs.length){
    return fail(kind==='slide'
      ?`A side-mount drawer slide fills a ${fmt(SLIDE_GAP)} gap between the side of the drawer and the side of the cabinet. No side of this drawer has that gap. Make the drawer box 1" narrower than its opening.`
      :'A wooden runner needs the side of the drawer close to the side of the cabinet (1/4" or less). No side of this drawer is.');
  }
  pairs.sort((p,q)=>q.area-p.area);
  // Across which direction the slides go: the one in which the drawer has a cabinet side on BOTH of its sides.
  // (The back of a drawer box can stand the same 1/2" from the back panel as its sides stand from the cabinet
  // sides, and be the bigger face: that is not a place for a slide.) Only when neither direction has both, or
  // both have, the bigger faces decide.
  const bothSides=across=>[-1,1].every(side=>pairs.some(p=>p.g===across&&p.side===side));
  const wanted=opts.dir?(Math.abs(opts.dir[0])>Math.abs(opts.dir[2])?2:0):null; // the way it opens is known: the slides lie along it
  let g=pairs[0].g;
  if(wanted!==null&&pairs.some(p=>p.g===wanted))g=wanted;
  else if(bothSides(0)!==bothSides(2))g=bothSides(0)?0:2;
  const h=2-g,chosen=[];
  for(const side of[-1,1]){
    const best=pairs.find(p=>p.g===g&&p.side===side);
    if(best)chosen.push(best);
  }
  // the way it opens: toward the end where the drawer reaches the front of the cabinet sides
  let sign;
  if(opts.dir)sign=opts.dir[h]>=0?1:-1;
  else{
    const all=bbox(drawer),cabinet=bbox(chosen.map(p=>p.c));
    sign=cabinet.hi[h]-all.hi[h]<=all.lo[h]-cabinet.lo[h]?1:-1;
  }
  const lengths=HARDWARE[kind].sizes.map(s=>s[0]),items=[];
  for(const pair of chosen){
    // Its front end is at the front of the drawer side, but never nearer than 1/16" to the front edge of the
    // cabinet side (DRAWER.slideBack, js/drawers.js): behind an overlay front the box stands a little proud.
    const sideFront=sign>0?pair.db.hi[h]:pair.db.lo[h];
    const cabinetFront=sign>0?pair.cb.hi[h]-DRAWER.slideBack:pair.cb.lo[h]+DRAWER.slideBack;
    const front=sign>0?Math.min(sideFront,cabinetFront):Math.max(sideFront,cabinetFront);
    const onCabinet=Math.abs(front-(sign>0?pair.cb.lo[h]:pair.cb.hi[h]));  // how much cabinet side there is behind that point
    // as long as the drawer side, and no longer than the cabinet side behind its front end
    const room=Math.min(pair.db.hi[h]-pair.db.lo[h],onCabinet),fits=lengths.filter(length=>length<=room+.01);
    if(!fits.length)return fail(`${pair.d.name} is ${fmt(room)} long where it runs along ${pair.c.name}: too short for the shortest slide (${fmt(lengths[0])}).`);
    const size=fits[fits.length-1],point=[0,0,0];
    point[h]=front-sign*size/2;
    // a slide at mid height; a runner under whatever part of the drawer rides on it (a bottom nailed on under the
    // box reaches below the drawer side)
    point[1]=kind==='slide'?(pair.rY[0]+pair.rY[1])/2:lowestOver(drawer,pair,front-sign*size,front);
    point[g]=pair.side>0?pair.db.hi[g]:pair.db.lo[g];
    const n=unit(g,pair.side),u=unit(h,sign),geo={g:clean(pair.gap)};
    if(kind==='runner')geo.up=crossOf(u,n)[1]>0?1:-1;
    items.push({kind,size,on:pair.d.id,to:pair.c.id,at:toHostFrame(pair.d,point),n,u,geo});
  }
  const travel=Math.min(...items.map(item=>HARDWARE[kind].travel(item.size)));
  return{ok:true,items,drawer,message:`The drawer is on ${hardwareWords(items)} (${items.map(item=>fmt(item.size)).join(' and ')}) and comes out ${fmt(r16(travel))}.`+
    (items.length<2?' Only one side has the right gap: check the other side.':'')};
}
function mountSlides(pieceIds,opts){
  const plan=slidePlan(pieceIds,opts);
  if(!plan.ok)return plan;
  const inDrawer=new Set(plan.drawer.map(p=>p.id));
  removeHardware(hardwareList().filter(item=>inDrawer.has(item.on)&&HARDWARE[item.kind].motion==='slide').map(item=>item.id));
  plan.items=plan.items.map(addHardware);
  const freed=freeFromFrame([...inDrawer]);
  if(freed.length)plan.message+=` It is no longer fastened to ${freed.slice(0,3).join(', ')}: the slides hold it now.`;
  return plan;
}
/* (The command "Mount this drawer on slides" is mountDrawerOfSel in js/drawertool.js: it also tries wooden runners
   and adds a pull.) */

/* ---------- one piece of hardware on a face ---------- */
function addOnFace(kind,piece,axis,sign,opts){
  opts=opts||{};
  const b=plainBox(piece),point=middleOf(b),others=[0,1,2].filter(k=>k!==axis);
  point[axis]=sign>0?b.hi[axis]:b.lo[axis];
  if(opts.offset){point[others[0]]+=opts.offset[0];point[others[1]]+=opts.offset[1];}
  // its length runs the long way of the face unless the caller says otherwise
  const longWay=b.hi[others[0]]-b.lo[others[0]]>=b.hi[others[1]]-b.lo[others[1]]?others[0]:others[1];
  const along=opts.along!==undefined&&opts.along!==axis?opts.along:longWay,middle=middleOf(b);
  // measured in the piece's own frame (the directions of the world before any free rotation of the piece)
  // opts.to: the piece it carries (a shelf pin's shelf), for hardware that holds (HARDWARE[kind].holds)
  return addHardware({kind,size:opts.size,on:piece.id,to:opts.to==null?null:opts.to,at:point.map((v,k)=>v-middle[k]),n:unit(axis,sign),u:unit(along,1),geo:{}});
}
function addPull(piece,opts){
  opts=opts||{};
  const T=piece.ax[2],b=plainBox(piece),sign=opts.sign||(designMiddle()[T]<=(b.lo[T]+b.hi[T])/2?1:-1);
  const horizontal=[0,2].find(k=>k!==T);
  return addOnFace(opts.kind||'pull',piece,T,sign,{size:opts.size,along:T===1?undefined:horizontal,offset:opts.offset});
}

/* ---------- checks ---------- */
/* Every preset that has a door or a lid: each one is hung, on a frame piece right beside its hinges, belongs to
   the fastened set of its frame, opens all the way without hitting anything, and its hardware is on the shopping
   list exactly once. */
SELFTESTS.push(function presetDoorsOpen(problems){
  const wrong=text=>problems.push('doors: '+text);
  const hingeKinds=['butt','strap','cup','piano'];
  for(const variant of presetVariants()){ // js/fasteners.js: every preset with each of its choices (cabinet stands, the Shed's plywood door)
    const ids=placeForCheck(variant);        // the pieces, the preset's hardware list and the fasteners it names
    if(!ids||!S.parts.some(p=>DOOR_NAMES.test(p.name)))continue;
    const failed=hangPresetDoors(ids);
    for(const hook of ON_COMMIT)hook(); // what commit() does to the design, without drawing it
    failed.forEach(message=>wrong(`${variant.name}: ${message}`));
    for(const door of S.parts.filter(p=>DOOR_NAMES.test(p.name))){
      const mover=moverOf(door.id);
      if(!mover){wrong(`${variant.name}: ${door.name} is not on hinges`);continue;}
      if(mover.stuck){wrong(`${variant.name}: ${door.name} is hinged and also fastened to ${mover.stuck.name}`);continue;}
      if(mover.items.length<2)wrong(`${variant.name}: ${door.name} hangs on fewer than two hinges`);
      // the steps of the presets hang a door on a post, an upright or a side, never on a rail or the edge of a shelf
      const lowly=mover.items.map(item=>byId(item.to)).find(piece=>piece&&/^(rail|shelf|shelf deck)$/i.test(piece.name));
      if(lowly)wrong(`${variant.name}: a hinge of ${door.name} is screwed to a ${lowly.name}, not to the post, upright or side beside it`);
      if(!fastenedSet([door.id]).has(mover.items[0].to))wrong(`${variant.name}: ${door.name} does not move with the frame it is hinged to`);
      const reach=openReach(mover);
      if(reach.hit)wrong(`${variant.name}: ${door.name} hits ${reach.hit.other.name} after opening ${openSaid(mover,reach.free)}`);
      for(const item of mover.items){ // nothing floating: the pin is at the door and right beside the frame piece
        const at=hardwarePose(item).at.toArray();
        const gapTo=piece=>{const b=box(piece);return Math.max(...at.map((v,k)=>Math.max(b.lo[k]-v,v-b.hi[k],0)));};
        const reachToFrame=item.kind==='cup'?door.t+.3:.3; // the pin of a cup hinge is at the front of the door, the cabinet behind it
        if(gapTo(door)>.3||gapTo(byId(item.to))>reachToFrame)wrong(`${variant.name}: a hinge of ${door.name} is ${fmt(gapTo(door))} off the door and ${fmt(gapTo(byId(item.to)))} off ${byId(item.to).name}`);
      }
      // (every door has a pull, but a piece the builder hangs without one: the toy chest's lid, lifted by its lip)
      if(!door.noPull&&!hardwareOn(door.id).some(item=>item.kind==='pull'||item.kind==='knob'))wrong(`${variant.name}: ${door.name} has no pull`);
      if(door.noPull&&hardwareOn(door.id).some(item=>item.kind==='pull'||item.kind==='knob'))wrong(`${variant.name}: ${door.name} is lifted by its lip, yet a pull is mounted on it`);
    }
    // the steps of the preset name the kind of hinge that is placed and listed: a builder who reads "the kind that
    // simply screws on" above "4 concealed cup hinges" does not know which to buy
    const stepsOf=variant.preset.steps||STEPS[variant.preset.name];
    const words=stepsOf?stepsOf(variant.vals).map(step=>step.t).join(' '):'';
    const saidAs={cup:/concealed cup hinge/i,strap:/T-hinge|strap hinge/i,piano:/piano hinge/i,butt:/hinge/i};
    for(const kind of new Set(hardwareList().filter(item=>hingeKinds.includes(item.kind)).map(item=>item.kind))){
      if(words&&!saidAs[kind].test(words))wrong(`${variant.name}: its doors hang on ${HARDWARE[kind].name.toLowerCase()}s, and no step says so`);
      if(kind==='cup'&&/simply screws on/i.test(words))wrong(`${variant.name}: a step tells the builder to buy hinges that simply screw on, and the program places and lists concealed cup hinges`);
    }
    // (a line that names the screws for the hinges is not a hinge: HW_NOT_PLAIN in js/hardware.js)
    const rows=hardwareTotals(findJoints()).rows,listed=words=>rows.filter(row=>words.test(row[0])&&!HW_NOT_PLAIN.test(row[0])).reduce((sum,row)=>sum+row[1],0);
    const placed=kinds=>hardwareList().filter(item=>kinds.includes(item.kind)).length;
    if(listed(/hinge/i)!==placed(hingeKinds))wrong(`${variant.name}: ${placed(hingeKinds)} hinges are in the model but the shopping list counts ${listed(/hinge/i)}`);
    if(listed(/\bpulls?\b|knob/i)!==placed(['pull','knob']))wrong(`${variant.name}: ${placed(['pull','knob'])} pulls are in the model but the shopping list counts ${listed(/\bpulls?\b|knob/i)}`);
    if(/undefined|NaN/.test(JSON.stringify(rows)))wrong(`${variant.name}: a hardware line of the shopping list is broken`);
  }
});

/* Nothing takes a piece off its fasteners without the Unfasten question. Each by-hand way that would (a tilt typed
   in Properties, a hinge from the Hardware pulldown, the Hang dialog, slides from the pulldown, Mount this drawer)
   is tried twice on a fastened piece: with the question left unanswered nothing at all may change, and the
   keyboard must start on "Keep them"; answered yes, it happens as one undo step. */
SELFTESTS.push(function nothingComesApartWithoutAsking(problems){
  const wrong=text=>problems.push('asking first: '+text);
  const kept={auto:autoFasten,confirm:autoConfirm,sel,placing:placingHardware,pick:window.pick};
  /* two sides, a bottom, a top, and a box of four boards standing on the bottom, 1/2" from each side: all fastened */
  const build=()=>{
    load(JSON.stringify(blank()),true);
    const ids=addParts([mk('Side','ply34',[.75,20,18],[0,0,0]),mk('Side','ply34',[.75,20,18],[16.75,0,0]),
      mk('Bottom','ply34',[16,.75,18],[.75,0,0]),mk('Top','ply34',[16,.75,18],[.75,19.25,0]),
      mk('Board','ply12',[.5,5,14],[1.25,.75,2]),mk('Board','ply12',[.5,5,14],[15.75,.75,2]),
      mk('Board','ply12',[14,5,.5],[1.75,.75,15.5]),mk('Board','ply12',[14,5,.5],[1.75,.75,2])]);
    commit();
    return ids;
  };
  const state=()=>JSON.stringify([S.parts.map(p=>[p.pos,p.ax,p.rot||0,p.q||0]),S.joints,hardwareList()]);
  const question=()=>{const dlg=$('#quickDlg');return dlg&&dlg.open?dlg:null;};
  /* runs act() with the question left open, checks that it asks and changes nothing, then answers yes */
  const tryIt=(what,act,done)=>{
    const ids=build(),before=state(),snapBefore=lastSnap;
    autoConfirm=false;
    act(ids);
    const asked=question();
    if(!asked)wrong(`${what}: no question was asked`);
    else{
      if(!asked.querySelectorAll('.dlg-list li').length)wrong(`${what}: the question does not list the connections that would go`);
      if(document.activeElement!==asked.querySelector('#quickNo'))wrong(`${what}: the keyboard does not start on the button that keeps the connections (Enter would delete)`);
      asked.close();
    }
    if(state()!==before||lastSnap!==snapBefore)wrong(`${what}: the design changed before the question was answered`);
    autoConfirm=true;
    const again=build(),beforeAgain=state();
    act(again);
    if(!done(again))wrong(`${what}: after agreeing, it was not done`);
    undo();
    if(state()!==beforeAgain)wrong(`${what}: one Undo does not bring everything back`);
  };
  try{
    autoFasten=true;
    // a tilt typed in Properties
    tryIt('Tilt, degrees on a fastened piece',ids=>{sel=new Set([ids[3]]);renderAll();tiltPiece(byId(ids[3]),'deg','30');},
      ids=>byId(ids[3]).rot&&byId(ids[3]).rot.deg===30&&S.parts.filter(tilted).length===1);
    // a hinge kind from the Hardware pulldown, clicked on a side of the cabinet
    const clickOn=id=>{
      window.pick=()=>({object:{userData:{id}},face:{normal:new THREE.Vector3(1,0,0)},point:new THREE.Vector3()});
      placeHardwareClick({button:0});
    };
    tryIt('a butt hinge from the Hardware pulldown on a cabinet side',ids=>{placingHardware='butt';clickOn(ids[1]);},
      ids=>hardwareOn(ids[1]).some(item=>item.kind==='butt'));
    // the Hang dialog
    tryIt('the Hang dialog on a cabinet side',ids=>{sel=new Set([ids[1]]);openHang();$('#bHangGo').click();},
      ids=>hardwareOn(ids[1]).some(item=>HARDWARE[item.kind].motion==='swing'));
    // Mount this drawer, on a box that is fastened to the bottom it stands on
    tryIt('Mount this drawer on slides on a fastened box',ids=>{sel=new Set(ids.slice(4));mountDrawerOfSel();},
      ids=>!!moverOf(ids[4]));
    // a piece that is fastened to nothing is tilted without a question
    autoConfirm=false;
    load(JSON.stringify(blank()),true);
    const[loose]=addParts([mk('Board','2x4',[24,1.5,3.5],[0,0,0])]);
    commit();
    sel=new Set([loose]);
    tiltPiece(byId(loose),'deg','20');
    if(question()){wrong('a piece that is fastened to nothing asks before it is tilted');question().close();}
    else if(!byId(loose).rot||byId(loose).rot.deg!==20)wrong('a loose piece was not tilted');
  }finally{
    autoConfirm=kept.confirm;autoFasten=kept.auto;sel=kept.sel;
    window.pick=kept.pick;
    placingHardware=null;
    if($('#hangDlg').open)$('#hangDlg').close();
    if(question())question().close();
    cv.style.cursor='';
    if($('#toast'))$('#toast').classList.remove('on');
  }
});

/* Doors and drawers made by hand: the open state is only a picture, a blocked door is called a fault, Unfasten
   removes the hinges, and a drawer needs its 1/2" gaps. */
SELFTESTS.push(function hingesAndSlidesWork(problems){
  const wrong=text=>problems.push('hinges and slides: '+text);
  const modeKept=woodMode;
  /* a small cabinet: two sides, a bottom and a top, with a door on the front. Returns the ids. */
  const cabinet=()=>{
    load(JSON.stringify(blank()),true);
    return addParts([mk('Side','ply34',[.75,20,18],[0,0,0]),mk('Side','ply34',[.75,20,18],[16.75,0,0]),
      mk('Bottom','ply34',[16,.75,18],[.75,0,0]),mk('Top','ply34',[16,.75,18],[.75,19.25,0]),
      mk('Door','ply34',[17.25,19.75,.75],[.125,.125,18])]);
  };
  try{
    setWoodMode('solid');
    let ids=cabinet(),door=ids[4];
    const hung=hangDoor(byId(door),{side:'left'});
    commit();
    const mover=moverOf(door);
    if(!hung.ok||!mover||mover.kind!=='swing'){wrong('a door on the front of a cabinet could not be hung: '+hung.message);return;}
    if(mover.limit!==110||mover.items.some(item=>item.kind!=='cup'))wrong('a plywood cabinet door did not get concealed cup hinges that open 110 degrees');
    if(!fastenedSet([ids[0]]).has(door))wrong('a hinged door does not move with its cabinet');
    // opening it changes the picture and nothing else
    const before=JSON.stringify(S.parts.map(p=>[p.pos,p.ax,p.l,p.w])),joints=findJoints().length;
    sel=new Set([door]);
    openTo(moverOf(door),1);
    if(Math.abs(meshes.get(door).quaternion.w)>=.999)wrong('an open door is drawn closed');
    if(JSON.stringify(S.parts.map(p=>[p.pos,p.ax,p.l,p.w]))!==before||findJoints().length!==joints)wrong('opening a door changed the position, the size or the joints of a piece');
    if(byId(door).open!==1)wrong('the open state is not stored on the door');
    if(!motionHandle||motionHandle.mover.lead.id!==door)wrong('a selected door shows no handle to open it');
    if(!/Open and close/.test($('#props').textContent)||!$('#props [data-open-slide]'))wrong('Properties of a hinged door has no Open slider');
    if(findClashes().length)wrong('an open door counts as an overlap in the design');
    // the pictures for the plans show it closed
    const posed=[];
    const spy=()=>posed.push(Math.abs(meshes.get(door).quaternion.w)<.999);
    SCENE_EXTRAS.push(spy);
    try{takePictures(false);}finally{SCENE_EXTRAS.splice(SCENE_EXTRAS.indexOf(spy),1);}
    if(posed[0]!==false)wrong('the pictures for the plans show the door open');
    setAllOpen(0);
    if(byId(door).open!==undefined||ENABLED.closeAll())wrong('Close all did not close the door');
    if(!ENABLED.openAll())wrong('Open all doors and drawers is greyed out although a door can open');
    // Unfasten lists the hinges in their own words and removes them; the pull stays
    sel=new Set([door]);
    const lines=unfastenLines(linksToOutside(sel));
    if(!lines.some(line=>/2 concealed cup hinges/.test(line)))wrong('Unfasten does not list the hinges: '+lines.join(' / '));
    unfastenSel(); // answered yes at once while the self-check runs
    if(hardwareList().some(item=>item.kind==='cup')||moverOf(door))wrong('Unfasten did not remove the hinges');
    if(!hardwareList().some(item=>item.kind==='pull'))wrong('Unfasten took the pull off the door as well');
    if(fastenedSet([ids[0]]).has(door))wrong('after Unfasten the door still moves with the cabinet');

    // a board right in front of the door: it cannot open, and that is said
    ids=cabinet();door=ids[4];
    const[block]=addParts([mk('Block','2x4',[10,20,1.5],[6,0,19])]);
    hangDoor(byId(door),{side:'left'});
    commit();
    const reach=openReach(moverOf(door));
    if(!reach.hit||reach.hit.other.id!==block||reach.free>=CANNOT_OPEN)wrong('a door with a board right in front of it is not seen as blocked');
    setOpen(moverOf(door),.5);commit();
    if(!motionTroubles().some(trouble=>/cannot open/.test(trouble.text)&&/Block/.test(trouble.text)))wrong('a door that cannot open is not called a fault: '+motionTroubles().map(trouble=>trouble.text).join(' / '));
    if($('#stMotion').hidden)wrong('the status bar does not warn about a door that hits something');
    // screwed shut as well: it cannot move at all
    ids=cabinet();door=ids[4];
    hangDoor(byId(door),{side:'left'});
    S.joints[ids[0]+'-'+door]='screw';
    commit();
    if(!moverOf(door)||!moverOf(door).stuck)wrong('a door that is hinged and also screwed to its cabinet is not seen as stuck');

    // a panel that is not called Door was fastened to the cabinet by Auto-fasten: hanging it takes the screws out
    const autoKept=autoFasten;
    autoFasten=true;
    try{
      ids=cabinet();door=ids[4];
      byId(door).name='Panel';
      commit();
      if(fastenedSet([door]).size<5)wrong('(setting up) a panel on the front of a cabinet was not fastened by Auto-fasten');
      const panel=hangDoor(byId(door));
      commit();
      if(!panel.ok||!moverOf(door)||moverOf(door).stuck||!/no longer fastened/.test(panel.message))wrong('hanging a panel that was screwed to its cabinet left it screwed shut: '+panel.message);
      // the whole cabinet turned to an odd angle: the door still opens, and nothing is in its way
      sel=new Set([ids[0]]);
      applyRot(snapshot(),1,Math.PI/6,selCenter());finishRot();commit();
      const turnedDoor=moverOf(door);
      if(!turnedDoor||turnedDoor.stuck||openReach(turnedDoor).hit)wrong('after the cabinet was turned 30 degrees its door no longer opens');
    }finally{autoFasten=autoKept;}

    // a lid: butt hinges on the back edge, and it swings up
    load(JSON.stringify(blank()),true);
    const chest=addParts([mk('Front','ply34',[20,10,.75],[0,0,11.25]),mk('Back','ply34',[20,10,.75],[0,0,0]),
      mk('Side','ply34',[.75,10,10.5],[0,0,.75]),mk('Side','ply34',[.75,10,10.5],[19.25,0,.75]),mk('Lid','ply34',[20,.75,12],[0,10,0])]);
    const lid=hangDoor(byId(chest[4]));
    commit();
    const lidMover=moverOf(chest[4]);
    if(!lid.ok||!lidMover||lidMover.items.some(item=>item.kind!=='butt')||lidMover.items[0].to!==chest[1])wrong('a lid was not hung on butt hinges along its back edge: '+lid.message);
    else{
      if(lidMover.limit!==95)wrong('a lid with a lid stay opens '+lidMover.limit+' degrees, not 95');
      if(posedBox(byId(chest[4]),lidMover,.5).c.y<=10.875)wrong('an opening lid does not swing up');
      if(openReach(lidMover).hit)wrong('a lid hits its own box when it opens');
    }

    // a drawer: 1/2" gaps and a pair of slides; it comes out by the length of the slides, with everything on it
    const drawerIn=gap=>{
      load(JSON.stringify(blank()),true);
      const inner=16,wide=inner-2*gap,x0=.75+gap;
      return addParts([mk('Side','ply34',[.75,20,18],[0,0,0]),mk('Side','ply34',[.75,20,18],[inner+.75,0,0]),mk('Bottom','ply34',[inner,.75,18],[.75,0,0]),
        mk('Drawer side','ply12',[.5,5,16],[x0,8,1.25]),mk('Drawer side','ply12',[.5,5,16],[x0+wide-.5,8,1.25]),
        mk('Drawer back','ply12',[wide-1,5,.5],[x0+.5,8,1.25]),mk('Drawer front','ply34',[wide,5,.75],[x0,8,17.25])]);
    };
    ids=drawerIn(SLIDE_GAP);
    commit();
    const slides=mountSlides([ids[6]]);
    addPull(byId(ids[6]));
    commit();
    const drawer=moverOf(ids[6]);
    if(!slides.ok||slides.items.length!==2||!drawer||drawer.kind!=='slide')wrong('a drawer with 1/2" gaps did not get a pair of slides: '+slides.message);
    else{
      if(slides.items.some(item=>item.size!==16)||drawer.travel!==16)wrong('a 16" drawer side did not get 16" slides with 16" of travel');
      if(drawer.riders.size!==4||drawer.riders.has(ids[0]))wrong('the drawer that slides is not exactly the four pieces of the drawer box');
      const row=hardwareTotals(findJoints()).rows.find(r=>/Drawer slides/.test(r[0]));
      if(!row||row[1]!==1)wrong('two drawer slides are not listed as one pair: '+JSON.stringify(row));
      const closedZ=meshes.get(ids[6]).position.z;
      openTo(drawer,1);
      if(Math.abs(meshes.get(ids[6]).position.z-closedZ-16)>1e-6||Math.abs(meshes.get(ids[3]).position.z-(1.25+8+16))>1e-6)wrong('an open drawer is not drawn pulled out by the length of its slides');
      if(byId(ids[6]).pos[2]!==17.25)wrong('pulling a drawer out changed where its front really is');
      if(openReach(moverOf(ids[6])).hit)wrong('a drawer between two cabinet sides hits something when it is pulled out');
    }
    ids=drawerIn(.25);
    commit();
    const tight=mountSlides([ids[6]]);
    if(tight.ok||!/1\/2"/.test(tight.message))wrong('a drawer with 1/4" gaps was given slides, or the message does not say that slides need 1/2": '+tight.message);
    const runners=mountSlides([ids[6]],{kind:'runner'});
    commit();
    if(!runners.ok||!moverOf(ids[6])||moverOf(ids[6]).travel>=16)wrong('wooden runners did not fit a drawer with 1/4" gaps, or let it come out all the way: '+runners.message);
  }finally{
    setWoodMode(modeKept);
    if($('#toast'))$('#toast').classList.remove('on');
  }
});
