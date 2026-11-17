/* NominalCAD: what the shopping list buys. How the pieces of each board size are laid on boards of the lengths
   the store sells, and how the plywood pieces are laid on 4 x 8 sheets. The cutting diagrams (diagramSection in
   js/plans.js), the shopping list made from them (js/prices.js), the cost in the presets window and the estimate
   (lumberToBuy) all read the same plan from here, so they always agree: every piece is on exactly one board or
   sheet that is bought, and nothing is bought that carries no piece.

   BOARDS (buyBoards)
     A board size (a 2x4, a 1x6) may be bought in more than one length. The lengths are the ones the program sells
     and prices: STOCKS (js/plans.js), priced by priceOf (js/prices.js) from the price of an 8 ft board. Several
     ways of laying the pieces out are tried and the cheapest is kept; a tie goes to fewer boards, then to less
     wood left over, then to fewer different lengths, then to shorter boards.
     - A saw cut (SAW_KERF, 1/8") is left between two pieces on a board. A board that carries two or more pieces
       also keeps END_TRIM (1/2") spare, to square up the rough or split factory end before the first cut and to
       allow for a board that comes a little short. A board that carries one piece needs no spare: the piece may
       be as long as the board and is cut from it as it comes (an 8 ft piece from an 8 ft board, as framers do).
     - Only lengths that US home centers usually stock for that size are bought by default (storeLengths, from
       reference sheet 24, design\reference\24-board-lengths-in-stores.md): 1x boards and treated 4x4 posts
       from 6 ft, every other size from 8 ft (in cedar only 1x4 and 1x6 from 6 ft). A list that names a board the store does not carry sends a
       beginner home empty-handed, which is worse than a little waste. A length chosen on the cutting diagrams
       may still be any length the program sells (STOCKS).
     - No board is bought longer than the design needs: the longest length tried is 8 ft, or the shortest length
       that holds the longest piece of that size when that is longer (BOARD_HAUL_BASE). So nobody is asked to
       carry home 16 ft boards to cut 3 ft pieces, and the fish racks, whose form asks for the "Longest board you
       can haul", are never bought in longer boards than their own pieces.
     - A person may choose one length for a board size on the cutting diagrams (S.stock[id], in inches). Then every
       piece of that size is cut from boards of that length, and only a piece longer than it goes on the shortest
       longer board that holds it. The choice always wins over the mix.
     - A piece longer than the longest length sold cannot be cut from one board: it is listed apart, as before.

   SHEETS (packSheets)
     Plywood is sold here only as full 4 ft x 8 ft sheets: the price data (PRICE8) has no half or quarter sheet,
     so none is bought (the diagram still says when everything would fit on a half sheet, for a store that sells
     them). The face grain of a sheet runs its 8 ft length, and the program's notes ask for the plywood to be cut
     "with the grain running the long way" (shelf decks, table shelves, fish rack decks). So a piece is laid with
     its length (its longer side) along the 8 ft side of the sheet, or its width when the piece says its grain runs
     that way (grainAxis, the world axis of its grain: a Shed floor piece deeper than it is wide, whose grain must
     run across the joists like the rest of the floor). Only a square, the square that two corner
     shelves are cut from, and the pieces of 1/4" plywood (backs and skins, which carry no weight) may be laid
     either way round. The layouts tried cut the sheet the way a saw does
     (straight through from edge to edge: strips along the sheet, strips across it, or a mix), with a saw cut
     between two pieces, and the one that needs the fewest sheets is kept.

   What the rest of the program calls:
     materialBuy(m, pieces, letterOf, chosen)  the plan for one material: {boards, tooLong, buy, mixed} or {sheets, over, buy}
     lumberToBuy(parts, stock)                  {boards, sheets, cost, buy} for a list of pieces
     packSheets(rects)                          {sheets, over}: rects {a, b, name, piece?, diagonal?} as sheetRects gives them */
'use strict';

const SAW_KERF=.125;          // the saw cut between two pieces on a board or a sheet, in inches
const BOARD_HAUL_BASE=96;     // boards up to 8 ft are always fine to buy; a longer one only when a piece needs it
const SHEET_LONG=96,SHEET_SHORT=48;
const BOARD_SEARCH_MAX=400;   // above this many pieces of one size the slower, closer search is skipped (a fish wall)

/* ---------- boards ---------- */

/* Everything is worked in sixteenths of an inch, so that a piece of exactly 8 ft fits an 8 ft board. */
const toSixteenths=inches=>Math.round(inches*16);

/* The spare a board keeps at its ends when it carries two or more pieces (see the top of this file). Without it a
   board could be laid out to the last 1/16" (two pieces and a saw cut making exactly 8 ft), and a person squaring
   the end, or holding a board that came 1/8" short, would find the last piece short at the saw. */
const END_TRIM=.5;
/* The length of board (in sixteenths) that a set of cuts needs: the pieces, a saw cut between each two, and the
   end trim when there is more than one piece. used = the pieces and saw cuts, in sixteenths. */
const boardNeeds=(used,count)=>used+(count>1?toSixteenths(END_TRIM):0);

/* The shortest board of each size that US home centers usually stock in the store, in inches (reference sheet
   24: the two big US home centers' own listings, Nov 2026). Where a shorter length is not clearly a normal
   stocked item the answer is 8 ft: 2x4, 2x6 and the other 2x sizes are sold at 8 ft and up (and as 4 ft
   project boards, which the program does not sell); a plain 4x4 at 8 ft and up; 2x2 at 8 ft at both stores
   (6 ft only as select pine at one). 1x boards (common, whitewood and select pine, cedar 1x6) are stocked at
   6 ft, and treated 4x4 posts at 6 ft for fences. A size missing here (one added later) starts at 8 ft. */
const STORE_SHORTEST={'1x2':72,'1x3':72,'1x4':72,'1x6':72,'1x8':72,'1x10':72,'1x12':72,'pt4x4':72};
const STORE_SHORTEST_USUAL=96;
/* A wood that home centers stock in fewer short lengths than pine has a table of its own here, which takes the
   place of STORE_SHORTEST for its boards (a size missing from it starts at 8 ft). Reference sheet 24:
   - cedar: 1x4 and 1x6 are listed at 6 ft (premium cedar boards); cedar 1x2, 1x8, 1x10 and 1x12 are listed at
     8 ft and longer, not at 6 ft, and 1x3 was not found, so those start at 8 ft;
   - rough-sawn or reclaimed boards: not looked up, so 8 ft (the in-doubt rule).
   Poplar, oak, select pine and pressure-treated 1x boards are listed at 6 ft, like pine: no table. A treated
   material (a pressure-treated 4x4 post) keeps its own row of STORE_SHORTEST whatever the wood of the design. */
const STORE_SHORTEST_BY_WOOD={cedar:{'1x4':72,'1x6':72},rough:{}};
/* The lengths the shopping list may buy of this material by default, shortest first: the ones the program sells
   (STOCKS, js/plans.js) that the store usually stocks. wood: the wood of the design (look().wood when left out). */
function storeLengths(m,wood){
  wood=wood||look().wood;
  const table=!m.treated&&STORE_SHORTEST_BY_WOOD[wood]||STORE_SHORTEST;
  const shortest=table[m.id]||STORE_SHORTEST_USUAL;
  return STOCKS.filter(length=>length>=shortest);
}
/* The first line of the cutting diagrams: which lengths are bought, for the board sizes in this design.
   "The boards are lengths home centers usually stock: 1x4 and 1x6 from 6 ft, 2x4 and 4x4 from 8 ft." */
function storeLengthsWords(materials){
  const byShortest=new Map();
  for(const m of materials){
    if(m.kind!=='board')continue;
    const shortest=storeLengths(m)[0];
    if(!byShortest.has(shortest))byShortest.set(shortest,[]);
    // "treated 4x4" in the middle of the sentence, not "Treated 4x4"
    byShortest.get(shortest).push((m.brief||m.short).replace(/^[A-Z](?=[a-z])/,letter=>letter.toLowerCase()));
  }
  if(!byShortest.size)return'';
  const list=names=>names.length>1?names.slice(0,-1).join(', ')+' and '+names[names.length-1]:names[0];
  const parts=[...byShortest.keys()].sort((a,b)=>a-b).map(shortest=>`${list(byShortest.get(shortest))} from ${shortest/12} ft`);
  return`The boards are lengths home centers usually stock: ${parts.join(', ')}. If your store has another length, pick it beside the board size.`;
}

/* The lengths that may be bought for these pieces, shortest first (see BOARD_HAUL_BASE above). sold: the lengths
   the store stocks of this size (storeLengths). */
function boardLengthsFor(longest,sold){
  const holdsLongest=sold.find(length=>length>=longest-1e-6);
  const most=Math.max(BOARD_HAUL_BASE,holdsLongest||0);
  return sold.filter(length=>length<=most);
}

/* A layout: [{length (inches), used (sixteenths), cuts: [item]}]. Its score, for comparing two layouts. */
function boardLayoutScore(boards,priceOfLength){
  let cost=0,waste=0,longest=0;
  const lengths=new Set();
  for(const board of boards){
    cost+=priceOfLength(board.length);
    waste+=toSixteenths(board.length)-board.used;
    lengths.add(board.length);
    longest=Math.max(longest,board.length);
  }
  return[Math.round(cost*100),boards.length,waste,lengths.size,longest];
}
const scoreBetter=(a,b)=>{
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]<b[i];
  return false;
};

/* Each board is bought as short as it can be: the shortest length allowed that still holds its cuts. */
function shrinkBoards(boards,lengths){
  for(const board of boards){
    const shortest=lengths.find(length=>toSixteenths(length)>=boardNeeds(board.used,board.cuts.length));
    if(shortest)board.length=shortest;
  }
  return boards;
}

/* First fit, longest piece first: each piece goes on the first board with room for it (and a saw cut), or starts a
   new board of the length openLength(piece) gives. bestFit: on the board with the least room left after it. */
function boardsFirstFit(items,openLength,bestFit){
  const kerf=toSixteenths(SAW_KERF),boards=[];
  for(const item of items){
    let target=null,targetRoom=Infinity;
    for(const board of boards){
      const roomAfter=toSixteenths(board.length)-boardNeeds(board.used+kerf+item.n,board.cuts.length+1);
      if(roomAfter<0)continue;
      if(!bestFit){target=board;break;}
      if(roomAfter<targetRoom){target=board;targetRoom=roomAfter;}
    }
    if(target){target.used+=kerf+item.n;target.cuts.push(item);continue;}
    boards.push({length:openLength(item),used:item.n,cuts:[item]});
  }
  return boards;
}

/* The closest fill of one board: which of the pieces left (always including the longest of them) fill a board of
   this length best. A small knapsack over the different lengths, in sixteenths. Returns the items chosen. */
function fillOneBoard(left,length){
  const kerf=toSixteenths(SAW_KERF),first=left[0];
  if(toSixteenths(length)<first.n)return null;
  // the room for more pieces beside the first: what the board needs with two or more pieces on it (boardNeeds)
  const room=toSixteenths(length)-boardNeeds(first.n,2);
  if(room<=0)return[first];
  // the other pieces, grouped by length; each counts its length and one saw cut
  const byLength=new Map();
  for(let i=1;i<left.length;i++){
    const item=left[i];
    if(!byLength.has(item.n))byLength.set(item.n,[]);
    byLength.get(item.n).push(item);
  }
  // split each group into lots of 1, 2, 4 ... pieces, so every count can be taken (a bounded knapsack)
  const lots=[];
  for(const[n,group]of byLength){
    let count=Math.min(group.length,Math.floor(room/(n+kerf))),size=1,taken=0;
    while(count>0){
      const lot=Math.min(size,count);
      lots.push({weight:lot*(n+kerf),items:group.slice(taken,taken+lot)});
      taken+=lot;count-=lot;size*=2;
    }
  }
  // from[w]: the lot that first reached a fill of exactly w sixteenths (-1: the empty fill, undefined: not reached)
  const from=new Array(room+1);
  from[0]=-1;
  lots.forEach((lot,index)=>{
    for(let w=room;w>=lot.weight;w--)if(from[w]===undefined&&from[w-lot.weight]!==undefined)from[w]=index;
  });
  let best=room;
  while(from[best]===undefined)best--;
  const chosen=[first];
  for(let w=best;w>0;){
    const lot=lots[from[w]];
    chosen.push(...lot.items);
    w-=lot.weight;
  }
  return chosen;
}
/* Board by board: each new board takes the longest piece left and the length (of those allowed) whose closest
   fill costs the least for the wood it uses. */
function boardsByFill(items,lengths,priceOfLength){
  let left=items.slice();
  const boards=[];
  while(left.length){
    let pick=null;
    for(const length of lengths){
      const chosen=fillOneBoard(left,length);
      if(!chosen)continue;
      const wood=chosen.reduce((sum,item)=>sum+item.n,0),perInch=priceOfLength(length)/wood;
      if(!pick||perInch<pick.perInch-1e-9||(Math.abs(perInch-pick.perInch)<=1e-9&&wood>pick.wood))pick={length,chosen,perInch,wood};
    }
    const taken=new Set(pick.chosen);
    const kerf=toSixteenths(SAW_KERF);
    boards.push({length:pick.length,used:pick.wood+kerf*(pick.chosen.length-1),cuts:pick.chosen.slice().sort((a,b)=>b.n-a.n)});
    left=left.filter(item=>!taken.has(item));
  }
  return boards;
}

/* Two boards at a time: the pieces of the two are laid out again, on one board or on two, and kept that way when
   it costs less (a board bought for one short piece joins the pieces of another board on a longer one). Only a
   pair with at least 2 ft left over between them can gain, so only such pairs are tried. Repeated until nothing
   gains. Changes the list in place. */
const BOARD_PAIR_MAX=200;   // more boards than this of one size (a fish wall): the pairs are not tried
function improveBoardsByPairs(boards,lengths,priceOfLength){
  if(boards.length>BOARD_PAIR_MAX)return boards;
  const kerf=toSixteenths(SAW_KERF),step=toSixteenths(24);
  const usedOf=items=>items.reduce((sum,item)=>sum+item.n,0)+kerf*Math.max(0,items.length-1);
  const shortestFor=items=>lengths.find(length=>toSixteenths(length)>=boardNeeds(usedOf(items),items.length));
  let gained=true,rounds=0;
  while(gained&&rounds++<20){
    gained=false;
    for(let i=0;i<boards.length&&!gained;i++){
      for(let j=i+1;j<boards.length&&!gained;j++){
        const a=boards[i],b=boards[j];
        const spare=toSixteenths(a.length)+toSixteenths(b.length)-a.used-b.used-kerf;
        if(spare<step)continue;
        const items=a.cuts.concat(b.cuts).sort((p,q)=>q.n-p.n),now=priceOfLength(a.length)+priceOfLength(b.length);
        let best=null;
        const one=shortestFor(items);
        if(one)best={cost:priceOfLength(one),boards:[{length:one,used:usedOf(items),cuts:items}]};
        for(const length of lengths){
          const first=fillOneBoard(items,length);
          if(!first)continue;
          const taken=new Set(first),rest=items.filter(item=>!taken.has(item));
          if(!rest.length)continue;
          const firstLength=shortestFor(first),restLength=shortestFor(rest);
          if(!firstLength||!restLength)continue;
          const cost=priceOfLength(firstLength)+priceOfLength(restLength);
          if(!best||cost<best.cost-1e-9)best={cost,boards:[{length:firstLength,used:usedOf(first),cuts:first},{length:restLength,used:usedOf(rest),cuts:rest}]};
        }
        if(best&&best.cost<now-.005){
          boards.splice(j,1);
          boards.splice(i,1,...best.boards);
          gained=true;
        }
      }
    }
  }
  return boards;
}

/* The boards to buy for the pieces of one board size.
     items     [{l (inches), letter, name}]: one per piece
     price     length in inches -> dollars for one board
     chosen    a length the person chose for this size (inches), or 0 for the best mix
     sold      the lengths the best mix may buy (storeLengths: the ones the store usually stocks); all of STOCKS
               when left out
   Returns {boards: [{length, used (inches), cuts: [item]}], tooLong: [item], mixed: true when the person chose a
   length and some pieces needed longer boards}. Every item is in exactly one board's cuts or in tooLong. */
function buyBoards(items,price,chosen,sold){
  sold=sold&&sold.length?sold:STOCKS;
  const longestSold=STOCKS[STOCKS.length-1];
  const tooLong=items.filter(item=>item.l>longestSold+1e-6);
  const fit=items.filter(item=>item.l<=longestSold+1e-6).map(item=>({...item,n:toSixteenths(item.l)})).sort((a,b)=>b.n-a.n);
  const done=boards=>({boards:boards.map(board=>({length:board.length,used:board.used/16,cuts:board.cuts})),tooLong,mixed:false});
  if(!fit.length)return done([]);
  const holding=item=>STOCKS.find(length=>toSixteenths(length)>=item.n);

  // the person's own length: all of it on that length, only the longer pieces on longer boards
  if(chosen&&STOCKS.includes(chosen)){
    const onChosen=fit.filter(item=>item.n<=toSixteenths(chosen)),longer=fit.filter(item=>item.n>toSixteenths(chosen));
    const boards=shrinkBoards(boardsFirstFit(longer,holding,false),STOCKS.filter(length=>length>chosen)).concat(boardsFirstFit(onChosen,()=>chosen,false));
    const out=done(boards);
    out.mixed=longer.length>0;
    return out;
  }

  const lengths=boardLengthsFor(fit[0].n/16,sold);
  const tries=[];
  // what the program bought before: one length for the whole size (8 ft, or the shortest that holds the longest
  // piece), each board then bought as short as its cuts allow. Kept as a try, so the mix is never dearer.
  // (Every length longer than 8 ft is stocked, so this length is always one the store has.)
  const oneLength=fit[0].n>toSixteenths(96)?holding(fit[0]):96;
  tries.push(shrinkBoards(boardsFirstFit(fit,()=>oneLength,false),lengths));
  // first fit and best fit, opening boards of each allowed length (or the shortest that holds the piece)
  for(const base of lengths){
    const open=item=>lengths.find(length=>length>=base&&toSixteenths(length)>=item.n);
    tries.push(shrinkBoards(boardsFirstFit(fit,open,false),lengths));
    tries.push(shrinkBoards(boardsFirstFit(fit,open,true),lengths));
  }
  // board by board, the closest fill (skipped for very many pieces, where first fit is already close)
  if(fit.length<=BOARD_SEARCH_MAX)tries.push(shrinkBoards(boardsByFill(fit,lengths,price),lengths));
  let best=null,bestScore=null;
  for(const boards of tries){
    improveBoardsByPairs(boards,lengths,price);
    const score=boardLayoutScore(boards,price);
    if(!best||scoreBetter(score,bestScore)){best=boards;bestScore=score;}
  }
  // longest boards first on the diagram, the longest cuts first on each board
  best.sort((a,b)=>b.length-a.length||b.used-a.used);
  return done(best);
}

/* ---------- sheets ---------- */

/* May this piece be laid either way round on a sheet? Only when its grain does not decide it: a square, the
   square two corner shelves are cut from, or any piece of a thin sheet (1/4" plywood, SHEET_SKIN_T: a back or a
   side skin that carries no weight, as the structural check counts it in js/verify.js). See the grain rule at
   the top of this file. */
const SHEET_SKIN_T=.3;
const sheetPieceTurns=(rect,thin)=>thin||!!rect.diagonal||Math.abs(rect.a-rect.b)<1e-6;

/* The side of a piece that must lie along the 8 ft side of the sheet, where the face grain runs: its length, or its
   width when the piece asks for the grain along its width (rect.grainOnWidth: a floor piece deeper than it is
   wide, whose grain must still run across the joists; shedFloorPiece, js/builders-shed.js). */
const sheetGrainSide=rect=>rect.grainOnWidth?rect.b:Math.max(rect.a,rect.b);
/* Does this piece ask for its face grain along its width? (grainAxis: the world axis its grain runs along) */
const pieceGrainOnWidth=p=>p.grainAxis!==undefined&&!!p.ax&&p.ax[1]===p.grainAxis&&Math.abs(p.l-p.w)>1e-6;
/* The ways a piece can lie on a sheet, as [across the 8 ft side, across the 4 ft side]. */
function sheetWays(rect,thin){
  const along=sheetGrainSide(rect),across=rect.a+rect.b-along;
  const ways=[[along,across]];
  if(sheetPieceTurns(rect,thin)&&along!==across)ways.push([across,along]);
  return ways.filter(([x,y])=>x<=SHEET_LONG+1e-6&&y<=SHEET_SHORT+1e-6);
}

/* Guillotine packing: each sheet keeps a list of free rectangles; a piece goes in the free rectangle that fits it
   best, and the rest of that rectangle is cut in two with one straight cut. split:
     'rows'     the cut runs the length of the sheet (strips along the sheet)
     'columns'  the cut runs across the sheet (strips across it)
     'short'    whichever leaves the larger piece of the two whole
   The saw cut is taken off the side of each free piece that touches the new piece. */
function packSheetsGuillotine(rects,split,thin){
  const kerf=SAW_KERF,sheets=[],over=[];
  const newSheet=()=>{const sheet={free:[{x:0,y:0,w:SHEET_LONG,h:SHEET_SHORT}],items:[]};sheets.push(sheet);return sheet;};
  const bestSpot=(sheet,ways)=>{
    let best=null;
    sheet.free.forEach((free,index)=>{
      for(const[w,h]of ways){
        if(w>free.w+1e-6||h>free.h+1e-6)continue;
        const score=Math.min(free.w-w,free.h-h);   // the snuggest fit first
        if(!best||score<best.score-1e-9)best={index,w,h,score};
      }
    });
    return best;
  };
  for(const rect of rects){
    const ways=sheetWays(rect,thin);
    if(!ways.length){over.push(rect);continue;}
    let sheet=null,spot=null;
    for(const candidate of sheets){spot=bestSpot(candidate,ways);if(spot){sheet=candidate;break;}}
    if(!spot){sheet=newSheet();spot=bestSpot(sheet,ways);}
    const free=sheet.free.splice(spot.index,1)[0],{w,h}=spot;
    sheet.items.push({x:free.x,y:free.y,w,h,name:rect.name,piece:rect.piece,diagonal:rect.diagonal,grainSide:sheetGrainSide(rect)});
    const restW=free.w-w-kerf,restH=free.h-h-kerf;
    const alongRows=split==='rows'||(split==='short'&&restW*free.h<free.w*restH);
    // alongRows: the long cut is under the piece, so the piece beside it is only as tall as the piece
    const beside={x:free.x+w+kerf,y:free.y,w:restW,h:alongRows?h:free.h};
    const above={x:free.x,y:free.y+h+kerf,w:alongRows?free.w:w,h:restH};
    for(const piece of[beside,above])if(piece.w>1e-6&&piece.h>1e-6)sheet.free.push(piece);
  }
  return{sheets:sheets.map(sheet=>({items:sheet.items})),over};
}

/* The orders the pieces are taken in: the longest first, the widest first, the biggest first. */
const SHEET_PIECE_ORDERS=[
  (p,q)=>Math.max(q.a,q.b)-Math.max(p.a,p.b)||Math.min(q.a,q.b)-Math.min(p.a,p.b),
  (p,q)=>Math.min(q.a,q.b)-Math.min(p.a,p.b)||Math.max(q.a,q.b)-Math.max(p.a,p.b),
  (p,q)=>q.a*q.b-p.a*p.b];
/* How the panels are laid out on 4 x 8 sheets: every order with every way of cutting, and the layout with the
   fewest sheets is kept (a tie goes to the one tried first, the longest pieces first in strips along the sheet).
   thin: the pieces are of 1/4" plywood and may all be turned. */
function packSheets(rects,thin){
  let best=null;
  for(const order of SHEET_PIECE_ORDERS){
    const sorted=rects.slice().sort(order);
    for(const split of['rows','columns','short']){
      const tried=packSheetsGuillotine(sorted,split,!!thin);
      if(!best||tried.sheets.length<best.sheets.length)best=tried;
    }
  }
  return best;
}

/* ---------- one material, and a whole list ---------- */

/* What to buy of one material for these pieces. letterOf(piece) gives the cut-list letter written on each cut
   (or '' where there is no cut list); chosen is the person's board length for it (S.stock), if any. A plywood
   piece is named "A: Shelf deck" on the sheet, or by its name alone when it has no letter. */
function materialBuy(m,pieces,letterOf,chosen){
  if(m.kind==='board'){
    const items=pieces.map(p=>({l:p.l,letter:letterOf(p),name:p.name,piece:p}));
    const plan=buyBoards(items,length=>priceOf(m.id,length),chosen||0,storeLengths(m));
    const counts=new Map();
    for(const board of plan.boards)counts.set(board.length,(counts.get(board.length)||0)+1);
    plan.buy=[...counts.keys()].sort((a,b)=>a-b).map(length=>({m,qty:counts.get(length),stock:length}));
    return plan;
  }
  const sheetName=p=>{const letter=letterOf(p);return letter?letter+': '+p.name:p.name;};
  const plan=packSheets(sheetRects(pieces,sheetName),m.t<=SHEET_SKIN_T);   // (corner shelves two to a square: js/shapedrawings.js)
  plan.buy=plan.sheets.length?[{m,qty:plan.sheets.length,stock:0}]:[];
  return plan;
}

/* What a list of pieces takes to buy: how many boards, how many plywood sheets, and roughly what they cost.
   stock = the board lengths a person chose, e.g. {'2x4':120}; a size not listed is bought in the best mix. */
function lumberToBuy(parts,stock){
  let boards=0,sheets=0,cost=0;
  const buy=[];
  for(const m of MATS){
    if(m.kind==='prop')continue;
    const pieces=parts.filter(p=>p.mat===m.id);
    if(!pieces.length)continue;
    const plan=materialBuy(m,pieces,()=>'',stock&&stock[m.id]);
    for(const row of plan.buy){
      if(m.kind==='board')boards+=row.qty;else sheets+=row.qty;
      cost+=row.qty*priceOf(m.id,row.stock);
      buy.push(row);
    }
  }
  return{boards,sheets,cost,buy};
}

/* ---------- self-checks ---------- */

/* How the program bought before this file (one board length per size, rows of panels along the sheet), kept only
   so the self-check can hold the new buying to never costing more. The old way kept no end trim, and so could lay
   out a board to the last 1/16" (a list that comes up short at the saw); here it keeps the same END_TRIM as the
   new buying, so the two are compared on boards that can really be cut. */
function buyingBeforeCost(parts){
  const kerf=SAW_KERF;
  let cost=0;
  for(const m of MATS){
    if(m.kind==='prop')continue;
    const pieces=parts.filter(p=>p.mat===m.id);
    if(!pieces.length)continue;
    if(m.kind==='board'){
      const lengths=pieces.map(p=>p.l),longest=Math.max(...lengths);
      const length=longest>96?STOCKS.find(s=>s>=longest)||192:96,bins=[];
      lengths.filter(l=>l<=length).sort((a,b)=>b-a).forEach(l=>{
        let bin=bins.find(b=>b.used+(b.n?kerf+END_TRIM:0)+l<=length+1e-6);
        if(!bin){bin={used:0,n:0};bins.push(bin);}
        bin.used+=(bin.n?kerf:0)+l;bin.n++;
      });
      cost+=bins.length*priceOf(m.id,length);
    }else{
      cost+=buyingBeforeSheets(sheetRects(pieces,p=>p.name))*priceOf(m.id,0);
    }
  }
  return cost;
}
function buyingBeforeSheets(rects){
  const orders=[(p,q)=>Math.max(q.a,q.b)-Math.max(p.a,p.b),(p,q)=>Math.min(q.a,q.b)-Math.min(p.a,p.b)||Math.max(q.a,q.b)-Math.max(p.a,p.b),(p,q)=>q.a*q.b-p.a*p.b];
  let fewest=Infinity;
  for(const order of orders){
    const sheets=[];
    for(const r of rects.slice().sort(order)){
      const opts=[[r.a,r.b],[r.b,r.a]].filter(([w,h])=>w<=96+1e-6&&h<=48+1e-6);
      if(!opts.length)continue;
      let placed=false;
      outer:for(const sh of sheets){
        for(const sf of sh.shelves){const ft=opts.filter(([w,h])=>h<=sf.h+1e-6&&sf.x+w<=96+1e-6).sort((p,q)=>p[0]-q[0])[0];
          if(ft){sf.x+=ft[0]+SAW_KERF;placed=true;break outer;}}
        const ft=opts.filter(([w,h])=>sh.y+h<=48+1e-6).sort((p,q)=>p[1]-q[1])[0];
        if(ft){sh.shelves.push({h:ft[1],x:ft[0]+SAW_KERF});sh.y+=ft[1]+SAW_KERF;placed=true;break;}
      }
      if(!placed){const ft=opts.sort((p,q)=>p[1]-q[1])[0];sheets.push({y:ft[1]+SAW_KERF,shelves:[{h:ft[1],x:ft[0]+SAW_KERF}]});}
    }
    fewest=Math.min(fewest,sheets.length);
  }
  return fewest;
}

/* What is wrong with the plan of one material, in words (none: []). Every piece is on exactly one bought board or
   sheet, inside it, with a saw cut between pieces, nothing overlaps, no board or sheet is bought empty, on a
   sheet every piece lies with its grain the long way unless it may turn, and (with no length chosen, the best
   mix) every board is a length the store usually stocks of that size (storeLengths). */
function buyingPlanFaults(m,pieces,plan,chosen){
  const out=[],near=1e-6;
  if(m.kind==='board'){
    const placed=plan.boards.reduce((sum,board)=>sum+board.cuts.length,0)+plan.tooLong.length;
    if(placed!==pieces.length)out.push(`${placed} cuts on the boards for ${pieces.length} pieces`);
    const seen=new Set();
    for(const board of plan.boards){
      if(!STOCKS.includes(board.length))out.push(`a board ${board.length}" long, a length the store does not sell`);
      else if(!chosen&&!storeLengths(m).includes(board.length))out.push(`a ${board.length/12} ft board, a length home centers do not usually stock for a ${m.short}`);
      if(!board.cuts.length)out.push('a board is bought with no piece on it');
      const used=board.cuts.reduce((sum,item)=>sum+item.l,0)+SAW_KERF*(board.cuts.length-1);
      if(used>board.length+near)out.push(`a ${board.length/12} ft board carries ${fmt(used)} of pieces and saw cuts`);
      else if(board.cuts.length>1&&used+END_TRIM>board.length+near)out.push(`a ${board.length/12} ft board carries ${fmt(used)} of pieces and saw cuts, with no ${fmt(END_TRIM)} spare to square the end`);
      for(const item of board.cuts){if(seen.has(item.piece))out.push(`the ${item.name} is on two boards`);seen.add(item.piece);}
    }
    const bought=plan.buy.reduce((sum,row)=>sum+row.qty,0);
    if(bought!==plan.boards.length)out.push(`the list buys ${bought} boards and the diagrams draw ${plan.boards.length}`);
  }else{
    const placed=plan.sheets.reduce((sum,sheet)=>sum+sheet.items.length,0)+plan.over.length;
    const rects=sheetRects(pieces,p=>p.name).length;
    if(placed!==rects)out.push(`${placed} pieces on the sheets for ${rects} to cut`);
    for(const sheet of plan.sheets){
      if(!sheet.items.length)out.push('a sheet is bought with no piece on it');
      sheet.items.forEach((a,i)=>{
        if(a.x<-near||a.y<-near||a.x+a.w>SHEET_LONG+near||a.y+a.h>SHEET_SHORT+near)out.push(`${a.name} runs off the sheet`);
        // (the side that carries the grain lies along the sheet: its length, or its width for a piece that asks for it)
        if(Math.abs(a.w-a.h)>near&&Math.abs(a.w-a.grainSide)>near&&!a.diagonal&&m.t>SHEET_SKIN_T)out.push(`${a.name} is laid across the grain`);
        sheet.items.forEach((b,j)=>{
          if(j<=i)return;
          const apartX=a.x+a.w+SAW_KERF<=b.x+near||b.x+b.w+SAW_KERF<=a.x+near,apartY=a.y+a.h+SAW_KERF<=b.y+near||b.y+b.h+SAW_KERF<=a.y+near;
          if(!apartX&&!apartY)out.push(`${a.name} and ${b.name} overlap, or have no room for a saw cut between them`);
        });
      });
    }
    if((plan.buy[0]?plan.buy[0].qty:0)!==plan.sheets.length)out.push('the list and the diagrams buy different numbers of sheets');
  }
  return out;
}

/* Every preset at its usual sizes and at the smallest and largest of each number: the plan holds every piece as
   described above, the cutting diagrams draw what the list buys, and it never costs more than the program bought
   before. Named cases: the Garage shelves buy one sheet where the decks fit on one with their grain the long way
   (40" and the usual 48"); the Shed buys its 2x4s in more than one length, and its lumber line counts the
   plywood for its gable ends; the Planter box's cutting diagram shows its piece D; the best mix buys only the
   lengths home centers usually stock, and a length chosen on the diagrams is still bought. */
SELFTESTS.push(function buyingHoldsEveryPiece(problems){
  const kept=JSON.stringify(S);
  const wrong=text=>{if(problems.length<60)problems.push('buying: '+text);};
  try{
    for(const preset of PRESETS){
      sizesToTry(preset).forEach(({vals,where},index)=>{
        if(preset.check&&(preset.check(vals)||[]).some(f=>f.level==='stop'))return;   // refused at this size: nothing is built
        let parts=[];
        try{parts=preset.build(vals)||[];}catch(e){return;}
        if(!parts.length)return;
        const at=`${preset.name} (${where})`;
        // At the usual size the preset is placed as Create places it (with its drawer runners and other strips of
        // wood placed as hardware) and the cutting diagrams are drawn; at the smallest and largest sizes the pieces
        // the builder gives are enough (the plan is the same function the diagrams draw).
        let all=parts.filter(p=>!isProp(p)),letterOf=()=>'',list=null;
        if(index===0){
          load(JSON.stringify(blank()),true);
          placePreset(preset,vals,parts,false);
          list=cutRows();
          all=S.parts.concat(woodStrips());
          letterOf=p=>list.letterOf(p);
        }
        for(const m of MATS){
          if(m.kind==='prop')continue;
          const pieces=all.filter(p=>p.mat===m.id);
          if(!pieces.length)continue;
          for(const fault of buyingPlanFaults(m,pieces,materialBuy(m,pieces,letterOf,0),0))wrong(`${at}, ${m.short}: ${fault}`);
        }
        const now=lumberToBuy(all).cost,before=buyingBeforeCost(all);
        if(now>before+.005)wrong(`${at}: the lumber costs $${now.toFixed(2)}, more than the $${before.toFixed(2)} it cost before`);
        if(!list)return;
        // the shopping list buys what the diagrams draw
        const drawn=diagramSection(list);
        const boardsDrawn=(drawn.html.match(/class="cut"/g)||[]).length,sheetsDrawn=(drawn.html.match(/class="cut ply"/g)||[]).length;
        const boardsBought=drawn.buy.filter(row=>row.stock).reduce((sum,row)=>sum+row.qty,0),sheetsBought=drawn.buy.filter(row=>!row.stock).reduce((sum,row)=>sum+row.qty,0);
        if(boardsDrawn!==boardsBought||sheetsDrawn!==sheetsBought)wrong(`${at}: the diagrams draw ${boardsDrawn} boards and ${sheetsDrawn} sheets, and the list buys ${boardsBought} and ${sheetsBought}`);
        // the presets window's "Lumber, about $..." is the shopping list's "Lumber, before tax" line, in whole dollars
        // (with the hardware list, whose sheets of plywood to cut on site count with the lumber: the Shed's gable ends)
        const windowCost=Math.round(assessParts(preset.build(vals),preset,vals).buy.cost),pageLumber=Math.round(shoppingModel(drawn.buy,hardwareTotals(findJoints())).lumber);
        if(windowCost!==pageLumber)wrong(`${at}: the presets window says lumber about $${windowCost}, and the shopping list's lumber line comes to $${pageLumber}`);
      });
    }
    // the named cases
    const place=(name,change)=>{
      const preset=PRESETS.find(candidate=>candidate.name===name);
      if(!preset){wrong(`the ${name} preset is missing`);return null;}
      const vals={...presetDefaults(preset),...(change||{})};
      load(JSON.stringify(blank()),true);
      placePreset(preset,vals,preset.build(vals),false);
      return diagramSection(cutRows());
    };
    // the Garage shelves at 40" and at the usual 48" (decks 47 15/16" long, two to the sheet's length) buy one sheet
    for(const width of[40,48]){
      const garage=place('Garage shelves',{W:width});
      if(!garage)continue;
      const sheets=garage.buy.filter(row=>!row.stock).reduce((sum,row)=>sum+row.qty,0);
      if(sheets!==1)wrong(`Garage shelves ${width}" wide: the four decks fit on one sheet with the grain the long way, and the list buys ${sheets}`);
    }
    const shed=place('Shed');
    if(shed){
      const lengths=shed.buy.filter(row=>row.m.id==='2x4').map(row=>row.stock);
      if(lengths.length<2)wrong(`Shed: every 2x4 is bought ${lengths.length?lengths[0]/12+' ft':''} long, not in a mix of lengths`);
      // the sheet of 1/2" plywood for the gable ends is lumber: "Lumber, before tax" counts it
      const gable=sheetsToCutOnSite(hardwareTotals(findJoints()).rows);
      const model=shoppingModel(shed.buy,hardwareTotals(findJoints()));
      const gableCost=gable.reduce((sum,sheet)=>sum+sheet.qty*priceOf(sheet.m.id,0),0);
      if(!gable.length)wrong('Shed: the plywood for the gable ends is not on its list as sheets to cut on site');
      else if(Math.abs(model.lumber-shoppingModel(shed.buy,null).lumber-gableCost)>.005)wrong('Shed: "Lumber, before tax" leaves out the plywood for the gable ends');
      if(hardwareWithoutSheets(hardwareTotals(findJoints())).rows.some(([label])=>gable.some(sheet=>sheet.label===label)))wrong('Shed: the plywood for the gable ends is also in the Hardware table');
    }
    // the board lengths bought are the ones home centers usually stock (reference sheet 24): a short piece of 2x4 or
    // of a plain 4x4 comes from an 8 ft board, one of a 1x4 or a treated 4x4 post from a 6 ft board, and a 6 ft
    // board chosen on the cutting diagrams is still bought
    for(const[size,want]of[['2x4',96],['4x4',96],['2x2',96],['1x4',72],['pt4x4',72]]){
      const plan=materialBuy(M[size],[mk('Short',size,[30,M[size].w,M[size].t],[0,0,0])],()=>'',0);
      const got=plan.boards.map(board=>board.length).join(',');
      if(got!==String(want))wrong(`a 30" piece of ${M[size].short} is bought as a board of ${got}", not ${want/12} ft`);
    }
    const chosenSix=materialBuy(M['2x4'],[mk('Short','2x4',[30,3.5,1.5],[0,0,0])],()=>'',72);
    if(chosenSix.boards.map(board=>board.length).join(',')!=='72')wrong('with 6 ft chosen on the cutting diagrams, a 30" 2x4 is not bought as a 6 ft board');
    const planter=place('Planter box');
    if(planter){
      const list=cutRows(),lettersCut=new Set(list.rows.filter(row=>M[row.mat].kind==='board').map(row=>row.id));
      const drawnLetters=new Set([...planter.html.matchAll(/title="(\w+) /g)].map(match=>match[1]));
      for(const letter of lettersCut)if(!drawnLetters.has(letter))wrong(`Planter box: piece ${letter} of the cut list is on no board of the cutting diagrams`);
    }
    // a length the person chooses wins, and a piece longer than it goes on a longer board
    load(JSON.stringify(blank()),true);
    addParts([mk('Long','2x4',[110,3.5,1.5],[0,0,0]),mk('Short','2x4',[30,3.5,1.5],[0,0,10]),mk('Short','2x4',[30,3.5,1.5],[0,0,20])]);
    S.stock['2x4']=96;
    const chosen=materialBuy(M['2x4'],S.parts,()=>'',96);
    const lengths=chosen.boards.map(board=>board.length).sort((a,b)=>a-b).join(',');
    if(lengths!=='96,120'||!chosen.mixed)wrong(`with 8 ft chosen, a 110" piece and two 30" pieces are bought as boards of ${lengths}", not one 8 ft and one 10 ft`);
    // two pieces that fill an 8 ft board to the last 1/16" with their saw cut (47 15/16" each) leave no end trim, so
    // they are not laid on one 8 ft board; one piece the full 8 ft is still cut from an 8 ft board as it comes
    load(JSON.stringify(blank()),true);
    addParts([mk('Half','2x4',[47.9375,3.5,1.5],[0,0,0]),mk('Half','2x4',[47.9375,3.5,1.5],[0,0,10]),mk('Whole','2x4',[96,3.5,1.5],[0,0,20])]);
    const tight=materialBuy(M['2x4'],S.parts,()=>'',0);
    if(tight.boards.some(board=>board.length===96&&board.cuts.length>1))wrong('two 47 15/16" pieces are laid on one 8 ft board with no end trim');
    if(!tight.boards.some(board=>board.length===96&&board.cuts.length===1&&board.cuts[0].l===96))wrong('a piece 8 ft long is not cut from an 8 ft board of its own');
  }finally{
    load(kept,true);
  }
});
/* The board lengths follow the wood of the design (STORE_SHORTEST_BY_WOOD, reference sheet 24): in cedar only the
   1x4 and the 1x6 are bought at 6 ft, and a cedar 1x2, 1x8 or 1x10 comes from an 8 ft board; in pine every 1x
   size starts at 6 ft; a pressure-treated 4x4 post is 6 ft in any design. Then every preset in cedar at its usual
   sizes (the Bird feeder, the Planter box, the Raised garden bed) buys, with the best mix, only those lengths,
   read from the cutting diagrams the page draws. */
SELFTESTS.push(function storeLengthsFollowTheWood(problems){
  const kept=JSON.stringify(S);
  const wrong=text=>{if(problems.length<60)problems.push('store lengths: '+text);};
  try{
    const cases=[['1x2','cedar',96],['1x4','cedar',72],['1x6','cedar',72],['1x8','cedar',96],['1x10','cedar',96],['1x12','cedar',96],
      ['1x10','pine',72],['1x2','poplar',72],['1x4','rough',96],['pt4x4','cedar',72],['2x4','cedar',96]];
    for(const[size,wood,want]of cases){
      const got=storeLengths(M[size],wood)[0];
      if(got!==want)wrong(`a ${wood} ${M[size].short} starts at ${got/12} ft, not ${want/12} ft`);
    }
    for(const preset of PRESETS){
      if(preset.retired||!preset.look||preset.look.wood!=='cedar')continue;
      const vals=presetDefaults(preset);
      if(preset.check&&(preset.check(vals)||[]).some(found=>found.level==='stop'))continue;
      load(JSON.stringify(blank()),true);
      placePreset(preset,vals,preset.build(vals),false);
      for(const row of diagramSection(cutRows()).buy){
        if(!row.stock)continue;
        if(!storeLengths(row.m,'cedar').includes(row.stock))wrong(`${preset.name}: a cedar ${row.m.short} is bought ${row.stock/12} ft long, a length home centers do not usually stock in cedar`);
      }
    }
  }finally{
    load(kept,true);
  }
});
