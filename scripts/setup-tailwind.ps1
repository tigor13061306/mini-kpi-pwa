Param(
  [string]$ProjectRoot = ".",
  [switch]$Install,
  [switch]$Force
)

function Ensure-Dir($p){ if(-not (Test-Path $p)){ New-Item -ItemType Directory -Path $p | Out-Null } }
function Write-IfChanged($path,[string]$content,[switch]$force){
  if((Test-Path $path) -and -not $force){
    $old = Get-Content -Raw -Path $path
    if($old -eq $content){ Write-Host "• $([IO.Path]::GetFileName($path)) već ažuran"; return }
  }
  $dir = Split-Path $path; if($dir){ Ensure-Dir $dir }
  $content | Out-File -FilePath $path -Encoding UTF8 -Force
  Write-Host "✔ Upisano: $path"
}

$root = Resolve-Path $ProjectRoot
Set-Location $root
Write-Host "Root: $root"

# odredi ekstenziju config fajla (.cjs ako je ESM)
$cfgExt = "js"
$pkgPath = Join-Path $root "package.json"
if(Test-Path $pkgPath){
  try{ $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json; if($pkg.type -eq "module"){ $cfgExt = "cjs" } }catch{}
}

$tailwindCfg = Join-Path $root "tailwind.config.$cfgExt"
$postcssCfg  = Join-Path $root "postcss.config.js"
$appDir = if(Test-Path (Join-Path $root "src/app")){ Join-Path $root "src/app" } else { Join-Path $root "app" }
Ensure-Dir $appDir
$globalsCss = Join-Path $appDir "globals.css"
$layoutTsx  = if(Test-Path (Join-Path $appDir "layout.tsx")){ Join-Path $appDir "layout.tsx" } else { "" }

$tailwindContent = @"
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
"@

$postcssContent = @"
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"@

$globalsContent = @"
/* Tailwind entry */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Optional global tweaks */
:root { color-scheme: dark; }
html, body { height: 100%; }
"@

Write-IfChanged $tailwindCfg $tailwindContent $Force
Write-IfChanged $postcssCfg  $postcssContent  $Force
Write-IfChanged $globalsCss  $globalsContent  $Force

if($layoutTsx -and (Test-Path $layoutTsx)){
  $layout = Get-Content $layoutTsx -Raw
  if($layout -notmatch "import\s+['""]\./globals\.css['""]"){
    if($layout -match "^\s*'use client';"){
      $layout = $layout -replace "^\s*'use client';\s*", "'use client';`r`nimport './globals.css';`r`n"
    } else {
      $layout = "import './globals.css';`r`n" + $layout
    }
    $layout | Out-File -FilePath $layoutTsx -Encoding UTF8 -Force
    Write-Host "✔ Dodat import './globals.css' u $layoutTsx"
  } else {
    Write-Host "• layout.tsx već uvozi ./globals.css"
  }
} else {
  Write-Warning "Nisam našao layout.tsx u $appDir — preskačem korak uvoza CSS-a."
}

if($Install){
  Write-Host "⏳ Instaliram tailwindcss, postcss, autoprefixer (dev deps)..."
  npm i -D tailwindcss postcss autoprefixer
  if($LASTEXITCODE -ne 0){ Write-Warning "npm install nije prošao." }
}

Write-Host "`nSve gotovo ✅ — restartaj dev server (npm run dev)."
