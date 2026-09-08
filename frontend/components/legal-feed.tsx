'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Play,
  ArrowUpRight,
  Search,
  LoaderCircle,
  BookOpen,
  Video,
  Check,
  Link as LinkIcon,
} from 'lucide-react';
import { api, Content } from '@/lib/api';
import { embedUrl } from '@/lib/embeds';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Choice } from './form-controls';
export function LegalFeed() {
  const [items, setItems] = useState<Content[]>([]),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState(''),
    [more, setMore] = useState(true),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState<Content | null>(null),
    [copied, setCopied] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null),
    generation = useRef(0),
    pending = useRef(false),
    offset = useRef(0);
  const load = useCallback(
    async (reset = false) => {
      if (pending.current && !reset) return;
      const gen = reset ? ++generation.current : generation.current;
      pending.current = true;
      setLoading(true);
      setError('');
      try {
        const d = await api(
          '/posts?' +
            new URLSearchParams({
              offset: String(reset ? 0 : offset.current),
              limit: '6',
              category,
              search: query,
            }),
        );
        if (gen !== generation.current) return;
        setItems((prev) =>
          reset
            ? d.items
            : [
                ...prev,
                ...d.items.filter(
                  (x: Content) => !prev.some((p) => p.id === x.id),
                ),
              ],
        );
        offset.current = d.nextOffset;
        setMore(d.hasMore);
      } catch (e) {
        if (gen === generation.current) setError((e as Error).message);
      } finally {
        if (gen === generation.current) {
          pending.current = false;
          setLoading(false);
        }
      }
    },
    [query, category],
  );
  useEffect(() => {
    offset.current = 0;
    setItems([]);
    setMore(true);
    void load(true);
  }, [load]);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !more || loading || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void load();
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [more, loading, error, load]);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && /^[a-z0-9-]+$/.test(id))
      api('/posts/' + id)
        .then(setSelected)
        .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (selected) {
      setCopied(false);
      history.replaceState(null, '', '#' + selected.id);
    }
  }, [selected]);
  return (
    <>
      <div className="feed-toolbar">
        <form
          className="search-box"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
          }}
        >
          <Search size={18} />
          <input
            placeholder="Buscar en la vitrina…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar publicaciones"
          />
          <button type="submit" className="text-link">
            Buscar
          </button>
        </form>
        <Choice
          value={category}
          onChange={setCategory}
          label="Filtrar por tema"
          options={[
            { value: '', label: 'Todos los temas' },
            { value: 'El despacho', label: 'El despacho' },
            { value: 'Civil', label: 'Civil' },
            { value: 'Familia', label: 'Familia' },
            { value: 'Laboral', label: 'Laboral' },
            { value: 'Negocios', label: 'Negocios' },
            { value: 'Actualidad', label: 'Actualidad' },
          ]}
        />
      </div>
      <div className="feed-grid">
        {items.map((post, i) => (
          <button
            className={'feed-card ' + (i === 0 ? 'featured' : '')}
            key={post.id}
            onClick={() => setSelected(post)}
          >
            <div className="feed-cover">
              {post.cover ? (
                <img src={post.cover} alt="" loading="lazy" />
              ) : (
                <div className="feed-placeholder">
                  <span className="monogram">
                    A<span>A</span>
                  </span>
                  <span>VITRINA LEGAL</span>
                </div>
              )}
              <span className="feed-format">
                {post.kind === 'article' ? (
                  <BookOpen size={13} />
                ) : (
                  <Video size={13} />
                )}{' '}
                {post.kind === 'article' ? 'LECTURA' : post.kind?.toUpperCase()}
              </span>
              <span className="feed-play">
                {post.kind === 'article' ? (
                  <ArrowUpRight />
                ) : (
                  <Play size={23} fill="currentColor" />
                )}
              </span>
            </div>
            <div className="feed-copy">
              <span className="eyebrow">{post.category || 'EL DESPACHO'}</span>
              <h2>{post.title}</h2>
              <p>{post.summary}</p>
              <span className="feed-author">
                <img src="/images/angel-andrade-profile.jpg" alt="" /> Ángel
                Andrade Núñez <ArrowUpRight size={16} />
              </span>
            </div>
          </button>
        ))}
      </div>
      {!loading && !items.length && !error && (
        <div className="empty-state">
          <BookOpen size={35} />
          <h2>
            {query || category
              ? 'No encontramos publicaciones con ese filtro.'
              : 'La conversación comienza aquí.'}
          </h2>
          <p>
            {query || category
              ? 'Prueba otra palabra o selecciona todos los temas.'
              : 'El despacho publicará sus próximos videos y novedades en este espacio.'}
          </p>
          {(query || category) && (
            <button
              className="btn outline"
              onClick={() => {
                setSearch('');
                setQuery('');
                setCategory('');
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}
          <button className="text-link" onClick={() => load()}>
            Reintentar
          </button>
        </div>
      )}
      <div className="feed-sentinel" ref={sentinel}>
        {loading ? (
          <span className="inline-loading">
            <LoaderCircle size={18} className="spin" /> Cargando publicaciones…
          </span>
        ) : more && !error ? (
          <button className="btn outline" onClick={() => load()}>
            Cargar más
          </button>
        ) : items.length > 0 ? (
          <span>Estás al día. Pronto, nuevas perspectivas.</span>
        ) : null}
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            history.replaceState(null, '', window.location.pathname);
          }
        }}
      >
        <DialogContent className="post-dialog">
          {selected && (
            <>
              <DialogTitle>{selected.title}</DialogTitle>
              <DialogDescription>{selected.summary}</DialogDescription>
              {selected.kind === 'article' ? (
                <div className="article-body">
                  {selected.cover && <img src={selected.cover} alt="" />}
                  <div className="prose pre-line">{selected.description}</div>
                  <Link
                    href="/consulta"
                    onClick={() => setSelected(null)}
                    className="btn gold"
                  >
                    Conversemos sobre tu situación <ArrowUpRight size={16} />
                  </Link>
                </div>
              ) : selected.kind === 'video' ? (
                <video
                  className="post-player"
                  src={selected.url}
                  controls
                  playsInline
                  preload="metadata"
                  poster={selected.cover}
                  onPlay={(e) => {
                    document.querySelectorAll('video').forEach((v) => {
                      if (v !== e.currentTarget) v.pause();
                    });
                  }}
                />
              ) : embedUrl(selected.kind || '', selected.url || '') ? (
                <div className="embed-container">
                  <iframe
                    src={embedUrl(selected.kind || '', selected.url || '')!}
                    title={selected.title}
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              ) : (
                <p className="notice">
                  La red social no permite integrar este enlace. Puedes abrir la
                  publicación original.
                </p>
              )}
              {selected.kind !== 'article' && selected.kind !== 'video' && (
                <p className="form-note">
                  La reproducción depende de la red social y sus permisos. Al
                  cargar el reproductor, se conecta con esa plataforma.
                </p>
              )}
              <div className="button-row">
                {selected.url && selected.kind !== 'video' && (
                  <a
                    className="text-link"
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir publicación original <ArrowUpRight size={16} />
                  </a>
                )}
                <button
                  className="text-link"
                  onClick={async () => {
                    await navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                  }}
                >
                  {copied ? <Check size={16} /> : <LinkIcon size={16} />}{' '}
                  {copied ? 'Enlace copiado' : 'Copiar enlace'}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
