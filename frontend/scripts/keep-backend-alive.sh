#!/bin/bash
# Keep the BPMS backend alive — restarts if it dies.
cd /home/z/my-project/bpms-backend
while true; do
  echo "[$(date)] Starting BPMS backend..."
  node dist/main.js
  echo "[$(date)] Backend exited (code $?), restarting in 2s..."
  sleep 2
done
