"use strict";
/* ---------- Freiwilliges Feedback (Phase 8b) ----------
   Liegt nur online in Supabase (Tabelle feedback, siehe supabase-phase8b.sql).
   Spielerinnen senden über die Funktion feedback_senden(): mit Namen oder anonym. Anonym speichert die Datenbank
   nur Thema, Nachricht und Datum – keinen Namen, keine Kennung, keine Uhrzeit. Eigenes anonymes Feedback merkt sich
   nur das Gerät, von dem es kam (localStorage), damit die Spielerin sieht, was sie geschickt hat. */
const THEMEN=[["training","Training"],["spiele","Spiele"],["mannschaft","Mannschaft"],["trainerteam","Trainerteam"],["sonstiges","Sonstiges"]];
const themaName=k=>(THEMEN.find(t=>t[0]===k)||[k,k])[1];
const FBSTATUS={neu:"neu",gelesen:"gelesen",erledigt:"erledigt"};
const LS_ANON="tp-anon-feedback";
const anonLokal=()=>{try{return JSON.parse(localStorage.getItem(LS_ANON)||"[]");}catch(e){return [];}};
const kurzTag=d=>d?fmtDate(d).replace(/^\w+, /,""):"";

/* ---------- Spielerin: Feedback geben ---------- */
function fbSpielerinKnopf(){return `<button class="btn sm pri" data-act="fbAuf">Feedback geben</button>`;}
function fbForm(){
  const d=S.ui.fbEntwurf=S.ui.fbEntwurf||{thema:"",text:"",anonym:false};
  return `<section class="blk fbform"><h3>Feedback geben</h3>
    <p class="hint" style="margin-top:0">Lob, Kritik, Ideen – was dir wichtig ist. Du kannst es jederzeit schicken.</p>
    <p class="legend" style="margin:0 0 6px">Worum geht es?</p>
    <div class="chips">${THEMEN.map(([k,l])=>`<button type="button" class="chip tag" data-act="fbThema" data-v="${k}" aria-pressed="${d.thema===k}">${l}</button>`).join("")}</div>
    <label class="f" style="margin-top:12px">Deine Nachricht<textarea class="inp" id="fbText" data-key="fbText" rows="4" maxlength="4000" placeholder="Schreib, was du loswerden möchtest …">${esc(d.text)}</textarea></label>
    <p class="legend" style="margin:12px 0 6px">Absender</p>
    ${seg("fbArt",d.anonym?"anonym":"name",[["name","Mit meinem Namen"],["anonym","Anonym"]])}
    <p class="hint fbhinweis">${d.anonym
      ?"<b>Anonym:</b> Gespeichert werden nur Thema, Nachricht und Datum – kein Name, keine Kennung, keine Uhrzeit. Auch dein Trainerteam kann nicht sehen, von wem es kommt. Ehrlicher Hinweis: Am Inhalt oder Schreibstil kann man dich vielleicht trotzdem erkennen. Eine Antwort ist bei anonymem Feedback nicht möglich."
      :"<b>Mit deinem Namen:</b> Dein Trainerteam sieht, dass es von dir kommt, und kann dir antworten."}</p>
    <div class="row-actions"><button class="btn pri" data-act="fbSenden">Senden</button><button class="btn ghost" data-act="fbZu">Abbrechen</button></div></section>`;
}
function fbMeine(){
  const named=(SP.fb||[]).map(f=>({datum:f.datum,am:f.gesendet_am,thema:f.thema,nachricht:f.nachricht,status:f.status,anonym:false}));
  const anon=anonLokal().map(f=>Object.assign({anonym:true},f));
  const alle=[...named,...anon].sort((a,b)=>(b.am||b.datum||"").localeCompare(a.am||a.datum||""));
  if(!alle.length)return "";
  return `<details class="fold fbmeine" data-dkey="fbmeine"${S.ui.open.dfbmeine?" open":""}><summary>Meine Rückmeldungen (${alle.length})</summary>
    <ul class="hist fbl">${alle.map(f=>`<li><span><b>${esc(themaName(f.thema))}</b> <span class="src">${esc(kurzTag(f.datum))}${f.anonym?" · anonym":""}</span></span>
      <span class="src">${f.anonym?"nur auf diesem Gerät gespeichert":f.status==="neu"?"gesendet":"vom Trainerteam "+esc(FBSTATUS[f.status]||f.status)}</span><div class="fgkom">${esc(f.nachricht)}</div></li>`).join("")}</ul></details>`;
}
async function fbSenden(btn){
  const d=S.ui.fbEntwurf;if(!d)return;const text=(($("#fbText")||{}).value||d.text||"").trim();
  if(!d.thema){toast("Bitte wähle ein Thema.");return;}
  if(!text){toast("Bitte schreib eine Nachricht.");return;}
  if(d.anonym&&!confirmDel("Anonym senden?\n\nDein Name wird nicht gespeichert. Du kannst es danach nicht mehr ändern oder zurückziehen."))return;
  btn.disabled=true;
  try{await SB.api("/rest/v1/rpc/feedback_senden",{method:"POST",body:JSON.stringify({p_thema:d.thema,p_nachricht:text,p_anonym:!!d.anonym})});
    if(d.anonym){const l=anonLokal();l.push({thema:d.thema,nachricht:text,datum:today()});try{localStorage.setItem(LS_ANON,JSON.stringify(l.slice(-50)));}catch(e){}}
    S.ui.fbEntwurf=null;S.ui.fbOffen=false;toast("Danke für dein Feedback!");spLaden(true);}
  catch(e){btn.disabled=false;toast("Nicht gesendet: "+(e.message||"Fehler"));}
}

/* ---------- Trainer: Feedback ansehen ---------- */
const FB={list:[],t:0,loading:false,err:""};
async function fbLaden(force){
  if(!fgBereit()||FB.loading)return;if(!force&&Date.now()-FB.t<30000)return;FB.loading=true;
  try{FB.list=await SB.api(`/rest/v1/feedback?select=*&team=eq.${fgTeam()}&order=datum.desc,gesendet_am.desc.nullslast`)||[];FB.t=Date.now();FB.err="";}
  catch(e){FB.err=navigator.onLine?(e.message||"Laden fehlgeschlagen"):"Offline – Feedback braucht eine Internetverbindung.";}
  finally{FB.loading=false;render();}
}
const fbNach=()=>{if(fgBereit()&&!FB.loading&&Date.now()-FB.t>=30000)setTimeout(()=>fbLaden(),0);};
function fbKaderKnopf(){
  if(!SB.cfgOk()||!SB.st.session)return "";fbNach();const n=FB.list.filter(f=>f.status==="neu").length;
  return `<div class="row-actions" style="margin:0 0 14px"><button class="btn" data-act="fbOffen">Feedback der Spielerinnen${n?` <span class="bd warnbd">${n} neu</span>`:""}</button></div>`;
}
function fbKarte(f){
  const wer=f.anonym?'<span class="bd">anonym</span>':`<b>${esc(pAlle(f.spielerin_id)?pNameAlle(f.spielerin_id):(f.name||"Spielerin"))}</b>`;
  const kannAntworten=!f.anonym&&pAlle(f.spielerin_id);
  return `<div class="fgi fbi${f.status==="erledigt"?" weg":""}"><div class="fbkopf">${wer} <span class="src">${esc(themaName(f.thema))} · ${f.gesendet_am?esc(fmtStamp(Date.parse(f.gesendet_am))):esc(kurzTag(f.datum))}</span>${f.status==="neu"?' <span class="bd warnbd">neu</span>':""}</div>
    <p class="fgtext">${esc(f.nachricht)}</p>
    ${seg("fbStatus",f.status,[["neu","Neu"],["gelesen","Gelesen"],["erledigt","Erledigt"]]).replace(/data-act="fbStatus"/g,`data-act="fbStatus" data-id="${f.id}"`)}
    <label class="f" style="margin-top:10px">Deine Notiz (nur für dich)<textarea class="inp" rows="2" data-key="fbn-${f.id}" data-act="fbNotiz" data-id="${f.id}" placeholder="z. B. am Donnerstag angesprochen">${esc(f.notiz||"")}</textarea></label>
    <div class="row-actions">${kannAntworten?`<button class="btn sm pri" data-act="fbAntwort" data-id="${f.id}">Antworten</button>`:""}<button class="btn sm ghost danger" data-act="fbDel" data-id="${f.id}">Löschen</button></div></div>`;
}
function fbUebersicht(){
  fbNach();fgNach();const st=S.ui.fbFilter||"offen",th=S.ui.fbThemaF||"";
  const l=FB.list.filter(f=>(st==="alle"||(st==="offen"?f.status!=="erledigt":f.status===st))&&(!th||f.thema===th));
  const body=fgHinweis()?`<p class="hint">${esc(fgHinweis())}</p>`:FB.err?`<div class="warn">${esc(FB.err)}</div>`:!FB.t?'<p class="hint">Wird geladen …</p>'
    :l.length?`<div class="fglist">${l.map(fbKarte).join("")}</div>`:`<p class="hint">${FB.list.length?"Kein Feedback passt zum Filter.":"Noch kein Feedback. Spielerinnen mit Zugang können es jederzeit in ihrer Ansicht schicken."}</p>`;
  return `<div class="narrow"><div class="ed-top"><button class="btn ghost" data-act="fbZurueck">← Kader</button></div>
    <h2 class="page-h" style="margin-top:4px">Feedback der Spielerinnen</h2>
    <p class="hint">Freiwillige Rückmeldungen, mit Namen oder anonym. Bei anonymem Feedback speichert die Datenbank keinen Namen und keine Uhrzeit – auch du kannst nicht herausfinden, von wem es kommt.</p>
    ${seg("fbFilter",st,[["offen","Offen"],["neu","Neu"],["erledigt","Erledigt"],["alle","Alle"]])}
    <div class="chips" style="margin:10px 0 14px"><button type="button" class="chip tag" data-act="fbThemaF" data-v="" aria-pressed="${!th}">Alle Themen</button>${THEMEN.map(([k,lab])=>`<button type="button" class="chip tag" data-act="fbThemaF" data-v="${k}" aria-pressed="${th===k}">${lab}</button>`).join("")}</div>
    <div class="row-actions" style="margin-top:0"><button class="btn sm" data-act="fbReload">Aktualisieren</button></div>
    ${body}</div>`;
}
/* Feedback mit Namen bei der Spielerin (Reiter „Freigaben“) */
function fbSpielerinBlock(p){
  if(fgHinweis())return "";fbNach();const l=FB.list.filter(f=>!f.anonym&&f.spielerin_id===p.id);
  return `<section class="blk"><h3>Feedback von ${esc(p.name)} <span class="sub">${l.length}</span></h3>${l.length?`<div class="fglist">${l.map(fbKarte).join("")}</div>`:'<p class="hint">Noch kein Feedback mit Namen. (Anonymes Feedback lässt sich keiner Spielerin zuordnen.)</p>'}</section>`;
}
async function fbPatch(id,daten,msg){
  try{await SB.api(`/rest/v1/feedback?id=eq.${id}`,{method:"PATCH",body:JSON.stringify(daten)});const f=FB.list.find(x=>x.id===id);if(f)Object.assign(f,daten);render();if(msg)toast(msg);}
  catch(e){toast("Nicht gespeichert: "+(e.message||""));}
}

/* ---------- Bedienung ---------- */
$("#app").addEventListener("click",async e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  // Spielerin
  if(SB.istSpielerin()){
    if(a==="fbAuf"){S.ui.fbOffen=true;render();window.scrollTo(0,0);}
    if(a==="fbZu"){S.ui.fbOffen=false;render();}
    if(a==="fbThema"&&S.ui.fbEntwurf){S.ui.fbEntwurf.thema=el.dataset.v;render();}
    if(a==="fbArt"&&S.ui.fbEntwurf){S.ui.fbEntwurf.anonym=el.dataset.v==="anonym";render();}
    if(a==="fbSenden")fbSenden(el);
    return;
  }
  // Trainer
  if(a==="fbOffen"){S.ui.fbView=true;S.sel.spielerin=null;fbLaden(true);render();window.scrollTo(0,0);}
  if(a==="fbZurueck"){S.ui.fbView=false;render();}
  if(a==="fbReload")fbLaden(true);
  if(a==="fbFilter"){S.ui.fbFilter=el.dataset.v;render();}
  if(a==="fbThemaF"){S.ui.fbThemaF=el.dataset.v;render();}
  if(a==="fbStatus"&&el.dataset.id)fbPatch(el.dataset.id,{status:el.dataset.v});
  if(a==="fbDel"){const f=FB.list.find(x=>x.id===el.dataset.id);if(!f||!confirmDel("Dieses Feedback endgültig löschen?"))return;
    try{await SB.api(`/rest/v1/feedback?id=eq.${f.id}`,{method:"DELETE"});FB.list=FB.list.filter(x=>x!==f);render();toast("Gelöscht");}catch(err){toast("Fehler: "+(err.message||""));}}
  if(a==="fbAntwort"){const f=FB.list.find(x=>x.id===el.dataset.id);if(!f||f.anonym)return;await fgLaden();
    if(!hatZugang(f.spielerin_id)){toast("Sie hat gerade keinen aktiven Zugang.");return;}
    if(f.status==="neu")fbPatch(f.id,{status:"gelesen"});
    openFreigabe({art:"kommentar",titel:`Antwort auf dein Feedback (${themaName(f.thema)})`,text:`Zu deinem Feedback: „${f.nachricht.length>200?f.nachricht.slice(0,200)+" …":f.nachricht}“\n\n`,quelle:{spieler:f.spielerin_id},empf:[f.spielerin_id]});}
});
$("#app").addEventListener("input",e=>{if(e.target.id==="fbText"&&S.ui.fbEntwurf)S.ui.fbEntwurf.text=e.target.value;});
$("#app").addEventListener("change",e=>{const el=e.target;if(el.dataset.act==="fbNotiz"){const f=FB.list.find(x=>x.id===el.dataset.id);const v=el.value.trim();if(f&&v!==(f.notiz||""))fbPatch(f.id,{notiz:v},"Notiz gespeichert");}});
