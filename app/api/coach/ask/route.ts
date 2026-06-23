import OpenAI from "openai";
import { NextResponse } from "next/server";

type CoachAskBody = {
  question?: string;
  goal?: string;
  today?: unknown;
  trends?: unknown;
  coach?: unknown;
  profile?: unknown;
  recent_checkins?: unknown;
};

const model = process.env.OPENAI_MODEL ?? "gpt-5.5";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OpenAI is not configured",
        answer: "Add OPENAI_API_KEY in Vercel Environment Variables to enable Ask Coach."
      },
      { status: 501 }
    );
  }

  let body: CoachAskBody;

  try {
    body = (await request.json()) as CoachAskBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = body.question?.trim();

  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.responses.create({
      model,
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
      instructions: [
        "你是 Yukun 的私人训练教练，只用中文回答。",
        "你的教练原则来自一个 recovery-aware fitness coach RPG framework：训练安全优先、数据驱动、长期连续性、恢复状态优先于硬冲。",
        "使用提供的 WHOOP 数据、训练目标、7 天趋势、规则教练建议、用户最近 check-in 和训练记忆。",
        "如果用户输入了饮食、酸痛、压力、RPE 或训练备注，要把这些当作比单日 WHOOP 数字更细的上下文。",
        "回答要像真正的私教：先给今天怎么练，再说强度，再说为什么，最后给一个可执行注意点。",
        "可以轻微使用等级/经验/成长感，但不要让 RPG 盖过专业训练建议。",
        "不要诊断疾病，不要给医疗建议；如果有风险，主动给更安全的训练调整。",
        "保持简洁、直接、可执行。"
      ].join(" "),
      input: [
        {
          role: "user",
          content: JSON.stringify({
            question,
            selected_goal: body.goal ?? "general",
            profile: body.profile,
            whoop_today: body.today,
            seven_day_trends: body.trends,
            rule_based_coach: body.coach,
            recent_checkins: body.recent_checkins
          })
        }
      ]
    });

    return NextResponse.json({
      answer: response.output_text
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI error";
    const isQuotaError = message.includes("429") || message.toLowerCase().includes("quota");

    return NextResponse.json(
      {
        error: "OpenAI request failed",
        answer: isQuotaError
          ? "OpenAI 已经接上了，但这个 API key 目前没有可用额度。需要加 billing，或换一个有额度的 project key。"
          : `Ask Coach failed: ${message}`
      },
      { status: isQuotaError ? 429 : 502 }
    );
  }
}
