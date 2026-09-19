-- New installation only. Additive, private tables; never run automatically on startup.
begin;
create table public.bhs_dealer_shops (
  shop text primary key check (shop ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  name text not null default '', storefront_url text not null default '', currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending','active','suspended','uninstalled')),
  publication_id text, collective_location_id text,
  access_token text, refresh_token text, access_expires_at timestamptz, refresh_expires_at timestamptz,
  scopes text not null default '', refresh_lock_until timestamptz, refresh_lock_id uuid,
  shipping_confirmed boolean not null default false, collective_payments_confirmed boolean not null default false,
  pilot_verified boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.bhs_dealer_price_options (
  id uuid primary key default gen_random_uuid(), shop text not null references public.bhs_dealer_shops(shop),
  supplier_variant_id text not null, retailer_variant_id text not null, sku text not null,
  retail_price numeric(12,2) not null check (retail_price > 0), currency text not null check (currency='USD'),
  enabled boolean not null default false, verified_at timestamptz,
  unique(shop,retailer_variant_id), unique(shop,retail_price,currency)
);
create table public.bhs_dealer_quotes (
  id uuid primary key, shop text not null references public.bhs_dealer_shops(shop), request_key uuid not null,
  fingerprint text not null, retail_price numeric(12,2) not null check (retail_price>0),
  currency text not null check (currency='USD'), snapshot jsonb not null,
  option_id uuid not null references public.bhs_dealer_price_options(id), variant_id text not null,
  created_at timestamptz not null default now(), unique(shop,request_key)
);
-- This inbox never creates, charges or fulfills orders. Collective owns those operations.
-- Reconcile the saved design with the actual BHS supplier order before production.
create table public.bhs_dealer_order_lines (
  shop text not null references public.bhs_dealer_shops(shop), order_id text not null, line_id text not null,
  order_name text not null, quote_id uuid references public.bhs_dealer_quotes(id), quantity integer not null,
  status text not null check (status in ('awaiting_collective','needs_review','cancelled','refunded')),
  reason text, supplier_order_id text, source_updated_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(shop,order_id,line_id)
);
create index bhs_dealer_quotes_shop_created on public.bhs_dealer_quotes(shop,created_at);
create table public.bhs_dealer_privacy_requests (
  id uuid primary key default gen_random_uuid(), shop text not null, event_id text not null, topic text not null,
  request_data text not null, status text not null default 'pending', created_at timestamptz not null default now(), unique(shop,event_id)
);
alter table public.bhs_dealer_shops enable row level security;
alter table public.bhs_dealer_price_options enable row level security;
alter table public.bhs_dealer_quotes enable row level security;
alter table public.bhs_dealer_order_lines enable row level security;
alter table public.bhs_dealer_privacy_requests enable row level security;
revoke all on public.bhs_dealer_shops,public.bhs_dealer_price_options,public.bhs_dealer_quotes,public.bhs_dealer_order_lines,public.bhs_dealer_privacy_requests from anon,authenticated;
grant all on public.bhs_dealer_shops,public.bhs_dealer_price_options,public.bhs_dealer_quotes,public.bhs_dealer_order_lines,public.bhs_dealer_privacy_requests to service_role;

create function public.bhs_dealer_reserve_quote(p_quote jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare existing bhs_dealer_quotes; created bhs_dealer_quotes;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_quote->>'shop',0));
  select * into existing from bhs_dealer_quotes where shop=p_quote->>'shop' and request_key=(p_quote->>'request_key')::uuid;
  if found then
    if existing.fingerprint <> p_quote->>'fingerprint' then raise exception 'Idempotency key reused with different design'; end if;
    return to_jsonb(existing);
  end if;
  if (select count(*) from bhs_dealer_quotes where shop=p_quote->>'shop' and created_at>now()-interval '1 hour')>=60 then
    raise exception 'Store quote limit reached';
  end if;
  if not exists(select 1 from bhs_dealer_price_options where id=(p_quote->>'option_id')::uuid
      and shop=p_quote->>'shop' and enabled and retailer_variant_id=p_quote->>'variant_id'
      and retail_price=(p_quote->>'retail_price')::numeric) then raise exception 'Price option unavailable'; end if;
  insert into bhs_dealer_quotes(id,shop,request_key,fingerprint,retail_price,currency,snapshot,option_id,variant_id)
    values ((p_quote->>'id')::uuid,p_quote->>'shop',(p_quote->>'request_key')::uuid,p_quote->>'fingerprint',
      (p_quote->>'retail_price')::numeric,'USD',p_quote->'snapshot',(p_quote->>'option_id')::uuid,p_quote->>'variant_id') returning * into created;
  return to_jsonb(created);
end $$;
create function public.bhs_dealer_refresh_lock(p_shop text,p_lock uuid) returns boolean language plpgsql security invoker set search_path=public as $$
begin
  update bhs_dealer_shops set refresh_lock_until=now()+interval '1 minute',refresh_lock_id=p_lock
    where shop=p_shop and (refresh_lock_until is null or refresh_lock_until<now());
  return found;
end $$;
revoke all on function public.bhs_dealer_reserve_quote(jsonb),public.bhs_dealer_refresh_lock(text,uuid) from public,anon,authenticated;
grant execute on function public.bhs_dealer_reserve_quote(jsonb),public.bhs_dealer_refresh_lock(text,uuid) to service_role;

-- Serialize retries and overlapping notifications. An older snapshot cannot overwrite a refund/cancellation.
create function public.bhs_dealer_record_order(p_shop text,p_order_id text,p_version timestamptz,p_lines jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare item jsonb;
begin
  if p_version is null then raise exception 'Order version required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_shop||p_order_id,0));
  if exists(select 1 from bhs_dealer_order_lines where shop=p_shop and order_id=p_order_id and source_updated_at>p_version) then return; end if;
  update bhs_dealer_order_lines set status='needs_review',reason='Custom line removed or changed',source_updated_at=p_version,updated_at=now()
    where shop=p_shop and order_id=p_order_id and line_id not in(select value->>'line_id' from jsonb_array_elements(p_lines));
  for item in select value from jsonb_array_elements(p_lines) loop
    if item->>'shop'<>p_shop or item->>'order_id'<>p_order_id then raise exception 'Order tenant mismatch'; end if;
    if item->>'quote_id' is not null and not exists(select 1 from bhs_dealer_quotes where id=(item->>'quote_id')::uuid and shop=p_shop) then raise exception 'Quote tenant mismatch'; end if;
    insert into bhs_dealer_order_lines(shop,order_id,line_id,order_name,quote_id,quantity,status,reason,source_updated_at)
      values(p_shop,p_order_id,item->>'line_id',item->>'order_name',(item->>'quote_id')::uuid,(item->>'quantity')::integer,item->>'status',item->>'reason',p_version)
      on conflict(shop,order_id,line_id) do update set order_name=excluded.order_name,quote_id=excluded.quote_id,
        quantity=excluded.quantity,status=excluded.status,reason=excluded.reason,source_updated_at=excluded.source_updated_at,updated_at=now();
  end loop;
end $$;
revoke all on function public.bhs_dealer_record_order(text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.bhs_dealer_record_order(text,text,timestamptz,jsonb) to service_role;
commit;
