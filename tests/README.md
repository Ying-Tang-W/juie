# 自动化测试（Playwright，Mock 模式）

运行前先启动静态服务器（项目根目录）：

    python3 -m http.server 8777

再安装 Playwright 并执行（需要本机已有 Chromium）：

    node tests/rules.test.js          # CODEX_HANDOFF 第二节交互规则，20 条
    node tests/features.test.js out/  # 快捷键、上一张/下一张、弹窗关闭，并输出截图
    node tests/touch-mark.test.js out/  # 手机触控：打点保存、双击缩放
    node tests/smoke-screens.js out/    # 桌面 + iPhone 13 截图与溢出检查

全部测试都只使用 Mock 数据（`window.IA_USE_HTTP_API = false`），不需要数据库。
