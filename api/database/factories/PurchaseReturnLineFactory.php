<?php

namespace Database\Factories;

use App\Models\Item;
use App\Models\PurchaseReturn;
use Illuminate\Database\Eloquent\Factories\Factory;

class PurchaseReturnLineFactory extends Factory
{
    public function definition(): array
    {
        $quantity = fake()->randomFloat(3, 1, 20);
        $rate = fake()->randomFloat(2, 10, 500);
        $taxableAmount = $quantity * $rate;
        $gstRate = fake()->randomElement([0, 5, 12, 18, 28]);
        $isInterState = fake()->boolean(30);

        $gstAmount = $taxableAmount * $gstRate / 100;

        return [
            'purchase_return_id' => PurchaseReturn::factory(),
            'item_id' => Item::factory(),
            'batch_id' => null,
            'quantity' => $quantity,
            'rate' => $rate,
            'taxable_amount' => $taxableAmount,
            'gst_rate' => $gstRate,
            'cgst' => $isInterState ? 0 : $gstAmount / 2,
            'sgst' => $isInterState ? 0 : $gstAmount / 2,
            'igst' => $isInterState ? $gstAmount : 0,
            'line_total' => $taxableAmount + $gstAmount,
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
