import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: "error",
      keyFound: false,
      message: "ANTHROPIC_API_KEY is not set in environment variables",
    });
  }

  const keyPreview = apiKey.slice(0, 20) + "...";

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      messages: [{ role: "user", content: "Reply with exactly: Hello from Fynn AI" }],
    });

    const textBlock = response.content.find((b) => b.type === "text");

    return NextResponse.json({
      status: "success",
      keyFound: true,
      keyPreview,
      model: response.model,
      reply: textBlock?.text ?? null,
      usage: response.usage,
    });
  } catch (err) {
    return NextResponse.json({
      status: "error",
      keyFound: true,
      keyPreview,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
