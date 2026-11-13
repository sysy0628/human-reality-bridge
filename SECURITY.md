# Security Policy

## Supported versions

项目正在准备首次公开发行，目前只维护 `main`。首个正式 Release 发布后，本节会改为明确的版本支持表。

## Reporting a vulnerability

请优先使用 GitHub 的 **Private vulnerability reporting / Security Advisory** 私下报告。若仓库尚未开放该入口，请通过维护者已有的私下联系渠道报告。

请不要在公开 Issue、讨论、截图或日志中粘贴真实 Token、sender bundle、私钥、授权请求头、位置配置或递送正文。若怀疑凭据已经暴露，应先撤销或轮换凭据，再进行排查。

报告中可包含：

- 受影响的提交或版本；
- 可使用假凭据复现的最小步骤；
- 预期与实际结果；
- 不含秘密的错误摘要；
- 建议修复（可选）。

## Never commit

- `.env` 或真实运行配置；
- Control/Settings Token、sender bundle 或授权请求头；
- TLS 私钥、数据库、日志、备份、状态文件或命名卷内容；
- 部署专用卡片（其中可能注入设置 Token）；
- 真实城市搜索文字或无关位置资料；
- 包含凭据的截图、测试夹具和错误输出。

仓库只保留 `.env.example`、`config.example.json` 和不含秘密的路径示例。

## Delivery security boundaries

- 基础镜像不内置 sender 或凭据；
- sender 模块与 bundle 文件必须同时配置；
- secret 应从仓库外只读挂载，并仅允许服务账号读取；
- 设置接口使用 HTTPS、精确 Origin 白名单、Bearer Token 和请求体上限；
- 保存设置或配对不得隐式触发递送；
- 日志不得记录模板全文、最终正文、位置、payload、URL、错误原文或凭据；
- 环境桥只读取配对卷，控制服务负责受保护写入；
- 容器以非 root 用户、只读根文件系统、删除 capabilities 和 `no-new-privileges` 运行。

## Secret scanning

公开前与每次 Release 前应至少检查：

```bash
git grep -nE '(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|Authorization: Bearer|sender-bundle|settings-token|control-token)'
```

这只是辅助检查，不能代替 GitHub secret scanning、提交历史扫描和人工审查。