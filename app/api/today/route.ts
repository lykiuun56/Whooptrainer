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

type TrainingGoal = "general" | "strength" | "hypertrophy" | "cardio" | "recovery";

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
  if (recovery == null) return "未知";
  if (recovery >= 67) return "推进";
  if (recovery >= 34) return "建设";
  if (recovery >= 20) return "轻量";
  return "恢复";
}

function recommendation(level: string) {
  if (level === "推进") return "恢复状态不错。如果热身感觉也好，今天可以安排较高质量训练。";
  if (level === "建设") return "可以正常训练，但强度别硬冲，观察睡眠和热身反馈。";
  if (level === "轻量") return "控制强度。Zone 2、有氧基础、技术练习或灵活性训练更适合今天。";
  if (level === "恢复") return "今天优先恢复、睡眠、补水和低压力活动。";
  return "连接 WHOOP 并同步数据后，我会给出训练建议。";
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
  goal,
  recoveryScore,
  sleep,
  strain,
  hrv,
  rhr,
  trends
}: {
  level: string;
  goal: TrainingGoal;
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
  const goalLabel = {
    general: "综合训练",
    strength: "力量",
    hypertrophy: "增肌",
    cardio: "有氧",
    recovery: "恢复"
  }[goal];

  if (recoveryScore != null) reasons.push(`今日恢复 ${Math.round(recoveryScore)}%。`);
  reasons.push(`当前目标是${goalLabel}。`);
  if (sleepTime != null) reasons.push(`睡眠 ${Math.floor(sleepTime / 60)}h ${sleepTime % 60}m。`);
  if (hrv != null) reasons.push(`HRV ${Math.round(hrv)} ms。`);
  if (rhr != null) reasons.push(`静息心率 ${Math.round(rhr)} bpm。`);
  if (strain != null) reasons.push(`当前 cycle strain ${strain.toFixed(1)}。`);

  if (recoveryDirection === "down") {
    reasons.push("最近一周恢复趋势在下降。");
    avoid.push("极限组");
  }

  if (sleepTime != null && sleepTime < 420) {
    reasons.push("睡眠少于 7 小时。");
    avoid.push("高容量收尾");
  }

  if (sleepPerformance != null && sleepPerformance < 70) {
    reasons.push(`睡眠表现 ${Math.round(sleepPerformance)}%。`);
    avoid.push("太晚做高强度有氧");
  }

  if (strainAverage != null && strainAverage >= 12) {
    reasons.push("最近 strain 负荷偏高。");
    avoid.push("连续叠加高 strain 日");
  }

  if (sleepAverage != null && sleepAverage >= 420) {
    focus.push("保持稳定睡眠时间");
  }

  if (goal === "strength") {
    focus.push("重训技术质量", "组间充分休息");
    avoid.push("主项前做疲劳收尾");
  }

  if (goal === "hypertrophy") {
    focus.push("可控容量", "目标肌肉发力清楚");
    avoid.push("为了重量牺牲动作");
  }

  if (goal === "cardio") {
    focus.push("有氧质量", "平稳配速");
    avoid.push("把轻松有氧做成比赛");
  }

  if (goal === "recovery") {
    focus.push("低压力活动", "灵活性");
    avoid.push("为了刷 strain 而训练");
  }

  if (level === "推进") {
    if (goal === "strength") {
      focus.push("一个高质量 top set 加回退组");
    } else if (goal === "hypertrophy") {
      focus.push("渐进超负荷", "中高容量");
    } else if (goal === "cardio") {
      focus.push("阈值或间歇训练");
    } else {
      focus.push("主项递进", "有质量的体能训练");
    }

    return {
      title: "有目的地推进",
      intensity: "RPE 8-9",
      plan:
        goal === "recovery"
          ? "身体有训练空间，但你选择了恢复目标。今天保持轻松，把好状态存下来。"
          : "今天适合较硬的训练。优先做最重要的主项，在动作质量下降前收手。",
      focus,
      avoid: avoid.length ? avoid : ["主项后堆垃圾容量"],
      reasons
    };
  }

  if (level === "建设") {
    if (goal === "strength") {
      focus.push("次极限复合动作", "杠速");
    } else if (goal === "hypertrophy") {
      focus.push("高质量工作组", "稳定技术");
    } else if (goal === "cardio") {
      focus.push("Zone 2 基础有氧");
    } else {
      focus.push("中等强度力量", "Zone 2 或辅助动作");
    }

    return {
      title: "建设，不测试极限",
      intensity: "RPE 7-8",
      plan:
        goal === "recovery"
          ? "今天用来恢复。轻松活动、灵活性和短距离散步，比结构化强度更合适。"
          : "可以正常训练，但保持可控。追求高质量次数，不追极限。",
      focus,
      avoid: avoid.length ? avoid : ["1RM 尝试", "硬磨组"],
      reasons
    };
  }

  if (level === "轻量") {
    if (goal === "strength") {
      focus.push("技术单次", "轻重量速度练习");
    } else if (goal === "hypertrophy") {
      focus.push("轻泵感训练", "器械或辅助动作");
    } else if (goal === "cardio") {
      focus.push("轻松 Zone 2");
    } else {
      focus.push("技术", "灵活性", "轻松有氧");
    }

    return {
      title: "轻量日",
      intensity: "RPE 5-6",
      plan: "今天把训练做轻，目标是离开时比开始时状态更好。",
      focus,
      avoid: avoid.length ? avoid : ["重型复合动作", "力竭组"],
      reasons
    };
  }

  if (level === "恢复") {
    focus.push("散步", "灵活性", "睡眠和补水");

    return {
      title: "先恢复",
      intensity: "非常轻松",
      plan: "今天当作恢复日。如果要动，保持低压力、短时间。",
      focus,
      avoid: avoid.length ? avoid : ["高强度训练", "高 strain 目标"],
      reasons
    };
  }

  return {
    title: "需要更多数据",
    intensity: "未知",
    plan: "同步新的 WHOOP 数据后，我会生成训练建议。",
    focus,
    avoid,
    reasons
  };
}

export async function GET(request: Request) {
  const storedSession = await getWhoopSession();
  const goalParam = new URL(request.url).searchParams.get("goal");
  const goal: TrainingGoal =
    goalParam === "strength" ||
    goalParam === "hypertrophy" ||
    goalParam === "cardio" ||
    goalParam === "recovery"
      ? goalParam
      : "general";

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
    goal,
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
