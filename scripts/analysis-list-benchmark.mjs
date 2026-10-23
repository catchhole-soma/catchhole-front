import { chromium, request } from '@playwright/test';
import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { performance as nodePerformance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
const options=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,all)=>x.startsWith('--')?[...a,[x.slice(2),all[i+1]]]:a,[]));
const credentials=JSON.parse(await readFile(options.credentials,'utf8'));
for(const key of ['api','frontend']) if(!['127.0.0.1','localhost'].includes(new URL(credentials[key]).hostname)) throw Error('Localhost runtime required');
const out=options.output; await mkdir(out,{recursive:true});
const smoke=options.smoke==='true'; const protocol={warmups:smoke?0:3,pages:smoke?1:20,apiSamples:smoke?1:30,reloadSets:smoke?0:5,viewport:{width:1280,height:800},timeoutMs:60000,drainAfterReadyAndLoadMs:2000};
const auth=await request.newContext();
const login=await auth.post(credentials.api+'/api/v1/auth/login',{data:{email:credentials.email,password:credentials.password}});
if(!login.ok()) throw Error('Dedicated local login failed: '+login.status());
const token=(await login.json()).data.accessToken;
const storageState=await auth.storageState(); await auth.dispose();
const browser=await chromium.launch({headless:true});
const samples=[]; const apiSamples=[];
const write=async(name,value)=>{await appendFile(`${out}/${name}.jsonl`,JSON.stringify(value)+'\n');};
function installReadiness(){
  window.__analysisReady=null;
  const specs=[{range:'1~30화',status:'분석 취소',group:['18/30 완료','12 취소'],button:'취소 확인',character:342,world:296},{range:'31~60화',status:'일부 분석 중단',group:['2/30 완료','1 실패','27 대기'],button:'실패 확인',character:56,world:113}];
  function check(){
    const cards=[...document.querySelectorAll('.analysis-batch-card')]; if(cards.length!==2)return false;
    return specs.every(spec=>{
      const card=cards.find(el=>el.querySelector('.analysis-batch-card__title')?.textContent?.includes(spec.range));
      if(!card||!card.querySelector('.analysis-batch-card__title')?.textContent?.includes('30개 회차'))return false;
      if(card.querySelector('.analysis-status')?.textContent?.trim()!==spec.status)return false;
      const text=card.textContent??'';
      if(!spec.group.every(g=>text.includes(g))||!text.includes(`캐릭터 설정 후보 0/${spec.character}개 검토 완료`)||!text.includes(`세계관 설정 후보 0/${spec.world}개 검토 완료`))return false;
      if(text.includes('출처를 확인하고')||text.includes('출처를 확인하지 못'))return false;
      const button=[...card.querySelectorAll('button')].find(el=>el.textContent.trim()===spec.button);
      if(!button||button.disabled||button.getBoundingClientRect().width<=0)return false;
      const box=button.getBoundingClientRect(), x=Math.min(innerWidth-1,Math.max(0,box.x+box.width/2)), y=box.y+box.height/2;
      return y>=0&&y<innerHeight&&button.contains(document.elementFromPoint(x,y));
    });
  }
  let armed=false;
  function tick(){if(window.__analysisReady)return;if(check()&&!armed){armed=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(check())window.__analysisReady={pageReadyMs:performance.now(),timeOriginEpochMs:performance.timeOrigin,cardAssertions:specs};else armed=false;}));}requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
}
async function newPage(){
 const context=await browser.newContext({storageState,viewport:protocol.viewport,serviceWorkers:'block'});
 await context.addInitScript(({token})=>localStorage.setItem('accessToken',token),{token});
 await context.addInitScript(installReadiness);
 const page=await context.newPage();
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 const preflights=[];const byId=new Map();
 cdp.on('Network.requestWillBeSent',e=>{if(e.type==='Preflight'||e.request.method==='OPTIONS'||e.initiator?.type==='preflight'){const row={url:e.request.url,method:e.request.method,startEpochMs:e.wallTime*1000,startCdpSeconds:e.timestamp,finished:false};byId.set(e.requestId,row);preflights.push(row);}});
 cdp.on('Network.responseReceived',e=>{const row=byId.get(e.requestId);if(row)row.status=e.response.status;});
 cdp.on('Network.loadingFinished',e=>{const row=byId.get(e.requestId);if(row)Object.assign(row,{finished:true,endEpochMs:row.startEpochMs+(e.timestamp-row.startCdpSeconds)*1000,encodedDataLength:e.encodedDataLength,transferBytesObserved:e.encodedDataLength>0});});
 cdp.on('Network.loadingFailed',e=>{const row=byId.get(e.requestId);if(row)Object.assign(row,{finished:true,failed:true,error:e.errorText});});
 page.__benchmarkPreflights=preflights;return {context,page};
}
async function navigate(context,page,kind,index,reload=false){
 const events=new Map(), pending=new Set(), errors=[]; const started=nodePerformance.now();const preflightOffset=page.__benchmarkPreflights.length;
 const collector=p=>{pending.add(p);p.finally(()=>pending.delete(p));};
 const onRequest=req=>{events.set(req,{url:req.url(),method:req.method(),resourceType:req.resourceType(),timing:req.timing(),finished:false,failed:false});};
 const onFinished=req=>collector((async()=>{const row=events.get(req);if(!row)return; const response=await req.response(); await response?.finished(); Object.assign(row,{finished:true,status:response?.status(),timing:req.timing(),sizes:await req.sizes()});})().catch(e=>errors.push(String(e))));
 const onFailed=req=>{const row=events.get(req);if(row)Object.assign(row,{finished:true,failed:true,failure:req.failure()?.errorText,timing:req.timing()});};
 const onPageError=e=>errors.push(String(e));
 context.on('request',onRequest);context.on('requestfinished',onFinished);context.on('requestfailed',onFailed);page.on('pageerror',onPageError);
 const sample={kind,index,reload,success:false};
 try{
   if(reload)await page.reload({waitUntil:'commit',timeout:60000});
   else await page.goto(`${credentials.frontend}/dashboard?workId=${credentials.workId}&nav=analyses`,{waitUntil:'commit',timeout:60000});
   await page.waitForFunction(()=>window.__analysisReady,{timeout:60000,polling:20});
   const ready=await page.evaluate(()=>window.__analysisReady); Object.assign(sample,ready);
   await page.waitForFunction(()=>performance.getEntriesByType('navigation')[0]?.loadEventEnd>0,{timeout:Math.max(1,60000-(nodePerformance.now()-started))});
   sample.loadEventEndMs=await page.evaluate(()=>performance.getEntriesByType('navigation')[0].loadEventEnd);
   sample.firstLoadStartCutoffMs=Math.max(sample.pageReadyMs,sample.loadEventEndMs)+2000;
   await page.waitForFunction(cutoff=>performance.now()>=cutoff,sample.firstLoadStartCutoffMs,{timeout:Math.max(1,60000-(nodePerformance.now()-started))});
   while(nodePerformance.now()-started<60000){
      const first=[...events.values()].filter(r=>!r.timing||r.timing.startTime-sample.timeOriginEpochMs<=sample.firstLoadStartCutoffMs);
      if(first.every(r=>r.finished)&&pending.size===0)break;
      await new Promise(r=>setTimeout(r,25));
   }
   sample.success=true;
 }catch(e){sample.error=String(e).split('\n')[0];sample.location=new URL(page.url()).pathname;Object.assign(sample,await page.evaluate(()=>({timeOriginEpochMs:performance.timeOrigin,loadEventEndMs:performance.getEntriesByType('navigation')[0]?.loadEventEnd??0})).catch(()=>({})));}
 await Promise.allSettled([...pending]);
 const network=[...events.values()].map(row=>{const start=row.timing?row.timing.startTime-sample.timeOriginEpochMs:null,end=row.timing?.responseEnd>=0?start+row.timing.responseEnd:null;return {...row,startMs:start,endMs:end,firstLoad:start===null||sample.firstLoadStartCutoffMs===undefined||start<=sample.firstLoadStartCutoffMs,finishedAfterReady:end!==null&&end>sample.pageReadyMs,censored:!row.finished};});
 Object.assign(sample,{cdpPreflights:page.__benchmarkPreflights.slice(preflightOffset),preflightBytesLabel:'CDP encodedDataLength; separate from Playwright responseBodySize',requests:network,collectorErrors:errors,observedApiRequests:network.filter(x=>x.url.startsWith(credentials.api+'/api/')).length,inFlightAtReady:network.filter(x=>x.startMs<=sample.pageReadyMs&&(x.endMs===null||x.endMs>sample.pageReadyMs)).length,firstLoadCompleteMs:Math.max(0,...network.filter(x=>x.firstLoad&&x.endMs!==null).map(x=>x.endMs))});
 sample.success=sample.success&&!errors.length&&!network.some(r=>r.firstLoad&&(r.censored||r.failed||r.status>=400));
 await write('pages',sample); samples.push(sample);
 if(kind==='smoke'||kind==='navigation'&&index===0){await page.screenshot({path:`${out}/${kind}-${index}.png`,fullPage:true});await writeFile(`${out}/${kind}-${index}-visible-text.txt`,await page.locator('body').innerText());}
 context.off('request',onRequest);context.off('requestfinished',onFinished);context.off('requestfailed',onFailed);page.off('pageerror',onPageError);
 return sample;
}
const batchesRoute=`${credentials.api}/api/v1/works/${credentials.workId}/analysis-jobs/batches?page=0&size=10`;
async function measureApi(kind,index){let row={kind,index};const start=nodePerformance.now();try{const response=await fetch(batchesRoute,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000)});const body=Buffer.from(await response.arrayBuffer());Object.assign(row,{status:response.status,latencyMs:nodePerformance.now()-start,decodedResponseBytes:body.length,contentEncoding:response.headers.get('content-encoding'),success:response.ok});}catch(e){Object.assign(row,{latencyMs:nodePerformance.now()-start,error:String(e),success:false});}await write('api',row);apiSamples.push(row);}
await measureApi('initial-cold-jvm-request',0);
for(let i=0;i<protocol.warmups;i++){const {context,page}=await newPage();await navigate(context,page,'warmup',i);await context.close();}
for(let i=0;i<protocol.pages;i++){const {context,page}=await newPage();await navigate(context,page,smoke?'smoke':'navigation',i);await context.close();}
for(let set=0;set<protocol.reloadSets;set++){const {context,page}=await newPage();await navigate(context,page,'reload-setup',set);for(let i=0;i<2;i++)await navigate(context,page,'double-reload',set*2+i,true);await context.close();}
for(let i=0;i<protocol.warmups;i++)await measureApi('warmup',i);
for(let i=0;i<protocol.apiSamples;i++)await measureApi('measured',i);
function stats(values){const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);return {n:sorted.length,median:sorted.length?(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.ceil((sorted.length-1)/2)])/2:null,p95:sorted[Math.ceil(sorted.length*.95)-1]??null,max:sorted.at(-1)??null};}
const main=samples.filter(x=>x.kind==='navigation'||x.kind==='smoke');
await writeFile(`${out}/summary.json`,JSON.stringify({protocol,browserVersion:browser.version(),runnerSha256:createHash('sha256').update(await readFile(import.meta.filename)).digest('hex'),measuredNavigation:{total:main.length,success:main.filter(x=>x.success).length,failures:main.filter(x=>!x.success).length,pageReadyMs:stats(main.filter(x=>x.success).map(x=>x.pageReadyMs)),loadEventEndMs:stats(main.filter(x=>x.success).map(x=>x.loadEventEndMs))},measuredApi:{total:protocol.apiSamples,failures:apiSamples.filter(x=>x.kind==='measured'&&!x.success).length,latencyMs:stats(apiSamples.filter(x=>x.kind==='measured'&&x.success).map(x=>x.latencyMs))},reloads:{total:samples.filter(x=>x.kind==='double-reload').length,failures:samples.filter(x=>x.kind==='double-reload'&&!x.success).length}},null,2)+'\n');
await browser.close();console.log(JSON.stringify({output:out,measuredPages:main.length,failures:main.filter(x=>!x.success).length}));
