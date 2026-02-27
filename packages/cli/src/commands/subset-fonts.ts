/**
 * subset-fonts — 字体子集化
 */
import { Command } from 'commander';

export const subsetFontsCommand = new Command('subset-fonts')
  .description('对 EPUB 中的字体进行子集化 (减少 60-90% 体积)')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .action(async (_input, _options) => {
    // TODO: Sprint 3 实现
    console.log('epub-tools subset-fonts — 尚未实现，请等待 Sprint 3');
  });
