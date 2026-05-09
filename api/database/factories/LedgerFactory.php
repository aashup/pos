<?php

namespace Database\Factories;

use App\Models\AccountingGroup;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LedgerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name' => fake()->words(3, true),
            'alias' => fake()->optional(0.3)->word(),
            'group_id' => AccountingGroup::factory(),
            'opening_balance' => 0.00,
            'opening_type' => fake()->randomElement(['dr', 'cr']),
            'opening_date' => fake()->optional(0.5)->date(),
            'is_bill_wise' => fake()->boolean(20),
            'is_cost_center_applicable' => fake()->boolean(10),
            'allow_manual_entry' => true,
            'is_system' => false,
            'created_by' => User::factory(),
            'updated_by' => User::factory(),
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
