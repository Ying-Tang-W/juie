# 图记 · 上线与移动端部署清单

适用：宝塔面板 / 任意 Nginx + PHP 8.1+ + MySQL 5.7+（或 MariaDB 10.3+）。

## 0. 已有旧版本、只需更新

1. 把 `tuji-deploy.zip` 上传到服务器 `/root/`。
2. 以 root 执行：`bash /root/update-tuji.sh /www/wwwroot/你的站点目录 /root/tuji-deploy.zip`（脚本在 `deploy/update-tuji.sh`）。
3. 脚本会先备份旧版本到 `/www/backup/`，不会改动 `server/config.php` 和用户上传的图片。
4. 用 Ctrl+Shift+R 强制刷新后验收（见第 3 节）。

回滚：`tar -xzf /www/backup/tuji-时间戳/site-code.tar.gz -C 站点目录`。

## 1. 上线前必须满足

| 项 | 原因 |
|---|---|
| **HTTPS 域名** | 登录 Cookie 设置了 `Secure`，HTTP 下登录后会话不保存；手机端的 PWA、剪贴板等能力也要求安全上下文 |
| PHP 扩展 `pdo_mysql`、`fileinfo`、`mbstring` | 数据库、图片类型校验、中文截断 |
| `upload_max_filesize=20M`、`post_max_size=22M` | 与前端 20 MiB 限制一致（`.user.ini` 已配置，宝塔需确认生效） |
| 数据库已导入 `server/schema.sql` | 包括 `user_settings` 表 |

## 2. 步骤

1. 宝塔 → 数据库：新建库 `image_notes`（utf8mb4）和专用账号，不要用 root。
2. 导入 `server/schema.sql`。
3. 复制 `server/config.example.php` 为 `server/config.php`，填写数据库账号和密码（**不要上传到 Git**）。
4. 站点根目录指向本项目目录；把 `deploy/nginx.conf.example` 的内容按域名、证书路径、PHP 套接字修改后，粘贴到站点的配置文件中，重载 Nginx。
5. 申请 Let's Encrypt 证书（宝塔 → SSL）。
6. 访问 `https://你的域名/`：首次用新账号登录即自动注册，密码至少 8 位。

## 3. 手机端验收

在 iPhone Safari / Android Chrome 中打开，逐项检查：

- [ ] 首屏无横向滚动，顶栏两行、底栏四列均可点按（触控目标 ≥ 40px）
- [ ] 点击底部「图库」弹出抽屉，选中一张后自动收起；下拉抽屉把手可收起
- [ ] 双指捏合缩放、单指拖动平移、双击在「适应」与放大之间切换
- [ ] 旋转屏幕后图片重新适应窗口
- [ ] 编辑模式（仅所有者）：单击空白打点；双击不会误触发缩放
- [ ] 打点弹窗贴底弹出，输入法弹起时输入框不被遮挡
- [ ] 「添加到主屏幕」后以独立窗口打开，图标与名称正确

## 4. 上线后的已知限制与建议

- 当前缩略图直接加载原图（最大 20 MiB），手机流量较大。后续可在上传时生成 480px 缩略图（需要 PHP 的 GD 或 Imagick），缩略网格改用缩略图。
- 本地调试若用 `http://127.0.0.1`，Cookie 的 `Secure` 标记会导致登录不保持，请改用 HTTPS 或临时在 `api.php` 中调整 `session.cookie_secure`。
- 备份：定期备份数据库与 `server/storage/photos/` 目录。
