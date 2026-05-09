<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\KitchenOrderTicket;
use App\Models\KotLine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class KotController extends Controller
{
    /**
     * List KOTs — used by kitchen display and manager view.
     */
    public function index(Request $request): JsonResponse
    {
        $query = KitchenOrderTicket::with('lines', 'invoice.diningTable')
            ->where('company_id', $request->user()->company_id)
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->date, fn ($q, $d) => $q->whereDate('created_at', $d))
            ->when(! $request->status, fn ($q) => $q->whereNotIn('status', ['served']))
            ->latest();

        return response()->json($query->paginate($request->per_page ?? 50));
    }

    /**
     * Get a single KOT with all its lines.
     */
    public function show(KitchenOrderTicket $kot): JsonResponse
    {
        return response()->json([
            'data' => $kot->load('lines.item', 'invoice.diningTable'),
        ]);
    }

    /**
     * Update KOT status (kitchen workflow: new → in_progress → ready → served).
     */
    public function updateStatus(Request $request, KitchenOrderTicket $kot): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:new,in_progress,ready,served',
        ]);

        $allowedTransitions = [
            'new'         => ['in_progress'],
            'in_progress' => ['ready'],
            'ready'       => ['served'],
            'served'      => [],
        ];

        $newStatus     = $validated['status'];
        $currentStatus = $kot->status;

        if (! in_array($newStatus, $allowedTransitions[$currentStatus] ?? [])) {
            throw ValidationException::withMessages([
                'status' => ["Cannot change KOT status from '{$currentStatus}' to '{$newStatus}'."],
            ]);
        }

        $kot->update(['status' => $newStatus]);

        // When KOT is marked ready, update all pending/cooking lines to ready
        if ($newStatus === 'ready') {
            $kot->lines()->whereIn('status', ['pending', 'cooking'])->update(['status' => 'ready']);

            // Update parent invoice lines that belong to this KOT
            // (mark the corresponding sales_invoice_lines kot_status as 'ready')
            $kotItemIds = $kot->lines()->pluck('item_id');
            $kot->invoice?->lines()
                ->whereIn('item_id', $kotItemIds)
                ->where('kot_status', 'sent')
                ->update(['kot_status' => 'ready']);
        }

        return response()->json(['data' => $kot->fresh()->load('lines')]);
    }

    /**
     * Update a single KOT line status (item-level kitchen control).
     */
    public function updateLineStatus(Request $request, KitchenOrderTicket $kot, KotLine $line): JsonResponse
    {
        if ($line->kot_id !== $kot->id) {
            return response()->json(['message' => 'Line does not belong to this KOT'], 422);
        }

        $validated = $request->validate([
            'status' => 'required|in:pending,cooking,ready',
        ]);

        $line->update(['status' => $validated['status']]);

        // Auto-advance KOT to in_progress when any line starts cooking
        if ($validated['status'] === 'cooking' && $kot->status === 'new') {
            $kot->update(['status' => 'in_progress']);
        }

        // Auto-advance KOT to ready when all lines are ready
        if ($validated['status'] === 'ready' && $kot->isAllReady()) {
            $kot->update(['status' => 'ready']);

            $kotItemIds = $kot->lines()->pluck('item_id');
            $kot->invoice?->lines()
                ->whereIn('item_id', $kotItemIds)
                ->where('kot_status', 'sent')
                ->update(['kot_status' => 'ready']);
        }

        return response()->json(['data' => $line->fresh()]);
    }

    /**
     * Reprint a KOT — increments print count and returns KOT data.
     */
    public function reprint(KitchenOrderTicket $kot): JsonResponse
    {
        $kot->increment('print_count');

        return response()->json([
            'data'    => $kot->fresh()->load('lines.item', 'invoice.diningTable'),
            'message' => "KOT reprinted (print #{$kot->fresh()->print_count})",
        ]);
    }
}
