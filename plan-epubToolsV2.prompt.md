# EPUB 跨平台处理工具 — 修订技术方案 v2
 
TS 全栈重构 + Python 仅保留字体混淆 + Tauri 桌面应用 + CLI 双界面。
 
---
 
## 一、与 v1 方案的核心变更
 
| 维度 | v1 方案 | v2 方案（本文） |
|------|---------|----------------|
| Python 依赖范围 | 5 个脚本全部复用 | **仅保留 `encrypt_font.py`**，其余全部用 TS 重写 |
| GUI 方案 | Web UI（localhost 浏览器访问） | **Tauri 桌面应用**（`.app/.exe/.dmg`，双击即用） |
| 架构策略 | "先复用 Python 再按需替换" | **一次性重写到位**（字体混淆除外） |
| 可复用脚本 | 无专门目录 | **`skills/` 目录**（TS + Python 混合） |
| 分发体积 | N/A（需用户装 Node） | Tauri ~10-15MB（对比 Electron ~150MB） |
 
---
 
## 二、总体架构
 
```text
┌──────────────────────────────────────────────────────┐
│                   用户界面层                          │
│  ┌────────────────┐    ┌──────────────────────────┐  │
│  │  CLI (commander) │    │  Tauri Desktop App       │  │
│  │  终端直接使用     │    │  Rust 壳 + React 前端    │  │
│  └───────┬────────┘    └────────────┬─────────────┘  │
│          └──────────┬───────────────┘                 │
│                     ▼                                │
│          核心处理层 (src/core/)  ← 纯 TS              │
│   ┌─────────┬──────────┬──────────┬──────────┐       │
│   │ EPUB    │ 图片处理  │ 字体处理  │ 编辑工作流│       │
│   │ 解析/打包│ 转换/压缩 │ 子集化   │ Git 跟踪  │       │
│   └─────────┴──────────┴──────────┴──────────┘       │
│                     │                                │
│          ┌──────────┼──────────────┐                 │
│          ▼          ▼              ▼                 │
│   TS 原生库    Python 桥接     外部 CLI 工具          │
│   · sharp      · encrypt_font  · jpegoptim           │
│   · subset-font  (唯一 Python)  · oxipng             │
│   · jszip                      · zopflipng           │
│   · cheerio                                          │
│   · css-tree                                         │
│   · simple-git                                       │
└──────────────────────────────────────────────────────┘
```
 
**核心原则：TS 做主力，Python 仅在无替代方案时使用（字体混淆 fontTools 无 JS 等效库）。**
 
---
 
## 三、Python 仅保留字体混淆的理由
 
### 3.1 必须保留 Python 的：`encrypt_font.py`
 
epub_tool 的字体混淆逻辑依赖 fontTools 的深度字体操作：
- `TTFont` 读取 cmap（字符映射表）
- `TTGlyphPen` 复制字形轮廓数据
- `FontBuilder` 构建全新最小字体
- 将 CJK 字符映射到韩文 Private Use Area（`0xAC00-0xD7AF`）
 
JS/TS 生态中**没有等效的字体操作库**。`opentype.js` 只能读不能深度改写字形，`fontkit` 同理。fontTools 是 Python 字体工程的事实标准，强行重写得不偿失。
 
**Python 依赖极简化**：仅需 `fonttools`, `beautifulsoup4`, `tinycss2`（CSS 解析用于定位 `@font-face` 规则）。
 
### 3.2 TS 重写的模块
 
| 原 Python 脚本 | TS 替代方案 | 理由 |
|----------------|------------|------|
| `reformat_epub.py` | `cheerio` + `fast-xml-parser` + `jszip` | BS4/lxml 的功能 cheerio 完全覆盖，且更快 |
| `encrypt_epub.py` | Node.js `crypto` (MD5) + 字符串操作 | 纯算法逻辑，无外部依赖需求 |
| `decrypt_epub.py` | 同上 + `string-similarity`（模糊匹配） | SequenceMatcher 有 JS 等效 |
| `transfer_img.py` | `sharp`（libvips） | 比 Pillow 快 5-10x，原生支持 WebP/AVIF |
 
---
 
## 四、Tauri GUI 方案详解
 
### 4.1 为什么选 Tauri
 
| 维度 | PyInstaller (epub_tool 现状) | Electron | **Tauri** ⭐ |
|------|---------------------------|----------|-------------|
| 打包体积 | ~30-50MB | ~150MB+ | **~10-15MB** |
| 内存占用 | 中等 | 高 (~200MB+) | **低 (~30MB)** |
| 前端技术 | tkinter (受限) | Web (完整) | **Web (完整)** |
| 系统 API | Python 调用 | Node.js | **Rust (安全高效)** |
| 跨平台 | ✅ | ✅ | ✅ |
| 自动更新 | 无 | electron-updater | **tauri-updater** |
| 构建工具链 | Python + PyInstaller | Node.js | Node.js + Rust |
 
### 4.2 Tauri 架构
 
```text
┌─────────────────────────────────────────┐
│           Tauri 应用                      │
│  ┌─────────────────────────────────┐    │
│  │  前端 (WebView)                  │    │
│  │  React 18 + TailwindCSS + shadcn│    │
│  │  拖拽文件 / 操作面板 / 日志     │    │
│  └──────────────┬──────────────────┘    │
│                 │ Tauri IPC (invoke)     │
│  ┌──────────────▼──────────────────┐    │
│  │  Rust 后端 (src-tauri/)          │    │
│  │  · 文件系统操作                  │    │
│  │  · 调用 Node.js sidecar          │    │
│  │  · 调用 Python sidecar           │    │
│  │  · 系统对话框/通知              │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```
 
**关键设计 — Sidecar 模式**：
 
Tauri 本身是 Rust 壳，核心处理逻辑在 Node.js 中。通过 Tauri 的 sidecar 功能将 Node.js CLI 打包进应用：
- Rust 后端通过 `tauri::api::process::Command` 调用打包的 Node.js 可执行文件（用 `pkg` 或 `sea` 编译）
- 前端通过 Tauri IPC (`invoke`) 与 Rust 后端通信
- Rust 后端转发请求到 Node.js sidecar 并回传结果/进度
- Python `encrypt_font.py` 作为二级 sidecar（由 Node.js 调用，或由 Rust 直接调用）
 
**替代方案 — Tauri + 内嵌 HTTP**：
 
也可以让 Node.js 核心以 HTTP server 模式运行（同 v1 方案的 Fastify），Tauri WebView 直接访问 `localhost`。这种方式更简单，但需要管理端口占用。
 
### 4.3 GUI 布局（对标 epub_tool，功能增强）
 
```text
┌─────────────────────────────────────────────────────────────┐
│  EPUB Tools                                    [设置] [主题] │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│  侧边栏   │  📂 待处理文件                                    │
│          │  ┌──────────────────────────────────────────┐    │
│ [添加文件] │  │  #  文件名           路径              状态  │    │
│ [添加文件夹]│  │  1  book1.epub      /Users/.../book1  待处理│    │
│ [清空列表] │  │  2  book2.epub      /Users/.../book2  待处理│    │
│          │  └──────────────────────────────────────────┘    │
│ ──────── │                                                  │
│          │  📁 输出路径: [默认: 源文件同级目录] [选择] [重置]   │
│ 使用说明  │                                                  │
│ · 拖拽添加│  🔧 操作                                          │
│ · 右键菜单│  [格式化] [解密] [加密] [字体加密] [图片转换]       │
│          │  [图片压缩▾] [字体子集化]             ← 新增功能    │
│          │          ├─ 快速(oxipng)                          │
│ GitHub ↗ │          ├─ 标准(oxipng -o4)                     │
│          │          └─ 极限(zopflipng)                       │
│          │                                                  │
│          │  ████████████████████░░░░  75%  处理中...          │
│          │                                                  │
│          │  📋 执行日志                                       │
│          │  ┌──────────────────────────────────────────┐    │
│          │  │ ✅ book1.epub  图片转换成功  输出至: /...   │    │
│          │  │ ⚠️ book2.epub  跳过(无WebP)               │    │
│          │  └──────────────────────────────────────────┘    │
└──────────┴──────────────────────────────────────────────────┘
```
 
**对比 epub_tool 的新增功能**：
- 图片压缩（三级：快速/标准/极限）
- 字体子集化（subset-font，减少字体体积 60-90%）
- 编辑模式入口（解压 → VS Code + Git 跟踪）
- 深色/浅色主题切换
- HTML5 原生拖拽（比 tkinterdnd2 更可靠）
- 实时 WebSocket 日志推送（比 tkinter 的 `after()` 轮询更高效）
 
### 4.4 Tauri 技术栈
 
| 层 | 技术 |
|----|------|
| 壳 | Tauri 2.x (Rust) |
| 前端 | React 18 + TailwindCSS + shadcn/ui + Vite |
| 前端通信 | `@tauri-apps/api` IPC |
| 后端逻辑 | Node.js (编译为 SEA 或 pkg 二进制) 作 sidecar |
| 构建 | `tauri build`（自动签名 + DMG/MSI/AppImage） |
| 自动更新 | `tauri-plugin-updater` |
 
---
 
## 五、项目结构
 
```text
epub-tools/
├── package.json                    # 根 monorepo（pnpm workspace）
├── pnpm-workspace.yaml
├── tsconfig.json
├── README.md
├── setup.sh / setup.ps1            # 一键安装所有依赖
│
├── packages/
│   ├── core/                       # 核心处理库（纯 TS，无 UI 依赖）
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # 统一导出
│   │       ├── epub/
│   │       │   ├── parser.ts       # EPUB 解析（jszip + fast-xml-parser）
│   │       │   ├── writer.ts       # EPUB 打包（mimetype STORE 模式）
│   │       │   └── reformat.ts     # 格式规范化（TS 重写 reformat_epub.py）
│   │       ├── image/
│   │       │   ├── webp-converter.ts   # WebP → JPG/PNG（sharp）
│   │       │   └── compressor.ts       # 图片压缩（jpegoptim/oxipng/zopflipng）
│   │       ├── font/
│   │       │   ├── subsetter.ts    # 字体子集化（subset-font）
│   │       │   └── encryptor.ts    # 字体混淆（桥接 Python encrypt_font.py）
│   │       ├── crypto/
│   │       │   ├── encrypt.ts      # 文件名加密（TS 重写 encrypt_epub.py）
│   │       │   └── decrypt.ts      # 文件名解密（TS 重写 decrypt_epub.py）
│   │       ├── edit/
│   │       │   ├── workspace.ts    # 解压 + git init + VS Code
│   │       │   ├── watcher.ts      # 文件监听 + 自动 commit
│   │       │   └── packer.ts       # 重新打包
│   │       ├── bridge/
│   │       │   └── python-runner.ts    # Python 脚本调用（仅字体混淆）
│   │       └── utils/
│   │           ├── logger.ts
│   │           ├── config.ts
│   │           └── tool-checker.ts     # 外部工具检测
│   │
│   ├── cli/                        # CLI 入口
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts            # commander 入口
│   │       └── commands/
│   │           ├── process.ts      # 一键流水线
│   │           ├── convert-webp.ts
│   │           ├── compress.ts
│   │           ├── reformat.ts
│   │           ├── encrypt.ts
│   │           ├── decrypt.ts
│   │           ├── encrypt-font.ts
│   │           ├── subset-fonts.ts
│   │           ├── edit.ts
│   │           ├── doctor.ts       # 依赖检测
│   │           └── gui.ts          # 启动 GUI（开发模式）
│   │
│   └── gui/                        # Tauri 桌面应用
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── src/                    # React 前端
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── components/
│       │   │   ├── FileList.tsx     # 文件列表（拖拽支持）
│       │   │   ├── ActionBar.tsx    # 功能按钮栏
│       │   │   ├── LogPanel.tsx     # 执行日志
│       │   │   ├── ProgressBar.tsx  # 进度条
│       │   │   └── SettingsDialog.tsx
│       │   ├── hooks/
│       │   │   ├── useEpubProcessor.ts
│       │   │   └── useTaskQueue.ts
│       │   └── lib/
│       │       └── tauri-bridge.ts  # Tauri IPC 封装
│       └── src-tauri/              # Rust 后端
│           ├── Cargo.toml
│           ├── tauri.conf.json
│           ├── src/
│           │   ├── main.rs
│           │   ├── commands.rs      # Tauri command handlers
│           │   └── sidecar.rs       # Node.js sidecar 管理
│           └── icons/
│
├── py-scripts/                     # Python 脚本（仅字体混淆）
│   ├── requirements.txt            # fonttools, beautifulsoup4, tinycss2
│   ├── encrypt_font.py             # 字体混淆（从 epub_tool 复制）
│   └── utils/
│       └── log.py
│
├── skills/                         # ⭐ 可复用独立脚本/工具集
│   ├── README.md                   # 使用说明 + 索引
│   ├── ts/                         # TypeScript 脚本
│   │   ├── batch-rename.ts         # EPUB 内文件批量重命名
│   │   ├── extract-toc.ts          # 提取目录结构为 JSON/Markdown
│   │   ├── find-broken-links.ts    # 检测 EPUB 内断链
│   │   ├── strip-metadata.ts       # 清除 EPUB 元数据
│   │   ├── epub-info.ts            # 打印 EPUB 基本信息
│   │   ├── image-audit.ts          # 图片尺寸/格式/体积审计
│   │   ├── css-cleanup.ts          # CSS 未使用规则清理
│   │   ├── charset-scan.ts         # 扫描使用的字符集
│   │   └── regex-replace.ts        # EPUB 内正则批量替换
│   └── py/                         # Python 脚本
│       ├── font-info.py            # 字体信息查看（fontTools）
│       ├── font-diff.py            # 对比两个字体的字形差异
│       └── glyph-preview.py        # 字形预览导出为图片
│
├── tests/
│   ├── fixtures/                   # 测试用 EPUB 文件
│   ├── core/                       # 核心库测试
│   ├── cli/                        # CLI 测试
│   └── skills/                     # Skills 测试
│
└── .github/workflows/
    ├── test.yml                    # 三平台测试
    └── release.yml                 # Tauri 构建 + Release
```
 
---
 
## 六、TS 重写各模块的详细策略
 
### 6.1 reformat_epub.py → `packages/core/src/epub/reformat.ts`
 
epub_tool 的 `reformat_epub.py` 核心逻辑：
1. 解析 `container.xml` → 定位 OPF
2. 解析 OPF `<manifest>` + `<spine>` → 分类文件（text/css/image/font/audio/video）
3. 重组为 Sigil 标准目录结构（`OEBPS/Text/`, `OEBPS/Styles/` 等）
4. 正则修复所有 `href`/`src`/`url()` 引用路径
5. 处理重复 ID、遗漏文件、大小写不匹配
 
**TS 实现方案**：
- `jszip` 解压/打包
- `fast-xml-parser` 解析 OPF/container.xml（比 DOM 快 10x）
- `cheerio` 解析 XHTML 修复链接引用
- `css-tree` 解析 CSS 修复 `url()` 路径
- 路径映射用 `Map<oldPath, newPath>` 统一管理
 
### 6.2 encrypt_epub.py / decrypt_epub.py → `packages/core/src/crypto/`
 
epub_tool 的文件名加密逻辑极其简单：
- MD5(id) → 转二进制 → `1`→`*`, `0`→`:` → 作为新文件名
- 解密时从 OPF item id 反推原始文件名
 
**TS 实现完全没有障碍**：
- `crypto.createHash('md5')` (Node.js 内置)
- 二进制字符串替换纯原生操作
- 模糊匹配可用 `string-similarity` 包替代 Python `SequenceMatcher`
 
### 6.3 transfer_img.py → `packages/core/src/image/webp-converter.ts`
 
epub_tool 的 WebP 转换逻辑：
1. 遍历 EPUB 中的 `.webp` 文件
2. 有透明度 → PNG（量化 256 色），无透明度 → JPEG
3. 更新 OPF manifest、HTML `<img>`/`<image>` 引用、CSS `url()` 引用
 
**TS 用 sharp 完全替代且更优**：
- sharp 底层是 libvips，WebP 解码速度是 Pillow 的 5-10x
- `sharp(buffer).metadata()` 检测透明通道（`hasAlpha`）
- 自动选择输出格式比 Pillow 更简洁
- OPF/HTML/CSS 引用更新复用 reformat 模块的路径替换逻辑
 
### 6.4 encrypt_font.py → `packages/core/src/font/encryptor.ts`（桥接 Python）
 
**继续调用 Python**，但封装为干净的 TS 接口：
 
```typescript
// 对外暴露的 TS 接口
export async function encryptFonts(epubPath: string, outPath: string): Promise<Result> {
  // 内部调用 Python
  return pythonRunner.exec('encrypt_font.py', [epubPath, outPath]);
}
```
 
Tauri 打包时，`encrypt_font.py` + `requirements.txt` 内嵌为 sidecar 资源。
用户无 Python 时此功能不可用，`doctor` 命令会提示。
 
---
 
## 七、技术栈清单
 
### 7.1 核心库（`packages/core`）
 
| 包 | 用途 |
|----|------|
| `sharp` | WebP/AVIF → PNG/JPG 图片格式转换 |
| `subset-font` | 字体子集化（HarfBuzz WASM，跨平台零依赖） |
| `cheerio` | HTML/XHTML 解析与操作 |
| `fast-xml-parser` | XML/OPF/container.xml 解析与序列化 |
| `css-tree` | CSS 解析（`@font-face`、`url()` 提取与修改） |
| `jszip` | EPUB ZIP 读写（支持 STORE 模式写 mimetype） |
| `simple-git` | Git 操作（编辑工作流） |
| `chokidar` | 文件监听（watch 模式） |
| `string-similarity` | 模糊字符串匹配（替代 Python SequenceMatcher） |
 
### 7.2 CLI（`packages/cli`）
 
| 包 | 用途 |
|----|------|
| `commander` | CLI 框架 |
| `ora` + `cli-progress` | 进度显示 |
| `consola` | 日志 |
 
### 7.3 GUI（`packages/gui`）
 
| 包 | 用途 |
|----|------|
| `@tauri-apps/cli` | Tauri 构建工具 |
| `@tauri-apps/api` | 前端 ↔ Rust IPC |
| `react` + `react-dom` | 前端框架 |
| `tailwindcss` + `@shadcn/ui` | UI 组件库 |
| `vite` | 前端构建 |
| `lucide-react` | 图标 |
 
### 7.4 外部 CLI 工具
 
| 工具 | 用途 | 必装？ |
|------|------|--------|
| `jpegoptim` | JPEG 无损优化 | 推荐 |
| `oxipng` | PNG 快速无损压缩 | 推荐 |
| `zopflipng` | PNG 极限无损压缩 | 可选 |
 
### 7.5 Python（仅字体混淆）
 
| 包 | 用途 |
|----|------|
| `fonttools` | 字体操作（TTFont, FontBuilder, TTGlyphPen） |
| `beautifulsoup4` | HTML 解析提取需加密的文本 |
| `tinycss2` | CSS 解析定位 @font-face 规则 |
 
---
 
## 八、CLI 设计
 
```bash
# === 一键处理 ===
epub-tools process book.epub -o output/ --convert-webp --compress --subset-fonts
epub-tools process ./books/ -o ./output/ --recursive
 
# === 单项功能 ===
epub-tools convert-webp book.epub -o output/
epub-tools compress book.epub -o output/ --level balanced  # fast|balanced|max
epub-tools subset-fonts book.epub -o output/
epub-tools reformat book.epub -o output/
epub-tools encrypt book.epub -o output/          # 文件名加密
epub-tools decrypt book.epub -o output/          # 文件名解密
epub-tools encrypt-font book.epub -o output/     # 字体混淆（需 Python）
 
# === 编辑工作流 ===
epub-tools edit book.epub                        # 解压 + git init + VS Code
epub-tools watch ~/.epub-workspace/book/         # 监听 + 自动 commit
epub-tools pack ~/.epub-workspace/book/ -o out.epub
 
# === Skills ===
epub-tools skill epub-info book.epub             # 运行 skill 脚本
epub-tools skill list                            # 列出可用 skills
epub-tools skill charset-scan book.epub          # 扫描字符集
 
# === 工具 ===
epub-tools doctor                                # 检查所有依赖
epub-tools gui                                   # 开发模式启动 GUI
```
 
---
 
## 九、Skills 目录设计
 
`skills/` 是独立可复用的小工具脚本，每个专注做一件事，可被 CLI 直接调用，也可作为 Copilot/AI 的参考模板。
 
### 9.1 TS Skills（`skills/ts/`）
 
| 脚本 | 功能 | 独立运行？ |
|------|------|-----------|
| `batch-rename.ts` | EPUB 内文件批量重命名（支持正则模式） | ✅ `npx tsx skills/ts/batch-rename.ts` |
| `extract-toc.ts` | 从 NCX/NAV 提取目录为 JSON/Markdown | ✅ |
| `find-broken-links.ts` | 检测 EPUB 内部断链 | ✅ |
| `strip-metadata.ts` | 清除 EPUB 敏感元数据 | ✅ |
| `epub-info.ts` | 打印 EPUB 基本信息（标题/作者/页数/图片数/字体数/体积） | ✅ |
| `image-audit.ts` | 图片尺寸/格式/体积审计报告 | ✅ |
| `css-cleanup.ts` | 检测并清理 CSS 未使用的规则 | ✅ |
| `charset-scan.ts` | 扫描 EPUB 使用的完整字符集 | ✅ |
| `regex-replace.ts` | EPUB 内容正则批量查找替换 | ✅ |
 
### 9.2 Python Skills（`skills/py/`）
 
| 脚本 | 功能 | 依赖 |
|------|------|------|
| `font-info.py` | 查看字体元信息（名称/字形数/支持语言/cmap） | fonttools |
| `font-diff.py` | 对比两个字体的字形覆盖差异 | fonttools |
| `glyph-preview.py` | 导出指定字形为 SVG/PNG 预览 | fonttools, Pillow |
 
### 9.3 Skills 统一接口
 
每个 skill 脚本遵循统一约定：
- 接受命令行参数（第一个参数通常是 EPUB 路径）
- 输出到 stdout（可管道组合）
- 退出码 0=成功, 1=失败
- 头部注释说明用途和用法
 
---
 
## 十、EPUB 编辑工作流
 
```text
epub-tools edit book.epub
  ▼
~/.epub-workspace/book/
  ├── .git/              ← git init + 首次 commit
  ├── .epub-meta.json    ← 原始文件路径、时间戳
  ├── mimetype / META-INF/ / OEBPS/
  ▼
epub-tools watch （chokidar 监听 + simple-git 自动 commit）
  ▼
epub-tools pack → book_edited.epub
```
 
---
 
## 十一、Tauri 桌面应用构建与分发
 
### 11.1 构建流程
 
```text
pnpm build:core          → packages/core/dist/
pnpm build:cli           → packages/cli/dist/ → node-sea 编译为二进制
pnpm build:gui-frontend  → packages/gui/dist/ (Vite 产物)
pnpm tauri build          → .app / .exe / .msi / .dmg / .AppImage
```
 
### 11.2 Sidecar 打包策略
 
Tauri 的 `tauri.conf.json` 配置 sidecar：
 
```text
tauri.conf.json → externalBin: ["binaries/epub-tools-core"]
                → resources: ["py-scripts/encrypt_font.py", "py-scripts/requirements.txt"]
```
 
- Node.js 核心库用 `node --experimental-sea-config` 编译为单文件二进制（Node 22+ 支持 Single Executable Application）
- Python 脚本作为资源文件内嵌，运行时使用系统 Python
 
### 11.3 CI/CD (GitHub Actions)
 
```yaml
strategy:
  matrix:
    include:
      - os: macos-latest
        target: aarch64-apple-darwin
      - os: macos-latest
        target: x86_64-apple-darwin
      - os: windows-latest
        target: x86_64-pc-windows-msvc
      - os: ubuntu-latest
        target: x86_64-unknown-linux-gnu
steps:
  - uses: actions/setup-node@v4
  - uses: dtolnay/rust-toolchain@stable
  - run: pnpm install && pnpm build
  - uses: tauri-apps/tauri-action@v0
    with:
      tagName: v__VERSION__
      releaseName: 'v__VERSION__'
```
 
产物：
- macOS: `.dmg` (Universal Binary, 支持 Intel + Apple Silicon)
- Windows: `.msi` + `.exe`
- Linux: `.AppImage` + `.deb`
 
---
 
## 十二、依赖环境要求
 
```text
必须：Node.js 22+
构建 GUI：Rust toolchain (rustup)
推荐：jpegoptim, oxipng（图片压缩）
可选：Python 3.9+（字体混淆功能）
可选：zopflipng（PNG 极限压缩）
```
 
对于**最终用户**（使用 Tauri 打包的桌面应用）：
- 无需安装 Node.js / Rust
- 字体混淆功能需要系统有 Python 3.9+
- 图片压缩功能需要安装 jpegoptim / oxipng（应用内提供一键安装引导）
 
---
 
## 十三、实施计划（按 Sprint）
 
### Sprint 1：Monorepo 骨架 + EPUB 核心（2 天）
 
- [ ] 初始化 pnpm workspace monorepo
- [ ] `packages/core`: EPUB 解析器（`jszip` + `fast-xml-parser`）
- [ ] `packages/core`: EPUB 打包器（mimetype STORE）
- [ ] `packages/cli`: 基础骨架 + `doctor` 命令
- [ ] `skills/` 目录初始化 + README
- [ ] 工具检测（`tool-checker.ts`）
 
### Sprint 2：TS 重写 — 图片 + 格式化 + 加解密（3-4 天）
 
- [ ] `epub/reformat.ts` — 重写 reformat_epub.py（最复杂，需仔细处理路径映射）
- [ ] `image/webp-converter.ts` — sharp WebP 转换 + 引用更新
- [ ] `image/compressor.ts` — jpegoptim/oxipng/zopflipng 封装
- [ ] `crypto/encrypt.ts` + `decrypt.ts` — 文件名加密解密
- [ ] CLI 命令对接：`reformat`, `convert-webp`, `compress`, `encrypt`, `decrypt`
- [ ] 测试：用 epub_tool 的输出做对比验证
 
### Sprint 3：字体处理 + Python 桥接（2 天）
 
- [ ] `font/subsetter.ts` — subset-font 字体子集化
- [ ] `font/encryptor.ts` + `bridge/python-runner.ts` — 桥接 encrypt_font.py
- [ ] 复制 encrypt_font.py 到 `py-scripts/`，精简依赖
- [ ] CLI 命令：`encrypt-font`, `subset-fonts`
- [ ] Python 依赖检测 + 友好报错
 
### Sprint 4：编辑工作流 + 一键流水线（2 天）
 
- [ ] `edit/workspace.ts` — 解压 + git init + VS Code
- [ ] `edit/watcher.ts` — chokidar + simple-git
- [ ] `edit/packer.ts` — 重新打包
- [ ] `process` 一键命令（串联所有步骤）
- [ ] 批量处理 `--recursive`
 
### Sprint 5：Skills 脚本（1-2 天）
 
- [ ] 实现 TS skills（至少 `epub-info`, `charset-scan`, `find-broken-links`）
- [ ] 实现 Python skills（`font-info.py`）
- [ ] CLI `skill` 子命令（运行/列出 skills）
 
### Sprint 6：Tauri GUI（4-5 天）
 
- [ ] Tauri 项目初始化 + React + TailwindCSS + shadcn/ui
- [ ] 前端组件：FileList（拖拽）、ActionBar、ProgressBar、LogPanel
- [ ] Rust 后端：IPC commands + sidecar 管理
- [ ] Node.js SEA 编译为 sidecar
- [ ] Tauri IPC 对接所有核心功能
- [ ] 深色/浅色主题
 
### Sprint 7：测试 + CI/CD + 文档（2 天）
 
- [ ] vitest 单元测试（core 模块）
- [ ] GitHub Actions：三平台测试 + Tauri 构建 + Release
- [ ] README（中英文）
- [ ] setup.sh / setup.ps1 一键安装
 
---
 
## 十四、图片无损压缩工具链（保留自 v1）
 
### JPEG 无损优化
 
| 工具 | 原理 | 压缩率 | 速度 |
|------|------|--------|------|
| **jpegoptim** ⭐ | Huffman 表优化 + 渐进式编码 + 剥离元数据 | 无损约 2-15% | 极快 |
| mozjpeg jpegtran | 更激进的 Huffman 优化 | 无损约 3-18% | 快 |
 
### PNG 无损压缩
 
| 工具 | 原理 | 压缩率 | 速度 |
|------|------|--------|------|
| **oxipng** ⭐日常 | 多线程 DEFLATE 重压缩 | 平均 10-25% | 快 |
| **zopflipng** ⭐极限 | Google Zopfli 暴力搜索 | 平均 25-40% | 极慢 |
 
策略不变：日常 `oxipng -o 4`，最终发布 `zopflipng`。
 
---
 
## 十五、Q&A
 
**Q: Tauri 需要 Rust，构建门槛高吗？**
开发时只需 `rustup` 一键安装。CI/CD 用 `tauri-apps/tauri-action` 全自动。用户下载产物无需 Rust。
 
**Q: Node.js SEA (Single Executable Application) 成熟吗？**
Node.js 22+ 已稳定支持。将 `packages/core` + `packages/cli` 编译为单文件二进制嵌入 Tauri。备选方案：`pkg`（vercel/pkg）或直接内嵌 Node.js runtime。
 
**Q: 没有 Python 时字体混淆不可用，用户体验怎么样？**
GUI 中「字体加密」按钮灰显 + tooltip 提示 "需要 Python 3.9+"。CLI 执行时打印安装指引。`doctor` 命令统一检测。
 
**Q: skills 目录的脚本和 core 库是什么关系？**
`core` 是可编程 API（被 CLI/GUI 调用），`skills` 是面向用户的即用脚本。skills 可以依赖 core，但 core 不依赖 skills。skills 也可以完全独立运行。
 
**Q: monorepo 而非单包的理由？**
`core` 必须独立于 UI 层 — Tauri sidecar 只需要 core+cli，GUI 前端在 Tauri WebView 中运行。分包保证依赖清晰、构建最优。