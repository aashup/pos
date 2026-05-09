<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Party;
use App\Models\PaymentReceipt;
use App\Models\User;
use Illuminate\Database\Seeder;

class PaymentReceiptSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();
        if (! $company) {
            return;
        }

        $user = User::where('company_id', $company->id)->first();
        if (! $user) {
            return;
        }

        $vendors = Party::where('company_id', $company->id)->where('type', 'vendor')->get();
        $customers = Party::where('company_id', $company->id)->where('type', 'customer')->get();

        // Payments to vendors
        foreach ($vendors->take(2) as $idx => $vendor) {
            PaymentReceipt::create([
                'company_id' => $company->id,
                'party_id' => $vendor->id,
                'type' => 'payment',
                'receipt_number' => 'PAY-'.str_pad($idx + 1, 6, '0', STR_PAD_LEFT),
                'receipt_date' => now()->subDays(rand(1, 20)),
                'amount' => rand(5000, 50000),
                'payment_mode' => ['bank', 'cheque', 'upi'][rand(0, 2)],
                'reference_number' => 'REF'.rand(100000, 999999),
                'bank_name' => ['SBI', 'HDFC', 'ICICI'][rand(0, 2)],
                'notes' => "Payment to {$vendor->name}",
                'created_by' => $user->id,
                'sync_status' => 'synced',
                'synced_at' => now(),
                'updated_at_local' => now(),
            ]);
        }

        // Receipts from customers
        foreach ($customers->take(3) as $idx => $customer) {
            PaymentReceipt::create([
                'company_id' => $company->id,
                'party_id' => $customer->id,
                'type' => 'receipt',
                'receipt_number' => 'RCT-'.str_pad($idx + 1, 6, '0', STR_PAD_LEFT),
                'receipt_date' => now()->subDays(rand(1, 15)),
                'amount' => rand(1000, 30000),
                'payment_mode' => ['cash', 'upi', 'bank'][rand(0, 2)],
                'reference_number' => rand(0, 1) ? 'UPI'.rand(100000, 999999) : null,
                'notes' => "Receipt from {$customer->name}",
                'created_by' => $user->id,
                'sync_status' => 'synced',
                'synced_at' => now(),
                'updated_at_local' => now(),
            ]);
        }
    }
}
