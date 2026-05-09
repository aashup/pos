<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

class AccountingGroupFactory extends Factory
{
    public function definition(): array
    {
        $types = ['asset', 'liability', 'equity', 'income', 'expense'];
        $type = fake()->randomElement($types);

        return [
            'company_id' => Company::factory(),
            'parent_id' => null,
            'code' => fake()->unique()->regexify('[1-9][0-9]{3}'),
            'name' => fake()->words(3, true),
            'type' => $type,
            'is_system' => false,
            'is_active' => true,
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
