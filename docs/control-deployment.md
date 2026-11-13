# 控制服务安全部署

## 结构

```text
Aru 卡片
  → 公网 HTTPS 入口
  → 受控反向代理
  → 127.0.0.1:9443
  → control 容器
  → 配置卷 / bridge-pairing 卷
  ← reality-bridge 容器读取
```

`compose.control.example.yaml` 必须与基础 `compose.yaml` 叠加使用。控制服务在容器内监听 `0.0.0.0:9443`，但 Docker 端口只能发布到宿主机回环地址：

```text
127.0.0.1:${BRIDGE_CONTROL_HOST_PORT:-9443}:9443
```

不得直接发布为 `0.0.0.0:9443:9443`。

## Origin

- 只允许完整、精确的 HTTPS origin；
- 不使用通配符，不附加路径；
- `http:`、`null`、缺失值或异常值不得进入正式白名单；
- 以入口实际收到的 `Origin` 请求头为最终依据；
- 代理日志不得记录 `Authorization` 或请求正文。

首次检查连接只验证 HTTPS、CORS 与 Bearer 鉴权，不保存 bundle，也不触发递送。

## Secret 与权限

仓库外至少需要：

- TLS 私钥与证书；
- 至少 32 字符的随机 Control Token；
- 至少 32 字符的随机 Settings Token；
- 兼容 sender 模块；
- 由受保护接口写入配对卷的 sender bundle。

建议私钥和 Token 文件权限为 `0600`。control 对配对卷和配置卷具有写权限，environment bridge 对配对卷只读。基础镜像不包含任何真实 secret。

## 资源与容器限制

推荐起点：

| 服务 | 内存 | CPU | PID | 日志 |
| --- | ---: | ---: | ---: | --- |
| environment bridge | 128 MiB | 0.25 | 64 | 5 MiB × 3 |
| control service | 96 MiB | 0.20 | 48 | 5 MiB × 3 |

两项服务都应使用非 root 用户、只读根文件系统、`no-new-privileges`、删除全部 capabilities 和受限 tmpfs。

## 反向代理边界

反向代理连接回环控制服务时必须：

- 使用 HTTPS upstream 并校验证书；
- 设置与证书匹配的 TLS server name；
- 保留浏览器的 `Origin` 与 `Authorization` 请求头；
- 不记录 Authorization 值或请求正文；
- 限制请求体不超过服务端允许值；
- 只代理控制 API 路径；
- 对公网启用合理的连接与请求频率限制。

不要通过关闭上游证书校验来绕过配置问题。

## 部署前只读检查

只收集容量、Docker/Compose 版本、监听端口和代理类型，不读取 secret、环境变量正文、请求日志或 shell history：

```bash
id
umask
uname -srm
df -h /
free -h
docker version --format '{{.Server.Version}}'
docker compose version
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
ss -ltn
systemctl is-active docker nginx caddy apache2 2>/dev/null || true
```

不要分享完整 `docker inspect`，其中可能包含环境变量。只读检查阶段不得执行拉取、构建、重启、端口开放、权限修改或凭据生成。

## 配置验收

```bash
cp .env.example .env
# 仅使用假路径、假 Token 和测试 HTTPS origin
bash scripts/validate-control-compose.sh
docker compose -f compose.yaml -f compose.control.example.yaml config
```

正式启用前确认：

1. 卡片真实 HTTPS Origin 与白名单完全一致；
2. TLS 证书域名与公网控制地址一致；
3. Token 随机生成且未进入 Git 或 shell history；
4. 宿主机控制端口未监听公网；
5. 代理日志不记录 Authorization 或正文；
6. 保存配对和设置不会发送；
7. 真实测试递送是独立、明确的动作。