// Adapter interfaces. Mock implementations live alongside; swapping to a
// real partner means replacing the file, not changing call sites.

export type TowDispatch = {
  vendor: string;
  eta_minutes: number;
  confirmation_code: string;
  dispatch_phone: string;
};

export type TowProvider = {
  dispatch(input: {
    claim_id: string;
    pickup_lat: number;
    pickup_lng: number;
    dropoff_preference?: "nearest_shop" | "home" | "specified";
  }): Promise<TowDispatch>;
};

export type RentalBooking = {
  vendor: string;
  location: string;
  confirmation_code: string;
  daily_rate_usd: number;
  covered_days: number;
};

export type RentalProvider = {
  book(input: {
    claim_id: string;
    pickup_lat: number;
    pickup_lng: number;
    start_date: string;
    vehicle_class: "economy" | "midsize" | "suv";
  }): Promise<RentalBooking>;
};

export type RepairShopHit = {
  id: string;
  name: string;
  address: string;
  distance_miles: number;
  rating: number;
  in_network: boolean;
  phone: string;
  specialties: string[];
};

export type RepairShopDirectory = {
  near(input: {
    lat: number;
    lng: number;
    radius_miles?: number;
    in_network_only?: boolean;
    limit?: number;
  }): Promise<RepairShopHit[]>;
};

export type AdjusterBooking = {
  adjuster_name: string;
  scheduled_for: string;
  confirmation_code: string;
};

export type AdjusterScheduler = {
  schedule(input: {
    claim_id: string;
    preferred_window_start: string;
    preferred_window_end: string;
    channel: "phone" | "video";
  }): Promise<AdjusterBooking>;
};
