<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Item;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Item>
 */
class ItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $gstRates = [0, 5, 12, 18, 28];
        $units = ['pcs', 'kg', 'gm', 'litre', 'meter', 'box', 'packet'];
        $selectedRate = fake()->randomElement($gstRates);

        return [
            'company_id' => Company::factory(),
            'name' => fake()->words(3, true),
            'sku' => fake()->unique()->regexify('[A-Z]{3}[0-9]{5}'),
            'hsn_code' => fake()->regexify('[0-9]{4}[0-9]{2}[0-9]{2}'),
            'unit' => fake()->randomElement($units),
            'item_group_id' => null,
            'igst' => $selectedRate,
            'sgst' => $selectedRate / 2,
            'cgst' => $selectedRate / 2,
            'mrp' => fake()->randomFloat(2, 10, 1000),
            'purchase_price' => fake()->randomFloat(2, 5, 800),
            'selling_price' => fake()->randomFloat(2, 8, 900),
            'reorder_level' => fake()->numberBetween(5, 50),
            'is_batch_tracked' => fake()->boolean(30),
            'is_active' => true,
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
