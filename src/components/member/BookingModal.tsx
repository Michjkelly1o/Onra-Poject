"use client";

import { useEffect, useState } from "react";
import { User, ClassInstance, Booking, Package, UserPackage, UserMembership, ServiceAddOn } from "@/types";
import { useDataStore } from "@/lib/data-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime, formatCurrency } from "@/lib/utils";
import { Calendar, User as UserIcon, CheckCircle2, AlertCircle, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookingModalProps {
    classInstance: ClassInstance | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onBookingComplete: () => void;
}

export function BookingModal({ classInstance, open, onOpenChange, onBookingComplete }: BookingModalProps) {
    const {
        users,
        userPackages,
        userMemberships,
        serviceAddOns,
        addBooking
    } = useDataStore();

    // In a real app, we'd get the logged-in user from auth context. 
    // Here we hardcode to a member for demo purposes if not specified.
    // Let's assume the user viewing this is "u-mem-1" (Aisha Khan) for now, or derived from context.
    // BUT wait, the browse page uses `demoRole` context? 
    // Actually, let's just use the first member "u-mem-3" (Olivia) as she has diverse packages in mock data
    // OR better, we should get the current user ID. 
    // For now, I'll use a hardcoded user ID that matches the "current user" concept in the demo.
    // The previous edits to `layout.tsx` suggests a `DemoRoleSwitcher`. 
    // I'll grab the first active member found in store or hardcode for safety.
    const currentUserId = "u-mem-3";
    const currentUser = users.find(u => u.id === currentUserId);

    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"package" | "membership" | "direct_pay" | null>(null);
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null); // package_id or membership_id
    const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setSelectedPaymentMethod(null);
            setSelectedSourceId(null);
            setSelectedAddOns([]);
            setError(null);
            setSuccess(false);

            // Auto-select best payment method if available
            if (classInstance && validMemberships.length > 0) {
                setSelectedPaymentMethod("membership");
                setSelectedSourceId(validMemberships[0].id);
            } else if (classInstance && validPackages.length > 0) {
                setSelectedPaymentMethod("package");
                setSelectedSourceId(validPackages[0].id);
            }
        }
    }, [open, classInstance]);

    if (!classInstance || !currentUser) return null;

    // Filter valid payment options
    const validPackages = userPackages.filter(p =>
        p.user_id === currentUserId &&
        p.credits_remaining > 0 &&
        p.status === 'active' &&
        (p.package?.class_type_ids.length === 0 || p.package?.class_type_ids.includes(classInstance.class_type_id))
    );

    const validMemberships = userMemberships.filter(m =>
        m.user_id === currentUserId &&
        m.status === 'active' &&
        (m.membership?.class_type_ids.length === 0 || m.membership?.class_type_ids.includes(classInstance.class_type_id))
    );

    // Filter valid add-ons
    const availableAddOns = serviceAddOns.filter(addon =>
        addon.is_active &&
        addon.class_type_ids.includes(classInstance.class_type_id)
    );

    const totalAddOnPrice = selectedAddOns.reduce((sum, id) => {
        const addon = serviceAddOns.find(a => a.id === id);
        return sum + (addon?.price || 0);
    }, 0);

    const handleConfirm = () => {
        if (!selectedPaymentMethod) {
            setError("Please select a payment method.");
            return;
        }

        const packageId = selectedPaymentMethod === "package" ? selectedSourceId! : undefined;
        const membershipId = selectedPaymentMethod === "membership" ? selectedSourceId! : undefined;

        // Call store
        // Map UI selection to backend expected type
        const paymentMethod = selectedPaymentMethod === "package" ? "credits" : selectedPaymentMethod as "membership" | "direct_pay";

        const result = addBooking(
            classInstance.id,
            currentUserId,
            paymentMethod,
            packageId,
            membershipId,
            selectedAddOns
        );

        if (result.success) {
            setSuccess(true);
            setTimeout(() => {
                onBookingComplete();
            }, 1500);
        } else {
            setError(result.error || "Booking failed");
        }
    };

    const toggleAddOn = (id: string) => {
        if (selectedAddOns.includes(id)) {
            setSelectedAddOns(prev => prev.filter(x => x !== id));
        } else {
            setSelectedAddOns(prev => [...prev, id]);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                {!success ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Confirm Booking</DialogTitle>
                            <DialogDescription>
                                {classInstance.class_type?.name} with {classInstance.instructor?.first_name}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-6">
                            {/* Class Details */}
                            <div className="bg-slate-50 p-4 rounded-lg flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                    <span>
                                        {new Date(classInstance.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        {' • '}
                                        {formatTime(classInstance.start_time)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <UserIcon className="w-4 h-4 text-slate-500" />
                                    <span>{classInstance.instructor?.first_name}</span>
                                </div>
                            </div>

                            {/* Payment Selection */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-900">Payment Method</h4>

                                <div className="space-y-2">
                                    {validMemberships.map(m => (
                                        <div
                                            key={m.id}
                                            onClick={() => { setSelectedPaymentMethod("membership"); setSelectedSourceId(m.id); setError(null); }}
                                            className={cn(
                                                "p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between",
                                                selectedPaymentMethod === "membership" && selectedSourceId === m.id
                                                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                                                    : "border-slate-200 hover:border-brand-200"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", selectedPaymentMethod === "membership" && selectedSourceId === m.id ? "border-brand-500" : "border-slate-300")}>
                                                    {selectedPaymentMethod === "membership" && selectedSourceId === m.id && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{m.membership?.name}</p>
                                                    <p className="text-xs text-slate-500">Unlimited Check-ins</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Active</span>
                                        </div>
                                    ))}

                                    {validPackages.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => { setSelectedPaymentMethod("package"); setSelectedSourceId(p.id); setError(null); }}
                                            className={cn(
                                                "p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between",
                                                selectedPaymentMethod === "package" && selectedSourceId === p.id
                                                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                                                    : "border-slate-200 hover:border-brand-200"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", selectedPaymentMethod === "package" && selectedSourceId === p.id ? "border-brand-500" : "border-slate-300")}>
                                                    {selectedPaymentMethod === "package" && selectedSourceId === p.id && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{p.package?.name}</p>
                                                    <p className="text-xs text-slate-500">Expires {new Date(p.expires_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-bold text-slate-900">{p.credits_remaining}</span>
                                                <span className="text-xs text-slate-500 ml-1">credits left</span>
                                            </div>
                                        </div>
                                    ))}

                                    {validMemberships.length === 0 && validPackages.length === 0 && (
                                        <div className="p-4 border border-dashed border-red-300 bg-red-50 rounded-lg text-center text-sm text-red-600">
                                            No valid credits or membership for this class. <br />
                                            <span className="font-semibold underline cursor-pointer">Buy a package</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Service Add-Ons Selection (Batch 7) */}
                            {availableAddOns.length > 0 && (
                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-medium text-slate-900">Enhance your session</h4>
                                        <span className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full font-medium">New</span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                        {availableAddOns.map(addon => (
                                            <div
                                                key={addon.id}
                                                className={cn(
                                                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                                                    selectedAddOns.includes(addon.id) ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"
                                                )}
                                                onClick={() => toggleAddOn(addon.id)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                                        selectedAddOns.includes(addon.id) ? "bg-brand-500 border-brand-500 text-white" : "border-slate-300 bg-white"
                                                    )}>
                                                        {selectedAddOns.includes(addon.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <span className="text-sm text-slate-700">{addon.name}</span>
                                                </div>
                                                <span className="text-sm font-semibold text-slate-900">+{formatCurrency(addon.price)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}
                        </div>

                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            <div className="flex-1 flex justify-between items-center text-sm mb-4 sm:mb-0 sm:mr-4">
                                <span className="text-slate-500">Total Add-on Cost:</span>
                                <span className="font-bold text-slate-900">{formatCurrency(totalAddOnPrice)}</span>
                            </div>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={(!selectedPaymentMethod) || (validMemberships.length === 0 && validPackages.length === 0)}
                                className="min-w-[100px]"
                            >
                                Confirm Booking
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <div className="py-12 flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Booking Confirmed!</h3>
                        <p className="text-slate-500 max-w-[280px]">
                            You're all set for {classInstance.class_type?.name}. A confirmation email has been sent.
                        </p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
