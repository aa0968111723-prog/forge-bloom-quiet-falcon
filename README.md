# 淡江世界

以淡江大學淡水校園真實走道重建的 3D 校園巡禮。從克難坡一百三十二階登上驚聲銅像，走進兩側碧瓦紅牆宮燈教室夾道的石板大道，北望海豚里程碑、書卷廣場與覺生紀念圖書館。

## 巡禮地標

1. 克難坡
2. 驚聲銅像廣場
3. 宮燈教室
4. 宮燈大道
5. 海豚里程碑
6. 書卷廣場
7. 覺生紀念圖書館
8. 牧羊草坪
9. 海事博物館
10. 五虎碑

到各地標按互動即可蓋章；登入後可把進度存到雲端。支援日晝、宮燈夕照、夜訪三種光影。

## 操作

| 裝置 | 操作 |
| --- | --- |
| 鍵盤 | `WASD` 移動 · 滑鼠視角 · `E` 蓋章 · `Shift` 奔跑 · `Esc` 選單 |
| 觸控 | 左搖桿移動 · 右側拖曳視角 · 蓋章／奔跑鈕 |

## 本機執行

需要 Node.js 22。

```bash
npm install
npm run dev
```

瀏覽器開啟提示的本機位址即可遊玩。建置：

```bash
npm run build
npm run preview
```

技術棧：React 19、React Three Fiber、Three.js、TanStack Start、Tailwind CSS v4、Zustand、Better Auth。

## Reality Pass v1

校園以「淡江世界座標系」重建：1 個 world unit = 1 公尺，原點在驚聲銅像廣場，-Z 為真實北方。克難坡為
132 階實階（兩段樓梯夾中間平台，由階高與踏面推導全形），宮燈大道全長 200 公尺，主軸「校門 → 克難坡 →
驚聲銅像廣場 → 宮燈教室 → 宮燈大道 → 海豚里程碑 → 書卷廣場 → 覺生紀念圖書館」按真實距離配置。

- 空間資料層：`src/game/world-data/`（純資料與純函式，可獨立單元測試）。每筆地標帶
  `accuracy: surveyed | mapped | estimated` 與引用來源；未經實測的數字一律標 `estimated`。
- 材質庫：`npm run gen:materials` 以 `scripts/gen-materials.mjs` 重生 `public/materials/tamkang/`
  的 20 組 PBR 貼圖（basecolor / normal / roughness / AO）。
- CC0 模型：`public/models/vendor/`（Quaternius 樹木、KayKit 街道小物），授權見該目錄 ATTRIBUTION.md。
- Reality Compare Mode：遊戲中按 `F8` 開啟固定 benchmark 鏡頭與「真實 vs 遊戲」尺寸偏差表，`[` `]` 切換。
- 視覺回歸：`node scripts/reality-regression.mjs`（需先 `npm run dev`）擷取全部 benchmark、實際按鍵走完
  克難坡到圖書館全程、並做手機視窗煙霧測試與效能統計。
- 效能分級：手機自動降級（陰影、植被密度、貼圖組、視距）；網址加 `?q=low` / `?q=high` 可強制。

## 授權

本專案為非官方的校園巡禮作品，地標與建築為程式重建，僅供欣賞與學習。
