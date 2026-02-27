/**
 * 图片压缩
 * 封装 jpegoptim / oxipng / zopflipng
 */

export type CompressionLevel = 'fast' | 'balanced' | 'max';

export interface CompressOptions {
  /** 输出路径 */
  outputPath: string;
  /** 压缩级别 */
  level?: CompressionLevel;
}

export interface CompressResult {
  success: boolean;
  totalImages: number;
  compressed: number;
  savedBytes: number;
  details: Array<{
    file: string;
    originalSize: number;
    compressedSize: number;
    savings: string;
  }>;
}

/**
 * 压缩 EPUB 中的图片
 * - fast: oxipng 默认参数 (PNG), jpegoptim (JPEG)
 * - balanced: oxipng -o 4 (PNG), jpegoptim (JPEG)
 * - max: zopflipng (PNG), mozjpeg (JPEG)
 */
export async function compressImages(
  _epubPath: string,
  _options: CompressOptions,
): Promise<CompressResult> {
  // TODO: Sprint 2 实现
  // 1. 解析 EPUB，分类 JPEG/PNG 图片
  // 2. 检测外部工具可用性 (jpegoptim/oxipng/zopflipng)
  // 3. 按级别调用对应工具
  // 4. 替换 EPUB 中的原图片
  throw new Error('Not implemented yet — Sprint 2');
}
