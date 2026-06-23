"use client";

import { useEffect, useState } from "react";

type TodayResponse = {
  connected: boolean;
  profile?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  today?: {
    readiness: string;
    recommendation: string;
    recovery_score: number | null;
    strain_score: number | null;
    sleep_performance: number | null;
    sleep_minutes: number | null;
    hrv_rmssd_milli: number | null;
    resting_heart_rate: number | null;
    latest_workout: {
      sport_name?: string;
      strain: number | null;
      start: string;
    } | null;
  };
  error?: string;
};

function formatSleep(minutes: number | null | undefined) {
  if (minutes == null) return "--";

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return `${hours}h ${remaining}m`;
}

function formatValue(value: number | null | undefined, suffix = "") {
  if (value == null) return "--";

  return `${Math.round(value)}${suffix}`;
}

export default function TodayDashboard() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function loadToday() {
    setRefreshing(true);

    fetch("/api/today")
      .then(async (response) => {
        const payload = (await response.json()) as TodayResponse;
        setData(payload);
      })
      .catch(() => {
        setData({ connected: false, error: "Unable to load WHOOP data" });
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  function disconnect() {
    fetch("/api/whoop/disconnect", { method: "POST" }).finally(() => {
      setData({ connected: false });
    });
  }

  useEffect(() => {
    loadToday();
  }, []);

  if (loading) {
    return (
      <section className="panel">
        <p className="eyebrow">Syncing</p>
        <h2>Loading WHOOP data</h2>
      </section>
    );
  }

  if (!data?.connected || !data.today) {
    return (
      <section className="panel">
        <p className="eyebrow">Setup</p>
        <h2>Connect WHOOP</h2>
        <p>Authorize WHOOP to load your real recovery, sleep, strain, and training data.</p>
        <a className="primaryButton compactButton" href="/api/whoop/connect">
          Connect WHOOP
        </a>
      </section>
    );
  }

  const metrics = [
    { label: "Recovery", value: formatValue(data.today.recovery_score, "%"), tone: "low" },
    { label: "Sleep", value: formatSleep(data.today.sleep_minutes), tone: "mid" },
    { label: "HRV", value: formatValue(data.today.hrv_rmssd_milli, " ms"), tone: "mid" },
    { label: "Strain", value: data.today.strain_score?.toFixed(1) ?? "--", tone: "high" }
  ];

  return (
    <>
      <section className="statusRow" aria-label="Connection status">
        <span>WHOOP connected</span>
        <div className="buttonRow">
          <button className="secondaryButton" onClick={loadToday} type="button">
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          <button className="ghostButton" onClick={disconnect} type="button">
            Disconnect
          </button>
        </div>
      </section>

      <section className="metricGrid" aria-label="Today WHOOP metrics">
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
          <h2>{data.today.readiness} day</h2>
        </div>
        <p>{data.today.recommendation}</p>
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">Latest</p>
          <h2>{data.profile?.first_name ? `${data.profile.first_name}'s WHOOP` : "WHOOP data"}</h2>
        </div>
        <p>
          RHR {formatValue(data.today.resting_heart_rate, " bpm")} · Sleep performance{" "}
          {formatValue(data.today.sleep_performance, "%")}
        </p>
        {data.today.latest_workout ? (
          <p>
            Last workout: {data.today.latest_workout.sport_name ?? "Workout"} · Strain{" "}
            {data.today.latest_workout.strain?.toFixed(1) ?? "--"}
          </p>
        ) : null}
      </section>
    </>
  );
}
