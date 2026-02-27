/**
 * encrypt-font — 字体混淆 (需要 Python)
 */
import { Command } from 'commander';

export const encryptFontCommand = new Command('encrypt-font')
  .description('对 EPUB 中的字体进行混淆加密 (需要 Python 3.9+)')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .option('--families <names...>', '指定字体 family 范围')
  .action(async (_input, _options) => {
    // TODO: Sprint 3 实现
    console.log('epub-tools encrypt-font — 尚未实现，请等待 Sprint 3');
  });
