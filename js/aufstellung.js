"use strict";
/* ---------- Aufstellung mit Namen (Datenversion 12) ----------
   spiel.kader        = Spielkader (Kennungen, schon vorhanden)
   spiel.aufstellung  = {formation:"4-4-2", plaetze:{"0":pid,…}, kapitaen:pid|null, notiz:""}
   Bank = Spielkader ohne die Spielerinnen auf dem Feld. Koordinaten: x 0–100 (links→rechts), y 0–100 (Angriff oben, eigenes Tor unten). */
const FORMATIONEN={
  "4-4-2":[["TW",50,91],["LV",13,71],["IV",37,76],["IV",63,76],["RV",87,71],["LM",13,45],["ZM",37,50],["ZM",63,50],["RM",87,45],["ST",37,19],["ST",63,19]],
  "4-2-3-1":[["TW",50,91],["LV",13,71],["IV",37,76],["IV",63,76],["RV",87,71],["DM",37,57],["DM",63,57],["LA",15,35],["ZOM",50,38],["RA",85,35],["ST",50,15]],
  "4-3-3":[["TW",50,91],["LV",13,71],["IV",37,76],["IV",63,76],["RV",87,71],["ZM",27,50],["DM",50,56],["ZM",73,50],["LA",16,23],["ST",50,16],["RA",84,23]],
  "4-1-4-1":[["TW",50,91],["LV",13,71],["IV",37,76],["IV",63,76],["RV",87,71],["DM",50,59],["LM",13,40],["ZM",37,42],["ZM",63,42],["RM",87,40],["ST",50,15]],
  "3-5-2":[["TW",50,91],["IV",25,75],["IV",50,78],["IV",75,75],["LM",10,47],["ZM",31,52],["DM",50,58],["ZM",69,52],["RM",90,47],["ST",37,19],["ST",63,19]],
  "3-4-3":[["TW",50,91],["IV",25,75],["IV",50,78],["IV",75,75],["LM",13,49],["ZM",37,53],["ZM",63,53],["RM",87,49],["LA",18,23],["ST",50,16],["RA",82,23]],
  "5-3-2":[["TW",50,91],["LV",9,64],["IV",29,75],["IV",50,78],["IV",71,75],["RV",91,64],["ZM",27,47],["ZM",50,51],["ZM",73,47],["ST",37,19],["ST",63,19]],
  "5-4-1":[["TW",50,91],["LV",9,64],["IV",29,75],["IV",50,78],["IV",71,75],["RV",91,64],["LM",14,42],["ZM",38,46],["ZM",62,46],["RM",86,42],["ST",50,16]],
};
/* Welche Hauptposition (Kader) passt zu welchem Kürzel – für „Automatisch füllen“ */
const POS_GRUPPE={TW:"Tor",LV:"Abwehr",IV:"Abwehr",RV:"Abwehr",DM:"Mittelfeld",ZM:"Mittelfeld",LM:"Mittelfeld",RM:"Mittelfeld",ZOM:"Mittelfeld",LA:"Sturm",RA:"Sturm",ST:"Sturm"};
function aufst(s){const a=s.aufstellung=s.aufstellung||{};if(!FORMATIONEN[a.formation])a.formation="4-4-2";a.plaetze=a.plaetze||{};if(!("kapitaen" in a))a.kapitaen=null;a.notiz=a.notiz||"";return a;}
const kurzName=p=>{if(!p)return "";const n=(p.name||"").trim();return n.length>11?n.split(/\s+/)[0].slice(0,11):n;};
function aufFeld(s){const a=aufst(s);const k=s.kader||[];Object.keys(a.plaetze).forEach(x=>{if(!k.includes(a.plaetze[x]))delete a.plaetze[x];});if(a.kapitaen&&!k.includes(a.kapitaen))a.kapitaen=null;const ids=new Set(Object.values(a.plaetze));return {a,feld:ids,bank:(s.kader||[]).filter(id=>!ids.has(id)&&pById(id))};}

function aufstellungBlock(id,s){
  const k=s.kader||[];const {a,bank}=aufFeld(s);const F=FORMATIONEN[a.formation];const sel=S.ui.aufSel||null;
  const besetzt=F.filter((_,i)=>a.plaetze[i]&&pById(a.plaetze[i])).length;
  const kopf=`<h3>Aufstellung <span class="sub">${k.length?`${besetzt} von ${F.length} Positionen · ${bank.length} auf der Bank`:"zuerst Spielkader wählen"}</span></h3>`;
  if(!k.length)return `<section class="blk">${kopf}<p class="hint">Wähle oben unter „Kader für dieses Spiel“ aus, wer dabei ist. Danach stellst du hier die Startelf auf – mit Namen.</p></section>`;
  const istSel=(t,v)=>sel&&sel.t===t&&String(sel.v)===String(v);
  const platz=([pos,x,y],i)=>{const p=pById(a.plaetze[i]);return `<button type="button" class="aplatz${p?"":" leer"}${istSel("p",i)?" sel":""}" style="left:${x}%;top:${y}%" data-act="aufPlatz" data-i="${i}" aria-label="${pos}${p?": "+esc(p.name):" – frei"}">
      <span class="apos">${pos}</span><span class="aname">${p?`${p.nummer?`<b>${esc(p.nummer)}</b> `:""}${esc(kurzName(p))}${a.kapitaen===p.id?' <i class="cap">C</i>':""}`:"+"}</span></button>`;};
  const selInfo=sel&&sel.t==="p"&&a.plaetze[sel.v]?pById(a.plaetze[sel.v]):sel&&sel.t==="b"?pById(sel.v):null;
  return `<section class="blk aufst">${kopf}
    <div class="meta"><label class="f">Formation<select data-act="aufForm">${opt(Object.keys(FORMATIONEN).map(f=>[f,f]),a.formation)}</select></label></div>
    <p class="legend" style="margin:6px 0 8px">Antippen: Position wählen, dann eine Spielerin von der Bank antippen – oder zwei Positionen nacheinander antippen zum Tauschen.</p>
    <div class="afeld" role="group" aria-label="Spielfeld">${'<i class="amitte"></i><i class="akreis"></i><i class="astraf o"></i><i class="astraf u"></i>'}${F.map(platz).join("")}</div>
    ${selInfo?`<div class="row-actions aufakt"><span class="src">Ausgewählt: <b>${esc(selInfo.name)}</b></span>
      ${sel.t==="p"?`<button class="btn sm" data-act="aufBank">Auf die Bank</button>`:""}
      <button class="btn sm${a.kapitaen===selInfo.id?" pri":""}" data-act="aufKap" data-id="${selInfo.id}">${a.kapitaen===selInfo.id?"Kapitänin ✓":"Zur Kapitänin machen"}</button>
      <button class="btn sm ghost" data-act="aufAbw">Auswahl aufheben</button></div>`:sel&&sel.t==="p"?`<div class="row-actions aufakt"><span class="src">Position ${esc(F[sel.v][0])} gewählt – jetzt eine Spielerin von der Bank antippen.</span><button class="btn sm ghost" data-act="aufAbw">Abbrechen</button></div>`:""}
    <p class="legend" style="margin:14px 0 6px">Bank (${bank.length})</p>
    <div class="chips">${bank.map(pid=>{const p=pById(pid);return `<button type="button" class="chip tag abank${istSel("b",pid)?" sel":""}" data-act="aufBankP" data-id="${pid}" aria-pressed="${istSel("b",pid)}">${p.nummer?`<span class="nr">${esc(p.nummer)}</span>`:""}${esc(p.name)}${p.tw?' <span class="twm">TW</span>':""}${p.einschr?' <span class="src">eingeschr.</span>':""}</button>`;}).join("")||'<p class="hint" style="margin:0">Alle aus dem Spielkader stehen auf dem Feld.</p>'}</div>
    <label class="f" style="margin-top:12px">Notiz zur Aufstellung<textarea class="inp" rows="2" data-key="auf-notiz" data-act="aufNotiz" placeholder="z. B. Wechsel nach 60 Min.: Lisa für Mia">${esc(a.notiz)}</textarea></label>
    <div class="row-actions"><button class="btn sm" data-act="aufAuto">Freie Positionen automatisch füllen</button><button class="btn sm ghost" data-act="aufLeeren">Alle auf die Bank</button>
      ${typeof terminAufstellungKnopf==="function"?terminAufstellungKnopf(id):""}</div></section>`;
}
/* Freie Positionen nach Hauptposition füllen (TW zuerst), Rest der Reihe nach */
function aufAutoFill(s){
  const {a,bank}=aufFeld(s);const F=FORMATIONEN[a.formation];const frei=F.map((f,i)=>i).filter(i=>!a.plaetze[i]||!pById(a.plaetze[i]));
  const rest=bank.slice();const nimm=f=>{const j=rest.findIndex(f);return j<0?null:rest.splice(j,1)[0];};
  frei.forEach(i=>{const pos=F[i][0],gr=POS_GRUPPE[pos];let pid=null;
    if(pos==="TW")pid=nimm(id=>pById(id).tw)||nimm(id=>pById(id).position==="Tor");
    else pid=nimm(id=>!pById(id).tw&&pById(id).position===gr)||nimm(id=>!pById(id).tw&&(pById(id).positionen||[]).includes(gr));
    if(pid)a.plaetze[i]=pid;});
  frei.filter(i=>!a.plaetze[i]).forEach(i=>{if(F[i][0]==="TW")return;const pid=nimm(id=>!pById(id).tw)||null;if(pid)a.plaetze[i]=pid;});
}

$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el||S.view!=="spiele")return;const s=S.spiele[S.sel.spiel];if(!s)return;const a=el.dataset.act;
  if(!a.startsWith("auf"))return;const A=aufst(s);const sel=S.ui.aufSel;const save=()=>{saveLater("spiel",S.sel.spiel);render();};
  if(a==="aufPlatz"){const i=el.dataset.i;
    if(sel&&sel.t==="b"){Object.keys(A.plaetze).forEach(k=>{if(A.plaetze[k]===sel.v)delete A.plaetze[k];});A.plaetze[i]=sel.v;S.ui.aufSel=null;save();return;}
    if(sel&&sel.t==="p"&&sel.v!==i){const x=A.plaetze[sel.v],y=A.plaetze[i];if(y)A.plaetze[sel.v]=y;else delete A.plaetze[sel.v];if(x)A.plaetze[i]=x;else delete A.plaetze[i];S.ui.aufSel=null;save();return;}
    S.ui.aufSel=sel&&sel.t==="p"&&sel.v===i?null:{t:"p",v:i};render();}
  if(a==="aufBankP"){const pid=el.dataset.id;
    if(sel&&sel.t==="p"){A.plaetze[sel.v]=pid;S.ui.aufSel=null;save();return;}
    S.ui.aufSel=sel&&sel.t==="b"&&sel.v===pid?null:{t:"b",v:pid};render();}
  if(a==="aufBank"&&sel&&sel.t==="p"){delete A.plaetze[sel.v];S.ui.aufSel=null;save();}
  if(a==="aufKap"){A.kapitaen=A.kapitaen===el.dataset.id?null:el.dataset.id;save();}
  if(a==="aufAbw"){S.ui.aufSel=null;render();}
  if(a==="aufAuto"){aufAutoFill(s);S.ui.aufSel=null;save();toast("Freie Positionen gefüllt – bitte prüfen");}
  if(a==="aufLeeren"){if(!confirmDel("Alle Spielerinnen auf die Bank setzen?"))return;A.plaetze={};S.ui.aufSel=null;save();}
});
$("#app").addEventListener("change",e=>{const el=e.target;if(S.view!=="spiele")return;const s=S.spiele[S.sel.spiel];if(!s)return;
  if(el.dataset.act==="aufForm"){const A=aufst(s);const alt=FORMATIONEN[A.formation].length;A.formation=el.value;const n=FORMATIONEN[A.formation].length;
    Object.keys(A.plaetze).forEach(k=>{if(+k>=n)delete A.plaetze[k];});if(n<alt)toast("Spielerinnen auf weggefallenen Positionen sind jetzt auf der Bank");S.ui.aufSel=null;saveLater("spiel",S.sel.spiel);render();}
  if(el.dataset.act==="aufNotiz"){aufst(s).notiz=el.value.trim();saveLater("spiel",S.sel.spiel);}
});
/* Aufstellung als einfache Liste (für Spielerinnen-Ansicht und Druck) */
function aufstellungDaten(s){
  const {a,bank}=aufFeld(s);const F=FORMATIONEN[a.formation];
  return {formation:a.formation,plaetze:F.map(([pos,x,y],i)=>{const p=pById(a.plaetze[i]);return {pos,x,y,name:p?p.name:"",nr:p?p.nummer||"":"",kap:!!(p&&a.kapitaen===p.id)};}),
    bank:bank.map(id=>{const p=pById(id);return {name:p.name,nr:p.nummer||""};}),notiz:a.notiz||""};
}
/* Anzeige einer veröffentlichten Aufstellung (ohne Bearbeiten) */
function aufstellungAnzeige(d){
  if(!d||!d.plaetze)return "";
  return `<div class="afeld klein">${'<i class="amitte"></i><i class="akreis"></i><i class="astraf o"></i><i class="astraf u"></i>'}${d.plaetze.map(p=>`<span class="aplatz${p.name?"":" leer"}" style="left:${p.x}%;top:${p.y}%"><span class="apos">${esc(p.pos)}</span><span class="aname">${p.name?`${p.nr?`<b>${esc(p.nr)}</b> `:""}${esc(p.name.length>11?p.name.split(/\s+/)[0]:p.name)}${p.kap?' <i class="cap">C</i>':""}`:"–"}</span></span>`).join("")}</div>
    ${d.bank&&d.bank.length?`<p class="legend" style="margin:10px 0 4px">Bank</p><p style="margin:0">${d.bank.map(b=>esc((b.nr?b.nr+" ":"")+b.name)).join(" · ")}</p>`:""}
    ${d.notiz?`<p class="hint" style="margin-top:8px">${esc(d.notiz)}</p>`:""}`;
}
