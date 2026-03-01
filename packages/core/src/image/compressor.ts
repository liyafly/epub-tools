/**
 * 图片压缩
 * 使用 sharp 压缩 EPUB 中的 JPEG / PNG 图片
 */

import { EpubParser } from '../epub/parser.js';
import { EpubWriter } from '../epub/writer.js';
import { logger } from '../utils/logger.js';
import sharp from 'sharp';
import path from 'node:path';

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

interface LevelSettings {
  jpegQuality: number;
  mozjpeg: boolean;
  pngCompressionLevel: number;
  pngEffort: number;
}

const LEVEL_SETTINGS: Record<CompressionLevel, LevelSettings> = {
  fast: { jpegQuality: 85, mozjpeg: false, pngCompressionLevel: 6, pngEffort: 1 },
  balanced: { jpegQuality: 80, mozjpeg: false, pngCompressionLevel: 8, pngEffort: 5 },
  max: { jpegQuality: 75, mozjpeg: true, pngCompressionLevel: 9, pngEffort: 10 },
};

/**
 * 压缩 EPUB 中的图片
 * - fast: JPEG quality 85, PNG compressionLevel 6
 * - balanced: JPEG quality 80, PNG compressionLevel 8
 * - max: JPEG quality 75 + mozjpeg, PNG compressionLevel 9 + effort 10
 */
export async function compressImages(
  _epubPath: string,
  _options: CompressOptions,
): Promise<CompressResult> {
  const { outputPath, level = 'balanced' } = _options;
  const settings = LEVEL_SETTINGS[level];

  const result: CompressResult = {
    success: false,
    totalImages: 0,
    compressed: 0,
    savedBytes: 0,
    details: [],
  };

  logger.info(`Compressing images in: ${_epubPath} (level: ${level})`);
  const epub = await EpubParser.fromFile(_epubPath);
  const { zip, manifest, opfDir } = epub;

  // Find all JPEG and PNG images in the manifest
  const imageItems = [...manifest.values()].filter(
    (item) =>
      item.mediaType === 'image/jpeg' ||
      item.mediaType === 'image/png',
  );

  result.totalImages = imageItems.length;

  if (imageItems.length === 0) {
    logger.info('No JPEG/PNG images found in manifest');
    result.success = true;
    await EpubWriter.write(zip, { outputPath });
    return result;
  }

  for (const item of imageItems) {
    const zipPath = opfDir ? `${opfDir}/${item.href}` : item.href;
    const file = zip.file(zipPath);
    if (!file) {
      logger.warn(`Image file not found in archive: ${zipPath}`);
      continue;
    }

    const originalBuffer = await file.async('nodebuffer');
    const originalSize = originalBuffer.length;
    const fileName = path.posix.basename(item.href);

    let compressedBuffer: Buffer;
    try {
      if (item.mediaType === 'image/jpeg') {
        compressedBuffer = await sharp(originalBuffer)
          .jpeg({
            quality: settings.jpegQuality,
            mozjpeg: settings.mozjpeg,
          })
          .toBuffer();
      } else {
        compressedBuffer = await sharp(originalBuffer)
          .png({
            compressionLevel: settings.pngCompressionLevel,
            effort: settings.pngEffort,
          })
          .toBuffer();
      }
    } catch (err) {
      logger.warn(`Failed to compress ${fileName}: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    const compressedSize = compressedBuffer.length;

    // Only use compressed version if it's actually smaller
    if (compressedSize < originalSize) {
      zip.file(zipPath, compressedBuffer);
      const saved = originalSize - compressedSize;
      result.compressed++;
      result.savedBytes += saved;
      const savings = ((saved / originalSize) * 100).toFixed(1) + '%';
      result.details.push({ file: fileName, originalSize, compressedSize, savings });
      logger.debug(`Compressed: ${fileName} (${savings} saved)`);
    } else {
      result.details.push({
        file: fileName,
        originalSize,
        compressedSize: originalSize,
        savings: '0.0%',
      });
      logger.debug(`Skipped: ${fileName} (compressed would be larger)`);
    }
  }

  await EpubWriter.write(zip, { outputPath });
  result.success = true;

  logger.info(
    `Compression complete: ${result.compressed}/${result.totalImages} images compressed, ` +
    `${(result.savedBytes / 1024).toFixed(1)} KB saved`,
  );
  return result;
}
