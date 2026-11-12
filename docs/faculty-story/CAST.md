# 虛構教職員

這些人不是淡江大學的真實師長。姓名、語氣、委託和站點都是遊戲設計。科系 id 只用 `src/game/departments.ts` 已有的 id。站點是既有門口外推，不是實測辦公室。

| npcId | 姓名 | 職務 | 學院 / 科系 | 站點 | 任務 | 目標 |
| --- | --- | --- | --- | --- | --- | --- |
| npc-gu-heng | 顧衡 | 教授 | engineering / architecture | post-gu-heng，建築系館門外 | quest-faculty-gu | 評圖把沒做完的接點留在圖上 |
| npc-shen-zhuo | 沈酌 | 教授 | science / chemistry | post-shen-zhuo，化學館門外 | quest-faculty-shen | 失敗的那一次要留步驟 |
| npc-liang-wan | 梁晚 | 教授 | liberal-arts / mass-comm | post-liang-wan，傳播館 O 館門外 | quest-faculty-liang | 句子要寫明是誰說的 |
| npc-qiu-ning | 邱寧 | 系主任 | engineering / architecture | post-qiu-ning，學生活動中心門外 | quest-faculty-qiu | 評圖和社團都留得到時段 |
| npc-sang-zhi | 桑知 | 教授 | business / ba | post-sang-zhi，商管大樓門外 | quest-faculty-case | 過程和結論分開，不談分數 |
| npc-an-cheng | 安澄 | 教授 | foreign-lang / japanese | post-an-cheng，外國語文大樓門外 | quest-faculty-wording | 譯文不代替原句 |
| npc-jian-heng | 簡衡 | 教授 | international / diplomacy | post-jian-heng，行政大樓門外 | quest-faculty-cross | 兩院的原句並列 |
| npc-jian-he | 簡禾 | 教授 | education / ed-tech | post-jian-he，教育館門外 | quest-faculty-course | 撞期的課由學生自己對先修 |
| npc-cheng-xi | 程晰 | 教授 | ai / ai | post-cheng-xi，工學大樓門外 | quest-faculty-ethics | 沒有同意的檔不能拿去跑 |
| npc-wei-ning | 衛寧 | 教授 | precision-health / med-info | post-wei-ning，科學館門外 | quest-faculty-survey | 空答不是同意 |
| npc-meng-zhao | 孟昭 | 系主任 | science / chemistry | post-meng-zhao，化學館另一側 | quest-faculty-hours | 遲到不能吃掉前一組的時段 |
| npc-jiang-zhao | 江照 | 系主任 | business / ba | post-jiang-zhao，商管大樓另一側 | quest-faculty-schedule | 不退教育學院的申請 |

跨角色主線是 `quest-faculty-studio`（評圖留白）。簡衡的轉折要等簡禾和江照都已開口；人不到場，紙條放在行政大樓窗台。簡禾選先修或不能改期、江照選先聽見習或先確認商管的課，會改簡衡這一節的開場。江照的轉折也會引用簡禾實際選的那一句。程晰和衛寧的位置是估計的會合點，這兩個學院沒有獨立的可走建築。

服裝用既有 `char.npc-kit`。水壺暫代實驗瓶，托特包暫代文件，耳機暫代語言教室耳機。沒有新網格，也沒有生成圖。
