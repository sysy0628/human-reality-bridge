# 人类现实感应桥

> 当前状态：**Private 内部验证版**。尚未面向公众发布，也不应被视为已完成的通用部署包。

人类现实感应桥把公开气象源的观测整理为客观、克制的“使用者所处的人类现实环境数据”，再按定时计划或显著变化递送到 Aru。这些数据不是 AI 的亲身感官，也不表示 AI 与使用者处于同一物理空间。

## 当前架构

```text
Open-Meteo → 环境服务 → 兼容 submitWakeEvent sender → Aru 外部触发器
                      ↑
                Aru 普通卡片
                      ↓
              受保护 HTTPS control API
```

环境服务支持天气、默认关闭的空气质量、检查与递送频率分离、结构化规则、持续确认、冷却、跨午夜免打扰、单槽位最新状态、用户模板、脱敏排障记录与日志白名单。

## 递送与配对状态

服务端已经实现：

- 动态加载兼容 `submitWakeEvent(bundle, content)` 的 sender；
- 严格校验 `aru.wake-bridge.sender-bundle.v2`；
- `0600` 原子凭据存储与脱敏摘要；
- HTTPS-only、精确 Origin、Bearer 鉴权、20 KiB 请求上限的配对 API；
- 默认仅监听回环的独立 HTTPS control server；
- 卡片侧 GET/PUT 配对客户端；
- control 读写、environment bridge 只读的运行时配对卷；
- 回环端口、资源与日志限制的 Compose 草案。

新建 Aru 外部触发器提供兼容的 v2 bundle，因此直接触发器路径复用同一 sender，不复制加密协议。保存配对只写入凭据，不创建或发送事件；该边界有 mock 测试锁定。

尚未进行真实 VPS 部署、真实配对或真实递送。

## 隐私边界

城市、行政区、搜索文字、经纬度与内部位置 ID 只允许在天气取数边界使用，不进入卡片环境展示、递送正文、普通日志、排障历史、模板变量或对外事件。

真实 sender bundle、Token、`.env` 与运行配置不得提交到仓库。卡片只允许持久化控制地址；Control Token 与 sender bundle 只留页面内存。

## 自动验证

需要 Node.js 20 或更高版本：

```bash
npm run check
npm test
```

GitHub Actions 还执行：

- Control Compose 结构校验；
- 基础 Docker 镜像构建；
- 镜像常见 secret 路径检查；
- `--network none` 的关闭态容器 smoke test；
- `--network none` 的假 sender + 假 bundle 集成测试。

CI 不加载真实凭据、不连接 Wake Field 或 Aru，也不执行真实递送。

## 当前阶段

已完成代码与 mock 层的控制 API、鉴权、CORS、bundle 存储、日志脱敏、卡片配对客户端、安全部署草案和自动验证。

尚未完成：

- VPS 只读预检及基于实机情况的部署/回滚定稿；
- 空载 control 服务部署；
- 普通卡片真实“检查连接”及网络侧 Origin 确认；
- 真实 bundle 配对；
- 部署后空载运行验收；
- 经单独确认的一次真实测试递送。

详细、可供普通对话直接读取的状态见 [`docs/project-handoff.md`](docs/project-handoff.md)。部署边界见 [`docs/control-deployment.md`](docs/control-deployment.md)。

## 目录

- `server/`：环境服务、规则、模板、状态、日志、sender 与 control 服务；
- `src/`、`index.html`：Aru 普通卡片前端源码；
- `test/`：mock 测试；
- `scripts/`：Compose 校验与无网络容器测试；
- `.github/workflows/validate.yml`：Private 仓库自动验证；
- `docs/project-handoff.md`：当前状态、阶段完成度与下一步；
- `docs/control-deployment.md`：控制服务安全部署与只读预检；
- `compose.yaml`、`compose.control.example.yaml`：基础与控制服务草案。

## 发布与许可证

仓库当前保持 Private，尚未选择开源许可证。未经维护者明确决定，不应公开、镜像或对外发布。
