import { END, START, StateGraph, StateSchema } from '@langchain/langgraph';
import { z } from 'zod';
import { GraphSpecV1, type GraphNode, type GraphSpec, type RunState } from '../../contracts/src/index.ts';

export const lintCodes=['DUPLICATE_NODE_ID','ORPHAN_NODE','UNKNOWN_EDGE_SOURCE','UNKNOWN_EDGE_TARGET','MISSING_INPUT_PRODUCER','UNUSED_OUTPUT','FAKE_EDGE_NO_ARTIFACT','UNBOUNDED_CYCLE','NODE_RESPONSIBILITY_TOO_BROAD','PARALLEL_WRITESET_CONFLICT','MISSING_ACCEPTANCE_CHECK','MISSING_VERIFIER','WIDTH_BUDGET_EXCEEDED','INVALID_APPROVAL_BOUNDARY','INVALID_RETRY_POLICY'] as const;
export type LintCode=typeof lintCodes[number]; export type LintIssue={code:LintCode|'SINGLE_AGENT_RECOMMENDED';severity:'error'|'warning';message:string;nodeIds?:string[]};
const overlaps=(a:string,b:string)=>{const prefix=(value:string)=>value.replace(/[*{[].*$/,'').replace(/\/$/,'');const x=prefix(a),y=prefix(b);return x===''||y===''||x.startsWith(y)||y.startsWith(x)};
export function lintGraphSpec(input:unknown):{valid:boolean;issues:LintIssue[];spec?:GraphSpec}{
  const parsed=GraphSpecV1.safeParse(input); if(!parsed.success)return {valid:false,issues:[{code:'MISSING_INPUT_PRODUCER',severity:'error',message:parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('; ')}]};
  const spec=parsed.data,issues:LintIssue[]=[]; const ids=new Set<string>(),nodes=new Map<string,GraphNode>();
  for(const node of spec.nodes){if(ids.has(node.id))issues.push({code:'DUPLICATE_NODE_ID',severity:'error',message:`Duplicate node ${node.id}`,nodeIds:[node.id]});ids.add(node.id);nodes.set(node.id,node)}
  const incident=new Map(spec.nodes.map(node=>[node.id,0])); const produced=new Map<string,string>(); const consumed=new Set<string>();
  for(const node of spec.nodes)for(const output of node.outputs)produced.set(output.name,node.id);
  for(const edge of spec.edges){
    if(!nodes.has(edge.from))issues.push({code:'UNKNOWN_EDGE_SOURCE',severity:'error',message:`Unknown edge source ${edge.from}`}); if(!nodes.has(edge.to))issues.push({code:'UNKNOWN_EDGE_TARGET',severity:'error',message:`Unknown edge target ${edge.to}`});
    if(edge.artifacts.length===0)issues.push({code:'FAKE_EDGE_NO_ARTIFACT',severity:'error',message:`${edge.from} → ${edge.to} carries no artifact`});
    if(nodes.has(edge.from))incident.set(edge.from,(incident.get(edge.from)??0)+1); if(nodes.has(edge.to))incident.set(edge.to,(incident.get(edge.to)??0)+1); for(const artifact of edge.artifacts)consumed.add(artifact);
  }
  if(spec.nodes.length>1)for(const [id,count] of incident)if(count===0)issues.push({code:'ORPHAN_NODE',severity:'error',message:`Node ${id} is isolated`,nodeIds:[id]});
  for(const node of spec.nodes){for(const inputName of node.inputs)if(!produced.has(inputName)&&inputName!=='repo')issues.push({code:'MISSING_INPUT_PRODUCER',severity:'error',message:`${node.id} requires ${inputName} with no producer`,nodeIds:[node.id]});
    const broad=['design','frontend','backend','test','deploy'].filter(word=>node.objective.toLowerCase().includes(word));if(broad.length>=4)issues.push({code:'NODE_RESPONSIBILITY_TOO_BROAD',severity:'error',message:`${node.id} combines too many responsibilities`,nodeIds:[node.id]});
    if(!node.acceptanceChecks.length&&node.kind!=='human')issues.push({code:'MISSING_ACCEPTANCE_CHECK',severity:'error',message:`${node.id} has no acceptance check`,nodeIds:[node.id]});
    if(node.workspace.writeGlobs.length&&(!node.verifierPolicy.required||!node.verifierPolicy.freshSession))issues.push({code:'MISSING_VERIFIER',severity:'error',message:`${node.id} needs a fresh verifier`,nodeIds:[node.id]});
    if(node.retryPolicy.maxAttempts>spec.policies.maxNodeAttempts||node.retryPolicy.maxAttempts<1)issues.push({code:'INVALID_RETRY_POLICY',severity:'error',message:`${node.id} retry policy exceeds graph policy`,nodeIds:[node.id]});
    if(node.irreversible&&node.approvalPolicy==='none')issues.push({code:'INVALID_APPROVAL_BOUNDARY',severity:'error',message:`${node.id} is irreversible without approval`,nodeIds:[node.id]});
  }
  for(const [name,producer] of produced)if(!consumed.has(name)&&nodes.get(producer)?.kind!=='acceptance'&&nodes.get(producer)?.kind!=='verifier')issues.push({code:'UNUSED_OUTPUT',severity:'error',message:`${name} from ${producer} is unused`,nodeIds:[producer]});
  const indegree=new Map(spec.nodes.map(node=>[node.id,0]));const outgoing=new Map(spec.nodes.map(node=>[node.id,[] as string[]]));for(const edge of spec.edges)if(nodes.has(edge.from)&&nodes.has(edge.to)){indegree.set(edge.to,(indegree.get(edge.to)??0)+1);outgoing.get(edge.from)!.push(edge.to)}
  const queue=[...indegree].filter(([,degree])=>degree===0).map(([id])=>id),levels:string[][]=[];let visited=0;while(queue.length){const level=queue.splice(0);levels.push(level);visited+=level.length;for(const id of level)for(const next of outgoing.get(id)??[]){indegree.set(next,indegree.get(next)!-1);if(indegree.get(next)===0)queue.push(next)}}
  if(visited<spec.nodes.length&&!spec.edges.some(edge=>/max_iterations|give_up|dry_round_limit/.test(edge.condition??'')))issues.push({code:'UNBOUNDED_CYCLE',severity:'error',message:'Graph contains an unbounded cycle'});
  for(const level of levels){if(level.length>spec.policies.maxParallel)issues.push({code:'WIDTH_BUDGET_EXCEEDED',severity:'error',message:`Ready width ${level.length} exceeds ${spec.policies.maxParallel}`,nodeIds:level});for(let i=0;i<level.length;i++)for(let j=i+1;j<level.length;j++){const a=nodes.get(level[i]!)!,b=nodes.get(level[j]!)!;if(a.workspace.writeGlobs.some(x=>b.workspace.writeGlobs.some(y=>overlaps(x,y))))issues.push({code:'PARALLEL_WRITESET_CONFLICT',severity:'error',message:`${a.id} and ${b.id} have overlapping write scopes`,nodeIds:[a.id,b.id]})}}
  if(spec.executionMode==='graph'&&spec.nodes.length<=2)issues.push({code:'SINGLE_AGENT_RECOMMENDED',severity:'warning',message:'This small graph may be cheaper as single_agent'});
  return {valid:!issues.some(issue=>issue.severity==='error'),issues,spec};
}

const RuntimeState=new StateSchema({runId:z.string(),graphVersion:z.string(),repoRef:z.string(),nodeIndex:z.record(z.string(),z.string()),artifactIndex:z.record(z.string(),z.object({path:z.string(),hash:z.string()})),budgetState:z.object({startedAt:z.string(),attempts:z.number()}),decisionFlags:z.record(z.string(),z.union([z.boolean(),z.string()])),finalStatus:z.string()});
export function compileGraphSpec(spec:GraphSpec,runner:(node:GraphNode,state:RunState)=>Promise<Partial<RunState>>){const validation=lintGraphSpec(spec);if(!validation.valid)throw new Error(`Invalid GraphSpec: ${validation.issues.map(issue=>issue.code).join(', ')}`);const graph:any=new StateGraph(RuntimeState);for(const node of spec.nodes)graph.addNode(node.id,async (state:RunState)=>runner(node,state));const incoming=new Set(spec.edges.map(edge=>edge.to));for(const node of spec.nodes)if(!incoming.has(node.id))graph.addEdge(START,node.id);for(const edge of spec.edges)graph.addEdge(edge.from,edge.to);const outgoing=new Set(spec.edges.map(edge=>edge.from));for(const node of spec.nodes)if(!outgoing.has(node.id))graph.addEdge(node.id,END);return graph.compile()}
