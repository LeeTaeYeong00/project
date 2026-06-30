package com.project.user.repository;

import com.project.user.entity.User;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;


public interface UserRepository extends JpaRepository<User, Long> {
    boolean existsByUsername(String username);
    boolean existsByEmail(String Email);
    Optional<User> findByUsername(String username);
}