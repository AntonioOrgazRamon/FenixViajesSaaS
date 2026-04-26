package com.saas.core.security;

import com.saas.core.user.MembershipRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component("tenantAuth")
public class TenantSecurityEvaluator {

    private final MembershipRepository membershipRepository;

    public TenantSecurityEvaluator(MembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    public boolean hasAccess(Authentication authentication, Long companyId, String requiredRole) {
        if (authentication == null || !authentication.isAuthenticated()) return false;
        
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof CustomUserDetails)) return false;
        
        CustomUserDetails userDetails = (CustomUserDetails) principal;
        
        if (userDetails.isSuperAdmin()) return true;

        return membershipRepository.findByUserIdAndCompanyIdAndIsActiveTrue(userDetails.getId(), companyId)
            .map(membership -> hasSufficientRole(membership.getRole(), requiredRole))
            .orElse(false);
    }

    private boolean hasSufficientRole(String userRole, String requiredRole) {
        if ("COMPANY_ADMIN".equals(userRole)) return true;
        return userRole.equals(requiredRole);
    }
}
