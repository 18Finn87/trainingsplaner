"use strict";
/* ---------- views ---------- */
function render(){
  if(typeof farbeAnwenden==="function")farbeAnwenden();   // Farbe der gewählten Mannschaft (js/farben.js)
  const ts=$("#teamSel");if(ts){ts.innerHTML=S.teamsDoc.list.map(t=>`<option value="${esc(t.id)}"${t.id===S.team?" selected":""}>${esc(t.name||"Ohne Namen")}</option>`).join("")+'<option value="__verwalten">Mannschaften verwalten …</option>';ts.hidden=!S.ready||!!S.fatal;}
  document.querySelectorAll("#tabs button,#gearBtn").forEach(b=>b.setAttribute("aria-current",b.dataset.view===S.view?"page":"false"));
  const app=$("#app");
  const a=document.activeElement;let fk=null,ss=null,se=null;
  if(a&&a.dataset&&a.dataset.key&&app.contains(a)){fk=a.dataset.key;try{ss=a.selectionStart;se=a.selectionEnd;}catch(e){}}
  const scrollY=window.scrollY;
  /* Eingaben, die erst beim „Hinzufügen“ gespeichert werden (data-entwurf), überleben das Neuzeichnen –
     z. B. wenn der Abgleich im Hintergrund neue Daten bringt, während getippt wird. */
  const entwuerfe={};app.querySelectorAll("[data-entwurf][data-key]").forEach(el=>{if(el.value)entwuerfe[el.dataset.key]=el.value;});
  if(!S.ready){app.innerHTML='<p class="hint">Daten werden geladen …</p>';return;}
  if(S.fatal){app.innerHTML=`<div class="notice">${esc(S.fatal)}</div>`;return;}
  /* Spielerin angemeldet: nur ihre Freigaben. Leeres Gerät ohne Anmeldung: zuerst die Anmelde-Seite. */
  const spMode=typeof SB!=="undefined"&&SB.istSpielerin();document.body.classList.toggle("sp-modus",spMode);
  if(spMode){app.innerHTML=vSpielerin();if(fk){const el=app.querySelector(`[data-key="${CSS.escape(fk)}"]`);if(el){el.focus({preventScroll:true});try{if(ss!=null)el.setSelectionRange(ss,se);}catch(e){}}}window.scrollTo(0,scrollY);return;}
  if(zeigeAnmeldung()){document.body.classList.add("sp-modus");app.innerHTML=vAnmelden();window.scrollTo(0,scrollY);return;}
  const notice=(S.notice?`<div class="notice">${esc(S.notice)}</div>`:"")+backupReminder();
  app.innerHTML=notice+({training:vTraining,uebungen:vUebungen,spiele:vSpiele,kader:vKader,statistik:vStatistik,planung:vPlanung,einstellungen:vEinstellungen}[S.view]||vTraining)();
  mountBoards();
  Object.entries(entwuerfe).forEach(([k,v])=>{const el=app.querySelector(`[data-entwurf][data-key="${CSS.escape(k)}"]`);if(el&&!el.value)el.value=v;});
  if(fk){const el=app.querySelector(`[data-key="${CSS.escape(fk)}"]`);if(el){el.focus({preventScroll:true});try{if(ss!=null)el.setSelectionRange(ss,se);}catch(e){}}}
  window.scrollTo(0,scrollY);
}
/* Anmelde-Seite: nur auf einem Gerät ohne eigene Daten, solange niemand angemeldet ist
   (z. B. Handy einer Spielerin oder neues Trainer-Gerät). „Ohne Anmeldung“ merkt sich das Gerät. */
function geraetLeer(){return !Object.values(S.kaders).some(k=>(k.players||[]).length)&&!["trainings","uebungen","spiele"].some(c=>Object.keys(S[c]).length);}
function zeigeAnmeldung(){if(typeof SB==="undefined"||!SB.cfgOk()||SB.st.session||!geraetLeer())return false;
  try{if(localStorage.getItem("tp-ohne-anmeldung"))return false;}catch(e){}return true;}
function vAnmelden(){
  return `<div class="narrow"><h2 class="page-h">Willkommen</h2>
    <p class="hint">Beim Trainingsplaner Oedheim meldest du dich mit deiner E-Mail an – Spielerinnen sehen danach, was ihr Trainerteam für sie freigegeben hat.</p>
    ${syncBlock("Anmelden")}
    <div class="row-actions"><button class="btn ghost" data-act="ohneAnmeldung">Ohne Anmeldung starten (nur für Trainer)</button></div></div>`;
}
document.addEventListener("click",e=>{const el=e.target.closest('[data-act="ohneAnmeldung"]');if(!el)return;try{localStorage.setItem("tp-ohne-anmeldung","1");}catch(err){}S.ui.ohneAnmeldung=true;render();});
/* Erinnerung, wenn die letzte Sicherung länger als 14 Tage her ist. */
function backupReminder(){
  if(S.view==="kader"||S.ui.reminderHidden)return "";
  const hasData=Object.keys(S.trainings).length||Object.keys(S.spiele).length||Object.keys(S.uebungen).length;
  const since=S.meta.letzteSicherung||S.meta.seit;if(!hasData||!since)return "";
  const days=Math.floor((Date.now()-since)/864e5);if(days<14)return "";
  return `<div class="notice reminder"><span>${S.meta.letzteSicherung?`Deine letzte Sicherung ist ${days} Tage alt.`:"Du hast noch keine Sicherung heruntergeladen."} Die Daten liegen nur auf diesem Gerät.</span>
    <span class="ctl"><button class="btn sm pri" data-act="backup">Jetzt sichern</button><button class="btn sm ghost" data-act="hideReminder">Später</button></span></div>`;
}
function mountBoards(){
  document.querySelectorAll("[data-board]").forEach(el=>{
    const [kind,id,field]=el.dataset.board.split(":");
    if(kind==="spielpt"){   // Skizze einer einzelnen Beobachtung im Spielbericht
      const s=S.spiele[id];const p=s&&(s.punkte||[]).find(x=>x.id===field);if(!p)return;
      mountBoard(el,()=>{if(!p.skizze)p.skizze={field:"half",items:[],lines:[]};return p.skizze;},()=>saveLater("spiel",id));return;}
    const o=objFor(kind,id);if(!o)return;
    mountBoard(el,()=>{if(!o[field])o[field]={field:kind==="spiel"?"full":"half",items:[],lines:[]};return o[field];},()=>saveLater(kind,id));
  });
}
const tagChips=(sel,act,hot=[])=>S.settings.tags.map(t=>`<button type="button" class="chip tag${hot.includes(t)?" hot":""}" data-act="${act}" data-v="${esc(t)}" aria-pressed="${sel.includes(t)}">${esc(t)}</button>`).join("");
const opt=(arr,v)=>arr.map(([val,lab])=>`<option value="${esc(val)}"${val===v?" selected":""}>${esc(lab)}</option>`).join("");

