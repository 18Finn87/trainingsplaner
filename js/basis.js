"use strict";
/* ---------- constants ---------- */
/* Grundwerte der Auswahllisten – gepflegt werden sie in den Einstellungen (S.settings). */
const DEF_MAT=[["baelle","Bälle"],["huetchen","Hütchen"],["teller","Markierungsteller"],["leibchen","Leibchen-Sätze"],["tore","Große Tore"],["minitore","Minitore"],["stangen","Stangen"],["dummies","Dummies"],["leiter","Koordinationsleiter"],["ringe","Ringe"]];
const DEFAULT_TAGS=["Zweikampf","Stellungsspiel","Umschalten","Abschluss","Anspielbar sein","Spielaufbau","Pressing","Kommunikation","Kondition","Torwart","Technik","Aufwärmen","Teamgeist"];
const DEF_KAT=["Besprechung","Aufwärmen","Athletik","Technik","Torschuss","Taktik","Spielform","Abschlussspiel","Cool-down"];
const DEF_GRUENDE=["Krankheit","Muskelverletzung","Gelenkverletzung","Arbeit","Schule/Studium","Urlaub","Sonstiges"];
const DEF_POS=["Tor","Abwehr","Mittelfeld","Sturm"];
/* Hauptschwerpunkte (genau einer je Übung). Nebenschwerpunkte sind die Liste settings.tags. */
const DEF_SCHWERPUNKTE=["Technik","Taktik","Athletik","Koordination","Torwart"];
const HAUPT_AUS_KAT=["Technik","Taktik","Athletik"]; // Kategorien, die bei der Umstellung eindeutig ein Schwerpunkt sind
const matList=()=>(S.settings.material||[]).map(m=>[m.k,m.l]);
const matLabel=k=>{const m=(S.settings.material||[]).find(x=>x.k===k);return m?m.l:k;};
const katList=()=>S.settings.kategorien||[];
/* Kategorie-Farben für die Zeitleiste: gedeckte Töne, die auf Schwarz und Weiß funktionieren. */
const KATPAL=["#8C8C8C","#BDBDBD","#5E8C6A","#5B7FA6","#A65B5B","#7D6BA6","#4E9A8A","#B5835A","#6B7A8F","#A69A5B"];
const katCol=k=>{const i=katList().indexOf(k);return i<0?"#6E6E6E":KATPAL[i%KATPAL.length];};
/* Anwesenheit je Training: "" offen (noch nicht erfasst), "ja" anwesend, "nein" abwesend.
   „Eingeschränkt“ hängt an der Spielerin (player.einschr) und wird je Training festgehalten (t.einschr). */
const ATTL={"":"offen",ja:"anwesend",nein:"abwesend"};
const ARTS=["minus","plus","info"];
const ARTL={plus:"+",minus:"−",info:"•"};
const ARTN={plus:"Positiv",minus:"Negativ",info:"Hinweis"};

/* ---------- state ---------- */
const S={view:"training",ready:false,mode:"none",meta:{},persistent:false,team:null,teamsDoc:{list:[]},kaders:{},settings:null,uebungen:{},trainings:{},spiele:{},
  sel:{training:null,uebung:null,spiel:null},ui:{open:{},q:"",tag:"",pickQ:"",pickTag:"",backTo:null},notice:""};
function defaultSettings(){return {tags:DEFAULT_TAGS.slice(),schwerpunkte:DEF_SCHWERPUNKTE.slice(),kategorien:DEF_KAT.slice(),gruende:DEF_GRUENDE.slice(),positionen:DEF_POS.slice(),
  material:DEF_MAT.map(([k,l])=>({k,l})),saisonStart:"07-01",halbserieWechsel:"01-01",inventar:{leibchen:3},leibchenProSatz:9,start:"19:00",dauer:90};}
S.settings=defaultSettings();
/* S.kader ist immer der Kader der gewählten Mannschaft. */
Object.defineProperty(S,"kader",{get(){const t=S.team||"team1";if(!S.kaders[t])S.kaders[t]={players:[]};return S.kaders[t];},set(v){S.kaders[S.team||"team1"]=v;}});
const teamCfg=()=>S.teamsDoc.list.find(t=>t.id===S.team)||{id:S.team,name:"",start:S.settings.start||"19:00",dauer:num(S.settings.dauer)||90};
const teamName=()=>teamCfg().name||"Mannschaft";

const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clone=o=>JSON.parse(JSON.stringify(o));
const num=v=>{const n=parseInt(v,10);return isNaN(n)?0:n;};
const fmtDate=d=>{if(!d)return "ohne Datum";const [y,m,t]=d.split("-");const wd=["So","Mo","Di","Mi","Do","Fr","Sa"][new Date(d+"T12:00").getDay()];return `${wd}, ${+t}.${+m}.${y}`;};
const fmtStamp=ms=>{const d=new Date(ms);return `${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} Uhr`;};
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const today=()=>iso(new Date());
function nextTrainingDay(){const d=new Date();for(let i=0;i<8;i++){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()+i);if([2,4].includes(x.getDay()))return iso(x);}return today();}
function addMin(t,m){const [h,mi]=(t||"19:00").split(":").map(Number);const x=h*60+mi+m;return `${String(Math.floor(x/60)%24).padStart(2,"0")}:${String(x%60).padStart(2,"0")}`;}
function toast(msg){const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600);}
function setStatus(s){$("#status").textContent=s;}
/* Texteingaben: beim Verlassen des Feldes Leerzeichen am Anfang/Ende entfernen und so speichern
   (läuft vor allen anderen Änderungs-Handlern; Zahlen-, Datums- und Suchfelder bleiben unberührt). */
document.addEventListener("change",e=>{const el=e.target;
  const txt=el.tagName==="TEXTAREA"||(el.tagName==="INPUT"&&["text","email",""].includes(el.getAttribute("type")||""));
  if(!txt||el.type==="search")return;const v=el.value.trim();if(v===el.value)return;
  el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));},true);

