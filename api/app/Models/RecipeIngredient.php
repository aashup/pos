<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class RecipeIngredient extends Model
{
    use HasUuid;

    protected $fillable = [
        'recipe_id',
        'item_id',
        'quantity',
        'unit',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
        ];
    }

    public function recipe()
    {
        return $this->belongsTo(Recipe::class);
    }

    public function stockItem()
    {
        return $this->belongsTo(Item::class, 'item_id');
    }
}
