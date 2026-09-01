import { Search } from "lucide-react";
import type { AppMode, GraphNode, GraphSpec } from "./types.ts";

type ToolbarProps = {
  mode: AppMode;
  spec: GraphSpec;
  runId: string | null;
  runStatus: string;
  validationIssueCount: number;
  errorCount: number;
  searchOpen: boolean;
  searchQuery: string;
  searchResults: GraphNode[];
  onShowReview: () => void;
  onShowRun: () => void;
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
    searchOpen,
    searchQuery,
    searchResults,
    onShowReview,
    onShowRun,
    onSearchOpenChange,
    onSearchQueryChange,
    onSelectNode,
  } = props;

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
          onClick={onShowReview}
        >
          Review
        </button>
        <button
          className={mode === "run" ? "active" : ""}
          onClick={onShowRun}
          title={
            runId
              ? "Show live run dynamics"
              : "Attach the latest run for this graph, if any"
          }
        >
          Live
        </button>
      </nav>
      <div className="top-actions">
        <span className={`validation ${errorCount ? "has-errors" : ""}`}>
          {errorCount} errors · {validationIssueCount - errorCount} warnings
        </span>
        {mode === "run" && (
          <span className={`run-pill ${runStatus}`}>{runStatus}</span>
        )}
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
      </div>
    </header>
  );
}
