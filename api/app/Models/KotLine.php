<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class KotLine extends Model
{
    use HasUuid;

    protected $table = 'kot_lines';

    protected $fillable = [
        'kot_id',
        'item_id',
        'item_name',
        'variant_name',
        'quantity',
        'notes',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
        ];
    }

    public function kot()
    {
        return $this->belongsTo(KitchenOrderTicket::class, 'kot_id');
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
