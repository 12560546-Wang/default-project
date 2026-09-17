# Default Project

全端 Node.js / TypeScript 標準化專案範本，內含模組化後端 API、測試、Lint、格式化與 CI 設定，並附帶一款雙人同機射擊遊戲。

## 遊戲：DUO SHOOTER 雙人射擊

瀏覽器開啟 `http://localhost:3000/` 即可遊玩。兩名玩家在同一台電腦上合作抵禦一波波敵人，擊殺敵人得分，最高分儲存於瀏覽器 `localStorage`。

**操作方式**

| 玩家     | 移動            | 射擊    |
| -------- | --------------- | ------- |
| P1（藍） | `W` `A` `S` `D` | `Space` |
| P2（橘） | `↑` `↓` `←` `→` | `Enter` |

`P` 暫停 / `Esc` 返回、`M` 靜音、`R` 重新開始。

**玩法**

- 敵人由畫面四周生成，分為追擊型與射手型，血量與速度隨波次提升。
- 擊殺敵人隨機掉落強化：`+` 回血、`»` 連射、`W` 三向彈、`O` 護盾。
- 每波清除可獲得額外分數；倒下的玩家會在下一波以半血復活。
- 兩名玩家同時倒下即結束遊戲，並自動記錄最高分。

**遊戲原始碼**：`public/index.html`、`public/game.js`（純前端 Canvas，無額外建置步驟）。

## 技術棧

| 分類          | 工具                            |
| ------------- | ------------------------------- |
| 執行環境      | Node.js ≥ 22, npm ≥ 11          |
| 語言          | TypeScript (strict)             |
| 後端框架      | Express 5                       |
| 測試          | Vitest + Supertest              |
| Lint / 格式化 | ESLint (flat config) + Prettier |
| 環境變數      | dotenv + zod 驗證               |

## 專案結構

```
├── src/                  # 原始碼
│   ├── config/           # 環境變數、設定載入
│   ├── middleware/       # Express 中介層（錯誤處理等）
│   ├── routes/           # 路由定義
│   ├── services/         # 業務邏輯
│   ├── app.ts            # Express 應用程式工廠
│   └── index.ts          # 進入點
├── tests/                # 單元 / 整合測試
├── public/               # 靜態前端檔案
├── docs/                 # 文件（如有需要）
├── .env.example          # 環境變數範本
├── eslint.config.mjs     # ESLint 設定
├── vitest.config.ts      # 測試設定
├── tsconfig.json         # TypeScript 設定
└── package.json          # npm scripts
```

## 快速開始

```bash
# 1. 安裝相依套件
npm install

# 2. 複製環境變數範本
cp .env.example .env

# 3. 啟動開發伺服器（自動重載）
npm run dev
```

伺服器預設執行於 `http://localhost:3000`，可用 `GET /health` 驗證。

## 常用指令

| 指令                    | 說明                           |
| ----------------------- | ------------------------------ |
| `npm run dev`           | 開發模式（tsx watch 自動重載） |
| `npm run build`         | TypeScript 編譯至 `dist/`      |
| `npm start`             | 執行編譯後的伺服器             |
| `npm test`              | 執行測試（Vitest）             |
| `npm run test:coverage` | 測試並產出涵蓋率報告           |
| `npm run typecheck`     | 型別檢查（不產出檔案）         |
| `npm run lint`          | ESLint 檢查                    |
| `npm run format`        | Prettier 格式化                |
| `npm run format:check`  | 檢查格式                       |

## 環境變數

請參考 [.env.example](.env.example)，所有變數皆由 `src/config/env.ts` 以 zod 驗證，缺漏或格式錯誤會在啟動時直接錯誤退出。

- `NODE_ENV` — `development` / `test` / `production`
- `PORT` — HTTP 埠號（預設 3000）
- `JWT_SECRET` — 簽章密鑰，正式環境務必使用至少 32 字元的隨機字串
- `CORS_ORIGIN` — 允許的前端來源

## CI / 部署

`.github/workflows/ci.yml` 會在每次 Push 時執行測試、Lint 與型別檢查，確保程式碼品質。

## 授權

保留所有權利（尚未指定授權條款）。
