"use strict";
/* Training */
/* Suche: Thema, Datum, Notizen, Übungsnamen und Gegner; dazu Zeitraum und Trainingsinhalt. */
function trainingText(t){const sp=t.spielId&&S.spiele[t.spielId];
  return [fmtDate(t.datum),t.datum,t.thema,t.notizen,sp&&sp.gegner,...stepsOf(t).map(st=>st.ex?[st.ex.name,st.ex.kategorie].join(" "):""),...(t.ablauf||[]).map(s=>s.notiz)].join(" ").toLowerCase();}
const trainingTags=t=>new Set(stepsOf(t).flatMap(st=>st.ex?st.ex.tags||[]:[]));
function vTraining(){
  const all=sortedTrainings();const cur=S.sel.training&&S.trainings[S.sel.training]?S.sel.training:null;
  const q=(S.ui.tq||"").toLowerCase().trim(),von=S.ui.tvon||"",bis=S.ui.tbis||"",tag=S.ui.ttag||"";
  const list=all.filter(([,t])=>(!q||q.split(/\s+/).every(w=>trainingText(t).includes(w)))&&(!von||(t.datum||"")>=von)&&(!bis||(t.datum||"")<=bis)&&(!tag||trainingTags(t).has(tag)));
  const filt=q||von||bis||tag;
  const li=list.map(([id,t])=>{const s=attSummary(t);return `<button class="li" data-act="selTraining" data-id="${id}" aria-current="${id===cur}"><b>${esc(fmtDate(t.datum))}</b><span>${esc(t.thema||"ohne Thema")} · ${s.ja} da${s.offen&&s.offen<players().length?` · ${s.offen} offen`:""}</span></button>`;}).join("");
  return `<div class="split${cur?" has-sel":""}"><aside class="list"><h2>Trainings</h2><button class="btn pri new" data-act="newTraining">Neues Training</button>
   <input class="search" type="search" data-key="tq" data-act="tQ" placeholder="Suchen: Thema, Datum, Übung …" value="${esc(S.ui.tq||"")}">
   <details class="fold filt" data-dkey="tr-filter"${S.ui.open.dtrfilter||von||bis||tag?" open":""}><summary>Filter${von||bis||tag?" (aktiv)":""}</summary>
    <div class="meta" style="margin:0 0 8px"><label class="f">Von<input type="date" data-key="tvon" data-act="tFilt" data-f="tvon" value="${esc(von)}"></label><label class="f">Bis<input type="date" data-key="tbis" data-act="tFilt" data-f="tbis" value="${esc(bis)}"></label></div>
    <label class="f">Trainingsinhalt<select data-key="ttag" data-act="tFilt" data-f="ttag">${opt([["","alle Inhalte"],...S.settings.tags.map(x=>[x,x])],tag)}</select></label>
    ${filt?'<button class="btn sm ghost" data-act="tFiltReset" style="margin-top:8px">Filter zurücksetzen</button>':""}</details>
   ${filt?`<p class="legend">${list.length} von ${all.length} Trainings</p>`:""}
   ${li||`<p class="hint">${all.length?"Kein Training passt zur Suche.":"Noch keine Trainings."}</p>`}</aside>
  <div class="editor">${cur?trainingEditor(cur):`<div class="empty"><h3>Plane dein nächstes Training</h3><p>Lege ein Training an, hake ab, wer kommt, und stell die Übungen zusammen. Spielerzahl, Zeit und Material rechnet die App mit.</p><button class="btn pri" data-act="newTraining">Neues Training</button></div>`}</div></div>`;
}
function trainingEditor(id){
  const t=S.trainings[id];t.anwesenheit=t.anwesenheit||{};t.ablauf=t.ablauf||[];t.einschr=t.einschr||{};
  const hc=headcount(t);const att=t.anwesenheit;const sum=attSummary(t);
  const spOpts=[["","kein Spiel"],...sortedSpiele().map(([sid,s])=>[sid,`${fmtDate(s.datum)} – ${s.gegner||"Gegner offen"}`])];
  // attendance: ein Tipp = anwesend; „⋯“ für Abwesenheitsgrund und Einschränkung
  const ps=players();
  const chips=ps.map(p=>{const s=att[p.id]||"",lim=t.einschr[p.id],gr=t.gruende&&t.gruende[p.id];
    const info=[ATTL[s],lim?`eingeschränkt: ${lim.grund}`:"",s==="nein"&&gr?gr.grund:""].filter(Boolean).join(", ");
    return `<span class="achip" data-s="${s}"${lim?' data-lim="1"':""}><button type="button" class="amain" data-act="att" data-id="${p.id}" aria-label="${esc(p.name)}: ${esc(info)} – tippen: ${s==="ja"?"wieder offen":"anwesend"}">${p.tw?'<span class="tw">TW</span>':""}<span class="an">${esc(p.name)}</span>${lim?'<span class="limdot" title="eingeschränkt">!</span>':""}${s==="nein"&&gr?`<span class="agr">${esc(gr.grund)}</span>`:""}</button><button type="button" class="amore" data-act="attMore" data-id="${p.id}" aria-label="Details zu ${esc(p.name)}">⋯</button></span>`;}).join("");
  const noTw=ps.length&&!ps.some(p=>p.tw);
  // fokus
  const pts=openPoints(t);
  const fp=pts.map(p=>{const by=coveredBy(t,p.tag);return `<div class="fp${by.length?" cov":""}${p.erledigt?" done":""}"><span class="dot"></span><div><div>${esc(p.text)}</div><div class="by">${p.tag?esc(p.tag)+" · ":""}${by.length?"geübt in: "+esc(by.join(", ")):"noch keine Übung dazu"}</div></div>
    <div class="ctl">${!by.length&&p.tag?`<button class="btn sm" data-act="pickFor" data-v="${esc(p.tag)}">Übung suchen</button>`:""}<button class="btn sm ghost" data-act="ptDone" data-pid="${p.id}" title="Im Spiel abhaken">${p.erledigt?"Wieder öffnen":"Erledigt"}</button></div></div>`;}).join("");
  // steps: Einheiten = einzelne Übung oder paralleler Block
  const units=unitsOf(t);const total=units.reduce((a,u)=>a+u.dur,0);const len=num(t.dauerGesamt)||teamCfg().dauer;
  const col=st=>katCol(st.ex&&st.ex.kategorie);
  const bar=units.map(u=>`<i style="width:${(u.dur/Math.max(len,total))*100}%" title="${esc(u.steps.map(st=>exName(st.ex)).join(" / "))}">${u.steps.map(st=>`<b style="background:${col(st)}"></b>`).join("")}</i>`).join("");
  const nU=units.length;
  const moveCtl=ui=>`<button class="iconbtn" data-act="unitUp" data-u="${ui}" aria-label="Nach oben"${ui?"":" disabled"}>↑</button><button class="iconbtn" data-act="unitDown" data-u="${ui}" aria-label="Nach unten"${ui<nU-1?"":" disabled"}>↓</button>`;
  const parBtn=(st,ui)=>ui>0?`<button class="btn sm par" data-act="stepPar" data-i="${st.i}" title="Läuft gleichzeitig mit der Übung darüber; die Gruppen wechseln nach jeder Runde">∥ parallel zur vorherigen</button>`:"";
  const exBody=(st,w,ti,pfx)=>{const ex=st.ex;const open=S.ui.open[st.s.uid];
    return `<button class="name" data-act="stepOpen" data-u="${st.s.uid}" aria-expanded="${!!open}">${esc(exName(ex))}</button>
      <div class="tags"><span>${esc(ex.kategorie||"")}</span>${(ex.tags||[]).map(x=>`<span>#${esc(x)}</span>`).join("")}${ti.map(x=>`<span>${esc(x)}</span>`).join("")}</div>
      ${w.map(x=>`<div class="warn">${esc(x)}</div>`).join("")}
      <input class="inp" style="margin-top:6px;width:100%" data-key="sn-${st.s.uid}" data-act="stepNote" data-i="${st.i}" placeholder="Notiz für heute, z. B. Gruppen" value="${esc(st.s.notiz||"")}">
      ${open?`<div class="detail"><div>${ex.ziel?`<p><b>Ziel:</b> ${esc(ex.ziel)}</p>`:""}${ex.organisation?`<p><b>Organisation:</b> ${esc(ex.organisation)}</p>`:""}${ex.coaching?`<p><b>Coaching:</b> ${esc(ex.coaching)}</p>`:""}<button class="btn sm" data-act="editEx" data-id="${st.s.uebungId}">Übung bearbeiten</button></div><div>${(ex.board&&(ex.board.items||[]).length)?boardSVG(ex.board,pfx+st.i):""}</div></div>`:""}`;};
  const rows=units.map((u,ui)=>{
    if(!u.block){const st=u.steps[0],ex=st.ex,i=st.i;
      if(!ex)return `<div class="step"><div class="clock">${u.start}</div><div><b>Gelöschte Übung</b></div><div class="ctl"><button class="iconbtn" data-act="stepDel" data-i="${i}" aria-label="Entfernen">✕</button></div></div>`;
      const ti=teamInfo(ex,hc);
      return `<div class="step"><div class="clock">${u.start}</div><div>${exBody(st,exCheck(ex,hc),ti?[ti]:[],"d")}${parBtn(st,ui)?`<div class="row-actions" style="margin-top:8px">${parBtn(st,ui)}</div>`:""}
      </div><div class="ctl"><input class="inp" type="number" min="0" data-key="sd-${st.s.uid}" data-act="stepDur" data-i="${i}" value="${u.dur}" aria-label="Minuten"><span class="hint" style="margin:0">min</span>
        ${moveCtl(ui)}<button class="iconbtn" data-act="stepDel" data-i="${i}" aria-label="Entfernen">✕</button></div></div>`;}
    // paralleler Block
    const c=blockCfg(t,u),G=unitGroups(t,u,hc),info=stationInfo(t,u,hc),man=groupsManual(t,u),R=unitRounds(t,u),n=u.steps.length;
    const sumW=groupSumWarn(t,u,hc);
    const grp=man?`<div class="pb-groups">${G.map((g,gi)=>`<span class="pb-g"><b>Gruppe ${GRUPPE[gi]}</b>
        <label>Feld <input class="inp" type="number" min="0" data-key="bg-${u.block}-${gi}-f" data-act="blkGrp" data-b="${u.block}" data-g="${gi}" data-f="f" value="${g.F}"></label>
        <label>TW <input class="inp" type="number" min="0" data-key="bg-${u.block}-${gi}-t" data-act="blkGrp" data-b="${u.block}" data-g="${gi}" data-f="t" value="${g.T}"></label></span>`).join("")}
        <button class="btn sm ghost" data-act="blkAuto" data-b="${u.block}">Gleichmäßig verteilen</button></div>`
      :`<div class="pb-groups"><span>${G.map((g,gi)=>`Gruppe ${GRUPPE[gi]}: ${grpTxt(g)}`).join(" · ")}</span><button class="btn sm ghost" data-act="blkManual" data-b="${u.block}">Von Hand festlegen</button></div>`;
    return `<div class="pblock"><div class="step pb-head"><div class="clock">${u.start}</div><div>
        <b class="pb-title">Parallel · ${n} Stationen</b><div class="hint" style="margin:2px 0 8px">${R} Runde${R>1?"n":""} à ${unitRound(t,u)} min, bis ${addMin(u.start,u.dur)} · ${R>1?"die Gruppen wechseln nach jeder Runde":"jede Gruppe bleibt an ihrer Station"}</div>
        <div class="pb-set"><label class="f">Runde (min)<input type="number" min="1" data-key="br-${u.block}" data-act="blkRound" data-b="${u.block}" value="${unitRound(t,u)}"></label>
          <label class="f">Runden<input type="number" min="1" data-key="bn-${u.block}" data-act="blkRounds" data-b="${u.block}" value="${R}"></label></div>
        ${grp}${sumW?`<div class="warn">${esc(sumW)}</div>`:""}
      </div><div class="ctl">${moveCtl(ui)}</div></div>
      <div class="stations" style="--n:${n}">${u.steps.map((st,s)=>`<div class="station"><div class="st-lab">Station ${s+1}<span>Gruppe${info[s].gruppen.length>1?"n":""} ${info[s].gruppen.join(", ")}</span></div>
        ${st.ex?exBody(st,info[s].warns,info[s].teams,"p"):"<b>Gelöschte Übung</b>"}
        <div class="row-actions" style="margin-top:8px"><button class="btn sm" data-act="stepSolo" data-i="${st.i}">Lösen</button><button class="iconbtn" data-act="stepDel" data-i="${st.i}" aria-label="Entfernen">✕</button></div></div>`).join("")}</div></div>`;}).join("");
  // material
  const need=materialNeed(t);const inv=S.settings.inventar||{};
  const mrows=matList().filter(([k])=>need[k]).map(([k,l])=>{const have=inv[k];const short=have!=null&&have!==""&&num(have)<need[k].n;
    return `<tr class="${short?"short":""}"><td>${esc(l)}<div class="src">am meisten bei: ${esc(need[k].ex)}</div></td><td class="n">${need[k].n}</td><td class="n">${have==null||have===""?"–":num(have)}</td><td>${short?`<b class="over">${need[k].n-num(have)} fehlen</b>`:have==null||have===""?'<span class="src">Bestand nicht erfasst</span>':"✓"}</td></tr>`;}).join("");
  return `<div class="ed-top"><button class="btn ghost back" data-act="back">← Trainings</button></div>
  <div class="ed-top"><input class="title-in" data-key="t-thema" data-bind="thema" value="${esc(t.thema||"")}" placeholder="Thema des Trainings"></div>
  <div class="meta"><label class="f">Datum<input type="date" data-key="t-datum" data-bind="datum" data-rr value="${esc(t.datum||"")}"></label>
   <label class="f">Beginn<input type="time" data-key="t-start" data-bind="start" data-rr value="${esc(t.start||teamCfg().start)}"></label>
   <label class="f">Dauer (min)<input type="number" min="0" data-key="t-dauer" data-bind="dauerGesamt" data-rr value="${esc(t.dauerGesamt||teamCfg().dauer)}"></label>
   <label class="f">Spiel als Grundlage<select data-key="t-spiel" data-bind="spielId" data-rr>${opt(spOpts,t.spielId||"")}</select></label></div>

  <section class="blk"><h3>Anwesenheit</h3>
   <div class="asum"><span data-s="ja"><b>${sum.ja}</b> anwesend</span><span data-s="nein"><b>${sum.nein}</b> abwesend</span><span data-s="lim"><b>${sum.lim}</b> eingeschränkt${sum.limDa?` <small>(${sum.limDa} davon da)</small>`:""}</span><span data-s=""><b>${sum.offen}</b> offen</span></div>
   <p class="legend" style="margin:6px 0 14px">Im Training: <b>${hc.F}</b> Feldspielerinnen + <b>${hc.T}</b> TW</p>
   ${ps.length?`<div class="chips achips">${chips}</div><p class="legend">Name antippen = anwesend (nochmal = wieder offen). „⋯“ für abwesend mit Grund oder eine Einschränkung.</p>
   <div class="row-actions" style="margin-top:8px"><button class="btn sm pri" data-act="attRest"${sum.offen?"":" disabled"}>Alle übrigen auf abwesend</button><button class="btn sm ghost" data-act="attReset">Alle auf offen</button></div>
   ${noTw?'<div class="warn">Im Kader ist noch keine Torhüterin markiert, deshalb zählt die App 0 TW. Markiere sie unter „Kader &amp; Material“.</div>':""}`
   :'<p class="hint">Dein Kader ist leer. Trage die Spielerinnen unter „Kader &amp; Material“ ein.</p>'}
  </section>

  ${t.spielId?`<section class="blk"><h3>Aus dem Spiel mitnehmen <span class="sub">${esc(S.spiele[t.spielId]?.gegner||"")}</span></h3>
   ${pts.length?`<p class="hint">Orange: noch keine Übung im Plan, die dieses Thema trainiert. Grün: abgedeckt.</p>${fp}`:'<p class="hint">Im Spielbericht ist noch kein Punkt mit „Trainieren“ markiert.</p>'}</section>`:""}

  <section class="blk"><h3>Ablauf <span class="sub">${total} von ${len} min${total>len?` · <span class="over">${total-len} min zu lang</span>`:""}</span></h3>
   ${units.length?`<div class="tl">${bar}</div><div class="tl-legend"><span>${esc(t.start||teamCfg().start)}</span><span>Ende ${addMin(t.start||teamCfg().start,total)}</span></div>`:""}
   ${rows||'<p class="hint">Noch keine Übungen. Füge die erste aus deiner Sammlung hinzu.</p>'}
   <div class="row-actions"><button class="btn pri" data-act="pick">Übung hinzufügen</button></div></section>

  <section class="blk"><h3>Material</h3>${mrows?`<p class="hint">Höchster gleichzeitiger Bedarf: die größte Einzelübung oder der größte parallele Block (dort zählen die Stationen zusammen), verglichen mit deinem Bestand.</p><div class="tablewrap"><table class="mt"><thead><tr><th>Material</th><th class="n">Bedarf</th><th class="n">Bestand</th><th></th></tr></thead><tbody>${mrows}</tbody></table></div>`:'<p class="hint">Die Übungen im Plan haben noch kein Material eingetragen.</p>'}</section>

  <section class="blk"><h3>Notizen</h3><textarea class="inp" style="width:100%" rows="4" data-key="t-notiz" data-bind="notizen" placeholder="Ansagen, Organisatorisches, Verletzungen …">${esc(t.notizen||"")}</textarea></section>
  <div class="row-actions"><button class="btn" data-act="exportTraining">Plan herunterladen</button><button class="btn" data-act="shareTraining">An Trainer teilen</button><button class="btn" data-act="dupTraining">Als neues Training kopieren</button><button class="btn ghost danger" data-act="delTraining">Training löschen</button></div>`;
}
/* Details einer Spielerin in diesem Training: Status, Grund fürs Fehlen, Einschränkung. */
function openAttDialog(pid){
  const t=S.trainings[S.sel.training],p=pById(pid);if(!t||!p)return;
  const s=t.anwesenheit[pid]||"",g=(t.gruende&&t.gruende[pid])||{},lim=t.einschr&&t.einschr[pid];const gr=S.settings.gruende||[];
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="Anwesenheit ${esc(p.name)}"><h3>${esc(p.name)} <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
    <div class="seg" role="radiogroup" aria-label="Status in diesem Training">${[["","Offen"],["ja","Anwesend"],["nein","Abwesend"]].map(([v,l])=>`<button type="button" role="radio" aria-checked="${s===v}" data-act="adSet" data-id="${pid}" data-v="${v}">${l}</button>`).join("")}</div>
    ${s==="nein"?`<div class="meta" style="margin-top:14px"><label class="f">Grund fürs Fehlen<select id="adGrund">${opt([["","– ohne Angabe –"],...gr.map(x=>[x,x])],g.grund||"")}</select></label></div>
      <label class="f" style="margin-top:10px">Notiz (optional)<input class="inp" id="adNotiz" value="${esc(g.notiz||"")}" placeholder="z. B. Spätschicht"></label>
      <div class="row-actions"><button class="btn pri" data-act="adSave" data-id="${pid}">Grund speichern</button></div>`:""}
    <div class="adlim"><b>Belastung</b><span>${lim?`Eingeschränkt: ${esc(lim.grund)}${lim.notiz?` – ${esc(lim.notiz)}`:""}`:"Voll belastbar"}</span>
      <button type="button" class="btn sm${lim?" pri":""}" data-act="adLim" data-id="${pid}">${lim?"Einschränkung ändern":"Als eingeschränkt markieren"}</button></div></div></div>`;
}
$("#overlay").addEventListener("click",e=>{
  const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act,pid=el.dataset.id;const t=S.trainings[S.sel.training];if(!t)return;
  if(a==="adSet"){const v=el.dataset.v;if(v)t.anwesenheit[pid]=v;else delete t.anwesenheit[pid];if(v!=="nein"&&t.gruende)delete t.gruende[pid];
    saveLater("training",S.sel.training);render();if(v==="nein")openAttDialog(pid);else $("#overlay").innerHTML="";}
  if(a==="adSave"){const grund=$("#adGrund").value,notiz=$("#adNotiz").value.trim();t.gruende=t.gruende||{};
    if(grund||notiz)t.gruende[pid]={grund,notiz};else delete t.gruende[pid];saveLater("training",S.sel.training);$("#overlay").innerHTML="";render();toast("Gespeichert");}
  if(a==="adLim")openEinschr(pid,S.sel.training);
});
$("#app").addEventListener("input",e=>{const el=e.target;if(el.dataset.act==="tQ"){S.ui.tq=el.value;render();}});
$("#app").addEventListener("change",e=>{const el=e.target;if(el.dataset.act==="tFilt"){S.ui[el.dataset.f]=el.value;render();}});
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(el&&el.dataset.act==="tFiltReset"){S.ui.tvon=S.ui.tbis=S.ui.ttag="";render();}});
function openPicker(tag){
  S.ui.pickTag=tag||"";S.ui.pickQ="";renderPicker();
}
function renderPicker(){
  const t=S.trainings[S.sel.training];if(!t){$("#overlay").innerHTML="";return;}
  const hc=headcount(t);const hot=openTags(t);const q=S.ui.pickQ.toLowerCase(),tg=S.ui.pickTag;
  const inPlan=new Set((t.ablauf||[]).map(s=>s.uebungId));
  const exs=Object.entries(S.uebungen).filter(([,e])=>(!q||(e.name||"").toLowerCase().includes(q))&&(!tg||(e.tags||[]).includes(tg)))
    .map(([id,e])=>({id,e,score:(e.tags||[]).filter(x=>hot.includes(x)).length})).sort((a,b)=>b.score-a.score||(a.e.name||"").localeCompare(b.e.name||""));
  const list=exs.map(({id,e,score})=>{const w=exCheck(e,hc);return `<div class="pick"><div><b>${esc(e.name||"Ohne Namen")}</b><span>${esc(e.kategorie||"")} · ${num(e.dauer)} min${score?` · passt zu ${score} offenen Punkt${score>1?"en":""}`:""}${inPlan.has(id)?" · schon im Plan":""}</span>
    <div class="fit ${w.length?"no":"yes"}">${w.length?esc(w[0]):`passt für ${hc.F} Feldspielerinnen und ${hc.T} TW`}</div></div><button class="btn sm pri" data-act="addStep" data-id="${id}">Hinzufügen</button></div>`;}).join("");
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="Übung hinzufügen"><h3>Übung hinzufügen <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
   <input class="search" id="pickQ" placeholder="Übung suchen" value="${esc(S.ui.pickQ)}" data-act="pickQ">
   <div class="chips" style="margin-bottom:8px"><button class="chip tag" data-act="pickTag" data-v="" aria-pressed="${!tg}">Alle</button>${S.settings.tags.map(x=>`<button class="chip tag${hot.includes(x)?" hot":""}" data-act="pickTag" data-v="${esc(x)}" aria-pressed="${tg===x}">${esc(x)}</button>`).join("")}</div>
   ${hot.length?'<p class="hint">Orange umrandet: Themen, die aus dem Spiel noch offen sind.</p>':""}
   ${list||'<p class="hint">Keine passende Übung gefunden.</p>'}
   <div class="row-actions"><button class="btn" data-act="newExFromPick">Neue Übung anlegen</button></div></div></div>`;
  const inp=$("#pickQ");if(inp&&S.ui.pickFocus){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);}
}

