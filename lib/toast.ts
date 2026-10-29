type ToastKind = "success" | "error" | "warning" | "info"

interface ToastInput {
  title: string
  description?: string
}

/**
 * Sileo is loaded on demand so its physics engine never lands in the initial
 * bundle. Every call is best-effort: a toast should never break a flow.
 */
export async function showToast(kind: ToastKind, input: ToastInput) {
  if (typeof window === "undefined") return

  try {
    const { sileo } = await import("sileo")
    sileo[kind](input)
  } catch {
    // Primitive browsers or blocked modules just go without a toast.
  }
}

export function toastSuccess(input: ToastInput) {
  return showToast("success", input)
}

export function toastError(input: ToastInput) {
  return showToast("error", input)
}
