import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Content } from '@/lib/api';
import { serviceCover } from '@/lib/home-content';
import { ServiceIcon } from './service-icon';
export function ServiceCard({
  service,
  index,
}: {
  service: Content;
  index: number;
}) {
  const cover = serviceCover(service);
  return (
    <Link
      href={'/servicios/' + service.id}
      className={'service-card service-editorial' + (cover ? ' has-cover' : '')}
    >
      {cover && (
        <img
          className="service-background"
          src={cover}
          alt=""
          loading="lazy"
          decoding="async"
          width={1536}
          height={1024}
        />
      )}
      <div className="service-card-top">
        <ServiceIcon name={service.icon} />
        <span>{String(index + 1).padStart(2, '0')}</span>
      </div>
      <span className="small-caps">{service.category}</span>
      <h3>{service.title}</h3>
      <p>{service.summary}</p>
      <span className="service-bottom">
        Explorar servicio <ArrowUpRight size={20} />
      </span>
    </Link>
  );
}
