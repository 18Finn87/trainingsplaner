"use strict";
/* ---------- Langfristige Planung (je Mannschaft) ----------
   planung = {perioden:[{id,name,von,bis,ziele:[{id,text,art:"haupt"|"neben"}],soll:{Hauptschwerpunkt:Prozent}}],
              wochen:[{id,von (Montag),text,haupt,neben}]}
   Trainings gehören über ihr Datum zur Periode. Soll/Ist rechnet wie die Statistik: nur der Hauptschwerpunkt zählt. */
function planung(){const t=S.team||"team1";if(!S.planungen[t])S.planungen[t]={perioden:[],wochen:[]};const p=S.planungen[t];p.perioden=p.perioden||[];p.wochen=p.wochen||[];return p;}
const montag=d=>{const x=new Date((d||today())+"T12:00");x.setDate(x.getDate()-((x.getDay()+6)%7));return iso(x);};
const kurzDatum=d=>d?`${+d.slice(8,10)}.${+d.slice(5,7)}.`:"";
function periodeFor(datum){if(!datum)return null;return planung().perioden.filter(p=>p.von&&p.bis&&datum>=p.von&&datum<=p.bis).sort((a,b)=>b.von.localeCompare(a.von))[0]||null;}
const wochenFor=datum=>datum?planung().wochen.filter(w=>w.von===montag(datum)):[];
/* Soll/Ist je Hauptschwerpunkt: geplant = alle Trainings der Periode, tatsächlich = durchgeführte. */
function sollIst(p){
  const trs=ofTeam("trainings").map(([,t])=>t).filter(t=>t.datum&&p.von&&p.bis&&t.datum>=p.von&&t.datum<=p.bis);
  const done=trs.filter(t=>t.durchgefuehrt);const ist=sumHaupt(done.flatMap(t=>parts(t,"ist"))),plan=sumHaupt(trs.flatMap(t=>parts(t,"plan")));
  const sum=o=>Object.values(o).reduce((a,v)=>a+v,0);const gI=sum(ist),gP=sum(plan);const soll=p.soll||{};
  const keys=hauptOrder(Object.assign({},ist,plan,Object.fromEntries(Object.entries(soll).filter(([,v])=>num(v)>0)))).filter(k=>num(soll[k])>0||ist[k]||plan[k]);
  const rows=keys.map(k=>{const s=num(soll[k]),pI=gI?ist[k]/gI*100||0:0,pP=gP?plan[k]/gP*100||0:0;
    return {k,soll:s,pIst:Math.round(pI),pPlan:Math.round(pP),minIst:Math.round(ist[k]||0),minPlan:Math.round(plan[k]||0),warn:s>0&&gI>0&&pI<s*0.75};});
  return {rows,gI:Math.round(gI),gP:Math.round(gP),nDone:done.length,nAll:trs.length};
}
const zielListe=(p,art)=>(p.ziele||[]).filter(z=>z.art===art&&z.text);

/* ---------- Ansicht ---------- */
function vPlanung(){
  const tab=S.ui.plTab||"perioden";
  const sw=`<div class="seg" style="grid-template-columns:1fr 1fr;margin-bottom:14px" role="radiogroup"><button type="button" role="radio" aria-checked="${tab==="perioden"}" data-act="plTab" data-v="perioden">Perioden</button><button type="button" role="radio" aria-checked="${tab==="wochen"}" data-act="plTab" data-v="wochen">Wochenschwerpunkte</button></div>`;
  return tab==="wochen"?`<div class="narrow"><h2 class="page-h">Planung</h2>${sw}${wochenView()}</div>`:periodenView(sw);
}
function periodenView(sw){
  const pl=planung();const heute=today();const cur=S.sel.periode&&pl.perioden.find(p=>p.id===S.sel.periode)?S.sel.periode:null;
  const li=pl.perioden.slice().sort((a,b)=>(b.von||"").localeCompare(a.von||"")).map(p=>{const akt=p.von&&p.bis&&heute>=p.von&&heute<=p.bis;
    return `<button class="li" data-act="plSel" data-id="${p.id}" aria-current="${p.id===cur}"><b>${akt?'<span class="fav">●</span> ':""}${esc(p.name||"Ohne Namen")}</b><span>${esc(kurzDatum(p.von))}–${esc(kurzDatum(p.bis))}${p.bis?" "+p.bis.slice(0,4):""} · ${zielListe(p,"haupt").length} Hauptziel${zielListe(p,"haupt").length===1?"":"e"}${akt?" · aktuell":""}</span></button>`;}).join("");
  return `<div class="split${cur?" has-sel":""}"><aside class="list"><h2>Planung</h2>${sw}<button class="btn pri new" data-act="plNew">Neue Periode</button>
    ${li||'<p class="hint">Noch keine Perioden. Leg z. B. „Vorbereitung Rückrunde“ mit Start- und Enddatum an.</p>'}<p class="legend">Gilt für „${esc(teamName())}“.</p></aside>
    <div class="editor">${cur?periodeEditor(pl.perioden.find(p=>p.id===cur)):`<div class="empty"><h3>Langfristig planen</h3><p>Lege Trainingsperioden mit Zielen und Soll-Anteilen je Hauptschwerpunkt an. Trainings werden über ihr Datum automatisch zugeordnet, und du siehst, ob der Plan aufgeht.</p><button class="btn pri" data-act="plNew">Neue Periode</button></div>`}</div></div>`;
}
function periodeEditor(p){
  const sp=S.settings.schwerpunkte||[];const si=p.von&&p.bis&&p.von<=p.bis?sollIst(p):null;const sollSum=Object.values(p.soll||{}).reduce((a,v)=>a+num(v),0);
  const ueber=planung().perioden.filter(x=>x!==p&&x.von&&x.bis&&p.von&&p.bis&&x.von<=p.bis&&p.von<=x.bis);
  return `<div class="ed-top"><button class="btn ghost back" data-act="plBack">← Perioden</button></div>
  <div class="ed-top"><input class="title-in" data-key="pl-name" data-act="plF" data-f="name" value="${esc(p.name||"")}" placeholder="Name, z. B. Vorbereitung Rückrunde"></div>
  <div class="meta"><label class="f">Start<input type="date" data-key="pl-von" data-act="plF" data-f="von" value="${esc(p.von||"")}"></label><label class="f">Ende<input type="date" data-key="pl-bis" data-act="plF" data-f="bis" value="${esc(p.bis||"")}"></label></div>
  ${p.von&&p.bis&&p.von>p.bis?'<div class="warn">Das Ende liegt vor dem Start.</div>':""}${ueber.length?`<div class="warn">Überschneidet sich mit: ${esc(ueber.map(x=>x.name||"ohne Namen").join(", "))}. Trainings zählen zur später beginnenden Periode.</div>`:""}
  <section class="blk"><h3>Ziele</h3>
   ${(p.ziele||[]).map((z,i)=>`<div class="ziel"><button type="button" class="chip tag zart" data-act="plZArt" data-i="${i}" aria-pressed="${z.art==="haupt"}">${z.art==="haupt"?"Hauptziel":"Nebenziel"}</button>
     <input class="inp" data-key="z-${z.id}" data-act="plZText" data-i="${i}" value="${esc(z.text||"")}" placeholder="Ziel beschreiben"><button class="iconbtn" data-act="plZDel" data-i="${i}" aria-label="Ziel entfernen">✕</button></div>`).join("")||'<p class="hint">Noch keine Ziele.</p>'}
   <div class="row-actions"><button class="btn sm" data-act="plZAdd" data-v="haupt">+ Hauptziel</button><button class="btn sm" data-act="plZAdd" data-v="neben">+ Nebenziel</button></div>
   <p class="legend">Tipp auf „Hauptziel/Nebenziel“ wechselt die Art.</p></section>
  <section class="blk"><h3>Soll-Anteile <span class="sub">${sollSum?`zusammen ${sollSum} %`:"optional"}</span></h3><p class="hint">Wie viel Trainingszeit soll auf welchen Hauptschwerpunkt entfallen? Leer = keine Vorgabe.</p>
   <div class="matgrid">${sp.map(k=>`<label class="f"><span class="lrow">${swatch(k)}${esc(k)}</span><input type="number" min="0" max="100" data-key="so-${esc(k)}" data-act="plSoll" data-k="${esc(k)}" value="${esc(p.soll&&p.soll[k]||"")}" placeholder="%"></label>`).join("")}</div>
   ${sollSum>100?'<div class="warn">Die Soll-Anteile ergeben mehr als 100 %.</div>':""}</section>
  ${si?sollIstBlock(si):'<section class="blk"><h3>Soll/Ist</h3><p class="hint">Start und Ende eintragen, dann erscheint der Vergleich.</p></section>'}
  <div class="row-actions"><button class="btn" data-act="plDup">Duplizieren</button><button class="btn ghost danger" data-act="plDel">Periode löschen</button></div>`;
}
function sollIstBlock(si){
  const vern=si.rows.filter(r=>r.warn);
  return `<section class="blk"><h3>Soll/Ist <span class="sub">${si.nDone} von ${si.nAll} Trainings durchgeführt · ${fmtMin(si.gI)} tatsächlich, ${fmtMin(si.gP)} geplant</span></h3>
   ${vern.length?`<div class="warn">Vernachlässigt: ${esc(vern.map(r=>`${r.k} (Soll ${r.soll} %, ist ${r.pIst} %)`).join(", "))}</div>`:""}
   <div class="si">${si.rows.map(r=>`<div class="sirow${r.warn?" warnrow":""}"${tipAttr(`${r.k}: Soll ${r.soll||"–"} % · geplant ${r.pPlan} % (${fmtMin(r.minPlan)}) · tatsächlich ${r.pIst} % (${fmtMin(r.minIst)})`)}>
     <span class="hl">${swatch(r.k)}${esc(r.k)}</span>
     <span class="sibar"><span class="hb"><i style="width:${r.pIst}%;background:${hauptCol(r.k)}"></i></span>${r.soll?`<b class="soll" style="left:${Math.min(100,r.soll)}%" title="Soll"></b>`:""}</span>
     <span class="hv"><b>${r.pIst} %</b> ${r.soll?`Soll ${r.soll} %`:""}<br><small>geplant ${r.pPlan} %</small></span></div>`).join("")||'<p class="hint">Noch keine Trainings in dieser Periode.</p>'}</div>
   <p class="legend">Balken = tatsächlicher Anteil an der Trainingszeit, Strich = Soll. „Vernachlässigt“, wenn tatsächlich weniger als drei Viertel des Solls trainiert wurde.</p></section>`;
}
function wochenView(){
  const pl=planung();const sp=S.settings.schwerpunkte||[];const heuteMo=montag();
  const list=pl.wochen.slice().sort((a,b)=>b.von.localeCompare(a.von)||(a.text||"").localeCompare(b.text||""));let last=null,html="";
  list.forEach(w=>{if(w.von!==last){const bis=dayShift(w.von,6);html+=`<div class="grouphead">${w.von===heuteMo?"Diese Woche":w.von>heuteMo?"Kommende Woche":"Woche"} · ${kurzDatum(w.von)}–${kurzDatum(bis)}</div>`;last=w.von;}
    const i=pl.wochen.indexOf(w);html+=`<div class="wrow"><div><b>${esc(w.text)}</b><span class="src">${[w.haupt,w.neben].filter(Boolean).map(esc).join(" · ")}${w.quelle?` · aus ${esc(w.quelle)}`:""}</span></div><button class="iconbtn" data-act="plWDel" data-i="${i}" aria-label="Entfernen">✕</button></div>`;});
  return `<section class="blk"><h3>Kurzfristige Schwerpunkte</h3><p class="hint">Gilt für eine Woche, z. B. nach einer Spielanalyse. Die Periodenziele bleiben unverändert. Im Training siehst du sie oben im Planungskasten.</p>
    <div class="meta"><label class="f">Woche (beliebiger Tag)<input type="date" id="wVon" value="${esc(S.ui.wVon||today())}"></label>
     <label class="f">Hauptschwerpunkt (optional)<select id="wHaupt">${opt([["","–"],...sp.map(x=>[x,x])],"")}</select></label>
     <label class="f">Nebenschwerpunkt (optional)<select id="wNeben">${opt([["","–"],...S.settings.tags.map(x=>[x,x])],"")}</select></label></div>
    <div class="addpt" style="margin-top:8px"><input class="inp" id="wText" placeholder="z. B. Zweikampfverhalten an der Mittellinie"><button class="btn pri" data-act="plWAdd">Hinzufügen</button></div></section>
   <section class="blk"><h3>Übersicht <span class="sub">${pl.wochen.length}</span></h3>${html||'<p class="hint">Noch keine Wochenschwerpunkte.</p>'}</section>`;
}
/* Kasten oben im Training: Periode, Ziele, Soll/Ist, Wochenschwerpunkte. */
function planKasten(t){
  const p=periodeFor(t.datum),wo=wochenFor(t.datum);
  if(!p&&!wo.length)return planung().perioden.length?`<div class="plbox leer"><span>Keine Periode für dieses Datum.</span><button class="btn sm ghost" data-act="plGo">Zur Planung</button></div>`:"";
  let soll="";if(p&&p.soll&&Object.values(p.soll).some(v=>num(v)>0)){const si=sollIst(p);soll=si.rows.filter(r=>r.soll).map(r=>`<span class="${r.warn?"over":""}">${esc(r.k)} ${r.soll} % <small>(ist ${r.pIst} %)</small></span>`).join(" · ");}
  return `<div class="plbox">${p?`<div class="plk"><b>${esc(p.name||"Periode")}</b> <span class="src">bis ${esc(kurzDatum(p.bis))}</span>
      ${zielListe(p,"haupt").length?`<div><small>Hauptziele:</small> ${zielListe(p,"haupt").map(z=>esc(z.text)).join(" · ")}</div>`:""}
      ${zielListe(p,"neben").length?`<div class="src"><small>Nebenziele:</small> ${zielListe(p,"neben").map(z=>esc(z.text)).join(" · ")}</div>`:""}
      ${soll?`<div><small>Soll:</small> ${soll}</div>`:""}</div>`:""}
    ${wo.length?`<div class="plk"><small>Diese Woche:</small> ${wo.map(w=>`<b>${esc(w.text)}</b>${w.haupt||w.neben?` <span class="src">(${esc([w.haupt,w.neben].filter(Boolean).join(", "))})</span>`:""}`).join(" · ")}</div>`:""}</div>`;
}

/* ---------- Bedienung ---------- */
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  if(a==="plGo"){S.view="planung";render();window.scrollTo(0,0);return;}
  if(S.view!=="planung")return;const pl=planung();const save=()=>{saveLater("planung");render();};
  if(a==="plTab"){S.ui.plTab=el.dataset.v;render();return;}
  if(a==="plSel"){S.sel.periode=el.dataset.id;render();window.scrollTo(0,0);return;}
  if(a==="plBack"){S.sel.periode=null;render();return;}
  if(a==="plNew"){const last=pl.perioden.slice().sort((a,b)=>(b.bis||"").localeCompare(a.bis||""))[0];const von=last&&last.bis?dayShift(last.bis,1):today();
    const p={id:"p"+uid(),name:"",von,bis:dayShift(von,41),ziele:[],soll:{}};pl.perioden.push(p);S.sel.periode=p.id;save();setTimeout(()=>$('[data-key="pl-name"]')?.focus(),0);return;}
  if(a==="plWAdd"){const text=$("#wText").value.trim();if(!text){toast("Bitte einen Schwerpunkt eintragen.");return;}const d=$("#wVon").value||today();S.ui.wVon=d;
    pl.wochen.push({id:"w"+uid(),von:montag(d),text,haupt:$("#wHaupt").value,neben:$("#wNeben").value});save();toast("Wochenschwerpunkt hinzugefügt");return;}
  if(a==="plWDel"){pl.wochen.splice(+el.dataset.i,1);save();return;}
  const p=pl.perioden.find(x=>x.id===S.sel.periode);if(!p)return;const i=+el.dataset.i;p.ziele=p.ziele||[];
  if(a==="plZAdd"){p.ziele.push({id:"z"+uid(),text:"",art:el.dataset.v});save();setTimeout(()=>{const ins=document.querySelectorAll('[data-act="plZText"]');ins[ins.length-1]?.focus();},0);}
  if(a==="plZArt"){p.ziele[i].art=p.ziele[i].art==="haupt"?"neben":"haupt";save();}
  if(a==="plZDel"){p.ziele.splice(i,1);save();}
  if(a==="plDup"){const c=clone(p);c.id="p"+uid();c.name=(p.name||"Periode")+" (Kopie)";c.ziele.forEach(z=>z.id="z"+uid());pl.perioden.push(c);S.sel.periode=c.id;save();toast("Kopie angelegt");}
  if(a==="plDel"){if(!confirmDel(`Periode „${p.name||"ohne Namen"}“ löschen? Die Trainings bleiben erhalten.`))return;pl.perioden=pl.perioden.filter(x=>x!==p);S.sel.periode=null;save();}
});
$("#app").addEventListener("change",e=>{const el=e.target,a=el.dataset.act;if(S.view!=="planung")return;const p=planung().perioden.find(x=>x.id===S.sel.periode);if(!p)return;
  if(a==="plF"){p[el.dataset.f]=el.value.trim();saveLater("planung");render();}
  if(a==="plZText"){const z=p.ziele[+el.dataset.i];if(z){z.text=el.value.trim();saveLater("planung");}}
  if(a==="plSoll"){p.soll=p.soll||{};const v=el.value===""?0:Math.max(0,Math.min(100,num(el.value)));if(v)p.soll[el.dataset.k]=v;else delete p.soll[el.dataset.k];saveLater("planung");render();}
});
