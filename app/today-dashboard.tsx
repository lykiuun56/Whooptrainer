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

type CheckinEntry = {
  id: string;
  date: string;
  trainingIntent: string;
  food: string;
  soreness: string;
  mood: string;
  notes: string;
  rpe: string;
};

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
  { value: "general", label: "综合" },
  { value: "strength", label: "力量" },
  { value: "hypertrophy", label: "增肌" },
  { value: "cardio", label: "有氧" },
  { value: "recovery", label: "恢复" }
];

const emptyCheckin = {
  trainingIntent: "",
  food: "",
  soreness: "",
  mood: "",
  notes: "",
  rpe: ""
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
  const [coachQuestion, setCoachQuestion] = useState("今天我应该怎么练？");
  const [coachAnswer, setCoachAnswer] = useState("");
  const [askingCoach, setAskingCoach] = useState(false);
  const [checkin, setCheckin] = useState(emptyCheckin);
  const [checkins, setCheckins] = useState<CheckinEntry[]>([]);

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

  function askCoach() {
    const question = coachQuestion.trim();

    if (!question || !data?.today) {
      return;
    }

    setAskingCoach(true);
    setCoachAnswer("");

    fetch("/api/coach/ask", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        question,
        goal,
        today: data.today,
        trends: data.trends ?? [],
        coach: data.coach ?? null,
        profile: data.profile ?? null,
        recent_checkins: checkins.slice(0, 10)
      })
    })
      .then(async (response) => {
        const payload = (await response.json()) as { answer?: string; error?: string };
        setCoachAnswer(payload.answer ?? payload.error ?? "No answer returned.");
      })
      .catch(() => {
        setCoachAnswer("Coach 现在暂时不可用，稍后再试。");
      })
      .finally(() => setAskingCoach(false));
  }

  function updateCheckin(field: keyof typeof emptyCheckin, value: string) {
    setCheckin((current) => ({ ...current, [field]: value }));
  }

  function saveCheckin() {
    const hasContent = Object.values(checkin).some((value) => value.trim());

    if (!hasContent) {
      return;
    }

    const entry: CheckinEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      trainingIntent: checkin.trainingIntent.trim(),
      food: checkin.food.trim(),
      soreness: checkin.soreness.trim(),
      mood: checkin.mood.trim(),
      notes: checkin.notes.trim(),
      rpe: checkin.rpe.trim()
    };
    const nextCheckins = [entry, ...checkins].slice(0, 30);

    setCheckins(nextCheckins);
    localStorage.setItem("coachCheckins", JSON.stringify(nextCheckins));
    setCheckin(emptyCheckin);
  }

  useEffect(() => {
    const storedGoal = localStorage.getItem("trainingGoal");
    const initialGoal = goals.some((item) => item.value === storedGoal) ? (storedGoal as TrainingGoal) : "general";
    const storedCheckins = localStorage.getItem("coachCheckins");

    if (storedCheckins) {
      try {
        const parsed = JSON.parse(storedCheckins) as CheckinEntry[];

        if (Array.isArray(parsed)) {
          setCheckins(parsed.slice(0, 30));
        }
      } catch {
        localStorage.removeItem("coachCheckins");
      }
    }

    setGoal(initialGoal);
    loadToday(initialGoal);
  }, []);

  if (loading) {
    return (
      <section className="panel">
        <p className="eyebrow">Syncing</p>
        <h2>正在读取 WHOOP 数据</h2>
      </section>
    );
  }

  if (!data?.connected || !data.today) {
    return (
      <section className="panel">
        <p className="eyebrow">Setup</p>
        <h2>连接 WHOOP</h2>
        <p>授权 WHOOP 后，我才能读取你的恢复、睡眠、strain 和训练数据。</p>
        <a className="primaryButton compactButton" href="/api/whoop/connect">
          Connect WHOOP
        </a>
      </section>
    );
  }

  const metrics = [
    { label: "恢复", value: formatValue(data.today.recovery_score, "%"), tone: "low" },
    { label: "睡眠", value: formatSleep(data.today.sleep_minutes), tone: "mid" },
    { label: "HRV", value: formatValue(data.today.hrv_rmssd_milli, " ms"), tone: "mid" },
    { label: "Strain", value: data.today.strain_score?.toFixed(1) ?? "--", tone: "high" }
  ];

  const trends = data.trends ?? [];

  return (
    <>
      <section className="statusRow" aria-label="Connection status">
        <span>WHOOP 已连接</span>
        <div className="buttonRow">
          <button className="secondaryButton" onClick={() => loadToday()} type="button">
            {refreshing ? "刷新中" : "刷新"}
          </button>
          <button className="ghostButton" onClick={disconnect} type="button">
            断开
          </button>
        </div>
      </section>

      <section className="goalPanel" aria-label="Training goal">
        <p className="eyebrow">目标</p>
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
              <p className="eyebrow">教练</p>
              <h2>{data.coach.title}</h2>
            </div>
            <span>{data.coach.intensity}</span>
          </div>
          <p>{data.coach.plan}</p>
          <div className="coachGrid">
            <div>
              <span>重点</span>
              <ul>
                {data.coach.focus.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <span>避免</span>
              <ul>
                {data.coach.avoid.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <details className="coachReasons">
            <summary>为什么这样安排</summary>
            <ul>
              {data.coach.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}

      <section className="panel memoryPanel">
        <div>
          <p className="eyebrow">教练记忆</p>
          <h2>今天的输入</h2>
        </div>
        <div className="checkinGrid">
          <label>
            今天想练什么
            <input
              onChange={(event) => updateCheckin("trainingIntent", event.target.value)}
              placeholder="比如：胸背、腿、有氧、休息"
              value={checkin.trainingIntent}
            />
          </label>
          <label>
            饮食/补剂
            <input
              onChange={(event) => updateCheckin("food", event.target.value)}
              placeholder="比如：早餐、咖啡、蛋白、酒精"
              value={checkin.food}
            />
          </label>
          <label>
            酸痛/不舒服
            <input
              onChange={(event) => updateCheckin("soreness", event.target.value)}
              placeholder="比如：腿酸、肩紧、腰没事"
              value={checkin.soreness}
            />
          </label>
          <label>
            心情/压力
            <input
              onChange={(event) => updateCheckin("mood", event.target.value)}
              placeholder="比如：精神好、压力大、一般"
              value={checkin.mood}
            />
          </label>
          <label>
            训练后 RPE
            <input
              onChange={(event) => updateCheckin("rpe", event.target.value)}
              placeholder="1-10，可留空"
              value={checkin.rpe}
            />
          </label>
          <label className="wideField">
            备注
            <textarea
              onChange={(event) => updateCheckin("notes", event.target.value)}
              placeholder="动作、重量、体感、食欲、睡前状态，都可以写。"
              value={checkin.notes}
            />
          </label>
        </div>
        <button className="secondaryButton memoryButton" onClick={saveCheckin} type="button">
          保存到教练记忆
        </button>
        {checkins.length ? (
          <div className="memoryList">
            <span>最近记忆</span>
            {checkins.slice(0, 3).map((entry) => (
              <p key={entry.id}>
                {new Date(entry.date).toLocaleDateString("zh-CN")} -{" "}
                {[entry.trainingIntent, entry.food, entry.soreness, entry.mood, entry.rpe ? `RPE ${entry.rpe}` : ""]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">问教练</p>
          <h2>问教练</h2>
        </div>
        <div className="askCoachForm">
          <input
            aria-label="Ask Coach"
            onChange={(event) => setCoachQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                askCoach();
              }
            }}
            placeholder="今天适合练腿吗？"
            value={coachQuestion}
          />
          <button className="secondaryButton" disabled={askingCoach} onClick={askCoach} type="button">
            {askingCoach ? "思考中" : "提问"}
          </button>
        </div>
        {coachAnswer ? <p className="coachAnswer">{coachAnswer}</p> : null}
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">训练</p>
          <h2>{data.today.readiness}日</h2>
        </div>
        <p>{data.today.recommendation}</p>
      </section>

      <section className="panel">
        <div>
          <p className="eyebrow">7 天</p>
          <h2>趋势</h2>
        </div>
        <div className="trendStack">
          <TrendRow
            accent="var(--red)"
            label="恢复"
            max={100}
            suffix="%"
            values={trends.map((item) => ({ label: item.label, value: item.recovery_score }))}
          />
          <TrendRow
            accent="var(--amber)"
            label="睡眠"
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
          <p className="eyebrow">最新</p>
          <h2>{data.profile?.first_name ? `${data.profile.first_name}'s WHOOP` : "WHOOP data"}</h2>
        </div>
        <p>
          静息心率 {formatValue(data.today.resting_heart_rate, " bpm")} - 睡眠表现{" "}
          {formatValue(data.today.sleep_performance, "%")}
        </p>
        {data.today.latest_workout ? (
          <p>
            最近训练：{data.today.latest_workout.sport_name ?? "Workout"} - Strain{" "}
            {data.today.latest_workout.strain?.toFixed(1) ?? "--"}
          </p>
        ) : null}
      </section>
    </>
  );
}
