/* Browser check: v2.7 optional body data (weight / load / resting HR), rate modes, backup validation.
   Run: NODE_PATH=$(npm root -g) node tests/body-data.test.js */
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}
 const t={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(f)]||'text/plain';r.writeHead(200,{'Content-Type':t});r.end(fs.readFileSync(f));}).listen(8796);
let fail=0;const ck=(n,ok,x)=>{console.log((ok?'PASS ':'FAIL ')+n+(ok?'':' '+JSON.stringify(x||'')));if(!ok)fail++;};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:375,height:700}});await ctx.clock.install({time:new Date('2026-10-14T09:00:00')});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8796/');await pg.waitForTimeout(800);

/* A. defaults: everything off/empty, cleanBody sanitises junk */
const A=await pg.evaluate(()=>{const d=bodyOf();const c=cleanBody({track:{weight:'yes',load:true},age:3,sex:'x',exp:'zzz',weights:[{d:'2026-10-01',kg:70},{d:'bad',kg:70},{d:'2026-10-02',kg:5},{d:'2026-10-01',kg:71}],rhr:'no',rateMode:'??',manualRate:5});
 return{d:{t:d.track,age:d.age,sex:d.sex,exp:d.exp,w:d.weights.length,mode:d.rateMode},c:{t:c.track,age:c.age,sex:c.sex,exp:c.exp,w:c.weights,r:c.rhr.length,mode:c.rateMode,mr:c.manualRate}};});
ck('defaults: nothing tracked, no values, auto mode',!A.d.t.weight&&!A.d.t.load&&!A.d.t.rhr&&A.d.age==null&&A.d.sex===''&&A.d.exp===''&&A.d.w===0&&A.d.mode==='auto',A.d);
ck('cleanBody drops junk, keeps one value per day (last wins)',A.c.t.weight===false&&A.c.t.load===true&&A.c.age==null&&A.c.sex===''&&A.c.exp===''&&A.c.w.length===1&&A.c.w[0].kg===71&&A.c.r===0&&A.c.mode==='auto'&&A.c.mr==null,A.c);

/* B. rate modes (no history) */
const B=await pg.evaluate(()=>{S.tests=[];const base=grindRate('fast',false),o={};const set=(m,e,mr)=>{const x=bodyOf();x.rateMode=m;x.exp=e||'';x.manualRate=mr||null;};
 set('auto','');o.auto=grindPersonal('pushup','fast',false,20).rate/base;
 set('auto','3+');o.exp3=grindPersonal('pushup','fast',false,3).rate/base;
 set('auto','new');o.expNew=grindPersonal('pushup','fast',false,200).rate/base;
 set('manual','',.07);o.man=grindPersonal('pushup','fast',false,20);
 set('manual','',.19);o.manCap=grindPersonal('pushup','steady',false,20);
 set('level','');o.level=grindPersonal('pushup','fast',false,20).rate/base;
 set('auto','');return o;});
ck('experience overrides the count-based level prior',Math.abs(B.exp3-.65)<1e-9&&Math.abs(B.expNew-1)<1e-9&&Math.abs(B.auto-.85)<1e-9,B);
ck('manual rate is used but capped at the chosen pace ceiling',Math.abs(B.man.rate-.07)<1e-9&&B.man.manual&&Math.abs(B.manCap.rate-.06)<1e-9,[B.man,B.manCap]);

/* C. modes with history: stalled 20->20 over 8 weeks */
const C=await pg.evaluate(()=>{const mk=(d,v)=>({id:'t'+Math.random(),cat:'pushup',date:d,value:v,source:'test',basis:'measured',std:true,createdAt:Date.now()});
 S.tests=[mk('2026-08-03T08:00',20),mk('2026-09-28T08:00',20)];const x=bodyOf(),o={};
 x.rateMode='auto';o.auto=grindPersonal('pushup','fast',false,20).rate;x.rateMode='level';o.level=grindPersonal('pushup','fast',false,20).rate;
 x.rateMode='history';o.hist=grindPersonal('pushup','fast',false,20).rate;x.rateMode='auto';return o;});
ck('level ignores history; history-only follows it (floor 2%); auto is in between',C.level>C.auto&&C.auto>C.hist&&Math.abs(C.hist-0.02)<1e-9,C);

/* D. weight / rhr / load status */
const D=await pg.evaluate(()=>{const x=bodyOf();x.track.weight=x.track.load=x.track.rhr=true;
 setSeries('weights','kg','2026-09-01',70);setSeries('weights','kg','2026-10-12',73);const w=weightStatus();
 ['2026-09-20','2026-09-22','2026-09-24','2026-09-26','2026-09-28','2026-09-30'].forEach(d=>setSeries('rhr','bpm',d,55));setSeries('rhr','bpm','2026-10-14',64);const r=rhrStatus();
 const mk=(w,d,rpe,mins)=>({id:w+'-'+d,w,d,date:'2026-10-0'+1,status:'completed',rpe,mins,items:[],sets:{}});
 S.sessions={};const put=(date,rpe,mins)=>{S.sessions[date]={id:date,date,rpe,mins,status:'completed',items:[],sets:{}};};
 put('2026-09-22',6,40);put('2026-09-24',6,40);put('2026-09-29',6,40);put('2026-10-01',6,40);put('2026-10-13',8,60);put('2026-10-14',8,60);
 const l=loadStatus(),m=weeklyLoad();return{w:{pct:w.pct,big:w.big},r:{base:r.base,up:r.up},l:{ratio:l&&l.ratio,warn:l&&l.warn},keys:Object.keys(m).length};});
ck('weight change ≥3% over ≥14 days flagged',D.w.big&&Math.abs(D.w.pct-4.2857)<.1,D.w);
ck('resting HR ≥7 above 28-day median flagged',D.r.base===55&&D.r.up,D.r);
ck('weekly load = Σ RPE×min; >1.5× prior mean warns',D.l.warn&&D.l.ratio>1.5&&D.keys===3,D);
const S1=await pg.evaluate(()=>safetyState().flags.map(f=>f.text).join('|'));
ck('tracked warnings appear in safetyState only when tracking is on',/ภาระการฝึก/.test(S1)&&/ชีพจรขณะพัก/.test(S1),S1);
const S2=await pg.evaluate(()=>{const x=bodyOf();x.track.load=x.track.rhr=false;return safetyState().flags.map(f=>f.text).join('|');});
ck('no body warnings when tracking is off',!/ภาระการฝึก|ชีพจรขณะพัก/.test(S2),S2);

/* E. UI: settings card, save, add/delete, undo */
await pg.evaluate(()=>{S.profile=S.profile||null;});
await pg.evaluate(()=>{window.__h=bodyCard();});
const E1=await pg.evaluate(()=>({h:window.__h.includes('data-act="saveBody"'),w:window.__h.includes('data-act="addWeight"')}));
ck('body card renders (tracking sections follow toggles)',E1.h&&E1.w,E1);
const Fm=await pg.evaluate(async()=>{
 const host=document.createElement('div');host.id='bh';host.innerHTML=bodyCard();document.body.appendChild(host);
 const q=id=>document.getElementById(id);
 q('b_age').value='abc';await A.saveBody();const bad=bodyOf().age;
 q('b_age').value='27';q('b_sex').value='f';q('b_exp').value='1-3';q('b_mode').value='manual';q('b_mrate').value='25';await A.saveBody();const badRate=bodyOf().rateMode;
 q('b_mrate').value='8';await A.saveBody();const B=bodyOf();
 return{bad,badRate,age:B.age,sex:B.sex,exp:B.exp,mode:B.rateMode,mr:B.manualRate};});
ck('invalid age / rate rejected; valid values saved',Fm.bad==null&&Fm.badRate!=='manual'&&Fm.age===27&&Fm.sex==='f'&&Fm.exp==='1-3'&&Fm.mode==='manual'&&Math.abs(Fm.mr-.08)<1e-9,Fm);
const G=await pg.evaluate(async()=>{await render();bodyOf().track.weight=true;
 document.body.insertAdjacentHTML('beforeend','<input id="b_wkg">');document.getElementById('b_wkg').value='99999';await A.addWeight();const n1=bodyOf().weights.length;
 document.getElementById('b_wkg').value='72,5';await A.addWeight();const w=bodyOf().weights.slice(-1)[0];
 const n2=bodyOf().weights.length;await A.delSeries({dataset:{k:'weights',d:w.d}});return{n1,n2,w,n3:bodyOf().weights.length,bad:await A.delSeries({dataset:{k:'evil',d:'x'}})};});
ck('weight input validated (comma decimal ok), saved, deletable; unknown series ignored',G.n2===G.n1+1&&G.w.kg===72.5&&G.n3===G.n2-1&&G.bad===undefined,G);

/* F. backup validation + round trip */
const H=await pg.evaluate(()=>{S.sessions={};setSeries('weights','kg','2026-10-10',71.2);setSeries('rhr','bpm','2026-10-10',58);const o=JSON.parse(buildBackup());const ok=validateBackup(o).ok;
 const bad=JSON.parse(JSON.stringify(o));bad.data.settings.body.weights=[{d:'2026-10-10',kg:-5}];delete bad.checksum;const r1=validateBackup(bad);
 const bad2=JSON.parse(JSON.stringify(o));bad2.data.settings.body='x';delete bad2.checksum;const r2=validateBackup(bad2);
 const bad3=JSON.parse(JSON.stringify(o));bad3.data.sessions=[{id:'0-0',status:'completed',date:'2026-10-05',items:[],sets:{},mins:-4}];delete bad3.checksum;const r3=validateBackup(bad3);
 return{ok,r1:r1.ok,r2:r2.ok,r3:r3.ok,has:o.data.settings.body.weights.length>=1};});
ck('backup carries body data; invalid weights / body / session minutes rejected',H.ok&&H.has&&!H.r1&&!H.r2&&!H.r3,H);

/* UI flow: finish dialog + readiness show the optional fields only when tracking, and persist them */
{const c2=await b.newContext({viewport:{width:375,height:700}});const q=await c2.newPage();q.on('pageerror',e=>errs.push(e.message));
 await q.goto('http://localhost:8796/');await q.waitForTimeout(900);
 await q.selectOption('#s_priority','balanced').catch(()=>{});
 await q.fill('#b_pushup','20').catch(()=>{});await q.fill('#g_pushup','40').catch(()=>{});await q.fill('#b_pullup','2').catch(()=>{});await q.fill('#b_plank','1:00').catch(()=>{});await q.fill('#b_run','12:00').catch(()=>{});
 await q.click('[data-act=setupSave]');await q.waitForTimeout(900);
 const ready=await q.evaluate(()=>!!S.profile&&!!S.plan);
 ck('UI setup produced a profile (precondition)',ready,ready);
 if(ready){
  /* off: no extra fields */
  await q.evaluate(()=>{S.settings.askReadiness=false;const x=bodyOf();x.track={weight:false,load:false,rhr:false};});
  const day=await q.evaluate(()=>{const t=todayRef();let w=t?t.w:0,d=t?t.d:0;for(let n=0;n<84;n++){const ww=Math.floor(n/7),dd=n%7;if(!dayInfo(ww,dd).rest){w=ww;d=dd;break;}}return{w,d};});
  await q.evaluate(async x=>{await ensureSession(x.w,x.d);const s=S.sessions[x.w+'-'+x.d];s.startedAt=Date.now()-35*6e4;Object.values(s.sets).forEach(a=>a.forEach(z=>{z.done=true;}));await saveSess(s);},day);
  q.evaluate(x=>{A.completeDay({dataset:{w:x.w,d:x.d}});},day);await q.waitForSelector('#c_rpe');
  const offHas=await q.$('#c_min');ck('finish dialog has no minutes field when load tracking is off',!offHas,!!offHas);
  await q.fill('#c_rpe','7');await q.click('[data-d=ok]');await q.waitForTimeout(500);
  const m0=await q.evaluate(x=>S.sessions[x.w+'-'+x.d].mins,day);ck('no minutes stored when tracking is off',m0==null,m0);
  /* on: field prefilled from timer, blank allowed, value stored */
  await q.evaluate(()=>{bodyOf().track.load=true;});
  q.evaluate(x=>{A.completeDay({dataset:{w:x.w,d:x.d}});},day);await q.waitForSelector('#c_min');
  const pre=await q.inputValue('#c_min');ck('minutes field appears, prefilled from the session timer (~35)',+pre>=34&&+pre<=40,pre);
  await q.fill('#c_min','45');await q.fill('#c_rpe','7');await q.click('[data-d=ok]');await q.waitForTimeout(500);
  const m1=await q.evaluate(x=>S.sessions[x.w+'-'+x.d].mins,day);ck('minutes saved on the session (45)',m1===45,m1);
  const ld=await q.evaluate(x=>Object.values(weeklyLoad()).reduce((a,b)=>a+b,0),day);ck('weekly load counts RPE×minutes (7×45=315)',ld===315,ld);
  q.evaluate(x=>{A.completeDay({dataset:{w:x.w,d:x.d}});},day);await q.waitForSelector('#c_min');await q.fill('#c_min','0');await q.click('[data-d=ok]');await q.waitForTimeout(300);
  const stillOpen=await q.$('#c_min');ck('invalid minutes (0) rejected with the dialog kept open',!!stillOpen,!!stillOpen);
  await q.fill('#c_min','');await q.click('[data-d=ok]');await q.waitForTimeout(400);
  const m2=await q.evaluate(x=>S.sessions[x.w+'-'+x.d].mins,day);ck('blank minutes allowed (stored as null)',m2==null,m2);
  /* readiness resting HR */
  await q.evaluate(()=>{S.readiness={};bodyOf().track.rhr=true;});
  q.evaluate(()=>{readinessFlow();});await q.waitForSelector('#r_rhr');
  await q.fill('#r_sleep','7');await q.fill('#r_rhr','58');await q.click('[data-d=ok]');await q.waitForTimeout(500);
  const hr=await q.evaluate(()=>({b:bodyOf().rhr.slice(-1)[0],keep:'rhr' in (S.readiness[today()]||{})}));
  await q.click('[data-d=ok]').catch(()=>{});
  ck('readiness stores resting HR in body data (not in the readiness record)',hr.b&&hr.b.bpm===58&&!hr.keep,hr);
  await q.evaluate(()=>{S.readiness={};bodyOf().track.rhr=false;});
  q.evaluate(()=>{readinessFlow();});await q.waitForSelector('#r_sleep');const noHr=await q.$('#r_rhr');ck('readiness has no HR field when HR tracking is off',!noHr,!!noHr);
  await q.click('[data-d=cancel]').catch(()=>{});
 }
 await c2.close();}
/* G. finish dialog + readiness show optional fields only when tracking */
const I=await pg.evaluate(()=>{const x=bodyOf();x.track.load=false;x.track.rhr=false;return typeof readinessFlow;});
ck('readiness/finish flows still defined',I==='function',I);
const CSV=await pg.evaluate(()=>typeof A.csvBody);
ck('CSV export for body data available',CSV==='function',CSV);
ck('no page errors',!errs.length,errs);
console.log(fail?fail+' FAILED':'ALL PASS');await b.close();srv.close();process.exit(fail?1:0);})();
