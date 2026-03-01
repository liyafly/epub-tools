/**
 * convert-webp — WebP 图片转换
 */
import path from 'node:path';
import { Command } from 'commander';
import consola from 'consola';
import { convertWebp } from '@epub-tools/core';

export const convertWebpCommand = new Command('convert-webp')
  .description('将 EPUB 中的 WebP 图片转换为 JPG/PNG')
  .argument('<input>', 'EPUB 文件路径')
  .option('-o, --output <path>', '输出路径')
  .option('-q, --quality <number>', 'JPEG 质量 (1-100)', '85')
  .action(async (input: string, options: { output?: string; quality?: string }) => {
    const outputPath =
      options.output ??
      path.join(
        path.dirname(input),
        `${path.basename(input, path.extname(input))}_converted.epub`,
      );
    try {
      const result = await convertWebp(input, {
        outputPath,
        jpegQuality: Number(options.quality),
      });
      consola.success(
        `转换完成: ${result.converted} 张图片已转换, ${result.skipped} 张跳过 → ${outputPath}`,
      );
    } catch (error) {
      consola.error('WebP 转换失败:', error);
      process.exitCode = 1;
    }
  });
