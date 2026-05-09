<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Services\DefaultGroupsService;
use Illuminate\Database\Seeder;

class AccountingGroupSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();

        if (! $company) {
            $company = Company::factory()->create();
        }

        (new DefaultGroupsService)->load($company->id);
    }
}
