<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Party;
use App\Models\PurchaseInvoice;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PurchaseReturnFactory extends Factory
{
    public function definition(): array
    {
        $totalAmount = fake()->randomFloat(2, 500, 20000);
        $gstAmount = $totalAmount * fake()->randomElement([5, 12, 18, 28]) / 100;

        return [
            'company_id' => Company::factory(),
            'purchase_invoice_id' => PurchaseInvoice::factory(),
            'party_id' => Party::factory()->state(['type' => 'vendor']),
            'return_number' => 'PR-'.fake()->unique()->regexify('[A-Z]{2}[0-9]{6}'),
            'return_date' => fake()->dateTimeBetween('-2 months', 'now'),
            'status' => fake()->randomElement(['draft', 'confirmed', 'cancelled']),
            'total_amount' => $totalAmount,
            'gst_amount' => $gstAmount,
            'grand_total' => $totalAmount + $gstAmount,
            'notes' => fake()->optional()->sentence(),
            'created_by' => User::factory(),
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }
}
