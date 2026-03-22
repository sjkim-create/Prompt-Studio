#!/bin/bash
# aigle-movie 배포 스크립트
# 대상: develop-neolab-aigle (132.145.83.186)
# 도메인: aigle.test.neolab.net
#
# 사전 준비:
# 1. DNS: aigle.test.neolab.net → 132.145.83.186 (A 레코드)
# 2. OCI Security List: 80, 443 포트 인바운드 허용
# 3. SSH 접속 가능 (VPN 등)
#
# 사용법: ./deploy-scripts/deploy.sh [SSH_USER] [SSH_HOST]
#   예: ./deploy-scripts/deploy.sh opc 132.145.83.186

set -euo pipefail

SSH_USER="${1:-opc}"
SSH_HOST="${2:-132.145.83.186}"
REMOTE_DIR="/var/www/aigle-movie"
DOMAIN="aigle.test.neolab.net"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== 1. 빌드 ==="
npm run build

echo "=== 2. dist 폴더 압축 ==="
tar -czf /tmp/aigle-movie-dist.tar.gz -C dist .

echo "=== 3. 서버로 전송 ==="
scp /tmp/aigle-movie-dist.tar.gz "${SSH_USER}@${SSH_HOST}:/tmp/"

echo "=== 4. 서버에서 배포 ==="
ssh "${SSH_USER}@${SSH_HOST}" bash -s <<'REMOTE_SCRIPT'
set -euo pipefail

REMOTE_DIR="/var/www/aigle-movie"
DOMAIN="aigle.test.neolab.net"

# nginx 설치 확인
if ! command -v nginx &>/dev/null; then
  echo "nginx 설치 중..."
  sudo yum install -y nginx || sudo apt-get install -y nginx
fi

# 배포 디렉토리 생성
sudo mkdir -p "$REMOTE_DIR"
sudo rm -rf "${REMOTE_DIR:?}/"*
sudo tar -xzf /tmp/aigle-movie-dist.tar.gz -C "$REMOTE_DIR"
rm -f /tmp/aigle-movie-dist.tar.gz

# nginx 설정
sudo tee /etc/nginx/conf.d/aigle-movie.conf > /dev/null <<NGINX_CONF
server {
    listen 80;
    server_name ${DOMAIN};

    root ${REMOTE_DIR};
    index index.html;

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 정적 자산 캐싱
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # data 폴더 (JSON, PDF, 프롬프트)
    location /data/ {
        expires 1h;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
}
NGINX_CONF

# nginx 설정 테스트 및 재시작
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "✅ 배포 완료: http://${DOMAIN}"
REMOTE_SCRIPT

echo ""
echo "=== 배포 완료 ==="
echo "URL: http://${DOMAIN}"
echo ""
echo "HTTPS 설정이 필요하면:"
echo "  ssh ${SSH_USER}@${SSH_HOST}"
echo "  sudo certbot --nginx -d ${DOMAIN}"
