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

运行者需要先准备：

- HTTPS 域名或受控入口；
- TLS 私钥与证书文件；
- 兼容 `submitWakeEvent(bundle, content)` 的 sender 模块；
- Aru 卡片真实 HTTPS Origin。

这些文件必须位于仓库外。sender bundle 不放进仓库或初始化目录，后续通过受保护配对接口写入命名卷。

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

脚本会：

- 严格校验 HTTPS origin 与绝对文件路径；
- 分别生成 Control Token 和 Settings Token；
- 以 `0600` 写入 Token、`.env` 和部署描述；
- 拒绝覆盖已有文件；
- 不在输出或日志中打印 Token 正文。

`private-deployment/` 已加入 `.gitignore`，但仍应像密码目录一样保管。

## 4. 配置与基础服务

从安全默认值开始：

```bash
cp config.example.json config.json
```

示例默认 `enabled: false`、原生组件关闭、主动规则关闭。填写属于自己的坐标和时区，不要加入城市名、行政区或搜索文字。

使用生成的环境文件启动：

```bash
docker compose \
  --env-file private-deployment/.env \
  -f compose.yaml \
  -f compose.control.example.yaml \
  config

docker compose \
  --env-file private-deployment/.env \
  -f compose.yaml \
  -f compose.control.example.yaml \
  up -d --build
```

检查容器健康状态和有限日志；日志中不得出现坐标、Token、模板全文、最终递送正文或 bundle。

## 5. 生成部署专用卡片

```bash
node scripts/build-card.mjs \
  --base-url https://YOUR-CONTROL-HOST \
  --token-file private-deployment/secrets/settings-token \
  --output private-build/human-reality-bridge.html
```

脚本会内联 `index.html` 引用的 `src/` CSS 与 JavaScript，校验 Settings Token 文件权限，注入设置地址和 Token，并拒绝覆盖旧生成物。

生成后的 HTML：

- 是可以导入 Aru 的单文件卡片源码；
- 含部署专用 Settings Token；
- 不得提交 GitHub、公开分享或作为通用 Release 附件；
- 更新时应重新从当前公开源码生成，不要把旧部署卡片当作源码真源；
- 卡片更新后，Aru 中已有 `bridgeSettings` 仍是用户设置真源。

`private-build/` 已加入 `.gitignore`。

## 6. 控制面安全边界

Control Token 只用于触发器配对管理；Settings Token 只用于卡片设置同步。两者不得复用。control 容器显式挂载独立 Token、配置卷和配对卷；宿主机 9443 端口只能绑定回环地址，公网请求必须经过 HTTPS 反向代理。

详细 TLS、Origin、挂载和代理要求见 [control-deployment.md](control-deployment.md)。

## 7. 配对与启用

1. 先保持 `enabled: false`；
2. 验证 HTTPS、精确 Origin 和 Settings Token 同步；
3. 通过受保护流程保存 sender bundle，确认“保存”没有触发消息；
4. 检查配置、卷权限和日志；
5. 单独执行一次测试递送；
6. 验收通过后再开启正式采集与递送。

## 8. 更新与回滚

- 每次部署使用不可变提交或版本标签构建镜像；
- 配置卷、状态卷和配对卷独立于镜像；
- 更新卡片前重新构建部署专用 HTML，并保留 Aru 中的 `bridgeSettings`；
- 回滚只切换镜像版本，不用旧源码覆盖运行卷；
- 回滚后检查健康状态、配置版本和待发送槽位。

## 9. 验收清单

- [ ] `npm run check` 与 `npm test` 通过；
- [ ] 两个 Token 不同且文件权限为 `0600`；
- [ ] 生成卡片不含外链本地 `src/`，且不含未替换占位符；
- [ ] 镜像不含 secret-like 路径；
- [ ] 两个容器以非 root 和只读根文件系统运行；
- [ ] 控制端口只绑定回环地址；
- [ ] HTTPS 上游证书校验开启；
- [ ] Origin 为精确 HTTPS 值，不使用 `*`；
- [ ] 保存设置与配对不会隐式发送；
- [ ] 日志不含位置、正文或秘密；
- [ ] 关闭与开启原生组件均有纯文字兜底；
- [ ] 回滚步骤已演练。
