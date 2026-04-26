package com.saas.core.user;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MembershipRepository extends JpaRepository<Membership, Long> {
    Optional<Membership> findByUserIdAndCompanyIdAndIsActiveTrue(Long userId, Long companyId);
    List<Membership> findByCompanyId(Long companyId);
}

