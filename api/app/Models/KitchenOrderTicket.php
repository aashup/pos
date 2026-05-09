<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class KitchenOrderTicket extends Model
{
    use BelongsToCompany, HasSyncColumns, HasUuid, LogsActivity, SoftDeletes;

    protected $table = 'kots';

    protected $fillable = [
        'company_id',
        'sales_invoice_id',
        'order_session_id',
        'kot_number',
        'status',
        'notes',
        'print_count',
    ];

    protected function casts(): array
    {
        return [
            'print_count' => 'integer',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function invoice()
    {
        return $this->belongsTo(SalesInvoice::class, 'sales_invoice_id');
    }

    public function lines()
    {
        return $this->hasMany(KotLine::class, 'kot_id');
    }

    public function isAllReady(): bool
    {
        return $this->lines()->where('status', '!=', 'ready')->doesntExist();
    }
}
