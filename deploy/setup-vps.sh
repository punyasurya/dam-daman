#!/usr/bin/env bash
# Setup sekali jalan di VPS (Ubuntu/Debian + Apache2 dari SinarPanel).
# Jalankan sebagai root:   sudo bash setup-vps.sh <user-deploy>
# Contoh:                  sudo bash setup-vps.sh surya
set -euo pipefail

DEPLOY_USER="${1:-}"
DOMAIN="${DOMAIN:-dam.punyasurya.com}"
WEB_PATH="${WEB_PATH:-/var/www/$DOMAIN}"
SERVER_PATH="${SERVER_PATH:-/opt/dam-daman}"
SSL_CONF="${SSL_CONF:-/etc/apache2/sites-available/$DOMAIN-le-ssl.conf}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then echo "Jalankan dengan sudo/root."; exit 1; fi
if [ -z "$DEPLOY_USER" ] || ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "Pakai: sudo bash setup-vps.sh <user-deploy>  (user harus sudah ada)"; exit 1
fi

echo "==> 1. Node.js"
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
NODE_BIN="$(command -v node)"
echo "    node $($NODE_BIN -v) di $NODE_BIN"
command -v rsync >/dev/null 2>&1 || apt-get install -y rsync

echo "==> 2. Folder"
mkdir -p "$SERVER_PATH" "$WEB_PATH"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$SERVER_PATH"
# Folder web boleh ditulis user deploy, tetap bisa dibaca Apache
chown -R "$DEPLOY_USER":www-data "$WEB_PATH"
chmod -R g+rX "$WEB_PATH"
find "$WEB_PATH" -type d -exec chmod g+s {} +

echo "==> 3. Service systemd"
sed -e "s#__DEPLOY_USER__#$DEPLOY_USER#g" -e "s#__SERVER_PATH__#$SERVER_PATH#g" -e "s#__NODE_BIN__#$NODE_BIN#g" \
  "$HERE/dam-daman.service" > /etc/systemd/system/dam-daman.service
systemctl daemon-reload
systemctl enable dam-daman >/dev/null
if [ -f "$SERVER_PATH/server.mjs" ]; then systemctl restart dam-daman; fi

echo "==> 4. Izin restart untuk GitHub Actions"
cat > /etc/sudoers.d/dam-daman <<SUDO
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart dam-daman, /bin/systemctl restart dam-daman
SUDO
chmod 440 /etc/sudoers.d/dam-daman
visudo -cf /etc/sudoers.d/dam-daman

echo "==> 5. Apache"
a2enmod proxy proxy_http proxy_wstunnel rewrite headers >/dev/null
cp "$HERE/apache-dam-daman.conf" /etc/apache2/dam-daman.conf
if [ ! -f "$SSL_CONF" ]; then
  echo "    PERINGATAN: $SSL_CONF tidak ditemukan. Tambahkan manual baris berikut di VirtualHost *:443:"
  echo "    Include /etc/apache2/dam-daman.conf"
elif grep -q "Include /etc/apache2/dam-daman.conf" "$SSL_CONF"; then
  echo "    Include sudah ada di $SSL_CONF"
else
  BACKUP="$SSL_CONF.bak-$(date +%Y%m%d%H%M%S)"
  cp "$SSL_CONF" "$BACKUP"
  # Sisipkan sebelum </VirtualHost> pertama
  awk 'BEGIN{done=0} /<\/VirtualHost>/ && !done {print "    Include /etc/apache2/dam-daman.conf"; done=1} {print}' "$BACKUP" > "$SSL_CONF"
  echo "    Include ditambahkan ke $SSL_CONF (cadangan: $BACKUP)"
fi
if ! apache2ctl configtest; then
  [ -n "${BACKUP:-}" ] && cp "$BACKUP" "$SSL_CONF" && echo "    Konfigurasi dikembalikan dari cadangan."
  exit 1
fi
systemctl reload apache2

echo
echo "Selesai. Langkah berikutnya ada di docs/DEPLOY.md (secret GitHub Actions)."
