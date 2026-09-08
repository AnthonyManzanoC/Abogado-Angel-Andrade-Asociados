import type { Metadata } from 'next';
import './globals.css';
import './portal.css';
import { SiteShell } from '@/components/site-shell';
import { getPublic } from '@/lib/api';
export const metadata: Metadata = {
  title: {
    default: 'Ángel Andrade Núñez | Abogado en Babahoyo',
    template: '%s | Ángel Andrade Núñez',
  },
  description:
    'Atención legal personal en Babahoyo, Ecuador. Conoce los servicios, solicita una consulta y consulta su seguimiento. Edificio Alavama, Sucre y 5 de Junio.',
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings } = await getPublic();
  return (
    <html lang="es" className="dark" data-scroll-behavior="smooth">
      <body>
        <SiteShell settings={settings}>{children}</SiteShell>
      </body>
    </html>
  );
}
