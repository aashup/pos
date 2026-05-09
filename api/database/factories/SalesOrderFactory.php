<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Party;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SalesOrderFactory extends Factory
{
    public function definition(): array
    {
        $soDate = fake()->dateTimeBetween('-3 months', 'now');
        $deliveryDate = clone $soDate;
        $deliveryDate->modify('+1 week');

        $totalAmount = fake()->randomFloat(2, 500, 50000);
        $gstAmount = fake()->randomFloat(2, 50, 5000);

        return [
            'company_id' => Company::factory(),
            'party_id' => Party::factory()->state(['type' => 'customer']),
            'branch_id' => Branch::factory(),
            'so_number' => 'SO-'.fake()->unique()->regexify('[A-Z]{3}[0-9]{6}'),
            'so_date' => $soDate,
            'expected_delivery_date' => $deliveryDate,
            'status' => fake()->randomElement(['draft', 'confirmed', 'partially_delivered', 'delivered', 'cancelled']),
            'total_amount' => $totalAmount,
            'gst_amount' => $gstAmount,
            'grand_total' => $totalAmount + $gstAmount,
            'notes' => fake()->optional()->sentence(),
            'created_by' => User::factory(),
            'updated_by' => null,
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
