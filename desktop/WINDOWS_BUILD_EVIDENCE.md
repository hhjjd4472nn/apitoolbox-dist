# Windows x64 构建准备与候选产物证据

日期：2026-11-10（北京时间）
工作目录：临时构建副本 `/tmp/apitoolbox-electron-install`，不修改源码工作区 node_modules。

## 当前机器

- OS：Ubuntu 24.04 容器，运行于 Android Linux kernel
- `uname -m`：`aarch64`
- Node：`v24.21.0`；npm：`11.19.0`
- Wine：未安装；Docker：不存在
- Electron：`v33.4.11` Windows x64 runtime 已由 electron-builder 下载
- ARM64 `makensis`：Ubuntu `nsis 3.09-4` 已安装

## 命令与实际结果

- `npm install --ignore-scripts`：退出0，405 packages added。
- 仅批准 Electron postinstall 后 `npm rebuild electron`：退出0。
- `node scripts/check.mjs`：`DESKTOP_CHECK_OK modules=9 pages=9 targets=nsis,portable`，退出0。
- `node --test tests/*.test.mjs`：13 tests / 13 pass / 0 fail，退出0。
- `ELECTRON_DISABLE_SANDBOX=1 node_modules/electron/dist/electron --no-sandbox --version`：输出 `v33.4.11`。无头执行可启动；UI预览/截图未做。
- `npm exec -- electron-builder --win portable --x64 --config.win.signAndEditExecutable=false`：退出0，生成 PE portable 候选。
- `npm exec -- electron-builder --win nsis --x64 --config.win.signAndEditExecutable=false`：退出1，报 `wine is required`。

## 产物

- Portable 候选：[ApiToolbox-Desktop-0.2.0-x64.exe](/sdcard/tiany/v132/desktop/dist-candidate/ApiToolbox-Desktop-0.2.0-x64.exe)
- 大小：74,269,005 bytes
- SHA256：`cd7e024365a99445473b54340b1ca3740636033fb248a518115791083147b45e`
- 文件头检查：`MZ=True`，PE signature `PE\0\0`。
- 解包目录：`/sdcard/tiany/v132/desktop/dist-candidate/win-unpacked/`，含 `API 工具箱.exe` 与 `resources/app.asar`。
- 该候选由 ARM64 Linux 交叉生成，未签名、未在 Windows 实机启动；不能标记 Windows 安装验收 PASS。

## 正式交付待办

1. Windows x64 机器上执行 `npm install && npm run check && npm test && npm run dist`，生成 NSIS 安装器并重建 portable。
2. 在 Windows 10/11 干净环境验证双击启动、safeStorage、本地九端口、v2 手机同步、备份和数据保留。
3. 独立完成托盘/Task Scheduler/Toast 与各站点业务 parity 验收。