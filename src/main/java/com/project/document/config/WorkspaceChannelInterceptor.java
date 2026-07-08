package com.project.document.config;

import java.security.Principal;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.block.dto.BlockMessageDTO;
import com.project.document.repository.DocumentRepository;
import com.project.user.entity.User;
import com.project.user.repository.UserRepository;
import com.project.workspace.entity.WorkspaceMember;
import com.project.workspace.enumtype.WorkspaceRole;
import com.project.workspace.repository.WorkspaceMemberRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class WorkspaceChannelInterceptor implements ChannelInterceptor {

    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null || !StompCommand.SEND.equals(accessor.getCommand())) {
            return message;
        }

        Long documentId = extractDocumentId(accessor.getDestination());
        if (documentId == null) {
            return message;
        }

        Principal principal = accessor.getUser();
        if (principal == null) {
            throw new AccessDeniedException("로그인이 필요합니다.");
        }

        User user = userRepository.findByUsername(principal.getName())
                .orElseThrow(() -> new AccessDeniedException("사용자 정보를 찾을 수 없습니다."));

        Long workspaceId = documentRepository.findWorkspaceIdByDocumentId(documentId);
        if (workspaceId == null) {
            throw new AccessDeniedException("존재하지 않는 문서입니다.");
        }

        WorkspaceMember member = workspaceMemberRepository
                .findByWorkspace_WorkspaceIdAndUser_UserId(workspaceId, user.getUserId())
                .orElseThrow(() -> new AccessDeniedException("워크스페이스 멤버가 아닙니다."));

        WorkspaceRole role = member.getRole();

        // VISITOR는 쓰기 이벤트 전부 차단
        if (role == WorkspaceRole.VISITOR) {
            throw new AccessDeniedException("읽기 권한만 있습니다.");
        }

        // 문서 자체 삭제(blockId 없는 DELETE)는 OWNER 전용
        BlockMessageDTO payload = parsePayload(message);
        if (payload != null
                && "DELETE".equals(payload.getStatus())
                && payload.getBlockId() == null
                && role != WorkspaceRole.OWNER) {
            throw new AccessDeniedException("문서 삭제는 소유자만 가능합니다.");
        }

        return message;
    }

    private Long extractDocumentId(String destination) {
        if (destination == null) return null;
        String[] segments = destination.split("/");
        for (int i = 0; i < segments.length - 1; i++) {
            if ("documents".equals(segments[i])) {
                try {
                    return Long.parseLong(segments[i + 1]);
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
        return null;
    }

    private BlockMessageDTO parsePayload(Message<?> message) {
        try {
            return objectMapper.readValue((byte[]) message.getPayload(), BlockMessageDTO.class);
        } catch (Exception e) {
            log.warn("payload 파싱 실패", e);
            return null;
        }
    }
}