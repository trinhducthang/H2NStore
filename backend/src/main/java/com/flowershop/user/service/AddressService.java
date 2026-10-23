package com.flowershop.user.service;

import com.flowershop.common.exception.BusinessException;
import com.flowershop.common.exception.ErrorCode;
import com.flowershop.common.util.PhoneUtils;
import com.flowershop.user.dto.UserDtos.AddressRequest;
import com.flowershop.user.dto.UserDtos.AddressResponse;
import com.flowershop.user.entity.Address;
import com.flowershop.user.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AddressService {

    private static final int MAX_ADDRESSES = 20;

    private final AddressRepository addressRepository;

    @Transactional(readOnly = true)
    public List<AddressResponse> list(Long userId) {
        return addressRepository.findByUserIdOrderByIsDefaultDescIdDesc(userId).stream()
                .map(AddressResponse::from).toList();
    }

    @Transactional
    public AddressResponse create(Long userId, AddressRequest req) {
        long count = addressRepository.countByUserId(userId);
        if (count >= MAX_ADDRESSES) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Sổ địa chỉ tối đa " + MAX_ADDRESSES + " địa chỉ");
        }
        // Địa chỉ đầu tiên luôn là mặc định
        boolean makeDefault = req.isDefault() || count == 0;
        if (makeDefault) {
            addressRepository.clearDefault(userId);
        }
        Address address = new Address();
        address.setUserId(userId);
        apply(address, req);
        address.setDefault(makeDefault);
        return AddressResponse.from(addressRepository.save(address));
    }

    @Transactional
    public AddressResponse update(Long userId, Long id, AddressRequest req) {
        if (req.isDefault()) {
            addressRepository.clearDefault(userId);
        }
        Address address = get(userId, id);
        apply(address, req);
        if (req.isDefault()) {
            address.setDefault(true);
        }
        return AddressResponse.from(addressRepository.save(address));
    }

    @Transactional
    public void delete(Long userId, Long id) {
        Address address = get(userId, id);
        addressRepository.delete(address);
        if (address.isDefault()) {
            addressRepository.flush();
            addressRepository.findByUserIdOrderByIsDefaultDescIdDesc(userId).stream().findFirst()
                    .ifPresent(a -> a.setDefault(true));
        }
    }

    private Address get(Long userId, Long id) {
        return addressRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> BusinessException.notFound("địa chỉ"));
    }

    private static void apply(Address address, AddressRequest req) {
        address.setReceiverName(req.receiverName());
        address.setReceiverPhone(PhoneUtils.normalize(req.receiverPhone()));
        address.setAddressLine(req.addressLine());
        address.setWard(req.ward());
        address.setDistrict(req.district());
        address.setCity(req.city());
    }
}
