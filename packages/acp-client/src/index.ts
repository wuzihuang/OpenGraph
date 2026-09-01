import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import type { RunEventType } from '../../contracts/src/index.ts';
export { PROTOCOL_VERSION };
export type AcpUpdate={kind:'message'|'plan'|'tool_started'|'tool_updated'|'terminal'|'permission'|'diff';payload:Record<string,unknown>};
const mapping:Record<AcpUpdate['kind'],RunEventType>={message:'agent.message.delta',plan:'agent.plan.snapshot',tool_started:'agent.tool.started',tool_updated:'agent.tool.updated',terminal:'agent.terminal.delta',permission:'agent.permission.requested',diff:'agent.diff'};
export function normalizeAcpUpdate(update:AcpUpdate){return {type:mapping[update.kind],payload:update.payload}}
export const SAFE_ENV_KEYS=['PATH','LANG','LC_ALL','TERM','TMPDIR','SHELL'] as const;
export function safeEnvironment(env:NodeJS.ProcessEnv=process.env){return Object.fromEntries(SAFE_ENV_KEYS.flatMap(key=>env[key]===undefined?[]:[[key,env[key]!]]))}
export function redactSecrets(value:string){return value.replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,'$1=[REDACTED]').replace(/(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{16,}/g,'[REDACTED]')}
