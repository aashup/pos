<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class AccountingGroup extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, LogsActivity, SoftDeletes;

    protected $fillable = [
        'company_id',
        'parent_id',
        'code',
        'name',
        'type',
        'system_key',
        'is_system',
        'is_active',
        'balance_type',
    ];

    /**
     * Find a system account by its well-known key for a given company.
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
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function parent()
    {
        return $this->belongsTo(AccountingGroup::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(AccountingGroup::class, 'parent_id');
    }

    public function ledgers()
    {
        return $this->hasMany(Ledger::class, 'group_id');
    }

    /**
     * Get all voucher lines through ledgers in this group.
     */
    public function voucherLines()
    {
        return $this->hasManyThrough(VoucherLine::class, Ledger::class, 'group_id', 'ledger_id');
    }
}
