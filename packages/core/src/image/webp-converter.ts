/**
 * WebP → JPG/PNG 图片格式转换
 * 使用 sharp (libvips) 替代 Python Pillow
 */

import { EpubParser } from '../epub/parser.js';
import { EpubWriter } from '../epub/writer.js';
import { logger } from '../utils/logger.js';
import sharp from 'sharp';
import path from 'node:path';

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
  const { outputPath, jpegQuality = 85, pngCompressionLevel = 6 } = _options;
  const result: ConvertResult = {
    success: false,
    converted: 0,
    skipped: 0,
    details: [],
  };

  logger.info(`Converting WebP images in: ${_epubPath}`);
  const epub = await EpubParser.fromFile(_epubPath);
  const { zip, manifest, opfPath, opfDir, rawOpf } = epub;

  // 1. Find all webp items in manifest
  const webpItems = [...manifest.values()].filter(
    (item) =>
      item.mediaType === 'image/webp' ||
      item.href.toLowerCase().endsWith('.webp'),
  );

  if (webpItems.length === 0) {
    logger.info('No WebP images found in manifest');
    result.success = true;
    return result;
  }

  // 2. Convert each webp image
  // Maps old basename → [new basename, new media-type]
  const imgDict = new Map<string, [string, string]>();

  for (const item of webpItems) {
    const zipPath = opfDir ? `${opfDir}/${item.href}` : item.href;
    const file = zip.file(zipPath);
    if (!file) {
      logger.warn(`WebP file not found in archive: ${zipPath}`);
      result.skipped++;
      continue;
    }

    const buffer = await file.async('nodebuffer');
    let hasAlpha: boolean;
    try {
      const meta = await sharp(buffer).metadata();
      hasAlpha = meta.hasAlpha ?? false;
    } catch {
      logger.warn(`Failed to read image metadata: ${zipPath}`);
      result.skipped++;
      continue;
    }

    const oldBasename = path.posix.basename(item.href);
    let newBasename: string;
    let newMediaType: string;
    let format: 'jpeg' | 'png';
    let convertedBuffer: Buffer;

    if (hasAlpha) {
      newBasename = oldBasename.replace(/\.webp$/i, '.png');
      newMediaType = 'image/png';
      format = 'png';
      convertedBuffer = await sharp(buffer)
        .png({ compressionLevel: pngCompressionLevel })
        .toBuffer();
    } else {
      newBasename = oldBasename.replace(/\.webp$/i, '.jpg');
      newMediaType = 'image/jpeg';
      format = 'jpeg';
      convertedBuffer = await sharp(buffer)
        .jpeg({ quality: jpegQuality })
        .toBuffer();
    }

    imgDict.set(oldBasename, [newBasename, newMediaType]);

    // Replace file in archive
    const newZipPath = zipPath.replace(oldBasename, newBasename);
    zip.remove(zipPath);
    zip.file(newZipPath, convertedBuffer);

    result.converted++;
    result.details.push({ from: oldBasename, to: newBasename, format, hasAlpha });
    logger.info(`Converted: ${oldBasename} → ${newBasename} (${format})`);
  }

  if (imgDict.size === 0) {
    result.success = true;
    return result;
  }

  // 3. Update OPF manifest
  let updatedOpf = rawOpf;
  const idMapping = new Map<string, string>();

  // 3a. Update <item> elements with media-type="image/webp"
  updatedOpf = updatedOpf.replace(/<item\b[^>]*\/?>/g, (match) => {
    if (!/media-type\s*=\s*["']image\/webp["']/.test(match)) return match;

    const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/);
    if (!hrefMatch) return match;

    const basename = path.posix.basename(hrefMatch[1]);
    if (!imgDict.has(basename)) return match;

    const [newBasename, newMediaType] = imgDict.get(basename)!;
    const idMatch = match.match(/id\s*=\s*["']([^"']*)["']/);

    if (idMatch) {
      idMapping.set(idMatch[1], newBasename);
    }

    let updated = match;
    updated = updated.replace(
      hrefMatch[0],
      hrefMatch[0].replace(basename, newBasename),
    );
    updated = updated.replace(
      /media-type\s*=\s*["']image\/webp["']/,
      `media-type="${newMediaType}"`,
    );
    if (idMatch) {
      updated = updated.replace(
        new RegExp(`id\\s*=\\s*["']${escapeRegex(idMatch[1])}["']`),
        `id="${newBasename}"`,
      );
    }

    return updated;
  });

  // 3b. Update <meta name="cover"> if it references a converted image
  updatedOpf = updatedOpf.replace(
    /<meta\b[^>]*name\s*=\s*["']cover["'][^>]*\/?>/g,
    (match) => {
      const contentMatch = match.match(/content\s*=\s*(["'])([^"']*)\1/);
      if (!contentMatch) return match;

      const quote = contentMatch[1];
      const content = contentMatch[2];

      // Check by old item id
      if (idMapping.has(content)) {
        return match.replace(
          `content=${quote}${content}${quote}`,
          `content=${quote}${idMapping.get(content)!}${quote}`,
        );
      }

      // Check by basename in content value
      for (const [oldBasename, [newBasename]] of imgDict) {
        if (content.includes(oldBasename)) {
          const newContent = content.replace(oldBasename, newBasename);
          return match.replace(
            `content=${quote}${content}${quote}`,
            `content=${quote}${newContent}${quote}`,
          );
        }
      }

      return match;
    },
  );

  zip.file(opfPath, updatedOpf);

  // 4. Update XHTML and CSS references
  for (const [filePath, zipObj] of Object.entries(zip.files)) {
    if (zipObj.dir) continue;
    const ext = path.extname(filePath).toLowerCase();
    if (!['.html', '.xhtml', '.htm', '.css'].includes(ext)) continue;

    let content = await zipObj.async('text');
    let modified = false;

    for (const [oldBasename, [newBasename]] of imgDict) {
      if (content.includes(oldBasename)) {
        content = content.replace(
          new RegExp(escapeRegex(oldBasename), 'g'),
          newBasename,
        );
        modified = true;
      }
    }

    if (modified) {
      zip.file(filePath, content);
      logger.debug(`Updated references in: ${filePath}`);
    }
  }

  // 5. Write the new EPUB
  await EpubWriter.write(zip, { outputPath });
  result.success = true;
  logger.info(
    `WebP conversion complete: ${result.converted} converted, ${result.skipped} skipped`,
  );
  return result;
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
