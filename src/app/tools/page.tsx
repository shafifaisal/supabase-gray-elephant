import type { Metadata } from "next";
import Link from "next/link";

import { Card, PrivacyNotice, SectionHeading } from "@/components/ui/primitives";
import { toolPath, tools } from "@/lib/tools";

export const metadata: Metadata = {
  title: "All tools",
  description:
    "Every iPassGenerator security tool: password generator, passphrase generator, strength checker, entropy calculator and random string generator. All run locally in your browser.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <div className="container-page py-12">
      <SectionHeading
        as="h1"
        title="All tools"
        description="Five utilities for creating and evaluating secrets. Every one runs client-side, with no server-side processing of your input."
      />

      <div className="mt-8">
        <PrivacyNotice />
      </div>

      <ul className="mt-10 grid gap-6 md:grid-cols-2">
        {tools.map((tool) => (
          <li key={tool.slug}>
            <Card className="flex h-full flex-col">
              <h2 className="text-xl font-semibold">
                <Link
                  href={toolPath(tool.slug)}
                  className="rounded transition-colors hover:text-primary"
                >
                  {tool.name}
                </Link>
              </h2>
              <p className="mt-2 flex-1 text-muted-foreground">
                {tool.description}
              </p>
              {tool.handlesSensitiveInput ? (
                <p className="mt-4 rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  <strong className="text-foreground">Handles sensitive input.</strong>{" "}
                  What you type here is analysed locally and never transmitted.
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}