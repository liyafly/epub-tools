/**
 * EPUB 格式规范化
 * TS 重写 reformat_epub.py — 重组为 Sigil 标准目录结构
 */
import type { ParsedEpub } from './parser.js';

export interface ReformatOptions {
  /** 输出路径 */
  outputPath: string;
  /** 是否保留原始目录结构备份 */
  keepBackup?: boolean;
}

export interface ReformatResult {
  success: boolean;
  inputPath: string;
  outputPath: string;
  filesRenamed: number;
  referencesUpdated: number;
  errors: string[];
}

/**
 * 重构 EPUB 为标准 Sigil 目录结构
 *
 * 目标结构:
 * - OEBPS/Text/     (XHTML 文档)
 * - OEBPS/Styles/   (CSS)
 * - OEBPS/Images/   (图片)
 * - OEBPS/Fonts/    (字体)
 * - OEBPS/Audio/    (音频)
 * - OEBPS/Video/    (视频)
 * - OEBPS/Misc/     (其他)
 */
export async function reformatEpub(
  _epub: ParsedEpub,
  _options: ReformatOptions,
): Promise<ReformatResult> {
  // TODO: Sprint 2 实现
  // 1. 解析 manifest 分类文件 (text/css/image/font/audio/video)
  // 2. 构建路径映射 Map<oldPath, newPath>
  // 3. 移动文件到标准目录
  // 4. 使用 cheerio 更新 XHTML 中的引用路径
  // 5. 使用 css-tree 更新 CSS 中的 url() 路径
  // 6. 更新 OPF manifest href
  // 7. 处理 NCX/NAV 中的引用
  throw new Error('Not implemented yet — Sprint 2');
}
