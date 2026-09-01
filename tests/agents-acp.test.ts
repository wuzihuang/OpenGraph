import { describe,expect,it } from 'vitest';import { discoverAgents } from '../packages/agent-registry/src/index.ts';import { normalizeAcpUpdate,PROTOCOL_VERSION,redactSecrets } from '../packages/acp-client/src/index.ts';import { MockAcpAgent } from '../packages/mock-acp-agent/src/index.ts';
describe('agent discovery and ACP normalization',()=>{
  it('discovers configured candidates without tokens',async()=>{const agents=await discoverAgents();expect(agents.map(x=>x.id)).toEqual(expect.arrayContaining(['claude','codex','kimi','qoder','cursor','zcode']));expect(JSON.stringify(agents)).not.toMatch(/access[_-]?token/i)});
  it('normalizes ACP events through one path',()=>{expect(normalizeAcpUpdate({kind:'terminal',payload:{delta:'ok'}})).toEqual({type:'agent.terminal.delta',payload:{delta:'ok'}});expect(PROTOCOL_VERSION).toBeTruthy()});
  it('supports local sessions, cancel, and secret redaction',()=>{const agent=new MockAcpAgent(),session=agent.newSession();agent.cancel(session);expect(agent.sessions.get(session)?.cancelled).toBe(true);expect(redactSecrets('token=secret-value')).toBe('token=[REDACTED]')});
});
