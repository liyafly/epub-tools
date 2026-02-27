/**
 * @epub-tools/core
 * EPUB 处理核心库 — 统一导出
 */

// EPUB 解析与打包
export { EpubParser } from './epub/parser.js';
export { EpubWriter } from './epub/writer.js';
export { reformatEpub } from './epub/reformat.js';
export { upgradeEpub } from './epub/upgrade.js';

// 图片处理
export { convertWebp } from './image/webp-converter.js';
export { compressImages } from './image/compressor.js';

// 字体处理
export { subsetFonts } from './font/subsetter.js';
export { encryptFonts } from './font/encryptor.js';

// 文件名加密/解密
export { encryptEpub } from './crypto/encrypt.js';
export { decryptEpub } from './crypto/decrypt.js';

// 编辑工作流
export { createWorkspace } from './edit/workspace.js';
export { watchWorkspace } from './edit/watcher.js';
export { packWorkspace } from './edit/packer.js';

// Python 桥接
export { PythonRunner } from './bridge/python-runner.js';

// 工具
export { logger } from './utils/logger.js';
export { loadConfig } from './utils/config.js';
export { checkTools } from './utils/tool-checker.js';
