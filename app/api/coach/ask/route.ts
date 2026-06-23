import OpenAI from "openai";
import { NextResponse } from "next/server";

type CoachAskBody = {
  question?: string;
  goal?: string;
  today?: unknown;
  trends?: unknown;
  coach?: unknown;
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
        "You are Yukun's recovery-aware training coach.",
        "Use the provided WHOOP data, selected training goal, 7-day trends, and deterministic coach recommendation.",
        "Do not diagnose medical conditions or present medical advice.",
        "Give practical training guidance with a clear recommendation, intensity, and one or two reasons.",
        "If the user asks for something risky, suggest a safer training adjustment.",
        "Keep answers concise and actionable."
      ].join(" "),
      input: [
        {
          role: "user",
          content: JSON.stringify({
            question,
            selected_goal: body.goal ?? "general",
            whoop_today: body.today,
            seven_day_trends: body.trends,
            rule_based_coach: body.coach
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
          ? "OpenAI is connected, but this API key has no available quota. Add billing or use a key from a project with available credits."
          : `Ask Coach failed: ${message}`
      },
      { status: isQuotaError ? 429 : 502 }
    );
  }
}
