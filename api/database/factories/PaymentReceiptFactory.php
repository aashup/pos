<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Party;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PaymentReceiptFactory extends Factory
{
    public function definition(): array
    {
        $type = fake()->randomElement(['payment', 'receipt']);

        return [
            'company_id' => Company::factory(),
            'party_id' => Party::factory(),
            'type' => $type,
            'receipt_number' => ($type === 'payment' ? 'PAY-' : 'RCT-').fake()->unique()->regexify('[0-9]{6}'),
            'receipt_date' => fake()->dateTimeBetween('-3 months', 'now'),
            'amount' => fake()->randomFloat(2, 100, 50000),
            'payment_mode' => fake()->randomElement(['cash', 'bank', 'cheque', 'upi', 'other']),
            'reference_number' => fake()->optional()->regexify('[A-Z0-9]{10}'),
            'bank_name' => fake()->optional()->randomElement(['SBI', 'HDFC', 'ICICI', 'Axis', 'PNB']),
            'notes' => fake()->optional()->sentence(),
            'created_by' => User::factory(),
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }

    public function payment(): static
    {
        return $this->state(['type' => 'payment']);
    }

    public function receipt(): static
    {
        return $this->state(['type' => 'receipt']);
    }
}
