/* NominalCAD: cut list, shopping list, cutting diagrams and printable instructions */
'use strict';
/* ---------- cut list ---------- */
const STOCKS=[72,96,120,144,192];
// rough price of an 8 ft board or a full sheet, in dollars; the user can overwrite these in the shopping list
const PRICE8={'1x2':2.5,'1x3':4,'1x4':6,'1x6':10,'1x8':14,'1x10':19,'1x12':25,'2x2':3.5,'2x3':3.3,'2x4':3.9,'2x6':6.5,'2x8':9,'2x10':13,'2x12':17,'4x4':10,ply34:55,ply12:40,ply14:25};
let userPrice={};try{userPrice=JSON.parse(localStorage.getItem('woodshop.prices'))||{};}catch(e){}
const pkey=id=>(look().wood==='pine'?'':look().wood+':')+id; // typed prices are remembered per wood type
const priceOf=(id,stock)=>(userPrice[pkey(id)]??(PRICE8[id]??0)*(M[id].kind==='sheet'?Math.pow(WOODS[look().wood][2],.6):WOODS[look().wood][2]))*(stock?stock/96:1);
function packBoards(lens,stock){const K=.125,bins=[];
  lens.slice().sort((a,b)=>b-a).forEach(l=>{let b=bins.find(b=>b.used+(b.cuts.length?K:0)+l<=stock+1e-6);
    if(!b){b={used:0,cuts:[]};bins.push(b);}b.used+=(b.cuts.length?K:0)+l;b.cuts.push(l);});return bins;}
/* How the panels are laid out on 4 x 8 sheets. Rows are filled left to right, and the order the panels are
   taken in decides how well they pack, so three orders are tried (longest side first, widest first, biggest
   first) and the one that needs the fewest sheets is kept. Longest side first wins a tie. */
const SHEET_ORDERS=[
  (p,q)=>Math.max(q.a,q.b)-Math.max(p.a,p.b),
  (p,q)=>Math.min(q.a,q.b)-Math.min(p.a,p.b)||Math.max(q.a,q.b)-Math.max(p.a,p.b),
  (p,q)=>q.a*q.b-p.a*p.b];
function packSheets(rects){
  let best=null;
  for(const order of SHEET_ORDERS){
    const tried=packSheetsIn(rects.slice().sort(order));
    if(!best||tried.sheets.length<best.sheets.length)best=tried;
  }
  return best;
}
function packSheetsIn(rects){const SW=96,SH=48,K=.125,sheets=[],over=[];
  for(const r of rects){
    const opts=[[r.a,r.b],[r.b,r.a]].filter(([w,h])=>w<=SW+1e-6&&h<=SH+1e-6);
    if(!opts.length){over.push(r);continue;}
    let placed=false;
    outer:for(const sh of sheets){
      for(const sf of sh.shelves){const ft=opts.filter(([w,h])=>h<=sf.h+1e-6&&sf.x+w<=SW+1e-6).sort((p,q)=>p[0]-q[0])[0];
        if(ft){sh.items.push({x:sf.x,y:sf.y,w:ft[0],h:ft[1],name:r.name});sf.x+=ft[0]+K;placed=true;break outer;}}
      const ft=opts.filter(([w,h])=>sh.y+h<=SH+1e-6).sort((p,q)=>p[1]-q[1])[0];
      if(ft){sh.shelves.push({y:sh.y,h:ft[1],x:ft[0]+K});sh.items.push({x:0,y:sh.y,w:ft[0],h:ft[1],name:r.name});sh.y+=ft[1]+K;placed=true;break;}
    }
    if(!placed){const ft=opts.sort((p,q)=>p[1]-q[1])[0];sheets.push({y:ft[1]+K,shelves:[{y:0,h:ft[1],x:ft[0]+K}],items:[{x:0,y:0,w:ft[0],h:ft[1],name:r.name}]});}
  }
  return{sheets,over};}
/* What a list of pieces takes to buy: how many boards, how many plywood sheets, and roughly what they cost.
   stock = the board length chosen for each material, e.g. {'2x4':120}; anything not listed is bought as 8 ft boards,
   or as the shortest board that is long enough for the longest piece. */
function lumberToBuy(parts,stock){
  let boards=0,sheets=0,cost=0;
  for(const m of MATS){
    if(m.kind==='prop')continue;
    const pieces=parts.filter(p=>p.mat===m.id);
    if(!pieces.length)continue;
    if(m.kind==='board'){
      const lengths=pieces.map(p=>p.l),longest=Math.max(...lengths);
      let boardLength=(stock&&stock[m.id])||96;
      if(longest>boardLength)boardLength=STOCKS.find(s=>s>=longest)||192;
      const count=packBoards(lengths.filter(l=>l<=boardLength),boardLength).length;
      boards+=count;
      cost+=count*priceOf(m.id,boardLength);
    }else{
      const count=packSheets(pieces.map(p=>({a:p.l,b:p.w,name:''}))).sheets.length;
      sheets+=count;
      cost+=count*priceOf(m.id,0);
    }
  }
  return{boards,sheets,cost};
}
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
/* Takes the picture of one flat view. b = the bounds of the design, W x H = the picture in pixels, snap = takes the
   picture through a camera. Returns {name, src, caption}. Everything is laid out in label heights ("unit"), so
   the labels read the same on every design, large or small. */
function flatViewPicture(view,b,W,H,snap){
  const A=view.across,U=view.upward,depth=3-A-U;
  const sizeAcross=b.hi[A]-b.lo[A],sizeUp=b.hi[U]-b.lo[U];
  const acrossLabel=textSprite(fmtFt(sizeAcross),[0,0,0],1,VIEW_COL.dimText),upLabel=textSprite(fmtFt(sizeUp),[0,0,0],1,VIEW_COL.dimText);
  upLabel.material.rotation=Math.PI/2; // the upright size is written along its line, reading upward, as on a drawing
  // Room around the design, in units: half a unit on the left and on top; below and to the right a gap, the
  // size line, and the half of its label that sticks out past the line (ROOM in all).
  const GAP=.8,PAD=.5,ROOM=GAP+.5+.3;
  const frameWide=Math.max(sizeAcross/(1-(PAD+ROOM)*FLAT_LABEL),sizeUp/(H/W-(PAD+ROOM)*FLAT_LABEL)); // the picture's width in inches: whichever of the two directions needs more
  const frameHigh=frameWide*H/W,unit=FLAT_LABEL*frameWide;
  const spareAcross=frameWide-sizeAcross-(PAD+ROOM)*unit,spareUp=frameHigh-sizeUp-(PAD+ROOM)*unit; // shared out evenly on both sides

  // the camera looks at the middle of the design; its frame is measured from there
  const middle=b.lo.map((v,i)=>(v+b.hi[i])/2),far=Math.hypot(b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2])+50;
  const left=-sizeAcross/2-PAD*unit-spareAcross/2,bottom=-sizeUp/2-ROOM*unit-spareUp/2;
  const eye=new THREE.OrthographicCamera(left,left+frameWide,bottom+frameHigh,bottom,.1,far*4);
  eye.position.set(middle[0]+view.from[0]*far,middle[1]+view.from[1]*far,middle[2]+view.from[2]*far);
  eye.up.set(view.up[0],view.up[1],view.up[2]);
  eye.lookAt(middle[0],middle[1],middle[2]);

  // the two size lines, placed in the scene so that they land below and to the right of the design in the picture
  const towardRight=view.flipAcross?-1:1,towardTop=view.flipUpward?-1:1;
  const point=(across,upward)=>{const p=[0,0,0];p[A]=across;p[U]=upward;p[depth]=view.from[depth]>0?b.hi[depth]:b.lo[depth];return p;};
  const below=(towardTop>0?b.lo[U]:b.hi[U])-towardTop*GAP*unit,beside=(towardRight>0?b.hi[A]:b.lo[A])+towardRight*GAP*unit;
  emptyGroup(dimGroup);
  dimGroup.visible=true;
  dimGroup.add(dimLine(point(b.lo[A],below),point(b.hi[A],below),U,unit*.35),dimLine(point(beside,b.lo[U]),point(beside,b.hi[U]),A,unit*.35));
  const put=(label,at)=>{label.scale.multiplyScalar(unit);label.position.set(at[0],at[1],at[2]);dimGroup.add(label);};
  put(acrossLabel,point(middle[A],below));
  put(upLabel,point(beside,middle[U]));
  return{name:view.name,src:snap(eye),caption:`${view.name}: ${fmtFt(sizeAcross)} ${view.sizes[0]} × ${fmtFt(sizeUp)} ${view.sizes[1]}`};
}

/* Every picture for the plans, taken in one go from a clean copy of the scene (nothing selected, hidden, see-through or exploded):
   an overview, flat front / side / top views with sizes, a pulled-apart view, and one picture per step. */
function takePictures(full){
  const keep={cam:{...cam,target:cam.target.clone()},sel,hidden:hiddenIds,xray,explode,dim:VIEW_COL.dim,dimText:VIEW_COL.dimText},W=880,H=560,out={steps:[],views:[]};
  VIEW_COL.dim=VIEW_COL.printDim;VIEW_COL.dimText=VIEW_COL.printDimText; // size lines in drawing gray while the pictures are taken
  sel=new Set();hiddenIds=new Set();xray=false;explode=0;forceDims=true;rebuildScene();
  scene.background=new THREE.Color(VIEW_COL.printBg); // plain paper behind the printed pictures, not the screen backdrop
  const snap=c=>{renderer.render(scene,c||camera);return renderer.domElement.toDataURL('image/jpeg',.88);};
  renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix();
  fastGroup.visible=handleGroup.visible=gizmoGroup.visible=false;
  fit('fit');cam.r*=.85;updateCam();out.overview=snap();
  if(full){
    const b=bbox(S.parts);
    grid.visible=floor.visible=false;
    for(const view of FLAT_VIEWS)out.views.push(flatViewPicture(view,b,W,H,snap)); // flat views, like a drawing
    grid.visible=floor.visible=true;dimGroup.visible=false;
    explode=.55;for(const p of S.parts)setMeshPos(p);cam.r*=1.45;updateCam();out.exploded=snap(); // pulled apart
    explode=0;for(const p of S.parts)setMeshPos(p);cam.r/=1.45;updateCam();
    const seen=new Set();
    for(const st of S.steps||[]){const nw=new Set(st.add);st.add.forEach(n=>seen.add(n));let any=false; // pieces so far, new ones in orange
      for(const p of S.parts){const g=meshes.get(p.id),v=seen.has(p.name);g.visible=v;
        if(v){if(nw.has(p.name))any=true;g.children[0].material.color.setHex(isProp(p)?M[p.mat].color:nw.has(p.name)?0xf2a03d:0xe6c592);}}
      out.steps.push(any?snap():'');}
  }
  scene.background=VIEW_BG;VIEW_COL.dim=keep.dim;VIEW_COL.dimText=keep.dimText;
  sel=keep.sel;hiddenIds=keep.hidden;xray=keep.xray;explode=keep.explode;forceDims=false;Object.assign(cam,keep.cam);
  resize();rebuildScene();updateCam();renderer.render(scene,camera);
  return out;
}
function toolList(js){const t=new Set(js.map(jType)),sheet=S.parts.some(p=>M[p.mat].kind==='sheet');
  const L=['Tape measure, pencil and a square','Saw (a circular saw or miter saw)','Drill/driver with bits','Clamps','Sandpaper: 80, 120 and 180 grit','Safety glasses and hearing protection'];
  if(t.has('screw'))L.push('Countersink or pilot-hole bit (1/8")');
  if(t.has('pocket'))L.push('Pocket-hole jig');
  if(t.has('dowel'))L.push('Dowel jig and a mallet');
  if(t.has('nail'))L.push('Brad nailer, or a hammer and nail set');
  if(sheet)L.push('Straight-edge guide for cutting plywood (or have the store cut it)');
  if(S.notes&&S.notes.length)L.push('Level and shims');
  return L;}

/* ---------- what the three document pages share (Joints & hardware, Cut list & shopping, Build instructions) ----------
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
  const b=bbox(S.parts),date=docDate(),toCut=S.parts.filter(p=>!isProp(p)).length;
  const size=b?overallSize(b):'',style=toCut?STYLES[look().style][0]+' style':'';
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
  const groups=new Map(),keyOf=p=>[p.mat,p.l,p.w,p.t,angleOf(p)].join('|');
  let pounds=0;
  for(const p of S.parts){
    if(isProp(p))continue;
    const k=keyOf(p);
    if(!groups.has(k))groups.set(k,{mat:p.mat,l:p.l,w:p.w,t:p.t,deg:angleOf(p),qty:0,names:new Set()});
    const g=groups.get(k);
    g.qty++;g.names.add(p.name);
    pounds+=p.l*p.w*p.t*(M[p.mat].kind==='sheet'?.02:.017);
  }
  const order=id=>MATS.findIndex(m=>m.id===id);
  const rows=[...groups.values()].sort((a,b)=>order(a.mat)-order(b.mat)||b.l-a.l);
  rows.forEach((g,i)=>g.id=(i>=26?String.fromCharCode(64+Math.floor(i/26)):'')+String.fromCharCode(65+i%26)); // A, B ... Z, AA, AB ...
  const byLength=new Map(); // material + length -> letter, for labelling the cuts on a board
  for(const g of rows)if(!byLength.has(g.mat+'|'+g.l))byLength.set(g.mat+'|'+g.l,g.id);
  return{rows,pounds,byLength,letterOf:p=>isProp(p)?'':groups.get(keyOf(p)).id};
}
function cutListSection(list){
  const rows=list.rows.map(g=>{
    const m=M[g.mat],ripped=m.kind==='board'&&g.w<m.w-.01;
    const note=[ripped?'Rip to '+fmt(g.w)+' wide':'',g.deg?`Sits at ${g.deg}°: cut the ends at an angle to fit`:''].filter(Boolean).join('. ');
    return`<tr><td>${keyBox(g.id)}</td><td class="num">${g.qty}</td><td>${esc([...g.names].join(', '))}</td><td class="nowrap">${esc(m.short)}</td>`+
      `<td class="num">${fmt(g.l)}</td><td class="num">${fmt(g.w)}</td><td class="num">${fmt(g.t)}</td><td>${note}</td></tr>`;
  });
  return`<h2>Cut list</h2><p class="hint">Write the letter on each piece as you cut it. The same letters are used in the cutting diagrams and the steps.</p>`+
    docTable([['Label',''],['Qty','num'],['Piece',''],['Cut from',''],['Length','num'],['Width','num'],['Thick','num'],['Note','']],rows);
}
/* Cutting diagrams: for each material what to buy, then one bar per board (or one drawing per plywood sheet)
   with the cuts marked. Returns the html and the list of what to buy, which the shopping list is made from. */
const BAR_WIDTH=568; // how wide a cutting bar is drawn on the sheet, in pixels; decides which cuts have room for a label
function diagramSection(list){
  const buy=[];
  let h=`<h2>Cutting diagrams</h2><p class="hint">Diagrams allow 1/8" for each saw cut. Striped areas are leftover.</p>`;
  for(const m of MATS){
    const pieces=S.parts.filter(p=>p.mat===m.id);
    if(!pieces.length||m.kind==='prop')continue;
    if(m.kind==='board'){
      const lengths=pieces.map(p=>p.l),longest=Math.max(...lengths);
      let stock=S.stock[m.id]||96;
      if(longest>stock)stock=STOCKS.find(s=>s>=longest)||192;
      const boards=packBoards(lengths.filter(l=>l<=stock),stock),tooLong=lengths.filter(l=>l>stock);
      buy.push({m,qty:boards.length,stock});
      const lengthChoices=STOCKS.map(s=>`<option value="${s}"${s===stock?' selected':''}>${s/12} ft</option>`).join('');
      // the board length is a choice on screen and plain words on paper (class "printonly")
      h+=`<div class="buy">${boards.length} × ${esc(m.short)}, <select class="fld noprint" data-stock="${m.id}" title="The length of board you will buy">${lengthChoices}</select><span class="printonly">${stock/12} ft</span> long</div>`;
      if(tooLong.length)h+=`<p class="warn">${plural(tooLong.length,'piece')} ${tooLong.length>1?'are':'is'} longer than 16 ft and cannot be cut from one board.</p>`;
      boards.forEach((board,i)=>{
        const left=stock-board.used;
        const cuts=board.cuts.map(l=>{
          const letter=list.byLength.get(m.id+'|'+l)||'',length=fmt(l),room=l/stock*BAR_WIDTH;
          // a short cut has no room for its length, and a very short one not even for its letter; the tooltip has both
          const label=room>=(letter.length+length.length)*6+12?`<b>${letter}</b>${length}`:room>=letter.length*7+4?`<b>${letter}</b>`:'';
          return`<div style="width:${l/stock*100}%" title="${letter} ${esc(length)}">${label}</div>`;
        }).join('');
        const waste=left>.01?`<div class="waste" title="${esc(fmt(left))} left over">${left/stock*BAR_WIDTH>=76?`<span>${fmt(left)} left</span>`:''}</div>`:'';
        h+=`<div class="cut"><span>Board ${i+1} of ${boards.length}</span><div class="board">${cuts}${waste}</div></div>`;
      });
    }else{
      const{sheets,over}=packSheets(pieces.map(p=>({a:p.l,b:p.w,name:list.letterOf(p)+': '+p.name})));
      buy.push({m,qty:sheets.length,stock:0});
      h+=`<div class="buy">${sheets.length} × ${esc(m.short)}, 4 ft × 8 ft sheet${sheets.length>1?'s':''}</div>`;
      if(sheets.length===1&&sheets[0].items.every(i=>i.x+i.w<=48&&i.y+i.h<=48))h+=`<p class="hint">Everything fits on a half sheet (4 ft × 4 ft) if your store sells them.</p>`;
      if(over.length)h+=`<p class="warn">${over.map(o=>esc(o.name)).join(', ')}: larger than a 4 × 8 sheet.</p>`;
      sheets.forEach((sheet,i)=>{
        // each piece is drawn to scale (1 unit = 1 inch) with two lines of text inside: its letter and name, then its size
        const cuts=sheet.items.map(it=>{
          const size=`${fmt(it.w)} × ${fmt(it.h)}`,longest=Math.max(it.name.length,size.length);
          const type=Math.min(2.6,it.w/(longest*.56),it.h/3.2).toFixed(2),cx=it.x+it.w/2,cy=it.y+it.h/2;
          return`<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}"><title>${esc(it.name)}, ${esc(size)}</title></rect>`+
            `<text x="${cx}" y="${cy-type*.25}" font-size="${type}" text-anchor="middle">${esc(it.name)}</text>`+
            `<text x="${cx}" y="${cy+type*.95}" font-size="${type}" text-anchor="middle">${esc(size)}</text>`;
        }).join('');
        h+=`<div class="cut ply"><span>Sheet ${i+1} of ${sheets.length}</span><svg class="sheet" viewBox="0 0 96 48">${cuts}</svg></div>`;
      });
    }
  }
  return{html:h,buy};
}
function shoppingSection(buy){
  let total=0;
  const rows=buy.map(b=>{
    const each=priceOf(b.m.id,b.stock),what=b.stock?`${b.m.short} ${b.stock/12} ft lumber`:`${{ply34:'3/4',ply12:'1/2',ply14:'1/4'}[b.m.id]} in plywood 4x8 sheet`;
    total+=each*b.qty;
    return`<tr><td>${esc(b.m.short)}${b.stock?`, ${b.stock/12} ft long`:', 4 ft × 8 ft sheet'}</td><td class="num">${b.qty}</td>`+
      // the price is a box to type in on screen and one plain number on paper (class "printonly")
      `<td class="num"><span class="noprint">$ <input class="fld price" data-price="${b.m.id}" data-len="${b.stock}" value="${each.toFixed(2)}" aria-label="Price of one ${esc(b.m.short)}"></span><span class="printonly">$${each.toFixed(2)}</span></td>`+
      `<td class="num">$${(each*b.qty).toFixed(2)}</td>`+
      `<td class="noprint"><a target="_blank" rel="noopener" href="https://www.homedepot.com/s/${encodeURIComponent(what)}" title="Opens this item on homedepot.com, which shows the price at your store once you pick your store there">Check Home Depot</a></td></tr>`;
  });
  rows.push(`<tr class="total"><td colspan="3">Estimated lumber total, before tax and hardware</td><td class="num">$${total.toFixed(2)}</td><td class="noprint"></td></tr>`);
  return`<h2>Shopping list</h2>`+
    docTable([['Buy',''],['Qty','num'],['Price each','num'],['Total','num'],['Today\'s price','noprint']],rows)+
    `<p class="hint noprint">Prices start as rough guesses. Type the price from your store into a box and the total follows; it is remembered for next time.</p>`;
}
/* the numbered steps: what to do, the pieces to grab, the fasteners that join them to what is already built, and a
   picture with the new pieces in orange */
function stepsSection(list,joints,shots){
  const own=S.steps&&S.steps.length;
  const steps=own?S.steps:[CUT,{t:'Join the pieces as shown in the picture at the top, using the fastener table below. Start with the frame or the largest pieces, check for square as you go, and add tops and shelves last.',add:[]},FIN];
  const seen=new Set();
  let h=`<h2>Steps</h2><p class="hint">${own?'In each picture, the pieces added in that step are orange.':'This is a custom design, so the steps are general. Presets come with detailed steps and a picture for each one.'}</p>`;
  steps.forEach((step,i)=>{
    const added=new Set(step.add);
    step.add.forEach(name=>seen.add(name));
    // the pieces this step adds, counted by letter, name and length
    const need=new Map();
    for(const p of S.parts)if(added.has(p.name)){
      const k=list.letterOf(p)+'|'+p.name+'|'+(isProp(p)?'':fmt(p.l));
      need.set(k,(need.get(k)||0)+1);
    }
    const pieces=[...need.entries()].map(([k,qty])=>{
      const[letter,name,length]=k.split('|');
      // three cells: how many, the letter (an empty cell for a tank or a mattress, which has none), the name
      return`<li><span class="qty">${qty} ×</span>${keyBox(letter)||'<span></span>'}<span>${esc(name)}${length?', '+length:''}</span></li>`;
    }).join('');
    // the joints between a new piece and anything built so far
    const fasteners=jointGroups(joints.filter(j=>seen.has(j.a.name)&&seen.has(j.b.name)&&(added.has(j.a.name)||added.has(j.b.name))&&jType(j)!=='none'))
      .map(g=>{
        const types=new Set(g.js.map(jType));
        return`<li>${esc(g.A[0])} to ${esc(g.B[0])}: ${types.size===1?esc(jSpec(g.js[0],[...types][0]).text)+' at each joint':'mixed, see the table below'}</li>`;
      }).join('');
    h+=`<div class="step${shots[i]?'':' nopic'}"><div class="no">${i+1}</div><div><p>${esc(stepText(step))}</p>`+
      (pieces?`<div class="need pieces"><h4>Pieces</h4><ul>${pieces}</ul></div>`:'')+
      (fasteners?`<div class="need"><h4>Fasten with</h4><ul>${fasteners}</ul></div>`:'')+
      `</div>${shots[i]?`<img src="${shots[i]}" alt="Step ${i+1}">`:''}</div>`;
  });
  return h;
}
function fastenerSection(joints){
  const groups=jointGroups(joints).filter(g=>g.js.some(j=>jType(j)!=='none'));
  if(!groups.length)return'';
  const rows=groups.map(g=>{
    const types=new Set(g.js.map(jType));
    return`<tr><td>${esc(g.A[0])} to ${esc(g.B[0])}</td><td class="num">${g.js.length}</td><td>${types.size===1?esc(jSpec(g.js[0],[...types][0]).text):'Mixed: see the Fasteners tab (switch to Expert, top right)'}</td></tr>`;
  });
  return`<h2>Which fastener goes where</h2>`+docTable([['Join',''],['Joints','num'],['With, per joint','']],rows);
}
function renderCut(instr){
  const page=$(instr?'#instrPage':'#cutPage'),sheetName=instr?'Build instructions':'Cut list and shopping';
  if(!S.parts.length){
    page.innerHTML=`<div class="doc">${docHead(sheetName)}<p>Add some pieces in the Design tab first, or pick a furniture preset.</p></div>`;
    return;
  }
  const pics=takePictures(instr),list=cutRows(),joints=findJoints(),L=look();

  // the top of the sheet: a picture of the whole design beside a few facts
  const facts=[['Wood',WOODS[L.wood][0]],['Finish',FINISHES[L.finish][0]],['Weight of the wood',`about ${Math.round(list.pounds).toLocaleString()} lb`]];
  if(instr){
    const rating=assess(L);
    facts.push(['Skill',rating.level],['Working time',`about ${rating.hours} hour${rating.hours>1?'s':''}`]);
  }
  let h=docHead(sheetName)+
    `<div class="lead"><img id="shot" src="${pics.overview||''}" alt="The finished design"><dl class="facts">${facts.map(([name,value])=>`<dt>${name}</dt><dd>${esc(value)}</dd>`).join('')}</dl></div>`;
  if(S.notes&&S.notes.length)h+=`<h2>Notes</h2><ul>${S.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`;
  if(instr&&pics.views.length){
    // three drawings, two to a row; the fourth place says what the sizes measure
    const figures=pics.views.map(view=>`<figure><img src="${view.src}" alt="${view.name} view"><figcaption>${esc(view.caption)}</figcaption></figure>`).join('');
    h+=`<h2>Views with sizes</h2><div class="views">${figures}`+
      `<p class="hint">Overall sizes, measured to the outside of the outermost pieces. Wide is left to right, deep is front to back, tall is from the floor up. The size of every single piece is in the cut list.</p></div>`+
      `<h2>How it goes together</h2><img class="wide" src="${pics.exploded}" alt="The pieces pulled apart"><p class="hint">The pieces pulled apart so you can see each one. The steps below show the order.</p>`;
  }
  if(instr)h+=`<h2>Tools you need</h2><ul class="cols">${toolList(joints).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`;
  const diagrams=diagramSection(list);
  h+=cutListSection(list)+shoppingSection(diagrams.buy)+diagrams.html;
  h+=`<h2>Hardware</h2>`+hwTable(hardwareTotals(joints));
  if(instr)h+=stepsSection(list,joints,pics.steps);
  h+=fastenerSection(joints);

  page.innerHTML=`<div class="doc">${h}</div>`;
  page.querySelectorAll('input.price').forEach(box=>box.onchange=()=>{
    const price=parseFloat(box.value);
    if(price>=0){
      userPrice[pkey(box.dataset.price)]=price/((+box.dataset.len||96)/96); // kept as the price of an 8 ft board
      try{localStorage.setItem('woodshop.prices',JSON.stringify(userPrice));}catch(e){}
    }
    renderCut(instr);
  });
  page.querySelectorAll('select[data-stock]').forEach(choice=>choice.onchange=()=>{S.stock[choice.dataset.stock]=+choice.value;commit();});
}
