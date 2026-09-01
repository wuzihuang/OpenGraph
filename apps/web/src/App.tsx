import { useDashboardController } from "./dashboard-controller.ts";
import { useDashboardGraphModel } from "./graph-model.ts";
import { Inspector } from "./Inspector.tsx";
import { Toolbar } from "./Toolbar.tsx";
import { Workspace } from "./Workspace.tsx";

export { layoutGraphNodes } from "./graph.tsx";

export function App() {
  const dashboard = useDashboardController();
  const graph = useDashboardGraphModel({
    spec: dashboard.spec,
    graphId: dashboard.graphId,
    mode: dashboard.mode,
    selected: dashboard.selected,
    searchQuery: dashboard.searchQuery,
    events: dashboard.events,
    statuses: dashboard.statuses,
    validation: dashboard.validation,
  });

  if (!graph.active) return null;

  return (
    <main className="app-shell">
      <Toolbar
        mode={dashboard.mode}
        spec={dashboard.spec}
        runId={dashboard.runId}
        runStatus={dashboard.runStatus}
        validationIssueCount={dashboard.validation.issues.length}
        errorCount={graph.errorCount}
        approving={dashboard.approving}
        searchOpen={dashboard.searchOpen}
        searchQuery={dashboard.searchQuery}
        searchResults={graph.searchResults}
        onModeChange={dashboard.setMode}
        onStartOrShowRun={function startRun() {
          void dashboard.startOrShowRun();
        }}
        onApprove={function approveRun() {
          void dashboard.approve();
        }}
        onReject={function rejectRun() {
          void dashboard.reject();
        }}
        onRunAction={function runAction(action) {
          void dashboard.performRunAction(action);
        }}
        onSearchOpenChange={dashboard.setSearchOpen}
        onSearchQueryChange={dashboard.setSearchQuery}
        onSelectNode={dashboard.selectNode}
      />
      {dashboard.notice && (
        <div className="notice" role="status">
          {dashboard.notice}
        </div>
      )}
      <section
        className={`workspace ${
          dashboard.inspectorOpen ? "" : "inspector-closed"
        }`}
      >
        <Workspace
          mode={dashboard.mode}
          graphId={dashboard.graphId}
          spec={dashboard.spec}
          view={dashboard.workspaceView}
          inspectorOpen={dashboard.inspectorOpen}
          graph={graph}
          events={dashboard.events}
          statuses={dashboard.statuses}
          onViewChange={dashboard.setWorkspaceView}
          onSelectNode={dashboard.selectNode}
          onOpenInspector={function reopenInspector() {
            dashboard.setInspectorOpen(true);
          }}
        />
        {dashboard.inspectorOpen && (
          <Inspector
            active={graph.active}
            panel={dashboard.panel}
            agentOptions={graph.agentOptions}
            nodeEvents={graph.nodeEvents}
            runUnavailable={!dashboard.runId}
            validationValid={dashboard.validation.valid}
            onClose={function closeInspector() {
              dashboard.setInspectorOpen(false);
            }}
            onPanelChange={dashboard.setPanel}
            onUpdateActive={dashboard.updateActive}
            onSaveAmendment={function saveGraphAmendment() {
              void dashboard.saveAmendment();
            }}
            onReassign={function reassignNode() {
              void dashboard.reassignActiveNode();
            }}
            onRetry={function retryNode() {
              void dashboard.retryActiveNode();
            }}
          />
        )}
      </section>
    </main>
  );
}
