param(
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

$searchRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$registryPath = $null
while ($searchRoot) {
  $candidate = Join-Path $searchRoot "scripts\ops\atlas-repos.json"
  if (Test-Path -LiteralPath $candidate -PathType Leaf) {
    $registryPath = (Resolve-Path -LiteralPath $candidate).Path
    break
  }
  $parent = Split-Path -Parent $searchRoot
  if (-not $parent -or $parent -eq $searchRoot) { break }
  $searchRoot = $parent
}
if (-not $registryPath) {
  throw "atlas-repos.json kunde inte hittas från skriptets sökväg."
}

$registry = Get-Content -Raw -LiteralPath $registryPath | ConvertFrom-Json
$customerRepo = $registry.repos | Where-Object { $_.id -eq "kundchatt" } | Select-Object -First 1
$mainRepo = $registry.repos | Where-Object { $_.id -eq "main" } | Select-Object -First 1
if (-not $customerRepo -or -not $customerRepo.build -or -not $mainRepo) {
  throw "Reporegistret saknar kundchattens byggkedja eller huvudrepot."
}

$scriptRepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$registeredCustomerRoot = (Resolve-Path -LiteralPath $customerRepo.path).Path
$registeredMainRoot = (Resolve-Path -LiteralPath $mainRepo.path).Path
if ($scriptRepoRoot -ne $registeredCustomerRoot) {
  throw "Skriptet körs från fel kundchattrepo: $scriptRepoRoot"
}

$sourcePath = Join-Path $registeredCustomerRoot $customerRepo.build.out
$destinationPath = [System.IO.Path]::GetFullPath([string]$customerRepo.build.sync_to)
if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
  throw "Byggkatalogen saknas: $sourcePath"
}
if (-not (Test-Path -LiteralPath $destinationPath -PathType Container)) {
  throw "Målkatalogen saknas: $destinationPath"
}
$resolvedSource = (Resolve-Path -LiteralPath $sourcePath).Path
$resolvedDestination = (Resolve-Path -LiteralPath $destinationPath).Path
$expectedDestinationParent = $registeredMainRoot.TrimEnd('\')
if ((Split-Path -Parent $resolvedDestination) -ne $expectedDestinationParent -or (Split-Path -Leaf $resolvedDestination) -ne "kundchatt") {
  throw "Oväntad sync-destination: $resolvedDestination"
}
if ($resolvedSource -eq $resolvedDestination) {
  throw "Källa och destination får inte vara samma katalog."
}

$requiredFiles = @("index.html", "favicon.ico", "placeholder.svg", "robots.txt")
foreach ($requiredFile in $requiredFiles) {
  $requiredPath = Join-Path $resolvedSource $requiredFile
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Byggartefakten saknas före destinationen får ändras: $requiredPath"
  }
}
$assetsPath = Join-Path $resolvedSource "assets"
if (-not (Test-Path -LiteralPath $assetsPath -PathType Container)) {
  throw "Byggartefakten saknas före destinationen får ändras: $assetsPath"
}

if ($ValidateOnly) {
  [pscustomobject]@{
    registry = $registryPath
    source = $resolvedSource
    destination = $resolvedDestination
    validated = $true
  } | ConvertTo-Json
  return
}

Get-ChildItem -LiteralPath $resolvedDestination -Force | Remove-Item -Recurse -Force
foreach ($requiredFile in $requiredFiles) {
  Copy-Item -LiteralPath (Join-Path $resolvedSource $requiredFile) -Destination $resolvedDestination -Force
}
Copy-Item -LiteralPath $assetsPath -Destination $resolvedDestination -Recurse -Force

Get-ChildItem -LiteralPath $resolvedDestination -Recurse |
  Select-Object FullName, Length |
  Sort-Object FullName |
  ConvertTo-Json
