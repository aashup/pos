<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class ComboItem extends Model
{
    use HasUuid;

    protected $fillable = [
        'combo_id',
        'item_id',
        'item_variant_id',
        'quantity',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function combo()
    {
        return $this->belongsTo(Combo::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function variant()
    {
        return $this->belongsTo(ItemVariant::class, 'item_variant_id');
    }
}
