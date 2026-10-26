-- LinkTap Santiago / paso 13: lectura segura de inventario y pedidos.
-- Requiere ejecutar antes linktap-santiago.sql y linktap-santiago-roles.sql.
-- Los usuarios no pueden crear, editar ni borrar pedidos o tarjetas todavía.

-- Comprueba el rol desde la tabla protegida. SECURITY DEFINER evita
-- recursión en políticas y mantiene la función sin acceso público directo.
create or replace function public.lt_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.lt_staff
  where user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.lt_my_role() from public;
grant execute on function public.lt_my_role() to authenticated;

-- Sólo los dos miembros del equipo pueden consultar el inventario.
drop policy if exists "lt_cards_staff_read" on public.lt_cards;
create policy "lt_cards_staff_read"
on public.lt_cards for select to authenticated
using ((select public.lt_my_role()) in ('admin','sales'));

-- Los pedidos se leen únicamente por los miembros autorizados.
drop policy if exists "lt_orders_staff_read" on public.lt_orders;
create policy "lt_orders_staff_read"
on public.lt_orders for select to authenticated
using ((select public.lt_my_role()) in ('admin','sales'));

-- El historial sólo se consulta por miembros autorizados.
drop policy if exists "lt_events_staff_read" on public.lt_order_events;
create policy "lt_events_staff_read"
on public.lt_order_events for select to authenticated
using ((select public.lt_my_role()) in ('admin','sales'));

-- Confirmación del estado de las políticas y las cinco tarjetas.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('lt_cards','lt_orders','lt_order_events','lt_staff')
order by tablename, policyname;
