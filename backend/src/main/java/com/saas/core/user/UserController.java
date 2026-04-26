package com.saas.core.user;

import com.saas.core.user.dto.UserDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/companies/{companyId}/users")
public class UserController {

    private final MembershipRepository membershipRepository;

    public UserController(MembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    @GetMapping
    @PreAuthorize("principal.superAdmin or @tenantAuth.hasAccess(authentication, #companyId, 'COMPANY_ADMIN')")
    public List<UserDto> getUsersByCompany(@PathVariable Long companyId) {
        return membershipRepository.findByCompanyId(companyId).stream().map(membership -> {
            User user = membership.getUser();
            UserDto dto = new UserDto();
            dto.setId(user.getId());
            dto.setEmail(user.getEmail());
            dto.setFullName(user.getFullName());
            dto.setActive(user.isActive());
            dto.setRole(membership.getRole());
            dto.setLastLoginAt(user.getLastLoginAt());
            return dto;
        }).collect(Collectors.toList());
    }
}
