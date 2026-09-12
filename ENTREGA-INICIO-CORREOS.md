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

## Producción verificada: 12 de septiembre de 2026

Render, servicio **Abogado-Angel-Andrade-Asociados**, desplegó `0cb8e06` correctamente. Vercel también sirve los accesos nuevos. Las migraciones 006 y 007 están aplicadas. La comprobación pública autenticada devuelve `ready=true`, `sendingEnabled=true`, `webhookConfigured=true`, sin incidencias de configuración.

Se corrigieron tres causas: backend anterior aún desplegado; incompatibilidad entre la clave de cifrado actual y los avisos antiguos; webhook sin configuración compartida válida. Se conservó la clave actual y se añadió la original a `NOTIFICATION_LEGACY_ENCRYPTION_KEYS`. Brevo tiene un único webhook transaccional para la URL del portal, con autenticación y eventos de entrega/rechazo/demora. El script admite la respuesta `document_not_found` que Brevo devuelve cuando todavía no hay webhooks.

### Prueba real controlada

La prueba se creó por el MCP público, usando el correo del despacho como destinatario de cliente y de administrador. Referencia `AA-461C94C38268`, identificada expresamente como prueba técnica sin caso legal real.

| Evento | Creación (Ecuador) | Entrega cliente | Entrega administrador |
| --- | --- | --- | --- |
| Solicitud recibida | 15:31:44 | 15:31:47 | 15:31:48 |
| Cita agendada | 15:32:10 | 15:32:12 | 15:32:12 |
| Cancelación | 15:32:27 | 15:32:28 | 15:32:28 |

Los **seis avisos** figuran como `delivered` mediante callbacks reales de Brevo. No se simuló la entrega ni se cambió su estado manualmente. La revisión intermedia no generó avisos. La cancelación liberó el horario solicitado. El registro de prueba se conserva cancelado para auditoría; no queda una cita activa.

El enlace administrativo se abrió en navegador sin sesión, solicitó la contraseña y después abrió directamente la ficha correcta. El seguimiento privado respondió con el estado cancelado usando la clave de la prueba. La aceptación del proveedor, la entrega al servidor destinatario y la lectura son hechos distintos: se acreditó la entrega, no la lectura humana.

### Regresar desde el correo y comprobar transferencias

- Cliente: cada correo conserva el enlace privado a `/seguimiento`, referencia y pasos para volver. Sirve para consulta, cita y apoyo solidario. Para citas virtuales también permite reportar la transferencia y, al confirmarse, entrar a la videollamada.
- Administrador: el enlace lleva al login y abre la solicitud concreta. En apoyo solidario conserva la convocatoria correspondiente en hora de Ecuador.
- El cliente puede adjuntar un comprobante JPG, PNG o PDF de hasta 2 MB al reportar la referencia bancaria. Es opcional para conservar compatibilidad con solicitudes anteriores. Se valida el formato, se guarda cifrado en una tabla privada con RLS y se descarga únicamente mediante una sesión administrativa, sin caché y como adjunto. No forma parte de la biblioteca multimedia pública.
- Reportar referencia y archivo ocurre en la misma transacción. La clave privada de otra solicitud no autoriza la carga; repetir el envío no duplica la notificación. El archivo no verifica el ingreso: el abogado comprueba el banco y confirma el pago.
- **Los datos bancarios siguen en demostración por indicación del usuario.** Desde Admin → Configuración se deben introducir los datos reales y activar el cobro cuando estén disponibles. No se permiten transferencias ni comprobantes en solicitudes de demostración.

Los 8 avisos históricos fallidos ahora pueden descifrarse. Se conservan para revisión individual: no se reenvían automáticamente estados antiguos que podrían contradecir decisiones posteriores. Los nuevos avisos de la prueba no tuvieron fallos.

La vista previa local usa correo desactivado. El entorno Development no puede consumir la cola de producción salvo habilitación explícita. La configuración privada conserva la clave actual y la anterior; ninguno de esos secretos se incluyó en Git.

El plan gratuito de Render puede suspender el servicio por inactividad; por ello no se garantiza envío inmediato con el servidor dormido. Véase [Render: servicios gratuitos](https://render.com/docs/free). La diferencia entre envío, entrega, demora y rechazo está descrita en [webhooks transaccionales de Brevo](https://developers.brevo.com/docs/transactional-webhooks).

## Verificación

- 134 comprobaciones de integración aprobadas, en un esquema PostgreSQL exclusivo de pruebas: solicitudes, pagos, cancelación, programa solidario, mensajes, webhook, cifrado, política esencial y Alma/MCP. Incluye la regresión final que impide a una API local pausada modificar la cola real.
- 18 comprobaciones del cliente aprobadas. Compilación de .NET sin errores ni advertencias; Next.js y TypeScript correctos, 14 rutas.
- Las pruebas se preparan con `tests/Prepare-Isolated.ps1`. Su copia de código sustituye únicamente el nombre del esquema por un identificador temporal; usa credenciales de prueba y transporte simulado. El servidor de pruebas nunca envía correo. No se ejecutó la suite sobre las solicitudes reales.
- `TEST_WEB_SEPARATE_API=true` omite solo compartir la sesión del admin entre APIs de esquemas diferentes; los permisos del backend aislado sí se comprueban.
- El lint global previo sigue teniendo deuda no abordada por esta entrega; no se declara aprobado.

### Verificación adicional de esta actualización

13 comprobaciones nuevas de comprobantes y accesos aprobadas en un esquema aislado; 19 comprobaciones esenciales repetidas y aprobadas. Compilación .NET sin errores ni advertencias y build de Next.js/TypeScript correcto (14 rutas). El esquema temporal se eliminó al terminar. El comprobante y sus permisos se probaron con transporte simulado en ese esquema; los seis correos de la tabla anterior sí usaron producción y Brevo reales.
