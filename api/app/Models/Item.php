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

class Item extends Model
{
    use BelongsToCompany, HasFactory, HasSyncColumns, HasUuid, LogsActivity, SoftDeletes;

    protected $fillable = [
        'company_id',
        'item_group_id',
        'name',
        'sku',
        'hsn_code',
        'unit',
        'igst',
        'sgst',
        'cgst',
        'mrp',
        'purchase_price',
        'selling_price',
        'reorder_level',
        'is_batch_tracked',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'igst' => 'decimal:2',
            'sgst' => 'decimal:2',
            'cgst' => 'decimal:2',
            'mrp' => 'decimal:2',
            'purchase_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'is_batch_tracked' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable();
    }

    public function itemGroup()
    {
        return $this->belongsTo(ItemGroup::class);
    }

    public function batches()
    {
        return $this->hasMany(Batch::class);
    }

    public function stockLedger()
    {
        return $this->hasMany(StockLedger::class);
    }

    public function alternateUnits()
    {
        return $this->hasMany(ItemAlternateUnit::class);
    }
}
