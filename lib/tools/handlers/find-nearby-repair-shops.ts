import { z } from "zod";
import { registerTool } from "../registry";
import { repairShopDirectory } from "@/lib/partners/repair";
import { logToolEvent } from "./_events";

const Input = z.object({
  claim_id: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  radius_miles: z.number().min(1).max(100).optional(),
  in_network_only: z.boolean().optional(),
});

type Output = {
  shops: Array<{
    id: string;
    name: string;
    address: string;
    distance_miles: number;
    rating: number;
    in_network: boolean;
    phone: string;
    specialties: string[];
  }>;
};

export default registerTool<z.infer<typeof Input>, Output>({
  name: "find_nearby_repair_shops",
  description: "Find repair shops near a coordinate.",
  inputSchema: Input,
  async run(input, ctx) {
    const shops = await repairShopDirectory.near({
      lat: input.lat,
      lng: input.lng,
      radius_miles: input.radius_miles,
      in_network_only: input.in_network_only,
      limit: 6,
    });
    await logToolEvent("find_nearby_repair_shops", { claim_id: ctx.claim.id }, {
      count: shops.length,
    });
    return { shops };
  },
});
