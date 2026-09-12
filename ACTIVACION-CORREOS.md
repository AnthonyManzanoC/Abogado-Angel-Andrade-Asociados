# Acceso y notificaciones operativas

**Actualización:** el estado y los pasos vigentes de recuperación están en [ENTREGA-INICIO-CORREOS.md](ENTREGA-INICIO-CORREOS.md). Producción ya tiene Brevo activado; no reemplaces su clave de cifrado con el archivo de instalación original. El nuevo modo esencial reduce los avisos rutinarios.

## Acceso corregido

Se comprobó el rechazo 401 en la web pública: la contraseña de `ADMIN_PASSWORD` en Render no coincidía con el hash persistido. La inicialización crea la cuenta una vez y no reemplaza contraseñas en cada despliegue. Se restableció puntualmente el acceso y se verificaron login y sesión autenticada públicos con respuesta 200. Las sesiones anteriores quedaron cerradas.

Para futuras recuperaciones existe `dotnet backend.dll --reset-admin`, ejecutado una vez con `ADMIN_EMAIL` y `ADMIN_PASSWORD` correctos y acceso a la base. No debe añadirse al comando de arranque: es una operación administrativa puntual que termina al completarse. Dentro del admin sigue disponible el cambio normal de contraseña. No se guardan contraseñas ni claves en Git.

## Qué comunica el sistema

| Novedad | Cliente | Administrador |
| --- | --- | --- |
| Consulta o cita recibida | Referencia, siguiente paso, seguimiento | Nueva solicitud |
| Revisión o aprobación | Estado y mensaje del abogado | Cambio registrado |
| Transferencia reportada / verificada | Estado del pago | Comprobación pendiente o realizada |
| Cita agendada | Fecha en Ecuador, modalidad, dirección o videollamada | Confirmación |
| Atención completada o cancelada | Resultado operativo y seguimiento | Cambio registrado |
| Postulación solidaria y decisión | Explicación propia del programa, sin cobro | Solicitud o decisión |
| Novedad escrita desde admin | Mensaje y enlace privado | Copia del aviso |
| Rechazo o bloqueo de un correo al cliente | Incidencia visible en seguimiento | Aviso único de entrega fallida |

Las notas internas no se incluyen en correos. Guardar cambios exclusivamente privados no genera avisos. La función **Comunicar una novedad** permite informar avances después de una atención o selección solidaria, sin alterar la decisión. Requiere la versión vigente del registro y evita repetir el mismo mensaje.

La plantilla distingue consulta, cita y apoyo solidario; muestra cuándo se generó el aviso, la referencia y el siguiente paso. Un aviso antiguo no sustituye el estado actual del seguimiento. El texto del administrador se escapa antes de incluirse en HTML.

## Activación en Render y Brevo

La revisión del backend público encontró `configured=false` para Brevo y envío pausado. La configuración local sí pasó la comprobación real del remitente activo. El acceso a Render requiere iniciar sesión en su panel; la sesión de administración del despacho no da acceso a Render.

1. En el servicio **andrade-legal-api → Environment**, agregar las cuatro variables preparadas en el archivo privado `.local/render-correo.env`: `BREVO_API_KEY`, `NOTIFICATION_ENCRYPTION_KEY`, `BREVO_WEBHOOK_SECRET` y `EMAIL_DELIVERY_ENABLED`. Conservar los valores existentes de base de datos, orígenes, URL de API y administrador. El archivo privado no pertenece al repositorio; no publicarlo ni pegarlo en un issue. Se debe usar la misma clave de cifrado estable que protegió los avisos y enlaces existentes.
2. Guardar las variables y desplegar el último commit de `codex/plataforma-legal`. El backend aplica la migración 005 sin borrar solicitudes. Publicar también el frontend. El blueprint mantiene el despliegue automático desactivado; un push no confirma por sí solo que Render ejecuta la versión nueva.
3. Desde este repositorio, ejecutar `./backend/scripts/Configure-BrevoWebhook.ps1`. Primero prueba el endpoint publicado con un evento sin efectos y la clave compartida; solo después registra o actualiza el webhook de Brevo, evitando duplicados. No envía correos. Puede usar variables de entorno o el archivo privado `backend/appsettings.Local.json`.
4. En **Admin → Notificaciones → Comprobar configuración y remitente**, resolver cualquier pendiente. En **Configuración**, comprobar URL pública, remitente y destinatario administrativo. Activar el envío después de revisar la cola pendiente: al activarlo se procesarán también esos avisos.
5. Con un correo controlado por el despacho, crear una solicitud y comprobar recepción en ambas bandejas, enlace de regreso y actualización administrativa. Brevo distingue aceptación del envío y entrega al servidor destinatario; ninguna de las dos acredita lectura. Revisar spam si corresponde.

No se han enviado correos reales de prueba a clientes. Los bancos continúan en demostración hasta completar los datos definitivos. La nueva integración muestra aceptación, entrega, demora, rechazo, bloqueo o queja; eventos duplicados no duplican avisos y eventos tardíos de demora no revierten una entrega confirmada. No se reenvía un aviso si el proveedor ya informó su entrega. Un fallo del correo del administrador no genera un bucle de avisos.

El webhook usa autenticación Bearer y no pone la clave en la URL. Solo guarda identificador, tipo y fecha del evento; no conserva el cuerpo completo del callback. La recepción depende de que el servicio esté disponible. El plan gratuito configurado no garantiza operación inmediata mientras Render esté suspendido por inactividad.

## Servicios y horario

Derecho Penal y defensa y Derecho Laboral están publicados. El horario público es lunes a viernes, 09:00 a 17:00, conservando las horas previamente configuradas. El calendario excluye sábados y domingos para nuevas reservas; no cancela citas existentes. Estos datos siguen siendo editables desde admin.

## Referencias técnicas

La confirmación de entrega y sus estados se basan en los [webhooks transaccionales de Brevo](https://developers.brevo.com/docs/transactional-webhooks). La autenticación usa el mecanismo [Bearer documentado por Brevo](https://developers.brevo.com/docs/secured-webhooks).
