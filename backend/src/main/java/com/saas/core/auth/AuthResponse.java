package com.saas.core.auth;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private UserDTO user;

    @Data
    @Builder
    public static class UserDTO {
        private Long id;
        private String email;
        private String fullName;
        private boolean isSuperAdmin;
        private List<MembershipDTO> memberships;
    }

    @Data
    @Builder
    public static class MembershipDTO {
        private Long companyId;
        private String companyName;
        private String role;
    }
}
