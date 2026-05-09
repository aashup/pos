<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\FinancialYear;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FinancialYear>
 */
class FinancialYearFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startDate = fake()->dateTimeBetween('-1 year', 'now');
        $endDate = clone $startDate;
        $endDate->modify('+1 year -1 day');

        return [
            'company_id' => Company::factory(),
            'label' => $startDate->format('Y').'-'.$endDate->format('y'),
            'start_date' => $startDate,
            'end_date' => $endDate,
            'is_locked' => false,
            'is_current' => fake()->boolean(30),
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
