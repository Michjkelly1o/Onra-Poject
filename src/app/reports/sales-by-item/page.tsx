// Sales by Item was merged into Sales Breakdown (group by Item).
// Keep the old URL alive with a permanent redirect so bookmarks don't 404.
import { redirect } from "next/navigation";

export default function SalesByItemRedirect() {
    redirect("/reports/sales-breakdown");
}
