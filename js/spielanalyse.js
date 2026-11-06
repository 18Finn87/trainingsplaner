"use strict";
/* ---------- Spielanalyse erweitert ----------
   spiel.medien = [{id,typ:"bild"|"video",titel,data,w,h (Bild, verkleinert) | url (Video, nur Link)}]
   punkt: tag (Nebenschwerpunkt), haupt (Hauptschwerpunkt), teile [Mannschaftsteile], spielerinnen [Kennungen], medien [Medien-Kennungen] */
const medienVon=s=>s.medien=s.medien||[];
const istLink=v=>/^https?:\/\/\S+$/i.test(v||"");

/* Medienbereich im Spielbericht */
function medienBlock(id,s){
  const m=medienVon(s);const nutz=mid=>(s.punkte||[]).filter(p=>(p.medien||[]).includes(mid)).length;
  return `<section class="blk"><h3>Screenshots und Videoclips <span class="sub">${m.length}</span></h3>
   ${m.length?`<div class="medgrid">${m.map(x=>`<div class="med">${x.typ==="bild"?`<button type="button" class="medimg" data-act="mdZoom" data-id="${x.id}" aria-label="Screenshot groß anzeigen"><img src="${x.data}" alt="${esc(x.titel||"Screenshot")}"></button>`
      :`<a class="medvid" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">▶ Clip öffnen ↗</a>`}
     <input class="inp" data-key="md-${x.id}" data-act="mdTitel" data-id="${x.id}" value="${esc(x.titel||"")}" placeholder="${x.typ==="bild"?"Titel, z. B. 23. Min. Abstand Kette":"Titel, z. B. Gegentor 1:1"}">
     <div class="medfoot"><span class="src">${nutz(x.id)?`${nutz(x.id)} Punkt${nutz(x.id)>1?"e":""}`:"keinem Punkt zugeordnet"}</span>${SB.cfgOk()?`<button class="btn sm mini" data-act="fgMed" data-id="${x.id}">Freigeben</button>`:""}<button class="iconbtn mini" data-act="mdDel" data-id="${x.id}" aria-label="Entfernen">✕</button></div></div>`).join("")}</div>`:'<p class="hint">Screenshots (werden verkleinert) und Links zu Videoclips, z. B. aus Veo. Zuordnen kannst du sie bei jeder Beobachtung unter „Details“.</p>'}
   <div class="row-actions"><label class="btn sm">Screenshots hinzufügen<input type="file" accept="image/*" multiple data-act="mdBild" class="sr"></label></div>
   <div class="addpt" style="margin-top:10px"><input class="inp" type="url" inputmode="url" id="mdUrl" placeholder="Link zum Videoclip (https://…)"><button class="btn" data-act="mdVideo">Clip hinzufügen</button></div></section>`;
}
/* Details eines Beobachtungspunkts */
function ptDetail(id,s,p,i){
  const sp=S.settings.schwerpunkte||[],teile=S.settings.mannschaftsteile||[];
  const kader=(s.kader&&s.kader.length?players().filter(x=>s.kader.includes(x.id)):players()).slice().sort(nrSort);
  const m=medienVon(s),vor=uebVorschlaege(p),wk=wiederInSpielen(id,p);
  return `<div class="ptd">
    ${wk.length?`<div class="notice" style="margin:0 0 10px">Ähnliches auch in ${wk.length} anderen Spiel${wk.length>1?"en":""}: ${esc(wk.map(x=>`${kurzDatum(x.s.datum)} ${x.s.gegner||""}`.trim()).join(", "))}</div>`:""}
    <div class="meta" style="margin:0"><label class="f">Hauptschwerpunkt<select data-key="pth-${p.id}" data-act="ptHaupt" data-i="${i}">${opt([["","–"],...sp.map(x=>[x,x])],p.haupt||"")}</select></label></div>
    <p class="legend" style="margin:10px 0 6px">Mannschaftsteile</p><div class="chips">${teile.map(x=>`<button type="button" class="chip tag" data-act="ptTeil" data-i="${i}" data-v="${esc(x)}" aria-pressed="${(p.teile||[]).includes(x)}">${esc(x)}</button>`).join("")}</div>
    <p class="legend" style="margin:10px 0 6px">Spielerinnen${s.kader&&s.kader.length?" (aus dem Spielkader)":""}</p><div class="chips">${kader.map(x=>`<button type="button" class="chip tag" data-act="ptSp" data-i="${i}" data-v="${x.id}" aria-pressed="${(p.spielerinnen||[]).includes(x.id)}">${x.nummer?`<span class="nr">${esc(x.nummer)}</span>`:""}${esc(x.name)}</button>`).join("")}</div>
    <p class="legend" style="margin:10px 0 6px">Medien</p>${m.length?`<div class="chips">${m.map(x=>`<button type="button" class="chip tag medchip" data-act="ptMed" data-i="${i}" data-v="${x.id}" aria-pressed="${(p.medien||[]).includes(x.id)}">${x.typ==="bild"?`<img src="${x.data}" alt="">`:"▶"} ${esc(x.titel||(x.typ==="bild"?"Screenshot":"Clip"))}</button>`).join("")}</div>`:'<p class="hint" style="margin:0">Noch keine Medien – oben im Bereich „Screenshots und Videoclips“ hinzufügen.</p>'}
    <p class="legend" style="margin:14px 0 6px">Passende Übungen ${p.haupt||p.tag?`<span class="src">(${esc([p.haupt,p.tag].filter(Boolean).join(", "))})</span>`:""}</p>
    ${!p.haupt&&!p.tag?'<p class="hint" style="margin:0">Wähle ein Thema oder einen Hauptschwerpunkt, dann schlägt die App Übungen vor.</p>':vor.length?vor.map(({id:eid,e,why})=>`<div class="pick"><div><b>${e.favorit?"★ ":""}${esc(e.name||"Ohne Namen")}</b><span>${esc(why)} · ${num(e.dauer)} min</span></div><button class="btn sm pri" data-act="ptToTr" data-i="${i}" data-id="${eid}">Ins Training</button></div>`).join(""):'<p class="hint" style="margin:0">Keine passende Übung in der Bibliothek.</p>'}
    <div class="row-actions"><button class="btn sm" data-act="ptToWoche" data-i="${i}">Als Wochenschwerpunkt</button>${SB.cfgOk()?`<button class="btn sm" data-act="fgPunkt" data-i="${i}">An Spielerinnen freigeben</button>`:""}</div></div>`;
}
/* Übungsvorschläge: Hauptschwerpunkt zählt doppelt, Nebenschwerpunkt (= Thema des Punkts) einfach; Favoriten vor. */
function uebVorschlaege(p){
  return Object.entries(S.uebungen).filter(([,e])=>!e.archiviert).map(([id,e])=>{let sc=0;const why=[];
    if(p.haupt&&e.haupt===p.haupt){sc+=2;why.push(`Haupt: ${e.haupt}`);}if(p.tag&&((e.tags||[]).includes(p.tag)||e.haupt===p.tag)){sc+=1;why.push(`Thema: ${p.tag}`);}
    return {id,e,sc,why:why.join(" · ")};}).filter(x=>x.sc).sort((a,b)=>b.sc-a.sc||(!!b.e.favorit-!!a.e.favorit)||(a.e.name||"").localeCompare(b.e.name||"")).slice(0,6);
}
/* Wiederkehrende Probleme: negative Punkte mit gleichem Thema / Hauptschwerpunkt / Mannschaftsteil in anderen Spielen der Mannschaft. */
const merkmale=p=>[p.tag&&"Thema: "+p.tag,p.haupt&&"Haupt: "+p.haupt,...(p.teile||[]).map(t=>"Teil: "+t)].filter(Boolean);
function wiederInSpielen(id,p){if(p.art!=="minus")return [];const mk=merkmale(p);if(!mk.length)return [];
  return ofTeam("spiele").filter(([sid])=>sid!==id).filter(([,s])=>(s.punkte||[]).some(q=>q.art==="minus"&&merkmale(q).some(x=>mk.includes(x)))).map(([sid,s])=>({id:sid,s}));}
function wiederkehrend(){
  const map={};ofTeam("spiele").forEach(([sid,s])=>(s.punkte||[]).filter(p=>p.art==="minus").forEach(p=>merkmale(p).forEach(k=>{const e=map[k]=map[k]||{spiele:new Set(),punkte:[]};e.spiele.add(sid);e.punkte.push({sid,s,p});})));
  return Object.entries(map).filter(([,v])=>v.spiele.size>=2).sort((a,b)=>b[1].spiele.size-a[1].spiele.size||b[1].punkte.length-a[1].punkte.length);
}
function wiederBlock(){
  const w=wiederkehrend();if(!w.length)return `<section class="blk"><h3>Wiederkehrende Probleme</h3><p class="hint">Sobald negative Beobachtungen mit gleichem Thema, Hauptschwerpunkt oder Mannschaftsteil in mindestens zwei Spielen vorkommen, erscheinen sie hier.</p></section>`;
  return `<section class="blk"><h3>Wiederkehrende Probleme <span class="sub">${w.length}</span></h3>
   ${w.map(([k,v])=>`<details class="fold wk"><summary><b>${esc(k.replace(/^[^:]+: /,""))}</b> <span class="src">${esc(k.split(":")[0])} · in ${v.spiele.size} Spielen · ${v.punkte.length} Beobachtungen</span></summary>
     <ul class="miss">${v.punkte.map(({sid,s,p})=>`<li><button type="button" class="plink" data-act="selSpiel" data-id="${sid}"><b>${esc(kurzDatum(s.datum))} ${esc(s.gegner||"Gegner offen")}</b></button><div>${esc(p.text)}</div></li>`).join("")}</ul></details>`).join("")}
   <p class="legend">Gezählt werden negative Punkte (−). Das Thema eines Punkts ist sein Nebenschwerpunkt.</p></section>`;
}
/* Ziel-Training wählen (geplante Trainings der Mannschaft, nächste zuerst) */
function openTrainingWahl(eid,label){
  const list=sortedTrainings().filter(([,t])=>!t.durchgefuehrt).sort((a,b)=>(a[1].datum||"").localeCompare(b[1].datum||""));
  S.ui.ttEx=eid;
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="In welches Training?"><h3>In welches Training? <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
   <p class="hint">${esc(label)}</p>
   ${list.map(([tid,t])=>`<div class="pick"><div><b>${esc(fmtDate(t.datum))}</b><span>${esc(t.thema||"ohne Thema")} · ${(t.ablauf||[]).length} Übungen</span></div><button class="btn sm pri" data-act="ttPick" data-id="${tid}">Hinzufügen</button></div>`).join("")||'<p class="hint">Kein geplantes Training vorhanden.</p>'}
   <div class="row-actions"><button class="btn" data-act="ttNew">Neues Training anlegen</button></div></div></div>`;
}

/* ---------- Bedienung ---------- */
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el||S.view!=="spiele")return;const a=el.dataset.act;const s=S.spiele[S.sel.spiel];
  if(!s)return;const save=()=>{saveLater("spiel",S.sel.spiel);render();};const p=s.punkte[+el.dataset.i];
  const tog=(arr,v)=>arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];
  if(a==="ptOpen"){const k="pt"+el.dataset.pid;S.ui.open[k]=!S.ui.open[k];render();}
  if(a==="ptTeil"&&p){p.teile=tog(p.teile||[],el.dataset.v);save();}
  if(a==="ptSp"&&p){p.spielerinnen=tog(p.spielerinnen||[],el.dataset.v);save();}
  if(a==="ptMed"&&p){p.medien=tog(p.medien||[],el.dataset.v);save();}
  if(a==="ptToTr"&&p){S.ui.ttPunkt={sid:S.sel.spiel,pid:p.id};openTrainingWahl(el.dataset.id,`„${(S.uebungen[el.dataset.id]||{}).name||"Übung"}“ zu: ${p.text}`);}
  if(a==="ptToWoche"&&p){const vor=sortedTrainings().map(([,t])=>t).filter(t=>!t.durchgefuehrt&&t.datum>=today()).sort((x,y)=>x.datum.localeCompare(y.datum))[0];
    const d=vor?vor.datum:dayShift(montag(today()),7);
    if(!confirmDel(`„${p.text}“ als Schwerpunkt für die Woche ab ${kurzDatum(montag(d))} übernehmen?\n\nDie Periodenziele bleiben unverändert.`))return;
    planung().wochen.push({id:"w"+uid(),von:montag(d),text:p.text,haupt:p.haupt||"",neben:p.tag||"",quelle:`Spiel ${kurzDatum(s.datum)} ${s.gegner||""}`.trim()});saveLater("planung");toast("Als Wochenschwerpunkt übernommen");render();}
  if(a==="mdDel"){const x=medienVon(s).find(m=>m.id===el.dataset.id);if(!x||!confirmDel(`${x.typ==="bild"?"Screenshot":"Clip"} „${x.titel||"ohne Titel"}“ entfernen?`))return;
    s.medien=s.medien.filter(m=>m!==x);s.punkte.forEach(q=>{if(q.medien)q.medien=q.medien.filter(v=>v!==x.id);});save();}
  if(a==="mdVideo"){const u=($("#mdUrl").value||"").trim();if(!istLink(u)){toast("Bitte einen Link mit https:// eingeben.");return;}medienVon(s).push({id:"m"+uid(),typ:"video",url:u,titel:""});save();toast("Clip hinzugefügt");}
  if(a==="mdZoom"){const x=medienVon(s).find(m=>m.id===el.dataset.id);if(x)$("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel big" role="dialog" aria-modal="true" aria-label="Screenshot"><h3>${esc(x.titel||"Screenshot")} <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3><img class="zoomimg" src="${x.data}" alt="${esc(x.titel||"Screenshot")}"></div></div>`;}
});
$("#app").addEventListener("change",async e=>{const el=e.target,a=el.dataset.act;if(S.view!=="spiele")return;const s=S.spiele[S.sel.spiel];if(!s)return;
  if(a==="ptHaupt"){const p=s.punkte[+el.dataset.i];if(p){p.haupt=el.value;saveLater("spiel",S.sel.spiel);render();}}
  if(a==="mdTitel"){const x=medienVon(s).find(m=>m.id===el.dataset.id);if(x){x.titel=el.value.trim();saveLater("spiel",S.sel.spiel);}}
  if(a==="mdBild"){const files=[...(el.files||[])].filter(f=>/^image\//.test(f.type));el.value="";if(!files.length)return;let n=0;
    for(const f of files){try{setStatus(`Bild ${++n} von ${files.length} wird verkleinert …`);const b=await bildVerkleinern(f);medienVon(s).push(Object.assign({id:"m"+uid(),typ:"bild",titel:f.name.replace(/\.[^.]+$/,"")},b));}catch(err){toast(`„${f.name}“ konnte nicht gelesen werden.`);}}
    saveLater("spiel",S.sel.spiel);render();toast(`${files.length} Screenshot${files.length>1?"s":""} gespeichert`);}
});
$("#overlay").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  if(a!=="ttPick"&&a!=="ttNew")return;const eid=S.ui.ttEx,ex=S.uebungen[eid];if(!ex)return;
  let tid=el.dataset.id;if(a==="ttNew"){const vor=S.view;newTraining({});tid=S.sel.training;S.view=vor;}
  const t=S.trainings[tid];S.ui.pickGruppe=null;insertStep(t,Object.assign({uid:uid(),uebungId:eid,notiz:"aus Spielanalyse"},snapshot(ex)));
  saveLater("training",tid);$("#overlay").innerHTML="";render();toast(`„${ex.name}“ im Training ${fmtDate(t.datum)} eingeplant`);
});
