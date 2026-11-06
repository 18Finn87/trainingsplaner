"use strict";
/* Kader: Spielerinnen mit Rückennummer, TW-Markierung, Haupt- und weiteren Positionen, Notiz und dauerhafter Einschränkung.
   player.position = Hauptposition, player.positionen = weitere bevorzugte Positionen. */
const einschrTxt=e=>e?`${e.grund||"eingeschränkt"}${e.notiz?` – ${e.notiz}`:""}${e.seit?` · seit ${fmtDate(e.seit).replace(/^\w+, /,"")}`:""}`:"";
const nrSort=(a,b)=>(b.tw-a.tw)||((num(a.nummer)||999)-(num(b.nummer)||999))||a.name.localeCompare(b.name);
function vKader(){
  if(S.sel.spielerin&&pById(S.sel.spielerin))return spielerinView(pById(S.sel.spielerin));
  const q=(S.ui.kq||"").toLowerCase();
  const all=players().slice().sort(nrSort);
  const txt=p=>[p.name,p.nummer,p.position,...(p.positionen||[]),p.notiz,p.einschr&&einschrTxt(p.einschr)].join(" ").toLowerCase();
  const ps=all.filter(p=>!q||txt(p).includes(q));const nE=all.filter(p=>p.einschr).length;
  return `<div class="narrow"><h2 class="page-h">Kader</h2>
  <input class="search" data-key="kq" data-act="kQ" type="search" placeholder="Name, Nummer, Position, Notiz oder Grund suchen" value="${esc(S.ui.kq||"")}">
  <section class="blk"><h3>Spielerinnen <span class="sub">${all.length} im Kader, ${all.filter(p=>p.tw).length} TW${nE?`, ${nE} eingeschränkt`:""}${q?` · ${ps.length} gefunden`:""}</span></h3>
   <div class="prows">${ps.map(p=>`<div class="prow k2${p.einschr?" lim":""}">
     <span class="nr">${esc(p.nummer||"")}</span>
     <button type="button" class="pname plink" data-act="pOpen" data-id="${p.id}"><b>${esc(p.name)}${p.tw?' <span class="twm">TW</span>':""}</b><span class="ppos">${esc([p.position,...(p.positionen||[])].filter(Boolean).join(" · ")||"Position offen")}</span>${p.einschr?`<span class="limtxt">${esc(einschrTxt(p.einschr))}</span>`:""}</button>
     <button type="button" class="btn sm${p.einschr?" pri":""}" data-act="pLim" data-id="${p.id}">${p.einschr?"Eingeschränkt":"Belastbar"}</button></div>`).join("")||'<p class="hint">Keine Spielerin gefunden.</p>'}</div>
   <div class="addpt" style="margin-top:14px"><input class="inp" data-key="pnew" data-act="pNew" placeholder="Name, Enter fügt hinzu (mehrere mit Komma)"><button class="btn" data-act="pAdd">Hinzufügen</button></div>
   <p class="legend">Name antippen öffnet die Spielerin: Nummer, Positionen, Notiz, Trainings- und Spielhistorie. „Belastbar/Eingeschränkt“ gilt dauerhaft, bis du es wieder änderst.</p></section></div>`;
}
/* Spielerinnen-Ansicht: Stammdaten bearbeiten, Trainings- und Spielhistorie der gewählten Mannschaft. */
function spielerinView(p){
  const pos=S.settings.positionen||[];const weitere=p.positionen||[];
  const trs=ofTeam("trainings").filter(([,t])=>t.durchgefuehrt&&t.datum).sort((a,b)=>b[1].datum.localeCompare(a[1].datum));
  const da=trs.filter(([,t])=>t.anwesenheit[p.id]==="ja").length;const minAll=trs.reduce((a,[,t])=>a+total(playerParts(t,p.id,"ist")),0);
  const spiele=ofTeam("spiele").filter(([,s])=>(s.kader||[]).includes(p.id)).sort((a,b)=>(b[1].datum||"").localeCompare(a[1].datum||""));
  const erfassteSpiele=ofTeam("spiele").filter(([,s])=>Array.isArray(s.kader)&&s.kader.length).length;
  const statusTxt=t=>{const s=t.anwesenheit[p.id];const g=t.gruende&&t.gruende[p.id];const lim=t.einschr&&t.einschr[p.id];const ri=rausIdx(t,p.id);
    return [s==="ja"?"dabei":s==="nein"?`abwesend${g&&g.grund?" – "+g.grund:""}`:"nicht erfasst",lim?`eingeschränkt (${lim.grund})`:"",ri>=0?`raus ab ${exName(stepEx(t.ablauf[ri]))}`:""].filter(Boolean).join(" · ");};
  const tab=S.ui.pTab||"stamm";const e=ent(p);const offen=e.ziele.filter(x=>!x.erreicht).length;
  const kopf=`<div class="narrow"><div class="ed-top"><button class="btn ghost" data-act="pBack">← Kader</button></div>
  <div class="ed-top"><input class="title-in" data-key="p-name" data-act="pF" data-f="name" data-id="${p.id}" value="${esc(p.name)}" aria-label="Name"></div>
  ${seg("pTab",tab,[["stamm","Stammdaten"],["entw",`Entwicklung${offen?` <span class="bd">${offen}</span>`:""}`],["hist","Historie"],...(SB.cfgOk()?[["frei","Freigaben"]]:[])]," ptabs")}`;
  if(tab==="entw")return kopf+entwicklungTab(p)+"</div>";
  if(tab==="frei")return kopf+fgSpielerinTab(p)+"</div>";
  if(tab==="hist")return kopf+histHtml()+"</div>";
  function histHtml(){return `<section class="blk"><h3>Trainingshistorie <span class="sub">${da} von ${trs.length} durchgeführten Trainings · ${fmtMin(minAll)}</span></h3>
   ${trs.length?`<ul class="hist">${trs.map(([id,t])=>`<li><button type="button" class="plink" data-act="pTr" data-id="${id}"><b>${esc(fmtDate(t.datum))}</b>${t.thema?` <span class="src">${esc(t.thema)}</span>`:""}</button><span class="${t.anwesenheit[p.id]==="ja"?"ok":"src"}">${esc(statusTxt(t))}</span><em>${t.anwesenheit[p.id]==="ja"?fmtMin(total(playerParts(t,p.id,"ist"))):""}</em></li>`).join("")}</ul>`:'<p class="hint">Noch keine durchgeführten Trainings.</p>'}</section>
  <section class="blk"><h3>Spielhistorie <span class="sub">${spiele.length} Spiel${spiele.length===1?"":"e"} im Kader${erfassteSpiele?` von ${erfassteSpiele} erfassten`:""}</span></h3>
   ${spiele.length?`<ul class="hist">${spiele.map(([id,s])=>`<li><button type="button" class="plink" data-act="pSp" data-id="${id}"><b>${esc(fmtDate(s.datum))}</b> <span class="src">${esc(s.gegner||"Gegner offen")}</span></button><span>${esc(s.ergebnis||"")}</span><em>${esc(s.wettbewerb||"")}</em></li>`).join("")}</ul>`:'<p class="hint">Noch in keinem Spielkader. Den Spielkader wählst du im Spielbericht aus.</p>'}</section>`;}
  return kopf+`<div class="meta"><label class="f">Rückennummer<input data-key="p-nr" data-act="pF" data-f="nummer" data-id="${p.id}" value="${esc(p.nummer||"")}" inputmode="numeric" maxlength="3"></label>
   <label class="f">Hauptposition<select data-key="p-pos" data-act="pF" data-f="position" data-id="${p.id}">${opt([["","–"],...pos.map(x=>[x,x]),...(p.position&&!pos.includes(p.position)?[[p.position,p.position]]:[])],p.position||"")}</select></label>
   <label class="f">Torhüterin<button type="button" class="chip tag twbtn" style="align-self:flex-start;min-height:40px" data-act="pTw" data-id="${p.id}" aria-pressed="${!!p.tw}">${p.tw?"Ja – TW":"Nein"}</button></label></div>
  <section class="blk"><h3>Weitere bevorzugte Positionen</h3><div class="chips">${pos.filter(x=>x!==p.position).map(x=>`<button type="button" class="chip tag" data-act="pPosT" data-id="${p.id}" data-v="${esc(x)}" aria-pressed="${weitere.includes(x)}">${esc(x)}</button>`).join("")||'<p class="hint">Positionen pflegst du in den Einstellungen.</p>'}</div></section>
  <section class="blk"><h3>Notiz</h3><textarea class="inp" style="width:100%" rows="3" data-key="p-notiz" data-act="pF" data-f="notiz" data-id="${p.id}" placeholder="z. B. starker linker Fuß, spielt lieber halbrechts">${esc(p.notiz||"")}</textarea></section>
  <section class="blk"><h3>Belastung</h3><p class="hint" style="margin:0 0 10px">${p.einschr?esc(einschrTxt(p.einschr)):"Voll belastbar"}</p><button class="btn sm${p.einschr?" pri":""}" data-act="pLim" data-id="${p.id}">${p.einschr?"Einschränkung ändern":"Als eingeschränkt markieren"}</button></section>
  <div class="row-actions"><button class="btn ghost danger" data-act="pDel" data-id="${p.id}">Aus dem Kader entfernen</button></div></div>`;
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
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act,p=pById(el.dataset.id);
  if(a==="pLim")openEinschr(el.dataset.id,null);
  if(a==="pOpen"){S.sel.spielerin=el.dataset.id;S.ui.pTab="stamm";render();window.scrollTo(0,0);}
  if(a==="pBack"){S.sel.spielerin=null;render();}
  if(a==="pPosT"&&p){const v=el.dataset.v;p.positionen=(p.positionen||[]).includes(v)?p.positionen.filter(x=>x!==v):[...(p.positionen||[]),v];saveLater("kader");render();}
  if(a==="pTr"){S.view="training";S.sel.training=el.dataset.id;render();window.scrollTo(0,0);}
  if(a==="pSp"){S.view="spiele";S.sel.spiel=el.dataset.id;render();window.scrollTo(0,0);}
});
/* Stammdaten: Name nie leer; Hauptposition nicht zusätzlich unter „weitere“. */
$("#app").addEventListener("change",e=>{const el=e.target;if(el.dataset.act!=="pF")return;const p=pById(el.dataset.id);if(!p)return;const f=el.dataset.f,v=el.value.trim();
  if(f==="name"&&!v){el.value=p.name;return;}p[f]=v;if(f==="position")p.positionen=(p.positionen||[]).filter(x=>x!==v);saveLater("kader");render();});
$("#app").addEventListener("input",e=>{const el=e.target;if(el.dataset.act==="kQ"){S.ui.kq=el.value;render();}});
