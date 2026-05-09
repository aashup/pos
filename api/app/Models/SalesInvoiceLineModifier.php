<?php

namespace App\Models;

use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SalesInvoiceLineModifier extends Model
{
    use HasSyncColumns, HasUuid;

    protected $fillable = [
        'sales_invoice_line_id',
        'modifier_id',
        'modifier_name',
        'price_at_time',
    ];

    protected function casts(): array
    {
        return [
            'price_at_time' => 'decimal:2',
        ];
    }

    public function line()
    {
        return $this->belongsTo(SalesInvoiceLine::class, 'sales_invoice_line_id');
    }

    public function modifier()
    {
        return $this->belongsTo(Modifier::class);
    }
}
