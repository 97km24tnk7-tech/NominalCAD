/* NominalCAD: cut list, shopping list, cutting diagrams and printable instructions */
'use strict';
/* ---------- cut list ---------- */
const STOCKS=[72,96,120,144,192];
// The built-in estimate for an 8 ft board or a full sheet in construction pine, in dollars: a national ballpark for
// the month named in PRICE_BASELINE (js/prices.js). Everything else about prices is in js/prices.js: priceOf, the
// prices the person types, Update prices, and the shopping list itself.
const PRICE8={'1x2':2.5,'1x3':4,'1x4':6,'1x6':10,'1x8':14,'1x10':19,'1x12':25,'2x2':3.5,'2x3':3.3,'2x4':3.9,'2x6':6.5,'2x8':9,'2x10':13,'2x12':17,'4x4':10,ply34:55,ply12:40,ply14:25};
/* STOCKS: the board lengths the store sells and the program prices, in inches. How the pieces are laid on boards
   of those lengths and on plywood sheets, and what that costs (buyBoards, packSheets, materialBuy, lumberToBuy),
   is in js/buying.js. */
/* ---------- the flat views of the plans: Front, Side and Top, drawn like a shop drawing ----------
   Each looks square at the design with no perspective and carries the two sizes of that view on lines below
   and to the right of it.
     across, upward   the direction that runs across the picture, and the one that runs up it
                      (0 = left to right, 1 = up, 2 = back to front)
     from, up         where the eye is, seen from the design, and which way is up in the picture
     flipAcross       true when "across" runs from right to left in the picture (the Side view shows the front on the left)
     flipUpward       true when "upward" runs from top to bottom (the Top view shows the front at the bottom)
     sizes            what the two sizes are called in the caption */
const FLAT_VIEWS=[
  {name:'Front',across:0,upward:1,from:[0,0,1],up:[0,1,0],sizes:['wide','tall']},
  {name:'Side',across:2,upward:1,from:[1,0,0],up:[0,1,0],flipAcross:true,sizes:['deep','tall']},
  {name:'Top',across:0,upward:2,from:[0,1,0],up:[0,0,-1],flipUpward:true,sizes:['wide','deep']},
];
const FLAT_LABEL=.045; // height of a size label as a share of the picture's width: about 11px type when the picture is shown 360px wide
/* Takes the picture of one flat view. b = the bounds of what is built (the size lines and their labels), frame = the
   bounds of everything drawn, pictures of bought things included (the camera frames it; b when left out), W x H =
   the picture in pixels, snap = takes the picture through a camera. Returns {name, src, caption}. Everything is laid
   out in label heights ("unit"), so the labels read the same on every design, large or small. */
function flatViewPicture(view,b,W,H,snap,frame){
  frame=frame||b;
  const A=view.across,U=view.upward,depth=3-A-U;
  const sizeAcross=b.hi[A]-b.lo[A],sizeUp=b.hi[U]-b.lo[U];
  const frameAcross=frame.hi[A]-frame.lo[A],frameUp=frame.hi[U]-frame.lo[U];
  const acrossLabel=textSprite(fmtFt(sizeAcross),[0,0,0],1,VIEW_COL.dimText),upLabel=textSprite(fmtFt(sizeUp),[0,0,0],1,VIEW_COL.dimText);
  upLabel.material.rotation=Math.PI/2; // the upright size is written along its line, reading upward, as on a drawing
  // Room around the design, in units: half a unit on the left and on top; below and to the right a gap, the
  // size line, and the half of its label that sticks out past the line (ROOM in all).
  const GAP=.8,PAD=.5,ROOM=GAP+.5+.3;
  const frameWide=Math.max(frameAcross/(1-(PAD+ROOM)*FLAT_LABEL),frameUp/(H/W-(PAD+ROOM)*FLAT_LABEL)); // the picture's width in inches: whichever of the two directions needs more
  const frameHigh=frameWide*H/W,unit=FLAT_LABEL*frameWide;
  const spareAcross=frameWide-frameAcross-(PAD+ROOM)*unit,spareUp=frameHigh-frameUp-(PAD+ROOM)*unit; // shared out evenly on both sides

  // the camera looks at the middle of the design; its frame is measured from there
  const middle=frame.lo.map((v,i)=>(v+frame.hi[i])/2),far=Math.hypot(frame.hi[0]-frame.lo[0],frame.hi[1]-frame.lo[1],frame.hi[2]-frame.lo[2])+50;
  const left=-frameAcross/2-PAD*unit-spareAcross/2,bottom=-frameUp/2-ROOM*unit-spareUp/2;
  const eye=new THREE.OrthographicCamera(left,left+frameWide,bottom+frameHigh,bottom,.1,far*4);
  eye.position.set(middle[0]+view.from[0]*far,middle[1]+view.from[1]*far,middle[2]+view.from[2]*far);
  eye.up.set(view.up[0],view.up[1],view.up[2]);
  eye.lookAt(middle[0],middle[1],middle[2]);

  // the two size lines, placed in the scene so that they land below and to the right of the design in the picture
  const towardRight=view.flipAcross?-1:1,towardTop=view.flipUpward?-1:1;
  const point=(across,upward)=>{const p=[0,0,0];p[A]=across;p[U]=upward;p[depth]=view.from[depth]>0?frame.hi[depth]:frame.lo[depth];return p;};
  const below=(towardTop>0?frame.lo[U]:frame.hi[U])-towardTop*GAP*unit,beside=(towardRight>0?frame.hi[A]:frame.lo[A])+towardRight*GAP*unit;
  emptyGroup(dimGroup);
  dimGroup.visible=true;
  dimGroup.add(dimLine(point(b.lo[A],below),point(b.hi[A],below),U,unit*.35),dimLine(point(beside,b.lo[U]),point(beside,b.hi[U]),A,unit*.35));
  const put=(label,at)=>{label.scale.multiplyScalar(unit);label.position.set(at[0],at[1],at[2]);dimGroup.add(label);};
  put(acrossLabel,point((b.lo[A]+b.hi[A])/2,below));
  put(upLabel,point(beside,(b.lo[U]+b.hi[U])/2));
  return{name:view.name,src:snap(eye),caption:`${view.name}: ${fmtFt(sizeAcross)} ${view.sizes[0]} × ${fmtFt(sizeUp)} ${view.sizes[1]}`};
}

/* Every picture for the plans, taken in one go from a clean copy of the scene (nothing selected, hidden, see-through or exploded):
   an overview, flat front / side / top views with sizes, a pulled-apart view, and the pictures of every step
   (out.steps, one entry per step of buildPlan(): js/steppictures.js).
   The pictures show solid wood with every door and drawer closed, unless the caller asks otherwise:
     opts.view   'solid' (the usual), 'through' or 'fast': how the wood is drawn (js/viewmodes.js). Fasteners are
                 drawn in the two see-through modes only.
     opts.open   true to show doors and drawers as far open as they are in the design (js/motion.js) */
function takePictures(full,opts){
  // A design that was turned as one is drawn standing square, as it is built and measured (squaredUp,
  // js/neighbors.js): the flat views with sizes, the steps and their close-ups mean nothing at 30 degrees.
  const turned=!squaredNow&&turnedSets(S.parts).list.length>0;
  const out=squaredUp(()=>takePicturesNow(full,opts));
  if(turned){rebuildScene();renderer.render(scene,camera);}   // the view shows the design where it really stands again
  return out;
}
function takePicturesNow(full,opts){
  opts=opts||{};
  const keep={cam:{...cam,target:cam.target.clone()},sel,hidden:hiddenIds,wood:woodMode,picked,explode,dim:VIEW_COL.dim,dimText:VIEW_COL.dimText},W=880,H=560,out={steps:[],views:[]};
  VIEW_COL.dim=VIEW_COL.printDim;VIEW_COL.dimText=VIEW_COL.printDimText; // size lines in drawing gray while the pictures are taken
  sel=new Set();hiddenIds=new Set();woodMode=WOOD_MODES[opts.view]?opts.view:'solid';picked=null;showClosed=!opts.open;explode=0;forceDims=true;rebuildScene();
  scene.background=new THREE.Color(VIEW_COL.printBg); // plain paper behind the printed pictures, not the screen backdrop
  const snap=c=>{renderer.render(scene,c||camera);return renderer.domElement.toDataURL('image/jpeg',.88);};
  renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix();
  fastGroup.visible=woodMode!=='solid';handleGroup.visible=gizmoGroup.visible=false;
  fit('fit');cam.r*=.85;updateCam();out.overview=snap();
  if(full){
    // sized without the pictures that only show where a bought thing goes (a monitor: `picture` on its MATS row), framed
    // round everything drawn
    const all=bbox(S.parts),sized=S.parts.filter(p=>!M[p.mat].picture),b=sized.length?bbox(sized):all;
    grid.visible=floor.visible=false;
    for(const view of FLAT_VIEWS)out.views.push(flatViewPicture(view,b,W,H,snap,all)); // flat views, like a drawing
    grid.visible=floor.visible=true;dimGroup.visible=false;
    // pulled apart: the eye is set so that every piece is in the picture where it now floats, and each piece
    // carries its cut-list letter (aimAtShown, drawPieceLetters: js/steppictures.js)
    const camWas={target:cam.target.clone(),r:cam.r,th:cam.th,ph:cam.ph};
    explode=.55;for(const p of S.parts)setMeshPos(p);
    aimAtShown(()=>true,false);
    const letterOf=cutRows().letterOf;
    out.exploded=annotatedPicture(camera,pen=>drawPieceLetters(pen,S.parts.filter(p=>!isProp(p)),letterOf));
    cam.target.copy(camWas.target);cam.r=camWas.r*1.45;cam.th=camWas.th;cam.ph=camWas.ph;
    explode=0;for(const p of S.parts)setMeshPos(p);cam.r/=1.45;updateCam();
    // one picture per step, with that step's fasteners and numbered balloons, and its close-ups (js/steppictures.js)
    out.steps=stepPictures(buildPlan());
  }
  scene.background=VIEW_BG;VIEW_COL.dim=keep.dim;VIEW_COL.dimText=keep.dimText;
  sel=keep.sel;hiddenIds=keep.hidden;woodMode=keep.wood;picked=keep.picked;showClosed=false;explode=keep.explode;forceDims=false;Object.assign(cam,keep.cam);
  resize();rebuildScene();updateCam();renderer.render(scene,camera);
  return out;
}
/* The tools a design needs. Only what its steps really use: clamps where something is glued or screwed (they hold
   the pieces while you drill), sandpaper where a step sands (hasFinishStep in js/style.js), a staple gun where
   the hardware list has something to staple. */
function toolList(js,plan){const t=new Set(js.map(jType)),sheet=S.parts.some(p=>M[p.mat].kind==='sheet');
  const clamped=['screw','pocket','dowel','nail','glue','bracket'].some(type=>t.has(type));
  const L=['Tape measure, pencil and a square','Saw (a circular saw or miter saw)','Drill/driver with bits'];
  if(clamped)L.push('Clamps');
  if(hasFinishStep())L.push('Sandpaper: '+sandpaperGrits());
  L.push('Safety glasses and hearing protection');
  if((S.hw||[]).some(([item])=>/landscape fabric/i.test(item)))L.push('Staple gun and staples');
  L.push(...drillToolLines(t,plan));   // the bits of DRILL_BITS for the holes step 2 drills, the dowel jig (js/drillplan.js)
  if(t.has('pocket'))L.push('Pocket-hole jig');
  if(t.has('nail'))L.push('Brad nailer, or a hammer and a nail set (a small steel punch that sinks the head of a nail just below the surface)');
  if(t.has('frame')||t.has('toenail'))L.push('Framing hammer (20 oz or so). A framing nailer is much faster if you can borrow or rent one');
  if(sheet)L.push('Straight-edge guide for cutting plywood (or have the store cut it)');
  // what single steps ask for beyond the usual: every tool a step names is in this list (stepTools, js/buildsteps.js)
  // (plan: the build steps, when the caller has them; the count of tools in the Style dialog does without)
  const named=plan?plan.steps.flatMap(step=>step.need?step.need.tools:[]).join('; '):'';
  const words=plan?plan.steps.map(step=>step.words).join(' '):'';
  if(/\blevel\b/i.test(named))L.push(/\bshims?\b/i.test(words)?'Level, and shims (thin wedges of wood or plastic) to stop it rocking':'Level');
  if(/stud finder/i.test(named))L.push('Stud finder, for finding the wall studs');
  if(/Forstner/i.test(named))L.push('1 3/8" Forstner bit, for the cup holes of the hinges');
  if(/3\/16" drill bit/.test(named))L.push('3/16" drill bit, for the screws of pulls and knobs');
  if(/spacer block/i.test(named))L.push('A scrap of wood for a spacer block');
  if(/ladder/i.test(named))L.push('Stepladder');
  if(/household iron/i.test(named))L.push('Household iron and an edge banding trimmer (or a sharp chisel), for the iron-on edge banding');
  if(/right-angle drill/i.test(named))L.push('Right-angle drill attachment and a 3" driver bit, for pocket screws where a drill does not fit');
  if(/foam mat/i.test(named))L.push('A foam mat to go under a rimless tank');
  L.push(...shapeToolLines());   // what the shaped pieces need: a hole saw, a compass and jigsaw (js/shapedrawings.js)
  return L;}

/* ---------- what the three document pages share (Fasteners, Cut list & shopping, Build instructions) ----------
   A page is  <div class="doc"> docHead(sheet name) + sections </div> . The same markup is printed.
   The commands of a page are in the ribbon (the "doc-only" groups in index.html): a button there carries
   data-doc="print" or data-doc="style". */
const docDate=()=>new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
const overallSize=b=>`${fmtFt(b.hi[0]-b.lo[0])} wide × ${fmtFt(b.hi[2]-b.lo[2])} deep × ${fmtFt(b.hi[1]-b.lo[1])} tall`;
const plural=(n,word)=>`${n.toLocaleString()} ${word}${n===1?'':'s'}`;

document.addEventListener('click',e=>{
  const button=e.target.closest('[data-doc]');
  if(!button)return;
  if(button.dataset.doc==='style')openStyle();
  if(button.dataset.doc==='print')printPage(); // hosted.js: the print window, or why there is none in the hosted copy
});

/* the top of a sheet. On screen: the title and one line of facts. On paper: a title block like the one on a
   shop drawing (the style sheet shows one or the other). */
function docHead(sheetName){
  // the size of what is built; a mattress or a tank that stands higher is said apart (builtSize in js/statusbar.js)
  const built=builtSize(S.parts),b=built.box,date=docDate(),toCut=S.parts.filter(p=>!isProp(p)).length+woodStrips().length;
  const size=b?overallSize(b)+(built.with?` (${built.with})`:''):'',style=toCut?STYLES[look().style][0]+' style':'';
  const facts=[size,toCut?plural(toCut,'piece')+' to cut':'',style,date].filter(Boolean).join(' · ');
  setPrintFooter();
  return`<h1>${esc(S.name)}: ${sheetName.toLowerCase()}</h1><div class="meta">${facts}</div>`+
    `<div class="titleblock">`+
      `<div class="tb-name"><small>Project</small><b>${esc(S.name)}</b></div>`+
      `<div><small>Sheet</small><b>${sheetName}</b></div>`+
      `<div><small>Date</small><b>${date}</b></div>`+
      `<div><small>Overall size</small><b>${size||'No pieces yet'}</b></div>`+
      `<div><small>Pieces to cut</small><b>${toCut?toCut.toLocaleString():'None'}</b></div>`+
      `<div><small>Style</small><b>${toCut?STYLES[look().style][0]:'None'}</b></div>`+
      `<div class="tb-made">made with NominalCAD</div>`+
    `</div>`;
}
/* Every printed page gets a footer: the project name on the left, the page number on the right. Browsers only
   take that from an @page rule, so it is written into a small style element of its own. */
function setPrintFooter(){
  let el=$('#printPage');
  if(!el){el=document.createElement('style');el.id='printPage';document.head.appendChild(el);}
  const name=S.name.replace(/[\\"\n\r]/g,' '); // safe inside a quoted string in the style sheet
  const type='font:8pt "Segoe UI",system-ui,Arial,sans-serif;color:#444';
  el.textContent=`@page{@bottom-left{content:"${name} · made with NominalCAD";${type}}@bottom-right{content:"Page " counter(page) " of " counter(pages);${type}}}`;
}
/* a table in the document style. columns = [[heading, 'num' for a column of numbers or ''], ...]; rows = finished <tr> html. */
function docTable(columns,rows,cls){
  const head=columns.map(([text,kind])=>`<th${kind?` class="${kind}"`:''}>${text}</th>`).join('');
  return`<table class="tbl${cls?' '+cls:''}"><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}
const keyBox=letter=>letter?`<span class="key">${letter}</span>`:'';

/* ---------- Cut list & shopping, and Build instructions (instr = true) ---------- */
/* The cut list: one row for every different piece (same material and size), each with a letter that is reused in
   the cutting diagrams and the steps. Also returns how to look a piece's letter up, and what the wood weighs. */
function cutRows(){
  // (a strip of wood that is placed as hardware, a drawer runner or kicker, is cut like any piece: woodStrips, js/hardware.js)
  // A shaped piece (js/shapes.js) is a row of its own for each different shape. A piece whose shape is the mirror
  // image of a row's shape joins that row as its "right" (g.mirrored counts them).
  const blankKey=p=>[p.mat,p.l,p.w,p.t,p.strip?0:angleOf(p)].join('|');
  const groups=new Map(),keyOf=p=>p.shape?blankKey(p)+'|'+shapeKey(p):blankKey(p),groupOf=new Map();
  let pounds=0;
  for(const p of S.parts.concat(woodStrips())){
    if(isProp(p))continue;
    let k=keyOf(p),mirrored=false;
    if(p.shape&&!groups.has(k)){
      const twin=blankKey(p)+'|'+shapeKeyMirror(p);
      if(groups.has(twin)){k=twin;mirrored=true;}
    }
    // (grainOnWidth: a sheet piece cut with its face grain along its width, pieceGrainOnWidth in js/buying.js)
    if(!groups.has(k))groups.set(k,{mat:p.mat,l:p.l,w:p.w,t:p.t,deg:p.strip?0:angleOf(p),qty:0,names:new Set(),strip:!!p.strip,grainOnWidth:pieceGrainOnWidth(p),
      ...(p.shape?{sample:p,mirrored:0}:{})});
    const g=groups.get(k);
    g.qty++;g.names.add(p.name);
    if(mirrored)g.mirrored++;
    groupOf.set(p,g);
    // the same weight for wood as the structural check uses (js/verify.js); a shaped piece weighs what is left of it
    pounds+=(p.shape?pieceVolume(p):p.l*p.w*p.t)*WOOD_RULES.DENSITY;
  }
  const order=id=>MATS.findIndex(m=>m.id===id);
  const rows=[...groups.values()].sort((a,b)=>order(a.mat)-order(b.mat)||b.l-a.l);
  rows.forEach((g,i)=>g.id=(i>=26?String.fromCharCode(64+Math.floor(i/26)):'')+String.fromCharCode(65+i%26)); // A, B ... Z, AA, AB ...
  const byLength=new Map(); // material + length -> letter, for labelling the cuts on a board
  for(const g of rows)if(!byLength.has(g.mat+'|'+g.l))byLength.set(g.mat+'|'+g.l,g.id);
  const stripKey=item=>{const wood=HARDWARE[item.kind]&&HARDWARE[item.kind].wood;return wood?[wood.mat,item.size,wood.w,wood.t,0].join('|'):'';};
  return{rows,pounds,byLength,letterOf:p=>isProp(p)?'':(groupOf.get(p)||groups.get(keyOf(p))||groups.get(blankKey(p)+'|'+shapeKeyMirror(p))).id,
    letterOfStrip:item=>groups.has(stripKey(item))?groups.get(stripKey(item)).id:''};
}
function cutListSection(list){
  const plan=S.parts.length?buildPlan():null,drill=plan&&plan.drill&&plan.drill.total?plan.drill:null;
  const rows=list.rows.map(g=>{
    const m=M[g.mat],ripped=m.kind==='board'&&g.w<m.w-.01;
    // A board that sits at an angle may need its ends cut to fit. A design with steps of its own says exactly
    // how (a rafter: slanted at the top, square at the bottom), so the note points there instead of guessing.
    // A sheet that lies on a slope (a roof deck) is cut square: it gets no note.
    const ownSteps=S.steps&&S.steps.length;
    // A shaped piece says how it is cut and points at its drawing (Shapes to cut, js/shapedrawings.js); a tilted one
    // whose ends are cut no longer says "cut the ends at an angle to fit".
    const shaped=g.sample&&g.sample.shape,endsCut=shaped&&(shapeEnd(g.sample,0)||shapeEnd(g.sample,1));
    const angled=!g.deg||m.kind==='sheet'||endsCut?'':ownSteps?`Sits at ${g.deg}°. The steps say how to cut its ends`:`Sits at ${g.deg}°: cut the ends at an angle to fit`;
    const shapeWords=shaped?shapeRowNote(g):[];   // js/shapedrawings.js
    const grain=m.kind==='sheet'&&g.grainOnWidth?`Cut it with the grain of the face along its ${fmt(g.w)} width`:'';
    const note=[ripped?'Rip to '+fmt(g.w)+' wide'+(g.strip?`, or buy ${fmt(g.w)} square stock (a square dowel) and only cut it to length`:''):'',angled,grain,...shapeWords].filter(Boolean).join('. ');
    return`<tr><td>${keyBox(g.id)}</td><td class="num">${g.qty}</td><td>${esc([...g.names].join(', '))}</td><td class="nowrap">${esc(m.short)}</td>`+
      `<td class="num">${fmt(g.l)}</td><td class="num">${fmt(g.w)}</td><td class="num">${fmt(g.t)}</td>${drill?`<td>${esc(drillColumn(g,drill))}</td>`:''}<td>${note}</td></tr>`;
  });
  // Drill first: which pieces get holes before anything is put together (step 2, js/drillplan.js)
  return`<h2>Cut list</h2><p class="hint">Write the letter on each piece as you cut it. The same letters are used in the cutting diagrams and the steps.`+
    (drill?` The Drill first column says which pieces get holes before you put anything together; Build instructions, step ${drill.stepNo}, has a drawing of each.`:'')+`</p>`+
    docTable([['Label',''],['Qty','num'],['Piece',''],['Cut from',''],['Length','num'],['Width','num'],['Thick','num']].concat(drill?[['Drill first','']]:[],[['Note','']]),rows);
}
/* Cutting diagrams: for each material what to buy, then one bar per board (or one drawing per plywood sheet)
   with the cuts marked. Returns the html and the list of what to buy, which the shopping list is made from. */
const BAR_WIDTH=568; // how wide a cutting bar is drawn on the sheet, in pixels; decides which cuts have room for a label
function diagramSection(list){
  const buy=[];
  // (the grain rule of the sheets: js/buying.js)
  const plywood=S.parts.some(p=>M[p.mat].kind==='sheet'&&M[p.mat].t>SHEET_SKIN_T);
  // (END_TRIM: the spare kept on a board that carries two or more pieces, js/buying.js)
  // (storeLengthsWords: the board lengths bought are the ones home centers usually stock, js/buying.js)
  const stocked=storeLengthsWords(MATS.filter(m=>S.parts.concat(woodStrips()).some(p=>p.mat===m.id)));
  let h=`<h2>Cutting diagrams</h2><p class="hint">${stocked?stocked+' ':''}Diagrams allow 1/8" for each saw cut, and at least ${fmt(END_TRIM)} spare on a board cut into two or more pieces, to square up the end first. Striped areas are leftover.`+
    (plywood?' On 1/2" and 3/4" plywood the grain of the face runs left to right, and every piece lies with its grain along its length'+
      (S.parts.some(pieceGrainOnWidth)?', or along its width where the cut list says so.':'.'):'')+`</p>`;
  for(const m of MATS){
    const pieces=S.parts.concat(woodStrips()).filter(p=>p.mat===m.id);
    if(!pieces.length||m.kind==='prop')continue;
    // what to buy and where each piece is cut from: the one plan the shopping list and the estimate also use (js/buying.js)
    const chosen=STOCKS.includes(S.stock[m.id])?S.stock[m.id]:0;
    const plan=materialBuy(m,pieces,p=>list.letterOf(p),chosen);
    buy.push(...plan.buy);
    if(m.kind==='board'){
      const{boards,tooLong}=plan,longest=Math.max(...boards.map(board=>board.length),1);
      // The lengths are a choice on screen ("Best mix", or one length for all) and plain words on paper (class "printonly").
      const lengthChoices=`<option value="0"${chosen?'':' selected'}>Best mix</option>`+
        STOCKS.map(s=>`<option value="${s}"${s===chosen?' selected':''}>All ${s/12} ft</option>`).join('');
      const wood=m.treated?'':WOOD_ROW_WORDS[look().wood]||'';   // "Cedar 2x6", as on the shopping list (js/prices.js)
      const bought=plan.buy.slice().reverse().map(row=>`${row.qty} × ${row.stock/12} ft`).join(', ');
      h+=`<div class="buy">${esc((wood?wood+' ':'')+m.short)}: ${bought||'none'} <select class="fld noprint" data-stock="${m.id}" title="The lengths of board you will buy: the cheapest mix, or every board the same length">${lengthChoices}</select></div>`;
      if(plan.mixed)h+=`<p class="hint">The pieces longer than ${chosen/12} ft are on longer boards.</p>`;
      if(tooLong.length)h+=`<p class="warn">${plural(tooLong.length,'piece')} ${tooLong.length>1?'are':'is'} longer than ${STOCKS[STOCKS.length-1]/12} ft and cannot be cut from one board.</p>`;
      boards.forEach((board,i)=>{
        const stock=board.length,left=stock-board.used,share=stock/longest;   // a shorter board is drawn shorter
        const cuts=board.cuts.map(item=>{
          const letter=item.letter||'',length=fmt(item.l),room=item.l/stock*BAR_WIDTH*share;
          // a short cut has no room for its length, and a very short one not even for its letter; the tooltip has both
          const label=room>=(letter.length+length.length)*6+12?`<b>${letter}</b>${length}`:room>=letter.length*7+4?`<b>${letter}</b>`:'';
          return`<div style="width:${item.l/stock*100}%" title="${letter} ${esc(length)}">${label}</div>`;
        }).join('');
        const waste=left>.01?`<div class="waste" title="${esc(fmt(left))} left over">${left/stock*BAR_WIDTH*share>=76?`<span>${fmt(left)} left</span>`:''}</div>`:'';
        h+=`<div class="cut"><span>Board ${i+1} of ${boards.length}, ${stock/12} ft</span><div class="board" style="width:${(share*100).toFixed(2)}%">${cuts}${waste}</div></div>`;
      });
    }else{
      // (a corner shelf cut corner to corner is packed two to a square: sheetRects, js/shapedrawings.js)
      const{sheets,over}=plan;
      h+=`<div class="buy">${sheets.length} × ${esc(m.short)}, 4 ft × 8 ft sheet${sheets.length>1?'s':''}</div>`;
      if(sheets.length===1&&sheets[0].items.every(i=>i.x+i.w<=48&&i.y+i.h<=48))h+=`<p class="hint">Everything fits on a half sheet (4 ft × 4 ft) if your store sells them.</p>`;
      if(over.length)h+=`<p class="warn">${over.map(o=>esc(o.name)).join(', ')}: larger than a 4 × 8 sheet.</p>`;
      sheets.forEach((sheet,i)=>{
        // each piece is drawn to scale (1 unit = 1 inch) with two lines of text inside: its letter and name, then its size
        const cuts=sheet.items.map(it=>{
          const size=`${fmt(it.w)} × ${fmt(it.h)}`,longest=Math.max(it.name.length,size.length);
          const type=Math.min(2.6,it.w/(longest*.56),it.h/3.2).toFixed(2),cx=it.x+it.w/2,cy=it.y+it.h/2;
          // a shaped piece draws its real outline inside its rectangle, which is then thin and dashed
          const outline=it.piece||it.diagonal?sheetShapePath(it):'';
          return`<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}"${outline?' class="shaped"':''}><title>${esc(it.name)}, ${esc(size)}</title></rect>`+outline+
            `<text x="${cx}" y="${cy-type*.25}" font-size="${type}" text-anchor="middle">${esc(it.name)}</text>`+
            `<text x="${cx}" y="${cy+type*.95}" font-size="${type}" text-anchor="middle">${esc(size)}</text>`;
        }).join('');
        h+=`<div class="cut ply"><span>Sheet ${i+1} of ${sheets.length}</span><svg class="sheet" viewBox="0 0 96 48">${cuts}</svg></div>`;
      });
    }
  }
  return{html:h,buy};
}
/* (The shopping list, shoppingSection, is in js/prices.js with everything else about prices.) */
/* The numbered steps, from buildPlan() (js/buildsteps.js), which works them out from the design as it is now.
   Each step: what to do; "You need" (the pieces by letter, the fasteners with counts, the tools); "Fasten with"
   (one numbered line for each kind of connection, saying which piece the fastener goes through and which it
   goes into, and where); the hardware mounted in the step; a picture with this step's pieces in orange and its
   fasteners in dark blue, numbered like the lines; and a close-up for each kind of connection.
   shots: the pictures, one entry per step (stepPictures, js/steppictures.js). */
const balloonMark=no=>`<span class="bal">${no}</span>`;
/* the words of one step and the lists under them; Build step by step on screen shows the same (js/stepmode.js) */
function stepTextHtml(step){
  const need=step.need;
  // You need: three short rows
  const pieces=need.pieces.map(row=>`<span class="pc">${row.qty} × ${keyBox(row.letter)}${esc(row.name)}${row.length?', '+row.length:''}</span>`).join('');
  const rows=[];
  if(pieces)rows.push(`<dt>Pieces</dt><dd class="pcs">${pieces}</dd>`);
  if(need.fasteners.length)rows.push(`<dt>${step.kind==='cut'?'Wood':step.kind==='finish'?'Supplies':'Fasteners'}</dt><dd>${esc(need.fasteners.join('; '))}</dd>`);
  if((need.hardware||[]).length)rows.push(`<dt>Hardware</dt><dd>${esc(need.hardware.join('; '))}</dd>`);
  if(need.tools.length)rows.push(`<dt>Tools</dt><dd>${esc(need.tools.join('; '))}</dd>`);
  const youNeed=`<div class="need you"><h4>You need</h4>${rows.length?`<dl>${rows.join('')}</dl>`:'<div>Nothing new for this step.</div>'}</div>`;
  // Fasten with: numbered lines; the preset's own lines for joints the program cannot see come after them
  // (a line whose holes are drilled in step 2 names their settings with the hexagon tag of the drawings: js/drillplan.js)
  const tagged=text=>esc(text).replace(/⬡(\d+)/g,(all,no)=>typeof tagSvg==='function'?tagSvg(no):all);
  const lines=step.groups.map(group=>`<li data-line="${group.no}">${balloonMark(group.no)}<span>${esc(group.line)}${group.where?' '+tagged(group.where):''}</span></li>`)
    .concat(step.extra.map(line=>`<li><span class="bal none"></span><span>${esc(line)}</span></li>`));
  const fasten=lines.length?`<div class="need fasten"><h4>Fasten with</h4><ul>${lines.join('')}</ul></div>`:'';
  const hardware=step.hardware.length?`<div class="need hw"><h4>Hardware in this step</h4><ul>${step.hardware.map(row=>`<li>${balloonMark(row.no)}<span>${esc(row.line)}</span></li>`).join('')}</ul></div>`:'';
  const was=step.was?`<p class="was">You changed the pieces of this step, or a piece it gave a measurement for, so the words above were written from the pieces as they are now. Before your change the step read: “${esc(step.was)}” Sizes and counts in that older sentence may no longer be right.</p>`
    // a step that adds no piece cannot be written again from its pieces; it says that its numbers may be old
    :step.stale?'<p class="was">You changed a piece that this step gives a measurement for. The numbers in the sentence above were written before your change: check them against the lines and the pictures of this step.</p>':'';
  // Put in: which way a drilled piece goes in (placementWords, js/drillplan.js)
  const put=step.put?`<p class="put"><b>Put in</b>${esc(step.put.replace(/^Put in: /,''))}</p>`:'';
  return`<p>${esc(step.words)}</p>${was}${put}${youNeed}${fasten}${hardware}`;
}
function stepsSection(plan,shots){
  let intro='In each picture the pieces added in that step are orange and the pieces that are already built are pale. '+
    'The fasteners of the step are drawn in dark blue, right through the wood, so you can see where each one ends. '+
    'A number in a circle points at one place where the line with the same number under "Fasten with" is used. A letter in a small box is the cut-list letter of that piece. Click a picture to see it large.';
  if(plan.suggested)intro=SUGGESTED_NOTE+' '+intro;
  else if(plan.rewritten||plan.added){
    // every step that is not the preset's own any more is counted: the ones written again, and the ones added
    const again=plan.rewritten?`${plan.rewritten===1?'one step was':plan.rewritten+' steps were'} written again from the pieces as they are now (${plan.rewritten===1?'it says':'they say'} so)`:'';
    const fresh=plan.added?`${plan.added===1?'one step was':plan.added+' steps were'} added for the pieces you added`:'';
    intro+=` You changed the design after the preset made it, so ${[again,fresh].filter(Boolean).join(' and ')}.`;
  }
  let h=`<h2>Steps</h2><p class="hint">${esc(intro)}</p>`;
  plan.steps.forEach((step,index)=>{
    const shot=shots[index]||{src:'',closeups:[]};
    const under=(shot.notes||[]).slice();   // what the picture shows when that is not simply "the design so far" (stepScene, js/steppictures.js)
    if(shot.total>shot.drawn)under.push(`This picture shows ${shot.drawn} of the ${shot.total.toLocaleString()} fasteners of this step.`);
    const picture=shot.src?`<figure class="step-pic"><img src="${shot.src}" alt="Step ${step.no}">${under.length?`<figcaption>${esc(under.join(' '))}</figcaption>`:''}</figure>`:'';
    // a close-up is two pictures side by side: how it goes in (3D) and where to mark (flat, with the sizes)
    const closeups=shot.closeups.length?`<div class="closeups">${shot.closeups.map(close=>
      `<figure class="${close.mark?'pair':''}" data-words="${esc(close.words||'')}"><div class="halves"><img src="${close.src}" alt="Close-up of line ${close.no} of step ${step.no}: how it goes in">`+
      (close.mark?`<img ${markImageSource(close.mark)} alt="Close-up of line ${close.no} of step ${step.no}: where to mark">`:'')+
      `</div><figcaption>${balloonMark(close.no)} <span>${esc(close.caption)}</span></figcaption></figure>`).join('')}</div>`:'';
    const marks=shot.markView?`<div class="markviews"><figure><img ${markImageSource(shot.markView.src)} alt="The pencil marks of step ${step.no}"><figcaption>${esc(shot.markView.caption)}</figcaption></figure></div>`:'';
    // step 2, Drill your pieces: its drawings span the width of the page (js/partdrawings.js)
    if(step.kind==='drill'){h+=`<div class="step nopic drill" data-step="${step.no}" data-source="${step.source}"><div class="no">${step.no}</div>${drillStepHtml(step,plan)}</div>`;return;}
    h+=`<div class="step${shot.src?'':' nopic'}" data-step="${step.no}" data-source="${step.source}"><div class="no">${step.no}</div>`+
      `<div class="step-text">${stepTextHtml(step)}</div>${picture}${marks}${closeups}</div>`;
  });
  return h;
}
/* the src of a marking view: a key ('markview:N') is drawn later, when it is seen (fillMarkViews, js/markingview.js) */
const markImageSource=mark=>/^markview:/.test(mark)?`src="${MARK_BLANK}" data-mark="${mark}"`:`src="${mark}"`;
/* A click on a picture of a document page shows it at its full size (the pictures are taken 880 pixels wide and
   shown much smaller beside the words); a click anywhere, or Esc, puts it away. The bar under the picture holds
   its caption (the number of its line in its circle, then the words) and, at the right, how to close it: no tip
   pops up over the picture.
     caption   {no, text, where}: the line number for the circle (or none), the words, and where the line says
               the fasteners go (shown under the bar, so the picture need not be closed to read it) */
function showPictureLarge(source,caption){
  let holder=$('#picZoom');
  if(!holder){
    holder=document.createElement('div');
    holder.id='picZoom';
    document.body.appendChild(holder);
    holder.onclick=()=>{holder.hidden=true;};
  }
  const words=caption&&caption.text||'',where=caption&&caption.where||'';
  const number=caption&&caption.no?balloonMark(caption.no)+' ':'';
  holder.innerHTML=`<figure><img src="${source}" alt=""><figcaption><span class="zcap">${number}<span>${esc(words)}</span></span>`+
    `<span class="zclose">Click anywhere or press Esc to close</span></figcaption>${where?`<p class="zwhere">${esc(where)}</p>`:''}</figure>`;
  holder.hidden=false;
}
document.addEventListener('click',event=>{
  const picture=event.target.closest&&event.target.closest('.doc .step img, .doc .views img, .doc img.wide, .doc #shot');
  if(!picture)return;
  // (a marking view not drawn yet is drawn now)
  if(picture.dataset.mark){picture.src=markingSource(picture.dataset.mark)||picture.src;delete picture.dataset.mark;}
  const figure=picture.closest('figure'),caption=figure&&figure.querySelector('figcaption');
  const badge=caption&&caption.querySelector('.bal');
  let text=caption?(badge?caption.textContent.replace(badge.textContent,'').trim():caption.textContent.trim()):picture.alt;
  // a picture of a close-up pair says which half it is, and the words of its line come with it
  const halves=picture.closest('.halves');
  if(halves){
    const index=[...halves.querySelectorAll('img')].indexOf(picture);
    const which=index===0?'How it goes in':'Where to mark';
    text=`${which}. ${text}`;
  }
  showPictureLarge(picture.src,{no:badge?badge.textContent:'',text,where:figure&&figure.dataset.words||''});
});
document.addEventListener('keydown',event=>{
  const holder=$('#picZoom');
  if(event.key==='Escape'&&holder&&!holder.hidden){holder.hidden=true;event.stopPropagation();}
},true);
function fastenerSection(joints){
  const groups=jointGroups(joints).filter(g=>g.js.some(j=>jType(j)!=='none'));
  if(!groups.length)return'';
  // one row for each pair of pieces and fastener: the same two pieces can meet in two ways (face to face here,
  // end to face there) and still take the same fastener, and those are counted together
  const merged=new Map();
  for(const g of groups){
    const types=new Set(g.js.map(jType));
    let how='More than one kind: the steps say which goes where';
    if(types.size===1){
      // joints of different lengths take different counts: then the row gives the total, not the count of the first joint
      const specs=g.js.map(j=>jSpec(j,[...types][0])),counts=new Set(specs.map(spec=>spec.n));
      how=specs[0].text;
      if(counts.size>1&&/^\d+ × /.test(how))how=how.replace(/^\d+ × /,'')+` (${specs.reduce((sum,spec)=>sum+spec.n,0)} in all: more in a longer joint)`;
    }
    // the piece the fastener goes through is named first, as in the lines of the steps ("Top to Leg": through the
    // Top into the Leg), read from the same layout the 3D view draws
    const firstFastened=g.js.find(j=>jType(j)!=='none'),laid=firstFastened?fastenerLayout(firstFastened,jType(firstFastened))[0]:null;
    const pair=laid?[laid.through.name,laid.into.name]:[g.A[0],g.B[0]];
    const key=pair[0]+'|'+pair[1]+'|'+how;
    if(!merged.has(key))merged.set(key,{pair:`${pair[0]} to ${pair[1]}`,count:0,how});
    merged.get(key).count+=g.js.length;
  }
  const rows=[...merged.values()].map(row=>`<tr><td>${esc(row.pair)}</td><td class="num">${row.count}</td><td>${esc(row.how)}</td></tr>`);
  return`<h2>Which fastener goes where</h2><p class="hint">The piece named first is the one the fastener goes through (for pocket holes: the piece the holes are drilled in); it ends in the piece named second.</p>`+
    docTable([['Join',''],['Joints','num'],['With, per joint','']],rows);
}
/* The pictures of a page are taken once for a design and kept until it changes: going to another tab and back,
   or a click that only draws the page again, costs nothing. The plan (buildPlan) is made new at every change of
   the design or of its style, so a new plan means new pictures. */
let picturesMemo=null;   // {plan, key, full: the pictures of Build instructions, top: the one picture of Cut list & shopping}
function picturesFor(instr){
  const plan=buildPlan(),key=[viewMode,S.parts.length].join('|'),slot=instr?'full':'top';
  if(!picturesMemo||picturesMemo.plan!==plan||picturesMemo.key!==key)picturesMemo={plan,key,full:null,top:null};
  if(!picturesMemo[slot])picturesMemo[slot]=takePictures(instr);
  return picturesMemo[slot];
}
function renderCut(instr){
  const page=$(instr?'#instrPage':'#cutPage'),sheetName=instr?'Build instructions':'Cut list and shopping';
  if(!S.parts.length){
    page.innerHTML=`<div class="doc">${docHead(sheetName)}<p>Add some pieces in the Design tab first, or pick a furniture preset.</p></div>`;
    return;
  }
  const pics=picturesFor(instr),list=cutRows(),joints=findJoints(),L=look();

  // the top of the sheet: a picture of the whole design beside a few facts
  const facts=[['Wood',WOODS[L.wood][0]],['Finish',FINISHES[L.finish][0]],['Weight of the wood',`about ${Math.round(list.pounds).toLocaleString()} lb`]];
  if(instr){
    const rating=assess(L);
    facts.push(['Skill',rating.level],['Working time',`about ${rating.hours} hour${rating.hours>1?'s':''}`]);
  }
  let h=docHead(sheetName)+
    `<div class="lead"><img id="shot" src="${pics.overview||''}" alt="The finished design"><dl class="facts">${facts.map(([name,value])=>`<dt>${name}</dt><dd>${esc(value)}</dd>`).join('')}</dl></div>`;
  if(S.notes&&S.notes.length)h+=`<h2>Notes</h2><ul>${S.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`;
  if(window.wordsSection)h+=wordsSection(); // Beginner: the names this design uses for its pieces, explained (js/glossary.js)
  if(instr&&pics.views.length){
    // three drawings, two to a row; the fourth place says what the sizes measure
    const figures=pics.views.map(view=>`<figure><img src="${view.src}" alt="${view.name} view"><figcaption>${esc(view.caption)}</figcaption></figure>`).join('');
    h+=`<h2>Views with sizes</h2><div class="views">${figures}`+
      `<p class="hint">Overall sizes, measured to the outside of the outermost pieces${S.parts.some(p=>isProp(p)&&!M[p.mat].picture)?', counting a fish tank or a mattress that is drawn':''}${S.parts.some(p=>M[p.mat].picture)?' (not the pictures of a monitor or a computer, which only show where they go)':''}. Wide is left to right, deep is front to back, tall is from the floor up. The size of every single piece is in the cut list.</p></div>`+
      `<h2>How it goes together</h2><img class="wide" src="${pics.exploded}" alt="The pieces pulled apart"><p class="hint">The pieces pulled apart so you can see each one, each with its letter from the cut list. The steps below show the order.</p>`;
  }
  if(instr)h+=`<h2>Tools you need</h2><ul class="cols">${toolList(joints,buildPlan()).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`;
  const diagrams=diagramSection(list),hardware=hardwareTotals(joints);
  h+=cutListSection(list)+shapesSection(list)+shoppingSection(diagrams.buy,hardware)+diagrams.html; // shoppingSection: js/prices.js; shapesSection: js/shapedrawings.js
  h+=`<h2>Hardware</h2>`+hwTable(hardwareWithoutSheets(hardware));   // (a sheet of plywood to cut on site is lumber: js/prices.js)
  if(instr)h+=stepsSection(buildPlan(),pics.steps);
  h+=fastenerSection(joints);

  page.innerHTML=`<div class="doc">${h}</div>`; // (the price boxes of the shopping list are wired in js/prices.js)
  if(instr)fillMarkViews(page);   // the marking views are drawn as they are seen (js/markingview.js)
  // a board length chosen on the cutting diagrams; "Best mix" (0) takes the choice away again (js/buying.js)
  page.querySelectorAll('select[data-stock]').forEach(choice=>choice.onchange=()=>{
    if(+choice.value)S.stock[choice.dataset.stock]=+choice.value;else delete S.stock[choice.dataset.stock];
    commit();
  });
}

/* ---------- self-check: the steps and the lists under them say the same thing ----------
   (selfTest runs every function in SELFTESTS, see js/core.js.) A beginner reads a step and then the list under
   it, and builds what they say. So, for every preset as it comes:
     - a way of fastening that a step names (pocket holes, L-brackets, glue) has its hardware on the lists;
     - what the shopping list buys for finishing is used by a step, and a design that starts with a finish has
       the finishing step;
     - no "Fasten with" line is written for two pieces that only touch (the pairs that once had one are listed
       in ONLY_TOUCH), and no step carries two lines for the same pair of pieces with two different fasteners. */
const ONLY_TOUCH={
  'Platform bed':[['Side rail','Slat'],['End rail','Slat'],['Cleat','Leg']],
  'Garage shelves':[['Post','Shelf deck']],
  'Workbench':[['Leg','Lower shelf']],
  'Dining table':[['Top board','Top board']],
  'Base cabinet with doors':[['Countertop','Side']],
  'Planter box':[['Bottom slat','Long side'],['Corner post','Slat cleat']]
};
SELFTESTS.push(function stepsAgreeWithLists(problems){
  for(const preset of PRESETS){
    const vals=presetDefaults(preset);
    let parts=[];
    try{parts=preset.build(vals)||[];}catch(e){}
    if(!parts.length)continue;
    placePreset(preset,vals,parts,false);
    const label=preset.name+': ',joints=findJoints(),hardware=hardwareTotals(joints);
    const items=hardware.rows.map(row=>row[0]).join(' | '),steps=S.steps||[];
    const words=steps.map(stepText).join(' ');
    if(/pocket/i.test(words)&&!/pocket-hole screws/.test(items))problems.push(label+'a step fastens with pocket holes, and no pocket-hole screws are on the hardware list');
    if(/L-bracket/i.test(words)&&!/L-brackets/.test(items)&&!/corner braces/i.test(items))problems.push(label+'a step offers L-brackets, and none are on the hardware list');
    if(hardware.glue&&!/glue/i.test(words))problems.push(label+'wood glue is on the shopping list and no step glues anything');
    const sands=/\bsand/i.test(words);
    if(/Sandpaper/.test(items)&&!sands)problems.push(label+'sandpaper is on the shopping list and no step sands');
    if(/Polyurethane|Paint|stain/.test(items)&&!steps.some(isFinishStep))problems.push(label+'a finish is on the shopping list and the steps have no finishing step');
    if(/320 grit/.test(words)&&!/320/.test(items))problems.push(label+'the finishing step asks for 320 grit sandpaper that is not on the shopping list');
    for(const[a,b]of ONLY_TOUCH[preset.name]||[]){
      const fastened=joints.filter(j=>((j.a.name===a&&j.b.name===b)||(j.a.name===b&&j.b.name===a))&&jType(j)!=='none');
      if(fastened.length)problems.push(`${label}a fastener is listed between the ${a} and the ${b}, which only touch`);
    }
  }
  // The fish stand: the bottom deck only touches the posts; the countertop lies on the post tops and, in Everyday,
  // only rests there (it is held from underneath, js/fishtop.js), so no screw is listed down through it.
  const stand=PRESETS.find(candidate=>candidate.name==='Single aquarium stand');
  if(stand){
    const vals=presetDefaults(stand);
    placePreset(stand,vals,stand.build(vals),false);
    const between=(a,b)=>findJoints().filter(j=>(j.a.name===a&&j.b.name===b)||(j.a.name===b&&j.b.name===a));
    const postDeck=between('Post','Shelf deck'),postTop=between('Post','Countertop');
    if(postDeck.some(j=>jType(j)!=='none')||!postTop.length||postTop.some(j=>jType(j)!=='none'))problems.push('Single aquarium stand: the bottom deck only touches the posts and the countertop only rests on their tops; the fastener list must say both');
    if(between('Shelf deck','Upright').some(j=>jType(j)!=='none'))problems.push('Single aquarium stand: an upright cannot be screwed from under the deck it stands on');
    if(/pocket/.test(hardwareTotals(findJoints()).rows.map(row=>row[0]).join(' '))&&!/pocket screws/.test(S.steps.map(stepText).join(' ')))problems.push('Single aquarium stand: pocket-hole screws are on its list, and its steps use none');
    const steps=S.steps,finish=steps.findIndex(isFinishStep),doors=steps.findIndex(step=>step.add.includes('Door'));
    if(finish<0||doors<finish)problems.push('Single aquarium stand: the finish goes on before the doors are hung');
    if(/Stack upward|above the feet/.test(steps.map(step=>step.t).join(' ')))problems.push('Single aquarium stand: its steps are still the ones written for a rack of many rows');
  }
});
