# Plataforma del Ab. Ángel Andrade Núñez

Aplicación completa en español para el despacho del Edificio Alavama, calle Sucre y 5 de Junio, Babahoyo, Ecuador. La web pública, administración y asistente se conectan a una API .NET y guardan los datos en PostgreSQL de Supabase.

## Abrir en este equipo

- Web: http://127.0.0.1:3000
- Administración: http://127.0.0.1:3000/admin
- API: http://127.0.0.1:5080/api/health
- Credenciales privadas del administrador: `.local/ACCESO-ADMIN.txt`.
- Si los servidores están detenidos, ejecuta `INICIAR.cmd`. El script inicia los procesos sin abrir ventanas adicionales y muestra las direcciones.

Las credenciales y la conexión suministrada están exclusivamente en `backend/appsettings.Local.json`, excluido de Git y de la imagen Docker. La contraseña de acceso a la web es independiente de la contraseña de PostgreSQL. Cambia la contraseña del administrador en **Configuración**; el archivo local conserva el acceso inicial, no la contraseña que establezcas después.

## Qué puedes gestionar

1. **Vista general:** consultas reales, citas próximas y contenidos publicados.
2. **Consultas y clientes:** búsqueda, filtros, exportación CSV y edición de estado; notas públicas para el cliente y notas internas separadas.
3. **Agenda:** solicitudes por día, turnos próximos, confirmación y cancelación. Los horarios se interpretan en `America/Guayaquil`.
4. **Servicios:** crear, modificar, ordenar, publicar, ocultar y eliminar áreas de práctica.
5. **Vitrina legal:** artículos y videos propios o enlaces completos de Instagram/Reels, YouTube/Shorts, TikTok y LinkedIn; borradores, orden y temas. El feed carga seis publicaciones por página con Intersection Observer y un botón alternativo.
6. **Promociones:** títulos, etiquetas, texto y llamada a consulta, con publicación controlada.
7. **Biblioteca:** archivos JPG, PNG, WebP, MP4 y WebM, hasta 25 MB. Se almacenan bytes y metadatos en PostgreSQL de Supabase y se sirven con soporte HTTP Range. No se ha configurado un bucket S3/Storage: para eso se necesitarían las credenciales específicas de almacenamiento. Los archivos son contenido público, no expedientes privados.
8. **Configuración:** fotografía, textos, biografía, dirección, contacto, redes, días y horas disponibles, fechas cerradas y cambio de contraseña.
9. **Actividad e integraciones:** auditoría de cambios administrativos y catálogo de funciones.

El perfil profesional y las fotografías son los aportados por el usuario. Las áreas iniciales y los textos son contenido editable propuesto para el despacho; no se han inventado años de experiencia, títulos académicos, testimonios, cifras de éxito, honorarios ni teléfonos. No fue posible leer los perfiles sociales mediante consulta web. El feed incluye una bienvenida original, no videos ficticios: el administrador debe pegar los enlaces de sus publicaciones reales o subir sus videos.

## Andrea: asistente programada, sin IA

La conversación escrita utiliza reglas de intención en español y una secuencia de estados. No utiliza un LLM, embeddings, claves de OpenAI ni servicios de generación. Puede mostrar servicios y ubicación, buscar publicaciones, consultar horarios, registrar una consulta o solicitud de cita y consultar su seguimiento privado. No interpreta cuestiones jurídicas ni improvisa asesoría; dirige al abogado los asuntos que necesitan revisión.

Las solicitudes requieren revisión y aceptación del tratamiento de datos antes del envío. Se devuelve una referencia con una clave privada aleatoria. La misma clave y una clave de idempotencia permiten reintentar sin duplicar el registro. El cliente puede guardar el comprobante y consultar novedades; la página de seguimiento consulta cambios cada 15 segundos mientras está visible. **No se envían correos, SMS, mensajes de WhatsApp ni notificaciones cuando la web está cerrada.** Las novedades se muestran dentro del portal.

En navegadores que implementan WebMCP se registran seis herramientas mediante `document.modelContext` (con detección del API anterior). El chat usa el mismo registro de funciones cuando WebMCP no está disponible. No requiere flags para funcionar por escrito. No incluye reconocimiento de voz.

Además, la API expone **MCP Streamable HTTP** con el SDK oficial de C# en `/mcp`, protegido por `Authorization: Bearer MCP_API_KEY`. El token debe mantenerse en el cliente MCP autorizado o servidor, nunca incluirse en JavaScript público. Herramientas: `list_services`, `get_office`, `search_posts`, `check_availability`, `create_consultation`, `track_request`. No expone herramientas de administración ni permite listar solicitudes de clientes. Puede utilizarse desde un cliente de protocolo sin un modelo de IA.

Fuentes de implementación: [WebMCP, API imperativa](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [SDK MCP C#](https://github.com/modelcontextprotocol/csharp-sdk), [TLS de Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement).

## Base de datos y seguridad

- Migración versionada: `backend/Migrations/001_initial.sql`, aplicada al esquema separado `andrade_portal`; no modifica tablas ajenas.
- Diez tablas para configuración, contenido, usuarios administrativos, sesiones, consultas, historial, archivos, auditoría, migraciones y permisos temporales de carga.
- TLS `VerifyFull` con certificado CA de Supabase incluido en `backend/certs`.
- Todas las tablas del esquema tienen RLS activado y se revoca acceso a los roles públicos `anon` y `authenticated`. El backend accede mediante la conexión PostgreSQL suministrada. No se utiliza la clave anónima de Supabase en el navegador.
- Contraseñas PBKDF2-SHA512 con salt aleatoria, sesiones aleatorias con hash en base de datos, cookie HttpOnly/SameSite Strict (Secure en producción), limitación de peticiones y validación de origen.
- Validación de campos y firmas de archivo en servidor, consultas parametrizadas y URLs sociales permitidas explícitamente.
- Índice único para impedir doble ocupación de horario. Seguimiento mediante clave de 256 bits; el enlace usa un fragmento para evitar enviar la clave como parte de la URL al servidor.
- El servidor aplica migraciones pendientes al iniciar y comprueba sus hashes. Los datos iniciales solo se insertan durante el primer arranque, para respetar futuras ediciones y eliminaciones.

## Desarrollo y validación

Requisitos: Node.js 22.13+ y .NET SDK 9.0.

```powershell
# Terminal 1, desde backend (la configuración local ya está preparada)
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5080'
dotnet run --no-launch-profile

# Terminal 2, desde frontend
npm ci
npm run dev

# Construcción del frontend
npm run build

# Desde la raíz: suite contra los servidores locales y la DB conectada
dotnet build tests -o .local/test-runner -p:UseAppHost=false
dotnet .local/test-runner/IntegrationTests.dll (Get-Location).Path
```

Las pruebas crean registros identificados con un UUID único y los eliminan al finalizar. Comprueban acceso administrativo, CMS, publicación y paginación, archivos/rangos, reservas idempotentes y simultáneas, seguimiento, privacidad de notas, cancelación, MCP, RLS y rutas públicas. Son pruebas HTTP, de compilación y de integración; no sustituyen una revisión visual en todos los navegadores. Los reproductores externos también dependen de que cada publicación sea pública y permita inserción.

## Despliegue: Render y Vercel

Los archivos están preparados; no se ha publicado la plataforma ni conectado una cuenta de despliegue.

### 1. API en Render

Sube el repositorio privado a tu proveedor Git y crea un Blueprint con `render.yaml`. El servicio utiliza `backend/Dockerfile`; mantiene los archivos en Supabase y no depende del disco de Render para datos persistentes.

Completa en Render:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | URL PostgreSQL de Supabase con contraseña codificada para URL, sin espacios añadidos |
| `ADMIN_EMAIL` | Correo del administrador |
| `ADMIN_PASSWORD` | Contraseña inicial aleatoria de al menos 14 caracteres |
| `MCP_API_KEY` | Token aleatorio de al menos 32 caracteres |
| `ALLOWED_ORIGINS` | URL exacta del frontend Vercel; varias separadas por coma, sin barra final |
| `API_PUBLIC_URL` | URL HTTPS de esta API en Render, para subir archivos directamente |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ASPNETCORE_URLS` | `http://0.0.0.0:10000` |

El puerto del pooler es **5432 (sesión)**. El arranque aplica las migraciones pendientes. Comprueba `/api/health` antes de conectar el frontend. Si reutilizas la base ya migrada, la cuenta administrativa existente conserva su contraseña; `ADMIN_PASSWORD` solo crea usuarios que aún no existen.

### 2. Web en Vercel

Importa el mismo repositorio y selecciona **Root Directory: `frontend`** y **Framework: Next.js**. Se incluye `frontend/vercel.json`. Configura `API_INTERNAL_URL=https://TU-API.onrender.com` para la compilación y ejecución; publica nuevamente si cambia esa dirección. Todas las peticiones del navegador van al mismo origen `/api/*`; Next.js las redirige a la API. Las credenciales PostgreSQL nunca se configuran en Vercel.

Configura la URL definitiva de Vercel en `ALLOWED_ORIGINS` de Render. Para usar vistas previas, añade solo las URLs exactas autorizadas. El frontend espera HTTPS en producción.

Los archivos se suben directamente a la API en Render, sin atravesar las funciones de Vercel. El administrador solicita primero un permiso aleatorio de un solo uso, válido por dos minutos; CORS solo permite los orígenes autorizados. El servidor valida y guarda hasta 25 MB por archivo. `API_PUBLIC_URL` y `API_INTERNAL_URL` deben usar el mismo origen de API para que la política de seguridad del frontend permita la carga. Las peticiones normales continúan pasando por el proxy del mismo origen.

### 3. Antes de publicar

Revisa la biografía, áreas de servicio y horarios propuestos; completa teléfono/correo si los quieres públicos; carga videos reales y verifica sus permisos de inserción. Confirma los datos del aviso de privacidad del despacho. El portal no promete resultados legales ni confirma automáticamente una cita.
