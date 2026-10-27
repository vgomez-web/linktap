---
name: crear-perfil-linktap
description: Crear, verificar, personalizar y publicar perfiles digitales LinkTap para personas, profesionales, emprendimientos o empresas en GitHub sin sobrescribir perfiles existentes ni romper las URLs de tarjetas NFC.
---

# Skill: crear-perfil-linktap

## Propósito y contexto
Administrar perfiles digitales LinkTap en el repositorio **vgomez-web/linktap**, rama **main**, con URL pública prevista `https://linktap.cl/SLUG/`. Una tarjeta NFC y un QR son accesos al mismo perfil; también se puede compartir como enlace. La tarjeta LinkTap debe seguir siendo protagonista comercial, pero nunca obligatoria para visitar un perfil por URL.

**No crear un repositorio nuevo por cliente.** Cada cliente nuevo recibe su propia carpeta `SLUG/index.html` en el repositorio existente. Siempre verificar ruta y contenido antes de cualquier escritura.

## Casos admitidos
- Persona: nombre, actividad o cargo y enlaces de contacto.
- Profesional independiente: presentación, especialidad, servicios, agendamiento o portafolio si el cliente lo pide.
- Negocio o empresa: identidad de marca, descripción breve, contactos, horarios, dirección, servicios, catálogo y enlaces cuando correspondan.
- Colaborador de empresa: identidad individual, cargo, información empresarial, botón a perfil corporativo; mantener rutas de empresa y colaboradores separadas.
- Recepción compartida: perfil institucional con acceso a equipo, reservas, reseñas o sucursales si hay datos y autorización.

**Diseño modular, no rígido por rubro.** Elegir solo secciones que aportan valor al cliente. No inventar enlaces, fotografías, precios, convenios, cargos, logros ni testimonios. No introducir por defecto estadísticas, contadores, paneles, membresías ni funciones de pago no implementadas.

## Información mínima y nombres
Para **iniciar un perfil**, solo se requiere nombre de persona o negocio. Cargo, eslogan y descripción son opcionales. Para **publicar definitivamente**, se necesita información final confirmada y consentimiento para publicar enlaces o datos entregados en privado.

Crear slug legible usando minúsculas, quitar tildes, convertir ñ a n y espacios a guiones, eliminar cualquier carácter fuera de a-z, 0-9 y guiones, consolidar guiones, máximo 90 caracteres. Ejemplo: «María José Núñez» => `maria-jose-nunez`. Verificar colisiones con rutas existentes y reservadas como `assets`, `perfil-digital`, `solicitud`, `monteverde`, `mi-perfil-digital-001` hasta `005`. **Nunca reemplazar ni reutilizar un slug existente por coincidencia de nombre.** Si ya existe, mostrar la ruta y pedir una decisión antes de editar.

## Operación A — Crear perfil de bienvenida (por defecto)
1. Interpretar nombre y datos disponibles. No preguntar por campos opcionales cuando basta con iniciar.
2. Calcular slug y comprobar en GitHub que `SLUG/index.html` **no exista**.
3. Leer plantilla exacta `.agents/skills/crear-perfil-linktap/assets/index-inicio.html` del repositorio actual. Si la plantilla falta, detener creación e informar; no fabricar una página incompatible.
4. Sustituir **todas** las variables de la plantilla:
   - `{{NOMBRE_HTML}}`: nombre con escape HTML para &, <, > y comillas.
   - `{{SUBTITULO_HTML}}`: ocupación o frase breve real, escapada para HTML; si falta, «Tu presentación, siempre contigo».
   - `{{SLUG}}`: slug validado y seguro.
5. Validar que no queden tokens `{{...}}`, que la página sea móvil y accesible, y que el botón **Empezar mi perfil** apunte a `/perfil-digital/?origen=perfil-personal&perfil=SLUG` de acuerdo con el flujo de la plantilla vigente. Para empresas, no inventar otro valor de `origen`: conservar el compatible hasta verificar cambios en el formulario.
6. Crear **solo** `SLUG/index.html` en rama main mediante la operación GitHub de creación, jamás actualización, con commit descriptivo.
7. Volver a leer el archivo publicado en GitHub, comprobar nombre, slug, enlace al formulario y estado inicial.
8. Responder con URL de GitHub y URL pública **prevista**; no decir que está en línea si no se verificó la publicación de GitHub Pages.

## Recorrido del formulario y estado «en construcción»
1. El cliente abre `/SLUG/` desde su tarjeta NFC, QR o enlace y pulsa **Empezar mi perfil**.
2. Se abre el formulario existente `/perfil-digital/?origen=perfil-personal&perfil=SLUG`.
3. El formulario debe esperar **confirmación real del servidor** (Cloudflare Worker existente). No simular éxito ni código.
4. Solo ante una respuesta confirmada, volver a `/SLUG/?solicitud=CODIGO`. Allí se muestra **Estamos construyendo tu perfil** y, cuando exista, el código `LT-...`; la plantilla mantiene su comportamiento de `localStorage`.
5. **Limitación vigente:** localStorage es local al navegador. En otro dispositivo la página puede seguir mostrando la bienvenida si no abre un enlace con `?solicitud=`. No declarar que existe sincronización centralizada.
6. El envío de formulario no crea, diseña ni publica automáticamente el perfil definitivo.

## Operación B — Publicar perfil terminado
Ejecutar únicamente cuando el usuario pida activar, finalizar o publicar, con identidad y datos confirmados.
1. Leer `SLUG/index.html` y revisar identidad, contenido y SHA actual. Si pertenece a otro cliente, detenerse.
2. Leer `.agents/skills/crear-perfil-linktap/assets/index-base.html`. Respetar el diseño aprobado o usar la plantilla final como base.
3. Personalizar nombre, subtítulo, descripción y SEO; reemplazar `{{NOMBRE_HTML}}`, `{{SUBTITULO_HTML}}`, `{{DESCRIPCION_HTML}}` y `{{META_DESCRIPCION_HTML}}`, con escape HTML. Agregar, solo si se pidieron y se verificaron, enlaces a WhatsApp, correo, web, redes sociales, ubicación, reserva o catálogo.
4. Priorizar lectura fácil en móvil: encabezado claro, foto o logotipo autorizado, un CTA principal y botones secundarios. Evitar un bloque interminable de texto.
5. Para contacto, verificar prefijos y escapar correctamente URLs y atributos. Para enlaces externos usar buenas prácticas de seguridad `rel="noopener noreferrer"` si se usa `target="_blank"`. No exponer credenciales, formularios internos ni datos privados.
6. Confirmar que no queden variables `{{...}}`, enlaces vacíos o falsos, scripts externos no autorizados ni funciones prometidas pero ausentes.
7. Actualizar **exclusivamente** `SLUG/index.html` usando el SHA obtenido; releer y verificar la actualización. Mantener el slug y URL: NFC, QR y enlaces anteriores continúan funcionando.
8. No llamar «publicado en internet» a un commit hasta comprobar el sitio público.

## Operación C — Ajustar perfil existente
Si se pide mejorar diseño, texto, botones, imágenes o estructura:
- Obtener nombre o slug específico; leer primero la página actual.
- Conservar enlaces válidos, diseño aprobado, flujo, identificadores y funcionalidad existente salvo petición expresa.
- Cambios mínimos y localizados; utilizar SHA para evitar modificaciones accidentales.
- Nunca modificar perfiles de otras personas ni rutas generales sin permiso explícito.
- Comprobar archivo final y avisar qué cambió.

## Criterios visuales de LinkTap
- Profesional, moderno, minimalista y adaptable; identidad de cliente protagonista, marca LinkTap discreta.
- Usar un titular breve que identifique a la persona o negocio. Evitar exceso de tarjetas, etiquetas o párrafos.
- Diseñar primero para teléfonos, con botones grandes, buen contraste y carga ligera.
- Ofrecer guardar contacto mediante vCard solo si se dispone de datos aprobados y una implementación correcta.
- No incorporar por defecto precios de planes ni formularios de pago. Cualquier cobro o entrega comercial se rige por las indicaciones expresas del propietario de LinkTap.
- En el perfil final, contenido suficiente para entender quién es, qué ofrece y cómo contactarlo, sin forzar un único canal.

## Límites importantes
- Nunca tocar `monteverde/index.html`, rutas de clientes existentes, el formulario global, Cloudflare Worker, ni `mi-perfil-digital-001` a `005` por crear un cliente nuevo.
- La cuenta GitHub solo la utiliza el administrador; el cliente nunca necesita claves ni acceso al repositorio.
- No prometer estadísticas de visitas, clics ni funciones avanzadas aún no implementadas.
- No inventar que una tarjeta está vendida, activada o programada.
- No crear repositorios, dominios ni nuevos sistemas backend sin instrucción explícita.
- Si GitHub falla, describir el fallo y no afirmar que se creó el perfil.

## Respuesta al usuario
Al iniciar: «Perfil de [nombre] creado en GitHub: [archivo]. URL prevista: https://linktap.cl/SLUG/. El cliente puede iniciar su formulario y ver el estado de construcción tras la confirmación del envío».
Al publicar: «Perfil de [nombre] actualizado en la misma ruta. [Archivo GitHub]. Se conservó la URL usada por tarjeta NFC, QR y enlace».
