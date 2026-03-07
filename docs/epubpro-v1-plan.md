# EPUBPro V1 计划文档：Rust 核心架构与首版交付计划

Rust 核心引擎 + Tauri 2.x 桌面/移动端 + React 前端 + CLI 统一架构

> **本文档状态**：EPUBPro V1 计划版 - 2026-03-07 更新
> 本文档已从“v3 技术提案”收敛为“EPUBPro V1 交付计划”，用于后续按优先级推进工程。

> **命名约定（V1 阶段）**
> - 产品名：**EPUBPro**
> - 仓库名、crate 名、CLI 名：暂保留 `epub-tools` / `epub-core` / `epub-cli`
> - 原因：当前工程、workspace、包名、README、GUI/Tauri 配置仍大量使用旧命名，V1 先完成能力闭环，品牌统一放到发布前一轮处理

---

## 一、为什么要从 TS 迁移到 Rust 核心？

### 1.1 问题分析：v2 方案的架构矛盾

v2 方案选择了 **Tauri (Rust) 作 GUI 壳 + TypeScript 作核心逻辑**，这导致了一个尴尬的架构：

```text
v2 当前架构问题：

  Tauri (Rust)                    Node.js (TS)
  ┌──────────┐    sidecar/IPC    ┌──────────────┐
  │ GUI 壳    │ ◄──────────────► │ 核心处理逻辑  │
  │ 文件对话框 │                   │ EPUB 解析    │
  │ 系统 API  │                   │ 图片压缩     │
  └──────────┘                    │ 加解密       │
       ↕                          └──────────────┘
   React 前端                      ↕ Python 桥接
                                  encrypt_font.py
```

**核心矛盾**：
1. **双运行时开销**：Tauri 已包含 Rust，还要额外打包 Node.js SEA（~50MB+）
2. **IPC 性能瓶颈**：Rust ↔ Node.js 进程间通信增加延迟和复杂度
3. **移动端困境**：iOS/Android 上运行 Node.js sidecar 极其困难且体积巨大
4. **分发体积**：Tauri 本体 ~5MB + Node.js SEA ~50MB = 实际 55MB+（远超 "10-15MB" 预期）

### 1.2 解决方案：Rust 统一核心

```text
v3 目标架构：

  Tauri 2.x (Rust)
  ┌──────────────────────────────────────┐
  │         Rust 核心引擎                 │
  │  ┌────────┬────────┬──────────────┐  │
  │  │ EPUB   │ 图片   │ 字体处理      │  │
  │  │ 解析   │ 转换   │ 子集化+混淆   │  │
  │  │ 打包   │ 压缩   │              │  │
  │  └────────┴────────┴──────────────┘  │
  │         Tauri IPC (invoke)           │
  │  ┌──────────────────────────────┐    │
  │  │  React 前端 (WebView)         │    │
  │  └──────────────────────────────┘    │
  └──────────────────────────────────────┘
          ↕               ↕
      桌面 App         移动 App
   (macOS/Win/Linux)   (iOS/Android)
```

### 1.3 TS vs Rust 详细对比

| 维度 | TypeScript (v2 当前) | Rust (v3 提案) | 结论 |
|------|---------------------|---------------|------|
| **运行时** | Node.js 22+ (~50MB) | 无额外运行时 (0MB) | ✅ Rust |
| **Tauri 集成** | 需 sidecar + IPC | 直接集成，零开销 | ✅ Rust |
| **移动端** | Node.js 无法在 iOS/Android 运行 | Tauri 2.x 原生支持 | ✅ Rust |
| **性能** | V8 JIT，不错但有 GC 停顿 | 零成本抽象，无 GC | ✅ Rust |
| **打包体积** | Tauri + Node SEA ~55MB | 纯 Tauri ~5-8MB | ✅ Rust |
| **EPUB 库** | jszip, fast-xml-parser (成熟) | lib-epub, quick-xml, zip (成熟) | 平手 |
| **图片库** | sharp (libvips, 很快) | image crate + WebP (原生) | 平手 |
| **HTML 操作** | cheerio (jQuery-like, 成熟) | scraper + html5ever (成熟) | 平手 |
| **CSS 操作** | css-tree (成熟) | lightningcss (更快) | ✅ Rust |
| **字体子集化** | subset-font (JS) | allsorts / font_subset (原生) | ✅ Rust |
| **字体混淆** | 桥接 Python fontTools | allsorts 可做部分操作 | ⚠️ 需评估 |
| **简繁转换** | opencc-js (成熟) | opencc-rust 绑定 | 平手 |
| **开发速度** | 快，原型迭代快 | 较慢，编译时间长 | ✅ TS |
| **学习曲线** | 低 | 高（所有权、生命周期） | ✅ TS |
| **生态成熟度** | npm 极其丰富 | crates.io 快速增长 | ✅ TS |
| **CLI 工具** | commander.js (简单) | clap (功能更强) | ✅ Rust |
| **跨平台一致性** | 各平台 Node.js 行为一致 | 编译为原生，性能最优 | ✅ Rust |

### 1.4 关键决策因素

**选择 Rust 核心的根本原因**：

1. **移动端是刚需** — 用户明确希望"简单核心功能下放到移动端"，Node.js 在 iOS/Android 上不可行
2. **Tauri 2.x 已原生支持移动端** — iOS (WKWebView) + Android (WebView)，Rust 后端直接复用
3. **消除 sidecar 架构** — 不再需要 Node.js SEA 打包，大幅降低复杂度和体积
4. **Rust 生态已足够成熟** — EPUB、图片、字体、HTML/CSS 处理都有可靠的 crate

---

## 二、v3 总体架构

### 2.1 架构图

```text
┌──────────────────────────────────────────────────────────────┐
│                      用户界面层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ CLI (clap)    │  │ Desktop GUI  │  │ Mobile App        │  │
│  │ epub-tools    │  │ Tauri 2.x    │  │ Tauri 2.x         │  │
│  │ 终端直接使用   │  │ macOS/Win/   │  │ iOS/Android       │  │
│  │              │  │ Linux        │  │ 精简功能子集       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         └─────────────┬───┴───────────────────┘              │
│                       ▼                                      │
│        ┌──────────────────────────────────┐                  │
│        │  epub-core (Rust lib crate)      │ ← 核心库         │
│        │  一次编写，桌面/移动/CLI 共用      │                  │
│        ├──────────────────────────────────┤                  │
│        │  epub/     EPUB 解析/打包/重构    │                  │
│        │  image/    图片转换/压缩          │                  │
│        │  font/     字体子集化/混淆        │                  │
│        │  crypto/   文件名加密/解密        │                  │
│        │  txt/      TXT→EPUB 转换         │                  │
│        │  chinese/  简繁转换              │                  │
│        │  edit/     编辑工作流             │ ← 仅桌面/CLI      │
│        └──────────────────────────────────┘                  │
│                       │                                      │
│        ┌──────────────┼──────────────────┐                   │
│        ▼              ▼                  ▼                   │
│   Rust 原生 crate   系统 API          可选外部工具            │
│   · lib-epub        · 文件系统         · jpegoptim            │
│   · image           · 网络请求         · oxipng               │
│   · quick-xml       · 进程管理                               │
│   · scraper                                                  │
│   · lightningcss                                             │
│   · allsorts                                                 │
│   · zip                                                      │
│   · clap                                                     │
│   · opencc-rust                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 核心设计原则

1. **Rust 做核心** — EPUB 解析/打包、加解密、图片处理、格式化等全部 Rust 实现
2. **一次编写，多端运行** — `epub-core` 是纯 Rust lib crate，桌面/移动/CLI 共用
3. **渐进式功能** — 移动端只提供核心子集（格式化、加解密、图片转换）
4. **字体混淆保留 Python** — `encrypt_font.py` 继续使用 Python fontTools，仅在桌面端和 CLI 通过进程调用（与图片极限压缩工具 jpegoptim/oxipng 类似，属于桌面/CLI 专属功能）
5. **CLI 独立可用** — CLI 是一等公民，不依赖 GUI

---

## 三、Rust Crate 技术栈映射

### 3.1 核心处理库 (`epub-core`)

| 功能模块 | v2 (TS) 方案 | v3 (Rust) crate | 说明 |
|---------|-------------|-----------------|------|
| **ZIP 读写** | `jszip` | `zip` | Rust 原生 ZIP 库，支持 STORE/DEFLATE |
| **XML 解析** | `fast-xml-parser` | `quick-xml` | 零拷贝高速 XML 解析 |
| **HTML 操作** | `cheerio` | `scraper` + `html5ever` | CSS 选择器 + HTML5 解析 |
| **CSS 解析** | `css-tree` | `lightningcss` | Mozilla 出品，比 css-tree 更快 |
| **EPUB 解析** | 自定义 `parser.ts` | `lib-epub` 或自定义 | 可用 lib-epub，也可基于 quick-xml 自写 |
| **图片处理** | `sharp` (libvips) | `image` crate | 支持 JPEG/PNG/WebP/GIF 编解码 |
| **字体子集化** | `subset-font` (JS) | `allsorts` | 支持 OpenType/WOFF/WOFF2 子集化 |
| **字体混淆** | Python `fonttools` | **保留 Python** (`encrypt_font.py`) | 桌面/CLI 专属，通过进程调用 Python |
| **加解密** | Node `crypto` | `md5` + Rust 标准库 | MD5 哈希 + 字符串操作 |
| **模糊匹配** | `string-similarity-js` | `strsim` | 编辑距离/相似度计算 |
| **简繁转换** | `opencc-js` | `opencc-rust` 或内嵌词典 | OpenCC Rust 绑定 |
| **Git 操作** | `simple-git` | `git2` (libgit2) | 原生 Git 操作，无需系统 git |
| **文件监听** | `chokidar` | `notify` | 跨平台文件系统事件监听 |
| **HTTP 请求** | `axios` | `reqwest` | async HTTP 客户端 |
| **日志** | `consola` | `tracing` + `tracing-subscriber` | 结构化日志，支持多输出 |
| **CLI 框架** | `commander.js` | `clap` | 声明式 CLI，自动生成帮助 |
| **序列化** | JSON.parse/stringify | `serde` + `serde_json` | 零成本序列化/反序列化 |
| **异步运行时** | Node.js event loop | `tokio` | 高性能异步运行时 |

### 3.2 GUI 层

| 组件 | v2 方案 | v3 方案 | 变化 |
|------|--------|--------|------|
| **GUI 框架** | Tauri 2.x | Tauri 2.x | **不变** |
| **前端框架** | React 18 + shadcn/ui | React 18 + shadcn/ui | **不变** |
| **样式** | TailwindCSS | TailwindCSS | **不变** |
| **后端调用** | Tauri → Node.js sidecar | Tauri → 直接 Rust 函数 | ✅ **简化** |
| **进度回调** | WebSocket / IPC | Tauri event system | ✅ **简化** |

### 3.3 测试

| 工具 | v2 (TS) | v3 (Rust) | 说明 |
|------|--------|-----------|------|
| **单元测试** | vitest | `#[cfg(test)]` + cargo test | Rust 内置测试框架 |
| **属性测试** | fast-check | `proptest` / `quickcheck` | Rust 属性测试 crate |
| **集成测试** | vitest | `tests/` 目录 | cargo test 自动发现 |
| **基准测试** | 无 | `criterion` | 性能回归测试 |

---

## 四、项目结构 (v3)

```text
epub-tools/
├── Cargo.toml                     # Workspace root
├── Cargo.lock
├── rust-toolchain.toml            # Rust 版本锁定
├── .mise.toml                     # 开发工具版本管理
│
├── crates/
│   ├── epub-core/                 # 🔧 核心处理库（纯 Rust lib crate）
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs             # 统一导出
│   │       ├── epub/
│   │       │   ├── mod.rs
│   │       │   ├── parser.rs      # EPUB 解析 (quick-xml + zip)
│   │       │   ├── writer.rs      # EPUB 打包 (mimetype STORE)
│   │       │   ├── reformat.rs    # 格式规范化 (Sigil 标准结构)
│   │       │   └── upgrade.rs     # EPUB2 → EPUB3 升级
│   │       ├── image/
│   │       │   ├── mod.rs
│   │       │   ├── webp_converter.rs  # WebP ↔ JPG/PNG
│   │       │   ├── compressor.rs      # 图片压缩
│   │       │   └── download_remote.rs # 下载远程图片
│   │       ├── font/
│   │       │   ├── mod.rs
│   │       │   ├── subsetter.rs   # 字体子集化 (allsorts)
│   │       │   └── obfuscator.rs  # 字体混淆 (调用 Python encrypt_font.py，桌面/CLI 专属)
│   │       ├── crypto/
│   │       │   ├── mod.rs
│   │       │   ├── encrypt.rs     # 文件名加密
│   │       │   └── decrypt.rs     # 文件名解密
│   │       ├── txt/
│   │       │   ├── mod.rs
│   │       │   ├── parser.rs      # TXT 解析
│   │       │   ├── chapter_splitter.rs  # 章节分割
│   │       │   └── epub_creator.rs     # 生成 EPUB
│   │       ├── chinese/
│   │       │   ├── mod.rs
│   │       │   └── converter.rs   # 简繁转换
│   │       ├── edit/              # 仅桌面/CLI
│   │       │   ├── mod.rs
│   │       │   ├── workspace.rs   # Git 工作区
│   │       │   ├── watcher.rs     # 文件监听
│   │       │   └── packer.rs      # 打包
│   │       └── utils/
│   │           ├── mod.rs
│   │           ├── logger.rs      # 日志 (tracing)
│   │           ├── config.rs      # 配置管理
│   │           └── tool_checker.rs # 工具检测
│   │
│   └── epub-cli/                  # 🖥️ CLI 入口
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs
│           └── commands/
│               ├── mod.rs
│               ├── process.rs     # 一键处理
│               ├── reformat.rs    # 格式化
│               ├── encrypt.rs     # 加密
│               ├── decrypt.rs     # 解密
│               ├── convert_webp.rs # WebP 转换
│               ├── compress.rs    # 图片压缩
│               ├── subset_fonts.rs # 字体子集化
│               ├── obfuscate_font.rs # 字体混淆
│               ├── txt_to_epub.rs # TXT 转 EPUB
│               ├── chinese_convert.rs # 简繁转换
│               ├── download_images.rs # 下载远程图片
│               ├── edit.rs        # 编辑工作流
│               └── doctor.rs      # 环境检测
│
├── packages/
│   ├── gui/                       # 🖼️ Tauri 桌面应用
│   │   ├── package.json           # React 前端依赖
│   │   ├── vite.config.ts
│   │   ├── src/                   # React 前端
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   │   ├── FileList.tsx
│   │   │   │   ├── ActionBar.tsx
│   │   │   │   ├── LogPanel.tsx
│   │   │   │   ├── ProgressBar.tsx
│   │   │   │   └── SettingsDialog.tsx
│   │   │   └── lib/
│   │   │       └── tauri-bridge.ts # Tauri IPC 调用封装
│   │   └── src-tauri/             # Rust 后端
│   │       ├── Cargo.toml         # 依赖 epub-core
│   │       ├── tauri.conf.json
│   │       └── src/
│   │           ├── main.rs
│   │           ├── lib.rs
│   │           └── commands.rs    # 直接调用 epub-core
│   │
│   └── mobile/                    # 📱 Tauri 移动端应用
│       ├── package.json
│       ├── vite.config.ts
│       ├── src/                   # React 前端（精简版）
│       │   ├── App.tsx
│       │   └── components/
│       │       ├── FileList.tsx
│       │       ├── QuickActions.tsx  # 移动端快捷操作
│       │       └── ResultView.tsx
│       └── src-tauri/             # Rust 后端
│           ├── Cargo.toml         # 依赖 epub-core (features = ["mobile"])
│           ├── tauri.conf.json
│           └── src/
│               ├── lib.rs         # Tauri mobile entry
│               └── commands.rs    # 移动端命令子集
│
├── py-scripts/                    # Python (字体混淆，桌面/CLI 专属)
│   ├── requirements.txt
│   └── encrypt_font.py            # 字体混淆（通过进程调用）
│
├── skills/                        # 可复用独立脚本
│   ├── README.md
│   └── rs/                        # Rust skills (替代 ts/)
│       ├── epub-info.rs
│       ├── charset-scan.rs
│       ├── find-broken-links.rs
│       ├── regex-annotate.rs
│       ├── merge-epub.rs
│       └── split-epub.rs
│
├── docs/
│   ├── archive/
│   │   ├── plan-epubToolsV2.prompt.md
│   │   └── plan-epubToolsV2-updated.md
│   ├── epubpro-v1-plan.md               # ⭐ 本文档
│   └── comparison-with-wangyyyqw-epub.md
│
└── tests/
    ├── fixtures/                   # 测试用 EPUB 文件
    └── integration/                # 集成测试
```

---

## 五、功能与平台矩阵

### 5.1 功能分级

| 功能 | 桌面 (Desktop) | CLI | 移动端 (Mobile) | 优先级 |
|------|:---:|:---:|:---:|:---:|
| EPUB 格式化 (reformat) | ✅ | ✅ | ✅ | P0 |
| 文件名加密 (encrypt) | ✅ | ✅ | ✅ | P0 |
| 文件名解密 (decrypt) | ✅ | ✅ | ✅ | P0 |
| WebP 图片转换 | ✅ | ✅ | ✅ | P0 |
| 图片压缩 | ✅ | ✅ | ✅ | P0 |
| EPUB2→3 升级 | ✅ | ✅ | ✅ | P1 |
| TXT → EPUB | ✅ | ✅ | ✅ | P1 |
| 简繁转换 | ✅ | ✅ | ✅ | P1 |
| 字体子集化 | ✅ | ✅ | ❌ | P1 |
| 字体混淆 | ✅ | ✅ | ❌ | P2 |
| 下载远程图片 | ✅ | ✅ | ❌ | P2 |
| 编辑工作流 (Git) | ✅ | ✅ | ❌ | P2 |
| EPUB 合并/拆分 | ✅ | ✅ | ❌ | P2 |
| 正则注释/脚注 | ✅ | ✅ | ❌ | P3 |

### 5.2 移动端功能子集说明

移动端仅提供 **P0 + P1 核心功能**，理由：
- 移动端存储/内存有限，排除大文件操作（字体、Git）
- 移动端操作简洁化，排除复杂编辑流程
- 简繁转换和 TXT→EPUB 是中文用户高频需求，保留

### 5.3 移动端架构选型：Tauri vs Flutter vs 更通用方案

围绕本项目的真实需求，决策重点不是“谁更流行”，而是：
- 是否要复用现有 React + Tauri 前端资产
- 是否要让 Rust 核心在桌面、CLI、移动端真正共用
- 是否把移动端定位为“核心处理工具”，而不是复杂交互型内容编辑器

| 方案 | 优势 | 劣势 | 适合本项目吗？ |
|------|------|------|---------------|
| **Tauri 2.x + Rust core + React** | 复用现有技术栈；桌面/移动共用一套 Rust 核心；工程统一；CLI/GUI/移动端边界清晰 | 移动端生态仍弱于 Flutter；复杂原生交互、动画、长列表体验需要额外打磨 | **推荐作为默认路线** |
| **Flutter + Rust core** | 移动端生态成熟；UI/动画/手势体验更强；插件和移动端经验更丰富 | 需要新增 Dart 技术栈；桌面现有 React/Tauri 资产难复用；工程分裂为 Flutter + Tauri/CLI | **仅在“移动端优先”时考虑** |
| **原生 iOS/Android + Rust core** | 性能和平台能力最强；原生集成最彻底 | 开发成本最高；维护两套 UI；与当前项目不匹配 | **不建议当前阶段采用** |
| **纯 Rust core + 可替换壳层** | 最通用；可先接 Tauri，后续也能接 Flutter/原生；核心代码投资最稳 | 前期需要更严格地抽象边界与 API | **架构层面最推荐** |

**建议结论**：

1. **当前阶段继续选择 Tauri，不建议切 Flutter**。
2. **真正要锁定的不是 Tauri，而是 Rust core 的独立性**。
3. **移动端如果只是下放“格式化、加解密、图片处理、TXT→EPUB、简繁转换”这类工具能力，Tauri 足够。**
4. **只有在你准备把移动端做成长期主战场，并且对 UI 流畅度、复杂交互、系统级插件依赖很重时，才值得切到 Flutter。**

换句话说，**更好的方案不是现在在 Tauri 和 Flutter 二选一，而是先把 `epub-core` 做成真正可移植的 Rust 核心库，再让 UI 壳层保持可替换**。这样即使未来移动端改走 Flutter，也只是换壳，不是推翻重来。

### 5.4 移动端图片无损压缩策略

图片无损压缩要拆成两类看：

| 场景 | 最佳策略 | 原因 |
|------|----------|------|
| **桌面 / CLI** | 优先调用 `oxipng`、`zopflipng`、`jpegoptim` 等外部工具 | 压缩率更高，工具成熟，适合批处理 |
| **移动端** | 优先使用 **Rust 内置无损优化**，避免依赖外部命令行工具 | iOS/Android 无法像桌面一样稳定调用系统工具，分发和审核也更复杂 |

**移动端建议不要照搬桌面端“外部工具优先”的思路。** 更稳妥的策略是：

1. **PNG 无损优化**：优先做 Rust 内部重编码、去元数据、过滤器优化。
2. **JPEG 无损优化**：移动端只做安全的元数据剥离和可验证的无损重写；不要一开始就追求桌面级极限压缩率。
3. **WebP/PNG/JPEG 转换**：转换属于“格式变换”，不一定无损，要和“压缩”在 UI 和实现上分开。
4. **极限压缩**：保留给桌面/CLI，移动端不做第一优先级。

### 5.5 图片压缩的分层实现建议

为避免一个方案硬套三端，建议拆成三级：

#### Level A：全平台基础压缩（桌面 / CLI / 移动端共用）

- Rust 纯实现
- 去除 EXIF / ICC / 无关 metadata
- PNG 重新编码
- JPEG 安全重写
- WebP 有损/无损转换开关

这一级应进入 `epub-core`，保证三端都能跑。

#### Level B：桌面增强压缩（桌面 / CLI）

- 检测 `oxipng` / `zopflipng` / `jpegoptim` 是否存在
- 若存在，则对基础压缩结果继续做二次优化
- 若不存在，则自动回退到 Level A

这一级不应进入移动端 feature。

#### Level C：策略调度层

建议给用户暴露三个压缩档位：

| 档位 | 行为 |
|------|------|
| `safe` | 只做 Rust 内置、确定性、安全的压缩 |
| `balanced` | Rust 内置 + 桌面端可用时调用 `oxipng` / `jpegoptim` |
| `max` | 桌面端启用更慢但压缩率更高的外部工具链 |

**推荐默认档位**：
- 移动端默认 `safe`
- 桌面端默认 `balanced`
- CLI 允许用户显式选择 `max`

### 5.6 关于“Rust 核心是否可以直接编译到 iOS/Android”

可以，而且这正是本项目最合理的方向。

`epub-core` 作为纯 Rust crate，可以被：
- Tauri 桌面端直接调用
- Tauri mobile 的 iOS/Android 包直接调用
- 未来如有需要，通过 FFI / UniFFI / flutter_rust_bridge 暴露给 Flutter 或原生壳层

这意味着：

1. **Rust 核心不是桌面专属，它本身就可以成为 iOS 和 Android 的共享业务层。**
2. **真正要避免的是把业务逻辑写死在某个 UI 框架里。**
3. **最通用的方式不是“全押 Flutter”或“全押 Tauri”，而是“Rust core + 可替换前端壳层”。**

因此，本项目的推荐架构应明确为：

```text
epub-core (Rust)
  ├─ epub-cli                 # 直接链接
  ├─ Tauri Desktop            # 直接链接
  ├─ Tauri Mobile             # 直接链接
  └─ 可选 Flutter / Native    # 后续通过绑定接入
```

这比“现在就决定 Flutter 或 Tauri 谁是唯一真理”更稳。

### 5.7 桌面端如何“内置外部图片压缩工具”

如果目标是**避免用户自己安装 `oxipng` / `jpegoptim`**，可以做，但应只针对**桌面端**，不要把这套思路延伸到移动端。

推荐分成三种分发模式：

| 模式 | 做法 | 优点 | 风险/成本 | 建议 |
|------|------|------|-----------|------|
| **系统工具模式** | 运行时查找系统已安装工具 | 包体最小 | 用户需要自行安装 | 保留为后备 |
| **应用内置模式** | 将平台对应二进制放入 App bundle/resources，首次运行时释放到内部目录后调用 | 用户开箱即用；体验最好 | 包体增大；需处理签名、权限、升级 | **桌面端推荐** |
| **首次下载模式** | 首次使用时按平台下载工具包并校验 hash | 主安装包更小 | 首次使用依赖网络；缓存和校验复杂 | 作为可选增强 |

**本项目推荐策略**：

1. **CLI**：默认使用系统工具模式。
2. **Desktop GUI**：优先使用应用内置模式，做到用户无需手动安装。
3. **Mobile**：完全不依赖外部工具，只用 Rust 内置 `safe` 档压缩。

#### 桌面端内置工具的实现方式

建议不要把外部工具“编进 Rust 二进制本体”，而是：

1. 将工具按平台分别放入应用资源目录。
2. 启动时检测当前平台和 CPU 架构。
3. 将资源复制或解压到应用私有数据目录。
4. 校验版本与 hash。
5. 通过 `std::process::Command` 调用。

建议资源结构：

```text
packages/gui/src-tauri/
├── binaries/
│   ├── macos-aarch64/
│   │   ├── oxipng
│   │   └── jpegoptim
│   ├── macos-x86_64/
│   │   ├── oxipng
│   │   └── jpegoptim
│   ├── windows-x86_64/
│   │   ├── oxipng.exe
│   │   └── jpegoptim.exe
│   └── linux-x86_64/
│       ├── oxipng
│       └── jpegoptim
└── capabilities/
```

建议运行时释放目录：

```text
macOS:   ~/Library/Application Support/com.epub-tools.app/tools/
Windows: %AppData%/com.epub-tools.app/tools/
Linux:   ~/.local/share/com.epub-tools.app/tools/
```

#### 内置外部工具的注意事项

1. **只内置桌面端真正需要的工具**，优先 `oxipng`，JPEG 工具谨慎引入。
2. **每个工具都要单独做 license 审核**，不要先打包后补合规。
3. **要有回退链路**：内置工具不可用时自动退回 Rust `safe` 档。
4. **要记录工具来源、版本、hash、目标平台**，否则后续升级会很乱。
5. **macOS 签名与 notarization**、Windows Defender、Linux 发行版兼容性都要提前验证。

#### 结论

“内置外部图片压缩工具”是合理的，但应被视为**桌面增强能力**，而不是核心基础能力。核心基础能力仍应由 `epub-core` 的纯 Rust 压缩流水线提供。

---

## 六、字体混淆方案（保留 Python）

### 6.1 决策：字体混淆保留 Python 实现

`encrypt_font.py` 使用 Python fontTools 库进行复杂的字体操作（CMap 操作、Glyph 复制、
字体构建），这些操作在 Rust 生态中尚无完全等价的成熟方案。

**决策**：字体混淆**保留 Python 实现**，与图片极限压缩工具（jpegoptim/oxipng）一样，
属于**桌面端和 CLI 专属功能**，通过进程调用 Python 脚本完成。

### 6.2 调用方式

```rust
// crates/epub-core/src/font/obfuscator.rs
// 桌面端/CLI: 通过 std::process::Command 调用 Python
pub fn obfuscate_font(epub_path: &str, output_path: &str) -> Result<()> {
    let status = std::process::Command::new("python3")
        .args(&["py-scripts/encrypt_font.py", epub_path, "-o", output_path])
        .status()?;
    // ...
}
```

### 6.3 平台可用性

| 功能 | 桌面 (Desktop) | CLI | 移动端 (Mobile) | 依赖 |
|------|:---:|:---:|:---:|------|
| 字体混淆 | ✅ | ✅ | ❌ | Python 3.9+ + fontTools |
| 图片极限压缩 | ✅ | ✅ | ❌ | jpegoptim / oxipng |
| 字体子集化 | ✅ | ✅ | ❌ | Rust allsorts (内置) |

> 这些功能在移动端不可用，因为移动端无法运行 Python 或系统命令行工具。

---

## 七、CLI 设计 (v3)

```bash
# === 编译安装 ===
cargo install epub-tools      # 从 crates.io 安装
# 或
cargo build --release         # 本地构建
# 输出: target/release/epub-tools (单二进制，约 5-10MB)

# === 一键处理 ===
epub-tools process book.epub -o output/ --convert-webp --compress --subset-fonts

# === 单项功能 ===
epub-tools reformat book.epub -o output/
epub-tools encrypt book.epub -o output/
epub-tools decrypt book.epub -o output/
epub-tools convert-webp book.epub -o output/
epub-tools compress book.epub -o output/ --level balanced
epub-tools subset-fonts book.epub -o output/
epub-tools obfuscate-font book.epub -o output/
epub-tools upgrade book.epub -o output/ --target 3.3

# === 新增功能 ===
epub-tools txt-to-epub book.txt -o book.epub
epub-tools chinese-convert book.epub -o output/ --to traditional
epub-tools download-images book.epub -o output/

# === 编辑工作流 ===
epub-tools edit book.epub
epub-tools watch ~/.epub-workspace/book/
epub-tools pack ~/.epub-workspace/book/ -o out.epub

# === 工具 ===
epub-tools doctor                  # 环境检测
epub-tools info book.epub          # EPUB 信息
epub-tools merge a.epub b.epub -o merged.epub
epub-tools split book.epub -o output/

# === Shell 补全 ===
epub-tools completions bash > ~/.bash_completion.d/epub-tools
epub-tools completions zsh > ~/.zfunc/_epub-tools
epub-tools completions fish > ~/.config/fish/completions/epub-tools.fish
```

**CLI 优势（对比 v2 TS CLI）**：
- **单二进制**：`cargo install` 或直接下载，无需 Node.js/pnpm
- **启动速度**：~1ms（Rust）vs ~200ms（Node.js）
- **Shell 补全**：clap 自动生成
- **交叉编译**：`cross` 工具一键编译所有平台

---

## 八、GUI 布局 (v3)

### 8.1 桌面端

```text
┌─────────────────────────────────────────────────────────────┐
│  EPUB Tools v3                                 [设置] [主题] │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│  侧边栏   │  📂 待处理文件                                    │
│          │  ┌──────────────────────────────────────────┐    │
│ [添加文件] │  │  #  文件名           路径              状态  │    │
│ [添加文件夹]│  │  1  book1.epub      /Users/.../book1  待处理│    │
│ [清空列表] │  │  2  novel.txt       /Users/.../novel   待处理│    │
│          │  └──────────────────────────────────────────┘    │
│ ──────── │                                                  │
│          │  📁 输出路径: [默认: 源文件同级目录] [选择] [重置]   │
│ 使用说明  │                                                  │
│ · 拖拽添加│  🔧 操作                                          │
│ · 右键菜单│  ┌──────────── 基础功能 ──────────────────────┐  │
│ · TXT文件 │  │[格式化] [解密] [加密] [字体混淆]            │  │
│          │  │[图片转换] [图片压缩▾] [字体子集化] [升级]    │  │
│ GitHub ↗ │  └──────────────────────────────────────────────┘│
│          │  ┌──────────── 扩展功能 ──────────────────────┐  │
│ ⚡ Rust   │  │[TXT→EPUB] [简繁转换] [下载远程图片]        │  │
│   核心    │  │[EPUB合并] [EPUB拆分] [正则注释]            │  │
│          │  └──────────────────────────────────────────────┘│
│          │                                                  │
│          │  ████████████████████░░░░  75%  处理中...          │
│          │                                                  │
│          │  📋 执行日志                                       │
│          │  ┌──────────────────────────────────────────┐    │
│          │  │ ✅ book1.epub  格式化成功 (12ms)           │    │
│          │  │ ✅ novel.txt   转换为 EPUB 成功 (8ms)      │    │
│          │  └──────────────────────────────────────────┘    │
└──────────┴──────────────────────────────────────────────────┘
```

### 8.2 移动端（精简版）

```text
┌──────────────────────────┐
│  EPUB Tools              │
│  ─────────────────────── │
│                          │
│  📂 选择文件              │
│  ┌──────────────────┐    │
│  │ book.epub    ✅   │    │
│  └──────────────────┘    │
│                          │
│  ⚡ 快捷操作              │
│  ┌────────┐┌────────┐   │
│  │ 格式化  ││ 解密   │   │
│  └────────┘└────────┘   │
│  ┌────────┐┌────────┐   │
│  │ 加密   ││图片转换 │   │
│  └────────┘└────────┘   │
│  ┌────────┐┌────────┐   │
│  │ 压缩   ││简繁转换 │   │
│  └────────┘└────────┘   │
│  ┌──────────────────┐   │
│  │   TXT → EPUB     │   │
│  └──────────────────┘   │
│                          │
│  📋 结果                  │
│  ┌──────────────────┐   │
│  │ ✅ 处理成功        │   │
│  │ 输出: book_r.epub │   │
│  │ [分享] [打开]     │   │
│  └──────────────────┘   │
└──────────────────────────┘
```

---

## 九、Tauri 2.x 后端实现示例

### 9.1 桌面端 Tauri Command（直接调用 Rust 核心）

```rust
// packages/gui/src-tauri/src/commands.rs
use epub_core::{epub, image, crypto, txt, chinese};
use serde::{Deserialize, Serialize};
use tauri::Emitter; // 用于进度事件

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessResult {
    pub success: bool,
    pub message: String,
    pub output_path: Option<String>,
    pub elapsed_ms: u64,
}

/// 格式化 EPUB
#[tauri::command]
pub async fn reformat_epub(
    file_path: String,
    output_path: String,
    app: tauri::AppHandle,
) -> Result<ProcessResult, String> {
    let start = std::time::Instant::now();

    // 直接调用 Rust 核心库，零 IPC 开销！
    let result = epub::reformat::reformat(&file_path, &output_path)
        .map_err(|e| e.to_string())?;

    // 通过 Tauri 事件系统向前端发送进度
    let _ = app.emit("epub-progress", &result);

    Ok(ProcessResult {
        success: true,
        message: format!("格式化成功：{} 个文件已重组", result.files_moved),
        output_path: Some(output_path),
        elapsed_ms: start.elapsed().as_millis() as u64,
    })
}

/// WebP 图片转换
#[tauri::command]
pub async fn convert_webp(
    file_path: String,
    output_path: String,
) -> Result<ProcessResult, String> {
    let start = std::time::Instant::now();

    let result = image::webp_converter::convert(&file_path, &output_path)
        .map_err(|e| e.to_string())?;

    Ok(ProcessResult {
        success: true,
        message: format!("转换 {} 张图片", result.converted),
        output_path: Some(output_path),
        elapsed_ms: start.elapsed().as_millis() as u64,
    })
}

/// TXT 转 EPUB
#[tauri::command]
pub async fn txt_to_epub(
    file_path: String,
    output_path: String,
) -> Result<ProcessResult, String> {
    let start = std::time::Instant::now();

    let result = txt::convert(&file_path, &output_path)
        .map_err(|e| e.to_string())?;

    Ok(ProcessResult {
        success: true,
        message: format!("生成 EPUB：{} 章", result.chapters),
        output_path: Some(output_path),
        elapsed_ms: start.elapsed().as_millis() as u64,
    })
}
```

### 9.2 前端 Tauri Bridge

```typescript
// packages/gui/src/lib/tauri-bridge.ts
import { invoke } from '@tauri-apps/api/core';

export interface ProcessResult {
  success: boolean;
  message: string;
  output_path?: string;
  elapsed_ms: number;
}

export async function reformatEpub(filePath: string, outputPath: string): Promise<ProcessResult> {
  return invoke('reformat_epub', { filePath, outputPath });
}

export async function convertWebp(filePath: string, outputPath: string): Promise<ProcessResult> {
  return invoke('convert_webp', { filePath, outputPath });
}

export async function txtToEpub(filePath: string, outputPath: string): Promise<ProcessResult> {
  return invoke('txt_to_epub', { filePath, outputPath });
}
```

### 9.3 对比 v2 sidecar 方案

```text
v2 调用流程（复杂）：
  React → Tauri IPC → Rust → spawn Node.js SEA → Node.js 执行 → stdout → Rust 解析 → IPC → React
  延迟: ~200-500ms，需管理子进程生命周期

v3 调用流程（简洁）：
  React → Tauri IPC → Rust 直接执行 epub-core → IPC → React
  延迟: ~1-5ms，零额外开销
```

---

## 十、迁移策略：从 v2 (TS) 到 v3 (Rust)

### 10.1 迁移原则

1. **渐进式迁移** — 不需要一次性重写所有模块
2. **功能对等** — 每迁移一个模块，确保功能和测试完全对等
3. **v2 TS 代码作为参考** — 已实现的 TS 逻辑是 Rust 重写的最佳规格说明
4. **前端不变** — React 前端代码完全复用，只改 bridge 调用方式

### 10.2 迁移顺序

```text
Phase 0: Rust Workspace 骨架
  └─ Cargo workspace + epub-core crate + epub-cli crate

Phase 1: 核心基础（纯算法，无外部依赖）
  ├─ crypto/encrypt.rs    ← 从 TS encrypt.ts 移植
  ├─ crypto/decrypt.rs    ← 从 TS decrypt.ts 移植
  └─ epub/parser.rs       ← 从 TS parser.ts 移植

Phase 2: EPUB 处理
  ├─ epub/writer.rs       ← 从 TS writer.ts 移植
  ├─ epub/reformat.rs     ← 从 TS reformat.ts 移植
  └─ epub/upgrade.rs      ← 从 TS upgrade.ts 移植

Phase 3: 图片处理
  ├─ image/webp_converter.rs  ← image crate 替代 sharp
  └─ image/compressor.rs      ← image crate 压缩

Phase 4: 字体处理
  ├─ font/subsetter.rs    ← allsorts 替代 subset-font
  └─ font/obfuscator.rs   ← Python 桥接 (调用 encrypt_font.py)

Phase 5: 新功能
  ├─ txt/                 ← TXT→EPUB
  ├─ chinese/             ← 简繁转换
  └─ edit/                ← 编辑工作流 (git2)

Phase 6: GUI 集成
  ├─ Tauri commands.rs    ← 直接调用 epub-core
  └─ 移动端应用            ← Tauri mobile
```

### 10.4 `epub-core` 图片压缩模块接口设计

图片压缩模块需要同时满足三类场景：
- CLI 批处理
- Tauri 桌面端调用
- Tauri mobile 调用

因此接口设计应把“**压缩策略**”和“**平台能力**”分开，而不是把 `safe` / `balanced` / `max` 写死成某种实现。

#### 模块目录建议

```text
crates/epub-core/src/image/
├── mod.rs
├── compressor.rs           # 对外统一入口
├── policy.rs               # 档位/策略/平台能力判定
├── pipeline.rs             # EPUB 级处理流水线
├── codecs.rs               # PNG/JPEG/WebP 编解码适配
├── metadata.rs             # EXIF/ICC/XMP 清理
├── external_tools.rs       # 桌面端外部工具调度
├── report.rs               # 报告结构体
└── errors.rs               # 图片压缩错误类型
```

#### Cargo feature flag 建议

当前 `image-processing` 过粗，建议改成：

```toml
[features]
default = ["image-core", "desktop-tools-auto"]

image-core = ["dep:image"]
desktop-tools = []
desktop-tools-bundled = ["desktop-tools"]
desktop-tools-system = ["desktop-tools"]
desktop-tools-auto = ["desktop-tools-bundled", "desktop-tools-system"]
mobile = ["image-core"]
desktop = ["image-core", "desktop-tools-auto"]
```

含义：
- `image-core`：纯 Rust 图像处理能力，三端共用。
- `desktop-tools`：允许调用外部工具。
- `desktop-tools-bundled`：允许查找应用内置工具。
- `desktop-tools-system`：允许查找系统工具。
- `mobile`：明确禁用外部工具路径，仅保留纯 Rust 能力。

#### 公共类型设计

```rust
pub enum CompressionProfile {
  Safe,
  Balanced,
  Max,
}

pub enum RuntimePlatform {
  Desktop,
  Mobile,
  Cli,
}

pub enum ImageFormat {
  Jpeg,
  Png,
  Webp,
  Gif,
  Svg,
  Unknown,
}

pub enum CompressionAction {
  LosslessRewrite,
  MetadataStrip,
  ReencodePng,
  ReencodeJpeg,
  ConvertWebpToJpeg,
  ConvertWebpToPng,
  ExternalOptimize,
  Skipped,
}

pub struct CompressionRequest {
  pub input_epub: std::path::PathBuf,
  pub output_epub: std::path::PathBuf,
  pub profile: CompressionProfile,
  pub platform: RuntimePlatform,
  pub dry_run: bool,
  pub keep_original_timestamps: bool,
  pub strip_metadata: bool,
  pub allow_format_conversion: bool,
  pub external_tools: ExternalToolPreference,
}

pub struct ExternalToolPreference {
  pub allow_bundled: bool,
  pub allow_system: bool,
  pub preferred_png_tool: Option<ExternalToolKind>,
  pub preferred_jpeg_tool: Option<ExternalToolKind>,
}

pub enum ExternalToolKind {
  Oxipng,
  ZopfliPng,
  Jpegoptim,
}

pub struct CompressionSummary {
  pub files_scanned: usize,
  pub files_changed: usize,
  pub bytes_before: u64,
  pub bytes_after: u64,
  pub saved_bytes: u64,
  pub used_external_tools: bool,
  pub profile_applied: CompressionProfile,
  pub entries: Vec<ImageCompressionEntry>,
}

pub struct ImageCompressionEntry {
  pub path: String,
  pub format: ImageFormat,
  pub action: CompressionAction,
  pub before_bytes: u64,
  pub after_bytes: u64,
  pub tool: Option<String>,
  pub warning: Option<String>,
}
```

#### 对外 API 设计

```rust
pub fn compress_epub_images(request: CompressionRequest) -> Result<CompressionSummary>;

pub fn analyze_epub_images(input_epub: &std::path::Path) -> Result<CompressionSummary>;

pub fn detect_external_tools(platform: RuntimePlatform) -> ExternalToolAvailability;
```

建议再补一个更底层的单文件接口，便于后续测试和移动端复用：

```rust
pub fn compress_image_bytes(
  input: &[u8],
  format: ImageFormat,
  profile: CompressionProfile,
  platform: RuntimePlatform,
) -> Result<(Vec<u8>, ImageCompressionEntry)>;
```

#### 三档策略的落地语义

| 档位 | Desktop GUI | CLI | Mobile |
|------|-------------|-----|--------|
| `safe` | 纯 Rust，无外部工具 | 纯 Rust | 纯 Rust |
| `balanced` | 优先纯 Rust，再尝试 `oxipng` / `jpegoptim` | 同左 | 自动降级为 `safe` |
| `max` | 允许更慢的桌面工具链 | 同左 | 自动降级为 `safe` |

建议策略映射：

```text
safe:
  PNG  -> 去 metadata + Rust 重编码
  JPEG -> 去 metadata + 无损安全重写
  WebP -> 保持格式，默认不转码

balanced:
  先执行 safe
  PNG  -> 若有 oxipng，则继续优化
  JPEG -> 若有 jpegoptim，则继续优化

max:
  先执行 balanced
  PNG  -> 若有更慢工具链，则进一步优化
  JPEG -> 若有更激进但仍可控的优化路径，则继续
```

#### 平台降级规则

```text
if platform == Mobile:
  safe      -> safe
  balanced  -> safe
  max       -> safe

if platform == Desktop or Cli:
  safe      -> safe
  balanced  -> balanced，缺工具则回退 safe
  max       -> max，缺工具则回退 balanced，再回退 safe
```

#### Tauri / CLI 调用约定

Tauri Desktop：

```rust
let request = CompressionRequest {
  input_epub: input.into(),
  output_epub: output.into(),
  profile: CompressionProfile::Balanced,
  platform: RuntimePlatform::Desktop,
  dry_run: false,
  keep_original_timestamps: true,
  strip_metadata: true,
  allow_format_conversion: false,
  external_tools: ExternalToolPreference {
    allow_bundled: true,
    allow_system: true,
    preferred_png_tool: Some(ExternalToolKind::Oxipng),
    preferred_jpeg_tool: Some(ExternalToolKind::Jpegoptim),
  },
};
```

Tauri Mobile：

```rust
let request = CompressionRequest {
  input_epub: input.into(),
  output_epub: output.into(),
  profile: CompressionProfile::Safe,
  platform: RuntimePlatform::Mobile,
  dry_run: false,
  keep_original_timestamps: true,
  strip_metadata: true,
  allow_format_conversion: false,
  external_tools: ExternalToolPreference {
    allow_bundled: false,
    allow_system: false,
    preferred_png_tool: None,
    preferred_jpeg_tool: None,
  },
};
```

#### 实现顺序建议

1. 先实现 `compress_image_bytes()`。
2. 再实现 `compress_epub_images()` 的 EPUB 遍历与回写。
3. 最后接入 `external_tools.rs`。

这样可以先把移动端可用的 `safe` 档做完，再叠加桌面增强能力。

### 10.3 v2 TS 代码的处置

| v2 组件 | 迁移后处置 | 说明 |
|---------|-----------|------|
| `packages/core/` | **归档后删除** | Rust 核心完全替代 |
| `packages/cli/` | **删除** | Rust CLI 替代 |
| `packages/gui/src/` | **保留** | React 前端完全复用 |
| `packages/gui/src-tauri/` | **重写** | 直接调用 epub-core |
| `py-scripts/` | **保留** | 字体混淆（桌面/CLI 专属，通过进程调用） |
| `tests/` | **迁移到 Rust** | `cargo test` |
| `skills/ts/` | **迁移到 `skills/rs/`** | Rust 重写 |

---

## 十一、EPUBPro V1 交付范围与 P 级计划

### 11.1 V1 的产品定义

EPUBPro V1 不是“把所有 v3 能力一次做完”，而是先交付一个**可持续演进的 Rust 核心基础版**：

1. **CLI 可真实处理文件**，不是只做解析演示。
2. **桌面端已接入 Rust core**，而不是保留 sidecar 思路。
3. **核心库 API 开始具备跨平台边界**，为移动端和 WASM 预留正确方向。
4. **工程目录、命名、日志、验证、版本、安全写入等基础设施先补齐**，避免功能越写越散。

因此，V1 的判断标准不是“功能最多”，而是：
- 核心链路可用
- 目录结构稳定
- 版本语义清晰
- 后续继续开发不会推翻重来

### 11.2 当前工程现状盘点（基于 2026-03-07 仓库状态）

| 模块 | 当前状态 | 说明 |
|------|---------|------|
| Cargo workspace | ✅ 已完成 | 根 workspace 已包含 `crates/epub-core`、`crates/epub-cli`、`packages/gui/src-tauri` |
| EPUB parser | ✅ 已实现 | `parser.rs` 已可解析 EPUB，含异常 XML 降级处理 |
| EPUB writer | ✅ 已实现 | `writer.rs` 已处理 mimetype STORE 与写包顺序 |
| crypto/encrypt | ✅ 已实现算法 | 核心算法与测试已存在，但 CLI 还未打通完整写回流程 |
| crypto/decrypt | ✅ 已实现算法 | 同上 |
| xml_utils / error | ✅ 已实现 | 编码回退、BOM、错误类型基本具备 |
| CLI 框架 | ✅ 已成骨架 | `doctor`、`encrypt`、`decrypt`、`reformat` 子命令已存在 |
| CLI 真正处理链路 | ⚠️ 未完成 | 目前 `encrypt` / `decrypt` / `reformat` 仍是 parse + log，未真正输出结果 |
| Tauri 桌面端 | ⚠️ 已接入骨架 | `commands.rs` 目前只有 `greet`、`process_epub` 演示级命令 |
| 图片模块 | ❌ 未完成 | `compressor.rs`、`webp_converter.rs` 仍待实现 |
| 字体模块 | ❌ 未开始 | 子集化、混淆桥接未接入 |
| TXT / 简繁 / 下载图片 | ❌ 未开始 | 仍停留在规划阶段 |
| 移动端 | ❌ 未开始 | `packages/mobile` 尚不存在 |
| README 与对外说明 | ⚠️ 过期 | 仍大量描述 v2 TS 时代的 `packages/core` / `packages/cli` |
| 根目录整洁度 | ⚠️ 待整理 | 根目录存在 `log.txt`、`result.txt` 等运行产物 |

### 11.3 V1 强制纳入项

以下补充要求明确纳入 EPUBPro V1，而不是“以后再说”：

| 来源 | 是否纳入 V1 | 说明 |
|------|------------|------|
| 16.3 WASM 目标支持（接口预留） | ✅ 是 | V1 至少做到 API 形态可兼容 WASM，不要求发布 Web 版产品 |
| 16.6 安全备份与回滚 | ✅ 是 | V1 必须避免直接破坏原文件 |
| 16.7 EPUB 校验集成 | ✅ 是 | V1 每次输出后都应有基本校验 |
| 16.8 日志与诊断增强 | ✅ 是 | V1 必须能定位问题，而不是只打印零散日志 |
| 16.9 CLI 批量处理与 glob | ✅ 是 | V1 CLI 需要支持真实批量场景 |
| 16.10 `no_std` / WASM 友好性 | ✅ 是 | V1 先在纯算法层收敛接口，不要求整个 crate 变 `no_std` |
| 16.11 版本管理与兼容性 | ✅ 是 | V1 前必须确立核心格式版本语义 |

### 11.4 P0：V1 首版必须完成

P0 是 **“不完成就不应发布 EPUBPro V1”** 的内容。

#### 核心处理链路

- [x] Rust workspace、`epub-core`、`epub-cli` 基础骨架
- [x] `parser.rs`、`writer.rs`、`encrypt.rs`、`decrypt.rs` 基础实现
- [ ] 打通 `encrypt` 完整链路：读取 EPUB → 重写 href / 引用 → 写回输出 EPUB
- [ ] 打通 `decrypt` 完整链路：读取 EPUB → 还原文件名 / 引用 → 写回输出 EPUB
- [ ] 实现 `epub/reformat.rs`，让 `reformat` 不再是占位命令
- [ ] 为输出链路统一加入安全写入策略（16.6）：临时文件 + 原子替换，默认不覆盖原文件
- [ ] 增加轻量 `validator.rs`（16.7）：至少覆盖 mimetype、container.xml、OPF、manifest/spine、内部链接基础检查

#### 工程基础设施

- [ ] 建立版本常量与兼容性语义（16.11）：`VERSION`、`CRYPTO_FORMAT_VERSION`、后续 `REFORMAT_FORMAT_VERSION`
- [ ] 统一错误出口与日志字段（16.8）：CLI、epub-core、Tauri 三端使用同一套 `tracing` 字段风格
- [ ] 扩展 `doctor` 命令（16.8）：不仅检测 Python，还检测 `oxipng`、`jpegoptim`、临时目录、feature 状态
- [ ] 重写桌面端 `packages/gui/src-tauri/src/commands.rs`，不再停留在 parse-demo
- [ ] 重写根 README，使其与当前 Rust workspace 一致
- [ ] 清理根目录运行产物：停止将 `log.txt`、`result.txt` 作为仓库根常驻文件

#### 目录与命名收口

- [ ] 保持“产品名 EPUBPro、代码名 epub-tools”双轨过渡，不在 V1 中途大规模 rename crate/path
- [ ] 统一版本号：根 `Cargo.toml` 是 `3.0.0`，GUI package 仍是 `2.0.0`，V1 前必须收敛
- [ ] 明确 `docs/` 中哪些是现行方案、哪些是归档文档

### 11.5 P1：V1 计划内完成，但可在 P0 稳定后推进

P1 仍属于 V1 范围，只是顺序晚于 P0。

#### 图片与批处理能力

- [ ] 实现 `image/webp_converter.rs`
- [ ] 实现 `image/compressor.rs` 的 `safe` / `balanced` 基础档位
- [ ] CLI 支持批量输入和 glob（16.9）
- [ ] 批量任务进度汇总与失败不中断策略

#### WASM / 跨平台边界收敛

- [ ] 为核心能力补 `bytes in / bytes out` 低层接口（16.3）
- [ ] 预留 `wasm` feature，先禁用文件系统和外部命令路径（16.3）
- [ ] 纯算法模块继续去 `std::fs` 依赖，优先处理 crypto / path / classify 类逻辑（16.10）

#### 桌面可用性补齐

- [ ] Tauri bridge 与前端按钮联调，至少支持 `reformat` / `encrypt` / `decrypt`
- [ ] 统一输出结果结构：`success`、`message`、`output_path`、`elapsed_ms`、`warnings`

### 11.6 P2：明确不进入 V1 首轮交付

以下内容很重要，但不建议塞进 EPUBPro V1 第一轮，否则工程会再次失焦：

- [ ] `packages/mobile/` 初始化与 Tauri mobile 真机验证
- [ ] 字体子集化、字体混淆桥接
- [ ] TXT → EPUB
- [ ] 简繁转换
- [ ] 下载远程图片
- [ ] 编辑工作流（git2 / watcher / packer）
- [ ] EPUB 合并/拆分、正则注释等 skills 体系补齐
- [ ] 外部工具 `max` 压缩档位
- [ ] 完整 CI/CD、`cargo publish`、多平台发布流水线

### 11.7 推荐执行顺序

建议后续开发按下面顺序推进，而不是按模块兴趣跳着做：

1. **先把 CLI 三条主链路做真**：`encrypt`、`decrypt`、`reformat`。
2. **再补安全写入 + 校验 + 日志 + 版本常量**，把 V1 基础设施补齐。
3. **然后把桌面端接到这三条真链路上**，验证 Tauri 集成不是伪接入。
4. **再做图片模块与批处理**，进入 P1。
5. **最后才扩展字体、TXT、简繁、移动端**。

### 11.8 当前项目目录整理建议

当前目录并不乱到需要“大手术”，但已经出现了 **时代混杂** 和 **运行产物侵入根目录** 的问题。V1 建议做“收口整理”，不是“重建仓库”。

#### 当前主要问题

1. **根 README 仍是 v2 时代内容**，引用了已经不存在的 `packages/core`、`packages/cli`。
2. **根目录混有运行产物**：`log.txt`、`result.txt` 不应长期停留在仓库顶层。
3. **版本号不一致**：workspace `3.0.0`，GUI package `2.0.0`。
4. **文档层级未区分“现行 / 历史”**：`docs/` 里 v2、v3、对比文档并列。
5. **Rust crate 与前端 package 的边界虽已形成，但对外说明还没跟上。**

#### V1 阶段建议保留的大结构

```text
epub_tool/
├── crates/          # Rust 核心与 CLI
├── packages/        # GUI / 未来 mobile 壳层
├── py-scripts/      # 桌面/CLI 专属外部脚本
├── docs/            # 现行方案 + 历史文档
├── tests/           # fixtures / integration
├── skills/          # 独立脚本与辅助工具
└── tools/           # 未来可放桌面内置外部二进制（V1 可先不建）
```

#### 建议的整理动作

1. **根目录清理**
  - `log.txt`、`result.txt` 改为输出到临时目录或应用数据目录。
  - 加入 `.gitignore`，避免再次进入版本库视野。

2. **文档分层**
  - 当前这份文档作为 **现行主计划**。
  - `archive/plan-epubToolsV2-updated.md`、`archive/plan-epubToolsV2.prompt.md` 归为历史参考。
  - `comparison-with-wangyyyqw-epub.md` 保留为竞品/参考文档。
  - 如果后面继续增多，建议再拆 `docs/active/` 与 `docs/archive/`；V1 当前先不强制挪目录。

3. **包与版本统一**
  - 根 `package.json`、`packages/gui/package.json`、`packages/gui/src-tauri/Cargo.toml`、workspace version 在 V1 前统一。
  - 产品名称改为 EPUBPro 时，优先改文档、UI 文案、release 名称；crate/package 名可延后到 RC 前统一，避免中期大改路径。

4. **README 与对外入口统一**
  - README 只保留当前有效结构：`crates/epub-core`、`crates/epub-cli`、`packages/gui`、`py-scripts`。
  - 所有旧 TS 核心路径说明删除，不再让文档和工程相互打架。

5. **测试目录补全**
  - `tests/fixtures/` 继续保留。
  - 增加 `tests/integration/` 的真实端到端样例。
  - golden files 放在 `tests/fixtures/<feature>/input` 与 `expected`。

#### 不建议现在做的目录改动

- 不建议现在把 `packages/gui/src-tauri` 单独上移成独立 crate 路径。
- 不建议现在把 `crates/` 改名成 `apps/` 或 `modules/`。
- 不建议现在全仓库统一 rename 为 `epubpro-*`。

这些动作改动面太大，收益主要体现在“名字更整齐”，但会打断当前开发节奏。V1 应优先解决“功能真可用”和“工程真稳定”。

---

## 十二、依赖环境要求 (v3)

### 开发环境

```text
必须：Rust stable (rustup)
前端：Node.js 22+, pnpm 10+ (仅 GUI 前端需要)
移动：Xcode (iOS), Android SDK + NDK (Android)
推荐：jpegoptim, oxipng (图片极限压缩)
可选：Python 3.9+ (字体混淆后备)
```

### 最终用户

```text
CLI：
  无需安装任何运行时 — 下载单二进制文件即可使用 (~5-10MB)

桌面 App (Tauri)：
  无需安装任何运行时 — 双击即用 (~5-8MB)
  字体混淆(后备)：需系统 Python 3.9+
  图片极限压缩：需 jpegoptim / oxipng（应用内提供安装引导）

移动 App：
  无需额外依赖 — 从 App Store / Google Play 安装即可
```

---

## 十三、性能预期对比

| 操作 | v2 (TS/Node.js) | v3 (Rust) | 预期提升 |
|------|-----------------|-----------|---------|
| CLI 启动时间 | ~200ms | ~1ms | **200x** |
| EPUB 解析 (10MB) | ~150ms | ~20ms | **7x** |
| 文件名加密 (100文件) | ~50ms | ~5ms | **10x** |
| WebP→JPG 转换 (50张) | ~2s (sharp) | ~1.5s (image) | **1.3x** |
| 图片压缩 (50张) | ~3s (sharp) | ~2s (image) | **1.5x** |
| 字体子集化 | ~500ms (JS) | ~100ms (allsorts) | **5x** |
| 内存占用 | ~80-150MB | ~10-30MB | **5x** |
| 打包体积 (CLI) | ~50MB (Node SEA) | ~5-10MB | **5-10x** |
| 打包体积 (GUI) | ~55MB (Tauri+SEA) | ~5-8MB | **7-10x** |

> 注：图片处理提升较小，因 sharp 底层使用 C 原生 libvips；Rust `image` crate 是纯 Rust 实现，
> 在某些编解码操作上可能接近但不一定超越 libvips。其他纯逻辑操作提升显著。

---

## 十四、风险与缓解

| 风险 | 影响 | 缓解策略 |
|------|------|---------|
| Rust 学习曲线陡峭 | 中 | 渐进式迁移，v2 TS 代码作为参考规格 |
| Tauri 移动端不成熟 | 低 | Tauri 2.x 已稳定，社区活跃 |
| `image` crate 性能不如 sharp | 低 | 大多数场景足够，极端场景可用外部工具 |
| 迁移期间维护两套代码 | 中 | Phase 式迁移，每 Phase 替换一个模块后删除旧代码 |
| opencc-rust 维护状态 | 低 | 可内嵌 OpenCC 词典 + 自定义转换逻辑 |
| 移动端无损压缩收益不及桌面工具链 | 中 | 移动端采用 `safe` 档优先，极限压缩保留给桌面/CLI |
| 未来若切 Flutter 导致重复建设 | 中 | 保持 `epub-core` 与 UI 壳层解耦，预留绑定层 |

---

## 十五、总结

### v3 核心变更

| 维度 | v2 方案 | v3 方案 |
|------|--------|--------|
| **核心语言** | TypeScript | **Rust** |
| **运行时依赖** | Node.js 22+ | **无**（纯原生二进制） |
| **Tauri 集成** | sidecar (进程调用) | **直接调用**（零开销） |
| **移动端** | ❌ 不可行 | ✅ **Tauri 2.x 原生支持** |
| **CLI 体积** | ~50MB (Node SEA) | **~5-10MB** |
| **GUI 体积** | ~55MB | **~5-8MB** |
| **Python 依赖** | 字体混淆必需 | **字体混淆必需**（桌面/CLI 专属） |
| **前端** | React + shadcn/ui | **不变** |

### 核心优势

1. ✅ **统一架构** — Rust 核心一次编写，桌面/CLI/移动端三端共用
2. ✅ **移动端支持** — Tauri 2.x 原生 iOS/Android，用户可在手机上处理 EPUB
3. ✅ **极致轻量** — CLI 单文件 5-10MB，GUI 5-8MB，无外部依赖
4. ✅ **极致性能** — 启动 1ms，处理速度普遍提升 5-10x
5. ✅ **简化分发** — `cargo install epub-tools` 或下载二进制即可
6. ✅ **消除 Node.js 依赖** — 最终用户无需安装任何运行时
7. ✅ **保留架构回旋空间** — 若未来移动端真需要 Flutter，可复用同一 Rust 核心

### 保持不变

- ✅ React + TailwindCSS + shadcn/ui 前端（资产复用）
- ✅ Tauri 2.x 框架选择
- ✅ 功能列表（格式化、加解密、图片、字体、编辑工作流等）
- ✅ Skills 可复用脚本体系
- ✅ Git 集成编辑工作流（创新功能）

---

**结论**：v3 方案通过将核心从 TypeScript 迁移到 Rust，解决了 v2 方案的架构矛盾（双运行时、sidecar 复杂度、移动端不可行），在保持所有功能和 React 前端基本不变的前提下，实现了真正的跨平台统一——桌面、命令行、移动端共用同一个 Rust 核心引擎。对于 UI 壳层，当前阶段继续选择 Tauri 最务实；对于长期演进，应该把 `epub-core` 设计成可被 Tauri、Flutter、原生壳层复用的稳定核心，而不是把业务能力绑定死在某一个前端框架上。

---

## 十六、补充建议（2026-03-07）

以下是基于当前实现状态和方案文档的补充建议，涵盖文档中尚未详述的关键领域。

### 16.1 进度回调抽象层

当前方案提到了 Tauri event system 做进度回调，但 `epub-core` 作为纯 lib crate，不应依赖 Tauri。需要在核心层设计一个通用的进度回调抽象，让 CLI、桌面 GUI、移动端各自适配。

```rust
// crates/epub-core/src/utils/progress.rs

/// 进度事件
pub enum ProgressEvent {
    Started { total_steps: usize, description: String },
    Step { current: usize, total: usize, message: String },
    Warning { message: String },
    Finished { summary: String },
}

/// 进度回调 trait — 由调用方实现
pub trait ProgressReporter: Send + Sync {
    fn report(&self, event: ProgressEvent);
}

/// 空实现，用于不需要进度的场景（如单元测试）
pub struct NullReporter;
impl ProgressReporter for NullReporter {
    fn report(&self, _event: ProgressEvent) {}
}
```

各端适配方式：
- **CLI**：实现 `ProgressReporter`，通过 `indicatif` crate 在终端显示进度条。
- **Tauri Desktop/Mobile**：实现 `ProgressReporter`，内部调用 `app.emit("progress", &event)` 推送到前端。
- **测试**：使用 `NullReporter` 或收集事件到 `Vec` 断言。

核心 API 签名应改为：

```rust
pub fn reformat(input: &Path, output: &Path, reporter: &dyn ProgressReporter) -> Result<ReformatResult>;
pub fn compress_epub_images(request: CompressionRequest, reporter: &dyn ProgressReporter) -> Result<CompressionSummary>;
```

这样 epub-core 保持零 UI 依赖，进度能力完全由调用方注入。

### 16.2 并发处理策略

对于包含大量图片的 EPUB（50-200 张），逐张串行处理效率低。建议引入 `rayon` 做 CPU 密集型任务的数据并行：

```toml
# epub-core/Cargo.toml
[dependencies]
rayon = "1"
```

适用场景：
- 图片压缩/转换：各图片独立，天然可并行
- 字体子集化：多字体文件可并行处理
- 批量 EPUB 处理：CLI 一次传入多个文件时

**不适用场景**：
- EPUB 写入（ZIP 写入是顺序操作）
- 单文件加解密（已经很快，并行反而增加开销）

建议在 `CompressionRequest` 中增加：

```rust
pub struct CompressionRequest {
    // ...existing fields...
    pub max_parallelism: Option<usize>, // None = 自动（CPU 核数），Some(1) = 串行
}
```

移动端建议默认 `Some(2)` 以控制内存峰值，桌面端默认 `None`。

### 16.3 WASM 目标支持

`epub-core` 作为纯 Rust lib，完全有潜力编译为 WASM，用于：
- 在线 EPUB 处理 demo 页面（无需安装）
- VS Code Web 版扩展
- 第三方 Web 应用集成

建议：
1. 在 feature flag 中预留 `wasm` 目标，与 `mobile` 类似禁用外部工具和文件系统直接操作。
2. 核心处理函数接受 `&[u8]` 输入 + 返回 `Vec<u8>` 输出，而不是硬编码文件路径。已有的 `compress_image_bytes` 设计方向正确，其他模块也应提供类似的 bytes-in/bytes-out 接口。
3. 不需要现在实现，但 API 设计时避免对 `std::fs` 的硬依赖。

```toml
[features]
wasm = []  # 禁用文件系统、外部工具、进程调用
```

```rust
// 推荐：双接口模式
pub fn reformat_bytes(input: &[u8]) -> Result<Vec<u8>>;                    // WASM/测试友好
pub fn reformat_file(input: &Path, output: &Path, reporter: &dyn ProgressReporter) -> Result<ReformatResult>; // CLI/GUI 友好
```

### 16.4 配置文件支持

CLI 用户反复输入相同参数（输出目录、压缩档位等）体验不佳。建议支持项目级配置文件：

```toml
# .epub-tools.toml（放在工作目录或 EPUB 文件同级目录）

[defaults]
output_dir = "./output"           # 默认输出路径
compression_profile = "balanced"  # 默认压缩档位
convert_webp = true               # 默认开启 WebP 转换
strip_metadata = true             # 默认去除图片元数据

[reformat]
target_structure = "sigil"        # Sigil 标准目录结构
epub_version = "3.3"              # 默认 EPUB 版本

[chinese]
default_variant = "traditional"   # 默认转换方向

[fonts]
subset = true                     # 默认开启字体子集化
obfuscate = false                 # 默认关闭字体混淆
```

加载优先级：CLI 参数 > 当前目录 `.epub-tools.toml` > 用户目录 `~/.config/epub-tools/config.toml` > 内置默认值。

使用 `serde` + `toml` crate 反序列化，成本极低。

### 16.5 测试策略补充

当前有约 35 个单元测试，但缺少以下关键测试层：

#### Golden File 测试（格式敏感操作必备）

对于 reformat、EPUB2→3 升级等涉及输出格式的操作，应使用 golden file 测试：

```text
tests/fixtures/
├── reformat/
│   ├── input/
│   │   ├── messy_structure.epub
│   │   └── epub2_basic.epub
│   └── expected/
│       ├── messy_structure_reformatted.epub
│       └── epub2_upgraded_to_3.epub
└── encrypt/
    ├── input/
    │   └── sample.epub
    └── expected/
        └── sample_encrypted.epub
```

```rust
#[test]
fn reformat_produces_golden_output() {
    let input = Path::new("tests/fixtures/reformat/input/messy_structure.epub");
    let output = tempdir().unwrap().path().join("output.epub");
    reformat_file(input, &output, &NullReporter).unwrap();
    assert_epub_contents_equal(&output, "tests/fixtures/reformat/expected/messy_structure_reformatted.epub");
}
```

#### Roundtrip 测试

加密→解密、parse→write 应确保 roundtrip 一致：

```rust
#[test]
fn encrypt_then_decrypt_roundtrip() {
    let original = parse_epub("tests/fixtures/sample.epub").unwrap();
    let encrypted = encrypt_epub(&original).unwrap();
    let decrypted = decrypt_epub(&encrypted).unwrap();
    assert_eq!(original.file_list(), decrypted.file_list());
}
```

#### Property-based 测试

文档提到了 `proptest` 但建议明确哪些函数适合：
- MD5 加密的确定性（同输入→同输出）
- 路径分类的穷尽性（任何合法 EPUB 路径都能被分类）
- ZIP 写入的 spec 合规性（mimetype 始终是第一个条目且未压缩）

### 16.6 安全备份与回滚

当前方案未提及对原始文件的保护。建议：

1. **默认不覆盖原文件** — 输出到新路径（当前设计已是如此，应作为不可覆盖的行为约定）。
2. **`--in-place` 模式需安全实现** — 如果未来支持原地修改，应使用 write-to-temp → atomic rename 模式，而非直接写入原文件。
3. **CLI 的 `--dry-run` 参数** — `CompressionRequest` 已有 `dry_run` 字段，建议所有耗时操作都支持 dry-run，让用户预览将发生的变更。

```rust
// 安全的原地写入模式
pub fn safe_replace(target: &Path, content: &[u8]) -> Result<()> {
    let temp = target.with_extension("tmp");
    std::fs::write(&temp, content)?;
    std::fs::rename(&temp, target)?; // atomic on most filesystems
    Ok(())
}
```

### 16.7 EPUB 校验集成

处理完成后应对输出 EPUB 做基本校验，而不是盲目输出。建议在 `epub-core` 中增加轻量校验模块：

```rust
// crates/epub-core/src/epub/validator.rs

pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationWarning>,
}

pub enum ValidationError {
    MissingMimetype,
    InvalidContainerXml,
    MissingOpfFile,
    BrokenInternalLink { from: String, to: String },
    MissingSpineItem { id: String },
}

pub enum ValidationWarning {
    MissingCoverImage,
    NoTableOfContents,
    UnreferencedFile { path: String },
    DeprecatedEpub2Feature { description: String },
}

pub fn validate_epub(epub: &EpubArchive) -> ValidationResult;
```

这不需要实现完整的 EPUBCheck（那是 Java 工具），只需覆盖本工具处理后最可能出错的场景：
- mimetype 存在且正确
- container.xml 指向有效 OPF
- OPF 中引用的文件都存在
- spine 中的项在 manifest 中有定义
- 内部链接不指向不存在的文件

建议在每个写操作后自动运行校验，校验失败时输出警告而非静默忽略。

### 16.8 日志与诊断增强

当前使用 `tracing`，建议补充以下细节：

1. **结构化字段标准化**：

```rust
tracing::info!(
    epub_path = %input_path.display(),
    operation = "reformat",
    files_processed = result.files_moved,
    elapsed_ms = elapsed.as_millis() as u64,
    "EPUB 处理完成"
);
```

2. **按平台配置日志输出**：

| 平台 | 默认日志级别 | 输出位置 |
|------|------------|---------|
| CLI | `info`（`-v` 提升到 `debug`，`-vv` 到 `trace`） | stderr |
| Desktop GUI | `info` | 前端 LogPanel + 应用日志文件 |
| Mobile | `warn` | 系统日志（ASL/Logcat） |

3. **`doctor` 命令增强**：当前仅检测 Python，建议扩展为完整的环境诊断：

```bash
$ epub-tools doctor
✅ epub-tools v0.1.0 (rust 1.85.0)
✅ epub-core 功能: image-processing, desktop-tools
✅ oxipng 0.9.0 (system)
✅ jpegoptim 1.5.5 (bundled)
⚠️ Python 3.12.0 — fontTools 未安装（字体混淆不可用）
✅ 操作系统: macOS 15.3 (aarch64)
✅ 可用内存: 16 GB
✅ 临时目录可写: /tmp
```

### 16.9 CLI 批量处理与 glob 支持

当前 CLI 设计是单文件操作。批量处理多个 EPUB 是高频场景，建议原生支持 glob：

```bash
# 处理目录下所有 EPUB
epub-tools reformat ./books/*.epub -o ./output/

# 递归处理
epub-tools compress ./library/**/*.epub --level balanced

# 多文件混合
epub-tools process book1.epub book2.epub novel.txt -o ./output/
```

实现建议：
- CLI 层使用 `glob` crate 展开路径
- 核心层保持单文件接口，批量逻辑在 CLI/GUI 层实现
- 批量模式下自动使用进度汇总（X/Y 完成，Z 失败）
- 失败不中断：单文件失败时记录错误，继续处理剩余文件

### 16.10 epub-core 的 `no_std` 友好性考量

虽然当前不需要 `no_std`，但部分纯算法模块（如加密的 MD5 哈希 + 文件名生成、路径分类）可以设计为不依赖 `std::fs`，只依赖 `core` + `alloc`。这样做的好处：
- 这些函数可以直接在 WASM 中使用
- 更容易做单元测试（无需文件系统 mock）
- 符合 Rust 社区 "尽可能减少依赖表面" 的最佳实践

不需要把整个 crate 改为 `no_std`，只是建议**纯逻辑函数**尽量只接受 `&str` / `&[u8]` 而非 `&Path`。当前 `encrypt.rs` 和 `decrypt.rs` 的实现已基本符合这一原则。

### 16.11 版本管理与兼容性

建议在 `epub-core` 中定义清晰的版本语义：

```rust
// crates/epub-core/src/lib.rs
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// 加密格式版本 — 用于确保加密/解密算法的前后兼容
pub const CRYPTO_FORMAT_VERSION: u32 = 1;
```

当加密算法或 reformat 规则发生变化时，通过版本号区分，避免新版工具处理旧版输出时出现不兼容。

### 16.12 CI/CD 补充建议

文档第十一节只提到了 "基本 CI"，建议细化：

```yaml
# .github/workflows/ci.yml 建议结构
jobs:
  check:
    # cargo fmt --check + cargo clippy -- -D warnings
    # 快速反馈，~30s

  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    # cargo test --all-features
    # 三平台并行，确保跨平台一致性

  build-cli:
    strategy:
      matrix:
        target:
          - x86_64-unknown-linux-gnu
          - x86_64-apple-darwin
          - aarch64-apple-darwin
          - x86_64-pc-windows-msvc
    # cross build --release --target $target
    # 产出各平台二进制，上传为 artifact

  build-gui:
    # pnpm install + pnpm tauri build
    # 产出 .dmg / .msi / .AppImage

  release:
    if: startsWith(github.ref, 'refs/tags/v')
    # 自动发布到 GitHub Releases
    # 自动发布 epub-core 到 crates.io
```

额外建议：
- 使用 `cargo-deny` 检查依赖 license 合规性（尤其桌面内置外部工具时重要）
- 使用 `cargo-audit` 检查已知安全漏洞
- 考虑 `cargo-semver-checks` 检查 API 兼容性变更
