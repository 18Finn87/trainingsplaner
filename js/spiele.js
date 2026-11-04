"use strict";
$("#app").addEventListener("input",e=>{if(e.target.dataset.act==="sQ"){S.ui.sq=e.target.value;render();}});
/* Spiele */
function vSpiele(){
  const cur=S.sel.spiel&&S.spiele[S.sel.spiel]?S.sel.spiel:null;
  const q=(S.ui.sq||"").toLowerCase().trim();
  const txt=s=>[s.gegner,s.datum,fmtDate(s.datum),s.ergebnis,s.wettbewerb,s.fazit,...(s.punkte||[]).map(p=>p.text+" "+(p.tag||""))].join(" ").toLowerCase();
  const all=sortedSpiele();const found=all.filter(([,s])=>!q||q.split(/\s+/).every(w=>txt(s).includes(w)));
  const li=found.map(([id,s])=>`<button class="li" data-act="selSpiel" data-id="${id}" aria-current="${id===cur}"><b>${esc(s.gegner||"Gegner offen")}${s.ergebnis?" · "+esc(s.ergebnis):""}</b><span>${esc(fmtDate(s.datum))}${s.wettbewerb?" · "+esc(s.wettbewerb):""}</span></button>`).join("");
  return `<div class="split${cur?" has-sel":""}"><aside class="list"><h2>Spiele</h2><button class="btn pri new" data-act="newSpiel">Neuer Spielbericht</button>
    <input class="search" type="search" data-key="sq" data-act="sQ" placeholder="Suchen: Gegner, Datum, Beobachtung …" value="${esc(S.ui.sq||"")}">
    ${q?`<p class="legend">${found.length} von ${all.length} Spielen</p>`:""}${li||`<p class="hint">${all.length?"Kein Spiel passt zur Suche.":"Noch keine Spielberichte."}</p>`}</aside>
  <div class="editor">${cur?spielEditor(cur):`<div class="empty"><h3>Halte fest, was im Spiel auffällt</h3><p>Notiere Beobachtungen pro Halbzeit und markiere, was du trainieren willst. Im nächsten Training siehst du, welche Punkte schon eine Übung haben.</p><button class="btn pri" data-act="newSpiel">Neuer Spielbericht</button></div>`}</div></div>`;
}
function spielEditor(id){
  const s=S.spiele[id];s.punkte=s.punkte||[];
  const ptRows=hz=>s.punkte.map((p,i)=>({p,i})).filter(x=>(x.p.hz||1)===hz).map(({p,i})=>`<div class="pt"><button class="art" data-act="ptArt" data-i="${i}" data-a="${p.art||"info"}" aria-label="${ARTN[p.art||"info"]} – tippen zum Wechseln">${ARTL[p.art||"info"]}</button>
    <textarea class="txt" rows="1" data-key="pt-${p.id}" data-act="ptText" data-i="${i}">${esc(p.text)}</textarea>
    <div class="ptctl"><select class="inp" data-key="ptt-${p.id}" data-act="ptTag" data-i="${i}" aria-label="Thema">${opt([["","kein Thema"],...S.settings.tags.map(x=>[x,x])],p.tag||"")}</select>
    <button class="star" data-act="ptStar" data-i="${i}" aria-pressed="${!!p.trainieren}">Trainieren</button></div>
    <button class="iconbtn" data-act="ptDel" data-i="${i}" aria-label="Punkt löschen">✕</button></div>`).join("");
  const half=hz=>`<section class="blk"><h3>${hz}. Halbzeit</h3>${ptRows(hz)||'<p class="hint">Noch keine Beobachtungen.</p>'}
    <div class="addpt"><input class="inp" data-key="new-${hz}" data-act="ptNew" data-hz="${hz}" placeholder="Beobachtung eintippen, Enter fügt hinzu"><button class="btn" data-act="ptAdd" data-hz="${hz}">Hinzufügen</button></div>
    <details data-dkey="${id}-${hz}" style="margin-top:14px"${S.ui.open["d"+id+hz]??(s["board"+hz]&&(s["board"+hz].items||[]).length)?" open":""}><summary style="cursor:pointer;font-weight:600">Aufstellung / Skizze</summary><div style="margin-top:10px" data-board="spiel:${id}:board${hz}"></div></details></section>`;
  const nTr=s.punkte.filter(p=>p.trainieren).length;
  return `<div class="ed-top"><button class="btn ghost back" data-act="back">← Spiele</button></div>
  <div class="ed-top"><input class="title-in" data-key="s-gegner" data-bind="gegner" value="${esc(s.gegner||"")}" placeholder="Gegner"></div>
  <div class="meta"><label class="f">Datum<input type="date" data-key="s-datum" data-bind="datum" value="${esc(s.datum||"")}"></label>
   <label class="f">Ergebnis<input data-key="s-erg" data-bind="ergebnis" value="${esc(s.ergebnis||"")}" placeholder="z. B. 2:1"></label>
   <label class="f">Wettbewerb<input data-key="s-wb" data-bind="wettbewerb" value="${esc(s.wettbewerb||"")}" placeholder="Liga, Pokal …"></label></div>
  ${spielKader(id,s)}
  <p class="hint">Kreis antippen wechselt zwischen negativ (−), positiv (+) und Hinweis (•). „Trainieren“ schickt den Punkt in die Trainingsplanung.</p>
  ${half(1)}${half(2)}
  <section class="blk"><h3>Gesamteindruck</h3><textarea class="inp" style="width:100%" rows="3" data-key="s-fazit" data-bind="fazit">${esc(s.fazit||"")}</textarea></section>
  <div class="row-actions"><button class="btn pri" data-act="trainingFromSpiel">Training daraus planen${nTr?` (${nTr} Punkte)`:""}</button><button class="btn ghost danger" data-act="delSpiel">Spielbericht löschen</button></div>`;
}

/* Spielkader: wer war beim Spiel dabei (s.kader = Liste von Spielerinnen-Kennungen). */
function spielKader(id,s){
  const ps=players().slice().sort(nrSort);const k=s.kader||[];const open=S.ui.open["dsk"+id]??!k.length;
  return `<section class="blk"><h3>Kader für dieses Spiel <span class="sub">${k.length?`${k.length} Spielerinnen`:"noch nicht erfasst"}</span></h3>
    <details class="fold" data-dkey="sk-${id}"${open?" open":""}><summary>${k.length?"Spielkader bearbeiten":"Spielkader auswählen"}</summary>
    <div class="chips achips">${ps.map(p=>`<button type="button" class="chip tag skc" data-act="skT" data-id="${p.id}" aria-pressed="${k.includes(p.id)}">${p.nummer?`<span class="nr">${esc(p.nummer)}</span>`:""}${esc(p.name)}${p.tw?' <span class="twm">TW</span>':""}</button>`).join("")}</div>
    <div class="row-actions"><button class="btn sm" data-act="skLast">Anwesende vom letzten Training davor</button>${k.length?'<button class="btn sm ghost" data-act="skNone">Alle abwählen</button>':""}</div></details></section>`;
}
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;const s=S.spiele[S.sel.spiel];if(!s||S.view!=="spiele")return;
  const save=()=>{saveLater("spiel",S.sel.spiel);render();};
  if(a==="skT"){const pid=el.dataset.id;s.kader=(s.kader||[]).includes(pid)?s.kader.filter(x=>x!==pid):[...(s.kader||[]),pid];save();}
  if(a==="skNone"){s.kader=[];save();}
  if(a==="skLast"){const vor=sortedTrainings().map(([,t])=>t).filter(t=>t.datum&&(!s.datum||t.datum<=s.datum)&&Object.values(t.anwesenheit||{}).includes("ja"))[0];
    if(!vor){toast("Kein Training mit erfasster Anwesenheit vor diesem Spiel.");return;}
    s.kader=players().filter(p=>vor.anwesenheit[p.id]==="ja").map(p=>p.id);save();toast(`${s.kader.length} Spielerinnen vom ${fmtDate(vor.datum)} übernommen`);}
});
