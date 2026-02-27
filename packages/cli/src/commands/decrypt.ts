/**
 * decrypt — 文件名解密
 */
import { Command } from 'commander';

export const decryptCommand = new Command('decrypt')
  .description('对 EPUB 进行文件名解密 (反混淆)')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .action(async (_input, _options) => {
    // TODO: Sprint 2 实现
    console.log('epub-tools decrypt — 尚未实现，请等待 Sprint 2');
  });
