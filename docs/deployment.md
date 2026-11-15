# 部署说明

> 当前流程面向熟悉 Docker、HTTPS 反向代理和 secret 管理的技术用户。脚本会生成安全初始文件，但不会替你配置域名、证书、反向代理或 Aru sender。

## 1. 本地验证

```bash
npm run check
npm test
docker build -t human-reality-bridge:local .
bash scripts/validate-control-compose.sh
```

不要把 `.env`、真实 `config.json`、状态目录、日志、Token、TLS 私钥、sender bundle 或部署专用卡片提交到 Git。

## 2. 准备外部文件

运行者需要先准备 HTTPS 域名、TLS 私钥与证书、兼容 `submitWakeEvent(bundle, content)` 的 sender 模块，以及 Aru 卡片真实 HTTPS Origin。这些文件必须位于仓库外。

## 3. 生成私有部署目录

```bash
node scripts/init-deployment.mjs \
  --output private-deployment \
  --origin https://YOUR-ARU-CARD-ORIGIN \
  --settings-base-url https://YOUR-CONTROL-HOST \
  --sender /absolute/path/to/wake-send.mjs \
  --tls-key /absolute/path/to/control-tls.key \
  --tls-cert /absolute/path/to/control-tls.crt
```

脚本会生成分离的 Control Token 和 Settings Token，以 `0600` 写入私有目录，并拒绝覆盖已有文件。

## 4. 配置与基础服务

从安全默认值开始。示例默认 `enabled: false`、原生组件关闭、主动规则关闭。导入卡片后，人类在卡片中搜索并选择城市；卡片只把坐标和时区一次性提交给自家 VPS，随后立即遗忘具体位置。

```bash
docker compose \
  --env-file private-deployment/.env \
  -f compose.yaml \
  -f compose.control.example.yaml \
  up -d --build
```

## 4.1 反向代理新增接口

除既有配对与设置接口外，反向代理还必须精确转发：

- `PUT /v1/location`：一次性保存位置；
- `GET /v1/location/status`：只返回是否已配置；
- `GET /v1/environment/current`：只返回脱敏天气；
- `PUT /v1/settings/environment`：同步非位置设置。

这些接口必须保留 `Origin`、`Authorization` 和 `Content-Type`，并继续校验后端 TLS。位置接口的响应不得回传坐标。城市搜索仍由卡片直接访问 Open-Meteo 地理编码接口；日常天气由 VPS 获取并脱敏返回。

可复制的 Nginx 片段见 [`nginx-control-routes.example.conf`](nginx-control-routes.example.conf)。

## 5. 生成部署专用卡片

```bash
node scripts/build-card.mjs \
  --base-url https://YOUR-CONTROL-HOST \
  --token-file private-deployment/secrets/settings-token \
  --output private-build/human-reality-bridge.html
```

生成卡片包含部署专用 Settings Token，不得提交 GitHub、公开分享或作为通用 Release 附件。

## 6. 配对与启用

1. 先保持 `enabled: false`；
2. 在卡片里搜索并选择城市，确认页面只保留“位置已私密配置”；
3. 验证 HTTPS、精确 Origin 和 Settings Token 同步；
4. 通过受保护流程保存 sender bundle，确认保存没有触发消息；
5. 单独执行一次测试递送；
6. 验收通过后再开启正式采集与递送。

## 7. 人类会看到什么

协作者不会收到具体位置，只会收到类似：

```text
原因：开始下雨，温度下降 5℃
天气：小雨
温度：18℃，体感 17℃
降水：正在下雨，概率 80%
湿度：84%
风：东北风 3 级
地点状态：在家
更新时间：14:42
```

如果开启原生组件，协作者可以自由决定布局、顺序和视觉重点，并在组件后自然回应；系统不要求机械照表排列。无效或不重要的数据可以省略，但已有降水信息不应遗漏，也不得猜测具体位置。

## 8. 验收清单

- [ ] `npm run check` 与 `npm test` 通过；
- [ ] 两个 Token 不同且文件权限为 `0600`；
- [ ] 卡片长期状态不含城市、搜索词、经纬度或时区；
- [ ] 保存设置、位置与配对不会隐式发送；
- [ ] 两个容器以非 root 和只读根文件系统运行；
- [ ] 控制端口只绑定回环地址；
- [ ] Nginx 精确转发新增 API；
- [ ] 日志不含位置、正文或秘密；
- [ ] 关闭与开启原生组件均有纯文字兜底。
