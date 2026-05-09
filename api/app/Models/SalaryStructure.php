<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalaryStructure extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid;

    protected $fillable = [
        'company_id',
        'employee_id',
        'effective_from',
        'basic',
        'hra',
        'da',
        'conveyance',
        'medical',
        'special_allowance',
        'professional_tax',
        'tds_amount',
        'custom_components',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'basic' => 'decimal:2',
            'hra' => 'decimal:2',
            'da' => 'decimal:2',
            'conveyance' => 'decimal:2',
            'medical' => 'decimal:2',
            'special_allowance' => 'decimal:2',
            'professional_tax' => 'decimal:2',
            'tds_amount' => 'decimal:2',
            'custom_components' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function getGrossAttribute(): float
    {
        $customEarnings = collect($this->custom_components ?? [])
            ->where('type', 'earning')
            ->sum('amount');

        return (float) $this->basic
            + (float) $this->hra
            + (float) $this->da
            + (float) $this->conveyance
            + (float) $this->medical
            + (float) $this->special_allowance
            + (float) $customEarnings;
    }
}
