<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Item;
use App\Models\ItemGroup;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ItemSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Sample items for demo
     */
    protected array $sampleItems = [
        [
            'name' => 'Paracetamol Tablet 500mg',
            'sku' => 'MED001',
            'hsn_code' => '30049099',
            'unit' => 'strip',
            'igst' => 12,
            'sgst' => 6,
            'cgst' => 6,
            'mrp' => 20.00,
            'purchase_price' => 15.00,
            'selling_price' => 18.00,
            'reorder_level' => 100,
            'is_batch_tracked' => true,
        ],
        [
            'name' => 'Antibiotic Syrup 100ml',
            'sku' => 'MED002',
            'hsn_code' => '30049099',
            'unit' => 'bottle',
            'igst' => 12,
            'sgst' => 6,
            'cgst' => 6,
            'mrp' => 120.00,
            'purchase_price' => 85.00,
            'selling_price' => 110.00,
            'reorder_level' => 50,
            'is_batch_tracked' => true,
        ],
        [
            'name' => 'Rice Basmati 5kg',
            'sku' => 'GRO001',
            'hsn_code' => '10063090',
            'unit' => 'packet',
            'igst' => 5,
            'sgst' => 2.5,
            'cgst' => 2.5,
            'mrp' => 350.00,
            'purchase_price' => 280.00,
            'selling_price' => 320.00,
            'reorder_level' => 30,
            'is_batch_tracked' => false,
        ],
        [
            'name' => 'Toothpaste 100g',
            'sku' => 'PERS001',
            'hsn_code' => '33061010',
            'unit' => 'tube',
            'igst' => 18,
            'sgst' => 9,
            'cgst' => 9,
            'mrp' => 45.00,
            'purchase_price' => 30.00,
            'selling_price' => 40.00,
            'reorder_level' => 200,
            'is_batch_tracked' => false,
        ],
    ];

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

        // Get the Primary item group (auto-created by CompanyObserver)
        $primaryGroup = ItemGroup::where('company_id', $company->id)->first();

        // Create sample items
        foreach ($this->sampleItems as $item) {
            Item::factory()->create(array_merge($item, [
                'company_id' => $company->id,
                'item_group_id' => $primaryGroup?->id,
                'is_active' => true,
            ]));
        }

        // Create additional items if needed
        if (app()->environment('local', 'testing')) {
            Item::factory()->count(500)->create([
                'company_id' => $company->id,
                'item_group_id' => $primaryGroup?->id,
            ]);
        }
    }
}
