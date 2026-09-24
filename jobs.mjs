import {auth,json,read,write,discover,submitReady,eligible,MIN_SALARY_INR} from './core.mjs';
export default async(req)=>{
 if(!auth(req))return json({error:'Unauthorized: configure ADMIN_TOKEN and enter it in the dashboard'},401);
 try{if(req.method==='GET'){const s=await read();return json({jobs:s.jobs,runs:s.runs,submissions:s.submissions,minSalaryInr:MIN_SALARY_INR,adapterConfigured:!!(process.env.APPLICATION_ADAPTER_URL&&process.env.APPLICATION_ADAPTER_TOKEN)});}
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const body=await req.json().catch(()=>({}));if(body.action==='discover')return json({run:await discover()});if(body.action==='apply')return json({result:await submitReady()});
 if(body.action==='review'){const s=await read(),j=s.jobs.find(x=>x.id===body.id);if(!j)return json({error:'Job not found'},404);
 const salary=Number(body.salaryInr);if(!Number.isFinite(salary)||salary<0)return json({error:'Invalid salary'},400);
 j.salaryInr=salary;j.salaryEvidence=String(body.salaryEvidence||'').slice(0,500);j.salaryVerified=salary>=MIN_SALARY_INR&&/^https:\/\//.test(j.salaryEvidence)&&body.salaryVerified===true;
 j.qualificationsVerified=body.qualificationsVerified===true;j.workAuthorizationVerified=body.workAuthorizationVerified===true;j.resumeVerified=body.resumeVerified===true;j.applicationApiSupported=body.applicationApiSupported===true;
 j.status=eligible({...j,status:'Ready'})?'Ready':'Needs review';await write(s);return json({job:j});}
 return json({error:'Unknown action'},400);
 }catch(e){return json({error:String(e.message||e).slice(0,250)},500);}
};
