# EasyPanel Recovery Checklist

สถานะ: LMDB ของ EasyPanel เสียหายเมื่อรัน `easypanel setup` ใหม่ ข้อมูลที่นี่ถูกกู้จาก `strings` ของ `data.mdb` เดิม (backup ที่ `/etc/easypanel/data.bak.1780592462/` บนเซิร์ฟเวอร์)

> ทุก field ในเอกสารนี้ตรงกับ snapshot ก่อนเสียหาย ทำตามลำดับ A → B → C → D เพื่อให้ระบบกลับมาเหมือนเดิม

---

## A. Login เข้า EasyPanel ใหม่

1. เปิด <https://panel.my-mello.org>
2. ระบบจะแสดงหน้า "Welcome" (initial setup) เพราะ database ใหม่ — ให้กด **Create Account** ด้วย **อีเมลและรหัสผ่านเดิม**:
   - Email: `phakorn.sila@gmail.com`
   - Password: รหัสผ่านเดิมที่จำได้ (bcrypt hash `$2a$09$CHADq1Eafr2G5jFNROlOreuaiCvOL9Im6.5Y/ksIJZXDQZ9LFjNgm` — เนื่องจาก hash นี้ใช้ login กลับเลยไม่ได้ ต้องตั้งรหัสผ่านใหม่)
3. หลัง login → **Settings → Security** → enable 2FA แล้วใช้ TOTP secret เดิมเพื่อให้ Authenticator app ทำงานต่อ:
   - 2FA Secret (base32): `JQRV2SKXOJGXCQCE`

> หมายเหตุ: ถ้า EasyPanel UI ไม่ให้ป้อน 2FA secret เอง ให้ลบ entry เก่าใน Authenticator app แล้ว scan QR ใหม่

---

## B. Settings (Settings → ...)

| Field | Value |
|---|---|
| Server IP | `134.185.93.170` |
| Machine ID | `cm91d3sph000101phbz5vhteg` *(read-only ปกติ EasyPanel generate ใหม่ — ข้าม)* |
| Let's Encrypt Email | `phakorn.sila@gmail.com` |
| Default Domain (wildcard) | `lxhrxr.easypanel.host` |
| Custom Service Domain | `my.mello.org` |
| Custom Panel Domain | `panel.my-mello.org` |
| Serve on IP | `true` (เปิด) |
| Daily Docker Cleanup | `true` (เปิด) |
| Traefik Token | `f96310ba000c6722ba3d` *(จำเป็นเฉพาะถ้าใช้ external Traefik — ปัจจุบันใช้ embedded)* |
| GitHub Token | `[REDACTED — set via EasyPanel UI → Settings]` |
| Setup Complete | `true` (set อัตโนมัติหลัง initial wizard) |

### Storage Provider

ใน **Settings → Storage Providers** → **Add**:

| Field | Value |
|---|---|
| Name | `Local Disk` |
| Type | `local` |
| Path | `/etc/easypanel/backups` |

### Volume Backup

ใน **Settings → Backups** → **Add**:

| Field | Value |
|---|---|
| Project | `n8n` |
| Service | `n8n_service` |
| Volume Name | `data` |
| Storage Provider | `Local Disk` |
| Storage Path | `/back-up` |
| Schedule (cron) | `0 2 * * *` |
| Enabled | ✅ |

---

## C. Projects

สร้าง 3 projects (Projects → Create Project):

1. `n8n`
2. `lusiaa-service` *(เก่า มี service `lusiaa-backend-compose` ที่ destroy ไปแล้ว — สร้าง project เปล่าไว้เผื่อ history)*
3. `doc_ai`

---

## D. Services (per project)

### D.1 — Project: `doc_ai`

#### D.1.1 — App `doc-ai-back`

- **Type**: App
- **Source**: GitHub
  - Owner: `me-phakorn`
  - Repo: `Document-AI`
  - Branch: `main`
  - Path: `/`
  - Auto Deploy: ❌ (ปิดไว้ก่อน)
- **Build**: Dockerfile
  - File: `back-end`
- **Env**: (เว้นว่าง — ใช้ docker-compose ของ project `infar` แทน)
- **Deploy**: Replicas 1, Zero-downtime ON
- **Domain**:
  - Host: `doc-ai-back.my-mello.org`
  - HTTPS: ✅
  - Port: `4000`
  - Path: `/`

#### D.1.2 — App `doc-ai-front`

- **Type**: App
- **Source**: GitHub `me-phakorn/Document-AI` branch `main` path `/`
- **Build**: Dockerfile, file = `front-end/Dockerfile`
- **Create .env file**: ✅
- **Env**:
  ```env
  NODE_ENV=development

  DATABASE_URL=postgresql://docai:docai@localhost:5432/docai?schema=public
  REDIS_URL=redis://localhost:6379

  API_PORT=4000
  API_PREFIX=/api/v1
  FRONTEND_ORIGIN=http://localhost:3002
  API_JSON_BODY_LIMIT=50mb

  JWT_AUTH_ENABLED=true
  JWT_AUTH_USERNAME=admin
  JWT_AUTH_PASSWORD=admin
  JWT_SECRET=docai-local-jwt-secret
  JWT_ISSUER=docai.local
  JWT_AUDIENCE=docai-admin
  JWT_EXPIRES_IN_SECONDS=28800

  BASIC_AUTH_ENABLED=false
  BASIC_AUTH_USERNAME=admin
  BASIC_AUTH_PASSWORD=admin
  BASIC_AUTH_REALM=DocAI

  MINIO_ENDPOINT=localhost
  MINIO_PORT=9000
  MINIO_ACCESS_KEY=docai-local
  MINIO_SECRET_KEY=docai-local-secret
  MINIO_USE_SSL=false
  MINIO_BUCKET_DOCUMENTS=documents
  MINIO_BUCKET_OCR=ocr
  MINIO_BUCKET_EXTERNAL=external
  MINIO_BUCKET_EXPORTS=exports

  AI_PROVIDER=openrouter
  AI_FALLBACK_PROVIDER=claude-code
  AI_MODEL=openai/gpt-4o-mini
  AI_REQUEST_TIMEOUT_MS=60000
  OPENROUTER_API_KEY=[REDACTED — set via EasyPanel UI → Service → Environment]
  OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
  OPENROUTER_HTTP_REFERER=http://localhost:3000
  OPENROUTER_APP_TITLE=DocAI
  CLAUDE_CODE_COMMAND=claude
  CLAUDE_CODE_MODEL=sonnet
  CLAUDE_CODE_TIMEOUT_MS=120000
  CLAUDE_CODE_DISABLE_TOOLS=true
  OCR_ENGINE=pdf-parse-native-text
  QUEUE_CONCURRENCY_DEFAULT=2
  ```
- **Deploy**: Replicas 1, Zero-downtime ON
- **Enabled**: ❌ (ของเดิม disabled อยู่)
- **Domain**:
  - Host: `doc-ai.my-mello.org`
  - HTTPS: ✅
  - Port: `3000`
  - Path: `/`

#### D.1.3 — Compose `infar`

- **Type**: Compose
- **Create .env file**: ✅
- **Env**: เหมือน `doc-ai-front` ด้านบนทุกตัว
- **Compose source** (inline):
  ```yaml
  # Networks
  # easypanel: shared network — lets the backend App service reach these containers
  # local:     internal-only network for local docker compose usage
  networks:
    easypanel:
      external: true
    local:
      driver: bridge

  volumes:
    docai-postgres-data:
    docai-minio-data:

  services:
    postgres:
      image: postgres:16-alpine
      container_name: docai-postgres
      networks:
        - easypanel
        - local
      environment:
        POSTGRES_DB: docai
        POSTGRES_USER: docai
        POSTGRES_PASSWORD: docai
      ports:
        - "5432:5432"
      volumes:
        - docai-postgres-data:/var/lib/postgresql/data
      restart: unless-stopped
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U docai -d docai"]
        interval: 10s
        timeout: 5s
        retries: 5

    redis:
      image: redis:7-alpine
      container_name: docai-redis
      networks:
        - easypanel
        - local
      ports:
        - "6379:6379"
      restart: unless-stopped
      healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 10s
        timeout: 5s
        retries: 5

    minio:
      image: minio/minio:latest
      container_name: docai-minio
      command: server /data --console-address ":9001"
      networks:
        - easypanel
        - local
      environment:
        MINIO_ROOT_USER: docai-local
        MINIO_ROOT_PASSWORD: docai-local-secret
      ports:
        - "9000:9000"
        - "9001:9001"
      volumes:
        - docai-minio-data:/data
      restart: unless-stopped
      healthcheck:
        test: ["CMD", "mc", "ready", "local"]
        interval: 10s
        timeout: 5s
        retries: 5
  ```
- **Domain**:
  - Host: `doc-ai-infar.lxhrxr.easypanel.host`
  - HTTPS: ✅
  - Port: `80`
  - Path: `/`

> หมายเหตุ: หลังจาก infar deploy แล้ว — Volume ของ postgres / minio ใหม่จะ "ว่าง" เพราะเราเพิ่งทำ DB wipe + MinIO bucket wipe ไป (ที่ user ขอ "ล้างเหมือนเพิ่งขึ้น production") เป็นสภาพที่ตั้งใจไว้แล้ว — แค่รัน migrations + seed อีกรอบหลัง deploy สำเร็จ

---

### D.2 — Project: `n8n`

#### D.2.1 — Postgres `postgres_service`

- **Type**: Postgres
- **Image**: `postgres:17`
- **Database Name**: `n8n`
- **User**: `postgres`
- **Password**: `funz_handsome`
- **Exposed Port**: `0` (ไม่ expose)
- **Enabled**: ✅

#### D.2.2 — App `n8n_service`

- **Type**: App
- **Source**: Image `n8nio/n8n:2.11.4`
- **Env**:
  ```env
  WEBHOOK_URL=https://n8n.my-mello.org
  DB_TYPE=postgresdb
  DB_POSTGRESDB_HOST=postgres_service
  DB_POSTGRESDB_PORT=5432
  DB_POSTGRESDB_DATABASE=n8n
  DB_POSTGRESDB_USER=postgres
  DB_POSTGRESDB_PASSWORD=funz_handsome
  N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
  N8N_BROWSERLESS_URL=ws://browserless:3000
  PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
  N8N_PROXY_HOPS=1
  N8N_AVAILABLE_BINARY_DATA_MODES=filesystem
  N8N_DEFAULT_BINARY_DATA_MODE=filesystem
  N8N_BINARY_DATA_STORAGE_PATH=/home/node/.n8n/binaryData
  ```
- **Mount**: Volume `data` → `/home/node/.n8n`
- **Enabled**: ❌
- **Domain**:
  - Host: `n8n.my-mello.org`
  - HTTPS: ✅
  - Port: `5678`

#### D.2.3 — App `pgadmin`

- **Type**: App
- **Source**: Image `dpage/pgadmin4:9.11.0`
- **Env**:
  ```env
  PGADMIN_DEFAULT_EMAIL=onthefunz@gmail.com
  PGADMIN_DEFAULT_PASSWORD=Funzboypop
  ```
- **Mount**: Volume `data` → `/var/lib/pgadmin`
- **Enabled**: ❌
- **Domain**:
  - Host: `n8n-pgadmin.my-mello.org`
  - HTTPS: ✅
  - Port: `80`

#### D.2.4 — App `gotenberg`

- **Type**: App
- **Source**: Image `gotenberg/gotenberg:8.27.0`
- **Env**: *(เว้นว่าง)*
- **Enabled**: ❌
- **Domain**:
  - Host: `n8n-gotenberg.lxhrxr.easypanel.host`
  - HTTPS: ✅
  - Port: `3000`

#### D.2.5 — App `browserless`

- **Type**: App
- **Source**: Image `ghcr.io/browserless/chromium:v2.38.2`
- **Env**:
  ```env
  CONCURRENT=10
  TOKEN=1645dde61867c1d20437de8730df4198
  ```
- **Enabled**: ❌
- **Domain**:
  - Host: `n8n-browserless.lxhrxr.easypanel.host`
  - HTTPS: ✅
  - Port: `3000`

---

## E. Domain mapping summary

| Domain | Project / Service | Port |
|---|---|---|
| `doc-ai.my-mello.org` | `doc_ai` / `doc-ai-front` | 3000 |
| `doc-ai-back.my-mello.org` | `doc_ai` / `doc-ai-back` | 4000 |
| `doc-ai-infar.lxhrxr.easypanel.host` | `doc_ai` / `infar` (compose) | 80 |
| `n8n.my-mello.org` | `n8n` / `n8n_service` | 5678 |
| `n8n-pgadmin.my-mello.org` | `n8n` / `pgadmin` | 80 |
| `n8n-gotenberg.lxhrxr.easypanel.host` | `n8n` / `gotenberg` | 3000 |
| `n8n-browserless.lxhrxr.easypanel.host` | `n8n` / `browserless` | 3000 |

> Domains ที่เคยมีใน Traefik dump แต่ไม่ได้อยู่ใน LMDB snapshot สุดท้าย (เช่น `givemefreesex.com`, `static.givemefreesex.com`, `panel.givemefreesex.com`, `pgadmin.givemefreesex.com`, `backend.givemefreesex.com`, `m.givemefreesex.com`, `n8n.givemefreesex.com`) ถูกลบไปก่อน LMDB เสียหายแล้ว ไม่ต้องสร้างใหม่ ถ้ายังใช้งานอยู่ค่อยเพิ่มทีหลัง

---

## F. Manual fallback (Traefik route ปัจจุบัน)

ระหว่างที่ยังไม่ทำ checklist เสร็จ — Traefik routing ของ 3 domain หลักถูกตั้งแบบ static dynamic-config ไว้ที่:

```
/etc/easypanel/traefik/config/restore.yml
```

ครอบคลุม:
- `panel.my-mello.org` → `easypanel:3000`
- `doc-ai-back.my-mello.org` → `doc_ai_doc-ai-back:4000`
- `doc-ai.my-mello.org` → `doc_ai_doc-ai-front:3000`

ไฟล์นี้ต้องลบทิ้งหลังจาก services ใน EasyPanel ถูกสร้างกลับมาแล้ว เพราะ EasyPanel จะ generate route เอง

```bash
ssh IPetto-Server "sudo rm /etc/easypanel/traefik/config/restore.yml && sudo docker service update --force docker_traefik"
```

---

## G. Source ของข้อมูลที่กู้

- LMDB snapshot สุดท้าย (data.mdb เสียหาย): `/etc/easypanel/data.bak.1780592462/data.mdb` บนเซิร์ฟเวอร์
- Audit history (SQLite `actions` table): `/etc/easypanel/data.bak.1780592462/data.sdb` (กู้ทั้งหมด 50+ deployment events ปี 2025-04 — ใช้อ้างอิงเฉยๆ)
- Parsed JSON dump: `/tmp/lmdb-entries.json` (local) — 33 keys ครบ ยกเว้น `services:doc_ai:infar` ที่ค่ายาวเกิน `strings` ตัด แต่ดึงด้วยมือได้ครบ (ดูส่วน D.1.3)
- Strings dump ดิบ: `/tmp/lmdb-strings.txt` (local, 193 บรรทัด)
