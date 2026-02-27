/**
 * process — 一键流水线处理
 */
import { Command } from 'commander';

export const processCommand = new Command('process')
  .description('一键处理 EPUB (可组合多个操作)')
  .argument('<input>', 'EPUB 文件或目录路径')
  .option('-o, --output <path>', '输出路径')
  .option('--convert-webp', '转换 WebP 图片')
  .option('--compress', '压缩图片')
  .option('--subset-fonts', '字体子集化')
  .option('--reformat', '格式规范化')
  .option('-r, --recursive', '递归处理目录')
  .action(async (_input, _options) => {
    // TODO: Sprint 4 实现
    console.log('epub-tools process — 尚未实现，请等待 Sprint 4');
  });
