package com.project.user.service;


import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.project.user.dto.UserDTO;
import com.project.user.entity.User;
import com.project.user.repository.UserRepository;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public boolean checkUsername(String username){
        return userRepository.existsByUsername(username);
    }

    public boolean checkEmail(String email){
        return userRepository.existsByEmail(email);
    }

    @Transactional
    public void register(UserDTO userDTO){
        
        if(userRepository.existsByUsername(userDTO.getUsername())){
            throw new IllegalArgumentException("이미 사용중인 아이디입니다.");
        }

        User user = User.builder()
                .username(userDTO.getUsername())
                .password(passwordEncoder.encode(userDTO.getPassword()))
                .name(userDTO.getName())
                .email(userDTO.getEmail())
                .build();
        userRepository.save(user);
    }
}
