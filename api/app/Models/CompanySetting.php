<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanySetting extends Model
{
    use HasUuids;

    public const ITEM_UNITS_KEY = 'item_units';

    public const VOUCHERS_INDEX_KEY = 'vouchers_index';

    public const DEFAULT_ITEM_UNITS = [
        ['value' => 'PCS', 'label' => 'Pieces'],
        ['value' => 'KG', 'label' => 'Kilograms'],
        ['value' => 'BOX', 'label' => 'Box'],
        ['value' => 'STRIP', 'label' => 'Strip'],
    ];

    public const DEFAULT_VOUCHERS_INDEX = [
        'contra' => 1,
        'payment' => 1,
        'receipt' => 1,
        'journal' => 1,
        'purchase' => 1,
        'sales' => 1,
    ];

    protected $fillable = ['company_id', 'key', 'value'];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get a setting value for a company.
     */
    public static function getValue(string $companyId, string $key, mixed $default = null): mixed
    {
        $setting = static::where('company_id', $companyId)
            ->where('key', $key)
            ->first();

        return $setting?->value ?? $default;
    }

    /**
     * Set (upsert) a setting value for a company.
     */
    public static function setValue(string $companyId, string $key, mixed $value): static
    {
        if ($key === static::ITEM_UNITS_KEY) {
            $value = json_encode(static::normalizeItemUnits($value), JSON_UNESCAPED_UNICODE);
        }

        return static::updateOrCreate(
            ['company_id' => $companyId, 'key' => $key],
            ['value' => $value]
        );
    }

    /**
     * Get all settings for a company, with structured values normalized for API responses.
     *
     * @return array<string, mixed>
     */
    public static function getFormattedSettings(string $companyId): array
    {
        $settings = static::where('company_id', $companyId)
            ->get()
            ->pluck('value', 'key')
            ->toArray();

        $settings[static::ITEM_UNITS_KEY] = static::getItemUnits($companyId);

        return $settings;
    }

    /**
     * Get the normalized unit options for a company.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function getItemUnits(string $companyId): array
    {
        $rawValue = static::getValue($companyId, static::ITEM_UNITS_KEY);
        $units = static::normalizeItemUnits($rawValue);

        return $units !== [] ? $units : static::DEFAULT_ITEM_UNITS;
    }

    /**
     * Get the unit values that can be stored on item records.
     *
     * @return array<int, string>
     */
    public static function getItemUnitValues(string $companyId): array
    {
        return array_column(static::getItemUnits($companyId), 'value');
    }

    /**
     * Get the current voucher index for a company and voucher type.
     * Returns the next sequential number to be assigned.
     *
     * @param  string  $voucherType  (contra, payment, receipt, journal, purchase, sales)
     */
    public static function getVoucherIndex(string $companyId, string $voucherType): int
    {
        $rawValue = static::getValue($companyId, static::VOUCHERS_INDEX_KEY);
        $indices = static::normalizeVouchersIndex($rawValue);

        return $indices[$voucherType] ?? 1;
    }

    /**
     * Increment and return the next voucher number for a type.
     * Increments the counter in company settings and returns the new value.
     *
     * @param  string  $voucherType  (contra, payment, receipt, journal, purchase, sales)
     */
    public static function getAndIncrementVoucherIndex(string $companyId, string $voucherType): int
    {
        // Get current indices
        $rawValue = static::getValue($companyId, static::VOUCHERS_INDEX_KEY);
        $indices = static::normalizeVouchersIndex($rawValue);

        // Get current value for this type
        $currentValue = $indices[$voucherType] ?? 1;

        // Increment for next time
        $indices[$voucherType] = $currentValue + 1;

        // Store updated indices
        static::setValue($companyId, static::VOUCHERS_INDEX_KEY, json_encode($indices, JSON_UNESCAPED_UNICODE));

        // Return the current (now-used) value
        return $currentValue;
    }

    /**
     * Normalize raw voucher index data.
     *
     * @return array<string, int>
     */
    public static function normalizeVouchersIndex(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        if (! is_array($value)) {
            return static::DEFAULT_VOUCHERS_INDEX;
        }

        // Merge with defaults to ensure all keys exist
        return array_merge(static::DEFAULT_VOUCHERS_INDEX, array_filter($value, fn ($v) => is_int($v)));
    }

    /**
     * Normalize raw company setting data into stable item unit options.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function normalizeItemUnits(mixed $units): array
    {
        if (is_string($units)) {
            $decoded = json_decode($units, true);
            $units = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        if (! is_array($units)) {
            return [];
        }

        $normalized = [];

        foreach ($units as $unit) {
            $value = null;
            $label = null;

            if (is_string($unit)) {
                $value = trim($unit);
                $label = trim($unit);
            } elseif (is_array($unit)) {
                $value = trim((string) ($unit['value'] ?? ''));
                $label = trim((string) ($unit['label'] ?? ''));
            }

            if ($value === null || $value === '') {
                continue;
            }

            $value = strtoupper($value);
            $label = $label !== null && $label !== '' ? $label : $value;

            $normalized[$value] = [
                'value' => $value,
                'label' => $label,
            ];
        }

        return array_values($normalized);
    }
}
