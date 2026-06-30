package com.project.workspace.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.project.workspace.entity.WorkspaceMember;


public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, Long> {
    List<WorkspaceMember> findByUser_UserId(Long userId);
}
