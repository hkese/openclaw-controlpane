import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
    args: { gatewayId: v.string() },
    handler: async (ctx, { gatewayId }) => {
        return await ctx.db
            .query("notifications")
            .withIndex("by_gateway", (q) => q.eq("gatewayId", gatewayId))
            .order("desc")
            .take(200);
    },
});

export const listUndelivered = query({
    args: { gatewayId: v.string() },
    handler: async (ctx, { gatewayId }) => {
        return await ctx.db
            .query("notifications")
            .withIndex("by_gateway", (q) => q.eq("gatewayId", gatewayId))
            .filter((q) => q.eq(q.field("delivered"), false))
            .collect();
    },
});

export const add = mutation({
    args: {
        gatewayId: v.string(),
        agentName: v.string(),
        content: v.string(),
    },
    handler: async (ctx, { gatewayId, agentName, content }) => {
        return await ctx.db.insert("notifications", {
            gatewayId,
            agentName,
            content,
            delivered: false,
            ts: Date.now(),
        });
    },
});

export const markDelivered = mutation({
    args: { id: v.id("notifications") },
    handler: async (ctx, { id }) => {
        await ctx.db.patch(id, { delivered: true });
    },
});
