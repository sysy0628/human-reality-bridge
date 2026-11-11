# 环境数据与事件契约 v1

## 脱敏环境快照

```json
{
  "capturedAt": 0,
  "observedAt": "14:30",
  "weather": "小雨",
  "temperature": 18,
  "feelsLike": 17,
  "humidity": 84,
  "wind": "东北风 3 级",
  "precipitation": 0.6,
  "precipitationProbability": 80,
  "cloudCover": 92,
  "isDay": true,
  "light": "白天光线偏暗",
  "sunrise": "06:20",
  "sunset": "17:48",
  "airQuality": "未启用",
  "summary": "当前有小雨，体感约 17℃。",
  "changes": ["降水刚刚开始"]
}
```

快照不得包含城市、行政区、搜索文字、经纬度或内部位置 ID。

## 内部事件

```json
{
  "schema": "human-reality-bridge.event.v1",
  "event": "environment.rule_triggered",
  "eventId": "rain-probability:0",
  "occurredAt": "2026-01-01T00:00:00.000Z",
  "ruleId": "rain-probability",
  "action": "immediate",
  "environment": {
    "weather": "小雨",
    "temperature": 18,
    "feelsLike": 17,
    "humidity": 84,
    "precipitationProbability": 80,
    "isRaining": true
  },
  "changes": ["降水刚刚开始"],
  "deliveryText": "由用户模板渲染的纯文本"
}
```

## 事件类型

- `environment.rule_triggered`：结构化规则达到持续时间并通过冷却；
- `environment.scheduled_update`：定时递送到期；
- `environment.latest_state`：待发送槽被新快照刷新；
- `environment.test`：使用者单独确认的连通性测试。

## 模板约束

模板只进行白名单纯文本替换，不执行代码。单份模板最长 4000 字符，最终正文最长 6000 字符。模板变量不提供城市、坐标、内部 ID、Token、文件或进程环境变量。

## 适配边界

路径 A 将 `deliveryText` 交给兼容的 `submitWakeEvent(bundle, content)`；路径 B 后续由独立直接外部触发器适配器实现。两条路径均不得把位置或凭据放入环境事件。
