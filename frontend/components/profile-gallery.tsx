'use client';
import { useState } from 'react';
import { Content } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
export function ProfileGallery({ items }: { items: Content[] }) {
  const [photo, setPhoto] = useState<Content | null>(null);
  return (
    <>
      <div className="profile-gallery">
        {items
          .filter((p) => p.cover)
          .map((p) => (
            <button
              key={p.id}
              className="gallery-item"
              onClick={() => setPhoto(p)}
              aria-label={'Ampliar: ' + p.title}
            >
              <img src={p.cover} alt={p.title} loading="lazy" />
              <span>
                <small>{p.label}</small>
                <strong>{p.title}</strong>
                <span>Ver fotografía ↗</span>
              </span>
            </button>
          ))}
      </div>
      <Dialog
        open={!!photo}
        onOpenChange={(v) => {
          if (!v) setPhoto(null);
        }}
      >
        <DialogContent className="gallery-dialog">
          <DialogTitle>{photo?.title}</DialogTitle>
          <DialogDescription>{photo?.summary}</DialogDescription>
          {photo?.cover && <img src={photo.cover} alt={photo.title} />}
          {photo?.description && (
            <p className="pre-line">{photo.description}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
