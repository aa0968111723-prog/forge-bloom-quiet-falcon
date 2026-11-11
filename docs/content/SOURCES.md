# 來源

查閱日期：2026-11-11。沒有實測。座標仍是 estimated。

## 本輪有打開的官方頁

- 新生頁 https://freshman.web.tku.edu.tw/tw/g/school.html  
  地址寫 251301 新北市淡水區英專路 151 號。機車可申請停五虎崗或大忠街。校園地圖指向總務處，本輪沒有另下載地圖圖檔。
- 學術單位 https://classic.tku.edu.tw/acad.asp  
  九學院與下列科系。公共行政暨法律學系頁面寫 115 學年度更名。
- 覺生紀念圖書館總館 https://www.lib.tku.edu.tw/Front/AboutUs/Openinghoursandpremises/MainBuilding/Page.aspx?id=%2BCcwjg98bKg%3D  
  Last Updated 2026/10/26。啟用 85 年 9 月 23 日，使用面積 7000 餘建坪，閱覽座位 2,806 席，頁面列出一到九樓。地址寫 251302。

## 沿用、本輪沒有重新下載

- 校園圖 PDF：https://classic.tku.edu.tw/doc/CampusMap202103.pdf  
  檔名表示 2021-03。registry 已經引用。本輪沒有下載 PDF 位元，所以不把建物尺寸升成 surveyed，也不把列數說成已查證建築數。
- `src/game/world-data/references.ts` 的 132 階、約 200 公尺宮燈大道、1954 宮燈教室等句子沒有附 URL。維持該檔原本的 mapped 上限，座標仍是 estimated。

## 衝突

- 郵遞區號：新生頁 251301，圖書館頁 251302。路名與門牌相同。見 `meta:postal-address`。
- `departments.ts` 的「數學系」與官方頁「應用數學與數據科學學系」不是同一個名稱，沒有合併 id。
- `departments.ts` 的「醫學資訊與創新應用學士學位學程」沒有出現在本輪這份精準健康學院清單。不刪除既有 id。
- 「化學系」與「化學學系」差一個字，先沿用 `chemistry`，標待核對。

## 虛構與現實

NPC、任務與異象是 fictional。建物名稱與官方頁上的句子是 factual。入口、補給點、匿名道路是 gameplay-adaptation。虛構文字若出現「校方公告」或「真實校園事故」，必須同時寫明它不是。
