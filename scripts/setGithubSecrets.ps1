param(
  [string]$EnvPath = ".env"
)

$required = @(
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_MEASUREMENT_ID",
  "VITE_FIREBASE_FUNCTIONS_REGION"
)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI 'gh' is not installed. Install it from https://cli.github.com/ and run 'gh auth login'."
}

if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw "Could not find $EnvPath"
}

$values = @{}
Get-Content -LiteralPath $EnvPath | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $parts = $_ -split '=', 2
  $key = $parts[0].Trim()
  $value = $parts[1].Trim().Trim('"').Trim("'")
  if ($key) { $values[$key] = $value }
}

foreach ($key in $required) {
  if ($values.ContainsKey($key) -and $values[$key]) {
    $values[$key] | gh secret set $key
    Write-Host "Set $key"
  } else {
    Write-Warning "Skipping $key because it is missing or empty in $EnvPath"
  }
}
