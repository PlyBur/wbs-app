import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const body = await request.formData()
  const token = body.get("token") as string

  // Verify token matches
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id, status, public_token, expires_at")
    .eq("id", params.id)
    .eq("public_token", token)
    .single()

  if (error || !quote) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (quote.status !== "sent") return NextResponse.json({ error: "Quote not in sent state" }, { status: 400 })
  if (quote.expires_at && new Date(quote.expires_at) < new Date()) {
    return NextResponse.json({ error: "Quote has expired" }, { status: 400 })
  }

  await supabase.from("quotes").update({
    status: "accepted",
    accepted_at: new Date().toISOString(),
  }).eq("id", params.id)

  // Redirect back to quote page
  return NextResponse.redirect(new URL(`/quote/${token}`, request.url))
}
