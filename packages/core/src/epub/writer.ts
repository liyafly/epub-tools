/**
 * EPUB 打包器
 * 支持 mimetype STORE 模式（EPUB 规范要求）
 */
import JSZip from 'jszip';
import { writeFile } from 'node:fs/promises';

export interface WriteOptions {
  /** 输出文件路径 */
  outputPath: string;
  /** 压缩级别 (1-9, 默认 6) */
  compressionLevel?: number;
}

export class EpubWriter {
  /**
   * 将 JSZip 实例写入 EPUB 文件
   * mimetype 文件必须是第一个条目且不压缩 (STORE 模式)
   */
  static async write(zip: JSZip, options: WriteOptions): Promise<void> {
    const { outputPath, compressionLevel = 6 } = options;

    // 确保 mimetype 存在
    if (!zip.file('mimetype')) {
      zip.file('mimetype', 'application/epub+zip', {
        compression: 'STORE',
      });
    }

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: compressionLevel },
    });

    await writeFile(outputPath, buffer);
  }

  /**
   * 生成 EPUB Buffer（不写入文件）
   */
  static async toBuffer(zip: JSZip): Promise<Buffer> {
    if (!zip.file('mimetype')) {
      zip.file('mimetype', 'application/epub+zip', {
        compression: 'STORE',
      });
    }

    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }
}
