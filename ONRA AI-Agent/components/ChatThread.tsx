"use client";
import { useChat } from "@ai-sdk/react";
import { useRef, useEffect } from "react";
import { Card } from "@/components/Cards";
import { MigCard } from "@/components/MigrationCards";
import { ParticleOrb } from "@/components/ParticleOrb";
import { TypingDots } from "@/components/TypingDots";
import type { InsightCard } from "@/lib/agent/cards";
import type { MigrationCard } from "@/lib/agent/migrationCards";

const INSIGHT_CHIPS = [
  "Revenue by branch",
  "Gender split of my members",
  "Where do my leads come from?",
  "Compare card vs cash payments",
  "Revenue trend over time",
  "Which classes get cancelled most?",
];

export default function ChatThread({
  mode,
  visible,
}: {
  mode: "insight" | "migration";
  visible: boolean;
}) {
  const sessionId = useRef(`mig_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`);
  const fileInput = useRef<HTMLInputElement>(null);
  const { messages, input, handleInputChange, handleSubmit, append, status } = useChat({
    api: "/api/agent",
    maxSteps: 6,
    body: { mode, migrationSessionId: sessionId.current },
  });
  const isBusy = status === "submitted" || status === "streaming";
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (visible) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, visible]);

  const send = (text: string) => append({ role: "user", content: text });

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("sessionId", sessionId.current);
    const res = await fetch("/api/agent/upload", { method: "POST", body: fd });
    const info = await res.json();
    send(
      `I've uploaded my customer file (${info.filename}, ${info.rowCount} rows). Please inspect it.`,
    );
  }

  const act = { send, openUpload: () => fileInput.current?.click() };
  const empty = messages.length === 0;

  return (
    <section className="chat" style={{ display: visible ? "flex" : "none" }}>
      <div className="messages">
        {empty ? (
          mode === "insight" ? (
            <div className="empty">
              <ParticleOrb />
              <h1>How can I assist you today?</h1>
              <p>Ask anything about your studio — revenue, classes, members.</p>
              <div className="cap-cards">
                <div className="cap" onClick={() => send("Give me a studio overview")}>
                  <b>Insight</b>
                  <span>Quick insights to help grow your studio.</span>
                </div>
                <div className="cap" onClick={() => send("Show class bookings over time")}>
                  <b>Trends</b>
                  <span>Bookings and revenue over time, charted.</span>
                </div>
                <div className="cap" onClick={() => send("Who is at risk of churning?")}>
                  <b>Members</b>
                  <span>Churn risk, plans, and retention.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">
              <ParticleOrb />
              <h1>Migrate your data</h1>
              <p>I&apos;ll guide you through importing your customers from another platform — step by step.</p>
              <button
                className="mbtn primary"
                style={{ marginTop: 8 }}
                onClick={() => send("I want to migrate my customer data into Onra.")}
              >
                Start migration
              </button>
            </div>
          )
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`row ${m.role}`}>
              {m.role === "assistant" && <div className="avatar">O</div>}
              <div className={`bubble ${m.role}`}>
                {m.role === "user" ? (
                  <div className="bubble user">{m.content}</div>
                ) : (
                  <>
                    {m.toolInvocations?.map((ti) =>
                      ti.state === "result" ? (
                        mode === "migration" ? (
                          <MigCard
                            key={ti.toolCallId}
                            data={ti.result as MigrationCard}
                            act={act}
                          />
                        ) : (
                          <Card key={ti.toolCallId} data={ti.result as InsightCard} />
                        )
                      ) : (
                        <TypingDots key={ti.toolCallId} label="Working" />
                      ),
                    )}
                    {m.content && <div className="assistant-text">{m.content}</div>}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        {isBusy && messages[messages.length - 1]?.role === "user" && (
          <div className="row assistant">
            <div className="avatar">O</div>
            <TypingDots />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="composer-wrap">
        {empty && mode === "insight" && (
          <div className="chips">
            {INSIGHT_CHIPS.map((s) => (
              <div className="chip" key={s} onClick={() => send(s)}>
                {s}
              </div>
            ))}
          </div>
        )}
        <form className="composer" onSubmit={handleSubmit}>
          {mode === "migration" && (
            <>
              <button
                type="button"
                className="clip"
                title="Upload CSV"
                onClick={() => fileInput.current?.click()}
              >
                📎
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                  e.target.value = "";
                }}
              />
            </>
          )}
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={mode === "migration" ? "Reply, or attach a CSV…" : "Ask me anything"}
            disabled={isBusy}
          />
          <button className="send" type="submit" disabled={isBusy || !input.trim()}>
            ➤
          </button>
        </form>
      </div>
    </section>
  );
}
