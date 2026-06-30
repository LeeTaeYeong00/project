package com.project.workspace.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.project.workspace.entity.Workspace;

public interface WorkspaceRepository extends JpaRepository<Workspace, Long> {
    
}
