import { useState, useEffect } from 'react';
import type { ServicePackageOption } from '../pos.api';
import { MobileDialogPortal } from '@/features/mobile-common/MobileDialogPortal';
import './UsePackageModal.css';

interface UsePackageModalProps {
  isOpen: boolean;
  packages: ServicePackageOption[];
  onClose: () => void;
  onSelect: (customerPackageId: number, serviceId: number) => void;
}

export function UsePackageModal({
  isOpen,
  packages,
  onClose,
  onSelect,
}: UsePackageModalProps) {
  const [expandedPackages, setExpandedPackages] = useState<Set<number>>(new Set());
  const [selectedService, setSelectedService] = useState<{
    customerPackageId: number;
    serviceId: number;
  } | null>(null);

  // Auto-expand first package if none is expanded
  useEffect(() => {
    if (isOpen && packages.length > 0 && expandedPackages.size === 0) {
      setExpandedPackages(new Set([packages[0].customerPackageId]));
    }
  }, [isOpen, packages, expandedPackages.size]);

  // Reset selection when modal opens with new packages
  useEffect(() => {
    if (isOpen) {
      setSelectedService(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.classList.add('mobile-overlay-open');
    return () => document.body.classList.remove('mobile-overlay-open');
  }, [isOpen]);

  const togglePackage = (customerPackageId: number) => {
    setExpandedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(customerPackageId)) {
        next.delete(customerPackageId);
      } else {
        next.add(customerPackageId);
      }
      return next;
    });
  };

  const selectService = (customerPackageId: number, serviceId: number) => {
    setSelectedService({ customerPackageId, serviceId });
  };

  const handleUsePackage = () => {
    if (selectedService) {
      onSelect(selectedService.customerPackageId, selectedService.serviceId);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <MobileDialogPortal>
    <div
      className="use-package-modal__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="use-package-modal-title"
    >
      <div
        className="use-package-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="use-package-modal__header">
          <h2 id="use-package-modal-title" className="use-package-modal__title">
            Sử dụng gói dịch vụ
          </h2>
          <button
            className="use-package-modal__close"
            onClick={onClose}
            aria-label="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="use-package-modal__body">
          {packages.length === 0 ? (
            <div className="use-package-modal__empty">
              <p>Không có gói dịch vụ nào khả dụng.</p>
            </div>
          ) : (
            packages.map((pkg) => (
              <div
                key={pkg.customerPackageId}
                className={`package-card ${expandedPackages.has(pkg.customerPackageId) ? 'package-card--expanded' : ''}`}
              >
                <button
                  className="package-card__header"
                  onClick={() => togglePackage(pkg.customerPackageId)}
                  aria-expanded={expandedPackages.has(pkg.customerPackageId)}
                >
                  <div className="package-card__info">
                    <span className="package-card__icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M16 3H8l-2 4h12l-2-4z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="package-card__name">{pkg.packageName}</span>
                  </div>
                  <div className="package-card__meta">
                    <span className="package-card__remaining">
                      Còn lại: {pkg.remainingUnits}/{pkg.totalUnits} lượt
                    </span>
                    {pkg.expiresAt && (
                      <span className="package-card__expires">
                        Hết hạn: {formatDate(pkg.expiresAt)}
                      </span>
                    )}
                  </div>
                  <span className="package-card__chevron">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M4 6l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>

                {expandedPackages.has(pkg.customerPackageId) && pkg.services.length > 0 && (
                  <ul className="package-card__services">
                    {pkg.services.map((service) => {
                      const isSelected =
                        selectedService?.customerPackageId === pkg.customerPackageId &&
                        selectedService?.serviceId === service.serviceId;
                      const isAvailable = service.availableUnits > 0;

                      return (
                        <li key={service.serviceId}>
                          <button
                            className={`service-option ${isSelected ? 'service-option--selected' : ''} ${!isAvailable ? 'service-option--disabled' : ''}`}
                            onClick={() => isAvailable && selectService(pkg.customerPackageId, service.serviceId)}
                            disabled={!isAvailable}
                          >
                            <span className="service-option__radio">
                              {isSelected && (
                                <span className="service-option__radio-dot" />
                              )}
                            </span>
                            <span className="service-option__name">{service.serviceName}</span>
                            <span className="service-option__units">
                              {service.availableUnits} lượt
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>

        <footer className="use-package-modal__footer">
          <button
            className="use-package-modal__btn use-package-modal__btn--secondary"
            onClick={onClose}
          >
            Chọn dịch vụ khác
          </button>
          <button
            className="use-package-modal__btn use-package-modal__btn--primary"
            onClick={handleUsePackage}
            disabled={!selectedService}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M13.5 4.5L6 12L2.5 8.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Dùng gói
          </button>
        </footer>
      </div>
    </div>
    </MobileDialogPortal>
  );
}
