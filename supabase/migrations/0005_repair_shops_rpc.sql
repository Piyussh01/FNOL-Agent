-- RPC for repair-shop geo search. Used by lib/partners/repair.ts.

create or replace function public.repair_shops_near(
  origin_lat double precision,
  origin_lng double precision,
  radius_m double precision default 40000,
  only_in_network boolean default false,
  max_results int default 8
)
returns table (
  id uuid,
  name text,
  address text,
  phone text,
  rating numeric,
  in_network boolean,
  specialties text[],
  distance_m double precision
)
language sql stable
as $$
  select
    rs.id, rs.name, rs.address, rs.phone, rs.rating, rs.in_network, rs.specialties,
    st_distance(
      rs.location,
      st_setsrid(st_makepoint(origin_lng, origin_lat), 4326)::geography
    ) as distance_m
  from repair_shops rs
  where st_dwithin(
    rs.location,
    st_setsrid(st_makepoint(origin_lng, origin_lat), 4326)::geography,
    radius_m
  )
  and (not only_in_network or rs.in_network)
  order by distance_m asc
  limit max_results;
$$;

grant execute on function public.repair_shops_near(
  double precision, double precision, double precision, boolean, int
) to authenticated, anon, service_role;
