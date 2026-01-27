/**
 * Simple clsx utility for conditional class names
 */
export default function clsx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
