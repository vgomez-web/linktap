# LinkTap Business — lectura privada con estadísticas reales

Estado: **preparado en rama**, NO desplegado. La web pública y Worker de eventos siguen funcionando.

## Lo que hace private-dashboard-worker.js
- Verifica firma del JWT de Cloudflare Access, emisor, audiencia y vencimiento.
- Busca el administrador en `lb_memberships` y determina su empresa en servidor.
- `GET /api/business/dashboard?days=7|30|90` devuelve los perfiles y eventos REALES de esa empresa.
- `GET /api/business/history` devuelve su historial de cambios de estado.
- Rechaza solicitudes anónimas; no concede controles de edición ni activación.
- No publica métricas mediante el endpoint público del Worker de ingesta.

## Lo que falta ANTES de desplegar
1. Crear Worker **SEPARADO** `linktap-business-private` con binding D1 `DB` a `linktap-business-db`.
2. Configurar aplicación Cloudflare Access en ese Worker, con una política Allow **exclusivamente** para correos administradores definidos y un inicio de sesión seguro.
3. Configurar variables `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` del Access app creado; no adivinar valores.
4. Revisar compatibilidad del login de Access con una interfaz alojada en otro origen (`linktap.cl`). Los navegadores pueden bloquear cookies entre sitios. Se recomienda panel y API bajo un mismo dominio proxied o front-end servido por el Worker con Access.
5. Insertar en `lb_memberships` solo después de verificar el correo del administrador autorizado. NO utilizar un correo encontrado en un perfil público como prueba de autorización.
6. Comprobar que una cuenta no autorizada devuelve 401 o 403 y que un usuario de una empresa no recibe datos de otra empresa.
7. Conectar gráficas con respuestas reales y estados de «sin datos», carga y error. Quitar cifras de ejemplo SOLO después de validar la autenticación.
8. Agregar límites de tasa y anti-bot en ingesta pública, y acordar políticas de retención antes de ofrecer cifras comerciales.

**Importante:** Google/GitHub Pages no protege la fuente HTML de un perfil marcado como inactivo. La desactivación real requiere servidor/gateway que decida antes de servir el contenido. No implementar el botón hasta resolverlo.

## Monteverde
D1 contiene Alexis, Stefano, Lissette y Recepción, con visitas y clics de prueba ya registrados. La tabla `lb_memberships` aún no tiene identidad empresarial verificada. La API privada no debe desplegarse hasta tener esa protección.
