<?php

namespace Database\Factories;

use App\Models\Item;
use App\Models\PoLine;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PoLine>
 */
class PoLineFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $quantity = fake()->randomFloat(3, 1, 100);
        $rate = fake()->randomFloat(2, 10, 500);
        $discountPercent = fake()->randomFloat(2, 0, 10);
        $taxableAmount = ($quantity * $rate) * (1 - $discountPercent / 100);
        $gstRate = fake()->randomElement([0, 5, 12, 18, 28]);
        $isInterState = fake()->boolean();

        $cgst = $sgst = $igst = 0;
        if ($isInterState) {
            $igst = $taxableAmount * $gstRate / 100;
        } else {
            $cgst = $sgst = ($taxableAmount * $gstRate / 100) / 2;
        }

        $lineTotal = $taxableAmount + $cgst + $sgst + $igst;

        return [
            'purchase_order_id' => PurchaseOrder::factory(),
            'item_id' => Item::factory(),
            'quantity' => $quantity,
            'rate' => $rate,
            'discount_percent' => $discountPercent,
            'taxable_amount' => $taxableAmount,
            'gst_rate' => $gstRate,
            'cgst' => $cgst,
            'sgst' => $sgst,
            'igst' => $igst,
            'line_total' => $lineTotal,
            'received_quantity' => fake()->randomFloat(3, 0, $quantity),
            'created_by' => User::factory(),
            'updated_by' => null,
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
