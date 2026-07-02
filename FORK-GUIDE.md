# Hướng dẫn sử dụng Logto Fork

Tài liệu này dành cho team sử dụng fork **minhtuancn/logto** — nhánh `master-customize` chứa các tùy chỉnh riêng.

---

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Branch strategy](#2-branch-strategy)
- [3. Môi trường phát triển](#3-môi-trường-phát-triển)
- [4. Production deployment](#4-production-deployment)
- [5. Đồng bộ với upstream (logto-io/logto)](#5-đồng-bộ-với-upstream-logto-io-logto)
- [6. Cập nhật nhánh tùy chỉnh](#6-cập-nhật-nhánh-tùy-chỉnh)
- [7. Các tùy chỉnh đã áp dụng](#7-các-tùy-chỉnh-đã-áp-dụng)
- [8. Tham khảo](#8-tham-khảo)

---

## 1. Tổng quan

| Thông tin | Giá trị |
|-----------|---------|
| Repository | https://github.com/minhtuancn/logto |
| Upstream | https://github.com/logto-io/logto |
| Máy chủ | 10.20.10.103 |
| Core API | http://10.20.10.103:3001 |
| Admin Console | http://10.20.10.103:3002 |
| Database | PostgreSQL `logto`@localhost:5432 |
| Cache | Redis localhost:6379 |

Fork này được tạo để:
- Phát triển thêm tính năng riêng mà không ảnh hưởng đến upstream
- Đồng bộ định kỳ với upstream để nhận cập nhật mới
- Dùng làm template cho các dự án auth sau này

---

## 2. Branch strategy

```
master              ← Nhánh chính, luôn đồng bộ với logto-io/logto (upstream)
                         Dùng `git reset --hard upstream/master` để cập nhật
                         Chỉ push lên origin, không commit trực tiếp

master-customize    ← Nhánh phát triển, chứa các tùy chỉnh riêng
                         Luôn rebase lên master sau khi đồng bộ upstream
                         Commit tùy chỉnh phải clean, dễ rebase
```

**Nguyên tắc:**
- Không bao giờ commit trực tiếp vào `master`
- Tất cả tùy chỉnh đều trên `master-customize` hoặc nhánh feature
- Sau khi sync upstream, rebase `master-customize` lên `master` mới

---

## 3. Môi trường phát triển

### Yêu cầu
- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- Docker (tùy chọn, cho integration test)

### Clone và cài đặt

```bash
git clone https://github.com/minhtuancn/logto.git
cd logto
git checkout master-customize

# Cài đặt dependencies
pnpm install

# Build packages
pnpm -r prepack

# Tạo file .env
cat > .env << 'EOF'
DB_URL=postgres://logto:logto@localhost:5432/logto
REDIS_URL=redis://localhost:6379
ENDPOINT=http://localhost:3001
ADMIN_ENDPOINT=http://localhost:3002
EOF
```

### Khởi tạo database

```bash
# Tạo user và database (nếu chưa có)
sudo -u postgres createuser logto -P   # password: logto
sudo -u postgres createdb logto -O logto
psql -U logto -d logto -c 'ALTER USER logto CREATEROLE;'

# Seed database
pnpm cli db seed
```

### Chạy dev mode

```bash
pnpm start:dev
```

Core sẽ chạy trên `http://localhost:3001`, Console trên `http://localhost:5002`.

> **Lưu ý:** Dev mode dùng Vite dev server (port 5002 cho console), không dùng production build.

---

## 4. Production deployment

### Build

```bash
pnpm -r build
```

### Chạy server

```bash
NODE_ENV=production node packages/core/build/index.js
```

Server chạy trên port 3001 (core) và 3002 (admin console, account, demo-app).

### Kiểm tra

```bash
# Core API (trả về 204 No Content)
curl -s -o /dev/null -w "%{http_code}" http://10.20.10.103:3001/status

# Admin Console (trả về 302 redirect)
curl -s -o /dev/null -w "%{http_code}" http://10.20.10.103:3002

# Demo app
curl -s -o /dev/null -w "%{http_code}" http://10.20.10.103:3001/demo-app

# Account pages
curl -s -o /dev/null -w "%{http_code}" http://10.20.10.103:3001/account
```

### Systemd service (tùy chọn)

```ini
[Unit]
Description=Logto Production Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=dev
WorkingDirectory=/home/dev/logto
Environment=NODE_ENV=production
ExecStart=/usr/bin/node packages/core/build/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 5. Đồng bộ với upstream (logto-io/logto)

### Cấu hình remote

```bash
# Đã cấu hình sẵn:
# origin    → https://github.com/minhtuancn/logto.git (fetch + push)
# upstream  → https://github.com/logto-io/logto.git (fetch only)
```

### Cron job tự động

Hàng ngày lúc 3:00 AM, script `/home/dev/scripts/sync-logto-upstream.sh` chạy tự động để:

1. `git fetch upstream` — lấy commit mới từ logto-io/logto
2. `git checkout master && git reset --hard upstream/master` — đồng bộ master
3. `git push origin master` — đẩy lên fork

Log được ghi tại `/tmp/logto-upstream-sync.log`.

### Đồng bộ thủ công

```bash
cd /home/dev/logto
git fetch upstream
git checkout master
git reset --hard upstream/master
git push origin master
# Quay lại nhánh làm việc
git checkout master-customize
```

---

## 6. Cập nhật nhánh tùy chỉnh

Sau khi `master` đã được đồng bộ với upstream mới:

```bash
git checkout master-customize
git rebase master

# Nếu có conflict, resolve và continue:
git add <file>
git rebase --continue

# Push force (vì rebase thay đổi lịch sử)
git push origin master-customize --force-with-lease
```

**Lưu ý:** Luôn dùng `--force-with-lease` thay vì `--force` để tránh ghi đè commit của người khác.

---

## 7. Các tùy chỉnh đã áp dụng

Tất cả tùy chỉnh đều nằm trên nhánh `master-customize`.

| File | Thay đổi | Mục đích |
|------|----------|----------|
| `package.json` | Thêm `pnpm.onlyBuiltDependencies` | Cho phép build swc, esbuild, core-js, puppeteer |
| `packages/account/vite.config.ts` | Thêm `server.host: true` | Cho phép truy cập từ máy khác |
| `packages/console/vite.config.ts` | Thêm `server.host: true` | Cho phép truy cập từ máy khác |
| `packages/demo-app/vite.config.ts` | Thêm `server.host: true` | Cho phép truy cập từ máy khác |
| `packages/device-demo-app/vite.config.ts` | Thêm `server.host: true` | Cho phép truy cập từ máy khác |
| `packages/experience/vite.config.ts` | Thêm `server.host: true` | Cho phép truy cập từ máy khác |

### Thêm tùy chỉnh mới

Khi cần thêm tùy chỉnh:

```bash
# Trên nhánh master-customize
git checkout master-customize
# Thực hiện thay đổi
git add <file>
git commit -m "chore: mô tả thay đổi"
git push origin master-customize
```

Dùng `chore` làm type trong commit message để pass commitlint hooks (VD: `chore: enable feature X`, `chore: configure Y`).

---

## 8. Tham khảo

- [Logto Documentation](https://docs.logto.io/)
- [Logto API Reference](https://openapi.logto.io/)
- [Logto GitHub](https://github.com/logto-io/logto)
- [AGENTS.md](./AGENTS.md) — Hướng dẫn cho AI agents khi làm việc với project này
