import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format ZAR currency: R 1 234,56
export function formatZAR(amount: number): string {
  return (
    "R " +
    amount
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ") // non-breaking space
  )
}

// Calculate travel cost
export function calcTravelCost(
  distanceKm: number,
  costPerKm: number,
  freeRadiusKm: number
): number {
  const billable = Math.max(0, distanceKm - freeRadiusKm)
  return Math.round(billable * costPerKm * 100) / 100
}

// Calculate quote totals
export function calcQuoteTotals(
  lineItems: { line_total: number }[],
  travelCost: number,
  discount: number,
  vatRate: number
) {
  const subtotal = lineItems.reduce((s, i) => s + i.line_total, 0)
  const taxable = Math.max(0, subtotal + travelCost - discount)
  const vat = Math.round(taxable * vatRate * 100) / 100
  const total = Math.round((taxable + vat) * 100) / 100
  return { subtotal, vat_amount: vat, total }
}

// Generate document number prefix: QTE-2026-0042
export function formatDocNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`
}

// Relative time: "3 days ago"
export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? "s" : ""} ago`
}

// Short date: "18 Aug 2026"
export function shortDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

// Get initials from name: "Johan van der Merwe" → "JV"
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Avatar colour from name (deterministic)
const AVATAR_COLOURS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
]
export function avatarColour(name: string): string {
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length]
}
