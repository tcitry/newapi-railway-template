# New API on Railway

This repository contains the Railway template configuration for New API and a Docker Compose setup for local testing. All three services use official container images.

| Service | Official image | Railway volume mount |
| --- | --- | --- |
| New API | `calciumion/new-api:v1.0.0-rc.51` | `/data` |
| Postgres | `ghcr.io/railwayapp-templates/postgres-ssl:18` | `/var/lib/postgresql/data` |
| Redis | `redis:8.2.11` | `/data` |

See the official image and release pages.[New API](https://github.com/QuantumNous/new-api/releases/tag/v1.0.0-rc.51) · [Railway PostgreSQL](https://github.com/railwayapp-templates/postgres-ssl/pkgs/container/postgres-ssl) · [Redis](https://hub.docker.com/_/redis)

## Railway Template

Open the template editor from your Railway workspace under **Settings → Templates**. Use the images and volume mount paths in the table above. The examples use `Postgres` and `Redis` as service names. If you rename either service, update its references. Use a new project and fresh volumes for each deployment.

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

Set **Start Command** to the following command to enable AOF persistence and password authentication.

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

Set **Healthcheck Path** to `/api/status`. The PostgreSQL connection uses a Railway private hostname and requires TLS through `sslmode=require`. [Railway template documentation](https://docs.railway.com/templates/create)

### Deploy to a New Project

1. Save the template, open its deployment link, and select **New Project**. Wait for all three services to deploy successfully. A fresh instance needs its own administrator account.
2. Keep New API on the private network during setup. Register your SSH public key with Railway, then select **Copy Service Instance ID** from the New API service's command palette. Forward the container port with the command below and open `http://127.0.0.1:3000` in your browser to create the administrator account. [Railway SSH](https://docs.railway.com/cli/ssh)

   ```sh
   ssh -N -L 127.0.0.1:3000:127.0.0.1:3000 '<service-instance-id>@ssh.railway.com'
   ```

3. In the new project's New API service, open **Settings → Networking**. Add a **Custom Domain** and follow Railway's DNS instructions, or select **Generate Domain** to use a Railway hostname. Set the target port to `3000` and visit `/api/status` on the new hostname to verify the deployment. [Railway domain documentation](https://docs.railway.com/networking/domains/working-with-domains) · [Deployment notes (Chinese)](https://yindongliang.com/docs/App/new-api-railway-template/)

## Local Verification

Generate local credentials and start the containers. If you already have a `.env` file, keep it to preserve your database password and session secret.

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

If port `3000` is already in use, set `NEW_API_LOCAL_PORT` in `.env` and use that port in the health check URL. When you finish testing, run `docker compose down` to stop the services and keep their data. Compose uses the same images and connection settings as the Railway template, with local service names for hostnames.
