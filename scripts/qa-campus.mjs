import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const log = (...a) => process.stderr.write(a.join(" ") + "\n");

async function shot(page, path) {
  const session = await page.context().newCDPSession(page);
  const { data } = await session.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path, Buffer.from(data, "base64"));
  await session.detach().catch(() => {});
}

async function tap(page, label) {
  await page.evaluate((name) => {
    const nodes = [...document.querySelectorAll("button, a")];
    const el = nodes.find((n) => (n.getAttribute("aria-label") || n.textContent || "").includes(name));
    if (el) el.click();
  }, label);
}

async function waitReady(page) {
  await page.getByRole("button", { name: "開始巡禮" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(2300);
}

log("launch");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(8000);
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

log("goto");
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await waitReady(page);
log("title");
await shot(page, "/workspace/screenshots/title.png");

log("start");
await tap(page, "開始巡禮");
await page.waitForTimeout(800);
await shot(page, "/workspace/screenshots/play-spawn.png");

const shots = [
  { name: "kenan", x: 0, z: 68, yaw: 0 },
  { name: "statue", x: 0, z: 37.6, yaw: 0 },
  { name: "lantern", x: 0, z: 21, yaw: 0 },
  { name: "palace", x: -5, z: 28, yaw: -Math.PI / 2 },
  { name: "dolphin", x: 0, z: 11.2, yaw: 0 },
  { name: "scroll", x: 0, z: -14, yaw: 0 },
  { name: "library", x: 8, z: -20.2, yaw: 0.2 },
  { name: "sheep", x: 22, z: 0, yaw: 0.4 },
  { name: "museum", x: 49, z: -6.4, yaw: 0.15 },
  { name: "tigers", x: 40, z: 16, yaw: 1.2 },
];

const nearby = [];
for (const s of shots) {
  log("pose", s.name);
  await page.evaluate(({ x, z, yaw }) => {
    window.__controlsTest?.setPose?.(x, z, yaw);
  }, s);
  await page.waitForTimeout(400);
  let hud = null;
  try {
    hud = await page.locator(".font-display.text-xl").first().textContent({ timeout: 500 });
  } catch {
    hud = null;
  }
  await page.evaluate(() => {
    window.__controlsTest?.setKeys?.(["KeyE"]);
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    window.__controlsTest?.setKeys?.([]);
  });
  await page.waitForTimeout(180);
  let plaque = null;
  try {
    plaque = await page.locator("h3").first().textContent({ timeout: 500 });
  } catch {
    plaque = null;
  }
  nearby.push({ id: s.name, hud, plaque });
  await tap(page, "繼續走");
  await page.waitForTimeout(80);
  await shot(page, `/workspace/screenshots/play-${s.name}.png`);
}

log("esc");
await page.evaluate(() => {
  window.__controlsTest?.setKeys?.([]);
});
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await shot(page, "/workspace/screenshots/pause.png");
await tap(page, "打開圖鑑");
await page.waitForTimeout(220);
await shot(page, "/workspace/screenshots/codex.png");
await tap(page, "夜訪");
await page.waitForTimeout(80);
await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("button")].filter((n) => n.textContent?.includes("傳送"));
  nodes[2]?.click();
});
await page.waitForTimeout(700);
await shot(page, "/workspace/screenshots/play-night.png");
log("night ok");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
const mobileErr = [];
mobile.on("console", (msg) => {
  if (msg.type() === "error") mobileErr.push(msg.text());
});
mobile.on("pageerror", (err) => mobileErr.push(String(err)));
log("mobile");
await mobile.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await waitReady(mobile);
await shot(mobile, "/workspace/screenshots/mobile-title.png");
await tap(mobile, "開始巡禮");
await mobile.waitForTimeout(1000);
await shot(mobile, "/workspace/screenshots/mobile-play.png");
log("mobile ok");

await page.goto("http://127.0.0.1:8080/login");
await page.waitForTimeout(500);
await shot(page, "/workspace/screenshots/login.png");
log("login ok");

console.log(JSON.stringify({ errors, mobileErr, nearby }, null, 2));
await browser.close();
