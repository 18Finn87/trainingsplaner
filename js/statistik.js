"use strict";
/* ---------- Statistik ----------
   Gezählt werden nur Trainings im gewählten Zeitraum, die nicht in der Zukunft liegen und
   bei denen die Anwesenheit erfasst ist (mindestens eine Spielerin anwesend oder abwesend). */
const ZEITRAUM=[["4w","4 Wochen"],["3m","3 Monate"],["saison","Saison"],["alle","Alles"],["frei","Frei"]];
function zeitraum(){
  const z=S.ui.stZ||"saison",h=new Date(),heute=today();
  if(z==="frei")return {von:S.ui.stVon||"",bis:S.ui.stBis||heute};
  if(z==="alle")return {von:"",bis:heute};
  if(z==="4w")return {von:iso(new Date(h.getFullYear(),h.getMonth(),h.getDate()-28)),bis:heute};
  if(z==="3m")return {von:iso(new Date(h.getFullYear(),h.getMonth()-3,h.getDate())),bis:heute};
  const sj=h.getMonth()>=6?h.getFullYear():h.getFullYear()-1;return {von:`${sj}-07-01`,bis:heute}; // Saison ab 1. Juli
}
const erfasst=t=>Object.values(t.anwesenheit||{}).some(v=>v==="ja"||v==="nein");
function statTrainings(){const {von,bis}=zeitraum();
  return ofTeam("trainings").filter(([,t])=>t.datum&&(!von||t.datum>=von)&&t.datum<=bis&&erfasst(t)).sort((a,b)=>a[1].datum.localeCompare(b[1].datum));}
const pct=(a,b)=>b?Math.round(a*100/b):0;
const tipAttr=s=>` data-tip="${esc(s)}" tabindex="0"`;

function vStatistik(){
  const tr=statTrainings(),{von,bis}=zeitraum(),z=S.ui.stZ||"saison",n=tr.length;
  const zsel=`<div class="seg zseg" role="radiogroup" aria-label="Zeitraum">${ZEITRAUM.map(([k,l])=>`<button type="button" role="radio" aria-checked="${z===k}" data-act="stZ" data-v="${k}">${l}</button>`).join("")}</div>
    ${z==="frei"?`<div class="meta"><label class="f">Von<input type="date" data-key="stvon" data-act="stDate" data-f="stVon" value="${esc(S.ui.stVon||"")}"></label><label class="f">Bis<input type="date" data-key="stbis" data-act="stDate" data-f="stBis" value="${esc(S.ui.stBis||today())}"></label></div>`:""}
    <p class="legend">${n} erfasste${n===1?"s":""} Training${n===1?"":"s"}${von?` vom ${esc(fmtDate(von))}`:""} bis ${esc(fmtDate(bis))}</p>`;
  return `<div class="narrow"><h2 class="page-h">Statistik</h2>${zsel}
    ${limBlock()}
    ${n?verlaufBlock(tr)+spielerBlock(tr)+inhaltBlock(tr):`<div class="empty" style="margin-top:20px"><h3>Noch keine Daten in diesem Zeitraum</h3><p>Sobald du bei Trainings die Anwesenheit erfasst, erscheint hier die Auswertung.</p></div>`}</div>`;
}

/* Aktuell nicht voll belastbar – unabhängig vom Zeitraum. */
function limBlock(){
  const ps=players().filter(p=>p.einschr).sort((a,b)=>(a.einschr.seit||"").localeCompare(b.einschr.seit||""));
  const tage=s=>s?Math.max(0,Math.round((new Date(today()+"T12:00")-new Date(s+"T12:00"))/864e5)):null;
  return `<section class="blk"><h3>Nicht voll belastbar <span class="sub">${ps.length?`${ps.length} Spielerin${ps.length>1?"nen":""}`:"alle fit"}</span></h3>
    ${ps.length?`<div class="tablewrap"><table class="mt st"><thead><tr><th>Spielerin</th><th>Grund</th><th>Seit</th><th class="n">Seitdem da</th></tr></thead><tbody>
    ${ps.map(p=>{const e=p.einschr,d=tage(e.seit);const seit=ofTeam("trainings").map(([,t])=>t).filter(t=>t.datum&&e.seit&&t.datum>=e.seit&&t.datum<=today()&&erfasst(t));const da=seit.filter(t=>t.anwesenheit[p.id]==="ja").length;
      return `<tr><td><b>${esc(p.name)}</b>${p.tw?' <span class="twm">TW</span>':""}</td><td>${esc(e.grund)}${e.notiz?`<div class="src">${esc(e.notiz)}</div>`:""}</td><td>${e.seit?esc(`${+e.seit.slice(8,10)}.${+e.seit.slice(5,7)}.`):"–"}${d!=null?`<div class="src">${d===0?"heute":d===1?"1 Tag":d+" Tage"}</div>`:""}</td><td class="n">${da} / ${seit.length}<div class="src">Trainings</div></td></tr>`;}).join("")}</tbody></table></div>
    <p class="legend">Ändern im Kader oder im Training über „⋯“.</p>`:'<p class="hint">Im Moment ist keine Spielerin als eingeschränkt markiert.</p>'}</section>`;
}

/* Verlauf: anwesende Spielerinnen je Training (Balken, eine Reihe). */
function verlaufBlock(tr){
  const vals=tr.map(([id,t])=>{const s=attSummary(t),hc=headcount(t);return {id,t,v:s.ja,s,hc};});
  const max=Math.max(...vals.map(x=>x.v),1);const step=max<=10?2:max<=25?5:10;const top=Math.ceil(max/step)*step;
  const W=innerWidth<600?340:640,H=innerWidth<600?190:200,L=30,R=6,T=10,B=26,iw=W-L-R,ih=H-T-B,bw=iw/vals.length,gap=Math.min(6,bw*.25),w=Math.max(2,bw-gap);
  const y=v=>T+ih-(v/top)*ih;
  let g="";for(let v=0;v<=top;v+=step)g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L-6}" y="${y(v)+4}" class="ax" text-anchor="end">${v}</text>`;
  const every=Math.ceil(vals.length/(W<400?4:6));
  const bars=vals.map((x,i)=>{const bx=L+i*bw+gap/2,by=y(x.v),bh=T+ih-by,r=Math.min(4,w/2,bh);
    const d=bh>0?`M${bx} ${T+ih} V${by+r} Q${bx} ${by} ${bx+r} ${by} H${bx+w-r} Q${bx+w} ${by} ${bx+w} ${by+r} V${T+ih} Z`:"";
    const tip=`${fmtDate(x.t.datum)}${x.t.thema?" – "+x.t.thema:""}: ${x.v} anwesend (${x.hc.F} Feld + ${x.hc.T} TW), ${x.s.nein} abwesend${x.s.lim?`, ${x.s.lim} eingeschränkt`:""}`;
    return `<g class="bar" data-act="stOpen" data-id="${x.id}"${tipAttr(tip)}><rect x="${L+i*bw}" y="${T}" width="${bw}" height="${ih}" fill="transparent"/>${d?`<path d="${d}"/>`:""}</g>${i%every===0||i===vals.length-1?`<text x="${bx+w/2}" y="${H-8}" class="ax" text-anchor="middle">${esc(x.t.datum.slice(8,10)+"."+x.t.datum.slice(5,7)+".")}</text>`:""}`;}).join("");
  const avg=Math.round(vals.reduce((a,x)=>a+x.v,0)/vals.length*10)/10;
  return `<section class="blk"><h3>Anwesenheit pro Training <span class="sub">Ø ${String(avg).replace(".",",")} Spielerinnen</span></h3>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Anwesende Spielerinnen je Training">${g}${bars}</svg>
    <p class="legend">Balken antippen zeigt die Zahlen; zweimal tippen öffnet das Training.</p></section>`;
}

/* Pro Spielerin: Anzahl und Prozent der erfassten Trainings. */
function spielerBlock(tr){
  const n=tr.length;const sort=S.ui.stSort||"pct";
  const rows=players().map(p=>{let ja=0,nein=0,lim=0;tr.forEach(([,t])=>{const s=t.anwesenheit[p.id];if(s==="ja")ja++;else if(s==="nein")nein++;if(t.einschr&&t.einschr[p.id])lim++;});return {p,ja,nein,lim,pc:pct(ja,n)};})
    .filter(r=>r.ja||r.nein||!S.ui.stNurAktive)
    .sort((a,b)=>sort==="name"?a.p.name.localeCompare(b.p.name):(b.pc-a.pc)||a.p.name.localeCompare(b.p.name));
  return `<section class="blk"><h3>Anwesenheit pro Spielerin <span class="sub">von ${n} Training${n===1?"":"s"}</span></h3>
    <div class="row-actions" style="margin:0 0 12px"><button class="btn sm${sort==="pct"?" pri":""}" data-act="stSort" data-v="pct">Nach Quote</button><button class="btn sm${sort==="name"?" pri":""}" data-act="stSort" data-v="name">Nach Name</button>
      <button class="btn sm ghost" data-act="stAktive">${S.ui.stNurAktive?"Alle zeigen":"Nur mit Einträgen"}</button></div>
    <div class="hbars">${rows.map(r=>`<div class="hrow"${tipAttr(`${r.p.name}: ${r.ja}× anwesend, ${r.nein}× abwesend, ${n-r.ja-r.nein}× nicht erfasst${r.lim?`, ${r.lim}× eingeschränkt`:""}`)}>
      <span class="hl">${esc(r.p.name)}${r.p.tw?' <span class="twm">TW</span>':""}</span><span class="hb"><i style="width:${r.pc}%"></i></span><span class="hv"><b>${r.pc} %</b> ${r.ja}/${n}</span></div>`).join("")}</div></section>`;
}

/* Trainingsinhalte (oder Kategorien): in wie vielen Trainings und mit wie vielen Minuten. */
function inhaltBlock(tr){
  const mode=S.ui.stInh||"tags";const c={};
  tr.forEach(([,t])=>{const seen=new Set();unitsOf(t).forEach(u=>u.steps.forEach(st=>{if(!st.ex)return;const keys=mode==="tags"?(st.ex.tags||[]):[st.ex.kategorie||"Ohne Kategorie"];
    // Bei Stationen verbringt jede Gruppe im Schnitt Runden/Stationen Runden an dieser Station.
    const min=u.block?unitRound(t,u)*unitRounds(t,u)/u.steps.length:u.dur;
    keys.forEach(k=>{c[k]=c[k]||{n:0,min:0};if(!seen.has(k)){c[k].n++;seen.add(k);}c[k].min+=Math.round(min);});}));});
  const order=mode==="tags"?S.settings.tags:katList();
  const rows=Object.entries(c).sort((a,b)=>(b[1].n-a[1].n)||(b[1].min-a[1].min));
  const nie=order.filter(k=>!c[k]);const max=Math.max(...rows.map(r=>r[1].n),1);
  return `<section class="blk"><h3>Was wurde trainiert? <span class="sub">${tr.length} Training${tr.length===1?"":"s"}</span></h3>
    <div class="seg two" role="radiogroup" aria-label="Auswertung nach"><button type="button" role="radio" aria-checked="${mode==="tags"}" data-act="stInh" data-v="tags">Trainingsinhalte</button><button type="button" role="radio" aria-checked="${mode==="kat"}" data-act="stInh" data-v="kat">Kategorien</button></div>
    <div class="hbars" style="margin-top:14px">${rows.map(([k,v])=>`<div class="hrow"${tipAttr(`${k}: in ${v.n} von ${tr.length} Trainings, zusammen etwa ${v.min} Minuten`)}><span class="hl">${esc(k)}</span><span class="hb"><i style="width:${v.n/max*100}%"></i></span><span class="hv"><b>${v.n}×</b> ${v.min} min</span></div>`).join("")||'<p class="hint">Die Übungen in diesen Trainings haben noch keine Inhalte eingetragen.</p>'}</div>
    ${nie.length?`<p class="legend">Nicht trainiert: ${esc(nie.join(", "))}</p>`:""}
    <p class="legend">Zählt, in wie vielen Trainings ein Inhalt mindestens einmal vorkam; Minuten bei parallelen Stationen pro Gruppe.</p></section>`;
}

/* Tooltip: Maus darüber oder antippen. */
const tipEl=document.createElement("div");tipEl.className="tip";tipEl.hidden=true;document.body.appendChild(tipEl);
function showTip(el,x,y){tipEl.textContent=el.dataset.tip;tipEl.hidden=false;const r=tipEl.getBoundingClientRect();
  tipEl.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x-r.width/2))+"px";tipEl.style.top=Math.max(8,y-r.height-12)+"px";}
document.addEventListener("pointerover",e=>{const el=e.target.closest&&e.target.closest("[data-tip]");if(el&&e.pointerType==="mouse")showTip(el,e.clientX,e.clientY);});
document.addEventListener("pointermove",e=>{const el=e.target.closest&&e.target.closest("[data-tip]");if(el&&e.pointerType==="mouse")showTip(el,e.clientX,e.clientY);else if(e.pointerType==="mouse")tipEl.hidden=true;});
document.addEventListener("focusin",e=>{const el=e.target.closest&&e.target.closest("[data-tip]");if(el){const r=el.getBoundingClientRect();showTip(el,r.left+r.width/2,r.top);}});
let lastTip=null;
$("#app").addEventListener("click",e=>{
  const tipT=e.target.closest("[data-tip]");
  const el=e.target.closest("[data-act]");const a=el&&el.dataset.act;
  if(a==="stOpen"){if(lastTip===el.dataset.id){S.sel.training=el.dataset.id;S.view="training";tipEl.hidden=true;render();window.scrollTo(0,0);return;}lastTip=el.dataset.id;}
  else lastTip=null;
  if(tipT){showTip(tipT,e.clientX,e.clientY);}else tipEl.hidden=true;
  if(a==="stZ"){S.ui.stZ=el.dataset.v;render();}
  if(a==="stSort"){S.ui.stSort=el.dataset.v;render();}
  if(a==="stAktive"){S.ui.stNurAktive=!S.ui.stNurAktive;render();}
  if(a==="stInh"){S.ui.stInh=el.dataset.v;render();}
});
$("#app").addEventListener("change",e=>{const el=e.target;if(el.dataset.act==="stDate"){S.ui[el.dataset.f]=el.value;render();}});
window.addEventListener("scroll",()=>{tipEl.hidden=true;},{passive:true});
