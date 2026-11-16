# 宝塔部署

## 环境

- PHP 8.1+，启用 `pdo_mysql`、`fileinfo`、`mbstring`
- MySQL 5.7+/MariaDB 10.3+
- HTTPS 域名

## 初始化

1. 在宝塔创建数据库和专用数据库用户，导入 `server/schema.sql`。
2. 复制 `server/config.example.php` 为 `server/config.php`，填写数据库名、用户和密码；不要把真实配置提交到 Git。
3. 将站点根目录指向本项目，确保 PHP 可执行 `server/public/api.php`。
4. 将 `server/storage/photos` 配置为不可执行目录。图片上传限制默认 20 MiB，需与 PHP `upload_max_filesize` 和 `post_max_size` 一致。
5. 配置 HTTPS 后打开站点。注册由首次登录自动创建账号；账号名唯一，密码至少 8 位。

## 注意

目前 API 已覆盖登录会话、相册读取、上传、可见性、批量删除、头像、个人外观设置和标注增删改。访客无需账号，可浏览公开相册。上线前先用非生产域名验证备份、上传和权限。

## 上线清单

完整的步骤、Nginx 配置（`deploy/nginx.conf.example`）和手机端验收项见 `deploy/DEPLOY.md`。
上线必须使用 HTTPS：登录 Cookie 带 `Secure` 标记。
