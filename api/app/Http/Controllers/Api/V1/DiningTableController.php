<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DiningTable;
use App\Models\SalesInvoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DiningTableController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tables = DiningTable::with('currentOrder')
            ->where('company_id', $request->user()->company_id)
            ->when($request->floor_plan_id, fn ($q, $id) => $q->where('floor_plan_id', $id))
            ->when($request->is_active !== null, fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('pos_y')
            ->orderBy('pos_x')
            ->get();

        return response()->json(['data' => $tables]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'floor_plan_id' => 'required|uuid|exists:floor_plans,id',
            'name'          => 'required|string|max:50',
            'capacity'      => 'nullable|integer|min:1',
            'shape'         => 'nullable|in:square,round,rectangle',
            'pos_x'         => 'nullable|integer|min:0',
            'pos_y'         => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
        ]);

        $table = DiningTable::create([
            ...$validated,
            'company_id' => $request->user()->company_id,
            'status'     => 'vacant',
            'is_active'  => $validated['is_active'] ?? true,
        ]);

        return response()->json(['data' => $table], 201);
    }

    public function show(DiningTable $diningTable): JsonResponse
    {
        return response()->json(['data' => $diningTable->load('floorPlan', 'currentOrder.lines.item')]);
    }

    public function update(Request $request, DiningTable $diningTable): JsonResponse
    {
        $validated = $request->validate([
            'floor_plan_id' => 'nullable|uuid|exists:floor_plans,id',
            'name'          => 'required|string|max:50',
            'capacity'      => 'nullable|integer|min:1',
            'shape'         => 'nullable|in:square,round,rectangle',
            'pos_x'         => 'nullable|integer|min:0',
            'pos_y'         => 'nullable|integer|min:0',
            'is_active'     => 'boolean',
        ]);

        $diningTable->update($validated);

        return response()->json(['data' => $diningTable]);
    }

    public function destroy(DiningTable $diningTable): JsonResponse
    {
        if ($diningTable->isOccupied()) {
            return response()->json(['message' => 'Cannot delete an occupied table'], 422);
        }

        $diningTable->delete();

        return response()->json(['message' => 'Table deleted']);
    }

    /**
     * Manually override table status (e.g. mark for cleaning, reserve).
     */
    public function updateStatus(Request $request, DiningTable $diningTable): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:vacant,occupied,reserved,cleaning',
        ]);

        if ($validated['status'] !== 'occupied' && $diningTable->isOccupied()) {
            // Release any stale order reference when manually clearing
            $diningTable->update([
                'status'           => $validated['status'],
                'current_order_id' => null,
            ]);
        } else {
            $diningTable->update(['status' => $validated['status']]);
        }

        return response()->json(['data' => $diningTable->fresh()]);
    }

    /**
     * Merge another table's order into this table's order.
     * The source table becomes vacant after merge.
     */
    public function merge(Request $request, DiningTable $diningTable): JsonResponse
    {
        $validated = $request->validate([
            'source_table_id' => 'required|uuid|exists:dining_tables,id|different:id',
        ]);

        if (! $diningTable->isOccupied()) {
            return response()->json(['message' => 'Target table must have an active order'], 422);
        }

        DB::transaction(function () use ($validated, $diningTable, $request) {
            $sourceTable = DiningTable::where('id', $validated['source_table_id'])
                ->where('company_id', $request->user()->company_id)
                ->firstOrFail();

            if (! $sourceTable->isOccupied() || ! $sourceTable->current_order_id) {
                throw ValidationException::withMessages(['source_table_id' => 'Source table has no active order to merge']);
            }

            $sourceOrder = SalesInvoice::findOrFail($sourceTable->current_order_id);
            $targetOrder = SalesInvoice::findOrFail($diningTable->current_order_id);

            // Move all lines from source order to target order
            $sourceOrder->lines()->update(['sales_invoice_id' => $targetOrder->id]);

            // Move all KOTs from source order to target order
            $sourceOrder->kots()->update(['sales_invoice_id' => $targetOrder->id]);

            // Recalculate target order totals
            $targetOrder->load('lines');
            $targetOrder->update([
                'total_amount'   => $targetOrder->lines->sum('taxable_amount'),
                'taxable_amount' => $targetOrder->lines->sum('taxable_amount'),
                'cgst_total'     => $targetOrder->lines->sum('cgst'),
                'sgst_total'     => $targetOrder->lines->sum('sgst'),
                'igst_total'     => $targetOrder->lines->sum('igst'),
                'grand_total'    => $targetOrder->lines->sum('line_total'),
                'balance_due'    => $targetOrder->lines->sum('line_total'),
                'pax'            => $targetOrder->pax + $sourceOrder->pax,
            ]);

            // Cancel source order shell and release source table
            $sourceOrder->update(['status' => 'cancelled']);
            $sourceTable->update(['status' => 'vacant', 'current_order_id' => null]);
        });

        return response()->json([
            'data'    => $diningTable->fresh()->load('currentOrder.lines.item'),
            'message' => 'Tables merged successfully',
        ]);
    }
}
