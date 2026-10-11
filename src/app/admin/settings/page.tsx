import type { Metadata } from "next";

import { SettingsManager } from "@/components/admin/settings-manager";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";

import { deleteSettingAction, getSettings, saveSettingAction } from "./actions";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

/** Common non-secret settings, with guidance shown in the UI. */
const PRESETS: { key: string; label: string; hint: string; value: string }[] = [
  {
    key: "brand_name",
    label: "Brand name",
    hint: "Displayed in the header and page titles.",
    value: "iPassGenerator",
  },
  {
    key: "site_tagline",
    label: "Tagline",
    hint: "Short descriptor used in metadata.",
    value: "Privacy-first password security tools",
  },
  {
    key: "contact_email",
    label: "Contact email",
    hint: "Shown on the contact page.",
    value: "hello@ipassgenerator.online",
  },
  {
    key: "footer_text",
    label: "Footer text",
    hint: "Small print shown in the footer.",
    value: "Generated secrets never leave your device.",
  },
  {
    key: "adsense_enabled",
    label: "Enable advertising",
    hint:
      'JSON boolean. Ads load only when this is true AND a real NEXT_PUBLIC_ADSENSE_CLIENT_ID is set AND the visitor consents. Leave "false" until the AdSense readiness checklist is complete. Approval is never guaranteed.',
    value: "false",
  },
  {
    key: "analytics_enabled",
    label: "Enable analytics",
    hint: "JSON boolean. Requires consent before any analytics script loads.",
    value: "false",
  },
  {
    key: "maintenance_mode",
    label: "Maintenance mode",
    hint: "JSON boolean. Shows a holding page to visitors.",
    value: "false",
  },
  {
    key: "site_description",
    label: "Site description",
    hint: "Default meta description used across public pages.",
    value: "Generate strong passwords, passphrases and random strings in your browser. Nothing is uploaded, stored or logged.",
  },
  {
    key: "legal_privacy_policy_html",
    label: "Privacy policy override",
    hint:
      "Optional HTML for /privacy-policy. Leave blank to use the built-in text. Sanitised on render.",
    value: "",
  },
  {
    key: "legal_terms_html",
    label: "Terms of use override",
    hint:
      "Optional HTML for /terms. Leave blank to use the built-in text. Sanitised on render.",
    value: "",
  },
  {
    key: "legal_cookie_policy_html",
    label: "Cookie policy override",
    hint:
      "Optional HTML for /cookie-policy. Leave blank to use the built-in text. Sanitised on render.",
    value: "",
  },
];

export default async function SettingsPage() {
  await requireRole("admin");
  const settings = await getSettings();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Site settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Public configuration. Secrets and integration credentials must stay in
        environment variables, never in this table.
      </p>

      <div className="mt-6 rounded-[var(--radius-card)] border border-warning/40 bg-warning/10 p-5">
        <h2 className="text-sm font-semibold text-warning">
          Never store credentials here
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Values in this table are readable by the public API for any row not
          marked secret. Advertising IDs, API keys and tokens belong in Vercel
          environment variables.
        </p>
      </div>

      <SettingsManager
        action={saveSettingAction}
        presets={PRESETS}
        existing={settings.map((s) => ({
          key: s.key,
          value: s.value,
          is_secret: s.is_secret,
        }))}
      />

      {settings.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Current values</h2>
          <ul className="mt-3 space-y-2">
            {settings.map((setting) => (
              <li
                key={setting.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium">{setting.key}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {setting.is_secret
                      ? "•••••• (hidden)"
                      : setting.value ?? "(empty)"}
                  </p>
                </div>

                <form action={deleteSettingAction}>
                  <input type="hidden" name="key" value={setting.key} />
                  <button
                    type="submit"
                    className="h-8 rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 text-xs text-muted-foreground">
        Last checked {formatDateTime(new Date())}.
      </p>
    </div>
  );
}