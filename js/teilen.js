"use strict";
/* ---------- Einzelne Trainings und Übungen mit anderen Trainern teilen ----------
   Die Datei enthält nur Übungen und den Ablauf – keine Namen, keine Anwesenheit, keine
   Einschränkungen, keine Spielberichte und keine Trainingsnotizen (die können Persönliches enthalten). */
const SHARE_TYP="trainingsplaner-teilen";
const ohneZeit=o=>JSON.parse(JSON.stringify(o,(k,v)=>k==="updatedAt"?undefined:v));
const slug=s=>(s||"").trim().replace(/[^\wäöüÄÖÜß-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,40)||"ohne_Namen";

function shareFileData(extra){return {typ:SHARE_TYP,version:DATA_VERSION,erstellt:new Date().toISOString(),...extra};}
async function sendShared(name,data){const txt=JSON.stringify(data,null,1);if(canShareFiles())await shareFile(name,txt);else download(name,txt);}
function shareTraining(id){
  const t=S.trainings[id];if(!t)return;const ues={};
  (t.ablauf||[]).forEach(s=>{const e=S.uebungen[s.uebungId];if(e)ues[s.uebungId]=ohneZeit(e);});
  const tt={datum:t.datum,start:t.start, // ohne Mannschaft und ohne Durchführung: der Empfänger plant damit neu
dauerGesamt:t.dauerGesamt,thema:t.thema,ablauf:clone(t.ablauf||[])};if(t.bloecke)tt.bloecke=clone(t.bloecke);
  sendShared(`Training_${[t.datum,t.thema&&slug(t.thema)].filter(Boolean).join("_")||"ohne_Datum"}.json`,shareFileData({trainings:{[id]:tt},uebungen:ues}));
}
function shareEx(id){const e=S.uebungen[id];if(!e)return;sendShared(`Uebung_${slug(e.name)}.json`,shareFileData({uebungen:{[id]:ohneZeit(e)}}));}

/* Einspielen: gleiche Übung (gleiche Kennung, gleicher Inhalt) wird wiederverwendet, abweichende
   kommt als Kopie dazu – vorhandene Übungen werden nie überschrieben. Trainings kommen immer als neues Training. */
function importShared(d){
  if(num(d.version)>DATA_VERSION){toast("Die Datei stammt aus einer neueren Version der App. Bitte zuerst die App aktualisieren.");return;}
  try{d=migratePart(d,d.version);}catch(e){toast("Die Datei konnte nicht gelesen werden.");return;}
  const ues=d.uebungen||{},trs=d.trainings||{};const nU=Object.keys(ues).length,nT=Object.keys(trs).length;
  if(!nU&&!nT){toast("In der Datei ist nichts zum Übernehmen.");return;}
  const plan={};let neu=0,gleich=0,kopie=0;
  Object.entries(ues).forEach(([id,e])=>{const have=S.uebungen[id];
    if(!have){plan[id]={id,mode:"neu"};neu++;}
    else if(JSON.stringify(ohneZeit(have))===JSON.stringify(ohneZeit(e))){plan[id]={id,mode:"gleich"};gleich++;}
    else{plan[id]={id:uid(),mode:"kopie"};kopie++;}});
  const msg=`${nT?`${nT} Training${nT>1?"s":""} und `:""}${nU} Übung${nU>1?"en":""} übernehmen?\n\n`+
    [neu&&`${neu} neu`,gleich&&`${gleich} schon vorhanden (wird wiederverwendet)`,kopie&&`${kopie} gibt es bei dir in anderer Fassung – kommt als Kopie dazu`].filter(Boolean).join("\n")+
    `\n\nDeine vorhandenen Übungen werden nicht verändert.`;
  if(!confirmDel(msg))return;
  const add=(list,v)=>{if(v&&!list.includes(v)){list.push(v);return true;}return false;};let setCh=false;
  Object.entries(ues).forEach(([id,e])=>{const p=plan[id];if(p.mode==="gleich")return;const c=clone(e);if(p.mode==="kopie")c.name=(c.name||"Übung").trim()+" (geteilt)";
    c.material=c.material||{};const matKeys=new Set(S.settings.material.map(m=>m.k));Object.keys(c.material).forEach(k=>{if(!matKeys.has(k)){S.settings.material.push({k,l:k});setCh=true;}});
    if(add(S.settings.kategorien,c.kategorie))setCh=true;(c.tags||[]).forEach(x=>{if(add(S.settings.tags,x))setCh=true;});
    S.uebungen[p.id]=c;saveLater("uebung",p.id);});
  let lastT=null;
  Object.values(trs).forEach(t=>{const id=uid();const c=Object.assign(clone(t),{team:S.team,anwesenheit:{},einschr:einschrSnapshot(),notizen:"",spielId:""});
    c.ablauf=(c.ablauf||[]).map(s=>{const n={...s,uid:uid(),uebungId:plan[s.uebungId]?plan[s.uebungId].id:s.uebungId};
      if(n.name==null&&S.uebungen[n.uebungId])Object.assign(n,snapshot(S.uebungen[n.uebungId]));delete n.ausgefallen;delete n.istDauer;return n;});
    delete c.durchgefuehrt;delete c.abweichung;if(c.bloecke)Object.values(c.bloecke).forEach(b=>delete b.istDauer);
    S.trainings[id]=c;saveLater("training",id);lastT=id;});
  if(setCh)saveLater("settings");
  if(lastT){S.sel.training=lastT;S.view="training";}else{const first=Object.values(plan)[0];S.sel.uebung=first.id;S.view="uebungen";}
  render();window.scrollTo(0,0);toast("Übernommen");
}
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;
  if(el.dataset.act==="shareTraining")shareTraining(S.sel.training);
  if(el.dataset.act==="shareEx")shareEx(S.sel.uebung);});
