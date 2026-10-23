package com.flowershop.user.entity;

import com.flowershop.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "addresses")
public class Address extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "receiver_name", nullable = false)
    private String receiverName;

    @Column(name = "receiver_phone", nullable = false)
    private String receiverPhone;

    @Column(name = "address_line", nullable = false)
    private String addressLine;

    private String ward;
    private String district;
    private String city;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault;
}
