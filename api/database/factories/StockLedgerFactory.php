<?php

namespace Database\Factories;

use App\Models\Batch;
use App\Models\Company;
use App\Models\Godown;
use App\Models\Item;
use App\Models\StockLedger;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockLedger>
 */
class StockLedgerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $type = fake()->randomElement(['in', 'out']);
        $referenceTypes = ['PurchaseInvoice', 'SalesInvoice', 'StockAdjustment', 'OpeningStock'];

        return [
            'company_id' => Company::factory(),
            'item_id' => Item::factory(),
            'batch_id' => function (array $attributes) {
                return Batch::factory()->create(['item_id' => $attributes['item_id']]);
            },
            'godown_id' => Godown::factory(),
            'type' => $type,
            'reference_type' => fake()->randomElement($referenceTypes),
            'reference_id' => fake()->uuid(),
            'quantity' => fake()->randomFloat(3, 1, 100),
            'rate' => fake()->randomFloat(2, 10, 500),
            'value' => fn (array $attributes) => $attributes['quantity'] * $attributes['rate'],
            'narration' => fake()->sentence(),
            'created_by' => User::factory(),
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
