FROM python:3.12-slim-bookworm

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY docker/requirements-relay.txt /tmp/requirements-relay.txt
RUN pip install --no-cache-dir -r /tmp/requirements-relay.txt

COPY relay_server.py .

EXPOSE 8000
CMD ["uvicorn", "relay_server:app", "--host", "0.0.0.0", "--port", "8000"]
