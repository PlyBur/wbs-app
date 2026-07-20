"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AcceptQuoteButton({ quoteId, token }: { quoteId: string; token: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function accept() {
    if (!confirm("Accept this quote? This confirms you agree to proceed.")) return
    setLoading(true)
    await fetch(`/api/quotes/${quoteId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    setDone(true)
    router.refresh()
  }

  if (done) return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
      <p className="text-green-700 font-semibold">✓ Quote accepted</p>
      <p className="text-green-600 text-sm mt-1">Thank you! We will be in touch shortly.</p>
    </div>
  )

  return (
    <button
      onClick={accept}
      disabled={loading}
      className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
    >
      {loading ? "Processing…" : "Accept this quote"}
    </button>
  )
}
