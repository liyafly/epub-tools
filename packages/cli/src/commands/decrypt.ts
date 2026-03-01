/**
 * decrypt — 文件名解密
 */
import path from 'node:path';
import { Command } from 'commander';
import consola from 'consola';
import { decryptEpub } from '@epub-tools/core';

export const decryptCommand = new Command('decrypt')
  .description('对 EPUB 进行文件名解密 (反混淆)')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .action(async (input: string, options: { output?: string }) => {
    const outputPath =
      options.output ??
      path.join(
        path.dirname(input),
        `${path.basename(input, path.extname(input))}_decrypt.epub`,
      );
    try {
      const result = await decryptEpub(input, { outputPath });
      consola.success(
        `解密完成: ${result.filesDecrypted} 个文件已解密 → ${outputPath}`,
      );
    } catch (error) {
      consola.error('解密失败:', error);
      process.exitCode = 1;
    }
  });
