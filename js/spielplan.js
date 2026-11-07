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
  if(!Array.isArray(p.stdOff))p.stdOff=[];if(!Array.isArray(p.zuordnung))p.zuordnung=[];
  if(typeof p.pressY!=="number")p.pressY=null;if(typeof p.pressAnzeigen!=="boolean")p.pressAnzeigen=true;return p;}
/* Pressinglinie in % von oben (Gegner-Tor oben, eigenes Tor unten); Feineinstellung überschreibt die Stufe */
const PRESS_Y={hoch:32,mittel:50,tief:68};
const pressHoehe=p=>typeof p.pressY==="number"?p.pressY:PRESS_Y[p.pressing]||50;
/* Feld-Grafik: wo die Mannschaft gegen den Ball anläuft */
const pressGrafik=(h,y)=>{y=typeof y==="number"?y:PRESS_Y[h]||50;const top=Math.max(3,Math.min(61,y-18));
  return `<div class="pfeld" aria-hidden="true"><i class="pz" style="top:${top}%;height:36%"></i><i class="pl"></i><i class="plinie" style="top:${y}%"></i><span class="pt">Gegner-Tor</span><span class="pe">eigenes Tor</span></div>`;};
/* ---------- Zeichenfelder (Taktiktafel) mit „Aufstellung übernehmen“ und Zuordnung Nummer = Spielerin ---------- */
const TAFEL_FARBEN={rot:"Rot",gelb:"Gelb",tw:"TW"};
function tafelAufstellung(s,f){
  const a=aufst(s);const F=slotsVon(a);const std=f.startsWith("boardStd");
  const b=s[f]=s[f]||{field:std?"half":"full",items:[],lines:[]};b.items=(b.items||[]).filter(it=>it.k!=="rot");b.lines=b.lines||[];
  b.namen=Object.assign({},b.namen);Object.keys(b.namen).forEach(k=>{if(k.startsWith("rot:"))delete b.namen[k];});
  const kader=(s.kader||[]).filter(pById);const ids=F.map((_,i)=>a.plaetze[i]&&pById(a.plaetze[i])?a.plaetze[i]:null);
  if(!ids.some(Boolean))kader.slice(0,F.length).forEach((pid,i)=>ids[i]=pid);
  const shift=f==="boardGegenBall"?(pressHoehe(plan(s))-50)*.6:0;   // gegen den Ball: Linien zur Pressinghöhe schieben
  F.forEach(([pos,x,y],i)=>{let px,py;
    if(b.field==="full"){px=x*.68;py=Math.max(4,Math.min(98,y+(i===0?0:shift)))*1.05;}
    else if(b.field==="half"){const reihe=i<6?0:1,anz=reihe?F.length-6:Math.min(6,F.length),sp=reihe?i-6:i;px=anz===1?34:6+sp*(56/Math.max(1,anz-1));py=reihe?49:44;}
    else{px=x*.4;py=y*.3;}
    b.items.push({k:"rot",x:+px.toFixed(2),y:+py.toFixed(2),n:String(i+1)});if(ids[i])b.namen["rot:"+(i+1)]=ids[i];});
}
function tafelLegende(s,f){
  const b=s[f];const toks=(b&&b.items||[]).filter(it=>TAFEL_FARBEN[it.k]&&it.n);if(!toks.length)return "";const seen=new Set();
  const reihe=Object.keys(TAFEL_FARBEN);const sort=toks.slice().sort((x,y)=>reihe.indexOf(x.k)-reihe.indexOf(y.k)||(parseInt(x.n,10)||0)-(parseInt(y.n,10)||0));
  return `<p class="legend" style="margin:10px 0 4px">Wer ist wer? Der Name steht dann auf dem Feld unter der Nummer. (Blau = Gegner)</p><div class="tlgrid">${sort.filter(it=>{const k=it.k+":"+it.n;if(seen.has(k))return false;seen.add(k);return true;})
    .map(it=>{const k=it.k+":"+it.n;return `<label class="tlrow"><span class="tdot ${it.k}">${esc(it.n)}</span>${spielerAuswahl(s,(b.namen||{})[k],`data-act="plTafelName" data-f="${f}" data-k="${esc(k)}" aria-label="${TAFEL_FARBEN[it.k]} ${esc(it.n)}"`)}</label>`;}).join("")}</div>`;
}
function tafelBlock(id,s,f,titel,hinweis){
  const offen=S.ui.open["d"+f+id]??!!(s[f]&&((s[f].items||[]).length||(s[f].lines||[]).length));
  return `<details class="fold tafelfold" data-dkey="${f}-${id}"${offen?" open":""}><summary>${titel}</summary>
    <p class="hint" style="margin:0 0 8px">${hinweis}</p>
    <div class="row-actions" style="margin:0 0 8px"><button class="btn sm" data-act="plTafelAuf" data-f="${f}">${(s[f]&&(s[f].items||[]).some(it=>it.k==="rot"))?"Aufstellung neu übernehmen":"Aufstellung übernehmen"}</button></div>
    <div data-board="spiel:${id}:${f}"></div><div class="tleg" data-tleg="${f}">${tafelLegende(s,f)}</div></details>`;
}
/* Zuordnung nach Änderungen auf der Tafel auffrischen (neue Spielerin gesetzt, Nummer geändert …) */
let tlegTimer=null;
function tlegAuffrischen(){clearTimeout(tlegTimer);tlegTimer=setTimeout(()=>{const s=S.spiele[S.sel.spiel];if(!s||S.view!=="spiele")return;
  document.querySelectorAll("[data-tleg]").forEach(el=>{if(el.contains(document.activeElement))return;el.innerHTML=tafelLegende(s,el.dataset.tleg);});},120);}
["pointerup","input","click"].forEach(t=>document.addEventListener(t,e=>{if(e.target.closest&&e.target.closest('.tafelfold [data-board]'))tlegAuffrischen();},true));
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
  const skizze=(f,titel)=>tafelBlock(id,s,f,titel,"„Aufstellung übernehmen“ setzt eure Spielerinnen als rote Nummern aufs Feld. Gegnerinnen in Blau, Laufwege und Pässe mit den Pfeilen.");
  const py=pressHoehe(p);
  return `<section class="blk"><h3>Spielidee</h3>
     <p class="legend" style="margin:0 0 6px">Gegen den Ball – Pressinghöhe</p>${seg2("pressing",p.pressing,PRESSING)}${pressGrafik(p.pressing,py)}
     <label class="f prange">Pressinglinie genau einstellen<input type="range" min="15" max="85" step="1" data-act="plPressY" value="${py}" aria-label="Pressinglinie"><span class="src">weiter vorne ←→ weiter hinten</span></label>
     <label class="cbrow"><input type="checkbox" data-act="plCb" data-f="pressAnzeigen"${p.pressAnzeigen?" checked":""}> Pressinglinie in der Aufstellung anzeigen</label>
     ${ta("gegenBall","Anlaufen & Pressingauslöser","z. B. ST lenkt nach außen, Auslöser: Rückpass zur IV, schlechte Ballannahme")}
     ${tafelBlock(id,s,"boardGegenBall","Spielfeld: Gegen den Ball – Verschieben & Anlaufen","„Aufstellung übernehmen“ stellt eure Spielerinnen auf die eingestellte Pressinghöhe. Zeichne mit den Pfeilen, wie ihr anlauft und verschiebt.")}
     <p class="legend" style="margin:14px 0 6px">Mit Ball – Spielaufbau</p>${seg2("aufbau",p.aufbau,AUFBAU)}
     ${ta("mitBall","Spielaufbau & Angriff","z. B. Aufbau über die Sechs, Flügel breit, Tiefe über die Spitze")}
     ${tafelBlock(id,s,"boardMitBall","Spielfeld: Mit Ball – Aufbau & Laufwege","Zeichne Passwege (Pass), Laufwege (gestrichelt) und Dribblings.")}
     ${ta("umschalten","Umschalten","z. B. nach Ballgewinn sofort in die Tiefe; nach Ballverlust 5 Sek. Gegenpressing")}</section>
   <section class="blk"><h3>Standards offensiv <span class="sub">${p.stdOff.length}</span></h3>
     ${std||'<p class="hint" style="margin:0">Noch keine Standards eingetragen.</p>'}
     <div class="row-actions"><button class="btn sm" data-act="plAdd" data-l="stdOff">Standard hinzufügen</button>${p.stdOff.length?"":`<button class="btn sm ghost" data-act="plVorlage">Ecken & Freistöße vorbereiten</button>`}</div>
     ${skizze("boardStdOff","Spielfeld: Standards offensiv einzeichnen")}</section>
   <section class="blk"><h3>Standards defensiv</h3>
     <p class="legend" style="margin:0 0 6px">Ecken verteidigen</p>${seg2("ecken",p.ecken,ECKEN_DEF)}
     <p class="legend" style="margin:14px 0 6px">Aufgaben & Zuordnung</p>${zu||'<p class="hint" style="margin:0">Noch keine Aufgaben verteilt.</p>'}
     <datalist id="plAufgaben">${AUFGABEN.map(a=>`<option value="${esc(a)}">`).join("")}</datalist>
     <div class="row-actions"><button class="btn sm" data-act="plAdd" data-l="zuordnung">Aufgabe hinzufügen</button></div>
     <label class="f" style="margin-top:10px">Mauer<input class="inp" data-key="pl-mauer" data-act="plF" data-f="mauer" value="${esc(p.mauer)}" placeholder="z. B. 3er-Mauer: Lisa, Mia, Jana – Lisa ruft"></label>
     ${ta("stdNotiz","Weitere Hinweise","z. B. bei Einwürfen in eigener Hälfte kurz anbieten")}
     ${skizze("boardStdDef","Spielfeld: Standards defensiv einzeichnen")}</section>
   <section class="blk"><h3>Notizen <span class="sub">nur für das Trainerteam</span></h3>
    <label class="f">Gegner – was wissen wir?<textarea class="inp" style="width:100%" rows="3" data-key="s-ginfo" data-bind="gegnerInfo" placeholder="z. B. schnelle Außen, stark bei Standards, spielt lange Bälle">${esc(s.gegnerInfo||"")}</textarea></label>
    <label class="f" style="margin-top:10px">Weitere Taktik-Notizen<textarea class="inp" style="width:100%" rows="3" data-key="s-taktik" data-bind="taktik" placeholder="alles, was nicht für die Mannschaft bestimmt ist">${esc(s.taktik||"")}</textarea></label></section>`;
}
/* Für Spielerinnen veröffentlichte Fassung (nur Namen, keine internen Notizen) */
function matchplanDaten(s){const p=plan(s);const nm=id=>{const x=pById(id);return x?x.name:"";};
  return {pressing:p.pressing,aufbau:p.aufbau,gegenBall:p.gegenBall,mitBall:p.mitBall,umschalten:p.umschalten,
    stdOff:p.stdOff.map(x=>({art:x.art,name:nm(x.schuetzin),variante:x.variante||""})),ecken:p.ecken,
    zuordnung:p.zuordnung.filter(x=>x.aufgabe||x.pid).map(x=>({aufgabe:x.aufgabe||"",name:nm(x.pid)})),mauer:p.mauer,stdNotiz:p.stdNotiz,
    pressY:pressHoehe(p),pressAnzeigen:p.pressAnzeigen,tafeln:tafelnDaten(s)};}
/* Zeichenfelder als fertige Bilder (SVG) mit Namen statt Kennungen – für die Spielerinnen-Ansicht */
const TAFEL_TITEL={boardGegenBall:"Gegen den Ball – Verschieben & Anlaufen",boardMitBall:"Mit Ball – Aufbau & Laufwege",boardStdOff:"Standards offensiv",boardStdDef:"Standards defensiv"};
function tafelnDaten(s){
  return Object.keys(TAFEL_TITEL).filter(f=>s[f]&&((s[f].items||[]).length||(s[f].lines||[]).length)).map(f=>{
    const b=JSON.parse(JSON.stringify(s[f]));b.namenText={};(b.items||[]).forEach(it=>{const n=tokenName(s[f],it);if(n)b.namenText[it.k+":"+it.n]=n;});delete b.namen;
    return {titel:TAFEL_TITEL[f],svg:boardSVG(b,"pub"+f)};});
}
function matchplanAnzeige(m){
  if(!m)return "";const t=(arr,k)=>(arr.find(x=>x[0]===k)||[k,k])[1];const txt=v=>v?`<p class="fgtext" style="margin:4px 0 8px">${esc(v)}</p>`:"";
  const tafel=titel=>{const x=(m.tafeln||[]).find(z=>z.titel===titel);return x?`<div class="tafelpub">${x.svg}</div>`:"";};
  return `<div class="mplan"><p class="legend" style="margin:12px 0 4px">Gegen den Ball: <b>${esc(t(PRESSING,m.pressing))}</b></p>${pressGrafik(m.pressing,m.pressY)}${txt(m.gegenBall)}${tafel(TAFEL_TITEL.boardGegenBall)}
    ${tafel(TAFEL_TITEL.boardMitBall)?`<p class="legend" style="margin:8px 0 4px">Mit Ball – Aufbau & Laufwege</p>${tafel(TAFEL_TITEL.boardMitBall)}`:""}
    ${tafel(TAFEL_TITEL.boardStdOff)?`<p class="legend" style="margin:8px 0 4px">Standards offensiv – Skizze</p>${tafel(TAFEL_TITEL.boardStdOff)}`:""}
    ${tafel(TAFEL_TITEL.boardStdDef)?`<p class="legend" style="margin:8px 0 4px">Standards defensiv – Skizze</p>${tafel(TAFEL_TITEL.boardStdDef)}`:""}
    <p class="legend" style="margin:8px 0 4px">Mit Ball: <b>${esc(t(AUFBAU,m.aufbau))}</b></p>${txt(m.mitBall)}${m.umschalten?`<p class="legend" style="margin:8px 0 4px">Umschalten</p>${txt(m.umschalten)}`:""}
    ${m.stdOff&&m.stdOff.length?`<p class="legend" style="margin:10px 0 4px">Standards offensiv</p><ul class="hist">${m.stdOff.map(x=>`<li><b>${esc(x.art)}</b><span>${esc(x.name||"–")}</span><em>${esc(x.variante)}</em></li>`).join("")}</ul>`:""}
    <p class="legend" style="margin:10px 0 4px">Standards defensiv: <b>${esc(t(ECKEN_DEF,m.ecken))}</b></p>
    ${m.zuordnung&&m.zuordnung.length?`<ul class="hist">${m.zuordnung.map(x=>`<li><b>${esc(x.aufgabe)}</b><span>${esc(x.name||"–")}</span><em></em></li>`).join("")}</ul>`:""}
    ${m.mauer?`<p style="margin:6px 0 0"><b>Mauer:</b> ${esc(m.mauer)}</p>`:""}${txt(m.stdNotiz)}</div>`;
}

$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el||S.view!=="spiele")return;const s=S.spiele[S.sel.spiel];if(!s)return;const a=el.dataset.act;
  if(!a.startsWith("pl"))return;const p=plan(s);const save=()=>{saveLater("spiel",S.sel.spiel);render();};
  if(a==="plSeg"){p[el.dataset.f]=el.dataset.v;if(el.dataset.f==="pressing")p.pressY=null;save();}
  if(a==="plTafelAuf"){const f=el.dataset.f;if(s[f]&&(s[f].items||[]).some(it=>it.k==="rot")&&!confirmDel("Die roten Spielerinnen auf diesem Feld durch die aktuelle Aufstellung ersetzen? Pfeile, Gegnerinnen und Material bleiben."))return;
    tafelAufstellung(s,f);S.ui.open["d"+f+S.sel.spiel]=true;save();toast("Aufstellung aufs Feld übernommen – zum Verschieben „Bewegen“ wählen");}
  if(a==="plAdd"){const l=el.dataset.l;p[l].push(l==="stdOff"?{id:uid(),art:STD_ARTEN[0],schuetzin:"",variante:""}:{id:uid(),aufgabe:"",pid:""});save();}
  if(a==="plDel"){const l=el.dataset.l;p[l]=p[l].filter(x=>x.id!==el.dataset.x);save();}
  if(a==="plVorlage"){["Ecke links","Ecke rechts","Freistoß zentral"].forEach(art=>p.stdOff.push({id:uid(),art,schuetzin:"",variante:""}));save();}
});
$("#app").addEventListener("change",e=>{const el=e.target;if(S.view!=="spiele")return;const s=S.spiele[S.sel.spiel];if(!s)return;const a=el.dataset.act;
  if(a==="plPressY"){const p=plan(s);p.pressY=+el.value;const n=PRESSING.map(x=>x[0]).reduce((b,k)=>Math.abs(PRESS_Y[k]-p.pressY)<Math.abs(PRESS_Y[b]-p.pressY)?k:b,"mittel");p.pressing=n;saveLater("spiel",S.sel.spiel);render();return;}
  if(a==="plCb"){plan(s)[el.dataset.f]=el.checked;saveLater("spiel",S.sel.spiel);render();return;}
  if(a==="plTafelName"){const b=s[el.dataset.f];if(!b)return;b.namen=b.namen||{};if(el.value)b.namen[el.dataset.k]=el.value;else delete b.namen[el.dataset.k];saveLater("spiel",S.sel.spiel);render();return;}
  if(a!=="plF"&&a!=="plL")return;const p=plan(s);const v=el.tagName==="SELECT"?el.value:el.value.trim();
  if(a==="plF")p[el.dataset.f]=v;
  else{const x=(p[el.dataset.l]||[]).find(y=>y.id===el.dataset.x);if(x)x[el.dataset.f]=v;}
  saveLater("spiel",S.sel.spiel);if(el.tagName==="SELECT")render();
});
