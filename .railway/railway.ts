import { defineRailway, github, image, project, service, volume } from "railway/iac";

export default defineRailway((ctx) => {
  const postgresData = volume("postgres-data");
  const redisData = volume("redis-data");
  const newApiData = volume("new-api-data");

  const postgres = service("Postgres", {
    source: image("ghcr.io/railwayapp-templates/postgres-ssl:18"),
    env: {
      POSTGRES_USER: "newapi",
      POSTGRES_DB: "newapi",
      POSTGRES_PASSWORD: ctx.shared.NEWAPI_POSTGRES_PASSWORD,
      PGDATA: "/var/lib/postgresql/data/pgdata",
      DATABASE_URL: "postgresql://${{POSTGRES_USER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{POSTGRES_DB}}?sslmode=require",
    },
    volumeMounts: { "/var/lib/postgresql/data": postgresData },
  });

  const redis = service("Redis", {
    source: image("redis:8.2.11"),
    start: `/bin/sh -ec 'exec docker-entrypoint.sh redis-server --appendonly yes --requirepass "$REDIS_PASSWORD"'`,
    env: {
      REDIS_PASSWORD: ctx.shared.NEWAPI_REDIS_PASSWORD,
      REDIS_URL: "redis://:${{REDIS_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:6379/0",
    },
    volumeMounts: { "/data": redisData },
  });

  const newApi = service("New API", {
    source: github("tcitry/newapi-railway-template", { branch: "main" }),
    healthcheck: "/api/status",
    healthcheckTimeout: 120,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 10 },
    env: {
      PORT: "3000",
      SQL_DSN: postgres.env.DATABASE_URL,
      REDIS_CONN_STRING: redis.env.REDIS_URL,
      SESSION_SECRET: ctx.shared.NEWAPI_SESSION_SECRET,
    },
    volumeMounts: { "/data": newApiData },
  });

  return project(ctx.projectName || "newapi", {
    resources: [postgres, redis, newApi, postgresData, redisData, newApiData],
  });
});
