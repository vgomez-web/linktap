---
name: crear-perfil-linktap
description: Crear rápidamente una carpeta y su index.html en el repositorio GitHub de LinkTap usando solo el nombre de una persona. Activar ante peticiones como "crear perfil de Camila Pérez", "haz un index para Juan", "crear carpeta para un cliente" o "nuevo perfil LinkTap".
---

# Crear perfil LinkTap en GitHub

## Objetivo
Convertir una petición mínima, por ejemplo "crear perfil para Camila Pérez", en un archivo nuevo y publicado en el repositorio \`vgomez-web/linktap\`, rama \`main\`:

- \`camila-perez/index.html\`
- URL prevista: \`https://linktap.cl/camila-perez/\`

En GitHub no se crean carpetas vacías: al crear ese archivo se crea también su carpeta. El usuario NO tiene que repetir nombre de repositorio, nombre de rama ni estructura.

## Datos de entrada
1. **Nombre**: único dato obligatorio. Respetar mayúsculas, minúsculas y tildes en el contenido visible.
2. **Tema o propósito**: opcional; usarlo para personalizar los textos si aparece en el pedido. Sin tema, crear un perfil digital personal genérico y elegante, sin inventar profesión, contactos, marcas ni biografía.
3. **Carpeta padre**: opcional. Por defecto crear en la raíz del repositorio. Solo si el usuario pide explícitamente Monteverde, usar \`monteverde/<slug>/index.html\`. No asumir Monteverde para nuevas personas por asociación con trabajos anteriores.

## Reglas para la ruta
- Convertir nombre a minúsculas, quitar tildes y normalizar ñ→n, separar palabras con guion: "María José Núñez" → \`maria-jose-nunez\`.
- El slug admite únicamente a-z, 0-9 y guiones simples. Eliminar caracteres de rutas como \`/\`, \`..\`, barras, y cualquier carácter peligroso.
- No sobrescribir nunca un archivo existente, ni \`index.html\` de la raíz, ni perfiles previos.
- Antes de crear, consultar si ya existe la ruta. Si existe, informar y pedir nueva ruta o permiso explícito para actualizar. No asumir que es el mismo cliente.

## Flujo de ejecución
1. Identificar el nombre de la persona y el tema opcional del último mensaje.
2. Calcular el slug y ruta del nuevo \`index.html\`.
3. Usar la conexión de GitHub disponible para consultar el archivo objetivo en \`vgomez-web/linktap\`, rama \`main\`.
4. Si no existe, obtener el archivo plantilla \`.agents/skills/crear-perfil-linktap/assets/index-base.html\` del mismo repositorio.
5. Reemplazar **todas** las variables:
   - \`{{NOMBRE_HTML}}\`: nombre escapado para HTML (especialmente &, <, >, comillas).
   - \`{{SUBTITULO_HTML}}\`: tema breve indicado por usuario, o "Tu presentación, siempre contigo".
   - \`{{DESCRIPCION_HTML}}\`: descripción acorde al tema, o "Un espacio simple para presentarte y conectar en un solo tap." No inventar datos personales.
   - \`{{SLUG}}\`: slug seguro.
   - \`{{META_DESCRIPCION_HTML}}\`: texto SEO corto y escapado ("Perfil digital de [nombre] en LinkTap").
6. Crear solo el nuevo archivo \`<ruta>/index.html\` mediante la herramienta GitHub de creación de archivos, mensaje de commit: \`feat: crear perfil LinkTap de <nombre>\`.
7. Verificar volviendo a leer el archivo creado. Informar la ruta y los enlaces GitHub y web previsto; distinguir archivo confirmado de publicación en GitHub Pages. Si hay error de escritura, no afirmar que el perfil fue creado.

## Diseño
- Página estática en HTML, CSS y JS, responsive, rápida, compatible con GitHub Pages.
- Estética minimalista y profesional de LinkTap; al proporcionar solo el nombre, diseño inicial listo para completar.
- No incluir teléfonos, redes sociales ni direcciones inventadas. Botón "Compartir perfil" debe funcionar sin credenciales.
- Si el usuario especifica una profesión o rubro, personalizar textos; no inventar calificaciones, experiencia o certificaciones.
- No modificar archivos ajenos, \`monteverde/index.html\`, ni menús de otros clientes.
- No usar APIs externas, tokens ni secretos.

## Respuesta final al usuario
Ser breve: "Creado: \`<ruta>/index.html\`. GitHub: <enlace>. URL prevista: <enlace>."
Si la página aún no está desplegada, aclarar que la URL pública depende de GitHub Pages y del dominio.
