<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Branch>
 */
class BranchFactory extends Factory
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
            'name' => fake()->city().' Branch',
            'code' => fake()->regexify('[A-Z]{3}'),
            'address' => fake()->address(),
            'city' => fake()->city(),
            'state' => fake()->state(),
            'state_code' => fake()->regexify('[0-9]{2}'),
            'is_active' => fake()->boolean(90),
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
