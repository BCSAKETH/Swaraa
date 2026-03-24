import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://bxvzygsapszhizjekrtw.supabase.co"
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dnp5Z3NhcHN6aGl6amVrcnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODczODksImV4cCI6MjA4OTc2MzM4OX0.sUl84joN_RBeHNbVI-upyKqt38p6Meaqn6xcDiCcxoY"
const DAILY_LIMIT = 10

export async function POST(req: NextRequest) {
  try {
    const GROQ_KEY = process.env.GROQ_KEY
    if (!GROQ_KEY) {
      return NextResponse.json({ error: "AI search not configured. Add GROQ_KEY to environment variables." }, { status: 503 })
    }

    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const token = authHeader.replace("Bearer ", "")

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session — please sign in again" }, { status: 401 })
    }

    const today = new Date().toISOString().split("T")[0]
    const { data: usage } = await supabase
      .from("ai_usage").select("count")
      .eq("user_id", user.id).eq("date", today).single()

    const currentCount = usage?.count ?? 0
    if (currentCount >= DAILY_LIMIT) {
      return NextResponse.json({
        error: `Daily limit reached. You have used all ${DAILY_LIMIT} AI searches for today. Resets at midnight.`,
        limit: DAILY_LIMIT, used: currentCount
      }, { status: 429 })
    }

    const { query } = await req.json()
    if (!query?.trim()) return NextResponse.json({ error: "No song query provided" }, { status: 400 })

    const prompt = `You are an expert Indian classical and film music harmonium teacher with deep knowledge of sargam notation.

Generate accurate harmonium MIDI notes for the song: "${query}"

Generate the REAL melody — the actual notes a harmonium player would play for the main tune (mukhda + one antara).

MIDI note reference (harmonium Sa = C, standard tuning):
Lower octave: Sa=48, Re=50, Ga=52, Ma=53, Pa=55, Dha=57, Ni=59
Middle octave: Sa=60, Re_komal=61, Re=62, Ga_komal=63, Ga=64, Ma=65, Ma_tivra=66, Pa=67, Dha_komal=68, Dha=69, Ni_komal=70, Ni=71
Upper octave: Sa=72, Re=74, Ga=76, Ma=77, Pa=79, Dha=81, Ni=83

Duration in milliseconds: 200=very fast, 300=fast, 400=normal beat, 600=held, 800=long hold

Return ONLY a valid JSON object, nothing else:
{"bpm":90,"emoji":"emoji","genre":"Bollywood","difficulty":"Medium","language":"Hindi","description":"brief desc","notes":[{"note":60,"duration":400,"lyric":"word"}]}

Rules: 25-40 notes, cover full melody, lyric=syllable sung on that note, genre one of: Bollywood/Telugu/Tamil/Classical/Bhajan/Folk/Western/Children/Patriotic/Punjabi/Kannada/Exercise, difficulty: Easy/Medium/Hard. Return ONLY the JSON.`

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are an expert harmonium teacher. Respond only with a valid JSON object containing harmonium notes. No text before or after the JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    })

    if (!groqRes.ok) {
      const errBody = await groqRes.json().catch(() => ({}))
      const msg = (errBody as any)?.error?.message || `Groq error ${groqRes.status}`
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const groqData = await groqRes.json()
    const text = groqData?.choices?.[0]?.message?.content || ""
    if (!text) return NextResponse.json({ error: "Empty response from AI" }, { status: 502 })

    let song: any
    try {
      song = JSON.parse(text.replace(/```json|```/g, "").trim())
    } catch {
      const match = text.match(/\{[\s\S]*"notes"[\s\S]*\}/)
      if (!match) return NextResponse.json({ error: "Could not parse AI response" }, { status: 502 })
      song = JSON.parse(match[0])
    }

    if (!song.notes || !Array.isArray(song.notes) || song.notes.length < 3) {
      return NextResponse.json({ error: "AI returned incomplete song data" }, { status: 502 })
    }

    if (usage) {
      await supabase.from("ai_usage").update({ count: currentCount + 1 }).eq("user_id", user.id).eq("date", today)
    } else {
      await supabase.from("ai_usage").insert({ user_id: user.id, date: today, count: 1 })
    }

    return NextResponse.json({
      song: { ...song, source: "ai" },
      usage: { used: currentCount + 1, limit: DAILY_LIMIT, remaining: DAILY_LIMIT - currentCount - 1 }
    })

  } catch (err: any) {
    console.error("[ai-song] Error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
