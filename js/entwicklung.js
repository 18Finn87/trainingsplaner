"use strict";
/* ---------- Spielerentwicklung (Datenversion 11) ----------
   Gespeichert an der Spielerin im Kader (kader:<mannschaft>), damit Sicherung, Mannschafts-Export und Sync es automatisch mitnehmen:
   p.entwicklung = {
     ziele:        [{id,text,haupt,bis,erreicht}]        Entwicklungsziele (optional mit Hauptschwerpunkt und Zieldatum)
     staerken:     [{id,text,quelle}]                    Stärken
     felder:       [{id,text,haupt,tag,quelle}]          Entwicklungsfelder (Haupt-/Nebenschwerpunkt für Trainingszeit und Übungsvorschläge)
     empfehlungen: [{id,text,uebung}]                    Trainingsempfehlungen (optional mit Übung aus der Bibliothek)
     bewertungen:  [{id,datum,werte:{kriterium:1–5},notiz}]  gelegentliche Bewertung, ergibt den Verlauf
   }  quelle = {spiel,punkt}, wenn der Eintrag aus einer Spielbeobachtung übernommen wurde. */
const ENT_LISTEN=["ziele","staerken","felder","empfehlungen","bewertungen"];
function ent(p){const e=p.entwicklung=p.entwicklung||{};ENT_LISTEN.forEach(k=>{if(!Array.isArray(e[k]))e[k]=[];});return e;}
const kriterien=()=>S.settings.bewertungskriterien=S.settings.bewertungskriterien||DEF_KRIT.slice();
const hauptOpts=v=>opt([["","kein Hauptschwerpunkt"],...(S.settings.schwerpunkte||[]).map(x=>[x,x]),...(v&&!(S.settings.schwerpunkte||[]).includes(v)?[[v,v]]:[])],v||"");
const tagOpts=v=>opt([["","kein Thema"],...(S.settings.tags||[]).map(x=>[x,x]),...(v&&!(S.settings.tags||[]).includes(v)?[[v,v]]:[])],v||"");

/* Trainingsbeteiligung der Saison (und letzte 4 Wochen) – dieselbe Rechnung wie in der Statistik. */
function entTrainings(von){const h=today();return ofTeam("trainings").filter(([,t])=>t.durchgefuehrt&&t.datum&&t.datum>=von&&t.datum<=h);}
function entStats(p){
  const sv=saisonVon(new Date()),tr=entTrainings(sv),tr4=entTrainings(dayShift(today(),-27));
  const st=spielerStats(tr,p.id),st4=spielerStats(tr4,p.id);
  const ps=players();const team={};ps.forEach(q=>{const m=spielerStats(tr,q.id).m;Object.entries(m).forEach(([k,v])=>team[k]=(team[k]||0)+v);});
  Object.keys(team).forEach(k=>team[k]=team[k]/Math.max(ps.length,1));
  return {tr,st,st4,team,n4:tr4.length};
}
/* Spielbeobachtungen, bei denen die Spielerin zugeordnet ist (Phase 6). */
function entPunkte(p){const out=[];ofTeam("spiele").forEach(([sid,s])=>(s.punkte||[]).forEach(q=>{if((q.spielerinnen||[]).includes(p.id))out.push({sid,s,q});}));
  return out.sort((a,b)=>(b.s.datum||"").localeCompare(a.s.datum||""));}
const hatQuelle=(arr,sid,pid)=>arr.some(x=>x.quelle&&x.quelle.spiel===sid&&x.quelle.punkt===pid);

/* kleine Verlaufslinie für ein Bewertungskriterium (1–5) */
function spark(vals){const v=vals.filter(x=>x.w);if(!v.length)return '<span class="src">–</span>';const W=120,H=30,n=v.length;
  const xs=i=>n===1?W/2:4+i*(W-8)/(n-1),ys=w=>H-4-(w-1)*(H-8)/4;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><line x1="0" x2="${W}" y1="${ys(3)}" y2="${ys(3)}" class="mid"/>
    ${n>1?`<polyline points="${v.map((x,i)=>`${xs(i)},${ys(x.w)}`).join(" ")}"/>`:""}${v.map((x,i)=>`<circle cx="${xs(i)}" cy="${ys(x.w)}" r="3"/>`).join("")}</svg>`;}

function entwicklungTab(p){
  const e=ent(p);const {tr,st,st4,team,n4}=entStats(p);const kr=kriterien();
  const zeile=(liste,x,inner)=>`<div class="erow">${inner}<button class="iconbtn" data-act="enDel" data-id="${p.id}" data-l="${liste}" data-x="${x.id}" aria-label="Eintrag löschen">✕</button></div>`;
  const txt=(liste,x,ph)=>`<input class="inp" data-key="en-${x.id}" data-act="enF" data-id="${p.id}" data-l="${liste}" data-x="${x.id}" data-f="text" value="${esc(x.text||"")}" placeholder="${ph}">`;
  const neu=(liste,ph)=>`<div class="addpt"><input class="inp" data-key="ennew-${liste}" data-act="enNew" data-id="${p.id}" data-l="${liste}" placeholder="${ph}"><button class="btn" data-act="enAdd" data-id="${p.id}" data-l="${liste}">Hinzufügen</button></div>`;
  const quelle=x=>{if(!x.quelle)return "";const s=S.spiele[x.quelle.spiel];return s?`<button type="button" class="plink src" data-act="pSp" data-id="${x.quelle.spiel}">aus Spiel gegen ${esc(s.gegner||"?")}${s.datum?`, ${esc(kurzDatum(s.datum))}`:""}</button>`:"";};
  /* Ziele: offene zuerst */
  const ziele=e.ziele.slice().sort((a,b)=>(!!a.erreicht-!!b.erreicht));
  const zielHtml=ziele.map(x=>zeile("ziele",x,`<button type="button" class="chip tag zielok" data-act="enOk" data-id="${p.id}" data-x="${x.id}" aria-pressed="${!!x.erreicht}" aria-label="Erreicht">${x.erreicht?"✓ erreicht":"offen"}</button>
    <div class="ecol${x.erreicht?" done":""}">${txt("ziele",x,"Ziel, z. B. schwächeren Fuß im Passspiel nutzen")}
    <div class="emeta"><select class="inp" data-key="enh-${x.id}" data-act="enF" data-id="${p.id}" data-l="ziele" data-x="${x.id}" data-f="haupt" aria-label="Hauptschwerpunkt">${hauptOpts(x.haupt)}</select>
     <label class="f inl">bis<input type="date" data-key="enb-${x.id}" data-act="enF" data-id="${p.id}" data-l="ziele" data-x="${x.id}" data-f="bis" value="${esc(x.bis||"")}"></label>
     ${x.bis&&!x.erreicht&&x.bis<today()?'<span class="ewarn">Datum überschritten</span>':""}</div></div>`)).join("");
  const staerkeHtml=e.staerken.map(x=>zeile("staerken",x,`<div class="ecol">${txt("staerken",x,"Stärke")}${quelle(x)}</div>`)).join("");
  /* Entwicklungsfelder mit Trainingszeit und Übungsvorschlägen */
  const feldHtml=e.felder.map(x=>{const k=x.haupt;const vs=uebVorschlaege({haupt:x.haupt,tag:x.tag});const open=S.ui.open["env"+x.id];
    const zeit=k?`<p class="legend etime">${swatch(k)}<b>${esc(k)}</b>: ${fmtMin(st4.m[k]||0)} in den letzten 4 Wochen (${n4} Training${n4===1?"":"s"}) · Saison ${fmtMin(st.m[k]||0)} · Team-Ø ${fmtMin(team[k]||0)}${(team[k]||0)>0&&(st.m[k]||0)<(team[k]||0)*0.75?' <span class="ewarn">unter dem Schnitt</span>':""}</p>`:'<p class="legend etime">Hauptschwerpunkt wählen, dann siehst du hier, wie viel sie dazu trainiert hat.</p>';
    return zeile("felder",x,`<div class="ecol">${txt("felder",x,"Entwicklungsfeld, z. B. Kopfballspiel")}
      <div class="emeta"><select class="inp" data-key="enfh-${x.id}" data-act="enF" data-id="${p.id}" data-l="felder" data-x="${x.id}" data-f="haupt" aria-label="Hauptschwerpunkt">${hauptOpts(x.haupt)}</select>
       <select class="inp" data-key="enft-${x.id}" data-act="enF" data-id="${p.id}" data-l="felder" data-x="${x.id}" data-f="tag" aria-label="Thema">${tagOpts(x.tag)}</select></div>
      ${zeit}${quelle(x)}
      ${x.haupt||x.tag?`<button type="button" class="btn sm ghost" data-act="enVors" data-x="${x.id}" aria-expanded="${!!open}">Passende Übungen${vs.length?` (${vs.length})`:""}</button>
      ${open?(vs.length?`<ul class="evors">${vs.map(v=>`<li><span><b>${esc(exName(v.e))}</b> <span class="src">${esc(v.why)}</span></span>${e.empfehlungen.some(r=>r.uebung===v.id)?'<span class="ok">empfohlen</span>':`<button class="btn sm" data-act="enEmpf" data-id="${p.id}" data-u="${v.id}">Empfehlen</button>`}</li>`).join("")}</ul>`:'<p class="hint">Keine passende Übung in der Bibliothek.</p>'):""}`:""}</div>`);}).join("");
  const ueOpts=v=>opt([["","keine bestimmte Übung"],...Object.entries(S.uebungen).filter(([id,u])=>!u.archiviert||id===v).sort((a,b)=>exName(a[1]).localeCompare(exName(b[1]))).map(([id,u])=>[id,exName(u)])],v||"");
  const empfHtml=e.empfehlungen.map(x=>zeile("empfehlungen",x,`<div class="ecol">${txt("empfehlungen",x,"Empfehlung, z. B. 10 min Zusatz Torschuss links")}
    <div class="emeta"><select class="inp" data-key="enu-${x.id}" data-act="enF" data-id="${p.id}" data-l="empfehlungen" data-x="${x.id}" data-f="uebung" aria-label="Übung">${ueOpts(x.uebung)}</select>
    ${x.uebung&&S.uebungen[x.uebung]?`<button type="button" class="btn sm ghost" data-act="enUeb" data-u="${x.uebung}">Übung öffnen</button>`:x.uebung?'<span class="src">Übung gelöscht</span>':""}</div></div>`)).join("");
  /* Bewertungen */
  const bw=e.bewertungen.slice().sort((a,b)=>(a.datum||"").localeCompare(b.datum||""));
  const verlauf=kr.map(k=>{const vals=bw.map(b=>({w:num((b.werte||{})[k]),d:b.datum}));const v=vals.filter(x=>x.w);const last=v[v.length-1],prev=v[v.length-2];
    const d=last&&prev?last.w-prev.w:0;
    return `<div class="bwrow"${tipAttr(`${k}: ${v.map(x=>`${kurzDatum(x.d)} → ${x.w}`).join(", ")||"noch nicht bewertet"}`)}><span class="hl">${esc(k)}</span>${spark(vals)}<span class="bwv"><b>${last?last.w:"–"}</b>${d?`<span class="${d>0?"ok":"ewarn"}">${d>0?"▲":"▼"}${Math.abs(d)}</span>`:""}</span></div>`;}).join("");
  const bwList=bw.slice().reverse().map(b=>`<li><b>${esc(fmtDate(b.datum))}</b><span>${kr.filter(k=>num((b.werte||{})[k])).map(k=>`${esc(k)} ${num(b.werte[k])}`).join(" · ")||'<span class="src">ohne Werte</span>'}${b.notiz?`<br><span class="src">${esc(b.notiz)}</span>`:""}</span>
    <span class="ctl"><button class="btn sm ghost" data-act="bwEdit" data-id="${p.id}" data-x="${b.id}">Ändern</button></span></li>`).join("");
  /* Spielanalyse */
  const pk=entPunkte(p);const nPlus=pk.filter(x=>x.q.art==="plus").length,nMinus=pk.filter(x=>x.q.art==="minus").length;
  const mk={};pk.filter(x=>x.q.art==="minus").forEach(x=>merkmale(x.q).forEach(m=>{mk[m]=mk[m]||new Set();mk[m].add(x.sid);}));
  const wieder=Object.entries(mk).filter(([,s])=>s.size>=2);
  const pkHtml=pk.map(({sid,s,q})=>{const art=q.art||"info";const ueb=art==="plus"?hatQuelle(e.staerken,sid,q.id):hatQuelle(e.felder,sid,q.id);
    return `<li><span class="art sm" data-a="${art}" aria-label="${ARTN[art]}">${ARTL[art]}</span><span><b>${esc(q.text||"(ohne Text)")}</b><br><button type="button" class="plink src" data-act="pSp" data-id="${sid}">${esc(kurzDatum(s.datum)||"ohne Datum")} · ${esc(s.gegner||"Gegner offen")}</button>${merkmale(q).length?` <span class="src">· ${esc(merkmale(q).join(" · "))}</span>`:""}</span>
      <span class="ctl">${ueb?'<span class="ok">übernommen</span>':art==="plus"?`<button class="btn sm" data-act="enVonSpiel" data-id="${p.id}" data-s="${sid}" data-q="${q.id}" data-l="staerken">Als Stärke</button>`:`<button class="btn sm" data-act="enVonSpiel" data-id="${p.id}" data-s="${sid}" data-q="${q.id}" data-l="felder">Als Entwicklungsfeld</button>`}</span></li>`;}).join("");
  const ord=hauptOrder(st.m).filter(k=>st.m[k]||team[k]);const max=Math.max(...ord.map(k=>Math.max(st.m[k]||0,team[k]||0)),1);
  const offen=e.ziele.filter(x=>!x.erreicht).length;
  return `<section class="blk"><h3>Entwicklungsziele <span class="sub">${offen} offen${e.ziele.length-offen?`, ${e.ziele.length-offen} erreicht`:""}</span></h3>
    ${zielHtml||'<p class="hint">Noch keine Ziele. Ein Ziel sollte konkret und überprüfbar sein.</p>'}${neu("ziele","Neues Ziel, Enter fügt hinzu")}</section>
  <div class="egrid"><section class="blk"><h3>Stärken</h3>${staerkeHtml||'<p class="hint">Noch keine Stärken eingetragen.</p>'}${neu("staerken","Neue Stärke")}</section>
  <section class="blk"><h3>Entwicklungsfelder</h3>${feldHtml||'<p class="hint">Woran soll sie arbeiten? Mit Hauptschwerpunkt siehst du direkt die Trainingszeit dazu und passende Übungen.</p>'}${neu("felder","Neues Entwicklungsfeld")}</section></div>
  <section class="blk"><h3>Trainingsempfehlungen</h3>${empfHtml||'<p class="hint">Noch keine Empfehlungen. Du kannst sie auch über „Passende Übungen“ bei einem Entwicklungsfeld hinzufügen.</p>'}${neu("empfehlungen","Neue Empfehlung")}</section>
  <section class="blk"><h3>Bewertung <span class="sub">${bw.length?`${bw.length} Bewertung${bw.length===1?"":"en"} · zuletzt ${esc(kurzDatum(bw[bw.length-1].datum))}`:"noch keine"}</span></h3>
    <p class="hint">Gelegentlich, z. B. alle paar Wochen: 1 = schwach, 3 = ordentlich, 5 = sehr stark. Die Kriterien pflegst du in den Einstellungen.</p>
    ${bw.length?`<div class="bwgrid">${verlauf}</div>`:""}
    <div class="row-actions"><button class="btn pri" data-act="bwNew" data-id="${p.id}">Neue Bewertung</button></div>
    ${bw.length?`<details class="fold" data-dkey="bwl-${p.id}"${S.ui.open["dbwl"+p.id]?" open":""}><summary>Alle Bewertungen</summary><ul class="hist bwl">${bwList}</ul></details>`:""}</section>
  <section class="blk"><h3>Trainingsbeteiligung <span class="sub">Saison: ${st.ja} von ${tr.length} Trainings (${st.pc} %) · ${fmtMin(st.min)}</span></h3>
    ${ord.length?`<p class="legend" style="margin-top:0">Minuten je Hauptschwerpunkt – Balken: sie, Strich: Team-Durchschnitt</p><div class="hbars">${ord.map(k=>`<div class="hrow"${tipAttr(`${k}: ${fmtMin(st.m[k]||0)} · Team-Ø ${fmtMin(team[k]||0)}`)}><span class="hl">${swatch(k)}${esc(k)}</span><span class="hb tm"><i style="width:${(st.m[k]||0)/max*100}%;background:${hauptCol(k)}"></i><s style="left:${(team[k]||0)/max*100}%"></s></span><span class="hv"><b>${fmtMin(st.m[k]||0)}</b></span></div>`).join("")}</div>`:'<p class="hint">In dieser Saison noch keine durchgeführten Trainings.</p>'}
    <div class="row-actions"><button class="btn sm ghost" data-act="enStat" data-id="${p.id}">In der Statistik ansehen</button></div></section>
  <section class="blk"><h3>Aus der Spielanalyse <span class="sub">${pk.length?`${nPlus} positiv, ${nMinus} negativ`:"keine Beobachtungen"}</span></h3>
    ${wieder.length?`<p class="warnbox">Wiederkehrend: ${wieder.map(([m,s])=>`${esc(m)} (${s.size} Spiele)`).join(" · ")}</p>`:""}
    ${pkHtml?`<ul class="hist epk">${pkHtml}</ul>`:'<p class="hint">Ordne im Spielbericht bei einer Beobachtung unter „Details“ Spielerinnen zu – dann erscheint sie hier.</p>'}</section>`;
}

/* Fenster „Bewertung“: Datum, je Kriterium 1–5 (oder leer lassen), Notiz */
function openBewertung(pid,bid){
  const p=pById(pid);if(!p)return;const e=ent(p);const b=e.bewertungen.find(x=>x.id===bid)||{datum:today(),werte:{},notiz:""};
  S.ui.bwTmp={pid,bid:bid||null,werte:Object.assign({},b.werte)};
  const kr=kriterien();const all=[...kr,...Object.keys(b.werte||{}).filter(k=>!kr.includes(k))];
  $("#overlay").innerHTML=`<div class="ov" data-act="closeOv"><div class="panel" role="dialog" aria-modal="true" aria-label="Bewertung"><h3>Bewertung: ${esc(p.name)} <button class="iconbtn" data-act="closeOv" aria-label="Schließen">✕</button></h3>
    <label class="f">Datum<input type="date" id="bwDatum" value="${esc(b.datum||today())}"></label>
    <div class="bwin">${all.map(k=>`<div class="bwk"><span>${esc(k)}</span><div class="seg bwseg" role="radiogroup" aria-label="${esc(k)}">${[1,2,3,4,5].map(n=>`<button type="button" role="radio" aria-checked="${num(S.ui.bwTmp.werte[k])===n}" data-act="bwSet" data-k="${esc(k)}" data-v="${n}">${n}</button>`).join("")}</div></div>`).join("")}</div>
    <p class="legend">Nochmal auf denselben Wert tippen lässt das Kriterium leer.</p>
    <label class="f" style="margin-top:10px">Notiz (optional)<textarea class="inp" id="bwNotiz" rows="2">${esc(b.notiz||"")}</textarea></label>
    <div class="row-actions"><button class="btn pri" data-act="bwSave">Speichern</button>${bid?'<button class="btn ghost danger" data-act="bwDel">Bewertung löschen</button>':""}</div></div></div>`;
}
$("#overlay").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act,tmp=S.ui.bwTmp;if(!tmp)return;
  if(a==="bwSet"){const k=el.dataset.k,v=+el.dataset.v;if(num(tmp.werte[k])===v)delete tmp.werte[k];else tmp.werte[k]=v;
    el.parentElement.querySelectorAll("button").forEach(b=>b.setAttribute("aria-checked",String(num(tmp.werte[k])===+b.dataset.v)));}
  const p=pById(tmp.pid);if(!p)return;const en=ent(p);
  if(a==="bwSave"){const val={datum:$("#bwDatum").value||today(),werte:tmp.werte,notiz:$("#bwNotiz").value.trim()};
    if(!Object.keys(val.werte).length&&!val.notiz){toast("Bitte mindestens ein Kriterium bewerten.");return;}
    const b=en.bewertungen.find(x=>x.id===tmp.bid);if(b)Object.assign(b,val);else en.bewertungen.push(Object.assign({id:uid()},val));
    saveLater("kader");S.ui.bwTmp=null;$("#overlay").innerHTML="";render();toast("Bewertung gespeichert");}
  if(a==="bwDel"){if(!confirmDel("Diese Bewertung löschen?"))return;en.bewertungen=en.bewertungen.filter(x=>x.id!==tmp.bid);saveLater("kader");S.ui.bwTmp=null;$("#overlay").innerHTML="";render();toast("Gelöscht");}
});
function enAdd(pid,liste){const p=pById(pid);if(!p)return;const inp=$(`[data-act="enNew"][data-l="${liste}"]`);const v=(inp&&inp.value||"").trim();if(!v)return;
  const x={id:uid(),text:v};if(liste==="ziele")Object.assign(x,{haupt:"",bis:"",erreicht:false});if(liste==="felder")Object.assign(x,{haupt:"",tag:""});if(liste==="empfehlungen")x.uebung="";
  ent(p)[liste].push(x);saveLater("kader");render();$(`[data-act="enNew"][data-l="${liste}"]`)?.focus();}
$("#app").addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
  if(a==="pTab"){S.ui.pTab=el.dataset.v;render();return;}
  if(a==="enVors"){S.ui.open["env"+el.dataset.x]=!S.ui.open["env"+el.dataset.x];render();return;}
  if(a==="enUeb"){S.view="uebungen";S.sel.uebung=el.dataset.u;S.ui.backTo=null;render();window.scrollTo(0,0);return;}
  if(a==="enStat"){S.view="statistik";S.ui.stTab="spielerinnen";S.ui.stP=el.dataset.id;render();setTimeout(()=>$("#stDetail")?.scrollIntoView({block:"start"}),0);return;}
  const p=pById(el.dataset.id);if(!p)return;const en=ent(p);
  if(a==="bwNew")openBewertung(p.id,null);
  if(a==="bwEdit")openBewertung(p.id,el.dataset.x);
  if(a==="enAdd")enAdd(p.id,el.dataset.l);
  if(a==="enDel"){const l=el.dataset.l,x=en[l].find(y=>y.id===el.dataset.x);if(!x)return;if(x.text&&!confirmDel(`„${x.text}“ löschen?`))return;en[l]=en[l].filter(y=>y!==x);saveLater("kader");render();}
  if(a==="enOk"){const x=en.ziele.find(y=>y.id===el.dataset.x);if(x){x.erreicht=!x.erreicht;saveLater("kader");render();if(x.erreicht)toast("Ziel erreicht 🎉");}}
  if(a==="enEmpf"){const u=S.uebungen[el.dataset.u];if(!u)return;en.empfehlungen.push({id:uid(),text:exName(u),uebung:el.dataset.u});saveLater("kader");render();toast("Als Empfehlung eingetragen");}
  if(a==="enVonSpiel"){const s=S.spiele[el.dataset.s];const q=s&&(s.punkte||[]).find(y=>y.id===el.dataset.q);if(!q)return;const l=el.dataset.l;
    const x={id:uid(),text:(q.text||"").trim()||"Beobachtung aus dem Spiel",quelle:{spiel:el.dataset.s,punkt:q.id}};if(l==="felder")Object.assign(x,{haupt:q.haupt||"",tag:q.tag||""});
    en[l].push(x);saveLater("kader");render();toast(l==="felder"?"Als Entwicklungsfeld übernommen":"Als Stärke übernommen");}
});
$("#app").addEventListener("change",e=>{const el=e.target;if(el.dataset.act!=="enF")return;const p=pById(el.dataset.id);if(!p)return;
  const x=(ent(p)[el.dataset.l]||[]).find(y=>y.id===el.dataset.x);if(!x)return;const f=el.dataset.f,v=el.value.trim();
  if(f==="text"&&!v){el.value=x.text||"";return;}x[f]=v;saveLater("kader");if(f!=="text")render();});
$("#app").addEventListener("keydown",e=>{if(e.key!=="Enter")return;const el=e.target;
  if(el.dataset.act==="enNew"){e.preventDefault();enAdd(el.dataset.id,el.dataset.l);}
  if(el.dataset.act==="enF"&&el.tagName==="INPUT"){e.preventDefault();el.blur();}});
