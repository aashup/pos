<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class FinancialYear extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, LogsActivity;

    protected $fillable = [
        'company_id',
        'label',
        'start_date',
        'end_date',
        'is_locked',
        'is_current',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'is_locked' => 'boolean',
            'is_current' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function vouchers()
    {
        return $this->hasMany(Voucher::class);
    }
}
