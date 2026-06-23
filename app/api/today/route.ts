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
    raw: {
      latest_cycle: latestCycle,
      latest_recovery: latestRecovery,
      latest_sleep: latestSleep,
      latest_workout: latestWorkout
    }
  });
}
