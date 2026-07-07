package com.project.document.controller;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.project.block.dto.BlockMessageDTO;
import com.project.block.service.BlockService;
import com.project.document.service.DocumentService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Controller
@RequiredArgsConstructor
public class DocumentWebSocketController {
    
    private final DocumentService documentService;
    private final BlockService blockService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/documents/{documentId}/typing")
    public void handleBlockEvent(@DestinationVariable("documentId") Long documentId, BlockMessageDTO message){
        // 🚀 수신 확인을 위한 거대한 로그 마커
        log.info("============== [웹소켓 신호 도착] ==============");
        log.info("문서 ID: {}, 상태(Status): {}, 블록타입: {}, 내용: {}", 
                 documentId, message.getStatus(), message.getBlockType(), message.getContent());
        
        try {
            switch (message.getStatus()) {
                case "CREATE":
                    log.info("🟢 [SWITCH] CREATE 케이스 진입 성공!");
                    
                    // 💡 서비스단에서 message.getContent()를 읽어서 
                    // 새 블록 엔티티의 content에 세팅해 주도록 설계되어 있어야 합니다.
                    BlockMessageDTO createdMessage = blockService.createNewBlock(message);
                    
                    // DB에 정상 저장되고 새 블록 ID와 content(뒷부분 텍스트)가 담긴 완벽한 객체를 전달
                    messagingTemplate.convertAndSend("/topic/documents/" + documentId, createdMessage);
                    log.info("📢 [CREATE] 새 블록 생성 브로드캐스팅 완료! BlockID: {}", createdMessage.getBlockId());
                    
                    // ❌ 기존 break; 대신 return; 을 사용하여 맨 하단의 공통 브로드캐스트 라인을 건너뛰어야 합니다!
                    return;
                    
                case "UPDATE":
                    log.info("🔵 [SWITCH] UPDATE 케이스 진입 성공!");
                    if (message.getBlockId() != null) {
                        blockService.modifyBlockContent(message);
                        log.info("💾 [DB] 블록 내용 수정 완료!");
                    } else {
                        log.warn("⚠️ [경고] UPDATE 요청이지만 블록 ID가 없어 DB 저장을 건너뜁니다. (테스트용)");
                    }
                    break;
                    
                case "DELETE":
                    log.info("🔴 [SWITCH] DELETE 케이스 진입 성공!");
                    
                    if(message.getBlockId() != null){
                        BlockMessageDTO deletedMessage = blockService.deleteBlcok(message);
                        messagingTemplate.convertAndSend("/topic/documents/" + documentId, deletedMessage);
                        log.info("📢 [DELETE] 블록 삭제 브로드캐스팅 완료! BlockID: {}", deletedMessage.getBlockId());
                    } else {
                        Long workspaceId = documentService.getWorkspaceIdByDocumentId(documentId);
                        documentService.deleteDocument(message.getDocumentId());
                        messagingTemplate.convertAndSend("/topic/workspaces/" + workspaceId, message);
                        log.info("📢 [DELETE] 문서 삭제 브로드캐스팅 완료! DocumentID: {}", message);
                    }
                    
                    
                    break;
                
                // 💡 [추가] 드래그 앤 드롭 순서 변경 케이스 처리
                case "REORDER":
                    log.info("🔀 [SWITCH] REORDER 케이스 진입 성공!");
                    if (message.getOrderedBlocks() != null && !message.getOrderedBlocks().isEmpty()) {
                        // 1. 서비스 레이어를 호출하여 DB의 sequenceOrder 일괄 업데이트 수행
                        blockService.reorderBlocks(message.getOrderedBlocks());
                        log.info("💾 [DB] 블록 순서 재정렬 벌크 업데이트 완료!");
                    } else {
                        log.warn("⚠️ [경고] REORDER 요청이지만 순서 목록(orderedBlocks)이 비어있습니다.");
                    }
                    break;
                
                case "RENAME":
                    log.info("✏️ [SWITCH] RENAME 케이스 진입 성공! 문서 ID: {}, 새 제목: {}", documentId, message.getContent());
                    
                    // 💡 작성해두신 modifyTitle 메서드 사용
                    documentService.modifyTitle(documentId, message.getContent());
                    
                    log.info("💾 [DB] 문서 제목 업데이트 완료!");
                    messagingTemplate.convertAndSend("/topic/documents/" + documentId, message);
                    break;
                
                default:
                    log.warn("❌ [SWITCH] 알 수 없는 상태값: {}", message.getStatus());
                    return;
            }
            
            // 전송 규격이 잘 맞는지 확인하기 위해 클라이언트로 그대로 다시 반사(브로드캐스팅)
            // (UPDATE나 REORDER 이벤트 등은 이 하단 공통 라인을 타고 바로 브로드캐스트 됩니다)
            messagingTemplate.convertAndSend("/topic/documents/" + documentId, message);
            
        } catch (Exception e) {
            log.error("💥 [에러] 웹소켓 블록 처리 중 장애 발생: ", e);
        }
    }
}