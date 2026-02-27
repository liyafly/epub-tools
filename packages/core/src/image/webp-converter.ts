/**
 * WebP → JPG/PNG 图片格式转换
 * 使用 sharp (libvips) 替代 Python Pillow
 */

export interface WebpConvertOptions {
  /** 输出路径 */
  outputPath: string;
  /** JPEG 质量 (1-100, 默认 85) */
  jpegQuality?: number;
  /** PNG 压缩级别 (0-9, 默认 6) */
  pngCompressionLevel?: number;
}

export interface ConvertResult {
  success: boolean;
  converted: number;
  skipped: number;
  details: Array<{
    from: string;
    to: string;
    format: 'jpeg' | 'png';
    hasAlpha: boolean;
  }>;
}

/**
 * 将 EPUB 中的 WebP 图片转换为 JPG/PNG
 * - 有透明通道 → PNG
 * - 无透明通道 → JPEG
 */
export async function convertWebp(
  _epubPath: string,
  _options: WebpConvertOptions,
): Promise<ConvertResult> {
  // TODO: Sprint 2 实现
  // 1. 解析 EPUB，遍历 manifest 中的 .webp 文件
  // 2. sharp(buffer).metadata() 检测 hasAlpha
  // 3. 有透明度 → PNG，无透明度 → JPEG
  // 4. 更新 OPF manifest、HTML <img>/<image> 引用、CSS url() 引用
  throw new Error('Not implemented yet — Sprint 2');
}
