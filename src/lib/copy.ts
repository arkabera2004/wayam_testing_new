/**
 * Copy text to the clipboard, with a fallback for insecure origins.
 *
 * `navigator.clipboard` only exists in a secure context. The dev server
 * advertises a LAN address alongside localhost, and anyone opening the app
 * that way loses the API entirely — the call sites used to swallow the
 * rejection, so the copy buttons went quiet with no explanation.
 *
 * Returns whether the text made it to the clipboard, so callers can report
 * failure instead of pretending it worked.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    // Keep it out of view and off the tab order while it is focused.
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
