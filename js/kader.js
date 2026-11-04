"use strict";
/* Kader: Spielerinnen mit TW-Markierung, Position und dauerhafter Einschränkung */
const einschrTxt=e=>e?`${e.grund||"eingeschränkt"}${e.notiz?` – ${e.notiz}`:""}${e.seit?` · seit ${fmtDate(e.seit).replace(/^\w+, /,"")}`:""}`:"";
function vKader(){
  const q=(S.ui.kq||"").toLowerCase();
  const all=players().slice().sort((a,b)=>(b.tw-a.tw)||a.name.localeCompare(b.name));
  const ps=all.filter(p=>!q||p.name.toLowerCase().includes(q)||(p.position||"").toLowerCase().includes(q)||(p.einschr&&einschrTxt(p.einschr).toLowerCase().includes(q)));
  const pos=S.settings.positionen||[];const nE=all.filter(p=>p.einschr).length;
  return `<div class="narrow"><h2 class="page-h">Kader</h2>
  <input class="search" data-key="kq" data-act="kQ" type="search" placeholder="Spielerin, Position oder Grund suchen" value="${esc(S.ui.kq||"")}">
  <section class="blk"><h3>Spielerinnen <span class="sub">${all.length} im Kader, ${all.filter(p=>p.tw).length} TW${nE?`, ${nE} eingeschränkt`:""}${q?` · ${ps.length} gefunden`:""}</span></h3>
   <div class="prows">${ps.map(p=>`<div class="prow${p.einschr?" lim":""}">
     <button type="button" class="chip tag twbtn" data-act="pTw" data-id="${p.id}" aria-pressed="${!!p.tw}" title="Torhüterin">TW</button>
     <div class="pname"><b>${esc(p.name)}</b>${p.einschr?`<span class="limtxt">${esc(einschrTxt(p.einschr))}</span>`:""}</div>
     <select class="inp" data-key="pos-${p.id}" data-act="pPos" data-id="${p.id}" aria-label="Position von ${esc(p.name)}">${opt([["","Position –"],...pos.map(x=>[x,x])],p.position||"")}</select>
     <button type="button" class="btn sm${p.einschr?" pri":""}" data-act="pLim" data-id="${p.id}">${p.einschr?"Eingeschränkt":"Belastbar"}</button>
     <button type="button" class="iconbtn" data-act="pDel" data-id="${p.id}" aria-label="${esc(p.name)} entfernen">✕</button></div>`).join("")||'<p class="hint">Keine Spielerin gefunden.</p>'}</div>
   <div class="addpt" style="margin-top:14px"><input class="inp" data-key="pnew" data-act="pNew" placeholder="Name, Enter fügt hinzu (mehrere mit Komma)"><button class="btn" data-act="pAdd">Hinzufügen</button></div>
   <p class="legend">„TW“ markiert eine Torhüterin. „Belastbar/Eingeschränkt“ gilt dauerhaft, bis du es wieder änderst – auch in jedem neuen Training.</p></section></div>`;
}

/* Fenster „Einschränkung“ – aus dem Kader oder direkt aus einem Training (tid) geöffnet. */
function openEinschr(pid,tid){
  const p=pById(pid);if(!p)return;const e=p.einschr||{};const gr=S.settings.gruende||[];
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="Einschränkung"><h3>${esc(p.name)} <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
    <p class="hint">Eingeschränkt bleibt sie, bis du es hier wieder aufhebst – auch in allen neuen Trainings. Sie kann trotzdem anwesend sein (z. B. nur Lauftraining).</p>
    <div class="meta"><label class="f">Grund<select id="eGrund">${opt(gr.map(x=>[x,x]),e.grund||gr[0]||"")}</select></label>
      <label class="f">Seit<input type="date" id="eSeit" value="${esc(e.seit||today())}"></label></div>
    <label class="f" style="margin-top:10px">Notiz (optional)<input class="inp" id="eNotiz" value="${esc(e.notiz||"")}" placeholder="z. B. nur Lauftraining, kein Kopfball"></label>
    <div class="row-actions"><button class="btn pri" data-act="eSave" data-id="${pid}" data-t="${tid||""}">${p.einschr?"Speichern":"Als eingeschränkt markieren"}</button>
      ${p.einschr?`<button class="btn" data-act="eClear" data-id="${pid}" data-t="${tid||""}">Wieder voll belastbar</button>`:""}</div></div></div>`;
}
/* Gilt ab heute: Trainings ab heute (und das gerade offene) bekommen den Stand mit, vergangene bleiben, wie sie waren. */
function setEinschr(pid,val,tid){
  const p=pById(pid);if(!p)return;if(val)p.einschr=val;else delete p.einschr;saveLater("kader");
  const heute=today();
  Object.entries(S.trainings).forEach(([id,t])=>{if(id!==tid&&(t.datum||"")<heute)return;t.einschr=t.einschr||{};
    if(val)t.einschr[pid]={grund:val.grund,notiz:val.notiz||""};else delete t.einschr[pid];saveLater("training",id);});
}
$("#overlay").addEventListener("click",e=>{
  const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  if(a==="eSave"){setEinschr(el.dataset.id,{grund:$("#eGrund").value,notiz:$("#eNotiz").value.trim(),seit:$("#eSeit").value||today()},el.dataset.t);$("#overlay").innerHTML="";render();toast("Gespeichert");}
  if(a==="eClear"){setEinschr(el.dataset.id,null,el.dataset.t);$("#overlay").innerHTML="";render();toast("Wieder voll belastbar");}
});
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;
  if(el.dataset.act==="pLim")openEinschr(el.dataset.id,null);});
$("#app").addEventListener("change",e=>{const el=e.target;if(el.dataset.act==="pPos"){const p=pById(el.dataset.id);if(p){p.position=el.value;saveLater("kader");}}});
$("#app").addEventListener("input",e=>{const el=e.target;if(el.dataset.act==="kQ"){S.ui.kq=el.value;render();}});
