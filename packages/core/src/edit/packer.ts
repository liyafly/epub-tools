/**
 * 编辑工作流 — 重新打包
 * 将工作区重新打包为 EPUB
 */

export interface PackOptions {
  /** 输出路径 */
  outputPath: string;
  /** 压缩级别 */
  compressionLevel?: number;
}

export interface PackResult {
  success: boolean;
  outputPath: string;
  fileSize: number;
}

/**
 * 将编辑工作区打包为 EPUB
 */
export async function packWorkspace(
  _workspacePath: string,
  _options: PackOptions,
): Promise<PackResult> {
  // TODO: Sprint 4 实现
  // 1. 读取工作区全部文件
  // 2. 按 EPUB 规范组装 ZIP (mimetype STORE)
  // 3. 写入输出文件
  throw new Error('Not implemented yet — Sprint 4');
}
