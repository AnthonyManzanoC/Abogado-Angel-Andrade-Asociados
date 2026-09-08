import Link from 'next/link';
import { ArrowUpRight, MapPin, Clock, Mail, Phone } from 'lucide-react';
import { getPublic } from '@/lib/api';
export const metadata = { title: 'Contacto y ubicación' };
export default async function Page() {
  const { settings: s } = await getPublic();
  const address = s.address || 'Edificio Alavama, calle Sucre y 5 de Junio';
  const map = encodeURIComponent(address + ', Babahoyo, Ecuador');
  return (
    <section className="wrap page-section">
      <div className="page-heading">
        <div className="eyebrow">ESTAMOS CERCA</div>
        <h1>
          Encontrémonos
          <br />
          en Babahoyo.
        </h1>
        <p>Un espacio para escuchar, conversar y definir el siguiente paso.</p>
      </div>
      <div className="contact-layout">
        <div className="form-panel">
          <div className="contact-item">
            <MapPin />
            <div>
              <h2>El despacho</h2>
              <p>
                {address}
                <br />
                {s.city || 'Babahoyo, Ecuador'}
              </p>
            </div>
          </div>
          <div className="contact-item">
            <Clock />
            <div>
              <h2>Atención</h2>
              <p>{s.hours || 'Con cita previa'}</p>
            </div>
          </div>
          {s.phone && (
            <div className="contact-item">
              <Phone />
              <div>
                <h2>Teléfono</h2>
                <a href={'tel:' + s.phone.replace(/[^+\d]/g, '')}>{s.phone}</a>
              </div>
            </div>
          )}
          {s.email && (
            <div className="contact-item">
              <Mail />
              <div>
                <h2>Correo</h2>
                <a href={'mailto:' + s.email}>{s.email}</a>
              </div>
            </div>
          )}
          <Link href="/consulta" className="btn gold">
            Agenda tu visita <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="map-panel">
          <iframe
            src={'https://www.google.com/maps?q=' + map + '&output=embed'}
            title="Mapa de ubicación del despacho en Babahoyo"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a
            className="map-link"
            href={'https://www.google.com/maps/search/?api=1&query=' + map}
            target="_blank"
            rel="noreferrer"
          >
            Ver indicaciones en Google Maps <ArrowUpRight size={17} />
          </a>
        </div>
      </div>
    </section>
  );
}
