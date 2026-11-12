import type { CollegeId } from "../../game/departments.ts";

/**
 * Fictional faculty. Names, posts, and lines are game characters.
 * Department ids are the ones already in departments.ts. No new ids.
 * Kit parts are the existing npc-kit. Bottle, tote, and earphones are stand-ins.
 */
export type FacultyLook = {
  id: string;
  parts: string[];
  colors: Record<string, string>;
  build: { height: number; chest: [number, number, number] };
  /** Existing accessory standing in for a prop the kit does not have. */
  provisional: string;
};

export type FacultyPerson = {
  id: string;
  name: string;
  role: "教授" | "系主任";
  collegeId: CollegeId;
  departmentId: string;
  questId: string;
  questTitle: string;
  goal: string;
  voice: string;
  personality: string;
  siteId: string;
  /** Metres from the estimated door. Not a surveyed office. */
  dx: number;
  dz: number;
  nodes: Record<"meet" | "clash" | "turn" | "after", string>;
  look: FacultyLook;
};

const SKIN = { light: "#ffffff", warm: "#f4e2d4", tan: "#dcbca4" };

export const FACULTY_CAST: readonly FacultyPerson[] = [
  {
    id: "npc-gu-heng",
    name: "顧衡",
    role: "教授",
    collegeId: "engineering",
    departmentId: "architecture",
    questId: "quest-faculty-gu",
    questTitle: "裂縫留在圖上",
    goal: "評圖時把沒做完的接點留在圖面，不先誇殼。",
    voice: "先問線在哪。",
    personality: "短句，不先稱讚模型。",
    siteId: "architecture",
    dx: 12,
    dz: 0,
    nodes: {
      meet: "先問缺的線，或先看失敗的那一版。",
      clash: "裂縫畫進圖，或先放在另一張紙。",
      turn: "評圖改走廊，或和社團對調一小時。",
      after: "當場補進圖面，或用他留下的時段補。",
    },
    look: {
      id: "faculty-gu-heng",
      parts: ["head:sharp", "hair:crop", "acc:glasses", "top:cardigan", "bottom:slacks", "shoes:loafer", "acc:tube"],
      colors: { skin: SKIN.warm, hair: "#8a8f98", top: "#243044", top2: "#f2eee6", bottom: "#2a2e33", shoe: "#2c2624", acc: "#6b4a34", acc2: "#1c1c1c" },
      build: { height: 1.06, chest: [1.04, 1, 1.02] },
      provisional: "圖筒是角色組既有配件。沒有新的評圖板模型。",
    },
  },
  {
    id: "npc-shen-zhuo",
    name: "沈酌",
    role: "教授",
    collegeId: "science",
    departmentId: "chemistry",
    questId: "quest-faculty-shen",
    questTitle: "失敗的那一次",
    goal: "實驗沒做成的那一次要留步驟，不把重做說成沒發生。",
    voice: "先問步驟還在不在。",
    personality: "平，不把失敗叫丟臉。",
    siteId: "chemistry",
    dx: 12,
    dz: 0,
    nodes: {
      meet: "把失敗當數據留下，或先說想重做。",
      clash: "失敗寫進同組看得到的附錄，或先放在她的紀錄。",
      turn: "評圖時把紀錄帶來，或現在把缺的步驟補上。",
      after: "請她寫短記，或自己在評圖上說。",
    },
    look: {
      id: "faculty-shen-zhuo",
      parts: ["head:soft", "hair:bob", "acc:glasses", "top:shirt", "arms:bare", "bottom:slacks", "shoes:loafer", "acc:bottle"],
      colors: { skin: SKIN.light, hair: "#1c1c1c", top: "#f4f1ea", bottom: "#1f3d34", shoe: "#2c2624", acc: "#c45c26", acc2: "#20343a" },
      build: { height: 1.01, chest: [0.96, 1, 0.96] },
      provisional: "水壺暫代實驗瓶。不是新的玻璃器皿。",
    },
  },
  {
    id: "npc-liang-wan",
    name: "梁晚",
    role: "教授",
    collegeId: "liberal-arts",
    departmentId: "mass-comm",
    questId: "quest-faculty-liang",
    questTitle: "句子歸誰",
    goal: "場地和海報上的句子要寫明是誰說的。",
    voice: "會把你的話重說一遍，問這是不是你要的句子。",
    personality: "不替別人宣布同意。",
    siteId: "business-o",
    dx: 12,
    dz: 0,
    nodes: {
      meet: "寫成大家同意，或只寫自己的請求。",
      clash: "兩份出處並列，或先貼訪談、下週補出處。",
      turn: "句子拆開，或把自己的請求和其他人的話分行。",
      after: "只貼已並列的出處，或先拿下海報。",
    },
    look: {
      id: "faculty-liang-wan",
      parts: ["head:soft", "hair:long", "top:cardigan", "bottom:skirt", "legs:bare", "socks:knee", "shoes:loafer", "acc:tote"],
      colors: { skin: SKIN.light, hair: "#2a211c", top: "#3d4f73", top2: "#f7f1e6", bottom: "#1d2430", socks: "#f6f4ef", shoe: "#3a2a22", acc: "#d8c7a2" },
      build: { height: 1.0, chest: [0.95, 1, 0.95] },
      provisional: "托特包暫代講義夾。沒有新的文件模型。",
    },
  },
  {
    id: "npc-qiu-ning",
    name: "邱寧",
    role: "系主任",
    collegeId: "engineering",
    departmentId: "architecture",
    questId: "quest-faculty-qiu",
    questTitle: "兩格都還在",
    goal: "評圖和社團都留得到時段，不把另一邊劃掉。",
    voice: "先念限制，再給兩格都能用的時間。",
    personality: "管表，不替任何一邊宣布輸。",
    siteId: "commons",
    dx: 12,
    dz: 0,
    nodes: {
      meet: "先聽兩個時段，或先確認評圖那一格還在。",
      clash: "最好的一小時給社團，或給評圖。",
      turn: "自己寫誰讓出一小時，或請梁晚把名字分開。",
      after: "公告前對調，或照現在這張表貼。",
    },
    look: {
      id: "faculty-qiu-ning",
      parts: ["head:sharp", "hair:bob", "acc:glasses", "top:shirt", "arms:bare", "bottom:slacks", "shoes:loafer", "acc:tote"],
      colors: { skin: SKIN.warm, hair: "#4a403c", top: "#6e2e3a", bottom: "#3a3d44", shoe: "#2c2624", acc: "#efe6d6", acc2: "#1c1c1c" },
      build: { height: 1.04, chest: [1.0, 1, 1.0] },
      provisional: "托特包暫代時段表。沒有新的公文夾。",
    },
  },
  {
    id: "npc-sang-zhi",
    name: "桑知",
    role: "教授",
    collegeId: "business",
    departmentId: "ba",
    questId: "quest-faculty-case",
    questTitle: "結論不獨佔",
    goal: "個案報告把過程和結論分開寫，不談錢。",
    voice: "只問這一段是誰寫的。",
    personality: "不把缺交說成態度問題。",
    siteId: "business",
    dx: 12,
    dz: 0,
    nodes: {
      meet: "過程和結論對調，或結論一起寫。",
      clash: "等過程再寫結論，或先標成暫定。",
      turn: "只講自己寫的一段，或兩人各講一半。",
      after: "用這個分工交，或補上缺的過程再交。",
    },
    look: {
      id: "faculty-sang-zhi",
      parts: ["head:sharp", "hair:crop", "acc:glasses", "top:cardigan", "bottom:jeans", "shoes:sneaker"],
      colors: { skin: SKIN.tan, hair: "#2c2622", top: "#8a7a4a", top2: "#f4efe2", bottom: "#d9dde8", shoe: "#ffffff", shoeAccent: "#8a7a4a", acc2: "#3a2a22" },
      build: { height: 1.05, chest: [1.02, 1, 1.0] },
      provisional: "沒有公事包模型。眼鏡和開襟是既有部件。",
    },
  },
  {
    id: "npc-an-cheng",
    name: "安澄",
    role: "教授",
    collegeId: "foreign-lang",
    departmentId: "japanese",
    questId: "quest-faculty-wording",
    questTitle: "譯文不代原句",
    goal: "評譯文的用詞，不把猶豫寫成作者的原話。",
    voice: "譯文放在括號外，原句留著。",
    personality: "評詞，不評人。",
    siteId: "foreign",
    dx: 12,
    dz: 0,
    nodes: {
      meet: "先指出過重的詞，或先讀原文。",
      clash: "猶豫留在括號，或先刪掉那句。",
      turn: "欄位放譯文、原文在下，或欄位只放原文。",
      after: "照這個版本貼，或只改一個詞再貼。",
    },
    look: {
      id: "faculty-an-cheng",
      parts: ["head:soft", "hair:ponytail", "acc:earphones", "top:cardigan", "bottom:skirt", "legs:bare", "socks:knee", "shoes:loafer"],
      colors: { skin: SKIN.light, hair: "#5c3317", top: "#d7c4b8", top2: "#fffaf3", bottom: "#243044", socks: "#f6f4ef", shoe: "#5a3a2a", acc: "#f2f0ea" },
      build: { height: 0.99, chest: [0.94, 1, 0.94] },
      provisional: "耳機暫代語言教室的耳機。不是新的音檔。",
    },
  },
  {
    id: "npc-jian-heng",
    name: "簡衡",
    role: "教授",
    collegeId: "international",
    departmentId: "diplomacy",
    questId: "quest-faculty-cross",
    questTitle: "兩句並列",
    goal: "把教育學院和商管的原句並列，不替他們選邊。",
    voice: "重說你寫下的句子，問有沒有改過。",
    personality: "協調時不把兩邊合成一句。",
    siteId: "administration",
    dx: 12,
    dz: 0,
    nodes: {
      meet: "去問兩邊的原句，或先寫下自己聽到的。",
      clash: "對過沒有合成一句，或把不確定的標成待查。",
      turn: "維持並列，或建議對調但要他們自己點頭。",
      after: "把結果送回兩邊，或先當草稿。",
    },
    look: {
      id: "faculty-jian-heng",
      parts: ["head:sharp", "hair:long", "acc:glasses", "top:shirt", "arms:bare", "bottom:slacks", "shoes:loafer"],
      colors: { skin: SKIN.warm, hair: "#1a1a1a", top: "#d5dbe3", bottom: "#2c3140", shoe: "#2c2624", acc2: "#1c1c1c" },
      build: { height: 1.07, chest: [1.0, 1, 0.98] },
      provisional: "沒有會議桌模型。襯衫和眼鏡是既有部件。",
    },
  },
  {
    id: "npc-jian-he",
    name: "簡禾",
    role: "教授",
    collegeId: "education",
    departmentId: "ed-tech",
    questId: "quest-faculty-course",
    questTitle: "自己的課表",
    goal: "撞期的兩門課由你自己對先修，她不替你挑前途。",
    voice: "先問哪一門不能改期。",
    personality: "不說哪門比較有用。",
    siteId: "education",
    dx: 12,
    dz: 0,
    nodes: {
      meet: "先看先修，或先看哪門不能改期。",
      clash: "自己對過先修，或先跟朋友、下學期再補。",
      turn: "補簽名維持課表，或改選不撞的那門。",
      after: "寫進自己的課表，或留下可退的備案。",
    },
    look: {
      id: "faculty-jian-he",
      parts: ["head:soft", "hair:bob", "top:hoodie", "bottom:jeans", "shoes:sneaker", "acc:tote"],
      colors: { skin: SKIN.warm, hair: "#3a2a24", top: "#c46b4a", top2: "#fff6ee", bottom: "#2f3d5c", shoe: "#ffffff", shoeAccent: "#c46b4a", acc: "#e6d3b4" },
      build: { height: 0.98, chest: [0.97, 1, 0.97] },
      provisional: "連帽衫是既有學生部件，這裡當她的外套。托特包暫代課表。",
    },
  },
  {
    id: "npc-cheng-xi",
    name: "程晰",
    role: "教授",
    collegeId: "ai",
    departmentId: "ai",
    questId: "quest-faculty-ethics",
    questTitle: "未授權的檔",
    goal: "同學作業進資料夾之前要有同意，沒有同意的不能拿去跑。",
    voice: "先問這份檔是誰的。",
    personality: "不把方便說成已經同意。",
    siteId: "engineering",
    dx: 12,
    dz: 0,
    nodes: {
      meet: "先問每一個人，或先只用自己的那份。",
      clash: "沒有同意的檔移出，或留下但標成不能跑。",
      turn: "把自己的也移出，或只對自己的檔寫同意。",
      after: "把範圍寫進方法，或改用公開範例。",
    },
    look: {
      id: "faculty-cheng-xi",
      parts: ["head:sharp", "hair:crop", "acc:glasses", "top:shirt", "arms:bare", "bottom:jeans", "shoes:sneaker"],
      colors: { skin: SKIN.light, hair: "#d9dde2", top: "#1c1c1c", bottom: "#3a4254", shoe: "#ffffff", shoeAccent: "#1c1c1c", acc2: "#c8ccd4" },
      build: { height: 1.03, chest: [0.98, 1, 0.98] },
      provisional: "站在工學大樓外是估計位置。人工智慧學系沒有獨立的可走建築。",
    },
  },
  {
    id: "npc-wei-ning",
    name: "衛寧",
    role: "教授",
    collegeId: "precision-health",
    departmentId: "med-info",
    questId: "quest-faculty-survey",
    questTitle: "空答不是同意",
    goal: "問卷回收不足就寫進限制，空白不能算成同意。",
    voice: "先問這格是空的，還是寫了字。",
    personality: "不補別人的答案。",
    siteId: "science",
    dx: 12,
    dz: 0,
    nodes: {
      meet: "把不足寫進限制，或再發一輪、舊的空白不填。",
      clash: "空答就是沒有回答，或只統計寫了字的人。",
      turn: "引導題作廢，或留下並寫明引導。",
      after: "用現在的樣本交，或補訪願意留名的人。",
    },
    look: {
      id: "faculty-wei-ning",
      parts: ["head:soft", "hair:long", "top:shirt", "arms:bare", "bottom:slacks", "shoes:loafer", "acc:bottle"],
      colors: { skin: SKIN.light, hair: "#2a2424", top: "#d5ebe6", bottom: "#2e3f46", shoe: "#2c2624", acc: "#7f9aa3" },
      build: { height: 1.02, chest: [0.96, 1, 0.97] },
      provisional: "站在騮先紀念科學館外是估計位置。精準健康學院沒有獨立的可走建築。水壺暫代紀錄瓶。",
    },
  },
  {
    id: "npc-meng-zhao",
    name: "孟昭",
    role: "系主任",
    collegeId: "science",
    departmentId: "chemistry",
    questId: "quest-faculty-hours",
    questTitle: "時段不往前吃",
    goal: "實驗討論和社團都能用角落，遲到不能吃掉前一組。",
    voice: "先說哪一段不能借，因為安全。",
    personality: "護時段和通風，不罰社團。",
    siteId: "chemistry",
    dx: 0,
    dz: 12,
    nodes: {
      meet: "先問哪段不能借，或先聽兩個都能用的時段。",
      clash: "遲到的人用剩下的，或兩組各讓十五分鐘。",
      turn: "保養優先、改到另一格，或只做不碰儀器的討論。",
      after: "表就這樣貼，或把讓出的格子寫給下一組。",
    },
    look: {
      id: "faculty-meng-zhao",
      parts: ["head:sharp", "hair:bob", "acc:glasses", "top:cardigan", "bottom:slacks", "shoes:loafer", "acc:bottle"],
      colors: { skin: SKIN.tan, hair: "#6b645c", top: "#4a2c44", top2: "#f3e7dc", bottom: "#2a2e33", shoe: "#2c2624", acc: "#8eb8b4", acc2: "#1c1c1c" },
      build: { height: 1.05, chest: [1.06, 1, 1.04] },
      provisional: "水壺暫代值日紀錄。她和沈酌站在化學館不同側。",
    },
  },
  {
    id: "npc-jiang-zhao",
    name: "江照",
    role: "系主任",
    collegeId: "business",
    departmentId: "ba",
    questId: "quest-faculty-schedule",
    questTitle: "不退教育的申請",
    goal: "商管教室和教育學院見習撞期時，兩邊都留時段。",
    voice: "先念申請上的限制，不先退件。",
    personality: "不把另一個學院的申請退回。",
    siteId: "business",
    dx: 0,
    dz: 12,
    nodes: {
      meet: "先聽教育學院那張，或先確認商管本來的課。",
      clash: "不退件、改找前後一小時，或商管改用討論角。",
      turn: "把兩邊的句子帶給簡衡，或先定暫定表。",
      after: "暫定改正式且兩邊都在，或留一格空白等他們填。",
    },
    look: {
      id: "faculty-jiang-zhao",
      parts: ["head:soft", "hair:ponytail", "top:shirt", "arms:bare", "bottom:skirt", "legs:bare", "socks:knee", "shoes:loafer", "acc:tote"],
      colors: { skin: SKIN.warm, hair: "#3f2a2a", top: "#e6d7b8", bottom: "#243044", socks: "#f6f4ef", shoe: "#5a3a2a", acc: "#f4efe2" },
      build: { height: 1.0, chest: [0.98, 1, 0.98] },
      provisional: "托特包暫代申請表。她和桑知站在商管大樓不同側。",
    },
  },
];

export function facultyById(id: string): FacultyPerson | undefined {
  return FACULTY_CAST.find((person) => person.id === id);
}

export function facultyCard(npcId: string): { name: string; role: string; unitId: string } | null {
  const person = facultyById(npcId);
  if (!person) return null;
  return { name: person.name, role: person.role, unitId: person.departmentId };
}
