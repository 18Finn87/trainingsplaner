"use strict";
/* Übungen */
function vUebungen(){
  const cur=S.sel.uebung&&S.uebungen[S.sel.uebung]?S.sel.uebung:null;
  const q=S.ui.q.toLowerCase().trim(),tg=S.ui.tag;
  const txt=e=>[e.name,e.kategorie,e.ziel,e.organisation,e.coaching,...(e.tags||[])].join(" ").toLowerCase();
  const ents=Object.entries(S.uebungen).filter(([,e])=>(!q||q.split(/\s+/).every(w=>txt(e).includes(w)))&&(!tg||(e.tags||[]).includes(tg)));
  let li="";katList().concat([""]).forEach(k=>{const g=ents.filter(([,e])=>(e.kategorie||"")===k||(k===""&&!katList().includes(e.kategorie))).sort((a,b)=>(a[1].name||"").localeCompare(b[1].name||""));
    if(g.length)li+=`<div class="grouphead">${esc(k||"Ohne Kategorie")}</div>`+g.map(([id,e])=>`<button class="li" data-act="selUebung" data-id="${id}" aria-current="${id===cur}"><b>${esc(e.name||"Ohne Namen")}</b><span>${num(e.dauer)} min${e.maxSp?` · ${num(e.minSp)||1}–${num(e.maxSp)} Spielerinnen`:""}${num(e.tw)?` · ${num(e.tw)} TW`:""}</span></button>`).join("");});
  return `<div class="split${cur?" has-sel":""}"><aside class="list"><h2>Übungen</h2><button class="btn pri new" data-act="newEx">Neue Übung</button>
   <input class="search" type="search" data-key="exq" data-act="exQ" placeholder="Suchen: Name, Ziel, Coaching …" value="${esc(S.ui.q)}">
   <select class="search" data-act="exTag"><option value="">Alle Trainingsinhalte</option>${S.settings.tags.map(x=>`<option${x===tg?" selected":""}>${esc(x)}</option>`).join("")}</select>
   ${q||tg?`<p class="legend">${ents.length} von ${Object.keys(S.uebungen).length} Übungen</p>`:""}${li||'<p class="hint">Keine Übungen gefunden.</p>'}</aside>
   <div class="editor">${cur?exEditor(cur):`<div class="empty"><h3>Deine Übungssammlung</h3><p>Jede Übung legst du einmal an: Skizze, Ablauf, Spielerzahl und Material. Danach baust du Trainings mit ein paar Klicks.</p><button class="btn pri" data-act="newEx">Neue Übung</button></div>`}</div></div>`;
}
function exEditor(id){
  const e=S.uebungen[id];e.material=e.material||{};e.tags=e.tags||[];
  const bm=boardMaterial(e.board);const hasBm=Object.keys(bm).length;
  return `<div class="ed-top"><button class="btn ghost back" data-act="back">← ${S.ui.backTo?"Zurück zum Training":"Übungen"}</button>${S.ui.backTo?'<button class="btn ghost" data-act="backTraining" style="margin-left:auto">Zurück zum Training</button>':""}</div>
  <div class="ed-top"><input class="title-in" data-key="e-name" data-bind="name" value="${esc(e.name||"")}" placeholder="Name der Übung"></div>
  <div class="meta"><label class="f">Kategorie<select data-key="e-kat" data-bind="kategorie" data-rr>${opt([["","–"],...katList().map(k=>[k,k]),...(e.kategorie&&!katList().includes(e.kategorie)?[[e.kategorie,e.kategorie]]:[])],e.kategorie||"")}</select></label>
   <label class="f">Dauer (min)<input type="number" min="0" data-key="e-dauer" data-bind="dauer" data-rr value="${esc(e.dauer??"")}"></label>
   <label class="f">Feldspielerinnen min.<input type="number" min="0" data-key="e-min" data-bind="minSp" data-rr value="${esc(e.minSp??"")}"></label>
   <label class="f">Feldspielerinnen max.<input type="number" min="0" data-key="e-max" data-bind="maxSp" data-rr value="${esc(e.maxSp??"")}" placeholder="beliebig"></label>
   <label class="f">Torhüterinnen<input type="number" min="0" data-key="e-tw" data-bind="tw" data-rr value="${esc(e.tw??"")}"></label>
   <label class="f">Teams<input type="number" min="0" data-key="e-teams" data-bind="teams" data-rr value="${esc(e.teams??"")}" placeholder="keine"></label></div>
  <section class="blk"><h3>Trainiert</h3><p class="hint">Diese Themen verbinden die Übung mit den Kritikpunkten aus deinen Spielberichten.</p><div class="chips">${tagChips(e.tags,"exTagToggle")}</div></section>
  <section class="blk"><h3>Skizze</h3><div data-board="uebung:${id}:board"></div></section>
  <section class="blk"><h3>Ablauf und Coaching</h3><div class="two" style="grid-template-columns:1fr">
   <label class="f">Ziel<textarea data-key="e-ziel" data-bind="ziel" rows="2">${esc(e.ziel||"")}</textarea></label>
   <label class="f">Organisation<textarea data-key="e-org" data-bind="organisation" rows="3">${esc(e.organisation||"")}</textarea></label>
   <label class="f">Coaching<textarea data-key="e-coach" data-bind="coaching" rows="3">${esc(e.coaching||"")}</textarea></label></div></section>
  <section class="blk"><h3>Material <span class="sub">gleichzeitig benötigt</span></h3><p class="hint">Trag ein, was während dieser Übung gleichzeitig im Einsatz ist, z. B. 2 Leibchen-Sätze für 2 Teams. Im Training zählt nicht die Summe aller Übungen, sondern der höchste gleichzeitige Bedarf – laufen Übungen parallel, werden sie zusammengezählt.</p>${hasBm?`<p class="hint">In der Skizze: ${Object.entries(bm).map(([k,n])=>`${matLabel(k)} ${n}`).join(", ")}. <button class="btn sm" data-act="matFromBoard">Übernehmen</button></p>`:""}
   <div class="matgrid">${matList().map(([k,l])=>`<label class="f">${esc(l)}<input type="number" min="0" data-key="m-${k}" data-mat="${k}" value="${esc(e.material[k]||"")}"></label>`).join("")}</div></section>
  <div class="row-actions">${S.ui.backTo?'<button class="btn pri" data-act="backTraining">Zurück zum Training</button>':""}<button class="btn" data-act="dupEx">Kopieren</button><button class="btn" data-act="shareEx">An Trainer teilen</button><button class="btn ghost danger" data-act="delEx">Übung löschen</button></div>`;
}

