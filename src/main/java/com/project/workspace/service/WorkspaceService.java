package com.project.workspace.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.project.user.entity.User;
import com.project.workspace.entity.Workspace;
import com.project.workspace.entity.WorkspaceMember;
import com.project.workspace.enumtype.WorkspaceRole;
import com.project.workspace.repository.WorkspaceMemberRepository;
import com.project.workspace.repository.WorkspaceRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceService {
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    
    @Transactional
    public Long createWorkspace(String workspaceName, String description, User loginUser){
        Workspace workspace = Workspace.builder()
                                    .workspaceName(workspaceName)
                                    .description(description)
                                    .createdAt(java.time.LocalDateTime.now())
                                    .build();
        workspaceRepository.save(workspace);

        WorkspaceMember workspaceMember = WorkspaceMember.builder()
                                                    .workspace(workspace)
                                                    .user(loginUser)
                                                    .role(WorkspaceRole.OWNER)
                                                    .build();
        workspaceMemberRepository.save(workspaceMember);

        return workspace.getWorkspaceId();
    }

    public List<Workspace> getMyWorkspaces(Long userId){
        List<WorkspaceMember> workspaceMembers = workspaceMemberRepository.findByUser_UserId(userId);

        return workspaceMembers.stream().map(WorkspaceMember::getWorkspace).collect(Collectors.toList());
    }
}
