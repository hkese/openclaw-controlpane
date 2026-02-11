import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByTask = query({
    args: { taskId: v.string() },
    handler: async (ctx, { taskId }) => {
        return await ctx.db
            .query("comments")
            .withIndex("by_task", (q) => q.eq("taskId", taskId))
            .collect();
    },
});

export const listByGateway = query({
    args: { gatewayId: v.string() },
    handler: async (ctx, { gatewayId }) => {
        return await ctx.db
            .query("comments")
            .withIndex("by_gateway", (q) => q.eq("gatewayId", gatewayId))
            .collect();
    },
});

export const create = mutation({
    args: {
        gatewayId: v.string(),
        taskId: v.string(),
        content: v.string(),
        fromAgent: v.optional(v.string()),
    },
    handler: async (ctx, { gatewayId, taskId, content, fromAgent }) => {
        const now = Date.now();
        const id = await ctx.db.insert("comments", {
            gatewayId,
            taskId,
            content,
            fromAgent: fromAgent || "You",
            ts: now,
        });

        await ctx.db.insert("activities", {
            gatewayId,
            type: "comment_added",
            agentName: fromAgent || "You",
            message: `Commented on task`,
            ts: now,
        });

        const mentions = content.match(/@(\w+)/g) || [];
        for (const mention of mentions) {
            await ctx.db.insert("notifications", {
                gatewayId,
                agentName: mention.slice(1),
                content: `${fromAgent || "You"} mentioned you: "${content.slice(0, 80)}"`,
                delivered: false,
                ts: now,
            });
        }

        return id;
    },
});
