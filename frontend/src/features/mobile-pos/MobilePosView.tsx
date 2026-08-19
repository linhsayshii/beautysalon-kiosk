import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, formatNumber } from '@/lib/format';
import { getPosCatalog, getPosStaff, type PosReceiptData } from '@/features/pos/pos.api';
import { PosReceiptPrint } from '@/features/pos/components/PosReceiptPrint';
import { MobileCartBottomSheet } from './MobileCartBottomSheet';
import '@/features/mobile-pos/mobile-pos.css';

type CatalogFilter = '' | 'service' | 'package' | 'account_card' | 'product';

interface CatalogItem {
  itemId: number;
  itemType: Exclude<CatalogFilter, ''>;
  code: string;
  name: string;
  category: string;
  unit: string;
  salePrice: number;
  stockQuantity: number | null;
  commissionType: 'percent' | 'fixed' | null;
  commissionRate: number;
}

interface PosLine extends CatalogItem {
  quantity: number;
  staffId: number | null;
}

interface PosCustomer {
  id: number;
  name: string;
  phone?: string;
}

const filterTabs: Array<{ value: CatalogFilter; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'service', label: 'Dịch vụ' },
  { value: 'package', label: 'Gói DV' },
  { value: 'account_card', label: 'Thẻ TK' },
  { value: 'product', label: 'Sản phẩm' },
];

export function MobilePosView() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<CatalogFilter>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [cartLines, setCartLines] = useState<PosLine[]>([]);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartExpanded, setIsCartExpanded] = useState(true);
  const [receiptToPrint, setReceiptToPrint] = useState<PosReceiptData | null>(null);

  // Fetch Pos Catalog
  const { data: catalogResponse, isLoading } = useQuery({
    queryKey: ['pos-catalog', search, activeTab],
    queryFn: () => getPosCatalog(search, activeTab),
  });

  // Fetch staff list
  const { data: staffResponse } = useQuery({
    queryKey: ['pos-staff'],
    queryFn: getPosStaff,
  });
  const staffList = (staffResponse?.data || []) as Array<{ id: number; name: string }>;

  const catalogItems = useMemo(() => {
    return (catalogResponse?.data || []) as unknown as CatalogItem[];
  }, [catalogResponse]);

  // Extract unique subcategories
  const subCategories = useMemo(() => {
    const set = new Set<string>();
    catalogItems.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [catalogItems]);

  // Filter items by subcategory if selected
  const filteredItems = useMemo(() => {
    if (!selectedSubCategory) return catalogItems;
    return catalogItems.filter((item) => item.category === selectedSubCategory);
  }, [catalogItems, selectedSubCategory]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CatalogItem[]> = {};
    filteredItems.forEach((item) => {
      const cat = item.category ? item.category.toUpperCase() : 'KHÁC';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Cart total calculations
  const totalCartCount = useMemo(() => {
    return cartLines.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartLines]);

  const totalCartAmount = useMemo(() => {
    return cartLines.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
  }, [cartLines]);

  const totalCommission = useMemo(() => {
    return cartLines.reduce((sum, line) => {
      if (!line.staffId) return sum;
      if (!line.commissionType || !line.commissionRate) return sum;

      const revenue = line.salePrice * line.quantity;
      let amount = 0;

      if (line.commissionType === 'percent') {
        amount = revenue * line.commissionRate;
      } else {
        amount = line.quantity * line.commissionRate;
      }

      return sum + amount;
    }, 0);
  }, [cartLines]);

  // Add or increment item
  const handleAddItem = (item: CatalogItem) => {
    setCartLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.itemId && l.itemType === item.itemType);
      if (existing) {
        return prev.map((l) =>
          l.itemId === item.itemId && l.itemType === item.itemType
            ? { ...l, quantity: l.quantity + 1 }
            : l
        );
      }
      // Preserve commission data from catalog item
      return [...prev, { ...item, quantity: 1, staffId: null }];
    });
  };

  // Update staff for a line
  const handleUpdateLineStaff = (itemId: number, itemType: string, staffId: number | null) => {
    setCartLines((prev) =>
      prev.map((l) =>
        l.itemId === itemId && l.itemType === itemType
          ? { ...l, staffId }
          : l
      )
    );
  };

  // Update quantity or remove
  const handleUpdateQuantity = (itemId: number, itemType: string, delta: number) => {
    setCartLines((prev) => {
      return prev
        .map((l) => {
          if (l.itemId === itemId && l.itemType === itemType) {
            const newQty = l.quantity + delta;
            return newQty > 0 ? { ...l, quantity: newQty } : null;
          }
          return l;
        })
        .filter(Boolean) as PosLine[];
    });
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'service':
        return 'ph-sparkle';
      case 'package':
        return 'ph-sparkle';
      case 'account_card':
        return 'ph-credit-card';
      case 'product':
        return 'ph-package';
      default:
        return 'ph-sparkle';
    }
  };

  return (
    <div className="mobile-pos-container">
      {/* Sticky Top Controls Cluster */}
      <div className="mobile-pos-sticky-top-controls">
        {/* Top Search & Actions */}
        <div className="mobile-pos-header">
          <div className="mobile-pos-search-wrapper">
            <i className="ph ph-magnifying-glass search-icon" />
            <input
              type="text"
              className="mobile-pos-search-input"
              placeholder="Tìm hàng hóa"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="mobile-pos-search-clear"
                onClick={() => setSearch('')}
                aria-label="Xóa tìm kiếm"
              >
                <i className="ph ph-x" />
              </button>
            )}
          </div>

          <div className="mobile-pos-header-actions">
            <button type="button" className="mobile-pos-icon-btn" title="Chuyển đổi giao diện" aria-label="Chuyển đổi giao diện">
              <i className="ph ph-squares-four" />
            </button>
          </div>
        </div>

        {/* Category Filter Horizontal Tabs */}
        <div className="mobile-pos-category-tabs">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`mobile-pos-tab-pill ${activeTab === tab.value ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab(tab.value);
                setSelectedSubCategory('');
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Subcategory dropdown / pill */}
        <div className="mobile-pos-filter-row">
          <div className="mobile-pos-subcat-select">
            <i className="ph ph-funnel" />
            <select
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
            >
              <option value="">Tất cả nhóm hàng ▼</option>
              {subCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
            {filteredItems.length} mặt hàng
          </span>
        </div>
      </div>

      {/* Grouped Items List */}
      {isLoading ? (
        <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ink-400)' }}>
          Đang tải dữ liệu hàng hóa...
        </div>
      ) : Object.keys(groupedItems).length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-400)' }}>
          <i className="ph ph-magnifying-glass" style={{ fontSize: 32, marginBottom: 8, display: 'inline-block' }} />
          <div>Không tìm thấy mặt hàng nào</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(groupedItems).map(([groupName, items]) => (
            <div key={groupName} className="mobile-pos-group">
              <div className="mobile-pos-group-title">{groupName}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((item) => {
                  const inCart = cartLines.find(
                    (l) => l.itemId === item.itemId && l.itemType === item.itemType
                  );
                  return (
                    <div
                      key={`${item.itemType}-${item.itemId}`}
                      className="mobile-pos-card"
                      onClick={() => handleAddItem(item)}
                    >
                      <div className="mobile-pos-card-left">
                        <div className={`mobile-pos-card-icon is-${item.itemType}`}>
                          <i className={`ph ${getItemIcon(item.itemType)}`} />
                        </div>
                        <div className="mobile-pos-card-info">
                          <div className="mobile-pos-card-name">{item.name}</div>
                          <div className="mobile-pos-card-subtitle">
                            {item.category || item.unit || 'Dịch vụ'} {item.code ? `• ${item.code}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="mobile-pos-card-right">
                        <div className="mobile-pos-card-price">{formatNumber(item.salePrice)}</div>
                        {inCart && (
                          <div className="mobile-pos-card-badge">
                            {inCart.quantity}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collapsible Cart */}
      <div className={`mobile-cart ${isCartExpanded ? 'expanded' : 'collapsed'}`}>
        <button
          className="cart-header"
          onClick={() => setIsCartExpanded(!isCartExpanded)}
        >
          <span className="cart-title">
            <i className="ph ph-shopping-cart-simple" style={{ marginRight: 8 }} />
            Giỏ hàng ({totalCartCount})
          </span>
          <span className="cart-toggle">
            {isCartExpanded ? '▼' : '▲'}
          </span>
        </button>

        {isCartExpanded && (
          <div className="cart-items">
            {cartLines.map((line) => (
              <div key={`${line.itemType}-${line.itemId}`} className="cart-item">
                <div className="item-main">
                  <div className="item-info">
                    <span className="item-name">{line.name}</span>
                    <span className="item-price">{formatMoney(line.salePrice)} x {line.quantity}</span>
                  </div>
                </div>

                <div className="item-meta">
                  <div className="staff-select">
                    <label>NV:</label>
                    <select
                      value={line.staffId ?? ''}
                      onChange={(e) => handleUpdateLineStaff(line.itemId, line.itemType, e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">-- Chọn --</option>
                      {staffList.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="commission-badge">
                    HH: {line.staffId && line.commissionType && line.commissionRate
                      ? formatMoney(Math.round(line.commissionType === 'percent'
                          ? line.salePrice * line.quantity * line.commissionRate
                          : line.quantity * line.commissionRate))
                      : '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Always visible summary */}
        <div className="cart-summary">
          <div className="summary-row">
            <span>Tạm tính:</span>
            <span className="amount">{formatMoney(totalCartAmount)}</span>
          </div>
          <div className="summary-row commission">
            <span>HH dự kiến:</span>
            <span className="amount">{formatMoney(totalCommission)}</span>
          </div>
        </div>

        <button
          className="checkout-btn"
          disabled={cartLines.length === 0}
          onClick={() => setIsCartOpen(true)}
        >
          Thanh toán
        </button>
      </div>

      {/* Cart & Checkout Bottom Sheet */}
      {isCartOpen && (
        <MobileCartBottomSheet
          lines={cartLines}
          customer={customer}
          onSelectCustomer={setCustomer}
          onUpdateQuantity={handleUpdateQuantity}
          onUpdateLineStaff={handleUpdateLineStaff}
          onClose={() => setIsCartOpen(false)}
          onSuccess={(receipt) => {
            setIsCartOpen(false);
            setCartLines([]);
            setCustomer(null);
            setReceiptToPrint(receipt);
          }}
        />
      )}

      {/* Print Receipt Modal */}
      {receiptToPrint && (
        <PosReceiptPrint receipt={receiptToPrint} onClose={() => setReceiptToPrint(null)} />
      )}
    </div>
  );
}
