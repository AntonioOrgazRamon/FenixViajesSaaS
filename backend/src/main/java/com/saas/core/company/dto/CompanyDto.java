package com.saas.core.company.dto;

import lombok.Data;

@Data
public class CompanyDto {
    private Long id;
    private String name;
    private String slug;
    private String status;
}
