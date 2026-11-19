import { useSyncExternalStore } from "react"

const STORAGE_KEY = "chat_username"
/** No cross-tab sync needed: the value only changes when this tab joins. */
const subscribe = () => () => {}

const getSnapshot = () =>
  (localStorage.getItem(STORAGE_KEY) ?? "").normalize("NFKC")

/** SSR/hydration snapshot: localStorage is not available on the server. */
const getServerSnapshot = () => ""

// Restores the remembered name, or an empty string when there is none. The
// room page prompts via JoinRoomScreen in the empty case; this hook never
// invents an identity the user did not choose.
export const useUsername = () => {
  const username = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { username }
}
