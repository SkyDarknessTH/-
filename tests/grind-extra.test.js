/* Browser check: Grind v2.5 — pull-up foundation (negatives kept apart from real pull-ups) + two-lift mode.
   Run: NODE_PATH=$(npm root -g) node tests/grind-extra.test.js */
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}
 const t={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(f)]||'text/plain';r.writeHead(200,{'Content-Type':t});r.end(fs.readFileSync(f));}).listen(8793);
let fail=0;const ck=(n,ok,x)=>{console.log((ok?'PASS ':'FAIL ')+n+(ok?'':' '+JSON.stringify(x||'')));if(!ok)fail++;};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
const pg=await b.newPage({viewport:{width:375,height:700}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8793/');await pg.waitForTimeout(800);

/* ---------- A. foundation phase ---------- */
const est=await pg.evaluate(()=>{const e=grindEstimate('pullup',0,5,'fast');return{pm:e.pm,reach:e.reach,days:e.days,one:grindEstimate('pullup',1,5,'fast').days};});
ck('pull-up from 0: first 2 weeks flat (foundation), then grows',est.pm[1]===0&&est.pm[2]===0&&est.pm[3]>=1&&est.reach,est);
ck('foundation never makes the estimate faster than starting at 1',est.days>=est.one,[est.days,est.one]);

const A=await pg.evaluate(()=>{
 const mkProf=(pull,eq)=>{const e=grindEstimate('pullup',pull,5,'fast');S.sessions={};S.tests=S.tests.filter(t=>t.source==='baseline');
  S.profile={start:mondayOf(today()),baseline:{pushup:15,pullup:pull,plank:60,run:600},goals:{pushup:30,pullup:5,plank:120,run:500},durationDays:e.days,priority:'grind',grind:{lift:'pullup',pace:'fast',pm:e.pm,cur:pull,nb:0},minutesPerDay:90,equipment:eq};S.plan=buildPlan();return e;};
 const day=(n)=>S.plan[Math.floor(n/7)].days[n%7];
 const ids=n=>day(n).items.map(i=>i.exId);
 const e=mkProf(0,{bar:true,band:true});
 const out={};
 out.base=ids(0);out.baseTitle=day(0).title;
 out.noStrictEarly=[...Array(14).keys()].every(n=>!ids(n).includes('pullup')&&!ids(n).includes('band_pullup'));
 out.hasNeg=[...Array(14).keys()].some(n=>ids(n).includes('negative_pullup'));
 out.titleFound=[1,2,3].every(n=>!day(n).items.length||/ช่วงฐาน/.test(day(n).title));
 out.cp14=ids(14);
 /* negatives logged as TRAINING in two sessions (one assumed set must be ignored) */
 const mkS=(k,reps,assumed)=>{const it=mk('Negative pull-up','band','reps',{exId:'negative_pullup',sets:1,reps:3});return{id:k,w:0,d:+k.split('-')[1],items:[it],sets:{[it.id]:[{done:true,aReps:reps,aQ:reps,assumed:!!assumed}]}};};
 S.sessions={'0-1':mkS('0-1',2,true),'0-2':mkS('0-2',3)};out.nb1=negBest();
 S.sessions={'0-1':mkS('0-1',4),'0-3':mkS('0-3',4)};out.nb2=negBest();
 out.allowed=exAllowed('pullup').ok;out.realTests=testsOf('pullup').filter(t=>t.source!=='baseline').length;
 S.plan=buildPlan();out.cp14b=ids(14);out.cp14Title=day(14).title;
 /* a real measured test of 1 ends foundation */
 S.tests.push({id:uid(),cat:'pullup',date:nowDT(),value:1,place:'',note:'',rpe:null,pain:'',source:'test',basis:'measured',std:true,createdAt:Date.now()});
 out.found=pullFound();S.plan=buildPlan();out.afterReal=[...Array(7).keys()].some(n=>ids(n).includes('negative_pullup'));
 /* no bar: never prescribes negatives, never foundation */
 S.tests=S.tests.filter(t=>t.source==='baseline');mkProf(0,{bar:false,band:false});out.nobar=[...Array(14).keys()].every(n=>!ids(n).includes('negative_pullup')&&!ids(n).includes('pullup'));out.nobarFound=pullFound();
 return out;});
ck('day 0 of a 0-pull-up plan is a NEGATIVE test, never a real pull-up',A.base.includes('negative_pullup')&&!A.base.includes('pullup')&&/Baseline/.test(A.baseTitle),[A.base,A.baseTitle]);
ck('first 2 weeks: only negatives, no band/strict pull-ups',A.noStrictEarly&&A.hasNeg,A);
ck('foundation days are labelled',A.titleFound);
ck('checkpoint at day 14 is still negative while gate not passed',A.cp14.includes('negative_pullup')&&!A.cp14.includes('pullup'),A.cp14);
ck('negBest ignores assumed sets and uses real logs',A.nb1===3&&A.nb2===4,[A.nb1,A.nb2]);
ck('negatives never create a pull-up test record',A.realTests===0,A.realTests);
ck('once gate passes the checkpoint becomes a REAL pull-up test',A.allowed&&A.cp14b.includes('pullup')&&/Checkpoint/.test(A.cp14Title),[A.allowed,A.cp14b,A.cp14Title]);
ck('measured pull-up ≥1 ends foundation',A.found===false&&A.afterReal===false,[A.found,A.afterReal]);
ck('no bar: no negatives/pull-ups, foundation off',A.nobar&&A.nobarFound===false,[A.nobar,A.nobarFound]);

/* ---------- B. two-lift mode ---------- */
const e2=await pg.evaluate(()=>{const one=grindEstimate('pushup',20,40,'fast'),dual=grindEstimate('pushup',20,40,'fast',true);
 const two=grindEstimate2({lift:'pushup',cur:20,tgt:28},{lift:'plank',cur:60,tgt:100},'fast'),bad=grindEstimate2({lift:'pushup',cur:20,tgt:500},{lift:'plank',cur:60,tgt:90},'fast');
 return{one:one.days,dual:dual.days,two:{d:two.days,r:two.reach,f1:two.final,f2:two.final2},bad:{r:bad.reach,d:bad.days}};});
ck('dual rate is never faster than solo rate',e2.dual>=e2.one,[e2.dual,e2.one]);
ck('two-lift estimate reaches both targets in shortest common weeks',e2.two.r&&e2.two.f1>=28&&e2.two.f2>=100&&e2.two.d%7===0,e2.two);
ck('two-lift unreachable target flagged and capped at 84',!e2.bad.r&&e2.bad.d===84,e2.bad);

const B=await pg.evaluate(()=>{
 const t1={pushup:20,pullup:2},g={pushup:45,pullup:6};
 const e=grindEstimate2({lift:'pushup',cur:20,tgt:45},{lift:'pullup',cur:2,tgt:6},'fast');
 S.sessions={};S.tests=S.tests.filter(t=>t.source==='baseline');
 S.profile={start:mondayOf(today()),baseline:{pushup:20,pullup:2,plank:60,run:600},goals:{pushup:45,pullup:6,plank:120,run:500},durationDays:e.days,priority:'grind',grind:{lift:'pushup',lift2:'pullup',pace:'fast',pm:e.pm,pm2:e.pm2,cur:20,cur2:2,nb:0},minutesPerDay:120,equipment:{bar:true,band:true}};
 S.plan=buildPlan();
 const days=[];for(let n=0;n<e.days;n++)days.push(S.plan[Math.floor(n/7)].days[n%7]);
 const lifts=days.map((x,n)=>{const ids=x.items.map(i=>i.exId);const hasA=ids.some(i=>['pushup','incline_pushup'].includes(i)),hasB=ids.some(i=>['pullup','band_pullup','negative_pullup','prone_ytw'].includes(i));return{n,hasA,hasB,d:n%7,t:x.title,len:x.items.length};});
 const bad=[];days.forEach((x,n)=>x.items.forEach(i=>{const E=EX[i.exId];if(!E&&i.exId!=='custom')bad.push('noEX '+i.exId);if(E&&E.needs&&!hasEquip(E.needs))bad.push('equip '+i.exId);if(!(i.sets>=1)||i.type==='reps'&&!(i.reps>=1))bad.push('num '+i.ex);}));
 const testDays=days.map((x,n)=>/Test Day/.test(x.title)?n:-1).filter(x=>x>=0);
 const fin=(()=>{let f=e.days-1;while(f%7===6)f--;return f;})();
 return{days:e.days,lifts,bad:[...new Set(bad)],testDays,fin,
  restOk:days.every((x,n)=>(n%7===6)===!x.items.length),
  perWeek:[0,1,2,3,4,5].map(d=>lifts.filter(l=>l.d===d)[0].t),
  maxItems:Math.max(...days.map(x=>x.items.length)),
  pushDaysFirstWeek:lifts.slice(0,6).filter(l=>l.hasA).map(l=>l.d),pullDaysFirstWeek:lifts.slice(0,6).filter(l=>l.hasB).map(l=>l.d),
  titles:days.slice(0,6).map(x=>x.title)};});
ck('dual: A days Mon/Wed/Fri, B days Tue/Thu/Sat (no mixing)',JSON.stringify(B.pushDaysFirstWeek)==='[0,2,4]'&&JSON.stringify(B.pullDaysFirstWeek)==='[1,3,5]',[B.pushDaysFirstWeek,B.pullDaysFirstWeek]);
ck('dual: Sunday rests every week, item cap respected, no equipment/number errors',B.restOk&&B.maxItems<=6&&!B.bad.length,[B.restOk,B.maxItems,B.bad]);
ck('dual: tests — A on day 0/14/.., B on day 1/15/.., both end by the last training days',B.testDays.includes(0)&&B.testDays.includes(1)&&B.testDays.every(n=>n%14===0||n%14===1||n>=B.fin-1)&&B.testDays.includes(B.fin)&&B.testDays.includes(B.fin-1),[B.testDays,B.fin]);
ck('dual: titles mention each lift',/วิดพื้น/.test(B.titles[0])&&/ดึงข้อ/.test(B.titles[1]),B.titles);

/* ---------- C. replan / card / settings / import with two lifts ---------- */
await pg.evaluate(async()=>{const t=(cat,v,k)=>({id:uid(),cat,date:nowDT(),value:v,place:'',note:'',rpe:null,pain:'',source:'test',basis:'measured',std:true,createdAt:Date.now()+k});
 for(const x of [t('pushup',28,1),t('pullup',3,2)]){S.tests.push(x);await saveTest(x);}
 await saveKV('profile',S.profile);await savePlan();location.hash='#/dash';render();});
await pg.waitForTimeout(300);
const body=await pg.innerText('body');
ck('dual card shows both lifts and new-test hints',/วิดพื้น \+ ดึงข้อ/.test(body)&&(body.match(/มีผลทดสอบใหม่/g)||[]).length===2,body.slice(0,200));
await pg.evaluate(()=>{A.grindReplan();});await pg.waitForTimeout(200);
await pg.click('[data-d=ok]');await pg.waitForTimeout(500);
if(await pg.$('[data-d=cancel]')){await pg.click('[data-d=cancel]');await pg.waitForTimeout(400);}
const R=await pg.evaluate(()=>{const G=S.profile.grind;return{cur:G.cur,cur2:G.cur2,pm1:G.pm[1],pm21:G.pm2[1],l1:G.pm.length,l2:G.pm2.length,dur:S.profile.durationDays,wk:planWeeks()};});
ck('replan updates BOTH lifts from latest measured tests',R.cur===28&&R.cur2===3&&R.pm1>=28&&R.pm21>=3&&R.l1>=2&&R.l2>=2,R);
const V=await pg.evaluate(()=>{const mkv=g=>validateBackup({app:APP,version:VER,data:{profile:Object.assign({},S.profile,{grind:g})}}).ok;const G=S.profile.grind;
 return{good:mkv(G),same:mkv(Object.assign({},G,{lift2:G.lift})),badPm2:mkv(Object.assign({},G,{pm2:['x']})),noPm2:mkv(Object.assign({},G,{pm2:undefined})),badLift2:mkv(Object.assign({},G,{lift2:'bogus'})),badNb:mkv(Object.assign({},G,{nb:-1}))};});
ck('import validation: good dual accepted; same/bad lift2, bad pm2, missing pm2, bad nb rejected',V.good&&!V.same&&!V.badPm2&&!V.noPm2&&!V.badLift2&&!V.badNb,V);

/* ---------- D. setup UI ---------- */
const pg2=await (await b.newContext({viewport:{width:375,height:700}})).newPage();pg2.on('pageerror',e=>errs.push(e.message));await pg2.goto('http://localhost:8793/');await pg2.waitForTimeout(900);
const hasSetup=await pg2.$('#s_priority');
if(!hasSetup){ck('setup page reachable for UI test',false,'no #s_priority (skip dbClear?)');}
else{
 await pg2.selectOption('#s_priority','grind');
 await pg2.fill('#b_pushup','20');await pg2.fill('#g_pushup','45');await pg2.fill('#b_pullup','0');await pg2.fill('#g_pullup','5');
 await pg2.selectOption('#s_glift2','pullup');await pg2.dispatchEvent('#g_pullup','change');await pg2.waitForTimeout(150);
 const t=await pg2.textContent('#grindEst');
 ck('setup: dual estimate lists both lifts, weeks, and foundation warning',/วิดพื้น/.test(t)&&/ดึงข้อ/.test(t)&&/สัปดาห์/.test(t)&&/negative/.test(t),t);
 await pg2.selectOption('#s_glift2','pushup');await pg2.waitForTimeout(150);
 ck('setup: same lift twice is rejected',/ไม่ซ้ำ/.test(await pg2.textContent('#grindEst')));
 await pg2.selectOption('#s_glift2','pullup');await pg2.fill('#b_plank','1:00');await pg2.fill('#b_run','12:00');await pg2.waitForTimeout(100);
 await pg2.click('[data-act=setupSave]');await pg2.waitForTimeout(600);
 const P=await pg2.evaluate(()=>({l2:S.profile&&S.profile.grind&&S.profile.grind.lift2,pm2:S.profile&&S.profile.grind&&S.profile.grind.pm2&&S.profile.grind.pm2.length,d:S.profile&&S.profile.durationDays,wk:planWeeks(),card:/โหมดทรหด: วิดพื้น \+ ดึงข้อ/.test(document.body.innerText)}));
 ck('setup saves a dual profile with duration = estimate',P.l2==='pullup'&&P.pm2>=3&&P.d===P.wk*7&&P.card,P);
}
ck('no page errors',!errs.length,errs);
console.log(fail?fail+' FAILED':'ALL PASS');await b.close();srv.close();process.exit(fail?1:0);})();
