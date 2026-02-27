/**
 * Tauri IPC 封装
 * 与 Rust 后端通信的桥接层
 */

// TODO: Sprint 6 — Tauri IPC 对接
// import { invoke } from '@tauri-apps/api/core';

export interface ProcessResult {
  success: boolean;
  message: string;
  details?: string;
}

/**
 * 调用后端处理 EPUB 文件
 */
export async function processEpub(
  _filePath: string,
  _action: string,
  _options?: Record<string, unknown>,
): Promise<ProcessResult> {
  // TODO: Sprint 6 实现
  // return invoke('process_epub', { filePath, action, options });
  return { success: false, message: 'Tauri IPC 尚未实现' };
}
