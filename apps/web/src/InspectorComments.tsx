import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import type { NodeComment } from "./types.ts";

type InspectorCommentsProps = {
  graphId: string | null;
  nodeId: string;
  token: string;
};

export function InspectorComments(props: InspectorCommentsProps) {
  const { graphId, nodeId, token } = props;
  const [comments, setComments] = useState<NodeComment[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    function loadComments() {
      if (!graphId) {
        setComments([]);
        return;
      }
      let cancelled = false;
      void fetch(
        `/api/graphs/${encodeURIComponent(graphId)}/comments?nodeId=${encodeURIComponent(nodeId)}`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      )
        .then(async function parseComments(response) {
          if (!response.ok) {
            throw new Error(`Failed to load comments (${response.status})`);
          }
          return (await response.json()) as { comments: NodeComment[] };
        })
        .then(function applyComments(payload) {
          if (!cancelled) {
            setComments(payload.comments);
            setError(null);
          }
        })
        .catch(function onLoadError(loadError: unknown) {
          if (!cancelled) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Could not load comments",
            );
          }
        });
      return function cancelLoad() {
        cancelled = true;
      };
    },
    [graphId, nodeId, token],
  );

  async function submitComment(): Promise<void> {
    const body = draft.trim();
    if (!graphId || !body || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/graphs/${encodeURIComponent(graphId)}/comments`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ nodeId, body }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to save comment (${response.status})`);
      }
      const payload = (await response.json()) as { comment: NodeComment };
      setComments(function appendComment(current) {
        return [...current, payload.comment];
      });
      setDraft("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save comment",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="node-chat">
      <p className="node-chat-hint">
        Leave guidance for this node. Your coding agent (Codex) can read these
        comments and propose an amendment — the Dashboard does not start runs.
      </p>
      <div className="node-chat-thread">
        {comments.map(function renderComment(comment) {
          return (
            <article key={comment.id} className={`chat-bubble ${comment.role}`}>
              <span>{comment.role === "user" ? "You" : "System"}</span>
              <p>{comment.body}</p>
              <small>{new Date(comment.createdAt).toLocaleString()}</small>
            </article>
          );
        })}
        {!comments.length && (
          <div className="empty-evidence">
            No comments yet. Select a node and tell the agent how this step
            should change.
          </div>
        )}
      </div>
      {error && <p className="node-chat-error">{error}</p>}
      <div className="node-chat-composer">
        <textarea
          rows={3}
          placeholder="e.g. This worker should write only docs/** and cite sources…"
          value={draft}
          disabled={!graphId || busy}
          onChange={function updateDraft(event) {
            setDraft(event.target.value);
          }}
          onKeyDown={function submitOnMetaEnter(event) {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submitComment();
            }
          }}
        />
        <button
          type="button"
          disabled={!graphId || busy || !draft.trim()}
          onClick={function sendComment() {
            void submitComment();
          }}
        >
          <Send size={14} />
          {busy ? "Sending…" : "Comment"}
        </button>
      </div>
    </section>
  );
}
