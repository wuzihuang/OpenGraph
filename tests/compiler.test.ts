import { describe,expect,it } from 'vitest';import { GraphSpecV1 } from '../packages/contracts/src/index.ts';import { lintGraphSpec } from '../packages/graph-compiler/src/index.ts';import { createDemoSpec } from '../packages/graph-runtime/src/demo.ts';
const fresh=()=>structuredClone(createDemoSpec('/tmp/sample'));
describe('GraphSpec schema and deterministic linter',()=>{
  it('validates GraphSpec v1',()=>expect(GraphSpecV1.safeParse(fresh()).success).toBe(true));
  it('detects fake edges',()=>{const spec=fresh();spec.edges[0]!.artifacts=[];expect(lintGraphSpec(spec).issues.map(x=>x.code)).toContain('FAKE_EDGE_NO_ARTIFACT')});
  it('detects missing inputs',()=>{const spec=fresh();spec.nodes[1]!.inputs=['missing.contract'];expect(lintGraphSpec(spec).issues.map(x=>x.code)).toContain('MISSING_INPUT_PRODUCER')});
  it('detects unbounded cycles',()=>{const spec=fresh();spec.edges.push({from:'acceptance',to:'analyze_repo',artifacts:['run-report.json']});expect(lintGraphSpec(spec).issues.map(x=>x.code)).toContain('UNBOUNDED_CYCLE')});
  it('detects parallel write-set conflicts',()=>{const spec=fresh();spec.nodes[2]!.workspace.writeGlobs=['src/runtime/**'];expect(lintGraphSpec(spec).issues.map(x=>x.code)).toContain('PARALLEL_WRITESET_CONFLICT')});
  it('enforces width budget',()=>{const spec=fresh();spec.policies.maxParallel=1;expect(lintGraphSpec(spec).issues.map(x=>x.code)).toContain('WIDTH_BUDGET_EXCEEDED')});
  it('requires a fresh verifier for writers',()=>{const spec=fresh();spec.nodes[1]!.verifierPolicy.freshSession=false;expect(lintGraphSpec(spec).issues.map(x=>x.code)).toContain('MISSING_VERIFIER')});
  it('detects duplicate node ids',()=>{const spec=fresh();spec.nodes.push(structuredClone(spec.nodes[0]!));expect(lintGraphSpec(spec).issues.map(x=>x.code)).toContain('DUPLICATE_NODE_ID')});
});
