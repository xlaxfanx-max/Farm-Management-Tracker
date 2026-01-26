# Build stage - install dependencies
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies (including GDAL for rasterio)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Set GDAL environment for building rasterio
ENV GDAL_CONFIG=/usr/bin/gdal-config

# Install Python dependencies
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt


# Production stage
FROM python:3.11-slim

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgdal32 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels from builder and install
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache /wheels/*

# Copy application code
COPY --chown=appuser:appuser . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Switch to non-root user
USER appuser

# Railway sets PORT env var - default to 8000 for local testing
ENV PORT=8000

EXPOSE ${PORT}

# Start gunicorn - Railway will override PORT
# Using exec form to properly handle signals
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --worker-class gthread --timeout 120 --access-logfile - --error-logfile - pesticide_tracker.wsgi:application"]
