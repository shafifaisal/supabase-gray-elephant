import type { Metadata } from "next";

import { PasswordEntropyCalculatorTool } from "@/components/tools/entropy-calculator";
import { getTool } from "@/lib/tools";

const tool = getTool("password-entropy-calculator")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  keywords: [...tool.keywords],
  alternates: { canonical: "/password-entropy-calculator" },
  openGraph: {
    title: `${tool.name} — see the maths`,
    description: tool.description,
    url: "/password-entropy-calculator",
    type: "website",
  },
};

export default function PasswordEntropyCalculatorPage() {
  return (
    <div className="container-page py-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {tool.name}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{tool.description}</p>
      </div>

      <div className="mt-8 max-w-3xl">
        <PasswordEntropyCalculatorTool />
      </div>
    </div>
  );
}