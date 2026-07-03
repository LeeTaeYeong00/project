package com.project.block.dto;

import com.project.block.enumtype.BlockType;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@ToString
public class BlockMessageDTO {
    private String status;
    private Long documentId;
    private Long blockId;
    private BlockType blockType;
    private String content;
    private Integer sequenceOrder;
}
