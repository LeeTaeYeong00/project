package com.project.workspace.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.project.workspace.entity.WorkspaceMember;


public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, Long> {
    List<WorkspaceMember> findByUser_UserId(Long userId);

    Optional<WorkspaceMember> findByWorkspace_WorkspaceIdAndUser_UserId(Long workspaceId, Long userId);
}
