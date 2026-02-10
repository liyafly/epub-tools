# 项目独立开发说明 / Independent Development Guide

## 中文说明

### 背景

本项目最初是从其他仓库fork而来，但现在已经决定独立开发，不再与原始仓库保持同步。这意味着：

1. **不会合并原仓库的更新** - 未来开发将完全独立进行
2. **独立的发展方向** - 项目将按照自己的规划和需求演进
3. **独立的版本管理** - 使用独立的版本号和发布周期

### 已完成的变更

- ✅ 在 README.md 中添加了独立开发声明
- ✅ 创建了本说明文档

### 需要手动完成的 GitHub 设置（可选）

由于 GitHub API 的限制，以下操作需要通过 GitHub 网页界面手动完成：

#### 1. 分离 Fork 关系（可选但推荐）

如果您想完全移除 fork 标记，可以联系 GitHub Support：

1. 访问 [GitHub Support](https://support.github.com/contact)
2. 选择 "Repository" 类别
3. 说明您想将 fork 转换为独立仓库
4. 提供仓库 URL: `https://github.com/liyafly/epub-tools`

**注意**: 这是一个不可逆的操作，建议在确定不需要与原仓库同步后再进行。

#### 2. 启用 Issues（推荐）

当前仓库的 Issues 功能是关闭的。作为独立项目，建议启用：

1. 访问仓库设置: `https://github.com/liyafly/epub-tools/settings`
2. 滚动到 "Features" 部分
3. 勾选 "Issues"

#### 3. 更新仓库描述

1. 访问仓库主页: `https://github.com/liyafly/epub-tools`
2. 点击右侧的 ⚙️ Settings（在 About 部分）
3. 更新描述，强调这是一个独立项目

### 未来开发计划

项目未来的发展方向请参考 `docs/plan-epubToolsV2.prompt.md`，主要包括：

- 使用 TypeScript 重写核心功能
- 采用 Tauri 构建桌面应用
- 仅保留 Python 的字体混淆功能
- 提供 CLI 和 GUI 双界面

---

## English Guide

### Background

This project was originally forked from another repository but has now decided to develop independently without synchronizing with the original repository. This means:

1. **No merging of upstream changes** - Future development will be completely independent
2. **Independent development direction** - The project will evolve according to its own roadmap and requirements
3. **Independent version management** - Using separate version numbers and release cycles

### Completed Changes

- ✅ Added independent development notice to README.md
- ✅ Created this documentation

### Manual GitHub Settings Required (Optional)

Due to GitHub API limitations, the following operations need to be completed manually through the GitHub web interface:

#### 1. Detach Fork Relationship (Optional but Recommended)

If you want to completely remove the fork label, you can contact GitHub Support:

1. Visit [GitHub Support](https://support.github.com/contact)
2. Select "Repository" category
3. Explain that you want to convert the fork to a standalone repository
4. Provide repository URL: `https://github.com/liyafly/epub-tools`

**Note**: This is an irreversible operation. It's recommended to do this only after confirming you don't need to sync with the original repository.

#### 2. Enable Issues (Recommended)

The repository's Issues feature is currently disabled. As an independent project, it's recommended to enable it:

1. Visit repository settings: `https://github.com/liyafly/epub-tools/settings`
2. Scroll to the "Features" section
3. Check "Issues"

#### 3. Update Repository Description

1. Visit the repository homepage: `https://github.com/liyafly/epub-tools`
2. Click the ⚙️ Settings icon (in the About section on the right)
3. Update the description to emphasize this is an independent project

### Future Development Plan

For future development direction, please refer to `docs/plan-epubToolsV2.prompt.md`, which includes:

- Rewriting core functionality in TypeScript
- Building desktop applications with Tauri
- Keeping only Python font obfuscation functionality
- Providing both CLI and GUI interfaces

---

## 技术说明 / Technical Notes

### Git 远程仓库配置

当前远程仓库配置：

```bash
origin  https://github.com/liyafly/epub-tools (fetch)
origin  https://github.com/liyafly/epub-tools (push)
```

无需更改 - 这已经指向您自己的仓库。

### 分支管理建议

建议的分支管理策略：

- `main` - 稳定版本
- `develop` - 开发分支
- `feature/*` - 功能分支
- `release/*` - 发布分支

### 贡献指南

作为独立项目，欢迎社区贡献。建议创建 `CONTRIBUTING.md` 文件说明如何参与项目开发。
