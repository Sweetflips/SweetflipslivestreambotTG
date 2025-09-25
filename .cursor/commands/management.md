## Prohibited Practices

- Do not use PM2 or Forever in development environments; reserve them for production process management.
- Avoid running multiple process managers (PM2, Forever, Docker) simultaneously for the same application.
- Do not use outdated or unsupported versions of PM2, Forever, or Docker.
- Never commit PM2 or Forever log files, configuration files, or Docker build artifacts to version control.
- Avoid using `pm2 restart all` or `forever restartall` without verifying the impact on running services.
- Do not use hardcoded environment variables or secrets in PM2, Forever, or Docker configurations; always use environment variables.
- Never bypass process manager error logs or ignore process failures; always investigate and resolve issues.
- Avoid running applications as the root user inside Docker containers or with process managers.
- Do not use `--force` or equivalent flags with PM2, Forever, or Docker unless absolutely necessary and understood.
- Never expose Docker daemon or management ports to the public internet.
- Avoid using legacy or deprecated process manager features or Docker instructions.
- Do not mix process managers (e.g., running PM2 inside a Docker container) unless explicitly required and documented.
