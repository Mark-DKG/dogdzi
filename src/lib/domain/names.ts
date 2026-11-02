export const FIRST_NAME_MAX = 40;

/**
 * Clean a first name for storage: trims, collapses spaces, drops control
 * characters and caps the length. Returns null when nothing is left.
 */
export function normalizeFirstName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const clean = raw
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return Array.from(clean).slice(0, FIRST_NAME_MAX).join("").trim();
}

/** "Good morning" etc. for a local hour, with the first name when known. */
export function greetingFor(hour: number, firstName: string | null | undefined): string {
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = normalizeFirstName(firstName);
  return name ? `${part}, ${name}` : part;
}
