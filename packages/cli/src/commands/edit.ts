/**
 * edit — 编辑工作流
 */
import { Command } from 'commander';

export const editCommand = new Command('edit')
  .description('EPUB 编辑工作流 (解压 + Git + VS Code)')
  .argument('<input>', 'EPUB 文件路径或工作区路径')
  .option('--no-vscode', '不自动打开 VS Code')
  .option('--workspace-root <path>', '工作区根目录')
  .action(async (_input, _options) => {
    // TODO: Sprint 4 实现
    console.log('epub-tools edit — 尚未实现，请等待 Sprint 4');
  });
