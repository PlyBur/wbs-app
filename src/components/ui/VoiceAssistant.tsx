"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Mic, MicOff, X, Check, Loader2, AlertCircle, Volume2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/lib/toast"

type VoiceState = "idle" | "listening" | "processing" | "confirming" | "executing" | "done" | "error" | "unsupported"

interface ParsedCommand {
  action: string
  projectId?: string | null
  projectTitle?: string | null
  clientId?: string | null
  clientName?: string | null
  interactionType?: string | null
  summary?: string | null
  amount?: number | null
  category?: string | null
  expenseDescription?: string | null
  taskTitle?: string | null
  newStatus?: string | null
  newClientName?: string | null
  newClientPhone?: string | null
  newClientEmail?: string | null
  newClientCompany?: string | null
  projectName?: string | null
  paymentAmount?: number | null
  paymentMethod?: string | null
  quoteDescription?: string | null
  quoteAmount?: number | null
  humanReadable: string
  confidence: "high" | "medium" | "low"
  rawTranscript?: string
}

const ACTION_EXAMPLES = [
  '"Log a site visit on the Smith project, spoke to Pieter about the tiles"',
  '"Add R450 materials expense on the Jonker job, cement from Builders"',
  '"New client, Johan Botha, 083 123 4567"',
  '"Create a quote for the Van der Merwe bathroom renovation for R12,000"',
  '"Record a R5,000 payment on the Johnson project"',
  '"Create a task on the Smith project: order light fittings by Friday"',
  '"Mark the Jonker project as completed"',
]

export function VoiceAssistant() {
  const [enabled, setEnabled]       = useState(true)
  const [state, setState]           = useState<VoiceState>("idle")
  const [transcript, setTranscript] = useState("")
  const [command, setCommand]       = useState<ParsedCommand | null>(null)
  const [errorMsg, setErrorMsg]     = useState("")
  const [showHelp, setShowHelp]     = useState(false)
  const [projects, setProjects]     = useState<any[]>([])
  const [clients, setClients]       = useState<any[]>([])
  const transcriptRef               = useRef("")
  const recognitionRef              = useRef<any>(null)
  const router                      = useRouter()
  const supabase                    = createClient()

  // Check if Lola is enabled
  useEffect(() => {
    setEnabled(localStorage.getItem("lola_enabled") !== "false")
  }, [])

  // Load context once on mount
  useEffect(() => {
    Promise.all([
      supabase.from("projects").select("id, title, clients(name)").neq("status", "completed").order("created_at", { ascending: false }).limit(50),
      supabase.from("clients").select("id, name").order("name").limit(100),
    ]).then(([{ data: projs }, { data: cls }]) => {
      setProjects((projs ?? []).map((p: any) => ({
        id: p.id,
        title: p.title,
        clientName: Array.isArray(p.clients) ? p.clients[0]?.name : p.clients?.name,
      })))
      setClients(cls ?? [])
    })
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setState("unsupported"); return }

    transcriptRef.current = ""
    setTranscript(""); setCommand(null); setErrorMsg("")

    const rec = new SR()
    rec.lang             = "en-ZA"
    rec.continuous       = false
    rec.interimResults   = true
    recognitionRef.current = rec

    rec.onstart = () => setState("listening")

    rec.onresult = (e: any) => {
      let final = "", interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t; else interim += t
      }
      const current = final || interim
      transcriptRef.current = current
      setTranscript(current)
    }

    rec.onerror = (e: any) => {
      const msgs: Record<string, string> = {
        "not-allowed": "Microphone access denied. Allow mic access in your browser settings.",
        "no-speech":   "No speech detected — please try again.",
        "network":     "Network error during speech recognition.",
      }
      setErrorMsg(msgs[e.error] ?? `Mic error: ${e.error}`)
      setState("error")
    }

    rec.onend = () => {
      const t = transcriptRef.current.trim()
      if (!t) { setState("idle"); return }
      processTranscript(t)
    }

    rec.start()
  }, [projects, clients]) // eslint-disable-line react-hooks/exhaustive-deps

  async function processTranscript(t: string) {
    setState("processing")
    try {
      const res = await fetch("/api/voice/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: t, projects, clients }),
      })
      if (!res.ok) {
        // Fallback: show raw transcript as unknown
        setCommand({ action: "unknown", humanReadable: `Could not parse: "${t}"`, confidence: "low", rawTranscript: t })
      } else {
        const parsed: ParsedCommand = await res.json()
        parsed.rawTranscript = t
        setCommand(parsed)
      }
      setState("confirming")
    } catch {
      setErrorMsg("Failed to reach AI parser. Check your connection.")
      setState("error")
    }
  }

  async function executeCommand() {
    if (!command || command.action === "unknown") return
    setState("executing")
    try {
      const res = await fetch("/api/voice/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? "Action failed")
        setState("error")
      } else {
        toast(data.message ?? "Done!", "success")
        setState("done")
        setTimeout(() => {
          setState("idle")
          // Navigate to new record if server suggests it
          if (data.redirect) router.push(data.redirect)
        }, 1800)
      }
    } catch {
      setErrorMsg("Network error — please try again.")
      setState("error")
    }
  }

  function cancel() {
    stopListening()
    setState("idle"); setTranscript(""); setCommand(null); setErrorMsg("")
  }

  const confidenceBg = command?.confidence === "high"
    ? "bg-primary/8 border-primary/20"
    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!enabled) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Unsupported */}
      {state === "unsupported" && (
        <div className="bg-card border border-border rounded-xl shadow-lg p-4 text-sm text-muted-foreground w-72">
          Lola requires Chrome or Edge browser.
          <button onClick={cancel} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Listening card */}
      {state === "listening" && (
        <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-72 space-y-2 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-sm font-medium">Listening…</span>
          </div>
          {transcript && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-primary/40 pl-3">"{transcript}"</p>
          )}
          <p className="text-xs text-muted-foreground">Speak then pause to finish</p>
        </div>
      )}

      {/* Processing card */}
      {state === "processing" && (
        <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-72 space-y-2 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-sm font-medium">Lola is thinking…</span>
          </div>
          {transcript && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-primary/40 pl-3">"{transcript}"</p>
          )}
        </div>
      )}

      {/* Confirmation card */}
      {(state === "confirming" || state === "executing") && command && (
        <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-80 space-y-3 animate-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground italic flex-1">"{transcript}"</p>
            {state !== "executing" && (
              <button onClick={cancel} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {command.action === "unknown" ? (
            <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Couldn't understand that. Try: <em>"Log a site visit on the Smith project"</em></span>
            </div>
          ) : (
            <>
              <div className={`rounded-lg p-3 text-sm border ${confidenceBg}`}>
                <p className="font-medium text-foreground">{command.humanReadable}</p>
                {command.confidence !== "high" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Low confidence — double-check before confirming
                  </p>
                )}
              </div>
              {state === "executing" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />Executing…
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={executeCommand}>
                    <Check className="w-3.5 h-3.5" />Confirm
                  </Button>
                  <Button size="sm" variant="outline" onClick={startListening}>Retry</Button>
                  <Button size="sm" variant="ghost" onClick={cancel}><X className="w-3.5 h-3.5" /></Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Error card */}
      {state === "error" && (
        <div className="bg-card border border-destructive/40 rounded-xl shadow-xl p-4 w-72 space-y-2 animate-in slide-in-from-bottom-2">
          <div className="flex items-start gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={startListening}>Try again</Button>
            <Button size="sm" variant="ghost" onClick={cancel}><X className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      )}

      {/* Done */}
      {state === "done" && (
        <div className="bg-card border border-success/40 rounded-xl shadow-xl px-4 py-3 text-sm font-medium text-success flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <Check className="w-4 h-4" />Done!
        </div>
      )}

      {/* Help panel */}
      {showHelp && state === "idle" && (
        <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-80 space-y-2 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lola — what you can say</p>
            <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="space-y-2">
            {ACTION_EXAMPLES.map((ex, i) => (
              <li key={i} className="text-xs text-foreground flex gap-2">
                <Volume2 className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                <span>{ex}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {state === "idle" && (
          <button
            onClick={() => setShowHelp(h => !h)}
            className="h-8 w-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm text-xs font-bold"
            title="What can Lola do?"
          >?</button>
        )}

        <button
          onClick={
            state === "listening"  ? stopListening :
            state === "idle"       ? startListening :
            state === "confirming" ? cancel : undefined
          }
          disabled={state === "processing" || state === "executing" || state === "done"}
          className={[
            "h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
            state === "listening"
              ? "bg-red-500 hover:bg-red-600 text-white scale-110 shadow-red-200 dark:shadow-red-900"
              : state === "processing" || state === "executing"
              ? "bg-primary/20 text-primary"
              : state === "done"
              ? "bg-success text-white"
              : "bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105",
          ].join(" ")}
          title={state === "listening" ? "Stop recording" : "Talk to Lola"}
        >
          {state === "listening"  ? <MicOff className="w-6 h-6" /> :
           state === "processing" || state === "executing" ? <Loader2 className="w-6 h-6 animate-spin" /> :
           state === "done"       ? <Check className="w-6 h-6" /> :
           <Mic className="w-6 h-6" />}
        </button>
      </div>
    </div>
  )
}
