-- LinkTap Santiago: esquema inicial para Supabase
-- Ejecutar manualmente en SQL Editor de un proyecto Supabase propio.
-- No habilita acceso público a datos personales.
create extension if not exists pgcrypto;

create table if not exists public.lt_cards (
  id text primary key check (id ~ '^MI-PERFIL-DIGITAL-00[1-5]$'),
  label text not null default 'Mi Perfil Digital',
  region text not null default 'Santiago',
  seller text not null default 'Catita',
  status text not null default 'available' check (status in ('available','reserved','assigned','active')),
  destination_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lt_orders (
  id uuid primary key default gen_random_uuid(),
  card_id text not null references public.lt_cards(id),
  customer_name text,
  customer_email text,
  customer_phone text,
  status text not null default 'received'
    check (status in ('received','designing','review','active','delayed','cancelled')),
  payment_confirmed_at timestamptz,
  complete_information_at timestamptz,
  -- Se calcula al consultar: greatest(payment_confirmed_at, complete_information_at) + interval '24 hours'
  tracking_token uuid not null unique default gen_random_uuid(),
  profile_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lt_one_open_order_per_card
on public.lt_orders(card_id)
where status in ('received','designing','review','delayed');

create table if not exists public.lt_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.lt_orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);

insert into public.lt_cards (id)
values ('MI-PERFIL-DIGITAL-001'),('MI-PERFIL-DIGITAL-002'),
       ('MI-PERFIL-DIGITAL-003'),('MI-PERFIL-DIGITAL-004'),
       ('MI-PERFIL-DIGITAL-005')
on conflict (id) do nothing;

-- Seguridad: ninguna tabla es accesible por anon/authenticated sin políticas.
alter table public.lt_cards enable row level security;
alter table public.lt_orders enable row level security;
alter table public.lt_order_events enable row level security;

-- Las operaciones del panel y las consultas de seguimiento deberán pasar
-- por un backend que autentique a Vicente/Catita y valide tracking_token.
-- Nunca colocar una clave service_role en HTML o JavaScript público.
