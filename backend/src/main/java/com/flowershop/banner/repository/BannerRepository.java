package com.flowershop.banner.repository;

import com.flowershop.banner.entity.Banner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BannerRepository extends JpaRepository<Banner, Long> {

    List<Banner> findAllByOrderBySortOrderAscIdAsc();

    List<Banner> findByActiveTrueAndImageUrlIsNotNullOrderBySortOrderAscIdAsc();
}
