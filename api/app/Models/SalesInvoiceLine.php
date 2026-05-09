<?php

namespace App\Models;

use App\Traits\HasSyncColumns;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalesInvoiceLine extends Model
{
    use HasFactory, HasSyncColumns, HasUuid;

    protected $fillable = [
        'sales_invoice_id',
        'item_id',
        'batch_id',
        'godown_id',
        'quantity',
        'unit',
        'conversion_factor',
        'rate',
        'discount_percent',
        'taxable_amount',
        'gst_rate',
        'cgst',
        'sgst',
        'igst',
        'line_total',
        'item_variant_id',
        'combo_id',
        'modifiers_total',
        'kot_status',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'conversion_factor' => 'decimal:4',
            'rate' => 'decimal:2',
            'discount_percent' => 'decimal:2',
            'taxable_amount' => 'decimal:2',
            'gst_rate' => 'decimal:2',
            'cgst' => 'decimal:2',
            'sgst' => 'decimal:2',
            'igst' => 'decimal:2',
            'line_total' => 'decimal:2',
            'modifiers_total' => 'decimal:2',
        ];
    }

    public function salesInvoice()
    {
        return $this->belongsTo(SalesInvoice::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    public function godown()
    {
        return $this->belongsTo(Godown::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function variant()
    {
        return $this->belongsTo(ItemVariant::class, 'item_variant_id');
    }

    public function combo()
    {
        return $this->belongsTo(Combo::class);
    }

    public function selectedModifiers()
    {
        return $this->hasMany(SalesInvoiceLineModifier::class, 'sales_invoice_line_id');
    }
}
