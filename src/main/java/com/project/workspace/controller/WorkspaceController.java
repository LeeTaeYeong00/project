package com.project.workspace.controller;

import java.util.List;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import com.project.user.entity.User;
import com.project.user.security.CustomUserDetails;
import com.project.workspace.entity.Workspace;
import com.project.workspace.service.WorkspaceService;

import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {
    
    private final WorkspaceService workspaceService;

    @GetMapping
    public String workspaceList(@AuthenticationPrincipal CustomUserDetails customUserDetails, Model model){
        User loginUser = customUserDetails.getUser();
        
        List<Workspace> workspaces = workspaceService.getMyWorkspaces(loginUser.getUserId());

        model.addAttribute("workspaces", workspaces);
        model.addAttribute("username", loginUser.getName());
        return "workspace/list";
    }

    @GetMapping("/create")
    public String createForm(){
        return "workspace/create";
    }

    @PostMapping("/create")
    public String createWorkspace(@RequestParam("workspaceName") String workspaceName,
                                  @RequestParam("description") String description,
                                  @AuthenticationPrincipal CustomUserDetails customUserDetails){
    
        User loginUser = customUserDetails.getUser();
        workspaceService. createWorkspace(workspaceName, description, loginUser);

        return "redirect:/workspaces";
    }

    @PostMapping("/{workspaceId}/delete")
    public String deleteWorkspace(@PathVariable("workspaceId") Long workspaceId,
                                    @AuthenticationPrincipal CustomUserDetails customUserDetails){
                            
        User loginUser = customUserDetails.getUser();
        workspaceService.deleteWorkspace(workspaceId, loginUser);

        return "redirect:/workspaces";
    }
}
