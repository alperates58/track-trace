import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Info, Search } from 'lucide-react';
import { useVirtualizer } from './useVirtualizer';

export interface ProductOption {
  id: string;
  stockCode: string;
  productName: string;
  gtin: string;
  expectedQuantity: number;
  scannedCount: number;
}

interface ProductSelectorProps {
  products: ProductOption[];
  selectedId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  onCloseFocusRestoration?: () => void;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  products,
  selectedId,
  onChange,
  disabled,
  onCloseFocusRestoration
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = products.find(p => p.id === selectedId);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const lowerSearch = search.toLowerCase();
    return products.filter(p => 
      p.productName.toLowerCase().includes(lowerSearch) || 
      p.stockCode.toLowerCase().includes(lowerSearch) ||
      p.gtin.toLowerCase().includes(lowerSearch)
    );
  }, [products, search]);

  const virtualizer = useVirtualizer({
    count: filteredProducts.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 64, // 64px approx height of a 2-line row
    overscan: 5
  });

  // Position dropdown
  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    
    // Ideal max height
    const minHeight = 200;
    const targetHeight = 450;
    
    if (spaceBelow >= targetHeight || spaceBelow > spaceAbove) {
      // Open downwards
      setDropdownStyle({
        top: '100%',
        marginTop: '8px',
        maxHeight: `${Math.max(minHeight, spaceBelow - 10)}px`,
      });
    } else {
      // Open upwards
      setDropdownStyle({
        bottom: '100%',
        marginBottom: '8px',
        maxHeight: `${Math.max(minHeight, spaceAbove - 10)}px`,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      window.addEventListener('resize', updateDropdownPosition);
      window.addEventListener('scroll', updateDropdownPosition, true);
      
      // Focus search input
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);

      // Reset highlight
      const selIdx = filteredProducts.findIndex(p => p.id === selectedId);
      setHighlightedIndex(selIdx >= 0 ? selIdx : 0);

      return () => {
        window.removeEventListener('resize', updateDropdownPosition);
        window.removeEventListener('scroll', updateDropdownPosition, true);
      };
    } else {
      setSearch('');
    }
  }, [isOpen, selectedId, filteredProducts.length, updateDropdownPosition]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (isOpen) {
          setIsOpen(false);
          if (onCloseFocusRestoration) onCloseFocusRestoration();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onCloseFocusRestoration]);

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => {
          const next = Math.min(prev + 1, filteredProducts.length - 1);
          virtualizer.scrollToIndex(next);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          virtualizer.scrollToIndex(next);
          return next;
        });
        break;
      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        virtualizer.scrollToIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightedIndex(filteredProducts.length - 1);
        virtualizer.scrollToIndex(filteredProducts.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredProducts[highlightedIndex]) {
          onChange(filteredProducts[highlightedIndex].id);
          setIsOpen(false);
          if (onCloseFocusRestoration) onCloseFocusRestoration();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        if (onCloseFocusRestoration) onCloseFocusRestoration();
        break;
    }
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    if (onCloseFocusRestoration) onCloseFocusRestoration();
  };

  return (
    <div className="scan-product-selector flex flex-col gap-1 flex-1 min-w-[220px] md:min-w-[320px] relative" ref={containerRef} onKeyDown={handleKeyDown} style={{ zIndex: 10000 }}>
      <label className="text-[10px] font-bold uppercase tracking-wider ml-1 flex items-center gap-1" style={{ color: 'var(--primary)' }}>
        <span>Aktif Ürün</span>
        <div className="group relative flex items-center justify-center">
          <Info className="w-3 h-3 opacity-60" />
        </div>
      </label>

      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`border h-9 px-3 flex items-center justify-between transition-colors ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
        style={{
          borderRadius: 'var(--radius-sm)',
          backgroundColor: disabled ? 'var(--bg-surface-subtle)' : isOpen ? 'var(--primary-light)' : 'var(--input-bg)',
          borderColor: isOpen ? 'var(--primary)' : 'var(--border-subtle)',
          color: 'var(--text-main)'
        }}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
      >
        <div className="flex items-center min-w-0 pr-2 gap-2 flex-1">
          {selectedProduct ? (
            <>
              <span className="text-xs md:text-sm font-semibold truncate flex-1" style={{ color: 'var(--text-main)' }} title={selectedProduct.productName}>
                {selectedProduct.productName}
              </span>
              <span className="text-xs font-mono font-medium shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-surface-subtle)', color: 'var(--text-muted)' }} title={selectedProduct.stockCode}>
                {selectedProduct.stockCode}
              </span>
            </>
          ) : (
            <span className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              {products.length === 0 ? 'Önce sipariş seçin' : '-- Ürün / Stok Kodu Seçin --'}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-blue-500' : 'text-gray-400'}`} />
      </div>

      {isOpen && (
        <div 
          className="absolute left-0 w-full flex flex-col shadow-xl"
          style={{
            ...dropdownStyle,
            zIndex: 10001,
            backgroundColor: 'var(--modal-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <div className="p-2 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
              <input 
                ref={searchInputRef}
                type="text" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ürün adı, GTIN veya stok kodu ara..." 
                className="w-full text-xs font-medium pl-8 pr-3 h-8 focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-main)'
                }}
                aria-autocomplete="list"
              />
            </div>
          </div>
          
          <div 
            ref={listRef}
            className="overflow-y-auto p-1.5 flex-1 relative no-scrollbar"
            role="listbox"
          >
            {filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-xs" style={{ color: 'var(--text-muted)' }}>
                Eşleşen ürün bulunamadı.
              </div>
            ) : (
              <div style={{ height: `${virtualizer.totalSize}px`, width: '100%', position: 'relative' }}>
                {virtualizer.virtualItems.map((virtualRow) => {
                  const product = filteredProducts[virtualRow.index];
                  const isHighlighted = virtualRow.index === highlightedIndex;
                  const isSelected = product.id === selectedId;

                  return (
                    <div
                      key={product.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(product.id)}
                      onMouseEnter={() => setHighlightedIndex(virtualRow.index)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                      className="p-0"
                    >
                      <div 
                        className="h-[56px] mx-0.5 mt-0.5 p-2 border cursor-pointer flex flex-col justify-center transition-colors"
                        style={{
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isSelected ? 'var(--primary-light)' : isHighlighted ? 'var(--bg-surface-subtle)' : 'transparent',
                          borderColor: isSelected ? 'var(--primary)' : isHighlighted ? 'var(--border-subtle)' : 'transparent'
                        }}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-semibold text-xs leading-tight line-clamp-1 break-words flex-1" style={{ color: isSelected ? 'var(--primary)' : 'var(--text-main)' }} title={product.productName}>
                            {product.productName}
                          </span>
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded shrink-0 tabular-nums" style={{ backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-surface-subtle)', color: isSelected ? '#fff' : 'var(--text-muted)' }}>
                            {product.scannedCount} / {product.expectedQuantity}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[11px] font-mono truncate" style={{ color: 'var(--text-muted)' }} title={product.stockCode}>
                            {product.stockCode}
                          </span>
                          <span className="text-[10px] font-mono font-medium" style={{ color: 'var(--text-muted)' }}>
                            {product.gtin}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
