<?php

namespace App\Models;

use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemVariant extends Model
{
    use HasSyncColumns, HasUuid, SoftDeletes;

    protected $fillable = [
        'item_id',
        'name',
        'price_override',
        'sku',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price_override' => 'decimal:2',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function media()
    {
        return $this->hasMany(Media::class, 'entity_id')
            ->where('entity_type', 'item_variant')
            ->orderBy('sort_order');
    }
}
