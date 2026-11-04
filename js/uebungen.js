"use strict";
/* Übungen */
function vUebungen(){
  if(S.ui.bib==="bloecke")return vBloecke();
  const cur=S.sel.uebung&&S.uebungen[S.sel.uebung]?S.sel.uebung:null;
  const q=S.ui.q.toLowerCase().trim(),tg=S.ui.tag,hp=S.ui.haupt||"",fav=!!S.ui.nurFav,arch=!!S.ui.archiv;
  const txt=e=>[e.name,e.kategorie,e.haupt,e.ziel,e.organisation,e.coaching,e.flaeche,...(e.tags||[]),...(e.varianten||[]).map(v=>v.name+" "+v.text)].join(" ").toLowerCase();
  const sichtbar=Object.entries(S.uebungen).filter(([,e])=>!!e.archiviert===arch);
  const ents=sichtbar.filter(([,e])=>(!q||q.split(/\s+/).every(w=>txt(e).includes(w)))&&(!tg||(e.tags||[]).includes(tg))&&(!hp||(hp==="__ohne"?!e.haupt:e.haupt===hp))&&(!fav||e.favorit));
  const ohne=sichtbar.filter(([,e])=>!e.haupt).length,nArch=Object.values(S.uebungen).filter(e=>e.archiviert).length;
  const item=([id,e])=>`<button class="li" data-act="selUebung" data-id="${id}" aria-current="${id===cur}"><b>${e.favorit?'<span class="fav" aria-label="Favorit">★</span> ':""}${esc(e.name||"Ohne Namen")}</b><span>${e.haupt?`<em class="hp">${esc(e.haupt)}</em> · `:'<em class="hp none">ohne Hauptschwerpunkt</em> · '}${num(e.dauer)} min${e.maxSp?` · ${num(e.minSp)||1}–${num(e.maxSp)} Spielerinnen`:""}${num(e.tw)?` · ${num(e.tw)} TW`:""}${e.schwierigkeit?` · Stufe ${esc(e.schwierigkeit)}`:""}${(e.varianten||[]).length?` · ${e.varianten.length} Var.`:""}${e.bild?" · Bild":""}</span></button>`;
  const byName=(a,b)=>(a[1].name||"").localeCompare(b[1].name||"");
  // Favoriten stehen oben, danach nach Kategorie
  const favs=arch?[]:ents.filter(([,e])=>e.favorit).sort(byName);let li=favs.length?`<div class="grouphead">★ Favoriten</div>`+favs.map(item).join(""):"";
  katList().concat([""]).forEach(k=>{const g=ents.filter(([,e])=>(arch||!e.favorit)&&((e.kategorie||"")===k||(k===""&&!katList().includes(e.kategorie)))).sort(byName);
    if(g.length)li+=`<div class="grouphead">${esc(k||"Ohne Kategorie")}</div>`+g.map(item).join("");});
  return `<div class="split${cur?" has-sel":""}"><aside class="list">${bibSwitch()}<h2>${arch?"Archiv":"Übungen"}</h2>${arch?"":'<button class="btn pri new" data-act="newEx">Neue Übung</button>'}
   <input class="search" type="search" data-key="exq" data-act="exQ" placeholder="Suchen: Name, Ziel, Variante …" value="${esc(S.ui.q)}">
   <select class="search" data-act="exHaupt" aria-label="Hauptschwerpunkt">${opt([["","Alle Hauptschwerpunkte"],...(S.settings.schwerpunkte||[]).map(x=>[x,x]),["__ohne",`Ohne Hauptschwerpunkt (${ohne})`]],hp)}</select>
   <select class="search" data-act="exTag" aria-label="Nebenschwerpunkt">${opt([["","Alle Nebenschwerpunkte"],...S.settings.tags.map(x=>[x,x])],tg)}</select>
   <div class="row-actions" style="margin:0 0 8px">${arch?"":`<button class="chip tag" data-act="exFavF" aria-pressed="${fav}">★ Nur Favoriten</button>`}<button class="chip tag" data-act="exArchF" aria-pressed="${arch}">${arch?"← Zurück zur Sammlung":`Archiv anzeigen (${nArch})`}</button></div>
   ${q||tg||hp||fav?`<p class="legend">${ents.length} von ${sichtbar.length} Übungen</p>`:""}${li||`<p class="hint">${arch?"Das Archiv ist leer.":"Keine Übungen gefunden."}</p>`}</aside>
   <div class="editor">${cur?exEditor(cur):`<div class="empty"><h3>Deine Übungssammlung</h3><p>Jede Übung legst du einmal an: Skizze, Ablauf, Spielerzahl und Material. Danach baust du Trainings mit ein paar Klicks.</p><button class="btn pri" data-act="newEx">Neue Übung</button></div>`}</div></div>`;
}
function exEditor(id){
  const e=S.uebungen[id];e.material=e.material||{};e.tags=e.tags||[];
  const bm=boardMaterial(e.board);const hasBm=Object.keys(bm).length;
  return `<div class="ed-top"><button class="btn ghost back" data-act="back">← ${S.ui.backTo?"Zurück zum Training":"Übungen"}</button>${S.ui.backTo?'<button class="btn ghost" data-act="backTraining" style="margin-left:auto">Zurück zum Training</button>':""}</div>
  ${e.archiviert?'<div class="notice">Diese Übung ist archiviert: Sie erscheint nicht mehr in der Auswahl, bleibt aber in alten Trainings erhalten.</div>':""}
  <div class="ed-top"><input class="title-in" data-key="e-name" data-bind="name" value="${esc(e.name||"")}" placeholder="Name der Übung"><button type="button" class="iconbtn favbtn" data-act="exFav" aria-pressed="${!!e.favorit}" aria-label="${e.favorit?"Kein Favorit mehr":"Als Favorit markieren"}" title="Favorit">${e.favorit?"★":"☆"}</button></div>
  <div class="meta"><label class="f">Hauptschwerpunkt<select data-key="e-haupt" data-bind="haupt" data-rr>${opt([["","– noch keiner –"],...(S.settings.schwerpunkte||[]).map(k=>[k,k]),...(e.haupt&&!(S.settings.schwerpunkte||[]).includes(e.haupt)?[[e.haupt,e.haupt]]:[])],e.haupt||"")}</select></label>
   <label class="f">Kategorie (Organisationsform)<select data-key="e-kat" data-bind="kategorie" data-rr>${opt([["","–"],...katList().map(k=>[k,k]),...(e.kategorie&&!katList().includes(e.kategorie)?[[e.kategorie,e.kategorie]]:[])],e.kategorie||"")}</select></label>
   <label class="f">Dauer (min)<input type="number" min="0" data-key="e-dauer" data-bind="dauer" data-rr value="${esc(e.dauer??"")}"></label>
   <label class="f">Feldspielerinnen min.<input type="number" min="0" data-key="e-min" data-bind="minSp" data-rr value="${esc(e.minSp??"")}"></label>
   <label class="f">Feldspielerinnen max.<input type="number" min="0" data-key="e-max" data-bind="maxSp" data-rr value="${esc(e.maxSp??"")}" placeholder="beliebig"></label>
   <label class="f">Torhüterinnen<input type="number" min="0" data-key="e-tw" data-bind="tw" data-rr value="${esc(e.tw??"")}"></label>
   <label class="f">Teams<input type="number" min="0" data-key="e-teams" data-bind="teams" data-rr value="${esc(e.teams??"")}" placeholder="keine"></label>
   <label class="f">Fläche<input data-key="e-fl" data-bind="flaeche" value="${esc(e.flaeche||"")}" placeholder="z. B. 30 × 20 m"></label>
   <label class="f">Schwierigkeit<select data-key="e-sw" data-bind="schwierigkeit" data-rr>${opt([["","–"],["1","1 – sehr leicht"],["2","2 – leicht"],["3","3 – mittel"],["4","4 – schwer"],["5","5 – sehr schwer"]],String(e.schwierigkeit||""))}</select></label></div>
  <section class="blk"><h3>Nebenschwerpunkte</h3><p class="hint">Was die Übung zusätzlich trainiert. Verbindet sie auch mit den Kritikpunkten aus deinen Spielberichten. Gilt für künftig eingeplante Trainings – bereits geplante behalten ihre Angaben.</p><div class="chips">${tagChips(e.tags,"exTagToggle")}</div></section>
  <section class="blk"><h3>Skizze</h3><div data-board="uebung:${id}:board"></div></section>
  <section class="blk"><h3>Ablauf und Coaching</h3><div class="two" style="grid-template-columns:1fr">
   <label class="f">Ziel<textarea data-key="e-ziel" data-bind="ziel" rows="2">${esc(e.ziel||"")}</textarea></label>
   <label class="f">Organisation<textarea data-key="e-org" data-bind="organisation" rows="3">${esc(e.organisation||"")}</textarea></label>
   <label class="f">Coaching<textarea data-key="e-coach" data-bind="coaching" rows="3">${esc(e.coaching||"")}</textarea></label></div></section>
  <section class="blk"><h3>Varianten <span class="sub">${(e.varianten||[]).length}</span></h3><p class="hint">Abwandlungen der Übung, z. B. leichter/schwerer, andere Spielerzahl, mit Torabschluss.</p>
   ${(e.varianten||[]).map((v,i)=>`<div class="var"><div class="meta" style="margin:0"><label class="f">Name<input data-key="v-n-${v.id}" data-act="varF" data-f="name" data-i="${i}" value="${esc(v.name||"")}" placeholder="z. B. mit zwei Kontakten"></label></div>
     <label class="f" style="margin-top:6px">Beschreibung<textarea class="inp" rows="2" data-key="v-t-${v.id}" data-act="varF" data-f="text" data-i="${i}">${esc(v.text||"")}</textarea></label>
     <div class="row-actions" style="margin-top:6px"><button class="btn sm ghost danger" data-act="varDel" data-i="${i}">Variante entfernen</button></div></div>`).join("")}
   <div class="row-actions"><button class="btn sm" data-act="varAdd">Variante hinzufügen</button></div></section>
  <section class="blk"><h3>Bild und Video</h3>
   ${e.bild&&e.bild.data?`<img class="exbild" src="${e.bild.data}" alt="Bild zur Übung ${esc(e.name||"")}"><p class="legend">${e.bild.w}×${e.bild.h} px · ${Math.round(e.bild.data.length*0.75/1024)} KB</p>`:'<p class="hint">Ein Foto oder Screenshot zur Übung. Die App verkleinert es automatisch, damit der Speicher nicht vollläuft.</p>'}
   <div class="row-actions" style="margin-top:6px"><label class="btn sm">${e.bild?"Bild ersetzen":"Bild hinzufügen"}<input type="file" accept="image/*" data-act="exBild" class="sr"></label>${e.bild?'<button class="btn sm ghost danger" data-act="exBildDel">Bild entfernen</button>':""}</div>
   <label class="f" style="margin-top:14px">Video-Link<input type="url" inputmode="url" data-key="e-video" data-act="exVideo" value="${esc(e.video||"")}" placeholder="https://…"></label>
   ${e.video?`<p class="legend"><a href="${esc(e.video)}" target="_blank" rel="noopener noreferrer">Video öffnen ↗</a> – nur als Link gespeichert.</p>`:""}</section>
  <section class="blk"><h3>Material <span class="sub">gleichzeitig benötigt</span></h3><p class="hint">Trag ein, was während dieser Übung gleichzeitig im Einsatz ist, z. B. 2 Leibchen-Sätze für 2 Teams. Im Training zählt nicht die Summe aller Übungen, sondern der höchste gleichzeitige Bedarf – laufen Übungen parallel, werden sie zusammengezählt.</p>${hasBm?`<p class="hint">In der Skizze: ${Object.entries(bm).map(([k,n])=>`${matLabel(k)} ${n}`).join(", ")}. <button class="btn sm" data-act="matFromBoard">Übernehmen</button></p>`:""}
   <div class="matgrid">${matList().map(([k,l])=>`<label class="f">${esc(l)}<input type="number" min="0" data-key="m-${k}" data-mat="${k}" value="${esc(e.material[k]||"")}"></label>`).join("")}</div></section>
  <div class="row-actions">${S.ui.backTo?'<button class="btn pri" data-act="backTraining">Zurück zum Training</button>':""}<button class="btn" data-act="dupEx">Kopieren</button><button class="btn" data-act="shareEx">An Trainer teilen</button>${e.archiviert?'<button class="btn" data-act="exRestore">Wiederherstellen</button><button class="btn ghost danger" data-act="exDelFinal">Endgültig löschen</button>':'<button class="btn ghost" data-act="exArch">Archivieren</button>'}</div>`;
}
/* Bild verkleinern: längste Seite höchstens 1200 px, JPEG; wird zu groß, Qualität schrittweise senken (Ziel < 250 KB). */
async function bildVerkleinern(file){
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("Bild nicht lesbar"));i.src=url;});
    const f=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));const w=Math.round(img.naturalWidth*f),h=Math.round(img.naturalHeight*f);
    const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);
    let q=.78,data=c.toDataURL("image/jpeg",q);while(data.length*.75>250*1024&&q>.4){q-=.1;data=c.toDataURL("image/jpeg",q);}
    return {data,w,h};}finally{URL.revokeObjectURL(url);}
}
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el||S.view!=="uebungen")return;const a=el.dataset.act;const ex=S.uebungen[S.sel.uebung];
  const save=()=>{saveLater("uebung",S.sel.uebung);render();};
  if(a==="exFavF"){S.ui.nurFav=!S.ui.nurFav;render();return;}
  if(a==="exArchF"){S.ui.archiv=!S.ui.archiv;S.sel.uebung=null;render();return;}
  if(!ex)return;
  if(a==="exFav"){ex.favorit=!ex.favorit;save();}
  if(a==="varAdd"){ex.varianten=[...(ex.varianten||[]),{id:uid(),name:"",text:""}];save();}
  if(a==="varDel"){const v=ex.varianten[+el.dataset.i];if((v.name||v.text)&&!confirmDel(`Variante „${v.name||"ohne Namen"}“ entfernen?`))return;ex.varianten.splice(+el.dataset.i,1);save();}
  if(a==="exBildDel"){if(!confirmDel("Bild entfernen?"))return;delete ex.bild;save();}
  if(a==="exArch"){ex.archiviert=true;ex.favorit=false;saveLater("uebung",S.sel.uebung);S.sel.uebung=null;render();toast("Archiviert – bleibt in alten Trainings erhalten");}
  if(a==="exRestore"){delete ex.archiviert;save();toast("Wiederhergestellt");}
  if(a==="exDelFinal"){const used=Object.values(S.trainings).filter(t=>(t.ablauf||[]).some(s=>s.uebungId===S.sel.uebung)).length;
    if(!confirmDel(`„${ex.name||"Übung"}“ endgültig löschen?${used?`\n\nSie steckt in ${used} Training${used>1?"s":""}. Dort bleiben Name und Schwerpunkte erhalten, Skizze und Texte gehen verloren.`:""}\n\nDas lässt sich nicht rückgängig machen.`))return;
    removeDoc("uebung",S.sel.uebung);S.sel.uebung=null;render();toast("Gelöscht");}
});
$("#app").addEventListener("change",async e=>{const el=e.target;if(S.view!=="uebungen")return;const ex=S.uebungen[S.sel.uebung];if(!ex)return;const a=el.dataset.act;
  if(a==="varF"){const v=ex.varianten[+el.dataset.i];if(v){v[el.dataset.f]=el.value.trim();saveLater("uebung",S.sel.uebung);}}
  if(a==="exVideo"){const v=el.value.trim();if(v&&!/^https?:\/\/\S+$/i.test(v)){toast("Bitte einen Link mit https:// eingeben.");el.value=ex.video||"";return;}ex.video=v;saveLater("uebung",S.sel.uebung);render();}
  if(a==="exBild"){const f=el.files&&el.files[0];el.value="";if(!f)return;if(!/^image\//.test(f.type)){toast("Bitte eine Bilddatei wählen.");return;}
    try{setStatus("Bild wird verkleinert …");ex.bild=await bildVerkleinern(f);saveLater("uebung",S.sel.uebung);render();toast("Bild gespeichert");}catch(err){toast("Das Bild konnte nicht gelesen werden.");}}
});

