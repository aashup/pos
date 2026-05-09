<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Ledger extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, LogsActivity, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'alias',
        'group_id',
        'opening_balance',
        'opening_type',
        'opening_date',
        'is_bill_wise',
        'is_cost_center_applicable',
        'allow_manual_entry',
        'is_system',
        'system_key',
        'ledgerable_type',
        'ledgerable_id',
        'created_by',
        'updated_by',
    ];

    /**
     * Find a system ledger by its well-known key for a given company.
     */
    public static function findBySystemKey(string $companyId, string $systemKey): ?self
    {
        return static::where('company_id', $companyId)
            ->where('system_key', $systemKey)
            ->first();
    }

    protected function casts(): array
    {
        return [
            'opening_balance' => 'decimal:2',
            'opening_date' => 'date',
            'is_bill_wise' => 'boolean',
            'is_cost_center_applicable' => 'boolean',
            'allow_manual_entry' => 'boolean',
            'is_system' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function group()
    {
        return $this->belongsTo(AccountingGroup::class, 'group_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function ledgerable()
    {
        return $this->morphTo();
    }

    public function voucherLines()
    {
        return $this->hasMany(VoucherLine::class, 'ledger_id');
    }

    public function closingBalances()
    {
        return $this->hasMany(LedgerClosingBalance::class, 'ledger_id');
    }

    public function closingBalanceForFY(string $financialYearId): ?LedgerClosingBalance
    {
        return $this->closingBalances()
            ->where('financial_year_id', $financialYearId)
            ->first();
    }
}
