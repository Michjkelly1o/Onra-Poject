import { useEffect, useState } from "react";

/**
 * True only AFTER the component has mounted on the client.
 *
 * Use it to gate content whose value differs between the server render and the
 * client — clock-derived status counts (e.g. how many classes are still
 * "Upcoming" right now), and anything read from the localStorage-backed store.
 * Because the server has no localStorage and computes "now" at build/request
 * time, rendering that content during hydration causes a mismatch (React error:
 * "Text content does not match server-rendered HTML"). Render a stable shell
 * while `false`, then the real content once `true`.
 */
export function useHasMounted(): boolean {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    return mounted;
}
