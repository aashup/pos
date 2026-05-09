<?php

namespace App\Models;

use App\Models\FinancialYear;
use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class SalesOrder extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, LogsActivity, SoftDeletes;

    protected $fillable = [
        'company_id',
        'financial_year_id',
        'party_id',
        'branch_id',
        'so_number',
        'so_date',
        'expected_delivery_date',
        'status',
        'total_amount',
        'gst_amount',
        'grand_total',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'so_date' => 'datetime',
            'expected_delivery_date' => 'date',
            'total_amount' => 'decimal:2',
            'gst_amount' => 'decimal:2',
            'grand_total' => 'decimal:2',
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

    public function party()
    {
        return $this->belongsTo(Party::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function lines()
    {
        return $this->hasMany(SoLine::class);
    }

    public function salesInvoices()
    {
        return $this->hasMany(SalesInvoice::class);
    }
}
