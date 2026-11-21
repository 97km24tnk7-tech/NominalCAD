/* NominalCAD: prices. What things cost, where each price comes from, and how prices are brought up to date.

   The honest part first. No store lets a program read its prices (Home Depot and Lowe's refuse every scripted
   request), so nothing here ever claims to know a store price. There are three kinds of price:

     built-in   an ESTIMATE: a national ballpark that was right in one known month (PRICE_BASELINE). Boards and
                sheets are in PRICE8 (js/plans.js), hardware and finishing supplies in HARDWARE_PRICES below.
     index      the same estimate, moved by how much lumber or plywood has gone up or down across the country
                since that month. The figures come from the US Bureau of Labor Statistics (a government price
                index). Still an estimate, never a quote from any store. Hardware is not moved.
     yours      a price the person typed, pasted or edited. It ALWAYS wins, and no update ever touches it.

   The price book (priceBook) is kept in the browser under 'woodshop.prices':
     {v:2, store, yours:{key:{p, d}}, index, applied, updated, asked, limited, auto, lineOff}
   A key is a material id ('2x4', 'ply34'; 'oak:2x4' for another wood), 'hw:<item name>' for one hardware item,
   or 'hwf:<family id>' for a whole row of HARDWARE_PRICES. A board price is always kept as the price of an
   8 ft board; other lengths are worked out from it. The older shape of this entry ({'2x4': 3.98}) is read too.

   Update prices is the ONLY thing in the program that talks to another computer. It happens when the person
   clicks it (or at start-up, if they ticked "Update prices each time NominalCAD opens"), at most once a day,
   and the request carries nothing but the two series names in PRICE_INDEXES. It cannot throw: offline, blocked
   or over the service's daily limit all end in one calm sentence and change nothing.

   What the rest of the program calls:
     priceOf(id, stock)            dollars for one board of that length (stock, in inches) or one sheet (stock 0)
     shoppingSection(buy, hw)      the Shopping list of the document pages (renderCut in js/plans.js)
     updatePrices(options, done)   ask the price index and move the estimates; done({ok, asked, message, why})
     openPriceBook()               the Price book dialog: every price, its source and date, the store label
     openPastePrices()             the Paste prices dialog: reads lines copied from a receipt or a store page
   The commands (updatePrices, priceBook, pastePrices) are in COMMANDS in js/menus.js. */
'use strict';

/* ---------- 1. The built-in estimates and the price index ---------- */

/* The month the built-in prices were set, and where the two national price indexes stood in that month.
   (US Bureau of Labor Statistics, producer price index, not seasonally adjusted. Read from the service on
   Nov 15, 2026, when October 2026 was the newest month and still marked preliminary, and checked the same day
   against the copy of both series kept by the Federal Reserve Bank of St. Louis. If the service later sends a
   revised figure for this month, the revised one is used instead.)
   To refresh the built-in prices: check PRICE8 and HARDWARE_PRICES against a store, then set month to that
   month and the two numbers to the index values for it. */
const PRICE_BASELINE={month:'2026-10',softwood:277.612,plywood:312.362};

/* Which national index moves which kind of material. word is how the kind is named in a sentence. */
const PRICE_INDEXES=[
  {id:'softwood',series:'WPU0811',kind:'board',word:'boards'},
  {id:'plywood',series:'WPU083',kind:'sheet',word:'plywood'},
];
const PRICE_SERVICE_URL='https://api.bls.gov/publicAPI/v2/timeseries/data/'; // followed by one series name; no key, no account
const PRICE_FACTOR_MIN=.6;                  // an estimate is never moved further than this, down or up,
const PRICE_FACTOR_MAX=1.6;                 // however far the index has gone
const PRICE_TIMEOUT_MS=8000;                // how long the service gets to answer
const PRICE_ASK_AGAIN_MS=20*60*60*1000;     // the service allows about 25 questions a day: ask at most once a day
const PRICE_LIMIT_WAIT_MS=3*60*60*1000;     // after "daily limit reached", do not even try for a few hours

/* Hardware and finishing supplies: what one pack costs. Not moved by the index.
     match   picks the row for an item name from jSpec, finishSupplies (js/style.js) or a preset; first match wins
     pack    how many are in one pack; sold says the same in words
     search  the words to look it up at a store (default: the item's own name)
     parent  (rows made by priceByLength) the id of the general row of the same kind: a price the person typed
             for that general row also counts for this length, until they type one for the length itself */
/* Screws and nails cost more the longer they are, and a design that needs two lengths needs two boxes. So every
   length the program can ask for gets its own row, with its own estimate, made here from one short table:
   lengths = [[length as the program writes it, price of one pack], ...]. nameOf(length) must give exactly the
   item name that jSpec (js/style.js) writes, because that name is how the row is found.
   A preset's own hardware list (hw(p)) writes the kind first and the length after it, with a space where jSpec
   has a hyphen: 'Construction screws, 2 1/2" (posts to rails)'. presetWords is a pattern for the words such a
   name starts with; the same row then takes those names too, so that a screw has one price however it is named. */
function priceByLength(parent,kind,nameOf,pack,sold,lengths,presetWords){
  const literal=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const spaced=length=>literal(length).replace('-','[- ]');          // '2-1/2"' is also written '2 1/2"'
  return lengths.map(([length,price])=>{
    const asJoint='(^|[^-/\\d])'+literal(nameOf(length));            // '1"' must not also catch '1-1/4"'
    const asPreset=presetWords?`|^(?:${presetWords}),? ${spaced(length)}`:'';
    return{id:`${parent}:${length}`,parent,name:`${kind}, ${length}`,match:new RegExp(asJoint+asPreset,'i'),pack,sold,price};
  });
}
const HARDWARE_PRICES=[
  // Nails for framing (js/framing.js and the Shed): sold by weight, so a pack is what a box of that weight holds,
  // about. These rows stand first because their names also carry words of later rows ("hurricane ties").
  {id:'framing-nails',name:'Framing nails, 3" (10d)',match:/framing nails/i,pack:340,sold:'5 lb box (about 340)',price:20,search:'10d common nails 3 in. 5 lb box'},
  {id:'plywood-nails',name:'Nails for plywood, 2-1/2" (8d)',match:/nails \(8d\)/i,pack:500,sold:'5 lb box (about 500)',price:20,search:'8d common nails 2-1/2 in. 5 lb box'},
  {id:'hanger-nails',name:'Short nails for metal ties, 1-1/2"',match:/hanger nails/i,pack:150,sold:'1 lb box (about 150)',price:7,search:'joist hanger nails 1-1/2 in. 1 lb box'},
  // plywood a preset asks for by the sheet because the pieces are cut on site to a slope (the Shed's gable ends).
  // mat: it is a sheet of that material, so it is priced as that sheet (a price typed for 1/2" plywood counts for
  // it too) and the shopping list counts it with the lumber, not with the hardware (sheetsToCutOnSite below).
  {id:'plywood-to-fit',name:'1/2" plywood to cut to fit',match:/^1\/2" plywood/i,pack:1,sold:'4 ft × 8 ft sheet',price:40,search:'1/2 in. plywood sheathing 4 ft. x 8 ft.',mat:'ply12'},
  ...priceByLength('pocket-screws','Pocket-hole screws',length=>`${length} pocket-hole screws`,100,'box of 100',
    [['1"',6],['1-1/4"',7],['1-1/2"',8],['2-1/2"',12],['3"',14]]),
  {id:'pocket-screws',name:'Pocket-hole screws, other lengths',match:/pocket-hole screws/i,pack:100,sold:'box of 100',price:7},
  // screws made for outdoors (coated or stainless) cost more than plain ones, so they have rows of their own
  ...priceByLength('exterior-screws','Exterior screws',length=>`${length} exterior screws`,100,'box of 100',
    [['1-1/4"',8],['1-5/8"',9],['2"',10],['2-1/2"',12],['3"',14]],'exterior screws'),
  {id:'exterior-screws',name:'Exterior screws, other lengths',match:/exterior screws/i,pack:100,sold:'box of 100',price:11},
  // the long screws that hold a fish rack to the wall studs (js/builders-fish.js, wallScrewLines): their own row, so
  // that they stand before the wood screws, whose words would also catch "screws for the wall studs, 3 1/2"
  ...priceByLength('structural-screws','Structural screws',length=>`${length} structural screws`,12,'pack of 12',
    [['3"',8],['3-1/2"',9],['4"',10],['5"',12],['6"',14],['8"',18],['10"',22]],'screws for the wall studs'),
  ...priceByLength('wood-screws','Wood screws, #8',length=>`#8 × ${length} wood screws`,100,'box of 100',
    [['1"',6],['1-1/4"',7],['1-5/8"',8],['2"',9],['2-1/2"',11],['3"',13],['3-1/2"',15]],
    '(?:wood |construction )?screws(?: for the wall studs)?'),
  // 1/4" structural screws (washer head, no pilot hole), where a #8 cannot bite far enough into end grain: through
  // a 4x4 leg into the end of an apron (rule 12 in js/fasteners.js). Sold in small boxes by the length.
  ...priceByLength('structural-screws','Structural screws, 1/4"',length=>`1/4" × ${length} structural screws`,12,'box of 12',
    [['4"',12],['5"',14],['6"',16]]),
  {id:'structural-screws',name:'Structural screws, 1/4", other lengths',match:/structural screws/i,pack:12,sold:'box of 12',price:14},
  // the plugs that hide the heads of plugged screws (type 'plug'): cut flush after the glue dries
  {id:'wood-plugs',name:'Wood plugs, 3/8"',match:/wood plugs/i,pack:25,sold:'bag of 25',price:4,search:'3/8 in. flat head wood plugs'},
  // pocket holes that would be seen from below are filled with these, glued in and sanded flush (rule 13, js/fasteners.js)
  {id:'pocket-plugs',name:'Pocket-hole plugs',match:/pocket-hole plugs/i,pack:50,sold:'bag of 50',price:7,search:'pocket hole plugs pine'},
  // a head sunk deeper than a plug is long gets a length of dowel rod instead: about 20 such plugs to a 36" rod
  {id:'dowel-rod-plugs',name:'Dowel rod, 3/8" × 36"',match:/dowel rod, cut into plugs/i,pack:20,sold:'36" rod (about 20 plugs)',price:2,search:'3/8 in. x 36 in. hardwood dowel rod'},
  // the short screws of a bracket under a 3/4" top are 1/2" (bracketScrew, js/style.js)
  {id:'bracket-screws-half',name:'Short screws for brackets, #8 × 1/2"',match:/1\/2" screws for brackets/i,pack:100,sold:'box of 100',price:5},
  {id:'bracket-screws',name:'Short screws for brackets, #8 × 5/8"',match:/screws for brackets/i,pack:100,sold:'box of 100',price:5},
  // the power strip's round-head screws (the Computer desk, priced below with its other rows): before the general
  // wood screws row, whose words would match them too and buy a box of 100 for two screws
  {id:'round-head-screws',name:'Round-head wood screws, #8 × 3/4"',match:/round-head (wood )?screws/i,pack:6,sold:'pack of 6',price:1.38,search:'#8 x 3/4 in. Phillips round head zinc plated wood screw'},
  {id:'wood-screws',name:'Wood screws, #8, other lengths',match:/wood screws/i,pack:100,sold:'box of 100',price:9},
  {id:'dowels',name:'Wood dowels',match:/wood dowels/i,pack:30,sold:'bag of 30',price:4},
  ...priceByLength('brads','Brad nails, 18 gauge',length=>`${length} brad nails`,1000,'box of 1,000',
    [['5/8"',5],['3/4"',5.5],['1"',6],['1-1/4"',7],['1-1/2"',8],['2"',9]]),
  {id:'brads',name:'Brad nails, 18 gauge, other lengths',match:/brad nails/i,pack:1000,sold:'box of 1,000',price:7},
  // The big braces that hold a shelf unit to the wall: the garage shelves name theirs 'Corner braces (L-brackets),
  // 4"'. This row stands above the small L-brackets and only takes a name that STARTS with "Corner braces",
  // because the small ones at a joint are named '1-1/2" L-brackets (corner braces)' by jSpec.
  {id:'corner-braces',name:'Corner braces, 4"',match:/^corner braces/i,pack:2,sold:'pack of 2',price:7,search:'corner brace 4 in. zinc 2-pack'},
  {id:'brackets',name:'L-brackets, 1-1/2" (small corner braces)',match:/l-brackets/i,pack:4,sold:'pack of 4',price:4.5},
  {id:'cabinet-hinges',name:'Cabinet hinges',match:/cabinet hinges/i,pack:2,sold:'pack of 2',price:7},
  {id:'t-hinges',name:'Heavy T-hinges',match:/t-hinges/i,pack:1,sold:'each',price:9},
  // hardware that is placed in the 3D view names itself through HARDWARE[kind].buy(size) in js/hardware.js; every such
  // name needs a row here (the self-check hardwareWordsAndPrices in js/hardwaretool.js tries each kind and size)
  {id:'piano-hinges',name:'Piano hinges (lid hinges)',match:/piano hinge/i,pack:1,sold:'each',price:14,search:'piano hinge 30 in.'},
  {id:'hinges',name:'Butt hinges and other hinges',match:/hinge/i,pack:1,sold:'each',price:4},
  {id:'slides',name:'Drawer slides',match:/drawer slide/i,pack:1,sold:'pair',price:15},
  {id:'drawer-runners',name:'Wooden drawer runners',match:/drawer runners?/i,pack:1,sold:'each (cut from a 1x2)',price:1,search:'1x2 hardwood board'},
  {id:'drawer-kickers',name:'Wooden drawer kickers',match:/drawer kickers?/i,pack:1,sold:'each (cut from a 1x2)',price:1,search:'1x2 hardwood board'},
  // the longer screws for pulls on a drawer front with the drawer box front behind it (the Computer desk buys them,
  // js/computerdesk.js): Everbilt #8-32 x 1-3/4 in. combo truss head zinc machine screws, 4-pack, Home Depot $1.38
  // (model 804941, search snapshot, Nov 2026). Before 'pulls', whose words would match the line first.
  {id:'pull-screws',name:'Machine screws, #8-32, for pulls',match:/machine screws?, #8-32/i,pack:4,sold:'pack of 4',price:1.38,search:'#8-32 x 1-3/4 in. machine screw'},
  // felt pads under the feet of a chair (the Dining chair, js/diningchair.js): Everbilt 1 in. round heavy duty
  // self-adhesive felt pads, 16-pack, Home Depot $4.52 (model 49952, as reference sheet 25 source S79 gives it;
  // search snapshot, Nov 2026)
  {id:'felt-pads',name:'Felt pads, 1" round',match:/felt pads?/i,pack:16,sold:'pack of 16',price:4.52,search:'1 in. round heavy duty self-adhesive felt pads'},
  {id:'pulls',name:'Door and drawer pulls',match:/pulls?\b|knobs?\b/i,pack:1,sold:'each',price:3.5},
  {id:'catches',name:'Magnetic door catches',match:/catch/i,pack:1,sold:'each',price:2.5},
  {id:'latch',name:'Gate latch or hasp',match:/latch|hasp/i,pack:1,sold:'each',price:9},
  {id:'barrel-bolts',name:'Barrel bolts',match:/barrel bolts?/i,pack:1,sold:'each',price:6,search:'barrel bolt 4 in.'},
  {id:'lid-support',name:'Soft-close lid support',match:/lid support/i,pack:1,sold:'each',price:12,search:'toy box lid support soft close'},
  {id:'casters',name:'Casters',match:/casters?\b/i,pack:1,sold:'each',price:8,search:'swivel caster 3 in. with brake'},
  {id:'leveling-feet',name:'Leveling feet',match:/leveling feet/i,pack:4,sold:'pack of 4',price:10,search:'furniture leveling feet with t-nuts 4-pack'},
  {id:'shelf-pins',name:'Shelf pins, 1/4"',match:/shelf pins?\b/i,pack:20,sold:'pack of 20',price:4,search:'shelf pins 1/4 in. 20-pack'},
  // the bolts that join the separate sections of a fish rack (HARDWARE.bolt, js/hardware.js): a 3/8" carriage bolt
  // with its flat washer and nut, bought loose by the piece
  {id:'carriage-bolts',name:'Carriage bolts, 3/8", with a washer and a nut',match:/carriage bolts?/i,pack:1,sold:'each, with its washer and nut',price:1.6,search:'carriage bolt 3/8 in. zinc'},
  {id:'toggle-bolts',name:'Heavy-duty toggle bolts',match:/toggle bolts/i,pack:2,sold:'pack of 2',price:5,search:'heavy duty toggle bolt 1/4 in.'},
  // framing hardware for sheds and other outdoor buildings
  {id:'rafter-ties',name:'Metal hurricane ties',match:/rafter ties|hurricane/i,pack:1,sold:'each',price:1,search:'hurricane tie rafter to plate'},
  {id:'joist-hangers',name:'Joist hangers',match:/joist hangers?/i,pack:1,sold:'each',price:1.8},
  {id:'ground-anchors',name:'Ground anchors for a shed',match:/ground anchors/i,pack:1,sold:'each',price:15,search:'shed ground anchor auger with cable'},
  {id:'roofing-nails',name:'Roofing nails',match:/roofing nails/i,pack:1,sold:'1 lb box',price:5,search:'roofing nails 1-1/4 in. 1 lb'},
  {id:'landscape-fabric',name:'Landscape fabric',match:/landscape fabric/i,pack:50,sold:'roll of 3 ft × 50 ft',price:13,search:'landscape fabric 3 ft. x 50 ft.'},
  {id:'blocks',name:'Solid concrete blocks',match:/concrete blocks/i,pack:1,sold:'each',price:2.5,search:'solid concrete block 4 in. x 8 in. x 16 in.'},
  {id:'screw-eyes',name:'Screw eyes',match:/screw eyes/i,pack:1,sold:'each',price:1},
  {id:'chain',name:'Chain or rope',match:/chain or rope/i,pack:1,sold:'per foot',price:1,search:'chain by the foot'},
  // the Computer desk (js/computerdesk.js), each price from reference sheet 22 (design\reference\22-computer-desks.md, sources 59 and 61-63):
  // edge banding EDGEMATE 13/16" x 25 ft, $10-$13 [22 l.392]; the power strip Digital Energy 15 ft 6-outlet, two
  // keyhole mounting holes on the back, Home Depot $18.96; round-head screws Everbilt #8 x 3/4" 6-pack, Home Depot
  // $1.38; the hook a screw-mount under-desk headphone hook, $29 online (Home Depot lists clamp-on hooks only).
  {id:'edge-banding',name:'Edge banding, 13/16" iron-on',match:/edge banding/i,pack:1,sold:'25 ft roll',price:12,search:'13/16 in. iron-on edge banding 25 ft.'},
  {id:'power-strip',name:'Power strip, 6 outlets',match:/^power strip/i,pack:1,sold:'each',price:18.96,search:'6 outlet power strip surge protector keyhole mounting'},
  {id:'desk-hook',name:'Screw-on hook for headphones',match:/screw-on hook/i,pack:1,sold:'each',price:29,search:'screw mount under desk headphone hook'},
  // the Computer desk's stage 2, from reference sheet 22: the grommets 2" Commercial Electric $6.97 each at Home Depot
  // and 2 1/2" Rockler about $5 (4a, sources 24-25); the cup holder insert a plastic drop-in for a 3 3/4" hole,
  // Sea-Dog, $2.20 (section 10, source 68; one listing). The 2 1/2" row first: the 2" row's words would match it too.
  {id:'grommet-big',name:'Desk grommet, 2 1/2"',match:/desk grommet, 2 1\/2"/i,pack:1,sold:'each',price:5,search:'2-1/2 in. desk grommet'},
  {id:'grommet',name:'Desk grommet, 2"',match:/desk grommet/i,pack:1,sold:'each',price:6.97,search:'2 in. furniture hole grommet'},
  {id:'cup-insert',name:'Drop-in cup holder insert',match:/cup holder insert/i,pack:1,sold:'each',price:2.2,search:'drop in cup holder 3-3/4 in. hole'},
  {id:'sandpaper',name:'Sandpaper',match:/sandpaper/i,pack:1,sold:'pack',price:6,search:'sandpaper assorted grit pack'},
  {id:'filler',name:'Wood filler',match:/wood filler/i,pack:1,sold:'small tub',price:6,search:'wood filler'},
  {id:'conditioner',name:'Pre-stain wood conditioner',match:/conditioner/i,pack:1,sold:'quart',price:16,search:'pre-stain wood conditioner quart'},
  {id:'stain',name:'Wood stain',match:/wood stain/i,pack:1,sold:'quart',price:13,search:'wood stain quart'},
  {id:'primer',name:'Primer',match:/primer/i,pack:1,sold:'quart',price:14,search:'primer quart'},
  {id:'paint',name:'Paint',match:/^paint/i,pack:1,sold:'quart',price:20,search:'interior paint quart'},
  {id:'poly',name:'Polyurethane',match:/polyurethane/i,pack:1,sold:'quart',price:19,search:'polyurethane quart'},
  {id:'glue',name:'Wood glue',match:/wood glue/i,pack:1,sold:'8 oz bottle',price:5,search:'wood glue 8 oz'},
];

/* The stores a row of the shopping list can be looked up at. link(words) is that store's own search page; it
   opens in a new browser tab, where the person reads the price for their own store. */
const PRICE_STORES=[
  {name:'Home Depot',link:words=>'https://www.homedepot.com/s/'+encodeURIComponent(words)},
  {name:'Lowe\'s',link:words=>'https://www.lowes.com/search?searchTerm='+encodeURIComponent(words)},
];
/* how a store names a board of each wood (the keys are the wood ids of WOODS in js/style.js) */
const WOOD_SEARCH_WORDS={pine:'lumber',select:'select pine board',poplar:'poplar board',cedar:'cedar lumber',
  pt:'pressure-treated lumber',oak:'red oak board',rough:'rough sawn lumber'};
/* the wood of the design as the first words of a board's row on the shopping list; plain pine needs none */
const WOOD_ROW_WORDS={select:'Select pine',poplar:'Poplar',cedar:'Cedar',pt:'Pressure-treated',oak:'Red oak',rough:'Rough-sawn'};

/* ---------- 2. Dates, written the same way everywhere ---------- */
const PRICE_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
/* '2026-10' -> 'October 2026' (or 'Oct 2026' when short) */
function priceMonthText(month,short){
  const[year,number]=String(month).split('-'),name=PRICE_MONTHS[+number-1]||'';
  return`${short?name.slice(0,3):name} ${year}`;
}
/* '2026-11-15' -> 'Nov 15, 2026' */
function priceDayText(day){
  const[year,month,date]=String(day).split('-').map(Number);
  return PRICE_MONTHS[month-1]?`${PRICE_MONTHS[month-1].slice(0,3)} ${date}, ${year}`:'';
}
function priceToday(){
  const now=new Date(),two=n=>String(n).padStart(2,'0');
  return`${now.getFullYear()}-${two(now.getMonth()+1)}-${two(now.getDate())}`;
}

/* ---------- 3. The price book ---------- */
const PRICE_STORE_KEY='woodshop.prices';
let priceBook=readPriceBook();
let priceBookScratch=false; // true while selfTest works on a throwaway book: nothing is written to the browser

function emptyPriceBook(){
  return{
    v:2,
    store:'',       // where the person's own prices come from, in their words ("Home Depot"); never sent anywhere
    yours:{},       // key -> {p: dollars, d: the day it was typed, '' when not known}
    index:null,     // the last answer of the price index: {softwood:{factor, raw, month, value, base}, plywood:{...}}
    applied:false,  // whether the estimates are moved by that answer right now
    updated:'',     // the day that answer was fetched
    asked:0,        // when the service last answered (milliseconds), to ask at most once a day
    limited:0,      // when the service last said its daily limit was reached
    auto:false,     // "Update prices each time NominalCAD opens"
    lineOff:false,  // the line about prices at the top of the 3D view was closed for good
  };
}
/* Makes a price book out of whatever was saved: this version's shape, the older flat shape, or nothing usable. */
function priceBookFrom(saved){
  const book=emptyPriceBook(),goodPrice=p=>typeof p==='number'&&isFinite(p)&&p>=0;
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return book;
  if(saved.v!==2){
    // the older shape: {'2x4': 3.98, 'oak:1x6': 21}, every one a price the person typed
    for(const[key,price]of Object.entries(saved))if(goodPrice(price))book.yours[key]={p:price,d:''};
    return book;
  }
  if(typeof saved.store==='string')book.store=saved.store.slice(0,40);
  for(const[key,own]of Object.entries(saved.yours||{})){
    if(own&&goodPrice(own.p))book.yours[key]={p:own.p,d:typeof own.d==='string'?own.d:''};
  }
  const goodIndex=saved.index&&PRICE_INDEXES.every(source=>{
    const part=saved.index[source.id];
    return part&&part.factor>=PRICE_FACTOR_MIN&&part.factor<=PRICE_FACTOR_MAX&&typeof part.month==='string';
  });
  if(goodIndex){
    book.index={};
    for(const source of PRICE_INDEXES){
      const part=saved.index[source.id];
      book.index[source.id]={factor:part.factor,raw:+part.raw||part.factor,clamped:part.clamped===true,month:part.month,value:+part.value||0,base:+part.base||0};
    }
    book.applied=saved.applied===true;
    book.updated=typeof saved.updated==='string'?saved.updated:'';
    book.asked=+saved.asked||0;
  }
  book.limited=+saved.limited||0;
  book.auto=saved.auto===true;
  book.lineOff=saved.lineOff===true;
  return book;
}
function readPriceBook(){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(PRICE_STORE_KEY));}catch(e){} // no storage, or not JSON: start empty
  return priceBookFrom(saved);
}
function savePriceBook(){
  if(priceBookScratch)return;
  try{localStorage.setItem(PRICE_STORE_KEY,JSON.stringify(priceBook));}catch(e){} // the prices still hold until the page is closed
}
function setYourPrice(key,price){
  priceBook.yours[key]={p:price,d:priceToday()};
  savePriceBook();
}
function clearYourPrice(key){
  delete priceBook.yours[key];
  savePriceBook();
}

/* ---------- 4. What one thing costs, and whose price that is ----------
   Every answer is {price, source, date}:
     source  'yours', 'index', 'built-in', or 'none' (a hardware item this file has no estimate for)
     date    the day it was typed (yours), the day of the update (index) or the month it was set (built-in) */

/* typed prices are remembered per wood type: a 1x6 in oak is not a 1x6 in pine */
const priceKey=id=>(look().wood==='pine'?'':look().wood+':')+id;
/* the wood of the design in a few words: "Construction pine or spruce" */
const woodName=()=>WOODS[look().wood][0].replace(/\s*\(.*$/,'');

/* the built-in price of an 8 ft board or a full sheet in construction pine. A size without a row in PRICE8
   (one added later, or by the person) may carry its own price, or share the price of the size it is named after. */
function builtInPrice(m){
  if(PRICE8[m.id]!==undefined)return PRICE8[m.id];
  if(typeof m.price==='number'&&m.price>=0)return m.price;
  if(m.nom&&PRICE8[m.nom]!==undefined)return PRICE8[m.nom];
  return 0;
}
/* the answer of the price index that moves this material, or null when the estimates are not moved */
function indexFor(kind){
  if(!priceBook.applied||!priceBook.index)return null;
  const source=PRICE_INDEXES.find(s=>s.kind===kind);
  return source?priceBook.index[source.id]:null;
}
/* Dollars rounded to whole cents. Every price that is shown or added up goes through this, so that a row of the
   shopping list (how many, times the price of one) and the total under the rows always agree to the cent. */
const cents=amount=>Math.round(amount*100)/100;
/* the built-in estimate for an 8 ft board or one sheet in the wood of the design, before the price index */
function lumberEstimate(m){
  const dearer=m.treated?1:WOODS[look().wood][2];                          // how much dearer this wood is than pine (a treated board has a price of its own)
  return builtInPrice(m)*(m.kind==='sheet'?Math.pow(dearer,.6):dearer);    // plywood follows the wood only part of the way
}
/* an 8 ft board or one sheet of this material, in the wood of the design */
function lumberPriceInfo(id){
  const m=M[id],key=priceKey(id);
  if(!m)return{price:0,source:'none',date:'',key};
  const own=priceBook.yours[key];
  if(own)return{price:own.p,source:'yours',date:own.d,key};
  const base=lumberEstimate(m),moved=indexFor(m.kind);
  if(moved)return{price:base*moved.factor,source:'index',date:priceBook.updated,key};
  return{price:base,source:'built-in',date:PRICE_BASELINE.month,key};
}
/* dollars for one board of the given length in inches, or for one sheet (stock 0) */
function priceOf(id,stock){
  return cents(lumberPriceInfo(id).price*(stock?stock/96:1));
}
function hardwareFamily(label){
  return HARDWARE_PRICES.find(family=>family.match.test(label))||null;
}
/* one pack of a hardware item. A price typed for exactly this item wins over one typed for its whole row of
   HARDWARE_PRICES, and that wins over the built-in estimate. Pass label '' for the row itself. */
function hardwarePriceInfo(label,family){
  if(family&&family.mat)return lumberPriceInfo(family.mat);   // a sheet of plywood: the price of that sheet
  const itemKey='hw:'+label,familyKey=family?'hwf:'+family.id:'';
  const key=label?itemKey:familyKey;
  // a price for exactly this item, else for its row, else for the general row its length belongs to
  const own=(label&&priceBook.yours[itemKey])||(family&&priceBook.yours[familyKey])||
    (family&&family.parent&&priceBook.yours['hwf:'+family.parent]);
  if(own)return{price:own.p,source:'yours',date:own.d,key};
  if(family)return{price:family.price,source:'built-in',date:PRICE_BASELINE.month,key};
  return{price:null,source:'none',date:'',key};
}
function priceDateText(info){
  if(info.source==='built-in')return priceMonthText(info.date,true);
  return info.date?priceDayText(info.date):'';
}
/* the small mark beside a price: whose price it is, and from when */
function priceMarkHtml(info){
  const date=priceDateText(info);
  if(info.source==='yours'){
    return`<span class="pmark yours" title="Your price${date?', typed on '+date:''}. It always wins over an estimate. Empty the box to go back to the estimate.">yours</span>${date?' '+date:''}`;
  }
  if(info.source==='none')return`<span class="pmark" title="There is no built-in estimate for this item. Type what it costs at your store.">no estimate</span>`;
  const how=info.source==='index'?'moved by the national lumber price index':'built into the program';
  return`<span class="pmark" title="An estimate ${how}: a national average, not a quote from any store.">est.</span> ${date}`;
}

/* ---------- 5. Sentences about where the prices stand ---------- */
/* A factor of 1.043 reads '+4.3%': to a tenth of a percent, so that the words match what the prices do.
   Only a factor of exactly 1 reads 'no change'. */
function pricePercent(factor){
  const tenths=Math.round((factor-1)*1000)/10,size=Math.abs(tenths);
  if(factor===1)return'no change';
  if(!size)return factor>1?'up less than 0.1%':'down less than 0.1%';
  return`${tenths>0?'+':'-'}${size}%`;
}
/* how far each kind of material has been moved: "boards +4.3%, plywood -2.1%" */
function priceMovesText(){
  return PRICE_INDEXES.map(source=>`${source.word} ${pricePercent(priceBook.index[source.id].factor)}`).join(', ');
}
/* the first sentence in the shopping list and the Price book: built-in estimates, or estimates moved by the
   index (by how much, and since when) */
function priceSourceSentence(){
  if(!priceBook.applied||!priceBook.index)return`Prices are built-in estimates from ${priceMonthText(PRICE_BASELINE.month)}.`;
  const held=PRICE_INDEXES.filter(source=>priceBook.index[source.id].clamped).map(source=>{
    const part=priceBook.index[source.id];
    return` The index for ${source.word} moved ${pricePercent(part.raw)}, more than this program allows, so it is held at ${pricePercent(part.factor)}.`;
  }).join('');
  return`Prices updated ${priceDayText(priceBook.updated)} from the national lumber price index (${priceMovesText()} since ${priceMonthText(PRICE_BASELINE.month)}).${held}`;
}
/* what a finished update says: the same sentence, and that these are still estimates */
function priceResultSentence(){
  const moved=priceBook.applied&&priceBook.index;
  return priceSourceSentence()+(moved?' These are estimates. Type your store\'s price in the shopping list to make it exact.':'');
}
/* The line at the top of the 3D view: short enough for one line. (The whole sentence is its tooltip, and it
   is written out in the shopping list and the Price book.) */
function priceLineSentence(){
  if(!priceBook.applied||!priceBook.index)return priceSourceSentence();
  const held=PRICE_INDEXES.some(source=>priceBook.index[source.id].clamped);
  return`Estimated prices, updated ${priceDayText(priceBook.updated)} from the national lumber price index (${priceMovesText()}${held?', held at the limit this program allows':''}).`;
}
const PRICE_HONEST='They are national averages, not a quote from any store.';
/* the line under the Shopping list heading, on screen and on paper */
function shoppingSourceSentence(counts){
  const from=priceBook.store.trim();
  const own=!counts.yours?'':from?` Prices marked "yours" are from ${from}.`:' Prices marked "yours" were typed in by hand.';
  return`${priceSourceSentence()} ${PRICE_HONEST}${own}`;
}

/* ---------- 6. Update prices: ask the price index, move the estimates ---------- */
let priceBusy=false;   // a question to the price service is on its way
let priceNotice='';    // what the last try said when it did not simply go through; shown until the next try

const PRICE_FAILURES={
  blocked:'Could not reach the price service. Your prices are unchanged.',
  busy:'The price service is busy right now. Try again later. Your prices are unchanged.',
  refused:'The price service answered with an error. Your prices are unchanged.',
  offline:'Could not reach the price service (this computer is offline). Your prices are unchanged.',
  timeout:'Could not reach the price service (it did not answer in time). Your prices are unchanged.',
  unreadable:'The price service sent an answer this program cannot read. Your prices are unchanged.',
  limit:'The price service has reached its daily limit for your internet connection. Try again tomorrow. Your prices are unchanged.',
  hosted:'The online copy of NominalCAD cannot update prices. Your prices are unchanged.',
};
const priceFailure=why=>({ok:false,asked:false,why,message:PRICE_FAILURES[why]||PRICE_FAILURES.blocked});
const canUpdatePrices=()=>!HOSTED&&!priceBusy; // the hosted frame blocks requests to other websites
/* true when `when` (milliseconds, 0 for never) lies less than `span` milliseconds back. A time in the future,
   from a clock that was set back, does not count. */
function happenedWithin(when,span){
  const ago=Date.now()-when;
  return when>0&&ago>=0&&ago<span;
}
/* the service was asked within the last day and its answer is remembered: no need to ask again */
const priceAnswerIsFresh=()=>!!priceBook.index&&happenedWithin(priceBook.asked,PRICE_ASK_AGAIN_MS);

/* Reads one answer of the service. Returns {points:[{month:'2026-10', value:277.6}, ...]} newest first, or
   {why:'limit'} when the daily limit is reached, or {why:'unreadable'}. wanted is the series that was asked
   for: figures that say they belong to another series are not used. */
function readIndexAnswer(json,wanted){
  if(!json||typeof json!=='object')return{why:'unreadable'};
  if(json.status!=='REQUEST_SUCCEEDED'){
    const said=Array.isArray(json.message)?json.message.join(' '):'';
    return{why:/threshold|limit/i.test(said)?'limit':'unreadable'};
  }
  const series=json.Results&&Array.isArray(json.Results.series)?json.Results.series[0]:null;
  if(!series||!Array.isArray(series.data))return{why:'unreadable'};
  if(wanted&&typeof series.seriesID==='string'&&series.seriesID!==wanted)return{why:'unreadable'};
  const points=[];
  for(const row of series.data){
    const month=/^M(0[1-9]|1[0-2])$/.exec(row&&row.period||''),value=parseFloat(row&&row.value); // M13 is the yearly average: skipped
    if(month&&/^\d{4}$/.test(row.year)&&isFinite(value)&&value>0)points.push({month:`${row.year}-${month[1]}`,value});
  }
  points.sort((a,b)=>a.month<b.month?1:-1);
  return points.length?{points}:{why:'unreadable'};
}
/* How far one index has moved since the month the built-in prices were set: the newest month over that month.
   Returns {factor, raw, clamped, month, value, base}, or null when the numbers make no sense. */
function indexFactor(points,source){
  const newest=points[0],revised=points.find(point=>point.month===PRICE_BASELINE.month);
  const base=revised?revised.value:PRICE_BASELINE[source.id];
  // figures that stop before the baseline month say nothing about what happened since then
  const raw=newest.month>PRICE_BASELINE.month?newest.value/base:1;
  if(!isFinite(raw)||raw<=0)return null;
  const factor=Math.min(PRICE_FACTOR_MAX,Math.max(PRICE_FACTOR_MIN,raw));
  return{factor,raw,clamped:factor!==raw,month:newest.month,value:newest.value,base};
}
/* Asks the service for one index. done(points) on success, done(null, why) otherwise; exactly one call, no throw.
   fetchFn is the browser's fetch, or a stand-in during selfTest. The request names the series and nothing else:
   no cookies, no page address, no body. */
function askPriceSeries(source,fetchFn,done){
  let settled=false,timer=0;
  const stop=typeof AbortController==='function'?new AbortController():null;
  const finish=(points,why)=>{
    if(settled)return;
    settled=true;
    clearTimeout(timer);
    done(points,why);
  };
  timer=setTimeout(()=>{
    finish(null,'timeout');
    if(stop)stop.abort();
  },PRICE_TIMEOUT_MS);
  try{
    const request={method:'GET',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'};
    if(stop)request.signal=stop.signal;
    fetchFn(PRICE_SERVICE_URL+source.series,request)
      .then(response=>{
        if(!response)throw new Error('no answer');
        if(!response.ok){
          // the service was reached and said no: "too many requests" and "not available now" read as busy
          finish(null,response.status===429||response.status===503?'busy':'refused');
          return null;
        }
        return response.json();
      })
      .then(json=>{
        if(settled)return;
        let read;
        try{read=readIndexAnswer(json,source.series);}catch(e){read={why:'unreadable'};}
        finish(read.points||null,read.why||'');
      },()=>finish(null,'blocked')); // offline, blocked on the way, or an answer that is not JSON
  }catch(e){finish(null,'blocked');}
}
/* Asks for every index, one after the other. done(answers) with {softwood:points, plywood:points}, or
   done(null, why) as soon as one cannot be had: then nothing is changed. */
function askPriceIndex(fetchFn,done){
  const answers={};
  const ask=i=>{
    if(i===PRICE_INDEXES.length){done(answers,'');return;}
    const source=PRICE_INDEXES[i];
    askPriceSeries(source,fetchFn,(points,why)=>{
      if(!points){done(null,why);return;}
      answers[source.id]=points;
      ask(i+1);
    });
  };
  ask(0);
}
/* Takes the answers into the price book and moves the estimates. Prices the person typed are not touched:
   they are looked up first (lumberPriceInfo). Returns the result that updatePrices hands on. */
function applyPriceIndex(answers){
  const index={};
  for(const source of PRICE_INDEXES){
    const part=indexFactor(answers[source.id],source);
    if(!part)return priceFailure('unreadable');
    index[source.id]=part;
  }
  priceBook.index=index;
  priceBook.applied=true;
  priceBook.updated=priceToday();
  priceBook.asked=Date.now();
  savePriceBook();
  return{ok:true,asked:true,message:priceResultSentence()};
}
/* Update prices. Calls done({ok, asked, message}) once, when it is over. It never throws, and when it does not
   succeed nothing about the prices has changed.
     ok       the estimates now follow the index
     asked    new figures were fetched just now (false when the remembered answer of the last day was used
              again, and when the update did not succeed)
     message  one or two plain sentences for the person
   options.fetch stands in for the browser's fetch (selfTest uses it, so that it never touches the network). */
function updatePrices(options,done){
  options=options||{};
  if(priceBusy)return;
  const end=result=>{
    priceBusy=false;
    priceNotice=result.ok&&!result.already?'':result.message; // a plain success needs no extra words: the prices say it
    // a mistake in drawing the result must not turn into an error thrown at the person: it is noted for developers
    try{
      refreshPriceViews();
      if(done)done(result);
    }catch(e){console.error(e);}
  };
  if(HOSTED){end(priceFailure('hosted'));return;}
  if(priceAnswerIsFresh()){
    // asked within the last day: the index only changes once a month, so the remembered answer is used again
    const already=priceBook.applied;
    priceBook.applied=true;
    savePriceBook();
    end({ok:true,asked:false,already,message:already
      ?'Already up to date. The price index was asked within the last day, and it only changes once a month.'
      :priceResultSentence()});
    return;
  }
  if(happenedWithin(priceBook.limited,PRICE_LIMIT_WAIT_MS)){end(priceFailure('limit'));return;}
  if(!options.fetch&&typeof navigator!=='undefined'&&navigator.onLine===false){end(priceFailure('offline'));return;}
  const fetchFn=options.fetch||(typeof fetch==='function'?(url,request)=>fetch(url,request):null);
  if(!fetchFn){end(priceFailure('blocked'));return;}
  priceBusy=true;
  priceNotice='Asking the price service…';
  try{refreshPriceViews();}catch(e){console.error(e);}
  askPriceIndex(fetchFn,(answers,why)=>{
    let result;
    try{
      result=answers?applyPriceIndex(answers):priceFailure(why);
      if(result.why==='limit'){priceBook.limited=Date.now();savePriceBook();}
    }catch(e){result=priceFailure('unreadable');}
    end(result);
  });
}
/* The Update prices command. The answer is written where the person is looking (the line over the 3D view,
   the shopping list or the Price book); only when none of those is on screen does it come as a short message. */
function updatePricesClicked(){
  updatePrices({},result=>{
    if(!priceResultOnScreen())toast(result.message);
  });
}
function priceResultOnScreen(){
  if($('#priceDlg').open||visibleShopping())return true;
  return tab==='design'&&!priceBook.lineOff&&!document.querySelector('dialog[open]');
}

/* ---------- 7. Everything on screen that shows a price ---------- */
/* Call after any change to the price book. Nothing here rebuilds the 3D scene. */
function refreshPriceViews(){
  renderPriceLine();
  const section=visibleShopping();
  if(section&&shopNow)syncShopping(section);
  if($('#priceDlg').open)syncPriceBook();
  if($('#styleDlg').open)renderStyle();                         // the lumber cost of each style
  if($('#presetDlg').open&&curPreset)showPresetSummary();       // "About $..." under the preset form
  if(window.syncChecks)syncChecks();                            // Update prices is greyed out while it runs
}
/* the Shopping list of the tab that is open, or null */
function visibleShopping(){
  return tab==='cut'?$('#cutPage [data-shop]'):tab==='instr'?$('#instrPage [data-shop]'):null;
}

/* The slim line at the top of the 3D view: where the prices stand, with Update prices beside it. Its close
   button puts it away for good (Update prices stays in the File menu, the shopping list and the Price book). */
function renderPriceLine(){
  const line=$('#priceLine');
  line.hidden=priceBook.lineOff;
  if(priceBook.lineOff)return;
  $('#priceLineText').textContent=priceNotice||priceLineSentence();
  $('#priceLineText').title=`${priceSourceSentence()} ${PRICE_HONEST}`;
}
$('#priceLineOff').onclick=()=>{
  priceBook.lineOff=true;
  savePriceBook();
  renderPriceLine();
};
/* When the program opens: show the line, and bring the prices up to date if the person asked for that. */
function startPrices(){
  renderPriceLine();
  const upToDate=priceBook.applied&&priceAnswerIsFresh();        // updated within the last day: nothing to do or say
  if(priceBook.auto&&canUpdatePrices()&&!upToDate)updatePrices({}); // quiet: the line (if it is still shown) says how it went
}
if(document.readyState==='complete')startPrices();
else window.addEventListener('load',startPrices);

/* ---------- 8. The shopping list ---------- */
let shopNow=null; // {buy, hardware, model} of the shopping list drawn last, so a typed price can update it in place

/* the words to type into a store's search box for one board or sheet */
function lumberSearchWords(m,stock){
  if(m.kind==='sheet')return`${fmt(m.t).replace('"','')} in. x 4 ft. x 8 ft. plywood`;
  // a pressure-treated board is looked up by the plain size it is named after, as treated lumber
  const named=/^(\d+)x(\d+)$/.exec(m.treated?m.nom:m.id),wood=m.treated?WOOD_SEARCH_WORDS.pt:WOOD_SEARCH_WORDS[look().wood]||'lumber';
  return named?`${named[1]} in. x ${named[2]} in. x ${stock/12} ft. ${wood}`:`${m.short} ${stock/12} ft. ${wood}`;
}
function hardwareSearchWords(label,family){
  if(family&&family.search)return family.search;
  return label.replace(/×/g,'x').replace(/(\d)"/g,'$1 in.').replace(/[()]/g,' ').replace(/\s+/g,' ').trim();
}
/* where to look a row up: a link to each store's search, or in the hosted copy (where a link may be blocked)
   the words to search for */
function lookupHtml(words){
  if(HOSTED)return`<span class="pwords" title="Type these words into the search box of your store's website">${esc(words)}</span>`;
  return PRICE_STORES.map(store=>
    `<a target="_blank" rel="noopener noreferrer" href="${esc(store.link(words))}" title="Opens the search for &quot;${esc(words)}&quot; at ${esc(store.name)} in a new tab. Pick your store there, read the price and type it into the box.">${esc(store.name)}</a>`
  ).join(' ');
}
/* Everything the shopping list shows, worked out in one place.
     buy       what the cutting diagrams say to buy: [{m (material), qty, stock (board length in inches, 0 for a sheet)}]
     hardware  {rows:[[item, quantity]], glue} from hardwareTotals() in js/style.js
   Returns {rows, total, counts:{yours, estimates, none}}. A row: {group, name, note, qty, key, scale, each, info,
   total, words}; scale is how many 8 ft boards one of the row stands for (a 10 ft board is 1.25). */
function shoppingModel(buy,hardware){
  const rows=[];
  for(const b of buy){
    const info=lumberPriceInfo(b.m.id),each=priceOf(b.m.id,b.stock);
    // a board is named with its wood when that is not plain pine, so the list says what to ask for: "Cedar 2x6, 8 ft long"
    const wood=b.m.treated?'':WOOD_ROW_WORDS[look().wood]||'';
    rows.push({group:'lumber',name:b.stock?`${wood?wood+' ':''}${b.m.short}, ${b.stock/12} ft long`:`${b.m.short}, 4 ft × 8 ft sheet`,note:'',
      qty:b.qty,key:info.key,scale:b.stock?b.stock/96:1,each,info,total:cents(each*b.qty),words:lumberSearchWords(b.m,b.stock)});
  }
  // sheets a preset asks for to cut on site (the Shed's gable ends) are lumber: they stand with the lumber rows
  // and count in "Lumber, before tax" (sheetsToCutOnSite)
  const sheetItems=hardware?sheetsToCutOnSite(hardware.rows):[];
  for(const{label,qty,m}of sheetItems){
    const info=lumberPriceInfo(m.id),each=priceOf(m.id,0);
    rows.push({group:'lumber',name:label,note:'',qty,key:info.key,scale:1,each,info,total:cents(each*qty),words:lumberSearchWords(m,0)});
  }
  const items=hardware?hardware.rows.filter(([label])=>!sheetItems.some(sheet=>sheet.label===label)):[];
  if(hardware&&hardware.glue)items.push(['Wood glue',1]);
  for(const[label,quantity]of items){
    const family=hardwareFamily(label),need=Math.max(0,+quantity||0),pack=family?family.pack:1;
    const packs=Math.max(1,Math.ceil(need/pack)),info=hardwarePriceInfo(label,family);
    const each=info.price===null?null:cents(info.price);
    rows.push({group:'hardware',name:pack>1?`${label}, ${family.sold}`:label,note:pack>1?`${need} needed`:'',
      qty:packs,key:info.key,scale:1,each,info,total:each===null?null:cents(each*packs),
      words:hardwareSearchWords(label,family)});
  }
  // the total is the sum of the row totals as they are shown, so the page always adds up
  const counts={yours:0,estimates:0,none:0};
  let total=0,lumber=0;
  for(const row of rows){
    total+=row.total||0;
    if(row.group==='lumber')lumber+=row.total||0;   // the lumber alone: the figure the presets window shows ("Lumber, about")
    counts[row.info.source==='yours'?'yours':row.info.source==='none'?'none':'estimates']++;
  }
  return{rows,total:cents(total),lumber:cents(lumber),counts};
}
/* The lines of a hardware list that are really sheets of plywood, bought by the sheet and cut on site (a row of
   HARDWARE_PRICES with mat): [{label, qty, m}]. The shopping list counts them with the lumber, the presets
   window adds them to its lumber cost (addSheetsToCutOnSite), and the Hardware table leaves them out
   (hardwareWithoutSheets), so they are bought once, as lumber. */
function sheetsToCutOnSite(rows){
  const out=[];
  for(const[label,quantity]of rows||[]){
    const family=hardwareFamily(label),qty=Math.max(0,+quantity||0);
    if(family&&family.mat&&M[family.mat]&&qty>0)out.push({label,qty,m:M[family.mat]});
  }
  return out;
}
/* A plan of what to buy ({boards, sheets, cost}, lumberToBuy in js/buying.js) with the sheets of a preset's own
   hardware lines added, as the shopping list counts them. Changes buy and returns it. */
function addSheetsToCutOnSite(buy,hardwareLines){
  for(const{qty,m}of sheetsToCutOnSite(hardwareLines)){
    buy.sheets+=qty;
    buy.cost+=qty*priceOf(m.id,0);
  }
  return buy;
}
/* hardwareTotals() without the sheets of plywood, for the Hardware tables (they are on the shopping list as lumber) */
function hardwareWithoutSheets(hardware){
  const sheets=new Set(sheetsToCutOnSite(hardware.rows).map(sheet=>sheet.label));
  return{...hardware,rows:hardware.rows.filter(([label])=>!sheets.has(label))};
}
/* "$3.98", "$1,228.93": dollars and cents, with a comma in the thousands as the presets window writes them */
const dollars=amount=>amount===null?'':'$'+cents(amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
/* what a price box shows: "3.98", or nothing when there is no price */
const priceBoxText=price=>price===null?'':cents(price).toFixed(2);
/* "3 prices are yours and 9 are estimates." */
function shoppingCountSentence(counts){
  const priced=counts.yours+counts.estimates;
  let text='';
  if(priced===1)text=counts.yours?'The one price is yours.':'The one price is an estimate.';
  else if(priced&&!counts.yours)text=`All ${priced} prices are estimates.`;
  else if(priced&&!counts.estimates)text=`All ${priced} prices are yours.`;
  else if(priced)text=`${counts.yours} ${counts.yours===1?'price is':'prices are'} yours and ${counts.estimates} ${counts.estimates===1?'is an estimate':'are estimates'}.`;
  if(counts.none)text+=` ${plural(counts.none,'item')} ${counts.none===1?'has':'have'} no price yet and ${counts.none===1?'is':'are'} not in the total.`;
  return text.trim();
}
/* The Shopping list section of a document page. Called by renderCut (js/plans.js). The price boxes are wired
   once for the whole page, further down. */
function shoppingSection(buy,hardware){
  const model=shoppingModel(buy,hardware);
  shopNow={buy,hardware,model};
  const rows=[];
  // under the last lumber row, what the lumber alone comes to: the presets window quotes this ("Lumber, about")
  const lumberRow=`<tr class="total"><td colspan="4">Lumber, before tax</td><td class="num c-lumber">${dollars(model.lumber)}</td><td class="noprint"></td></tr>`;
  model.rows.forEach((row,i)=>{
    if(row.group==='hardware'&&i>0&&model.rows[i-1].group==='lumber')rows.push(lumberRow);
    if(row.group==='hardware'&&(i===0||model.rows[i-1].group!=='hardware'))rows.push(`<tr class="sub"><td colspan="6">Hardware and supplies</td></tr>`);
    rows.push(`<tr data-row="${i}"><td>${esc(row.name)}${row.note?` <span class="pnote">${esc(row.note)}</span>`:''}</td><td class="num">${row.qty}</td>`+
      // the price is a box to type in on screen and one plain number on paper (class "printonly")
      `<td class="num"><span class="noprint">$ <input class="fld price" data-row="${i}" value="${priceBoxText(row.each)}" aria-label="Price of one: ${esc(row.name)}" title="Type the price at your store. Empty the box to go back to the estimate."></span><span class="printonly c-twin">${dollars(row.each)}</span></td>`+
      `<td class="nowrap c-mark">${priceMarkHtml(row.info)}</td>`+
      `<td class="num c-total">${dollars(row.total)}</td>`+
      `<td class="noprint nowrap">${lookupHtml(row.words)}</td></tr>`);
  });
  rows.push(`<tr class="total"><td colspan="4">Estimated total, before tax</td><td class="num c-grand">${dollars(model.total)}</td><td class="noprint"></td></tr>`);
  const update=HOSTED?'':`<button class="btn s" data-cmd="updatePrices" title="Asks the national lumber price index how much boards and plywood have moved, and moves the estimates. Prices you typed are never changed.">${icon('i-refresh')}Update prices</button>`;
  return`<div data-shop><h2>Shopping list</h2>`+
    `<p class="hint psrc">${esc(shoppingSourceSentence(model.counts))}</p>`+
    `<p class="noprint pbar">${update}`+
      `<button class="btn s" data-cmd="priceBook" title="Every price the program uses, where each one comes from, and your store">${icon('i-price')}Price book…</button>`+
      `<button class="btn s" data-cmd="pastePrices" title="Reads prices from lines copied from a receipt or a store page">${icon('i-paste')}Paste prices…</button>`+
      `<span class="pnotice">${esc(priceNotice)}</span></p>`+
    docTable([['Buy',''],['Qty','num'],['Price each','num'],['Price from',''],['Total','num'],[HOSTED?'Search a store for':'Look it up','noprint']],rows,'shop')+
    `<p class="hint psum">${esc(shoppingCountSentence(model.counts))}</p>`+
    `<p class="hint noprint">Type the price from your store into a box and the total follows. It is remembered with today's date and marked "yours". `+
      (HOSTED?'The last column has the words to type into the search box of your store\'s website.'
        :`${esc(PRICE_STORES.map(store=>store.name).join(' and '))} open that store's search for the item in a new tab.`)+`</p></div>`;
}
/* Brings a shopping list that is on screen up to date without drawing it again, so that the box being typed in,
   and whatever the pointer is about to click, stay where they are. */
function syncShopping(section){
  const model=shopNow.model=shoppingModel(shopNow.buy,shopNow.hardware);
  section.querySelectorAll('tr[data-row]').forEach(tr=>{
    const row=model.rows[+tr.dataset.row];
    if(!row)return;
    const box=tr.querySelector('input.price');
    if(!box.classList.contains('bad'))box.value=priceBoxText(row.each);
    tr.querySelector('.c-twin').textContent=dollars(row.each);
    tr.querySelector('.c-mark').innerHTML=priceMarkHtml(row.info);
    tr.querySelector('.c-total').textContent=dollars(row.total);
  });
  section.querySelector('.c-grand').textContent=dollars(model.total);
  const lumberCell=section.querySelector('.c-lumber');
  if(lumberCell)lumberCell.textContent=dollars(model.lumber);
  section.querySelector('.psrc').textContent=shoppingSourceSentence(model.counts);
  section.querySelector('.psum').textContent=shoppingCountSentence(model.counts);
  section.querySelector('.pnotice').textContent=priceNotice;
}
/* Takes what was typed into a price box. An empty box goes back to the estimate; a number becomes the person's
   own price. scale = how many 8 ft boards the box stands for (see shoppingModel). Returns false, and marks the
   box, when the text is not a price. */
function takeTypedPrice(box,key,scale){
  const text=box.value.replace(/[$,\s]/g,''),price=Number(text);
  const bad=text!==''&&(!/^(\d+\.?\d*|\.\d+)$/.test(text)||price>100000); // plain dollars and cents only: not "1e3", not "0x10"
  box.classList.toggle('bad',bad);
  if(bad)return false;
  if(text==='')clearYourPrice(key);
  else setYourPrice(key,scale===1?cents(price):price/scale); // a price for another length is kept exact, so it reads back as typed
  return true;
}
/* Printing while a price box is still being typed in: the price is taken first, so the paper says what the
   screen says. */
window.addEventListener('beforeprint',()=>{
  const box=document.activeElement;
  if(box&&box.matches&&box.matches('[data-shop] input.price'))box.blur();
});
document.addEventListener('change',e=>{
  const box=e.target.closest?e.target.closest('[data-shop] input.price'):null;
  if(!box||!shopNow)return;
  const row=shopNow.model.rows[+box.dataset.row];
  if(!row||!takeTypedPrice(box,row.key,row.scale))return;
  priceNotice='';
  refreshPriceViews();
});
/* Enter in a price box keeps the price and goes on to the next box of the same table (the shopping list or the
   Price book), so a column of prices can be typed without the mouse. */
function priceBoxEnter(e){
  if(e.key!=='Enter'||!e.target.matches||!e.target.matches('input.price'))return false;
  e.preventDefault();
  const boxes=[...e.target.closest('table').querySelectorAll('input.price')],next=boxes[boxes.indexOf(e.target)+1];
  e.target.blur(); // the price is taken when the box is left
  if(next){next.focus();next.select();}
  return true;
}
document.addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('[data-shop]'))priceBoxEnter(e);
});

/* ---------- 9. The Price book dialog ----------
   Every board size, sheet and hardware row with its price, where the price comes from and its date. A price
   typed here is the person's own from then on; Reset puts one row back to the estimate. */
function priceBookRows(){
  const rows=[],wood=woodName();
  const lumber=(kind,heading,sold)=>{
    rows.push({heading});
    for(const m of MATS)if(m.kind===kind)rows.push({name:m.short,sold,info:lumberPriceInfo(m.id)});
  };
  lumber('board',`Boards: ${wood}`,'8 ft board');
  lumber('sheet',`Plywood: ${wood}`,'4 ft × 8 ft sheet');
  rows.push({heading:'Hardware and supplies'});
  // (a row that is a sheet of plywood, mat, has its price in the plywood rows above)
  for(const family of HARDWARE_PRICES)if(!family.mat)rows.push({name:family.name,sold:family.sold,info:hardwarePriceInfo('',family)});
  // single items the person priced in a shopping list
  const items=Object.keys(priceBook.yours).filter(key=>key.startsWith('hw:')).sort();
  for(const key of items){
    const label=key.slice(3),family=hardwareFamily(label);
    rows.push({name:label,sold:family?family.sold:'each',info:hardwarePriceInfo(label,family)});
  }
  return rows.map(row=>row.heading?row:{...row,key:row.info.key});
}
function priceBookCells(row){
  const own=row.info.source==='yours';
  return{
    from:`<span class="pmark${own?' yours':''}">${row.info.source}</span>`,
    date:priceDateText(row.info),
    reset:own?`<button class="btn s" data-reset title="Forget your price for this row and go back to the estimate">Reset</button>`:'',
  };
}
function renderPriceBook(){
  const rows=priceBookRows().map(row=>{
    if(row.heading)return`<tr class="sub"><td colspan="6">${esc(row.heading)}</td></tr>`;
    const cells=priceBookCells(row);
    return`<tr data-key="${esc(row.key)}"><td>${esc(row.name)}</td><td>${esc(row.sold)}</td>`+
      `<td class="num">$ <input class="fld price" value="${priceBoxText(row.info.price)}" aria-label="Price of ${esc(row.name)}"></td>`+
      `<td class="c-mark">${cells.from}</td><td class="nowrap c-date">${cells.date}</td><td class="act c-reset">${cells.reset}</td></tr>`;
  });
  $('#priceBookTable').innerHTML=docTable([['Item',''],['Sold as',''],['Price','num'],['From',''],['Date',''],['','']],rows);
  syncPriceBookText();
}
/* the words around the table: where the prices stand, and what the last update said */
function syncPriceBookText(){
  $('#priceBookStatus').textContent=`${priceSourceSentence()} ${PRICE_HONEST} A price you type here or in a shopping list is yours: it always wins and no update changes it.`;
  $('#priceBookNote').textContent=priceNotice;
}
/* brings the open dialog up to date in place; draws the table again only when its rows have changed */
function syncPriceBook(){
  const rows=priceBookRows().filter(row=>!row.heading),drawn=[...document.querySelectorAll('#priceBookTable tr[data-key]')];
  if(rows.length!==drawn.length||rows.some((row,i)=>drawn[i].dataset.key!==row.key)){renderPriceBook();return;}
  rows.forEach((row,i)=>{
    const tr=drawn[i],box=tr.querySelector('input.price'),cells=priceBookCells(row);
    if(!box.classList.contains('bad'))box.value=priceBoxText(row.info.price);
    tr.querySelector('.c-mark').innerHTML=cells.from;
    tr.querySelector('.c-date').textContent=cells.date;
    if(!!tr.querySelector('[data-reset]')!==!!cells.reset)tr.querySelector('.c-reset').innerHTML=cells.reset;
  });
  syncPriceBookText();
}
function openPriceBook(){
  $('#priceStore').value=priceBook.store;
  $('#priceAuto').checked=priceBook.auto;
  $('#priceLineShow').checked=!priceBook.lineOff;
  renderPriceBook();
  if(!$('#priceDlg').open)$('#priceDlg').showModal();
}
$('#priceStore').oninput=e=>{
  priceBook.store=e.target.value.slice(0,40);
  savePriceBook();
};
$('#priceAuto').onchange=e=>{
  priceBook.auto=e.target.checked;
  savePriceBook();
};
$('#priceLineShow').onchange=e=>{
  priceBook.lineOff=!e.target.checked;
  savePriceBook();
  renderPriceLine();
};
$('#priceBookTable').addEventListener('change',e=>{
  const box=e.target.closest('input.price'),tr=box&&box.closest('tr[data-key]');
  if(!tr||!takeTypedPrice(box,tr.dataset.key,1))return;
  priceNotice='';
  refreshPriceViews();
});
$('#priceBookTable').addEventListener('click',e=>{
  const button=e.target.closest('[data-reset]');
  if(!button)return;
  clearYourPrice(button.closest('tr[data-key]').dataset.key);
  refreshPriceViews();
});
/* Enter in a price box goes to the next row. (Left alone, Enter in a dialog presses its primary button, Done.) */
$('#priceBookTable').addEventListener('keydown',e=>{
  if(priceBoxEnter(e))e.stopPropagation();
});
$('#bPriceReset').onclick=()=>{
  askConfirm('Forget every price you typed and go back to the built-in estimates? The adjustment from the price index is taken off too. Your store name stays.',
    {title:'Reset all prices',action:'Reset all',danger:true},()=>{
      priceBook.yours={};
      priceBook.applied=false;
      savePriceBook();
      priceNotice='';
      refreshPriceViews();
    });
};
$('#priceDlg').addEventListener('close',()=>refreshPriceViews()); // the store name may have changed

/* ---------- 10. Paste prices ----------
   Reads lines copied from a receipt, an order or a store page, shows what it found and what it could not
   read, and saves nothing until the person agrees. */
const PASTE_NUMBER='(\\d+(?:[ -]\\d+\\/\\d+)?|\\d+\\/\\d+|\\d*\\.\\d+)';      // 2, 1-1/2, 3/4, 0.75
const PASTE_INCH='(?:\\s*-?\\s*(?:in(?:ch(?:es)?)?\\.?|["”]))?';               // an optional "in." after a number
const PASTE_LENGTH='\\s*-?\\s*(ft\\.?|feet|foot|[\'’]|in(?:ch(?:es)?)?\\.?|["”])'; // the unit after a length
/* a board: thickness x width x length ("2x4x8", "2 in. x 4 in. x 8 ft."), or thickness x width and then a length
   with its unit ("2x4-8 ft", "2x4 8'") */
const PASTE_BOARD=new RegExp(PASTE_NUMBER+PASTE_INCH+'\\s*[x×]\\s*'+PASTE_NUMBER+PASTE_INCH+
  '(?:\\s*[x×]\\s*'+PASTE_NUMBER+'(?:'+PASTE_LENGTH+')?|[\\s-]+'+PASTE_NUMBER+PASTE_LENGTH+')','i');
/* a line without a size that carries an amount of its own: never the price of the item on the line before it */
const PASTE_NOT_A_PRICE_LINE=/total|tax\b|deliver|shipping|\bfee\b|\bsav(?:e|ed|es|ing|ings)\b|discount|coupon|balance|\bchange\b|\bcash\b|\bcard\b|visa|mastercard|\bwas\b|\breg(?:ular)?\b|\boff\b/i;
/* things that carry a board size in their name without being a board or a sheet: never read as lumber */
const PASTE_NOT_LUMBER=/clamp|hanger|bracket|screw|\bnails?\b|blade|\bbits?\b|banding|\bclips?\b|\bled\b|\blights?\b|\bkit\b|\bpack\b|connector|anchor|\bties?\b|\bjig\b|sawhorse|\bcaps?\b|\bbase\b|\bblocks?\b|paver|\btiles?\b|lattice|picket|mou?lding|\bshims?\b|dowel|\bstakes?\b|\blath\b/i;
/* A wood named on a pasted line. The first row that matches is the wood of the line ("pressure-treated pine"
   is pressure-treated). id is the wood of WOODS (js/style.js) it stands for, '' for one this program does
   not have. A price for another wood than the design's is shown, and left unticked. */
const PASTE_WOODS=[
  {id:'pt',word:'pressure-treated lumber',match:/pressure[- ]?treated|\btreated\b|ground[- ]contact/i},
  {id:'cedar',word:'cedar',match:/\bcedar\b/i},
  {id:'oak',word:'oak',match:/\boak\b/i},
  {id:'poplar',word:'poplar',match:/\bpoplar\b/i},
  {id:'select',word:'select pine',match:/\bselect\b/i},
  {id:'',word:'another material',match:/redwood|\bmaple\b|walnut|\bcherry\b|\bbirch\b|mahogany|hickory|composite|\bpvc\b|\bmdf\b|\bosb\b|hardboard|particle ?board|melamine/i},
  {id:'pine',word:'construction lumber',match:/\bpine\b|whitewood|\bspf\b|spruce|\bfir\b|\bstuds?\b/i},
];
const PASTE_LOW=.4;        // a pasted price below this many times the estimate for its size, or above
const PASTE_HIGH=2.5;      // this many times, is more likely a misread line than a bargain: shown, left unticked
const PASTE_LOOK_AHEAD=3;  // a price may follow its size by this many lines ("Model# ...", "Qty 6", "$3.98 each")

/* '1-1/2' -> 1.5 */
function pastedNumber(text){
  let total=0;
  for(const part of String(text).trim().split(/[ -]+/)){
    if(part.includes('/')){const[top,bottom]=part.split('/').map(Number);total+=bottom?top/bottom:NaN;}
    else total+=Number(part);
  }
  return total;
}
/* How many of the item a line says were bought ("Qty 6", "6 @ 3.98", "(2) 2x8x8", "3.48 x 4 = 13.92"), or 0
   when it does not say. */
function pastedQuantity(text){
  const found=/\b(?:qty|quantity)\.?\s*:?\s*(\d{1,4})\b/i.exec(text)||/(?:^|\s)(\d{1,4})\s*@/.exec(text)||
    /^\s*\((\d{1,4})\)/.exec(text)||/[x×]\s*(\d{1,4})\s*=/i.exec(text)||/(?:^|\s)(\d{1,4})\s*(?:pcs?|pieces)\b/i.exec(text);
  return found?+found[1]:0;
}
/* Every money amount on a line: [{value, at (where it starts), each}]. With a dollar sign any number counts;
   without one only a number with cents (3.98, 1,234.56), and not one that belongs to a size (0.75 in., 3.50 x)
   or to a longer number. Left out on purpose: what the item used to cost and what was saved ("was $4.50",
   "save $2.00", "$2.00 off", "-2.00") and prices by the foot ("$0.77/ft"). each is true when the line itself
   says the amount is the price of one ("3.98 each", "6 @ 3.98"). */
function pastedAmounts(line){
  const amounts=[],money=/(\$\s*)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/g;
  let found;
  while((found=money.exec(line))){
    const marked=!!found[1],decimals=found[3]||''; // decimals includes the point: '.98'
    const before=line.slice(0,found.index),after=line.slice(found.index+found[0].length);
    if(marked?decimals.length>3:decimals.length!==3)continue;                 // $4, $3.9 and $3.98 are money; a bare 8 or 3.985 is not
    if(/^[.,]?\d/.test(after))continue;                                       // "$2,1": cut off, or not a price at all
    if(marked?/-$/.test(before):/[\w.,\/#$-]$/.test(before))continue;         // "-$2.00" is money off; "x3.50" and "#12.50" are not prices
    if(!marked){
      if(/^\s*(?:in\b|inch|ft\b|feet|foot|lbs?\b|oz\b|mm\b|cm\b|gal|qt\b|%|["'”’]|\/\s*\d)/i.test(after))continue; // a size
      if(/^\s*[x×]/i.test(after)&&!/^\s*[x×]\s*\d{1,4}\s*=/i.test(after))continue;                                  // "3.50 x 96", but not "3.48 x 4 = 13.92"
    }
    if(/^\s*(?:\/|per\b|a\b)\s*(?:ft|foot|lf\b|lin|bf\b|board|sq)/i.test(after))continue;                           // a price by the foot
    if(/(?:\bwas|\bsave[sd]?|\bsavings?|\breg\.?|\bregular|\blist|\borig\.?|\boriginal)\s*:?$/i.test(before.replace(/\s+$/,'')))continue;
    if(/^\s*(?:off\b|savings?\b|discount)/i.test(after))continue;
    const value=Number((found[2]+decimals).replace(/,/g,''));
    if(!(value>=0&&value<=100000))continue;
    amounts.push({value,at:found.index,each:/^\s*\/?\s*(?:ea\b|each\b)/i.test(after)||/@\s*$/.test(before)});
  }
  return amounts;
}
/* The price of ONE of the item, picked from the amounts on its line. Returns {price, doubt}, or null when
   there is no amount. doubt says why the amount may not be the price of one; such a line is shown unticked.
     quantity  how many were bought according to the line (0 when it does not say)
     after     where the size ends on the line: without other clues, the first amount after the size is the price */
function pastedPrice(amounts,quantity,after){
  if(!amounts.length)return null;
  const each=amounts.find(amount=>amount.each);
  if(each)return{price:each.value,doubt:''};
  if(quantity>1){
    // "6 ... 3.98 ... 23.88": the amount that gives another amount when multiplied by the quantity is the price of one
    const one=amounts.find(a=>amounts.some(b=>b!==a&&Math.abs(a.value*quantity-b.value)<.011));
    if(one)return{price:one.value,doubt:''};
    return{price:amounts[0].value,doubt:`the line says ${quantity} were bought, so this may be the price of ${quantity===2?'both':'all '+quantity}`};
  }
  return{price:(amounts.find(amount=>amount.at>=after)||amounts[0]).value,doubt:''};
}
/* the material a pasted board size stands for: by its name (2 x 4), or by its real size (1-1/2 x 3-1/2) */
function pastedBoard(a,b){
  const whole=n=>Number.isInteger(n);
  for(const[t,w]of[[a,b],[b,a]]){
    if(whole(t)&&whole(w)&&M[`${t}x${w}`]&&M[`${t}x${w}`].kind==='board')return M[`${t}x${w}`];
  }
  const near=(x,y)=>Math.abs(x-y)<.02;
  return MATS.find(m=>m.kind==='board'&&((near(m.t,a)&&near(m.w,b))||(near(m.t,b)&&near(m.w,a))))||null;
}
/* The thickness on a plywood line: a fraction ("3/4", "23/32") or a decimal below one ("0.75"). A mixed
   number such as 7-1/4 is something else (a saw blade), and the cents of a price are not a thickness.
   Returns {t, from, at} (from and at: where it starts and ends on the line, unit included), or null. */
function pastedThickness(line){
  const withUnit=(t,from,at)=>{
    const unit=/^\s*-?\s*(?:in(?:ch)?\b\.?|["”])/i.exec(line.slice(at));
    return{t,from,at:at+(unit?unit[0].length:0)};
  };
  const fraction=/(\d+-)?(\d{1,2})\/(\d{1,2})(?![\d\/])/g,decimal=/0?\.\d+/g;
  let found;
  while((found=fraction.exec(line))){
    if(found[1]||/[\d\/.]/.test(line[found.index-1]||' '))continue;
    return withUnit(+found[2]/+found[3],found.index,found.index+found[0].length);
  }
  while((found=decimal.exec(line))){
    const at=found.index+found[0].length;
    if(/[\d$.,]/.test(line[found.index-1]||' ')||/\d/.test(line[at]||' '))continue;
    return withUnit(Number(found[0]),found.index,at);
  }
  return null;
}
/* One line of pasted text. Returns {item:{id, name, length, what}, from, at} when the line names a board or a
   sheet of plywood this program has (from and at: where the size starts and ends on the line), {reason} when
   it names a size that cannot be used or a thing that is not lumber, or null when it names nothing. */
function pastedItem(line){
  const notLumber=PASTE_NOT_LUMBER.test(line)?{reason:'not a board or a sheet'}:null;
  if(/plywood|\bply\b/i.test(line)){
    const thick=pastedThickness(line);
    if(!thick)return{reason:'no thickness'};
    const m=MATS.find(mat=>mat.kind==='sheet'&&Math.abs(mat.t-thick.t)<.04);
    if(!m)return{reason:'a plywood thickness this program does not have'};
    const rest=line.slice(0,thick.from)+' '+line.slice(thick.at);
    const size=/(\d+)\s*(ft\.?|['’]|in\.?|["”])?\s*[x×]\s*(\d+)\s*(ft\.?|['’]|in\.?|["”])?(?!\s*\/)/i.exec(rest);
    if(size){
      const inches=(n,unit)=>+n*(/in|["”]/i.test(unit||'')||+n>12?1:12),wide=inches(size[1],size[2]),long=inches(size[3],size[4]);
      if(Math.min(wide,long)!==48||Math.max(wide,long)!==96)return{reason:'not a full 4 ft × 8 ft sheet'};
    }
    return notLumber||{item:{id:m.id,name:m.short,length:0,what:'a 4 ft × 8 ft sheet'},from:thick.from,at:thick.at};
  }
  const size=PASTE_BOARD.exec(line);
  if(!size)return null;
  const m=pastedBoard(pastedNumber(size[1]),pastedNumber(size[2]));
  if(!m)return{reason:'a board size this program does not have'};
  const amount=pastedNumber(size[3]||size[5]),unit=size[4]||size[6]||'';
  const feet=unit?/ft|feet|foot|['’]/i.test(unit):amount<=24; // a bare 8 means feet, a bare 96 means inches
  const length=feet?amount*12:amount;
  if(!(length>=12&&length<=288))return{reason:'a length that cannot be right'};
  return notLumber||{item:{id:m.id,name:m.short,length,what:Number.isInteger(length/12)?`a ${length/12} ft board`:`a ${fmt(length)} board`},
    from:size.index,at:size.index+size[0].length};
}
/* Why a price that was read should not be taken without a look: it is for another wood than the design's, or
   it is far from what this size usually costs (a misread line, or the price of something else). '' when it
   looks right. f = {id, per8, line}. */
function pastedDoubt(f){
  const named=PASTE_WOODS.find(wood=>wood.match.test(f.line));
  if(named&&named.id!==look().wood)return`the line is for ${named.word}, and this design is in ${woodName().toLowerCase()}`;
  const usual=lumberEstimate(M[f.id]);
  if(!(usual>0))return'';
  const about=`the estimate for this size is about ${dollars(usual)}`;
  if(f.per8<usual*PASTE_LOW)return`${dollars(f.per8)} looks too low: ${about}`;
  if(f.per8>usual*PASTE_HIGH)return`${dollars(f.per8)} looks too high: ${about}`;
  return'';
}
/* Reads pasted text. Returns
     found   [{id, name, what, length, price (as read), per8 (the price of an 8 ft board, or of the sheet), line, use, why}]
     missed  the lines that were not used
   A wrong price is worse than no price, so a line is ticked (use: true) only when nothing about it is in
   doubt: the price is the price of one, it is for the wood of the design, and it is near what the size usually
   costs. Everything else is still shown, unticked, with the reason in why. When two lines give a price for the
   same size, the one closest to 8 ft is ticked. Nothing is saved here. */
function readPastedPrices(text){
  const found=[],missed=[];
  /* a size seen on a line without a price: the price may follow within the next few lines, with lines such as
     "Qty 6" in between. waiting = {item, line, between: the lines read since, quantity} */
  let waiting=null;
  const giveUpWaiting=()=>{
    if(waiting)missed.push(waiting.line,...waiting.between);
    waiting=null;
  };
  for(const raw of String(text||'').split(/\r?\n/)){
    const line=raw.trim();
    if(!line)continue;
    const read=pastedItem(line);
    if(read){
      giveUpWaiting();
      if(!read.item){missed.push(line);continue;} // a size this program cannot use, or not lumber
      const amounts=pastedAmounts(line).filter(amount=>amount.at<read.from||amount.at>=read.at); // not the numbers of the size itself
      const quantity=pastedQuantity(line.slice(0,read.from)+' '+line.slice(read.at));
      const price=pastedPrice(amounts,quantity,read.at);
      if(price)found.push({...read.item,price:price.price,doubt:price.doubt,line});
      else waiting={item:read.item,line,between:[],quantity};
      continue;
    }
    if(!waiting){missed.push(line);continue;}
    waiting.quantity=waiting.quantity||pastedQuantity(line);
    // "Delivery fee $79.00" and "Save $2.00" are not the price of the board above them
    const price=PASTE_NOT_A_PRICE_LINE.test(line)?null:pastedPrice(pastedAmounts(line),waiting.quantity,0);
    if(price){
      found.push({...waiting.item,price:price.price,doubt:price.doubt,line:waiting.line+'  /  '+line});
      waiting=null;
      continue;
    }
    waiting.between.push(line);
    if(waiting.between.length>=PASTE_LOOK_AHEAD)giveUpWaiting();
  }
  giveUpWaiting();
  for(const f of found){
    f.per8=cents(f.price*(f.length?96/f.length:1));
    f.doubt=!(f.price>0)?'no price':f.doubt||pastedDoubt(f);
  }
  const offBy=f=>Math.abs((f.length||96)-96);
  found.forEach((f,i)=>{
    // among the lines nothing is wrong with, one per size: the one closest to 8 ft, the later one on a tie
    const better=!f.doubt&&found.some((other,j)=>other.id===f.id&&j!==i&&!other.doubt&&(offBy(other)<offBy(f)||(offBy(other)===offBy(f)&&j>i)));
    f.use=!f.doubt&&!better;
    f.why=f.doubt||(better?'another line prices this size':'');
    delete f.doubt;
  });
  return{found,missed};
}

let pasteRead={found:[],missed:[]}; // what the Paste prices dialog has read from its box so far
let pasteTimer=0;
function showPastedPrices(){
  clearTimeout(pasteTimer);
  pasteTimer=0;
  pasteRead=readPastedPrices($('#pastePricesText').value);
  const{found,missed}=pasteRead;
  let h='';
  if(found.length){
    const rows=found.map((f,i)=>{
      const read=f.length&&f.length!==96?`$${f.price.toFixed(2)} for ${esc(f.what)}`:`$${f.price.toFixed(2)}`;
      return`<tr><td><label class="ck"><input type="checkbox" data-i="${i}"${f.use?' checked':''}>${esc(f.name)}</label></td>`+
        `<td class="num">${read}</td><td class="num">$${f.per8.toFixed(2)} ${f.length?'per 8 ft board':'per sheet'}</td>`+
        // why a line is not ticked comes first, in full; the line itself is cut to fit (its tooltip has all of it)
        `<td class="pfrom">${f.why?`<div class="pwhy">Not ticked: ${esc(f.why)}.</div>`:''}<div class="pline" title="${esc(f.line)}">${esc(f.line)}</div></td></tr>`;
    });
    h+=`<div class="sec">Recognized: ${plural(found.length,'line')}</div>`+docTable([['Use',''],['Price read','num'],['Saved as','num'],['From the line','']],rows);
  }
  if(missed.length){
    const shown=missed.slice(0,8).map(line=>`<li>${esc(line.slice(0,90))}</li>`).join('');
    h+=`<div class="sec">Not recognized: ${plural(missed.length,'line')}</div><ul class="pmissed">${shown}${missed.length>8?`<li>and ${missed.length-8} more</li>`:''}</ul>`;
  }
  if(!found.length&&!missed.length)h='<p class="note">Nothing pasted yet. Boards and plywood are read; type hardware prices in the Price book or the shopping list.</p>';
  $('#pastePricesFound').innerHTML=h;
  syncPasteButton();
}
function syncPasteButton(){
  const count=pasteRead.found.filter(f=>f.use).length;
  $('#bPastePricesGo').disabled=!count;
  $('#bPastePricesGo').textContent=count?`Use ${count===1?'this price':`these ${count} prices`}`:'Use these prices';
  $('#pastePricesNote').textContent=count?`Saved as your prices for ${woodName().toLowerCase()} once you press the button.`:'';
}
function openPastePrices(){
  $('#pastePricesText').value='';
  showPastedPrices();
  $('#pastePricesDlg').showModal();
  $('#pastePricesText').focus();
}
$('#pastePricesText').oninput=()=>{
  clearTimeout(pasteTimer);
  pasteTimer=setTimeout(showPastedPrices,150);
};
$('#pastePricesFound').addEventListener('change',e=>{
  const box=e.target.closest('input[data-i]');
  if(!box)return;
  const picked=pasteRead.found[+box.dataset.i];
  picked.use=box.checked;
  if(box.checked){
    // one price per size: ticking a line unticks any other line for the same size
    pasteRead.found.forEach((other,i)=>{
      if(other===picked||other.id!==picked.id||!other.use)return;
      other.use=false;
      $(`#pastePricesFound input[data-i="${i}"]`).checked=false;
    });
  }
  syncPasteButton();
});
$('#bPastePricesGo').onclick=()=>{
  showPastedPricesIfStale();
  const taken=pasteRead.found.filter(f=>f.use);
  if(!taken.length)return;
  // a price for another length is kept exact (not rounded to the cent), so that length reads back as it was pasted
  for(const f of taken)setYourPrice(priceKey(f.id),f.length?f.price*96/f.length:f.price);
  $('#pastePricesDlg').close();
  priceNotice='';
  refreshPriceViews();
  toast(`Saved ${plural(taken.length,'price')} as yours.`);
};
/* a paste followed at once by the button: read the box first, so that what is saved is what is in it */
function showPastedPricesIfStale(){
  if(pasteTimer){clearTimeout(pasteTimer);pasteTimer=0;showPastedPrices();}
}

/* ---------- 11. Self-checks (run by selfTest(); they never touch the network or the saved price book) ---------- */
/* An answer of the price service, as a stand-in for the real one. newest = [month, value] of the newest month. */
function fakeIndexAnswer(newest,baseValue,seriesID){
  const row=([month,value])=>({year:month.slice(0,4),period:'M'+month.slice(5),value:String(value),footnotes:[{}]});
  return{status:'REQUEST_SUCCEEDED',responseTime:1,message:[],Results:{series:[{seriesID,data:[
    row(newest),{year:'2026',period:'M13',value:'999',footnotes:[{}]},row([PRICE_BASELINE.month,baseValue])]}]}};
}
/* Behaves like a promise that has already settled, so a check can read the outcome at once instead of waiting. */
function settledNow(value,failed){
  return{then(onOk,onFail){
    const handler=failed?onFail:onOk;
    if(!handler)return this;
    try{
      const out=handler(value);
      return out&&typeof out.then==='function'?out:settledNow(out,false);
    }catch(e){return settledNow(e,true);}
  }};
}
/* A stand-in for fetch. answers = {series name: json to answer with | 'throw' | 'reject' | 'error page' | 'not json'}.
   Every call is written down in calls. */
function fakePriceFetch(answers,calls){
  return(url,request)=>{
    calls.push({url,request});
    const answer=answers[url.slice(PRICE_SERVICE_URL.length)];
    if(answer==='throw')throw new Error('blocked');
    if(answer==='reject')return settledNow(new TypeError('Failed to fetch'),true);
    if(answer==='error page')return settledNow({ok:false,status:500,json:()=>settledNow({},false)},false);
    if(answer==='too many')return settledNow({ok:false,status:429,json:()=>settledNow({},false)},false);
    if(answer==='not json')return settledNow({ok:true,json:()=>settledNow(new SyntaxError('not JSON'),true)},false);
    return settledNow({ok:true,json:()=>settledNow(answer,false)},false);
  };
}
SELFTESTS.push(function prices(problems){
  const keptBook=priceBook,keptNotice=priceNotice,keptLook=S.look,keptShop=shopNow,say=text=>problems.push('prices: '+text);
  const near=(a,b)=>Math.abs(a-b)<.006;
  const LIMIT={status:'REQUEST_NOT_PROCESSED',responseTime:0,message:['Request could not be serviced, as the daily threshold for total number of requests allocated to the user with registration key  has been reached.'],Results:{}};
  const laterMonth='2027-03',soft=PRICE_BASELINE.softwood,ply=PRICE_BASELINE.plywood;
  const good={WPU0811:fakeIndexAnswer([laterMonth,soft*1.1],soft,'WPU0811'),WPU083:fakeIndexAnswer([laterMonth,ply*.95],ply,'WPU083')};
  /* runs Update prices on a fresh book with a stand-in fetch; returns {result, calls} */
  const update=(answers,book)=>{
    const calls=[];
    let result=null;
    priceBook=book||emptyPriceBook();
    priceBusy=false;
    updatePrices({fetch:fakePriceFetch(answers,calls)},r=>{result=r;});
    return{result,calls};
  };
  priceBookScratch=true;
  S.look={style:'std',wood:'pine',finish:'clear'};
  try{
    // built-in, before any update
    priceBook=emptyPriceBook();
    const board=priceOf('2x4',96),sheet=priceOf('ply34',0),screws=hardwarePriceInfo('#8 × 1-1/4" wood screws',hardwareFamily('#8 × 1-1/4" wood screws')).price;
    if(!near(board,PRICE8['2x4'])||lumberPriceInfo('2x4').source!=='built-in')say('a 2x4 does not start at its built-in price');
    if(!near(priceOf('2x4',120),PRICE8['2x4']*1.25))say('a 10 ft board is not priced as 1.25 times an 8 ft board');
    if(!(screws>0))say('wood screws have no built-in price');
    for(const m of MATS)if(m.kind!=='prop'&&!(builtInPrice(m)>0))say(`${m.id} has no built-in price`);

    if(HOSTED){
      // the hosted copy must not ask at all
      const{result,calls}=update(good);
      if(calls.length||!result||result.ok)say('the hosted copy tried to update prices online');
    }else{
      // scaling: boards follow one index, plywood the other, hardware neither
      let{result,calls}=update(good);
      if(!result||!result.ok||!result.asked)say('an update with good answers did not go through: '+(result&&result.message));
      if(!near(priceOf('2x4',96),board*1.1))say(`boards did not follow the softwood index (+10%): ${priceOf('2x4',96)} from ${board}`);
      if(!near(priceOf('ply34',0),sheet*.95))say(`plywood did not follow the plywood index (-5%): ${priceOf('ply34',0)} from ${sheet}`);
      if(hardwarePriceInfo('#8 × 1-1/4" wood screws',hardwareFamily('#8 × 1-1/4" wood screws')).price!==screws)say('hardware was moved by the index');
      if(lumberPriceInfo('2x4').source!=='index')say('an updated price is not marked as coming from the index');
      if(!/boards \+10%, plywood -5%/.test(priceLineSentence()))say('the line after an update does not say how far prices moved: '+priceLineSentence());
      if(!/boards \+10%, plywood -5% since /.test(result.message)||!/These are estimates\./.test(result.message))say('the message after an update does not say how far prices moved, since when, and that they are estimates: '+result.message);
      if(priceLineSentence().length>130)say('the line over the 3D view is too long for one line: '+priceLineSentence());
      // privacy: two requests, each naming one series and carrying nothing else
      const urls=calls.map(c=>c.url).join(' ');
      if(urls!==`${PRICE_SERVICE_URL}WPU0811 ${PRICE_SERVICE_URL}WPU083`)say('the update asked for something other than the two index series: '+urls);
      if(calls.some(c=>c.request.body!==undefined||c.request.headers!==undefined||c.request.credentials!=='omit'||c.request.referrerPolicy!=='no-referrer'||c.request.method!=='GET'))say('a request carries more than the series name');
      // once a day: a second click uses the remembered answer
      const again=update(good,priceBook);
      if(again.calls.length||!again.result.ok||again.result.asked)say('a second update on the same day asked the service again');

      // clamping
      ({result}=update({WPU0811:fakeIndexAnswer([laterMonth,soft*3],soft),WPU083:fakeIndexAnswer([laterMonth,ply*.2],ply)}));
      if(!near(priceOf('2x4',96),board*PRICE_FACTOR_MAX)||!near(priceOf('ply34',0),sheet*PRICE_FACTOR_MIN))say('a wild index was not held to the allowed range');
      if(!/held at \+60%/.test(result.message)||!/held at -40%/.test(result.message))say('the message does not say that the index was held: '+result.message);
      // a revised figure for the baseline month is used as the base
      update({WPU0811:fakeIndexAnswer([laterMonth,300],250),WPU083:fakeIndexAnswer([laterMonth,ply],ply)});
      if(!near(priceBook.index.softwood.factor,1.2))say('a revised baseline figure from the service was not used');

      // yours wins, before and after an update, and is never overwritten
      const mine=emptyPriceBook();
      mine.yours['2x4']={p:5.55,d:'2026-11-01'};
      update(good,mine);
      if(priceOf('2x4',96)!==5.55||lumberPriceInfo('2x4').source!=='yours'||priceBook.yours['2x4'].p!==5.55)say('an update changed a price the person typed');
      if(!near(priceOf('2x6',96),PRICE8['2x6']*1.1))say('with one typed price the other boards did not follow the index');

      // failures: calm sentence, nothing changed, nothing thrown
      const failures={'fetch throws':{WPU0811:'throw'},'no connection':{WPU0811:'reject'},'error page':{WPU0811:'error page'},'too many requests':{WPU0811:'too many'},
        'not JSON':{WPU0811:'not json'},'daily limit':{WPU0811:LIMIT},'empty answer':{WPU0811:{}},'figures of another series':{WPU0811:good.WPU083},
        'second index missing':{WPU0811:good.WPU0811,WPU083:'reject'},'no numbers':{WPU0811:{status:'REQUEST_SUCCEEDED',Results:{series:[{data:[{year:'2027',period:'M03',value:'-'}]}]}}}};
      for(const[name,answers]of Object.entries(failures)){
        let outcome;
        try{outcome=update(answers);}catch(e){say(`${name}: the update threw (${e.message})`);continue;}
        const r=outcome.result;
        if(!r)say(`${name}: the update never finished`);
        else if(r.ok||!/Your prices are unchanged\.$/.test(r.message))say(`${name}: no calm message (${r.message})`);
        if(priceBook.index||priceBook.applied||priceOf('2x4',96)!==board||priceOf('ply34',0)!==sheet)say(`${name}: prices changed although the update failed`);
        if(priceBusy)say(`${name}: the update is still marked as running`);
      }
      // the service was reached and said "too many requests": that is said, not "could not reach"
      const tooMany=update({WPU0811:'too many'}).result;
      if(!tooMany||tooMany.why!=='busy'||/Could not reach/.test(tooMany.message))say('an answer of "too many requests" is not reported as the service being busy');
      // after "daily limit" the service is left alone for a while
      const limited=update({WPU0811:LIMIT});
      const retry=update(good,priceBook);
      if(!limited.result||limited.result.why!=='limit'||retry.calls.length)say('after the daily limit was reached the service was asked again right away');
    }

    // an estimate is never taken from figures older than the built-in prices
    const stale=indexFactor([{month:'2026-01',value:1}],PRICE_INDEXES[0]);
    if(!stale||stale.factor!==1)say('figures older than the built-in prices moved the estimates');
    // the words say what the prices do: to a tenth of a percent, and "no change" only when nothing changed
    if(pricePercent(1.043)!=='+4.3%'||pricePercent(.979)!=='-2.1%'||pricePercent(1)!=='no change'||pricePercent(1.0004)==='no change')say('a price move is not written to a tenth of a percent');

    // typed prices: per length, per wood, and back to the estimate
    priceBook=emptyPriceBook();
    const box=document.createElement('input');
    box.value='$5.00';
    takeTypedPrice(box,priceKey('2x4'),1.25); // typed for a 10 ft board
    if(!near(priceOf('2x4',120),5)||!near(priceOf('2x4',96),4))say('a price typed for a 10 ft board is not kept as the price of an 8 ft board');
    S.look.wood='oak';
    if(lumberPriceInfo('2x4').source==='yours')say('a price typed for pine is used for oak');
    S.look.wood='pine';
    for(const nonsense of['abc','0x10','1e3','-4','3.9.8']){
      box.value=nonsense;
      if(takeTypedPrice(box,priceKey('2x4'),1)||!box.classList.contains('bad'))say(`"${nonsense}" in a price box was taken as a price`);
    }
    box.value='';
    takeTypedPrice(box,priceKey('2x4'),1);
    if(lumberPriceInfo('2x4').source!=='built-in')say('emptying a price box did not go back to the estimate');

    // prices saved by an older version carry over as "yours"
    const old=priceBookFrom({'2x4':3.33,'oak:1x6':21,junk:'x'});
    if(!old.yours['2x4']||old.yours['2x4'].p!==3.33||!old.yours['oak:1x6']||old.yours.junk)say('prices saved by an older version do not carry over');
    if(priceBookFrom(null).v!==2||priceBookFrom('nonsense').auto!==false)say('an unreadable price book does not start empty');

    // the shopping list: yours and estimates are counted, hardware comes in packs, nothing reads NaN
    priceBook=emptyPriceBook();
    priceBook.yours['2x4']={p:4.25,d:'2026-11-02'};
    const buy=[{m:M['2x4'],qty:3,stock:96},{m:M.ply34,qty:1,stock:0}],hardware={rows:[['#8 × 1-1/4" wood screws',148],['A part nobody has heard of',2]],glue:true};
    const model=shoppingModel(buy,hardware),html=shoppingSection(buy,hardware);
    if(model.counts.yours!==1||model.counts.estimates!==3||model.counts.none!==1)say('the shopping list miscounts whose prices it shows: '+JSON.stringify(model.counts));
    const screwBox=hardwareFamily('#8 × 1-1/4" wood screws').price;   // 148 screws are two boxes of 100
    if(!near(model.total,3*4.25+PRICE8.ply34+2*screwBox+5))say('the shopping list total is wrong: '+model.total);
    // a longer screw has its own row and costs more; a length with no row of its own still gets a price
    const shortRow=hardwareFamily('#8 × 1" wood screws'),longRow=hardwareFamily('#8 × 3" wood screws'),otherRow=hardwareFamily('#8 × 4" wood screws');
    if(!shortRow||!longRow||shortRow.id===longRow.id||!(longRow.price>shortRow.price)||!otherRow||!(otherRow.price>0))say('screws of different lengths are not priced separately');
    if(hardwareFamily('1-1/2" brad nails (18 gauge)').id===hardwareFamily('2" brad nails (18 gauge)').id)say('a 1-1/2 in brad is priced as a 2 in brad');
    if(model.rows[2].qty!==2)say('148 screws should be 2 boxes of 100');
    // to the cent: a row is how many times the price of one as shown, and the total is the sum of the rows as shown
    priceBook.yours['hwf:wood-screws']={p:2.995,d:''};
    priceBook.yours['2x4']={p:4.99/1.25,d:''}; // typed as $4.99 for a 10 ft board
    const odd=shoppingModel([{m:M['2x4'],qty:7,stock:120},{m:M['2x4'],qty:3,stock:96}],{rows:[['#8 × 3" wood screws',250]],glue:false});
    const shown=amount=>Math.round(amount*100);
    if(odd.rows[0].each!==4.99)say('a price typed for a 10 ft board does not read back as typed: '+odd.rows[0].each);
    if(odd.rows.some(row=>shown(row.total)!==shown(row.each)*row.qty))say('a shopping list row is not its quantity times its price: '+odd.rows.map(row=>`${row.qty} x ${row.each} = ${row.total}`).join(', '));
    if(shown(odd.total)!==odd.rows.reduce((sum,row)=>sum+shown(row.total),0))say('the shopping list total is not the sum of its rows');
    delete priceBook.yours['hwf:wood-screws'];
    priceBook.yours['2x4']={p:4.25,d:'2026-11-02'};
    if(/NaN|undefined/.test(html))say('the shopping list contains "NaN" or "undefined"');
    // a total of a thousand dollars and more has its comma, the way the presets window writes it
    if(dollars(1228.93)!=='$1,228.93'||dollars(3.9)!=='$3.90'||dollars(12345)!=='$12,345.00')say(`the shopping list writes $1228.93 as "${dollars(1228.93)}", not "$1,228.93"`);
    if(HOSTED&&/homedepot|lowes|data-cmd="updatePrices"/.test(html))say('the hosted shopping list has a store link or an Update prices button');
    if(!HOSTED&&!html.includes('https://www.homedepot.com/s/2%20in.%20x%204%20in.%20x%208%20ft.%20lumber'))say('the Home Depot link of a 2x4 is not the search for "2 in. x 4 in. x 8 ft. lumber"');
    if(!HOSTED&&!html.includes('https://www.lowes.com/search?searchTerm=2%20in.%20x%204%20in.%20x%208%20ft.%20lumber'))say('the Lowe\'s link of a 2x4 is missing');

    // the paste reader
    const pasted=readPastedPrices(['2x4x8 Prime Whitewood Stud   $3.98','2 in. x 6 in. x 8 ft. Lumber 6.47','2-in x 8-in x 10-ft Southern Yellow Pine  $12.50',
      '1 in. x 6 in. x 8 ft. Common Board','Qty 6','$10.48 each','23/32 in. x 4 ft. x 8 ft. Sanded Plywood  $54.98','1/2 in. x 2 ft. x 4 ft. Plywood $18.27',
      '2x4x10 stud $5.98','Delivery fee $79.00','3 in. x 14 in. x 8 ft. beam $80.00','hello'].join('\n'));
    const got=pasted.found.map(f=>`${f.id}@${f.length}=${f.per8}${f.use?'':'!'}`).join(' ');
    const want='2x4@96=3.98 2x6@96=6.47 2x8@120=10 1x6@96=10.48 ply34@0=54.98 2x4@120=4.78!';
    if(got!==want)say(`the paste reader read "${got}" instead of "${want}"`);
    if(pasted.missed.length!==4)say('the paste reader should leave 4 lines unread (a half sheet, a fee, a size it does not have, a word): '+pasted.missed.join(' | '));
    if(readPastedPrices('hello\n\n$$$ x x x').found.length||readPastedPrices('').missed.length)say('the paste reader found prices in nonsense');
    // A wrong price is worse than no price. Each of these lines once gave a wrong price that was ticked.
    const ticked=text=>readPastedPrices(text).found.filter(f=>f.use).map(f=>`${f.id}=${f.per8}`).join(' ');
    const traps=[
      ['2x4x8 Stud  Qty 6  $23.88','','the total of 6 boards as the price of one'],
      ['(2) 2x8x8 $18.44','','the total of 2 boards as the price of one'],
      ['6 @ 3.98   2 in. x 4 in. x 8 ft. Prime Stud   23.88','2x4=3.98','the line total instead of "6 @ 3.98"'],
      ['2X4-8FT PRIME KD STUD <A>\n6@3.98        23.88','2x4=3.98','the line total of a receipt instead of "6@3.98"'],
      ['2x3x8 stud 3.48 x 4 = 13.92','2x3=3.48','the product instead of the price of one'],
      ['2x6x8 lumber 1,234.56','','234.56 out of 1,234.56'],
      ['4x4x8 post\nQty 2\nSave $2.00\n$14.28 each','4x4=14.28','the saving instead of the price'],
      ['1x4x8 board $0.77/ft $6.12','1x4=6.12','the price per foot'],
      ['23/32 in. x 4 x 8 Sanded Plywood  $54.98 was $62.00','ply34=54.98','the old price'],
      ['Milwaukee 2x4x8 clamp set (8 pack) $49.00','','a clamp set as a 2x4'],
      ['3/4 in. x 25 ft. plywood edge banding $7.98','','edge banding as a sheet of plywood'],
      ['7-1/4 in. plywood saw blade $12.97','','a saw blade as 1/4 in. plywood'],
      ['Plywood clips 1/2 in. $9.98','','plywood clips as a sheet of plywood'],
      ['2 in. x 4 in. x 8 ft. Pressure-Treated Lumber $5.48','','a pressure-treated price for a pine design'],
      ['1x6x8 cedar board $21.48','','a cedar price for a pine design'],
      ['3/4 in. x 4 ft. x 8 ft. Plywood  $1,054.98','','a price twenty times the estimate'],
      ['2x4x8 stud $0.39','','a price a tenth of the estimate'],
    ];
    for(const[text,want,mistake]of traps){
      const got=ticked(text);
      if(got!==want)say(`the paste reader ticks "${got}" for "${text.replace(/\n/g,' / ')}" (it must not read ${mistake})`);
    }
    // a line in doubt is still shown, unticked, with the reason
    const doubted=readPastedPrices('2x4x8 Stud  Qty 6  $23.88').found[0];
    if(!doubted||doubted.use||!/6 were bought/.test(doubted.why))say('a price that may be for several boards is not shown unticked with the reason');
    S.look.wood='cedar';
    if(ticked('1x6x8 cedar board $21.48')!=='1x6=21.48')say('a cedar price is not taken for a cedar design');
    S.look.wood='pine';

    // the two dialogs draw what they should (the throwaway book is still in use, so nothing is saved)
    openPriceBook();
    const listed=document.querySelectorAll('#priceBookTable tr[data-key]').length;
    // (a hardware row that is a sheet of plywood, mat, is priced in the plywood rows, so it has no row of its own)
    if(listed<MATS.filter(m=>m.kind!=='prop').length+HARDWARE_PRICES.filter(family=>!family.mat).length)say('the Price book does not list every lumber size, sheet and hardware row');
    $('#priceDlg').close();
    const typedBefore=JSON.stringify(priceBook.yours);
    openPastePrices();
    $('#pastePricesText').value='2x6x8 lumber $6.47\nhello';
    showPastedPrices();
    if($('#bPastePricesGo').disabled||!/Recognized: 1 line/.test($('#pastePricesFound').textContent)||!/Not recognized: 1 line/.test($('#pastePricesFound').textContent))say('Paste prices does not show what it recognized and what it did not before anything is saved');
    if(JSON.stringify(priceBook.yours)!==typedBefore)say('Paste prices saved a price before the person agreed');
    $('#pastePricesDlg').close();
  }finally{
    priceBook=keptBook;priceNotice=keptNotice;priceBusy=false;priceBookScratch=false;S.look=keptLook;shopNow=keptShop;
    refreshPriceViews(); // the line over the 3D view says what the real price book says again
  }
});

/* Every hardware item a preset can put on the shopping list has an estimate. A preset's hw(p) is asked with its
   default sizes, with each choice of each option, with each check box flipped, with each number at its limits
   and with the other choices the preset declares (variants); an item no row of HARDWARE_PRICES matches would
   show "no estimate" and be left out of the total, so it is reported here. */
function presetHardwareVariants(preset){
  const defaults=presetDefaults(preset),variants=[defaults];
  const withValue=(key,value)=>variants.push({...defaults,[key]:value});
  for(const q of preset.params){
    if(!q.k)continue;
    if(q.opts)q.opts.forEach(([value])=>withValue(q.k,value));
    else if(q.check)withValue(q.k,!q.v);
    else for(const limit of[q.min,q.max])if(limit!==undefined)withValue(q.k,limit);
  }
  for(const variant of preset.variants||[])variants.push({...defaults,...variant});
  return variants;
}
SELFTESTS.push(function presetHardwarePrices(problems){
  const missing=new Set();
  for(const preset of PRESETS){
    if(!preset.hw)continue;
    for(const vals of presetHardwareVariants(preset)){
      let rows=[];
      try{rows=preset.hw(vals)||[];}
      catch(e){continue;} // numbers the preset refuses; its check(p) is tried by the structural list
      for(const[label]of rows)if(!hardwareFamily(label))missing.add(`${preset.name}: "${label}"`);
    }
  }
  for(const item of missing)problems.push(`prices: no estimate for a hardware item a preset lists (add a row to HARDWARE_PRICES): ${item}`);
  // a screw named the way a preset names it is priced by its length, like one named by a joint
  const asPreset=hardwareFamily('Construction screws, 2 1/2" (posts to rails)'),asJoint=hardwareFamily('#8 × 2-1/2" wood screws');
  if(!asPreset||!asJoint||asPreset.id!==asJoint.id)problems.push('prices: a 2 1/2 in. screw listed by a preset is not priced like the same screw at a joint');
  const outdoor=hardwareFamily('Exterior screws, 1 5/8"'),indoor=hardwareFamily('Screws, 1 5/8" (corner braces down into the top shelf)');
  if(!outdoor||!indoor||outdoor.id===indoor.id||!(outdoor.price>indoor.price))problems.push('prices: exterior screws are not priced apart from plain ones');
  if((hardwareFamily('Corner braces (L-brackets), 4", to hold the unit to the wall')||{}).id!=='corner-braces')problems.push('prices: a 4 in. corner brace is priced as a small L-bracket');
  if((hardwareFamily('1-1/2" L-brackets (corner braces)')||{}).id!=='brackets')problems.push('prices: the small L-bracket at a joint is priced as a 4 in. corner brace');
  // A preset lists only what its joints do not already count: a screw of the same length from both would be on
  // the shopping list twice. (Screws into the wall are extra, and say so in their name.)
  for(const preset of PRESETS){
    if(!preset.hw)continue;
    let parts=[],own=[];
    try{const vals=presetDefaults(preset);parts=preset.build(vals);own=preset.hw(vals)||[];}
    catch(e){continue;}
    const kept=S;
    S={...blank(),parts,look:{style:'std',wood:'pine',finish:'clear'}}; // looked at as a new project, like assessParts in js/app.js
    let atJoints;
    try{atJoints=new Set(hardwareTotals(findJoints()).rows.map(([label])=>(hardwareFamily(label)||{}).id));}
    finally{S=kept;}
    for(const[label]of own){
      const family=hardwareFamily(label);
      if(family&&atJoints.has(family.id)&&!/wall|stud/i.test(label))problems.push(`prices: ${preset.name} lists "${label}" itself, and its joints already count the same screws: they would be bought twice`);
    }
  }
});
