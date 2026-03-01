/**
 * reformat — 格式规范化
 */
import path from 'node:path';
import { Command } from 'commander';
import consola from 'consola';
import { EpubParser, reformatEpub } from '@epub-tools/core';

export const reformatCommand = new Command('reformat')
  .description('重构 EPUB 为 Sigil 标准目录结构')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .action(async (input: string, options: { output?: string }) => {
    const outputPath =
      options.output ??
      path.join(
        path.dirname(input),
        `${path.basename(input, path.extname(input))}_reformat.epub`,
      );
    try {
      const epub = await EpubParser.fromFile(input);
      const result = await reformatEpub(epub, { outputPath });
      consola.success(
        `格式化完成: ${result.filesRenamed} 个文件重命名, ${result.referencesUpdated} 处引用更新 → ${outputPath}`,
      );
    } catch (error) {
      consola.error('格式化失败:', error);
      process.exitCode = 1;
    }
  });
