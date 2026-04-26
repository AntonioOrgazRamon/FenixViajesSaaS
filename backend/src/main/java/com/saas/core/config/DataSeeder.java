package com.saas.core.config;

import com.saas.core.company.Company;
import com.saas.core.company.CompanyRepository;
import com.saas.core.user.Membership;
import com.saas.core.user.MembershipRepository;
import com.saas.core.user.User;
import com.saas.core.user.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final MembershipRepository membershipRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository, CompanyRepository companyRepository, 
                      MembershipRepository membershipRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.membershipRepository = membershipRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            // 1. Crear Empresa
            Company nakedcode = new Company();
            nakedcode.setName("NakedCode");
            nakedcode.setSlug("nakedcode");
            companyRepository.save(nakedcode);

            // 2. Crear Usuario Normal (toni)
            User toni = new User();
            toni.setEmail("toni@nakedcode.com");
            toni.setFullName("Toni");
            toni.setPasswordHash(passwordEncoder.encode("tonitoni"));
            userRepository.save(toni);

            Membership m1 = new Membership();
            m1.setUser(toni);
            m1.setCompany(nakedcode);
            m1.setRole("USER");
            membershipRepository.save(m1);

            // 3. Crear Admin de Empresa (antonio)
            User antonio = new User();
            antonio.setEmail("antonio@nakedcode.com");
            antonio.setFullName("Antonio");
            antonio.setPasswordHash(passwordEncoder.encode("antonioantonio"));
            userRepository.save(antonio);

            Membership m2 = new Membership();
            m2.setUser(antonio);
            m2.setCompany(nakedcode);
            m2.setRole("COMPANY_ADMIN");
            membershipRepository.save(m2);

            // 4. Crear Super Admin (cebollita)
            User cebollita = new User();
            cebollita.setEmail("cebollita@admin.com");
            cebollita.setFullName("Cebollita Admin");
            cebollita.setPasswordHash(passwordEncoder.encode("Yonimelabo76"));
            cebollita.setSuperAdmin(true);
            userRepository.save(cebollita);

            System.out.println("=========================================================");
            System.out.println("DATOS INICIALES CREADOS CON ÉXITO");
            System.out.println("Empresa: NakedCode");
            System.out.println("User: toni@nakedcode.com / tonitoni");
            System.out.println("Company Admin: antonio@nakedcode.com / antonioantonio");
            System.out.println("Super Admin: cebollita@admin.com / Yonimelabo76");
            System.out.println("=========================================================");
        }
    }
}
