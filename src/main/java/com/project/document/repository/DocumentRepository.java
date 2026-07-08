package com.project.document.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.project.document.entity.Document;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByWorkspace_WorkspaceId(Long workspaceId);

    @Query("SELECT d.workspace.workspaceId FROM Document d WHERE d.documentId = :documentId")
    Long findWorkspaceIdByDocumentId(@Param("documentId") Long documentId);
}
