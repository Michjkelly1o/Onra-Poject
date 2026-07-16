"use client";

// Customer — auth loading bridge · `/customer/auth/loading`. Transient loader
// ("Taking you to homepage") shown after a successful login / sign-up, then
// replaces into Home. The session write already happened upstream; this is
// purely presentational. Clears the flow draft on the way through.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authDraft, resetAuthDraft } from "@/lib/customer/auth-flow";
import { AuthProcessing } from "@/components/customer/auth/AuthProcessing";

export default function AuthLoadingPage() {
    const router = useRouter();
    useEffect(() => {
        // Return the member to the page they were on before logging in (guest
        // deep-link / "Log in to book"), else Home. Captured before the draft reset.
        const dest = authDraft.returnTo ?? "/customer";
        const t = setTimeout(() => {
            resetAuthDraft();
            router.replace(dest);
        }, 1300);
        return () => clearTimeout(t);
    }, [router]);

    return <AuthProcessing label="Taking you to homepage" />;
}
