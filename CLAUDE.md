@AGENTS.md

# Project Command Center — UX Implementācijas plāns

> **Instrukcija Claude Code:** Strādā stingri pa vienam uzdevumam. Pirms sāc nākamo — pārliecinies, ka iepriekšējais ir pilnībā pabeigts un kods kompilējas bez kļūdām. Atzīmē pabeigtos uzdevumus ar [x].

---

## FĀZE 1 — Navigācija (9 → 6 sadaļas)

**Mērķis:** Samazināt sānjoslas kognitīvo slodzi, grupējot saistītās sadaļas.

- [x] **1.1** Izveido `<PlanningDropdown>` apakšizvēlni ar iekšā: Streams, Tasks, Milestones
- [x] **1.2** Izveido `<AnalyticsDropdown>` apakšizvēlni ar iekšā: KPIs, Reports
- [x] **1.3** Apvieno Team + Profiles vienā sadaļā `Team`
- [x] **1.4** Pārbaudi, ka visi esošie routes joprojām darbojas pēc navigācijas pārkārtošanas
- [x] **1.5** Vizuāli tests — mobilais un desktop sānjoslas skats

---

## FĀZE 2 — Projekta konteksts (URL-first)

**Mērķis:** Novērst situāciju, kad jaunā cilnē pazūd projekta konteksts.

- [x] **2.1** Refaktorē `useProjectContext` hook — `project_id` vienmēr rakstīt URL-ā kā primāro avotu
- [x] **2.2** localStorage izmantot tikai kā fallback, ja URL parametrs nav
- [x] **2.3** Izveido `<NoProjectSelected>` stāvokļa skatu — rāda dropdown "Izvēlies projektu", nevis lādē klusē
- [x] **2.4** Izveido `copyProjectLink()` utility — automātiski pievieno `?project_id=` kopētajai saitei
- [x] **2.5** Pievieno "Share" pogu projekta header — izmanto `copyProjectLink()`
- [ ] **2.6** Tests: atver jaunu cilni bez parametra → jāredz `<NoProjectSelected>`, nevis kļūda vai nepareizs projekts

---

## FĀZE 3 — Onboarding wizard

**Mērķis:** Jaunam lietotājam skaidrs sākuma punkts bez 5 CTA uz tukša Dashboard.

- [ ] **3.1** Izveido `useOnboardingStatus` hook — pārbauda vai lietotājam ir ≥1 projekts
- [ ] **3.2** Izveido `<OnboardingWizard>` komponenti — 3 soļi:
  - Solis 1: Projekta nosaukums + apraksts
  - Solis 2: Uzaicināt komandas locekļus (vai "Izlaid")
  - Solis 3: Izveidot pirmo uzdevumu vai importēt CSV
- [ ] **3.3** Rāda wizard automātiski ja `useOnboardingStatus` = false
- [ ] **3.4** Pēc wizard pabeigšanas — redirect uz Dashboard ar ghost/placeholder datiem
- [ ] **3.5** Pievieno "Skip setup" saiti wizard pirmajā solī
- [ ] **3.6** Saglabā `onboarding_completed: true` — wizard vairs nerāda atkārtoti

---

## FĀZE 4 — Gantt datumu indikatori

**Mērķis:** Lietotājam skaidrs — kurš datums ir manuāls, kurš aprēķināts automātiski.

- [ ] **4.1** Pievieno `date_mode: 'manual' | 'auto'` lauku uzdevuma datu modelim (DB migrācija)
- [ ] **4.2** Gantt komponentē rāda 🔒 ikonu pie manuāliem datumiem, ⛓ pie auto
- [ ] **4.3** Kad lietotājs velk Gantt joslu — rāda modal: *"Fiksēt šo datumu manuāli vai atstāt automātiski?"*
- [ ] **4.4** Ja lietotājs maina atkarību un uzdevumam ir `date_mode: 'manual'` — rāda brīdinājumu, nevis klusi pārraksta
- [ ] **4.5** Tasks saraksta skatā — pievieno kolonnu "Datuma režīms" ar filtrēšanu

---

## FĀZE 5 — Dashboard prioritizācija

**Mērķis:** Samazināt informācijas blīvumu, fokusējoties uz "kas deg šodien".

- [ ] **5.1** Pārkārto Dashboard widget secību:
  1. Sprintu veselība (augšā)
  2. Kritiskie riski (tikai high/critical)
  3. Tuvākie milestones (nākamās 2 nedēļas)
  4. Aktivitātes feed (apakšā)
- [ ] **5.2** Komandas noslodzes widget — pārvieto uz `Team` lapu, no Dashboard noņem
- [ ] **5.3** Riska widget — filtrē pēc noklusējuma: rāda tikai `impact: high | critical`
- [ ] **5.4** Pievieno "Paplašināt" pogu riska widgetam — atver pilnu sarakstu
- [ ] **5.5** Vizuāls tests — Dashboard ar 0 datiem, ar daļējiem datiem, ar pilniem datiem

---

## FĀZE 6 — Reports eksporta formāti

**Mērķis:** Pievienot PDF un shareable link eksportu papildus esošajam Markdown.

- [ ] **6.1** Pievieno `exportToPDF()` funkciju Reports lapā (izmanto `react-pdf` vai `puppeteer`)
- [ ] **6.2** Izveido read-only shareable link katrai atskaitei — `/reports/[id]/public`
- [ ] **6.3** `/reports/[id]/public` route — nav nepieciešama autentifikācija, tikai lasīšana
- [ ] **6.4** Pievieno Slack webhook konfigurāciju Settings lapā (owner/manager) — iknedēļas auto-sūtīšana
- [ ] **6.5** Eksporta pogas UI — dropdown ar 3 opcijām: Markdown / PDF / Copy link

---

## FĀZE 7 — Komandas kontekstuālais skats

**Priekšnosacījums:** Fāze 2 jābūt pabeigtai (`?project_id=` URL-first pieeja strādā).

**Mērķis:** `/team` lapa rāda kontekstuālu komandu — atkarībā no tā vai ir aktīvs projekts.

- [ ] **7.1** Bez projekta konteksta (`/team`) — rāda **visus** organizācijas locekļus ar lomām
- [ ] **7.2** Ar projekta kontekstu (`/team?project_id=123`) — rāda **tikai šī projekta** locekļus + viņu lomas šajā projektā
- [ ] **7.3** Pievieno vizuālu indikatoru — "Rāda: [Projekta nosaukums] komanda" kad aktīvs projekts, "Rāda: Visi locekļi" bez projekta
- [ ] **7.4** "Pievienot locekli" poga — ja aktīvs projekts, pievieno tieši šim projektam; bez projekta — pievieno organizācijai
- [ ] **7.5** Komandas noslodzes widget (pārvietots no Dashboard Fāzē 5) — rāda tikai aktīvā projekta noslodzi
- [ ] **7.6** Tests: pārslēdzies starp projektiem sānjoslā → komandas saraksts atjauninās automātiski

---

## FĀZE 8 — CSV/XLSX importa labojumi

**Mērķis:** Novērst RLS kļūdu importā un uzlabot importa veidnes struktūru.

### 8A — RLS kļūdas labojums
**Kļūda:** `new row violates row-level security policy for table "streams"`
**Iemesls:** Importa funkcija mēģina automātiski izveidot jaunu Streamu ja tas neeksistē, bet RLS politika bloķē šo darbību lietotājiem bez owner/manager tiesībām.

- [x] **8.1** Importa loģikā — pirms straumes izveides pārbaudi `profiles` tabulu: vai lietotājam ir `role: owner` vai `role: manager` šajā projektā
- [x] **8.2** Ja lietotājam nav tiesību izveidot straumi — rāda skaidru kļūdas ziņojumu: *"Nav tiesību izveidot jaunu straumi. Lūdzu izveidojiet straumi manuāli sadaļā Streams un atkārtojiet importu."*
- [x] **8.3** Ja lietotājam IR tiesības — straumes izveide notiek ar `service_role` vai ar RLS politikas paplašinājumu kas atļauj owner/manager veidot straumes
- [ ] **8.4** Importa priekšskatījumā — ja straume neeksistē, atzīmē to ar oranžu brīdinājumu pie katras rindas (nevis tikai kļūda pēc apstiprinājuma)

### 8B — Importa veidnes kolonnu pārkārtošana
**Mērķis:** Loģiskāka kolonnu secība — no vispārīgā uz konkrēto, atkarības uzreiz aiz apraksta.

- [ ] **8.5** Pārkārto importa kolonnas šādā secībā:
  `project → stream → title → description → estimated_hours → start_date → end_date → depends_on → parallel → priority → status → assignee_email`
- [ ] **8.6** Pievieno budžeta kolonnas:
  - `budget_total` — tāmes summa (redzama owner/manager)
  - `executor_type` — `darbinieks` vai `apakšuzņēmējs`
  - `retention_pct` — ieturējuma % (darbinieks ≈ 0.35, apakšuzņ. ≈ 0.15)
  - `budget_net` — automātiski aprēķināts: `budget_total × (1 - retention_pct)`
- [ ] **8.7** `budget_total` un `budget_net` kolonnas — rādīt tikai lietotājiem ar `role: owner` vai `role: manager`; `member` un `viewer` šīs kolonnas neredz
- [ ] **8.8** Importa UI — ja fails satur `budget_total` kolonnu un lietotājs nav owner/manager, rāda brīdinājumu ka budžeta dati tiks ignorēti

---

## Definīcija "Pabeigts" katrai fāzei

Fāze ir pabeigta kad:
1. Kods kompilējas bez TypeScript kļūdām
2. Esošie testi iet cauri (vai jauni testi pievienoti)
3. Funkcionalitāte darbojas lokāli ar `npm run dev`
4. Nav console.error ražošanas kodā
