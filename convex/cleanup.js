import { v } from "convex/values";
import { mutation } from "./_generated/server";

/* ──────────────────────────────────────────────────────
   cleanup — Bulk-delete ALL data scoped to a gatewayId
   Used when user removes a gateway and wants data gone too.
   ────────────────────────────────────────────────────── */

export const removeAllGatewayData = mutation({
    args: { gatewayId: v.string() },
    handler: async (ctx, { gatewayId }) => {
        const tables = ["tasks", "comments", "documents", "activities", "notifications", "journal"];
        let totalDeleted = 0;

        for (const table of tables) {
            const rows = await ctx.db
                .query(table)
                .withIndex("by_gateway", q => q.eq("gatewayId", gatewayId))
                .collect();
            for (const row of rows) {
                await ctx.db.delete(row._id);
                totalDeleted++;
            }
        }

        // Also remove the gateway_config itself
        const cfg = await ctx.db
            .query("gateway_configs")
            .withIndex("by_gatewayId", q => q.eq("gatewayId", gatewayId))
            .first();
        if (cfg) {
            await ctx.db.delete(cfg._id);
            totalDeleted++;
        }

        return { deleted: totalDeleted };
    },
});
