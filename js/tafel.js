"use strict";
/* ---------- pitch / board ---------- */
const FIELDS={full:{vb:[-4,-4,76,113],w:68,h:105,s:1},half:{vb:[-4,-4,76,61],w:68,h:52.5,s:1},free:{vb:[-3,-3,46,36],w:40,h:30,s:.72}};
function pitchMarkup(field){
  const F=FIELDS[field],[x0,y0,w,h]=F.vb;let o="";
  const n=10;for(let i=0;i<n;i++)o+=`<rect x="${x0}" y="${y0+i*h/n}" width="${w}" height="${h/n+.05}" fill="${i%2?"#B8D5A4":"#C1DBAE"}"/>`;
  const L='fill="none" stroke="#fff" stroke-width=".35"';
  if(field==="free"){o+=`<rect x="0" y="0" width="40" height="30" ${L} stroke-dasharray="1.2 1"/>`;return o;}
  o+=`<rect x="0" y="0" width="68" height="${F.h}" ${L}/>`;
  const box=(top,yb)=>{const s=top?1:-1;const y=top?0:yb;
    o+=`<rect x="13.84" y="${top?0:yb-16.5}" width="40.32" height="16.5" ${L}/><rect x="24.84" y="${top?0:yb-5.5}" width="18.32" height="5.5" ${L}/>`;
    o+=`<rect x="30.34" y="${top?-2:yb}" width="7.32" height="2" ${L}/><circle cx="34" cy="${y+s*11}" r=".35" fill="#fff"/>`;
    const dy=5.5,a=Math.sqrt(9.15*9.15-dy*dy);o+=`<path d="M ${34-a} ${y+s*16.5} A 9.15 9.15 0 0 ${top?0:1} ${34+a} ${y+s*16.5}" ${L}/>`;};
  box(true);
  if(field==="full"){box(false,105);o+=`<line x1="0" y1="52.5" x2="68" y2="52.5" ${L}/><circle cx="34" cy="52.5" r="9.15" ${L}/><circle cx="34" cy="52.5" r=".35" fill="#fff"/>`;
    [[0,0,0],[68,0,90],[0,105,270],[68,105,180]].forEach(([cx,cy])=>{});}
  else{o+=`<path d="M 24.85 52.5 A 9.15 9.15 0 0 1 43.15 52.5" ${L}/>`;}
  return o;
}
function wavy(x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);if(len<.5)return `M${x1} ${y1}`;const ux=dx/len,uy=dy/len,nx=-uy,ny=ux;const end=Math.max(0,len-2.2);let d=`M${x1} ${y1}`;const step=.6;for(let t=step;t<=end;t+=step){const a=Math.sin(t*1.6)*.7;d+=` L${(x1+ux*t+nx*a).toFixed(2)} ${(y1+uy*t+ny*a).toFixed(2)}`;}d+=` L${x2} ${y2}`;return d;}
/* Name zu einer nummerierten Spielerin auf der Tafel: b.namen {"rot:1": Spielerin-Kennung} (Trainer) oder
   b.namenText {"rot:1": "Eda"} (veröffentlichte Fassung für Spielerinnen) */
function tokenName(b,it){if(!b||!["blau","rot","gelb","tw"].includes(it.k))return "";const key=it.k+":"+(it.n||"");
  if(b.namenText&&b.namenText[key])return b.namenText[key];const pid=b.namen&&b.namen[key];
  const p=pid&&typeof pById==="function"?(pById(pid)||(typeof pAlle==="function"?pAlle(pid):null)):null;return p?(p.name||"").split(/\s+/)[0]:"";}
function itemMarkup(it,i,s,selected,name){
  const r=2.1*s,fs=2.5*s,nw=Math.max(4,String(name||"").length*fs*.56+1.6*s),ny=it.y+r+.5*s,
    nm=name?`<g pointer-events="none"><rect x="${(it.x-nw/2).toFixed(2)}" y="${ny.toFixed(2)}" width="${nw.toFixed(2)}" height="${(fs+1*s).toFixed(2)}" rx="${(.9*s).toFixed(2)}" fill="#1C2520" fill-opacity=".88"/><text x="${it.x}" y="${(ny+fs*.86+.2*s).toFixed(2)}" text-anchor="middle" font-size="${fs.toFixed(2)}" font-family="Barlow,Arial" font-weight="700" fill="#fff">${esc(name)}</text></g>`:"",hl=selected?`<circle cx="${it.x}" cy="${it.y}" r="${r+1.3}" fill="none" stroke="var(--accent,#2F80ED)" stroke-width=".5" stroke-dasharray="1 .6"/>`:"";
  const lab=it.n?`<text x="${it.x}" y="${it.y+.75*s}" text-anchor="middle" font-size="${2.1*s}" font-family="Barlow Condensed,Arial Narrow,Arial" font-weight="700" fill="${it.k==="gelb"?"#1C2520":"#fff"}" pointer-events="none">${esc(it.n)}</text>`:"";
  const col={blau:"#2F6FA3",rot:"#C23B3B",gelb:"#E2B42A",tw:"#20262A"}[it.k];
  let g="";
  if(col) g=`<circle cx="${it.x}" cy="${it.y}" r="${r}" fill="${col}" stroke="#fff" stroke-width=".35"/>${lab}`;
  else if(it.k==="ball") g=`<circle cx="${it.x}" cy="${it.y}" r="${1*s}" fill="#fff" stroke="#1C2520" stroke-width=".3"/><circle cx="${it.x}" cy="${it.y}" r="${.35*s}" fill="#1C2520"/>`;
  else if(it.k==="cone") g=`<path d="M${it.x} ${it.y-1.4*s} L${it.x+1.2*s} ${it.y+1*s} L${it.x-1.2*s} ${it.y+1*s} Z" fill="#E8792B" stroke="#fff" stroke-width=".25"/>`;
  else if(it.k==="pole") g=`<rect x="${it.x-.35*s}" y="${it.y-2*s}" width="${.7*s}" height="${4*s}" rx=".3" fill="#E2B42A" stroke="#1C2520" stroke-width=".2"/>`;
  else if(it.k==="mini"||it.k==="goal"){const W=it.k==="goal"?7.32:3.2,H=it.k==="goal"?1.6:1.2;const rot=it.r?` transform="rotate(${it.r} ${it.x} ${it.y})"`:"";
    g=`<g${rot}><rect x="${it.x-W/2}" y="${it.y-H/2}" width="${W}" height="${H}" fill="rgba(255,255,255,.35)" stroke="#fff" stroke-width=".5"/><line x1="${it.x-W/2}" y1="${it.y-H/2}" x2="${it.x+W/2}" y2="${it.y-H/2}" stroke="#1C2520" stroke-width=".25"/></g>`;}
  return `<g data-i="${i}" style="cursor:grab">${hl}<circle cx="${it.x}" cy="${it.y}" r="${r+1.6}" fill="transparent"/>${g}${nm}</g>`;
}
function lineMarkup(l,i,pfx,selected){
  const c=selected?"#2F80ED":"#1C2520";const m=`url(#${pfx}-ah${selected?"s":""})`;
  let path=l.k==="dribble"?wavy(l.x1,l.y1,l.x2,l.y2):`M${l.x1} ${l.y1} L${l.x2} ${l.y2}`;
  const dash=l.k==="run"?` stroke-dasharray="1.4 .9"`:"";
  return `<g data-l="${i}" style="cursor:pointer"><path d="M${l.x1} ${l.y1} L${l.x2} ${l.y2}" stroke="transparent" stroke-width="4" fill="none"/><path d="${path}" stroke="${c}" stroke-width=".45" fill="none"${dash} marker-end="${m}" stroke-linejoin="round"/></g>`;
}
function boardSVG(b,pfx,selItem=-1,selLine=-1,draft=null){
  b=b||{field:"half",items:[],lines:[]};const F=FIELDS[b.field]||FIELDS.half;
  let o=`<svg viewBox="${F.vb.join(" ")}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Skizze"><defs>`;
  o+=`<marker id="${pfx}-ah" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#1C2520"/></marker>`;
  o+=`<marker id="${pfx}-ahs" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#2F80ED"/></marker></defs>`;
  o+=`<g>${pitchMarkup(b.field)}</g>`;
  (b.lines||[]).forEach((l,i)=>o+=lineMarkup(l,i,pfx,i===selLine));
  if(draft)o+=lineMarkup(draft,-1,pfx,false);
  (b.items||[]).forEach((it,i)=>o+=itemMarkup(it,i,F.s,i===selItem,tokenName(b,it)));
  return o+"</svg>";
}
const ICON={
  select:'<svg viewBox="0 0 16 16"><path d="M3 2 L13 8 L8.5 9 L11 14 L9 15 L6.5 10 L3 13 Z" fill="currentColor"/></svg>',
  blau:'<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#2F6FA3"/></svg>',
  rot:'<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#C23B3B"/></svg>',
  gelb:'<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#E2B42A"/></svg>',
  tw:'<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#20262A" stroke="#fff"/></svg>',
  ball:'<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="#fff" stroke="currentColor" stroke-width="1.5"/></svg>',
  cone:'<svg viewBox="0 0 16 16"><path d="M8 2 L14 14 L2 14 Z" fill="#E8792B"/></svg>',
  mini:'<svg viewBox="0 0 16 16"><rect x="2" y="5" width="12" height="6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  goal:'<svg viewBox="0 0 16 16"><rect x="1" y="5" width="14" height="6" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
  pole:'<svg viewBox="0 0 16 16"><rect x="6.5" y="1" width="3" height="14" rx="1" fill="#E2B42A" stroke="currentColor"/></svg>',
  pass:'<svg viewBox="0 0 16 16"><path d="M2 13 L12 4" stroke="currentColor" stroke-width="1.6"/><path d="M9 3 L14 2 L13 7 Z" fill="currentColor"/></svg>',
  run:'<svg viewBox="0 0 16 16"><path d="M2 13 L12 4" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/><path d="M9 3 L14 2 L13 7 Z" fill="currentColor"/></svg>',
  dribble:'<svg viewBox="0 0 16 16"><path d="M2 12 q2 -3 3 -1 t3 -2 t3 -2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 3 L14 2 L13 7 Z" fill="currentColor"/></svg>',
  erase:'<svg viewBox="0 0 16 16"><path d="M3 11 L9 3 L14 7 L9 14 H5 Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
};
const TOOLS=[["select","Bewegen"],["sep"],["blau","Blau"],["rot","Rot"],["gelb","Gelb"],["tw","TW"],["sep"],["ball","Ball"],["cone","Hütchen"],["mini","Minitor"],["goal","Tor"],["pole","Stange"],["sep"],["pass","Pass"],["run","Laufweg"],["dribble","Dribbling"],["sep"],["erase","Radierer"]];
let boardSeq=0;const boardTools={};
function mountBoard(el,getB,onChange){
  const bkey=el.dataset.board;const pfx="b"+(++boardSeq);let tool=boardTools[bkey]||"select",sel=-1,selL=-1,drag=null,draft=null;
  el.innerHTML=`<div class="board"><div class="tools" role="toolbar" aria-label="Werkzeuge">${TOOLS.map(t=>t[0]==="sep"?'<span class="tsep"></span>':`<button type="button" class="tool" data-tool="${t[0]}" aria-pressed="${t[0]===tool}" aria-label="${t[1]}" title="${t[1]}">${ICON[t[0]]}<span class="tlabel">${t[1]}</span></button>`).join("")}
    <span class="tsep"></span><label class="tool">Feld <select data-field style="border:0;background:none"><option value="half">Halbes Feld</option><option value="full">Ganzes Feld</option><option value="free">Freie Fläche 40×30</option></select></label></div>
    <div class="stage"></div><div class="selbar"></div></div>`;
  const stage=el.querySelector(".stage"),selbar=el.querySelector(".selbar"),fieldSel=el.querySelector("[data-field]");
  const B=()=>{const b=getB();b.items=b.items||[];b.lines=b.lines||[];b.field=b.field||"half";return b;};
  fieldSel.value=B().field;
  function draw(){stage.innerHTML=boardSVG(B(),pfx,sel,selL,draft);drawSel();}
  function drawSel(){
    const b=B();
    if(sel>=0&&b.items[sel]){const it=b.items[sel];const isP=["blau","rot","gelb","tw"].includes(it.k);const isG=["mini","goal"].includes(it.k);
      selbar.innerHTML=`${isP?`<label>Beschriftung <input class="inp" data-lab maxlength="3" value="${esc(it.n||"")}"></label>`:""}${isG?'<button type="button" class="btn sm" data-rot>Drehen</button>':""}<button type="button" class="btn sm danger" data-del>Entfernen</button>`;}
    else if(selL>=0&&b.lines[selL]) selbar.innerHTML=`<button type="button" class="btn sm" data-flip>Richtung umdrehen</button><button type="button" class="btn sm danger" data-del>Entfernen</button>`;
    else selbar.innerHTML=`<span><b>${esc((TOOLS.find(x=>x[0]===tool)||[])[1]||"")}:</b> ${tool==="select"?"Tippe auf ein Element, um es zu verschieben oder zu bearbeiten. Wischen übers leere Feld scrollt.":["pass","run","dribble"].includes(tool)?"Ziehe auf dem Feld, um den Pfeil zu zeichnen.":tool==="erase"?"Tippe auf ein Element, um es zu entfernen.":"Tippe aufs Feld, um es zu platzieren."}</span><span style="margin-left:auto"></span>${(b.items.length||b.lines.length)?'<button type="button" class="btn sm ghost" data-clear>Skizze leeren</button>':""}`;
  }
  function pt(e){const svg=stage.querySelector("svg");const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return {x:+q.x.toFixed(2),y:+q.y.toFixed(2)};}
  function nextNum(k){const b=B();if(k==="tw")return "TW";const ns=b.items.filter(i=>i.k===k).map(i=>parseInt(i.n,10)).filter(n=>!isNaN(n));return String(ns.length?Math.max(...ns)+1:1);}
  el.querySelector(".tools").addEventListener("click",e=>{const b=e.target.closest("[data-tool]");if(!b)return;tool=b.dataset.tool;boardTools[bkey]=tool;sel=-1;selL=-1;el.querySelectorAll("[data-tool]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.tool===tool));draw();});
  fieldSel.addEventListener("change",()=>{B().field=fieldSel.value;onChange();draw();});
  selbar.addEventListener("click",e=>{const b=B();
    if(e.target.closest("[data-del]")){if(sel>=0)b.items.splice(sel,1);else if(selL>=0)b.lines.splice(selL,1);sel=-1;selL=-1;onChange();draw();}
    else if(e.target.closest("[data-rot]")){const it=b.items[sel];it.r=((it.r||0)+90)%180;onChange();draw();}
    else if(e.target.closest("[data-flip]")){const l=b.lines[selL];[l.x1,l.y1,l.x2,l.y2]=[l.x2,l.y2,l.x1,l.y1];onChange();draw();}
    else if(e.target.closest("[data-clear]")){b.items=[];b.lines=[];onChange();draw();}});
  selbar.addEventListener("input",e=>{if(e.target.matches("[data-lab]")){B().items[sel].n=e.target.value;stage.innerHTML=boardSVG(B(),pfx,sel,selL,null);onChange();}});
  /* Touch: Die Tafel wird beim Ziehen ständig neu gezeichnet. Deshalb hält die Bühne (stage) den Finger fest,
     nicht das SVG – sonst verliert das Handy den Finger, sobald das alte SVG ersetzt wird.
     Im Modus „Bewegen“ scrollt ein Wischen übers leere Feld die Seite; sonst bleibt die Seite stehen. */
  let active=null;
  const grabs=t=>tool!=="select"||!!(t&&t.closest&&t.closest("[data-i],[data-l]"));
  stage.addEventListener("touchstart",e=>{if(e.touches.length===1&&grabs(e.target))e.preventDefault();},{passive:false});
  const clampP=p=>{const [x0,y0,w,h]=(FIELDS[B().field]||FIELDS.half).vb;return {x:Math.min(Math.max(p.x,x0+1),x0+w-1),y:Math.min(Math.max(p.y,y0+1),y0+h-1)};};
  stage.addEventListener("pointerdown",e=>{
    const svg=stage.querySelector("svg");if(!svg||active!=null)return;if(e.pointerType==="mouse"&&e.button!==0)return;
    // Das angetippte Element verschwindet gleich durchs Neuzeichnen; sein touchstart käme dann nicht mehr bei der Bühne an.
    if(e.pointerType==="touch"&&grabs(e.target))e.target.addEventListener("touchstart",t=>{if(t.cancelable)t.preventDefault();},{passive:false,once:true});
    const p=pt(e);const b=B();
    const gi=e.target.closest("[data-i]"),gl=e.target.closest("[data-l]");
    const capture=()=>{active=e.pointerId;try{stage.setPointerCapture(e.pointerId);}catch(err){}};
    if(tool==="erase"){if(gi){b.items.splice(+gi.dataset.i,1);onChange();draw();}else if(gl&&gl.dataset.l>=0){b.lines.splice(+gl.dataset.l,1);onChange();draw();}return;}
    if(tool==="select"){
      if(gi){sel=+gi.dataset.i;selL=-1;const it=b.items[sel];drag={dx:p.x-it.x,dy:p.y-it.y,moved:false};capture();draw();}
      else if(gl&&gl.dataset.l>=0){selL=+gl.dataset.l;sel=-1;const l=b.lines[selL];drag={line:true,sx:p.x,sy:p.y,o:{...l},moved:false};capture();draw();}
      else if(sel>=0||selL>=0){sel=-1;selL=-1;draw();}
      return;}
    if(["pass","run","dribble"].includes(tool)){draft={k:tool,x1:p.x,y1:p.y,x2:p.x,y2:p.y};capture();return;}
    const q=clampP(p);const it={k:tool,x:+q.x.toFixed(2),y:+q.y.toFixed(2)};if(["blau","rot","gelb","tw"].includes(tool))it.n=nextNum(tool);
    b.items.push(it);onChange();draw();
  });
  stage.addEventListener("pointermove",e=>{
    if((!drag&&!draft)||e.pointerId!==active)return;const p=clampP(pt(e));const b=B();
    if(draft){draft.x2=p.x;draft.y2=p.y;stage.innerHTML=boardSVG(b,pfx,-1,-1,draft);return;}
    if(drag.line){const l=b.lines[selL],dx=p.x-drag.sx,dy=p.y-drag.sy;l.x1=+(drag.o.x1+dx).toFixed(2);l.y1=+(drag.o.y1+dy).toFixed(2);l.x2=+(drag.o.x2+dx).toFixed(2);l.y2=+(drag.o.y2+dy).toFixed(2);}
    else{const it=b.items[sel];it.x=+(p.x-drag.dx).toFixed(2);it.y=+(p.y-drag.dy).toFixed(2);}
    drag.moved=true;stage.innerHTML=boardSVG(b,pfx,sel,selL,null);
  });
  const end=e=>{if(e.pointerId!==active)return;active=null;const b=B();
    if(draft){if(Math.hypot(draft.x2-draft.x1,draft.y2-draft.y1)>2){b.lines.push({...draft});onChange();}draft=null;draw();}
    if(drag){if(drag.moved)onChange();drag=null;}
  };
  stage.addEventListener("pointerup",end);stage.addEventListener("pointercancel",end);
  draw();
}
function boardMaterial(b){const c={};(b&&b.items||[]).forEach(i=>{const k={cone:"huetchen",mini:"minitore",goal:"tore",pole:"stangen",ball:"baelle"}[i.k];if(k)c[k]=(c[k]||0)+1;});return c;}

