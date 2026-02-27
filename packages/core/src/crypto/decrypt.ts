/**
 * 文件名解密
 * TS 重写 decrypt_epub.py
 */

export interface DecryptOptions {
  /** 输出路径 */
  outputPath: string;
  /** 模糊匹配阈值 (0-1, 默认 0.6) */
  similarityThreshold?: number;
}

export interface DecryptResult {
  success: boolean;
  filesDecrypted: number;
  mapping: Map<string, string>;
}

/**
 * 对 EPUB 文件进行文件名解密（反混淆）
 */
export async function decryptEpub(
  _epubPath: string,
  _options: DecryptOptions,
): Promise<DecryptResult> {
  // TODO: Sprint 2 实现
  // 1. 解析 EPUB
  // 2. 从 OPF item id 反推原始文件名
  // 3. 使用 string-similarity 模糊匹配
  // 4. 恢复文件名并更新引用
  throw new Error('Not implemented yet — Sprint 2');
}
