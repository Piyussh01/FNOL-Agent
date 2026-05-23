"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ClaimChat({
  claimId,
  initialMessages,
}: {
  claimId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!draft.trim() || busy) return;
    const text = draft.trim();
    setDraft("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    const res = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ claim_id: claimId, message: text }),
    });
    if (!res.body) {
      setBusy(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const ev of events) {
        const line = ev.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        try {
          const obj = JSON.parse(line.slice(6));
          if (obj.type === "text" && typeof obj.delta === "string") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + obj.delta,
                };
              }
              return copy;
            });
          } else if (obj.type === "tool_use") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = {
                  ...last,
                  content:
                    (last.content ? last.content + "\n\n" : "") +
                    `_Calling ${obj.name}…_`,
                };
              }
              return copy;
            });
          } else if (obj.type === "error") {
            setMessages((m) => [
              ...m,
              { role: "assistant", content: `_(Sam errored: ${obj.message})_` },
            ]);
          }
        } catch {
          // ignored
        }
      }
    }
    setBusy(false);
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-acme-100 bg-white shadow-sm">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-acme-600 px-4 py-2 text-white"
                : "max-w-[80%] rounded-2xl rounded-bl-sm bg-acme-50 px-4 py-2 text-acme-900"
            }
          >
            <div className="whitespace-pre-wrap text-sm">
              {m.content || (busy && m.role === "assistant" ? "…" : "")}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-acme-100 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Type to Sam…"
          className="flex-1 resize-none rounded-md border border-acme-200 px-3 py-2 outline-none focus:ring-2 focus:ring-acme-600"
        />
        <button
          onClick={() => void send()}
          disabled={!draft.trim() || busy}
          className="btn-primary px-3 py-2"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
