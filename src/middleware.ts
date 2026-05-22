// ─────────────────────────────────────────────────────────────────────────────
// Next.js middleware — gates feature-flag-disabled modules
// ─────────────────────────────────────────────────────────────────────────────
//
// When a request targets a route disabled in src/config/feature-flags.ts, it
// is rewritten to a non-existent path so Next renders the 404 "page not found".
// The sidebar still shows the menu item — clicking it simply lands on the 404.
//
// To disable / re-activate a module, edit DISABLED_ROUTE_PREFIXES in
// src/config/feature-flags.ts — nothing here needs to change.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRouteDisabled } from "@/config/feature-flags";

export function middleware(req: NextRequest) {
    if (isRouteDisabled(req.nextUrl.pathname)) {
        // No route matches "/_disabled" → Next renders the 404 page.
        return NextResponse.rewrite(new URL("/_disabled", req.url));
    }
    return NextResponse.next();
}

export const config = {
    // Run on app routes only — skip Next internals + static assets.
    matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
