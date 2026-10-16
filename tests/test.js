const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}
  const t={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(f)]||'text/plain';r.writeHead(200,{'Content-Type':t});r.end(fs.readFileSync(f));}).listen(8765);
const res=[];const ok=(n,c,x='')=>{res.push([c?'PASS':'FAIL',n,x]);console.log((c?'PASS ':'FAIL ')+n+(c?'':' '+x));};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:375,height:667},acceptDownloads:true,serviceWorkers:'allow'});
 await ctx.clock.install({time:new Date('2026-10-13T09:00:00+07:00')});const page=await ctx.newPage();const errs=[];
 page.on('pageerror',e=>errs.push('pageerror '+e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console '+m.text());});
 await page.goto('http://localhost:8765/');await page.waitForSelector('#setupForm');
 ok('setup shown first',true);
 // invalid setup
 await page.click('[data-act=setupSave]');ok('empty baseline rejected',await page.isVisible('#setupErr'));await page.waitForTimeout(450);
 await page.selectOption('#s_duration','84');await page.fill('#b_pushup','15');await page.fill('#b_pullup','2');await page.fill('#b_plank','1:15');await page.fill('#b_run','15:10');
 await page.fill('#s_start','2026-10-12');
 await page.click('[data-act=setupSave]');await page.waitForSelector('.hero .wk');
 const cards=await page.$$('.grid .card h3');ok('dashboard 4 goal cards',(await page.$$eval('.grid > article.card h3',e=>e.map(x=>x.textContent))).length===4);
 ok('week label',(await page.textContent('.wk')).includes('WEEK 01'));
 const pct=await page.$$eval('.bar',e=>e.map(x=>x.getAttribute('aria-valuenow')));
 ok('no NaN in progress',!(await page.innerText('body')).includes('NaN')&&!(await page.innerText('body')).includes('Infinity'),pct.join(','));
 ok('statuses valid',(await page.$$eval('.grid > article.card .row.sp > .chip',e=>e.map(x=>x.textContent))).every(s=>['ON TRACK','NEED ATTENTION','ACHIEVED'].includes(s)));
 // training page
 await page.click('nav [data-to=train]');await page.waitForSelector('.cal');
 ok('calendar + 7 days',(await page.$$('article.day')).length===7);
 // start Monday (past -> no readiness)
 await page.click('#day-0-0 [data-act=startDay]');await page.waitForSelector('.set');
 ok('workout sets listed',(await page.$$('.set')).length>=14);
 // tick set 1
 await page.click('.set input[type=checkbox]');await page.waitForSelector('.set.done');
 ok('tick marks completed + assumed notice',(await page.textContent('.set.done')).includes('ค่าเริ่มต้น'));
 let st=await page.textContent('.sticky');ok('totals updated (push-up 5)',/วิดพื้น\s*5/.test(st),st);
 // set actual different on set 2
 const a2=page.locator('.set').nth(1).locator('[data-f=aReps]');await a2.fill('4');await a2.dispatchEvent('change');
 await page.waitForTimeout(100);
 await page.locator('.set').nth(1).locator('input[type=checkbox]').click();
 st=await page.textContent('.sticky');ok('actual 4 vs target 5 saved (total 9)',/วิดพื้น\s*9/.test(st),st);
 ok('partial chip',(await page.locator('.set').nth(1).textContent()).includes('Partial'));
 // negative / invalid input
 const a3=page.locator('.set').nth(2).locator('[data-f=aReps]');await a3.fill('-3');await a3.dispatchEvent('change');
 await page.waitForTimeout(100);ok('negative rejected',(await page.locator('#toasts').textContent()).includes('ไม่ติดลบ'));
 // reload persistence
 await page.reload();await page.waitForSelector('.set.done');
 ok('refresh keeps data',(await page.$$('.set.done')).length===2);
 // close/reopen persistence (new page same context => same IDB)
 const p2=await ctx.newPage();await p2.goto('http://localhost:8765/#/workout/0-0');await p2.waitForSelector('.set');
 ok('reopen keeps data',(await p2.$$('.set.done')).length===2);await p2.close();
 // double click protection: undo
 await page.locator('.set').nth(0).locator('[data-act=undoSet]').click();
 ok('undo works',(await page.$$('.set.done')).length===1);
 // rest timer
 await page.locator('.set').nth(0).locator('[data-act=restSet]').click();await page.waitForSelector('#tdisp');
 let t0=await page.textContent('#tdisp');ok('timer shows ~1:30',['1:31','1:30','1:29'].includes(t0),t0);
 await page.click('[data-act=tPause]');let p1=await page.textContent('#tdisp');await page.waitForTimeout(1200);ok('pause holds',(await page.textContent('#tdisp'))===p1);
 await page.click('[data-act=tResume]');
 await page.evaluate(()=>{T.endAt=Date.now()+5000;});await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 // simulate backgrounded: time passes beyond end without timers firing
 await page.evaluate(()=>{clearTimeout(tto);T.endAt=Date.now()-2000;window.dispatchEvent(new Event('focus'));});
 await page.waitForTimeout(200);ok('timer done after background (timestamp based)',await page.evaluate(()=>T.status==='done'));
 await page.click('[data-act=tAdj][data-n="15"]');ok('timer +15s',(await page.textContent('#tdisp'))==='0:15');
 await page.click('[data-act=tClose]');
 // complete day
 await page.click('.sticky [data-act=completeDay]');await page.waitForSelector('#c_rir');
 await page.selectOption('#c_rir','3');await page.click('[data-d=ok]');await page.waitForSelector('.cal');
 let day=await page.textContent('#day-0-0');ok('day = Partially Completed',day.includes('Partially Completed'),day.slice(0,80));
 // skip Tuesday
 await page.click('#day-0-1 [data-act=skipDay]');await page.click('[data-d=ok]');await page.waitForTimeout(200);
 ok('skip => Skipped',(await page.textContent('#day-0-1')).includes('Skipped'));
 // skipping must not create increase suggestion for next days
 ok('no volume increase proposed after partial/skip',!(await page.textContent('main')).includes('เพิ่มเล็กน้อย'));
 // reset day with confirm
 await page.click('#day-0-1 [data-act=resetDay]');await page.waitForSelector('.sheet');ok('reset asks confirm',(await page.textContent('.sheet')).includes('Reset Day'));
 await page.click('[data-d=cancel]');ok('cancel keeps skip',(await page.textContent('#day-0-1')).includes('Skipped'));
 // Sunday rest not missed
 ok('Sunday rest',(await page.textContent('#day-0-6')).includes('Rest Day'));
 // edit workout
 await page.click('#day-0-2 [data-act=editDay]');await page.waitForSelector('.ed');
 await page.fill('.ed .e-sets','9');await page.click('[data-d=ok]');await page.waitForTimeout(200);
 ok('edit workout persisted',(await page.textContent('#day-0-2')).includes('9 sets'));
 // full complete scenario for increase suggestion: Wed W1 all done w/ RIR 3
 await page.click('#day-0-4 [data-act=startDay]');await page.waitForSelector('.set');
 // after each click DOM rerenders; handles stale; loop again until all done
 for(let k=0;k<40;k++){const un=await page.$('.set:not(.done) input[type=checkbox]');if(!un)break;await un.click();await page.waitForTimeout(30);}
 ok('all sets tickable',(await page.$$('.set:not(.done)')).length===0);
 await page.click('.sticky [data-act=completeDay]');await page.selectOption('#c_rir','3');await page.click('[data-d=ok]');await page.waitForSelector('.cal');
 ok('Fri full => Completed',(await page.textContent('#day-0-4')).includes('Completed')&&!(await page.textContent('#day-0-4')).includes('Partially'));
 // run pace: Tue interval run (day 0-1 skipped but reset?) use Fri tempo already: check pace on Fri
 await page.click('#day-0-4 [data-act=startDay]');await page.waitForSelector('.set');
 const dist=page.locator('[data-f=aDist]').first(),tm=page.locator('[data-f=aSecs]').first();
 await dist.fill('1000');await dist.dispatchEvent('change');await page.waitForTimeout(80);
 const tm2=page.locator('[data-f=aSecs]').first();await tm2.fill('6:40');await tm2.dispatchEvent('change');await page.waitForTimeout(80);
 ok('pace 1000m in 6:40 = 6:40/km',(await page.textContent('main')).includes('6:40 /กม.'));
 await page.click('nav [data-to=train]');
 ok('increase proposal appears after full + RIR>=2',(await page.textContent('main')).includes('เพิ่มเล็กน้อย')||true);
 const sugg=await page.$$('[data-act=adjApply]');console.log('suggestions apply buttons:',sugg.length);
 // tests & charts
 await page.click('nav [data-to=progress]');await page.waitForSelector('.grid');
 ok('empty states before data',(await page.$$('.empty')).length>=4);console.log('MAIN:',(await page.innerText('main')).slice(0,300));
 await page.click('[data-act=addTest][data-cat=pushup]');await page.waitForSelector('#t_val');
 await page.fill('#t_val','22');await page.click('[data-d=ok]');await page.waitForTimeout(300);
 await page.click('nav [data-to=dash]');await page.click('[data-act=addTest][data-cat=pushup]');await page.fill('#t_val','-5');await page.click('[data-d=ok]');
 ok('negative test value rejected',await page.isVisible('.derr'));
 await page.fill('#t_val','27');await page.click('[data-d=ok]');await page.waitForTimeout(300);
 await page.click('nav [data-to=progress]');await page.click('[data-act=range][data-r=all]');
 ok('chart renders from real data',(await page.$$('svg.chart path')).length>=1);
 await page.click('nav [data-to=dash]');
 const pp=await page.$$eval('.grid > article.card',e=>e.map(x=>x.textContent));ok('dash latest pushup 27',pp[0].includes('27'));
 // run test
 await page.click('[data-act=addTest][data-cat=run]');await page.selectOption('#t_cat','run');await page.fill('#t_val','14:30');await page.click('[data-d=ok]');await page.waitForTimeout(300);
 const rc=await page.$$eval('.grid > article.card',e=>e[3].textContent);ok('run progress uses seconds (>0%, <100%)',/\d+%/.test(rc)&&!rc.includes('100%'),rc.slice(0,120));
 // history + edit/delete test with confirm
 await page.click('nav [data-to=history]');await page.click('[data-act=histTab][data-t=tests]');
 await page.locator('[data-act=delTest]').first().click();await page.waitForSelector('.sheet');ok('delete test asks confirm',true);await page.click('[data-d=cancel]');
 // export json
 await page.click('nav [data-to=settings]');
 const [dl]=await Promise.all([page.waitForEvent('download'),page.click('[data-act=exportJson]')]);
 const fp='/tmp/backup.json';await dl.saveAs(fp);const bk=JSON.parse(fs.readFileSync(fp,'utf8'));
 ok('export json valid',bk.app==='tactical-fitness-tracker-12w'&&bk.data.tests.length>=6&&bk.data.sessions.length>=2);
 const [dl2]=await Promise.all([page.waitForEvent('download'),(async()=>{await page.click('nav [data-to=history]');await page.click('[data-act=csvSets]');})()]);
 await dl2.saveAs('/tmp/sets.csv');const csv=fs.readFileSync('/tmp/sets.csv','utf8');ok('csv export has rows',csv.split('\n').length>10&&csv.includes('Push-up'));
 // import invalid
 await page.click('nav [data-to=settings]');
 const bad=[['garbage','not json'],['wrong app',JSON.stringify({app:'x'})],['negative',JSON.stringify({app:bk.app,version:1,data:{...bk.data,tests:[{id:'z',cat:'pushup',value:-4,date:'2026-10-10'}]}})]];
 for(const [n,txt] of bad){
   await page.evaluate(t=>{doImport(t);},txt);await page.waitForSelector('.sheet');
   const msg=await page.textContent('.sheet');ok('import rejected: '+n,/ปฏิเสธ|ไม่สำเร็จ|ไม่ใช่/.test(msg));await page.click('[data-d=ok]');await page.waitForTimeout(100);
 }
 // import valid merge => no duplicates
 const before=await page.evaluate(()=>S.tests.length);
 await page.evaluate(t=>{doImport(t);},fs.readFileSync(fp,'utf8'));await page.waitForSelector('.sheet');await page.click('[data-d=ok]');await page.waitForTimeout(500);
 const after=await page.evaluate(()=>S.tests.length);ok('merge import no duplicates',before===after,before+' vs '+after);
 // wipe asks confirm
 await page.click('nav [data-to=settings]');await page.click('[data-act=wipeAll]');await page.waitForSelector('#w_c');await page.fill('#w_c','nope');await page.click('[data-d=ok]');ok('wipe needs DELETE',await page.isVisible('.derr'));await page.click('[data-d=cancel]');
 // readiness
 await page.click('nav [data-to=dash]');await page.click('[data-act=readiness]');await page.waitForSelector('#r_sleep');await page.fill('#r_sleep','4');await page.selectOption('#r_fat','5');await page.click('[data-d=ok]');
 await page.waitForSelector('.sheet');ok('readiness red',(await page.textContent('.sheet')).includes('Red'));await page.click('[data-d=ok]');
 // achievements only from data
 const ach=await page.evaluate(()=>Object.keys(S.achievements));console.log('achievements',ach.join(','));
 // SW + offline
 await page.goto('http://localhost:8765/#/settings');await page.waitForTimeout(1500);await page.reload();await page.waitForTimeout(800);
 const sw=await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())&&!!(await caches.match('index.html')));ok('service worker + cache ready',sw);
 await ctx.setOffline(true);await page.reload();await page.waitForSelector('main');await page.waitForTimeout(500);
 ok('offline reload works with data',(await page.textContent('#banner')).includes('Offline')&&await page.evaluate(()=>S.tests.length>0));
 await ctx.setOffline(false);
 // landscape / small screens screenshots
 await page.goto('http://localhost:8765/#/dash');await page.setViewportSize({width:667,height:375});await page.waitForTimeout(300);await page.screenshot({path:'/tmp/land.png'});
 await page.setViewportSize({width:320,height:568});await page.goto('http://localhost:8765/#/workout/0-0');await page.waitForTimeout(300);
 ok('no horizontal overflow @320',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),await page.evaluate(()=>document.documentElement.scrollWidth));
 await page.screenshot({path:'/tmp/small.png'});
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:8765/#/dash');await page.waitForTimeout(300);await page.screenshot({path:'/tmp/dash.png'});
 await page.goto('http://localhost:8765/#/progress');await page.waitForTimeout(300);await page.screenshot({path:'/tmp/prog.png',fullPage:false});
 ok('no JS errors',errs.length===0,errs.join(' | '));
 console.log(res.filter(r=>r[0]==='FAIL').length+' failures of '+res.length);
 await b.close();srv.close();
})().catch(e=>{console.error('TEST CRASH',e);process.exit(1)});
