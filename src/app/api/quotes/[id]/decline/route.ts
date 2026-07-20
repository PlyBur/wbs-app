import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const body = await request.formData()
  const token = body.get("token") as string

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, public_token")
    .eq("id", params.id)
    .eq("public_token", token)
    .single()

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (quote.status !== "sent") return NextResponse.json({ error: "Quote not in sent state" }, { status: 400 })

  await supabase.from("quotes").update({ status: "declined" }).eq("id", params.id)

  return NextResponse.redirect(new URL(`/quote/${token}`, request.url))
}
