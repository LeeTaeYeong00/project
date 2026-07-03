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

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BlockService {
    
    private final BlockRepository blockRepository;
    private final DocumentRepository documentRepository;

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

        Document document = documentRepository.findById(message.getDocumentId()).orElseThrow(() -> new IllegalArgumentException("문서가 존재하지 않습니다."));

        

        Block newBlock = Block.builder()
                              .document(document)
                              .blockType(message.getBlockType() != null ? message.getBlockType() : BlockType.TEXT)
                              .content("")
                              .sequenceOrder(targetOrder)
                              .build();
                    
        Block savedBlock = blockRepository.save(newBlock);

        message.setBlockId(savedBlock.getBlockId());
        message.setSequenceOrder(savedBlock.getSequenceOrder());
        message.setContent("");

        return message;
    }

    @Transactional
    public BlockMessageDTO deleteBlcok(BlockMessageDTO message){
        
        Block targetBlock = blockRepository.findById(message.getBlockId()).orElseThrow(() -> new IllegalArgumentException("존재하지 않는 블록입니다."));

        blockRepository.delete(targetBlock);

        return message;
    }
}
