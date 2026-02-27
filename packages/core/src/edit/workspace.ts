/**
 * 编辑工作流 — 创建工作区
 * 解压 EPUB → git init → 准备编辑环境
 */

export interface WorkspaceOptions {
  /** 工作区根目录 (默认 ~/.epub-workspace/) */
  workspaceRoot?: string;
  /** 是否自动打开 VS Code */
  openVSCode?: boolean;
}

export interface WorkspaceResult {
  success: boolean;
  workspacePath: string;
  gitInitialized: boolean;
}

/**
 * 从 EPUB 创建编辑工作区
 */
export async function createWorkspace(
  _epubPath: string,
  _options?: WorkspaceOptions,
): Promise<WorkspaceResult> {
  // TODO: Sprint 4 实现
  // 1. 解压 EPUB 到工作区目录
  // 2. git init + 首次 commit
  // 3. 写入 .epub-meta.json (原始路径、时间戳)
  // 4. 可选: code . 打开 VS Code
  throw new Error('Not implemented yet — Sprint 4');
}
