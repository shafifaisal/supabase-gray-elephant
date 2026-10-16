import type { Metadata } from "next";

import { PasswordEntropyCalculatorTool } from "@/components/tools/entropy-calculator";
import { getTool } from "@/lib/tools";

const tool = getTool("password-entropy-calculator")!;

const pageTitle = "Password Entropy Calculator – See How Strong a Password Is";
const pageDescription =
  "Calculate the bits of entropy in a random password or passphrase and see the maths. Compare character pools and word counts, and learn why it is an upper bound.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  keywords: [...tool.keywords],
  alternates: { canonical: "/password-entropy-calculator" },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
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