/**
 * Central registry of the security tools.
 *
 * Single source of truth for the /tools index, sitemap generation, footer links
 * and navigation. Tool behaviour lives in src/lib; this module only holds
 * presentation metadata.
 */

export interface ToolDefinition {
  /** Route slug, e.g. "password-generator". */
  slug: string;
  /** Human-readable name. */
  name: string;
  /** Short one-line description used on cards. */
  summary: string;
  /** Longer description used on the tool page. */
  description: string;
  /** Keyword list for metadata. */
  keywords: readonly string[];
  /** Whether the tool accepts user input that must never leave the device. */
  handlesSensitiveInput: boolean;
}

export const tools: readonly ToolDefinition[] = [
  {
    slug: "password-generator",
    name: "Password Generator",
    summary: "Create strong random passwords with full control over length and character sets.",
    description:
      "Generate cryptographically secure random passwords in your browser. Choose the length, character groups, and whether to exclude visually ambiguous characters. The result never leaves your device.",
    keywords: [
      "password generator",
      "strong password",
      "random password",
      "secure password generator",
    ],
    handlesSensitiveInput: false,
  },
  {
    slug: "passphrase-generator",
    name: "Passphrase Generator",
    summary: "Build memorable passphrases from a large word list for high entropy and easy recall.",
    description:
      "Generate memorable passphrases using uniform random selection from a large curated word list. Adjust the word count, separator and capitalisation, with the resulting entropy explained in plain language.",
    keywords: [
      "passphrase generator",
      "diceware passphrase",
      "memorable password",
      "word based password",
    ],
    handlesSensitiveInput: false,
  },
  {
    slug: "password-strength-checker",
    name: "Password Strength Checker",
    summary: "Estimate password strength locally, including pattern and dictionary analysis.",
    description:
      "Analyse a password entirely on your device for length, repetition, sequences and common patterns. The input is never transmitted, logged or stored. The score is an estimate, not a guarantee.",
    keywords: [
      "password strength checker",
      "password meter",
      "check password strength",
    ],
    handlesSensitiveInput: true,
  },
  {
    slug: "password-entropy-calculator",
    name: "Password Entropy Calculator",
    summary: "Calculate and understand the entropy of a password or passphrase.",
    description:
      "See how entropy is calculated for a given character pool or word list, what patterns reduce that entropy in practice, and why the theoretical number is an upper bound rather than a guarantee.",
    keywords: ["entropy calculator", "password bits of entropy", "password entropy"],
    handlesSensitiveInput: false,
  },
  {
    slug: "random-string-generator",
    name: "Random String Generator",
    summary: "Generate secure random strings for API keys, tokens, salts and identifiers.",
    description:
      "Create secure random strings of any length from the character sets you choose. Useful for API keys, tokens, salts and identifiers. Generation is entirely client-side.",
    keywords: [
      "random string generator",
      "random token generator",
      "api key generator",
      "secure random string",
    ],
    handlesSensitiveInput: false,
  },
] as const;

export function getTool(slug: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.slug === slug);
}

export function toolPath(slug: string): string {
  return `/${slug}`;
}