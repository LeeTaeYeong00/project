package com.project.block.entity;

import java.time.LocalDateTime;

import com.project.block.enumtype.BlockType;
import com.project.document.entity.Document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "blocks")
public class Block {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long blockId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BlockType blockType;

    @Column(columnDefinition = "LONGTEXT")
    private String content;

    @Column(nullable = false, name = "sequence_order")
    private Integer sequenceOrder;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updateAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @PrePersist
    protected void onCreated(){
        this.createdAt = LocalDateTime.now();
        this.updateAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate(){
        this.updateAt = LocalDateTime.now();
    }

    public void updateContent(String content){
        this.content = content;
    }

    public void updateSequenceOrder(Integer sequenceOrder){
        this.sequenceOrder = sequenceOrder;
    }

    public void updateBlockType(BlockType blockType){
        this.blockType = blockType;
    }
}
