<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PayrollRun extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, SoftDeletes;

    protected $fillable = [
        'company_id',
        'month',
        'year',
        'working_days',
        'status',
        'total_gross',
        'total_deductions',
        'total_net',
        'total_pf_employer',
        'total_esi_employer',
        'notes',
        'voucher_id',
        'approved_at',
        'approved_by',
    ];

    protected function casts(): array
    {
        return [
            'month' => 'integer',
            'year' => 'integer',
            'working_days' => 'integer',
            'total_gross' => 'decimal:2',
            'total_deductions' => 'decimal:2',
            'total_net' => 'decimal:2',
            'total_pf_employer' => 'decimal:2',
            'total_esi_employer' => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    public function entries()
    {
        return $this->hasMany(PayrollEntry::class);
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function getMonthNameAttribute(): string
    {
        return date('F', mktime(0, 0, 0, $this->month, 1, $this->year));
    }

    public function getPeriodLabelAttribute(): string
    {
        return date('F Y', mktime(0, 0, 0, $this->month, 1, $this->year));
    }
}
