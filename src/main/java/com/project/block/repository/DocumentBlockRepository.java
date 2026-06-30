package com.project.block.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.project.block.entity.DocumentBlock;

public interface DocumentBlockRepository extends JpaRepository<DocumentBlock, Long>{
    
}
