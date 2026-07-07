"use client";

// Customer — auth loading bridge · `/customer/auth/loading`. Transient loader
// ("Taking you to homepage") shown after a successful login / sign-up, then
// replaces into Home. The session write already happened upstream; this is
// purely presentational. Clears the flow draft on the way through.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resetAuthDraft } from "@/lib/customer/auth-flow";
import { AuthProcessing } from "@/components/customer/auth/AuthProcessing";

export default function AuthLoadingPage() {
    const router = useRouter();
    useEffect(() => {
        const t = setTimeout(() => {
            resetAuthDraft();
            router.replace("/customer");
        }, 1300);
        return () => clearTimeout(t);
    }, [router]);

    return <AuthProcessing label="Taking you to homepage" />;
}
