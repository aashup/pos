<?php

namespace Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;

class CompanySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create one primary company for testing
        // Note: FinancialYearObserver will auto-initialize document counters
        Company::factory()->create([
            'name' => 'Demo Company Pvt. Ltd.',
            'gstin' => '27ABCDE1234F1Z5',
            'pan' => 'ABCDE1234F',
            'email' => 'accounts@democompany.in',
            'state' => 'Uttar Pradesh',
            'state_code' => '09',
        ]);
    }
}
