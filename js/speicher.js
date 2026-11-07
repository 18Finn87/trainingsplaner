"use strict";
/* ---------- storage: IndexedDB im Browser ----------
   meta/teams (Mannschaften), meta/kader:<team> (Kader je Mannschaft), meta/settings (gemeinsame Listen),
   uebungen/<id> (gemeinsam), trainings/<id> und spiele/<id> (je mit Feld team).
   meta/schema hält die Version des Datenformats (für Migrationen). */
const DB_NAME="trainingsplaner",DB_VER=1,DATA_VERSION=13;
const LS="trainingsplaner-v1",LS_TEAM="tp-mannschaft";
const STORE={uebung:"uebungen",training:"trainings",spiel:"spiele"};
let idb=null;const dirty=new Set();const timers={};
const kanal=("BroadcastChannel" in window)?new BroadcastChannel("trainingsplaner"):null;

function idbOpen(){
  return new Promise((res,rej)=>{
    if(!window.indexedDB)return rej(new Error("kein IndexedDB"));
    const r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded=()=>{const d=r.result;["meta","uebungen","trainings","spiele"].forEach(n=>{if(!d.objectStoreNames.contains(n))d.createObjectStore(n);});};
    r.onsuccess=()=>{const d=r.result;d.onversionchange=()=>d.close();res(d);};
    r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error("blockiert"));
  });
}
function idbLoadAll(){
  return new Promise((res,rej)=>{
    const out={meta:{},uebungen:{},trainings:{},spiele:{}};
    const t=idb.transaction(Object.keys(out),"readonly");
    Object.keys(out).forEach(n=>{const c=t.objectStore(n).openCursor();c.onsuccess=()=>{const cur=c.result;if(cur){out[n][cur.key]=cur.value;cur.continue();}};});
    t.oncomplete=()=>res(out);t.onerror=t.onabort=()=>rej(t.error);
  });
}
/* writes: [[store,key,value]] – value null löscht. Alles in einer Transaktion: ganz oder gar nicht. */
function idbWrite(writes){
  return new Promise((res,rej)=>{
    const t=idb.transaction([...new Set(writes.map(w=>w[0]))],"readwrite");
    writes.forEach(([st,k,v])=>v==null?t.objectStore(st).delete(k):t.objectStore(st).put(v,k));
    t.oncomplete=()=>res();t.onerror=t.onabort=()=>rej(t.error);
  });
}
function idbGet(st,k){return new Promise((res,rej)=>{const r=idb.transaction(st).objectStore(st).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}

/* Der Kader gehört zu einer Mannschaft: id = Mannschaft ("x" = die gerade gewählte). */
const kaderTeam=id=>id&&id!=="x"?id:(S.team||"team1");
function locate(kind,id){
  if(kind==="kader")return ["meta","kader:"+kaderTeam(id)];
  if(kind==="planung")return ["meta","planung:"+kaderTeam(id)];
  if(kind==="settings"||kind==="teams"||kind==="vorlagen")return ["meta",kind];
  return [STORE[kind],id];
}
function objFor(kind,id){
  if(kind==="kader")return S.kaders[kaderTeam(id)];
  if(kind==="planung")return S.planungen[kaderTeam(id)];
  if(kind==="settings")return S.settings;if(kind==="teams")return S.teamsDoc;if(kind==="vorlagen")return S.vorlagenDoc;
  return kind==="uebung"?S.uebungen[id]:kind==="training"?S.trainings[id]:S.spiele[id];
}
function saveLater(kind,id="x"){
  if(kind==="kader"||kind==="planung")id=kaderTeam(id); // Mannschaft sofort festhalten – auch wenn gleich gewechselt wird
  const k=kind+"/"+id;dirty.add(k);clearTimeout(timers[k]);setStatus("Speichert …");
  timers[k]=setTimeout(()=>flush(kind,id),650);
}
async function flush(kind,id){
  const k=kind+"/"+id;delete timers[k];const o=objFor(kind,id);
  if(S.mode==="local"){saveLocal();setStatus("Gespeichert");dirty.delete(k);return;}
  if(!o){dirty.delete(k);return;}
  try{o.updatedAt=Date.now();await idbWrite([[...locate(kind,id),clone(o)]]);setStatus("Gespeichert");journalDone(k);if(kanal)kanal.postMessage({kind,id});syncMark(kind,id);}
  catch(e){
    setStatus("Nicht gespeichert");
    toast(e&&e.name==="QuotaExceededError"?"Speicher voll – lösche alte Einträge, damit Neues gespeichert wird.":"Speichern fehlgeschlagen. Ändere den Eintrag erneut oder lade die Seite neu.");
  }finally{dirty.delete(k);}
}
/* Beim Wegwischen der App oder Tab-Wechsel sofort speichern, nicht erst nach der Pause.
   Weil der Browser beim Schließen eine laufende Datenbank-Schreibung abbrechen kann, landet der
   Stand vorher zusätzlich als Notfall-Kopie im localStorage (das geht sofort). Beim nächsten Start
   wird sie übernommen; nach erfolgreichem Speichern wieder gelöscht. */
const JOURNAL="trainingsplaner-journal";
function journalRead(){try{return JSON.parse(localStorage.getItem(JOURNAL)||"{}")||{};}catch(e){return {};}}
function journalDone(k){const j=journalRead();if(!(k in j))return;delete j[k];try{Object.keys(j).length?localStorage.setItem(JOURNAL,JSON.stringify(j)):localStorage.removeItem(JOURNAL);}catch(e){}}
function flushAll(){
  const ks=Object.keys(timers);if(!ks.length)return;
  if(S.mode==="db"){const j=journalRead();ks.forEach(k=>{const i=k.indexOf("/");const o=objFor(k.slice(0,i),k.slice(i+1));if(o)j[k]=o;});try{localStorage.setItem(JOURNAL,JSON.stringify(j));}catch(e){}}
  ks.forEach(k=>{clearTimeout(timers[k]);const i=k.indexOf("/");flush(k.slice(0,i),k.slice(i+1));});
}
async function journalReplay(x){
  const j=journalRead();const ks=Object.keys(j);if(!ks.length)return;
  const w=ks.map(k=>{const i=k.indexOf("/");const [st,key]=locate(k.slice(0,i),k.slice(i+1));(st==="meta"?x.meta:x[st])[key]=j[k];return [st,key,j[k]];});
  await idbWrite(w);try{localStorage.removeItem(JOURNAL);}catch(e){}
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushAll();});
window.addEventListener("pagehide",flushAll);
window.addEventListener("beforeunload",flushAll);

async function removeDoc(kind,id){
  delete S[STORE[kind]][id];
  if(S.mode==="local"){saveLocal();return;}
  try{await idbWrite([[STORE[kind],id,null]]);if(kanal)kanal.postMessage({kind,id});syncMark(kind,id,true);}catch(e){toast("Löschen fehlgeschlagen.");}
}
/* Für den Abgleich mit der gemeinsamen Datenbank vormerken (sync.js); ohne Einrichtung passiert nichts. */
function syncMark(kind,id,deleted){if(typeof SB!=="undefined")SB.mark(kind,id,deleted);}
function saveLocal(){try{localStorage.setItem(LS,JSON.stringify(backupData()));}catch(e){}}
function readLocal(){try{return JSON.parse(localStorage.getItem(LS)||"null");}catch(e){return null;}}

/* Mannschaft wählen (merkt sich das Gerät). */
function pickTeam(id){
  const list=S.teamsDoc.list;let t=id;if(!t){try{t=localStorage.getItem(LS_TEAM);}catch(e){}}
  if(!list.some(x=>x.id===t))t=list[0].id;S.team=t;try{localStorage.setItem(LS_TEAM,t);}catch(e){}
}
/* Datenobjekt im Sicherungsformat (Version 4) in den Zustand übernehmen. */
function applyData(d){
  S.settings=Object.assign(defaultSettings(),d.settings||{});
  S.teamsDoc=Object.assign({list:[]},d.teams||{});S.vorlagenDoc=Object.assign({list:[]},d.vorlagen||{});
  if(!S.teamsDoc.list.length)S.teamsDoc.list=[{id:"team1",name:"Damen 1",start:S.settings.start||"19:00",dauer:num(S.settings.dauer)||90}];
  S.kaders={};Object.entries(d.kaders||{}).forEach(([t,k])=>S.kaders[t]=Object.assign({players:[]},k));
  S.planungen={};Object.entries(d.planungen||{}).forEach(([t,p])=>S.planungen[t]=Object.assign({perioden:[],wochen:[]},p));
  S.uebungen=d.uebungen||{};S.trainings=d.trainings||{};S.spiele=d.spiele||{};
  pickTeam(S.team);
}
/* Inhalt der Browser-Datenbank → Datenobjekt (alte Stände haben noch einen einzelnen „kader“). */
function fromStore(x){
  const d={version:x.meta.schema,settings:x.meta.settings,uebungen:x.uebungen,trainings:x.trainings,spiele:x.spiele};
  if(x.meta.vorlagen)d.vorlagen=x.meta.vorlagen;d.planungen={};Object.keys(x.meta).forEach(k=>{if(k.startsWith("planung:"))d.planungen[k.slice(8)]=x.meta[k];});if(x.meta.teams){d.teams=x.meta.teams;d.kaders={};Object.keys(x.meta).forEach(k=>{if(k.startsWith("kader:"))d.kaders[k.slice(6)]=x.meta[k];});}
  else d.kader=Object.assign({players:[]},x.meta.kader||{});
  return d;
}
/* Datenobjekt (Version 4) → Schreibvorgänge für die Browser-Datenbank. */
function toWrites(d){
  const w=[];if(d.teams)w.push(["meta","teams",d.teams]);if(d.vorlagen)w.push(["meta","vorlagen",d.vorlagen]);if(d.settings)w.push(["meta","settings",d.settings]);
  Object.entries(d.kaders||{}).forEach(([t,k])=>w.push(["meta","kader:"+t,k]));
  Object.entries(d.planungen||{}).forEach(([t,p])=>w.push(["meta","planung:"+t,p]));
  ["uebungen","trainings","spiele"].forEach(st=>Object.entries(d[st]||{}).forEach(([id,o])=>w.push([st,id,o])));return w;
}

let renderQueued=false;
function queueRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;render();});}

/* ---------- Datenformat / Migration ----------
   Sicherungsdateien ab Version 4: {version, teams:{list}, kaders:{team:kader}, settings, uebungen, trainings, spiele}.
   Bis Version 3: {version, kader, settings, uebungen, trainings, spiele}.
   Ändert sich das Format, kommt hier ein Schritt "von Version n auf n+1" dazu. */
const MIGRATIONS={
  /* 1 → 2: parallele Stationen. Neu und optional: Schritt.block und Training.bloecke.
     Alte Trainings haben keins von beiden und laufen damit unverändert nacheinander – am Inhalt ändert sich nichts. */
  1:d=>d,
  /* 2 → 3: editierbare Auswahllisten + neue Anwesenheit.
     – settings: kategorien, gruende, positionen, material kommen dazu; alles, was in Übungen/Spielen schon
       verwendet wird, landet mit in der Liste (nichts geht verloren).
     – Anwesenheit: zugesagt→anwesend, abgesagt→abwesend, verletzt→abwesend + eingeschränkt (Grund „Sonstiges“),
       unsicher/offen→offen. Wer im letzten erfassten Training verletzt war, bleibt eingeschränkt. */
  2:d=>{
    const s=Object.assign({},d.settings||{});const add=(list,v)=>{if(v&&!list.includes(v))list.push(v);};
    s.tags=Array.isArray(s.tags)?s.tags.slice():DEFAULT_TAGS.slice();
    s.kategorien=Array.isArray(s.kategorien)?s.kategorien.slice():DEF_KAT.slice();
    s.gruende=Array.isArray(s.gruende)?s.gruende.slice():DEF_GRUENDE.slice();
    s.positionen=Array.isArray(s.positionen)?s.positionen.slice():DEF_POS.slice();
    s.material=Array.isArray(s.material)?s.material.slice():DEF_MAT.map(([k,l])=>({k,l}));
    const matKeys=new Set(s.material.map(m=>m.k));
    Object.values(d.uebungen||{}).forEach(e=>{add(s.kategorien,e.kategorie);(e.tags||[]).forEach(x=>add(s.tags,x));
      Object.keys(e.material||{}).forEach(k=>{if(!matKeys.has(k)){matKeys.add(k);s.material.push({k,l:k});}});});
    Object.keys(s.inventar||{}).forEach(k=>{if(!matKeys.has(k)){matKeys.add(k);s.material.push({k,l:k});}});
    Object.values(d.spiele||{}).forEach(sp=>(sp.punkte||[]).forEach(p=>add(s.tags,p.tag)));
    const NOTE="verletzt (aus alter Version übernommen)";
    const lastVerletzt={};
    Object.values(d.trainings||{}).sort((a,b)=>(a.datum||"").localeCompare(b.datum||"")).forEach(t=>{
      const att=t.anwesenheit||{};const neu={};t.einschr=t.einschr||{};
      Object.entries(att).forEach(([pid,v])=>{
        if(v==="ja"||v==="nein")neu[pid]=v;
        else if(v==="verletzt"){neu[pid]="nein";t.einschr[pid]={grund:"Sonstiges",notiz:NOTE};}
        if(v)lastVerletzt[pid]=v==="verletzt"?(t.datum||today()):null;
      });
      t.anwesenheit=neu;
    });
    const kader=Object.assign({},d.kader);
    kader.players=(kader.players||[]).map(p=>{const q=Object.assign({position:""},p);
      if(lastVerletzt[p.id]&&!q.einschr)q.einschr={grund:"Sonstiges",notiz:NOTE,seit:lastVerletzt[p.id]};return q;});
    if(s.gruende.indexOf("Sonstiges")<0)s.gruende.push("Sonstiges");
    return Object.assign({},d,{settings:s,kader});
  },
  /* 3 → 4: mehrere Mannschaften. Alles Bisherige gehört zur ersten Mannschaft „Damen 1“ (Kennung team1):
     Kader → kaders.team1, Trainings und Spiele bekommen team:"team1", Standard-Beginn/-Dauer gehen an die Mannschaft.
     Übungen und Auswahllisten bleiben gemeinsam. */
  3:d=>{
    const s=d.settings||{};const t={id:"team1",name:"Damen 1",start:s.start||"19:00",dauer:num(s.dauer)||90};
    const out=Object.assign({},d,{teams:{list:[t]},kaders:{team1:Object.assign({players:[]},d.kader)}});delete out.kader;
    ["trainings","spiele"].forEach(c=>Object.values(out[c]||{}).forEach(o=>{if(!o.team)o.team="team1";}));
    return out;
  },
  /* 4 → 5: Haupt-/Nebenschwerpunkte, Schritt-Kopien, Durchführung, bereinigte Texte.
     – Alle Texte ohne Leerzeichen am Anfang/Ende.
     – settings.schwerpunkte neu; Übungen mit Kategorie Technik/Taktik/Athletik bekommen diese als Hauptschwerpunkt
       (übung.haupt). Die bisherigen Inhalte (übung.tags) sind die Nebenschwerpunkte.
     – Jeder Trainingsschritt bekommt eine Kopie von Name, Kategorie, Haupt- und Nebenschwerpunkten der Übung.
     – Trainings bis heute mit erfasster Anwesenheit gelten als durchgeführt. */
  4:d=>{
    const out=trimDeep(d);const s=out.settings=out.settings||{};
    s.schwerpunkte=Array.isArray(s.schwerpunkte)?s.schwerpunkte:DEF_SCHWERPUNKTE.slice();
    Object.values(out.uebungen||{}).forEach(e=>{e.tags=Array.isArray(e.tags)?e.tags:[];
      if(e.haupt==null)e.haupt=HAUPT_AUS_KAT.includes(e.kategorie)&&s.schwerpunkte.includes(e.kategorie)?e.kategorie:"";});
    const heute=today();
    Object.values(out.trainings||{}).forEach(t=>{
      (t.ablauf||[]).forEach(st=>{const e=(out.uebungen||{})[st.uebungId];if(st.name==null&&e)Object.assign(st,snapshot(e));});
      if(t.durchgefuehrt==null)t.durchgefuehrt=!!(t.datum&&t.datum<=heute&&Object.values(t.anwesenheit||{}).some(v=>v==="ja"||v==="nein"));
    });
    return out;
  },
  /* 5 → 6: Auswertung. Neu: settings.saisonStart / halbserieWechsel (MM-TT, Standard 1.7. bzw. 1.1.) und
     optional training.rausAb[spielerin] = Schritt, ab dem eine eingeschränkte Spielerin nicht mehr dabei war.
     Bestehende Daten bleiben unverändert. */
  5:d=>{const out=Object.assign({},d,{settings:Object.assign({},d.settings||{})});
    if(!out.settings.saisonStart)out.settings.saisonStart="07-01";if(!out.settings.halbserieWechsel)out.settings.halbserieWechsel="01-01";return out;},
  /* 6 → 7: Kader und Bibliothek ergänzt.
     – Spielerin: nummer, positionen (weitere; die bisherige position bleibt Hauptposition), notiz.
     – Übung: varianten, flaeche, schwierigkeit, favorit, archiviert, video (Bild optional als bild).
     – Spiel: kader (Spielteilnahme) bleibt bei alten Spielen leer = noch nicht erfasst. */
  6:d=>{const out=Object.assign({},d);
    const pl=p=>Object.assign({nummer:"",positionen:[],notiz:""},p,{positionen:(p.positionen||[]).filter(x=>x!==p.position)});
    if(out.kaders)out.kaders=Object.fromEntries(Object.entries(out.kaders).map(([t,k])=>[t,Object.assign({},k,{players:(k.players||[]).map(pl)})]));
    if(out.kader)out.kader=Object.assign({},out.kader,{players:(out.kader.players||[]).map(pl)});
    out.uebungen=Object.fromEntries(Object.entries(out.uebungen||{}).map(([id,e])=>[id,Object.assign({varianten:[],flaeche:"",schwierigkeit:"",favorit:false,archiviert:false,video:""},e)]));
    return out;},
  /* 7 → 8: wiederverwendbare Trainingsblöcke. Neu: vorlagen {list:[{id,name,bereich,dauer,notiz,schritte}]},
     settings.bereiche; im Training optional schritt.gruppe + training.gruppen (eingefügter Block als Kopie). */
  7:d=>{const out=Object.assign({},d,{settings:Object.assign({},d.settings||{})});
    if(!Array.isArray(out.settings.bereiche))out.settings.bereiche=DEF_BEREICHE.slice();
    out.vorlagen=Object.assign({list:[]},out.vorlagen||{});return out;},
  /* 8 → 9: langfristige Planung je Mannschaft: planungen[team] = {perioden:[{id,name,von,bis,ziele:[{id,text,art}],soll:{schwerpunkt:prozent}}],
     wochen:[{id,von,text,haupt,neben}]}. Startet leer; bestehende Daten bleiben unverändert. */
  8:d=>Object.assign({},d,{planungen:Object.assign({},d.planungen||{})}),
  /* 9 → 10: Spielanalyse. Neu: settings.mannschaftsteile; im Spiel medien [{id,typ,titel,data|url}]; je Punkt optional
     haupt, teile, spielerinnen, medien. Bestehende Spielberichte bleiben unverändert. */
  9:d=>{const out=Object.assign({},d,{settings:Object.assign({},d.settings||{})});if(!Array.isArray(out.settings.mannschaftsteile))out.settings.mannschaftsteile=DEF_TEILE.slice();return out;},
  /* 10 → 11: Spielerentwicklung. Neu: settings.bewertungskriterien; je Spielerin entwicklung =
     {ziele:[],staerken:[],felder:[],empfehlungen:[],bewertungen:[]} (siehe js/entwicklung.js). Alle anderen Daten bleiben unverändert. */
  10:d=>{const out=Object.assign({},d,{settings:Object.assign({},d.settings||{})});
    if(!Array.isArray(out.settings.bewertungskriterien))out.settings.bewertungskriterien=DEF_KRIT.slice();
    const leer=()=>({ziele:[],staerken:[],felder:[],empfehlungen:[],bewertungen:[]});
    const pl=p=>Object.assign({},p,{entwicklung:Object.assign(leer(),p.entwicklung||{})});
    if(out.kaders)out.kaders=Object.fromEntries(Object.entries(out.kaders).map(([t,k])=>[t,Object.assign({},k,{players:(k.players||[]).map(pl)})]));
    if(out.kader)out.kader=Object.assign({},out.kader,{players:(out.kader.players||[]).map(pl)});
    return out;},
  /* 11 → 12: Aufstellung mit Namen. Neu je Spiel: aufstellung = {formation, plaetze:{Position→Spielerin}, kapitaen, notiz}
     (siehe js/aufstellung.js). Bestehende Spielberichte bekommen eine leere Aufstellung; alles andere bleibt unverändert. */
  11:d=>{const out=Object.assign({},d);
    out.spiele=Object.fromEntries(Object.entries(out.spiele||{}).map(([id,s])=>[id,Object.assign({},s,{aufstellung:Object.assign({formation:"4-4-2",plaetze:{},kapitaen:null,notiz:""},s.aufstellung||{})})]));
    return out;},
  /* 12 → 13: Farbe je Mannschaft. Neu: teams.list[].farbe (Hauptfarbe als #RRGGBB, siehe js/farben.js).
     Bestehende Mannschaften bekommen das bisherige Blau; alles andere bleibt unverändert. */
  12:d=>{const out=Object.assign({},d);
    if(out.teams&&Array.isArray(out.teams.list))out.teams=Object.assign({},out.teams,{list:out.teams.list.map(t=>Object.assign({farbe:"#2F80ED"},t))});
    return out;},
};
/* Texte: Leerzeichen am Anfang/Ende entfernen – in allen Zeichenketten eines Datenobjekts. */
function trimDeep(o){if(typeof o==="string")return o.trim();if(Array.isArray(o))return o.map(trimDeep);
  if(o&&typeof o==="object"){const r={};Object.keys(o).forEach(k=>r[k]=trimDeep(o[k]));return r;}return o;}
/* Teil-Dateien (Mannschaft, geteilte Trainings/Übungen) durch dieselben Migrationen schicken. */
function migratePart(part,v){
  v=num(v)||1;if(v>DATA_VERSION)throw new Error("neuer");if(v===DATA_VERSION)return part;
  const wrap=Object.assign({version:v,settings:part.settings||{},uebungen:part.uebungen||{},trainings:part.trainings||{},spiele:part.spiele||{}},
    v<4?{kader:part.kader||{players:[]}}:{teams:{list:part.team?[part.team]:[]},kaders:part.team?{[part.team.id]:part.kader||{players:[]}}:{}});
  const m=migrateBackup(wrap);
  return Object.assign({},part,{version:DATA_VERSION,uebungen:m.uebungen,trainings:m.trainings,spiele:m.spiele,
    settings:part.settings?m.settings:undefined,kader:part.team?m.kaders[part.team.id]:part.kader,team:part.team?m.teams.list[0]:undefined});
}
function migrateBackup(d){
  if(!d||typeof d!=="object")throw new Error("keine Sicherung");
  let v=num(d.version)||1;
  if(v>DATA_VERSION)throw new Error("neuer");
  if(v<4?!(d.kader&&Array.isArray(d.kader.players)):!(d.teams&&Array.isArray(d.teams.list)&&d.kaders))throw new Error("keine Sicherung");
  d=clone(d);while(v<DATA_VERSION){d=MIGRATIONS[v](d);v++;}
  d.version=DATA_VERSION;return d;
}
function backupData(){return {version:DATA_VERSION,exportiertAm:new Date().toISOString(),teams:S.teamsDoc,vorlagen:S.vorlagenDoc,kaders:S.kaders,planungen:S.planungen,settings:S.settings,uebungen:S.uebungen,trainings:S.trainings,spiele:S.spiele};}
/* Nur eine Mannschaft: ihr Kader, ihre Trainings und Spiele, dazu die darin verwendeten Übungen und die Listen. */
const TEAM_TYP="trainingsplaner-mannschaft";
function teamBackupData(tid){
  const team=S.teamsDoc.list.find(t=>t.id===tid);const own=c=>Object.fromEntries(Object.entries(S[c]).filter(([,o])=>o.team===tid));
  const trainings=own("trainings"),spiele=own("spiele");const ues={};
  Object.values(trainings).forEach(t=>(t.ablauf||[]).forEach(s=>{if(S.uebungen[s.uebungId])ues[s.uebungId]=S.uebungen[s.uebungId];}));
  return {typ:TEAM_TYP,version:DATA_VERSION,exportiertAm:new Date().toISOString(),team,kader:S.kaders[tid]||{players:[]},planung:S.planungen[tid]||null,settings:S.settings,uebungen:ues,trainings,spiele};
}
async function commit(writes,marks){
  if(S.mode==="db"&&writes.length)await idbWrite(writes);
  if(S.mode==="local")saveLocal();
  if(kanal)kanal.postMessage({all:true});
  marks.forEach(([k,id])=>syncMark(k,id));
}
/* Gesamte Sicherung einspielen: Einstellungen ersetzen; Mannschaften und ihre Kader aus der Datei ersetzen
   bzw. ergänzen (andere Mannschaften bleiben); Einträge mit gleicher Kennung überschreiben, andere bleiben. */
async function importBackup(raw){
  const d=migrateBackup(raw);const now=Date.now();
  const teams={list:S.teamsDoc.list.map(t=>Object.assign({},t))};
  d.teams.list.forEach(t=>{const i=teams.list.findIndex(x=>x.id===t.id);if(i>=0)teams.list[i]=Object.assign({},t);else teams.list.push(Object.assign({},t));});
  teams.updatedAt=now;const settings=Object.assign(defaultSettings(),d.settings||{},{updatedAt:now});
  const kaders=Object.assign({},S.kaders);Object.entries(d.kaders).forEach(([t,k])=>kaders[t]=Object.assign({players:[]},k,{updatedAt:now}));
  // Blockvorlagen: gleiche Kennung überschreiben, andere bleiben
  const vorlagen={list:S.vorlagenDoc.list.map(v=>Object.assign({},v)),updatedAt:now};
  (d.vorlagen&&d.vorlagen.list||[]).forEach(v=>{const i=vorlagen.list.findIndex(x=>x.id===v.id);if(i>=0)vorlagen.list[i]=v;else vorlagen.list.push(v);});
  // Planung je Mannschaft: Mannschaften aus der Datei ersetzen ihre Planung, andere bleiben
  const planungen=Object.assign({},S.planungen);Object.entries(d.planungen||{}).forEach(([t,p])=>planungen[t]=Object.assign({perioden:[],wochen:[]},p,{updatedAt:now}));
  const next={teams,vorlagen,settings,kaders,planungen,uebungen:Object.assign({},S.uebungen),trainings:Object.assign({},S.trainings),spiele:Object.assign({},S.spiele)};
  const marks=[["teams"],["vorlagen"],["settings"],...Object.keys(d.kaders).map(t=>["kader",t]),...Object.keys(d.planungen||{}).map(t=>["planung",t])];
  [["uebungen","uebung"],["trainings","training"],["spiele","spiel"]].forEach(([st,kind])=>Object.entries(d[st]||{}).forEach(([id,o])=>{next[st][id]=Object.assign({},o,{updatedAt:o.updatedAt||now});marks.push([kind,id]);}));
  const w=[["meta","schema",DATA_VERSION],["meta","teams",teams],["meta","vorlagen",clone(vorlagen)],["meta","settings",settings],...Object.keys(d.kaders).map(t=>["meta","kader:"+t,kaders[t]]),...Object.keys(d.planungen||{}).map(t=>["meta","planung:"+t,clone(planungen[t])])];
  ["uebungen","trainings","spiele"].forEach(st=>Object.keys(d[st]||{}).forEach(id=>w.push([st,id,clone(next[st][id])])));
  if(S.mode==="db")await idbWrite(w);
  applyData(next);await commit([],marks);
}
/* Mannschafts-Datei einspielen: gibt es die Mannschaft (gleiche Kennung), wird ihr Kader ersetzt und ihre
   Trainings/Spiele ergänzt bzw. überschrieben; sonst kommt sie neu dazu. Übungen: fehlende kommen dazu,
   vorhandene bleiben unverändert. Listen werden ergänzt, nicht ersetzt. */
async function importTeam(raw){
  if(num(raw.version)>DATA_VERSION)throw new Error("neuer");
  if(!raw.team||!raw.team.id||!raw.kader)throw new Error("keine Sicherung");
  raw=migratePart(raw,raw.version);
  const now=Date.now(),tid=raw.team.id,marks=[],w=[];
  const i=S.teamsDoc.list.findIndex(t=>t.id===tid);if(i>=0)S.teamsDoc.list[i]=Object.assign({},S.teamsDoc.list[i],raw.team);else S.teamsDoc.list.push(Object.assign({},raw.team));
  S.teamsDoc.updatedAt=now;marks.push(["teams"]);w.push(["meta","teams",clone(S.teamsDoc)]);
  S.kaders[tid]=Object.assign({players:[]},raw.kader,{updatedAt:now});marks.push(["kader",tid]);w.push(["meta","kader:"+tid,clone(S.kaders[tid])]);
  if(raw.planung){S.planungen[tid]=Object.assign({perioden:[],wochen:[]},raw.planung,{updatedAt:now});marks.push(["planung",tid]);w.push(["meta","planung:"+tid,clone(S.planungen[tid])]);}
  const rs=raw.settings||{};let sch=false;const add=(list,v)=>{if(v&&!list.includes(v)){list.push(v);sch=true;}};
  ["tags","kategorien","gruende","positionen","schwerpunkte"].forEach(k=>(rs[k]||[]).forEach(v=>add(S.settings[k]=S.settings[k]||[],v)));
  (rs.material||[]).forEach(m=>{if(!S.settings.material.some(x=>x.k===m.k)){S.settings.material.push(m);sch=true;}});
  if(sch){S.settings.updatedAt=now;marks.push(["settings"]);w.push(["meta","settings",clone(S.settings)]);}
  Object.entries(raw.uebungen||{}).forEach(([id,e])=>{if(!S.uebungen[id]){S.uebungen[id]=Object.assign({},e,{updatedAt:e.updatedAt||now});marks.push(["uebung",id]);w.push(["uebungen",id,clone(S.uebungen[id])]);}});
  [["trainings","training"],["spiele","spiel"]].forEach(([st,kind])=>Object.entries(raw[st]||{}).forEach(([id,o])=>{S[st][id]=Object.assign({},o,{team:tid,updatedAt:o.updatedAt||now});marks.push([kind,id]);w.push([st,id,clone(S[st][id])]);}));
  w.push(["meta","schema",DATA_VERSION]);
  await commit(w,marks);pickTeam(tid);
}
async function setMeta(k,v){S.meta[k]=v;if(S.mode==="db"){try{await idbWrite([["meta",k,v]]);}catch(e){}}else{try{localStorage.setItem("trainingsplaner-meta-"+k,JSON.stringify(v));}catch(e){}}}

/* Andere offene Tabs (z. B. am PC zweimal geöffnet) halten sich gegenseitig aktuell. */
if(kanal)kanal.onmessage=async e=>{
  if(S.mode!=="db")return;const m=e.data||{};
  try{
    if(m.all){applyData(fromStore(await idbLoadAll()));queueRender();return;}
    if(dirty.has(m.kind+"/"+m.id))return;
    const [st,k]=locate(m.kind,m.id);const v=await idbGet(st,k);
    if(m.kind==="kader"){if(v)S.kaders[m.id]=Object.assign({players:[]},v);else delete S.kaders[m.id];}
    else if(m.kind==="planung"){if(v)S.planungen[m.id]=Object.assign({perioden:[],wochen:[]},v);else delete S.planungen[m.id];}
    else if(m.kind==="settings")S.settings=Object.assign(defaultSettings(),v||{});
    else if(m.kind==="teams"){S.teamsDoc=Object.assign({list:[]},v||{});pickTeam(S.team);}
    else if(m.kind==="vorlagen")S.vorlagenDoc=Object.assign({list:[]},v||{});
    else if(v)S[st][k]=v;else delete S[st][k];
    queueRender();
  }catch(err){}
};

async function init(){
  render();
  try{idb=await idbOpen();S.mode="db";}catch(e){S.mode="local";}
  if(S.mode==="db"){
    try{
      const x=await idbLoadAll();let d;
      if(x.meta.schema==null){
        // Allererster Start: falls dieser Browser noch Daten aus der alten Einzeldatei hat, übernehmen.
        const alt=readLocal();d=alt&&(alt.kader||alt.kaders)?migrateBackup(alt):migrateBackup({version:DATA_VERSION,teams:{list:[]},kaders:{}});
        await idbWrite([["meta","schema",DATA_VERSION],["meta","seit",Date.now()],...toWrites(d)]);x.meta.seit=Date.now();
      }
      else if(x.meta.schema<DATA_VERSION){
        // Gespeicherte Daten auf das aktuelle Format bringen – alles in einer Transaktion.
        const vorher=Object.assign(fromStore(x),{exportiertAm:new Date().toISOString()});
        d=migrateBackup(vorher);
        // Der alte Stand bleibt als Sicherung erhalten (Einstellungen → Datensicherung).
        const w=[["meta","schema",DATA_VERSION],["meta","vorUpdate",{von:x.meta.schema,am:Date.now(),daten:clone(vorher)}],...toWrites(d)];
        if(x.meta.kader)w.push(["meta","kader",null]);
        await idbWrite(w);x.meta.vorUpdate={von:x.meta.schema,am:Date.now()};
      }
      else{await journalReplay(x);d=fromStore(x);}
      applyData(d);
      if(!(d.teams&&d.teams.list&&d.teams.list.length))await idbWrite([["meta","teams",clone(S.teamsDoc)]]); // Standard-Mannschaft festhalten
      S.meta={letzteSicherung:x.meta.letzteSicherung||null,seit:x.meta.seit||Date.now(),vorUpdate:x.meta.vorUpdate?{von:x.meta.vorUpdate.von,am:x.meta.vorUpdate.am}:null};
    }catch(e){
      // Nicht auf eine leere Ersatzablage ausweichen – sonst sähe es aus, als wären die Daten weg.
      S.fatal="Die gespeicherten Daten konnten nicht geladen oder umgestellt werden. Es wurde nichts verändert. Bitte lade die Seite neu; hilft das nicht, melde dich mit dieser Meldung: "+(e&&e.message||e);
      S.ready=true;render();return;
    }
  }
  if(S.mode==="local"){
    const alt=readLocal();let d=null;try{if(alt)d=migrateBackup(alt);}catch(e){}
    applyData(d||{});
    let ls=null;try{ls=JSON.parse(localStorage.getItem("trainingsplaner-meta-letzteSicherung")||"null");}catch(e){}
    S.meta={letzteSicherung:ls,seit:Date.now()};
    S.notice="Dieser Browser erlaubt keine richtige Datenbank (z. B. privates Fenster). Deine Daten liegen nur vorläufig hier – lade unbedingt eine Sicherung herunter.";
  }
  // Den Browser bitten, die Daten nicht von selbst aufzuräumen.
  try{if(navigator.storage&&navigator.storage.persist)S.persistent=await navigator.storage.persist();}catch(e){}
  S.ready=true;render();
  if(typeof SB!=="undefined")SB.syncNow();
}
