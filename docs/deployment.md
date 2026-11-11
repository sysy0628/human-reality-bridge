# 部署说明（内部验证阶段）

> 当前仓库保持 Private。以下内容用于安全验收，不代表已经发布的通用部署方案。

## 基础模式

基础 `compose.yaml`：

- 默认不配置 sender；
- 使用非 root 镜像用户；
- 根文件系统只读；
- 丢弃 Linux capabilities；
- 启用 `no-new-privileges`；
- 配置与状态使用命名卷。

准备本地配置：

```bash
cp .env.example .env
```

然后进行构建检查：

```bash
npm run check
npm test
docker compose build
```

不要把 `.env`、`config.json`、状态目录、日志或 sender bundle 提交到 Git。

## 可选 Wake Field sender 模式

`compose.wake.example.yaml` 仅是叠加示例。部署者应创建不提交到仓库的私有 override，并设置两个宿主机路径：

```env
BRIDGE_WAKE_SENDER_HOST_PATH=/absolute/path/to/wake-send.mjs
BRIDGE_WAKE_BUNDLE_HOST_PATH=/absolute/path/to/aru-sender-bundle.json
```

启动时叠加：

```bash
docker compose -f compose.yaml -f compose.wake.example.yaml up -d
```

要求：

- sender 和 bundle 必须同时提供；
- 两者均只读挂载；
- bundle 仅服务账号可读；
- `BRIDGE_SEND_STARTUP_TEST` 默认保持 `false`；
- 未经明确确认，不得执行真实测试递送。

## 直接外部触发器模式

尚未达到可部署状态。目前只有控制面板的页面内存校验，不存在正式保存 API，也没有完整独立适配器。不要通过临时无鉴权 HTTP 接口、环境变量明文或仓库文件保存发送凭据。

## 数据和日志

运行状态可以保存：

- 上一份脱敏快照；
- 规则持续确认与冷却状态；
- 最新待发送事件；
- 稳定事件 ID；
- 最多 7 天 / 200 条的脱敏排障记录。

不得保存城市名、搜索文字、聊天记录、完整模板、最终成功递送正文或凭据。普通日志使用字段白名单。

## 验收清单

- [ ] `npm run check` 通过；
- [ ] `npm test` 全部通过；
- [ ] 正式 Dockerfile 构建通过；
- [ ] 未配置 sender 时不读 secret、不发送；
- [ ] 容器以非 root 用户运行；
- [ ] 只读根文件系统和命名卷可用；
- [ ] 镜像层与文件列表不含 secret；
- [ ] 保存设置不触发发送；
- [ ] 免打扰与断网恢复只发送最新状态；
- [ ] 真实测试递送已获得单独确认。
