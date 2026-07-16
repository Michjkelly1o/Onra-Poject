"use client";

// Customer — auth guard. Redirects guests to the login front door (carrying the
// current page as returnTo) so auth-only screens can't be viewed blank via a
// deep-link / refresh. Call once at the top of an auth-only page. Returns the
// auth flag for callers that also want to short-circuit rendering.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsAuthenticated } from "@/lib/customer/auth";
import { loginHref } from "@/lib/customer/auth-flow";

export function useRequireCustomerAuth(): boolean {
    const isAuth = useIsAuthenticated();
    const router = useRouter();
    const pathname = usePathname();
    useEffect(() => {
        if (!isAuth) router.replace(loginHref(pathname));
    }, [isAuth, router, pathname]);
    return isAuth;
}
