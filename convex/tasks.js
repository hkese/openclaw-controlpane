import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ───

export const list = query({
    args: { gatewayId: v.string() },
    handler: async (ctx, { gatewayId }) => {
        return await ctx.db
            .query("tasks")
            .withIndex("by_gateway", (q) => q.eq("gatewayId", gatewayId))
            .collect();
    },
});

export const listByStatus = query({
    args: { gatewayId: v.string(), status: v.string() },
    handler: async (ctx, { gatewayId, status }) => {
        return await ctx.db
            .query("tasks")
            .withIndex("by_gateway_status", (q) =>
                q.eq("gatewayId", gatewayId).eq("status", status)
            )
            .collect();
    },
});

// Find a task by its session key (for dedup when auto-creating)
export const findBySessionKey = query({
    args: { sessionKey: v.string() },
    handler: async (ctx, { sessionKey }) => {
        return await ctx.db
            .query("tasks")
            .withIndex("by_session_key", (q) => q.eq("sessionKey", sessionKey))
            .first();
    },
});

// ─── Mutations ───

export const create = mutation({
    args: {
        gatewayId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        assigneeIds: v.optional(v.array(v.string())),
        sessionKey: v.optional(v.string()),
        source: v.optional(v.string()),
        channel: v.optional(v.string()),
        spawnedBy: v.optional(v.string()),
        runId: v.optional(v.string()),
    },
    handler: async (ctx, { gatewayId, title, description, assigneeIds, sessionKey, source, channel, spawnedBy, runId }) => {
        const now = Date.now();

        // If sessionKey provided, check for dedup
        if (sessionKey) {
            const existing = await ctx.db
                .query("tasks")
                .withIndex("by_session_key", (q) => q.eq("sessionKey", sessionKey))
                .first();
            if (existing) return existing._id;
        }

        // Auto-assign: if agents are assigned, start in 'assigned' instead of 'inbox'
        // For auto-detected tasks (with sessionKey), start directly in 'in_progress'
        let status = "inbox";
        if (sessionKey && source !== "manual") {
            status = "in_progress";
        } else if (assigneeIds && assigneeIds.length > 0) {
            status = "assigned";
        }

        const id = await ctx.db.insert("tasks", {
            gatewayId,
            title,
            description: description || "",
            status,
            assigneeIds: assigneeIds || [],
            sessionKey,
            source: source || "manual",
            channel,
            spawnedBy,
            runId,
            createdAt: now,
            updatedAt: now,
        });
        await ctx.db.insert("activities", {
            gatewayId,
            type: "task_created",
            agentName: source === "manual" ? "You" : (source || "system"),
            message: `${source !== "manual" ? "Auto-detected" : "Created"} task: ${title}`,
            ts: now,
        });
        return id;
    },
});

export const update = mutation({
    args: {
        id: v.id("tasks"),
        patch: v.object({
            title: v.optional(v.string()),
            description: v.optional(v.string()),
            status: v.optional(v.string()),
            assigneeIds: v.optional(v.array(v.string())),
            sessionKey: v.optional(v.string()),
            runId: v.optional(v.string()),
            completedAt: v.optional(v.number()),
        }),
    },
    handler: async (ctx, { id, patch }) => {
        const existing = await ctx.db.get(id);
        if (!existing) throw new Error("Task not found");

        const updates = { ...patch, updatedAt: Date.now() };

        // Auto-move: if assigning agents to an inbox task, move to assigned
        if (patch.assigneeIds && patch.assigneeIds.length > 0 && existing.status === 'inbox' && !patch.status) {
            updates.status = 'assigned';
        }

        // Track completion time
        if (patch.status === 'done' && !existing.completedAt) {
            updates.completedAt = Date.now();
        }

        await ctx.db.patch(id, updates);

        if (updates.status && updates.status !== existing.status) {
            await ctx.db.insert("activities", {
                gatewayId: existing.gatewayId,
                type: "task_status",
                agentName: "system",
                message: `Moved "${existing.title}" to ${updates.status}`,
                ts: Date.now(),
            });
        }
    },
});

// Archive a completed task
export const archive = mutation({
    args: { id: v.id("tasks") },
    handler: async (ctx, { id }) => {
        const existing = await ctx.db.get(id);
        if (!existing) throw new Error("Task not found");

        const now = Date.now();
        await ctx.db.patch(id, {
            status: "archived",
            archivedAt: now,
            updatedAt: now,
            completedAt: existing.completedAt || now,
        });
        await ctx.db.insert("activities", {
            gatewayId: existing.gatewayId,
            type: "task_archived",
            agentName: "system",
            message: `Archived task: ${existing.title}`,
            ts: now,
        });
    },
});

export const remove = mutation({
    args: { id: v.id("tasks") },
    handler: async (ctx, { id }) => {
        const existing = await ctx.db.get(id);
        if (!existing) return;

        const comments = await ctx.db
            .query("comments")
            .withIndex("by_task", (q) => q.eq("taskId", existing._id.toString()))
            .collect();
        for (const c of comments) {
            await ctx.db.delete(c._id);
        }

        await ctx.db.delete(id);

        await ctx.db.insert("activities", {
            gatewayId: existing.gatewayId,
            type: "task_deleted",
            agentName: "You",
            message: `Deleted task: ${existing.title}`,
            ts: Date.now(),
        });
    },
});
