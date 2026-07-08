package com.project.workspace.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.project.user.entity.User;
import com.project.user.security.CustomUserDetails;
import com.project.workspace.entity.Workspace;
import com.project.workspace.entity.WorkspaceMember;
import com.project.workspace.enumtype.WorkspaceRole;
import com.project.workspace.repository.WorkspaceMemberRepository;
import com.project.workspace.repository.WorkspaceRepository;
import com.project.workspace.service.WorkspaceService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Controller
@RequestMapping("/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {
    
    private final WorkspaceService workspaceService;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    @GetMapping
    public String workspaceList(@AuthenticationPrincipal CustomUserDetails customUserDetails, Model model){
        User loginUser = customUserDetails.getUser();
        
        List<Workspace> workspaces = workspaceService.getMyWorkspaces(loginUser.getUserId());

        model.addAttribute("workspaces", workspaces);
        model.addAttribute("username", loginUser.getName());
        
        // ✨ [추가] 로그인한 유저의 ID를 타임리프로 직접 전달!
        model.addAttribute("loginUserId", loginUser.getUserId()); 
        
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
        workspaceService.createWorkspace(workspaceName, description, loginUser);

        return "redirect:/workspaces";
    }

    @PostMapping("/{workspaceId}/delete")
    public String deleteWorkspace(@PathVariable("workspaceId") Long workspaceId,
                                    @AuthenticationPrincipal CustomUserDetails customUserDetails){
                            
        User loginUser = customUserDetails.getUser();

        WorkspaceMember member = workspaceMemberRepository.findByWorkspace_WorkspaceIdAndUser_UserId(workspaceId, loginUser.getUserId())
                                            .orElseThrow(() -> new IllegalArgumentException("해당 워크스페이스 멤버가 아닙니다."));
                        
        if(member.getRole() != WorkspaceRole.OWNER){
            throw new IllegalArgumentException("삭제는 소유자(OWNER)만 가능합니다.");
        }

        workspaceService.deleteWorkspace(workspaceId, loginUser);

        return "redirect:/workspaces";
    }

    @PostMapping("/{workspaceId}/leave")
    public String leaveWorkspace(@PathVariable("workspaceId") Long workspaceId,
                                @AuthenticationPrincipal CustomUserDetails customUserDetails) {

        User loginUser = customUserDetails.getUser();
        workspaceService.leaveWorkspace(workspaceId, loginUser);

        return "redirect:/workspaces";
    }

    // ==========================================
    // ✨ [추가] 초대 코드 관련 API (비동기 처리용)
    // ==========================================

    /**
     * 📢 [OWNER 전용] 초대 코드 생성 및 재발급 API
     * 화면에서 [초대 코드 생성] 버튼을 클릭할 때 AJAX/Fetch로 호출합니다.
     */
    @PostMapping("/{workspaceId}/invite-code")
    @ResponseBody // HTML 페이지 대신 JSON 데이터를 응답하기 위해 지정
    public ResponseEntity<?> createInviteCode(@PathVariable("workspaceId") Long workspaceId,
                                              @AuthenticationPrincipal CustomUserDetails customUserDetails) {
        
        User loginUser = customUserDetails.getUser();
        log.info("🎫 초대 코드 발급 요청 - 워크스페이스 ID: {}, 요청자: {}", workspaceId, loginUser.getUserId());
        
        try {
            String inviteCode = workspaceService.generateInviteCode(workspaceId, loginUser);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "inviteCode", inviteCode
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            log.warn("⚠️ 초대 코드 발급 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", e.getMessage()
            ));
        }
    }

    /**
     * 🔑 [일반 유저] 초대 코드를 입력하여 워크스페이스 가입 API
     * 워크스페이스 목록 화면에서 [초대 코드 입력] 창에 코드를 적고 제출할 때 호출합니다.
     */
    @PostMapping("/join")
    @ResponseBody // JSON 데이터 응답
    public ResponseEntity<?> joinWorkspace(@RequestBody Map<String, String> requestBody,
                                           @AuthenticationPrincipal CustomUserDetails customUserDetails) {
        
        User loginUser = customUserDetails.getUser();
        String inviteCode = requestBody.get("inviteCode");
        log.info("🔑 초대 코드로 입장 요청 - 코드: {}, 요청자: {}", inviteCode, loginUser.getUserId());
        
        if (inviteCode == null || inviteCode.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "초대 코드를 입력해 주세요."
            ));
        }

        try {
            workspaceService.joinWorkspaceByCode(inviteCode.trim(), loginUser);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "워크스페이스에 방문자(VISITOR) 권한으로 성공적으로 가입되었습니다!"
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            log.warn("⚠️ 워크스페이스 가입 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", e.getMessage()
            ));
        }
    }

    // ==========================================
    // ✨ [추가] 멤버 관리 API (OWNER 전용)
    // ==========================================

    @GetMapping("/{workspaceId}/members")
    @ResponseBody
    public ResponseEntity<?> getMembers(@PathVariable("workspaceId") Long workspaceId,
                                        @AuthenticationPrincipal CustomUserDetails customUserDetails) {
        try {
            List<WorkspaceMember> members = workspaceService.getMembers(workspaceId, customUserDetails.getUser());

            List<Map<String, Object>> result = members.stream().map(m -> {
                Map<String, Object> map = new java.util.HashMap<>();
                map.put("memberId", m.getMemberId());
                map.put("name", m.getUser().getName());
                map.put("username", m.getUser().getUsername());
                map.put("role", m.getRole().name());
                return map;
            }).collect(java.util.stream.Collectors.toList());

            return ResponseEntity.ok(Map.of("success", true, "members", result));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/{workspaceId}/members/{memberId}/kick")
    @ResponseBody
    public ResponseEntity<?> kickMember(@PathVariable("workspaceId") Long workspaceId,
                                        @PathVariable("memberId") Long memberId,
                                        @AuthenticationPrincipal CustomUserDetails customUserDetails) {
        try {
            workspaceService.kickMember(workspaceId, memberId, customUserDetails.getUser());
            return ResponseEntity.ok(Map.of("success", true, "message", "멤버를 퇴출했습니다."));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/{workspaceId}/members/{memberId}/role")
    @ResponseBody
    public ResponseEntity<?> changeMemberRole(@PathVariable("workspaceId") Long workspaceId,
                                            @PathVariable("memberId") Long memberId,
                                            @RequestBody Map<String, String> body,
                                            @AuthenticationPrincipal CustomUserDetails customUserDetails) {
        try {
            WorkspaceRole newRole = WorkspaceRole.valueOf(body.get("role"));
            workspaceService.changeMemberRole(workspaceId, memberId, newRole, customUserDetails.getUser());
            return ResponseEntity.ok(Map.of("success", true, "message", "권한이 변경되었습니다."));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}