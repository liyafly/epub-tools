/**
 * 文件名加密
 * TS 重写 encrypt_epub.py
 */
import { createHash } from 'node:crypto';

export interface EncryptOptions {
  /** 输出路径 */
  outputPath: string;
}

export interface EncryptResult {
  success: boolean;
  filesEncrypted: number;
  mapping: Map<string, string>;
}

/**
 * MD5(id) → 二进制 → 1→'*', 0→':' → 作为新文件名
 */
export function generateEncryptedName(id: string): string {
  const md5 = createHash('md5').update(id).digest('hex');
  const binary = BigInt(`0x${md5}`).toString(2).padStart(128, '0');
  return binary.replace(/1/g, '*').replace(/0/g, ':');
}

/**
 * 对 EPUB 文件进行文件名加密
 */
export async function encryptEpub(
  _epubPath: string,
  _options: EncryptOptions,
): Promise<EncryptResult> {
  // TODO: Sprint 2 实现
  // 1. 解析 EPUB
  // 2. 遍历 manifest，对每个文件生成加密文件名
  // 3. 重命名文件，更新所有引用
  // 4. 更新 OPF
  throw new Error('Not implemented yet — Sprint 2');
}
