/**
 * compress — 图片压缩
 */
import path from 'node:path';
import { Command } from 'commander';
import consola from 'consola';
import { compressImages } from '@epub-tools/core';

export const compressCommand = new Command('compress')
  .description('压缩 EPUB 中的图片 (JPEG/PNG)')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .option('-l, --level <level>', '压缩级别: fast, balanced, max', 'balanced')
  .action(
    async (
      input: string,
      options: { output?: string; level?: 'fast' | 'balanced' | 'max' },
    ) => {
      const outputPath =
        options.output ??
        path.join(
          path.dirname(input),
          `${path.basename(input, path.extname(input))}_compressed.epub`,
        );
      try {
        const result = await compressImages(input, {
          outputPath,
          level: options.level,
        });
        consola.success(
          `压缩完成: ${result.compressed}/${result.totalImages} 张图片已压缩, 节省 ${result.savedBytes} 字节 → ${outputPath}`,
        );
      } catch (error) {
        consola.error('图片压缩失败:', error);
        process.exitCode = 1;
      }
    },
  );
