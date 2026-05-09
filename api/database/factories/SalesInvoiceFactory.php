<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Godown;
use App\Models\Party;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SalesInvoiceFactory extends Factory
{
    public function definition(): array
    {
        $invoiceDate = fake()->dateTimeBetween('-3 months', 'now');
        $dueDate = clone $invoiceDate;
        $dueDate->modify('+30 days');

        $totalAmount = fake()->randomFloat(2, 500, 80000);
        $discountAmount = fake()->randomFloat(2, 0, $totalAmount * 0.1);
        $taxableAmount = $totalAmount - $discountAmount;
        $isInterState = fake()->boolean(30);

        $gstRate = fake()->randomElement([5, 12, 18, 28]);
        $gstAmount = $taxableAmount * $gstRate / 100;

        return [
            'company_id' => Company::factory(),
            'party_id' => Party::factory()->state(['type' => 'customer']),
            'branch_id' => Branch::factory(),
            'sales_order_id' => null,
            'godown_id' => Godown::factory(),
            'invoice_number' => 'SI-'.fake()->unique()->regexify('[A-Z]{2}[0-9]{6}'),
            'invoice_date' => $invoiceDate,
            'due_date' => $dueDate,
            'is_inter_state' => $isInterState,
            'is_printed' => fake()->boolean(40),
            'status' => fake()->randomElement(['draft', 'confirmed', 'cancelled']),
            'total_amount' => $totalAmount,
            'discount_amount' => $discountAmount,
            'taxable_amount' => $taxableAmount,
            'cgst_total' => $isInterState ? 0 : $gstAmount / 2,
            'sgst_total' => $isInterState ? 0 : $gstAmount / 2,
            'igst_total' => $isInterState ? $gstAmount : 0,
            'grand_total' => $taxableAmount + $gstAmount,
            'amount_paid' => 0,
            'balance_due' => $taxableAmount + $gstAmount,
            'notes' => fake()->optional()->sentence(),
            'created_by' => User::factory(),
            'updated_by' => null,
            'sync_status' => 'synced',
            'device_id' => null,
            'synced_at' => now(),
            'updated_at_local' => now(),
        ];
    }

    public function confirmed(): static
    {
        return $this->state(['status' => 'confirmed']);
    }

    public function printed(): static
    {
        return $this->state(['is_printed' => true, 'status' => 'confirmed']);
    }
}
