#!/bin/sh
# Backup PostgreSQL hằng ngày, giữ 7 bản gần nhất.
# Cron (2:30 sáng): 30 2 * * * /opt/flowershop/scripts/backup.sh >> /var/log/flowershop-backup.log 2>&1
# Nên đồng bộ thêm thư mục backups/ ra ngoài VPS (rclone, S3, Google Drive...).
set -eu

cd "$(dirname "$0")/.."
BACKUP_DIR=${BACKUP_DIR:-./backups}
DB_NAME=${DB_NAME:-flowershop}
DB_USER=${DB_USER:-flowershop}
KEEP=${KEEP:-7}

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"

docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner | gzip > "$FILE"
echo "$(date '+%F %T') backup -> $FILE ($(du -h "$FILE" | cut -f1))"

# Xóa bản cũ, chỉ giữ $KEEP bản mới nhất
ls -1t "$BACKUP_DIR"/"${DB_NAME}"_*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
