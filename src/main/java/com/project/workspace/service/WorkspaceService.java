package com.project.workspace.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
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

    @Transactional
    public void deleteWorkspace(Long workspaceId, User loginUser){
        Workspace workspace = workspaceRepository.findById(workspaceId)
                                                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 워크스페이스 입니다"));
        
        workspaceRepository.delete(workspace);
    }

    public List<Workspace> getMyWorkspaces(Long userId){
        List<WorkspaceMember> workspaceMembers = workspaceMemberRepository.findByUser_UserId(userId);

        return workspaceMembers.stream().map(WorkspaceMember::getWorkspace).collect(Collectors.toList());
    }

    // ==========================================
    // ✨ [추가] 초대 코드 관련 비즈니스 로직
    // ==========================================

    /**
     * 📢 [OWNER 전용] 초대 코드 생성 및 재발급
     */
    @Transactional
    public String generateInviteCode(Long workspaceId, User loginUser) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 워크스페이스 입니다"));

        // 🛡️ 권한 검증: 초대 코드를 발급하려는 사람이 해당 워크스페이스의 OWNER인지 확인합니다.
        WorkspaceMember memberInfo = workspaceMemberRepository.findByWorkspace_WorkspaceIdAndUser_UserId(workspaceId, loginUser.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("해당 워크스페이스의 멤버가 아닙니다."));

        if (memberInfo.getRole() != WorkspaceRole.OWNER) {
            throw new IllegalStateException("초대 코드는 워크스페이스의 소유자(OWNER)만 생성할 수 있습니다.");
        }

        // 🔑 겹치지 않는 랜덤 영문+숫자 8자리 초대 코드 생성
        String inviteCode = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        
        // 유효기간은 넉넉하게 일주일(7일)로 세팅
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(7);

        // 엔티티 내부 변경 감지(Dirty Checking)를 통해 DB에 반영
        workspace.updateInviteCode(inviteCode, expiresAt);
        
        return inviteCode;
    }

    /**
     * 🔑 [일반 유저] 초대 코드를 입력하여 워크스페이스 가입
     */
    @Transactional
    public void joinWorkspaceByCode(String inviteCode, User loginUser) {
        // 1) 코드로 워크스페이스 조회
        Workspace workspace = workspaceRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new IllegalArgumentException("올바르지 않거나 존재하지 않는 초대 코드입니다."));

        // 2) 코드 유효 기간 검증
        if (workspace.getInviteCodeExpiresAt() != null && workspace.getInviteCodeExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalStateException("만료된 초대 코드입니다. 소유자에게 새 코드를 요청하세요.");
        }

        // 3) 이미 가입된 회원인지 검증 (기존 매핑 테이블 조회)
        boolean isAlreadyMember = workspaceMemberRepository
                .findByWorkspace_WorkspaceIdAndUser_UserId(workspace.getWorkspaceId(), loginUser.getUserId())
                .isPresent();
                
        if (isAlreadyMember) {
            throw new IllegalStateException("이미 가입되어 있는 워크스페이스입니다.");
        }

        // 4) 검증이 끝나면 새로운 멤버(기본 권한: EDITOR)로 등록하여 참여 완료
        WorkspaceMember newMember = WorkspaceMember.builder()
                .workspace(workspace)
                .user(loginUser)
                .role(WorkspaceRole.VISITOR)
                .build();

        workspaceMemberRepository.save(newMember);
    }

    public boolean hasEditableRole(Long workspaceId, Long userId){
        return workspaceMemberRepository.findByWorkspace_WorkspaceIdAndUser_UserId(workspaceId, userId)
                                        .map(member -> member.getRole() == WorkspaceRole.OWNER || member.getRole() == WorkspaceRole.MEMBER).orElse(false);
    }

    @Transactional
    public void leaveWorkspace(Long workspaceId, User loginUser) {
        WorkspaceMember member = workspaceMemberRepository
                .findByWorkspace_WorkspaceIdAndUser_UserId(workspaceId, loginUser.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("해당 워크스페이스 멤버가 아닙니다."));

        if (member.getRole() == WorkspaceRole.OWNER) {
            throw new IllegalStateException("소유자는 워크스페이스를 나갈 수 없습니다. 워크스페이스 삭제를 이용해주세요.");
        }

        workspaceMemberRepository.delete(member);
    }

    // ==========================================
    // ✨ [추가] 멤버 관리 (OWNER 전용)
    // ==========================================

    @Transactional(readOnly = true)
    public List<WorkspaceMember> getMembers(Long workspaceId, User loginUser) {
        validateOwner(workspaceId, loginUser.getUserId());
        return workspaceMemberRepository.findByWorkspace_WorkspaceId(workspaceId);
    }

    @Transactional
    public void kickMember(Long workspaceId, Long memberId, User loginUser) {
        validateOwner(workspaceId, loginUser.getUserId());

        WorkspaceMember target = workspaceMemberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 멤버입니다."));

        if (!target.getWorkspace().getWorkspaceId().equals(workspaceId)) {
            throw new IllegalArgumentException("잘못된 요청입니다.");
        }
        if (target.getRole() == WorkspaceRole.OWNER) {
            throw new IllegalStateException("소유자는 퇴출할 수 없습니다.");
        }

        workspaceMemberRepository.delete(target);
    }

    @Transactional
    public void changeMemberRole(Long workspaceId, Long memberId, WorkspaceRole newRole, User loginUser) {
        validateOwner(workspaceId, loginUser.getUserId());

        if (newRole == WorkspaceRole.OWNER) {
            throw new IllegalArgumentException("소유자 권한은 위임할 수 없습니다.");
        }

        WorkspaceMember target = workspaceMemberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 멤버입니다."));

        if (!target.getWorkspace().getWorkspaceId().equals(workspaceId)) {
            throw new IllegalArgumentException("잘못된 요청입니다.");
        }
        if (target.getRole() == WorkspaceRole.OWNER) {
            throw new IllegalStateException("소유자의 권한은 변경할 수 없습니다.");
        }

        target.updateRole(newRole);
    }

    private void validateOwner(Long workspaceId, Long userId) {
        WorkspaceMember member = workspaceMemberRepository
                .findByWorkspace_WorkspaceIdAndUser_UserId(workspaceId, userId)
                .orElseThrow(() -> new IllegalArgumentException("워크스페이스 멤버가 아닙니다."));

        if (member.getRole() != WorkspaceRole.OWNER) {
            throw new IllegalStateException("소유자만 가능한 기능입니다.");
        }
}

}