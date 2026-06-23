"use client";

import { useEffect, useState } from "react";

type TrendDay = {
  date: string;
  label: string;
  recovery_score: number | null;
  sleep_minutes: number | null;
  strain_score: number | null;
  hrv_rmssd_milli: number | null;
};

type TrainingGoal = "general" | "strength" | "hypertrophy" | "cardio" | "recovery";

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
  coach?: {
    title: string;
    intensity: string;
    plan: string;
    focus: string[];
    avoid: string[];
    reasons: string[];
  };
  trends?: TrendDay[];
  error?: string;
};

const goals: { value: TrainingGoal; label: string }[] = [
  { value: "general", label: "General" },
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Muscle" },
  { value: "cardio", label: "Cardio" },
  { value: "recovery", label: "Recovery" }
];

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

function barHeight(value: number | null, max: number) {
  if (value == null) return "10%";

  return `${Math.max(10, Math.min(100, (value / max) * 100))}%`;
}

function TrendRow({
  label,
  values,
  max,
  suffix = "",
  accent
}: {
  label: string;
  values: { label: string; value: number | null }[];
  max: number;
  suffix?: string;
  accent: string;
}) {
  return (
    <div className="trendRow">
      <div className="trendLabel">{label}</div>
      <div className="trendBars">
        {values.map((item, index) => (
          <div className="trendItem" key={`${item.label}-${index}`}>
            <div className="trendTrack">
              <div className="trendFill" style={{ height: barHeight(item.value, max), background: accent }} />
            </div>
            <span>{item.label}</span>
            <strong>{item.value == null ? "--" : `${Math.round(item.value)}${suffix}`}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TodayDashboard() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [goal, setGoal] = useState<TrainingGoal>("general");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function loadToday(nextGoal = goal) {
    setRefreshing(true);

    fetch(`/api/today?goal=${nextGoal}`)
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

  function changeGoal(nextGoal: TrainingGoal) {
    setGoal(nextGoal);
    localStorage.setItem("trainingGoal", nextGoal);
    loadToday(nextGoal);
  }

  function disconnect() {
    fetch("/api/whoop/disconnect", { method: "POST" }).finally(() => {
      setData({ connected: false });
    });
  }

  useEffect(() => {
    const storedGoal = localStorage.getItem("trainingGoal");
    const initialGoal = goals.some((item) => item.value === storedGoal) ? (storedGoal as TrainingGoal) : "general";

    setGoal(initialGoal);
    loadToday(initialGoal);
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

  const trends = data.trends ?? [];

  return (
    <>
      <section className="statusRow" aria-label="Connection status">
        <span>WHOOP connected</span>
        <div className="buttonRow">
          <button className="secondaryButton" onClick={() => loadToday()} type="button">
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          <button className="ghostButton" onClick={disconnect} type="button">
            Disconnect
          </button>
        </div>
      </section>

      <section className="goalPanel" aria-label="Training goal">
        <p className="eyebrow">Goal</p>
        <div className="goalControl">
          {goals.map((item) => (
            <button
              aria-pressed={goal === item.value}
              className={goal === item.value ? "goalButton active" : "goalButton"}
              key={item.value}
              onClick={() => changeGoal(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
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

      {data.coach ? (
        <section className="panel coachPanel">
          <div className="coachHeader">
            <div>
              <p className="eyebrow">Coach</p>
              <h2>{data.coach.title}</h2>
            </div>
            <span>{data.coach.intensity}</span>
          </div>
          <p>{data.coach.plan}</p>
          <div className="coachGrid">
            <div>
              <span>Focus</span>
              <ul>
                {data.coach.focus.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <span>Avoid</span>
              <ul>
                {data.coach.avoid.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <details className="coachReasons">
            <summary>Why this plan</summary>
            <ul>
              {data.coach.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}

      <section className="panel">
        <div>
          <p className="eyebrow">Training</p>
          <h2>{data.today.readiness} day</h2>
        </div>
        <p>{data.today.recommendation}</p>
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">7 Days</p>
          <h2>Trend</h2>
        </div>
        <div className="trendStack">
          <TrendRow
            accent="var(--red)"
            label="Recovery"
            max={100}
            suffix="%"
            values={trends.map((item) => ({ label: item.label, value: item.recovery_score }))}
          />
          <TrendRow
            accent="var(--amber)"
            label="Sleep"
            max={540}
            values={trends.map((item) => ({ label: item.label, value: item.sleep_minutes }))}
          />
          <TrendRow
            accent="var(--blue)"
            label="Strain"
            max={21}
            values={trends.map((item) => ({ label: item.label, value: item.strain_score }))}
          />
        </div>
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
