# LinkTap Business — preparación para entrega y alta de empresas

**Estado (6 de noviembre de 2026):** panel privado piloto funcionando para Monteverde; archivo multiempresa preparado en `cloudflare/business/worker-multitenant.js` (rama `feature/business-multitenant`). **No se ha instalado todavía ese Worker**. No enviar el panel al cliente hasta probar login y separación de empresas.

## URLs y distinciones importantes

- `https://linktap.cl/business/`: HTML **público de demostración** en GitHub Pages. No es un panel con datos privados, ni permite iniciar sesión seguro por sí mismo.
- `https://linktap-business-private.v-gomezsitja.workers.dev/`: Worker **privado** bajo Cloudflare Access; es el acceso de piloto actual. Es el enlace a entregar solo después de terminar pruebas, o mover luego a un dominio propio bajo el mismo control de acceso.
- `linktap-business-api.v-gomezsitja.workers.dev`: colector de eventos públicos; **NO** reemplazar su código por el Worker privado.
- Base D1: `linktap-business-db`; tablas `lb_companies`, `lb_memberships`, `lb_profiles`, `lb_events`, `lb_audit`.

## Antes de la visita a Monteverde

1. Comprobar que el Worker de eventos público sigue recibiendo `view` y clics en los 4 enlaces de Monteverde.
2. Instalar `cloudflare/business/worker-multitenant.js` **solo en** `linktap-business-private`, conservando D1 binding `DB` y la aplicación Cloudflare Access. Guardar copia de la versión anterior para restaurarla si hay un error.
3. Abrir en navegador normal el Worker privado con la identidad de prueba ya autorizada; probar **Resumen** (7, 30 y 90 días), **Perfiles**, perfil institucional y tres ejecutivos, búsqueda, y **Solicitudes** (solo prepara correo; verificar que no registra una solicitud automáticamente).
4. Comprobar que las 4 URLs reales abren el perfil público correspondiente. Un clic no significa necesariamente un contacto completado, y las visitas no son usuarios únicos.
5. Para categorías, el recolector puede registrar `whatsapp`, `save_contact` y `other_link`; **no** atribuir automáticamente `other_link` a Google Reviews, Instagram ni Google Maps. Una clasificación granular futura requiere modificar la instrumentación de los perfiles.
6. No prometer que `/business` en el dominio principal está protegido; eso requiere configurar Cloudflare proxy/ruta/Access o migrar el HTML privado a un hostname protegido.

## Mañana, cuando entreguen un correo de Monteverde

Solicitar el correo de la persona autorizada. No publicar el correo ni códigos de un solo uso. En Cloudflare Access → aplicación del Worker privado → política **Allow**, agregar el correo como identidad autorizada, sin eliminar `linktap.cl@gmail.com` durante pruebas.

En D1 → Console, asociar **únicamente** ese correo a Monteverde:

```sql
INSERT INTO lb_memberships (email, company_id, role)
VALUES ('CORREO_REAL_DE_LA_CLINICA', 'monteverde', 'admin');
```

No ejecutar con el correo de ejemplo. Verificar en D1 que el correo tiene **una sola** fila en `lb_memberships`, ya que el Worker bloquea correos asociados a varias empresas. Para corregir un ingreso duplicado, inspeccionar antes de modificar.

Prueba de acceso: abrir incógnito en el **Worker privado**, usar el correo real, recibir PIN en ese correo, validar que solo aparezca Monteverde. Abrir el panel de otra empresa desde ese mismo usuario **no** debe ser posible. Mantener el correo LinkTap como cuenta de pruebas y ayuda técnica; si en el futuro necesita ver varias empresas, diseñar rol de superadministrador separado, nunca asignarle varias empresas en `lb_memberships` con el código actual.

## Alta de futuras empresas

1. Registrar empresa en `lb_companies` con ID único, por ejemplo `comexport`.
2. Registrar sus perfiles existentes en `lb_profiles`, asignando **siempre** el mismo `company_id`. La app solo presenta los datos de su `company_id` autenticado.
3. Para ficha institucional, usar ID `<company_id>-recepcion` o un slug con palabra `recepcion`, `institucional` o `empresa`; si no existe perfil institucional, el panel mostrará un estado vacío. **No se crea automáticamente**.
4. Registrar correo de cliente en `lb_memberships` con `company_id` correspondiente; autorizar ese correo en la política Cloudflare Access.
5. Probar en incógnito, comprobar que el usuario no ve datos de otras empresas, entregar **la misma URL del Worker privado**.

**Seguridad:** no exponer consultas D1 ni datos de miembros desde GitHub Pages. El Worker verifica JWT firmado y busca empresa por correo autenticado, nunca por parámetro de URL. La política Allow de Access debe limitarse a correos explícitamente autorizados. No deshabilitar Access. La versión actual admite una empresa por identidad; soporte multicliente de administrador central es un proyecto separado.
