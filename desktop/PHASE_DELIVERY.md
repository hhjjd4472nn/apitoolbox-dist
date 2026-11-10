# C桌面版交付记录

日期：2026-11-10（北京时间）
状态：桌面 0.2.0 核心与手机 v159 v2 同步完成；Windows 原生产物待 Windows x64 构建机。

## 已验证

- `node scripts/check.mjs`：`DESKTOP_CHECK_OK modules=9 pages=9 targets=nsis,portable`，退出码 0。
- `node --test tests/*.test.mjs`：13 tests / 13 pass / 0 fail，退出码 0。
- 手机 ART 真实 exporter：`DESKTOP_SYNC159_ART_OK modules=9 accounts=9 encrypted_fields=19`，退出码 0。
- 桌面读取 ART 原始 JSON：`DESKTOP_IMPORT159_OK accounts=9 modules=9 secret_refs=11`，退出码 0。
- v159 Java/dex：`BUILD159_HELPERS_OK classes=84`、`REG_CHECK OK`、`INVOKE_CHECK_OK`、`SCROLLVIEW_CHECK_OK`、`ASSEMBLE159_OK bytes=1459160`。
- APK：`BUILD159_APK_OK`；v1/v2/v3 签名通过；SHA256 `0fb77a16fe1d65fd6c32e3d6fe643cc46db7d485e1f8550a2c88c7df8b8226de`。
- APK 反解：`APK159_DECODE_OK ... classes=1385`、`PCSYNC159_WIRING_OK modules=9 kdf=PBKDF2-HMAC-SHA1 seal=AES-GCM hmac=SHA256`。
- 新类引用：`NEW_CLASS_REFERENCES159_OK calls=1181`。
- Android 发布：`PUBLISH159_OK`；远端 `REMOTE159_VERIFY_OK checks=7`；CDN 回下载逐字节一致。
- 回退资料：`ROLLBACK158_BACKUP_VALID`、`DRY_RUN_ONLY no_remote_change no_device_install`。

## 未完成

- 当前环境无法生成或运行 Windows NSIS/portable 安装包；需 Windows 10/11 x64 执行 `npm install && npm run check && npm test && npm run dist`。
- Electron 本地预览和截图未执行，原因是当前 Linux/Android 环境 Electron 二进制 postinstall 未完成。
- 微云签到/翻牌桌面任务、小刀可见登录/Turnstile、千问 Windows 原生网关、托盘/Task Scheduler 仍需逐项移植和 Windows 验收。