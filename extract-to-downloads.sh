#!/bin/bash

# =================================================================
# 脚本功能：解压项目根目录的 release.zip 到 Downloads 目录
# 使用方法：sh extract-to-downloads.sh
# =================================================================

SOURCE_ZIP="release.zip"
TARGET_DIR="/Users/lcc/Downloads/release"

echo "🚀 开始处理..."

# 1. 检查源码是否存在
if [ ! -f "$SOURCE_ZIP" ]; then
    echo "❌ 错误: 当前目录下未找到 $SOURCE_ZIP"
    exit 1
fi

# 2. 强制删除旧目录 (不再检查是否存在，直接执行)
echo "🧹 正在清理旧的 $TARGET_DIR ..."
rm -rf "$TARGET_DIR"

# 3. 执行解压 (创建目录并解压)
echo "📦 正在解压 $SOURCE_ZIP 到 $TARGET_DIR ..."
mkdir -p "$TARGET_DIR"
unzip -q "$SOURCE_ZIP" -d "$TARGET_DIR"

if [ $? -eq 0 ]; then
    echo "✅ 处理完成！"
    echo "📂 路径: $TARGET_DIR"
else
    echo "❌ 失败，请检查路径权限或 zip 文件。"
    exit 1
fi
