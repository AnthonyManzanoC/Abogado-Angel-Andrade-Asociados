export function embedUrl(kind: string, url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.replace(/^www\./, '');
    if (kind === 'instagram' && host === 'instagram.com') {
      const m = u.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
      return m
        ? 'https://www.instagram.com/' + m[1] + '/' + m[2] + '/embed/'
        : null;
    }
    if (kind === 'youtube' && ['youtube.com', 'youtu.be'].includes(host)) {
      const id =
        host === 'youtu.be'
          ? u.pathname.slice(1)
          : u.searchParams.get('v') ||
            u.pathname.match(/^\/(shorts|embed)\/([A-Za-z0-9_-]+)/)?.[2];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id)
        ? 'https://www.youtube-nocookie.com/embed/' + id
        : null;
    }
    if (kind === 'tiktok' && host === 'tiktok.com') {
      const id = u.pathname.match(/\/video\/(\d+)/)?.[1];
      return id ? 'https://www.tiktok.com/player/v1/' + id : null;
    }
    if (
      kind === 'linkedin' &&
      ['linkedin.com', 'ec.linkedin.com'].includes(host)
    ) {
      const id = decodeURIComponent(url).match(
        /(?:activity-|activity:|ugcPost:)(\d+)/,
      )?.[1];
      return id
        ? 'https://www.linkedin.com/embed/feed/update/urn:li:activity:' + id
        : null;
    }
    return null;
  } catch {
    return null;
  }
}
