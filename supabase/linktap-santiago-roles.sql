-- LinkTap Santiago: roles privados de Vicente y Catita
-- Ejecutar en Supabase SQL Editor DESPUÉS de linktap-santiago.sql.
-- No abre acceso a pedidos ni datos de clientes.

create table if not exists public.lt_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','sales')),
  created_at timestamptz not null default now()
);

alter table public.lt_staff enable row level security;

-- Cada usuario autenticado puede consultar únicamente su propio rol.
-- No se crean políticas INSERT, UPDATE ni DELETE para usuarios normales.
drop policy if exists "lt_staff_read_own" on public.lt_staff;
create policy "lt_staff_read_own"
on public.lt_staff for select to authenticated
using (user_id = (select auth.uid()));

-- Identificamos usuarios existentes por correo en auth.users.
-- Solo la ejecución administrativa de este script asigna roles.
do $$
declare
  admin_id uuid;
  sales_id uuid;
begin
  select id into admin_id from auth.users
  where lower(email) = 'linktap.cl@gmail.com' limit 1;
  select id into sales_id from auth.users
  where lower(email) = 'catalina.bcgz@gmail.com' limit 1;

  if admin_id is null or sales_id is null then
    raise exception 'Falta la cuenta de Vicente o Catita en Authentication > Users';
  end if;
  if admin_id = sales_id then
    raise exception 'Las dos cuentas deben ser diferentes';
  end if;

  insert into public.lt_staff(user_id,role) values (admin_id,'admin')
  on conflict (user_id) do update set role=excluded.role;
  insert into public.lt_staff(user_id,role) values (sales_id,'sales')
  on conflict (user_id) do update set role=excluded.role;
end $$;

-- Comprobación administrativa (SQL Editor).
select u.email, s.role
from public.lt_staff s
join auth.users u on u.id=s.user_id
where lower(u.email) in ('linktap.cl@gmail.com','catalina.bcgz@gmail.com')
order by s.role;
