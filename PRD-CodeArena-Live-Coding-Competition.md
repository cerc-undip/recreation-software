# PRD: CodeArena — Platform Kompetisi Coding Real-time
*(nama produk sementara, silakan diganti)*

## 1. Ringkasan Produk
Platform kuis interaktif real-time bergaya Quizizz/Kahoot, tapi soalnya berupa problem pemrograman (competitive programming) yang bisa langsung ditulis, di-compile, dan dijalankan oleh peserta — mirip HackerRank. Dipakai untuk event internal dengan ±100 peserta, 3 studi kasus soal (fixed), bahasa terbatas **Python saja**.

## 2. Tujuan
- Peserta bisa join tanpa proses registrasi/login ribet — cukup masukkan kode sesi + username yang sudah didaftarkan admin sebelumnya.
- Admin mengontrol jalannya sesi: mulai sesi, majukan soal (next), lihat leaderboard real-time, akhiri sesi.
- Soal dikerjakan langsung di browser (code editor), dieksekusi di server, dinilai otomatis berdasarkan test case.

## 3. Actor / Role
- **Admin** — satu-satunya role yang login. Bisa: buat sesi, kelola whitelist peserta, kontrol soal aktif, lihat leaderboard, export hasil.
- **Peserta** — tidak login. Masuk pakai kode sesi + username dari whitelist. Kerjakan soal aktif, submit kode, lihat status submission & posisi leaderboard.

## 4. Alur Pengguna (User Flow)

### 4.1 Admin
1. Login ke `/admin/login`.
2. Buat sesi baru (Session) → sistem generate kode sesi unik (misal 6 karakter, contoh `AB12CD`).
3. Tambahkan daftar peserta (input manual / bulk paste / upload CSV kolom `username`) → jadi whitelist.
4. Assign 3 studi kasus (soal preset) ke sesi, tentukan urutannya.
5. Klik "Mulai Sesi" (status: `waiting` → `active`) → soal #1 tampil ke semua peserta.
6. Pantau leaderboard live & progres tiap peserta.
7. Klik "Next Soal" → semua peserta pindah ke soal berikutnya secara bersamaan.
8. Setelah soal ke-3 selesai → klik "Akhiri Sesi" → leaderboard final ditampilkan ke semua peserta.

### 4.2 Peserta
1. Buka URL platform → halaman join (`/join`).
2. Masukkan **kode sesi** + **username** (harus cocok whitelist admin).
3. Jika valid → masuk lobby/waiting room, menunggu admin start.
4. Saat admin start → soal #1 muncul: deskripsi, contoh input/output, code editor Python.
5. Peserta menulis kode → "Run" (test pakai sample input, tidak memengaruhi skor) dan/atau "Submit" (dinilai dengan semua hidden test case).
6. Lihat hasil submission (Accepted / Wrong Answer / Error / Timeout) + skor.
7. Menunggu admin klik next → otomatis pindah ke soal berikutnya.
8. Di akhir sesi → lihat leaderboard final & posisi diri sendiri.

## 5. Functional Requirements

### 5.1 Admin Auth
- FR-1: Login admin pakai username/password (hashed, bcrypt). Cukup 1 akun admin (bisa via env var atau 1 baris di DB), tidak perlu role management kompleks.
- FR-2: Session admin pakai cookie/JWT sederhana.

### 5.2 Manajemen Sesi & Peserta
- FR-3: Admin bisa membuat Session baru dengan kode unik auto-generated.
- FR-4: Admin bisa menambahkan daftar username peserta ke sebuah Session (whitelist) — manual add / bulk paste / CSV upload.
- FR-5: Cegah 2 klien aktif memakai username yang sama dalam 1 Session secara bersamaan (validasi token sederhana per join, tidak perlu strict device-binding).

### 5.3 Join Peserta (Tanpa Login)
- FR-6: Endpoint join memvalidasi kode sesi + username terhadap whitelist. Jika valid, buat token akses (disimpan di localStorage/cookie), tanpa password.
- FR-7: Jika kode sesi salah / username tidak ada di whitelist → tampilkan error yang jelas.

### 5.4 Soal / Studi Kasus
- FR-8: 3 studi kasus tetap (preset), masing-masing berisi: judul, deskripsi, format input, format output, constraints, sample input/output, starter code Python (opsional), daftar hidden test case (input + expected output), time limit eksekusi, bobot poin.
- FR-9: Studi kasus disimpan sebagai seed data di database — bukan dibuat dinamis via UI admin (sesuai requirement "fix study case").

### 5.5 Code Editor & Eksekusi
- FR-10: Peserta menulis kode Python di in-browser code editor (Monaco Editor).
- FR-11: Tombol "Run" → eksekusi dengan sample input saja, tampilkan output (tidak masuk skor, hanya untuk testing).
- FR-12: Tombol "Submit" → eksekusi dengan SEMUA hidden test case, tiap test case dicek `stdout` vs `expected output` (exact match, whitespace-trimmed).
- FR-13: Tiap eksekusi punya time limit (misal 5 detik), diterminasi paksa kalau lewat (cegah infinite loop).
- FR-14: Hasil submission per test case disimpan: status (`AC`/`WA`/`TLE`/`RE`/`CE`), waktu eksekusi, output aktual (untuk debugging admin).

### 5.6 Real-Time Sync Soal
- FR-15: Soal aktif dikontrol terpusat oleh admin di level Session. Semua peserta otomatis ikut pindah tanpa refresh manual — v1 pakai polling interval 2-3 detik (cukup untuk skala 100 peserta).

### 5.7 Leaderboard & Scoring
- FR-16: Skor per soal = `(jumlah test case lolos / total test case) × bobot poin soal`.
- FR-17 (opsional, default ON): Bonus kecepatan untuk submission full-correct tercepat, mirip Kahoot/HackerRank.
- FR-18: Leaderboard real-time: username, total skor, skor per soal, waktu submission terakhir. Auto-refresh via polling.
- FR-19: Admin bisa export leaderboard final ke CSV.

### 5.8 Admin Control Panel
- FR-20: Dashboard admin menampilkan: peserta yang sudah join (online/offline), progres tiap peserta (sedang di soal ke berapa), leaderboard live, tombol Start/Next/End.

## 6. Non-Functional Requirements
- NFR-1: Sanggup handle ±100 peserta aktif bersamaan (concurrent join + submit).
- NFR-2: Keamanan minimal — tidak perlu hardening berlapis (rate limiting ketat, WAF, dll). Fokus utama: sistem jalan stabil.
- NFR-3: Eksekusi kode tetap diberi timeout & batas resource dasar (bukan hardening keamanan, tapi stabilitas dasar — mencegah 1 peserta iseng bikin infinite loop mengganggu peserta lain).
- NFR-4: UI terasa "game show" (mirip Quizizz) — animasi transisi antar soal & saat leaderboard muncul.

## 7. Tech Stack
- **Framework**: Next.js (App Router) — dipakai untuk frontend & backend (Route Handlers) sekaligus, 1 codebase.
- **UI**: shadcn/ui + Tailwind CSS.
- **Animasi**: Three.js (disarankan pakai `@react-three/fiber` biar lebih natural dipadukan dengan React) — untuk transisi antar soal, background efek, efek leaderboard/confetti.
- **Code Editor**: Monaco Editor (`@monaco-editor/react`).
- **Database**: SQLite + Prisma ORM (ringan, file-based, tidak perlu server DB terpisah; gampang upgrade ke PostgreSQL kalau perlu lebih robust nanti).
- **Eksekusi Kode Python**: **Piston** (self-hosted via Docker, open source: github.com/engineer-man/piston). Alasan:
  - Sudah otomatis mengisolasi tiap eksekusi (container-based) → "aman secukupnya" tanpa effort tambahan bikin sandbox sendiri.
  - Next.js kalau di-deploy ke Vercel **tidak punya runtime Python** bawaan, jadi eksekusi kode Python via `child_process` langsung di serverless function tidak akan jalan. Dengan Piston sebagai service terpisah, masalah ini otomatis selesai.
  - ⚠️ Konsekuensi: platform ini **tidak bisa full deploy ke Vercel serverless** — butuh VPS (Next.js + Piston via Docker Compose di 1 VPS, atau Next.js di Vercel + Piston di VPS terpisah dipanggil via HTTP).
- **Realtime sync**: Polling (`useSWR` / `react-query`, interval 2-3 detik) sebagai default v1. Kalau mau upgrade real-time lebih presisi nanti, bisa pakai SSE (Route Handler streaming) atau Pusher/Ably — tidak wajib di v1.
- **Deployment**: VPS + Docker Compose (Next.js app + Piston + volume SQLite).

## 8. Arsitektur Sistem (High-Level)
```
Client (Browser: Peserta/Admin)
  → Next.js App (Pages + API Route Handlers)
     → Prisma → SQLite (Session, Participant, Problem, Submission)
     → HTTP call → Piston Service (container terpisah)
        → eksekusi kode Python → return stdout / stderr / exit code
```

## 9. Data Model (Prisma Schema — garis besar)
```prisma
model Admin {
  id       String @id @default(cuid())
  username String @unique
  password String // hashed
}

model Session {
  id                  String   @id @default(cuid())
  code                String   @unique // kode join, misal "AB12CD"
  status              String   @default("waiting") // waiting | active | ended
  currentProblemIndex Int      @default(0)
  createdAt           DateTime @default(now())
  participants        Participant[]
  problems            ProblemOnSession[]
}

model Participant {
  id          String   @id @default(cuid())
  username    String
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id])
  token       String   @unique // token akses setelah join
  joinedAt    DateTime @default(now())
  submissions Submission[]

  @@unique([sessionId, username])
}

model Problem {
  id           String   @id @default(cuid())
  title        String
  description  String
  inputFormat  String
  outputFormat String
  constraints  String
  sampleInput  String
  sampleOutput String
  starterCode  String?
  timeLimitMs  Int      @default(5000)
  points       Int      @default(100)
  testCases    TestCase[]
}

model TestCase {
  id             String  @id @default(cuid())
  problemId      String
  problem        Problem @relation(fields: [problemId], references: [id])
  input          String
  expectedOutput String
  isSample       Boolean @default(false)
}

model ProblemOnSession {
  id        String  @id @default(cuid())
  sessionId String
  problemId String
  order     Int
  session   Session @relation(fields: [sessionId], references: [id])
}

model Submission {
  id              String   @id @default(cuid())
  participantId   String
  participant     Participant @relation(fields: [participantId], references: [id])
  problemId       String
  code            String
  status          String   // AC | WA | TLE | RE | CE | PENDING
  score           Int      @default(0)
  testCasesPassed Int      @default(0)
  totalTestCases  Int      @default(0)
  executionTimeMs Int?
  submittedAt     DateTime @default(now())
  isRunOnly       Boolean  @default(false) // true kalau ini "Run" bukan "Submit"
}
```

## 10. API Endpoints (Route Handlers)

**Admin**
- `POST /api/admin/login`
- `POST /api/admin/session` — buat session baru
- `POST /api/admin/session/[id]/participants` — tambah whitelist username
- `POST /api/admin/session/[id]/start`
- `POST /api/admin/session/[id]/next`
- `POST /api/admin/session/[id]/end`
- `GET /api/admin/session/[id]/leaderboard`
- `GET /api/admin/session/[id]/export`

**Peserta**
- `POST /api/join` — body: `{ sessionCode, username }` → return token
- `GET /api/session/state` — poll status sesi (soal aktif, status waiting/active/ended)
- `GET /api/problem/current` — detail soal yang sedang aktif
- `POST /api/submit` — body: `{ problemId, code, isRunOnly }` → eksekusi via Piston, return hasil
- `GET /api/leaderboard` — leaderboard real-time (read-only)

## 11. Halaman (Routing)
- `/join` — halaman masuk peserta (kode sesi + username)
- `/play` — halaman utama peserta: soal + editor + hasil
- `/play/leaderboard` — leaderboard (muncul otomatis di antara soal / saat sesi berakhir)
- `/admin/login`
- `/admin/dashboard` — kontrol sesi & progres peserta
- `/admin/leaderboard`

## 12. Sistem Scoring (Default — bisa disesuaikan)
- Skor per soal = `(jumlah test case lolos / total test case) × points soal`.
- (Opsional) Bonus kecepatan untuk submission full-correct tercepat.
- Total skor peserta = akumulasi skor dari 3 soal.
- Leaderboard diurutkan: total skor desc, lalu waktu submission tercepat sebagai tie-breaker.

## 13. Environment Variables (saran)
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="..."
ADMIN_DEFAULT_USERNAME="admin"
ADMIN_DEFAULT_PASSWORD="..."   # untuk seed awal
PISTON_API_URL="http://localhost:2000"  # atau URL VPS Piston
```

## 14. Saran Urutan Implementasi (untuk AI coding agent)
1. Setup project Next.js (App Router) + Tailwind + shadcn/ui.
2. Setup Prisma + SQLite, definisikan schema di atas, jalankan migration.
3. Buat seed script untuk: 1 admin default, 3 Problem + TestCase-nya (data soal disiapkan terpisah).
4. Implementasi Admin Auth (login + middleware proteksi `/admin/*`).
5. Implementasi CRUD Session + whitelist Participant (admin).
6. Implementasi flow Join peserta (`/join` + `/api/join`).
7. Setup Piston (docker-compose) + buat wrapper function `runCode(code, input, timeLimitMs)`.
8. Implementasi halaman `/play` dengan Monaco Editor + tombol Run/Submit → integrasi ke endpoint `/api/submit`.
9. Implementasi polling state sesi (`/api/session/state`, `/api/problem/current`) di sisi peserta.
10. Implementasi Admin Dashboard: Start/Next/End + live progres peserta.
11. Implementasi Leaderboard (peserta & admin) + export CSV.
12. Tambahkan animasi Three.js (transisi soal, efek leaderboard) menggunakan `@react-three/fiber`.
13. Basic load test dengan simulasi ~100 klien submit bersamaan.

## 15. Out of Scope (v1)
- Tidak ada registrasi mandiri peserta (semua via whitelist admin).
- Tidak ada dukungan bahasa selain Python.
- Tidak ada sistem anti-cheat / code similarity checker.
- Tidak ada hardening keamanan lanjutan (rate limiting ketat, WAF, static analysis kode sebelum eksekusi, dll) — cukup isolasi dasar via Piston + timeout eksekusi.

## 16. Asumsi
- 3 studi kasus soal + test case-nya disiapkan terpisah sebagai seed data; PRD ini hanya mendefinisikan strukturnya.
- Deployment target: VPS dengan Docker (bukan Vercel serverless), karena kebutuhan Piston untuk eksekusi Python.
- Real-time sync soal antar peserta memakai polling (bukan WebSocket) di v1, cukup untuk skala 100 peserta.
- 1 akun admin sudah cukup, tidak perlu multi-admin/role granular.

## 17. Kriteria Sukses (Acceptance Criteria)
- [ ] Peserta bisa join hanya dengan kode sesi + username terdaftar, tanpa password.
- [ ] Admin start sesi → semua peserta melihat soal #1 bersamaan (<5 detik dari klik start).
- [ ] Peserta bisa Run kode Python dan melihat output sample.
- [ ] Peserta bisa Submit kode dan mendapat penilaian otomatis dari hidden test case.
- [ ] Admin klik "Next" memindahkan semua peserta ke soal berikutnya secara sinkron.
- [ ] Leaderboard live terupdate otomatis setiap ada submission baru.
- [ ] Sistem tetap stabil saat ±100 peserta submit dalam rentang waktu berdekatan.
