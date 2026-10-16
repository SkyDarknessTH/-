/* Browser check: v2.6 personal progression rate + evidence table.
   Run: NODE_PATH=$(npm root -g) node tests/personal-rate.test.js */
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}
 const t={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webmanifest':'application/manifest+json'}[path.extname(f)]||'text/plain';r.writeHead(200,{'Content-Type':t});r.end(fs.readFileSync(f));}).listen(8795);
let fail=0;const ck=(n,ok,x)=>{console.log((ok?'PASS ':'FAIL ')+n+(ok?'':' '+JSON.stringify(x||'')));if(!ok)fail++;};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
const pg=await b.newPage({viewport:{width:375,height:700}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8795/');await pg.waitForTimeout(800);

/* A. no history: level prior only, never above the chosen pace */
const a=await pg.evaluate(()=>{S.tests=[];const out={};['pushup','pullup','plank'].forEach(l=>{const base=grindRate('fast',false);out[l]=[grindPersonal(l,'fast',false,3).rate/base,grindPersonal(l,'fast',false,20).rate/base,grindPersonal(l,'fast',false,500).rate/base];});return out;});
ck('level prior: beginner = full pace, higher stats slower, monotonic',['pushup','pullup','plank'].every(l=>a[l][0]===1&&a[l][1]<=a[l][0]&&a[l][2]<=a[l][1]&&a[l][2]<1),a);

/* B. history: needs >=2 measured std tests >=14 days apart */
const B=await pg.evaluate(()=>{
 const mk=(cat,date,value,o)=>Object.assign({id:'t'+Math.random(),cat,date,value,source:'test',basis:'measured',std:true,createdAt:Date.now()},o||{});
 const r={};
 S.tests=[mk('pushup','2026-08-03T08:00',20)];r.one=grindPersonal('pushup','fast',false,20).obs;
 S.tests=[mk('pushup','2026-08-03T08:00',20),mk('pushup','2026-08-10T08:00',24)];r.short=grindPersonal('pushup','fast',false,24).obs;
 S.tests=[mk('pushup','2026-08-03T08:00',20),mk('pushup','2026-08-24T08:00',23,{basis:'estimate'}),mk('pushup','2026-08-24T08:00',23,{std:false})];r.filtered=grindPersonal('pushup','fast',false,23).obs;
 /* fast improver: 20 -> 30 over 4 weeks (~10.7%/wk) still capped by pace */
 S.tests=[mk('pushup','2026-08-03T08:00',20),mk('pushup','2026-08-31T08:00',30)];const f=grindPersonal('pushup','fast',false,30);r.fast={rate:f.rate,base:f.base,prior:f.prior,w:f.w,obs:f.obs};
 const s=grindPersonal('pushup','steady',false,30);r.cap=s.rate<=s.base;
 /* stalled: 20 -> 20 over 8 weeks pulls the rate down toward the floor but never below 2% */
 S.tests=[mk('pushup','2026-08-03T08:00',20),mk('pushup','2026-09-28T08:00',20)];const st=grindPersonal('pushup','fast',false,20);r.stall={rate:st.rate,prior:st.prior,w:st.w};
 /* declining (best-of used) cannot give a negative rate */
 S.tests=[mk('pushup','2026-08-03T08:00',20),mk('pushup','2026-09-28T08:00',15)];r.decl=grindPersonal('pushup','fast',false,15).rate;
 /* weight grows with weeks, max .6 */
 S.tests=[mk('pushup','2026-08-03T08:00',20),mk('pushup','2026-08-17T08:00',22)];r.w2=grindPersonal('pushup','fast',false,22).w;
 S.tests=[mk('pushup','2026-01-03T08:00',20),mk('pushup','2026-09-17T08:00',22)];r.wmax=grindPersonal('pushup','fast',false,22).w;
 return r;});
ck('no observed rate with 1 test, <14 days, or non-measured/non-standard tests',B.one==null&&B.short==null&&B.filtered==null,B);
ck('fast improver: history raises the rate above the level prior but never above the pace ceiling',B.fast.obs>B.fast.base&&B.fast.rate>B.fast.prior&&B.fast.rate<=B.fast.base&&B.cap,B.fast);
ck('stalled history lowers the rate below the level prior but not under 2%',B.stall.rate<B.stall.prior&&B.stall.rate>=0.02,B.stall);
ck('declining results never produce a negative/zero rate',B.decl>=0.02,B.decl);
ck('history weight grows with weeks and is capped at 60%',B.w2>0&&B.w2<B.wmax&&Math.abs(B.wmax-0.6)<1e-9,[B.w2,B.wmax]);

/* C. estimates use the personal rate (stalled lifter -> longer plan than no history) */
const C=await pg.evaluate(()=>{
 const mk=(cat,date,value)=>({id:'t'+Math.random(),cat,date,value,source:'test',basis:'measured',std:true,createdAt:Date.now()});
 S.tests=[];const none=grindEstimate('pushup',12,20,'fast');
 S.tests=[mk('pushup','2026-08-03T08:00',12),mk('pushup','2026-09-28T08:00',12)];const stall=grindEstimate('pushup',12,20,'fast');
 const two=grindEstimate2({lift:'pushup',cur:12,tgt:20},{lift:'plank',cur:40,tgt:70},'fast');
 return{none:none.days,stall:stall.days,stallReach:stall.reach,two:two.days};});
ck('stalled history gives an estimate at least as long as no history',C.stall>=C.none,C);

/* D. evidence table renders in Settings with source + confidence on every row */
const D=await pg.evaluate(()=>({n:EVIDENCE.length,ok:EVIDENCE.every(e=>e.k&&e.s&&['R','C','E'].includes(e.c)),
  cover:['6/10/15/20','0.75','negative','Deload'].every(k=>EVIDENCE.some(e=>(e.k+e.v).includes(k)))}));
ck('every rule has source text and a confidence class; key rules covered',D.n>=6&&D.ok&&D.cover,D);
await pg.evaluate(()=>{S.tests=[];});
await pg.selectOption('#s_priority','grind').catch(()=>{});
const html=await pg.evaluate(()=>evidenceCard());
ck('evidence card HTML lists all rows with confidence chips',(html.match(/class="card"/g)||[]).length>=D.n+1&&/ประมาณการ/.test(html)&&/<details>/.test(html),html.length);
ck('no page errors',!errs.length,errs);
console.log(fail?fail+' FAILED':'ALL PASS');await b.close();srv.close();process.exit(fail?1:0);})();
