import { createInterface } from 'node:readline';
import { MockAcpAgent } from './index.ts';
const agent=new MockAcpAgent(),rl=createInterface({input:process.stdin});
const send=(value:unknown)=>process.stdout.write(`${JSON.stringify(value)}\n`);
rl.on('line',async line=>{const request=JSON.parse(line);if(request.method==='initialize')send({id:request.id,result:agent.initialize()});else if(request.method==='session/new')send({id:request.id,result:{sessionId:agent.newSession()}});else if(request.method==='session/cancel'){agent.cancel(request.params.sessionId);send({id:request.id,result:{cancelled:true}})}else if(request.method==='session/prompt'){const result=await agent.execute(request.params.envelope,request.params.sessionId,update=>send({method:'session/update',params:update}));send({id:request.id,result})}});
