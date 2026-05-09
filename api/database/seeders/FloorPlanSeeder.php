<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\DiningTable;
use App\Models\FloorPlan;
use Illuminate\Database\Seeder;

class FloorPlanSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::first();

        if (! $company) {
            return;
        }

        $floors = [
            ['name' => 'Floor 1', 'sort_order' => 1],
            ['name' => 'Floor 2', 'sort_order' => 2],
        ];

        foreach ($floors as $floorData) {
            $floor = FloorPlan::create([
                'company_id' => $company->id,
                'name'       => $floorData['name'],
                'sort_order' => $floorData['sort_order'],
            ]);

            // 25 tables in a 5×5 grid, 120px spacing
            for ($i = 1; $i <= 25; $i++) {
                $col = ($i - 1) % 5;
                $row = (int) (($i - 1) / 5);

                DiningTable::create([
                    'company_id'   => $company->id,
                    'floor_plan_id'=> $floor->id,
                    'name'         => 'T' . (($floorData['sort_order'] - 1) * 25 + $i),
                    'capacity'     => 4,
                    'shape'        => 'square',
                    'pos_x'        => $col * 120,
                    'pos_y'        => $row * 120,
                    'status'       => 'vacant',
                    'is_active'    => true,
                ]);
            }
        }
    }
}
