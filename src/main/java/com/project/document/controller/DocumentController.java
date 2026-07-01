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

    @GetMapping
    public String documentList(@PathVariable("workspaceId") Long workspaceId, Model model){
        List<Document> documents = documentService.getDocumentsByWorkspace(workspaceId);

        model.addAttribute("workspaceId", workspaceId);
        model.addAttribute("documents", documents);

        return "document/list";
    }

    @PostMapping("/create")
    public String createDocument(@PathVariable("workspaceId") Long workspceId, @RequestParam("title") String title){
        documentService.createDocument(workspceId, title);
        
        return "redirect:/workspaces/" + workspceId + "/documents";
    }
}
