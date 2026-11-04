"use strict";
/* ---------- Einstellungen: Auswahllisten, Material, Standards, Datensicherung ----------
   Jede Liste weiß, wo ihre Einträge verwendet werden – so werden Umbenennungen überall
   mitgezogen und beim Löschen wird nachgefragt, wenn ein Eintrag noch in Gebrauch ist. */
const LISTEN={
  tags:{titel:"Trainingsinhalte",hint:"Verbinden Übungen mit Kritikpunkten aus dem Spiel und zählen in der Statistik.",
    get:()=>S.settings.tags,
    uses:v=>{const u=Object.entries(S.uebungen).filter(([,e])=>(e.tags||[]).includes(v));const p=[];Object.entries(S.spiele).forEach(([id,s])=>(s.punkte||[]).forEach(x=>{if(x.tag===v)p.push(id);}));
      return {n:u.length+p.length,txt:[u.length&&`${u.length} Übung${u.length>1?"en":""}`,p.length&&`${p.length} Beobachtung${p.length>1?"en":""}`].filter(Boolean).join(" und ")};},
    apply:(v,neu)=>{Object.entries(S.uebungen).forEach(([id,e])=>{if((e.tags||[]).includes(v)){e.tags=neu?[...new Set(e.tags.map(x=>x===v?neu:x))]:e.tags.filter(x=>x!==v);saveLater("uebung",id);}});
      Object.entries(S.spiele).forEach(([id,s])=>{let ch=false;(s.punkte||[]).forEach(x=>{if(x.tag===v){x.tag=neu||"";ch=true;}});if(ch)saveLater("spiel",id);});}},
  kategorien:{titel:"Übungskategorien",hint:"Gruppieren die Übungssammlung und färben die Zeitleiste im Training.",
    get:()=>S.settings.kategorien,
    uses:v=>{const n=Object.values(S.uebungen).filter(e=>e.kategorie===v).length;return {n,txt:`${n} Übung${n>1?"en":""}`};},
    apply:(v,neu)=>Object.entries(S.uebungen).forEach(([id,e])=>{if(e.kategorie===v){e.kategorie=neu||"";saveLater("uebung",id);}})},
  gruende:{titel:"Gründe für Fehlen und Einschränkung",hint:"Zur Auswahl, wenn eine Spielerin fehlt oder eingeschränkt ist.",
    get:()=>S.settings.gruende,
    uses:v=>{let n=players().filter(p=>p.einschr&&p.einschr.grund===v).length;
      Object.values(S.trainings).forEach(t=>{["einschr","gruende"].forEach(f=>Object.values(t[f]||{}).forEach(g=>{if(g&&g.grund===v)n++;}));});
      return {n,txt:`${n} Eintr${n>1?"ägen":"ag"} bei Spielerinnen und Trainings`};},
    apply:(v,neu)=>{let kch=false;players().forEach(p=>{if(p.einschr&&p.einschr.grund===v){p.einschr.grund=neu||"Sonstiges";kch=true;}});if(kch)saveLater("kader");
      Object.entries(S.trainings).forEach(([id,t])=>{let ch=false;["einschr","gruende"].forEach(f=>Object.values(t[f]||{}).forEach(g=>{if(g&&g.grund===v){g.grund=neu||"Sonstiges";ch=true;}}));if(ch)saveLater("training",id);});}},
  positionen:{titel:"Positionen",hint:"Für den Kader, z. B. zum Sortieren und Suchen.",
    get:()=>S.settings.positionen,
    uses:v=>{const n=players().filter(p=>p.position===v).length;return {n,txt:`${n} Spielerin${n>1?"nen":""}`};},
    apply:(v,neu)=>{let ch=false;players().forEach(p=>{if(p.position===v){p.position=neu||"";ch=true;}});if(ch)saveLater("kader");}},
};
/* Material: Kennung (k) bleibt fest, nur die Bezeichnung (l) ist frei – Übungen speichern die Kennung. */
const matUses=k=>{const n=Object.values(S.uebungen).filter(e=>num(e.material&&e.material[k])>0).length;return {n,txt:`${n} Übung${n>1?"en":""}`};};

function vEinstellungen(){
  const listBlock=key=>{const L=LISTEN[key];const arr=L.get();
    return `<section class="blk"><h3>${esc(L.titel)} <span class="sub">${arr.length} Einträge</span></h3><p class="hint">${esc(L.hint)}</p>
      <details class="fold" data-dkey="set-${key}"${S.ui.open["dset"+key]?" open":""}><summary>Einträge bearbeiten</summary>
      <div class="lsed">${arr.map((v,i)=>`<div class="lsrow"><input class="inp" data-key="ls-${key}-${i}" data-act="lsRename" data-l="${key}" data-i="${i}" value="${esc(v)}" aria-label="${esc(L.titel)}: ${esc(v)}">
        <span class="lsuse">${(()=>{const u=L.uses(v);return u.n?esc(u.txt):"nicht verwendet";})()}</span>
        <span class="ctl"><button class="iconbtn" data-act="lsUp" data-l="${key}" data-i="${i}" aria-label="Nach oben"${i?"":" disabled"}>↑</button><button class="iconbtn" data-act="lsDown" data-l="${key}" data-i="${i}" aria-label="Nach unten"${i<arr.length-1?"":" disabled"}>↓</button><button class="iconbtn" data-act="lsDel" data-l="${key}" data-i="${i}" aria-label="${esc(v)} löschen">✕</button></span></div>`).join("")}</div>
      <div class="addpt"><input class="inp" data-key="lsnew-${key}" data-act="lsNew" data-l="${key}" placeholder="Neuer Eintrag"><button class="btn" data-act="lsAdd" data-l="${key}">Hinzufügen</button></div></details></section>`;};
  const inv=S.settings.inventar||{};const mat=S.settings.material||[];
  const vu=S.meta.vorUpdate;
  const cnt=tid=>({p:(S.kaders[tid]&&S.kaders[tid].players||[]).length,t:Object.values(S.trainings).filter(o=>o.team===tid).length,s:Object.values(S.spiele).filter(o=>o.team===tid).length});
  return `<div class="narrow"><h2 class="page-h">Einstellungen</h2>
  <section class="blk" id="mannschaften"><h3>Mannschaften <span class="sub">${S.teamsDoc.list.length}</span></h3>
    <p class="hint">Jede Mannschaft hat eigenen Kader, eigene Trainings, Spiele und Statistik. Übungen und alle Listen unten gelten für alle.</p>
    <div class="lsed">${S.teamsDoc.list.map((t,i)=>{const c=cnt(t.id);return `<div class="tmrow${t.id===S.team?" cur":""}">
      <input class="inp" data-key="tm-${t.id}" data-act="tmRename" data-id="${esc(t.id)}" value="${esc(t.name)}" aria-label="Name der Mannschaft">
      <label class="lsinv">Beginn <input class="inp" type="time" data-key="tms-${t.id}" data-act="tmSet" data-f="start" data-id="${esc(t.id)}" value="${esc(t.start||"19:00")}"></label>
      <label class="lsinv">Dauer <input class="inp" type="number" min="0" data-key="tmd-${t.id}" data-act="tmSet" data-f="dauer" data-id="${esc(t.id)}" value="${esc(t.dauer||90)}"></label>
      <span class="lsuse">${c.p} Spielerinnen · ${c.t} Trainings · ${c.s} Spiele${t.id===S.team?" · <b>gewählt</b>":""}</span>
      <span class="ctl">${t.id!==S.team?`<button class="btn sm" data-act="tmPick" data-id="${esc(t.id)}">Wählen</button>`:""}<button class="iconbtn" data-act="tmDel" data-id="${esc(t.id)}" aria-label="${esc(t.name)} löschen"${S.teamsDoc.list.length<2?" disabled":""}>✕</button></span></div>`;}).join("")}</div>
    <div class="addpt"><input class="inp" data-key="tmnew" data-act="tmNew" placeholder="Neue Mannschaft, z. B. Damen 2"><button class="btn" data-act="tmAdd">Anlegen</button></div>
    <p class="legend">Beginn und Dauer sind die Vorgaben für neue Trainings dieser Mannschaft.</p></section>
  ${listBlock("tags")}${listBlock("kategorien")}
  <section class="blk"><h3>Material und Bestand <span class="sub">${mat.length} Sorten</span></h3><p class="hint">Bezeichnung ändern, Bestand eintragen (leer = wird nicht geprüft), sortieren.</p>
    <details class="fold" data-dkey="set-material"${S.ui.open.dsetmaterial?" open":""}><summary>Material und Bestand bearbeiten</summary>
    <div class="lsed">${mat.map((m,i)=>`<div class="lsrow mat"><input class="inp" data-key="mt-${m.k}" data-act="mtRename" data-i="${i}" value="${esc(m.l)}" aria-label="Material: ${esc(m.l)}">
      <label class="lsinv">Bestand <input class="inp" type="number" min="0" data-key="inv-${m.k}" data-inv="${esc(m.k)}" value="${esc(inv[m.k]??"")}"></label>
      <span class="ctl"><button class="iconbtn" data-act="mtUp" data-i="${i}" aria-label="Nach oben"${i?"":" disabled"}>↑</button><button class="iconbtn" data-act="mtDown" data-i="${i}" aria-label="Nach unten"${i<mat.length-1?"":" disabled"}>↓</button><button class="iconbtn" data-act="mtDel" data-i="${i}" aria-label="${esc(m.l)} löschen">✕</button></span></div>`).join("")}</div>
    <div class="addpt"><input class="inp" data-key="mtnew" data-act="mtNew" placeholder="Neues Material"><button class="btn" data-act="mtAdd">Hinzufügen</button></div></details>
    <div class="meta" style="margin-top:14px"><label class="f">Leibchen pro Satz<input type="number" min="0" data-key="inv-ps" data-set="leibchenProSatz" value="${esc(S.settings.leibchenProSatz??"")}"></label></div></section>
  ${listBlock("gruende")}${listBlock("positionen")}
  ${syncBlock()}
  <section class="blk"><h3>Datensicherung <span class="sub">${S.meta.letzteSicherung?"zuletzt am "+esc(fmtStamp(S.meta.letzteSicherung)):"noch keine Sicherung"}</span></h3>
   <p class="hint">Deine Daten liegen auf diesem Gerät. Lade regelmäßig eine Sicherung herunter, z. B. nach jedem Spieltag. Mit derselben Datei bringst du die Daten auch auf ein anderes Gerät. Über „Einspielen“ kannst du auch geteilte Trainings und Übungen anderer Trainer übernehmen.</p>
   <div class="row-actions" style="margin-top:0"><button class="btn pri" data-act="backup">Alles sichern</button><button class="btn" data-act="backupTeam">Nur „${esc(teamName())}“ sichern</button>${canShareFiles()?'<button class="btn" data-act="backupShare">Alles teilen …</button>':""}<button class="btn" data-act="import">Datei einspielen</button></div>
   <p class="legend">„Alles“ enthält alle Mannschaften, Übungen und Listen. „Nur Mannschaft“ enthält deren Kader, Trainings und Spiele samt der verwendeten Übungen – zum Weitergeben oder Wiederherstellen einer einzelnen Mannschaft.</p>
   ${vu?`<p class="legend">Vor dem Update am ${esc(fmtStamp(vu.am))} hat die App deinen alten Stand gesichert. <button class="btn sm ghost" data-act="vorUpdate">Alten Stand herunterladen</button></p>`:""}
   <p class="legend">${S.mode==="db"?(S.persistent?"Der Browser hat zugesagt, die Daten nicht von selbst zu löschen.":"Tipp: Installiere die App auf dem Startbildschirm, dann löscht der Browser die Daten nicht von selbst."):"Achtung: Gerade wird nur vorläufig gespeichert."}</p></section></div>`;
}

function listMove(arr,i,d){const j=i+d;if(j<0||j>=arr.length)return false;[arr[i],arr[j]]=[arr[j],arr[i]];return true;}
function lsAdd(key){const inp=$(`[data-act="lsNew"][data-l="${key}"]`);const v=inp.value.trim();const arr=LISTEN[key].get();
  if(!v)return;if(arr.includes(v)){toast("Diesen Eintrag gibt es schon.");return;}arr.push(v);saveLater("settings");render();$(`[data-act="lsNew"][data-l="${key}"]`)?.focus();}
function mtAdd(){const inp=$('[data-act="mtNew"]');const l=inp.value.trim();if(!l)return;const mat=S.settings.material;
  if(mat.some(m=>m.l.toLowerCase()===l.toLowerCase())){toast("Dieses Material gibt es schon.");return;}
  let k=l.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"");if(!k)k="m";let base=k,n=2;while(mat.some(m=>m.k===k))k=base+(n++);
  mat.push({k,l});saveLater("settings");render();$('[data-act="mtNew"]')?.focus();}

$("#app").addEventListener("click",e=>{
  const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act,key=el.dataset.l,i=+el.dataset.i;
  if(a==="lsUp"||a==="lsDown"){if(listMove(LISTEN[key].get(),i,a==="lsUp"?-1:1)){saveLater("settings");render();}}
  else if(a==="lsDel"){const L=LISTEN[key],arr=L.get(),v=arr[i],u=L.uses(v);
    if(!confirmDel(u.n?`„${v}“ wird noch verwendet (${u.txt}).\n\nTrotzdem löschen? Dort wird der Eintrag entfernt.`:`„${v}“ löschen?`))return;
    if(u.n)L.apply(v,null);arr.splice(i,1);saveLater("settings");render();toast("Gelöscht");}
  else if(a==="lsAdd")lsAdd(key);
  else if(a==="mtUp"||a==="mtDown"){if(listMove(S.settings.material,i,a==="mtUp"?-1:1)){saveLater("settings");render();}}
  else if(a==="mtDel"){const m=S.settings.material[i],u=matUses(m.k);
    if(!confirmDel(u.n?`„${m.l}“ ist noch in ${u.txt} eingetragen.\n\nTrotzdem löschen? Dort wird es entfernt.`:`„${m.l}“ löschen?`))return;
    Object.entries(S.uebungen).forEach(([id,ex])=>{if(ex.material&&m.k in ex.material){delete ex.material[m.k];saveLater("uebung",id);}});
    if(S.settings.inventar)delete S.settings.inventar[m.k];S.settings.material.splice(i,1);saveLater("settings");render();toast("Gelöscht");}
  else if(a==="mtAdd")mtAdd();
  else if(a==="vorUpdate")downloadVorUpdate();
});
$("#app").addEventListener("keydown",e=>{if(e.key!=="Enter")return;const a=e.target.dataset.act;
  if(a==="lsNew"){e.preventDefault();lsAdd(e.target.dataset.l);}if(a==="mtNew"){e.preventDefault();mtAdd();}
  if(a==="lsRename"||a==="mtRename"){e.preventDefault();e.target.blur();}});
/* Umbenennen erst beim Verlassen des Feldes – dann werden alle Verwendungen mitgeändert. */
$("#app").addEventListener("change",e=>{
  const el=e.target,a=el.dataset.act;
  if(a==="lsRename"){const L=LISTEN[el.dataset.l],arr=L.get(),i=+el.dataset.i,alt=arr[i],neu=el.value.trim();
    if(!neu||neu===alt){el.value=alt;return;}
    if(arr.includes(neu)){toast("Diesen Eintrag gibt es schon.");el.value=alt;return;}
    const u=L.uses(alt);if(u.n)L.apply(alt,neu);arr[i]=neu;saveLater("settings");render();toast(u.n?`Umbenannt – auch in ${u.txt}`:"Umbenannt");}
  if(a==="mtRename"){const m=S.settings.material[+el.dataset.i],neu=el.value.trim();if(!neu){el.value=m.l;return;}m.l=neu;saveLater("settings");render();}
});
async function downloadVorUpdate(){
  try{const v=await idbGet("meta","vorUpdate");if(!v){toast("Keine Sicherung vom Update vorhanden.");return;}
    download(`Trainingsplaner_vor_Update_${iso(new Date(v.am))}.json`,JSON.stringify(v.daten,null,1));}catch(e){toast("Konnte nicht gelesen werden.");}
}

/* ---------- Mannschaften ---------- */
function switchTeam(id){flushAll();pickTeam(id);S.sel.training=null;S.sel.spiel=null;S.ui.kq="";render();window.scrollTo(0,0);toast(`Mannschaft: ${teamName()}`);}
$("#teamSel").addEventListener("change",e=>{const v=e.target.value;if(v==="__verwalten"){e.target.value=S.team;S.view="einstellungen";render();setTimeout(()=>$("#mannschaften")?.scrollIntoView({block:"start"}),0);return;}switchTeam(v);});
function tmAdd(){const inp=$('[data-act="tmNew"]');const name=inp.value.trim();if(!name)return;
  if(S.teamsDoc.list.some(t=>t.name.toLowerCase()===name.toLowerCase())){toast("Diese Mannschaft gibt es schon.");return;}
  const cur=teamCfg();const id="t"+uid();S.teamsDoc.list.push({id,name,start:cur.start||"19:00",dauer:cur.dauer||90});S.kaders[id]={players:[]};
  saveLater("teams");saveLater("kader",id);switchTeam(id);S.view="einstellungen";render();}
async function tmDel(id){
  const t=S.teamsDoc.list.find(x=>x.id===id);if(!t)return;if(S.teamsDoc.list.length<2){toast("Die letzte Mannschaft kann nicht gelöscht werden.");return;}
  const tr=Object.keys(S.trainings).filter(k=>S.trainings[k].team===id),sp=Object.keys(S.spiele).filter(k=>S.spiele[k].team===id),np=(S.kaders[id]&&S.kaders[id].players||[]).length;
  let ok=false;try{const a=window.prompt(`Mannschaft „${t.name}“ endgültig löschen?\n\nDabei werden gelöscht: ${np} Spielerinnen, ${tr.length} Trainings, ${sp.length} Spielberichte (inklusive Anwesenheit und Statistik).\nÜbungen und Listen bleiben erhalten.\n\nTipp: Vorher „Nur „${t.name}“ sichern“.\n\nZum Bestätigen den Namen der Mannschaft eintippen:`);ok=a!=null&&a.trim()===t.name.trim();if(a!=null&&!ok)toast("Name stimmt nicht – nichts gelöscht.");}catch(e){ok=false;}
  if(!ok)return;
  for(const k of tr)await removeDoc("training",k);for(const k of sp)await removeDoc("spiel",k);
  delete S.kaders[id];if(S.mode==="db"){try{await idbWrite([["meta","kader:"+id,null]]);}catch(e){}}syncMark("kader",id,true);
  S.teamsDoc.list=S.teamsDoc.list.filter(x=>x.id!==id);saveLater("teams");
  if(S.team===id)pickTeam(S.teamsDoc.list[0].id);render();toast(`„${t.name}“ gelöscht`);
}
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  if(a==="tmAdd")tmAdd();
  if(a==="tmPick"){switchTeam(el.dataset.id);S.view="einstellungen";render();}
  if(a==="tmDel")tmDel(el.dataset.id);
  if(a==="backupTeam"){const d=teamBackupData(S.team);download(`Trainingsplaner_${slug(teamName())}_${today()}.json`,JSON.stringify(d,null,1));toast("Mannschaft gesichert");}
});
$("#app").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.dataset.act==="tmNew"){e.preventDefault();tmAdd();}if(e.key==="Enter"&&e.target.dataset.act==="tmRename"){e.preventDefault();e.target.blur();}});
$("#app").addEventListener("change",e=>{const el=e.target,a=el.dataset.act;if(a!=="tmRename"&&a!=="tmSet")return;const t=S.teamsDoc.list.find(x=>x.id===el.dataset.id);if(!t)return;
  if(a==="tmRename"){const n=el.value.trim();if(!n||S.teamsDoc.list.some(x=>x!==t&&x.name.toLowerCase()===n.toLowerCase())){el.value=t.name;if(n)toast("Diesen Namen gibt es schon.");return;}t.name=n;}
  else t[el.dataset.f]=el.dataset.f==="dauer"?num(el.value):el.value;
  saveLater("teams");render();});
