<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Godown;
use App\Models\Item;
use App\Models\StockLedger;
use App\Traits\FiltersByFinancialYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockLedgerController extends Controller
{
    use FiltersByFinancialYear;

    /**
     * Paginated stock movement history with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Item::class);

        $query = StockLedger::with(['item:id,name,sku,unit', 'godown:id,name', 'batch:id,batch_number'])
            ->when($request->item_id, fn ($q, $v) => $q->where('stock_ledger.item_id', $v))
            ->when($request->godown_id, fn ($q, $v) => $q->where('stock_ledger.godown_id', $v))
            ->when($request->type, fn ($q, $v) => $q->where('stock_ledger.type', $v))
            ->when($request->from_date, fn ($q, $v) => $q->whereDate('stock_ledger.date', '>=', $v))
            ->when($request->to_date, fn ($q, $v) => $q->whereDate('stock_ledger.date', '<=', $v));

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'asc' ? 'asc' : 'desc';

            match ($request->sort_by) {
                'date' => $query->orderBy('stock_ledger.date', $sortOrder),
                'item_name' => $query->join('items', 'stock_ledger.item_id', '=', 'items.id')->orderBy('items.name', $sortOrder),
                'godown_name' => $query->join('godowns', 'stock_ledger.godown_id', '=', 'godowns.id')->orderBy('godowns.name', $sortOrder),
                'type' => $query->orderBy('stock_ledger.type', $sortOrder),
                'quantity' => $query->orderBy('stock_ledger.quantity', $sortOrder),
                'rate' => $query->orderBy('stock_ledger.rate', $sortOrder),
                'value' => $query->orderBy('stock_ledger.value', $sortOrder),
                'narration' => $query->orderBy('stock_ledger.narration', $sortOrder),
                default => $query->orderByDesc('stock_ledger.date'),
            };
        } else {
            $query->orderByDesc('stock_ledger.date');
        }

        // $this->applyFYFilter($query, $request, 'stock_ledger.created_at');

        $entries = $query->paginate($request->per_page ?? 25);

        return response()->json($entries);
    }

    /**
     * Current stock per item/godown (SUM of ledger quantities).
     */
    public function summary(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Item::class);

        $companyId = $request->user()->company_id;

        $query = StockLedger::select('stock_ledger.item_id', 'stock_ledger.godown_id', DB::raw('SUM(stock_ledger.quantity) as current_stock'))
            ->where('stock_ledger.company_id', $companyId)
            ->groupBy('stock_ledger.item_id', 'stock_ledger.godown_id');

        if ($request->godown_id) {
            $query->where('stock_ledger.godown_id', $request->godown_id);
        }

        if ($request->search) {
            $search = $request->search;
            $query->whereHas('item', fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%"));
        }

        // Sorting
        if ($request->sort_by) {
            $sortOrder = $request->sort_order === 'desc' ? 'desc' : 'asc';

            match ($request->sort_by) {
                'item_name' => $query->join('items', 'stock_ledger.item_id', '=', 'items.id')->orderBy('items.name', $sortOrder),
                'sku' => $query->join('items', 'stock_ledger.item_id', '=', 'items.id')->orderBy('items.sku', $sortOrder),
                'unit' => $query->join('items', 'stock_ledger.item_id', '=', 'items.id')->orderBy('items.unit', $sortOrder),
                'godown_name' => $query->join('godowns', 'stock_ledger.godown_id', '=', 'godowns.id')->orderBy('godowns.name', $sortOrder),
                'current_stock' => $query->orderBy(DB::raw('SUM(stock_ledger.quantity)'), $sortOrder),
                'reorder_level' => $query->join('items', 'stock_ledger.item_id', '=', 'items.id')->orderBy('items.reorder_level', $sortOrder),
                'status' => $query->join('items', 'stock_ledger.item_id', '=', 'items.id')->orderBy('items.reorder_level', $sortOrder),
                default => null,
            };
        }

        // Get paginated results with item & godown eager-loaded
        $results = $query->paginate($request->per_page ?? 25);

        // Eager load relationships on the paginated collection
        $itemIds = $results->pluck('item_id')->unique();
        $godownIds = $results->pluck('godown_id')->unique();

        $items = Item::whereIn('id', $itemIds)->get()->keyBy('id');
        $godowns = Godown::whereIn('id', $godownIds)->get()->keyBy('id');

        $results->getCollection()->transform(function ($row) use ($items, $godowns) {
            $row->item = $items[$row->item_id] ?? null;
            $row->godown = $godowns[$row->godown_id] ?? null;

            return $row;
        });

        return response()->json($results);
    }

    /**
     * Create opening stock entry.
     */
    public function opening(Request $request): JsonResponse
    {
        $this->authorize('create', Item::class);

        $validated = $request->validate([
            'item_id' => 'required|uuid|exists:items,id',
            'godown_id' => 'required|uuid|exists:godowns,id',
            'batch_id' => 'nullable|uuid|exists:batches,id',
            'quantity' => 'required|numeric|gt:0',
            'rate' => 'required|numeric|min:0',
            'narration' => 'nullable|string|max:500',
        ]);

        $entry = StockLedger::create([
            'company_id' => $request->user()->company_id,
            'item_id' => $validated['item_id'],
            'godown_id' => $validated['godown_id'],
            'batch_id' => $validated['batch_id'] ?? null,
            'type' => 'opening',
            'date' => now()->toDateString(),
            'quantity' => $validated['quantity'],
            'rate' => $validated['rate'],
            'value' => $validated['quantity'] * $validated['rate'],
            'narration' => $validated['narration'] ?? 'Opening stock entry',
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $entry, 'message' => 'Opening stock recorded'], 201);
    }

    /**
     * Physical stock adjustment (+/-). Narration is mandatory.
     */
    public function adjustment(Request $request): JsonResponse
    {
        $this->authorize('create', Item::class);

        $validated = $request->validate([
            'item_id' => 'required|uuid|exists:items,id',
            'godown_id' => 'required|uuid|exists:godowns,id',
            'batch_id' => 'nullable|uuid|exists:batches,id',
            'quantity' => 'required|numeric|not_in:0',
            'rate' => 'required|numeric|min:0',
            'narration' => 'required|string|min:3|max:500',
        ]);

        $entry = StockLedger::create([
            'company_id' => $request->user()->company_id,
            'item_id' => $validated['item_id'],
            'godown_id' => $validated['godown_id'],
            'batch_id' => $validated['batch_id'] ?? null,
            'type' => 'adjustment',
            'date' => now()->toDateString(),
            'quantity' => $validated['quantity'],
            'rate' => $validated['rate'],
            'value' => abs($validated['quantity']) * $validated['rate'],
            'narration' => $validated['narration'],
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $entry, 'message' => 'Stock adjustment recorded'], 201);
    }

    /**
     * Transfer stock between godowns (atomic: transfer_out + transfer_in).
     */
    public function transfer(Request $request): JsonResponse
    {
        $this->authorize('create', Item::class);

        $validated = $request->validate([
            'item_id' => 'required|uuid|exists:items,id',
            'from_godown_id' => 'required|uuid|exists:godowns,id',
            'to_godown_id' => 'required|uuid|exists:godowns,id|different:from_godown_id',
            'batch_id' => 'nullable|uuid|exists:batches,id',
            'quantity' => 'required|numeric|gt:0',
            'rate' => 'required|numeric|min:0',
            'narration' => 'nullable|string|max:500',
        ]);

        // Check available stock in source godown
        $currentStock = StockLedger::where('company_id', $request->user()->company_id)
            ->where('item_id', $validated['item_id'])
            ->where('godown_id', $validated['from_godown_id'])
            ->when($validated['batch_id'] ?? null, fn ($q, $v) => $q->where('batch_id', $v))
            ->sum('quantity');

        if ($currentStock < $validated['quantity']) {
            return response()->json([
                'message' => 'Insufficient stock in source godown',
                'errors' => ['quantity' => ["Available stock: {$currentStock}"]],
            ], 422);
        }

        $narration = $validated['narration'] ?? 'Stock transfer';
        $companyId = $request->user()->company_id;
        $userId = $request->user()->id;

        $entries = DB::transaction(function () use ($validated, $narration, $companyId, $userId) {
            $out = StockLedger::create([
                'company_id' => $companyId,
                'item_id' => $validated['item_id'],
                'godown_id' => $validated['from_godown_id'],
                'batch_id' => $validated['batch_id'] ?? null,
                'type' => 'transfer_out',
                'date' => now()->toDateString(),
                'quantity' => -$validated['quantity'],
                'rate' => $validated['rate'],
                'value' => $validated['quantity'] * $validated['rate'],
                'narration' => $narration,
                'created_by' => $userId,
            ]);

            $in = StockLedger::create([
                'company_id' => $companyId,
                'item_id' => $validated['item_id'],
                'godown_id' => $validated['to_godown_id'],
                'batch_id' => $validated['batch_id'] ?? null,
                'type' => 'transfer_in',
                'date' => now()->toDateString(),
                'quantity' => $validated['quantity'],
                'rate' => $validated['rate'],
                'value' => $validated['quantity'] * $validated['rate'],
                'narration' => $narration,
                'reference_type' => StockLedger::class,
                'reference_id' => $out->id,
                'created_by' => $userId,
            ]);

            // Link the out entry to the in entry
            $out->update(['reference_type' => StockLedger::class, 'reference_id' => $in->id]);

            return [$out, $in];
        });

        return response()->json(['data' => $entries, 'message' => 'Stock transferred successfully'], 201);
    }

    /**
     * Items where current stock < reorder_level.
     */
    public function reorderAlerts(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Item::class);

        $companyId = $request->user()->company_id;

        $items = Item::where('company_id', $companyId)
            ->where('is_active', true)
            ->whereNotNull('reorder_level')
            ->where('reorder_level', '>', 0)
            ->get();

        if ($items->isEmpty()) {
            return response()->json(['data' => []]);
        }

        // Get total stock per item
        $stockByItem = StockLedger::where('company_id', $companyId)
            ->whereIn('item_id', $items->pluck('id'))
            ->groupBy('item_id')
            ->select('item_id', DB::raw('SUM(quantity) as current_stock'))
            ->pluck('current_stock', 'item_id');

        $alerts = [];
        foreach ($items as $item) {
            $currentStock = (float) ($stockByItem[$item->id] ?? 0);
            if ($currentStock < $item->reorder_level) {
                $alerts[] = [
                    'item_id' => $item->id,
                    'item_name' => $item->name,
                    'sku' => $item->sku,
                    'unit' => $item->unit,
                    'reorder_level' => $item->reorder_level,
                    'current_stock' => $currentStock,
                    'deficit' => $item->reorder_level - $currentStock,
                ];
            }
        }

        // Sort by deficit descending
        usort($alerts, fn ($a, $b) => $b['deficit'] <=> $a['deficit']);

        return response()->json(['data' => $alerts]);
    }

    /**
     * All movements for a specific item.
     */
    public function itemMovements(Request $request, Item $item): JsonResponse
    {
        $this->authorize('view', $item);

        $entries = StockLedger::with(['godown:id,name', 'batch:id,batch_number'])
            ->where('item_id', $item->id)
            ->when($request->godown_id, fn ($q, $v) => $q->where('godown_id', $v))
            ->when($request->from_date, fn ($q, $v) => $q->whereDate('date', '>=', $v))
            ->when($request->to_date, fn ($q, $v) => $q->whereDate('date', '<=', $v))
            ->orderBy('date')
            ->paginate($request->per_page ?? 50);

        return response()->json($entries);
    }
}
