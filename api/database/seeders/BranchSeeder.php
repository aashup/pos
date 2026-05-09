<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Company;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class BranchSeeder extends Seeder
{
    use WithoutModelEvents;

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

        // Create a main branch for the company
        Branch::factory()->create([
            'company_id' => $company->id,
            'name' => 'Head Office',
            'code' => 'HO',
            'is_active' => true,
        ]);

        // Create additional branches if needed
        if (app()->environment('local', 'testing')) {
            Branch::factory()->count(20)->create([
                'company_id' => $company->id,
            ]);
        }
    }
}
