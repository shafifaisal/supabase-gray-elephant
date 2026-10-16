/**
 * FAQ copy for the homepage accordion.
 *
 * Content lives here, apart from the accordion markup, so the questions and
 * answers stay server-rendered (crawlable, indexable, present in the HTML even
 * while a panel is collapsed) and so they can be unit-tested as data.
 *
 * Answers are React nodes rather than plain strings because a few of them link
 * to existing pages. Only routes that exist in this app are linked, and the
 * links use meaningful anchor text (AGENTS.md §6 — no invented destinations).
 *
 * Every factual claim about the implementation below was checked against the
 * code: generation runs client-side in `useClientSecret` via
 * `crypto.getRandomValues`, no tool component calls `fetch`, `sendBeacon` or
 * writes to `localStorage`/`sessionStorage`, and there is no billing code
 * anywhere in the app. Keep it that way — do not soften these into promises
 * the implementation does not back up.
 */

import type { ReactNode } from "react";
import Link from "next/link";

export interface FaqItem {
  /** Stable DOM id stem, also used for `aria-controls` / `aria-labelledby`. */
  id: string;
  question: string;
  answer: ReactNode;
}

export const faqItems: readonly FaqItem[] = [
  {
    id: "what-is-a-password-generator",
    question: "What is a password generator?",
    answer: (
      <>
        A password generator is a tool that creates random passwords for you
        instead of asking you to invent one. Rather than reusing the same
        password across sites or building one out of a name and a birthday, you
        get a unique combination of letters, numbers and symbols. Our{" "}
        <Link
          href="/password-generator"
          className="font-medium text-primary underline underline-offset-2"
        >
          free password generator
        </Link>{" "}
        lets you choose the length and which character groups to include.
      </>
    ),
  },
  {
    id: "how-do-i-create-a-strong-password",
    question: "How do I create a strong password?",
    answer: (
      <>
        Start with length: use 16 characters or more wherever the service allows
        it. Add uppercase letters, lowercase letters, numbers and symbols where
        they are accepted, and avoid names, birthdays, dictionary phrases and
        predictable patterns. Use a different password for every account and
        store each one in a{" "}
        <Link
          href="/articles"
          className="font-medium text-primary underline underline-offset-2"
        >
          password manager
        </Link>
        .
      </>
    ),
  },
  {
    id: "how-long-should-my-password-be",
    question: "How long should my password be?",
    answer: (
      <>
        For general online accounts, a randomly generated password of 16
        characters or more is a practical target. Some services cap length or
        reject certain symbols, so check their requirements first. Length is not
        everything on its own: a long password built from a predictable pattern
        is far weaker than a shorter genuinely random one. Randomness and
        uniqueness matter just as much as the character count.
      </>
    ),
  },
  {
    id: "is-ipassgenerator-free",
    question: "Is iPassGenerator.online free to use?",
    answer: (
      <>
        Yes. Every tool here is available at no cost — there is no account to
        create, no paywall and no premium tier. You do not need to understand how
        password generation works to use it.
      </>
    ),
  },
  {
    id: "is-it-safe-to-generate-passwords-online",
    question: "Is it safe to generate passwords online?",
    answer: (
      <>
        It depends entirely on the tool. A generator that draws from a secure
        source of randomness and creates the password locally in your browser
        keeps the result away from servers and logs. A generator that sends the
        password to a server hands it to someone else&rsquo;s infrastructure.
        The difference is verifiable: open your browser&rsquo;s Network tab and
        press Generate — on this site, no request contains the password.
      </>
    ),
  },
  {
    id: "does-ipassgenerator-store-my-passwords",
    question: "Does iPassGenerator.online store or see my generated passwords?",
    answer: (
      <>
        No. The password is assembled in your browser from{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          crypto.getRandomValues()
        </code>
        . It is never transmitted, never written to cookies or browser storage,
        never placed in a URL, and never logged. Refreshing the page discards it.
        If you want to confirm that for yourself, generate a password and check
        the Network tab — you will see the page load and nothing carrying your
        password.
      </>
    ),
  },
  {
    id: "can-i-customize-my-generated-password",
    question: "Can I customize my generated password?",
    answer: (
      <>
        Yes. Choose the length from 8 to 128 characters and toggle the character
        groups you want: lowercase, uppercase, numbers and symbols. You can also
        exclude visually ambiguous characters such as I, l, 1, O and 0, which
        helps when a password has to be read aloud or typed from a screen. Pick
        options that the destination service actually accepts.
      </>
    ),
  },
  {
    id: "can-i-generate-passwords-with-numbers-and-symbols",
    question: "Can I generate passwords containing numbers and symbols?",
    answer: (
      <>
        Yes, when the matching options are enabled the generator includes them
        alongside letters. Both widen the pool of possible combinations, though
        strength still depends on length, randomness and uniqueness — adding a
        symbol is worth far less than adding a few more random characters.
      </>
    ),
  },
  {
    id: "what-is-password-entropy",
    question: "What is password entropy?",
    answer: (
      <>
        Entropy measures how uncertain a password is, and therefore how much
        work an attacker has to do to guess it. For a uniformly random password
        of length L drawn from an alphabet of N possible characters, the
        theoretical value is about L × log₂(N) bits. It is an upper bound, not a
        guarantee: a password that follows a predictable pattern has far less
        real-world entropy than its character count suggests. Our{" "}
        <Link
          href="/password-entropy-calculator"
          className="font-medium text-primary underline underline-offset-2"
        >
          password entropy calculator
        </Link>{" "}
        shows the working.
      </>
    ),
  },
  {
    id: "can-a-strong-password-be-hacked",
    question: "Can a strong password be hacked?",
    answer: (
      <>
        No password can be guaranteed to be uncrackable. A long, random, unique
        password makes guessing dramatically harder, but accounts are still
        compromised through phishing, malware, data breaches and weak account
        recovery. Turn on multifactor authentication wherever it is offered,
        keep your devices updated, and never reuse a password across accounts.
      </>
    ),
  },
  {
    id: "should-i-use-the-same-password-for-multiple-accounts",
    question: "Should I use the same password for multiple accounts?",
    answer: (
      <>
        No. Reuse turns one breach into many: when a site you signed up to is
        compromised, every account sharing that password is exposed too. This is
        why our{" "}
        <Link
          href="/random-string-generator"
          className="font-medium text-primary underline underline-offset-2"
        >
          random string generator
        </Link>{" "}
        exists alongside the password tool — a different random value per
        account, stored in a password manager so you do not have to remember
        them all.
      </>
    ),
  },
  {
    id: "password-generator-vs-password-manager",
    question: "What is the difference between a password generator and a password manager?",
    answer: (
      <>
        A generator creates new passwords; a password manager stores and
        retrieves the ones you already have. They solve different halves of the
        same problem, and most people are best off using both: generate a unique
        password for each account, then let the manager remember it. If you
        would rather remember something, our{" "}
        <Link
          href="/passphrase-generator"
          className="font-medium text-primary underline underline-offset-2"
        >
          passphrase generator
        </Link>{" "}
        builds high-entropy passphrases that are far easier to recall.
      </>
    ),
  },
  {
    id: "random-passwords-vs-my-own",
    question: "Are random passwords better than passwords I create myself?",
    answer: (
      <>
        Generally, yes. Self-invented passwords lean on familiar words, personal
        details and substitutions such as P@ssw0rd — patterns that automated
        cracking tools are built to guess, and that people underestimate. A
        random password avoids those patterns entirely, which is why a password
        manager plus a generated value per account beats a memorable password
        reused everywhere.
      </>
    ),
  },
  {
    id: "generated-password-for-banking-and-email",
    question: "Can I use a generated password for banking and email accounts?",
    answer: (
      <>
        Yes — a long, unique, randomly generated password is a good fit for
        banking, email and other sensitive accounts, as long as it meets the
        service&rsquo;s requirements. Protect those accounts further with
        multifactor authentication, tight recovery settings, and careful checks
        that you are on the real website or app before you type anything.
      </>
    ),
  },
  {
    id: "what-if-i-forget-a-generated-password",
    question: "What happens if I forget a generated password?",
    answer: (
      <>
        There is nothing for anyone to recover, including us. Because the value
        is never saved — not on a server, not in your browser storage — we could
        not look it up even if we wanted to. Retrieve it from your password
        manager if you saved it there; otherwise use the service&rsquo;s own
        password-reset flow.
      </>
    ),
  },
  {
    id: "protecting-accounts-beyond-passwords",
    question: "How can I protect my accounts beyond using a strong password?",
    answer: (
      <>
        Use a unique password for every account, enable multifactor
        authentication, keep your browser and operating system updated, treat
        unexpected login prompts as suspicious, and never enter credentials on
        a site you reached from a link in a message. The{" "}
        <Link
          href="/articles"
          className="font-medium text-primary underline underline-offset-2"
        >
          password security articles
        </Link>{" "}
        cover these habits in more depth.
      </>
    ),
  },
  {
    id: "does-longer-always-mean-better",
    question: "Does a longer password always mean better security?",
    answer: (
      <>
        Not always. Length helps most when the extra characters are random. A
        long, predictable phrase — P@ssw0rd123456! — is easier to guess than a
        shorter string with no discernible pattern, because attackers guess by
        pattern first and brute force last. Aim for length, randomness and
        uniqueness together rather than length on its own.
      </>
    ),
  },
  {
    id: "how-does-ipassgenerator-improve-security",
    question: "How does iPassGenerator.online help improve password security?",
    answer: (
      <>
        It removes the two habits that weaken passwords most: reusing one
        everywhere and inventing them by hand. You choose the length and
        character groups, the browser supplies real cryptographic randomness, and
        the result stays on your device. Generate a fresh value for each service,
        save it in a password manager, and you are done. Every claim on this page
        is checkable in your browser&rsquo;s developer tools.
      </>
    ),
  },
] as const;