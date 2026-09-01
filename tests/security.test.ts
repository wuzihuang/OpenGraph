import { describe,expect,it } from 'vitest';import { plannerToolNames } from '../packages/plugin-mcp/src/index.ts';import type { RunState } from '../packages/contracts/src/index.ts';
describe('security invariants',()=>{
  it('does not expose planner approval or execution tools',()=>{expect(plannerToolNames).not.toContain('approve_and_run');expect(plannerToolNames.every(name=>!name.includes('approve'))).toBe(true)});
  it('keeps runtime state at eight top-level fields',()=>{const state:RunState={runId:'r',graphVersion:'v',repoRef:'main',nodeIndex:{},artifactIndex:{},budgetState:{startedAt:'now',attempts:0},decisionFlags:{},finalStatus:'pending'};expect(Object.keys(state)).toHaveLength(8)});
});
