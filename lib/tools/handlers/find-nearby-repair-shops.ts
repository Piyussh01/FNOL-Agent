import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  radius_miles: z.number().optional(),
  in_network_only: z.boolean().optional(),
});

export default stub<
  z.infer<typeof Input>,
  {
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
  }
>("find_nearby_repair_shops", "PostGIS search for repair shops.", Input);
