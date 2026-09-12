using System.Text;
namespace Andrade;

public record PaymentReceiptInput(string Base64);
public static class PaymentReceipt
{
 public const int MaxBytes = 2 * 1024 * 1024;
 public static (byte[] Bytes, string ContentType) Decode(PaymentReceiptInput input)
 {
  if (string.IsNullOrEmpty(input.Base64) || input.Base64.Length > 4 * ((MaxBytes + 2) / 3)) throw new PortalException("El comprobante debe pesar como máximo 2 MB.");
  byte[] bytes;
  try { bytes = Convert.FromBase64String(input.Base64); } catch (FormatException) { throw new PortalException("El comprobante no es válido."); }
  if (bytes.Length < 12 || bytes.Length > MaxBytes) throw new PortalException("El comprobante debe pesar entre 12 bytes y 2 MB.");
  var mime = bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255 ? "image/jpeg"
   : bytes.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}) ? "image/png"
   : Encoding.ASCII.GetString(bytes,0,5) == "%PDF-" ? "application/pdf" : "";
  if (mime == "") throw new PortalException("Usa un comprobante JPG, PNG o PDF.");
  return (bytes,mime);
 }
}
