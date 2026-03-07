# EPUB 跨平台处理工具 — 修订技术方案 v2.1（基于 wangyyyqw/epub 对比分析更新）

TS 全栈重构 + Python 仅保留字体混淆 + Tauri 桌面应用 + CLI 双界面 + 借鉴优秀开源项目

> **本文档状态**：v2.1 - 2026-02-28 更新（Sprint 1 & 2 已完成）
> 基于 [wangyyyqw/epub](https://github.com/wangyyyqw/epub) 对比分析，补充核心功能，移除不必要功能
>
> ⚠️ **后续演进**：参见 [EPUBPro V1 计划文档](../epubpro-v1-plan.md) — 将核心从 TS 迁移到 Rust，并收敛为 V1 交付计划

---

## 一、与 v1 方案及参考项目的对比

### 1.1 与 v1 方案的变更

| 维度 | v1 方案 | v2.1 方案（本文） |
|------|---------|------------------|
| Python 依赖范围 | 5 个脚本全部复用 | **仅保留 `encrypt_font.py`** |
| GUI 方案 | Web UI | **Tauri 桌面应用** |
| 架构策略 | 先复用 Python 再按需替换 | **TS 一次性重写到位**（字体混淆除外） |
| 可复用脚本 | 无专门目录 | **`skills/` 目录** |
| 分发体积 | N/A（需用户装 Node） | Tauri ~10-15MB |
| 核心功能 | 基础 EPUB 处理 | **+ TXT转换、简繁转换、远程图片** |

### 1.2 与 wangyyyqw/epub 的区别

| 维度 | wangyyyqw/epub | 本项目 (v2.1) |
|------|----------------|--------------|
| GUI 框架 | Wails + Go | **Tauri + Rust** (更轻量) |
| 核心语言 | Python | **TypeScript** (依赖更少) |
| 前端框架 | Vue 3 | React 18 + shadcn/ui |
| Python 角色 | 核心业务逻辑 | **仅字体混淆** |
| 拼音注音 | ✅ 支持 | ❌ **不支持**（用户不需要） |
| TXT 转 EPUB | ✅ 支持 | ✅ **借鉴实现** |
| 简繁转换 | ✅ 支持 | ✅ **借鉴实现** (OpenCC.js) |
| 编辑工作流 | ❌ 无 | ✅ **创新功能** (Git 集成) |
| Monorepo | ❌ 无 | ✅ **pnpm workspace** |

> 详细对比分析见 [comparison-with-wangyyyqw-epub.md](../comparison-with-wangyyyqw-epub.md)

---

## 二、总体架构（更新）

```text
┌──────────────────────────────────────────────────────┐
│                   用户界面层                          │
│  ┌────────────────┐    ┌──────────────────────────┐  │
│  │  CLI (commander) │    │  Tauri Desktop App       │  │
│  │  终端直接使用     │    │  Rust 壳 + React 前端    │  │
│  └───────┬────────┘    └────────────┬─────────────┘  │
│          └──────────┬───────────────┘                 │
│                     ▼                                │
│          核心处理层 (packages/core/src/)  ← 纯 TS     │
│   ┌─────────┬──────────┬──────────┬──────────┬─────┐ │
│   │ EPUB    │ 图片处理  │ 字体处理  │ 编辑工作流│ TXT  │ │
│   │ 解析/打包│ 转换/压缩 │ 子集化   │ Git 跟踪  │转换  │ │
│   └─────────┴──────────┴──────────┴──────────┴─────┘ │
│   ┌─────────────────────────────────────────────┐   │
│   │           新增模块 (v2.1)                    │   │
│   │  · chinese/ - 简繁转换 (OpenCC.js)           │   │
│   │  · txt/ - TXT 解析与 EPUB 生成               │   │
│   │  · image/download-remote.ts - 远程图片下载   │   │
│   └─────────────────────────────────────────────┘   │
│                     │                                │
│          ┌──────────┼──────────────┐                 │
│          ▼          ▼              ▼                 │
│   TS 原生库    Python 桥接     外部 CLI 工具          │
│   · sharp      · encrypt_font  · jpegoptim           │
│   · subset-font  (唯一 Python)  · oxipng             │
│   · jszip                      · zopflipng           │
│   · cheerio                                          │
│   · css-tree                                         │
│   · simple-git                                       │
│   · opencc-js  ← 新增                                │
│   · axios      ← 新增                                │
└──────────────────────────────────────────────────────┘
```

**核心原则**：
1. TS 做主力，Python 仅在无替代方案时使用
2. 借鉴 wangyyyqw/epub 的优秀功能，用 TS 重写
3. **明确不做**：拼音注音功能（用户明确不需要）

---

## 三、功能清单（v2.1 更新）

### 3.1 核心功能（原计划）

| 功能 | 实现模块 | 说明 |
|------|---------|------|
| EPUB 格式化 | `epub/reformat.ts` | 重组标准目录结构 |
| EPUB 加密/解密 | `crypto/` | 文件名加密（TS 重写） |
| 字体混淆 | `font/encryptor.ts` | 桥接 Python |
| 字体子集化 | `font/subsetter.ts` | subset-font (TS) |
| 图片压缩 | `image/compressor.ts` | jpegoptim/oxipng |
| WebP 转换 | `image/webp-converter.ts` | sharp (双向) |
| EPUB2→3 升级 | `epub/upgrade.ts` | 自动版本升级 |
| 编辑工作流 | `edit/` | Git 集成（创新功能） |

### 3.2 新增功能（借鉴 wangyyyqw/epub）⭐

| 功能 | 实现模块 | 优先级 | 说明 |
|------|---------|--------|------|
| **TXT → EPUB** | `txt/txt-parser.ts` + `txt/epub-creator.ts` | **高** ⭐⭐⭐ | 自动章节识别，分层目录 |
| **简繁转换** | `chinese/converter.ts` (OpenCC.js) | **高** ⭐⭐⭐ | 词组级精确转换 |
| **下载远程图片** | `image/download-remote.ts` (axios + sharp) | **高** ⭐⭐⭐ | EPUB 网络资源本地化 |
| **正则注释/脚注** | `skills/ts/regex-annotate.ts` | 中 ⭐⭐ | 高级编辑功能 |
| **EPUB 合并** | `skills/ts/merge-epub.ts` | 中 ⭐⭐ | 多卷书籍合并 |
| **EPUB 拆分** | `skills/ts/split-epub.ts` | 中 ⭐⭐ | 按章节拆分 |

### 3.3 明确不做的功能 ❌

| 功能 | 理由 |
|------|------|
| 拼音注音 | 用户明确表示不需要 |
| 生僻字注音 | 与拼音功能相关 |
| 拼音字典 | 拼音功能的依赖数据 |

---

## 四、项目结构（v2.1 更新）

```text
epub-tools/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── README.md
├── setup.sh / setup.ps1
│
├── packages/
│   ├── core/                       # 核心处理库（纯 TS）
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── epub/
│   │       │   ├── parser.ts
│   │       │   ├── writer.ts
│   │       │   ├── reformat.ts
│   │       │   └── upgrade.ts
│   │       ├── image/
│   │       │   ├── webp-converter.ts
│   │       │   ├── compressor.ts
│   │       │   └── download-remote.ts    # ⭐ 新增
│   │       ├── font/
│   │       │   ├── subsetter.ts
│   │       │   └── encryptor.ts
│   │       ├── crypto/
│   │       │   ├── encrypt.ts
│   │       │   └── decrypt.ts
│   │       ├── txt/                      # ⭐ 新增模块
│   │       │   ├── txt-parser.ts         # TXT 解析
│   │       │   ├── chapter-splitter.ts   # 章节分割
│   │       │   └── epub-creator.ts       # 生成 EPUB
│   │       ├── chinese/                  # ⭐ 新增模块
│   │       │   └── converter.ts          # 简繁转换
│   │       ├── edit/
│   │       │   ├── workspace.ts
│   │       │   ├── watcher.ts
│   │       │   └── packer.ts
│   │       ├── bridge/
│   │       │   └── python-runner.ts
│   │       └── utils/
│   │           ├── logger.ts
│   │           ├── config.ts
│   │           └── tool-checker.ts
│   │
│   ├── cli/                        # CLI 入口
│   │   └── src/
│   │       ├── index.ts
│   │       └── commands/
│   │           ├── process.ts
│   │           ├── convert-webp.ts
│   │           ├── compress.ts
│   │           ├── reformat.ts
│   │           ├── encrypt.ts
│   │           ├── decrypt.ts
│   │           ├── encrypt-font.ts
│   │           ├── subset-fonts.ts
│   │           ├── txt-to-epub.ts        # ⭐ 新增
│   │           ├── chinese-convert.ts    # ⭐ 新增
│   │           ├── download-images.ts    # ⭐ 新增
│   │           ├── edit.ts
│   │           ├── doctor.ts
│   │           └── gui.ts
│   │
│   └── gui/                        # Tauri 桌面应用
│       ├── package.json
│       ├── vite.config.ts
│       ├── src/                    # React 前端
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── FileList.tsx
│       │   │   ├── ActionBar.tsx         # ⭐ 更新：新增按钮
│       │   │   ├── LogPanel.tsx
│       │   │   ├── ProgressBar.tsx
│       │   │   └── SettingsDialog.tsx
│       │   └── lib/
│       │       └── tauri-bridge.ts
│       └── src-tauri/              # Rust 后端
│           ├── Cargo.toml
│           ├── tauri.conf.json
│           └── src/
│               ├── main.rs
│               ├── commands.rs
│               └── sidecar.rs
│
├── py-scripts/                     # Python 脚本（仅字体混淆）
│   ├── requirements.txt
│   ├── encrypt_font.py
│   └── utils/
│       └── log.py
│
├── skills/                         # 可复用独立脚本
│   ├── README.md
│   ├── ts/
│   │   ├── batch-rename.ts
│   │   ├── extract-toc.ts
│   │   ├── find-broken-links.ts
│   │   ├── strip-metadata.ts
│   │   ├── epub-info.ts
│   │   ├── image-audit.ts
│   │   ├── css-cleanup.ts
│   │   ├── charset-scan.ts
│   │   ├── regex-replace.ts
│   │   ├── txt-to-epub.ts            # ⭐ 新增（CLI 入口）
│   │   ├── chinese-convert.ts        # ⭐ 新增（CLI 入口）
│   │   ├── regex-annotate.ts         # ⭐ 新增
│   │   ├── merge-epub.ts             # ⭐ 新增
│   │   └── split-epub.ts             # ⭐ 新增
│   └── py/
│       ├── font-info.py
│       ├── font-diff.py
│       └── glyph-preview.py
│
├── docs/
│   ├── archive/
│   │   ├── plan-epubToolsV2.prompt.md        # 原始计划
│   │   └── plan-epubToolsV2-updated.md       # ⭐ 本文档
│   └── comparison-with-wangyyyqw-epub.md     # ⭐ 对比分析
│
└── tests/
    ├── fixtures/
    ├── core/
    ├── cli/
    └── skills/
```

---

## 五、技术栈清单（v2.1 更新）

### 5.1 核心库（`packages/core`）

| 包 | 用途 | 版本要求 |
|----|------|---------|
| `sharp` | 图片格式转换与压缩 | latest |
| `subset-font` | 字体子集化 | latest |
| `cheerio` | HTML/XHTML 解析 | latest |
| `fast-xml-parser` | XML/OPF 解析 | latest |
| `css-tree` | CSS 解析与修改 | latest |
| `jszip` | EPUB ZIP 读写 | latest |
| `simple-git` | Git 操作 | latest |
| `chokidar` | 文件监听 | latest |
| `string-similarity` | 模糊匹配 | latest |
| **`opencc-js`** ⭐ | **简繁转换** | **latest** |
| **`axios`** ⭐ | **HTTP 请求（下载图片）** | **latest** |

### 5.2 开发与测试

| 包 | 用途 |
|----|------|
| `fast-check` ⭐ | 属性测试（借鉴 wangyyyqw/epub） |
| `vitest` | 单元测试 |
| `tsx` | TS 执行器 |

### 5.3 外部工具

| 工具 | 用途 | 必装？ |
|------|------|--------|
| `jpegoptim` | JPEG 无损优化 | 推荐 |
| `oxipng` | PNG 快速压缩 | 推荐 |
| `zopflipng` | PNG 极限压缩 | 可选 |

### 5.4 Python（仅字体混淆）

| 包 | 用途 |
|----|------|
| `fonttools` | 字体操作 |
| `beautifulsoup4` | HTML 解析 |
| `tinycss2` | CSS 解析 |

---

## 六、CLI 设计（v2.1 更新）

```bash
# === 一键处理 ===
epub-tools process book.epub -o output/ --convert-webp --compress --subset-fonts

# === 单项功能（原有） ===
epub-tools convert-webp book.epub -o output/
epub-tools compress book.epub -o output/ --level balanced
epub-tools subset-fonts book.epub -o output/
epub-tools reformat book.epub -o output/
epub-tools encrypt book.epub -o output/
epub-tools decrypt book.epub -o output/
epub-tools encrypt-font book.epub -o output/

# === 新增功能 ⭐ ===
epub-tools txt-to-epub book.txt -o book.epub           # TXT 转 EPUB
epub-tools chinese-convert book.epub -o output/ --to traditional  # 简→繁
epub-tools chinese-convert book.epub -o output/ --to simplified   # 繁→简
epub-tools download-images book.epub -o output/        # 下载远程图片

# === 编辑工作流 ===
epub-tools edit book.epub
epub-tools watch ~/.epub-workspace/book/
epub-tools pack ~/.epub-workspace/book/ -o out.epub

# === Skills ===
epub-tools skill txt-to-epub book.txt                  # ⭐ 新增
epub-tools skill chinese-convert book.epub --to traditional
epub-tools skill regex-annotate book.epub              # ⭐ 新增
epub-tools skill merge-epub book1.epub book2.epub      # ⭐ 新增
epub-tools skill split-epub book.epub                  # ⭐ 新增
epub-tools skill epub-info book.epub
epub-tools skill charset-scan book.epub
epub-tools skill list

# === 工具 ===
epub-tools doctor
epub-tools gui
```

---

## 七、GUI 布局（v2.1 更新）

```text
┌─────────────────────────────────────────────────────────────┐
│  EPUB Tools                                    [设置] [主题] │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│  侧边栏   │  📂 待处理文件                                    │
│          │  ┌──────────────────────────────────────────┐    │
│ [添加文件] │  │  #  文件名           路径              状态  │    │
│ [添加文件夹]│  │  1  book1.epub      /Users/.../book1  待处理│    │
│ [清空列表] │  │  2  book.txt        /Users/.../book   待处理│ ⭐ │
│          │  └──────────────────────────────────────────┘    │
│ ──────── │                                                  │
│          │  📁 输出路径: [默认: 源文件同级目录] [选择] [重置]   │
│ 使用说明  │                                                  │
│ · 拖拽添加│  🔧 操作                                          │
│ · 右键菜单│  ┌────────────────── 基础功能 ──────────────────┐│
│ · TXT文件 │  │[格式化] [解密] [加密] [字体加密]              ││
│          │  │[图片转换] [图片压缩▾] [字体子集化]            ││
│ GitHub ↗ │  └───────────────────────────────────────────────┘│
│          │  ┌────────────────── 新增功能 ⭐ ───────────────┐│
│          │  │[TXT→EPUB] [简繁转换] [下载远程图片]          ││
│          │  │[EPUB合并] [EPUB拆分] [正则注释]              ││
│          │  └───────────────────────────────────────────────┘│
│          │                                                  │
│          │  ████████████████████░░░░  75%  处理中...          │
│          │                                                  │
│          │  📋 执行日志                                       │
│          │  ┌──────────────────────────────────────────┐    │
│          │  │ ✅ book1.epub  图片转换成功                │    │
│          │  │ ✅ book.txt   转换为 EPUB 成功  ⭐         │    │
│          │  └──────────────────────────────────────────┘    │
└──────────┴──────────────────────────────────────────────────┘
```

**新增功能说明**：
- **TXT→EPUB**：支持 `.txt` 文件拖拽，自动章节识别
- **简繁转换**：基于 OpenCC.js，词组级精确转换
- **下载远程图片**：EPUB 内 `<img src="http://...">` 自动下载并本地化
- **EPUB合并/拆分**：多卷书籍处理
- **正则注释**：根据正则规则批量添加注释/脚注

---

## 八、实施计划（v2.1 更新）

### Sprint 1：Monorepo 骨架 + EPUB 核心（2 天）✅ 已完成

- [x] 初始化 pnpm workspace monorepo
- [x] `packages/core`: EPUB 解析器/打包器
- [x] `packages/cli`: 基础骨架 + `doctor` 命令
- [x] `skills/` 目录初始化
- [x] 工具检测（`tool-checker.ts`）

### Sprint 2：TS 重写 — 图片 + 格式化 + 加解密（3-4 天）✅ 已完成

- [x] `epub/reformat.ts` — TS 重写
- [x] `image/webp-converter.ts` — sharp WebP 转换
- [x] `image/compressor.ts` — 图片压缩封装
- [x] `crypto/encrypt.ts` + `decrypt.ts` — 加密解密
- [x] `epub/upgrade.ts` — EPUB2 → EPUB3.2
- [x] CLI 命令对接
- [x] 旧 Python 文件清理（删除 utils/, build_tool/, Epub_Tool_*.py, requirements.txt）

### **Sprint 2.5：借鉴功能实现（3-4 天）⭐ 新增**

- [ ] **TXT → EPUB**：
  - [ ] `txt/txt-parser.ts` — TXT 解析
  - [ ] `txt/chapter-splitter.ts` — 自动章节识别（正则）
  - [ ] `txt/epub-creator.ts` — 生成 EPUB 结构
  - [ ] CLI 命令：`txt-to-epub`
  - [ ] GUI 按钮：支持 `.txt` 文件拖拽
- [ ] **简繁转换**：
  - [ ] `chinese/converter.ts` — OpenCC.js 封装
  - [ ] CLI 命令：`chinese-convert`
  - [ ] GUI 按钮：简繁转换
- [ ] **下载远程图片**：
  - [ ] `image/download-remote.ts` — axios + sharp
  - [ ] 集成到图片处理流程
  - [ ] GUI 按钮
- [ ] **正则注释/脚注**：
  - [ ] `skills/ts/regex-annotate.ts`
  - [ ] GUI 高级功能区
- [ ] **EPUB 合并/拆分**：
  - [ ] `skills/ts/merge-epub.ts`
  - [ ] `skills/ts/split-epub.ts`
  - [ ] CLI 命令 + GUI 按钮

### Sprint 3：字体处理 + Python 桥接（2 天）

- [ ] `font/subsetter.ts` — subset-font
- [ ] `font/encryptor.ts` + `bridge/python-runner.ts`
- [ ] 复制 `encrypt_font.py` 到 `py-scripts/`
- [ ] CLI 命令：`encrypt-font`, `subset-fonts`

### Sprint 4：编辑工作流 + 一键流水线（2 天）

- [ ] `edit/workspace.ts` + Git 集成
- [ ] `edit/watcher.ts` — chokidar + simple-git
- [ ] `edit/packer.ts`
- [ ] `process` 一键命令
- [ ] 批量处理 `--recursive`

### Sprint 5：Skills 脚本（1-2 天）

- [ ] TS skills：`epub-info`, `charset-scan`, `find-broken-links`
- [ ] Python skills：`font-info.py`
- [ ] CLI `skill` 子命令

### Sprint 6：Tauri GUI（4-5 天）

- [ ] Tauri 项目初始化
- [ ] React + TailwindCSS + shadcn/ui
- [ ] 前端组件（含新增功能按钮）
- [ ] Rust 后端 IPC + sidecar
- [ ] Node.js SEA 编译
- [ ] 深色/浅色主题

### Sprint 7：测试 + CI/CD + 文档（2 天）

- [ ] vitest 单元测试
- [ ] **fast-check 属性测试** ⭐ 新增
- [ ] GitHub Actions：三平台测试 + Tauri 构建
- [ ] README（中英文）
- [ ] setup.sh / setup.ps1

---

## 九、测试策略（v2.1 新增）

### 9.1 单元测试 (vitest)

常规功能测试：
- EPUB 解析/打包正确性
- 路径映射准确性
- 加密/解密可逆性

### 9.2 属性测试 (fast-check) ⭐ 借鉴 wangyyyqw/epub

测试不变性 (Invariants)：
```typescript
// 示例：EPUB 打包/解包应保持文件一致
test('EPUB pack/unpack roundtrip', () => {
  fc.assert(
    fc.property(fc.epubFixture(), async (epub) => {
      const packed = await packEpub(epub);
      const unpacked = await unpackEpub(packed);
      expect(unpacked).toEqual(epub);
    })
  );
});

// 示例：路径映射应保持引用完整性
test('path remap preserves references', () => {
  fc.assert(
    fc.property(fc.pathMap(), fc.htmlContent(), (pathMap, html) => {
      const remapped = remapPaths(html, pathMap);
      const links = extractLinks(remapped);
      expect(links.every(link => pathMap.has(link))).toBe(true);
    })
  );
});
```

### 9.3 集成测试

- TXT → EPUB 生成的文件能否被 Calibre/Sigil 打开
- 简繁转换的词组级准确性
- 下载远程图片的完整性

---

## 十、依赖环境要求（v2.1 更新）

### 开发环境

```text
必须：Node.js 22+, pnpm 10+
构建 GUI：Rust toolchain (rustup)
推荐：jpegoptim, oxipng
可选：Python 3.9+（字体混淆功能）
可选：zopflipng（PNG 极限压缩）
```

### 最终用户（Tauri 打包应用）

```text
无需：Node.js / Rust
字体混淆：需系统 Python 3.9+
图片压缩：需 jpegoptim / oxipng（应用内提供安装引导）
```

---

## 十一、总结

### v2.1 核心变更

1. ✅ **新增 TXT → EPUB 转换**（借鉴 wangyyyqw/epub）
2. ✅ **新增简繁转换**（OpenCC.js，词组级精确）
3. ✅ **新增远程图片下载**（网络资源本地化）
4. ✅ **新增 EPUB 合并/拆分**（高级功能）
5. ✅ **新增正则注释/脚注**（批量编辑）
6. ✅ **引入属性测试**（fast-check，提升质量）
7. ❌ **明确不做拼音注音**（用户不需要）

### 技术优势

- **TS 优先**：核心逻辑全 TS，依赖少
- **Tauri 轻量**：10-15MB 打包体积
- **Monorepo**：代码组织清晰
- **Skills 体系**：可复用工具集
- **创新功能**：编辑工作流 + Git 集成

### 借鉴最佳实践

- **TXT 转换**：自动章节识别逻辑优秀
- **简繁转换**：词组级转换精度高
- **属性测试**：保证边界情况正确性
- **插件架构**：便于功能扩展

---

**结论**：v2.1 方案在保持技术栈优势的前提下，选择性引入 wangyyyqw/epub 的核心功能（TXT 转换、简繁转换、远程图片），同时明确排除不必要的拼音功能，形成更完善的 EPUB 工具链。
