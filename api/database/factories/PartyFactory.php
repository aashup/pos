<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Party;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Party>
 */
class PartyFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $type = fake()->randomElement(['vendor', 'customer']);
        $balanceType = fake()->randomElement(['dr', 'cr']);

        return [
            'company_id' => Company::factory(),
            'type' => $type,
            'name' => $type === 'vendor' ? fake()->company() : fake()->name(),
            'gstin' => fake()->optional()->regexify('[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}'),
            'pan' => fake()->optional()->regexify('[A-Z]{5}[0-9]{4}[A-Z]{1}'),
            'address' => fake()->address(),
            'city' => fake()->city(),
            'state' => fake()->state(),
            'state_code' => fake()->regexify('[0-9]{2}'),
            'pincode' => fake('en_IN')->postcode(),
            'phone' => fake()->phoneNumber(),
            'email' => fake()->safeEmail(),
            'contact_person' => fake()->name(),
            'credit_limit' => fake()->randomFloat(2, 0, 100000),
            'opening_balance' => 0.00,
            'balance_type' => $balanceType,
            'is_active' => fake()->boolean(90),
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
