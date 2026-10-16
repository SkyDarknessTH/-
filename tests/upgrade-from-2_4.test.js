/* Upgrade check: data/profile created by the real v2.4.0 build must survive in the current build,
   and single-lift grind plans must be identical day-by-day (except pull-up starting from 0, which now has the foundation phase).
   Run: NODE_PATH=$(npm root -g) node tests/upgrade-from-2_4.test.js */
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),OLD=path.join(__dirname,'fixtures','v2.4.0-index.html');
let useOld=true;
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';
 if(p==='/index.html'&&useOld){r.writeHead(200,{'Content-Type':'text/html'});return r.end(fs.readFileSync(OLD));}
 if(p==='/sw.js'&&useOld){r.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-cache'});return r.end(fs.readFileSync(path.join(__dirname,'fixtures','v2.4.0-sw.js')));}
 const f=path.join(root,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}
 const t={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(f)]||'text/plain';r.writeHead(200,{'Content-Type':t});r.end(fs.readFileSync(f));}).listen(8794);
let fail=0;const ck=(n,ok,x)=>{console.log((ok?'PASS ':'FAIL ')+n+(ok?'':' '+JSON.stringify(x||'').slice(0,400)));if(!ok)fail++;};
const CASES=[['pushup',{pushup:20},45,{bar:true,band:true},120],['pullup',{pullup:2},8,{bar:true,band:true},90],['pullup',{pullup:4},10,{bar:false,band:false},45],['plank',{plank:60},180,{bar:true,band:false},90],['pushup',{pushup:5},25,{bar:true,band:true},45]];
const PLAN=`(cases)=>cases.map(([lift,base,tgt,eq,mins])=>{const e=grindEstimate(lift,base[lift],tgt,'fast');
 S.profile={start:mondayOf(today()),baseline:Object.assign({pushup:15,pullup:0,plank:60,run:600},base),goals:{},durationDays:e.days,priority:'grind',grind:{lift,pace:'fast',pm:e.pm,cur:base[lift]},minutesPerDay:mins,equipment:eq};
 const plan=buildPlan(),out=[];for(let n=0;n<e.days;n++){const d=plan[Math.floor(n/7)].days[n%7];out.push([d.title,d.items.map(i=>[i.exId,i.sets,i.reps,i.secs,i.rest,i.note,i.assist,JSON.stringify(i.custom)])]);}return JSON.stringify(out);})`;
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:375,height:700},serviceWorkers:'block'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
/* 1. old build: create a grind profile via the UI + a measured test, remember data */
await pg.goto('http://localhost:8794/');await pg.waitForTimeout(800);
ck('fixture is really v2.4.0',await pg.evaluate(()=>APP_VERSION==='2.4.0'));
await pg.selectOption('#s_priority','grind');await pg.fill('#b_pushup','20');await pg.fill('#g_pushup','45');await pg.fill('#b_pullup','2');await pg.fill('#b_plank','1:00');await pg.fill('#b_run','12:00');
await pg.click('[data-act=setupSave]');await pg.waitForTimeout(700);
await pg.evaluate(async()=>{const t={id:uid(),cat:'pushup',date:nowDT(),value:27,place:'',note:'old-build test',rpe:null,pain:'',source:'test',basis:'measured',std:true,createdAt:Date.now()};S.tests.push(t);await saveTest(t);});
const before=await pg.evaluate(()=>({tests:S.tests.length,dur:S.profile.durationDays,pm:S.profile.grind.pm,lift:S.profile.grind.lift,plan:JSON.stringify(S.plan.map(w=>w.days.map(d=>d.title)))}));
const oldPlans=await pg.evaluate(eval(PLAN),CASES);
/* 2. same origin & IndexedDB, now serve the current build */
useOld=false;await pg.close();const p2=await ctx.newPage();p2.on('pageerror',e=>errs.push(e.message));
await p2.goto('http://localhost:8794/');await p2.waitForTimeout(1200);
const after=await p2.evaluate(()=>({ver:APP_VERSION,tests:S.tests.length,dur:S.profile&&S.profile.durationDays,pm:S.profile&&S.profile.grind&&S.profile.grind.pm,lift:S.profile&&S.profile.grind&&S.profile.grind.lift,lift2:S.profile&&S.profile.grind&&S.profile.grind.lift2,plan:S.plan&&JSON.stringify(S.plan.map(w=>w.days.map(d=>d.title))),card:/โหมดทรหด: วิดพื้น/.test(document.body.innerText),valid:validateBackup({app:APP,version:VER,data:{profile:S.profile}}).ok}));
ck('current build opens the 2.4.0 database (version bumped)',after.ver==='2.7.0'&&after.tests===before.tests&&after.tests>=5,[before.tests,after]);
ck('2.4.0 grind profile intact (single lift, no lift2)',after.lift===before.lift&&after.lift2==null&&after.dur===before.dur&&JSON.stringify(after.pm)===JSON.stringify(before.pm),[before,after].map(x=>[x.lift,x.dur,x.pm]));
ck('stored 2.4.0 plan untouched after upgrade',after.plan===before.plan);
ck('dashboard card renders for a 2.4.0 profile',after.card);
ck('2.4.0 profile still passes backup validation',after.valid);
/* 3. replan on the old profile works and keeps one lift */
await p2.evaluate(()=>{A.grindReplan();});await p2.waitForTimeout(250);await p2.click('[data-d=ok]');await p2.waitForTimeout(500);
if(await p2.$('[data-d=cancel]')){await p2.click('[data-d=cancel]');await p2.waitForTimeout(300);}
const rp=await p2.evaluate(()=>({cur:S.profile.grind.cur,lift2:S.profile.grind.lift2,nb:S.profile.grind.nb}));
ck('replan on a 2.4.0 profile uses the measured test, stays single-lift',rp.cur===27&&rp.lift2==null,rp);
/* 4. plan equivalence old vs new */
/* v2.6 personal rate (level prior) deliberately changes estimates; neutralize it so this test still proves the plan generator itself is unchanged */
const lvl=await p2.evaluate(()=>grindPersonal('pushup','fast',false,20).rate<grindRate('fast',false));
ck('v2.6: level prior slows the estimate for a mid-level pushup (intended change)',lvl,lvl);
await p2.evaluate(()=>{window.grindPersonal=(l,p,d)=>({rate:grindRate(p,d)});});
const newPlans=await p2.evaluate(eval(PLAN),CASES);
CASES.forEach((c,i)=>{const same=oldPlans[i]===newPlans[i];const note=c[0]==='pullup'&&(c[1].pullup||0)<1?'(foundation expected to differ)':'';
 ck(`plan identical day-by-day: ${c[0]} base ${JSON.stringify(c[1])} ${c[3].bar?'':'no-bar '}${note}`,same,same?'':(()=>{const a=JSON.parse(oldPlans[i]),n=JSON.parse(newPlans[i]);const k=a.findIndex((x,j)=>JSON.stringify(x)!==JSON.stringify(n[j]));return{day:k,old:a[k],new:n[k]};})());});

/* 5. real service-worker upgrade: old SW + cache installed, then the new build is offered via the banner and data survives */
{useOld=true;const c2=await b.newContext({viewport:{width:375,height:700},serviceWorkers:'allow'});const q=await c2.newPage();q.on('pageerror',e=>errs.push(e.message));
 await q.goto('http://localhost:8794/');await q.waitForTimeout(1500);
 await q.selectOption('#s_priority','grind');await q.fill('#b_pushup','20');await q.fill('#g_pushup','45');await q.fill('#b_pullup','2');await q.fill('#b_plank','1:00');await q.fill('#b_run','12:00');
 await q.click('[data-act=setupSave]');await q.waitForTimeout(800);
 const o=await q.evaluate(async()=>({v:APP_VERSION,keys:await caches.keys(),t:S.tests.length}));
 useOld=false;await q.reload();await q.waitForTimeout(1500);
 await q.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();if(r)await r.update();});await q.waitForTimeout(2500);
 const banner=await q.isVisible('#banner [data-act=swUpdate]').catch(()=>false);
 if(banner){await Promise.all([q.waitForNavigation({timeout:10000}).catch(()=>{}),q.click('#banner [data-act=swUpdate]')]);}
 await q.reload();await q.waitForTimeout(2000);
 const n=await q.evaluate(async()=>({v:APP_VERSION,keys:await caches.keys(),t:S.tests.length,g:S.profile&&S.profile.grind&&S.profile.grind.lift}));
 ck('old SW build installed first (2.4.0 cache)',o.v==='2.4.0'&&o.keys.some(k=>/2\.4\.0/.test(k)),o);
 ck('update is offered via banner (or applied) and new build becomes active',n.v==='2.7.0',{banner,n});
 ck('after SW update: old cache removed, data & grind profile intact',n.keys.length===1&&/2\.7\.0/.test(n.keys[0])&&n.t===o.t&&n.g==='pushup',n);
}
ck('no page errors',!errs.length,errs);
console.log(fail?fail+' FAILED':'ALL PASS');await b.close();srv.close();process.exit(fail?1:0);})();
