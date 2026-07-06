package com.project.workspace.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.project.workspace.entity.Workspace;

public interface WorkspaceRepository extends JpaRepository<Workspace, Long> {
    Optional<Workspace> findByInviteCode(String inviteCode);
}
