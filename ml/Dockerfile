FROM pytorch/pytorch:2.13.0-cuda13.0-cudnn9-runtime
COPY --from=ghcr.io/astral-sh/uv:0.5.31 /uv /uvx /usr/local/bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_NO_CACHE=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /workspace

COPY pyproject.toml ./
COPY ml ./ml

RUN uv venv --system-site-packages /opt/venv \
    && uv pip install --python /opt/venv/bin/python -e ".[dev]"

CMD ["python", "-m", "ikimono_scan_ml.cli", "--help"]
