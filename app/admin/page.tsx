import Link from "next/link";
import { Shield } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import LiveClaimsTable from "@/components/admin/LiveClaimsTable";
import DistressAlerts from "@/components/admin/DistressAlerts";
import ToolCallLog from "@/components/admin/ToolCallLog";
import FunnelChart from "@/components/admin/FunnelChart";

// Live ops view. Currently public for demo purposes — gate behind staff
// authentication in M17 before any real launch.
export default async function AdminPage() {
  const admin = createAdminClient();

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: claims }, { data: distress }, { data: toolErrors }, { data: stageEvents }] =
    await Promise.all([
      admin
        .from("claims")
        .select("id, claim_number, kind, stage, status, updated_at, user_id")
        .gte("updated_at", since24h)
        .order("updated_at", { ascending: false })
        .limit(50),
      admin
        .from("events")
        .select("id, claim_id, payload_json, created_at")
        .eq("type", "distress_flag")
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("events")
        .select("id, claim_id, payload_json, created_at, type")
        .in("type", ["tool_error", "escalation", "emergency_flagged"])
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("events")
        .select("payload_json, created_at, type")
        .in("type", ["stage_change", "tool_call"])
        .gte("created_at", since24h)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-acme-700">
          <Shield className="h-5 w-5 text-acme-600" aria-hidden />
          <span className="font-bold">Alchemy Insurance — Ops</span>
        </Link>
        <p className="text-xs text-acme-700">Last 24h · refresh to update</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <LiveClaimsTable claims={claims ?? []} />
        </div>
        <div className="space-y-6">
          <DistressAlerts alerts={distress ?? []} />
          <FunnelChart events={stageEvents ?? []} />
        </div>
      </div>

      <div className="mt-6">
        <ToolCallLog rows={toolErrors ?? []} />
      </div>
    </main>
  );
}
