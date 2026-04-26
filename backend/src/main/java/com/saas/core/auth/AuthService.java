package com.saas.core.auth;

import com.saas.core.security.CustomUserDetails;
import com.saas.core.security.JwtService;
import com.saas.core.user.User;
import com.saas.core.user.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public AuthService(AuthenticationManager authenticationManager, UserRepository userRepository, JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail()).orElseThrow();
        
        // Reset failed attempts & update login time
        user.setFailedLoginAttempts(0);
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        CustomUserDetails userDetails = new CustomUserDetails(user);
        String jwtToken = jwtService.generateToken(userDetails);
        String refreshToken = UUID.randomUUID().toString(); // Simplification for MVP

        return AuthResponse.builder()
                .accessToken(jwtToken)
                .refreshToken(refreshToken)
                .user(AuthResponse.UserDTO.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .fullName(user.getFullName())
                        .isSuperAdmin(user.isSuperAdmin())
                        .memberships(user.getMemberships().stream().map(m -> 
                                AuthResponse.MembershipDTO.builder()
                                        .companyId(m.getCompany().getId())
                                        .companyName(m.getCompany().getName())
                                        .role(m.getRole())
                                        .build()
                        ).collect(Collectors.toList()))
                        .build())
                .build();
    }
}
