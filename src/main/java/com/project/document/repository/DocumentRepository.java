package com.project.document.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.project.document.entity.Document;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByWorkspace_WorkspaceId(Long workspaceId);
}
