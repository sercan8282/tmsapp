#!/bin/bash
set -e

echo "=== TMS Backend Starting ==="

# Ensure required directories exist
echo "Creating required directories..."
mkdir -p /app/media/fonts /app/media/branding /app/media/imports/invoices /app/media/temp/ocr /app/staticfiles /app/logs

# Clean up any old temp OCR files from previous runs
echo "Cleaning up old temp files..."
rm -rf /app/media/temp/ocr/* 2>/dev/null || true

# Wait for database to be ready
echo "Waiting for database..."
while ! python -c "import socket; socket.create_connection(('${DB_HOST:-db}', ${DB_PORT:-5432}), timeout=1)" 2>/dev/null; do
    sleep 1
done
echo "Database is ready!"

# Run migrations
echo "Running migrations..."
python manage.py migrate --noinput

# Seed default maintenance data (idempotent - uses update_or_create)
echo "Seeding maintenance data..."
python manage.py seed_maintenance || echo "Warning: seed_maintenance failed, continuing..."

# Collect static files (without --clear to avoid permission issues with non-root user)
echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting Gunicorn..."
exec gunicorn \
    --bind 0.0.0.0:8000 \
    --workers ${GUNICORN_WORKERS:-4} \
    --threads 2 \
    --worker-class gthread \
    --worker-tmp-dir /dev/shm \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    --limit-request-line 8190 \
    --limit-request-fields 100 \
    --limit-request-field_size 8190 \
    tms.wsgi:application
