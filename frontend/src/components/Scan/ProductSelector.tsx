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
    <div className="flex flex-col gap-1 flex-1 min-w-[200px] md:min-w-[300px] relative" ref={containerRef} onKeyDown={handleKeyDown} style={{ zIndex: 10000 }}>
      <label className="text-[10px] font-bold text-blue-500 uppercase tracking-wider ml-1 flex items-center gap-1">
        <span>Aktif Ürün</span>
        <div className="group relative flex items-center justify-center">
          <Info className="w-3 h-3 text-blue-400" />
        </div>
      </label>

      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`border-2 rounded-lg p-2 flex items-center justify-between transition-colors ${
          disabled ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-70' :
          isOpen ? 'bg-blue-50 border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.2)] cursor-pointer' : 
          'bg-white border-gray-300 hover:border-blue-400 cursor-pointer'
        }`}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
      >
        <div className="flex flex-col min-w-0 pr-4">
          {selectedProduct ? (
            <>
              <span className="text-base font-bold text-blue-900 line-clamp-2 break-words whitespace-normal" title={selectedProduct.productName}>
                {selectedProduct.productName}
              </span>
              <span className="text-xs text-blue-600 font-medium truncate" title={selectedProduct.stockCode}>
                {selectedProduct.stockCode}
              </span>
            </>
          ) : (
            <span className="text-base font-medium text-gray-400">
              {products.length === 0 ? 'Önce sipariş seçin' : '-- ÜRÜN / STOK KODU SEÇİN --'}
            </span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180 text-blue-500' : 'text-gray-400'}`} />
      </div>

      {isOpen && (
        <div 
          className="absolute left-0 w-full bg-white border border-blue-200 rounded-xl shadow-xl z-50 flex flex-col"
          style={{ ...dropdownStyle, zIndex: 10001 }}
        >
          <div className="p-2 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                ref={searchInputRef}
                type="text" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ürün adı, gtin veya kod ara..." 
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                aria-autocomplete="list"
              />
            </div>
          </div>
          
          <div 
            ref={listRef}
            className="overflow-y-auto p-2 flex-1 relative no-scrollbar"
            role="listbox"
          >
            {filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm text-gray-500">
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
                      className={`p-0`}
                    >
                      <div className={`
                        h-[56px] mx-1 mt-1 p-2 border rounded-lg cursor-pointer flex flex-col justify-center
                        ${isSelected ? 'bg-blue-50 border-blue-200' : 
                          isHighlighted ? 'bg-gray-50 border-gray-300' : 'bg-transparent border-transparent hover:bg-gray-50'
                        }
                      `}>
                        <div className="flex justify-between items-start gap-2">
                          <span className={`font-bold text-sm leading-tight line-clamp-2 break-words whitespace-normal flex-1 ${isSelected ? 'text-blue-900' : 'text-gray-800'}`} title={product.productName}>
                            {product.productName}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                            {product.scannedCount} / {product.expectedQuantity}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-0.5">
                          <span className={`text-xs font-mono truncate ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} title={product.stockCode}>
                            {product.stockCode}
                          </span>
                          <span className={`text-[10px] font-semibold ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
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
