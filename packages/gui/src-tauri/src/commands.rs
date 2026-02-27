use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessResult {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to EPUB Tools.", name)
}

/// 处理 EPUB 文件 (通过 sidecar 调用 Node.js CLI)
#[tauri::command]
pub async fn process_epub(
    file_path: String,
    action: String,
) -> Result<ProcessResult, String> {
    // TODO: Sprint 6 — 通过 sidecar 调用 Node.js CLI
    Ok(ProcessResult {
        success: false,
        message: format!("处理 {} (操作: {}) — sidecar 尚未实现", file_path, action),
    })
}

/// 检查依赖环境
#[tauri::command]
pub async fn check_dependencies() -> Result<Vec<String>, String> {
    // TODO: Sprint 6 — 检查 Node.js, Python 等依赖
    Ok(vec![
        "Node.js: 检查中...".to_string(),
        "Python: 检查中...".to_string(),
    ])
}
