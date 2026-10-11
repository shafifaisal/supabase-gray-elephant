import type { Metadata } from "next";

import { PasswordStrengthCheckerTool } from "@/components/tools/password-strength-checker";
import { getTool } from "@/lib/tools";

const tool = getTool("password-strength-checker")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  keywords: [...tool.keywords],
  alternates: { canonical: "/password-strength-checker" },
  openGraph: {
    title: `${tool.name} — local only`,
    description: tool.description,
    url: "/password-strength-checker",
    type: "website",
  },
};

export default function PasswordStrengthCheckerPage() {
  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {tool.name}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{tool.description}</p>
      </div>

      <div className="mt-8 max-w-3xl">
        <PasswordStrengthCheckerTool />
      </div>
    </div>
  );
}