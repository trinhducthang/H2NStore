package com.flowershop.delivery.repository;

import com.flowershop.delivery.entity.DeliveryZone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeliveryZoneRepository extends JpaRepository<DeliveryZone, Long> {

    List<DeliveryZone> findByActiveTrueOrderByShippingFeeAscIdAsc();

    List<DeliveryZone> findAllByOrderByIdAsc();
}
