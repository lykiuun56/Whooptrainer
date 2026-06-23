import Link from "next/link";
import TodayDashboard from "./today-dashboard";

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Private WHOOP Assistant</p>
        <h1>Today</h1>
        <p className="summary">
          Your private WHOOP dashboard for recovery, sleep, strain, and training readiness.
        </p>
        <Link className="primaryButton" href="/api/whoop/connect">
          Connect WHOOP
        </Link>
      </section>

      <TodayDashboard />

      <section className="panel">
        <div>
          <p className="eyebrow">Setup</p>
          <h2>Vercel URLs</h2>
        </div>
        <p>Use these once this app is deployed:</p>
        <code>https://your-vercel-app.vercel.app/privacy</code>
        <code>https://your-vercel-app.vercel.app/api/whoop/callback</code>
      </section>
    </main>
  );
}
