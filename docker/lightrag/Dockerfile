FROM python:3.11-slim

WORKDIR /app

# Install LightRAG and FastAPI stack
RUN pip install --no-cache-dir \
    lightrag-hku \
    fastapi \
    uvicorn[standard] \
    httpx

COPY server.py /app/server.py

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
