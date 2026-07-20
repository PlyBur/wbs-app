import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Vercel cron: runs daily at 06:00 UTC
// vercel.json: { "crons": [{ "path": "/api/cron/overdue", "schedule": "0 6 * * *" }] }
// Protected by CRON_SECRET env var
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]

  // Mark issued invoices past their due date as overdue
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .in("status", ["issued", "sent"])
    .lt("due_date", today)
    .select("id")

  if (error) {
    console.error("[cron/overdue]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[cron/overdue] Marked ${data?.length ?? 0} invoice(s) as overdue`)
  return NextResponse.json({ updated: data?.length ?? 0 })
}
