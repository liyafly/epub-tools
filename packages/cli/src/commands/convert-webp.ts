/**
 * convert-webp — WebP 图片转换
 */
import { Command } from 'commander';

export const convertWebpCommand = new Command('convert-webp')
  .description('将 EPUB 中的 WebP 图片转换为 JPG/PNG')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .option('-q, --quality <number>', 'JPEG 质量 (1-100)', '85')
  .action(async (_input, _options) => {
    // TODO: Sprint 2 实现
    console.log('epub-tools convert-webp — 尚未实现，请等待 Sprint 2');
  });
