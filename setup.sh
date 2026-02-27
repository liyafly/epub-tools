#!/usr/bin/env bash
# epub-tools 一键环境安装脚本 (macOS / Linux)
set -euo pipefail

echo "=========================================="
echo "  epub-tools 开发环境安装"
echo "=========================================="
echo ""

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }

# 1. 检查/安装 mise
echo "📦 检查 mise 版本管理工具..."
if command -v mise &> /dev/null; then
    ok "mise 已安装: $(mise --version | head -1)"
else
    echo "安装 mise..."
    curl https://mise.run | sh
    export PATH="$HOME/.local/bin:$PATH"
    ok "mise 安装完成"
fi

# 2. 信任并安装项目工具版本
echo ""
echo "📦 安装项目指定的工具版本 (Node.js, Python)..."
mise trust
mise install
ok "工具版本安装完成"

# 3. 验证 Node.js
echo ""
echo "🔍 验证 Node.js..."
if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    ok "Node.js $NODE_VER"
else
    fail "Node.js 未找到，请检查 mise 配置"
    exit 1
fi

# 4. 安装 pnpm
echo ""
echo "📦 安装 pnpm..."
if command -v pnpm &> /dev/null; then
    ok "pnpm 已安装: $(pnpm -v)"
else
    npm install -g pnpm@10.30.3
    ok "pnpm 安装完成: $(pnpm -v)"
fi

# 5. 安装 Node.js 依赖
echo ""
echo "📦 安装 Node.js 项目依赖..."
pnpm install
ok "Node.js 依赖安装完成"

# 6. 验证 Python
echo ""
echo "🔍 验证 Python (字体混淆可选)..."
if command -v python3 &> /dev/null; then
    PY_VER=$(python3 --version)
    ok "Python: $PY_VER"

    echo "📦 安装 Python 依赖..."
    python3 -m pip install -r py-scripts/requirements.txt --quiet
    ok "Python 依赖安装完成"
else
    warn "Python 未安装 — 字体混淆功能将不可用"
fi

# 7. 检查 Rust (GUI 构建可选)
echo ""
echo "🔍 检查 Rust (GUI 构建可选)..."
if command -v rustc &> /dev/null; then
    RUST_VER=$(rustc --version)
    ok "Rust: $RUST_VER"
else
    warn "Rust 未安装 — 如需构建桌面应用请运行: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
fi

# 8. 检查可选工具
echo ""
echo "🔍 检查可选工具..."
for tool in jpegoptim oxipng zopflipng git; do
    if command -v "$tool" &> /dev/null; then
        ok "$tool 已安装"
    else
        warn "$tool 未安装 (可选)"
    fi
done

# 9. 构建测试
echo ""
echo "🔨 构建核心库..."
pnpm build:core 2>/dev/null && ok "core 构建成功" || warn "core 构建失败 (可能需要先完成实现)"
pnpm build:cli 2>/dev/null && ok "cli 构建成功" || warn "cli 构建失败 (可能需要先完成实现)"

echo ""
echo "=========================================="
echo "  ✅ 开发环境准备完成！"
echo "=========================================="
echo ""
echo "常用命令:"
echo "  pnpm build          — 构建所有包"
echo "  pnpm test           — 运行测试"
echo "  pnpm dev            — 启动 GUI 开发"
echo "  pnpm dev:cli        — CLI 开发模式"
echo "  pnpm doctor         — 检查依赖环境"
echo ""
