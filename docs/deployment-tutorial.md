# 从零部署人类现实感应桥

这是一份面向实际运行者的端到端教程。目标是把公开仓库部署到自己的 VPS，生成一张私有 Aru 卡片，在**递送保持关闭**的前提下完成位置、天气、配对和测试验收，最后再由人类决定是否开启正式递送。

> 本教程以 Debian/Ubuntu、Docker Compose、Nginx 和独立 HTTPS 域名为例。使用 Caddy、Traefik 或其它发行版时，安全边界相同，但安装命令需要自行换成对应写法。

## 0. 先理解边界

```text
Open-Meteo
  → 你的 VPS：取数、规则、脱敏、单槽位队列
  → Aru sender
  → Aru 外部触发器
  → 协作者

Aru 卡片
  → 临时搜索城市
  → 一次性把坐标和时区交给你的 VPS
  → 长期只保存 locationConfigured
```

部署完成后：

- 具体位置保存在你的 VPS 私有配置卷；
- 卡片长期状态不保存城市、搜索词、经纬度或时区；
- 协作者只收到脱敏环境数据，不收到具体位置；
- 保存设置、保存位置和保存 sender bundle 都不会自动发送消息；
- 第一次真实测试和正式开启是两个独立动作。

## 1. 准备清单

### 1.1 服务器与软件

建议至少准备：

- 一台能长期联网的 VPS；
- 1 个 CPU、512 MiB 内存和 2 GiB 可用磁盘；
- Docker Engine 与 Docker Compose v2；
- Nginx；
- Git、Node.js 20+、OpenSSL；
- 一个指向 VPS 的 HTTPS 域名，例如 `bridge.example.com`。

项目自身的两个容器默认合计限制约为 224 MiB 内存，但还要给 Docker、Nginx 和系统留空间。

### 1.2 两项必须从 Aru 侧取得的材料

仓库不能凭空创建以下内容：

1. **Aru 卡片实际使用的精确 HTTPS Origin**，例如 `https://cards.example.invalid`；
2. **兼容 `submitWakeEvent(bundle, content)` 的 `wake-send.mjs` 与对应 sender bundle**。

如果你不知道怎样取得这两项，先停在这里，通过自己使用的 Aru/Host 外部触发器入口或可信的管理流程取得。不要猜 Origin，不要使用别人的 sender 文件，也不要把真实 bundle 发到公开 Issue、群聊、截图或日志中。

sender bundle 应符合：

```text
aru.wake-bridge.sender-bundle.v2
```

### 1.3 本教程使用的占位符

把下列假值换成自己的值，但不要把真实秘密提交到 Git：

| 占位符 | 含义 |
| --- | --- |
| `bridge.example.com` | 对外提供控制 API 的域名 |
| `https://YOUR-ARU-CARD-ORIGIN` | 卡片请求实际携带的精确 Origin |
| `/opt/aru-sender/wake-send.mjs` | sender 模块的绝对路径 |
| `/opt/human-reality-bridge` | 仓库目录 |
| `/etc/human-reality-bridge` | 仓库外的私有部署目录 |
| `9443` | 只绑定宿主机回环地址的 control 端口 |

## 2. 安装基础依赖

**在 VPS 执行：**

```bash
sudo apt update
sudo apt install -y git nginx openssl ca-certificates curl
```

按照 Docker 官方文档安装 Docker Engine 与 Compose 插件，然后确认：

```bash
docker version
docker compose version
node --version
nginx -v
```

Node.js 必须为 20 或更高版本。若系统仓库版本过旧，请使用可信的 Node.js 安装方式升级。

## 3. 获取并验证源码

**在 VPS 执行：**

```bash
sudo mkdir -p /opt/human-reality-bridge
sudo chown "$USER":"$USER" /opt/human-reality-bridge
git clone https://github.com/sysy0628/human-reality-bridge.git /opt/human-reality-bridge
cd /opt/human-reality-bridge
```

生产环境优先使用经过审计的 Release 或固定提交，不要在不知情时漂移到新代码。记录当前提交：

```bash
git rev-parse HEAD
```

运行源码验证：

```bash
npm run check
npm test
bash scripts/audit-source.sh
bash scripts/validate-control-compose.sh
```

这些测试使用假凭据，不会连接真实 Aru。

## 4. 安装 sender 模块

**在 VPS 执行：**

```bash
sudo install -d -m 0750 -o "$USER" -g "$USER" /opt/aru-sender
sudo install -m 0644 /安全来源中的/wake-send.mjs /opt/aru-sender/wake-send.mjs
```

此时**不要**把 sender bundle 写进源码目录。bundle 会在后面的受保护配对步骤中进入 Docker 私有卷。

## 5. 准备 control 内部 TLS

control 容器与 Nginx 之间也使用 HTTPS。下面生成一个只用于本机上游连接的私有证书，名称必须与 Nginx 的 `proxy_ssl_name` 一致。

**在 VPS 执行：**

```bash
sudo install -d -m 0700 /etc/human-reality-bridge/tls
sudo openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 825 \
  -keyout /etc/human-reality-bridge/tls/control-tls.key \
  -out /etc/human-reality-bridge/tls/control-tls.crt \
  -subj '/CN=human-reality-bridge-control' \
  -addext 'subjectAltName=DNS:human-reality-bridge-control'
sudo chmod 0600 /etc/human-reality-bridge/tls/control-tls.key
sudo chmod 0644 /etc/human-reality-bridge/tls/control-tls.crt
```

公网域名 `bridge.example.com` 仍需由 Nginx 使用正常的公网证书，例如 Let's Encrypt 证书；不要把上面的私有上游证书直接当作浏览器证书。

## 6. 生成私有部署目录

先确认三个绝对路径都存在：

```bash
test -f /opt/aru-sender/wake-send.mjs
test -f /etc/human-reality-bridge/tls/control-tls.key
test -f /etc/human-reality-bridge/tls/control-tls.crt
```

**在 VPS 的仓库目录执行：**

```bash
cd /opt/human-reality-bridge
umask 077
node scripts/init-deployment.mjs \
  --output /etc/human-reality-bridge/deployment \
  --origin https://YOUR-ARU-CARD-ORIGIN \
  --settings-base-url https://bridge.example.com \
  --sender /opt/aru-sender/wake-send.mjs \
  --tls-key /etc/human-reality-bridge/tls/control-tls.key \
  --tls-cert /etc/human-reality-bridge/tls/control-tls.crt \
  --port 9443
```

脚本会：

- 生成彼此独立的 Control Token 和 Settings Token；
- 以 `0600` 写入私有目录；
- 生成 Compose 使用的私有 `.env`；
- 拒绝覆盖同名已有文件。

检查权限，不要打印文件正文：

```bash
find /etc/human-reality-bridge/deployment -maxdepth 2 -type f \
  -printf '%m %p\n'
```

不要执行 `cat secrets/*`，也不要把私有目录复制进仓库。

## 7. 启动关闭态服务

**在 VPS 执行：**

```bash
cd /opt/human-reality-bridge
docker compose \
  --env-file /etc/human-reality-bridge/deployment/.env \
  -f compose.yaml \
  -f compose.control.example.yaml \
  config >/tmp/human-reality-bridge.compose.txt
```

先检查渲染结果里 control 端口只绑定回环：

```bash
grep -n '127.0.0.1' /tmp/human-reality-bridge.compose.txt
rm -f /tmp/human-reality-bridge.compose.txt
```

然后启动：

```bash
docker compose \
  --env-file /etc/human-reality-bridge/deployment/.env \
  -f compose.yaml \
  -f compose.control.example.yaml \
  up -d --build
```

检查状态：

```bash
docker ps --filter name=human-reality-bridge \
  --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
ss -ltn | grep ':9443'
```

预期：

- `reality-bridge` 和 `control` 容器运行；
- `9443` 只出现在 `127.0.0.1:9443`；
- 首次运行配置保持 `enabled: false`；
- 尚未配对时主服务可能等待 sender bundle，但不应发送消息。

## 8. 配置 Nginx 公网 HTTPS 入口

先为 `bridge.example.com` 配好正常的公网 TLS 证书。然后把仓库中的：

```text
docs/nginx-control-routes.example.conf
```

放进该域名已经启用 TLS 的 `server {}` 中，并替换：

- `CONTROL_LOOPBACK_PORT` → `9443`；
- `/ABSOLUTE/PATH/TO/control-tls.crt` → `/etc/human-reality-bridge/tls/control-tls.crt`。

核心安全要求：

- 只代理样例列出的精确 API；
- 保留 `Origin`、`Authorization` 和 `Content-Type`；
- 上游使用 HTTPS，且 `proxy_ssl_verify on`；
- `proxy_ssl_name human-reality-bridge-control` 与证书一致；
- 不记录 Authorization 或请求正文；
- 其它路径返回 404；
- 不把 `9443` 暴露到公网。

验证并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -i https://bridge.example.com/unknown-path
```

最后一条应返回 404。不要用 `-k` 关闭公网证书校验。

## 9. 生成私有 Aru 卡片

**在 VPS 的仓库目录执行：**

```bash
cd /opt/human-reality-bridge
umask 077
mkdir -p /etc/human-reality-bridge/card
node scripts/build-card.mjs \
  --base-url https://bridge.example.com \
  --token-file /etc/human-reality-bridge/deployment/secrets/settings-token \
  --output /etc/human-reality-bridge/card/human-reality-bridge.html
```

构建器会内联资源、注入 Settings Token，并解析每一段内联脚本。输出文件包含部署专用秘密：

- 不得提交 Git；
- 不得作为公开 Release 附件；
- 不得放在公开网盘；
- 不得发到公开聊天。

**在 Aru 中操作：**

1. 通过自己的私有文件传输方式取得该 HTML；
2. 将它导入或保存为卡片；
3. 给卡片起一个容易识别的名字；
4. 暂时不要点击“恢复递送”。

更新时应修改**同一张现有卡片**，而不是新建副本；同一张卡片才能延续原来的运行状态和设置。

## 10. 关闭态位置与天气验收

**在 Aru 卡片中操作：**

1. 确认顶部显示“递送已暂停”；
2. 搜索城市；
3. 选择正确候选；
4. 确认显示“位置已私密配置”；
5. 确认天气、温度、湿度、风和降水正常出现；
6. 关闭卡片后重新打开；
7. 再次确认位置状态与天气能恢复；
8. 点击“刷新天气”，确认数据可更新。

卡片天气通常在进入、重新打开和手动刷新时获取最新脱敏快照；它不是每秒自动跳动的仪表盘。后台环境桥的轮询与卡片页面刷新是两套节奏。

**验收隐私状态：**

卡片长期状态可以包含：

```json
{
  "locationConfigured": true
}
```

但不应包含城市、行政区、国家、搜索词、经纬度或时区。VPS 私有配置中可以有取数所需的坐标与时区。

## 11. 安全保存 sender bundle

先把真实 bundle 通过私有方式放到 VPS，例如：

```text
/etc/human-reality-bridge/incoming/aru-sender-bundle.json
```

并设置：

```bash
sudo install -d -m 0700 /etc/human-reality-bridge/incoming
sudo chmod 0600 /etc/human-reality-bridge/incoming/aru-sender-bundle.json
```

不要把 Token 或 bundle 直接写进一整条 `curl` 命令。下面用临时 `0600` 文件调用受保护配对接口，避免秘密进入 shell history；临时文件在退出时删除。

**在 VPS 执行：**

```bash
set -euo pipefail
PAIR_DIR=$(mktemp -d)
chmod 0700 "$PAIR_DIR"
trap 'rm -rf "$PAIR_DIR"' EXIT

CONTROL_TOKEN=$(tr -d '\r\n' \
  < /etc/human-reality-bridge/deployment/secrets/control-token)
BUNDLE_FILE=/etc/human-reality-bridge/incoming/aru-sender-bundle.json

jq -n --rawfile bundle "$BUNDLE_FILE" '{bundle:$bundle}' \
  > "$PAIR_DIR/body.json"
chmod 0600 "$PAIR_DIR/body.json"

cat > "$PAIR_DIR/curl.conf" <<EOF
url = "https://bridge.example.com/v1/pairing/aru-trigger"
request = "PUT"
header = "Origin: https://YOUR-ARU-CARD-ORIGIN"
header = "Authorization: Bearer ${CONTROL_TOKEN}"
header = "Content-Type: application/json"
data-binary = "@${PAIR_DIR}/body.json"
fail-with-body
silent
show-error
EOF
chmod 0600 "$PAIR_DIR/curl.conf"
unset CONTROL_TOKEN
curl --config "$PAIR_DIR/curl.conf"
```

成功响应只应返回脱敏配对摘要，不应回显 bundle、Token 或文件路径。保存配对本身不会触发发送。

完成后安全删除 incoming 副本：

```bash
sudo rm -f /etc/human-reality-bridge/incoming/aru-sender-bundle.json
```

如果系统没有 `jq`，先执行 `sudo apt install -y jq`。

## 12. 配对后重启与检查

sender bundle 在服务启动时读取，因此保存后重启主服务：

```bash
cd /opt/human-reality-bridge
docker compose \
  --env-file /etc/human-reality-bridge/deployment/.env \
  -f compose.yaml \
  -f compose.control.example.yaml \
  restart reality-bridge
```

检查日志时只看非敏感摘要：

```bash
docker logs --tail 50 human-reality-bridge
```

确认：

- 服务正常运行；
- 递送仍暂停；
- 待发送数量为 0；
- 日志没有位置、正文或凭据。

不要分享完整 `docker inspect`，其中可能包含私有路径或环境信息。

## 13. 第一次真实测试

真实测试必须由人类明确确认，并且只发送一次。测试前再次确认：

- 卡片显示“递送已暂停”；
- sender 已配对；
- 队列为 0；
- 测试正文不含具体位置；
- 原生组件是否开启符合你的预期。

使用 Aru/Host 提供的受控测试动作，或由受信任的管理员执行一次 `environment.test`。不要通过临时开启全部自动规则来“碰运气”等测试消息。

收到测试后检查：

- 回复开头有原生环境组件（如果已开启）；
- 天气、温度、湿度、风和降水正确；
- 地点状态单独显示；
- 没有城市、坐标或时区；
- 协作者在组件后自然回应，而不是机械复述；
- 测试后正式递送仍暂停，队列回到 0。

## 14. 设置规则并正式开启

**在 Aru 卡片中操作：**

1. 设置地点状态；
2. 选择定时递送间隔；
3. 决定“无变化也递送”是否开启；
4. 按需配置变化规则、持续时间和冷却时间；
5. 按需配置免打扰；
6. 检查文案模板；
7. 按需开启原生组件并设置标题；
8. 最后才点击“恢复递送”。

定时递送提供从 30 分钟到 7 天的多个间隔。若“无变化也递送”关闭，到达间隔时仍需有有意义的环境变化才会发送；若希望固定按间隔发送，需要同时打开该选项。

## 15. 给人类看的隐私与回复说明

协作者会收到脱敏天气、降水、温度、湿度、风、地点状态和更新时间。变化递送还会说明原因，例如“降水刚刚开始”或“体感温度明显下降”。

协作者不会收到：

- 城市名、行政区或国家；
- 搜索词；
- 经纬度；
- 时区；
- Control/Settings Token；
- sender bundle。

原生组件没有固定排版、字段顺序或视觉层级。协作者可以按自己的审美自由呈现，并在组件后用自己的语气自然回应。已有降水信息不应遗漏，地点状态应单独显示；空气质量、紫外线等无效或当下不重要的信息可以省略。

搜索候选只在设置位置的当前页面短暂可见。系统保证它们不进入卡片长期状态、递送、历史或普通日志，但不承诺对正在同时观看同一屏幕的人隐藏。

## 16. 备份

至少备份以下不可从 Git 恢复的内容：

- `bridge-config` 命名卷；
- `bridge-data` 命名卷；
- `bridge-pairing` 命名卷；
- `/etc/human-reality-bridge/deployment`；
- control TLS 证书与私钥；
- Nginx 配置；
- 当前私有卡片。

备份前先记录实际 Compose 项目名和卷名：

```bash
docker compose \
  --env-file /etc/human-reality-bridge/deployment/.env \
  -f /opt/human-reality-bridge/compose.yaml \
  -f /opt/human-reality-bridge/compose.control.example.yaml \
  ls
docker volume ls | grep human-reality-bridge
```

备份文件本身也包含秘密，应使用 `0700` 目录、`0600` 文件和加密的远端存储。

## 17. 安全更新

不要先删除正在工作的环境。推荐蓝绿更新：

1. 记录当前精确提交；
2. 备份私有目录和三个卷；
3. 在新目录检出目标 Release 或固定提交；
4. 运行 `npm run check`、`npm test` 和安全审计；
5. 用新代码构建隔离容器；
6. 生成新卡片，并在原卡片上更新源码以保留状态；
7. 先做关闭态验收；
8. 再切换 Nginx；
9. 观察稳定后才清理旧环境。

源码、测试、CI 和文档以 GitHub 为唯一真源；VPS 只负责部署、运行和验收，不在 VPS 上直接形成第二份源码。

## 18. 常见问题

### 卡片提示来源未获授权

检查 `BRIDGE_CONTROL_ALLOWED_ORIGINS` 是否与卡片请求实际携带的 Origin **完全一致**。它必须是精确 HTTPS origin，不带路径、查询参数或尾随斜杠。

### 卡片显示位置已配置，但天气不更新

检查：

```bash
docker ps --filter name=human-reality-bridge
sudo nginx -t
curl -i https://bridge.example.com/unknown-path
```

再检查 control 日志中是否只有脱敏错误摘要。不要把 Authorization 或真实请求正文贴到公开场所。

### control 容器健康，但公网请求失败

确认 Nginx：

- 代理到 `https://127.0.0.1:9443`；
- 信任正确的 control 证书；
- `proxy_ssl_name` 与证书 SAN 一致；
- 保留 Origin 和 Authorization；
- 公网域名证书有效。

### 主服务反复重启

常见原因是 sender 模块或 bundle 不可读。确认挂载路径存在，bundle schema 正确，并确保 Docker 容器内的非 root 服务账号有读取权限。不要为省事把秘密改成全局可读。

### 为什么通知到了，打开后才生成回复

本项目负责向 Aru 外部触发器提交事件；最终生成时机仍受 Aru/Host 的运行位置、网络和后台机会影响。若希望后台完成生成，应按自己使用的 Aru 版本配置 Host 执行。

### 如何停用

先在卡片中点击“暂停递送”。紧急情况下还可以：

```bash
cd /opt/human-reality-bridge
docker compose \
  --env-file /etc/human-reality-bridge/deployment/.env \
  -f compose.yaml \
  -f compose.control.example.yaml \
  stop reality-bridge
```

停止主服务不会删除配置、位置、配对或状态卷。

## 19. 最终验收清单

- [ ] 使用固定 Release 或记录了精确提交；
- [ ] `npm run check`、`npm test`、源码审计通过；
- [ ] Control Token 与 Settings Token 不同且权限为 `0600`；
- [ ] control 端口只绑定 `127.0.0.1`；
- [ ] Nginx 只代理已知 API，并校验上游 TLS；
- [ ] 卡片长期状态不含具体位置；
- [ ] 保存位置、设置和配对不会隐式发送；
- [ ] 关闭重开后位置与天气正常；
- [ ] 真实测试只执行一次且经人类确认；
- [ ] 测试消息包含降水且不含具体位置；
- [ ] 正式启用前队列为 0；
- [ ] 已建立私有备份和回滚点；
- [ ] 日志、截图、Issue 和 Git 历史中没有真实秘密。

完成以上项目后，再把它当作长期运行服务。任何一步不确定时，保持 `enabled: false`，先排查，再启用。
