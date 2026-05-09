<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentCounter extends Model
{
    use HasUuids;

    protected $table = 'document_counters';

    protected $fillable = [
        'company_id',
        'financial_year_id',
        'document_type',
        'prefix',
        'next_number',
    ];

    protected $casts = [
        'next_number' => 'integer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function financialYear(): BelongsTo
    {
        return $this->belongsTo(FinancialYear::class);
    }

    /**
     * Get and increment counter for a document type.
     * Returns the current value (before increment).
     *
     * @param  string  $documentType  (purchase_order, sales_order, purchase_invoice, sales_invoice, contra, payment, receipt, journal, purchase, sales)
     */
    public static function getAndIncrementCounter(string $companyId, string $fyId, string $documentType): int
    {
        $counter = static::where('company_id', $companyId)
            ->where('financial_year_id', $fyId)
            ->where('document_type', $documentType)
            ->first();

        if (! $counter) {
            throw new \Exception("Document counter not found for {$documentType}");
        }

        $currentValue = $counter->next_number;

        // Increment for next time
        $counter->increment('next_number');

        return $currentValue;
    }

    /**
     * Get prefix stored in database for this counter.
     */
    public function getPrefix(): string
    {
        return $this->prefix ?? '';
    }
}
