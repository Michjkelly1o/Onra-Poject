"use client";

import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Dumbbell, Lock } from "lucide-react";

export function DemoGate({ children }: { children: React.ReactNode }) {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    // Simple client-side password
    const DEMO_PASSWORD = "maple";

    useEffect(() => {
        const stored = sessionStorage.getItem("demo_auth");
        if (stored === "true") setIsAuthorized(true);
    }, []);

    const handleLogin = () => {
        if (password.toLowerCase() === DEMO_PASSWORD) {
            sessionStorage.setItem("demo_auth", "true");
            setIsAuthorized(true);
        } else {
            setError("Incorrect password");
        }
    };

    if (isAuthorized) return <>{children}</>;

    // Prevent hydration mismatch by not rendering anything until mounted (optional, but handled by effect setting state)
    // Actually, initial state false is fine.

    return (
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-sm space-y-8 text-center">
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center ring-1 ring-primary/20">
                        <Lock className="w-10 h-10 text-primary" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">SyncFit Demo</h1>
                    <p className="text-muted-foreground">Protected Access</p>
                </div>

                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder="Enter password..."
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError("");
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                            className="text-center text-lg h-12"
                            autoFocus
                        />
                        {error && <p className="text-sm text-destructive font-medium animate-shake">{error}</p>}
                    </div>

                    <Button
                        size="lg"
                        className="w-full h-12 text-lg font-medium"
                        onClick={handleLogin}
                    >
                        Enter Demo
                    </Button>
                </div>

                <p className="text-xs text-muted-foreground pt-8">
                    Project Maple MVP • v1.0.0
                </p>
            </div>
        </div>
    );
}
