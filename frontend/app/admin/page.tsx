import { AdminPortal } from '@/components/admin-portal';
export const metadata = {
  title: 'Administración del despacho',
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AdminPortal />;
}
