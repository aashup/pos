<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class LedgerClosingBalance extends Model
{
    use HasUuid;

    protected $fillable = [
        'company_id',
        'financial_year_id',
        'ledger_id',
        'closing_balance',
        'balance_type',
    ];

    protected function casts(): array
    {
        return [
            'closing_balance' => 'decimal:2',
        ];
    }

    public function financialYear()
    {
        return $this->belongsTo(FinancialYear::class);
    }

    public function ledger()
    {
        return $this->belongsTo(Ledger::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
