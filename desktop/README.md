# API 工具箱 Windows 桌面版

桌面工程版本 `0.2.0`，目标 Windows 10/11 x64。已落地 Electron 主进程、安全 preload、九模块注册、代理入口、账号策略、v2 手机同步、备份和独立 Windows 更新清单。

## v2 手机同步

手机集合版 v159 在 `19300` 提供 `apitoolbox-sync-v2`：九模块全量账号/状态快照；配对码派生 PBKDF2-HMAC-SHA1 密钥；敏感凭据逐项 AES-GCM 密封；整包 HMAC-SHA256 验签。电脑端验签后把账号和敏感偏好写入 Electron `safeStorage`，`state.json`、renderer 快照和明文备份不保存凭据。

## 开发与构建

```sh
npm install
npm run check
npm test
npm start
```

Windows x64 构建：

```powershell
npm install
npm run check
npm test
npm run dist
```

`dist/` 目标包括 NSIS 安装器和 portable x64。当前共享 Linux/Android 环境没有 Electron 二进制和 Windows 产物，因此不能把本地 Node 回归写成 Windows 安装验收。

## 数据与边界

默认代理仅监听 `127.0.0.1`。敏感字段只进 safeStorage；本机代理密钥采用 safeStorage lazy 初始化。KeyQuery 保留密钥轮换、过期选择和 DeepSeek `X-Session-ID` 请求形状；千问账号可同步，但其 Android `libqwen2api.so` 原生网关需要单独 Windows 端口移植。
