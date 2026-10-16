/* Browser check: Grind (ทรหด) mode — estimate, plan generation, equipment fallback, setup UI, replan.
   Run: node tests/grind-mode.test.js (needs playwright) */
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}
 const t={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(f)]||'text/plain';r.writeHead(200,{'Content-Type':t});r.end(fs.readFileSync(f));}).listen(8792);
let fail=0;const ck=(n,ok,x)=>{console.log((ok?'PASS ':'FAIL ')+n+(ok?'':' '+JSON.stringify(x||'')));if(!ok)fail++;};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
const pg=await b.newPage({viewport:{width:375,height:700}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8792/');await pg.waitForTimeout(800);
/* 1 estimate */
const est=await pg.evaluate(()=>({a:grindEstimate('pushup',20,40,'fast'),b:grindEstimate('pushup',20,40,'steady'),c:grindEstimate('pushup',20,500,'fast'),d:grindEstimate('pullup',0,5,'fast'),e:grindEstimate('plank',60,120,'fast')}));
ck('fast reaches 40 and is never slower than steady',est.a.reach&&est.a.days<=est.b.days&&est.a.days>=14,[est.a.days,est.b.days]);
ck('unreachable target capped at 84 days & flagged',!est.c.reach&&est.c.days===84);
ck('pm is monotonic, deload weeks flat',est.a.pm.every((v,i,a)=>!i||v>=a[i-1])&&est.e.pm.length===est.e.W+1,est.e.pm);
ck('pullup 0→5 and plank estimates sane',est.d.reach&&est.e.reach,[est.d.days,est.e.days]);
const rk=await pg.evaluate(()=>{const f=grindEstimate('pushup',20,45,'fast'),a=grindEstimate('pushup',20,45,'push'),m=grindEstimate('pushup',20,45,'max');return[f.days,a.days,m.days];});
ck('riskier paces are never slower (fast>=push>=max)',rk[0]>=rk[1]&&rk[1]>=rk[2]&&rk[1]<rk[0],rk);
/* 2 plans */
const out=await pg.evaluate(()=>{
 const run=(lift,base,tgt,eq,mins)=>{const e=grindEstimate(lift,base[lift],tgt,'fast');
  S.profile={start:mondayOf(today()),baseline:Object.assign({pushup:15,pullup:0,plank:60,run:600},base),goals:{},durationDays:e.days,priority:'grind',grind:{lift,pace:'fast',pm:e.pm,cur:base[lift]},minutesPerDay:mins,equipment:eq};
  const plan=buildPlan(),days=[];for(let n=0;n<e.days;n++)days.push(plan[Math.floor(n/7)].days[n%7]);
  const bad=[];days.forEach((x,n)=>x.items.forEach(i=>{const E=EX[i.exId];if(!E&&i.exId!=='custom')bad.push('noEX '+i.exId);if(E&&E.needs&&!hasEquip(E.needs))bad.push('equip '+i.exId);if(i.exId==='pullup'&&(base.pullup||0)<1&&n<7)bad.push('strict0');if(!(i.sets>=1)||i.type==='reps'&&!(i.reps>=1))bad.push('badnum '+i.ex+' '+JSON.stringify([i.sets,i.reps]));}));
  const tests=days.map((x,n)=>/Test Day/.test(x.title)?n:-1).filter(x=>x>=0);
  return{lift,days:e.days,tests,bad:[...new Set(bad)],rest:days.filter(x=>!x.items.length).length,expectRest:Math.floor(e.days/7),maxItems:Math.max(...days.map(x=>x.items.length)),titles:days.slice(0,7).map(x=>x.title),focus:[...new Set(days.flatMap(x=>x.items.map(i=>i.exId)))]};};
 return[run('pushup',{pushup:20},45,{bar:true,band:true},120),run('pullup',{pullup:0},5,{bar:true,band:true},90),run('pullup',{pullup:2},8,{bar:false,band:false},45),run('plank',{plank:60},180,{bar:true,band:false},90)];});
out.forEach(o=>{ck(`${o.lift} ${o.days}d: test days start/end & ≥14d apart`,o.tests[0]===0&&o.tests.length>=2&&o.tests.every((t,i)=>!i||t-o.tests[i-1]>=14),o.tests);
 ck(`${o.lift}: no equipment/number errors`,!o.bad.length,o.bad);
 ck(`${o.lift}: rest day each week, item cap`,o.rest===o.expectRest&&o.maxItems<=6,[o.rest,o.expectRest,o.maxItems]);});
ck('titles are grind-themed',out[0].titles.every(t=>/ทรหด|Rest/.test(t)),out[0].titles);
/* 3 setup UI */
await pg.evaluate(async()=>{});
const hasSetup=await pg.$('#s_priority');
ck('setup shows grind option',!!hasSetup);
if(hasSetup){
 await pg.selectOption('#s_priority','grind');
 await pg.fill('#b_pushup','20');await pg.fill('#g_pushup','45');await pg.dispatchEvent('#g_pushup','change');
 const t=await pg.textContent('#grindEst');
 ck('live estimate shown, duration disabled',/วัน/.test(t)&&await pg.isDisabled('#s_duration')&&await pg.isVisible('#grindBox'),t);
 await pg.selectOption('#s_gpace','push');await pg.waitForTimeout(100);
 const riskShown=await pg.isVisible('#grindRisk');ck('risk acknowledgement shown for push pace',riskShown);
 await pg.fill('#b_pullup','2');await pg.fill('#b_plank','1:00');await pg.fill('#b_run','12:00');
 await pg.click('[data-act=setupSave]');await pg.waitForTimeout(300);
 const pe=await pg.evaluate(()=>({p:!!S.profile,e:document.querySelector('#setupErr')&&document.querySelector('#setupErr').textContent}));ck('setup blocked without risk acknowledgement',/ความเสี่ยง/.test(pe.e||''),pe);
 await pg.check('#s_grisk');await pg.click('[data-act=setupSave]');await pg.waitForTimeout(600);
 const prof=await pg.evaluate(()=>({p:S.profile.priority,g:S.profile.grind&&S.profile.grind.lift,d:S.profile.durationDays,card:!!document.body.innerText.match(/โหมดทรหด: วิดพื้น/),tl:planWeeks()}));
 ck('profile saved as grind with computed duration',prof.p==='grind'&&prof.g==='pushup'&&prof.d===prof.tl*7&&prof.card,prof);
 /* 4 replan after measured test */
 await pg.evaluate(async()=>{const t={id:uid(),cat:'pushup',date:nowDT(),value:30,place:'',note:'',rpe:null,pain:'',source:'test',basis:'measured',std:true,createdAt:Date.now()};S.tests.push(t);await saveTest(t);});
 await pg.evaluate(()=>{A.grindReplan();});await pg.waitForTimeout(200);
 await pg.click('[data-d=ok]');await pg.waitForTimeout(500);
 const rp=await pg.evaluate(()=>({cur:S.profile.grind.cur,pm:S.profile.grind.pm[0],pm1:S.profile.grind.pm[1]}));
 ck('replan uses latest measured test',rp.cur===30&&rp.pm1>=30,rp);
 /* 5 hint after new test, import validation, settings pace change */
 await pg.evaluate(async()=>{const t={id:uid(),cat:'pushup',date:nowDT(),value:33,place:'',note:'',rpe:null,pain:'',source:'test',basis:'measured',std:true,createdAt:Date.now()+5};S.tests.push(t);await saveTest(t);});
 await pg.evaluate(()=>{location.hash='#/dash';render();});await pg.waitForTimeout(300);
 ck('dashboard hints to replan after a new test',/มีผลทดสอบใหม่/.test(await pg.innerText('body')));
 const v=await pg.evaluate(()=>{const mk=g=>validateBackup({app:APP,version:VER,data:{profile:Object.assign({},S.profile,{grind:g})}}).ok;const G=S.profile.grind;return{good:mk(G),badPace:mk(Object.assign({},G,{pace:'bogus'})),badPm:mk(Object.assign({},G,{pm:[1,'x']})),badLift:mk(Object.assign({},G,{lift:'run'}))};});
 ck('import validation accepts good grind profile, rejects bad',v.good&&!v.badPace&&!v.badPm&&!v.badLift,v);
 await pg.evaluate(()=>{location.hash='#/settings';render();});await pg.waitForSelector('#p_gpace');
 await pg.selectOption('#p_gpace','max');await pg.click('[data-act=grindSetPace]');await pg.waitForSelector('[data-d=ok]');await pg.click('[data-d=ok]');
 await pg.waitForSelector('[data-d=ok]');await pg.click('[data-d=ok]');await pg.waitForTimeout(500);
 const pc=await pg.evaluate(()=>({pace:S.profile.grind.pace,cur:S.profile.grind.cur}));
 ck('settings pace change (risk confirm + replan) applied',pc.pace==='max'&&pc.cur===33,pc);
}
/* 6 auto-extend when the plan lags behind the target */
{
 const setup=async dur=>{await pg.evaluate(async d=>{
   const rt=grindPersonal('pushup','steady',false,20).rate,tg=grindSim(20,10,rt,'pushup')[10];
   S.sessions={};S.tests=S.tests.filter(t=>t.source==='baseline');
   S.profile={start:mondayOf(today()),baseline:{pushup:20,pullup:0,plank:60,run:600},goals:{pushup:tg},durationDays:d,priority:'grind',grind:{lift:'pushup',pace:'steady',pm:grindSim(20,Math.ceil(d/7),rt,'pushup'),cur:20},minutesPerDay:90,equipment:{bar:true,band:true}};
   S.plan=buildPlan();await saveKV('profile',S.profile);await savePlan();},dur);};
 /* accept: 28-day plan can't reach a 10-week target at 6%/wk -> extended, last day count grows, sessions untouched */
 await setup(28);
 const before=await pg.evaluate(()=>({d:S.profile.durationDays,last:JSON.stringify(S.plan[3].days[5])}));
 await pg.evaluate(()=>{A.grindReplan();});await pg.waitForSelector('[data-d=ok]');await pg.click('[data-d=ok]');
 await pg.waitForSelector('[data-d=ok]');await pg.click('[data-d=ok]');await pg.waitForTimeout(500);
 const ex=await pg.evaluate(()=>{const P=S.profile,W=planWeeks(),pm=P.grind.pm,tg=P.goals.pushup,dd=[];for(let n=0;n<planDuration();n++)dd.push(S.plan[Math.floor(n/7)].days[n%7]);
   return{d:P.durationDays,W,pmLen:pm.length,reach:pm[pm.length-1]>=tg,finalTest:/Test Day — Final/.test(dd[dd.length-1].title)||dd.some(x=>/Final/.test(x.title)),finals:dd.filter(x=>/Final/.test(x.title)).length,old:JSON.stringify(S.plan[3].days[5])};});
 ck('lagging plan: extension offered and accepted (longer, ≤84, reaches target)',ex.d>before.d&&ex.d<=84&&ex.d%7===0&&ex.pmLen===ex.W+1&&ex.reach,ex);
 ck('extended plan has exactly one Final test; old last week rebuilt',ex.finals===1&&ex.old!==before.last,[ex.finals]);
 /* decline: duration unchanged but plan still replanned */
 await setup(28);
 await pg.evaluate(()=>{A.grindReplan();});await pg.waitForSelector('[data-d=ok]');await pg.click('[data-d=ok]');
 await pg.waitForSelector('[data-d=cancel]');await pg.click('[data-d=cancel]');await pg.waitForTimeout(500);
 const dc=await pg.evaluate(()=>({d:S.profile.durationDays,len:S.profile.grind.pm.length}));
 ck('declining the extension keeps duration',dc.d===28&&dc.len===5,dc);
 /* already on track: no extension prompt */
 await setup(84);
 await pg.evaluate(()=>{A.grindReplan();});await pg.waitForSelector('[data-d=ok]');await pg.click('[data-d=ok]');await pg.waitForTimeout(500);
 const nd=await pg.evaluate(()=>({modal:document.querySelectorAll('#modal-root .ov').length,d:S.profile.durationDays}));
 ck('no extension prompt at max duration',nd.modal===0&&nd.d===84,nd);
}
ck('no page errors',!errs.length,errs);
await b.close();srv.close();if(fail)process.exitCode=1;})();
