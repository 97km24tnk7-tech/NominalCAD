/* NominalCAD: what the Properties panel shows (the properties of the selection) and the Fasteners tab (Expert).
   The Pieces panel is in piecetree.js, the status bar in statusbar.js; dragging and hiding the panels is in layout.js. */
'use strict';
/* ---------- Properties panel ---------- */
/* small builders for the panel's markup */
const propsSection=(title,extra)=>`<div class="sec">${title}${extra||''}</div>`;
const propsNote=html=>`<div class="note">${html}</div>`;
const propsRow=(label,control,wide)=>`<div class="frow${wide?' wide':''}"><label>${label}</label>${control}</div>`;
const sizeField=(field,value,title)=>`<input class="fld" type="text" data-f="${field}" value="${fa(value)}"${title?` title="${esc(title)}"`:''}>`;
/* a group of fields side by side, each with its label above it: cells = [[label, control html], ...] */
function propsGroup(cells,cls){
  return`<div class="f3${cls?' '+cls:''}">${cells.map(c=>`<label>${c[0]}</label>`).join('')}${cells.map(c=>c[1]).join('')}</div>`;
}
const DROP_BUTTON=`<button class="btn s" data-act="drop" title="Lower it until it rests on the floor or on the piece below">${icon('i-drop')}Drop down</button>`;
const positionFields=p=>propsSection('Position',DROP_BUTTON)+
  propsGroup([['X',sizeField('x',p.pos[0],'X: left to right, measured from the left')],['Y',sizeField('z',p.pos[2],'Y: front to back, measured from the back')],['Z',sizeField('y',p.pos[1],'Z: up, measured from the floor')]]);

function renderProps(){
  const ps=selParts(),el=$('#props'),who=$('#propsName');
  if(renderPickedProps())return; // a fastener or a piece of hardware was clicked: js/viewpick.js
  if(!ps.length){who.textContent='';el.innerHTML=propsNote('Nothing selected. Click a piece to edit it.');return;}
  // a whole component (js/components.js). After that: how far a door or drawer is open (propsMotion, js/motion.js),
  // the hardware on the pieces (propsHardware, js/hardwaretool.js), what the selection is fastened to (propsConnections, js/unfasten.js)
  const more=propsMotion(ps)+propsHardware(ps)+propsConnections(ps);
  const comp=selectedComponent();
  if(comp){who.textContent=comp.name;el.innerHTML=propsOfComponent(comp,ps)+more;return;}
  if(ps.length>1){who.textContent=ps.length+' pieces';el.innerHTML=propsOfSeveral(ps)+more;return;}
  const p=ps[0];
  who.textContent=p.name;
  // in Beginner, one line first that says what this kind of piece is (js/glossary.js; not loaded yet at start-up)
  el.innerHTML=(window.termLine?termLine(p):"")+(isProp(p)?propsOfProp(p):propsOfPiece(p))+more;
}
/* one wooden piece: name, material, size, position, quarter turns, angle */
function propsOfPiece(p){
  const m=M[p.mat];
  const materials=MATS.filter(x=>x.kind!=='prop').map(x=>`<option value="${x.id}"${x.id===p.mat?' selected':''}>${esc(x.name)}</option>`).join('');
  const realSize=m.kind==='board'?`A ${m.short} is really ${fmt(m.t)} × ${fmt(m.w)}. A narrower width means a rip cut.`:'';
  const directions=[[2,'Lean left / right'],[0,'Lean front / back'],[1,'Swing flat (like a clock hand)']]
    .map(([k,label])=>`<option value="${k}"${(p.rot?p.rot.k:2)===k?' selected':''}>${label}</option>`).join('');
  return propsRow('Name',`<input class="fld" type="text" data-f="name" value="${esc(p.name)}">`)+
    componentLine(p)+
    propsRow('Material',`<select class="fld" data-f="mat">${materials}</select>`)+
    propsSection('Size')+
    propsGroup([['Length',sizeField('l',p.l)],['Width',sizeField('w',p.w,realSize)],
      ['Thickness',`<input class="fld" type="text" value="${fa(p.t)}" disabled title="The thickness comes from the material">`]])+
    positionFields(p)+
    propsSection('Turn a quarter')+
    `<div class="f3"><button class="btn t" data-act="rotY">Spin flat</button><button class="btn t" data-act="rotX">Tip front/back</button><button class="btn t" data-act="rotZ">Tip sideways</button></div>`+
    `<div class="sec" title="For braces and splayed legs">Angle</div>`+
    propsGroup([['Tilt, degrees',`<input class="fld" type="text" data-f="deg" value="${p.rot?p.rot.deg:p.q?angleOf(p):0}">`],
      ['Direction',`<select class="fld" data-f="rax">${directions}</select>`]],'two')+
    // a piece that was turned together with what it is fastened to keeps its joints (a turned set, js/neighbors.js)
    (!tilted(p)?'':turnedSets(S.parts).of.get(p)?propsNote('This piece was turned together with the pieces it is fastened to. Its joints and fasteners are the same as before the turn.')
      :propsNote('Angled pieces are drawn and added to the cut list, but their joints are not worked out automatically. Cut the ends to match the angle and add your own screws.'));
}
/* a fish tank, light, mattress or window: shown for reference, so only its position can change */
function propsOfProp(p){
  return propsNote(`${fmt(p.l)} long × ${fmt(p.w)} front-to-back × ${fmt(p.t)} tall. Shown for reference only; it is not in the cut list.`)+
    positionFields(p);
}
/* several pieces: their size together, and for exactly two the joint between them and a tape measure */
function propsOfSeveral(ps){
  const b=bbox(ps);
  let h=propsNote(`Together: <b>${fmtFt(b.hi[0]-b.lo[0])} wide × ${fmtFt(b.hi[2]-b.lo[2])} deep × ${fmtFt(b.hi[1]-b.lo[1])} tall</b>`);
  h+=propsSection('Component')+componentButtons();
  if(ps.length!==2)return h+propsNote('Select exactly two pieces to measure the gap between them.');

  const[ia,ib]=[...sel],joint=findJoints().find(j=>(j.a.id===ia&&j.b.id===ib)||(j.a.id===ib&&j.b.id===ia));
  h+=propsSection('Connection');
  if(joint){
    const type=jType(joint),spec=jSpec(joint,type);
    const types=Object.entries(JTYPES).map(([k,v])=>`<option value="${k}"${k===type?' selected':''}>${v[0]}</option>`).join('');
    h+=propsNote(`The ${joint.fa} of <b>${esc(joint.a.name)}</b> meets the ${joint.fb} of <b>${esc(joint.b.name)}</b>.`)+
      propsRow('Fasten with',`<select class="fld" data-f="jt" data-key="${joint.key}">${types}</select>`,true)+
      propsNote(`<b>${esc(spec.text)}</b><br>${esc(JTYPES[type][2])}`);
  }else{
    h+=propsNote('These two are not touching yet.')+
      `<button class="btn" data-act="connect">${icon('i-connect')}Connect them</button>`+
      propsNote(`Moves, stretches or trims <b>${esc((byId(ia)||{}).name||'')}</b> (the one you picked first) so it meets <b>${esc((byId(ib)||{}).name||'')}</b>, then fastens the two.`);
  }

  const A=box(ps[0]),B=box(ps[1]),labels=['Left to right','Up and down','Front to back'];
  h+=propsSection('Tape measure')+propsNote(`Space between <b>${esc(ps[0].name)}</b> and <b>${esc(ps[1].name)}</b>:`);
  for(const k of[0,2,1]){
    const gap=Math.max(A.lo[k]-B.hi[k],B.lo[k]-A.hi[k]);
    h+=propsRow(labels[k],`<b>${gap>.01?fmt(gap)+' gap':gap>-.01?'touching':'overlap '+fmt(-gap)}</b>`,true);
  }
  return h;
}
/* typing in a field: every field carries data-f, the name of what it changes */
$('#props').addEventListener('change',e=>{
  const f=e.target.dataset.f,p=selParts()[0];if(!f||!p)return;const m=M[p.mat];
  if(f==='compName'){if(!renameComponent(+e.target.dataset.comp,e.target.value))renderProps();return;}
  if(f==='jt'){S.joints[e.target.dataset.key]=e.target.value;commit();return;}
  if(f==='name'){p.name=e.target.value.trim()||'Piece';}
  else if(f==='mat'){const nm=M[e.target.value];p.mat=nm.id;p.t=nm.t;if(nm.kind==='board')p.w=nm.w;}
  else if(f==='deg'||f==='rax'){tiltPiece(p,f,e.target.value);return;} // asks first when the piece is fastened
  else if(f!=='name'&&f!=='mat'){const v=parseLen(e.target.value);if(isNaN(v)){renderProps();return;}
    if(f==='l'){if(v<=0){renderProps();return;}p.l=r16(v);}
    else if(f==='w'){if(v<=0){renderProps();return;}
      // a board cannot be wider than the store sells it: say so, with the way out, instead of putting the old number back without a word
      if(m.kind==='board'&&v>m.w+.01)toast(`A ${m.short} board is ${fmt(m.w)} wide and cannot be made wider. For a wider piece choose a wider board, or plywood, under Material in Properties.`);
      p.w=r16(m.kind==='board'?Math.min(v,m.w):v);}
    else moveSetTo(p,'xyz'.indexOf(f),r16(f==='y'?Math.max(0,v):v));} // a Position box: what is fastened to the piece moves with it
  commit();
});
/* The Angle boxes (Tilt, degrees and Direction) set ONE piece at an angle: a brace, a splayed leg. A piece that
   is fastened to others would be pulled off its fasteners by that, so the Unfasten question is asked first, with
   the connections that would go (askAboutLinks, js/unfasten.js). "Keep them" changes nothing. To turn a piece
   together with everything it is fastened to there is Rotate (R), which never asks because nothing comes apart.
   field: 'deg' or 'rax'; text: what was typed or chosen. */
function tiltPiece(p,field,text){
  const now=p.rot?{k:p.rot.k,deg:p.rot.deg}:{k:2,deg:0},next={k:now.k,deg:now.deg};
  if(field==='deg'){
    const typed=parseFloat(text);
    if(isNaN(typed)){renderProps();return;}
    next.deg=Math.max(-90,Math.min(90,Math.round(typed*2)/2));
  }else next.k=+text;
  if(!p.q&&next.k===now.k&&next.deg===now.deg){renderProps();return;} // nothing would change
  const tilt=()=>{
    delete p.q;
    delete p.turned;   // set at an angle by itself now: no longer turned with its set (js/neighbors.js)
    if(next.deg||field==='rax')p.rot=next;else delete p.rot;
    const bounds=box(p);
    if(bounds.lo[1]<0)p.pos[1]=r16(p.pos[1]-bounds.lo[1]); // keep a tilted piece above the floor
  };
  const staysPut=!p.q&&!now.deg&&!next.deg;           // a direction picked for a piece that is not tilted: it does not move
  const links=staysPut?[]:linksToOutside(new Set([p.id]));
  if(!links.length){tilt();commit();return;}
  const one=links.length===1;
  askAboutLinks(links,
    {title:'Tilt this piece by itself?',action:'Tilt it alone',freed:new Set([p.id]),
      text:`${p.name} is fastened to other pieces. Tilting it by itself takes it off ${one?'this connection':'these connections'}, which will be deleted. `+
        `Undo (Ctrl+Z) brings ${one?'it':'them'} back. To turn everything that is fastened together instead, use Rotate (R).`},
    ()=>{
      // Hardware that held it (hinges, slides) is taken off. Its wood joints end with the tilt: no screws are worked
      // out for a piece set at an angle, and where it still touches a piece it stays tied to it (js/connections.js).
      deleteLinks(links.filter(link=>link.hold));
      tilt();
      commit();
      toast(`${p.name} is tilted by itself. Where it still touches another piece the two stay tied, but no screws are worked out for an angled joint: add your own.`);
    });
  renderProps(); // while the question is open, and after "Keep them", the boxes show the piece as it really is
}
/* buttons in the panel carry data-act (the click may land on the icon inside the button) */
$('#props').addEventListener('click',e=>{
  const button=e.target.closest('[data-act]');if(!button)return;
  const a=button.dataset.act,p=selParts()[0];
  if(a==='row'){openRow();return;}if(a==='mirror'){openMirror();return;}
  if(a==='connect'){const[ia,ib]=[...sel],msg=connectAndFasten(byId(ia),byId(ib));commit();toast(msg);return;}
  if(a==='del')delSel();else if(a==='dup')dupSel();
  else if(a==='drop'){dropSet(p);commit();}                              // these three take along what is fastened to the piece
  else if(a.startsWith('rot')){turnQuarter(p,'XYZ'.indexOf(a[3]));commit();} // (js/connections.js)
});

/* ---------- the Fasteners page (Expert) ----------
   One row for every kind of joint (the same two pieces meeting the same way), with the fastener to use. Picking
   another fastener in a row changes all the joints of that kind. (docHead and docTable are in plans.js.) */
function renderJoints(){
  const page=$('#jointsPage'),sheetName='Fasteners and hardware';
  if(!S.parts.length){
    page.innerHTML=`<div class="doc">${docHead(sheetName)}<p>Add some pieces in the Design tab first, or pick a furniture preset.</p></div>`;
    return;
  }
  const joints=findJoints(),groups=jointGroups(joints),used=new Set();
  let h=docHead(sheetName)+`<h2>How the pieces join</h2>`;
  if(!groups.length)h+='<p>No pieces are touching yet. Slide pieces together in the Design tab and the joints appear here.</p>';
  else{
    const rows=groups.map((g,i)=>{
      const types=new Set(g.js.map(jType)),current=types.size===1?[...types][0]:'';
      types.forEach(t=>used.add(t));
      const choices=(current?'':'<option value="" selected>(mixed)</option>')+
        Object.entries(JTYPES).map(([key,type])=>`<option value="${key}"${key===current?' selected':''}>${type[0]}</option>`).join('');
      return`<tr><td class="nowrap"><b>${esc(g.A[0])}</b> to <b>${esc(g.B[0])}</b></td><td class="num">${g.js.length}</td><td class="nowrap">${g.A[1]} to ${g.B[1]}</td>`+
        `<td><select class="fld" data-g="${i}" aria-label="Fastener"${current?` title="${esc(JTYPES[current][2])}"`:''}>${choices}</select></td>`+
        `<td>${current?esc(jSpec(g.js[0],current).text):'Mixed'}</td></tr>`;
    });
    h+=docTable([['Pieces',''],['Joints','num'],['How they meet',''],['Fasten with',''],['Per joint','']],rows)+
      `<p class="noprint"><button class="btn" id="bJReset" title="Forget the fasteners picked by hand and go back to the suggested ones">Reset all to suggested</button></p>`;
    // how to make each kind of joint that is in use, once, instead of under every row
    const howTo=Object.entries(JTYPES).filter(([key])=>used.has(key)&&key!=='none');
    if(howTo.length)h+=`<h2>How to make each joint</h2><dl class="facts">${howTo.map(([,type])=>`<dt>${type[0]}</dt><dd>${esc(type[2])}</dd>`).join('')}</dl>`;
  }
  h+=`<h2>Hardware to buy</h2>`+hwTable(hardwareTotals(joints));
  const dots=Object.entries(JTYPES).filter(([key])=>key!=='none'&&key!=='glue')
    .map(([,type])=>`<span><i class="dot" style="background:#${type[1].toString(16).padStart(6,'0')}"></i>${type[0]}</span>`).join('');
  h+=`<h2 class="noprint">Colors in the Fasteners only view</h2><p class="hint noprint">On the Design tab, Display, then Fasteners only (Shift+F), draws the wood as an outline and every fastener in the color of its kind.</p><div class="dots noprint">${dots}</div>`;
  page.innerHTML=`<div class="doc">${h}</div>`;
  page.querySelectorAll('select[data-g]').forEach(choice=>choice.onchange=()=>{
    if(!choice.value)return;
    groups[+choice.dataset.g].js.forEach(j=>S.joints[j.key]=choice.value);
    commit();
  });
  const reset=$('#bJReset');
  if(reset)reset.onclick=()=>{S.joints=Object.assign({},S.named||{});commit();}; // back to the suggestions, and to what the preset itself names (js/joints.js)
}
/* the hardware list, used on all three document pages. hw = {rows:[[item, quantity]], glue:true/false} from hardwareTotals() */
function hwTable(hw){
  if(!hw.rows.length&&!hw.glue)return'<p>No hardware needed yet.</p>';
  const rows=hw.rows.map(([item,quantity])=>`<tr><td>${esc(item)}</td><td class="num">${quantity}</td></tr>`);
  if(hw.glue)rows.push('<tr><td>Wood glue</td><td class="num">1 bottle</td></tr>');
  return docTable([['Item',''],['Quantity','num']],rows,'half')+`<p class="hint">Buy a few extra screws; boxes are cheap and some will strip.</p>`;
}

