<?php

namespace Database\Seeders;

use App\Models\Batch;
use App\Models\Company;
use App\Models\Item;
use Carbon\Carbon;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class BatchSeeder extends Seeder
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

        // Get batch-tracked items
        $batchItems = Item::where('is_batch_tracked', true)->get();

        if ($batchItems->isEmpty()) {
            // Create at least one batch-tracked item if none exists
            $batchItem = Item::factory()->create([
                'company_id' => $company->id,
                'is_batch_tracked' => true,
            ]);
            $batchItems = collect([$batchItem]);
        }

        // Create batches for each batch-tracked item
        foreach ($batchItems as $item) {
            Batch::factory()->create([
                'item_id' => $item->id,
                'batch_number' => 'BATCH'.Carbon::now()->format('Ym').'001',
                'manufacturing_date' => Carbon::now()->subMonths(6),
                'expiry_date' => Carbon::now()->addYears(1),
                'purchase_price' => $item->purchase_price,
                'selling_price' => $item->selling_price,
            ]);

            // Create additional batches if needed
            if (app()->environment('local', 'testing')) {
                Batch::factory()->count(20)->create([
                    'item_id' => $item->id,
                ]);
            }
        }
    }
}
