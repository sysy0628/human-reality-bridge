# 部署说明

> 当前流程面向熟悉 Docker、HTTPS 反向代理和 secret 管理的技术用户。首次公开发行前仍会补充初始化与卡片构建脚本。

## 1. 本地验证

```bash
npm run check
npm test
docker build -t human-reality-bridge:local .
bash scripts/validate-control-compose.sh
```

不要把 `.env`、真实 `config.json`、状态目录、日志、Token、TLS 私钥、sender bundle 或部署专用卡片提交到 Git。

## 2. 准备配置

从示例开始：

```bash
cp config.example.json config.json
cp .env.example .env
```

示例默认关闭服务和原生组件。填写属于自己的位置坐标与时区；不要在配置中加入城市名、行政区或搜索文字。

运行者还需要准备：

- HTTPS 域名或受控入口；
- TLS 证书；
- 至少 32 字符的随机 Control Token 与 Settings Token；
- Aru 外部触发器 sender bundle；
- 兼容 `submitWakeEvent(bundle, content)` 的 sender 模块；
- Aru 卡片真实 HTTPS Origin。

所有 secret 都应位于仓库外，并以只读文件或受保护命名卷提供给容器。

## 3. 基础服务

`compose.yaml` 使用非 root 镜像用户、只读根文件系统、删除 capabilities、`no-new-privileges`、受限 tmpfs、资源限制和命名卷。先保持 `enabled: false` 启动并检查健康状态。

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=50
```

日志中不得出现坐标、Token、模板全文、最终递送正文或 bundle。

## 4. 控制服务

`compose.control.example.yaml` 与基础 Compose 叠加。宿主机端口必须严格绑定回环地址，公网只通过 HTTPS 反向代理进入：

```bash
docker compose -f compose.yaml -f compose.control.example.yaml config
docker compose -f compose.yaml -f compose.control.example.yaml up -d
```

详细 TLS、Origin、挂载和代理要求见 [control-deployment.md](control-deployment.md)。

## 5. 卡片与设置同步

公开 `index.html` 使用占位符：

```text
__SETTINGS_BASE_URL__
__SETTINGS_TOKEN__
```

部署时必须生成属于自己的卡片副本并安全替换占位符。生成后的卡片含部署专用 Token，不得重新提交 GitHub。卡片只上传当前选中的地点状态、坐标、时区和服务设置，不上传城市名、国家、行政区、搜索文字或自定义标签列表。

## 6. 配对与启用

1. 先验证 HTTPS、精确 Origin 和 Bearer 鉴权；
2. 保存 sender bundle，确认“保存”没有触发消息；
3. 保持服务关闭，检查配置、卷权限和日志；
4. 单独执行一次测试递送；
5. 验收通过后再开启正式采集与递送。

## 7. 更新与回滚

- 每次部署使用不可变提交或版本标签构建镜像；
- 配置卷、状态卷和配对卷独立于镜像；
- 更新前备份非秘密配置结构，秘密使用独立轮换/恢复流程；
- 回滚只切换镜像版本，不用旧源码覆盖运行卷；
- 回滚后检查健康状态、配置版本和待发送槽位。

## 8. 验收清单

- [ ] `npm run check` 与 `npm test` 通过；
- [ ] 镜像不含 secret-like 路径；
- [ ] 两个容器以非 root 和只读根文件系统运行；
- [ ] 控制端口只绑定回环地址；
- [ ] HTTPS 上游证书校验开启；
- [ ] Origin 为精确 HTTPS 值，不使用 `*`；
- [ ] 保存设置与配对不会隐式发送；
- [ ] 日志不含位置、正文或秘密；
- [ ] 关闭与开启原生组件均有纯文字兜底；
- [ ] 回滚步骤已演练。