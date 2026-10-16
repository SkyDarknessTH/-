/* Service Worker — app-shell cache only (no private data / backups are ever cached).
   To ship a new version: change index.html, bump VERSION (and APP_VERSION in index.html). Users get an "update available" banner;
   IndexedDB data is never touched by cache updates. */
const VERSION='2.7.1';
const CACHE='tft12w-v'+VERSION;
const ASSETS=['./','./index.html','./manifest.webmanifest','./apple-touch-icon.png','./icon-192.png','./icon-512.png'];
const SHELL=new Set(ASSETS.map(a=>new URL(a,self.location).pathname));
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));}); /* no skipWaiting: the user chooses when to update */
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('tft12w-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url);if(u.origin!==location.origin)return;
  if(!(SHELL.has(u.pathname)||req.mode==='navigate'))return; /* everything else: straight to network, never cached */
  e.respondWith(caches.open(CACHE).then(c=>c.match(req.mode==='navigate'?'./index.html':req,{ignoreSearch:true})).then(hit=>hit||fetch(req).catch(()=>req.mode==='navigate'?caches.match('./index.html'):new Response('',{status:504}))));
});
