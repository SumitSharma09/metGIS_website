# MetGIS — Tower Weather Operations Console

A production-ready React + TypeScript frontend for monitoring weather conditions and
risk across telecom tower infrastructure, functionally comparable to map-centric
infrastructure weather-ops portals (e.g. Skymet-style tower weather consoles). This is
an original implementation — its own components, styling and code — not a copy of any
existing site's assets or source.

The app runs on an **in-memory mock API layer** (~20 representative sites across Indian
states/districts, generated observations/forecast/history/alerts) so every screen is
fully interactive out of the box. It's architected so a real backend can be dropped in
behind the same API service layer with a single environment variable change — see
[Connecting a real backend](#connecting-a-real-backend). A companion **Spring Boot**
backend implementing this exact contract lives in [`backend/`](../backend) — see its own
README for setup.

## Primary navigation

The app is a map-first ops console, not a card dashboard. The top nav has four sections:

- **Live Map** — interactive India map, state/district drill-down, parameter layer
  toggles (temperature/rainfall/cloud/visibility/fog/wind), severity-colored site
  markers, satellite/street basemap toggle, simplified wind-flow overlay, and a 7-day
  animated timeline scrubber (daily steps, or an hourly bar that scrubs hour-by-hour
  across the full 7 days; play/pause/speed).
- **Alerts** — card feed (Active/History tabs), date-range + severity filters, each card
  shows issued/expires timestamps, detail dialog with a mini map and acknowledge/resolve
  actions.
- **Reports** — "Tower Risk Reports": region filters, risk-distribution charts, a
  per-site risk table, a region risk map, and a Short-Range/Long-Range 7-day forecast
  table, with Excel and PDF export. Also two Daily Bulletin views (National and Circle
  Wise) and a "Saved Reports" tab for the generate/download/delete report-job workflow.
- **Comparison** — forecast-vs-actual accuracy KPIs, a daily trend chart, and a
  site/day comparison grid, with Excel export.

A settings gear in the top bar opens profile/theme/sign-out; a slim status footer shows
data-source and last-synced info. Dark theme is the default (toggle in the settings menu).

Legacy routes from the original card-dashboard build (`/dashboard`, `/sites`,
`/observations`, `/historical`, `/forecast`) are still registered (e.g. `SiteDetailPage`
is reused when you open a map marker's "View site details" link) but are no longer in
the primary nav.

## Tech stack

| Concern            | Choice                                                |
|---------------------|--------------------------------------------------------|
| Framework           | React 18 + TypeScript, built with Vite                |
| Routing             | React Router v6 (lazy-loaded routes)                  |
| UI components       | MUI (Material UI) v5                                  |
| State management    | Redux Toolkit + RTK Query (single `api` slice)        |
| Charts              | ApexCharts (`react-apexcharts`)                       |
| Maps                | Leaflet + react-leaflet (OSM street / Esri satellite) |
| Exports             | SheetJS (`xlsx`) for Excel, `jspdf` + `jspdf-autotable` for PDF |
| Forms & validation  | React Hook Form + Zod                                 |
| HTTP client         | Axios (used once a real backend is connected)         |
| Notifications/toasts| notistack                                             |
| Dates               | Day.js + MUI X Date Pickers                           |

## Getting started

Requires Node.js 18+ (20 LTS recommended).

```bash
npm install
cp .env.example .env      # defaults already point at the mock API
npm run dev                # starts the Vite dev server (http://localhost:5173)
```

Demo login credentials (see `src/api/mock/data/users.ts`):

| Role     | Username  | Password      |
|----------|-----------|---------------|
| Admin    | `admin`   | `admin123`    |
| Operator | `operator`| `operator123` |
| Viewer   | `viewer`  | `viewer123`   |

Other scripts:

```bash
npm run build     # type-check (tsc -b) + production build to dist/
npm run preview   # preview the production build locally
npm run lint      # eslint
```

> **Note on this deliverable:** this project was authored in an environment without
> package-registry access, so `npm install` has not been run or verified here. The code
> follows standard, current APIs for every listed dependency, but please run
> `npm install && npm run build` as your first step and let us know if anything needs a
> version bump.

## Project structure

```
src/
  api/
    apiSlice.ts        # single RTK Query "api" slice (injectEndpoints per feature)
    axiosClient.ts      # axios instance for the real backend (auth header, error shape)
    queryHelpers.ts      # restRequest<T>() helper used by every endpoint's real-backend branch
    mock/                # in-memory mock backend (data generators + helpers)
  app/                  # Redux store + typed hooks
  components/
    common/              # DataTable, StatCard, ChartCard, FilterBar, dialogs, states, etc.
    layout/              # OpsTopNav (top tab bar), StatusFooter, notification/profile menus
    charts/              # ApexCharts wrappers (line/area, bar, donut)
    weather/             # WeatherCard, ForecastStrip, condition-to-icon mapping
  features/               # one folder per domain: types.ts + <domain>Api.ts (+ slice.ts)
    auth/ users/ sites/ weather/ alerts/ reports/ dashboard/ search/ ui/
  layouts/               # AuthLayout (login), DashboardLayout (top nav + content + footer)
  pages/
    live-map/             # Live Map page + map controls/legend/timeline/markers
    alerts/               # Alerts card feed + detail dialog (mini map)
    reports/               # Tower Risk Reports tab + Saved Reports tab + export helpers
    comparison/            # Forecast vs actual comparison page
    ... (legacy dashboard/sites/weather/historical/forecast/profile pages)
  routes/                # route paths, <AppRoutes>, ProtectedRoute/PublicOnlyRoute
  theme/                 # MUI theme (light/dark), severity/chart color tokens
  utils/
    severity.ts           # shared risk-band classification (map/alerts/reports)
    constants.ts, formatters.ts, useClock.ts, validation.ts
```

### Why one Redux Toolkit "api" slice?

Every domain (`sites`, `weather`, `alerts`, ...) calls `apiSlice.injectEndpoints(...)`
instead of creating its own `createApi`. That keeps a single reducer/middleware wired
into the store while letting endpoint definitions live next to the feature they belong
to. Every endpoint provides its own `queryFn`, which branches on `VITE_USE_MOCK_API`:

```ts
queryFn: async (arg) => {
  if (isMockMode) {
    // read/write the in-memory mock data in src/api/mock/**
  }
  return restRequest<ResultType>({ url: '/some/endpoint', method: 'GET', params: arg });
},
```

This makes the REST contract explicit in code (see the comment above each `injectEndpoints`
block) and means flipping `VITE_USE_MOCK_API=false` in `.env` is the *only* change needed
to start hitting a real backend, once it implements the contract below.

### Shared risk classification

`src/utils/severity.ts` defines one four-band risk scale (`none`/`watch`/`alert`/`warning`,
with context-specific labels — "No warning/Watch/Alert/Warning" on the map legend,
"Normal/Moderate/High/Extreme" on risk reports) and per-parameter thresholds. The Live
Map marker colors, the Reports risk table/heatmap, and `src/pages/reports/riskAggregation.ts`
(overall per-site risk) all derive from this one module, so the three screens never
disagree about what counts as "high risk".

### Forecast-vs-actual data (Comparison page)

There's no persisted archive of past forecasts to diff against — like most weather
mock layers, `src/api/mock/data/weather.ts` only forecasts forward from "now". The
Comparison page (`src/pages/comparison/comparisonData.ts`) derives a stable, seeded
"as predicted" value for each past day from the same deterministic generator used
everywhere else, offset by a bounded pseudo-error representing typical day-ahead drift.
It reproduces identically across reloads. The Spring Boot backend's equivalent endpoint
(`GET /reports/forecast-accuracy`) should be backed by an actual forecast-issue log once
one exists — see the backend README.

## Connecting a real backend

1. Implement the REST API described below (any stack is fine — Node/Express, Django,
   Spring, etc.) matching the request/response shapes already used by the frontend
   (see each `*Api.ts` file's top comment and the `types.ts` in the same feature folder).
   The `backend/` folder in this delivery already implements this contract in Spring Boot.
2. Set `VITE_API_BASE_URL` in `.env` to the backend's base URL.
3. Set `VITE_USE_MOCK_API=false`.
4. `axiosClient` (in `src/api/axiosClient.ts`) already attaches `Authorization: Bearer <token>`
   from local storage and clears the session on a `401` — no other frontend change should
   be required for a straightforward REST backend.

### API contract

All list endpoints return `{ items, total, page, pageSize }`. All error responses are
expected as an HTTP error status with a JSON body `{ message: string }`.

**Auth**
```
POST   /auth/login              { username, password }            -> { token, user }
POST   /auth/logout             (Authorization header)             -> 204
```

**Users**
```
GET    /users                                                      -> UserProfile[]
GET    /users/:id                                                  -> UserProfile
PUT    /users/:id                { fullName, email, phone, ... }    -> UserProfile
POST   /users/:id/change-password { currentPassword, newPassword }  -> { success }
```

**Sites / locations**
```
GET    /sites?search=&circle=&state=&district=&status=&page=&pageSize=&sortBy=&sortDir=  -> Paginated<Site>
GET    /sites/:id                                                        -> Site
GET    /sites/circles                                                    -> string[]
GET    /sites/states                                                     -> string[]
GET    /sites/districts?state=                                           -> string[]
```

**Weather (current / historical / forecast)**
```
GET    /weather/current?siteIds=id1,id2       -> CurrentObservation[]  (all sites if omitted)
GET    /weather/current/:siteId               -> CurrentObservation
GET    /weather/current?siteIds=&at=<iso>     -> CurrentObservation[]  (snapshot at a point in time -
                                                  past or forecast - used by the Live Map timeline
                                                  scrubber and Reports regional heatmap)
GET    /weather/historical?siteId=&from=&to=&interval=hourly|daily -> HistoricalPoint[]
GET    /weather/forecast/:siteId?days=7       -> ForecastDay[]
```

**Alerts / notifications**
```
GET    /alerts?search=&severity=&status=&siteId=&page=&pageSize=  -> Paginated<AlertItem>
GET    /alerts/:id                                                 -> AlertItem
PATCH  /alerts/:id/read                                            -> AlertItem
PATCH  /alerts/:id/status         { status }                       -> AlertItem
GET    /alerts/unread-count                                        -> { count }
```
`AlertItem` includes both `triggeredAt` (issued) and `expiresAt` (validity window end),
shown as "Issued"/"Expires" on the Alerts card feed.

**Reports**
```
GET    /reports?search=&status=&page=&pageSize=                                    -> Paginated<ReportItem>
POST   /reports    { title, siteIds, parameters, dateFrom, dateTo, format }          -> ReportItem
DELETE /reports/:id                                                                  -> { success }
GET    /reports/:id/download                                                        -> binary file stream
GET    /reports/forecast-accuracy?siteIds=&days=                                    -> ComparisonRow[]  (proposed;
                                                                                        see Comparison page notes above)
```

**Dashboard**
```
GET    /dashboard/stats     -> DashboardStats (site counts, active alerts by severity,
                                avg temperature, rainfall today, top rainfall sites,
                                per-circle summary, recent alerts)
```

**Search**
```
GET    /search?q=term      -> { sites: [...], alerts: [...], reports: [...] }  (top matches per type)
```

Exact field-level shapes are defined as TypeScript interfaces next to each feature's API
file, e.g. `src/features/sites/types.ts`, `src/features/weather/types.ts`, etc. — use
those as the source of truth when implementing backend models/DTOs. The `backend/`
Spring Boot project mirrors these already.

## Feature overview

- **Login** — username/password with validation, remember-me, demo credential hint.
- **Live Map** — state/district cascading filters, parameter layer toggles, severity
  markers with popups (quick stats + link to site detail), satellite/street basemap,
  simplified wind-flow overlay, 7-day timeline scrubber (daily or hour-by-hour across
  the full week).
- **Alerts** — Active/History card feed, severity + date-range filters, issued/expires
  timestamps, detail dialog with a mini map, acknowledge/resolve actions, topbar
  notification bell with unread badge.
- **Tower Risk Reports** — region filters, overall/parameter risk distribution charts,
  site risk table, region risk map, Short-Range/Long-Range 7-day forecast table, Daily
  Bulletin (National and Circle Wise), Excel + PDF export; Saved Reports tab for the
  generate/list/download/delete report-job workflow.
- **Comparison** — forecast-vs-actual KPIs (accuracy %, MAE), daily trend chart,
  per-site/day comparison grid, Excel export.
- **Profile** — edit profile details, change password, role/last-login summary.
- Legacy (kept, not in primary nav): card Dashboard, Sites list/detail, Weather
  Observations, Historical Data, Forecast — reused by `SiteDetailPage` from the map.
- Shared: top tab nav with live clock + settings gear, light/dark theme (dark default),
  loading skeletons, error states with retry, empty states, confirm dialogs, reusable
  data table with sorting/pagination.

## Next steps

1. Run `npm install && npm run build` and fix any dependency-version issues that surface.
2. Share the actual database schema — the mock data shapes in `src/features/*/types.ts`
   and the REST contract above are the proposed target; happy to adjust either to match
   your schema before backend work starts.
3. Set up the Spring Boot backend in `backend/` (see its README), point
   `VITE_API_BASE_URL` at it, and flip `VITE_USE_MOCK_API=false`.
