/**
 * reformat — 格式规范化
 */
import { Command } from 'commander';

export const reformatCommand = new Command('reformat')
  .description('重构 EPUB 为 Sigil 标准目录结构')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .action(async (_input, _options) => {
    // TODO: Sprint 2 实现
    console.log('epub-tools reformat — 尚未实现，请等待 Sprint 2');
  });
