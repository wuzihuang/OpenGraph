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
        searchOpen={dashboard.searchOpen}
        searchQuery={dashboard.searchQuery}
        searchResults={graph.searchResults}
        onShowReview={dashboard.showReview}
        onShowRun={function attachLive() {
          void dashboard.showRun();
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
        className={`workspace workspace-full ${
          dashboard.inspectorOpen ? "" : "inspector-closed"
        }`}
      >
        <Workspace
          mode={dashboard.mode}
          graphId={dashboard.graphId}
          runId={dashboard.runId}
          runStatus={dashboard.runStatus}
          spec={dashboard.spec}
          inspectorOpen={dashboard.inspectorOpen}
          passportOpen={dashboard.passportOpen}
          graph={graph}
          events={dashboard.events}
          statuses={dashboard.statuses}
          onSelectNode={dashboard.selectNode}
          onClosePassport={dashboard.closePassport}
          onOpenInspectorPanel={dashboard.openInspectorPanel}
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
            graphId={dashboard.graphId}
            token={dashboard.token}
            validationValid={dashboard.validation.valid}
            onClose={function closeInspector() {
              dashboard.setInspectorOpen(false);
            }}
            onPanelChange={dashboard.setPanel}
            onUpdateActive={dashboard.updateActive}
            onSaveAmendment={function saveGraphAmendment() {
              void dashboard.saveAmendment();
            }}
          />
        )}
      </section>
    </main>
  );
}
