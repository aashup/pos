<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Party;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseOrder>
 */
class PurchaseOrderFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $poDate = fake()->dateTimeBetween('-3 months', 'now');
        $expectedDeliveryDate = clone $poDate;
        $expectedDeliveryDate->modify('+2 weeks');

        return [
            'company_id' => Company::factory(),
            'party_id' => Party::factory()->create(['type' => 'vendor']),
            'branch_id' => Branch::factory(),
            'po_number' => 'PO-'.fake()->unique()->regexify('[A-Z]{3}[0-9]{6}'),
            'po_date' => $poDate,
            'expected_delivery_date' => $expectedDeliveryDate,
            'status' => fake()->randomElement(['draft', 'approved', 'partially_received', 'completed', 'cancelled']),
            'total_amount' => fake()->randomFloat(2, 1000, 50000),
            'gst_amount' => fake()->randomFloat(2, 100, 5000),
            'grand_total' => fn (array $attributes) => $attributes['total_amount'] + $attributes['gst_amount'],
            'notes' => fake()->sentence(),
            'created_by' => User::factory(),
            'updated_by' => null,
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
