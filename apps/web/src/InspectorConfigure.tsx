import { ShieldCheck, Sparkles, TerminalSquare } from "lucide-react";
import type { GraphNode } from "./types.ts";

type InspectorConfigureProps = {
  active: GraphNode;
  agentOptions: string[];
  validationValid: boolean;
  onUpdateActive: (change: Partial<GraphNode>) => void;
  onSaveAmendment: () => void;
};

export function InspectorConfigure(props: InspectorConfigureProps) {
  const {
    active,
    agentOptions,
    validationValid,
    onUpdateActive,
    onSaveAmendment,
  } = props;
  return (
    <>
      <section>
        <label htmlFor="agent-select">Agent</label>
        <select
          id="agent-select"
          className="field field-select"
          value={active.agentSelector.preferredAgents[0] ?? "Auto"}
          onChange={function changeAgent(event) {
            onUpdateActive({
              agentSelector: {
                preferredAgents:
                  event.target.value === "Auto" ? [] : [event.target.value],
              },
            });
          }}
        >
          {agentOptions.map(function renderAgentOption(agent) {
            return <option key={agent}>{agent}</option>;
          })}
        </select>
      </section>
      <section>
        <label htmlFor="objective">Prompt / objective</label>
        <textarea
          id="objective"
          value={active.objective}
          onChange={function changeObjective(event) {
            onUpdateActive({ objective: event.target.value });
          }}
        />
        <button
          className="save-amendment"
          onClick={onSaveAmendment}
          disabled={!validationValid}
        >
          Save as new graph version
        </button>
      </section>
      <div className="split">
        <section>
          <label htmlFor="retries">Retries</label>
          <input
            id="retries"
            className="field numeric-field"
            type="number"
            min="1"
            max="10"
            value={active.retryPolicy.maxAttempts}
            onChange={function changeRetries(event) {
              onUpdateActive({
                retryPolicy: {
                  ...active.retryPolicy,
                  maxAttempts: Number(event.target.value),
                },
              });
            }}
          />
        </section>
        <section>
          <label htmlFor="timeout">Timeout (sec)</label>
          <input
            id="timeout"
            className="field numeric-field"
            type="number"
            min="5"
            max="86400"
            value={active.timeoutSeconds}
            onChange={function changeTimeout(event) {
              onUpdateActive({
                timeoutSeconds: Number(event.target.value),
              });
            }}
          />
        </section>
      </div>
      <section>
        <label>Input contract</label>
        <div className="code-field">
          {active.inputs.map(function renderInput(input) {
            return <code key={input}>{input}</code>;
          })}
        </div>
      </section>
      <section>
        <label>Read / write globs</label>
        <div className="code-field">
          {active.workspace.readGlobs.map(function renderReadGlob(value) {
            return <code key={`r${value}`}>R {value}</code>;
          })}
          {active.workspace.writeGlobs.map(function renderWriteGlob(value) {
            return <code key={`w${value}`}>W {value}</code>;
          })}
        </div>
      </section>
      <section>
        <label>Output contract</label>
        {active.outputs.map(function renderOutput(output) {
          return (
            <div className="contract" key={output.name}>
              <span>
                <Sparkles size={13} />
                {output.name}
              </span>
              <small>{output.type} · required</small>
            </div>
          );
        })}
      </section>
      <section>
        <label>Verifier</label>
        <button
          className="verifier verifier-button"
          role="switch"
          aria-checked={active.verifierPolicy.required}
          onClick={function toggleVerifier() {
            onUpdateActive({
              verifierPolicy: {
                ...active.verifierPolicy,
                required: !active.verifierPolicy.required,
              },
            });
          }}
        >
          <ShieldCheck size={16} />
          <span>
            <strong>
              {active.verifierPolicy.required
                ? active.verifierPolicy.freshSession
                  ? "Fresh session"
                  : "Required"
                : "Not required"}
            </strong>
            <small>
              {active.verifierPolicy.readonly
                ? "Read-only · diff + tests only"
                : "Worker context"}
            </small>
          </span>
          <i
            className={`toggle ${active.verifierPolicy.required ? "on" : ""}`}
          />
        </button>
      </section>
      <section className="checks">
        <label>Acceptance checks</label>
        {active.acceptanceChecks.map(function renderCheck(check, index) {
          return (
            <p key={index}>
              <TerminalSquare size={13} />
              <code>{check.command ?? check.description}</code>
            </p>
          );
        })}
      </section>
    </>
  );
}
