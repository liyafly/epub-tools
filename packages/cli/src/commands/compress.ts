/**
 * compress — 图片压缩
 */
import { Command } from 'commander';

export const compressCommand = new Command('compress')
  .description('压缩 EPUB 中的图片 (JPEG/PNG)')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .option('-l, --level <level>', '压缩级别: fast, balanced, max', 'balanced')
  .action(async (_input, _options) => {
    // TODO: Sprint 2 实现
    console.log('epub-tools compress — 尚未实现，请等待 Sprint 2');
  });
