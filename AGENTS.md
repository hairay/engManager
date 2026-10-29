# AGENTS.md

Guidance for OpenCode sessions working in this repo. EngManager (英語管家) is an
English word & sentence cloud learning manager: React 19 + TypeScript + Vite +
Tailwind + Supabase remote DB + Electron/Capacitor wrappers. UI strings and type
literals are Traditional Chinese (zh-TW) — preserve locale when editing.

## Commands

- `npm install` — install deps (run once before anything else).
- `npm run dev` — Vite dev server (web only, HTTPS on port 443 by default).
- `npm run build` — **`tsc -b && vite build`**. This is the only typecheck step;
  there is no separate `typecheck` script. Run this (or `npx tsc -b`) to validate
  types. Output goes to `dist/`.
- `npm run lint` — **oxlint** (NOT eslint). Config in `.oxlintrc.json`.
- `npm run build:exe` — runs build, then `electron-packager` →
  `dist-win/EngManager-win32-x64/EngManager.exe` (Windows x64 only).
- `npm run build:apk` — runs build, Capacitor sync (auto `cap add android` on
  first run), and compiles Android APK via Gradle → `dist-apk/EngManager.apk`.

There is **no test framework** and no CI configured.

## Architecture & entrypoints

- Two entrypoints: `src/main.tsx` (web/Vite) and `electron-main.cjs` (Electron
  desktop). `package.json` `main` → `electron-main.cjs`.
- `electron-main.cjs` is CommonJS by necessity: `package.json` sets
  `"type": "module"`, so the `.cjs` extension is what keeps it CJS. Keep it that
  way. Electron loads `dist/index.html` via `loadFile` after `npm run build`.
- `vite.config.ts` uses `base: './'` deliberately for Electron `file://`
  loading — do **not** switch to absolute paths.
- `electron-main.cjs` disables GPU/hardware acceleration and sandbox when the
  exe runs from a UNC/non-C: path; keep these switches.

## Source layout

- `src/components/*` — view components (Dashboard, WordList, SentenceList,
  GameView, History, modals). `App.tsx` holds tab state, CRUD handlers and the
  sync loop; all data mutations go through `StorageService` + `triggerCloudSync`.
- `src/services/storageService.ts` — localStorage keys prefixed
  `engmanager_`. It also tracks **deletion tombstones**
  (`engmanager_deleted_*_ids`) used to resolve cloud-sync conflicts — keep
  tombstone writes when adding new delete operations.
- `src/services/supabaseService.ts` — remote DB sync (pull → merge → tombstone
  delete → upsert) and the `SUPABASE_SQL_SCHEMA` string shown to users in
  CloudSyncModal. Keep schema string and `src/types/index.ts` fields in sync.
- `src/services/syncUtils.ts` — mergeByIdSmart: latest updatedAt wins.
- `src/services/speechService.ts` — Web Speech API TTS; voices list must be
  warmed up via `SpeechService.warmUp()` on startup.
- `GameView.tsx` — 4 games (word_quiz / word_spelling / sentence_cloze /
  sentence_scramble). Answer results call `onWordResult` /
  `onSentenceResult` to bump Leitner levels (correct +1 max 5, wrong → 1).
- `src/types/index.ts` — shared interfaces; several union types use Chinese
  string literals via label maps (e.g. `WORD_CATEGORY_LABELS`).

## TypeScript conventions (enforced)

From `tsconfig.app.json`:
- `verbatimModuleSyntax: true` → **always use `import type`** for type-only
  imports, or the build fails.
- `noUnusedLocals` / `noUnusedParameters` → no dead vars/params.
- `erasableSyntaxOnly` → no TS-only runtime constructs (no enums/namespaces);
  use plain objects/types + label Record maps.
- `noEmit: true` → tsc only typechecks; Vite does the actual bundling.

## Agent Workflow (CRITICAL)

- **Self-Testing is Required**: Whenever you modify complex logic (e.g. cloud
  sync, merge algorithm, game question builders), verify logic locally with a
  standalone Node script before asking the user to test in the app.
- After any source edit run `npm run build` to validate types, since tsc is the
  only gate.

## Notes

- `dist/`, `dist-win/`, `dist-apk/`, and `android/` are build outputs (gitignored
  or generated) — never edit by hand.
- Mock/demo data lives in `src/services/mockData.ts`; first launch seeds
  localStorage with it. `StorageService.isDemoDataOnly()` / `clearDemoData()`
  evict demo rows when real cloud data arrives — do not seed demo IDs into the
  cloud on first sync.
