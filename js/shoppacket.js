/* NominalCAD: the shop packet (design/specs/14, stage A, with the owner's addendum of 20 Nov).

   The owner, a steel detailer: "tab 2 should be all the parts how to make them with the parts list, tab 3 is
   assembly of said parts, it can reference tab 2 but the parts should already be made only mention should be holes
   that weren't pre drilled or things that still need to be done". So there are two documents:
     - Cut list & shopping is the shop: the parts list (the cut list, whose letter is THE part mark), the shopping
       list, the cutting diagrams, the hardware, and Part drawings: one drawing for each cut-list row, in cut-list
       order, from which that part is cut, drilled, shaped and marked. It takes the look of a drawing set (a title
       block on every drawing, thin black line work on white), separate from the furniture pages.
     - Build instructions only puts the made parts together. Its first line says so, with a link; its steps are
       numbered from 1; the only making left on it is in AT_ASSEMBLY_WORK (holes that are not drilled ahead, and work
       that depends on the pieces being together).

   What this file holds:
     shopPacketOf(drafts, drill)   called by makeBuildPlan (js/buildsteps.js): takes the cutting step out of the
                                   drafts, moves every part-making sentence of the preset steps (SHOP_MOVES, a preset
                                   step's `shapes`) onto the drawings of their pieces, drops a step left empty, and
                                   returns plan.shop = {cutWords, copiesLine, beforeStart, boxLines, make, alsoCut,
                                   cutTools, makeTools, drill, number(stepNoOf)}
     SHOP_MOVES                    the part-making sentences of the presets' steps, one row each: where each goes
     AT_ASSEMBLY_WORK              the making that stays on the Build instructions page, each with its reason
     makeOrders(text)              the sentences of some words that order a piece to be made (cut, drill, mark ...)
     partDrawingsSection(list, plan)   the Part drawings section of the Cut list page
     partFigure(row, plan, n, N)   one drawing: title block, the shape block, the drilling ways, the plain outline,
                                   the pencil marks, How to make, the tools
     drawingColumnText / drawingColumnHtml(row, plan)   the Drawing column of the cut list
     shopTools(plan), assemblyTools(joints, plan)       the tools of the two pages
     shopFirstHtml(plan)           the first line of the Steps of Build instructions
     linkPartWords(html), showPartDrawing(letter)       "part drawing C" as a link, and where it goes
     shopMarkPlans(plan)           the marking views of the pencil lines on the part drawings (js/markingview.js)
     the self-checks of spec 14, section 12 (at the end)

   A rule for every preset written later: a sentence that makes a loose piece (cuts, drills, shapes, marks or bands
   it) goes on the part drawings: give it a row in SHOP_MOVES (or, for a step that only shapes pieces, the step's
   `shapes` field), and the self-check partMakingOnlyOnTheCutPage finds any that is left in a step. */
'use strict';

const PART_DRAWINGS_MAX=DRILL_DRAWINGS_MAX;   // drawings on the Cut list page at most (one cap with the drilled labels, js/drillplan.js); past that, plain rows are listed (Cut to size only)

/* ---------- the words of the two pages ---------- */
const CUT_LIST_HINT='This is the parts list. Write the letter on each piece as you cut it: it is the piece\'s mark on its drawing, in the cutting diagrams and in every step. Click a letter to see the drawing of that piece.';
const PART_DRAWINGS_HINT='Make every part here before you put anything together. Each drawing is one part, in the order of the cut list: cut it to the size at its top, then make everything the drawing shows. Tick Done as you finish each piece. Then go to Build instructions, which only puts the parts together.';
const SHOP_FIRST_WORDS='Make every part first. Each part has its own drawing on the Cut list & shopping page under Part drawings: cut, drill and shape it from that drawing and pencil its letter on it. This page only puts the parts together.';
const SHOP_ELSEWHERE_WORDS='The cut list, the shopping list, the cutting diagrams and the part drawings are on the Cut list & shopping page, with the tools for making the parts.';

/* ---------- what counts as part making (spec 14, section 2) ----------
   An order to do something to one loose piece: cut, rip, saw, drill, bore, plane, notch, bevel, band, iron on
   banding, mark or pencil, taper, chamfer, round over. Found clause by clause, as an imperative at the start of a
   clause ("Cut a notch ...", "..., then drill for the pulls"); a word used as a noun ("a drill with the long bit")
   or in a sentence that only describes ("the pieces are cut with the grain") is not an order. */
// (the verbs of making, as the first word of a clause; a code reviewer's list of what a later sentence may use is in:
//  trim, shape, countersink, counterbore, chisel, rout, ease, scribe, trace, draw a line, round an edge or a corner)
// (trim, shape, ease and the like are nouns too, "siding or paint, and trim": they are orders only with what they
//  work on after them)
const MAKE_VERB_WORDS='cut|rip|saw|drill|bore|plane|notch|bevel|band|iron|mark|pencil|taper|chamfer|countersink|counterbore|chisel|rout|scribe|trace|draw a line|'+
  '(?:trim|shape|ease|round)(?= (?:the|its|each|every|all|it|them|a|an|off|over|flush|square)\\b)';
const MAKE_VERBS=new RegExp(`^(?:${MAKE_VERB_WORDS})\\b`,'i');
// (a sentence that says what is done to a piece without ordering it: "the top of each stud is cut at 18.4 degrees";
//  not one that only says how a piece of the cut list lies, "cut with the grain of the face", or points to its drawing)
const MAKE_SAID=/\b(?:is|are|gets|get) (?:cut|drilled|notched|beveled|ripped|planed|tapered|trimmed) (?:at|to|off|from|square|flush|short)\b/i;
/* The orders of making in some words: [{sentence, clause}] (clause: the clause that orders it). */
function makeOrderClauses(text){
  const found=[];
  for(const sentence of String(text||'').split(/(?<=[.!?])\s+/)){
    // (clauses: after a colon or a semicolon, a comma, a bracket, "then", or "and" before an order: "lay them side
    //  by side and mark ...")
    const clauses=sentence.split(new RegExp(`[:;]\\s+|,\\s+|\\(|\\)|\\s+then\\s+|\\s+and\\s+(?=(?:${MAKE_VERB_WORDS})\\b)`,'i'));
    for(let clause of clauses){
      // (words before the verb that do not change the order: "then", "carefully", "you", "with a jigsaw")
      clause=clause.trim().replace(/^(?:(?:then|first|now|also|and|or|next|finally|so|carefully|gently|neatly|lightly|you)\s+)+/i,'')
        .replace(new RegExp(`^with (?:a|an|the) [^,]*?\\s(?=(?:${MAKE_VERB_WORDS})\\b)`,'i'),'');
      if(MAKE_VERBS.test(clause)||(MAKE_SAID.test(clause)&&!/\bpart drawing\b/i.test(sentence)))found.push({sentence:sentence.trim(),clause});
    }
  }
  return found;
}
const makeOrders=text=>[...new Set(makeOrderClauses(text).map(order=>order.sentence))];
/* The making that may stay in an assembly step (spec 14, 6.4, and the owner's "holes that weren't pre drilled or
   things that still need to be done"): each row says why it is done at assembly. A row matches the CLAUSE that
   orders the work (so "Cut a notch and drill pilot holes in it" is not let through by its pilot holes), or the
   whole sentence where it names the exact case (whole: true); when(clause, step) narrows it further to the step's
   own facts (a pilot hole only for a brad, a hole through two pieces at once, hardware hung at assembly, or a screw
   the program does not drill ahead). */
const AT_ASSEMBLY_WORK=[
  // (the holes of cup hinges and pulls are made from the part drawings now: shopTakesHardwareHoles. A knob's single
  //  hole is still drilled when it is fitted: no preset places knobs today)
  {match:/\bholes? for the knobs?\b/i,
    why:'a knob\'s hole is drilled where it is fitted, with the knob in hand'},
  {match:/\b7\/16" holes?\b[^.]*\b(?:post|bolt)|\bdrill first: on each end post\b/i,whole:true,
    why:'a bolt hole goes through the end post and the piece behind it together, once the section is built, so the two holes line up'},
  {match:/\baccess hole\b/i,whole:true,
    why:'it is in line with a wall screw, whose place the wall studs decide'},
  {match:/\bpilot holes?\b/i,
    when:(clause,step,sentence)=>/\bbrads?\b|\bnail/i.test(sentence)||/through the ridge into the tip|into the post top through that hole/i.test(sentence)||
      /\bscrew (?:it|them) on\b|power strip|screw eye/i.test(sentence)||!!(step&&step.groups&&step.groups.some(group=>/screw|plug/.test(group.type)&&!group.predrilled)),
    why:'a pilot hole for a brad, for a screw that goes through two pieces held together, for hardware hung at assembly, or for a screw the program does not drill ahead'},
  {match:/\bplugs?\b[^.]*\bflush\b|\bflush\b[^.]*\bplugs?\b|\bcut the plugs\b|\bIt (?:sticks out 1\/4" and )?is cut flush when you finish\b/i,whole:true,
    why:'a plug is glued in over its screw and cut flush when the glue is dry'},
  {match:/\bmark where it crosses the posts\b|\btrim the ends flush\b/i,whole:true,
    why:'the boards are held in place on the posts and fitted to them'},
  {match:/\bmark the overhang\b/i,whole:true,
    why:'the overhang of the top is set on the frame as it is built'},
  {match:/\(mark that on the apron first\)|\(mark those places on both stretchers first\)/i,whole:true,
    why:'measured on the frame as it stands, from the outside face of the end frame'},
  {match:/\btrim its top corners to the roof slope\b/i,whole:true,
    why:'the corners of a rafter tie are cut flush with the rafters once it is nailed to them'},
  {match:/draw a line [^.]* in from the outside face of the lip, and mark two points on it that far apart|\bmark through its two keyhole slots\b/i,whole:true,
    why:'the two screws the power strip hangs on are spaced from the strip itself, measured with it in hand'},
  {match:/\bHold it level where it goes, mark the two holes, drill small pilot holes and screw it on\b/i,whole:true,
    when:(clause,step)=>!!(step&&step.hardware&&step.hardware.length),
    why:'a hook or a bracket bought ready is screwed on where it is wanted once the piece stands, with it in hand'},
  {match:/\bstud finder and mark them\b/i,whole:true,
    why:'the screws into the wall go where the wall studs are, found once the piece stands against the wall'},
  // (the anti-tip kits of a case, caseAntiTipWords in js/caselooks.js: the marks go on the WALL, not on a part)
  {match:/\bmark the wall where the case will stand: find the wall studs with a stud finder and mark the stud nearest each place a kit goes\b/i,whole:true,
    why:'the wall brackets of an anti-tip kit go into the wall studs, which are found and marked on the wall where the case will stand'},
  // (the spacer block itself is a small part with its drawing: smallPartsOf; only its shortening is fitting)
  {match:/\bCut the block shorter for the next pair\b/i,
    why:'the spacer block is cut shorter for each lower pair of slides, measured with the case standing'},
  {match:/\bCut sheathing to fit the (?:triangle|sloped strip)\b/i,whole:true,
    why:'the sheathing above a wall is cut to the shape the rafters make once they stand'},
  {match:/\ba birdsmouth\) with a level seat\b|\bMark the notches from the building itself\b/i,whole:true,
    why:'on a lean-to roof the first rafter is held on the walls as they stand and its notches marked from them'},
  {match:/\buntil it sits still\b/i,whole:true,
    why:'the feet are trimmed with the chair standing on the floor'},
  // (the Dining chair's padded seat, chairUpholsteryStep in js/diningchair.js: the foam, batting and fabric are bought,
  //  not parts, and are fitted to the finished seat base)
  {match:/\b(?:foam|batting|fabric)\b/i,whole:true,
    when:(clause,step)=>!!(step&&/[Cc]over the seat, once the finish on the chair is dry/.test(step.words||'')),
    why:'the seat is covered once the finish on the chair is dry: the foam is traced from the seat base itself, and the batting and the fabric are trimmed as they are stapled on'},
];
/* the row of AT_ASSEMBLY_WORK that allows an order (its clause, the step it is in, its sentence), or null */
function atAssemblyRowOf(clause,step,sentence){
  sentence=sentence||clause;
  return AT_ASSEMBLY_WORK.find(row=>row.match.test(row.whole?sentence:clause)&&(!row.when||row.when(clause,step,sentence)))||null;
}
/* a sentence whose every order of making is allowed (for the words a self-check reads one sentence at a time) */
const atAssemblyWhy=(sentence,step)=>{
  const orders=makeOrderClauses(sentence);
  if(!orders.length)return AT_ASSEMBLY_WORK.find(row=>row.match.test(sentence))||null;
  const rows=orders.map(order=>atAssemblyRowOf(order.clause,step,order.sentence));
  return rows.every(Boolean)?rows[0]:null;
};
/* the part-making orders of some words that no row of AT_ASSEMBLY_WORK allows (step: the step they are in) */
const makeOrdersLeft=(text,step)=>[...new Set(makeOrderClauses(text).filter(order=>!atAssemblyRowOf(order.clause,step,order.sentence)).map(order=>order.sentence))];

/* ---------- the part-making sentences of the presets' steps, and where each goes ----------
   test   the words in a step (one sentence or a run of them)
   on     the names of the pieces on whose drawings it goes (every cut-list row holding a piece of that name)
   kind   'make' (How to make), 'mark' (pencil lines; a marking view is drawn when the words give heights the model
          has: markingLines, js/steppictures.js), 'also' (a small thing to cut with the parts: Also cut), 'band'
   words  (match) => the words on the drawing (else the words found)
   keep   what the step says in their place, or a function of the match (else nothing)
   holes  'drain': the four drain holes of the Bird feeder's tray, drawn on its outline
   tools  what the work takes, for Tools for making the parts
   The sentences are those of today's presets (and of designs saved with them); a saved design with older words is
   written again from its preset when it is opened (FASTENING_NOW 9, js/fasteningupgrade.js). */
const SHOP_MOVES=[
  // Bookshelf, Cabinet / case (js/presets.js, js/casesteps.js)
  {test:/Lay the two sides( and the (?:\d+ )?dividers?)? next to each other with their bottom ends lined up, and mark the shelf positions across all of them at once so they match\. Underside of each piece, measured from the bottom end of the side: [^.]*\./,
    on:['Side','Divider'],kind:'mark',view:true,
    keep:m=>m[1]?`Lay out the two sides${m[1]}, their pencilled shelf lines facing the shelves.`:'Lay the two sides out with their pencilled shelf lines facing each other.'},
  // Base cabinet with doors (js/builders-storage.js)
  // (a Base cabinet about 32" wide and wider has a partition: it is marked on both faces too)
  {test:/Mark the underside of the bottom \([^)]*\) and of the shelf \([^)]*\) on the inside of both sides(?: and on both faces of the partition)?\./,on:['Side','Partition'],kind:'mark',view:true},
  // Garage shelves (js/builders-storage.js)
  {test:/Lay all \d+ posts side by side with their bottom ends lined up and mark the underside of each shelf frame across them, measured from the bottom end: [^.]*\./,on:['Post'],kind:'mark',view:true},
  // Coffee table, Entryway shoe bench: the slatted shelf (js/presets.js)
  {test:/Clamp the two long stretchers side by side, ends lined up, and from one end mark across both at once where each slat starts: [^.]*\./,on:['Long stretcher'],kind:'mark'},
  // Shed: the wall plates, the rafters, the gable studs (js/builders-shed.js)
  {test:/Lay the top plate and the bottom plate side by side and mark the stud positions on both at once: [^.]*\./,on:['Top plate','Bottom plate'],kind:'mark'},
  {test:/Cut the \S+ rafters\.[\s\S]*?use it as the pattern for the others\./,on:['Rafter'],kind:'make',ends:true,tools:['speed square, for marking the angled cuts']},
  {test:/, with their tops cut at ([\d.]+) degrees to fit under the rafter \(their lengths are measured to the longer side of that cut\)/,on:['Gable stud'],kind:'make',ends:true,
    keep:', their slanted tops under the rafter',words:m=>`Cut the top end at ${m[1]} degrees off square, so it fits under the rafter. The length in the cut list is measured to the longer side of that cut.`},
  // Single aquarium stand: the back panel (js/builders-fish.js)
  {test:/Cut a notch or drill holes in the back panel for hoses and cords before you fasten it\./,on:['Back panel'],kind:'make',
    words:()=>'Cut a notch or drill holes in it for the hoses and cords, where your tank\'s equipment needs them, before it is fastened on.'},
  // Bird feeder (js/builders-outdoor.js)
  {test:/Then drill four 1\/4" drain holes through the tray\./,on:['Tray'],kind:'make',holes:'drain',tools:['1/4" drill bit'],
    words:()=>'Drill the four 1/4" drain holes right through the tray where this drawing shows them, inside the rim strips, with a scrap under it so the wood does not splinter.'},
  // (the preset no longer has this step since the audit fixes made the posts shaped pieces: pointOldFeederPosts in
  //  js/builders-outdoor.js takes it out of a published design when it is opened; kept for a design saved with the
  //  step whose posts were already pointed, which that upgrade leaves as it is)
  {test:/Cut the top of each roof post to a point\.[\s\S]*?lie flat on these two cuts\./,on:['Roof post'],kind:'make',ends:true,old:true},
  {test:/Saw or plane a \d+ degree bevel along one long edge of each roof board, so the two boards meet tightly at the ridge\./,on:['Roof board'],kind:'make',
    tools:['block plane, or a circular saw with its blade tilted']},
  // (the rim strips: their screws are drilled ahead, or are pocket screws in Fine furniture, as the lines say; the
  //  roof screws' clearance holes go on the roof board's drawing, the pilot into the post top is drilled through it)
  {test:/and drive two screws up through the tray into each strip\. Drill pilot holes first: the strips are thin and split easily\./,kind:'reword',
    keep:'and fasten them as the lines below say: their holes are made already.'},
  {test:/Drill pilot holes first so the post tops do not split, and drive one screw through each board into each post: the glue does most of the holding\./,kind:'reword',
    keep:'Drive one screw through each board into each post, through the clearance hole made on the roof board\'s part drawing: drill a thin pilot hole into the post top through that hole first, so the post top does not split. The glue does most of the holding.'},
  {test:/Mark it on the Roof board, ([^,]+?) in from its end \(over the middle of the post\) and ([^,]+?) down from its beveled edge/,on:['Roof board'],kind:'make',
    words:m=>`Drill a ${DRILL_BITS.clearance.name} clearance hole for the roof screw near each end, square through the board: ${m[1]} in from the end (over the middle of the post) and ${m[2]} down from the beveled edge.`,
    keep:m=>`Its clearance hole is made already, from the part drawing of the Roof board (${m[1]} in from its end, ${m[2]} down from its beveled edge)`},
  // Planter box (js/builders-outdoor.js): the step's words fasten the slats as the lines say, their holes drilled
  // ahead (withoutDrillWords); since the pocket-edge round they are screwed down from above in every style, the slat
  // cleats being too small for a pocket hole's oval
  {test:/Drill pilot holes and drive two screws down through each end of every slat into the cleat under it/,kind:'reword',
    keep:'Fasten each end of every slat to the cleat under it as the lines below say: the holes are made already'},
  // Fish stands (js/builders-fish.js): a panel stud's length is the cut list's
  // (seldom: only where no upright stands at a seam of the back panel, which no size the checks try gives today)
  {test:/, cut 1\/8" short of the frame above, and screw it to the deck/,kind:'reword',keep:' (1/8" short of the frame above: its length is in the cut list), and screw it to the deck',seldom:true},
  // Shed with a lean-to roof (js/builders-shed.js): the side walls' stud tops, cut with the parts
  {test:/The two side walls follow the roof: the top of each of their studs is cut at ([\d.]+) degrees, and the lengths in the cut list are measured to the longer side of that cut\./,kind:'box',
    words:m=>`The studs of the two side walls of the lean-to follow the roof: cut the top of each at ${m[1]} degrees off square. Their lengths in the cut list are measured to the longer side of that cut.`,
    keep:'The two side walls follow the roof: their studs were made with sloped tops (Before you make the parts, on the Cut list page).'},
  // Desk, Workbench, shoe bench, Computer desk: the cross rail's place is pencilled on the apron from its drawing
  {test:/ ?Mark those places on both aprons first\./,kind:'reword',keep:''},
  // Five-board bench (js/builders-furniture.js)
  {test:/Cut a shallow V or an arch out of the bottom of each leg so it stands on two feet and does not rock\./,on:['Leg'],kind:'make',ends:true,tools:['jigsaw']},
  // Dining chair (js/diningchair.js): in its cutting step, and the rail places on the back legs
  // (in a Dining table and chairs set the chair's cutting words follow the table's, "For each chair: the four
  //  corner blocks are ...", so the first word may be in lower case: js/chairsets.js)
  // (a chair saved before branch seats only: today's chair has no corner blocks, so no check run of today's presets
  //  meets this sentence; old, as diningChairOpensAsSaved opens such a chair and the row moves its words)
  {test:/[Tt]he four corner blocks are [^:]*: cut their ends square, since each one is glued under a rail and screwed to a leg by one end\./,on:['Corner block'],kind:'make',old:true,
    words:m=>capital(m[0])},
  {test:/Then the front edge of the seat: [\s\S]*?it goes at the front\./,on:['Front seat board'],kind:'make',words:m=>capital(m[0].replace(/^Then /,''))},
  {test:/Each back leg gets one straight cut along its front edge[\s\S]*?as long as the cut is on the edge that will face the front\./,on:['Back leg'],kind:'make',shapeSays:true},
  {test:/On the inside face of each back leg mark where the two back rails go: [^.]*\./,on:['Back leg'],kind:'mark'},
  // Dining chair, its plywood seat and padded seat (branch seats): the sheet cut, notched and rounded (the padded
  // seat's base 3/16" short of the legs for the fabric, with its vent holes), in its cutting step ("cut" in lower case
  // in a Dining table and chairs set: "For each chair: cut the plywood seat ...")
  {test:/[Cc]ut the (plywood seat|seat base) from the 3\/4" plywood with its good face down \(the saw splinters the face that is up\), then mark and cut its two notches and round its two front corners as Shapes to cut shows\.((?: Its notches are cut [^.]*\.)?(?: Drill its [^(]*\(without them the seat puffs like a cushion of air\)\.)?)((?: Leave the foam, the batting and the fabric for the end, after the finish\.)?)/,
    on:['Plywood seat','Seat base'],kind:'make',
    words:m=>`Cut the ${m[1]} from the 3/4" plywood with its good face down (the saw splinters the face that is up), then mark and cut its two notches and round its two front corners as the shape on this drawing shows.${m[2].replace('where its drawing shows them','where this drawing shows them')}${m[3]}`},
  // the bare plywood seat's edges, while it is loose: banded in Everyday and Fine (its own step, dropped once this
  // moves; " Do this for each of the 6 dining chairs." when a set has several)
  {test:/Band the edges of the plywood seat that show, while it is loose: ([^.]*?\(the edges of the notches go against the legs\))\. (Set a household iron[\s\S]*?or you will sand through it\.)(?: Do this for each of the \d+ [a-z ]+s\.)?/,
    on:['Plywood seat'],kind:'band',words:m=>`Iron edge banding onto the edges that show: ${m[1]}. ${m[2]}`,
    tools:['household iron, and an edge banding trimmer or a sharp chisel','120 grit sandpaper on a block']},
  // and rounded over in Rustic / rough (no check run builds a Rustic plywood chair, so it is proved on the chair's
  // own words, CHAIR_PLYWOOD_ROUND_WORDS)
  {test:/Round over the edges of the plywood seat that show, while it is loose: ([\s\S]*?which suits the rough style\.)(?: Do this for each of the \d+ [a-z ]+s\.)?/,
    on:['Plywood seat'],kind:'make',words:m=>`Round over the edges that show: ${m[1]}`,seldom:true,get sample(){return CHAIR_PLYWOOD_ROUND_WORDS;},
    tools:['80 and 120 grit sandpaper on a block']},
  // the padded seat's base: which way it goes back on after it is covered, pencilled on while it is loose
  {test:/ ?Pencil FRONT on its underside\./,on:['Seat base'],kind:'make',
    words:()=>'Pencil FRONT on its underside, at the front edge (the edge with the two rounded corners), so it goes back on the chair the same way once it is covered.',
    keep:' Its underside says FRONT, pencilled on from its part drawing.'},
  // Nightstand with drawers (js/nightstand.js), Computer desk (js/computerdesk.js): the two blocks that hold the shelf
  // at its height while it is fastened: a small part of their own (SMALL_PARTS, below)
  {test:/Cut two scrap blocks (\d+(?: \d+\/\d+)?"|\d+\/\d+") long, stand them on the bottom panel/,kind:'also',
    keep:m=>`Stand the two shelf blocks (${smallPartMark('Shelf block')}, ${m[1]} long) on the bottom panel`,
    words:m=>`2 shelf blocks, ${m[1]} long`,piece:m=>({name:'Shelf block',qty:2,l:parseLen(m[1].replace(/"$/,'')),use:'They stand on the bottom panel and hold the shelf at its height while it is fastened, then come out: they are not part of the piece.'})},
  // Garage shelves (js/builders-storage.js): the frames are held at their marks by a helper (no blocks to cut)
  {test:/Get a helper, or cut scrap blocks to hold the spacing\./,kind:'reword',keep:'Get a helper to hold each frame at its marks while the posts go on.'},
  // Shed: the plywood door (js/builders-shed.js)
  {test:/Cut the door from 3\/4" plywood\./,on:['Door'],kind:'make',
    words:()=>'Cut the door from 3/4" plywood to the size in the cut list: it leaves a gap of 1/4" all round the opening.'},
  // Computer desk: where the monitor shelf supports stand on the top, pencilled on while it is loose
  {test:/Mark where each monitor shelf support stands on the top: ([^.]*?running front to back)\./,on:['Top'],kind:'mark',
    words:m=>`Pencil on where each monitor shelf support stands: ${m[1]}.`,
    keep:'Each monitor shelf support stands on the lines pencilled on the top from its part drawing.'},
  // The fish stands with a countertop (js/fishtop.js, COUNTERTOP_BANDING_WORDS and DOOR_BANDING_WORDS): the banding of
  // the countertop and of the doors, ironed on while they are loose
  {test:/First iron edge banding onto its front edge and its two ends \(the back goes against the wall\), so the layers of the plywood do not show: (set a household iron[\s\S]*?so no sharp edge or banding corner catches\.)/,
    on:['Countertop'],kind:'band',words:m=>`Iron edge banding onto its front edge and its two ends (the back goes against the wall), so the layers of the plywood do not show: ${m[1]}`,
    tools:['household iron, and an edge banding trimmer or a sharp chisel']},
  {test:/Iron edge banding onto all four edges of each door now, as on the countertop, so the doors are sanded and finished with the rest and no plywood layers show on the front: (set a household iron[\s\S]*?so no sharp edge or banding corner catches\.)/,
    on:['Door'],kind:'band',words:m=>`Iron edge banding onto all four edges, so no plywood layers show on the front: ${m[1]}`,
    tools:['household iron, and an edge banding trimmer or a sharp chisel']},
  // The holes of the cup hinges and the pulls are drilled from the part drawing of the door, front or lid (row.make
  // of the hardware lines, shopTakesHardwareHoles): the preset's words only fit the hardware
  {test:/The round cup of each hinge sits in a hole 1 3\/8" wide and 1\/2" deep in the back of the door, drilled with a Forstner bit: the sheet in the package gives how far from the edge, usually 7\/8" to the middle of the hole\. ?/,kind:'reword'},
  {test:/Lay a door face down, drill the cup holes along that side, [\s\S]*?, at the distances from the ends of the door that the hardware line under this step gives, and screw a hinge into each\./,kind:'reword',
    keep:'Lay a door face down and screw a hinge into each of its cup holes (they are made already, from the part drawing of the door).'},
  {test:/Lay a door face down, drill the two cup holes along the hinged side, one [^.]*? below the top edge and one [^.]*? above the bottom edge, and screw a hinge into each\./,kind:'reword',
    keep:'Lay a door face down and screw a hinge into each of its two cup holes (they are made already, from the part drawing of the door).'},
  {test:/Then drill for the (pulls?) (?:in the middle of (?:each front|the front) )?and (screw|bolt) (them|it) on( from inside the drawer)?/,kind:'reword',
    keep:m=>`The holes of the ${m[1]} are made already, from the part drawing${m[3]==='them'?'s':''}. Then ${m[2]} the ${m[1]} on${m[4]||''}`},
  // Computer desk (js/computerdesk.js): the edge banding, ironed on while every piece is loose
  {test:/Band the edges that show, while every piece is loose: iron edge banding onto ([\s\S]*?)\. (Set a household iron[\s\S]*)$/,kind:'band',
    tools:['household iron, and an edge banding trimmer or a sharp chisel']},
];
/* ---------- the holes of hinges and pulls: part making too (spec 14, 3.1 and 3.2; the owner: "tab 2 should be all the
   parts how to make them") ----------
   A cup hinge's hole and a pull's two holes are drilled in the loose door, drawer front or lid, with the numbers the
   program already knows (cupHingeLine and pullLine, js/buildsteps.js, give them as row.make). They go on the part
   drawing of that piece with the marking view of where they are (hardwareMarkPlan, js/markingview.js); the step
   keeps only the fitting of the hardware. */
const HARDWARE_HOLE_TOOLS={cup:'1 3/8" Forstner bit, for the cup holes of the hinges',pull:'3/16" drill bit, for the holes of the pulls, and a square'};
function shopTakesHardwareHoles(shop,step){
  for(const row of step.hardware){
    if(!row.make)continue;
    shop.make.push({on:[...new Set(row.hosts.map(host=>host.name))],ids:row.hosts.map(host=>host.id),kind:'hardware',hole:row.kind,words:row.make,hardware:row,draft:null,stepNo:step.no});
    if(!shop.makeTools.includes(HARDWARE_HOLE_TOOLS[row.kind]))shop.makeTools.push(HARDWARE_HOLE_TOOLS[row.kind]);
  }
}
/* the words of a step the program writes to mount hardware (its kinds' `mount`, js/hardware.js), less the drilling
   of holes that are made from the part drawings */
const MADE_MOUNT={pull:'Screw each pull on from the back: its two holes are made already, from the part drawing of the piece it goes on.'};
function shopMountWords(kind,step){
  return MADE_MOUNT[kind]&&step.hardware.some(row=>row.kind===kind&&row.make)?MADE_MOUNT[kind]:HARDWARE[kind].mount;
}
/* the words of a preset step that only shapes pieces (its `shapes` field: the toy chest's air holes, the Computer
   desk's cable holes), read on the drawing itself */
function shapeStepWordsOnDrawing(text){
  return String(text)
    .replace(/ ?Shapes to cut is on the cut list page\.\s*/g,' ')
    .replace(/The holes that Shapes to cut shows in the/g,'The holes this drawing shows in the')
    .replace(/where Shapes to cut marks/g,'where this drawing marks')
    .replace(/\s{2,}/g,' ').trim();
}

/* the sentences of a cutting step that are not about the parts: the first line of the Build instructions' steps */
const BEFORE_START_SENTENCES=[/^Read the notes at the top first\b/,/\bpermit\b/i,/\bcall before you dig\b/i];
/* ---------- the packet of a design, worked out with its build plan ---------- */
function newShop(drill,drafts){
  return{cutWords:'',copiesLine:'',beforeStart:'',boxLines:[],make:[],alsoCut:[],cutTools:[],makeTools:[],drill,
    // the step numbers of what the notes name, once the steps are numbered (makeBuildPlan)
    number(stepNoOf){
      for(const entry of this.make.concat(this.alsoCut))entry.step=entry.stepNo||(entry.draft?stepNoOf(drafts.indexOf(entry.draft)):0);
    }};
}
/* Moves the SHOP_MOVES sentences of some words to the shop; returns the words that are left. draft: the step they
   are in (null: the cutting step). */
let shopMovesUsed=null;   // (the rows that moved something in a pass of the checks: shopMovesAllUsed)
function shopMoveWords(words,draft,shop){
  let text=String(words||'');
  for(const row of SHOP_MOVES){
    text=text.replace(row.test,(...match)=>{
      if(shopMovesUsed)shopMovesUsed.add(row);
      for(const tool of row.tools||[])if(!shop.makeTools.includes(tool))shop.makeTools.push(tool);
      if(row.kind==='reword'){
        // (nothing moves: the drawing has it from the model already, the cup holes and pull holes; only the words
        //  of the step change)
      }else if(row.kind==='box'){
        // (making that belongs to several rows alike: one line of Before you make the parts)
        const line=row.words(match);
        if(!shop.boxLines.includes(line))shop.boxLines.push(line);
      }else if(row.kind==='also'){
        // (piece: a small part of its own, with a letter, a count and a drawing: SMALL_PARTS)
        shop.alsoCut.push({words:row.words(match),draft,piece:row.piece?row.piece(match):null});
      }else if(row.kind==='band'&&!row.on){
        // (the Computer desk's sentence names its pieces: each edge goes on the drawing of the piece it names)
        bandingToShop(match[1],match[2],draft,shop);
      }else{
        shop.make.push({on:row.on,kind:row.kind,words:row.words?row.words(match):match[0].trim(),holes:row.holes||'',view:!!row.view,ends:!!row.ends,shapeSays:!!row.shapeSays,draft});
      }
      const keep=typeof row.keep==='function'?row.keep(match):row.keep||'';
      return keep?` ${keep} `:' ';
    });
  }
  return text.replace(/\s{2,}/g,' ').replace(/ ([.,:;])/g,'$1').replace(/^[\s,]+/,'').trim();
}
/* The Computer desk's banding: each edge said goes on the drawing of the piece it names ("the front edge and both
   ends of the top" on the Top), and how to iron it on once, in Before you make the parts. */
function bandingToShop(edges,how,draft,shop){
  const names=[...new Set(S.parts.filter(p=>!isProp(p)).map(p=>p.name))].sort((a,b)=>b.length-a.length);
  for(const item of String(edges).split(/, (?:and )?| and (?=(?:the|all) )/)){
    // (a name typed by hand may hold a bracket or a dot: "Shelf (left)", so it is escaped)
    const said=names.filter(name=>new RegExp(`\\b${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}s?\\b`).test(item.toLowerCase()));
    // (a shorter name inside a longer one that matched is not a second piece: "side" in "drawer side")
    const on=said.filter(name=>!said.some(other=>other!==name&&other.toLowerCase().includes(name.toLowerCase())));
    if(on.length)shop.make.push({on,kind:'band',words:`Iron edge banding onto ${item}, before anything else is done to it.`,draft});
    else shop.boxLines.push(`Iron edge banding onto ${item}.`);
  }
  shop.boxLines.push(`Edge banding: ${how.trim()}`);
}
/* Called by makeBuildPlan with its drafts (js/buildsteps.js): the cutting step leaves the drafts for the shop, the
   part-making sentences move to the drawings, and a step left with nothing to do is dropped. */
function shopPacketOf(drafts,drill){
  const shop=newShop(drill,drafts);
  // 1. the cutting step: its words go to Before you make the parts; a "before you start" sentence (the Shed's
  //    permit line) goes to the first line of the Steps
  const cutting=drafts.filter(draft=>draft.kind==='cut');
  const before=[],cutExtra=[];
  for(const draft of cutting){
    // (a lead-in left with nothing after it once its sentences moved: "For each chair:" of a Dining table and
    //  chairs set, js/chairsets.js, whose chair cutting words are all on the chair's drawings)
    const left=shopMoveWords(draft.words,null,shop).replace(/\bFor each [a-z ]+:\s*(?=[A-Z]|$)/g,'').trim();
    for(const sentence of left.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean)){
      if(/cut every piece on the cut list/i.test(sentence))shop.cutWords=CUT.t;
      else if(/^Measure twice, cut once/i.test(sentence))continue;   // (part of CUT.t)
      else if(/^You are making \d+ /.test(sentence))shop.copiesLine=sentence;
      // (only a known "before you start" sentence goes to the first line of the steps, the Shed's permit line; any
      //  other sentence of a cutting step is about the parts and stays in the packet: the code reviewer's finding 10)
      else if(!makeOrders(sentence).length&&BEFORE_START_SENTENCES.some(known=>known.test(sentence)))before.push(sentence);
      else cutExtra.push(sentence);
    }
    for(const tool of stepTools({kind:'cut',source:draft.source,preset:draft.preset,shapesElsewhere:[],words:'',groups:[],hardware:[],pieces:[]}))
      if(!shop.cutTools.includes(tool))shop.cutTools.push(tool);
  }
  if(!shop.cutWords)shop.cutWords=CUT.t;
  if(!cutting.length)shop.cutTools=stepTools({kind:'cut',source:'preset',preset:CUT,shapesElsewhere:[],words:'',groups:[],hardware:[],pieces:[]});
  shop.boxLines.unshift(...cutExtra);
  shop.beforeStart=before.join(' ');
  for(let i=drafts.length-1;i>=0;i--)if(drafts[i].kind==='cut')drafts.splice(i,1);
  // 2. the part-making sentences of the other steps
  const dropped=new Set();
  for(const draft of drafts){
    if(!draft.preset||draft.source==='generated'||draft.kind==='finish')continue;
    // a preset step that only shapes some pieces while they are loose (its `shapes`): all of it is on their drawings
    const shapes=Array.isArray(draft.preset.shapes)?draft.preset.shapes:null;
    if(shapes&&!draft.pieces.length&&!(draft.preset.add||[]).length){
      shop.make.push({on:shapes,kind:'make',words:shapeStepWordsOnDrawing(draft.words),holes:'',draft:null,shapeSays:true});
      for(const tool of shapeToolLines(shapes))if(!shop.makeTools.includes(shapeLower(tool)))shop.makeTools.push(shapeLower(tool));
      dropped.add(draft);
      continue;
    }
    // (a step written again because its pieces were changed, or whose numbers are out of date, keeps its old words
    //  only as "Before your change the step read": they are cleaned the same way, and what moved goes on the drawings
    //  all the same; pencil lines are worked out again from the pieces as they are now, so a shelf moved or deleted
    //  by hand moves or leaves its line, and the others stay: marksFromModel)
    const current=draft.source==='preset'&&!draft.stale;
    const before=shop.make.length;
    draft.words=shopMoveWords(draft.words,draft,shop);
    // (the preset's own Fasten with lines too: the roof screws of the Bird feeder are placed in words there)
    if(Array.isArray(draft.extra))draft.extra=draft.extra.map(line=>shopMoveWords(line,draft,shop));
    if(!current){
      for(const entry of shop.make.slice(before)){
        if(entry.kind!=='mark')continue;
        const words=marksFromModel(entry.on);
        if(words){entry.words=words;entry.fromModel=true;}
        else entry.drop=true;
      }
      for(let i=shop.make.length-1;i>=before;i--)if(shop.make[i].drop)shop.make.splice(i,1);
    }
    if(!draft.words){
      // nothing left to say: a note step goes; a step that puts pieces in says which
      // (a step that still carries Fasten with lines of its own is kept: the code reviewer's note 37)
      if(!draft.pieces.length&&!(draft.preset.hardware||[]).length&&!(draft.extra||[]).length)dropped.add(draft);
      else draft.words=`Lay out the ${listWords([...new Set(draft.pieces.map(p=>pluralName(p.name).toLowerCase()))])}, made from their part drawings.`;
    }
  }
  for(let i=drafts.length-1;i>=0;i--)if(dropped.has(drafts[i]))drafts.splice(i,1);
  // a sentence that moved to a piece the design no longer has is kept in the box, so nothing is lost
  const names=new Set(S.parts.concat(woodStrips()).map(p=>p.name));
  for(const entry of shop.make)if(!entry.on.some(name=>names.has(name))&&!shop.boxLines.includes(entry.words))shop.boxLines.push(entry.words);
  return shop;
}
/* The pencil lines of a piece that others lie across (the shelves on a bookshelf's sides, the frames on a garage
   shelf's posts), worked out from the pieces as they are now: the underside of each flat piece fastened to it,
   measured from its bottom end, in the words the presets use, so markingLines (js/steppictures.js) draws them.
   '' when no such piece is there. */
function marksFromModel(names){
  const host=S.parts.find(p=>names.includes(p.name)&&!isProp(p)&&!tilted(p));
  if(!host)return'';
  const base=plainBox(host).lo[1],across=new Map();
  for(const link of connectionsOf(host.id)){
    const other=link.a===host?link.b:link.a;
    if(isProp(other)||tilted(other)||size(other)[1]>1.6)continue;   // (a flat piece: a shelf, a bottom, a deck)
    const under=r16(plainBox(other).lo[1]-base);
    if(under<=0)continue;
    if(!across.has(other.name))across.set(other.name,new Set());
    across.get(other.name).add(under);
  }
  if(!across.size)return'';
  const said=[...across].sort((a,b)=>Math.min(...a[1])-Math.min(...b[1])).map(([name,set])=>`${name.toLowerCase()} ${[...set].sort((x,y)=>x-y).map(v=>fmt(v)).join(', ')}`);
  return`Underside of each piece that sits across it, measured from the bottom end of the ${host.name.toLowerCase()}: ${said.join('; ')}. Pencil a line there on its inside face, square across.`;
}
/* Does a saved step hold part-making words that the packet cannot move and no row of AT_ASSEMBLY_WORK allows (a
   step saved with older words)? Then the design's steps are written again when it is opened (js/fasteningupgrade.js). */
function shopLeavesMakeWords(step){
  if(!step||!Array.isArray(step.add)||isCutStep(step)||isFinishStep(step))return false;
  if(Array.isArray(step.shapes)&&!step.add.length)return false;
  const left=shopMoveWords(stepText(step),null,newShop(null,[]));
  return makeOrdersLeft(left).length>0;
}

/* ---------- the parts of a cut-list row ---------- */
const piecesOfRow=(row,plan)=>S.parts.concat(woodStrips()).filter(p=>!isProp(p)&&plan.letterOf(p)===row.id);
/* the moved sentences that belong on a row's drawing */
function shopMakeOf(row,plan){
  const names=row.names instanceof Set?row.names:new Set(row.names||[]);
  if(!plan.shop)return[];
  // (an entry made for certain pieces, the holes of a door's hinges, goes on the row of those pieces only)
  const ids=plan.shop.make.some(entry=>entry.ids)?new Set(piecesOfRow(row,plan).map(p=>p.id)):null;
  return plan.shop.make.filter(entry=>entry.ids?entry.ids.some(id=>ids.has(id)):entry.on.some(name=>names.has(name)));
}
/* the marking view of the holes of a hinge or a pull on a row's drawing (hardwareMarkPlan, js/markingview.js), its
   numbers those of the drawing's words */
function hardwareMarkPlanOf(entry,plan){
  if(entry.kind!=='hardware')return null;
  const mark=hardwareMarkPlan(entry.hardware,plan.letterOf);
  if(mark)mark.words=entry.words;
  return mark;
}
/* Do some words give this size as a whole size, not as the end of a longer one (the 16" of 2 9/16", the 1/2" of
   3 1/2")? */
function saysWholeSize(words,size){
  for(let at=words.indexOf(size);at>=0;at=words.indexOf(size,at+1)){
    const before=words[at-1]||'',twoBefore=words[at-2]||'';
    if(/[\d/]/.test(before))continue;
    if(before===' '&&/\d/.test(twoBefore))continue;
    return true;
  }
  return false;
}
/* the marking view of a 'mark' entry on one row, or null: the pencil lines where the words give heights the model
   has (markingLines, js/steppictures.js; drawn by marksMarkPlan, js/markingview.js) */
function shopMarkPlanOf(entry,row,plan){
  if(entry.kind!=='mark'||!entry.view)return null;
  const ids=new Set(piecesOfRow(row,plan).map(p=>p.id));
  const lines=markingLines({words:entry.words},ids).filter(line=>ids.has(line.piece.id)&&saysWholeSize(entry.words,line.text));
  return lines.length?marksMarkPlan(lines,plan.letterOf,entry.words):null;
}
/* The pencil lines a step picture draws (spec 14, 6.3): those the step's own words give (markingLines,
   js/steppictures.js), and those pencilled on its pieces from their part drawings, so the picture shows where each
   piece sits. {lines, own}: own are the step's own (only those get a marking view under the picture). */
function stepPencilLines(plan,step,fresh){
  const own=markingLines(step,fresh),seen=new Set(own.map(line=>line.piece.id+'|'+line.text)),lines=own.slice();
  for(const entry of plan.shop?plan.shop.make:[]){
    if(entry.kind!=='mark'||!entry.view)continue;
    for(const line of markingLines({words:entry.words},fresh)){
      const key=line.piece.id+'|'+line.text;
      if(seen.has(key)||!entry.on.includes(line.piece.name)||!saysWholeSize(entry.words,line.text))continue;
      seen.add(key);
      lines.push(line);
    }
  }
  return{lines,own};
}
/* every marking view of the part drawings: [{letter, plan}] (markingPlansOfDesign, js/markingview.js) */
function shopMarkPlans(plan){
  const out=[];
  for(const row of cutRows().rows)for(const entry of shopMakeOf(row,plan)){
    const mark=shopMarkPlanOf(entry,row,plan);
    if(mark)out.push({letter:row.id,plan:mark});
    // (the holes of hinges and pulls: listed even without a view, so the check says it is missing)
    if(entry.kind==='hardware')out.push({letter:row.id,plan:hardwareMarkPlanOf(entry,plan),hole:entry.hole==='cup'?'cup':'pull'});
  }
  return out;
}
/* The four drain holes of the Bird feeder's tray: 1 1/2" in from each end and each edge, inside the rim strips
   (the program's own choice: the step said only "four 1/4" drain holes"). In the face's own inches from the corner
   with the letter: [{a, b, dia}]. */
const DRAIN_HOLES={d:.25,inset:1.5};
function drainHolesOf(row){
  const inset=Math.min(DRAIN_HOLES.inset,row.l/4,row.w/4);
  return[[inset,inset],[row.l-inset,inset],[inset,row.w-inset],[row.l-inset,row.w-inset]].map(([a,b])=>({a,b,dia:DRAIN_HOLES.d,inset}));
}

/* ---------- small parts a person makes (the owner, 20 Nov 11:20 PM) ----------
   "or if they have to be made it needs its own parts drawing and qty": every small thing a step tells a person to cut
   (blocks that hold a shelf or a slide at its height, the plugs cut from a dowel rod, the plywood between the boards
   of a header) is a part like any other: a row of its own in the parts list (under the cut list, "Small parts you
   make", its letter after the last letter of the cut list, so no other letter moves), how many, what it is cut from,
   and its own part drawing. Things bought ready are shopping list lines. Each is one or the other, never neither:
   the self-check smallPartsAreParts reads every step and note for "cut a ... block / scrap / piece of".
     SMALL_PART_SIZES     the size of a block cut from an offcut when only its length matters
     smallPartMark(name)  the mark a step's words carry where the part's letter goes ("part K"), filled in once the
                          letters are known (smallPartsOf)
     smallPartsOf(plan)   called at the end of makeBuildPlan: plan.shop.parts = [{id, name, qty, l, w, t, from, use,
                          how, step}], and the marks in the steps filled in */
const SMALL_PART_SIZES={blockWide:3.5,blockThick:.75,dowel:.375};
const smallPartMark=name=>`{{part:${name}}}`;
const SMALL_PART_MARKS=/\{\{part:([^}]+)\}\}/g;
/* the letter after the last of the cut list, the n-th one on (as cutRows writes them: A ... Z, AA ...) */
const letterAfter=(count,n)=>{const i=count+n;return(i>=26?String.fromCharCode(64+Math.floor(i/26)):'')+String.fromCharCode(65+i%26);};
/* the inches a list of sizes gives ("3 1/4" for the bottom drawer and 8 1/2" for the top drawer"): [numbers] */
const inchesIn=words=>(String(words).match(/\d+ \d+\/\d+"|\d+\/\d+"|\d+(?:\.\d+)?"/g)||[]).map(said=>parseLen(said.replace(/"$/,''))).filter(v=>v>0);
function smallPartsOf(plan){
  const shop=plan.shop,parts=[];
  const add=part=>{
    // one row for parts of one name and size
    const same=parts.find(one=>one.name===part.name&&Math.abs(one.l-part.l)<1e-6&&Math.abs(one.w-part.w)<1e-6&&Math.abs(one.t-part.t)<1e-6);
    if(same){same.qty+=part.qty;if(part.step&&!same.steps.includes(part.step))same.steps.push(part.step);return;}
    parts.push({...part,steps:part.step?[part.step]:[]});
  };
  const offcut='an offcut of 3/4" plywood or a 1x board',block={w:SMALL_PART_SIZES.blockWide,t:SMALL_PART_SIZES.blockThick,from:offcut};
  // 1. the moved sentences that cut a small part (the shelf blocks of the Nightstand and the Computer desk)
  for(const entry of shop.alsoCut)if(entry.piece)add({...block,...entry.piece,step:entry.step,how:['Cut it square across, to the length given: only the length matters.']});
  // 2. the spacer block of the drawer slides or runners: it is cut to the highest mark, then shorter for each pair
  //    below ("Cut the block shorter for the next pair" is fitting, done at assembly)
  for(const step of plan.steps){
    const texts=[step.words].concat(step.hardware.map(row=>row.line));
    const said=texts.join(' ');
    if(!/cut a scrap of plywood that holds the (?:slide|runner) at its mark|A spacer block gets the left and the right slide to the same height: cut a scrap of wood, stand it/.test(said))continue;
    let lengths=[];
    const slide=said.match(/the block is this long: ([^.]*)\./);
    if(slide)lengths=inchesIn(slide[1]);
    else{
      // runners: the block holds a runner's underside at its mark (the step gives the top edge of each)
      const runner=said.match(/top edge (?:at these heights|this high) above [^:]+: ([^.]*?)(?:\. |, and the|$)/);
      if(runner)lengths=inchesIn(runner[1]).map(v=>v-DRAWER.runnerStrip).filter(v=>v>0);
    }
    if(!lengths.length)continue;
    const longest=Math.max(...lengths);
    add({name:'Spacer block',qty:1,...block,l:r16(longest),step:step.no,
      use:'It stands on the panel under the drawers and holds each drawer slide (or runner) at its mark while it is screwed on, the same height on both sides; it is not part of the piece.',
      how:[lengths.length>1?`Cut it ${fmt(r16(longest))} long, for the highest pair first; step ${step.no} says when to cut it shorter for the next pair down (${listWords([...new Set(lengths.map(v=>fmt(r16(v))))])}).`:`Cut it ${fmt(r16(longest))} long, square across.`,
        'Measure your own slides first: the step gives the length for the usual slide.']});
    // (the step stands this part where it cut a scrap before)
    step.words=step.words.replace(/cut a scrap of plywood that holds the (slide|runner) at its mark when it stands on ([^,.]+)/,(all,what,on)=>`stand the spacer block (${smallPartMark('Spacer block')}) on ${on}, so it holds the ${what} at its mark`);
    for(const row of step.hardware)row.line=row.line.replace(/cut a scrap of wood, stand it/,`stand the spacer block (${smallPartMark('Spacer block')})`);
  }
  // 3. the blocks a slatted lower shelf stands on while the end frames are joined (Coffee table, shoe bench)
  for(const step of plan.steps){
    const m=step.words.match(/rest on two scrap blocks (\d+(?: \d+\/\d+)?"|\d+\/\d+") tall/);
    if(!m)continue;
    add({name:'Stretcher block',qty:2,...block,l:parseLen(m[1].replace(/"$/,'')),step:step.no,
      use:'They hold the lower shelf at its height while the end frames are joined, then come out: they are not part of the piece.',how:['Cut each square across, to the length given: only the length matters.']});
    step.words=step.words.replace(m[0],`rest on the two stretcher blocks (${smallPartMark('Stretcher block')}), ${m[1]} tall`);
  }
  // 4. the 1/2" plywood between the two boards of a header (the Shed): one strip the size of the header boards
  const headers=S.parts.filter(p=>p.name==='Header');
  if(headers.length&&plan.steps.some(step=>/scraps of 1\/2" plywood between them/.test(step.words))){
    const bySize=new Map();
    for(const p of headers){const key=`${r16(p.l)}|${r16(p.w)}`;bySize.set(key,(bySize.get(key)||0)+1);}
    for(const[key,count]of bySize){
      const[l,w]=key.split('|').map(Number);
      add({name:'Header spacer',qty:Math.max(1,Math.round(count/2)),l,w,t:.5,from:'an offcut of 1/2" plywood (the shed\'s sheathing or floor scraps)',step:0,
        use:'It goes between the two boards of a header, so the header is as thick as the wall.',how:['Cut it to the length and width of the header boards it goes between.']});
    }
    for(const step of plan.steps)step.words=step.words.replace(/with scraps of 1\/2" plywood between them/,`with a header spacer of 1/2" plywood (${smallPartMark('Header spacer')}) between them`);
  }
  // 5. the plugs cut from a dowel rod for heads sunk deeper than a store plug is long (plugWords, js/buildsteps.js)
  const byLength=new Map();
  for(const step of plan.steps)for(const group of step.groups){
    if(group.type!=='plug')continue;
    for(const f of group.links.flatMap(link=>fastenersOfLink(link))){
      if(!(f.sunk>0)||!f.plug||!plugIsDowel(f.sunk))continue;
      const l=r16(f.sunk+.25);
      if(!byLength.has(l))byLength.set(l,{count:0,step:step.no});
      byLength.get(l).count++;
    }
    group.line=group.line.replace(/a piece of 3\/8" dowel rod ([^ ]+(?: \d+\/\d+")?) long \(Also cut, on the Cut list page\)/,(all,len)=>`a plug of 3/8" dowel rod ${len} long (${smallPartMark('Plug')})`)
      .replace(/so cut a piece of 3\/8" dowel rod ([^ ]+(?: \d+\/\d+")?) long for each hole/,(all,len)=>`so each hole takes a plug of 3/8" dowel rod ${len} long (${smallPartMark('Plug')})`);
  }
  for(const[l,{count,step}]of byLength)add({name:'Plug',qty:count,l,w:SMALL_PART_SIZES.dowel,t:SMALL_PART_SIZES.dowel,round:true,from:'3/8" dowel rod (on the shopping list)',step,
    use:'Each one is glued into a counterbore over a screw head and cut flush when the glue is dry.',how:['Cut each piece square across. A stop block clamped to the saw makes them all one length.']});
  // the letters, after the last of the cut list, and the marks in the words filled in
  const after=cutRows().rows.length;
  parts.forEach((part,index)=>{part.id=letterAfter(after,index);});
  const lettersOf=name=>parts.filter(part=>part.name===name).map(part=>part.id);
  const fill=text=>String(text).replace(SMALL_PART_MARKS,(all,name)=>{const ids=lettersOf(name);return ids.length?`part${ids.length>1?'s':''} ${listWords(ids)}`:'cut it from a scrap';});
  for(const step of plan.steps){
    step.words=fill(step.words);
    for(const row of step.hardware)row.line=fill(row.line);
    for(const group of step.groups)group.line=fill(group.line);
  }
  for(const entry of shop.make)entry.words=fill(entry.words);
  shop.boxLines=shop.boxLines.map(fill);
  shop.parts=parts;
  return parts;
}
/* the small parts under the cut list (cutListSection, js/plans.js): their own table, its letters after the cut list's */
function smallPartsTableHtml(plan){
  const parts=plan&&plan.shop&&plan.shop.parts||[];
  if(!parts.length)return'';
  const rows=parts.map(part=>`<tr><td>${partLinkHtml(part.id,keyBox(part.id))}</td><td class="num">${part.qty}</td><td>${esc(part.name)}</td><td>${esc(part.from)}</td>`+
    `<td class="num">${fmt(part.l)}</td><td class="num">${part.round?esc(fmt(part.w)+' round'):fmt(part.w)}</td><td class="num">${part.round?'':fmt(part.t)}</td><td>${partLinkHtml(part.id,esc(`${part.id}: cut to size`))}</td><td>${esc(part.use)}</td></tr>`);
  return`<h3>Small parts you make</h3><p class="hint">${esc(SMALL_PARTS_HINT)}</p>`+
    docTable([['Part',''],['Qty','num'],['Piece',''],['Cut from',''],['Length','num'],['Width','num'],['Thick','num'],['Drawing',''],['What it is for','']],rows,'small-parts');
}
const SMALL_PARTS_HINT='Small things you cut yourself for this design, from offcuts or from what the shopping list buys. Each has its letter and its own drawing, like the parts above.';
/* the part drawing of a small part: its header, its outline with its sizes, what it is for, the title block */
function smallPartFigure(part,number,total){
  const size=part.round?`${fmt(part.l)} long, ${fmt(part.w)} round`:`${fmt(part.l)} × ${fmt(part.w)} × ${fmt(part.t)}`;
  const key={name:part.id,signature:`small|${part.name}|${r16(part.l)}`},ticks=doneTicks(key);
  const boxes=`<span class="done">Done ${Array.from({length:Math.min(part.qty,24)},(unused,i)=>`<input type="checkbox" data-done-key="${esc(doneKey(key))}"${ticks[i]?' checked':''} aria-label="${esc(part.name)} ${i+1} made">`).join('')}</span>`;
  const outline=plainPartSvg({id:part.id,l:part.l,w:part.w,t:part.t,mat:null},null,!part.round);
  const how=part.how.concat(part.steps.length?[`Step ${listWords(part.steps.map(String))} uses ${part.qty>1?'them':'it'}.`]:[]);
  return`<figure class="part-fig small-part" id="part-${part.id}" data-letter="${part.id}">`+
    `<div class="pf-strip printonly">${esc(S.name)} · Part drawings · Part ${esc(part.id)} · ${esc(docDate())}</div>`+
    `<div class="pf-head"><span class="key pf-mark">${esc(part.id)}</span><div class="pf-what"><b>${esc(part.name)}</b><span>make ${part.qty} · cut from ${esc(part.from)}, to ${esc(size)}</span><span class="pf-holds">${esc(part.use)}</span></div>${boxes}</div>`+
    `<div class="pf-plain">${outline.svg}<p class="pf-note">${part.round?`A round piece ${esc(fmt(part.w))} across.`:`${esc(fmt(part.t))} thick.`}${outline.stretched?' Drawn wider than it is, so it can be read; every size is written.':''}</p></div>`+
    `<div class="pf-how"><h4>How to make it</h4><ol>${how.map(line=>`<li>${esc(line)}</li>`).join('')}</ol></div>`+
    `<div class="pf-tb"><div><small>Design</small><b>${esc(S.name)}</b></div><div><small>Part</small><b>${esc(part.id)}: ${esc(part.name)}</b></div><div><small>Make</small><b>${part.qty}</b></div>`+
    `<div><small>Stock</small><b>${esc(part.from.replace(/ \(.*\)$/,''))}</b></div><div><small>Cut size</small><b>${esc(size)}</b></div><div><small>Sheet</small><b>${number} of ${total}</b></div></div></figure>`;
}

/* ---------- the Drawing column of the cut list ---------- */
function drawingColumnText(row,plan){
  const holes=drillHolesWords(row,plan.drill);
  const make=shopMakeOf(row,plan);
  const said=[];
  if(row.sample&&row.sample.shape)said.push('shape');
  if(holes)said.push(holes);
  if(make.some(entry=>entry.holes))said.push('drain holes');
  if(make.some(entry=>entry.hole==='cup'))said.push('cup holes for the hinges');
  if(make.some(entry=>entry.hole==='pull'))said.push('holes for the pull');
  if(make.some(entry=>entry.kind==='mark'))said.push('pencil lines');
  if(make.some(entry=>entry.kind==='band'))said.push('edge banding');
  if(make.some(entry=>entry.kind==='make'))said.push('how to make it');
  return`${row.id}: ${said.length?said.join(', '):'cut to size'}`;
}
const partLinkHtml=(letter,inner)=>`<a class="part-link" href="#part-${letter}" data-part="${letter}">${inner}</a>`;
const drawingColumnHtml=(row,plan)=>partLinkHtml(row.id,esc(drawingColumnText(row,plan)));
/* "part drawing C", "part drawings E1 and E2" in the words of a step (already escaped html): each label a link */
function linkPartWords(html){
  return String(html).replace(/\bpart drawings? ((?:[A-Z]{1,2}\d*)(?:(?:, | and )[A-Z]{1,2}\d*)*)/g,(all,labels)=>{
    // (one drawing: the whole "part drawing C" is the link, a target a thumb can hit: the real-thing review, 13)
    if(/^[A-Z]{1,2}\d*$/.test(labels))return partLinkHtml(labels,all);
    return all.replace(labels,labels.replace(/[A-Z]{1,2}\d*/g,label=>partLinkHtml(label,label)));
  });
}
/* a click on a letter or a "part drawing C" link: the Cut list page at that drawing (the phone: its Cut list tab).
   A way of a letter (G1) inside its drawing: the drawing's own header is shown too when it fits on the screen
   with the way (the real-thing review, 18). */
function showPartDrawing(letter){
  if(window.PHONE_PAGE&&typeof phone!=='undefined'&&phone.root&&typeof phoneShowSection==='function')phoneShowSection('cut');
  else if(tab!=='cut')setTab('cut');
  const target=document.getElementById(letter?'part-'+letter:'partDrawings');
  if(!target)return;
  const figure=target.closest&&target.closest('figure.part-fig');
  const near=figure&&figure!==target&&target.getBoundingClientRect().top-figure.getBoundingClientRect().top<window.innerHeight*.6;
  (near?figure:target).scrollIntoView({block:'start'});
}
document.addEventListener('click',event=>{
  const link=event.target.closest&&event.target.closest('a[data-part]');
  if(!link)return;
  event.preventDefault();
  showPartDrawing(link.dataset.part);
});

/* ---------- the tools of the two pages ---------- */
/* Tools for making the parts: the cutting tools, the drilling tools and bits, the shape tools, the rest */
function shopTools(plan){
  const tools=[];
  // (one tool named twice in other words is listed once: "tape measure, pencil and square" and "tape measure,
  //  square and pencil" are the same three things)
  const same=tool=>tool.toLowerCase().replace(/,? and |, /g,' ').split(' ').sort().join(' ');
  const add=tool=>{if(tool&&!tools.some(had=>same(had)===same(tool)))tools.push(tool);};
  // the program's own tool lines that only the making of the parts takes, word for word as the Build instructions
  // had them ("Saw (a circular saw or miter saw)", "... (or have the store cut it)", the bits with the size for
  // hard woods: the real-thing review, 10); the shorter words of the cutting step then only add what they lack
  // (a cutting step that names its own saw, "saw (a circular saw or jigsaw ...)", keeps that one: one saw line)
  const ownSaw=plan.shop.cutTools.some(tool=>/^saw\b/i.test(tool)&&tool!=='saw');
  const full=toolList(findJoints(),plan).filter(line=>SHOP_ONLY_TOOLS.some(row=>row.line.test(line))&&!(ownSaw&&/^Saw \(/.test(line)));
  full.forEach(add);
  const said=full.join(' ').toLowerCase();
  plan.shop.cutTools.filter(tool=>!(tool==='saw'&&/\bsaw\b/.test(said))&&!(/straight-edge guide/i.test(tool)&&/straight-edge guide/.test(said))).forEach(add);
  if(plan.drill&&plan.drill.total)drillTools(plan.drill).forEach(add);
  plan.shop.makeTools.forEach(add);
  // a plain "saw" says nothing a saw named for its cut does not
  return tools.some(tool=>/^saw \(|^miter saw|^circular saw|^jigsaw/i.test(tool))?tools.filter(tool=>tool!=='saw'):tools;
}
/* Tools you need on Build instructions: the program's tool list less the tools only the making of the parts takes
   (each kept when a step still uses it: a saw for the plugs, the bits for a hole drilled at assembly) */
const SHOP_ONLY_TOOLS=[
  // (kept only when a step itself lists a plain saw: a "flush-cut saw" for the plugs is not a circular saw)
  {line:/^Saw \(a circular saw or miter saw\)$/,unless:/(^|; )saw(;|$)/},
  {line:/^Drill bits: /,unless:/pilot-hole bit|countersink bit|drill bit|Forstner/},
  {line:/^Pocket-hole jig$/,unless:/pocket-hole jig and/},
  {line:/^Dowel jig and a mallet/,unless:/dowel jig/},
  {line:/^Straight-edge guide for cutting plywood/,unless:null},
  {line:/^Household iron and an edge banding trimmer/,unless:/household iron/},
];
function assemblyTools(joints,plan){
  const used=plan.steps.flatMap(step=>step.need?step.need.tools:[]).join('; ');
  const shapeOnly=new Set(shapeToolLines());
  return toolList(joints,plan).filter(line=>{
    if(shapeOnly.has(line))return false;
    const row=SHOP_ONLY_TOOLS.find(candidate=>candidate.line.test(line));
    return!row||(row.unless&&row.unless.test(used));
  });
}

/* The notes of a design split by page: a note that orders part making (and no row of AT_ASSEMBLY_WORK allows) is for
   the Cut list page only, under "Notes for making the parts"; the rest show on both. {assembly, making} */
function shopNotes(notes){
  const text=note=>typeof note==='string'?note:note&&note.t||'';
  const isMaking=note=>makeOrdersLeft(text(note),null).length>0;
  return{assembly:notes.filter(note=>!isMaking(note)),making:notes.filter(isMaking)};
}
/* ---------- the Instructions page: the first line ---------- */
function shopFirstHtml(plan){
  const link=`<a class="part-link" href="#partDrawings" data-part="">Part drawings</a>`;
  const first=esc(SHOP_FIRST_WORDS).replace('Part drawings',link).replace(/^Make every part first\./,'<b>Make every part first.</b>');
  const before=plan.shop&&plan.shop.beforeStart?`<p>${esc(plan.shop.beforeStart)}</p>`:'';
  return`<div class="shop-first"><p>${first}</p>${before}</div>`;
}

/* ---------- small drawings of their own: the plain outline and the small 3D view ---------- */
// (the words: 13 px and the numbers 15 px on the page, twice that in the drawing's own units on the phone, which
//  shows the drawing at half its width: css/phonepages.css. The outline is laid out for the phone's larger words,
//  so they never meet there, and is roomy on the page.)
const PLAIN_VIEW={width:640,left:44,most:150,least:26,words:13,numbers:15,phone:2,ink:'#14181d',gray:'#5b636b',hole:'#0b3a8f'};
const svgNum=v=>(Math.round(v*10)/10).toString();
/* an arrowhead at (x, y) pointing along (dx, dy) */
function arrowHead(x,y,dx,dy){
  const n=Math.hypot(dx,dy)||1,ux=dx/n,uy=dy/n,size=7;
  return`<path d="M${svgNum(x)} ${svgNum(y)}L${svgNum(x-ux*size-uy*size*.4)} ${svgNum(y-uy*size+ux*size*.4)}L${svgNum(x-ux*size+uy*size*.4)} ${svgNum(y-uy*size-ux*size*.4)}Z" fill="${PLAIN_VIEW.ink}"/>`;
}
/* The plain outline of a row (spec 14, 5, item 3), laid out: its face seen square on, the length across, the length
   and the width dimensioned with extension lines and arrowheads, the corner the letter goes at, the grain of a
   sheet, and the drain holes of the Bird feeder's tray with their centre lines and a call-out on a leader.
   phone: the boxes of the words measured at the phone's size (the self-check, js/drawingclear.js); the places are
   the same either way. Returns {width, height, texts, segments, marks, parts (svg), stretched}. */
/* The edges of an outline that the moved banding words name (the real-thing review, 9: "a woodworker wants to see
   which edges at a glance"): {top, bottom, left, right}; the outline lies with its length across, the front edge
   down, the ends left and right. */
function bandedEdgesOf(entries){
  const words=entries.filter(entry=>entry.kind==='band').map(entry=>entry.words).join(' ').toLowerCase();
  if(!words)return null;
  const all=/all four edges/.test(words);
  return{top:all||/back edge/.test(words),bottom:all||/front edge/.test(words),left:all||/\bends\b|\bend\b/.test(words),right:all||/\bends\b/.test(words)};
}
function plainPartLayout(row,holes,withLabel=true,phone=false,banded=null){
  const V=PLAIN_VIEW,k=phone?V.phone:1,big=V.phone;
  const T=V.words*big,N=V.numbers*big;   // (the sizes the layout makes room for)
  const texts=[],segments=[],marks=[],parts=[];
  const width=(words,size,bold)=>partTextWidth(words,size,bold);
  // a text: its box as drawn at this size (k), its place laid out for the larger one
  const addText=(x,y,words,cls,anchor)=>{
    const size=(cls==='pp-n'?V.numbers:V.words)*k,bold=cls==='pp-n',w=width(words,size,bold);
    const left=anchor==='middle'?x-w/2:x;
    texts.push({text:words,box:{x:left,y:y-size*.78,w,h:size}});
    parts.push(`<text x="${svgNum(x)}" y="${svgNum(y)}" class="${cls}"${anchor==='middle'?' text-anchor="middle"':''}>${esc(words)}</text>`);
  };
  const line=(ax,ay,bx,by,extra)=>{
    segments.push({a:[ax,ay],b:[bx,by]});
    parts.push(`<line x1="${svgNum(ax)}" y1="${svgNum(ay)}" x2="${svgNum(bx)}" y2="${svgNum(by)}" stroke="${V.ink}" stroke-width="${extra&&extra.width||1}"${extra&&extra.dash?` stroke-dasharray="${extra.dash}"`:''}/>`);
  };
  // the room round the piece: on the right the width number, over it the corner's words and the call-out of the
  // holes, each a line of its own, under it the length number
  const widthWords=fmt(row.w),right=26+10+width(widthWords,N,true)+8;
  const lineH=Math.ceil(T*1.3);
  const calloutLines=holes&&holes.length?2:0;
  const top=14+lineH*((withLabel?1:0)+calloutLines)+(calloutLines?8:0);
  const room=V.width-V.left-right;
  const scale=Math.min(room/row.l,V.most/row.w);
  const w=row.l*scale,trueH=row.w*scale,h=Math.max(trueH,V.least),stretched=h>trueH+.5;
  const x0=V.left,y0=top,x1=x0+w,y1=y0+h;
  parts.push(`<rect x="${svgNum(x0)}" y="${svgNum(y0)}" width="${svgNum(w)}" height="${svgNum(h)}" fill="#fff" stroke="${V.ink}" stroke-width="1.6"/>`);
  segments.push({a:[x0,y0],b:[x1,y0]},{a:[x1,y0],b:[x1,y1]},{a:[x1,y1],b:[x0,y1]},{a:[x0,y1],b:[x0,y0]});
  // the banded edges drawn heavy
  if(banded)for(const[side,a,b]of[['top',[x0,y0],[x1,y0]],['bottom',[x0,y1],[x1,y1]],['left',[x0,y0],[x0,y1]],['right',[x1,y0],[x1,y1]]])
    if(banded[side])parts.push(`<line x1="${svgNum(a[0])}" y1="${svgNum(a[1])}" x2="${svgNum(b[0])}" y2="${svgNum(b[1])}" stroke="${V.ink}" stroke-width="4.5" stroke-linecap="square"/>`);
  // the length: extension lines down from both ends, a dimension line with arrowheads, the number under it
  const dy=y1+26;
  line(x0,y1+4,x0,dy+6);line(x1,y1+4,x1,dy+6);line(x0,dy,x1,dy);
  parts.push(arrowHead(x0,dy,-1,0)+arrowHead(x1,dy,1,0));
  addText((x0+x1)/2,dy+8+N*.78,fmt(row.l),'pp-n','middle');
  // the width: extension lines out from the far end, the dimension line, the number beside it
  const dx=x1+26;
  line(x1+4,y0,dx+6,y0);line(x1+4,y1,dx+6,y1);line(dx,y0,dx,y1);
  parts.push(arrowHead(dx,y0,0,-1)+arrowHead(dx,y1,0,1));
  addText(dx+10,(y0+y1)/2+N*.3,widthWords,'pp-n');
  // the corner the letter is written at (the end it is measured from), as on the drill drawings
  parts.push(`<circle cx="${svgNum(x0)}" cy="${svgNum(y0)}" r="4.5" fill="#fff" stroke="${V.ink}" stroke-width="1.4"/>`);
  marks.push({x:x0-5.5,y:y0-5.5,w:11,h:11});
  // (a part also drilled: its drilling drawing says which face the letter goes on)
  if(withLabel)addText(x0,y0-14,`write ${row.id} here, on the face you like least`,'pp-t');
  // the grain of a plywood piece: along its length, or along its width where the cut list says so (the word only
  // where it fits inside the outline at the phone's size)
  // (a small part cut from an offcut has no material of the list: no grain is drawn)
  if(M[row.mat]&&M[row.mat].kind==='sheet'){
    const along=!row.grainOnWidth,cx=(x0+x1)/2,cy=(y0+y1)/2,roomForWord=h>=2*(T+8);
    if(along&&w>140){
      line(cx-50,cy,cx+50,cy);parts.push(arrowHead(cx+50,cy,1,0)+arrowHead(cx-50,cy,-1,0));
      if(roomForWord)addText(cx,cy-8,'grain','pp-t','middle');
    }else if(!along&&h>60){
      line(cx,cy-22,cx,cy+22);parts.push(arrowHead(cx,cy+22,0,1)+arrowHead(cx,cy-22,0,-1));
      if(w>2*(width('grain',T,false)+20))addText(cx+8,cy+4,'grain','pp-t');
    }
  }
  // holes on the outline (the drain holes): each with its centre lines, one call-out with the count on a leader to
  // the first, and the place of the first from the corner with the letter
  if(calloutLines){
    for(const hole of holes){
      const cx=x0+hole.a*scale,cy=y0+hole.b*(h/row.w),r=Math.max(3,hole.dia/2*scale);
      parts.push(`<circle cx="${svgNum(cx)}" cy="${svgNum(cy)}" r="${svgNum(r)}" fill="#fff" stroke="${V.hole}" stroke-width="1.6"/>`);
      marks.push({x:cx-r-1,y:cy-r-1,w:2*r+2,h:2*r+2});
      // (the centre lines belong to the hole: they are drawn, not counted as lines a text must keep off)
      parts.push(`<line x1="${svgNum(cx-r-6)}" y1="${svgNum(cy)}" x2="${svgNum(cx+r+6)}" y2="${svgNum(cy)}" stroke="${V.ink}" stroke-width=".7" stroke-dasharray="6 2 1 2"/>`+
        `<line x1="${svgNum(cx)}" y1="${svgNum(cy-r-6)}" x2="${svgNum(cx)}" y2="${svgNum(cy+r+6)}" stroke="${V.ink}" stroke-width=".7" stroke-dasharray="6 2 1 2"/>`);
    }
    const first=holes[0],fx=x0+first.a*scale,fy=y0+first.b*(h/row.w);
    const words1=`${holes.length} × ${fmt(first.dia)} hole, through,`,words2=`${fmt(first.inset)} in from each end and each edge`;
    // (beside the leader, slid left as far as it must to stay on the drawing at the phone's size)
    const longest=Math.max(width(words1,T,false),width(words2,T,false));
    const second=y0-14-(withLabel?lineH:0)-4,firstLine=second-lineH,tx=Math.max(4,Math.min(fx+16,V.width-6-longest));
    line(fx+3,fy-3,tx-2,second+2,{width:.8});
    addText(tx,firstLine,words1,'pp-t');
    addText(tx,second,words2,'pp-t');
  }
  const height=Math.ceil(dy+8+N+8);
  return{width:V.width,height,texts,segments,marks,parts,stretched};
}
function plainPartSvg(row,holes,withLabel=true,banded=null){
  const layout=plainPartLayout(row,holes,withLabel,false,banded);
  return{svg:`<svg class="pd pp" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Outline of ${esc(row.id)}, ${esc(fmt(row.l))} by ${esc(fmt(row.w))}">${layout.parts.join('')}</svg>`,stretched:layout.stretched};
}
/* A small 3D view of the blank (the addendum: "a small 3D view of the part on its drawing where the program can make
   one cheaply"): the board as cut to size, seen from above at a corner, three faces shaded like a drawing. */
function isoPartSvg(row){
  const c=Math.cos(Math.PI/6),s=Math.sin(Math.PI/6);
  const W=150,H=86,l=row.l,w=row.w,t=row.t;
  const scale=Math.min((W-8)/((l+w)*c),(H-8)/((l+w)*s+t));
  const tt=Math.max(t*scale,2);   // a thin sheet still shows its edge
  const P=(x,y,z)=>[(x-z)*c*scale,(x+z)*s*scale-(y?tt:0)];
  const pts=[P(0,1,0),P(l,1,0),P(l,1,w),P(0,1,w),P(l,0,0),P(l,0,w),P(0,0,w)];
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),dx=(W-(Math.max(...xs)-Math.min(...xs)))/2-Math.min(...xs),dy=(H-(Math.max(...ys)-Math.min(...ys)))/2-Math.min(...ys);
  const poly=(list,fill)=>`<polygon points="${list.map(([x,y])=>`${svgNum(x+dx)},${svgNum(y+dy)}`).join(' ')}" fill="${fill}" stroke="#14181d" stroke-width=".9" stroke-linejoin="round"/>`;
  const top=[P(0,1,0),P(l,1,0),P(l,1,w),P(0,1,w)],front=[P(0,1,w),P(l,1,w),P(l,0,w),P(0,0,w)],end=[P(l,1,0),P(l,0,0),P(l,0,w),P(l,1,w)];
  return`<svg class="pp-iso" viewBox="0 0 ${W} ${H}" role="img" aria-label="The blank of ${esc(row.id)} in 3D">${poly(top,'#f1f3f5')}${poly(front,'#ffffff')}${poly(end,'#dde1e5')}</svg>`;
}

/* the sentences of some words that give no size (the shape block of the drawing gives every size): '' when none */
// (block: the words of the shape block; a sentence with a size the block does not give, "stop the saw about 1/4"
//  short of the mark", is kept: it says something the block does not)
const SIZE_WORDS=/\d+ \d+\/\d+"|\d+\/\d+"|\d+"/g;
const shapeAddsWords=(words,block)=>String(words).split(/(?<=[.!?])\s+/).filter(sentence=>!/\d/.test(sentence)||(sentence.match(SIZE_WORDS)||[]).some(size=>!String(block||'').includes(size))).join(' ').trim();
/* ---------- one part drawing (spec 14, section 5) ---------- */
function partFigure(row,plan,number,total){
  const drill=plan.drill,letter=row.id,m=M[row.mat],names=[...row.names].join(', ');
  const labels=drill.labels.filter(label=>label.letter===letter);
  const ways=labels.filter(label=>!label.mirror&&label.drawn&&label.way).map(label=>({label,figure:drawingFigure(label,plan)}));
  const shaped=!!(row.sample&&row.sample.shape);
  const make=shopMakeOf(row,plan);
  const size=`${fmt(row.l)} × ${fmt(row.w)} × ${fmt(row.t)}`;
  const parts=[];
  // the title strip of a printed page (8), and the header: the letter, the names, how many, the stock and cut size
  parts.push(`<div class="pf-strip printonly">${esc(S.name)} · Part drawings · Part ${esc(letter)} · ${esc(docDate())}</div>`);
  const ownDone=!ways.length;   // a piece with no drilling way gets its Done boxes here (a way has its own)
  let boxes='',holds=drawingColumnText(row,plan).replace(/^[A-Z]+: /,'');
  // one way, named by the letter itself and drilled alike: its header would say what this header says, so its Done
  // boxes come up here and its header goes (a letter drilled two ways, or a mirror pair, keeps a header per way)
  if(ways.length===1&&ways[0].label.name===letter&&!ways[0].label.mirrorLabel){
    const head=ways[0].figure.html.match(/<div class="fig-head">[\s\S]*?(<span class="done">[\s\S]*?<\/span>)<\/div>/);
    if(head){
      boxes=head[1];
      ways[0].figure.html=ways[0].figure.html.replace(head[0],'');
      if(ways[0].label.tape)holds+=', label on painter\'s tape';
      // (what the way's header said that this one does not: "on both faces", "drilled alike": the code reviewer's 23)
      const said=head[0].replace(/<[^>]+>/g,' ');
      if(/on both faces/.test(said))holds+=', on both faces';
      if(/drilled alike/.test(said)&&row.qty>1)holds+=', drilled alike';
    }
  }
  if(ownDone){
    const key={name:letter,signature:`part|${r16(row.l)}|${r16(row.w)}|${r16(row.t)}`},ticks=doneTicks(key);
    boxes=`<span class="done">Done ${Array.from({length:row.qty},(unused,i)=>`<input type="checkbox" data-done-key="${esc(doneKey(key))}"${ticks[i]?' checked':''} aria-label="${esc(names)} ${i+1} made">`).join('')}</span>`;
  }
  parts.push(`<div class="pf-head"><span class="key pf-mark">${esc(letter)}</span><div class="pf-what"><b>${esc(names)}</b>`+
    `<span>make ${row.qty} · ${esc(m.short)}, cut to ${esc(size)}</span><span class="pf-holds">${esc(holds)}</span></div>`+
    `${boxes}<span class="pp-iso-box">${isoPartSvg(row)}<small>${shaped||make.some(entry=>entry.ends||/\b(?:bevel|point|notch|taper|arch|birdsmouth|round)/i.test(entry.words))?'the blank, before it is shaped':'the part, cut to size'}</small></span></div>`);
  // the pictures: the shape first (you cut the shape, then drill), then each way it is drilled, else its outline
  // (what a dashed line means on a shape: the outline on the far face, a cut with the blade tilted; the legend's
  //  dashed piece is for the drilling drawings: the real-thing review, 10)
  if(shaped)parts.push(shapeBlockHtml(row).html+`<p class="pf-note">On the shape: sizes are in inches, measured from the end or edge they start at. A dashed line is the outline on the far face (a cut with the blade tilted).</p>`);
  for(const{label,figure}of ways){
    // (a way of a letter cut more than one way has its own anchor; a mirror image is drawn with its twin)
    const own=label.name!==letter?` id="part-${label.name}"`:'';
    const mirror=label.mirrorLabel&&label.mirrorLabel.name!==letter?`<span id="part-${label.mirrorLabel.name}"></span>`:'';
    parts.push(`<div class="pf-way"${own}>${mirror}${figure.html}</div>`);
  }
  if(labels.some(label=>!label.drawn))parts.push(`<p class="hint">${esc(drillOverWords(drill))}</p>`);
  const holes=make.some(entry=>entry.holes==='drain')?drainHolesOf(row):null;
  // (the drain holes of the Bird feeder's tray are drawn on its outline, under its drilling when it has some)
  if((!shaped&&!ways.length)||holes){
    // (where the call-out of the holes takes the room over the outline, the corner's words go in the note under it,
    //  so the leader of the call-out crosses no words: the owner's addendum, point 9)
    const label=!(ways.length||shaped),inNote=label&&!!holes;
    const banded=bandedEdgesOf(make);
    const outline=plainPartSvg(row,holes,label&&!inNote,banded);
    const title=ways.length||shaped?`<h4 class="pf-sub">The drain holes, on the face the rim strips sit on</h4>`:'';
    const bandNote=banded?' The heavy edges get iron-on edge banding (the front edge drawn at the bottom, the ends left and right).':'';
    parts.push(`<div class="pf-plain">${title}${outline.svg}<p class="pf-note">${esc(fmt(row.t))} thick.${bandNote}${inNote?` Write ${esc(letter)} at the corner with the small circle, on the face you like least.`:''}${outline.stretched?' Drawn wider than it is, so it can be read; every size is written.':''}</p></div>`);
  }
  // the pencil lines (their marking view where the words give heights the model has) and How to make
  for(const entry of make){
    const mark=shopMarkPlanOf(entry,row,plan);
    if(mark)parts.push(`<figure class="pf-marks"><img src="${MARK_BLANK}" data-mark="${markingPictureLater(mark)}" alt="The pencil lines of ${esc(letter)}"><figcaption>Pencil lines: pencil them on now, with the heights measured up from the bottom end. ${entry.step?`Step ${entry.step} sets`:'The steps set'} the other pieces on them.</figcaption></figure>`);
    // the holes of the hinges or the pull, where they go on this piece (the steps only fit the hardware)
    const holes=hardwareMarkPlanOf(entry,plan);
    if(holes)parts.push(`<figure class="pf-marks"><img src="${MARK_BLANK}" data-mark="${markingPictureLater(holes)}" alt="Where the ${entry.hole==='cup'?'cup holes':'holes for the pull'} of ${esc(letter)} go"><figcaption>${entry.hole==='cup'?'The cup holes of the hinges':'The holes for the pull'}: drill them now, while the piece is loose. Step ${entry.step||entry.stepNo} fits the ${entry.hole==='cup'?'hinges':'pull'} in them.</figcaption></figure>`);
  }
  // (spec 14, 5 item 5: "a sentence never in both". Where the shape block above already gives the sizes, a moved
  //  sentence keeps only what it does not say: the reason, the tip; its numbers are the shape block's)
  // (the shape blocks of every shaped row the sentence is about: the toy chest's front and sides)
  const blocksOf=entry=>cutRows().rows.filter(other=>other.sample&&other.sample.shape&&[...other.names].some(name=>entry.on.includes(name)))
    .map(other=>shapeBlockHtml(other).html.replace(/<[^>]+>/g,' ')).join(' ');
  const lines=make.map(entry=>shaped&&entry.shapeSays?shapeAddsWords(entry.words,blocksOf(entry)):entry.words).filter(Boolean);
  if(lines.length){
    parts.push(`<div class="pf-how"><h4>How to make it</h4><ol>${[...new Set(lines)].map(line=>`<li>${esc(line)}</li>`).join('')}</ol></div>`);
  }
  // the title block (the addendum: design, part, how many, stock and cut size, sheet n of N)
  parts.push(`<div class="pf-tb"><div><small>Design</small><b>${esc(S.name)}</b></div><div><small>Part</small><b>${esc(letter)}: ${esc(names)}</b></div>`+
    `<div><small>Make</small><b>${row.qty}</b></div><div><small>Stock</small><b>${esc(m.short)}</b></div><div><small>Cut size</small><b>${esc(size)}</b></div>`+
    `<div><small>Sheet</small><b>${number} of ${total}</b></div></div>`);
  return{html:`<figure class="part-fig" id="part-${letter}" data-letter="${letter}">${parts.join('')}</figure>`,layouts:ways.map(way=>way.figure.layout)};
}
/* Rows with holes, shapes or work of their own are drawn first; plain rows fill the rest up to PART_DRAWINGS_MAX */
function rowsToDraw(list,plan){
  const busy=row=>(row.sample&&row.sample.shape)||plan.drill.labels.some(label=>label.letter===row.id)||shopMakeOf(row,plan).length>0;
  const chosen=new Set(list.rows.filter(busy).slice(0,PART_DRAWINGS_MAX));
  for(const row of list.rows){if(chosen.size>=PART_DRAWINGS_MAX)break;chosen.add(row);}
  return chosen;
}
/* the plug pieces of dowel rod, the scrap blocks: what else is cut with the parts, and the step that uses it */
function alsoCutLines(plan){
  // (a small thing that is a part of its own, with a letter and a drawing, is not listed here: smallPartsOf; the
  //  plugs cut from a dowel rod are such parts too)
  return plan.shop.alsoCut.filter(entry=>!entry.piece).map(entry=>`${entry.words}${entry.step?` (step ${entry.step})`:''}.`);
}
/* The Part drawings section of the Cut list page (spec 14, 4.3 to 4.7) */
function partDrawingsSection(list,plan){
  const drill=plan.drill,shop=plan.shop;
  // Before you make the parts: cutting, then the drilling lines when there are holes, then the tools
  const box=[shop.cutWords+(shop.copiesLine?' '+shop.copiesLine:'')].concat(shop.boxLines);
  // (why the holes are made first: the words of the old step 2, kept: the real-thing review, 10)
  if(drill.total)box.push('Drill every hole now, while each piece lies loose and flat: every hole is easy to place and to drill square, and once the pieces are put together the pocket-hole jig no longer fits.',...beforeYouDrillLines(drill));
  let h=`<h2>Part drawings</h2><p class="hint">${esc(PART_DRAWINGS_HINT)}</p>`;
  h+=`<div class="drill-box shop-before"><h4>Before you make the parts</h4><ol>${box.map(line=>`<li>${esc(line)}</li>`).join('')}</ol>`+
    `<p class="shop-tools"><b>Tools for making the parts:</b> ${esc(shopTools(plan).join('; '))}.</p></div>`;
  if(drill.total)h+=`<div class="shop-settings">${settingsHtml(drill)}</div>`;
  const chosen=rowsToDraw(list,plan),drawn=list.rows.filter(row=>chosen.has(row));
  const small=shop.parts||[],total=drawn.length+small.length;
  const figures=drawn.map((row,index)=>partFigure(row,plan,index+1,total));
  const layouts=figures.flatMap(figure=>figure.layouts);
  // one legend above the drawings: what the signs on every drilled drawing mean
  if(layouts.length)h+=`<div class="drill-legend">${partDrawingSvg(drillLegendLayout(layouts))}</div>`;
  h+=figures.map(figure=>figure.html).join('');
  // the small parts a person makes, after the parts of the cut list, in their order under it
  h+=small.map((part,index)=>smallPartFigure(part,drawn.length+index+1,total)).join('');
  const after=alsoCutLines(plan);
  if(after.length)h+=`<div class="shop-after"><h4>Also cut</h4><ul>${after.map(line=>`<li>${esc(line)}</li>`).join('')}</ul></div>`;
  if(drill.total)h+=drillTailHtml(drill,plan.letterOf);
  const rest=list.rows.filter(row=>!chosen.has(row));
  if(rest.length)h+=`<div class="shop-after"><h4>Cut to size only</h4><p class="hint">More parts than this page has room to draw: these are only cut to size, with nothing else to make.</p><ul>${rest.map(row=>
    `<li id="part-${row.id}">${keyBox(row.id)} ${esc([...row.names].join(', '))}: make ${row.qty}, ${esc(M[row.mat].short)}, ${esc(fmt(row.l))} × ${esc(fmt(row.w))} × ${esc(fmt(row.t))}</li>`).join('')}</ul></div>`;
  return`<section id="partDrawings" class="packet drill">${h}</section>`;
}

/* ---------- self-checks (spec 14, section 12; selfTest runs every function in SELFTESTS, see js/core.js) ---------- */
/* What one design's two pages say, for the checks: the problems of checks 1 to 5. full: the packet is drawn and read
   (every preset at its defaults in the three styles); else only the steps and the plan are read. */
function shopDesignProblems(plan,full){
  const found=[];
  const say=(check,text)=>found.push({check,text});
  const list=cutRows(),rows=list.rows,drill=plan.drill;
  // 1 (a): no cutting or drilling step; 5: numbered from 1, step 1 puts pieces in or is a note
  if(plan.steps.some(step=>step.kind==='cut'||step.kind==='drill'))say('partMakingOnlyOnTheCutPage','a step cuts or drills the pieces');
  plan.steps.forEach((step,index)=>{if(step.no!==index+1)say('assemblyStepsNumberedFromOne',`step ${index+1} carries the number ${step.no}`);});
  if(plan.steps.length&&!['build','note','hardware'].includes(plan.steps[0].kind))say('assemblyStepsNumberedFromOne',`step 1 is a ${plan.steps[0].kind} step`);
  // 1 (c): no part-making order in a step's words, its pre-drilled lines or its hardware lines, but the fitting
  // work of AT_ASSEMBLY_WORK
  // (everything the page prints of a step: its words, "Before your change the step read", Put in, every Fasten with
  //  line, the preset's own lines, the hardware lines; a line not drilled ahead may say how its holes are drilled
  //  at assembly, which the rows of AT_ASSEMBLY_WORK read with the step's own facts)
  for(const step of plan.steps){
    if(step.kind==='finish')continue;
    const texts=[step.words,step.was||'',step.put||''].concat(step.groups.map(group=>group.line),step.extra||[],step.hardware.map(row=>row.line));
    const left=texts.flatMap(text=>makeOrdersLeft(text,step));
    if(left.length)say('partMakingOnlyOnTheCutPage',`step ${step.no} still makes a part: "${left[0].slice(0,100)}"`);
  }
  // the notes too, as the Build instructions page prints them (shopNotes leaves the notes about making the parts to
  // the Cut list page)
  for(const note of shopNotes(S.notes||[]).assembly){
    const left=makeOrdersLeft(typeof note==='string'?note:note&&note.t||'',null);
    if(left.length){say('partMakingOnlyOnTheCutPage',`a note still makes a part: "${left[0].slice(0,100)}"`);break;}
  }
  // 3: every letter the steps use is a cut-list letter (or a drill label of one), or a small part's
  const letters=new Set(rows.map(row=>row.id).concat((plan.shop.parts||[]).map(part=>part.id)));
  // the owner's rule of 20 Nov 11:20 PM: every small thing a step or a note tells to cut is a part with a letter
  // (or a fitting done at assembly), never a thing cut in passing
  for(const step of plan.steps){
    const left=[step.words,step.put||''].concat(step.groups.map(group=>group.line),step.hardware.map(row=>row.line)).flatMap(smallCutsLeft);
    if(left.length)say('smallPartsAreParts',`step ${step.no} cuts a small thing that is no part: "${left[0].slice(0,100)}"`);
  }
  for(const note of S.notes||[]){
    const left=smallCutsLeft(typeof note==='string'?note:note&&note.t||'');
    if(left.length){say('smallPartsAreParts',`a note cuts a small thing that is no part: "${left[0].slice(0,100)}"`);break;}
  }
  for(const part of plan.shop.parts||[])if(!(part.l>0&&part.w>0&&part.t>0&&part.qty>0))say('smallPartsAreParts',`the small part ${part.id} (${part.name}) has no size or count`);
  for(const step of plan.steps)if(SMALL_PART_MARKS.test(step.words)){SMALL_PART_MARKS.lastIndex=0;say('smallPartsAreParts',`step ${step.no} still holds a mark for a part's letter`);}
  const baseLetter=label=>String(label).replace(/\d+$/,'');
  for(const step of plan.steps){
    for(const row of step.need.pieces)if(row.letter&&!letters.has(baseLetter(row.letter)))say('everyLetterIsInThePartsList',`step ${step.no} lists the letter ${row.letter}, which the cut list has not`);
    const words=[step.words,step.put||''].concat(step.groups.map(group=>group.line+' '+(group.where||'')),step.hardware.map(row=>row.line)).join(' ');
    for(const[,label]of words.matchAll(/\(([A-Z]{1,2}\d*)\)/g))if(!letters.has(baseLetter(label)))say('everyLetterIsInThePartsList',`step ${step.no} names the letter ${label}, which the cut list has not`);
  }
  // 4: the pieces the cut list counts are the pieces to cut of the title block
  const toCut=S.parts.filter(p=>!isProp(p)).length+woodStrips().length,counted=rows.reduce((sum,row)=>sum+row.qty,0);
  if(toCut!==counted)say('packetCountsMatchTheShoppingList',`the cut list counts ${counted} pieces, the title block ${toCut}`);
  // every moved sentence is on a drawing of its piece, or in the box when the design has no such piece
  const names=new Set(S.parts.concat(woodStrips()).map(p=>p.name));
  for(const entry of plan.shop.make)if(!entry.on.some(name=>names.has(name))&&!plan.shop.boxLines.includes(entry.words))say('partMakingOnlyOnTheCutPage',`"${entry.words.slice(0,60)}" is on no drawing`);
  if(!full)return found;
  // the packet as the page draws it
  const html=partDrawingsSection(list,plan);
  const holder=document.createElement('div');
  holder.innerHTML=html;
  // 2: one drawing (or one line past the cap) per cut-list row, in cut-list order, none without a row
  const anchors=[...holder.querySelectorAll('figure.part-fig, li[id^="part-"]')].map(node=>node.id.replace(/^part-/,''));
  const figuresInOrder=[...holder.querySelectorAll('figure.part-fig:not(.small-part)')].map(node=>node.dataset.letter);
  for(const row of rows){
    const count=anchors.filter(id=>id===row.id).length;
    if(count!==1)say('everyPieceHasOneDrawing',`${row.id} has ${count} drawings`);
  }
  for(const id of anchors)if(!letters.has(id))say('everyPieceHasOneDrawing',`a drawing of ${id}, which the cut list has not`);
  // a row with something to make (holes, a shape, words of its own) is never only listed past the cap
  for(const row of rows){
    const busy=(row.sample&&row.sample.shape)||drill.labels.some(label=>label.letter===row.id)||shopMakeOf(row,plan).length>0;
    if(busy&&!holder.querySelector(`figure#part-${row.id}`))say('everyPieceHasOneDrawing',`${row.id} has something to make and no drawing (past the cap of ${PART_DRAWINGS_MAX})`);
  }
  const order=rows.map(row=>row.id).filter(id=>figuresInOrder.includes(id));
  if(order.join(',')!==figuresInOrder.join(','))say('everyPieceHasOneDrawing',`the drawings are in the order ${figuresInOrder.join(', ')}, not the cut list's`);
  // each drawn drill label is inside the drawing of its letter; a mirror twin of a shape and a drill mirror pair agree
  for(const label of drill.labels){
    if(!label.drawn||label.mirror||!label.way)continue;
    const figure=holder.querySelector(`#part-${label.letter}`);
    if(!figure||!figure.querySelector(`.drill-fig[data-label="${label.name}"]`))say('everyPieceHasOneDrawing',`the drilling of ${label.name} is not on the drawing of ${label.letter}`);
  }
  for(const row of rows){
    if(!row.mirrored)continue;
    const pair=drill.labels.find(label=>label.letter===row.id&&label.mirrorLabel);
    if(pair&&![row.mirrored,row.qty-row.mirrored].includes(pair.mirrorLabel.members.length))say('everyPieceHasOneDrawing',`${row.id}: the shape has ${row.mirrored} mirror images, the drilling ${pair.mirrorLabel.members.length}`);
  }
  // 1 (d): every shaped row's shape, every moved sentence and every Also cut line is on the page, on its drawing
  for(const row of rows){
    const figure=holder.querySelector(`figure#part-${row.id}`);
    if(!figure)continue;
    if(row.sample&&row.sample.shape&&!figure.querySelector('.shape-cut'))say('partMakingOnlyOnTheCutPage',`the shape of ${row.id} is not on its drawing`);
    for(const entry of shopMakeOf(row,plan)){
      // (a sentence whose sizes the shape block gives keeps its other words: they are on the drawing, and every
      //  number of it is in the shape block)
      const shapeGives=row.sample&&row.sample.shape&&entry.shapeSays;
      if(!shapeGives){
        if(!figure.textContent.includes(entry.words))say('partMakingOnlyOnTheCutPage',`the drawing of ${row.id} does not say "${entry.words.slice(0,60)}"`);
        continue;
      }
      // (the sentence may speak of several pieces, the toy chest's front and sides: every size it gives is in this
      // drawing's words or in the shape block of one of those pieces, so nothing is lost by leaving a sentence out)
      const block=[...holder.querySelectorAll('.shape-cut')].map(node=>node.textContent).join(' ');
      const missing=(entry.words.match(SIZE_WORDS)||[]).find(size=>!block.includes(size)&&!figure.textContent.includes(size));
      if(missing)say('partMakingOnlyOnTheCutPage',`the drawing of ${row.id} leaves out ${missing} of "${entry.words.slice(0,50)}"`);
      // and the sentences that give no size (the reason, the tip) are all on it
      for(const sentence of String(entry.words).split(/(?<=[.!?])\s+/).filter(one=>!/\d/.test(one)))
        if(!figure.textContent.includes(sentence))say('partMakingOnlyOnTheCutPage',`the drawing of ${row.id} does not say "${sentence.slice(0,60)}"`);
    }
    if(shopMakeOf(row,plan).some(entry=>entry.holes==='drain')&&figure.querySelectorAll('svg.pp circle').length<5)say('partMakingOnlyOnTheCutPage',`the drain holes of ${row.id} are not drawn`);
  }
  // 1 (d): every cup hole and pull hole of the hardware lines is on the drawing of the piece it is drilled in, with
  // its words and its marking view, and the step only fits the hardware (spec 14, 12.1 d)
  for(const step of plan.steps)for(const row of step.hardware){
    if(row.kind!=='cup'&&row.kind!=='pull')continue;
    if(!row.make){say('partMakingOnlyOnTheCutPage',`step ${step.no}: the holes of its ${row.kind} line are drilled in the step, not on a part drawing`);continue;}
    for(const letter of new Set(row.hosts.map(host=>plan.letterOf(host)))){
      const figure=holder.querySelector(`figure#part-${letter}`);
      if(!figure||!figure.textContent.includes(row.make.slice(0,60))||!figure.querySelector('.pf-marks'))say('partMakingOnlyOnTheCutPage',`the ${row.kind==='cup'?'cup holes':'holes for the pull'} of step ${step.no} are not on the drawing of ${letter}`);
    }
    if(/\bdrill\b/i.test(row.line))say('partMakingOnlyOnTheCutPage',`step ${step.no}: its ${row.kind} line still tells to drill: "${row.line.slice(0,90)}"`);
  }
  const text=holder.textContent;
  for(const line of alsoCutLines(plan))if(!text.includes(line))say('partMakingOnlyOnTheCutPage',`Also cut does not say "${line.slice(0,60)}"`);
  if(drill.total&&!text.includes(`When you are done: ${drill.total} `))say('packetCountsMatchTheShoppingList','the packet has no count line for its holes');
  // 3: every "part drawing X" link of the steps has its anchor in the packet
  for(const step of plan.steps)for(const group of step.groups){
    for(const[,label]of linkPartWords(esc(group.where||'')).matchAll(/data-part="([A-Z]{1,2}\d*)"/g))
      if(!holder.querySelector(`#part-${label}`))say('everyLetterIsInThePartsList',`step ${step.no}, line ${group.no} links to part drawing ${label}, which the Cut list page has not`);
  }
  // 5: every step number the packet names is a step of the design
  // (every number of a list, "steps 3, 4 and 5")
  for(const[,list]of text.matchAll(/\b[Ss]teps? (\d+(?:(?:, | and )\d+)*)/g))for(const no of list.split(/, | and /))
    if(+no<1||+no>plan.steps.length)say('assemblyStepsNumberedFromOne',`the packet names step ${no}, and there are ${plan.steps.length} steps`);
  // each step a moved sentence, a small part or a hole of hardware names is a step that uses that piece
  // (the entries whose drawing prints the step: the holes of hardware, the pencil lines with their view)
  for(const entry of plan.shop.make)if(entry.step&&(entry.kind==='hardware'||(entry.kind==='mark'&&entry.view))){
    const step=plan.steps[entry.step-1];
    const pieces=new Set(S.parts.filter(p=>entry.on.includes(p.name)).map(p=>p.id));
    const uses=step&&(step.pieces.some(p=>pieces.has(p.id))||(step.brought||[]).some(p=>pieces.has(p.id))||step.groups.some(group=>group.links.some(link=>pieces.has(link.a.id)||pieces.has(link.b.id)))||step.hardware.some(row=>row.items.some(item=>pieces.has(item.on)||pieces.has(item.to))));
    if(!uses&&pieces.size)say('assemblyStepsNumberedFromOne',`the drawing of the ${entry.on[0]} names step ${entry.step}, which does nothing with it`);
  }
  // 4: the plug pieces of Also cut are the plugs that take dowel rod
  // (the plugs cut from a dowel rod are a small part, Plug: their count is read from its drawing)
  const dowelPlugs=S.parts.length?connGraph().links.filter(link=>link.joint&&link.fastened&&link.type==='plug').flatMap(link=>fastenersOfLink(link)).filter(f=>f.plug&&f.sunk>0&&plugIsDowel(f.sunk)).length:0;
  const plugsDrawn=[...holder.querySelectorAll('figure.small-part')].filter(node=>/^Plug$/.test((node.querySelector('.pf-what b')||{}).textContent||''))
    .reduce((sum,node)=>sum+(+((node.querySelector('.pf-what span')||{}).textContent||'').replace(/^make (\d+).*$/,'$1')||0),0);
  if(drill.complete&&dowelPlugs!==plugsDrawn)say('packetCountsMatchTheShoppingList',`${dowelPlugs} plugs take dowel rod, the drawings of the plugs make ${plugsDrawn}`);
  // every small part has its drawing on the page
  for(const part of plan.shop.parts||[])if(!holder.querySelector(`figure#part-${part.id}.small-part`))say('smallPartsAreParts',`the small part ${part.id} has no drawing`);
  return found;
}
const SHOP_CHECKS=['partMakingOnlyOnTheCutPage','everyPieceHasOneDrawing','everyLetterIsInThePartsList','packetCountsMatchTheShoppingList','assemblyStepsNumberedFromOne','smallPartsAreParts'];
/* The owner's rule of 20 Nov 11:20 PM, read in some words: a sentence that tells to cut (or make, or trim a piece of)
   a small thing (a block, a scrap, a spacer, a shim, a plug, a cleat, a piece of dowel) and names no part for it
   ("part K"). Fitting done at assembly (AT_ASSEMBLY_WORK: the spacer block cut shorter) is allowed. */
const SMALL_CUT_ORDER=/\b(?:cut|make|trim)\s+(?:a|an|one|two|three|four|\d+|some|the)?\s*(?:scraps?|(?:\w+ )?blocks?|spacers?|shims?|plugs?|cleats?|stops?|pieces? of (?:scrap|dowel|plywood|wood|3\/8" dowel))\b|\bscraps of\b/i;
function smallCutsLeft(text){
  return String(text||'').split(/(?<=[.!?])\s+/).filter(sentence=>SMALL_CUT_ORDER.test(sentence)&&!/\bparts? [A-Z]{1,2}\b/.test(sentence)&&!atAssemblyWhy(sentence));
}
/* The designs read: every preset at its defaults in the three styles, every variant, and the smallest and largest
   sizes of the designs spec 11 tries (drillCheckRuns, js/partdrawings.js). The packet is drawn and read for every
   preset at its defaults in Everyday; for the rest the steps and the plan are read. The pass of the drill checks
   (drillCheckPass) visits each design once and calls shopCheckVisit, so the designs are built once for both. */
let shopCheckFound=null,shopCheckCollect=null;
function shopCheckStart(){shopCheckCollect={found:Object.fromEntries(SHOP_CHECKS.map(name=>[name,[]])),designs:0};shopMovesUsed=new Set();}
function shopCheckVisit(plan,run){
  if(!shopCheckCollect)shopCheckStart();
  const found=shopCheckCollect.found;
  shopCheckCollect.designs++;
  try{
    // (the packet is drawn and read for every preset at its defaults in all three styles, and at the smallest and
    //  largest sizes the drill checks try: the code reviewer's finding 11)
    const full=run.extreme||run.preset.name===run.name.replace(/ \((?:Everyday|Fine furniture|Rustic \/ rough)\)$/,'');
    for(const problem of shopDesignProblems(plan,full))if(found[problem.check].length<12)found[problem.check].push(`${run.name}: ${problem.text}`);
  }catch(e){found.partMakingOnlyOnTheCutPage.push(`${run.name}: stopped: ${e.message}`);}
}
/* the same pass on its own, when the drill checks did not make it (a check run by itself) */
function shopCheckPass(){
  shopCheckStart();
  withoutDrawing(()=>{
    for(const run of drillCheckRuns()){
      let placed=false;
      try{placed=placeInStyle(run.preset,{...run.vals},run.style);}catch(e){placed=false;}
      if(placed)shopCheckVisit(buildPlan(true),run);
    }
  });
  return shopCheckCollect;
}
for(const name of SHOP_CHECKS){
  SELFTESTS.push({[name](problems){
    // (the first of the five takes what the drill pass found, or makes the pass; the others read it)
    if(name===SHOP_CHECKS[0]||!shopCheckFound){
      const kept=JSON.stringify(S);
      try{
        const collected=shopCheckCollect&&shopCheckCollect.designs?shopCheckCollect:shopCheckPass();
        shopCheckFound=collected.found;
        shopMovesSeen=shopMovesUsed;shopMovesUsed=null;
        if(collected.designs<100)problems.push(`shop packet: only ${collected.designs} designs were read, the check reads too few`);
      }finally{shopCheckCollect=null;load(kept,true);}
    }
    for(const text of shopCheckFound[name])problems.push(`shop packet, ${name}: ${text}`);
    // (the page itself, on two designs: the Build instructions page holds no part drawing and no shop section)
    if(name==='partMakingOnlyOnTheCutPage'){
      const kept=JSON.stringify(S),tabKept=tab;
      try{
        // (the designs with marking views, a shaped part with holes, a fish stand with doors: the code reviewer's 27)
        for(const preset of PRESETS.filter(candidate=>['Desk','Dining chair','Cabinet / case','Garage shelves','Base cabinet with doors','Computer desk','Single aquarium stand','Nightstand with drawers'].includes(candidate.name))){
          placePreset(preset,presetDefaults(preset),preset.build(presetDefaults(preset)),false);
          renderCut(true);
          const page=$('#instrPage');
          if(page.querySelector('.part-fig,.drill-fig,.shape-cut,.markviews'))problems.push(`shop packet: the Build instructions page of the ${preset.name} holds a part drawing or a marking view`);
          const headings=[...page.querySelectorAll('h2')].map(node=>node.textContent.trim());
          for(const heading of['Cut list','Shapes to cut','Cutting diagrams','Shopping list','Part drawings'])if(headings.includes(heading))problems.push(`shop packet: the Build instructions page of the ${preset.name} has the section "${heading}"`);
          if(!page.querySelector('.shop-first a[data-part]'))problems.push(`shop packet: the Build instructions page of the ${preset.name} does not start its steps with the line that the parts are made first, with a link`);
          // no note on the page tells to make a part (those notes are on the Cut list page)
          const notesHead=[...page.querySelectorAll('h2')].find(node=>node.textContent.trim()==='Notes');
          const noteTexts=notesHead&&notesHead.nextElementSibling?[...notesHead.nextElementSibling.querySelectorAll('li')].map(node=>node.textContent):[];
          const making=noteTexts.flatMap(note=>makeOrdersLeft(note,null));
          if(making.length)problems.push(`shop packet: a note on the Build instructions page of the ${preset.name} tells to make a part: "${making[0].slice(0,90)}"`);
          renderCut(false);
          if(!$('#cutPage').querySelector('#partDrawings figure.part-fig'))problems.push(`shop packet: the Cut list page of the ${preset.name} has no part drawings`);
        }
      }finally{load(kept,true);if(tabKept!==tab)setTab(tabKept);}
    }
  }}[name]);
}
/* Every row of SHOP_MOVES moved something in the pass over the designs (a row whose preset reworded its sentence
   matches nothing any more, and the sentence would stay in a step unseen: the code reviewer's finding 18). A row
   kept only for designs saved with older words says so (old: true). */
let shopMovesSeen=null;
SELFTESTS.push(function shopMovesAllUsed(problems){
  if(!shopMovesSeen){
    const kept=JSON.stringify(S);
    try{shopCheckPass();shopMovesSeen=shopMovesUsed;shopMovesUsed=null;}finally{load(kept,true);}
  }
  // (a seldom row is proved on its own sentence instead: its `sample`, else the fish stands' panel stud sentence)
  for(const row of SHOP_MOVES)if(row.seldom&&!row.test.test(row.sample||`stand a 2x4 panel stud on the bottom deck behind it, narrow edge to the back, cut 1/8" short of the frame above, and screw it to the deck (one in all).`))problems.push(`shop packet: the seldom row ${String(row.test).slice(1,60)} does not match its own sentence`);
  for(const row of SHOP_MOVES)if(!row.old&&!row.seldom&&!shopMovesSeen.has(row))problems.push(`shop packet: the row of SHOP_MOVES ${String(row.test).slice(1,70)} matched no step of any design: its preset words changed, or the row is dead`);
});
/* The words of making are found however a sentence puts them (the code reviewer's finding 7), each proved on a
   made-up sentence; a fitting row lets through only its own case; a small thing cut in passing is caught. */
SELFTESTS.push(function makingWordsAreFound(problems){
  const wrong=text=>problems.push('shop packet: '+text);
  const orders=['Carefully cut a notch in the rail.','With a jigsaw cut the arch out of the leg.','You cut the corner off the top.','Trim the ends square.',
    'Round the front edge with a block plane.','Countersink each hole.','The top of each of their studs is cut at 18.4 degrees.','Shape the end to a point.',
    'Draw a line across the face, 2" from the end.','Ease every edge with sandpaper.','Lay the two sides together and mark the shelf places.','Then drill for the pulls.'];
  for(const sentence of orders)if(!makeOrders(sentence).length)wrong(`the order of making in "${sentence}" is not found`);
  for(const sentence of['Glue and clamp the frame.','Set the drill to its lowest speed.','The pieces are square.'])if(makeOrders(sentence).length)wrong(`"${sentence}" is read as an order of making`);
  // a fitting row lets its own case through, not a sentence that only mentions its word
  const bare={groups:[],hardware:[]};
  if(!makeOrdersLeft('Cut a notch and drill pilot holes in it.',bare).length)wrong('"Cut a notch and drill pilot holes in it." is let through by the pilot-hole row');
  if(!makeOrdersLeft('Drill pilot holes first: the strips are thin and split easily.',bare).length)wrong('a pilot hole the drawings drill ahead is let through');
  if(makeOrdersLeft('Glue each corner, then nail through the sides with brads (drill a thin pilot hole first if you use a hammer).',bare).length)wrong('the pilot hole of a brad is taken for part making');
  if(makeOrdersLeft('Cut the block shorter for the next pair down.',bare).length)wrong('cutting the spacer block shorter, a fitting, is taken for part making');
  // a small thing cut in passing, and one that is a part
  if(!smallCutsLeft('Cut a scrap block 4" long and stand it on the shelf.').length)wrong('a scrap block cut in passing is not caught');
  if(smallCutsLeft('Stand the two shelf blocks (part K, 7 1/4" long) on the bottom panel.').length)wrong('a block that is a part is caught as cut in passing');
});
/* 6. old saved designs: opened today, no step makes a part, and the cutting is in the packet */
SELFTESTS.push(function oldDesignsMakeNothingTwice(problems){
  const keepSay=sayFasteningUpgrade,kept=JSON.stringify(S);
  sayFasteningUpgrade=()=>{};
  try{withoutDrawing(()=>{
    for(const[name,project]of Object.entries(OLD_PROJECTS)){
      load(JSON.stringify(project),true);
      const plan=buildPlan(true);
      if(!plan.shop.cutWords)problems.push(`shop packet: the old ${name} has no cutting in its packet`);
      for(const step of plan.steps){
        if(step.kind==='finish')continue;
        const left=makeOrdersLeft(step.words,step);
        if(left.length){problems.push(`shop packet: the old ${name} opened today still makes a part in step ${step.no}: "${left[0].slice(0,90)}"`);break;}
      }
      if(plan.steps.some(step=>step.kind==='cut'||step.kind==='drill'))problems.push(`shop packet: the old ${name} still has a cutting or drilling step`);
    }
    // a saved step with the words of today's presets moves them; with words no row knows, the design is written again
    const shelf=PRESETS.find(candidate=>candidate.name==='Cabinet / case');
    if(shelf){
      placeInStyle(shelf,presetDefaults(shelf),'std');
      const old=JSON.parse(JSON.stringify(S));
      old.fastening=6;
      const step=(old.steps||[]).find(one=>/mark the shelf positions/.test(stepText(one)));
      if(!step)problems.push('shop packet: the Cabinet / case has no step that marks the shelf positions to test with');
      else{
        step.t='Mark the shelf positions on both sides with a pencil, measured from the bottom.';
        if(!shopLeavesMakeWords(step))problems.push('shop packet: a saved step that tells to mark the sides in words no row knows is not found');
        // opened, it is written again from its preset, and the packet moves today's words: nothing is made in a step
        // (saved under 6, and under 8, the rule of the published program before the packet: FASTENING_NOW 9)
        for(const savedUnder of[6,8]){
          load(JSON.stringify({...old,fastening:savedUnder}),true);
          const left=buildPlan(true).steps.filter(one=>one.kind!=='finish').flatMap(one=>makeOrdersLeft(one.words,one));
          if(left.length)problems.push(`shop packet: a Cabinet / case saved under rule ${savedUnder} with older marking words still makes a part when opened: "${left[0].slice(0,90)}"`);
        }
      }
    }
  });}finally{sayFasteningUpgrade=keepSay;load(kept,true);}
});
/* 7. the packet follows edits: the Desk 60" wide, a short apron deleted, a 2x4 added by hand with pocket screws, a
   design drawn from scratch: the drawings, the Drawing column and the steps follow */
SELFTESTS.push(function shopPacketFollowsEdits(problems){
  const wrong=text=>problems.push('shop packet: '+text);
  const kept=JSON.stringify(S);
  const read=label=>{
    const plan=buildPlan(true),list=cutRows(),html=partDrawingsSection(list,plan);
    const figures=(html.match(/<figure class="part-fig"/g)||[]).length;
    if(figures!==list.rows.length)wrong(`${label}: ${figures} drawings for ${list.rows.length} cut-list rows`);
    if(plan.steps.some((step,index)=>step.no!==index+1)||plan.steps.some(step=>step.kind==='cut'||step.kind==='drill'))wrong(`${label}: the steps are not the assembly steps numbered from 1`);
    return{plan,list,html};
  };
  try{withoutDrawing(()=>{
    const desk=PRESETS.find(candidate=>candidate.name==='Desk');
    placeInStyle(desk,{...presetDefaults(desk),L:60},'std');
    read('the Desk 60" wide');
    const apron=S.parts.find(p=>p.name==='Short apron');
    S.parts=S.parts.filter(p=>p!==apron);commit();
    read('the Desk with a short apron deleted');
    const aprons=S.parts.filter(p=>p.name==='Long apron').map(plainBox);
    const zLow=Math.min(aprons[0].hi[2],aprons[1].hi[2]),zHigh=Math.max(aprons[0].lo[2],aprons[1].lo[2]);
    const[braceId]=addParts([mk('Brace','2x4',[1.5,3.5,zHigh-zLow],[aprons[0].lo[0]+12,aprons[0].lo[1],zLow])]);
    for(const j of findJoints())if(j.a.id===braceId||j.b.id===braceId)S.joints[j.key]='pocket';
    commit();
    const{plan,list}=read('the Desk with a brace added by hand');
    const row=list.rows.find(one=>one.names.has('Brace'));
    if(!row||!/pocket holes/.test(drawingColumnText(row,plan)))wrong(`the Drawing column of a brace added by hand says "${row?drawingColumnText(row,plan):'nothing'}"`);
    load(JSON.stringify(blank()),true);
    // two boards joined, and a third standing apart with nothing to make but its cut
    addParts([mk('Side','1x4',[.75,24,3.5],[0,0,0]),mk('Shelf','1x4',[18,.75,3.5],[.75,10,0]),mk('Spare','1x6',[30,.75,5.5],[60,0,0])]);
    commit();
    const scratch=read('boards drawn by hand');
    const spare=scratch.list.rows.find(row=>row.names.has('Spare'));
    if(!spare||!/cut to size/.test(drawingColumnHtml(spare,scratch.plan)))wrong('a plain board drawn by hand is not "cut to size" in the Drawing column');
    if(!/<svg class="pd pp"/.test(scratch.html))wrong('a plain board drawn by hand has no outline drawing');
    if(!scratch.plan.shop.cutWords||scratch.plan.steps[0].kind!=='build')wrong('a design drawn by hand does not start with putting a piece in');
  });}finally{load(kept,true);}
});
