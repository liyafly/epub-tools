/**
 * epub-info — 打印 EPUB 基本信息
 *
 * 用法: npx tsx skills/ts/epub-info.ts <epub_path>
 * 输出: 标题/作者/页数/图片数/字体数/体积
 */

import { EpubParser } from '../../packages/core/src/epub/parser.js';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  const epubPath = process.argv[2];
  if (!epubPath) {
    console.error('用法: npx tsx skills/ts/epub-info.ts <epub_path>');
    process.exit(1);
  }

  const fullPath = resolve(epubPath);

  try {
    const fileStat = await stat(fullPath);
    const epub = await EpubParser.fromFile(fullPath);

    const images = [...epub.manifest.values()].filter((i) =>
      i.mediaType.startsWith('image/'),
    );
    const fonts = [...epub.manifest.values()].filter(
      (i) =>
        i.mediaType.includes('font') ||
        i.href.endsWith('.ttf') ||
        i.href.endsWith('.otf') ||
        i.href.endsWith('.woff') ||
        i.href.endsWith('.woff2'),
    );
    const texts = [...epub.manifest.values()].filter(
      (i) =>
        i.mediaType === 'application/xhtml+xml' || i.mediaType === 'text/html',
    );

    console.log(`📖 EPUB 信息: ${fullPath}`);
    console.log(`   标题: ${epub.metadata.title || '(未知)'}`);
    console.log(`   作者: ${epub.metadata.creator || '(未知)'}`);
    console.log(`   语言: ${epub.metadata.language || '(未知)'}`);
    console.log(`   版本: EPUB ${epub.metadata.version}`);
    console.log(`   页面: ${texts.length} 个 XHTML`);
    console.log(`   图片: ${images.length} 张`);
    console.log(`   字体: ${fonts.length} 个`);
    console.log(`   体积: ${(fileStat.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Spine: ${epub.spine.length} 项`);
  } catch (err) {
    console.error(`错误: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
