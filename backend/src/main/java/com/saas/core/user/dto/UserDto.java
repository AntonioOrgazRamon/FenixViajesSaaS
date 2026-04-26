package com.saas.core.user.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class UserDto {
    private Long id;
    private String email;
    private String fullName;
    private boolean isActive;
    private String role; // Role in the specific company context
    private LocalDateTime lastLoginAt;
}
