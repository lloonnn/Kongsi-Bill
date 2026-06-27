// Copy text to the clipboard, robust across contexts.
//
// navigator.clipboard.writeText is the modern path but it only exists in a
// SECURE context (https or localhost). When the app is opened over plain http
// on a LAN IP, or in an older browser, navigator.clipboard is undefined — so we
// fall back to a hidden <textarea> + document.execCommand('copy'). Returns
// whether the copy succeeded so callers can avoid showing "✓ Copied" on failure.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    // Keep it out of view and unfocusable to the user, but selectable.
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
