#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Verificando DNS ==="
echo 1597 | sudo -S chattr -i /etc/resolv.conf 2>/dev/null
echo "nameserver 8.8.8.8" | echo 1597 | sudo -S tee /etc/resolv.conf > /dev/null 2>&1

echo "=== Iniciando Bot ==="
# xvfb-run pode nao estar instalado. Verificando antes.
if command -v xvfb-run >/dev/null 2>&1; then
    xvfb-run --auto-servernum --server-args='-screen 0 1280x1024x24' npm run start
else
    echo "xvfb-run nao encontrado, iniciando sem ele (headless)..."
    npm run start
fi
