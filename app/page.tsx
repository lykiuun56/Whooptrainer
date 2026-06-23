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
      </section>

      <TodayDashboard />
    </main>
  );
}
