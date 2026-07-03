package com.project.block.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.project.block.entity.Block;

@Repository
public interface BlockRepository extends JpaRepository<Block, Long>{
    List<Block> findByDocument_DocumentIdOrderBySequenceOrderAsc(Long documentId);
}
