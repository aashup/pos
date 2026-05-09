<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\FinancialYear;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class VoucherFactory extends Factory
{
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'financial_year_id' => FinancialYear::factory(),
            'voucher_number' => 'JV-'.fake()->unique()->regexify('[0-9]{6}'),
            'voucher_date' => fake()->dateTimeBetween('-3 months', 'now'),
            'voucher_type' => fake()->randomElement(['purchase', 'sales', 'payment', 'receipt', 'journal', 'contra']),
            'narration' => fake()->sentence(),
            'source' => fake()->randomElement(['manual', 'auto']),
            'reference_type' => null,
            'reference_id' => null,
            'is_posted' => fake()->boolean(80),
            'created_by' => User::factory(),
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }

    public function posted(): static
    {
        return $this->state(['is_posted' => true]);
    }

    public function manual(): static
    {
        return $this->state(['source' => 'manual', 'voucher_type' => 'journal']);
    }
}
