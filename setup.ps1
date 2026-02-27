# epub-tools 一键环境安装脚本 (Windows PowerShell)
# 用法: .\setup.ps1
$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  epub-tools 开发环境安装" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

function OK($msg)   { Write-Host "✅ $msg" -ForegroundColor Green }
function WARN($msg) { Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function FAIL($msg) { Write-Host "❌ $msg" -ForegroundColor Red }

# 1. 检查/安装 mise
Write-Host "📦 检查 mise 版本管理工具..." -ForegroundColor White
if (Get-Command mise -ErrorAction SilentlyContinue) {
    $miseVer = (mise --version) | Select-Object -First 1
    OK "mise 已安装: $miseVer"
} else {
    Write-Host "安装 mise..."
    # Windows 可以通过 winget 或 scoop 安装
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install jdx.mise
    } elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
        scoop install mise
    } else {
        FAIL "请先安装 mise: https://mise.jdx.dev/getting-started.html"
        exit 1
    }
    OK "mise 安装完成"
}

# 2. 信任并安装项目工具版本
Write-Host ""
Write-Host "📦 安装项目指定的工具版本 (Node.js, Python)..." -ForegroundColor White
mise trust
mise install
OK "工具版本安装完成"

# 3. 验证 Node.js
Write-Host ""
Write-Host "🔍 验证 Node.js..." -ForegroundColor White
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = node -v
    OK "Node.js $nodeVer"
} else {
    FAIL "Node.js 未找到，请检查 mise 配置"
    exit 1
}

# 4. 安装 pnpm
Write-Host ""
Write-Host "📦 安装 pnpm..." -ForegroundColor White
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pnpmVer = pnpm -v
    OK "pnpm 已安装: $pnpmVer"
} else {
    npm install -g pnpm@10.30.3
    OK "pnpm 安装完成"
}

# 5. 安装 Node.js 依赖
Write-Host ""
Write-Host "📦 安装 Node.js 项目依赖..." -ForegroundColor White
pnpm install
OK "Node.js 依赖安装完成"

# 6. 验证 Python
Write-Host ""
Write-Host "🔍 验证 Python (字体混淆可选)..." -ForegroundColor White
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pyVer = python --version
    OK "Python: $pyVer"

    Write-Host "📦 安装 Python 依赖..."
    python -m pip install -r py-scripts/requirements.txt --quiet
    OK "Python 依赖安装完成"
} else {
    WARN "Python 未安装 — 字体混淆功能将不可用"
}

# 7. 检查 Rust
Write-Host ""
Write-Host "🔍 检查 Rust (GUI 构建可选)..." -ForegroundColor White
if (Get-Command rustc -ErrorAction SilentlyContinue) {
    $rustVer = rustc --version
    OK "Rust: $rustVer"
} else {
    WARN "Rust 未安装 — 如需构建桌面应用请访问: https://rustup.rs/"
}

# 8. 构建
Write-Host ""
Write-Host "🔨 构建核心库..." -ForegroundColor White
try {
    pnpm build:core
    OK "core 构建成功"
} catch {
    WARN "core 构建失败 (可能需要先完成实现)"
}

try {
    pnpm build:cli
    OK "cli 构建成功"
} catch {
    WARN "cli 构建失败 (可能需要先完成实现)"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  ✅ 开发环境准备完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "常用命令:"
Write-Host "  pnpm build          — 构建所有包"
Write-Host "  pnpm test           — 运行测试"
Write-Host "  pnpm dev            — 启动 GUI 开发"
Write-Host "  pnpm dev:cli        — CLI 开发模式"
Write-Host "  pnpm doctor         — 检查依赖环境"
Write-Host ""
