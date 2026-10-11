"use client";

import { useDeferredValue, useState } from "react";

import { PrivacyNotice } from "@/components/ui/primitives";
import { analysePassword } from "@/lib/strength/analyse";

const SCORE_COLOURS = [
  "bg-danger",
  "bg-danger",
  "bg-warning",
  "bg-success",
  "bg-success",
];

export function PasswordStrengthCheckerTool() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  // Keeps typing responsive: the analysis is recomputed off the critical path.
  const deferred = useDeferredValue(password);
  const result = analysePassword(deferred);

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-card)] border border-border bg-background p-5 sm:p-6">
        <label htmlFor="check-password" className="mb-1.5 block text-sm font-medium">
          Password to analyse
        </label>

        <div className="flex gap-2">
          <input
            id="check-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Type or paste a password"
            className="w-full rounded-md border border-border bg-background px-4 py-3 font-mono text-lg transition-colors placeholder:font-sans placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border transition-colors hover:bg-secondary"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {show ? (
                <>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-2.6 3.3" />
                  <path d="M6.6 6.7A17 17 0 0 0 2 12s3.5 6 10 6a9.7 9.7 0 0 0 4.3-1" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </>
              )}
            </svg>
          </button>
        </div>

        {password ? (
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">{result.label}</span>
              <span className="font-mono text-sm">
                {result.bits.toFixed(1)} bits
              </span>
            </div>

            <div
              className="mt-2 flex gap-1"
              role="meter"
              aria-valuenow={result.score}
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuetext={`${result.label}, about ${result.bits.toFixed(0)} bits`}
              aria-label="Password strength"
            >
              {[0, 1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className={`h-2.5 flex-1 rounded-full transition-colors ${
                    index <= result.score
                      ? SCORE_COLOURS[result.score]
                      : "bg-secondary"
                  }`}
                />
              ))}
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              An attacker with a fast offline rig (~10 billion guesses per
              second) would need roughly{" "}
              <strong className="text-foreground">{result.offlineTime}</strong>.
            </p>
          </div>
        ) : null}
      </div>

      {password ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-background p-5 sm:p-6">
          <h2 className="text-lg font-semibold">How to improve this</h2>

          <p className="mt-2 rounded-md bg-secondary/60 px-4 py-3 text-sm">
            {result.suggestion}
          </p>

          {result.feedback.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {result.feedback.map((item, index) => (
                <li key={index} className="flex gap-2.5 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">A score is an estimate, not
              a guarantee.</strong> It models how hard the value would be to
              guess with current cracking tools. It cannot know whether you
              reuse the same password on another service, whether it has
              already leaked, or whether it is stored correctly by the site.
            </p>
            <p>
              The single most common cause of account compromise is not a weak
              password but the same password used on several sites. Reuse beats
              every other risk here.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-card)] border border-border bg-secondary/40 p-5">
        <h2 className="text-sm font-semibold">How this check works</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The analysis runs in this browser tab using the zxcvbn algorithm
          (Dropbox, MIT licensed). Your password is matched locally against
          bundled lists of common passwords, common English words, first and
          last names, keyboard layouts and previous breach wordlists.
        </p>
        <div className="mt-3">
          <PrivacyNotice>
            Your password is never sent to a server, written to storage, or
            included in logs. Close this tab and it is gone.
          </PrivacyNotice>
        </div>
      </div>
    </div>
  );
}