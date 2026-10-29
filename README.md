# 📚 英語管家 EngManager - 英文單字與句子雲端學習與遊戲複習系統

**英語管家 (EngManager)** 是一款跨平台英文學習工具，讓你從任何裝置**收集自己的單字與句子**，透過 **Supabase 免費遠端資料庫 (PostgreSQL)** 雲端即時雙向同步，並以 **4 種簡單小遊戲** 與 **翻卡間隔複習 (Leitner 5 級學習盒)** 幫你把英文真正記起來。支援 **Android 手機 (APK)**、**Windows PC 電腦版 (.exe)** 及 **PWA 網頁應用 (免安裝桌面版)**。

---

## 📌 核心功能特色

### 1. 📖 單字庫與句子庫管理
- **單字卡**：英文單字、KK/DJ 音標、詞性、中文意思、英文例句 + 例句翻譯、字源筆記。
- **句子卡**：英文句子 + 中文翻譯 + 用法筆記。
- 七種學習分類：`日常生活`、`旅遊`、`職場商務`、`學術`、`考試必備`、`口語俚語`、`其他`。
- 全文搜尋（英文/中文/筆記）＋ 快捷篩選（全部 / 收藏 / 待複習）＋ 分類晶片篩選。
- ⭐ 收藏（星號）機制，方便標記重點字句。
- 🔊 **免費英文發音**：內建 Web Speech API 文字轉語音（無需任何 API Key、支援離線），單字、句子、選項皆可朗讀。

### 2. ⏳ 翻卡間隔複習 (Leitner 學習盒)
- 每張單字/句子有一個 **熟練度等級 1-5**：`生疏(1) → 初識(2) → 熟悉(3) → 精通(4) → 大師(5)`。
- 自動追蹤複習次數與答對率；答錯熟練度重置回生疏，答對 +1。
- 學習首頁的「今日翻卡複習」會自動挑出 **熟練度最低、最久未複習** 的 8 張卡（單字 + 句子各半）。

### 3. 🎮 4 種複習小遊戲
| 遊戲 | 玩法 | 答對/答錯效果 |
|---|---|---|
| ⚡ 單字快問快答 | 英→中 / 中→英隨機四選一 | 熟練度 ± |
| 🔤 拼字闖關 | 依中文＋音標＋挖空例句提示，從字母方塊拼出單字（支援鍵盤輸入） | 熟練度 ± |
| ✏️ 句子填空 | 句子挖出關鍵單字，四選一填入 | 熟練度 ± |
| 🧩 排句成序 | 依中文提示把打亂的字卡排回正確句子 | 熟練度 ± |
- 出題可設定：**範圍**（全部 / 收藏 / 待複習）、**分類**、**題數**（5 / 8 / 10 / 15）。
- 到場彩帶慶祝（canvas-confetti）、每種遊戲保存最佳成績與完整歷史記錄。

### 4. ☁️ Supabase 遠端資料庫 (PostgreSQL) 雙向同步
- 免費雲端資料庫：settings 填入 `Project URL` + `anon Key` 即可，**跨手機/電腦資料即時同步**。
- 內建 **SQL 建表腳本一鍵複製**（`words` / `sentences` / `game_records` 三表 + Row Level Security 範本）。
- 智慧合併同步演算法：**按 id 合併 + 最新時間戳優先 + 刪除墓碑（Tombstone）機制**，多裝置同時編輯也不會復活已刪除資料。
- 未設定雲端時自動以本機 LocalStorage 離線運作，資料不會遺失。

### 5. 📊 學習歷程與資料備份
- 遊戲成效統計（場次、平均準確率、最佳成績）、熟練度分佈圖（1-5 級佔比條）。
- **多格式匯出**：完整 JSON 備份（可還原）、單字 CSV、句子 CSV（Excel 可直接開啟）。
- 系統診斷日誌檢視器（同步狀態、資料異動記錄，可一鍵複製匯出）。

---

## 🚀 快速開始 (Desktop Web / PWA)

```bash
# 1. 安裝專案依賴
npm install

# 2. 啟動本機開發伺服器 (https://localhost:443)
npm run dev

# 3. 正式打包 (TypeScript 檢查 + Vite 打包至 dist/)
npm run build
```

### 設定 Supabase 遠端資料庫（5 分鐘完成）
1. 到 [supabase.com](https://supabase.com) 免費註冊並 **New Project**（免費方案即可，免信用卡）。
2. 開啟本應用 → 右上角 **「設定雲端」** → **「查看 Supabase SQL 建表腳本」** → **複製 SQL**。
3. 在 Supabase Dashboard 的 **SQL Editor** 貼上並執行（建立 `words`、`sentences`、`game_records` 三張表）。
4. 到 Supabase 的 **Project Settings → API** 複製 **Project URL** 與 **anon public Key**。
5. 回到應用貼上網址與金鑰 → 開啟 **啟用 Supabase** → 按下「儲存並立即同步」完成！
6. 之後在任何一台手機/電腦輸入同樣的網址與金鑰，資料就會自動雙向同步。

---

## 🖥️ 跨平台打包指南 (Cross-Platform Compilation)

### 💻 1. 打包成 Windows PC 電腦版 (.exe)
```bash
npm run build:exe
```
> **產出檔案路徑**：`dist-win/EngManager-win32-x64/EngManager.exe`（綠色軟體，免安裝，可將整個資料夾壓縮後分享給其他人）

### 📱 2. 打包成 Android 手機版 (APK)
需要 JDK 21 與 Android SDK（腳本會自動偵測 Android Studio 內建工具鏈）：
```bash
npm run build:apk
```
> **產出檔案路徑**：`dist-apk/EngManager.apk`

如需開啟 Android Studio 進行進階原生調校：
```bash
npx cap open android
```

### 🌐 3. 網頁 PWA 免安裝桌面版
在 Chrome 或 Edge 開啟應用，點擊網址列右側「安裝應用程式」或「新增至主畫面」，即可將系統以獨立 App 視窗形式加到桌面或手機主畫面。

---

## 📂 專案檔案架構 (Directory Architecture)

```
engManager/
├── android/                      # Android 原生專案目錄 (Capacitor 首次打包時自動生成)
├── dist/                         # 前端 Vite 編譯輸出目錄
├── dist-apk/                     # Android APK 安裝檔輸出目錄
├── public/
│   ├── favicon.svg               # 應用圖示
│   ├── manifest.json             # PWA 宣告
│   └── sw.js                     # PWA Service Worker (離線快取)
├── src/
│   ├── components/               # UI 組件模組
│   │   ├── Header.tsx            # 頂端導覽列、雲端設定與診斷入口
│   │   ├── DashboardView.tsx     # 學習首頁:統計卡、今日翻卡複習、快速入口
│   │   ├── WordListView.tsx      # 單字庫列表 (搜尋/篩選/卡片)
│   │   ├── WordModal.tsx         # 單字新增/編輯 Modal
│   │   ├── SentenceListView.tsx  # 句子庫列表
│   │   ├── SentenceModal.tsx     # 句子新增/編輯 Modal
│   │   ├── GameView.tsx          # 複習遊戲中心 (4 種遊戲 + 出題設定)
│   │   ├── HistoryView.tsx       # 學習歷程、成效統計與備份匯出
│   │   ├── CloudSyncModal.tsx    # Supabase 遠端資料庫設定與 SQL 腳本
│   │   └── DebugLogModal.tsx     # 系統除錯日誌檢視 Modal
│   ├── services/                 # 核心服務邏輯
│   │   ├── storageService.ts     # LocalStorage 儲存、刪除墓碑與備份管理
│   │   ├── supabaseService.ts    # Supabase 雙向雲端同步與 SQL Schema
│   │   ├── syncUtils.ts          # 智慧合併 (按 id + 時間戳) 與衝突解決
│   │   ├── speechService.ts      # Web Speech API 英文發音服務
│   │   ├── loggerService.ts      # 系統日誌記錄服務
│   │   └── mockData.ts           # 初始示範資料 (10 單字 + 6 句子)
│   ├── types/index.ts            # TypeScript 資料介面 (Word/Sentence/GameRecord)
│   ├── App.tsx                   # 主應用:分頁控制、CRUD、同步排程
│   ├── index.css                 # Tailwind CSS 樣式與動畫
│   └── main.tsx                  # 應用程式進入點 + PWA 註冊
├── build-apk.bat                 # Android APK 一鍵自動編譯腳本
├── capacitor.config.ts           # Capacitor 跨平台配置
├── electron-main.cjs             # Electron 桌面視窗主程序
├── index.html                    # HTML5 主頁面
├── vite.config.ts                # Vite 構建配置 (base: './')
└── package.json                  # 專案套件與構建腳本
```

---

## 🛠️ 開發與建構指令 (Development Commands)

本專案基於 **React 19 + TypeScript + Vite + Tailwind CSS + Capacitor 8 + Electron + Supabase** 開發：

```bash
npm install     # 安裝專案依賴套件
npm run dev     # 啟動本機開發伺服器 (Web)
npm run build   # 前端靜態專案編譯 (檢查 TypeScript 與打包至 dist/)
npm run lint    # 程式碼靜態分析檢查 (oxlint)
npm run build:exe   # 打包 Windows PC 電腦版 (.exe)
npm run build:apk   # 一鍵編譯 Android 手機版 APK
```

---

## 🔒 資料隱私與安全說明

1. **本機優先**：所有單字、句子與遊戲記錄都先存於本機 LocalStorage；Supabase 是你自己的專屬資料庫，金鑰僅保存於本機設定中。
2. ** graveyard 墓碑機制**：刪除動作會記錄到本機墓碑清單，避免多裝置同步時被復活。
3. **資料備份與完整還原**：可隨時在「學習歷程」頁面匯出備份 JSON，無損移轉到新裝置。
4. **RLS 安全範本**：建表腳本內含 Row Level Security；進階使用者可搭配 Supabase Auth 做 per-user 資料隔離。

---

英語管家 EngManager © 2026 - 把遇到的英文核心句與單字，都變成你的雲端字庫
