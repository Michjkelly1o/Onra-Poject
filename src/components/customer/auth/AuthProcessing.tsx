"use client";

// Customer — auth processing loader. Thin wrapper over the shared ProcessingLoader
// so the login/sign-up bridge matches every other loading screen exactly.

import { ProcessingLoader } from "@/components/customer/shell/ProcessingLoader";

export function AuthProcessing({ label }: { label: string }) {
    return <ProcessingLoader label={label} />;
}
