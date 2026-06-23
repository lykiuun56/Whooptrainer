import { NextResponse } from "next/server";
import { getWhoopSession } from "../../../lib/whoop-session";
import { refreshWhoopSession, whoopGet } from "../../../lib/whoop-api";

type Collection<T> = {
  records?: T[];
  next_token?: string;
};

type Profile = {
  user_id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
};

type Cycle = {
  id: number;
  start: string;
  end?: string;
  score_state?: string;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  };
};

type Recovery = {
  cycle_id: number;
  sleep_id?: string;
  score_state?: string;
  score?: {
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
};

type Sleep = {
  id: string;
  start: string;
  end?: string;
  score_state?: string;
  score?: {
    sleep_performance_percentage?: number;
    sleep_efficiency_percentage?: number;
    sleep_consistency_percentage?: number;
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_no_data_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
    };
  };
};

type Workout = {
  id: string;
  start: string;
  end?: string;
  sport_name?: string;
  score_state?: string;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  };
};

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function latestByStart<T extends { start: string }>(records: T[] = []) {
  return records.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())[0] ?? null;
}

function sleepMinutes(sleep: Sleep | null) {
  const summary = sleep?.score?.stage_summary;

  if (!summary) {
    return null;
  }

  const asleep =
    (summary.total_light_sleep_time_milli ?? 0) +
    (summary.total_slow_wave_sleep_time_milli ?? 0) +
    (summary.total_rem_sleep_time_milli ?? 0);

  return Math.round(asleep / 60000);
}

function readiness(recovery?: number) {
  if (recovery == null) return "Unknown";
  if (recovery >= 67) return "Push";
  if (recovery >= 34) return "Build";
  if (recovery >= 20) return "Light";
  return "Rest";
}

function recommendation(level: string) {
  if (level === "Push") return "Recovery is strong. This is a good day for harder training if you feel ready.";
  if (level === "Build") return "Train normally, but keep an eye on sleep and how your warmup feels.";
  if (level === "Light") return "Keep intensity controlled. Zone 2, mobility, or technique work fits today.";
  if (level === "Rest") return "Prioritize recovery, sleep, hydration, and low-stress movement.";
  return "Connect WHOOP and sync fresh data to get a recommendation.";
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function shortDay(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${value}T12:00:00Z`));
}

function buildTrends(cycleRecords: Cycle[] = [], recoveryRecords: Recovery[] = [], sleepRecords: Sleep[] = []) {
  const recoveryByCycle = new Map(recoveryRecords.map((record) => [record.cycle_id, record]));
  const sleepByDate = new Map(sleepRecords.map((record) => [dateKey(record.start), record]));

  return [...cycleRecords]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .map((cycle) => {
      const date = dateKey(cycle.start);
      const recovery = recoveryByCycle.get(cycle.id);
      const sleep = sleepByDate.get(date);

      return {
        date,
        label: shortDay(date),
        recovery_score: recovery?.score?.recovery_score ?? null,
        sleep_minutes: sleepMinutes(sleep ?? null),
        strain_score: cycle.score?.strain ?? null,
        hrv_rmssd_milli: recovery?.score?.hrv_rmssd_milli ?? null
      };
    });
}

type Trend = ReturnType<typeof buildTrends>[number];

function average(values: (number | null)[]) {
  const available = values.filter((value): value is number => value != null);

  if (available.length === 0) {
    return null;
  }

  return available.reduce((total, value) => total + value, 0) / available.length;
}

function trendDirection(values: (number | null)[]) {
  const available = values.filter((value): value is number => value != null);

  if (available.length < 4) {
    return "stable";
  }

  const recent = average(available.slice(-3));
  const previous = average(available.slice(0, -3));

  if (recent == null || previous == null) {
    return "stable";
  }

  const delta = recent - previous;

  if (delta >= 5) return "up";
  if (delta <= -5) return "down";
  return "stable";
}

function coachPlan({
  level,
  recoveryScore,
  sleep,
  strain,
  hrv,
  rhr,
  trends
}: {
  level: string;
  recoveryScore?: number;
  sleep: Sleep | null;
  strain?: number;
  hrv?: number;
  rhr?: number;
  trends: Trend[];
}) {
  const sleepTime = sleepMinutes(sleep);
  const sleepPerformance = sleep?.score?.sleep_performance_percentage;
  const recoveryDirection = trendDirection(trends.map((item) => item.recovery_score));
  const strainAverage = average(trends.map((item) => item.strain_score));
  const sleepAverage = average(trends.map((item) => item.sleep_minutes));
  const reasons: string[] = [];
  const avoid: string[] = [];
  const focus: string[] = [];

  if (recoveryScore != null) reasons.push(`Recovery is ${Math.round(recoveryScore)}%.`);
  if (sleepTime != null) reasons.push(`Sleep was ${Math.floor(sleepTime / 60)}h ${sleepTime % 60}m.`);
  if (hrv != null) reasons.push(`HRV is ${Math.round(hrv)} ms.`);
  if (rhr != null) reasons.push(`RHR is ${Math.round(rhr)} bpm.`);
  if (strain != null) reasons.push(`Current cycle strain is ${strain.toFixed(1)}.`);

  if (recoveryDirection === "down") {
    reasons.push("Recovery is trending down over the last week.");
    avoid.push("max effort sets");
  }

  if (sleepTime != null && sleepTime < 420) {
    reasons.push("Sleep was under 7 hours.");
    avoid.push("high-volume finishers");
  }

  if (sleepPerformance != null && sleepPerformance < 70) {
    reasons.push(`Sleep performance is ${Math.round(sleepPerformance)}%.`);
    avoid.push("late intense cardio");
  }

  if (strainAverage != null && strainAverage >= 12) {
    reasons.push("Recent strain load is elevated.");
    avoid.push("stacking another high-strain day");
  }

  if (sleepAverage != null && sleepAverage >= 420) {
    focus.push("keep sleep timing consistent");
  }

  if (level === "Push") {
    focus.push("main lift progression", "hard but clean conditioning");

    return {
      title: "Push with intent",
      intensity: "RPE 8-9",
      plan: "Good day for a harder session. Prioritize your main lift or key sport work, then stop before form drops.",
      focus,
      avoid: avoid.length ? avoid : ["junk volume after the main work"],
      reasons
    };
  }

  if (level === "Build") {
    focus.push("moderate strength work", "Zone 2 or accessories");

    return {
      title: "Build, do not test",
      intensity: "RPE 7-8",
      plan: "Train normally, but keep the session controlled. Add quality reps rather than chasing a max.",
      focus,
      avoid: avoid.length ? avoid : ["one-rep max attempts", "grinding sets"],
      reasons
    };
  }

  if (level === "Light") {
    focus.push("technique", "mobility", "easy aerobic work");

    return {
      title: "Light day",
      intensity: "RPE 5-6",
      plan: "Keep training easy and leave the gym feeling better than when you walked in.",
      focus,
      avoid: avoid.length ? avoid : ["heavy compounds", "failure sets"],
      reasons
    };
  }

  if (level === "Rest") {
    focus.push("walking", "mobility", "sleep and hydration");

    return {
      title: "Recover first",
      intensity: "Very easy",
      plan: "Treat today as recovery. If you move, keep it low stress and short.",
      focus,
      avoid: avoid.length ? avoid : ["hard training", "high strain targets"],
      reasons
    };
  }

  return {
    title: "Connect more data",
    intensity: "Unknown",
    plan: "Sync fresh WHOOP data to generate a coaching recommendation.",
    focus,
    avoid,
    reasons
  };
}

export async function GET() {
  const storedSession = await getWhoopSession();

  if (!storedSession) {
    return NextResponse.json(
      {
        connected: false,
        error: "WHOOP is not connected"
      },
      { status: 401 }
    );
  }

  const session = await refreshWhoopSession(storedSession);
  const start = isoDaysAgo(7);
  const end = new Date().toISOString();

  const [profile, cycles, recoveries, sleeps, workouts] = await Promise.all([
    whoopGet<Profile>(session, "/user/profile/basic"),
    whoopGet<Collection<Cycle>>(session, "/cycle", { limit: "7", start, end }),
    whoopGet<Collection<Recovery>>(session, "/recovery", { limit: "7", start, end }),
    whoopGet<Collection<Sleep>>(session, "/activity/sleep", { limit: "7", start, end }),
    whoopGet<Collection<Workout>>(session, "/activity/workout", { limit: "7", start, end })
  ]);

  if (!profile.ok || !cycles.ok || !recoveries.ok || !sleeps.ok || !workouts.ok) {
    return NextResponse.json(
      {
        connected: true,
        error: "Unable to fetch all WHOOP data",
        detail: { profile, cycles, recoveries, sleeps, workouts }
      },
      { status: 502 }
    );
  }

  const latestCycle = latestByStart(cycles.data.records);
  const latestSleep = latestByStart(sleeps.data.records);
  const latestRecovery =
    recoveries.data.records?.find((record) => record.cycle_id === latestCycle?.id) ??
    recoveries.data.records?.[0] ??
    null;
  const latestWorkout = latestByStart(workouts.data.records);
  const recoveryScore = latestRecovery?.score?.recovery_score;
  const level = readiness(recoveryScore);
  const trends = buildTrends(cycles.data.records, recoveries.data.records, sleeps.data.records);
  const coach = coachPlan({
    level,
    recoveryScore,
    sleep: latestSleep,
    strain: latestCycle?.score?.strain,
    hrv: latestRecovery?.score?.hrv_rmssd_milli,
    rhr: latestRecovery?.score?.resting_heart_rate,
    trends
  });

  return NextResponse.json({
    connected: true,
    profile: profile.data,
    today: {
      date: new Date().toISOString(),
      readiness: level,
      recommendation: recommendation(level),
      recovery_score: recoveryScore ?? null,
      strain_score: latestCycle?.score?.strain ?? null,
      sleep_performance: latestSleep?.score?.sleep_performance_percentage ?? null,
      sleep_minutes: sleepMinutes(latestSleep),
      hrv_rmssd_milli: latestRecovery?.score?.hrv_rmssd_milli ?? null,
      resting_heart_rate: latestRecovery?.score?.resting_heart_rate ?? null,
      latest_workout: latestWorkout
        ? {
            sport_name: latestWorkout.sport_name,
            strain: latestWorkout.score?.strain ?? null,
            start: latestWorkout.start
          }
        : null
    },
    coach,
    raw: {
      latest_cycle: latestCycle,
      latest_recovery: latestRecovery,
      latest_sleep: latestSleep,
      latest_workout: latestWorkout
    },
    trends
  });
}
