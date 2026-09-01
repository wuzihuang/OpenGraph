import { Check, Pause, Play, Search, Square, X } from "lucide-react";
import type { AppMode, GraphNode, GraphSpec } from "./types.ts";

type ToolbarProps = {
  mode: AppMode;
  spec: GraphSpec;
  runId: string | null;
  runStatus: string;
  validationIssueCount: number;
  errorCount: number;
  approving: boolean;
  searchOpen: boolean;
  searchQuery: string;
  searchResults: GraphNode[];
  onModeChange: (mode: AppMode) => void;
  onStartOrShowRun: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRunAction: (action: string) => void;
  onSearchOpenChange: (open: boolean) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectNode: (id: string) => void;
};

export function Toolbar(props: ToolbarProps) {
  const {
    mode,
    spec,
    runId,
    runStatus,
    validationIssueCount,
    errorCount,
    approving,
    searchOpen,
    searchQuery,
    searchResults,
    onModeChange,
    onStartOrShowRun,
    onApprove,
    onReject,
    onRunAction,
    onSearchOpenChange,
    onSearchQueryChange,
    onSelectNode,
  } = props;
  const runUnavailable = !runId;
  const runTerminal = ["completed", "failed", "cancelled"].includes(runStatus);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">
          <img src="/logo.png" alt="OpenGraph" width={30} height={30} />
        </span>
        <strong>OpenGraph</strong>
        <span className="project-pill">
          {spec.repository?.root?.split("/").filter(Boolean).pop() ??
            "sample-repo"}{" "}
          · {spec.repository?.baseRef ?? "draft"}
        </span>
      </div>
      <nav className="mode-switch">
        <button
          className={mode === "review" ? "active" : ""}
          onClick={function showReview() {
            onModeChange("review");
          }}
        >
          Review
        </button>
        <button
          className={mode === "run" ? "active" : ""}
          onClick={onStartOrShowRun}
          disabled={approving || errorCount > 0}
          title={runUnavailable ? "Approve and start a run" : undefined}
        >
          {approving ? "Starting…" : "Run"}
        </button>
      </nav>
      <div className="top-actions">
        <span className={`validation ${errorCount ? "has-errors" : ""}`}>
          {errorCount ? <X size={12} /> : <Check size={12} />} {errorCount}{" "}
          errors · {validationIssueCount - errorCount} warnings
        </span>
        <div className="search-wrap">
          <button
            className={`icon-button ${searchOpen ? "active" : ""}`}
            aria-label="Search nodes"
            aria-expanded={searchOpen}
            onClick={function toggleSearch() {
              onSearchOpenChange(!searchOpen);
            }}
          >
            <Search size={15} />
          </button>
          {searchOpen && (
            <div className="search-popover">
              <div className="search-input">
                <Search size={14} />
                <input
                  autoFocus
                  type="search"
                  placeholder="Search nodes…"
                  value={searchQuery}
                  onChange={function updateSearch(event) {
                    onSearchQueryChange(event.target.value);
                  }}
                  onKeyDown={function closeSearch(event) {
                    if (event.key === "Escape") onSearchOpenChange(false);
                  }}
                />
              </div>
              <div className="search-results">
                {searchResults.map(function renderSearchResult(node) {
                  return (
                    <button
                      key={node.id}
                      onClick={function selectSearchResult() {
                        onSelectNode(node.id);
                      }}
                    >
                      <span>{node.title}</span>
                      <small>
                        {node.kind} · {node.id}
                      </small>
                    </button>
                  );
                })}
                {!searchResults.length && <p>No matching nodes</p>}
              </div>
            </div>
          )}
        </div>
        {mode === "review" ? (
          <>
            <button className="reject" onClick={onReject} disabled={approving}>
              Reject
            </button>
            <button
              className="approve"
              onClick={onApprove}
              disabled={errorCount > 0 || approving}
              aria-busy={approving}
            >
              <Play size={14} />
              {approving ? "Starting…" : "Approve & run"}
            </button>
          </>
        ) : (
          <>
            <span className={`run-pill ${runStatus}`}>{runStatus}</span>
            <button
              className="icon-button"
              disabled={runUnavailable || runTerminal}
              title={runUnavailable ? "No active run" : undefined}
              onClick={function pauseOrResume() {
                onRunAction(runStatus === "paused" ? "resume" : "pause");
              }}
              aria-label={runStatus === "paused" ? "Resume" : "Pause"}
            >
              {runStatus === "paused" ? (
                <Play size={14} />
              ) : (
                <Pause size={14} />
              )}
            </button>
            <button
              className="cancel"
              disabled={runUnavailable || runTerminal}
              title={runUnavailable ? "No active run" : undefined}
              onClick={function cancelRun() {
                onRunAction("cancel");
              }}
            >
              <Square size={12} />
              Cancel
            </button>
          </>
        )}
      </div>
    </header>
  );
}
