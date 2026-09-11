# Mejoras del despacho Andrade · septiembre de 2026

La implementación conserva Next.js, .NET, PostgreSQL/Supabase, el CMS y las seis herramientas MCP existentes. La referencia de Haz & Rodríguez orientó la presentación personal y la separación clara del contenido; no se copiaron biografías, credenciales, testimonios ni fotografías de terceros.

## Configuración para el abogado

En **Administrador → Configuración** se gestionan el nombre de Alma, logo, imagen y video de presentación, biografía, WhatsApp, valor de consulta, banco, correo remitente, correo del administrador y dirección pública. Los servicios, publicaciones, promociones y horarios mantienen sus editores existentes.

- WhatsApp: **+593 98 664 8328**, conversación humana mediante enlace directo. No hay envíos automáticos, plantillas de Meta ni integración con WhatsApp Business API.
- Alma: nombre inicial editable. Dictado con revisión del texto y lectura opcional de respuestas; mantiene las gestiones programadas y MCP. No interpreta libremente casos jurídicos ni utiliza IA generativa.
- Video: el abogado debe grabarlo. Puede subir MP4/WebM de hasta 25 MB o pegar un enlace de YouTube; sin video se muestra su retrato. Sugerencia: 60–90 segundos con presentación, trayectoria verificable, enfoque de atención e invitación a conversar. Puede grabarse una versión ligera para la web y añadir subtítulos desde YouTube.
- Logo: PNG, JPG o WebP de la biblioteca; se puede volver al monograma original.

## Cita y transferencia

Una solicitud virtual con horario comienza **Pendiente de pago** y conserva el valor y las instrucciones vigentes en ese momento. La configuración inicial usa **USD 25 como ejemplo**, no como honorario autorizado, y datos de prueba que nunca se presentan como una cuenta real. El modo de prueba bloquea el reporte y la verificación de pagos reales.

Para recibir pagos reales, el abogado debe sustituir banco, titular y cuenta, fijar el honorario definitivo, desactivar el modo de prueba y guardar. Las solicitudes anteriores de demostración siguen bloqueadas; se necesita una nueva solicitud en modo real.

El cliente informa la referencia de transferencia desde su seguimiento privado. El administrador contrasta el ingreso y su valor con el banco, registra la referencia comprobada, pega una reunión creada en su propia cuenta de Google Meet o Zoom y pulsa **Verificar pago y agendar**. El servidor exige todas esas condiciones. Una imagen o una referencia declarada no verifica automáticamente el ingreso; no existe una conexión bancaria ni OCR de comprobantes.

La aprobación del despacho y el agendamiento son estados diferentes. Las notas internas no generan correos. La cancelación libera el horario y oculta la reunión; un pago anterior no se devuelve automáticamente, debe coordinarse con el despacho. No se reabren solicitudes canceladas o completadas. Los horarios pendientes se mantienen ocupados hasta que el administrador o el cliente cancelan; revisar la agenda evita retenciones innecesarias.

## Correos durables

Solicitud, historial y mensajes de salida se guardan en la misma transacción. Los mensajes y la clave recuperable del enlace se cifran con AES-GCM en la base; la clave original continúa validándose mediante hash para el seguimiento. El servidor usa HTTPS de Brevo, no SMTP. El contenido de correo evita el resumen jurídico y las notas internas.

La cola muestra **Pendiente**, **Enviando**, **Aceptado por Brevo**, **Fallido** y **Por comprobar**. La aceptación por la API no acredita llegada a la bandeja de entrada. No se implementaron webhooks de entrega, rebote ni lectura. Brevo puede reescribir enlaces y registrar aperturas/clics según su configuración: no se presupone que esto esté desactivado. Comprobar en una prueba real que el enlace conserva el fragmento de seguimiento y revisar la configuración de privacidad de Brevo.

Los límites HTTP 429 reintentan cada dos minutos hasta cinco intentos. Una respuesta ambigua, timeout o interrupción queda para revisión manual para reducir duplicados. Antes de reintentar desde **Actividad e integraciones**, revisar el registro de Brevo y el estado actual de la cita; un aviso antiguo conserva el contenido de aquel momento. El reintento actualiza remitente, destinatario administrativo y URL pública usando la configuración vigente. No se promete entrega exactamente una vez ante fallos de red.

## Paso a producción

Se modificó y probó el proyecto local. La actualización se entrega mediante commit y push; el despliegue de ambos servicios debe comprobarse por separado. El envío permanece desactivado en la configuración del administrador hasta activar la versión pública y sus secretos.

1. En Render, configurar **BREVO_API_KEY**, **NOTIFICATION_ENCRYPTION_KEY** y **EMAIL_DELIVERY_ENABLED=true**. La clave de cifrado debe contener 32 bytes aleatorios codificados en base64, ser estable y conservarse en futuras publicaciones. Para leer enlaces y cola creados en este entorno, trasladar de forma privada la misma clave guardada en `backend/appsettings.Local.json`; no generar otra ni subir ese archivo a Git. Conservar una copia privada. Rotar la clave de Brevo compartida en la conversación y actualizar solo el secreto del servidor.
2. Publicar backend y frontend coordinadamente. La migración `003_premium_booking.sql` agrega campos y la cola sin borrar solicitudes ni contenidos anteriores. El arranque la aplica una sola vez. El frontend utiliza el proxy existente; no configurar claves de Brevo en Vercel.
3. En Configuración, comprobar la URL **https://abogado-angel-andrade-asociados.vercel.app**, el remitente activo **abogadoandradenotificaciones@gmail.com** y el correo del administrador. Activar el envío cuando ambas versiones estén publicadas. La activación también procesa avisos pendientes.
4. Hacer una solicitud con un correo controlado por el despacho; comprobar recepción en ambas bandejas, enlace privado, aprobación y cancelación. El sandbox de Brevo valida formato, no entrega real.
5. Publicar el video real e ingresar los datos bancarios definitivos antes de desactivar el modo de prueba.

La cola se ejecuta en el proceso de la API. El plan gratuito de Render configurado en el proyecto puede detener el proceso por inactividad: no es una garantía de notificaciones inmediatas mientras duerme. Para atención continua, usar un servicio que permanezca activo. No se añadió un gasto recurrente ni un proveedor adicional.

## Validación

Compilación .NET y Next.js/TypeScript, suite de integración anterior, comprobaciones de pago y cola, y funciones del cliente. Los registros de prueba se eliminan al terminar. La prueba de transporte usa un cliente HTTP simulado; la prueba opcional contra la API real de Brevo usa `X-Sib-Sandbox: drop`, sin correos ni pagos reales. No se afirma haber probado dictado con micrófono físico, reproducción del video aún no grabado ni entrega real a una bandeja.

## Referencias consultadas

- [Haz & Rodríguez](https://www.hazrodriguez.org/): referencia editorial y de presentación de profesionales.
- [Brevo: correo transaccional](https://developers.brevo.com/docs/send-a-transactional-email) y [sandbox](https://developers.brevo.com/docs/using-sandbox-mode).
- [MDN: SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition): compatibilidad y procesamiento del audio.
- [Render: servicios gratuitos](https://render.com/docs/free): suspensión por inactividad y límites operativos.
