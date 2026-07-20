// Lightweight imperative toast — call toast("msg", "success") from anywhere

export type ToastVariant = "success" | "error" | "info"
export type ToastItem = { id: string; message: string; variant: ToastVariant }

type Listener = (items: ToastItem[]) => void

let items: ToastItem[] = []
const listeners = new Set<Listener>()

function notify() {
  const snapshot = [...items]
  listeners.forEach(l => l(snapshot))
}

export function toast(message: string, variant: ToastVariant = "info") {
  const id = Math.random().toString(36).slice(2, 9)
  items = [...items, { id, message, variant }]
  notify()
  setTimeout(() => {
    items = items.filter(t => t.id !== id)
    notify()
  }, 4500)
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener)
  listener([...items])
  return () => listeners.delete(listener)
}
