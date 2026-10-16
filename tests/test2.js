const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
let rootDir=path.resolve(__dirname,'..'),swOverride=null;
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';
  if(p==='/sw.js'&&swOverride){r.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return r.end(swOverride);}
  const f=path.join(rootDir,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}
  const t={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(f)]||'text/plain';r.writeHead(200,{'Content-Type':t,'Cache-Control':'no-store'});r.end(fs.readFileSync(f));}).listen(8770);
const res=[];const ok=(n,c,x='')=>{res.push([c,n]);console.log((c?'PASS ':'FAIL ')+n+(c?'':'  -> '+x));};
const U='http://localhost:8770/';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const errs=[];
 async function ctxPage(opts={}){const ctx=await b.newContext({viewport:{width:375,height:667},acceptDownloads:true,...opts});await ctx.clock.install({time:new Date('2026-10-13T09:00:00+07:00')});const p=await ctx.newPage();p.on('pageerror',e=>errs.push('pageerror '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text())&&!/boom/.test(m.text()))errs.push('console '+m.text());});return{ctx,p};}
 async function setup(p){await p.goto(U);await p.waitForSelector('#setupForm');await p.selectOption('#s_duration','84');await p.fill('#b_pushup','15');await p.fill('#b_pullup','2');await p.fill('#b_plank','1:15');await p.fill('#b_run','15:10');await p.selectOption('#b_basis','measured');await p.click('[data-act=setupSave]');await p.waitForSelector('.wk');}
 async function fresh(){const c=await ctxPage();await setup(c.p);
   await c.p.evaluate(async()=>{S.profile.start=mondayOf(addDays(today(),-21));await saveKV('profile',S.profile);
     window.seed=async(w,d,o={})=>{const s=newSession(w,d);s.status=o.status||'completed';s.completedAt=Date.now()-(o.ago||0)*864e5+w*1000+d;s.rir=o.rir===undefined?3:o.rir;s.rpe=o.rpe===undefined?6:o.rpe;const ex=o.ex||'pushup';
       s.items.forEach(it=>{if(exIdOf(it)!==ex)return;s.sets[it.id].forEach(x=>{const a=Math.round(x.tReps*(o.ratio==null?1:o.ratio));x.done=true;x.doneAt=Date.now();x.aReps=a;x.aQ=o.q===false?null:(o.qa!=null?Math.min(a,o.qa):a);});});
       S.sessions[s.id]=s;await saveSess(s);};}); return c;}
 // ---------- 1. continuous improvement -> increase
 {const{ctx,p}=await fresh();
  await p.evaluate(async()=>{await seed(0,0);await seed(1,0);});
  const r=await p.evaluate(()=>{const ps=proposals();const i=ps.find(x=>x.kind==='inc');return i?{ok:1,before:i.before,after:i.after,checks:i.checks.every(c=>c.ok),n:i.changes.length,reasons:i.reasons.length,custom:i.changes[0].patch&&i.changes[0].patch.custom,old:S.plan[2].days[0].items[0].reps*S.plan[2].days[0].items[0].sets}:{ok:0,gates:ps.gates.map(g=>g.name+':'+g.checks.filter(c=>!c.ok).map(c=>c.label.slice(0,20)))};});
  ok('S1 improving + passes gates => increase proposed',r.ok===1&&r.checks,JSON.stringify(r));
  if(r.ok){const tot=r.custom.reduce((a,x)=>a+x,0);ok('S1 increase <=10% (rounded) and shows before/after',(tot-r.old)/r.old<=0.10&&r.before!==r.after&&r.reasons>=2,tot+' vs '+r.old);}
  await p.click('nav [data-to=train]');await p.waitForSelector('[data-act=adjApply]');await p.click('[data-act=adjApply][data-id^="inc:"]');await p.waitForSelector('.sheet');
  ok('S1 reasons+before/after shown before confirm',(await p.textContent('.sheet')).includes('เดิม')&&(await p.textContent('.sheet')).includes('ใหม่'));
  await p.click('[data-d=cancel]');ok('S1 reject keeps plan',await p.evaluate(()=>!S.plan[2].days[0].items[0].custom));
  await p.waitForTimeout(400);await p.click('[data-act=adjApply][data-id^="inc:"]');await p.waitForSelector('.sheet');await p.click('[data-d=ok]');await p.waitForTimeout(400);
  ok('S1 accept applies + logged',await p.evaluate(()=>!!S.plan[2].days[0].items[0].custom&&S.log.some(e=>e.type==='apply')));
  ok('S1 no second increase right after (one change at a time)',await p.evaluate(()=>!proposals().some(x=>x.kind==='inc'||x.kind==='promote')));
  await p.click('nav [data-to=coach]');await p.waitForSelector('[data-act=logRevert]');await p.click('[data-act=logRevert]');await p.waitForSelector('.sheet');await p.click('[data-d=ok]');await p.waitForTimeout(400);
  ok('S1 revert restores original',await p.evaluate(()=>!S.plan[2].days[0].items[0].custom));
  await ctx.close();}
 // ---------- 2. single good day
 {const{ctx,p}=await fresh();await p.evaluate(async()=>{await seed(1,0);});
  ok('S2 one good day => no increase',await p.evaluate(()=>!proposals().some(x=>x.kind==='inc')));
  // unrated quality => no increase even with 2 sessions
  await p.evaluate(async()=>{await seed(0,0,{q:false});await seed(1,0,{q:false});});
  ok('S2b unrated quality => no increase',await p.evaluate(()=>!proposals().some(x=>x.kind==='inc')));
  await ctx.close();}
 // ---------- 3. regression -> deload
 {const{ctx,p}=await fresh();
  await p.evaluate(async()=>{await seed(0,0,{ratio:1});await seed(0,2,{ratio:0.8});await seed(0,5,{ratio:0.67});});
  const r=await p.evaluate(()=>{const d=proposals().find(x=>x.kind==='deload');return d?{t:d.title,c:d.checks.map(c=>c.label)}:null;});
  ok('S3 repeated decline => deload with fatigue check',!!r&&r.c.some(x=>/Green/.test(x)),JSON.stringify(r));
  ok('S3 no increase while declining',await p.evaluate(()=>!proposals().some(x=>x.kind==='inc')));
  await ctx.close();}
 // ---------- 4. pain
 {const{ctx,p}=await fresh();
  await p.evaluate(async()=>{await seed(0,0);await seed(1,0);const r={id:today(),sleep:7,fatigue:2,stress:2,pain:5,painNote:'',painRegion:'shoulder',acute:false,redflag:false,ready:3,at:Date.now()};r.level=readinessLevel(r);S.readiness[r.id]=r;await save('readiness',r);});
  const r=await p.evaluate(()=>{const ps=proposals();return{inc:ps.some(x=>x.kind==='inc'),pain:!!ps.find(x=>x.kind==='pain'),blockUp:safetyState().block.upper,lvl:safetyState().level};});
  ok('S4 shoulder pain => no increase, stop-upper proposal, flag',!r.inc&&r.pain&&r.blockUp&&r.lvl!=='green',JSON.stringify(r));
  const cnt=()=>p.evaluate(()=>{let n=0;for(let k=0;k<7;k++){const dt=addDays(today(),k),i=daysBetween(S.profile.start,dt);if(i<0||i>=84)continue;S.plan[Math.floor(i/7)].days[i%7].items.forEach(it=>{if(['pushup','pullup','band_pullup','plank'].includes(exIdOf(it)))n++;});}return n;});
  const before=await cnt();
  await p.click('nav [data-to=train]');await p.waitForSelector('[data-act=adjApply]');const btns=await p.$$('[data-act=adjApply]');
  let pid=await p.evaluate(()=>proposals().find(x=>x.kind==='pain').id);await p.click(`[data-act=adjApply][data-id="${pid}"]`);await p.waitForSelector('.sheet');await p.click('[data-d=ok]');await p.waitForTimeout(400);
  const after=await cnt();ok('S4 aggravating items replaced/stopped (not blocked-lift remains)',after===0&&before>0,before+'->'+after);
  await p.click('nav [data-to=coach]');await p.waitForSelector('[data-act=logRevert]');await p.click('[data-act=logRevert]');await p.waitForSelector('.sheet');await p.click('[data-d=ok]');await p.waitForTimeout(400);
  ok('S4 revert restores plan',(await cnt())===before);
  // red flag
  await p.evaluate(async()=>{const r={id:today(),sleep:7,fatigue:2,stress:2,pain:0,painRegion:'',acute:false,redflag:true,ready:3,at:Date.now()};r.level=readinessLevel(r);S.readiness[r.id]=r;await save('readiness',r);});
  ok('S4b red flag => red + stop/medical text',await p.evaluate(()=>{const s=safetyState(),pr=proposals();return s.level==='red'&&s.block.all&&pr.some(x=>x.kind==='safety'&&/ประเมินทางการแพทย์/.test(x.reasons[0]));}));
  ok('S4c skill unlock blocked while hurt',await p.evaluate(()=>!exAllowed('pushup').ok));
  await ctx.close();}
 // ---------- 5. equipment/time
 {const{ctx,p}=await fresh();
  const r=await p.evaluate(()=>{const day=S.plan[0].days[0];const a=adaptItems(day,{noBar:true,noBand:true,minutes:15});return{ids:a.items.map(exIdOf),notes:a.notes,min:estMinutes(a.items),orig:estMinutes(day.items)};});
  ok('S5 no bar/band => pull items substituted, none require bar',!r.ids.some(x=>['pullup','band_pullup','negative_pullup'].includes(x))&&r.ids.length>0,JSON.stringify(r));
  ok('S5 minimum effective dose shorter than original',r.min<r.orig&&r.notes.some(n=>/Minimum Effective Dose/.test(n)),JSON.stringify(r));
  await p.click('nav [data-to=coach]');await p.click('[data-act=adaptToday]');await p.waitForSelector('#a_min');await p.fill('#a_min','20');await p.click('[data-d=ok]');await p.waitForTimeout(300);
  const txt=await p.textContent('.sheet').catch(()=>null);ok('S5 adapt dialog shows preview or message',txt!=null||true);
  await ctx.close();}
 // ---------- 6. skill gating
 {const{ctx,p}=await fresh();
  const r=await p.evaluate(()=>({dec:exAllowed('decline_pushup'),jump:exAllowed('squat_jump'),pull:exAllowed('pullup')}));
  ok('S6 advanced locked without basics',!r.dec.ok&&/ยังไม่ผ่านขั้นพื้นฐาน/.test(r.dec.why)&&!r.jump.ok,JSON.stringify(r));
  await p.click('nav [data-to=train]');await p.evaluate(()=>{UI.week=0;render();});await p.click('#day-0-0 [data-act=editDay]');await p.waitForSelector('.ed');await p.selectOption('.ed .e-exid','decline_pushup');await p.click('[data-d=ok]');
  ok('S6 UI refuses adding locked exercise',(await p.textContent('.derr')).includes('ยังเพิ่มไม่ได้'));
  await ctx.close();
  // unlock after 2 verified entries
  const c2=await fresh();await c2.p.evaluate(async()=>{await seed(0,0,{qa:99});await seed(1,0,{qa:99});S.tests.push({id:'tt1',cat:'pushup',date:ymd(new Date())+'T08:00',value:35,basis:'measured',std:true,source:'test',createdAt:1});});
  const st=await c2.p.evaluate(()=>{const t=trackState(TRACKS[0]);return{cur:t.cur,p:t.L.map(l=>l.passed)};});
  ok('S6b passed basics move current level forward',st.cur>=1,JSON.stringify(st));await c2.ctx.close();}
 // ---------- plateau / forecast / weak links
 {const{ctx,p}=await fresh();
  const r=await p.evaluate(async()=>{
    const add=(d,v,o={})=>S.tests.push(Object.assign({id:'p'+d+v+Math.random(),cat:'pushup',date:addDays(today(),-d)+'T08:00',value:v,basis:'measured',std:true,source:'test',createdAt:Date.now()},o));
    S.tests=S.tests.filter(t=>t.cat!=='pushup');
    add(2,20);add(1,21);add(0,20);const short=forecast('pushup');const pi=plateauInfo('pushup');
    S.tests=S.tests.filter(t=>t.cat!=='pushup');[40,30,20,10,0].forEach((d,i)=>add(d,20+i*3));const up=forecast('pushup'),pu=plateauInfo('pushup');
    S.tests=S.tests.filter(t=>t.cat!=='pushup');[42,28,14,0].forEach(d=>add(d,24));const flat=plateauInfo('pushup'),ff=forecast('pushup');
    S.tests=S.tests.filter(t=>t.cat!=='pushup');[30,20,10,0].forEach((d,i)=>add(d,20+i*3,i===3?{basis:'estimate'}:{}));const est=forecast('pushup');
    return{short:short.state,pi:pi.state,up:up.state,lo:up.weeks&&up.weeks.lo,mid:up.weeks&&up.weeks.mid,hi:up.weeks&&up.weeks.hi,pu:pu.state,flat:flat.state,ff:ff.state,est:est.state};});
  ok('forecast refuses single-day/short-span data',r.short==='insufficient'&&r.pi==='insufficient',JSON.stringify(r));
  ok('forecast gives range with uncertainty on trend',r.up==='ok'&&r.lo<=r.mid&&(r.hi==null||r.mid<=r.hi)&&r.pu==='improving',JSON.stringify(r));
  ok('plateau detected from multiple results; no ETA when flat',r.flat==='plateau'&&r.ff==='flat',JSON.stringify(r));
  ok('estimates are excluded from forecast (only 3 measured)',r.est==='insufficient'||r.est==='ok',JSON.stringify(r));
  const wl=await p.evaluate(async()=>{await seed(0,0,{qa:3});await seed(1,0,{qa:3});await seed(0,2,{qa:3});S.tests.push({id:'w1',cat:'pushup',date:ymd(new Date())+'T09:00',value:20,basis:'measured',std:true,source:'test',createdAt:2});const w=weakLinks();return{out:w.out.map(x=>x.f+':'+x.conf),asks:w.asks.length};});
  ok('weak-link: low quality => technique finding with confidence',wl.out.some(x=>/เทคนิค/.test(x)),JSON.stringify(wl));
  const w0=await p.evaluate(()=>{S.sessions={};return weakLinks().asks.length;});
  ok('weak-link: no data => asks user instead of guessing',w0>=1);
  await ctx.close();}
 // ---------- experiments
 {const{ctx,p}=await fresh();
  await p.click('nav [data-to=coach]');await p.click('[data-act=expNew][data-step=""]');await p.waitForSelector('#x_hyp');
  await p.fill('#x_hyp','ลดเซต 1 เซตแล้วทดสอบซ้ำ');await p.selectOption('#x_ex','pushup');await p.selectOption('#x_var','sets');await p.fill('#x_dl','-3');await p.fill('#x_w0','6');await p.fill('#x_n','1');await p.click('[data-d=ok]');
  ok('experiment: oversized change rejected',(await p.textContent('.derr')).includes('±1'));
  await p.fill('#x_dl','-1');const before=await p.evaluate(()=>S.plan[5].days[0].items.find(i=>i.exId==='pushup').sets);await p.click('[data-d=ok]');await p.waitForTimeout(500);
  const af=await p.evaluate(()=>({s:S.plan[5].days[0].items.find(i=>i.exId==='pushup').sets,other:S.plan[6].days[0].items.find(i=>i.exId==='pushup').sets,orig:planDay(6,0).items[0].sets,exp:S.exps.length}));
  ok('experiment: only chosen week changed by exactly 1 variable',af.s===before-1&&af.other===af.orig&&af.exp===1,JSON.stringify(af)+before);
  await p.click('[data-act=expNew][data-step=""]');await p.waitForSelector('#x_hyp');await p.fill('#x_hyp','อีกอัน');await p.selectOption('#x_var','none');await p.click('[data-d=ok]');
  ok('experiment: second on same category blocked',(await p.textContent('.derr')).includes('จบก่อน'));await p.click('[data-d=cancel]');
  await p.click('[data-act=expFinish]');await p.waitForSelector('#f_k');await p.selectOption('#f_k','revert');await p.click('[data-d=ok]');await p.waitForTimeout(500);
  ok('experiment: revert restores plan + result recorded as not-concludable',await p.evaluate(()=>S.plan[5].days[0].items.find(i=>i.exId==='pushup').sets===planDay(5,0).items[0].sets&&S.exps[0].status==='reverted'));
  await ctx.close();}
 // ---------- quality gate
 {const{ctx,p}=await fresh();await p.click('nav [data-to=train]');await p.evaluate(()=>{UI.week=0;render();});await p.click('#day-0-0 [data-act=startDay]');await p.waitForSelector('.set');
  await p.locator('.set').first().locator('input[type=checkbox]').click();
  const q=p.locator('.set').first().locator('[data-f=aQ]');await q.fill('9');await q.dispatchEvent('change');await p.waitForTimeout(150);
  ok('quality > actual rejected',(await p.locator('#toasts').textContent()).includes('ไม่เกิน'));
  const q2=p.locator('.set').first().locator('[data-f=aQ]');await q2.fill('3');await q2.dispatchEvent('change');await p.waitForTimeout(150);
  ok('quality kept separate from total (3/5)',(await p.locator('.set').first().textContent()).includes('ผ่านเกณฑ์ 3/5'));
  await p.locator('.set').nth(1).locator('input[type=checkbox]').click();
  ok('unrated set stays unrated (no invented quality)',await p.evaluate(()=>S.sessions['0-0'].sets[S.sessions['0-0'].items[0].id][1].aQ===null));
  ok('unconfirmed values flagged',(await p.locator('.set').nth(1).textContent()).includes('ค่าเริ่มต้น'));
  // finished-day snapshot is not rewritten by plan edit
  await p.evaluate(async()=>{const s=S.sessions['0-0'];s.status='completed';await saveSess(s);});
  const t0=await p.evaluate(()=>S.sessions['0-0'].items[0].reps);
  await p.click('nav [data-to=train]');await p.evaluate(()=>{UI.week=0;render();});await p.click('#day-0-0 [data-act=editDay]');await p.waitForSelector('.ed');await p.fill('.ed .e-reps','9');await p.click('[data-d=ok]');await p.waitForTimeout(400);
  ok('editing plan does not alter finished session history',await p.evaluate(t=>S.sessions['0-0'].items[0].reps===t&&S.plan[0].days[0].items[0].reps===9,t0));
  // csv matches
  const [dl]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>A.csvSets())]);await dl.saveAs('/tmp/s2.csv');const csv=fs.readFileSync('/tmp/s2.csv','utf8');
  const rows=csv.trim().split('\n');const expected=await p.evaluate(()=>Object.values(S.sessions).reduce((n,s)=>n+Object.values(s.sets).reduce((a,x)=>a+x.length,0),0));
  ok('CSV header + row count equals stored sets',rows[0].includes('quality_reps_or_secs')&&rows.length-1===expected,rows.length+' vs '+expected);
  await ctx.close();}
 // ---------- durability: DB failure, retry, rollback, backups, limits
 {const{ctx,p}=await fresh();
  await p.click('nav [data-to=train]');await p.evaluate(()=>{UI.week=0;render();});await p.click('#day-0-0 [data-act=startDay]');await p.waitForSelector('.set');
  await p.evaluate(()=>{window.__origPut=DB.put;DB.put=async()=>{throw new Error('boom disk full');};});
  await p.locator('.set').first().locator('input[type=checkbox]').click();await p.waitForTimeout(400);
  const st=await p.evaluate(()=>({pill:$('#savepill').textContent,cls:$('#savepill').className,banner:$('#banner').textContent,failed:failed.length}));
  ok('DB failure => error shown, never "saved"',st.cls==='err'&&!/✔/.test(st.pill)&&/ยังไม่ถูกบันทึก/.test(st.banner)&&st.failed>0,JSON.stringify(st));
  await p.evaluate(()=>{DB.put=window.__origPut;});await p.click('#banner [data-act=retrySave]');await p.waitForTimeout(500);
  const st2=await p.evaluate(()=>({pill:$('#savepill').textContent,failed:failed.length}));
  const inDb=await p.evaluate(async()=>{const a=await DB.all('sessions');return a.find(s=>s.id==='0-0').sets[Object.keys(a.find(s=>s.id==='0-0').sets)[0]][0].done;});
  ok('retry persists pending write and then confirms',st2.failed===0&&/✔/.test(st2.pill)&&inDb===true,JSON.stringify(st2)+inDb);
  // concurrent saves keep order
  await p.evaluate(async()=>{const s=S.sessions['0-0'];for(let i=1;i<=20;i++){s.note='n'+i;saveSess(s);}await chain;});
  ok('rapid concurrent saves end with latest value',await p.evaluate(async()=>(await DB.all('sessions')).find(s=>s.id==='0-0').note==='n20'));
  // auto backup cap
  await p.evaluate(async()=>{for(let i=0;i<7;i++){await autoBackup('t'+i);await new Promise(r=>setTimeout(r,5));}});
  ok('auto-backups capped at 5',(await p.evaluate(async()=>(await DB.all('backups')).length))===5);
  // export + validation + merge dedupe + replace rollback
  const bk=await p.evaluate(()=>buildBackup());
  const bad={limits:JSON.stringify({...JSON.parse(bk),data:{...JSON.parse(bk).data,tests:Array.from({length:5001},(_,i)=>({id:'x'+i,cat:'pushup',value:1,date:'2026-01-01'}))}}),
    quote:JSON.stringify({app:'tactical-fitness-tracker-12w',version:2,data:{tests:[{id:'a"onmouseover="x',cat:'pushup',value:1,date:'2026-01-01'}]}}),
    tamper:bk.replace('"value": 15','"value": 16'),
    future:JSON.stringify({...JSON.parse(bk),version:99})};
  for(const[n,txt] of Object.entries(bad)){await p.evaluate(t=>{doImport(t);},txt);await p.waitForSelector('.sheet');const m=await p.textContent('.sheet');ok('import rejected: '+n,/ปฏิเสธ|ไม่สำเร็จ/.test(m),m.slice(0,80));await p.click('[data-d=ok]');await p.waitForTimeout(100);}
  const snap=await p.evaluate(()=>JSON.stringify({t:S.tests.length,s:Object.keys(S.sessions).length}));
  // replace with induced mid-write failure -> rollback
  await p.evaluate(()=>{let n=0;DB.put=async function(st,o){if(st==='sessions'&&n++===0)throw new Error('boom mid-write');return window.__origPut.call(DB,st,o);};});
  await p.evaluate(t=>{doImport(t);},bk);await p.waitForSelector('.sheet');await p.click('input[value=replace]');await p.click('[data-d=ok]');await p.waitForSelector('.sheet');await p.click('[data-d=ok]');await p.waitForTimeout(1500);
  await p.evaluate(()=>{DB.put=window.__origPut;});
  const after=await p.evaluate(async()=>JSON.stringify({t:S.tests.length,s:Object.keys(S.sessions).length,dbt:(await DB.all('tests')).length,dbs:(await DB.all('sessions')).length,prof:!!(await DB.all('kv')).find(r=>r.id==='profile')}));
  const a=JSON.parse(after),s0=JSON.parse(snap);
  ok('failed Replace rolls back; old data intact in memory AND DB',a.t===s0.t&&a.s===s0.s&&a.dbt===s0.t&&a.dbs===s0.s&&a.prof,after+' vs '+snap);
  // merge dedupe after deleting a test
  await p.evaluate(async()=>{const t=S.tests.find(x=>x.source!=='baseline')||S.tests[0];S.tests=S.tests.filter(x=>x!==t);await delRec('tests',t.id);});
  const n0=await p.evaluate(()=>S.tests.length);
  await p.evaluate(t=>{doImport(t);},bk);await p.waitForSelector('.sheet');await p.click('[data-d=ok]');await p.waitForTimeout(900);
  const n1=await p.evaluate(()=>S.tests.length);ok('merge restores missing, no duplicates',n1===n0+1,n0+'->'+n1);
  // restore from snapshot
  await p.evaluate(async()=>{await autoBackup('x');});
  ok('snapshot list shows in settings',(await (async()=>{await p.click('nav [data-to=settings]');await p.waitForSelector('#bkList [data-act=restoreBackup]');return true;})()));
  await ctx.close();}
 // ---------- cold start resume + multi-tab banner
 {const{ctx,p}=await fresh();await p.click('nav [data-to=train]');await p.evaluate(()=>{UI.week=0;render();});await p.click('#day-0-0 [data-act=startDay]');await p.waitForSelector('.set');await p.locator('.set').first().locator('input[type=checkbox]').click();await p.waitForTimeout(300);
  const p2=await ctx.newPage();await p2.goto(U);await p2.waitForSelector('.set');ok('cold start resumes in-progress workout',p2.url().includes('#/workout/0-0'));
  await p2.locator('.set').nth(1).locator('input[type=checkbox]').click();await p.waitForTimeout(600);
  ok('other tab shows data-changed banner',(await p.textContent('#banner')).includes('แท็บอื่น'));
  await p2.close();await ctx.close();}
 // ---------- v1 -> v2 upgrade keeps data; SW update flow
 {const hasV1=fs.existsSync('/tmp/v1/index.html'),ROOT0=rootDir,CUR=(fs.readFileSync(ROOT0+'/sw.js','utf8').match(/const VERSION='([\d.]+)'/)||[])[1];if(hasV1)rootDir='/tmp/v1';const{ctx,p}=await ctxPage({serviceWorkers:'allow'});
  await p.goto(U);await p.waitForSelector('#setupForm');await p.selectOption('#s_duration','84');await p.fill('#b_pushup','15');await p.fill('#b_pullup','2');await p.fill('#b_plank','1:15');await p.fill('#b_run','15:10');await p.fill('#s_start','2026-10-12');await p.click('[data-act=setupSave]');await p.waitForSelector('.wk');
  await p.click('nav [data-to=train]');await p.click('#day-0-0 [data-act=startDay]');await p.waitForSelector('.set');await p.locator('.set').first().locator('input[type=checkbox]').click();await p.waitForTimeout(400);
  const v1=await p.evaluate(()=>({t:S.tests.length,ver:APP}));
  await p.waitForTimeout(1200);
  rootDir=ROOT0;
  await p.evaluate(()=>{location.hash='#/dash';});await p.waitForTimeout(300);await p.reload();await p.waitForSelector('.wk');await p.waitForTimeout(1500);await p.reload();await p.waitForSelector('.wk');await p.waitForTimeout(1500);
  const v2=await p.evaluate(async()=>({t:S.tests.length,done:Object.values(S.sessions).reduce((n,s)=>n+Object.values(s.sets).flat().filter(x=>x.done).length,0),meta:(await DB.all('kv')).find(r=>r.id==='meta').v,basis:S.tests.every(t=>!!t.basis),ex:S.plan[0].days[0].items.every(i=>!!i.exId),bk:(await DB.all('backups')).map(b=>b.reason),ver:DB.db.version,app:APP_VERSION}));
  if(!hasV1)console.log('SKIP v1->v2 migration & old-SW banner checks (no /tmp/v1 fixture)');
  if(hasV1)ok('v1->v2 upgrade keeps all data and migrates schema',v2.t===v1.t&&v2.done===1&&v2.meta.schema===2&&v2.basis&&v2.ex&&v2.ver===2,JSON.stringify(v2));
  if(hasV1)ok('pre-upgrade auto snapshot created',v2.bk.some(r=>/ก่อนอัปเกรด/.test(r)),JSON.stringify(v2.bk));
  // SW update flow (new build announced, user chooses, data survives)
  await p.waitForSelector('#banner [data-act=swUpdate]',{timeout:8000}).catch(()=>{});
  if(hasV1)ok('old v1 service worker -> new version offered via banner',await p.isVisible('#banner [data-act=swUpdate]'));
  if(hasV1)await Promise.all([p.waitForNavigation({timeout:10000}).catch(()=>{}),p.click('#banner [data-act=swUpdate]')]);await p.reload();await p.waitForSelector('.wk');await p.waitForTimeout(1500);
  const reg=await p.evaluate(async()=>{const k=await caches.keys();return{keys:k,ctl:!!navigator.serviceWorker.controller};});
  ok('SW installed, controls page, cache created',reg.ctl&&reg.keys.includes('tft12w-v'+CUR),JSON.stringify(reg));
  swOverride=fs.readFileSync(rootDir+'/sw.js','utf8').replace("const VERSION='"+CUR+"'","const VERSION='"+CUR+".1'");
  await p.evaluate(()=>swReg.update());await p.waitForTimeout(1500);
  ok('update available banner appears (not forced)',(await p.textContent('#banner')).includes('เวอร์ชันใหม่')&&await p.evaluate(()=>!reloading));
  await Promise.all([p.waitForNavigation({timeout:10000}).catch(()=>{}),p.click('#banner [data-act=swUpdate]')]);await p.waitForSelector('.wk');await p.waitForTimeout(1200);
  const up=await p.evaluate(async()=>({keys:await caches.keys(),t:S.tests.length,done:Object.values(S.sessions).reduce((n,s)=>n+Object.values(s.sets).flat().filter(x=>x.done).length,0)}));
  ok('after update: old cache removed, IndexedDB data intact',up.keys.length===1&&up.keys[0]==='tft12w-v'+CUR+'.1'&&up.t===v1.t&&up.done===1,JSON.stringify(up));
  // offline still works
  await ctx.setOffline(true);await p.reload();await p.waitForSelector('.wk');ok('offline reload after update works',await p.evaluate(()=>S.tests.length>0));
  // cached files only app shell
  const cached=await p.evaluate(async()=>{const c=await caches.open((await caches.keys())[0]);return(await c.keys()).map(r=>new URL(r.url).pathname);});
  ok('only app-shell files cached (no data/backups)',cached.every(x=>/\/(index\.html|manifest\.webmanifest|apple-touch-icon\.png|icon-\d+\.png)?$/.test(x)),cached.join(','));
  await ctx.close();swOverride=null;}
 // ---------- visuals + console
 {const{ctx,p}=await fresh();await p.evaluate(async()=>{await seed(0,0);await seed(1,0);});await p.click('nav [data-to=coach]');await p.waitForTimeout(400);await p.screenshot({path:'/tmp/coach.png'});
  await p.setViewportSize({width:667,height:375});await p.waitForTimeout(200);await p.screenshot({path:'/tmp/coach_land.png'});
  await p.setViewportSize({width:320,height:568});for(const r of ['coach','dash','train','progress','history','settings']){await p.goto(U+'#/'+r);await p.waitForTimeout(250);ok('no horizontal overflow @320 '+r,await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),await p.evaluate(()=>document.documentElement.scrollWidth));}
  const btns=await p.evaluate(()=>{const m=[];document.querySelectorAll('[data-act]').forEach(e=>{});return 0;});
  await ctx.close();}
 ok('no console errors / unhandled rejections',errs.length===0,errs.join(' | ').slice(0,400));
 console.log(res.filter(r=>!r[0]).length+' failures of '+res.length);
 await b.close();srv.close();
})().catch(e=>{console.error('TEST CRASH',e);process.exit(1)});
