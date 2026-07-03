package com.project.block.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.project.block.dto.BlockMessageDTO;
import com.project.block.entity.Block;
import com.project.block.enumtype.BlockType;
import com.project.block.repository.BlockRepository;
import com.project.document.entity.Document;
import com.project.document.repository.DocumentRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BlockService {
    
    private final BlockRepository blockRepository;
    private final DocumentRepository documentRepository;

    // 💡 [추가] 영속성 컨텍스트 비우기를 위한 엔티티 매니저 주입
    @PersistenceContext
    private final EntityManager entityManager;

    @Transactional
    public void modifyBlockContent(BlockMessageDTO message){
        if(message.getBlockId() == null){
            throw new IllegalArgumentException("수정할 블록 ID가 없습니다.");
        }

        Block block = blockRepository.findById(message.getBlockId()).orElseThrow(() -> new IllegalArgumentException("존재하지 않는 블록입니다. ID : " + message.getBlockId()));

        block.updateContent(message.getContent());
        
        if(message.getBlockType() != null){
            block.updateBlockType(message.getBlockType());
        }
    }

    @Transactional
    public BlockMessageDTO createNewBlock(BlockMessageDTO message){
        
        List<Block> existingBlocks = blockRepository.findByDocument_DocumentIdOrderBySequenceOrderAsc(message.getDocumentId());

        int targetOrder = (message.getSequenceOrder() != null ? message.getSequenceOrder() + 1 : existingBlocks.size());

        for(Block b : existingBlocks){
            if(b.getSequenceOrder() >= targetOrder){
                b.updateSequenceOrder(b.getSequenceOrder() + 1);
            }
        }

        Document document = documentRepository.findById(message.getDocumentId())
                .orElseThrow(() -> new IllegalArgumentException("문서가 존재하지 않습니다."));

        // 💡 [수정 1]: 프론트에서 넘어온 뒷부분 텍스트(message.getContent())를 엔티티에 그대로 넣어줍니다.
        // 만약 null이거나 비어있을 때만 빈 문자열("") 처리를 합니다.
        String initialContent = (message.getContent() != null) ? message.getContent() : "";

        Block newBlock = Block.builder()
                              .document(document)
                              .blockType(message.getBlockType() != null ? message.getBlockType() : BlockType.TEXT)
                              .content(initialContent) // 👈 "" 대신 initialContent 반영
                              .sequenceOrder(targetOrder)
                              .build();
                    
        Block savedBlock = blockRepository.save(newBlock);

        // 프론트엔드로 브로드캐스팅해줄 반환용 DTO 조립
        message.setBlockId(savedBlock.getBlockId());
        message.setSequenceOrder(savedBlock.getSequenceOrder());
        
        message.setContent(savedBlock.getContent()); 

        return message;
    }

    @Transactional
    public BlockMessageDTO deleteBlcok(BlockMessageDTO message){
        
        Block targetBlock = blockRepository.findById(message.getBlockId()).orElseThrow(() -> new IllegalArgumentException("존재하지 않는 블록입니다."));

        blockRepository.delete(targetBlock);

        return message;
    }

    @Transactional
    public void reorderBlocks(List<BlockMessageDTO.BlockOrderInfo> orderedBlocks) {
        if (orderedBlocks == null || orderedBlocks.isEmpty()) return;

        for (BlockMessageDTO.BlockOrderInfo info : orderedBlocks) {
            blockRepository.updateSequenceOrder(info.getBlockId(), info.getSequenceOrder());
        }
        
        // 🚨 [수정 및 추가] DB 저장 후 1차 캐시(영속성 컨텍스트)를 강제로 클리어
        blockRepository.flush(); 
        entityManager.clear(); 
    }
}