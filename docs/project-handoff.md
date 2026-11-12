# 项目交接｜当前状态与下一步

> 供无法访问 Aru 工作区的普通对话读取。本文不包含真实凭据、线上路径内容、内部安全事件细节或私人交接记录。事实以 GitHub `main` 的实际代码与 CI 为准。

## 项目与协作约定

- 仓库：`sysy0628/human-reality-bridge`（Private）。
- GitHub `main` 是源码、测试、CI 与公开文档的唯一真源。
- 最终前端运行载体是 **Aru 普通卡片**；卡片是 GitHub 前端源码的发布产物，不是第二份开发真源。
- 开发流程：branch → PR → CI → squash merge。
- 未经维护者单独明确确认，不修改或部署 VPS，不生成或读取真实凭据，不开放端口，不保存真实 sender bundle，也不触发真实递送。

## 产品边界

系统把公开气象观测整理为“使用者所处的人类现实环境数据”，不是 AI 的亲身感官，也不假定 AI 与使用者处于同一物理空间。

位置、城市、行政区、搜索文字、经纬度与内部位置 ID 只允许在天气取数边界使用，不进入递送正文、模板变量、普通日志、排障记录或对外事件。Control Token 与 sender bundle 只留普通卡片页面内存；控制地址可以保存。

## 当前代码链路

```text
Aru 普通卡片
  → HTTPS browser client
  → 公网 HTTPS 反向代理（尚未部署）
  → 宿主机 127.0.0.1:9443
  → 独立 HTTPS control server
  → Bearer / exact-origin CORS / 20 KiB body-limit API
  → Aru v2 sender bundle 严格校验
  → 0600 原子写入 bridge-pairing 命名卷
  → environment bridge 只读加载
  → 兼容 submitWakeEvent sender
  → 固定目标的 Aru 外部触发器
```

直接创建的新 Aru 外部触发器仍提供兼容的 `aru.wake-bridge.sender-bundle.v2`。因此环境桥复用既有 `submitWakeEvent(bundle, content)` sender，不复制第二份加密协议。

## 1–9 阶段状态

### 1. 代码侧安全审计｜代码与 mock 层已完成，真实部署仍待验收

已核对：

- `server/control-api.js`：至少 32 字符 Bearer Token，经 SHA-256 digest 与 constant-time comparison 校验；
- 只接受精确 HTTPS Origin 白名单，不支持 `*`；只向授权来源返回 CORS；
- 默认拒绝非 HTTPS；请求体上限 20 KiB；
- GET 只返回脱敏配对摘要；PUT 只保存 bundle，不返回秘密或 secret 路径；
- `server/aru-trigger-credential.js`：严格校验 v2 schema、UUID、HTTPS 标准端点、32-byte 规范 Base64 Token/密钥与 16 KiB 输入上限；
- bundle 通过同目录临时文件、`0600` 权限、同步后 rename 和最终 chmod 原子写入；失败清理临时文件；
- `server/safe-log.js`：日志详情字段白名单，丢弃位置、正文、payload、错误原文和凭据；
- `test/control-api.test.js` 明确锁定“保存配对只写 secret，不触发发送且不返回路径”；
- 凭据存储、控制服务 transport、卡片 GET/PUT 客户端均有 mock 测试。

尚未完成：真实反向代理、文件所有权、宿主机权限、日志配置和运行时请求的部署后复核。

### 2. 仓库自动验证｜已完成并持续运行

GitHub Actions 执行：

- `npm run check`；
- `npm test`（全部使用 mock/假凭据）；
- Control Compose 结构校验；
- 基础 Docker 镜像构建；
- 镜像常见 secret 路径检查；
- `--network none` 的关闭态正式容器 smoke test；
- `--network none` 的假 sender + 假 bundle 容器集成测试。

关闭态 smoke test验证：未配置 sender、`enabled: false`、不采集、不排队、不发送、非 root、只读根文件系统、状态文件 `0600`、健康检查和优雅停止。CI 不读取真实凭据，不连接 Wake Field 或 Aru。

### 3. VPS 只读预检｜清单已完成，尚未执行

允许读取的范围仅为：容量、Docker/Compose 版本、监听端口、现有反向代理类型与防火墙摘要。

禁止读取 `.env`、Token、证书私钥、sender bundle、请求日志、完整 `docker inspect`、环境变量或 shell history；禁止创建文件、拉取镜像、开放端口、修改防火墙、重启服务或生成凭据。

具体命令与脱敏要求见 `docs/control-deployment.md`。执行前仍需维护者明确确认范围。

### 4. 部署与回滚方案｜通用草案已完成，实机方案待定

已有：

- control 容器内 `0.0.0.0:9443`，宿主机仅发布 `127.0.0.1:${BRIDGE_CONTROL_HOST_PORT:-9443}:9443`；
- 公网必须经过 HTTPS 反向代理；
- 上游证书必须校验，不允许关闭校验绕过问题；
- control 对 `bridge-pairing` 命名卷读写，environment bridge 只读；
- 资源上限：bridge 128 MiB / 0.25 CPU / 64 PIDs，control 96 MiB / 0.20 CPU / 48 PIDs；日志 5 MiB × 3；
- 非 root、只读根文件系统、`no-new-privileges`、丢弃全部 capabilities、受限 tmpfs。

普通卡片观察到的 Origin 候选为：

```text
https://surface.aru.invalid
```

它只能作为候选。最终必须由控制入口实际收到的 `Origin` 请求头确认；绝不使用 `*`。公网域名、证书方式、端口冲突与回滚命令必须等 VPS 只读预检后定稿。

### 5. 部署空载控制服务｜未执行

代码与 Compose 草案已存在，但没有部署或修改 VPS，没有生成真实 Control Token 或证书，没有开放端口。首次部署必须不放 sender bundle，并保持 environment bridge `enabled: false`。

### 6. 卡片首次“检查连接”｜未执行

卡片客户端已实现 GET 检查连接，使用 Bearer、10 秒超时、`cache: no-store`、`credentials: omit` 与 `referrerPolicy: no-referrer`。真实检查尚未进行。

首次检查只验证 HTTPS、CORS 与 Bearer 鉴权，不保存 bundle、不发送事件，并同时核对入口实际收到的 Origin。

### 7. 配对保存｜代码与测试完成，真实保存未执行

卡片 PUT、受保护 API、严格校验、`0600` 原子存储与脱敏回读已实现。保存成功后卡片清除页面内存中的待保存 bundle。

mock 测试已经证明保存路径只调用凭据写入，不创建事件、不初始化递送、不发送消息。真实 sender bundle 尚未读取或保存；进入该步骤前必须单独确认。

### 8. 空载运行验收｜核心 mock/容器验收已完成，部署后验收未执行

天气、规则、模板、免打扰、冷却、持续确认和单槽位最新状态已有测试；关闭态与离线假 sender 容器测试已通过。

仍需在真实空载部署后保持递送关闭，复核健康状态、权限、天气采集、配置热加载、规则与模板行为，以及没有意外递送。

### 9. 真实测试递送｜未执行

没有真实 `environment.test`，也没有验证房间内原始触发隐藏与托管回复。最后必须再次单独确认，只发送一次明确标注的测试事件；验收后再决定是否正式启用。

## 普通卡片现状

- 最终载体已确定为 Aru 普通卡片；
- 卡片已观察到 Origin 候选 `https://surface.aru.invalid`；
- GitHub 前端包含 Origin 本地自检、移动端适配、VPS 配对 GET/PUT 客户端；
- 页面本地观察值不等于网络侧最终证据；
- 不得用工作区项目页面、对话内组件或猜测值替代普通卡片 Origin。

## 下一步顺序

1. 查看本文件和 GitHub 最新 `main`，确认 CI 全绿；
2. 经维护者确认后执行严格限定的 VPS 只读预检；
3. 根据脱敏结果形成具体部署与回滚方案；
4. 再经确认后部署空载 control，bridge 保持 `enabled: false`，不放 bundle；
5. 从普通卡片执行一次“检查连接”，核对 HTTPS、CORS、Bearer 与实际 Origin；
6. 单独确认后保存固定目标触发器的真实 bundle；
7. 完成空载运行验收；
8. 最后再次单独确认一次真实测试递送。

## 给新对话的起点

> 请先读取 Private GitHub 仓库 `sysy0628/human-reality-bridge` 的 `docs/project-handoff.md`，并以 GitHub 最新 `main` 为代码真源。普通卡片是真实前端载体，观察到的 Origin 候选为 `https://surface.aru.invalid`，但最终必须由网络请求头确认，不能使用 `*`。下一步是经我确认后执行文档规定的 VPS 只读预检；未经单独确认，不修改或部署 VPS、不生成或读取真实凭据、不开放端口、不保存真实 bundle，也不触发真实递送。
