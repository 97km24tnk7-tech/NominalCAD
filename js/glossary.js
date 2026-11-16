/* NominalCAD: woodworking words, explained for someone to whom it is all just wood.

   TERMS is the whole vocabulary. An entry with `match` explains a kind of piece: termFor('Long apron') finds
   the Apron entry. Entries without `match` are general words (pilot hole, flush, nominal size).
   The explanations show up in four places, all meant for Beginner (js/level.js) and hidden in Expert:
     - "Words used in this design" at the top of the Cut list and Build instructions pages (wordsSection),
       with a Show me button that picks those pieces out in the 3D view;
     - one line in Properties when a single piece is selected (termLine);
     - a tip when the pointer rests on a piece name in the Pieces list or on a page;
     - the Woodworking words window (openWords), from Help or the button beside the Beginner / Expert switch,
       which is there at both levels.

   To add a word: add an entry to TERMS. Piece entries are tried from the top, so put the more exact name first
   ("Wall cleat" above "Cleat"). selfTest() fails if a preset uses a piece name that no entry explains.
   Write for a first-time builder: where the piece is, then what it does, in one or two sentences, and use no
   other trade word unless it is explained in the same sentence. Sizes are written like 1-1/2 inch. */
'use strict';

const TERM_GROUPS=[
  ['parts','Parts of furniture'],
  ['shed','Parts of a shed'],
  ['bought','Things you buy, shown for fit'],
  ['join','Joining pieces'],
  ['measure','Measuring and cutting'],
  ['lumber','Lumber, sheets and finishing']];

const TERMS=[
  /* ---- pieces: the more exact name first ---- */
  /* Two-word names that would otherwise fall into a general entry further down (a "Door stile" is not a door,
     a "Rafter tie" is not a rafter). Each is written from how its builder really makes it. */
  {word:'Door stile',group:'parts',match:/\bdoor stile\b/i,
    what:'An upright piece in the front of a wide cabinet, between two pairs of doors. It runs from the bottom shelf up to the frame above and helps hold that frame up, and the doors on each side of it are hinged to it.'},
  {word:'Panel stud',group:'parts',match:/\bpanel stud\b/i,
    what:'An upright 2x4 inside a cabinet base, standing where two thin panels meet and no post or upright is there: inside the end of a tall cabinet, halfway between the front post and the back post, or against the back where a bay is wider than a sheet of plywood. Both panels are nailed to this piece where they meet.'},
  {word:'Filler block',group:'parts',match:/\bfiller block\b/i,
    what:'A short block fastened to the outside of a rail in a tank rack, where a shelf frame is narrower than the rack is deep. It brings the frame out to the full depth at that spot, so the upright of the row above stands on solid wood.'},
  {word:'Back rail',group:'parts',match:/\bback rail\b/i,
    what:'A board standing on its edge across the back of a cabinet or bookshelf, right under the top. The screws that hold the piece to the wall go through it, and it helps keep the cabinet or bookshelf from leaning sideways.'},
  {word:'Base rail',group:'parts',match:/\bbase rail\b/i,
    what:'A board standing on its edge under the bottom panel of a cabinet or bookshelf, along the back. Together with the toe kick (the board under the front edge) it holds up the bottom panel so it cannot sag.'},
  {word:'Cross rail',group:'parts',match:/\bcross rail\b/i,
    what:'A board that runs across a table, desk or bench under the top, from one long apron to the other (the aprons are the boards on edge between the legs). The top rests on it and is fastened to it, so the top cannot sag in the middle.'},
  {word:'Shelf rail',group:'parts',match:/\bshelf rail\b/i,
    what:'A board that runs across under the lower shelf of a table or workbench, from one long stretcher to the other (the stretchers are the boards that join the legs near the floor). The shelf rests on it, so it cannot sag.'},
  {word:'Slat cleat',group:'parts',match:/\bslat cleat\b/i,
    what:'A thin strip screwed along the inside of each long wall of a planter, at the bottom. The bottom boards lie across on the two strips and are screwed down to them, which holds up the soil and holds the two walls together.'},
  {word:'Cross tie',group:'parts',match:/\bcross tie\b/i,
    what:'A board across a raised garden bed from one long side to the other, on its edge, with its top level with the top of the bed. Wet soil pushes the long sides outward, and the tie holds them together. You can plant right up to it and under it.'},
  {word:'Middle post',group:'parts',match:/\bmiddle post\b/i,
    what:'An extra upright piece screwed to the inside of a long side of a raised garden bed, partway along, opposite one on the other side. It joins the boards of that side to each other, and a board across the bed between the two posts stops the soil from pushing the sides outward.'},
  {word:'Middle leg',group:'parts',match:/\bmiddle leg\b/i,
    what:'An extra leg partway along each long wall of a long planter, screwed to the inside of the wall like the corner posts and reaching the ground. It holds up the middle of the wall and joins its boards together, so the soil cannot bow the wall outward.'},
  {word:'Divider',group:'parts',match:/\bdivider\b/i,
    what:'An upright board inside a wide bookshelf, standing on the floor like the two sides. It splits the width into shorter shelves, because a long shelf sags under a row of books.'},
  {word:'Partition',group:'parts',match:/\bpartition\b/i,
    what:'An upright panel in the middle of a wide cabinet, standing on the floor like the two sides. It holds up the middle of the cabinet, so no shelf has to reach the whole width and sag.'},
  {word:'Trimmer stud',group:'shed',match:/\btrimmer stud\b/i,
    what:'A shorter upright board on each side of a door or window opening, nailed to the full-height upright beside it. The header, which is the strong piece across the top of the opening, sits on top of the two trimmer studs.'},
  {word:'Gable stud',group:'shed',match:/\bgable stud\b/i,
    what:'A short upright board in the triangle of wall under a peaked roof, at each end of the shed. It stands on top of the end wall and its top is cut on a slant to fit under the roof. The one in the middle holds up the end of the board along the peak.'},
  {word:'Rafter tie',group:'shed',match:/\brafter tie\b/i,
    what:'A board laid level across the shed from the top of the front wall to the top of the back wall, nailed to the side of a pair of the sloping roof boards (the rafters). A peaked roof pushes the two walls apart, and the ties hold them together, so never leave one out. A roof with a single slope has none.'},
  {word:'Ridge board',group:'shed',match:/\bridge board\b/i,
    what:'The level board along the very top of a peaked roof, running the length of the shed. The top ends of the sloping roof boards (the rafters) are nailed to it from both sides, each one opposite its partner.'},
  {word:'Rake plate',group:'shed',match:/\brake plate\b/i,
    what:'The sloping board along the top of each side wall of a shed whose roof has a single slope. It is nailed across the tops of the upright boards of that wall, which get longer toward the high wall, and the last sloping roof board at each end lies on it.'},
  {word:'Cap plate',group:'shed',match:/\bcap plate\b/i,
    what:'A second board nailed flat on top of the board that runs along the top of a wall frame. At a corner it runs on over the end of the next wall, and that overlap ties the walls together. The sloping roof boards (the rafters) sit on it.'},
  {word:'Blocking',group:'shed',match:/\bblocking\b/i,
    what:'Short pieces of 2x4 nailed between the upright boards of a wall, on edge and flush with the outside. They go behind a level joint between two sheets of the plywood that covers the wall, so the edges of both sheets have wood to be nailed to.'},
  {word:'Wall sheathing',group:'shed',match:/\bsheathing\b/i,
    what:'The sheets of plywood nailed over the outside of the wall frames. They close the walls in, and they are what stops the shed from leaning over sideways, so each sheet is nailed all the way around its edges.'},
  {word:'Drawer front',group:'parts',match:/^drawer front$/i,
    what:'The face of a drawer that you see: a board screwed onto the front of the drawer box from inside the drawer. It covers the gap around the box and carries the handle.'},
  {word:'Drawer box',group:'parts',match:/^drawer (box|side|bottom)/i,
    what:'The box that slides in and out: two sides, a front, a back and a thin bottom. It carries what you put in the drawer. It rides on metal runners called drawer slides, one screwed along each side, or on plain strips of wood called drawer runners.'},
  {word:'Toe kick',group:'parts',match:/\btoe kick\b/i,
    what:'The board under the front of a cabinet, set back an inch or two so your toes fit under the cabinet when you stand close. It also holds up the front of the bottom panel.'},
  {word:'Apron',group:'parts',match:/\bapron\b/i,
    what:'A board standing on its edge between two legs, right under the top. Aprons tie the legs together so a table or bench cannot wobble, and the top is fastened to them. Long aprons run the length, short aprons run across the ends. On a five-board bench the two aprons lie over the outside edges of the legs instead of fitting between them.'},
  {word:'Stretcher',group:'parts',match:/\bstretcher\b/i,
    what:'A board that runs from leg to leg lower down, nearer the floor. It keeps the legs from spreading or leaning, and often carries a lower shelf.'},
  {word:'Wall cleat',group:'parts',match:/\bwall cleat\b/i,
    what:'A strip of wood screwed flat to the wall, into the upright boards inside the wall (the wall studs). The shelf sits on it or is screwed to it, so the wall carries the weight. Screws into drywall alone pull out.'},
  {word:'Cleat',group:'parts',match:/\bcleat\b/i,
    what:'A strip of wood fastened to one piece so that another piece can rest on it. On a bed, a cleat runs along the inside of each long side board, and the cross boards that hold up the mattress sit on the cleats.'},
  {word:'Slat',group:'parts',match:/\bslat\b/i,
    what:'One of a row of narrow boards laid side by side with gaps between them, to make a shelf, the base of a bed or the bottom of a planter. The gaps save wood and let air or water through.'},
  {word:'Deck',group:'parts',match:/\bdeck\b/i,
    what:'A sheet of plywood laid flat over a frame to make one solid surface. A shelf deck is the top of a shelf frame, where the tanks or boxes stand, a floor deck is the floor of a shed, and a roof deck is what the roofing is nailed to.'},
  {word:'Shelf',group:'parts',match:/\bshelf\b/i,
    what:'A flat piece that things sit on. It is held at its two ends by the upright sides, or it rests on the boards under it.'},
  {word:'Top',group:'parts',match:/\bcountertop\b|^top( board)?$/i,
    what:'The flat surface you use, on top of everything else. "Top board" means the top is made of several boards laid side by side.'},
  {word:'Brace',group:'parts',match:/\bbrace\b/i,
    what:'A board fastened on a slant across the back of a frame, from a bottom corner to the opposite top corner. Without it the frame can lean over sideways, the way a cardboard box with no ends folds flat.'},
  {word:'Cross piece',group:'parts',match:/\bcross piece\b/i,
    what:'A short board that runs from front to back between the two long boards of a frame. It holds them the right distance apart and keeps them from twisting under weight.'},
  {word:'Beam',group:'parts',match:/\bbeam\b/i,
    what:'A long, strong board that carries weight across an open space. The center beam of a bed runs from head to foot down the middle and holds up the middle of the boards under the mattress.'},
  {word:'Top plate and bottom plate',group:'shed',match:/\b(top|bottom) plate\b/i,
    what:'The two horizontal boards of a wall frame. The bottom plate lies on the floor, the top plate runs along the top, and the upright boards of the wall (the studs) stand between them.'},
  {word:'Rim joist',group:'shed',match:/\brim joist\b/i,
    what:'A board along the outside edge of a floor frame. The ends of the floor joists (the boards that carry the floor) are fastened to it.'},
  {word:'Floor joist',group:'shed',match:/\bjoist\b/i,
    what:'One of the boards standing on edge under a floor, evenly spaced, that carry the floor and everything on it.'},
  {word:'Stud',group:'shed',match:/\bstud\b/i,
    what:'An upright board in a wall frame. Studs are spaced evenly, usually 16 or 24 inches from the middle of one to the middle of the next, and carry the weight of the roof down to the floor.'},
  {word:'Cripple',group:'shed',match:/\bcripple\b/i,
    what:'A short upright board (a short stud) above a door or window opening, or below a window. It fills the space so the wall covering has something to be nailed to.'},
  {word:'Header',group:'shed',match:/\bheader\b/i,
    what:'A strong horizontal piece over a door or window opening. It carries the weight from above across the opening to the upright boards (studs) on each side.'},
  {word:'Sill',group:'shed',match:/\bsill\b/i,
    what:'The horizontal board along the bottom of a window opening. The window rests on it.'},
  {word:'Skid',group:'shed',match:/\bskid\b/i,
    what:'A heavy piece of lumber, such as a 4x4, laid on the ground or on blocks, that the whole shed sits on. Skids keep the floor off the dirt and make the shed easier to level. Use pressure-treated lumber, because ordinary wood rots where it touches the ground.'},
  {word:'Rafter',group:'shed',match:/\brafter\b/i,
    what:'One of the sloping boards that hold up the roof, evenly spaced. On a roof with a single slope (a lean-to), each rafter runs from the top of the low back wall up to the top of the high front wall. On a peaked roof (a gable), rafters come in pairs: one from the front wall and one from the back wall, each nailed at its top end to the board that runs along the peak.'},
  {word:'Rim',group:'parts',match:/\brim\b/i,
    what:'A low strip around the edge of a tray. It keeps things from sliding off.'},
  {word:'Top rail',group:'parts',match:/\btop rail\b/i,
    what:'A strip of wood across the top of a cabinet, from one side to the other: one at the front and one at the back. The two top rails hold the sides the right distance apart, and the top is screwed to them from underneath, so no screw shows on top.'},
  {word:'Rail',group:'parts',match:/\brail\b/i,
    what:'A horizontal board in a frame. In a tank rack the rails run left to right and carry the weight of the tanks to the upright posts. In a cabinet the top rails tie the two sides together and the top is screwed to them. On a bed the side rails and end rails make the frame around the mattress.'},
  {word:'Corner post',group:'parts',match:/\bcorner post\b/i,
    what:'An upright piece inside each corner of a planter or garden bed. The side boards are screwed to it, and that is what holds the corner together.'},
  // "Post" by itself is the long corner piece of the garage shelves, the racks and the stands, whose frames ARE
  // screwed to its side: the general entry below (weight rests on top, never on screws) would read as if those
  // designs were built wrong.
  // the two short uprights of the bird feeder: the general entry for an upright talks about the floor and fish tanks
  {word:'Roof post',group:'parts',match:/^roof post$/i,
    what:'One of the two short uprights that stand on the tray of a bird feeder, one at each end, and hold the roof up over the seed.'},
  {word:'Post',group:'parts',match:/^post$/i,
    what:'An upright board at a corner or an end that runs the whole height of a shelf unit, a rack or a stand. The shelf frames are screwed to its side, and that holds the whole thing together and square. On shelves for boxes and tools the posts also carry the shelves down to the floor. Under fish tanks the weight rests on separate uprights that stand between the frames, wood on wood.'},
  {word:'Upright',group:'parts',match:/\b(upright|post)\b/i,
    what:'A piece standing straight up that carries weight down to the floor. Under a heavy load such as a fish tank, the frame above rests on top of it, wood on wood, so the weight does not hang from screws.'},
  {word:'Leg',group:'parts',match:/\bleg\b/i,
    what:'An upright piece that holds the furniture up off the floor. A center leg is an extra one in the middle so a long piece does not sag.'},
  {word:'Foot',group:'parts',match:/\bfoot\b/i,
    what:'A piece at the very bottom that an upright stands on. It spreads the weight over more of the floor.'},
  {word:'Side panel',group:'parts',match:/\bside panel\b/i,
    what:'A thin sheet that covers the side of a frame to close it in. It is there for looks and to keep things in. It does not hold anything up.'},
  {word:'Back panel',group:'parts',match:/\bback( panel)?$/i,
    what:'The sheet across the back of a cabinet, bookshelf or box. It closes the back and, more important, it keeps the whole thing square so it cannot lean over sideways.'},
  {word:'Side, end and front',group:'parts',match:/^(side|long side|end|front)$/i,
    what:'The upright walls of a cabinet, bookshelf or box. A cabinet has a left and a right side, and its shelves are fastened between them. A box or planter has two long sides (or a front and a back) and two ends.'},
  {word:'Bottom',group:'parts',match:/^bottom$/i,
    what:'The panel at the bottom of a cabinet or box that everything inside sits on.'},
  {word:'Door',group:'parts',match:/\bdoor\b/i,
    what:'A panel that swings on hinges to close an opening.'},
  {word:'Lid',group:'parts',match:/\blid\b/i,
    what:'A top that lifts off, or swings up on hinges, to open a box.'},
  {word:'Seat',group:'parts',match:/\bseat\b/i,
    what:'The board you sit on.'},
  {word:'Support',group:'parts',match:/\bsupport\b/i,
    what:'A piece under a shelf that holds up its front edge, the way a bracket does.'},
  {word:'Tray',group:'parts',match:/\btray\b/i,
    what:'The flat floor of a bird feeder, where the seed goes.'},
  {word:'Roof board',group:'parts',match:/\broof board\b/i,
    what:'One of the two boards that lean together to make a small sloping roof.'},
  {word:'Tank',group:'bought',match:/^tank$/i,
    what:'The aquarium. You buy it. It is drawn so you can see that it fits and so its filled weight is counted.'},
  {word:'Light',group:'bought',match:/^light$/i,
    what:'The aquarium light. It is drawn so you can check there is room for it, and for your hand, above the tank.'},
  {word:'Mattress',group:'bought',match:/^mattress$/i,
    what:'Drawn so you can see that the bed fits it. It is not in the cut list.'},
  {word:'Window',group:'bought',match:/^window$/i,
    what:'A window you buy and set into the opening framed for it. It is not in the cut list.'},

  /* ---- joining pieces ---- */
  {word:'Fastener',group:'join',
    what:'Anything that holds two pieces together: a screw, a nail, a wooden peg, a metal bracket, or glue.'},
  {word:'Screw size',group:'join',
    what:'How a screw is named, for example #8 x 1-5/8 inch. The number after # is how thick it is (a bigger number is a thicker screw, and #8 is the everyday size). The second number is how long it is.'},
  {word:'Driver bit',group:'join',
    what:'The short steel tip that goes in the drill and fits the head of the screw. Its shape (cross, square or star) and size must match the screw, and the screw box says which one.'},
  {word:'Pilot hole',group:'join',
    what:'A hole a little thinner than the screw, drilled where the screw will go before the screw goes in. The threads still bite into the wood around it. Without it the screw can split the wood, most of all near an end. For a #8 screw use a 7/64 inch drill bit in pine and other soft woods, or a 1/8 inch bit in oak and other hard woods.'},
  {word:'Countersink',group:'join',
    what:'A small cone-shaped hollow at the top of a pilot hole, so the head of the screw ends up level with the wood instead of sticking up.'},
  {word:'Driven at an angle',group:'join',
    what:'A screw or a nail started in the side of one piece and slanted so it passes through the corner into the other piece. It is used where you cannot fasten straight through. With nails this is called toenailing.'},
  {word:'Framing nail',group:'join',
    what:'A thick nail for the frames of walls, floors and roofs. The lists give the length and, in brackets, the old name stores still sell it by: a 3 inch nail is a "10d", a 2-1/2 inch nail an "8d". Common nails, with a flat head, are the kind to buy.'},
  {word:'Butt joint',group:'join',
    what:'The simplest joint there is: the end or edge of one piece pushed up against another piece and fastened with screws, nails or glue.'},
  {word:'Pocket hole',group:'join',
    what:'A hole drilled at a slant into the hidden side of a board, using a guide called a pocket-hole jig. A screw goes through it and out the end of the board into the next piece. It makes a strong joint with no screw showing.'},
  {word:'Brad nail',group:'join',
    what:'A thin nail with a tiny head. Brads hold a piece in place while the glue dries. The glue does the real holding.'},
  {word:'Dowel',group:'join',
    what:'A short round wooden peg glued into matching holes in two pieces, so nothing shows on the outside.'},
  {word:'L-bracket',group:'join',
    what:'A small metal corner plate screwed into both pieces on the inside of a corner. The easiest joint to make.'},
  {word:'Clamp',group:'join',
    what:'A tool that squeezes pieces together and holds them still while you drill, screw, or wait for glue to dry.'},
  {word:'Hinge',group:'join',
    what:'The metal joint a door or lid swings on. One half screws to the door or lid, the other to the cabinet or box.'},
  {word:'Overlay hinge',group:'join',
    what:'A cabinet hinge that lets the door lie over the front edges of the cabinet instead of sitting inside the opening. Full overlay means the door covers the whole edge. One leaf screws to the back of the door, the other to the cabinet: to the inside of its side, or to the front edge of a post. The simplest kind just screws on. The kind with a round cup needs a large shallow hole drilled in the back of the door, and its package says exactly where.'},
  {word:'Pull and catch',group:'join',
    what:'A pull is a handle for a door or drawer; it is held by a bolt or two through a hole you drill. A catch holds the door shut: a small magnet screwed inside the cabinet, under the top where the free side of the door closes, and a metal plate screwed to the back of the door where it meets the magnet.'},
  {word:'Drawer slide',group:'join',
    what:'A pair of metal runners, one for each side of a drawer. One half of each screws to the cabinet and the other half to the drawer, and the drawer rolls in and out on them.'},
  /* hardware that can be placed in the 3D view (HARDWARE in js/hardware.js names one of these for each kind) */
  {word:'Butt hinge',group:'join',
    what:'The plain hinge of a door or a lid: two flat metal leaves joined by a pin. One leaf screws to the door or lid, the other to the frame or the box.'},
  {word:'T-hinge',group:'join',
    what:'A heavy hinge for shed and gate doors, shaped like the letter T. The short plate screws to the door frame and the long strap lies across the face of the door.'},
  {word:'Piano hinge',group:'join',
    what:'One long, thin hinge that runs the whole length of a lid. It is cut to length with a hacksaw and held by many small screws.'},
  {word:'Drawer kicker',group:'join',match:/^drawer kicker$/i,
    what:'A strip of wood screwed to each side of a cabinet just above the side of a drawer that rides on wooden runners. When the drawer is pulled out it tries to tip down at the front, and the kicker stops its back end from rising.'},
  {word:'Overlay and inset fronts',group:'parts',
    what:'Two ways a drawer front can sit. An overlay front lies over the front edges of the cabinet and hides them; it is the easier one to fit. An inset front sits inside the cabinet, level with its front edges, with an even gap all around that shows any error.'},
  {word:'Spacer block',group:'measure',
    what:'A scrap of wood cut to an exact length and used instead of a tape measure. Stand it on a panel and rest a drawer slide or a shelf on it, and both sides of the cabinet come out at exactly the same height.'},
  {word:'Drawer runner',group:'join',match:/^drawer runner$/i,
    what:'A strip of hard wood screwed to each side of a cabinet for a drawer to ride on, instead of metal slides. Rubbing it with candle wax makes the drawer move easily. A drawer on runners comes out about two thirds of the way; a metal slide lets it come all the way out.'},
  {word:'Hasp',group:'join',
    what:'A hinged metal strap on a door that closes over a metal loop on the frame. A padlock through the loop keeps the door shut.'},
  {word:'Lid stay',group:'join',
    what:'A folding metal arm inside a box that holds the lid open and lets it down slowly, so it cannot slam on fingers.'},
  {word:'Caster',group:'join',
    what:'A wheel on a turning plate, screwed under a corner so that heavy furniture can be rolled. Two with brakes keep it from rolling away.'},
  {word:'Leveling foot',group:'join',
    what:'A foot on a threaded stem under a leg. Turning it makes that leg a little longer or shorter, until nothing rocks on an uneven floor.'},
  {word:'Shelf pin',group:'join',
    what:'A small metal peg pushed into a hole in the side of a cabinet. Four of them carry a shelf, and moving them to other holes moves the shelf up or down.'},
  {word:'Wall stud and stud finder',group:'join',
    what:'Wall studs are the upright boards hidden inside a house wall. A stud finder is a small tool you slide along the wall that signals where they are, so your screws go into wood and not just drywall.'},
  {word:'Nail set',group:'join',
    what:'A small steel punch. Set its tip on the head of a nail and tap it with the hammer to sink the head just below the surface, where a little filler hides it.'},
  {word:'Drip loop',group:'join',
    what:'A low sag in an electric cord before it reaches the outlet. Water that runs along the cord drips off at the bottom of the sag instead of running into the outlet. Leave one on every cord near a fish tank.'},
  {word:'Racking',group:'join',
    what:'A frame leaning over sideways until its square corners become slanted, like a box folding flat. A back panel or a slanted brace stops it.'},

  /* ---- measuring and cutting ---- */
  {word:'Face, edge and end',group:'measure',
    what:'The three kinds of surface on a board. The two faces are the wide sides. The two edges are the narrow sides. The two ends are where it was cut across. "On edge" means standing on a narrow side, "flat" means lying on a wide side.'},
  {word:'Flush',group:'measure',
    what:'Two surfaces exactly level with each other, with no step between them. Run a finger across the joint: you should not feel it.'},
  {word:'Square',group:'measure',
    what:'A corner of exactly 90 degrees, like the corner of a sheet of paper. To check a frame or a cabinet, measure corner to corner both ways. When the two numbers match, it is square.'},
  {word:'Square (the tool)',group:'measure',
    what:'A metal or plastic ruler with a true 90 degree corner. Hold it against the edge of a board to mark a cut straight across, or set it in a corner to check the corner.'},
  {word:'Set back',group:'measure',
    what:'Moved in from an edge by a stated amount. "Set back 2 inches from the front" means 2 inches behind the front edge.'},
  {word:'Overhang',group:'measure',
    what:'How far one piece sticks out past the piece under it, like a table top past its legs.'},
  {word:'Span',group:'measure',
    what:'How far a board reaches from one support to the next with nothing under it. The longer the span, the more the board sags, so every size of board has a longest span it is good for under a given load.'},
  {word:'Clearance',group:'measure',
    what:'Empty space left on purpose so something can move or fit: around a drawer, above a fish tank for your hand, behind a door.'},
  {word:'Shim',group:'measure',
    what:'A thin wedge of wood or plastic pushed under a leg or frame to fill a gap. Shims make a stand sit level and steady on an uneven floor.'},
  {word:'Crosscut and rip cut',group:'measure',
    what:'A crosscut goes across a board to make it shorter. A rip cut goes along a board to make it narrower. Crosscuts are easy with any saw. Rip cuts need a table saw, or a circular saw run along a straight board clamped down as a guide.'},
  {word:'Kerf',group:'measure',
    what:'The slot of wood the saw blade turns into dust, about 1/8 inch wide. The cutting diagrams leave room for it between pieces.'},
  {word:'Cut list',group:'measure',
    what:'The list of every piece to cut, with its size and the letter to pencil on it. The same letters are used in the cutting diagrams and the steps.'},
  {word:'On center',group:'measure',
    what:'Measured from the middle of one piece to the middle of the next. Studs "16 inches on center" have their middles 16 inches apart.'},
  {word:'Level and plumb',group:'measure',
    what:'Level means perfectly horizontal, like the surface of still water. Plumb means perfectly straight up and down. A bubble level checks both.'},
  {word:'Roof pitch',group:'measure',
    what:'How steep a roof is, given as the inches it rises for every 12 inches measured level, not along the slope. "4 in 12" is a gentle slope, "12 in 12" is 45 degrees.'},
  {word:'Bay',group:'measure',
    what:'The space between two uprights of a bookshelf, a cabinet or a rack. A wide bookshelf with one divider has two bays.'},
  {word:'Case',group:'measure',
    what:'The box of a bookshelf or cabinet: its two sides, its top and its bottom, with whatever is fastened between them. The back and the doors go onto the case.'},
  {word:'Hurricane tie',group:'shed',
    what:'A bent metal plate nailed to both a rafter and the top of the wall under it. It keeps wind from lifting the roof off.'},

  /* ---- lumber, sheets and finishing ---- */
  {word:'Nominal size and actual size',group:'lumber',
    what:'A board is sold by a name, like 2x4, that is bigger than the board really is. That name is the nominal size. A 2x4 really measures 1-1/2 by 3-1/2 inches: its actual size. NominalCAD always draws and lists boards at their actual size.'},
  {word:'Plywood sheet',group:'lumber',
    what:'A wide, flat panel made of thin layers of wood glued together, sold as a sheet 4 feet by 8 feet. It is named by its thickness: 3/4 inch for cabinet sides, tops and shed floors, 1/2 inch for drawer boxes, shelf decks and roof decks, 1/4 inch for backs and drawer bottoms. A sheet usually measures about 1/32 inch less than its name.'},
  {word:'Pressure-treated lumber',group:'lumber',
    what:'Lumber soaked with a preservative so it does not rot outdoors or against the ground. Fasten it with screws marked exterior or for treated lumber, because plain steel screws rust away in it.'},
  {word:'Grain',group:'lumber',
    what:'The lines in wood, which run the length of a board. Wood is hard to break across the grain but splits easily along it, the way firewood does, which is why screws near an end need a pilot hole.'},
  {word:'Face grain',group:'lumber',
    what:'The lines on the face of a sheet of plywood. On a full sheet they run the long way. Plywood is about twice as stiff along those lines as across them, so a shelf or a top is cut with the lines running the way it has to reach.'},
  {word:'Drip edge and underlayment',group:'lumber',
    what:'Two things that go on a roof deck before the roofing. Underlayment is the roll of felt or plastic sheet laid over the plywood to keep it dry. Drip edge is a bent metal strip along the edges of the roof that sends water clear of the wood under it.'},
  {word:'Rimless tank',group:'bought',
    what:'A fish tank with no plastic frame around its bottom edge, so the glass itself stands on the stand. It needs a thin foam mat under it to even out any small bump.'},
  {word:'Hardware',group:'lumber',
    what:'Everything you buy that is not wood or finish: screws, nails, hinges, drawer slides, handles, brackets.'},
  {word:'Sandpaper grit',group:'lumber',
    what:'The number on sandpaper. A low number (80) is coarse and removes wood fast. A high number (180, 220) is fine and leaves it smooth. Work from low to high.'},
  {word:'Wood filler',group:'lumber',
    what:'A putty pressed into screw holes, gaps and dents. When it is dry you sand it level, and paint hides it.'},
  {word:'Primer',group:'lumber',
    what:'The first coat under paint. It sticks to bare wood and seals knots so the paint covers evenly and stays on.'},
  {word:'Finish',group:'lumber',
    what:'What goes on the bare wood at the end to protect it and make it look good: paint, or a clear coat such as polyurethane. Stain only adds color, so it needs a clear coat over it. Rags wet with oil-based stain or finish can catch fire by themselves, so spread them flat outdoors to dry before you throw them away.'},
  // the last piece entry on purpose: a piece you drew yourself is called "Board" until you rename it
  {word:'Board',group:'lumber',match:/\bboard\b/i,
    what:'A length of solid lumber, sold by a size name and a length, such as a 2x4 that is 8 feet long.'},
];

/* the entry that explains a piece of this name, or null */
function termFor(name){
  return TERMS.find(term=>term.match&&term.match.test(name))||null;
}
/* "Apron: A board standing on its edge..." for a tip */
const termTip=term=>`${term.word}: ${term.what}`;

/* ---------- on the pages: "Words used in this design" ---------- */
/* The piece words of the design on screen, in the order they first appear, each with the piece names that use it. */
function termsInDesign(){
  const found=new Map();
  // (with the strips of wood that are placed as hardware and cut like pieces: drawer runners and kickers, js/hardware.js)
  for(const part of S.parts.concat(woodStrips())){
    const term=termFor(part.name);
    if(!term)continue;
    if(!found.has(term))found.set(term,new Set());
    found.get(term).add(part.name);
  }
  return found;
}
function wordsSection(){
  const found=termsInDesign();
  if(!found.size)return'';
  const rows=[...found.entries()].map(([term,names])=>{
    const others=[...names].filter(name=>name.toLowerCase()!==term.word.toLowerCase());
    return`<dt>${esc(term.word)}${others.length?` <small>${esc(others.join(', '))}</small>`:''}`+
      ` <button class="lnk noprint" data-show-term="${TERMS.indexOf(term)}" title="Pick these pieces out in the 3D view">Show me</button></dt>`+
      `<dd>${esc(term.what)}</dd>`;
  }).join('');
  return`<section class="words" data-beginner><h2>Words used in this design</h2>`+
    `<p class="hint">New to woodworking? These are the names this design gives its pieces. `+
    `<button class="lnk noprint" data-open-words>All woodworking words</button></p>`+
    `<dl class="terms">${rows}</dl></section>`;
}
/* Show me: go to the Design tab with every piece of that word picked out. The pieces are drawn solid and blue
   and the rest of the design see-through (showSpotlight in js/visibility.js), because the pieces a beginner most
   needs shown are the ones behind something else: a base rail, a cleat, the studs inside a sheathed wall.
   Nothing gets selected, so nothing can be changed by accident. */
function showTermPieces(term){
  let ids=S.parts.filter(part=>termFor(part.name)===term&&!hiddenIds.has(part.id)).map(part=>part.id);
  // a drawer runner or kicker is a strip on a cabinet side: the sides that carry them are picked out
  if(!ids.length)ids=[...new Set(woodStrips().filter(strip=>termFor(strip.name)===term).map(strip=>strip.strip.to!=null?strip.strip.to:strip.strip.on))].filter(id=>!hiddenIds.has(id));
  if(!ids.length)return toast('Those pieces are hidden. Use Display, then Show everything.');
  setTab('design');
  showSpotlight(ids,term.word);
  toast(`${term.word}: ${ids.length===1?'the piece':'the '+ids.length+' pieces'} in blue. Click anywhere to go back to normal.`);
}

/* ---------- in Properties: one line about the selected piece ---------- */
function termLine(part){
  const term=termFor(part.name);
  if(!term)return'';
  return`<div class="note termline" data-beginner><b>${esc(term.word)}.</b> ${esc(term.what)}</div>`;
}

/* ---------- tips on piece names (Pieces list, cut list, steps) ---------- */
/* When the pointer comes to rest on text that is exactly the name of a piece in the design (or several names with
   commas, as the cut list writes them), the browser's own tip explains the word. Beginner only. */
let pieceNames={at:0,set:new Set()};
function currentPieceNames(){
  const now=Date.now();
  if(now-pieceNames.at>1000)pieceNames={at:now,set:new Set(S.parts.map(part=>part.name))};
  return pieceNames.set;
}
document.addEventListener('mouseover',event=>{
  const el=event.target;
  if(level!=='beginner'||!el.closest||el.title||el.children.length||!el.closest('#left,.page'))return;
  const text=el.textContent.trim();
  if(!text||text.length>60)return;
  const names=text.split(', '),known=currentPieceNames();
  if(!names.every(name=>known.has(name)))return;
  const terms=[...new Set(names.map(termFor).filter(Boolean))];
  if(terms.length)el.title=terms.map(termTip).join('\n\n');
});

/* ---------- the Woodworking words window ---------- */
function renderWords(filter){
  const wanted=(filter||'').trim().toLowerCase();
  const fits=term=>!wanted||term.word.toLowerCase().includes(wanted)||term.what.toLowerCase().includes(wanted);
  const inDesign=termsInDesign();
  // first, how each joint is made (js/jointhelp.js): a row for each that opens to its drawing and steps
  const cards=Object.entries(JOINT_HELP).filter(([,card])=>!wanted||(card.title+' '+card.what).toLowerCase().includes(wanted));
  const joints=cards.length?`<div class="sec">How each joint is made</div>`+
    cards.map(([key,card])=>`<details class="jd"><summary>${esc(card.title)}</summary>${jointCard(key)}</details>`).join(''):'';
  const html=joints+TERM_GROUPS.map(([key,title])=>{
    const terms=TERMS.filter(term=>term.group===key&&fits(term)).sort((a,b)=>a.word.localeCompare(b.word));
    if(!terms.length)return'';
    return`<div class="sec">${esc(title)}</div><dl class="terms">`+
      terms.map(term=>`<dt>${esc(term.word)}${inDesign.has(term)?' <small>in this design</small>':''}</dt><dd>${esc(term.what)}</dd>`).join('')+`</dl>`;
  }).join('');
  $('#wordsList').innerHTML=html||'<p class="dlg-msg">No word matches that. Try a shorter word.</p>';
}
function openWords(){
  $('#wordsFind').value='';
  renderWords('');
  $('#wordsDlg').showModal();
}
$('#wordsFind').addEventListener('input',event=>renderWords(event.target.value));
document.addEventListener('click',event=>{
  const target=event.target.closest?event.target.closest('[data-open-words],[data-show-term]'):null;
  if(!target)return;
  if(target.hasAttribute('data-open-words')){
    const help=$('#helpDlg');
    if(help.open)help.close();
    openWords();
  }else showTermPieces(TERMS[+target.dataset.showTerm]);
});

SELFTESTS.push(function woodworkingWords(problems){
  // Every piece name any preset can produce must be explained: at its defaults, with each choice of each option,
  // and with each number at its smallest and largest (a wide bookshelf gets dividers, a long garden bed cross
  // ties), each choice tried together with each limit.
  const unexplained=new Set();
  for(const preset of PRESETS){
    const defaults={};
    for(const field of preset.params)if(!field.head)defaults[field.k]=field.v;
    const choices=[{}],limits=[{}];
    for(const field of preset.params){
      if(field.opts)for(const option of field.opts)choices.push({[field.k]:option[0]});
      else if(field.check)choices.push({[field.k]:!field.v});
      else if(field.k)for(const limit of[field.min,field.max])if(limit!==undefined)limits.push({[field.k]:limit});
    }
    for(const choice of choices)for(const limit of limits){
      let parts=[];
      try{parts=preset.build({...defaults,...choice,...limit});}catch(e){}
      for(const part of parts)if(!termFor(part.name))unexplained.add(`${part.name} (${preset.name})`);
    }
  }
  if(unexplained.size)problems.push('words: no explanation in js/glossary.js for: '+[...unexplained].slice(0,12).join(', '));
  // names that used to fall into a general entry must keep their own
  for(const[name,word]of[['Door stile','Door stile'],['Panel stud','Panel stud'],['Rafter tie','Rafter tie'],['Ridge board','Ridge board'],
    ['Trimmer stud','Trimmer stud'],['Gable stud','Gable stud'],['Back rail','Back rail'],['Base rail','Base rail'],['Cross rail','Cross rail'],
    ['Shelf rail','Shelf rail'],['Slat cleat','Slat cleat'],['Middle post','Middle post'],['Middle leg','Middle leg'],['Stud','Stud'],
    ['Rafter','Rafter'],['Door','Door'],['Shed door','Door'],['Rail','Rail'],['Top rail','Top rail']]){
    const found=termFor(name);
    if(!found||found.word!==word)problems.push(`words: "${name}" is explained as "${found?found.word:'nothing'}", not as "${word}"`);
  }
  for(const term of TERMS){
    if(!TERM_GROUPS.some(group=>group[0]===term.group))problems.push(`words: "${term.word}" is in no group`);
    if(!term.what||term.what.length<20||/undefined|NaN/.test(term.what))problems.push(`words: "${term.word}" has no real explanation`);
  }
  // on the page: shown to a beginner, hidden from an expert, and Properties says what the selected piece is
  const partsOnScreen=S.parts;
  S.parts=[mk('Long apron','1x4',[20,3.5,.75],[0,0,0]),mk('Leg','2x2',[1.5,20,1.5],[0,0,0])];
  const html=wordsSection();
  S.parts=partsOnScreen;
  if(!/data-beginner/.test(html)||!/<dt>Apron/.test(html)||!/<dt>Leg/.test(html))problems.push('words: the "Words used in this design" section does not explain an apron and a leg');
  if(!/data-beginner/.test(termLine({name:'Wall cleat'})))problems.push('words: Properties has no line for a wall cleat');
  if(termFor('Corner post').word!=='Corner post')problems.push('words: a corner post is explained as something else');
  renderWords('apron');
  if(!/Apron/.test($('#wordsList').textContent))problems.push('words: finding "apron" in the Woodworking words window shows nothing');
  renderWords('');
  // "Post" by itself has its own entry (the frames of the garage shelves hang on its side); one meaning per name
  if(termFor('Post').word!=='Post'||termFor('Upright').word!=='Upright')problems.push('words: a post and an upright need entries of their own');
  if(TERMS.filter(term=>/rafter tie/i.test(term.word)).length!==1)problems.push('words: two entries are called a rafter tie');
  // Show me picks the pieces out without selecting them: the rest is drawn see-through, and one click puts it back
  const keepParts=S.parts,keepSel=sel,keepTab=tab;
  S.parts=[mk('Side','1x10',[.75,30,9.25],[0,0,0]),mk('Base rail','1x4',[20,3.5,.75],[.75,0,0]),mk('Toe kick','1x4',[20,3.5,.75],[.75,0,7])];
  S.parts.forEach((part,index)=>{part.id=9000+index;});
  showTermPieces(termFor('Base rail'));
  const rail=meshes.get(9001),side=meshes.get(9000);
  if(sel.size)problems.push('words: Show me selected the pieces, so Properties offers tools that change the design');
  if(!spotlightIds||spotlightIds.size!==1||!rail||!side||rail.children[0].material.opacity<1||side.children[0].material.opacity>.3)problems.push('words: Show me does not draw its pieces solid and the rest see-through');
  if(!/Show me/.test($('#status').textContent))problems.push('words: the status bar does not say how to leave Show me');
  endSpotlight();
  // "normal" is how the view that is on draws wood: solid in Solid, see-through in See-through and Fasteners only
  const afterShowMe=meshes.get(9000).children[0].material.opacity;
  rebuildScene();
  const usual=meshes.get(9000).children[0].material.opacity;
  if(spotlightIds||Math.abs(afterShowMe-usual)>1e-6||(woodMode==='solid'&&usual<1))problems.push('words: the view does not go back to normal after Show me');
  S.parts=keepParts;sel=keepSel;
  setTab(keepTab);
  renderAll();
});
