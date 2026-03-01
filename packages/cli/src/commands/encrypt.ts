/**
 * encrypt — 文件名加密
 */
import path from 'node:path';
import { Command } from 'commander';
import consola from 'consola';
import { encryptEpub } from '@epub-tools/core';

export const encryptCommand = new Command('encrypt')
  .description('对 EPUB 进行文件名加密 (混淆)')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .action(async (input: string, options: { output?: string }) => {
    const outputPath =
      options.output ??
      path.join(
        path.dirname(input),
        `${path.basename(input, path.extname(input))}_encrypt.epub`,
      );
    try {
      const result = await encryptEpub(input, { outputPath });
      consola.success(
        `加密完成: ${result.filesEncrypted} 个文件已加密 → ${outputPath}`,
      );
    } catch (error) {
      consola.error('加密失败:', error);
      process.exitCode = 1;
    }
  });
