#!/bin/bash

# Garante que o script rode dentro da pasta correta
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Verificando DNS ==="
# Tenta destravar e ajustar o DNS (ignora erros se não tiver permissão)
sudo chattr -i /etc/resolv.conf 2>/dev/null
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf > /dev/null 2>&1

echo "=== Iniciando Bot ==="
xvfb-run --auto-servernum --server-args='-screen 0 1280x1024x24' npm run start
