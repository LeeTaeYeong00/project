package com.project.document.controller;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import com.project.document.entity.Document;
import com.project.document.service.DocumentService;
import com.project.user.security.CustomUserDetails;
import com.project.workspace.entity.Workspace;
import com.project.workspace.repository.WorkspaceRepository;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/workspaces/{workspaceId}/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final WorkspaceRepository workspaceRepository;

    @GetMapping
    public String documentWorkspace(@PathVariable("workspaceId") Long workspaceId,
                                    @RequestParam(value = "docId", required = false) Long docId,
                                    @AuthenticationPrincipal CustomUserDetails customUserDetails,
                                    HttpServletRequest request,
                                    Model model) {
        
        List<Document> documents = documentService.getDocumentsByWorkspace(workspaceId);
        model.addAttribute("documents", documents);
        model.addAttribute("workspaceId", workspaceId);

        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 워크스페이스입니다."));
        model.addAttribute("workspaceName", workspace.getWorkspaceName());

        Object roleAttr = request.getAttribute("workspaceRole");
        String roleStr = (roleAttr != null) ? roleAttr.toString() : "VISITOR";
        model.addAttribute("myRole", roleStr);
        model.addAttribute("isVisitor", "VISITOR".equals(roleStr));
        model.addAttribute("isOwner", "OWNER".equals(roleStr));
        model.addAttribute("myName", customUserDetails.getUser().getName());

        if (docId != null) {
            Document selectedDocument = documentService.getDocument(docId);
            model.addAttribute("selectedDocument", selectedDocument);
        }

        return "document/workspace";
    }

    @PostMapping("/create")
    public String createDocument(@PathVariable("workspaceId") Long workspaceId,
                                 @RequestParam("title") String title) {
        Long newDocId = documentService.createDocument(workspaceId, title);
        return "redirect:/workspaces/" + workspaceId + "/documents?docId=" + newDocId;
    }

    @PostMapping("/update-content")
    public String updateContent(@PathVariable("workspaceId") Long workspaceId,
                                @RequestParam("docId") Long docId,
                                @RequestParam("content") String content) {
        documentService.modifyContent(docId, content);
        return "redirect:/workspaces/" + workspaceId + "/documents?docId=" + docId;
    }
}