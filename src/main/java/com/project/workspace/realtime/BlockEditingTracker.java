package com.project.workspace.realtime;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import com.project.block.dto.BlockMessageDTO;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class BlockEditingTracker {

    private final SimpMessagingTemplate messagingTemplate;

    // sessionId -> "documentId:blockId" -> EditingInfo (연결 끊김 시 정리용)
    private final Map<String, Map<String, EditingInfo>> sessionEditing = new ConcurrentHashMap<>();

    private record EditingInfo(Long documentId, Long blockId) {}

    public void startEditing(String sessionId, Long documentId, Long blockId, Long userId, String userName) {
        sessionEditing.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>())
                .put(documentId + ":" + blockId, new EditingInfo(documentId, blockId));

        broadcast(documentId, blockId, "EDIT_START", userId, userName);
    }

    public void endEditing(String sessionId, Long documentId, Long blockId, Long userId, String userName) {
        Map<String, EditingInfo> sessions = sessionEditing.get(sessionId);
        if (sessions != null) sessions.remove(documentId + ":" + blockId);

        broadcast(documentId, blockId, "EDIT_END", userId, userName);
    }

    // 연결이 끊기면 그 세션이 편집중이던 모든 블록에 EDIT_END 전송 (하이라이트 고아 방지)
    public void clearSession(String sessionId) {
        Map<String, EditingInfo> sessions = sessionEditing.remove(sessionId);
        if (sessions == null) return;

        for (EditingInfo info : sessions.values()) {
            broadcast(info.documentId(), info.blockId(), "EDIT_END", null, null);
        }
    }

    private void broadcast(Long documentId, Long blockId, String status, Long userId, String userName) {
        BlockMessageDTO payload = new BlockMessageDTO();
        payload.setStatus(status);
        payload.setDocumentId(documentId);
        payload.setBlockId(blockId);
        payload.setEditorId(userId);
        payload.setEditorName(userName);

        messagingTemplate.convertAndSend("/topic/documents/" + documentId, payload);
    }
}