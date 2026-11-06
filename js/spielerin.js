"use strict";
/* ---------- Ansicht für Spielerinnen (Phase 8a) ----------
   Meldet sich eine Spielerin an (E-Mail steht in zugaenge, nicht in mitglieder), zeigt die App NUR ihre Freigaben.
   Gelesen wird nur über die Tabellen freigaben/gelesen/reaktionen – der Zugriffsschutz in Supabase sorgt dafür,
   dass sie ausschließlich ihre eigenen, nicht zurückgezogenen Freigaben bekommt. Trainerdaten werden nie geladen. */
const SP={list:[],gel:{},re:{},inhalt:{},t:0,loading:false,err:"",zugang:true};
const spIch=()=>SB.state.spielerin||{};

async function spLaden(force){
  if(SP.loading)return;if(!force&&Date.now()-SP.t<30000)return;SP.loading=true;
  try{
    const z=await SB.api("/rest/v1/zugaenge?select=spielerin_id,name,team");SP.zugang=!!(z&&z.length);
    if(SP.zugang){
      const [l,g,r,fb]=await Promise.all([SB.api("/rest/v1/freigaben?select=id,team,art,titel,text,erstellt_am,geaendert_am&order=erstellt_am.desc"),
        SB.api("/rest/v1/gelesen?select=freigabe_id,zuerst_am,zuletzt_am"),SB.api("/rest/v1/reaktionen?select=freigabe_id,art,kommentar,am"),
        SB.api("/rest/v1/rpc/meine_feedbacks",{method:"POST",body:"{}"}).catch(()=>[])]);
      SP.fb=fb||[];
      SP.list=l||[];SP.gel=Object.fromEntries((g||[]).map(x=>[x.freigabe_id,x]));SP.re=Object.fromEntries((r||[]).map(x=>[x.freigabe_id,x]));
    }else{SP.list=[];}
    SP.t=Date.now();SP.err="";
  }catch(e){SP.err=navigator.onLine?(e.status===401?"Anmeldung abgelaufen – bitte neu anmelden.":(e.message||"Laden fehlgeschlagen")):"Offline – zum Ansehen brauchst du Internet.";}
  finally{SP.loading=false;render();}
}
const spNach=()=>{if(!SP.loading&&Date.now()-SP.t>=30000)setTimeout(()=>spLaden(),0);};

/* Öffnen: Inhalt holen und Lesebestätigung speichern (erstes Öffnen bleibt erhalten, letztes wird aktualisiert) */
async function spOeffnen(id){
  S.ui.spSel=id;render();window.scrollTo(0,0);
  const f=SP.list.find(x=>x.id===id);if(!f)return;
  try{
    if(!SP.inhalt[id]){const r=await SB.api(`/rest/v1/freigaben?id=eq.${id}&select=inhalt`);SP.inhalt[id]=(r&&r[0]&&r[0].inhalt)||{};render();}
    const jetzt=new Date().toISOString();
    await SB.api("/rest/v1/gelesen?on_conflict=freigabe_id,spielerin_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},
      body:JSON.stringify({freigabe_id:id,team:f.team,spielerin_id:spIch().id,zuletzt_am:jetzt})});
    SP.gel[id]=Object.assign({zuerst_am:jetzt},SP.gel[id]||{},{freigabe_id:id,zuletzt_am:jetzt});render();
  }catch(e){toast("Konnte nicht geladen werden: "+(e.message||""));}
}
async function spReaktion(id,art,kommentar){
  const f=SP.list.find(x=>x.id===id);if(!f)return;const alt=SP.re[id]||{};
  const neu={freigabe_id:id,team:f.team,spielerin_id:spIch().id,art:art===undefined?(alt.art||null):art,kommentar:kommentar===undefined?(alt.kommentar||""):kommentar,am:new Date().toISOString()};
  try{await SB.api("/rest/v1/reaktionen?on_conflict=freigabe_id,spielerin_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify(neu)});
    SP.re[id]=neu;render();toast(kommentar!==undefined?"Kommentar gesendet":"Gespeichert");return true;}
  catch(e){toast("Nicht gespeichert: "+(e.message||""));return false;}
}

function vSpielerin(){
  spNach();const ich=spIch();
  const kopf=`<h2 class="page-h">Hallo${ich.name?" "+esc(ich.name):""}</h2>`;
  const fuss=`<div class="row-actions" style="margin-top:28px"><button class="btn ghost" data-act="spAbmelden">Abmelden</button></div>
    <p class="legend">Angemeldet als ${esc(SB.st.session&&SB.st.session.email||"")}. Gespeichert wird, wann du etwas geöffnet hast, deine Reaktionen und Kommentare sowie dein Feedback – sichtbar für dein Trainerteam (anonymes Feedback ohne deinen Namen).</p>`;
  if(SP.err)return `<div class="narrow sp">${kopf}<div class="warn">${esc(SP.err)}</div><div class="row-actions"><button class="btn" data-act="spReload">Erneut versuchen</button></div>${fuss}</div>`;
  if(!SP.t)return `<div class="narrow sp">${kopf}<p class="hint">Wird geladen …</p></div>`;
  if(!SP.zugang)return `<div class="narrow sp">${kopf}<div class="notice">Dein Zugang ist im Moment nicht aktiv. Bitte sprich dein Trainerteam an.</div>${fuss}</div>`;
  const sel=S.ui.spSel&&SP.list.find(x=>x.id===S.ui.spSel);
  if(sel){const r=SP.re[sel.id]||{};const inh=SP.inhalt[sel.id];
    return `<div class="narrow sp"><div class="ed-top"><button class="btn ghost" data-act="spZurueck">← Alle Freigaben</button></div>
      <h2 class="page-h" style="margin-top:4px">${esc(sel.titel)}</h2>
      <p class="legend" style="margin-top:0">${esc(FGART[sel.art]||"")} · ${esc(fmtStamp(Date.parse(sel.erstellt_am)))}${Date.parse(sel.geaendert_am)-Date.parse(sel.erstellt_am)>60000?` · geändert ${esc(fmtStamp(Date.parse(sel.geaendert_am)))}`:""}</p>
      ${sel.text?`<section class="blk spkom"><h3>Von deinem Trainerteam</h3><p class="fgtext">${esc(sel.text)}</p></section>`:""}
      ${inh?(inh.punkte&&inh.punkte.length)||(inh.medien&&inh.medien.length)||inh.fazit?`<section class="blk">${fgInhaltHtml(inh)}</section>`:"":'<p class="hint">Inhalt wird geladen …</p>'}
      <section class="blk"><h3>Deine Rückmeldung</h3>
        <div class="spreakt">${Object.entries(REAKT).map(([k,l])=>`<button type="button" class="btn${r.art===k?" pri":""}" data-act="spArt" data-v="${k}" aria-pressed="${r.art===k}">${esc(l)}</button>`).join("")}</div>
        <label class="f" style="margin-top:14px">Kommentar (optional)<textarea class="inp" id="spKom" data-key="spKom" rows="3" placeholder="Was möchtest du dazu sagen?">${esc((S.ui.spEntwurf||{})[sel.id]??r.kommentar??"")}</textarea></label>
        <div class="row-actions"><button class="btn pri" data-act="spKomSenden">Kommentar senden</button></div>
        ${r.am?`<p class="legend">Zuletzt gespeichert ${esc(fmtStamp(Date.parse(r.am)))}. Du kannst deine Rückmeldung jederzeit ändern.</p>`:""}</section></div>`;}
  const neu=SP.list.filter(f=>!SP.gel[f.id]).length;
  /* Reiter: Termine · Neues · Analysen · Mehr (Phase 9) */
  const tab=S.ui.spTab||"termine";const nNeu=typeof spNeuAnzahl==="function"?spNeuAnzahl():0;
  const reiter=seg("spTab",tab,[["termine","Termine"],["neues",`Neues${nNeu?` <span class="bd warnbd">${nNeu}</span>`:""}`],["analysen",`Analysen${neu?` <span class="bd warnbd">${neu}</span>`:""}`],["mehr","Mehr"]]," ptabs");
  if(tab!=="analysen")return `<div class="narrow sp">${kopf}${reiter}${spTabInhalt(tab)}${tab==="mehr"?fbMeine()+pushSpielerinBlock()+fuss:""}</div>`;
  return `<div class="narrow sp">${kopf}${reiter}<p class="hint">Hier siehst du, was dein Trainerteam für dich freigegeben hat.${neu?` <b>${neu} neu.</b>`:""}</p>
    <div class="row-actions" style="margin-top:0"><button class="btn sm" data-act="spReload">Aktualisieren</button></div>
    ${SP.list.length?`<div class="fglist">${SP.list.map(f=>{const g=SP.gel[f.id],r=SP.re[f.id];const geaendert=g&&Date.parse(f.geaendert_am)>Date.parse(g.zuletzt_am)+1000;
      return `<button type="button" class="fgi fgkopf spitem" data-act="spOpen" data-id="${f.id}"><span class="fgt"><b>${esc(f.titel)}</b>${!g?' <span class="bd">neu</span>':geaendert?' <span class="bd">geändert</span>':""}</span>
        <span class="src">${esc(FGART[f.art]||"")} · ${esc(fmtStamp(Date.parse(f.erstellt_am)))}</span>${r&&r.art?`<span class="fgstat">${esc(REAKT[r.art])}</span>`:""}</button>`;}).join("")}</div>`
      :'<div class="empty" style="margin-top:12px"><h3>Noch nichts für dich da</h3><p>Sobald dein Trainerteam dir eine Analyse, einen Clip oder einen Kommentar freigibt, erscheint er hier.</p></div>'}
    </div>`;
}

$("#app").addEventListener("click",async e=>{const el=e.target.closest("[data-act]");if(!el||!SB.istSpielerin())return;const a=el.dataset.act;
  if(a==="spTab"){S.ui.spTab=el.dataset.v;S.ui.spSel=null;render();window.scrollTo(0,0);if(typeof sptLaden==="function")sptLaden();return;}
  if(a==="spOpen")spOeffnen(el.dataset.id);
  if(a==="spZurueck"){S.ui.spSel=null;render();}
  if(a==="spReload")spLaden(true);
  if(a==="spArt"){const id=S.ui.spSel,cur=(SP.re[id]||{}).art;spReaktion(id,cur===el.dataset.v?null:el.dataset.v);}
  if(a==="spKomSenden"){const id=S.ui.spSel,txt=($("#spKom").value||"").trim();if(S.ui.spEntwurf)delete S.ui.spEntwurf[id];if(!await spReaktion(id,undefined,txt)){S.ui.spEntwurf=S.ui.spEntwurf||{};S.ui.spEntwurf[id]=txt;render();}}
  if(a==="spAbmelden"){if(!confirmDel("Abmelden?"))return;await SB.logout();SP.t=0;SP.list=[];S.ui.spSel=null;render();}
});
/* angefangenen Kommentar merken, damit er beim Antippen einer Reaktion nicht verloren geht */
$("#app").addEventListener("input",e=>{if(e.target.id==="spKom"&&S.ui.spSel){S.ui.spEntwurf=S.ui.spEntwurf||{};S.ui.spEntwurf[S.ui.spSel]=e.target.value;}});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&SB.istSpielerin())spLaden();});
