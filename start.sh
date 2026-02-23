#!/bin/bash

# Job Hunter - starts backend + frontend together
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Job Hunter..."

# Start backend
cd "$SCRIPT_DIR/backend"
python3.11 -m uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  App:      http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop everything"
echo ""

# Stop both on Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
