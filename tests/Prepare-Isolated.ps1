param([int]$Port = 5086)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$schema = 'andrade_qa_' + [Guid]::NewGuid().ToString('N')
$destination = Join-Path $repo ('.local/' + $schema)
New-Item -ItemType Directory -Path $destination -Force | Out-Null
# Compile the same source against a unique disposable schema. Production tables
# and settings are never changed, and the test server has outbound mail disabled.
foreach ($directory in @('backend','tests')) {
  $sourceRoot = Join-Path $repo $directory
  foreach ($source in Get-ChildItem $sourceRoot -File -Recurse | Where-Object { $_.FullName -notmatch '[\\/](bin|obj)[\\/]' -and $_.Name -ne 'appsettings.Local.json' }) {
    $relative = [IO.Path]::GetRelativePath($repo, $source.FullName)
    $target = Join-Path $destination $relative
    New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
    if ($source.Extension -in @('.cs','.sql')) {
      [IO.File]::WriteAllText($target, [IO.File]::ReadAllText($source.FullName).Replace('andrade_portal', $schema))
    } else { Copy-Item -LiteralPath $source.FullName -Destination $target }
  }
}
$config = Get-Content (Join-Path $repo 'backend/appsettings.Local.json') -Raw | ConvertFrom-Json
function New-QASecret { [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) }
foreach ($pair in @{
  ADMIN_EMAIL='qa-admin@example.invalid'; ADMIN_PASSWORD=(New-QASecret); MCP_API_KEY=(New-QASecret)
  BREVO_API_KEY='qa-no-real-brevo'; BREVO_WEBHOOK_SECRET=(New-QASecret); NOTIFICATION_ENCRYPTION_KEY=(New-QASecret)
  NOTIFICATION_LEGACY_ENCRYPTION_KEYS=''; EMAIL_DELIVERY_ENABLED='true'; API_PUBLIC_URL="http://127.0.0.1:$Port"
  ALLOWED_ORIGINS='http://127.0.0.1:3000,http://127.0.0.1:3002,http://127.0.0.1:3003'
}.GetEnumerator()) { $config | Add-Member -NotePropertyName $pair.Key -NotePropertyValue $pair.Value -Force }
$config | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $destination 'backend/appsettings.Local.json')
$imageDir = Join-Path $destination 'frontend/public/images'
New-Item -ItemType Directory -Path $imageDir -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repo 'frontend/public/images/angel-andrade-profile.jpg') -Destination $imageDir
$testMain = Join-Path $destination 'tests/Program.cs'
$cleanup = "if(args.Contains(`"--cleanup-isolated`")){await db.Execute(`"DROP SCHEMA $schema CASCADE`" );Console.WriteLine(`"Esquema aislado eliminado.`");return;}"
$text = [IO.File]::ReadAllText($testMain).Replace('await using var db=new Database(config);', "await using var db=new Database(config);`n$cleanup")
[IO.File]::WriteAllText($testMain, $text)
$context = @{ root=$destination; schema=$schema; port=$Port }
$context | ConvertTo-Json | Set-Content (Join-Path $repo '.local/qa-context.json')
$context | ConvertTo-Json
