<?php

namespace App\Observers;

use App\Models\Company;
use App\Models\FinancialYear;
use App\Models\ItemGroup;
use App\Models\Unit;
use App\Services\DefaultGroupsService;
use Carbon\Carbon;

class CompanyObserver
{
    /**
     * When a company is created, auto-create the current financial year (Apr-Mar) and primary item group.
     * The FinancialYearObserver will handle initializing document counters.
     */
    public function created(Company $company): void
    {
        $now = Carbon::now();
        // Indian FY: Apr 1 – Mar 31. If current month >= April, FY starts this year; else last year.
        $fyStartYear = $now->month >= 4 ? $now->year : $now->year - 1;

        FinancialYear::firstOrCreate(
            [
                'company_id' => $company->id,
                'label' => $fyStartYear.'-'.substr($fyStartYear + 1, -2),
            ], [
                'start_date' => Carbon::create($fyStartYear, 4, 1),
                'end_date' => Carbon::create($fyStartYear + 1, 3, 31),
                'is_current' => true,
                'is_locked' => false,
            ]);

        ItemGroup::firstOrCreate(
            ['company_id' => $company->id, 'name' => 'Primary'],
            ['is_active' => true]
        );

        (new DefaultGroupsService)->load($company->id);

        foreach ([
            ['value' => 'PCS',   'label' => 'Pieces'],
            ['value' => 'KG',    'label' => 'Kilograms'],
            ['value' => 'BOX',   'label' => 'Box'],
            ['value' => 'STRIP', 'label' => 'Strip'],
            ['value' => 'MTR',   'label' => 'Meter'],
            ['value' => 'LTR',   'label' => 'Liter'],
            ['value' => 'GM',    'label' => 'Gram'],
            ['value' => 'PAK',   'label' => 'Pack'],
        ] as $unit) {
            Unit::firstOrCreate(
                ['company_id' => $company->id, 'value' => $unit['value']],
                ['label' => $unit['label'], 'status' => 'active']
            );
        }
    }
}
