# Profil ve Senkron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcının planını private bir GitHub reposundaki `profile.json`'da tutmak ve cihazlar arası senkronlamak; token yokken site bugünkü gibi localStorage ile çalışmaya devam eder.

**Architecture:** Bellekteki şekil bugünkü `UserState` olarak kalır; `profile.ts` saf dönüştürücülerle `UserState ⇄ Profile` çevirir (cihaza özel `lang`/`theme` profile girmez). `github.ts` Contents API'yi sarar; `engine.ts` debounce'lu kaydetme, `sha` çakışmasında bekleyen güncelleyicileri (`update(fn)`'e verilen `fn`'ler) uzak profilin üstüne yeniden uygulama, çevrimdışı cache ve durum yönetimini yapar. `useAppState` motoru kullanır; üst bara durum göstergesi ve ayar penceresi eklenir.

**Tech Stack:** Preact + TypeScript + vitest; GitHub REST API (`fetch`, fine-grained PAT).

**Spec:** `docs/superpowers/specs/2026-10-22-personal-roadmap-career-design.md` (§2.2 profil, §3 senkron, §7 aşama 2)

## Global Constraints

- Profil reposu varsayılanı `efe-atas/kitcanavari-me`, dosya `profile.json`; ayar ekranında değiştirilebilir.
- İstekler: `https://api.github.com/repos/{owner}/{repo}/contents/profile.json`, başlıklar `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`. `GET` için `cache: 'no-store'`.
- Kaydetme: son değişiklikten **3 sn** sonra `PUT`; commit mesajı `profile: update from <cihaz kısa adı>` (cihaz adı = `navigator.platform` ya da `web`).
- Çakışma (HTTP 409 veya 422 + sha uyuşmazlığı): güncel dosyayı çek, bekleyen güncelleyicileri yeniden uygula, tekrar gönder; **3** başarısız denemede durum `conflict`, kullanıcı "yerel sürümü yaz / sunucudakini al" seçer.
- 401/403 → durum `auth` ("token geçersiz/süresi dolmuş"). 404 (dosya yok) → yerel durumdan dosyayı oluştur.
- Token ve repo ayarı yalnız localStorage'da (`kitcanavari:sync`); token hiçbir URL'ye, log'a, profile yazılmaz.
- Token yokken davranış bugünküyle birebir aynı (`kitcanavari:v1`).
- İlk bağlantıda uzakta dosya yoksa mevcut localStorage planı profile taşınır; `kitcanavari:v1` silinmez (yedek kalır).
- Profil `version: 1`; `isProfile` geçmeyen uzak dosya **üzerine yazılmaz** → durum `error` + mesaj.
- Kullanıcıya görünen metinler `tr` + `en`.

## Review Focus

- İki cihazdan peş peşe değişiklik: B'nin `PUT`'u eski `sha` ile 409 alır → A'nın değişikliği kaybolmadan B'ninki üstüne eklenmeli. *(Task 3 `replays pending updates on conflict`)*
- Ağ yokken değişiklik → sayfa yenilense bile kaybolmamalı, bağlantı gelince gönderilmeli. *(Task 3 `offline changes survive reload`)*
- Uzaktaki dosya bozuk/elle düzenlenmiş → site onu sessizce ezmemeli. *(Task 3 `invalid remote is never overwritten`)*
- Türkçe karakterli not/başlık → base64 UTF-8 gidiş-dönüşte bozulmamalı. *(Task 2 `round-trips non-ASCII`)*
- Token yanlış → kullanıcı açık bir mesaj görmeli, yerel düzenleme çalışmaya devam etmeli. *(Task 4 `shows auth error and keeps editing`)*

---

### Task 1: Profil modeli ve dönüştürücüler

**Files:**
- Create: `web/src/sync/profile.ts`
- Test: `web/tests/profile.test.ts`

**Interfaces:**
- Produces:
  - `type TermId = string` (`'WS26' | 'SS27' | …` ya da `'prior'`), `type ModuleStatus = 'planned' | 'passed' | 'failed' | 'dropped'`
  - `interface ProfileModule { term: TermId; status: ModuleStatus; countAs: string | null; grade: number | null }`
  - `interface Profile { version: 1; areas: string[]; terms: string[]; modules: Record<string, ProfileModule>; weekly: Record<string, Omit<SelectedEntry, 'countAs'>>; lastSeenScrapedAt: string; followed: { role: string; lens: string }[]; notes: Record<string, string> }`
  - `CURRENT_TERM = 'WS26'`, `DEFAULT_TERMS = ['WS26', 'SS27', 'WS27', 'SS28']`
  - `emptyProfile(): Profile`, `isProfile(x: unknown): x is Profile`
  - `profileFromState(s: UserState, prev: Profile | null): Profile` — `weekly` = `selected` (countAs çıkarılır); `modules`: `prev`'in `CURRENT_TERM`+`planned` dışındaki girdileri korunur, `selected`'daki her `moduleId` için `{ term: CURRENT_TERM, status: 'planned', countAs: entry.countAs ?? null, grade: null }` yazılır; `terms`, `followed`, `notes` `prev`'den (yoksa varsayılan).
  - `stateFromProfile(p: Profile, device: Pick<UserState, 'lang' | 'theme'>): UserState` — `selected` = `weekly` + her girdiye `modules[moduleId]?.countAs` (null değilse) geri eklenir.

- [ ] **Step 1: Failing testler**
```ts
test('round-trips a state through a profile', () => {
  const s: UserState = { version: 1, lang: 'tr', theme: 'dark', lastSeenScrapedAt: 'x', areas: ['Telematics'],
    selected: { e1: { enabledSlots: [0], moduleId: 'M1', ackFingerprint: 'f', title: 'Çizge', countAs: 'elective' } } }
  const p = profileFromState(s, null)
  expect(p.modules.M1).toEqual({ term: 'WS26', status: 'planned', countAs: 'elective', grade: null })
  expect(p.weekly.e1).not.toHaveProperty('countAs')
  expect(p).not.toHaveProperty('lang')
  expect(stateFromProfile(p, { lang: 'tr', theme: 'dark' })).toEqual(s)
})
test('keeps other terms, passed modules, notes and followed from the previous profile', () => {
  const prev = { ...emptyProfile(), notes: { M9: 'iyi hoca' }, followed: [{ role: 'ml-eng', lens: 'bigtech' }],
    modules: { M9: { term: 'prior', status: 'passed', countAs: null, grade: 1.3 }, M8: { term: 'SS27', status: 'planned', countAs: null, grade: null },
      OLD: { term: 'WS26', status: 'planned', countAs: null, grade: null } } } as Profile
  const p = profileFromState({ ...defaultState(), selected: {} }, prev)
  expect(Object.keys(p.modules).sort()).toEqual(['M8', 'M9'])   // dropped from the weekly plan → gone from WS26
  expect(p.notes).toEqual({ M9: 'iyi hoca' }); expect(p.followed).toHaveLength(1)
})
test('isProfile rejects other versions and malformed modules', () => {
  expect(isProfile(emptyProfile())).toBe(true)
  expect(isProfile({ ...emptyProfile(), version: 2 })).toBe(false)
  expect(isProfile({ ...emptyProfile(), modules: { M1: { term: 'WS26' } } })).toBe(false)
})
```
- [ ] **Step 2:** `cd web && npx vitest run tests/profile.test.ts` → FAIL (modül yok)
- [ ] **Step 3:** `profile.ts`'i yaz (`isProfile`, `store.ts`'deki `isState` ile aynı tarzda alan alan doğrular).
- [ ] **Step 4:** `npx vitest run && npx tsc -b` → PASS
- [ ] **Step 5:** `git commit -m "feat(web): profile model and state conversion"`

### Task 2: GitHub Contents istemcisi

**Files:**
- Create: `web/src/sync/github.ts`
- Test: `web/tests/github.test.ts`

**Interfaces:**
- Produces:
  - `interface SyncConfig { owner: string; repo: string; token: string }`
  - `class AuthError extends Error {}`, `class ConflictError extends Error {}`, `class InvalidRemoteError extends Error {}`, `class OfflineError extends Error {}` (fetch'in `TypeError`'ı buna çevrilir)
  - `getProfile(cfg: SyncConfig, f?: typeof fetch): Promise<{ profile: Profile; sha: string } | null>` — 404 → `null`; içerik `isProfile` değilse `InvalidRemoteError`.
  - `putProfile(cfg: SyncConfig, profile: Profile, sha: string | null, message: string, f?: typeof fetch): Promise<string>` — yeni `content.sha`'yı döner; 409 ve 422 → `ConflictError`; 401/403 → `AuthError`; diğer → `Error(\`GitHub ${status}\`)`.
  - Base64: `TextEncoder`/`TextDecoder` ile UTF-8; JSON `JSON.stringify(profile, null, 1) + '\n'`.

- [ ] **Step 1: Failing testler** (sahte `fetch` = istekleri kaydeden ve hazır `Response` dönen fonksiyon)
  - `round-trips non-ASCII`: `putProfile` gövdesindeki `content` decode edilince `notes.M1 === 'Çok iyi ğüşıö'`; aynı base64 `getProfile`'a verilince profil eşit.
  - `sends auth headers and no-store`: URL `https://api.github.com/repos/o/r/contents/profile.json`, `Authorization: Bearer t`, GET'te `cache: 'no-store'`; PUT gövdesinde `sha` yalnız verilince var.
  - `maps statuses`: GET 404 → `null`; PUT 409 ve 422 → `ConflictError`; 401 → `AuthError`; `fetch` `TypeError` fırlatınca → `OfflineError`; geçersiz JSON içerik → `InvalidRemoteError`.
- [ ] **Step 2:** `npx vitest run tests/github.test.ts` → FAIL
- [ ] **Step 3:** `github.ts`'i yaz.
- [ ] **Step 4:** `npx vitest run && npx tsc -b` → PASS
- [ ] **Step 5:** `git commit -m "feat(web): GitHub contents client for the profile"`

### Task 3: Senkron motoru

**Files:**
- Create: `web/src/sync/engine.ts`
- Test: `web/tests/engine.test.ts`

**Interfaces:**
- Consumes: Task 1 dönüştürücüleri, Task 2 istemcisi (enjekte edilir).
- Produces:
  - `type SyncStatus = 'off' | 'loading' | 'saved' | 'pending' | 'saving' | 'offline' | 'auth' | 'conflict' | 'error'`
  - `interface EngineDeps { get: (cfg) => ReturnType<typeof getProfile>; put: typeof putProfile; storage: Storage | null; setTimer: (fn: () => void, ms: number) => unknown; clearTimer: (h: unknown) => void; device: string }`
  - `class SyncEngine { constructor(cfg: SyncConfig, deps: EngineDeps, onState: (s: UserState) => void, onStatus: (s: SyncStatus, detail?: string) => void); start(local: UserState): Promise<void>; record(fn: (s: UserState) => UserState, next: UserState): void; flush(): Promise<void>; resolveConflict(keep: 'local' | 'remote'): Promise<void>; retry(): Promise<void> }`
  - Cache anahtarı `kitcanavari:profile-cache` → `{ profile, sha, dirty: boolean }`.

Davranış:
- `start`: cache varsa önce ondan `onState`; sonra `get`. Uzak `null` → `profileFromState(local, null)` ile oluştur (`put`, sha `null`). Uzak var ve cache `dirty` değil → `onState(stateFromProfile(remote))`. Cache `dirty` → yerel cache profilini uzak `sha` ile göndermeyi dener (çakışırsa `conflict`, çünkü yeniden uygulanacak güncelleyici yok).
- `record`: güncelleyiciyi `pending`'e ekler, cache'i `dirty: true` ile yazar, 3 sn'lik zamanlayıcıyı yeniden kurar, durum `pending`.
- `flush` (zamanlayıcı): `put(profileFromState(current, base))`; başarı → `sha` güncellenir, `pending` boşalır, cache `dirty: false`, `saved`. `ConflictError` → `get` + `pending` güncelleyicileri `stateFromProfile(remote)`'a sırayla uygulanır → `onState(merged)` → tekrar `put`; 3 denemede olmazsa `conflict`. `OfflineError` → `offline`, `window` `online` olayında `retry`. `AuthError` → `auth`. `InvalidRemoteError` → `error` (hiç `put` yapılmaz).
- `resolveConflict('local')` → güncel `sha`'yı al, yerel profili yaz. `'remote'` → `pending`'i at, uzak profili uygula.

- [ ] **Step 1: Failing testler** (sahte `get`/`put` bellekte bir "sunucu" tutar: `{ profile, sha }`, her `put`'ta sha artar; zamanlayıcı elle tetiklenir)
  - `creates the remote profile from local state on first connect`: sunucu boş → `start(stateWith e1)` → sunucuda `weekly.e1` var, durum `saved`.
  - `debounces saves`: iki `record` → `put` çağrılmadı; zamanlayıcı tetiklenince tek `put`.
  - `replays pending updates on conflict`: sunucu başka cihazdan `areas: ['Telematics']` aldı (sha ilerledi); yerelde `record(addEvent e2)` + flush → sunucuda hem `areas` hem `weekly.e2`; `onState` birleşik durumla çağrıldı.
  - `gives up after three conflicts`: `put` hep `ConflictError` → durum `conflict`; `resolveConflict('remote')` → `onState(sunucu durumu)`, `pending` boş.
  - `offline changes survive reload`: `put` `OfflineError` → durum `offline`, cache `dirty: true`; yeni motor aynı storage ile `start` → cache'teki değişiklik sunucuya yazılır.
  - `invalid remote is never overwritten`: `get` `InvalidRemoteError` → durum `error`, `put` hiç çağrılmadı.
  - `auth error keeps local state`: `put` `AuthError` → durum `auth`, `onState` çağrılmadı, cache `dirty: true`.
- [ ] **Step 2:** `npx vitest run tests/engine.test.ts` → FAIL
- [ ] **Step 3:** `engine.ts`'i yaz.
- [ ] **Step 4:** `npx vitest run && npx tsc -b` → PASS
- [ ] **Step 5:** `git commit -m "feat(web): profile sync engine with conflict replay and offline cache"`

### Task 4: Uygulamaya bağlama — ayarlar, durum göstergesi

**Files:**
- Modify: `web/src/store.ts` (`useAppState` motoru kullanır; `loadSyncConfig`/`saveSyncConfig`/`clearSync`)
- Create: `web/src/ui/sync/SyncDialog.tsx`, `web/src/ui/sync/SyncStatus.tsx`
- Modify: `web/src/ui/App.tsx`, `web/src/i18n.ts`, `web/src/styles.css`, `web/src/ui/Icon.tsx` (gerekirse `cloud` ikonu)
- Modify: `README.md` (kurulum adımları)
- Test: `web/tests/sync-ui.test.tsx`

**Interfaces:**
- Consumes: `SyncEngine`, `SyncStatus`, `SyncConfig`, `getProfile`, `putProfile`.
- Produces: `useAppState(): [UserState, update, persistent, sync: { status: SyncStatus; detail?: string; config: SyncConfig | null; connect(cfg): void; disconnect(): void; resolve(keep): void; retry(): void }]`
  - `loadSyncConfig(storage): SyncConfig | null`, `saveSyncConfig(storage, cfg)`, `clearSync(storage)` (ayar + cache silinir; `kitcanavari:v1` kalır).

Davranış:
- Config yoksa: `sync.status === 'off'`, davranış bugünküyle aynı. Config varsa: `update(fn)` hem yerel durumu/`kitcanavari:v1`'i günceller hem `engine.record(fn, next)`. Motor `onState` ile durumu değiştirdiğinde `lang`/`theme` mevcut cihazdan korunur.
- Üst barda `SyncStatus` düğmesi: ikon + kısa metin (`sync.saved` "Kaydedildi", `sync.pending` "Kaydediliyor…", `sync.offline` "Çevrimdışı", `sync.auth` "Token geçersiz", `sync.conflict` "Çakışma", `sync.error` "Senkron hatası", `sync.off` "Senkron kapalı"); tıklayınca `SyncDialog`.
- `SyncDialog`: repo alanı (`owner/repo`, varsayılan `efe-atas/kitcanavari-me`), token alanı (`type="password"`, `autocomplete="off"`), "Bağlan", bağlıyken "Bağlantıyı kes"; `conflict` durumunda iki düğme ("Bu cihazdakini yaz" / "Sunucudakini al"); `auth`/`error`'da açıklama + "Tekrar dene". Token kurulumu için kısa yönerge ve GitHub fine-grained token sayfasına bağlantı (`https://github.com/settings/personal-access-tokens/new`).
- README: "Profil senkronu" bölümü — private repo oluşturma, fine-grained token (yalnız bu repo, *Contents: Read and write*), siteye yapıştırma.

- [ ] **Step 1: Failing UI testleri** (`loadData` ve `fetch` mock'lanır; `fetch` bellekte bir sunucu taklit eder)
  - `connects and saves the plan to the profile repo`: dialogda repo + token girilir → Bağlan → katalogdan ders eklenir → `vi.advanceTimersByTime(3000)` → sunucu profilinde `weekly` dersi içerir; gösterge "Saved".
  - `shows auth error and keeps editing`: sunucu 401 → gösterge "Token invalid"; ders eklemek hâlâ çalışır ve `kitcanavari:v1`'e yazılır.
  - `without a config the app never calls GitHub`: hiçbir `fetch` çağrısı `api.github.com` içermez.
- [ ] **Step 2:** `npx vitest run tests/sync-ui.test.tsx` → FAIL
- [ ] **Step 3:** Uygula.
- [ ] **Step 4:** `npx vitest run && npm run build` → PASS
- [ ] **Step 5:** `git commit -m "feat(web): sync the plan to a private GitHub profile repo"`

### Task 5: Gerçek repo ile uçtan uca deneme (kullanıcıyla)

Kod değişikliği yok; kullanıcı adımları gerektirir.

- [ ] **Step 1:** Kullanıcı private repo `efe-atas/kitcanavari-me`'yi oluşturur (ya da onay verirse `gh repo create efe-atas/kitcanavari-me --private`).
- [ ] **Step 2:** Kullanıcı fine-grained token oluşturur (yalnız bu repo, Contents: Read and write) ve yerel dev sunucusunda (`npm run dev`) ayar penceresine kendisi yapıştırır. (Claude token girmez.)
- [ ] **Step 3:** Doğrula: bir ders ekle → ~3 sn sonra `gh api repos/efe-atas/kitcanavari-me/contents/profile.json --jq .content | base64 -d | head` dersin `weekly`'de olduğunu gösterir; başka bir tarayıcı profilinde aynı token ile bağlanınca plan görünür.
