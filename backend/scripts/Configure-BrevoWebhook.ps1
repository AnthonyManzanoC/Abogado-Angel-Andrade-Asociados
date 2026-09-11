param(
  [string]$SiteUrl = 'https://abogado-angel-andrade-asociados.vercel.app',
  [string]$ConfigPath = (Join-Path $PSScriptRoot '../appsettings.Local.json')
)
$ErrorActionPreference = 'Stop'
$settings = if (Test-Path -LiteralPath $ConfigPath) { Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json } else { $null }
$apiKey = if ($env:BREVO_API_KEY) { $env:BREVO_API_KEY } else { $settings.BREVO_API_KEY }
$webhookSecret = if ($env:BREVO_WEBHOOK_SECRET) { $env:BREVO_WEBHOOK_SECRET } else { $settings.BREVO_WEBHOOK_SECRET }
if (-not $apiKey -or $webhookSecret.Length -lt 32) { throw 'Configura BREVO_API_KEY y BREVO_WEBHOOK_SECRET en el entorno o archivo privado local.' }
$site = [Uri]$SiteUrl
if ($site.Scheme -ne 'https' -or $site.UserInfo -or $site.AbsolutePath -ne '/' -or $site.Query -or $site.Fragment) { throw 'SiteUrl debe ser la raíz HTTPS del portal.' }
$callbackUrl = $SiteUrl.TrimEnd('/') + '/api/webhooks/brevo'
# A no-op callback verifies that the new deployment and the shared secret agree.
$null = Invoke-RestMethod -Uri $callbackUrl -Method Post -ContentType 'application/json' -Headers @{ Authorization = 'Bearer ' + $webhookSecret } -Body '{"event":"setup_check"}'
$headers = @{ 'api-key' = $apiKey }
$existing = Invoke-RestMethod 'https://api.brevo.com/v3/webhooks?type=transactional' -Headers $headers
$existingHooks = @($existing.webhooks | Where-Object { $_.url -eq $callbackUrl })
if ($existingHooks.Count -gt 1) { throw 'Hay varios webhooks con esta URL. Revisa los duplicados en Brevo antes de continuar.' }
$payload = @{
  url = $callbackUrl
  description = 'Andrade: entrega de notificaciones transaccionales'
  type = 'transactional'
  events = @('delivered','hardBounce','softBounce','blocked','spam','invalid','deferred')
  auth = @{ type = 'bearer'; token = $webhookSecret }
} | ConvertTo-Json -Depth 5
if ($existingHooks.Count -eq 1) {
  $null = Invoke-RestMethod ('https://api.brevo.com/v3/webhooks/' + $existingHooks[0].id) -Method Put -Headers $headers -ContentType 'application/json' -Body $payload
  Write-Output 'Webhook existente actualizado. No se creó un duplicado.'
} else {
  $null = Invoke-RestMethod 'https://api.brevo.com/v3/webhooks' -Method Post -Headers $headers -ContentType 'application/json' -Body $payload
  Write-Output 'Webhook transaccional registrado.'
}
