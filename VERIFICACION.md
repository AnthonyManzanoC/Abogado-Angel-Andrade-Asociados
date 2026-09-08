# Verificación de entrega

Fecha: 7 de septiembre de 2026.

## Resultado

- 44 verificaciones HTTP y de integración aprobadas en `tests/Program.cs`.
- 16 verificaciones de funciones del cliente aprobadas en `tests/client-functions.test.cjs`.
- Frontend Next.js 16.3.4: compilación de producción y comprobación TypeScript correctas.
- Backend .NET 9: compilación y publicación correctas, sin errores ni advertencias.
- npm y NuGet: cero vulnerabilidades reportadas en las dependencias instaladas al comprobarlas.
- Inicio local probado mediante `scripts/Start-Local.ps1`; API y web siguen ejecutándose como procesos de fondo.
- PostgreSQL de Supabase: conexión TLS con certificado verificado, dos migraciones aplicadas en el esquema `andrade_portal` y diez tablas protegidas con RLS.
- Configuración privada excluida de Git y del resultado publicado de .NET. Certificado CA y ambas migraciones incluidos en el resultado de publicación.

## Flujos verificados

Acceso administrativo y cookie HttpOnly; rechazo de sesión ausente, contraseña incorrecta y origen no autorizado; edición del CMS y visibilidad pública; aislamiento de borradores; paginación sin duplicados; carga de archivos y reproducción por rangos; carga directa con CORS y permisos de un solo uso; rechazo de archivos no admitidos; validación de consentimiento, fechas y disponibilidad; idempotencia; exclusión de reservas simultáneas; seguimiento con clave privada; separación de notas internas y públicas; actualización y cancelación; liberación del horario; negociación, descubrimiento y ejecución con el SDK MCP; comprobación de persistencia directamente en PostgreSQL; todas las rutas públicas y el paso de sesión por el proxy del frontend.

En el cliente se verificaron las intenciones en español, prioridades, tildes, reinicio explícito, claves aleatorias, fragmentos de seguimiento, dominios y protocolos permitidos para inserción de videos, el uso de las mismas funciones por la asistente y el formulario, el rechazo de herramientas desconocidas y la compatibilidad sin WebMCP.

Las solicitudes, publicaciones y archivos temporales creados para las pruebas se eliminaron. La auditoría puede conservar entradas técnicas de las comprobaciones.

## Alcance

No se publicó en Vercel ni Render; se entregaron configuración e instrucciones de despliegue. No se accedió al contenido privado de redes sociales ni se fabricaron videos. La reproducción externa depende de la disponibilidad y permisos de las publicaciones que incorpore el administrador.

La asistente funciona por texto mediante reglas; no incluye reconocimiento de voz. Las novedades se presentan dentro de la web, no se envían por correo, SMS o WhatsApp.

La validación fue de código, compilación, HTTP, protocolo y base de datos. No se ejecutó una revisión visual automática en navegadores ni se probó un despliegue remoto real.
