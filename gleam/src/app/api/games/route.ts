import { NextResponse } from "next/server"
import { WORD_ASSOC, STORY_COMPLETE, VISUAL_CHOICE, TIME_PATTERN } from "@/lib/games"

export async function GET() {
  return NextResponse.json({
    games: [WORD_ASSOC, STORY_COMPLETE, VISUAL_CHOICE, TIME_PATTERN],
  })
}
