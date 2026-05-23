type Event = {
  type: string;
  payload_json: Record<string, unknown>;
  created_at: string;
};

const FUNNEL = [
  "greeting",
  "identifying",
  "verifying",
  "intake",
  "coverage_check",
  "photos",
  "assessing",
  "booking",
  "reviewing",
  "submitted",
] as const;

export default function FunnelChart({ events }: { events: Event[] }) {
  const stageHits: Record<string, number> = {};
  for (const e of events) {
    if (e.type !== "stage_change") continue;
    const to = (e.payload_json as Record<string, unknown>).to as string | undefined;
    if (to) stageHits[to] = (stageHits[to] ?? 0) + 1;
  }
  const max = Math.max(1, ...Object.values(stageHits));

  return (
    <section className="rounded-2xl border border-acme-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">Stage funnel (24h)</h2>
      <ul className="space-y-1 text-xs">
        {FUNNEL.map((s) => {
          const n = stageHits[s] ?? 0;
          const pct = (n / max) * 100;
          return (
            <li key={s} className="flex items-center gap-2">
              <span className="w-28 capitalize text-acme-700">{s.replace(/_/g, " ")}</span>
              <div className="h-3 flex-1 rounded bg-acme-50">
                <div
                  className="h-3 rounded bg-acme-600"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-right">{n}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
