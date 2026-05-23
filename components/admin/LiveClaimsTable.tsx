import { Clock } from "lucide-react";

type Claim = {
  id: string;
  claim_number: string;
  kind: string;
  stage: string;
  status: string;
  updated_at: string;
};

export default function LiveClaimsTable({ claims }: { claims: Claim[] }) {
  return (
    <section className="rounded-2xl border border-acme-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Live claims</h2>
        <span className="text-xs text-acme-700">{claims.length} in window</span>
      </div>
      {claims.length === 0 ? (
        <p className="text-sm text-acme-700">No activity in the last 24h.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-acme-100 text-xs uppercase text-acme-700">
            <tr>
              <th className="py-2">Claim</th>
              <th>Kind</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Last update</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-b border-acme-50 last:border-0">
                <td className="py-2 font-mono text-xs">{c.claim_number}</td>
                <td>{c.kind}</td>
                <td>
                  <span className="rounded bg-acme-50 px-2 py-0.5 text-xs">
                    {c.stage}
                  </span>
                </td>
                <td>{c.status}</td>
                <td className="flex items-center gap-1 py-2 text-xs text-acme-700">
                  <Clock className="h-3 w-3" aria-hidden />
                  {timeAgo(c.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function timeAgo(ts: string): string {
  const delta = Date.now() - new Date(ts).getTime();
  const min = Math.floor(delta / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}
