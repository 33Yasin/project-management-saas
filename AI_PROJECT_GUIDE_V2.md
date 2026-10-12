# Team Project Management SaaS --- V2 AI Development Guide

> Bu dosya V1 `AI_PROJECT_GUIDE.md` dosyasının **V2 eklentisidir**. AI
> önce V1 rehberini, sonra bu dosyayı okumalıdır. Mevcut repository
> gerçeği her zaman ilk taslaktan üstündür.
>
> **V2 kapsamı:** Kanban, drag & drop, attachments, activity history,
> in-app notifications, gerçek invitation email, dark mode, frontend
> integration tests ve kritik Playwright E2E testleri.

## 0. AI çalışma sözleşmesi

1.  Önce V1 rehberini, sonra bu rehberi, ardından mevcut client/server
    kodunu, Prisma schema/migrations, API routes ve testleri incele.
2.  V1'i yeniden yazma; çalışan davranışı koruyarak V2 ekle.
3.  Feature'ları küçük vertical slice'lar halinde geliştir ve her
    feature ile testini birlikte ekle.
4.  Yeni dependency eklemeden önce neden gerektiğini açıkla.
5.  Paket/library seçerken kurulum anındaki resmi dokümantasyondan
    stable sürümü doğrula; RC/beta/experimental sürümü otomatik seçme.
6.  Migration SQL'ini review et; mevcut veriyi riske atan migration'ı
    otomatik kabul etme.
7.  Authorization ve validation backend'de zorunludur.
8.  Redis, WebSocket, queue, microservice gibi altyapıları V2 diye
    otomatik ekleme.
9.  Önemli kararların nedenini kullanıcıya açıkla.
10. Feature sonunda typecheck, lint ve ilgili testleri çalıştır.

## 1. V2 ürün hedefi

``` text
V1: Workspace → Project → Task List → Comments
                         ↓
V2: Workspace → Project → List + Kanban
                         ├─ Drag & Drop
                         ├─ Attachments
                         ├─ Activity History
                         └─ Notifications

Invitation → Real Email
UI → Light + Dark + System
Quality → Frontend Integration + Critical E2E
```

V2'de WebSocket/realtime, Redis, message broker, custom Kanban columns,
multi-assignee, analytics, microservices ve mobile app yoktur.

## 2. Korunan stack

V1 stack aynen korunur: React + TypeScript + Vite, React Router,
TanStack Query, native fetch, React Hook Form + Zod, Tailwind +
shadcn/ui; Node.js + TypeScript + Express, Prisma, PostgreSQL,
server-side session + HttpOnly cookie; Vitest + Supertest.

V2 ekleri: - Drag & drop: kurulum anında resmi stable durumu doğrulanmış
**dnd-kit ekosistemi** tercih edilir. - Frontend tests: Vitest + React
Testing Library + user-event. - E2E: Playwright. - Email: provider
adapter arkasında gerçek email servisi. - Attachment: storage adapter
arkasında production object storage. - Dark mode: shadcn/Tailwind
semantic theme tokens.

## 3. Kanban modeli

V1 status değerleri korunur:

``` text
TODO | IN_PROGRESS | DONE
```

Custom status builder V2'de yoktur.

``` text
┌─────────────┬─────────────┬─────────────┐
│ TODO        │ IN_PROGRESS │ DONE        │
├─────────────┼─────────────┼─────────────┤
│ Task A      │ Task C      │ Task F      │
│ Task B      │ Task D      │             │
└─────────────┴─────────────┴─────────────┘
```

Task başka kolona taşınırsa status değişir; aynı kolonda taşınırsa
yalnız sıralama değişir.

Task'a `position` benzeri ordering alanı eklenir. Exact veri
tipi/algoritma mevcut schema ve veri hacmi incelendikten sonra seçilir.
Başlangıçta anlaşılır çözüm tercih edilir; sırf performanslı göründüğü
için fractional-indexing dependency eklenmez.

Move endpoint:

``` text
PATCH /api/tasks/:taskId/move
```

Kavramsal body:

``` json
{ "status": "IN_PROGRESS", "targetIndex": 2 }
```

Backend authentication, workspace authorization, destination validation,
ordering update ve activity kaydını tutarlı yapar. Client optimistic
update yapabilir; hata durumunda rollback zorunludur.

## 4. Kanban frontend

Project tasks sayfası:

``` text
[List] [Board]
```

View URL'de tutulabilir:

``` text
/projects/:projectId/tasks?view=list
/projects/:projectId/tasks?view=board
```

Board; columns, task cards ve DnD bileşenlerinden oluşur. TanStack Query
server-state source of truth olmaya devam eder. Keyboard
DnD/accessibility, empty-column drop, mobile davranış, loading/error
state test edilir.

## 5. Attachments

Yeni model:

``` text
Attachment
- id
- taskId
- uploadedById
- originalName
- storageKey
- mimeType
- sizeBytes
- createdAt
```

Binary dosya PostgreSQL'e konmaz; DB metadata + storage key tutar.

Production local filesystem source of truth değildir:

``` text
AttachmentService
  ↓
Storage Adapter
  ├─ dev/test adapter
  └─ object-storage adapter
```

Endpoint'ler:

``` text
GET    /api/tasks/:taskId/attachments
POST   /api/tasks/:taskId/attachments
DELETE /api/attachments/:attachmentId
GET    /api/attachments/:attachmentId/download
```

Upload `multipart/form-data`.

Güvenlik: max size, MIME/type allowlist, extension'a tek başına
güvenmeme, opaque storage key, path traversal engeli, download
authorization, user-generated filename'i güvenli render. Başlangıç
allowlist'i common images/PDF/gerekli dokümanlarla sınırlı tutulur.
Storage object + DB row failure handling açıkça tasarlanır.

## 6. Activity history

Activity "ne oldu?" geçmişidir; notification değildir.

``` text
Activity
- id
- workspaceId
- projectId?
- taskId?
- actorId?
- type
- metadata
- createdAt
```

Başlangıç event'leri:

``` text
TASK_CREATED
TASK_UPDATED
TASK_STATUS_CHANGED
TASK_ASSIGNEE_CHANGED
TASK_DELETED
COMMENT_ADDED
COMMENT_DELETED
ATTACHMENT_ADDED
ATTACHMENT_DELETED
PROJECT_CREATED
PROJECT_UPDATED
MEMBER_JOINED
MEMBER_REMOVED
OWNERSHIP_TRANSFERRED
```

`metadata` ana relational verinin yerine geçmez; yalnız event'e özgü
küçük snapshot/detail içindir. Activity immutable'dır; normal
edit/delete endpoint'i yoktur.

İlk UI/API task history ile başlar:

``` text
GET /api/tasks/:taskId/activities?page=1&limit=20
```

## 7. Notifications

V2 **in-app notification** kullanır. WebSocket yoktur. TanStack Query
load/focus refetch; gerekirse makul polling kullanabilir.

``` text
Notification
- id
- userId
- workspaceId
- type
- title
- message
- entityType?
- entityId?
- readAt?
- createdAt
```

İlk notification olayları: task assignment, ownership transfer ve uygun
invitation/user olayları. `@mention` sistemi V2 kapsamına eklenmez.

``` text
GET   /api/notifications?page=1&limit=20
PATCH /api/notifications/:notificationId/read
POST  /api/notifications/read-all
```

User yalnız kendi notification'larını okuyabilir/değiştirebilir.
`readAt=null` unread demektir; ayrıca boolean tutulmaz.

## 8. Event üretim yaklaşımı

Kafka/RabbitMQ/event-bus altyapısı yoktur.

``` text
TaskService
  ├─ domain değişikliği
  ├─ ActivityService.record(...)
  └─ NotificationService.create(...)
```

Birlikte atomik olması gereken DB kayıtları transaction'da tutulur.
Email gibi dış network side-effect'i uzun DB transaction içinde
bekletilmez. Güvenilir async delivery/outbox/queue ihtiyacı gerçek
olursa V3'te değerlendirilir.

## 9. Gerçek email

V1 invitation modeli korunur:

``` text
Invite create
  ↓
high-entropy raw token
  ├─ DB: tokenHash
  └─ Email: invitation URL
```

Email provider business service'lere dağılmaz:

``` text
EmailService → Provider Adapter → Email Provider
```

Email: inviter/workspace adı, CTA ve expiration içerir. Raw token
DB/log'da yoktur; provider secret server-only'dir. Invite endpoint
rate-limit/abuse açısından değerlendirilir. Provider failure kullanıcıya
internal detail sızdırmaz. Test/dev adapter gerçek email göndermek
zorunda değildir. Queue V2 için zorunlu değildir.

## 10. Dark mode

Theme:

``` text
light | dark | system
```

Tercih browser'da persist edilir ve ilk render theme flash azaltılır.
shadcn/Tailwind semantic tokens kullanılır; her component'e hard-coded
light/dark renk dağıtılmaz. Auth, sidebar, dialog, task list, Kanban,
badges, forms, comments, attachments, notifications ve tüm
loading/error/empty state'ler kontrol edilir. Contrast/accessibility
korunur.

## 11. Frontend integration tests

Vitest + React Testing Library + user-event.

Implementation detail değil kullanıcı davranışı test edilir.

Öncelikler: - login form validation/submit/error - task create/edit -
filters - Kanban render - move mutation - optimistic failure rollback -
attachment UI validation - notification read - theme switch -
permission'a göre action görünürlüğü

Network mock stratejisi tek ve tutarlı olmalı. Frontend testleri backend
authorization testlerinin yerine geçmez.

## 12. Playwright E2E

Yalnız kritik journey'ler:

1.  Register/Login → Workspace → Project → Task.
2.  Kanban: TODO → IN_PROGRESS drag; reload sonrası doğru konum.
3.  Invitation: invite fixture/test email → ikinci kullanıcı accept →
    membership.
4.  Attachment: upload → görünür → erişim/download kontrolü.
5.  Authorization: Member owner-only işlemi UI'da yapamaz; doğrudan API
    de reddedilir.

E2E deterministic ve bağımsız olmalı. Production email/storage
provider'a bağımlı test yazılmaz.

## 13. Database migrations

Feature bazlı:

``` text
1. task_ordering
2. attachments
3. activities
4. notifications
```

Her migration'da mevcut data, required column/backfill, index,
referential action ve data-loss riski incelenir. Özellikle mevcut
task'lara `position` eklenirken güvenli backfill gerekir.

Index adayları:

``` text
Task(projectId, status, position)
Attachment(taskId, createdAt)
Activity(taskId, createdAt)
Activity(projectId, createdAt)
Activity(workspaceId, createdAt)
Notification(userId, readAt, createdAt)
```

Bunlar otomatik değil, gerçek query'lere göre review edilir.

## 14. Klasör genişlemesi

Backend:

``` text
server/src/modules/
├── ...V1 modules
├── attachments/
├── activities/
└── notifications/

server/src/lib/
├── db/
├── session/
├── email/
└── storage/
```

Kanban ayrı backend domain olmak zorunda değildir; task move/ordering
`tasks` modülünde kalır.

Frontend:

``` text
client/src/features/
├── ...V1 features
├── tasks/
│   ├── task-list/
│   └── task-board/
├── attachments/
├── activities/
├── notifications/
└── theme/
```

Mevcut V1 klasörleri sırf rehbere birebir uysun diye gereksiz taşınmaz.

## 15. V2 API ekleri

``` text
PATCH  /api/tasks/:taskId/move

GET    /api/tasks/:taskId/attachments
POST   /api/tasks/:taskId/attachments
DELETE /api/attachments/:attachmentId
GET    /api/attachments/:attachmentId/download

GET    /api/tasks/:taskId/activities

GET    /api/notifications
PATCH  /api/notifications/:notificationId/read
POST   /api/notifications/read-all
```

Mevcut invitation-create endpoint'i gerçek email gönderimini
tetikleyecek şekilde genişletilir; contract gereksiz değiştirilmez.

## 16. V2 security checklist

-   [x] move endpoint authorization
-   [x] task başka workspace/project sınırını ihlal edemez
-   [x] attachment size/type kontrolü
-   [x] unsafe filename/path traversal engeli
-   [x] opaque storage key
-   [x] attachment download authorization
-   [x] raw invitation token loglanmıyor
-   [x] email secret server-only
-   [x] invite abuse/rate limit
-   [x] notification ownership
-   [x] activity workspace authorization
-   [x] email/HTML content güvenli escape
-   [x] user-generated filename/content güvenli render
-   [x] dark-mode contrast
-   [x] storage/provider internal error sızmıyor

## 17. Implementation sırası

### V2.0 --- V1 Health Check

V1 tests, typecheck, lint, migrations, schema, API, auth/RBAC kontrol
edilir. **Henüz feature kodu yazılmaz.**

### V2.1 --- Frontend Test Foundation

RTL + user-event; mevcut V1'den 2--3 kritik integration testi. Böylece
V2 UI değişiklikleri öncesi safety net oluşur.

### V2.2 --- Task Ordering Backend

`position` migration/backfill, move service/API,
transaction/authorization ve integration tests.

### V2.3 --- Kanban + Drag & Drop

Board UI, DnD, optimistic update/rollback, keyboard accessibility,
frontend tests. Refresh sonrası sıra/status kalıcı olmalı.

### V2.4 --- Activity History

Model/service, anlamlı event'ler, task history UI ve tests.

### V2.5 --- Attachments

Storage abstraction, model, upload/list/download/delete, güvenlik ve
tests.

### V2.6 --- Notifications

Model/service, assignment/ownership gibi event'ler, inbox UI,
unread/read ve tests.

### V2.7 --- Real Email

Email abstraction/provider, invitation template, failure handling,
dev/test adapter, rate-limit review.

### V2.8 --- Dark Mode

Theme provider/toggle, persistence/system mode, tüm ekranlarda
semantic-token/contrast review.

### V2.9 --- Playwright

Kritik E2E journey'ler; deterministic test data ve fake email/storage.

### V2.10 --- Hardening

Security, accessibility, performance, index/migration review, responsive
Kanban, full tests, docs.

## 18. Definition of Done

Bir V2 feature bitmeden:

-   [x] V1 davranışı bozulmadı
-   [x] migration review edildi
-   [x] backend validation + authorization var
-   [x] error contract tutarlı
-   [x] backend/frontend ilgili testler var
-   [x] loading/error/empty UI var
-   [x] accessibility düşünüldü
-   [x] TypeScript/lint temiz
-   [x] sensitive data/log kontrol edildi
-   [x] dependency gerekçeli
-   [x] gerçek browser akışı kontrol edildi

## 19. V3'e bırakılacaklar

``` text
Redis
WebSocket / realtime presence
Message broker
Background worker fleet
Outbox/event-bus architecture
Custom workflow/status builder
Multi-assignee
Push notifications
Analytics
Microservices
```

V2 sırasında otomatik eklenmez.

## 20. Yeni AI oturumu prompt'u

``` text
Önce proje kökündeki AI_PROJECT_GUIDE.md dosyasını, ardından
AI_PROJECT_GUIDE_V2.md dosyasını tamamen oku.

Sonra mevcut client/server kodunu, Prisma schema/migrations'ı, API route'larını
ve testleri incele. Rehberde yazdığı için V1 kodunun birebir aynı olduğunu
varsayma; mevcut repository gerçeği önceliklidir.

V1 davranışını koru. V2'yi küçük ve test edilebilir vertical slice'lar halinde
geliştir. Yeni dependency eklemeden önce neden gerektiğini açıkla ve kurulum
anındaki stable sürümü resmi dokümantasyondan doğrula.

Şimdi yalnız V2.0 Health Check'i yap. Henüz feature kodu yazma. V1'in mevcut
durumunu, V2'ye geçmeden önce düzeltilmesi gereken sorunları ve ardından
atılacak en küçük mantıklı adımı göster.
```

## 21. Ana prensip

> **V2, V1'i yeniden yazmak değildir.**
>
> Çalışan modular monolith'in üzerine yeni yetenekler eklenir: Kanban
> için task ordering, attachments için storage abstraction, activity
> için immutable history, notifications için user inbox, email için
> provider adapter ve kalite için frontend/E2E testleri.
>
> Her yeni teknoloji gerçek bir V2 problemini çözmelidir.
