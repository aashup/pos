<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\FinancialYear;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class FinancialYearSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Note: The current FY is auto-created by CompanyObserver when the company is created.
     * This seeder only adds the previous year for demo purposes.
     */
    public function run(): void
    {
        $company = Company::first();

        if (! $company) {
            return;
        }

        $now = Carbon::now();
        $fyStartYear = $now->month >= 4 ? $now->year : $now->year - 1;

        // Previous financial year (locked)
        $prevStartYear = $fyStartYear - 1;

        FinancialYear::firstOrCreate(
            [
                'company_id' => $company->id,
                'label' => $prevStartYear.'-'.substr($prevStartYear + 1, -2),
            ],
            [
                'start_date' => Carbon::create($prevStartYear, 4, 1),
                'end_date' => Carbon::create($prevStartYear + 1, 3, 31),
                'is_current' => false,
                'is_locked' => true,
            ]
        );
    }
}
