## Prohibited Practices

- Do not commit Railway, Docker, or Nixpacks configuration files with hardcoded secrets or credentials.
- Avoid using default or weak passwords in Nginx, Railway, or Docker Compose configurations.
- Never expose internal service ports directly to the public internet; always use Nginx as a reverse proxy.
- Do not bypass Nginx for production HTTP/S traffic; route all external requests through the proxy.
- Avoid using deprecated or unsupported Nixpacks or Docker Compose features.
- Never run containers as root unless explicitly required and documented.
- Do not use mutable or latest tags for Docker images in production deployments; always specify exact versions.
- Avoid manual changes to deployed infrastructure; use version-controlled configuration and automated deployment.
- Never disable or misconfigure SSL/TLS termination in Nginx for public endpoints.
- Do not use Railway's ephemeral storage for persistent data; always use managed volumes or external databases.
- Avoid running multiple instances of the same service without proper orchestration in Docker Compose.
- Never commit build artifacts or generated files from Nixpacks or Docker to version control.
- Do not mix staging and production environments in the same Railway project or Docker Compose file.
- Avoid using custom Nginx modules or directives without clear documentation and review.
- Never bypass or disable health checks in Railway, Docker Compose, or Nginx configurations.
