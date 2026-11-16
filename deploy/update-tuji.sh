#!/usr/bin/env bash
# 图记 · 更新已部署的旧版本（在服务器上以 root 运行一次即可）
# 用法：bash update-tuji.sh [站点目录] [更新包路径]
#   默认站点目录 /www/wwwroot/tuji ，更新包 /root/tuji-deploy.zip
# 行为：1) 备份旧站点到 /www/backup/  2) 解压新包并覆盖代码
#       3) 不触碰 server/config.php（数据库配置）和 server/storage/（用户上传的图片）
#       4) 做 PHP 语法与接口自检
set -euo pipefail

SITE="${1:-/www/wwwroot/tuji}"
PKG="${2:-/root/tuji-deploy.zip}"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/www/backup/tuji-$TS"

[ -d "$SITE" ] || { echo "✗ 站点目录不存在：$SITE（用第一个参数指定）"; exit 1; }
[ -f "$PKG" ]  || { echo "✗ 找不到更新包：$PKG（用第二个参数指定）"; exit 1; }
command -v unzip >/dev/null || { echo "✗ 需要 unzip：yum/apt install -y unzip"; exit 1; }

echo "▶ 1/4 备份旧版本到 $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
# 备份时排除上传的图片（体积大，已在 storage 目录内单独保存）
tar --exclude='server/storage/photos/*' -C "$SITE" -czf "$BACKUP_DIR/site-code.tar.gz" .
[ -f "$SITE/server/config.php" ] && cp -a "$SITE/server/config.php" "$BACKUP_DIR/config.php"
echo "  备份完成：$BACKUP_DIR/site-code.tar.gz"

echo "▶ 2/4 解压更新包"
TMP="$(mktemp -d)"
unzip -q "$PKG" -d "$TMP"
SRC="$TMP/tuji"
[ -f "$SRC/index.html" ] || { echo "✗ 更新包结构不对（应包含 tuji/index.html）"; exit 1; }

echo "▶ 3/4 覆盖代码（保留 config.php 与用户上传的图片）"
# 包内不含 config.php；storage 仅有占位文件，覆盖不会删除已有图片
cp -a "$SRC"/. "$SITE"/
# 再次确认私有配置仍在
if [ -f "$BACKUP_DIR/config.php" ] && [ ! -f "$SITE/server/config.php" ]; then
  cp -a "$BACKUP_DIR/config.php" "$SITE/server/config.php"
  echo "  已恢复 server/config.php"
fi
rm -rf "$TMP"
# 站点文件属主改为 Web 用户（宝塔默认 www）
chown -R www:www "$SITE" 2>/dev/null || true

echo "▶ 4/4 自检"
for f in api.php server/public/api.php; do
  php -l "$SITE/$f" >/dev/null && echo "  php 语法正常：$f" || { echo "✗ 语法错误：$f"; exit 1; }
done
[ -f "$SITE/server/config.php" ] && echo "  数据库配置存在" || echo "  ⚠ 没有 server/config.php，请从 config.example.php 复制并填写数据库信息"
[ -d "$SITE/server/storage/photos" ] && echo "  上传目录存在（图片未改动）"
echo
echo "✓ 更新完成。请用手机和电脑各打开一次站点，并按 Ctrl+Shift+R 强制刷新。"
echo "  如需回滚：tar -xzf $BACKUP_DIR/site-code.tar.gz -C $SITE"
