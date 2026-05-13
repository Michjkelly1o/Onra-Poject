"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Megaphone,
    Ticket,
    Plus,
    Calendar,
    Users,
    Mail,
    MessageSquare,
    TrendingUp,
    MousePointer,
    Eye,
    UserCheck,
    AlertTriangle,
    Star,
    Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

// Pre-built member segments
const memberSegments = [
    { id: "seg-1", name: "New Members (< 30 days)", icon: UserCheck, color: "bg-green-100 text-green-600", count: 8, description: "Joined within the last 30 days, ideal for onboarding emails" },
    { id: "seg-2", name: "At-Risk (No visit 14d+)", icon: AlertTriangle, color: "bg-amber-100 text-amber-600", count: 12, description: "Haven't attended a class in 14+ days" },
    { id: "seg-3", name: "VIP Members (20+ classes)", icon: Star, color: "bg-purple-100 text-purple-600", count: 15, description: "Attended 20+ classes, high engagement" },
    { id: "seg-4", name: "Expiring Packages (< 7 days)", icon: Clock, color: "bg-red-100 text-red-600", count: 5, description: "Package expires within 7 days, renewal opportunity" },
    { id: "seg-5", name: "Frozen Members", icon: Users, color: "bg-blue-100 text-blue-600", count: 3, description: "Currently frozen packages" },
    { id: "seg-6", name: "Trial Members", icon: Users, color: "bg-teal-100 text-teal-600", count: 6, description: "On an introductory / trial package" },
];

export default function MarketingPage() {
    const { promoCodes, campaigns, addPromoCode, addCampaign } = useDataStore();
    const [isAddPromoOpen, setIsAddPromoOpen] = useState(false);
    const [isAddCampaignOpen, setIsAddCampaignOpen] = useState(false);

    // Mock form state for new entries
    const [newPromoCode, setNewPromoCode] = useState("SPRING25");
    const [newCampaignName, setNewCampaignName] = useState("Spring Sale");

    const handleCreatePromo = () => {
        addPromoCode({
            studio_id: "s1",
            code: newPromoCode,
            type: "percentage",
            value: 20,
            applies_to: "all",
            usage_count: 0,
            valid_from: new Date().toISOString().split('T')[0],
            is_active: true
        });
        setIsAddPromoOpen(false);
    };

    const handleCreateCampaign = () => {
        addCampaign({
            studio_id: "s1",
            name: newCampaignName,
            type: "email",
            status: "scheduled",
            audience: "all_members",
            subject: "Don't miss out!",
            content: "Check out our latest offers...",
            stats: { sent: 0, opened: 0, clicked: 0 },
            created_at: new Date().toISOString()
        });
        setIsAddCampaignOpen(false);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Marketing</h1>
                <p className="text-gray-500 mt-2 text-lg">Manage promotions, campaigns, and audience segments.</p>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="campaigns" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
                    <TabsTrigger value="campaigns" className="gap-2">
                        <Megaphone className="w-4 h-4" />
                        Campaigns
                    </TabsTrigger>
                    <TabsTrigger value="promotions" className="gap-2">
                        <Ticket className="w-4 h-4" />
                        Promotions
                    </TabsTrigger>
                    <TabsTrigger value="segments" className="gap-2">
                        <Users className="w-4 h-4" />
                        Segments
                    </TabsTrigger>
                </TabsList>

                {/* Campaigns Tab */}
                <TabsContent value="campaigns" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Recent Campaigns</h2>
                        <Button onClick={() => setIsAddCampaignOpen(true)} className="gap-2 gradient-bg-brand">
                            <Plus className="w-4 h-4" />
                            Create Campaign
                        </Button>
                    </div>

                    {isAddCampaignOpen && (
                        <Card className="border-brand-100 bg-brand-50/30 mb-6">
                            <CardContent className="pt-6 flex gap-4 items-end">
                                <div className="space-y-2 flex-1">
                                    <Label>Campaign Name</Label>
                                    <Input
                                        value={newCampaignName}
                                        onChange={(e) => setNewCampaignName(e.target.value)}
                                        placeholder="e.g. Summer Sale"
                                    />
                                </div>
                                <Button onClick={handleCreateCampaign}>Save Draft</Button>
                                <Button variant="ghost" onClick={() => setIsAddCampaignOpen(false)}>Cancel</Button>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                        {campaigns.map((camp) => (
                            <Card key={camp.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        <div className="flex gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                                camp.type === "email" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                                            )}>
                                                {camp.type === "email" ? <Mail className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-lg">{camp.name}</h3>
                                                    <Badge variant={
                                                        camp.status === "sent" ? "default" :
                                                            camp.status === "scheduled" ? "secondary" : "outline"
                                                    }>
                                                        {camp.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {camp.status === "sent" && camp.sent_at ? `Sent on ${new Date(camp.sent_at).toLocaleDateString()}` : "Scheduled"} • Audience: {(camp.audience || "").replace('_', ' ')}
                                                </p>
                                                {camp.subject && (
                                                    <p className="text-sm text-gray-600 mt-2 font-medium">Subject: &quot;{camp.subject}&quot;</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex gap-8 items-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-8">
                                            <div className="text-center">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1 flex items-center gap-1 justify-center">
                                                    <Users className="w-3 h-3" /> Sent
                                                </p>
                                                <p className="font-bold text-xl">{camp.stats.sent}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1 flex items-center gap-1 justify-center">
                                                    <Eye className="w-3 h-3" /> Open Rate
                                                </p>
                                                <p className="font-bold text-xl">
                                                    {camp.stats.sent > 0 ? Math.round((camp.stats.opened / camp.stats.sent) * 100) : 0}%
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1 flex items-center gap-1 justify-center">
                                                    <MousePointer className="w-3 h-3" /> Clicks
                                                </p>
                                                <p className="font-bold text-xl">
                                                    {camp.stats.opened > 0 ? Math.round((camp.stats.clicked / camp.stats.opened) * 100) : 0}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Promotions Tab */}
                <TabsContent value="promotions" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Active Promo Codes</h2>
                        <Button onClick={() => setIsAddPromoOpen(true)} className="gap-2 gradient-bg-brand">
                            <Plus className="w-4 h-4" />
                            New Promo Code
                        </Button>
                    </div>

                    {isAddPromoOpen && (
                        <Card className="border-brand-100 bg-brand-50/30 mb-6">
                            <CardContent className="pt-6 flex gap-4 items-end">
                                <div className="space-y-2 flex-1">
                                    <Label>Promo Code</Label>
                                    <Input
                                        value={newPromoCode}
                                        onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. SUMMER25"
                                    />
                                </div>
                                <Button onClick={handleCreatePromo}>Create Code</Button>
                                <Button variant="ghost" onClick={() => setIsAddPromoOpen(false)}>Cancel</Button>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {promoCodes.map((code) => (
                            <Card key={code.id} className={cn("transition-all hover:shadow-md", !code.is_active && "opacity-60")}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <Badge variant={code.is_active ? "default" : "outline"} className={cn(code.is_active ? "bg-green-600" : "")}>
                                            {code.is_active ? "Active" : "Inactive"}
                                        </Badge>
                                        <div className="p-2 bg-gray-100 rounded-lg">
                                            <Ticket className="w-5 h-5 text-gray-500" />
                                        </div>
                                    </div>
                                    <CardTitle className="text-2xl font-mono tracking-wider mt-2">{code.code}</CardTitle>
                                    <CardDescription>
                                        {code.type === "percentage" ? `${code.value}% OFF` : `$${code.value} OFF`}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-sm py-2 border-t border-gray-100">
                                            <span className="text-gray-500">Applies to</span>
                                            <span className="font-medium capitalize">{code.applies_to}</span>
                                        </div>
                                        <div className="flex justify-between text-sm py-2 border-t border-gray-100">
                                            <span className="text-gray-500">Redemptions</span>
                                            <span className="font-medium flex items-center gap-1">
                                                <TrendingUp className="w-3 h-3 text-green-500" />
                                                {code.usage_count}
                                            </span>
                                        </div>
                                        {code.valid_until && (
                                            <div className="flex justify-between text-sm py-2 border-t border-gray-100">
                                                <span className="text-gray-500">Expires</span>
                                                <span className="font-medium">{new Date(code.valid_until).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Segments Tab */}
                <TabsContent value="segments" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-semibold">Member Segments</h2>
                            <p className="text-sm text-gray-500 mt-1">Target specific member groups for personalized outreach</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {memberSegments.map((seg) => (
                            <Card key={seg.id} className="hover:shadow-md transition-all group cursor-pointer">
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4">
                                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", seg.color)}>
                                            <seg.icon className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 text-sm">{seg.name}</h3>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{seg.description}</p>
                                            <div className="flex items-center justify-between mt-3">
                                                <span className="text-lg font-bold text-gray-900">{seg.count} members</span>
                                                <Button size="sm" variant="outline" className="text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Mail className="w-3 h-3 mr-1" />
                                                    Send Campaign
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

