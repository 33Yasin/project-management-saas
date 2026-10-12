# Agora — Modern Full-Stack Project Management SaaS

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.0-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-190+_Tests-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

> **Agora** is an enterprise-grade, multi-tenant project management SaaS platform built with **React**, **Node.js/Express**, **TypeScript**, and **PostgreSQL**. Designed with strict data isolation, role-based access control (RBAC), interactive drag-and-drop Kanban boards, activity audit trails, and an extensible adapter architecture for cloud storage and transactional email.

---

## 🌐 Language / Dil
- [English](#-english)
- [Türkçe](#-türkçe)

---

# 🇬🇧 English

## 📋 Table of Contents
1. [Key Architectural Highlights](#-key-architectural-highlights)
2. [Core Feature Set](#-core-feature-set)
3. [Security & Authorization Architecture](#-security--authorization-architecture)
4. [Interactive Kanban Board](#-interactive-kanban-board)
5. [Pluggable Adapter Pattern](#-pluggable-adapter-pattern)
6. [Testing Pyramid & Quality Assurance](#-testing-pyramid--quality-assurance)
7. [Technology Stack](#-technology-stack)
8. [Project Structure](#-project-structure)
9. [Getting Started & Local Setup](#-getting-started--local-setup)
10. [Environment Variables Reference](#-environment-variables-reference)

---

## 🏛 Key Architectural Highlights

- **Multi-Tenant Isolation:** Hierarchical tenancy (`Workspace → Project → Task → Comments/Attachments`). Strict authorization boundary checks prevent cross-tenant data leaks.
- **Resource Existence Masking (404 instead of 403):** When unauthorized users or outsiders query resources from other tenants, the API returns `404 Not Found` rather than `403 Forbidden`, preventing resource enumeration attacks.
- **Atomic Position Reordering:** Reordering tasks in Kanban columns leverages database transactions with bounded index normalization, eliminating race conditions and position drift.
- **Adapter-Driven Extensibility:** Storage (Local disk vs. Cloudflare R2 / AWS S3) and Email (Console logger vs. Resend API) use dependency inversion via TypeScript interfaces, enabling 100% free local development with zero third-party lock-in.
- **Data Integrity & Cascade Cleanup:** Removing a member from a workspace or project automatically unassigns their tasks and cascades membership cleanup inside an atomic transaction.

---

## 🚀 Core Feature Set

| Domain | Key Capabilities |
| :--- | :--- |
| **Workspaces** | Multi-workspace support, ownership transfer, member management, invite link generation. |
| **Role-Based Access (RBAC)** | `OWNER`, `ADMIN`, `MEMBER` roles with granular permission checks at workspace and project levels. |
| **Project-Level Isolation** | `ProjectMember` assignment allows regular members to view and access only the projects they are assigned to. |
| **Kanban Task Management** | Drag-and-drop board across `TODO`, `IN_PROGRESS`, and `DONE` states, list view with multi-column sorting and filtering. |
| **Task Attachments** | File uploads with strict MIME whitelist (PDF, PNG, JPEG, WEBP, ZIP), 10MB limit, SHA-256 deduplication, and secure downloads. |
| **Audit Activity History** | Complete chronological audit log of task creations, status updates, priority adjustments, assignments, and attachments. |
| **Notification Center** | In-app notification center tracking task assignments and role promotions with unread badges and mark-all-read support. |
| **Internationalization (i18n)** | Seamless runtime switching between English and Turkish across all routes, modals, badges, and validation messages. |
| **Dark Mode & Theming** | Semantic color tokens with system preference detection and persistent local theme storage. |

---

## 🔒 Security & Authorization Architecture

- **Password Hashing:** State-of-the-art **Argon2id** algorithm (`m=65536, t=3, p=4`) protecting user credentials against GPU-accelerated brute force attacks.
- **Session Management:** Secure server-side sessions backed by PostgreSQL (`connect-pg-simple`), utilizing `httpOnly`, `sameSite: lax`, and cryptographically signed session cookies.
- **Token Security:** Workspace invitation tokens are 256-bit high-entropy strings, stored in PostgreSQL as SHA-256 hashes. The raw token is revealed only once upon creation.
- **Defensive Headers & Rate Limiting:** Hardened with **Helmet** (disabling `X-Powered-By`, enforcing `nosniff` and `SAMEORIGIN`) and IP-based rate limiting on sensitive authentication and invitation endpoints.
- **Log Sanitization:** Custom logging pipeline automatically intercepts and redacts sensitive keys (`password`, `token`, `session`, `secret`) to prevent credential leakage in application logs.
- **Path Traversal Defense:** Uploaded filenames are sanitized and mapped to random UUID storage keys, preventing directory traversal attacks.

---

## 🎯 Interactive Kanban Board

- Built with `@dnd-kit/core` and `@dnd-kit/sortable`.
- **Accessible Sensors:** Mouse sensor with 5px drag activation (preventing accidental clicks), touch sensor with 200ms delay for mobile touchscreens, and full keyboard navigation support (`sortableKeyboardCoordinates`).
- **Optimistic UI:** Fast visual feedback with automatic rollback on network failure.
- **Transactional Consistency:** Server-side `moveTask` handler adjusts surrounding task positions atomically in a single PostgreSQL transaction.

---

## 🔌 Pluggable Adapter Pattern

### File Storage (`IStorageService`)
```
                     ┌──> LocalStorageAdapter (Local Disk: ./uploads)
IStorageService ─────┼──> S3StorageAdapter (Cloudflare R2)
                     └──> S3StorageAdapter (AWS S3)
```
- Set `STORAGE_DRIVER=local` for zero-cost offline development.
- Switch to `STORAGE_DRIVER=r2` in production by providing Cloudflare R2 credentials.

### Transactional Email (`IEmailAdapter`)
```
                   ┌──> DevLogEmailAdapter (Terminal console output)
IEmailAdapter ─────┴──> ResendEmailAdapter (Production Resend API)
```
- Set `EMAIL_DRIVER=log` for instant development without creating email accounts.
- Switch to `EMAIL_DRIVER=resend` for branded HTML email invitations.

---

## 🧪 Testing Pyramid & Quality Assurance

The codebase maintains **190+ automated tests** verifying every layer of the application:

```
          /\
         /  \     5 Playwright E2E Tests (Full Chromium User Journeys)
        /----\
       /      \   41 Frontend Component & Integration Tests (Vitest + RTL)
      /--------\
     /          \ 151 Backend Integration Tests (Vitest + Supertest + PostgreSQL)
    /------------\
```

- **Backend Integration Tests (151 tests):** Covers auth, workspace isolation, project membership scoping, task ordering, attachments, comments, activities, notifications, email delivery, and security hardening.
- **Frontend Component Tests (41 tests):** Verifies Kanban rendering, login/registration forms, activity timeline, attachment lists, notification dropdown, and language switching.
- **End-to-End Tests (5 journeys):** Automated Playwright tests covering complete browser interactions from registration, workspace creation, Kanban drag-and-drop persistence, multi-user invitation acceptance, file uploads, and unauthorized role rejections.

Run the test suites:
```bash
# Server tests
cd server && npm test

# Client tests
cd client && npm test -- --run

# Playwright E2E tests (from root)
npx playwright test
```

---

## 🛠 Technology Stack

### Frontend
- **Framework:** React 19 + TypeScript + Vite
- **Routing:** React Router v7
- **State & Server Cache:** TanStack Query v5
- **Drag & Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **Styling:** Tailwind CSS + Radix UI Primitives + Lucide Icons
- **Testing:** Vitest + React Testing Library + jsdom

### Backend
- **Runtime:** Node.js (v20+) + Express 5
- **Database & ORM:** PostgreSQL + Prisma ORM v7
- **Authentication:** Argon2id + express-session + connect-pg-simple
- **Security:** Helmet, express-rate-limit, Zod schema validation
- **Cloud Adapters:** `@aws-sdk/client-s3` (Cloudflare R2), Resend API
- **Testing:** Vitest + Supertest

---

## 📁 Project Structure

```text
project-management-saas/
├── client/                      # React frontend application
│   ├── src/
│   │   ├── components/ui/       # Accessible UI primitive components
│   │   ├── features/            # Feature-driven modules (tasks, projects, etc.)
│   │   ├── layouts/             # AppLayout, AuthLayout, Sidebar
│   │   ├── lib/i18n/            # Internationalization context and translations
│   │   ├── pages/               # Route views (Kanban, Settings, Members)
│   │   └── types/               # Shared TypeScript domain contracts
│   └── vitest.config.ts
├── server/                      # Express backend API
│   ├── prisma/                  # Prisma schema and database migrations
│   ├── src/
│   │   ├── errors/              # Standardized AppError and ErrorCodes
│   │   ├── middleware/          # requireAuth, requireWorkspaceRole, requireProjectAccess
│   │   ├── modules/             # Business modules (workspaces, projects, tasks, etc.)
│   │   └── lib/                 # Storage adapters, email adapters, logger
│   └── tests/                   # Integration and hardening test suites
├── e2e/                         # Playwright End-to-End test suites
├── playwright.config.ts         # Playwright multi-browser configuration
└── README.md
```

---

## 🏁 Getting Started & Local Setup

### Prerequisites
- **Node.js** (v20 or higher)
- **PostgreSQL** (v15 or higher running locally or hosted on Neon/Supabase)
- **npm** or **pnpm**

### 1. Clone the repository
```bash
git clone https://github.com/your-username/project-management-saas.git
cd project-management-saas
```

### 2. Configure & Run Backend
```bash
cd server
npm install

# Copy environment template
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```
The server will start at `http://localhost:3000`.

### 3. Configure & Run Frontend
```bash
cd ../client
npm install

# Start Vite development server
npm run dev
```
The client will start at `http://localhost:5173`.

---

## ⚙️ Environment Variables Reference

### Backend (`server/.env`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment (`development` / `production`) | `development` |
| `PORT` | API server listening port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `SESSION_SECRET` | 32+ character random secret for signing session cookies | `change-me-to-a-random-secret` |
| `CLIENT_ORIGIN` | Allowed CORS origin URL | `http://localhost:5173` |
| `APP_URL` | Base public URL included in invitation links | `http://localhost:5173` |
| `STORAGE_DRIVER` | File storage adapter (`local` / `r2` / `s3`) | `local` |
| `EMAIL_DRIVER` | Email delivery adapter (`log` / `resend`) | `log` |
| `RESEND_API_KEY` | *(Optional)* Resend API key for real emails | `re_xxxxxxxxx` |
| `R2_ACCOUNT_ID` | *(Optional)* Cloudflare Account ID for R2 storage | `xxxxxxxxx` |
| `R2_ACCESS_KEY_ID` | *(Optional)* Cloudflare R2 Access Key | `xxxxxxxxx` |
| `R2_SECRET_ACCESS_KEY` | *(Optional)* Cloudflare R2 Secret Access Key | `xxxxxxxxx` |
| `R2_BUCKET_NAME` | *(Optional)* Cloudflare R2 Bucket Name | `agora-attachments` |

---

---

# 🇹🇷 Türkçe

## 📌 Proje Özeti

**Agora**, modern ekiplerin projelerini, iş akışlarını ve görevlerini organize etmelerini sağlayan kurumsal düzeyde bir **Proje Yönetimi SaaS Platformudur**. Çok kiracılı (multi-tenant) veri izolasyonu, rol tabanlı erişim kontrolü (RBAC), sürükle-bırak Kanban panosu, detaylı görev aktivite geçmişi ve bulut depolama / e-posta adaptör mimarisi ile uçtan uca eksiksiz bir mimari sunar.

---

## 🎯 Öne Çıkan Mimari ve Teknik Özellikler

1. **Çok Kiracılı (Multi-Tenant) Güvenlik & 404 Maskeleme:**
   - Hiyerarşik veri yapısı (`Workspace → Project → Task → Yorumlar / Dosyalar`).
   - Yetkisiz kullanıcıların başka çalışma alanlarına veya projelere erişim denemelerinde bilgi sızıntısını önlemek için `403 Forbidden` yerine **404 Not Found** döndürülerek kaynak varlığı gizlenir.

2. **Proje Bazlı Üye İzolasyonu (`ProjectMember`):**
   - Çalışma alanına davet edilen normal üyeler (`MEMBER`), sadece kendilerinin dahil edildiği veya görev aldığı projeleri görür; diğer projeler gizlenir.
   - Proje veya çalışma alanından çıkarılan üyelerin görevleri atomik transaction ile güvenli şekilde sahipsiz (unassigned) duruma getirilir.

3. **Gelişmiş Kanban & Atomik Sıralama:**
   - `@dnd-kit` ile fare, dokunmatik ekran ve klavye erişilebilirliği destekli sürükle-bırak panosu.
   - Sütun içi ve sütunlar arası taşımalarda PostgreSQL transaction'ı kullanılarak pozisyon kaymaları ve yarış durumları (race conditions) engellenir.

4. **Tak-Çıkar Adaptör Mimarisi (Adapter Pattern):**
   - **Dosya Depolama:** Yerel geliştirme için sıfır maliyetli disk depolama (`local`), canlı ortam için Cloudflare R2 / AWS S3 nesne depolama desteği.
   - **E-posta Gönderimi:** Yerel ortamda konsola yazdırma (`log`), canlıda Resend API ile şablonlu gerçek e-posta gönderimi.

5. **Kurumsal Güvenlik Standartları:**
   - **Argon2id** şifreleme algoritması ile maksimum parola güvenliği.
   - PostgreSQL tabanlı güvenli oturum yönetimi (`connect-pg-simple`), HTTP-only çerezler.
   - Davet bağlantılarında 256-bit kriptografik rastgele token'lar (veritabanında SHA-256 hash olarak tutulur).
   - Helmet güvenlik başlıkları ve hassas verileri (şifre, token) maskeleyen loglama mekanizması.

6. **Kapsamlı Test Piramidi (190+ Test):**
   - **151 Sunucu Entegrasyon Testi (Vitest + Supertest):** Tüm API, RBAC ve veritabanı akışları.
   - **41 İstemci Testi (Vitest + React Testing Library):** UI bileşenleri ve form doğrulamaları.
   - **5 Playwright E2E Testi:** Gerçek tarayıcıda kullanıcı kayıt, Kanban sürükle-bırak, davet kabul ve yetki sınırlandırma testleri.

---

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Node.js (v20+)
- PostgreSQL (v15+)
- npm

### Kurulum Adımları
```bash
# 1. Projeyi klonlayın
git clone https://github.com/kullanici-adiniz/project-management-saas.git
cd project-management-saas

# 2. Sunucuyu hazırlayın ve başlatın
cd server
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev

# 3. İstemciyi (Client) yeni bir terminalde başlatın
cd ../client
npm install
npm run dev
```

Tarayıcınızda `http://localhost:5173` adresine giderek uygulamayı kullanmaya başlayabilirsiniz.

---

## 📄 Lisans
Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
