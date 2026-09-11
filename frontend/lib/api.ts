export type Content = {
  id: string;
  title: string;
  summary: string;
  description?: string;
  icon?: string;
  category?: string;
  url?: string;
  cover?: string;
  label?: string;
  cta?: string;
  kind?: string;
  active?: boolean;
  sortOrder?: number;
  createdAt?: string;
  [key: string]: any;
};
export type Settings = {
  name: string;
  heroTitle: string;
  heroDescription: string;
  heroImage: string;
  address: string;
  city: string;
  hours: string;
  phone: string;
  email: string;
  instagram: string;
  linkedin: string;
  biography: string;
  weekdays: number[];
  startHour: number;
  endHour: number;
  closedDates: string[];
  [key: string]: any;
};
export type PublicData = {
  settings: Settings;
  services: Content[];
  promotions: Content[];
  education?: Content[];
  achievements?: Content[];
  gallery?: Content[];
  cases?: Content[];
  unavailable?: boolean;
};
export const apiBase = process.env.API_INTERNAL_URL || 'http://127.0.0.1:5080';
export async function getPublic(): Promise<PublicData> {
  try {
    const r = await fetch(apiBase + '/api/public', {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw Error();
    return await r.json();
  } catch {
    return {
      settings: {} as Settings,
      services: [],
      promotions: [],
      unavailable: true,
    };
  }
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch('/api' + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      'X-Portal-Client': 'web',
      ...options.headers,
    },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok)
    throw Error(
      d.error || 'No se pudo completar la operación. Inténtalo nuevamente.',
    );
  return d;
}
export async function uploadMedia(file: File) {
  const ticket = await api('/admin/upload-ticket', { method: 'POST' });
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(ticket.url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + ticket.token,
      'X-Portal-Client': 'web',
    },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.error || 'No se pudo cargar el archivo. Reintenta la operación.',
    );
  return data;
}
