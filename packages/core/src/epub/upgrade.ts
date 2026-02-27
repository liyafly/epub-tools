/**
 * EPUB2 → EPUB3 升级
 * 生成 nav.xhtml，保留原始 EPUB2 备份
 */

export interface UpgradeOptions {
  /** 输出路径 */
  outputPath: string;
  /** 目标版本 (默认 '3.3') */
  targetVersion?: '3.2' | '3.3';
  /** 是否保留 NCX 以兼容旧阅读器 */
  keepNcx?: boolean;
}

export interface UpgradeResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  navGenerated: boolean;
  ncxKept: boolean;
}

/**
 * 将 EPUB 2.0 升级到 EPUB 3.2/3.3
 */
export async function upgradeEpub(
  _epubPath: string,
  _options: UpgradeOptions,
): Promise<UpgradeResult> {
  // TODO: Sprint 2 实现
  // 1. 解析 EPUB，检查版本
  // 2. 备份原始 OEBPS 至 _epub2_backup/
  // 3. 从 NCX 生成 nav.xhtml
  // 4. 更新 OPF version 至 3.2/3.3
  // 5. 补充 manifest/spine 必需项
  // 6. 迁移旧式命名空间标签
  // 7. 修正 media-type
  throw new Error('Not implemented yet — Sprint 2');
}
