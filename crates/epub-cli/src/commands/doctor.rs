use tracing::info;

/// Check system dependencies and development environment.
pub fn run() -> anyhow::Result<()> {
    info!("🔍 Checking environment...\n");

    // Rust
    println!("  ✅ Rust: {} (built-in)", env!("CARGO_PKG_VERSION"));

    // Python (optional — for font obfuscation)
    let python_status = check_command("python3", &["--version"])
        .or_else(|| check_command("python", &["--version"]));
    match python_status {
        Some(version) => println!("  ✅ Python: {version} (字体混淆可用)"),
        None => println!("  ⚠️  Python: 未安装 (字体混淆功能不可用)"),
    }

    // jpegoptim (optional)
    match check_command("jpegoptim", &["--version"]) {
        Some(v) => println!("  ✅ jpegoptim: {v}"),
        None => println!("  ⚠️  jpegoptim: 未安装 (JPEG 极限压缩不可用)"),
    }

    // oxipng (optional)
    match check_command("oxipng", &["--version"]) {
        Some(v) => println!("  ✅ oxipng: {v}"),
        None => println!("  ⚠️  oxipng: 未安装 (PNG 极限压缩不可用)"),
    }

    println!("\n✨ 环境检测完成");
    Ok(())
}

fn check_command(cmd: &str, args: &[&str]) -> Option<String> {
    std::process::Command::new(cmd)
        .args(args)
        .output()
        .ok()
        .and_then(|output| {
            let s = String::from_utf8_lossy(&output.stdout);
            let line = s.lines().next().unwrap_or("").trim().to_string();
            if line.is_empty() {
                let s = String::from_utf8_lossy(&output.stderr);
                Some(s.lines().next().unwrap_or("").trim().to_string())
            } else {
                Some(line)
            }
        })
}
