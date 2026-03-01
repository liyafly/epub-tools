use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessResult {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to EPUB Tools v3 (Rust core).", name)
}

/// 处理 EPUB 文件 (直接调用 Rust epub-core)
#[tauri::command]
pub async fn process_epub(
    file_path: String,
    action: String,
) -> Result<ProcessResult, String> {
    // Verify epub-core is linked by parsing the file
    let path = std::path::Path::new(&file_path);
    match epub_core::epub::parser::parse_epub_file(path) {
        Ok(epub) => {
            let title = epub.metadata.title.unwrap_or_else(|| "Unknown".into());
            Ok(ProcessResult {
                success: true,
                message: format!(
                    "已解析 \"{}\" (版本 {}, {} 个文件) — 操作 \"{}\" 待实现",
                    title,
                    epub.metadata.version,
                    epub.manifest.len(),
                    action
                ),
            })
        }
        Err(e) => Ok(ProcessResult {
            success: false,
            message: format!("解析失败: {e}"),
        }),
    }
}

/// 检查依赖环境
#[tauri::command]
pub async fn check_dependencies() -> Result<Vec<String>, String> {
    let mut deps = vec!["Rust epub-core: ✅ 内置".to_string()];

    // Check Python (optional — font obfuscation only)
    match std::process::Command::new("python3")
        .arg("--version")
        .output()
    {
        Ok(output) => {
            let ver = String::from_utf8_lossy(&output.stdout);
            deps.push(format!("Python: ✅ {} (字体混淆可用)", ver.trim()));
        }
        Err(_) => {
            deps.push("Python: ⚠️ 未安装 (字体混淆不可用)".to_string());
        }
    }

    Ok(deps)
}
