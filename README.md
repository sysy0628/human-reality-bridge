# 人类现实感应桥

人类现实感应桥（Human Reality Bridge）把公开气象数据整理为克制、可配置的“使用者所处的人类现实环境观测”，再通过 Aru 外部触发器主动递送给协作者。

> 项目正在准备首次公开发行。核心链路已经在真实 VPS、真实 Aru 卡片与真实外部触发器上运行验证；仓库仍需完成许可证选择、安装自动化和干净环境验收，暂不宣称“克隆即可使用”。

## 能做什么

- Open-Meteo 当前天气、温度、体感、湿度、风、降水概率、云量、昼夜、日出日落与紫外线；
- 默认关闭、按需查询的空气质量；
- 手动地点状态（在家、外出、自定义可复用标签），不读取或推断轨迹；
- 定时递送、显著变化递送、持续确认、冷却时间与跨午夜免打扰；
- 单槽位最新状态队列：恢复网络后只发送最新环境，不补发过期天气；
- 定时与变化文案模板，使用白名单变量进行纯文本替换；
- 可选的 Aru 原生环境组件偏好，标题可自定义，默认关闭；
- 脱敏日志、短期排障记录和容器健康检查。

## 架构

```text
Open-Meteo
  → VPS 环境服务（取数、脱敏、规则、队列）
  → 兼容 submitWakeEvent(bundle, content) 的 sender
  → Aru 外部触发器
  → 协作者

Aru 卡片
  → 显式持久保存 bridgeSettings
  → 受保护 HTTPS 设置接口
  → VPS 运行配置
```

服务端正式位置对象只包含取数所需的：

```text
latitude / longitude / timezone
```

城市名、行政区、国家与搜索文字不会进入正式配置、递送正文、普通日志或排障历史。经纬度用于服务端天气取数，但不会出现在递送正文中。

## 当前成熟度

已验证：

- 真实 VPS 双容器运行；
- 卡片设置持久化与 HTTPS 同步；
- 真实 sender bundle 配对；
- 真实定时与规则变化递送；
- 城市切换、地点状态和原生组件偏好；
- 非 root、只读根文件系统、能力删除与资源限制；
- mock 测试、离线 sender 集成、可复现发布包与 Docker 构建。

首次公开发行前仍需完成：

- 许可证选择；
- 初始化与卡片构建脚本；
- 从干净主机执行一次完整安装验收；
- 最终秘密扫描；
- `v0.1.0` 标签与 Release。

## 本地验证

需要 Node.js 20 或更高版本（CI 使用 Node.js 22）：

```bash
npm run check
npm test
```

容器与 Compose 验收：

```bash
docker build -t human-reality-bridge:local .
bash scripts/validate-control-compose.sh
bash scripts/smoke-disabled-container.sh human-reality-bridge:local
bash scripts/smoke-mock-sender-container.sh human-reality-bridge:local
```

这些测试使用假凭据，不连接真实 Aru。

## 部署提示

当前部署流程面向熟悉 Docker、HTTPS 反向代理和 secret 管理的技术用户。开始前请阅读：

- [架构与递送路径](docs/architecture.md)
- [部署说明](docs/deployment.md)
- [控制服务安全部署](docs/control-deployment.md)
- [事件契约](docs/event-schema.md)
- [安全政策](SECURITY.md)

运行者需要自行准备 HTTPS 域名/入口、TLS 证书、随机设置 Token、Aru sender bundle，以及兼容的 `submitWakeEvent(bundle, content)` sender。真实 secret 必须留在仓库外。

## 目录

- `server/`：天气、规则、模板、状态、日志、sender 与控制服务；
- `src/`、`index.html`：Aru 卡片前端源码；
- `test/`：mock 与边界测试；
- `scripts/`：发布包、Compose 和离线容器验收；
- `docs/`：架构、部署和事件契约；
- `.github/workflows/validate.yml`：持续验证。

## 安全与隐私

永远不要提交：`.env`、真实 `config.json`、Token、TLS 私钥、sender bundle、部署专用卡片、日志或状态卷。怀疑凭据泄露时，应先撤销或轮换，再排查。详见 [SECURITY.md](SECURITY.md)。

## 许可证

仓库尚未选择开源许可证。在维护者明确添加 `LICENSE` 之前，代码不自动获得复制、修改或再分发许可；请勿镜像或公开再发布。许可证将由维护者在首次公开发行前决定。