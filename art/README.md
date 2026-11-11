# art/ — 可編輯美術來源

這裡是遊戲美術的來源；`public/game-art/` 是由這裡重建出的輸出。
流程、命令與驗證規則見 `docs/art/PIPELINE.md`。

- `assets.json`：每件資產的紀錄（id、來源、授權、輸出、預算、runtime 位置、狀態、證據）。
- `index.ts`：id 對應的 builder。
- `shared/`：建模、蒙皮、貼圖與量化工具。
- `characters/student-kit/`：學生角色組。`spec.ts` 是可調參數（配色、骨架、比例、預算）。
- `creatures/quiz/`：突擊小考。

所有幾何、貼圖與動畫均為本專案以程式撰寫，不含第三方素材。修改後執行：

```sh
npm run art:export
npm run art:validate -- --rebuild
```
