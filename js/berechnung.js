"use strict";
/* ---------- derived ---------- */
const players=()=>S.kader.players||[];
const pById=id=>players().find(p=>p.id===id);
/* F/T = anwesende Feldspielerinnen/TW (Grundlage aller Prüfungen); dazu die Übersicht für die Anwesenheit. */
function headcount(t){
  let F=0,T=0;const att=t.anwesenheit||{};
  players().forEach(p=>{if(att[p.id]==="ja"){p.tw?T++:F++;}});
  return {F,T};
}
function attSummary(t){
  const att=t.anwesenheit||{},lim=t.einschr||{};const o={ja:0,nein:0,offen:0,lim:0,limDa:0};
  players().forEach(p=>{const s=att[p.id]||"";if(s==="ja")o.ja++;else if(s==="nein")o.nein++;else o.offen++;if(lim[p.id]){o.lim++;if(s==="ja")o.limDa++;}});
  return o;
}
/* Für ein neues Training: die aktuellen Einschränkungen der Spielerinnen übernehmen. */
const einschrSnapshot=()=>Object.fromEntries(players().filter(p=>p.einschr).map(p=>[p.id,{grund:p.einschr.grund,notiz:p.einschr.notiz||""}]));
/* hc = {F,T}: ganze Mannschaft oder – bei Stationen – eine Gruppe (grp=true ändert nur den Wortlaut). */
function exCheck(ex,hc,grp=false){
  const w=[];if(!ex)return w;
  const tw=num(ex.tw),min=num(ex.minSp),max=num(ex.maxSp),teams=num(ex.teams);const da=grp?"in der Gruppe":"zugesagt";
  if(tw>hc.T) w.push(`Braucht ${tw} TW, ${da} ${hc.T===1?"ist 1":"sind "+hc.T}.`);
  if(min&&hc.F<min) w.push(`Mindestens ${min} Feldspielerinnen nötig, ${da} sind ${hc.F}.`);
  if(max&&hc.F>max) w.push(`${hc.F-max} Spielerin${hc.F-max>1?"nen":""} ohne Aufgabe (Übung passt für ${max}). Zweite Gruppe oder Station einplanen.`);
  const ps=num(S.settings.leibchenProSatz)||0;
  if(teams>1&&ps&&Math.ceil(hc.F/teams)>ps) w.push(`Teams à ${Math.ceil(hc.F/teams)} – ein Leibchen-Satz hat nur ${ps}.`);
  return w;
}
function teamInfo(ex,hc){const t=num(ex&&ex.teams);if(t<2||!hc.F)return "";const a=Math.floor(hc.F/t),r=hc.F%t;return r?`${t} Teams: ${r}× ${a+1}, ${t-r}× ${a}`:`${t} Teams à ${a}`;}
/* Trainingsschritt = Kopie von Name, Kategorie, Haupt- und Nebenschwerpunkten der Übung zum Zeitpunkt des
   Einplanens. Diese Kopie gilt im Training und in der Auswertung; Material, Skizze, Spielerzahl und Texte
   kommen weiter aus der Bibliothek. „live“ = gerade aus dem Training neu angelegt, Kopie folgt beim Zurückkehren. */
function snapshot(ex){return {name:(ex.name||"").trim(),kategorie:ex.kategorie||"",haupt:ex.haupt||"",neben:(ex.tags||[]).slice()};}
function stepEx(s){
  const lib=S.uebungen[s.uebungId];if(!lib&&s.name==null)return null;
  const e=Object.assign({},lib||{});
  if(s.name!=null&&!s.live){e.name=s.name;e.kategorie=s.kategorie||"";e.haupt=s.haupt||"";e.tags=(s.neben||[]).slice();}
  e.inBib=!!lib;return e;
}
function stepsOf(t){return (t.ablauf||[]).map(s=>({s,ex:stepEx(s)}));}
/* Weicht die Kopie im Schritt von der Bibliothek ab? (für den Hinweis „aus Bibliothek aktualisieren“) */
function stepDiffers(s){const lib=S.uebungen[s.uebungId];if(!lib||s.name==null||s.live)return false;return JSON.stringify(snapshot(lib))!==JSON.stringify({name:s.name,kategorie:s.kategorie||"",haupt:s.haupt||"",neben:s.neben||[]});}
function stepDur(st){return st.s.dauer!=null&&st.s.dauer!==""?num(st.s.dauer):num(st.ex&&st.ex.dauer);}

/* ---------- Ablauf in Einheiten: einzelne Übung oder paralleler Block ----------
   Ein Schritt kann eine Block-Kennung tragen (s.block). Direkt aufeinanderfolgende Schritte mit derselben
   Kennung laufen gleichzeitig als Stationen; die Gruppen wechseln nach jeder Runde.
   Einstellungen je Block (alles optional): t.bloecke[id] = {rundenDauer, runden, gruppen:[{f,t},…]}. */
const GRUPPE="ABCDEFGH";const MAX_STATIONEN=4;
function unitsOf(t){
  const units=[];
  stepsOf(t).forEach((st,i)=>{st.i=i;const last=units[units.length-1];
    if(st.s.block&&last&&last.block===st.s.block)last.steps.push(st);else units.push({block:st.s.block||null,steps:[st]});});
  let clock=t.start||teamCfg().start;
  units.forEach(u=>{if(u.steps.length<2)u.block=null;u.start=clock;u.dur=unitDur(t,u);clock=addMin(clock,u.dur);});
  return units;
}
function blockCfg(t,u){return (u.block&&t.bloecke&&t.bloecke[u.block])||{};}
const isSet=v=>v!=null&&v!=="";
function unitRound(t,u){if(!u.block)return stepDur(u.steps[0]);const c=blockCfg(t,u);return isSet(c.rundenDauer)?num(c.rundenDauer):Math.max(...u.steps.map(stepDur));}
function unitRounds(t,u){if(!u.block)return 1;const c=blockCfg(t,u);return isSet(c.runden)?Math.max(1,num(c.runden)):u.steps.length;}
function unitDur(t,u){return unitRound(t,u)*unitRounds(t,u);}
function splitEven(n,k){const a=Math.floor(n/k),r=n%k;return Array.from({length:k},(_,i)=>a+(i<r?1:0));}
function groupsManual(t,u){const c=blockCfg(t,u);return Array.isArray(c.gruppen)&&c.gruppen.length===u.steps.length;}
/* Gruppen: Standard gleichmäßig verteilt (Feld und TW getrennt), sonst von Hand. */
function unitGroups(t,u,hc){
  if(groupsManual(t,u))return blockCfg(t,u).gruppen.map(g=>({F:num(g.f),T:num(g.t)}));
  const f=splitEven(hc.F,u.steps.length),tw=splitEven(hc.T,u.steps.length);return f.map((F,i)=>({F,T:tw[i]}));
}
const grpTxt=g=>`${g.F}${g.T?` + ${g.T} TW`:""}`;
/* Rotation: In Runde r steht Gruppe g an Station (g+r) mod n. Liefert die Gruppen, die Station s erlebt. */
function groupsAtStation(n,rounds,s){const g=new Set();for(let r=0;r<Math.min(rounds,n);r++)g.add(((s-r)%n+n)%n);return [...g].sort((a,b)=>a-b);}
/* Prüfungen je Station mit der Gruppengröße; gleiche Größen werden zusammengefasst. */
function stationInfo(t,u,hc){
  const n=u.steps.length,G=unitGroups(t,u,hc),R=unitRounds(t,u);
  return u.steps.map((st,s)=>{const gs=groupsAtStation(n,R,s);const warns=[],teams=[];const seen=new Map();
    gs.forEach(g=>{const key=G[g].F+"/"+G[g].T;if(!seen.has(key))seen.set(key,[]);seen.get(key).push(GRUPPE[g]);});
    seen.forEach((names,key)=>{const [F,T]=key.split("/").map(Number);const lab=`Gruppe ${names.join("/")}`;
      exCheck(st.ex,{F,T},true).forEach(x=>warns.push(`${lab} (${grpTxt({F,T})}): ${x}`));
      const ti=teamInfo(st.ex,{F,T});if(ti)teams.push(seen.size>1?`${lab}: ${ti}`:ti);});
    return {warns,teams,gruppen:gs.map(g=>GRUPPE[g])};});
}
function groupSumWarn(t,u,hc){
  if(!groupsManual(t,u))return "";const G=unitGroups(t,u,hc);const F=G.reduce((a,g)=>a+g.F,0),T=G.reduce((a,g)=>a+g.T,0);
  return F!==hc.F||T!==hc.T?`Die Gruppen ergeben ${F} Feldspielerinnen und ${T} TW, zugesagt sind ${hc.F} und ${hc.T}.`:"";
}
const exName=ex=>ex?(ex.name||"Ohne Namen").trim():"Gelöschte Übung";
/* Material: im Block addiert, über das Training der höchste gleichzeitige Bedarf (nicht die Summe). */
function materialNeed(t){
  const need={};
  unitsOf(t).forEach(u=>matList().forEach(([k])=>{
    const parts=u.steps.map(({ex})=>({name:exName(ex),n:num(ex&&ex.material&&ex.material[k])}));const n=parts.reduce((a,p)=>a+p.n,0);
    if(!n||(need[k]&&n<=need[k].n))return;
    need[k]={n,ex:u.block?`Stationen ab ${u.start}: ${parts.filter(p=>p.n).map(p=>`${p.name} ${p.n}`).join(" + ")}`:parts[0].name};}));
  return need;
}
/* Nach jeder Änderung am Ablauf: Einzelstationen auflösen, doppelte Kennungen trennen, verwaiste Einstellungen löschen. */
function normBlocks(t){
  const seen=new Set();const units=unitsOf(t);
  units.forEach(u=>{
    if(u.steps.length<2){delete u.steps[0].s.block;return;}
    if(seen.has(u.block)){const nb=uid();if(t.bloecke&&t.bloecke[u.block])(t.bloecke[nb]=clone(t.bloecke[u.block]));u.steps.forEach(st=>st.s.block=nb);u.block=nb;}
    seen.add(u.block);
    const c=t.bloecke&&t.bloecke[u.block];if(c&&Array.isArray(c.gruppen)&&c.gruppen.length!==u.steps.length)delete c.gruppen;
  });
  if(t.bloecke)Object.keys(t.bloecke).forEach(k=>{if(!seen.has(k))delete t.bloecke[k];});
  if(t.bloecke&&!Object.keys(t.bloecke).length)delete t.bloecke;
  if(typeof normGruppen==="function")normGruppen(t); // eingefügte Trainingsblöcke (bloecke.js) zusammenhängend halten
}
function openPoints(t){
  const sp=t.spielId&&S.spiele[t.spielId];if(!sp)return [];
  return (sp.punkte||[]).filter(p=>p.trainieren);
}
function coveredBy(t,tag){if(!tag)return [];return stepsOf(t).filter(({ex})=>ex&&((ex.tags||[]).includes(tag)||ex.haupt===tag)).map(({ex})=>ex.name);}
/* ---------- Planung und Durchführung (1c) ----------
   Minuten eines Schritts pro Spielerin bzw. Gruppe. "plan": geplante Dauer. "ist": nur wenn das Training
   durchgeführt ist und der Schritt nicht ausgefallen ist; tatsächliche Dauer, sonst die geplante.
   Bei Stationen verbringt jede Gruppe im Schnitt Blockdauer / Anzahl Stationen an einer Station. */
function stepMin(t,u,st,mode){
  if(mode==="ist"&&(!t.durchgefuehrt||st.s.ausgefallen))return 0;
  if(!u.block)return mode==="ist"&&isSet(st.s.istDauer)?num(st.s.istDauer):u.dur;
  const c=blockCfg(t,u);const dauer=mode==="ist"&&isSet(c.istDauer)?num(c.istDauer):u.dur;
  return dauer/u.steps.length;
}
/* Tatsächliche Gesamtdauer eines Trainings (ohne ausgefallene Schritte). */
function trainingMin(t,mode){return Math.round(unitsOf(t).reduce((a,u)=>a+u.steps.reduce((b,st)=>b+stepMin(t,u,st,mode),0),0));}
function openTags(t){return [...new Set(openPoints(t).filter(p=>!p.erledigt&&p.tag&&!coveredBy(t,p.tag).length).map(p=>p.tag))];}
const ofTeam=c=>Object.entries(S[c]).filter(([,o])=>o.team===S.team);
const sortedTrainings=()=>ofTeam("trainings").sort((a,b)=>(b[1].datum||"").localeCompare(a[1].datum||""));
const sortedSpiele=()=>ofTeam("spiele").sort((a,b)=>(b[1].datum||"").localeCompare(a[1].datum||""));

