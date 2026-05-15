import { cn } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import type { PaginatedResponse } from '../../types';

export interface SlideSelectOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface SlideSelectProps {
  name: string;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  panelTitle?: string;

  // Static data source
  options?: SlideSelectOption[];

  // API data source
  queryKey?: string[];
  queryFn?: (params: Record<string, string>) => Promise<{ data: PaginatedResponse<any> }>;
  mapFn?: (item: any) => SlideSelectOption;

  // Controlled value
  value?: string;
  displayValue?: string;
  onChange?: (value: string, option: SlideSelectOption | null) => void;

  // Add New callback
  onAddNew?: () => void;
  addNewLabel?: string;
}

export function SlideSelect({
  label,
  placeholder = 'Select...',
  error,
  disabled,
  className,
  panelTitle = 'Select',
  options,
  queryKey,
  queryFn,
  mapFn,
  value,
  displayValue,
  onChange,
  onAddNew,
  addNewLabel = 'Add New',
}: SlideSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedLabel, setSelectedLabel] = useState(displayValue ?? '');

  const triggerInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [isFocused, setIsFocused] = useState(false);

  const isApiMode = Boolean(queryKey && queryFn && mapFn);

  // --- API mode: fetch all data once (no search/page params) ---
  const { data: apiData, isLoading, isError, refetch } = useQuery({
    queryKey: [...(queryKey ?? []), 'slide-select-all'],
    queryFn: () => queryFn!({ per_page: '500' }),
    enabled: isOpen && isApiMode,
    select: (res) => res.data,
    staleTime: 30_000,
  });

  // Map all API data to options once
  const allApiOptions = useMemo(
    () => mapFn ? (apiData?.data ?? []).map(mapFn).sort((a, b) => a.label.localeCompare(b.label)) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiData?.data, mapFn]
  );

  // --- Client-side filtering (works for both static and API modes) ---
  const filterOptions = useCallback((items: SlideSelectOption[], query: string) => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (o) => o.label.toLowerCase().includes(q) || o.subtitle?.toLowerCase().includes(q)
    );
  }, []);

  const currentOptions = useMemo(() => {
    const source = isApiMode ? allApiOptions : (options ?? []);
    return filterOptions(source, search);
  }, [isApiMode, allApiOptions, options, search, filterOptions]);

  // --- Resolve selected label ---
  useEffect(() => {
    if (displayValue !== undefined) {
      setSelectedLabel(displayValue);
      return;
    }
    if (!value) {
      setSelectedLabel('');
      return;
    }
    if (options) {
      const found = options.find((o) => o.value === value);
      setSelectedLabel(found?.label ?? '');
    }
  }, [value, displayValue, options]);

  // Also update label when API options load and we have a value
  useEffect(() => {
    if (isApiMode && value && allApiOptions.length > 0 && !selectedLabel) {
      const found = allApiOptions.find((o) => o.value === value);
      if (found) setSelectedLabel(found.label);
    }
  }, [isApiMode, value, allApiOptions, selectedLabel]);

  // --- Reset highlight on search change ---
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // --- Body scroll lock ---
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // --- Open / Close ---
  const open = useCallback(() => {
    if (disabled) return;
    if (isOpen) return;
    setSearch('');
    setHighlightedIndex(0);
    setIsOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });
  }, [disabled, isOpen]);

  const close = useCallback(() => {
    setIsAnimating(false);
    setIsFocused(false);
    setTimeout(() => {
      setIsOpen(false);
      setSearch('');
    }, 300);
  }, []);

  // --- Selection ---
  const selectOption = useCallback(
    (option: SlideSelectOption) => {
      setSelectedLabel(option.label);
      onChange?.(option.value, option);
      close();
    },
    [onChange, close]
  );

  const clearSelection = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedLabel('');
      onChange?.('', null);
    },
    [onChange]
  );

  // --- Scroll highlighted into view ---
  useEffect(() => {
    const el = itemRefs.current.get(highlightedIndex);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // --- Keyboard navigation ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const len = currentOptions.length;
      if (!len && e.key !== 'Escape') return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < len - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : len - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < len) {
            selectOption(currentOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [currentOptions, highlightedIndex, selectOption, close]
  );

  // --- Spinner ---
  const Spinner = () => (
    <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      {/* Trigger — acts as both display and search input */}
      <div className="relative">
        <input
          ref={triggerInputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={isFocused || isOpen ? search : selectedLabel || ''}
          onFocus={() => {
            setIsFocused(true);
            setSearch('');
            open();
          }}
          onBlur={() => {
            // Delay to allow panel click events to fire
            setTimeout(() => {
              if (!isOpen) {
                setIsFocused(false);
                setSearch('');
              }
            }, 150);
          }}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) open();
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'block w-full rounded-lg border px-3 py-2 pr-16 text-sm shadow-sm text-left transition-colors',
            'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
            'hover:border-gray-400 dark:hover:border-gray-500',
            'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500'
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && selectedLabel && (
            <span
              role="button"
              tabIndex={-1}
              onClick={clearSelection}
              className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Slide Panel (portal) */}
      {isOpen &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className={cn(
                'fixed inset-0 z-50 transition-opacity duration-300',
                isAnimating ? 'opacity-100' : 'opacity-0'
              )}
              onClick={close}
            />

            {/* Panel */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label={panelTitle}
              onKeyDown={handleKeyDown}
              className={cn(
                'fixed inset-y-0 right-0 z-50 flex w-80 sm:w-96 flex-col',
                'bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl',
                'transform transition-transform duration-300 ease-in-out',
                isAnimating ? 'translate-x-0' : 'translate-x-full'
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {panelTitle}
                </h3>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Add New */}
              {onAddNew && (
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => { close(); setTimeout(() => onAddNew(), 320); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    {addNewLabel}
                  </button>
                </div>
              )}

              {/* List */}
              <div ref={listRef} className="flex-1 overflow-y-auto">
                {isLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Spinner />
                  </div>
                )}

                {isError && (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <p className="text-sm text-red-500 dark:text-red-400 mb-3">
                      Failed to load data
                    </p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!isLoading && !isError && currentOptions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <Search className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No results found</p>
                  </div>
                )}

                {!isLoading &&
                  !isError &&
                  currentOptions.map((option, index) => (
                    <button
                      key={option.value}
                      ref={(el) => {
                        if (el) itemRefs.current.set(index, el);
                        else itemRefs.current.delete(index);
                      }}
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      onClick={() => selectOption(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors',
                        index === highlightedIndex && 'bg-primary-50 dark:bg-primary-900/20',
                        option.value === value &&
                          'bg-primary-100 dark:bg-primary-900/40 font-medium',
                        index !== highlightedIndex &&
                          option.value !== value &&
                          'hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                    >
                      <div className="text-sm text-gray-900 dark:text-gray-100">{option.label}</div>
                      {option.subtitle && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {option.subtitle}
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
