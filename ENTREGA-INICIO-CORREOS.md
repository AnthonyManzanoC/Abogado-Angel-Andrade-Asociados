# Inicio ampliado y correo esencial

## Entrega del 12 de septiembre de 2026

El inicio incorpora una portada mayor, los cinco servicios completos con imágenes, un recorrido de tres pasos, compromiso del abogado, atención presencial y virtual y preguntas desplegables. A 895 px de ancho pasó de 3.761 px a aproximadamente 7.645 px de contenido. Se comprobó también a 390 px de viewport, sin desbordamiento horizontal. Los pasos funcionan con teclado y las preguntas se abren de forma nativa.

En **Admin → Configuración → Inicio ampliado** se editan 21 textos. En **Admin → Servicios → Imagen de portada** se puede elegir entre las cinco imágenes referenciales, subir una propia o quitarla. Inicio, catálogo y detalle comparten la imagen. Los archivos WebP están incluidos en el repositorio, no dependen de un servicio externo. Origen y prompts: [IMAGENES-SERVICIOS.md](IMAGENES-SERVICIOS.md).

## Frecuencia de correo

La opción predeterminada es **Esenciales**. El administrador puede volver a **Todos los cambios públicos**.

| Evento | Cliente | Administrador |
| --- | --- | --- |
| Consulta, cita o postulación recibida | Sí, referencia y enlace privado | Sí |
| Revisión rutinaria | Solo seguimiento | Solo panel |
| Aprobación o cita confirmada | Sí | Sí |
| Pago pendiente que requiere acción | Sí | Sí |
| Transferencia reportada | Solo seguimiento | Sí, para comprobarla |
| Pago verificado sin agendar todavía | Solo seguimiento | Solo panel |
| Cancelación o atención completada | Sí | Sí |
| Selección/no selección solidaria | Sí | Sí |
| Corregir una nota rutinaria | Solo seguimiento | Solo panel |
| Cambiar el enlace de una cita confirmada | Sí | Sí |
| Comunicar una novedad expresamente | Sí | Sí |

Alma, WebMCP, MCP y el formulario usan el mismo registro transaccional. Alma solicita un horario; la confirmación definitiva sigue siendo del abogado, y una cita virtual exige verificar el pago. No se genera un segundo correo por guardar sin cambios ni por repetir la creación con la misma clave de idempotencia.

La cola se despierta al registrar un aviso, comprueba trabajo pendiente cada segundo mientras el servidor está activo y procesa hasta 20 avisos seguidos, sin esperar cinco segundos entre destinatarios. La recepción real depende del proveedor y de la disponibilidad del servidor. Los HTTP 429 respetan Retry-After o una espera creciente; respuestas ambiguas no se reenvían automáticamente. Los acuses del proveedor evitan volver a enviar un aviso ya entregado.

## Hallazgos de producción y paso pendiente

La revisión encontró envío activado, 14 avisos aceptados por Brevo y 8 fallidos al preparar el correo. Los 22 figuraban sin acuse de entrega. Esto no permite afirmar que un correo aceptado fue recibido o leído. El endpoint de webhook rechazó con HTTP 401 la clave compartida local; el script se detuvo antes de modificar Brevo.

También había dos APIs locales conectadas a producción. Se detuvieron y se sustituyeron por una API de vista previa con envío desactivado en los puertos 5080/5085. La configuración privada local queda con `EMAIL_DELIVERY_ENABLED=false`. El código nuevo desactiva el envío en Development por defecto; `ALLOW_DEVELOPMENT_EMAIL=true` es una excepción explícita para entornos controlados.

El comprobador anterior solo aceptaba AES de 32 bytes aunque el cifrador admite 16, 24 y 32. Ahora ambos aceptan las mismas longitudes, y se comprueba que las claves puedan abrir hasta 25 avisos recientes/prioritarios. `NOTIFICATION_LEGACY_ENCRYPTION_KEYS` admite claves previas separadas por punto y coma para recuperar avisos anteriores conservando la clave actual. No se reenvían automáticamente los ocho fallidos ni se cambia su contenido.

Para cerrar producción se necesita acceso al servicio **andrade-legal-api** de Render:

1. Conservar `NOTIFICATION_ENCRYPTION_KEY` y `BREVO_API_KEY` actuales. No reemplazar la clave de cifrado por otra nueva.
2. Configurar las dos variables del archivo privado `.local/render-recuperacion.env` y desplegar el último commit de `codex/plataforma-legal` (migración 006). No publicar ese archivo.
3. Ejecutar `backend/scripts/Configure-BrevoWebhook.ps1`; solo registra el webhook después de comprobar el endpoint autenticado. Después comprobar configuración y remitente en el admin.
4. Revisar individualmente los fallidos y el estado actual de cada solicitud antes de reintentar. Una solicitud antigua puede haber recibido ya una decisión posterior.
5. Comprobar una nueva solicitud controlada, ambos destinatarios y su acuse de entrega. Esta entrega no incluyó correos reales de prueba a clientes.

El plan gratuito de Render puede suspender el servicio por inactividad; por ello no se garantiza envío inmediato con el servidor dormido. Véase [Render: servicios gratuitos](https://render.com/docs/free). La diferencia entre envío, entrega, demora y rechazo está descrita en [webhooks transaccionales de Brevo](https://developers.brevo.com/docs/transactional-webhooks).

## Verificación

- 134 comprobaciones de integración aprobadas, en un esquema PostgreSQL exclusivo de pruebas: solicitudes, pagos, cancelación, programa solidario, mensajes, webhook, cifrado, política esencial y Alma/MCP. Incluye la regresión final que impide a una API local pausada modificar la cola real.
- 18 comprobaciones del cliente aprobadas. Compilación de .NET sin errores ni advertencias; Next.js y TypeScript correctos, 14 rutas.
- Las pruebas se preparan con `tests/Prepare-Isolated.ps1`. Su copia de código sustituye únicamente el nombre del esquema por un identificador temporal; usa credenciales de prueba y transporte simulado. El servidor de pruebas nunca envía correo. No se ejecutó la suite sobre las solicitudes reales.
- `TEST_WEB_SEPARATE_API=true` omite solo compartir la sesión del admin entre APIs de esquemas diferentes; los permisos del backend aislado sí se comprueban.
- El lint global previo sigue teniendo deuda no abordada por esta entrega; no se declara aprobado.
