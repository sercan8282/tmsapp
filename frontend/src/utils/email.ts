/**
 * Validates a single e-mailadres met een eenvoudige regex.
 * Consistent met de backend-validatie van Django's EmailValidator.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * Parseer een komma-, puntkomma- of newline-gescheiden invoerstring naar
 * individuele e-mailadressen. Geeft een array terug van ongeldige adressen.
 */
export function parseEmailInput(input: string): { valid: string[]; invalid: string[] } {
  const raw = input.split(/[,;\n]/).map(e => e.trim()).filter(e => e)
  const valid: string[] = []
  const invalid: string[] = []
  for (const e of raw) {
    if (isValidEmail(e)) {
      valid.push(e)
    } else {
      invalid.push(e)
    }
  }
  return { valid, invalid }
}
