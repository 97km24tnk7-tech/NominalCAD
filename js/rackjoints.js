/* NominalCAD: a fish tank wall longer than the longest board.

   The owner looked at the default fish wall (10 ft wide, 8 ft boards) and asked about "an odd space that no one
   would want": the wall was built as two racks side by side, 3 bays and 1 bay, each with its own posts and its
   own end uprights, so where they met there were 6" of wood where every other bay divider is 1 1/2". This file
   decides how a wall is split along its length, and where everything goes along it:

   ONE WALL (the default, "Build it as: One wall"). The wall is one frame, like a wall built from longer boards:
   full-height posts at its two outer ends only. The rails of a row are joined end to end over a line of uprights
   (a "joint line"). Each rail end must sit fully on wood, at least RAIL_END_BEARING (1 1/2"):
     - with uprights 1 1/2" across (2x4, 2x6, 2x8) the joint line is two uprights side by side (3"), one under
       each rail end;
     - with 4x4 uprights one upright carries both ends, 1 3/4" each, so a joint line is as wide as any other.
   Between the two rails, level with them, two cross pieces lie side by side, one just inside each rail end,
   screwed to each other, and each rail end is screwed into the end of its own cross piece: that ties the two
   rail pieces together (what is under a rail end is its upright). The plywood deck runs across the
   joint (its seams are never on a line of uprights, see deckSeams), which ties them again. The uprights of the
   joint line stand straight above the ones below, down to the feet or the floor, like every line of uprights.
   The joints of every row, and of the front and back rails, are at the same places. A rule of thumb for long
   beams says to stagger splices, but that is for a beam that runs on past its joint; here no rail runs past
   one: each rail piece is a span of its own that ends on its own upright. Staggering them would need a doubled
   line of uprights under every joint of every row, more wood and more uneven gaps for no gain.
   The joints are placed so the rail pieces are as even as the bays allow (2 + 2 bays, not 3 + 1), every piece
   within the longest board, and with as few joints as possible.

   SEPARATE SECTIONS ("Build it as: Separate sections you can carry"). As before: each section is a rack of its
   own with its own four posts; where the rack goes, the sections stand side by side and the posts that meet are
   screwed together, with no glue, before the rack is fastened to the wall (sectionsJoinStep, js/builders-fish.js).
   The bays are shared out as evenly as they go.

   Either way the count of bays is the most that fits the width typed, so the number of tanks never goes down
   against the program before this choice existed; one wall spends less width at its joints (1 1/2" or nothing,
   against 4 1/2" or more for a doubled pair of posts and end uprights), so it sometimes fits one more bay.

     rackBuildOf(p)                 'one' or 'sections' (a value saved before the choice existed reads as 'one')
     rackSplit(room, B, su, board, budget, build)
                                    -> { mods:[{nb, W, stretches:[bays of each rail piece]}], bays, W } or null
     rackLines(pl, m)               the lines of uprights of one section: [{x, w, joint}] and the left edge of each bay
     deckSeams(pl, m, lay)          where the decks are cut, from the left end of the section (see below)
     railJointWords(pl)             one sentence about the rail joints, for the notes and the steps
   The self-checks are at the bottom of the file (SELFTESTS). */
'use strict';

const RAIL_END_BEARING=1.5;   // the least length of wood a rail end under tanks sits on (also in js/verify.js, RAIL_RULES)
const rackBuildOf=p=>p&&p.build==='sections'?'sections':'one';
/* The choice on the forms of the rack and the cabinet stand (js/presets.js). It is shown, at both levels, only when
   the wall typed is longer than the longest board chosen (the cabinet stand is cut from 8 ft boards), the only
   time the choice matters: a shorter wall is one frame either way. While it is hidden the preset gets 'one'
   (presetRowShown and readVals in js/app.js), and the remark under the form says nothing about it. */
const rackBoardOf=p=>+p.board||96;
const RACK_BUILD_FIELD={k:'build',label:'Build it as',opts:[['one','One wall (rails joined over an upright)'],['sections','Separate sections you can carry']],v:'one',
  show:p=>(+p.W||0)>rackBoardOf(p)+1e-6};
/* how wide a line of uprights is where two rails are joined over it */
const jointLineWidth=su=>su>=3?su:2*su;
/* the part of a rail that lies on the line of uprights at one end of a stretch: all of the end upright at the
   outer end of the wall, half of a joint line at a joint */
const railEndOn=(su,joint)=>joint?jointLineWidth(su)/2:su;
/* the most bays a stretch of one rail piece can span within the board, by what is at its two ends */
function fitBays(B,su,board,leftJoint,rightJoint){
  const ends=railEndOn(su,leftJoint)+railEndOn(su,rightJoint);
  return Math.max(0,Math.floor((board-ends+su)/(B+su)+1e-6));
}
const sectionWidth=(nb,B,su)=>3+2*su+nb*B+(nb-1)*su;   // a rack on its own: two posts, two end uprights
/* N bays shared out into k parts as evenly as they go, no part above cap(i). The parts that get one more are
   chosen so the wall looks the same from both ends where it can (5 bays in 3 pieces: 2 + 1 + 2): the middle one
   when the count left over is odd, then pairs from the middle outward. Returns the counts, or null when they
   cannot fit. */
function evenCounts(N,k,cap){
  const counts=Array(k).fill(Math.floor(N/k)),middle=(k-1)/2,tiers=[],pick=[];
  for(let d=k%2?0:.5;d<=middle+1e-9;d++)tiers.push(d===0?[middle]:[middle-d,middle+d]);
  let left=N%k;
  if(k%2&&left%2){pick.push(middle);left--;}
  for(const tier of tiers)if(tier.length===2&&left>=2){pick.push(...tier);left-=2;}
  for(const tier of tiers)for(const i of tier)if(left>0&&!pick.includes(i)){pick.push(i);left--;}   // no way to keep it symmetric
  for(const i of pick)counts[i]++;
  for(let guard=0;guard<k*k+N;guard++){
    const over=counts.findIndex((c,i)=>c>cap(i));
    if(over<0)return counts;
    const spare=[...Array(k).keys()].filter(i=>counts[i]<cap(i)).sort((a,b)=>Math.abs(a-over)-Math.abs(b-over))[0];
    if(spare===undefined)return null;
    counts[over]--;counts[spare]++;
  }
  return null;
}
/* one wall of N bays: how many bays each rail piece spans, fewest joints first */
function splitWall(N,B,su,board){
  if(N<=fitBays(B,su,board,false,false))return[N];
  const end=fitBays(B,su,board,false,true),middle=fitBays(B,su,board,true,true);
  if(end<1)return null;
  for(let k=2;k<=N;k++){
    const cap=i=>i===0||i===k-1?end:middle;
    if(2*end+(k-2)*middle<N){if(middle<1)return null;continue;}
    return evenCounts(N,k,cap);
  }
  return null;
}
const wallWidth=(counts,B,su)=>{
  const N=counts.reduce((a,b)=>a+b,0);
  return 3+2*su+N*B+(N-1)*su+(counts.length-1)*(jointLineWidth(su)-su);
};
/* How a wall `room` wide is built with bays B wide and uprights su across, from boards `board` long, with at most
   `budget` bays. The most bays that fit, split the way `build` says. */
function rackSplit(room,B,su,board,budget,build){
  const most=Math.min(budget,1000);
  if(build==='sections'){
    const per=fitBays(B,su,board,false,false);
    if(per<1)return null;
    let N=0;
    for(let n=1;n<=most;n++){
      const sections=Math.ceil(n/per);
      if(sections>200||sections*(3+su)+n*(B+su)>room+1e-6)break;
      N=n;
    }
    if(!N)return null;
    const counts=evenCounts(N,Math.ceil(N/per),()=>per);
    const mods=counts.map(nb=>({nb,W:sectionWidth(nb,B,su),stretches:[nb]}));
    return{mods,bays:N,W:mods.reduce((sum,m)=>sum+m.W,0)};
  }
  let best=null;
  for(let n=1;n<=most;n++){
    const counts=splitWall(n,B,su,board);
    if(!counts)break;
    const W=wallWidth(counts,B,su);
    if(W>room+1e-6)break;
    best={counts,W};
  }
  if(!best)return null;
  return{mods:[{nb:best.counts.reduce((a,b)=>a+b,0),W:best.W,stretches:best.counts}],bays:best.counts.reduce((a,b)=>a+b,0),W:best.W};
}
/* The lines of uprights along one section, from its left end: the left edge and the width of each, and whether
   two rails are joined over it; and the left edge of every bay. */
function rackLines(pl,m){
  const{B,su}=pl,jw=jointLineWidth(su),stretches=m.stretches||[m.nb];
  const lines=[{x:1.5,w:su,joint:false}],bays=[];
  stretches.forEach((count,s)=>{
    for(let b=0;b<count;b++){
      const before=lines[lines.length-1],bayX=before.x+before.w,joint=b===count-1&&s<stretches.length-1;
      bays.push(bayX);
      lines.push({x:bayX+B,w:joint?jw:su,joint});
    }
  });
  return{lines,bays};
}
/* Where the decks of a section are cut. A sheet of plywood is 8 ft long (4 ft when the deck is deeper than 4 ft),
   so a longer deck is made of pieces, and every seam between two pieces lands on the middle of a cross piece
   inside a bay: never on a line of uprights (an upright standing on a seam would stand half on each piece and
   take two sets of pocket screws), never on a rail joint (the plywood is what bridges it), never under a door
   stile. Where no cross piece of a bay is within reach (bays shorter than 16" have none), one is added in the
   middle of the farthest bay that is: lay.cross gets it, so every frame has it. Seams are worked out for the top
   deck, which runs over the post tops from 0 to the full width; the lower decks fit between the posts and use
   the same seams. Returns the seams, from the left end of the section, in order. */
function deckSeams(pl,m,lay){
  const longest=pl.D>SHEET_W?SHEET_W:SHEET_L,B=pl.B;
  const keepOut=lay.lines.map(L=>[L.x-.01,L.x+L.w+.01]).concat(lay.front.stiles.map(x=>[x-.01,x+1.51]));
  const clear=x=>!keepOut.some(([a,b])=>x>a&&x<b);
  const middles=()=>lay.inBay.map(x=>x+.75).filter(clear).sort((a,b)=>a-b);
  const seams=[];
  let start=0;
  for(let guard=0;guard<500&&m.W-start>longest+1e-6;guard++){
    let seam=middles().filter(x=>x>start+1&&x<m.W-1&&x<=start+longest+1e-6).pop();
    if(seam===undefined){
      // (the added cross piece may not lie where another one already is, nor where a door stile's is)
      const roomFor=mid=>lay.inBay.concat(lay.stileCross||[]).every(c=>Math.abs(mid-.75-c)>=1.5-1e-6);
      const bay=lay.bay.filter(b0=>{const mid=b0+B/2;return mid>start+1&&mid<=start+longest+1e-6&&clear(mid)&&roomFor(mid);}).pop();
      if(bay===undefined){seam=start+longest;}    // cannot happen with bays the rack engine makes; the self-check would say so
      else{
        const cx=r16(bay+B/2-.75);
        lay.inBay.push(cx);
        lay.added.push(cx);
        seam=cx+.75;
      }
    }
    seams.push(seam);
    start=seam;
  }
  return seams;
}
/* the rail pieces of one row of one section: [from, to] from the left end, cut at the middle of each joint line */
function railPieces(lay,m){
  const cuts=[1.5,...lay.railJoints,m.W-1.5],pieces=[];
  for(let i=0;i<cuts.length-1;i++)pieces.push([cuts[i],cuts[i+1]]);
  return pieces;
}
/* The rail joints in words, for the notes and the steps: '' when no rail has a joint. */
function railJointWords(pl,thing){
  const m=pl.mods[0];
  if(pl.mods.length!==1||(m.stretches||[]).length<2)return'';
  // (measured from the left end of the frames, inside the left posts, as the steps measure everything along them)
  const lay=rackLayout(pl,m),places=lay.railJoints.map(x=>fmt(r16(x-1.5))),pieces=railPieces(lay,m).map(([a,b])=>fmt(r16(b-a)));
  const over=pl.su<3?'a pair of uprights side by side (one under each rail end)':`one ${pl.up} upright, which carries both rail ends (${fmt(pl.su/2)} each)`;
  return`Each rail is ${pieces.length} pieces (${lengthsWords(pieces)}) joined end to end over ${over}, ${places.length>1?'the joints at':'the joint at'} ${listWords(places)} from the left end of the frames (inside the left posts of the ${thing||'rack'}).`;
}
/* '56 1/2" long each' when the lengths are all the same, else '56 1/2", 58" and 56 1/2" long' */
const lengthsWords=list=>list.every(v=>v===list[0])?`each ${list[0]} long`:`${listWords(list)} long`;
/* (listWords, "a, b and c", is the one in js/buildsteps.js) */
/* The remark on what "Build it as" means, for the line under the form. '' when the wall needs neither joints nor
   sections (it fits on one board), because then the two choices build the same thing. */
function rackBuildRemark(pl){
  const joined=pl.mods.length===1&&(pl.mods[0].stretches||[]).length>1;
  if(!joined&&pl.mods.length<2)return'';
  return'Build it as: one wall joins the rails end to end over an upright, with posts at the two ends only; separate sections give each section its own posts, so each can be carried in and set beside the next.';
}

/* ---------- self-checks (selfTest runs them) ---------- */
/* Main's counts of tanks before "Build it as" existed, for the rack (bases open, shelf, cabinet; uprights Auto, 2x4,
   4x4, 2x6, 2x8; boards 8, 10, 12, 16 ft; widths 24" to 600" in steps of 24") and the cabinet stand (uprights Auto,
   2x4, 4x4; 1 and 2 rows), other values at the defaults. Counts in base 36, one row per combination. Measured on
   16 Nov in the program as it was then. */
const RACK_MAIN_ROWS=['2.6.a.c.g.k.o.o.u.w.10.14.16.1c.1e.1g.1k.1o.1o.1u.20.20.20.28.2c','2.6.a.c.g.k.o.o.u.w.10.14.16.1c.1e.1g.1k.1o.1s.1u.20.20.24.28.2c',
  '2.6.a.c.g.k.o.o.u.w.10.14.16.1c.1e.1i.1k.1o.1s.1u.20.20.28.28.2c','2.6.a.c.g.k.o.s.u.w.10.16.18.1c.1e.1k.1k.1o.1s.1y.20.20.28.2c.2c',
  '2.4.8.c.c.i.k.o.o.u.10.10.14.16.1c.1e.1e.1i.1o.1o.1s.20.20.20.28','2.4.8.c.g.i.k.o.s.w.10.10.16.16.1c.1e.1k.1k.1o.1s.1s.20.20.20.28',
  '2.4.8.c.g.k.k.o.s.w.10.14.16.16.1c.1e.1k.1o.1o.1s.1u.20.20.28.28','2.4.8.c.g.k.k.o.s.w.10.14.16.16.1c.1e.1k.1o.1o.1s.1u.20.20.28.2c',
  '2.6.8.c.g.i.k.o.u.w.10.10.16.18.1c.1g.1k.1o.1o.1u.1w.20.20.26.2c','2.6.8.c.g.i.k.o.u.w.10.10.16.18.1c.1g.1k.1o.1o.1u.1w.20.24.28.2c',
  '2.6.8.c.g.k.k.o.u.w.10.14.16.18.1c.1i.1k.1o.1o.1u.20.20.26.28.2c','2.6.8.c.g.k.o.o.u.w.10.14.18.1c.1c.1i.1k.1o.1s.1u.20.20.26.28.2c',
  '2.4.8.c.c.i.k.o.o.u.w.10.10.16.18.1c.1c.1i.1k.1o.1o.1u.20.20.26','2.4.8.c.c.i.k.o.o.u.w.10.10.16.1c.1c.1i.1i.1o.1o.1u.1u.20.20.26',
  '2.4.8.c.c.i.k.o.o.u.w.10.16.16.1c.1c.1i.1i.1o.1o.1u.1w.20.20.26'];
/* which of those rows each of the 60 combinations has (base 36), and a check sum of the whole table as it was read
   off the program, so that a slip in copying it is caught (rackMainCountsSum) */
const RACK_MAIN_INDEX='0123012345670123012389ab89abccde89ab89ab89ab89abccde89ab89ab',RACK_MAIN_SUM=167569196;
const RACK_MAIN_COUNTS=[...RACK_MAIN_INDEX].map(c=>RACK_MAIN_ROWS[parseInt(c,36)]).join('|');
function rackMainCountsSum(text){let h=0;for(let i=0;i<text.length;i++)h=(h*31+text.charCodeAt(i))%1000000007;return h;}
const CABINET_MAIN_COUNTS='0.1.2.3.4.5.6.6.7.8.9.a.b.c.c.d.f.f.g.h.i.i.j.l.l|0.2.4.6.8.a.c.c.e.g.i.k.m.o.o.q.u.u.w.y.10.10.12.16.16|0.1.2.3.4.5.6.6.7.8.9.a.b.c.c.d.f.f.g.h.i.i.j.l.l|0.2.4.6.8.a.c.c.e.g.i.k.m.o.o.q.u.u.w.y.10.10.12.16.16|0.1.2.3.4.4.5.6.6.8.9.9.a.a.c.c.d.f.f.g.g.i.i.i.l|0.2.4.6.8.8.a.c.c.g.i.i.k.k.o.o.q.u.u.w.w.10.10.10.16';
const RACK_SWEEP={bases:['open','shelf','cabinet'],ups:['auto','2x4','4x4','2x6','2x8'],boards:['96','120','144','192'],cabinetUps:['auto','2x4','4x4'],cabinetRows:['1','2']};
const RACK_STILE_TANKS=['g5','g10','g20l','g29','g20h'];   // small tanks: narrow doors, so door stiles in most bays
const RACK_SWEEP_WIDTHS=Array.from({length:25},(unused,i)=>24+24*i);

/* What a plan must be, whatever the form says: every rail piece within the board, every rail end on at least
   RAIL_END_BEARING of upright, no wider than the width typed. Returns sentences. */
function rackPlanFaults(pl,room){
  const faults=[];
  if(pl.W>room+1e-6)faults.push(`it is ${fmt(pl.W)} wide, wider than the ${fmt(room)} typed`);
  for(const m of pl.mods){
    const lay=rackLayout(pl,m);
    for(const[a,b]of railPieces(lay,m)){
      if(b-a>pl.board+1e-6)faults.push(`a rail piece is ${fmt(r16(b-a))} long, longer than the ${pl.board/12} ft board`);
      // what is under each end of the piece: the line of uprights it ends on
      for(const end of[a,b]){
        const line=lay.lines.find(L=>end>=L.x-1e-6&&end<=L.x+L.w+1e-6);
        const under=!line?0:end===a?line.x+line.w-end:end-line.x;
        if(under<RAIL_END_BEARING-1e-6)faults.push(`a rail end ${fmt(r16(end))} from the left end sits on only ${fmt(r16(Math.max(0,under)))} of upright`);
      }
    }
    // the bottom frame: no two cross pieces in the same wood (each 1 1/2" thick), and one right under every door stile
    const bottom=lay.cross.concat(lay.stileCross).sort((a,b)=>a-b);
    for(let i=1;i<bottom.length;i++)if(bottom[i]-bottom[i-1]<1.5-1e-6)faults.push(`two cross pieces of the bottom frame, at ${fmt(r16(bottom[i-1]))} and ${fmt(r16(bottom[i]))}, overlap`);
    for(const x of lay.front.stiles)if(!bottom.some(c=>Math.abs(c-x)<=.15+1e-6))faults.push(`the door stile at ${fmt(r16(x))} has no cross piece right under it`);
  }
  return[...new Set(faults)];
}
/* The gaps between neighbouring tanks of the bottom row of tanks, from left to right: {gap, line}. line is true
   when a line of uprights stands between the two (the tanks are in neighbouring bays), false for two tanks of one bay. */
function tankGaps(parts){
  const tanks=parts.filter(p=>p.name==='Tank');
  if(!tanks.length)return[];
  const lowest=Math.min(...tanks.map(p=>p.pos[1]));
  const row=tanks.filter(p=>Math.abs(p.pos[1]-lowest)<.01).map(p=>[p.pos[0],p.pos[0]+size(p)[0]]).sort((a,b)=>a[0]-b[0]);
  const uprights=parts.filter(p=>p.name==='Upright'||p.name==='Post').map(p=>[p.pos[0],p.pos[0]+size(p)[0]]);
  return row.slice(1).map((t,i)=>{
    const from=row[i][1],to=t[0];
    return{gap:r16(to-from),line:uprights.some(([a,b])=>a>=from-1e-6&&b<=to+1e-6)};
  });
}

/* The default wall, and a wall of 4x4 uprights: one frame, tanks evenly spaced (the gaps differ by no more than
   the extra upright at a joint, and not at all with 4x4 uprights), no wider than typed, the remark under the
   form and the notes say what is built, and the separate-sections choice really builds sections, split evenly. */
SELFTESTS.push(function fishWallIsOneFrame(problems){
  const say=text=>problems.push('fish wall: '+text);
  const rack=PRESETS.find(p=>p.name==='Fish tank wall / rack');
  if(!rack){say('the Fish tank wall / rack preset is missing');return;}
  const usual=presetDefaults(rack);
  const look=(vals,what)=>{
    const pl=rackPlan(vals),parts=rack.build(vals);
    if(!pl||!parts.length){say(`${what}: nothing was built`);return null;}
    return{pl,parts,gaps:tankGaps(parts)};
  };
  const one=look(usual,'the default wall');
  if(one){
    if(one.pl.mods.length!==1)say(`the default wall is built as ${one.pl.mods.length} sections, not one wall`);
    if(one.parts.filter(p=>p.name==='Post').length!==4)say(`the default wall has ${one.parts.filter(p=>p.name==='Post').length} posts, not 4 (posts at its two ends only)`);
    // the gaps across a line of uprights may differ by the extra upright at a joint, no more; those inside a bay are all alike
    const extra=jointLineWidth(one.pl.su)-one.pl.su,across=one.gaps.filter(g=>g.line).map(g=>g.gap),within=one.gaps.filter(g=>!g.line).map(g=>g.gap);
    const spread=list=>list.length?Math.max(...list)-Math.min(...list):0;
    if(spread(across)>extra+1e-6||spread(within)>1e-6)say(`the gaps between the tanks of a row are ${one.gaps.map(g=>fmt(g.gap)).join(', ')}: they differ by more than the ${fmt(extra)} of the extra upright at a joint`);
    const stretches=one.pl.mods[0].stretches;
    if(Math.max(...stretches)-Math.min(...stretches)>1)say(`the rail pieces span ${stretches.join(' + ')} bays: not as even as the bays allow`);
    if(one.pl.count<16)say(`the default wall holds ${one.pl.count} tanks, fewer than the 16 it held before`);
    const notes=rackNotes(usual).join(' ');
    if(!/joined end to end/.test(notes)||!/Build it as: one wall/.test(rack.info(usual)))say('the notes and the remark under the form do not say that the rails are joined and what "Build it as" means');
    // the foot of every upright: one deck under it, so one set of pocket screws (two), none in a face another board covers
    placePreset(rack,usual,rack.build(usual),false);
    const footScrews=new Map();
    for(const link of connGraph().links){
      if(!link.joint||!link.fastened)continue;
      for(const f of fastenersOfLink(link)){
        if(f.kind!=='pocket'||f.through.name!=='Upright'||f.into.name!=='Shelf deck')continue;
        footScrews.set(f.through,(footScrews.get(f.through)||0)+1);
        const covered=S.parts.some(p=>p!==f.through&&!isProp(p)&&[0,1,2].every(k=>{const s=size(p);return f.pocket.mouth[k]>=p.pos[k]-.01&&f.pocket.mouth[k]<=p.pos[k]+s[k]+.01;})&&
          Math.abs((f.pocket.out[0]>0?p.pos[0]:p.pos[0]+size(p)[0])-f.pocket.mouth[0])<.02);
        if(covered)say('a pocket hole in the foot of an upright opens on a face that another board lies against');
      }
    }
    // a foot's pocket holes open well up its side, where a drill and a driver can reach (not at the floor)
    for(const link of connGraph().links){
      if(!link.joint||!link.fastened)continue;
      for(const f of fastenersOfLink(link))if(f.kind==='pocket'&&f.through.name==='Foot'&&f.pocket.mouth[1]<1-1e-6)say(`a pocket hole in a foot opens ${fmt(r16(f.pocket.mouth[1]))} above the floor`);
    }
    if(one.pl.y0>0&&one.pl.y0<RACK_RULES.FOOT_MIN)say(`the default wall stands on feet ${fmt(one.pl.y0)} tall, too short for pocket holes`);
    const counts=[...new Set(footScrews.values())];
    if(counts.length!==1||counts[0]!==2)say(`the feet of the uprights have ${[...footScrews.values()].join(', ')} pocket screws: each should have two (one deck under it)`);
    const steps=JSON.stringify(rackSteps(usual,true));
    if(/Stand the sections side by side/.test(steps))say('the steps of one wall tell the builder to stand sections side by side');
    if(!/pieces that meet end to end/.test(steps))say('the frame step of one wall does not say that the rails are made of pieces joined end to end');
    // the brace step names the places its braces end at the way the upright step does (left edges from the left
    // end of the frame), so none of its numbers is past the end of the frame, and each upright it names is one
    const braceStep=rackSteps(usual,true).find(step=>step.add.includes('Back brace'));
    if(braceStep){
      const frame=one.pl.mods[0].W-3,edges=rackLayout(one.pl,one.pl.mods[0]).sup.map(x=>fmt(r16(x-1.5)));
      const numbers=(braceStep.t.match(/\bat (\d+(?: \d+\/\d+)?")/g)||[]).map(s=>s.slice(3));
      for(const n of numbers){
        if(parseLen(n)>frame+1e-6)say(`the brace step gives ${n}, past the end of the ${fmt(frame)} frame`);
        if(!edges.includes(n))say(`the brace step names an upright at ${n}, and no upright has its left edge there`);
      }
      if(!/right end post/.test(braceStep.t))say('the brace step does not say that the last brace reaches the right end post');
    }else say('the default wall has no brace step');
    // the cross pieces at a joint lie between the rails, level with them; what is under a rail end is its upright
    if(/cross pieces? (stand|lie)s?[^.]*under the end/.test(steps))say('the steps put the cross pieces of a rail joint under the rail ends; they lie between the rails, level with them');
  }
  const square=look({...usual,up:'4x4',W:180},'a 15 ft wall of 4x4 uprights');
  if(square){
    const across=square.gaps.filter(g=>g.line).map(g=>g.gap),within=square.gaps.filter(g=>!g.line).map(g=>g.gap);
    if(square.pl.mods.length!==1||!rackLayout(square.pl,square.pl.mods[0]).railJoints.length)say('a 15 ft wall of 4x4 uprights on 8 ft boards has no rail joint to check');
    if([across,within].some(list=>list.length&&Math.max(...list)-Math.min(...list)>1e-6))say(`with 4x4 uprights the gaps between the tanks are ${square.gaps.map(g=>fmt(g.gap)).join(', ')}: those across a line of uprights are not all equal`);
  }
  const apart=look({...usual,build:'sections'},'separate sections');
  if(apart){
    if(apart.pl.mods.length<2)say('"Separate sections" builds one frame');
    const counts=apart.pl.mods.map(m=>m.nb);
    if(Math.max(...counts)-Math.min(...counts)>1)say(`separate sections of ${counts.join(' + ')} bays: not split evenly`);
    // Joined where the rack stands, before it goes on the wall, with the carriage bolts the model has between their posts (js/rackwall.js)
    // (listed in that step, not in the step that builds the sections), and nothing named that is not bought.
    const vals={...usual,build:'sections'},texts=rackSteps(vals,true).map(step=>step.t);
    const join=texts.findIndex(t=>/sections side by side/.test(t)),wall=texts.findIndex(t=>/wall studs/.test(t));
    if(join<0)say('the steps of separate sections do not say to stand them side by side and join their posts');
    else if(wall>=0&&wall<join)say('separate sections are fastened to the wall before they are stood side by side and joined');
    if(texts.some(t=>/\bbolt/i.test(t))&&!rack.hw(vals).some(([label])=>/bolt/i.test(label)))say('the steps of separate sections name bolts that are not on the shopping list');
    placePreset(rack,vals,rack.build(vals),false);
    const plan=buildPlan(),bolted=step=>step.hardware.some(row=>row.kind==='bolt');
    const joinStep=plan.steps.find(step=>/sections side by side/.test(step.words));
    if(!joinStep||!bolted(joinStep))say('the step that stands the sections side by side does not mount the bolts between their posts');
    if(plan.steps.some(step=>step!==joinStep&&bolted(step)))say('the bolts between the posts of two sections are mounted in a step that builds one section');
    if(connGraph().links.some(link=>link.joint&&link.fastened&&link.a.name==='Post'&&link.b.name==='Post'))say('the posts of two sections are screwed to each other as well as bolted');
  }
});
/* The structural check on a rail joint made by hand (js/verify.js, RAIL_RULES): two rails under a tank meeting
   end to end over two uprights, with a cross piece under each end and one deck across, is clean of the three
   joint findings; a deck seam on the joint is a 'rail-joint'; one upright of 1 1/2" under both ends leaves each
   end on 3/4" ('end-bearing'); an upright of a second tier that stands over the middle of a bay is a 'post-offset'. */
SELFTESTS.push(function railJointsAreChecked(problems){
  const say=text=>problems.push('rail joints by hand: '+text);
  const JOINT_CODES=['end-bearing','rail-joint','post-offset'];
  const upright=(x,y,h)=>[0,20.5].map(z=>mk('Upright','2x4',[1.5,h,3.5],[x,y,z]));
  const frame=(from,to,y,crosses,deckCuts)=>[
    ...[0,22.5].map(z=>mk('Rail','2x4',[to-from,3.5,1.5],[from,y,z])),
    ...crosses.map(x=>mk('Cross piece','2x4',[1.5,3.5,21],[x,y,1.5])),
    ...deckCuts.slice(0,-1).map((a,i)=>mk('Shelf deck','ply12',[deckCuts[i+1]-a,.5,24],[a,y+3.5,0]))];
  const tank=(x,y,length,gal)=>{const t=mk('Tank','tank',[length,12,23],[x,y,.5]);t.gal=gal;return t;};   // its edges over the rails
  const codesOf=parts=>verifyDesign(parts,{uses:RACK_USES,namedJoints:RACK_JOINTS,wallFixed:true}).problems.map(f=>f.code).filter(c=>JOINT_CODES.includes(c));
  const lower=(deck,under)=>[...under,
    ...frame(0,31.5,20,[0,30],[]),...frame(31.5,63,20,[31.5,61.5],[]),
    ...deck.slice(0,-1).map((a,i)=>mk('Shelf deck','ply12',[deck[i+1]-a,.5,24],[a,23.5,0])),tank(1.5,24,60,40)];
  const twoUprights=[...upright(0,0,20),...upright(30,0,20),...upright(31.5,0,20),...upright(61.5,0,20)];
  const good=codesOf(lower([0,63],twoUprights));
  if(good.length)say(`a joint over two uprights, with a cross piece under each end and one deck across it, is reported as ${good.join(', ')}`);
  const seam=codesOf(lower([0,31.5,63],twoUprights));
  if(!seam.includes('rail-joint'))say('a deck seam that lands on the rail joint is not reported');
  const oneUpright=[...upright(0,0,20),...upright(30.75,0,20),...upright(61.5,0,20)];
  const narrow=[...oneUpright,...frame(0,31.5,20,[0],[]),...frame(31.5,63,20,[61.5],[]),mk('Shelf deck','ply12',[63,.5,24],[0,23.5,0]),tank(1.5,24,60,40)];
  if(!codesOf(narrow).includes('end-bearing'))say('two rail ends that share one 2x4 upright (3/4" each) are not reported');
  const offset=[...lower([0,63],twoUprights),...upright(0,24,20),...upright(15,24,20),...frame(0,16.5,44,[0,15],[0,16.5]),tank(1.5,48,13,10)];
  if(!codesOf(offset).includes('post-offset'))say('an upright standing on a deck over the middle of a bay is not reported');
});
/* A 4x4 upright under a rail joint carries both rail ends, and the two together are one span of the rail (half
   of each neighbouring bay), the same as any upright inside a rail: the structural check once counted a full
   span for each end, twice what rackPlan says, and refused walls of 4x4 uprights that the planner offered and
   that separate sections built clean. Here: walls of 4x4 uprights under heavy tanks, high and deep, on every
   board, built as one wall, must come out clean; and the load the check gives each upright (read off the model
   it works on) is never above what the plan says the hardest-working upright carries, nor the joint upright far
   below it. */
SELFTESTS.push(function fourByFourJointCarriesOneSpan(problems){
  const say=text=>problems.push('4x4 rail joints: '+text);
  const rack=PRESETS.find(p=>p.name==='Fish tank wall / rack');
  if(!rack){say('the Fish tank wall / rack preset is missing');return;}
  const valuesOf=(key,changes)=>{
    const t=TANKS[key];
    return{...presetDefaults(rack),size:key,tl:t[0],td:t[1],th:t[2],gal:t[3],clr:Math.max(8,Math.ceil(t[2]/2)),up:'4x4',H:120,maxD:60,build:'one',...changes};
  };
  const cases=[];
  for(const W of[150,300,500])for(const board of['96','120','144'])cases.push(['g20l',{W,board}]);
  cases.push(['g40b',{W:245,board:'120',levels:'3'}],['g75',{W:300,board:'96'}]);
  let joints=0;
  for(const[key,changes]of cases){
    const vals=valuesOf(key,changes),plan=rackPlan(vals),what=`${key} ${JSON.stringify(changes)}`;
    if(!plan||plan.flawed)continue;
    const lay=rackLayout(plan,plan.mods[0]);
    joints+=lay.railJoints.length;
    // the model the check works on, caught on its way through verifyPosts and put back at once
    const verifyPostsAsItIs=window.verifyPosts;
    let model=null,result=null;
    window.verifyPosts=function(m,found){model=m;return verifyPostsAsItIs(m,found);};
    try{const parts=rack.build(vals);result=verifyDesign(parts,{...presetOptions(rack,vals),wallScrews:rack.wallScrews(vals,parts)});}
    finally{window.verifyPosts=verifyPostsAsItIs;}
    const stops=result.problems.map(f=>f.code);
    if(stops.length)say(`${what}: the planner builds it but the check says ${stops.join(', ')}`);
    const uprights=model.wood.filter(n=>n.cls==='post'&&(n.name==='Upright'||n.name==='Foot'));   // (a foot carries every row, like the plan's hardest-working upright)
    const most=Math.max(0,...uprights.map(V=>postLoadOf(V,model)));
    if(most>plan.upLoad*1.02)say(`${what}: the check gives an upright ${Math.round(most)} lb, the plan says the most is ${Math.round(plan.upLoad)} lb`);
    // the 4x4 straight under a rail joint of the bottom row of tanks (the most loaded level)
    const jointX=lay.railJoints[0];
    if(jointX!==undefined){
      const under=uprights.filter(V=>V.lo[0]<jointX&&V.hi[0]>jointX).map(V=>postLoadOf(V,model));
      if(!under.length||Math.max(...under)<plan.upLoad*.9)say(`${what}: the upright under a rail joint is given ${Math.round(Math.max(0,...under))} lb, less than the ${Math.round(plan.upLoad)} lb of one span`);
    }
  }
  if(!joints)say('none of the walls has a rail joint to check');
});
/* The thin back panels of a closed cabinet base meet on wood (backSeams in js/builders-fish.js): one wall made
   the back wider than the old sections ever were, and the seams, shared out evenly, landed over open bays.
   The cabinet stand at every 6" of length and the rack's cabinet base for a few tanks at every 24", both ways
   of building, must have no seam without an upright or a panel stud behind both edges (fishShopProblems); and a
   tall cabinet with bays wider than a standing sheet gets panel studs, and its structural check stays clean
   (a panel stud carries no tank weight). */
SELFTESTS.push(function backPanelsMeetOnWood(problems){
  let reported=0;
  const say=text=>{if(reported++<8)problems.push('back panels: '+text);};
  const rack=PRESETS.find(p=>p.name==='Fish tank wall / rack'),cabinet=PRESETS.find(p=>p.name==='Cabinet stand with a row of tanks');
  if(!rack||!cabinet){say('a fish preset is missing');return;}
  const tankOf=key=>{const t=TANKS[key];return{size:key,tl:t[0],td:t[1],th:t[2],gal:t[3],clr:Math.max(8,Math.ceil(t[2]/2))};};
  const look=(preset,vals,what,board)=>{
    const parts=preset.build(vals);
    if(parts.length)fishShopProblems(parts,board).forEach(message=>say(`${what}: ${message}`));
    return parts;
  };
  for(let W=24;W<=600;W+=6)for(const build of['one','sections'])look(cabinet,{...presetDefaults(cabinet),W,build},`cabinet stand ${W} ${build}`,96);
  for(const key of['g10','g40b','g75'])for(let W=48;W<=600;W+=24)for(const build of['one','sections'])
    look(rack,{...presetDefaults(rack),...tankOf(key),W,build,base:'cabinet',brace:false},`rack ${key} ${W} ${build}`,96);
  let studs=0;
  for(const changes of[{W:200},{W:96,maxD:60},{W:200,build:'sections',low:36}]){
    const vals={...presetDefaults(rack),...tankOf('g125'),H:120,base:'cabinet',brace:false,storeH:48,...changes},what=`a tall cabinet of 125 gallon tanks ${JSON.stringify(changes)}`;
    // (the panel studs behind the back stand against it, at the back; those of the side panels stand inside the ends)
    studs+=look(rack,vals,what,96).filter(p=>p.name==='Panel stud'&&p.pos[2]===0).length;
    const check=checkPreset(rack,vals);
    if(check.problems.length)say(`${what}: ${check.problems.map(f=>f.code).join(', ')}`);
  }
  if(!studs)say('no tall cabinet got a panel stud behind a back seam, so that case is not checked');
});
/* Every width from 24" to 600" (in steps of 24"), each board length, each upright size, with and without a base,
   both ways of building, for the rack and the cabinet stand: the plan is sound, every rail piece is within the
   board, every rail end sits on at least 1 1/2" of upright, the wall is no wider than typed, and there are never
   fewer tanks than the program gave before (RACK_MAIN_COUNTS). Then a share of those (every 96") is built and put
   through the preset's own check and the structural check, which must both be clean. */
SELFTESTS.push(function fishWallEveryWidth(problems){
  let reported=0;
  const say=text=>{if(reported++<12)problems.push('fish wall sweep: '+text);};
  const rack=PRESETS.find(p=>p.name==='Fish tank wall / rack'),cabinet=PRESETS.find(p=>p.name==='Cabinet stand with a row of tanks');
  if(!rack||!cabinet){say('a fish preset is missing');return;}
  if(rackMainCountsSum(RACK_MAIN_COUNTS)!==RACK_MAIN_SUM)say('the table of the counts the program gave before (RACK_MAIN_COUNTS) does not match its check sum: it was copied wrong');
  const mainRack=RACK_MAIN_COUNTS.split('|').map(row=>row.split('.').map(v=>parseInt(v,36)));
  const mainCabinet=CABINET_MAIN_COUNTS.split('|').map(row=>row.split('.').map(v=>parseInt(v,36)));
  const tryOne=(preset,vals,args,mainCount,full)=>{
    const what=`${preset.name} ${JSON.stringify(Object.fromEntries(Object.entries(vals).filter(([k])=>['W','up','board','base','build','levels'].includes(k))))}`;
    let pl=null;
    try{pl=rackPlan(args);}catch(e){say(`${what}: the plan threw "${e.message}"`);return;}
    // The program before gave a cabinet base the whole width for its frame, and its side panels then made it 1/2"
    // wider than typed. Now the panels come out of the width, so the count it gave is compared with the plan for
    // the width it really used (the way of fitting bays must not lose tanks); the width typed is checked below.
    const panels=sidePanelsWidth(args),asBefore=panels?rackPlan({...args,W:args.W+panels}):pl;
    const count=asBefore?asBefore.count:0;
    if(count<mainCount)say(`${what}: ${count} tanks, fewer than the ${mainCount} the program gave before`);
    if(!pl)return;
    if(pl.flawed)say(`${what}: the plan is not sound (${pl.over?'overloaded':''}${pl.shallow.length?' shallow rows':''})`);
    rackPlanFaults(pl,args.W-panels).forEach(fault=>say(`${what}: ${fault}${panels?' (with the side panels)':''}`));
    if(!full)return;
    const check=checkPreset(preset,vals);
    if(check.problems.length)say(`${what}: ${check.problems.map(f=>f.level+' '+f.code+': '+f.text).join(' / ')}`);
    else fishShopProblems(check.parts,pl.board).forEach(message=>say(`${what}: ${message}`));
    // the outside of every piece that is built, side panels and doors too
    const wood=check.parts.filter(part=>!isProp(part)),outside=wood.length?Math.max(...wood.map(part=>box(part).hi[0]))-Math.min(...wood.map(part=>box(part).lo[0])):0;
    if(outside>args.W+1e-6)say(`${what}: built ${fmt(r16(outside))} wide, wider than the ${fmt(args.W)} typed`);
  };
  let row=0;
  for(const base of RACK_SWEEP.bases)for(const up of RACK_SWEEP.ups)for(const board of RACK_SWEEP.boards){
    const counts=mainRack[row++];
    RACK_SWEEP_WIDTHS.forEach((W,i)=>{
      for(const build of['one','sections']){
        const vals={...presetDefaults(rack),W,up,board,base,build};
        // the structural check on a share of them: every 96" for Auto, every 192" for the forced sizes
        const full=(W-24)%(up==='auto'?96:192)===0&&(board==='96'||board==='144');
        tryOne(rack,vals,vals,counts[i],full);
      }
    });
  }
  // cabinet bases whose bays are wide enough for door stiles, standing on feet and on the floor: each stile has a
  // cross piece under it (and a foot under that, on feet), and nothing is held up by a stile standing on air
  for(const[key,changes]of[['g100',{low:36,W:240}],['g10',{low:6,W:240}],['g125',{low:36,W:420}]]){
    const t=TANKS[key];
    let stiles=0;
    for(const build of['one','sections']){
      const vals={...presetDefaults(rack),size:key,tl:t[0],td:t[1],th:t[2],gal:t[3],clr:Math.max(8,Math.ceil(t[2]/2)),base:'cabinet',brace:false,storeH:16,build,...changes};
      const pl=rackPlan(vals);
      if(pl)stiles+=pl.mods.reduce((sum,m)=>sum+rackLayout(pl,m).front.stiles.length,0);
      tryOne(rack,vals,vals,0,true);
    }
    if(!stiles)say(`${key} ${JSON.stringify(changes)}: no door stile to check`);
  }
  // the small tanks make the narrow pairs of doors, so the most door stiles: their layout alone (no build) at
  // every 6" of width, both ways of building, on the rack and the cabinet stand
  for(const key of RACK_STILE_TANKS)for(let W=24;W<=600;W+=6)for(const build of['one','sections'])for(const board of['96','120']){
    const t=TANKS[key],tank={size:key,tl:t[0],td:t[1],th:t[2],gal:t[3],clr:Math.max(8,Math.ceil(t[2]/2))};
    const onRack={...presetDefaults(rack),...tank,W,board,build,base:'cabinet',brace:false},onCabinet=cabArgs({...presetDefaults(cabinet),...tank,W,build});
    for(const args of board==='96'?[onRack,onCabinet]:[onRack]){
      const pl=rackPlan(args);
      if(pl)rackPlanFaults(pl,args.W-sidePanelsWidth(args)).forEach(fault=>say(`${key} W ${W} ${build} ${args===onCabinet?'cabinet stand':'board '+board}: ${fault}`));
    }
  }
  row=0;
  for(const up of RACK_SWEEP.cabinetUps)for(const levels of RACK_SWEEP.cabinetRows){
    const counts=mainCabinet[row++];
    RACK_SWEEP_WIDTHS.forEach((W,i)=>{
      for(const build of['one','sections']){
        const vals={...presetDefaults(cabinet),W,up,levels,build};
        tryOne(cabinet,vals,cabArgs(vals),counts[i],(W-24)%192===0);
      }
    });
  }
});
/* "Build it as" shows only when the wall typed is longer than the longest board chosen: the default 10 ft wall on
   8 ft boards shows it, a 90" wall or a 130" wall on 16 ft boards does not, and then the remark under the form says
   nothing about the choice (the wall is one frame either way). */
SELFTESTS.push(function buildItAsOnlyWhenItMatters(problems){
  const say=text=>problems.push('Build it as: '+text);
  const rack=PRESETS.find(p=>p.name==='Fish tank wall / rack');
  if(!rack)return;
  const usual=presetDefaults(rack),field=rack.params.find(q=>q.k==='build');
  if(!field||!field.show){say('the field has no show rule');return;}
  if(!field.show(usual))say('it is hidden on the default 10 ft wall of 8 ft boards');
  for(const changes of[{W:90},{W:130,board:'192'}]){
    const vals={...usual,...changes};
    if(field.show(vals))say(`it shows on a wall no longer than its boards ${JSON.stringify(changes)}`);
    if(/Build it as/.test(rack.info(vals)))say(`the remark under the form talks about it on a wall that is one frame anyway ${JSON.stringify(changes)}`);
    const pl=rackPlan(vals);
    if(pl&&(pl.mods.length!==1||(pl.mods[0].stretches||[]).length>1))say(`a wall no longer than its boards is not one frame ${JSON.stringify(changes)}`);
  }
});
