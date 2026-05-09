<?php

namespace Database\Factories;

use App\Models\Batch;
use App\Models\Item;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Batch>
 */
class BatchFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $manufacturingDate = fake()->dateTimeBetween('-1 year', 'now');
        $expiryDate = clone $manufacturingDate;
        $expiryDate->modify('+2 years');

        return [
            'item_id' => Item::factory(),
            'batch_number' => fake()->regexify('[A-Z]{3}[0-9]{6}'),
            'manufacturing_date' => $manufacturingDate,
            'expiry_date' => $expiryDate,
            'purchase_price' => fake()->randomFloat(2, 5, 500),
            'selling_price' => fake()->randomFloat(2, 8, 600),
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
