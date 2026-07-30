# Finch Farms Operations Platform — The Plan

*29 July 2026. Every file path and figure below was verified against the repo, `pack_reports.db`, `pickhaul.db`, and `backend/fixtures/water_data_export.json`.*

---

## 1. Where this actually stands

The platform at **ojaifarmingco.com** is already a Finch instance, not a demo. `backend/pesticide_tracker/settings.py` hardcodes CORS/CSRF for the domain. Real Finch well data is in production. The pesticide-compliance origin was already pivoted toward operations. What's left is finishing the aim.

| Module | Verified state | Verdict for Finch |
|---|---|---|
| **Farm / Field / FarmParcel** (`backend/api/models/farm.py`) | Rich: `total_acres`, `crop` FK, `year_planted`, `tree_count`, `trees_per_acre`, `boundary_geojson`, and `FarmParcel.apn` | **Fits.** Holds 11 ranches and ~60 blocks with zero schema change. `FarmParcel.apn` is exactly the block→parcel mapping the Piru memo needs. |
| **Packinghouse settlement** (`backend/api/models/packinghouse.py`, 12 models) | `fob_rate` at 6dp, `SettlementDeduction.category='pick_haul'`, `settlement_audit.py` 5-check anomaly detector, learned `PackinghouseGrowerMapping` | **Fits.** Best-built thing in the codebase. Reuse the grower-name resolver for block mapping. |
| **Water / SGMA** (`backend/api/models/water.py`, 2,135 lines) | `WellReading` already has `extraction_acre_feet`, `base_fee`, `gsp_fee`, `domestic_fee`, `fixed_fee`, `total_fee` | **Half-fits.** Schema is right; the config and rates are wrong. See §4.3. |
| **PUR / spray** (`backend/api/models/pur.py`) | `ApplicationEvent` + `TankMixItem`, TELUS PDF parser naming Ag Rx / Hansen / Aspen AG | **Legally required.** CA DPR monthly filing to the Ventura County Ag Commissioner. Stays, de-emphasized in nav, never deleted. |
| **WPS / Licenses / Deadlines / REI** (`backend/api/models/compliance.py`) | `ActiveREITicker` polls `/compliance/rei-postings/active/` every 60s with a write-back action | **Legally required** (EPA 40 CFR Part 170). The REI ticker is the single most operationally live thing on the site — it gets *promoted*, not hidden. |
| **FSMA** (15 models) | Schema broad, tables empty | **Required but dormant.** Keep, collapse. |
| **PrimusGFS / CAC** (40+ models, 44 components, `cac_data_mapper.py` at 3,100 lines) | 46 of 63 route IDs are compliance; every PrimusGFS table has zero rows | **Voluntary certification, not law.** Largest dead weight in the app. Keep (deleting is expensive), sort last, first candidate for `getHiddenModules()`. |
| **Analytics** (`backend/api/analytics_views.py`) | `/api/analytics/dashboard/` hits 5 stale field references, swallows them in a bare `except`, returns **HTTP 200 with every number zeroed** | **Broken and silently lying.** Demoted to Administration. Fix or delete later — not in this scope. |
| **Harvest endpoints** | `/api/harvests/statistics/`, `/api/harvests/cost_analysis/` return **HTTP 500** on stale field names | Broken. Out of scope, noted. |
| **`/api/wells/`** (`backend/api/sgma_views.py:473`) | `select_related('water_source')` on a model with no such field → **HTTP 500** | Fixed in Increment 2. |

**Three things the brief got wrong, corrected here:**

1. `extraction_acre_feet` is **not** zero. The fixture holds 343 readings: **257 non-zero, 83 zero, 3 null.** I simulated the loader — the fixture is stored newest-first, so `WellReading.save()` never finds a prior reading and never recomputes. Production holds the agency-billed acre-feet intact **by accident of row order.** What *is* genuinely null: the entire fee stack, `previous_reading`, and `meter_rollover` on all 343 rows.
2. `backend/railway.json` sets `"builder": "DOCKERFILE"`, and `backend/entrypoint.sh` runs **only** `migrate --noinput` then gunicorn. **A Dockerfile builder does not read the Procfile.** So `load_water_fixture` / `reassign_wells` / `sync_well_names` probably never execute on deploy — which means nobody knows how the 14 wells got into production. Decision 1.
3. `entrypoint.sh` does not start Celery. `settings.py` schedules 15 beat jobs including `auto_generate_monthly_pur_report`, `check_active_reis`, `check_license_expirations`. If the celery-worker service doesn't exist, **PUR auto-generation and REI enforcement are already dead.** Decision 2.

---

## 2. What it becomes

**Working name: Finch Operations.** Three pillars: **Block Grading** publishes the verified five-metric A–F report card — 15 lemon blocks across 213.4 acres, eight different letter grades under one sky, one water district, one packinghouse. **On-Ranch Rentals** is genuinely new schema that finally joins the 14 houses sitting in QuickBooks class trees to the ranches they stand on — the Office ranch earned **$82,376 renting and $393 farming** in FY2024. **Water Cost** finishes wiring the live UWCD/OBGMA well data to acre-feet and dollars per ranch and joins it to the SAWCO summer work, closing the two ranches (Sespe, Old Telegraph) the well data misses entirely. **Pick & haul stays on your machine** — the Saticoy portal is HTTP-only and seven credentials live in Windows Credential Manager; nothing about it moves to Railway.

---

## 3. The foundation nobody can skip

All three pillars need the same thing and none of them can create it: **11 Farm rows, ~60 blocks, and a defensible acreage denominator.** Today the only Farm-creating code in the repo is `backend/api/management/commands/seed_demo_data.py:61-79`, which makes "North Ranch" and "South Ranch."

**Two hard stops before anything can run:**
- `Company.max_farms` defaults to **3**, enforced by `can_add_farm` (`backend/api/models/auth.py:162, :239`). Blocks ranch 4 of 11.
- `Field.total_acres` is **non-nullable** (`farm.py:701`). You cannot create a block without asserting an acreage — which forces the conflicts below to be resolved rather than deferred. That's a feature.

### Authoritative sources — resolved, not picked

| Source | Grain | State | Role |
|---|---|---|---|
| **V6.17 `Setup - Acreage`** | ranch × crop × year, bearing/non-bearing | Populated 2021–2025; 2025 = 602.40 bearing / 199.15 non-bearing / 801.55 planted | **Ranch-crop denominator** |
| `pack_reports.db` `block_acres` | scoring unit | 15 rows, 14 statement-derived + THA from P&L, `loaded_at` 2026-07-08 | **Graded block numerator** |
| V6.17 `Setup - Plantings` | block | 41 rows, acres on only 14 (Piru 4 + Rio Vista 10) | Supplementary — the only source with planting years |
| `Acreage & Maturity Model V1.0` | block | 10 of 3,530 numeric cells non-zero | **Abandoned. Do not cite.** |

**Rule: Setup - Acreage is the ranch-crop denominator. `block_acres` is the block numerator. They are reconciled against each other, never summed.**

One thing the survey missed and I verified: `pack_reports.db` `unit_metric.ranch_bearing_acres` **already matches Setup - Acreage exactly** for eight of nine lemon ranches (FOS 84.89, GRA 6.7, OFF 10.11, OLT 41.55, PIR 6.56, SAC 6.5, SES 20.14, THA 12.8). Two exceptions, both material — below.

### The four acreage conflicts and how each resolves

**Saticoy 1A / 1B / 1C — all exactly 15.00 ac.** That is an even split on the packinghouse's side, not a survey. Against it: **1B does 1,184 ctn/ac and 1C does 409 — a 2.89× spread on identical stated acres.** Either the acres are wrong or the blocks really are that different, and the card cannot tell you which. Separately, the engine carries `SAT-LEM = 88.96` ranch acres while Setup - Acreage says 102.32 — Δ 13.36, exactly the Saticoy non-bearing figure that V6.17 reclassified into bearing. And 15+15+15+30+13.96 (Meyer) = 88.96 exactly, so the engine is self-consistent on a stale basis. **Resolution: Setup - Acreage (102.32) wins for the ranch row; all three blocks seed at 15.00 flagged `acres_confidence='even_split'`. Blocking on you.**

**Grand House — 9.0 (statement) vs 6.7 (P&L, whole ranch).** The block figure exceeds the ranch figure. `GRA-LEM-East` and `GRA-LEM-West` are both `active=0` with `last_year=NULL` — no packed volume ever in-window — so House may be the only live lemon block and 6.70 may be right. **Impact: at 9.0 ac it grades 742 ctn/ac = 91.2% = B; at 6.7 ac it grades 997 = 122.4% = A. Two-band swing on both per-acre grades.** Seed at 9.00 flagged `statement`, hard conflict badge. **Blocking on you.**

**Rio Vista — Setup - Acreage is internally impossible.** It shows 20.59 bearing lemon acres, flat 2021–2025, with **0 non-bearing**, while `Setup - Plantings` shows 6 Rio Vista lemon blocks totalling 30.13 planted acres planted 2017/2023/2023/2023/2024/2025 — of which only the 2017 block (5.84 ac) would be bearing by 2025. Neither figure is defensible. **Resolution: seed Rio Vista from `Setup - Plantings` at block grain, compute bearing from `year_planted` + crop maturity, mark the Setup-Acreage row superseded.** This also fixes a false blocker: the V1.7 workbook says Rio Vista is ungraded for "no acres," but the engine's `RIO-LEM.ranch_bearing_acres` is simply **NULL — never loaded**, while Setup - Acreage has 20.59 sitting there. The acres exist; nobody wired them.

**41 of 60 scoring units carry even-split placeholders** (e.g. Foster Park avocado 52.08 ÷ 7 = 7.44 each). Foster Park's 5 graded lemon blocks sum to 73.60 against a ranch figure of 84.89 — an 11.29 ac gap, partly `FOS-LEM-Meyer1`, inactive since 2022. Seed at ranch-crop grain, blocks flagged `placeholder`, **never publish a per-acre figure on a placeholder block without the badge.**

### The seeder — one command, run by hand, never on deploy

`backend/api/management/commands/seed_finch_operation.py`

```
python manage.py seed_finch_operation --company="Finch Farms" [--dry-run|--commit]
```

Stages, idempotent on natural keys, never overwriting a user-edited display string:

1. Raise `Company.max_farms` to 15 (guarded — only if currently lower).
2. `get_or_create` the 11 Farms by `(company, name)`, set `county='Ventura'`, `owning_entity`, `finch_ownership_pct`.
3. `RanchCropAcreage` rows from Setup - Acreage — 11 ranches × 8 crops × 5 years.
4. `Field` rows: ranch-crop grain where no block detail exists, block grain where `block_acres` or `Setup - Plantings` supplies it. `acres_source` and `acres_confidence` stamped on every row.
5. Emit a **conflict report**; refuse `--commit` on any unresolved blocking conflict unless `--accept-conflicts` is passed, which stamps the affected Fields.

### Shared schema — one migration, not three

All three blueprints independently proposed `Farm.finch_ownership_pct`; rentals additionally proposed `LegalEntity`. Merge into **`backend/api/migrations/0085_finch_foundation.py`**:

```
backend/api/models/auth.py
  + LegalEntity(company FK, name, short_code, entity_type, qb_file_name, active)
      seeded: JPF, F&P, FFLLC, TCC, RMLF, TWIW

backend/api/models/farm.py
  Farm  + owning_entity        FK(LegalEntity, null, PROTECT)
        + finch_ownership_pct  Decimal(5,4) default 1.0000
  Field + acres_source         CharField
        + acres_confidence     choices(surveyed|statement|pnl|even_split|placeholder)
        + acres_as_of          DateField

backend/api/models/acreage.py  (NEW — the shared denominator)
  RanchCropAcreage(farm FK, crop_code, year, bearing_acres,
                   non_bearing_acres, source, is_superseded, note)
```

`LegalEntity` goes in `auth.py` beside `Company` because `Farm` needs it and `farm.py` already references `'Company'` by string — a new module creates a circular import.

**Everything derives from one place:**
```
Farm.bearing_acres(year)   = Σ RanchCropAcreage.bearing (not superseded)
Farm.irrigated_acres(year) = planted − grazing        ← water's denominator
Field.total_acres          = block numerator, acres_confidence stamped
BlockScorecard.acres_graded_on = FROZEN SNAPSHOT at import
```

That last line is the one place duplication is correct: a published grade was computed against a specific acreage. If you later correct the acres, the grade does not silently change — it goes **stale** and must be re-graded on your machine. `acres_graded_on` is history; `Field.total_acres` is current. The `/dashboard/acreage` screen shows both side by side.

**Foster Park's irrigated denominator matters:** 136.97 bearing + 181.03 grazing. Grazing takes no irrigation water. Water $/bearing-acre and water $/planted-acre differ by 32% there.

---

## 4. The three pillars

### 4.1 Block Grading

**What it does.** Publishes the five-metric A–F report card as a URL. **It imports the computed scores. It does not re-implement the engine.**

That is the single most important design decision in this plan, and here's the reasoning: the engine's inputs cannot move — `pack_reports.db` (7.65 MB, 29 tables, ~65,000 rows) is built from 2,112 PDFs by a 78-script pipeline including ~10M tokens of Claude Vision extraction, and the 133 MB / 896-file `_audit` folder lives on your machine. The trust layer is `verify_data.py`'s 37 checks, which run against `pack_reports.db`, not Django. Re-implementing the arithmetic in Django moves it away from its own verification harness and creates two implementations that must agree forever — and any drift silently produces a different letter for the same block, which is the one thing that destroys this asset. Plus `score_engine.py --portable` already runs the packinghouse-facing subset with zero QuickBooks input, and 6 `unit_metric` names are flagged `internal_only`. Porting the engine would drag your QuickBooks-derived metrics into a codebase you may want to sell to Saticoy Lemon.

**One flow goes the other way: acres.** Acres is the single grower input, two of five grades are per-acre, and the platform is the right place to edit it. So the platform is authoritative for acres and **exports a CSV back into the existing `load_acres_csv.py` step.** It never regrades locally, because a grade computed on the platform is a number no verify check has ever seen.

**The real data.** Verified: 15 grade rows × 27 columns in `Finch_Report_Card_Grades.csv`; 85 season rows (2020:13, 2021:13, 2022:14, 2023:15, 2024:15, 2025:15); `unit_score` 427 rows / 60 uids with **P1 scored 20/60, P2 14/60, P3 32/60, P4 33/60, P5 17/60, PERF 27/60**; 101 `scoring_benchmark` rows; 1,690 `unit_doc` citations; `block_acres` 15 rows. Grade window 2023–2025, trend window 2020–2025. Current spread: **1 A− · 5 B+ · 1 B · 3 B− · 2 C+ · 1 C− · 1 D+ · 1 F.**

**Schema** — `backend/api/models/block_scoring.py` (new), migration `0086`:

| Model | Rows it holds | Why |
|---|---|---|
| `BlockScoreSnapshot` | 1 per import | Import envelope: `engine_version`, `pack_db_sha256`, `verify_checks_passed/total`, `band_set` JSON, `is_published`. Additive and reversible — previous snapshot stays live until publish flips. |
| `ScoringUnit` | 60 | The engine's single largest schema defect is that unit identity is free-text across four tables with zero referential integrity; it lives only in `Finch_Block_Crosswalk.xlsx`. Promoting it is the one piece of modelling the platform genuinely adds. `farm`/`field` FKs **nullable** — the card renders standalone. |
| `BlockScorecard` | 15/snapshot | Grades are **nullable CharFields** so "a dash is never a zero" is enforced at the column level. `grades_on_file` stored so the GPA denominator is auditable. |
| `BlockSeasonMetric` | 85/snapshot | Including `revenue_note` — 11 of 85 read "printed statement total" and must render flagged. |
| `BlockScoreGate` | 427/snapshot | `gate_reason` rendered **verbatim**. Never regenerated, translated, or summarised. |
| `BlockEvidenceRef` | 1,690/snapshot | Citation without the image. `relpath` **POSIX-normalised** — the engine stores Windows backslashes, which is what breaks `verify` check 21 on Linux. Nullable FK to `PackinghouseStatement` is the future seam. |
| `BlockScoreBenchmark` | 101/snapshot | So the UI can badge the **7 rows with `status='DEFAULT'`** — including the 814 ctn/ac standard itself. |

**Ingestion — two scripts, one command, nothing in the Procfile:**
- `_Database/scripts/export_platform_bundle.py` (new, on your machine, after `verify_data.py` in the refresh order) → one ~500 KB JSON. `report_card.py:643` already calls `json.dumps(data, ...)` — add a `--json` flag rather than reimplementing. **The exporter refuses to write if any verify check fails.**
- `backend/api/management/commands/import_block_scores.py` — **hard refuses unless `verify_checks_passed == verify_checks_total`**, override only via explicit `--allow-unverified` which stamps a red banner on every card. `--dry-run` prints the letter/acre/gate diff against the published snapshot. Import never touches an operator-confirmed farm/field mapping.
- `export_block_acres.py` → the CSV `load_acres_csv.py` already consumes.

**Screens**

| Screen | Route | Decision it drives | Status |
|---|---|---|---|
| Report Card | `/dashboard/blocks` | Which blocks to walk, replant, retop. A ranch average erases a 2.89× spread. | **Buildable today** |
| Block detail | `/dashboard/blocks/:uid` | Is a weak block a yield, quality, size, or pick-schedule problem — and is the number trustworthy | **Buildable today** except the water strip → **blocked, delivered with Pillar 3** |
| Gated register | `/dashboard/blocks/gated` | What unlocks the next tranche of grades, ranked | **Buildable today** — every reason is already a written string |
| Acres reconciliation | `/dashboard/acreage` | The highest-leverage input in the asset | **Comparison buildable today; resolution blocked on you** |
| Ranch roll-up | `/dashboard/blocks/ranches` | Where the productive ground actually is | **Buildable** except water columns and Finch-share % — **blocked on input** |
| Unit mapping / data room | `/dashboard/blocks/admin` | Is the published card trustworthy right now | **Buildable today** — admin-only |

**Effort: 28–35 days.** The blueprint said 18–22 and I'm overriding it. The build allots 4 days for "card grid + block detail," which includes two dashed-OLS trend charts, a month-profile panel with a house-average overlay on four tiered price bands, and a size-distribution strip — with **no charting pattern in the repo to copy** (recharts has three thin wrappers; the existing HTML card's charts are bespoke SVG). Comparable in-repo screens: `PackinghouseAnalytics.js` 1,046 lines, `ComplianceDashboard.js` 991, `ProfitabilityDashboard.js` 764. On top: 7 new models + RLS, a two-machine pipeline, a unit→farm resolver, and a CSV round-trip that must survive a manual human refresh.

**Honestly gated:**
- The **814 ctn/ac standard — the denominator of two of five grades — is `status='DEFAULT'`**, not LOCKED. Derived from the UC 2020 cost study, awaiting your confirmation. Badge on every yield and revenue percentage.
- All four P2H house-margin floors ($7,500 / $6,250 / $5,000 / $4,000 per acre) are DEFAULT, anchored on one derived figure ($600,436 Foster Park acreage-driven ÷ 137 ac = $4,383).
- **203 of 2,142 documents are `needs_review`** — counted deliberately, not excluded. Four units carry `sensitivity_flag` because their band moves if those are dropped: SAT-LEM-Block1A 80.0%(B)→79.7%(C), SAT-LEM-Block1B 79.5%(C)→80.5%(B), OLT-LEM 68.5%→61.6%, FOS-LEM-Meyer1 84.7%→76.2%.
- **Only 15 of 60 units are on the card.** 45 are avocado/mandarin/navel/valencia on v1 scoring; avocado P3 quality is withheld entirely pending a size→grade map. **Avocado is the largest commodity in the archive by document count (856 docs).** The first family question will be "what about the avocados and the other two-thirds?" — have the answer ready.
- Pool dollar *levels* never reconcile to the books at block grain. SLA pooled Foster Park + Grand + Sespe at the JPF **account** level before 2023 — the engine states this is honestly unattributable per ranch. Two open bookkeeper items: Foster Park 2023 books $39,588 less than SLA statements; Saticoy 2024 books ≈79% of SLA credits.
- Verification currently stands at **34/37** in a rebuild container. The three failures are environment, not data (stale dashboard HTML says 61 units against a 60-unit DB; Windows backslashes on Linux; unstaged pack feed). You need to run `export_pool_economics.py` → `block_dashboard.py` → `verify_data.py` to reach 37/37 before the first import.

**Do not backfill the 860 historical pool statements into `PoolSettlement`.** The engine's canonical rule (`count_in_total=1 AND flagged=0`) has no counterpart in the platform, and `dedup_resolution` has 236 DUPLICATE and 7 ALL_ROLLUP rows that must not be summed. Loading them naively puts avocado at $19.3M next to a scorecard built on $8.95M, on the same site, contradicting each other.

---

### 4.2 On-Ranch Rentals

**What it does.** Joins 14 on-ranch houses to their ranches for the first time, and keeps them structurally out of every farming margin.

QuickBooks already encodes the exact shape. Verified in `Entity Historicals/`: Finch Farms LLC nests `Income > Ranches > {Rentals > {ranch} > {property} > {Income, Utilities}}` with **Farming as a sibling**. RMLF is cleaner: `Total Farming $392.71 / Total RANCH RENTALS $82,375.76 / Total Ranch $82,768.47` (FY2024). **The Office ranch earned 210× more renting than farming, and the ag P&L correctly carries only the $393.** That sibling structure is the model, the boundary, and the screen layout at once.

**The parsing gotcha, verified by writing a parser that returned zero rows first:** these exports do **not** put the label in column A. Nesting depth is encoded by **column index** — the label is the first non-empty string cell and its column index is the tree depth. F&P "Rental Income" at col2; Finch Farms LLC "Rentals" at col5, property at col7, leaf at col8; RMLF "RANCH RENTALS" at col4, leaves at col5.

**The real data.**

*On-ranch (14 properties, annual grain only):* Rio Vista House Rental 1553 ($3,916.90 income / -$303.70 utilities) and 1555; SAC 1096 Orange (**utilities -$282.54 and no income line at all**) and Barn/Yard Rental ($12,480.00 — largest in FF LLC, and not a dwelling); Office 4002 Camulos / 956 Orange ($54,600 FY2024) / Little House / Office Rental; Thacher Creek 2728 E Ojai ($15,840, booked **inside** the Farming branch as a sibling of Lemon and Cara Cara), 4010 Camulos (-$1,990.70 net), 60 C.V. (-$8,438.62 — property tax $8,479 against $817 rent); Old Telegraph unnamed "Rental Income" $10,800.

*Off-ranch (4 properties, 20 units, monthly grain):* GPR **$443,472/yr**, NOI $814,445, $8.69M gross / $6.59M equity. Harrison Ave 4u, Ventura St 13u (rent-controlled Ojai), Old Grade Rd 2u, 196 Fir commercial.

**Schema** — `backend/api/models/rental.py` (new), migrations `0087` + `0088_rental_rls_policies.py`:

`RentalProperty` (with `location_type` on_ranch/off_ranch **as its own field**, `pnl_treatment` non_operating/ranch_other_income, `qb_class_path`, CheckConstraint that on_ranch ⇒ farm NOT NULL) · `RentalUnit` · `Lease` (**rent lives here, never on a person**; `start_date`/`end_date` **nullable**) · `RentalLedgerEntry` (`amount_charged` + `amount_paid`; `period_month` **nullable** = annual grain) · `RentalCategory`.

**Two scope pushbacks I'm making:**

**Drop `Tenant` from v1.** 31 tenant names with emails and up to three phone numbers each on a live public site is a liability with no operational payoff. You are not the landlord-of-record — Ventura Realty And Homes Inc. is, and their owner statement already carries the unit key (`"359:Vasquez"`), which is all reconciliation needs. Use an `occupant_label` string on `Lease`.

**Drop separate `RentCharge`/`RentPayment` tables.** Nobody in this operation will mark a payment received in the app. One ledger line carrying both charged and paid gives delinquency for free.

**`location_type` must be its own field, not `farm_id IS NULL`.** Your own rule in `FIFA Real Estate Portfolio Roll-Up V1.0` 'Read Me' row 17 says it verbatim: on-ranch houses are excluded *"to avoid double-counting (location rule, not entity)."* Verified reason: **Thacher Creek LLC owns both 2728 E Ojai (on-ranch) and the 13-unit Ventura St building (off-ranch).** Same entity, opposite treatment.

**The farming boundary is enforced four ways.** Structural: `rental.py` imports only Farm/FarmParcel/Company, and nothing under `api/services/` imports it — verified that `crop_report.py` takes revenue exclusively from `PoolSettlement` and cost exclusively from `ApplicationEvent`/`PesticideApplication`, so rental dollars cannot reach a ranch margin by construction. Declarative: `pnl_treatment` defaults to `non_operating`. Presentational: two cards, separate subtotals, copying RMLF's own layout. Query-level: `/api/farms/{id}/rental-summary/` carries **no acreage field at all**, so a per-acre rental figure cannot be computed client-side. Dividing $82,376 by Office's 10.11 bearing acres is arithmetically valid and completely meaningless.

**Screens**

| Screen | Route | Decision | Status |
|---|---|---|---|
| Rentals Overview | `/dashboard/rentals` | Where the rental book earns; that Office is a rental business with a farming hobby | **Buildable today** |
| Ranch rental panel | inside `/dashboard/farms` detail | Is a ranch carried by fruit or by houses. Closes FIFA register item #6 (~$5M double-count) | **Annual dollars buildable; unit/occupancy blocked** |
| Portfolio Rent Roll | `/dashboard/rentals/rent-roll` | Turnover decontrol sequencing on Ventura St | **Buildable** — but see the 36% note; loss-to-lease blocked on market rents |
| Statement reconciliation | `/dashboard/rentals/statements` | Is the manager collecting what was charged | **Buildable for 3 off-ranch; no statement exists for any on-ranch house** |
| Lease expiry calendar | `/dashboard/rentals/leases` | Renewal timing | **Blocked — there is not one lease date in any source file** |
| Valuation board | `/dashboard/rentals/valuation` | Hold/sell/develop | **Blocked** — underwritten NOI is 48% below manager-actual at Harrison |

**Effort: 16–20 days.** (Blueprint said 11–13; the Gray Prop PDF parser is fiddlier than estimated — fields are concatenated in the text layer, e.g. `Check 05/06/2025James Finch  $6,335.60`. Extraction is clean pypdf, no OCR — I verified that — but the regex work is real. Trim to ~14 by having you paste the statement as CSV for the first cycle, which also tells you whether the screen gets used before you build the parser.)

**Honestly gated:**
- **The rent roll's own printed total is wrong by 36%.** `Finch_Farms_Rent_Roll_May2026.xlsx` prints "PORTFOLIO TOTALS 60,563" by summing **31 tenant rows**. There are **19 units.** Correct: Harrison $6,725/mo, Ventura St $25,481/mo, Old Grade $4,750/mo = **$36,956/mo = $443,472/yr**, which ties exactly to the FIFA Roll-Up GPR. Harrison unit 363 appears three times at $1,575. The Lease-holds-rent design makes this structurally impossible to repeat.
- **Gray Prop "Original Amount" is not additive.** 61 Charge lines sum to $101,700 in Original vs $80,700 in Paid — which is the statement's own printed total. The gap is split payments repeating the full charge (unit 359: $1,600 charged, $600 + $1,000 paid, every month).
- **RMLF FY2025 is a known mis-dated export** (FIFA register item #5). Total RANCH RENTALS reads $17,515 for 2025 vs $82,376 for 2024. **Use FY2024 for Office.**
- **60 Casitas Vista is double-booked** — your own Thacher Creek README says: *"appears in BOTH JPF (as a Rentals class) AND TC (as a top-line rental). Reconcile when rentals view is built."* This capability is that deferred task.
- **Probable intercompany double-count:** FF LLC books "Office Rent Exp 900 Orange Road" -$31,500/yr while RMLF books "Office Rental Income" $43,752. Do not publish a company-wide rental total until answered.
- `$3,916.90` appears as the annual figure for **three** different properties across two entities and two years. Import flagged, not clean.
- Two items nobody's list has: FF LLC 2021 carries **"2795 Rental Income" $12,425** (appears in no other year) and **"Land Rent Expense" -$8,000 to -$10,800/yr** (a lease-*in*, the mirror of this pillar). Log as unmapped; do not swallow.

---

### 4.3 Water Cost

**What it does.** Turns the half-wired well data into acre-feet and dollars per ranch, and joins it to the SAWCO summer work — which is what closes the portfolio's two biggest water blind spots.

**The corrected premise.** `extraction_acre_feet` is the **agency-billed** figure and it is intact: I reconciled it to the penny against `Water Usage Summary V1.0` 'AF by Well' for **all 8 UWCD wells across all 9 years.** What's genuinely broken is three things.

**(1) The aggregation rule is agency-specific and nobody has encoded it.** UWCD bills semi-annually with intervening non-billable quarterly reads — the Jun-30 and Dec-31 rows already *contain* the Mar-31 and Sep-30 rows. Proof: FIN0010 2022 = Jun 31.23 + Dec 69.33 = **100.56 AF**, exactly the workbook figure; naive sum gives 146.44. **Summing all rows overstates UWCD wells by ~16%, and both `WaterSourceViewSet.filter_queryset_by_params` (`backend/api/water_views.py:42-50`) and `sgma_dashboard` (`backend/api/sgma_views.py:1036-1058`) do exactly that today.** Every AF number the live site shows for a UWCD well is inflated right now.

**(2) The meter config is wrong on 11 of 14 wells, and one UI save destroys the data.** All 14 are `flowmeter_units='acre_feet', multiplier=1.0`. Derived empirically from (delta ÷ billed AF):

| Wells | observed ratio | true register |
|---|---|---|
| FIN0002, FIN0010, UND0004, Helicopter/Irr, Rio Vista #1, #2 | 999.9–1000.1 | acre_feet × **0.001** |
| UND0002 | exactly 100.0 | acre_feet × **0.01** |
| FIN0009 | 321,000–329,000 | **gallons** (325,851/AF) |
| Ranch:Irrig., Grand Irrig., SACR Irrig | 4,352–4,358 | **cubic_feet × 10** (43,560/10) |
| Ranch Irr Pump Tax, Farming Fordyce | 1.0 | acre_feet × 1 |

`meter_rollover` is NULL on all 343 rows while the meters demonstrably roll at 1,000,000 (11 rollovers in the data, e.g. FIN0010 delta −910,038). The measured blast radius:

```
FIN0010 2025-09-30 meter=864432 → 2025-12-31 meter=882818
  agency AF          = 59.14
  what save() writes = 18,386 AF   (311×)
  base_fee it writes = $3,536,363
```

**This fires on the first edit to any well reading, by anyone, through the UI, API, or Django admin.** It is not water-specific — it can be triggered during block-grading or rental work. **It ships in Increment 0.**

**(3) Cost is genuinely unpopulated** — all five fee fields null on all 343 rows — because `WaterSource` holds a single scalar rate while the real rates are a 9-year schedule (**OBGMA GSP $0 → $37 (2020) → $75 (2024) → $100/AF (2025)** on a flat $25 pump rate; **UWCD irrigation $43.75 → $192.34/AF**). Agency dollars rose **6.6× ($16,784 → $110,765)** while volume rose 38% (524 → 725 AF). **The cost problem is rates, not usage.**

**Schema** — `backend/api/models/water.py`, migration `0089`:
- `WellReading` + `is_billing_row` (bool, indexed), `billing_period_start`, `af_source` (agency_billed | meter_derived | estimated)
- **`WellReading.save()` guard** — never recompute when `af_source='agency_billed'`; auto-detect rollover to the next power of ten rather than silently producing a negative
- `WaterRateSchedule` (new) — gsa, effective_from/to, base/gsp/domestic rate per AF, fixed_fee_amount + basis, `rate_source`, `is_estimated`
- `WaterSource` + `shares_held`, `share_charge_per_share` (SAWCO bills **$210.00/AF + $1.95 per share**; Sespe 192 shares, Old Telegraph 128 — no existing field can express per-share billing), `attribution_confidence`, `attribution_basis`
- `RanchWaterMonth` (new) — the platform has **zero** Invoice/Expense/Vendor/GL models, so this is the smallest possible surface to hold booked QB cost as a reference line
- Relax `WellReading.water_source` `limit_choices_to` so SAWCO surface meters reuse the whole WellReading + fee machinery
- **Fix the duplicate `GSA_CHOICES`** at `water.py:22-30` and `:545-552` — the second wins and **drops `'uwcd'`, so 9 of 14 live wells cannot be selected in the UI**

**Seven ingestion commands**, all `--dry-run` by default, keyed on `state_well_number` (immutable agency ID, present on all 14 rows), never writing `WaterSource.name` or `well_name`:
`water_attribute_wells` → `water_backfill_meter_config` → `water_flag_billing_rows` (self-checks against the workbook, refuses to commit on >0.02 AF drift — I ran this offline: passes 8/8 UWCD wells all years) → `water_load_rate_schedule` → `water_recompute_fees` → `import_sawco_reads` → `import_qb_water_months`.

**SAWCO is the strategic payoff.** `SAWCO Historical Meter Reads.xlsx` gives Sespe and Old Telegraph monthly acre-feet 2022-11 → 2026-04 — exactly the two ranches the well data misses (Sespe's only well is a sub-1-AF domestic meter; **Old Telegraph has no well at all**). I reproduced every figure independently: Sespe **71.26 / 81.74 / 73.60 AF**, Old Telegraph **43.97 / 46.44 / 33.72 AF**, summer shares **54.1/55.5/68.0** and **50.7/57.1/49.5**, peak Sespe Sept-2024 at **16.79 AF**.

**Screens**

| Screen | Route | Decision | Status |
|---|---|---|---|
| Water Cost by Ranch | `/dashboard/water` | Which ranch is the water problem. Answers immediately: **Foster Park $167,030 against 19.36 metered AF — 98% unmetered Casitas** | **Buildable** after ingestion |
| Summer Peak Exposure | `/dashboard/water/summer` | Whether a summer cut is survivable. The real finding: **it saves less than it looks** — a 25% Jun-Sep cut at Sespe removes 12.5 AF and $2,626 but zero of the $4,493 share charge, so all-in $/AF *rises* from $271 to $286 | **Sespe + Old Telegraph only.** Every other ranch has billing-period granularity, not monthly |
| Ranch Water Detail | `/dashboard/water/ranch/:id` | Can this number be trusted in a GSA filing | **Buildable** for 13 metered wells |
| Well Attribution & QA | `/dashboard/water/wells` | Sign-off screen; repairs the dead `/api/wells/` | **Buildable — its purpose is to surface what needs you** |
| Rate Schedule | `/dashboard/water/rates` | Sizes rate risk independent of consumption | **UWCD/OBGMA buildable; SAWCO badged unconfirmed. No forward GSP forecast — do not project it** |
| P&L Reconciliation | `/dashboard/water/reconciliation` | Lets platform water be quoted next to the P&L without either being wrong | **Buildable.** Cannot close the Casitas gap — no volumetric Casitas dataset exists anywhere |

**Effort: 20–24 days.**

**The honest ceiling, stated on every screen.** Metered agency water + SAWCO ≈ **$140,789 of the $550,622** 2025 QB Water row — **26% coverage.** The other 74% is Casitas deliveries, pumping electricity, well repair, and irrigation labor lumped in one un-splittable GL account. **The platform must show the measured 26% as measured and the residual as an imported, labelled reference figure. It must never claim to reproduce the P&L Water row from meters.**

**Also gated:** the QB figure is **cash-posted, not consumption-timed** (a Q3 bill posts in October), so a Jun-Sep dollar cut measures cash paid, not water used. `$/AF` is not a clean unit cost at low volume — Foster Park shows $574/AF in 2022 purely because AF collapsed to 0.51 while fixed fees kept billing. The SAWCO $236.24/$245.15 all-in figures are **single-invoice-period**, not annual; annualised they're $265–273 and $274–299. The **$210/$1.95 rates come from an undated worksheet believed 2021** — badge every SAWCO dollar. Three OBGMA readings have **null AF** (Q2 2021: Ranch:Irrig. 12.08, Grand 76.73, Ranch Irr Pump Tax 64.29 — recoverable from `OBGMA Historical Data.xlsx`). `Fordyce` is a **sold ranch still marked `active=True`** and inflates any portfolio total today.

---

## 4b. Pick & haul — UN-PARKED (July 30, 2026): the platform is the system of record

**Superseding the parking decision below.** Bird chose to host pick & haul on the platform. The security reasoning that parked it still holds and shaped the design: **the portal fetch stays on the local machine** (Saticoy is HTTP-only; seven logins stay in Windows Credential Manager), and what moves to the cloud is *data over HTTPS*, authenticated by a revocable platform machine token — never a portal credential.

**What was built (branch `finch-operations-increment-0`):**
- Platform: 10 models in `backend/api/models/pickhaul.py` (migration 0087 + RLS), machine-token auth (`machine_auth.py`, `issue_machine_token`), a faithful port of the matcher + gates in `services/pickhaul/` (**verified zero-divergence against the real season: 50 exact / 33 reference+combined / 9 block+combined / 3 subset+combined / 1 reference / 16 unmatched, 576/576 links**), `POST /api/pickhaul/sync/` with upsert-idempotent bundles that structurally cannot carry invoices, full CRUD API gated by new `view_pick_haul`/`manage_pick_haul` permissions (accountant role gets both), and six screens at `/dashboard/pick-haul` (Owed chase list, Invoices, Manual Picks, Receipts, House Charges, Checks). New **gate 11 unmatched-charges** makes the $360K blind spot first-class. Accountants land directly on the chase list at login.
- Local pipeline: `pickhaul/push.py` + run.py stage 9 auto-push after clean runs, `[platform]` config (URL only), `credentials set-platform`, doctor checks, the 2027 season-rollover warning, and `[entry]/[manual_sheets_mode]` cutover flags. Folder is now a git repo; pre-change zip taken.
- Seed: `seed_pickhaul` migrates pickhaul.db with a fidelity gate that refuses `--commit` on any reconciliation divergence.

**Cutover** follows the parallel-run checklist in the approved plan (`~/.claude/plans/reactive-rolling-spring.md`): entry workbook stays the only invoice-writable surface until flip day; the final re-seed bridges; then `read_back=false`, `manual_sheets_mode.ingest=false`, and the accountant keys everything on the web.

---

### Original parking rationale (July 29, superseded but load-bearing for the design)

**The security reasoning holds and I verified it.** `config.toml:68` sets `http://growerreports.saticoylemon.com:10071` — HTTP-only, 443 times out. There are **seven** portal logins in Windows Credential Manager (not four), four of them for a service that transmits credentials in clear text. Relocating the fetch to Railway would move seven secrets into a cloud store to buy nothing: the publish target is an Excel workbook a person opens, and `[paths].publish` is commented out, so the output never even leaves `data/out` today.

I confirmed **zero portal residue in the platform**: grepping `backend/` for `saticoylemon|growerreports|pickhaul|10071|keyring` returns only legitimate `SettlementDeduction` `pick_haul` category strings in `packinghouse.py`, `packinghouse_analytics.py`, `pdf_extraction_service.py`, and migration 0030. Clean.

**Pipeline health is good.** Last clean run 2026-07-29 16:17 local: 0 errors / 2 warns / 21 infos. `python -m pickhaul.doctor` reports "No problems. Ready to run." 41 unit tests pass. 374 receipts / 12,886.5 bins, 157 direct charges totalling **$995,024.32**, 71 invoices totalling $662,059.12.

**Two things worth doing locally, outside this build order, because they're live money and a live landmine:**

1. **$360,108.24 across 48 charge rows is unwatched.** The house has posted these with no contractor invoice against them, aged 12–131 days (oldest APM-SL-00481, $5,465, 131 days; largest APM-SL-00562, $56,544). Gate 8 only ages invoices that *exist*, so a posted charge with nothing keyed is invisible to every gate. **Adding it as gate 10 is a 2-hour query.**
2. **The 2027 season rollover is a hard stop.** `config.toml` has `[season] year = 2026` hardcoded with no auto-derivation. On rollover every run fails gate 1 at ERROR severity and nothing publishes. `doctor.py` would catch it — but nobody runs doctor until it's already broken. **10 minutes: have doctor warn when the config season is behind the calendar year.**

**The clean future seam**, if it ever un-parks: `pickhaul/export.py` (~1 day) writing four season-scoped CSVs plus a gate-carrying manifest next to the report on every clean run, read by an operator-initiated upload. Never a scheduled pull, never a credential in Railway. And the *right* platform-side join is `pool_deduction`/`pool_charge_line` → `PackinghouseStatement` — `SettlementDeduction.category='pick_haul'` and `settlement_audit.py::_check_deduction_drift` already exist.

**What block grading should borrow from it: nothing.** I checked both databases.

| | `pack_reports.db` | `pickhaul.db` |
|---|---|---|
| Seasons | **2009–2026 (18)** | **2026 only** |
| Bins | 1,167 wash reports with bins | 374 receipts |
| Pick timing | `pack_date` on 1,234, `harvest_date` on 517 | `pick_date` on all 374 |
| Block attribution | **resolved to 60 canonical units** | **`block_map` = 0 rows**, 23 raw house-inconsistent strings |
| Pick & haul cost | **$12,264,144 picking + $1,122,763 hauling, block-tagged, 17 seasons** | $995K house-posted, 1 season |

Coupling would add a cross-machine dependency on a parked, single-season, block-unmapped database to obtain data the scoring database already carries at 18× the history with block identity resolved. **Don't.**

---

## 5. The landing dashboard

### Is this genuinely day-to-day? No. Say so.

Measured refresh cadence:

| Pillar | Newest datapoint | Refresh |
|---|---|---|
| **Pick & haul (parked)** | **2026-07-29 — yesterday** | on demand, ~1.5 receipts/day |
| Water | **2025-12-31 — 7 months stale** | 2/yr UWCD, 4/yr OBGMA (SAWCO monthly, 2 ranches) |
| Block grading | grade window locked 2023–2025 | once per season |
| Rentals — on-ranch | FY2025 | once per year |
| Rentals — off-ranch | Apr 2026 | monthly |

Water reading dates cluster `12-31: 107, 06-30: 102, 03-31: 68, 09-30: 66`. There is no June-2026 water row and there won't be until the agency bills.

**With pick & haul parked, the three active pillars produce a periodic-review instrument: a seasonal report card, a semi-annual water bill, and an annual rent roll.** Pick & haul was the only feed with a daily heartbeat.

That is not a reason to stop — it's a reason to name it correctly. **The value is: the operation's standing state, answered in two seconds instead of by opening four spreadsheets on one laptop.** That genuinely improves day-to-day operations. Calling it a daily feed would be the first false claim on the site.

There *is* a thin live layer, and it's real: the **REI countdown** (`/compliance/rei-postings/active/`, 60s poll, per-field timers, write-back action) and the **weather spray-condition rating**. Both stay, both get promoted onto the home screen. If a truly daily tool is the requirement, the honest options are un-parking pick & haul as a local-export seam, or uploading `PackinghouseDelivery` receipt tickets weekly — receipt-grain delivery date × field × bins is the finest data the platform already models.

### The screen

Replace `frontend/src/components/Dashboard.js` (120 lines, a pure composition shell — cheap to swap). Route stays `/dashboard`, relabeled **Operations**.

**Strip 0 — Live now** *(renders only when non-empty; a family viewer sees nothing here most days, which is correct)*
`ActiveREITicker` unchanged · spray-window chip per ranch · PHI-blocked fields from `/compliance/dashboard/today/`.

**Tile 1 — Where the ground stands.** Grade spread bar (1 A− · 5 B+ · 1 B · 3 B− · 2 C+ · 1 C− · 1 D+ · 1 F) · best/worst named (Saticoy 1B A− 1,184 ctn/ac; Piru Block 1 F 229, first picked 2022) · coverage line: **"15 of 60 scoring units graded; 27 carry an engine performance score"** · provenance chip: graded 2023–2025, engine verified 37/37, imported *date*.

**Tile 2 — Water.** 2025 cost **$550,622**, metered-and-priced **$140,789 (26%)** · **724.82 AF** agency + **107.32 AF** SAWCO · biggest exposure named: **Foster Park $167,030 against 19.36 metered AF** · rate callout: OBGMA GSP $0 → $100/AF, UWCD $43.75 → $192.34/AF.

**Tile 3 — Rental income.** On-ranch annual net and off-ranch GPR/NOI **side by side, never blended** (different grains) · the finding: **Office earned $82,376 renting, $393 farming (FY2024)** · **20 units, GPR $443,472**, with unit count shown next to occupant count · delinquency for the 3 statement-covered properties.

**Tile 4 — Ranch board.** One row per ranch, all 11: Bearing ac · Blocks graded · Best/worst grade · Water $/irrigated ac · Rental net · Entity / Finch %. Every cell carries a provenance badge; empty cells say **"not measured," never 0.** **Helicopter Ranch appears as a zero-unit ranch** — 31 source documents, no scoring unit was ever created in the crosswalk. Silently omitting it destroys trust in the whole board. 100%/Finch-share toggle in the header; **per-acre columns do not move when it flips.**

**Tile 5 — What needs Bird.** One ranked queue where all three pillars' blockers converge, each row stating the exact ask and how many figures it unblocks.

**Removed:** `AgenticHero`, `UnifiedTaskList` (wired for harvests but never receives them — `Dashboard.js:82-89` omits the prop), `QuickActionsGrid`, `SeasonProgressCard`. Three components sit unused in the repo and should be deleted or revived deliberately: `components/dashboard/ModuleStatusCard.js`, `components/dashboard/OperationalAlertsBanner.js`, `components/AnalyticsWidget.js`.

### `frontend/src/components/layout/SidebarNav.js`

```js
const NAV_GROUPS = [
  { id: 'top', items: [
      { id: 'dashboard', label: 'Operations', icon: LayoutDashboard }]},

  { id: 'performance', label: 'Performance', items: [
      { id: 'blocks',   label: 'Block Report Card', icon: Award },
      { id: 'water',    label: 'Water & Cost',      icon: Droplets },
      { id: 'rentals',  label: 'Rental Income',     icon: KeyRound },
      { id: 'harvests', label: 'Harvest & Packing', icon: Wheat }]},

  { id: 'ranches', label: 'Ranches', items: [
      { id: 'farms',   label: 'Ranches & Blocks', icon: HomeIcon },
      { id: 'acreage', label: 'Acreage',          icon: Ruler },
      { id: 'weather', label: 'Weather',          icon: Cloud }]},

  { id: 'fieldwork', label: 'Field Work', items: [
      { id: 'applications',   label: 'Spray Records',  icon: FlaskConical },
      { id: 'nutrients',      label: 'Nutrients',      icon: Leaf },
      { id: 'yield-forecast', label: 'Yield Forecast', icon: TrendingUp },
      { id: 'disease',        label: 'Disease Watch',  icon: Bug },
      { id: 'tree-detection', label: 'Tree Survey',    icon: TreePine }]},

  { id: 'required', label: 'Required Filings', items: [
      { id: 'compliance', label: 'Compliance', icon: Shield, children: [
          { id: 'compliance-pesticide',           label: 'PUR (monthly filing)' },
          { id: 'compliance-wps',                 label: 'WPS Training' },
          { id: 'compliance-licenses',            label: 'Licenses (PCA/QAL/QAC)' },
          { id: 'compliance-deadlines',           label: 'Deadlines' },
          { id: 'compliance-fsma',                label: 'FSMA' },
          { id: 'compliance-inspector-checklist', label: 'Inspector Checklist' },
          { id: 'compliance-reports',             label: 'Reports' },
          { id: 'compliance-primusgfs',           label: 'PrimusGFS / CAC' },
          { id: 'compliance-settings',            label: 'Settings' }]}]},

  { id: 'admin', label: 'Administration', items: [
      { id: 'analytics', label: 'Analytics',    icon: BarChart3 },
      { id: 'reports',   label: 'Reports',      icon: FileText },
      { id: 'activity',  label: 'Activity Log', icon: Activity },
      { id: 'team',      label: 'Team',         icon: Users },
      { id: 'company',   label: 'Settings',     icon: Building2 }]},
];
```

New `lucide-react` imports: `Award`, `KeyRound`, `Ruler`. **Performance is the new top group** — the re-aim made structural. **Compliance collapses from a top-level group to one item inside "Required Filings"** — the label change matters, it tells a family viewer why it's there. Renamed and demoted, never deleted. **"Applications" is relabeled "Spray Records"** because `/dashboard/applications` currently renders the PUR PDF import wizard, which nobody would guess. `Insights` dissolves: Weather → Ranches, Analytics/Reports → Administration.

Companion edits: `frontend/src/routes.js` (`VIEW_TO_PATH`/`PATH_TO_VIEW`/`VIEW_NAMES`/`PARENT_VIEWS`), `frontend/src/App.js`, and add all three to `TOGGLEABLE_MODULES` in `frontend/src/components/settings/ModuleVisibilitySettings.js`.

---

## 6. Build order

**Increment 0 — Foundation. 5–6 days. Non-negotiable first.**
Answer Decisions 1–3 (hours of work, everything downstream is conditional on them). Then: cut deploy to migrate-only, raise `max_farms`, `LegalEntity` + `Farm.owning_entity` + `finch_ownership_pct`, `RanchCropAcreage` from Setup - Acreage, seed 11 Farms + Fields with conflicts flagged, **and ship the `WellReading.save()` `af_source` guard.** That guard is here, not in Increment 2, because it's a live hazard on production data today. **Proves:** the 11 ranches exist with a defensible acreage denominator and the water data can no longer be corrupted by a UI save.

**Increment 1 — Block Grading. 28–35 days. Demoable on the live site.**
Snapshot import, ScoringUnit registry, report card, block detail, gated register, acres reconciliation, ranch roll-up shell.

**The demo: `/dashboard/blocks` — the Lemon Block Report Card, 15 blocks, on ojaifarmingco.com, badges live.** Why it beats every alternative: every number already exists and is verified (37 checks); nothing is computed on the server, so the risk is import-shaped not arithmetic-shaped; it says something no spreadsheet on your machine says — **eight letter grades under one sky, Saticoy 1B at 1,184 ctn/ac next to Saticoy 1C at 409 on identically-stated 15.00 acres**, which a ranch average erases entirely; and it's the first thing here that is a *URL* (the 2.21 MB dashboard HTML plus its 133 MB `_audit` folder cannot be emailed to family).

**Script:** open `/dashboard/blocks`, sort by overall, click Saticoy 1C (C−), show the F on revenue and the acres line reading `15.00 ac — packinghouse statement, even split, unconfirmed`, then jump to `/dashboard/acreage` and show 1A/1B/1C all at exactly 15.00 against a 2.89× spread. That's the pitch: **the platform tells you what it knows, what it assumes, and what it needs from you.** If you believe the badges here, you'll believe the water numbers later.

**Increment 2 — Water. 20–24 days.**
`WaterRateSchedule`, billing-row flagging, meter-config backfill, fee recompute, SAWCO import, QB monthly import, the three live aggregation bugs, six screens. Fills the water column of the ranch board. **Proves:** the site's water numbers are now correct where they were 16% inflated, and that 26% coverage is stated honestly rather than papered over.

**Increment 3 — Rentals. 16–20 days. Parallelizable with a second developer.**
Fully independent beyond Farm rows and `LegalEntity`. Sequenced last because it's the only pillar with no bearing on farming decisions, and because its recurring-work case is unproven until someone uses it.

---

## 7. What we cut, park, or keep-but-hide

| | Disposition |
|---|---|
| **Pick & haul platform ingestion** | **REVERSED July 30 — built.** See §4b: platform is the system of record; fetch stays local; auto-push over HTTPS with a machine token. The $360K blind spot became gate 11; the 2027 season warning shipped in doctor.py. |
| **Historical `PoolSettlement` backfill (860 statements)** | **Cut.** No `count_in_total`/`flagged` equivalent in the platform. Would put avocado at $19.3M beside a scorecard built on $8.95M. |
| **v2 five-factor engine dashboard, trends dashboard, `_audit` image evidence** | **Deferred.** The 133 MB / 896 files cannot ship. Citations without images. Real loss — mitigate by uploading source PDFs into `PackinghouseStatement` over time, separate small project. |
| **`Tenant` model** | **Cut from v1.** 31 people's emails and phones on a live site, no operational payoff. `occupant_label` string instead. |
| **Lease expiry / valuation board screens** | **Deferred.** Zero lease dates exist; underwritten NOI is 48% off actual. |
| **PrimusGFS / CAC** (40+ models, 44 components, all tables empty) | **Keep, sort last, first `getHiddenModules()` candidate.** Voluntary certification, not law. Deleting is expensive. |
| **PUR, WPS, Licenses, Deadlines, FSMA** | **Keep, demoted to "Required Filings."** CA DPR monthly filing, EPA 40 CFR Part 170, FSMA Produce Safety Rule. Nav visibility is localStorage-only, per-browser, and does not touch Celery — so hiding cannot break a filing. |
| **REI / PHI enforcement** | **Promoted onto the home screen.** The single most operationally live thing the platform has. |
| **`/api/analytics/dashboard/`, harvest `statistics`/`cost_analysis`** | **Left broken, moved to Administration.** Returns HTTP 200 with all zeros / HTTP 500. Out of scope, flagged. |
| **`ModuleStatusCard.js`, `OperationalAlertsBanner.js`, `AnalyticsWidget.js`** | **Delete or revive deliberately.** Imported nowhere. |

---

## 8. Decisions I need from you

1. **Open the Railway dashboard and read the backend service's Start Command.** If it's blank, `entrypoint.sh` runs and the Procfile is dead — which means someone loaded the water fixture by hand and nobody knows when. If it overrides to the Procfile, the resurrection hazard is live (`Farm.Meta.ordering=['name']`, so `Farm.objects.first()` becomes **"Foster Park"** once 11 ranches exist — the ranch with the *least* metered water). **Every deploy-safety claim in this plan is conditional on this answer.**

2. **Does the celery-worker Railway service exist?** `entrypoint.sh` doesn't start Celery; `settings.py` schedules 15 beat jobs including `auto_generate_monthly_pur_report`, `check_active_reis`, `check_license_expirations`. If it's not deployed, **PUR auto-generation and REI enforcement are already dead** — pre-existing, but this project will get blamed for it the moment we touch the platform.

3. **Grand House: 9.0 or 6.7 acres?** Two-band grade swing (B→A on both yield and revenue). And **Saticoy 1A/1B/1C** — is 15.00 each real, or an even split? A 2.89× productivity spread on identical stated acres is either the most interesting finding on the card or an acreage error. Blocking on both.

4. **Helicopter well `04N20W36D01S` or `04N20W25N03S`?** The fixture and workbook say the first; the parcel file is named the second. Helicopter is 9 bearing acres, Rio Vista is 55 — misattribution distorts both per-acre figures badly. Same question for **`Ranch:Irrig.`**, mapped to Foster Park by the Well Reference sheet but carrying `owner_code='RMLF'` (the Office entity), with $2,700 of 2025 billing that matches Office's scale far better than Foster Park's.

5. **Does SAWCO invoice monthly or quarterly?** Swings Sespe's annual fixed charge between $1,498 and $4,493, and its all-in between **$231 and $273/AF**. I couldn't determine it from the invoice worksheet. Related: confirm the $210.00/AF + $1.95/share rates are current — the only printed water rate anywhere in the project is on an undated sheet believed to be 2021.

6. **Confirm `finch_ownership_pct` for all 11 ranches.** Only Old Telegraph 90% is known, and it's *inferred* from a hardcoded `×0.9` in `Summary - Finch Share`!B12 — `Projection - Setup` column F ("Ownership %") is referenced by **zero formulas**, so an ownership change propagates nowhere today. Don't use the Finch-share toggle in an ownership conversation until these are confirmed.

---

## 9. Risks and landmines

**BLOCKING — fix before or during Increment 0**

- **`WellReading.save()` destroys agency acre-feet on the first UI edit.** Production is intact only by accident of JSON row order (fixture stored newest-first, so the recompute never fires — I simulated all 343 rows: **0 recomputed**). One edit through the UI, API, or admin writes **18,386 AF where the agency billed 59.14**, and a `$3,536,363` base fee. Fires on any well touched during *any* pillar's work. Ship the `af_source` guard first.
- **UWCD interim reads are being double-counted on the live site right now.** `water_views.py:42-50` and `sgma_views.py:1036-1058` both naive-`Sum` `extraction_acre_feet`. Fixing it will **reduce displayed AF by ~16% on UWCD wells** — announce that as a correction with the reconciliation evidence, or it reads as the platform losing data.
- **Nobody has queried production.** Every "live data" claim traces to `backend/fixtures/water_data_export.json`. The commissioning brief and my measurement disagree (`all zero` vs `257 non-zero`), which proves at least one party never looked. Get a `psql` readout before writing code.
- **Helicopter / Rio Vista entanglement defeats the canonical filter.** Seven `FINCH FARMS LLC / RIVER RANCH` pool documents are split across both ranches, **all `count_in_total=1`, all `flagged=0`** — Rio Vista-folder docs attributed to Helicopter and vice versa. Helicopter 2025 runs ≈2.8× P&L, Rio Vista 2024 ≈2.1×. The report card is insulated (neither ranch has a graded lemon block), but **the ranch roll-up would present these without warning.** No $-by-ranch tile ships until you decide which ranch owns the LLC fruit.

**HIGH**

- **The one place we can measure whether Finch keys data, the answer is no.** In `pickhaul.db`: **all 71 invoices are `source='migrated'`, all 319 links `assigned='migrated'`.** The entry workbook — the whole justification for that rebuild, 73 rows instead of 328 — has fed back **zero rows**, with two months of backlog and 40% of bins uninvoiced. Meanwhile `block_acres` has 15 rows with `loaded_at 2026-07-08` and a working ✎ editor that hasn't moved in three weeks. **Assume every deliverable requiring you to key something will not get keyed:** acres for 45 of 60 units, ownership % for 10 ranches, lease dates, market rents, on-ranch occupancy, Casitas acre-feet, SAWCO frequency. Moving the editor to a nicer UI will not change this. Design so the platform is useful without them, and badge what's missing.
- **Company.max_farms = 3.** Hard stop at ranch 4 of 11 on day one.
- **`GSA_CHOICES` is defined twice** (`water.py:22-30` and `:545-552`); the second wins and drops `'uwcd'`, so **9 of 14 live wells cannot be selected in the UI.** Fix or the attribution work isn't editable afterward.
- **Acres are the biggest lever and 45 of 60 units lack real ones.** If the platform ships with even-split placeholders unbadged, it publishes confident letter grades computed on invented denominators. **Every acres figure carries its source on the face of the card, not in a tooltip.**
- **Two live definitions of "money sizes" coexist:** the v2 engine's P3b premium set is `{115, 140}`; the report card uses `{115, 140, 165}`. Ship the report card; keep the v2 engine behind the admin route until reconciled.

**MEDIUM**

- **The pipeline can silently no-op.** The 2026-07-24 fidelity pass didn't run for four days because a `SyntaxError` killed one script on import and nothing asserted the chain had executed. The platform's only defence is the verify-tally gate — which is why `--allow-unverified` must be *loud*, never a convenience flag.
- **`wash_size_line.cartons` silently changes meaning** — carton-scale in the 2018 family, **bins from 2019+** on SLA weeklies, with no `uom` column. Visible in the raw data: **150,525 "bins" in 2018 across 257 reports** vs ~12,000/yr every other year. This exact break fabricated −15…−25%/yr trends in v1. The bundle carries an explicit unit per series; the platform never re-derives a trend from raw lines.
- **`Fordyce` is `active=True, well_status='active'`** for a sold ranch. Inflates any portfolio total today.
- **The published artifacts disagree with each other.** The 2.21 MB dashboard says 61 units against a 60-unit DB; the report-card HTML's not-graded reason for OLT-LEM is stale versus the V1.7 workbook (acreage is no longer the blocker — a per-variety seedless standard is); `Report_Card_Method.md` prints the pre-fidelity distribution. **Decide which artifact goes to the family before the platform version ships**, or three versions of Saticoy 1C will be in circulation.
- **RLS is invisible when wrong.** Migration 0088 must copy `0077_pur_rls_policies.py` verbatim including its `if schema_editor.connection.vendor != 'postgresql': return` guard. A green SQLite test suite proves *nothing* about production. Verify with `psql` after deploy.
- **HTTP-only portal credentials.** Not a platform risk once parked — but the four Saticoy logins still cross the network in clear text every fetch on your machine. Worth a portal-unique password and asking Saticoy to raise HTTPS with the vendor.