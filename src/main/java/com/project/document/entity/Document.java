package com.project.document.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.project.block.entity.Block;
import com.project.workspace.entity.Workspace;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
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
@Table(name = "documents")
public class Document {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long documentId;

    @Column(nullable = false)
    private String title;

    // @Column(columnDefinition = "LONGTEXT")
    // private String content;

    @Builder.Default
    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sequenceOrder ASC")
    private List<Block> blocks = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @PrePersist // 엔티티가 데이터베이스에 처음 저장되기 직전에 자동으로 실행되는 JPA
    protected void onCreated(){
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate // 엔티티가 데이터베이스에 업데이트되기 직전에 자동으로 실행
    protected void onUpdate(){
        this.updatedAt = LocalDateTime.now();
    }

    public void updateTitle(String title){
        if(title != null && !title.trim().isEmpty()){
            this.title = title;
        }
    }

    // public void updateContent(String content){
    //     this.content = content;
    // }

    public void addBlock(Block block){
        this.blocks.add(block);

        if(block.getDocument() != this){
            
        }
    }
}