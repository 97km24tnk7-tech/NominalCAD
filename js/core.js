/* NominalCAD: materials, units and small helpers shared by every other file */
'use strict';
/* ---------- materials ---------- */
const MATS=[
 ['1x2',.75,1.5],['1x3',.75,2.5],['1x4',.75,3.5],['1x6',.75,5.5],['1x8',.75,7.25],['1x10',.75,9.25],['1x12',.75,11.25],
 ['2x2',1.5,1.5],['2x3',1.5,2.5],['2x4',1.5,3.5],['2x6',1.5,5.5],['2x8',1.5,7.25],['2x10',1.5,9.25],['2x12',1.5,11.25],['4x4',3.5,3.5]
].map(([id,t,w])=>({id,name:id+' board',short:id,kind:'board',t,w,color:id==='4x4'?0xd9b47c:0xe6c592}));
MATS.push({id:'ply34',name:'3/4" plywood',short:'3/4" plywood',kind:'sheet',t:.75,color:0xcfa873},
          {id:'ply12',name:'1/2" plywood',short:'1/2" plywood',kind:'sheet',t:.5,color:0xc9a26e},
          {id:'ply14',name:'1/4" plywood',short:'1/4" plywood',kind:'sheet',t:.25,color:0xb99a6b},
          {id:'tank',name:'Fish tank (not wood)',short:'Fish tank',kind:'prop',t:0,color:0x3d9be0},
          {id:'light',name:'Tank light (not wood)',short:'Tank light',kind:'prop',t:0,color:0xffc400},
          {id:'mattress',name:'Mattress (not wood)',short:'Mattress',kind:'prop',t:0,color:0xffffff},
          {id:'glass',name:'Window (not wood)',short:'Window',kind:'prop',t:0,color:0x9fd3f5});
const isProp=p=>M[p.mat].kind==='prop';
const M=Object.fromEntries(MATS.map(m=>[m.id,m]));
const isSquare=m=>m.kind==='board'&&m.t===m.w;

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const r16=v=>Math.round(v*16)/16,fa=v=>esc(fmt(v));
function fmt(v){const neg=v<-1e-9;v=Math.abs(v);let n=Math.round(v*16),w=Math.floor(n/16),f=n%16,s;
  if(f){let d=16;while(f%2===0){f/=2;d/=2;}s=(w?w+' ':'')+f+'/'+d;}else s=''+w;return(neg?'-':'')+s+'"';}
function fmtFt(v){const ft=Math.floor(v/12+1e-6),inch=v-ft*12;return v>=24?`${ft}' ${fmt(inch)}`:fmt(v);}
function parseLen(str){
  str=String(str).trim().replace(/["”″]/g,'').replace(/\s*in(ch(es)?)?\.?$/i,'').trim();if(!str)return NaN;
  let ft=0;const m=str.match(/^([\d.]+)\s*(?:'|′|ft\.?|feet)\s*(.*)$/i);
  if(m){ft=parseFloat(m[1]);str=m[2].trim();if(!str)return ft*12;}
  let neg=false;if(str[0]==='-'){neg=true;str=str.slice(1).trim();}
  let tot=0;for(const tok of str.split(/[\s-]+/)){if(!tok)continue;
    if(tok.includes('/')){const[a,b]=tok.split('/').map(Number);if(!b||isNaN(a))return NaN;tot+=a/b;}
    else{const x=Number(tok);if(isNaN(x))return NaN;tot+=x;}}
  return(neg?-1:1)*(ft*12+tot);
}
function size(p){const s=[0,0,0];s[p.ax[0]]=p.l;s[p.ax[1]]=p.w;s[p.ax[2]]=p.t;return s;}
function mk(name,mat,s,pos){
  const m=M[mat],eq=(a,b)=>Math.abs(a-b)<1e-6;let ax=null;
  if(m.kind==='prop')ax=[0,2,1];
  else if(m.kind==='board'){
    for(const ti of[0,1,2]){if(!eq(s[ti],m.t))continue;
      for(const wi of[0,1,2])if(wi!==ti&&eq(s[wi],m.w)){ax=[3-ti-wi,wi,ti];break;}
      if(ax)break;}
  }else{const ti=[0,1,2].find(i=>eq(s[i],m.t));
    if(ti!==undefined){const r=[0,1,2].filter(i=>i!==ti).sort((a,b)=>s[b]-s[a]);ax=[r[0],r[1],ti];}}
  if(!ax)ax=[0,1,2].sort((a,b)=>s[b]-s[a]);
  return{id:0,name,mat,l:r16(s[ax[0]]),w:r16(s[ax[1]]),t:s[ax[2]],ax,pos:pos.map(r16)};
}

/* one of the line icons drawn in the #sprite block at the top of index.html.
   size: '' = 16px, 'l' = 24px, 'm' = 20px, 'xs' = 12px. Example: icon('i-undo') */
function icon(id,size){
  return `<svg class="i${size?' '+size:''}"><use href="#${id}"/></svg>`;
}

/* a short message that fades out by itself, for confirming an action without interrupting.
   One at a time, at the bottom centre of the view; long messages stay up a little longer so they can be read. */
function toast(msg){
  let t=$('#toast');
  if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.textContent=msg;
  t.classList.add('on');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>t.classList.remove('on'),msg.length>80?7000:4000);
}
