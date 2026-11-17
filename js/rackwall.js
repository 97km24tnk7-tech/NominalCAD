/* NominalCAD: what holds a fish rack, a cabinet stand or a single stand to the wall, and its sections together.

   The owner (fish tank racks are his niche) on the screws into the wall: "I want fewer holes". The rack had 16:
   four through each back post (two near the top and two at mid height) and one through the back rail of the top
   frame into every stud. Now the count is worked out from what would tip the rack over (WALL_SCREW_RULES in
   js/verify.js, with every number and why): structural screws through the back rail of the TOP frame only (the
   higher a screw, the more it holds against tipping), into a stud about every 4 ft, at least two, and as many as
   a pull at the top needs. A rack, stand or cabinet stand short enough for its depth to stand free
   (TIP_RULES.narrow) gets none. Separate sections are each held by their own screws.

   Separate sections ("Build it as", js/rackjoints.js) are carried in and set side by side; the two posts that meet
   are joined with 3/8" carriage bolts, washers and nuts (the lead's ruling on the owner's "whatever makes the most
   sense": the sections are meant to be carried, and undoing the nuts takes them apart again). One bolt at every
   frame, in the back pair of posts and in the front pair. A post is covered on its inside face by the end of its
   frame (a rail end and the end cross piece) and by the end upright between the frames, so a bolt goes through
   the end cross piece of each section as well: cross piece, post, post, cross piece. Where that does not fit
   (a frame with doubled rails has too little cross piece beside the post, or the bay is too short to slide the
   bolt in), it goes through the end uprights instead, in the hand room above the tanks.

   Both are hardware in the model (HARDWARE.wallscrew and HARDWARE.bolt, js/hardware.js): drawn, picked, listed,
   priced, mounted in the step that drives them, and counted by the structural check (wall screws: options.wallScrews,
   js/verify.js; bolts hold the two sections together like a hinge holds a door, HOLD_SOURCES).

     rackWallScrewPlan(pl, gap)     where the screws go along the top back rail: {screws:[{x, y, z, len, through,
                                    behind, section}], need:[per section], studs} in the plan's coordinates
                                    (x from the left end of the rack, z from its back); gap is how far the back of
                                    the rack stands off the wall (a brace or a back panel behind it)
     rackBoltPlan(pl)               the bolts at the joints between sections: [{x, y, z, from, to, len, grip, row,
                                    zone}] (from, to: the x of the head face and of the nut face)
     wallScrewsInParts(list, parts) the plan's screws as {on: piece, at} for the structural check
     placeRackHardware(args, gap, parts)   puts both into the design when the preset is placed
     wallScrewWords(pl, gap, thing) the screws in words, for the notes, the wall step and the shopping list
   The self-checks are at the bottom of the file. */
'use strict';

const RACK_BOLT_LENGTHS=[3,3.5,4,4.5,5,5.5,6,7,8,10,12];   // 3/8" carriage bolts as a home center stocks them (HARDWARE.bolt)
const BOLT_WASHER=1/16,BOLT_NUT=21/64,BOLT_PAST=1/4;     // a flat washer, a nut, and two threads past it
const BOLT_RADIUS=3/16;                                  // a 3/8" bolt
const WALL_SCREW_FROM_CROSS=.75;                         // a wall screw keeps this far from a cross piece (the rail's screws are there)
const WALL_SCREW_FROM_JOINT=2;                           // ... and from the end of a rail piece

/* the shortest stocked bolt for a stack of wood this thick, with its washer, nut and two threads past the nut */
const boltLengthFor=grip=>RACK_BOLT_LENGTHS.find(l=>l>=grip+BOLT_WASHER+BOLT_NUT+BOLT_PAST-1e-6)||0;

/* ---------- the screws into the wall studs ---------- */
/* x stretches [a, b] of one section's top back rail (from the section's left end) where no wall screw may go:
   the cross pieces of the top frame (the rail is screwed into their ends) and the ends of rail pieces. A back
   brace lies behind the rail, in the gap a wall screw crosses anyway: a screw that meets one goes through it too
   (the wall step says to keep it 1" from the brace's own screws). */
function wallScrewKeepOut(pl,m,rail,room){
  const lay=rackLayout(pl,m),out=[],from=room===undefined?WALL_SCREW_FROM_CROSS:room;
  for(const x of lay.cross)out.push([x-from,x+1.5+from]);
  for(const x of lay.railJoints)out.push([x-WALL_SCREW_FROM_JOINT,x+WALL_SCREW_FROM_JOINT]);
  return out;
}
/* The screws for one section, studs 16" apart from `offset` (from the left end of the rack): the fewest that
   leave no point of the section more than WALL_SCREW_RULES.reach from a screw (each next one at the furthest stud
   within WALL_SCREW_RULES.every of the last), then more until there are `need`, then more while a pull somewhere
   along the top asks more of one screw than it holds (weakest(places) gives wallScrewWorst for them: a pull near
   an end is taken mostly by the end screws). A stud that has no room (keepOut) is skipped. Two screws share a
   stud, one above the other, only where that helps more than another stud or there are no more studs.
   null: no way. */
function pickStuds(from,to,railFrom,railTo,offset,keepOut,need,canStack,weakest){
  // (1/2" inside the reach, for the thin side panels of a cabinet base, which are part of the section too)
  const R=WALL_SCREW_RULES,reach=R.reach-.5,studs=[];
  for(let x=offset+Math.ceil((railFrom+.75-offset)/R.studs-1e-9)*R.studs;x<=railTo-.75+1e-9;x+=R.studs){
    if(!keepOut.some(([a,b])=>x>a-1e-9&&x<b+1e-9))studs.push(r16(x));
  }
  if(!studs.length)return null;
  const chosen=[];
  let last=null;
  for(let guard=0;guard<200;guard++){
    const limit=last===null?from+reach:last+R.every;
    const next=studs.filter(x=>x<=limit+1e-6&&(last===null||x>last+1e-6)).pop();
    if(next===undefined)return null;
    chosen.push(next);
    last=next;
    if(to-last<=reach+1e-6)break;
  }
  if(to-last>reach+1e-6)return null;
  // more, if the pull needs more: the stud furthest from those already chosen, then two to a stud
  const places=chosen.map(x=>({x,stack:1}));
  while(places.length<need){
    const free=studs.filter(x=>!places.some(p=>p.x===x));
    if(free.length){
      const far=free.reduce((best,x)=>{const d=Math.min(...places.map(p=>Math.abs(p.x-x)));return d>best.d?{x,d}:best;},{x:free[0],d:-1});
      places.push({x:far.x,stack:1});
      continue;
    }
    if(!canStack)return null;
    const single=places.find(p=>p.stack===1);
    if(!single)return null;
    single.stack=2;
    places.push({x:single.x,stack:2,second:true});
  }
  // more while one screw is too weak for a pull near it: try a screw into the free stud nearest that pull, and a
  // second one into the stud of the screw worst off, and keep whichever leaves the worst screw better off
  const withStack=(list,x)=>list.map(p=>p.x===x?{...p,stack:2}:p).concat([{x,stack:2,second:true}]);
  for(let guard=0;guard<80;guard++){
    const worst=weakest(places);
    if(worst.ratio<=1+1e-6)break;
    const tries=[];
    const free=studs.filter(x=>!places.some(p=>p.x===x));
    if(free.length){
      const nearest=free.reduce((best,x)=>Math.abs(x-worst.at)<Math.abs(best-worst.at)?x:best,free[0]);
      tries.push(places.concat([{x:nearest,stack:1}]));
    }
    const single=canStack&&places.find(p=>p.x===worst.x&&p.stack===1);
    if(single)tries.push(withStack(places,single.x));
    if(!tries.length)return null;
    const scored=tries.map(list=>({list,ratio:weakest(list).ratio})).sort((a,b)=>a.ratio-b.ratio);
    places.length=0;
    places.push(...scored[0].list);
  }
  if(weakest(places).ratio>1+1e-6)return null;
  return places.sort((a,b)=>a.x-b.x||(a.second?1:-1));
}
const wallScrewMemo=new WeakMap();
function rackWallScrewPlan(pl,gap){
  if(!pl||!pl.wall)return{screws:[],need:[],studs:0};
  const kept=wallScrewMemo.get(pl);
  if(kept&&kept.gap===gap)return kept.plan;
  const top=pl.rows[pl.n-1],doubled=!!top.doubled;
  // the back rail of the top frame: the screw goes in from its front face, through it (both rails when they are
  // doubled), across the gap behind it and into the wall
  const backZ=doubled?0:top.inset,front=backZ+(doubled?3:1.5),through=front-backZ,behind=gap+backZ;
  const rail={y:top.y,h:pl.rh};
  // The screw is lined up between the back rail and the front rail of the top frame and driven with a right-angle
  // attachment. Where a screw long enough does not fit there (a shallow rack, or a top frame set in from the back),
  // a 3/4" access hole is drilled through the front rail in line with each screw and the screw is put in and driven
  // through it with a long driver bit (access: the wall step says so). A shorter screw that fits is never used
  // instead: it would hold too little.
  const frontRailBack=pl.D-(doubled?0:top.inset)-(doubled?3:1.5),room=frontRailBack-front-RIGHT_ANGLE_HEAD;
  const full=wallScrewLength(through,behind),access=full>room+1e-6;
  const len=full;
  // how far its thread reaches into the stud, and what one screw is counted for (WALL_SCREW_RULES, wallScrewHold)
  const into=r16(len-through-behind-DRYWALL),hold=wallScrewHold(into);
  const topOfRack=top.y+pl.rb;              // the top of the top deck, where a pull is taken
  // the height of a screw: the middle of the rail, or a third and two thirds up it when two share a stud
  const screwY=place=>place.stack===2?rail.y+pl.rh*(place.second?1:2)/3:rail.y+pl.rh/2;
  const sections=[];
  let ox=0;
  for(const m of pl.mods){
    // (a second, tighter set: a screw 3/8" from a cross piece, for a section where the usual 3/4" leaves no stud)
    sections.push({m,ox,keep:wallScrewKeepOut(pl,m,rail).map(([a,b])=>[ox+a,ox+b]),tight:wallScrewKeepOut(pl,m,rail,.375).map(([a,b])=>[ox+a,ox+b])});
    ox+=m.W;
  }
  const canStack=pl.rh>=3.5-1e-6;
  // The studs are drawn 16" apart, where they let every screw keep clear of the cross pieces and the braces: for one
  // wall that is one spacing along all of it; separate sections are each set against the wall where they go, so
  // each gets its own (the step tells the builder to use the studs that are really there). Fewest screws first.
  const need=wallScrewsNeeded(topOfRack,rail.y+pl.rh/(canStack?3:2));
  const picks=[];
  for(const s of sections){
    // the screw worst off under a pull anywhere along this section's top (its thin side panels, 1/4" outside its
    // posts on a cabinet base, are taken as part of it), as the structural check works it out
    const weakest=places=>wallScrewWorst(places.map(place=>({x:place.x,y:screwY(place),hold})),s.ox-.25,s.ox+s.m.W+.25,topOfRack);
    let best=null;
    for(const keep of[s.keep,s.tight]){
      for(let offset=0;offset<WALL_SCREW_RULES.studs-1e-9;offset+=.25){
        const got=pickStuds(s.ox,s.ox+s.m.W,s.ox+1.5,s.ox+s.m.W-1.5,offset,keep,need,canStack,weakest);
        if(got&&(!best||got.length<best.length))best=got;
      }
      if(best)break;
    }
    picks.push({got:best||[],need});
  }
  const plan={screws:[],need:[],studs:WALL_SCREW_RULES.studs,len,through,behind,into,hold,access};
  picks.forEach(({got,need},section)=>{
    plan.need.push(need);
    for(const place of got)plan.screws.push({x:place.x,y:r16(screwY(place)),z:front,len,through,behind,into,hold,section});
  });
  wallScrewMemo.set(pl,{gap,plan});
  return plan;
}
/* The plan's screws as the structural check takes them: {on: the rail piece the head is on, at}. x0 and z0 are
   where the left end and the back of the rack are among these parts (a design added beside another is moved). */
function wallScrewsInParts(list,parts){
  const posts=parts.filter(p=>p.name==='Post');
  if(!posts.length)return[];
  const x0=Math.min(...posts.map(p=>p.pos[0])),z0=Math.min(...posts.map(p=>p.pos[2]));
  const rails=parts.filter(p=>p.name==='Rail');
  const out=[];
  for(const s of list){
    const at=[x0+s.x,s.y,z0+s.z];
    // the rail whose front face the head is on
    const on=rails.find(p=>{const b=box(p);return at[0]>=b.lo[0]-1e-6&&at[0]<=b.hi[0]+1e-6&&at[1]>=b.lo[1]-1e-6&&at[1]<=b.hi[1]+1e-6&&Math.abs(b.hi[2]-at[2])<.02;});
    if(on)out.push({on,at,len:s.len,into:s.into,hold:s.hold,section:s.section});
  }
  return out;
}

/* ---------- the bolts between separate sections ---------- */
/* The bolts of one plan: at every line where two sections meet, in the back pair of posts and in the front pair,
   one at every frame. Each is placed in the plan's coordinates; `zone` is 'frame' (through the end cross pieces,
   level with the frame) or 'room' (through the end uprights, in the hand room above the tanks). */
const rackBoltMemo=new WeakMap();
function rackBoltPlan(pl){
  if(!pl||pl.mods.length<2)return[];
  if(rackBoltMemo.has(pl))return rackBoltMemo.get(pl);
  const bolts=[],{D,ud,su,rh,rb}=pl;
  let ox=0;
  for(let k=0;k<pl.mods.length-1;k++){
    const left=pl.mods[k],right=pl.mods[k+1];
    ox+=left.W;
    const J=ox;   // where the two posts meet
    // the room inside each section beside the end cross piece: to the next cross piece of its frame
    const roomBeside=(m,atRight)=>{
      const cross=rackLayout(pl,m).cross.slice().sort((a,b)=>a-b);
      return atRight?(m.W-3)-(cross[cross.length-2]+1.5):cross[1]-3;
    };
    const roomLeft=roomBeside(left,true),roomRight=roomBeside(right,false);
    for(const back of[true,false]){
      pl.rows.forEach((row,i)=>{
        const frameIn=row.doubled?3:1.5+row.inset;
        const postZ=back?[0,ud]:[D-ud,D],crossZ=back?[frameIn,ud]:[D-ud,D-frameIn];
        // level with the frame, through the end cross pieces: wide enough beside the post, and room to slide it in
        const crossWide=crossZ[1]-crossZ[0];
        const grip=1.5*4,len=boltLengthFor(grip);
        if(crossWide>=1.25-1e-6&&Math.max(roomLeft,roomRight)>=len+.5){
          bolts.push({x:J,y:r16(row.y+rh/2),z:r16((crossZ[0]+crossZ[1])/2),zRange:crossZ,yRange:[row.y,row.y+rh],
            from:J-3,to:J+3,grip,len,row:i,zone:'frame',back});
          return;
        }
        // in the hand room above the tanks of this row, through the end uprights (there is a frame above)
        if(i===pl.n-1)return;
        const above=pl.rows[i+1],floorOfRoom=row.y+rb+(row.store?0:row.th),room=above.y-floorOfRoom;
        if(room<1.5-1e-6)return;
        const gripUp=3+2*su,lenUp=boltLengthFor(gripUp);
        if(!lenUp)return;
        bolts.push({x:J,y:r16(floorOfRoom+room/2),z:r16((postZ[0]+postZ[1])/2),zRange:postZ,yRange:[floorOfRoom,above.y],
          from:J-1.5-su,to:J+1.5+su,grip:gripUp,len:lenUp,row:i,zone:'room',back});
      });
    }
  }
  rackBoltMemo.set(pl,bolts);
  return bolts;
}

/* The bolt for the same joint between sections one level lower: through the end uprights in the room just under the
   frame of `bolt` (above the tanks or the storage of the row below it), 1 1/2" under that frame, as rackBoltPlan
   gives a bolt of the 'room' zone. null for the bottom frame, or when that room is too low. placeRackHardware uses
   it when the frame itself has no place for the bolt that clears the screws of every style. */
function boltUnderFrame(pl,bolt){
  const i=bolt.row;
  if(!(i>0))return null;
  const below=pl.rows[i-1],row=pl.rows[i],{D,ud,su,rb}=pl;
  const floorOfRoom=below.y+rb+(below.store?0:below.th),top=row.y;
  if(top-floorOfRoom<1.5-1e-6)return null;
  const postZ=bolt.back?[0,ud]:[D-ud,D];
  const grip=3+2*su,len=boltLengthFor(grip);
  if(!len)return null;
  return{x:bolt.x,y:r16(Math.max(floorOfRoom+(top-floorOfRoom)/2,top-1.5)),z:r16((postZ[0]+postZ[1])/2),zRange:postZ,yRange:[floorOfRoom,top],
    from:bolt.x-1.5-su,to:bolt.x+1.5+su,grip,len,row:i-1,zone:'room',back:bolt.back};
}
/* ---------- putting them into the design ---------- */
/* the fasteners of the design that lie in any of these pieces, as stretches (fastenerParts, js/fastenerroom.js) */
function fastenerStretchesIn(pieces){
  const wanted=new Set(pieces),out=[];
  for(const{f}of fastenersOfDesign()){
    const placed=fastenerInWorld(f);
    for(const part of fastenerParts(placed))if(part.pieces.some(p=>wanted.has(p)))out.push(part);
  }
  return out;
}
/* The same in every build style: the style changes which fastener a joint gets and where the corner settler puts
   its screws, and a bolt placed once must clear them whichever style is picked later. */
function fastenerStretchesInEveryStyle(pieces){
  const kept=look().style,out=[];
  try{
    for(const style of Object.keys(STYLES)){
      look().style=style;
      connCache=null;
      if(typeof layoutCarry!=='undefined')layoutCarry.clear();
      out.push(...fastenerStretchesIn(pieces));
    }
  }finally{
    look().style=kept;
    connCache=null;
    if(typeof layoutCarry!=='undefined')layoutCarry.clear();
  }
  return out;
}
/* is a straight stretch (from, along dir, len, radius) clear of these fastener stretches by FASTENER_ROOM? */
const clearOfFasteners=(from,dir,len,radius,stretches)=>stretches.every(part=>
  stretchGap(from,dir,len,part.from,part.dir,part.len)-radius-part.radius>=FASTENER_ROOM-1e-6);
/* the wooden piece of these parts that holds this point */
const pieceAt=(parts,at)=>parts.find(p=>{if(isProp(p))return false;const b=box(p);return[0,1,2].every(k=>at[k]>b.lo[k]+1e-6&&at[k]<b.hi[k]-1e-6);});
/* Places the wall screws and the bolts of a placed rack (parts: its pieces, already in the design). args: the
   plan's arguments (the rack's form values, cabArgs or standArgs of them); gap: how far its back stands off the
   wall. Every bolt is moved within its room, nearest first, until it clears every screw already in the pieces it
   passes through (rackHardwareClear checks the same). Returns the items added. */
function placeRackHardware(args,gap,parts){
  const pl=rackPlan(args);
  if(!pl)return[];
  const posts=parts.filter(p=>p.name==='Post');
  if(!posts.length)return[];
  const x0=Math.min(...posts.map(p=>p.pos[0])),z0=Math.min(...posts.map(p=>p.pos[2]));
  const added=[];
  connCache=null;   // the joints as the preset names them (storeNamedJoints ran just before)
  const railStretches=new Map();   // the fasteners of every style in each rail a wall screw goes through
  const plan=rackWallScrewPlan(pl,gap),screws=wallScrewsInParts(plan.screws,parts),topOfRack=pl.rows[pl.n-1].y+pl.rb;
  // a section's screws still hold a pull anywhere along its top (wallScrewWorst), as they are now
  const sectionStart=i=>x0+pl.mods.slice(0,i).reduce((sum,m)=>sum+m.W,0);
  const sectionHolds=i=>wallScrewWorst(screws.filter(s=>s.section===i).map(s=>({x:s.at[0],y:s.at[1],hold:s.hold})),
    sectionStart(i)-.25,sectionStart(i)+pl.mods[i].W+.25,topOfRack).ratio<=1+1e-6;
  for(const s of screws){
    const host=s.on,mid=pieceMiddle(host);
    // Moved, if it must, up to 3/8" along the rail (it stays in the middle 3/4" of a stud 1 1/2" wide) and 1/8"
    // up or down, nearest first, until it clears every fastener of every style in the rail (a pocket hole of the
    // deck in Fine furniture can sit where a screw drawn a third of the way down the rail would go), and only
    // where its section still holds a pull anywhere along its top.
    if(!railStretches.has(host))railStretches.set(host,fastenerStretchesInEveryStyle([host]));
    const stretches=railStretches.get(host),b=box(host),drawn=s.at.slice();
    const nudges=[];
    for(const dx of[0,.125,-.125,.25,-.25,.375,-.375])for(const dy of[0,.125,-.125])nudges.push([dx,dy]);
    nudges.sort((p,q)=>Math.hypot(...p)-Math.hypot(...q));
    const fits=([dx,dy])=>{
      const at=[drawn[0]+dx,drawn[1]+dy,drawn[2]];
      if(at[1]-.5<b.lo[1]-1e-6||at[1]+.5>b.hi[1]+1e-6||!clearOfFasteners(at,[0,0,-1],s.len,.125,stretches))return false;
      s.at=at;
      return sectionHolds(s.section);
    };
    if(!nudges.find(fits))s.at=drawn;
    // geo.into: how far its thread reaches into the stud, which the structural check counts it for (wallScrewsPlaced)
    added.push(addHardware({kind:'wallscrew',size:s.len,on:host.id,to:null,at:[s.at[0]-mid.x,s.at[1]-mid.y,s.at[2]-mid.z].map(v=>r16(v)),n:[0,0,1],u:[1,0,0],geo:{into:s.into}}));
  }
  // Where a bolt goes: the nearest place to the middle of its room that clears every fastener, of every style, in
  // the pieces it passes through. null when there is no such place (or the pieces are not there).
  const boltSpot=bolt=>{
    const headAt=[x0+bolt.from,bolt.y,z0+bolt.z];
    const head=pieceAt(parts,[headAt[0]+.2,headAt[1],headAt[2]]),nut=pieceAt(parts,[x0+bolt.to-.2,bolt.y,z0+bolt.z]);
    if(!head||!nut)return null;
    const stack=[head,nut,...parts.filter(p=>p.name==='Post'&&Math.abs(p.pos[0]+1.5-(x0+bolt.x))<.02||p.name==='Post'&&Math.abs(p.pos[0]-(x0+bolt.x))<.02)
      .filter(p=>{const b=box(p);return z0+bolt.z>b.lo[2]&&z0+bolt.z<b.hi[2];})];
    const stretches=fastenerStretchesInEveryStyle(stack);
    const ys=[],zs=[];
    for(let d=0;d<=3;d+=.125){ys.push(bolt.y+d,bolt.y-d);zs.push(bolt.z+d,bolt.z-d);}
    const inY=y=>y-BOLT_RADIUS-.25>=bolt.yRange[0]-1e-6&&y+BOLT_RADIUS+.25<=bolt.yRange[1]+1e-6;
    const inZ=z=>z-BOLT_RADIUS-.25>=bolt.zRange[0]-1e-6&&z+BOLT_RADIUS+.25<=bolt.zRange[1]+1e-6;
    for(const y of ys){
      if(!inY(y))continue;
      for(const z of zs){
        if(!inZ(z))continue;
        if(clearOfFasteners([x0+bolt.from,y,z0+z],[1,0,0],bolt.grip,BOLT_RADIUS,stretches))return{bolt,head,nut,spot:{y,z}};
      }
    }
    return{bolt,head,nut,spot:null};
  };
  for(const planned of rackBoltPlan(pl)){
    let found=boltSpot(planned);
    if(!found)continue;
    // A frame with no room for it in every style (the end cross piece of a cabinet stand's top frame in Fine
    // furniture: its pocket screws into the rails, the pocket screw of the upright under it and the bolt do not all
    // fit in 3 1/2"): the bolt goes through the end uprights just under that frame instead, when it is the same
    // length, so the list still buys what is drawn.
    if(!found.spot&&planned.zone==='frame'){
      const under=boltUnderFrame(pl,planned);
      const there=under&&under.len===planned.len?boltSpot(under):null;
      if(there&&there.spot)found=there;
    }
    const{bolt,head,nut}=found,spot=found.spot||{y:bolt.y,z:bolt.z};
    const mid=pieceMiddle(head);
    added.push(addHardware({kind:'bolt',size:bolt.len,on:head.id,to:nut.id,
      at:[x0+bolt.from-mid.x,spot.y-mid.y,z0+spot.z-mid.z].map(v=>r16(v)),n:[-1,0,0],u:[0,0,1],geo:{grip:bolt.grip}}));
  }
  // the layouts worked out above did not know the bolts: rows of pocket holes keep clear of them (boltSpansAcross)
  // and the settled screws of their holes (hardwareHoles, js/fasteners.js), so they are worked out again
  connCache=null;
  if(typeof layoutCarry!=='undefined')layoutCarry.clear();
  return added;
}

/* An access hole (ACCESS_HOLE across, in the middle of the height of the front rail of the top frame, in line with
   a wall screw that does not fit between the rails): what it leaves of that rail. Bending: the hole is where the
   wood does least, so the rail keeps 1 - (hole / height)^3 of its stiffness and strength. Shear: the wood above and
   below the hole carries it, (height - hole) / height of the rail's depth, checked against the tanks on that frame
   with 2/3 × Fv × width × the wood left (Fv 135 psi for spruce-pine-fir No. 2, the NDS supplement). */
const ACCESS_HOLE=.75,RAIL_FV=135;
function accessHoleLeaves(pl){
  const h=pl.rh,top=pl.rows[pl.n-1];
  const shearAt=r=>(r&&r.w?r.w:0)*pl.span/2;                 // lb at the end of a rail span (w: lb per inch on each rail)
  const shearAllowed=2/3*RAIL_FV*1.5*(h-ACCESS_HOLE);
  return{bending:1-Math.pow(ACCESS_HOLE/h,3),shear:(h-ACCESS_HOLE)/h,shearLoad:shearAt(top),shearAllowed};
}
/* ---------- in words ---------- */
/* '3 in all', or '3 for each of the 2 sections' */
function wallScrewWords(pl,gap,thing){
  const plan=rackWallScrewPlan(pl,gap);
  if(!plan.screws.length)return'';
  const sections=pl.mods.length,per=pl.mods.map((m,i)=>plan.screws.filter(s=>s.section===i).length);
  const count=sections>1?(per.every(n=>n===per[0])?`${per[0]} for each of the ${sections} sections, ${plan.screws.length} in all`:`${listWords(per.map(String))} for the ${sections} sections, ${plan.screws.length} in all`)
    :`${plan.screws.length} in all`;
  const stacked=new Set(plan.screws.map(s=>s.section+'|'+s.x)).size<plan.screws.length;
  return`structural screws into the studs along the back rail of the top frame, none more than ${ruleLength(WALL_SCREW_RULES.every)} apart and enough near each end to take a pull there${stacked?' (two into one stud, one above the other, where that holds more)':''}: ${count}`;
}
/* the reason, in one sentence, for the notes and the steps */
function wallScrewWhy(pl,gap){
  const plan=rackWallScrewPlan(pl,gap),R=WALL_SCREW_RULES;
  return`That is enough to hold a pull of ${R.pull} lb anywhere along the top (a person pulling on it or climbing it) with a factor of safety of ${R.safety}, at about ${plan.hold} lb a screw with ${fmt(plan.into>=R.bite?R.bite:plan.into)} of thread in the stud; a pull near an end is taken mostly by the screws near that end, so the ends decide how many. No point of the top is more than ${ruleLength(R.reach)} from a screw. None goes at mid height: a screw at the top holds best against tipping.`;
}
/* Check my design (js/checkui.js): the screws into the wall studs that the structural check counted
   (facts.wallScrews, js/verify.js), how many each part has and needs, and where they are along it. */
function wallScrewFactWords(facts){
  const R=WALL_SCREW_RULES,parts=facts.parts.filter(part=>part.count);
  const one=part=>`${part.count} screw${part.count>1?'s':''} into the wall studs at ${listWords(part.xs.map(x=>fmt(r16(x-part.from))))} from its left end (${part.need} needed)`;
  const each=parts.length>1?parts.map((part,i)=>`section ${i+1}: ${one(part)}`).join('; '):one(parts[0]||{count:0,xs:[],need:0,from:0});
  const worst=Math.max(0,...parts.map(part=>part.worst&&Number.isFinite(part.worst.ratio)?part.worst.ratio:0));
  return`${each}. One about every ${ruleLength(R.every)} along the top, enough for a pull of ${R.pull} lb anywhere along the top with a factor of safety of ${R.safety} (for the worst place to pull, the screw that takes the most is at ${Math.round(worst*100)}% of what it is counted for).`;
}
/* one line under the wall step (HARDWARE.wallscrew.line): how many, how long, through what, and where */
function wallScrewStepLine(group,hosts,letterOf){
  const list=group.items,size=list[0].size;
  // the places along the rail, a screw moved a little to clear a fastener (placeRackHardware) counted at its stud
  const xs=[];
  for(const x of list.map(item=>{const p=hardwarePose(item);return p?r16(p.at.x):0;}).sort((a,b)=>a-b))if(!xs.some(seen=>Math.abs(seen-x)<=.5))xs.push(x);
  const atPlace=x=>list.filter(item=>{const p=hardwarePose(item);return p&&Math.abs(p.at.x-x)<=.5;}).length;
  const left=Math.min(...S.parts.filter(p=>!isProp(p)).map(p=>box(p).lo[0]));
  const leftEnd=wallScrewLeftEnd();
  const host=hosts[0],stacked=xs.length<list.length;
  // how high each one is on its rail, from the rail's bottom edge (the middle of the rail, or two one above the other)
  const heights=[...new Set(list.map(item=>{const p=hardwarePose(item),on=byId(item.on);return p&&on?r16(p.at.y-box(on).lo[1]):null;}).filter(v=>v!==null))].sort((a,b)=>a-b);
  return`${list.length} structural screw${list.length>1?'s':''} for the wall studs, ${fmt(size)}, through the back ${pluralName(host.name).toLowerCase()} of the top frame${letterOf(host)?` (${letterOf(host)})`:''} into the studs, at about ${listWords(xs.map(x=>fmt(r16(x-left))))} from the left end (the outside face of the ${leftEnd.name==='Post'?'left end posts':'left '+leftEnd.name.toLowerCase()}), ${listWords(heights.map(fmt))} up from the bottom edge of the rail`+
    `${stacked?` (two into the stud at ${listWords(xs.filter(x=>atPlace(x)>1).map(x=>fmt(r16(x-left))))}, one above the other: a pull near an end is taken mostly by the screws near it)`:''}. The program draws the studs ${fmt(WALL_SCREW_RULES.studs)} apart: use the studs that are really there, with each end screw no further from its end than shown, no screw more than ${ruleLength(WALL_SCREW_RULES.every)} from the next and none more than ${ruleLength(WALL_SCREW_RULES.reach)} from an end. Keep each one at least ${fmt(WALL_SCREW_FROM_CROSS)} from a cross piece.`;
}
/* one line under the step that joins the sections (HARDWARE.bolt.line) */
function boltStepLine(group,hosts,letterOf){
  const list=group.items,size=list[0].size,grip=(list[0].geo&&list[0].geo.grip)||0;
  const host=hosts[0],other=group.other;
  // across the post: from the back face of the post each bolt goes through first. A front post is marked from its
  // own back face too, so the back posts and the front posts each get their own number (a distance from the back
  // of the rack would land off a front post).
  const backOfRack=Math.min(...S.parts.filter(q=>q.name==='Post').map(q=>box(q).lo[2]));
  const across={back:new Set(),front:new Set()};
  for(const item of list){
    const p=hardwarePose(item),post=boltPosts(item)[0];
    if(!p||!post)continue;
    const b=box(post);
    across[Math.abs(b.lo[2]-backOfRack)<.02?'back':'front'].add(fmt(r16(p.at.z-b.lo[2])));
  }
  const acrossWords=[across.back.size?`${listWords([...across.back])} from the back face of each back post`:'',
    across.front.size?`${listWords([...across.front])} from the back face of each front post`:''].filter(Boolean).join(' and ');
  return`${list.length} carriage bolt${list.length>1?'s':''}, 3/8" × ${fmt(size)}, each with a flat washer and a nut: where two sections meet, ${host.name==='Upright'?'clear of the frames (just under a frame that has no room for them, or in the hand room above the tanks),':'level with the frames,'} one in the back pair of posts and one in the front pair, through the ${host.name.toLowerCase()} of one section, the two posts and the ${(other?other.name:host.name).toLowerCase()} of the next (${fmt(grip)} of wood in all), at about ${listWords([...new Set(list.map(item=>{const p=hardwarePose(item);return p?fmt(r16(p.at.y)):'';}))])} up from the floor and ${acrossWords}. Drill the 7/16" holes from the outside of each end post before the sections stand together, and pull each bolt in by tightening its nut with a 9/16" wrench. They come apart again by undoing the nuts.`;
}

/* ---------- close-ups of the wall screws and the bolts ----------
   Each line of hardware gets a pair of pictures in its step (js/steppictures.js): a 3D close-up of how it goes on,
   and a flat marking view of where (js/markingview.js). These two give both for the wall screws and the section
   bolts, with only the numbers their lines say (wallScrewStepLine, boltStepLine), so the self-checks
   markingViewsMeasureTrue and stepPicturesShowTheWork hold them to their words. */

/* the piece at the left end of the design: what the wall screw line measures from. Of the pieces flush with the
   left end (a post, and the decks that run out over it) the post, else the tallest. */
function wallScrewLeftEnd(){
  const wood=S.parts.filter(p=>!isProp(p));
  if(!wood.length)return null;
  const left=Math.min(...wood.map(p=>box(p).lo[0]));
  const flush=wood.filter(p=>box(p).lo[0]<left+.02);
  const tall=p=>box(p).hi[1]-box(p).lo[1];
  return flush.find(p=>p.name==='Post')||flush.sort((a,b)=>tall(b)-tall(a))[0];
}
/* the posts a section bolt passes through, in the order it passes them (its head is at the low x end) */
function boltPosts(item){
  const pose=hardwarePose(item);
  if(!pose)return[];
  const at=pose.at,grip=(item.geo&&item.geo.grip)||item.size;
  return S.parts.filter(p=>{
    if(p.name!=='Post'||isProp(p))return false;
    const b=box(p);
    return at.y>b.lo[1]&&at.y<b.hi[1]&&at.z>b.lo[2]&&at.z<b.hi[2]&&b.hi[0]>at.x+1e-6&&b.lo[0]<at.x+grip-1e-6;
  }).sort((a,b)=>box(a).lo[0]-box(b).lo[0]);
}
/* The one wall screw, or pair one above the other, nearest the left end, and the rail it goes through: what the
   close-up and the marking view show (the others are at the places the line gives, the same way). */
function wallScrewsShown(row){
  const placed=row.items.map(item=>({item,pose:hardwarePose(item),on:byId(item.on)})).filter(one=>one.pose&&one.on);
  if(!placed.length)return null;
  const firstX=Math.min(...placed.map(one=>one.pose.at.x));
  const shown=placed.filter(one=>Math.abs(one.pose.at.x-firstX)<=.5);
  return{rail:shown[0].on,shown,others:placed.length-shown.length};
}
/* the 3D close-up (hardwareCloseupPlan, js/steppictures.js), or null */
function rackHardwareCloseupPlan(row){
  const letterOf=buildPlan().letterOf;
  if(row.kind==='wallscrew'){
    const what=wallScrewsShown(row);
    if(!what)return null;
    const rail=what.rail,b=box(rail),first=what.shown[0].pose.at;
    // seen from inside the rack, a little from the left and from above: the heads are on the inside face
    const inside=b.hi[2],bottom=[first.x+1.5,b.lo[1],inside];
    const dims=what.shown.map(one=>({from:bottom,to:[first.x+1.5,one.pose.at.y,inside],text:fmt(r16(one.pose.at.y-b.lo[1]))}));
    return{show:[rail.id],items:what.shown.map(one=>one.item.id),seen:`the inside face of the back ${rail.name.toLowerCase()} of the top frame`,
      eye:[-.35,.45,1],dims,circles:[],extra:[[first.x-4,b.lo[1],inside],[first.x+4,b.hi[1],inside-4]],
      labels:[{at:[first.x-3,(b.lo[1]+b.hi[1])/2,inside],lines:[{text:pieceLabel(rail,letterOf),size:30,bold:true},{text:'its inside face',size:23}]},
        {at:[first.x,first.y,first.z-3],lines:[{text:'Wall screw',size:27,bold:true},{text:'on through to the stud',size:23}]}]};
  }
  if(row.kind==='bolt'){
    // the lowest bolt of the first joint between sections: both end posts and the pieces the bolt clamps
    const item=row.items.slice().sort((a,b)=>{const p=hardwarePose(a).at,q=hardwarePose(b).at;return p.x-q.x||p.y-q.y||p.z-q.z;})[0];
    const pose=hardwarePose(item),posts=boltPosts(item),head=byId(item.on),nut=byId(item.to);
    if(!pose||!posts.length||!head||!nut)return null;
    const post=posts[0],b=box(post),at=pose.at;
    const outside=b.hi[0];                                   // the face of the post that meets the next section
    const dims=[{from:[outside,b.lo[1],at.z],to:[outside,at.y,at.z],text:fmt(r16(at.y-b.lo[1]))},
      {from:[outside,at.y,b.lo[2]],to:[outside,at.y,at.z],text:fmt(r16(at.z-b.lo[2]))}];
    return{show:[head.id,...posts.map(p=>p.id),nut.id],items:[item.id],seen:'the two end posts where the sections meet',
      eye:[.8,.4,.8],dims,circles:[],extra:[[at.x-1,at.y+3,at.z],[at.x+item.size+1,at.y-3,at.z]],
      labels:[{at:[outside,Math.min(b.hi[1]-1,at.y+4),b.hi[2]],lines:[{text:pieceLabel(post,letterOf),size:30,bold:true},{text:'end post of the first section',size:23}]},
        {at:[at.x,at.y,at.z],lines:[{text:'Carriage bolt',size:27,bold:true},{text:'round head here, washer and nut on the far side',size:23}]}]};
  }
  return null;
}
/* the marking view (hardwareMarkPlan, js/markingview.js), or null */
function rackHardwareMarkPlan(row,letterOf){
  if(row.kind==='wallscrew'){
    const what=wallScrewsShown(row),left=wallScrewLeftEnd();
    if(!what||!left)return null;
    const rail=what.rail,b=box(rail);
    // the inside face of the rail, seen from the front (from inside the rack): left stays left
    const frame=markingFrame(2,-1,rail);
    const plan=newMarkPlan(frame,rail,letterOf,'Where the wall screws go');
    plan.subtitle=`${pieceLabel(rail,letterOf)}, inside face, seen from the front (from inside the rack)`;
    if(left!==rail)addOther(plan,left,b.hi[2],letterOf);
    const AV=frame.viewAxis(0),HV=frame.viewAxis(1);
    what.shown.forEach((one,index)=>{
      const p=[one.pose.at.x,one.pose.at.y,b.hi[2]];
      plan.points.push({at:frame.toView(p),kind:'cross',r:0});
      const up=one.pose.at.y-b.lo[1];
      addDim(plan,edgeFeature(frame,rail,1,false),pointFeature(frame,p),HV,markText(up),up,frame.screenSide(0,true),index);
    });
    const along=what.shown[0].pose.at.x-box(left).lo[0];
    addDim(plan,edgeFeature(frame,left,0,false),pointFeature(frame,[what.shown[0].pose.at.x,what.shown[0].pose.at.y,b.hi[2]]),AV,markText(along),along,'bottom',0);
    plan.legend.unshift({kind:'cross',text:'wall screw: where its head goes'});
    plan.notes.push(`Measured along from the left end of the ${left.name==='Post'?'rack (the outside face of the left end post)':'design'}, as the studs are.`+
      (what.others?` The other ${what.others} screw${what.others>1?'s go':' goes'} in the same way at the places the line gives.`:''));
    plan.words=row.line;
    addRefs(plan,letterOf);
    return plan;
  }
  if(row.kind==='bolt'){
    const close=rackHardwareCloseupPlan(row);
    if(!close)return null;
    const item=row.items.find(one=>close.items.includes(one.id)),posts=boltPosts(item),post=posts[0],b=box(post);
    // the face of the end post that meets the next section, where the holes are drilled from, seen square on
    const frame=markingFrame(0,-1,post);
    const plan=newMarkPlan(frame,post,letterOf,'Where to drill the bolt holes');
    plan.subtitle=`${pieceLabel(post,letterOf)}, the face that meets the next section, seen from that side`;
    // every bolt through this post, measured up from its bottom end (the floor) and across from its back face
    const through=row.items.filter(one=>boltPosts(one)[0]===post).map(one=>hardwarePose(one).at).sort((p,q)=>p.y-q.y);
    const HV=frame.viewAxis(1),ZV=frame.viewAxis(2);
    through.forEach((at,index)=>{
      const p=[b.hi[0],at.y,at.z];
      plan.points.push({at:frame.toView(p),kind:'hole',r:7/32});
      const up=at.y-b.lo[1];
      addDim(plan,edgeFeature(frame,post,1,false),pointFeature(frame,p),HV,markText(up),up,frame.screenSide(2,true),index);
    });
    const first=through[0],across=first.z-b.lo[2];
    addDim(plan,edgeFeature(frame,post,2,false),pointFeature(frame,[b.hi[0],first.y,first.z]),ZV,markText(across),across,'bottom',0);
    plan.legend.unshift({kind:'hole',text:'7/16" hole for a 3/8" carriage bolt'});
    plan.notes.push('Mark the other end posts the same way, each from its own back face, with the numbers of the line (a front post has its own number). Drill square to the face, from this side.');
    plan.words=row.line;
    addRefs(plan,letterOf);
    return plan;
  }
  return null;
}

/* ---------- self-checks (selfTest runs them) ---------- */
/* The screws into the wall studs. The rack as the form starts (tanks short end out: 55" tall on a base 25" deep)
   may stand free and gets none (it had 16). With the tanks long side out (25" tanks on a base 13" deep, too tall
   to stand free) it gets as many as WALL_SCREW_RULES asks: 4 (two of them into the stud nearest the left end, as
   a pull at an end is taken mostly by the screws near it); a 20 ft wall about one every 4 ft and more near its
   ends; separate sections each their own. The structural check counts them from the model and refuses the rack
   with any one of them taken away; the notes, the wall step, the shopping list and Check my design say the same
   number. */
const WALL_SCREWS_EXPECTED={outward:4,long:[6,8]};
SELFTESTS.push(function wallScrewsAreWorkedOut(problems){
  const say=text=>problems.push('wall screws: '+text);
  const rack=PRESETS.find(p=>p.name==='Fish tank wall / rack');
  if(!rack){say('the Fish tank wall / rack preset is missing');return;}
  const usual=presetDefaults(rack),outward={...usual,orient:'long'},E=WALL_SCREWS_EXPECTED;
  const countOf=vals=>{const pl=rackPlan(vals);return pl?rackWallScrewPlan(pl,rackWallGap(vals,pl)).screws.length:-1;};
  // the rack as the form starts stands free: no screw, nothing on the shopping list, and still clean
  if(rackPlan(usual).wall)say('the default rack should be short enough for its depth to stand free');
  else if(countOf(usual)!==0||rack.hw(usual).some(([label])=>/wall studs/.test(label)))say('a rack that may stand free still gets screws into the wall');
  if(countOf(outward)!==E.outward)say(`the default rack with its tanks long side out gets ${countOf(outward)} screws into the studs, not ${E.outward}`);
  const long={...outward,W:240},longCount=countOf(long);
  if(!(longCount>=E.long[0]&&longCount<=E.long[1]))say(`a 20 ft rack gets ${longCount} screws, not about one every 4 ft and more near the ends`);
  const apart={...outward,build:'sections'},apartPlan=rackPlan(apart),plan=rackWallScrewPlan(apartPlan,rackWallGap(apart,apartPlan));
  if(apartPlan.mods.some((m,i)=>plan.screws.filter(s=>s.section===i).length<2))say('a section of a rack built as separate sections has fewer than two screws of its own');
  for(const vals of[usual,outward,long,apart]){
    const check=checkPreset(rack,vals);
    if(check.problems.length)say(`${JSON.stringify({orient:vals.orient,W:vals.W,build:vals.build})}: the structural check says ${check.problems.map(f=>f.code).join(', ')}`);
  }
  // the structural check counts them from the model: the rack is clean as placed, and refused with one taken away
  placePreset(rack,outward,rack.build(outward),false);
  const placed=hardwareList().filter(item=>item.kind==='wallscrew');
  const n=E.outward;
  if(placed.length!==n)say(`placing the rack puts ${placed.length} screws into the model, not ${n}`);
  const fine=verifyDesign(S.parts,designCheckOptions());
  if(fine.problems.length)say('the placed rack is not clean: '+fine.problems.map(f=>f.code).join(', '));
  if(!fine.facts.wallScrews||fine.facts.wallScrews.count!==n)say(`Check my design does not count the ${n} screws into the wall`);
  if(hardwareTotals(findJoints()).rows.filter(([label])=>/wall studs/.test(label)).reduce((sum,[,count])=>sum+count,0)!==n)say(`the shopping list of the placed rack does not buy ${n} screws for the wall studs`);
  // every one of them is needed: the rack is refused with any one taken out (and put back)
  const kept=JSON.parse(JSON.stringify(hardwareList()));
  for(let i=0;i<placed.length;i++){
    S.hardware=JSON.parse(JSON.stringify(kept));
    removeHardware([placed[i].id]);
    const less=verifyDesign(S.parts,designCheckOptions());
    if(!less.problems.some(f=>f.code==='wall-screws'&&f.level==='stop'))say(`with the screw at ${fmt(r16(hardwarePose(placed[i])?hardwarePose(placed[i]).at.x:0))} taken out, the structural check does not refuse the rack`);
  }
  S.hardware=kept;
  // what the words say: the count in the notes, the wall step and the shopping list before it is placed
  const notes=rackNotes(outward).join(' '),steps=rackSteps(outward,true).map(step=>step.t).join(' ');
  if(!new RegExp(`\\b${n} in all`).test(notes)||!new RegExp(`\\b${n} in all`).test(steps))say(`the notes or the wall step do not say "${n} in all"`);
  const listed=rack.hw(outward).filter(([label])=>/wall studs/.test(label)).reduce((sum,[,count])=>sum+count,0);
  if(listed!==n)say(`the shopping list of the rack buys ${listed} screws for the wall studs`);
  if(/mid height/.test(steps)&&!/None goes at mid height/.test(steps))say('the wall step still asks for screws at mid height');
});
/* A pull anywhere along the top, not only in the middle. Worked by hand first: three screws at 17 1/4", 65 1/4" and
   97 1/4" along a stiff top (the last round's 10 ft rack); their middle is at 59.92", and the squares of their
   distances from it add up to 3242.7. A pull at the left end (59.92" left of the middle) puts on the first screw
   1/3 + 59.92 × 42.67 / 3242.7 = 1.122 times the pull, not 1/3: about 238 lb of a 200 lb pull with the lever of a
   rack 39" high screwed 36 3/4" up. wallScrewWorst must find the same. Then every rack and section the program
   screws to the wall, from the smallest to a 50 ft wall, the tallest narrow rack the form allows (5 gallon tanks
   long side out, the lowest 36" up: 71" tall on 9" deep), separate sections and a cabinet base, holds a pull at
   any point of its top with every screw within what it is counted for, as placed in the model. */
SELFTESTS.push(function wallScrewsHoldAPullAnywhere(problems){
  const say=text=>problems.push('wall screws, a pull anywhere: '+text);
  const R=WALL_SCREW_RULES,hand=1/3+59.92*42.67/3242.7;
  const old=[17.25,65.25,97.25].map(x=>({x,y:36.75,hold:1000}));
  const worked=wallScrewWorst(old,0,109,39);
  if(Math.abs(worked.force-R.pull*(39/36.75)*hand)>2||Math.abs(worked.x-17.25)>.01||worked.at!==0)
    say(`the end screw of three takes ${Math.round(worked.force)} lb of a pull at the end, by hand ${Math.round(R.pull*(39/36.75)*hand)} lb`);
  // the same three screws, counted at what a screw with 2 1/2" of thread holds, are not enough
  if(wallScrewWorst(old.map(s=>({...s,hold:wallScrewHold(R.bite)})),0,109,39).ratio<=1)say('three screws on a 10 ft rack are taken as enough for a pull at its end');
  const rack=PRESETS.find(p=>p.name==='Fish tank wall / rack');
  if(!rack)return;
  const tank=key=>{const t=TANKS[key];return{size:key,tl:t[0],td:t[1],th:t[2],gal:t[3]};};
  const cases=[{orient:'long'},{orient:'long',W:240},{orient:'long',W:600},{orient:'long',build:'sections'},{orient:'long',W:240,build:'sections'},
    {orient:'long',base:'cabinet',brace:false},{orient:'long',W:48},{...tank('g5'),orient:'long',low:36,W:120},{...tank('g5'),orient:'long',low:36,W:240,build:'sections'},
    {...tank('g5'),orient:'long',W:48},{...tank('g10'),orient:'long',W:600,build:'sections'}];
  let sawAccess=false;
  for(const changes of cases){
    const vals={...presetDefaults(rack),...changes},what=JSON.stringify(changes);
    const check=checkPreset(rack,vals),facts=check.facts&&check.facts.wallScrews;
    if(check.problems.length){say(`${what}: the structural check says ${check.problems.map(f=>f.code).join(', ')}`);continue;}
    if(!facts||!facts.count){say(`${what}: no screws into the wall were counted`);continue;}
    for(const part of facts.parts)if(!(part.worst.ratio<=1+1e-6))say(`${what}: a pull at ${fmt(r16(part.worst.at-part.from))} asks ${Math.round(part.worst.ratio*100)}% of the screw at ${fmt(r16(part.worst.x-part.from))}`);
    // where the screws go in through access holes in the front rail, the rail with its holes still carries its tanks
    const pl=rackPlan(vals),plan=rackWallScrewPlan(pl,rackWallGap(vals,pl));
    if(plan.access){
      sawAccess=true;
      const left=accessHoleLeaves(pl);
      if(pl.util.rail/left.bending>1)say(`${what}: with the access holes the front rail of the top frame is at ${Math.round(pl.util.rail/left.bending*100)}% in bending`);
      if(left.shearLoad>left.shearAllowed)say(`${what}: with the access holes the front rail of the top frame carries ${Math.round(left.shearLoad)} lb at its ends, more than the ${Math.round(left.shearAllowed)} lb the wood beside a hole takes`);
    }
  }
  if(!sawAccess)say('no case with access holes in the front rail was checked');
  // as placed in the model (the screws carry what they reach into the stud)
  const vals={...presetDefaults(rack),...tank('g5'),orient:'long',low:36,W:120};
  placePreset(rack,vals,rack.build(vals),false);
  const placed=verifyDesign(S.parts,designCheckOptions());
  if(placed.problems.length)say('the tallest narrow rack as placed: '+placed.problems.map(f=>f.code).join(', '));
  if(!(placed.facts.wallScrews&&placed.facts.wallScrews.parts.every(part=>part.worst.ratio<=1+1e-6)))say('the tallest narrow rack as placed has a screw too weak for a pull near it');
});
/* The bolts between separate sections: in the model, in the step that joins the sections, listed and priced,
   a length a home center stocks, clear of every screw in the pieces they pass through, in all three styles. */
SELFTESTS.push(function sectionBoltsFit(problems){
  const say=text=>problems.push('section bolts: '+text);
  const rack=PRESETS.find(p=>p.name==='Fish tank wall / rack'),cabinet=PRESETS.find(p=>p.name==='Cabinet stand with a row of tanks');
  if(!rack||!cabinet){say('a fish preset is missing');return;}
  const cases=[[rack,{...presetDefaults(rack),build:'sections'}],[rack,{...presetDefaults(rack),build:'sections',up:'4x4',W:200}],
    [rack,{...presetDefaults(rack),build:'sections',base:'cabinet',brace:false}],[cabinet,{...presetDefaults(cabinet),build:'sections',W:200}]];
  for(const[preset,vals]of cases){
    const what=`${preset.name} ${JSON.stringify({W:vals.W,up:vals.up,base:vals.base})}`;
    const args=preset===cabinet?cabArgs(vals):vals,pl=rackPlan(args),planned=rackBoltPlan(pl);
    if(pl.mods.length<2){say(`${what}: not built as sections`);continue;}
    const junctions=pl.mods.length-1;
    if(planned.length<2*junctions)say(`${what}: ${planned.length} bolts for ${junctions} joints between sections`);
    for(const style of['std','rustic','fine']){
      placePreset(preset,vals,preset.build(vals),false);
      look().style=style;
      commit();
      const bolts=hardwareList().filter(item=>item.kind==='bolt');
      if(bolts.length!==planned.length)say(`${what} ${style}: ${bolts.length} bolts in the model, ${planned.length} planned`);
      for(const item of bolts){
        if(!RACK_BOLT_LENGTHS.includes(item.size))say(`${what}: a bolt ${fmt(item.size)} long is not a length the store has`);
        const pose=hardwarePose(item),host=byId(item.on),other=byId(item.to);
        const stack=S.parts.filter(p=>!isProp(p)&&(()=>{const b=box(p);return pose.at.y>b.lo[1]&&pose.at.y<b.hi[1]&&pose.at.z>b.lo[2]&&pose.at.z<b.hi[2]&&b.hi[0]>pose.at.x-1e-6&&b.lo[0]<pose.at.x+item.geo.grip-1e-6;})());
        if(!host||!other||stack.length<3)say(`${what} ${style}: a bolt does not pass through the posts of two sections`);
        if(!clearOfFasteners([pose.at.x,pose.at.y,pose.at.z],[1,0,0],item.geo.grip,BOLT_RADIUS,fastenerStretchesIn(stack)))
          say(`${what} ${style}: a bolt at ${fmt(r16(pose.at.y))} up passes within ${fmt(FASTENER_ROOM)} of a screw`);
      }
    }
    const listed=preset.hw(vals).filter(([label])=>/carriage bolts/i.test(label)).reduce((sum,[,count])=>sum+count,0);
    if(listed!==planned.length)say(`${what}: the shopping list buys ${listed} bolts, ${planned.length} planned`);
    if(planned.length&&!hardwareFamily(HARDWARE.bolt.buy(planned[0].len)))say("the bolts have no price");
    const plan=buildPlan(),join=plan.steps.find(step=>/sections side by side/.test(step.words));
    if(!join||!join.hardware.some(row=>row.kind==='bolt'))say(`${what}: the step that joins the sections does not mount the bolts`);
    else if(!/undoing the nuts/.test(join.words+' '+join.hardware.map(row=>row.line).join(' ')))say(`${what}: the join step does not say the sections come apart by undoing the nuts`);
  }
});
/* The screws into the wall studs clear every screw of the rail they go through, in all three styles. */
SELFTESTS.push(function wallScrewsClearTheFrame(problems){
  const say=text=>problems.push('wall screws in the rail: '+text);
  const rack=PRESETS.find(p=>p.name==='Fish tank wall / rack');
  if(!rack)return;
  for(const changes of[{orient:'long'},{orient:'long',W:240},{orient:'long',build:'sections'},{orient:'long',base:'cabinet',brace:false}]){
    const vals={...presetDefaults(rack),...changes};
    for(const style of['std','rustic','fine']){
      placePreset(rack,vals,rack.build(vals),false);
      look().style=style;
      commit();
      for(const item of hardwareList().filter(item=>item.kind==='wallscrew')){
        const pose=hardwarePose(item),host=byId(item.on);
        if(!clearOfFasteners([pose.at.x,pose.at.y,pose.at.z],[0,0,-1],item.size,.125,fastenerStretchesIn([host])))
          say(`${JSON.stringify(changes)} ${style}: the screw at ${fmt(r16(pose.at.x))} passes within ${fmt(FASTENER_ROOM)} of a screw of the rail`);
      }
    }
  }
});
