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
用户模板纯文本渲染 + 可选原生组件展示偏好
    ↓
兼容 submitWakeEvent sender
    ↓
Aru 外部触发器
```

天气适配器接收位置配置，但返回给规则、模板、历史和递送层的对象不包含城市、行政区、搜索文字、经纬度或内部位置 ID。

## 卡片控制面

Aru 卡片将非位置设置保存到 `bridgeSettings`。城市搜索直接访问 Open-Meteo，候选只存在于当前页面；选中后坐标和时区通过 `PUT /v1/location` 一次性写入 VPS，卡片立即清除具体位置，长期只保存 `locationConfigured`。日常天气通过 VPS 的脱敏接口返回。自定义地点标签列表只保存在卡片，服务端仅接收当前选中的状态。

原生环境组件默认关闭。开启后不规定字段顺序、布局或视觉层级；协作者可以自由设计组件，并在组件后自然回应。

## Sender 与直接触发器

`server/wake-sender.js` 是薄适配器：

1. 从受限路径读取 `aru.wake-bridge.sender-bundle.v2`；
2. 校验 bundle；
3. 动态导入兼容 sender；
4. 调用 `submitWakeEvent(bundle, content)`；
5. 只传递最终 `deliveryText`。

本项目不复制 Wake Bridge 的加密协议。基础部署未配置 sender 时不读 secret，也不发送。

## 受保护控制面

```text
Aru 卡片
  → HTTPS
  → 受控反向代理
  → 宿主机回环端口
  → control 容器
  → Bearer / exact-origin CORS / body limit
  → 配置卷与配对卷
```

控制面使用至少 32 字符 Token、精确 HTTPS Origin 白名单、严格正文上限和原子写入。保存配对或位置只写私有卷，不创建或发送事件。

## 单槽位语义

天气是快速变化的状态，而不是需要补发的消息队列：

- 新状态覆盖未发送的旧状态；
- 恢复网络或结束免打扰后只发送最新环境；
- 新状态不继承被覆盖事件的退避时间；
- 同轮优先级为立即规则、普通规则、定时更新。
