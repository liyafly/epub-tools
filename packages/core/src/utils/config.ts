/**
 * 配置管理
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export interface EpubToolsConfig {
  /** 输出目录 (默认: 源文件同级目录) */
  outputDir?: string;
  /** 图片压缩级别 */
  compressionLevel?: 'fast' | 'balanced' | 'max';
  /** JPEG 质量 (1-100) */
  jpegQuality?: number;
  /** 编辑工作区根目录 */
  workspaceRoot?: string;
  /** Python 路径 */
  pythonPath?: string;
}

const DEFAULT_CONFIG: EpubToolsConfig = {
  compressionLevel: 'balanced',
  jpegQuality: 85,
  workspaceRoot: resolve(homedir(), '.epub-workspace'),
};

/**
 * 加载配置 (优先级: 命令行参数 > 项目配置 > 用户配置 > 默认值)
 */
export async function loadConfig(overrides?: Partial<EpubToolsConfig>): Promise<EpubToolsConfig> {
  let fileConfig: Partial<EpubToolsConfig> = {};

  // 尝试读取配置文件
  const configPaths = [
    resolve(process.cwd(), '.epub-tools.json'),
    resolve(homedir(), '.config', 'epub-tools', 'config.json'),
  ];

  for (const configPath of configPaths) {
    try {
      const content = await readFile(configPath, 'utf-8');
      fileConfig = JSON.parse(content);
      break;
    } catch {
      // 配置文件不存在，继续查找
    }
  }

  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...overrides,
  };
}
