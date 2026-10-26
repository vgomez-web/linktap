

const ALLOWED_ORIGINS = [

  "https://linktap.cl",

  "https://www.linktap.cl"

];



const MAX_BODY_BYTES = 100000;

const MAX_PROFILES = 30;



function json(data, status = 200, origin = null) {

  const headers = {

    "Content-Type": "application/json; charset=utf-8",

    "Cache-Control": "no-store",

    "X-Content-Type-Options": "nosniff"

  };



  if (origin && ALLOWED_ORIGINS.includes(origin)) {

    headers["Access-Control-Allow-Origin"] = origin;

    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";

    headers["Access-Control-Allow-Headers"] = "Content-Type";

    headers["Vary"] = "Origin";

  }



  return new Response(JSON.stringify(data), {

    status,

    headers

  });

}



function clean(value, max = 500) {

  return typeof value === "string"

    ? value.trim().slice(0, max)

    : "";

}



function validEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}



function validObject(value) {

  return value !== null &&

    typeof value === "object" &&

    !Array.isArray(value);

}



function safeJSON(value, max = 12000) {

  const result = JSON.stringify(value ?? {});

  return result.slice(0, max);

}



async function verifyTurnstile(token, secret, ip) {

  if (!token || !secret) return false;



  const body = new FormData();

  body.append("secret", secret);

  body.append("response", token);



  if (ip) {

    body.append("remoteip", ip);

  }



  const result = await fetch(

    "https://challenges.cloudflare.com/turnstile/v0/siteverify",

    {

      method: "POST",

      body,

      signal: AbortSignal.timeout(8000)

    }

  );



  if (!result.ok) return false;



  const verification = await result.json();



  return (

    verification.success === true &&

    ["linktap.cl", "www.linktap.cl"].includes(

      verification.hostname

    )

  );

}



function makeCode() {

  return "LT-" +

    crypto.randomUUID().replace(/-/g, "")

      .slice(0, 12).toUpperCase();

}



function profileData(profile) {

  const extra = {

    video: clean(profile.video, 1000),

    reservas: clean(profile.reservas, 1000),

    catalogo: clean(profile.catalogo, 1000),

    testimonios: clean(profile.testimonios, 3000),

    ...(validObject(profile.datos_extra)

      ? profile.datos_extra

      : {})

  };



  return {

    nombre: clean(profile.nombre, 200),

    cargo: clean(profile.cargo, 200),

    profesion: clean(profile.profesion, 200),

    whatsapp: clean(profile.whatsapp, 40),

    correo: clean(profile.correo || profile.email, 254),

    instagram: clean(profile.instagram, 500),

    linkedin: clean(profile.linkedin, 500),

    descripcion: clean(profile.descripcion, 3000),

    servicios: clean(profile.servicios, 3000),

    enlaces: safeJSON(

      validObject(profile.enlaces) ? profile.enlaces : {}

    ),

    datos_extra: safeJSON(extra)

  };

}



// Notificación privada a LinkTap.

// Nunca exponer la API key al navegador.

async function notifyByEmail(env, codigo, data) {

  if (!env.RESEND_API_KEY) {

    console.error(

      "Falta RESEND_API_KEY; solicitud guardada:",

      codigo

    );

    return false;

  }



  const lines = [

    "NUEVA SOLICITUD LINKTAP",

    "Codigo: " + codigo,

    "Tipo: " + data.tipo_cliente,

    "Plan: " + data.plan,

    "Contacto: " + data.nombre_contacto,

    "Correo: " + data.correo_contacto,

    "Telefono: " +

      (data.telefono_contacto || "No indicado"),

    "Comentarios: " + (data.notas || "Sin comentarios")

  ];



  if (data.tipo_cliente === "empresa" && data.empresa) {

    const e = data.empresa;



    lines.push(

      "",

      "EMPRESA",

      "Nombre: " + (e.nombre || ""),

      "Rubro: " + (e.rubro || ""),

      "Sitio web: " + (e.sitio_web || e.web || ""),

      "WhatsApp: " + (e.whatsapp || ""),

      "Direccion: " + (e.direccion || ""),

      "Redes: " + JSON.stringify(e.redes_sociales || {}),

      "Datos adicionales: " +

        JSON.stringify(e.datos_extra || {})

    );

  }



  for (const [index, raw] of data.perfiles.entries()) {

    const p = profileData(raw);



    lines.push(

      "",

      "PERFIL " + (index + 1),

      "Nombre: " + p.nombre,

      "Cargo: " + p.cargo,

      "Profesion: " + p.profesion,

      "WhatsApp: " + p.whatsapp,

      "Correo: " + p.correo,

      "Instagram: " + p.instagram,

      "LinkedIn: " + p.linkedin,

      "Descripcion: " + p.descripcion,

      "Servicios: " + p.servicios,

      "Enlaces: " + p.enlaces,

      "Datos adicionales: " + p.datos_extra

    );

  }



  const controller = new AbortController();

  const timeout = setTimeout(

    () => controller.abort(),

    10000

  );



  try {

    const result = await fetch(

      "https://api.resend.com/emails",

      {

        method: "POST",

        headers: {

          "Authorization": "Bearer " + env.RESEND_API_KEY,

          "Content-Type": "application/json",

          "Idempotency-Key": "linktap-" + codigo

        },

        body: JSON.stringify({

          from: "LinkTap <notificaciones@linktap.cl>",

          to: ["linktap.cl@gmail.com"],

          reply_to: data.correo_contacto,

          subject: "Nueva solicitud LinkTap · " + codigo,

          text: lines.join("\n")

        }),

        signal: controller.signal

      }

    );



    if (!result.ok) {

      console.error(

        "Resend rechazo notificacion",

        codigo,

        result.status,

        (await result.text()).slice(0, 500)

      );

      return false;

    }



    return true;

  } catch (error) {

    console.error(

      "Error al notificar",

      codigo,

      String(error)

    );

    return false;

  } finally {

    clearTimeout(timeout);

  }

}



// NUEVO: recepción independiente de diseños NFC.

async function handleNfcDesign(request, env, origin) {

  if (!env.RESEND_API_KEY || !env.TURNSTILE_SECRET) {

    return json({

      ok: false,

      error: "Servicio de envío no configurado"

    }, 503, origin);

  }



  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

  const MAX_REQUEST_BYTES = 7 * 1024 * 1024 + 12000;



  const declared = Number(

    request.headers.get("Content-Length") || 0

  );



  if (declared > MAX_REQUEST_BYTES) {

    return json({

      ok: false,

      error: "Imagen demasiado grande (máximo 5 MB)"

    }, 413, origin);

  }



  const contentType =

    (request.headers.get("Content-Type") || "")

      .toLowerCase();



  if (!contentType.startsWith("application/json")) {

    return json({

      ok: false,

      error: "Formato de solicitud no permitido"

    }, 415, origin);

  }



  let data;



  try {

    const body = await request.text();



    if (

      new TextEncoder().encode(body).length >

      MAX_REQUEST_BYTES

    ) {

      throw Error("SIZE");

    }



    data = JSON.parse(body);

  } catch (e) {

    return json({

      ok: false,

      error: String(e.message) === "SIZE"

        ? "Imagen demasiado grande"

        : "Datos inválidos"

    }, 400, origin);

  }



  if (!validObject(data)) {

    return json({

      ok: false,

      error: "Datos inválidos"

    }, 400, origin);

  }



  const nombre = clean(data.nombre, 90);

  const correo = clean(data.correo, 160);

  const telefono = clean(data.telefono, 30);

  const marca = clean(data.marca, 100);

  const frase = clean(data.frase, 100);

  const orientacion = clean(data.orientacion, 20);

  const destino = clean(data.destino, 100);

  const enlace = clean(data.enlace, 500);

  const escala = Number(data.escala);



  if (

    nombre.length < 2 ||

    !validEmail(correo) ||

    !marca ||

    !["horizontal", "vertical"].includes(orientacion) ||

    !Number.isFinite(escala) ||

    escala < 40 ||

    escala > 160

  ) {

    return json({

      ok: false,

      error: "Revisa los datos del formulario"

    }, 400, origin);

  }



  // Protección Cloudflare Turnstile.

  const token = clean(data.turnstileToken, 3000);

  let verified = false;



  try {

    verified = await verifyTurnstile(

      token,

      env.TURNSTILE_SECRET,

      request.headers.get("CF-Connecting-IP")

    );

  } catch (e) {

    console.error(

      "Turnstile diseño",

      String(e)

    );

  }



  if (!verified) {

    return json({

      ok: false,

      error: "Completa la verificación de seguridad"

    }, 403, origin);

  }



  // Imagen original del cliente.

  // No se adjunta ninguna captura de la vista previa.

  let attachments = [];



  if (

    data.imagen !== null &&

    data.imagen !== undefined

  ) {

    const img = data.imagen;



    if (

      !validObject(img) ||

      typeof img.base64 !== "string" ||

      !/^[A-Za-z0-9+/]+={0,2}$/.test(img.base64) ||

      img.base64.length >

        Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4

    ) {

      return json({

        ok: false,

        error: "Archivo de imagen inválido"

      }, 400, origin);

    }



    const mime = clean(img.tipo, 80);



    const types = {

      "image/png": "png",

      "image/jpeg": "jpg",

      "image/webp": "webp"

    };



    if (!types[mime]) {

      return json({

        ok: false,

        error: "Solo se admiten imágenes PNG, JPG o WebP"

      }, 400, origin);

    }



    const estimated =

      Math.floor(img.base64.length * 3 / 4) -

      (img.base64.endsWith("==")

        ? 2

        : img.base64.endsWith("=")

          ? 1

          : 0);



    if (

      estimated < 1 ||

      estimated > MAX_UPLOAD_BYTES

    ) {

      return json({

        ok: false,

        error: "La imagen debe pesar menos de 5 MB"

      }, 413, origin);

    }



    const bytes = Uint8Array.from(

      atob(img.base64),

      c => c.charCodeAt(0)

    );



    const png =

      bytes.length > 7 &&

      bytes[0] === 137 &&

      bytes[1] === 80 &&

      bytes[2] === 78 &&

      bytes[3] === 71 &&

      bytes[4] === 13 &&

      bytes[5] === 10 &&

      bytes[6] === 26 &&

      bytes[7] === 10;



    const jpg =

      bytes.length > 3 &&

      bytes[0] === 255 &&

      bytes[1] === 216 &&

      bytes[2] === 255;



    const webp =

      bytes.length > 12 &&

      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&

      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";



    if (

      !(

        (mime === "image/png" && png) ||

        (mime === "image/jpeg" && jpg) ||

        (mime === "image/webp" && webp)

      )

    ) {

      return json({

        ok: false,

        error: "El contenido del archivo no coincide con su formato"

      }, 400, origin);

    }



    const filename =

      clean(img.nombre, 120)

        .replace(/[^a-zA-Z0-9._-]/g, "_")

        .replace(/^\.+/, "") ||

      "imagen." + types[mime];



    attachments = [{

      filename,

      content: img.base64,

      content_type: mime

    }];

  }



  const codigo = makeCode();



  const body = [

    "PREFERENCIAS DE DISEÑO NFC - LINKTAP",

    "Código: " + codigo,

    "Cliente: " + nombre,

    "Correo: " + correo,

    "Teléfono: " + (telefono || "No indicado"),

    "Marca: " + marca,

    "Frase: " + (frase || "Sin frase"),

    "Tarjeta: Blanca",

    "Orientación: " + orientacion,

    "Destino NFC: " + destino,

    "Enlace: " + (enlace || "Por definir"),

    "Escala de la imagen: " + escala + "%",

    "Imagen original: " +

      (attachments.length

        ? "Adjunta"

        : "No adjuntó imagen"),

    "",

    "La vista previa es referencial y NO se adjunta.",

    "Diseño definitivo pendiente de preparación."

  ].join("\n");



  let response;



  try {

    response = await fetch(

      "https://api.resend.com/emails",

      {

        method: "POST",

        headers: {

          "Authorization":

            "Bearer " + env.RESEND_API_KEY,

          "Content-Type": "application/json",

          "Idempotency-Key":

            "linktap-design-" + codigo

        },

        body: JSON.stringify({

          from: "LinkTap <notificaciones@linktap.cl>",

          to: ["linktap.cl@gmail.com"],

          reply_to: correo,

          subject:

            "Diseño NFC LinkTap · " +

            marca + " · " + codigo,

          text: body,

          ...(attachments.length

            ? { attachments }

            : {})

        }),

        signal: AbortSignal.timeout(15000)

      }

    );
  } catch (e) {

    console.error(

      "Error Resend diseño",

      codigo,

      String(e)

    );



    return json({

      ok: false,

      error:

        "No se pudo conectar con el servicio de correo. Intenta nuevamente."

    }, 502, origin);

  }



  if (!response.ok) {

    console.error(

      "Resend rechazó diseño",

      codigo,

      response.status,

      (await response.text()).slice(0, 300)

    );



    return json({

      ok: false,

      error:

        "El correo no pudo enviarse. Intenta nuevamente."

    }, 502, origin);

  }



  return json({

    ok: true,

    codigo,

    mensaje: "Preferencias enviadas correctamente"

  }, 201, origin);

}



// Sincroniza solicitudes de la campaña Santiago con Supabase.
// No expone credenciales al navegador. D1 sigue siendo el registro principal.
async function syncSantiagoOrder(env, data, codigo) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase no configurado", codigo);
    return false;
  }
  const notas = data.notas || "";
  if (!/Origen: LinkTap Connect Santiago|Origen: LinkTap Santiago/.test(notas)) return true;
  const packMatch = notas.match(/Pack: (Pro|Esencial)/i);
  const pack = packMatch ? packMatch[1].toLowerCase() : data.plan;
  const qtyMatch = notas.match(/Cantidad de tarjetas NFC:\s*(\d+)/i);
  const qty = qtyMatch ? Math.max(1, Math.min(100, Number(qtyMatch[1]))) : 1;
  const cardMatch = notas.match(/Tarjeta NFC:\s*(MI-PERFIL-DIGITAL-00[1-5])/i);
  const cardId = cardMatch ? cardMatch[1] : null;
  const basePrice = pack === "pro" ? 54990 : pack === "esencial" ? 34990 : null;
  const row = {
    customer_name: data.nombre_contacto,
    customer_email: data.correo_contacto,
    customer_phone: data.telefono_contacto,
    status: "received",
    seller: "Catita",
    source: "Santiago",
    pack,
    card_quantity: qty,
    total_price: basePrice, // Precio base del pack; adicionales por cotizar.
    request_code: codigo,
    card_id: cardId
  };
  const endpoint = env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/lt_orders";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      console.error("Supabase rechazó pedido", codigo, response.status, (await response.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error al sincronizar Supabase", codigo, String(error));
    return false;
  }
}

// WORKER PRINCIPAL

export default {

  async fetch(request, env) {

    const url = new URL(request.url);

    const origin = request.headers.get("Origin");



    // CORS

    if (request.method === "OPTIONS") {

      if (!ALLOWED_ORIGINS.includes(origin)) {

        return json({

          error: "Origen no permitido"

        }, 403);

      }



      return new Response(null, {

        status: 204,

        headers: {

          "Access-Control-Allow-Origin": origin,

          "Access-Control-Allow-Methods": "POST, OPTIONS",

          "Access-Control-Allow-Headers": "Content-Type",

          "Vary": "Origin",

          "Cache-Control": "no-store"

        }

      });

    }



    // Comprobar conexión D1.

    if (

      url.pathname === "/health" &&

      request.method === "GET"

    ) {

      try {

        const result = await env.DB.prepare(

          "SELECT 1 AS connected"

        ).first();



        return json({

          ok: result?.connected === 1,

          database: "connected"

        });

      } catch (error) {

        console.error(

          "Health check error",

          error

        );



        return json({

          ok: false,

          database: "unavailable"

        }, 503);

      }

    }



    // Información pública.

    if (

      url.pathname === "/" &&

      request.method === "GET"

    ) {

      return json({

        service: "LinkTap API",

        status: "ready",

        message: "Sistema de recepcion preparado"

      });

    }



    // NUEVA RUTA:

    // Personalización gráfica de tarjetas NFC.

    if (

      url.pathname === "/api/nfc-diseno" &&

      request.method === "POST"

    ) {

      if (!ALLOWED_ORIGINS.includes(origin)) {

        return json({

          ok: false,

          error: "Origen no autorizado"

        }, 403);

      }



      return handleNfcDesign(

        request,

        env,

        origin

      );

    }



    // RUTA EXISTENTE:

    // Solicitudes de perfiles digitales.

    if (

      url.pathname !== "/api/solicitudes" ||

      request.method !== "POST"

    ) {

      return json({

        error: "Ruta no encontrada"

      }, 404);

    }



    if (!ALLOWED_ORIGINS.includes(origin)) {

      return json({

        error: "Origen no autorizado"

      }, 403);

    }



    try {

      if (!env.DB || !env.TURNSTILE_SECRET) {

        return json({

          error: "Servicio no configurado"

        }, 503, origin);

      }



      const contentType =

        request.headers.get("Content-Type") || "";



      if (

        !contentType.toLowerCase()

          .startsWith("application/json")

      ) {

        return json({

          error: "Formato no permitido"

        }, 415, origin);

      }



      const contentLength = Number(

        request.headers.get("Content-Length") || 0

      );



      if (contentLength > MAX_BODY_BYTES) {

        return json({

          error: "Solicitud demasiado grande"

        }, 413, origin);

      }



      const raw = await request.text();



      if (

        new TextEncoder().encode(raw).length >

        MAX_BODY_BYTES

      ) {

        return json({

          error: "Solicitud demasiado grande"

        }, 413, origin);

      }



      let data;



      try {

        data = JSON.parse(raw);

      } catch {

        return json({

          error: "JSON invalido"

        }, 400, origin);

      }



      if (!validObject(data)) {

        return json({

          error: "Datos invalidos"

        }, 400, origin);

      }



      // Datos principales.

      const tipo = clean(data.tipo_cliente, 30);

      const plan = clean(data.plan, 40);

      const nombre = clean(data.nombre_contacto, 150);

      const correo = clean(data.correo_contacto, 254);

      const telefono = clean(data.telefono_contacto, 40);

      const notas = clean(data.notas, 3000);



      if (

        !["individual", "empresa"].includes(tipo)

      ) {

        return json({

          error: "Tipo de cliente invalido"

        }, 400, origin);

      }



      if (

        !["necesario", "esencial", "pro", "completo"].includes(plan)

      ) {

        return json({

          error: "Plan invalido"

        }, 400, origin);

      }



      if (

        !nombre ||

        !validEmail(correo)

      ) {

        return json({

          error: "Ingresa un nombre y correo valido"

        }, 400, origin);

      }



      const perfiles = data.perfiles;



      if (

        !Array.isArray(perfiles) ||

        perfiles.length < 1 ||

        perfiles.length > MAX_PROFILES ||

        !perfiles.every(validObject) ||

        (

          tipo === "individual" &&

          perfiles.length !== 1

        )

      ) {

        return json({

          error: "Lista de perfiles invalida"

        }, 400, origin);

      }



      const empresa = data.empresa;



      if (

        tipo === "empresa" &&

        (

          !validObject(empresa) ||

          !clean(empresa.nombre, 200)

        )

      ) {

        return json({

          error: "Falta el nombre de la empresa"

        }, 400, origin);

      }



      // Verificación Turnstile.

      const token = clean(

        data.turnstileToken,

        3000

      );



      const ip = request.headers.get(

        "CF-Connecting-IP"

      );



      let verified = false;



      try {

        verified = await verifyTurnstile(

          token,

          env.TURNSTILE_SECRET,

          ip

        );

      } catch (error) {

        console.error(

          "Turnstile error",

          error

        );

      }



      if (!verified) {

        return json({

          error: "Verificacion de seguridad fallida"

        }, 403, origin);

      }



      // Identificadores.

      const codigo = makeCode();



      const bytes = new Uint8Array(6);

      crypto.getRandomValues(bytes);



      let solicitudId = 0;



      for (const byte of bytes) {

        solicitudId =

          solicitudId * 256 + byte;

      }



      if (solicitudId === 0) {

        solicitudId = 1;

      }



      // Escrituras D1.

      const statements = [];



      statements.push(

        env.DB.prepare(`

          INSERT INTO solicitudes (

            id,

            codigo,

            tipo_cliente,

            plan,

            nombre_contacto,

            correo_contacto,

            telefono_contacto,

            estado,

            notas,

            fecha_envio

          )

          VALUES (

            ?, ?, ?, ?, ?, ?, ?,

            'recibida', ?, CURRENT_TIMESTAMP

          )

        `).bind(

          solicitudId,

          codigo,

          tipo,

          plan,

          nombre,

          correo,

          telefono,

          notas

        )

      );



      // Empresa.

      if (tipo === "empresa") {

        statements.push(

          env.DB.prepare(`

            INSERT INTO empresas (

              solicitud_id,

              nombre,

              rubro,

              sitio_web,

              whatsapp,

              direccion,

              redes_sociales,

              datos_extra

            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?)

          `).bind(

            solicitudId,

            clean(empresa.nombre, 200),

            clean(empresa.rubro, 200),

            clean(

              empresa.sitio_web || empresa.web,

              500

            ),

            clean(empresa.whatsapp, 40),

            clean(empresa.direccion, 500),

            safeJSON({

              instagram: clean(

                empresa.instagram,

                500

              ),

              ...(validObject(

                empresa.redes_sociales

              )

                ? empresa.redes_sociales

                : {})

            }),

            safeJSON(

              validObject(empresa.datos_extra)

                ? empresa.datos_extra

                : {}

            )

          )

        );

      }



      // Perfiles.

      for (const perfil of perfiles) {

        const p = profileData(perfil);



        statements.push(

          env.DB.prepare(`

            INSERT INTO perfiles (

              solicitud_id,

              nombre,

              cargo,

              profesion,

              whatsapp,

              correo,

              instagram,

              linkedin,

              descripcion,

              servicios,

              enlaces,

              datos_extra,

              estado

            )

            VALUES (

              ?, ?, ?, ?, ?, ?, ?,

              ?, ?, ?, ?, ?, 'pendiente'

            )

          `).bind(

            solicitudId,

            p.nombre,

            p.cargo,

            p.profesion,

            p.whatsapp,

            p.correo,

            p.instagram,

            p.linkedin,

            p.descripcion,

            p.servicios,

            p.enlaces,

            p.datos_extra

          )

        );

      }



      // Guardar en D1.

      await env.DB.batch(statements);



        // Registrar campaña Santiago en el panel, sin interrumpir correos si falla.
        const supabaseSynced = await syncSantiagoOrder(env, {
          nombre_contacto: nombre,
          correo_contacto: correo,
          telefono_contacto: telefono,
          plan,
          notas
        }, codigo);

      // Notificar por correo.

      const notificationSent =

        await notifyByEmail(

          env,

          codigo,

          {

            tipo_cliente: tipo,

            plan,

            nombre_contacto: nombre,

            correo_contacto: correo,

            telefono_contacto: telefono,

            notas,

            empresa:

              tipo === "empresa"

                ? empresa

                : null,

            perfiles

          }

        );



      return json({

        ok: true,

        codigo,

        mensaje:

          "Solicitud recibida correctamente",

        notificacion:

          notificationSent

            ? "enviada"

            : "pendiente"

      }, 201, origin);



    } catch (error) {

      console.error(

        "Error al guardar solicitud",

        error

      );



      return json({

        ok: false,

        error:
          "No fue posible completar la solicitud"

      }, 500, origin);

    }

  }

};