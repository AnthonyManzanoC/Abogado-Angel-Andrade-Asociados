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
        Al solicitar una consulta recogemos tu nombre, teléfono, correo si lo
        proporcionas, área de interés, resumen del asunto, modalidad y horario
        solicitado. También registramos el consentimiento y el estado de la
        solicitud.
      </p>
      <h2>Para qué la utilizamos</h2>
      <p>
        Usamos estos datos para revisar tu solicitud, coordinar la atención y
        comunicarte novedades en este portal. El acceso administrativo está
        restringido al despacho. No utilices el formulario para enviar
        documentos de identidad, información bancaria ni detalles especialmente
        sensibles.
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
      <h2>Alcance del portal</h2>
      <p>
        El contenido es informativo. Enviar una solicitud no crea una relación
        abogado-cliente ni confirma una cita. El servicio, sus honorarios y
        condiciones se acuerdan directamente con el abogado.
      </p>
    </section>
  );
}
