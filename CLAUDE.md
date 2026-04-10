@AGENTS.md

# Project Command Center — UX Implementācijas plāns

> **Instrukcija Claude Code:** Strādā stingri pa vienam uzdevumam. Pirms sāc nākamo — pārliecinies, ka iepriekšējais ir pilnībā pabeigts un kods kompilējas bez kļūdām. Atzīmē pabeigtos uzdevumus ar [x].

---

## FĀZE 1 — Navigācija (9 → 6 sadaļas)

**Mērķis:** Samazināt sānjoslas kognitīvo slodzi, grupējot saistītās sadaļas.

- [x] **1.1** Izveido `<PlanningDropdown>` apakšizvēlni ar iekšā: Streams, Tasks, Milestones
- [ ] **1.2** Izveido `<AnalyticsDropdown>` apakšizvēlni ar iekšā: KPIs, Reports
- [ ] **1.3** Apvieno Team + Profiles vienā sadaļā `Team`
- [ ] **1.4** Pārbaudi, ka visi esošie routes joprojām darbojas pēc navigācijas pārkārtošanas
- [ ] **1.5** Vizuāli tests — mobilais un desktop sānjoslas skats

---

## FĀZE 2 — Projekta konteksts (URL-first)

**Mērķis:** Novērst situāciju, kad jaunā cilnē pazūd projekta konteksts.

- [ ] **2.1** Refaktorē `useProjectContext` hook — `project_id` vienmēr rakstīt URL-ā kā primāro avotu
- [ ] **2.2** localStorage izmantot tikai kā fallback, ja URL parametrs nav
- [ ] **2.3** Izveido `<NoProjectSelected>` stāvokļa skatu — rāda dropdown "Izvēlies projektu", nevis lādē klusē
- [ ] **2.4** Izveido `copyProjectLink()` utility — automātiski pievieno `?project_id=` kopētajai saitei
- [ ] **2.5** Pievieno "Share" pogu projekta header — izmanto `copyProjectLink()`
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

## Definīcija "Pabeigts" katrai fāzei

Fāze ir pabeigta kad:
1. Kods kompilējas bez TypeScript kļūdām
2. Esošie testi iet cauri (vai jauni testi pievienoti)
3. Funkcionalitāte darbojas lokāli ar `npm run dev`
4. Nav console.error ražošanas kodā
