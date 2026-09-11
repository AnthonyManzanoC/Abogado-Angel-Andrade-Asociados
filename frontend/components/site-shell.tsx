'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Assistant } from './assistant';
import { whatsappLink } from '@/lib/contact';
import {
  ArrowUpRight,
  Menu,
  X,
  Camera as Instagram,
  BriefcaseBusiness as Linkedin,
} from 'lucide-react';
export function SiteShell({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings: any;
}) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const whatsapp = whatsappLink(settings.whatsapp);
  if (path.startsWith('/admin')) return <>{children}</>;
  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <header className="site-header">
        <div className="header-inner wrap">
          <Link href="/" className="brand" aria-label="Ángel Andrade, inicio">
            {settings.logoUrl ? (
              <img
                className="brand-logo"
                src={settings.logoUrl}
                alt="Logo del despacho"
              />
            ) : (
              <span className="monogram">
                A<span>A</span>
                <i />
              </span>
            )}
            <span className="brand-name">
              {settings.name || 'ÁNGEL ANDRADE'}
              <span>ABOGADO & ASESOR LEGAL</span>
            </span>
          </Link>
          <nav
            className={menu ? 'main-nav open' : 'main-nav'}
            aria-label="Navegación principal"
          >
            {[
              ['/', 'Inicio'],
              ['/firma', 'El abogado'],
              ['/servicios', 'Servicios'],
              ['/vitrina', 'Vitrina legal'],
              ['/casos', 'Casos'],
              ['/apoyo', 'Apoyo solidario'],
              ['/contacto', 'Contacto'],
            ].map(([href, label]) => (
              <Link
                href={href}
                key={href}
                onClick={() => setMenu(false)}
                className={path === href ? 'active' : ''}
              >
                {label}
                {href === '/vitrina' && <span className="nav-dot" />}
              </Link>
            ))}
          </nav>
          <Link href="/consulta" className="btn outline header-cta">
            Hablemos de tu caso <ArrowUpRight size={17} />
          </Link>
          <button
            className="menu-toggle icon-button"
            onClick={() => setMenu(!menu)}
            aria-label={menu ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menu}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer wrap">
        <div className="footer-top">
          <div>
            <Link href="/" className="footer-brand">
              {settings.name || 'Ángel Andrade Núñez'}
              <span>ABOGADO & ASESOR LEGAL</span>
            </Link>
            <p>
              Una relación de confianza.
              <br />
              Una estrategia para avanzar.
            </p>
          </div>
          <div>
            <span className="small-caps">VISÍTANOS</span>
            <p>
              {settings.address || 'Edificio Alavama, Sucre y 5 de Junio'}
              <br />
              {settings.city || 'Babahoyo, Ecuador'}
            </p>
            <Link href="/contacto" className="text-link">
              Cómo llegar <ArrowUpRight size={15} />
            </Link>
          </div>
          <div>
            <span className="small-caps">A TU ALCANCE</span>
            <Link href="/consulta">Solicitar una consulta</Link>
            <Link href="/seguimiento">Seguimiento de solicitud</Link>
            <Link href="/vitrina">Vitrina legal</Link>
          </div>
          <div>
            <span className="small-caps">CONECTEMOS</span>
            <a
              href={
                settings.instagram ||
                'https://www.instagram.com/abg.angelandrade/'
              }
              target="_blank"
              rel="noreferrer"
            >
              <Instagram size={16} /> Instagram <ArrowUpRight size={13} />
            </a>
            <a
              href={
                settings.linkedin ||
                'https://ec.linkedin.com/in/angel-andrade-nu%C3%B1ez-52a05b202'
              }
              target="_blank"
              rel="noreferrer"
            >
              <Linkedin size={16} /> LinkedIn <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Ángel Andrade Núñez. Todos los derechos
            reservados.
          </span>
          <div>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/admin">
              Acceso al despacho <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </footer>
      {whatsapp && (
        <a
          className="whatsapp-launch"
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          aria-label="Conversar directamente con el abogado por WhatsApp"
        >
          WhatsApp <ArrowUpRight size={18} />
        </a>
      )}
      <Assistant name={settings.assistantName || 'Alma'} />
    </>
  );
}
