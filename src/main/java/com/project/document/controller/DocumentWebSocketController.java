package com.project.document.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.project.document.service.DocumentService;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;

@Controller
@RequiredArgsConstructor
public class DocumentWebSocketController {
    
    private final DocumentService documentService;
    private final SimpMessagingTemplate messagingTemplate;

    @Getter @Setter
    public static class  DocumentMessage {
        private String content;
    }

    @MessageMapping("/documents/{documentId}/typing")
    public void handleTyping(@DestinationVariable("documentId") Long documentId, DocumentMessage message){
        documentService.modifyContent(documentId, message.getContent());

        messagingTemplate.convertAndSend("/topic/documents/" + documentId, message);
    }
}
