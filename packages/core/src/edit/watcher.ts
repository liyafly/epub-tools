/**
 * 编辑工作流 — 文件监听
 * chokidar 监听变更 + simple-git 自动 commit
 */

export interface WatchOptions {
  /** 自动 commit 间隔 (ms, 默认 5000) */
  commitInterval?: number;
  /** 忽略的文件模式 */
  ignorePatterns?: string[];
}

/**
 * 监听工作区文件变更并自动 commit
 */
export async function watchWorkspace(
  _workspacePath: string,
  _options?: WatchOptions,
): Promise<void> {
  // TODO: Sprint 4 实现
  // 1. chokidar 监听目录
  // 2. 防抖收集变更
  // 3. simple-git add + commit
  throw new Error('Not implemented yet — Sprint 4');
}
