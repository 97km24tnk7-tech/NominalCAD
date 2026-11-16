/* WoodShop Designer: cut list, shopping list, cutting diagrams and printable instructions */
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
function packSheets(rects){const SW=96,SH=48,K=.125,sheets=[],over=[];
  rects.sort((p,q)=>Math.max(q.a,q.b)-Math.max(p.a,p.b));
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
/* Every picture for the plans, taken in one go from a clean copy of the scene (nothing selected, hidden, see-through or exploded):
   an overview, flat front / side / top views with sizes, a pulled-apart view, and one picture per step. */
function takePictures(full){
  const keep={cam:{...cam,target:cam.target.clone()},sel,hidden:hiddenIds,xray,explode},W=880,H=560,out={steps:[],views:[]};
  sel=new Set();hiddenIds=new Set();xray=false;explode=0;forceDims=true;rebuildScene();
  const snap=c=>{renderer.render(scene,c||camera);return renderer.domElement.toDataURL('image/jpeg',.88);};
  renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix();
  fastGroup.visible=handleGroup.visible=gizmoGroup.visible=false;
  fit('fit');cam.r*=.85;updateCam();out.overview=snap();
  if(full){
    const b=bbox(S.parts),c=b.lo.map((v,i)=>(v+b.hi[i])/2),e=b.hi.map((v,i)=>v-b.lo[i]),R=Math.hypot(e[0],e[1],e[2])+50;grid.visible=floor.visible=false;
    for(const[name,dir,u,v,up]of[['Front',[0,0,1],0,1,[0,1,0]],['Side',[1,0,0],2,1,[0,1,0]],['Top',[0,1,0],0,2,[0,0,-1]]]){ // flat views, like a drawing
      const half=Math.max(e[u]*.5*1.28+6,(e[v]*.5*1.28+6)*W/H),oc=new THREE.OrthographicCamera(-half,half,half*H/W,-half*H/W,.1,R*4);
      oc.position.set(c[0]+dir[0]*R,c[1]+dir[1]*R,c[2]+dir[2]*R);oc.up.set(up[0],up[1],up[2]);oc.lookAt(c[0],c[1],c[2]);
      buildDims([u,v]);out.views.push([name,snap(oc)]);}
    grid.visible=floor.visible=true;dimGroup.visible=false;
    explode=.55;for(const p of S.parts)setMeshPos(p);cam.r*=1.45;updateCam();out.exploded=snap(); // pulled apart
    explode=0;for(const p of S.parts)setMeshPos(p);cam.r/=1.45;updateCam();
    const seen=new Set();
    for(const st of S.steps||[]){const nw=new Set(st.add);st.add.forEach(n=>seen.add(n));let any=false; // pieces so far, new ones in orange
      for(const p of S.parts){const g=meshes.get(p.id),v=seen.has(p.name);g.visible=v;
        if(v){if(nw.has(p.name))any=true;g.children[0].material.color.setHex(isProp(p)?M[p.mat].color:nw.has(p.name)?0xf2a03d:0xe6c592);}}
      out.steps.push(any?snap():'');}
  }
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
function renderCut(instr){
  const pics=S.parts.length?takePictures(instr):{steps:[],views:[]},shots=pics.steps;
  const groups=new Map();
  const pk=p=>[p.mat,p.l,p.w,p.t,angleOf(p)].join('|');let lbs=0;
  for(const p of S.parts){if(isProp(p))continue;const dg=angleOf(p),k=pk(p);if(!groups.has(k))groups.set(k,{mat:p.mat,l:p.l,w:p.w,t:p.t,deg:dg,qty:0,names:new Set()});
    const g=groups.get(k);g.qty++;g.names.add(p.name);lbs+=p.l*p.w*p.t*(M[p.mat].kind==='sheet'?.02:.017);}
  const order=id=>MATS.findIndex(m=>m.id===id),rows=[...groups.values()].sort((a,b)=>order(a.mat)-order(b.mat)||b.l-a.l);
  // every cut-list row gets a letter that is reused in the diagrams and the steps
  rows.forEach((g,i)=>g.id=(i>=26?String.fromCharCode(64+Math.floor(i/26)):'')+String.fromCharCode(65+i%26));
  const letOf=p=>isProp(p)?'':groups.get(pk(p)).id,lenLet=new Map();
  for(const g of rows)if(!lenLet.has(g.mat+'|'+g.l))lenLet.set(g.mat+'|'+g.l,g.id);
  const b=bbox(S.parts);
  let h=instr?`<div class="noprint printbar"><button class="primary big" id="bPrint2">Print these instructions</button><span>Everything on this page prints: shopping list, cut list, and the steps.</span></div><h1>${esc(S.name)}: build instructions</h1>`:`<h2>${esc(S.name)}</h2>`;
  if(instr&&S.parts.length){const L=look(),a=assess(L);h+=`<div class="stylebar"><b>${STYLES[L.style][0]}</b> style · ${esc(WOODS[L.wood][0])} · ${esc(FINISHES[L.finish][0])}<br>Skill: ${a.level} · about ${a.hours} hour${a.hours>1?'s':''} of work <button class="noprint" id="bStyle2">Change style or finish</button></div>`;}
  if(!S.parts.length){$(instr?'#instrPage':'#cutPage').innerHTML=h+'<p>Add some pieces in the Design tab first, or pick a furniture preset.</p>';return;}
  const js0=findJoints();
  h+=`<img id="shot" src="${pics.overview||''}" alt=""><div class="hint">Overall: ${fmt(b.hi[0]-b.lo[0])} wide × ${fmt(b.hi[2]-b.lo[2])} deep × ${fmt(b.hi[1]-b.lo[1])} tall. The wood weighs about ${Math.round(lbs)} lb.</div>`;
  if(S.notes&&S.notes.length)h+=`<h2>Notes</h2><ul>${S.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`;
  if(instr&&pics.views.length)h+=`<h2>Views with sizes</h2><div class="views">${pics.views.map(([n,src])=>`<figure><img src="${src}" alt=""><figcaption>${n}</figcaption></figure>`).join('')}</div><h2>How it goes together</h2><img class="wide" src="${pics.exploded}" alt=""><div class="hint">The pieces pulled apart so you can see each one. The steps below show the order.</div>`;
  if(instr)h+=`<h2>Tools you need</h2><ul>${toolList(js0).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`;
  h+=`<h2>Cut list</h2><div class="hint">Write the letter on each piece as you cut it. The same letters are used in the cutting diagrams and the steps.</div><table><tr><th>Label</th><th>Qty</th><th>Piece</th><th>Cut from</th><th>Length</th><th>Width</th><th>Thick</th><th>Note</th></tr>`+
    rows.map(g=>{const m=M[g.mat],rip=m.kind==='board'&&g.w<m.w-.01;
      return`<tr><td><b class="let">${g.id}</b></td><td class="n">${g.qty}</td><td>${esc([...g.names].join(', '))}</td><td>${esc(m.short)}</td><td class="n">${fmt(g.l)}</td><td class="n">${fmt(g.w)}</td><td class="n">${fmt(g.t)}</td><td>${[rip?'Rip to '+fmt(g.w)+' wide':'',g.deg?`Sits at ${g.deg}°: cut the ends at an angle to fit`:''].filter(Boolean).join('. ')}</td></tr>`;}).join('')+`</table>`;
  const h0=h,buy=[];h='';
  for(const m of MATS){const ps=S.parts.filter(p=>p.mat===m.id);if(!ps.length||m.kind==='prop')continue;
    if(m.kind==='board'){const lens=ps.map(p=>p.l),need=Math.max(...lens);let stock=S.stock[m.id]||96;
      if(need>stock)stock=STOCKS.find(s=>s>=need)||192;
      const bins=packBoards(lens.filter(l=>l<=stock),stock),tooLong=lens.filter(l=>l>stock);buy.push({m,qty:bins.length,stock});
      h+=`<div class="buy">${bins.length} × ${esc(m.short)}, <select data-stock="${m.id}">${STOCKS.map(s=>`<option value="${s}"${s===stock?' selected':''}>${s/12} ft</option>`).join('')}</select> long</div>`;
      if(tooLong.length)h+=`<div class="warn">${tooLong.length} piece(s) are longer than 16 ft and cannot be cut from one board.</div>`;
      for(const bin of bins){const left=stock-bin.used;
        h+=`<div class="bar">${bin.cuts.map(l=>`<div style="width:${l/stock*100}%"><b>${lenLet.get(m.id+'|'+l)||''}</b>&nbsp;${fmt(l)}</div>`).join('')}${left>1?`<div class="w" style="flex:1">${fmt(left)} left</div>`:''}</div>`;}
    }else{const{sheets,over}=packSheets(ps.map(p=>({a:p.l,b:p.w,name:letOf(p)+': '+p.name})));buy.push({m,qty:sheets.length,stock:0});
      h+=`<div class="buy">${sheets.length} × ${esc(m.short)}, 4 ft × 8 ft sheet${sheets.length>1?'s':''}</div>`;
      if(sheets.length===1&&sheets[0].items.every(i=>i.x+i.w<=48&&i.y+i.h<=48))h+=`<div class="hint">Everything fits on a half sheet (4 ft × 4 ft) if your store sells them.</div>`;
      if(over.length)h+=`<div class="warn">${over.map(o=>esc(o.name)).join(', ')}: larger than a 4 × 8 sheet.</div>`;
      for(const sh of sheets)h+=`<svg class="sheet" viewBox="0 0 96 48">${sh.items.map(i=>`<rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" fill="#e6c592" stroke="#6b4f2a" stroke-width=".3"/><text x="${i.x+i.w/2}" y="${i.y+i.h/2}" font-size="${Math.min(3,i.w/6,i.h/2.4)}" text-anchor="middle" dominant-baseline="middle">${esc(i.name)} ${fmt(i.w).replace('"','')}×${fmt(i.h).replace('"','')}</text>`).join('')}</svg>`;
    }}
  const dg=h;h=h0;let tot=0;
  h+=`<h2>Shopping list</h2><table style="max-width:640px"><tr><th>Buy</th><th>Qty</th><th>Price each (edit)</th><th>Total</th><th class="noprint">Today's price</th></tr>`+buy.map(b=>{const each=priceOf(b.m.id,b.stock);tot+=each*b.qty;
    return`<tr><td>${esc(b.m.short)}${b.stock?`, ${b.stock/12} ft long`:', 4 ft × 8 ft sheet'}</td><td class="n">${b.qty}</td><td class="n">$<input class="price" data-price="${b.m.id}" data-len="${b.stock}" value="${each.toFixed(2)}"></td><td class="n">$${(each*b.qty).toFixed(2)}</td><td class="noprint"><a target="_blank" rel="noopener" href="https://www.homedepot.com/s/${encodeURIComponent(b.stock?`${b.m.short} ${b.stock/12} ft lumber`:`${{ply34:'3/4',ply12:'1/2',ply14:'1/4'}[b.m.id]} in plywood 4x8 sheet`)}">Check Home Depot</a></td></tr>`;}).join('')+
    `<tr><th colspan="3">Estimated lumber total (before tax and hardware)</th><th class="n">$${tot.toFixed(2)}</th><th class="noprint"></th></tr></table><div class="hint noprint">Prices start as rough guesses. "Check Home Depot" opens that item on homedepot.com, which shows the price at your store once you pick your store there. Type that price into the box and the total updates; it is remembered for next time.</div>`+
    `<h2>Cutting diagrams</h2><div class="hint">Diagrams allow 1/8" for each saw cut. Striped areas are leftover.</div>`+dg;
  const js=findJoints();
  h+=`<h2>Hardware</h2>`+hwTable(hardwareTotals(js));
  const jg=jointGroups(js).filter(g=>g.js.some(j=>jType(j)!=='none'));
  if(instr){h+=`<h2>Steps</h2>`;
    const steps=S.steps&&S.steps.length?S.steps:[CUT,{t:'Join the pieces as shown in the picture at the top, using the fastener table below. Start with the frame or the largest pieces, check for square as you go, and add tops and shelves last.',add:[]},FIN];
    if(!(S.steps&&S.steps.length))h+=`<div class="hint">This is a custom design, so the steps are general. Presets come with detailed steps and a picture for each one.</div>`;
    const seen=new Set();
    h+=steps.map((st,i)=>{const nw=new Set(st.add);st.add.forEach(n=>seen.add(n));
      // what to grab for this step, and which fasteners join it to what is already built
      const need=new Map();for(const p of S.parts)if(nw.has(p.name)){const k=letOf(p)+'|'+p.name+'|'+(isProp(p)?'':fmt(p.l));need.set(k,(need.get(k)||0)+1);}
      const needTxt=[...need.entries()].map(([k,q])=>{const[l,n,len]=k.split('|');return`${q} × ${l?`<b class="let">${l}</b> `:''}${esc(n)}${len?` (${len})`:''}`;}).join(', ');
      const fj=jointGroups(js.filter(j=>seen.has(j.a.name)&&seen.has(j.b.name)&&(nw.has(j.a.name)||nw.has(j.b.name))&&jType(j)!=='none'))
        .map(g=>{const ts=new Set(g.js.map(jType));return`<li>${esc(g.A[0])} to ${esc(g.B[0])}: ${ts.size===1?esc(jSpec(g.js[0],[...ts][0]).text)+' at each joint':'mixed, see the table below'}</li>`;}).join('');
      return`<div class="step"><div class="stepn">${i+1}</div><div><p>${esc(stepText(st))}</p>${needTxt?`<div class="need"><b>Pieces:</b> ${needTxt}</div>`:''}${fj?`<div class="need"><b>Fasten with:</b><ul>${fj}</ul></div>`:''}${shots[i]?`<img src="${shots[i]}" alt=""><div class="hint">New pieces in this step are orange.</div>`:''}</div></div>`;}).join('');}
  if(jg.length)h+=`<h2>Which fastener goes where</h2><table><tr><th>Join</th><th>Joints</th><th>With (per joint)</th></tr>${jg.map(g=>{const ts=new Set(g.js.map(jType));
    return`<tr><td>${esc(g.A[0])} to ${esc(g.B[0])}</td><td class="n">${g.js.length}</td><td>${ts.size===1?esc(jSpec(g.js[0],[...ts][0]).text):'Mixed, see Joints tab'}</td></tr>`;}).join('')}</table>`;
  const el=$(instr?'#instrPage':'#cutPage');el.innerHTML=h;
  const pb=el.querySelector('#bPrint2');if(pb)pb.onclick=()=>window.print();
  const sb=el.querySelector('#bStyle2');if(sb)sb.onclick=openStyle;
  el.querySelectorAll('input.price').forEach(i=>i.onchange=()=>{const v=parseFloat(i.value);
    if(v>=0){userPrice[pkey(i.dataset.price)]=v/((+i.dataset.len||96)/96);try{localStorage.setItem('woodshop.prices',JSON.stringify(userPrice));}catch(e){}}
    renderCut(instr);});
  el.querySelectorAll('select[data-stock]').forEach(s=>s.onchange=()=>{S.stock[s.dataset.stock]=+s.value;commit();});
}

