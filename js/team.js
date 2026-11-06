"use strict";
/* ---------- Mannschaft (Phase 9, Trainer-Seite) ----------
   Termine mit Zu-/Absagen, Abwesenheiten, Mitteilungen, Umfragen, Dienste, Mannschaftskasse.
   Alles liegt online in Supabase (supabase-phase9.sql); die Daten im Browser (Trainings, Spiele) bleiben unverändert –
   außer „In Anwesenheit übernehmen“, das die Zusagen in das Training einträgt. */
const TM={t:0,loading:false,err:"",termine:[],zusagen:[],abw:[],mitt:[],mittGel:[],umf:[],umfTeil:[],umfErg:{},dienste:[],kat:[],buch:[]};
const tmBereit=()=>fgBereit();
const tmTeam=()=>fgTeam();
const GRUENDE_SP=["Krankheit","Verletzung","Arbeit","Schule/Studium","Urlaub","Privat","Sonstiges"];
const ZSYM={ja:"✓",nein:"✗",vielleicht:"?"};
const ZTXT={ja:"Zusage",nein:"Absage",vielleicht:"Vielleicht"};
const ARTTXT={training:"Training",spiel:"Spiel",sonstiges:"Termin"};
const lokTag=iso=>{const d=new Date(iso);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const lokZeit=iso=>{const d=new Date(iso);return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;};
const terminZeit=tm=>`${fmtDate(lokTag(tm.beginn))}, ${lokZeit(tm.beginn)} Uhr`;
const euro=n=>(Math.round(n*100)/100).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
/* Spielerinnen mit aktivem Zugang (nur sie können antworten) */
const teamMitZugang=()=>FG.zug.filter(z=>z.aktiv);
const nameVon=pid=>pAlle(pid)?pNameAlle(pid):((FG.zug.find(z=>z.spielerin_id===pid)||{}).name||"Spielerin");

async function tmLaden(force){
  if(!tmBereit()||TM.loading)return;if(!force&&Date.now()-TM.t<30000)return;TM.loading=true;
  const T=tmTeam(),ab=new Date(Date.now()-14*864e5).toISOString(),heute=today(),vorWoche=dayShift(heute,-7);
  try{
    await fgLaden();
    const [termine,abw,mitt,mittGel,umf,umfTeil,dienste,kat,buch]=await Promise.all([
      SB.api(`/rest/v1/termine?team=eq.${T}&beginn=gte.${encodeURIComponent(ab)}&order=beginn.asc`),
      SB.api(`/rest/v1/abwesenheiten?team=eq.${T}&bis=gte.${heute}&order=von.asc`),
      SB.api(`/rest/v1/mitteilungen?team=eq.${T}&order=erstellt_am.desc&limit=40`),
      SB.api(`/rest/v1/mitteilung_gelesen?team=eq.${T}&select=mitteilung_id,spielerin_id`),
      SB.api(`/rest/v1/umfragen?team=eq.${T}&order=erstellt_am.desc&limit=30`),
      SB.api(`/rest/v1/umfrage_teilnahme?team=eq.${T}&select=umfrage_id,spielerin_id`),
      SB.api(`/rest/v1/dienste?team=eq.${T}&datum=gte.${vorWoche}&order=datum.asc`),
      SB.api(`/rest/v1/kasse_katalog?team=eq.${T}&order=titel.asc`),
      SB.api(`/rest/v1/kasse_buchungen?team=eq.${T}&order=datum.desc`)]);
    TM.termine=termine||[];const ids=TM.termine.map(x=>x.id);
    TM.zusagen=ids.length?await SB.api(`/rest/v1/zusagen?termin_id=in.(${ids.join(",")})`)||[]:[];
    Object.assign(TM,{abw:abw||[],mitt:mitt||[],mittGel:mittGel||[],umf:umf||[],umfTeil:umfTeil||[],dienste:dienste||[],kat:kat||[],buch:buch||[]});
    TM.t=Date.now();TM.err="";
  }catch(e){TM.err=navigator.onLine?(e.message||"Laden fehlgeschlagen"):"Offline – dieser Bereich braucht eine Internetverbindung.";}
  finally{TM.loading=false;render();}
}
const tmNach=()=>{if(tmBereit()&&!TM.loading&&Date.now()-TM.t>=30000)setTimeout(()=>tmLaden(),0);};
const tmApi=(pfad,methode,daten,extra)=>SB.api(pfad,Object.assign({method:methode,body:daten===undefined?undefined:JSON.stringify(daten)},extra||{}));
async function tmAktion(fn,ok){try{await fn();if(ok)toast(ok);await tmLaden(true);}catch(e){toast("Fehler: "+(e.message||""));}}

/* ---------- Kader-Seite mit Reitern ---------- */
function kaderReiter(){
  if(!SB.cfgOk()||!SB.st.session||SB.istSpielerin())return "";
  const k=S.ui.kTab||"spielerinnen";
  return seg("kTab",k,[["spielerinnen","Spielerinnen"],["termine","Termine"],["infos","Infos"],["dienste","Dienste"],["kasse","Kasse"]]," ktabs");
}
function vTeamTab(){
  const k=S.ui.kTab;tmNach();
  const kopf=`<div class="narrow"><h2 class="page-h">Kader</h2>${kaderReiter()}`;
  if(fgHinweis())return kopf+`<p class="hint">${esc(fgHinweis())}</p></div>`;
  if(TM.err)return kopf+`<div class="warn">${esc(TM.err)}</div><div class="row-actions"><button class="btn" data-act="tmReload">Erneut laden</button></div></div>`;
  if(!TM.t)return kopf+'<p class="hint">Wird geladen …</p></div>';
  const body=k==="termine"?vTermine():k==="infos"?vInfos():k==="dienste"?vDienste():vKasse();
  return kopf+body+"</div>";
}

/* ---------- Termine ---------- */
function terminStatus(tm){
  const z=TM.zusagen.filter(x=>x.termin_id===tm.id);const by=Object.fromEntries(z.map(x=>[x.spielerin_id,x]));
  const team=teamMitZugang().map(x=>x.spielerin_id);const offen=team.filter(pid=>!by[pid]);
  return {z,by,ja:z.filter(x=>x.status==="ja"),nein:z.filter(x=>x.status==="nein"),viel:z.filter(x=>x.status==="vielleicht"),offen};
}
function vTermine(){
  const jetzt=Date.now();const kommend=TM.termine.filter(t=>Date.parse(t.beginn)>=jetzt-3*3600e3),vergangen=TM.termine.filter(t=>Date.parse(t.beginn)<jetzt-3*3600e3).reverse();
  const karte=tm=>{const st=terminStatus(tm);const open=S.ui.open["tm"+tm.id];
    const liste=(arr,titel,mitGrund)=>arr.length?`<p class="legend" style="margin:8px 0 4px">${titel} (${arr.length})</p><ul class="tml">${arr.map(x=>`<li><b>${esc(nameVon(x.spielerin_id))}</b>${mitGrund&&(x.grund||x.kommentar)?` <span class="src">${esc([x.grund,x.kommentar].filter(Boolean).join(" – "))}${x.auto?" (Abwesenheit)":""}</span>`:""}</li>`).join("")}</ul>`:"";
    return `<div class="fgi tmi${tm.abgesagt?" weg":""}"><button type="button" class="fgkopf" data-act="tmAuf" data-id="${tm.id}" aria-expanded="${!!open}">
      <span class="fgt"><b>${esc(tm.titel||ARTTXT[tm.art])}</b>${tm.abgesagt?' <span class="bd warnbd">abgesagt</span>':""}</span>
      <span class="src">${esc(terminZeit(tm))}${tm.treffen?` · Treffen ${esc(tm.treffen)}`:""}${tm.ort?` · ${esc(tm.ort)}`:""}</span>
      <span class="fgstat"><span class="ok">✓ ${st.ja.length}</span><span>✗ ${st.nein.length}</span><span>? ${st.viel.length}</span><span>– ${st.offen.length} offen</span></span></button>
      ${open?`<div class="fgdet">${tm.hinweis?`<p class="fgtext">${esc(tm.hinweis)}</p>`:""}
        ${liste(st.ja,"Zusagen",false)}${liste(st.viel,"Vielleicht",true)}${liste(st.nein,"Absagen",true)}
        ${st.offen.length?`<p class="legend" style="margin:8px 0 4px">Noch keine Antwort (${st.offen.length})</p><p style="margin:0">${st.offen.map(pid=>esc(nameVon(pid))).join(", ")}</p>`:""}
        ${tm.aufstellung?'<p class="legend" style="margin:10px 0 4px">Aufstellung ist für die Spielerinnen veröffentlicht.</p>':""}
        <div class="row-actions">${!tm.abgesagt&&st.offen.length?`<button class="btn sm pri" data-act="tmErinnern" data-id="${tm.id}">Offene erinnern (${st.offen.length})</button>`:""}
          ${tm.art==="training"?`<button class="btn sm" data-act="tmUebernehmen" data-id="${tm.id}">In Anwesenheit übernehmen</button>`:""}
          <button class="btn sm" data-act="tmEdit" data-id="${tm.id}">Bearbeiten</button>
          <button class="btn sm" data-act="tmAbsagen" data-id="${tm.id}">${tm.abgesagt?"Wieder ansetzen":"Termin absagen"}</button>
          <button class="btn sm ghost danger" data-act="tmDel" data-id="${tm.id}">Löschen</button></div></div>`:""}</div>`;};
  const abw=TM.abw.map(a=>`<li><b>${esc(nameVon(a.spielerin_id))}</b> <span class="src">${esc(kurzTag(a.von))}${a.bis!==a.von?" – "+esc(kurzTag(a.bis)):""}${a.grund?" · "+esc(a.grund):""}</span><button class="iconbtn mini" data-act="abwDel" data-id="${a.id}" aria-label="Abwesenheit löschen">✕</button></li>`).join("");
  return `<p class="hint">Spielerinnen mit Zugang sagen in ihrer Ansicht zu oder ab. Erinnerungen gehen per Benachrichtigung an alle, die noch nicht geantwortet haben.</p>
    <div class="row-actions" style="margin-top:0"><button class="btn sm pri" data-act="tmNeu">Neuer Termin</button><button class="btn sm" data-act="tmSerie">Trainingsserie anlegen</button><button class="btn sm" data-act="tmAusApp">Aus Trainings & Spielen übernehmen</button><button class="btn sm ghost" data-act="tmReload">Aktualisieren</button></div>
    <section class="blk"><h3>Kommende Termine <span class="sub">${kommend.length}</span></h3>${kommend.length?`<div class="fglist">${kommend.map(karte).join("")}</div>`:'<p class="hint">Noch keine Termine. Lege eine Trainingsserie an oder übernimm geplante Trainings und Spiele.</p>'}</section>
    <section class="blk"><h3>Abwesenheiten <span class="sub">${TM.abw.length}</span></h3><p class="hint" style="margin-top:0">Eingetragene Abwesenheiten sagen alle Termine in dem Zeitraum automatisch ab.</p>
      ${abw?`<ul class="hist abwl">${abw}</ul>`:'<p class="hint">Keine aktuellen Abwesenheiten.</p>'}
      <div class="row-actions"><button class="btn sm" data-act="abwNeu">Abwesenheit eintragen</button></div></section>
    ${vergangen.length?`<details class="fold"><summary>Vergangene Termine (${vergangen.length})</summary><div class="fglist">${vergangen.map(karte).join("")}</div></details>`:""}
    ${kalenderBlock()}`;
}
/* Termin-Fenster: neu oder bearbeiten */
function tmDialog(tm){
  const d=tm?{art:tm.art,titel:tm.titel,datum:lokTag(tm.beginn),zeit:lokZeit(tm.beginn),treffen:tm.treffen,ort:tm.ort,hinweis:tm.hinweis,frist:tm.frist?String(Math.round((Date.parse(tm.beginn)-Date.parse(tm.frist))/3600e3)):""}:{art:"training",titel:"Training",datum:nextTrainingDay(),zeit:teamCfg().start||"19:00",treffen:"",ort:"",hinweis:"",frist:""};
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="Termin"><h3>${tm?"Termin bearbeiten":"Neuer Termin"} <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
    <div class="meta"><label class="f">Art<select id="tmArt">${opt([["training","Training"],["spiel","Spiel"],["sonstiges","Sonstiges"]],d.art)}</select></label>
     <label class="f">Titel<input class="inp" id="tmTitel" value="${esc(d.titel)}" placeholder="z. B. Spiel gegen TSV"></label></div>
    <div class="meta"><label class="f">Datum<input type="date" id="tmDatum" value="${esc(d.datum)}"></label><label class="f">Beginn / Anstoß<input type="time" id="tmZeit" value="${esc(d.zeit)}"></label>
     <label class="f">Treffen<input class="inp" id="tmTreffen" value="${esc(d.treffen)}" placeholder="z. B. 13:45"></label></div>
    <label class="f">Ort<input class="inp" id="tmOrt" value="${esc(d.ort)}" placeholder="z. B. Sportplatz Oedheim"></label>
    <label class="f" style="margin-top:10px">Hinweis<textarea class="inp" id="tmHinweis" rows="2" placeholder="z. B. schwarze Trikots mitbringen">${esc(d.hinweis)}</textarea></label>
    <label class="f" style="margin-top:10px">Antworten bis<select id="tmFrist">${opt([["","bis zum Beginn"],["2","2 Stunden vorher"],["12","12 Stunden vorher"],["24","1 Tag vorher"],["48","2 Tage vorher"]],d.frist)}</select></label>
    <div class="row-actions"><button class="btn pri" data-act="tmSpeichern" data-id="${tm?tm.id:""}">Speichern</button></div></div></div>`;
}
function tmSerieDialog(){
  const sv=saisonVon(new Date()),ende=dayShift(`${+sv.slice(0,4)+1}-${sv.slice(5)}`,-1);
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="Trainingsserie"><h3>Trainingsserie anlegen <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
    <p class="hint">Legt für jeden gewählten Wochentag im Zeitraum einen Trainingstermin an. Schon vorhandene Termine am selben Tag werden übersprungen.</p>
    <div class="chips" id="tmTage">${["Mo","Di","Mi","Do","Fr","Sa","So"].map((t,i)=>`<label class="chip tag"><input type="checkbox" value="${(i+1)%7}"${[2,4].includes((i+1)%7)?" checked":""}> ${t}</label>`).join("")}</div>
    <div class="meta"><label class="f">Uhrzeit<input type="time" id="srZeit" value="${esc(teamCfg().start||"19:00")}"></label><label class="f">Von<input type="date" id="srVon" value="${today()}"></label><label class="f">Bis<input type="date" id="srBis" value="${esc(ende)}"></label></div>
    <label class="f">Ort<input class="inp" id="srOrt" placeholder="z. B. Sportplatz Oedheim"></label>
    <div class="row-actions"><button class="btn pri" data-act="tmSerieAnlegen">Anlegen</button></div></div></div>`;
}
function abwDialog(){
  const ps=players().slice().sort((a,b)=>a.name.localeCompare(b.name));
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="Abwesenheit"><h3>Abwesenheit eintragen <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
    <label class="f">Spielerin<select id="abwSp">${opt(ps.map(p=>[p.id,p.name]),"")}</select></label>
    <div class="meta"><label class="f">Von<input type="date" id="abwVon" value="${today()}"></label><label class="f">Bis<input type="date" id="abwBis" value="${today()}"></label>
     <label class="f">Grund<select id="abwGrund">${opt(GRUENDE_SP.map(g=>[g,g]),"Urlaub")}</select></label></div>
    <div class="row-actions"><button class="btn pri" data-act="abwSpeichern">Speichern</button></div></div></div>`;
}
const isoAus=(datum,zeit)=>new Date(`${datum}T${zeit||"00:00"}`).toISOString();
async function tmSpeichern(id){
  const datum=$("#tmDatum").value,zeit=$("#tmZeit").value||"00:00";if(!datum){toast("Bitte ein Datum wählen.");return;}
  const beginn=isoAus(datum,zeit),fr=$("#tmFrist").value;
  const daten={art:$("#tmArt").value,titel:$("#tmTitel").value.trim()||ARTTXT[$("#tmArt").value],beginn,treffen:$("#tmTreffen").value.trim(),ort:$("#tmOrt").value.trim(),hinweis:$("#tmHinweis").value.trim(),frist:fr?new Date(Date.parse(beginn)-(+fr)*3600e3).toISOString():null};
  $("#overlay").innerHTML="";
  await tmAktion(()=>id?tmApi(`/rest/v1/termine?id=eq.${id}`,"PATCH",daten):tmApi("/rest/v1/termine","POST",Object.assign({team:SB.state.team},daten)),"Termin gespeichert");
}
async function tmSerieAnlegen(){
  const tage=[...document.querySelectorAll("#tmTage input:checked")].map(x=>+x.value);const zeit=$("#srZeit").value||"19:00",von=$("#srVon").value,bis=$("#srBis").value,ort=$("#srOrt").value.trim();
  if(!tage.length||!von||!bis||bis<von){toast("Bitte Wochentage und einen gültigen Zeitraum wählen.");return;}
  const belegt=new Set(TM.termine.filter(t=>t.art==="training").map(t=>lokTag(t.beginn)));const neu=[];
  for(let d=von;d<=bis;d=dayShift(d,1)){if(tage.includes(new Date(d+"T12:00").getDay())&&!belegt.has(d))neu.push({team:SB.state.team,art:"training",titel:"Training",beginn:isoAus(d,zeit),ort});if(neu.length>200)break;}
  $("#overlay").innerHTML="";if(!neu.length){toast("Keine neuen Termine – alle Tage sind schon belegt.");return;}
  await tmAktion(()=>tmApi("/rest/v1/termine","POST",neu),`${neu.length} Trainingstermine angelegt`);
}
/* Termine für geplante Trainings und Spiele der App anlegen (falls noch keiner am selben Tag/derselben Art existiert) */
async function tmAusApp(){
  const heute=today();const vorhanden=new Set(TM.termine.map(t=>t.art+"|"+lokTag(t.beginn)));const quellen=new Set(TM.termine.map(t=>t.quelle).filter(Boolean));const neu=[];
  ofTeam("trainings").forEach(([id,t])=>{if(!t.datum||t.datum<heute||quellen.has(id)||vorhanden.has("training|"+t.datum))return;neu.push({team:SB.state.team,art:"training",titel:t.thema||"Training",beginn:isoAus(t.datum,t.start||teamCfg().start||"19:00"),quelle:id});});
  ofTeam("spiele").forEach(([id,s])=>{if(!s.datum||s.datum<heute||quellen.has(id)||vorhanden.has("spiel|"+s.datum))return;neu.push({team:SB.state.team,art:"spiel",titel:`Spiel gegen ${s.gegner||"?"}`,beginn:isoAus(s.datum,"15:00"),quelle:id,hinweis:"Anstoßzeit bitte prüfen"});});
  if(!neu.length){toast("Alle geplanten Trainings und Spiele haben schon einen Termin.");return;}
  await tmAktion(()=>tmApi("/rest/v1/termine","POST",neu),`${neu.length} Termine übernommen – bei Spielen bitte die Anstoßzeit prüfen`);
}
/* Zusagen in die Anwesenheit des Trainings am selben Tag übernehmen */
function trainingZuTermin(tm){const tag=lokTag(tm.beginn);return (tm.quelle&&S.trainings[tm.quelle]?[tm.quelle,S.trainings[tm.quelle]]:ofTeam("trainings").find(([,t])=>t.datum===tag))||null;}
function zusagenUebernehmen(tm){
  const tr=trainingZuTermin(tm);if(!tr){toast("Für diesen Tag gibt es noch kein Training in der App.");return false;}
  const [tid,t]=tr;const st=terminStatus(tm);t.anwesenheit=t.anwesenheit||{};let n=0;
  st.ja.forEach(x=>{if(pById(x.spielerin_id)){t.anwesenheit[x.spielerin_id]="ja";if(t.gruende)delete t.gruende[x.spielerin_id];n++;}});
  st.nein.forEach(x=>{if(pById(x.spielerin_id)){t.anwesenheit[x.spielerin_id]="nein";t.gruende=t.gruende||{};t.gruende[x.spielerin_id]={grund:(S.settings.gruende||[]).includes(x.grund)?x.grund:"Sonstiges",notiz:[x.grund,x.kommentar].filter(Boolean).join(" – ")};n++;}});
  saveLater("training",tid);toast(`${n} Antworten in die Anwesenheit vom ${fmtDate(t.datum)} übernommen`);return true;
}
/* Zeile im Training (Bereich Anwesenheit) */
function terminTrainingZeile(tid,t){
  if(!tmBereit()||!t.datum)return "";tmNach();const tm=TM.termine.find(x=>x.quelle===tid)||TM.termine.find(x=>x.art==="training"&&lokTag(x.beginn)===t.datum);
  if(!tm)return "";const st=terminStatus(tm);
  return `<div class="tmzeile"><span>Zu-/Absagen: <b class="ok">✓ ${st.ja.length}</b> · ✗ ${st.nein.length} · ? ${st.viel.length} · – ${st.offen.length} offen</span><button class="btn sm" data-act="tmUebernehmen" data-id="${tm.id}">Übernehmen</button></div>`;
}
/* Aufstellung für Spielerinnen veröffentlichen (Knopf im Spielbericht) */
function terminAufstellungKnopf(sid){return tmBereit()?`<button class="btn sm pri" data-act="aufVeroeff" data-sid="${sid}">Für Spielerinnen veröffentlichen</button>`:"";}
async function aufVeroeffentlichen(sid){
  const s=S.spiele[sid];if(!s)return;await tmLaden();
  let tm=TM.termine.find(x=>x.quelle===sid)||TM.termine.find(x=>x.art==="spiel"&&s.datum&&lokTag(x.beginn)===s.datum);
  const daten=aufstellungDaten(s);
  try{
    if(!tm){if(!s.datum){toast("Bitte zuerst ein Datum für das Spiel eintragen.");return;}
      const r=await tmApi("/rest/v1/termine","POST",{team:SB.state.team,art:"spiel",titel:`Spiel gegen ${s.gegner||"?"}`,beginn:isoAus(s.datum,"15:00"),quelle:sid,hinweis:"Anstoßzeit bitte prüfen",aufstellung:daten},{headers:{Prefer:"return=representation"}});tm=r&&r[0];}
    else await tmApi(`/rest/v1/termine?id=eq.${tm.id}`,"PATCH",{aufstellung:daten});
    toast("Aufstellung veröffentlicht – die Spielerinnen sehen sie beim Termin");await tmLaden(true);
  }catch(e){toast("Fehler: "+(e.message||""));}
}

/* ---------- Infos: Mitteilungen und Umfragen ---------- */
function vInfos(){
  const n=teamMitZugang().length;
  const mitt=TM.mitt.map(m=>{const gel=TM.mittGel.filter(g=>g.mitteilung_id===m.id).map(g=>g.spielerin_id);const open=S.ui.open["mt"+m.id];
    return `<div class="fgi"><button type="button" class="fgkopf" data-act="mtAuf" data-id="${m.id}" aria-expanded="${!!open}"><span class="fgt"><b>${esc(m.titel)}</b>${m.wichtig?' <span class="bd warnbd">wichtig</span>':""}</span>
      <span class="src">${esc(fmtStamp(Date.parse(m.erstellt_am)))}</span><span class="fgstat"><span class="${gel.length>=n&&n?"ok":""}">👁 ${gel.length}/${n} gelesen</span></span></button>
      ${open?`<div class="fgdet"><p class="fgtext">${esc(m.text)}</p>${n-gel.length>0?`<p class="legend">Noch nicht gelesen: ${teamMitZugang().filter(z=>!gel.includes(z.spielerin_id)).map(z=>esc(nameVon(z.spielerin_id))).join(", ")}</p>`:""}
        <div class="row-actions"><button class="btn sm ghost danger" data-act="mtDel" data-id="${m.id}">Löschen</button></div></div>`:""}</div>`;}).join("");
  const umf=TM.umf.map(u=>{const teil=TM.umfTeil.filter(x=>x.umfrage_id===u.id).length;const open=S.ui.open["uf"+u.id];const erg=TM.umfErg[u.id];const zu=u.geschlossen||(u.ende&&Date.parse(u.ende)<Date.now());
    const opts=(u.optionen||[]);const max=Math.max(1,...(erg||[]).map(e=>e.anzahl));
    return `<div class="fgi"><button type="button" class="fgkopf" data-act="ufAuf" data-id="${u.id}" aria-expanded="${!!open}"><span class="fgt"><b>${esc(u.frage)}</b>${zu?' <span class="bd">beendet</span>':""}${u.anonym?' <span class="bd">anonym</span>':""}</span>
      <span class="src">${teil} von ${n} haben abgestimmt${u.mehrfach?" · Mehrfachauswahl":""}${u.ende?` · bis ${esc(fmtStamp(Date.parse(u.ende)))}`:""}</span></button>
      ${open?`<div class="fgdet">${erg?`<div class="hbars">${opts.map((o,i)=>{const e=erg.find(x=>x.option===i)||{anzahl:0,namen:[]};return `<div class="hrow"><span class="hl">${esc(o)}</span><span class="hb"><i style="width:${e.anzahl/max*100}%"></i></span><span class="hv"><b>${e.anzahl}</b></span></div>${!u.anonym&&e.namen&&e.namen.length?`<p class="legend" style="margin:0 0 6px">${e.namen.map(esc).join(", ")}</p>`:""}`;}).join("")}</div>`:'<p class="hint">Ergebnis wird geladen …</p>'}
        <div class="row-actions"><button class="btn sm" data-act="ufZu" data-id="${u.id}">${u.geschlossen?"Wieder öffnen":"Umfrage beenden"}</button><button class="btn sm ghost danger" data-act="ufDel" data-id="${u.id}">Löschen</button></div></div>`:""}</div>`;}).join("");
  return `<section class="blk"><h3>Mitteilungen <span class="sub">an alle mit Zugang</span></h3>
     <label class="f">Titel<input class="inp" id="mtTitel" placeholder="z. B. Training fällt aus"></label>
     <label class="f" style="margin-top:8px">Text<textarea class="inp" id="mtText" rows="3" placeholder="Was sollen alle wissen?"></textarea></label>
     <label class="cbrow"><input type="checkbox" id="mtWichtig"> Als wichtig markieren</label><label class="cbrow"><input type="checkbox" id="mtPush" checked> Benachrichtigung senden</label>
     <div class="row-actions"><button class="btn pri" data-act="mtSenden">Mitteilung senden</button></div>
     ${mitt?`<div class="fglist" style="margin-top:14px">${mitt}</div>`:""}</section>
   <section class="blk"><h3>Umfragen</h3>
     <label class="f">Frage<input class="inp" id="ufFrage" placeholder="z. B. Welcher Termin fürs Teamevent?"></label>
     <label class="f" style="margin-top:8px">Antworten (eine pro Zeile)<textarea class="inp" id="ufOpt" rows="4" placeholder="Freitag, 14.6.&#10;Samstag, 15.6."></textarea></label>
     <label class="cbrow"><input type="checkbox" id="ufMehr"> Mehrere Antworten erlaubt</label><label class="cbrow"><input type="checkbox" id="ufAnon"> Anonym (niemand sieht, wer was gewählt hat – auch du nicht)</label>
     <div class="meta"><label class="f">Endet am (optional)<input type="date" id="ufEnde"></label></div>
     <label class="cbrow"><input type="checkbox" id="ufPush" checked> Benachrichtigung senden</label>
     <div class="row-actions"><button class="btn pri" data-act="ufStarten">Umfrage starten</button></div>
     ${umf?`<div class="fglist" style="margin-top:14px">${umf}</div>`:""}</section>`;
}

/* ---------- Dienste ---------- */
function vDienste(){
  const zug=teamMitZugang();const titel=[...new Set(TM.dienste.map(d=>d.titel))];
  const zeile=d=>`<li class="dzl${d.erledigt?" erl":""}"><span><b>${esc(kurzTag(d.datum))}</b> ${esc(d.titel)}</span>
    <select data-act="dnSp" data-id="${d.id}" aria-label="Wer?">${opt([["","– offen –"],...players().slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>[p.id,p.name])],d.spielerin_id||"")}</select>
    <span class="ctl"><button class="btn sm${d.erledigt?" pri":""}" data-act="dnErl" data-id="${d.id}">${d.erledigt?"✓ erledigt":"offen"}</button><button class="iconbtn mini" data-act="dnDel" data-id="${d.id}" aria-label="Löschen">✕</button></span></li>`;
  return `<section class="blk"><h3>Dienste <span class="sub">${TM.dienste.length}</span></h3>
    <p class="hint" style="margin-top:0">z. B. Trikots waschen, Getränke, Bälle. Spielerinnen sehen ihre Dienste, können sie abgeben oder offene übernehmen.</p>
    ${TM.dienste.length?`<ul class="hist dl">${TM.dienste.map(zeile).join("")}</ul>`:'<p class="hint">Noch keine Dienste.</p>'}</section>
   <section class="blk"><h3>Reihum einteilen</h3>
    <div class="meta"><label class="f">Dienst<input class="inp" id="dnTitel" list="dnTitelListe" placeholder="z. B. Trikots waschen"><datalist id="dnTitelListe">${titel.map(t=>`<option value="${esc(t)}">`).join("")}</datalist></label>
     <label class="f">Für<select id="dnArt">${opt([["spiel","jedes Spiel"],["training","jedes Training"],["alle","jeden Termin"]],"spiel")}</select></label>
     <label class="f">Anzahl<select id="dnAnz">${opt([["4","nächste 4"],["8","nächste 8"],["12","nächste 12"],["20","nächste 20"]],"8")}</select></label></div>
    <p class="legend">Eingeteilt wird reihum unter den ${zug.length} Spielerinnen mit Zugang – wer zuletzt dran war, kommt später.</p>
    <div class="row-actions"><button class="btn pri" data-act="dnReihum">Einteilen</button><button class="btn" data-act="dnEinzeln">Einzelnen Dienst anlegen</button></div></section>`;
}
async function dienstReihum(){
  const titel=$("#dnTitel").value.trim(),art=$("#dnArt").value,anz=+$("#dnAnz").value;if(!titel){toast("Bitte den Dienst benennen.");return;}
  const zug=teamMitZugang().map(z=>z.spielerin_id).sort((a,b)=>nameVon(a).localeCompare(nameVon(b)));if(!zug.length){toast("Noch keine Spielerin mit Zugang.");return;}
  const schon=new Set(TM.dienste.filter(d=>d.titel===titel).map(d=>d.termin_id));
  const tms=TM.termine.filter(t=>!t.abgesagt&&Date.parse(t.beginn)>Date.now()&&(art==="alle"||t.art===art)&&!schon.has(t.id)).slice(0,anz);
  if(!tms.length){toast("Keine passenden kommenden Termine ohne diesen Dienst.");return;}
  const letzte=TM.dienste.filter(d=>d.titel===titel&&d.spielerin_id).sort((a,b)=>a.datum.localeCompare(b.datum)).map(d=>d.spielerin_id);
  const reihe=zug.slice().sort((a,b)=>letzte.lastIndexOf(a)-letzte.lastIndexOf(b));
  const neu=tms.map((t,i)=>({team:SB.state.team,titel,datum:lokTag(t.beginn),termin_id:t.id,spielerin_id:reihe[i%reihe.length]}));
  await tmAktion(()=>tmApi("/rest/v1/dienste","POST",neu),`${neu.length} Dienste eingeteilt`);
}

/* ---------- Kasse ---------- */
function vKasse(){
  const salden={};TM.buch.forEach(b=>salden[b.spielerin_id]=(salden[b.spielerin_id]||0)+Number(b.betrag));
  const ps=players().slice().sort((a,b)=>a.name.localeCompare(b.name));const offen=Object.values(salden).filter(v=>v>0).reduce((a,v)=>a+v,0);
  return `<section class="blk"><h3>Mannschaftskasse <span class="sub">offen: ${euro(offen)}</span></h3>
    <p class="hint" style="margin-top:0">Nur eine Übersicht – bezahlt wird wie bisher bar oder per Überweisung. Jede Spielerin sieht nur ihren eigenen Stand.</p>
    <div class="meta"><label class="f">Spielerin<select id="ksSp">${opt(ps.map(p=>[p.id,p.name]),S.ui.ksSp||"")}</select></label>
     <label class="f">Aus dem Katalog<select id="ksKat">${opt([["","– freie Eingabe –"],...TM.kat.map(k=>[k.id,`${k.titel} (${euro(Number(k.betrag))})`])],"")}</select></label></div>
    <div class="meta"><label class="f">Bezeichnung<input class="inp" id="ksTitel" placeholder="z. B. Zu spät zum Training"></label><label class="f">Betrag (€)<input class="inp" id="ksBetrag" inputmode="decimal" placeholder="2,00"></label></div>
    <div class="row-actions"><button class="btn pri" data-act="ksStrafe">Eintragen (offen)</button><button class="btn" data-act="ksZahlung">Zahlung eintragen</button></div></section>
   <section class="blk"><h3>Stand je Spielerin</h3>${Object.keys(salden).length?`<ul class="hist ksl">${Object.entries(salden).sort((a,b)=>b[1]-a[1]).map(([pid,v])=>`<li><b>${esc(nameVon(pid))}</b><span class="${v>0?"warnc":"ok"}">${v>0?"offen ":""}${euro(Math.abs(v))}${v<0?" Guthaben":""}</span><button class="btn sm ghost" data-act="ksAuf" data-id="${pid}">Buchungen</button></li>${S.ui.open["ks"+pid]?`<li class="ksdet"><ul>${TM.buch.filter(b=>b.spielerin_id===pid).map(b=>`<li>${esc(kurzTag(b.datum))} · ${esc(b.titel)} · <b>${Number(b.betrag)>0?"":"−"}${euro(Math.abs(Number(b.betrag)))}</b> <button class="iconbtn mini" data-act="ksDel" data-id="${b.id}" aria-label="Löschen">✕</button></li>`).join("")}</ul></li>`:""}`).join("")}</ul>`:'<p class="hint">Noch keine Buchungen.</p>'}</section>
   <section class="blk"><h3>Strafenkatalog</h3>${TM.kat.length?`<ul class="hist">${TM.kat.map(k=>`<li><b>${esc(k.titel)}</b><span>${euro(Number(k.betrag))}</span><button class="iconbtn mini" data-act="katDel" data-id="${k.id}" aria-label="Löschen">✕</button></li>`).join("")}</ul>`:'<p class="hint">Noch leer.</p>'}
    <div class="meta"><label class="f">Bezeichnung<input class="inp" id="katTitel" placeholder="z. B. Gelbe Karte wegen Meckern"></label><label class="f">Betrag (€)<input class="inp" id="katBetrag" inputmode="decimal" placeholder="5,00"></label></div>
    <div class="row-actions"><button class="btn" data-act="katNeu">Zum Katalog hinzufügen</button></div></section>`;
}
const betragLesen=v=>{const n=parseFloat(String(v||"").replace(/\s|€/g,"").replace(",","."));return isNaN(n)?null:Math.round(n*100)/100;};

/* ---------- Bedienung ---------- */
$("#app").addEventListener("click",async e=>{const el=e.target.closest("[data-act]");if(!el||SB.istSpielerin())return;const a=el.dataset.act,id=el.dataset.id;
  const tm=id&&TM.termine.find(x=>x.id===id);
  if(a==="kTab"){S.ui.kTab=el.dataset.v;S.sel.spielerin=null;S.ui.fbView=false;if(el.dataset.v!=="spielerinnen")tmLaden();render();return;}
  if(a==="tmReload")tmLaden(true);
  if(a==="tmAuf"){S.ui.open["tm"+id]=!S.ui.open["tm"+id];render();}
  if(a==="tmNeu")tmDialog(null);
  if(a==="tmEdit"&&tm)tmDialog(tm);
  if(a==="tmSerie")tmSerieDialog();
  if(a==="tmAusApp")tmAusApp();
  if(a==="tmUebernehmen"){if(!TM.t)await tmLaden();const t2=TM.termine.find(x=>x.id===id);if(t2&&zusagenUebernehmen(t2))render();}
  if(a==="tmErinnern"&&tm){el.disabled=true;try{const r=await pushFn({aktion:"termin_erinnern",id});toast(r.gesendet?`Erinnerung an ${r.spielerinnen} Spielerin${r.spielerinnen===1?"":"nen"} gesendet`:"Niemand erreichbar – die Offenen haben keine Benachrichtigungen eingeschaltet.");}catch(err){toast("Fehler: "+(err.message||""));}el.disabled=false;}
  if(a==="tmAbsagen"&&tm){const neu=!tm.abgesagt;if(neu&&!confirmDel(`„${tm.titel}“ am ${terminZeit(tm)} absagen?\n\nAlle mit Benachrichtigungen bekommen eine Nachricht.`))return;
    await tmAktion(()=>tmApi(`/rest/v1/termine?id=eq.${id}`,"PATCH",{abgesagt:neu}),neu?"Termin abgesagt":"Termin wieder angesetzt");
    if(neu)pushFn({aktion:"an_alle",titel:`Abgesagt: ${tm.titel}`,text:terminZeit(tm),tag:"tm-"+id}).catch(()=>{});}
  if(a==="tmDel"&&tm){if(!confirmDel(`Termin „${tm.titel}“ löschen? Alle Zu- und Absagen dazu werden gelöscht.`))return;await tmAktion(()=>tmApi(`/rest/v1/termine?id=eq.${id}`,"DELETE"),"Gelöscht");}
  if(a==="abwNeu")abwDialog();
  if(a==="abwDel"){if(!confirmDel("Abwesenheit löschen? Automatische Absagen dazu werden entfernt."))return;await tmAktion(()=>tmApi(`/rest/v1/abwesenheiten?id=eq.${id}`,"DELETE"),"Gelöscht");}
  if(a==="mtAuf"){S.ui.open["mt"+id]=!S.ui.open["mt"+id];render();}
  if(a==="mtSenden"){const titel=$("#mtTitel").value.trim(),text=$("#mtText").value.trim();if(!titel){toast("Bitte einen Titel eingeben.");return;}
    const push=$("#mtPush").checked;el.disabled=true;await tmAktion(()=>tmApi("/rest/v1/mitteilungen","POST",{team:SB.state.team,titel,text,wichtig:$("#mtWichtig").checked}),"Mitteilung gesendet");
    if(push)pushFn({aktion:"an_alle",titel,text:text.slice(0,120),tag:"mitteilung"}).catch(()=>{});}
  if(a==="mtDel"){if(!confirmDel("Mitteilung löschen?"))return;await tmAktion(()=>tmApi(`/rest/v1/mitteilungen?id=eq.${id}`,"DELETE"),"Gelöscht");}
  if(a==="ufAuf"){S.ui.open["uf"+id]=!S.ui.open["uf"+id];render();if(S.ui.open["uf"+id]){try{TM.umfErg[id]=await SB.api("/rest/v1/rpc/umfrage_ergebnis",{method:"POST",body:JSON.stringify({p_umfrage:id})})||[];}catch(err){TM.umfErg[id]=[];}render();}}
  if(a==="ufStarten"){const frage=$("#ufFrage").value.trim(),opts=$("#ufOpt").value.split("\n").map(x=>x.trim()).filter(Boolean);
    if(!frage||opts.length<2){toast("Bitte eine Frage und mindestens zwei Antworten eingeben.");return;}
    const ende=$("#ufEnde").value?new Date($("#ufEnde").value+"T23:59").toISOString():null;const push=$("#ufPush").checked;
    await tmAktion(()=>tmApi("/rest/v1/umfragen","POST",{team:SB.state.team,frage,optionen:opts,mehrfach:$("#ufMehr").checked,anonym:$("#ufAnon").checked,ende}),"Umfrage gestartet");
    if(push)pushFn({aktion:"an_alle",titel:"Neue Umfrage",text:frage,tag:"umfrage"}).catch(()=>{});}
  if(a==="ufZu"){const u=TM.umf.find(x=>x.id===id);if(u)await tmAktion(()=>tmApi(`/rest/v1/umfragen?id=eq.${id}`,"PATCH",{geschlossen:!u.geschlossen}),u.geschlossen?"Wieder geöffnet":"Umfrage beendet");}
  if(a==="ufDel"){if(!confirmDel("Umfrage mit allen Stimmen löschen?"))return;await tmAktion(()=>tmApi(`/rest/v1/umfragen?id=eq.${id}`,"DELETE"),"Gelöscht");}
  if(a==="dnErl"){const d=TM.dienste.find(x=>x.id===id);if(d)await tmAktion(()=>tmApi(`/rest/v1/dienste?id=eq.${id}`,"PATCH",{erledigt:!d.erledigt}));}
  if(a==="dnDel"){if(!confirmDel("Dienst löschen?"))return;await tmAktion(()=>tmApi(`/rest/v1/dienste?id=eq.${id}`,"DELETE"),"Gelöscht");}
  if(a==="dnReihum")dienstReihum();
  if(a==="dnEinzeln"){const titel=$("#dnTitel").value.trim();if(!titel){toast("Bitte oben den Dienst benennen.");return;}
    await tmAktion(()=>tmApi("/rest/v1/dienste","POST",{team:SB.state.team,titel,datum:today()}),"Dienst angelegt – Datum und Person in der Liste anpassen");}
  if(a==="ksStrafe"||a==="ksZahlung"){const sp=$("#ksSp").value;const kat=TM.kat.find(k=>k.id===$("#ksKat").value);
    let titel=$("#ksTitel").value.trim()||(kat?kat.titel:""),betrag=betragLesen($("#ksBetrag").value);if(betrag===null&&kat)betrag=Number(kat.betrag);
    if(a==="ksZahlung")titel=titel||"Zahlung";if(!sp||!titel||!betrag){toast("Bitte Spielerin, Bezeichnung und Betrag angeben.");return;}
    S.ui.ksSp=sp;await tmAktion(()=>tmApi("/rest/v1/kasse_buchungen","POST",{team:SB.state.team,spielerin_id:sp,titel,betrag:a==="ksZahlung"?-Math.abs(betrag):Math.abs(betrag)}),a==="ksZahlung"?"Zahlung eingetragen":"Eingetragen");}
  if(a==="ksAuf"){S.ui.open["ks"+id]=!S.ui.open["ks"+id];render();}
  if(a==="ksDel"){if(!confirmDel("Buchung löschen?"))return;await tmAktion(()=>tmApi(`/rest/v1/kasse_buchungen?id=eq.${id}`,"DELETE"),"Gelöscht");}
  if(a==="katNeu"){const titel=$("#katTitel").value.trim(),betrag=betragLesen($("#katBetrag").value);if(!titel||betrag===null){toast("Bitte Bezeichnung und Betrag eingeben.");return;}
    await tmAktion(()=>tmApi("/rest/v1/kasse_katalog","POST",{team:SB.state.team,titel,betrag:Math.abs(betrag)}),"Zum Katalog hinzugefügt");}
  if(a==="katDel"){if(!confirmDel("Aus dem Katalog löschen? (Bisherige Buchungen bleiben)"))return;await tmAktion(()=>tmApi(`/rest/v1/kasse_katalog?id=eq.${id}`,"DELETE"),"Gelöscht");}
  if(a==="aufVeroeff")aufVeroeffentlichen(el.dataset.sid);
});
$("#overlay").addEventListener("click",async e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  if(a==="tmSpeichern")tmSpeichern(el.dataset.id);
  if(a==="tmSerieAnlegen")tmSerieAnlegen();
  if(a==="abwSpeichern"){const sp=$("#abwSp").value,von=$("#abwVon").value,bis=$("#abwBis").value;if(!sp||!von||!bis||bis<von){toast("Bitte einen gültigen Zeitraum wählen.");return;}
    const grund=$("#abwGrund").value;$("#overlay").innerHTML="";await tmAktion(()=>tmApi("/rest/v1/abwesenheiten","POST",{team:SB.state.team,spielerin_id:sp,von,bis,grund}),"Abwesenheit eingetragen – Termine im Zeitraum sind abgesagt");}
});
$("#app").addEventListener("change",async e=>{const el=e.target;if(SB.istSpielerin())return;
  if(el.dataset.act==="dnSp")await tmAktion(()=>tmApi(`/rest/v1/dienste?id=eq.${el.dataset.id}`,"PATCH",{spielerin_id:el.value||null,erledigt:false}),"Gespeichert");
  if(el.id==="ksKat"){const k=TM.kat.find(x=>x.id===el.value);if(k){$("#ksTitel").value=k.titel;$("#ksBetrag").value=String(k.betrag).replace(".",",");}}
});
