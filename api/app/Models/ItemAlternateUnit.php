<?php

namespace App\Models;

use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemAlternateUnit extends Model
{
    use HasFactory, HasSyncColumns, HasUuid, SoftDeletes;

    protected $table = 'item_alternate_units';

    protected $fillable = [
        'item_id',
        'unit',
        'conversion_factor',
        'selling_price',
        'is_default_purchase',
        'is_default_sale',
    ];

    protected function casts(): array
    {
        return [
            'conversion_factor' => 'decimal:4',
            'selling_price' => 'decimal:2',
            'is_default_purchase' => 'boolean',
            'is_default_sale' => 'boolean',
        ];
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
