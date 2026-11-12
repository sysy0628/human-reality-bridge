# 部署说明（内部验证阶段）

> 当前仓库保持 Private。以下内容用于安全验收，不代表已经部署或发布。未经维护者明确确认，不修改 VPS、不生成或读取真实凭据、不开放端口，也不触发真实递送。

## 基础模式

基础 `compose.yaml` 默认不配置 sender，并使用非 root 镜像用户、只读根文件系统、丢弃 capabilities、`no-new-privileges`、受限 tmpfs、资源限制和命名卷。

本地检查：

```bash
npm run check
npm test
docker compose build
```

不要把 `.env`、`config.json`、状态目录、日志、Token 或 sender bundle 提交到 Git。

## 受保护控制服务

`compose.control.example.yaml` 与基础 Compose 叠加，提供：

- control 容器内 `0.0.0.0:9443`；
- 宿主机严格绑定 `127.0.0.1:${BRIDGE_CONTROL_HOST_PORT:-9443}:9443`；
- 公网仅通过受控 HTTPS 反向代理；
- TLS key/cert、Control Token 与 sender 模块从仓库外只读挂载；
- control 对 `bridge-pairing` 运行时卷读写，environment bridge 只读；
- 精确 HTTPS Origin 白名单、Bearer 鉴权与 20 KiB 请求体上限。

受保护保存 API 已实现。保存配对只写 bundle secret，不创建事件、不初始化递送，也不发送消息；测试对此有明确断言。

完整结构、反向代理要求、Origin 确认与 VPS 只读预检见 [`control-deployment.md`](control-deployment.md)。

## 自动验收现状

GitHub Actions 已执行并持续回归：

- [x] `npm run check`；
- [x] `npm test`；
- [x] Control Compose 结构校验；
- [x] 正式 Dockerfile 构建；
- [x] 镜像常见 secret 路径检查；
- [x] 未配置 sender、`enabled: false` 时不采集、不排队、不发送；
- [x] 非 root、只读根文件系统、状态文件 `0600`、健康检查和优雅停止；
- [x] 完全离线的假 sender + 假 bundle 容器集成；
- [x] 保存配对不触发发送。

## 尚未执行的真实环境步骤

- [ ] VPS 只读预检；
- [ ] 基于实机情况定稿部署与回滚；
- [ ] 空载 control 部署，bridge 保持 `enabled: false`；
- [ ] 普通卡片首次“检查连接”并确认实际 Origin；
- [ ] 经单独确认后保存真实 sender bundle；
- [ ] 部署后空载运行验收；
- [ ] 再次单独确认后进行一次真实测试递送。

## 数据和日志

运行状态只保存继续运行所需的脱敏快照、规则状态、最新待发送事件、稳定事件 ID 与最多 7 天/200 条的脱敏排障记录。不得保存城市名、搜索文字、聊天记录、完整模板、最终成功递送正文或凭据。普通日志使用字段白名单。

当前阶段完成度、普通卡片 Origin 候选和严格授权边界见 [`project-handoff.md`](project-handoff.md)。
