# Skills — 可复用独立脚本/工具集

`skills/` 目录包含独立可复用的小工具脚本，每个专注做一件事。

## 使用方式

### TS 脚本
```bash
npx tsx skills/ts/epub-info.ts <epub_path>
npx tsx skills/ts/charset-scan.ts <epub_path>
npx tsx skills/ts/find-broken-links.ts <epub_path>
```

### Python 脚本
```bash
python skills/py/font-info.py <font_path>
python skills/py/font-diff.py <font_a> <font_b>
```

### 通过 CLI 调用
```bash
epub-tools skill epub-info book.epub
epub-tools skill list
```

## 脚本索引

### TypeScript (`skills/ts/`)

| 脚本 | 功能 |
|------|------|
| `epub-info.ts` | 打印 EPUB 基本信息 |
| `charset-scan.ts` | 扫描使用的字符集 |
| `find-broken-links.ts` | 检测 EPUB 内部断链 |
| `batch-rename.ts` | 批量重命名 |
| `extract-toc.ts` | 提取目录 |
| `strip-metadata.ts` | 清除元数据 |
| `image-audit.ts` | 图片审计 |
| `css-cleanup.ts` | CSS 清理 |
| `regex-replace.ts` | 正则替换 |

### Python (`skills/py/`)

| 脚本 | 功能 | 依赖 |
|------|------|------|
| `font-info.py` | 字体元信息 | fonttools |
| `font-diff.py` | 字形差异对比 | fonttools |
| `glyph-preview.py` | 字形预览 | fonttools, Pillow |

## 统一约定

- 第一个参数通常是 EPUB 或字体文件路径
- 输出到 stdout（可管道组合）
- 退出码: 0=成功, 1=失败
