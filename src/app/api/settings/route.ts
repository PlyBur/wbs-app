import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.from("workspaces").select("*").single()
  return NextResponse.json(data ?? {})
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { data, error } = await supabase
    .from("workspaces")
    .update(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
