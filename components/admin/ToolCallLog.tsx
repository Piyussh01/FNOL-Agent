type Row = {
  id: string;
  claim_id: string | null;
  type: string;
  payload_json: Record<string, unknown>;
  created_at: string;
};

const PALETTE: Record<string, string> = {
  tool_error: "bg-red-100 text-red-900",
  escalation: "bg-amber-100 text-amber-900",
  emergency_flagged: "bg-rose-100 text-rose-900",
};

export default function ToolCallLog({ rows }: { rows: Row[] }) {
  return (
    <section className="rounded-2xl border border-acme-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">Incidents (errors / escalations / emergencies)</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-acme-700">Nothing to triage in the last 24h.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline gap-2 border-b border-acme-50 pb-2">
              <span className={`rounded px-2 py-0.5 text-xs ${PALETTE[r.type] ?? "bg-gray-100"}`}>
                {r.type}
              </span>
              <span className="font-mono text-xs text-acme-700">
                {r.claim_id?.slice(0, 8) ?? "—"}…
              </span>
              <span className="text-xs">{JSON.stringify(r.payload_json).slice(0, 140)}</span>
              <span className="ml-auto text-xs text-acme-700">
                {new Date(r.created_at).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
