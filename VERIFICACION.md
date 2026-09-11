# Verificación de la actualización premium

## Acceso y notificaciones — 11 de septiembre de 2026

- Restablecimiento del administrador verificado en la web pública: login y sesión autenticada HTTP 200 con la contraseña de Render.
- Catálogo público verificado: Derecho Penal y defensa, Derecho Laboral y atención de lunes a viernes, 09:00–17:00.
- 90 verificaciones HTTP, base de datos, pagos, correo y recuperación aprobadas; 17 verificaciones del cliente aprobadas. Las pruebas de selección sobre la convocatoria actual se omiten porque ya contiene postulaciones reales. La novedad posterior a una selección se verificó en una convocatoria sintética separada.
- Webhook autenticado, duplicados, eventos tardíos, rechazo al cliente, alerta única al admin y ausencia de bucles comprobados con eventos de prueba. Ningún correo real enviado.
- Comprobación local contra Brevo real: remitente preparado, sin incidencias; envío pausado. Backend público: clave Brevo ausente y envío pausado. Falta aplicar variables y desplegar el backend en Render para la activación real.
- Build .NET sin advertencias y build Next.js/TypeScript aprobados. El lint estricto conserva la deuda documentada previamente y no se presenta como aprobado.
- Migración 005 aplicada, con RLS y sin borrar solicitudes. Vista previa en 3002 con API de revisión en 5085. Los servidores de revisión anteriores en 5082/5083 se cerraron.

Pasos operativos en [ACTIVACION-CORREOS.md](ACTIVACION-CORREOS.md). El archivo `.local/render-correo.env` contiene únicamente la configuración privada para Render y queda fuera de Git.

Fecha: 10 de septiembre de 2026 (Ecuador).

- 44 verificaciones HTTP, PostgreSQL, CMS, reservas, acceso y MCP de la suite existente aprobadas.
- 26 verificaciones adicionales de pagos, privacidad, cifrado, notificaciones, reintentos y sandbox de Brevo aprobadas.
- 16 verificaciones de funciones del cliente aprobadas.
- Backend .NET 9 compilado sin advertencias ni errores; frontend Next.js 16.3.4 compilado con comprobación TypeScript.
- La API real de Brevo aceptó en sandbox una plantilla generada por el servicio. El remitente suministrado aparece activo. No se enviaron correos reales.
- Migración 003 aplicada en andrade_portal: conserva datos anteriores, agrega estados, datos de pago y cola cifrada con RLS. No se alteraron las migraciones anteriores.
- Pruebas temporales eliminadas; la auditoría puede conservar las acciones técnicas de configuración de la suite existente.

Se verificaron la exigencia de pago para agendar una consulta virtual, el bloqueo de pagos en modo de prueba, la validación de dominios de reunión, el enlace privado de regreso, la separación de avisos entre cliente y administrador, la ausencia de correos al editar solo notas internas, la idempotencia, la reversión de verificaciones incompletas, la cancelación y liberación del horario. Un transporte HTTP simulado verificó aceptación, límites de cuota y respuestas ambiguas; no se procesaron pagos reales.

La cola tiene entrega inicialmente pausada. La aceptación de una plantilla en sandbox no verifica entrega en bandeja ni conservación de enlaces por el cliente de correo. No se probaron micrófono físico ni video de presentación: el abogado aún debe grabarlo. El reconocimiento de voz depende del navegador.

La vista previa local usa http://127.0.0.1:3002 y la API de revisión http://127.0.0.1:5083, sin detener los servidores originales. La configuración estándar sigue usando los puertos 3000/5080. El push del código no verifica por sí mismo la publicación en Vercel y Render. No se efectuó una revisión visual automatizada del sitio en navegadores.

## Ampliación editorial y comunitaria

Migración 004 aplicada: formación, logros, galería, casos y postulaciones solidarias privadas con RLS. Se aprobaron 26 comprobaciones adicionales de privacidad, consentimiento, selección concurrente única, cierre, retiro, idempotencia y publicación desde el CMS. Los datos de prueba se eliminaron. Se conserva la verificación anterior de reservas, seguimiento, pagos, correos simulados y MCP. La suite de cliente incluye además la intención de apoyo solidario del asistente (17 comprobaciones).

El lint estricto continúa reportando reglas de tipado, React y accesibilidad; no se considera aprobado. Build y pruebas funcionales son comprobaciones independientes. Los detalles y límites de la convocatoria están en TRAYECTORIA-Y-APOYO.md.

Consultar MEJORAS-PREMIUM.md para la activación y los límites operativos.
