<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Godown;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Godown>
 */
class GodownFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'branch_id' => Branch::factory(),
            'name' => fake()->words(2, true).' Godown',
            'code' => fake()->regexify('[A-Z]{3}'),
            'address' => fake()->address(),
            'is_default' => false,
            'is_active' => true,
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
