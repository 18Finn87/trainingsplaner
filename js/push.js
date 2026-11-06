"use strict";
/* ---------- Push-Erinnerungen (Phase 8c) ----------
   Gerät anmelden: Browser fragt um Erlaubnis → Push-Abo beim Browser-Hersteller → Abo in Supabase speichern
   (Funktion push_anmelden; Rolle Trainer/Spielerin erkennt die Datenbank selbst). Versand übernimmt der
   Supabase-Baustein „push“ (supabase/functions/push/index.ts). Einstellungen je Team: Tabelle push_einstellungen. */
const PU={an:null,geprueft:false,busy:false,einst:null,uebersicht:{},t:0,err:""};
const pushGeht=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
const istIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const istApp=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const b64u=s=>{const p="=".repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(b,c=>c.charCodeAt(0));};
const geraetName=()=>{const u=navigator.userAgent;return (/iPhone/.test(u)?"iPhone":/iPad/.test(u)?"iPad":/Android/.test(u)?"Android":/Windows/.test(u)?"Windows":/Mac/.test(u)?"Mac":"Gerät")+(istApp()?" (App)":" (Browser)");};
const pushFn=body=>SB.api("/functions/v1/push",{method:"POST",body:JSON.stringify(body)});

async function pushPruefen(){
  PU.geprueft=true;
  try{if(!pushGeht()){PU.an=false;return;}const reg=await navigator.serviceWorker.getRegistration();const sub=reg&&await reg.pushManager.getSubscription();
    PU.an=!!sub&&Notification.permission==="granted";}catch(e){PU.an=false;}
  render();
}
async function pushEin(){
  if(PU.busy)return;
  if(!pushGeht()){toast(istIOS()&&!istApp()?"Auf dem iPhone geht das nur in der App vom Home-Bildschirm.":"Dieser Browser kann keine Benachrichtigungen.");return;}
  PU.busy=true;render();
  try{
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){toast("Benachrichtigungen wurden nicht erlaubt.");return;}
    let key=await SB.api("/rest/v1/rpc/push_public_key",{method:"POST",body:"{}"});
    if(!key){const r=await pushFn({aktion:"schluessel"});key=r&&r.public_key;}
    if(!key)throw new Error("Kein Schlüssel vom Server");
    const reg=await navigator.serviceWorker.ready;
    const alt=await reg.pushManager.getSubscription();if(alt){try{await SB.api("/rest/v1/rpc/push_abmelden",{method:"POST",body:JSON.stringify({p_endpoint:alt.endpoint})});}catch(e){}await alt.unsubscribe();}
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)});const j=sub.toJSON();
    await SB.api("/rest/v1/rpc/push_anmelden",{method:"POST",body:JSON.stringify({p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_geraet:geraetName()})});
    PU.an=true;toast("Benachrichtigungen eingeschaltet");
  }catch(e){toast("Hat nicht geklappt: "+(e.message||"Fehler"));}
  finally{PU.busy=false;render();}
}
async function pushAus(){
  if(PU.busy)return;PU.busy=true;render();
  try{const reg=await navigator.serviceWorker.getRegistration();const sub=reg&&await reg.pushManager.getSubscription();
    if(sub){try{await SB.api("/rest/v1/rpc/push_abmelden",{method:"POST",body:JSON.stringify({p_endpoint:sub.endpoint})});}catch(e){}await sub.unsubscribe();}
    PU.an=false;toast("Benachrichtigungen ausgeschaltet");}
  catch(e){toast("Fehler: "+(e.message||""));}
  finally{PU.busy=false;render();}
}
async function pushTest(){try{const r=await pushFn({aktion:"test"});toast(r&&r.gesendet?"Test gesendet – gleich sollte eine Benachrichtigung kommen.":"Kein angemeldetes Gerät gefunden.");}catch(e){toast("Fehler: "+(e.message||""));}}
/* nach einer neuen Freigabe: Empfängerinnen sofort benachrichtigen (falls eingestellt) – Fehler stören nicht */
function pushFreigabe(id){pushFn({aktion:"freigabe",id}).catch(()=>{});}

/* Geräte-Bereich (für Spielerinnen und Trainer gleich) */
function pushGeraetHtml(fuerTrainer){
  if(!PU.geprueft)setTimeout(pushPruefen,0);
  let hinweis="";
  if(!pushGeht())hinweis=istIOS()&&!istApp()?"Auf dem iPhone funktionieren Benachrichtigungen nur, wenn die App auf dem Home-Bildschirm liegt: in Safari Teilen → „Zum Home-Bildschirm“, dann die App über das neue Symbol öffnen und hier einschalten.":"Dieser Browser kann leider keine Benachrichtigungen anzeigen.";
  else if(Notification.permission==="denied")hinweis="Benachrichtigungen sind für diese App blockiert. Erlauben kannst du sie in den Einstellungen deines Handys bzw. Browsers (Website-Einstellungen → Benachrichtigungen).";
  const an=PU.an===true;
  return `<p class="hint" style="margin-top:0">${an?"<b>Auf diesem Gerät eingeschaltet.</b> ":PU.an===false?"Auf diesem Gerät ausgeschaltet. ":""}${fuerTrainer?"Du bekommst hier einmal täglich eine Meldung, wenn neues Feedback da ist.":"Du bekommst eine Nachricht, wenn dein Trainerteam etwas für dich freigibt, und gelegentlich eine Erinnerung."}</p>
    ${hinweis?`<div class="notice">${esc(hinweis)}</div>`:`<div class="row-actions">${an?`<button class="btn" data-act="puAus"${PU.busy?" disabled":""}>Ausschalten</button><button class="btn ghost" data-act="puTest">Test-Benachrichtigung</button>`:`<button class="btn pri" data-act="puEin"${PU.busy?" disabled":""}>${PU.busy?"Einen Moment …":"Benachrichtigungen einschalten"}</button>`}</div>`}`;
}
/* Spielerinnen-Ansicht */
function pushSpielerinBlock(){return `<section class="blk"><h3>Benachrichtigungen</h3>${pushGeraetHtml(false)}</section>`;}

/* ---------- Trainer ---------- */
async function pushTrainerLaden(force){
  if(!fgBereit()||PU.loading)return;if(!force&&Date.now()-PU.t<30000)return;PU.loading=true;
  try{
    let e=await SB.api(`/rest/v1/push_einstellungen?team=eq.${fgTeam()}&select=*`);
    if(!e||!e.length)e=await SB.api("/rest/v1/push_einstellungen",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({team:SB.state.team})});
    PU.einst=e[0];const u=await SB.api("/rest/v1/rpc/push_uebersicht",{method:"POST",body:"{}"});
    PU.uebersicht=Object.fromEntries((u||[]).map(x=>[x.spielerin_id,x.geraete]));PU.t=Date.now();PU.err="";
  }catch(err){PU.err=err.message||"Laden fehlgeschlagen";}
  finally{PU.loading=false;render();}
}
const puNach=()=>{if(fgBereit()&&!PU.loading&&Date.now()-PU.t>=30000)setTimeout(()=>pushTrainerLaden(),0);};
const TAGE=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
function pushTrainerBlock(){
  if(fgHinweis())return "";puNach();const e=PU.einst;
  if(PU.err)return `<section class="blk"><h3>Benachrichtigungen</h3><div class="warn">${esc(PU.err)}</div></section>`;
  if(!e)return `<section class="blk"><h3>Benachrichtigungen</h3><p class="hint">Wird geladen …</p></section>`;
  const n=Object.keys(PU.uebersicht).length;const sel=(f,opts)=>`<select data-act="puSet" data-f="${f}">${opt(opts.map(([v,l])=>[String(v),l]),String(e[f]))}</select>`;
  return `<section class="blk"><h3>Benachrichtigungen <span class="sub">${n} Spielerin${n===1?"":"nen"} ${n===1?"hat":"haben"} sie eingeschaltet</span></h3>
    <p class="hint" style="margin-top:0">Spielerinnen schalten Benachrichtigungen in ihrer Ansicht selbst ein. Ungefragt bekommt niemand etwas.</p>
    <label class="cbrow"><input type="checkbox" data-act="puCb" data-f="bei_freigabe"${e.bei_freigabe?" checked":""}> Sofort benachrichtigen, wenn ich etwas freigebe</label>
    <div class="meta"><label class="f">Gelegentliche Erinnerung${sel("haeufigkeit",[["aus","Aus"],["woche","Jede Woche"],["zweiwochen","Alle 2 Wochen"],["monat","Etwa einmal im Monat"]])}</label>
     ${e.haeufigkeit!=="aus"?`<label class="f">Tag${sel("wochentag",TAGE.map((t,i)=>[i+1,t]))}</label><label class="f">Uhrzeit${sel("stunde",[...Array(24)].map((_,h)=>[h,`${h} Uhr`]))}</label>
     <label class="f">An wen?${sel("empfaenger",[["ungelesen","Nur wer noch Ungelesenes hat"],["alle","Alle mit Benachrichtigungen"]])}</label>`:""}</div>
    <div class="row-actions"><button class="btn sm" data-act="puJetzt" data-v="ungelesen">Jetzt erinnern: alle mit Ungelesenem</button><button class="btn sm ghost" data-act="puJetzt" data-v="alle">An alle mit Benachrichtigungen</button></div>
    <h4 class="fbh">Für dich als Trainer</h4>
    <label class="cbrow"><input type="checkbox" data-act="puCb" data-f="feedback_meldung"${e.feedback_meldung?" checked":""}> Einmal täglich melden, wenn neues Feedback da ist${e.haeufigkeit==="aus"?"":` (um ${e.stunde} Uhr)`}</label>
    ${e.haeufigkeit==="aus"?`<div class="meta"><label class="f">Uhrzeit der Feedback-Meldung${sel("stunde",[...Array(24)].map((_,h)=>[h,`${h} Uhr`]))}</label></div>`:""}
    <p class="legend">Die Feedback-Meldung kommt bewusst gesammelt und nicht sofort – sonst könnte man am Zeitpunkt erraten, wer anonym geschrieben hat.</p>
    ${pushGeraetHtml(true)}</section>`;
}
/* Bei der Spielerin (Reiter „Freigaben“) */
function pushSpielerinZeile(p){
  if(fgHinweis())return "";puNach();const g=PU.uebersicht[p.id];
  return `<p class="hint">Benachrichtigungen: ${g?`<b>eingeschaltet</b> (${g} Gerät${g>1?"e":""})`:"nicht eingeschaltet"}</p>${g?`<div class="row-actions" style="margin-top:0"><button class="btn sm" data-act="puJetzt" data-v="${p.id}">${esc(p.name)} jetzt erinnern</button></div>`:""}`;
}
async function pushSetzen(daten){
  try{await SB.api(`/rest/v1/push_einstellungen?team=eq.${fgTeam()}`,{method:"PATCH",body:JSON.stringify(daten)});Object.assign(PU.einst,daten);render();toast("Gespeichert");}
  catch(e){toast("Nicht gespeichert: "+(e.message||""));}
}

/* ---------- Bedienung ---------- */
$("#app").addEventListener("click",async e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  if(a==="puEin")pushEin();
  if(a==="puAus")pushAus();
  if(a==="puTest")pushTest();
  if(a==="puJetzt"){const v=el.dataset.v;if(!confirmDel(v==="alle"?"Jetzt alle Spielerinnen mit Benachrichtigungen erinnern?":v==="ungelesen"?"Jetzt alle mit ungelesenen Freigaben erinnern?":"Diese Spielerin jetzt erinnern?"))return;
    el.disabled=true;try{const r=await pushFn({aktion:"erinnern",ziel:v});toast(r.gesendet?`Erinnerung an ${r.spielerinnen} Spielerin${r.spielerinnen===1?"":"nen"} gesendet`:"Niemand zu erinnern (keine passende Spielerin mit Benachrichtigungen).");}
    catch(err){toast("Fehler: "+(err.message||""));}finally{el.disabled=false;}}
});
$("#app").addEventListener("change",e=>{const el=e.target,a=el.dataset.act;if(!PU.einst)return;
  if(a==="puSet"){const f=el.dataset.f;pushSetzen({[f]:["wochentag","stunde"].includes(f)?+el.value:el.value});}
  if(a==="puCb")pushSetzen({[el.dataset.f]:el.checked});
});
/* Benachrichtigung angetippt, während die App offen war: Freigaben neu laden */
if("serviceWorker" in navigator)navigator.serviceWorker.addEventListener("message",e=>{if(e.data&&e.data.push==="geoeffnet"){if(SB.istSpielerin())spLaden(true);else{fgLaden(true);fbLaden(true);}}});
