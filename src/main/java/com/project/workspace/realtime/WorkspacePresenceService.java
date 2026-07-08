package com.project.workspace.realtime;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class WorkspacePresenceService {

    private final SimpMessagingTemplate messagingTemplate;

    // workspaceId -> sessionId -> PresenceUser
    private final Map<Long, Map<String, PresenceUser>> presence = new ConcurrentHashMap<>();
    // sessionId -> workspaceId (연결 끊길 때 어디서 지워야 할지 추적용)
    private final Map<String, Long> sessionWorkspace = new ConcurrentHashMap<>();

    public record PresenceUser(Long userId, String name, String role) {}

    public void join(String sessionId, Long workspaceId, Long userId, String name, String role) {
        leaveInternal(sessionId); // 이전 워크스페이스 세션 정리

        presence.computeIfAbsent(workspaceId, k -> new ConcurrentHashMap<>())
                .put(sessionId, new PresenceUser(userId, name, role));
        sessionWorkspace.put(sessionId, workspaceId);

        broadcast(workspaceId);
    }

    public void leave(String sessionId) {
        Long workspaceId = leaveInternal(sessionId);
        if (workspaceId != null) {
            broadcast(workspaceId);
        }
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

        // 같은 유저가 여러 탭으로 접속해도 한 명으로 합쳐서 보여줌
        List<PresenceUser> unique = sessions.values().stream()
                .collect(Collectors.toMap(PresenceUser::userId, u -> u, (a, b) -> a))
                .values().stream().toList();

        messagingTemplate.convertAndSend("/topic/workspaces/" + workspaceId + "/presence", unique);
    }
}