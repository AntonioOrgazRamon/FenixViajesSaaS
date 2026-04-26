package com.saas.core.company;

import com.saas.core.company.dto.CompanyDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/companies")
public class CompanyController {

    private final CompanyRepository companyRepository;

    public CompanyController(CompanyRepository companyRepository) {
        this.companyRepository = companyRepository;
    }

    @GetMapping
    @PreAuthorize("principal.superAdmin")
    public List<CompanyDto> getAllCompanies() {
        return companyRepository.findAll().stream().map(company -> {
            CompanyDto dto = new CompanyDto();
            dto.setId(company.getId());
            dto.setName(company.getName());
            dto.setSlug(company.getSlug());
            dto.setStatus(company.getStatus());
            return dto;
        }).collect(Collectors.toList());
    }    
}
