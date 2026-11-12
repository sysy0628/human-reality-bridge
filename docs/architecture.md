# 架构与递送路径

## 产品语义

系统整理的是“使用者所处的人类现实环境数据/观测”，不是 AI 的亲身感官，也不假定 AI 与使用者处于同一物理空间。

## 共享核心

```text
Open-Meteo
    ↓
脱敏 EnvironmentSnapshot
    ↓
规则 / 持续确认 / 冷却 / 免打扰 / 单槽位最新状态
    ↓
用户模板纯文本渲染
    ↓
兼容 submitWakeEvent sender
    ↓
Aru 外部触发器
```

天气适配器接收位置配置，但返回给规则、模板、历史和递送层的对象不包含城市、行政区、搜索文字、经纬度或内部位置 ID。

## Sender 与直接触发器

`server/wake-sender.js` 是薄适配器：

1. 从受限路径读取 `aru.wake-bridge.sender-bundle.v2`；
2. 校验 bundle；
3. 动态导入兼容 sender；
4. 调用 `submitWakeEvent(bundle, content)`；
5. 只传递最终 `deliveryText`。

本项目不复制 Wake Bridge 的加密协议。基础部署未配置 sender 时不读 secret，也不发送。

从 Aru 新建的直接外部触发器提供同一 v2 sender bundle。因此它通过受保护配对流程写入运行时 secret 后，复用相同 sender；不需要复制一条天气、规则、状态或加密实现。

## 受保护配对控制面

```text
Aru 普通卡片
  → HTTPS browser client
  → 公网 HTTPS 反向代理
  → 宿主机 127.0.0.1:9443
  → HTTPS control server
  → Bearer / exact-origin CORS / body limit
  → v2 bundle 校验
  → 0600 原子写入 bridge-pairing 卷
```

已实现：

- 至少 32 字符的 Bearer Token；
- 精确 HTTPS Origin 白名单；
- GET 脱敏配对摘要；
- PUT 严格校验和原子存储；
- 卡片端 GET/PUT；
- Token 与 bundle 只留卡片页面内存；
- 保存配对不创建或发送事件。

## 单槽位语义

天气是快速变化的状态，而不是需要补发的消息队列：

- 新状态覆盖未发送的旧状态；
- 恢复网络或结束免打扰后只发送最新环境；
- 新状态不继承被覆盖事件的退避时间；
- 同轮优先级为立即规则、普通规则、定时更新。

## 已验证与未完成

GitHub CI 已验证语法、mock 测试、Compose 结构、基础镜像、secret 路径、关闭态容器生命周期与完全离线的假 sender 集成。

尚未完成真实 VPS 部署、网络侧 Origin 确认、真实 bundle 配对、部署后空载验收和真实测试递送。当前阶段与授权边界见 [`project-handoff.md`](project-handoff.md)。
