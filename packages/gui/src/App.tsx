import { useState } from 'react';

function App() {
  const [files, setFiles] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">EPUB Tools</h1>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded-md bg-secondary text-sm">设置</button>
          <button className="px-3 py-1 rounded-md bg-secondary text-sm">主题</button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-53px)]">
        {/* 侧边栏 */}
        <aside className="w-48 border-r p-4 flex flex-col gap-2">
          <button className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">
            添加文件
          </button>
          <button className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">
            添加文件夹
          </button>
          <button className="w-full px-3 py-2 rounded-md bg-destructive text-destructive-foreground text-sm">
            清空列表
          </button>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 p-6 flex flex-col gap-4">
          {/* 文件列表 */}
          <section>
            <h2 className="text-sm font-medium mb-2">📂 待处理文件</h2>
            <div className="border rounded-md p-4 min-h-[200px]">
              {files.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  拖拽 EPUB 文件到此处，或点击左侧按钮添加
                </p>
              ) : (
                <p>{files.length} 个文件</p>
              )}
            </div>
          </section>

          {/* 操作按钮 */}
          <section>
            <h2 className="text-sm font-medium mb-2">🔧 操作</h2>
            <div className="flex flex-wrap gap-2">
              {['格式化', '解密', '加密', '字体加密', '图片转换', '图片压缩', '字体子集化'].map(
                (action) => (
                  <button
                    key={action}
                    className="px-4 py-2 rounded-md bg-secondary text-sm hover:bg-secondary/80"
                  >
                    {action}
                  </button>
                ),
              )}
            </div>
          </section>

          {/* 日志面板 */}
          <section className="flex-1">
            <h2 className="text-sm font-medium mb-2">📋 执行日志</h2>
            <div className="border rounded-md p-4 h-full bg-muted/50 font-mono text-xs">
              <p className="text-muted-foreground">等待操作...</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
