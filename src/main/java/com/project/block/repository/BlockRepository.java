package com.project.block.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.project.block.entity.Block;

@Repository
public interface BlockRepository extends JpaRepository<Block, Long>{
    List<Block> findByDocument_DocumentIdOrderBySequenceOrderAsc(Long documentId);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Block b SET b.sequenceOrder = :sequenceOrder WHERE b.blockId = :blockId")
    void updateSequenceOrder(@Param("blockId") Long blockId, @Param("sequenceOrder") Integer sequenceOrder);
}
