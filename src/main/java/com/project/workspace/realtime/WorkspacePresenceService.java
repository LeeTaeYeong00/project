package com.project.workspace.realtime;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class WorkspacePresenceService {

    private final SimpMessagingTemplate messagingTemplate;

    private final Map<Long, Map<String, PresenceUser>> presence = new ConcurrentHashMap<>();
    private final Map<String, Long> sessionWorkspace = new ConcurrentHashMap<>();

    public record PresenceUser(Long userId, String name, String role, Long documentId) {}

    public void join(String sessionId, Long workspaceId, Long documentId, Long userId, String name, String role) {
        leaveInternal(sessionId);

        presence.computeIfAbsent(workspaceId, k -> new ConcurrentHashMap<>())
                .put(sessionId, new PresenceUser(userId, name, role, documentId));
        sessionWorkspace.put(sessionId, workspaceId);

        broadcast(workspaceId);
    }

    public void leave(String sessionId) {
        Long workspaceId = leaveInternal(sessionId);
        if (workspaceId != null) broadcast(workspaceId);
    }

    private Long leaveInternal(String sessionId) {
        Long workspaceId = sessionWorkspace.remove(sessionId);
        if (workspaceId != null) {
            Map<String, PresenceUser> sessions = presence.get(workspaceId);
            if (sessions != null) {
                sessions.remove(sessionId);
                if (sessions.isEmpty()) presence.remove(workspaceId);
            }
        }
        return workspaceId;
    }

    private void broadcast(Long workspaceId) {
        Map<String, PresenceUser> sessions = presence.getOrDefault(workspaceId, Map.of());
        messagingTemplate.convertAndSend("/topic/workspaces/" + workspaceId + "/presence", sessions.values());
    }
}