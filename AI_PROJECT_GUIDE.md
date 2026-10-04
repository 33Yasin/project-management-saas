# Team Project Management SaaS — AI Development Guide

> **Amaç:** Bu dosya, proje geliştirirken AI asistanının okuyacağı ana teknik plan ve çalışma sözleşmesidir.
> AI bu belgeyi **source of truth** kabul etmeli; kesinleşmiş kararları kullanıcıya sormadan değiştirmemelidir.
>
> **Plan tarihi:** 2026-10-03
> **Proje tipi:** Portfolio + öğrenme odaklı Team Project / Task Management SaaS
> **Ana hedef:** Gerçekçi bir ürün üzerinden full-stack geliştirmeyi öğrenmek.

---

## 0. AI İÇİN ZORUNLU ÇALIŞMA KURALLARI

1. Her oturumda önce bu dosyayı oku.
2. İstenen özelliğin V1 kapsamında olup olmadığını kontrol et.
3. Mevcut mimari ve klasör yapısına uy.
4. Büyük değişiklikten önce ne yapacağını, etkilenen dosyaları ve nedenini açıkla.
5. Küçük, test edilebilir adımlarla ilerle; tüm projeyi tek seferde üretme.
6. Kritik mimari, güvenlik ve veri modeli kararlarının nedenini açıkla.
7. Gereksiz abstraction, dependency veya teknoloji ekleme.
8. Yeni dependency eklemeden önce neden gerektiğini açıkla.
9. Önemli kodu açıklamadan büyük bloklar halinde üretme.
10. Her satıra yorum yazma; yalnızca “neden”i anlatan değerli yorumlar kullan.
11. `any` ile TypeScript'i bypass etme; zorunluysa nedenini açıkla.
12. Frontend'e güvenerek backend validation/authorization atlama.
13. ORM kullanılıyor diye SQL, constraint, index ve transaction etkilerini görmezden gelme.
14. Pattern'i moda olduğu için değil gerçek problemi çözdüğü için kullan.
15. Feature tamamlanınca uygun testleri ekle/güncelle.
16. Secret, password, raw token, session id veya connection string'i source control/log'a koyma.
17. `.env.example` yalnızca güvenli örnekler içersin.
18. Production API response'unda stack trace/database iç detayı sızdırma.
19. Kullanıcı istemeden V2/V3 özelliklerini V1'e ekleme.
20. Mevcut davranışı değiştiren refactor öncesi bunu belirt.

### Güncel teknoloji kuralı

Paket eklerken/kurulum komutu verirken resmi dokümantasyonu kontrol et. Stable sürümü tercih et; RC/beta/experimental sürümü bilinçli onay olmadan seçme. Eski tutorial komutlarını körü körüne kullanma. Major sürüm değişmişse bu belgedeki **mimari niyeti** koruyarak güncel stable API'ye uyarla. Sürüm numaralarını bu dosyada gereksiz yere hard-code etme; gerçek kurulum `package-lock.json` ile kilitlenecek.

---

# 1. ÜRÜN VİZYONU

Takımların workspace oluşturarak projelerini, görevlerini ve yorumlarını yönettiği web tabanlı SaaS.

```text
User
  ├── WorkspaceMember ── Workspace
  ├── Invitation ─────── Workspace
  ├── Task (creator/assignee)
  └── Comment

Workspace ── Project ── Task ── Comment
```

Bu kişisel todo uygulaması değildir. Ana kavram **multi-user workspace + authorization**.

---

# 2. V1 MVP

## V1'de olacak

**Authentication:** Register, Login, Logout, Current User/Session.

**Workspace:** Create, list, detail, edit, delete, ownership transfer, members.

**Invitation/Members:** Email'e davet oluşturma, preview/accept/revoke, member remove, ADMIN/MEMBER role change.

**Project:** Create, list, detail, edit, delete.

**Task:** Create, list, detail, edit, delete, assignee, status, priority, due date, search, filter, sort, pagination.

**Comment:** Add, list, delete.

## V1'de olmayacak

Kanban/drag-drop, attachments, WebSocket/realtime, Redis, notifications, gerçek email gönderimi, activity/audit history, analytics, queue/background jobs, microservices, E2E browser suite, mobile app, OAuth/social login, password reset, email verification, account deletion, custom roles/project-specific permissions.

---

# 3. TEKNOLOJİ STACK'İ

## Repo/package

- Tek Git repository.
- `client` ve `server` ayrı `package.json`.
- npm.
- Workspace/pnpm/Turborepo/Nx yok.

```text
project-management-saas/
├── client/
├── server/
├── docs/
├── README.md
├── AI_PROJECT_GUIDE.md
└── .gitignore
```

## Frontend

- React + TypeScript + Vite
- React Router — **Declarative Mode**
- TanStack Query — server state
- native `fetch` + `apiFetch<T>()`
- React Hook Form + Zod
- Tailwind CSS
- shadcn/ui
- ESLint + Prettier

React Router yalnız navigation/URL katmanı olacak; server-state TanStack Query'de kalacak.

## Backend

- Node.js + TypeScript + Express
- Zod
- Prisma ORM
- PostgreSQL
- `express-session`
- PostgreSQL uyumlu production session store
- güvenli password hashing çözümü
- Vitest + Supertest
- ESLint + Prettier

Password hashing çözümü kurulumda güncel Node/güvenlik desteğine göre resmi kaynaklardan doğrulanır. Plaintext parola asla saklanmaz.

## Bilinçli olarak yok

Axios, Redux/Zustand (ihtiyaç çıkana kadar), Redis, zorunlu Repository Pattern, NestJS, JWT access/refresh token, development önkoşulu olarak Docker, Storybook.

---

# 4. FRONTEND MİMARİSİ

```text
client/src/
├── app/
│   ├── router/
│   └── providers/
├── components/
│   ├── ui/
│   └── common/
├── features/
│   ├── auth/
│   ├── workspaces/
│   ├── invitations/
│   ├── projects/
│   ├── tasks/
│   └── comments/
├── layouts/
├── lib/
│   ├── api/api-fetch.ts
│   ├── query-client.ts
│   └── utils.ts
├── pages/
├── styles/
├── types/
├── main.tsx
└── App.tsx
```

**TanStack Query:** API/server state, cache, loading/error, mutation, invalidation.

**Local React state:** modal/dropdown/geçici UI state.

**React Hook Form:** form state.

**Zod:** runtime/form validation. Frontend validation UX'tir; backend tekrar validate eder.

---

# 5. BACKEND MİMARİSİ

Feature-based modular yapı:

```text
server/src/
├── config/
├── lib/
│   ├── db/
│   └── session/
├── middleware/
│   ├── require-auth.ts
│   ├── error-handler.ts
│   └── validate.ts
├── modules/
│   ├── auth/
│   ├── workspaces/
│   ├── invitations/
│   ├── projects/
│   ├── tasks/
│   └── comments/
├── errors/
├── utils/
├── app.ts
└── server.ts
```

```text
Request
  ↓
Route
  ↓
Middleware (auth / validation / cross-cutting)
  ↓
Controller (HTTP)
  ↓
Service (business rules + authorization + transactions)
  ↓
Prisma
  ↓
PostgreSQL
```

Controller ince tutulur. Business logic Service'tedir. Başlangıçta Repository Pattern yok; gerçekten değer katmaya başladığında değerlendirilir.

---

# 6. AUTHENTICATION / SESSION

```text
Browser
  │ HttpOnly cookie
  ▼
Express
  ▼
express-session
  ▼
PostgreSQL session store
```

Login: validate → user lookup → password verify → güvenli session lifecycle/regenerate → `session.userId`.

Logout: server-side session destroy + cookie clear.

Production cookie: `httpOnly: true`, HTTPS altında `secure: true`; `sameSite`, `maxAge`, origin/CORS/CSRF ayarları deployment topolojisine göre kesinleştirilir.

Cookie otomatik gönderildiği için CSRF threat model ayrıca ele alınır. CORS, CSRF koruması değildir. Mümkünse frontend/API aynı site altında; güvenli SameSite + mutation'larda Origin/Referer kontrolü değerlendirilir. Cross-site gerekiyorsa açık CSRF-token stratejisi eklenir.

Default in-memory session store production'da kullanılmaz.

---

# 7. AUTHORIZATION / RBAC

Roller `WorkspaceMember` üzerindedir:

```text
OWNER
ADMIN
MEMBER
```

| İşlem | OWNER | ADMIN | MEMBER |
|---|:---:|:---:|:---:|
| Workspace view | ✓ | ✓ | ✓ |
| Workspace edit | ✓ | ✓ | — |
| Workspace delete | ✓ | — | — |
| Ownership transfer | ✓ | — | — |
| Members view | ✓ | ✓ | ✓ |
| Invite/revoke | ✓ | ✓ | — |
| Member remove | ✓ | ✓* | — |
| Role change | ✓ | ✓* | — |
| Project CRUD | ✓ | ✓ | ✓ |
| Task CRUD | ✓ | ✓ | ✓ |
| Comment add | ✓ | ✓ | ✓ |
| Own comment delete | ✓ | ✓ | ✓ |
| Others' comment delete | ✓ | ✓ | — |

`*` Admin Owner üzerinde işlem yapamaz, OWNER atayamaz ve ownership transfer edemez.

Frontend'de buton gizlemek güvenlik değildir; backend gerçek güvenlik sınırıdır.

---

# 8. DATABASE / DOMAIN MODEL

## User

```text
id
name
email             UNIQUE
passwordHash
createdAt
updatedAt
```

Email normalize/canonical saklanır.

## Workspace

```text
id
name
createdAt
updatedAt
```

`ownerId` yok.

## WorkspaceMember

```text
id
userId            FK User
workspaceId       FK Workspace
role              OWNER | ADMIN | MEMBER
createdAt
UNIQUE(userId, workspaceId)
```

Ürün kuralı: workspace başına **tam 1 OWNER**.

“En fazla 1 OWNER” PostgreSQL partial unique index ile DB seviyesinde korunur. Basit Prisma `@@unique` bu koşullu kuralı tek başına ifade etmeyebilir. Migration SQL gerçek generated tablo/enum isimlerine göre review edilerek eklenir. “En az 1 OWNER” invariant'ı service + transaction ile korunur.

## Invitation

```text
id
workspaceId
invitedById
email
role              ADMIN | MEMBER
tokenHash
expiresAt
createdAt
```

- OWNER invitation ile verilmez.
- Raw token DB'de tutulmaz.
- Token yüksek entropili.
- Accept eden authenticated user email'i invite email'iyle eşleşmeli.
- Expired invite kabul edilmez.
- Accept: membership create + invitation consume transaction.
- Aynı workspace/email için birden fazla aktif invite engellenir.
- V1'de status enum yok: mevcut+not expired=pending; expired tarih ile anlaşılır; accept/revoke kaydı siler.

## Project

```text
id
workspaceId
name
description?
createdAt
updatedAt
```

Project-specific role/owner yok.

## Task

```text
id
projectId
title
description?
status            TODO | IN_PROGRESS | DONE
priority          LOW | MEDIUM | HIGH
assigneeId?       FK User
createdById       FK User
dueDate?
createdAt
updatedAt
```

En fazla bir assignee; nullable. Assignee ilgili project's workspace üyesi olmalı.

## Comment

```text
id
taskId
authorId
content
createdAt
updatedAt
```

V1 comment edit endpoint'i yok. Author kendi yorumunu; Admin/Owner workspace içindeki yorumu silebilir.

---

# 9. ID / TARİH

- Public entity ID'leri opaque olacak; sequential ID'ye bağımlı olmayacağız.
- UUID/CUID benzeri strateji güncel Prisma stable API'sine göre seçilecek.
- Timestamp server/DB tarafında UTC; UI yerel gösterir.
- Eski Prisma syntax'ı doğrulamadan kullanılmaz.

---

# 10. REFERENTIAL ACTION / DELETE

Workspace delete (yalnız OWNER): members, invitations, projects → tasks → comments domain children temizlenir.

Project delete: tasks → comments.

Task delete: comments.

User account deletion V1'de yok; ownership/authorship/assignment için ayrı ürün politikası gerektirir.

Her relation'ın cascade/restrict/set-null davranışı Prisma migration sırasında açıkça review edilir; varsayılanlara körü körüne güvenilmez. Assignee gibi opsiyonel referanslarda kullanıcı yaşam döngüsü ileride ayrıca tasarlanır.

---

# 11. INDEX STRATEJİSİ

Başlangıç adayları:

```text
User(email) UNIQUE
WorkspaceMember(userId, workspaceId) UNIQUE
WorkspaceMember(workspaceId, role)
WorkspaceMember(userId)
Invitation(workspaceId, email)
Invitation(tokenHash)
Invitation(expiresAt)
Project(workspaceId)
Task(projectId)
Task(projectId, status)
Task(projectId, priority)
Task(assigneeId)
Task(projectId, dueDate)
Comment(taskId, createdAt)
```

Unique constraint'in zaten oluşturduğu index kontrol edilmeden duplicate index eklenmez. Full-text search V1'de yok; basit DB filtering ile başlanır.

---

# 12. TRANSACTIONS

**Workspace create:** Workspace + creator OWNER membership atomik.

**Invitation accept:** validate + membership create + invite consume atomik; race condition DB constraint ile de korunur.

**Ownership transfer:** target aynı workspace member; target OWNER + old owner ADMIN aynı transaction. Partial unique index nedeniyle update sırası dikkatli tasarlanır; invariant commit sonunda korunur.

---

# 13. API PRENSİPLERİ

Base: `/api`, JSON.

Success için gereksiz `{ success: true, data: ... }` wrapper zorunlu değil.

Pagination:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

Standart error:

```json
{
  "error": {
    "code": "WORKSPACE_ACCESS_DENIED",
    "message": "You do not have access to this workspace."
  }
}
```

Validation:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "fields": {
      "email": ["Invalid email address."]
    }
  }
}
```

Status yaklaşımı: 200 read/update, 201 create, 204 body gerekmeyen başarılı delete/logout, 400 schema validation, 401 unauthenticated, 403 unauthorized, 404 not found/hidden, 409 conflict, 500 unexpected.

---

# 14. ENDPOINT PLANI

## Auth
```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

## Workspaces
```text
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:workspaceId
PATCH  /api/workspaces/:workspaceId
DELETE /api/workspaces/:workspaceId
POST   /api/workspaces/:workspaceId/transfer-ownership
```

## Members
```text
GET    /api/workspaces/:workspaceId/members
PATCH  /api/workspaces/:workspaceId/members/:memberId
DELETE /api/workspaces/:workspaceId/members/:memberId
```

## Invitations
```text
GET    /api/workspaces/:workspaceId/invitations
POST   /api/workspaces/:workspaceId/invitations
DELETE /api/workspaces/:workspaceId/invitations/:invitationId
GET    /api/invitations/:token/preview
POST   /api/invitations/:token/accept
```

V1'de gerçek email gönderimi yok. Development invite link'i güvenli dev akışıyla gösterilebilir; production davranışı olarak secret token loglanmaz.

## Projects
```text
GET    /api/workspaces/:workspaceId/projects
POST   /api/workspaces/:workspaceId/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId
```

## Tasks
```text
GET    /api/projects/:projectId/tasks
POST   /api/projects/:projectId/tasks
GET    /api/tasks/:taskId
PATCH  /api/tasks/:taskId
DELETE /api/tasks/:taskId
```

Query:
```text
?search=&status=&priority=&assigneeId=&sort=&order=&page=&limit=
```

Sort field whitelist.

## Comments
```text
GET    /api/tasks/:taskId/comments
POST   /api/tasks/:taskId/comments
DELETE /api/comments/:commentId
```

---

# 15. PAGINATION / FILTER

Offset pagination:

```text
page=1
limit=20
max limit=100
```

Zod ile positive integer validation. Arbitrary DB sort column yok. Cursor pagination V1'de yok.

---

# 16. VALIDATION SINIRLARI

**Zod:** email format, length, enums, page/limit, date/input shape.

**Service:** membership, permission, assignee same workspace, invitation expiration, ownership rules.

**PostgreSQL:** unique, FK, membership unique, partial unique owner, referential integrity.

---

# 17. FRONTEND ROUTES

Public:
```text
/login
/register
/invitations/:token
```

Authenticated:
```text
/workspaces
/workspaces/:workspaceId
/workspaces/:workspaceId/projects
/workspaces/:workspaceId/members
/workspaces/:workspaceId/settings
/projects/:projectId
/projects/:projectId/tasks
/tasks/:taskId
```

```text
App
├── PublicLayout
└── AppLayout
    ├── WorkspaceSwitcher
    ├── Sidebar
    └── Content
```

Protected route UX'tir; backend auth gerçek güvenliktir.

---

# 18. UI / WIREFRAME

Akış:

```text
Wireframe → Design System → shadcn/ui → Tailwind → React
```

Hedef: temiz, profesyonel SaaS; yüksek okunabilirlik; responsive; erişilebilir. Gereksiz gradient/glassmorphism ve generic “AI dashboard” görünümü yok.

Main shell:

```text
┌───────────────┬───────────────────────────────────────────┐
│ Workspace     │ Header / Breadcrumb / User menu           │
│ switcher      ├───────────────────────────────────────────┤
│ Projects      │                                           │
│ Members       │ Main page content                         │
│ Settings      │                                           │
└───────────────┴───────────────────────────────────────────┘
```

Task list:

```text
┌───────────────────────────────────────────────────────────┐
│ Project Name                              [+ New Task]     │
├───────────────────────────────────────────────────────────┤
│ Search  Status▼  Priority▼  Assignee▼  Sort▼             │
├───────────────────────────────────────────────────────────┤
│ Task          Status       Priority   Assignee    Due      │
│ Login API     In Progress  High       Ayşe        ...      │
├───────────────────────────────────────────────────────────┤
│                Previous  1 2 3  Next                      │
└───────────────────────────────────────────────────────────┘
```

Task detail ayrı route. Create/edit Dialog veya Sheet olabilir.

Design: shadcn semantic tokens, light mode önce, tek primary accent, neutral surfaces, consistent spacing/radius. Status/priority yalnız renkle anlatılmaz. Label, keyboard navigation, focus state, semantic HTML, contrast zorunlu düşünülür.

---

# 19. API CLIENT / QUERY

`apiFetch<T>()`: base URL, gerekli JSON headers, credentials/origin ihtiyacı, parse, standard API error, typed return. Business logic/cache/toast burada olmaz.

Query keys kavramsal:
```text
["workspaces"]
["workspace", workspaceId]
["projects", workspaceId]
["project", projectId]
["tasks", projectId, filters]
["task", taskId]
["comments", taskId]
```

Mutation sonrası yalnız ilgili query invalidate edilir. Server state Context/Redux'a kopyalanmaz.

---

# 20. FORMS

```text
Input
 ↓
React Hook Form
 ↓
Zod frontend
 ↓
TanStack mutation
 ↓
apiFetch
 ↓
Express
 ↓
Zod backend
 ↓
Service
```

Backend field errors uygun olduğunda form alanlarına map edilir.

---

# 21. ERROR HANDLING

Beklenen code'lar:
```text
AUTH_REQUIRED
INVALID_CREDENTIALS
WORKSPACE_NOT_FOUND
WORKSPACE_ACCESS_DENIED
OWNER_REQUIRED
MEMBER_ALREADY_EXISTS
INVITATION_NOT_FOUND
INVITATION_EXPIRED
INVITATION_EMAIL_MISMATCH
PROJECT_NOT_FOUND
TASK_NOT_FOUND
INVALID_ASSIGNEE
VALIDATION_ERROR
CONFLICT
```

Controller'larda tekrarlanan `try/catch + res.status` yığını oluşturma; merkezi error handler kullan. Güncel Express stable async error davranışını resmi docs'tan doğrula.

---

# 22. LOGGING

- Dev'de anlaşılır request/error log.
- Production'da structured logging tercih.
- Password, cookie, session id, raw invitation token loglanmaz.
- Production response'a stack trace yok.
- Debug `console.log` kalıntıları yok.
- Logging library yalnız ihtiyaç varsa ve güncel bakım durumu kontrol edilerek seçilir.

---

# 23. SECURITY

- Password hashing
- HttpOnly session cookie
- HTTPS + Secure cookie production
- bilinçli SameSite/CSRF/CORS
- CORS allowlist; credentials ile wildcard yok
- backend Zod validation
- her protected resource'ta authorization
- parameterized ORM/raw SQL
- login/register/invite için deployment öncesi rate limiting
- security headers
- secrets env'de, `.env` gitignore
- generic login error ile gereksiz account enumeration azalt
- invitation token high entropy + hash
- open redirect yok
- sort/filter whitelist
- `passwordHash`/session internals response'a yok
- destructive action explicit auth
- dependency audit/update

---

# 24. TEST STRATEJİSİ

Backend: Vitest + Supertest. İlk ağırlık integration/API.

Öncelik:
1. Auth
2. Workspace authorization
3. Invitation
4. Project
5. Task
6. Comment

Örnekler:
- register 201
- duplicate email 409
- wrong login 401
- `/auth/me` authenticated 200
- protected unauthenticated 401
- Member workspace delete 403
- Admin Owner remove 403
- other-workspace assignee rejected
- expired invite rejected
- valid invite → membership
- cascade davranışları

Test DB development DB'den ayrı: `TEST_DATABASE_URL`. Testler birbirinin state'ine bağımlı olmaz.

Frontend testleri ilk milestone'da zorunlu değil; sonra React Testing Library ve Playwright değerlendirilebilir.

---

# 25. PRISMA KURALI

Prisma typed data access + migration aracıdır; SQL bilgisinin yerine geçmez.

- relation/FK/referential action'ı anlamadan model üretme
- migration dosyasını review et
- production schema değişikliğini gelişigüzel `db push` yaklaşımıyla yapma
- migration history kullan
- complex constraint için SQL migration'dan kaçınma
- N+1/gereksiz include/select düşün
- yalnız gerekli alanları select et
- sensitive field serialize etme

**2026-10-03 notu:** Prisma ekosisteminde major geçişi hareketlidir. Proje başlatılırken stable sürüm seç; release candidate'ı otomatik production tercihi yapma. Güncel resmi setup/migration docs kontrol edilmeli. Bu dosyada domain/mimari source of truth'tur, belirli Prisma major syntax'ı değil.

---

# 26. ENV

`.env.example` kavramsal:
```text
NODE_ENV=
PORT=
DATABASE_URL=
SESSION_SECRET=
CLIENT_ORIGIN=
TEST_DATABASE_URL=
```

Frontend `VITE_` değişkenleri browser'a açılabilir; secret koyma.

---

# 27. GIT

Solo proje için basit:
```text
main
feature/auth
feature/workspaces
feature/projects
...
```

Anlamlı küçük commit:
```text
feat(auth): add user registration
test(auth): cover duplicate email
fix(workspace): prevent admin from removing owner
```

---

# 28. IMPLEMENTATION SIRASI

## Phase 0 — Setup
Git, client/server, npm, TS, ESLint/Prettier, env, PostgreSQL dev DB, health endpoint, client→API connectivity.

**Milestone:** React, Express API'ye request atıyor.

## Phase 1 — DB
Prisma stable setup; User/Workspace/WorkspaceMember/Invitation/Project/Task/Comment; migrations; partial unique OWNER index; migration review.

## Phase 2 — Auth
Register, hashing, login, PostgreSQL session store, logout, `/auth/me`, tests.

## Phase 3 — Workspace/RBAC
Create transaction, list/detail/edit/delete, permission helpers, ownership transfer, tests.

## Phase 4 — Invitations/Members
Invite/preview/accept/revoke, member list/role/remove, tests.

## Phase 5 — Projects
CRUD + workspace scoping + tests.

## Phase 6 — Tasks
CRUD, assignee validation, status/priority/due date, search/filter/sort/pagination, tests.

## Phase 7 — Comments
Create/list/delete + permissions + tests.

## Phase 8 — Frontend integration
Auth pages, AppLayout, workspace switcher, projects, task list/filters/detail/comments, members/settings, loading/error/empty states, responsive polish.

## Phase 9 — Hardening
Security, CORS/cookie/CSRF deployment settings, rate limiting, logging, DB/index review, accessibility, tests.

## Phase 10 — Deployment
Production build, PostgreSQL, HTTPS, secrets, migration deploy, CI test/build; Docker yalnız seçilirse.

---

# 29. DEFINITION OF DONE

Bir feature bitmeden:
- [ ] Requirement karşılanıyor
- [ ] Backend Zod validation var
- [ ] Authorization kontrol edildi
- [ ] DB constraint/relation etkisi düşünüldü
- [ ] Standard error formatı var
- [ ] Loading/error/empty UI düşünüldü
- [ ] TypeScript/lint/format temiz
- [ ] İlgili backend testleri geçiyor
- [ ] Sensitive data sızmıyor
- [ ] Gereksiz dependency yok
- [ ] Mimariye uyuyor
- [ ] Önemli kararların nedeni kullanıcıya açıklandı

---

# 30. V2 / V3

V1 tamamlanmadan başlanmaz.

**V2:** Kanban, drag-drop, attachments, activity history, notifications, gerçek email, dark mode, frontend integration tests, Playwright critical E2E.

**V3/scaling-learning:** Redis/cache, background jobs/email queue, WebSocket, analytics, DB optimization, cursor pagination, gelişmiş CI/CD, Docker, observability/performance.

Microservices yalnız monolith gerçek problem olduğunda tartışılır.

---

# 31. AI'NIN ONAYSIZ DEĞİŞTİRMEMESİ GEREKENLER

Express→NestJS, PostgreSQL→başka DB, Prisma→başka ORM, Session→JWT, fetch→Axios, React Router→başka router, TanStack Query server-state→Redux, npm→pnpm/yarn, workspace tooling, Redis, microservices, GraphQL, her modüle Repository Pattern, zorunlu Docker, V1'e Kanban/WebSocket/notification.

Değişiklik gerçekten faydalıysa:
1. mevcut problemini göster,
2. alternatifleri açıkla,
3. migration maliyetini belirt,
4. kullanıcıdan karar iste.

---

# 32. YENİ AI OTURUMU PROMPT'U

```text
Önce proje kökündeki AI_PROJECT_GUIDE.md dosyasını tamamen oku ve teknik
source of truth olarak kabul et.

Mevcut kodu incelemeden mimariyi değiştirme. Amacım yalnız çalışan kod almak
değil, full-stack geliştirmeyi öğrenmek. Önemli teknik kararların nedenini kısa
ve anlaşılır açıkla.

Büyük feature'ı tek seferde yazma. Küçük, test edilebilir adımlarla ilerle.
Yeni dependency/pattern eklemeden önce neden gerektiğini açıkla.
Backend authorization ve validation'ı atlama.

Şimdi mevcut proje durumunu incele ve sıradaki en küçük mantıklı adımı öner.
```

---

# 33. SON MİMARİ ÖZET

```text
                     CLIENT
┌─────────────────────────────────────────────┐
│ React + TypeScript + Vite                   │
│ React Router (Declarative)                  │
│ TanStack Query                              │
│ React Hook Form + Zod                       │
│ native fetch + apiFetch                     │
│ Tailwind CSS + shadcn/ui                    │
└───────────────────┬─────────────────────────┘
                    │ HTTP/JSON
                    │ HttpOnly Cookie
                    ▼
                     API
┌─────────────────────────────────────────────┐
│ Node.js + TypeScript + Express              │
│ Route → Middleware → Controller → Service   │
│                         ↓                   │
│                       Prisma                │
└───────────────────┬─────────────────────────┘
                    ▼
                PostgreSQL
┌─────────────────────────────────────────────┐
│ Domain data + PostgreSQL-backed sessions    │
└─────────────────────────────────────────────┘
```

> **Ana prensip:** Önce anlaşılır, test edilebilir bir modular monolith oluştur. Karmaşıklığı ihtiyaç ortaya çıktıkça ekle. Her teknoloji/pattern gerçek bir problemi çözmeli.
