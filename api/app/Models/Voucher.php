<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Voucher extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, LogsActivity;

    protected $fillable = [
        'company_id',
        'financial_year_id',
        'voucher_number',
        'voucher_date',
        'voucher_type',
        'narration',
        'source',
        'reference_type',
        'reference_id',
        'is_posted',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'voucher_date' => 'datetime',
            'is_posted' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function financialYear()
    {
        return $this->belongsTo(FinancialYear::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lines()
    {
        return $this->hasMany(VoucherLine::class);
    }

    public function reference()
    {
        return $this->morphTo();
    }

    /**
     * Get the prefix for a voucher type.
     * Used to construct the formatted voucher_number (e.g., "PUR-00001").
     *
     * @param  string  $voucherType  (contra, payment, receipt, journal, purchase, sales)
     * @return string (e.g., 'PUR', 'SAL', 'PAY', 'REC', 'JOU', 'CON')
     */
    public static function getTypePrefix(string $voucherType): string
    {
        return match ($voucherType) {
            'purchase' => 'PUR',
            'sales' => 'SAL',
            'payment' => 'PAY',
            'receipt' => 'REC',
            'journal' => 'JOU',
            'contra' => 'CON',
            'payroll' => 'PRL',
            default => 'VOC',
        };
    }
}
