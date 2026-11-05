"use strict";
/* ---------- Gemeinsame Daten (Supabase) ----------
   Offline zuerst: Die App arbeitet immer mit der Datenbank im Browser. Ist man angemeldet und online,
   werden Änderungen hochgeladen und fremde Änderungen geholt. Pro Dokument gewinnt die neuere Änderung
   (updatedAt). Gelöschtes wird als „deleted“ markiert, damit es auf allen Geräten verschwindet.
   Geteilt werden: Mannschaften, Kader je Mannschaft, Einstellungen, Übungen, Trainings, Spielberichte –
   nicht die gewählte Mannschaft, das Sicherungsdatum o. Ä. (die gelten pro Gerät). */
const SB=(()=>{
  const cfgOk=()=>!!(KONFIG.supabaseUrl&&KONFIG.supabaseKey);
  const url=p=>KONFIG.supabaseUrl.replace(/\/+$/,"")+p;
  const LS_SESSION="tp-sb-session",LS_STATE="tp-sb-state";
  const st={session:null,team:null,busy:false,last:null,error:"",online:navigator.onLine};
  const read=k=>{try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}};
  const write=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
  st.session=read(LS_SESSION);const state=Object.assign({pending:{},lastPull:null,team:null,init:false},read(LS_STATE)||{});
  st.team=state.team;const saveState=()=>write(LS_STATE,state);

  async function api(path,opt={},auth=true){
    const h={apikey:KONFIG.supabaseKey,"Content-Type":"application/json",...(opt.headers||{})};
    if(auth&&st.session)h.Authorization="Bearer "+st.session.access_token;
    const r=await fetch(url(path),{...opt,headers:h});
    if(r.status===401&&auth&&st.session&&!opt._retry){if(await refresh())return api(path,{...opt,_retry:true},auth);}
    if(!r.ok){let m="";try{const j=await r.json();m=j.msg||j.message||j.error_description||j.error||"";}catch(e){}throw Object.assign(new Error(m||("Fehler "+r.status)),{status:r.status});}
    return r.status===204?null:r.json().catch(()=>null);
  }
  function setSession(j){st.session={access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Date.now()+(j.expires_in||3600)*1000,email:j.user&&j.user.email||(st.session&&st.session.email)};write(LS_SESSION,st.session);}
  async function refresh(){
    if(!st.session||!st.session.refresh_token)return false;
    try{const r=await fetch(url("/auth/v1/token?grant_type=refresh_token"),{method:"POST",headers:{apikey:KONFIG.supabaseKey,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:st.session.refresh_token})});
      if(!r.ok){if(r.status===400||r.status===401){st.session=null;write(LS_SESSION,null);}return false;}setSession(await r.json());return true;}catch(e){return false;}
  }
  /* Anmeldung per Code aus der E-Mail */
  async function sendCode(email){await api("/auth/v1/otp",{method:"POST",body:JSON.stringify({email,create_user:true})},false);}
  async function verify(email,code){
    const j=await api("/auth/v1/verify",{method:"POST",body:JSON.stringify({type:"email",email,token:code.trim()})},false);setSession(j);
    const m=await api("/rest/v1/mitglieder?select=team");
    if(!m||!m.length){await logout();throw new Error("Diese E-Mail ist noch für kein Team freigeschaltet. Trag sie in Supabase in die Tabelle „mitglieder“ ein.");}
    if(state.team!==m[0].team){state.team=m[0].team;state.lastPull=null;state.init=false;}st.team=state.team;saveState();
    await syncNow(true);
  }
  async function logout(){try{if(st.session)await api("/auth/v1/logout",{method:"POST"});}catch(e){}st.session=null;write(LS_SESSION,null);queueRender();}

  /* Lokale Änderungen vormerken (aus speicher.js aufgerufen) */
  function mark(kind,id,deleted){
    if(!cfgOk()||!state.team)return;const [coll,key]=locate(kind,id);
    state.pending[coll+"/"+key]={coll,id:key,deleted:!!deleted,t:Date.now()};saveState();later();
  }
  let tm=null;const later=()=>{clearTimeout(tm);tm=setTimeout(()=>syncNow(),2000);};

  function docOf(coll,id){
    if(coll==="meta")return id==="settings"?S.settings:id==="teams"?S.teamsDoc:id==="vorlagen"?S.vorlagenDoc:id.startsWith("kader:")?S.kaders[id.slice(6)]:id.startsWith("planung:")?S.planungen[id.slice(8)]:null;
    return S[coll]&&S[coll][id];}
  /* Meta-Kennung → [Art, Kennung] wie in speicher.js (für „wird gerade bearbeitet“). */
  const metaKind=id=>id.startsWith("kader:")?["kader",id.slice(6)]:id.startsWith("planung:")?["planung",id.slice(8)]:[id,"x"];
  async function push(){
    const ent=Object.entries(state.pending);if(!ent.length)return 0;
    const docs=ent.map(([,p])=>{const o=p.deleted?null:docOf(p.coll,p.id);return {coll:p.coll,id:p.id,deleted:p.deleted||!o,updated_at:(o&&o.updatedAt)||p.t,data:o?clone(o):null};});
    for(let i=0;i<docs.length;i+=200)await api("/rest/v1/rpc/push_docs",{method:"POST",body:JSON.stringify({p_team:state.team,p_docs:docs.slice(i,i+200)})});
    ent.forEach(([k,p])=>{if(state.pending[k]&&state.pending[k].t===p.t)delete state.pending[k];});saveState();return docs.length;
  }
  async function pull(){
    let rows=[],from=0;const since=state.lastPull?`&server_ts=gte.${encodeURIComponent(state.lastPull)}`:"";
    for(;;){const page=await api(`/rest/v1/docs?select=coll,id,data,deleted,updated_at,server_ts&team=eq.${encodeURIComponent(state.team)}${since}&order=server_ts.asc`,{headers:{Range:`${from}-${from+999}`}});
      rows=rows.concat(page||[]);if(!page||page.length<1000)break;from+=1000;}
    const writes=[];let changed=0;
    rows.forEach(r=>{
      const k=r.coll+"/"+r.id;if(state.pending[k])return; // eigene ungesendete Änderung hat Vorrang, wird gleich hochgeladen
      const [kind,kid]=r.coll==="meta"?metaKind(r.id):[{uebungen:"uebung",trainings:"training",spiele:"spiel"}[r.coll],r.id];
      if(!kind||dirty.has(kind+"/"+kid))return;
      if(r.coll==="meta"&&!["settings","teams","vorlagen"].includes(r.id)&&!r.id.startsWith("kader:")&&!r.id.startsWith("planung:"))return;
      const cur=docOf(r.coll,r.id);const curT=cur&&cur.updatedAt||0;
      if(r.deleted){if(cur&&r.updated_at>=curT&&(r.coll!=="meta"||kind==="kader"||kind==="planung")){if(kind==="kader")delete S.kaders[kid];else if(kind==="planung")delete S.planungen[kid];else delete S[r.coll][r.id];writes.push([r.coll,r.id,null]);changed++;}return;}
      if(!cur||r.updated_at>curT){const d=Object.assign({},r.data,{updatedAt:r.updated_at});
        if(kind==="kader")S.kaders[kid]=Object.assign({players:[]},d);
        else if(kind==="planung")S.planungen[kid]=Object.assign({perioden:[],wochen:[]},d);
        else if(r.id==="settings"&&r.coll==="meta")S.settings=Object.assign(defaultSettings(),d);
        else if(r.id==="teams"&&r.coll==="meta"){S.teamsDoc=Object.assign({list:[]},d);if(S.teamsDoc.list.length)pickTeam(S.team);}
        else if(r.id==="vorlagen"&&r.coll==="meta")S.vorlagenDoc=Object.assign({list:[]},d);
        else S[r.coll][r.id]=d;
        writes.push([r.coll,r.id,clone(d)]);changed++;}
    });
    if(writes.length&&S.mode==="db")await idbWrite(writes);
    if(rows.length)state.lastPull=rows[rows.length-1].server_ts;saveState();
    if(changed){if(kanal)kanal.postMessage({all:true});queueRender();}
    return changed;
  }
  /* Erstes Verbinden: Ist das Team in der Datenbank noch leer, lädt dieses Gerät alles hoch.
     Gibt es dort schon Daten, gewinnen Kader und Einstellungen aus der Datenbank; Übungen, Trainings und
     Spielberichte von diesem Gerät kommen dazu (bei gleicher Kennung gewinnt die neuere Fassung). */
  async function firstSync(){
    const any=await api(`/rest/v1/docs?select=id&team=eq.${encodeURIComponent(state.team)}&limit=1`);
    const all=[];const now=Date.now();
    if(!any||!any.length){all.push(["meta","teams"],["meta","vorlagen"],["meta","settings"],...Object.keys(S.kaders).map(t=>["meta","kader:"+t]),...Object.keys(S.planungen).map(t=>["meta","planung:"+t]));}
    ["uebungen","trainings","spiele"].forEach(c=>Object.keys(S[c]).forEach(id=>all.push([c,id])));
    all.forEach(([c,id])=>{const o=docOf(c,id);if(!o)return;if(!o.updatedAt)o.updatedAt=now;state.pending[c+"/"+id]={coll:c,id,deleted:false,t:o.updatedAt};});
    state.init=true;saveState();
  }
  async function syncNow(force){
    if(!cfgOk()||!st.session||!state.team||st.busy||!S.ready||S.mode==="none")return;
    if(!navigator.onLine){st.online=false;setStatus("Offline – Abgleich folgt");return;}
    st.busy=true;st.error="";
    try{if(!state.init)await firstSync();await push();await pull();await push();st.last=Date.now();st.online=true;setStatus("Abgeglichen");}
    catch(e){st.error=e.status===401||e.status===403?"Anmeldung abgelaufen – bitte neu anmelden.":(e.message||"Abgleich fehlgeschlagen");if(e.status===401)st.session=null;setStatus("Abgleich fehlgeschlagen");}
    finally{st.busy=false;if(S.view==="einstellungen")queueRender();}
  }
  window.addEventListener("online",()=>syncNow());
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")syncNow();});
  setInterval(()=>{if(document.visibilityState==="visible")syncNow();},60000);
  return {cfgOk,st,state,sendCode,verify,logout,mark,syncNow,pending:()=>Object.keys(state.pending).length};
})();

/* Bereich in den Einstellungen */
function syncBlock(){
  if(!SB.cfgOk())return `<section class="blk"><h3>Gemeinsame Daten <span class="sub">nicht eingerichtet</span></h3><p class="hint">Sobald die Verbindung zur gemeinsamen Datenbank eingetragen ist, kannst du dich hier anmelden und die Daten mit deinen Co-Trainern teilen.</p></section>`;
  const s=SB.st;
  if(!s.session)return `<section class="blk"><h3>Gemeinsame Daten <span class="sub">nicht angemeldet</span></h3>
    <p class="hint">Melde dich mit deiner E-Mail an. Du bekommst einen 6-stelligen Code. Nur freigeschaltete Trainer sehen die Daten.</p>
    ${S.ui.sbCode?`<div class="meta"><label class="f">Code aus der E-Mail<input class="inp" id="sbCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456"></label></div>
      <div class="row-actions"><button class="btn pri" data-act="sbVerify">Anmelden</button><button class="btn ghost" data-act="sbBack">Andere E-Mail</button></div><p class="legend">Code gesendet an ${esc(S.ui.sbMail||"")}.</p>`
    :`<div class="meta"><label class="f">E-Mail<input class="inp" id="sbMail" type="email" autocomplete="email" value="${esc(S.ui.sbMail||"")}" placeholder="name@beispiel.de"></label></div>
      <div class="row-actions"><button class="btn pri" data-act="sbSend">Code senden</button></div>`}
    ${s.error?`<div class="warn">${esc(s.error)}</div>`:""}</section>`;
  const p=SB.pending();
  return `<section class="blk"><h3>Gemeinsame Daten <span class="sub">Team „${esc(SB.state.team||"")}“</span></h3>
    <p class="hint">Angemeldet als ${esc(s.session.email||"")}. ${s.busy?"Abgleich läuft …":s.last?`Zuletzt abgeglichen: ${esc(fmtStamp(s.last))}.`:"Noch nicht abgeglichen."}${p?` ${p} Änderung${p>1?"en":""} warten auf Upload.`:""}</p>
    ${s.error?`<div class="warn">${esc(s.error)}</div>`:""}
    <div class="row-actions" style="margin-top:0"><button class="btn" data-act="sbSync">Jetzt abgleichen</button><button class="btn ghost" data-act="sbLogout">Abmelden</button></div>
    <p class="legend">Ändern zwei Trainer gleichzeitig dasselbe (z. B. dasselbe Training), gilt die zuletzt gespeicherte Fassung.</p></section>`;
}
$("#app").addEventListener("click",async e=>{
  const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  try{
    if(a==="sbSend"){const m=$("#sbMail").value.trim();if(!/^\S+@\S+\.\S+$/.test(m)){toast("Bitte eine gültige E-Mail eingeben.");return;}
      S.ui.sbMail=m;el.disabled=true;await SB.sendCode(m);S.ui.sbCode=true;SB.st.error="";render();$("#sbCode")?.focus();}
    if(a==="sbVerify"){el.disabled=true;await SB.verify(S.ui.sbMail,$("#sbCode").value);S.ui.sbCode=false;render();toast("Angemeldet");}
    if(a==="sbBack"){S.ui.sbCode=false;render();}
    if(a==="sbSync"){await SB.syncNow(true);render();}
    if(a==="sbLogout"){if(confirmDel("Abmelden? Die Daten bleiben auf diesem Gerät, werden aber nicht mehr abgeglichen."))await SB.logout();render();}
  }catch(err){SB.st.error=err.message||"Fehlgeschlagen";render();}
});
