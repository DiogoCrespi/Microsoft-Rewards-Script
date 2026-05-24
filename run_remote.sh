#!/bin/bash

# Garante que o script rode dentro da pasta correta
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Verificando DNS ==="
# Garante que o DNS esteja configurado corretamente (8.8.8.8)
# Remove o symlink se existir e cria um arquivo estático para evitar sobrescritas do systemd-resolved
sudo chattr -i /etc/resolv.conf 2>/dev/null
sudo rm -f /etc/resolv.conf
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf > /dev/null
echo "nameserver 1.1.1.1" | sudo tee -a /etc/resolv.conf > /dev/null

echo "=== Iniciando Bot ==="
xvfb-run --auto-servernum --server-args='-screen 0 1280x1024x24' npm run start
