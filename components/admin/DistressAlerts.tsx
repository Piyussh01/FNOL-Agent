import { AlertTriangle } from "lucide-react";

type Alert = {
  id: string;
  claim_id: string | null;
  payload_json: Record<string, unknown>;
  created_at: string;
};

export default function DistressAlerts({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden />
        <h2 className="text-lg font-bold text-amber-900">Distress alerts</h2>
      </div>
      {alerts.length === 0 ? (
        <p className="text-sm text-amber-800">None in the last 24h.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {alerts.map((a) => (
            <li key={a.id} className="rounded border border-amber-200 bg-white p-2">
              <p className="font-mono text-xs">claim {a.claim_id?.slice(0, 8)}…</p>
              <p className="text-xs text-amber-800">
                Score {String((a.payload_json as Record<string, unknown>).score ?? "—")} ·{" "}
                {new Date(a.created_at).toLocaleTimeString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
