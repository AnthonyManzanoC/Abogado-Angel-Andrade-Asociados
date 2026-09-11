import { getPublic } from '@/lib/api';
export const metadata = { title: 'Privacidad' };
export default async function Page() {
  const { settings: s } = await getPublic();
  return (
    <section className="wrap page-section legal-prose">
      <div className="eyebrow">TU INFORMACIÓN</div>
      <h1>Aviso de privacidad.</h1>
      <p>
        Este portal pertenece al despacho de Ángel Andrade Núñez, ubicado en{' '}
        {s.address || 'Edificio Alavama, calle Sucre y 5 de Junio'}, Babahoyo,
        Ecuador.
      </p>
      <h2>Información que compartes</h2>
      <p>
        Al solicitar una consulta recogemos tu nombre, teléfono, correo, área de
        interés, resumen del asunto, modalidad y horario solicitado. También
        registramos el consentimiento y el estado de la solicitud.
      </p>
      <h2>Para qué la utilizamos</h2>
      <p>
        Usamos estos datos para revisar tu solicitud, coordinar la atención y
        comunicarte novedades en este portal y mediante correos transaccionales
        enviados con Brevo. Brevo recibe el destinatario y el contenido del
        aviso, incluido el enlace privado; puede registrar aperturas y clics
        según la configuración de la cuenta. Para citas virtuales también se
        guarda la referencia de transferencia y la verificación del despacho. El
        acceso administrativo está restringido al despacho. No utilices el
        formulario para enviar documentos de identidad, información bancaria ni
        detalles especialmente sensibles.
      </p>
      <h2>Almacenamiento y acceso</h2>
      <p>
        Los registros se guardan en la base de datos PostgreSQL del despacho
        alojada en Supabase. El frontend y la API pueden estar alojados en
        proveedores de infraestructura externos. La clave privada de seguimiento
        permite consultar únicamente las novedades de tu solicitud; consérvala
        de forma segura.
      </p>
      <h2>Conservación y tus solicitudes</h2>
      <p>
        Puedes solicitar información sobre tus datos, su corrección o
        eliminación contactando al despacho presencialmente o mediante una
        consulta en este portal. El despacho revisará la petición y cualquier
        necesidad de conservación aplicable a la relación profesional.
      </p>
      <h2>Cookies y contenido externo</h2>
      <p>
        La administración utiliza una cookie de sesión necesaria para iniciar
        sesión. No se incorporan herramientas publicitarias ni de analítica. Los
        reproductores de redes sociales y el mapa se conectan con sus
        respectivos proveedores cuando los abres; se aplican también sus
        políticas.
      </p>
      <h2>La asistente del portal</h2>
      <p>
        La asistente ejecuta funciones programadas para ayudarte a consultar
        información, registrar solicitudes y revisar estados. No utiliza modelos
        de IA ni ofrece asesoría jurídica. El texto de la conversación permanece
        en esta sesión del navegador; los datos se envían al despacho cuando
        confirmas una solicitud.
      </p>
      <p>
        El dictado es opcional y requiere el permiso de micrófono. El navegador
        puede enviar el audio a su proveedor de reconocimiento de voz; el portal
        no almacena grabaciones. Revisa la transcripción antes de enviarla. La
        lectura de respuestas se activa y desactiva a tu elección.
      </p>
      <h2>Postulaciones al apoyo solidario</h2>
      <p>
        El formulario solicita contacto, ciudad, resumen del asunto y el
        contexto necesario para evaluar la necesidad de apoyo. Solo el despacho
        puede leer la postulación; el seguimiento privado muestra decisiones y
        mensajes, sin exponer el relato ni las notas internas. Las historias no
        se publican ni se convierten automáticamente en testimonios o casos de
        la web.
      </p>
      <p>
        Comparte solo información necesaria y evita documentos de identidad o
        datos identificables de terceros. Se conserva la aceptación de las
        condiciones de la convocatoria. Puedes retirar una postulación activa
        desde tu seguimiento y contactar al despacho para solicitar la revisión
        o eliminación de tus datos.
      </p>
      <h2>Alcance del portal</h2>
      <p>
        El contenido es informativo. Enviar una solicitud no crea una relación
        abogado-cliente ni confirma una cita. El servicio, sus honorarios y
        condiciones se acuerdan directamente con el abogado.
      </p>
    </section>
  );
}
