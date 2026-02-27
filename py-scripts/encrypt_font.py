"""
EPUB 字体混淆工具
从 epub_tool 迁移 — 使用 fontTools 进行字体混淆操作

依赖: fonttools, beautifulsoup4, tinycss2
用法: python encrypt_font.py <epub_path> <output_path> [--families font1 font2]
"""

# TODO: Sprint 3 — 从 utils/encrypt_font.py 迁移并适配新接口
# 当前为占位文件

import sys


def main():
    if len(sys.argv) < 3:
        print("用法: python encrypt_font.py <epub_path> <output_path> [--families ...]")
        sys.exit(1)

    epub_path = sys.argv[1]
    output_path = sys.argv[2]

    print(f"字体混淆: {epub_path} -> {output_path}")
    print("尚未实现 — 请等待 Sprint 3")
    sys.exit(1)


if __name__ == "__main__":
    main()
