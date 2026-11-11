# 控制服务安全部署草案

> 本文是部署设计，不代表已经部署。未经使用者明确确认，不修改 VPS、不创建真实 Token、不读取真实 sender bundle，也不开放端口。

## 结构

```text
Aru 卡片
  → 公网 HTTPS 入口
  → 受控反向代理
  → 127.0.0.1:9443
  → control 容器
  → bridge-secrets 命名卷
  ← reality-bridge 容器只读挂载
```

`compose.control.example.yaml` 必须与基础 `compose.yaml` 叠加使用。控制服务在容器内监听 `0.0.0.0:9443`，但 Docker 端口只发布为：

```text
127.0.0.1:${BRIDGE_CONTROL_HOST_PORT:-9443}:9443
```

不得改成 `0.0.0.0:9443:9443`。外部请求必须经过经过审核的 HTTPS 入口。

## Secret 文件

部署前分别创建：

- TLS 私钥文件；
- TLS 证书文件；
- 至少 32 字符的随机 control token 文件；
- 兼容 `submitWakeEvent(bundle, content)` 的 sender 模块。

以上文件都位于仓库外，且不得写入 `.env` 正文、Compose 文件、日志或镜像。建议权限：

```text
TLS private key: 0600
control token:    0600
sender module:    0644 或更严格，只读挂载
```

Aru sender bundle 不预先放在宿主机路径中。它由卡片通过受保护 PUT 接口写入 `bridge-secrets` 命名卷，控制服务读写挂载，环境桥只读挂载。

## 资源限制

默认草案：

| 服务 | 内存 | CPU | PID | 日志 |
| --- | ---: | ---: | ---: | --- |
| environment bridge | 128 MiB | 0.25 | 64 | 5 MiB × 3 |
| control service | 96 MiB | 0.20 | 48 | 5 MiB × 3 |

两项服务都使用只读根文件系统、`no-new-privileges`、丢弃全部 capabilities 和受限 tmpfs。

## 反向代理边界

控制服务自身使用 TLS。反向代理连接 `127.0.0.1:9443` 时必须：

- 使用 HTTPS upstream；
- 校验上游证书；
- 设置与证书匹配的 TLS server name；
- 保留浏览器的 `Origin` 与 `Authorization` 请求头；
- 不记录 Authorization 值或请求正文；
- 限制请求体不超过 20 KiB；
- 只代理控制 API 所需路径；
- 对公网启用合理的连接与请求频率限制。

不要通过关闭上游证书校验来绕过配置问题。

## 配置验收

只检查结构、不启动服务：

```bash
cp .env.example .env
# 使用完全假的绝对路径和 HTTPS origin 填写环境变量
docker compose -f compose.yaml -f compose.control.example.yaml config
```

实际部署前还必须确认：

1. Aru 卡片运行时的真实 HTTPS origin；
2. 精确 origin 白名单；
3. TLS 证书域名与公网控制地址一致；
4. control token 随机生成且未进入 shell history；
5. 宿主机回环端口未监听公网；
6. 反向代理日志不记录 Authorization 或正文；
7. 保存配对不会发送；
8. 真实测试递送另行确认。
