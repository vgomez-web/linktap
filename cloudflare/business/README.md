# LinkTap Business — Fase 2: estadísticas reales (PREPARACIÓN)

Esta carpeta es una propuesta técnica **no desplegada**. No modifica el Worker de solicitudes existente ni los perfiles publicados. No ejecutar SQL sobre la D1 de producción antes de respaldar y revisar sus tablas.

## Inventario observado (5 noviembre 2026)
- Sitio estático publicado por GitHub Pages desde main.
- `/business/index.html` publicado como DEMO con datos inventados.
- `/admin/index.html` es un panel de solicitudes: usa otro endpoint Worker de administración.
- `cloudflare/linktap-worker-santiago.js` usa binding `env.DB` para solicitudes y menciona Supabase.
- No se verificó en el panel de Cloudflare cuál Worker, D1, bindings y rutas están desplegados efectivamente.

## Arquitectura propuesta
- Crear **otro Cloudflare Worker** para Business y una D1 de pruebas.
- `schema.sql` crea tablas `lb_*` de empresas, administradores, perfiles, eventos e historial.
- `worker.js` ingesta de eventos y endpoints con identidad validada mediante JWT de Cloudflare Access.
- Cada consulta privada se filtra por `company_id` determinado en servidor a partir del correo autorizado.
- La empresa no puede crear, editar ni cambiar diseños; solo activar/pausar y consultar estadísticas.
- Los eventos públicos son `view`, `whatsapp`, `call`, `email`, `save_contact`, `other_link`.

## Requisitos de implementación (aún pendientes)
1. Revisar en Cloudflare **Workers & Pages**, **D1**, **Access** y DNS/rutas: nombre del Worker, DB ID, URLs, bindings y políticas; NO compartir tokens ni contraseñas.
2. Crear D1 de pruebas y ejecutar `schema.sql` allí. Evaluar retención de eventos y políticas de datos.
3. Configurar Worker aislado con binding D1 `DB`, `ALLOWED_ORIGIN=https://linktap.cl`, `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD` de la aplicación correcta.
4. Configurar Cloudflare Access para **rutas privadas** `/api/business/dashboard`, `/api/business/audit`, `/api/business/profiles/*/status`. Las rutas públicas `/api/business/events` y `/api/business/profile-status` no deben estar detrás de login de usuarios finales. Diseñar rutas/hostname y políticas antes de desplegar.
5. Crear administrador empresarial con invitación segura y asignar su correo a una empresa (nunca por parámetros controlados por navegador).
6. Instalar telemetría solo en un perfil de prueba después de confirmar eventos, CORS, bot/WAF y límites de tasa.
7. Adaptar dashboard para consumir API real, mostrando estados de carga y error, nunca ceros ficticios.
8. Validar 7/30/90 días, zonas horarias, clics de enlaces externos, clientes sin eventos y aislamiento entre dos empresas.
9. Migrar perfiles reales individualmente después de aprobación.

## Precisión de los datos
- Vistas = eventos de apertura recogidos desde navegador, no personas identificadas ni lecturas de NFC verificadas.
- Clics = pulsaciones de botones, no mensajes enviados ni llamadas contestadas.
- No se recupera el pasado si no existió medición.
- Restringir spam/fraude con Cloudflare WAF, reglas de frecuencia, eventos idempotentes y detección de automatización; `Origin` y UUID no evitan el fraude. Auditoría periódica antes de presentar cifras al cliente.
- `lb_events` almacena eventos individuales. No guardar IP, teléfonos, correos de visitantes ni datos personales de terceros.

## Advertencia crítica de desactivación
Una página HTML pública y estática de GitHub Pages **no se puede proteger realmente solo con JavaScript**: el contenido sigue accesible como HTML fuente y por cachés aunque muestre una pantalla «inactivo».
Para ofrecer *desactivación real*, hay que servir los perfiles a través de un gateway (Worker con control de estado antes de entregar el contenido), o alojar el contenido en un backend que compruebe la autorización. No conectar el botón de activación en producción hasta resolver esto.

## Validaciones de lanzamiento
- Aislamiento: un admin Comexport no puede obtener un perfil/estadística de Monteverde cambiando IDs.
- Un visitante anónimo no puede consultar endpoints privados (401/403).
- La sesión Access expirada no concede datos.
- Los cambios de estado quedan auditados (admin, instante y anterior/nuevo).
- Clientes que no tienen actividad muestran «Sin datos» y no cifras inventadas.
- El Worker de pedidos sigue operativo antes y después de la prueba.

## Estado actual
- Código escrito en una rama de desarrollo.
- **Sin D1 configurada, sin Access configurado, sin despliegue del Worker y sin medición real.**
