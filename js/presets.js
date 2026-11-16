/* NominalCAD: the preset catalog and the step-by-step instructions for each preset */
'use strict';
const PRESETS=[
 {name:'Fish tank wall / rack',desc:'From one rack to a whole fish room wall. Auto-fits the most tanks and sizes the lumber for the water weight, or set every row by hand.',
  params:[{head:'Main tank'},
   {k:'size',label:'Tank size',opts:[...TANK_OPTS,['custom','Custom (type below)']],v:'g20h',
     fill:Object.fromEntries(Object.entries(TANKS).map(([k,v])=>[k,{tl:v[0],td:v[1],th:v[2],gal:v[3],clr:Math.max(8,Math.ceil(v[2]/2))}]))},
   num('tl','Tank length',24),num('td','Tank front-to-back',12),num('th','Tank height',16),{k:'gal',label:'Gallons',v:20,dec:1},
   {head:'Your space'},
   num('W','Wall width (try 10\')',120),num('H','Height available',84),num('maxD','Max depth from wall',30),
   {k:'board',label:'Longest board you can haul',opts:[['96','8 ft'],['120','10 ft'],['144','12 ft'],['192','16 ft']],v:'96'},
   {head:'Access and lighting'},
   num('light','Space for light',3),num('clr','Hand room above tank',8),num('low','Lowest tank off floor',6),
   {k:'orient',label:'Tanks face',opts:[['auto','Auto: whichever fits most'],['long','Long side out'],['end','Short end out']],v:'auto'},
   {head:'Do it by hand (leave on Auto to let the program decide)'},
   {k:'levels',label:'Number of rows',opts:[['0','Auto: as many as fit'],...[1,2,3,4,5,6,7,8].map(n=>[''+n,''+n])],v:'0'},
   {k:'perRow',label:'Tanks per row (0 = auto)',v:0,int:1},
   {k:'rail',label:'Shelf rail size',opts:[['auto','Auto'],['2x4','2x4'],['2x6','2x6'],['2x8','2x8'],['2x10','2x10']],v:'auto'},
   {k:'up',label:'Upright size',opts:[['auto','Auto'],['2x4','2x4'],['4x4','4x4']],v:'auto'},
   {k:'brace',label:'Diagonal back braces',check:1,v:true},
   {k:'base',label:'Under the bottom row',opts:[['open','Nothing: tanks start near the floor'],['shelf','Open storage shelf'],['cabinet','Cabinet with doors']],v:'open'},
   {head:'Different tank on each row (bottom row first)'},
   ...[1,2,3,4,5,6].map(i=>({k:'r'+i,label:'Row '+i+(i===1?' (bottom)':''),opts:[['','Main tank'],...TANK_OPTS,['store','Storage / sump shelf, no tanks']],v:''})),
   num('storeH','Storage or cabinet height',16)],
  info:p=>rackNotes(p).slice(0,5).join(' '),notes:rackNotes,build:buildRack,hw:rackHw},
 {name:'Single aquarium stand',desc:'Stand for one tank, sized for its filled weight, with a cabinet, an open shelf or a second tank underneath.',
  params:[{head:'Tank'},
   {k:'size',label:'Tank size',opts:[...TANK_OPTS,['custom','Custom (type below)']],v:'g20h',
     fill:Object.fromEntries(Object.entries(TANKS).map(([k,v])=>[k,{tl:v[0],td:v[1],th:v[2],gal:v[3]}]))},
   num('tl','Tank length',24),num('td','Tank front-to-back',12),num('th','Tank height',16),{k:'gal',label:'Gallons',v:20,dec:1},
   {head:'Stand'},
   num('standH','Stand height',30),
   {k:'under',label:'Underneath the tank',opts:[['cabinet','Cabinet with doors'],['panels','Closed back and sides, open front'],['shelf','Open storage shelf'],['tank','A second tank']],v:'cabinet'},
   {head:'Do it by hand (leave on Auto to let the program decide)'},
   {k:'rail',label:'Rail size',opts:[['auto','Auto'],['2x4','2x4'],['2x6','2x6'],['2x8','2x8'],['2x10','2x10']],v:'auto'},
   {k:'up',label:'Upright size',opts:[['auto','Auto'],['2x4','2x4'],['4x4','4x4']],v:'auto'}],
  info:p=>standNotes(p).slice(0,3).join(' '),notes:p=>standNotes(p),
  hw:p=>{const a=p.under==='cabinet'&&standArgs(p);if(!a)return[];const n=doorCount(rackPlan(a).W);return[['Cabinet hinges, full overlay',2*n],['Door pulls',n],['Magnetic door catches',n]];},
  build(p){const a=standArgs(p);if(!a)return[];const pl=rackPlan(a),P=buildRack(a);
    if(p.under==='cabinet'||p.under==='panels')cabinetSkin(P,0,pl.W,pl.D,p.standH,{doors:p.under==='cabinet',left:true,right:true,back:true});
    return P;}},
 {name:'Cabinet stand with a row of tanks',desc:'A long cabinet with doors and one or more rows of tanks on top. Looks like furniture, works like a rack.',
  params:[{head:'Tanks'},
   {k:'size',label:'Tank size',opts:[...TANK_OPTS,['custom','Custom (type below)']],v:'g20h',
     fill:Object.fromEntries(Object.entries(TANKS).map(([k,v])=>[k,{tl:v[0],td:v[1],th:v[2],gal:v[3],clr:Math.max(8,Math.ceil(v[2]/2))}]))},
   num('tl','Tank length',24),num('td','Tank front-to-back',12),num('th','Tank height',16),{k:'gal',label:'Gallons',v:20,dec:1},
   {k:'levels',label:'Rows of tanks on top',opts:[['1','1 row'],['2','2 rows'],['3','3 rows']],v:'1'},
   num('clr','Hand room above each tank',8),
   {head:'Cabinet'},
   num('W','Length available',72),num('storeH','Cabinet height inside',24),
   {head:'Do it by hand (leave on Auto to let the program decide)'},
   {k:'perRow',label:'Tanks per row (0 = auto)',v:0,int:1},
   {k:'rail',label:'Rail size',opts:[['auto','Auto'],['2x4','2x4'],['2x6','2x6'],['2x8','2x8'],['2x10','2x10']],v:'auto'},
   {k:'up',label:'Upright size',opts:[['auto','Auto'],['2x4','2x4'],['4x4','4x4']],v:'auto'}],
  info:p=>rackNotes(cabArgs(p)).slice(0,4).join(' '),notes:p=>rackNotes(cabArgs(p)),build:p=>buildRack(cabArgs(p)),hw:p=>rackHw(cabArgs(p)),steps:p=>rackSteps(cabArgs(p))},
 {name:'Platform bed',desc:'2x6 frame on 4x4 legs with 1x4 slats. No box spring needed.',
  params:[{k:'size',label:'Mattress',opts:[['twin','Twin'],['twinxl','Twin XL'],['full','Full'],['queen','Queen'],['king','King'],['calking','California king'],['custom','Custom (type below)']],v:'queen',
     fill:{twin:{Wm:38,Lm:75},twinxl:{Wm:38,Lm:80},full:{Wm:54,Lm:75},queen:{Wm:60,Lm:80},king:{Wm:76,Lm:80},calking:{Wm:72,Lm:84}}},
   num('Wm','Mattress width',60),num('Lm','Mattress length',80),num('H','Top of frame off floor',14)],
  build(p){const P=[],W=Math.max(p.Wm,20)+3.5,L=Math.max(p.Lm,30)+3.5,H=Math.max(p.H,8),st=H-1.75;
    P.push(mk('Side rail','2x6',[1.5,5.5,L],[0,H-5.5,0]),mk('Side rail','2x6',[1.5,5.5,L],[W-1.5,H-5.5,0]));
    P.push(mk('End rail','2x6',[W-3,5.5,1.5],[1.5,H-5.5,0]),mk('End rail','2x6',[W-3,5.5,1.5],[1.5,H-5.5,L-1.5]));
    for(const x of[1.5,W-5])for(const z of[1.5,L-5])P.push(mk('Leg','4x4',[3.5,st,3.5],[x,0,z]));
    for(const x of[1.5,W-3])P.push(mk('Cleat','2x2',[1.5,1.5,L-10],[x,st-1.5,5]));
    if(W>50)P.push(mk('Center beam','2x4',[1.5,3.5,L-3],[W/2-.75,st-3.5,1.5]),mk('Center leg','4x4',[3.5,st-3.5,3.5],[W/2-1.75,0,L/2-1.75]));
    const n=Math.ceil(L/6.5),gap=(L-3-n*3.5)/(n-1);
    for(let i=0;i<n;i++)P.push(mk('Slat','1x4',[W-3,.75,3.5],[1.5,st,1.5+i*(3.5+gap)]));
    P.push(mk('Mattress','mattress',[W-3.5,10,L-3.5],[1.75,st+.75,1.75]));
    return P;}},
 {name:'Shed',desc:'Adjustable storage shed: floor on skids, stud walls, sloped roof, with a door and windows where you want them. Build at your own risk.',
  params:[{head:'Size'},
   num('W','Width (left to right)',120),num('D','Depth (front to back)',96),num('Hb','Wall height at the back',80),
   {k:'pitch',label:'Roof slope (inches up per foot)',v:3,dec:1},{k:'sp',label:'Stud spacing',opts:[['16','16" on center'],['24','24" on center']],v:'16'},
   {head:'Door'},
   {k:'dwall',label:'Door is on the',opts:[['front','Front wall'],['back','Back wall'],['left','Left wall'],['right','Right wall']],v:'front'},
   num('dw','Door width',36),num('dh','Door height',72),num('doff','Door from left corner (0 = centered)',0),
   {head:'Windows'},
   {k:'wn',label:'How many windows',v:1,int:1},
   {k:'wwall',label:'Windows are on the',opts:[['right','Right wall'],['left','Left wall'],['both','Both side walls'],['back','Back wall'],['front','Front wall']],v:'right'},
   num('ww','Window width',24),num('wh','Window height',24),num('sill','Bottom of window above floor',40)],
  info:p=>shedNotes(p).slice(0,2).join(' '),notes:shedNotes,build:buildShed,
  hw:p=>[['Heavy T-hinges, 8"',3],['Gate latch or hasp',1],['Rafter ties (hurricane ties)',2*(Math.ceil(Math.max(p.W,48)/24)+1)],['Solid concrete blocks for under the skids',2*(Math.ceil(Math.max(p.W,48)/48)+1)]]},
 {name:'Bird feeder',desc:'Platform feeder with a pitched roof. A good first project from fence pickets or 1x boards.',
  params:[num('L','Length',12)],
  build(p){const L=Math.max(p.L,8),P=[],a=25*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),ry=9.6,rz=4.625;
    P.push(mk('Tray','1x10',[L,.75,9.25],[0,0,0]),mk('Long rim','1x2',[L,1.5,.75],[0,.75,0]),mk('Long rim','1x2',[L,1.5,.75],[0,.75,8.5]),
      mk('End rim','1x2',[.75,1.5,7.75],[0,.75,.75]),mk('End rim','1x2',[.75,1.5,7.75],[L-.75,.75,.75]),
      mk('Roof post','1x4',[.75,8,3.5],[.75,.75,2.875]),mk('Roof post','1x4',[.75,8,3.5],[L-1.5,.75,2.875]));
    for(const s of[-1,1]){const q=mk('Roof board','1x8',[L+2,.75,7.25],[-1,ry-3.625*sa-.375,rz+s*3.625*ca-3.625]);q.rot={k:0,deg:s*25};P.push(q);}
    return P;},
  hw:()=>[['Screw eyes',2],['Chain or rope, feet',4]]},
 {name:'Bookshelf',desc:'Sides, fixed shelves, toe kick and a thin plywood back.',
  params:[num('W','Width',32),num('H','Height',48),{k:'board',label:'Shelf depth',opts:[['1x8','7 1/4" (1x8)'],['1x10','9 1/4" (1x10)'],['1x12','11 1/4" (1x12)']],v:'1x10'},{k:'n',label:'Shelves inside',v:3,int:1},{k:'back',label:'Plywood back',check:1,v:true}],
  info:p=>p.W>36?'Heads up: shelves wider than 36" sag under a row of books. Keep it at 36" or less, or add an upright divider in the middle.':'',
  notes:p=>p.W>36?['Shelves wider than 36" sag under a row of books. Add an upright divider in the middle, or keep heavy books on the bottom.']:[],
  build(p){const P=[],bm=M[p.board],d=bm.w,bo=p.back?.25:0,W=Math.max(p.W,10),H=Math.max(p.H,14),n=Math.max(0,p.n);
    P.push(mk('Side',p.board,[.75,H,d],[0,0,bo]),mk('Side',p.board,[.75,H,d],[W-.75,0,bo]));
    P.push(mk('Top',p.board,[W-1.5,.75,d],[.75,H-.75,bo]),mk('Bottom',p.board,[W-1.5,.75,d],[.75,3.5,bo]));
    const yb=4.25,yt=H-.75,step=(yt-yb-n*.75)/(n+1);
    for(let i=0;i<n;i++)P.push(mk('Shelf',p.board,[W-1.5,.75,d],[.75,yb+step*(i+1)+.75*i,bo]));
    P.push(mk('Toe kick','1x4',[W-1.5,3.5,.75],[.75,0,bo+d-1.75]));
    if(p.back)P.push(mk('Back panel','ply14',[W,H-3.5,.25],[0,3.5,0]));
    return P;}},
 {name:'Dining table',desc:'4x4 legs, 2x4 aprons, 2x6 plank top.',
  params:[num('L','Length',60),num('W','Width',33),num('H','Height',30)],
  build:p=>buildTable({...p,leg:'4x4',apron:'2x4',top:'2x6',over:2})},
 {name:'Coffee table',desc:'Light frame with a slatted lower shelf.',
  params:[num('L','Length',44),num('W','Width',22),num('H','Height',18)],
  build:p=>buildTable({...p,leg:'2x2',apron:'1x4',top:'1x6',over:1,shelf:'1x4',lowY:3})},
 {name:'Side table / nightstand',desc:'Small table with 2x2 legs and a board top.',
  params:[num('L','Width',20),num('W','Depth',16.5),num('H','Height',24)],
  build:p=>buildTable({...p,leg:'2x2',apron:'1x4',top:'1x6',over:1})},
 {name:'Desk',desc:'4x4 legs, 2x4 aprons, one-piece plywood top.',
  params:[num('L','Width',48),num('W','Depth',24),num('H','Height',30)],
  build:p=>buildTable({...p,leg:'4x4',apron:'2x4',top:'ply34',over:1})},
 {name:'Sturdy bench',desc:'Outdoor-style bench from 4x4s, 2x4s and 2x6s.',
  params:[num('L','Length',48),num('W','Seat depth',16.5),num('H','Seat height',18)],
  build:p=>buildTable({...p,leg:'4x4',apron:'2x4',top:'2x6',over:1.5})},
 {name:'Five-board bench',desc:'Classic beginner bench: two plank legs, a top, two aprons.',
  params:[num('L','Length',36),num('H','Seat height',18),{k:'board',label:'Seat board',opts:[['1x10','9 1/4" (1x10)'],['1x12','11 1/4" (1x12)']],v:'1x12'}],
  build(p){const d=M[p.board].w,L=Math.max(p.L,14),H=Math.max(p.H,8),ins=3;
    return[mk('Leg',p.board,[.75,H-.75,d],[ins,0,0]),mk('Leg',p.board,[.75,H-.75,d],[L-ins-.75,0,0]),
      mk('Seat',p.board,[L,.75,d],[0,H-.75,0]),
      mk('Apron','1x4',[L-2*ins-1.5,3.5,.75],[ins+.75,H-4.25,0]),mk('Apron','1x4',[L-2*ins-1.5,3.5,.75],[ins+.75,H-4.25,d-.75])];}},
 {name:'Workbench',desc:'Heavy 4x4 frame, plywood top and a lower shelf.',
  params:[num('L','Length',60),num('W','Depth',24),num('H','Height',34)],
  build:p=>buildTable({...p,leg:'4x4',apron:'2x4',top:'ply34',over:1,shelf:'ply12',lowY:6,endStretch:1})},
 {name:'Garage shelves',desc:'2x4 posts and rails with plywood decks.',
  params:[num('W','Width',48),num('D','Depth',18),num('H','Height',72),{k:'n',label:'Shelves',v:4,int:1}],
  build(p){const P=[],W=Math.max(p.W,16),D=Math.max(p.D,10),H=Math.max(p.H,20),n=Math.max(2,p.n);
    for(const x of[0,W-3.5])for(const z of[0,D-1.5])P.push(mk('Post','2x4',[3.5,H,1.5],[x,0,z]));
    for(let i=0;i<n;i++){const y=4+i*(H-8)/(n-1);
      P.push(mk('Rail','2x4',[W,3.5,1.5],[0,y,1.5]),mk('Rail','2x4',[W,3.5,1.5],[0,y,D-3]));
      const xs=[0,W-1.5];if(W>36)xs.push(W/2-.75);
      for(const x of xs)P.push(mk('Cross piece','2x4',[1.5,3.5,D-6],[x,y,3]));
      P.push(mk('Shelf deck','ply12',[W,.5,D-3],[0,y+3.5,1.5]));}
    return P;}},
 {name:'Storage box / toy chest',desc:'Plywood box with a lift-off lid.',
  params:[num('W','Width',30),num('D','Depth',16),num('H','Height',16),{k:'ply',label:'Plywood',opts:[['ply34','3/4"'],['ply12','1/2"']],v:'ply34'},{k:'lid',label:'Lid',check:1,v:true}],
  build(p){const t=M[p.ply].t,W=Math.max(p.W,6),D=Math.max(p.D,6),H=Math.max(p.H,4);
    const P=[mk('Front',p.ply,[W,H,t],[0,0,D-t]),mk('Back',p.ply,[W,H,t],[0,0,0]),
      mk('Side',p.ply,[t,H,D-2*t],[0,0,t]),mk('Side',p.ply,[t,H,D-2*t],[W-t,0,t]),
      mk('Bottom',p.ply,[W-2*t,t,D-2*t],[t,0,t])];
    if(p.lid)P.push(mk('Lid',p.ply,[W,t,D],[0,H,0]));return P;}},
 {name:'Planter box',desc:'1x6 sides, 2x2 corner posts, slatted bottom.',
  params:[num('L','Length',36),num('D','Width',16),{k:'rows',label:'Boards high',v:2,int:1}],
  build:p=>buildBox({...p,board:'1x6',post:'2x2',bottom:true})},
 {name:'Raised garden bed',desc:'2x6 sides screwed to 4x4 corner posts.',
  params:[num('L','Length',72),num('D','Width',36),{k:'rows',label:'Boards high',v:2,int:1}],
  build:p=>buildBox({...p,board:'2x6',post:'4x4',bottom:false})},
 {name:'Entryway shoe bench',desc:'Sit-down bench with a slatted shoe shelf underneath.',
  params:[num('L','Length',42),num('W','Seat depth',16.5),num('H','Seat height',18)],
  build:p=>buildTable({...p,leg:'2x2',apron:'1x4',top:'1x6',over:1,shelf:'1x4',lowY:5})},
 {name:'Base cabinet with doors',desc:'Plywood cabinet with a shelf, two doors and a countertop. Good for a garage or laundry room.',
  params:[num('W','Width',30),num('D','Depth',24),num('H','Height (without top)',34.5)],
  hw:()=>[['Cabinet hinges, full overlay',4],['Door pulls',2]],
  build(p){const W=Math.max(p.W,12),D=Math.max(p.D,10),H=Math.max(p.H,16),sy=r16(4.25+(H-5)/2-.375),dw=(W-.375)/2;
    return[mk('Side','ply34',[.75,H,D],[0,0,0]),mk('Side','ply34',[.75,H,D],[W-.75,0,0]),
      mk('Bottom','ply34',[W-1.5,.75,D],[.75,3.5,0]),
      mk('Top rail','ply34',[W-1.5,.75,3.5],[.75,H-.75,0]),mk('Top rail','ply34',[W-1.5,.75,3.5],[.75,H-.75,D-3.5]),
      mk('Toe kick','ply34',[W-1.5,3.5,.75],[.75,0,D-3]),
      mk('Shelf','ply34',[W-1.5,.75,D-1],[.75,sy,0]),
      mk('Back panel','ply14',[W,H-3.5,.25],[0,3.5,-.25]),
      mk('Countertop','ply34',[W+1,.75,D+1],[-.5,H,0]),
      mk('Door','ply34',[dw,H-4,.75],[.125,3.75,D]),mk('Door','ply34',[dw,H-4,.75],[W/2+.0625,3.75,D])];}},
 {name:'Wall shelf',desc:'A board shelf on a wall cleat with two supports. Screws into wall studs.',
  params:[num('L','Length',36),{k:'board',label:'Shelf depth',opts:[['1x6','5 1/2" (1x6)'],['1x8','7 1/4" (1x8)'],['1x10','9 1/4" (1x10)']],v:'1x8'},num('up','Height on the wall',54)],
  build(p){const L=Math.max(p.L,12),d=M[p.board].w,y=Math.max(p.up,0);
    return[mk('Wall cleat','1x4',[L,3.5,.75],[0,y,0]),mk('Shelf',p.board,[L,.75,d],[0,y+3.5,0]),
      mk('Support','1x4',[.75,3.5,d-1.5],[4,y,.75]),mk('Support','1x4',[.75,3.5,d-1.5],[L-4.75,y,.75])];}},
];

/* ---------- step-by-step instructions for presets ---------- */
const CUT={t:'Cut every piece on the cut list and pencil its name on it. Measure twice, cut once, and cut the longest pieces first.',add:[]};
const FIN={t:'Sand everything: 80 grit, then 120, then 180, and round over the sharp edges. Wipe off the dust, then paint or stain, and finish with at least two coats of clear coat.',add:[]};
function tableSteps(p,o){
  const s=[CUT,
   {t:'Build the two end frames. Lay two legs on a flat surface and fasten a short apron between them, flush with the top of the legs and with their outside faces.'+(o.ends?` Fasten a short stretcher the same way, ${fmt(o.low)} up from the floor.`:'')+' Use glue as well as screws, and check each corner with a square.',add:['Leg','Short apron'].concat(o.ends?['Short stretcher']:[])},
   {t:'Stand the end frames up and join them with the two long aprons, flush with the top of the legs.'+(o.shelf?` Add the long stretchers ${fmt(o.low)} up from the floor.`:'')+' Measure corner to corner both ways: the frame is square when the two measurements match.',add:['Long apron'].concat(o.shelf?['Long stretcher']:[])}];
  if(o.shelf==='slats')s.push({t:'Lay the shelf slats across the long stretchers with even gaps and screw each end down.',add:['Shelf slat']});
  if(o.shelf==='ply')s.push({t:'Drop the lower shelf onto the long stretchers between the legs and screw it down.',add:['Lower shelf']});
  s.push(o.ply?{t:`Center the top on the frame so it overhangs ${fmt(o.over)} on every side. Fasten it from underneath through the aprons (pocket holes or L-brackets) so no screws show.`,add:['Top']}
    :{t:`Lay the top boards on the frame, best face up and tight together, overhanging ${fmt(o.over)} on every side. Fasten each board from underneath through the aprons (pocket holes or L-brackets), or screw down through the top and fill the holes.`,add:['Top board']});
  s.push(FIN);return s;
}
function boxSteps(p,bed){
  const s=[CUT,
   {t:'Build the two long walls. Lay two corner posts on the floor and screw the long side boards across them, starting with the bottom board. Each post sits one board-thickness in from the end of the boards.',add:['Corner post','Long side']},
   {t:'Stand the two long walls up and screw the end boards between them, into the posts.',add:['End']}];
  s.push(bed?{t:'Set the bed in place, check it is level, and line the inside with landscape fabric before filling. Use exterior screws and rot-resistant lumber (cedar, or pressure-treated rated for ground contact).',add:[]}
    :{t:'Turn the box over and screw the bottom slats on through the long sides. The gaps between slats let water drain. Use exterior screws and line the inside with landscape fabric.',add:['Bottom slat']});
  return s;
}
const STEPS={
 'Fish tank wall / rack':p=>rackSteps(p),
 'Single aquarium stand'(p){const a=standArgs(p);if(!a)return[];const s=rackSteps(a);
   s.pop();
   if(p.under==='cabinet'||p.under==='panels')s.push({t:'Glue and nail the thin plywood panels onto the back and both sides. Cut a notch or drill holes in the back panel for hoses and cords before you fasten it.',add:['Back panel','Side panel']});
   if(p.under==='cabinet')s.push({t:'Hang the doors on the front with two overlay hinges each, leaving a 1/8" gap between them. Add the pulls and a magnetic catch for each door. Paint or seal every plywood edge so splashed water cannot soak in.',add:['Door']});
   s.push({t:'Level the stand with shims. Put a foam mat under a rimless tank. Set the tank on top, fill it part way, check for wobble or sag, then finish filling.',add:['Tank']});return s;},
 'Platform bed':p=>[CUT,
   {t:'Screw a cleat along the inside of each side rail, 1 3/4" below the top edge and centered end to end. Glue it and drive a screw every 8". The slats rest on these.',add:['Side rail','Cleat']},
   {t:'Join the side rails to the head and foot rails to make a rectangle, then fasten a leg into each inside corner with its top level with the top of the cleats. Screw through the rails into the legs from both directions.',add:['End rail','Leg']},
   ...(p.Wm+3.5>50?[{t:'Fasten the center beam between the head and foot rails, on edge, with its top level with the cleats. Stand the center leg under the middle of it and screw down through the beam.',add:['Center beam','Center leg']}]:[]),
   {t:'Lay the slats across with even gaps of about 3" and screw each end down into the cleat. The mattress sits about 1" down inside the frame so it cannot slide.',add:['Slat']},FIN,{t:'Set the mattress on the slats.',add:['Mattress']}],
 'Shed'(p){const s=shedPlan(p),sp=+p.sp||16;return[
   {t:'Read the notes at the top first: check permit rules, and build at your own risk. Then cut every piece on the cut list and pencil its letter on it.',add:[]},
   {t:'Set the 4x4 skids on solid blocks or a gravel pad and level them both ways. Build the floor frame on top: two rim joists with the floor joists between them every 16" on center. Measure corner to corner until the two diagonals match, then screw the frame down to the skids.',add:['Skid','Rim joist','Floor joist']},
   {t:'Screw the 3/4" plywood floor deck to the joists every 8", with the panel edges landing on joists.',add:['Floor deck']},
   {t:`Build each wall flat on the floor deck. Lay the top and bottom plates side by side and mark the stud positions on both at once, every ${sp}" on center. Nail or screw through the plates into the stud ends. At the door and each window, put a full stud on each side, a doubled 2x6 header across the top with a 1/2" plywood spacer between the two boards, a flat 2x4 sill under each window, and short cripple studs above and below.`,add:['Bottom plate','Top plate','Stud','Header','Sill','Cripple']},
   {t:'Stand the back wall up first and brace it, then the two side walls, then the front wall. Check each is plumb, screw the corners together, and screw down through the bottom plates into the floor frame. Get a helper for this step: walls are heavy and awkward.',add:[]},
   {t:`Set a rafter every 24" on center, running from the back wall up to the taller front wall with 6" hanging over at each end. Each one sits at about ${Math.round(s.ang*180/Math.PI)} degrees. Fasten every rafter to both walls with a rafter tie.`,add:['Rafter']},
   {t:'Screw the 1/2" plywood roof deck to the rafters, staggering the panel joints.',add:['Roof deck']},
   {t:'Fill the open triangle above each side wall with short studs, then nail on the siding, cutting out the door and window openings. Add drip edge, roofing felt and shingles or metal roofing.',add:[]},
   {t:'Build the door from 3/4" plywood with a 1x4 frame screwed to the back, hang it on three T-hinges, and add the latch. Fit the windows and seal around them with exterior caulk. Anchor the shed to the ground.',add:['Shed door','Window']}];},
 'Bird feeder':()=>[CUT,
   {t:'Glue and nail the four rim strips around the top edge of the tray. Drill four 1/4" drain holes through the tray.',add:['Tray','Long rim','End rim']},
   {t:'Stand a roof post at each end, centered, and screw up through the tray into it.',add:['Roof post']},
   {t:'Glue and screw the two roof boards to the tops of the posts so they meet at the ridge. They slope at 25 degrees. Run a bead of exterior glue along the ridge.',add:['Roof board']},
   {t:'Leave the wood bare or use a water-based exterior finish on the outside only. Twist a screw eye into each end of the ridge and hang it with chain where squirrels cannot jump to it.',add:[]}],
 'Bookshelf'(p){const H=Math.max(p.H,14),n=Math.max(0,p.n),yb=4.25,st=(H-.75-yb-n*.75)/(n+1),hs=[];for(let i=0;i<n;i++)hs.push(fmt(r16(yb+st*(i+1)+.75*i)));
   const s=[CUT,
    {t:`Lay the two sides next to each other and mark the shelf positions on both at once so they match. Underside of each piece, measured from the floor: bottom 3 1/2"${hs.length?', shelves '+hs.join(', '):''}. The top sits flush with the top of the sides.`,add:['Side']},
    {t:'Fasten the bottom, top and shelves between the sides. Drill pilot holes, add glue, and drive two screws through the side into each shelf end.',add:['Bottom','Top','Shelf']},
    {t:'Fasten the toe kick under the bottom shelf, set back 1" from the front edge.',add:['Toe kick']}];
   if(p.back)s.push({t:'Lay the case face down. Measure corner to corner both ways and nudge it until the two measurements match, then glue and nail the back panel on. The back is what stops the bookshelf from wobbling.',add:['Back panel']});
   s.push(FIN,{t:'Stand it in place and fasten the top to a wall stud with an anti-tip strap or bracket.',add:[]});return s;},
 'Dining table':p=>tableSteps(p,{over:2}),
 'Coffee table':p=>tableSteps(p,{over:1,shelf:'slats',low:3}),
 'Side table / nightstand':p=>tableSteps(p,{over:1}),
 'Desk':p=>tableSteps(p,{over:1,ply:1}),
 'Sturdy bench':p=>tableSteps(p,{over:1.5}),
 'Workbench':p=>tableSteps(p,{over:1,ply:1,shelf:'ply',low:6,ends:1}),
 'Five-board bench':()=>[CUT,
   {t:'Fasten the two aprons between the legs, flush with the top of the legs and with their front and back edges. Glue and screw through the legs into the apron ends.',add:['Leg','Apron']},
   {t:'Center the seat on top so it overhangs 3" at each end. Glue it, then screw down into the legs and aprons.',add:['Seat']},FIN],
 'Garage shelves'(p){const H=Math.max(p.H,20),n=Math.max(2,p.n),hs=[];for(let i=0;i<n;i++)hs.push(fmt(r16(4+i*(H-8)/(n-1))));
   return[CUT,
    {t:`Build ${n} shelf frames. Each is two rails with cross pieces between them, one at each end${p.W>36?' and one in the middle':''}. Screw through the rails into the cross-piece ends.`,add:['Rail','Cross piece']},
    {t:'Screw a plywood deck onto the top of each frame.',add:['Shelf deck']},
    {t:`Lay two posts on the floor and mark the underside of each shelf frame, measured from the floor: ${hs.join(', ')}. Screw the frames to the posts with three screws at each crossing, then stand it up and fasten the other two posts the same way.`,add:['Post']},
    {t:'Screw the unit to wall studs so it cannot tip, and keep the heaviest things on the bottom shelf.',add:[]}];},
 'Storage box / toy chest':p=>[CUT,
   {t:'Fasten the two sides between the front and back. Glue each joint, drill pilot holes and screw through the front and back into the side edges.',add:['Front','Back','Side']},
   {t:'Drop the bottom in flush with the lower edges and fasten it through all four walls.',add:['Bottom']},
   ...(p.lid?[{t:'The lid sits on top. Add two hinges along the back, or glue small blocks under the lid so it cannot slide off. For a toy chest, fit a soft-close lid support so it cannot slam on fingers.',add:['Lid']}]:[]),FIN],
 'Entryway shoe bench':p=>tableSteps(p,{over:1,shelf:'slats',low:5}),
 'Base cabinet with doors':()=>[CUT,
   {t:'Fasten the bottom between the two sides, 3 1/2" up from the floor, and the two top rails between the sides flush with the top, one at the front and one at the back. Glue every joint, drill pilot holes and screw through the sides.',add:['Side','Bottom','Top rail']},
   {t:'Fasten the toe kick under the bottom panel, set back 2 1/4" from the front.',add:['Toe kick']},
   {t:'Fasten the shelf halfway up, screwing through the sides. It sits 1" back from the front so the doors can close.',add:['Shelf']},
   {t:'Lay the cabinet face down, measure corner to corner both ways until the two measurements match, then glue and nail the back panel on. The back keeps the cabinet square.',add:['Back panel']},
   {t:'Set the countertop on so it overhangs 1/2" on each side and 1" at the front. Screw up through the top rails into it so no screws show.',add:['Countertop']},
   {t:'Hang the doors with two overlay hinges each, leaving a 1/8" gap between them, and add the pulls.',add:['Door']},FIN],
 'Wall shelf':()=>[CUT,
   {t:'Glue and screw the shelf onto the top edge of the wall cleat, flush along the back.',add:['Wall cleat','Shelf']},
   {t:'Fasten the two supports under the shelf, tight against the cleat, 4" in from each end. Screw down through the shelf and in through the back of the cleat.',add:['Support']},FIN,
   {t:'Find the wall studs with a stud finder, hold the shelf level, and drive two 3" screws through the cleat into every stud it crosses. Do not rely on drywall anchors for a loaded shelf.',add:[]}],
 'Planter box':p=>boxSteps(p,false),
 'Raised garden bed':p=>boxSteps(p,true),
};


/* How to add a preset later:
   1. Add one object to PRESETS above: { name, desc, params, build(p), and optionally info(p), notes(p), hw(p), steps(p) }.
      - params is the form: num('key','Label',default), {k,label,opts:[[value,label]],v}, {k,label,check:1,v}, {k,label,v,int:1}, {head:'Section title'}.
      - build(p) returns the pieces, each made with mk(name, material, [width, height, depth], [x, y, z]).
      - steps(p) returns [{t:'what to do', add:['names of the pieces this step adds']}]. Older presets keep their steps in STEPS, keyed by name.
   2. Put its name in a group below so it shows up under the right heading. Anything not listed lands under "More".
   3. Optional: give its tile a picture by adding its name to PRESET_ICONS (or put icon:'i-...' on the preset itself). */
const PRESET_GROUPS=[
 ['Aquariums and fish rooms',['Fish tank wall / rack','Cabinet stand with a row of tanks','Single aquarium stand']],
 ['Tables and seating',['Dining table','Coffee table','Side table / nightstand','Desk','Sturdy bench','Five-board bench','Entryway shoe bench']],
 ['Storage and shelving',['Bookshelf','Garage shelves','Base cabinet with doors','Storage box / toy chest','Wall shelf','Workbench']],
 ['Bedroom',['Platform bed']],
 ['Outdoors',['Shed','Planter box','Raised garden bed','Bird feeder']]];
/* The small picture on a preset's tile: the id of an icon in the #sprite block at the top of index.html.
   A preset that is not listed here gets the plain table icon. */
const PRESET_ICONS={
 'Fish tank wall / rack':'i-p-rack','Cabinet stand with a row of tanks':'i-p-stand','Single aquarium stand':'i-p-stand',
 'Sturdy bench':'i-p-bench','Five-board bench':'i-p-bench','Entryway shoe bench':'i-p-bench',
 'Bookshelf':'i-p-shelf','Garage shelves':'i-p-shelf','Base cabinet with doors':'i-p-cabinet','Storage box / toy chest':'i-p-box','Wall shelf':'i-p-wallshelf',
 'Platform bed':'i-p-bed','Shed':'i-p-shed','Planter box':'i-p-planter','Raised garden bed':'i-p-planter','Bird feeder':'i-p-feeder'};
/* The left side of the Furniture presets dialog: a heading for each group, then its presets as tiles, two to a row.
   Each tile carries data-i, the preset's place in PRESETS; app.js opens that preset's form when the tile is clicked. */
function renderPresetCards(){
  const listed=new Set(PRESET_GROUPS.flatMap(group=>group[1]));
  const unlisted=PRESETS.filter(p=>!listed.has(p.name)).map(p=>p.name);
  const groups=unlisted.length?[...PRESET_GROUPS,['More',unlisted]]:PRESET_GROUPS;
  const tile=name=>{
    const i=PRESETS.findIndex(p=>p.name===name);
    if(i<0)return'';
    const preset=PRESETS[i],picture=preset.icon||PRESET_ICONS[name]||'i-presets';
    return`<button class="card" data-i="${i}" title="${esc(preset.desc)}">${icon(picture,'l')}<span><b>${esc(preset.name)}</b><small>${esc(preset.desc)}</small></span></button>`;
  };
  $('#presetCards').innerHTML=groups.map(([title,names])=>
    `<div class="sec">${esc(title)}</div><div class="tiles">${names.map(tile).join('')}</div>`).join('');
}
