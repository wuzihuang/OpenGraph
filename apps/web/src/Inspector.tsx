import { X } from "lucide-react";
import { InspectorActivity } from "./InspectorActivity.tsx";
import { InspectorConfigure } from "./InspectorConfigure.tsx";
import { InspectorEvidence } from "./InspectorEvidence.tsx";
import type { GraphNode, InspectorPanel, RunEvent } from "./types.ts";

type InspectorProps = {
  active: GraphNode;
  panel: InspectorPanel;
  agentOptions: string[];
  nodeEvents: RunEvent[];
  runUnavailable: boolean;
  validationValid: boolean;
  onClose: () => void;
  onPanelChange: (panel: InspectorPanel) => void;
  onUpdateActive: (change: Partial<GraphNode>) => void;
  onSaveAmendment: () => void;
  onReassign: () => void;
  onRetry: () => void;
};

function InspectorTabs(props: {
  panel: InspectorPanel;
  onPanelChange: (panel: InspectorPanel) => void;
}) {
  const { panel, onPanelChange } = props;
  return (
    <div className="tabs">
      <button
        className={panel === "configure" ? "active" : ""}
        onClick={function showConfigure() {
          onPanelChange("configure");
        }}
      >
        Configure
      </button>
      <button
        className={panel === "activity" ? "active" : ""}
        onClick={function showActivity() {
          onPanelChange("activity");
        }}
      >
        Activity
      </button>
      <button
        className={panel === "evidence" ? "active" : ""}
        onClick={function showEvidence() {
          onPanelChange("evidence");
        }}
      >
        Evidence
      </button>
    </div>
  );
}

export function Inspector(props: InspectorProps) {
  const {
    active,
    panel,
    agentOptions,
    nodeEvents,
    runUnavailable,
    validationValid,
    onClose,
    onPanelChange,
    onUpdateActive,
    onSaveAmendment,
    onReassign,
    onRetry,
  } = props;
  return (
    <aside className="inspector">
      <div className="inspector-head">
        <div>
          <span>NODE INSPECTOR</span>
          <h2>{active.title}</h2>
        </div>
        <button aria-label="Close inspector" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <InspectorTabs panel={panel} onPanelChange={onPanelChange} />
      {panel === "configure" && (
        <InspectorConfigure
          active={active}
          agentOptions={agentOptions}
          validationValid={validationValid}
          onUpdateActive={onUpdateActive}
          onSaveAmendment={onSaveAmendment}
        />
      )}
      {panel === "activity" && (
        <InspectorActivity
          nodeEvents={nodeEvents}
          runUnavailable={runUnavailable}
          onReassign={onReassign}
          onRetry={onRetry}
        />
      )}
      {panel === "evidence" && <InspectorEvidence nodeEvents={nodeEvents} />}
    </aside>
  );
}
