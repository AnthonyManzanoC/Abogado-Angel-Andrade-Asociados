'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  LayoutDashboard,
  Inbox,
  CalendarDays,
  BriefcaseBusiness,
  Video,
  Image as ImageIcon,
  Settings,
  LogOut,
  Plus,
  Search,
  Download,
  Upload,
  Save,
  Trash2,
  PenLine,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Megaphone,
  LockKeyhole,
  Activity,
  CheckCircle2,
  LoaderCircle,
} from 'lucide-react';
import { api, Content, uploadMedia } from '@/lib/api';
import {
  formatDate,
  localDate,
  statusLabels,
  toolDefinitions,
} from '@/lib/portal-tools';
import { Choice, Check } from './form-controls';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { ServiceIcon } from './service-icon';
import { serviceImages } from '@/lib/home-content';
import { EditorialAdmin } from './editorial-admin';
import { SolidarityAdmin } from './solidarity-admin';
import { PremiumSettings } from './premium-settings';
import { ClientUpdate } from './client-update';
import { NotificationAdmin } from './notification-admin';
const sections = [
  { id: 'overview', label: 'Vista general', icon: LayoutDashboard },
  { id: 'requests', label: 'Consultas y clientes', icon: Inbox },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'services', label: 'Servicios', icon: BriefcaseBusiness },
  { id: 'posts', label: 'Vitrina legal', icon: Video },
  { id: 'promotions', label: 'Promociones', icon: Megaphone },
  { id: 'editorial', label: 'Perfil y casos ganados', icon: ShieldCheck },
  { id: 'solidarity', label: 'Apoyo solidario', icon: Inbox },
  { id: 'media', label: 'Biblioteca multimedia', icon: ImageIcon },
  { id: 'settings', label: 'Configuración', icon: Settings },
  { id: 'activity', label: 'Actividad e integraciones', icon: Activity },
  { id: 'notifications', label: 'Notificaciones', icon: Inbox },
];
export function AdminPortal() {
  const router = useRouter();
  const [user, setUser] = useState<any>(undefined),
    [login, setLogin] = useState({ email: '', password: '' }),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState('overview'),
    [requests, setRequests] = useState<any[]>([]),
    [contents, setContents] = useState<Record<string, Content[]>>({
      services: [],
      posts: [],
      promotions: [],
    }),
    [settings, setSettings] = useState<any>({}),
    [media, setMedia] = useState<any[]>([]),
    [audit, setAudit] = useState<any[]>([]),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState('all'),
    [selected, setSelected] = useState<any>(null),
    [editor, setEditor] = useState<Content | null>(null),
    [deleting, setDeleting] = useState<Content | null>(null),
    [password, setPassword] = useState({
      currentPassword: '',
      newPassword: '',
      confirm: '',
    }),
    [agendaDate, setAgendaDate] = useState(''),
    [closedText, setClosedText] = useState('');
  const refresh = useCallback(async () => {
    const [r, s, p, pr, c, m, a] = await Promise.all([
      api('/admin/requests'),
      api('/admin/content/services'),
      api('/admin/content/posts'),
      api('/admin/content/promotions'),
      api('/admin/settings'),
      api('/admin/media'),
      api('/admin/audit'),
    ]);
    setRequests(r);
    setContents({ services: s, posts: p, promotions: pr });
    setSettings(c);
    setClosedText(c.closedDates.join(', '));
    setMedia(m);
    setAudit(a);
  }, []);
  useEffect(() => {
    setAgendaDate(localDate());
    api('/admin/me')
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  useEffect(() => {
    if (user) refresh().catch((e) => setError(e.message));
  }, [user, refresh]);
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible')
        api('/admin/requests')
          .then(setRequests)
          .catch(() => {});
    }, 20000);
    return () => clearInterval(id);
  }, [user]);
  async function action(fn: () => Promise<any>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    await action(
      async () =>
        setUser(
          await api('/admin/login', {
            method: 'POST',
            body: JSON.stringify(login),
          }),
        ),
      '',
    );
  }
  async function saveContent(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    await action(async () => {
      await api('/admin/content/' + tab + '/' + editor.id, {
        method: 'PUT',
        body: JSON.stringify(editor),
      });
      setEditor(null);
      await refresh();
    }, 'Contenido guardado. La web pública ya muestra los cambios publicados.');
  }
  async function upload(
    file: File,
    target?:
      | 'cover'
      | 'url'
      | 'heroImage'
      | 'logoUrl'
      | 'introVideoUrl'
      | 'introPoster'
      | 'buildingImage'
      | 'profileImage',
  ) {
    if (file.size > 25 * 1024 * 1024) {
      setError('El tamaño máximo por archivo es 25 MB.');
      return;
    }
    await action(async () => {
      const m = await uploadMedia(file);
      if (
        target &&
        [
          'heroImage',
          'logoUrl',
          'introVideoUrl',
          'introPoster',
          'buildingImage',
          'profileImage',
        ].includes(target)
      )
        setSettings((s: any) => ({ ...s, [target]: m.url }));
      else if (target) setEditor((s) => (s ? { ...s, [target]: m.url } : s));
      setMedia(await api('/admin/media'));
    }, 'Archivo guardado en Supabase.');
  }
  function openEditor(item?: Content) {
    setError('');
    setEditor(
      item
        ? { ...item }
        : {
            id: crypto.randomUUID(),
            title: '',
            summary: '',
            description: '',
            active: false,
            sortOrder: contents[tab].length,
            kind: 'article',
            category: 'El despacho',
            icon: 'document',
            cover: '',
            url: '',
            label: 'EN EL DESPACHO',
            cta: 'Solicitar información',
          },
    );
  }
  const filtered = requests.filter(
    (r) =>
      (status === 'all' || r.status === status) &&
      (r.name + ' ' + r.reference + ' ' + r.phone + ' ' + r.message)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const upcoming = requests
    .filter(
      (r) =>
        r.appointmentAt &&
        new Date(r.appointmentAt) > new Date() &&
        !['cancelado', 'completado'].includes(r.status),
    )
    .sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt));
  function exportCsv() {
    const esc = (value: any) => {
      let text = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = [
      [
        'Referencia',
        'Nombre',
        'Teléfono',
        'Correo',
        'Servicio',
        'Modalidad',
        'Cita',
        'Estado',
        'Creada',
      ],
      ...filtered.map((r) => [
        r.reference,
        r.name,
        r.phone,
        r.email,
        r.serviceId,
        r.mode,
        r.appointmentAt,
        statusLabels[r.status],
        r.createdAt,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ['\ufeff' + rows.map((row) => row.map(esc).join(',')).join('\r\n')],
        { type: 'text/csv;charset=utf-8' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'consultas-andrade-' + localDate() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  function navigate(id: string) {
    setTab(id);
    setQuery('');
    setStatus('all');
    setError('');
    setNotice('');
  }
  function requestsTable(rows: any[]) {
    return rows.length ? (
      <div className="admin-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente / referencia</TableHead>
              <TableHead>Consulta</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>
                <span className="sr-only">Ver</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="request-row">
                <TableCell>
                  <button
                    onClick={() => setSelected({ ...r })}
                    className="table-client"
                  >
                    <strong>{r.name}</strong>
                    <span>{r.reference}</span>
                  </button>
                </TableCell>
                <TableCell>
                  {contents.services.find((s) => s.id === r.serviceId)?.title ||
                    'Orientación inicial'}
                  <span className="table-secondary">{r.mode}</span>
                </TableCell>
                <TableCell>
                  {formatDate(r.appointmentAt || r.createdAt)}
                  <span className="table-secondary">
                    {r.appointmentAt ? 'Horario solicitado' : 'Recibida'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={'status-badge ' + r.status}>
                    {statusLabels[r.status]}
                  </span>
                </TableCell>
                <TableCell>
                  <button
                    className="icon-button"
                    onClick={() => setSelected({ ...r })}
                    aria-label={'Ver solicitud de ' + r.name}
                  >
                    <ChevronRight size={18} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    ) : (
      <div className="admin-empty">
        <Inbox size={32} strokeWidth={1.3} />
        <h3>Todo en orden por aquí.</h3>
        <p>Las solicitudes recibidas aparecerán en esta bandeja.</p>
      </div>
    );
  }
  if (user === undefined)
    return (
      <div className="admin-loading">
        <LoaderCircle className="spin" /> Verificando acceso…
      </div>
    );
  if (!user)
    return (
      <div className="admin-login">
        <div className="login-visual">
          <img src="/images/angel-andrade.jpg" alt="Ángel Andrade Núñez" />
          <div>
            <span className="eyebrow">ÁNGEL ANDRADE NÚÑEZ</span>
            <h1>
              El despacho.
              <br />
              En tus manos.
            </h1>
            <p>Una visión clara para acompañar cada consulta.</p>
          </div>
        </div>
        <div className="login-form">
          <Link href="/" className="text-link">
            Volver a la web <ArrowUpRight size={16} />
          </Link>
          <span className="large-service-icon">
            <LockKeyhole size={27} />
          </span>
          <span className="eyebrow">ACCESO PRIVADO</span>
          <h2>Bienvenido al despacho.</h2>
          <p className="muted">Inicia sesión para gestionar tu plataforma.</p>
          <form onSubmit={signIn}>
            <label className="field-label">
              Correo de administrador
              <input
                type="email"
                className="field"
                autoComplete="username"
                value={login.email}
                onChange={(e) => setLogin({ ...login, email: e.target.value })}
                required
              />
            </label>
            <label className="field-label">
              Contraseña
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                value={login.password}
                onChange={(e) =>
                  setLogin({ ...login, password: e.target.value })
                }
                required
              />
            </label>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <button className="btn gold" disabled={busy}>
              {busy ? 'Ingresando…' : 'Entrar al despacho'}
              <ArrowUpRight size={17} />
            </button>
          </form>
          <p className="form-note">
            <ShieldCheck size={16} /> Acceso protegido. Solo personal
            autorizado.
          </p>
        </div>
      </div>
    );
  return (
    <SidebarProvider>
      <Sidebar className="admin-sidebar">
        <SidebarHeader>
          <Link href="/" className="admin-brand">
            <span className="monogram">
              A<span>A</span>
            </span>
            <span>
              ANDRADE<small>GESTIÓN DEL DESPACHO</small>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Tu espacio de trabajo</SidebarGroupLabel>
            <SidebarMenu>
              {sections.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={tab === item.id}
                    onClick={() => navigate(item.id)}
                    className="admin-nav-button"
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                    {item.id === 'requests' &&
                      requests.some((r) => r.status === 'recibido') && (
                        <span className="nav-count">
                          {
                            requests.filter((r) => r.status === 'recibido')
                              .length
                          }
                        </span>
                      )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <a
            className="admin-public-link"
            href="/"
            target="_blank"
            rel="noreferrer"
          >
            Ver sitio público <ArrowUpRight size={16} />
          </a>
          <div className="admin-user">
            <span className="admin-avatar">AA</span>
            <div>
              <strong>Administración</strong>
              <small>{user.email}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Cerrar sesión"
              onClick={() =>
                action(async () => {
                  await api('/admin/logout', { method: 'POST' });
                  setUser(null);
                  setLogin({ email: '', password: '' });
                }, '')
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="admin-main">
        <header className="admin-topbar">
          <div>
            <SidebarTrigger />
            <span>
              Despacho /{' '}
              <strong>{sections.find((s) => s.id === tab)?.label}</strong>
            </span>
          </div>
          <span className="admin-connection">
            <span className="status-dot" /> Sesión activa
          </span>
        </header>
        <div className="admin-content">
          <div className="admin-heading">
            <div>
              <span className="eyebrow">
                {new Intl.DateTimeFormat('es-EC', {
                  dateStyle: 'long',
                  timeZone: 'America/Guayaquil',
                }).format(new Date())}
              </span>
              <h1>
                {tab === 'overview'
                  ? 'Tu despacho, en perspectiva.'
                  : sections.find((s) => s.id === tab)?.label}
              </h1>
              <p>
                {tab === 'overview'
                  ? 'Cada consulta es el inicio de una relación de confianza.'
                  : tab === 'requests'
                    ? 'Atiende consultas y comparte los siguientes pasos con cada cliente.'
                    : tab === 'agenda'
                      ? 'Organiza las solicitudes de cita y confirma la atención.'
                      : tab === 'posts'
                        ? 'Publica videos, enlaces de redes y artículos en la vitrina.'
                        : tab === 'services'
                          ? 'Define los servicios que tus clientes encuentran en la web.'
                          : tab === 'promotions'
                            ? 'Destaca novedades y campañas desde tu página pública.'
                            : tab === 'media'
                              ? 'Imágenes y videos disponibles para tus publicaciones.'
                              : tab === 'settings'
                                ? 'Tu identidad, contacto y disponibilidad.'
                                : 'Historial del despacho y funciones conectadas.'}
              </p>
            </div>
            <div className="button-row">
              <button
                className="icon-button"
                aria-label="Actualizar datos"
                disabled={busy}
                onClick={() => action(refresh, 'Datos actualizados.')}
              >
                <RefreshCw size={18} />
              </button>
              {['services', 'posts', 'promotions'].includes(tab) && (
                <button className="btn gold" onClick={() => openEditor()}>
                  <Plus size={17} /> Crear{' '}
                  {tab === 'services'
                    ? 'servicio'
                    : tab === 'posts'
                      ? 'publicación'
                      : 'promoción'}
                </button>
              )}
              {tab === 'requests' && (
                <button className="btn outline" onClick={exportCsv}>
                  <Download size={17} /> Exportar CSV
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="success-message" role="status">
              <CheckCircle2 size={17} />
              {notice}
            </div>
          )}
          {tab === 'overview' && (
            <>
              <div className="stats-grid">
                {[
                  [
                    Inbox,
                    'Consultas recibidas',
                    requests.length,
                    'Todas las solicitudes',
                  ],
                  [
                    CalendarDays,
                    'Citas próximas',
                    upcoming.length,
                    'Pendientes y confirmadas',
                  ],
                  [
                    Video,
                    'En la vitrina',
                    contents.posts.filter((p) => p.active).length,
                    'Publicaciones visibles',
                  ],
                  [
                    BriefcaseBusiness,
                    'Servicios activos',
                    contents.services.filter((p) => p.active).length,
                    'Áreas de atención',
                  ],
                ].map(([Icon, title, value, caption]: any) => (
                  <div className="stat-card" key={title}>
                    <div>
                      <span>{title}</span>
                      <Icon size={18} />
                    </div>
                    <strong>{value}</strong>
                    <p>{caption}</p>
                  </div>
                ))}
              </div>
              <div className="overview-grid">
                <section className="admin-panel">
                  <div className="panel-heading">
                    <h2>Últimas consultas</h2>
                    <button
                      className="text-link"
                      onClick={() => navigate('requests')}
                    >
                      Ver todas <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {requestsTable(requests.slice(0, 5))}
                </section>
                <section className="admin-panel agenda-summary">
                  <div className="panel-heading">
                    <h2>En tu agenda</h2>
                    <CalendarDays size={19} />
                  </div>
                  {upcoming.slice(0, 4).map((r) => (
                    <button
                      className="agenda-mini"
                      key={r.id}
                      onClick={() => setSelected({ ...r })}
                    >
                      <span>
                        {new Intl.DateTimeFormat('es-EC', {
                          day: '2-digit',
                          timeZone: 'America/Guayaquil',
                        }).format(new Date(r.appointmentAt))}
                        <small>
                          {new Intl.DateTimeFormat('es-EC', {
                            month: 'short',
                            timeZone: 'America/Guayaquil',
                          }).format(new Date(r.appointmentAt))}
                        </small>
                      </span>
                      <div>
                        <h3>{r.name}</h3>
                        <p>{formatDate(r.appointmentAt)}</p>
                        <span className={'status-badge ' + r.status}>
                          {statusLabels[r.status]}
                        </span>
                      </div>
                    </button>
                  ))}
                  {upcoming.length === 0 && (
                    <div className="admin-empty">
                      <CalendarDays size={30} />
                      <p>Tu próxima cita aparecerá aquí.</p>
                    </div>
                  )}
                  <button
                    className="text-link"
                    onClick={() => navigate('agenda')}
                  >
                    Abrir agenda <ArrowUpRight size={15} />
                  </button>
                </section>
              </div>
              <div className="admin-bottom-callout">
                <div className="assistant-symbol">
                  <Video />
                </div>
                <div>
                  <h2>Tu conocimiento merece su propio espacio.</h2>
                  <p>
                    Mantén la vitrina al día con publicaciones y videos del
                    despacho.
                  </p>
                </div>
                <button
                  className="btn outline"
                  onClick={() => navigate('posts')}
                >
                  Gestionar vitrina <ArrowUpRight size={16} />
                </button>
              </div>
            </>
          )}
          {tab === 'requests' && (
            <section className="admin-panel">
              <div className="admin-filters">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    placeholder="Buscar nombre, referencia o consulta…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Buscar solicitudes"
                  />
                </div>
                <Choice
                  label="Filtrar estado"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'all', label: 'Todos los estados' },
                    ...Object.entries(statusLabels).map(([value, label]) => ({
                      value,
                      label,
                    })),
                  ]}
                />
                <span className="muted">{filtered.length} solicitudes</span>
              </div>
              {requestsTable(filtered)}
              <p className="form-note panel-padding">
                Se muestran las 500 solicitudes más recientes. Las notas
                internas solo son visibles en administración.
              </p>
            </section>
          )}
          {tab === 'agenda' && (
            <>
              <div className="admin-panel agenda-controls">
                <label className="field-label">
                  Ver día
                  <input
                    className="field"
                    type="date"
                    value={agendaDate}
                    onChange={(e) => setAgendaDate(e.target.value)}
                  />
                </label>
                <div>
                  <span className="small-caps">ZONA HORARIA</span>
                  <p>America/Guayaquil · UTC−5</p>
                </div>
                <button
                  className="btn outline"
                  onClick={() => navigate('settings')}
                >
                  Configurar disponibilidad <Settings size={16} />
                </button>
              </div>
              <div className="agenda-day">
                <div className="panel-heading">
                  <h2>Solicitudes para este día</h2>
                </div>
                {requestsTable(
                  requests
                    .filter(
                      (r) =>
                        r.appointmentAt &&
                        new Intl.DateTimeFormat('en-CA', {
                          timeZone: 'America/Guayaquil',
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        }).format(new Date(r.appointmentAt)) === agendaDate,
                    )
                    .sort((a, b) =>
                      a.appointmentAt.localeCompare(b.appointmentAt),
                    ),
                )}
              </div>
              <section className="admin-panel">
                <div className="panel-heading">
                  <h2>Próximas citas</h2>
                  <span className="muted">{upcoming.length} en agenda</span>
                </div>
                {requestsTable(upcoming)}
              </section>
            </>
          )}
          {['services', 'posts', 'promotions'].includes(tab) && (
            <>
              <div className="admin-content-grid">
                {contents[tab].map((item) => (
                  <div className="admin-content-card" key={item.id}>
                    {tab === 'posts' && (
                      <div className="admin-card-image">
                        {item.cover ? (
                          <img src={item.cover} alt="" />
                        ) : (
                          <Video size={32} />
                        )}
                        <span className="feed-format">{item.kind}</span>
                      </div>
                    )}
                    <div className="admin-card-body">
                      <div className="card-meta">
                        <span
                          className={
                            item.active
                              ? 'status-badge confirmado'
                              : 'status-badge'
                          }
                        >
                          {item.active ? (
                            <Eye size={12} />
                          ) : (
                            <EyeOff size={12} />
                          )}{' '}
                          {item.active ? 'Publicado' : 'Borrador'}
                        </span>
                        <span className="muted">Orden {item.sortOrder}</span>
                      </div>
                      {tab === 'services' && (
                        <span className="large-service-icon">
                          <ServiceIcon name={item.icon} />
                        </span>
                      )}
                      <h2>{item.title}</h2>
                      <p>{item.summary}</p>
                      <div className="admin-card-actions">
                        <button
                          className="text-link"
                          onClick={() => openEditor(item)}
                        >
                          <PenLine size={15} /> Editar
                        </button>
                        <button
                          className="icon-button danger-text"
                          aria-label={'Eliminar ' + item.title}
                          onClick={() => setDeleting(item)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {contents[tab].length === 0 && (
                <div className="admin-empty large">
                  <Plus size={34} />
                  <h2>
                    {tab === 'promotions'
                      ? 'Tu próxima campaña empieza aquí.'
                      : 'Crea el primer contenido.'}
                  </h2>
                  <p>Prepara un borrador y publícalo cuando esté listo.</p>
                  <button className="btn gold" onClick={() => openEditor()}>
                    Crear ahora
                  </button>
                </div>
              )}
            </>
          )}
          {tab === 'editorial' && <EditorialAdmin />}
          {tab === 'solidarity' && <SolidarityAdmin />}
          {tab === 'media' && (
            <>
              <label className="upload-zone">
                <Upload size={30} />
                <h2>Sube contenido a tu biblioteca.</h2>
                <p>JPG, PNG, WebP, MP4 o WebM · Máximo 25 MB por archivo</p>
                <span className="btn outline">Seleccionar archivo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    if (e.target.files?.[0]) upload(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <p className="form-note">
                Estos archivos se utilizan como contenido público de la web. Los
                bytes y metadatos se conservan en PostgreSQL de Supabase.
              </p>
              <div className="media-grid">
                {media.map((m) => (
                  <div className="media-card" key={m.id}>
                    {m.contentType.startsWith('image/') ? (
                      <img src={m.url} alt={m.name} />
                    ) : (
                      <video src={m.url} controls preload="metadata" />
                    )}
                    <div>
                      <h3>{m.name}</h3>
                      <p>
                        {(m.size / 1024 / 1024).toFixed(2)} MB · {m.contentType}
                      </p>
                      <button
                        className="text-link"
                        onClick={() =>
                          action(
                            async () => navigator.clipboard.writeText(m.url),
                            'Dirección del archivo copiada.',
                          )
                        }
                      >
                        Copiar dirección
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'settings' && settings.name && (
            <div className="settings-layout">
              <form
                className="admin-panel settings-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  action(async () => {
                    await api('/admin/settings', {
                      method: 'PUT',
                      body: JSON.stringify({
                        ...settings,
                        closedDates: closedText
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }),
                    });
                    await refresh();
                    router.refresh();
                  }, 'Configuración guardada. La web y la asistente usan los nuevos datos.');
                }}
              >
                <h2>Identidad y contenido público</h2>
                {[
                  ['name', 'Nombre profesional'],
                  ['heroTitle', 'Título principal'],
                  ['heroDescription', 'Descripción principal'],
                  ['biography', 'Biografía'],
                  ['address', 'Dirección'],
                  ['city', 'Ciudad y país'],
                  ['hours', 'Texto del horario'],
                  ['phone', 'Teléfono público'],
                  ['email', 'Correo público'],
                  ['instagram', 'Perfil de Instagram'],
                  ['linkedin', 'Perfil de LinkedIn'],
                ].map(([key, label]) => (
                  <label className="field-label" key={key}>
                    {label}
                    {['heroTitle', 'heroDescription', 'biography'].includes(
                      key,
                    ) ? (
                      <textarea
                        className="field"
                        rows={key === 'biography' ? 6 : 3}
                        value={settings[key] || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, [key]: e.target.value })
                        }
                        required
                      />
                    ) : (
                      <input
                        className="field"
                        type={key === 'email' ? 'email' : 'text'}
                        value={settings[key] || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, [key]: e.target.value })
                        }
                      />
                    )}
                  </label>
                ))}
                <label className="field-label">
                  Fotografía principal
                  <Choice
                    label="Fotografía principal"
                    value={settings.heroImage}
                    onChange={(v) => setSettings({ ...settings, heroImage: v })}
                    options={[
                      {
                        value: '/images/angel-andrade.jpg',
                        label: 'Retrato profesional original',
                      },
                      ...media
                        .filter((m) => m.contentType.startsWith('image/'))
                        .map((m) => ({ value: m.url, label: m.name })),
                    ]}
                  />
                </label>
                <PremiumSettings
                  settings={settings}
                  setSettings={setSettings}
                  media={media}
                  upload={upload}
                  busy={busy}
                />
                <h2 className="settings-divider">Disponibilidad para citas</h2>
                <p className="muted">
                  Turnos de una hora; solicitudes desde una hora de anticipación
                  hasta 60 días.
                </p>
                <div className="weekdays">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(
                    (day, i) => (
                      <Check
                        key={day}
                        checked={settings.weekdays.includes(i)}
                        onChange={(v) =>
                          setSettings({
                            ...settings,
                            weekdays: v
                              ? [...settings.weekdays, i]
                              : settings.weekdays.filter(
                                  (d: number) => d !== i,
                                ),
                          })
                        }
                      >
                        {day}
                      </Check>
                    ),
                  )}
                </div>
                <div className="form-row">
                  <label className="field-label">
                    Hora inicial (0–22)
                    <input
                      className="field"
                      type="number"
                      min={0}
                      max={22}
                      required
                      value={settings.startHour}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          startHour: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Hora de cierre (1–23)
                    <input
                      className="field"
                      type="number"
                      min={1}
                      max={23}
                      required
                      value={settings.endHour}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          endHour: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <label className="field-label">
                  Días sin atención
                  <textarea
                    className="field"
                    value={closedText}
                    onChange={(e) => setClosedText(e.target.value)}
                    placeholder="2026-12-25, 2027-01-01"
                    rows={2}
                  />
                  <span className="form-note">
                    Fechas AAAA-MM-DD separadas por comas. Las citas existentes
                    deben gestionarse en la agenda.
                  </span>
                </label>
                <button className="btn gold" disabled={busy}>
                  <Save size={17} /> Guardar configuración
                </button>
              </form>
              <div>
                <form
                  className="admin-panel settings-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (password.newPassword !== password.confirm) {
                      setError('Las contraseñas nuevas no coinciden.');
                      return;
                    }
                    action(async () => {
                      await api('/admin/password', {
                        method: 'POST',
                        body: JSON.stringify(password),
                      });
                      setUser(null);
                      setLogin({ email: '', password: '' });
                    }, 'Contraseña actualizada. Inicia sesión nuevamente.');
                  }}
                >
                  <LockKeyhole className="gold-text" />
                  <h2>Protege tu acceso.</h2>
                  <p className="muted">
                    Al cambiar tu contraseña se cierran todas las sesiones.
                  </p>
                  {[
                    ['currentPassword', 'Contraseña actual'],
                    ['newPassword', 'Nueva contraseña'],
                    ['confirm', 'Confirmar nueva contraseña'],
                  ].map(([key, label]) => (
                    <label className="field-label" key={key}>
                      {label}
                      <input
                        type="password"
                        className="field"
                        value={(password as any)[key]}
                        required
                        minLength={key === 'currentPassword' ? 1 : 14}
                        autoComplete={
                          key === 'currentPassword'
                            ? 'current-password'
                            : 'new-password'
                        }
                        onChange={(e) =>
                          setPassword({ ...password, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <p className="form-note">Usa al menos 14 caracteres.</p>
                  <button className="btn outline" disabled={busy}>
                    Actualizar contraseña
                  </button>
                </form>
                <div className="notice">
                  El teléfono, correo, biografía y servicios iniciales son
                  editables. Revisa la información del despacho antes de
                  publicar el sitio.
                </div>
              </div>
            </div>
          )}
          {tab === 'notifications' && <NotificationAdmin />}
          {tab === 'activity' && (
            <>
              <section className="admin-panel integration-panel">
                <div className="panel-heading">
                  <h2>
                    {settings.assistantName || 'Alma'} · Asistente del despacho
                  </h2>
                  <span className="status-badge confirmado">
                    Funciones conectadas
                  </span>
                </div>
                <p>
                  La asistente ejecuta las mismas funciones del portal sin un
                  modelo de IA. WebMCP se registra en los navegadores
                  compatibles; el chat funciona también en los demás.
                </p>
                <div className="tools-grid">
                  {toolDefinitions.map((t) => (
                    <div key={t.name}>
                      <CheckCircle2 size={17} />
                      <div>
                        <strong>{t.name}</strong>
                        <p>{t.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="form-note">
                  La API dispone de un servidor MCP en /mcp, protegido por token
                  de integración. Las credenciales se configuran exclusivamente
                  en el servidor.
                </p>
              </section>
              <section className="admin-panel">
                <div className="panel-heading">
                  <h2>Actividad reciente</h2>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Acción</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell>{a.action}</TableCell>
                        <TableCell>{a.target}</TableCell>
                        <TableCell>{a.actor}</TableCell>
                        <TableCell>{formatDate(a.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {audit.length === 0 && (
                  <div className="admin-empty">
                    Las acciones administrativas aparecerán aquí.
                  </div>
                )}
              </section>
              <NotificationAdmin />
            </>
          )}
        </div>
      </SidebarInset>
      <Sheet
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      >
        <SheetContent className="request-sheet">
          {selected && (
            <>
              <SheetTitle>Consulta de {selected.name}</SheetTitle>
              <SheetDescription>
                {selected.reference} · {formatDate(selected.createdAt)}
              </SheetDescription>
              <div className="request-contact">
                <strong>{selected.phone}</strong>
                {selected.email && <span>{selected.email}</span>}
                <span>
                  {selected.mode}
                  {selected.appointmentAt
                    ? ' · ' + formatDate(selected.appointmentAt)
                    : ''}
                </span>
              </div>
              <div className="client-message">
                <span className="small-caps">MENSAJE DEL CLIENTE</span>
                <p className="pre-line">{selected.message}</p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  action(async () => {
                    await api('/admin/requests/' + selected.id, {
                      method: 'PUT',
                      body: JSON.stringify(selected),
                    });
                    setSelected(null);
                    await refresh();
                  }, 'Solicitud actualizada. El cliente verá la novedad en su seguimiento.');
                }}
              >
                <label className="field-label">
                  Estado
                  <Choice
                    label="Estado de la solicitud"
                    value={selected.status}
                    onChange={(v) => setSelected({ ...selected, status: v })}
                    options={Object.entries(statusLabels)
                      .filter(([key]) =>
                        [
                          'recibido',
                          'revision',
                          'aprobado',
                          'pendiente_pago',
                          'confirmado',
                          'completado',
                          'cancelado',
                        ].includes(key),
                      )
                      .map(([value, label]) => ({ value, label }))}
                  />
                </label>
                {selected.mode === 'virtual' && selected.appointmentAt && (
                  <div className="payment-panel">
                    <h3>Pago y videollamada</h3>
                    <p>
                      {selected.paymentTest
                        ? 'DE PRUEBA · no admite pagos reales'
                        : `USD ${Number(selected.paymentAmount || 0).toFixed(2)} · ${selected.paymentStatus}`}
                    </p>
                    {selected.paymentReference && (
                      <p className="pre-line">
                        Referencia enviada: {selected.paymentReference}
                      </p>
                    )}
                    {selected.paymentVerifiedBy && (
                      <p className="form-note">
                        Verificado por {selected.paymentVerifiedBy} ·{' '}
                        {formatDate(selected.paymentVerifiedAt)}
                      </p>
                    )}
                    <label className="field-label">
                      Enlace de Google Meet o Zoom
                      <input
                        className="field"
                        type="url"
                        value={selected.meetingUrl || ''}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            meetingUrl: e.target.value,
                          })
                        }
                        placeholder="https://meet.google.com/…"
                      />
                    </label>
                    {selected.paymentStatus !== 'verificado' &&
                      !['cancelado', 'completado'].includes(
                        selected.status,
                      ) && (
                        <>
                          <label className="field-label">
                            Referencia comprobada en el banco
                            <input
                              className="field"
                              value={selected.verificationNote || ''}
                              maxLength={500}
                              onChange={(e) =>
                                setSelected({
                                  ...selected,
                                  verificationNote: e.target.value,
                                })
                              }
                              placeholder="Transacción, valor y fecha del ingreso"
                            />
                          </label>
                          <Check
                            checked={!!selected.verifyPayment}
                            onChange={(v) =>
                              setSelected({ ...selected, verifyPayment: v })
                            }
                          >
                            Comprobé el ingreso y el valor en la cuenta bancaria
                            del despacho.
                          </Check>
                          <button
                            type="button"
                            className="btn gold"
                            disabled={
                              busy ||
                              selected.paymentTest ||
                              !selected.verifyPayment ||
                              !selected.meetingUrl ||
                              (selected.verificationNote || '').length < 8
                            }
                            onClick={() =>
                              action(async () => {
                                await api('/admin/requests/' + selected.id, {
                                  method: 'PUT',
                                  body: JSON.stringify({
                                    ...selected,
                                    status: 'confirmado',
                                  }),
                                });
                                setSelected(null);
                                await refresh();
                              }, 'Pago verificado y cita agendada. Se generaron avisos para el cliente y el administrador.')
                            }
                          >
                            Verificar pago y agendar
                          </button>
                        </>
                      )}
                    <p className="form-note">
                      Una referencia o captura del cliente no acredita el pago.
                      Verifica el ingreso en el banco. Crea el enlace en tu
                      cuenta de Meet o Zoom y pégalo aquí.
                    </p>
                  </div>
                )}
                <label className="field-label">
                  Novedad para el cliente
                  <textarea
                    className="field"
                    rows={4}
                    value={selected.publicNote}
                    maxLength={2000}
                    onChange={(e) =>
                      setSelected({ ...selected, publicNote: e.target.value })
                    }
                    placeholder="Escribe los siguientes pasos o la confirmación de la cita."
                  />
                </label>
                <p className="form-note">
                  Este mensaje se muestra en el seguimiento privado del cliente.
                </p>
                <label className="field-label">
                  Notas internas
                  <textarea
                    className="field"
                    rows={4}
                    value={selected.privateNote}
                    maxLength={4000}
                    onChange={(e) =>
                      setSelected({ ...selected, privateNote: e.target.value })
                    }
                    placeholder="Solo visibles para administración."
                  />
                </label>
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn gold" disabled={busy}>
                  <Save size={17} /> Guardar y actualizar seguimiento
                </button>
              </form>
              <ClientUpdate
                id={selected.id}
                updatedAt={selected.updatedAt}
                onSaved={() => {
                  setSelected(null);
                  setNotice(
                    'Novedad guardada y avisos preparados para ambas partes.',
                  );
                  void refresh();
                }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!editor}
        onOpenChange={(v) => {
          if (!v) setEditor(null);
        }}
      >
        <DialogContent className="editor-dialog">
          {editor && (
            <>
              <DialogTitle>
                Editar{' '}
                {tab === 'posts'
                  ? 'publicación'
                  : tab === 'services'
                    ? 'servicio'
                    : 'promoción'}
              </DialogTitle>
              <DialogDescription>
                Guarda como borrador o activa la publicación para mostrarla en
                la web.
              </DialogDescription>
              <form onSubmit={saveContent}>
                <label className="field-label">
                  Título
                  <input
                    className="field"
                    value={editor.title}
                    required
                    minLength={3}
                    maxLength={160}
                    onChange={(e) =>
                      setEditor({ ...editor, title: e.target.value })
                    }
                  />
                </label>
                <label className="field-label">
                  Resumen
                  <textarea
                    className="field"
                    value={editor.summary}
                    required
                    minLength={5}
                    maxLength={400}
                    rows={2}
                    onChange={(e) =>
                      setEditor({ ...editor, summary: e.target.value })
                    }
                  />
                </label>
                {tab === 'posts' && (
                  <>
                    <div className="form-row">
                      <label className="field-label">
                        Formato
                        <Choice
                          label="Formato"
                          value={editor.kind || 'article'}
                          onChange={(v) =>
                            setEditor({ ...editor, kind: v, url: '' })
                          }
                          options={[
                            { value: 'article', label: 'Artículo / novedad' },
                            {
                              value: 'instagram',
                              label: 'Instagram Post / Reel',
                            },
                            { value: 'youtube', label: 'YouTube / Shorts' },
                            { value: 'tiktok', label: 'TikTok' },
                            { value: 'linkedin', label: 'LinkedIn' },
                            { value: 'video', label: 'Video subido' },
                          ]}
                        />
                      </label>
                      <label className="field-label">
                        Tema
                        <Choice
                          label="Tema"
                          value={editor.category || 'El despacho'}
                          onChange={(v) =>
                            setEditor({ ...editor, category: v })
                          }
                          options={[
                            'El despacho',
                            'Civil',
                            'Familia',
                            'Laboral',
                            'Negocios',
                            'Actualidad',
                          ].map((v) => ({ value: v, label: v }))}
                        />
                      </label>
                    </div>
                    {editor.kind !== 'article' && (
                      <label className="field-label">
                        {editor.kind === 'video'
                          ? 'Video de la biblioteca'
                          : 'URL de la publicación'}
                        {editor.kind === 'video' ? (
                          <>
                            <Choice
                              label="Video de la biblioteca"
                              value={editor.url || ''}
                              onChange={(v) => setEditor({ ...editor, url: v })}
                              options={[
                                { value: '', label: 'Selecciona un video' },
                                ...media
                                  .filter((m) =>
                                    m.contentType.startsWith('video/'),
                                  )
                                  .map((m) => ({
                                    value: m.url,
                                    label: m.name,
                                  })),
                              ]}
                            />
                            <label className="upload-inline">
                              <Upload size={15} /> Subir video (hasta 25 MB)
                              <input
                                type="file"
                                accept="video/mp4,video/webm"
                                disabled={busy}
                                onChange={(e) => {
                                  if (e.target.files?.[0])
                                    upload(e.target.files[0], 'url');
                                }}
                              />
                            </label>
                          </>
                        ) : (
                          <input
                            className="field"
                            type="url"
                            required
                            value={editor.url || ''}
                            onChange={(e) =>
                              setEditor({ ...editor, url: e.target.value })
                            }
                            placeholder="https://www.instagram.com/reel/…"
                          />
                        )}
                        <span className="form-note">
                          Utiliza el enlace completo de una publicación pública.
                          Las restricciones de la red social pueden impedir la
                          reproducción.
                        </span>
                      </label>
                    )}
                  </>
                )}
                {(tab !== 'posts' || editor.kind === 'article') && (
                  <label className="field-label">
                    Contenido
                    <textarea
                      className="field"
                      value={editor.description || ''}
                      rows={6}
                      maxLength={20000}
                      onChange={(e) =>
                        setEditor({ ...editor, description: e.target.value })
                      }
                    />
                  </label>
                )}
                {tab === 'services' && (
                  <div className="form-row">
                    <label className="field-label">
                      Icono
                      <Choice
                        label="Icono"
                        value={editor.icon || 'document'}
                        onChange={(v) => setEditor({ ...editor, icon: v })}
                        options={[
                          { value: 'document', label: 'Documentos' },
                          { value: 'users', label: 'Personas' },
                          { value: 'briefcase', label: 'Trabajo' },
                          { value: 'building', label: 'Negocios' },
                          { value: 'shield', label: 'Protección' },
                        ]}
                      />
                    </label>
                    <label className="field-label">
                      Categoría
                      <input
                        className="field"
                        value={editor.category || ''}
                        onChange={(e) =>
                          setEditor({ ...editor, category: e.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
                {tab === 'promotions' && (
                  <div className="form-row">
                    <label className="field-label">
                      Etiqueta
                      <input
                        className="field"
                        value={editor.label || ''}
                        onChange={(e) =>
                          setEditor({ ...editor, label: e.target.value })
                        }
                      />
                    </label>
                    <label className="field-label">
                      Texto del botón
                      <input
                        className="field"
                        value={editor.cta || ''}
                        onChange={(e) =>
                          setEditor({ ...editor, cta: e.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
                {(tab === 'posts' || tab === 'services') && (
                  <label className="field-label">
                    Imagen de portada
                    <Choice
                      label="Imagen de portada"
                      value={editor.cover || ''}
                      onChange={(v) => setEditor({ ...editor, cover: v })}
                      options={[
                        {
                          value: '',
                          label: 'Sin imagen / identidad del despacho',
                        },
                        {
                          value: '/images/angel-andrade.jpg',
                          label: 'Retrato profesional',
                        },
                        ...(tab === 'services' ? serviceImages : []),
                        ...media
                          .filter((m) => m.contentType.startsWith('image/'))
                          .map((m) => ({ value: m.url, label: m.name })),
                      ]}
                    />
                    {editor.cover && (
                      <img
                        className="settings-brand-preview"
                        src={editor.cover}
                        alt="Vista previa de la imagen de portada"
                      />
                    )}
                    <label className="upload-inline">
                      <Upload size={15} /> Subir imagen
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onChange={(e) => {
                          if (e.target.files?.[0])
                            upload(e.target.files[0], 'cover');
                        }}
                      />
                    </label>
                  </label>
                )}
                <div className="editor-bottom">
                  <label className="field-label">
                    Orden
                    <input
                      className="field"
                      type="number"
                      value={editor.sortOrder || 0}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          sortOrder: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <Check
                    checked={!!editor.active}
                    onChange={(v) => setEditor({ ...editor, active: v })}
                  >
                    Publicado en la web
                  </Check>
                </div>
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn gold" disabled={busy}>
                  <Save size={17} />
                  {busy ? 'Guardando…' : 'Guardar contenido'}
                </button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(v) => {
          if (!v) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Eliminar «{deleting?.title}»</AlertDialogTitle>
          <AlertDialogDescription>
            El contenido se eliminará del administrador y dejará de estar
            disponible en la web.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar contenido</AlertDialogCancel>
            <button
              className="btn gold"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await api('/admin/content/' + tab + '/' + deleting!.id, {
                    method: 'DELETE',
                  });
                  setDeleting(null);
                  await refresh();
                }, 'Contenido eliminado.')
              }
            >
              <Trash2 size={16} /> Eliminar
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
