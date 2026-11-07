"use strict";
/* ---------- Farbe je Mannschaft (Datenversion 13) ----------
   teams.list[].farbe = Hauptfarbe (#RRGGBB). Daraus werden die Akzent-Töne berechnet und so angepasst, dass
   Schrift und Knöpfe lesbar bleiben (Kontrast nach WCAG): auf Schwarz mindestens 3:1 für Linien/Text-Akzente,
   auf Weiß mindestens 4,5:1, Knopf-Schrift (weiß oder schwarz) mindestens 4,5:1. */
const STANDARD_FARBE="#2F80ED";
const FARB_VORLAGEN=[["#2F80ED","Blau"],["#2E9E5B","Grün"],["#D64545","Rot"],["#E8833A","Orange"],["#E2B42A","Gelb"],["#7D5BD6","Lila"],["#1FA5A5","Türkis"],["#D6487E","Pink"],["#8C8C8C","Grau"]];
const istFarbe=v=>/^#[0-9a-f]{6}$/i.test(v||"");
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const rgbHex=c=>"#"+c.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,"0")).join("").toUpperCase();
const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*r+.7152*g+.0722*b;};
const kontrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const mische=(c,ziel,t)=>c.map((v,i)=>v+(ziel[i]-v)*t);
/* so wenig wie möglich aufhellen/abdunkeln, bis der Kontrast reicht */
function bisKontrast(c,hinter,min,richtung){const ziel=richtung==="hell"?[255,255,255]:[0,0,0];
  for(let t=0;t<=1.0001;t+=.04){const x=mische(c,ziel,t);if(kontrast(x,hinter)>=min)return x;}return ziel;}
function farbToene(hex){
  const c=hexRgb(istFarbe(hex)?hex:STANDARD_FARBE);const SCHWARZ=[13,13,13],KARTE=[26,26,26],WEISS=[255,255,255];
  const akzent=bisKontrast(c,KARTE,3,"hell");                                  // Linien/Schrift auf Dunkel
  let flaeche=c,ink=WEISS;                                                       // gefüllte Knöpfe im Dunkelmodus
  if(kontrast(WEISS,c)<4.5){if(kontrast(SCHWARZ,c)>=7)ink=SCHWARZ;else flaeche=bisKontrast(c,WEISS,4.5,"dunkel");}
  const hell=bisKontrast(c,WEISS,4.5,"dunkel");                                  // Hellmodus: Text und Knöpfe mit weißer Schrift
  return {akzent:rgbHex(akzent),flaeche:rgbHex(flaeche),ink:rgbHex(ink),hell:rgbHex(hell),rgb:c};
}
let farbeAktiv=null;
function farbeAnwenden(){
  const hex=(typeof teamCfg==="function"&&S.teamsDoc&&teamCfg().farbe)||STANDARD_FARBE;if(hex===farbeAktiv)return;farbeAktiv=hex;
  const f=farbToene(hex),st=document.documentElement.style;
  st.setProperty("--farbe-akzent",f.akzent);st.setProperty("--farbe-akzent-flaeche",f.flaeche);st.setProperty("--farbe-akzent-hell",f.hell);
  st.setProperty("--farbe-ink",f.ink);st.setProperty("--farbe-ink-hell","#FFFFFF");
}
/* Auswahl in den Einstellungen (je Mannschaft) */
function farbWahl(t){
  const akt=(t.farbe||STANDARD_FARBE).toUpperCase();const f=farbToene(akt);
  return `<div class="farbwahl"><span class="lsuse">Farbe</span>
    ${FARB_VORLAGEN.map(([h,n])=>`<button type="button" class="fswatch${akt===h.toUpperCase()?" an":""}" style="background:${h}" data-act="tmFarbe" data-id="${esc(t.id)}" data-v="${h}" aria-label="${n}" aria-pressed="${akt===h.toUpperCase()}" title="${n}"></button>`).join("")}
    <label class="fswatch frei" title="Eigene Farbe wählen" style="background:${akt}"><input type="color" data-act="tmSet" data-f="farbe" data-id="${esc(t.id)}" value="${akt.toLowerCase()}" aria-label="Eigene Farbe wählen"><span aria-hidden="true">＋</span></label>
    <span class="fvorschau" aria-hidden="true"><i style="background:${f.flaeche};color:${f.ink}">Knopf</i><i style="color:${f.akzent};border-color:${f.akzent}">Akzent</i></span></div>`;
}
