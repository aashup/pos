<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Unit;
use Illuminate\Database\Seeder;

class UnitSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $defaultUnits = [
            ['value' => 'PCS', 'label' => 'Pieces'],
            ['value' => 'KG', 'label' => 'Kilograms'],
            ['value' => 'BOX', 'label' => 'Box'],
            ['value' => 'STRIP', 'label' => 'Strip'],
            ['value' => 'MTR', 'label' => 'Meter'],
            ['value' => 'LTR', 'label' => 'Liter'],
            ['value' => 'GM', 'label' => 'Gram'],
            ['value' => 'PAK', 'label' => 'Pack'],
            ['value' => 'BAG', 'label' => 'Bag'],
            ['value' => 'SqFeet', 'label' => 'Square Feet'],
            ['value' => 'Trolly60', 'label' => 'Trolly 6000'],
            ['value' => 'Trolly10', 'label' => 'Trolly 1000'],
            ['value' => 'Trolly15', 'label' => 'Trolly 1500'],
        ];

        $companies = Company::all();

        foreach ($companies as $company) {
            foreach ($defaultUnits as $unitData) {
                Unit::firstOrCreate(
                    ['company_id' => $company->id, 'value' => $unitData['value']],
                    [
                        'label' => $unitData['label'],
                        'status' => 'active',
                    ]
                );
            }
        }
    }
}
