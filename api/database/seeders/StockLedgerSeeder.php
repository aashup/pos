<?php

namespace Database\Seeders;

use App\Models\Batch;
use App\Models\Company;
use App\Models\Godown;
use App\Models\Item;
use App\Models\StockLedger;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class StockLedgerSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get the first company, items, godowns, and user
        $company = Company::first();
        $items = Item::where('company_id', $company->id)->get();
        $godowns = Godown::where('company_id', $company->id)->get();
        $user = User::where('company_id', $company->id)->first();

        if (! $company || $items->isEmpty() || $godowns->isEmpty() || ! $user) {
            // Skip if prerequisites not met
            return;
        }

        // Create opening stock entries for each item
        foreach ($items as $item) {
            $godown = $godowns->random();
            $batch = null;

            if ($item->is_batch_tracked) {
                $batch = Batch::where('item_id', $item->id)->first();
                if (! $batch) {
                    $batch = Batch::factory()->create([
                        'item_id' => $item->id,
                    ]);
                }
            }

            StockLedger::factory()->create([
                'company_id' => $company->id,
                'item_id' => $item->id,
                'batch_id' => $batch?->id,
                'godown_id' => $godown->id,
                'type' => 'opening',
                'reference_type' => 'OpeningStock',
                'reference_id' => null,
                'quantity' => 0,
                'rate' => $item->purchase_price,
                'value' => fn (array $attributes) => $attributes['quantity'] * $attributes['rate'],
                'narration' => 'Opening stock',
                'created_by' => $user->id,
                'date' => now(),
            ]);
        }

    }
}
