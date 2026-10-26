-- LinkTap Santiago: activar el destino de una tarjeta desde Panel Vicente.
-- Ejecutar una sola vez en Supabase SQL Editor.
-- Sólo admin puede actualizar tarjetas. Sales mantiene acceso de lectura.
grant update (status, destination_url) on public.lt_cards to authenticated;
drop policy if exists "lt_cards_admin_update" on public.lt_cards;
create policy "lt_cards_admin_update" on public.lt_cards
for update to authenticated
using ((select public.lt_my_role()) = 'admin')
with check ((select public.lt_my_role()) = 'admin');

-- Función pública que sólo revela una URL HTTPS de una tarjeta ACTIVA.
-- No revela clientes ni pedidos.
create or replace function public.lt_public_card_destination(p_card_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select destination_url from public.lt_cards
  where id = p_card_id
    and status = 'active'
    and destination_url ~* '^https://[^[:space:]]+$'
  limit 1;
$$;
revoke all on function public.lt_public_card_destination(text) from public;
grant execute on function public.lt_public_card_destination(text) to anon, authenticated;
select policyname, cmd from pg_policies
where schemaname='public' and tablename='lt_cards'
order by policyname;
