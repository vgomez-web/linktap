---
name: crear-perfil-linktap
description: Crear rápidamente desde ChatGPT un perfil LinkTap con carpeta por nombre, formulario y estado en construcción, y luego publicar la página final en la misma URL.
---

# Skill: crear-perfil-linktap

## Objetivo
Crear desde ChatGPT (incluido el celular) un perfil digital para una persona en el repositorio GitHub vgomez-web/linktap, rama main. El único dato obligatorio es el nombre; cargo o breve descripción son opcionales.

Ejemplo: «Crea perfil LinkTap para Camila Pérez, arquitecta»:
- Archivo: camila-perez/index.html
- URL prevista: https://linktap.cl/camila-perez/

Crear una **carpeta** nueva dentro del mismo repositorio, **no otro repositorio**. No numerar perfiles personales. Las páginas antiguas mi-perfil-digital-001, 002, 003, 004 y 005 son otro flujo.

## Recorrido del cliente
1. Abre https://linktap.cl/NOMBRE-APELLIDO/ y ve «Vamos a crear tu perfil digital», su nombre y un botón «Empezar mi perfil».
2. Ese botón abre el formulario existente /perfil-digital/?origen=perfil-personal&perfil=NOMBRE-APELLIDO.
3. Completa y envía sus datos. El servidor de formularios existente debe confirmar recepción y entregar código LT-...; nunca simular éxito.
4. Solamente después de esa respuesta, el formulario lo devuelve a /NOMBRE-APELLIDO/?solicitud=CODIGO. Allí la pantalla muestra «Estamos construyendo tu perfil», los personajes trabajando y su código de seguimiento. Se guarda localmente el código para el mismo navegador.
5. Cuando LinkTap termine el diseño y el usuario ordene publicarlo, actualizar el mismo index.html con el perfil definitivo, conservando la misma URL de tarjeta, enlace y QR.

## Operación A: iniciar perfil (por defecto)
1. Identificar nombre, ocupación y descripción corta si fueron entregados. Nunca inventar datos personales, contactos, biografías o redes.
2. Calcular slug seguro: minúsculas, sin tildes, ñ→n, espacios→guiones; permitir únicamente a-z, 0-9 y guiones simples, sin barras ni puntos, máximo 90 caracteres. Ejemplo: María José Núñez → maria-jose-nunez. Rechazar rutas reservadas como assets, perfil-digital, solicitud, monteverde, mi-perfil-digital-001 y otras rutas existentes.
3. El destino por defecto es SLUG/index.html en la raíz. No agregar carpetas padre ni números salvo indicación expresa y flujo compatible.
4. Consultar GitHub para comprobar si ya existe el archivo. Si existe, **no sobrescribir** ni asumir que corresponde al mismo cliente: entregar la ruta actual y solicitar instrucciones de actualización.
5. Leer la plantilla .agents/skills/crear-perfil-linktap/assets/index-inicio.html del repositorio. Reemplazar exactamente todas sus variables:
   - {{NOMBRE_HTML}}: nombre escapado para HTML (incluidos &, <, > y comillas) preservando ortografía.
   - {{SUBTITULO_HTML}}: ocupación/descripción corta indicada por el usuario escapada para HTML, o «Tu presentación, siempre contigo».
   - {{SLUG}}: slug seguro, válido como cadena JavaScript y como segmento de URL.
6. Verificar que no queden variables sin reemplazar y que el botón lleva al formulario usando el slug correcto.
7. Usar GitHub para crear SLUG/index.html en vgomez-web/linktap, rama main, commit «feat: iniciar perfil LinkTap de NOMBRE».
8. Releer el archivo para verificar y devolver enlaces a GitHub y a la URL pública prevista. Advertir que GitHub Pages puede tardar.

## Operación B: activar perfil definitivo
Únicamente cuando el usuario solicite «activar», «finalizar» o «publicar» un perfil y disponga de su información final:
1. Consultar SLUG/index.html para confirmar que es el perfil correcto en estado de inicio o construcción. No actualizar si hay dudas de identidad o de destino.
2. Leer .agents/skills/crear-perfil-linktap/assets/index-base.html (la plantilla final, diferente de la de inicio).
3. Completar {{NOMBRE_HTML}}, {{SUBTITULO_HTML}}, {{DESCRIPCION_HTML}} y {{META_DESCRIPCION_HTML}} con contenido real escapado. Opcionalmente usar un diseño final aprobado. No inventar ni publicar datos sensibles del formulario sin autorización.
4. Actualizar únicamente SLUG/index.html con su SHA actual y verificar releyendo. Mantener exactamente la misma URL para que no sea necesario reprogramar la tarjeta NFC.
5. Informar confirmación en GitHub, distinguiéndola de la propagación a GitHub Pages.

## Seguridad, compatibilidad y límites
- El formulario actual /perfil-digital/ envía información al Cloudflare Worker existente. El cliente nunca necesita escribir en GitHub, usar claves ni autorizar commits.
- El estado de construcción de perfiles nuevos se muestra por el parámetro solicitud y localStorage. **Aún no está sincronizado globalmente entre dispositivos**: si un cliente abre la URL desde otro navegador sin parámetro, podría ver la bienvenida hasta que LinkTap publique el perfil final.
- Completar el formulario NO publica automáticamente el diseño final en GitHub. Esa actualización requiere la petición de activación y contenido confirmado.
- Las tarjetas antiguas 001 a 005 de Santiago mantienen sus propias URLs y lógica. No tocarlas ni modificar monteverde/index.html u otras páginas.
- LT-... es el número de la solicitud de seguimiento, nunca parte del nombre de la carpeta.

## Respuesta final sugerida
«Perfil creado en GitHub: https://github.com/vgomez-web/linktap/blob/main/SLUG/index.html. URL prevista: https://linktap.cl/SLUG/. Al pulsar Empezar, el cliente completa el formulario y vuelve a su página con el estado En construcción cuando el servidor confirma la recepción.»
