export function whatsappLink(
  phone: string | undefined,
  message = 'Hola, Ab. Andrade. Me gustaría consultar sobre una asesoría.',
) {
  const digits = (phone || '').replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits)
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : '';
}
