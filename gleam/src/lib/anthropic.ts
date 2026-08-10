import Anthropic from "@anthropic-ai/sdk"

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("[anthropic] ANTHROPIC_API_KEY is not set — Claude calls will fail")
}

export const anthropic = new Anthropic({ apiKey: apiKey ?? "" })

export const MODEL_ID = "claude-sonnet-4-20250514"

export async function generateText(system: string, user: string, maxTokens = 2000): Promise<string> {
  const res = await anthropic.messages.create({
    model: MODEL_ID,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  })
  return res.content[0].type === "text" ? res.content[0].text : ""
}

export async function generateJSON<T>(system: string, user: string, maxTokens = 2000): Promise<T> {
  const text = await generateText(system, user, maxTokens)
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  return JSON.parse(cleaned) as T
}
