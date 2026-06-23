import Link from "next/link";

const metrics = [
  { label: "Recovery", value: "42%", tone: "low" },
  { label: "Sleep", value: "6h 18m", tone: "mid" },
  { label: "HRV", value: "48 ms", tone: "mid" },
  { label: "Strain", value: "11.8", tone: "high" }
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Private WHOOP Assistant</p>
        <h1>Today</h1>
        <p className="summary">
          Recovery is low today. Keep intensity controlled and prioritize sleep, hydration, and easy aerobic work.
        </p>
        <Link className="primaryButton" href="/api/whoop/connect">
          Connect WHOOP
        </Link>
      </section>

      <section className="metricGrid" aria-label="Today metrics">
        {metrics.map((metric) => (
          <article className={`metricCard ${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">Training</p>
          <h2>Light day</h2>
        </div>
        <p>
          Do Zone 2, mobility, technique practice, or take a full rest day if you feel run down.
        </p>
      </section>

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
