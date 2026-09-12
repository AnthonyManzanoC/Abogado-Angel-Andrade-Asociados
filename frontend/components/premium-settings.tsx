'use client';
import { Choice, Check } from './form-controls';
import { homeFields } from '@/lib/home-content';
export function PremiumSettings({
  settings: s,
  setSettings,
  media,
  upload,
  busy,
}: {
  settings: any;
  setSettings: (value: any) => void;
  media: any[];
  upload: (
    file: File,
    target:
      | 'logoUrl'
      | 'introVideoUrl'
      | 'introPoster'
      | 'buildingImage'
      | 'profileImage',
  ) => void;
  busy: boolean;
}) {
  const update = (key: string, value: any) =>
    setSettings({ ...s, [key]: value });
  return (
    <>
      <h2 className="settings-divider">Inicio ampliado</h2>
      <p className="form-note">
        Personaliza las secciones del inicio. Las imágenes y textos de cada
        servicio se editan en Servicios y aparecen también en la portada.
      </p>
      {homeFields.map(([key, label, fallback]) => (
        <label key={key} className="field-label">
          {label}
          <textarea
            className="field"
            rows={2}
            required
            maxLength={1200}
            value={s[key] ?? fallback}
            onChange={(e) => update(key, e.target.value)}
          />
        </label>
      ))}
      <h2 className="settings-divider">Perfil, contacto y apoyo solidario</h2>
      {(
        [
          ['profileName', 'Nombre público del abogado'],
          ['profileSubtitle', 'Frase de presentación'],
          ['buildingCaption', 'Descripción de la foto del edificio'],
          ['solidarityTitle', 'Título del programa solidario'],
        ] as const
      ).map(([key, label]) => (
        <label className="field-label" key={key}>
          {label}
          <input
            className="field"
            required
            minLength={2}
            maxLength={200}
            value={s[key] || ''}
            onChange={(e) => update(key, e.target.value)}
          />
        </label>
      ))}
      {(
        [
          ['solidarityDescription', 'Presentación del programa'],
          ['solidarityTerms', 'Condiciones y alcance del apoyo gratuito'],
        ] as const
      ).map(([key, label]) => (
        <label className="field-label" key={key}>
          {label}
          <textarea
            className="field"
            required
            minLength={2}
            maxLength={3000}
            rows={5}
            value={s[key] || ''}
            onChange={(e) => update(key, e.target.value)}
          />
        </label>
      ))}
      <label className="field-label">
        Día de cierre mensual (1 a 28)
        <input
          className="field"
          type="number"
          min={1}
          max={28}
          required
          value={s.solidarityCloseDay || 25}
          onChange={(e) => update('solidarityCloseDay', Number(e.target.value))}
        />
      </label>
      <Check
        checked={!!s.solidarityEnabled}
        onChange={(v) => update('solidarityEnabled', v)}
      >
        Abrir el programa solidario. Cada mes admite postulaciones hasta el día
        de cierre o hasta seleccionar el caso.
      </Check>
      <h2 className="settings-divider">Marca, presentación y asistente</h2>
      <label className="field-label">
        Nombre del asistente
        <input
          className="field"
          value={s.assistantName || 'Alma'}
          onChange={(e) => update('assistantName', e.target.value)}
          minLength={2}
          maxLength={40}
          required
        />
      </label>
      <label className="field-label">
        Título de la presentación
        <input
          className="field"
          value={s.introTitle || ''}
          onChange={(e) => update('introTitle', e.target.value)}
          maxLength={100}
        />
      </label>
      {(
        ['logoUrl', 'introPoster', 'buildingImage', 'profileImage'] as const
      ).map((key) => (
        <div key={key}>
          <label className="field-label">
            {
              {
                logoUrl: 'Logo del despacho',
                introPoster: 'Portada del video',
                buildingImage: 'Foto del edificio Alavama',
                profileImage: 'Retrato de la página del abogado',
              }[key]
            }
            <Choice
              label={
                {
                  logoUrl: 'Logo del despacho',
                  introPoster: 'Portada del video',
                  buildingImage: 'Foto del edificio Alavama',
                  profileImage: 'Retrato de la página del abogado',
                }[key]
              }
              value={s[key] || ''}
              onChange={(v) => update(key, v)}
              options={[
                {
                  value: '',
                  label:
                    key === 'logoUrl'
                      ? 'Monograma original AA'
                      : key === 'buildingImage'
                        ? 'Mostrar solo el mapa'
                        : 'Usar fotografía principal',
                },
                ...media
                  .filter((m) => m.contentType.startsWith('image/'))
                  .map((m) => ({ value: m.url, label: m.name })),
              ]}
            />
          </label>
          {s[key] && (
            <img
              className="settings-brand-preview"
              src={s[key]}
              alt={
                key === 'logoUrl'
                  ? 'Vista previa del logo'
                  : 'Portada seleccionada'
              }
            />
          )}
          <label className="field-label">
            Subir imagen (PNG, JPG o WebP)
            <input
              className="field"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                if (e.target.files?.[0]) upload(e.target.files[0], key);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      ))}
      <label className="field-label">
        Video de presentación · YouTube o biblioteca
        <input
          className="field"
          value={s.introVideoUrl || ''}
          onChange={(e) => update('introVideoUrl', e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
        />
      </label>
      <label className="field-label">
        Elegir video de la biblioteca
        <Choice
          label="Video de presentación"
          value={
            media.some((m) => m.url === s.introVideoUrl) ? s.introVideoUrl : ''
          }
          onChange={(v) => update('introVideoUrl', v)}
          options={[
            { value: '', label: 'Sin video de biblioteca' },
            ...media
              .filter((m) => m.contentType.startsWith('video/'))
              .map((m) => ({ value: m.url, label: m.name })),
          ]}
        />
      </label>
      <label className="field-label">
        Subir video · MP4 o WebM, hasta 25 MB
        <input
          className="field"
          type="file"
          accept="video/mp4,video/webm"
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.[0]) upload(e.target.files[0], 'introVideoUrl');
            e.target.value = '';
          }}
        />
      </label>
      <p className="form-note">
        Graba una presentación de 60–90 segundos: quién eres, tu trayectoria
        real, a quién ayudas y cómo contactarte. Para videos mayores de 25 MB,
        usa YouTube. Sin video se muestra tu retrato, sin un reproductor vacío.
      </p>
      <label className="field-label">
        WhatsApp · incluir código de país
        <input
          className="field"
          value={s.whatsapp || ''}
          onChange={(e) => update('whatsapp', e.target.value)}
          placeholder="+593 98 664 8328"
          type="tel"
        />
      </label>
      <h2 className="settings-divider">Consulta virtual y transferencias</h2>
      <Check
        checked={s.paymentTestMode !== false}
        onChange={(v) => update('paymentTestMode', v)}
      >
        Modo de prueba: no solicitar transferencias reales.
      </Check>
      <label className="field-label">
        Valor de la consulta (USD)
        <input
          className="field"
          type="number"
          min="0"
          max="10000"
          step="0.01"
          value={s.virtualFee ?? 25}
          onChange={(e) => update('virtualFee', Number(e.target.value))}
        />
      </label>
      <label className="field-label">
        Banco, titular, tipo y número de cuenta
        <textarea
          className="field"
          rows={5}
          maxLength={2000}
          value={s.bankInstructions || ''}
          onChange={(e) => update('bankInstructions', e.target.value)}
        />
      </label>
      <p className="form-note">
        Reemplaza todos los datos de prueba antes de activar pagos reales. Cada
        solicitud conserva el valor y los datos que recibió. Las solicitudes
        creadas en prueba siguen siendo de prueba.
      </p>
      <h2 className="settings-divider">Correos y regreso a la cita</h2>
      <label className="field-label">
        Frecuencia de notificaciones
        <Choice
          label="Frecuencia de notificaciones"
          value={s.emailPolicy || 'important'}
          onChange={(value) => update('emailPolicy', value)}
          options={[
            {
              value: 'important',
              label: 'Esenciales: recepción y decisiones importantes',
            },
            { value: 'all', label: 'Todos los cambios públicos' },
          ]}
        />
      </label>
      <p className="form-note">
        En modo esencial se avisa a cliente y administrador al recibir, aprobar,
        agendar, completar o cancelar. Las revisiones y notas rutinarias quedan
        en el seguimiento. Una transferencia reportada avisa al administrador;
        Comunicar una novedad permite enviar un mensaje importante expresamente.
        Alma sigue estas mismas reglas.
      </p>
      {(
        [
          ['senderEmail', 'Remitente verificado en Brevo'],
          ['notificationEmail', 'Correo del administrador'],
          ['publicSiteUrl', 'URL pública de la web'],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="field-label">
          {label}
          <input
            className="field"
            type={key === 'publicSiteUrl' ? 'url' : 'email'}
            value={s[key] || ''}
            onChange={(e) => update(key, e.target.value)}
            required
          />
        </label>
      ))}
      <Check
        checked={!!s.emailEnabled}
        onChange={(v) => update('emailEnabled', v)}
      >
        Activar envío de correos al cliente y al administrador.
      </Check>
      <p className="form-note">
        El remitente debe estar activo en Brevo. Al activar se procesan también
        los avisos pendientes. Consulta su resultado en Actividad e
        integraciones. La clave de API se guarda exclusivamente en el servidor.
      </p>
    </>
  );
}
