package com.project.workspace.interceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.project.user.security.CustomUserDetails;
import com.project.workspace.entity.WorkspaceMember;
import com.project.workspace.enumtype.WorkspaceRole;
import com.project.workspace.repository.WorkspaceMemberRepository;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class WorkspaceAccessInterceptor implements HandlerInterceptor {

    private final WorkspaceMemberRepository workspaceMemberRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {

        Long workspaceId = extractWorkspaceId(request);
        if (workspaceId == null) {
            // /workspaces, /workspaces/create, /workspaces/join 처럼
            // 특정 workspaceId를 대상으로 하지 않는 경로는 통과
            return true;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new AccessDeniedException("로그인이 필요합니다.");
        }

        Long userId = userDetails.getUser().getUserId();

        WorkspaceMember member = workspaceMemberRepository
                .findByWorkspace_WorkspaceIdAndUser_UserId(workspaceId, userId)
                .orElseThrow(() -> new AccessDeniedException("해당 워크스페이스에 대한 접근 권한이 없습니다."));

        // GET(조회)이 아닌 요청은 VISITOR는 차단, MEMBER 이상만 허용
        if (!"GET".equalsIgnoreCase(request.getMethod()) && member.getRole() == WorkspaceRole.VISITOR) {
            throw new AccessDeniedException("읽기 전용 권한입니다. 편집 권한이 없습니다.");
        }

        request.setAttribute("workspaceRole", member.getRole());
        return true;
    }

    private Long extractWorkspaceId(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty()) {
            uri = uri.substring(contextPath.length());
        }

        String[] segments = uri.split("/");
        // "", "workspaces", "{workspaceId 후보}", ...
        if (segments.length < 3 || !"workspaces".equals(segments[1])) {
            return null;
        }

        try {
            return Long.parseLong(segments[2]);
        } catch (NumberFormatException e) {
            return null; // "create", "join" 같은 literal 경로는 무시
        }
    }
}