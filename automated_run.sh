#!/bin/bash
# Script de automação atualizado para usar o run.sh

# Sorteia um atraso entre 0 e 1800 segundos (30 minutos)
DELAY=$((RANDOM % 1800))

echo "$(date): Sorteado atraso de $DELAY segundos. Iniciando aguardo..."
sleep $DELAY

echo "$(date): Iniciando execução através do run.sh..."
cd /home/diogo/Microsoft-Rewards-Script
# Executa o run.sh com sudo, passando a senha
echo 1597 | sudo -S ./run.sh >> /home/diogo/Microsoft-Rewards-Script/run_logs.txt 2>&1

echo "$(date): Execução automática concluída."
