/**
 * 字体混淆（加密）
 * 桥接 Python encrypt_font.py — 因 fontTools 在 JS 生态无等效替代
 */
import { PythonRunner } from '../bridge/python-runner.js';

export interface EncryptFontOptions {
  /** 输出路径 */
  outputPath: string;
  /** 指定字体 family 范围 */
  fontFamilies?: string[];
}

export interface EncryptFontResult {
  success: boolean;
  fontsProcessed: number;
  errors: string[];
}

/**
 * 对 EPUB 中的字体进行混淆加密
 * 内部调用 Python encrypt_font.py
 */
export async function encryptFonts(
  epubPath: string,
  options: EncryptFontOptions,
): Promise<EncryptFontResult> {
  const runner = new PythonRunner();

  // 检查 Python 可用性
  const available = await runner.checkAvailability();
  if (!available) {
    return {
      success: false,
      fontsProcessed: 0,
      errors: [
        '字体混淆功能需要 Python 3.9+ 和 fonttools 库。',
        '请运行 `epub-tools doctor` 检查依赖。',
      ],
    };
  }

  try {
    const args = [epubPath, options.outputPath];
    if (options.fontFamilies?.length) {
      args.push('--families', ...options.fontFamilies);
    }

    const result = await runner.exec('encrypt_font.py', args);
    return {
      success: result.exitCode === 0,
      fontsProcessed: 0, // TODO: parse from stdout
      errors: result.exitCode !== 0 ? [result.stderr] : [],
    };
  } catch (error) {
    return {
      success: false,
      fontsProcessed: 0,
      errors: [(error as Error).message],
    };
  }
}
