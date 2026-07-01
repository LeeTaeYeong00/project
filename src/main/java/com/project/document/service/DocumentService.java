package com.project.document.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.project.document.entity.Document;
import com.project.document.repository.DocumentRepository;
import com.project.workspace.entity.Workspace;
import com.project.workspace.repository.WorkspaceRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DocumentService {
    private final DocumentRepository documentRepository;
    private final WorkspaceRepository workspaceRepository;

    @Transactional
    public Long createDocument(Long workspaceId, String title){
        Workspace workspace = workspaceRepository.findById(workspaceId)
                                                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 워크스페이스 입니다."));
        Document document = Document.builder()
                                    .workspace(workspace)                                        
                                    .title(title)
                                    .content("")
                                    .build();
        
        documentRepository.save(document);
        
        return document.getDocumentId();
    }

    public List<Document> getDocumentsByWorkspace(Long workspaceId){
        return documentRepository.findByWorkspace_WorkspaceId(workspaceId);
    }

    public Document getDocument(Long documentId){
        return documentRepository.findById(documentId).orElseThrow(() -> new IllegalArgumentException("존재하지 않는 문서입니다."));
    }

    @Transactional
    public void modifyTitle(Long documentId, String newTitle){
        Document document = getDocument(documentId);
        document.updateTitle(newTitle);
    }

    @Transactional
    public void modifyContent(Long documentId, String newContent){
        Document document = getDocument(documentId);
        document.updateContent(newContent);
    }

    @Transactional
    public void deleteDocument(Long documentId){
        Document document = getDocument(documentId);
        documentRepository.delete(document);
    }
}
