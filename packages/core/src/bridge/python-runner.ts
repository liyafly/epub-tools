/**
 * Python 脚本运行器
 * 用于桥接 Python 字体混淆脚本
 */
import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface PythonExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class PythonRunner {
  private pythonCmd: string = 'python3';
  private scriptsDir: string;

  constructor(scriptsDir?: string) {
    // 默认指向项目根目录的 py-scripts/
    this.scriptsDir = scriptsDir || resolve(__dirname, '../../../../py-scripts');
  }

  /**
   * 检查 Python 及必要依赖是否可用
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // 检测 python3
      const pythonResult = await this.exec_(this.pythonCmd, [
        '-c',
        'import fonttools; print("ok")',
      ]);
      if (pythonResult.exitCode === 0) return true;

      // 回退到 python
      this.pythonCmd = 'python';
      const fallback = await this.exec_(this.pythonCmd, [
        '-c',
        'import fonttools; print("ok")',
      ]);
      return fallback.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * 执行 Python 脚本
   */
  async exec(scriptName: string, args: string[]): Promise<PythonExecResult> {
    const scriptPath = resolve(this.scriptsDir, scriptName);

    // 确认脚本存在
    await access(scriptPath, constants.R_OK);

    return this.exec_(this.pythonCmd, [scriptPath, ...args]);
  }

  private exec_(cmd: string, args: string[]): Promise<PythonExecResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => (stdout += data.toString()));
      proc.stderr.on('data', (data) => (stderr += data.toString()));

      proc.on('close', (code) => {
        resolve({ exitCode: code ?? 1, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
}
