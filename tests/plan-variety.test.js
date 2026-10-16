/* Browser check: plan variety, test days, equipment fallback. Run: node tests/plan-variety.test.js (needs playwright) */
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}
 const t={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(f)]||'text/plain';r.writeHead(200,{'Content-Type':t});r.end(fs.readFileSync(f));}).listen(8791);
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8791/');await pg.waitForTimeout(800);
const out=await pg.evaluate(()=>{
 const res=[];
 const run=(dur,pri,base,eq,mins)=>{S.profile={start:mondayOf(today()),baseline:base,durationDays:dur,priority:pri,minutesPerDay:mins,equipment:eq,goals:{}};
  const plan=buildPlan();const days=[];for(let n=0;n<dur;n++){const w=Math.floor(n/7),d=n%7;days.push(plan[w].days[d]);}
  const ids=new Set();days.forEach(x=>x.items.forEach(i=>ids.add(i.exId)));
  const bad=[];days.forEach((x,n)=>x.items.forEach(i=>{const E=EX[i.exId];if(!E&&i.exId!=='custom')bad.push('noEX '+i.exId);if(E&&E.needs&&!hasEquip(E.needs))bad.push('equip '+i.exId+' d'+n);if(i.exId==='pullup'&&base.pullup<1)bad.push('strict0');}));
  return{dur,pri,tests:days.map((x,n)=>/Test/.test(x.title)?n+1:0).filter(Boolean),distinct:ids.size,bad:[...new Set(bad)],maxItems:Math.max(...days.map(x=>x.items.length)),sample:[0,1,3,5,7,21].map(n=>days[n]&&days[n].title),zero:days.filter(x=>!x.items.length).length};};
 res.push(run(30,'pushpull',{pushup:15,pullup:0},{bar:true,band:true},120));
 res.push(run(30,'pushpull',{pushup:6,pullup:2},{bar:true,band:false},45));
 res.push(run(30,'balanced',{pushup:25,pullup:5},{bar:false,band:true},90));
 res.push(run(56,'pushpull',{pushup:20,pullup:3},{bar:true,band:true},90));
 return res;});
let fail=0;out.forEach(o=>{const ok=o.tests.length===3&&!o.bad.length&&o.distinct>=9;console.log((ok?'PASS ':'FAIL ')+o.dur+'d '+o.pri+' tests@'+o.tests+' variants='+o.distinct+' '+o.bad.join(','));if(!ok)fail++;});if(fail)process.exitCode=1;console.log('pageerrors',errs);
await b.close();srv.close();})();
