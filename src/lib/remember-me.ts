import { supabase } from "@/integrations/supabase/client";

const REMEMBER_KEY = "kinquest.remember-me";
const TAB_KEY = "kinquest.session-alive";

export function getRememberMe(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(REMEMBER_KEY) !== "false";
}

export function setRememberMe(value: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, value ? "true" : "false");
  if (value) sessionStorage.removeItem(TAB_KEY);
  else sessionStorage.setItem(TAB_KEY, "1");
}

/**
 * When "Remember me" is off, the stored session should not survive a full
 * browser close. sessionStorage is wiped when the browser session ends, so a
 * missing marker on load means this is a fresh launch → sign out.
 * When it is on (the default), nothing happens and the session is restored.
 */
export async function enforceRememberMe() {
  if (typeof window === "undefined") return;
  if (getRememberMe()) return;
  if (sessionStorage.getItem(TAB_KEY)) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.auth.signOut();
}
