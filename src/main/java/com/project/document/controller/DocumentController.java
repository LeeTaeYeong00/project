package com.project.document.controller;

import java.util.List;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import com.project.document.entity.Document;
import com.project.document.service.DocumentService;

import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/workspaces/{workspaceId}/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    // 통합 화면: 사이드바(목록) + 메인(선택된 문서 편집기)
    @GetMapping
    public String documentWorkspace(@PathVariable("workspaceId") Long workspaceId,
                                    @RequestParam(value = "docId", required = false) Long docId,
                                    Model model) {
        
        // 왼쪽 사이드바에 뿌려줄 전체 문서 목록 조회
        List<Document> documents = documentService.getDocumentsByWorkspace(workspaceId);
        model.addAttribute("documents", documents);
        model.addAttribute("workspaceId", workspaceId);

        // 특정 문서를 클릭해서 docId 파라미터가 들어왔다면 오른쪽 메인에 넘겨줌
        if (docId != null) {
            Document selectedDocument = documentService.getDocument(docId);
            model.addAttribute("selectedDocument", selectedDocument);
        }

        return "document/workspace";
    }

    // 새 문서 생성 요청 처리
    @PostMapping("/create")
    public String createDocument(@PathVariable("workspaceId") Long workspaceId,
                                 @RequestParam("title") String title) {
        
        Long newDocId = documentService.createDocument(workspaceId, title);
        // 생성 후, 방금 만든 문서가 바로 열리도록 파라미터(docId)를 붙여서 리다이렉트
        return "redirect:/workspaces/" + workspaceId + "/documents?docId=" + newDocId;
    }

    // 본문 수정 요청 처리
    @PostMapping("/update-content")
    public String updateContent(@PathVariable("workspaceId") Long workspaceId,
                                @RequestParam("docId") Long docId,
                                @RequestParam("content") String content) {
        
        documentService.modifyContent(docId, content);
        // 저장 후 보고 있던 문서 상태 그대로 유지
        return "redirect:/workspaces/" + workspaceId + "/documents?docId=" + docId;
    }
}
// public class DocumentController {
//     private final DocumentService documentService;

//     @GetMapping
//     public String documentList(@PathVariable("workspaceId") Long workspaceId, Model model){
//         List<Document> documents = documentService.getDocumentsByWorkspace(workspaceId);

//         model.addAttribute("workspaceId", workspaceId);
//         model.addAttribute("documents", documents);

//         return "document/list";
//     }

//     @PostMapping("/create")
//     public String createDocument(@PathVariable("workspaceId") Long workspceId, @RequestParam("title") String title){
//         documentService.createDocument(workspceId, title);
        
//         return "redirect:/workspaces/" + workspceId + "/documents";
//     }

//     @GetMapping("/{documentId}")
//     public String documentDetail(@PathVariable("workspaceId") Long worksapceId, @PathVariable("documentId") Long documentId, Model model){
//         Document document = documentService.getDocument(documentId);

//         model.addAttribute("workspaceId", worksapceId);
//         model.addAttribute("document", document);

//         return "document/detail";
//     }

//     @PostMapping("/{documentId}/update-content")
//     public String updateContent(@PathVariable("workspaceId") Long workspaceId, @PathVariable("documentId") Long documentId, @RequestParam("content") String content){
//         documentService.modifyContent(documentId, content);

//         return "redirect:/workspaces/" + workspaceId + "/documents/" + documentId;
//     }
// }
