<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\Item;
use App\Models\StockLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BatchController extends Controller
{
    public function index(Request $request, Item $item): JsonResponse
    {
        $this->authorize('view', $item);

        $batches = $item->batches()->orderBy('expiry_date')->get();

        // Attach current stock per batch
        $stockByBatch = StockLedger::where('item_id', $item->id)
            ->whereIn('batch_id', $batches->pluck('id'))
            ->groupBy('batch_id')
            ->select('batch_id', DB::raw('SUM(quantity) as current_stock'))
            ->pluck('current_stock', 'batch_id');

        $batches->each(function ($batch) use ($stockByBatch) {
            $batch->current_stock = (float) ($stockByBatch[$batch->id] ?? 0);
        });

        return response()->json(['data' => $batches]);
    }

    public function store(Request $request, Item $item): JsonResponse
    {
        $this->authorize('update', $item);

        $validated = $request->validate([
            'batch_number' => 'required|string|max:100',
            'manufacturing_date' => 'nullable|date',
            'expiry_date' => 'nullable|date|after_or_equal:manufacturing_date',
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
        ]);

        $batch = $item->batches()->create($validated);

        return response()->json(['data' => $batch], 201);
    }

    public function update(Request $request, Batch $batch): JsonResponse
    {
        $this->authorize('update', $batch->item);

        $validated = $request->validate([
            'batch_number' => 'sometimes|string|max:100',
            'manufacturing_date' => 'nullable|date',
            'expiry_date' => 'nullable|date',
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
        ]);

        $batch->update($validated);

        return response()->json(['data' => $batch]);
    }

    public function destroy(Batch $batch): JsonResponse
    {
        $this->authorize('delete', $batch->item);

        // Check if batch has stock
        $stock = StockLedger::where('batch_id', $batch->id)->sum('quantity');
        if ($stock != 0) {
            return response()->json(['message' => 'Cannot delete batch with existing stock'], 422);
        }

        $batch->delete();

        return response()->json(['message' => 'Batch deleted']);
    }

    public function allBatches(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Item::class);

        $batches = Batch::with('item:id,name,sku,unit')
            ->whereHas('item', fn ($q) => $q->where('company_id', $request->user()->company_id))
            ->orderBy('expiry_date')
            ->get();

        $stockByBatch = StockLedger::whereIn('batch_id', $batches->pluck('id'))
            ->groupBy('batch_id')
            ->select('batch_id', DB::raw('SUM(quantity) as current_stock'))
            ->pluck('current_stock', 'batch_id');

        $batches->each(function ($batch) use ($stockByBatch) {
            $batch->current_stock = (float) ($stockByBatch[$batch->id] ?? 0);
        });

        return response()->json(['data' => $batches]);
    }

    public function expiring(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Item::class);

        $days = $request->days ?? 30;

        $batches = Batch::with('item:id,name,sku,unit')
            ->whereHas('item', fn ($q) => $q->where('company_id', $request->user()->company_id))
            ->whereNotNull('expiry_date')
            ->where('expiry_date', '<=', now()->addDays($days))
            ->orderBy('expiry_date')
            ->get();

        // Attach current stock
        $stockByBatch = StockLedger::whereIn('batch_id', $batches->pluck('id'))
            ->groupBy('batch_id')
            ->select('batch_id', DB::raw('SUM(quantity) as current_stock'))
            ->pluck('current_stock', 'batch_id');

        $batches->each(function ($batch) use ($stockByBatch) {
            $batch->current_stock = (float) ($stockByBatch[$batch->id] ?? 0);
        });

        return response()->json(['data' => $batches]);
    }
}
