"use strict";
/* ---------- Matchplan in der Spielplanung (Datenversion 15) ----------
   spiel.plan = {pressing:"hoch|mittel|tief", aufbau:"kurz|gemischt|lang", gegenBall:"", mitBall:"", umschalten:"",
                 stdOff:[{id,art,schuetzin,variante}], ecken:"raum|mann|gemischt", zuordnung:[{id,aufgabe,pid}], mauer:"", stdNotiz:""}
   Skizzen: spiel.boardStdOff / spiel.boardStdDef (wie die Taktiktafel im Spielbericht).
   gegnerInfo und taktik (Notizen) bleiben intern; Pressing, Aufbau und Standards werden mit der Aufstellung veröffentlicht. */
const PRESSING=[["hoch","Hohes Pressing"],["mittel","Mittelfeldpressing"],["tief","Tiefer Block"]];
const AUFBAU=[["kurz","Flach von hinten"],["gemischt","Gemischt"],["lang","Lange Bälle"]];
const ECKEN_DEF=[["raum","Raumdeckung"],["mann","Manndeckung"],["gemischt","Gemischt"]];
const STD_ARTEN=["Ecke links","Ecke rechts","Freistoß zentral","Freistoß links","Freistoß rechts","Einwurf","Elfmeter","Anstoß"];
const AUFGABEN=["1. Pfosten","2. Pfosten","Kurzer Raum","Torraum","Elfmeterpunkt","Gegen die Größte","Rückraum","Konter bleiben","Mauer","Ballführende stören"];
function plan(s){const p=s.plan=s.plan||{};
  if(!PRESSING.some(x=>x[0]===p.pressing))p.pressing="mittel";if(!AUFBAU.some(x=>x[0]===p.aufbau))p.aufbau="gemischt";if(!ECKEN_DEF.some(x=>x[0]===p.ecken))p.ecken="raum";
  ["gegenBall","mitBall","umschalten","mauer","stdNotiz"].forEach(k=>{if(typeof p[k]!=="string")p[k]="";});
  if(!Array.isArray(p.stdOff))p.stdOff=[];if(!Array.isArray(p.zuordnung))p.zuordnung=[];return p;}
/* Feld-Grafik: wo die Mannschaft gegen den Ball anläuft */
const pressGrafik=h=>`<div class="pfeld" aria-hidden="true"><i class="pz ${h}"></i><i class="pl"></i><span class="pt">Gegner-Tor</span><span class="pe">eigenes Tor</span></div>`;
function spielerAuswahl(s,wert,attrs){
  const ids=(s.kader&&s.kader.length?s.kader:players().map(p=>p.id)).filter(pById);const ps=ids.map(pById).sort(nrSort);
  return `<select class="inp" ${attrs}>${opt([["","– wer? –"],...ps.map(p=>[p.id,(p.nummer?p.nummer+" ":"")+p.name]),...(wert&&!ids.includes(wert)&&pById(wert)?[[wert,pById(wert).name]]:[])],wert||"")}</select>`;
}
function matchplanBlock(id,s){
  const p=plan(s);const seg2=(f,wert,opts)=>seg("plSeg",wert,opts).replace(/data-act="plSeg"/g,`data-act="plSeg" data-f="${f}"`);
  const ta=(f,label,ph,rows=2)=>`<label class="f" style="margin-top:10px">${label}<textarea class="inp" rows="${rows}" data-key="pl-${f}" data-act="plF" data-f="${f}" placeholder="${ph}">${esc(p[f])}</textarea></label>`;
  const std=p.stdOff.map(x=>`<div class="stdrow"><select class="inp" data-act="plL" data-l="stdOff" data-x="${x.id}" data-f="art" aria-label="Art">${opt(STD_ARTEN.map(a=>[a,a]),x.art)}</select>
      ${spielerAuswahl(s,x.schuetzin,`data-act="plL" data-l="stdOff" data-x="${x.id}" data-f="schuetzin" aria-label="Schützin"`)}
      <input class="inp" data-key="std-${x.id}" data-act="plL" data-l="stdOff" data-x="${x.id}" data-f="variante" value="${esc(x.variante||"")}" placeholder="Variante, z. B. kurz ausführen, Flanke auf 2. Pfosten">
      <button class="iconbtn" data-act="plDel" data-l="stdOff" data-x="${x.id}" aria-label="Entfernen">✕</button></div>`).join("");
  const zu=p.zuordnung.map(x=>`<div class="stdrow zu"><input class="inp" list="plAufgaben" data-key="zu-${x.id}" data-act="plL" data-l="zuordnung" data-x="${x.id}" data-f="aufgabe" value="${esc(x.aufgabe||"")}" placeholder="Aufgabe">
      ${spielerAuswahl(s,x.pid,`data-act="plL" data-l="zuordnung" data-x="${x.id}" data-f="pid" aria-label="Spielerin"`)}
      <button class="iconbtn" data-act="plDel" data-l="zuordnung" data-x="${x.id}" aria-label="Entfernen">✕</button></div>`).join("");
  const skizze=(f,titel)=>`<details class="fold" data-dkey="${f}-${id}"${S.ui.open["d"+f+id]??(s[f]&&(s[f].items||[]).length)?" open":""}><summary>${titel}</summary><div data-board="spiel:${id}:${f}"></div></details>`;
  return `<section class="blk"><h3>Spielidee</h3>
     <p class="legend" style="margin:0 0 6px">Gegen den Ball – Pressinghöhe</p>${seg2("pressing",p.pressing,PRESSING)}${pressGrafik(p.pressing)}
     ${ta("gegenBall","Anlaufen & Pressingauslöser","z. B. ST lenkt nach außen, Auslöser: Rückpass zur IV, schlechte Ballannahme")}
     <p class="legend" style="margin:14px 0 6px">Mit Ball – Spielaufbau</p>${seg2("aufbau",p.aufbau,AUFBAU)}
     ${ta("mitBall","Spielaufbau & Angriff","z. B. Aufbau über die Sechs, Flügel breit, Tiefe über die Spitze")}
     ${ta("umschalten","Umschalten","z. B. nach Ballgewinn sofort in die Tiefe; nach Ballverlust 5 Sek. Gegenpressing")}</section>
   <section class="blk"><h3>Standards offensiv <span class="sub">${p.stdOff.length}</span></h3>
     ${std||'<p class="hint" style="margin:0">Noch keine Standards eingetragen.</p>'}
     <div class="row-actions"><button class="btn sm" data-act="plAdd" data-l="stdOff">Standard hinzufügen</button>${p.stdOff.length?"":`<button class="btn sm ghost" data-act="plVorlage">Ecken & Freistöße vorbereiten</button>`}</div>
     ${skizze("boardStdOff","Skizze Standards offensiv")}</section>
   <section class="blk"><h3>Standards defensiv</h3>
     <p class="legend" style="margin:0 0 6px">Ecken verteidigen</p>${seg2("ecken",p.ecken,ECKEN_DEF)}
     <p class="legend" style="margin:14px 0 6px">Aufgaben & Zuordnung</p>${zu||'<p class="hint" style="margin:0">Noch keine Aufgaben verteilt.</p>'}
     <datalist id="plAufgaben">${AUFGABEN.map(a=>`<option value="${esc(a)}">`).join("")}</datalist>
     <div class="row-actions"><button class="btn sm" data-act="plAdd" data-l="zuordnung">Aufgabe hinzufügen</button></div>
     <label class="f" style="margin-top:10px">Mauer<input class="inp" data-key="pl-mauer" data-act="plF" data-f="mauer" value="${esc(p.mauer)}" placeholder="z. B. 3er-Mauer: Lisa, Mia, Jana – Lisa ruft"></label>
     ${ta("stdNotiz","Weitere Hinweise","z. B. bei Einwürfen in eigener Hälfte kurz anbieten")}
     ${skizze("boardStdDef","Skizze Standards defensiv")}</section>
   <section class="blk"><h3>Notizen <span class="sub">nur für das Trainerteam</span></h3>
    <label class="f">Gegner – was wissen wir?<textarea class="inp" style="width:100%" rows="3" data-key="s-ginfo" data-bind="gegnerInfo" placeholder="z. B. schnelle Außen, stark bei Standards, spielt lange Bälle">${esc(s.gegnerInfo||"")}</textarea></label>
    <label class="f" style="margin-top:10px">Weitere Taktik-Notizen<textarea class="inp" style="width:100%" rows="3" data-key="s-taktik" data-bind="taktik" placeholder="alles, was nicht für die Mannschaft bestimmt ist">${esc(s.taktik||"")}</textarea></label></section>`;
}
/* Für Spielerinnen veröffentlichte Fassung (nur Namen, keine internen Notizen) */
function matchplanDaten(s){const p=plan(s);const nm=id=>{const x=pById(id);return x?x.name:"";};
  return {pressing:p.pressing,aufbau:p.aufbau,gegenBall:p.gegenBall,mitBall:p.mitBall,umschalten:p.umschalten,
    stdOff:p.stdOff.map(x=>({art:x.art,name:nm(x.schuetzin),variante:x.variante||""})),ecken:p.ecken,
    zuordnung:p.zuordnung.filter(x=>x.aufgabe||x.pid).map(x=>({aufgabe:x.aufgabe||"",name:nm(x.pid)})),mauer:p.mauer,stdNotiz:p.stdNotiz};}
function matchplanAnzeige(m){
  if(!m)return "";const t=(arr,k)=>(arr.find(x=>x[0]===k)||[k,k])[1];const txt=v=>v?`<p class="fgtext" style="margin:4px 0 8px">${esc(v)}</p>`:"";
  return `<div class="mplan"><p class="legend" style="margin:12px 0 4px">Gegen den Ball: <b>${esc(t(PRESSING,m.pressing))}</b></p>${pressGrafik(m.pressing)}${txt(m.gegenBall)}
    <p class="legend" style="margin:8px 0 4px">Mit Ball: <b>${esc(t(AUFBAU,m.aufbau))}</b></p>${txt(m.mitBall)}${m.umschalten?`<p class="legend" style="margin:8px 0 4px">Umschalten</p>${txt(m.umschalten)}`:""}
    ${m.stdOff&&m.stdOff.length?`<p class="legend" style="margin:10px 0 4px">Standards offensiv</p><ul class="hist">${m.stdOff.map(x=>`<li><b>${esc(x.art)}</b><span>${esc(x.name||"–")}</span><em>${esc(x.variante)}</em></li>`).join("")}</ul>`:""}
    <p class="legend" style="margin:10px 0 4px">Standards defensiv: <b>${esc(t(ECKEN_DEF,m.ecken))}</b></p>
    ${m.zuordnung&&m.zuordnung.length?`<ul class="hist">${m.zuordnung.map(x=>`<li><b>${esc(x.aufgabe)}</b><span>${esc(x.name||"–")}</span><em></em></li>`).join("")}</ul>`:""}
    ${m.mauer?`<p style="margin:6px 0 0"><b>Mauer:</b> ${esc(m.mauer)}</p>`:""}${txt(m.stdNotiz)}</div>`;
}

$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el||S.view!=="spiele")return;const s=S.spiele[S.sel.spiel];if(!s)return;const a=el.dataset.act;
  if(!a.startsWith("pl"))return;const p=plan(s);const save=()=>{saveLater("spiel",S.sel.spiel);render();};
  if(a==="plSeg"){p[el.dataset.f]=el.dataset.v;save();}
  if(a==="plAdd"){const l=el.dataset.l;p[l].push(l==="stdOff"?{id:uid(),art:STD_ARTEN[0],schuetzin:"",variante:""}:{id:uid(),aufgabe:"",pid:""});save();}
  if(a==="plDel"){const l=el.dataset.l;p[l]=p[l].filter(x=>x.id!==el.dataset.x);save();}
  if(a==="plVorlage"){["Ecke links","Ecke rechts","Freistoß zentral"].forEach(art=>p.stdOff.push({id:uid(),art,schuetzin:"",variante:""}));save();}
});
$("#app").addEventListener("change",e=>{const el=e.target;if(S.view!=="spiele")return;const s=S.spiele[S.sel.spiel];if(!s)return;const a=el.dataset.act;
  if(a!=="plF"&&a!=="plL")return;const p=plan(s);const v=el.tagName==="SELECT"?el.value:el.value.trim();
  if(a==="plF")p[el.dataset.f]=v;
  else{const x=(p[el.dataset.l]||[]).find(y=>y.id===el.dataset.x);if(x)x[el.dataset.f]=v;}
  saveLater("spiel",S.sel.spiel);if(el.tagName==="SELECT")render();
});
