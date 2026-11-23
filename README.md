# New API on Railway

这个仓库保存 New API 的 Railway 模板配置和本地 Docker Compose 验证环境。Railway 的三个服务直接从官方镜像部署。

| 服务名 | 官方镜像 | Railway Volume |
| --- | --- | --- |
| New API | `calciumion/new-api:v1.0.0-rc.51` | `/data` |
| Postgres | `ghcr.io/railwayapp-templates/postgres-ssl:18` | `/var/lib/postgresql/data` |
| Redis | `redis:8.2.11` | `/data` |

镜像来源可在各自的发布页核对。[New API](https://github.com/QuantumNous/new-api/releases/tag/v1.0.0-rc.51) · [Railway PostgreSQL](https://github.com/railwayapp-templates/postgres-ssl/pkgs/container/postgres-ssl) · [Redis](https://hub.docker.com/_/redis)

## Railway Template

在 Workspace 的 **Settings → Templates** 打开模板编辑器。按表格添加镜像和 Volume。配置块使用 `Postgres`、`Redis` 作为服务名，改名时同步更新引用。每次从模板部署，使用新 Project 和新 Volume。

### Postgres

```dotenv
POSTGRES_USER=newapi
POSTGRES_DB=newapi
POSTGRES_PASSWORD=${{secret(64, "abcdef0123456789")}}
PGDATA=/var/lib/postgresql/data/pgdata
```

### Redis

```dotenv
REDIS_PASSWORD=${{secret(64, "abcdef0123456789")}}
```

在 **Start Command** 填入以下命令，开启 AOF 持久化和密码认证。

```sh
/bin/sh -ec 'exec docker-entrypoint.sh redis-server --appendonly yes --requirepass "$REDIS_PASSWORD"'
```

### New API

```dotenv
PORT=3000
SQL_DSN=postgresql://${{Postgres.POSTGRES_USER}}:${{Postgres.POSTGRES_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{Postgres.POSTGRES_DB}}?sslmode=require
REDIS_CONN_STRING=redis://:${{Redis.REDIS_PASSWORD}}@${{Redis.RAILWAY_PRIVATE_DOMAIN}}:6379/0
SESSION_SECRET=${{secret(64, "abcdef0123456789")}}
```

在 **Healthcheck Path** 填入 `/api/status`。PostgreSQL 的 `sslmode=require` 要求 TLS，连接地址使用 Railway 私网域名。[创建 Template](https://docs.railway.com/templates/create)

### 部署到新 Project

1. 保存 Template，打开它的部署链接，选择 **New Project**。等待三个服务部署成功。从空卷初始化的新实例需要创建自己的管理员帐号。
2. 让 New API 先在私网运行。向 Railway 注册 SSH 公钥，在 New API 服务的命令面板复制 **Service Instance ID**，用下面的命令转发容器端口。浏览器访问 `http://127.0.0.1:3000`，完成初始化。[Railway SSH](https://docs.railway.com/cli/ssh)

   ```sh
   ssh -N -L 127.0.0.1:3000:127.0.0.1:3000 '<service-instance-id>@ssh.railway.com'
   ```

3. 在新 Project 的 New API 服务打开 **Settings → Networking**。添加 **Custom Domain** 并按 Railway 提示配置 DNS，或用 **Generate Domain** 获取 Railway 域名。目标端口填 `3000`。用新入口访问 `/api/status` 验证可用性。[域名配置](https://docs.railway.com/networking/domains/working-with-domains) · [部署记录](https://yindongliang.com/docs/App/new-api-railway-template/)

## 本地验证

生成本地凭据后启动容器。已有 `.env` 时继续使用原文件，保持现有数据库密码和 Session Secret。

```sh
(
  umask 077
  set -C
  printf 'POSTGRES_PASSWORD=%s\nREDIS_PASSWORD=%s\nSESSION_SECRET=%s\n' \
    "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
)
docker compose up -d --wait
curl --fail --silent --show-error http://127.0.0.1:3000/api/status
```

如本机端口已占用，在 `.env` 设置 `NEW_API_LOCAL_PORT`。本地检验结束后执行 `docker compose down` 可停止服务并保留数据。三个镜像和连接参数与上面的 Railway 配置一致，Compose 使用本地服务名解析地址。
