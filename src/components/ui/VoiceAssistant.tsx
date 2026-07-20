"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Mic, MicOff, X, Check, Loader2, AlertCircle, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { parseVoiceCommand, type ParsedCommand, type VoiceProject } from "@/lib/voice-parser"
import { toast } from "@/lib/toast"

type VoiceState = "idle" | "listening" | "processing" | "confirming" | "done" | "error" | "unsupported"

const ACTION_EXAMPLES = [
  "Log a site visit on the Smith project, spoke to Pieter about tiles",
  "Add R450 materials expense on the Jonker job, cement from Builders",
  "Create a task on Van der Merwe: order fixtures by Friday",
  "Mark the Johnson project as completed",
]

export function VoiceAssistant() {
  const [state, setState]         = useState<VoiceState>("idle")
  const [transcript, setTranscript] = useState("")
  const [command, setCommand]     = useState<ParsedCommand | null>(null)
  const [projects, setProjects]   = useState<VoiceProject[]>([])
  const [errorMsg, setErrorMsg]   = useState("")
  const [showHelp, setShowHelp]   = useState(false)
  const transcriptRef             = useRef("")
  const recognitionRef            = useRef<any>(null)
  const supabase = createClient()

  // Load projects once
  useEffect(() => {
    supabase
      .from("projects")
      .select("id, title, clients(name)")
      .neq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setProjects(
          (data ?? []).map((p: any) => ({
            id: p.id,
            title: p.title,
            clientName: Array.isArray(p.clients) ? p.clients[0]?.name : p.clients?.name,
          }))
        )
      })
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setState("unsupported")
      return
    }

    transcriptRef.current = ""
    setTranscript("")
    setCommand(null)
    setErrorMsg("")

    const recognition = new SR()
    recognition.lang = "en-ZA"
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onstart = () => setState("listening")

    recognition.onresult = (event: any) => {
      let final = ""
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      const current = final || interim
      transcriptRef.current = current
      setTranscript(current)
    }

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setErrorMsg("Microphone access denied. Please allow mic access in your browser.")
      } else if (event.error === "no-speech") {
        setErrorMsg("No speech detected. Try again.")
      } else {
        setErrorMsg(`Mic error: ${event.error}`)
      }
      setState("error")
    }

    recognition.onend = () => {
      const t = transcriptRef.current.trim()
      if (!t) {
        setState("idle")
        return
      }
      setState("processing")
      const parsed = parseVoiceCommand(t, projects)
      setCommand(parsed)
      setState("confirming")
    }

    recognition.start()
  }, [projects])

  async function executeCommand() {
    if (!command || command.action === "unknown") return
    setState("processing")
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
      setTimeout(() => setState("idle"), 2000)
    }
  }

  function cancel() {
    stopListening()
    setState("idle")
    setTranscript("")
    setCommand(null)
    setErrorMsg("")
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (state === "unsupported") {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="bg-card border border-border rounded-xl shadow-lg p-4 text-sm text-muted-foreground max-w-xs">
          Voice input requires Chrome or Edge browser.
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => setState("idle")}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Listening / transcript card */}
      {(state === "listening" || state === "processing") && (
        <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-72 space-y-2 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            {state === "listening" ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-sm font-medium text-foreground">Listening…</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Processing…</span>
              </>
            )}
          </div>
          {transcript && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-primary/40 pl-3">
              "{transcript}"
            </p>
          )}
          {state === "listening" && (
            <p className="text-xs text-muted-foreground">Speak now, then pause to finish</p>
          )}
        </div>
      )}

      {/* Confirmation card */}
      {state === "confirming" && command && (
        <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-80 space-y-3 animate-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground italic">"{transcript}"</p>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={cancel}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {command.action === "unknown" ? (
            <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Didn't understand that. Try: <em>"Log a site visit on the Smith project"</em></span>
            </div>
          ) : (
            <>
              <div className={`rounded-lg p-3 text-sm ${command.confidence === "high" ? "bg-primary/8 border border-primary/20" : "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"}`}>
                <p className="font-medium text-foreground">{command.humanReadable}</p>
                {command.confidence !== "high" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Low confidence — check before confirming</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={executeCommand}>
                  <Check className="w-3.5 h-3.5" />Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={cancel}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Error card */}
      {state === "error" && (
        <div className="bg-card border border-destructive/40 rounded-xl shadow-xl p-4 w-72 space-y-2 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={startListening}>Try again</Button>
            <Button size="sm" variant="ghost" onClick={cancel}><X className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      )}

      {/* Done indicator */}
      {state === "done" && (
        <div className="bg-card border border-success/40 rounded-xl shadow-xl p-3 text-sm font-medium text-success flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <Check className="w-4 h-4" />Done!
        </div>
      )}

      {/* Help tooltip */}
      {showHelp && state === "idle" && (
        <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-72 space-y-2 animate-in slide-in-from-bottom-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Voice commands</p>
          <ul className="space-y-2">
            {ACTION_EXAMPLES.map((ex, i) => (
              <li key={i} className="text-xs text-foreground flex gap-2">
                <Volume2 className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                <em>"{ex}"</em>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => setShowHelp(false)}>Got it</Button>
        </div>
      )}

      {/* Mic button */}
      <div className="flex items-center gap-2">
        {state === "idle" && (
          <button
            onClick={() => setShowHelp(h => !h)}
            className="h-8 w-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            title="Voice command examples"
          >
            <span className="text-xs font-bold">?</span>
          </button>
        )}
        <button
          onClick={state === "listening" ? stopListening : state === "idle" ? startListening : cancel}
          className={[
            "h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
            state === "listening"
              ? "bg-red-500 hover:bg-red-600 text-white scale-110 shadow-red-200 dark:shadow-red-900"
              : state === "confirming" || state === "processing"
              ? "bg-primary/20 text-primary cursor-default"
              : "bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105",
          ].join(" ")}
          title={state === "listening" ? "Stop recording" : "Start voice command"}
        >
          {state === "listening" ? (
            <MicOff className="w-6 h-6" />
          ) : state === "processing" ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
      </div>
    </div>
  )
}
