// Sales by Category was merged into Sales Breakdown (group by Item type).
// Keep the old URL alive with a permanent redirect so bookmarks don't 404.
import { redirect } from "next/navigation";

export default function SalesByCategoryRedirect() {
    redirect("/reports/sales-breakdown");
}
