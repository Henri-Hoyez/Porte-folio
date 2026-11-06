#!/bin/sh
# Vérifications réseau à lancer SUR le serveur de production
set -e

echo "=== Architecture ==="
uname -m

echo ""
echo "=== Ports Docker exposés ==="
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null || echo "Docker non disponible"

echo ""
echo "=== Écoute sur 80 et 8080 ==="
if command -v ss >/dev/null 2>&1; then
  ss -tlnp | grep -E ':80|:8080' || echo "Aucun processus sur 80/8080"
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp 2>/dev/null | grep -E ':80|:8080' || echo "Aucun processus sur 80/8080"
fi

echo ""
echo "=== Test local ==="
curl -s -o /dev/null -w "localhost:80  → HTTP %{http_code}\n" http://127.0.0.1:80 2>/dev/null || echo "localhost:80  → inaccessible"
curl -s -o /dev/null -w "localhost:8080 → HTTP %{http_code}\n" http://127.0.0.1:8080 2>/dev/null || echo "localhost:8080 → inaccessible"

echo ""
echo "=== Pare-feu (ufw) ==="
if command -v ufw >/dev/null 2>&1; then
  ufw status || true
else
  echo "ufw non installé"
fi

echo ""
echo "=== IP publique du serveur ==="
curl -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'

echo ""
echo "Depuis l'extérieur, testez :"
echo "  http://IP_PUBLIQUE/        (si port 80 ouvert)"
echo "  http://IP_PUBLIQUE:8080/   (si port 8080 ouvert)"
