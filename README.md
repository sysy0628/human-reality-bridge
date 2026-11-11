# 人类现实感应桥

> 当前状态：**Private 内部验证版**。尚未面向公众发布，也不应被视为已完成的通用部署包。

人类现实感应桥把公开气象源的观测整理为客观、克制的「使用者所处的人类现实环境数据」，再按定时计划或显著变化递送到 Aru。

这些数据不是 AI 的亲身感官，也不表示 AI 与使用者处于同一物理空间。

## 当前架构

```text
Open-Meteo → 环境服务 → Delivery Adapter → Aru 外部触发器
                      ↑
                Aru 控制面板
```

环境服务负责：

- 当前天气、温度、体感、湿度、风、降水、云量与昼夜；
- 默认关闭的可选空气质量；
- 检查频率和递送频率分离；
- 结构化规则、持续确认、冷却与跨午夜免打扰；
- 断网或免打扰期间只保留最新环境状态；
- 用户可编辑的定时/变化纯文本模板；
- 最多 7 天 / 200 条的脱敏排障记录；
- 普通日志字段白名单。

## 两条递送路径

项目计划支持两条相互独立的接入路径，共用天气、规则、模板和状态核心：

### 1. 复用既有 Wake Field sender

当前服务端已经实现这一条路径：

- 动态加载兼容的 sender 模块；
- 从只读 secret 文件加载 `aru.wake-bridge.sender-bundle.v2`；
- 只把最终 `deliveryText` 交给 `submitWakeEvent(bundle, content)`；
- 不在本项目复制第二份 Wake Bridge 加密协议；
- sender 与 bundle 未同时配置时保持禁用。

### 2. 直接新建 Aru 外部触发器

面向没有既有 Wake Field 部署的使用者。控制面板已有发送凭据的页面内存校验原型，但以下部分仍未完成：

- 受保护的配对/保存 API；
- 独立的直接外部触发器 Delivery Adapter；
- 凭据生命周期、轮换和部署向导；
- 完整端到端验收。

因此目前不能把第二条路径描述为可部署完成。

## 隐私边界

城市、行政区、搜索文字、经纬度与内部位置 ID 只允许在天气取数边界使用，不进入：

- 卡片环境展示；
- 递送正文；
- 普通日志或排障历史；
- 模板变量；
- 对外环境事件。

控制面板不会把城市搜索文字或完整地点对象写入 `localStorage`。真实 sender bundle、Token、`.env` 与运行配置不得提交到仓库。

## 本地检查

需要 Node.js 20 或更高版本：

```bash
npm run check
npm test
```

基础镜像构建：

```bash
docker build -t human-reality-bridge:local .
```

基础镜像默认不包含、挂载或启用 sender。任何真实递送测试都必须单独确认后进行。

## 当前验证状态

已经完成：

- Private GitHub 仓库与核心源码归档；
- VPS 隔离目录中的 Node 22 核心行为探针：7 项通过；
- Docker 安全探针：非 root、只读根文件系统、命名卷可写、状态文件 `0600`、镜像无 secret 路径；
- 探针资源已全部清理。

仍需完成：

- 对 Private 仓库当前完整提交运行 `npm run check` 与 `npm test`；
- 对正式 Dockerfile 做完整构建与服务健康检查；
- 实现受保护的控制面板保存 API；
- 完成第二条直接外部触发器适配；
- 经明确授权后，才进行一次真实 Wake Field 测试递送。

> 注意：当前 GitHub 连接没有写入 Actions workflow 的权限，因此仓库尚未安装自动 CI。不能把隔离探针结果等同于完整仓库测试通过。

## 目录

- `server/`：环境服务、规则、模板、状态、日志与 Wake Field sender 薄适配；
- `src/`、`index.html`：Aru 控制面板原型；
- `test/`：服务端 mock 测试；
- `docs/architecture.md`：架构与双路径说明；
- `docs/deployment.md`：内部验证阶段的安全部署边界；
- `docs/event-schema.md`：脱敏快照与事件契约；
- `compose.yaml`：不启用 sender 的基础部署；
- `compose.wake.example.yaml`：可选只读 sender/bundle 挂载示例。

## 发布与许可证

仓库当前保持 Private，尚未选择开源许可证。未经维护者明确决定，不应公开、镜像或对外发布。
