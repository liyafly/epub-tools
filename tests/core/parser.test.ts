/**
 * EPUB Parser 单元测试
 */
import { describe, it, expect } from 'vitest';
import { EpubParser } from '../../packages/core/src/epub/parser.js';

describe('EpubParser', () => {
  it('should export EpubParser class', () => {
    expect(EpubParser).toBeDefined();
    expect(typeof EpubParser.fromFile).toBe('function');
    expect(typeof EpubParser.fromBuffer).toBe('function');
  });

  // TODO: Sprint 1 — 添加实际解析测试 (需要测试 EPUB 文件)
});
