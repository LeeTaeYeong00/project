package com.project.workspace.realtime;

import java.security.Principal;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import com.project.user.entity.User;
import com.project.user.repository.UserRepository;
import com.project.workspace.entity.WorkspaceMember;
import com.project.workspace.repository.WorkspaceMemberRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class WorkspaceRealtimeEventListener {

    private final WorkspacePresenceService presenceService;
    private final BlockEditingTracker editingTracker;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    @EventListener
    public void handleSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = accessor.getDestination();
        if (destination == null || !destination.matches("^/topic/workspaces/\\d+/presence$")) return;

        Long workspaceId = Long.parseLong(destination.replaceAll("\\D+", ""));

        Principal principal = accessor.getUser();
        if (principal == null) return;

        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null) return;

        WorkspaceMember member = workspaceMemberRepository
                .findByWorkspace_WorkspaceIdAndUser_UserId(workspaceId, user.getUserId())
                .orElse(null);
        if (member == null) return;

        // 👇 구독 시 클라이언트가 실어 보낸 documentId 헤더를 읽음
        Long documentId = null;
        String docHeader = accessor.getFirstNativeHeader("documentId");
        if (docHeader != null && !docHeader.isBlank() && !"null".equals(docHeader)) {
            try { documentId = Long.parseLong(docHeader); } catch (NumberFormatException ignored) {}
        }

        presenceService.join(accessor.getSessionId(), workspaceId, documentId, user.getUserId(), user.getName(), member.getRole().name());
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();

        presenceService.leave(sessionId);
        editingTracker.clearSession(sessionId);
    }
}