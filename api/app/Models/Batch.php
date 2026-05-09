<?php

namespace App\Models;

use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Batch extends Model
{
    use HasFactory, HasSyncColumns, HasUuid, LogsActivity;

    protected $fillable = [
        'item_id',
        'batch_number',
        'manufacturing_date',
        'expiry_date',
        'purchase_price',
        'selling_price',
    ];

    protected function casts(): array
    {
        return [
            'manufacturing_date' => 'date',
            'expiry_date' => 'date',
            'purchase_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function stockLedger()
    {
        return $this->hasMany(StockLedger::class);
    }
}
