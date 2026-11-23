# New API on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/IfyGwd?referralCode=tcitry&utm_medium=integration&utm_source=template&utm_campaign=generic)

The button opens a Railway template with New API, PostgreSQL, and Redis. Choose a new project to deploy an independent instance. The linked template pulls `calciumion/new-api:latest` directly.

To build New API from this repository, use the [Railway template setup](#railway-template) below. Its Dockerfile pins the official New API image, and Compose builds it for local testing.

| Service | Official image for the setup below | Railway volume mount |
| --- | --- | --- |
| New API | `calciumion/new-api:v1.0.0-rc.51` | `/data` |
| Postgres | `ghcr.io/railwayapp-templates/postgres-ssl:18` | `/var/lib/postgresql/data` |
| Redis | `redis:8.2.11` | `/data` |

See the official image and release pages. [New API](https://github.com/QuantumNous/new-api/releases/tag/v1.0.0-rc.51) · [Railway PostgreSQL](https://github.com/railwayapp-templates/postgres-ssl/pkgs/container/postgres-ssl) · [Redis](https://hub.docker.com/_/redis)

## Railway Template

Create the template once. Each time you deploy from its link, Railway can provision a separate project with fresh volumes and credentials.

1. Open your workspace's **Settings → Templates** and select **New Template**. [Open Railway Templates](https://railway.com/workspace/templates)
2. Add a service named **New API** from the GitHub repository `tcitry/newapi-railway-template` on `main`. Add two Docker image services named **Postgres** and **Redis**, using the image references in the table above.
3. Attach each volume using the mount path in the table. Add the variables and service settings below. Keep the services on the private network during setup.

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

Set **Start Command** to the following command to store AOF files in a Redis-owned directory on the mounted volume and require password authentication.

```sh
/bin/sh -ec 'umask 077; install -d -m 700 -o redis -g redis /data/redis; cd /data/redis; exec docker-entrypoint.sh redis-server --dir /data/redis --appendonly yes --requirepass "$REDIS_PASSWORD"'
```

### New API

```dotenv
PORT=3000
SQL_DSN=postgresql://${{Postgres.POSTGRES_USER}}:${{Postgres.POSTGRES_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{Postgres.POSTGRES_DB}}?sslmode=require
REDIS_CONN_STRING=redis://:${{Redis.REDIS_PASSWORD}}@${{Redis.RAILWAY_PRIVATE_DOMAIN}}:6379/0
SESSION_SECRET=${{secret(64, "abcdef0123456789")}}
```

Set **Healthcheck Path** to `/api/status` and **Healthcheck Timeout** to 120 seconds. Set **Restart Policy** to **On Failure** with up to 10 retries so New API can retry startup while PostgreSQL and Redis become ready. The PostgreSQL connection uses a Railway private hostname and requires TLS through `sslmode=require`. [Railway template documentation](https://docs.railway.com/templates/create)

### Save and Test the Template

If you start from a working project, open **Project Settings → Generate Template from Project → Create Template**. In the template editor, set the defaults for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, and `SESSION_SECRET` to the secret expressions above. Keep the service references for `SQL_DSN` and `REDIS_CONN_STRING`.

Click **Create Template** and copy its deployment link. Open the link and deploy into a new project. Verify that all three services start and that the New API service shows this GitHub repository as its source. Then [initialize the instance](#initialize-and-expose-new-api).

Use the verified deployment link as the target of the **Deploy on Railway** badge on GitHub. Publishing to the Marketplace is optional. [Railway button documentation](https://docs.railway.com/templates/publish-and-share#deploy-on-railway-button)

## Initialize and Expose New API

1. Keep New API on the private network during setup. Register your SSH public key with Railway, then select **Copy Service Instance ID** from the New API service's command palette. Forward the container port with the command below and open `http://127.0.0.1:3000` in your browser to create the administrator account. [Railway SSH](https://docs.railway.com/cli/ssh)

   ```sh
   ssh -N -L 127.0.0.1:3000:127.0.0.1:3000 '<service-instance-id>@ssh.railway.com'
   ```

2. In the new project's New API service, open **Settings → Networking**. Add a **Custom Domain** and follow Railway's DNS instructions, or select **Generate Domain** to use a Railway hostname. Set the target port to `3000` and visit `/api/status` on the new hostname to verify the deployment. [Railway domain documentation](https://docs.railway.com/networking/domains/working-with-domains) · [Deployment notes (Chinese)](https://yindongliang.com/docs/App/new-api-railway-template/)

## Local Verification

Generate local credentials and start the containers. If you already have a `.env` file, keep it to preserve your database password and session secret.

```sh
(
  umask 077
  set -C
  printf 'POSTGRES_PASSWORD=%s\nREDIS_PASSWORD=%s\nSESSION_SECRET=%s\n' \
    "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
)
docker compose up -d --build --wait
curl --fail --silent --show-error http://127.0.0.1:3000/api/status
```

If port `3000` is already in use, set `NEW_API_LOCAL_PORT` in `.env` and use that port in the health check URL. When you finish testing, run `docker compose down` to stop the services and keep their data. Compose builds New API from the same Dockerfile and waits for PostgreSQL and Redis to pass their health checks before starting it. The services communicate using local service names.
