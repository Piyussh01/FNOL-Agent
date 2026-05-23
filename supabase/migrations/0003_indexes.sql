-- Indexes for hot paths.

create index policies_policy_number_idx       on policies(policy_number);
create index policies_holder_user_id_idx      on policies(holder_user_id);

create index claims_user_id_status_idx        on claims(user_id, status);
create index claims_stage_idx                 on claims(stage);
create index claims_created_at_idx            on claims(created_at desc);

create index photos_claim_id_idx              on photos(claim_id);
create index messages_claim_id_created_at_idx on messages(claim_id, created_at);
create index events_claim_id_created_at_idx   on events(claim_id, created_at);
create index events_type_created_at_idx       on events(type, created_at);
create index sessions_claim_id_idx            on sessions(claim_id);

-- PostGIS indexes for spatial queries.
create index repair_shops_location_gist       on repair_shops using gist(location);
create index claims_location_gist             on claims using gist(location);
