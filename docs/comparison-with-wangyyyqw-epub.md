# wangyyyqw/epub 仓库对比分析与借鉴

## 一、仓库概况对比

| 维度 | wangyyyqw/epub | 本项目 (liyafly/epub-tools) |
|------|----------------|----------------------------|
| **技术架构** | Go (Wails) + Vue 3 + Python | TypeScript + Tauri + React + Python (最小化) |
| **后端语言** | Python (核心逻辑) | TypeScript (核心) + Python (仅字体混淆) |
| **GUI 框架** | Wails v2 | Tauri 2.x |
| **前端框架** | Vue 3 + Tailwind CSS | React 18 + TailwindCSS + shadcn/ui |
| **项目定位** | 一站式 EPUB 工具箱 | 跨平台 EPUB 处理工具 |
| **主要用途** | 中文 EPUB 处理（简繁转换、注音、注释） | 通用 EPUB 处理（格式化、加密、图片优化） |

---

## 二、功能特性对比

### 2.1 两个仓库的共同功能

| 功能 | wangyyyqw/epub 实现 | 本项目计划实现 | 说明 |
|------|-------------------|--------------|------|
| **EPUB 重构** | `reformat_epub.py` | `epub/reformat.ts` (TS 重写) | ✅ 都实现标准化目录结构 |
| **加密/解密** | `encrypt_epub.py` / `decrypt_epub.py` | `crypto/encrypt.ts` / `decrypt.ts` (TS 重写) | ✅ 文件名加密算法相同 |
| **字体混淆** | `encrypt_font.py` | `font/encryptor.ts` (桥接 Python) | ✅ 都依赖 fontTools |
| **图片压缩** | `img_compress.py` (Pillow) | `image/compressor.ts` (jpegoptim/oxipng) | 🔄 本项目用外部工具，性能更好 |
| **WebP 转换** | `webp_to_img.py` / `img_to_webp.py` | `image/webp-converter.ts` (sharp) | 🔄 本项目用 sharp (更快) |
| **字体子集化** | `font_subset.py` (fontTools) | `font/subsetter.ts` (subset-font) | 🔄 本项目用 JS 库 (跨平台) |
| **EPUB2→3 升级** | `convert_version.py` | `epub/upgrade.ts` | ✅ 都支持版本升级 |

### 2.2 wangyyyqw/epub 特有功能 (值得借鉴)

| 功能 | 实现文件 | 是否适合本项目 | 借鉴建议 |
|------|---------|--------------|---------|
| **TXT → EPUB** | `txt_to_epub/` | ⭐⭐⭐ **强烈推荐** | 添加到 `skills/` 或 core 模块 |
| **简繁转换** | `chinese_convert.py` | ⭐⭐⭐ **推荐** | 作为可选 skill (基于 OpenCC.js) |
| **拼音注音** | `pinyin_annotate.py` | ❌ **不需要** | 用户明确表示不需要 |
| **生僻字注音** | `phonetic_notation.py` | ❌ **不需要** | 与拼音功能相关 |
| **正则注释/脚注** | `regex_comment.py` / `regex_footnote.py` | ⭐⭐ **可选** | 可作为高级 skill |
| **脚注格式转换** | `yuewei_to_duokan.py` / `zhangyue_to_duokan.py` | ⭐ **可选** | 中文阅读器特定功能 |
| **下载远程图片** | `download_web_images.py` | ⭐⭐⭐ **推荐** | 实用功能，可加入 core |
| **EPUB 合并** | `merge_epub.py` | ⭐⭐ **可选** | 高级功能，可作为 skill |
| **EPUB 拆分** | `split_epub.py` | ⭐⭐ **可选** | 高级功能，可作为 skill |

### 2.3 本项目特有功能 (优势)

| 功能 | 实现计划 | 优势说明 |
|------|---------|---------|
| **编辑工作流** | `edit/workspace.ts` + Git | 🌟 wangyyyqw/epub 没有，本项目创新点 |
| **Skills 脚本体系** | `skills/` 目录 | 🌟 可复用工具集，便于扩展 |
| **EPUB 信息审计** | `skills/ts/epub-info.ts` | 快速查看 EPUB 元信息 |
| **断链检测** | `skills/ts/find-broken-links.ts` | 质量保证工具 |
| **CSS 清理** | `skills/ts/css-cleanup.ts` | 未使用规则清理 |
| **字符集扫描** | `skills/ts/charset-scan.ts` | 字体子集化辅助 |
| **Monorepo 架构** | pnpm workspace | 更好的代码组织 |

---

## 三、技术栈对比

### 3.1 GUI 框架对比

| 维度 | Wails (wangyyyqw/epub) | Tauri (本项目) |
|------|----------------------|---------------|
| 后端语言 | Go | Rust |
| 打包体积 | ~20-30MB | ~10-15MB ✅ |
| 内存占用 | 低 | 极低 ✅ |
| 前端灵活性 | ✅ 完整 Web 技术 | ✅ 完整 Web 技术 |
| 自动更新 | 需自行实现 | tauri-updater 内置 ✅ |
| 社区活跃度 | 中等 | 高 ✅ |
| 学习曲线 | Go (简单) | Rust (陡峭) ⚠️ |

**结论**：Tauri 更轻量，生态更活跃，本项目选择正确。

### 3.2 Python 依赖对比

| 维度 | wangyyyqw/epub | 本项目 |
|------|----------------|--------|
| Python 角色 | **核心业务逻辑** | **仅字体混淆** ✅ |
| Python 模块数 | ~15+ 个 .py 文件 | 1 个 `encrypt_font.py` ✅ |
| 依赖复杂度 | 高 (OpenCC, pypinyin, etc.) | 低 (仅 fonttools) ✅ |
| 可移植性 | 需 Python 环境 | 大部分功能无需 Python ✅ |

**结论**：本项目 TS 优先策略更合理，降低用户依赖负担。

---

## 四、值得借鉴的设计模式

### 4.1 插件化架构 ⭐⭐⭐

**wangyyyqw/epub 的设计**：
```text
backend-py/
├── core/
│   └── plugin_base.py        # 插件基类
├── plugins/
│   ├── epub_tool/             # EPUB 处理插件
│   │   ├── plugin.py
│   │   └── utils/             # 17+ 工具脚本
│   └── txt_to_epub/           # TXT 转换插件
│       ├── plugin.py
│       ├── chapter_splitter.py
│       └── epub_creator.py
```

**借鉴建议**：
- 本项目的 `skills/` 目录类似思想，但更轻量
- 可以在 `packages/core/src/plugins/` 引入插件接口
- 让用户自定义扩展处理逻辑

### 4.2 完善的属性测试 (Property-Based Testing) ⭐⭐

**观察**：
- wangyyyqw/epub 使用 Hypothesis 做属性测试（见 `test_prop_*.py`）
- 测试 EPUB 合并/拆分的边界情况

**借鉴建议**：
- 本项目可用 `fast-check` (TS 的 Hypothesis 等价库)
- 重点测试：路径解析、OPF 操作、ZIP 打包

### 4.3 TXT → EPUB 自动章节识别 ⭐⭐⭐

**实现逻辑** (`txt_to_epub/chapter_splitter.py`):
1. 正则匹配章节标题（如 "第一章"、"Chapter 1"）
2. 支持自定义正则规则
3. 生成分层目录（支持卷 → 章 → 节）

**借鉴建议**：
- **添加到本项目** `skills/ts/txt-to-epub.ts`
- 用 TS 重写，依赖 `cheerio` 生成 XHTML
- 集成到 CLI：`epub-tools skill txt-to-epub book.txt -o book.epub`

---

## 五、需要避免的设计

### 5.1 过度依赖 Python ❌

**wangyyyqw/epub 问题**：
- 核心逻辑全在 Python，Go 只是壳
- 用户必须安装 Python + 10+ 依赖包
- 跨平台打包困难（需 PyInstaller）

**本项目优势**：
- TS 为主，Python 最小化 ✅
- 大部分功能无需 Python

### 5.2 单体脚本文件 ❌

**wangyyyqw/epub 问题**：
- 单个 .py 文件 >1000 行（如 `decrypt_epub.py` 43KB）
- 函数耦合严重，难以复用

**本项目优势**：
- Monorepo 模块化 ✅
- 每个模块职责单一

---

## 六、推荐引入的功能（优先级排序）

### 高优先级 ⭐⭐⭐

1. **TXT → EPUB 转换**
   - 文件：借鉴 `txt_to_epub/` 整套逻辑
   - 实现：`skills/ts/txt-to-epub.ts` 或 `packages/core/src/txt/`
   - 价值：补充核心功能缺失

2. **简繁转换**
   - 文件：借鉴 `chinese_convert.py`
   - 实现：`skills/ts/chinese-convert.ts` (基于 OpenCC.js)
   - 价值：中文用户刚需

3. **下载远程图片**
   - 文件：借鉴 `download_web_images.py`
   - 实现：`packages/core/src/image/download-remote.ts` (axios + sharp)
   - 价值：EPUB 网络资源本地化

### 中优先级 ⭐⭐

4. **正则注释/脚注生成**
   - 文件：借鉴 `regex_comment.py` / `regex_footnote.py`
   - 实现：`skills/ts/regex-annotate.ts`
   - 价值：高级编辑功能

5. **EPUB 合并/拆分**
   - 文件：借鉴 `merge_epub.py` / `split_epub.py`
   - 实现：`skills/ts/merge-epub.ts` / `split-epub.ts`
   - 价值：多卷书籍处理

### 低优先级 ⭐

6. **脚注格式转换**
   - 文件：`yuewei_to_duokan.py` 等
   - 实现：可选 skill
   - 价值：仅限特定中文阅读器

---

## 七、不引入的功能（明确排除）

| 功能 | 理由 |
|------|------|
| **拼音注音** (`pinyin_annotate.py`) | ❌ 用户明确表示不需要 |
| **生僻字注音** (`phonetic_notation.py`) | ❌ 与拼音功能相关，不需要 |
| **注音字典** (`dict/` 目录) | ❌ 拼音功能的依赖数据 |

---

## 八、最终建议的功能调整

### 8.1 新增功能

在原 v2 计划基础上 **新增**：

```typescript
// packages/core/src/txt/
├── txt-parser.ts          // TXT 解析器
├── chapter-splitter.ts    // 章节分割（正则识别）
└── epub-creator.ts        // 从 TXT 生成 EPUB

// packages/core/src/chinese/
└── converter.ts           // 简繁转换（OpenCC.js）

// packages/core/src/image/
└── download-remote.ts     // 下载远程图片

// skills/ts/
├── txt-to-epub.ts         // TXT → EPUB CLI
├── chinese-convert.ts     // 简繁转换 CLI
├── regex-annotate.ts      // 正则注释/脚注
├── merge-epub.ts          // EPUB 合并
└── split-epub.ts          // EPUB 拆分
```

### 8.2 技术栈调整

新增依赖：

| 包 | 用途 | 优先级 |
|----|------|--------|
| `opencc-js` | 简繁转换 | 高 ⭐⭐⭐ |
| `axios` | 下载远程图片 | 高 ⭐⭐⭐ |
| `fast-check` | 属性测试 | 中 ⭐⭐ |

### 8.3 GUI 功能扩展

在 Tauri GUI 中新增按钮：

```text
[格式化] [解密] [加密] [字体加密] [图片转换] [图片压缩▾] [字体子集化]
                                                    ↓ 新增
              [TXT→EPUB] [简繁转换] [下载远程图片] [EPUB合并] [EPUB拆分]
```

---

## 九、实施计划调整

在原 Sprint 计划基础上 **插入新 Sprint**：

### Sprint 2.5：借鉴功能实现（3-4 天）

- [ ] **TXT → EPUB**：`txt/` 模块 + CLI 命令 + GUI 按钮
- [ ] **简繁转换**：`chinese/converter.ts` + skill + GUI 按钮
- [ ] **下载远程图片**：`image/download-remote.ts` + 集成到图片处理流程
- [ ] **正则注释**：`skills/ts/regex-annotate.ts`
- [ ] **EPUB 合并/拆分**：`skills/ts/merge-epub.ts` / `split-epub.ts`

---

## 十、总结

### wangyyyqw/epub 的优势
1. ✅ **功能全面**：覆盖中文 EPUB 处理全流程
2. ✅ **TXT 转换**：自动章节识别做得好
3. ✅ **简繁转换**：基于词组，精度高
4. ✅ **插件架构**：代码组织清晰

### 本项目的优势
1. ✅ **技术栈更现代**：TS + Tauri > Python + Wails
2. ✅ **依赖更轻量**：Python 最小化
3. ✅ **架构更合理**：Monorepo + Skills
4. ✅ **创新功能**：编辑工作流 + Git 集成

### 最佳实践
- **借鉴 wangyyyqw/epub**：TXT 转换、简繁转换、远程图片下载
- **保持本项目优势**：TS 优先、轻量化、模块化
- **明确不做**：拼音注音（用户不需要）

---

**最终方案**：在保持本项目技术栈和架构优势的前提下，选择性引入 wangyyyqw/epub 的 **TXT 转换**、**简繁转换**、**远程图片下载** 三大核心功能，作为 TS 实现的补充模块。
