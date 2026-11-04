/* Service Worker: hält die App auf dem Gerät vor, damit sie ohne Internet startet.
   Deine Daten liegen NICHT hier, sondern in der Datenbank des Browsers (IndexedDB).
   Strategie: erst beim Server fragen (damit Updates sofort ankommen); antwortet er nicht
   innerhalb von 3 Sekunden oder gibt es kein Netz, kommt die gespeicherte Version. */
const CACHE="trainingsplaner-v3";
const FILES=["./","index.html","css/app.css","manifest.webmanifest",
  "js/basis.js","js/speicher.js","js/berechnung.js","js/tafel.js","js/ansicht.js",
  "js/training.js","js/uebungen.js","js/spiele.js","js/kader.js","js/einstellungen.js","js/statistik.js","js/teilen.js","js/konfig.js","js/sync.js","js/app.js",
  "icons/icon.svg","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png"];
const FONTS=["fonts.googleapis.com","fonts.gstatic.com"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:"reload"})))).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(FONTS.includes(url.hostname)){
    // Schriften ändern sich nie: einmal holen, dann immer aus dem Zwischenspeicher.
    e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(req);if(hit)return hit;
      try{const res=await fetch(req);if(res.ok||res.type==="opaque")c.put(req,res.clone());return res;}catch(err){return new Response("",{status:504});}}));
    return;
  }
  if(url.origin!==location.origin)return;
  const key=req.mode==="navigate"?"index.html":req;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const net=fetch(req,{cache:"no-store"}).then(res=>{if(res.ok&&res.type==="basic")c.put(key,res.clone());return res.ok?res:null;}).catch(()=>null);
    const timeout=new Promise(r=>setTimeout(()=>r(null),3000));
    const fresh=await Promise.race([net,timeout]);
    if(fresh)return fresh;
    const hit=await c.match(key,{ignoreSearch:true});if(hit){e.waitUntil(net);return hit;}
    return (await net)||new Response("Offline und noch nicht zwischengespeichert.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
  }));
});
