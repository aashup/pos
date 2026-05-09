<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Godown;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class GodownSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get the first company and branch
        $company = Company::first();
        $branch = Branch::where('company_id', $company->id)->first();

        if (! $company) {
            $company = Company::factory()->create();
        }
        if (! $branch) {
            $branch = Branch::factory()->create(['company_id' => $company->id]);
        }

        // Create main godown
        Godown::factory()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Main Store',
            'code' => 'MAIN',
            'is_default' => true,
            'is_active' => true,
        ]);

        // Create additional godowns if needed
        if (app()->environment('local', 'testing')) {
            Godown::factory()->count(30)->create([
                'company_id' => $company->id,
                'branch_id' => $branch->id,
            ]);
        }
    }
}
