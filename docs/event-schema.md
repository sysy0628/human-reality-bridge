# 环境数据与事件契约 v1

## 脱敏环境快照

```json
{
  "capturedAt": 0,
  "observedAt": "14:30",
  "presence": "在家",
  "weather": "小雨",
  "temperature": 18,
  "feelsLike": 17,
  "humidity": 84,
  "wind": "东北风 3 级",
  "precipitationProbability": 80,
  "isRaining": true,
  "airQuality": "未启用",
  "uvIndex": 6.4,
  "uvLevel": "强",
  "summary": "当前有小雨，体感约 17℃。",
  "changes": ["降水刚刚开始"]
}
```

快照不得包含城市、行政区、搜索文字、经纬度、时区或内部位置 ID。

## 事件类型

- `environment.rule_triggered`：结构化规则达到持续时间并通过冷却；
- `environment.scheduled_update`：定时递送到期；
- `environment.latest_state`：待发送槽被新快照刷新；
- `environment.test`：使用者单独确认的连通性测试。

## 模板与展示约束

模板只进行白名单纯文本替换，不执行代码。单份模板最长 4000 字符，最终正文最长 6000 字符。模板变量不提供城市、坐标、内部 ID、Token、文件或环境变量。

原生组件偏好默认关闭。开启时不规定字段顺序、布局或视觉层级；变化事件应突出投递原因，已有降水信息不应遗漏，地点状态单独显示，无效或不重要的数据可以省略。协作者可以在组件后自然回应，但不得补写或猜测位置，也不得编造环境事实。

## Sender 边界

最终只将 `deliveryText` 交给兼容的 `submitWakeEvent(bundle, content)` sender，不复制第二份加密协议，也不得把位置或凭据放入环境事件。
