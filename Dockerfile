# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


# ── Stage 2: Backend + Playwright ────────────────────────────────────────────
FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy

WORKDIR /app

# Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend source
COPY backend/ ./backend/

# Ensure uploads directory exists
RUN mkdir -p /app/uploads

WORKDIR /app/backend

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
