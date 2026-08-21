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
- 效能分級：手機自動降級（陰影、植被密度、貼圖組、視距）；網址加 `?q=low` / `?q=high` 可強制，
  `?postfx=off` 可單獨關閉後製。遊戲內「暫停 → 畫質」也可切換（自動／高／省電）與光暈暗角開關。

## 風格化渲染

畫面走「高品質風格化冒險遊戲」路線，但保留 PBR 貼圖細節：

- **Toon 分層打光**（`world/stylize.ts`）：直接光的亮度被量化成數段（只量化亮度、保留色相），
  邊緣做柔化，讀起來像手繪陰影而非色階斷裂；量化只會壓暗不會提亮，避免大面積鋪面過曝。
- **Rim light**：菲涅耳邊緣光，顏色隨天氣（黃昏最暖）。朝上的地面會淡出邊緣光——否則每一片
  地板在掠角下都會變成白紙。
- **樹葉透光**：太陽在背後時葉片透出光，黃昏時整片樹冠邊緣發亮。
- **天空**：漸層穹頂 + 太陽輝光 + 地平線霧帶（`world/Sky.tsx`），釘在鏡頭上，切換天氣時平滑過渡。
- **水面**：淡水河雙尺度波紋、fresnel 映天、太陽鏡面光帶（`world/Water.tsx`）。
- **風與草**：全域風時鐘（`world/wind.ts`）驅動樹冠與灌木；草地為 instanced 草葉，隨風擺動並
  在玩家經過時壓彎回彈（`world/Grass.tsx`）。
- **後製**（僅高畫質）：高門檻 bloom（只吃宮燈、亮窗與太陽）＋暗角與極輕微暖調；
  tone mapping 交給 OutputPass，避免重複套用。
- **植栽 LOD**：`vegetationRange` 內用精細模型、外用低面數 blob，玩家移動超過 25 公尺才重建
  instance buffer。

## 角色骨骼動畫

玩家與 NPC 都是**真正的蒙皮角色**，骨架與動作全部以程式生成（`src/game/character/`），
沒有引入外部角色素材，因此不帶任何授權風險。

- **骨架**（`rig.ts`）：`THREE.Bone` 階層（hips → spine → chest → neck → head、雙臂、雙腿），
  身體幾何直接在 bind space 建構並帶逐頂點 `skinIndex` / `skinWeight`；關節處與父骨混合權重，
  所以手肘與膝蓋是彎折而不是剪切。頭、頭髮、臉與背包掛在骨頭下剛性跟隨，不參與蒙皮。
- **動作**（`clips.ts`）：手寫的 `AnimationClip` — idle（呼吸、重心微移）、walk、run，
  以步態函式取樣成 `QuaternionKeyframeTrack`，因此兩種步態天生同相位，混合時雙腿不會互穿。
- **混合**（`useCharacterAnimation.ts`）：三個 action 以連續權重同時播放（而非狀態機切換），
  速度在走／跑之間時就自然呈現慢跑；步頻＝地面速度÷步幅，避免腳底打滑，並夾在合理範圍內。
- 角色以 imperative 方式組裝後再交給 R3F —— `SkinnedMesh` 在第一次更新世界矩陣時就會存取
  `skeleton`，先掛載後綁定必定在第一幀丟例外。

## 授權

本專案為非官方的校園巡禮作品，地標與建築為程式重建，僅供欣賞與學習。
