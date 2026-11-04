"use strict";
/* ---------- Wiederverwendbare Trainingsblöcke ----------
   Vorlagen (S.vorlagenDoc.list, gemeinsam für alle Mannschaften): {id,name,bereich,dauer,notiz,schritte:[{uid,uebungId,dauer,name,kategorie,haupt,neben}]}.
   Im Training ist ein eingefügter Block eine Kopie: Schritte tragen schritt.gruppe, die Angaben stehen in training.gruppen[gruppe]
   = {name,bereich,dauer,vorlageId}. Ändert sich die Blockdauer, bleiben die Übungen unverändert – nur frei/zu lang wird angezeigt. */
const vorlagen=()=>S.vorlagenDoc.list;
const vById=id=>vorlagen().find(v=>v.id===id);
const vSchrittDauer=s=>isSet(s.dauer)?num(s.dauer):num((S.uebungen[s.uebungId]||{}).dauer);
const vSumme=v=>(v.schritte||[]).reduce((a,s)=>a+vSchrittDauer(s),0);
/* „x min frei“ / „x min zu lang“ / „passt genau“ */
function restTxt(dauer,summe){const d=num(dauer);if(!d)return `${summe} min`;const r=d-summe;
  return r>0?`<span class="frei">${summe} von ${d} min · ${r} min frei</span>`:r<0?`<span class="over">${summe} von ${d} min · ${-r} min zu lang</span>`:`<span class="ok">${summe} von ${d} min · passt genau</span>`;}

/* ---------- Verwaltung (Übungsbibliothek → Blöcke) ---------- */
function vBloecke(){
  const q=(S.ui.vq||"").toLowerCase().trim(),bf=S.ui.vBereich||"";const cur=S.sel.vorlage&&vById(S.sel.vorlage)?S.sel.vorlage:null;
  const txt=v=>[v.name,v.bereich,v.notiz,...(v.schritte||[]).map(s=>s.name)].join(" ").toLowerCase();
  const list=vorlagen().filter(v=>(!q||q.split(/\s+/).every(w=>txt(v).includes(w)))&&(!bf||v.bereich===bf)).sort((a,b)=>(a.bereich||"").localeCompare(b.bereich||"")||(a.name||"").localeCompare(b.name||""));
  let li="",last=null;list.forEach(v=>{if(v.bereich!==last){li+=`<div class="grouphead">${esc(v.bereich||"Ohne Bereich")}</div>`;last=v.bereich;}
    li+=`<button class="li" data-act="vSel" data-id="${v.id}" aria-current="${v.id===cur}"><b>${esc(v.name||"Ohne Namen")}</b><span>${(v.schritte||[]).length} Übung${(v.schritte||[]).length===1?"":"en"} · ${restTxt(v.dauer,vSumme(v)).replace(/<[^>]+>/g,"")}</span></button>`;});
  return `<div class="split${cur?" has-sel":""}"><aside class="list">${bibSwitch()}<h2>Blöcke</h2><button class="btn pri new" data-act="vNew">Neuer Block</button>
    <input class="search" type="search" data-key="vq" data-act="vQ" placeholder="Blöcke suchen" value="${esc(S.ui.vq||"")}">
    <select class="search" data-act="vBer" aria-label="Bereich">${opt([["","Alle Bereiche"],...(S.settings.bereiche||[]).map(x=>[x,x])],bf)}</select>
    ${li||`<p class="hint">${vorlagen().length?"Kein Block passt.":"Noch keine Blöcke. Leg z. B. „Torwarttraining 20 Min.“ an."}</p>`}</aside>
    <div class="editor">${cur?vEditor(vById(cur)):`<div class="empty"><h3>Wiederverwendbare Blöcke</h3><p>Stell mehrere Übungen zu einem Block mit geplanter Dauer zusammen und füge ihn mit einem Tipp in jedes Training ein.</p><button class="btn pri" data-act="vNew">Neuer Block</button></div>`}</div></div>`;
}
const bibSwitch=()=>`<div class="seg" style="grid-template-columns:1fr 1fr;margin-bottom:14px" role="radiogroup" aria-label="Bibliothek"><button type="button" role="radio" aria-checked="${S.ui.bib!=="bloecke"}" data-act="bibSw" data-v="uebungen">Übungen</button><button type="button" role="radio" aria-checked="${S.ui.bib==="bloecke"}" data-act="bibSw" data-v="bloecke">Blöcke</button></div>`;
function vEditor(v){
  const ber=S.settings.bereiche||[];const sum=vSumme(v);
  return `<div class="ed-top"><button class="btn ghost back" data-act="vBack">← Blöcke</button></div>
  <div class="ed-top"><input class="title-in" data-key="v-name" data-act="vF" data-f="name" value="${esc(v.name||"")}" placeholder="Name, z. B. Torwarttraining"></div>
  <div class="meta"><label class="f">Bereich<select data-key="v-ber" data-act="vF" data-f="bereich">${opt([["","–"],...ber.map(x=>[x,x]),...(v.bereich&&!ber.includes(v.bereich)?[[v.bereich,v.bereich]]:[])],v.bereich||"")}</select></label>
   <label class="f">Geplante Blockdauer (min)<input type="number" min="0" data-key="v-dauer" data-act="vF" data-f="dauer" value="${esc(v.dauer??"")}"></label></div>
  <section class="blk"><h3>Übungen <span class="sub">${restTxt(v.dauer,sum)}</span></h3>
   ${(v.schritte||[]).map((s,i,a)=>`<div class="step vstep"><div class="clock">${i+1}.</div><div><b>${esc(s.name||"Ohne Namen")}</b><div class="tags">${s.haupt?`<span class="haupt">${esc(s.haupt)}</span>`:""}<span>${esc(s.kategorie||"")}</span>${!S.uebungen[s.uebungId]?'<span class="diff">nicht mehr in der Bibliothek</span>':""}</div></div>
     <div class="ctl"><input class="inp" type="number" min="0" data-key="vs-${s.uid}" data-act="vsDur" data-i="${i}" value="${vSchrittDauer(s)}" aria-label="Minuten"><span class="hint" style="margin:0">min</span>
     <button class="iconbtn" data-act="vsUp" data-i="${i}" aria-label="Nach oben"${i?"":" disabled"}>↑</button><button class="iconbtn" data-act="vsDown" data-i="${i}" aria-label="Nach unten"${i<a.length-1?"":" disabled"}>↓</button><button class="iconbtn" data-act="vsDel" data-i="${i}" aria-label="Entfernen">✕</button></div></div>`).join("")||'<p class="hint">Noch keine Übungen im Block.</p>'}
   <div class="row-actions"><button class="btn pri" data-act="vsAdd">Übung hinzufügen</button></div>
   <p class="legend">Änderst du die Blockdauer, bleiben die Übungszeiten, wie sie sind – angezeigt wird nur, was frei ist oder zu lang.</p></section>
  <section class="blk"><h3>Notiz</h3><textarea class="inp" style="width:100%" rows="3" data-key="v-notiz" data-act="vF" data-f="notiz" placeholder="z. B. für 2 TW, Material vorher aufbauen">${esc(v.notiz||"")}</textarea></section>
  <div class="row-actions"><button class="btn" data-act="vDup">Duplizieren</button><button class="btn ghost danger" data-act="vDel">Block löschen</button></div>`;
}

/* ---------- Übung auswählen (für Vorlagen) ---------- */
function openExChooser(onPick,titel){
  S.ui.chooser=onPick;S.ui.chQ="";renderChooser(titel);
}
function renderChooser(titel){
  const q=(S.ui.chQ||"").toLowerCase();const list=Object.entries(S.uebungen).filter(([,e])=>!e.archiviert&&(!q||[(e.name||""),e.haupt,e.kategorie].join(" ").toLowerCase().includes(q)))
    .sort((a,b)=>(!!b[1].favorit-!!a[1].favorit)||(a[1].name||"").localeCompare(b[1].name||""));
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="${esc(titel)}"><h3>${esc(titel)} <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
   <input class="search" id="chQ" data-act="chQ" placeholder="Übung suchen" value="${esc(S.ui.chQ||"")}" data-t="${esc(titel)}">
   ${list.map(([id,e])=>`<div class="pick"><div><b>${e.favorit?"★ ":""}${esc(e.name||"Ohne Namen")}</b><span>${esc(e.haupt||e.kategorie||"")} · ${num(e.dauer)} min</span></div><button class="btn sm pri" data-act="chPick" data-id="${id}">Hinzufügen</button></div>`).join("")||'<p class="hint">Keine Übung gefunden.</p>'}</div></div>`;
  const i=$("#chQ");if(i&&S.ui.chFocus){i.focus();i.setSelectionRange(i.value.length,i.value.length);}
}

/* ---------- Block ins Training einfügen ---------- */
function openVorlagenPicker(){S.ui.vpQ="";renderVorlagenPicker();}
function renderVorlagenPicker(){
  const t=S.trainings[S.sel.training];if(!t){$("#overlay").innerHTML="";return;}const q=(S.ui.vpQ||"").toLowerCase(),bf=S.ui.vpBer||"";
  const list=vorlagen().filter(v=>(!q||[v.name,v.bereich,...(v.schritte||[]).map(s=>s.name)].join(" ").toLowerCase().includes(q))&&(!bf||v.bereich===bf)).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="Block einfügen"><h3>Block einfügen <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
   <input class="search" id="vpQ" data-act="vpQ" placeholder="Block suchen" value="${esc(S.ui.vpQ||"")}">
   <div class="chips" style="margin-bottom:8px"><button class="chip tag" data-act="vpBer" data-v="" aria-pressed="${!bf}">Alle</button>${(S.settings.bereiche||[]).map(x=>`<button class="chip tag" data-act="vpBer" data-v="${esc(x)}" aria-pressed="${bf===x}">${esc(x)}</button>`).join("")}</div>
   ${list.map(v=>`<div class="pick"><div><b>${esc(v.name||"Ohne Namen")}</b><span>${esc(v.bereich||"")} · ${(v.schritte||[]).map(s=>esc(s.name)).join(", ")||"keine Übungen"}</span><div class="fit">${restTxt(v.dauer,vSumme(v))}</div></div><button class="btn sm pri" data-act="vpAdd" data-id="${v.id}"${(v.schritte||[]).length?"":" disabled"}>Einfügen</button></div>`).join("")||`<p class="hint">${vorlagen().length?"Kein Block passt.":"Noch keine Blöcke – leg sie unter Übungen → Blöcke an."}</p>`}</div></div>`;
  const i=$("#vpQ");if(i&&S.ui.vpFocus){i.focus();i.setSelectionRange(i.value.length,i.value.length);}
}
function insertVorlage(t,v){
  const gid="g"+uid();t.gruppen=t.gruppen||{};t.gruppen[gid]={name:v.name||"Block",bereich:v.bereich||"",dauer:num(v.dauer)||"",vorlageId:v.id};
  (v.schritte||[]).forEach(s=>t.ablauf.push({uid:uid(),uebungId:s.uebungId,notiz:"",dauer:vSchrittDauer(s),name:s.name,kategorie:s.kategorie||"",haupt:s.haupt||"",neben:(s.neben||[]).slice(),gruppe:gid}));
}
/* Neuer Schritt: im gewählten Block (S.ui.pickGruppe) hinter dessen letzte Übung, sonst ans Ende. */
function insertStep(t,s){
  const g=S.ui.pickGruppe;const last=g?t.ablauf.map(x=>x.gruppe).lastIndexOf(g):-1;
  if(last>=0){s.gruppe=g;t.ablauf.splice(last+1,0,s);}else t.ablauf.push(s);
}

/* ---------- Blöcke im Training ---------- */
/* Pro Block-Kennung zählt nur die längste zusammenhängende Folge; Übungen, die herausgeschoben wurden, verlassen den Block. */
function normGruppen(t){
  const runs={};let prev=null,start=0;(t.ablauf||[]).forEach((s,i)=>{const g=s.gruppe||null;if(g!==prev){prev=g;start=i;}if(g){const r=runs[g]=runs[g]||[];const cur=r.find(x=>x.s===start);if(cur)cur.n++;else r.push({s:start,n:1});}});
  Object.entries(runs).forEach(([g,r])=>{const best=r.reduce((a,b)=>b.n>a.n?b:a);(t.ablauf||[]).forEach((s,i)=>{if(s.gruppe===g&&(i<best.s||i>=best.s+best.n))delete s.gruppe;});});
  if(t.gruppen)Object.keys(t.gruppen).forEach(g=>{if(!runs[g])delete t.gruppen[g];});if(t.gruppen&&!Object.keys(t.gruppen).length)delete t.gruppen;
}
function gruppeKopf(t,g,units){
  const m=t.gruppen[g];const sum=units.filter(u=>u.steps[0].s.gruppe===g).reduce((a,u)=>a+u.dur,0);
  return `<div class="tgroup"><div class="tg-head"><div><b class="tg-name">▣ ${esc(m.name)}</b>${m.bereich?` <span class="src">${esc(m.bereich)}</span>`:""}<div class="tg-rest">${restTxt(m.dauer,sum)}</div></div>
    <div class="tg-ctl"><label class="lsinv">Block <input class="inp" type="number" min="0" data-key="gd-${g}" data-act="grpDur" data-g="${g}" value="${esc(m.dauer??"")}"> min</label>
    <button class="btn sm" data-act="grpAdd" data-g="${g}">Übung in den Block</button><button class="btn sm ghost" data-act="grpSave" data-g="${g}">Als neue Vorlage</button><button class="btn sm ghost" data-act="grpDiss" data-g="${g}">Auflösen</button></div></div>`;
}
function wrapGruppen(t,units,arr){
  let out="",cur=null;units.forEach((u,ui)=>{const g0=u.steps[0].s.gruppe;const g=g0&&t.gruppen&&t.gruppen[g0]?g0:null;
    if(g!==cur){if(cur)out+="</div>";if(g)out+=gruppeKopf(t,g,units);cur=g;}out+=arr[ui];});
  return out+(cur?"</div>":"");
}

/* ---------- Bedienung ---------- */
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  if(a==="bibSw"){S.ui.bib=el.dataset.v;render();return;}
  if(S.view==="training"){const t=S.trainings[S.sel.training];if(!t)return;const g=el.dataset.g;const save=()=>{saveLater("training",S.sel.training);render();};
    if(a==="vpOpen"){S.ui.vpFocus=true;openVorlagenPicker();}
    if(a==="grpAdd"){S.ui.pickGruppe=g;S.ui.pickFocus=true;openPicker("");}
    if(a==="grpDiss"){if(!confirmDel(`Block „${t.gruppen[g].name}“ auflösen? Die Übungen bleiben im Training.`))return;t.ablauf.forEach(s=>{if(s.gruppe===g)delete s.gruppe;});delete t.gruppen[g];normGruppen(t);save();}
    if(a==="grpSave"){const m=t.gruppen[g];let name=m.name;try{const x=window.prompt("Name der neuen Vorlage:",`${m.name} (angepasst)`);if(x==null)return;name=x.trim()||name;}catch(err){}
      const schritte=t.ablauf.filter(s=>s.gruppe===g).map(s=>({uid:uid(),uebungId:s.uebungId,dauer:stepDur({s,ex:stepEx(s)}),name:s.name,kategorie:s.kategorie||"",haupt:s.haupt||"",neben:(s.neben||[]).slice()}));
      vorlagen().push({id:"v"+uid(),name,bereich:m.bereich||"",dauer:m.dauer||"",notiz:"",schritte});saveLater("vorlagen");toast(`Vorlage „${name}“ gespeichert`);}
    return;}
  if(S.view!=="uebungen"||S.ui.bib!=="bloecke")return;
  const v=vById(S.sel.vorlage);const save=()=>{saveLater("vorlagen");render();};
  if(a==="vSel"){S.sel.vorlage=el.dataset.id;render();window.scrollTo(0,0);}
  if(a==="vBack"){S.sel.vorlage=null;render();}
  if(a==="vNew"){const nv={id:"v"+uid(),name:"",bereich:S.ui.vBereich||"",dauer:20,notiz:"",schritte:[]};vorlagen().push(nv);S.sel.vorlage=nv.id;save();setTimeout(()=>$('[data-key="v-name"]')?.focus(),0);}
  if(!v)return;const i=+el.dataset.i,sch=v.schritte=v.schritte||[];
  if(a==="vsAdd")openExChooser(id=>{const ex=S.uebungen[id];sch.push(Object.assign({uid:uid(),uebungId:id,dauer:num(ex.dauer)},snapshot(ex)));save();},"Übung zum Block");
  if(a==="vsUp"&&i>0){[sch[i-1],sch[i]]=[sch[i],sch[i-1]];save();}
  if(a==="vsDown"&&i<sch.length-1){[sch[i+1],sch[i]]=[sch[i],sch[i+1]];save();}
  if(a==="vsDel"){sch.splice(i,1);save();}
  if(a==="vDup"){const c=clone(v);c.id="v"+uid();c.name=(v.name||"Block")+" (Kopie)";c.schritte.forEach(s=>s.uid=uid());vorlagen().push(c);S.sel.vorlage=c.id;save();toast("Kopie angelegt");}
  if(a==="vDel"){if(!confirmDel(`Block „${v.name||"ohne Namen"}“ löschen? Bereits eingefügte Blöcke in Trainings bleiben erhalten.`))return;S.vorlagenDoc.list=vorlagen().filter(x=>x!==v);S.sel.vorlage=null;save();}
});
$("#app").addEventListener("change",e=>{const el=e.target,a=el.dataset.act;
  if(a==="vBer"){S.ui.vBereich=el.value;render();return;}
  if(a==="grpDur"){const t=S.trainings[S.sel.training];const m=t&&t.gruppen&&t.gruppen[el.dataset.g];if(!m)return;m.dauer=el.value===""?"":Math.max(0,num(el.value));saveLater("training",S.sel.training);render();return;}
  const v=vById(S.sel.vorlage);if(!v)return;
  if(a==="vF"){const f=el.dataset.f;v[f]=f==="dauer"?(el.value===""?"":Math.max(0,num(el.value))):el.value.trim();saveLater("vorlagen");render();}
  if(a==="vsDur"){const s=v.schritte[+el.dataset.i];if(s){s.dauer=Math.max(0,num(el.value));saveLater("vorlagen");render();}}
});
$("#app").addEventListener("input",e=>{if(e.target.dataset.act==="vQ"){S.ui.vq=e.target.value;render();}});
$("#overlay").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  if(a==="chPick"&&S.ui.chooser){const f=S.ui.chooser;S.ui.chooser=null;$("#overlay").innerHTML="";f(el.dataset.id);toast("Hinzugefügt");}
  if(a==="vpBer"){S.ui.vpBer=el.dataset.v;S.ui.vpFocus=false;renderVorlagenPicker();}
  if(a==="vpAdd"){const t=S.trainings[S.sel.training],v=vById(el.dataset.id);if(!t||!v)return;insertVorlage(t,v);saveLater("training",S.sel.training);$("#overlay").innerHTML="";render();toast(`Block „${v.name}“ eingefügt`);}
});
$("#overlay").addEventListener("input",e=>{const el=e.target;
  if(el.dataset.act==="chQ"){S.ui.chQ=el.value;S.ui.chFocus=true;renderChooser(el.dataset.t);}
  if(el.dataset.act==="vpQ"){S.ui.vpQ=el.value;S.ui.vpFocus=true;renderVorlagenPicker();}});
