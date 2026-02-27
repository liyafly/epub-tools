/**
 * 日志工具
 * 统一日志输出接口
 */
import { createConsola } from 'consola';

export const logger = createConsola({
  fancy: true,
  formatOptions: {
    date: true,
    colors: true,
    compact: false,
  },
});
