/* NominalCAD: room between fasteners.

   The owner saw an upright of the fish rack with its two pocket holes each drawn twice, one overlapping the
   other: the upright stood half on one deck and half on the next, each half was a joint of its own, and each
   joint got its own pair of pocket screws. A builder would drive two. This file holds the check that catches
   that kind of thing anywhere in the program:

     fastenersTooClose()   pairs of fasteners of the design on screen that come closer to each other than a
                           drill bit (FASTENER_ROOM), in a piece they share. Each fastener is looked at as its
                           parts: its body (the shank, from where it enters to its point), its head (where it
                           enters the wood) and, for a pocket screw, its pocket hole (from the mouth of the hole
                           to the head). Two parts are compared only when they lie in the same piece: the body is
                           in the piece it goes through and the piece it goes into, the head and the pocket hole
                           in the piece it goes through. Returns [{a, b, gap, piece}] (gap may be below zero:
                           the two overlap).

   Brackets are left out: their plates and their short screws sit on the face of the wood and are placed by
   cornerBrackets in js/fasteners.js, which keeps them apart itself.

   The self-check fastenersKeepTheirDistance (at the bottom) places every preset at its usual sizes and reports each
   preset where two fasteners come that close. It works only on what js/fasteners.js lays out, and changes nothing. */
'use strict';

/* The least room between two fasteners in one piece: a 1/8" drill bit, the pilot hole of a #8 screw. Closer than
   that, two holes run into each other or leave a sliver of wood between them that splits. */
const FASTENER_ROOM=1/8;

/* Is the face of this piece on that side (side -1 or +1 along axis s) covered by another piece, over at least half
   of it? A pocket hole cannot be drilled or driven in a face that another board lies against: the two uprights
   that stand side by side under a rail joint of a fish wall would otherwise get their pocket holes in the faces
   that touch. hiddenSide (js/fasteners.js) asks here and takes the other face when this one is covered and that
   one is not. Read from the joints of the design on screen (connGraph, js/connections.js), so it costs nothing
   extra. */
function faceCovered(piece,s,side){
  if(typeof connGraph!=='function'||!S||!S.parts)return false;
  const links=connGraph().of.get(piece.id);
  if(!links)return false;
  const b=plainBox(piece),face=side>0?b.hi[s]:b.lo[s],[u,v]=[0,1,2].filter(k=>k!==s);
  const area=(b.hi[u]-b.lo[u])*(b.hi[v]-b.lo[v]);
  return links.some(link=>{
    const j=link.joint;
    if(!j||j.k!==s||Math.abs(j.plane-face)>.02)return false;
    return(j.ru[1]-j.ru[0])*(j.rv[1]-j.rv[0])>=.5*area-1e-6;
  });
}
/* the parts of one fastener, each a stretch from `from` along `dir` for `len` inches with a radius, and the pieces it lies in */
function fastenerParts(f){
  if(f.kind==='bracket')return[];
  const through=[f.through],both=[f.through,f.into,...(f.also||[])];
  const parts=[{what:'body',from:f.pos,dir:f.dir,len:f.len,radius:(f.dia||0)/2,pieces:both}];
  if(f.head>0)parts.push({what:'head',from:f.pos,dir:f.dir,len:0,radius:f.head/2,pieces:through});
  if(f.pocket){
    // the pocket hole runs from its mouth on the hidden face down to the head of the screw
    const mouth=f.pocket.mouth,run=[0,1,2].map(k=>f.pos[k]-mouth[k]),length=Math.hypot(...run);
    if(length>1e-6)parts.push({what:'pocket hole',from:mouth,dir:run.map(v=>v/length),len:length,radius:(f.pocket.dia||0)/2,pieces:through});
  }
  return parts;
}
/* every fastener of the design on screen, with the joint (link) it belongs to */
function fastenersOfDesign(){
  const list=[];
  for(const link of connGraph().links){
    if(!link.joint||!link.fastened)continue;
    for(const f of fastenersOfLink(link))list.push({f,link});
  }
  return list;
}
function fastenersTooClose(){
  const CELL=2,cells=new Map(),found=[];
  const items=[];
  for(const{f,link}of fastenersOfDesign()){
    const placed=fastenerInWorld(f);
    for(const part of fastenerParts(placed))items.push({f,link,part});
  }
  // a grid of 2" cells: each part goes into every cell its stretch passes near
  const keysOf=part=>{
    const end=pointPlus(part.from,part.dir,part.len),pad=part.radius+FASTENER_ROOM,keys=[];
    const lo=[0,1,2].map(k=>Math.floor((Math.min(part.from[k],end[k])-pad)/CELL));
    const hi=[0,1,2].map(k=>Math.floor((Math.max(part.from[k],end[k])+pad)/CELL));
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)keys.push(x+'|'+y+'|'+z);
    return keys;
  };
  const seen=new Set();
  items.forEach((item,index)=>{
    for(const key of keysOf(item.part)){
      const here=cells.get(key);
      if(here){
        for(const otherIndex of here){
          const other=items[otherIndex];
          if(other.f===item.f)continue;                                    // the parts of one fastener belong together
          const pairKey=otherIndex+'|'+index;
          if(seen.has(pairKey))continue;
          seen.add(pairKey);
          const piece=item.part.pieces.find(p=>other.part.pieces.includes(p));
          if(!piece)continue;                                              // not in the same piece
          const gap=stretchGap(item.part.from,item.part.dir,item.part.len,other.part.from,other.part.dir,other.part.len)-item.part.radius-other.part.radius;
          if(gap<FASTENER_ROOM-1e-6)found.push({a:other,b:item,gap,piece});
        }
        here.push(index);
      }else cells.set(key,[index]);
    }
  });
  // one finding for each pair of fasteners (the closest of their parts)
  const number=new Map(),numberOf=f=>{if(!number.has(f))number.set(f,number.size);return number.get(f);};
  const byPair=new Map();
  for(const hit of found){
    const a=numberOf(hit.a.f),b=numberOf(hit.b.f),key=Math.min(a,b)+'|'+Math.max(a,b);
    if(!byPair.has(key)||hit.gap<byPair.get(key).gap)byPair.set(key,hit);
  }
  return[...byPair.values()].map(hit=>({a:hit.a.f,b:hit.b.f,linkA:hit.a.link,linkB:hit.b.link,what:[hit.a.part.what,hit.b.part.what],gap:hit.gap,piece:hit.piece}));
}
/* one line about a pair, for a report */
function tooCloseWords(hit){
  const where=f=>`${f.label||f.kind} through the ${f.through.name} into the ${f.into.name}`;
  return`${hit.what[0]} of a ${where(hit.a)} and ${hit.what[1]} of a ${where(hit.b)}, in the ${hit.piece.name}, `+
    (hit.gap<0?`overlap by ${fmt(r16(-hit.gap))}`:`${fmt(r16(Math.max(0,hit.gap)))} apart`)+
    ` (at x ${fmt(r16(hit.a.pos[0]))}, y ${fmt(r16(hit.a.pos[1]))}, z ${fmt(r16(hit.a.pos[2]))})`;
}

/* Presets in which this check finds fasteners too close, by style (the keys of STYLES), with the number of pairs
   and why. They are handed on to the round that reworks how fasteners are placed where joints meet (the corner
   settler, settledLayouts in js/fasteners.js): the self-check below fails if one of them gets worse, and for any
   other preset that trips at all. Take a preset off this list once it is clean; never raise a number without
   saying why here.

   History. When the check was written (16 Nov) it ran in Everyday only, and the Dining table (4), Coffee table (8),
   Side table / nightstand (4), Sturdy bench (8) and Entryway shoe bench (8) were on the list: their tops were
   screwed down through the top past the pocket holes of the aprons. Main now holds those tops from underneath in
   Everyday (js/showfaces.js), and all five are clean there, so they came off. The Rustic and Fine entries were
   added at the same time (16 Nov), when the check was first run in those two styles: nothing was checked there
   before, so they are new entries, not raised ones. Every one of them except the Platform bed is also found by
   main's own screwsThatMeet (js/fasteners.js), which on main itself finds the Fish tank wall in Rustic 24 and in
   Fine 24, the Cabinet stand in Rustic 6 and in Fine 4, and the three tables below in Rustic 4 each.
   The Fish tank wall / rack (Rustic 64, Fine 32) and the Cabinet stand with a row of tanks (Rustic 16, Fine 12) came
   off on 16 Nov, clean in all three styles, fixed in the fish presets themselves (RACK_JOINTS, js/builders-fish.js):
   their feet and uprights are held by pocket screws in Rustic too, and by an L-bracket where they meet a rail in
   Fine furniture; the top deck is screwed down into the post tops; the posts are made after the frames, so the
   screws between a post and the end cross piece or upright go in from the inside. */
const FASTENER_ROOM_HANDED_ON={
  std:{
    'Shed':{pairs:110,why:'framing nails of neighbouring joints (plates, studs, sheathing, rim and floor joists) pass within 1/8" of each other; framing nails are not moved aside where joints meet'}
  },
  rustic:{
    'Shed':{pairs:110,why:'the same framing nails as in Everyday (framing is nailed the same in every style)'},
    'Coffee table':{pairs:4,why:'the top is screwed down from above in Rustic, and a top screw near the end of a short apron ends on the 3" screw through the leg into that apron; no move the corner settler tries clears both screws of the pair'},
    'Side table / nightstand':{pairs:4,why:'as the Coffee table'},
    'Entryway shoe bench':{pairs:4,why:'as the Coffee table, with the seat boards'}
  },
  fine:{
    'Shed':{pairs:110,why:'the same framing nails as in Everyday'},
    'Platform bed':{pairs:1,why:'a pocket hole for a slat in the center beam opens 1/16" from the head of the screw through the beam into the center leg; the corner settler looks at screws from 1/4" under their heads, so it does not see heads beside holes'}
  }
};
/* Self-check: no two fasteners of any preset, at its usual sizes and in each of the three styles, come closer than
   a drill bit in a piece they share (the fish presets with each choice of their forms as well, in Everyday). Each
   preset that trips is reported once, with how many pairs and the first one; a preset of FASTENER_ROOM_HANDED_ON
   only when it has more pairs than it had. */
SELFTESTS.push(function fastenersKeepTheirDistance(problems){
  const report=(name,close,style)=>{
    const handed=(FASTENER_ROOM_HANDED_ON[style||'std']||{})[name.replace(/ \(.*\)$/,'')];
    if(!close.length||(handed&&!/\(/.test(name)&&close.length<=handed.pairs))return;
    const label=style&&style!=='std'?` (${STYLES[style][0]})`:'';
    problems.push(`fasteners too close: ${name}${label}: ${close.length} pair${close.length>1?'s':''} of fasteners closer than ${fmt(FASTENER_ROOM)} to each other, for example the ${tooCloseWords(close[0])}`);
  };
  for(const preset of PRESETS){
    const vals=presetDefaults(preset);
    let parts=[];
    try{parts=preset.build(vals)||[];}catch(e){}
    if(!parts.length)continue;
    placePreset(preset,vals,parts,false);
    report(preset.name,fastenersTooClose(),'std');
    // the same design in the other two styles (the style changes which fastener a joint gets)
    for(const style of Object.keys(STYLES)){
      if(style==='std')continue;
      look().style=style;
      commit();
      report(preset.name,fastenersTooClose(),style);
    }
  }
  // the fish racks and stands with every choice of their forms (the owner's doubled pocket holes were on a rack)
  for(const variant of presetVariants()){
    if(!/^(Fish tank wall|Single aquarium stand|Cabinet stand)/.test(variant.name)||variant.vals===undefined)continue;
    if(!placeForCheck(variant))continue;
    report(variant.name,fastenersTooClose());
  }
});
