package com.project.workspace.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.project.document.entity.Document;
import com.project.user.entity.User;
import com.project.workspace.enumtype.WorkspaceRole;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "workspaces")
public class Workspace {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long workspaceId;

    @Column(nullable = false)
    private String workspaceName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "workspace", cascade = CascadeType.REMOVE, orphanRemoval = true)
    private List<WorkspaceMember> members = new ArrayList<>();

    @OneToMany(mappedBy = "workspace", cascade = CascadeType.REMOVE, orphanRemoval = true)
    private List<Document> documents;

    @Column(unique = true)
    private String inviteCode;

    private LocalDateTime inviteCodeExpiresAt;

    public void updateInviteCode(String inviteCode, LocalDateTime expiresAt){
        this.inviteCode = inviteCode;
        this.inviteCodeExpiresAt = expiresAt;
    }

    public boolean checkOwner(Long loginUserId){
        if(this.members == null || loginUserId == null) return false;
        
        return this.members.stream().filter(m -> m != null && m.getUser() != null)
                .filter(m -> loginUserId.equals(m.getUser().getUserId()))
                .findFirst().map(m -> m.getRole() != null && m.getRole() == WorkspaceRole.OWNER).orElse(false);
    }
}
