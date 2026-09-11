# Trayectoria profesional y apoyo solidario

Esta ampliación conserva Next.js, la API .NET, Supabase, las reservas, el asistente Alma con voz, WhatsApp directo y el seguimiento privado. Toma como referencia la organización editorial de Haz & Rodríguez y mantiene la identidad oscura y dorada del despacho.

## Gestión desde el administrador

- **Configuración:** nombre y presentación del abogado, biografía, retrato, foto y descripción del edificio Alavama, logo, video, datos de contacto y programa solidario. Las fotos usan la biblioteca existente; el mapa permanece visible con o sin foto.
- **Perfil y casos ganados:** formación, logros, galería y casos. Cada elemento admite título, resumen, descripción, fotografía, orden y borrador/publicación. Los casos requieren resultado y confirmación de revisión de confidencialidad antes de publicarse. Retirar la publicación conserva el borrador.
- **Apoyo solidario:** bandeja privada por mes con situación legal, contexto de necesidad, condiciones aceptadas, notas internas, mensaje para la persona y decisión. El abogado realiza la selección, sin clasificación automática por vulnerabilidad.

La página `/firma` muestra solo la formación, logros y fotos publicados. No se añadieron titulaciones, reconocimientos ni victorias ficticias. `/casos` presenta resultados desplegables. El abogado debe cargar sus fotografías reales de graduación, logros y edificio, y grabar su video.

## Convocatorias mensuales

La página `/apoyo` explica el programa y permite postular. Configuración controla apertura, presentación, condiciones y día de cierre (1–28). Las fechas se calculan en Ecuador (UTC−5); el plazo incluye todo el día de cierre. El siguiente mes abre automáticamente si el programa permanece activo. Una pausa impide nuevos envíos, sin borrar los existentes.

Se admite una postulación por correo normalizado y mes. Nombre, contacto, relato, ciudad y contexto de necesidad quedan privados. Se guarda una copia de las condiciones aceptadas; no se solicitan documentos ni comprobantes de pago. La referencia y clave privada permiten regresar al seguimiento. Las postulaciones no ocupan horarios ni se mezclan con la bandeja de citas.

Estados de revisión: recibida, en revisión, seleccionada y no seleccionada. Seleccionar un caso cierra las nuevas postulaciones del mes; el administrador debe responder también a las restantes. La selección es final: una retirada posterior no permite conceder un segundo apoyo en la misma convocatoria. El índice único de PostgreSQL y el bloqueo por mes impiden selecciones simultáneas. Las actualizaciones administrativas requieren la versión vigente del registro.

La postulación no garantiza selección, atención inmediata ni resultado. El alcance gratuito y los posibles gastos de terceros deben quedar claros en las condiciones y acordarse antes de iniciar. Los textos son editables. El despacho coordina directamente la atención del caso elegido.

## Notificaciones y publicación

Las postulaciones y las decisiones preparan correos al cliente y al administrador dentro de la misma transacción. Se reutiliza la cola cifrada de Brevo y el enlace de seguimiento. Los correos no contienen el relato ni el contexto sensible. El estado de entrega se consulta en la bandeja de notificaciones existente; preparar un aviso no equivale a entregarlo.

Antes de usar en producción, publicar **ambos** servicios, configurar los secretos del backend y activar el envío según `MEJORAS-PREMIUM.md`. Las migraciones 003 y 004 se aplican al iniciar la API, conservando las solicitudes y contenidos existentes. La 004 agrega las categorías editoriales y la tabla privada con RLS. No se deben modificar las migraciones ya aplicadas.

El commit y el push del código no sustituyen la comprobación del despliegue en Vercel y Render. El proyecto mantiene el envío pausado y los pagos de demostración hasta completar esa activación. Ninguna credencial local debe subirse a Git.

## Comprobaciones

Build de Next.js con TypeScript y compilación .NET. La suite `CommunityChecks.cs` comprueba privacidad, consentimiento, idempotencia, correo normalizado, separación del CRM, selección concurrente única, retirada, cierre de convocatoria, control de acceso y publicación/borradores de casos, formación y galería. Usa datos temporales y no envía correos reales. Requiere una convocatoria sin postulaciones reales y elimina sus datos al terminar.

El lint estricto del repositorio aún reporta reglas de tipado, React y accesibilidad en componentes existentes y ampliados; no se desactivaron reglas para presentar una aprobación falsa. La compilación y las pruebas funcionales se verifican por separado. No se realizó una inspección visual automatizada en navegador ni se probaron micrófono físico o entrega de correo real.
