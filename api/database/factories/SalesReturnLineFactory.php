<?php

namespace Database\Factories;

use App\Models\Item;
use App\Models\SalesReturn;
use Illuminate\Database\Eloquent\Factories\Factory;

class SalesReturnLineFactory extends Factory
{
    public function definition(): array
    {
        $quantity = fake()->randomFloat(3, 1, 10);
        $rate = fake()->randomFloat(2, 20, 1000);
        $taxableAmount = $quantity * $rate;
        $gstRate = fake()->randomElement([0, 5, 12, 18, 28]);
        $isInterState = fake()->boolean(30);

        $gstAmount = $taxableAmount * $gstRate / 100;

        return [
            'sales_return_id' => SalesReturn::factory(),
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
