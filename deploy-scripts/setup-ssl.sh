#!/bin/bash
# HTTPS 인증서 설정 (Let's Encrypt + certbot)
# 사용법: ssh opc@132.145.83.186 'bash -s' < deploy-scripts/setup-ssl.sh

set -euo pipefail

DOMAIN="aigle.test.neolab.net"

# certbot 설치
if ! command -v certbot &>/dev/null; then
  echo "certbot 설치 중..."
  sudo yum install -y certbot python3-certbot-nginx 2>/dev/null || \
  sudo apt-get install -y certbot python3-certbot-nginx
fi

# SSL 인증서 발급 + nginx 자동 설정
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email kitty@neolab.net

echo "✅ HTTPS 설정 완료: https://${DOMAIN}"
