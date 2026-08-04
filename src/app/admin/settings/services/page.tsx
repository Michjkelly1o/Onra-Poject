"use client";

// Onra Studio — Services settings landing route (admin chrome wraps it).
// UI-only studio-level on/off switches for the optional service types
// (Memberships / Private sessions / Recovery). See ServicesPage for details.
import ServicesPage from "@/components/settings/ServicesPage";

export default function AdminServicesRoute() {
    return <ServicesPage />;
}
