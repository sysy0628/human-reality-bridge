# 人类现实感应桥

人类现实感应桥（Human Reality Bridge）把公开气象数据整理为克制、可配置的“使用者所处的人类现实环境观测”，再通过 Aru 外部触发器主动递送给协作者。

## 能做什么

- Open-Meteo 当前天气、温度、体感、湿度、风、正在降水与降水概率、云量、昼夜、日出日落与紫外线；
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
  → 城市搜索候选仅在当前页面短暂存在
  → 一次性把坐标和时区交给自家 VPS
  → 长期只保存 locationConfigured
```

服务端正式位置对象只包含取数所需的：

```text
latitude / longitude / timezone
```

城市名、行政区、国家与搜索文字不会进入正式配置、递送正文、普通日志或排障历史。

## 给人类看的隐私与回复说明

- 选择城市仍在卡片里完成：卡片临时向 Open-Meteo 搜索候选，选中后只把坐标与时区一次性提交给自家 VPS，随后立即从卡片内存和长期状态中清除。
- 卡片长期只保存“位置已配置”，协作者收到的消息不含城市、行政区、搜索词、经纬度或时区。
- 协作者会收到脱敏天气、降水、温度、湿度、风、地点状态和更新时间；变化提醒会说明为什么现在投递，例如开始下雨或明显降温。
- 原生组件没有固定排版、字段顺序或视觉层级。协作者可以按自己的审美自由呈现，并在组件后用自己的语气自然回应。
- 已有降水信息不应遗漏；地点状态单独显示。空气质量、紫外线等无效或当下不重要的信息可以省略。

搜索候选只会在人类设置位置的当前页面短暂可见；系统保证它们不进入卡片长期状态、递送、历史或普通日志，但不承诺对正在同时观看同一屏幕的人隐藏。

## 快速验证

需要 Node.js 20 或更高版本（CI 使用 Node.js 22）：

```bash
npm run check
npm test
bash scripts/audit-source.sh
```

容器与 Compose 验收：

```bash
docker build -t human-reality-bridge:local .
bash scripts/validate-control-compose.sh
bash scripts/smoke-disabled-container.sh human-reality-bridge:local
bash scripts/smoke-mock-sender-container.sh human-reality-bridge:local
```

这些测试使用假凭据，不连接真实 Aru。

## 安全部署工具

生成独立 Control/Settings Token 和私有部署描述：

```bash
node scripts/init-deployment.mjs \
  --output private-deployment \
  --origin https://YOUR-ARU-CARD-ORIGIN \
  --settings-base-url https://YOUR-CONTROL-HOST \
  --sender /absolute/path/to/wake-send.mjs \
  --tls-key /absolute/path/to/control-tls.key \
  --tls-cert /absolute/path/to/control-tls.crt
```

生成内联资源、含部署专用 Settings Token 的单文件 Aru 卡片：

```bash
node scripts/build-card.mjs \
  --base-url https://YOUR-CONTROL-HOST \
  --token-file private-deployment/secrets/settings-token \
  --output private-build/human-reality-bridge.html
```

`private-deployment/` 与 `private-build/` 均默认忽略。生成卡片包含秘密，不得提交或公开分享。完整步骤见 [部署说明](docs/deployment.md)。

## 文档

- [架构与递送路径](docs/architecture.md)
- [部署说明](docs/deployment.md)
- [控制服务安全部署](docs/control-deployment.md)
- [事件契约](docs/event-schema.md)
- [致谢与数据署名](CREDITS.md)
- [安全政策](SECURITY.md)

## 参考、数据来源与致谢

- [sanqianzilanyue/ai-time-weather-phone](https://github.com/sanqianzilanyue/ai-time-weather-phone)：启发了“在模型之外准备动态现实环境，再将紧凑环境块交给 AI”的产品思路。本项目不是其 fork，代码为独立实现。
- [Open-Meteo](https://open-meteo.com/)：提供天气、空气质量与地理编码数据。API 数据按 [CC BY 4.0](https://open-meteo.com/en/licence) 提供；免费 API 依其[使用条款](https://open-meteo.com/en/terms)仅限非商业用途并受调用限额约束。

## 安全与隐私

永远不要提交：`.env`、真实 `config.json`、Token、TLS 私钥、sender bundle、部署专用卡片、日志或状态卷。怀疑凭据泄露时，应先撤销或轮换，再排查。详见 [SECURITY.md](SECURITY.md)。

## 许可证

项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)，属于**非商业 source-available（源码可见）软件**，不是 OSI 定义的开源软件。
