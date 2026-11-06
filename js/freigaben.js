"use strict";
/* ---------- Freigaben an Spielerinnen (Phase 8a, Trainer-Seite) ----------
   Liegt nur online in Supabase (Tabellen zugaenge, freigaben, freigabe_empfaenger, gelesen, reaktionen –
   siehe supabase-phase8a.sql). Die Daten im Browser (Kader, Trainings …) ändern sich dadurch nicht.
   Eine Freigabe enthält eine KOPIE der Inhalte:
   inhalt = {spiel:{gegner,datum,ergebnis,wettbewerb}, punkte:[{text,art,hz,haupt,tag,teile,medien}], medien:[{id,typ,titel,data|url}], fazit}
   quelle = {spiel, punkte:[ids], medien:[ids], fazit:bool} – damit „Inhalt aktualisieren“ später neu kopieren kann. */
const FG={list:[],zug:[],t:0,loading:false,err:""};
const REAKT={verstanden:"👍 Verstanden",unsicher:"🤔 War mir unsicher",gut:"✅ Hat gut funktioniert",besprechen:"💬 Möchte ich besprechen"};
const FGART={analyse:"Analyse",beobachtung:"Beobachtung",bild:"Screenshot",clip:"Videoclip",kommentar:"Kommentar"};
const fgBereit=()=>SB.cfgOk()&&!!SB.st.session&&!!SB.state.team&&!SB.istSpielerin();
const fgTeam=()=>encodeURIComponent(SB.state.team);
/* Spielerin in allen Mannschaften suchen (Zugänge gelten für das ganze Supabase-Team) */
const pAlle=id=>Object.values(S.kaders).flatMap(k=>k.players||[]).find(p=>p.id===id);
const pNameAlle=id=>{const p=pAlle(id);return p?p.name:"(nicht mehr im Kader)";};
const zugVon=pid=>FG.zug.find(z=>z.spielerin_id===pid);
const hatZugang=pid=>{const z=zugVon(pid);return !!(z&&z.aktiv);};

async function fgLaden(force){
  if(!fgBereit()||FG.loading)return;if(!force&&Date.now()-FG.t<30000)return;
  FG.loading=true;
  try{
    const [list,zug]=await Promise.all([
      SB.api(`/rest/v1/freigaben?select=id,art,titel,text,quelle,erstellt_am,geaendert_am,zurueckgezogen,freigabe_empfaenger(spielerin_id),gelesen(spielerin_id,zuerst_am,zuletzt_am),reaktionen(spielerin_id,art,kommentar,am)&team=eq.${fgTeam()}&order=erstellt_am.desc`),
      SB.api(`/rest/v1/zugaenge?select=*&team=eq.${fgTeam()}`)]);
    FG.list=list||[];FG.zug=zug||[];FG.t=Date.now();FG.err="";
  }catch(e){FG.err=navigator.onLine?(e.message||"Laden fehlgeschlagen"):"Offline – Freigaben brauchen eine Internetverbindung.";}
  finally{FG.loading=false;render();}
}
/* in Ansichten aufrufen: lädt im Hintergrund nach, wenn nötig */
const fgNach=()=>{if(fgBereit()&&!FG.loading&&Date.now()-FG.t>=30000)setTimeout(()=>fgLaden(),0);};
const fgHinweis=()=>!SB.cfgOk()?"Freigaben brauchen die gemeinsame Datenbank.":!SB.st.session?"Für Freigaben bitte unter Einstellungen → „Gemeinsame Daten“ anmelden.":"";

/* ---------- Zugang einer Spielerin ---------- */
function zugangBlock(p){
  const h=fgHinweis();if(h)return `<section class="blk"><h3>Zugang zur App</h3><p class="hint">${esc(h)}</p></section>`;
  const z=zugVon(p.id);
  return `<section class="blk"><h3>Zugang zur App <span class="sub">${z?(z.aktiv?"aktiv":"gesperrt"):"kein Zugang"}</span></h3>
   <p class="hint">Mit Zugang meldet sie sich mit dieser E-Mail an und sieht <b>nur</b> das, was du ihr freigibst – keine Kaderdaten, Notizen oder Bewertungen.</p>
   <div class="addpt"><input class="inp" type="email" id="zugMail" autocomplete="off" value="${esc(z?z.email:"")}" placeholder="E-Mail der Spielerin"><button class="btn${z?"":" pri"}" data-act="zugSpeichern" data-id="${p.id}">${z?"E-Mail ändern":"Zugang anlegen"}</button></div>
   ${z?`<div class="row-actions"><button class="btn sm${z.aktiv?"":" pri"}" data-act="zugAktiv" data-id="${p.id}">${z.aktiv?"Zugang sperren":"Wieder freischalten"}</button><button class="btn sm ghost danger" data-act="zugLoeschen" data-id="${p.id}">Zugang entfernen</button></div>`:""}</section>`;
}
async function zugSpeichern(pid){
  const p=pAlle(pid);const mail=($("#zugMail").value||"").trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(mail)){toast("Bitte eine gültige E-Mail eingeben.");return;}
  const andere=FG.zug.find(z=>z.email.toLowerCase()===mail&&z.spielerin_id!==pid);
  if(andere){toast(`Diese E-Mail hat schon ${pNameAlle(andere.spielerin_id)}.`);return;}
  try{
    if(zugVon(pid))await SB.api(`/rest/v1/zugaenge?team=eq.${fgTeam()}&spielerin_id=eq.${encodeURIComponent(pid)}`,{method:"PATCH",body:JSON.stringify({email:mail,name:p?p.name:""})});
    else await SB.api("/rest/v1/zugaenge",{method:"POST",body:JSON.stringify({team:SB.state.team,spielerin_id:pid,email:mail,name:p?p.name:""})});
    toast("Zugang gespeichert");await fgLaden(true);
  }catch(e){toast("Nicht gespeichert: "+(e.message||"Fehler"));}
}
async function zugAktiv(pid){const z=zugVon(pid);if(!z)return;
  try{await SB.api(`/rest/v1/zugaenge?team=eq.${fgTeam()}&spielerin_id=eq.${encodeURIComponent(pid)}`,{method:"PATCH",body:JSON.stringify({aktiv:!z.aktiv})});
    toast(z.aktiv?"Zugang gesperrt – sie sieht ab sofort nichts mehr":"Zugang wieder freigeschaltet");await fgLaden(true);}catch(e){toast("Fehler: "+(e.message||""));}}
async function zugLoeschen(pid){if(!confirmDel(`Zugang von ${pNameAlle(pid)} entfernen?\n\nIhre Lesebestätigungen und Reaktionen bleiben für dich sichtbar.`))return;
  try{await SB.api(`/rest/v1/zugaenge?team=eq.${fgTeam()}&spielerin_id=eq.${encodeURIComponent(pid)}`,{method:"DELETE"});toast("Zugang entfernt");await fgLaden(true);}catch(e){toast("Fehler: "+(e.message||""));}}

/* ---------- Inhalte aus dem Spielbericht kopieren ---------- */
function inhaltAusSpiel(sid,q){
  const s=S.spiele[sid];if(!s)return null;const pids=q.punkte||[],mids=new Set(q.medien||[]);
  const punkte=(s.punkte||[]).filter(p=>pids.includes(p.id)).map(p=>{(p.medien||[]).forEach(m=>mids.add(m));
    return {text:p.text||"",art:p.art||"info",hz:p.hz||1,haupt:p.haupt||"",tag:p.tag||"",teile:(p.teile||[]).slice(),medien:(p.medien||[]).slice()};});
  const medien=(s.medien||[]).filter(m=>mids.has(m.id)).map(m=>m.typ==="bild"?{id:m.id,typ:"bild",titel:m.titel||"",data:m.data}:{id:m.id,typ:"video",titel:m.titel||"",url:m.url});
  return {spiel:{gegner:s.gegner||"",datum:s.datum||"",ergebnis:s.ergebnis||"",wettbewerb:s.wettbewerb||""},punkte,medien,fazit:q.fazit?(s.fazit||""):""};
}
const spielTitel=s=>`${s.gegner||"Spiel"}${s.datum?" ("+kurzDatum(s.datum)+")":""}`;

/* ---------- Freigabe-Fenster ---------- */
function openFreigabe(d){S.ui.fgD=Object.assign({titel:"",text:"",empf:[],quelle:null,inhalt:null},d);fgDialog();}
function fgDialog(){
  const d=S.ui.fgD;if(!d)return;const q=d.quelle;const s=q&&q.spiel?S.spiele[q.spiel]:null;
  const kandidaten=players().slice().sort(nrSort);
  d.empf.forEach(pid=>{if(!kandidaten.some(p=>p.id===pid)&&pAlle(pid))kandidaten.push(pAlle(pid));});
  const mitZug=kandidaten.filter(p=>hatZugang(p.id));
  const auswahl=s&&d.art==="analyse"?`<p class="legend" style="margin:12px 0 6px">Was soll sie sehen?</p>
    <div class="fgwahl">${(s.punkte||[]).map(p=>`<label class="fgcb"><input type="checkbox" data-act="fgPkt" data-v="${p.id}"${q.punkte.includes(p.id)?" checked":""}><span class="art sm" data-a="${p.art||"info"}">${ARTL[p.art||"info"]}</span> ${esc(p.text||"(ohne Text)")}</label>`).join("")||'<p class="hint">Keine Beobachtungen im Spielbericht.</p>'}
     ${(s.medien||[]).map(m=>`<label class="fgcb"><input type="checkbox" data-act="fgMd" data-v="${m.id}"${q.medien.includes(m.id)?" checked":""}> ${m.typ==="bild"?`<img src="${m.data}" alt="">`:"▶"} ${esc(m.titel||(m.typ==="bild"?"Screenshot":"Clip"))}</label>`).join("")}
     ${s.fazit?`<label class="fgcb"><input type="checkbox" data-act="fgFazit"${q.fazit?" checked":""}> Gesamteindruck</label>`:""}</div>
    <p class="legend">Screenshots und Clips, die einer gewählten Beobachtung zugeordnet sind, kommen automatisch mit.</p>`:"";
  const vorschau=d.art!=="analyse"&&d.art!=="kommentar"&&d.inhalt?`<div class="fgvor">${fgInhaltHtml(d.inhalt)}</div>`:"";
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="Freigeben"><h3>${d.id?"Freigabe bearbeiten":"Freigeben: "+esc(FGART[d.art]||"")} <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
    <label class="f">Titel<input class="inp" id="fgTitel" data-act="fgTxt" data-f="titel" value="${esc(d.titel)}" placeholder="z. B. Abstände in der Viererkette"></label>
    <label class="f" style="margin-top:10px">Dein Kommentar${d.art==="kommentar"?"":" (optional)"}<textarea class="inp" id="fgText" data-act="fgTxt" data-f="text" rows="3" placeholder="Was soll sie mitnehmen?">${esc(d.text)}</textarea></label>
    ${auswahl}${vorschau}
    ${d.id&&s&&d.art!=="kommentar"?`<div class="row-actions"><button class="btn sm" data-act="fgNeuKopie">Inhalt aus dem Spielbericht neu übernehmen</button></div>`:""}
    <p class="legend" style="margin:14px 0 6px">An wen? <span class="src">${d.empf.length} gewählt</span></p>
    <div class="row-actions" style="margin:0 0 8px"><button class="btn sm" data-act="fgAlle">Alle mit Zugang (${mitZug.length})</button>${q&&q.vorschlag&&q.vorschlag.length?`<button class="btn sm" data-act="fgVorschlag">${esc(q.vorschlagName||"Vorschlag")}</button>`:""}${d.empf.length?'<button class="btn sm ghost" data-act="fgKeine">Keine</button>':""}</div>
    <div class="chips">${kandidaten.filter(p=>hatZugang(p.id)||d.empf.includes(p.id)).map(p=>{const z=hatZugang(p.id);return `<button type="button" class="chip tag" data-act="fgEmpf" data-v="${p.id}" aria-pressed="${d.empf.includes(p.id)}">${p.nummer?`<span class="nr">${esc(p.nummer)}</span>`:""}${esc(p.name)}${z?"":' <span class="src">– kein aktiver Zugang</span>'}</button>`;}).join("")}</div>
    <p class="legend">${mitZug.length?`${kandidaten.length-mitZug.length} weitere Spielerinnen haben noch keinen Zugang`:"Noch keine Spielerin hat einen Zugang"} – anlegen unter Kader → Spielerin → „Freigaben“.</p>
    <div class="row-actions"><button class="btn pri" data-act="fgSenden">${d.id?"Änderungen speichern":"Freigeben"}</button></div></div></div>`;
}
async function fgSenden(btn){
  const d=S.ui.fgD;if(!d)return;d.titel=d.titel.trim();d.text=d.text.trim();
  if(!d.titel){toast("Bitte einen Titel eingeben.");return;}
  if(!d.empf.length){toast("Bitte mindestens eine Spielerin wählen.");return;}
  if(d.art==="kommentar"&&!d.text){toast("Bitte einen Kommentar schreiben.");return;}
  let inhalt=d.inhalt;
  if(d.quelle&&d.quelle.spiel&&(!d.id||d.neuKopie)){inhalt=inhaltAusSpiel(d.quelle.spiel,d.quelle);
    if(d.art==="analyse"&&inhalt&&!inhalt.punkte.length&&!inhalt.medien.length&&!inhalt.fazit){toast("Bitte mindestens eine Beobachtung, ein Medium oder den Gesamteindruck wählen.");return;}}
  const quelle=d.quelle?{spiel:d.quelle.spiel||null,punkte:d.quelle.punkte||[],medien:d.quelle.medien||[],fazit:!!d.quelle.fazit,spieler:d.quelle.spieler||null}:null;
  btn.disabled=true;
  try{
    let id=d.id;
    if(!id){const r=await SB.api("/rest/v1/freigaben",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({team:SB.state.team,art:d.art,titel:d.titel,text:d.text,inhalt:inhalt||{},quelle})});id=r[0].id;}
    else{const upd={titel:d.titel,text:d.text,geaendert_am:new Date().toISOString()};if(d.neuKopie&&inhalt){upd.inhalt=inhalt;upd.quelle=quelle;}
      await SB.api(`/rest/v1/freigaben?id=eq.${id}`,{method:"PATCH",body:JSON.stringify(upd)});}
    const alt=d.altEmpf||[];const weg=alt.filter(x=>!d.empf.includes(x)),neu=d.empf.filter(x=>!alt.includes(x));
    if(weg.length)await SB.api(`/rest/v1/freigabe_empfaenger?freigabe_id=eq.${id}&spielerin_id=in.(${weg.map(encodeURIComponent).join(",")})`,{method:"DELETE"});
    if(neu.length)await SB.api("/rest/v1/freigabe_empfaenger",{method:"POST",body:JSON.stringify(neu.map(pid=>({freigabe_id:id,team:SB.state.team,spielerin_id:pid})))});
    S.ui.fgD=null;$("#overlay").innerHTML="";toast(d.id?"Freigabe geändert":`Freigegeben an ${d.empf.length} Spielerin${d.empf.length>1?"nen":""}`);await fgLaden(true);
  }catch(e){btn.disabled=false;toast("Nicht gespeichert: "+(e.message||"Fehler"));}
}
async function fgBearbeiten(id){
  const f=FG.list.find(x=>x.id===id);if(!f)return;
  const q=f.quelle?Object.assign({punkte:[],medien:[],fazit:false},f.quelle):null;
  openFreigabe({id,art:f.art,titel:f.titel,text:f.text,quelle:q,empf:f.freigabe_empfaenger.map(e=>e.spielerin_id),altEmpf:f.freigabe_empfaenger.map(e=>e.spielerin_id)});
  try{const r=await SB.api(`/rest/v1/freigaben?id=eq.${id}&select=inhalt`);if(S.ui.fgD&&S.ui.fgD.id===id){S.ui.fgD.inhalt=r[0]&&r[0].inhalt;fgDialog();}}catch(e){}
}
async function fgZurueck(id){const f=FG.list.find(x=>x.id===id);if(!f)return;
  if(!f.zurueckgezogen&&!confirmDel(`„${f.titel}“ zurückziehen?\n\nDie Spielerinnen sehen sie sofort nicht mehr. Du kannst sie später wiederherstellen.`))return;
  try{await SB.api(`/rest/v1/freigaben?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({zurueckgezogen:!f.zurueckgezogen,geaendert_am:new Date().toISOString()})});
    toast(f.zurueckgezogen?"Wiederhergestellt":"Zurückgezogen");await fgLaden(true);}catch(e){toast("Fehler: "+(e.message||""));}}
async function fgLoeschen(id){const f=FG.list.find(x=>x.id===id);if(!f)return;
  if(!confirmDel(`„${f.titel}“ endgültig löschen?\n\nAuch Lesebestätigungen und Reaktionen dazu werden gelöscht. Das lässt sich nicht rückgängig machen.`))return;
  try{await SB.api(`/rest/v1/freigaben?id=eq.${id}`,{method:"DELETE"});toast("Gelöscht");await fgLaden(true);}catch(e){toast("Fehler: "+(e.message||""));}}

/* Inhalt einer Freigabe anzeigen (auch für die Spielerinnen-Ansicht) */
function fgInhaltHtml(i){
  if(!i)return "";const med=new Map((i.medien||[]).map(m=>[m.id,m]));const gezeigt=new Set();
  const medHtml=m=>{gezeigt.add(m.id);return m.typ==="bild"?`<figure class="fgbild"><img src="${m.data}" alt="${esc(m.titel||"Screenshot")}">${m.titel?`<figcaption>${esc(m.titel)}</figcaption>`:""}</figure>`
    :istLink(m.url)?`<a class="medvid" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">▶ ${esc(m.titel||"Clip öffnen")} ↗</a>`:"";};
  const pk=(i.punkte||[]).map(p=>`<div class="fgpkt"><span class="art sm" data-a="${p.art||"info"}" aria-label="${ARTN[p.art||"info"]}">${ARTL[p.art||"info"]}</span><div><div>${esc(p.text)}</div>
    ${[p.haupt,p.tag,...(p.teile||[])].filter(Boolean).length?`<span class="src">${esc([p.haupt,p.tag,...(p.teile||[])].filter(Boolean).join(" · "))}</span>`:""}
    ${(p.medien||[]).map(id=>med.get(id)).filter(Boolean).map(medHtml).join("")}</div></div>`).join("");
  const rest=(i.medien||[]).filter(m=>!gezeigt.has(m.id));
  return `${i.spiel&&(i.spiel.gegner||i.spiel.datum)?`<p class="legend" style="margin-top:0">Spiel gegen ${esc(i.spiel.gegner||"?")}${i.spiel.datum?", "+esc(fmtDate(i.spiel.datum)):""}${i.spiel.ergebnis?" · "+esc(i.spiel.ergebnis):""}</p>`:""}
    ${pk}${rest.length?`<div class="fgmed">${rest.map(medHtml).join("")}</div>`:""}${i.fazit?`<div class="fgfazit"><b>Gesamteindruck</b><p>${esc(i.fazit)}</p></div>`:""}`;
}

/* ---------- Übersicht ---------- */
function fgListe(filter,leerText){
  const h=fgHinweis();if(h)return `<p class="hint">${esc(h)}</p>`;
  if(FG.err)return `<div class="warn">${esc(FG.err)}</div><div class="row-actions"><button class="btn sm" data-act="fgReload">Erneut laden</button></div>`;
  if(!FG.t)return '<p class="hint">Freigaben werden geladen …</p>';
  const l=FG.list.filter(f=>!filter||filter(f));
  if(!l.length)return `<p class="hint">${esc(leerText||"Noch keine Freigaben.")}</p>`;
  return `<div class="fglist">${l.map(f=>{const em=f.freigabe_empfaenger.map(e=>e.spielerin_id);const gel=new Map(f.gelesen.map(g=>[g.spielerin_id,g]));const re=new Map(f.reaktionen.map(r=>[r.spielerin_id,r]));
    const nGel=em.filter(x=>gel.has(x)).length;const zaehl={};f.reaktionen.forEach(r=>{if(r.art)zaehl[r.art]=(zaehl[r.art]||0)+1;});const nKom=f.reaktionen.filter(r=>(r.kommentar||"").trim()).length;
    const open=S.ui.open["fg"+f.id];
    return `<div class="fgi${f.zurueckgezogen?" weg":""}"><button type="button" class="fgkopf" data-act="fgAuf" data-id="${f.id}" aria-expanded="${!!open}">
      <span class="fgt"><b>${esc(f.titel)}</b>${f.zurueckgezogen?' <span class="bd warnbd">zurückgezogen</span>':""}</span>
      <span class="src">${esc(FGART[f.art]||f.art)} · ${esc(fmtStamp(Date.parse(f.erstellt_am)))} · an ${em.length}</span>
      <span class="fgstat"><span class="${nGel===em.length&&em.length?"ok":""}">👁 ${nGel}/${em.length} geöffnet</span>${Object.entries(zaehl).map(([k,v])=>`<span>${REAKT[k].split(" ")[0]} ${v}</span>`).join("")}${nKom?`<span>✎ ${nKom}</span>`:""}</span></button>
      ${open?`<div class="fgdet">${f.text?`<p class="fgtext">${esc(f.text)}</p>`:""}
        <ul class="hist fgemp">${em.map(pid=>{const g=gel.get(pid),r=re.get(pid);return `<li><b>${esc(pNameAlle(pid))}</b><span>${g?`<span class="ok">geöffnet ${esc(fmtStamp(Date.parse(g.zuerst_am)))}</span>`:'<span class="src">noch nicht geöffnet</span>'}${!hatZugang(pid)?' <span class="src">· kein aktiver Zugang</span>':""}</span>
          <em>${r&&r.art?esc(REAKT[r.art]):""}</em>${r&&(r.kommentar||"").trim()?`<div class="fgkom">„${esc(r.kommentar)}“</div>`:""}</li>`;}).join("")}</ul>
        <div class="row-actions"><button class="btn sm" data-act="fgEdit" data-id="${f.id}">Bearbeiten</button><button class="btn sm" data-act="fgZurueck" data-id="${f.id}">${f.zurueckgezogen?"Wiederherstellen":"Zurückziehen"}</button><button class="btn sm ghost danger" data-act="fgDel" data-id="${f.id}">Endgültig löschen</button></div></div>`:""}</div>`;}).join("")}</div>`;
}
/* Übersicht aller Freigaben (aus der Spiele-Liste) */
function fgUebersicht(){
  fgNach();
  return `<div class="ed-top"><button class="btn ghost back" data-act="fgZu">← Spiele</button></div>
   <h2 class="page-h" style="margin-top:0">Freigaben</h2>
   <p class="hint">Alles, was du Spielerinnen freigegeben hast: wer es geöffnet hat und wie sie reagiert haben. Freigeben kannst du im Spielbericht (Beobachtung → Details, Screenshots, „Analyse freigeben“) und bei der Spielerin.</p>
   <div class="row-actions" style="margin-top:0"><button class="btn sm" data-act="fgReload">Aktualisieren</button></div>
   ${fgListe(null,"Noch keine Freigaben.")}`;
}
/* Freigaben-Bereich in einem Spielbericht */
function fgSpielBlock(sid){
  if(!SB.cfgOk())return "";fgNach();const n=FG.list.filter(f=>f.quelle&&f.quelle.spiel===sid).length;
  return `<section class="blk"><h3>Freigaben aus diesem Spiel <span class="sub">${n}</span></h3>${fgListe(f=>f.quelle&&f.quelle.spiel===sid,"Noch nichts freigegeben. Einzelne Beobachtungen gibst du unter „Details“ frei, Screenshots und Clips direkt im Medienbereich.")}
   <div class="row-actions"><button class="btn sm pri" data-act="fgSpiel">Analyse freigeben</button></div></section>`;
}
/* Reiter „Freigaben“ bei der Spielerin */
function fgSpielerinTab(p){
  fgNach();const n=FG.list.filter(f=>f.freigabe_empfaenger.some(e=>e.spielerin_id===p.id)).length;
  return zugangBlock(p)+(fgHinweis()?"":`<section class="blk"><h3>Freigaben an ${esc(p.name)} <span class="sub">${n}</span></h3>
    ${fgListe(f=>f.freigabe_empfaenger.some(e=>e.spielerin_id===p.id),"Noch nichts an sie freigegeben.")}
    <div class="row-actions"><button class="btn sm pri" data-act="fgKommentar" data-id="${p.id}"${hatZugang(p.id)?"":" disabled"}>Kommentar an ${esc(p.name)} freigeben</button></div>
    ${hatZugang(p.id)?"":'<p class="legend">Zum Freigeben braucht sie zuerst einen aktiven Zugang.</p>'}</section>`+fbSpielerinBlock(p));
}

/* ---------- Bedienung ---------- */
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  const s=S.spiele[S.sel.spiel];const p=s&&el.dataset.i!=null?s.punkte[+el.dataset.i]:null;
  if(a==="fgAuf"){S.ui.open["fg"+el.dataset.id]=!S.ui.open["fg"+el.dataset.id];render();}
  if(a==="fgReload")fgLaden(true);
  if(a==="fgEdit")fgBearbeiten(el.dataset.id);
  if(a==="fgZurueck")fgZurueck(el.dataset.id);
  if(a==="fgDel")fgLoeschen(el.dataset.id);
  if(a==="fgOffen"){S.ui.fgView=true;S.sel.spiel=null;render();window.scrollTo(0,0);}
  if(a==="fgZu"){S.ui.fgView=false;render();}
  if(a==="zugSpeichern")zugSpeichern(el.dataset.id);
  if(a==="zugAktiv")zugAktiv(el.dataset.id);
  if(a==="zugLoeschen")zugLoeschen(el.dataset.id);
  if((a==="fgPunkt"||a==="fgMed"||a==="fgSpiel")&&fgHinweis()){toast(fgHinweis());return;}
  if(a==="fgPunkt"&&p){fgLaden();openFreigabe({art:"beobachtung",titel:(p.text||"").slice(0,60),quelle:{spiel:S.sel.spiel,punkte:[p.id],medien:[],fazit:false,vorschlag:p.spielerinnen||[],vorschlagName:"Spielerinnen dieser Beobachtung"},empf:(p.spielerinnen||[]).filter(hatZugang)});
    S.ui.fgD.inhalt=inhaltAusSpiel(S.sel.spiel,S.ui.fgD.quelle);fgDialog();}
  if(a==="fgMed"&&s){const m=(s.medien||[]).find(x=>x.id===el.dataset.id);if(!m)return;fgLaden();
    openFreigabe({art:m.typ==="bild"?"bild":"clip",titel:m.titel||(m.typ==="bild"?"Screenshot":"Videoclip")+" – "+spielTitel(s),quelle:{spiel:S.sel.spiel,punkte:[],medien:[m.id],fazit:false,vorschlag:s.kader||[],vorschlagName:"Spielkader"},empf:[]});
    S.ui.fgD.inhalt=inhaltAusSpiel(S.sel.spiel,S.ui.fgD.quelle);fgDialog();}
  if(a==="fgSpiel"&&s){fgLaden();openFreigabe({art:"analyse",titel:"Analyse "+spielTitel(s),quelle:{spiel:S.sel.spiel,punkte:(s.punkte||[]).map(x=>x.id),medien:[],fazit:!!s.fazit,vorschlag:s.kader||[],vorschlagName:"Spielkader"},empf:[]});}
  if(a==="fgKommentar"){const pl=pAlle(el.dataset.id);if(pl)openFreigabe({art:"kommentar",titel:`Feedback für ${pl.name}`,quelle:{spieler:pl.id},empf:[pl.id]});}
});
$("#app").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.id==="zugMail"){e.preventDefault();const b=document.querySelector('[data-act="zugSpeichern"]');if(b)zugSpeichern(b.dataset.id);}});
$("#overlay").addEventListener("input",e=>{const el=e.target;if(el.dataset.act==="fgTxt"&&S.ui.fgD)S.ui.fgD[el.dataset.f]=el.value;});
$("#overlay").addEventListener("change",e=>{const el=e.target,d=S.ui.fgD;if(!d||!d.quelle)return;const q=d.quelle;
  const tog=(k,v,on)=>{q[k]=on?[...new Set([...(q[k]||[]),v])]:(q[k]||[]).filter(x=>x!==v);};
  if(el.dataset.act==="fgPkt")tog("punkte",el.dataset.v,el.checked);
  if(el.dataset.act==="fgMd")tog("medien",el.dataset.v,el.checked);
  if(el.dataset.act==="fgFazit")q.fazit=el.checked;
  if(d.id&&["fgPkt","fgMd","fgFazit"].includes(el.dataset.act))d.neuKopie=true;});
$("#overlay").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act,d=S.ui.fgD;if(!d)return;
  if(a==="closeOv"&&(e.target===el||el.tagName==="BUTTON")){S.ui.fgD=null;return;}
  if(a==="fgEmpf"){const v=el.dataset.v;d.empf=d.empf.includes(v)?d.empf.filter(x=>x!==v):[...d.empf,v];fgDialog();}
  if(a==="fgAlle"){const ids=players().map(p=>p.id).filter(hatZugang);d.empf=[...new Set([...d.empf,...ids])];fgDialog();}
  if(a==="fgVorschlag"&&d.quelle){const ids=(d.quelle.vorschlag||[]).filter(hatZugang);if(!ids.length)toast("Keine davon hat einen Zugang.");d.empf=[...new Set([...d.empf,...ids])];fgDialog();}
  if(a==="fgKeine"){d.empf=[];fgDialog();}
  if(a==="fgNeuKopie"){if(!d.quelle||!S.spiele[d.quelle.spiel]){toast("Der Spielbericht existiert nicht mehr.");return;}d.neuKopie=true;d.inhalt=inhaltAusSpiel(d.quelle.spiel,d.quelle);fgDialog();toast("Wird beim Speichern neu übernommen");}
  if(a==="fgSenden")fgSenden(el);
});
