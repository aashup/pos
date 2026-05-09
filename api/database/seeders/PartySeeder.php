<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Party;
use Illuminate\Database\Seeder;

class PartySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get the first company
        $company = Company::first();

        if (! $company) {
            $company = Company::factory()->create();
        }

        // Create some vendors
        Party::factory()->create([
            'company_id' => $company->id,
            'type' => 'vendor',
            'name' => 'Supplier One Pvt. Ltd.',
            'gstin' => '27AABCU1234F1Z5',
            'pan' => 'AABCU1234F',
            'email' => 'accounts@supplierone.in',
            'credit_limit' => 100000,
            'opening_balance' => 0,
            'balance_type' => 'cr',
            'is_active' => true,
        ]);

        // Create some customers
        Party::factory()->create([
            'company_id' => $company->id,
            'type' => 'both',
            'name' => 'Retail Store ABC',
            'gstin' => '27PQRST9012H3Z7',
            'pan' => 'PQRST9012H',
            'email' => 'billing@retailstoreabc.com',
            'credit_limit' => 50000,
            'opening_balance' => 0,
            'balance_type' => 'dr',
            'is_active' => true,
        ]);

        Party::factory()->create([
            'company_id' => $company->id,
            'type' => 'customer',
            'name' => 'John Doe',
            'gstin' => null,
            'pan' => null,
            'email' => 'john.doe@example.com',
            'credit_limit' => 10000,
            'opening_balance' => 0,
            'balance_type' => 'cr',
            'is_active' => true,
        ]);

        // Create additional parties if needed
        if (app()->environment('local', 'testing')) {
            Party::factory()->count(100)->create([
                'company_id' => $company->id,
                'type' => 'vendor',
            ]);
            Party::factory()->count(100)->create([
                'company_id' => $company->id,
                'type' => 'customer',
            ]);
            Party::factory()->count(100)->create([
                'company_id' => $company->id,
                'type' => 'both',
            ]);
        }
    }
}
