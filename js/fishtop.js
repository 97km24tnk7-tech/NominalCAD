/* NominalCAD: the countertop of a closed fish tank cabinet.

   The owner (17 Nov), on the Single aquarium stand and the Cabinet stand with a row of tanks: "we want one flat
   countertop I noticed we have thin plywood meeting up with a countertop that doesn't cover it", and "no need to see
   [the screws] if we don't have too". So wherever a fish preset closes the space under its tanks in with thin
   plywood panels (the Single aquarium stand with a cabinet or with panels, the Cabinet stand, a Fish tank wall / rack
   on a cabinet base), the deck of the frame right over that cabinet is ONE flat countertop of 3/4" plywood that
   covers the top edges of both side panels, the back panel and the doors, which all stop under it. It is held on
   from underneath (TOP_JOINTS in js/builders-fish.js), so no screw head shows on it in Everyday and Fine furniture.

   The sizes come from reference sheet 26 (design\reference\26-aquarium-stand-tops.md), which corrects the brief's
   starting point in one place: the top is flush with the back of the back panel and reaches 1/2" past each side
   panel, as the brief said, but 1/2" past the door faces at the front too (rule 8: 1/2" past what it covers), so
   1 1/4" past the front of the frame, not the brief's 1" (1/4" past the doors); the sheet adds the even 1/8" gaps
   of the doors under it (rule 10), the 1 1/2" most a 3/4" top may hang past its frame (rule 7) and banding on the
   plywood edges that show (rule 11).

     FISH_TOP               every number, with where it comes from
     hasCountertop(p)       does a plan's arguments call for one
     fishCountertop(...)    the pieces of the countertop over one section of a plan (cut over a doubled cross piece
                            when it is longer than a sheet)
     countertopUnderside(pl), fishDoorHeight(pl), fishTopSidePast(), fishTopEndPast(), fishTopFront(pl),
     fishTopDepthPast(pl), fishTopDepthMost(brace)
     the words the notes and steps share, and the self-checks of the owner's complaint (at the end of this file)

   More rows of tanks over the countertop (a Cabinet stand with 2 or 3 rows, a Fish tank wall on a cabinet base):
   nothing passes up through the countertop. The cabinet is a stand of its own with short posts under the
   countertop, and the rows above are a rack that stands on the countertop, its posts straight over the posts of the
   cabinet and its uprights over the uprights of the cabinet (reference sheet 26 section 6: a builder sets each
   level on the one below; a hutch on a cabinet). The posts used to run the full height through closed openings in
   the countertop, which could only be built in a room about as tall as a post plus the countertop's height (the
   real-thing review of 20 Nov, M2), and where two separate sections met the countertop was notched open to its
   front edge over the door tops (M4). The question of which way stays with the owner (the team's report). */
'use strict';

const FISH_TOP={
  t:.75,mat:'ply34',  // 3/4" plywood, cabinet grade (sheet 26, rule 1: it comes flat; never particleboard)
  panel:M.ply14.t,    // the thin side and back panels it covers (1/4" plywood, sheet 26 section 4; cabinetSkin cuts them)
  side:.5,            // past the outside of each side panel (sheet 26 rule 8: panel thickness + 1/2")
  front:1.25,         // past the front of the frame: over the 3/4" doors and 1/2" past their faces, as at the sides
                      // (sheet 26 rule 8: 1/2" past what it covers, with full overlay doors their thickness added;
                      // the brief started from the Base cabinet's 1", 1/4" past the doors, and the sheet wins);
                      // sheet 26 rule 7 allows 1 1/2" of 3/4" plywood past its frame
  frontOpen:.5,       // past the front of the frame when there are no doors (closed back and sides, open front):
                      // 1/2" past what it covers, as at the sides (sheet 26 rule 8)
  post:1.5,           // the posts stand outside the ends of the frames, 1 1/2" thick (buildRack)
  reveal:.125,        // between the tops of the doors and the underside of the countertop (sheet 26 rule 10)
  floor:.5,           // the doors stand this far off the floor (a 1/2" scrap under them when they are hung)
  // The edges that show (the front and the two ends of the countertop, and all four edges of every door; the back
  // goes against the wall) get iron-on edge banding, so the layers of the plywood do not show (sheet 26 rule 11 and
  // section 7, item 2: the cheapest cure for the cheapest look; 13/16" banding for 3/4" plywood). The same roll the
  // Computer desk buys (price row edge-banding, js/prices.js); 10% more for trimming.
  banding:{roll:25,label:'Edge banding, 13/16" iron-on, 25 ft roll',spare:1.1}
};
/* The least sizes the Cabinet stand's form takes (js/presets.js). Held from inside like the Fine furniture it now is
   in Everyday too, a frame under tanks less than 9" front to back (less than 10" deep) has its cross pieces' pocket
   screws run into those that hold the feet of its uprights in the back rail, which no settling of the screws can
   part (it was so in Fine furniture before this); and a cabinet less than 7" tall inside leaves under 4" for the
   drill at those feet (DRIVER_ROOM.least, js/buildsteps.js), in every style. Found by the house furniture checks.
   The tanks of the form's list that are shallower than that are left off its list (cabinetStandTankOpts), so no
   choice of the list leads only to a red box. */
const CABINET_STAND_LEAST={td:9,storeH:7};
const CABINET_STAND_TD_WHY='A cabinet stand is held together from inside, with no screw heads on show, and a frame under a tank less than 9" front to back has no room to keep those screws apart. For a smaller tank, use the Single aquarium stand.';
/* the tank list of the Cabinet stand's form: the tanks it can take (CABINET_STAND_LEAST) */
const cabinetStandTankOpts=opts=>opts.filter(([key])=>!TANKS[key]||TANKS[key][1]>=CABINET_STAND_LEAST.td-1e-6);
/* the deck of this row (counted from the floor, 0 = the cabinet) is the countertop */
const COUNTERTOP_ROW=1;
/* A plan's arguments call for a countertop when the space under the tanks is closed in: a cabinet base (the rack and
   the Cabinet stand) or a single stand closed in with panels, with or without doors (standArgs sets `closed`). */
const hasCountertop=p=>!!p&&(p.base==='cabinet'||p.closed==='doors'||p.closed==='panels');
/* how far the countertop reaches past the outside of the end posts at an end with a side panel */
const fishTopSidePast=()=>FISH_TOP.panel+FISH_TOP.side;
/* how far it reaches past the end of the frame (the ends of its rails) there: the post, the panel and the overhang */
const fishTopEndPast=()=>FISH_TOP.post+fishTopSidePast();
/* how far it reaches past the front of the frame: over the doors and past them, or past an open front */
const fishTopFront=pl=>pl.doors?FISH_TOP.front:FISH_TOP.frontOpen;
/* how far the wood of a plan reaches past the ends of each section's frame, for the screws into the wall
   (rackWallScrewPlan, js/rackwall.js, works a pull at the very end of the top as the structural check does): the
   countertop over the side panels, or the 1/4" the program has always allowed for the panels */
const rackPastEnds=pl=>pl.countertop?fishTopSidePast():.25;
/* how far it reaches past the frame front and back together: the back panel behind, and its overhang in front */
const fishTopDepthPast=pl=>FISH_TOP.panel+fishTopFront(pl);
/* the most a cabinet base reaches past its frame front and back: the countertop over the doors in front, and behind
   the back panel, or the 1x4 braces (3/4") when braces go across the back: what it must leave room for within "Max
   depth from wall" (brace: the braces are asked for) */
const fishTopDepthMost=brace=>FISH_TOP.front+(brace?.75:FISH_TOP.panel);
/* the underside of the countertop: the top of the rails of its frame; the panels stop here */
const countertopUnderside=pl=>pl.rows[COUNTERTOP_ROW].y+pl.rh;
/* the height of the cabinet doors: off the floor by FISH_TOP.floor, and FISH_TOP.reveal under the countertop */
const fishDoorHeight=pl=>r16(countertopUnderside(pl)-FISH_TOP.floor-FISH_TOP.reveal);
/* Are there rows of tanks above the one on the countertop? Then they stand on it as a rack of their own, with posts
   of their own over the posts of the cabinet (buildRack splits every post at the countertop). */
const postsPassTop=pl=>pl.n>COUNTERTOP_ROW+1;
/* the posts of a plan with rows above the countertop: the cabinet's, from the floor to its underside, and the upper
   ones, from its top to the top of the top frame's rails: [{y, h}] */
function fishPostRuns(pl){
  if(!(pl.countertop&&postsPassTop(pl)))return[{y:0,h:pl.postH}];
  const low=countertopUnderside(pl),high=r16(low+FISH_TOP.t);
  return[{y:0,h:r16(low)},{y:high,h:r16(pl.postH-high)}];
}

/* Where the countertop of one section is cut, measured from the section's left end like the frame (rackLayout works
   it out with the cross pieces, addCountertopCrossPieces). from, to, depth: kept for the callers; the layout holds
   the cuts for the whole length of the section's countertop. */
function countertopSeams(pl,m){
  return(rackLayout(pl,m).countertopSeams||[]).slice();
}
/* The cut places of a countertop from `from` to `to` (from the section's left end): never longer than a sheet (8 ft
   along, or 4 ft when the top is deeper than a sheet is wide), each over the middle of a cross piece inside a bay
   so both pieces rest on wood there and no upright above stands on the seam (sheet 26 rule 15: a seam lands on a
   frame member). addCountertopCrossPieces then doubles the cross piece under each one. */
function planCountertopSeams(lay,from,to,depth){
  const longest=fitsSheet(SHEET_L,depth)?SHEET_L:SHEET_W;
  const clear=countertopSeamClear(lay),middles=list=>list.map(x=>r16(x+.75)).filter(clear);
  const inBays=middles(lay.inBay),anyCross=middles([...new Set([...lay.inBay,...lay.under])]);
  if(to-from<=longest+1e-6)return[];
  // As few pieces as the sheets allow, and of those ways the one whose longest piece is shortest, so the pieces come
  // out as near the same length as the cross pieces let them be (a woodworker centres a seam: a 109 1/2" top is two
  // pieces of about 55", not 96" and a 13 1/2" scrap at one end whose grain would run the other way). Seams over
  // the cross pieces inside the bays first; over any cross piece clear of the uprights only when those cannot do it.
  // (a shortest path over the places a seam may go: each step no longer than a sheet)
  const way=places=>{
    const nodes=[from,...places.filter(x=>x>from+1&&x<to-1).sort((a,b)=>a-b),to];
    const best=nodes.map(()=>null);
    best[0]={pieces:0,most:0,back:-1};
    for(let i=1;i<nodes.length;i++)for(let j=0;j<i;j++){
      const length=nodes[i]-nodes[j];
      if(!best[j]||length>longest+1e-6||length<1)continue;
      const tried={pieces:best[j].pieces+1,most:Math.max(best[j].most,length),back:j};
      if(!best[i]||tried.pieces<best[i].pieces||(tried.pieces===best[i].pieces&&tried.most<best[i].most-1e-6))best[i]=tried;
    }
    const last=nodes.length-1;
    if(!best[last])return null;
    const seams=[];
    for(let i=best[last].back;i>0;i=best[i].back)seams.unshift(nodes[i]);
    return seams;
  };
  // (no way at all: no cross piece within a sheet; fishShopProblems then reports a piece too long)
  return way(inBays)||way([...new Set([...inBays,...anyCross])])||[];
}
/* Is a seam at x (from the left end of a section) clear of every line of uprights and door stile, where an upright
   or a stile would stand on it (the rule of deckSeams in js/rackjoints.js)? */
function countertopSeamClear(lay){
  const keepOut=lay.lines.map(L=>[L.x-.01,L.x+L.w+.01]).concat(lay.front.stiles.map(x=>[x-.01,x+1.51]));
  return x=>!keepOut.some(([a,b])=>x>a&&x<b);
}
/* Where no cross piece inside a bay is within a sheet's reach of the last seam of the countertop (bays shorter than
   16" have none), one is added in the middle of the farthest bay that is, as deckSeams does for the decks, so that
   the countertop's seam lands on wood (rackLayout calls this while it lays out a section; lay.inBay gets it, so
   every frame has it). The countertop reaches past the frame, so it may need a seam where the decks do not (a deep
   cabinet whose 48" deck fits a sheet across, and whose countertop, 49 1/2" long, does not). */
function addCountertopCrossPieces(pl,m,lay){
  if(!pl.countertop)return;
  const first=m===pl.mods[0],last=m===pl.mods[pl.mods.length-1];
  const from=first?-fishTopSidePast():0,to=m.W+(last?fishTopSidePast():0);
  const depth=pl.D+fishTopDepthPast(pl);   // (the deepest it can be: with a back panel)
  addCrossPiecesInReach(pl,lay,from,to,depth);
  lay.countertopSeams=doubleUnderSeams(lay,planCountertopSeams(lay,from,to,depth));
}
/* Reference sheet 26 rule 15: a seam of the countertop lands on a DOUBLED cross rail. A single 2x4 cross piece gives
   each piece only 3/4" to rest on, and the pocket screws from it end about 1/4" from the cut edge, where they split
   the face veneer or lift a bump beside the seam (the real-thing review, S3). So a second cross piece is laid tight
   beside the one under each seam, and the seam moves to the line where the two meet: each piece of the countertop
   rests on 1 1/2" of its own cross piece, and the pocket screws from that cross piece (drilled in its face away from
   its twin, fishStandHiddenFace) end about 1" from the cut edge. The twin goes on the right of the cross piece, or
   on its left where the right is taken (another cross piece, a line of uprights, a door stile). Returns the seams. */
function doubleUnderSeams(lay,seams){
  const clear=countertopSeamClear(lay);
  const others=()=>[...lay.inBay,...lay.under,...(lay.stileCross||[])];
  const free=(x,skip)=>others().every(c=>c===skip||Math.abs(c-x)>=1.5-1e-6);
  lay.twins=[];
  return seams.map(seam=>{
    const cross=r16(seam-.75);
    for(const twin of[r16(cross+1.5),r16(cross-1.5)]){
      const joint=twin>cross?twin:cross;   // the line where the two cross pieces meet
      if(!free(twin,cross)||!clear(joint))continue;
      lay.inBay.push(twin);
      lay.twins.push(twin);
      return joint;
    }
    return seam;   // (no room for a twin: fishShopProblems and the self-check report the single cross piece)
  });
}
/* Where no cross piece inside a bay is within a sheet's reach of the last seam (see addCountertopCrossPieces). */
function addCrossPiecesInReach(pl,lay,from,to,depth){
  const longest=fitsSheet(SHEET_L,depth)?SHEET_L:SHEET_W,clear=countertopSeamClear(lay);
  let start=from;
  for(let guard=0;guard<100&&to-start>longest+1e-6;guard++){
    const reach=x=>x>start+1&&x<=start+longest+1e-6;
    const mids=lay.inBay.map(x=>r16(x+.75)).filter(x=>clear(x)&&reach(x));
    if(mids.length){start=Math.max(...mids);continue;}
    const roomFor=mid=>lay.inBay.concat(lay.stileCross||[]).every(c=>Math.abs(mid-.75-c)>=1.5-1e-6);
    const bay=lay.bay.filter(b0=>{const mid=b0+pl.B/2;return reach(mid)&&clear(mid)&&roomFor(mid);}).pop();
    if(bay===undefined)return;   // (fishShopProblems reports a countertop piece longer than a sheet)
    const cx=r16(bay+pl.B/2-.75);
    lay.inBay.push(cx);
    lay.added.push(cx);
    start=cx+.75;
  }
}
/* The countertop over section m of plan pl, which starts at x = ox; row: the row whose deck it is; skin: which sides
   are closed in ({left, right, back}). Returns its pieces.
   Along the length it reaches fishTopSidePast() past an end with a side panel, and stops flush with the end of the
   section elsewhere (where two separate sections meet, over the tops of their end posts). At the front it reaches
   fishTopFront(pl) past the frame. At the back it is flush with the back of the back panel; with braces across the
   back instead, flush with the frame. Rows of tanks above stand on it: nothing passes through it (fishPostRuns). */
function fishCountertop(pl,m,ox,row,skin){
  const D=pl.D,y=row.y+pl.rh;
  const from=skin.left?-fishTopSidePast():0,to=m.W+(skin.right?fishTopSidePast():0);
  const back=-countertopBackPast(pl,skin.back),front=D+fishTopFront(pl),depth=front-back;
  // (the layout's seams are worked out over the whole length of a section's countertop: keep those inside this one)
  const cuts=[from,...countertopSeams(pl,m).filter(x=>x>from+1&&x<to-1),to];
  const pieces=[];
  for(let i=0;i<cuts.length-1;i++)pieces.push(mk('Countertop',FISH_TOP.mat,[r16(cuts[i+1]-cuts[i]),FISH_TOP.t,r16(depth)],[ox+cuts[i],y,back]));
  return pieces;
}
/* ---------- the words the steps and notes share ---------- */
/* Where the back edge of the countertop goes, from the back of the frame (0: flush with it): flush with the back of
   the thin back panel, or with the frame when braces go across the back instead. */
const countertopBackPast=(pl,backPanel)=>backPanel?FISH_TOP.panel:0;
/* Where the countertop goes on its frame, for the step that fastens it (the frame lies upside down on it, and the
   posts go on later: so it is measured from the ends of the rails, fishTopEndPast). backPanel: a back panel goes on
   behind the frame. */
function countertopPlaceWords(pl,backPanel){
  const end=fmt(fishTopEndPast()),side=fmt(fishTopSidePast()),post=fmt(FISH_TOP.post),back=countertopBackPast(pl,backPanel);
  const later=`it reaches over the ${post} posts that go on later and ${side} past their outside, over the thin side panels`;
  const ends=pl.mods.length>1
    ?`${end} of it past the end of the frame at each end of the whole cabinet (${later}), and ${post} past the end of the frame where two sections meet (flush with the outside of the post there)`
    :`${end} of it past each end of the frame, the same at both ends (${later})`;   // ("with 2 1/4" of it past ...")
  return`with ${ends}, its front edge ${fmt(fishTopFront(pl))} in front of the frame (${pl.doors?`over the doors, and ${fmt(FISH_TOP.front-.75)} past them`:'past the open front'})`+
    (back?`, and its back edge ${fmt(back)} behind the frame${backPanel?' (flush with the back of the thin back panel that goes there)':''}`:', and its back edge flush with the back of the frame');
}
/* The countertop in pieces: where they meet, from its left end, or '' (sheet 26 rule 15: on a doubled cross piece,
   glued, lined up with biscuits). Built as separate sections, each section has its own piece (or pieces), and two
   meet over the tops of the end posts where the sections meet. */
function countertopSeamWords(pl){
  const places=[],joins=[];
  let ox=0;
  pl.mods.forEach((m,i)=>{
    for(const seam of countertopSeams(pl,m))places.push(fmt(r16(ox+seam+fishTopSidePast())));
    if(i>0)joins.push(fmt(r16(ox+fishTopSidePast())));
    ox+=m.W;
  });
  if(!places.length&&!joins.length)return'';
  const count=places.length+pl.mods.length;
  const joinWords=joins.length?` Each section has its own countertop: ${joins.length===1?'the two meet':'they meet'} at ${listWords(joins)} from the left end of the whole cabinet, over the tops of the end posts where the sections meet, each resting on its own post.`:'';
  if(!places.length)return joinWords;
  return` The countertop is longer than a sheet of plywood, so it is ${count} pieces: ${places.length===1?'the seam is':'the seams are'} at ${listWords(places)} from its left end. Under each seam the frame has two cross pieces side by side, and the seam lands on the line where they meet, so each piece rests on ${fmt(1.5)} of wood of its own and its pocket screws stay well in from its cut edge. Glue the seam, and line the two pieces up with biscuits (or a spline) in their cut edges, so their faces stay flush.${joinWords} A tank with a plastic frame round its bottom stands on that frame, so a seam under it does no harm; a rimless tank (no frame, the glass on the top) must not stand across a seam (reference sheet 26): ${pl.W+2*fishTopSidePast()<=120?'for one, make the countertop one piece from a 4 x 10 ft sheet of 3/4" plywood (a lumber yard can order one).':'set each one wholly on one piece of the countertop.'}`;
}
/* The edges of the countertop that are banded (the front, and the ends that have side panels under them), and all
   four edges of every door (they show on the front: the real-thing review, S7): inches. */
function countertopBandedInches(pl,backPanel){
  const length=pl.W+2*fishTopSidePast(),depth=pl.D+fishTopFront(pl)+countertopBackPast(pl,backPanel);
  return length+2*depth+doorBandedInches(pl);
}
/* all four edges of every door of a plan (cabinetSkin: the doors at the two ends reach over the side panels) */
function doorBandedInches(pl){
  if(!pl.doors)return 0;
  const height=fishDoorHeight(pl);
  let inches=0;
  pl.mods.forEach((m,i)=>{
    const doors=cabinetDoors(pl,m).doors;
    doors.forEach((door,k)=>{
      const over=(i===0&&k===0?FISH_TOP.panel:0)+(i===pl.mods.length-1&&k===doors.length-1?FISH_TOP.panel:0);
      inches+=2*(door.w+over+height);
    });
  });
  return inches;
}
/* the shopping list line of the banding: one roll or more */
function countertopBandingLine(pl,backPanel){
  const feet=countertopBandedInches(pl,backPanel)*FISH_TOP.banding.spare/12;
  return[FISH_TOP.banding.label,Math.max(1,Math.ceil(feet/FISH_TOP.banding.roll-1e-6))];
}
/* how to iron the banding on, for the countertop and for the doors */
const BANDING_HOW='set a household iron to cotton with no steam, press the banding on with its glue side down, let it cool, trim the overhang flush with an edge banding trimmer or a sharp chisel, then ease every banded edge and corner with 120 grit sandpaper on a block (or a 1/8" round-over bit in a router), so no sharp edge or banding corner catches. ';
const COUNTERTOP_BANDING_WORDS='First iron edge banding onto its front edge and its two ends (the back goes against the wall), so the layers of the plywood do not show: '+BANDING_HOW;
const DOOR_BANDING_WORDS='Iron edge banding onto all four edges of each door now, as on the countertop, so the doors are sanded and finished with the rest and no plywood layers show on the front: '+BANDING_HOW;
/* The words for fastening the top onto its frame in a build style. what: 'countertop' or 'top deck'; place: where it
   goes on the frame (countertopPlaceWords, or the top deck's own words); backPanel: a thin back panel goes on over
   the back face of the back rail later, and then the pocket holes of that rail are drilled in that face, where they
   are covered for good (coveredForGood, js/fasteners.js); else on its inside face like the rest (the real-thing
   review, S6; the self-check fishTopsShowNoScrews holds the words to the model). */
function topOnFrameWords(style,what,place,backPanel){
  const thin=what==='top deck';   // (1/2" plywood: RACK_DECK)
  if(style==='rustic')return`Set the ${what} on the frame, ${place}, glue it and screw it down from above with the screws listed below, about one every 8" into the rails and two into each cross piece. Drive each head a little below the surface, so it is flush or just under it: their heads show on top (that is the Rustic / rough look), and a head left standing proud under the rim of a tank is a hard spot the tank rocks on.`;
  const holes=backPanel?'they are on the inside faces of the front rail and the cross pieces, and on the back face of the back rail (the face toward the wall, which the thin back panel covers later)':'they are on the inside faces of the rails and the cross pieces';
  return`The ${what} is held from underneath, so no screw head shows on it: lay it face down on a flat, clean surface (an old blanket keeps the face from scratching), set the frame upside down on it, ${place}, spread glue on the edges of the frame that touch it, and drive the pocket screws listed below up through the pocket holes into it: ${holes}. They are short enough to stop under its top face. `+
    `Store plywood is a little thinner than its name, so drive the first one into a scrap of the same sheet and check that its point stays under the face before you drive the rest${thin?'; in 1/2" plywood the glue is what holds the top on, and the screws hold it while the glue dries':''}. You have room for the drill here, with nothing over the frame.`;
}
/* the note that says what the countertop is and the true outside size, for the notes of the presets */
function countertopNote(pl,thing,backPanel){
  const covers=[...(backPanel===false?['side panels']:['side panels','back panel']),...(pl.doors?['doors']:[])];
  return`Countertop: one flat piece of 3/4" plywood over the whole ${thing} (or pieces that meet over a doubled cross piece, when it is longer than a sheet). It reaches ${fmt(FISH_TOP.side)} past the thin side panels and ${pl.doors?`${fmt(FISH_TOP.front-.75)} past the doors`:`${fmt(FISH_TOP.frontOpen)} past the open front`}, and the ${listWords(covers)} all stop under it, so no thin plywood edge shows from above. Its front edge and its ends get iron-on edge banding${pl.doors?', and so do all the edges of the doors':''}. It is held from underneath in Everyday and Fine furniture, so no screw head shows on it.`+
    (postsPassTop(pl)?' The rows of tanks above stand on it as a rack of their own: their posts stand on the countertop straight over the posts of the cabinet, and nothing passes through it.':'');
}

/* ---------- self-checks: what the owner saw on 17 Nov, caught before the site ---------- */
/* Is there countertop wood at world (x, z) in this piece (inside its outline and outside its openings)? */
function countertopWoodAt(piece,x,z){
  const at=[x,0,z],u=at[piece.ax[0]]-piece.pos[piece.ax[0]],v=at[piece.ax[1]]-piece.pos[piece.ax[1]];
  if(u<-1e-6||v<-1e-6||u>piece.l+1e-6||v>piece.w+1e-6)return false;
  if(!hasShape(piece))return true;
  const outline=shapeOutline(piece),loop=outline.outer.map(q=>[q.u,q.v]);
  return pointInLoop(u,v,loop)&&!outline.openings.some(ring=>pointInLoop(u,v,ring));
}
/* The cases the checks below try: every fish preset at its usual sizes and at the smallest and largest of each
   number of its form (the 50 ft wall of the rack is too slow to place here: a 20 ft one stands in for it), with
   each choice that closes the space under the tanks or opens it, and a cabinet under more rows. */
function fishTopCases(){
  const named=name=>PRESETS.find(preset=>preset.name===name);
  const stand=named('Single aquarium stand'),cabinet=named('Cabinet stand with a row of tanks'),rack=named('Fish tank wall / rack');
  const cases=[];
  const add=(preset,vals,where)=>{if(preset)cases.push({preset,vals,where});};
  const sizes=preset=>preset?sizesToTry(preset).map(({vals,where})=>({vals:{...vals},where})):[];
  for(const{vals,where}of sizes(stand))add(stand,vals,where);
  if(stand){
    for(const under of['panels','shelf','tank'])add(stand,{...presetDefaults(stand),under},`under: ${under}`);
    add(stand,{...presetDefaults(stand),size:'custom',tl:96,td:24,th:24,gal:240,standH:40},'a 96" tank: a countertop longer than a sheet');
  }
  for(const{vals,where}of sizes(cabinet))add(cabinet,vals,where);
  if(cabinet){
    const usual=presetDefaults(cabinet);
    add(cabinet,{...usual,levels:'2'},'two rows of tanks: a rack on the countertop');
    add(cabinet,{...usual,levels:'3',size:'g10',storeH:12},'three rows of 10 gallon tanks');
    add(cabinet,{...usual,W:200},'200" long: the countertop in pieces');
    add(cabinet,{...usual,levels:'2',W:120,build:'sections'},'two rows built as separate sections');
    add(cabinet,{...usual,W:120,build:'sections'},'one row built as separate sections');
  }
  for(const{vals,where}of sizes(rack)){if(vals.W>300)vals.W=240;add(rack,vals,where);}
  if(rack){
    const usual=presetDefaults(rack);
    add(rack,{...usual,base:'cabinet'},'a cabinet base');
    add(rack,{...usual,base:'cabinet',brace:false},'a cabinet base with a back panel');
    // the cabinet base at the smallest and largest of each number of the rack's form (the countertop of a rack on a
    // cabinet base was tried at its usual sizes only before: the code review, 13)
    for(const{vals,where}of sizes(rack)){if(vals.W>300)vals.W=240;add(rack,{...vals,base:'cabinet'},`a cabinet base, ${where}`);}
    add(rack,{...usual,base:'cabinet',W:240,build:'sections'},'a cabinet base built as separate sections');
  }
  return cases;
}
/* the steps of a fish preset for these values, in a build style, as one text */
function fishStepWords(preset,vals,style){
  const steps=preset.steps?preset.steps(vals):STEPS[preset.name]?STEPS[preset.name](vals):[];
  const kept=look().style;
  try{look().style=style||'std';return steps.map(stepText);}
  finally{look().style=kept;}
}
/* the wall gap a fish preset's wall screws are worked out with (rackPresetHooks in js/builders-fish.js) */
function fishWallGap(preset,vals){
  if(preset.name==='Single aquarium stand')return standWallGap(vals);
  const args=preset.name==='Cabinet stand with a row of tanks'?cabArgs(vals):vals,pl=rackPlan(args);
  return pl?rackWallGap(args,pl):0;
}
/* The thin panels and the doors under the countertop of a closed cabinet: none reaches above its underside, and
   from straight above every point of their top edges is under countertop wood, which reaches FISH_TOP.side past the
   side panels, FISH_TOP.front past the frame (past the doors) and to the back of the back panel; the tank stands on
   the countertop (or the top deck), wholly over the frame, its front and back edges over a rail, and that piece is
   checked as a tank deck by the structural check, which passes. Nothing is left out of the from-above test.
   Also, from the reviews of 20 Nov: no piece passes through the countertop (a post through a closed opening could
   only be built in a room as tall as the post plus the countertop's height); the step says how far the countertop
   reaches past the ends of the frame, and that is what the model has (M1); no step names a back panel the design
   does not have (S5); the wall screws are worked out with the gap the pieces really leave behind the rack (S1);
   every seam of the countertop lands where two cross pieces meet, side by side (S3, sheet 26 rule 15); the
   countertop hangs no more than 1 1/2" past the frame under it at the front and the back (sheet 26 rule 7); the
   banding bought covers its edges and the doors' edges (S7); and the doors are hung after the finish (S8). */
SELFTESTS.push(function fishCountertopCoversThePanels(problems){
  let said=0;
  const wrong=text=>{if(said++<12)problems.push('fish countertop: '+text);};
  let tops=0;
  for(const{preset,vals,where}of fishTopCases()){
    if(preset.check&&(preset.check(vals)||[]).some(f=>f.level==='stop'))continue;
    const at=`${preset.name} (${where})`,parts=preset.build(vals);
    const boxes=parts.map(p=>({p,...plainBox(p)}));
    const named=name=>boxes.filter(b=>b.p.name===name);
    const counters=named('Countertop'),skins=[...named('Side panel'),...named('Back panel'),...named('Door'),...named('Panel stud')];
    const closed=named('Side panel').length>0;
    if(closed&&!counters.length){wrong(`${at}: closed in with thin panels, and no countertop over them`);continue;}
    const check=checkPreset(preset,vals);
    if(check.problems.length)wrong(`${at}: the structural check says ${check.problems.map(f=>f.code).join(', ')}`);
    const uses=preset.uses||{};
    if(uses.Countertop!=='tankDeck'||uses['Top deck']!=='tankDeck')wrong(`${at}: the countertop and the top deck are not checked as tank decks`);
    if(counters.length){
      tops++;
      const under=Math.min(...counters.map(b=>b.lo[1]));
      for(const s of skins)if(s.hi[1]>under+.01)wrong(`${at}: a ${s.p.name} reaches ${fmt(r16(s.hi[1]-under))} above the underside of the countertop`);
      const covered=(x,z)=>counters.some(c=>countertopWoodAt(c.p,x,z));
      for(const s of skins){
        if(s.p.name==='Panel stud')continue;
        const alongX=s.hi[0]-s.lo[0]>=s.hi[2]-s.lo[2],from=alongX?s.lo[0]:s.lo[2],to=alongX?s.hi[0]:s.hi[2];
        const step=Math.max(.5,(to-from-.2)/60);
        // (both faces of the edge, just inside them, and its middle: a sliver beside the top shows too)
        const across=alongX?[s.lo[2]+.02,(s.lo[2]+s.hi[2])/2,s.hi[2]-.02]:[s.lo[0]+.02,(s.lo[0]+s.hi[0])/2,s.hi[0]-.02];
        const along=[];
        for(let t=from+.02;t<to-.02;t+=step)along.push(t);
        along.push(to-.02);
        let shown=false;
        for(const t of along){
          if(shown)break;
          for(const c of across){
            const x=alongX?t:c,z=alongX?c:t;
            if(!covered(x,z)){wrong(`${at}: from above, the top edge of a ${s.p.name} shows beside the countertop at ${fmt(r16(x))} from the left, ${fmt(r16(z))} from the back`);shown=true;break;}
          }
        }
      }
      // nothing passes up through the countertop: no other piece of wood takes up any of its space
      for(const c of counters){
        const through=boxes.find(b=>b!==c&&!isProp(b.p)&&[0,1,2].every(k=>b.lo[k]<c.hi[k]-.01&&b.hi[k]>c.lo[k]+.01));
        if(through){wrong(`${at}: a ${through.p.name} passes through the countertop`);break;}
      }
      // the overhangs the notes state
      const lo=Math.min(...counters.map(b=>b.lo[0])),hi=Math.max(...counters.map(b=>b.hi[0]));
      const front=Math.max(...counters.map(b=>b.hi[2])),back=Math.min(...counters.map(b=>b.lo[2]));
      const sides=named('Side panel');
      if(sides.length&&(Math.abs(Math.min(...sides.map(b=>b.lo[0]))-FISH_TOP.side-lo)>.01||Math.abs(Math.max(...sides.map(b=>b.hi[0]))+FISH_TOP.side-hi)>.01))wrong(`${at}: the countertop does not reach ${fmt(FISH_TOP.side)} past each side panel`);
      const doors=named('Door');
      if(doors.length&&Math.abs(Math.max(...doors.map(b=>b.hi[2]))+FISH_TOP.front-.75-front)>.01)wrong(`${at}: the countertop does not reach ${fmt(FISH_TOP.front-.75)} past the doors`);
      const backs=named('Back panel');
      if(backs.length&&back>Math.min(...backs.map(b=>b.lo[2]))+.01)wrong(`${at}: the countertop stops short of the back of the back panel`);
      // the frame under the countertop: the rails whose tops are its underside
      const frameRails=named('Rail').filter(r=>Math.abs(r.hi[1]-under)<.01);
      // sheet 26 rule 7: no more than 1 1/2" of 3/4" plywood past the frame, front and back (with doors, the 1/8" gap
      // and the 3/4" of the doors under it are part of that)
      const railFront=Math.max(...frameRails.map(r=>r.hi[2])),railBack=Math.min(...frameRails.map(r=>r.lo[2]));
      if(front-railFront>1.5+.01||railBack-back>1.5+.01)wrong(`${at}: the countertop hangs ${fmt(r16(Math.max(front-railFront,railBack-back)))} past the frame under it (no more than 1 1/2" of 3/4" plywood with nothing under it)`);
      // the words of the step that puts the countertop on its frame: how far past the ends of the frame
      const words=fishStepWords(preset,vals,'std').join(' ');
      const railLo=Math.min(...frameRails.map(r=>r.lo[0]));
      const endPast=fmt(r16(railLo-lo));
      if(!new RegExp(`${endPast.replace(/[.*+?^${}()|[\]\\"]/g,'\\$&')} of it past (each end of the frame|the end of the frame at each end)`).test(words))wrong(`${at}: the countertop reaches ${endPast} past the ends of the frame, and the step does not say so`);
      if(!backs.length&&/back panel/i.test(words))wrong(`${at}: a step names a back panel, and there is none`);
      // uprights standing on the countertop: the step says their screws hold in it, never that they reach the frame
      const topFace=Math.max(...counters.map(b=>b.hi[1]));
      if(named('Upright').some(u=>Math.abs(u.lo[1]-topFace)<.01)&&(!/stop inside the 3\/4" plywood/.test(words)||/pocket screws driven down through the countertop/.test(words)))wrong(`${at}: the step does not say how the feet of the uprights on the countertop are held`);
      // the wall screws are worked out with the gap the pieces leave behind the rack
      const furthestBack=-Math.min(...boxes.filter(b=>!isProp(b.p)).map(b=>b.lo[2]));
      if(Math.abs(fishWallGap(preset,vals)-r16(furthestBack))>.01)wrong(`${at}: the wall screws are worked out for ${fmt(fishWallGap(preset,vals))} behind the rack, and the pieces leave ${fmt(r16(furthestBack))}`);
      // every seam of the countertop lands where two cross pieces under it meet side by side
      const crossUnder=named('Cross piece').filter(c=>Math.abs(c.hi[1]-under)<.01);
      for(const a of counters)for(const b of counters){
        if(a===b||Math.abs(a.hi[0]-b.lo[0])>.01)continue;
        const seam=a.hi[0],sectionJoint=named('Post').some(p=>Math.abs(p.hi[0]-seam)<.01||Math.abs(p.lo[0]-seam)<.01);
        if(sectionJoint)continue;   // (two sections meet there, over the tops of their end posts)
        if(!crossUnder.some(c=>Math.abs(c.hi[0]-seam)<.01)||!crossUnder.some(c=>Math.abs(c.lo[0]-seam)<.01))wrong(`${at}: the countertop seam at ${fmt(r16(seam))} is not over two cross pieces side by side`);
      }
      // the edge banding bought covers the countertop's front and outer ends and all the edges of the doors
      const hwLine=(preset.hw?preset.hw(vals):[]).find(row=>row[0]===FISH_TOP.banding.label);
      let banded=counters.reduce((sum,c)=>sum+(c.hi[0]-c.lo[0])+(Math.abs(c.lo[0]-lo)<.01?c.hi[2]-c.lo[2]:0)+(Math.abs(c.hi[0]-hi)<.01?c.hi[2]-c.lo[2]:0),0);
      for(const d of doors)banded+=2*((d.hi[0]-d.lo[0])+(d.hi[1]-d.lo[1]));
      const rolls=Math.ceil(banded*FISH_TOP.banding.spare/12/FISH_TOP.banding.roll-1e-6);
      if(!hwLine||hwLine[1]<rolls)wrong(`${at}: ${Math.round(banded/12)} ft of edges to band takes ${rolls} rolls of banding, and the shopping list has ${hwLine?hwLine[1]:'none'}`);
      // the doors are hung after the sanding and the finish
      const steps=preset.steps?preset.steps(vals):STEPS[preset.name]?STEPS[preset.name](vals):[];
      const finish=steps.findIndex(isFinishStep),hung=steps.findIndex(step=>(step.add||[]).includes('Door'));
      if(doors.length&&(finish<0||hung<finish))wrong(`${at}: the doors are hung before the finish goes on`);
      // the true outside size, countertop included: what the form typed and what the notes say
      const built=builtOverall(parts),notes=(preset.notes?preset.notes(vals):[]).join(' ');
      if(preset.name==='Single aquarium stand'){
        if(Math.abs(built[1]-vals.standH)>.01)wrong(`${at}: built ${fmt(r16(built[1]))} tall, and Stand height says ${fmt(vals.standH)}`);
        if(!notes.includes(`${fmtFt(r16(built[0]))} wide × ${fmtFt(r16(built[2]))} deep`))wrong(`${at}: the notes do not give the outside size, ${fmtFt(r16(built[0]))} wide × ${fmtFt(r16(built[2]))} deep`);
      }
      if(vals.W&&preset.name!=='Single aquarium stand'){
        if(built[0]>vals.W+.01)wrong(`${at}: built ${fmt(r16(built[0]))} wide, wider than the ${fmt(vals.W)} typed`);
        if(!notes.includes(`${fmtFt(r16(built[0]))} wide × ${fmtFt(r16(built[2]))} deep`))wrong(`${at}: the notes do not give the outside size, ${fmtFt(r16(built[0]))} wide × ${fmtFt(r16(built[2]))} deep`);
      }
    }
    // the tank: on the top, wholly over the frame, its front and back edges over a rail
    const rails=named('Rail');
    for(const tank of named('Tank')){
      const rests=boxes.filter(b=>!isProp(b.p)&&Math.abs(b.hi[1]-tank.lo[1])<.01&&b.lo[0]<tank.hi[0]&&b.hi[0]>tank.lo[0]&&b.lo[2]<tank.hi[2]&&b.hi[2]>tank.lo[2]);
      if(!rests.length||!rests.every(b=>/deck|Countertop/i.test(b.p.name))){wrong(`${at}: a tank does not stand on a deck or the countertop`);break;}
      const deckUnder=Math.min(...rests.map(b=>b.lo[1]));
      const frame=rails.filter(r=>Math.abs(r.hi[1]-deckUnder)<.01&&r.lo[0]<tank.hi[0]&&r.hi[0]>tank.lo[0]);
      const overRail=z=>frame.some(r=>z>=r.lo[2]-1e-6&&z<=r.hi[2]+1e-6);
      if(!overRail(tank.lo[2]+RACK_RULES.RIM_INSET/2)||!overRail(tank.hi[2]-RACK_RULES.RIM_INSET/2)){wrong(`${at}: a tank's front or back edge is not over a rail`);break;}
      const frameLo=Math.min(...frame.map(r=>r.lo[0]))-1.5,frameHi=Math.max(...frame.map(r=>r.hi[0]))+1.5;
      if(tank.lo[0]<frameLo-1e-6||tank.hi[0]>frameHi+1e-6){wrong(`${at}: a tank reaches past the end of its frame`);break;}
    }
  }
  if(tops<20)wrong(`only ${tops} of the cases have a countertop, so it was hardly checked`);
});
/* No fastener head on the top of any fish stand or rack in Everyday and Fine furniture, and none on the front or the
   ends of the two cabinet stands (HOUSE_FURNITURE; the brads of the thin end panels, set and filled, are the heads
   the owner's brief allows, SHOW_FACE_ALLOWED), judged with the tanks taken off (a tank is not always there); every
   screw into the countertop or a top deck from below stops at least 1/4" under a 3/4" top's face (1/8" under a 1/2"
   deck's, POCKET_COVER, POCKET_COVER_MIN); and in Rustic / rough the top is screwed down from above, as that style
   asks. Nothing is left out: the open rows above the countertop of a cabinet stand are asked like the rest (the
   reviews of 20 Nov, S4 and 5), and a top above the height where heads count as seen (SEEN.topFrom: a tall rack)
   is asked by its own screws (20). And, from the same reviews: the pocket screws that hold the feet of uprights on
   the countertop end in the frame under it, not in the plywood (M3); the pocket holes of both rails of the top's
   frame are on the faces the step names (S6: the inside face of the front rail, the back face of the back rail). */
SELFTESTS.push(function fishTopsShowNoScrews(problems){withoutDrawing(()=>{
  let said=0;
  const wrong=text=>{if(said++<12)problems.push('fish top screws: '+text);};
  const kept=JSON.stringify(S),styleKept=look().style;
  let looked=0;
  const TOPS=/^(Countertop|Top deck)$/;
  try{
    for(const{preset,vals,where}of fishTopCases()){
      if(preset.check&&(preset.check(vals)||[]).some(f=>f.level==='stop'))continue;
      const parts=(preset.build(vals)||[]).filter(p=>!isProp(p));
      if(!parts.length)continue;
      load(JSON.stringify(blank()),true);
      placePreset(preset,vals,parts,false);
      const house=HOUSE_FURNITURE.includes(preset.name);
      for(const style of['std','fine','rustic']){
        look().style=style;
        commit();
        const at=`${preset.name} (${where}, ${STYLES[style][0]})`;
        if(style==='rustic'){
          if(!fastenerHeads().some(head=>faceOfHead(head.out)==='top'&&TOPS.test(head.f.through.name)))wrong(`${at}: the top is not screwed down from above`);
          continue;
        }
        looked++;
        const heads=headsOnShowFaces().filter(head=>!showFaceAllowed(preset.name,style,head));
        const onTop=heads.filter(head=>head.face==='top');
        if(onTop.length)wrong(`${at}: ${onTop.length} fastener heads show on the top (${onTop[0].f.through.name} into ${onTop[0].f.into.name})`);
        // (however high it is: a screw driven down through the top shows its head on it)
        const downThrough=fastenerHeads().filter(head=>faceOfHead(head.out)==='top'&&TOPS.test(head.f.through.name));
        if(downThrough.length)wrong(`${at}: ${downThrough.length} screws are driven down through the ${downThrough[0].f.through.name}`);
        const elsewhere=heads.filter(head=>head.face!=='top');
        if(house&&elsewhere.length)wrong(`${at}: ${elsewhere.length} fastener heads show on the ${elsewhere[0].face} (${elsewhere[0].f.through.name} into ${elsewhere[0].f.into.name})`);
        for(const link of connGraph().links){
          if(!link.joint||!link.fastened)continue;
          for(const f of fastenersOfLink(link)){
            // the foot of an upright on the countertop: its pocket screws hold in the 3/4" plywood, as the step says
            // (countertopFootWords, js/builders-fish.js), their points inside it, not out of its underside
            if(f.kind==='pocket'&&f.through.name==='Upright'&&f.into.name==='Countertop'){
              const point=pointPlus(f.pos,f.dir,f.len),c=plainBox(f.into);
              if(!insideBox(point,f.into)||point[1]-c.lo[1]<POCKET_COVER_MIN-.005)wrong(`${at}: a ${f.label} at the foot of an upright does not stop inside the countertop, as the step says`);
            }
            const top=[f.into,f.through].find(p=>TOPS.test(p.name));
            if(!top||f.kind==='bracket'||!(f.dir[1]>.5))continue;
            const point=pointPlus(f.pos,f.dir,f.len),cover=plainBox(top).hi[1]-point[1],wanted=pointCoverWanted(f,top);   // (a pocket screw 1/8", any other 1/4" in a 3/4" top: js/style.js)
            if(cover<wanted-.005)wrong(`${at}: a ${f.label} into the ${top.name} ends ${fmt(Math.max(0,r16(cover)))} under its top face`);
            // the rails of the top's frame (topOnFrameWords): the holes on the inside face of the front rail, and of
            // the back rail on its back face where a thin back panel covers that, else on its inside face. A screw
            // runs from its hole toward the other face: toward the front, or toward the back
            if(f.kind==='pocket'&&f.through.name==='Rail'){
              const rail=plainBox(f.through),others=S.parts.filter(p=>p.name==='Rail'&&Math.abs(p.pos[1]-f.through.pos[1])<.01);
              const isBack=others.every(p=>plainBox(p).lo[2]>=rail.lo[2]-.01);
              const covered=backRailCoveredFace(f.through,2)===-1;   // (a thin back panel behind it)
              const towardFront=f.dir[2]>0,wantFront=!isBack||covered;
              if(towardFront!==wantFront)wrong(`${at}: the pocket holes of the ${isBack?'back':'front'} rail into the ${top.name} are not on the face the step names (${isBack?(covered?'its back face, under the back panel':'its inside face'):'its inside face'})`);
            }
          }
          const problem=fastenersOfLink(link).map(f=>fastenerProblem(f)).find(Boolean);
          if(problem)wrong(`${at}: ${link.joint.a.name} to ${link.joint.b.name}: ${problem}`);
        }
      }
    }
  }finally{
    look().style=styleKept;
    load(kept,true);
  }
  if(looked<40)wrong(`only ${looked} designs were looked at`);
});});

/* ---------- a fish cabinet saved before the countertop ----------
   The owner's rule: a design saved under an older rule switches to the current fastening when it is opened, hand
   choices kept (js/fasteningupgrade.js, FASTENING_NOW 7: its top then only rests on the post tops, and is held from
   underneath wherever today's lists say so). But no fastener can grow it a countertop: its thin panels and its doors
   still reach up beside a top the size of its frame. So one line says so when it is opened, once for each design,
   as the old stand notice does for center posts (oldStandNotice, js/builders-fish.js). sayOldFishTop is how it is
   shown; the self-check listens in. */
let sayOldFishTop=text=>toast(text);
let oldFishTopSaidFor='';
const FISH_CABINETS=['Single aquarium stand','Cabinet stand with a row of tanks','Fish tank wall / rack'];
function oldFishTopNotice(){
  if(!S.sets||typeof S.sets!=='object')return;
  const old=Object.entries(S.sets).filter(([number,set])=>set&&FISH_CABINETS.includes(set.name)&&(()=>{
    const own=S.parts.filter(piece=>String(piece.set)===String(number));
    return own.some(piece=>piece.name==='Side panel')&&!own.some(piece=>piece.name==='Countertop');
  })());
  if(!old.length)return;
  const key=`${S.name}|${S.parts.length}|${old.map(([number])=>number).join(',')}`;
  if(key===oldFishTopSaidFor)return;
  oldFishTopSaidFor=key;
  sayOldFishTop(`This fish tank cabinet was made before the cabinets got one flat countertop over their thin side panels, back panel and doors, so the edges of those panels still show beside its top. Make it again from the presets window to get the countertop.`);
}
ON_LOAD.push(oldFishTopNotice);
/* Self-check: an old Single aquarium stand (its top a Shelf deck on the post tops, screwed down into them, saved
   under fastening 5 or 6) opened today: it is fastened the current way (no screw down through its top into the posts in
   Everyday), and the line about the countertop is said once. */
SELFTESTS.push(function oldFishCabinetsAreTold(problems){
  const wrong=text=>problems.push('old fish cabinet: '+text);
  const stand=PRESETS.find(preset=>preset.name==='Single aquarium stand');
  if(!stand){wrong('the Single aquarium stand is missing');return;}
  const said=[],keepSay=sayOldFishTop,keepUpgrade=sayFasteningUpgrade;
  sayOldFishTop=text=>said.push(text);
  sayFasteningUpgrade=()=>{};
  try{
    const vals=presetDefaults(stand);
    // saved under rule 5 (before "Drill your pieces" stage 2) and under rule 6 (stage 2, the published program
    // before the countertop): both switch when opened today
    for(const savedUnder of[5,6]){
      load(JSON.stringify(blank()),true);
      placePreset(stand,vals,stand.build(vals),false);
      // as it was saved before the countertop: the top a 1/2" Shelf deck, screwed down into the post tops
      const old=JSON.parse(JSON.stringify(S));
      for(const piece of old.parts)if(piece.name==='Countertop'){piece.name='Shelf deck';piece.mat='ply12';piece.t=.5;}
      old.fastening=savedUnder;
      old.joints={};old.named={};old.styled={};
      oldFishTopSaidFor='';
      said.length=0;
      load(JSON.stringify(old),true);
      for(const j of findJoints())if(j.a.name==='Post'&&j.b.name==='Shelf deck'||j.b.name==='Post'&&j.a.name==='Shelf deck'){
        if(j.fa==='end'||j.fb==='end'){S.joints[j.key]='screw';S.named[j.key]='screw';}
      }
      S.fastening=savedUnder;
      load(JSON.stringify(S),true);   // (opened a second time: said once for the design all the same)
      const down=findJoints().filter(j=>[j.a.name,j.b.name].includes('Post')&&[j.a.name,j.b.name].includes('Shelf deck')&&(j.fa==='end'||j.fb==='end')&&jType(j)!=='none');
      if(down.length)wrong(`an old stand saved under fastening rule ${savedUnder} opened today still has ${down.length} joints screwed down through its top into the posts`);
      if(said.length!==1)wrong(`an old stand saved under fastening rule ${savedUnder} opened today should say once that it has no countertop, and said it ${said.length} times`);
    }
    // a stand of today says nothing
    said.length=0;
    load(JSON.stringify(blank()),true);
    placePreset(stand,vals,stand.build(vals),false);
    load(JSON.stringify(S),true);
    if(said.length)wrong('a stand made today is told it has no countertop');
  }finally{
    sayOldFishTop=keepSay;
    sayFasteningUpgrade=keepUpgrade;
    load(JSON.stringify(blank()),true);
  }
});
/* Self-check: no choice in a fish preset's tank list leads only to a red box (the real-thing review, S2): every
   tank the list offers fills in sizes the form's own limits take. */
SELFTESTS.push(function fishTankListsFitTheirForms(problems){
  for(const name of FISH_CABINETS){
    const preset=PRESETS.find(row=>row.name===name);
    if(!preset)continue;
    const size=preset.params.find(q=>q.k==='size');
    if(!size||!size.fill)continue;
    for(const[key]of size.opts){
      const fill=size.fill[key];
      if(!fill)continue;
      for(const[k,value]of Object.entries(fill)){
        const q=preset.params.find(row=>row.k===k);
        if(q&&((q.min!==undefined&&value<q.min-1e-6)||(q.max!==undefined&&value>q.max+1e-6)))problems.push(`fish tank lists: ${name}: the ${TANKS[key]?TANKS[key][4]:key} on its list sets ${q.label} to ${fmt(value)}, outside the ${fmt(q.min)} to ${fmt(q.max)} its form takes`);
      }
    }
  }
});
