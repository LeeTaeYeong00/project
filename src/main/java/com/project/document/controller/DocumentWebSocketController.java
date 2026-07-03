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
                    
                    BlockMessageDTO createdMessage = blockService.createNewBlock(message);

                    messagingTemplate.convertAndSend("/topic/documents/" + documentId, createdMessage);
                    log.info("📢 [CREATE] 새 블록 생성 브로드캐스팅 완료! BlockID: {}", createdMessage.getBlockId());
                    break;
                    
                case "UPDATE":
                    log.info("🔵 [SWITCH] UPDATE 케이스 진입 성공!");
                    // 현재 임시 데이터 전송을 위해 ID 검증을 잠시 우회하거나 로그만 찍음
                    if (message.getBlockId() != null) {
                        blockService.modifyBlockContent(message);
                        log.info("💾 [DB] 블록 내용 수정 완료!");
                    } else {
                        log.warn("⚠️ [경고] UPDATE 요청이지만 블록 ID가 없어 DB 저장을 건너뜁니다. (테스트용)");
                    }
                    break;
                    
                case "DELETE":
                    log.info("🔴 [SWITCH] DELETE 케이스 진입 성공!");
                    BlockMessageDTO deletedMessage = blockService.deleteBlcok(message);

                    messagingTemplate.convertAndSend("/topic/documents/" + documentId, deletedMessage);
                    log.info("📢 [DELETE] 블록 삭제 브로드캐스팅 완료! BlockID: {}", deletedMessage.getBlockId());
                    break;
                    
                default:
                    log.warn("❌ [SWITCH] 알 수 없는 상태값: {}", message.getStatus());
                    return;
            }
            
            // 전송 규격이 잘 맞는지 확인하기 위해 클라이언트로 그대로 다시 반사(브로드캐스팅)
            messagingTemplate.convertAndSend("/topic/documents/" + documentId, message);
            
        } catch (Exception e) {
            log.error("💥 [에러] 웹소켓 블록 처리 중 장애 발생: ", e);
        }
    }
}