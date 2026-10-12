# V3 — Scaling & Learning Roadmap

> **Amaç:** V1 ve V2'de tamamlanan proje yönetim uygulamasını ölçeklenebilirlik, güvenilirlik, operasyon ve üretim ortamı açısından geliştirmek. Bu faz aynı zamanda ileri backend/DevOps konularını uygulamalı öğrenmek içindir.

## Mevcut mimari ve varsayımlar

- **Frontend:** React
- **Backend:** Node.js / Express
- **Veritabanı:** PostgreSQL (Neon)
- **Hosting:** Render (frontend ve backend)
- **Ürün:** Workspace → Project → Task; üyelik/yetkilendirme, Kanban, attachments, notifications gibi V2 özellikleri

> V3'teki tüm altyapıları aynı anda eklemek zorunlu değildir. Her aşamada önce problemi ölç, sonra uygun çözümü uygula.

## V3.1 — Baseline, Metrics & Load Testing

**Hedef:** Optimizasyon öncesi mevcut performansı ölçmek.

- Kritik akışları seç: login, workspace/project listeleme, task listesi, Kanban move, attachment metadata.
- p50/p95 yanıt süresi, hata oranı, DB sorgu süresi ve istek hacmini izle.
- k6 veya Artillery ile tekrarlanabilir yük testleri oluştur.
- Test verisi ve makul performans hedefleri tanımla.

**Çıktı:** Ölçüm raporu ve iyileştirme öncelikleri.

**Tamamlanma kriteri:** Aynı senaryo tekrar çalıştırıldığında önce/sonra karşılaştırması yapılabiliyor.

## V3.2 — Redis & Caching

**Hedef:** Sık okunan verilerin gereksiz DB sorgularını azaltmak.

- Redis bağlantısını ortam değişkenleriyle yapılandır.
- Cache-aside yaklaşımını uygun read endpoint'lerinde uygula.
- TTL ve invalidation kuralları tanımla (task/project değişince ilgili cache temizlensin).
- Workspace/project bazlı cache key tasarla; kullanıcıya özel ve yetki gerektiren verileri yanlışlıkla paylaşma.
- Redis kullanılamadığında DB üzerinden çalışmaya devam et (uygun endpoint'lerde).
- Cache hit/miss metriklerini ölç.

**Çıktı:** Seçili endpoint'lerde ölçülebilir cache faydası.

**Testler:** Cache hit/miss, TTL, invalidation, tenant isolation, Redis kesintisi.

## V3.3 — Background Jobs & Email Queue

**Hedef:** Email ve uzun süren işleri HTTP request'inden ayırmak.

- Redis tabanlı kuyruk (ör. BullMQ) ve ayrı worker süreci ekle.
- Invite email, notification email ve gerekiyorsa dosya işleme işlerini kuyruğa al.
- Retry + exponential backoff, başarısız iş takibi ve idempotency uygula.
- İşlerin duplicate gönderim üretmemesi için güvenli iş anahtarları/işleme mantığı tasarla.
- Worker deployment ve shutdown davranışını yapılandır.

**Çıktı:** API hızlı cevap verirken email gönderimi arka planda işleniyor.

**Testler:** Retry, duplicate job, worker restart, email provider failure.

## V3.4 — WebSocket / Real-time Updates

**Hedef:** Ekip üyelerinin değişiklikleri sayfayı yenilemeden görmesi.

- Socket.IO veya native WebSocket seç; önce ihtiyaçları belirle.
- Task create/update/move ve ilgili bildirimler için event sözleşmesi oluştur.
- Bağlantıda kimlik doğrulama ve workspace/project erişim kontrolü uygula.
- Room bazlı yayın yap; başka workspace'e veri sızdırma.
- Reconnect ve kaçırılan event'ler için yeniden veri çekme stratejisi ekle.
- Birden fazla backend instance kullanılırsa pub/sub veya uygun adapter ihtiyacını değerlendir.

**Çıktı:** İki tarayıcı oturumunda task değişiklikleri canlı görünüyor.

**Testler:** Yetkisiz abonelik, reconnect, event sırası, çoklu kullanıcı.

## V3.5 — Analytics & Product Insights

**Hedef:** Ürün kullanımını ve proje ilerlemesini anlamak.

- İlk metrikler: tamamlanan task sayısı, status dağılımı, geciken task'lar, proje aktivitesi.
- Dashboard için aggregate sorgular veya uygun özet tablolar oluştur.
- Gerekliyse event tracking tasarla; kişisel veriyi asgari düzeyde topla.
- Tarih aralığı ve workspace/project filtreleri ekle.
- Büyük veri kümelerinde ağır sorguları ölç ve optimize et.

**Çıktı:** Workspace/project bazlı temel analytics dashboard.

**Testler:** Sayım doğruluğu, tarih filtresi, tenant isolation.

## V3.6 — PostgreSQL Optimization

**Hedef:** Artan veri hacminde sorguları verimli tutmak.

- `EXPLAIN (ANALYZE, BUFFERS)` ile yavaş sorguları incele.
- Workspace/project/status/position ve tarih filtrelerine göre uygun composite index'leri değerlendir.
- N+1 query sorunlarını tespit et.
- Connection pool ayarlarını Neon/Render limitlerine göre düzenle.
- Migration güvenliği, rollback planı ve backup/restore prosedürlerini gözden geçir.
- Gereksiz indekslerin write maliyetini de değerlendir.

**Çıktı:** Kritik sorgular için ölçülmüş iyileştirmeler.

**Testler:** Migration testi, veri bütünlüğü, performans karşılaştırması.

## V3.7 — Cursor Pagination

**Hedef:** Büyük task/activity/notification listelerini verimli sayfalamak.

- Offset pagination ile cursor pagination farkını öğren.
- Kararlı sıralama kullan: ör. `(created_at DESC, id DESC)`.
- `limit`, `nextCursor`, `hasMore` içeren API yanıtı tasarla.
- Cursor'ı güvenli biçimde encode/decode et ve filtrelerle uyumunu sağla.
- Frontend'de Load More veya infinite scroll ekle.

**Örnek API:** `GET /api/projects/:projectId/tasks?limit=20&cursor=...`

**Çıktı:** Büyük listelerde kararlı ve verimli sayfalama.

**Testler:** Aynı timestamp, silinen/eklenen kayıtlar, geçersiz cursor, yetki kontrolü.

## V3.8 — Docker & Local Development

**Hedef:** Tekrarlanabilir geliştirme ortamı kurmak.

- Backend için çok aşamalı Dockerfile oluştur.
- Docker Compose ile backend + PostgreSQL + Redis + worker çalıştır.
- Healthcheck, volume, environment ve secret yönetimini yapılandır.
- Neon/Render production mimarisi ile local Docker ortamının farklarını belgele.
- Container'ları non-root kullanıcıyla çalıştırmayı değerlendir.

**Çıktı:** Yeni geliştirici belgelenmiş komutlarla ortamı ayağa kaldırabiliyor.

**Testler:** Clean setup, migration, restart, worker bağlantısı.

## V3.9 — Advanced CI/CD

**Hedef:** Kod değişikliklerini güvenli ve otomatik yayımlamak.

- GitHub Actions pipeline: lint → typecheck → unit/integration → build → E2E.
- PostgreSQL ve Redis servisleriyle CI integration testleri çalıştır.
- Migration kontrolü ve deployment öncesi doğrulama ekle.
- Preview/staging ortamı ve protected main branch yapılandır.
- Secrets yönetimi, dependency audit ve gerektiğinde rollback prosedürü ekle.

**Çıktı:** Başarısız testlerin deployment'ı engellediği pipeline.

**Testler:** Hatalı PR, başarısız migration, deploy/rollback provası.

## V3.10 — Observability & Performance Hardening

**Hedef:** Production sorunlarını hızlı tespit edip analiz edebilmek.

- Yapılandırılmış loglar ve request/correlation ID kullan.
- Hata izleme (ör. Sentry), metrikler ve temel alert'ler ekle.
- API latency, error rate, DB pool, queue depth, job failure, cache hit rate izle.
- Frontend Web Vitals ve bundle boyutunu kontrol et.
- Rate limit, timeout, retry ve graceful shutdown davranışlarını gözden geçir.
- PII, token ve şifrelerin loglara düşmesini engelle.

**Çıktı:** Sorun olduğunda hangi servis ve akışın etkilendiği görülebiliyor.

**Testler:** Simüle API hatası, worker kesintisi, yavaş sorgu, alarm doğrulaması.

---

## Önerilen uygulama sırası

1. **V3.1 Baseline** — Önce ölç.
2. **V3.6 DB Optimization + V3.7 Cursor Pagination** — Veri erişimini iyileştir.
3. **V3.2 Redis/Cache** — Ölçülen ihtiyaç varsa cache ekle.
4. **V3.3 Background Jobs** — Email ve asenkron işleri ayır.
5. **V3.4 WebSocket** — Canlı ekip deneyimini geliştir.
6. **V3.5 Analytics** — Ürün içgörülerini sun.
7. **V3.8 Docker + V3.9 CI/CD** — Geliştirme ve yayınlama süreçlerini olgunlaştır.
8. **V3.10 Observability** — Tüm aşamalarda kademeli kur, finalde gözden geçir.

## V3 Definition of Done

- [ ] Kritik API akışları için ölçüm ve yük testi mevcut.
- [ ] Cache kullanılıyorsa invalidation ve yetki izolasyonu test edilmiş.
- [ ] Arka plan işleri retry/idempotency ile güvenilir çalışıyor.
- [ ] Real-time event'lerde workspace/project erişim sınırları korunuyor.
- [ ] Analytics verileri doğrulanmış.
- [ ] Kritik PostgreSQL sorguları incelenmiş ve gerekli indeksler eklenmiş.
- [ ] Büyük listelerde pagination çalışıyor.
- [ ] Docker ile local kurulum belgelenmiş.
- [ ] CI/CD testleri ve migration kontrolleri çalışıyor.
- [ ] Log, hata izleme, temel metrikler ve alarm stratejisi mevcut.
- [ ] README, `.env.example`, mimari notları ve deployment dokümanları güncel.

## Notlar

- **Render Free:** Uykuya geçen servisler worker ve sürekli WebSocket bağlantıları için uygun olmayabilir; seçilen hosting planının davranışını doğrula.
- **Redis:** Cache ve queue aynı teknolojiye dayanabilir ama kullanım amaçları, veri saklama ve güvenilirlik ihtiyaçları farklıdır.
- **Güvenlik:** Multi-tenant uygulamada her yeni API, cache key, event ve job için workspace/project authorization kontrolü gerekir.
- **Maliyet:** Redis, worker, object storage, observability ve staging servislerinin ücretsiz limitlerini deployment öncesi ayrıca kontrol et.
