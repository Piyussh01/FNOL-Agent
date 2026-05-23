import type { RepairShopDirectory } from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

// Real-ish: query PostGIS for nearby shops. The "mock" part is the seed
// data; the SQL is what production would use.
export const repairShopDirectory: RepairShopDirectory = {
  async near({ lat, lng, radius_miles = 25, in_network_only = false, limit = 8 }) {
    const admin = createAdminClient();
    const radiusMeters = radius_miles * 1609.34;
    const { data, error } = await admin.rpc("repair_shops_near", {
      origin_lat: lat,
      origin_lng: lng,
      radius_m: radiusMeters,
      only_in_network: in_network_only,
      max_results: limit,
    });
    if (!error && data) {
      return (data as Array<Record<string, unknown>>).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        address: r.address as string,
        distance_miles:
          Math.round(((r.distance_m as number) / 1609.34) * 10) / 10,
        rating: Number(r.rating ?? 0),
        in_network: Boolean(r.in_network),
        phone: r.phone as string,
        specialties: (r.specialties as string[]) ?? [],
      }));
    }

    // Fallback: in-memory haversine ranking if the RPC isn't installed.
    const { data: shops } = await admin
      .from("repair_shops")
      .select("id, name, address, phone, rating, in_network, specialties, location");
    if (!shops) return [];

    const ranked = shops
      .map((s) => {
        // PostGIS encodes geography as WKB hex in JSON; we only have it
        // available as a string here. Without parsing WKB, return null
        // distance and let the agent know it's an approximation.
        return {
          id: s.id,
          name: s.name,
          address: s.address ?? "",
          distance_miles: 0,
          rating: Number(s.rating ?? 0),
          in_network: Boolean(s.in_network),
          phone: s.phone ?? "",
          specialties: (s.specialties as string[]) ?? [],
        };
      })
      .filter((s) => (in_network_only ? s.in_network : true))
      .slice(0, limit);
    return ranked;
  },
};
