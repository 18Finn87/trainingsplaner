"use strict";
/* ---------- views ---------- */
function render(){
  const ts=$("#teamSel");if(ts){ts.innerHTML=S.teamsDoc.list.map(t=>`<option value="${esc(t.id)}"${t.id===S.team?" selected":""}>${esc(t.name||"Ohne Namen")}</option>`).join("")+'<option value="__verwalten">Mannschaften verwalten …</option>';ts.hidden=!S.ready||!!S.fatal;}
  document.querySelectorAll("#tabs button,#gearBtn").forEach(b=>b.setAttribute("aria-current",b.dataset.view===S.view?"page":"false"));
  const app=$("#app");
  const a=document.activeElement;let fk=null,ss=null,se=null;
  if(a&&a.dataset&&a.dataset.key&&app.contains(a)){fk=a.dataset.key;try{ss=a.selectionStart;se=a.selectionEnd;}catch(e){}}
  const scrollY=window.scrollY;
  if(!S.ready){app.innerHTML='<p class="hint">Daten werden geladen …</p>';return;}
  if(S.fatal){app.innerHTML=`<div class="notice">${esc(S.fatal)}</div>`;return;}
  const notice=(S.notice?`<div class="notice">${esc(S.notice)}</div>`:"")+backupReminder();
  app.innerHTML=notice+({training:vTraining,uebungen:vUebungen,spiele:vSpiele,kader:vKader,statistik:vStatistik,einstellungen:vEinstellungen}[S.view]||vTraining)();
  mountBoards();
  if(fk){const el=app.querySelector(`[data-key="${CSS.escape(fk)}"]`);if(el){el.focus({preventScroll:true});try{if(ss!=null)el.setSelectionRange(ss,se);}catch(e){}}}
  window.scrollTo(0,scrollY);
}
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
    const [kind,id,field]=el.dataset.board.split(":");const o=objFor(kind,id);if(!o)return;
    mountBoard(el,()=>{if(!o[field])o[field]={field:kind==="spiel"?"full":"half",items:[],lines:[]};return o[field];},()=>saveLater(kind,id));
  });
}
const tagChips=(sel,act,hot=[])=>S.settings.tags.map(t=>`<button type="button" class="chip tag${hot.includes(t)?" hot":""}" data-act="${act}" data-v="${esc(t)}" aria-pressed="${sel.includes(t)}">${esc(t)}</button>`).join("");
const opt=(arr,v)=>arr.map(([val,lab])=>`<option value="${esc(val)}"${val===v?" selected":""}>${esc(lab)}</option>`).join("");

