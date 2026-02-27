/**
 * 外部工具检测
 * 检查项目所需的外部 CLI 工具和运行时
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface ToolStatus {
  name: string;
  available: boolean;
  version?: string;
  required: boolean;
  installHint: string;
}

const TOOLS_TO_CHECK: Array<{
  name: string;
  cmd: string;
  required: boolean;
  installHint: string;
}> = [
  {
    name: 'Node.js',
    cmd: 'node --version',
    required: true,
    installHint: 'https://nodejs.org/ 或使用 mise install node',
  },
  {
    name: 'Python',
    cmd: 'python3 --version',
    required: false,
    installHint: '字体混淆需要。https://python.org/ 或使用 mise install python',
  },
  {
    name: 'fonttools (Python)',
    cmd: 'python3 -c "import fontTools; print(fontTools.__version__)"',
    required: false,
    installHint: '字体混淆需要。pip install fonttools',
  },
  {
    name: 'jpegoptim',
    cmd: 'jpegoptim --version',
    required: false,
    installHint: 'JPEG 压缩需要。brew install jpegoptim / apt install jpegoptim',
  },
  {
    name: 'oxipng',
    cmd: 'oxipng --version',
    required: false,
    installHint: 'PNG 压缩需要。brew install oxipng / cargo install oxipng',
  },
  {
    name: 'zopflipng',
    cmd: 'zopflipng --help',
    required: false,
    installHint: 'PNG 极限压缩。brew install zopfli / apt install zopfli',
  },
  {
    name: 'Git',
    cmd: 'git --version',
    required: false,
    installHint: '编辑工作流需要。https://git-scm.com/',
  },
];

/**
 * 检测所有外部工具的可用性
 */
export async function checkTools(): Promise<ToolStatus[]> {
  const results = await Promise.all(
    TOOLS_TO_CHECK.map(async (tool) => {
      try {
        const { stdout } = await execAsync(tool.cmd);
        const version = stdout.trim().split('\n')[0];
        return {
          name: tool.name,
          available: true,
          version,
          required: tool.required,
          installHint: tool.installHint,
        };
      } catch {
        return {
          name: tool.name,
          available: false,
          required: tool.required,
          installHint: tool.installHint,
        };
      }
    }),
  );

  return results;
}
