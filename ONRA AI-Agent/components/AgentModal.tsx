"use client";
import { useState } from "react";
import ChatThread from "@/components/ChatThread";

export default function AgentModal() {
  const [thread, setThread] = useState<"insight" | "migration">("insight");

  return (
    <div className="modal">
      <div className="modal-header">
        <div className="mark">O</div>
        <div className="modal-title">Onra Agent</div>
      </div>

      <div className="modal-body">
        <aside className="sidebar">
          <div className="search">Search chat…</div>
          <div
            className={`thread ${thread === "insight" ? "active" : ""}`}
            onClick={() => setThread("insight")}
          >
            <span className="ic">◎</span> General chat
          </div>
          <div className="thread">
            <span className="ic">▤</span> Studio setup
          </div>
          <div
            className={`thread ${thread === "migration" ? "active" : ""}`}
            onClick={() => setThread("migration")}
          >
            <span className="ic">⤒</span> Migrate data
          </div>
          <div className="spacer" />
          <div className="archive">🗄 Archive</div>
        </aside>

        {/* Both threads stay mounted so each keeps its own history; only the
            active one is visible. The thread IS the mode. */}
        <ChatThread mode="insight" visible={thread === "insight"} />
        <ChatThread mode="migration" visible={thread === "migration"} />
      </div>
    </div>
  );
}
