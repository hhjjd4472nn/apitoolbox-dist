# API 工具箱桌面功能矩阵

基线：手机集合版 v159；桌面工程 `0.2.0`。

| 区域 | 状态 | 说明 |
|---|---|---|
| 九模块注册/端口 | 已落地 | keypool 8787、gorouter 9192、baiwhite 9193、keyquery 9194、vsllm 9195、xingzhou 9300、xiaodao 9302、wbhub 8765、qianwen 7860 |
| 通用代理 | 已落地 | 本地鉴权、HTTP/SSE 流、请求体上限、错误日志、固定/轮换选择 |
| KeyQuery | 已落地 | Bearer key、过期选择、DeepSeek `X-Session-ID` 请求形状 |
| 腾讯反代 | 已落地 | 国内/全球域名、请求头形状、refresh 重试、流请求转换 |
| 手机同步 | 已落地 | v2 九模块快照、PBKDF2、AES-GCM、HMAC、safeStorage 导入 |
| 备份 | 已落地 | v2 非敏感状态导出/导入、固定/启用策略合并 |
| 邮箱客户端 | 已落地 | 摘要/详情分离、正文转换、验证码提取契约 |
| 任务队列 | 已落地 | 有界执行、防重入、失败计数、事件日志 |
| 微云签到/翻牌真实桌面任务 | 待接入 | 手机 v158/v159 逻辑已保留在 Android 侧，桌面任务需逐项迁移 |
| 小刀真实登录/Turnstile | 待接入 | 保留固定使用账号模型，不绕过可见验证 |
| 千问 Windows 网关 | 待接入 | Android 使用 `libqwen2api.so`，需 Windows 原生端口 |
| Windows NSIS/portable | 待 Windows x64 | 配置已在 package.json，当前环境没有 Windows 构建产物 |
