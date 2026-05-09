<?php

namespace Database\Factories;

use App\Models\Item;
use App\Models\PurchaseInvoice;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PurchaseInvoiceLineFactory extends Factory
{
    public function definition(): array
    {
        $quantity = fake()->randomFloat(3, 1, 100);
        $rate = fake()->randomFloat(2, 10, 1000);
        $discountPercent = fake()->randomFloat(2, 0, 10);
        $taxableAmount = ($quantity * $rate) * (1 - $discountPercent / 100);
        $gstRate = fake()->randomElement([0, 5, 12, 18, 28]);
        $isInterState = fake()->boolean(30);

        $gstAmount = $taxableAmount * $gstRate / 100;
        $cgst = $isInterState ? 0 : $gstAmount / 2;
        $sgst = $isInterState ? 0 : $gstAmount / 2;
        $igst = $isInterState ? $gstAmount : 0;

        return [
            'purchase_invoice_id' => PurchaseInvoice::factory(),
            'item_id' => Item::factory(),
            'batch_id' => null,
            'quantity' => $quantity,
            'rate' => $rate,
            'discount_percent' => $discountPercent,
            'taxable_amount' => $taxableAmount,
            'gst_rate' => $gstRate,
            'cgst' => $cgst,
            'sgst' => $sgst,
            'igst' => $igst,
            'line_total' => $taxableAmount + $gstAmount,
            'created_by' => User::factory(),
            'updated_by' => null,
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
