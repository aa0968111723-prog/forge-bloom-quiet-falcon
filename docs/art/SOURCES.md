# 來源與授權

精度分級沿用程式清冊：`estimated`（尚未確認的估計）、`mapped`（依來源資料判讀）、`surveyed`（有實際測量證據）。
製作狀態與資料精度分開記錄；目前清冊 64 筆全部是 `estimated`，沒有任何一筆可宣稱 1:1 還原。

## 官方資料（淡江大學）

查閱日期：2026-11-11（UTC）。本次只確認可連線（HTTP 200）與檔案類型；尚未逐筆判讀內容（見 BACKLOG ART-060／ART-061）。
未見明確開放授權，視為「僅供參考、不重新散布」；儲存庫不收錄這些檔案或截圖。

| 用途 | URL | 本次結果 | 授權狀態 |
| --- | --- | --- | --- |
| 官方校園圖（2021-03） | https://classic.tku.edu.tw/doc/CampusMap202103.pdf | 200，application/pdf，3,743,559 bytes | 未標示授權；僅參考 |
| 學術單位與科系名單 | https://classic.tku.edu.tw/acad.asp | 200，text/html | 未標示授權；僅參考 |
| 新生校園介紹 | https://freshman.web.tku.edu.tw/tw/g/school.html | 200，text/html | 未標示授權；僅參考 |
| 總務處 | https://www.general.tku.edu.tw/ | 200，text/html | 未標示授權；僅參考 |
| 場地租借清單 | https://spacerental.tku.edu.tw/spacelisting.aspx | 200，text/html | 未標示授權；僅參考 |
| 校園照片庫 | https://photo.az.tku.edu.tw/ | 200，text/html | 照片著作權屬原作者；可作參考，不可重新散布 |
| 覺生紀念圖書館館舍 | https://www.lib.tku.edu.tw/Front/AboutUs/Openinghoursandpremises/MainBuilding/Page.aspx?id=%2BCcwjg98bKg%3D | 200，text/html | 未標示授權；僅參考 |
| 秘書處建物雙語標示 | https://www.ac.tku.edu.tw/ac/?page_id=18273 | 2026-11-11 讀到標示表。頁面寫著作權屬秘書處，本庫不複製該表 | 未授權轉載；只用來核對兩處標示用字 |

這頁只核對標示用字，沒有座標，所以清冊精度仍全部是 `estimated`，`fieldChecked` 仍是 false。

已改的標示：科學館由「麗先」改為頁上的「騮先紀念科學館」；泳館由「游泳館」改為頁上的「紹謨紀念游泳館」。水道長度沒有寫在這頁，仍待測。

仍沿用程式短名、不在這輪改掉的例子：驚聲大樓（頁上是驚聲紀念大樓）、大門／大忠警衛站（頁上是管制站）、田徑場（頁上是運動場）。這些不是實測差異，只是還沒改的標示用字。

程式中的對應：`src/game/world-data/registry/index.ts`（`OFFICIAL_SOURCES`，`fieldChecked: false`）、`src/game/rpg/campus.ts`（`CAMPUS_SOURCE`）、`src/game/rpg/data.ts`（科系名單註記）。

## 美術方向

- 方向：「玉綠校園奇幻」——日系動畫感、柔和手繪材質、溫暖日光、玉綠與米白、碧瓦紅牆、樹蔭與石板路（任務指示；`docs/ART-DIRECTION.md` 第一輪紀錄）。
- 核准概念圖：任務包 `cursor-art-task/references/approved-art-direction.png` 不存在於儲存庫，本次無法比對；只依文字規格製作，相關項目標 `needs_review`。
- 概念圖不作測繪來源、不鋪成背景。

## 本次新增資產

| 資產 | 來源 | 授權 |
| --- | --- | --- |
| `char.student-kit`（主角） | `art/characters/student-kit/*.ts` 程式建模、程序繪製 atlas、程式撰寫動畫 | 本專案原創，無第三方內容 |
| `creature.quiz`（考卷怪） | `art/creatures/quiz/quiz.ts` | 本專案原創，無第三方內容 |
| 結構脈衝、預警圈、紙片特效 | `src/game/art/vfx/*` | 本專案原創 |

既有第三方素材（未改動）：Quaternius 樹木、KayKit 街道小物，CC0，見 `public/models/vendor/ATTRIBUTION.md`。

## 音效

本次沒有取得任何音檔；遊戲音效仍是 `src/game/audio.ts` 的 WebAudio 合成音，沒有新增任何音檔引用（BACKLOG ART-092 blocked）。

巡禮折線沒有新的測繪或官方頁。走法仍是 estimated。建築系館的工作室外形仍是 estimated。學生活動中心的門廳外形仍是 estimated。勤務監控的崗亭外形仍是 estimated。工學大樓的塔樓外形仍是 estimated。路網繞行的位置仍是 estimated。驚聲大樓的樓身外形仍是 estimated。紹謨紀念體育館這一輪也沒有新的測繪或官方頁。館身外形仍是 estimated。騮先紀念科學館這一輪沒有新的測繪或官方頁。館身外形仍是 estimated。工學館這一輪沒有新的測繪或官方頁。館身外形仍是 estimated。課程地圖標記這一輪也沒有新的測繪或音檔。游泳館這一輪也沒有新的測繪或音檔。長廳外形仍是 estimated，水道長度仍待測。行政大樓這一輪也沒有新的測繪或音檔。入口位置仍待測。實棟學人宿舍這一輪也沒有新的測繪或音檔。門廊外形仍是 estimated。濯纓苑這一輪也沒有新的測繪或音檔。迴廊與坡頂外形仍是 estimated。外國語文大樓這一輪也沒有新的測繪或音檔。長廊外形仍是 estimated。植栽這一輪也沒有新的測繪或音檔。植株位置仍是 estimated。肩肘膝這一輪也沒有新的測繪或音檔。彎曲範圍是這台量到的。化學館這一輪也沒有新的測繪或音檔。排氣箱外形仍是 estimated。路燈淨空這一輪也沒有新的測繪或音檔。燈位仍是 estimated。圖書館坡道這一輪也沒有新的測繪或音檔。坡度仍是 estimated。球場不種樹這一輪也沒有新的測繪或音檔。植株位置仍是 estimated。雨後場地這一輪也沒有新的測繪或音檔。不是實測日照。綜合球場標線這一輪也沒有新的測繪或音檔。標線尺寸仍是 estimated。覺軒花園這一輪也沒有新的測繪或音檔。亭子外形仍是 estimated。小地圖課程字這一輪也沒有新的測繪或音檔。圖書館坡道欄杆這一輪也沒有新的測繪或音檔。欄杆位置仍是 estimated。欄杆擋人這一輪也沒有新的測繪或音檔。欄杆跟著坡這一輪也沒有新的測繪或音檔。田徑場內圈這一輪也沒有新的測繪或音檔。界線尺寸仍是 estimated。車阻這一輪也沒有新的測繪或音檔。柱位仍是 estimated。室內天花板這一輪也沒有新的測繪或音檔。房間仍不是實測。室內南門這一輪也沒有新的測繪或音檔。開口仍不是實測。教育館這一輪也沒有新的測繪或音檔。雨遮外形仍是 estimated。松濤二館這一輪也沒有新的測繪或音檔。門面仍是 estimated。坡道旁的家具這一輪也沒有新的測繪或音檔。長椅與花台位置仍是 estimated。閱讀的女孩這一輪也沒有新的測繪或音檔。長椅位置仍是 estimated。機車停車場車格這一輪也沒有新的測繪或音檔。車格尺寸仍是 estimated。球場球網這一輪也沒有新的測繪或音檔。網高仍是 estimated。未引用貼圖這一輪也沒有新的測繪或音檔。海事博物館船首這一輪也沒有新的測繪或音檔。船首長度仍是 estimated。會文館這一輪也沒有新的測繪或音檔。柱廊外形仍是 estimated。司令臺這一輪也沒有新的測繪或音檔。台高 1.25 m 與坡長仍是 estimated。路人畫質這一輪也沒有新的測繪或音檔。傳輸預算這一輪也沒有新的測繪或音檔。宮燈大道四時段這一輪也沒有新的測繪或音檔。光照仍是估計的預設，不是實測日照。宮燈教室轉角鏡頭這一輪也沒有新的測繪或音檔。迴廊位置仍是 estimated。
