"use strict";
/* ---------- Statistik ----------
   Ausgewertet werden durchgeführte Trainings der gewählten Mannschaft (Umschalter „Geplant“ für die Planwerte).
   Rechenregel: Trainingszeit zählt nur beim Hauptschwerpunkt. Nebenschwerpunkte sind Zusatzinhalte –
   eigene Häufigkeit und Minuten, nie zur Gesamtzeit addiert. Stationen: Minuten pro Gruppe. */
const ZEITRAUM=[["woche","Woche"],["monat","Monat"],["halbserie","Halbserie"],["saison","Saison"],["alle","Alles"],["frei","Frei"]];
const OHNE="Ohne Hauptschwerpunkt";
const mmdd=v=>/^\d{2}-\d{2}$/.test(v||"")?v:null;
const dayShift=(s,n)=>{const d=new Date(s+"T12:00");d.setDate(d.getDate()+n);return iso(d);};
function saisonVon(d){const st=mmdd(S.settings.saisonStart)||"07-01",y=d.getFullYear(),c=`${y}-${st}`;return iso(d)>=c?c:`${y-1}-${st}`;}
/* Hinrunde: Saisonbeginn bis vor dem Wechsel; Rückrunde: Wechsel bis Saisonende. */
function halbserie(d){
  const sv=saisonVon(d),sy=+sv.slice(0,4),w=mmdd(S.settings.halbserieWechsel)||"01-01";let wd=`${sy}-${w}`;if(wd<=sv)wd=`${sy+1}-${w}`;
  const ende=dayShift(`${sy+1}-${sv.slice(5)}`,-1);return iso(d)<wd?{von:sv,ende:dayShift(wd,-1),name:"Hinrunde"}:{von:wd,ende,name:"Rückrunde"};
}
/* von, bis (= heute oder Ende, für Durchgeführtes) und ende (Zeitraumende, für Geplantes). */
function zeitraum(){
  const z=S.ui.stZ||"saison",h=new Date(),heute=today();const cap=e=>e<heute?e:heute;
  if(z==="frei"){const b=S.ui.stBis||heute;return {von:S.ui.stVon||"",bis:cap(b),ende:b,name:"frei gewählt"};}
  if(z==="alle")return {von:"",bis:heute,ende:"9999-12-31",name:"gesamt"};
  if(z==="woche"){const m=dayShift(heute,-((h.getDay()+6)%7));return {von:m,bis:heute,ende:dayShift(m,6),name:"diese Woche"};}
  if(z==="monat"){const v=iso(new Date(h.getFullYear(),h.getMonth(),1));return {von:v,bis:heute,ende:iso(new Date(h.getFullYear(),h.getMonth()+1,0)),name:"dieser Monat"};}
  if(z==="halbserie"){const r=halbserie(h);return {von:r.von,bis:cap(r.ende),ende:r.ende,name:r.name};}
  const v=saisonVon(h);return {von:v,bis:heute,ende:dayShift(`${+v.slice(0,4)+1}-${v.slice(5)}`,-1),name:"Saison"};
}
const durchg=t=>!!t.durchgefuehrt;
function statTrainings(mode="ist"){const {von,bis,ende}=zeitraum();const b=mode==="plan"?ende:bis;
  return ofTeam("trainings").filter(([,t])=>t.datum&&(!von||t.datum>=von)&&t.datum<=b&&(mode==="plan"||durchg(t))).sort((a,b)=>a[1].datum.localeCompare(b[1].datum));}
const pct=(a,b)=>b?Math.round(a*100/b):0;
const tipAttr=s=>` data-tip="${esc(s)}" tabindex="0"`;
const fmtMin=m=>{m=Math.round(m);return m>=120?`${Math.floor(m/60)} h ${m%60?m%60+" min":""}`.trim():`${m} min`;};

/* ---------- Grundbausteine ---------- */
/* Bestandteile eines Trainings: je Schritt bzw. Station Name, Haupt-, Nebenschwerpunkte, Minuten, Position im Ablauf. */
function parts(t,pm){const out=[];unitsOf(t).forEach(u=>u.steps.forEach(st=>{if(!st.ex)return;const min=stepMin(t,u,st,pm);if(!min)return;
  out.push({i:st.i,name:exName(st.ex),haupt:st.ex.haupt||OHNE,neben:st.ex.tags||[],min});}));return out;}
/* Was eine Spielerin mitgemacht hat: nur wenn anwesend; bei „raus ab“ nur die Schritte davor. */
function rausIdx(t,pid){const ra=(t.rausAb||{})[pid];return ra?(t.ablauf||[]).findIndex(s=>s.uid===ra):-1;}
function playerParts(t,pid,pm){if((t.anwesenheit||{})[pid]!=="ja")return [];const ri=rausIdx(t,pid);return parts(t,pm).filter(p=>ri<0||p.i<ri);}
function missedParts(t,pid,pm){if((t.anwesenheit||{})[pid]!=="ja")return parts(t,pm);const ri=rausIdx(t,pid);return ri<0?[]:parts(t,pm).filter(p=>p.i>=ri);}
const sumHaupt=ps=>ps.reduce((m,p)=>{m[p.haupt]=(m[p.haupt]||0)+p.min;return m;},{});
const total=ps=>ps.reduce((a,p)=>a+p.min,0);
/* Farben: feste Reihenfolge der Hauptschwerpunkt-Liste (geprüfte Kategorie-Palette, 8 Plätze); ohne = Grau. */
function hauptOrder(extra){const l=(S.settings.schwerpunkte||[]).slice();Object.keys(extra||{}).forEach(k=>{if(k!==OHNE&&!l.includes(k))l.push(k);});if(extra&&extra[OHNE])l.push(OHNE);return l;}
function hauptCol(k){const i=(S.settings.schwerpunkte||[]).indexOf(k);return i>=0&&i<8?`var(--s${i+1})`:"var(--s0)";}
const swatch=k=>`<i class="sw" style="background:${hauptCol(k)}"></i>`;
const seg=(act,cur,opts,cls="")=>`<div class="seg${cls}" style="grid-template-columns:repeat(${opts.length},1fr)" role="radiogroup">${opts.map(([v,l])=>`<button type="button" role="radio" aria-checked="${cur===v}" data-act="${act}" data-v="${v}">${l}</button>`).join("")}</div>`;

/* ---------- Seite ---------- */
function vStatistik(){
  const tab=S.ui.stTab||"ueberblick",z=S.ui.stZ||"saison",zr=zeitraum();const tr=statTrainings("ist");
  const zsel=`<div class="seg zseg" role="radiogroup" aria-label="Zeitraum">${ZEITRAUM.map(([k,l])=>`<button type="button" role="radio" aria-checked="${z===k}" data-act="stZ" data-v="${k}">${l}</button>`).join("")}</div>
    ${z==="frei"?`<div class="meta"><label class="f">Von<input type="date" data-key="stvon" data-act="stDate" data-f="stVon" value="${esc(S.ui.stVon||"")}"></label><label class="f">Bis<input type="date" data-key="stbis" data-act="stDate" data-f="stBis" value="${esc(S.ui.stBis||today())}"></label></div>`:""}
    <p class="legend">${esc(zr.name[0].toUpperCase()+zr.name.slice(1))}${zr.von?` · ${esc(fmtDate(zr.von))}`:""} bis ${esc(fmtDate(zr.bis))} · ${tr.length} durchgeführte${tr.length===1?"s":""} Training${tr.length===1?"":"s"}</p>`;
  const tabs=seg("stTab",tab,[["ueberblick","Überblick"],["inhalte","Inhalte"],["spielerinnen","Spielerinnen"],["uebungen","Übungen"]]," tabs4");
  const leer=`<div class="empty" style="margin-top:20px"><h3>Noch keine durchgeführten Trainings in diesem Zeitraum</h3><p>Markiere Trainings im Bereich „Durchführung“ als durchgeführt – dann erscheint hier die Auswertung. Geplante Werte siehst du unter „Inhalte“ mit „Geplant“.</p></div>`;
  let body="";
  if(tab==="ueberblick")body=limBlock()+(tr.length?kennBlock(tr)+verlaufBlock(tr):leer);
  else if(tab==="inhalte"){const pm=S.ui.stPlan||"ist",trp=statTrainings(pm);
    body=seg("stPlan",pm,[["ist","Durchgeführt"],["plan","Geplant"]])+(trp.length?pieBlock(trp,pm)+zeitBlock(trp,pm)+vergleichBlock(pm)+nebenBlock(trp,pm):(pm==="ist"?leer:'<p class="hint" style="margin-top:14px">Keine geplanten Trainings in diesem Zeitraum.</p>'));}
  else if(tab==="spielerinnen")body=tr.length?spielerBlock(tr)+spielerDetail(tr)+vergleichSpielerinnen(tr):leer;
  else body=uebungBlock();
  return `<div class="narrow"><h2 class="page-h">Statistik</h2>${zsel}${tabs}${body}</div>`;
}

/* ---------- Überblick ---------- */
function kennBlock(tr){
  const mins=tr.map(([,t])=>trainingMin(t,"ist")),ges=mins.reduce((a,b)=>a+b,0),plan=tr.reduce((a,[,t])=>a+trainingMin(t,"plan"),0);
  const da=tr.reduce((a,[,t])=>a+attSummary(t).ja,0);
  return `<section class="blk"><h3>Auf einen Blick</h3><div class="asum">
    <span><b>${tr.length}</b> Trainings durchgeführt</span><span><b>${fmtMin(ges)}</b> Trainingszeit${plan!==ges?` <small>(geplant ${fmtMin(plan)})</small>`:""}</span>
    <span><b>${fmtMin(ges/tr.length)}</b> pro Training</span><span><b>${String(Math.round(da/tr.length*10)/10).replace(".",",")}</b> Spielerinnen im Schnitt</span></div></section>`;
}
/* Aktuell nicht voll belastbar – unabhängig vom Zeitraum. */
function limBlock(){
  const ps=players().filter(p=>p.einschr).sort((a,b)=>(a.einschr.seit||"").localeCompare(b.einschr.seit||""));
  const tage=s=>s?Math.max(0,Math.round((new Date(today()+"T12:00")-new Date(s+"T12:00"))/864e5)):null;
  return `<section class="blk"><h3>Nicht voll belastbar <span class="sub">${ps.length?`${ps.length} Spielerin${ps.length>1?"nen":""}`:"alle fit"}</span></h3>
    ${ps.length?`<div class="tablewrap"><table class="mt st"><thead><tr><th>Spielerin</th><th>Grund</th><th>Seit</th><th class="n">Seitdem da</th></tr></thead><tbody>
    ${ps.map(p=>{const e=p.einschr,d=tage(e.seit);const seit=ofTeam("trainings").map(([,t])=>t).filter(t=>t.datum&&e.seit&&t.datum>=e.seit&&t.datum<=today()&&durchg(t));const da=seit.filter(t=>t.anwesenheit[p.id]==="ja").length;
      return `<tr><td><b>${esc(p.name)}</b>${p.tw?' <span class="twm">TW</span>':""}</td><td>${esc(e.grund)}${e.notiz?`<div class="src">${esc(e.notiz)}</div>`:""}</td><td>${e.seit?esc(`${+e.seit.slice(8,10)}.${+e.seit.slice(5,7)}.`):"–"}${d!=null?`<div class="src">${d===0?"heute":d===1?"1 Tag":d+" Tage"}</div>`:""}</td><td class="n">${da} / ${seit.length}<div class="src">Trainings</div></td></tr>`;}).join("")}</tbody></table></div>
    <p class="legend">Ändern im Kader oder im Training über „⋯“.</p>`:'<p class="hint">Im Moment ist keine Spielerin als eingeschränkt markiert.</p>'}</section>`;
}
/* Gemeinsame Balken-Geometrie (Mobil schmaler, damit die Schrift lesbar bleibt). */
function chartFrame(n,max,stepFix){
  const step=stepFix||(max<=10?2:max<=25?5:max<=60?10:max<=150?30:60);const top=Math.max(step,Math.ceil(max/step)*step);
  const W=innerWidth<600?340:640,H=innerWidth<600?190:210,L=34,R=6,T=10,B=26,iw=W-L-R,ih=H-T-B,bw=iw/n,gap=Math.min(6,bw*.25),w=Math.max(2,bw-gap);
  const y=v=>T+ih-(v/top)*ih;let g="";for(let v=0;v<=top;v+=step)g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L-6}" y="${y(v)+4}" class="ax" text-anchor="end">${v}</text>`;
  return {W,H,L,T,B,ih,bw,gap,w,y,g,every:Math.ceil(n/(W<400?4:6))};
}
const topRound=(x,yTop,w,h,r)=>`M${x} ${yTop+h} V${yTop+r} Q${x} ${yTop} ${x+r} ${yTop} H${x+w-r} Q${x+w} ${yTop} ${x+w} ${yTop+r} V${yTop+h} Z`;
const dLabel=d=>d.slice(8,10)+"."+d.slice(5,7)+".";
function verlaufBlock(tr){
  const vals=tr.map(([id,t])=>({id,t,v:attSummary(t).ja,s:attSummary(t),hc:headcount(t)}));const f=chartFrame(vals.length,Math.max(...vals.map(x=>x.v),1));
  const bars=vals.map((x,i)=>{const bx=f.L+i*f.bw+f.gap/2,by=f.y(x.v),bh=f.T+f.ih-by,r=Math.min(4,f.w/2,bh);
    const tip=`${fmtDate(x.t.datum)}${x.t.thema?" – "+x.t.thema:""}: ${x.v} anwesend (${x.hc.F} Feld + ${x.hc.T} TW), ${x.s.nein} abwesend${x.s.lim?`, ${x.s.lim} eingeschränkt`:""}`;
    return `<g class="bar" data-act="stOpen" data-id="${x.id}"${tipAttr(tip)}><rect x="${f.L+i*f.bw}" y="${f.T}" width="${f.bw}" height="${f.ih}" fill="transparent"/>${bh>0?`<path d="${topRound(bx,by,f.w,bh,r)}"/>`:""}</g>${i%f.every===0||i===vals.length-1?`<text x="${bx+f.w/2}" y="${f.H-8}" class="ax" text-anchor="middle">${dLabel(x.t.datum)}</text>`:""}`;}).join("");
  const avg=Math.round(vals.reduce((a,x)=>a+x.v,0)/vals.length*10)/10;
  return `<section class="blk"><h3>Anwesenheit pro Training <span class="sub">Ø ${String(avg).replace(".",",")} Spielerinnen</span></h3>
    <svg class="chart" viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="Anwesende Spielerinnen je Training">${f.g}${bars}</svg>
    <p class="legend">Balken antippen zeigt die Zahlen; zweimal tippen öffnet das Training.</p></section>`;
}

/* ---------- Inhalte ---------- */
/* Kreisdiagramm: Verteilung der Trainingszeit auf die Hauptschwerpunkte. */
function pieBlock(tr,pm){
  const m=sumHaupt(tr.flatMap(([,t])=>parts(t,pm)));const ord=hauptOrder(m).filter(k=>m[k]);const ges=ord.reduce((a,k)=>a+m[k],0);
  if(!ges)return `<section class="blk"><h3>Verteilung der Hauptschwerpunkte</h3><p class="hint">Keine Minuten in diesem Zeitraum.</p></section>`;
  const R=80,r=48,c=90;let a=-Math.PI/2;const pt=(rad,ang)=>`${(c+rad*Math.cos(ang)).toFixed(2)} ${(c+rad*Math.sin(ang)).toFixed(2)}`;
  const arcs=ord.map(k=>{const da=m[k]/ges*Math.PI*2,a0=a,a1=a+da;a=a1;const big=da>Math.PI?1:0;const tip=`${k}: ${fmtMin(m[k])} (${pct(m[k],ges)} %)`;
    const d=ord.length===1?`M${pt(R,0)} A${R} ${R} 0 1 1 ${pt(R,Math.PI)} A${R} ${R} 0 1 1 ${pt(R,0)} M${pt(r,0)} A${r} ${r} 0 1 0 ${pt(r,Math.PI)} A${r} ${r} 0 1 0 ${pt(r,0)} Z`
      :`M${pt(R,a0)} A${R} ${R} 0 ${big} 1 ${pt(R,a1)} L${pt(r,a1)} A${r} ${r} 0 ${big} 0 ${pt(r,a0)} Z`;
    return `<path d="${d}" fill="${hauptCol(k)}" class="slice" fill-rule="evenodd"${tipAttr(tip)}/>`;}).join("");
  return `<section class="blk"><h3>Verteilung der Hauptschwerpunkte <span class="sub">${pm==="ist"?"tatsächlich":"geplant"}</span></h3>
    <div class="piewrap"><svg class="pie" viewBox="0 0 180 180" role="img" aria-label="Kreisdiagramm Hauptschwerpunkte">${arcs}<text x="90" y="86" text-anchor="middle" class="pie-t">${Math.round(ges)}</text><text x="90" y="104" text-anchor="middle" class="ax">Minuten</text></svg>
    <ul class="leg">${ord.map(k=>`<li${tipAttr(`${k}: ${fmtMin(m[k])}`)}>${swatch(k)}<span>${esc(k)}</span><b>${pct(m[k],ges)} %</b><em>${fmtMin(m[k])}</em></li>`).join("")}</ul></div>
    <p class="legend">Nur der Hauptschwerpunkt zählt als Trainingszeit – zusammen ergibt das die gesamte Trainingszeit.${m[OHNE]?" Grau: Schritte ohne Hauptschwerpunkt – in der Übung oder im Trainingsschritt nachtragen.":""}</p></section>`;
}
/* Trainingszeit je Training, aufgeteilt nach Hauptschwerpunkt (gestapelte Balken). */
function zeitBlock(tr,pm){
  const rows=tr.map(([id,t])=>({id,t,m:sumHaupt(parts(t,pm))}));const all=rows.reduce((o,x)=>{Object.keys(x.m).forEach(k=>o[k]=1);return o;},{});const ord=hauptOrder(all).filter(k=>all[k]);
  const max=Math.max(...rows.map(x=>total(Object.entries(x.m).map(([,min])=>({min})))),1);const f=chartFrame(rows.length,max);
  const bars=rows.map((x,i)=>{const bx=f.L+i*f.bw+f.gap/2;let acc=0;const segs=ord.filter(k=>x.m[k]).map((k,j,arr)=>{const v=x.m[k],y0=f.y(acc+v),h=f.y(acc)-f.y(acc+v);acc+=v;
      const last=j===arr.length-1;return `<path d="${last?topRound(bx,y0,f.w,h,Math.min(4,f.w/2,h)):`M${bx} ${y0} h${f.w} v${h} h${-f.w} Z`}" fill="${hauptCol(k)}" class="segp"${tipAttr(`${fmtDate(x.t.datum)} – ${k}: ${fmtMin(v)}`)}/>`;}).join("");
    return `<g data-act="stOpen" data-id="${x.id}">${segs}</g>${i%f.every===0||i===rows.length-1?`<text x="${bx+f.w/2}" y="${f.H-8}" class="ax" text-anchor="middle">${dLabel(x.t.datum)}</text>`:""}`;}).join("");
  return `<section class="blk"><h3>Trainingszeit pro Training <span class="sub">Minuten, nach Hauptschwerpunkt</span></h3>
    <svg class="chart" viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="Trainingszeit je Training">${f.g}${bars}</svg>
    <ul class="leg inline">${ord.map(k=>`<li>${swatch(k)}<span>${esc(k)}</span></li>`).join("")}</ul></section>`;
}
/* Entwicklung: Anteile der Hauptschwerpunkte je Woche bzw. Monat (letzte 8 Wochen / 6 Monate). */
function vergleichBlock(pm){
  const art=S.ui.stVgl||"woche",h=new Date(),heute=today();const buckets=[];
  if(art==="woche"){const mon=dayShift(heute,-((h.getDay()+6)%7));for(let i=7;i>=0;i--){const v=dayShift(mon,-7*i);const d=new Date(v+"T12:00");const kw=isoWeek(d);buckets.push({von:v,bis:dayShift(v,6),lab:`KW ${kw}`});}}
  else for(let i=5;i>=0;i--){const d=new Date(h.getFullYear(),h.getMonth()-i,1);buckets.push({von:iso(d),bis:iso(new Date(d.getFullYear(),d.getMonth()+1,0)),lab:d.toLocaleDateString("de-DE",{month:"short",year:"2-digit"})});}
  const trs=ofTeam("trainings").map(([,t])=>t).filter(t=>t.datum&&(pm==="plan"||durchg(t)));const all={};
  buckets.forEach(b=>{b.m=sumHaupt(trs.filter(t=>t.datum>=b.von&&t.datum<=b.bis).flatMap(t=>parts(t,pm)));Object.keys(b.m).forEach(k=>all[k]=1);b.ges=Object.values(b.m).reduce((a,v)=>a+v,0);});
  const ord=hauptOrder(all).filter(k=>all[k]);
  return `<section class="blk"><h3>Entwicklung der Schwerpunkte</h3>${seg("stVgl",art,[["woche","Wochen"],["monat","Monate"]])}
    <div class="vgl">${buckets.map(b=>`<div class="vrow"><span class="hl">${esc(b.lab)}</span><span class="stack">${b.ges?ord.filter(k=>b.m[k]).map(k=>`<i style="width:${b.m[k]/b.ges*100}%;background:${hauptCol(k)}"${tipAttr(`${b.lab} – ${k}: ${fmtMin(b.m[k])} (${pct(b.m[k],b.ges)} %)`)}></i>`).join(""):'<em class="none">kein Training</em>'}</span><span class="hv">${b.ges?fmtMin(b.ges):""}</span></div>`).join("")}</div>
    ${ord.length?`<ul class="leg inline">${ord.map(k=>`<li>${swatch(k)}<span>${esc(k)}</span></li>`).join("")}</ul>`:""}
    <p class="legend">Balkenlänge = Anteil an der Trainingszeit der ${art==="woche"?"Woche":"des Monats"}; rechts die Gesamtminuten. Unabhängig vom oben gewählten Zeitraum.</p></section>`;
}
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y0)/864e5+1)/7);}
/* Nebenschwerpunkte (Zusatzinhalte) bzw. Kategorien: Häufigkeit und Minuten – überschneiden sich, keine Summe. */
function nebenBlock(tr,pm){
  const mode=S.ui.stInh==="kat"?"kat":"tags";const c={};
  tr.forEach(([,t])=>{const seen=new Set();parts(t,pm).forEach(p=>{const st=(t.ablauf||[])[p.i];const keys=mode==="tags"?p.neben:[(stepEx(st)||{}).kategorie||"Ohne Kategorie"];
    keys.forEach(k=>{c[k]=c[k]||{n:0,min:0};if(!seen.has(k)){c[k].n++;seen.add(k);}c[k].min+=p.min;});});});
  const order=mode==="tags"?S.settings.tags:katList();const rows=Object.entries(c).sort((a,b)=>(b[1].min-a[1].min)||(b[1].n-a[1].n));
  const nie=order.filter(k=>!c[k]);const max=Math.max(...rows.map(r=>r[1].min),1);
  return `<section class="blk"><h3>${mode==="tags"?"Nebenschwerpunkte (Zusatzinhalte)":"Kategorien (Organisationsform)"}</h3>${seg("stInh",mode,[["tags","Nebenschwerpunkte"],["kat","Kategorien"]])}
    <div class="hbars" style="margin-top:14px">${rows.map(([k,v])=>`<div class="hrow"${tipAttr(`${k}: in ${v.n} von ${tr.length} Trainings, zusammen etwa ${fmtMin(v.min)}`)}><span class="hl">${esc(k)}</span><span class="hb"><i style="width:${v.min/max*100}%"></i></span><span class="hv"><b>${fmtMin(v.min)}</b> ${v.n}×</span></div>`).join("")||'<p class="hint">Keine Daten für diese Auswahl.</p>'}</div>
    ${nie.length?`<p class="legend">Nicht vorgekommen: ${esc(nie.join(", "))}</p>`:""}
    <p class="legend">${mode==="tags"?"Zusatzinhalte überschneiden sich – ihre Minuten werden nicht zur Trainingszeit addiert.":"Die Kategorie beschreibt die Organisationsform; Minuten pro Spielerin."}</p></section>`;
}

/* ---------- Spielerinnen ---------- */
function spielerStats(tr,pid){
  let ja=0,nein=0,lim=0;const done=[],missed=[];
  tr.forEach(([id,t])=>{const s=(t.anwesenheit||{})[pid];if(s==="ja")ja++;else if(s==="nein")nein++;if(t.einschr&&t.einschr[pid])lim++;
    done.push(...playerParts(t,pid,"ist"));const mp=missedParts(t,pid,"ist");if(mp.length)missed.push({id,t,ps:mp,ganz:s!=="ja"});});
  return {ja,nein,lim,pc:pct(ja,tr.length),min:total(done),m:sumHaupt(done),missed};
}
function spielerBlock(tr){
  const n=tr.length;const sort=S.ui.stSort||"pct";const ges=tr.reduce((a,[,t])=>a+trainingMin(t,"ist"),0);
  const rows=players().map(p=>({p,...spielerStats(tr,p.id)})).filter(r=>r.ja||r.nein||!S.ui.stNurAktive)
    .sort((a,b)=>sort==="name"?a.p.name.localeCompare(b.p.name):sort==="min"?(b.min-a.min)||a.p.name.localeCompare(b.p.name):(b.pc-a.pc)||a.p.name.localeCompare(b.p.name));
  return `<section class="blk"><h3>Beteiligung pro Spielerin <span class="sub">${n} Training${n===1?"":"s"} · ${fmtMin(ges)} möglich</span></h3>
    <div class="row-actions" style="margin:0 0 12px"><button class="btn sm${sort==="pct"?" pri":""}" data-act="stSort" data-v="pct">Nach Quote</button><button class="btn sm${sort==="min"?" pri":""}" data-act="stSort" data-v="min">Nach Minuten</button><button class="btn sm${sort==="name"?" pri":""}" data-act="stSort" data-v="name">Nach Name</button>
      <button class="btn sm ghost" data-act="stAktive">${S.ui.stNurAktive?"Alle zeigen":"Nur mit Einträgen"}</button></div>
    <div class="hbars">${rows.map(r=>`<button type="button" class="hrow sel${S.ui.stP===r.p.id?" on":""}" data-act="stP" data-id="${r.p.id}"${tipAttr(`${r.p.name}: ${r.ja}× anwesend, ${r.nein}× abwesend, ${n-r.ja-r.nein}× nicht erfasst${r.lim?`, ${r.lim}× eingeschränkt`:""} · ${fmtMin(r.min)} absolviert`)}>
      <span class="hl">${esc(r.p.name)}${r.p.tw?' <span class="twm">TW</span>':""}</span><span class="hb"><i style="width:${r.pc}%"></i></span><span class="hv"><b>${r.pc} %</b> ${fmtMin(r.min)}</span></button>`).join("")}</div>
    <p class="legend">Balken = Anwesenheitsquote; rechts die absolvierten Minuten (bei „raus ab“ nur bis dahin). Antippen zeigt Details.</p></section>`;
}
function spielerDetail(tr){
  const p=pById(S.ui.stP);if(!p)return "";const st=spielerStats(tr,p.id);const ord=hauptOrder(st.m).filter(k=>st.m[k]);const max=Math.max(...ord.map(k=>st.m[k]),1);
  const missedM=sumHaupt(st.missed.flatMap(x=>x.ps));const mOrd=hauptOrder(missedM).filter(k=>missedM[k]);
  return `<section class="blk" id="stDetail"><h3>${esc(p.name)} <span class="sub">${st.ja} von ${tr.length} Trainings · ${fmtMin(st.min)} absolviert</span></h3>
    <p class="legend" style="margin-top:0">Minuten je Hauptschwerpunkt</p>
    <div class="hbars">${ord.map(k=>`<div class="hrow"${tipAttr(`${k}: ${fmtMin(st.m[k])}`)}><span class="hl">${swatch(k)}${esc(k)}</span><span class="hb"><i style="width:${st.m[k]/max*100}%;background:${hauptCol(k)}"></i></span><span class="hv"><b>${fmtMin(st.m[k])}</b></span></div>`).join("")||'<p class="hint">Noch keine absolvierten Minuten.</p>'}</div>
    <p class="legend" style="margin-top:16px">Verpasste Inhalte${mOrd.length?": "+mOrd.map(k=>`${esc(k)} ${fmtMin(missedM[k])}`).join(" · "):" – keine"}</p>
    ${st.missed.length?`<ul class="miss">${st.missed.map(x=>{const g=x.t.gruende&&x.t.gruende[p.id];return `<li><b>${esc(fmtDate(x.t.datum))}</b> ${x.ganz?`<span class="src">${(x.t.anwesenheit||{})[p.id]==="nein"?"abwesend":"nicht erfasst"}${g&&g.grund?" – "+esc(g.grund):""}</span>`:'<span class="src">ab hier raus</span>'}<div>${esc([...new Set(x.ps.map(q=>q.name))].join(", "))}</div></li>`;}).join("")}</ul>`:""}</section>`;
}
/* Zwei Spielerinnen vergleichen: Beteiligung und Minuten je Hauptschwerpunkt (A = Farbe 1, B = Farbe 2). */
function vergleichSpielerinnen(tr){
  const ps=players().slice().sort((a,b)=>a.name.localeCompare(b.name));const o=[["","– wählen –"],...ps.map(p=>[p.id,p.name])];
  const A=pById(S.ui.stCmpA),B=pById(S.ui.stCmpB);
  let body='<p class="hint">Wähle zwei Spielerinnen.</p>';
  if(A&&B){const a=spielerStats(tr,A.id),b=spielerStats(tr,B.id);const all=Object.assign({},a.m,b.m);const ord=hauptOrder(all).filter(k=>all[k]);const max=Math.max(...ord.map(k=>Math.max(a.m[k]||0,b.m[k]||0)),1);
    body=`<div class="asum two"><span><b>${a.pc} %</b>${esc(A.name)} · ${a.ja}/${tr.length} · ${fmtMin(a.min)}</span><span><b>${b.pc} %</b>${esc(B.name)} · ${b.ja}/${tr.length} · ${fmtMin(b.min)}</span></div>
      <ul class="leg inline" style="margin-top:12px"><li><i class="sw" style="background:var(--s1)"></i><span>${esc(A.name)}</span></li><li><i class="sw" style="background:var(--s2)"></i><span>${esc(B.name)}</span></li></ul>
      <div class="cmp">${ord.map(k=>`<div class="crow"><span class="hl">${esc(k)}</span><span class="cb"><span class="hb"${tipAttr(`${A.name} – ${k}: ${fmtMin(a.m[k]||0)}`)}><i style="width:${(a.m[k]||0)/max*100}%;background:var(--s1)"></i></span><span class="hb"${tipAttr(`${B.name} – ${k}: ${fmtMin(b.m[k]||0)}`)}><i style="width:${(b.m[k]||0)/max*100}%;background:var(--s2)"></i></span></span><span class="hv">${fmtMin(a.m[k]||0)}<br>${fmtMin(b.m[k]||0)}</span></div>`).join("")||'<p class="hint">Keine Minuten.</p>'}</div>`;}
  return `<section class="blk"><h3>Zwei Spielerinnen vergleichen</h3><div class="meta"><label class="f">Spielerin A<select data-key="cmpA" data-act="stCmp" data-f="stCmpA">${opt(o,S.ui.stCmpA||"")}</select></label><label class="f">Spielerin B<select data-key="cmpB" data-act="stCmp" data-f="stCmpB">${opt(o,S.ui.stCmpB||"")}</select></label></div>${body}</section>`;
}

/* ---------- Übungen ---------- */
function uebungBlock(){
  const pm=S.ui.stPlanU||"ist";const tr=statTrainings(pm);const c={};
  tr.forEach(([,t])=>{const seen=new Set();parts(t,pm).forEach(p=>{const k=p.name;c[k]=c[k]||{n:0,min:0,haupt:p.haupt,last:""};if(!seen.has(k)){c[k].n++;seen.add(k);}c[k].min+=p.min;c[k].haupt=p.haupt;if(t.datum>c[k].last)c[k].last=t.datum;});});
  const rows=Object.entries(c).sort((a,b)=>(b[1].min-a[1].min)||(b[1].n-a[1].n));const max=Math.max(...rows.map(r=>r[1].min),1);
  return `${seg("stPlanU",pm,[["ist","Durchgeführt"],["plan","Geplant"]])}<section class="blk"><h3>Übungen <span class="sub">${rows.length} verschiedene in ${tr.length} Training${tr.length===1?"":"s"}</span></h3>
    <div class="hbars">${rows.map(([k,v])=>`<div class="hrow"${tipAttr(`${k}: ${v.n}× · ${fmtMin(v.min)} · ${v.haupt} · zuletzt ${fmtDate(v.last)}`)}><span class="hl">${swatch(v.haupt)}${esc(k)}</span><span class="hb"><i style="width:${v.min/max*100}%;background:${hauptCol(v.haupt)}"></i></span><span class="hv"><b>${fmtMin(v.min)}</b> ${v.n}×</span></div>`).join("")||'<p class="hint">Keine Übungen in diesem Zeitraum.</p>'}</div>
    <p class="legend">Gezählt nach dem Namen im Trainingsschritt; Farbe = Hauptschwerpunkt. ${pm==="ist"?"Ausgefallene Schritte zählen nicht.":""}</p></section>`;
}

/* ---------- Tooltip und Bedienung ---------- */
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
  if(tipT&&a!=="stP"){showTip(tipT,e.clientX,e.clientY);}else tipEl.hidden=true;
  const set=(k,v)=>{S.ui[k]=v;render();};
  if(a==="stZ")set("stZ",el.dataset.v);if(a==="stTab")set("stTab",el.dataset.v);if(a==="stSort")set("stSort",el.dataset.v);
  if(a==="stAktive")set("stNurAktive",!S.ui.stNurAktive);if(a==="stInh")set("stInh",el.dataset.v);if(a==="stPlan")set("stPlan",el.dataset.v);
  if(a==="stPlanU")set("stPlanU",el.dataset.v);if(a==="stVgl")set("stVgl",el.dataset.v);
  if(a==="stP"){S.ui.stP=S.ui.stP===el.dataset.id?null:el.dataset.id;render();if(S.ui.stP)setTimeout(()=>$("#stDetail")?.scrollIntoView({block:"start",behavior:"smooth"}),0);}
});
$("#app").addEventListener("change",e=>{const el=e.target;if(el.dataset.act==="stDate"||el.dataset.act==="stCmp"){S.ui[el.dataset.f]=el.value;render();}});
window.addEventListener("scroll",()=>{tipEl.hidden=true;},{passive:true});
