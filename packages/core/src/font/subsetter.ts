/**
 * 字体子集化
 * 使用 subset-font (HarfBuzz WASM) — 跨平台零依赖
 */

export interface SubsetOptions {
  /** 输出路径 */
  outputPath: string;
  /** 是否保留所有已使用的 Unicode 范围 */
  keepAllUsed?: boolean;
}

export interface SubsetResult {
  success: boolean;
  fonts: Array<{
    name: string;
    originalSize: number;
    subsetSize: number;
    savings: string;
    charsKept: number;
  }>;
}

/**
 * 对 EPUB 中的字体进行子集化，仅保留实际使用的字符
 * 可减少字体体积 60-90%
 */
export async function subsetFonts(
  _epubPath: string,
  _options: SubsetOptions,
): Promise<SubsetResult> {
  // TODO: Sprint 3 实现
  // 1. 解析 EPUB，提取所有字体文件和 CSS @font-face 规则
  // 2. 扫描 XHTML 内容收集使用的字符集
  // 3. 使用 subset-font 按字符集裁剪每个字体
  // 4. 替换 EPUB 中的字体文件
  throw new Error('Not implemented yet — Sprint 3');
}
