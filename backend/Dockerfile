# =============================================================================
# FARM TRACKER - PRODUCTION DOCKERFILE
# =============================================================================
# Multi-stage build for smaller final image
# Compatible with Railway, Render, Fly.io, and any Docker host

# -----------------------------------------------------------------------------
# Stage 1: Build dependencies
# -----------------------------------------------------------------------------
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# -----------------------------------------------------------------------------
# Stage 2: Production image
# -----------------------------------------------------------------------------
FROM python:3.11-slim

# Create non-root user for security
RUN groupadd -r farmtracker && useradd -r -g farmtracker farmtracker

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels from builder and install
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache /wheels/*

# Copy application code
COPY --chown=farmtracker:farmtracker . .

# Create directories for static and media files
RUN mkdir -p /app/staticfiles /app/media && \
    chown -R farmtracker:farmtracker /app/staticfiles /app/media

# Switch to non-root user
USER farmtracker

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose port
EXPOSE 8000

# Health check - uses PORT env var which Railway sets
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import os; import urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\", 8000)}/api/health/')" || exit 1

# Run with gunicorn (use shell form so $PORT expands)
CMD gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 --worker-class gthread --timeout 120 pesticide_tracker.wsgi:application
