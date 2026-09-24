import { getStore } from '@netlify/blobs';

export const MIN_SALARY_INR = 1_500_000;
const ROLE = /mechanical|design engineer|product development|manufacturing engineer|engineering project|cad engineer|r&d engineer|plm engineer|new product development|renewable energy/i;
const terms = ['solidworks','gd&t','dfmea','plm','product design','mechanical design','manufacturing','design validation','cad','engineering change','renewable energy','product development'];
export function score(job){const s = `${job.title} ${job.description}`.toLowerCase();return Math.round(100*terms.filter(x=>s.includes(x)).length/terms.length);}
export function eligible(job){return !!(job.salaryVerified && Number(job.salaryInr)>=MIN_SALARY_INR && job.qualificationsVerified && job.workAuthorizationVerified && job.resumeVerified && job.applicationApiSupported && job.status==='Ready' && /^https:\/\//.test(job.url||''));}
export function key(job){return `${job.source}:${job.externalId}`;}
export function parseBoards(raw){return String(raw||'').split(/[\s,;]+/).filter(x=>/^[a-z0-9_-]+$/i.test(x)).slice(0,25);}
export function normalizeGreenhouse(x,board){return {id:key({source:'greenhouse',externalId:String(x.id)}),source:'greenhouse',externalId:String(x.id),board,title:x.title||'',company:board,location:x.location?.name||'Not specified',description:String(x.content||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,9000),url:x.absolute_url||'',salaryInr:null,salaryVerified:false,qualificationsVerified:false,workAuthorizationVerified:false,resumeVerified:false,applicationApiSupported:false,status:'Discovered',score:0,createdAt:new Date().toISOString()};}
export function normalizeLever(x,site){return {id:key({source:'lever',externalId:String(x.id)}),source:'lever',externalId:String(x.id),board:site,title:x.text||'',company:site,location:x.categories?.location||'Not specified',description:String(x.descriptionPlain||'').slice(0,9000),url:x.hostedUrl||'',salaryInr:null,salaryVerified:false,qualificationsVerified:false,workAuthorizationVerified:false,resumeVerified:false,applicationApiSupported:false,status:'Discovered',score:0,createdAt:new Date().toISOString()};}
export const store = ()=>getStore('dhanesh-job-tool-v2');
export async function read(){return await store().get('jobs',{type:'json'})||{jobs:[],runs:[],submissions:[]};}
export async function write(s){await store().setJSON('jobs',s);}
export function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});}
export function auth(req){const supplied=req.headers.get('authorization')||'';const token=process.env.ADMIN_TOKEN;return !!(token&&token.length>=24&&supplied===`Bearer ${token}`);}
export async function discover(){
 const s=await read(), existing=new Set(s.jobs.map(x=>x.id));let added=0,checked=0,errors=[];
 const sources=[...parseBoards(process.env.GREENHOUSE_BOARDS).map(b=>({kind:'greenhouse',board:b,url:`https://boards-api.greenhouse.io/v1/boards/${b}/jobs?content=true`})),...parseBoards(process.env.LEVER_SITES).map(b=>({kind:'lever',board:b,url:`https://api.lever.co/v0/postings/${b}?mode=json`}))];
 for(const source of sources){try{const c=new AbortController();const timer=setTimeout(()=>c.abort(),12000);let resp;try{resp=await fetch(source.url,{signal:c.signal,headers:{accept:'application/json'}});}finally{clearTimeout(timer);}if(!resp.ok)throw Error('HTTP '+resp.status);const data=await resp.json();const rows=source.kind==='greenhouse'?data.jobs:data;if(!Array.isArray(rows))throw Error('Missing jobs array');for(const row of rows){checked++;const job=source.kind==='greenhouse'?normalizeGreenhouse(row,source.board):normalizeLever(row,source.board);if(!ROLE.test(job.title)||existing.has(job.id))continue;job.score=score(job);if(job.score<20)continue;s.jobs.push(job);existing.add(job.id);added++;}}catch(e){errors.push(`${source.kind}/${source.board}: ${String(e.message).slice(0,120)}`);}}
 const run={at:new Date().toISOString(),sources:sources.length,checked,added,errors};s.runs.unshift(run);s.runs=s.runs.slice(0,30);await write(s);return run;
}
export async function submitReady(){const s=await read(),endpoint=process.env.APPLICATION_ADAPTER_URL,token=process.env.APPLICATION_ADAPTER_TOKEN;let submitted=0,failed=0,skipped=0;
 if(!endpoint||!token||!/^https:\/\//.test(endpoint))return {submitted,failed,skipped:s.jobs.filter(eligible).length,reason:'No authorized application adapter configured'};
 for(const j of s.jobs.filter(eligible).slice(0,10)){if(s.submissions.some(a=>a.jobId===j.id&&a.result==='confirmed'))continue;
 const attemptId=`${j.id}:${new Date().toISOString()}`;j.status='Submitting';await write(s);
 try{const c=new AbortController();const timer=setTimeout(()=>c.abort(),20000);let r;try{r=await fetch(endpoint,{method:'POST',signal:c.signal,headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':j.id},body:JSON.stringify({job:{id:j.id,source:j.source,externalId:j.externalId,url:j.url,title:j.title,company:j.company},candidate:{name:'Dhanesh Balakrishna',noticePeriodDays:90,currentCtcInr:1200000,expectedCtcInr:1700000,minimumCtcInr:MIN_SALARY_INR,locationPreference:'Worldwide',workAuthorization:'Confirm for each country and employer'},applicationIdempotencyKey:j.id})});}finally{clearTimeout(timer);}
 const body=await r.json().catch(()=>({}));if(!r.ok||body.status!=='submitted'||!body.confirmationId)throw Error('Adapter did not return verified submission confirmation');s.submissions.push({attemptId,jobId:j.id,result:'confirmed',confirmationId:String(body.confirmationId).slice(0,150),at:new Date().toISOString()});j.status='Applied';j.appliedAt=new Date().toISOString();submitted++;
 }catch(e){s.submissions.push({attemptId,jobId:j.id,result:'unconfirmed',error:String(e.message).slice(0,200),at:new Date().toISOString()});j.status='Needs review';failed++;}await write(s);
 }return {submitted,failed,skipped};}
