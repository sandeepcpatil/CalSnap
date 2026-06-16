Set-Location $PSScriptRoot
$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'
eas build --platform android --profile production --non-interactive
