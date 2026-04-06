#!/usr/bin/env bash
set -e

echo "=== homeschirm Setup ==="

# System-Pakete
sudo apt update
sudo apt upgrade -y
sudo apt install -y git htop vim python3 imagemagick unzip \
    python3-pip python3-pil python3-numpy python3-spidev python3-gpiozero

# Dependencies fuer node-canvas
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev \
    libjpeg-dev libgif-dev librsvg2-dev

# Node.js via nvm
if ! command -v nvm &> /dev/null; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
nvm install 21

# SPI aktivieren (falls noch nicht)
if ! grep -q "^dtparam=spi=on" /boot/config.txt 2>/dev/null; then
    echo "SPI ist nicht aktiviert. Bitte 'sudo raspi-config' -> Interface Options -> SPI aktivieren."
fi

# Projekt
cd ~/homeschirm
npm install
mkdir -p data

# systemd Service installieren
sudo cp homeschirm.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable homeschirm

echo ""
echo "=== Setup abgeschlossen ==="
echo "Starten mit: sudo systemctl start homeschirm"
echo "Logs:        journalctl -u homeschirm -f"
