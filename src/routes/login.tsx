import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-navy-deep px-5 py-12 text-paper">
      <div className="absolute inset-0 bg-[url('/og.jpg')] bg-cover bg-center opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/80 to-navy-deep/40" />
      <div className="tk-panel relative w-full max-w-sm rounded-3xl p-6 sm:p-8">
        <p className="text-xs tracking-[0.24em] text-muted">TAMKANG WORLD</p>
        <h1 className="mt-2 font-display text-3xl text-ink">校園通行證</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          訪客可直接遊覽五虎崗。登入後，巡禮蓋章會跟著你的帳號保存。
        </p>
        <div className="mt-6 space-y-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="tk-btn tk-btn-primary w-full"
              >
                使用 {p.label} 繼續
              </button>
            ))
          ) : (
            <p className="text-sm text-muted">目前關閉登入。</p>
          )}
        </div>
        <Link to="/" className="tk-btn tk-btn-ghost mt-4 w-full">
          先以訪客巡禮
        </Link>
      </div>
    </main>
  );
}
