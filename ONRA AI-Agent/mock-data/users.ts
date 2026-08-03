// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `users` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 5 demo auth users — one per role from CLAUDE.md. Used by the demo role
// switcher to log in as each persona.
//
// Demo password (per CLAUDE.md): Demo1234!
//
// River Teach (Instructor) intentionally does NOT bind to a specific
// staff_profile — the demo switcher works off `user_role_assignments`, and
// "Instructor" role pages default to showing a logical instructor's data.
// When the auth module is properly built, `users` and `staff_profiles` can
// share an FK if needed.

import type { User } from "./_types";

export const users: User[] = [
    {
        id: "user_alex_owen",
        full_name: "Alex Owen",
        email: "alex@fitlab.demo",
    },
    {
        id: "user_sam_admin",
        full_name: "Sam Admin",
        email: "sam@fitlab.demo",
    },
    {
        id: "user_jordan_ops",
        full_name: "Jordan Ops",
        email: "jordan@fitlab.demo",
    },
    {
        id: "user_casey_desk",
        full_name: "Casey Desk",
        email: "casey@fitlab.demo",
    },
    {
        id: "user_river_teach",
        full_name: "River Teach",
        email: "river@fitlab.demo",
    },
];
