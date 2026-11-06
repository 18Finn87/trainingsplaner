"use strict";
/* ---------- Mannschaft – Ansicht der Spielerinnen (Phase 9) ----------
   Reiter Termine (Zu-/Absage, wer kommt, Aufstellung, Fahrgemeinschaften), Neues (Mitteilungen, Umfragen),
   Mehr (Feedback, Dienste, Abwesenheiten, Kasse, Kalender, Benachrichtigungen).
   Gelesen/geschrieben wird nur, was der Zugriffsschutz in Supabase der Spielerin erlaubt (supabase-phase9.sql). */
const SPT={t:0,loading:false,err:"",termine:[],zus:{},teiln:{},abw:[],mitt:[],gel:new Set(),umf:[],meineUmf:{},umfErg:{},dienste:[],namen:{},fahrten:[],buch:[],kat:[]};
const ich=()=>(SB.state.spielerin||{}).id;
const spTeam=()=>SB.state.team;

async function sptLaden(force){
  if(SPT.loading||!SB.istSpielerin())return;if(!force&&Date.now()-SPT.t<30000)return;SPT.loading=true;
  const ab=new Date(Date.now()-6*3600e3).toISOString(),heute=today();
  try{
    const [termine,zus,abw,mitt,gel,umf,meine,dienste,namen,buch,kat]=await Promise.all([
      SB.api(`/rest/v1/termine?beginn=gte.${encodeURIComponent(ab)}&order=beginn.asc&limit=40`),
      SB.api("/rest/v1/zusagen?select=*"),
      SB.api(`/rest/v1/abwesenheiten?bis=gte.${heute}&order=von.asc`),
      SB.api("/rest/v1/mitteilungen?order=erstellt_am.desc&limit=30"),
      SB.api("/rest/v1/mitteilung_gelesen?select=mitteilung_id"),
      SB.api("/rest/v1/umfragen?order=erstellt_am.desc&limit=20"),
      SB.api("/rest/v1/rpc/meine_umfragen",{method:"POST",body:"{}"}),
      SB.api(`/rest/v1/dienste?datum=gte.${dayShift(heute,-3)}&order=datum.asc`),
      SB.api("/rest/v1/rpc/team_namen",{method:"POST",body:"{}"}),
      SB.api("/rest/v1/kasse_buchungen?order=datum.desc"),
      SB.api("/rest/v1/kasse_katalog?order=titel.asc")]);
    SPT.termine=termine||[];SPT.zus=Object.fromEntries((zus||[]).map(z=>[z.termin_id,z]));SPT.abw=abw||[];SPT.mitt=mitt||[];
    SPT.gel=new Set((gel||[]).map(g=>g.mitteilung_id));SPT.umf=umf||[];SPT.meineUmf=Object.fromEntries((meine||[]).map(m=>[m.umfrage_id,m]));
    SPT.dienste=dienste||[];SPT.namen=Object.fromEntries((namen||[]).map(n=>[n.spielerin_id,n.name]));SPT.buch=buch||[];SPT.kat=kat||[];
    const ids=SPT.termine.map(t=>t.id);SPT.fahrten=ids.length?await SB.api(`/rest/v1/fahrten?termin_id=in.(${ids.join(",")})&select=*,mitfahrten(spielerin_id,name)&order=erstellt_am.asc`)||[]:[];
    SPT.t=Date.now();SPT.err="";
  }catch(e){SPT.err=navigator.onLine?(e.message||"Laden fehlgeschlagen"):"Offline – zum Ansehen brauchst du Internet.";}
  finally{SPT.loading=false;render();}
}
const sptNach=()=>{if(!SPT.loading&&Date.now()-SPT.t>=30000)setTimeout(()=>sptLaden(),0);};
async function sptAktion(fn,ok){try{await fn();if(ok)toast(ok);await sptLaden(true);return true;}catch(e){toast(e.message||"Fehler");return false;}}
const offenUmfrage=u=>!u.geschlossen&&!(u.ende&&Date.parse(u.ende)<Date.now());
function spNeuAnzahl(){sptNach();return SPT.mitt.filter(m=>!SPT.gel.has(m.id)).length+SPT.umf.filter(u=>offenUmfrage(u)&&!(SPT.meineUmf[u.id]||{}).teilgenommen).length;}

function spTabInhalt(tab){
  sptNach();
  if(SPT.err)return `<div class="warn">${esc(SPT.err)}</div><div class="row-actions"><button class="btn" data-act="sptReload">Erneut versuchen</button></div>`;
  if(!SPT.t)return '<p class="hint">Wird geladen …</p>';
  return tab==="neues"?sptNeues():tab==="mehr"?sptMehr():sptTermine();
}

/* ---------- Termine ---------- */
function sptTermine(){
  if(!SPT.termine.length)return '<div class="empty" style="margin-top:12px"><h3>Keine Termine</h3><p>Sobald dein Trainerteam Trainings oder Spiele einträgt, kannst du hier zu- oder absagen.</p></div>';
  const offen=SPT.termine.filter(t=>!t.abgesagt&&!SPT.zus[t.id]&&Date.now()<=Date.parse(t.frist||t.beginn)).length;
  return `${offen?`<p class="hint"><b>${offen} Termin${offen>1?"e":""} ohne Antwort.</b> Bitte sag zu oder ab.</p>`:'<p class="hint">Danke – du hast auf alle Termine geantwortet.</p>'}
    <div class="row-actions" style="margin-top:0"><button class="btn sm" data-act="sptReload">Aktualisieren</button></div>
    <div class="fglist">${SPT.termine.map(sptTerminKarte).join("")}</div>`;
}
function sptTerminKarte(tm){
  const z=SPT.zus[tm.id];const darf=!tm.abgesagt&&Date.now()<=Date.parse(tm.frist||tm.beginn);const absForm=S.ui.spAbs===tm.id;
  const fahrten=SPT.fahrten.filter(f=>f.termin_id===tm.id);const open=k=>S.ui.open[k+tm.id];
  const knopf=(st,txt)=>`<button type="button" class="btn zbtn z-${st}${z&&z.status===st?" an":""}" data-act="sptZ" data-id="${tm.id}" data-v="${st}"${darf?"":" disabled"} aria-pressed="${!!(z&&z.status===st)}">${txt}</button>`;
  const tn=SPT.teiln[tm.id];
  return `<div class="fgi spterm${tm.abgesagt?" weg":""}${z?"":" ohne"}"><div class="spkopf"><b>${esc(tm.titel||ARTTXT[tm.art])}</b>${tm.abgesagt?' <span class="bd warnbd">abgesagt</span>':""}
     <span class="src">${esc(terminZeit(tm))}${tm.treffen?` · Treffen ${esc(tm.treffen)}`:""}</span>
     ${tm.ort?`<span class="src">📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tm.ort)}" target="_blank" rel="noopener noreferrer">${esc(tm.ort)}</a></span>`:""}</div>
    ${tm.hinweis?`<p class="fgtext" style="margin:6px 0">${esc(tm.hinweis)}</p>`:""}
    ${tm.abgesagt?'<div class="notice" style="margin:6px 0 0">Dieser Termin fällt aus.</div>':`<div class="zbtns">${knopf("ja","✓ Zusage")}${knopf("nein","✗ Absage")}${knopf("vielleicht","? Vielleicht")}</div>
    ${z&&z.auto?`<p class="legend">Automatisch abgesagt wegen deiner Abwesenheit (${esc(z.grund)}). Du kannst trotzdem zusagen.</p>`:z&&z.status!=="ja"&&(z.grund||z.kommentar)?`<p class="legend">${esc([z.grund,z.kommentar].filter(Boolean).join(" – "))}</p>`:""}
    ${absForm?`<div class="absform"><p class="legend" style="margin:6px 0">Grund (nur dein Trainerteam sieht ihn)</p><div class="chips">${GRUENDE_SP.map(g=>`<button type="button" class="chip tag" data-act="sptGrund" data-v="${esc(g)}" aria-pressed="${(S.ui.spGrund||"")===g}">${esc(g)}</button>`).join("")}</div>
      <input class="inp" id="sptKom" placeholder="Kommentar (optional)" style="margin-top:8px;width:100%"><div class="row-actions"><button class="btn pri" data-act="sptAbsSenden" data-id="${tm.id}">Absage senden</button><button class="btn ghost" data-act="sptAbsZu">Abbrechen</button></div></div>`:""}
    <p class="legend">${darf?(tm.frist?`Antworten bis ${esc(fmtStamp(Date.parse(tm.frist)))}`:"Antworten bis zum Beginn"):"Antworten nicht mehr möglich – bei Änderungen bitte direkt Bescheid geben."}</p>`}
    <div class="row-actions spmehr"><button class="btn sm ghost" data-act="sptWer" data-id="${tm.id}" aria-expanded="${!!open("w")}">Wer kommt?</button>
      ${tm.aufstellung?`<button class="btn sm ghost" data-act="sptAuf" data-id="${tm.id}" aria-expanded="${!!open("a")}">Aufstellung</button>`:""}
      <button class="btn sm ghost" data-act="sptFahrt" data-id="${tm.id}" aria-expanded="${!!open("f")}">Fahrgemeinschaften${fahrten.length?` (${fahrten.length})`:""}</button></div>
    ${open("w")?(tn?["ja","vielleicht","nein"].map(st=>{const l=tn.filter(x=>x.status===st);return l.length?`<p class="legend" style="margin:6px 0 2px">${ZTXT[st]} (${l.length})</p><p style="margin:0">${l.map(x=>esc(x.name||"?")).join(", ")}</p>`:"";}).join("")||'<p class="hint">Noch keine Antworten.</p>':'<p class="hint">Wird geladen …</p>'):""}
    ${open("a")&&tm.aufstellung?`<div style="margin-top:8px">${aufstellungAnzeige(tm.aufstellung)}</div>`:""}
    ${open("f")?sptFahrten(tm,fahrten):""}</div>`;
}
function sptFahrten(tm,fahrten){
  const me=ich();
  return `<div class="fahrten">${fahrten.map(f=>{const mit=f.mitfahrten||[];const frei=f.plaetze-mit.length;const bin=mit.some(m=>m.spielerin_id===me);const meine=f.spielerin_id===me;
    return `<div class="fahrt"><b>🚗 ${esc(f.name||"?")}</b> <span class="src">${frei>0?`${frei} Platz${frei>1?"e":""} frei`:"voll"}${f.abfahrt?` · Abfahrt ${esc(f.abfahrt)}`:""}${f.treffpunkt?` · ${esc(f.treffpunkt)}`:""}</span>
      ${f.notiz?`<div class="src">${esc(f.notiz)}</div>`:""}${mit.length?`<div class="src">Mit dabei: ${mit.map(m=>esc(m.name)).join(", ")}</div>`:""}
      <div class="row-actions" style="margin-top:6px">${meine?`<button class="btn sm ghost danger" data-act="sptFahrtDel" data-id="${f.id}">Fahrt löschen</button>`:bin?`<button class="btn sm" data-act="sptAus" data-id="${f.id}">Doch nicht mitfahren</button>`:frei>0?`<button class="btn sm pri" data-act="sptMit" data-id="${f.id}">Mitfahren</button>`:""}</div></div>`;}).join("")||'<p class="hint">Noch keine Fahrt angeboten.</p>'}
    ${fahrten.some(f=>f.spielerin_id===me)?"":`<details class="fold"><summary>Ich fahre und habe Plätze frei</summary>
      <div class="meta"><label class="f">Freie Plätze<select id="fPl-${tm.id}">${opt([1,2,3,4,5,6].map(n=>[String(n),String(n)]),"3")}</select></label><label class="f">Abfahrt<input class="inp" id="fAb-${tm.id}" placeholder="z. B. 13:15"></label></div>
      <label class="f">Treffpunkt<input class="inp" id="fTr-${tm.id}" placeholder="z. B. Parkplatz Sportplatz"></label>
      <div class="row-actions"><button class="btn pri" data-act="sptAnbieten" data-id="${tm.id}">Fahrt anbieten</button></div></details>`}</div>`;
}

/* ---------- Neues: Mitteilungen + Umfragen ---------- */
let gelesenGesendet=new Set();
function sptNeues(){
  const neuMitt=SPT.mitt.filter(m=>!SPT.gel.has(m.id)&&!gelesenGesendet.has(m.id));
  if(neuMitt.length){neuMitt.forEach(m=>gelesenGesendet.add(m.id));setTimeout(async()=>{try{await SB.api("/rest/v1/mitteilung_gelesen",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates"},body:JSON.stringify(neuMitt.map(m=>({mitteilung_id:m.id,team:spTeam(),spielerin_id:ich()})))});neuMitt.forEach(m=>SPT.gel.add(m.id));}catch(e){}},1500);}
  const mitt=SPT.mitt.map(m=>`<div class="fgi spmitt${SPT.gel.has(m.id)?"":" neu"}${m.wichtig?" wichtig":""}"><div class="spkopf"><b>${esc(m.titel)}</b>${m.wichtig?' <span class="bd warnbd">wichtig</span>':""}${SPT.gel.has(m.id)?"":' <span class="bd">neu</span>'}<span class="src">${esc(fmtStamp(Date.parse(m.erstellt_am)))}</span></div>${m.text?`<p class="fgtext" style="margin:6px 0 0">${esc(m.text)}</p>`:""}</div>`).join("");
  const umf=SPT.umf.map(u=>{const mine=SPT.meineUmf[u.id]||{teilgenommen:false,optionen:[]};const offen=offenUmfrage(u);const erg=SPT.umfErg[u.id];const aendern=S.ui.ufAendern===u.id;
    const zeigeWahl=offen&&(!mine.teilgenommen||(aendern&&!u.anonym));
    if((mine.teilgenommen||!offen)&&!erg&&!zeigeWahl)setTimeout(()=>sptErgebnis(u.id),0);
    const max=erg?Math.max(1,...erg.map(e=>e.anzahl)):1;
    return `<div class="fgi spumf"><div class="spkopf"><b>${esc(u.frage)}</b>${offen?"":' <span class="bd">beendet</span>'}${u.anonym?' <span class="bd">anonym</span>':""}<span class="src">${u.mehrfach?"Mehrere Antworten möglich":"Eine Antwort"}${u.ende?` · bis ${esc(fmtStamp(Date.parse(u.ende)))}`:""}</span></div>
      ${zeigeWahl?`<div class="ufwahl">${(u.optionen||[]).map((o,i)=>`<label class="fgcb"><input type="${u.mehrfach?"checkbox":"radio"}" name="uf-${u.id}" value="${i}"${(mine.optionen||[]).includes(i)?" checked":""}> ${esc(o)}</label>`).join("")}</div>
        ${u.anonym?'<p class="legend">Anonym: Niemand sieht, was du gewählt hast – auch dein Trainerteam nicht. Du kannst nur einmal abstimmen.</p>':""}
        <div class="row-actions"><button class="btn pri" data-act="sptAbst" data-id="${u.id}">Abstimmen</button></div>`
      :`${erg?`<div class="hbars">${(u.optionen||[]).map((o,i)=>{const e=erg.find(x=>x.option===i)||{anzahl:0};return `<div class="hrow"><span class="hl">${(mine.optionen||[]).includes(i)?"✓ ":""}${esc(o)}</span><span class="hb"><i style="width:${e.anzahl/max*100}%"></i></span><span class="hv"><b>${e.anzahl}</b></span></div>`;}).join("")}</div>`:'<p class="hint">Ergebnis wird geladen …</p>'}
        ${offen&&!u.anonym?`<div class="row-actions"><button class="btn sm ghost" data-act="sptUfAendern" data-id="${u.id}">Stimme ändern</button></div>`:""}`}</div>`;}).join("");
  return `<section class="blk"><h3>Mitteilungen</h3>${mitt?`<div class="fglist">${mitt}</div>`:'<p class="hint">Keine Mitteilungen.</p>'}</section>
    <section class="blk"><h3>Umfragen</h3>${umf?`<div class="fglist">${umf}</div>`:'<p class="hint">Keine Umfragen.</p>'}</section>`;
}
async function sptErgebnis(id){if(SPT.umfErg[id])return;SPT.umfErg[id]=[];try{SPT.umfErg[id]=await SB.api("/rest/v1/rpc/umfrage_ergebnis",{method:"POST",body:JSON.stringify({p_umfrage:id})})||[];}catch(e){}render();}

/* ---------- Mehr ---------- */
function sptMehr(){
  const me=ich();const meine=SPT.dienste.filter(d=>d.spielerin_id===me),offene=SPT.dienste.filter(d=>!d.spielerin_id&&d.datum>=today());
  const saldo=SPT.buch.reduce((a,b)=>a+Number(b.betrag),0);
  return `<section class="blk"><h3>Feedback</h3><p class="hint" style="margin-top:0">Lob, Kritik, Ideen – mit Namen oder anonym.</p><div class="row-actions" style="margin-top:0">${fbSpielerinKnopf()}</div>${S.ui.fbOffen?fbForm():""}</section>
   <section class="blk"><h3>Meine Dienste</h3>${meine.length?`<ul class="hist">${meine.map(d=>`<li><span><b>${esc(kurzTag(d.datum))}</b> ${esc(d.titel)}</span><span>${d.erledigt?'<span class="ok">✓ erledigt</span>':""}</span>
      <span class="ctl"><button class="btn sm${d.erledigt?"":" pri"}" data-act="sptDienst" data-v="erledigt" data-id="${d.id}">${d.erledigt?"Doch nicht erledigt":"Erledigt"}</button>${d.erledigt?"":`<button class="btn sm ghost" data-act="sptDienst" data-v="abgeben" data-id="${d.id}">Abgeben</button>`}</span></li>`).join("")}</ul>`:'<p class="hint">Du hast gerade keine Dienste.</p>'}
     ${offene.length?`<p class="legend" style="margin:12px 0 4px">Offen – wer übernimmt?</p><ul class="hist">${offene.map(d=>`<li><span><b>${esc(kurzTag(d.datum))}</b> ${esc(d.titel)}</span><span></span><span class="ctl"><button class="btn sm" data-act="sptDienst" data-v="uebernehmen" data-id="${d.id}">Übernehmen</button></span></li>`).join("")}</ul>`:""}
     ${SPT.dienste.filter(d=>d.spielerin_id&&d.spielerin_id!==me&&d.datum>=today()).length?`<details class="fold"><summary>Alle Dienste</summary><ul class="hist">${SPT.dienste.filter(d=>d.spielerin_id&&d.datum>=today()).map(d=>`<li><span><b>${esc(kurzTag(d.datum))}</b> ${esc(d.titel)}</span><span class="src">${esc(SPT.namen[d.spielerin_id]||"")}</span></li>`).join("")}</ul></details>`:""}</section>
   <section class="blk"><h3>Abwesenheit eintragen</h3><p class="hint" style="margin-top:0">z. B. Urlaub – alle Termine in dem Zeitraum werden automatisch abgesagt.</p>
     ${SPT.abw.length?`<ul class="hist">${SPT.abw.map(a=>`<li><span><b>${esc(kurzTag(a.von))}${a.bis!==a.von?" – "+esc(kurzTag(a.bis)):""}</b> ${esc(a.grund)}</span><span></span><span class="ctl"><button class="iconbtn mini" data-act="sptAbwDel" data-id="${a.id}" aria-label="Löschen">✕</button></span></li>`).join("")}</ul>`:""}
     <div class="meta"><label class="f">Von<input type="date" id="sptVon" value="${today()}"></label><label class="f">Bis<input type="date" id="sptBis" value="${today()}"></label><label class="f">Grund<select id="sptAbwGrund">${opt(GRUENDE_SP.map(g=>[g,g]),"Urlaub")}</select></label></div>
     <div class="row-actions"><button class="btn" data-act="sptAbw">Eintragen</button></div></section>
   <section class="blk"><h3>Mannschaftskasse <span class="sub">${saldo>0?`offen: ${euro(saldo)}`:saldo<0?`Guthaben: ${euro(-saldo)}`:"alles bezahlt"}</span></h3>
     ${SPT.buch.length?`<ul class="hist">${SPT.buch.map(b=>`<li><span><b>${esc(kurzTag(b.datum))}</b> ${esc(b.titel)}</span><span>${Number(b.betrag)<0?"bezahlt ":""}${euro(Math.abs(Number(b.betrag)))}</span></li>`).join("")}</ul>`:'<p class="hint">Keine Einträge.</p>'}
     ${SPT.kat.length?`<details class="fold"><summary>Strafenkatalog</summary><ul class="hist">${SPT.kat.map(k=>`<li><span>${esc(k.titel)}</span><span>${euro(Number(k.betrag))}</span></li>`).join("")}</ul></details>`:""}</section>
   ${kalenderBlock()}`;
}
/* Kalender-Abo (für Spielerinnen und Trainer) */
function kalenderBlock(){
  const url=S.ui.kalUrl;
  return `<section class="blk"><h3>Termine im Handy-Kalender</h3><p class="hint" style="margin-top:0">Alle Termine erscheinen in deinem Kalender und aktualisieren sich automatisch.</p>
    ${url?`<div class="row-actions"><a class="btn pri" href="${esc(url.replace(/^https:/,"webcal:"))}">Kalender abonnieren</a><button class="btn" data-act="kalKopie">Link kopieren</button></div>
      <p class="legend">iPhone: „Kalender abonnieren“ antippen → „Abonnieren“. Android/Google: Link kopieren und am PC in Google Kalender unter „Weitere Kalender → Per URL“ einfügen. Der Link ist persönlich – bitte nicht weitergeben.</p>
      <div class="row-actions"><button class="btn sm ghost" data-act="kalNeu">Neuen Link erstellen (alter wird ungültig)</button></div>`
    :`<div class="row-actions"><button class="btn" data-act="kalHolen">Kalender-Link anzeigen</button></div>`}</section>`;
}
async function kalenderHolen(neu){
  try{if(neu)await SB.api("/rest/v1/rpc/kalender_neu",{method:"POST",body:"{}"});const tok=await SB.api("/rest/v1/rpc/mein_kalender_token",{method:"POST",body:"{}"});
    S.ui.kalUrl=`${KONFIG.supabaseUrl}/functions/v1/push?kalender=${tok}`;render();if(neu)toast("Neuer Link erstellt – bitte neu abonnieren");}
  catch(e){toast("Fehler: "+(e.message||""));}
}

/* ---------- Bedienung ---------- */
$("#app").addEventListener("click",async e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act,id=el.dataset.id;
  if(a==="kalHolen")kalenderHolen(false);
  if(a==="kalNeu"){if(confirmDel("Neuen Link erstellen? Der alte funktioniert dann nicht mehr."))kalenderHolen(true);}
  if(a==="kalKopie"){try{await navigator.clipboard.writeText(S.ui.kalUrl);toast("Link kopiert");}catch(err){prompt("Link zum Kopieren:",S.ui.kalUrl);}}
  if(!SB.istSpielerin())return;
  const T=spTeam(),me=ich();
  if(a==="sptReload")sptLaden(true);
  if(a==="sptZ"){const v=el.dataset.v;if(v==="nein"){S.ui.spAbs=id;S.ui.spGrund="";render();return;}
    S.ui.spAbs=null;await sptAktion(()=>SB.api("/rest/v1/zusagen?on_conflict=termin_id,spielerin_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({termin_id:id,team:T,spielerin_id:me,status:v,grund:"",kommentar:"",auto:false,am:new Date().toISOString()})}),v==="ja"?"Zugesagt 👍":"Gespeichert");
    delete SPT.teiln[id];}
  if(a==="sptGrund"){S.ui.spGrund=el.dataset.v;const k=$("#sptKom");const kom=k?k.value:"";render();const k2=$("#sptKom");if(k2)k2.value=kom;}
  if(a==="sptAbsZu"){S.ui.spAbs=null;render();}
  if(a==="sptAbsSenden"){if(!S.ui.spGrund){toast("Bitte einen Grund wählen.");return;}const kom=($("#sptKom")||{}).value||"";
    const ok=await sptAktion(()=>SB.api("/rest/v1/zusagen?on_conflict=termin_id,spielerin_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({termin_id:id,team:T,spielerin_id:me,status:"nein",grund:S.ui.spGrund,kommentar:kom.trim(),auto:false,am:new Date().toISOString()})}),"Absage gesendet");
    if(ok){S.ui.spAbs=null;delete SPT.teiln[id];render();}}
  if(a==="sptWer"){S.ui.open["w"+id]=!S.ui.open["w"+id];render();if(S.ui.open["w"+id]){try{SPT.teiln[id]=await SB.api("/rest/v1/rpc/termin_teilnehmer",{method:"POST",body:JSON.stringify({p_termin:id})})||[];}catch(err){SPT.teiln[id]=[];}render();}}
  if(a==="sptAuf"){S.ui.open["a"+id]=!S.ui.open["a"+id];render();}
  if(a==="sptFahrt"){S.ui.open["f"+id]=!S.ui.open["f"+id];render();}
  const fahrt=(aktion,body)=>sptAktion(()=>SB.api("/rest/v1/rpc/fahrt_aendern",{method:"POST",body:JSON.stringify(Object.assign({p_aktion:aktion,p_termin:null,p_fahrt:null,p_plaetze:null,p_abfahrt:null,p_treffpunkt:null,p_notiz:null},body))}));
  if(a==="sptAnbieten")fahrt("anbieten",{p_termin:id,p_plaetze:+$("#fPl-"+id).value,p_abfahrt:$("#fAb-"+id).value,p_treffpunkt:$("#fTr-"+id).value,p_notiz:""}).then(ok=>ok&&toast("Fahrt angeboten"));
  if(a==="sptMit")fahrt("mitfahren",{p_fahrt:id}).then(ok=>ok&&toast("Du fährst mit"));
  if(a==="sptAus")fahrt("aussteigen",{p_fahrt:id});
  if(a==="sptFahrtDel"){if(confirmDel("Deine Fahrt löschen? Mitfahrerinnen werden ausgetragen."))fahrt("loeschen",{p_fahrt:id});}
  if(a==="sptAbst"){const u=SPT.umf.find(x=>x.id===id);const wahl=[...document.querySelectorAll(`input[name="uf-${id}"]:checked`)].map(x=>+x.value);
    if(!wahl.length){toast("Bitte eine Antwort wählen.");return;}if(u&&u.anonym&&!confirmDel("Anonym abstimmen? Du kannst deine Stimme danach nicht mehr ändern."))return;
    delete SPT.umfErg[id];S.ui.ufAendern=null;await sptAktion(()=>SB.api("/rest/v1/rpc/abstimmen",{method:"POST",body:JSON.stringify({p_umfrage:id,p_optionen:wahl})}),"Danke für deine Stimme");}
  if(a==="sptUfAendern"){S.ui.ufAendern=id;render();}
  if(a==="sptDienst")await sptAktion(()=>SB.api("/rest/v1/rpc/dienst_aendern",{method:"POST",body:JSON.stringify({p_id:id,p_aktion:el.dataset.v})}),el.dataset.v==="uebernehmen"?"Dienst übernommen – danke!":el.dataset.v==="abgeben"?"Dienst abgegeben":"Gespeichert");
  if(a==="sptAbw"){const von=$("#sptVon").value,bis=$("#sptBis").value;if(!von||!bis||bis<von){toast("Bitte einen gültigen Zeitraum wählen.");return;}
    await sptAktion(()=>SB.api("/rest/v1/abwesenheiten",{method:"POST",body:JSON.stringify({team:T,spielerin_id:me,von,bis,grund:$("#sptAbwGrund").value})}),"Eingetragen – Termine im Zeitraum sind abgesagt");}
  if(a==="sptAbwDel"){if(confirmDel("Abwesenheit löschen? Die automatischen Absagen werden entfernt."))await sptAktion(()=>SB.api(`/rest/v1/abwesenheiten?id=eq.${id}`,{method:"DELETE"}),"Gelöscht");}
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&SB.istSpielerin())sptLaden();});
