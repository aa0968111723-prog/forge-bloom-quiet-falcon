import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Cloud,
  CloudRain,
  Compass,
  Gauge,
  Sparkles,
  Map as MapIcon,
  Pause,
  Play,
  Sun,
  Moon,
  Sunset,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LANDMARKS, LANDMARK_BY_ID, TIME_PRESETS, WORLD_BOUNDS, type TimeOfDay } from "@/game/world";
import { zoneAt } from "@/game/world-data/zones/index.ts";
import { input } from "@/game/input";
import { useGame } from "@/game/store";
import { campusAudio } from "@/game/audio";
import { RealityComparePanel } from "@/game/world/RealityCompare";
import { cn } from "@/lib/cn";

const TIME_LABEL = Object.fromEntries(
  Object.entries(TIME_PRESETS).map(([id, p]) => [id, p.label]),
) as Record<TimeOfDay, string>;

/** Time-of-day picker: icon per preset, order matches the daylight cycle. */
const TIME_OPTIONS: [TimeOfDay, typeof Sun][] = [
  ["day", Sun],
  ["cloudy", Cloud],
  ["sunset", Sunset],
  ["night", Moon],
  ["wet", CloudRain],
];

function CompassHud() {
  const playerX = useGame((s) => s.playerX);
  const playerZ = useGame((s) => s.playerZ);
  const playerYaw = useGame((s) => s.playerYaw);
  const visited = useGame((s) => s.visited);
  const next = LANDMARKS.find((l) => !visited.includes(l.id));
  if (!next) return null;
  const bearing = Math.atan2(next.x - playerX, -(next.z - playerZ));
  const rel = bearing - playerYaw;
  const dist = Math.hypot(next.x - playerX, next.z - playerZ);
  return (
    <div className="tk-panel flex items-center gap-2 rounded-xl px-2.5 py-2">
      <div className="relative size-9 shrink-0">
        <div className="absolute inset-0 rounded-full border border-line" />
        <div
          className="absolute left-1/2 top-1/2 size-0 border-x-[5px] border-b-[11px] border-x-transparent border-b-navy"
          style={{ transform: `translate(-50%, -70%) rotate(${rel}rad)` }}
        />
      </div>
      <div className="min-w-0">
        <p className="truncate font-display text-sm leading-none text-ink">{next.name}</p>
        <p className="mt-0.5 text-[11px] tabular-nums text-muted">{Math.round(dist)} 步</p>
      </div>
    </div>
  );
}

function AuthChip() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="h-8 w-24 animate-pulse rounded-full bg-ink/10" />;
  }
  if (user) {
    return (
      <div className="text-ink">
        <UserButton />
      </div>
    );
  }
  return (
    <Link to="/login" className="tk-btn tk-btn-ghost h-10 px-3 text-sm">
      <UserRound className="size-4" />
      登入保存
    </Link>
  );
}

function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerX = useGame((s) => s.playerX);
  const playerZ = useGame((s) => s.playerZ);
  const playerYaw = useGame((s) => s.playerYaw);
  const visited = useGame((s) => s.visited);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1a3f6d";
    ctx.fillRect(0, 0, w, h);
    // Project the real-scale world bounds into the minimap, with a small margin
    // so the corridor is not glued to the canvas edge.
    const minX = WORLD_BOUNDS.minX + 60;
    const maxX = WORLD_BOUNDS.maxX - 20;
    const minZ = WORLD_BOUNDS.minZ - 5;
    const maxZ = WORLD_BOUNDS.maxZ + 5;
    const sx = (x: number) => ((x - minX) / (maxX - minX)) * w;
    const sz = (z: number) => ((z - minZ) / (maxZ - minZ)) * h;
    const river = sx(-118);
    ctx.fillStyle = "#2f6d8c";
    ctx.fillRect(0, 0, Math.max(0, river), h);
    ctx.fillStyle = "#3d5c38";
    ctx.fillRect(Math.max(0, river), 0, w, h);
    // Main pilgrimage axis, so the map reads as a route rather than dots.
    ctx.strokeStyle = "#f3eee4";
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx(0), sz(WORLD_BOUNDS.maxZ - 20));
    ctx.lineTo(sx(0), sz(-272));
    ctx.lineTo(sx(10), sz(-300));
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (const l of LANDMARKS) {
      ctx.beginPath();
      ctx.fillStyle = visited.includes(l.id) ? "#f3eee4" : "#c45c4a";
      ctx.arc(sx(l.x), sz(l.z), visited.includes(l.id) ? 3.4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    const px = sx(playerX);
    const pz = sz(playerZ);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(playerYaw);
    ctx.fillStyle = "#f3eee4";
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [playerX, playerZ, playerYaw, visited]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={148}
      className="h-[92px] w-[100px] rounded-md border border-line/80 bg-navy sm:h-[118px] sm:w-[128px]"
      aria-label="校園小地圖"
    />
  );
}

function TouchStick() {
  const origin = useRef({ x: 0, y: 0, id: -1 });
  const knob = useRef<HTMLDivElement>(null);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== origin.current.id) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    const m = Math.hypot(dx, dy);
    const r = 42;
    const k = m > r ? r / m : 1;
    const x = dx * k;
    const y = dy * k;
    input.joyX = x / r;
    input.joyY = -y / r;
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== origin.current.id) return;
    origin.current.id = -1;
    input.joyX = 0;
    input.joyY = 0;
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
  };

  return (
    <div
      className="relative size-[118px] rounded-full border border-paper/25 bg-ink/35"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div
        ref={knob}
        className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper/85"
      />
    </div>
  );
}

function LookPad() {
  const last = useRef({ x: 0, y: 0, id: -1 });
  return (
    <div
      className="absolute inset-y-0 right-0 w-[46%] touch-none"
      onPointerDown={(e) => {
        last.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== last.current.id) return;
        input.lookX += e.clientX - last.current.x;
        input.lookY += e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      }}
      onPointerUp={() => {
        last.current.id = -1;
      }}
      onPointerCancel={() => {
        last.current.id = -1;
      }}
    />
  );
}

/**
 * Area-title splash: entering a named campus zone fades its name in over the
 * lower third for a few seconds — the quiet "you have arrived somewhere"
 * moment adventure games use instead of a toast.
 */
function AreaSplash() {
  const phase = useGame((s) => s.phase);
  const playerX = useGame((s) => s.playerX);
  const playerZ = useGame((s) => s.playerZ);
  const [splash, setSplash] = useState<{ name: string; nameEn: string; key: number } | null>(null);
  const lastZone = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== "playing") return;
    const zone = zoneAt(playerX, playerZ);
    // Context zones stay silent — only the calibrated places announce themselves.
    if (!zone || zone.detail !== "reality") return;
    if (zone.id === lastZone.current) return;
    const first = lastZone.current === null;
    lastZone.current = zone.id;
    if (first) return; // no splash on top of the title screen hand-off
    setSplash({ name: zone.name, nameEn: zone.nameEn, key: Date.now() });
    const t = window.setTimeout(() => setSplash(null), 3200);
    return () => window.clearTimeout(t);
  }, [phase, playerX, playerZ]);

  if (!splash || phase !== "playing") return null;
  return (
    <div key={splash.key} className="tk-splash pointer-events-none absolute inset-x-0 top-[18%] text-center">
      <p className="font-display text-4xl tracking-[0.18em] text-paper drop-shadow-[0_2px_10px_rgba(10,16,28,0.75)] sm:text-5xl">
        {splash.name}
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.42em] text-paper/75 sm:text-sm">{splash.nameEn}</p>
      <div className="mx-auto mt-3 h-px w-36 bg-paper/50" />
    </div>
  );
}

export function GameOverlay() {
  const phase = useGame((s) => s.phase);
  const timeOfDay = useGame((s) => s.timeOfDay);
  const visited = useGame((s) => s.visited);
  const nearbyId = useGame((s) => s.nearbyId);
  const plaqueId = useGame((s) => s.plaqueId);
  const muted = useGame((s) => s.muted);
  const stampFlash = useGame((s) => s.stampFlash);
  const graphics = useGame((s) => s.graphics);
  const [coarse, setCoarse] = useState(false);
  const [hint, setHint] = useState(true);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    campusAudio.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    campusAudio.setMood(timeOfDay === "night" ? "night" : "day");
  }, [timeOfDay]);

  useEffect(() => {
    if (phase === "playing") {
      const t = window.setTimeout(() => setHint(false), 7000);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (visited.length >= LANDMARKS.length && stampFlash > 0) {
      setShowDone(true);
      const t = window.setTimeout(() => setShowDone(false), 4500);
      return () => window.clearTimeout(t);
    }
  }, [visited.length, stampFlash]);

  const nearby = nearbyId ? LANDMARK_BY_ID[nearbyId] : null;
  const plaque = plaqueId ? LANDMARK_BY_ID[plaqueId] : null;
  const next = LANDMARKS.find((l) => !visited.includes(l.id));

  return (
    <div className="pointer-events-none absolute inset-0 font-sans text-paper">
      <RealityComparePanel />
      <AreaSplash />
      {phase === "title" && (
        // Title: the world is the backdrop, so the plate sits low and light,
        // letting the drifting camera over 宮燈大道 carry the frame.
        <div className="pointer-events-auto flex h-full flex-col justify-end bg-gradient-to-t from-navy-deep via-navy-deep/55 to-transparent p-4 pb-16 sm:p-10 sm:pb-12">
          <div className="tk-title-plate mx-auto w-full max-w-xl">
            <p className="text-[11px] tracking-[0.42em] text-paper/70 sm:text-sm">TAMKANG · TAMSUI</p>
            <h1 className="mt-1.5 font-display text-5xl font-semibold leading-none tracking-tight text-paper drop-shadow-[0_4px_18px_rgba(6,10,20,0.85)] sm:mt-3 sm:text-7xl">
              淡江世界
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <span className="h-px w-10 bg-paper/45" />
              <p className="font-display text-base tracking-[0.3em] text-paper/90 sm:text-lg">樸實剛毅</p>
              <span className="h-px flex-1 bg-paper/25" />
            </div>
            <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-paper/75 sm:block sm:text-base">
              依淡水校園真實走道重建：克難坡一百三十二階、驚聲銅像、兩側宮燈教室夾道，北望海豚里程碑與書卷廣場。
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="tk-btn tk-btn-primary min-w-40 bg-paper text-ink hover:bg-paper-2"
                onClick={() => {
                  campusAudio.unlock();
                  useGame.getState().start();
                }}
              >
                開始巡禮
              </button>
              <button
                type="button"
                className="tk-btn tk-btn-on-dark"
                onClick={() => useGame.getState().openCodex("title")}
              >
                <BookOpen className="size-4" />
                校園圖鑑
              </button>
              <SignedOut>
                <Link to="/login" className="tk-btn tk-btn-on-dark text-sm">
                  登入
                </Link>
              </SignedOut>
              <SignedIn>
                <div className="text-paper">
                  <UserButton />
                </div>
              </SignedIn>
            </div>
            <p className="mt-4 text-xs text-paper/55">
              {coarse ? "左搖桿移動 · 右側拖曳視角 · 互動鈕蓋章" : "WASD 移動 · 滑鼠視角 · E 蓋章 · Shift 奔跑 · Esc 選單"}
            </p>
          </div>
        </div>
      )}

      {phase === "playing" && (
        <>
          <div className="pointer-events-auto absolute left-3 top-3 flex max-w-[calc(100%-9rem)] items-start gap-3 sm:left-5 sm:top-5">
            <div className="tk-panel rounded-xl px-3 py-2 sm:rounded-2xl sm:px-4 sm:py-3">
              <p className="font-display text-lg leading-none text-ink">淡江世界</p>
              <p className="mt-1 text-xs tabular-nums text-muted">
                巡禮 {visited.length}/{LANDMARKS.length}
                {next ? ` · 下一站 ${next.name}` : " · 完成"}
              </p>
            </div>
            <CompassHud />
          </div>
          <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-2 sm:right-5 sm:top-5">
            <div className="flex gap-2">
              <button
                type="button"
                className="tk-btn tk-btn-on-dark size-11 min-h-11 p-0"
                aria-label={muted ? "開啟聲音" : "關閉聲音"}
                onClick={() => useGame.getState().toggleMute()}
              >
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <button
                type="button"
                className="tk-btn tk-btn-on-dark size-11 min-h-11 p-0"
                aria-label="暫停"
                onClick={() => useGame.getState().pause()}
              >
                <Pause className="size-4" />
              </button>
            </div>
            <Minimap />
          </div>

          {nearby && (
            <div className="pointer-events-none absolute bottom-36 left-1/2 w-[min(92vw,28rem)] -translate-x-1/2 sm:bottom-10">
              <div className="tk-panel rounded-2xl px-4 py-3 text-center">
                <p className="font-display text-xl text-ink">{nearby.name}</p>
                <p className="mt-1 text-xs tracking-wide text-muted">{nearby.nameEn}</p>
                <p className="mt-2 text-sm text-ink/80">
                  {visited.includes(nearby.id) ? "已蓋章 · 再按互動查看" : coarse ? "點擊蓋章，留下巡禮印記" : "按 E 蓋下巡禮印記"}
                </p>
              </div>
            </div>
          )}

          {hint && !nearby && (
            <div className="absolute bottom-36 left-1/2 -translate-x-1/2 text-center text-xs text-paper/80 sm:bottom-8">
              跟著小地圖上的紅點，走完十處淡水校園地標
            </div>
          )}

          {coarse && (
            <>
              <LookPad />
              <div className="pointer-events-auto absolute bottom-5 left-4 z-10">
                <TouchStick />
              </div>
              <div className="pointer-events-auto absolute bottom-6 right-4 z-10 flex flex-col gap-2">
                <button
                  type="button"
                  className="tk-btn tk-btn-on-dark min-w-20"
                  onPointerDown={() => input.keys.add("ShiftLeft")}
                  onPointerUp={() => input.keys.delete("ShiftLeft")}
                  onPointerCancel={() => input.keys.delete("ShiftLeft")}
                >
                  奔跑
                </button>
                <button
                  type="button"
                  className="tk-btn tk-btn-primary bg-paper text-ink"
                  onClick={() => {
                    input.keys.add("KeyE");
                    window.setTimeout(() => input.keys.delete("KeyE"), 80);
                  }}
                >
                  蓋章
                </button>
              </div>
            </>
          )}
        </>
      )}

      {(phase === "paused" || phase === "codex") && (
        <div className="pointer-events-auto flex h-full items-center justify-center bg-navy-deep/55 p-4">
          <div className="tk-panel w-full max-w-lg rounded-3xl p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-ink">{phase === "codex" ? "校園圖鑑" : "暫停"}</h2>
                <p className="mt-1 text-sm text-muted">
                  已探訪 {visited.length}/{LANDMARKS.length} · {TIME_LABEL[timeOfDay]}
                </p>
              </div>
              <button
                type="button"
                className="tk-btn tk-btn-ghost size-10 min-h-10 p-0"
                aria-label="關閉"
                onClick={() =>
                  phase === "paused" ? useGame.getState().resume() : useGame.getState().closeMenu()
                }
              >
                <X className="size-4" />
              </button>
            </div>

            {phase === "paused" && (
              <div className="mt-5 flex flex-col gap-2">
                <button type="button" className="tk-btn tk-btn-primary w-full" onClick={() => useGame.getState().resume()}>
                  <Play className="size-4" />
                  繼續巡禮
                </button>
                <button
                  type="button"
                  className="tk-btn tk-btn-ghost w-full"
                  onClick={() => useGame.getState().openCodex("playing")}
                >
                  <MapIcon className="size-4" />
                  打開圖鑑
                </button>
                <button
                  type="button"
                  className="tk-btn tk-btn-ghost w-full"
                  onClick={() => useGame.getState().restartSlope()}
                >
                  從克難坡重新出發
                </button>
                <button
                  type="button"
                  className="tk-btn tk-btn-ghost w-full"
                  onClick={() => useGame.getState().setPhase("title")}
                >
                  返回封面
                </button>
              </div>
            )}
            {phase === "codex" && (
              <button
                type="button"
                className="tk-btn tk-btn-primary mt-5 w-full"
                onClick={() => useGame.getState().closeMenu()}
              >
                返回
              </button>
            )}

            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">時光</p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {TIME_OPTIONS.map(([id, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "tk-btn tk-btn-ghost flex-col gap-1 py-3 text-sm",
                      timeOfDay === id && "bg-navy text-paper hover:bg-navy",
                    )}
                    onClick={() => useGame.getState().setTime(id)}
                  >
                    <Icon className="size-4" />
                    {TIME_LABEL[id]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">畫質</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    ["auto", "自動"],
                    ["high", "高"],
                    ["low", "省電"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "tk-btn tk-btn-ghost gap-1 py-2 text-sm",
                      graphics.tier === id && "bg-navy text-paper hover:bg-navy",
                    )}
                    onClick={() => useGame.getState().setGraphics({ tier: id })}
                  >
                    <Gauge className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={cn(
                  "tk-btn tk-btn-ghost mt-2 w-full justify-between text-sm",
                  graphics.postFx && "bg-navy/10",
                )}
                onClick={() => useGame.getState().setGraphics({ postFx: !graphics.postFx })}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4" />
                  光暈與暗角
                </span>
                <span className="text-xs text-muted">{graphics.postFx ? "開啟" : "關閉"}</span>
              </button>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                切換畫質會重新載入場景。省電模式關閉陰影並降低植栽密度，適合手機。
              </p>
            </div>

            <ul className="mt-5 max-h-56 space-y-1 overflow-auto pr-1">
              {LANDMARKS.map((l) => {
                const got = visited.includes(l.id);
                return (
                  <li
                    key={l.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm",
                      got ? "bg-navy/8 text-ink" : "text-muted",
                    )}
                  >
                    <span className="min-w-0 truncate font-medium">{l.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs">{got ? "已蓋章" : "未到訪"}</span>
                      <button
                        type="button"
                        className="tk-btn tk-btn-ghost h-8 min-h-8 px-2 text-xs"
                        onClick={() => useGame.getState().travelTo(l.id)}
                      >
                        傳送
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <AuthChip />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="tk-btn tk-btn-ghost text-sm"
                  onClick={() => useGame.getState().resetProgress()}
                >
                  清空蓋章
                </button>
                <button
                  type="button"
                  className="tk-btn tk-btn-ghost text-sm"
                  onClick={() => useGame.getState().toggleMute()}
                >
                  {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                  {muted ? "靜音中" : "環境聲"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {plaque && (
        <div className="pointer-events-auto absolute inset-0 flex items-end justify-center bg-navy-deep/40 p-4 sm:items-center">
          <div className="tk-panel w-full max-w-md rounded-3xl p-5 sm:p-7">
            <p className="text-xs tracking-[0.22em] text-muted">{plaque.year === "—" ? "CAMPUS LANDMARK" : plaque.year}</p>
            <h3 className="mt-1 font-display text-3xl text-ink">{plaque.name}</h3>
            <p className="mt-1 text-sm text-muted">{plaque.nameEn}</p>
            <p className="mt-4 text-sm leading-relaxed text-ink/85">{plaque.blurb}</p>
            <button
              type="button"
              className="tk-btn tk-btn-primary mt-5 w-full"
              onClick={() => useGame.getState().openPlaque(null)}
            >
              繼續走
            </button>
          </div>
        </div>
      )}

      {showDone && phase === "playing" && !plaque && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2">
          <div className="tk-panel rounded-2xl px-6 py-4 text-center">
            <Compass className="mx-auto size-5 text-navy" />
            <p className="mt-2 font-display text-2xl text-ink">巡禮完成</p>
            <p className="mt-1 text-sm text-muted">樸實剛毅 · 立足淡江，放眼世界</p>
          </div>
        </div>
      )}
    </div>
  );
}
