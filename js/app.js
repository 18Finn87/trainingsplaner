"use strict";
/* ---------- actions ---------- */
function curObj(){return S.view==="training"?["training",S.sel.training]:S.view==="uebungen"?["uebung",S.sel.uebung]:S.view==="spiele"?["spiel",S.sel.spiel]:[null,null];}
function newTraining(extra={}){const id=uid();S.trainings[id]=Object.assign({datum:nextTrainingDay(),start:teamCfg().start,dauerGesamt:teamCfg().dauer,thema:"",anwesenheit:{},ablauf:[],notizen:"",spielId:sortedSpiele()[0]?.[0]||""},extra,{team:S.team,einschr:einschrSnapshot()});S.sel.training=id;S.view="training";saveLater("training",id);render();}
function newEx(){const id=uid();S.uebungen[id]={name:"",kategorie:"",dauer:15,minSp:"",maxSp:"",tw:0,teams:"",tags:[],ziel:"",organisation:"",coaching:"",material:{},board:{field:"half",items:[],lines:[]}};saveLater("uebung",id);return id;}
function mimeOf(filename){return filename.endsWith(".json")?"application/json":"text/html";}
function download(filename,data){
  try{
    const url=URL.createObjectURL(new Blob([data],{type:mimeOf(filename)+";charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);return true;
  }catch(e){toast("Die Datei konnte nicht gespeichert werden.");return false;}
}
/* Handy: über das Teilen-Menü an WhatsApp, Mail, Google Drive oder „In Dateien sichern“ schicken. */
function canShareFiles(){try{return !!(navigator.canShare&&navigator.canShare({files:[new File(["x"],"t.json",{type:"application/json"})]}));}catch(e){return false;}}
async function shareFile(filename,data){
  try{await navigator.share({files:[new File([data],filename,{type:mimeOf(filename)})],title:filename});return true;}
  catch(e){if(e&&e.name==="AbortError")return false;return download(filename,data);}
}
function backupFile(){return [`Trainingsplaner_Sicherung_${today()}.json`,JSON.stringify(backupData(),null,1)];}
async function doBackup(share){
  const [f,d]=backupFile();const ok=share?await shareFile(f,d):download(f,d);
  if(ok){await setMeta("letzteSicherung",Date.now());render();toast("Sicherung erstellt");}
}
function exportTraining(t){
  const hc=headcount(t);const need=materialNeed(t);const units=unitsOf(t);const total=units.reduce((a,u)=>a+u.dur,0);
  const present=players().filter(p=>t.anwesenheit[p.id]==="ja").map(p=>p.name+(p.tw?" (TW)":""));
  const lim=players().filter(p=>t.einschr&&t.einschr[p.id]).map(p=>`${p.name} (${t.einschr[p.id].grund}${t.anwesenheit[p.id]==="ja"?", dabei":""})`);
  const txt=(st,warns,teams)=>{const ex=st.ex;if(!ex)return "<p>Gelöschte Übung</p>";
    return `${teams.length?`<p class="t">${esc(teams.join(" · "))}</p>`:""}${st.s.notiz?`<p class="n">${esc(st.s.notiz)}</p>`:""}${ex.ziel?`<p><b>Ziel:</b> ${esc(ex.ziel)}</p>`:""}${ex.organisation?`<p><b>Organisation:</b> ${esc(ex.organisation)}</p>`:""}${ex.coaching?`<p><b>Coaching:</b> ${esc(ex.coaching)}</p>`:""}
    ${warns.map(w=>`<p class="w">! ${esc(w)}</p>`).join("")}`;};
  const sk=(st,pfx)=>st.ex&&st.ex.board&&(st.ex.board.items||[]).length?boardSVG(st.ex.board,pfx+st.i):"";
  const steps=units.map(u=>{
    if(!u.block){const st=u.steps[0];if(!st.ex)return "";const ti=teamInfo(st.ex,hc);
      return `<div class="st"><div class="h"><span class="c">${u.start}</span><b>${esc(exName(st.ex))}</b><span class="d">${u.dur} min</span></div><div class="g"><div>${txt(st,exCheck(st.ex,hc),ti?[ti]:[])}</div><div>${sk(st,"x")}</div></div></div>`;}
    const G=unitGroups(t,u,hc),info=stationInfo(t,u,hc),R=unitRounds(t,u),sumW=groupSumWarn(t,u,hc);
    return `<div class="st"><div class="h"><span class="c">${u.start}</span><b>Parallel: ${u.steps.map((st,s)=>`Station ${s+1}`).join(" / ")}</b><span class="d">${R} × ${unitRound(t,u)} min = ${u.dur} min</span></div>
      <p class="pi">${G.map((g,gi)=>`Gruppe ${GRUPPE[gi]}: ${grpTxt(g)}`).join(" · ")}${R>1?" – Wechsel nach jeder Runde":""}</p>${sumW?`<p class="w pi">! ${esc(sumW)}</p>`:""}
      <div class="par" style="grid-template-columns:repeat(${u.steps.length},minmax(0,1fr))">${u.steps.map((st,s)=>`<div><p class="sl">Station ${s+1} · Gruppe${info[s].gruppen.length>1?"n":""} ${info[s].gruppen.join(", ")}</p><b>${esc(exName(st.ex))}</b>${txt(st,info[s].warns,info[s].teams)}${sk(st,"y")}</div>`).join("")}</div></div>`;}).join("");
  const html=`<!doctype html><html lang="de"><meta charset="utf-8"><title>Training ${esc(t.datum||"")}</title><style>body{font:14px/1.45 Arial,sans-serif;color:#1C2520;max-width:820px;margin:24px auto;padding:0 20px}h1{font-size:26px;margin:0}h2{font-size:17px;margin:22px 0 6px;color:#2E4B38;border-bottom:2px solid #2E4B38}.st{border-bottom:1px solid #D5DDD6;padding:10px 0;break-inside:avoid}.h{display:flex;gap:12px;align-items:baseline}.c{font-weight:700;color:#2E4B38;width:48px}.d{margin-left:auto;color:#5F6E64}.g{display:grid;grid-template-columns:1fr 200px;gap:14px;margin-left:60px}.g svg,.par svg{width:100%;max-width:220px;height:auto;margin-top:6px}p{margin:3px 0;white-space:pre-wrap}.w{color:#B4531A}.n{font-style:italic}.t{color:#5F6E64}.pi{margin-left:60px}.par{display:grid;gap:14px;margin:8px 0 0 60px}.par>div{border-left:3px solid #2E4B38;padding-left:10px}.sl{font-weight:700;color:#2E4B38;font-size:12px;text-transform:uppercase;letter-spacing:.04em}table{border-collapse:collapse}td{padding:3px 14px 3px 0}.src{color:#5F6E64;font-size:12px}</style>
  <h1>${esc(t.thema||"Training")}</h1><p>${esc(fmtDate(t.datum))}, ${esc(t.start||teamCfg().start)}–${addMin(t.start||teamCfg().start,total)} Uhr</p>
  <h2>Dabei: ${hc.F} Feld, ${hc.T} TW</h2><p>${esc(present.join(", "))}</p>${lim.length?`<p>Eingeschränkt: ${esc(lim.join(", "))}</p>`:""}
  ${openPoints(t).length?`<h2>Schwerpunkte aus dem Spiel</h2>${openPoints(t).filter(p=>!p.erledigt).map(p=>`<p>• ${esc(p.text)}</p>`).join("")}`:""}
  <h2>Ablauf</h2>${steps}<h2>Material (höchster gleichzeitiger Bedarf)</h2><table>${matList().filter(([k])=>need[k]).map(([k,l])=>`<tr><td>${esc(l)}</td><td>${need[k].n}</td><td class="src">${esc(need[k].ex)}</td></tr>`).join("")}</table>
  ${t.notizen?`<h2>Notizen</h2><p>${esc(t.notizen)}</p>`:""}</html>`;
  download(`Training_${t.datum||"ohne-Datum"}.html`,html);
}

const goView=e=>{const b=e.target.closest("[data-view]");if(!b)return;S.view=b.dataset.view;S.ui.backTo=null;render();window.scrollTo(0,0);};
document.getElementById("tabs").addEventListener("click",goView);
document.getElementById("gearBtn").addEventListener("click",goView);

$("#app").addEventListener("click",e=>{
  const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;const id=el.dataset.id;const i=+el.dataset.i;
  const t=S.trainings[S.sel.training],ex=S.uebungen[S.sel.uebung],sp=S.spiele[S.sel.spiel];
  switch(a){
    case "selTraining":S.sel.training=id;render();window.scrollTo(0,0);break;
    case "selUebung":S.sel.uebung=id;S.ui.backTo=null;render();window.scrollTo(0,0);break;
    case "selSpiel":S.sel.spiel=id;render();window.scrollTo(0,0);break;
    case "back":if(S.ui.backTo){S.view="training";S.ui.backTo=null;}else{const k={training:"training",uebungen:"uebung",spiele:"spiel"}[S.view];S.sel[k]=null;}render();break;
    case "backTraining":S.view="training";S.ui.backTo=null;render();break;
    case "newTraining":newTraining();break;
    case "att":{if(t.anwesenheit[id]==="ja")delete t.anwesenheit[id];else{t.anwesenheit[id]="ja";if(t.gruende)delete t.gruende[id];}saveLater("training",S.sel.training);render();break;}
    case "attMore":openAttDialog(id);break;
    case "attRest":{const lim=t.einschr||{};const rest=players().filter(p=>!t.anwesenheit[p.id]&&!lim[p.id]);
      if(!rest.length){toast("Niemand mehr offen – eingeschränkte Spielerinnen bleiben, wie sie sind.");break;}
      const skip=players().filter(p=>!t.anwesenheit[p.id]&&lim[p.id]).length;
      if(!confirmDel(`${rest.length} Spielerin${rest.length>1?"nen":""} auf „abwesend“ setzen?${skip?`\n\n${skip} eingeschränkte bleib${skip>1?"en":"t"} offen.`:""}`))break;
      rest.forEach(p=>t.anwesenheit[p.id]="nein");saveLater("training",S.sel.training);render();break;}
    case "attReset":if(!confirmDel("Anwesenheit für dieses Training komplett auf „offen“ zurücksetzen?\nEinschränkungen bleiben erhalten."))break;t.anwesenheit={};delete t.gruende;saveLater("training",S.sel.training);render();break;
    case "pick":S.ui.pickFocus=true;openPicker("");break;
    case "pickFor":S.ui.pickFocus=false;openPicker(el.dataset.v);break;
    case "stepOpen":S.ui.open[el.dataset.u]=!S.ui.open[el.dataset.u];render();break;
    case "unitUp":case "unitDown":{const us=unitsOf(t),u=+el.dataset.u,v=u+(a==="unitUp"?-1:1);if(v<0||v>=us.length)break;
      [us[u],us[v]]=[us[v],us[u]];t.ablauf=us.flatMap(x=>x.steps.map(st=>st.s));normBlocks(t);saveLater("training",S.sel.training);render();break;}
    case "stepDel":t.ablauf.splice(i,1);normBlocks(t);saveLater("training",S.sel.training);render();break;
    case "stepPar":{const us=unitsOf(t),ui=us.findIndex(u=>u.steps.some(st=>st.i===i));const prev=us[ui-1];if(!prev)break;
      if(prev.steps.length>=MAX_STATIONEN){toast(`Höchstens ${MAX_STATIONEN} Stationen gleichzeitig.`);break;}
      const b=prev.block||uid();prev.steps.forEach(st=>st.s.block=b);t.ablauf[i].block=b;
      if(t.bloecke&&t.bloecke[b])delete t.bloecke[b].gruppen;normBlocks(t);saveLater("training",S.sel.training);render();break;}
    case "stepSolo":{const us=unitsOf(t),u=us.find(x=>x.steps.some(st=>st.i===i));const s=t.ablauf[i];delete s.block;
      t.ablauf.splice(i,1);t.ablauf.splice(u.steps[u.steps.length-1].i,0,s); // hinter den Block
      if(u.block&&t.bloecke&&t.bloecke[u.block])delete t.bloecke[u.block].gruppen;normBlocks(t);saveLater("training",S.sel.training);render();break;}
    case "blkManual":{const us=unitsOf(t),u=us.find(x=>x.block===el.dataset.b);if(!u)break;t.bloecke=t.bloecke||{};const c=t.bloecke[u.block]=t.bloecke[u.block]||{};
      c.gruppen=unitGroups(t,u,headcount(t)).map(g=>({f:g.F,t:g.T}));saveLater("training",S.sel.training);render();break;}
    case "blkAuto":{const c=t.bloecke&&t.bloecke[el.dataset.b];if(c){delete c.gruppen;saveLater("training",S.sel.training);render();}break;}
    case "editEx":S.sel.uebung=id;S.ui.backTo="training";S.view="uebungen";render();window.scrollTo(0,0);break;
    case "ptDone":{const s=S.spiele[t.spielId];const p=s&&s.punkte.find(x=>x.id===el.dataset.pid);if(p){p.erledigt=!p.erledigt;saveLater("spiel",t.spielId);render();}break;}
    case "exportTraining":exportTraining(t);break;
    case "dupTraining":{const c=clone(t);c.datum=nextTrainingDay();c.anwesenheit={};delete c.gruende;c.ablauf=c.ablauf.map(s=>({...s,uid:uid()}));newTraining(c);toast("Kopie angelegt");break;}
    case "delTraining":if(confirmDel("Dieses Training löschen?")){removeDoc("training",S.sel.training);S.sel.training=null;render();}break;
    case "newEx":{const nid=newEx();S.sel.uebung=nid;S.ui.backTo=null;S.view="uebungen";render();setTimeout(()=>$('[data-key="e-name"]')?.focus(),0);break;}
    case "exTagToggle":{const v=el.dataset.v;ex.tags=ex.tags.includes(v)?ex.tags.filter(x=>x!==v):[...ex.tags,v];saveLater("uebung",S.sel.uebung);render();break;}
    case "matFromBoard":{Object.entries(boardMaterial(ex.board)).forEach(([k,n])=>{if(num(ex.material[k])<n)ex.material[k]=n;});saveLater("uebung",S.sel.uebung);render();toast("Material übernommen");break;}
    case "dupEx":{const nid=uid();const c=clone(ex);c.name=(c.name||"Übung")+" (Kopie)";S.uebungen[nid]=c;saveLater("uebung",nid);S.sel.uebung=nid;render();break;}
    case "delEx":{const used=Object.values(S.trainings).some(tr=>(tr.ablauf||[]).some(s=>s.uebungId===S.sel.uebung));if(confirmDel(used?"Die Übung steckt in gespeicherten Trainings. Trotzdem löschen?":"Diese Übung löschen?")){removeDoc("uebung",S.sel.uebung);S.sel.uebung=null;render();}break;}
    case "newSpiel":{const nid=uid();S.spiele[nid]={team:S.team,gegner:"",datum:today(),ergebnis:"",wettbewerb:"",punkte:[],fazit:""};S.sel.spiel=nid;saveLater("spiel",nid);render();setTimeout(()=>$('[data-key="s-gegner"]')?.focus(),0);break;}
    case "ptArt":{const p=sp.punkte[i];p.art=ARTS[(ARTS.indexOf(p.art||"info")+1)%3];saveLater("spiel",S.sel.spiel);render();break;}
    case "ptStar":{const p=sp.punkte[i];p.trainieren=!p.trainieren;saveLater("spiel",S.sel.spiel);render();break;}
    case "ptDel":sp.punkte.splice(i,1);saveLater("spiel",S.sel.spiel);render();break;
    case "ptAdd":addPoint(+el.dataset.hz);break;
    case "trainingFromSpiel":newTraining({spielId:S.sel.spiel,thema:""});break;
    case "delSpiel":if(confirmDel("Diesen Spielbericht löschen?")){removeDoc("spiel",S.sel.spiel);S.sel.spiel=null;render();}break;
    case "pTw":{const p=pById(id);p.tw=!p.tw;saveLater("kader");render();break;}
    case "pDel":{const p=pById(id);if(confirmDel(`${p.name} aus dem Kader entfernen?`)){S.kader.players=players().filter(x=>x.id!==id);saveLater("kader");render();}break;}
    case "pAdd":addPlayers();break;
    case "tagDel":S.settings.tags=S.settings.tags.filter(x=>x!==el.dataset.v);saveLater("settings");render();break;
    case "tagAdd":addTag();break;
    case "backup":doBackup(false);break;
    case "backupShare":doBackup(true);break;
    case "hideReminder":S.ui.reminderHidden=true;render();break;
    case "import":$("#importFile").click();break;
  }
});
function confirmDel(msg){try{return window.confirm(msg);}catch(e){return true;}}
function addPoint(hz){const inp=$(`[data-act="ptNew"][data-hz="${hz}"]`);const v=inp.value.trim();if(!v)return;const sp=S.spiele[S.sel.spiel];sp.punkte.push({id:uid(),text:v,art:"minus",hz,tag:"",trainieren:false});inp.value="";saveLater("spiel",S.sel.spiel);render();$(`[data-act="ptNew"][data-hz="${hz}"]`)?.focus();}
function addPlayers(){const inp=$('[data-act="pNew"]');const names=inp.value.split(",").map(s=>s.trim()).filter(Boolean);if(!names.length)return;S.kader.players=players().concat(names.map(n=>({id:uid(),name:n,tw:false})));saveLater("kader");inp.value="";render();$('[data-act="pNew"]')?.focus();}
function addTag(){const inp=$('[data-act="tagNew"]');const v=inp.value.trim();if(!v||S.settings.tags.includes(v))return;S.settings.tags.push(v);saveLater("settings");render();}

$("#app").addEventListener("keydown",e=>{if(e.key!=="Enter")return;const a=e.target.dataset.act;
  if(a==="ptNew"){e.preventDefault();addPoint(+e.target.dataset.hz);} if(a==="pNew"){e.preventDefault();addPlayers();} if(a==="tagNew"){e.preventDefault();addTag();}});

$("#app").addEventListener("input",e=>{
  const el=e.target;const [kind,id]=curObj();
  if(el.dataset.bind&&!el.hasAttribute("data-rr")){objFor(kind,id)[el.dataset.bind]=el.value;saveLater(kind,id);return;}
  const a=el.dataset.act;
  if(a==="exQ"){S.ui.q=el.value;render();return;}
  if(a==="stepNote"){S.trainings[S.sel.training].ablauf[+el.dataset.i].notiz=el.value;saveLater("training",S.sel.training);return;}
  if(a==="ptText"){S.spiele[S.sel.spiel].punkte[+el.dataset.i].text=el.value;saveLater("spiel",S.sel.spiel);return;}
  if(el.dataset.mat){const ex=S.uebungen[S.sel.uebung];ex.material[el.dataset.mat]=el.value===""?"":num(el.value);saveLater("uebung",S.sel.uebung);return;}
  if(el.dataset.inv){S.settings.inventar[el.dataset.inv]=el.value===""?null:num(el.value);saveLater("settings");return;}
  if(el.dataset.set){S.settings[el.dataset.set]=el.type==="number"?num(el.value):el.value;saveLater("settings");return;}
});
$("#app").addEventListener("change",e=>{
  const el=e.target;const [kind,id]=curObj();
  if(el.dataset.bind&&el.hasAttribute("data-rr")){const o=objFor(kind,id);o[el.dataset.bind]=el.type==="number"?(el.value===""?"":num(el.value)):el.value;saveLater(kind,id);render();return;}
  const a=el.dataset.act;
  if(a==="exTag"){S.ui.tag=el.value;render();}
  if(a==="stepDur"){S.trainings[S.sel.training].ablauf[+el.dataset.i].dauer=num(el.value);saveLater("training",S.sel.training);render();}
  if(a==="blkRound"||a==="blkRounds"||a==="blkGrp"){const t=S.trainings[S.sel.training];t.bloecke=t.bloecke||{};const c=t.bloecke[el.dataset.b]=t.bloecke[el.dataset.b]||{};
    if(a==="blkRound"){if(el.value==="")delete c.rundenDauer;else c.rundenDauer=Math.max(1,num(el.value));}
    else if(a==="blkRounds"){if(el.value==="")delete c.runden;else c.runden=Math.max(1,num(el.value));}
    else if(Array.isArray(c.gruppen)&&c.gruppen[+el.dataset.g])c.gruppen[+el.dataset.g][el.dataset.f]=Math.max(0,num(el.value));
    saveLater("training",S.sel.training);render();}
  if(a==="ptTag"){S.spiele[S.sel.spiel].punkte[+el.dataset.i].tag=el.value;saveLater("spiel",S.sel.spiel);}
});

/* overlay */
$("#overlay").addEventListener("click",e=>{
  const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  if(a==="closeOv"&&(e.target===el||el.tagName==="BUTTON")){$("#overlay").innerHTML="";return;}
  if(a==="pickTag"){S.ui.pickTag=el.dataset.v;S.ui.pickFocus=false;renderPicker();}
  if(a==="addStep"){const t=S.trainings[S.sel.training];t.ablauf.push({uid:uid(),uebungId:el.dataset.id,notiz:""});saveLater("training",S.sel.training);$("#overlay").innerHTML="";render();toast("Übung hinzugefügt");}
  if(a==="newExFromPick"){const nid=newEx();const t=S.trainings[S.sel.training];t.ablauf.push({uid:uid(),uebungId:nid,notiz:""});saveLater("training",S.sel.training);$("#overlay").innerHTML="";S.sel.uebung=nid;S.ui.backTo="training";S.view="uebungen";render();window.scrollTo(0,0);setTimeout(()=>$('[data-key="e-name"]')?.focus(),0);}
});
$("#overlay").addEventListener("input",e=>{if(e.target.dataset.act==="pickQ"){S.ui.pickQ=e.target.value;S.ui.pickFocus=true;renderPicker();}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#overlay").innerHTML)$("#overlay").innerHTML="";});

/* import */
$("#importFile").addEventListener("change",async e=>{
  const f=e.target.files[0];e.target.value="";if(!f)return;
  let d,raw;
  try{raw=JSON.parse(await f.text());}catch(err){toast("Die Datei ist keine gültige Datei des Trainingsplaners.");return;}
  if(raw&&raw.typ===SHARE_TYP){importShared(raw);return;}
  const neuerMsg="Diese Datei stammt aus einer neueren Version der App. Bitte zuerst die App aktualisieren.";
  if(raw&&raw.typ===TEAM_TYP){
    if(num(raw.version)>DATA_VERSION){toast(neuerMsg);return;}if(!raw.team||!raw.kader){toast("Die Datei ist keine gültige Mannschafts-Sicherung.");return;}
    const da=S.teamsDoc.list.find(t=>t.id===raw.team.id);const n=k=>Object.keys(raw[k]||{}).length;
    if(!confirmDel(`Mannschaft „${raw.team.name}“ einspielen?\n\n${raw.kader.players.length} Spielerinnen, ${n("trainings")} Trainings, ${n("spiele")} Spielberichte, ${n("uebungen")} Übungen.\n\n${da?`Die vorhandene Mannschaft „${da.name}“ wird ergänzt: Kader ersetzt, Trainings/Spiele mit gleicher Kennung überschrieben, alles andere bleibt.`:"Sie wird als neue Mannschaft angelegt."}\nVorhandene Übungen werden nicht verändert.`))return;
    flushAll();try{await importTeam(raw);S.sel.training=null;S.sel.spiel=null;render();toast("Mannschaft eingespielt");}catch(err){toast("Einspielen fehlgeschlagen – bitte erneut versuchen.");}
    return;}
  try{d=migrateBackup(raw);}
  catch(err){toast(err&&err.message==="neuer"?neuerMsg:"Die Datei ist keine gültige Sicherung des Trainingsplaners.");return;}
  const n=k=>Object.keys(d[k]||{}).length;const np=Object.values(d.kaders).reduce((a,k)=>a+(k.players||[]).length,0);
  if(!confirmDel(`Sicherung einspielen?\n\n${d.teams.list.length} Mannschaft${d.teams.list.length>1?"en":""} (${d.teams.list.map(t=>t.name).join(", ")}), ${np} Spielerinnen, ${n("uebungen")} Übungen, ${n("trainings")} Trainings, ${n("spiele")} Spielberichte.\n\nEinstellungen und die Kader dieser Mannschaften werden ersetzt, Einträge mit gleicher Kennung überschrieben. Andere Mannschaften und alles andere bleiben erhalten.`))return;
  flushAll();
  try{await importBackup(d);render();toast("Sicherung eingespielt");}
  catch(err){toast("Einspielen fehlgeschlagen – es wurde nichts verändert.");}
});

/* Farbmodus: Automatisch (wie das Gerät) → Hell → Dunkel. Gilt nur für dieses Gerät. */
/* Farbmodus: Standard Dunkel (schwarz), dazu Hell und Automatisch (wie das Gerät). Gilt nur für dieses Gerät. */
const THEMES=[["dark","Dunkel","☾"],["light","Hell","☀"],["auto","Auto","◐"]];const THEME_KEY="tp-farbmodus";
const curTheme=()=>{try{return localStorage.getItem(THEME_KEY)||"dark";}catch(e){return "dark";}};
function applyTheme(){
  const t=curTheme();document.documentElement.dataset.theme=t;
  const [,lab,ic]=THEMES.find(x=>x[0]===t)||THEMES[0];const b=$("#themeBtn");
  b.innerHTML=`<span aria-hidden="true">${ic}</span><span class="tlab">${lab}</span>`;b.title=`Farbmodus: ${lab} (tippen zum Wechseln)`;
  document.querySelector('meta[name="theme-color"]').content=t==="light"||(t==="auto"&&matchMedia("(prefers-color-scheme: light)").matches)?"#111111":"#0D0D0D";
}
$("#themeBtn").addEventListener("click",()=>{const n=THEMES[(THEMES.findIndex(x=>x[0]===curTheme())+1)%THEMES.length][0];try{localStorage.setItem(THEME_KEY,n);}catch(e){}applyTheme();});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",applyTheme);
applyTheme();

/* Offline-Fähigkeit: Service Worker nur über http(s), nicht beim Öffnen per Doppelklick. */
if("serviceWorker" in navigator&&location.protocol.startsWith("http")){
  // Kommt eine neue Version an, einmal automatisch neu laden (vorher alles speichern).
  const hadController=!!navigator.serviceWorker.controller;let reloaded=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!hadController||reloaded)return;reloaded=true;flushAll();setTimeout(()=>location.reload(),300);});
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>r.update()).catch(()=>{}));
}

document.addEventListener("toggle",e=>{const d=e.target;if(d.dataset&&d.dataset.dkey){S.ui.open["d"+d.dataset.dkey.replace("-","")]=d.open;}},true);
init();
