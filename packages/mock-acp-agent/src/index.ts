import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NodeResult, TaskEnvelope, VerificationResult } from '../../contracts/src/index.ts';
import type { AcpUpdate } from '../../acp-client/src/index.ts';
const wait=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('ACP_CANCELLED'))},{once:true})});
export class MockAcpAgent{
  readonly sessions=new Map<string,{cancelled:boolean;role:string}>();
  initialize(){return {protocolVersion:'1',capabilities:{sessionResume:true,toolCalls:true,terminalStream:true,fileEdits:true,plans:true}}}
  newSession(role='worker'){const id=`mock_${role}_${randomUUID()}`;this.sessions.set(id,{cancelled:false,role});return id}
  cancel(sessionId:string){const session=this.sessions.get(sessionId);if(session)session.cancelled=true}
  async execute(envelope:TaskEnvelope,sessionId:string,emit:(update:AcpUpdate)=>void,signal?:AbortSignal):Promise<NodeResult>{
    emit({kind:'plan',payload:{entries:[{content:'Inspect explicit inputs and workspace policy',status:'in_progress'},{content:'Produce contracted artifact',status:'pending'},{content:'Run physical checks',status:'pending'}]}});await wait(25,signal);
    emit({kind:'message',payload:{delta:`Starting ${envelope.nodeId} in isolated session.`}});if(envelope.objective.includes('[permission]'))emit({kind:'permission',payload:{operation:'network',status:'requested'}});emit({kind:'tool_started',payload:{tool:'read_files',title:'Read contracted inputs'}});await wait(20,signal);emit({kind:'tool_updated',payload:{tool:'read_files',status:'completed'}});if(envelope.objective.includes('[fail]'))return {status:'failed',summary:'Controlled mock failure',changedFiles:[],artifacts:[],evidence:[]};
    if(envelope.objective.includes('[delay]'))await wait(1_500,signal);if(signal?.aborted||this.sessions.get(sessionId)?.cancelled)return {status:'cancelled',summary:'Cancelled by runtime',changedFiles:[],artifacts:[],evidence:[]};
    const changedFiles=envelope.writeGlobs.length?[envelope.writeGlobs[0]!.replace(/\/\*\*.*$/,'/mock-output.ts')]:[];for(const file of changedFiles){const path=join(envelope.workspace,file);await mkdir(join(path,'..'),{recursive:true});await writeFile(path,`export const ${envelope.nodeId.replace(/-/g,'_')}Attempt = ${envelope.attempt};\n`)}emit({kind:'terminal',payload:{delta:`mock-agent: executing ${envelope.acceptanceCommands.join(', ')||'artifact checks'}\n`}});emit({kind:'diff',payload:{summary:`Generated ${envelope.outputContract.map(item=>item.name).join(', ')}`}});emit({kind:'plan',payload:{entries:[{content:'Inspect explicit inputs and workspace policy',status:'completed'},{content:'Produce contracted artifact',status:'completed'},{content:'Run physical checks',status:'completed'}]}});
    return {status:'completed',summary:`Completed ${envelope.nodeId}`,changedFiles,artifacts:envelope.outputContract.map(item=>({name:item.name,path:`${envelope.workspace}/${item.name}`})),evidence:envelope.acceptanceCommands.map(command=>({type:'command',command,exitCode:0}))};
  }
  async verify(nodeId:string,attempt:number,sessionId:string,artifacts:string[]):Promise<VerificationResult>{await wait(20);const deliberate=nodeId==='implement_dashboard'&&attempt===1;return {accepted:!deliberate,sessionId,reasons:deliberate?['Dashboard reconnect evidence missing on first attempt']:[],checkedArtifacts:artifacts}}
}
