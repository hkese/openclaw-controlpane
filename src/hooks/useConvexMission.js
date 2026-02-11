import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import useGatewayStore from '../stores/useGatewayStore';

/*  ──────────────────────────────────────────────────────
    useConvexMission — Convex-backed Mission Control data
    All data is scoped to the selected gateway.
    Data only loads when the gateway is CONNECTED.
    ────────────────────────────────────────────────────── */

function useGatewayId() {
    const getSelectedGateway = useGatewayStore(s => s.getSelectedGateway);
    const gw = getSelectedGateway();
    // Only return the ID if gateway is connected — otherwise skip queries
    if (!gw || gw.status !== 'connected') return null;
    return gw.id;
}

export function useTasks() {
    const gatewayId = useGatewayId();
    const tasks = useQuery(
        api.tasks.list,
        gatewayId ? { gatewayId } : "skip"
    ) ?? [];
    const createTask = useMutation(api.tasks.create);
    const updateTask = useMutation(api.tasks.update);
    const removeTask = useMutation(api.tasks.remove);

    return {
        tasks,
        gatewayId,
        addTask: (title, description, assigneeIds) =>
            gatewayId ? createTask({ gatewayId, title, description, assigneeIds }) : null,
        updateTask: (id, patch) => updateTask({ id, patch }),
        deleteTask: (id) => removeTask({ id }),
    };
}

export function useComments(taskId) {
    const gatewayId = useGatewayId();
    const comments = useQuery(
        api.comments.listByTask,
        taskId && gatewayId ? { taskId } : "skip"
    ) ?? [];
    const createComment = useMutation(api.comments.create);

    return {
        comments,
        addComment: (content, fromAgent) =>
            gatewayId ? createComment({ gatewayId, taskId, content, fromAgent }) : null,
    };
}

export function useAllComments() {
    const gatewayId = useGatewayId();
    const comments = useQuery(
        api.comments.listByGateway,
        gatewayId ? { gatewayId } : "skip"
    ) ?? [];
    return comments;
}

export function useDocuments() {
    const gatewayId = useGatewayId();
    const documents = useQuery(
        api.documents.list,
        gatewayId ? { gatewayId } : "skip"
    ) ?? [];
    const createDoc = useMutation(api.documents.create);
    const updateDoc = useMutation(api.documents.update);
    const removeDoc = useMutation(api.documents.remove);

    return {
        documents,
        addDocument: (title, content, type, taskId) =>
            gatewayId ? createDoc({ gatewayId, title, content, type, taskId }) : null,
        updateDocument: (id, patch) => updateDoc({ id, patch }),
        deleteDocument: (id) => removeDoc({ id }),
    };
}

export function useActivities(limit = 100) {
    const gatewayId = useGatewayId();
    const activities = useQuery(
        api.activities.list,
        gatewayId ? { gatewayId, limit } : "skip"
    ) ?? [];
    const addActivity = useMutation(api.activities.add);

    return {
        activities,
        addActivity: (type, agentName, message) =>
            gatewayId ? addActivity({ gatewayId, type, agentName, message }) : null,
    };
}

export function useNotifications() {
    const gatewayId = useGatewayId();
    const notifications = useQuery(
        api.notifications.list,
        gatewayId ? { gatewayId } : "skip"
    ) ?? [];
    const undelivered = useQuery(
        api.notifications.listUndelivered,
        gatewayId ? { gatewayId } : "skip"
    ) ?? [];
    const markDelivered = useMutation(api.notifications.markDelivered);

    return {
        notifications,
        undelivered,
        markDelivered: (id) => markDelivered({ id }),
    };
}
